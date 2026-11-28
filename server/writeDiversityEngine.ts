/**
 * ThreadsWorks Anti-Repetition & Diversity Engine (Module 2)
 *
 * Lightweight, zero-external-infrastructure diversity enforcement using:
 * 1. Rolling Angle Ledger (hydrated from generation_intelligence snapshot + recentLibraryPosts)
 * 2. Pre-Assigned Rhetorical & Structural Slot Planning (8 lenses x 4 shapes)
 * 3. Deterministic Post-Draft Similarity Gate (opening prefix, hook Jaccard/trigram,
 *    body lexical & 3-shingle overlap, closing-skeleton dedupe, formulaic opener guard)
 * 4. Compact O(N) Prior-Post Fingerprints (eliminates quadratic full-text payload bloat)
 */

import type { WritingLengthPlan } from "./writeContextGate";

export interface RhetoricalLens {
  id: string;
  label: string;
  guidance: string;
}

export const RHETORICAL_LENSES: RhetoricalLens[] = [
  {
    id: "observation",
    label: "Sharp Observation",
    guidance: "Open with a concrete, recognizable everyday detail or pattern and unpack why it matters."
  },
  {
    id: "tradeoff",
    label: "Hidden Tradeoff",
    guidance: "Compare two reasonable approaches and expose the non-obvious cost or upside of choosing one over the other."
  },
  {
    id: "counterexample",
    label: "Counterexample / Edge Case",
    guidance: "Challenge a default assumption using a concrete counterexample or boundary case where standard advice breaks."
  },
  {
    id: "tactical_walkthrough",
    label: "Tactical Walkthrough",
    guidance: "Walk through one specific sequence, check, or workflow step-by-step with concrete actions rather than theory."
  },
  {
    id: "decision_rule",
    label: "Decision Rule / Heuristic",
    guidance: "Give a crisp operational rule or filter someone can use to make a fast, high-clarity judgment call."
  },
  {
    id: "diagnostic_question",
    label: "Diagnostic Lens",
    guidance: "Frame a precise diagnostic question or self-check that helps the reader spot a blind spot immediately."
  },
  {
    id: "narrative_beat",
    label: "Grounded Moment / Turning Point",
    guidance: "Tell a brief, grounded moment or explicitly signaled hypothetical scenario that reveals a practical insight."
  },
  {
    id: "reframe",
    label: "Mental Model Reframe",
    guidance: "Redefine a familiar obstacle by shifting what variable actually drives the outcome."
  }
];

export type StructuralShape =
  | "single_punch"
  | "two_part_contrast"
  | "compact_breakdown"
  | "developed_thread";

export type EditorialStructure =
  | "standalone_insight"
  | "personal_reflection"
  | "short_explanation"
  | "story_or_lesson"
  | "educational_breakdown"
  | "step_by_step_guide"
  | "detailed_thread";

export interface SlotDiversityAssignment {
  slotNumber: number;
  lensId: string;
  lensLabel: string;
  lensGuidance: string;
  structuralShape: StructuralShape;
  editorialStructure?: EditorialStructure;
  shapeGuidance: string;
  targetParts?: number;
  minParts?: number;
  maxParts?: number;
  targetSentencesPerPart?: number;
  minSentencesPerPart?: number;
  maxSentencesPerPart?: number;
}

export interface AngleLedgerEntry {
  lens?: string;
  title?: string;
  hook: string;
  hookPrefix: string;
  thesisSummary: string;
  closingSkeleton: string;
  bodyTokens?: string[];
  createdAt?: string;
}

export interface RollingDiversityLedger {
  entries: AngleLedgerEntry[];
  recentHooks: string[];
  recentThemes: string[];
  recentClosings: string[];
  recentLenses: string[];
}

export interface NoveltyCheckResult {
  passed: boolean;
  defects: string[];
}

const DIVERSITY_STOPWORDS = new Set([
  "the", "be", "to", "of", "and", "a", "in", "that", "have", "i", "it", "for", "not", "on",
  "with", "he", "as", "you", "do", "at", "this", "but", "his", "by", "from", "they", "we",
  "say", "her", "she", "or", "an", "will", "my", "one", "all", "would", "there", "their",
  "what", "so", "up", "out", "if", "about", "who", "get", "which", "go", "me", "when",
  "make", "can", "like", "time", "no", "just", "him", "know", "take", "people", "into",
  "year", "your", "good", "some", "could", "them", "see", "other", "than", "then", "now",
  "look", "only", "come", "its", "over", "think", "also", "back", "after", "use", "two",
  "how", "our", "work", "first", "well", "way", "even", "new", "want", "because", "any",
  "these", "give", "day", "most", "us", "is", "are", "was", "were", "been", "has", "had",
  "here", "why", "more", "very", "much", "really", "dont", "cant", "wont", "youre", "thats"
]);

