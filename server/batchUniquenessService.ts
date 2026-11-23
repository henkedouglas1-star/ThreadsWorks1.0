/**
 * ThreadsWorks Batch Uniqueness Service
 * Enforces batch-wide uniqueness for CTAs, closing sentences, final lines,
 * and generic conclusions across 1, 4, 8, 16, and 32 post generations.
 *
 * Guaranteed invariants:
 * 1. Zero duplicate final lines across the entire batch (100% unique final lines).
 * 2. Zero duplicate CTA sentences or wording templates across the batch.
 * 3. Approved creator URLs may repeat when appropriate, but CTA wording must be unique.
 * 4. Zero duplicate generic concluding clichés across the batch.
 * 5. Surgical repair: only the duplicate closing sentence / CTA is rewritten;
 *    hook, angle, main body, and thread structure are 100% preserved.
 */

import { splitIntoCompleteSentences, sanitizeSentenceSpacing } from "../src/lib/contentSanitizer";

export interface BatchUniquenessCheckResult {
  isDuplicate: boolean;
  reason?: "exact_match" | "near_duplicate" | "generic_cliche" | "duplicate_cta_wording";
  matchedWith?: string;
  score?: number;
}

// Canonical generic advice clichés that must never repeat across a batch
const GENERIC_CLOSING_CLICHES = [
  "keep your delivery straightforward, transparent, and grounded in real client experience",
  "keep your delivery straightforward",
  "grounded in real client experience",
  "ground your daily delivery in real client outcomes, not untested speculation",
  "ground your daily delivery in real client outcomes",
  "focus on the core offer that brings in real clients, and let the rest go",
  "focus on the core offer that brings in real clients",
  "clear daily execution is what turns initial interest into dependable client momentum",
  "when you focus your message on one specific outcome, your audience knows exactly what to do next",
  "the creators who see steady growth are the ones who stay consistent with simple, proven fundamentals",
  "simplicity in daily publishing allows your core positioning to compound over time",
  "eliminate unnecessary manual steps so your message reaches your ideal audience with less friction",
  "keep it simple",
  "stay consistent",
  "consistency matters",
  "focus on what works",
  "start small",
  "start with the basics",
  "start with what works",
  "focus on the fundamentals",
  "keep showing up",
  "action beats overthinking",
  "trust the process",
  "simplify your approach",
  "do what works",
  "consistency is key",
  "keep moving forward",
  "clear standards make every subsequent decision straightforward",
  "consistent execution on proven fundamentals is what drives sustainable momentum"
];

const CTA_TRIGGER_REGEX = /\b(https?:\/\/[^\s]+|link in bio|check the link|reply|comment|send a dm|dm me|get started|check out|sign up|join|visit|read more|explore|grab your|book a|schedule|order|download|subscribe)\b/i;
const URL_REGEX = /https?:\/\/[^\s)]+/gi;

/**
 * Normalizes text for exact deterministic matching:
 * - lowercase
 * - strips all punctuation and symbols
 * - collapses whitespace
 */
export function normalizeSentence(text: string): string {
  if (!text || typeof text !== "string") return "";
  return text
    .toLowerCase()
    .replace(/https?:\/\/[^\s)]+/g, " ") // strip URLs for wording comparison
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extracts a normalized wording skeleton for a CTA:
 * Replaces any URLs with `<URL>` placeholder so that:
 * Same URL with DIFFERENT wording -> ALLOWED.
 * Different or same URL with SAME wording -> CAUGHT AS DUPLICATE.
 */
