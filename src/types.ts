export interface CharacterAvatarConfig {
  name?: string; // Customizable character name (e.g., "Luna", "Aero", "Douglas")
  baseCharacter: string; // "human-creator" | "robo-buddy" | "cosmic-cat" | "zen-panda" | "capybara-craft" | "minimal-pixel" | "fox-strategist" | "cyber-bunny" | "owl-scholar"
  appearance: {
    skinTone: string;
    faceShape?: string; // "round" | "oval" | "square" | "heart"
    hairStyle: string; // "swoop" | "curly" | "long" | "spiky" | "bob" | "ponytail" | "bun" | "braids" | "buzz" | "beanie"
    hairColor: string;
    eyeStyle: string; // "classic" | "sparkle" | "calm" | "cateye" | "confident" | "curious"
    eyebrows?: string; // "natural" | "arched" | "bold" | "straight"
  };
  clothing: {
    category?: string; // "tops" | "jackets" | "hoodies" | "dresses"
    style: string; // "crewneck" | "hoodie" | "blazer" | "denim" | "sweater" | "dress" | "polo" | "bomber" | "biker" | "cardigan"
    color: string;
    accentColor?: string;
    bottoms?: string; // "jeans" | "chinos" | "skirt" | "shorts" | "joggers"
    bottomsColor?: string;
    shoes?: string; // "sneakers" | "boots" | "loafers" | "slides" | "high-tops"
    shoesColor?: string;
    hat?: string; // "none" | "beanie" | "snapback" | "beret" | "bucket" | "headband"
    hatColor?: string;
  };
  accessories: string[]; // ["glasses", "sunglasses", "headphones", "gold-chain", "pearls", "watch", "backpack", "crossbody", "coffee", "sparkles", "mic", "crown", "laptop"]
  expression: string; // "happy" | "confident" | "thinking" | "surprised" | "excited" | "laughing" | "celebrating" | "curious" | "zen" | "winking"
  avatarStyle: string; // "cute-cartoon" | "3d-character" | "illustrated" | "mascot" | "cute-vector" | "claymorphism" | "retro-pixel" | "sticker" | "minimal-line"
  backdrop?: string; // "gradient-purple" | "gradient-sunset" | "gradient-cyber" | "gradient-emerald" | "solid-cream" | "studio-dark"
}

export interface CreatorIdentity {
  // Raw Unified Voice Context Input
  rawVoice?: string;

  // Section 1: Your Personality
  personality: string;
  howYouThink: string;
  whatYouBelieve: string;
  yourExperiences: string;
  yourExpertise: string;
  yourHumor: string;
  yourPerspective: string;

  // Section 2: Your Voice
  writingStyle: string;
  tone: string;
  wordsYouUse: string;
  wordsYouAvoid: string;

  // Section 3: Your Audience & Purpose
  whoYouHelp: string;
  whatYouHelpThemDo: string;
  whatYoureKnownFor: string;
  whatYouTalkAbout: string;
  whatYouWantPeopleToRemember: string;

  // Section 4: Your Character
  character: CharacterAvatarConfig;
}

export interface ContentPillar {
  title: string; // Name of the Content Pillar
  description: string;
  coreExpertise?: string;
  keyVocabulary?: string;
  mentalModels?: string;
  primaryQuestion?: string;
  topicsToAvoid?: string;
  successCriteria?: string;
}