const FORMULAIC_OPENERS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /^most\s+(?:people|creators|founders|entrepreneurs|writers|businesses)\b/i, label: "\"Most people/creators...\"" },
  { pattern: /^here['’]?s\s+(?:the\s+)?(?:uncomfortable\s+|brutal\s+|hard\s+|real\s+)?truth\b/i, label: "\"Here's the truth...\"" },
  { pattern: /^here\s+is\s+(?:the\s+)?(?:uncomfortable\s+|brutal\s+|hard\s+|real\s+)?truth\b/i, label: "\"Here is the truth...\"" },
  { pattern: /^stop\s+(?:doing|trying|chasing|wasting|posting|overthinking)\b/i, label: "\"Stop doing/trying...\"" },
  { pattern: /^unpopular\s+opinion\s*:/i, label: "\"Unpopular opinion:\"" },
  { pattern: /^nobody\s+talks\s+about\b/i, label: "\"Nobody talks about...\"" },
  { pattern: /^the\s+biggest\s+mistake\b/i, label: "\"The biggest mistake...\"" },
  { pattern: /^you\s+don['’]?t\s+need\s+(?:more|another)\b/i, label: "\"You don't need more...\"" }
];

export function normalizeForFingerprint(text: string): string {
  return (text || "")
    .toLowerCase()
    .replace(/https?:\/\/[^\s<>]+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractContentTokens(text: string): string[] {
  const norm = normalizeForFingerprint(text);
  if (!norm) return [];
  return norm
    .split(" ")
    .filter(w => w.length > 2 && !DIVERSITY_STOPWORDS.has(w));
}

export function extractOpeningPrefix(text: string, wordCount: number = 4): string {
  const norm = normalizeForFingerprint(text);
  if (!norm) return "";
  return norm.split(" ").slice(0, wordCount).join(" ");
}

export function extractClosingSkeleton(parts: string[]): string {
  const lastPart = (parts[parts.length - 1] || "").trim();
  if (!lastPart) return "";
  const lines = lastPart.split(/\n+/).map(l => l.trim()).filter(Boolean);
  const lastLine = lines[lines.length - 1] || "";
  const sentences = lastLine.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
  const finalSentence = sentences[sentences.length - 1] || lastLine;
  return finalSentence
    .toLowerCase()
    .replace(/https?:\/\/[^\s<>]+/g, "<url>")
    .replace(/[^a-z0-9<>\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildWordShingles(tokens: string[], n: number = 3): Set<string> {
  const shingles = new Set<string>();
  if (tokens.length < n) {
    if (tokens.length > 0) shingles.add(tokens.join(" "));
    return shingles;
  }
  for (let i = 0; i <= tokens.length - n; i++) {
    shingles.add(tokens.slice(i, i + n).join(" "));
  }
  return shingles;
}

export function jaccardSets(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union > 0 ? intersection / union : 0;
}

function overlapCoefficient(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }
  const denom = Math.min(a.size, b.size);
  return denom > 0 ? intersection / denom : 0;
}

export function detectFormulaicOpener(hook: string): string | null {
  const clean = (hook || "").trim();
  for (const rule of FORMULAIC_OPENERS) {
    if (rule.pattern.test(clean)) return rule.label;
  }
  return null;
}

/**
 * Builds a compact summary of a draft for O(N) prompt context & ledger persistence.
 */
export function summarizeDraftForLedger(
  draft: { title?: string; hook?: string; singlePost?: string; threadParts?: string[] },
  lens?: string
): AngleLedgerEntry {
  const parts = Array.isArray(draft.threadParts) && draft.threadParts.length > 0
    ? draft.threadParts
    : [draft.singlePost || ""];
  const hook = (draft.hook || parts[0]?.split(/\n+/)[0] || "").trim();
  const fullBody = parts.join(" ").trim();
  const bodySnippet = fullBody.length > 160 ? `${fullBody.slice(0, 157).trim()}...` : fullBody;

  return {
    lens: lens || undefined,
    title: (draft.title || "").trim() || undefined,
    hook,
    hookPrefix: extractOpeningPrefix(hook, 4),
    thesisSummary: (draft.title ? `${draft.title}: ` : "") + bodySnippet,
    closingSkeleton: extractClosingSkeleton(parts),
    bodyTokens: extractContentTokens(fullBody).slice(0, 60),
    createdAt: new Date().toISOString()
  };
}

/**
 * Hydrates a unified rolling diversity ledger from the Firestore snapshot
 * AND client-supplied recentLibraryPosts (zero extra Firestore reads).
 */
export function buildRollingLedger(
  snapshot: any | null | undefined,
  recentLibraryPosts: any[] = [],
  extraPreviousHooks: string[] = [],
  extraPreviousAngles: string[] = []
): RollingDiversityLedger {
  const entries: AngleLedgerEntry[] = [];
  const seenHookNorms = new Set<string>();

  const pushEntry = (entry: AngleLedgerEntry) => {
    const norm = normalizeForFingerprint(entry.hook);
    if (!norm || seenHookNorms.has(norm)) return;
    seenHookNorms.add(norm);
    entries.push(entry);
  };

  // 1. Existing structured angle ledger entries from snapshot
  if (Array.isArray(snapshot?.recentAngleLedger)) {
    for (const item of snapshot.recentAngleLedger.slice(0, 20)) {
      if (item && typeof item.hook === "string" && item.hook.trim()) {
        pushEntry({
          lens: item.lens,
          title: item.title,
          hook: item.hook.trim(),
          hookPrefix: item.hookPrefix || extractOpeningPrefix(item.hook, 4),
          thesisSummary: item.thesisSummary || item.title || item.hook,
          closingSkeleton: item.closingSkeleton || "",
          bodyTokens: Array.isArray(item.bodyTokens) ? item.bodyTokens : extractContentTokens(item.thesisSummary || item.hook),
          createdAt: item.createdAt
        });
      }
    }
  }

  // 2. Client-supplied recent saved library posts (last 30)
  if (Array.isArray(recentLibraryPosts)) {
    for (const post of recentLibraryPosts.slice(0, 30)) {
      if (!post || typeof post !== "object") continue;
      const parts = Array.isArray(post.threadParts) && post.threadParts.length > 0
        ? post.threadParts
        : [post.singlePost || post.text || post.content || ""];
      const hook = (post.hook || parts[0]?.split(/\n+/)[0] || post.title || "").trim();
      if (!hook) continue;
      pushEntry(summarizeDraftForLedger({ title: post.title, hook, threadParts: parts }, post.strategicAngle || post.angle));
    }
  }

  // 3. Snapshot flat arrays (backwards compatibility with older snapshots)
  const snapshotHooks: string[] = Array.isArray(snapshot?.recentHooks) ? snapshot.recentHooks : [];
  for (const h of [...extraPreviousHooks, ...snapshotHooks]) {
    if (typeof h === "string" && h.trim()) {
      pushEntry({
        hook: h.trim(),
        hookPrefix: extractOpeningPrefix(h, 4),
        thesisSummary: h.trim(),
        closingSkeleton: "",
        bodyTokens: extractContentTokens(h)
      });
    }
  }

  const recentThemes = Array.from(
    new Set(
      [
        ...(Array.isArray(snapshot?.recentThemes) ? snapshot.recentThemes : []),
        ...entries.map(e => e.title).filter(Boolean) as string[]
      ].map(s => String(s).trim()).filter(Boolean)
    )
  ).slice(0, 15);

  const recentClosings = Array.from(
    new Set(
      [
        ...(Array.isArray(snapshot?.recentClosings) ? snapshot.recentClosings : []),
        ...entries.map(e => e.closingSkeleton).filter(Boolean)
      ].map(s => String(s).trim()).filter(Boolean)
    )
  ).slice(0, 15);

  const recentLenses = Array.from(
    new Set(
      [
        ...extraPreviousAngles,
        ...entries.map(e => e.lens).filter(Boolean) as string[]
      ].map(s => String(s).trim().toLowerCase()).filter(Boolean)
    )
  ).slice(0, 12);

  return {
    entries: entries.slice(0, 30),
    recentHooks: entries.map(e => e.hook).slice(0, 20),
    recentThemes,
    recentClosings,
    recentLenses
  };
}

export interface ControlledRandomnessOptions {
  /** Custom random number generator returning [0, 1). Overrides randomSeed when supplied. */
  random?: () => number;
  /** Deterministic seed (number or string) for reproducible tests. */
  randomSeed?: number | string;
}

/**
 * Deterministic Mulberry32 PRNG for testable controlled randomness.
 */
export function createSeededRandom(seed: number | string): () => number {
  let h = 2166136261 >>> 0;
  const seedStr = String(seed);
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let state = (h >>> 0) || 0x9e3779b9;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function resolveRng(options?: ControlledRandomnessOptions): () => number {
  if (typeof options?.random === "function") return options.random;
  if (options?.randomSeed !== undefined) return createSeededRandom(options.randomSeed);
  return Math.random;
}

/**
 * Natural depth affinity range per rhetorical lens (within 1–10 parts).
 * Guides AI-selected length with controlled randomness while letting content quality lead.
 */
const LENS_PART_AFFINITY: Record<string, [number, number]> = {
  observation: [1, 4],
  diagnostic_question: [1, 5],
  decision_rule: [2, 5],
  counterexample: [2, 6],
  narrative_beat: [3, 7],
  tradeoff: [3, 8],
  reframe: [3, 8],
  tactical_walkthrough: [4, 10]
};

function sampleControlledPartCount(params: {
  minParts: number;
  maxParts: number;
  preferredMin: number;
  preferredMax: number;
  lensId: string;
  rng: () => number;
}): number {
  const { minParts, maxParts, preferredMin, preferredMax, lensId, rng } = params;
  const hardMin = Math.max(1, Math.min(10, minParts));
  const hardMax = Math.max(hardMin, Math.min(10, maxParts));
  if (hardMin === hardMax) return hardMin;

  const [lensMin, lensMax] = LENS_PART_AFFINITY[lensId] || [preferredMin, preferredMax];
  // Intersect lens natural depth with the writing plan's valid bounds; widen to preferred/hard range if disjoint.
  let low = Math.max(hardMin, Math.min(preferredMax, lensMin));
  let high = Math.min(hardMax, Math.max(preferredMin, lensMax));
  if (low > high) {
    low = Math.max(hardMin, preferredMin);
    high = Math.min(hardMax, preferredMax);
  }
  if (low > high) {
    low = hardMin;
    high = hardMax;
  }

  // Build candidate values with light de-biasing against repeatedly collapsing to 1 part when deeper range exists
  const candidates: Array<{ parts: number; weight: number }> = [];
  for (let p = low; p <= high; p++) {
    const isOneInDeepRange = p === 1 && high >= 3;
    const isExtremeEdge = p >= 9 && low <= 4;
    const weight = isOneInDeepRange ? 0.55 : isExtremeEdge ? 0.75 : 1.0;
    candidates.push({ parts: p, weight });
  }

  const totalWeight = candidates.reduce((acc, c) => acc + c.weight, 0);
  let pick = Math.max(0, Math.min(0.999999, rng())) * totalWeight;
  for (const c of candidates) {
    pick -= c.weight;
    if (pick <= 0) return c.parts;
  }
  return candidates[candidates.length - 1].parts;
}

function shuffleWithRng<T>(items: T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.max(0, Math.min(0.999999, rng())) * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function shapeForPartCount(parts: number): StructuralShape {
  if (parts <= 1) return "single_punch";
  if (parts === 2) return "two_part_contrast";
  if (parts <= 4) return "compact_breakdown";
  return "developed_thread";
}

export function resolveEditorialStructure(lensId: string, parts: number): EditorialStructure {
  if (parts <= 1) {
    return lensId === "narrative_beat" ? "personal_reflection" : "standalone_insight";
  }
  if (parts === 2) {
    if (lensId === "narrative_beat") return "personal_reflection";
    return "short_explanation";
  }
  if (parts <= 4) {
    if (lensId === "narrative_beat") return "story_or_lesson";
    if (lensId === "tactical_walkthrough") return "step_by_step_guide";
    return "educational_breakdown";
  }
  if (lensId === "tactical_walkthrough") return "step_by_step_guide";
  if (lensId === "narrative_beat") return "story_or_lesson";
  return parts >= 6 ? "detailed_thread" : "educational_breakdown";
}

function describeSlotShape(parts: number, plan: WritingLengthPlan, lensId: string = "observation"): string {
  const sentenceCue =
    plan.sentencesMode === "explicit"
      ? `exactly ${plan.recommendedSentencesPerPart} ${plan.recommendedSentencesPerPart === 1 ? "sentence" : "sentences"} per part`
      : `${plan.minSentencesPerPart}–${plan.maxSentencesPerPart} clear sentences per part`;

  const editorial = resolveEditorialStructure(lensId, parts);
  const editorialLabel = editorial.replace(/_/g, " ");

  if (plan.partCountMode === "explicit") {
    if (parts <= 1) {
      return `EXACTLY 1-part standalone post (${sentenceCue}): deliver one complete, self-contained insight with zero placeholder phrasing.`;
    }
    return `EXACTLY ${parts}-part thread (${editorialLabel}, ${sentenceCue}): every part advances the argument cleanly in sequence with zero filler or repetition.`;
  }

  if (parts <= 1) {
    return `Editorial option: ${editorialLabel} (~1 part suggested, ${plan.minParts}–${plan.maxParts} allowed, ${sentenceCue}). Deliver one complete, self-contained insight; expand only if the idea genuinely earns more parts.`;
  }
  if (parts === 2) {
    return `Editorial option: ${editorialLabel} (~2 parts suggested, ${plan.minParts}–${plan.maxParts} allowed, ${sentenceCue}). Part 1 establishes the core observation or tension; Part 2 delivers the concrete reasoning, mechanism, or takeaway.`;
  }
  if (parts <= 4) {
    return `Editorial option: ${editorialLabel} (~${parts} parts suggested, ${plan.minParts}–${plan.maxParts} allowed, ${sentenceCue}). Develop the opening promise through specific reasoning, grounded detail, and a crisp closing takeaway across distinct parts without compressing into a 1-part stub.`;
  }
  return `Editorial option: ${editorialLabel} (~${parts} parts suggested, ${plan.minParts}–${plan.maxParts} allowed, ${sentenceCue}). Unpack each layer, step, or turning point across distinct parts where every part adds real value; adjust naturally within ${plan.minParts}–${plan.maxParts} parts without padding or shallow truncation.`;
}

/**
 * Aligns automatic batch slot targets to the universal 1–10 part standard with
 * natural AI-guided variation and controlled randomness.
 * Never enforces mandatory distinct-part-count quotas or artificial 2–6 clamps;
 * explicit part-count selections remain strictly untouched.
 */
export function planEightPostAiDecideParts(
  assignments: SlotDiversityAssignment[],
  writingPlan: WritingLengthPlan,
  options?: ControlledRandomnessOptions
): SlotDiversityAssignment[] {
  if (assignments.length === 0 || writingPlan.partCountMode === "explicit") return assignments;
  const min = Math.max(1, Math.min(10, writingPlan.minParts));
  const max = Math.max(min, Math.min(10, writingPlan.maxParts));
  const preferredMin = Math.max(min, Math.min(max, writingPlan.preferredMinParts ?? min));
  const preferredMax = Math.max(preferredMin, Math.min(max, writingPlan.preferredMaxParts ?? max));
  const rng = resolveRng(options);

  return assignments.map((slot) => {
    const existingValid =
      typeof slot.targetParts === "number" &&
      slot.targetParts >= min &&
      slot.targetParts <= max &&
      !(max >= 3 && slot.targetParts === 1 && assignments.every(s => s.targetParts === 1));
    const target = existingValid
      ? slot.targetParts!
      : sampleControlledPartCount({
          minParts: min,
          maxParts: max,
          preferredMin,
          preferredMax,
          lensId: slot.lensId,
          rng
        });

    return {
      ...slot,
      targetParts: target,
      minParts: min,
      maxParts: max,
      structuralShape: shapeForPartCount(target),
      editorialStructure: resolveEditorialStructure(slot.lensId, target),
      shapeGuidance: describeSlotShape(target, { ...writingPlan, minParts: min, maxParts: max }, slot.lensId)
    };
  });
}

export function planSmallBatchAiDecideParts(
  assignments: SlotDiversityAssignment[],
  writingPlan: WritingLengthPlan
): SlotDiversityAssignment[] {
  if (![4, 7].includes(assignments.length) || writingPlan.partCountMode === "explicit" || writingPlan.maxParts < 2) return assignments;
  let singles = 0;
  const min = Math.max(1, writingPlan.minParts);
  const max = Math.max(min, writingPlan.maxParts);
  return assignments.map(slot => {
    let target = Math.max(min, Math.min(max, slot.targetParts ?? writingPlan.recommendedParts));
    if (target === 1 && ++singles > 1) target = Math.max(2, min);
    return {
      ...slot,
      targetParts: target,
      minParts: min,
      maxParts: max,
      structuralShape: shapeForPartCount(target),
      editorialStructure: resolveEditorialStructure(slot.lensId, target),
      shapeGuidance: describeSlotShape(target, writingPlan, slot.lensId)
    };
  });
}

export function planBatchSlots(params: {
  count: number;
  ledger: RollingDiversityLedger;
  partCount?: number;
  requestedAngle?: string | null;
  writingPlan?: WritingLengthPlan;
  random?: () => number;
  randomSeed?: number | string;
}): SlotDiversityAssignment[] {
  const { count, ledger, partCount, requestedAngle, writingPlan, random, randomSeed } = params;
  const rng = resolveRng({ random, randomSeed });
  const recentLensSet = new Set(ledger.recentLenses.slice(0, 4).map(l => l.toLowerCase()));

  // Prioritize lenses not recently used in the ledger, with controlled shuffling inside each tier
  const freshLenses = shuffleWithRng(
    RHETORICAL_LENSES.filter(
      l => !recentLensSet.has(l.id) && !recentLensSet.has(l.label.toLowerCase())
    ),
    rng
  );
  const cooledLenses = shuffleWithRng(
    RHETORICAL_LENSES.filter(
      l => recentLensSet.has(l.id) || recentLensSet.has(l.label.toLowerCase())
    ),
    rng
  );
  const orderedPool = [...freshLenses, ...cooledLenses];

  if (writingPlan) {
    const isExplicit = writingPlan.partCountMode === "explicit" || writingPlan.minParts === writingPlan.maxParts;
    const min = Math.max(1, writingPlan.minParts);
    const max = Math.max(min, writingPlan.maxParts);
    const preferredMin = Math.max(min, Math.min(max, writingPlan.preferredMinParts ?? min));
    const preferredMax = Math.max(preferredMin, Math.min(max, writingPlan.preferredMaxParts ?? max));

    const assignments: SlotDiversityAssignment[] = [];
    for (let i = 0; i < count; i++) {
      const lens = orderedPool[i % orderedPool.length];
      const slotParts = isExplicit
        ? writingPlan.recommendedParts
        : sampleControlledPartCount({
            minParts: min,
            maxParts: max,
            preferredMin,
            preferredMax,
            lensId: lens.id,
            rng
          });

      const useExplicitAngle = i === 0 && requestedAngle && requestedAngle.trim().length > 0;

      assignments.push({
        slotNumber: i + 1,
        lensId: lens.id,
        lensLabel: useExplicitAngle ? `${requestedAngle!.trim()} (${lens.label})` : lens.label,
        lensGuidance: useExplicitAngle
          ? `Honor the requested angle "${requestedAngle!.trim()}" through this lens: ${lens.guidance}`
          : lens.guidance,
        structuralShape: shapeForPartCount(slotParts),
        editorialStructure: resolveEditorialStructure(lens.id, slotParts),
        shapeGuidance: describeSlotShape(slotParts, writingPlan, lens.id),
        targetParts: slotParts,
        minParts: min,
        maxParts: max,
        targetSentencesPerPart: writingPlan.recommendedSentencesPerPart,
        minSentencesPerPart: writingPlan.minSentencesPerPart,
        maxSentencesPerPart: writingPlan.maxSentencesPerPart
      });
    }

    return assignments;
  }

  // Backwards-compatible fallback when writingPlan is omitted by legacy callers/tests
  const assignments: SlotDiversityAssignment[] = [];
  for (let i = 0; i < count; i++) {
    const lens = orderedPool[i % orderedPool.length];
    const slotParts =
      typeof partCount === "number" && partCount >= 1
        ? partCount
        : sampleControlledPartCount({
            minParts: 1,
            maxParts: 10,
            preferredMin: 2,
            preferredMax: 8,
            lensId: lens.id,
            rng
          });
    const useExplicitAngle = i === 0 && requestedAngle && requestedAngle.trim().length > 0;
    const shape = shapeForPartCount(slotParts);

    assignments.push({
      slotNumber: i + 1,
      lensId: lens.id,
      lensLabel: useExplicitAngle ? `${requestedAngle!.trim()} (${lens.label})` : lens.label,
      lensGuidance: useExplicitAngle
        ? `Honor the requested angle "${requestedAngle!.trim()}" through this lens: ${lens.guidance}`
        : lens.guidance,
      structuralShape: shape,
      editorialStructure: resolveEditorialStructure(lens.id, slotParts),
      shapeGuidance:
        partCount !== undefined
          ? `EXACTLY ${partCount}-part ${partCount === 1 ? "standalone post" : "thread"} with clear reasoning and zero filler.`
          : `Editorial option: ${resolveEditorialStructure(lens.id, slotParts).replace(/_/g, " ")} (~${slotParts} parts suggested, auto 1–10 allowed) matched to the depth of the idea without filler.`,
      targetParts: slotParts,
      minParts: partCount ?? 1,
      maxParts: partCount ?? 10
    });
  }

  return assignments;
}

/**
 * Formats compact exclusion context for the model (O(N) tokens, never dumps full threadParts).
 */
export function buildCompactExclusionSummary(
  acceptedDrafts: Array<{ title?: string; hook?: string; threadParts?: string[]; singlePost?: string; lens?: string }>,
  ledger: RollingDiversityLedger
): {
  currentBatchPrior: Array<{ slot: number; lens?: string; title: string; hook: string; thesisSummary: string }>;
  recentHistoryHooksToAvoid: string[];
  recentClosingsToAvoid: string[];
} {
  const currentBatchPrior = acceptedDrafts.map((d, idx) => {
    const summary = summarizeDraftForLedger(d, d.lens);
    return {
      slot: idx + 1,
      ...(summary.lens ? { lens: summary.lens } : {}),
      title: summary.title || `Post ${idx + 1}`,
      hook: summary.hook,
      thesisSummary: summary.thesisSummary.slice(0, 140)
    };
  });

  return {
    currentBatchPrior,
    recentHistoryHooksToAvoid: ledger.recentHooks.slice(0, 12),
    recentClosingsToAvoid: ledger.recentClosings.slice(0, 8)
  };
}

/**
 * Fast deterministic anti-repetition gate executed inside per-draft validation BEFORE LLM review.
 * Rejects lexical/structural/prefix/closing duplicates cleanly without mutating prose.
 */
export function checkDraftNovelty(
  draft: { title?: string; hook?: string; singlePost?: string; threadParts?: string[] },
  options: {
    slotNumber: number;
    acceptedDrafts: Array<{ title?: string; hook?: string; singlePost?: string; threadParts?: string[] }>;
    ledger?: RollingDiversityLedger;
    /** Optional domain words from contentRequest to exclude from generic body overlap false positives */
    topicText?: string;
    /** Skip opening checks when user explicitly locked the opening hook */
    lockedHook?: string;
  }
): NoveltyCheckResult {
  const defects: string[] = [];
  const label = `Post ${options.slotNumber}`;
  const parts = Array.isArray(draft.threadParts) && draft.threadParts.length > 0
    ? draft.threadParts
    : [draft.singlePost || ""];
  const hook = (draft.hook || parts[0]?.split(/\n+/)[0] || "").trim();
  const fullText = parts.join(" ").trim();

  const topicTokens = new Set(extractContentTokens(options.topicText || ""));
  const filterNonTopic = (tokens: string[]) => {
    const filtered = tokens.filter(t => !topicTokens.has(t));
    // Fall back to full tokens if topic filtering leaves too few tokens to compare meaningfully
    return filtered.length >= 4 ? filtered : tokens;
  };

  const candHookPrefix = extractOpeningPrefix(hook, 4);
  const candHookTokens = new Set(extractContentTokens(hook));
  const candBodyTokens = filterNonTopic(extractContentTokens(fullText));
  const candBodySet = new Set(candBodyTokens);
  const candShingles = buildWordShingles(extractContentTokens(fullText), 3);
  const candClosing = extractClosingSkeleton(parts);

  // 1. Check against accepted drafts in the current batch
  let formulaicCountInBatch = 0;
  for (let i = 0; i < options.acceptedDrafts.length; i++) {
    const prev = options.acceptedDrafts[i];
    const prevParts = Array.isArray(prev.threadParts) && prev.threadParts.length > 0
      ? prev.threadParts
      : [prev.singlePost || ""];
    const prevHook = (prev.hook || prevParts[0]?.split(/\n+/)[0] || "").trim();
    const prevFull = prevParts.join(" ").trim();

    if (detectFormulaicOpener(prevHook)) {
      formulaicCountInBatch++;
    }

    if (!options.lockedHook) {
      const prevPrefix = extractOpeningPrefix(prevHook, 4);
      if (candHookPrefix.length >= 14 && candHookPrefix === prevPrefix) {
        defects.push(`${label} repeats the opening phrase "${candHookPrefix}" from Post ${i + 1}.`);
        break;
      }

      const prevHookSet = new Set(extractContentTokens(prevHook));
      const hookSim = jaccardSets(candHookTokens, prevHookSet);
      if (candHookTokens.size >= 4 && hookSim >= 0.58) {
        defects.push(`${label} hook closely paraphrases Post ${i + 1} (${Math.round(hookSim * 100)}% lexical overlap).`);
        break;
      }
    }

    // Body lexical & 3-shingle overlap
    const prevBodyTokens = filterNonTopic(extractContentTokens(prevFull));
    const prevBodySet = new Set(prevBodyTokens);
    const bodyJaccard = jaccardSets(candBodySet, prevBodySet);
    const prevShingles = buildWordShingles(extractContentTokens(prevFull), 3);
    const shingleOverlap = overlapCoefficient(candShingles, prevShingles);

    if (candBodySet.size >= 8 && (bodyJaccard >= 0.45 || (candShingles.size >= 6 && shingleOverlap >= 0.35))) {
      defects.push(
        `${label} recycles phrasing and core argument structure from Post ${i + 1} (lexical overlap ${Math.round(Math.max(bodyJaccard, shingleOverlap) * 100)}%).`
      );
      break;
    }

    // Closing sentence skeleton dedupe (allows same URL with different wording; rejects identical closing wording)
    const prevClosing = extractClosingSkeleton(prevParts);
    if (candClosing.length >= 22 && prevClosing.length >= 22) {
      const closingSim = jaccardSets(
        new Set(extractContentTokens(candClosing)),
        new Set(extractContentTokens(prevClosing))
      );
      if (candClosing === prevClosing || closingSim >= 0.72) {
        defects.push(`${label} repeats the closing sentence structure used in Post ${i + 1}.`);
        break;
      }
    }
  }

  // 2. Formulaic opener guard (allow at most 1 per batch if warranted; reject repeated formulaic openers)
  if (!options.lockedHook) {
    const formulaicLabel = detectFormulaicOpener(hook);
    if (formulaicLabel && formulaicCountInBatch >= 1) {
      defects.push(`${label} uses a recycled formulaic opener (${formulaicLabel}); use a direct, specific opening instead.`);
    }
  }

  // 3. Check against cross-run rolling ledger (recent library posts & previous batches)
  if (options.ledger && options.ledger.entries.length > 0 && defects.length === 0) {
    for (const prev of options.ledger.entries.slice(0, 20)) {
      if (!options.lockedHook) {
        if (candHookPrefix.length >= 16 && prev.hookPrefix && candHookPrefix === prev.hookPrefix) {
          defects.push(`${label} repeats a recently used opening phrase ("${candHookPrefix}") from your content history.`);
          break;
        }
        const prevHookSet = new Set(extractContentTokens(prev.hook));
        const hookSim = jaccardSets(candHookTokens, prevHookSet);
        if (candHookTokens.size >= 4 && hookSim >= 0.65) {
          defects.push(`${label} hook closely duplicates a recent post in your library ("${prev.hook.slice(0, 60)}").`);
          break;
        }
      }

      if (Array.isArray(prev.bodyTokens) && prev.bodyTokens.length >= 8 && candBodySet.size >= 8) {
        const prevFiltered = new Set(filterNonTopic(prev.bodyTokens));
        const bodySim = jaccardSets(candBodySet, prevFiltered);
        if (bodySim >= 0.55) {
          defects.push(`${label} closely repeats a recent post in your library ("${prev.title || prev.hook.slice(0, 50)}").`);
          break;
        }
      }
    }
  }

  return {
    passed: defects.length === 0,
    defects
  };
}
