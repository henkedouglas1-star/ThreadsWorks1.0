# Membership release gates

Approved monthly pricing: ThreadsWorks Pro $7; ContentPaysClub $29; ContentPaysBundle $100 (all 20 apps plus Club); individual app unlimited subscriptions, prices pending. Free membership remains available. Target commission: 50% recurring qualifying membership referrals; separate creator commerce fee: 5%. Neither new commission nor platform fee is activated by this release.

## Existing billing audit (source inspection)

- stripeCheckoutHandler and stripePortalHandler decode an unverified JWT after Firebase verification failure. Remove this fallback and require a verified identity before creating Stripe sessions.
- Checkout accepts any active subscription as a reason to send the customer to the portal; that cannot support independent app subscriptions. Price selection may fall back to an unrelated active recurring price. Require an explicit allowlisted Stripe price per plan, amount, interval and currency; never auto-select or create an arbitrary price.
- Customer resolution by email alone is insufficient for ownership. Use server-controlled verified Firebase UID mappings and Stripe customer metadata.
- Webhook synchronization currently maps active subscriptions to a global Pro flag. New membership subscriptions must instead reconcile scoped entitlements from trusted Stripe price IDs and all relevant subscription states, with idempotent processing and cancellation/refund handling. Preserve legacy ThreadsWorks subscriptions during migration.
- Generation quota service currently has email-prefix exemptions and fails open on some database errors. Do not use this as the new membership authority. Verify Firestore rules prevent clients changing billing data, and test cross-account isolation.

## Release sequence

1. Canonical membership catalog, scoped entitlement tests, truthful customer benefits (initial branch).
2. Harden existing authenticated checkout/portal, trusted return origins, explicit price mapping, customer ownership. Verify legacy subscriber continuity in Stripe test mode.
3. Signed webhook reconciliation and authoritative server entitlements; test multiple simultaneous plans, failed payments, cancellations, replay and out-of-order events. Add server-side enforcement without granting unrelated access.
4. Membership UI with actual available capabilities and clearly gated upcoming offers. Do not charge for incomplete bundle, Club or app deliverables. Confirm individual app prices before creating products.
5. Test checkout, invoices, self-referral rejection, net qualifying commission ledger, reversals and refunds; separate commerce marketplace transactions from SaaS subscriptions.
6. Production release only after verified configuration, security tests and explicit rollout. No live Stripe changes in initial branch.
