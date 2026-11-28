/**
 * Single source of truth for ThreadsWorks public marketing routes,
 * SEO metadata, Schema.org JSON-LD structured data, sitemap.xml, and robots.txt.
 *
 * Shared across:
 * - Build-time static pre-rendering (scripts/prerender-marketing.ts)
 * - Express server dev & production HTML/sitemap/robots serving (server.ts)
 * - Client-side React marketing pages & SPA metadata synchronization (src/App.tsx)
 */

export const SITE_ORIGIN = "https://threadsworks.com";
export const SITE_NAME = "ThreadsWorks";
export const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}/og-image.png`;
export const DEFAULT_LOGO_URL = `${SITE_ORIGIN}/threadsworks-logo.svg`;

export interface MarketingFeatureBlock {
  heading: string;
  body: string;
  highlights?: string[];
}

export interface MarketingWorkflowStep {
  step: string;
  title: string;
  description: string;
}

export interface MarketingFrameworkItem {
  name: string;
  availabilityLabel: string;
  problemSolved: string;
  explanation: string;
  example: string;
  featureLinkPath?: string;
  featureLinkLabel?: string;
}

export interface MarketingScreenshotSection {
  id: string;
  stepLabel: string;
  heading: string;
  description: string;
  bullets: string[];
  /** Relative public asset path when a genuine screenshot PNG is available */
  screenshotSrc?: string;
  /** Descriptive alt text for a genuine screenshot */
  screenshotAlt?: string;
  /** Optional visible caption beneath a genuine screenshot */
  screenshotCaption?: string;
  /** True only when a verified screenshot asset exists and should render */
  hasGenuineAsset: boolean;
  /** Optional internal link to deeper feature page */
  featureLinkPath?: string;
  featureLinkLabel?: string;
}

export interface MarketingFreePromo {
  heading: string;
  subheading: string;
  benefits: string[];
  ctaLabel: string;
  footnote: string;
}

export interface MarketingFaqItem {
  question: string;
  answer: string;
}

export interface MarketingRelatedLink {
  path: string;
  label: string;
  description: string;
}

export interface PublicMarketingRoute {
  /** Canonical path starting with "/" (no trailing slash except "/") */
  path: string;
  /** Output filename inside dist/ (e.g. "index.html", "threads-scheduler.html") */
  outputFile: string;
  /** Short navigation label */
  navLabel: string;
  /** Route template kind */
  kind: "home" | "ecosystem" | "feature" | "pricing" | "legal";
  /** SEO page title (30-60 chars) */
  title: string;
  /** SEO meta description (120-160 chars) */
  description: string;
  /** Sitemap priority */
  priority: string;
  /** Sitemap changefreq */
  changefreq: "weekly" | "monthly";
  /** Concise platform clarification above H1 */
  platformNote: string;
  /** Single primary H1 for the page */
  h1: string;
  /** Optional bold supporting headline beneath H1 (used on homepage) */
  heroSupportingHeadline?: string;
  /** Subheadline directly below H1 / supporting headline */
  lead: string;
  /** Optional bold free-plan offer callout in hero (used on homepage) */
  heroOfferLine?: string;
  /** Primary CTA label connected to existing signup/onboarding flow */
  primaryCtaLabel: string;
  /** Optional workflow strip rendered immediately below hero */
  workflowHeading?: string;
  workflowIntro?: string;
  workflowSteps?: MarketingWorkflowStep[];
  /** Verified persuasive writing frameworks & techniques section */
  frameworkHeading?: string;
  frameworkIntro?: string;
  frameworkItems?: MarketingFrameworkItem[];
  /** Optional 3-part screenshot tutorial sections (used on homepage) */
  screenshotSections?: MarketingScreenshotSection[];
  /** Primary capability sections (H2 -> H3) */
  sectionsHeading?: string;
  sectionsIntro?: string;
  features?: MarketingFeatureBlock[];
  /** Free plan promotion block */
  freePromo?: MarketingFreePromo;
  /** Frequently asked questions grounded strictly in real product behavior */
  faqs?: MarketingFaqItem[];
  /** Internal links to related marketing pages */
  relatedLinks: MarketingRelatedLink[];
}

export const PUBLIC_MARKETING_ROUTES: PublicMarketingRoute[] = [
  {
    path: "/productworks",
    outputFile: "productworks.html",
    navLabel: "ProductWorks",
    kind: "feature",
    title: "AI Digital Product Creator | ProductWorks by ThreadsWorks",
    description: "Turn your ideas into downloadable digital products with ProductWorks. Build PDF playbooks, 7-slide carousels, and storefront copy using AI.",
    priority: "0.9",
    changefreq: "weekly",
    platformNote: "Built for creators and entrepreneurs.",
    h1: "Turn Content Into Digital Products With AI",
    lead: "The ultimate AI digital product creator and digital product generator. Build PDF playbooks, AI carousels, social posts, and storefront copy using content monetization tools designed for creators.",
    primaryCtaLabel: "LAUNCH PRODUCTWORKS",
    workflowHeading: "Idea → AI Product Generation → Complete Downloadable Package",
    workflowIntro: "Transform your knowledge, ideas, or existing social media content into coordinated digital product assets in minutes.",
    workflowSteps: [
      { step: "01", title: "Concept", description: "Define your audience, outcome, and product title from any idea or post." },
      { step: "02", title: "Generate", description: "Use Gemini AI to generate 7-slide carousels, a 2-page PDF playbook, and storefront copy." },
      { step: "03", title: "Download", description: "Export individual PNGs, complete ZIPs, playbook PDFs, and companion posts instantly." }
    ],
    sectionsHeading: "Everything You Need to Monetize Your Content",
    sectionsIntro: "Powerful content monetization tools and AI tools for content creators.",
    features: [
      { heading: "AI Digital Product Creator", body: "Turn your thoughts and knowledge into structured, high-value digital products instantly." },
      { heading: "AI PDF Playbook Generator", body: "Automatically construct comprehensive, professional two-page PDF playbooks." },
      { heading: "AI Carousel Creator", body: "Generate stunning 7-slide social media carousels tailored to your brand theme." }
    ],
    relatedLinks: [
      { path: "/", label: "ThreadsWorks Home", description: "Return to the ContentPaysUs and ThreadsWorks creator platform overview." },
      { path: "/applications", label: "Ecosystem Applications", description: "Explore all 20 applications on the ContentPaysUs roadmap." },
      { path: "/ai-threads-post-generator", label: "AI Post Generator", description: "Turn rough ideas into structured posts." },
      { path: "/pricing", label: "Pricing", description: "View free and Pro plan details." }
    ]
  },
  {
    path: "/",
    outputFile: "index.html",
    navLabel: "Overview",
    kind: "home",
    title: "ThreadsWorks & ContentPaysUs | AI Creator Business Ecosystem",
    description:
      "Build your creator business on ThreadsWorks.com. Write and schedule Meta Threads posts with ThreadsWorks inside the AI-powered ContentPaysUs ecosystem.",
    priority: "1.0",
    changefreq: "weekly",
    platformNote: "ContentPaysUs · Home of ThreadsWorks for Meta Threads creators.",
    h1: "Turn what you know into what you earn.",
    heroSupportingHeadline: "The AI-powered ecosystem for building your creator business.",
    lead:
      "Learn the skills, create the content, build valuable products and connect with the people who need them.",
    heroOfferLine: "60 FREE POSTS EVERY MONTH ON THREADSWORKS.",
    primaryCtaLabel: "GET STARTED FREE",
    workflowHeading: "Learn → Identify → Build → Attract → Connect → Sell → Deliver → Grow",
    workflowIntro:
      "It started with a thread. ThreadsWorks is evolving into ContentPaysUs — a connected ecosystem designed to support the entire creator journey, starting with our mission: 1,000 creators, 1,000 first sales.",
    workflowSteps: [
      {
        step: "01",
        title: "Idea",
        description: "Capture a topic, observation, or content pillar instead of starting from scratch."
      },
      {
        step: "02",
        title: "Hook",
        description: "Develop a sharper strategic angle and lock your opening line before drafting."
      },
      {
        step: "03",
        title: "Post",
        description: "Turn the angle into a clear single post or multi-part thread in your voice."
      },
      {
        step: "04",
        title: "Schedule",
        description: "Organize drafts in your library and publish directly to Meta Threads."
      }
    ],
    frameworkHeading: "BETTER WRITING STARTS WITH BETTER STRUCTURE.",
    frameworkIntro:
      "ThreadsWorks applies practical social media writing frameworks and persuasive writing techniques directly inside the drafting workflow—combining the controls you choose with automatic structural variety.",
    frameworkItems: [
      {
        name: "Attention, Trust, and Sales Post Goals",
        availabilityLabel: "User-selectable in the writer",
        problemSolved:
          "Posts lose focus when a single draft tries to introduce a fresh viewpoint, teach a detailed workflow, and pitch an offer all at once.",
        explanation:
          "Choose Attention, Trust, or Sales before drafting. Attention focuses on clear perspective and contrast to stop the scroll; Trust walks through practical steps and grounded reasoning; Sales positions a clear offer or conversation starter without hype.",
        example:
          "Attention: Concrete observation → why the usual habit stalls progress → clear question that invites replies.",
        featureLinkPath: "/ai-threads-post-generator",
        featureLinkLabel: "See how post goals work"
      },
      {
        name: "Strategic Angle + Locked Opening Hook",
        availabilityLabel: "User-selectable hook controls",
        problemSolved:
          "Strong ideas get skipped when the first line is vague, slow to reach the point, or relies on tired social clichés.",
        explanation:
          "Generate a specific angle paired with a concise opening hook under 140 characters, then lock that hook at the start of Part 1 so the rest of the post delivers on its opening promise. You can also add, rework, or remove hooks on existing drafts without breaking Part 2.",
        example:
          "Locked Hook: \"Most drafts don't stall on ideas—they stall in the first sentence.\" → Part 2: How cutting the warm-up line clarifies the takeaway.",
        featureLinkPath: "/threads-hook-generator",
        featureLinkLabel: "Explore Threads hooks"
      },
      {
        name: "Eight Rotating Writing Angles & Thread Shapes",
        availabilityLabel: "Applied automatically across batches",
        problemSolved:
          "Writing multiple posts on the same topic quickly sounds repetitive when every draft follows the exact same thesis and cadence.",
        explanation:
          "When drafting batches, ThreadsWorks automatically rotates across eight rhetorical lenses—Sharp Observation, Hidden Tradeoff, Counterexample, Tactical Walkthrough, Decision Rule, Diagnostic Lens, Grounded Moment, and Mental Model Reframe—across single posts and multi-part threads.",
        example:
          "Hidden Tradeoff: Compare two reasonable approaches → name the overlooked cost of the shortcut → give a practical rule for deciding.",
        featureLinkPath: "/ai-threads-post-generator",
        featureLinkLabel: "See batch drafting"
      },
      {
        name: "Voice-Preserved Drafting With Relevance Gating",
        availabilityLabel: "Your voice settings + automatic checks",
        problemSolved:
          "Generic AI writers slip into buzzwords, force unrelated business pitches onto casual topics, or recycle earlier phrasing.",
        explanation:
          "Your saved writing style, voice notes, and words-to-avoid stay active on every post, while commercial positioning is omitted on off-niche topics. Automated checks flag formulaic openers, repeated library phrasing, and 500-character overflows before drafts reach your queue.",
        example:
          "General topic with CTA Off: Direct observation in your natural voice → zero unsolicited pitch → every thread part under 500 characters.",
        featureLinkPath: "/content-ideas",
        featureLinkLabel: "See voice & library workflow"
      }
    ],
    screenshotSections: [
      {
        id: "tutorial-turn-ideas-into-posts",
        stepLabel: "STEP 01 · AI THREADS WRITER",
        heading: "TURN IDEAS INTO POSTS.",
        description:
          "Start with a rough thought, topic, or content pillar. Set single-post or multi-part thread length, and turn raw notes into clear Meta Threads drafts that stay grounded in your voice.",
        bullets: [
          "Drafts standalone posts or multi-part threads within Meta Threads' 500-character limit",
          "Automatically varies writing angles across batches so posts read clearly instead of repeating",
          "Edit parts inline, append continuations, or keep editorial posts pitch-free with CTA Off"
        ],
        hasGenuineAsset: false,
        featureLinkPath: "/ai-threads-post-generator",
        featureLinkLabel: "Explore AI Threads Post Generator"
      },
      {
        id: "tutorial-develop-stronger-hooks",
        stepLabel: "STEP 02 · THREADS HOOKS",
        heading: "DEVELOP STRONGER HOOKS.",
        description:
          "Test clearer ways to open a post before you commit to a draft. Pair a sharp strategic angle with a concise opening line, lock your preferred hook at the top of Part 1, or rework hooks on existing drafts to invite better conversations.",
        bullets: [
          "Pairs a focused perspective with a crisp opening line under 140 characters",
          "Lock a hook verbatim at the start of Part 1 so the body fulfills the opening line",
          "Add, regenerate, or remove hooks on existing drafts without losing Part 2 flow"
        ],
        hasGenuineAsset: false,
        featureLinkPath: "/threads-hook-generator",
        featureLinkLabel: "Explore Threads Hook Generator"
      },
      {
        id: "tutorial-organize-and-schedule",
        stepLabel: "STEP 03 · THREADS CONTENT SCHEDULING",
        heading: "ORGANIZE AND SCHEDULE CONTENT.",
        description:
          "Save finished drafts in your private Content Library, arrange them on a visual calendar, and publish automatically to your connected Meta Threads account through official Meta OAuth.",
        bullets: [
          "Keep ready drafts, edits, and content pillars organized in one Meta Threads workspace",
          "Schedule single posts and multi-part reply chains on a visual calendar or list view",
          "Publish automatically on schedule or post immediately with one click"
        ],
        hasGenuineAsset: false,
        featureLinkPath: "/threads-scheduler",
        featureLinkLabel: "Explore Threads Content Scheduling"
      }
    ],
    freePromo: {
      heading: "60 FREE POSTS. EVERY MONTH.",
      subheading:
        "Start writing clearer Meta Threads posts, developing stronger hooks, and scheduling your calendar on the Free plan—no credit card required.",
      benefits: [
        "150 free AI generations every month (enough room for 60+ finished posts plus hook explorations and revisions)",
        "Up to 5 scheduled Meta Threads posts per day",
        "Direct 1-click Meta Threads publishing via official Meta OAuth",
        "Creator Voice & Profile setup included",
        "Full Content Library and Calendar access"
      ],
      ctaLabel: "START CREATING FREE",
      footnote:
        "Free forever. Upgrade to Pro ($7/month or $59/year) only when you need unlimited AI generations and unlimited daily scheduling."
    },
    relatedLinks: [
      {
        path: "/applications",
        label: "ContentPaysUs Applications",
        description: "Explore all 20 applications across the connected creator roadmap."
      },
      {
        path: "/learn",
        label: "ContentPaysUs Academy",
        description: "Learn for free, build with AI, and grow together with practical creator education."
      },
      {
        path: "/about",
        label: "Our Story & Mission",
        description: "It started with a thread. Learn about our mission: 1,000 creators, 1,000 first sales."
      },
      {
        path: "/ai-threads-post-generator",
        label: "AI Threads Post Generator",
        description: "Turn ideas into structured Meta Threads posts and threads in your voice."
      }
    ]
  },
  {
    path: "/applications",
    outputFile: "applications.html",
    navLabel: "Applications",
    kind: "ecosystem",
    title: "ContentPaysUs Applications | 20-App Creator Roadmap",
    description:
      "Explore all 20 applications in the ContentPaysUs ecosystem on ThreadsWorks.com, starting with ThreadsWorks for Meta Threads and ProductWorks.",
    priority: "0.9",
    changefreq: "weekly",
    platformNote: "ContentPaysUs Ecosystem · 20-Application Roadmap.",
    h1: "Specialized applications connected around one creator business.",
    lead:
      "Every application in ContentPaysUs is classified honestly as Available, In Development, or Planned—starting with ThreadsWorks today.",
    primaryCtaLabel: "GET STARTED FREE",
    sectionsHeading: "Available Today, In Development, and Planned",
    sectionsIntro:
      "Start with ThreadsWorks for Meta Threads writing and scheduling, test ProductWorks for downloadable digital assets, and carry your creator profile forward as planned tools launch.",
    features: [
      {
        heading: "ThreadsWorks (Available)",
        body: "Write voice-preserved Meta Threads posts and multi-part threads, refine opening hooks, manage your content library, and schedule publishing via official Meta OAuth."
      },
      {
        heading: "ProductWorks (In Development)",
        body: "Turn an idea or existing post into downloadable 2-page PDF playbooks, 7-slide carousels, companion posts, and storefront sales copy."
      },
      {
        heading: "18 Planned Ecosystem Applications",
        body: "Planned roadmap tools spanning ContentPaysUs Academy, CreatorWorks, DemandWorks, ContentWorks, CommunityWorks, EmailWorks, OfferWorks, First Sale Engine, FunnelWorks, SalesWorks, MeetingWorks, DeliveryWorks, ProofWorks, GrowthWorks, AdsWorks, TeamWorks, AffiliateWorks, and Project Z."
      }
    ],
    relatedLinks: [
      {
        path: "/",
        label: "ContentPaysUs Home",
        description: "Return to the main ThreadsWorks.com and ContentPaysUs overview."
      },
      {
        path: "/learn",
        label: "ContentPaysUs Academy",
        description: "Explore our planned free creator education destination."
      },
      {
        path: "/productworks",
        label: "ProductWorks",
        description: "See how ProductWorks generates downloadable digital product assets."
      },
      {
        path: "/about",
        label: "About ContentPaysUs",
        description: "Read the story connecting ThreadsWorks and ContentPaysUs."
      }
    ]
  },
  {
    path: "/learn",
    outputFile: "learn.html",
    navLabel: "Learn",
    kind: "ecosystem",
    title: "ContentPaysUs Academy | Free Creator Business Education",
    description:
      "Learn for free, build with AI, and grow together with ContentPaysUs Academy—featuring our planned flagship course, How to Get Your First Sale.",
    priority: "0.8",
    changefreq: "weekly",
    platformNote: "ContentPaysUs Academy · Planned Free Learning Destination.",
    h1: "Learn for free. Build with AI. Grow together.",
    lead:
      "ContentPaysUs Academy is our planned free creator learning destination featuring the upcoming flagship course How to Get Your First Sale and future community-created free courses.",
    primaryCtaLabel: "GET STARTED FREE",
    sectionsHeading: "Practical Creator Business Education",
    sectionsIntro:
      "Foundational creator skills should be accessible to everyone—paired directly with practical tools inside ThreadsWorks.com.",
    features: [
      {
        heading: "Flagship Course: How to Get Your First Sale (Planned)",
        body: "A planned free, step-by-step course covering buyer problem discovery, starter product packaging, helpful content, and earning your first verified customer."
      },
      {
        heading: "Future Community-Created Free Courses",
        body: "As the Academy grows, community members will be able to create and share their own free practical courses with fellow creators."
      },
      {
        heading: "Nine-Topic Creator Reference Guide",
        body: "Available today to study core principles across Brand Development, Buyer Demand, Content Creation, Audience Relationships, Offer Creation, Digital Products, Customer Acquisition, Customer Delivery, and Sustainable Growth."
      }
    ],
    relatedLinks: [
      {
        path: "/",
        label: "ContentPaysUs Home",
        description: "Return to the main ThreadsWorks.com overview."
      },
      {
        path: "/applications",
        label: "20-App Roadmap",
        description: "Browse Available, In Development, and Planned applications."
      },
      {
        path: "/about",
        label: "Our Story & Mission",
        description: "Learn about our mission: 1,000 creators, 1,000 first sales."
      },
      {
        path: "/ai-threads-post-generator",
        label: "ThreadsWorks Writer",
        description: "Start creating Meta Threads posts today."
      }
    ]
  },
  {
    path: "/about",
    outputFile: "about.html",
    navLabel: "About",
    kind: "ecosystem",
    title: "About ContentPaysUs & ThreadsWorks | Our Story & Mission",
    description:
      "It started with a thread. Learn how ThreadsWorks is evolving into ContentPaysUs with one mission: helping 1,000 creators achieve their first verified sale.",
    priority: "0.8",
    changefreq: "monthly",
    platformNote: "ThreadsWorks.com · Official Home of ThreadsWorks & ContentPaysUs.",
    h1: "It started with a thread.",
    lead:
      "ThreadsWorks began with a simple purpose: helping creators turn their ideas into content. ThreadsWorks is where it started. ContentPaysUs is what we’re building together.",
    primaryCtaLabel: "GET STARTED FREE",
    sectionsHeading: "Our Story, Mission, and Transparent Roadmap",
    sectionsIntro:
      "One website at ThreadsWorks.com, one creator identity, and honest classification of every live and planned application.",
    features: [
      {
        heading: "From ThreadsWorks to ContentPaysUs",
        body: "Creating content is only part of building a successful creator business. Creators also need to understand their audience, discover demand, build valuable products, find customers and make sales."
      },
      {
        heading: "Mission: 1,000 creators. 1,000 first sales.",
        body: "Our goal is to help 1,000 creators achieve their first verified sale through ContentPaysUs. This is our guiding mission—not a claim of achieved results or guarantee of income."
      }
    ],
    relatedLinks: [
      {
        path: "/",
        label: "ContentPaysUs Home",
        description: "Return to the main ThreadsWorks.com overview."
      },
      {
        path: "/applications",
        label: "20-App Roadmap",
        description: "Inspect every application and its current availability."
      },
      {
        path: "/learn",
        label: "ContentPaysUs Academy",
        description: "Explore our planned free creator education destination."
      },
      {
        path: "/pricing",
        label: "ThreadsWorks Pricing",
        description: "Compare Free and Pro plans for ThreadsWorks."
      }
    ]
  },
  {
    path: "/ai-threads-post-generator",
    outputFile: "ai-threads-post-generator.html",
    navLabel: "AI Post Generator",
    kind: "feature",
    title: "AI Threads Post Generator & Writer | ThreadsWorks",
    description:
      "AI Threads writer and post generator that uses Attention, Trust, and Sales goals, rotating writing angles, and 500-character checks for Meta Threads.",
    priority: "0.9",
    changefreq: "weekly",
    platformNote: "Built for Meta Threads creators.",
    h1: "Turn Rough Ideas Into Structured Meta Threads Posts",
    lead:
      "Use an AI Threads post generator built around clear post goals, rotating writing angles, and your saved creator voice—so every draft reads clearly and stays within Meta Threads limits.",
    primaryCtaLabel: "START CREATING FREE",
    workflowHeading: "How a Rough Idea Becomes a Publish-Ready Thread",
    workflowSteps: [
      {
        step: "01",
        title: "Enter a Topic or Thought",
        description:
          "Type a subject, paste a raw note, or pull an active content pillar into the drafting workspace."
      },
      {
        step: "02",
        title: "Pick Goal, Format, and CTA",
        description:
          "Select Attention, Trust, or Sales, set single-post or multi-part thread length, and choose CTA Off or approved links."
      },
      {
        step: "03",
        title: "Refine Individual Parts",
        description:
          "Edit inline, tighten character counts, optimize clarity, or append the next thread continuation."
      },
      {
        step: "04",
        title: "Save or Schedule",
        description:
          "Store finished posts in your Content Library or place them directly on your Meta Threads calendar."
      }
    ],
    sectionsHeading: "Structured Writing Techniques Built for Meta Threads",
    sectionsIntro:
      "Every draft is shaped around readable mobile pacing, clear message structure, and verified creator context.",
    features: [
      {
        heading: "Attention, Trust, and Sales Post Goals",
        body:
          "Switch deliberately between Attention posts that introduce a sharp perspective, Trust posts that explain practical workflows, and Sales posts that present a clear offer or conversation prompt.",
        highlights: [
          "User-selectable goal tabs keep each draft focused on one clear job",
          "Supports 1 to 15 thread parts with part-by-part continuation",
          "Every part fits strictly within Meta Threads' 500-character limit"
        ]
      },
      {
        heading: "Voice Preservation With Relevance-Gated Context",
        body:
          "Your writing style, voice notes, and words-to-avoid remain active on every post, while business positioning is included only when relevant to your topic.",
        highlights: [
          "Off-niche and everyday topics stay free of unsolicited business pitches",
          "CTA Off mode keeps editorial posts free of links or prompts",
          "Only approved destination URLs are permitted when CTAs are enabled"
        ]
      },
      {
        heading: "Automatic Angle Rotation and Anti-Repetition Checks",
        body:
          "Batch generations automatically rotate across eight rhetorical lenses—Sharp Observation, Hidden Tradeoff, Counterexample, Tactical Walkthrough, Decision Rule, Diagnostic Lens, Grounded Moment, and Mental Model Reframe.",
        highlights: [
          "Checks drafts against the current batch and your saved Content Library",
          "Flags cliché openers, repeated opening phrases, and over-length parts",
          "Repairs individual drafts without discarding valid sibling drafts"
        ]
      }
    ],
    relatedLinks: [
      {
        path: "/threads-hook-generator",
        label: "Threads Hook Generator",
        description: "Test opening hooks and lock your first line before drafting."
      },
      {
        path: "/content-ideas",
        label: "Threads Content Planning",
        description: "Organize raw thoughts and recurring content pillars."
      },
      {
        path: "/threads-scheduler",
        label: "Threads Scheduler",
        description: "Schedule finished posts directly to your Meta Threads profile."
      },
      {
        path: "/pricing",
        label: "Compare Free & Pro Plans",
        description: "Review verified monthly generation and daily scheduling limits."
      }
    ]
  },
  {
    path: "/threads-hook-generator",
    outputFile: "threads-hook-generator.html",
    navLabel: "Hook Generator",
    kind: "feature",
    title: "Threads Hook Generator — Stronger Opening Lines | ThreadsWorks",
    description:
      "Develop stronger Meta Threads hooks paired with focused writing angles, lock your opening line at Part 1, and refine hooks on existing drafts.",
    priority: "0.9",
    changefreq: "weekly",
    platformNote: "Built for Meta Threads creators.",
    h1: "Develop Stronger Meta Threads Hooks Without Cliché Templates",
    lead:
      "Pair a clear strategic angle with a concise opening line under 140 characters, lock your hook at the top of Part 1, and draft a post that follows through on its promise.",
    primaryCtaLabel: "START CREATING FREE",
    workflowHeading: "From Topic to Locked Opening Line",
    workflowSteps: [
      {
        step: "01",
        title: "Choose Your Topic",
        description:
          "Enter the observation, lesson, or question you want to share on Meta Threads."
      },
      {
        step: "02",
        title: "Generate Angle and Hook",
        description:
          "Review a fresh writing perspective paired with a direct opening line under 140 characters."
      },
      {
        step: "03",
        title: "Lock and Draft",
        description:
          "Lock the hook at the start of Part 1 so the generated post or thread delivers on its opening line."
      }
    ],
    sectionsHeading: "Hook Controls Connected Directly to Your Writer",
    sectionsIntro:
      "Generate, lock, and refine opening lines inside the same workspace where you draft and schedule posts.",
    features: [
      {
        heading: "Strategic Angle + Opening Line Pairing",
        body:
          "Each hook is paired with a concrete perspective so the first sentence makes a specific point instead of falling back on tired bait formulas.",
        highlights: [
          "Avoids repetitive cliché openers and filler phrases",
          "Checks recent hooks so repeat runs explore fresh phrasing",
          "Works for standalone posts and multi-part threads"
        ]
      },
      {
        heading: "Lock Your Opening Hook Across Drafts",
        body:
          "Lock a preferred opener in the writer so generated drafts preserve that exact opening line verbatim and transition smoothly into Part 2.",
        highlights: [
          "Exact locked-hook preservation at the start of Part 1",
          "Add, regenerate, or remove hooks on existing drafts anytime",
          "Keeps character counts and factual grounding intact"
        ]
      },
      {
        heading: "Targeted Hook Transformations",
        body:
          "Rework only the opening line of an existing draft without rewriting the rest of your perspective or introducing unsupported claims.",
        highlights: [
          "Preserves underlying facts and Part 2 continuity",
          "Honors your saved creator voice and words-to-avoid",
          "Ready to save to your Content Library or schedule"
        ]
      }
    ],
    relatedLinks: [
      {
        path: "/ai-threads-post-generator",
        label: "AI Threads Post Generator",
        description: "Expand locked hooks into complete single posts and threads."
      },
      {
        path: "/content-ideas",
        label: "Threads Content Planning",
        description: "Capture everyday thoughts and organize topic pillars."
      },
      {
        path: "/threads-scheduler",
        label: "Threads Scheduler",
        description: "Place finished posts directly onto your Meta Threads calendar."
      }
    ]
  },
  {
    path: "/threads-scheduler",
    outputFile: "threads-scheduler.html",
    navLabel: "Threads Scheduler",
    kind: "feature",
    title: "Threads Content Scheduling & Calendar | ThreadsWorks",
    description:
      "Organize your Meta Threads content calendar, schedule single posts and multi-part threads, and publish directly via the official Meta Threads API.",
    priority: "0.9",
    changefreq: "weekly",
    platformNote: "Built for Meta Threads creators.",
    h1: "Organize and Schedule Meta Threads Posts on One Calendar",
    lead:
      "Move finished drafts from your writer and Content Library straight onto a visual Meta Threads calendar, edit parts inline, and publish automatically through official Meta Threads OAuth.",
    primaryCtaLabel: "START CREATING FREE",
    workflowHeading: "From Drafted Post to Published Thread",
    workflowSteps: [
      {
        step: "01",
        title: "Connect Meta Threads",
        description:
          "Authorize ThreadsWorks through Meta's official Threads OAuth dialog inside your Creator Profile."
      },
      {
        step: "02",
        title: "Schedule on the Calendar",
        description:
          "Assign dates and times to individual drafts from the writer or Content Library, or queue a batch."
      },
      {
        step: "03",
        title: "Automated Publishing",
        description:
          "ThreadsWorks publishes due single posts and multi-part reply chains automatically to your connected profile."
      }
    ],
    sectionsHeading: "Meta Threads Content Planning and Scheduling",
    sectionsIntro:
      "Stay consistent on Meta Threads without copying and pasting thread parts manually at the last minute.",
    features: [
      {
        heading: "Visual Threads Content Calendar",
        body:
          "Review scheduled and drafted posts by date and time slot, adjust timing as your week shifts, and keep upcoming posts organized in one view.",
        highlights: [
          "Calendar and list views for upcoming Meta Threads posts",
          "Batch-add ready drafts from the writer directly to your schedule",
          "Inline editing up until the scheduled publish time"
        ]
      },
      {
        heading: "Single Posts and Multi-Part Thread Support",
        body:
          "Schedule standalone posts and chained multi-part threads while keeping every card within Meta Threads' 500-character limit.",
        highlights: [
          "Preserves exact thread part order during publication",
          "Automatic reply-chain publishing for multi-part threads",
          "One-click immediate publish option for timely drafts"
        ]
      },
      {
        heading: "Official Meta Threads OAuth Integration",
        body:
          "Connect your Threads profile securely via Meta's official OAuth flow. Access tokens stay server-side and can be disconnected anytime from workspace settings.",
        highlights: [
          "Uses official Meta Threads API publishing endpoints",
          "Instant in-app disconnect and token removal",
          "No third-party password sharing required"
        ]
      }
    ],
    relatedLinks: [
      {
        path: "/ai-threads-post-generator",
        label: "AI Threads Post Generator",
        description: "Draft structured posts and threads ready for your calendar."
      },
      {
        path: "/content-ideas",
        label: "Threads Content Planning",
        description: "Organize ideas, content pillars, and your saved Content Library."
      },
      {
        path: "/pricing",
        label: "ThreadsWorks Pricing",
        description: "Compare daily scheduled post limits on Free vs Pro."
      }
    ]
  },
  {
    path: "/content-ideas",
    outputFile: "content-ideas.html",
    navLabel: "Content Planning",
    kind: "feature",
    title: "Threads Content Ideas & Planning Workflow | ThreadsWorks",
    description:
      "Turn everyday observations into structured Meta Threads posts, organize content pillars, and manage drafts in your Content Library.",
    priority: "0.9",
    changefreq: "weekly",
    platformNote: "Built for Meta Threads creators.",
    h1: "Turn Everyday Ideas Into an Organized Threads Content Library",
    lead:
      "Keep rough thoughts, content pillars, and ready drafts in the same Meta Threads workspace as your AI writer and publishing calendar.",
    primaryCtaLabel: "START CREATING FREE",
    workflowHeading: "A Repeatable Content Planning Loop",
    workflowSteps: [
      {
        step: "01",
        title: "Define Voice and Pillars",
        description:
          "Configure your Creator Profile with your writing style, core themes, words to avoid, and optional links."
      },
      {
        step: "02",
        title: "Develop Ideas Into Drafts",
        description:
          "Turn each raw note into structured Threads drafts using clear post goals, angles, and opening hooks."
      },
      {
        step: "03",
        title: "Curate Library and Schedule",
        description:
          "Save approved drafts in your Content Library and schedule them across upcoming time slots."
      }
    ],
    sectionsHeading: "Structured Planning for Meta Threads Creators",
    sectionsIntro:
      "Move cleanly from rough creator notes to organized themes and ready-to-publish drafts.",
    features: [
      {
        heading: "Content Pillars and Topic Organization",
        body:
          "Define core content pillars aligned with your expertise so you can balance Attention, Trust, and Sales posts intentionally across the week.",
        highlights: [
          "Filter drafting around an active content pillar whenever needed",
          "Refresh or refine individual pillars as your topics evolve",
          "Keep recurring themes distinct instead of repetitive"
        ]
      },
      {
        heading: "Raw Thought to Structured Post Draft",
        body:
          "Capture rough thoughts, lessons, or questions as they happen and expand them into single posts or multi-part threads without losing your original point.",
        highlights: [
          "Preserves your user-provided facts and personal perspective",
          "Pairs raw notes with fresh strategic angles and opening hooks",
          "Supports standalone observations as well as structured breakdowns"
        ]
      },
      {
        heading: "Private Content Library for Ready Drafts",
        body:
          "Store approved posts and multi-part threads in your private Content Library where you can edit copy, regenerate alternative takes, copy text, or schedule directly.",
        highlights: [
          "Edit titles, hooks, and individual thread parts anytime",
          "Send saved drafts straight to the Threads Scheduler",
          "Feeds recent library context to reduce duplicate phrasing in future drafts"
        ]
      }
    ],
    relatedLinks: [
      {
        path: "/ai-threads-post-generator",
        label: "AI Threads Post Generator",
        description: "Turn planned ideas into publishable single posts and threads."
      },
      {
        path: "/threads-hook-generator",
        label: "Threads Hook Generator",
        description: "Develop stronger opening hooks for each content idea."
      },
      {
        path: "/threads-scheduler",
        label: "Threads Scheduler",
        description: "Move saved library drafts onto your Meta Threads calendar."
      }
    ]
  },
  {
    path: "/pricing",
    outputFile: "pricing.html",
    navLabel: "Pricing",
    kind: "pricing",
    title: "ThreadsWorks Pricing — Free & Pro Creator Plans",
    description:
      "Compare ThreadsWorks Free and Pro plans for AI Threads post writing, hook tools, Content Library access, and Meta Threads scheduling.",
    priority: "0.8",
    changefreq: "weekly",
    platformNote: "Built for Meta Threads creators.",
    h1: "Simple Plans for Consistent Meta Threads Publishing",
    lead:
      "Start with the Free plan to use the AI Threads writer, hook tools, Content Library, and scheduler—no credit card required.",
    primaryCtaLabel: "START CREATING FREE",
    sectionsHeading: "What Is Included in Each Plan",
    sectionsIntro:
      "Verified feature allowances currently enforced inside ThreadsWorks.",
    features: [
      {
        heading: "Free Plan — $0 / month",
        body:
          "Core creator tools for writing, organizing, and scheduling on Meta Threads. Free forever with no credit card required.",
        highlights: [
          "150 AI content generations per month (room for 60+ finished posts plus hook explorations and revisions)",
          "5 scheduled Meta Threads posts per day",
          "Direct 1-click Meta Threads publishing via official OAuth",
          "Core Voice & DNA profile configuration",
          "Full Content Library and Calendar access"
        ]
      },
      {
        heading: "Pro Plan — $7 / month or $59 / year",
        body:
          "Built for active Meta Threads creators who want unlimited AI generations and unlimited daily scheduling.",
        highlights: [
          "Unlimited AI content generation",
          "Unlimited scheduled Meta Threads posts",
          "Full multi-part thread synthesis and optimization workflow",
          "Creator profile context matching and editorial queue",
          "Billing managed directly inside your account"
        ]
      }
    ],
    faqs: [
      {
        question: "Do I need a credit card to use the Free plan?",
        answer:
          "No. You can create a Free account and use the AI Threads writer, hook tools, Content Library, and Meta Threads scheduler without entering payment information."
      },
      {
        question: "Can I upgrade or manage my subscription later?",
        answer:
          "Yes. Authenticated users can upgrade to Pro or manage billing directly inside ThreadsWorks."
      }
    ],
    relatedLinks: [
      {
        path: "/",
        label: "ThreadsWorks Overview",
        description: "See how every part of the Meta Threads workflow fits together."
      },
      {
        path: "/ai-threads-post-generator",
        label: "AI Threads Post Generator",
        description: "Learn how voice-grounded post and thread writing works."
      },
      {
        path: "/threads-scheduler",
        label: "Threads Scheduler",
        description: "Explore the Meta Threads content calendar and automated publishing."
      }
    ]
  },
  {
    path: "/privacy",
    outputFile: "privacy.html",
    navLabel: "Privacy",
    kind: "legal",
    title: "Privacy Policy | ThreadsWorks",
    description:
      "Read the ThreadsWorks Privacy Policy covering Meta Threads OAuth permissions, token security, data retention, and account deletion.",
    priority: "0.4",
    changefreq: "monthly",
    platformNote: "Public compliance document.",
    h1: "ThreadsWorks Privacy Policy",
    lead:
      "This Privacy Policy explains how ThreadsWorks collects, protects, uses, and deletes account and Meta Threads integration data in accordance with Meta Developer Platform Policies and applicable privacy standards.",
    primaryCtaLabel: "Sign In",
    sectionsHeading: "Privacy and Data Handling Guidelines",
    sectionsIntro:
      "Hosted natively at https://threadsworks.com/privacy for creators and Meta platform compliance verification.",
    features: [
      {
        heading: "1. Introduction and Scope",
        body:
          "ThreadsWorks (\"we\", \"our\", \"us\") values your privacy. This Privacy Policy outlines our operational guidelines regarding the processing, security, and lifecycle of user data in connection with our Meta Threads content creation and publishing services, established to satisfy Meta General Developer Terms and California Consumer Privacy Act (CCPA) transparency requirements."
      },
      {
        heading: "2. Categories of Information We Process",
        body:
          "To operate ThreadsWorks as a writing and scheduling workspace for Meta Threads, we process the following categories of data only after you register or authorize access via the official Meta OAuth dialog:",
        highlights: [
          "Meta Access Tokens: Short-lived and long-lived user access tokens requested via authorized Meta Threads scopes such as threads_basic and threads_content_publish.",
          "Public Profile Attributes: Your Threads identifier, active Threads username, profile picture URL, and biography details.",
          "Creator Workspace Content: Draft posts, ideas, voice preferences, and scheduled items you save inside your private ThreadsWorks workspace.",
          "Account Authentication Details: Login email and Firebase Authentication identifiers needed to secure your account."
        ]
      },
      {
        heading: "3. Direct Data Usage Guidelines",
        body:
          "Your account information is processed strictly to provide authorized ThreadsWorks workspace capabilities:",
        highlights: [
          "We NEVER sell, rent, lease, trade, or distribute your account information, connected tokens, or saved drafts to advertising networks or third-party data brokers.",
          "Meta Threads user access tokens are stored in user-scoped server-protected Firestore records and used strictly on the backend for user-authorized container creation (/threads) and publishing (/threads_publish) requests."
        ]
      },
      {
        heading: "4. User Data Deletion Instructions (Meta Section 3(d)(i))",
        body:
          "You may purge connected Meta Threads profiles and stored access tokens at any time using any of the following procedures:",
        highlights: [
          "Option A — Native In-App Disconnection: Open Settings inside your ThreadsWorks workspace, go to the Threads Connection card, and click \"Disconnect Threads\" to immediately delete your stored connection and token documents.",
          "Option B — Meta Platform Revocation: Visit your Meta Threads account settings, open Developer App Permissions, and remove ThreadsWorks.",
          "Option C — Direct Email Deletion Support: Email henkedouglas1@gmail.com with the subject line \"ThreadsWorks Data Deletion Request\" for manual account and token removal within 48 hours."
        ]
      },
      {
        heading: "5. Data Retention and Security Precautions",
        body:
          "Long-lived Meta access tokens expire automatically after 90 days unless refreshed by the user. Stale connection records are removed during routine maintenance. Workspace data is protected by strict user-scoped Firebase security rules, and Meta credentials remain server-side rather than exposed to client browsers. Last revised: June 22, 2026."
      }
    ],
    relatedLinks: [
      {
        path: "/terms",
        label: "Terms of Service",
        description: "Review platform usage terms and Meta Threads API responsibilities."
      },
      {
        path: "/",
        label: "ThreadsWorks Home",
        description: "Return to the ThreadsWorks product overview."
      }
    ]
  },
  {
    path: "/terms",
    outputFile: "terms.html",
    navLabel: "Terms",
    kind: "legal",
    title: "Terms of Service | ThreadsWorks",
    description:
      "Read the ThreadsWorks Terms of Service covering account usage, Meta Threads API compliance, content ownership, and service terms.",
    priority: "0.4",
    changefreq: "monthly",
    platformNote: "Public compliance document.",
    h1: "ThreadsWorks Terms of Service",
    lead:
      "These Terms of Service govern your access to and use of the ThreadsWorks web application and Meta Threads publishing integrations.",
    primaryCtaLabel: "Sign In",
    sectionsHeading: "Terms and Platform Responsibilities",
    sectionsIntro:
      "Hosted natively at https://threadsworks.com/terms for creators and Meta platform compliance verification.",
    features: [
      {
        heading: "1. Binding Agreement",
        body:
          "By registering an account and connecting your Meta Threads profile with ThreadsWorks (\"Service\"), you agree to use the Service in accordance with these Terms of Service. If you do not agree to these terms, discontinue use of the Service immediately."
      },
      {
        heading: "2. Authorized API Usage and Content Standards",
        body:
          "ThreadsWorks publishes user-authored drafts to the Meta Threads network on your behalf through official Meta Graph APIs. All users agree to:",
        highlights: [
          "Ensure all submitted content complies with the Threads Terms of Use, Meta Developers Platform Regulations, and Meta Community Standards.",
          "Refrain from automated spam, abusive bot operations, deceptive phishing, or copyright-infringing publications.",
          "Maintain sole responsibility for all drafts, statements, replies, and links published through their authorized profile."
        ]
      },
      {
        heading: "3. Workspace and Access Token Responsibilities",
        body:
          "To use draft synchronization and scheduled publishing features, you must authenticate through the official Meta OAuth gateway. You are responsible for safeguarding your workspace login credentials and managing authorized connections on your Threads account."
      },
      {
        heading: "4. Disclaimers and Limits of Liability",
        body:
          "ThreadsWorks provides its capabilities \"AS IS\" and \"AS AVAILABLE\" without warranties of any kind, express or implied. We do not guarantee uninterrupted availability of third-party Meta APIs, token longevity, or third-party platform policy continuity. To the maximum extent permitted by law, ThreadsWorks shall not be liable for indirect, incidental, or consequential damages resulting from API changes, connectivity interruptions, or third-party account actions."
      },
      {
        heading: "5. Termination, Disconnection, and Contact",
        body:
          "We reserve the right to suspend accounts that engage in abusive spam, violate Meta platform standards, or attempt to compromise application security. You may disconnect your Meta Threads profile and request data deletion at any time as outlined in our Privacy Policy. For legal or support inquiries, contact henkedouglas1@gmail.com. Last revised: June 22, 2026."
      }
    ],
    relatedLinks: [
      {
        path: "/privacy",
        label: "Privacy Policy",
        description: "Learn how ThreadsWorks handles Meta OAuth tokens and user data."
      },
      {
        path: "/",
        label: "ThreadsWorks Home",
        description: "Return to the ThreadsWorks product overview."
      }
    ]
  }
];

export const HEADER_NAV_ROUTES: PublicMarketingRoute[] = PUBLIC_MARKETING_ROUTES.filter((r) =>
  ["/productworks", "/ai-threads-post-generator", "/threads-scheduler", "/content-ideas", "/pricing"].includes(
    r.path
  )
);

/**
 * Private/authenticated application paths disallowed in robots.txt and marked noindex.
 * Authorization is enforced by Firebase Auth and server checks; robots directives prevent
 * search engines from indexing login-gated application shells.
 */
export const DISALLOWED_APP_PATHS: string[] = [
  "/api/",
  "/workspace",
  "/apps",
  "/dashboard",
  "/create",
  "/calendar",
  "/content-calendar",
  "/schedule",
  "/analytics",
  "/threads-analytics",
  "/profile",
  "/creator-profile",
  "/content-profile",
  "/my-identity",
  "/my-business",
  "/saved-content",
  "/settings",
  "/partner",
  "/partner-hub",
  "/influencers",
  "/influencer",
  "/preview"
];

export function normalizeMarketingPath(rawPath: string): string {
  if (!rawPath || rawPath === "/") return "/";
  const clean = rawPath.split("?")[0].split("#")[0].replace(/\/+$/, "");
  return clean === "" ? "/" : clean;
}

export function getPublicMarketingRoute(rawPath: string): PublicMarketingRoute | null {
  const normalized = normalizeMarketingPath(rawPath);
  return PUBLIC_MARKETING_ROUTES.find((r) => r.path === normalized) || null;
}

export function isPublicMarketingPath(rawPath: string): boolean {
  return getPublicMarketingRoute(rawPath) !== null;
}

export function getCanonicalUrl(path: string, origin: string = SITE_ORIGIN): string {
  const normalized = normalizeMarketingPath(path);
  return normalized === "/" ? `${origin}/` : `${origin}${normalized}`;
}

/**
 * Builds verifiable, accurate Schema.org JSON-LD objects for a public marketing route.
 * Contains zero invented ratings, reviews, awards, prices, or performance statistics.
 */
export function buildStructuredDataForRoute(route: PublicMarketingRoute): Record<string, any>[] {
  const canonicalUrl = getCanonicalUrl(route.path);

  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_ORIGIN}/#organization`,
    name: "ContentPaysUs & ThreadsWorks",
    alternateName: ["ThreadsWorks", "ContentPaysUs"],
    url: `${SITE_ORIGIN}/`,
    logo: {
      "@type": "ImageObject",
      url: DEFAULT_LOGO_URL
    }
  };

  const webSite = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_ORIGIN}/#website`,
    name: "ThreadsWorks & ContentPaysUs",
    url: `${SITE_ORIGIN}/`,
    description:
      "The AI-powered creator business ecosystem at ThreadsWorks.com—home of ThreadsWorks for Meta Threads writing and scheduling and the expanding ContentPaysUs platform.",
    publisher: {
      "@id": `${SITE_ORIGIN}/#organization`
    }
  };

  const softwareApplication = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${SITE_ORIGIN}/#software`,
    name: SITE_NAME,
    url: `${SITE_ORIGIN}/`,
    applicationCategory: "SocialNetworkingApplication",
    operatingSystem: "Web",
    description:
      "ThreadsWorks is an AI Threads writer and scheduler for Meta Threads creators—combining Attention, Trust, and Sales post goals, strategic angles, locked opening hooks, a Content Library, and automated Meta Threads scheduling.",
    featureList: [
      "AI Threads writer for single posts and multi-part threads",
      "Attention, Trust, and Sales post goals with rotating writing angles",
      "Strategic angle and Meta Threads hook generation with hook locking",
      "Voice-preserved drafting with relevance-gated business context",
      "Private Content Library for editing and organizing drafts",
      "Visual Meta Threads content calendar and automated scheduling via official Meta OAuth"
    ],
    publisher: {
      "@id": `${SITE_ORIGIN}/#organization`
    }
  };

  if (route.path === "/") {
    return [organization, webSite, softwareApplication];
  }

  const webPage: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${canonicalUrl}#webpage`,
    name: route.title,
    description: route.description,
    url: canonicalUrl,
    isPartOf: {
      "@id": `${SITE_ORIGIN}/#website`
    }
  };

  if (route.kind === "feature" || route.kind === "pricing") {
    return [webPage, softwareApplication, organization];
  }

  return [webPage, organization];
}

export function buildSitemapXml(lastModDate?: string): string {
  const dateStr = lastModDate || new Date().toISOString().split("T")[0];
  const entries = PUBLIC_MARKETING_ROUTES.map(
    (route) => `  <url>
    <loc>${getCanonicalUrl(route.path)}</loc>
    <lastmod>${dateStr}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`
  ).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;
}

export function buildRobotsTxt(): string {
  const disallows = DISALLOWED_APP_PATHS.map((p) => `Disallow: ${p}`).join("\n");
  return `User-agent: *
Allow: /
${disallows}

Sitemap: ${SITE_ORIGIN}/sitemap.xml
`;
}