export interface IdentifiedOffer {
  id: string;
  name: string;
  type?: string; // "service" | "digital_product" | "coaching" | "consulting" | "software" | "course" | "community" | "hybrid" | "unspecified";
  format?: string; // e.g. "1-on-1 implementation sprint", "self-paced video guide", "monthly retainer"
  price?: string; // when provided, e.g. "$3,500", "$17", "$149 one-time"
  purchasePath?: string; // e.g. "link in bio", "DM 'SYSTEM'", "Application call"
  purpose?: string; // why the offer exists / the specific job it does
  targetCustomer?: {
    intendedAudience?: string;
    intendedBuyer?: string;
    situation?: string;
    experienceLevel?: string;
  };
  problem?: {
    problemStatement?: string;
    symptoms?: string[];
    friction?: string;
    rootProblem?: string;
    status?: "known" | "supported" | "unknown";
  };
  desiredOutcome?: {
    buyerDesire?: string;
    practicalOutcome?: string;
    businessOutcome?: string;
  };
  solution?: {
    deliverables?: string[];
    components?: string[];
    frameworks?: string[];
    support?: string;
    access?: string;
  };
  mechanism?: {
    method?: string;
    framework?: string;
    system?: string;
    isProprietary?: boolean;
  };
  value?: {
    coreValue?: string;
    timeOrComplexityReduction?: string;
  };
  differentiation?: {
    distinctApproach?: string;
    positioningDifference?: string;
  };
  purchaseBarriers?: {
    knownBarriers?: string[];
  };
  proof?: {
    evidence?: string[];
    credentials?: string;
  };
  cta?: {
    preferredAction?: string;
    handRaiserKeywords?: string[];
  };
  relationshipToOtherOffers?: string; // "primary_core" | "entry_point" | "premium_upgrade" | "complementary" | "standalone" | "unspecified";
  confidenceSummary?: {
    knownElements: string[];
    supportedElements: string[];
    unknownElements: string[];
  };
}

export interface OfferIntelligenceData {
  offers: IdentifiedOffer[];
  primaryOfferName?: string;
  offerRelationshipsSummary?: string;
  lastUpdated?: string;
}

export interface BuyerIdentity {
  intendedBuyer?: string; // Role, characteristics, situation
  sophisticationLevel?: string; // e.g. "beginner", "intermediate", "experienced operator"
  goals?: string[]; // Stated practical and business goals
  experienceLevel?: string;
}

export interface BuyerCurrentSituation {
  currentActivities?: string[]; // What they are doing now
  frictionPoints?: string[]; // Where they are stuck / what is not working
  previousAttempts?: string[]; // What they have already tried
  gapDescription?: string; // Gap between current state and desired state
}

export interface BuyerProblems {
  surfaceSymptoms?: string[]; // Visible day-to-day symptoms
  practicalProblems?: string[]; // Operational / practical workflow problems
  businessOrFinancialProblems?: string[]; // Business / revenue consequences
  emotionalFrustrations?: string[]; // Friction / stress points
  rootProblem?: string; // Underlying core problem
  costOfInaction?: string; // Consequences of remaining stuck
}

export interface BuyerDesiredOutcomes {
  functionalOutcomes?: string[]; // Specific practical deliverables/results
  businessFinancialOutcomes?: string[]; // Commercial and revenue goals
  emotionalPeaceOutcomes?: string[]; // Relief, confidence, certainty
  lifestyleOrIdentityOutcomes?: string[]; // Evolution of their identity or lifestyle
}

export interface BuyerAwareness {
  problemAwareness?: "unaware" | "problem_aware" | "solution_aware" | "offer_aware" | "most_aware" | "unspecified";
  understandingOfSolutionCategory?: string;
  awarenessNotes?: string;
}

export interface BuyerDesiresAndMotivations {
  wantsToAchieve?: string[];
  wantsToAvoid?: string[];
  wantsToFeel?: string[];
  wantsToStopWorryingAbout?: string[];
}

export interface BuyerObjectionsAndBarriers {
  knownBarriers?: string[]; // Explicitly confirmed in creator context
  supportedBarriers?: string[]; // Strongly implied by context
  unknownBarriers?: string[]; // Unstated / unknown
}

export interface BuyerBeliefs {
  limitingBeliefs?: string[]; // e.g. "I need a bigger audience first", "I can figure this out alone"
  enablingBeliefs?: string[]; // Beliefs that support confident action
}

export interface BuyingTriggers {
  legitimateTriggers?: string[]; // Problem recognition, cost of inaction, believable path, proven mechanism, timing
}

export interface DecisionCriteria {
  evaluationFactors?: string[]; // Trust, clarity, proof, simplicity, relevance, ease of execution
}

export interface ConversionGaps {
  currentGap?: string; // Where the gap lies (e.g. understands problem but doesn't understand distinction of offer)
  bridgeRequirement?: string; // What information/proof bridges the gap
}

export interface BuyerOfferConnection {
  connectedOfferId?: string;
  connectedOfferName?: string;
  whyBuyerNeedsOffer?: string;
  relevanceHook?: string;
}

