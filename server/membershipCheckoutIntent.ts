import { getStripe } from "../stripeServer";
import { identifyMembershipPrice } from "./membershipPaymentService";
import { randomBytes } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import { MEMBERSHIP_PLANS } from "../src/data/membershipCatalog";
import { configuredMembershipPrices, type NewMembershipId } from "./membershipPaymentService";

import { MEMBERSHIP_STRIPE_IDS } from "./membershipStripeConfig";

export const MEMBERSHIP_INTENT_COLLECTION = "membership_checkout_intents";
const INTENT_TTL_MS = 30 * 60 * 1000;

export function membershipLinkId(planId: NewMembershipId): string | undefined {
  return (planId === "contentpaysclub" ? process.env.STRIPE_CLUB_PAYMENT_LINK_ID : process.env.STRIPE_BUNDLE_PAYMENT_LINK_ID)?.trim() || MEMBERSHIP_STRIPE_IDS[planId].paymentLinkId;
}

// Call only after authenticating the user server-side. Never accept a UID,
// payment link, price, or return destination supplied by the browser.
export async function createMembershipCheckoutIntent(db: Firestore, userId: string, planId: NewMembershipId, now = Date.now()) {
  if (!userId || userId.includes("/") || userId === "anonymous") throw new Error("Authentication required.");
  if (planId !== "contentpaysclub" && planId !== "contentpaysbundle") throw new Error("Unknown membership.");
  if (process.env.MEMBERSHIP_CHECKOUT_ENABLED !== "true") throw new Error("Membership checkout is not available yet.");
  const plan = MEMBERSHIP_PLANS.find(p => p.id === planId);
  const paymentLinkId = membershipLinkId(planId);
  const priceId = configuredMembershipPrices()[planId];
  const live = process.env.MEMBERSHIP_STRIPE_MODE;
  if (!plan?.paymentLink || !paymentLinkId?.startsWith("plink_") || !priceId?.startsWith("price_") ||
      (live !== "test" && live !== "live")) throw new Error("Membership billing is not configured.");
  const url = new URL(plan.paymentLink);
  if (url.origin !== "https://buy.stripe.com" || url.username || url.password) throw new Error("Invalid payment destination.");
  // Validate the actual Stripe objects before issuing a checkout reference.
  const stripe = getStripe();
  const [link, price, lineItems] = await Promise.all([
    stripe.paymentLinks.retrieve(paymentLinkId),
    stripe.prices.retrieve(priceId),
    stripe.paymentLinks.listLineItems(paymentLinkId, { limit: 2 }),
  ]);
  const items = lineItems.data;
  if (!link.active || link.livemode !== (live === "live") || price.livemode !== link.livemode ||
      !price.active || identifyMembershipPrice(price, configuredMembershipPrices()) !== planId ||
      link.url !== plan.paymentLink || lineItems.has_more || items.length !== 1 ||
      items[0]?.price?.id !== priceId || items[0]?.quantity !== 1 ||
      (items[0] as { adjustable_quantity?: { enabled?: boolean } })?.adjustable_quantity?.enabled) {
    throw new Error("Stripe membership configuration does not match the approved offer.");
  }
  const reference = "mbr_" + randomBytes(32).toString("hex");
  const expiresAt = now + INTENT_TTL_MS;
  await db.collection(MEMBERSHIP_INTENT_COLLECTION).doc(reference).create({
    userId, planId, reference, paymentLinkId, priceId, livemode: live === "live",
    createdAt: now, expiresAt
  });
  url.searchParams.set("client_reference_id", reference);
  return { url: url.toString(), expiresAt };
}
