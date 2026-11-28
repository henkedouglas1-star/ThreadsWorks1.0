import type { Firestore } from "firebase-admin/firestore";
import { configuredMembershipPrices, resolvePaidMembership, validateMembershipCheckout } from "./membershipPaymentService";
import { MEMBERSHIP_INTENT_COLLECTION, membershipLinkId } from "./membershipCheckoutIntent";

export const MEMBERSHIP_SUBSCRIPTIONS = "membership_subscriptions";
const validId = (value: unknown, prefix: string): value is string =>
  typeof value === "string" && value.startsWith(prefix) && /^[a-zA-Z0-9_]+$/.test(value);

// Called exclusively after Stripe signature verification. Return true for
// scoped events so the legacy global-Pro handler cannot process them.
export async function handleMembershipEvent(db: Firestore, stripe: any, event: any): Promise<boolean> {
  const obj = event.data?.object;
  const type = event.type;
  const checkout = ["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed"].includes(type);
  const lifecycle = ["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted", "invoice.paid", "invoice.payment_failed"].includes(type);
  if (!checkout && !lifecycle) return false;
  const subscriptionId = type.startsWith("customer.subscription.") ? obj?.id : obj?.subscription;
  const scopedRef = checkout && typeof obj?.client_reference_id === "string" && obj.client_reference_id.startsWith("mbr_");
  const linkIds = [membershipLinkId("contentpaysclub"), membershipLinkId("contentpaysbundle")].filter(Boolean);
  const knownLink = checkout && linkIds.includes(obj?.payment_link);
  if (!validId(subscriptionId, "sub_")) return Boolean(scopedRef || knownLink);
  const record = db.collection(MEMBERSHIP_SUBSCRIPTIONS).doc(subscriptionId);
  const existing = await record.get();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const prices = configuredMembershipPrices();
  const configuredIds = Object.values(prices).filter(Boolean);
  const knownPrice = subscription.items?.data?.some((item: any) => configuredIds.includes(item?.price?.id));
  if (!scopedRef && !knownLink && !knownPrice && !existing.exists) return false;
  // Never allow test events to create production access.
  const mode = process.env.MEMBERSHIP_STRIPE_MODE;
  if ((mode !== "test" && mode !== "live") || event.livemode !== (mode === "live") || subscription.livemode !== event.livemode) return true;
  if (checkout && scopedRef && type !== "checkout.session.async_payment_failed" && /^mbr_[a-f0-9]{64}$/.test(obj.client_reference_id)) {
    const intentRef = db.collection(MEMBERSHIP_INTENT_COLLECTION).doc(obj.client_reference_id);
    await db.runTransaction(async tx => {
      const [intentSnap, recordSnap] = await Promise.all([tx.get(intentRef), tx.get(record)]);
      const intent = intentSnap.data();
      if (recordSnap.exists) return;
      // Use signed session creation time for delayed deliveries, not receipt time.
      const created = Number(obj.created) * 1000;
      if (!Number.isFinite(created) || !intent || created < intent.createdAt) return;
      const plan = validateMembershipCheckout(obj, subscription, intent, prices, created);
      if (!plan || intent.priceId !== subscription.items.data[0].price.id) return;
      tx.create(record, {userId: intent.userId, planId: plan, subscriptionId, customerId: subscription.customer,
        livemode: event.livemode, active: true, status: subscription.status, updatedAt: Date.now(), eventCreated: event.created});
      tx.update(intentRef, {consumedAt: Date.now(), subscriptionId});
    });
  } else if (existing.exists) {
    await db.runTransaction(async tx => {
      const snap = await tx.get(record);
      const data = snap.data();
      if (!data || data.customerId !== subscription.customer || data.livemode !== event.livemode) return;
      if (typeof data.eventCreated === "number" && event.created < data.eventCreated) return;
      const plan = resolvePaidMembership(subscription, prices);
      tx.update(record, {active: plan === data.planId, status: subscription.status, updatedAt: Date.now(), eventCreated: event.created});
    });
  }
  return true;
}