export interface BuyerSegment {
  id: string;
  name: string; // Identifier / name of this buyer group (e.g. "Early-Stage B2B Founders", "Freelancers scaling to agency")
  identity?: BuyerIdentity;
  situation?: BuyerCurrentSituation;
  problems?: BuyerProblems;
  desiredOutcomes?: BuyerDesiredOutcomes;
  awareness?: BuyerAwareness;
  desires?: BuyerDesiresAndMotivations;
  barriers?: BuyerObjectionsAndBarriers;
  beliefs?: BuyerBeliefs;
  triggers?: BuyingTriggers;
  decisionCriteria?: DecisionCriteria;
  conversionGap?: ConversionGaps;
  offerConnection?: BuyerOfferConnection;
  confidenceSummary?: {
    knownElements: string[];
    supportedElements: string[];
    unknownElements: string[];
  };
}

export interface ContentDestination {
  id: string;
  name: string;
  url: string;
  purpose?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BuyerIntelligenceData {
  buyers: BuyerSegment[];
  primaryBuyerSummary?: string;
  marketDynamicsContext?: string;
  lastUpdated?: string;
}

export interface SavedCreatorTab {
  id: string; // e.g. "default", "tab_1", etc.
  userId: string;
  name: string;
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;

  // Isolated creator configuration:
  myVoice: {
    writingStyle?: string;
    tone?: string;
    rawVoice?: string;
    creatorIdentity?: CreatorIdentity;
  };
  myBusiness: {
    offer?: string;
    audience?: string;
    desiredResult?: string;
    rawBusinessText?: string;
    offerIntelligence?: OfferIntelligenceData;
    buyerIntelligence?: BuyerIntelligenceData;
  };
  contentInstructions?: string;
  ctaConfig?: {
    ctaPreferences?: string;
    contentDestinations?: ContentDestination[];
    activeCta?: { message: string; linkUrl?: string; angle?: string } | null;
  };
  generationPreferences?: {
    threadLength?: string;
    sentencesPerPart?: string;
    postsToCreate?: string;
    activeCategory?: "attention" | "trust" | "sales";
  };
  contentPillars?: ContentPillar[];
  activeIdea?: { title: string; summary: string; originalIdea: string } | null;
  rawCreatorThought?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  offer: string;          // What You Sell
  audience: string;       // Who You Help
  desiredResult: string;  // Desired Result
  writingStyle: string;   // Writing Style
  customInstruction?: string; // Custom instructions / framework
  ctaPreferences?: string;    // Custom Call-to-Action preferences & rules
  contentDestinations?: ContentDestination[]; // Saved links & destination URLs
  keywords?: string;      // Supporting keywords / vocabulary
  googleAnalyticsId?: string; // Google Tracking Tag / Analytics ID
  contentPillars?: ContentPillar[];
  activePillarIndex?: number;
  isPillarFilteringActive?: boolean;
  rawVoice?: string;
  rawBusinessText?: string;
  creatorIdentity?: CreatorIdentity;
  offerIntelligence?: OfferIntelligenceData;
  buyerIntelligence?: BuyerIntelligenceData;
  createdAt?: any;
  updatedAt?: any;
}

export interface ContentDecision {
  objective: string; // e.g. "Problem recognition", "Belief change", "Authority", "Desire amplification", "Objection reduction", "Sales / Hand-raiser", "Proof"
  targetBuyer: string;
  buyerNeed: string;
  problemOrDesire: string;
  awarenessContext: string;
  beliefOrBarrier: string;
  coreIdea: string;
  strategicAngle: string;
  contentType: string; // "Educational", "Authority", "Story", "Proof", "Conversation", "Promotional", "Objection"
  pillarTitle?: string;
  offerRelationship: string; // "none" | "soft_connection" | "relevant_cta" | "direct_offer" | "direct_sales"
  cta?: string;
  strategicReason: string;
  buyerMovement?: string;
  