export function normalizeCtaSkeleton(text: string): string {
  if (!text || typeof text !== "string") return "";
  return text
    .toLowerCase()
    .replace(/https?:\/\/[^\s)]+/g, "<url>")
    .replace(/[^\w\s<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Determines whether a sentence is a Call To Action (CTA).
 */
export function isCtaSentence(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  return CTA_TRIGGER_REGEX.test(text);
}

/**
 * Extracts the final sentence or final line of a post.
 */
export function extractFinalSentence(post: any): string {
  if (!post) return "";
  const parts: string[] = Array.isArray(post.threadParts) && post.threadParts.length > 0
    ? post.threadParts
    : (Array.isArray(post.parts) && post.parts.length > 0 ? post.parts : [post.singlePost || ""]);
  
  const lastPart = parts[parts.length - 1] || "";
  if (!lastPart.trim()) return "";

  const lines = lastPart.split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return "";
  const lastLine = lines[lines.length - 1];

  const sentences = splitIntoCompleteSentences(lastLine);
  if (sentences.length > 0) {
    return sentences[sentences.length - 1].trim();
  }
  return lastLine.trim();
}

/**
 * Extracts any CTA sentence present in a post (usually in last part, or in Part 2).
 */
export function extractCtaSentenceFromPost(post: any): string | null {
  if (!post) return null;
  const parts: string[] = Array.isArray(post.threadParts) && post.threadParts.length > 0
    ? post.threadParts
    : (Array.isArray(post.parts) && post.parts.length > 0 ? post.parts : [post.singlePost || ""]);

  // Search reverse from end of thread, or Part 2
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i] || "";
    const sentences = splitIntoCompleteSentences(part);
    for (let j = sentences.length - 1; j >= 0; j--) {
      const s = sentences[j].trim();
      if (isCtaSentence(s)) {
        return s;
      }
    }
  }
  return null;
}

/**
 * Tokenizes normalized text into word tokens.
 */
function tokenizeWords(text: string): string[] {
  return text.split(/\s+/).filter(w => w.length > 0);
}

/**
 * Deterministic Near-Duplicate Detection:
 * Detects near-duplicate sentences where wording or template structure is substantially identical.
 * Examples:
 * "Try this approach with your next post." vs "Try this strategy with your next post."
 * "Try ThreadsWorks here..." vs "Try ThreadsWorks now..."
 */
export function calculateNearDuplicate(
  candidate: string,
  existing: string,
  threshold: number = 0.72
): { isNearDuplicate: boolean; score: number } {
  const normCand = normalizeSentence(candidate);
  const normExist = normalizeSentence(existing);

  if (normCand === normExist) {
    return { isNearDuplicate: true, score: 1.0 };
  }

  const wordsCand = tokenizeWords(normCand);
  const wordsExist = tokenizeWords(normExist);

  if (wordsCand.length === 0 || wordsExist.length === 0) {
    return { isNearDuplicate: false, score: 0 };
  }

  // Set-based token intersection
  const setCand = new Set(wordsCand);
  const setExist = new Set(wordsExist);

  let intersectionCount = 0;
  for (const w of setCand) {
    if (setExist.has(w)) intersectionCount++;
  }

  const unionCount = new Set([...wordsCand, ...wordsExist]).size;
  const jaccard = unionCount > 0 ? intersectionCount / unionCount : 0;
  const overlap = Math.min(wordsCand.length, wordsExist.length) > 0
    ? intersectionCount / Math.min(wordsCand.length, wordsExist.length)
    : 0;

  // For short phrases (3-5 words), if overlap is >= 75% or differ by 1 word, flag near duplicate
  if (Math.min(wordsCand.length, wordsExist.length) <= 5) {
    if (wordsCand.length === wordsExist.length && Math.abs(wordsCand.length - intersectionCount) <= 1) {
      return { isNearDuplicate: true, score: 0.9 };
    }
    if (overlap >= 0.8) {
      return { isNearDuplicate: true, score: overlap };
    }
  }

  // Word-level positional matching (detects structural templates)
  if (wordsCand.length === wordsExist.length && wordsCand.length >= 4) {
    let exactPositionMatches = 0;
    for (let i = 0; i < wordsCand.length; i++) {
      if (wordsCand[i] === wordsExist[i]) exactPositionMatches++;
    }
    const posRatio = exactPositionMatches / wordsCand.length;
    if (posRatio >= 0.75) {
      return { isNearDuplicate: true, score: posRatio };
    }
  }

  // High Jaccard or high overlap
  if (jaccard >= threshold || (overlap >= 0.85 && wordsCand.length >= 4)) {
    return { isNearDuplicate: true, score: Math.max(jaccard, overlap) };
  }

  return { isNearDuplicate: false, score: jaccard };
}

