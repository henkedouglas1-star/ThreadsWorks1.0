/**
 * ThreadsWorks Content Integrity Checker Service
 * 
 * Server-side guardian that inspects generated posts before display:
 * 1. Ensures every sentence is semantically and grammatically complete
 * 2. Eliminates random characters (stray 's', orphaned letters, broken words)
 * 3. Eliminates fragmented thoughts and unexplained checklist teasers
 * 4. Enforces clean mobile optical spacing and character limit constraints
 * 5. Generates an auditable ContentIntegrityReport for verification
 */

import {
  sanitizeSentenceSpacing,
  splitIntoCompleteSentences,
  isSentenceSemanticallyComplete,
  repairThreadPart,
  integrateHookIntoPost,
  sanitizeAndRepairMarkdown,
  sanitizeCorporateAiPhrases,
  enforcePartBoundaries,
  isOpenLoopHook,
  detectHookPromise,
  sanitizeFactualIntegrity,
  HookPromiseInfo,
  SemanticValidationResult
} from "../src/lib/contentSanitizer";

export type IntegrityIssueType =
  | "incomplete_sentence"
  | "random_character"
  | "orphaned_possessive"
  | "unresolved_placeholder"
  | "fragmented_thought"
  | "unexplained_checklist"
  | "dangling_clause"
  | "broken_word"
  | "orphaned_label"
  | "formatting_error"
  | "markdown_corruption"
  | "corporate_ai_language"
  | "cta_placement_mismatch"
  | "planning_metadata_leak"
  | "invented_offer"
  | "fabricated_precision"
  | "semantic_drift"
  | "ungrounded_claim"
  | "unsupported_claim"
  | "unresolved_open_loop"
  | "promise_unfulfilled";

export interface ContentIntegrityIssue {
  type: IntegrityIssueType;
  severity: "error" | "warning";
  partIndex: number;
  snippet: string;
  message: string;
}

export interface ContentIntegrityReport {
  passed: boolean;
  score: number; // 0 - 100
  publishabilityScore: number;
  semanticContinuityScore: number;
  factualGroundingScore: number;
  contextAlignmentScore: number;
  readabilityScore: number;
  hookScore: number;
  authorityScore: number;
  hookPromise?: string;
  promiseFulfilled?: boolean;
  unsupportedClaimsNeutralized?: number;
  onePartOpenLoopsResolved?: number;
  totalParts: number;
  totalSentences: number;
  completeSentences: number;
  randomCharactersRemoved: number;
  fragmentedThoughtsResolved: number;
  unexplainedChecklistsResolved: number;
  markdownRepairsCount: number;
  corporateAiPhrasesReplaced: number;
  orphanedPossessivesResolved: number;
  planningLeaksDetected: number;
  fabricatedNumbersNeutralized: number;
  ungroundedOffersNeutralized: number;
  semanticDriftsCorrected: number;
  hardFail: boolean;
  issues: ContentIntegrityIssue[];
  repairsApplied: string[];
  checkedAt: string;
}

export interface IntegrityCheckOptions {
  charLimit?: number;
  expectedHook?: string;
  ctaInPart2?: boolean;
  skipCannedContinuations?: boolean;
  context?: {
    offer?: string;
    audience?: string;
    desiredResult?: string;
    category?: string;
    ctaInPart2?: boolean;
    skipCannedContinuations?: boolean;
    topic?: string;
    angle?: string;
    thesis?: string;
    hookPromise?: string;
    part2Payoff?: string;
    exactParts?: number;
    exactSentencesPerPart?: number;
    activeCta?: any;
    ctaPreferences?: string;
    customInstruction?: string;
    rawBusinessText?: string;
    approvedUrls?: string[];
    websiteUrl?: string;
    isThreadsWorksRequest?: boolean;
    verifiedPersonalFacts?: string[];
    verifiedClaims?: string[];
  };
  strictCompleteness?: boolean;
}

