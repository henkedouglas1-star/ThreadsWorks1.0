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
  const reference = "mbr_" + randomBytes(32).toString("hex");
  const expiresAt = now + INTENT_TTL_MS;
  await db.collection(MEMBERSHIP_INTENT_COLLECTION).doc(reference).create({
    userId, planId, reference, paymentLinkId, priceId, livemode: live === "live",
    createdAt: now, expiresAt
  });
  url.searchParams.set("client_reference_id", reference);
  return { url: url.toString(), expiresAt };
}
