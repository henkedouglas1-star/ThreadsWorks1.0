import { test } from "node:test";
import assert from "node:assert/strict";
import { identifyMembershipPrice, resolvePaidMembership, resolveScopedMemberships, validateMembershipCheckout } from "../server/membershipPaymentService";

const prices = { contentpaysclub: "price_club_test", contentpaysbundle: "price_bundle_test" };
const clubPrice = { id: prices.contentpaysclub, currency: "usd", unit_amount: 2900, recurring: { interval: "month", interval_count: 1 } };
const bundlePrice = { ...clubPrice, id: prices.contentpaysbundle, unit_amount: 10000 };
const subscription = { id: "sub_test", customer: "cus_test", livemode: false, status: "active", items: { data: [{ quantity: 1, price: clubPrice }], has_more: false } };
const session = { client_reference_id: "opaque_test_reference", mode: "subscription", payment_status: "paid", payment_link: "plink_test", subscription: "sub_test", customer: "cus_test", livemode: false };
const intent = { userId: "verified_user", reference: "opaque_test_reference", planId: "contentpaysclub", paymentLinkId: "plink_test", livemode: false, expiresAt: 2000 };

test("only configured exact recurring prices identify new memberships", () => {
  assert.equal(identifyMembershipPrice(clubPrice, prices), "contentpaysclub");
  assert.equal(identifyMembershipPrice(bundlePrice, prices), "contentpaysbundle");
  assert.equal(identifyMembershipPrice({ ...clubPrice, unit_amount: 100 }, prices), null);
  assert.equal(identifyMembershipPrice({ ...clubPrice, currency: "eur" }, prices), null);
  assert.equal(identifyMembershipPrice({ ...clubPrice, id: "price_unknown" }, prices), null);
  assert.equal(identifyMembershipPrice({ ...clubPrice, recurring: { interval: "year", interval_count: 1 } }, prices), null);
  assert.equal(identifyMembershipPrice(clubPrice, { contentpaysclub: undefined, contentpaysbundle: undefined }), null);
  assert.equal(identifyMembershipPrice(clubPrice, { contentpaysclub: clubPrice.id, contentpaysbundle: clubPrice.id }), null);
});

test("inactive, unpaid and ambiguous subscriptions grant no new access", () => {
  for (const status of ["trialing", "past_due", "canceled", "unpaid", "incomplete", "paused"]) {
    assert.equal(resolvePaidMembership({ ...subscription, status }, prices), null);
  }
  assert.equal(resolvePaidMembership({ ...subscription, items: { data: [{ quantity: 2, price: clubPrice }] } }, prices), null);
  assert.equal(resolvePaidMembership({ ...subscription, items: { ...subscription.items, has_more: true } }, prices), null);
  assert.deepEqual(resolveScopedMemberships([subscription], prices), ["club"]);
  assert.deepEqual(resolveScopedMemberships([{ ...subscription, status: "canceled" }], prices), []);
  assert.ok(resolveScopedMemberships([{ ...subscription, items: { data: [{ quantity: 1, price: bundlePrice }] } }], prices).includes("threadsworks"));
});

test("checkout requires matching unconsumed intent, subscription, customer and payment link", () => {
  assert.equal(validateMembershipCheckout(session, subscription, intent, prices, 1000), "contentpaysclub");
  for (const override of [{ client_reference_id: "other" }, { payment_status: "unpaid" }, { payment_link: "plink_other" }, { subscription: "sub_other" }, { customer: "cus_other" }, { livemode: true }, { mode: "payment" }]) {
    assert.equal(validateMembershipCheckout({ ...session, ...override }, subscription, intent, prices, 1000), null);
  }
  for (const override of [{ consumedAt: 500 }, { expiresAt: 1000 }, { planId: "contentpaysbundle" }, { userId: "" }]) {
    assert.equal(validateMembershipCheckout(session, subscription, { ...intent, ...override }, prices, 1000), null);
  }
  assert.equal(validateMembershipCheckout(session, { ...subscription, livemode: true }, intent, prices, 1000), null);
  assert.equal(validateMembershipCheckout(session, subscription, null, prices, 1000), null);
});
