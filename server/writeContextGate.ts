/**
 * ThreadsWorks Context Gatekeeper (Module 1)
 *
 * Strictly separates Creator Voice, Execution Directives, and Business Context.
 * - VoiceSpec is ALWAYS preserved so every post sounds like the creator.
 * - DirectiveSpec is ALWAYS honored (request, custom instructions, pillar, CTA rules, lengths).
 * - BusinessContext is STRICTLY RELEVANCE-GATED against the user's request so general or
 *   off-niche prompts never get hijacked by unsolicited business pitches or synthetic defaults.
 */

export type BusinessRelevanceLevel = "omit" | "light_lens" | "include_full";

export type ContentDepthProfile =
  | "short_observation"
  | "personal_reflection"
  | "educational_explanation"
  | "complex_tutorial"
  | "standard";

export const UNIVERSAL_AUTO_MIN_PARTS = 1;
export const UNIVERSAL_AUTO_MAX_PARTS = 10;

export type EffectiveLengthPolicy =
  | "explicit_request"
  | "explicit_setting"
  | "auto_1_to_10"
  | "auto_compact_observation";

export type ContentSubstanceLevel =
  | "open_broad"
  | "focused"
  | "rich_narrative"
  | "structured_educational"
  | "deep_walkthrough";

export interface WritingLengthPlan {
  /** Classified complexity/depth archetype derived primarily from contentRequest */
  profile: ContentDepthProfile;
  /** Authoritative source of the effective length policy */
  effectiveLengthPolicy?: EffectiveLengthPolicy;
  /** Content substance classification decoupled from prompt word count */
  substanceLevel?: ContentSubstanceLevel;
  /** Whether thread length was explicitly requested via parameter or contentRequest */
  partCountMode: "explicit" | "auto";
  /** Target number of parts (exact when explicit; AI-recommended target when auto) */
  recommendedParts: number;
  /** Minimum acceptable parts for this request */
  minParts: number;
  /** Maximum acceptable parts for this request */
  maxParts: number;
  /** Preferred natural lower bound for AI-guided sampling within [minParts, maxParts] */
  preferredMinParts?: number;
  /** Preferred natural upper bound for AI-guided sampling within [minParts, maxParts] */
  preferredMaxParts?: number;
  /** Whether sentences per part was explicitly requested via parameter or contentRequest */
  sentencesMode: "explicit" | "auto";
  /** Target sentences per part calibrated for clarity, readability, and characterLimit */
  recommendedSentencesPerPart: number;
  /** Minimum natural sentences per part */
  minSentencesPerPart: number;
  /** Maximum natural sentences per part calibrated for characterLimit */
  maxSentencesPerPart: number;
  /** Explicit batch post count extracted from contentRequest if present */
  explicitPostCount?: number;
  /** Concise structural pacing guidance shared across recommendations, prompts, and review */
  pacingGuidance: string;
  /** Short rationale explaining why this structure fits the request */
  rationale: string;
}

export interface VoiceSpec {
  writingStyle: string;
  rawVoice: string;
  identity: Record<string, any>;
  wordsToAvoid: string;
}

export interface DirectiveSpec {
  contentRequest: string;
  customInstruction: string;
  activePillar: any | null;
  activeIdea: any | null;
  rawCreatorThought: string;
  category: string;
  characterLimit: number;
  partCount?: number;
  sentencesPerPart: string | number;
  writingPlan: WritingLengthPlan;
  ctaPreferences: string;
  ctaOff: boolean;
  activeCta: any | null;
  destinations: Array<{ id?: string; name: string; url: string; purpose?: string }>;
  lockedOpeningHook: string | null;
  activeStrategicAngle: string | null;
}

export interface BusinessContextSpec {
  offer: string;
  rawBusinessText: string;
  audience: string;
  desiredResult: string;
  offerInformation: Record<string, any>;
  audienceInformation: Record<string, any>;
}

export interface GatedWriteContext {
  voice: VoiceSpec;
  directives: DirectiveSpec;
  writingPlan: WritingLengthPlan;
  /** Gated business context actually included in the model prompt (empty object when omitted) */
  gatedBusiness: Partial<BusinessContextSpec>;
  /** Full underlying business context kept only for groundedness verification if referenced */
  rawBusiness: BusinessContextSpec;
  businessRelevance: BusinessRelevanceLevel;
  businessGuidanceNote: string;
  allowedUrls: string[];
  groundingSourceTexts: string[];
  verbatimSourceTexts: string[];
  /** Backwards-compatible compact facts object for V3 batch assignment */
  factsPayload: Record<string, any>;
}

const SYNTHETIC_DEFAULT_PHRASES = new Set([
  "a high-value product or service",
  "high-value offer",
  "your product",
  "creator offer",
  "creator offer / resource",
  "custom training frameworks",
  "ambitious creators and entrepreneurs",
  "ambitious audience",
  "ambitious operators",
  "ambitious learners",
  "target audience",
  "predictable growth and engagement",
  "scalable predictable growth",
  "predictable growth",
  "desired outcome",
  "desired result",
  "desired transformation",
  "streamlined execution",
  "not specified",
  "none specified",
  "n/a"
]);

const GATE_STOPWORDS = new Set([
  "the", "and", "for", "that", "this", "with", "from", "your", "you", "are", "was", "were",
  "have", "has", "had", "not", "but", "what", "when", "where", "which", "who", "how", "why",
  "can", "will", "just", "more", "most", "some", "about", "into", "over", "after", "before",
  "than", "then", "them", "they", "their", "our", "out", "use", "using", "used", "make",
  "making", "build", "building", "create", "creating", "post", "posts", "thread", "threads",
  "write", "writing", "content", "people", "things", "thing", "really", "very", "much",
  "many", "every", "each", "other", "also", "even", "still", "only", "want", "need", "help",
  "good", "best", "better", "great", "work", "working", "day", "time", "way", "ways", "today"
]);

/**
 * Strips synthetic fallback strings so unconfigured business fields remain genuinely empty.
 */
export function stripSyntheticDefault(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (SYNTHETIC_DEFAULT_PHRASES.has(trimmed.toLowerCase())) return "";
  return trimmed;
}