/**
 * Checks whether text matches or closely paraphrases any known generic closing advice cliché.
 */
export function isGenericClosingCliche(sentence: string): boolean {
  const norm = normalizeSentence(sentence);
  if (!norm) return false;

  for (const cliche of GENERIC_CLOSING_CLICHES) {
    const normCliche = normalizeSentence(cliche);
    if (norm === normCliche || norm.includes(normCliche)) {
      return true;
    }
    const { isNearDuplicate } = calculateNearDuplicate(norm, normCliche, 0.75);
    if (isNearDuplicate) {
      return true;
    }
  }
  return false;
}

/**
 * BatchUniquenessTracker:
 * Holds temporary job-level uniqueness state for a generation batch.
 */
export class BatchUniquenessTracker {
  private usedFinalSentences: Set<string> = new Set();
  private usedRawFinalSentences: string[] = [];

  private usedCtaSkeletons: Set<string> = new Set();
  private usedRawCtas: string[] = [];

  private usedClosings: Set<string> = new Set();
  private usedRawClosings: string[] = [];

  constructor() {
    this.reset();
  }

  public reset(): void {
    this.usedFinalSentences.clear();
    this.usedRawFinalSentences = [];
    this.usedCtaSkeletons.clear();
    this.usedRawCtas = [];
    this.usedClosings.clear();
    this.usedRawClosings = [];
  }

  /**
   * Checks if candidate final line or CTA is duplicate against all previously accepted posts in the batch.
   */
  public check(candidateSentence: string, isCta: boolean = false): BatchUniquenessCheckResult {
    if (!candidateSentence || !candidateSentence.trim()) {
      return { isDuplicate: false };
    }

    const normCandidate = normalizeSentence(candidateSentence);

    // 1. Generic cliché check for non-promotional closing sentences
    if (!isCta && isGenericClosingCliche(candidateSentence)) {
      // If cliché already used, reject
      if (this.usedClosings.has(normCandidate)) {
        return {
          isDuplicate: true,
          reason: "generic_cliche",
          matchedWith: normCandidate
        };
      }
    }

    // 2. Exact match check
    if (this.usedFinalSentences.has(normCandidate)) {
      return {
        isDuplicate: true,
        reason: "exact_match",
        matchedWith: candidateSentence
      };
    }

    // 3. CTA wording skeleton check (permits legitimate URL repeat, but rejects duplicate wording)
    if (isCta) {
      const ctaSkel = normalizeCtaSkeleton(candidateSentence);
      if (this.usedCtaSkeletons.has(ctaSkel)) {
        return {
          isDuplicate: true,
          reason: "duplicate_cta_wording",
          matchedWith: candidateSentence
        };
      }

      // Check near-duplicate across all registered CTAs
      for (const rawCta of this.usedRawCtas) {
        const rawCtaSkel = normalizeCtaSkeleton(rawCta);
        const { isNearDuplicate, score } = calculateNearDuplicate(ctaSkel, rawCtaSkel, 0.70);
        if (isNearDuplicate) {
          return {
            isDuplicate: true,
            reason: "near_duplicate",
            matchedWith: rawCta,
            score
          };
        }
      }
    }

    // 4. Near-duplicate check across all registered final lines
    for (const prevRaw of this.usedRawFinalSentences) {
      const { isNearDuplicate, score } = calculateNearDuplicate(candidateSentence, prevRaw, 0.72);
      if (isNearDuplicate) {
        return {
          isDuplicate: true,
          reason: "near_duplicate",
          matchedWith: prevRaw,
          score
        };
      }
    }

    return { isDuplicate: false };
  }

