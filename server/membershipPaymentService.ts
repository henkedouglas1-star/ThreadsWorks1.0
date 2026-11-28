import { MEMBERSHIP_PLANS, resolveMembershipAccess } from "../src/data/membershipCatalog";

import { MEMBERSHIP_STRIPE_IDS } from "./membershipStripeConfig";

export type NewMembershipId = "contentpaysclub" | "contentpaysbundle";
export type MembershipPrices = Record<NewMembershipId, string | undefined>;
export function configuredMembershipPrices(): MembershipPrices {
  return { contentpaysclub: process.env.STRIPE_CLUB_PRICE_ID?.trim() || MEMBERSHIP_STRIPE_IDS.contentpaysclub.priceId, contentpaysbundle: process.env.STRIPE_BUNDLE_PRICE_ID?.trim() || MEMBERSHIP_STRIPE_IDS.contentpaysbundle.priceId };
}

// A signed webhook alone is insufficient: match the actual recurring price,
// currency, amount, interval, quantity and subscription state.
export function identifyMembershipPrice(price: any, prices: MembershipPrices): NewMembershipId | null {
  if (!price || typeof price.id !== "string" || price.currency !== "usd" ||
      price.recurring?.interval !== "month" || price.recurring?.interval_count !== 1) return null;
  const matches = (Object.keys(prices) as NewMembershipId[]).filter(id => prices[id] && prices[id] === price.id);
  if (matches.length !== 1) return null;
  const plan = MEMBERSHIP_PLANS.find(p => p.id === matches[0]);
  return plan && price.unit_amount === plan.monthlyCents ? matches[0] : null;
}

export function resolvePaidMembership(subscription: any, prices: MembershipPrices): NewMembershipId | null {
  if (!subscription || subscription.status !== "active") return null;
  const items = subscription.items?.data;
  if (!Array.isArray(items) || items.length !== 1 || subscription.items?.has_more || items[0]?.quantity !== 1) return null;
  return identifyMembershipPrice(items[0].price, prices);
}

export function resolveScopedMemberships(subscriptions: readonly any[], prices: MembershipPrices): string[] {
  return resolveMembershipAccess(subscriptions.map(s => resolvePaidMembership(s, prices)).filter((id): id is NewMembershipId => id !== null));
}

// Checkout reference IDs are bearer-like opaque random tokens, not user IDs.
// The authenticated server must create and store them, then atomically consume
// them after matching the expected plan, payment link and Stripe subscription.
export function validateMembershipCheckout(session: any, subscription: any, intent: any, prices: MembershipPrices, now: number): NewMembershipId | null {
  if (!intent || typeof intent.userId !== "string" || !intent.userId || intent.consumedAt ||
      typeof intent.expiresAt !== "number" || intent.expiresAt <= now ||
      typeof intent.paymentLinkId !== "string" || !intent.paymentLinkId.startsWith("plink_") ||
      typeof session?.client_reference_id !== "string" || session.client_reference_id !== intent.reference ||
      session.mode !== "subscription" || session.payment_status !== "paid" ||
      session.payment_link !== intent.paymentLinkId || session.subscription !== subscription?.id ||
      typeof session.customer !== "string" || session.customer !== subscription.customer ||
      session.livemode !== intent.livemode || subscription.livemode !== intent.livemode) return null;
  const plan = resolvePaidMembership(subscription, prices);
  return plan && plan === intent.planId ? plan : null;
}
