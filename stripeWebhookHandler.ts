import { Request, Response } from "express";
import { getStripe } from "./stripeServer";
import { initializeApp, getApps, getApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";
import { processStripeInvoiceCommission, handleSubscriptionStatusChange } from "./server/partnerService";
import { handleMembershipEvent } from "./server/membershipWebhookService";

// ---------------------------------------------------------
// Firestore database setup for the Webhook Handler
// ---------------------------------------------------------
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
  console.error("[STRIPE_WEBHOOK_INIT] Failed to read firebase-applet-config.json", e);
}

const adminApp = getApps().length === 0
  ? initializeApp({ projectId: firebaseProjectId })
  : getApp();

const db = getFirestore(adminApp, databaseId);

// ---------------------------------------------------------
// Helper functions
// ---------------------------------------------------------

/**
 * Resolves userId for a given customer or subscription.
 * Uses event metadata, client_reference_id, or queries firestore for existing links.
 */
async function resolveUserId(customerId: string, metadataUserId?: string, subscriptionId?: string): Promise<string> {
  if (metadataUserId) return metadataUserId;

  try {
    // 1. Look up by customerId in active/past subscriptions
    const subQuery = await db.collection("stripe_subscriptions")
      .where("customerId", "==", customerId)
      .limit(1)
      .get();
    
    if (!subQuery.empty) {
      const data = subQuery.docs[0].data();
      if (data.userId) return data.userId;
    }

    // 2. Look up by customerId in customer mapping collection
    const customerDoc = await db.collection("stripe_customers").doc(customerId).get();
    if (customerDoc.exists) {
      const data = customerDoc.data();
      if (data?.userId) return data.userId;
    }
  } catch (err) {
    console.error(`[STRIPE_WEBHOOK] Error resolving userId for customer ${customerId}:`, err);
  }

  return "unknown_or_anonymous";
}

/**
 * Synchronizes a Stripe subscription to the authenticated user's Firestore document.
 */
