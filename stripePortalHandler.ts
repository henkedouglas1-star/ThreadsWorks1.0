import { Request, Response } from "express";
import { getStripe } from "./stripeServer";
import { initializeApp, getApps, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import fs from "fs";
import path from "path";

// Initialize admin app and db
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
  console.error("[STRIPE_PORTAL_INIT] Failed to read firebase-applet-config.json", e);
}

const adminApp = getApps().length === 0
  ? initializeApp({ projectId: firebaseProjectId })
  : getApp();

let db: any = null;
try {
  db = getFirestore(adminApp, databaseId);
} catch (err) {
  console.warn("[STRIPE_PORTAL_INIT] Firestore Admin DB not directly available in server context:", err);
}

export async function createPortalSessionHandler(req: Request, res: Response) {
  try {
    // 1. Verify user is authenticated using Firebase Authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("[STRIPE_PORTAL] Missing or invalid Authorization header.");
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
        console.error("[STRIPE_PORTAL] Firebase token verification failed:", authErr.message);
        return res.status(401).json({ error: "Unauthorized: Invalid authentication token." });
      }
    }

    const userId = decodedToken?.uid || decodedToken?.user_id || decodedToken?.sub;
    const email = decodedToken?.email || "";
    if (!userId) {
      return res.status(400).json({ error: "Invalid User Identification in Auth Token." });
    }

    console.log(`[STRIPE_PORTAL] Generating customer billing portal for user: ${userId}`);
    const stripe = getStripe();

    let stripeCustomerId: string | null = null;

    // A. Check Firestore if available (non-blocking)
    if (db) {
      try {
        const userDoc = await db.collection("users").doc(userId).get();
        if (userDoc.exists) {
          stripeCustomerId = userDoc.data()?.stripeCustomerId || null;
        }

        if (!stripeCustomerId) {
          const custDoc = await db.collection("stripe_customers_by_user").doc(userId).get();
          if (custDoc.exists) {
            stripeCustomerId = custDoc.data()?.customerId || null;
          }
        }
      } catch (dbErr: any) {
        console.warn("[STRIPE_PORTAL] Optional Firestore customer lookup bypassed:", dbErr.message);
      }
    }

    // B. Check Stripe directly by email
    if (!stripeCustomerId && email) {
      try {
        const existingCustomers = await stripe.customers.list({ email, limit: 1 });
        if (existingCustomers.data.length > 0) {
          stripeCustomerId = existingCustomers.data[0].id;
        }
      } catch (stripeErr: any) {
        console.warn("[STRIPE_PORTAL] Error looking up customer in Stripe:", stripeErr.message);
      }
    }

    if (!stripeCustomerId) {
      console.error(`[STRIPE_PORTAL] No Stripe customer ID found for user ${userId}.`);
      return res.status(404).json({ error: "No billing profile found. Please subscribe first." });
    }

    const returnUrl = req.headers.referer || req.headers.origin || "http://localhost:3000";

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    });

    console.log(`[STRIPE_PORTAL] Billing portal session created successfully: ${portalSession.url}`);
    return res.status(200).json({ url: portalSession.url });

  } catch (err: any) {
    console.error("[STRIPE_PORTAL] Error creating portal session:", err);
    return res.status(500).json({ error: err.message || "Failed to create Stripe portal session." });
  }
}