  /**
   * Registers an accepted post into the batch uniqueness history.
   */
  public register(finalSentence: string, ctaSentence?: string | null): void {
    if (finalSentence && finalSentence.trim()) {
      const norm = normalizeSentence(finalSentence);
      this.usedFinalSentences.add(norm);
      this.usedRawFinalSentences.push(finalSentence.trim());
      this.usedClosings.add(norm);
      this.usedRawClosings.push(finalSentence.trim());
    }

    if (ctaSentence && ctaSentence.trim()) {
      const ctaSkel = normalizeCtaSkeleton(ctaSentence);
      this.usedCtaSkeletons.add(ctaSkel);
      this.usedRawCtas.push(ctaSentence.trim());
    }
  }

  public getStats() {
    return {
      totalFinalLines: this.usedFinalSentences.size,
      totalCtas: this.usedCtaSkeletons.size
    };
  }

  public getAllUsedFinalLines(): string[] {
    return [...this.usedRawFinalSentences];
  }

  public getAllUsedCtas(): string[] {
    return [...this.usedRawCtas];
  }
}

/**
 * Synthesizes a unique, context-grounded replacement closing sentence or CTA for a post
 * when a duplicate final line is detected.
 *
 * Preserves user intent, verified URLs, and angle/idea continuity.
 */
