export type AppAvailabilityStatus = "Available" | "In Development" | "Planned";

export type EcosystemCategory =
  | "Create & Sell"
  | "Connect & Grow"
  | "Automate & Scale";

export interface EcosystemApp {
  id: string;
  name: string;
  category: EcosystemCategory;
  journeyStage: "Learn" | "Identify" | "Build" | "Attract" | "Connect" | "Sell" | "Deliver" | "Grow";
  headline: string;
  shortDescription: string;
  availability: AppAvailabilityStatus;
  availabilityNote: string;
  badgeColor: string;
  purpose: string;
  problemSolved: string;
  intendedOutputs: string[];
  ecosystemRelationship: string;
  connectedAppIds: string[];
  externalLink?: string;
}

/**
 * Three permanent top-level navigation categories for the 20 specialized
 * ContentPaysUs applications. All three tabs remain permanently visible
 * on both the public website and inside the authenticated workspace.
 */
export const ECOSYSTEM_CATEGORY_TABS: ReadonlyArray<{
  id: EcosystemCategory;
  label: EcosystemCategory;
  tagline: string;
}> = [
  {
    id: "Create & Sell",
    label: "Create & Sell",
    tagline: "Brand, demand, offers, products, content, funnels, sales, store & delivery"
  },
  {
    id: "Connect & Grow",
    label: "Connect & Grow",
    tagline: "Community, meetings, social proof, teams, affiliates & real growth analytics"
  },
  {
    id: "Automate & Scale",
    label: "Automate & Scale",
    tagline: "Workflows, finances, paid ads planning & experimental AI lab"
  }
] as const;

export const ECOSYSTEM_CATEGORIES = [
  "Create & Sell",
  "Connect & Grow",
  "Automate & Scale"
] as const;

export const AVAILABILITY_FILTERS: ReadonlyArray<"All" | AppAvailabilityStatus> = [
  "All",
  "Available",
  "In Development",
  "Planned"
];

export function getAvailabilityTextClass(availability: AppAvailabilityStatus): string {
  switch (availability) {
    case "Available":
      return "text-emerald-700 dark:text-emerald-400";
    case "In Development":
      return "text-indigo-700 dark:text-indigo-400";
    case "Planned":
      return "text-slate-600 dark:text-zinc-400";
  }
}

export function getAvailabilityDotClass(availability: AppAvailabilityStatus): string {
  switch (availability) {
    case "Available":
      return "bg-emerald-600 dark:bg-emerald-400";
    case "In Development":
      return "bg-indigo-600 dark:bg-indigo-400";
    case "Planned":
      return "bg-slate-400 dark:bg-zinc-500";
  }
}

/**
 * Independent destinations (NOT part of the 20 specialized applications).
 * - ContentPaysUs Academy: Independent free learning destination.
 * - First Sale Engine: Cross-application guided workflow.
 */
export const CONTENT_PAYS_US_ACADEMY = {
  id: "academy",
  name: "ContentPaysUs Academy",
  type: "Independent Learning Destination" as const,
  availability: "Available" as AppAvailabilityStatus,
  headline: "Learn for free. Build with AI. Grow together.",
  description:
    "Free, practical creator education featuring our interactive flagship course 'How to Get Your First Sale' with lessons, assignments, downloadable worksheets, and persistent learning progress.",
  path: "/learn"
};

export const FIRST_SALE_ENGINE_WORKFLOW = {
  id: "first-sale-engine",
  name: "First Sale Engine",
  type: "Cross-Application Guided Workflow" as const,
  availability: "Available" as AppAvailabilityStatus,
  headline: "Follow a clear, practical path to your first verified sale.",
  description:
    "A guided workflow spanning CreatorWorks, DemandWorks, OfferWorks, ProductWorks, ThreadsWorks, SalesWorks, MeetingWorks, and DeliveryWorks—dynamically adapting to what you have already completed.",
  path: "/workspace"
};