function tokenizeDomainTerms(text: string): Set<string> {
  if (!text) return new Set();
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .map(t => t.replace(/^['-]+|['-]+$/g, ""))
    .filter(t => t.length >= 4 && !GATE_STOPWORDS.has(t));
  return new Set(tokens);
}

function normalizeUrlList(
  suppliedDestinations: any[],
  extraTextsForUrlScan: string[]
): {
  destinations: Array<{ id?: string; name: string; url: string; purpose?: string }>;
  allowedUrls: string[];
} {
  const destinations = (Array.isArray(suppliedDestinations) ? suppliedDestinations : []).flatMap((d: any) => {
    const candidate = typeof d?.url === "string" ? d.url.trim() : "";
    if (!candidate) return [];
    try {
      const url = new URL(/^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`);
      return /^https?:$/.test(url.protocol)
        ? [{ id: d.id, name: String(d.name || "").trim(), url: url.href, purpose: d.purpose ? String(d.purpose).trim() : undefined }]
        : [];
    } catch {
      return [];
    }
  });

  const scannedUrls: string[] = [];
  for (const text of extraTextsForUrlScan) {
    if (!text) continue;
    const matches = text.match(/https?:\/\/[^\s"<>)]+/g);
    if (matches) {
      scannedUrls.push(...matches);
    }
  }

  const allowedUrls = Array.from(
    new Set(
      [...destinations.map(d => d.url), ...scannedUrls].map(u => u.replace(/[.,;!?)]+$/, ""))
    )
  );

  return { destinations, allowedUrls };
}

/**
 * Deterministic strict relevance gate for Business/Offer/Buyer context.
 * Voice is NEVER gated here — only commercial positioning and offers.
 */
export function classifyBusinessRelevance(params: {
  contentRequest: string;
  activeIdea?: any;
  rawCreatorThought?: string;
  activePillar?: any;
  business: BusinessContextSpec;
  category?: string;
  ctaOff: boolean;
  ctaPreferences?: string;
  activeCta?: any;
}): { level: BusinessRelevanceLevel; matchedTerms: string[]; reason: string } {
  const {
    contentRequest,
    activeIdea,
    rawCreatorThought,
    activePillar,
    business,
    category,
    ctaOff,
    ctaPreferences,
    activeCta
  } = params;

  const hasAnyBusinessData = Boolean(
    business.offer ||
    business.rawBusinessText ||
    business.audience ||
    business.desiredResult ||
    Object.keys(business.offerInformation || {}).length > 0 ||
    Object.keys(business.audienceInformation || {}).length > 0
  );

  if (!hasAnyBusinessData) {
    return { level: "omit", matchedTerms: [], reason: "No business positioning configured." };
  }

  const normalizedCategory = String(category || "").toLowerCase().trim();
  const normalizedCtaPrefs = String(ctaPreferences || "").toLowerCase();
  const explicitUseMyCta = !ctaOff && (
    normalizedCtaPrefs.includes("use my cta") ||
    Boolean(activeCta && (typeof activeCta === "string" ? activeCta.trim() : (activeCta.message || activeCta.text)))
  );

  const requestCorpus = [
    contentRequest,
    typeof activeIdea === "string" ? activeIdea : `${activeIdea?.title || ""} ${activeIdea?.originalIdea || ""} ${activeIdea?.summary || ""}`,
    rawCreatorThought || ""
  ].filter(Boolean).join(" ").trim();

  const businessCorpus = [
    business.offer,
    business.rawBusinessText,
    business.audience,
    business.desiredResult,
    typeof business.offerInformation?.coreOffer === "string" ? business.offerInformation.coreOffer : "",
    Array.isArray(business.offerInformation?.offers)
      ? business.offerInformation.offers.map((o: any) => `${o?.name || ""} ${o?.purpose || ""} ${o?.problem?.problemStatement || ""}`).join(" ")
      : ""
  ].filter(Boolean).join(" ");

  const requestTokens = tokenizeDomainTerms(requestCorpus);
  const businessTokens = tokenizeDomainTerms(businessCorpus);
  const matchedTerms: string[] = [];

  for (const token of requestTokens) {
    if (businessTokens.has(token)) {
      matchedTerms.push(token);
    }
  }

  // Check explicit offer name mention in request
  const offerLower = business.offer.toLowerCase();
  const requestLower = requestCorpus.toLowerCase();
  const directOfferMention =
    offerLower.length >= 4 &&
    requestLower.includes(offerLower);

  // Explicit sales category or direct commercial offer mention
  if (normalizedCategory === "sales" && !ctaOff) {
    return {
      level: "include_full",
      matchedTerms,
      reason: "Sales category explicitly requests commercial alignment."
    };
  }

  if (directOfferMention || matchedTerms.length >= 2) {
    return {
      level: "include_full",
      matchedTerms,
      reason: directOfferMention
        ? "Content request directly references the creator's offer."
        : `Strong domain overlap (${matchedTerms.slice(0, 4).join(", ")}).`
    };
  }

  if (explicitUseMyCta && matchedTerms.length >= 1) {
    return {
      level: "include_full",
      matchedTerms,
      reason: "Explicit CTA preference combined with topical overlap."
    };
  }

  // Check if active pillar overlaps with request or business
  const pillarCorpus = activePillar
    ? `${activePillar.title || ""} ${activePillar.description || ""} ${activePillar.coreExpertise || ""}`
    : "";
  const pillarTokens = tokenizeDomainTerms(pillarCorpus);
  let pillarOverlap = 0;
  for (const token of requestTokens) {
    if (pillarTokens.has(token)) pillarOverlap++;
  }

  if (matchedTerms.length === 1 || pillarOverlap >= 2) {
    return {
      level: "light_lens",
      matchedTerms,
      reason: matchedTerms.length === 1
        ? `Light topical overlap (${matchedTerms[0]}); applying expertise lens without commercial pitch.`
        : "Active content pillar overlaps request; applying expertise lens without offer pitch."
    };
  }

  // If no explicit topic was entered (e.g. Create Best Post automatic opportunity selection)
  if (!requestCorpus) {
    return {
      level: "include_full",
      matchedTerms: [],
      reason: "Automatic opportunity mode with no explicit topic constraint."
    };
  }

  return {
    level: "omit",
    matchedTerms: [],
    reason: "Request is general or off-niche relative to business profile; preserving creator voice only."
  };
}

const SMALL_NUMBER_WORDS: Record<string, number> = {
  one: 1,
  single: 1,
  standalone: 1,
  two: 2,
  couple: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15
};

function parseSmallNumberToken(token: string | undefined): number | undefined {
  if (!token) return undefined;
  const cleaned = token.toLowerCase().trim();
  if (/^\d+$/.test(cleaned)) {
    const n = Number(cleaned);
    return Number.isInteger(n) ? n : undefined;
  }
  return SMALL_NUMBER_WORDS[cleaned];
}

/**
 * Returns true when a threadLength / sentencesPerPart / postCount parameter is unset or set to AI/auto mode.
 */
export function isAutoSetting(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  const normalized = String(value).trim().toLowerCase();
  return (
    normalized === "" ||
    normalized === "auto" ||
    normalized === "ai" ||
    normalized === "ai decides" ||
    normalized === "recommended" ||
    normalized === "default" ||
    normalized === "natural"
  );
}

const NUMBER_TOKEN_PATTERN = "(?:\\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)";

/**
 * Extracts an explicitly requested batch post/draft count from the creator's contentRequest
 * (e.g. "Write 4 posts about...", "Create 3 threads on...", "Give me 5 standalone posts").
 * Never confuses thread parts ("5-part thread", "in 4 parts") or enumerated topic items ("5 steps")
 * with batch post count.
 */
export function extractExplicitPostCount(text: string): number | undefined {
  const input = String(text || "").trim();
  if (!input) return undefined;

  // Guard against confusing "a 5-part thread" or "5-post thread" with 5 separate posts
  const sanitized = input
    .replace(/\b\d{1,2}\s*[- ]?\s*(?:part|post)\s+thread\b/gi, " ")
    .replace(/\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*[- ]?\s*(?:part|post)\s+thread\b/gi, " ");

  const patterns = [
    new RegExp(
      `\\b(?:write|create|generate|give\\s+me|make|produce|draft|need|want|build)\\s+(?:a\\s+)?(?:batch\\s+of\\s+|set\\s+of\\s+)?(${NUMBER_TOKEN_PATTERN})\\s+(?:separate\\s+|distinct\\s+|different\\s+|unique\\s+|short\\s+|quick\\s+|standalone\\s+|single\\s+|threads?\\s+)?(?:posts?|threads?|drafts?)\\b`,
      "i"
    ),
    new RegExp(
      `^\\s*(${NUMBER_TOKEN_PATTERN})\\s+(?:separate\\s+|distinct\\s+|different\\s+|unique\\s+|short\\s+|quick\\s+|standalone\\s+|single\\s+)?(?:posts?|threads?|drafts?)\\b`,
      "i"
    ),
    new RegExp(
      `\\b(${NUMBER_TOKEN_PATTERN})\\s+(?:separate|distinct|different|unique)\\s+(?:posts?|threads?|drafts?)\\b`,
      "i"
    )
  ];

  for (const re of patterns) {
    const match = sanitized.match(re);
    if (match) {
      const parsed = parseSmallNumberToken(match[1]);
      if (parsed !== undefined && parsed >= 1 && parsed <= 32) {
        return parsed;
      }
    }
  }

  // Singular explicit post phrasing when not preceded by a plural count
  if (/\b(?:write|create|generate|give\s+me|make|draft|just|only)\s+(?:a\s+|one\s+)?(?:single|standalone)\s+post\b/i.test(sanitized)) {
    return 1;
  }

  return undefined;
}

/**
 * Extracts an explicitly requested thread length (number of parts per post) from user text
 * (e.g. "5-part thread", "in 4 parts", "3-post thread", "single post", "standalone post").
 */
export function extractExplicitPartCount(text: string): number | undefined {
  const input = String(text || "").trim();
  if (!input) return undefined;

  const numPat = "(?:\\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen)";

  const explicitMultiPatterns = [
    new RegExp(`\\b(${numPat})\\s*[- ]\\s*part(?:s)?\\b`, "i"),
    new RegExp(`\\b(${numPat})\\s*[- ]\\s*post\\s+thread\\b`, "i"),
    new RegExp(`\\b(?:thread\\s+(?:of|with|in)|in|with|using|as|make\\s+it|keep\\s+it\\s+(?:to|at)|split\\s+into|break\\s+into)\\s+(${numPat})\\s+(?:parts?|connected\\s+posts?)\\b`, "i"),
    new RegExp(`\\b(${numPat})\\s+(?:connected|linked|sequential)\\s+posts?\\b`, "i"),
    new RegExp(`\\bthread\\s+length\\s*[:=]?\\s*(${numPat})\\b`, "i")
  ];

  for (const re of explicitMultiPatterns) {
    const match = input.match(re);
    if (match) {
      const parsed = parseSmallNumberToken(match[1]);
      if (parsed !== undefined && parsed >= 1 && parsed <= 15) {
        return parsed;
      }
    }
  }

  // Explicit single-part / non-thread instructions
  if (
    /\b(?:single|standalone|one-part|1-part|single-part)\s+(?:post|posts|update|note|thought|observation)\b/i.test(input) ||
    /\b(?:not\s+a\s+thread|no\s+thread|don['’]?t\s+make\s+(?:it|this)\s+a\s+thread|keep\s+it\s+(?:as\s+)?(?:a\s+)?single\s+post|keep\s+it\s+to\s+(?:1|one)\s+part)\b/i.test(input)
  ) {
    return 1;
  }

  return undefined;
}

/**
 * Extracts an explicitly requested sentence count per part from user text
 * (e.g. "2 sentences per part", "3 sentences each", "1 sentence per post", "one-liner").
 */
export function extractExplicitSentencesPerPart(text: string): number | undefined {
  const input = String(text || "").trim();
  if (!input) return undefined;

  const numPat = "(?:\\d{1,2}|one|two|three|four|five|six|seven|eight)";

  const patterns = [
    new RegExp(`\\b(${numPat})\\s+sentences?\\s+(?:per\\s+(?:part|post|thread\\s+part|slide)|each|a\\s+part|per\\s+reply)\\b`, "i"),
    new RegExp(`\\b(?:each|every)\\s+(?:part|post)\\s+(?:should\\s+have|must\\s+have|has|with|to|at|in|max|maximum)?\\s*(?:be\\s+)?(${numPat})\\s+sentences?\\b`, "i"),
    new RegExp(`\\b(?:write|keep|limit|use|strictly|exactly|in|to|at|max(?:imum)?)\\s+(?:it\\s+(?:to|in)\\s+|each\\s+part\\s+to\\s+)?(${numPat})\\s+sentences?\\b`, "i"),
    new RegExp(`\\b(${numPat})\\s*[- ]\\s*sentence\\s+(?:post|posts|parts?|thread|observation|take|note)\\b`, "i")
  ];

  for (const re of patterns) {
    const match = input.match(re);
    if (match) {
      const parsed = parseSmallNumberToken(match[1]);
      if (parsed !== undefined && parsed >= 1 && parsed <= 8) {
        return parsed;
      }
    }
  }

  if (/\b(?:one[- ]liner|single[- ]sentence)\b/i.test(input)) {
    return 1;
  }

  return undefined;
}

/**
 * Resolves the effective number of posts to generate in a batch, honoring explicit UI/API
 * counts AND explicit post counts written in contentRequest (when the UI count is auto or untouched default).
 */
export function resolveEffectivePostCount(
  body: Record<string, any>,
  contentRequest: string,
  defaultCount: number = 1
): number {
  const promptPostCount = extractExplicitPostCount(contentRequest);
  const rawCount = body.count ?? body.postCount;

  if (isAutoSetting(rawCount)) {
    return Math.min(32, Math.max(1, promptPostCount ?? defaultCount));
  }

  const parsed = Number(rawCount);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return Math.min(32, Math.max(1, promptPostCount ?? defaultCount));
  }

  const clampedBodyCount = Math.min(32, Math.max(1, Math.round(parsed)));
  if (body.countSource === "ui_default" && promptPostCount !== undefined) {
    return Math.min(32, Math.max(1, promptPostCount));
  }

  return clampedBodyCount;
}

function extractEnumeratedTopicItems(text: string): number | undefined {
  const match = text.match(
    /\b([2-9]|1[0-2]|two|three|four|five|six|seven|eight|nine|ten)\s+(?:key\s+|core\s+|essential\s+|practical\s+|common\s+|simple\s+|clear\s+|main\s+|critical\s+|actionable\s+)?(?:steps?|stages?|phases?|principles?|rules?|mistakes?|lessons?|pillars?|habits?|reasons?|ways?|tactics?|techniques?|components?|frameworks?|levers?|checks?|shifts?|myths?|tips?|examples?|things?)\b/i
  );
  if (!match) return undefined;
  return parseSmallNumberToken(match[1]);
}

/**
 * Single canonical writing-length planner shared across AI Recommendations,
 * batch generation, single-post generation, diversity slot planning, prompts, and validation.
 *
 * Uses the creator's contentRequest as the primary input while preserving every explicit
 * user instruction (API/UI parameters or explicit text instructions in contentRequest).
 */
export function resolveWritingLengthPlan(params: {
  contentRequest: string;
  customInstruction?: string;
  activeIdea?: any;
  rawCreatorThought?: string;
  category?: string;
  threadLength?: unknown;
  sentencesPerPart?: unknown;
  format?: unknown;
  characterLimit?: number;
}): WritingLengthPlan {
  const characterLimit = Math.min(500, Math.max(50, Number(params.characterLimit) || 500));
  const contentRequest = String(params.contentRequest || "").trim();
  const customInstruction = String(params.customInstruction || "").trim();
  const ideaText =
    typeof params.activeIdea === "string"
      ? params.activeIdea.trim()
      : [params.activeIdea?.title, params.activeIdea?.originalIdea, params.activeIdea?.summary]
          .filter(Boolean)
          .join(" ")
          .trim();
  const thoughtText = String(params.rawCreatorThought || "").trim();

  // Primary topic text is ALWAYS contentRequest first; fall back to idea/thought only if empty.
  const primaryText = contentRequest || ideaText || thoughtText;
  const lower = primaryText.toLowerCase();
  const wordCount = primaryText ? primaryText.split(/\s+/).filter(Boolean).length : 0;
  const category = String(params.category || "auto").toLowerCase().trim();

  // 1. Strict 4-tier hierarchy:
  //    Tier 1: Explicit instructions in the current contentRequest
  //    Tier 2: Explicit current generation settings (threadLength, sentencesPerPart, format)
  //    Tier 3: Saved Creator Context (customInstruction) is strictly voice/knowledge/audience/grounding — NEVER parsed for length overrides!
  //    Tier 4: AI editorial decisions (1–10 parts)
  const explicitPostCount = extractExplicitPostCount(contentRequest);

  const requestExplicitParts = extractExplicitPartCount(contentRequest);
  let settingExplicitParts: number | undefined;
  if (!isAutoSetting(params.threadLength)) {
    const n = Number(params.threadLength);
    if (Number.isInteger(n) && n >= 1 && n <= 15) {
      settingExplicitParts = n;
    }
  }
  if (settingExplicitParts === undefined && String(params.format || "").toLowerCase().trim() === "single") {
    settingExplicitParts = 1;
  }
  const explicitParts: number | undefined = requestExplicitParts ?? settingExplicitParts;

  const requestExplicitSentences = extractExplicitSentencesPerPart(contentRequest);
  let settingExplicitSentences: number | undefined;
  if (!isAutoSetting(params.sentencesPerPart)) {
    const n = Number(params.sentencesPerPart);
    if (Number.isInteger(n) && n >= 1 && n <= 8) {
      settingExplicitSentences = n;
    }
  }
  const explicitSentences: number | undefined = requestExplicitSentences ?? settingExplicitSentences;

  // 2. Classify content depth & substance primarily from subject/intent (NOT raw prompt word count)
  const enumeratedCount = extractEnumeratedTopicItems(primaryText);

  const complexTutorialSignal =
    /\b(?:tutorial|step[- ]by[- ]step|walkthrough|playbook|blueprint|end[- ]to[- ]end|from\s+scratch|complete\s+guide|comprehensive\s+guide|deep\s+dive|full\s+breakdown|implementation\s+guide|setup\s+guide|migration\s+guide|exact\s+workflow|complete\s+workflow|complete\s+system|full\s+process|architecture\s+guide|how\s+to\s+build\b.*\bfrom\s+scratch)\b/i.test(
      primaryText
    ) ||
    (enumeratedCount !== undefined && enumeratedCount >= 5) ||
    (/\b(?:how\s+to|workflow|system|process|framework|configure|deploy|implement|automate|architecture|pipeline|setup)\b/i.test(
      primaryText
    ) &&
      (primaryText.split(",").length >= 3 || (/\bfrom\b/i.test(primaryText) && /\bto\b/i.test(primaryText) && /\band\b/i.test(primaryText))));

  const educationalSignal =
    /\b(?:explain|explaining|explanation|how\s+[a-z0-9\s'-]{2,40}\s+works?|why\s+[a-z0-9\s'-]{2,40}\s+(?:happens?|matters?|fails?|breaks?|works?|beats?|slows?)|difference\s+between|compared\s+to|\bvs\.?\b|\bversus\b|break\s*down|breakdown|teach|principles?|framework|mistakes?|fundamentals?|basics\s+of|mental\s+model|mechanism|guide\s+to|myths?|reasons?\s+why|signs?\s+that|ways?\s+to|how\s+to\b)\b/i.test(
      primaryText
    ) ||
    (enumeratedCount !== undefined && enumeratedCount >= 2 && enumeratedCount <= 4);

  const personalReflectionSignal =
    /\b(?:personal\s+reflection|reflection\s+on|reflect(?:ing)?\s+on|what\s+i\s+learned|lesson\s+i\s+learned|looking\s+back|my\s+experience|my\s+journey|something\s+i\s+realized|i\s+realized|i['’]?ve\s+realized|honest\s+reflection|quiet\s+realization|candid\s+(?:thought|reflection|note)|personal\s+(?:note|story|lesson|takeaway)|turning\s+point|mindset\s+shift|stepping\s+away|slowing\s+down|over\s+the\s+past\s+(?:few\s+)?(?:months?|years?|weeks?)|lately\s+i['’]?ve\s+been|what\s+changed\s+for\s+me|story\s+about|moment\s+when)\b/i.test(
      primaryText
    );

  const originOrNarrativeSubstance =
    /\b(?:how\s+i\s+(?:started|built|created|launched|designed|founded)|why\s+i\s+(?:started|built|created|designed|founded)|origin\s+story|designed\s+to\s+help|built\s+(?:it|this)\s+to|behind\s+the\s+scenes|the\s+story\s+behind|journey\s+of|from\s+idea\s+to)\b/i.test(
      primaryText
    );

  const explicitShortObservationSignal =
    /\b(?:short\s+observation|quick\s+observation|sharp\s+observation|simple\s+observation|micro\s+observation|quick\s+thought|brief\s+thought|brief\s+note|quick\s+note|hot\s+take|short\s+take|punchy\s+take|one[- ]liner|quick\s+reminder|simple\s+reminder|shower\s+thought|observation\s+about|notice\s+how|funny\s+how|weird\s+how|wild\s+how)\b/i.test(
      primaryText
    );

  const hasRichCreatorSubstance = customInstruction.length >= 60 || Boolean(ideaText) || Boolean(thoughtText);

  let profile: ContentDepthProfile = "standard";
  let substanceLevel: ContentSubstanceLevel = "open_broad";
  let autoRecommendedParts = 4;
  let autoMinParts = UNIVERSAL_AUTO_MIN_PARTS;
  let autoMaxParts = UNIVERSAL_AUTO_MAX_PARTS;
  let autoPreferredMinParts = 2;
  let autoPreferredMaxParts = 7;
  let rationale = "AI-guided variable structure (1–10 parts) matched to the idea's natural depth.";

  if (!primaryText) {
    // Automatic opportunity mode (e.g. Create Best Post with blank focus input)
    profile = "standard";
    substanceLevel = hasRichCreatorSubstance ? "rich_narrative" : "open_broad";
    autoMinParts = UNIVERSAL_AUTO_MIN_PARTS;
    autoMaxParts = UNIVERSAL_AUTO_MAX_PARTS;
    if (category === "trust") {
      autoRecommendedParts = 4;
      autoPreferredMinParts = 3;
      autoPreferredMaxParts = 8;
      rationale = "Authority-building topic supports a substantive multi-part progression (1–10 parts).";
    } else if (category === "attention") {
      autoRecommendedParts = 3;
      autoPreferredMinParts = 1;
      autoPreferredMaxParts = 6;
      rationale = "Attention-first insight scales naturally from a sharp standalone post to a focused multi-part breakdown.";
    } else if (category === "sales") {
      autoRecommendedParts = 3;
      autoPreferredMinParts = 2;
      autoPreferredMaxParts = 6;
      rationale = "Offer-focused post develops the mechanism and proof clearly without bloat.";
    } else {
      autoRecommendedParts = 4;
      autoPreferredMinParts = 2;
      autoPreferredMaxParts = 7;
      rationale = "Auto mode selects a natural 1–10 part structure based on the chosen angle and depth.";
    }
  } else if (complexTutorialSignal && !explicitShortObservationSignal) {
    profile = "complex_tutorial";
    substanceLevel = "deep_walkthrough";
    if (enumeratedCount !== undefined && enumeratedCount >= 5) {
      autoRecommendedParts = Math.min(UNIVERSAL_AUTO_MAX_PARTS, Math.max(5, enumeratedCount));
      autoMinParts = Math.max(4, autoRecommendedParts - 1);
      autoMaxParts = UNIVERSAL_AUTO_MAX_PARTS;
      autoPreferredMinParts = autoMinParts;
      autoPreferredMaxParts = Math.min(UNIVERSAL_AUTO_MAX_PARTS, autoRecommendedParts + 2);
    } else {
      autoRecommendedParts = 6;
      autoMinParts = 4;
      autoMaxParts = UNIVERSAL_AUTO_MAX_PARTS;
      autoPreferredMinParts = 5;
      autoPreferredMaxParts = 9;
    }
    rationale = `Complex tutorial / multi-step walkthrough merits ${autoMinParts}–${autoMaxParts} clean parts so every step finishes clearly without rushing or padding.`;
  } else if (
    explicitShortObservationSignal &&
    !enumeratedCount &&
    !personalReflectionSignal &&
    !originOrNarrativeSubstance &&
    !/\b(?:break\s*down|breakdown|framework|step[- ]by[- ]step|tutorial|guide|explain\s+in\s+detail)\b/i.test(primaryText)
  ) {
    // Only explicit short-observation requests stay concise (1–2 parts, preferring 1)
    profile = "short_observation";
    substanceLevel = "focused";
    autoRecommendedParts = 1;
    autoMinParts = 1;
    autoMaxParts = 2;
    autoPreferredMinParts = 1;
    autoPreferredMaxParts = 1;
    rationale = "Explicit short observation belongs in a crisp 1-part (or concise 2-part) post with zero artificial expansion.";
  } else if (personalReflectionSignal && !complexTutorialSignal) {
    profile = "personal_reflection";
    substanceLevel = "rich_narrative";
    const briefReflection = /\b(?:brief|short|quick|simple)\b/i.test(lower);
    const deepReflection = /\b(?:deep|full\s+story|journey|turning\s+point|over\s+the\s+past\s+years?)\b/i.test(lower);
    autoMinParts = briefReflection ? 1 : (deepReflection ? 2 : 1);
    autoMaxParts = UNIVERSAL_AUTO_MAX_PARTS;
    if (briefReflection) {
      autoRecommendedParts = 2;
      autoPreferredMinParts = 1;
      autoPreferredMaxParts = 3;
    } else if (deepReflection) {
      autoRecommendedParts = 5;
      autoPreferredMinParts = 3;
      autoPreferredMaxParts = 8;
    } else {
      autoRecommendedParts = 3;
      autoPreferredMinParts = 2;
      autoPreferredMaxParts = 5;
    }
    rationale = `Personal reflection adapts naturally (${autoPreferredMinParts}–${autoPreferredMaxParts} preferred within 1–10 parts) so the insight lands with genuine depth.`;
  } else if (educationalSignal) {
    profile = "educational_explanation";
    substanceLevel = "structured_educational";
    if (enumeratedCount !== undefined && enumeratedCount >= 2 && enumeratedCount <= 9) {
      autoRecommendedParts = Math.min(UNIVERSAL_AUTO_MAX_PARTS, Math.max(2, enumeratedCount));
      autoMinParts = Math.max(2, autoRecommendedParts - 1);
      autoMaxParts = UNIVERSAL_AUTO_MAX_PARTS;
      autoPreferredMinParts = autoMinParts;
      autoPreferredMaxParts = Math.min(UNIVERSAL_AUTO_MAX_PARTS, autoRecommendedParts + 2);
    } else {
      autoRecommendedParts = 4;
      autoMinParts = 2;
      autoMaxParts = UNIVERSAL_AUTO_MAX_PARTS;
      autoPreferredMinParts = 3;
      autoPreferredMaxParts = 7;
    }
    rationale = `Educational explanation scales naturally (${autoPreferredMinParts}–${autoPreferredMaxParts} preferred within ${autoMinParts}–${autoMaxParts} parts) to clarify concept, reasoning, and application cleanly.`;
  } else {
    // Standard topic prompt (short open prompts like "Write inspiring content" OR detailed origin/mission notes):
    // Depth is decided by subject complexity & available substance — NEVER by raw prompt word count.
    profile = "standard";
    substanceLevel = originOrNarrativeSubstance
      ? "rich_narrative"
      : hasRichCreatorSubstance
        ? "rich_narrative"
        : "open_broad";
    autoMinParts = UNIVERSAL_AUTO_MIN_PARTS;
    autoMaxParts = UNIVERSAL_AUTO_MAX_PARTS;
    if (category === "trust") {
      autoRecommendedParts = originOrNarrativeSubstance ? 5 : 4;
      autoPreferredMinParts = 3;
      autoPreferredMaxParts = 8;
    } else if (category === "attention") {
      autoRecommendedParts = 3;
      autoPreferredMinParts = 1;
      autoPreferredMaxParts = 6;
    } else if (category === "sales") {
      autoRecommendedParts = 3;
      autoPreferredMinParts = 2;
      autoPreferredMaxParts = 6;
    } else {
      autoRecommendedParts = originOrNarrativeSubstance ? 4 : 4;
      autoPreferredMinParts = 2;
      autoPreferredMaxParts = originOrNarrativeSubstance ? 8 : 7;
    }
    rationale = originOrNarrativeSubstance
      ? "Narrative and creator-purpose substance supports natural 1–10 part structures from sharp takeaways to developed story threads."
      : "AI-guided variable structure (1–10 parts) calibrated to topic depth, editorial angle, and available creator substance independently of prompt word count.";
  }

  // 3. Calibrate sentences per part for clarity, readability, and the 500-char Threads limit
  const limitMaxSentences =
    characterLimit <= 180 ? 2 : characterLimit <= 280 ? 2 : characterLimit <= 380 ? 3 : 4;
  const limitRecSentences =
    characterLimit <= 180 ? 1 : characterLimit <= 280 ? 2 : characterLimit <= 380 ? 2 : 3;

  let autoMinSentences = 2;
  let autoRecSentences = limitRecSentences;
  let autoMaxSentences = limitMaxSentences;

  if (profile === "short_observation") {
    autoMinSentences = 1;
    autoRecSentences = Math.min(2, limitRecSentences);
    autoMaxSentences = Math.min(3, limitMaxSentences);
  } else if (profile === "personal_reflection") {
    autoMinSentences = characterLimit <= 180 ? 1 : 2;
    autoRecSentences = Math.min(3, limitRecSentences);
    autoMaxSentences = Math.min(4, limitMaxSentences);
  } else if (profile === "educational_explanation") {
    autoMinSentences = characterLimit <= 180 ? 1 : 2;
    autoRecSentences = Math.min(3, limitRecSentences);
    autoMaxSentences = Math.min(4, limitMaxSentences);
  } else if (profile === "complex_tutorial") {
    autoMinSentences = characterLimit <= 180 ? 1 : 2;
    autoRecSentences = Math.min(3, limitRecSentences);
    autoMaxSentences = Math.min(4, limitMaxSentences);
  } else {
    autoMinSentences = characterLimit <= 180 ? 1 : 2;
    autoRecSentences = Math.min(3, limitRecSentences);
    autoMaxSentences = Math.min(4, limitMaxSentences);
  }

  // Apply explicit overrides while preserving classified profile metadata
  const partCountMode: "explicit" | "auto" = explicitParts !== undefined ? "explicit" : "auto";
  const recommendedParts = explicitParts !== undefined ? explicitParts : autoRecommendedParts;
  const minParts = explicitParts !== undefined ? explicitParts : autoMinParts;
  const maxParts = explicitParts !== undefined ? explicitParts : autoMaxParts;
  const preferredMinParts = explicitParts !== undefined ? explicitParts : Math.max(minParts, autoPreferredMinParts);
  const preferredMaxParts = explicitParts !== undefined ? explicitParts : Math.min(maxParts, Math.max(preferredMinParts, autoPreferredMaxParts));

  const sentencesMode: "explicit" | "auto" = explicitSentences !== undefined ? "explicit" : "auto";
  const recommendedSentencesPerPart = explicitSentences !== undefined ? explicitSentences : autoRecSentences;
  const minSentencesPerPart = explicitSentences !== undefined ? explicitSentences : autoMinSentences;
  const maxSentencesPerPart = explicitSentences !== undefined ? explicitSentences : autoMaxSentences;

  const partSummary =
    partCountMode === "explicit"
      ? `exactly ${recommendedParts} ${recommendedParts === 1 ? "part (standalone post)" : "parts"}`
      : minParts === maxParts
        ? `${recommendedParts} ${recommendedParts === 1 ? "part (standalone post)" : "parts"}`
        : `${minParts}–${maxParts} parts guided by content depth (typical target ~${recommendedParts} parts)`;

  const sentenceSummary =
    sentencesMode === "explicit"
      ? `exactly ${recommendedSentencesPerPart} ${recommendedSentencesPerPart === 1 ? "sentence" : "sentences"} per part`
      : `${minSentencesPerPart}–${maxSentencesPerPart} clear sentences per part (target ~${recommendedSentencesPerPart})`;

  const pacingGuidance = `Use ${partSummary} with ${sentenceSummary}, keeping every part readable and comfortably under ${characterLimit} characters. Never compress substantial ideas into shallow stubs and never pad with filler or repetition.`;

  const effectiveLengthPolicy: EffectiveLengthPolicy =
    requestExplicitParts !== undefined
      ? "explicit_request"
      : settingExplicitParts !== undefined
        ? "explicit_setting"
        : profile === "short_observation"
          ? "auto_compact_observation"
          : "auto_1_to_10";

  return {
    profile,
    effectiveLengthPolicy,
    substanceLevel,
    partCountMode,
    recommendedParts,
    minParts,
    maxParts,
    preferredMinParts,
    preferredMaxParts,
    sentencesMode,
    recommendedSentencesPerPart,
    minSentencesPerPart,
    maxSentencesPerPart,
    ...(explicitPostCount !== undefined ? { explicitPostCount } : {}),
    pacingGuidance,
    rationale:
      partCountMode === "explicit" || sentencesMode === "explicit"
        ? `Honoring explicit length instructions (${partSummary}; ${sentenceSummary}).`
        : rationale
  };
}

/**
 * Builds the strictly gated context object used by all Write endpoints.
 */
export function buildGatedWriteContext(
  resolvedContext: Record<string, any>,
  body: Record<string, any>,
  contentRequest: string
): GatedWriteContext {
  const ctaPreferences = String(
    body.ctaPreferences ?? resolvedContext.ctaPreferences ?? "AI decides; natural endings are welcome."
  ).trim();
  const ctaOff = /^off\b/i.test(ctaPreferences) || /\bno\s+cta\b/i.test(ctaPreferences) || body.ctaMode === "off";

  const writingStyle =
    stripSyntheticDefault(body.writingStyle) ||
    stripSyntheticDefault(resolvedContext.writingStyle) ||
    "clear and conversational";

  const identityObj =
    (resolvedContext.creatorIdentity && typeof resolvedContext.creatorIdentity === "object"
      ? resolvedContext.creatorIdentity
      : body.creatorIdentity && typeof body.creatorIdentity === "object"
        ? body.creatorIdentity
        : {}) || {};

  const voice: VoiceSpec = {
    writingStyle,
    rawVoice: stripSyntheticDefault(body.rawVoice) || stripSyntheticDefault(resolvedContext.rawVoice),
    identity: identityObj,
    wordsToAvoid: String(identityObj?.wordsYouAvoid || "").trim()
  };

  const rawBusiness: BusinessContextSpec = {
    offer: stripSyntheticDefault(resolvedContext.offer) || stripSyntheticDefault(body.offer),
    rawBusinessText: stripSyntheticDefault(resolvedContext.rawBusinessText) || stripSyntheticDefault(body.rawBusinessText),
    audience: stripSyntheticDefault(resolvedContext.audience) || stripSyntheticDefault(body.audience),
    desiredResult: stripSyntheticDefault(resolvedContext.desiredResult) || stripSyntheticDefault(body.desiredResult),
    offerInformation: resolvedContext.offerIntelligence || body.offerIntelligence || {},
    audienceInformation: resolvedContext.buyerIntelligence || body.buyerIntelligence || {}
  };

  const rawCustomInstruction = stripSyntheticDefault(body.customInstruction) || stripSyntheticDefault(resolvedContext.customInstruction);
  // Guard against legacy client conflation where rawBusinessText was copied verbatim into customInstruction
  const customInstruction =
    rawCustomInstruction && rawBusiness.rawBusinessText && rawCustomInstruction === rawBusiness.rawBusinessText
      ? ""
      : rawCustomInstruction;

  const activePillar = body.activePillar || resolvedContext.activePillar || null;
  const activeIdea = body.activeIdea || null;
  const rawCreatorThought = typeof body.rawCreatorThought === "string" ? body.rawCreatorThought.trim() : "";
  const category = String(body.category || "auto").toLowerCase().trim();
  const characterLimit = Math.min(500, Math.max(50, Number(body.characterLimit || body.maxCharacters) || 500));

  const writingPlan = resolveWritingLengthPlan({
    contentRequest,
    customInstruction,
    activeIdea,
    rawCreatorThought,
    category,
    threadLength: body.threadLength,
    sentencesPerPart: body.sentencesPerPart,
    format: body.format,
    characterLimit
  });

  const partCount = writingPlan.partCountMode === "explicit" ? writingPlan.recommendedParts : undefined;
  const sentencesPerPart: string | number =
    writingPlan.sentencesMode === "explicit" ? writingPlan.recommendedSentencesPerPart : "auto";

  const activeCta = ctaOff ? null : (body.activeCta ?? resolvedContext.activeCta ?? null);
  const suppliedDestinations = Array.isArray(body.contentDestinations) && body.contentDestinations.length > 0
    ? body.contentDestinations
    : (resolvedContext.contentDestinations || []);

  const relevance = classifyBusinessRelevance({
    contentRequest,
    activeIdea,
    rawCreatorThought,
    activePillar,
    business: rawBusiness,
    category,
    ctaOff,
    ctaPreferences,
    activeCta
  });

  // Gate destinations too when business is omitted and CTA is not explicitly locked
  const effectiveDestinationsRaw = ctaOff ? [] : suppliedDestinations;
  const { destinations, allowedUrls } = normalizeUrlList(effectiveDestinationsRaw, [
    contentRequest,
    customInstruction,
    voice.rawVoice,
    rawBusiness.rawBusinessText,
    rawBusiness.offer,
    JSON.stringify(activeCta || "")
  ]);

  let gatedBusiness: Partial<BusinessContextSpec> = {};
  let businessGuidanceNote = "";

  if (relevance.level === "include_full") {
    gatedBusiness = {
      ...(rawBusiness.offer ? { offer: rawBusiness.offer } : {}),
      ...(rawBusiness.rawBusinessText ? { rawBusinessText: rawBusiness.rawBusinessText } : {}),
      ...(rawBusiness.audience ? { audience: rawBusiness.audience } : {}),
      ...(rawBusiness.desiredResult ? { desiredResult: rawBusiness.desiredResult } : {}),
      ...(Object.keys(rawBusiness.offerInformation || {}).length > 0 ? { offerInformation: rawBusiness.offerInformation } : {}),
      ...(Object.keys(rawBusiness.audienceInformation || {}).length > 0 ? { audienceInformation: rawBusiness.audienceInformation } : {})
    };
    businessGuidanceNote = "Business context is topically relevant to this request; use it naturally where helpful without forcing a hard pitch.";
  } else if (relevance.level === "light_lens") {
    const conciseDomainSummary = [rawBusiness.offer, rawBusiness.audience].filter(Boolean).join(" for ");
    gatedBusiness = {
      ...(conciseDomainSummary ? { offer: conciseDomainSummary } : {}),
      ...(rawBusiness.audience ? { audience: rawBusiness.audience } : {})
    };
    businessGuidanceNote = "Use the creator's domain expertise lightly as background perspective. Do NOT pitch offers, pricing, or sales CTAs unless explicitly requested.";
  } else {
    gatedBusiness = {};
    businessGuidanceNote = "Topic is general or independent of the creator's commercial offers. Preserve the creator's voice and worldview strictly, and DO NOT inject business positioning, offers, or sales language.";
  }

  const directives: DirectiveSpec = {
    contentRequest,
    customInstruction,
    activePillar,
    activeIdea,
    rawCreatorThought,
    category,
    characterLimit,
    partCount,
    sentencesPerPart,
    writingPlan,
    ctaPreferences,
    ctaOff,
    activeCta: relevance.level === "omit" && !/use my cta/i.test(ctaPreferences) ? null : activeCta,
    destinations: ctaOff ? [] : destinations,
    lockedOpeningHook: body.openingLocked && typeof body.lockedOpeningHook === "string" && body.lockedOpeningHook.trim()
      ? body.lockedOpeningHook.trim()
      : null,
    activeStrategicAngle: typeof body.activeStrategicAngle === "string" && body.activeStrategicAngle.trim()
      ? body.activeStrategicAngle.trim()
      : null
  };

  // Grounding source texts include all verified facts the user actually owns, even when business is lightly gated,
  // so legitimate user-provided facts in contentRequest/creatorContext are never falsely flagged.
  const groundingSourceTexts = [
    customInstruction,
    contentRequest,
    rawCreatorThought,
    activeIdea ? JSON.stringify(activeIdea) : "",
    voice.rawVoice,
    rawBusiness.rawBusinessText,
    rawBusiness.offer,
    rawBusiness.audience,
    rawBusiness.desiredResult,
    JSON.stringify(voice.identity || {}),
    JSON.stringify(rawBusiness.offerInformation || {}),
    JSON.stringify(rawBusiness.audienceInformation || {})
  ].filter(Boolean);

  const verbatimSourceTexts = [customInstruction, contentRequest].filter(Boolean);

  // Clean facts payload sent to the model — strictly omits irrelevant business bloat!
  const factsPayload: Record<string, any> = {
    writingStyle: voice.writingStyle,
    ...(voice.rawVoice ? { voice: voice.rawVoice } : {}),
    ...(Object.keys(voice.identity || {}).length > 0 ? { identity: voice.identity } : {}),
    ...(voice.wordsToAvoid ? { wordsToAvoid: voice.wordsToAvoid } : {}),
    ...(customInstruction ? { creatorContext: customInstruction } : {}),
    ...(rawCreatorThought ? { rawCreatorThought } : {}),
    ...(activeIdea ? { activeIdea: typeof activeIdea === "string" ? activeIdea : { title: activeIdea.title, summary: activeIdea.summary } } : {}),
    ...(activePillar ? { activePillar: typeof activePillar === "string" ? activePillar : { title: activePillar.title, description: activePillar.description, coreExpertise: activePillar.coreExpertise } } : {}),
    businessRelevance: relevance.level,
    businessGuidance: businessGuidanceNote,
    ...(relevance.level !== "omit" ? gatedBusiness : {})
  };

  return {
    voice,
    directives,
    writingPlan,
    gatedBusiness,
    rawBusiness,
    businessRelevance: relevance.level,
    businessGuidanceNote,
    allowedUrls: ctaOff ? [] : allowedUrls,
    groundingSourceTexts,
    verbatimSourceTexts,
    factsPayload
  };
}
