export interface EcosystemApp {
  id: string;
  name: string;
  category: "Foundation" | "Attention" | "Monetization" | "Customer Success" | "Expansion";
  headline: string;
  shortDescription: string;
  availability: "Available" | "In Development" | "Planned" | "Working Concept";
  badgeColor: string;
  purpose: string;
  problemSolved: string;
  intendedOutputs: string[];
  ecosystemRelationship: string;
  externalLink?: string;
}

export const ECOSYSTEM_CATEGORIES = [
  "All",
  "Foundation",
  "Attention",
  "Monetization",
  "Customer Success",
  "Expansion"
] as const;

export const CONTENT_PAYS_US_APPS: EcosystemApp[] = [
  // Foundation
  {
    id: "creatorworks",
    name: "CreatorWorks",
    category: "Foundation",
    headline: "Develop a creator’s brand and direction.",
    shortDescription: "Establish your core positioning, audience focus, and brand voice before producing content.",
    availability: "Planned",
    badgeColor: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    purpose: "Help creators define their unique expertise, target audience pillars, and brand identity with absolute clarity.",
    problemSolved: "Creators often jump straight into content creation without a defined niche or messaging direction, leading to inconsistent brand perception.",
    intendedOutputs: [
      "Creator Brand Positioning Blueprint",
      "Audience Persona & Core Pain Point Map",
      "Tone of Voice & Messaging Guidelines"
    ],
    ecosystemRelationship: "Serves as the foundational starting point for all subsequent ContentPaysUs applications, feeding identity context into the shared intelligence layer."
  },
  {
    id: "demandworks",
    name: "DemandWorks",
    category: "Foundation",
    headline: "Find and validate buyer problems.",
    shortDescription: "Discover what your target audience is actively struggling with and confirm real market demand.",
    availability: "Planned",
    badgeColor: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    purpose: "Analyze community discussions, search signals, and audience feedback to pinpoint high-value problems worth solving.",
    problemSolved: "Building products or content around guessed assumptions rather than verified buyer pain points.",
    intendedOutputs: [
      "Buyer Problem Validation Report",
      "Market Gap Analysis Matrix",
      "Audience Question & Frustration Inventory"
    ],
    ecosystemRelationship: "Feeds validated market problems directly into OfferWorks and ContentWorks to ensure everything you create targets genuine demand."
  },

  // Attention
  {
    id: "contentworks",
    name: "ContentWorks",
    category: "Attention",
    headline: "Build content strategies and roadmaps.",
    shortDescription: "Plan multi-channel content pillars, editorial calendars, and recurring publication frameworks.",
    availability: "Planned",
    badgeColor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    purpose: "Design structured content systems that turn brand positioning into consistent, engaging audience touchpoints.",
    problemSolved: "Inconsistent publishing schedules and disorganized content ideas that fail to compound over time.",
    intendedOutputs: [
      "Multi-Channel Content Strategy Blueprint",
      "Recurring Editorial Calendar Framework",
      "Content Pillar & Theme Mapping"
    ],
    ecosystemRelationship: "Acts as the strategic blueprint engine that feeds specific topics into publishing tools like ThreadsWorks."
  },
  {
    id: "threadsworks",
    name: "ThreadsWorks",
    category: "Attention",
    headline: "Create, organize and publish Threads content.",
    shortDescription: "Draft AI-powered Meta Threads posts, develop stronger hooks, and schedule automated publishing.",
    availability: "Available",
    badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    purpose: "Provide professional Meta Threads writing, hook generation, and scheduling tools for modern creators.",
    problemSolved: "Staring at a blank page, crafting weak opening lines, and manually publishing content every day.",
    intendedOutputs: [
      "AI-Generated Meta Threads Posts & Multi-Part Threads",
      "Optimized Opening Hooks (<140 chars)",
      "Visual Content Calendar & Automated Meta Publisher"
    ],
    ecosystemRelationship: "The flagship operational publishing application within the ContentPaysUs Attention tier.",
    externalLink: "/create"
  },
  {
    id: "communityworks",
    name: "CommunityWorks",
    category: "Attention",
    headline: "Build audience relationships through conversation.",
    shortDescription: "Manage replies, engage meaningfully with followers, and turn conversations into community loyalty.",
    availability: "Planned",
    badgeColor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    purpose: "Help creators cultivate genuine two-way dialogues and transform passive viewers into active community members.",
    problemSolved: "Treating social media as a broadcast megaphone instead of a relationship-building conversation.",
    intendedOutputs: [
      "Audience Engagement & Relationship Playbook",
      "Comment Strategy & Follow-up Workflows",
      "Community Milestone Tracker"
    ],
    ecosystemRelationship: "Amplifies the reach generated by ContentWorks and ThreadsWorks by building deep relational equity."
  },

  // Monetization
  {
    id: "offerworks",
    name: "OfferWorks",
    category: "Monetization",
    headline: "Shape knowledge into a clear offer.",
    shortDescription: "Design, package, and price high-value digital offers, workshops, and coaching programs.",
    availability: "Planned",
    badgeColor: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    purpose: "Translate intangible expertise into structured, compelling commercial offers that buyers understand instantly.",
    problemSolved: "Confusion around how to package knowledge into a clear productized service or digital offer.",
    intendedOutputs: [
      "Structured Offer Outline & Scope Document",
      "Value Proposition & Transformation Promise",
      "Pricing Strategy & Tier Breakdown"
    ],
    ecosystemRelationship: "Provides the core commercial offer structure that ProductWorks and SalesWorks bring to life."
  },
  {
    id: "productworks",
    name: "ProductWorks",
    category: "Monetization",
    headline: "Create downloadable digital products behind offers.",
    shortDescription: "Generate professional PDF playbooks, social carousels, and sales copy from a single idea.",
    availability: "In Development",
    badgeColor: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    purpose: "Automate the creation of high-quality digital assets and downloadable resources that fulfill offers.",
    problemSolved: "Spending weeks formatting PDFs, designing graphics, and writing promotional copy from scratch.",
    intendedOutputs: [
      "2-Page PDF Playbooks & Guides",
      "7-Slide Social Media Carousels (PNG & ZIP)",
      "Storefront Titles, Outcome Bullets & Sales Copy"
    ],
    ecosystemRelationship: "Currently in development within ThreadsWorks, representing the premier asset creation engine in the Monetization tier.",
    externalLink: "/productworks"
  },
  {
    id: "funnelworks",
    name: "FunnelWorks",
    category: "Monetization",
    headline: "Connect content, offers and buying steps.",
    shortDescription: "Map seamless customer journeys from social media discovery to checkout and delivery.",
    availability: "Planned",
    badgeColor: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    purpose: "Design frictionless conversion paths that connect educational content to clear offers and transactions.",
    problemSolved: "Disconnected marketing efforts where potential buyers get lost between reading content and buying an offer.",
    intendedOutputs: [
      "Customer Journey & Conversion Flow Map",
      "Touchpoint Sequencing Architecture",
      "Funnel Blueprint & Milestone Guide"
    ],
    ecosystemRelationship: "Bridges the gap between Attention applications (ThreadsWorks) and Monetization applications (OfferWorks, ProductWorks)."
  },
  {
    id: "salesworks",
    name: "SalesWorks",
    category: "Monetization",
    headline: "Help buyers understand and purchase offers.",
    shortDescription: "Craft compelling sales pages, email sequences, and objection-handling copy.",
    availability: "Planned",
    badgeColor: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    purpose: "Communicate the true value of your offers through clear, persuasive copywriting and transparent positioning.",
    problemSolved: "Struggling to articulate the value of digital offers or relying on aggressive, manipulative sales tactics.",
    intendedOutputs: [
      "Sales Page Copy & Value Breakdown",
      "Email Launch Sequence Framework",
      "Objection Handling & FAQ Playbook"
    ],
    ecosystemRelationship: "Converts the interest generated by FunnelWorks and content apps into successful transactions."
  },

  // Customer Success
  {
    id: "deliveryworks",
    name: "DeliveryWorks",
    category: "Customer Success",
    headline: "Fulfill offers and improve customer experiences.",
    shortDescription: "Streamline client onboarding, product delivery, and customer success touchpoints.",
    availability: "Planned",
    badgeColor: "bg-teal-500/10 text-teal-400 border-teal-500/20",
    purpose: "Ensure every buyer receives a smooth onboarding experience and achieves their desired outcome successfully.",
    problemSolved: "Chaotic fulfillment and poor onboarding that leads to buyer remorse or low completion rates.",
    intendedOutputs: [
      "Customer Onboarding Welcome Sequence",
      "Product Delivery Portal & Milestone Checklist",
      "Client Success Feedback Loop"
    ],
    ecosystemRelationship: "Protects and enhances customer lifetime value after SalesWorks and ProductWorks complete a transaction."
  },
  {
    id: "proofworks",
    name: "ProofWorks",
    category: "Customer Success",
    headline: "Organize examples, feedback and evidence.",
    shortDescription: "Collect, curate, and showcase customer testimonials, case studies, and success proof.",
    availability: "Planned",
    badgeColor: "bg-teal-500/10 text-teal-400 border-teal-500/20",
    purpose: "Systematically gather authentic customer results to demonstrate credibility and build trust across all offers.",
    problemSolved: "Forgetting to ask for testimonials or letting valuable customer success stories sit scattered across chats.",
    intendedOutputs: [
      "Testimonial & Evidence Collection System",
      "Case Study Framework & Story Arc",
      "Social Proof Library"
    ],
    ecosystemRelationship: "Feeds verified success evidence back into SalesWorks and ContentWorks to strengthen future marketing."
  },

  // Expansion
  {
    id: "growthworks",
    name: "GrowthWorks",
    category: "Expansion",
    headline: "Expand reach and improve what works.",
    shortDescription: "Analyze performance analytics, identify top-performing content, and scale winning strategies.",
    availability: "Planned",
    badgeColor: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    purpose: "Provide data-driven insights that help creators double down on what resonates and expand their audience reach.",
    problemSolved: "Guessing what content or offers drive growth without clear analytics or performance feedback.",
    intendedOutputs: [
      "Creator Analytics & Growth Dashboard",
      "Performance Audit & Optimization Playbook",
      "Scaling & Experimentation Plan"
    ],
    ecosystemRelationship: "Aggregates data across the ContentPaysUs ecosystem to guide continuous business expansion."
  },
  {
    id: "adsworks",
    name: "AdsWorks",
    category: "Expansion",
    headline: "Support paid distribution.",
    shortDescription: "Design, test, and manage paid acquisition campaigns to amplify proven content and offers.",
    availability: "Planned",
    badgeColor: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    purpose: "Help creators amplify top-performing organic content and offers through targeted paid advertising.",
    problemSolved: "Wasting ad spend on unproven messaging or struggling to scale organic momentum with paid traffic.",
    intendedOutputs: [
      "Paid Ad Creative Brief & Angle Strategy",
      "Campaign Structure & Targeting Playbook",
      "ROAS & Conversion Tracking Setup"
    ],
    ecosystemRelationship: "Amplifies proven content from ThreadsWorks and proven offers from ProductWorks."
  },
  {
    id: "teamworks",
    name: "TeamWorks",
    category: "Expansion",
    headline: "Map growth through sharing and recommendations.",
    shortDescription: "Collaborate with peers, manage creator networks, and build recommendation partnerships.",
    availability: "Planned",
    badgeColor: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    purpose: "Facilitate strategic partnerships, guest collaborations, and creator network growth.",
    problemSolved: "Operating in an isolated silo without leverage from peer networks or cross-promotion opportunities.",
    intendedOutputs: [
      "Creator Collaboration & Partner Roadmap",
      "Cross-Promotion Agreement Templates",
      "Network Growth & Referral Plan"
    ],
    ecosystemRelationship: "Connects creators across the broader ContentPaysUs ecosystem for mutual growth."
  },
  {
    id: "affiliateworks",
    name: "AffiliateWorks",
    category: "Expansion",
    headline: "Create and manage affiliate programs.",
    shortDescription: "Empower partners and customers to recommend your offers with transparent tracking and rewards.",
    availability: "Planned",
    badgeColor: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    purpose: "Enable creators to build scalable affiliate referral channels behind their products and offers.",
    problemSolved: "Manual tracking of affiliate commissions and lack of tooling to run a referral program.",
    intendedOutputs: [
      "Affiliate Program Structure & Commission Terms",
      "Partner Resource Kit & Swipe Copy",
      "Tracking & Payout Workflow"
    ],
    ecosystemRelationship: "Extends ProductWorks and SalesWorks with partner distribution networks."
  },
  {
    id: "projectz",
    name: "Project Z",
    category: "Expansion",
    headline: "Future tools for audience momentum, monetization and influence.",
    shortDescription: "Experimental next-generation capabilities exploring advanced AI leverage and creator autonomy.",
    availability: "Working Concept",
    badgeColor: "bg-violet-500/10 text-violet-400 border-violet-500/20",
    purpose: "Explore cutting-edge workflows for future creator leverage, autonomous intelligence, and audience momentum.",
    problemSolved: "Anticipating future shifts in creator economics and digital distribution technology.",
    intendedOutputs: [
      "Experimental Prototyping & Concept Specs",
      "Advanced AI Leverage Research",
      "Next-Gen Creator Workflow Models"
    ],
    ecosystemRelationship: "Represents the bleeding-edge R&D incubator for future ContentPaysUs ecosystem capabilities."
  }
];