/**
 * Exact approved 20 specialized ContentPaysUs applications organized into
 * 3 permanent categories:
 * - Category 1: Create & Sell (10)
 * - Category 2: Connect & Grow (6)
 * - Category 3: Automate & Scale (4)
 *
 * EmailWorks is removed (email capabilities live inside FunnelWorks and SalesWorks).
 * ContentPaysUs Academy is an independent learning destination (not one of the 20 apps).
 * First Sale Engine is a cross-application guided workflow (not one of the 20 apps).
 */
export const CONTENT_PAYS_US_APPS: EcosystemApp[] = [
  // =========================================================================
  // CATEGORY 1 — CREATE & SELL (10 Applications)
  // =========================================================================
  {
    id: "creatorworks",
    name: "CreatorWorks",
    category: "Create & Sell",
    journeyStage: "Identify",
    headline: "Develop your personal brand, positioning, and voice.",
    shortDescription:
      "Clarify your positioning, target audience, brand story, voice guidelines, and messaging foundation—then save approved brand assets directly to your shared creator profile.",
    availability: "Available",
    availabilityNote: "All 11 brand & positioning tools are live and sync directly with your Shared Intelligence profile.",
    badgeColor: "text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30",
    purpose:
      "Establish a clear, reusable creator identity so every application in ContentPaysUs understands who you help and how you sound.",
    problemSolved:
      "Publishing scattered posts or offers without clear positioning, differentiated perspective, or consistent voice rules.",
    intendedOutputs: [
      "Personal Brand Positioning & Bio Suite",
      "Audience & Value Proposition Map",
      "Voice Guidelines, Stories & Messaging Pillars"
    ],
    ecosystemRelationship:
      "Writes approved brand context into your creator profile and transfers positioning directly into DemandWorks, OfferWorks, ProductWorks, ContentWorks, and ThreadsWorks.",
    connectedAppIds: ["demandworks", "offerworks", "productworks", "contentworks", "threadsworks"],
    externalLink: "/workspace"
  },
  {
    id: "demandworks",
    name: "DemandWorks",
    category: "Create & Sell",
    journeyStage: "Identify",
    headline: "Discover and validate what people actually want to buy.",
    shortDescription:
      "Map buyer pain points, audience questions, customer interview scripts, validation surveys, and structured opportunity reports—clearly distinguishing AI hypotheses from verified buyer evidence.",
    availability: "In Development",
    availabilityNote:
      "Structured research, interview, survey, and demand-report tools are live; automated live web scraping requires external search-feed integration.",
    badgeColor: "text-indigo-700 dark:text-indigo-400 border-indigo-300 dark:border-indigo-500/30",
    purpose:
      "Surface real buyer friction and structure real customer conversations before you spend weeks building a product.",
    problemSolved:
      "Guessing what product to build instead of testing real buyer problems and documenting authentic customer language.",
    intendedOutputs: [
      "Problem & Audience Question Inventories (Labeled Hypotheses vs. Evidence)",
      "Customer Interview Guides & Validation Surveys",
      "Buyer Opportunity & Demand Briefs"
    ],
    ecosystemRelationship:
      "Feeds documented buyer language and validated problems directly into OfferWorks, ProductWorks, ContentWorks, and SalesWorks.",
    connectedAppIds: ["offerworks", "productworks", "contentworks", "salesworks"],
    externalLink: "/workspace"
  },
  {
    id: "offerworks",
    name: "OfferWorks",
    category: "Create & Sell",
    journeyStage: "Build",
    headline: "Shape what you know into a clear, buyable offer.",
    shortDescription:
      "Structure your core promise, deliverables, pricing tiers, bonuses, ethical guarantees, lead magnets, tripwires, and upsell paths into editable commercial blueprints.",
    availability: "Available",
    availabilityNote: "All 11 offer-structuring tools are live with persistent saved versions and cross-app transfers.",
    badgeColor: "text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30",
    purpose:
      "Translate your practical expertise into a clear, honest commercial offer that prospective buyers understand immediately.",
    problemSolved:
      "Knowing your topic deeply while struggling to define scope, deliverables, and transparent pricing.",
    intendedOutputs: [
      "Core Offer Blueprint & Value Promise",
      "Pricing Tiers, Bonuses & Risk-Reversal Terms",
      "Lead Magnet, Tripwire & Upsell Architecture"
    ],
    ecosystemRelationship:
      "Sends structured offer definitions directly into ProductWorks, FunnelWorks, SalesWorks, and StoreWorks.",
    connectedAppIds: ["productworks", "funnelworks", "salesworks", "storeworks"],
    externalLink: "/workspace"
  },
  {
    id: "productworks",
    name: "ProductWorks",
    category: "Create & Sell",
    journeyStage: "Build",
    headline: "Create downloadable digital products and auto-prepare promotions.",
    shortDescription:
      "Build downloadable 2-page PDF playbooks, 7-slide PNG/ZIP carousels, ebooks, workbooks, checklists, course outlines, storefront copy, and automatically prepared Threads promotional drafts.",
    availability: "In Development",
    availabilityNote:
      "ProductWorks is in development. Product creation, export, and promotion workflows are not yet available.",
    badgeColor: "text-indigo-700 dark:text-indigo-400 border-indigo-300 dark:border-indigo-500/30",
    purpose:
      "Turn creator ideas, offers, and existing Threads posts into editable, downloadable digital products paired with ready-to-review promotional drafts.",
    problemSolved:
      "Spending weeks formatting PDFs, designing slide carousels, and manually rewriting promotional posts for every product.",
    intendedOutputs: [
      "Downloadable 2-Page PDF Playbooks & 7-Slide PNG/ZIP Carousels",
      "Ebooks, Workbooks, Checklists, Templates & Course Assets",
      "Automatic Product Promotion Drafts Ready for ThreadsWorks"
    ],
    ecosystemRelationship:
      "Turns OfferWorks plans into finished digital products, automatically prepares promotional drafts for ThreadsWorks, and publishes listings to StoreWorks and DeliveryWorks.",
    connectedAppIds: ["threadsworks", "storeworks", "deliveryworks", "funnelworks", "salesworks"],
    externalLink: "/productworks"
  },
  {
    id: "threadsworks",
    name: "ThreadsWorks",
    category: "Create & Sell",
    journeyStage: "Attract",
    headline: "Write, organize, and schedule Meta Threads content.",
    shortDescription:
      "Draft voice-preserved Meta Threads posts and multi-part threads, lock stronger opening hooks, manage your content library, track synced analytics, and schedule publishing via official Meta OAuth.",
    availability: "Available",
    availabilityNote: "Live today on ThreadsWorks.com with 60 free posts/month (150 AI generations) and Pro unlimited plans.",
    badgeColor: "text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30",
    purpose:
      "Provide Meta Threads creators with a dependable AI writing studio, hook workspace, content library, and automated publishing calendar.",
    problemSolved:
      "Staring at a blank post, losing your authentic voice to generic AI output, and falling off a consistent publishing cadence.",
    intendedOutputs: [
      "Voice-Preserved Single Posts & Multi-Part Meta Threads",
      "Strategic Angles & Locked Opening Hooks (<140 chars)",
      "Private Content Library & Automated Meta Threads Calendar"
    ],
    ecosystemRelationship:
      "The original flagship application where ContentPaysUs began—receiving briefs from ContentWorks and automatic promotional drafts from ProductWorks.",
    connectedAppIds: ["contentworks", "productworks", "funnelworks", "growthworks"],
    externalLink: "/create"
  },
  {
    id: "contentworks",
    name: "ContentWorks",
    category: "Create & Sell",
    journeyStage: "Attract",
    headline: "Plan content strategies, pillars, and editorial calendars.",
    shortDescription:
      "Build content pillars, topic clusters, multi-week editorial calendars, launch campaigns, and repurposing blueprints—then send briefs straight into ThreadsWorks.",
    availability: "Available",
    availabilityNote: "All 10 content strategy and editorial planning tools are live with 1-click transfer to ThreadsWorks.",
    badgeColor: "text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30",
    purpose:
      "Connect brand positioning and buyer problems to a repeatable editorial strategy that compounds trust every week.",
    problemSolved:
      "Publishing reactive, disconnected posts without an overarching pillar architecture or launch cadence.",
    intendedOutputs: [
      "Content Pillar & Topic Cluster Systems",
      "Multi-Week Editorial & Launch Campaign Plans",
      "Actionable Content Briefs Sent Directly to ThreadsWorks"
    ],
    ecosystemRelationship:
      "Bridges CreatorWorks and DemandWorks into structured publishing schedules inside ThreadsWorks and FunnelWorks.",
    connectedAppIds: ["threadsworks", "funnelworks", "productworks", "growthworks"],
    externalLink: "/workspace"
  },
  {
    id: "funnelworks",
    name: "FunnelWorks",
    category: "Create & Sell",
    journeyStage: "Sell",
    headline: "Connect content, opt-ins, email sequences, and buying paths.",
    shortDescription:
      "Design conversion funnels, landing pages, lead-magnet opt-ins, link-in-bio hubs, welcome & launch email sequences, newsletters, and capture real leads directly into SalesWorks.",
    availability: "In Development",
    availabilityNote:
      "Funnel, landing page, email sequence, newsletter builders, and Firestore lead capture are live; automated outbound email sending requires a configured ESP/SMTP provider.",
    badgeColor: "text-indigo-700 dark:text-indigo-400 border-indigo-300 dark:border-indigo-500/30",
    purpose:
      "Give interested readers a clear, respectful path from public content to your lead magnet, email sequence, and paid offer.",
    problemSolved:
      "Disconnected social links, missing lead capture, and scattered email copy that leave interested followers unsure what to do next.",
    intendedOutputs: [
      "Funnel Maps, Landing Page Copy & Link-in-Bio Blueprints",
      "Welcome Sequences, Launch Emails & Creator Newsletters",
      "Persistent Lead Capture Connected Directly to SalesWorks CRM"
    ],
    ecosystemRelationship:
      "Houses all conversion-pathway and email-copy workflows (replacing a separate EmailWorks app) and routes captured leads into SalesWorks.",
    connectedAppIds: ["salesworks", "storeworks", "productworks", "threadsworks"],
    externalLink: "/workspace"
  },
  {
    id: "salesworks",
    name: "SalesWorks",
    category: "Create & Sell",
    journeyStage: "Sell",
    headline: "Manage buyer conversations, CRM pipeline, and sales assets.",
    shortDescription:
      "Run a persistent Customer CRM & Sales Pipeline alongside transparent sales pages, DM/outreach scripts, objection guides, follow-up emails, proposals, and client agreements.",
    availability: "Available",
    availabilityNote:
      "Persistent CRM pipeline, contact tracking, and all sales copy/proposal tools are live and linked to MeetingWorks & FinanceWorks.",
    badgeColor: "text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30",
    purpose:
      "Help creators track real buyer conversations from first inquiry to closed sale using clear, honest, non-manipulative messaging.",
    problemSolved:
      "Losing warm leads in scattered DMs or struggling to explain an offer clearly without high-pressure sales scripts.",
    intendedOutputs: [
      "Persistent Customer CRM & Multi-Stage Sales Pipeline",
      "Sales Page Copy, Outreach Scripts & Follow-Up Emails",
      "Proposals, Client Agreements & Objection Guides"
    ],
    ecosystemRelationship:
      "Receives leads from FunnelWorks, connects buyer calls to MeetingWorks, and records verified deal outcomes for FinanceWorks and First Sale Engine.",
    connectedAppIds: ["meetingworks", "financeworks", "deliveryworks", "proofworks"],
    externalLink: "/workspace"
  },
  {
    id: "storeworks",
    name: "StoreWorks",
    category: "Create & Sell",
    journeyStage: "Sell",
    headline: "Organize product listings, pricing, bundles, and your creator storefront.",
    shortDescription:
      "Create and manage persistent storefront product listings, pricing tiers, discount codes, and product bundles directly from your ProductWorks assets.",
    availability: "In Development",
    availabilityNote:
      "Storefront builder, persistent product listings, pricing, discount codes, and bundles are live; live creator marketplace checkout & seller payouts require Stripe Connect setup.",
    badgeColor: "text-indigo-700 dark:text-indigo-400 border-indigo-300 dark:border-indigo-500/30",
    purpose:
      "Give every creator a structured catalog for organizing offers, bundles, and transparent pricing separate from ThreadsWorks SaaS billing.",
    problemSolved:
      "Scattering product links, ad-hoc pricing, and bundle offers across disconnected tools.",
    intendedOutputs: [
      "Persistent Creator Storefront & Product Catalog",
      "Pricing Tiers, Discount Codes & Bundle Configurations",
      "Ready-to-Publish Storefront Copy & Product Listings"
    ],
    ecosystemRelationship:
      "Publishes finished products from ProductWorks and hands completed orders to DeliveryWorks and FinanceWorks.",
    connectedAppIds: ["productworks", "deliveryworks", "financeworks", "affiliateworks"],
    externalLink: "/workspace"
  },
  {
    id: "deliveryworks",
    name: "DeliveryWorks",
    category: "Create & Sell",
    journeyStage: "Deliver",
    headline: "Onboard buyers, deliver digital products, and host structured courses.",
    shortDescription:
      "Manage access-controlled digital product delivery records, structured course modules/lessons/quizzes, customer onboarding sequences, support responses, and feedback collection.",
    availability: "Available",
    availabilityNote:
      "Digital delivery catalog, course/lesson/quiz progress records, and onboarding/feedback generators are live in Firestore.",
    badgeColor: "text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30",
    purpose:
      "Ensure every paying customer receives a dependable, well-organized delivery experience from purchase to practical outcome.",
    problemSolved:
      "Disorganized post-purchase fulfillment and unclear onboarding that frustrate buyers and prevent repeat referrals.",
    intendedOutputs: [
      "Access-Controlled Digital Delivery & Course Hosting Records",
      "Customer Welcome, Onboarding & Support Playbooks",
      "Structured Feedback Prompts Linked to ProofWorks"
    ],
    ecosystemRelationship:
      "Follows StoreWorks and SalesWorks to fulfill purchases and route verified customer feedback directly into ProofWorks.",
    connectedAppIds: ["proofworks", "salesworks", "storeworks", "communityworks"],
    externalLink: "/workspace"
  },

  // =========================================================================
  // CATEGORY 2 — CONNECT & GROW (6 Applications)
  // =========================================================================
  {
    id: "communityworks",
    name: "CommunityWorks",
    category: "Connect & Grow",
    journeyStage: "Connect",
    headline: "Connect with creators in a shared community network.",
    shortDescription:
      "Participate in the internal ContentPaysUs creator network: publish posts, comment, like, repost, follow creators, save threads, join groups, send direct messages, and share products or meetings.",
    availability: "Available",
    availabilityNote:
      "Internal Firestore-backed creator feed, comments, likes, reposts, follows, groups, direct messages, and report/block moderation are live.",
    badgeColor: "text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30",
    purpose:
      "Help creators learn alongside peers, exchange honest feedback, and build real business relationships inside the ecosystem.",
    problemSolved:
      "Building a creator business in isolation without peer accountability, direct dialogue, or collaborative momentum.",
    intendedOutputs: [
      "Creator Feed, Discussion Groups & Discovery Directory",
      "Direct Messages, Follows, Likes, Reposts & Saved Posts",
      "Product/Meeting Sharing & Safety Moderation Controls"
    ],
    ecosystemRelationship:
      "Connects peers across ContentPaysUs and shares products from ProductWorks, sessions from MeetingWorks, and referrals from AffiliateWorks.",
    connectedAppIds: ["meetingworks", "productworks", "affiliateworks", "teamworks"],
    externalLink: "/workspace"
  },
  {
    id: "meetingworks",
    name: "MeetingWorks",
    category: "Connect & Grow",
    journeyStage: "Connect",
    headline: "Schedule discovery calls, run meeting rooms, and capture action items.",
    shortDescription:
      "Create persistent meeting rooms, manage appointments and shareable invitations, run structured agendas and in-room chat, share product links, and generate AI meeting summaries & follow-ups.",
    availability: "In Development",
    availabilityNote:
      "Scheduling, persistent rooms, invitations, agendas, chat, host notes, and AI summaries are live; live audio/video/screen-share requires WebRTC TURN/SFU media infrastructure.",
    badgeColor: "text-indigo-700 dark:text-indigo-400 border-indigo-300 dark:border-indigo-500/30",
    purpose:
      "Turn discovery calls, coaching sessions, and buyer interviews into organized conversations with documented next steps.",
    problemSolved:
      "Unstructured calls and scattered notes that lose buyer questions, objections, and follow-up commitments.",
    intendedOutputs: [
      "Persistent Meeting Rooms, Appointments & Shareable Invites",
      "Structured Call Agendas, In-Room Chat & Product Link Sharing",
      "AI Meeting Summaries, Action Items & Follow-Up Drafts"
    ],
    ecosystemRelationship:
      "Connects directly to SalesWorks CRM contacts and feeds real buyer insights back into DemandWorks and DeliveryWorks.",
    connectedAppIds: ["salesworks", "demandworks", "deliveryworks", "communityworks"],
    externalLink: "/workspace"
  },
  {
    id: "proofworks",
    name: "ProofWorks",
    category: "Connect & Grow",
    journeyStage: "Deliver",
    headline: "Collect, verify, and organize genuine customer proof.",
    shortDescription:
      "Build a structured Evidence & Social Proof library with testimonial requests, case studies, and outcome portfolios—explicitly labeling self-reported, evidence-supported, and transaction-verified results.",
    availability: "Available",
    availabilityNote:
      "Persistent Proof & Evidence Library and all proof-asset generators are live with strict verification-tier labels.",
    badgeColor: "text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30",
    purpose:
      "Document authentic customer outcomes truthfully without fabricating testimonials, inflating numbers, or exaggerating claims.",
    problemSolved:
      "Letting genuine customer wins stay buried in emails and DMs instead of organizing verifiable proof for buyers.",
    intendedOutputs: [
      "Verification-Tagged Proof & Case Study Library",
      "Testimonial & Review Request Workflows",
      "Honest Proof Assets for SalesWorks, FunnelWorks & ThreadsWorks"
    ],
    ecosystemRelationship:
      "Receives customer feedback from DeliveryWorks and supplies verifiable proof assets to SalesWorks, StoreWorks, and ThreadsWorks.",
    connectedAppIds: ["deliveryworks", "salesworks", "storeworks", "threadsworks"],
    externalLink: "/workspace"
  },
  {
    id: "teamworks",
    name: "TeamWorks",
    category: "Connect & Grow",
    journeyStage: "Grow",
    headline: "Coordinate collaborators, roles, tasks, and content approvals.",
    shortDescription:
      "Create shared creator workspaces with role-based member invites, assigned tasks, project milestones, approval checkpoints, and structured partnership proposals.",
    availability: "Available",
    availabilityNote:
      "Shared team workspaces, role assignments, task/milestone boards, approval gates, and collaboration docs are live.",
    badgeColor: "text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30",
    purpose:
      "Help solo creators transition smoothly into peer collaborations and assistant support without losing voice or quality control.",
    problemSolved:
      "Hitting a solo bandwidth wall or losing brand consistency when coordinating with editors, partners, and collaborators.",
    intendedOutputs: [
      "Shared Workspaces with Role-Based Permissions",
      "Task Boards, Milestones & Content Approval Queues",
      "Co-Marketing Proposals & Collaboration Agreements"
    ],
    ecosystemRelationship:
      "Extends Shared Projects across collaborators while keeping owner permissions and brand voice guardrails enforced.",
    connectedAppIds: ["communityworks", "contentworks", "threadsworks", "automationworks"],
    externalLink: "/workspace"
  },
  {
    id: "affiliateworks",
    name: "AffiliateWorks",
    category: "Connect & Grow",
    journeyStage: "Grow",
    headline: "Grow through transparent partner and customer referrals.",
    shortDescription:
      "Configure creator affiliate programs, commission structures, trackable referral links with self-referral prevention, partner swipe copy, and verified commission tracking.",
    availability: "Available",
    availabilityNote:
      "Reuses existing ThreadsWorks Partner Hub infrastructure plus affiliate program builder, swipe copy, and self-referral checks.",
    badgeColor: "text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30",
    purpose:
      "Turn genuine customer advocacy and creator partnerships into a transparent, properly attributed referral channel.",
    problemSolved:
      "Tracking partner recommendations informally in spreadsheets without clear swipe resources or reliable attribution.",
    intendedOutputs: [
      "Affiliate Program Terms & Commission Configurations",
      "Trackable Partner Links (With Self-Referral Prevention)",
      "Partner Swipe Copy, Launch Emails & Attribution Tracking"
    ],
    ecosystemRelationship:
      "Connects directly to StoreWorks offers, existing Partner Hub attribution, and FinanceWorks commission tracking.",
    connectedAppIds: ["storeworks", "financeworks", "communityworks", "salesworks"],
    externalLink: "/workspace"
  },
  {
    id: "growthworks",
    name: "GrowthWorks",
    category: "Connect & Grow",
    journeyStage: "Grow",
    headline: "Measure real performance and plan focused growth experiments.",
    shortDescription:
      "Review real synced ThreadsWorks metrics and workspace outcomes with zero fabricated numbers—paired with growth strategy, experiment planning, and milestone tracking.",
    availability: "Available",
    availabilityNote:
      "Live analytics read strictly from real Firestore records (zero synthetic numbers), plus experiment and goal planning tools.",
    badgeColor: "text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30",
    purpose:
      "Replace vanity-metric guesswork with transparent reporting on what topics, offers, and workflows actually move your business forward.",
    problemSolved:
      "Chasing random tactics without clear visibility into which content and experiments produce real subscriber and buyer momentum.",
    intendedOutputs: [
      "Real-Data Creator Performance Summary (Zero Fabricated Metrics)",
      "Structured Growth Experiment & Hypothesis Plans",
      "Quarterly Goal & Milestone Review Reports"
    ],
    ecosystemRelationship:
      "Reads real performance records from ThreadsWorks, SalesWorks, and FinanceWorks to guide your next growth cycle.",
    connectedAppIds: ["threadsworks", "contentworks", "salesworks", "adsworks"],
    externalLink: "/workspace"
  },

  // =========================================================================
  // CATEGORY 3 — AUTOMATE & SCALE (4 Applications)
  // =========================================================================
  {
    id: "automationworks",
    name: "AutomationWorks",
    category: "Automate & Scale",
    journeyStage: "Grow",
    headline: "Automate safe cross-app workflows with human approval gates.",
    shortDescription:
      "Build persistent trigger-condition-action workflows across ContentPaysUs—including Product Saved → Prepare Promotion and Verified Order → Prepare Delivery—with idempotency, execution logs, retries, and strict approval gates.",
    availability: "Available",
    availabilityNote:
      "Persistent workflow builder, approval gates, idempotent internal execution engine, and run history are live; unauthorized external publishing/payments are strictly blocked.",
    badgeColor: "text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30",
    purpose:
      "Eliminate repetitive manual handoffs between ContentPaysUs applications while keeping humans in control of external actions.",
    problemSolved:
      "Manually copying product details into promo drafts, onboarding checklists, and CRM updates every time you ship.",
    intendedOutputs: [
      "Persistent Cross-App Trigger → Condition → Action Workflows",
      "Natural-Language Workflow Blueprints & Approval Gates",
      "Idempotent Execution History with Bounded Error Recovery"
    ],
    ecosystemRelationship:
      "Orchestrates safe internal handoffs across ProductWorks, ThreadsWorks, SalesWorks, DeliveryWorks, and FinanceWorks.",
    connectedAppIds: ["productworks", "threadsworks", "salesworks", "deliveryworks", "financeworks"],
    externalLink: "/workspace"
  },
  {
    id: "financeworks",
    name: "FinanceWorks",
    category: "Automate & Scale",
    journeyStage: "Grow",
    headline: "Track expenses, generate invoices, and review real creator P&L.",
    shortDescription:
      "Log real business expenses, generate downloadable HTML/CSV/print-ready PDF invoices, track verified commerce revenue & affiliate commissions, and model clearly labeled budgets and forecasts.",
    availability: "Available",
    availabilityNote:
      "Persistent expense ledger, invoice generator with exports, real P&L rollups, and clearly labeled budget forecasts are live.",
    badgeColor: "text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30",
    purpose:
      "Give independent creators transparent financial clarity built strictly on recorded expenses and verified sales—never fabricated numbers.",
    problemSolved:
      "Running a creator business without knowing true net profit, chasing manual invoice templates, or guessing cash runway.",
    intendedOutputs: [
      "Persistent Expense Ledger & Real P&L Summary",
      "Downloadable Client Invoices (HTML / Print-PDF / CSV)",
      "Creator Budget Plans & Explicitly Labeled Forecast Scenarios"
    ],
    ecosystemRelationship:
      "Aggregates verified deal outcomes from SalesWorks/StoreWorks and commission records from AffiliateWorks without touching ThreadsWorks SaaS billing.",
    connectedAppIds: ["salesworks", "storeworks", "affiliateworks", "growthworks"],
    externalLink: "/workspace"
  },
  {
    id: "adsworks",
    name: "AdsWorks",
    category: "Automate & Scale",
    journeyStage: "Grow",
    headline: "Plan paid campaigns built on proven organic content and offers.",
    shortDescription:
      "Turn validated organic messages and offers into ad copy variations, short-form video scripts, campaign strategies, targeting briefs, budget models, and creative comparison matrices.",
    availability: "In Development",
    availabilityNote:
      "Ad copy, video scripts, campaign strategy, targeting, budget planner, and report tools are live; live ad-account launch & spend sync require external Ad Platform OAuth.",
    badgeColor: "text-indigo-700 dark:text-indigo-400 border-indigo-300 dark:border-indigo-500/30",
    purpose:
      "Help creators prepare disciplined, evidence-backed paid campaigns after validating messaging organically.",
    problemSolved:
      "Wasting ad budget on untested hooks, vague targeting, or disconnected landing pages.",
    intendedOutputs: [
      "Paid Ad Copy Variations & Short-Form Video Scripts",
      "Campaign Strategy, Audience Targeting & Budget Models",
      "Creative Comparison & Campaign Review Briefs"
    ],
    ecosystemRelationship:
      "Draws proven organic angles from ThreadsWorks and GrowthWorks alongside validated offers from OfferWorks and FunnelWorks.",
    connectedAppIds: ["threadsworks", "growthworks", "funnelworks", "offerworks"],
    externalLink: "/workspace"
  },
  {
    id: "projectz",
    name: "Project Z",
    category: "Automate & Scale",
    journeyStage: "Grow",
    headline: "Isolated AI experimentation lab for next-generation business scenarios.",
    shortDescription:
      "Test hypothetical business scenarios, opportunity experiments, strategy simulations, and multi-agent workflow prototypes inside a clearly isolated sandbox separated from production data.",
    availability: "Available",
    availabilityNote:
      "Experimental lab tools are live, clearly labeled hypothetical, and strictly isolated from live production customer records.",
    badgeColor: "text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30",
    purpose:
      "Provide a safe, clearly labeled sandbox for exploring bold creator business models and AI workflow concepts.",
    problemSolved:
      "Testing speculative ideas without polluting live brand profiles, customer CRMs, or verified financial records.",
    intendedOutputs: [
      "Hypothetical Business Scenario & Strategy Simulations",
      "New Opportunity Experiments & Risk Stress-Tests",
      "Multi-Agent Creator Workflow Prototypes"
    ],
    ecosystemRelationship:
      "Reads your creator context in read-only mode and isolates all experimental outputs until you explicitly promote an idea into a real project.",
    connectedAppIds: ["demandworks", "offerworks", "automationworks", "growthworks"],
    externalLink: "/workspace"
  }
];

export function getAppsByCategory(category: EcosystemCategory): EcosystemApp[] {
  return CONTENT_PAYS_US_APPS.filter((app) => app.category === category);
}

export function getEcosystemAppById(appId: string): EcosystemApp | undefined {
  return CONTENT_PAYS_US_APPS.find((app) => app.id === appId);
}
