import type { AppAvailabilityStatus } from "./contentPaysUsRegistry";

export type ToolExecutionMode = "ai_generator" | "operational" | "hybrid";
export type ToolExportFormat = "txt" | "md" | "html" | "json" | "csv";
export type IntelligenceDomain =
  | "identity"
  | "business"
  | "audience"
  | "projects"
  | "content"
  | "performance"
  | "products";

export interface ToolInputField {
  key: string;
  label: string;
  type: "text" | "textarea" | "select";
  placeholder: string;
  options?: string[];
}

export interface ToolOutputField {
  key: string;
  label: string;
}

export interface EcosystemToolDefinition {
  appId: string;
  toolId: string;
  name: string;
  intent: string;
  mode: ToolExecutionMode;
  availability: AppAvailabilityStatus;
  availabilityNote?: string;
  requiredInputs: ToolInputField[];
  optionalInputs: ToolInputField[];
  autoContextDomains: IntelligenceDomain[];
  aiInstructions: string;
  outputSchema: ToolOutputField[];
  editingActions: Array<"inline_edit" | "regenerate" | "tighten" | "expand">;
  exportFormats: ToolExportFormat[];
  connectedApps: string[];
  requiredPermissions: Array<"authenticated" | "owner">;
  entitlements: "free_and_pro" | "pro_recommended";
  usageLimit: "monthly_ai_quota" | "unlimited_operational";
  provenanceDefault: "user_provided_fact" | "ai_hypothesis" | "recommendation";
  acceptanceCriteria: string;
}

const STANDARD_AI_EDIT_ACTIONS: Array<"inline_edit" | "regenerate" | "tighten" | "expand"> = [
  "inline_edit",
  "regenerate",
  "tighten",
  "expand"
];

const STANDARD_TEXT_EXPORTS: ToolExportFormat[] = ["md", "txt", "html", "json"];

const BASE_GROUNDING_RULE =
  "Use neutral, evidence-based, practical phrasing without hype or assumptions about pain. Never invent statistics, testimonials, prices, or external URLs unless explicitly provided in the user inputs or shared creator context.";

function makeAiTool(
  partial: Omit<
    EcosystemToolDefinition,
    "mode" | "editingActions" | "exportFormats" | "requiredPermissions" | "entitlements" | "usageLimit"
  > & {
    mode?: ToolExecutionMode;
    exportFormats?: ToolExportFormat[];
    entitlements?: "free_and_pro" | "pro_recommended";
  }
): EcosystemToolDefinition {
  return {
    mode: partial.mode || "ai_generator",
    editingActions: STANDARD_AI_EDIT_ACTIONS,
    exportFormats: partial.exportFormats || STANDARD_TEXT_EXPORTS,
    requiredPermissions: ["authenticated", "owner"],
    entitlements: partial.entitlements || "free_and_pro",
    usageLimit: "monthly_ai_quota",
    ...partial,
    aiInstructions: `${partial.aiInstructions} ${BASE_GROUNDING_RULE}`
  };
}

