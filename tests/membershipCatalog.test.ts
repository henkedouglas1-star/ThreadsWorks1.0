import { test } from "node:test";
import assert from "node:assert/strict";
import { MEMBERSHIP_PLANS, resolveMembershipAccess, CREATOR_SALE_PLATFORM_FEE_PERCENT, QUALIFYING_SUBSCRIPTION_AFFILIATE_PERCENT } from "../src/data/membershipCatalog";
import { CONTENT_PAYS_US_APPS } from "../src/data/contentPaysUsRegistry";

test("approved membership pricing and commercial targets", () => {
  const prices = Object.fromEntries(MEMBERSHIP_PLANS.map(p => [p.id, p.monthlyCents]));
  assert.equal(prices.free, 0);
  assert.equal(prices["threadsworks-pro"], 700);
  assert.equal(prices.contentpaysclub, 2900);
  assert.equal(prices.contentpaysbundle, 10000);
  assert.equal(CREATOR_SALE_PLATFORM_FEE_PERCENT, 5);
  assert.equal(QUALIFYING_SUBSCRIPTION_AFFILIATE_PERCENT, 50);
});

test("verified plan IDs resolve only intended application access", () => {
  assert.deepEqual(resolveMembershipAccess(["threadsworks-pro"]), ["threadsworks"]);
  assert.deepEqual(resolveMembershipAccess(["contentpaysclub"]), ["club"]);
  assert.deepEqual(resolveMembershipAccess(["free", "unknown", "app-demandworks"]), []);
  assert.deepEqual(resolveMembershipAccess(["contentpaysbundle"]), ["club", ...CONTENT_PAYS_US_APPS.map(a => a.id)].sort());
});

test("new checkout offers stay gated and unspecified app prices stay unset", () => {
  for (const plan of MEMBERSHIP_PLANS) {
    if (plan.id !== "free" && plan.id !== "threadsworks-pro") assert.equal(plan.checkout, "gated");
    if (plan.id.startsWith("app-")) assert.equal(plan.monthlyCents, null);
  }
});
