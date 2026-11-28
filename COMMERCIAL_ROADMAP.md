# ContentPaysUs commercial roadmap

Goal: one complete, secure creator journey from idea to verified customer purchase. Each capability must communicate its concrete customer benefit, actual availability, and next action. Do not charge for unconfigured functionality or claim guaranteed sales.

| Phase | Deliverable | Customer value | Release gate |
|---|---|---|---|
| 0 | Reliability and security | Trust the workspace with business data | Existing verification checklist; authenticated ownership, billing integrity and live tests |
| 1 | DemandWorks public research | Reduce manual research and avoid building solely on guesses | Configured search provider, real-source results, budget controls, evidence review and project handoff |
| 2 | ProductWorks finished deliverables | Reduce product design and production work | Complete sellable documents, editing and tested downloads |
| 3 | StoreWorks commerce and DeliveryWorks | Accept real payments and fulfill purchases | Seller onboarding, verified payment webhooks, approved platform fee, payouts, refunds, secure fulfillment |
| 4 | Customer acquisition | Connect attention to actual buying activity | Lead capture, approved campaigns, email sending, attribution |
| 5 | Referrals and community | Grow through creator collaboration | Consent, attribution, verified commission ledger, moderation |
| 6 | Live communication | Run customer calls and product demos | Secure rooms, media provider, permissions |
| 7 | Authorized AI orchestration | Reduce repeated work across apps | Approval gates, idempotency, cost limits, auditable execution |

## Phase 1 initial implementation

On-demand public web search via Brave Search API. Server-side `BRAVE_SEARCH_API_KEY` required. No automatic provider purchase or setup, no continuous monitoring, no fabricated live evidence. Results are search snippets and source links, not verified willingness to pay. The feature does not yet synthesize sources or persist them to a project. Free successful searches consume one existing generation allowance; review provider billing and durable per-account/global limits before enabling in production. Existing Pro policy is unchanged. CI and live integration verification required before release.