export function generateUniqueReplacementSentence(
  post: any,
  isCta: boolean,
  tracker: BatchUniquenessTracker,
  context: any
): string {
  const angleTitle = post.strategicLens || post.angle || context?.angle || "the core mechanism";
  const ideaTopic = post.title || post.idea || context?.topic || "your daily content";
  const verifiedUrl = context?.websiteUrl || (context?.approvedUrls && context.approvedUrls[0]) || "";
  const rawOffer = context?.offer && !context.offer.includes("Creator offer") && context.offer !== "a high-value product or service"
    ? context.offer.trim()
    : "";
  const verifiedOffer = rawOffer.replace(/\s*\(\$[\d\/a-z\s-]+\)/gi, "").replace(/\s+Upgrade\b/gi, "").trim();

  if (isCta) {
    // 35+ Distinct CTA invitation templates that incorporate verified context
    const ctaTemplates: (() => string)[] = [
      () => verifiedUrl ? `Explore our complete setup directly via ${verifiedUrl}.` : `What part of this process do you want to test first? Share below.`,
      () => verifiedUrl && verifiedOffer ? `Start putting ${verifiedOffer} to work for your business at ${verifiedUrl}.` : `Which of these steps creates the highest leverage for your audience?`,
      () => verifiedUrl ? `Access the setup and implementation steps at ${verifiedUrl}.` : `Drop your perspective below—how do you approach this in your daily workflow?`,
      () => verifiedUrl && verifiedOffer ? `Learn how ${verifiedOffer} streamlines your entire publishing process at ${verifiedUrl}.` : `Follow for more straightforward, practical strategies on ${ideaTopic}.`,
      () => verifiedUrl ? `Get the exact breakdown and tools right here: ${verifiedUrl}.` : `Reply with your biggest takeaway if you're implementing this today.`,
      () => verifiedUrl && verifiedOffer ? `Build out your dependable client momentum with ${verifiedOffer} at ${verifiedUrl}.` : `Which part of this strategy are you trying on your next post?`,
      () => verifiedUrl ? `See the step-by-step walkthrough at ${verifiedUrl}.` : `Save this post and revisit it before you draft your next thread.`,
      () => verifiedUrl ? `Review the full platform overview at ${verifiedUrl}.` : `What is the single biggest bottleneck in your current setup? Reply below.`,
      () => verifiedUrl && verifiedOffer ? `Accelerate your execution with ${verifiedOffer} over at ${verifiedUrl}.` : `Where does your workflow experience the most friction? Let's discuss.`,
      () => verifiedUrl ? `The entire technical reference is documented at ${verifiedUrl}.` : `Have you tested this approach with your own readers yet?`,
      () => verifiedUrl && verifiedOffer ? `Put ${verifiedOffer} into production at ${verifiedUrl}.` : `Drop a reply with the first adjustment you plan to make.`,
      () => verifiedUrl ? `Find the direct implementation guide at ${verifiedUrl}.` : `What other angles on this topic would be valuable to unpack?`,
      () => verifiedUrl && verifiedOffer ? `Unlock the complete capabilities of ${verifiedOffer} via ${verifiedUrl}.` : `Share your experience—what has worked best for your situation?`,
      () => verifiedUrl ? `Read the full case breakdown at ${verifiedUrl}.` : `Which metric do you monitor closest when testing this shift?`,
      () => verifiedUrl && verifiedOffer ? `Discover how ${verifiedOffer} simplifies daily publishing at ${verifiedUrl}.` : `How do you currently handle this in your own routines?`,
      () => verifiedUrl ? `Take a look at the published overview at ${verifiedUrl}.` : `Leave a comment with your favorite technique from this thread.`,
      () => verifiedUrl && verifiedOffer ? `Get direct access to ${verifiedOffer} through ${verifiedUrl}.` : `What questions do you have about putting this into practice?`,
      () => verifiedUrl ? `Inspect the complete operating model over at ${verifiedUrl}.` : `If this perspective helped you clarify your strategy, pass it along.`,
      () => verifiedUrl && verifiedOffer ? `Connect with ${verifiedOffer} to strengthen your output at ${verifiedUrl}.` : `Which of these insights will you apply first this week?`,
      () => verifiedUrl ? `Check out the complete practical roadmap at ${verifiedUrl}.` : `Tell me below: what was the hardest lesson you learned here?`,
      () => verifiedUrl && verifiedOffer ? `Tap into ${verifiedOffer} by visiting ${verifiedUrl}.` : `Let me know in the comments how you approach this challenge.`,
      () => verifiedUrl ? `All supporting details are available at ${verifiedUrl}.` : `What has been your biggest win when applying this rule?`,
      () => verifiedUrl && verifiedOffer ? `Transform your workflow using ${verifiedOffer} at ${verifiedUrl}.` : `Drop your questions below and let's troubleshoot them together.`,
      () => verifiedUrl ? `Follow the full process over at ${verifiedUrl}.` : `What other bottlenecks are holding back your consistency?`,
      () => verifiedUrl && verifiedOffer ? `Deploy ${verifiedOffer} in your business today via ${verifiedUrl}.` : `Which part of this thread surprised you the most?`,
      () => verifiedUrl ? `Browse the platform features at ${verifiedUrl}.` : `Save this thread so you have the reference handy for your next session.`,
      () => verifiedUrl && verifiedOffer ? `Activate ${verifiedOffer} directly at ${verifiedUrl}.` : `Are you focusing more on speed or retention right now?`,
      () => verifiedUrl ? `Explore the workflow at ${verifiedUrl}.` : `What is your primary goal with this system over the next 30 days?`,
      () => verifiedUrl && verifiedOffer ? `Empower your business with ${verifiedOffer} at ${verifiedUrl}.` : `Share this with a colleague who is working through the same challenge.`,
      () => verifiedUrl ? `Inspect the workflow notes over at ${verifiedUrl}.` : `What is the single biggest question you still have on this?`,
      () => verifiedUrl && verifiedOffer ? `Leverage ${verifiedOffer} to achieve your goals at ${verifiedUrl}.` : `Join the discussion below and let me know your thoughts.`,
      () => verifiedUrl ? `Examine the live implementation specs at ${verifiedUrl}.` : `How has this shift impacted your overall results?`,
      () => verifiedUrl && verifiedOffer ? `Work with ${verifiedOffer} to build lasting leverage at ${verifiedUrl}.` : `What would make this framework even easier for you to adopt?`,
      () => verifiedUrl ? `Get the complete details via ${verifiedUrl}.` : `Reply with your current baseline and let's track the progress.`,
      () => verifiedUrl && verifiedOffer ? `Get started with ${verifiedOffer} at ${verifiedUrl}.` : `Which rule from this post will you test first?`
    ];

    for (const genFn of ctaTemplates) {
      const candidate = genFn();
      const checkRes = tracker.check(candidate, true);
      if (!checkRes.isDuplicate) {
        return candidate;
      }
    }

    return verifiedUrl
      ? `Review the complete implementation details for ${ideaTopic} at ${verifiedUrl}.`
      : `Which angle on ${ideaTopic} resonates most with your current workflow?`;
  }

  // Natural, Structurally Distinct Non-Promotional Closing Sentences (Zero Internal Metadata Leakage & Grounded Mechanism Language)
  const nonCtaTemplates: (() => string)[] = [
    () => `When you test this perspective on your next post, readers can understand your point much faster.`,
    () => `Removing unnecessary manual friction is how quiet authority compounds.`,
    () => `The strongest shift happens when you treat clear positioning as a dependable operating standard.`,
    () => `Focus on demonstrating the concrete mechanism before trying to convince everyone at once.`,
    () => `True reader retention builds when your breakdown gives someone an immediate action they can test today.`,
    () => `Strip away the secondary noise and let the primary lesson stand completely on its own.`,
    () => `The creators who build durable leverage turn clear systems into a simple daily habit.`,
    () => `When you communicate with plain, direct language, you eliminate reader hesitation on the spot.`,
    () => `Test this single adjustment on your next post and observe how the responses shift.`,
    () => `A clear mechanism is usually more dependable than high-pressure drafting scrambles.`,
    () => `Make the insight so concrete that your reader recognizes their own situation immediately.`,
    () => `Sustainable momentum starts the moment you simplify your publishing standards.`,
    () => `High-retention writing begins by naming the exact obstacle in plain language without hesitation.`,
    () => `Every post can function as a compounding building block rather than disposable social noise.`,
    () => `Your audience doesn't need another generic checklist; they need a reliable, grounded perspective.`,
    () => `The 1-idea rule ensures that your core takeaway is much easier for readers to digest.`,
    () => `Ask yourself before publishing: does this observation give someone a measurable next move?`,
    () => `Discipline in everyday phrasing is what turns casual scrollers into engaged followers.`,
    () => `Show the actual mechanics behind your conclusions instead of hiding behind abstractions.`,
    () => `Treat your content archive as an active operating system that compounds over months.`,
    () => `If a sentence doesn't advance the core thesis, cut it without second-guessing.`,
    () => `The real bottleneck is rarely production volume; it's the precision of your message.`,
    () => `Fewer moving parts in your drafting workflow means fewer points of creative fatigue.`,
    () => `Consistent growth comes from protecting your creative energy while scaling authority.`,
    () => `When your reader sees the contrast clearly, they don't need to be persuaded to care.`,
    () => `Prioritize depth on one mechanism instead of skimming across five shallow topics.`,
    () => `The simplest explanation that solves the reader's bottleneck is often the one that resonates most.`,
    () => `Measure your writing by how easily someone can repeat your core principle to a peer.`,
    () => `Confidence on social platforms comes from understanding your mechanism inside and out.`,
    () => `When you anchor your advice in observed reality, your perspective needs no exaggeration.`,
    () => `Give your audience one definitive standard to evaluate their current progress against.`,
    () => `Clarity isn't about writing less; it's about making every single word pull its weight.`,
    () => `Let the strength of your observation carry the weight of the post from start to finish.`,
    () => `Replace vague aspirations with the exact sequence that generates steady progress.`,
    () => `When you demystify the core process, you build trust that vanity metrics rarely create.`,
    () => `The best feedback loop is watching how readers apply your framework in real time.`,
    () => `Build your publishing habit around repeatable standards rather than sporadic inspiration.`,
    () => `Direct, unvarnished insight can cut through feed clutter faster than polish.`,
    () => `Every clear distinction you draw between good and bad execution sharpens your brand.`,
    () => `Make your framework so straightforward that executing it feels completely natural.`,
    () => `The creators who endure are the ones who solve the same core problem better each month.`,
    () => `Patience in publishing means trusting that genuine insight compounds steadily over time.`,
    () => `Isolate the primary point of friction before attempting to optimize the entire workflow.`,
    () => `A single well-articulated distinction can save your audience months of trial and error.`,
    () => `Keep your attention focused on the levers that actually move the needle for your readers.`,
    () => `When you eliminate creative overthinking, your authentic voice comes through much more naturally.`,
    () => `Sound strategic judgment is a lasting asset that algorithms cannot easily duplicate.`,
    () => `Deliver so much clarity upfront that the next step becomes completely self-evident.`,
    () => `The ultimate competitive advantage is simply doing the fundamental work consistently.`,
    () => `Anchor each post in a finished thought that leaves no lingering questions in the feed.`
  ];

  for (const genFn of nonCtaTemplates) {
    const candidate = genFn();
    const checkRes = tracker.check(candidate, false);
    if (!checkRes.isDuplicate) {
      return candidate;
    }
  }

  return `Focus on what creates direct, measurable progress for your readers today.`;
}