async function syncSubscriptionToUserDoc(userId: string, subscriptionId: string, alternateCustomerId?: string, fallbackSubData?: any) {
  if (!userId || userId === "unknown_or_anonymous") {
    console.log("[STRIPE_WEBHOOK] userId is unknown or anonymous, skipping sync to users collection.");
    return;
  }

  const stripe = getStripe();
  let sub: any = null;
  try {
    sub = await stripe.subscriptions.retrieve(subscriptionId);
  } catch (retrieveErr: any) {
    console.warn(`[STRIPE_WEBHOOK] Failed to retrieve subscription ${subscriptionId} via API, using fallback data from event:`, retrieveErr.message);
    if (fallbackSubData) {
      sub = fallbackSubData;
    } else {
      throw retrieveErr;
    }
  }

  try {
    const customerId = (typeof sub.customer === "string" ? sub.customer : sub?.customer?.id) || alternateCustomerId || "";
    
    const items = sub.items?.data || sub.items || [];
    const priceItem = items[0]?.price || items[0] || null;
    const priceId = priceItem?.id || sub.plan?.id || "";
    const interval = priceItem?.recurring?.interval || sub.plan?.interval || "";
    
    const status = sub.status || "canceled";
    const isActive = status === "active" || status === "trialing";
    
    const billingInterval = interval === "year" ? "yearly" : (interval === "month" ? "monthly" : interval);
    const subscriptionTier = isActive ? "pro" : "free";
    const subscriptionStatus = isActive ? "active" : "inactive";

    const updateData: any = {
      subscriptionStatus,
      subscriptionTier,
      billingInterval: isActive ? billingInterval : null,
      subscriptionActive: isActive,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      stripePriceId: priceId,
      currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : new Date().toISOString(),
      cancelAtPeriodEnd: !!sub.cancel_at_period_end,
      stripeSubscriptionStatus: status,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (sub.current_period_start) {
      updateData.lastPaymentDate = new Date(sub.current_period_start * 1000).toISOString();
    }
    if (sub.current_period_end) {
      updateData.nextBillingDate = new Date(sub.current_period_end * 1000).toISOString();
    }

    const userDocRef = db.collection("users").doc(userId);
    const userDoc = await userDocRef.get();
    
    if (!userDoc.exists) {
      updateData.createdAt = FieldValue.serverTimestamp();
      await userDocRef.set(updateData, { merge: true });
    } else {
      const existingData = userDoc.data();
      if (!existingData?.createdAt) {
        updateData.createdAt = FieldValue.serverTimestamp();
      }
      await userDocRef.update(updateData);
    }

    console.log(`[STRIPE_WEBHOOK] Synchronized Stripe subscription status to user profile: ${userId}. Active: ${isActive}, Status: ${status}`);
  } catch (err: any) {
    console.error(`[STRIPE_WEBHOOK] Failed to sync subscription ${subscriptionId} to user ${userId}:`, err);
    throw err;
  }
}

/**
 * Main Stripe Webhook router and event processor.
 */
export async function stripeWebhookHandler(req: Request, res: Response) {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig) {
    console.error("[STRIPE_WEBHOOK] Missing Stripe-Signature header.");
    return res.status(400).send("Webhook verification failed: Missing stripe-signature header.");
  }

  if (!webhookSecret) {
    console.error("[STRIPE_WEBHOOK] STRIPE_WEBHOOK_SECRET is not configured.");
    return res.status(500).send("Internal Server Error: Webhook secret not configured.");
  }

  let event: any;
  try {
    const stripe = getStripe();
    // Verify every webhook request using STRIPE_WEBHOOK_SECRET
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error(`[STRIPE_WEBHOOK] Signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook signature verification failed: ${err.message}`);
  }

  const eventId = event.id;
  const eventType = event.type;
  const timestamp = new Date().toISOString();

  console.log(`[STRIPE_WEBHOOK] [${timestamp}] Received event ID: ${eventId}, Type: ${eventType}`);

  try {
    // ---------------------------------------------------------
    // Idempotency check: Ignore already processed events
    // ---------------------------------------------------------
    const processedRef = db.collection("stripe_processed_events").doc(eventId);
    const processedDoc = await processedRef.get();

    if (processedDoc.exists && processedDoc.data()?.status === "success") {
      console.log(`[STRIPE_WEBHOOK] Event ID ${eventId} was already processed successfully. Ignoring duplicate.`);
      return res.status(200).json({ status: "ignored_duplicate", eventId });
    }

    // Log received event in full audit collection before processing
    await db.collection("stripe_events_log").add({
      eventId,
      eventType,
      timestamp,
      status: "received",
      livemode: event.livemode,
    });

    const dataObject = event.data.object;

    // New membership events are reconciled separately and never enter the
    // legacy global-Pro subscription sync. Signature verification above is mandatory.
    if (await handleMembershipEvent(db, getStripe(), event)) {
      await processedRef.set({
        id: eventId,
        type: eventType,
        processedAt: timestamp,
        status: "success",
        handler: "scoped_membership",
      });
      return res.status(200).json({ status: "success", eventId });
    }

    // ---------------------------------------------------------
    // Process supported events
    // ---------------------------------------------------------
    switch (eventType) {
      case "checkout.session.completed": {
        const session = dataObject;
        const userId = session.client_reference_id || session.metadata?.userId || "unknown_or_anonymous";
        const customerId = session.customer;
        const subscriptionId = session.subscription;

        console.log(`[STRIPE_WEBHOOK] Processing checkout.session.completed for user: ${userId}, customer: ${customerId}`);

        if (customerId && userId !== "unknown_or_anonymous") {
          // Store customer-user mapping
          await db.collection("stripe_customers").doc(customerId).set({
            userId,
            email: session.customer_details?.email || "",
            createdAt: timestamp,
          }, { merge: true });
        }

        if (subscriptionId) {
          // Initialize active subscription metadata
          await db.collection("stripe_subscriptions").doc(subscriptionId).set({
            userId,
            subscriptionId,
            customerId: customerId || "",
            status: "active",
            priceId: session.metadata?.priceId || "",
            updatedAt: timestamp,
            createdAt: timestamp,
          }, { merge: true });

          // Sync to user profile document
          await syncSubscriptionToUserDoc(userId, subscriptionId, customerId);
        }
        break;
      }

      case "customer.subscription.created": {
        const sub = dataObject;
        const customerId = sub.customer;
        const subscriptionId = sub.id;
        const userId = await resolveUserId(customerId, sub.metadata?.userId || sub.metadata?.firebaseUid, subscriptionId);

        console.log(`[STRIPE_WEBHOOK] Processing customer.subscription.created for customer: ${customerId}, subscription: ${subscriptionId}`);

        const priceItem = sub.items?.data?.[0]?.price;
        const interval = priceItem?.recurring?.interval || "";

        await db.collection("stripe_subscriptions").doc(subscriptionId).set({
          userId,
          subscriptionId,
          customerId,
          status: sub.status,
          priceId: priceItem?.id || "",
          billingInterval: interval,
          currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
          currentPeriodStart: new Date(sub.current_period_start * 1000).toISOString(),
          cancelAtPeriodEnd: !!sub.cancel_at_period_end,
          updatedAt: timestamp,
          createdAt: timestamp,
        }, { merge: true });

        // Sync to user profile document
        await syncSubscriptionToUserDoc(userId, subscriptionId, customerId, sub);
        break;
      }

      case "customer.subscription.updated": {
        const sub = dataObject;
        const customerId = sub.customer;
        const subscriptionId = sub.id;
        const userId = await resolveUserId(customerId, sub.metadata?.userId || sub.metadata?.firebaseUid, subscriptionId);

        console.log(`[STRIPE_WEBHOOK] Processing customer.subscription.updated for subscription: ${subscriptionId}`);

        const priceItem = sub.items?.data?.[0]?.price;
        const interval = priceItem?.recurring?.interval || "";

        await db.collection("stripe_subscriptions").doc(subscriptionId).set({
          userId,
          subscriptionId,
          customerId,
          status: sub.status,
          priceId: priceItem?.id || "",
          billingInterval: interval,
          currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
          currentPeriodStart: new Date(sub.current_period_start * 1000).toISOString(),
          cancelAtPeriodEnd: !!sub.cancel_at_period_end,
          updatedAt: timestamp,
        }, { merge: true });

        // Sync to user profile document
        await syncSubscriptionToUserDoc(userId, subscriptionId, customerId, sub);

        // Sync to Partner Hub customer status
        await handleSubscriptionStatusChange(sub, sub.status === "active" ? "active" : "past_due");
        break;
      }

      case "customer.subscription.deleted": {
        const sub = dataObject;
        const customerId = sub.customer;
        const subscriptionId = sub.id;
        const userId = await resolveUserId(customerId, sub.metadata?.userId || sub.metadata?.firebaseUid, subscriptionId);

        console.log(`[STRIPE_WEBHOOK] Processing customer.subscription.deleted for subscription: ${subscriptionId}`);

        await db.collection("stripe_subscriptions").doc(subscriptionId).set({
          status: "canceled",
          updatedAt: timestamp,
        }, { merge: true });

        // Sync to user profile document to mark as inactive
        await syncSubscriptionToUserDoc(userId, subscriptionId, customerId, sub);

        // Update Partner Hub customer attribution status
        await handleSubscriptionStatusChange(sub, "canceled");
        break;
      }

      case "invoice.paid": {
        const invoice = dataObject;
        const subscriptionId = invoice.subscription;
        const customerId = invoice.customer;
        const userId = await resolveUserId(customerId, undefined, subscriptionId || undefined);

        console.log(`[STRIPE_WEBHOOK] Processing invoice.paid for invoice: ${invoice.id}, sub: ${subscriptionId}`);

        if (subscriptionId) {
          await db.collection("stripe_subscriptions").doc(subscriptionId).set({
            status: "active",
            updatedAt: timestamp,
          }, { merge: true });

          // Sync to user profile document
          await syncSubscriptionToUserDoc(userId, subscriptionId, customerId);
        }

        // Record the transaction log
        await db.collection("stripe_invoices").doc(invoice.id).set({
          invoiceId: invoice.id,
          subscriptionId: subscriptionId || "",
          customerId: customerId,
          amountPaid: invoice.amount_paid,
          currency: invoice.currency,
          status: "paid",
          hostedInvoiceUrl: invoice.hosted_invoice_url || "",
          createdAt: timestamp,
        });

        // Calculate and credit 50% recurring affiliate commission
        try {
          const commResult = await processStripeInvoiceCommission(invoice);
          if (commResult.created) {
            console.log(`[STRIPE_WEBHOOK] Successfully recorded affiliate commission for invoice ${invoice.id}`);
          }
        } catch (commErr: any) {
          console.error("[STRIPE_WEBHOOK] Error processing partner commission:", commErr);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = dataObject;
        const subscriptionId = invoice.subscription;
        const customerId = invoice.customer;
        const userId = await resolveUserId(customerId, undefined, subscriptionId || undefined);

        console.log(`[STRIPE_WEBHOOK] Processing invoice.payment_failed for invoice: ${invoice.id}`);

        if (subscriptionId) {
          await db.collection("stripe_subscriptions").doc(subscriptionId).set({
            status: "past_due",
            updatedAt: timestamp,
          }, { merge: true });

          // Sync to user profile document
          await syncSubscriptionToUserDoc(userId, subscriptionId, customerId);
        }

        await db.collection("stripe_invoices").doc(invoice.id).set({
          invoiceId: invoice.id,
          subscriptionId: subscriptionId || "",
          customerId: customerId,
          amountPaid: 0,
          status: "failed",
          createdAt: timestamp,
        }, { merge: true });
        break;
      }

      case "checkout.session.async_payment_succeeded": {
        const session = dataObject;
        const customerId = session.customer;
        const subscriptionId = session.subscription;
        const userId = session.client_reference_id || session.metadata?.userId || "unknown_or_anonymous";

        console.log(`[STRIPE_WEBHOOK] Processing checkout.session.async_payment_succeeded for session: ${session.id}`);

        if (subscriptionId) {
          await db.collection("stripe_subscriptions").doc(subscriptionId).set({
            status: "active",
            updatedAt: timestamp,
          }, { merge: true });

          // Sync to user profile document
          await syncSubscriptionToUserDoc(userId, subscriptionId, customerId);
        }
        break;
      }

      case "checkout.session.async_payment_failed": {
        const session = dataObject;
        const customerId = session.customer;
        const subscriptionId = session.subscription;
        const userId = session.client_reference_id || session.metadata?.userId || "unknown_or_anonymous";

        console.log(`[STRIPE_WEBHOOK] Processing checkout.session.async_payment_failed for session: ${session.id}`);

        if (subscriptionId) {
          await db.collection("stripe_subscriptions").doc(subscriptionId).set({
            status: "unpaid",
            updatedAt: timestamp,
          }, { merge: true });

          // Sync to user profile document
          await syncSubscriptionToUserDoc(userId, subscriptionId, customerId);
        }
        break;
      }

      default:
        console.log(`[STRIPE_WEBHOOK] Unhandled Stripe webhook event type: ${eventType}`);
    }

    // ---------------------------------------------------------
    // Record successful processing to satisfy idempotency
    // ---------------------------------------------------------
    await processedRef.set({
      id: eventId,
      type: eventType,
      processedAt: timestamp,
      status: "success",
    });

    console.log(`[STRIPE_WEBHOOK] Successfully completed processing for event ID: ${eventId}`);
    return res.status(200).json({ status: "success", eventId });

  } catch (processingErr: any) {
    console.error(`[STRIPE_WEBHOOK] Processing Error on event ${eventId} (${eventType}):`, processingErr);
    
    // Attempt to log the failed event status
    try {
      await db.collection("stripe_processed_events").doc(eventId).set({
        id: eventId,
        type: eventType,
        processedAt: timestamp,
        status: "failed",
        error: processingErr.message,
      });
    } catch (dbLogErr) {
      console.error("[STRIPE_WEBHOOK] Failed to log webhook error state to Firestore:", dbLogErr);
    }

    return res.status(500).send(`Internal Webhook Processing Error: ${processingErr.message}`);
  }
}
