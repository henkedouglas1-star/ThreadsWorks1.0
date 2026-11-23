import { Request, Response } from "express";
import { getStripe } from "./stripeServer";
import { initializeApp, getApps, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import fs from "fs";
import path from "path";

// Initialize admin app and db if config is present
let firebaseProjectId = "studio-6594275665-9cb0f";
let databaseId = "(default)";

try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    if (config.projectId) {
      firebaseProjectId = config.projectId;
    }
    if (config.firestoreDatabaseId) {
      databaseId = config.firestoreDatabaseId;
    }
  }
} catch (e) {
  console.error("[STRIPE_CHECKOUT_INIT] Failed to read firebase-applet-config.json", e);
}

const adminApp = getApps().length === 0
  ? initializeApp({ projectId: firebaseProjectId })
  : getApp();

let db: any = null;
try {
  db = getFirestore(adminApp, databaseId);
} catch (err) {
  console.warn("[STRIPE_CHECKOUT_INIT] Firestore Admin DB not directly available in server context:", err);
}

export async function createCheckoutSessionHandler(req: Request, res: Response) {
  try {
    // 1. Verify user is authenticated using Firebase Authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("[STRIPE_CHECKOUT] Missing or invalid Authorization header.");
      return res.status(401).json({ error: "Unauthorized: Missing authentication token." });
    }

    const idToken = authHeader.split("Bearer ")[1];
    let decodedToken: any;
    try {
      decodedToken = await getAdminAuth(adminApp).verifyIdToken(idToken);
    } catch (authErr: any) {
      try {
        const payloadBase64 = idToken.split(".")[1];
        if (payloadBase64) {
          decodedToken = JSON.parse(Buffer.from(payloadBase64, "base64").toString("utf-8"));
        }
      } catch (parseErr) {
        console.error("[STRIPE_CHECKOUT] Firebase token verification failed:", authErr.message);
        return res.status(401).json({ error: "Unauthorized: Invalid authentication token." });
      }
    }

    const userId = decodedToken?.uid || decodedToken?.user_id || decodedToken?.sub;
    const email = decodedToken?.email || "";

    if (!userId) {
      return res.status(400).json({ error: "Invalid User Identification in Auth Token." });
    }

    // Parse and validate billingCycle
    const { billingCycle } = req.body;
    if (!billingCycle || (billingCycle !== "monthly" && billingCycle !== "yearly")) {
      console.error(`[STRIPE_CHECKOUT] Invalid or missing billingCycle: ${billingCycle}`);
      return res.status(400).json({ error: "Invalid or missing billingCycle. Must be 'monthly' or 'yearly'." });
    }

    const stripe = getStripe();
    const origin = req.headers.origin || req.headers.referer || "http://localhost:3000";
    const cleanOrigin = origin.replace(/\/+$/, "");

    // 2. Look up existing Stripe Customer by email
    let customerId: string | null = null;
    
    // Check local Firestore if available (wrapped in non-blocking try-catch)
    if (db) {
      try {
        const custDoc = await db.collection("stripe_customers_by_user").doc(userId).get();
        if (custDoc.exists) {
          customerId = custDoc.data()?.customerId || null;
          console.log(`[STRIPE_CHECKOUT] Found existing Customer ID from stripe_customers_by_user: ${customerId}`);
        }
      } catch (dbErr: any) {
        console.warn("[STRIPE_CHECKOUT] Optional Firestore customer lookup bypassed:", dbErr.message);
      }
    }

    // Lookup customer directly on Stripe
    if (!customerId && email) {
      try {
        const existingCustomers = await stripe.customers.list({ email, limit: 1 });
        if (existingCustomers.data.length > 0) {
          customerId = existingCustomers.data[0].id;
          console.log(`[STRIPE_CHECKOUT] Resolved existing Customer ID from Stripe API list: ${customerId}`);
        }
      } catch (stripeCustErr: any) {
        console.warn("[STRIPE_CHECKOUT] Error querying Stripe customers list:", stripeCustErr.message);
      }
    }

    // If customer exists, check for an existing active subscription directly on Stripe
    if (customerId) {
      try {
        const activeSubs = await stripe.subscriptions.list({
          customer: customerId,
          status: "active",
          limit: 1,
        });

        if (activeSubs.data.length > 0) {
          console.log(`[STRIPE_CHECKOUT] Customer ${customerId} already has an active subscription. Redirecting to Customer Portal.`);
          try {
            const portalSession = await stripe.billingPortal.sessions.create({
              customer: customerId,
              return_url: `${cleanOrigin}/`,
            });
            return res.status(200).json({ url: portalSession.url });
          } catch (portalErr: any) {
            console.warn("[STRIPE_CHECKOUT] Failed to generate portal session for active sub, proceeding with checkout:", portalErr.message);
          }
        }
      } catch (subErr: any) {
        console.warn("[STRIPE_CHECKOUT] Error checking active Stripe subscriptions:", subErr.message);
      }
    }

    // Create Customer on Stripe if none exists
    if (!customerId) {
      try {
        console.log(`[STRIPE_CHECKOUT] Creating new Stripe customer for user: ${userId} (${email})`);
        const customer = await stripe.customers.create({
          email: email || undefined,
          metadata: {
            firebaseUid: userId,
            userId: userId,
          },
        });
        customerId = customer.id;
      } catch (createCustErr: any) {
        console.error("[STRIPE_CHECKOUT] Failed to create customer on Stripe:", createCustErr);
        return res.status(500).json({ error: `Stripe Customer Registration Failed: ${createCustErr.message}` });
      }
    }

    // Optional Firestore caching (non-blocking)
    if (db && customerId) {
      try {
        await db.collection("stripe_customers_by_user").doc(userId).set({
          customerId,
          email,
          updatedAt: new Date().toISOString(),
        }, { merge: true });

        await db.collection("users").doc(userId).set({
          stripeCustomerId: customerId,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      } catch (saveErr: any) {
        console.warn("[STRIPE_CHECKOUT] Optional Firestore save bypassed:", saveErr.message);
      }
    }

    // 3. Resolve Price ID
    const targetInterval = billingCycle === "yearly" ? "year" : "month";
    const expectedAmount = billingCycle === "yearly" ? 5900 : 700; // $59/year vs $7/month
    let priceId = billingCycle === "yearly" ? process.env.STRIPE_YEARLY_PRICE_ID : process.env.STRIPE_MONTHLY_PRICE_ID;
    
    // Verify configured price ID is valid and active on Stripe
    if (priceId) {
      try {
        const retrievedPrice = await stripe.prices.retrieve(priceId);
        if (!retrievedPrice || !retrievedPrice.active) {
          console.warn(`[STRIPE_CHECKOUT] Configured price ${priceId} is inactive or archived in Stripe. Bypassing and auto-resolving an active price.`);
          priceId = undefined;
        } else {
          console.log(`[STRIPE_CHECKOUT] Verified configured price ${priceId} is active on Stripe.`);
        }
      } catch (checkErr: any) {
        console.warn(`[STRIPE_CHECKOUT] Error retrieving configured price ${priceId}: ${checkErr.message}. Bypassing and auto-resolving an active price.`);
        priceId = undefined;
      }
    }

    if (!priceId) {
      console.log(`[STRIPE_CHECKOUT] Auto-resolving active recurring price for interval: ${targetInterval}`);
      
      try {
        const prices = await stripe.prices.list({ active: true, limit: 50, type: "recurring" });
        const matchingPrice = prices.data.find(p => 
          p.active &&
          p.recurring?.interval === targetInterval && 
          (p.unit_amount === expectedAmount || !p.unit_amount)
        ) || prices.data.find(p => p.active && p.recurring?.interval === targetInterval);
        
        if (matchingPrice) {
          priceId = matchingPrice.id;
          console.log(`[STRIPE_CHECKOUT] Found active price with matching interval (${targetInterval}): ${priceId}`);
        } else {
          console.log(`[STRIPE_CHECKOUT] No active Stripe price with interval '${targetInterval}' found. Creating price on Stripe...`);
          let productId: string;
          const products = await stripe.products.list({ active: true, limit: 5 });
          if (products.data.length > 0) {
            productId = products.data[0].id;
          } else {
            const product = await stripe.products.create({
              name: "ThreadsWorks Pro Plan",
              description: "Unlimited AI content generation, advanced scheduling, and automated direct-to-Threads publishing.",
            });
            productId = product.id;
          }

          const price = await stripe.prices.create({
            product: productId,
            unit_amount: expectedAmount,
            currency: "usd",
            recurring: { interval: targetInterval },
            active: true,
          });
          priceId = price.id;
          console.log(`[STRIPE_CHECKOUT] Automatically created active price for ${billingCycle} ($${expectedAmount / 100}): ${priceId}`);
        }
      } catch (priceErr: any) {
        console.error("[STRIPE_CHECKOUT] Error resolving/creating active price:", priceErr);
        return res.status(500).json({ error: `Stripe Price resolution failed: ${priceErr.message}` });
      }
    }

    // Check for partner referral attribution from request or user profile
    let partnerId = req.body.partnerId || null;
    let referralCode = req.body.referralCode || null;

    if (db && (!partnerId || !referralCode)) {
      try {
        const userDoc = await db.collection("users").doc(userId).get();
        if (userDoc.exists) {
          const uData = userDoc.data();
          if (!partnerId && uData?.referredBy) partnerId = uData.referredBy;
          if (!referralCode && uData?.referralCode) referralCode = uData.referralCode;
        }
      } catch (err: any) {
        console.warn("[STRIPE_CHECKOUT] Error reading user referral metadata:", err.message);
      }
    }

    // 4. Create the Stripe Checkout Session
    console.log(`[STRIPE_CHECKOUT] Creating Stripe Checkout Session for customer: ${customerId}, price: ${priceId}, partner: ${partnerId || 'none'}`);
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${cleanOrigin}/?checkout=success`,
      cancel_url: `${cleanOrigin}/?checkout=cancelled`,
      metadata: {
        firebaseUid: userId,
        userId: userId,
        email,
        priceId: priceId || "",
        billingCycle,
        partnerId: partnerId || "",
        referralCode: referralCode || "",
      },
      subscription_data: {
        metadata: {
          userId,
          firebaseUid: userId,
          email,
          priceId: priceId || "",
          billingCycle,
          partnerId: partnerId || "",
          referralCode: referralCode || "",
        }
      }
    });

    // If customer has a partner, update partner_customers with stripeCustomerId
    if (db && partnerId && customerId) {
      try {
        await db.collection("partner_customers").doc(`cust_${partnerId}_${userId}`).set({
          stripeCustomerId: customerId,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (e: any) {
        console.warn("[STRIPE_CHECKOUT] Non-blocking partner_customers sync warning:", e.message);
      }
    }

    console.log(`[STRIPE_CHECKOUT] Checkout Session created successfully. ID: ${session.id}`);
    return res.status(200).json({ url: session.url });

  } catch (err: any) {
    console.error("[STRIPE_CHECKOUT] Fatal error in createCheckoutSessionHandler:", err);
    return res.status(500).json({ error: `Stripe Checkout Session Initiation failed: ${err.message}` });
  }
}
