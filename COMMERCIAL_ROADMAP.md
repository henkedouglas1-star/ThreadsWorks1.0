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

## Cross-cutting product requirement: Knowledge Engine

Each application must create reusable knowledge, not merely disposable text. Use the existing Creator Context & Intelligence Hub, shared projects, saved assets and intelligence contributions as the foundation; avoid a duplicate knowledge store unless a demonstrated schema gap requires it.

Knowledge lifecycle: discover evidence, understand patterns, synthesize insights and methods, organize reusable knowledge, apply it to content/products/offers, learn from real outcomes. Teach the creator what was learned, why it matters, how to use it, and what remains uncertain. New insights must distinguish source-backed evidence, user-provided observations, AI hypotheses and recommendations; retain source references, timestamps, project association and approval status where applicable. Never represent search snippets as proof of purchase intent or generated ideas as verified facts.

Phase 1 next milestone: synthesize selected public sources into concise evidence-linked findings, proposed opportunities, unresolved questions and practical validation actions. Let users review and save approved findings to existing project assets/intelligence; verify ownership, persistence and downstream retrieval before advertising automatic cross-app learning. Do not silently overwrite approved creator facts. Review costs and provider access before production enablement.

Customer value: the creator gains an accumulating, reusable body of business knowledge and learns while building, rather than starting over with each AI request. Knowledge can become educational content, original frameworks, digital products and improved decisions; no guarantee of originality, factual certainty or revenue.