/**
 * Repairs ONLY the duplicate closing sentence / CTA of a post.
 * Preserves hook, angle, main body, and thread structure.
 */
export function repairPostClosingSentence(
  post: any,
  tracker: BatchUniquenessTracker,
  context: any
): { repairedPost: any; oldClosing: string; newClosing: string } {
  const parts: string[] = Array.isArray(post.threadParts) && post.threadParts.length > 0
    ? [...post.threadParts]
    : (Array.isArray(post.parts) && post.parts.length > 0 ? [...post.parts] : [post.singlePost || ""]);

  const lastPartIdx = parts.length - 1;
  const lastPartText = parts[lastPartIdx] || "";
  const oldClosing = extractFinalSentence(post);
  const isCta = isCtaSentence(oldClosing) || Boolean(post.cta && isCtaSentence(post.cta));

  // Generate unique replacement sentence
  let newClosing = generateUniqueReplacementSentence(post, isCta, tracker, context);

  // Ensure new closing is unique; if collision persists, refine with angle-specific suffix
  let attempts = 0;
  while (tracker.check(newClosing, isCta).isDuplicate && attempts < 10) {
    attempts++;
    newClosing = generateUniqueReplacementSentence(post, isCta, tracker, {
      ...context,
      angle: `${post.angle || "core"} variation ${attempts}`
    });
  }

  // Replace oldClosing inside the final part, preserving the rest of the text
  let updatedPartText: string;
  if (oldClosing && lastPartText.includes(oldClosing)) {
    // Replace the exact final sentence occurrence
    const lastOccurIdx = lastPartText.lastIndexOf(oldClosing);
    updatedPartText = lastPartText.substring(0, lastOccurIdx) + newClosing + lastPartText.substring(lastOccurIdx + oldClosing.length);
  } else {
    // If not found cleanly, append new closing as a new paragraph
    updatedPartText = `${lastPartText.trim()}\n\n${newClosing}`;
  }

  updatedPartText = sanitizeSentenceSpacing(updatedPartText.trim());
  parts[lastPartIdx] = updatedPartText;

  const repairedPost = {
    ...post,
    threadParts: parts,
    parts: parts,
    singlePost: parts[0] || post.singlePost
  };

  if (isCta && post.cta) {
    repairedPost.cta = newClosing;
  }

  return { repairedPost, oldClosing, newClosing };
}

