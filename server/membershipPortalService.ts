import type { Firestore } from "firebase-admin/firestore";
import { getStripe } from "../stripeServer";
import { MEMBERSHIP_SUBSCRIPTIONS } from "./membershipWebhookService";

export async function createMembershipPortal(db: Firestore, userId: string, planId: string) {
  if (!userId || userId === "anonymous" || userId.includes("/")) throw new Error("Authentication required.");
  if (planId !== "contentpaysclub" && planId !== "contentpaysbundle") throw new Error("Invalid membership.");
  const mode = process.env.MEMBERSHIP_STRIPE_MODE;
  if (mode !== "test" && mode !== "live") throw new Error("Billing is not configured.");
  const records = await db.collection(MEMBERSHIP_SUBSCRIPTIONS).where("userId", "==", userId).get();
  const owned = records.docs.map(doc => doc.data()).filter(data =>
    data.userId === userId && data.planId === planId && data.livemode === (mode === "live") &&
    typeof data.customerId === "string" && /^cus_[a-zA-Z0-9_]+$/.test(data.customerId) &&
    typeof data.subscriptionId === "string" && /^sub_[a-zA-Z0-9_]+$/.test(data.subscriptionId)
  );
  const customerIds = [...new Set(owned.map(data => data.customerId as string))];
  if (customerIds.length !== 1) throw new Error("Billing account requires support verification.");
  const stripe = getStripe();
  const subscriptions = await Promise.all(owned.map(data => stripe.subscriptions.retrieve(data.subscriptionId)));
  if (!subscriptions.length || subscriptions.some(sub => sub.customer !== customerIds[0] || sub.livemode !== (mode === "live"))) {
    throw new Error("Billing account could not be verified.");
  }
  // Dedicated portal configuration must disable plan switching until scoped
  // upgrades, downgrades and duplicate-subscription prevention are supported.
  const configuration = process.env.MEMBERSHIP_PORTAL_CONFIGURATION_ID;
  if (!configuration?.startsWith("bpc_")) throw new Error("Membership portal is not configured.");
  const portalConfig = await stripe.billingPortal.configurations.retrieve(configuration);
  if (!portalConfig.active || portalConfig.livemode !== (mode === "live") ||
      portalConfig.features.subscription_update.enabled || !portalConfig.features.subscription_cancel.enabled) {
    throw new Error("Membership portal configuration is not approved.");
  }
  const session = await stripe.billingPortal.sessions.create({
    customer: customerIds[0], configuration,
    return_url: "https://threadsworks.com/",
  });
  return { url: session.url };
}
