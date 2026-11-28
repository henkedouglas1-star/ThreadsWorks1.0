export type AppAvailabilityStatus = "Available" | "In Development" | "Planned";

export type EcosystemCategory =
  | "Education"
  | "Foundation"
  | "Attention"
  | "Monetization"
  | "Customer Success"
  | "Expansion";

export interface EcosystemApp {
  id: string;
  name: string;
  category: EcosystemCategory;
  journeyStage: "Learn" | "Identify" | "Build" | "Attract" | "Connect" | "Sell" | "Deliver" | "Grow";
  headline: string;
  shortDescription: string;
  availability: AppAvailabilityStatus;
  badgeColor: string;
  purpose: string;
  problemSolved: string;
  intendedOutputs: string[];
  ecosystemRelationship: string;
  externalLink?: string;
}

export const ECOSYSTEM_CATEGORIES = [
  "All",
  "Education",
  "Foundation",
  "Attention",
  "Monetization",
  "Customer Success",
  "Expansion"
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

export const CONTENT_PAYS_US_APPS: EcosystemApp[] = [
  // Education (1)
  {
    id: "academy",
    name: "ContentPaysUs Academy",
    category: "Education",
    journeyStage: "Learn",
    headline: "Free creator business education and practical courses.",
    shortDescription:
      "Planned free learning destination built around practical business skills, our flagship course 'How to Get Your First Sale', and future community-shared courses.",
    availability: "Planned",
    badgeColor: "text-slate-700 dark:text-zinc-300 border-slate-300 dark:border-zinc-700",
    purpose:
      "Give creators free, practical training so they can build real business skills before investing in software or ad spend.",
    problemSolved:
      "Expensive, theory-heavy courses and fragmented advice that leave new creators unsure what concrete step to take next.",
    intendedOutputs: [
      "Flagship Free Course: How to Get Your First Sale (Planned)",
      "Step-by-Step Creator Business Playbooks",
      "Future Community-Created Free Courses"
    ],
    ecosystemRelationship:
      "Serves as the free educational entry point to ContentPaysUs—helping creators learn for free, build with AI, and grow together.",
    externalLink: "/learn"
  },

  // Foundation (2)
  {
    id: "creatorworks",
    name: "CreatorWorks",
    category: "Foundation",
    journeyStage: "Identify",
    headline: "Develop your personal brand, positioning, and direction.",
    shortDescription:
      "Clarify your core expertise, audience focus, and consistent brand voice before publishing content or launching offers.",
    availability: "Planned",
    badgeColor: "text-slate-700 dark:text-zinc-300 border-slate-300 dark:border-zinc-700",
    purpose:
      "Help creators define their unique perspective, target audience, and brand identity with practical clarity.",
    problemSolved:
      "Publishing scattered posts without a clear positioning statement or recognizable creator point of view.",
    intendedOutputs: [
      "Creator Brand Positioning Blueprint",
      "Target Audience & Core Value Map",
      "Voice & Messaging Guidelines"
    ],
    ecosystemRelationship:
      "Establishes the creator identity context that feeds into ThreadsWorks, OfferWorks, and every connected application via Shared Intelligence."
  },
  {
    id: "demandworks",
    name: "DemandWorks",
    category: "Foundation",
    journeyStage: "Identify",
    headline: "Discover what people actually want to buy.",
    shortDescription:
      "Find and validate real buyer problems your audience is actively trying to solve before spending weeks building.",
    availability: "Planned",
    badgeColor: "text-slate-700 dark:text-zinc-300 border-slate-300 dark:border-zinc-700",
    purpose:
      "Surface real audience questions, recurring friction, and unmet needs so you build products people are ready to pay for.",
    problemSolved:
      "Guessing what product or content will resonate instead of validating genuine market demand first.",
    intendedOutputs: [
      "Buyer Problem Validation Report",
      "Audience Question & Friction Inventory",
      "Demand-Backed Offer Angle Briefs"
    ],
    ecosystemRelationship:
      "Feeds validated buyer problems directly into ContentWorks, OfferWorks, and ProductWorks so every project starts from real demand."
  },

  // Attention (4)
  {
    id: "threadsworks",
    name: "ThreadsWorks",
    category: "Attention",
    journeyStage: "Attract",
    headline: "Write, organize, and schedule Meta Threads content.",
    shortDescription:
      "Draft voice-preserved Meta Threads posts and multi-part threads, strengthen opening hooks, manage your content library, and schedule publishing via official Meta OAuth.",
    availability: "Available",
    badgeColor: "text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30",
    purpose:
      "Give Meta Threads creators a reliable AI writing workspace, hook studio, content library, and automated publishing calendar.",
    problemSolved:
      "Staring at a blank post, losing your natural voice to generic AI copy, and struggling to publish consistently every week.",
    intendedOutputs: [
      "AI-Generated Meta Threads Single Posts & Multi-Part Threads",
      "Strategic Angles & Locked Opening Hooks (<140 chars)",
      "Private Content Library & Automated Meta Threads Calendar"
    ],
    ecosystemRelationship:
      "The original, live application where ContentPaysUs started—actively serving creators today on ThreadsWorks.com.",
    externalLink: "/create"
  },
  {
    id: "contentworks",
    name: "ContentWorks",
    category: "Attention",
    journeyStage: "Attract",
    headline: "Plan content strategies and editorial roadmaps.",
    shortDescription:
      "Map content pillars, recurring themes, and multi-week editorial calendars tied directly to your brand and commercial goals.",
    availability: "Planned",
    badgeColor: "text-slate-700 dark:text-zinc-300 border-slate-300 dark:border-zinc-700",
    purpose:
      "Turn positioning and buyer research into a repeatable editorial plan that builds audience trust week after week.",
    problemSolved:
      "Disorganized content ideas and inconsistent publishing routines that stall audience growth.",
    intendedOutputs: [
      "Content Pillar & Theme Architecture",
      "Recurring Editorial Calendar Plan",
      "Topic-to-Offer Alignment Map"
    ],
    ecosystemRelationship:
      "Connects DemandWorks insights into structured content queues for ThreadsWorks and EmailWorks."
  },
  {
    id: "communityworks",
    name: "CommunityWorks",
    category: "Attention",
    journeyStage: "Connect",
    headline: "Connect with creators and build real audience relationships.",
    shortDescription:
      "Turn passive readers into engaged relationships through structured conversations, peer creator connections, and thoughtful follow-up.",
    availability: "Planned",
    badgeColor: "text-slate-700 dark:text-zinc-300 border-slate-300 dark:border-zinc-700",
    purpose:
      "Help creators build authentic two-way dialogue with their audience and connect with fellow builders across the ecosystem.",
    problemSolved:
      "Treating social platforms like a one-way broadcast channel and building in isolation without peer support.",
    intendedOutputs: [
      "Audience Conversation & Reply Workflows",
      "Creator Peer Network & Collaboration Spaces",
      "Community Engagement Checklists"
    ],
    ecosystemRelationship:
      "Turns the attention earned in ThreadsWorks into lasting trust, peer accountability, and warm buyer relationships."
  },
  {
    id: "emailworks",
    name: "EmailWorks",
    category: "Attention",
    journeyStage: "Connect",
    headline: "Build direct email relationships you own.",
    shortDescription:
      "Write welcome sequences, weekly creator newsletters, and buyer follow-up emails grounded in your shared brand voice and offers.",
    availability: "Planned",
    badgeColor: "text-slate-700 dark:text-zinc-300 border-slate-300 dark:border-zinc-700",
    purpose:
      "Give creators a direct, algorithm-independent channel to nurture subscribers and introduce offers clearly.",
    problemSolved:
      "Relying exclusively on social media reach without an owned list to stay connected with interested readers.",
    intendedOutputs: [
      "Subscriber Welcome Sequence",
      "Weekly Creator Newsletter Drafts",
      "Offer Launch & Follow-Up Emails"
    ],
    ecosystemRelationship:
      "Pairs with ThreadsWorks and FunnelWorks to carry social readers into direct email conversations."
  },

  // Monetization (5)
  {
    id: "offerworks",
    name: "OfferWorks",
    category: "Monetization",
    journeyStage: "Build",
    headline: "Shape what you know into a clear, buyable offer.",
    shortDescription:
      "Define the promise, scope, deliverables, and transparent pricing of your digital product, workshop, or advisory service.",
    availability: "Planned",
    badgeColor: "text-slate-700 dark:text-zinc-300 border-slate-300 dark:border-zinc-700",
    purpose:
      "Translate your practical knowledge into a concrete commercial offer that prospective buyers understand immediately.",
    problemSolved:
      "Knowing your topic deeply but struggling to package it into a focused offer people feel confident purchasing.",
    intendedOutputs: [
      "Structured Offer Promise & Scope Brief",
      "Deliverables & Buyer Outcome Breakdown",
      "Transparent Pricing & Packaging Options"
    ],
    ecosystemRelationship:
      "Shapes validated ideas from DemandWorks into clear offers ready for ProductWorks and First Sale Engine."
  },
  {
    id: "productworks",
    name: "ProductWorks",
    category: "Monetization",
    journeyStage: "Build",
    headline: "Create downloadable digital product assets from your ideas.",
    shortDescription:
      "Generate downloadable 2-page PDF playbooks, 7-slide visual carousels (PNG & ZIP), companion posts, and storefront copy from a single idea or existing post.",
    availability: "In Development",
    badgeColor: "text-indigo-700 dark:text-indigo-400 border-indigo-300 dark:border-indigo-500/30",
    purpose:
      "Turn creator ideas and Threads posts into polished, downloadable digital product packages in minutes.",
    problemSolved:
      "Spending weeks formatting PDFs, designing slide carousels, and drafting storefront copy before testing a digital product.",
    intendedOutputs: [
      "Downloadable 2-Page PDF Playbooks & Guides",
      "7-Slide Social Carousels (Individual PNGs & ZIP)",
      "Companion Promotional Posts & Storefront Copy"
    ],
    ecosystemRelationship:
      "Currently in active development inside the ThreadsWorks workspace—bridging content creation directly into digital product assets.",
    externalLink: "/productworks"
  },
  {
    id: "first-sale-engine",
    name: "First Sale Engine",
    category: "Monetization",
    journeyStage: "Sell",
    headline: "Follow a clear, practical path to your first verified sale.",
    shortDescription:
      "Step-by-step validation, direct buyer outreach guidance, and milestone tracking built specifically to help creators cross zero-to-one.",
    availability: "Planned",
    badgeColor: "text-slate-700 dark:text-zinc-300 border-slate-300 dark:border-zinc-700",
    purpose:
      "Remove guesswork from getting your very first paying customer by focusing on simple offers, direct conversations, and verified outcomes.",
    problemSolved:
      "Overbuilding complex funnels and websites while delaying the real conversations that lead to a first sale.",
    intendedOutputs: [
      "Zero-to-One Offer Validation Checklist",
      "Direct Buyer Outreach & Conversation Guide",
      "First Verified Sale Milestone Tracker"
    ],
    ecosystemRelationship:
      "Directly supports the ContentPaysUs mission—helping 1,000 creators achieve their first verified sale alongside ContentPaysUs Academy."
  },
  {
    id: "funnelworks",
    name: "FunnelWorks",
    category: "Monetization",
    journeyStage: "Sell",
    headline: "Connect content, offers, and buying steps cleanly.",
    shortDescription:
      "Map straightforward paths from discovery posts and free resources to your paid offer without confusing detours.",
    availability: "Planned",
    badgeColor: "text-slate-700 dark:text-zinc-300 border-slate-300 dark:border-zinc-700",
    purpose:
      "Design clear, respectful customer journeys so interested readers always know the logical next step.",
    problemSolved:
      "Disconnected posts and product links that leave interested followers unsure how to learn more or buy.",
    intendedOutputs: [
      "Content-to-Offer Pathway Blueprint",
      "Lead Resource & Next-Step Mapping",
      "Conversion Bottleneck Checklist"
    ],
    ecosystemRelationship:
      "Bridges Attention tools (ThreadsWorks, EmailWorks) with Monetization tools (OfferWorks, ProductWorks, SalesWorks)."
  },
  {
    id: "salesworks",
    name: "SalesWorks",
    category: "Monetization",
    journeyStage: "Sell",
    headline: "Help buyers understand your offer clearly and decide with confidence.",
    shortDescription:
      "Draft transparent sales pages, offer breakdowns, and honest objection-handling copy without high-pressure tactics.",
    availability: "Planned",
    badgeColor: "text-slate-700 dark:text-zinc-300 border-slate-300 dark:border-zinc-700",
    purpose:
      "Communicate what your offer delivers, who it helps, and what outcomes to expect using clear, evidence-based messaging.",
    problemSolved:
      "Struggling to explain the real value of your offer or defaulting to manipulative marketing scripts.",
    intendedOutputs: [
      "Clear Offer & Sales Page Copy",
      "Transparent FAQ & Objection Guide",
      "Launch Messaging Framework"
    ],
    ecosystemRelationship:
      "Works with OfferWorks and ProofWorks so every sales page reflects your authentic voice and verified customer feedback."
  },

  // Customer Success (3)
  {
    id: "meetingworks",
    name: "MeetingWorks",
    category: "Customer Success",
    journeyStage: "Connect",
    headline: "Run structured discovery calls, coaching sessions, and buyer conversations.",
    shortDescription:
      "Prepare conversation agendas, capture buyer questions, and turn live creator meetings into clear action items and offer insights.",
    availability: "Planned",
    badgeColor: "text-slate-700 dark:text-zinc-300 border-slate-300 dark:border-zinc-700",
    purpose:
      "Make live discovery calls, customer interviews, and client sessions organized, productive, and connected to your projects.",
    problemSolved:
      "Unstructured calls and scattered meeting notes that lose valuable buyer insights and follow-up commitments.",
    intendedOutputs: [
      "Structured Discovery & Coaching Call Agendas",
      "Buyer Insight & Objection Summaries",
      "Post-Meeting Follow-Up Action Plans"
    ],
    ecosystemRelationship:
      "Feeds real language and questions from live conversations back into DemandWorks, ThreadsWorks, and DeliveryWorks."
  },
  {
    id: "deliveryworks",
    name: "DeliveryWorks",
    category: "Customer Success",
    journeyStage: "Deliver",
    headline: "Onboard buyers smoothly and deliver real customer value.",
    shortDescription:
      "Organize welcome checklists, product delivery steps, and client milestones so buyers get results from what they purchase.",
    availability: "Planned",
    badgeColor: "text-slate-700 dark:text-zinc-300 border-slate-300 dark:border-zinc-700",
    purpose:
      "Ensure every customer receives a clear, dependable experience from purchase to first practical win.",
    problemSolved:
      "Disorganized fulfillment and unclear onboarding that frustrate buyers and reduce repeat business.",
    intendedOutputs: [
      "Customer Welcome & Quick-Start Sequence",
      "Offer Fulfillment & Delivery Checklist",
      "Customer Outcome Check-In Prompts"
    ],
    ecosystemRelationship:
      "Follows SalesWorks and ProductWorks to turn completed sales into satisfied customers and long-term trust."
  },
  {
    id: "proofworks",
    name: "ProofWorks",
    category: "Customer Success",
    journeyStage: "Deliver",
    headline: "Organize genuine customer feedback, examples, and outcomes.",
    shortDescription:
      "Collect, verify, and structure authentic customer stories, case studies, and real work examples in one organized library.",
    availability: "Planned",
    badgeColor: "text-slate-700 dark:text-zinc-300 border-slate-300 dark:border-zinc-700",
    purpose:
      "Help creators document real, verifiable customer outcomes without exaggerating claims.",
    problemSolved:
      "Letting valuable customer feedback stay buried in emails and direct messages instead of organizing it cleanly.",
    intendedOutputs: [
      "Customer Feedback Collection Prompts",
      "Structured Case Study Outlines",
      "Verified Social Proof Library"
    ],
    ecosystemRelationship:
      "Connects real outcomes from DeliveryWorks back into SalesWorks and ThreadsWorks content."
  },

  // Expansion (5)
  {
    id: "growthworks",
    name: "GrowthWorks",
    category: "Expansion",
    journeyStage: "Grow",
    headline: "Measure what actually drives audience and business growth.",
    shortDescription:
      "Review cross-app performance signals, identify topics and offers that convert, and focus your effort on what works.",
    availability: "Planned",
    badgeColor: "text-slate-700 dark:text-zinc-300 border-slate-300 dark:border-zinc-700",
    purpose:
      "Replace vanity-metric guesswork with clear visibility into which content and offers create real business progress.",
    problemSolved:
      "Tracking isolated likes and impressions without knowing which actions lead to subscribers and paying customers.",
    intendedOutputs: [
      "Unified Creator Outcome Dashboard",
      "Content-to-Conversion Review Brief",
      "Quarterly Focus & Experiment Plan"
    ],
    ecosystemRelationship:
      "Aggregates verified signals across ContentPaysUs so your next cycle is sharper than the last."
  },
  {
    id: "adsworks",
    name: "AdsWorks",
    category: "Expansion",
    journeyStage: "Grow",
    headline: "Amplify proven content and offers with paid distribution.",
    shortDescription:
      "Turn validated organic posts and tested offers into structured paid campaign briefs and creative angles.",
    availability: "Planned",
    badgeColor: "text-slate-700 dark:text-zinc-300 border-slate-300 dark:border-zinc-700",
    purpose:
      "Help creators scale what already resonates organically instead of spending ad budget on untested messaging.",
    problemSolved:
      "Burning money on paid ads before validating which hooks, angles, and offers actually convert.",
    intendedOutputs: [
      "Paid Creative Briefs Built from Proven Posts",
      "Campaign Angle & Audience Test Matrix",
      "Budget & Conversion Review Checklist"
    ],
    ecosystemRelationship:
      "Takes top-performing organic messages from ThreadsWorks and validated offers from ProductWorks into paid reach."
  },
  {
    id: "teamworks",
    name: "TeamWorks",
    category: "Expansion",
    journeyStage: "Grow",
    headline: "Collaborate with peers, collaborators, and growing support teams.",
    shortDescription:
      "Coordinate shared projects, creator collaborations, and co-marketing recommendations as your business expands.",
    availability: "Planned",
    badgeColor: "text-slate-700 dark:text-zinc-300 border-slate-300 dark:border-zinc-700",
    purpose:
      "Enable creators to partner with peers and delegate recurring workflows without losing brand voice consistency.",
    problemSolved:
      "Hitting a solo bandwidth ceiling or losing consistency when collaborating with partners and assistants.",
    intendedOutputs: [
      "Creator Collaboration & Co-Marketing Plans",
      "Shared Project Handoff Workflows",
      "Brand Voice Guardrails for Collaborators"
    ],
    ecosystemRelationship:
      "Extends Shared Projects across peers and support teams while keeping your core creator identity intact."
  },
  {
    id: "affiliateworks",
    name: "AffiliateWorks",
    category: "Expansion",
    journeyStage: "Grow",
    headline: "Grow through transparent partner and customer recommendations.",
    shortDescription:
      "Equip satisfied customers and creator partners with clear referral resources, swipe copy, and transparent commission tracking.",
    availability: "Planned",
    badgeColor: "text-slate-700 dark:text-zinc-300 border-slate-300 dark:border-zinc-700",
    purpose:
      "Turn genuine customer advocacy and creator partnerships into a structured referral channel.",
    problemSolved:
      "Managing word-of-mouth referrals manually without clear partner assets or reliable attribution.",
    intendedOutputs: [
      "Partner Program Terms & Structure",
      "Partner Resource Kit & Honest Swipe Copy",
      "Referral Attribution & Payout Workflow"
    ],
    ecosystemRelationship:
      "Extends validated offers from ProductWorks and SalesWorks into partner-driven distribution."
  },
  {
    id: "projectz",
    name: "Project Z",
    category: "Expansion",
    journeyStage: "Grow",
    headline: "Next-generation AI workflows for creator leverage and momentum.",
    shortDescription:
      "Planned forward-looking research track exploring autonomous creator workflows, cross-channel intelligence, and deeper leverage.",
    availability: "Planned",
    badgeColor: "text-slate-700 dark:text-zinc-300 border-slate-300 dark:border-zinc-700",
    purpose:
      "Explore next-generation AI capabilities that save creators time while preserving authentic human judgment.",
    problemSolved:
      "Keeping independent creators ahead as AI workflows and digital distribution evolve.",
    intendedOutputs: [
      "Next-Generation Creator Workflow Concepts",
      "Cross-App Intelligence Prototypes",
      "Creator Autonomy Research Notes"
    ],
    ecosystemRelationship:
      "Represents the long-term innovation horizon for the ContentPaysUs ecosystem once core applications mature."
  }
];