  // Structural Intelligence Recommendations
  recommendedPartCount?: number;          // e.g. 1, 2, 3, 4, 5, 6
  recommendedSentencesPerPart?: number;  // e.g. 1, 2, 3, 4, 5, 6
  recommendedLength?: string;            // e.g. "1", "2", "3", "4", "5", "quick", "standard", "deep"
  structuralPacingGuidance?: string;      // e.g. "2-part contrasting hook with punchy 2-sentence capacity for high mobile scroll completion"
}

export interface ThreadsPost {
  id?: string;
  userId: string;
  title: string;
  hook: string;
  singlePost: string;
  explanation: string;
  threadPosts: string[];
  topic: string;
  format: string;
  decision?: ContentDecision;
  createdAt: any; // timestamps
}

export interface ThreadsConnection {
  userId: string;
  threadsUserId: string;
  threadsUsername: string;
  connectionStatus: "connected" | "disconnected";
  lastConnectedAt: string;
  tokenMetadata: {
    generatedAt: string;
    expiresAt?: string;
    sandbox?: boolean;
    hasToken?: boolean;
  };
}

export interface CashMachineRecommendedAngle {
  type: string;
  hookPattern: string;
  cta: string;
}

export interface CashMachineCitation {
  source: string;
  page: number;
  principle: string;
}

export interface CashMachineDiagnosis {
  constraint: string;
  symptom: string;
  rootCause: string;
  whatNotToDo: string;
  nextBestAction: string;
  recommendedAngles: CashMachineRecommendedAngle[];
  cashMachineCitations: CashMachineCitation[];
}

export interface UserContentMemoryHook {
  hook: string;
  type?: string;
  topic?: string;
}

export interface UserContentMemoryAngle {
  angle: string;
  concept: string;
  category?: string;
}

export interface UserContentMemoryProfile {
  userId: string;
  lastUpdated: number;
  totalPostsIndexed: number;
  recentHooks: UserContentMemoryHook[];
  coreThemes: Array<{ theme: string; count: number }>;
  exploredAngles: UserContentMemoryAngle[];
  authenticVocabulary: string[];
  signaturePhrases: string[];
  contentStructures: string[];
  winningPatterns: Array<{ title: string; hook: string; keyStrength?: string }>;
  contentGaps: string[];
  recentCtas: string[];
}

export type CreationMode = "ai" | "manual";

export type ContentActionType = 
  | "CREATE"
  | "REGENERATE"
  | "IMPROVE"
  | "ADD_HOOK"
  | "CHANGE_HOOK"
  | "ADD_CTA"
  | "CHANGE_CTA"
  | "CHANGE_ANGLE"
  | "CREATE_VARIATION"
  | "EXPAND"
  | "REWORK"
  | "GENERATE_MORE";

export interface CreationContext {
  creatorRequest?: string;
  currentGoal?: string;
  topic?: string;
  contentPillar?: string;
  intent?: string;
  profileContext?: {
    voice?: string;
    business?: string;
    instructions?: string;
    cta?: string;
  };
  relevantContentIds?: string[];
  sourceContentIds?: string[];
  requestedTransformation?: ContentActionType;
  selectedContentIds?: string[];
  sourceApp?: string;
}

export interface ContentActionPayload {
  actionType: ContentActionType;
  targetContentIds?: string[];
  targetComponent?: "hook" | "body" | "cta" | "angle" | "structure" | "all";
  requestedChange?: string;
  creationContext?: CreationContext;
  componentsToPreserve?: Array<"hook" | "body" | "cta" | "angle" | "structure">;
}

export * from './types/analytics';
export * from './types/contentMemory';
export * from './types/strategy';

export interface StrategicAngle {
  id: string;
  sourceIdea: string;
  angleTitle: string;
  strategicLens: string;
  centralThesis: string;
  readerProblem: string;
  readerOutcome: string;
  differentiationReason: string;
  summary?: string;
  title?: string; // backwards compatibility
  perspective?: string; // backwards compatibility
}

export interface StrategicHook {
  id: string;
  angleId?: string;
  text: string;
  approach: string;
  why?: string;
  hookPromise?: string;
  score?: number;
  scoreFactors?: string[];
}

export interface StrategicContentUnit {
  id: string;
  sourceIdea: string;
  angle: StrategicAngle;
  hook?: StrategicHook;
  hookPromise: string;
  contentPlan?: any;
  parts?: string[];
  singlePost?: string;
  cta?: string;
  compliance?: any;
}



