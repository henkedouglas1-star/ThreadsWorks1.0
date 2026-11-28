# ContentPaysUs feature verification

Release gate: no feature is marked working without evidence against the same revision and applicable live environment. Freeze new feature development until core workflows pass. This is an initial inventory, not proof that every listed feature is implemented.

Status: Pending = unverified; Partial = implementation or test coverage observed; Blocked = known missing prerequisite. Mark [x] only after UI, backend, persistence, error handling, authorization and applicable regression/live tests pass. Record revision, environment, test command/result and date. Never substitute source inspection for execution.

## Evidence and blockers — 2026-11-28

- Main branch source inspection: `tests/authRegression.test.ts` contains 22 numbered regression cases; not executed in this audit.
- `src/components/ContentEngineView.tsx` and `src/components/CalendarView.tsx` exist; runtime not verified.
- `src/features/funnelworks/playbookExport.ts` uses `productworks-playbook.pdf`; download not executed.
- `src/utils/analytics.ts` enables automatic page views; consent and deduplication require review.
- Main `firebase.json` lacks named Firestore rules configuration; `tests/sharedCreatorProjects.test.ts` returned 404. AI Studio repair not yet reflected in inspected main.
- AI Studio reported 195/195 offline tests, 23/23 auth tests, 5/5 project tests, TypeScript and build passing; not independently reproduced. Live rules deployment and authenticated verification pending.
- PR #2 release work remains separate; no merge or deployment authorized by this audit.

## Authentication

- [ ] Google sign-in
- [ ] Email sign-in
- [ ] Registration
- [ ] Password reset
- [ ] Sign-out
- [ ] Session restoration
- [ ] Preview authentication
- [ ] Account isolation
- [ ] Profile management

## Ecosystem

- [ ] Homepage
- [ ] Applications directory
- [ ] App details
- [ ] Learning center
- [ ] About
- [ ] Unified workspace
- [ ] Navigation
- [ ] Mobile navigation
- [ ] Themes

## Shared Projects

- [ ] List
- [ ] Create
- [ ] Multi-app association
- [ ] Edit
- [ ] Archive
- [ ] Restore
- [ ] Persistence
- [ ] Ownership isolation

## Creator intelligence

- [ ] Identity
- [ ] Business profile
- [ ] Creator context
- [ ] Shared intelligence
- [ ] Personalization
- [ ] Historical content
- [ ] Performance learning

## Content Engine

- [ ] Generation
- [ ] Single post
- [ ] Multipart threads
- [ ] Eight-post batch
- [ ] AI Decide
- [ ] Hooks
- [ ] Voice input
- [ ] Image generation
- [ ] Editing
- [ ] Persistence

## Publishing

- [ ] Threads connection
- [ ] Direct publish
- [ ] Scheduled publish
- [ ] Cancel
- [ ] Reschedule
- [ ] Calendar
- [ ] Deduplication
- [ ] Retry
- [ ] Timezone

## Library

- [ ] Save
- [ ] Retrieve
- [ ] Edit
- [ ] Delete
- [ ] Organize
- [ ] Schedule handoff

## ProductWorks

- [ ] Generation
- [ ] Complete funnel
- [ ] Carousel
- [ ] PDF
- [ ] Social posts
- [ ] Storefront kit
- [ ] CTA
- [ ] Downloads
- [ ] Saved projects
- [ ] Branding

## Analytics

- [ ] Threads metrics
- [ ] Post metrics
- [ ] Dashboard
- [ ] GA4 consent
- [ ] Page-view deduplication
- [ ] Safe URLs/referrers
- [ ] Verified purchase deduplication

## Membership

- [ ] Checkout
- [ ] Payment verification
- [ ] Free limits
- [ ] Pro unlimited
- [ ] Subscription management
- [ ] Entitlements
- [ ] Image limits

## Partners

- [ ] Referral links
- [ ] Attribution
- [ ] Dashboard
- [ ] Commissions

## Infrastructure

- [ ] Firestore rules
- [ ] Named database
- [ ] API authorization
- [ ] SEO
- [ ] Sitemap
- [ ] Build
- [ ] TypeScript
- [ ] Regression tests

## Release acceptance

- [ ] Synchronize and pin audited revision.
- [ ] Review all routes, controls, APIs and test inventory; expand checklist for omissions.
- [ ] Run `npm run validate` with required environment; record actual results.
- [ ] Verify live workflows using authorized test accounts and Stripe test mode.
- [ ] Verify named database rules and cross-account denial.
- [ ] Review diffs and CI; obtain owner approval before merge or deployment.