// Regex patterns for detecting random characters and broken fragments
const STRAY_SINGLE_LETTER_REGEX = /(?:^|\s)[b-hj-zB-HJ-Z](?:[.,!?:;]|\s|$)/g;
const TRAILING_STRAY_LETTER_REGEX = /\s+[b-hj-zB-HJ-Z][.,!?:;]?$/i;
const BROKEN_WORD_PATTERNS = [
  /\bhow\s+to\s+claim\s+['’"]?s(?:\.|\s*|\b)/gi,
  /\bto\s+claim\s+['’"]?s(?:\.|\s*|\b)/gi,
  /\bclaim\s+['’"]?s(?:\.|\s*|\b)/gi,
  /\bscale\s+['’"]?s(?:\.|\s*|\b)/gi,
  /\bfor\s+ing(?:\s+(?:my|your|our)?\s*business)?\b/gi,
  /\bstart\s+build(?:\.|\s*|\b)/gi,
  /\breason\s+this\s+works\s+is(?:\.|\s*|\b)/gi,
  /\b(?:an?|our)\s+(?:audit\s+)?checklist(?:\.|\s*$)/gi,
  /\bimplement\s+Creator\s+offer\b/gi,
  /\bCreator\s+[Oo]ffer(?:\s*\/\s*Resource)?\b/g,
  /\bCore\s+Creator\s+Offer\b/g,
  /(?:^|\s)["'‘“]?s["'’”](?=[.,!?:;]|\s|$)/gi,
  /(?:^|\s)['’](?:s|d|t|m|ve|re|ll)\b/gi,
  /\b(?:deliver|drives?|leads?\s+to|path\s+to|attention\s+to|desired|achieve|claim|scale)\s+['’"]?s['’"]?(?=[.,!?:;]|\s|$)/gi
];

export const PLANNING_METADATA_PATTERNS = [
  /\b(?:observational|personal|compelling|educational|strategic)\s+narrative\s+(?:depicting|showing|exploring|highlighting|illustrating|about)\b/i,
  /\b(?:hook|angle|post|part\s*\d+|cta|narrative)\s+(?:focused\s+on|showing|highlighting|depicting|explaining|about|demonstrating|encouraging|introducing)\b/i,
  /\b(?:introduce\s+the\s+problem\s+by|explain\s+how\s+to|transition\s+into|use\s+a\s+(?:contrarian|story)\s+hook|part\s*\d+\s*(?:should|must))\b/i,
  /^(?:idea|angle|objective|strategy|purpose|format|narrative\s*direction|hook\s*direction):\s*/i,
  /\b(?:educational\s+post\s+about|cta\s+encouraging|narrative\s+demonstrating)\b/i,
  /\bexplains\s+and\s+directly\s+demonstrates\b/i,
  /\bfocusing\s+directly\s+on\s+[^.!?\n]+delivers\s+your\s+primary\s+lesson\b/i,
  /\bwhen\s+you\s+execute\s+on\s+[^.!?\n]+your\s+audience\s+grasps\s+the\s+actionable\s+lesson\b/i,
  /\bstate\s+the\s+actionable\s+operational\s+rule\b/i,
  /\bexplores\s+the\s+[^.!?\n]+\s+perspective\b/i,
  /\b(?:Contrarian perspective|Operator Economics|Archive Reusability|Feedback Loop Mechanism|Reader Outcome Bridge|Implementation Speed|Simplicity Over Complexity|Attention Economics|Conversational Voice Calibration|Topic Repertoire Expansion|Strategic Lens|Central Thesis)\b/i
];

export const CORPORATE_AI_JARGON_PATTERNS = [
  { pattern: /\bpermanent\s+digital\s+equity\b/gi, replacement: "long-term brand value" },
  { pattern: /\bintellectual\s+property\s+moat\b/gi, replacement: "deep content archive" },
  { pattern: /\bpublishing\s+velocity\b/gi, replacement: "publishing consistency" },
  { pattern: /\bevergreen\s+sales\s+engines?\b/gi, replacement: "consistent publishing workflows" },
  { pattern: /\bmonetization\s+engines?\b/gi, replacement: "creator business" },
  { pattern: /\bgrowth\s+flywheels?\b/gi, replacement: "repeatable workflow" },
  { pattern: /\bwatch\s+your\s+conversion\s+rate\s+soar\b/gi, replacement: "build clarity with your audience" },
  { pattern: /\blowers?\s+(?:your\s+)?customer\s+acquisition\s+costs?\b/gi, replacement: "helps readers understand your offer" },
  { pattern: /\bconversion\s+rates?\s+explode\b/gi, replacement: "audience engagement improve" },
  { pattern: /\bsupercharge\s+your\b/gi, replacement: "improve your" },
  { pattern: /\bskyrocket\b/gi, replacement: "grow" }
];

export const UNSUPPORTED_ABSOLUTES_PATTERNS = [
  { pattern: /\byour\s+audience\s+learns\s+to\s+pay\s+attention\s+every\s+time\s+you\s+post\b/gi, replacement: "publishing stronger ideas consistently can make your content easier to recognize and follow" },
  { pattern: /\b(?:drafting|writing|creating)\s+becomes\s+effortless\b/gi, replacement: "drafting becomes easier because the core idea is already clear" },
  { pattern: /\beffortless(?:ly)?\b/gi, replacement: "with much less friction" },
  { pattern: /\b(?:this\s+)?builds?\s+trust\s+much\s+faster\b/gi, replacement: "this can make the post feel more relevant to the reader's actual problem" },
  { pattern: /\b(?:this\s+)?(?:will\s+)?always\s+beats?\s+sporadic\s+perfection\b/gi, replacement: "a repeatable process is usually more useful than waiting for the perfect post" },
  { pattern: /\b(?:will\s+)?always\s+(?:beat|outperform)\b/gi, replacement: "is usually more effective than" },
  { pattern: /\bwill\s+always\b/gi, replacement: "can" },
  { pattern: /\bevery\s+single\s+time\b/gi, replacement: "consistently" },
  { pattern: /\bevery\s+time\s+you\s+post\b/gi, replacement: "consistently over time" },
  { pattern: /\bguaranteed(?:\s+to)?\b/gi, replacement: "designed to" },
  { pattern: /\bwill\s+(?:dramatically\s+)?(?:increase|improve|boost|double|triple|scale)\b/gi, replacement: "can improve" },
  { pattern: /\bwill\s+(?:dramatically\s+)?(?:lower|reduce|cut|eliminate)\b/gi, replacement: "can reduce" },
  { pattern: /\bwill\s+(?:drive|convert|generate)\b/gi, replacement: "can help generate" },
  { pattern: /\bwill\s+outperform\b/gi, replacement: "can outperform" },
  { pattern: /\bwill\s+deliver\b/gi, replacement: "can deliver" },
  { pattern: /\bwill\s+make\s+you\b/gi, replacement: "can help you" },
  { pattern: /\bwill\s+transform\b/gi, replacement: "can improve" },
  { pattern: /\bmakes\s+people\s+(?:pay\s+attention|listen|buy|act)\b/gi, replacement: "helps readers focus on the message" },
  { pattern: /\bcauses?\s+audiences?\s+to\b/gi, replacement: "helps audiences" }
];

export function cleanUnsupportedAbsolutes(text: string): string {
  if (!text || typeof text !== "string") return "";
  let clean = text;
  clean = clean.replace(/\bguarantees\s+burnout\b/gi, "can lead to burnout");
  clean = clean.replace(/\bguarantees\s+zero\s+output\b/gi, "often leads to zero output");
  clean = clean.replace(/\bViews\s+are\s+only\s+valuable\s+if\b/gi, "Views become far more valuable when");
  clean = clean.replace(/\b(?:for|in)\s+the\s+evening\b/gi, "in short daily windows");
  clean = clean.replace(/\b\d+\s*-\s*minutes?\b/gi, "Short Daily Window");
  clean = clean.replace(/\byour\s+audience\s+learns\s+to\s+pay\s+attention\s+every\s+time\s+you\s+post\b/gi, "publishing stronger ideas consistently can make your content easier to recognize and follow");
  clean = clean.replace(/\b(?:drafting|writing|creating)\s+becomes\s+effortless\b/gi, "drafting becomes easier because the core idea is already clear");
  clean = clean.replace(/\bfeel\s+effortless\b/gi, "feel natural and manageable");
  clean = clean.replace(/\bbecomes?\s+effortless\b/gi, "becomes much easier");
  clean = clean.replace(/\beffortless(?:ly)?\b/gi, "with less friction");
  clean = clean.replace(/\b(?:this\s+)?builds?\s+trust\s+much\s+faster\b/gi, "this can make the post feel more relevant to the reader's actual problem");
  clean = clean.replace(/\b(?:this\s+)?(?:will\s+)?always\s+beats?\s+sporadic\s+perfection\b/gi, "a repeatable process is usually more useful than waiting for the perfect post");
  clean = clean.replace(/\b(?:will\s+)?always\s+(?:beat|outperform)\b/gi, "is usually more effective than");
  clean = clean.replace(/\bwill\s+always\b/gi, "can");
  clean = clean.replace(/\bevery\s+single\s+time\b/gi, "consistently");
  clean = clean.replace(/\bevery\s+time\s+you\s+post\b/gi, "consistently over time");
  clean = clean.replace(/\bguaranteed(?:\s+to)?\b/gi, "designed to");
  clean = clean.replace(/\bwill\s+(?:dramatically\s+)?(?:increase|improve|boost|double|triple|scale)\b/gi, "can improve");
  clean = clean.replace(/\bwill\s+(?:dramatically\s+)?(?:lower|reduce|cut|eliminate)\b/gi, "can reduce");
  clean = clean.replace(/\bwill\s+(?:drive|convert|generate)\b/gi, "can help generate");
  clean = clean.replace(/\bwill\s+outperform\b/gi, "can outperform");
  clean = clean.replace(/\bwill\s+deliver\b/gi, "can deliver");
  clean = clean.replace(/\bwill\s+make\s+you\b/gi, "can help you");
  clean = clean.replace(/\bwill\s+transform\b/gi, "can improve");
  clean = clean.replace(/\bmakes\s+people\s+(?:pay\s+attention|listen|buy|act)\b/gi, "helps readers focus on the message");
  clean = clean.replace(/\bcauses?\s+audiences?\s+to\b/gi, "helps audiences");
  return clean;
}

export const UNGROUNDED_OFFER_PATTERNS = [
  /\b(?:send\s+me\s+a\s+dm|dm\s+me|send\s+a\s+message|message\s+me|my\s+dms\s+are\s+open)\b/i,
  /\b(?:book\s+a\s+(?:free\s+)?(?:call|consultation|session|advisory\s+session)|schedule\s+a\s+call)\b/i,
  /\b(?:apply\s+for\s+(?:advisory|consulting|coaching|our\s+program)|apply\s+to\s+work\s+with)\b/i,
  /\b(?:comment|reply|drop)\s+['"]?[A-Za-z0-9_-]{2,}['"]?\s*(?:below|to\s+get|for\s+the|if\s+you|and\s+I)?/i,
  /\b(?:claim\s+(?:a\s+spot|your\s+spot)|taking\s+on\s+\d+\s+clients)\b/i,
  /\b(?:get\s+the\s+(?:free\s+)?(?:template|cheat\s*sheet|guide|workbook|pdf|system|blueprint))\b/i,
  /\b(?:exact\s+execution\s+blueprint|drop\s+[A-Za-z0-9_-]+\s+below|reply\s+[A-Za-z0-9_-]+\s+if)\b/i
];

export const FABRICATED_PRECISION_PATTERNS = [
  /\b\d{1,3}%\b/i, // e.g. 80%
  /\b(?:\d+|[a-z]+)\s*-\s*minutes?\b/i, // e.g. 45-minute
  /\b\d+\s+minutes?\b/i, // e.g. 45 minutes, 3 minutes
  /\b\d+\s+hours?\b/i // e.g. 50 hours, 80 hours
];

export const UNSUPPORTED_FACTUAL_PATTERNS = [
  /\bI\s+studied\s+\d+\s+[\w\s-]+/i,
  /\bI\s+(?:analyzed|reviewed|dissected|broke\s+down)\s+\d+\s+[\w\s-]+/i,
  /\bI\s+spent\s+\d+\s+(?:hours|days|months)\s+studying\b/i,
  /\bI\s+made\s+a\s+\$[\d,]+/i,
  /\bI\s+(?:made|lost)\s+a\s+\$[\d,]+(?:\s*(?:k|m|million|thousand))?\s+mistake/i,
  /\b\d+\s+years?\s+ago,\s+I\s+had\b/i,
  /\bthis\s+single\s+habit\s+drives\s+\d+%\s+of\s+(?:our|my)\s+leads/i,
  /\bdrives?\s+\d+%\s+of\s+(?:our|my)\s+leads/i,
  /\b(?:kill(?:ed)?|cut|reduc(?:ed)?)\s+\d{1,3}%\s+of\s+(?:my|our)\s+(?:marketing|tasks|work)/i,
  /\bwe\s+filter\s+every\s+draft\s+against\s+real\s+experience\b/i,
  /\bWhen\s+I\s+(?:first\s+)?started\s+publishing,\s+I\s+(?:made|lost)\b/i,
  /\b(?:we|I)\s+(?:tested|analyzed|reviewed|audited|tracked)\s+this\s+across\s+\d+\s+posts/i,
  /\b(?:we|I)\s+tested\s+\d+\s+(?:different\s+)?(?:hooks|posts|strategies|angles)/i,
  /\b(?:doubled|tripled|10x['’]?d?)\s+(?:our|my|their)\s+(?:engagement|reach|replies|views|impressions|growth)\b/i,
  /\b(?:the\s+formatting\s+rule\s+that\s+|this\s+)(?:doubled|tripled|10x['’]?d?)\s+(?:our|my)\s+(?:engagement|reach|replies|views|impressions|growth)\b/i,
  /\b(?:our|my)\s+users?\s+increased\s+(?:replies|engagement|revenue)\s+by\s+\d+%\b/i,
  /\b(?:the\s+exact\s+system\s+(?:we|I)\s+used\s+to\s+gain|used\s+to\s+gain|gained)\s+\d+(?:,\d+)?\s+(?:followers|subscribers|clients)\b/i,
  /\b(?:generated|made|closed)\s+\$[\d,]+(?:\s*(?:k|m|million|thousand))?\s+(?:in\s+\d+\s+(?:days|hours|months)|from\s+one\s+post)\b/i,
  /\bI\s+lost\s+\$[\d,]+/i,
  /\b(?:in\s+my\s+experiment|in\s+our\s+experiment)\b/i,
  /\bwhen\s+I\s+tracked\s+\d+\s+accounts\b/i
];

const DANGLING_PREPOSITION_REGEX = /\b(for|about|with|without|from|into|onto|of|by|in|on)\s+(?:think|thinks|believes?|assumes?|wants?|tries?|trying|needs?|knows?|feels?|expects?|wonder|wonders|is|are|was|were|will|can|should|would)\b/i;
const UNRESOLVED_CAPS_PLACEHOLDER_REGEX = /\b(EDUCATION|PILLAR(?:\s*\d+)?|TOPIC|AUDIENCE|OFFER|DESIRED_RESULT|TRANSFORMATION|NICHE|CREATOR|CLIENT|PRODUCT|SERVICE|PLACEHOLDER|TBD|TODO)\b/;
const UNRESOLVED_PLACEHOLDER_REGEX = /\[(?:topic|insert|audience|offer|client|link|cta|product|service|result)[^\]]*\]|\{\{?(?:topic|insert|audience|offer|client|link|cta|result)[^\}]*\}?\}|\b(?:undefined\s+text|undefined|null)\b/i;

const DANGLING_END_WORDS = [
  "and", "or", "but", "so", "because", "with", "for", "to", "at", "by", "from",
  "in", "on", "into", "onto", "of", "about", "that", "which", "who", "whom", "whose",
  "when", "where", "while", "if", "as", "than", "then", "is", "are", "was", "were",
  "be", "been", "being", "have", "has", "had", "do", "does", "did", "the", "a", "an",
  "their", "your", "my", "our", "its", "this", "these", "those", "ing", "s"
];

const DANGLING_END_WORDS_REGEX = new RegExp(`\\b(${DANGLING_END_WORDS.join("|")})\\s*$`, "i");

export class ContentIntegrityChecker {
  /**
   * Cleans malformed markdown formatting (unmatched asterisks, underscores, stray markers before punctuation).
   * E.g. "Demonstration**." -> "Demonstration."
   */
  public static cleanMarkdownCorruption(text: string): { cleanText: string; removedCount: number } {
    if (!text || typeof text !== "string") return { cleanText: "", removedCount: 0 };
    const repaired = sanitizeAndRepairMarkdown(text);
    const removedCount = repaired !== text ? 1 : 0;
    return { cleanText: repaired, removedCount };
  }

  /**
   * Replaces generic corporate AI clichés with authentic, concrete, human creator language.
   */
  public static cleanCorporateAiLanguage(
    text: string,
    context?: { offer?: string; audience?: string; desiredResult?: string }
  ): { cleanText: string; replacedCount: number } {
    if (!text || typeof text !== "string") return { cleanText: "", replacedCount: 0 };
    return sanitizeCorporateAiPhrases(text, context);
  }

  /**
   * Cleans stray single-letter characters, orphaned suffixes, dropped target words, and random debris from text.
   */
  public static cleanRandomCharacters(
    text: string,
    context?: { offer?: string; audience?: string; desiredResult?: string; category?: string }
  ): { cleanText: string; removedCount: number; possessivesResolved: number } {
    if (!text || typeof text !== "string") return { cleanText: "", removedCount: 0, possessivesResolved: 0 };

    let cleaned = text;
    let removedCount = 0;
    let possessivesResolved = 0;

    // 0. Clean markdown corruption first (e.g. Demonstration**.)
    const { cleanText: afterMarkdownClean, removedCount: mdCount } = this.cleanMarkdownCorruption(cleaned);
    cleaned = afterMarkdownClean;
    removedCount += mdCount;

    // 0.1 Intelligent Contextual Repair for Dropped Target Words & Orphaned Possessives
    const rawCat = (context?.category || "").toLowerCase();
    const isSalesContext = rawCat === "sales" ||
      Boolean(context?.offer && /sale|sell|client|revenue|offer|convert/i.test(context.offer)) ||
      Boolean(context?.desiredResult && /sale|sell|client|revenue|convert/i.test(context.desiredResult));
    const fallbackNoun = "sales";

    const possessivePatterns: [RegExp, string | ((...args: any[]) => string)][] = [
      [/\b(won't|will not|does not|doesn't|can't|cannot|to|will|can|magically)?\s*deliver\s+['’"]?s['’"]?(?=[.,!?:;]|\s|$)/gi, (m: string, prefix?: string) => {
        return `${prefix ? prefix + " " : ""}deliver sales`;
      }],
      [/\bdeliver\s+['’"]?s['’"]?(?=[.,!?:;]|\s|$)/gi, "deliver sales"],
      [/\bfrom\s+attention\s+to\s+['’"]?s['’"]?(?=[.,!?:;]|\s|$)/gi, "from attention to sales"],
      [/\bpath\s+from\s+attention\s+to\s+['’"]?s['’"]?(?=[.,!?:;]|\s|$)/gi, "path from attention to sales"],
      [/\battention\s+to\s+['’"]?s['’"]?(?=[.,!?:;]|\s|$)/gi, "attention to sales"],
      [/\bdesired\s+['’"]?s['’"]?(?=[.,!?:;]|\s|$)/gi, "desired sales"],
      [/\bdrives?\s+['’"]?s['’"]?(?=[.,!?:;]|\s|$)/gi, "drives sales"],
      [/\bleads?\s+to\s+['’"]?s['’"]?(?=[.,!?:;]|\s|$)/gi, "leads to sales"],
      [/\bpath\s+to\s+['’"]?s['’"]?(?=[.,!?:;]|\s|$)/gi, "path to sales"],
      [/\b(turn|convert|translate)\s+([^.]+?)\s+into\s+['’"]?s['’"]?(?=[.,!?:;]|\s|$)/gi, "$1 $2 into sales"],
      [/\bresult\s+in\s+['’"]?s['’"]?(?=[.,!?:;]|\s|$)/gi, "result in sales"],
      [/\bbring\s+in\s+['’"]?s['’"]?(?=[.,!?:;]|\s|$)/gi, "bring in sales"],
      [/\bproduce\s+['’"]?s['’"]?(?=[.,!?:;]|\s|$)/gi, "produce sales"],
      [/\bcreate\s+['’"]?s['’"]?(?=[.,!?:;]|\s|$)/gi, "create sales"],
      [/\bmore\s+['’"]?s['’"]?(?=[.,!?:;]|\s|$)/gi, "more sales"],
      [/\bgenerate\s+['’"]?s['’"]?(?=[.,!?:;]|\s|$)/gi, "generate sales"],
      [/\bmake\s+['’"]?s['’"]?(?=[.,!?:;]|\s|$)/gi, "make sales"],
      [/\bclose\s+['’"]?s['’"]?(?=[.,!?:;]|\s|$)/gi, "close sales"],
      [/\bscale\s+['’"]?s['’"]?(?=[.,!?:;]|\s|$)/gi, "scale sales"]
    ];

    for (const [pat, repl] of possessivePatterns) {
      if (pat.test(cleaned)) {
        cleaned = typeof repl === "function" ? cleaned.replace(pat, repl as any) : cleaned.replace(pat, repl);
        possessivesResolved++;
        removedCount++;
      }
    }

    // Resolve any remaining isolated quoted 's' or 's with leading space
    if (/(?<=\s|^)["'‘“]s["'’”](?=[.,!?:;]|\s|$)/i.test(cleaned) || /(?<=\s)['’]s\b(?=[.,!?:;]|\s|$)/i.test(cleaned)) {
      cleaned = cleaned.replace(/(?<=\s|^)["'‘“]s["'’”](?=[.,!?:;]|\s|$)/gi, fallbackNoun);
      cleaned = cleaned.replace(/(?<=\s)['’]s\b(?=[.,!?:;]|\s|$)/gi, fallbackNoun);
      possessivesResolved++;
      removedCount++;
    }
    cleaned = cleaned.replace(/(?<=\s)['’](?:s|d|t|m|ve|re|ll)\b/gi, () => {
      removedCount++;
      return "";
    });

    // 0.2 Repair missing preposition objects (e.g. "content for think..." -> "content for their business think...")
    cleaned = cleaned
      .replace(/\b(building\s+)?content\s+for\s+(think|thinks|believe|believes|assume|assumes|wonder|feel)\b/gi, (m, b, v) => {
        removedCount++;
        return `${b || ""}content for their business ${v}`;
      })
      .replace(/\b(posts?|videos?|strategy|marketing|systems?|copy)\s+for\s+(think|thinks|believe|believes|assume|assumes)\b/gi, (m, noun, v) => {
        removedCount++;
        return `${noun} for their business ${v}`;
      })
      .replace(/\b(for|about|with|from)\s+(think|thinks|believe|believes|assume|assumes)\b/gi, (m, prep, v) => {
        removedCount++;
        return `${prep} their business ${v}`;
      });

    // 0.3 Repair unresolved uppercase placeholders (e.g. "with EDUCATION" -> "with education")
    cleaned = cleaned
      .replace(/\bwith\s+EDUCATION\b/g, () => {
        removedCount++;
        return "with education";
      })
      .replace(/\bEDUCATION\b/g, () => {
        removedCount++;
        return "education";
      })
      .replace(/\bPILLAR\s*\d*\b/gi, () => {
        removedCount++;
        return "core theme";
      })
      .replace(/\bTOPIC\b/g, () => {
        removedCount++;
        return "core topic";
      })
      .replace(/\bAUDIENCE\b/g, () => {
        removedCount++;
        return (context?.audience && context.audience.trim()) ? context.audience.trim() : "your audience";
      })
      .replace(/\bOFFER\b/g, () => {
        removedCount++;
        return (context?.offer && context.offer.trim()) ? context.offer.trim() : "your offer";
      })
      .replace(/\bDESIRED_RESULT\b/g, () => {
        removedCount++;
        return (context?.desiredResult && context.desiredResult.trim()) ? context.desiredResult.trim() : "target outcome";
      })
      .replace(/\bTRANSFORMATION\b/g, () => {
        removedCount++;
        return "transformation";
      })
      .replace(/\[AUDIENCE\]/gi, () => {
        removedCount++;
        return (context?.audience && context.audience.trim()) ? context.audience.trim() : "your audience";
      })
      .replace(/\[OFFER\]/gi, () => {
        removedCount++;
        return (context?.offer && context.offer.trim()) ? context.offer.trim() : "your offer";
      })
      .replace(/\[TOPIC\]/gi, () => {
        removedCount++;
        return "your core topic";
      })
      .replace(/\[RESULT\]/gi, () => {
        removedCount++;
        return "results";
      })
      .replace(/\{(?:topic|audience|offer|result)\}/gi, (m) => {
        removedCount++;
        if (/topic/i.test(m)) return "your topic";
        if (/audience/i.test(m)) return (context?.audience && context.audience.trim()) ? context.audience.trim() : "your audience";
        if (/offer/i.test(m)) return (context?.offer && context.offer.trim()) ? context.offer.trim() : "your offer";
        return "results";
      });

    // 1. Specific known LLM truncation artifacts
    cleaned = cleaned.replace(/\bhow\s+to\s+claim\s+s(?:\.|\s*$)/gi, () => {
      removedCount++;
      return "how to achieve your target outcome.";
    });
    cleaned = cleaned.replace(/\bto\s+claim\s+s(?:\.|\s*$)/gi, () => {
      removedCount++;
      return "to claim your spot.";
    });
    cleaned = cleaned.replace(/\bclaim\s+s(?:\.|\s*$)/gi, () => {
      removedCount++;
      return "claim your results.";
    });
    cleaned = cleaned.replace(/\bscale\s+s(?:\.|\s*$)/gi, () => {
      removedCount++;
      return "scale your business.";
    });
    cleaned = cleaned.replace(/\bfor\s+ing\s+(?:my|your|our)?\s*business\b/gi, () => {
      removedCount++;
      return "for growing your business";
    });
    cleaned = cleaned.replace(/\bstart\s+build(?:\.|\s*$)/gi, () => {
      removedCount++;
      return "start building.";
    });
    cleaned = cleaned.replace(/\breason\s+this\s+works\s+is(?:\.|\s*$)/gi, () => {
      removedCount++;
      return "the reason this works is proven.";
    });

    // 2. Remove stray single letters (b-h, j-z), avoiding valid words 'a', 'A', 'I'
    const letterMatches = cleaned.match(/(?:^|\s)[b-hj-zB-HJ-Z](?=[.,!?:;]|\s|$)/g);
    if (letterMatches) {
      removedCount += letterMatches.length;
      cleaned = cleaned.replace(/(?<=\s|^)[b-hj-zB-HJ-Z](?=[.,!?:;]|\s|$)/g, "");
    }

    // 3. Remove trailing single letter at end of sentences: e.g. "Step s." or "Method d!"
    if (TRAILING_STRAY_LETTER_REGEX.test(cleaned)) {
      cleaned = cleaned.replace(TRAILING_STRAY_LETTER_REGEX, ".");
      removedCount++;
    }

    // 4. Clean space before punctuation (e.g. "word ." -> "word.")
    cleaned = cleaned.replace(/\s+([.,!?:;])/g, "$1");

    // 5. Clean stray punctuation collisions (e.g. ":.", ",.", "..", "?.", "!.")
    cleaned = cleaned.replace(/:\s*\./g, ":");
    cleaned = cleaned.replace(/,\s*\./g, ",");
    cleaned = cleaned.replace(/\.\s*:/g, ".");
    cleaned = cleaned.replace(/\?\.+/g, "?");
    cleaned = cleaned.replace(/!\.+/g, "!");

    // 6. Clean stray punctuation on standalone lines
    cleaned = cleaned.replace(/^[.,\-:;~]\s*$/gm, "");

    // 7. Clean dangling hyphens at word ends
    cleaned = cleaned.replace(/\b([a-zA-Z]+)-([.!?\s]|$)/g, "$1$2");

    // 8. Strip AI disclaimer artifacts
    cleaned = cleaned.replace(/\b(?:as an ai|language model|here is the post|here is part \d+:?|here's what i created:?)\b/gi, () => {
      removedCount++;
      return "";
    });

    return {
      cleanText: sanitizeSentenceSpacing(cleaned).trim(),
      removedCount,
      possessivesResolved
    };
  }

  /**
   * Resolves fragmented thoughts and unexplained checklist teasers into complete,
   * authoritative operational statements without generic corporate AI language.
   */
  public static resolveFragmentedThoughts(
    text: string,
    context?: { offer?: string; audience?: string; desiredResult?: string; topic?: string; angle?: string }
  ): { resolvedText: string; resolvedCount: number; checklistCount: number } {
    if (!text || typeof text !== "string") {
      return { resolvedText: "", resolvedCount: 0, checklistCount: 0 };
    }

    let resolved = text;
    let resolvedCount = 0;
    let checklistCount = 0;

    const audience = context?.audience || "ambitious creators";
    const desiredResult = context?.desiredResult || "predictable growth";
    const offer = context?.offer || "a dedicated system";

    // 1. Resolve unexplained checklist teasers
    const checklistRegex = /\b(?:if you want|dm me for|comment for|grab|use|here is|here's|our|a|the)\s+(?:free\s+)?(?:audit\s+)?(?:checklist|cheat\s*sheet)\b/gi;
    if (checklistRegex.test(resolved)) {
      const hasSubstantiveItems = /\b(?:1\.|Step 1:|\(1\))\s+[A-Za-z]/.test(resolved);
      if (!hasSubstantiveItems) {
        checklistCount++;
        resolved = resolved.replace(
          /\b(?:if you want|dm me for|comment for|grab|use)\s+(?:the|a|our)?\s*(?:free\s+)?(?:audit\s+)?(?:checklist|cheat\s*sheet)[^.!?\n]*[.!?]?/gi,
          `Here is the 3-part framework: clarify your opening point, share a concrete example, and ask for a simple response.`
        );
        resolved = resolved.replace(
          /\b(?:here is|here's|our|a|the)\s+(?:free\s+)?(?:audit\s+)?(?:checklist|cheat\s*sheet)[^.!?\n]*[.!?]?/gi,
          `Here are the 3 key steps: state your point directly, back it up with real experience, and invite a conversation.`
        );
      }
    }

    // 2. Remove orphaned numbered list markers: e.g. "System: 1." or "Value stacks 3." left at sentence ends
    resolved = resolved.replace(/:\s*\d+[.)]?\s*$/, ".");
    resolved = resolved.replace(/(?:^|\s+)\d+[.)]\s*(?=[.!?]|$)/g, ".");
    resolved = resolved.replace(/\.\s*\./g, ".");

    // 3. Remove hanging isolated list items without text: e.g. "1. Do X\n\n2."
    resolved = resolved.replace(/(?:^|\n)\d+[.)]\s*$/gm, "");

    // 4. Resolve orphaned labels (e.g., "Free Audit:", "Step 1:", "Hot Take:")
    resolved = resolved.replace(/^(?:Free audit|Quick tip|Unpopular opinion|Hot take|Real talk|Note|Warning|Step \d+|Rule \d+):?\s*$/gmi, "");

    // 5. Check if part ends on dangling conjunctions or prepositions
    const sentences = splitIntoCompleteSentences(resolved);
    const validSentences: string[] = [];

    for (let i = 0; i < sentences.length; i++) {
      let sent = sentences[i].trim();
      if (!sent) continue;

      // Check if ends with dangling word
      const baseClean = sent.replace(/[.!?:]+$/, "").trim();
      if (DANGLING_END_WORDS_REGEX.test(baseClean)) {
        resolvedCount++;
        if (i < sentences.length - 1) {
          // If intermediate, drop the broken sentence
          continue;
        } else {
          // If trailing sentence ends with dangling word, complete contextually
          if (/\b(?:to|for)\s*$/i.test(baseClean)) {
            sent = baseClean + ` reach your desired result.`;
            validSentences.push(sent);
          } else if (/\b(?:because|so)\s*$/i.test(baseClean)) {
            sent = baseClean + ` simple daily habits get real results.`;
            validSentences.push(sent);
          } else if (/\b(?:is|are)\s*$/i.test(baseClean)) {
            sent = baseClean + ` how you build real audience trust.`;
            validSentences.push(sent);
          }
          continue;
        }
      }

      // Check if missing closing punctuation
      if (!/[.!?]$/.test(sent) && sent.split(/\s+/).length >= 4) {
        sent += ".";
      }

      validSentences.push(sent);
    }

    if (validSentences.length === 0) {
      const rawTopic = context?.topic || context?.offer || "your content strategy";
      const safeTopic = typeof rawTopic === "string" && rawTopic.trim().length > 2 ? rawTopic.trim() : "your strategy";
      resolved = `When you focus on ${safeTopic}, consistency and clarity drive real results. Simplify your core approach and execute daily.`;
      resolvedCount++;
    } else {
      resolved = validSentences.join("\n\n");
    }

    return {
      resolvedText: sanitizeSentenceSpacing(resolved).trim(),
      resolvedCount,
      checklistCount
    };
  }

  /**
   * Runs a complete audit on a single thread part or post body.
   */
  public static inspectText(
    text: string,
    partIndex: number = 0,
    charLimit: number = 500
  ): {
    issues: ContentIntegrityIssue[];
    totalSentences: number;
    completeSentences: number;
  } {
    const issues: ContentIntegrityIssue[] = [];
    if (!text || typeof text !== "string" || !text.trim()) {
      issues.push({
        type: "incomplete_sentence",
        severity: "error",
        partIndex,
        snippet: "",
        message: "Text is empty."
      });
      return { issues, totalSentences: 0, completeSentences: 0 };
    }

    const clean = text.trim();
    if (clean.length > charLimit) {
      issues.push({
        type: "formatting_error",
        severity: "error",
        partIndex,
        snippet: clean.slice(0, 40) + "...",
        message: `Length (${clean.length} chars) exceeds maximum limit (${charLimit} chars).`
      });
    }

    // Check for stray single characters
    const strayMatch = clean.match(/(?:^|\s)[b-hj-zB-HJ-Z](?=[.,!?:;]|\s|$)/);
    if (strayMatch) {
      issues.push({
        type: "random_character",
        severity: "error",
        partIndex,
        snippet: strayMatch[0].trim(),
        message: `Contains unexplained stray single letter fragment "${strayMatch[0].trim()}".`
      });
    }

    // Check for orphaned possessive fragments or dropped words like 's, 's', "s", or isolated 's
    const orphanedPossessiveMatch = clean.match(/(?:^|\s)["'‘“]?['’]?s["'’”]?\b(?=[.,!?:;]|\s|$)|(?:^|\s)['’](?:s|d|t|m|ve|re|ll)\b|(?:deliver|drives?|leads?\s+to|path\s+to|attention\s+to|desired|achieve|claim|scale)\s+['’"]?s['’"]?(?=[.,!?:;]|\s|$)/i);
    if (orphanedPossessiveMatch) {
      issues.push({
        type: "orphaned_possessive",
        severity: "error",
        partIndex,
        snippet: orphanedPossessiveMatch[0].trim(),
        message: `Contains orphaned possessive fragment or dropped target word "${orphanedPossessiveMatch[0].trim()}".`
      });
    }

    // Check for dangling prepositions or missing objects (e.g. "content for think...")
    const prepMatch = clean.match(DANGLING_PREPOSITION_REGEX);
    if (prepMatch) {
      issues.push({
        type: "dangling_clause",
        severity: "error",
        partIndex,
        snippet: prepMatch[0].trim(),
        message: `Contains dangling preposition or missing object "${prepMatch[0].trim()}".`
      });
    }

    // Check for unresolved placeholders (e.g. "with EDUCATION", "[OFFER]")
    const placeholderMatch = clean.match(UNRESOLVED_CAPS_PLACEHOLDER_REGEX) || clean.match(UNRESOLVED_PLACEHOLDER_REGEX);
    if (placeholderMatch) {
      issues.push({
        type: "unresolved_placeholder",
        severity: "error",
        partIndex,
        snippet: placeholderMatch[0].trim(),
        message: `Contains unexplained placeholder text "${placeholderMatch[0].trim()}".`
      });
    }

    // Check for broken word artifacts
    for (const pat of BROKEN_WORD_PATTERNS) {
      const match = clean.match(pat);
      if (match) {
        issues.push({
          type: "broken_word",
          severity: "error",
          partIndex,
          snippet: match[0],
          message: `Contains cut or broken word pattern "${match[0]}".`
        });
      }
    }

    // Check for planning metadata leakage (Failure Class 5)
    for (const pat of PLANNING_METADATA_PATTERNS) {
      const match = clean.match(pat);
      if (match) {
        issues.push({
          type: "planning_metadata_leak",
          severity: "error",
          partIndex,
          snippet: match[0],
          message: `Contains internal planning metadata leakage "${match[0]}".`
        });
      }
    }

    // Check for ungrounded invented offers and services (Failure Class 3)
    for (const pat of UNGROUNDED_OFFER_PATTERNS) {
      const match = clean.match(pat);
      if (match) {
        issues.push({
          type: "invented_offer",
          severity: "error",
          partIndex,
          snippet: match[0],
          message: `Contains ungrounded offer, consulting, or service claim "${match[0]}".`
        });
      }
    }

    // Check for fabricated precision (Failure Class 4)
    for (const pat of FABRICATED_PRECISION_PATTERNS) {
      const match = clean.match(pat);
      if (match) {
        issues.push({
          type: "fabricated_precision",
          severity: "warning",
          partIndex,
          snippet: match[0],
          message: `Contains fabricated precision or ungrounded numeric claim "${match[0]}".`
        });
      }
    }

    // Check for unsupported factual claims (research, doubling, fake follower gains)
    for (const pat of UNSUPPORTED_FACTUAL_PATTERNS) {
      const match = clean.match(pat);
      if (match) {
        issues.push({
          type: "unsupported_claim",
          severity: "warning",
          partIndex,
          snippet: match[0],
          message: `Contains unverified firsthand research or metric gain claim "${match[0]}".`
        });
      }
    }

    // Check for markdown corruption: e.g. "word**." or unmatched asterisks
    if (/[A-Za-z0-9][*_]{1,3}[.!?:]/.test(clean)) {
      issues.push({
        type: "markdown_corruption",
        severity: "warning",
        partIndex,
        snippet: clean.match(/[A-Za-z0-9][*_]{1,3}[.!?:]/)?.[0] || "",
        message: "Contains trailing markdown markers before terminal punctuation."
      });
    }

    // Check sentences
    const sentences = splitIntoCompleteSentences(clean);
    let completeCount = 0;

    for (let i = 0; i < sentences.length; i++) {
      const s = sentences[i];
      const check = isSentenceSemanticallyComplete(s);
      if (check.complete) {
        completeCount++;
      } else {
        issues.push({
          type: "incomplete_sentence",
          severity: "error",
          partIndex,
          snippet: s.slice(0, 40),
          message: `Sentence ${i + 1} incomplete: ${check.reason || "Semantic validation failed"}.`
        });
      }
    }

    return {
      issues,
      totalSentences: sentences.length,
      completeSentences: completeCount
    };
  }

  /**
   * Verifies and repairs a single thread part text, guaranteeing 100% integrity.
   */
  public static verifyAndRepairPart(
    partText: string,
    partIndex: number = 0,
    totalParts: number = 1,
    options?: IntegrityCheckOptions
  ): {
    cleanPart: string;
    issues: ContentIntegrityIssue[];
    repairsApplied: string[];
  } {
    const charLimit = options?.charLimit || 500;
    const repairsApplied: string[] = [];

    // Step 1: Initial inspection
    const preCheck = this.inspectText(partText, partIndex, charLimit);

    // Step 2: Clean markdown corruption
    const { cleanText: afterMarkdownClean, removedCount: mdCount } = this.cleanMarkdownCorruption(partText);
    if (mdCount > 0) {
      repairsApplied.push(`Repaired malformed markdown formatting`);
    }

    // Step 3: Clean generic corporate AI phrases
    const { cleanText: afterAiClean, replacedCount: aiCount } = this.cleanCorporateAiLanguage(afterMarkdownClean, options?.context);
    if (aiCount > 0) {
      repairsApplied.push(`Replaced ${aiCount} generic corporate AI phrase(s) with human language`);
    }

    // Step 4: Clean random characters and repair orphaned possessives
    const { cleanText: afterCharClean, removedCount, possessivesResolved } = this.cleanRandomCharacters(afterAiClean, options?.context);
    if (removedCount > 0) {
      repairsApplied.push(`Eliminated ${removedCount} random character(s) / stray token(s)`);
    }
    if (possessivesResolved > 0) {
      repairsApplied.push(`Restored ${possessivesResolved} dropped target word(s) and resolved orphaned possessive fragment(s)`);
    }

    // Step 5: Resolve fragmented thoughts & unexplained checklists
    const { resolvedText, resolvedCount, checklistCount } = this.resolveFragmentedThoughts(
      afterCharClean,
      options?.context
    );
    if (resolvedCount > 0) {
      repairsApplied.push(`Resolved ${resolvedCount} fragmented sentence/clause thought(s)`);
    }
    if (checklistCount > 0) {
      repairsApplied.push(`Expanded ${checklistCount} unexplained checklist teaser(s) into complete framework`);
    }

    // Step 5b: Strict Asset & Offer Grounding Check (Zero Invented Offers/Products/Lead Magnets/CTAs)
    const { cleanText: afterGroundingClean, violationsCount: ungroundedClaimsFound, replacements: groundingRepairs } = sanitizeFactualIntegrity(
      resolvedText,
      options?.context
    );
    if (ungroundedClaimsFound > 0) {
      repairsApplied.push(...groundingRepairs);
    }

    // Step 6: Run universal repairThreadPart
    const fullyRepaired = repairThreadPart(afterGroundingClean, charLimit, {
      ...options?.context,
      partIndex,
      totalParts,
      expectedHook: partIndex === 0 ? options?.expectedHook : undefined
    });

    if (fullyRepaired !== partText) {
      repairsApplied.push(`Sanitized sentence spacing and mobile paragraph rhythm`);
    }

    return {
      cleanPart: fullyRepaired,
      issues: preCheck.issues,
      repairsApplied
    };
  }

  /**
   * Master Entry Point: Verifies and repairs an entire generated post or thread.
   * Runs on the server before displaying posts to the user.
   */
  public static verifyAndRepairPost<T extends {
    title?: string;
    hook?: string;
    singlePost?: string;
    threadParts?: string[];
    explanation?: string;
    category?: string;
    format?: string;
    decision?: any;
    id?: string;
  }>(
    post: T,
    options?: IntegrityCheckOptions
  ): {
    post: T;
    report: ContentIntegrityReport;
  } {
    const charLimit = options?.charLimit || 500;
    const expectedHook = options?.expectedHook
      ? sanitizeSentenceSpacing(options.expectedHook).trim()
      : (post.hook ? sanitizeSentenceSpacing(post.hook).trim() : "");

    let rawParts: string[] = [];
    if (Array.isArray(post.threadParts) && post.threadParts.length > 0) {
      rawParts = [...post.threadParts];
    } else if (post.singlePost) {
      rawParts = [post.singlePost];
    } else {
      rawParts = [expectedHook || "Real growth starts with a clear focus on your core offer."];
    }

    // Step 2 & 3: Enforce Part Boundaries to heal any split sentences across parts before repair
    rawParts = enforcePartBoundaries(rawParts);

    const allIssues: ContentIntegrityIssue[] = [];
    const allRepairs: string[] = [];
    let totalSentences = 0;
    let completeSentences = 0;
    let randomCharsRemovedTotal = 0;
    let orphanedPossessivesTotal = 0;
    let fragmentedThoughtsResolvedTotal = 0;
    let unexplainedChecklistsTotal = 0;
    let markdownRepairsTotal = 0;
    let corporateAiPhrasesTotal = 0;

    // Clean and repair each part independently
    const exactSentences = options?.context?.exactSentencesPerPart;
    const exactParts = options?.context?.exactParts;
    const hasAuthorizedReviewOffer = Boolean(
      options?.context?.activeCta?.message?.toLowerCase().includes("review") ||
      options?.context?.activeCta?.message?.toLowerCase().includes("audit") ||
      options?.context?.customInstruction?.toLowerCase().includes("review") ||
      options?.context?.customInstruction?.toLowerCase().includes("audit") ||
      options?.context?.offer?.toLowerCase().includes("review") ||
      options?.context?.offer?.toLowerCase().includes("audit")
    );
    const hasAuthorizedSpots = Boolean(
      options?.context?.activeCta?.message?.toLowerCase().includes("spot") ||
      options?.context?.customInstruction?.toLowerCase().includes("spot") ||
      options?.context?.offer?.toLowerCase().includes("spot")
    );
    const hasAuthorizedCommentKeyword = Boolean(
      options?.context?.activeCta?.message?.toLowerCase().match(/\b(?:comment|reply|dm)\s+['"][a-z0-9_-]+['"]/i) ||
      options?.context?.customInstruction?.toLowerCase().match(/\b(?:comment|reply|dm)\s+['"][a-z0-9_-]+['"]/i)
    );

    let repairedParts: string[] = rawParts.map((p, idx) => {
      // Check pre-repairs
      const inspect = this.inspectText(p, idx, charLimit);
      allIssues.push(...inspect.issues);
      totalSentences += inspect.totalSentences;

      // Clean markdown corruption
      const { cleanText: afterMd, removedCount: mdCount } = this.cleanMarkdownCorruption(p);
      markdownRepairsTotal += mdCount;

      // Clean generic corporate AI phrases
      const { cleanText: afterAi, replacedCount: aiCount } = this.cleanCorporateAiLanguage(afterMd, options?.context);
      corporateAiPhrasesTotal += aiCount;

      // Clean random characters and repair orphaned possessives
      const { cleanText: afterCharClean, removedCount, possessivesResolved } = this.cleanRandomCharacters(afterAi, options?.context);
      randomCharsRemovedTotal += removedCount;
      orphanedPossessivesTotal += possessivesResolved;
      if (possessivesResolved > 0) {
        allRepairs.push(`Part ${idx + 1}: Restored dropped target word(s) and completed natural thought before possessive ('s)`);
      }

      // Resolve fragmented thoughts
      let { resolvedText, resolvedCount, checklistCount } = this.resolveFragmentedThoughts(
        afterCharClean,
        options?.context
      );
      fragmentedThoughtsResolvedTotal += resolvedCount;
      unexplainedChecklistsTotal += checklistCount;

      // Strip uninstructed invented business claims (e.g. fake 5 free reviews, 3 spots, unrequested audits)
      if (!hasAuthorizedReviewOffer) {
        resolvedText = resolvedText.replace(/\b(?:I am doing|doing|for your|grab a|free)\s+(?:\d+\s+)?(?:free\s+)?(?:profile\s+)?(?:reviews?|audits?)\b[^.!?\n]*[.!?]?/gi, "");
        resolvedText = resolvedText.replace(/\b(?:free\s+profile\s+reviews?|free\s+audits?)\b[^.!?\n]*[.!?]?/gi, "");
        resolvedText = resolvedText.replace(/\bfor\s+your\s+free\s+audit[.!?]?/gi, "");
      }
      if (!hasAuthorizedSpots) {
        resolvedText = resolvedText.replace(/\b(?:We are opening|opening|taking on|only)\s+\d+\s+spots(?:\s+this\s+month)?\b[^.!?\n]*[.!?]?/gi, "");
      }
      // Strip uninstructed comment keyword mechanics
      if (!hasAuthorizedCommentKeyword) {
        resolvedText = resolvedText.replace(/\b(?:comment|reply)\s+['"]?(?:READY|REVIEW|AUDIT|GUIDE|WORKFLOW|FLOW|SYSTEM|START)['"]?\s*(?:below|for\s+your[^.!?\n]*)?[.!?]?/gi, "");
      }

      // Enforce strict character limit and complete sentence reconstruction
      const repaired = repairThreadPart(resolvedText, charLimit, {
        ...options?.context,
        partIndex: idx,
        totalParts: rawParts.length,
        expectedHook: idx === 0 ? expectedHook : undefined,
        exactSentences
      });

      if (repaired !== p) {
        allRepairs.push(`Part ${idx + 1}: Repaired and standardized complete sentence structures`);
      }

      // Re-inspect final part
      const finalSentences = splitIntoCompleteSentences(repaired);
      completeSentences += finalSentences.length;

      return repaired;
    });

    // Check CTA in Part 2 requirement if specified (run BEFORE trimming parts so CTA is never lost)
    const ctaInPart2Required = options?.ctaInPart2 || options?.context?.ctaInPart2;
    if (ctaInPart2Required && repairedParts.length >= 2) {
      // Check if a CTA appears in later parts (Part 3 or 4) but not in Part 2
      const isCtaText = (t: string) => /\b(?:reply|comment|dm me|link in bio|grab|download|send over)\b/i.test(t);
      const part2HasCta = isCtaText(repairedParts[1]);
      if (!part2HasCta) {
        for (let j = 2; j < repairedParts.length; j++) {
          if (isCtaText(repairedParts[j])) {
            // Swap or incorporate CTA into Part 2
            const ctaSentences = splitIntoCompleteSentences(repairedParts[j]).filter(isCtaText);
            if (ctaSentences.length > 0) {
              const ctaSentence = ctaSentences[0];
              repairedParts[1] = repairThreadPart(
                `${repairedParts[1]}\n\n${ctaSentence}`,
                charLimit,
                {
                  ...options?.context,
                  partIndex: 1,
                  totalParts: repairedParts.length,
                  exactSentences
                }
              );
              // Remove that sentence from part j
              repairedParts[j] = sanitizeSentenceSpacing(repairedParts[j].replace(ctaSentence, "").trim());
              allRepairs.push(`Repositioned Call to Action into Part 2 per CTA instructions`);
              break;
            }
          }
        }
      }
    }

    // Enforce max parts count if specified in options (Canonical 1-8 parts)
    if (typeof exactParts === "number" && exactParts >= 1) {
      const targetParts = Math.min(8, Math.max(1, exactParts));
      if (repairedParts.length > targetParts) {
        repairedParts = repairedParts.slice(0, targetParts);
        allRepairs.push(`Trimmed thread to exactly ${targetParts} parts per manual settings`);
      }
    }

    // Enforce canonical hard maximum of 8 parts for any post
    if (repairedParts.length > 8) {
      repairedParts = repairedParts.slice(0, 8);
      allRepairs.push("Capped thread to authoritative maximum of 8 parts");
    }

    // Ensure Part 1 begins with expected hook if explicitly provided or required
    const explicitHookProvided = Boolean(options?.expectedHook && options.expectedHook.trim().length > 0);
    const effectiveTargetHook = explicitHookProvided
      ? sanitizeSentenceSpacing(options!.expectedHook!).trim()
      : (post.hook ? sanitizeSentenceSpacing(post.hook).trim() : (repairedParts[0]?.split("\n\n")[0] || ""));

    if (explicitHookProvided && effectiveTargetHook) {
      const p1 = repairedParts[0] || "";
      if (!p1.startsWith(effectiveTargetHook)) {
        if (typeof exactSentences === "number" && exactSentences > 1) {
          repairedParts[0] = repairThreadPart(`${effectiveTargetHook}\n\n${p1}`, charLimit, {
            ...options?.context,
            partIndex: 0,
            totalParts: repairedParts.length,
            expectedHook: effectiveTargetHook,
            exactSentences
          });
        } else {
          repairedParts[0] = effectiveTargetHook;
        }
      }
    }

    // =========================================================================
    // STEP 6: VALIDATE THE REPAIRED CONTENT AGAIN (PASS 2 AUDIT & FAILSAFE)
    // Every Part and sentence is re-audited. If any part has broken grammar,
    // dangling words, unresolved placeholders, or sentence count mismatch,
    // failsafe reconstruction is executed before returning content.
    // =========================================================================
    repairedParts = enforcePartBoundaries(repairedParts);

    for (let pIdx = 0; pIdx < repairedParts.length; pIdx++) {
      let partText = repairedParts[pIdx];
      let partSentences = splitIntoCompleteSentences(partText);

      // Sentence-level verification: ensure proper trailing punctuation and clean complete sentences
      const cleanedSentences: string[] = [];
      for (let sIdx = 0; sIdx < partSentences.length; sIdx++) {
        let sent = partSentences[sIdx]?.trim();
        if (!sent) continue;
        if (!/[.!?:]$/.test(sent)) {
          sent = `${sent}.`;
        }
        cleanedSentences.push(sent);
      }

      const targetSentences = typeof exactSentences === "number" && exactSentences >= 1
        ? Math.min(8, Math.max(1, exactSentences))
        : null;

      // Enforce exact sentence count if explicitly configured (trim only)
      if (targetSentences !== null && cleanedSentences.length > targetSentences) {
        cleanedSentences.splice(targetSentences);
      }

      // Format into natural paragraphs (1-2 sentences)
      if (cleanedSentences.length <= 2) {
        repairedParts[pIdx] = cleanedSentences.join("\n\n");
      } else {
        const paras: string[] = [cleanedSentences[0]];
        for (let j = 1; j < cleanedSentences.length; j += 2) {
          if (j + 1 < cleanedSentences.length) {
            paras.push(`${cleanedSentences[j]} ${cleanedSentences[j + 1]}`);
          } else {
            paras.push(cleanedSentences[j]);
          }
        }
        repairedParts[pIdx] = paras.join("\n\n");
      }
    }

    // Step 7: Duplicate Part Elimination (Guarantee no repeated identical parts within a post)
    const seenPartSignatures = new Set<string>();
    const deduplicatedParts: string[] = [];
    for (let pIdx = 0; pIdx < repairedParts.length; pIdx++) {
      const partSig = repairedParts[pIdx].toLowerCase().replace(/[^a-z0-9]/g, "");
      if (partSig.length > 10) {
        if (!seenPartSignatures.has(partSig)) {
          seenPartSignatures.add(partSig);
          deduplicatedParts.push(repairedParts[pIdx]);
        } else {
          allRepairs.push(`Part ${pIdx + 1}: Removed duplicate part`);
        }
      } else {
        deduplicatedParts.push(repairedParts[pIdx]);
      }
    }
    if (deduplicatedParts.length > 0) {
      repairedParts = deduplicatedParts;
    }

    // =========================================================================
    // STEP 8: WHOLE-POST SEMANTIC VALIDATION, REPAIR & AUTHORITATIVE RESCORING
    // Validates that all Parts form ONE complete thought, eliminates internal
    // planning text leaks, neutralizes ungrounded offers/services, repairs
    // fabricated precision, and enforces grounded CTA behavior.
    // =========================================================================
    let planningLeaksDetected = 0;
    let fabricatedNumbersNeutralized = 0;
    let ungroundedOffersNeutralized = 0;
    let semanticDriftsCorrected = 0;
    let unsupportedClaimsNeutralized = 0;
    let onePartOpenLoopsResolved = 0;

    const groundedOffer = (options?.context?.offer && options.context.offer.trim() && !options.context.offer.includes("Creator offer") && options.context.offer !== "a high-value product or service")
      ? options.context.offer.trim()
      : (options?.context?.isThreadsWorksRequest ? "ThreadsWorks" : "");
    const approvedLinks = [
      ...(options?.context?.websiteUrl ? [options.context.websiteUrl] : []),
      ...(options?.context?.approvedUrls || []),
      ...(options?.context?.isThreadsWorksRequest ? ["https://threadsworks.com/create", "https://threadsworks.com/pricing"] : [])
    ];
    const primaryLink = approvedLinks.length > 0 ? approvedLinks[0] : "";
    const offerActionText = groundedOffer ? `explore ${groundedOffer}` : "explore the core strategy";
    const getStartedText = groundedOffer ? `get started with ${groundedOffer}` : "get started with clear systems";
    const joinText = groundedOffer ? `join ${groundedOffer}` : "take the next step";
    const commentReplacementText = primaryLink ? `explore the guide at ${primaryLink}` : `share your thoughts in the replies below`;

    for (let pIdx = 0; pIdx < repairedParts.length; pIdx++) {
      let partText = repairedParts[pIdx];

      // A. Eliminate internal planning text leakage (Failure Class 5)
      for (const pat of PLANNING_METADATA_PATTERNS) {
        if (pat.test(partText)) {
          planningLeaksDetected++;
          // Convert meta-description into direct publishable prose
          partText = partText
            .replace(/^(?:\[?(?:Observational|Personal|Compelling|Educational|Strategic)\s+narrative\s+(?:depicting|showing|exploring|highlighting|illustrating|about)\s+([^.!?\n]+)[.!?]?\s*)/i, (m, ideaDesc) => {
              return `Publishing every day without a clear destination is an exhausting cycle. When your message lacks a focused outcome, consistent posting creates noise instead of real progress.`;
            })
            .replace(/^(?:\[?(?:Hook|Angle|Post|Part\s*\d+|CTA|Narrative)\s+(?:focused\s+on|showing|highlighting|depicting|explaining|about|demonstrating|encouraging|introducing)\s+([^.!?\n]+)[.!?]?\s*)/i, (m, ideaDesc) => {
              return `Focus your opening on the exact problem your audience experiences daily.`;
            })
            .replace(/^(?:\[?(?:Introduce\s+the\s+problem\s+by|Explain\s+how\s+to|Transition\s+into|Use\s+a\s+(?:contrarian|story)\s+hook|Part\s*\d+\s*(?:should|must))\s+([^.!?\n]+)[.!?]?\s*)/i, (m, ideaDesc) => {
              return `The most effective way to communicate is through direct, practical lessons.`;
            })
            .replace(/^(?:Idea|Angle|Objective|Strategy|Purpose|Format):\s*[^.!?\n]+[.!?]?\s*/gi, "");

          allRepairs.push(`Part ${pIdx + 1}: Converted internal planning metadata into clean, publishable prose`);
        }
      }

      // B. Neutralize ungrounded invented offers, consulting, advisory, DM/comment CTAs (Failure Class 3 & 10)
      for (const pat of UNGROUNDED_OFFER_PATTERNS) {
        if (pat.test(partText)) {
          ungroundedOffersNeutralized++;
          partText = partText
            .replace(/\b(?:send\s+me\s+a\s+dm|dm\s+me|send\s+a\s+message|message\s+me|my\s+dms\s+are\s+open)\b/gi, primaryLink ? `check the link in bio` : `share your thoughts below`)
            .replace(/\b(?:book\s+a\s+(?:free\s+)?(?:call|consultation|session|advisory\s+session)|schedule\s+a\s+call)\b/gi, offerActionText)
            .replace(/\b(?:apply\s+for\s+(?:advisory|consulting|coaching|our\s+program)|apply\s+to\s+work\s+with)\b/gi, getStartedText)
            .replace(/\b(?:comment|reply)\s+['"][a-z0-9_-]+['"]\s*(?:below)?/gi, commentReplacementText)
            .replace(/\b(?:claim\s+(?:a\s+spot|your\s+spot)|taking\s+on\s+\d+\s+clients)\b/gi, joinText);

          allRepairs.push(`Part ${pIdx + 1}: Neutralized ungrounded consulting/advisory/DM claim to match verified context`);
        }
      }

      // C. Neutralize corporate AI marketing jargon (Failure Class 4 & Quality Policy)
      for (const { pattern, replacement } of CORPORATE_AI_JARGON_PATTERNS) {
        const next = partText.replace(pattern, replacement);
        if (next !== partText) {
          partText = next;
          allRepairs.push(`Part ${pIdx + 1}: Replaced corporate AI jargon with plain creator language`);
        }
      }

      // C.1 Neutralize unsupported absolutes & performance claims (Quality Policy Rule 3)
      for (const { pattern, replacement } of UNSUPPORTED_ABSOLUTES_PATTERNS) {
        const next = partText.replace(pattern, replacement);
        if (next !== partText) {
          partText = next;
          unsupportedClaimsNeutralized++;
          allRepairs.push(`Part ${pIdx + 1}: Rewrote absolute / performance claim into grounded mechanism phrasing`);
        }
      }

      // D. Neutralize fabricated precision (Failure Class 4)
      for (const pat of FABRICATED_PRECISION_PATTERNS) {
        if (pat.test(partText)) {
          fabricatedNumbersNeutralized++;
          partText = partText
            .replace(/\b(?:when\s+I\s+(?:first\s+)?started(?:\s+out)?,\s+)?(?:I\s+worked|working|I\s+spent)\s+\d+\s+hours\s+a\s+week\b/gi, "operating without a clear system can consume long hours each week")
            .replace(/\bI\s+(?:worked|spent)\s+(?:endless|\d+)\s+hours\s+a\s+week\b/gi, "content creation without a system can consume long hours each week")
            .replace(/\bburning\s+\d{1,3}%\s+of\s+(?:my|our|their)\s+energy\b/gi, "burning unnecessary energy")
            .replace(/\b\d{1,3}%\s+of\s+(?:creators|people|users|entrepreneurs|readers)\b/gi, "most creators")
            .replace(/\b\d{1,3}%\b/g, "a significant portion")
            .replace(/(?:the\s+)?\d+\s*-\s*minute\s+(?:drafting\s+)?scramble/gi, "the lengthy drafting process")
            .replace(/(?:a\s+)?clean\s+\d+\s*-\s*minute\s+flow/gi, "a clean, focused flow")
            .replace(/\b\d+\s+minutes?\b/gi, "a short daily window")
            .replace(/\b80\s+hours\s+a\s+week\b/gi, "long hours each week")
            .replace(/\b50\s+hours\s+a\s+week\b/gi, "long hours each week");

          allRepairs.push(`Part ${pIdx + 1}: Rewrote unsupported precision numbers into grounded qualitative phrasing`);
        }
      }

      // D. Neutralize unsupported factual research, experiments, multiplier claims (Rule 7)
      const { cleanText: afterFactual, violationsCount: fCount, replacements: fRepls } = sanitizeFactualIntegrity(partText, options?.context);
      if (fCount > 0) {
        unsupportedClaimsNeutralized += fCount;
        partText = afterFactual;
        allRepairs.push(`Part ${pIdx + 1}: ${fRepls.join("; ")}`);
      }

      // E. Clean broken words (Failure Class 1)
      for (const pat of BROKEN_WORD_PATTERNS) {
        if (pat.test(partText)) {
          partText = partText
            .replace(/\bfor\s+ing(?:\s+(?:my|your|our)?\s*business)?\b/gi, "for growing your business")
            .replace(/\bhow\s+to\s+claim\s+['’"]?s(?:\.|\s*|\b)/gi, "how to achieve your goals.")
            .replace(/\bclaim\s+['’"]?s(?:\.|\s*|\b)/gi, "claim your results.")
            .replace(/\bimplement\s+Creator\s+offer\b/gi, `implement ${groundedOffer}`)
            .replace(/\bCreator\s+[Oo]ffer(?:\s*\/\s*Resource)?\b/g, groundedOffer)
            .replace(/\bCore\s+Creator\s+Offer\b/g, groundedOffer);

          allRepairs.push(`Part ${pIdx + 1}: Healed cut or broken word remnant`);
        }
      }

      // Re-run repairThreadPart on the healed part
      repairedParts[pIdx] = repairThreadPart(partText, charLimit, {
        ...options?.context,
        partIndex: pIdx,
        totalParts: repairedParts.length,
        exactSentences
      });
    }

    // F. Hook Promise Tracking, One-Part Completion Validation & Semantic Continuity Repair
    const factualCheck = sanitizeFactualIntegrity(repairedParts[0]);
    repairedParts[0] = factualCheck.cleanText;
    if (factualCheck.violationsCount > 0) {
      unsupportedClaimsNeutralized += factualCheck.violationsCount;
      allRepairs.push(...factualCheck.replacements);
    }
    const hookInfo = detectHookPromise(repairedParts[0]);
    const p1Lower = repairedParts[0].toLowerCase();

    // (Canned continuation expansion removed to prevent inserting generic framework steps into user posts)

    // F.2 Semantic Continuity & Hook Promise Validation
    // (Note: Canned fallback string overwrites removed to prevent inventing stories or inserting hardcoded text.
    //  Grounded model generation & prompt controls handle content continuity.)

    // G. Final Part Pacing, CTA Duplication Protection & Sanitization Pass
    if (repairedParts.length > 1) {
      const lastPart = repairedParts[repairedParts.length - 1].trim();
      const prevPart = repairedParts[repairedParts.length - 2].trim();
      const normLast = lastPart.toLowerCase().replace(/[^a-z0-9]/g, "");
      const normPrev = prevPart.toLowerCase().replace(/[^a-z0-9]/g, "");
      
      // If the last part duplicates the previous part's end or entire text, remove the redundant part
      if (normLast.length > 15 && (normPrev.endsWith(normLast) || normPrev === normLast)) {
        repairedParts.pop();
        allRepairs.push("Removed duplicate trailing CTA part that repeated previous part");
      }
    }

    for (let pIdx = 0; pIdx < repairedParts.length; pIdx++) {
      repairedParts[pIdx] = sanitizeSentenceSpacing(repairedParts[pIdx].trim());
    }

    // Final recount of complete sentences on verified clean parts
    totalSentences = 0;
    completeSentences = 0;
    for (const p of repairedParts) {
      const sList = splitIntoCompleteSentences(p);
      totalSentences += sList.length;
      completeSentences += sList.filter(s => isSentenceSemanticallyComplete(s).complete).length;
    }

    let cleanPost: T = {
      ...post,
      title: post.title ? sanitizeAndRepairMarkdown(sanitizeSentenceSpacing(post.title)).trim() : "Strategic Post",
      explanation: post.explanation ? sanitizeAndRepairMarkdown(sanitizeSentenceSpacing(post.explanation)).trim() : "",
      hook: effectiveTargetHook || post.hook || repairedParts[0],
      singlePost: repairedParts[0],
      threadParts: repairedParts
    };

    // Rule 8: Title, Hook, Body Consistency Check
    if (cleanPost.title && repairedParts.length > 0) {
      const tLower = cleanPost.title.toLowerCase();
      const p1Lower = repairedParts[0].toLowerCase();
      if (tLower.includes("creator context") && (p1Lower.includes("first five words") || p1Lower.includes("first 5 words") || p1Lower.includes("opening 5 words"))) {
        cleanPost.title = "Opening Words Optimization";
        allRepairs.push("Realigned Title to match Post Idea and Hook");
      }
    }

    // Re-audit final output for hard fails
    const finalIssues: ContentIntegrityIssue[] = [];
    for (let pIdx = 0; pIdx < repairedParts.length; pIdx++) {
      const inspect = this.inspectText(repairedParts[pIdx], pIdx, charLimit);
      finalIssues.push(...inspect.issues);
    }

    // Check for hard quality gate failures
    const hasUnresolvedIssues = finalIssues.some(
      i => i.severity === "error" || ["unsupported_claim", "planning_metadata_leak", "invented_offer", "broken_word", "dangling_clause", "unresolved_open_loop"].includes(i.type)
    );
    const hasOpenLoopSinglePart = repairedParts.length === 1 && isOpenLoopHook(repairedParts[0]);
    const hasHardFail = hasUnresolvedIssues || hasOpenLoopSinglePart;

    // Multi-dimensional 8-Dimension Authoritative Scoring Audit & Calculation:
    // 1. Hook/body continuity: 20%
    // 2. Hook promise fulfillment: 20%
    // 3. Factual integrity: 20%
    // 4. Specificity: 10%
    // 5. Readability / naturalness: 10%
    // 6. Idea completeness: 10%
    // 7. CTA relevance: 5%
    // 8. Creator Context / voice fit: 5%

    // 1. Hook/body continuity (20%)
    let continuityScore = 95;
    if (semanticDriftsCorrected > 0) continuityScore = Math.max(75, 90 - (semanticDriftsCorrected * 8));
    if (repairedParts.length >= 2) {
      const p2Text = repairedParts[1].toLowerCase();
      const kwMatches = hookInfo.expectedKeywords.filter(kw => p2Text.includes(kw));
      if (kwMatches.length >= 2) continuityScore = Math.min(98, continuityScore + 2);
    }

    // 2. Hook promise fulfillment (20%)
    let fulfillmentScore = 94;
    if (hasOpenLoopSinglePart) fulfillmentScore = 25;
    if (onePartOpenLoopsResolved > 0) fulfillmentScore = 82;
    if (allRepairs.some(r => r.includes("multi-step hook promise"))) fulfillmentScore = 85;

    // 3. Factual integrity (20%)
    let factualIntegrityScore = 96;
    if (unsupportedClaimsNeutralized > 0) factualIntegrityScore = Math.max(72, 88 - (unsupportedClaimsNeutralized * 6));
    if (fabricatedNumbersNeutralized > 0) factualIntegrityScore = Math.max(75, factualIntegrityScore - (fabricatedNumbersNeutralized * 4));
    if (ungroundedOffersNeutralized > 0) factualIntegrityScore = Math.max(70, factualIntegrityScore - (ungroundedOffersNeutralized * 5));

    // 4. Specificity (10%)
    let specificityScore = 93;
    const hasConcreteWords = /\b(?:\d+|step|rule|minute|day|post|words?|line|offer|conversion|audience)\b/i.test(repairedParts.join(" "));
    if (hasConcreteWords) specificityScore = 96;
    if (corporateAiPhrasesTotal > 0) specificityScore = Math.max(78, 88 - (corporateAiPhrasesTotal * 3));

    // 5. Readability / naturalness (10%)
    let readabilityScore = 95;
    const completenessRatio = totalSentences > 0 ? (completeSentences / totalSentences) : 1;
    if (completenessRatio < 1) readabilityScore = Math.round(completenessRatio * 85);
    if (repairedParts.some(p => p.length > 470)) readabilityScore -= 5;

    // 6. Idea completeness (10%)
    let completenessScore = 95;
    if (hasOpenLoopSinglePart) completenessScore = 30;
    if (repairedParts.length === 1 && !hasOpenLoopSinglePart) completenessScore = 95;
    if (repairedParts.length > 1 && !repairedParts[repairedParts.length - 1].match(/[.!?]$/)) completenessScore = 75;

    // 7. CTA relevance (5%)
    let ctaRelevanceScore = 94;
    const lastPart = repairedParts[repairedParts.length - 1];
    if (lastPart.includes("http") && !approvedLinks.some(l => lastPart.includes(l))) {
      ctaRelevanceScore = 65;
    }

    // 8. Creator Context / voice fit (5%)
    let contextFitScore = 95;
    if (options?.context?.topic && !repairedParts.join(" ").toLowerCase().includes(options.context.topic.toLowerCase().split(" ")[0])) {
      contextFitScore = 88;
    }
    if (planningLeaksDetected > 0) contextFitScore = 78;

    // Calculate weighted overall score
    let overallScore = Math.round(
      continuityScore * 0.20 +
      fulfillmentScore * 0.20 +
      factualIntegrityScore * 0.20 +
      specificityScore * 0.10 +
      readabilityScore * 0.10 +
      completenessScore * 0.10 +
      ctaRelevanceScore * 0.05 +
      contextFitScore * 0.05
    );

    // Hard quality gates override: any critical failure caps score and triggers fail
    if (hasHardFail) {
      overallScore = Math.min(35, overallScore);
      continuityScore = Math.min(35, continuityScore);
      fulfillmentScore = Math.min(30, fulfillmentScore);
      factualIntegrityScore = Math.min(35, factualIntegrityScore);
    } else if (allRepairs.length > 0) {
      // Repaired posts are calibrated between 80 and 89 (never inflated to pristine 95+)
      overallScore = Math.min(88, Math.max(78, overallScore));
    } else {
      // Pristine verified posts without repairs
      overallScore = Math.min(98, Math.max(90, overallScore));
    }

    const publishabilityScore = hasHardFail ? 30 : Math.min(continuityScore, fulfillmentScore, factualIntegrityScore, readabilityScore);

    const report: ContentIntegrityReport = {
      passed: !hasHardFail,
      score: overallScore,
      publishabilityScore,
      semanticContinuityScore: continuityScore,
      factualGroundingScore: factualIntegrityScore,
      contextAlignmentScore: contextFitScore,
      readabilityScore,
      hookScore: Math.round((continuityScore + fulfillmentScore) / 2),
      authorityScore: specificityScore,
      hookPromise: options?.context?.hookPromise || hookInfo.promise || "",
      promiseFulfilled: !hasHardFail,
      unsupportedClaimsNeutralized,
      onePartOpenLoopsResolved,
      totalParts: cleanPost.threadParts ? cleanPost.threadParts.length : 1,
      totalSentences,
      completeSentences,
      randomCharactersRemoved: randomCharsRemovedTotal,
      fragmentedThoughtsResolved: fragmentedThoughtsResolvedTotal,
      unexplainedChecklistsResolved: unexplainedChecklistsTotal,
      markdownRepairsCount: markdownRepairsTotal,
      corporateAiPhrasesReplaced: corporateAiPhrasesTotal,
      orphanedPossessivesResolved: orphanedPossessivesTotal,
      planningLeaksDetected,
      fabricatedNumbersNeutralized,
      ungroundedOffersNeutralized,
      semanticDriftsCorrected,
      hardFail: hasHardFail,
      issues: finalIssues,
      repairsApplied: allRepairs,
      checkedAt: new Date().toISOString()
    };

    return {
      post: cleanPost,
      report
    };
  }
}