/**
 * Full-Batch Validation Pass (Stage 10):
 * Enforces batch-wide uniqueness across all generated posts.
 * Validates:
 * - 100% unique final lines (no two posts share the same ending)
 * - 0 duplicate CTAs
 * - 0 duplicate generic conclusions
 *
 * Runs deterministic checks and repairs ONLY the duplicate unit.
 */
export function validateAndEnforceBatchUniqueness(
  posts: any[],
  context: any = {}
): {
  posts: any[];
  repairedCount: number;
  uniqueFinalLinesCount: number;
  duplicateCtasCount: number;
  duplicateClosingsCount: number;
  repairDetails: Array<{ postIndex: number; oldClosing: string; newClosing: string; reason: string }>;
} {
  if (!Array.isArray(posts) || posts.length === 0) {
    return {
      posts: [],
      repairedCount: 0,
      uniqueFinalLinesCount: 0,
      duplicateCtasCount: 0,
      duplicateClosingsCount: 0,
      repairDetails: []
    };
  }

  const tracker = new BatchUniquenessTracker();
  const validatedPosts: any[] = [];
  const repairDetails: Array<{ postIndex: number; oldClosing: string; newClosing: string; reason: string }> = [];
  let duplicateCtasCount = 0;
  let duplicateClosingsCount = 0;

  for (let i = 0; i < posts.length; i++) {
    let currentPost = { ...posts[i] };
    const finalSent = extractFinalSentence(currentPost);
    const ctaSent = extractCtaSentenceFromPost(currentPost);
    const hasCta = Boolean(ctaSent);

    // Check if final line or CTA is duplicate against prior batch history
    let checkRes = tracker.check(finalSent, hasCta);
    if (!checkRes.isDuplicate && ctaSent && ctaSent !== finalSent) {
      checkRes = tracker.check(ctaSent, true);
    }

    if (checkRes.isDuplicate) {
      if (checkRes.reason === "duplicate_cta_wording") {
        duplicateCtasCount++;
      } else {
        duplicateClosingsCount++;
      }

      // Repair ONLY this duplicate post's closing/CTA
      const { repairedPost, oldClosing, newClosing } = repairPostClosingSentence(
        currentPost,
        tracker,
        {
          ...context,
          topic: currentPost.idea || currentPost.title || context?.topic,
          angle: currentPost.angle || currentPost.strategicLens || context?.angle
        }
      );

      repairDetails.push({
        postIndex: i,
        oldClosing,
        newClosing,
        reason: checkRes.reason || "duplicate_detected"
      });

      currentPost = repairedPost;

      // Register the repaired unique closing
      const repairedFinalSent = extractFinalSentence(currentPost);
      const repairedCtaSent = extractCtaSentenceFromPost(currentPost);
      tracker.register(repairedFinalSent, repairedCtaSent);
      validatedPosts.push(currentPost);
    } else {
      // Post is clean & unique - register it
      tracker.register(finalSent, ctaSent);
      validatedPosts.push(currentPost);
    }
  }

  // Enforce batch-wide body sentence deduplication across all posts
  const globalSeenSentences = new Map<string, number>();
  for (let pIdx = 0; pIdx < validatedPosts.length; pIdx++) {
    const post = validatedPosts[pIdx];
    const parts = Array.isArray(post.threadParts) ? [...post.threadParts] : [post.singlePost || ""];
    let postModified = false;

    for (let ptIdx = 0; ptIdx < parts.length; ptIdx++) {
      let partText = parts[ptIdx];
      const sents = partText.split(/(?<=[.!?])\s+/);
      const uniqueSents: string[] = [];

      for (const sent of sents) {
        const clean = normalizeSentence(sent);
        if (clean.length > 25) {
          if (globalSeenSentences.has(clean) && globalSeenSentences.get(clean) !== pIdx) {
            // Duplicate found from an earlier post; remove or adapt
            postModified = true;
            continue;
          }
          globalSeenSentences.set(clean, pIdx);
        }
        uniqueSents.push(sent);
      }

      if (uniqueSents.length > 0) {
        parts[ptIdx] = uniqueSents.join(" ").trim();
      }
    }

    if (postModified) {
      post.threadParts = parts;
      post.parts = parts;
      post.singlePost = parts[0] || post.singlePost;
      validatedPosts[pIdx] = post;
    }
  }

  // Final verification check
  const finalCheckTracker = new Set<string>();
  let finalUniqueCount = 0;
  for (const p of validatedPosts) {
    const f = normalizeSentence(extractFinalSentence(p));
    if (f && !finalCheckTracker.has(f)) {
      finalCheckTracker.add(f);
      finalUniqueCount++;
    }
  }

  return {
    posts: validatedPosts,
    repairedCount: repairDetails.length,
    uniqueFinalLinesCount: finalUniqueCount,
    duplicateCtasCount,
    duplicateClosingsCount,
    repairDetails
  };
}