export const ECOSYSTEM_TOOL_REGISTRY: EcosystemToolDefinition[] = [
  // =========================================================================
  // 1. CREATORWORKS (11 Tools — Brand, Positioning & Voice)
  // =========================================================================
  makeAiTool({
    appId: "creatorworks",
    toolId: "brand_positioning",
    name: "Brand Positioning Blueprint",
    intent: "Define a sharp positioning statement, audience focus, and differentiated angle.",
    availability: "Available",
    requiredInputs: [
      { key: "expertise", label: "Core expertise or topic", type: "text", placeholder: "e.g. Digital product design for solo educators" },
      { key: "audience", label: "Who you help", type: "text", placeholder: "e.g. Independent coaches and writers" }
    ],
    optionalInputs: [
      { key: "differentiator", label: "What makes your approach distinct", type: "textarea", placeholder: "e.g. Practical templates over long video courses" }
    ],
    autoContextDomains: ["identity", "business", "audience"],
    aiInstructions: "Build a crisp personal brand positioning blueprint with a one-sentence positioning statement, ideal audience summary, category point of view, and 3 positioning anchors.",
    outputSchema: [
      { key: "positioningStatement", label: "Positioning Statement" },
      { key: "audienceFocus", label: "Audience Focus" },
      { key: "pointOfView", label: "Differentiated Point of View" },
      { key: "positioningAnchors", label: "Core Positioning Anchors" }
    ],
    connectedApps: ["demandworks", "offerworks", "contentworks", "threadsworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Generates editable positioning sections and allows saving approved brand fields to the shared creator profile."
  }),
  makeAiTool({
    appId: "creatorworks",
    toolId: "creator_bio_suite",
    name: "Creator Bio Suite",
    intent: "Generate concise bios tailored for Meta Threads, websites, and speaker/media intros.",
    availability: "Available",
    requiredInputs: [
      { key: "focus", label: "What you help people achieve", type: "text", placeholder: "e.g. Launch their first digital playbook in a weekend" }
    ],
    optionalInputs: [
      { key: "proof", label: "Verified background or credentials (optional)", type: "textarea", placeholder: "Only include real background facts you want mentioned" }
    ],
    autoContextDomains: ["identity", "business", "audience"],
    aiInstructions: "Draft a 150-character Threads bio, a short website bio, and a 3-sentence professional intro grounded strictly in stated facts.",
    outputSchema: [
      { key: "threadsBio", label: "Meta Threads Bio (Under 150 Chars)" },
      { key: "websiteBio", label: "Website About Blurb" },
      { key: "professionalIntro", label: "Short Professional Intro" }
    ],
    connectedApps: ["threadsworks", "funnelworks", "storeworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Produces copy-ready bios grounded only in verified profile details."
  }),
  makeAiTool({
    appId: "creatorworks",
    toolId: "audience_profile",
    name: "Target Audience Profile",
    intent: "Map your target reader's goals, vocabulary, decision criteria, and daily context.",
    availability: "Available",
    requiredInputs: [
      { key: "segment", label: "Audience segment", type: "text", placeholder: "e.g. Part-time creators building their first $500/mo offer" }
    ],
    optionalInputs: [
      { key: "observations", label: "Real questions you have heard from them", type: "textarea", placeholder: "Paste real replies or questions if available" }
    ],
    autoContextDomains: ["identity", "audience", "content"],
    aiInstructions: "Create a structured audience profile covering goals, everyday vocabulary, buying criteria, and clear distinction between observed facts and hypotheses to validate.",
    outputSchema: [
      { key: "audienceSummary", label: "Audience Profile Summary" },
      { key: "desiredOutcomes", label: "Key Outcomes They Value" },
      { key: "decisionCriteria", label: "What Builds Trust & Buying Confidence" },
      { key: "hypothesesToValidate", label: "Hypotheses to Verify With Real Conversations" }
    ],
    connectedApps: ["demandworks", "offerworks", "contentworks"],
    provenanceDefault: "ai_hypothesis",
    acceptanceCriteria: "Separates stated facts from hypotheses to verify and transfers cleanly to DemandWorks."
  }),
  makeAiTool({
    appId: "creatorworks",
    toolId: "voice_guidelines",
    name: "Brand Voice & Tone Guidelines",
    intent: "Codify how you write—sentence rhythm, preferred phrases, and words to avoid.",
    availability: "Available",
    requiredInputs: [
      { key: "styleSamples", label: "Sample lines or style preferences", type: "textarea", placeholder: "Paste 2-3 lines you wrote or describe your natural cadence" }
    ],
    optionalInputs: [
      { key: "wordsToAvoid", label: "Words or clichés to avoid", type: "text", placeholder: "e.g. game-changer, unlock, 10x" }
    ],
    autoContextDomains: ["identity", "content"],
    aiInstructions: "Distill a clear, actionable voice guide covering tone traits, sentence structure rules, phrases to lean into, and guardrails to keep every AI draft sounding human.",
    outputSchema: [
      { key: "voiceSummary", label: "Voice & Cadence Summary" },
      { key: "doGuidelines", label: "Writing Habits to Keep" },
      { key: "avoidList", label: "Words & Patterns to Avoid" },
      { key: "sampleRewrite", label: "Example On-Voice Paragraph" }
    ],
    connectedApps: ["threadsworks", "contentworks", "productworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Outputs voice rules that can be synced straight into the creator profile."
  }),
  makeAiTool({
    appId: "creatorworks",
    toolId: "value_proposition",
    name: "Core Value Proposition Builder",
    intent: "Articulate the measurable mechanism and practical gain behind your work.",
    availability: "Available",
    requiredInputs: [
      { key: "whatYouBuild", label: "What you teach, create, or offer", type: "text", placeholder: "e.g. Step-by-step product launch playbooks" },
      { key: "mechanism", label: "How it works", type: "textarea", placeholder: "e.g. Breaks a launch into 5 daily checklists" }
    ],
    optionalInputs: [],
    autoContextDomains: ["identity", "business", "audience"],
    aiInstructions: "Craft a transparent value proposition explaining who it serves, the practical mechanism, and three concrete reasons buyers care.",
    outputSchema: [
      { key: "headline", label: "Core Value Headline" },
      { key: "mechanism", label: "How Your Approach Works" },
      { key: "proofPoints", label: "Practical Value Drivers" }
    ],
    connectedApps: ["offerworks", "funnelworks", "salesworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Generates clear value proposition sections transferable to OfferWorks."
  }),
  makeAiTool({
    appId: "creatorworks",
    toolId: "origin_story",
    name: "Creator Origin Story Framework",
    intent: "Shape your authentic background into a clear, relatable story without melodrama.",
    availability: "Available",
    requiredInputs: [
      { key: "startingPoint", label: "Where your work started", type: "textarea", placeholder: "Share real milestones or turning points" },
      { key: "presentMission", label: "What you focus on today", type: "text", placeholder: "e.g. Helping independent specialists package their knowledge" }
    ],
    optionalInputs: [],
    autoContextDomains: ["identity", "business"],
    aiInstructions: "Draft a grounded creator origin story in 3 formats (short intro, full About narrative, and 3-part Threads story arc) using only facts supplied by the creator.",
    outputSchema: [
      { key: "shortVersion", label: "Short Origin Story (3 Sentences)" },
      { key: "aboutNarrative", label: "Full About Page Narrative" },
      { key: "threadsStoryArc", label: "3-Part Meta Threads Story Arc" }
    ],
    connectedApps: ["threadsworks", "funnelworks", "communityworks"],
    provenanceDefault: "user_provided_fact",
    acceptanceCriteria: "Uses strictly user-supplied milestones with zero invented biography."
  }),
  makeAiTool({
    appId: "creatorworks",
    toolId: "messaging_pillars",
    name: "Messaging Pillars & Themes",
    intent: "Define 4-5 core beliefs and recurring message pillars across your brand.",
    availability: "Available",
    requiredInputs: [
      { key: "coreTopic", label: "Primary brand domain", type: "text", placeholder: "e.g. Independent creator monetization" }
    ],
    optionalInputs: [
      { key: "principles", label: "Key principles you stand by", type: "textarea", placeholder: "List 2-4 principles you emphasize" }
    ],
    autoContextDomains: ["identity", "business", "audience"],
    aiInstructions: "Create 4 distinct messaging pillars with core claim, practical takeaway, and example content angle for each.",
    outputSchema: [
      { key: "pillarsOverview", label: "4 Core Messaging Pillars" },
      { key: "signatureBeliefs", label: "Signature Point-of-View Statements" },
      { key: "topicBoundaries", label: "Topics to Focus On vs. Skip" }
    ],
    connectedApps: ["contentworks", "threadsworks", "offerworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Transfers directly into ContentWorks pillar architecture."
  }),
  makeAiTool({
    appId: "creatorworks",
    toolId: "brand_manifesto",
    name: "Brand Manifesto & Mission Statement",
    intent: "Write a clear, grounded mission statement and guiding principles.",
    availability: "Available",
    requiredInputs: [
      { key: "mission", label: "What change or outcome you champion", type: "textarea", placeholder: "e.g. Helping everyday experts earn from practical digital guides" }
    ],
    optionalInputs: [],
    autoContextDomains: ["identity", "business"],
    aiInstructions: "Write a concise mission statement, 5 operating principles, and a short manifesto free of hype.",
    outputSchema: [
      { key: "missionStatement", label: "One-Sentence Mission Statement" },
      { key: "principles", label: "5 Operating Principles" },
      { key: "manifesto", label: "Short Brand Manifesto" }
    ],
    connectedApps: ["threadsworks", "communityworks", "funnelworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Produces editable mission copy ready for profile sync or publishing."
  }),
  makeAiTool({
    appId: "creatorworks",
    toolId: "tagline_generator",
    name: "Tagline & Headline Lab",
    intent: "Generate clear, memorable taglines and subheadlines for your creator brand.",
    availability: "Available",
    requiredInputs: [
      { key: "outcome", label: "Primary customer outcome", type: "text", placeholder: "e.g. Turn weekly notes into sellable playbooks" }
    ],
    optionalInputs: [],
    autoContextDomains: ["identity", "business", "audience"],
    aiInstructions: "Produce 3 clear tagline variants paired with matching subheadlines—direct, human, and free of corporate clichés.",
    outputSchema: [
      { key: "taglines", label: "3 Tagline & Subheadline Pairs" },
      { key: "usageGuidance", label: "Where to Use Each Variant" }
    ],
    connectedApps: ["funnelworks", "storeworks", "threadsworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Returns exactly 3 concise variants with clear rationale."
  }),
  makeAiTool({
    appId: "creatorworks",
    toolId: "visual_direction",
    name: "Visual Identity Brief",
    intent: "Define color palette direction, typography tone, and layout rules for your brand assets.",
    availability: "Available",
    requiredInputs: [
      { key: "aesthetic", label: "Preferred brand feel", type: "select", placeholder: "Select feel", options: ["Editorial & Clean", "Warm & Approachable", "Minimal & Technical", "Bold & Modern"] }
    ],
    optionalInputs: [
      { key: "notes", label: "Colors or references you like", type: "text", placeholder: "e.g. Slate neutrals with indigo accent" }
    ],
    autoContextDomains: ["identity", "business"],
    aiInstructions: "Build a practical visual identity brief with palette hex suggestions, typography pairing notes, and carousel/PDF styling guidance.",
    outputSchema: [
      { key: "palette", label: "Color Palette Direction" },
      { key: "typography", label: "Typography & Hierarchy Rules" },
      { key: "assetGuidelines", label: "PDF & Carousel Styling Guidelines" }
    ],
    connectedApps: ["productworks", "storeworks", "funnelworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Generates actionable styling direction usable across ProductWorks and StoreWorks."
  }),
  makeAiTool({
    appId: "creatorworks",
    toolId: "niche_clarity",
    name: "Niche & Category Clarity Audit",
    intent: "Tighten broad interests into a clear, commercially viable creator focus.",
    availability: "Available",
    requiredInputs: [
      { key: "interests", label: "Skills, topics, or experience areas", type: "textarea", placeholder: "List 2-5 areas you know well" }
    ],
    optionalInputs: [],
    autoContextDomains: ["identity", "business", "audience"],
    aiInstructions: "Recommend 3 focused niche intersections with audience clarity, starter product fit, and first validation step.",
    outputSchema: [
      { key: "recommendedFocuses", label: "3 Focused Niche Options" },
      { key: "starterProductFit", label: "Starter Product Fit" },
      { key: "validationNextStep", label: "Fastest Real-World Validation Step" }
    ],
    connectedApps: ["demandworks", "offerworks"],
    provenanceDefault: "ai_hypothesis",
    acceptanceCriteria: "Labels niche suggestions as hypotheses and links to DemandWorks for validation."
  }),

  // =========================================================================
  // 2. DEMANDWORKS (8 Tools — Buyer Research & Validation)
  // =========================================================================
  makeAiTool({
    appId: "demandworks",
    toolId: "problem_discovery",
    name: "Buyer Problem Hypothesis Map",
    intent: "Identify concrete buyer problems to test with real audience conversations.",
    availability: "Available",
    requiredInputs: [
      { key: "topic", label: "Market or audience domain", type: "text", placeholder: "e.g. Freelance designers pitching retainers" }
    ],
    optionalInputs: [
      { key: "observedEvidence", label: "Real quotes or questions you already collected", type: "textarea", placeholder: "Optional: paste verbatim audience questions" }
    ],
    autoContextDomains: ["identity", "audience", "business"],
    aiInstructions: "List 5 concrete buyer problems, explicitly separating any user-provided observations from AI hypotheses that must be validated with real people.",
    outputSchema: [
      { key: "verifiedObservations", label: "Documented Observations (From Your Inputs)" },
      { key: "problemHypotheses", label: "AI Problem Hypotheses to Validate" },
      { key: "validationQuestions", label: "Direct Questions to Ask Real People" }
    ],
    connectedApps: ["offerworks", "productworks", "contentworks"],
    provenanceDefault: "ai_hypothesis",
    acceptanceCriteria: "Explicitly labels AI hypotheses vs. user-provided evidence; never fabricates customer quotes."
  }),
  makeAiTool({
    appId: "demandworks",
    toolId: "question_finder",
    name: "Audience Question Inventory",
    intent: "Map high-intent buyer questions across beginner, active, and ready-to-buy stages.",
    availability: "Available",
    requiredInputs: [
      { key: "topic", label: "Core subject", type: "text", placeholder: "e.g. Getting your first digital product sale" }
    ],
    optionalInputs: [],
    autoContextDomains: ["audience", "content"],
    aiInstructions: "Generate structured buyer questions grouped by awareness stage and indicate which questions make strong Threads posts vs. paid products.",
    outputSchema: [
      { key: "discoveryQuestions", label: "Early Awareness Questions" },
      { key: "evaluationQuestions", label: "Decision & Comparison Questions" },
      { key: "productOpportunities", label: "Questions Pointing to Paid Products" }
    ],
    connectedApps: ["contentworks", "threadsworks", "offerworks"],
    provenanceDefault: "ai_hypothesis",
    acceptanceCriteria: "Creates categorized question lists clearly labeled as research hypotheses."
  }),
  makeAiTool({
    appId: "demandworks",
    toolId: "opportunity_scorer",
    name: "Demand Opportunity Brief",
    intent: "Evaluate a product idea across clarity, urgency, willingness to pay, and delivery speed.",
    availability: "Available",
    requiredInputs: [
      { key: "idea", label: "Product or service idea", type: "textarea", placeholder: "Describe the offer idea you want to test" }
    ],
    optionalInputs: [
      { key: "evidence", label: "Evidence collected so far", type: "textarea", placeholder: "Replies, DMs, interviews, or pre-orders" }
    ],
    autoContextDomains: ["business", "audience", "products"],
    aiInstructions: "Evaluate the idea qualitatively across urgency, clarity of outcome, audience reach, and fastest MVP test. Explicitly flag missing real-world evidence rather than inventing market size numbers.",
    outputSchema: [
      { key: "strengths", label: "Clear Strengths" },
      { key: "evidenceGaps", label: "Missing Real-World Evidence" },
      { key: "mvpTestPlan", label: "7-Day Low-Risk Validation Test" }
    ],
    connectedApps: ["offerworks", "productworks", "salesworks"],
    provenanceDefault: "ai_hypothesis",
    acceptanceCriteria: "Flags missing evidence honestly without fabricating market size stats."
  }),
  makeAiTool({
    appId: "demandworks",
    toolId: "interview_script",
    name: "Customer Discovery Interview Guide",
    intent: "Create non-leading questions for 15-minute buyer discovery calls.",
    availability: "Available",
    requiredInputs: [
      { key: "problemArea", label: "Problem area to explore", type: "text", placeholder: "e.g. Scheduling consistent weekly content" }
    ],
    optionalInputs: [],
    autoContextDomains: ["audience", "business"],
    aiInstructions: "Write a 15-minute discovery interview guide with opening framing, past-behavior questions (not leading hypotheticals), and a respectful closing.",
    outputSchema: [
      { key: "opener", label: "Warm Opening Script" },
      { key: "coreQuestions", label: "Non-Leading Discovery Questions" },
      { key: "noteTakingChecklist", label: "What to Listen & Log" }
    ],
    connectedApps: ["meetingworks", "salesworks", "offerworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Ready to transfer straight into a MeetingWorks call agenda."
  }),
  makeAiTool({
    appId: "demandworks",
    toolId: "validation_survey",
    name: "Audience Validation Survey Builder",
    intent: "Draft a concise 5-question survey to gather real buyer language.",
    availability: "Available",
    requiredInputs: [
      { key: "goal", label: "What you want to learn", type: "text", placeholder: "e.g. Which starter template people need most" }
    ],
    optionalInputs: [],
    autoContextDomains: ["audience", "business"],
    aiInstructions: "Build a crisp 5-question survey (mix of multiple-choice and short-answer) plus a Threads/email invitation post to collect real responses.",
    outputSchema: [
      { key: "surveyQuestions", label: "5 Validation Survey Questions" },
      { key: "invitePost", label: "Short Invitation Copy" },
      { key: "interpretationGuide", label: "How to Read Responses" }
    ],
    connectedApps: ["threadsworks", "funnelworks", "communityworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Produces concise survey questions and a companion invite post."
  }),
  makeAiTool({
    appId: "demandworks",
    toolId: "research_report",
    name: "Buyer Research Synthesis Report",
    intent: "Synthesize your real customer notes, DMs, and interview transcripts into structured takeaways.",
    availability: "Available",
    requiredInputs: [
      { key: "rawNotes", label: "Paste your real notes, DMs, or interview transcripts", type: "textarea", placeholder: "Paste actual audience comments or call notes here" }
    ],
    optionalInputs: [],
    autoContextDomains: ["audience", "projects"],
    aiInstructions: "Synthesize ONLY the real notes supplied by the user into recurring themes, exact customer phrases, and product/content recommendations. Never add unstated quotes.",
    outputSchema: [
      { key: "recurringThemes", label: "Recurring Themes (From Your Notes)" },
      { key: "exactLanguage", label: "Verbatim Buyer Phrases" },
      { key: "recommendedActions", label: "Product & Content Recommendations" }
    ],
    connectedApps: ["offerworks", "productworks", "contentworks", "salesworks"],
    provenanceDefault: "user_provided_fact",
    acceptanceCriteria: "Extracts real buyer language strictly from pasted user notes."
  }),
  makeAiTool({
    appId: "demandworks",
    toolId: "competitor_gap_notes",
    name: "Alternative & Gap Analysis Worksheet",
    intent: "Compare existing options your buyers try today and spot clear differentiation angles.",
    availability: "Available",
    requiredInputs: [
      { key: "alternatives", label: "Existing alternatives buyers use today", type: "textarea", placeholder: "e.g. Free YouTube videos, spreadsheets, expensive agencies" }
    ],
    optionalInputs: [],
    autoContextDomains: ["business", "audience"],
    aiInstructions: "Analyze the listed alternatives neutrally—what each does well, where creators can offer a clearer/faster practical outcome, and positioning angles.",
    outputSchema: [
      { key: "alternativesSummary", label: "How Current Alternatives Compare" },
      { key: "differentiationAngles", label: "Practical Differentiation Opportunities" },
      { key: "positioningTakeaways", label: "Clear Messaging Takeaways" }
    ],
    connectedApps: ["offerworks", "salesworks"],
    provenanceDefault: "ai_hypothesis",
    acceptanceCriteria: "Compares stated alternatives objectively without fabricating competitor data."
  }),
  makeAiTool({
    appId: "demandworks",
    toolId: "live_market_scrape",
    name: "Automated Live Web Trend Monitor",
    intent: "Continuously scrape external forums and live search volume feeds.",
    availability: "In Development",
    availabilityNote: "Live external market-feed scraping requires an authorized third-party search/trend API integration not yet configured in this environment.",
    requiredInputs: [{ key: "keyword", label: "Keyword", type: "text", placeholder: "e.g. creator templates" }],
    optionalInputs: [],
    autoContextDomains: ["audience"],
    aiInstructions: "Gated external feature.",
    outputSchema: [{ key: "status", label: "Integration Status" }],
    connectedApps: ["offerworks"],
    provenanceDefault: "ai_hypothesis",
    acceptanceCriteria: "Explicitly marked In Development and blocked from simulating fake live search metrics."
  }),

  // =========================================================================
  // 3. OFFERWORKS (11 Tools — Clear, Buyable Offers)
  // =========================================================================
  makeAiTool({
    appId: "offerworks",
    toolId: "core_offer_builder",
    name: "Core Offer Blueprint",
    intent: "Structure the promise, scope, deliverables, ideal buyer, and timeline of your offer.",
    availability: "Available",
    requiredInputs: [
      { key: "offerIdea", label: "Offer concept", type: "textarea", placeholder: "e.g. A $29 PDF playbook + template pack for first-time course creators" },
      { key: "buyerOutcome", label: "Specific buyer outcome", type: "text", placeholder: "e.g. Publish a clear mini-course syllabus in 48 hours" }
    ],
    optionalInputs: [
      { key: "price", label: "Intended price (optional)", type: "text", placeholder: "e.g. $29" }
    ],
    autoContextDomains: ["identity", "business", "audience", "products"],
    aiInstructions: "Create a structured, honest offer blueprint including offer name options, clear promise, concrete deliverables, who it is for/not for, and delivery format. Only include a price if supplied.",
    outputSchema: [
      { key: "offerNameOptions", label: "3 Clear Offer Title Options" },
      { key: "corePromise", label: "Core Promise & Scope" },
      { key: "deliverables", label: "Exact Deliverables Breakdown" },
      { key: "fitCriteria", label: "Who It Is For & Not For" }
    ],
    connectedApps: ["productworks", "funnelworks", "salesworks", "storeworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Produces structured editable offer sections ready to launch in ProductWorks or StoreWorks."
  }),
  makeAiTool({
    appId: "offerworks",
    toolId: "pricing_tiers",
    name: "Pricing & Tier Architecture",
    intent: "Design transparent starter, core, and premium options with clear value progression.",
    availability: "Available",
    requiredInputs: [
      { key: "baseOffer", label: "Your base product or service", type: "text", placeholder: "e.g. Playbook + implementation templates" }
    ],
    optionalInputs: [
      { key: "priceRange", label: "Target price range (optional)", type: "text", placeholder: "e.g. $19 to $149" }
    ],
    autoContextDomains: ["business", "audience", "products"],
    aiInstructions: "Outline a 3-tier packaging structure (Starter, Core, Premium) explaining what differentiates each tier clearly and honestly.",
    outputSchema: [
      { key: "tierStructure", label: "3-Tier Offer Breakdown" },
      { key: "pricingRationale", label: "Transparent Pricing Rationale" },
      { key: "upgradePath", label: "Natural Upgrade Path" }
    ],
    connectedApps: ["storeworks", "salesworks", "funnelworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Outputs clear tier packaging without fake scarcity."
  }),
  makeAiTool({
    appId: "offerworks",
    toolId: "deliverables_stack",
    name: "Deliverables & Asset Checklist",
    intent: "Break your offer into concrete, buildable files, templates, and walkthroughs.",
    availability: "Available",
    requiredInputs: [
      { key: "offerSummary", label: "Offer summary", type: "textarea", placeholder: "Describe what the buyer receives" }
    ],
    optionalInputs: [],
    autoContextDomains: ["business", "products"],
    aiInstructions: "List the core deliverable, supporting quick-start assets, and an execution checklist to build the offer quickly.",
    outputSchema: [
      { key: "coreDeliverables", label: "Core Deliverables List" },
      { key: "quickWinAssets", label: "Quick-Win Companion Assets" },
      { key: "buildOrder", label: "Recommended Build Sequence" }
    ],
    connectedApps: ["productworks", "deliveryworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Transfers cleanly to ProductWorks for asset creation."
  }),
  makeAiTool({
    appId: "offerworks",
    toolId: "lead_magnet_designer",
    name: "Lead Magnet Concept Builder",
    intent: "Design a focused free resource that naturally leads into your paid offer.",
    availability: "Available",
    requiredInputs: [
      { key: "paidOffer", label: "Paid offer this leads into", type: "text", placeholder: "e.g. Complete Launch Playbook" }
    ],
    optionalInputs: [],
    autoContextDomains: ["audience", "business", "products"],
    aiInstructions: "Propose 3 high-utility free lead magnet concepts (checklist, mini-guide, or template) with opt-in hook and clear bridge to the paid offer.",
    outputSchema: [
      { key: "concepts", label: "3 Lead Magnet Concepts" },
      { key: "optInHook", label: "Opt-In Headline & Bullet Points" },
      { key: "bridgeToPaid", label: "Natural Next Step to Paid Offer" }
    ],
    connectedApps: ["productworks", "funnelworks", "threadsworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Connects cleanly to FunnelWorks opt-in pages and ProductWorks."
  }),
  makeAiTool({
    appId: "offerworks",
    toolId: "tripwire_offer",
    name: "Low-Ticket Starter Offer Designer",
    intent: "Package an approachable first-purchase digital asset to cross zero-to-one.",
    availability: "Available",
    requiredInputs: [
      { key: "problem", label: "Specific quick-win problem", type: "text", placeholder: "e.g. Writing a clear welcome sequence in 30 minutes" }
    ],
    optionalInputs: [
      { key: "price", label: "Starter price (optional)", type: "text", placeholder: "e.g. $9 or $19" }
    ],
    autoContextDomains: ["audience", "business"],
    aiInstructions: "Design a crisp, high-value starter product focused on a single immediate outcome that earns buyer trust.",
    outputSchema: [
      { key: "starterConcept", label: "Starter Product Definition" },
      { key: "whatsInside", label: "Exact Contents" },
      { key: "firstBuyerPitch", label: "Simple 3-Line Description" }
    ],
    connectedApps: ["productworks", "storeworks", "salesworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Creates a focused first-sale offer blueprint."
  }),
  makeAiTool({
    appId: "offerworks",
    toolId: "upsell_downsell",
    name: "Order Bump, Upsell & Downsell Planner",
    intent: "Plan ethical complementary offers that help buyers implement faster.",
    availability: "Available",
    requiredInputs: [
      { key: "mainOffer", label: "Main offer", type: "text", placeholder: "e.g. Creator Playbook PDF" }
    ],
    optionalInputs: [],
    autoContextDomains: ["business", "products"],
    aiInstructions: "Recommend one practical order bump, one implementation upsell, and one lighter downsell option with clear buyer-benefit explanations.",
    outputSchema: [
      { key: "orderBump", label: "Complementary Order Bump" },
      { key: "upsell", label: "Implementation Upsell" },
      { key: "downsell", label: "Lighter Entry Downsell" }
    ],
    connectedApps: ["funnelworks", "storeworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Produces structured add-on offers ready for StoreWorks bundles."
  }),
  makeAiTool({
    appId: "offerworks",
    toolId: "guarantee_terms",
    name: "Ethical Guarantee & Refund Terms",
    intent: "Draft clear, fair refund and expectation terms that lower buyer hesitation.",
    availability: "Available",
    requiredInputs: [
      { key: "offerType", label: "Offer type", type: "select", placeholder: "Select type", options: ["Digital Download / Playbook", "Self-Paced Course", "1:1 Coaching / Advisory", "Template Pack"] }
    ],
    optionalInputs: [
      { key: "policyNotes", label: "Your refund preference", type: "text", placeholder: "e.g. 14-day no-hassle refund" }
    ],
    autoContextDomains: ["business"],
    aiInstructions: "Draft plain-English guarantee and refund policy language that is fair to both creator and buyer.",
    outputSchema: [
      { key: "guaranteeCopy", label: "Customer-Facing Guarantee Box" },
      { key: "expectations", label: "Clear Scope & Expectations" }
    ],
    connectedApps: ["salesworks", "storeworks", "funnelworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Outputs transparent policy language with zero hype."
  }),
  makeAiTool({
    appId: "offerworks",
    toolId: "bonus_designer",
    name: "Practical Bonus Builder",
    intent: "Design 2-3 useful implementation bonuses that remove friction without padding.",
    availability: "Available",
    requiredInputs: [
      { key: "offer", label: "Core offer", type: "text", placeholder: "e.g. Audience Growth Workshop" }
    ],
    optionalInputs: [],
    autoContextDomains: ["audience", "products"],
    aiInstructions: "Suggest 3 genuinely useful implementation bonuses (checklists, swipe files, calculators) explaining the exact friction each removes.",
    outputSchema: [
      { key: "bonuses", label: "3 Practical Implementation Bonuses" },
      { key: "deliveryNotes", label: "How to Deliver Each Bonus Cleanly" }
    ],
    connectedApps: ["productworks", "deliveryworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Recommends practical bonuses without fake inflated dollar values."
  }),
  makeAiTool({
    appId: "offerworks",
    toolId: "offer_faq",
    name: "Honest Offer FAQ Builder",
    intent: "Answer the real questions prospective buyers ask before purchasing.",
    availability: "Available",
    requiredInputs: [
      { key: "offerDetails", label: "Offer details & format", type: "textarea", placeholder: "Describe what is included, format, and time required" }
    ],
    optionalInputs: [],
    autoContextDomains: ["business", "products"],
    aiInstructions: "Generate 6 clear, direct FAQ pairs covering time required, format, prerequisites, support, and refund policy.",
    outputSchema: [
      { key: "faqs", label: "6 Clear Buyer FAQs" }
    ],
    connectedApps: ["salesworks", "storeworks", "funnelworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Answers common buyer questions accurately and neutrally."
  }),
  makeAiTool({
    appId: "offerworks",
    toolId: "bundle_architect",
    name: "Product Bundle Architect",
    intent: "Combine 2+ existing digital products into a cohesive themed bundle.",
    availability: "Available",
    requiredInputs: [
      { key: "productsList", label: "Products to combine", type: "textarea", placeholder: "List the 2-4 products you want to bundle" }
    ],
    optionalInputs: [],
    autoContextDomains: ["products", "business"],
    aiInstructions: "Name the bundle, articulate how the items work together in sequence, and draft a concise bundle summary.",
    outputSchema: [
      { key: "bundleName", label: "Bundle Title & Theme" },
      { key: "recommendedOrder", label: "Recommended Customer Sequence" },
      { key: "bundlePitch", label: "Storefront Bundle Copy" }
    ],
    connectedApps: ["storeworks", "productworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Transfers directly into StoreWorks bundle setup."
  }),
  makeAiTool({
    appId: "offerworks",
    toolId: "offer_comparison",
    name: "Offer Comparison Matrix",
    intent: "Help buyers choose between two offers or tiers clearly.",
    availability: "Available",
    requiredInputs: [
      { key: "optionA", label: "Option A", type: "text", placeholder: "e.g. Self-Guided Playbook" },
      { key: "optionB", label: "Option B", type: "text", placeholder: "e.g. Playbook + 1:1 Review Call" }
    ],
    optionalInputs: [],
    autoContextDomains: ["business", "products"],
    aiInstructions: "Build a side-by-side comparison table and a clear 'Choose Option A if... / Choose Option B if...' guide.",
    outputSchema: [
      { key: "comparisonTable", label: "Side-by-Side Comparison" },
      { key: "decisionGuide", label: "Plain-English Buyer Decision Guide" }
    ],
    connectedApps: ["salesworks", "storeworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Creates clear side-by-side comparison copy."
  }),

  // =========================================================================
  // 4. PRODUCTWORKS (Flagship PDF/Carousel + 8 Digital Product Builders)
  // =========================================================================
  makeAiTool({
    appId: "productworks",
    toolId: "ebook_generator",
    name: "Mini-Ebook & Guide Builder",
    intent: "Draft a structured, downloadable creator guide with chapters and action steps.",
    availability: "Available",
    requiredInputs: [
      { key: "title", label: "Guide title or topic", type: "text", placeholder: "e.g. The Weekend Digital Product Playbook" },
      { key: "audience", label: "Target reader", type: "text", placeholder: "e.g. Solo creators launching their first guide" }
    ],
    optionalInputs: [
      { key: "chapters", label: "Desired focus areas (optional)", type: "textarea", placeholder: "List key sections you want covered" }
    ],
    autoContextDomains: ["identity", "business", "audience", "products"],
    aiInstructions: "Write a complete, practical 5-chapter mini-ebook outline and full chapter drafts with concrete action steps ready for export as Markdown/HTML.",
    outputSchema: [
      { key: "titleAndSubtitle", label: "Title & Subtitle" },
      { key: "introduction", label: "Reader Introduction" },
      { key: "chapters", label: "Structured Chapters & Steps" },
      { key: "actionChecklist", label: "Final Implementation Checklist" }
    ],
    connectedApps: ["threadsworks", "storeworks", "deliveryworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Exports cleanly as MD/HTML/TXT and links to StoreWorks & ThreadsWorks promotion."
  }),
  makeAiTool({
    appId: "productworks",
    toolId: "workbook_builder",
    name: "Interactive Workbook Builder",
    intent: "Create fillable reflection exercises, decision worksheets, and progress trackers.",
    availability: "Available",
    requiredInputs: [
      { key: "outcome", label: "Skill or milestone the workbook helps complete", type: "text", placeholder: "e.g. Define your first 30-day content and offer plan" }
    ],
    optionalInputs: [],
    autoContextDomains: ["identity", "audience", "products"],
    aiInstructions: "Create a structured 4-section workbook with clear instructions, prompt tables, self-check rubrics, and completion milestones.",
    outputSchema: [
      { key: "workbookOverview", label: "How to Use This Workbook" },
      { key: "exercises", label: "4 Guided Exercises" },
      { key: "selfCheckRubric", label: "Completion Self-Check" }
    ],
    connectedApps: ["deliveryworks", "storeworks", "threadsworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Produces downloadable workbook assets ready for customer delivery."
  }),
  makeAiTool({
    appId: "productworks",
    toolId: "checklist_template",
    name: "Actionable Checklist & SOP Generator",
    intent: "Package your repeatable workflow into a sellable checklist or operating template.",
    availability: "Available",
    requiredInputs: [
      { key: "workflow", label: "Workflow to systematize", type: "text", placeholder: "e.g. Weekly Threads publishing & lead follow-up routine" }
    ],
    optionalInputs: [],
    autoContextDomains: ["identity", "business"],
    aiInstructions: "Build a crisp, step-by-step SOP checklist grouped by phase with time estimates and quality checks.",
    outputSchema: [
      { key: "sopOverview", label: "Workflow Purpose & Scope" },
      { key: "stepByStepChecklist", label: "Phase-by-Phase Checklist" },
      { key: "qualityChecks", label: "Final Quality Checks" }
    ],
    connectedApps: ["storeworks", "deliveryworks", "threadsworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Generates exportable checklist ready for packaging or lead magnets."
  }),
  makeAiTool({
    appId: "productworks",
    toolId: "course_outline",
    name: "Mini-Course Curriculum Designer",
    intent: "Architect a focused 4-module course with lessons, practical exercises, and quizzes.",
    availability: "Available",
    requiredInputs: [
      { key: "courseTopic", label: "Course topic & end result", type: "text", placeholder: "e.g. Build and ship your first digital guide in 7 days" }
    ],
    optionalInputs: [],
    autoContextDomains: ["identity", "audience", "products"],
    aiInstructions: "Design a 4-module practical course syllabus with lesson objectives, hands-on assignments, and a short knowledge check for each module.",
    outputSchema: [
      { key: "coursePromise", label: "Course Promise & Audience" },
      { key: "moduleSyllabus", label: "4-Module Lesson Breakdown" },
      { key: "assignmentsAndQuizzes", label: "Practical Assignments & Checks" }
    ],
    connectedApps: ["deliveryworks", "storeworks", "threadsworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Can be transferred directly into DeliveryWorks course hosting."
  }),
  makeAiTool({
    appId: "productworks",
    toolId: "lesson_writer",
    name: "Course Lesson & Worksheet Writer",
    intent: "Write a complete teaching lesson with examples and a companion student worksheet.",
    availability: "Available",
    requiredInputs: [
      { key: "lessonTitle", label: "Lesson title", type: "text", placeholder: "e.g. How to Validate Your Offer in 5 Conversations" }
    ],
    optionalInputs: [
      { key: "keyPoints", label: "Key points to include", type: "textarea", placeholder: "Optional bullet points" }
    ],
    autoContextDomains: ["identity", "audience"],
    aiInstructions: "Write a clear, practical lesson script, concrete example, and a 3-step student assignment.",
    outputSchema: [
      { key: "lessonScript", label: "Lesson Content" },
      { key: "practicalExample", label: "Concrete Example" },
      { key: "studentAssignment", label: "Student Worksheet & Assignment" }
    ],
    connectedApps: ["deliveryworks", "threadsworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Generates a complete lesson transferable to DeliveryWorks."
  }),
  makeAiTool({
    appId: "productworks",
    toolId: "storefront_copy",
    name: "Product Listing & Storefront Copy",
    intent: "Write clear, honest product descriptions for your StoreWorks listing.",
    availability: "Available",
    requiredInputs: [
      { key: "productName", label: "Product name", type: "text", placeholder: "e.g. First Sale Playbook" },
      { key: "contents", label: "Exact contents included", type: "textarea", placeholder: "List what the buyer downloads" }
    ],
    optionalInputs: [
      { key: "price", label: "Price (optional)", type: "text", placeholder: "e.g. $29" }
    ],
    autoContextDomains: ["identity", "business", "products"],
    aiInstructions: "Write clear storefront copy: headline, subheadline, what's included, who it helps, and a direct CTA using only real facts provided.",
    outputSchema: [
      { key: "headline", label: "Storefront Headline & Subheadline" },
      { key: "description", label: "Clear Product Description" },
      { key: "whatsIncluded", label: "What's Included Bullets" }
    ],
    connectedApps: ["storeworks", "salesworks", "funnelworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Never invents prices or testimonials; ready to copy into StoreWorks."
  }),

  // =========================================================================
  // 5. THREADSWORKS (Flagship App — Direct Launch + Companion Bridge)
  // =========================================================================
  makeAiTool({
    appId: "threadsworks",
    toolId: "threads_studio_launcher",
    name: "ThreadsWorks Flagship Studio",
    intent: "Open the full Meta Threads Content Engine, Hook Studio, Content Library, Calendar & Analytics.",
    mode: "operational",
    availability: "Available",
    requiredInputs: [],
    optionalInputs: [],
    autoContextDomains: ["identity", "content", "performance"],
    aiInstructions: "Flagship operational app inside ThreadsWorks.",
    outputSchema: [],
    connectedApps: ["contentworks", "productworks", "growthworks"],
    provenanceDefault: "user_provided_fact",
    acceptanceCriteria: "Launches full preserved ThreadsWorks Content Engine, Library, Calendar, and Meta OAuth scheduler."
  }),

  // =========================================================================
  // 6. CONTENTWORKS (10 Tools — Content Strategy & Editorial Calendars)
  // =========================================================================
  makeAiTool({
    appId: "contentworks",
    toolId: "content_strategy",
    name: "Content Strategy Blueprint",
    intent: "Connect your positioning and offer into a cohesive weekly publishing strategy.",
    availability: "Available",
    requiredInputs: [
      { key: "goal", label: "Primary 30-day goal", type: "text", placeholder: "e.g. Attract warm readers for my starter playbook" }
    ],
    optionalInputs: [
      { key: "cadence", label: "Weekly posting capacity", type: "select", placeholder: "Select cadence", options: ["3 posts/week", "5 posts/week", "Daily (7 posts/week)"] }
    ],
    autoContextDomains: ["identity", "business", "audience", "content", "performance"],
    aiInstructions: "Design a practical 30-day Meta Threads content strategy balancing Attention, Trust, and Sales posts without burnout.",
    outputSchema: [
      { key: "strategySummary", label: "30-Day Strategy Focus" },
      { key: "contentMix", label: "Recommended Post Mix (Attention / Trust / Sales)" },
      { key: "weeklyRhythm", label: "Repeatable Weekly Publishing Rhythm" }
    ],
    connectedApps: ["threadsworks", "funnelworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Transfers directly into ThreadsWorks drafting queue."
  }),
  makeAiTool({
    appId: "contentworks",
    toolId: "content_pillars",
    name: "Content Pillar Architect",
    intent: "Build 4 repeatable content pillars with sub-topics tied to your products.",
    availability: "Available",
    requiredInputs: [
      { key: "niche", label: "Primary topic area", type: "text", placeholder: "e.g. Solo creator digital products" }
    ],
    optionalInputs: [],
    autoContextDomains: ["identity", "business", "audience", "products"],
    aiInstructions: "Define 4 structured content pillars, each with purpose, 3 recurring sub-topics, and how it bridges naturally to an offer.",
    outputSchema: [
      { key: "pillars", label: "4 Content Pillars & Sub-Topics" },
      { key: "offerAlignment", label: "How Each Pillar Supports Your Offers" }
    ],
    connectedApps: ["threadsworks", "productworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Outputs actionable content pillars ready for ThreadsWorks."
  }),
  makeAiTool({
    appId: "contentworks",
    toolId: "topic_clusters",
    name: "Topic Cluster & Idea Matrix",
    intent: "Turn one core theme into 12 distinct post briefs across fresh angles.",
    availability: "Available",
    requiredInputs: [
      { key: "coreTheme", label: "Core theme or product topic", type: "text", placeholder: "e.g. Pricing your first digital guide" }
    ],
    optionalInputs: [],
    autoContextDomains: ["identity", "audience", "content"],
    aiInstructions: "Generate 12 distinct content briefs (4 educational, 4 perspective/story, 4 conversation/offer-aligned) ready to draft in ThreadsWorks.",
    outputSchema: [
      { key: "educationalBriefs", label: "Educational Briefs" },
      { key: "storyAndPerspectiveBriefs", label: "Story & Perspective Briefs" },
      { key: "conversationAndOfferBriefs", label: "Conversation & Offer Briefs" }
    ],
    connectedApps: ["threadsworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "1-click transfer sends briefs directly to ThreadsWorks."
  }),
  makeAiTool({
    appId: "contentworks",
    toolId: "editorial_calendar",
    name: "14-Day Editorial Calendar Planner",
    intent: "Map two full weeks of concrete daily post prompts and objectives.",
    availability: "Available",
    requiredInputs: [
      { key: "focusOfferOrTheme", label: "Main theme or product focus", type: "text", placeholder: "e.g. Pre-launch education for my starter workbook" }
    ],
    optionalInputs: [],
    autoContextDomains: ["identity", "business", "products", "content"],
    aiInstructions: "Create a structured 14-day editorial plan specifying day, post goal (Attention/Trust/Sales), angle, and clear topic prompt.",
    outputSchema: [
      { key: "weekOne", label: "Week 1 Editorial Schedule (Days 1–7)" },
      { key: "weekTwo", label: "Week 2 Editorial Schedule (Days 8–14)" }
    ],
    connectedApps: ["threadsworks", "funnelworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Exports as MD/CSV and transfers briefs to ThreadsWorks."
  }),
  makeAiTool({
    appId: "contentworks",
    toolId: "launch_campaign_plan",
    name: "Product Launch Content Campaign",
    intent: "Sequence pre-launch, launch-week, and follow-up content around a product release.",
    availability: "Available",
    requiredInputs: [
      { key: "productName", label: "Product being launched", type: "text", placeholder: "e.g. First Sale Playbook" }
    ],
    optionalInputs: [
      { key: "launchWindow", label: "Launch duration", type: "select", placeholder: "Select window", options: ["5-Day Sprint", "7-Day Launch", "14-Day Warmup + Launch"] }
    ],
    autoContextDomains: ["identity", "products", "audience"],
    aiInstructions: "Build a cohesive launch sequence covering problem awareness, behind-the-scenes build, educational preview, open-cart announcement, FAQ, and final reminder.",
    outputSchema: [
      { key: "preLaunch", label: "Pre-Launch Warmup Sequence" },
      { key: "launchWeek", label: "Launch Week Content Plan" },
      { key: "followUp", label: "Post-Launch Follow-Up" }
    ],
    connectedApps: ["threadsworks", "funnelworks", "salesworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Produces structured launch briefs transferable to ThreadsWorks and FunnelWorks."
  }),
  makeAiTool({
    appId: "contentworks",
    toolId: "repurposing_blueprint",
    name: "Asset-to-Content Repurposing Plan",
    intent: "Turn one playbook, lesson, or case study into a week of native Threads posts.",
    availability: "Available",
    requiredInputs: [
      { key: "sourceMaterial", label: "Paste source outline, notes, or article excerpt", type: "textarea", placeholder: "Paste the key ideas from your product or lesson" }
    ],
    optionalInputs: [],
    autoContextDomains: ["identity", "content"],
    aiInstructions: "Break the provided source material into 5 distinct Threads post briefs (single post, step-by-step thread, myth-check, question, and takeaway summary) grounded strictly in the provided text.",
    outputSchema: [
      { key: "repurposedBriefs", label: "5 Native Threads Post Briefs" }
    ],
    connectedApps: ["threadsworks", "productworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Grounded strictly in supplied material and transferable to ThreadsWorks."
  }),
  makeAiTool({
    appId: "contentworks",
    toolId: "series_planner",
    name: "Recurring Content Series Designer",
    intent: "Design a signature weekly series readers look forward to.",
    availability: "Available",
    requiredInputs: [
      { key: "theme", label: "Series theme", type: "text", placeholder: "e.g. Tear-downs of real landing pages" }
    ],
    optionalInputs: [],
    autoContextDomains: ["identity", "audience"],
    aiInstructions: "Create a repeatable weekly series concept with name, recurring structure, and the first 4 episode briefs.",
    outputSchema: [
      { key: "seriesFormat", label: "Series Name & Repeatable Format" },
      { key: "firstFourEpisodes", label: "First 4 Episode Briefs" }
    ],
    connectedApps: ["threadsworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Generates repeatable format and 4 ready-to-draft briefs."
  }),
  makeAiTool({
    appId: "contentworks",
    toolId: "hook_bank_planner",
    name: "Conversational Hook Bank",
    intent: "Generate 3 focused conversational opening hook angles for a topic.",
    availability: "Available",
    requiredInputs: [
      { key: "topic", label: "Post topic", type: "text", placeholder: "e.g. Why simple $19 guides outperform complex funnels" }
    ],
    optionalInputs: [],
    autoContextDomains: ["identity", "audience"],
    aiInstructions: "Generate exactly 3 conversational, pattern-interrupt opening hooks (under 140 characters each) with brief guidance on the follow-up sentence.",
    outputSchema: [
      { key: "threeHooks", label: "3 Conversational Opening Hooks" }
    ],
    connectedApps: ["threadsworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Produces exactly 3 concise hooks under 140 characters."
  }),
  makeAiTool({
    appId: "contentworks",
    toolId: "content_audit_brief",
    name: "Content Mix & Gap Review",
    intent: "Review your current posting focus and spot under-served buyer stages.",
    availability: "Available",
    requiredInputs: [
      { key: "recentTopics", label: "Recent topics you have posted about", type: "textarea", placeholder: "List 5-10 recent post topics" }
    ],
    optionalInputs: [],
    autoContextDomains: ["content", "performance", "products"],
    aiInstructions: "Analyze the listed topics for balance across discovery, trust-building, and offer clarity, and propose 3 high-leverage next topics.",
    outputSchema: [
      { key: "mixObservation", label: "Current Balance Observation" },
      { key: "gaps", label: "Under-Served Buyer Questions" },
      { key: "nextThreeTopics", label: "3 Recommended Next Topics" }
    ],
    connectedApps: ["threadsworks", "growthworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Evaluates actual supplied topics without fabricating metrics."
  }),
  makeAiTool({
    appId: "contentworks",
    toolId: "cta_bridge_library",
    name: "Soft & Direct CTA Bridge Copy",
    intent: "Draft natural, low-friction closing calls-to-action for posts and newsletters.",
    availability: "Available",
    requiredInputs: [
      { key: "destination", label: "What you are inviting readers to do", type: "text", placeholder: "e.g. Reply 'GUIDE' or view my starter playbook" }
    ],
    optionalInputs: [
      { key: "url", label: "Approved destination URL (optional)", type: "text", placeholder: "Leave blank if using reply/DM invitation" }
    ],
    autoContextDomains: ["identity", "business", "products"],
    aiInstructions: "Draft 3 closing CTA options: conversation starter, soft resource mention, and direct offer link. Include a URL ONLY if supplied.",
    outputSchema: [
      { key: "ctaVariants", label: "3 Natural CTA Variants" }
    ],
    connectedApps: ["threadsworks", "funnelworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Never invents external links; produces 3 clean CTA options."
  }),

  // =========================================================================
  // 7. FUNNELWORKS (Conversion Pathways, Email Sequences & Lead Capture)
  // =========================================================================
  makeAiTool({
    appId: "funnelworks",
    toolId: "funnel_map",
    name: "Content-to-Offer Funnel Map",
    intent: "Map the exact step-by-step path from Threads post to lead capture to paid offer.",
    availability: "Available",
    requiredInputs: [
      { key: "entryChannel", label: "Entry point", type: "text", placeholder: "e.g. Meta Threads educational posts" },
      { key: "targetOffer", label: "Destination paid offer", type: "text", placeholder: "e.g. $29 Starter Playbook" }
    ],
    optionalInputs: [
      { key: "leadMagnet", label: "Free lead magnet (optional)", type: "text", placeholder: "e.g. 1-page launch checklist" }
    ],
    autoContextDomains: ["business", "audience", "products"],
    aiInstructions: "Design a clear, respectful 4-step funnel blueprint covering Traffic/Post -> Opt-In/Lead Capture -> Nurture Sequence -> Offer Page with clear metrics to watch.",
    outputSchema: [
      { key: "funnelSteps", label: "4-Step Customer Pathway" },
      { key: "conversionCheckpoints", label: "Key Checkpoints & Clarity Checks" },
      { key: "implementationOrder", label: "Fastest Setup Checklist" }
    ],
    connectedApps: ["salesworks", "storeworks", "threadsworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Generates structured funnel map transferable to SalesWorks and StoreWorks."
  }),
  makeAiTool({
    appId: "funnelworks",
    toolId: "landing_page_copy",
    name: "Landing & Opt-In Page Copy",
    intent: "Write clean, high-clarity landing page copy ready to export as HTML or Markdown.",
    availability: "Available",
    requiredInputs: [
      { key: "offerName", label: "Lead magnet or offer name", type: "text", placeholder: "e.g. First Sale Validation Checklist" },
      { key: "valuePoints", label: "What the visitor gets", type: "textarea", placeholder: "List 3-5 concrete takeaways" }
    ],
    optionalInputs: [],
    autoContextDomains: ["identity", "business", "audience", "products"],
    aiInstructions: "Draft clean landing page sections: Hero Headline, Subheadline, 3 Benefit Bullets, Who It Helps, and Form CTA Copy without fake urgency.",
    outputSchema: [
      { key: "heroSection", label: "Hero Headline & Subheadline" },
      { key: "valueBullets", label: "What's Inside Bullets" },
      { key: "ctaCopy", label: "Opt-In / Action Button Copy" }
    ],
    connectedApps: ["salesworks", "storeworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Exports cleanly as HTML/MD and feeds real lead capture."
  }),
  makeAiTool({
    appId: "funnelworks",
    toolId: "welcome_email_sequence",
    name: "Welcome & Nurture Email Sequence",
    intent: "Write a 4-email welcome sequence that delivers value and introduces your offer naturally.",
    availability: "Available",
    requiredInputs: [
      { key: "leadMagnet", label: "What subscribers signed up for", type: "text", placeholder: "e.g. Free First-Sale Checklist" },
      { key: "paidOffer", label: "Offer to introduce in emails 3-4", type: "text", placeholder: "e.g. Complete Creator Playbook" }
    ],
    optionalInputs: [],
    autoContextDomains: ["identity", "business", "audience", "products"],
    aiInstructions: "Write 4 concise, conversational emails (1: Delivery + Quick Win, 2: Practical Lesson, 3: Real Case/Framework + Soft Offer Intro, 4: Direct Invitation + Reply Prompt).",
    outputSchema: [
      { key: "email1", label: "Email 1 — Delivery & Immediate Win" },
      { key: "email2", label: "Email 2 — Core Teaching Lesson" },
      { key: "email3", label: "Email 3 — Framework & Soft Offer Bridge" },
      { key: "email4", label: "Email 4 — Clear Offer Invitation" }
    ],
    connectedApps: ["salesworks", "deliveryworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Houses email sequence drafting inside FunnelWorks (replacing separate EmailWorks)."
  }),
  makeAiTool({
    appId: "funnelworks",
    toolId: "creator_newsletter",
    name: "Weekly Creator Newsletter Draft",
    intent: "Turn one core insight into a readable, direct newsletter issue.",
    availability: "Available",
    requiredInputs: [
      { key: "topic", label: "Main newsletter topic", type: "text", placeholder: "e.g. How to validate an offer in 3 days" }
    ],
    optionalInputs: [
      { key: "offerMention", label: "Optional P.S. offer mention", type: "text", placeholder: "Leave blank for pure editorial issue" }
    ],
    autoContextDomains: ["identity", "audience", "content"],
    aiInstructions: "Draft a concise creator newsletter with 3 subject line options, a grounded opening story/observation, actionable steps, and an optional P.S. CTA.",
    outputSchema: [
      { key: "subjectLines", label: "3 Subject Line Options" },
      { key: "newsletterBody", label: "Newsletter Draft" },
      { key: "psSection", label: "P.S. / Reply Prompt" }
    ],
    connectedApps: ["threadsworks", "salesworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Produces editable, exportable newsletter copy."
  }),
  makeAiTool({
    appId: "funnelworks",
    toolId: "link_in_bio_blueprint",
    name: "Link-in-Bio Hub Copy",
    intent: "Organize your profile bio link page around 3 clear paths (Free, Paid, Connect).",
    availability: "Available",
    requiredInputs: [
      { key: "destinations", label: "Links or resources to feature", type: "textarea", placeholder: "List your free resource, flagship product, and booking/contact link" }
    ],
    optionalInputs: [],
    autoContextDomains: ["identity", "business", "products"],
    aiInstructions: "Structure a distraction-free Link-in-Bio layout with crisp headlines and micro-descriptions for each button.",
    outputSchema: [
      { key: "profileHeader", label: "Header Title & One-Line Pitch" },
      { key: "featuredLinks", label: "Prioritized Link Cards Copy" }
    ],
    connectedApps: ["threadsworks", "storeworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Exports ready-to-use Link-in-Bio copy."
  }),
  makeAiTool({
    appId: "funnelworks",
    toolId: "outbound_email_broadcast",
    name: "Automated Outbound Email Sender",
    intent: "Send scheduled email campaigns directly to external subscriber inboxes.",
    mode: "operational",
    availability: "In Development",
    availabilityNote: "Automated outbound email transmission requires configuring an authorized email service provider (SMTP / Resend / SendGrid API key + verified domain DNS records).",
    requiredInputs: [{ key: "campaignName", label: "Campaign name", type: "text", placeholder: "Launch broadcast" }],
    optionalInputs: [],
    autoContextDomains: ["business"],
    aiInstructions: "Gated external ESP integration.",
    outputSchema: [{ key: "status", label: "Provider Status" }],
    connectedApps: ["salesworks"],
    provenanceDefault: "user_provided_fact",
    acceptanceCriteria: "Honestly gated as In Development; never simulates sending external emails."
  }),

  // =========================================================================
  // 8. SALESWORKS (Sales Copy + Persistent CRM Pipeline)
  // =========================================================================
  makeAiTool({
    appId: "salesworks",
    toolId: "sales_page_copy",
    name: "Transparent Sales Page Copy",
    intent: "Draft a structured, evidence-based sales page without manipulative hype.",
    availability: "Available",
    requiredInputs: [
      { key: "offerName", label: "Offer name", type: "text", placeholder: "e.g. First Sale Playbook" },
      { key: "details", label: "Deliverables, audience, and real details", type: "textarea", placeholder: "Include exact contents and price if set" }
    ],
    optionalInputs: [],
    autoContextDomains: ["identity", "business", "audience", "products"],
    aiInstructions: "Write a complete, ethical sales page: Hero, Who It Helps, Exact Deliverables, How It Works, FAQ, and Clear Call to Action. Never fabricate testimonials or income promises.",
    outputSchema: [
      { key: "hero", label: "Headline & Opening Pitch" },
      { key: "offerBreakdown", label: "What You Get & How It Works" },
      { key: "faqAndCta", label: "Buyer FAQ & Clear CTA" }
    ],
    connectedApps: ["storeworks", "funnelworks", "proofworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Produces honest sales copy grounded strictly in supplied offer facts."
  }),
  makeAiTool({
    appId: "salesworks",
    toolId: "outreach_scripts",
    name: "Warm DM & Outreach Conversation Scripts",
    intent: "Start genuine, respectful buyer conversations from post replies or leads.",
    availability: "Available",
    requiredInputs: [
      { key: "context", label: "How you connected with the prospect", type: "text", placeholder: "e.g. They replied to my Threads post asking about templates" }
    ],
    optionalInputs: [
      { key: "offer", label: "Relevant resource or offer (optional)", type: "text", placeholder: "e.g. Free checklist or 15-min discovery call" }
    ],
    autoContextDomains: ["identity", "business", "products"],
    aiInstructions: "Write 3 short, human DM/email scripts: initial helpful reply, clarifying question, and transparent invitation to review the offer or book a call.",
    outputSchema: [
      { key: "firstReply", label: "1. Helpful First Message" },
      { key: "discoveryQuestion", label: "2. Clarifying Follow-Up" },
      { key: "transparentInvite", label: "3. Low-Pressure Offer/Call Invite" }
    ],
    connectedApps: ["meetingworks", "threadsworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Peer-to-peer scripts ready to use alongside SalesWorks CRM."
  }),
  makeAiTool({
    appId: "salesworks",
    toolId: "objection_guide",
    name: "Honest Objection & Question Guide",
    intent: "Prepare clear, non-defensive answers to common buyer hesitations.",
    availability: "Available",
    requiredInputs: [
      { key: "objections", label: "Questions or hesitations buyers raise", type: "textarea", placeholder: "e.g. 'Will this work if I have a small audience?' or 'How much time does it take?'" }
    ],
    optionalInputs: [],
    autoContextDomains: ["business", "products"],
    aiInstructions: "Provide honest, grounded responses to each question—including when to tell someone the offer is NOT the right fit.",
    outputSchema: [
      { key: "responses", label: "Direct, Transparent Responses" },
      { key: "qualificationSignal", label: "When to Recommend Waiting" }
    ],
    connectedApps: ["meetingworks", "funnelworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Helps buyers decide with clarity rather than pressure."
  }),
  makeAiTool({
    appId: "salesworks",
    toolId: "follow_up_emails",
    name: "Sales Follow-Up Email Set",
    intent: "Draft polite, value-adding follow-up messages after a call or inquiry.",
    availability: "Available",
    requiredInputs: [
      { key: "interactionSummary", label: "Summary of the call or inquiry", type: "textarea", placeholder: "What did the prospect ask about and what next step was discussed?" }
    ],
    optionalInputs: [],
    autoContextDomains: ["identity", "business"],
    aiInstructions: "Write a same-day recap email, a 3-day helpful check-in, and a clean close-the-loop note.",
    outputSchema: [
      { key: "sameDayRecap", label: "Same-Day Recap Email" },
      { key: "threeDayCheckIn", label: "3-Day Check-In" },
      { key: "closeLoop", label: "Respectful Close-the-Loop Note" }
    ],
    connectedApps: ["meetingworks", "deliveryworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Links directly from MeetingWorks notes and CRM contacts."
  }),
  makeAiTool({
    appId: "salesworks",
    toolId: "client_proposal",
    name: "Client Proposal & Scope Agreement",
    intent: "Generate a clean scope proposal and lightweight service agreement draft.",
    availability: "Available",
    requiredInputs: [
      { key: "clientGoal", label: "Client name & project goal", type: "text", placeholder: "e.g. Acme Studio — 4-week Threads content system" },
      { key: "scope", label: "Deliverables, timeline & fee", type: "textarea", placeholder: "List exact deliverables, dates, and fee" }
    ],
    optionalInputs: [],
    autoContextDomains: ["identity", "business"],
    aiInstructions: "Draft a structured proposal covering objectives, exact deliverables, timeline, investment (strictly as provided), and plain-English working terms (with a reminder to consult legal counsel for formal contracts).",
    outputSchema: [
      { key: "proposalSummary", label: "Executive Summary & Deliverables" },
      { key: "timelineAndInvestment", label: "Timeline & Fee Schedule" },
      { key: "workingTerms", label: "Plain-English Scope Terms" }
    ],
    connectedApps: ["financeworks", "deliveryworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Exports cleanly as HTML/MD/TXT and connects to FinanceWorks invoicing."
  }),

  // =========================================================================
  // 9. STOREWORKS (Storefront Builder + Gated Seller Payout Checkout)
  // =========================================================================
  makeAiTool({
    appId: "storeworks",
    toolId: "storefront_bio_and_sections",
    name: "Creator Storefront Copy Builder",
    intent: "Write clean homepage framing, catalog categories, and buyer trust notes for your storefront.",
    availability: "Available",
    requiredInputs: [
      { key: "catalogSummary", label: "Products in your store", type: "textarea", placeholder: "List your playbooks, templates, or services" }
    ],
    optionalInputs: [],
    autoContextDomains: ["identity", "business", "products"],
    aiInstructions: "Write clear storefront header copy, catalog positioning, and transparent delivery/refund notes.",
    outputSchema: [
      { key: "storeHeader", label: "Storefront Title & Positioning" },
      { key: "catalogCopy", label: "Product Shelf Framing" },
      { key: "trustNotes", label: "Delivery & Support Clarity Box" }
    ],
    connectedApps: ["productworks", "deliveryworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Pairs directly with persistent StoreWorks product listings."
  }),
  makeAiTool({
    appId: "storeworks",
    toolId: "live_marketplace_checkout",
    name: "Live Creator Marketplace Checkout & Payouts",
    intent: "Process live third-party buyer card payments and automated creator bank payouts.",
    mode: "operational",
    availability: "In Development",
    availabilityNote: "Live creator marketplace checkout and automated seller payouts require Stripe Connect onboarding and dedicated merchant webhook verification, kept strictly separate from ThreadsWorks SaaS subscription billing.",
    requiredInputs: [],
    optionalInputs: [],
    autoContextDomains: ["products"],
    aiInstructions: "Gated Stripe Connect marketplace integration.",
    outputSchema: [{ key: "status", label: "Stripe Connect Status" }],
    connectedApps: ["financeworks", "deliveryworks"],
    provenanceDefault: "user_provided_fact",
    acceptanceCriteria: "Explicitly gated on Stripe Connect configuration and strictly separated from SaaS billing."
  }),

  // =========================================================================
  // 10. DELIVERYWORKS (Onboarding, Fulfillment & Course Hosting)
  // =========================================================================
  makeAiTool({
    appId: "deliveryworks",
    toolId: "onboarding_sequence",
    name: "Customer Welcome & Onboarding Kit",
    intent: "Create a smooth Day-0 welcome message, quick-start checklist, and Day-7 check-in.",
    availability: "Available",
    requiredInputs: [
      { key: "productName", label: "Purchased product or service", type: "text", placeholder: "e.g. First Sale Playbook" }
    ],
    optionalInputs: [
      { key: "firstWin", label: "Fastest 15-minute win for the buyer", type: "text", placeholder: "e.g. Complete the 1-page offer clarity sheet" }
    ],
    autoContextDomains: ["identity", "products"],
    aiInstructions: "Write a warm Day-0 welcome email, 3-step quick-start guide, and Day-7 outcome check-in email.",
    outputSchema: [
      { key: "welcomeMessage", label: "Day-0 Welcome & Access Message" },
      { key: "quickStartChecklist", label: "Buyer 15-Minute Quick-Start" },
      { key: "daySevenCheckIn", label: "Day-7 Outcome Check-In" }
    ],
    connectedApps: ["proofworks", "salesworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Pairs directly with DeliveryWorks access records."
  }),
  makeAiTool({
    appId: "deliveryworks",
    toolId: "feedback_collector",
    name: "Customer Feedback & Proof Prompt",
    intent: "Ask satisfied customers for honest feedback and permission-based testimonials.",
    availability: "Available",
    requiredInputs: [
      { key: "productName", label: "Product or course name", type: "text", placeholder: "e.g. Weekend Playbook" }
    ],
    optionalInputs: [],
    autoContextDomains: ["identity", "products"],
    aiInstructions: "Create a 4-question customer feedback form and polite testimonial permission request.",
    outputSchema: [
      { key: "feedbackQuestions", label: "4 Customer Outcome Questions" },
      { key: "permissionRequest", label: "Honest Testimonial Permission Request" }
    ],
    connectedApps: ["proofworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Routes collected feedback straight into ProofWorks."
  }),
  makeAiTool({
    appId: "deliveryworks",
    toolId: "support_playbook",
    name: "Customer Support Response Templates",
    intent: "Draft clear, helpful replies for access issues, questions, and refund requests.",
    availability: "Available",
    requiredInputs: [
      { key: "offerName", label: "Product or service name", type: "text", placeholder: "e.g. Creator Playbook" }
    ],
    optionalInputs: [],
    autoContextDomains: ["business", "products"],
    aiInstructions: "Create 4 polite, practical customer support templates: download help, how-to question, upgrade inquiry, and graceful refund confirmation.",
    outputSchema: [
      { key: "supportTemplates", label: "4 Ready-to-Send Support Replies" }
    ],
    connectedApps: ["salesworks", "storeworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Generates professional, helpful customer support replies."
  }),

  // =========================================================================
  // 11. COMMUNITYWORKS (Internal Creator Network + Community Prompts)
  // =========================================================================
  makeAiTool({
    appId: "communityworks",
    toolId: "community_challenge",
    name: "Creator Accountability Challenge Designer",
    intent: "Design a 5-day or 7-day community challenge to spark peer momentum.",
    availability: "Available",
    requiredInputs: [
      { key: "challengeGoal", label: "Challenge goal", type: "text", placeholder: "e.g. Publish 5 helpful Threads posts and ship 1 lead magnet" }
    ],
    optionalInputs: [],
    autoContextDomains: ["identity", "audience"],
    aiInstructions: "Outline a clear 5-day community challenge with daily check-in prompts and completion criteria.",
    outputSchema: [
      { key: "challengeAnnouncement", label: "Community Challenge Post" },
      { key: "dailyPrompts", label: "5 Daily Check-In Prompts" }
    ],
    connectedApps: ["threadsworks", "meetingworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Output can be posted directly to the CommunityWorks feed."
  }),

  // =========================================================================
  // 12. MEETINGWORKS (Rooms, Appointments, Chat + AI Summary; WebRTC Gated)
  // =========================================================================
  makeAiTool({
    appId: "meetingworks",
    toolId: "meeting_summary_action_items",
    name: "AI Meeting Summary & Action Items",
    intent: "Turn raw meeting notes or chat transcript into a crisp summary, buyer insights, and follow-up tasks.",
    availability: "Available",
    requiredInputs: [
      { key: "notes", label: "Meeting notes or chat log", type: "textarea", placeholder: "Paste notes or discussion highlights from your MeetingWorks room" }
    ],
    optionalInputs: [
      { key: "meetingType", label: "Meeting type", type: "select", placeholder: "Select type", options: ["Discovery Call", "Client Coaching", "Partner Collaboration", "Customer Interview"] }
    ],
    autoContextDomains: ["identity", "business", "projects"],
    aiInstructions: "Summarize strictly what is present in the notes into Key Decisions, Action Items with Owners, Buyer Language/Questions, and a ready-to-send Follow-Up Email.",
    outputSchema: [
      { key: "summary", label: "Concise Meeting Summary" },
      { key: "actionItems", label: "Action Items & Next Steps" },
      { key: "buyerInsights", label: "Documented Questions & Insights" },
      { key: "followUpEmail", label: "Ready-to-Send Follow-Up Draft" }
    ],
    connectedApps: ["salesworks", "demandworks", "deliveryworks"],
    provenanceDefault: "user_provided_fact",
    acceptanceCriteria: "Grounded strictly in meeting notes; transfers insights to DemandWorks or SalesWorks."
  }),
  makeAiTool({
    appId: "meetingworks",
    toolId: "live_audio_video_room",
    name: "Live WebRTC Audio, Video & Screen Share",
    intent: "Host browser-native real-time video and audio calls.",
    mode: "operational",
    availability: "In Development",
    availabilityNote: "Live real-time audio/video/screen sharing requires external WebRTC SFU/TURN media infrastructure (e.g. LiveKit, Daily, or Twilio Video credentials) not yet provisioned. Persistent meeting rooms, invitations, agendas, in-room chat, product sharing, and AI summaries are live now.",
    requiredInputs: [],
    optionalInputs: [],
    autoContextDomains: [],
    aiInstructions: "Gated real-time media integration.",
    outputSchema: [{ key: "status", label: "Media Provider Status" }],
    connectedApps: ["salesworks"],
    provenanceDefault: "user_provided_fact",
    acceptanceCriteria: "Honestly gated as In Development; zero decorative fake video feeds."
  }),

  // =========================================================================
  // 13. PROOFWORKS (Evidence Library + Case Study & Proof Builders)
  // =========================================================================
  makeAiTool({
    appId: "proofworks",
    toolId: "case_study_builder",
    name: "Grounded Case Study Builder",
    intent: "Turn verified customer facts into a structured Before → Action → Result case study.",
    availability: "Available",
    requiredInputs: [
      { key: "customerContext", label: "Real starting context", type: "textarea", placeholder: "Describe the customer's real starting point" },
      { key: "verifiedOutcome", label: "Actual verified result", type: "textarea", placeholder: "State only real, verified outcomes (no guesses)" }
    ],
    optionalInputs: [
      { key: "quote", label: "Direct customer quote (optional)", type: "textarea", placeholder: "Paste exact customer quote if approved" }
    ],
    autoContextDomains: ["identity", "products"],
    aiInstructions: "Draft a crisp case study using ONLY the supplied facts and quotes. Explicitly preserve verification caveats and never exaggerate outcomes.",
    outputSchema: [
      { key: "headline", label: "Factual Case Study Headline" },
      { key: "storyBreakdown", label: "Starting Context → Actions → Verified Outcome" },
      { key: "socialPostSummary", label: "Short Proof Post for ThreadsWorks" }
    ],
    connectedApps: ["salesworks", "threadsworks", "storeworks"],
    provenanceDefault: "user_provided_fact",
    acceptanceCriteria: "Uses strictly supplied facts and syncs with ProofWorks verification tiers."
  }),
  makeAiTool({
    appId: "proofworks",
    toolId: "testimonial_request",
    name: "Testimonial & Review Request Script",
    intent: "Write a clear, respectful outreach note inviting honest customer feedback.",
    availability: "Available",
    requiredInputs: [
      { key: "productName", label: "Product or service used", type: "text", placeholder: "e.g. Starter Playbook" }
    ],
    optionalInputs: [],
    autoContextDomains: ["identity", "products"],
    aiInstructions: "Draft a brief email and DM template asking 3 concrete questions that elicit specific, honest customer feedback.",
    outputSchema: [
      { key: "emailRequest", label: "Email Testimonial Request" },
      { key: "dmRequest", label: "Short DM Request" }
    ],
    connectedApps: ["deliveryworks", "salesworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Produces natural, respectful feedback request scripts."
  }),

  // =========================================================================
  // 14. TEAMWORKS (Shared Workspaces, Tasks, Approvals & Collaborations)
  // =========================================================================
  makeAiTool({
    appId: "teamworks",
    toolId: "collaboration_proposal",
    name: "Creator Partnership & Co-Marketing Proposal",
    intent: "Structure a win-win co-marketing, guest workshop, or bundle partnership.",
    availability: "Available",
    requiredInputs: [
      { key: "partnerFocus", label: "Partner creator & shared audience", type: "text", placeholder: "e.g. Newsletter writer serving independent consultants" },
      { key: "jointIdea", label: "Proposed collaboration format", type: "text", placeholder: "e.g. Co-hosted Q&A or resource swap" }
    ],
    optionalInputs: [],
    autoContextDomains: ["identity", "business", "audience"],
    aiInstructions: "Draft a crisp partnership proposal outlining mutual value, exact deliverables for each side, and simple timeline.",
    outputSchema: [
      { key: "outreachPitch", label: "Short Partner Outreach Message" },
      { key: "scopeOutline", label: "Shared Deliverables & Timeline" }
    ],
    connectedApps: ["communityworks", "meetingworks", "affiliateworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Saves alongside persistent TeamWorks workspaces and tasks."
  }),

  // =========================================================================
  // 15. AFFILIATEWORKS (Partner Program, Links & Swipe Copy)
  // =========================================================================
  makeAiTool({
    appId: "affiliateworks",
    toolId: "partner_swipe_kit",
    name: "Affiliate Partner Swipe Copy & Launch Kit",
    intent: "Equip partners with honest Threads posts, short emails, and clear disclosure lines.",
    availability: "Available",
    requiredInputs: [
      { key: "productName", label: "Product being referred", type: "text", placeholder: "e.g. Creator Playbook" },
      { key: "commissionSummary", label: "Commission terms", type: "text", placeholder: "e.g. 30% recurring or one-time commission" }
    ],
    optionalInputs: [],
    autoContextDomains: ["identity", "business", "products"],
    aiInstructions: "Create an honest partner resource kit including 2 Threads posts, 1 email blurb, and clear FTC affiliate disclosure reminders.",
    outputSchema: [
      { key: "partnerThreads", label: "2 Partner Threads Posts" },
      { key: "partnerEmail", label: "Short Partner Email Blurb" },
      { key: "disclosureReminder", label: "Transparent Disclosure Note" }
    ],
    connectedApps: ["communityworks", "storeworks", "financeworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Pairs directly with AffiliateWorks trackable links and self-referral guard."
  }),

  // =========================================================================
  // 16. GROWTHWORKS (Real Analytics + Strategy & Experiment Planning)
  // =========================================================================
  makeAiTool({
    appId: "growthworks",
    toolId: "experiment_planner",
    name: "Growth Experiment & Hypothesis Planner",
    intent: "Design a disciplined 14-day growth experiment with clear pass/fail criteria.",
    availability: "Available",
    requiredInputs: [
      { key: "hypothesis", label: "What you want to test", type: "textarea", placeholder: "e.g. Adding a soft reply CTA to 3 trust threads per week increases DM inquiries" }
    ],
    optionalInputs: [],
    autoContextDomains: ["performance", "content", "business"],
    aiInstructions: "Structure a clean experiment brief: Hypothesis, Single Variable Tested, Action Plan, Real Metric to Record, and Review Criteria. Never invent baseline metrics.",
    outputSchema: [
      { key: "experimentBrief", label: "Experiment Structure" },
      { key: "executionChecklist", label: "14-Day Execution Steps" },
      { key: "successCriteria", label: "How to Evaluate Real Results" }
    ],
    connectedApps: ["threadsworks", "contentworks", "adsworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Uses real synced metrics when present; never fabricates analytics."
  }),
  makeAiTool({
    appId: "growthworks",
    toolId: "quarterly_goal_plan",
    name: "90-Day Creator Goal & Milestone Plan",
    intent: "Translate a concrete business target into weekly leading indicators.",
    availability: "Available",
    requiredInputs: [
      { key: "targetOutcome", label: "90-day business goal", type: "text", placeholder: "e.g. Earn my first 10 verified sales of my starter playbook" }
    ],
    optionalInputs: [],
    autoContextDomains: ["business", "projects", "performance"],
    aiInstructions: "Break the 90-day goal into 3 monthly milestones and 3 controllable weekly actions.",
    outputSchema: [
      { key: "monthlyMilestones", label: "Month 1, 2 & 3 Milestones" },
      { key: "weeklyLeadingActions", label: "3 Controllable Weekly Actions" },
      { key: "reviewCadence", label: "Weekly Review Checklist" }
    ],
    connectedApps: ["automationworks", "financeworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Produces actionable weekly milestones."
  }),

  // =========================================================================
  // 17. AUTOMATIONWORKS (Safe Internal Workflow Builder & NL Drafter)
  // =========================================================================
  makeAiTool({
    appId: "automationworks",
    toolId: "workflow_blueprint_drafter",
    name: "Natural-Language Workflow Drafter",
    intent: "Convert a plain-English automation goal into a structured Trigger → Condition → Action workflow with human approval gates.",
    availability: "Available",
    requiredInputs: [
      { key: "goal", label: "Describe the workflow you want to automate", type: "textarea", placeholder: "e.g. When I save a new ProductWorks playbook, automatically prepare 5 Threads promo drafts for my review" }
    ],
    optionalInputs: [],
    autoContextDomains: ["business", "products", "projects"],
    aiInstructions: "Translate the request into a safe internal workflow spec (Trigger, Condition, Internal Action, Approval Gate, and Explicit External Safety Boundary forbidding auto-publishing or unapproved charges).",
    outputSchema: [
      { key: "triggerAndCondition", label: "Trigger & Guard Condition" },
      { key: "actionSteps", label: "Safe Internal Action Steps" },
      { key: "approvalGate", label: "Human Approval & Safety Boundary" }
    ],
    connectedApps: ["productworks", "threadsworks", "salesworks", "deliveryworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Maps directly into AutomationWorks persistent workflow execution."
  }),

  // =========================================================================
  // 18. FINANCEWORKS (Real Ledger, Invoices, P&L + Budget Forecasts)
  // =========================================================================
  makeAiTool({
    appId: "financeworks",
    toolId: "budget_forecast_model",
    name: "Creator Budget & Labeled Forecast Planner",
    intent: "Model creator operating expenses and clearly labeled hypothetical revenue scenarios.",
    availability: "Available",
    requiredInputs: [
      { key: "monthlyCosts", label: "Your monthly operating expenses", type: "text", placeholder: "e.g. $120/mo tools and hosting" },
      { key: "productPrice", label: "Your product or service price", type: "text", placeholder: "e.g. $29 playbook" }
    ],
    optionalInputs: [
      { key: "monthlyGoal", label: "Target monthly net income (optional)", type: "text", placeholder: "e.g. $1,000/mo" }
    ],
    autoContextDomains: ["business", "products"],
    aiInstructions: "Calculate break-even unit counts and 3 clearly labeled hypothetical scenarios (Conservative, Base, Stretch) strictly from user-supplied numbers. Clearly state that forecasts are illustrative planning scenarios, not guaranteed income.",
    outputSchema: [
      { key: "breakEvenMath", label: "Break-Even Unit Math" },
      { key: "hypotheticalScenarios", label: "Illustrative Scenarios (Hypothetical — Not Guaranteed)" },
      { key: "costControlTips", label: "Lean Creator Cost Guardrails" }
    ],
    connectedApps: ["offerworks", "storeworks", "growthworks"],
    provenanceDefault: "ai_hypothesis",
    acceptanceCriteria: "Explicitly labels forecast math as hypothetical and never fabricates actual ledger entries."
  }),

  // =========================================================================
  // 19. ADSWORKS (Paid Campaign Copy & Strategy; Live Ad API Gated)
  // =========================================================================
  makeAiTool({
    appId: "adsworks",
    toolId: "ad_copy_variations",
    name: "Paid Ad Copy Variations",
    intent: "Turn a proven organic angle into 3 compliant, clear paid ad variations.",
    availability: "Available",
    requiredInputs: [
      { key: "offer", label: "Offer or lead magnet being promoted", type: "text", placeholder: "e.g. Free First-Sale Checklist" },
      { key: "provenAngle", label: "Organic post or angle that already resonated", type: "textarea", placeholder: "Paste your proven message or hook" }
    ],
    optionalInputs: [],
    autoContextDomains: ["identity", "business", "audience", "products"],
    aiInstructions: "Draft 3 ad copy variations (Primary Text, Headline, Description, CTA) without exaggerated income promises or policy-violating claims.",
    outputSchema: [
      { key: "variation1", label: "Variation 1 — Direct Outcome" },
      { key: "variation2", label: "Variation 2 — Story / Insight" },
      { key: "variation3", label: "Variation 3 — Quick Checklist Hook" }
    ],
    connectedApps: ["funnelworks", "growthworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Produces 3 compliant ad copy variations."
  }),
  makeAiTool({
    appId: "adsworks",
    toolId: "video_ad_script",
    name: "Short-Form Video Ad Script",
    intent: "Write a 30-to-45 second conversational talking-head ad script.",
    availability: "Available",
    requiredInputs: [
      { key: "offer", label: "Offer or free resource", type: "text", placeholder: "e.g. Creator Playbook" }
    ],
    optionalInputs: [],
    autoContextDomains: ["identity", "audience", "products"],
    aiInstructions: "Write a natural 30-45 second script broken into Opening 3s Hook, Practical Demonstration, and Clear Next Step.",
    outputSchema: [
      { key: "hook3s", label: "First 3 Seconds Hook" },
      { key: "bodyScript", label: "Core Talking-Head Script" },
      { key: "closingCta", label: "Closing Call to Action" }
    ],
    connectedApps: ["funnelworks", "contentworks"],
    provenanceDefault: "recommendation",
    acceptanceCriteria: "Produces clear, conversational short-form script."
  }),
  makeAiTool({
    appId: "adsworks",
    toolId: "campaign_strategy_targeting",
    name: "Paid Campaign Strategy & Targeting Brief",
    intent: "Plan campaign structure, audience targeting hypotheses, and small-budget test rules.",
    availability: "Available",
    requiredInputs: [
      { key: "budget", label: "Planned test budget", type: "text", placeholder: "e.g. $10/day for 14 days" },
      { key: "goal", label: "Campaign objective", type: "select", placeholder: "Select objective", options: ["Lead Magnet Opt-Ins", "Low-Ticket Product Sales", "Discovery Call Bookings"] }
    ],
    optionalInputs: [],
    autoContextDomains: ["audience", "business", "products"],
    aiInstructions: "Create a disciplined small-budget testing plan covering campaign structure, 3 targeting segments, creative testing matrix, and stop-loss guardrails. Explicitly label targeting ideas as test hypotheses.",
    outputSchema: [
      { key: "campaignStructure", label: "Campaign & Ad Set Structure" },
      { key: "targetingHypotheses", label: "Audience Targeting Hypotheses" },
      { key: "budgetGuardrails", label: "Budget & Evaluation Guardrails" }
    ],
    connectedApps: ["funnelworks", "financeworks", "growthworks"],
    provenanceDefault: "ai_hypothesis",
    acceptanceCriteria: "Includes realistic stop-loss guardrails and zero fake ROAS claims."
  }),
  makeAiTool({
    appId: "adsworks",
    toolId: "live_ad_account_launch",
    name: "Direct Ad-Account Launch & Spend Sync",
    intent: "Publish live paid campaigns and pull live ad-spend telemetry from Meta/Google Ads.",
    mode: "operational",
    availability: "In Development",
    availabilityNote: "Live paid campaign publishing and spend synchronization require authorized Meta Marketing API / Google Ads OAuth credentials and ad-account billing approval.",
    requiredInputs: [],
    optionalInputs: [],
    autoContextDomains: [],
    aiInstructions: "Gated external ad platform integration.",
    outputSchema: [{ key: "status", label: "Ad API Status" }],
    connectedApps: ["financeworks"],
    provenanceDefault: "user_provided_fact",
    acceptanceCriteria: "Honestly gated as In Development; never simulates live ad spend."
  }),

  // =========================================================================
  // 20. PROJECT Z (Isolated Experimental Lab)
  // =========================================================================
  makeAiTool({
    appId: "projectz",
    toolId: "business_scenario_sim",
    name: "Hypothetical Business Scenario Simulator",
    intent: "Stress-test bold creator business models inside an isolated sandbox.",
    availability: "Available",
    requiredInputs: [
      { key: "scenario", label: "Scenario to simulate", type: "textarea", placeholder: "e.g. Transitioning from 1:1 coaching to a $49/mo creator membership + templates" }
    ],
    optionalInputs: [],
    autoContextDomains: ["identity", "business", "products"],
    aiInstructions: "Run a structured scenario simulation showing upside levers, operational bottlenecks, hidden tradeoffs, and a 14-day safe pilot. Explicitly mark all outputs as HYPOTHETICAL SANDBOX EXPERIMENTS isolated from production data.",
    outputSchema: [
      { key: "scenarioAnalysis", label: "Hypothetical Model Breakdown" },
      { key: "tradeoffsAndRisks", label: "Key Tradeoffs & Failure Modes" },
      { key: "safePilot", label: "Low-Risk Validation Experiment" }
    ],
    connectedApps: ["demandworks", "offerworks"],
    provenanceDefault: "ai_hypothesis",
    acceptanceCriteria: "Clearly labeled hypothetical and strictly isolated from live production records."
  }),
  makeAiTool({
    appId: "projectz",
    toolId: "multi_agent_prototype",
    name: "Multi-Agent Creator Workflow Prototype",
    intent: "Design experimental multi-step AI agent handoffs with human review checkpoints.",
    availability: "Available",
    requiredInputs: [
      { key: "workflowIdea", label: "Experimental workflow idea", type: "textarea", placeholder: "e.g. Research agent -> Offer draft agent -> Human approval -> Content brief agent" }
    ],
    optionalInputs: [],
    autoContextDomains: ["business", "projects"],
    aiInstructions: "Architect an experimental multi-agent workflow spec with agent roles, input/output contracts, failure modes, and mandatory human approval boundaries. Mark explicitly as an experimental prototype.",
    outputSchema: [
      { key: "agentTopology", label: "Experimental Agent Roles & Handoffs" },
      { key: "humanCheckpoints", label: "Mandatory Human Approval Gates" },
      { key: "nextPrototypeStep", label: "How to Test Safely" }
    ],
    connectedApps: ["automationworks"],
    provenanceDefault: "ai_hypothesis",
    acceptanceCriteria: "Saved only inside isolated Project Z sandbox records."
  })
];

export function getToolsForApp(appId: string): EcosystemToolDefinition[] {
  return ECOSYSTEM_TOOL_REGISTRY.filter((t) => t.appId === appId);
}

export function getToolDefinition(appId: string, toolId: string): EcosystemToolDefinition | undefined {
  return ECOSYSTEM_TOOL_REGISTRY.find((t) => t.appId === appId && t.toolId === toolId);
}
