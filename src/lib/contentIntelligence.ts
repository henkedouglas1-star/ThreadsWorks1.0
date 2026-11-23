import {
  CanonicalContentRecord,
  CanonicalStage,
  LIFECYCLE_STAGE_ORDER,
  formatLocalDateKey,
  parsePlannedDateKey,
} from "./canonicalContent";
import { UserProfile } from "../types";

export type LibrarySortOption =
  | "newest"
  | "oldest"
  | "updated"
  | "scheduled"
  | "stage"
  | "title";

export interface LibraryFilterOptions {
  searchQuery?: string;
  stage?: CanonicalStage | "all" | "unfinished";
  topic?: string;
  pillar?: string;
  sortBy?: LibrarySortOption;
  onlyDuplicates?: boolean;
}

export interface DuplicateGroup {
  groupId: string;
  similarity: number;
  reason: "exact" | "near_duplicate";
  recordIds: string[];
  primaryRecordId: string;
}

export interface RelatedContentMatch {
  record: CanonicalContentRecord;
  score: number;
  reason: string;
}

export interface WeekDaySlot {
  dateKey: string; // YYYY-MM-DD
  dateObj: Date;
  dayName: string; // e.g., "Monday"
  shortDay: string; // e.g., "Mon"
  dayNumber: number;
  monthShort: string;
  isToday: boolean;
  isPast: boolean;
  plannedPosts: CanonicalContentRecord[];
  scheduledPosts: CanonicalContentRecord[];
  publishedPosts: CanonicalContentRecord[];
  allItems: CanonicalContentRecord[];
  isOpen: boolean; // True when no planned or scheduled post is assigned
}

export interface SmartRecommendation {
  id: string;
  kind:
    | "ready_drafts"
    | "open_day"
    | "topic_overlap"
    | "saved_idea"
    | "unfinished_drafts"
    | "failed_recovery"
    | "duplicates"
    | "pillar_gap";
  priority: number;
  message: string;
  detail?: string;
  actionLabel?: string;
  actionType?:
    | "filter_ready"
    | "filter_drafts"
    | "filter_failed"
    | "filter_duplicates"
    | "open_weekly_day"
    | "develop_idea"
    | "create_for_pillar"
    | "filter_topic";
  targetDateKey?: string;
  targetRecordId?: string;
  targetTopic?: string;
  targetPillar?: string;
}

const STOPWORDS = new Set([
  "the", "and", "for", "that", "this", "with", "you", "your", "are", "was",
  "were", "have", "has", "had", "not", "but", "from", "they", "their", "what",
  "when", "where", "which", "who", "how", "why", "can", "will", "just", "more",
  "about", "into", "out", "over", "then", "than", "also", "all", "one", "our",
  "make", "like", "time", "get", "use", "way", "new", "want", "because", "any",
]);

export function tokenizeForSimilarity(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

export function normalizeTextFingerprint(text: string): string {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function computeTextSimilarity(textA: string, textB: string): number {
  const normA = normalizeTextFingerprint(textA);
  const normB = normalizeTextFingerprint(textB);
  if (!normA || !normB) return 0;
  if (normA === normB) return 1;

  const setA = new Set(tokenizeForSimilarity(normA));
  const setB = new Set(tokenizeForSimilarity(normB));
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

export function getRecordCombinedText(record: CanonicalContentRecord): string {
  const partsText = Array.isArray(record.threadParts) ? record.threadParts.join(" ") : "";
  return `${record.title || ""} ${record.hook || ""} ${partsText || record.singlePost || ""}`.trim();
}

/**
 * Deterministic duplicate detector: identifies exact and near-duplicate records
 * without deleting or hiding user data.
 */
export function detectDuplicateGroups(records: CanonicalContentRecord[]): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const visited = new Set<string>();

  for (let i = 0; i < records.length; i++) {
    const recA = records[i];
    if (visited.has(recA.id)) continue;
    const textA = (recA.singlePost || recA.title || "").trim();
    if (textA.length < 18) continue;

    const clusterIds = [recA.id];
    let maxSim = 0;
    let isExact = false;

    for (let j = i + 1; j < records.length; j++) {
      const recB = records[j];
      if (visited.has(recB.id)) continue;
      const textB = (recB.singlePost || recB.title || "").trim();
      if (textB.length < 18) continue;

      const sim = computeTextSimilarity(textA, textB);
      if (sim >= 0.78) {
        clusterIds.push(recB.id);
        visited.add(recB.id);
        if (sim > maxSim) maxSim = sim;
        if (sim >= 0.98) isExact = true;
      }
    }

    if (clusterIds.length > 1) {
      visited.add(recA.id);
      // Prefer keeping Published > Scheduled > Planned > Ready > Draft > Idea as primary
      const clusterRecords = clusterIds
        .map((id) => records.find((r) => r.id === id)!)
        .filter(Boolean)
        .sort((a, b) => {
          const rank = (stage: CanonicalStage) => {
            if (stage === "Published") return 6;
            if (stage === "Scheduled") return 5;
            if (stage === "Planned") return 4;
            if (stage === "Ready") return 3;
            if (stage === "Draft") return 2;
            if (stage === "Idea") return 1;
            return 0;
          };
          return rank(b.stage) - rank(a.stage);
        });

      groups.push({
        groupId: `dup-${clusterRecords[0].id}`,
        similarity: Number(maxSim.toFixed(2)),
        reason: isExact ? "exact" : "near_duplicate",
        recordIds: clusterRecords.map((r) => r.id),
        primaryRecordId: clusterRecords[0].id,
      });
    }
  }

  return groups;
}

/**
 * Finds related content items for a given record (shared idea lineage, pillar, topic, or lexical similarity).
 */
export function findRelatedContent(
  target: CanonicalContentRecord,
  allRecords: CanonicalContentRecord[],
  maxResults = 3
): RelatedContentMatch[] {
  const targetText = getRecordCombinedText(target);
  const targetTopics = new Set((target.topics || [target.topic]).map((t) => t.toLowerCase()));
  const matches: RelatedContentMatch[] = [];

  for (const candidate of allRecords) {
    if (candidate.id === target.id) continue;

    let score = 0;
    const reasons: string[] = [];

    if (
      (target.sourceIdeaId && (candidate.id === target.sourceIdeaId || candidate.sourceIdeaId === target.sourceIdeaId)) ||
      (candidate.sourceIdeaId && candidate.sourceIdeaId === target.id)
    ) {
      score += 0.65;
      reasons.push("Same source idea");
    }

    if (
      target.pillarTitle &&
      candidate.pillarTitle &&
      target.pillarTitle.toLowerCase() === candidate.pillarTitle.toLowerCase()
    ) {
      score += 0.25;
      reasons.push(`Pillar: ${target.pillarTitle}`);
    }

    const sharedTopics = (candidate.topics || [candidate.topic]).filter((t) =>
      targetTopics.has(t.toLowerCase()) && t.toLowerCase() !== "general"
    );
    if (sharedTopics.length > 0) {
      score += 0.3;
      reasons.push(`Topic: ${sharedTopics[0]}`);
    }

    const lexical = computeTextSimilarity(targetText, getRecordCombinedText(candidate));
    if (lexical >= 0.24 && lexical < 0.98) {
      score += lexical * 0.5;
      if (reasons.length === 0) reasons.push("Similar theme");
    }

    if (score >= 0.28) {
      matches.push({
        record: candidate,
        score: Number(score.toFixed(2)),
        reason: reasons[0] || "Related content",
      });
    }
  }

  return matches.sort((a, b) => b.score - a.score).slice(0, maxResults);
}

/**
 * Extracts all distinct topics and pillars present in records + creator profile.
 */
export function extractAvailableFacets(
  records: CanonicalContentRecord[],
  profile?: UserProfile | null
): { topics: string[]; pillars: string[] } {
  const topicCounts = new Map<string, { label: string; count: number }>();
  const pillarMap = new Map<string, string>();

  if (Array.isArray(profile?.contentPillars)) {
    for (const p of profile.contentPillars) {
      if (p?.title?.trim()) {
        pillarMap.set(p.title.trim().toLowerCase(), p.title.trim());
      }
    }
  }

  for (const r of records) {
    if (r.pillarTitle?.trim()) {
      const key = r.pillarTitle.trim().toLowerCase();
      if (!pillarMap.has(key)) pillarMap.set(key, r.pillarTitle.trim());
    }
    const rTopics = Array.isArray(r.topics) && r.topics.length > 0 ? r.topics : [r.topic];
    for (const t of rTopics) {
      const clean = (t || "").trim();
      if (!clean) continue;
      const key = clean.toLowerCase();
      const existing = topicCounts.get(key);
      if (existing) {
        existing.count++;
      } else {
        topicCounts.set(key, { label: clean, count: 1 });
      }
    }
  }

  const topics = Array.from(topicCounts.values())
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .map((t) => t.label);

  const pillars = Array.from(pillarMap.values()).sort((a, b) => a.localeCompare(b));

  return { topics, pillars };
}

/**
 * Filters and sorts content records for the Content Library.
 */
export function filterAndSortLibraryRecords(
  records: CanonicalContentRecord[],
  options: LibraryFilterOptions,
  duplicateGroups?: DuplicateGroup[]
): CanonicalContentRecord[] {
  const q = (options.searchQuery || "").trim().toLowerCase();
  const stageFilter = options.stage || "all";
  const topicFilter = (options.topic || "all").trim().toLowerCase();
  const pillarFilter = (options.pillar || "all").trim().toLowerCase();
  const sortBy = options.sortBy || "newest";

  const duplicateIdSet = new Set<string>();
  if (options.onlyDuplicates) {
    const groups = duplicateGroups || detectDuplicateGroups(records);
    groups.forEach((g) => g.recordIds.forEach((id) => duplicateIdSet.add(id)));
  }

  const filtered = records.filter((rec) => {
    if (options.onlyDuplicates && !duplicateIdSet.has(rec.id)) {
      return false;
    }

    if (stageFilter === "unfinished") {
      if (rec.stage !== "Idea" && rec.stage !== "Draft") return false;
    } else if (stageFilter !== "all") {
      if (rec.stage !== stageFilter) return false;
    }

    if (topicFilter !== "all" && topicFilter !== "") {
      const recTopics = (rec.topics && rec.topics.length > 0 ? rec.topics : [rec.topic]).map((t) =>
        t.toLowerCase()
      );
      if (!recTopics.includes(topicFilter)) return false;
    }

    if (pillarFilter !== "all" && pillarFilter !== "") {
      if (pillarFilter === "__unassigned__") {
        if (rec.pillarTitle && rec.pillarTitle.trim()) return false;
      } else if ((rec.pillarTitle || "").trim().toLowerCase() !== pillarFilter) {
        return false;
      }
    }

    if (q) {
      const haystack = [
        rec.title,
        rec.hook,
        rec.singlePost,
        ...(rec.threadParts || []),
        rec.topic,
        ...(rec.topics || []),
        rec.pillarTitle || "",
        rec.notes || "",
        rec.angle || "",
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    return true;
  });

  const getTime = (val?: string | null) => {
    if (!val) return 0;
    const t = new Date(val).getTime();
    return isNaN(t) ? 0 : t;
  };

  return [...filtered].sort((a, b) => {
    switch (sortBy) {
      case "oldest":
        return getTime(a.createdAt) - getTime(b.createdAt);
      case "updated":
        return getTime(b.updatedAt) - getTime(a.updatedAt);
      case "scheduled": {
        const aDate = a.scheduledFor || (a.plannedDate ? `${a.plannedDate}T09:00:00` : null);
        const bDate = b.scheduledFor || (b.plannedDate ? `${b.plannedDate}T09:00:00` : null);
        if (!aDate && !bDate) return getTime(b.createdAt) - getTime(a.createdAt);
        if (!aDate) return 1;
        if (!bDate) return -1;
        return getTime(aDate) - getTime(bDate);
      }
      case "stage":
        return (LIFECYCLE_STAGE_ORDER[a.stage] ?? 99) - (LIFECYCLE_STAGE_ORDER[b.stage] ?? 99);
      case "title":
        return (a.title || "").localeCompare(b.title || "");
      case "newest":
      default:
        return getTime(b.createdAt) - getTime(a.createdAt);
    }
  });
}

/**
 * Computes the Monday start date of the week containing `referenceDate`, shifted by `weekOffset` weeks.
 */
export function getWeekStartDate(referenceDate: Date = new Date(), weekOffset = 0): Date {
  const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday + weekOffset * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Builds a 7-day weekly planning grid and maps Scheduled, Planned, and Published records onto their days.
 */
export function buildWeeklyPlanSlots(
  records: CanonicalContentRecord[],
  weekOffset = 0,
  referenceDate: Date = new Date()
): WeekDaySlot[] {
  const start = getWeekStartDate(referenceDate, weekOffset);
  const todayStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const todayKey = formatLocalDateKey(todayStart);

  const slots: WeekDaySlot[] = [];
  const slotByKey = new Map<string, WeekDaySlot>();

  for (let i = 0; i < 7; i++) {
    const dateObj = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const dateKey = formatLocalDateKey(dateObj);
    const slot: WeekDaySlot = {
      dateKey,
      dateObj,
      dayName: dateObj.toLocaleDateString("en-US", { weekday: "long" }),
      shortDay: dateObj.toLocaleDateString("en-US", { weekday: "short" }),
      dayNumber: dateObj.getDate(),
      monthShort: dateObj.toLocaleDateString("en-US", { month: "short" }),
      isToday: dateKey === todayKey,
      isPast: dateObj.getTime() < todayStart.getTime(),
      plannedPosts: [],
      scheduledPosts: [],
      publishedPosts: [],
      allItems: [],
      isOpen: true,
    };
    slots.push(slot);
    slotByKey.set(dateKey, slot);
  }

  for (const rec of records) {
    if (rec.stage === "Scheduled" && rec.scheduledFor) {
      const dt = new Date(rec.scheduledFor);
      if (!isNaN(dt.getTime())) {
        const key = formatLocalDateKey(dt);
        const slot = slotByKey.get(key);
        if (slot) {
          slot.scheduledPosts.push(rec);
        }
      }
    } else if (rec.stage === "Planned" && rec.plannedDate) {
      const key = parsePlannedDateKey(rec.plannedDate);
      if (key) {
        const slot = slotByKey.get(key);
        if (slot) {
          slot.plannedPosts.push(rec);
        }
      }
    } else if (rec.stage === "Published" && rec.publishedAt) {
      const dt = new Date(rec.publishedAt);
      if (!isNaN(dt.getTime())) {
        const key = formatLocalDateKey(dt);
        const slot = slotByKey.get(key);
        if (slot) {
          slot.publishedPosts.push(rec);
        }
      }
    }
  }

  for (const slot of slots) {
    slot.scheduledPosts.sort(
      (a, b) => new Date(a.scheduledFor || 0).getTime() - new Date(b.scheduledFor || 0).getTime()
    );
    slot.allItems = [...slot.scheduledPosts, ...slot.plannedPosts, ...slot.publishedPosts];
    slot.isOpen = slot.scheduledPosts.length === 0 && slot.plannedPosts.length === 0 && slot.publishedPosts.length === 0;
  }

  return slots;
}

/**
 * Generates grounded, deterministic recommendations directly from real user data.
 * Never invents analytics, performance predictions, or missing history.
 */
export function buildGroundedRecommendations(
  records: CanonicalContentRecord[],
  profile?: UserProfile | null,
  referenceDate: Date = new Date()
): SmartRecommendation[] {
  const recs: SmartRecommendation[] = [];
  const weekSlots = buildWeeklyPlanSlots(records, 0, referenceDate);

  const readyDrafts = records.filter((r) => r.stage === "Ready");
  const drafts = records.filter((r) => r.stage === "Draft");
  const ideas = records.filter((r) => r.stage === "Idea");
  const failed = records.filter((r) => r.stage === "Failed");
  const openUpcomingDays = weekSlots.filter((s) => s.isOpen && !s.isPast);

  // 1. Recoverable failed posts
  if (failed.length > 0) {
    recs.push({
      id: "rec-failed-recovery",
      kind: "failed_recovery",
      priority: 1,
      message: `${failed.length} failed ${failed.length === 1 ? "post needs" : "posts need"} attention and can be recovered.`,
      detail: "Move back to Ready or reschedule to publish cleanly.",
      actionLabel: "Review Failed",
      actionType: "filter_failed",
    });
  }

  // 2. Ready drafts available for this week
  if (readyDrafts.length > 0) {
    recs.push({
      id: "rec-ready-drafts",
      kind: "ready_drafts",
      priority: 2,
      message: `You have ${readyDrafts.length} completed ${readyDrafts.length === 1 ? "draft" : "drafts"} ready for this week.`,
      detail:
        openUpcomingDays.length > 0
          ? `${openUpcomingDays.length} open ${openUpcomingDays.length === 1 ? "day remains" : "days remain"} in your 7-day plan.`
          : "All upcoming days this week are covered — you can schedule or plan into next week.",
      actionLabel: "View Ready",
      actionType: "filter_ready",
    });
  }

  // 3. First open day in this week
  if (openUpcomingDays.length > 0) {
    const nextOpen = openUpcomingDays[0];
    recs.push({
      id: `rec-open-day-${nextOpen.dateKey}`,
      kind: "open_day",
      priority: 3,
      message: `${nextOpen.dayName} has no planned content.`,
      detail:
        openUpcomingDays.length > 1
          ? `${openUpcomingDays.length} open days left this week (${openUpcomingDays.map((d) => d.shortDay).join(", ")}).`
          : `Assign an existing draft or generate a post for ${nextOpen.dayName}.`,
      actionLabel: `Plan ${nextOpen.shortDay}`,
      actionType: "open_weekly_day",
      targetDateKey: nextOpen.dateKey,
    });
  }

  // 4. Saved idea ready to become a post
  const unexpandedIdeas = ideas.filter(
    (idea) => !records.some((r) => r.sourceIdeaId === idea.id && r.id !== idea.id)
  );
  if (unexpandedIdeas.length > 0) {
    const topIdea = unexpandedIdeas[0];
    recs.push({
      id: `rec-saved-idea-${topIdea.id}`,
      kind: "saved_idea",
      priority: 4,
      message: `Saved idea "${topIdea.title.slice(0, 48)}${topIdea.title.length > 48 ? "..." : ""}" is ready to develop into a post.`,
      detail: topIdea.pillarTitle ? `Aligned with your ${topIdea.pillarTitle} pillar.` : "Turn it into a full post in the Content Engine.",
      actionLabel: "Create Post",
      actionType: "develop_idea",
      targetRecordId: topIdea.id,
    });
  }

  // 5. Topic concentration (2+ posts covering same topic)
  const topicCounts = new Map<string, { label: string; count: number }>();
  for (const r of records) {
    if (r.stage === "Published") continue;
    const t = (r.topics?.[0] || r.topic || "").trim();
    if (!t || t.toLowerCase() === "general") continue;
    const key = t.toLowerCase();
    const cur = topicCounts.get(key);
    if (cur) cur.count++;
    else topicCounts.set(key, { label: t, count: 1 });
  }
  const topRepeatedTopic = Array.from(topicCounts.values())
    .filter((entry) => entry.count >= 2)
    .sort((a, b) => b.count - a.count)[0];
  if (topRepeatedTopic) {
    recs.push({
      id: `rec-topic-overlap-${topRepeatedTopic.label}`,
      kind: "topic_overlap",
      priority: 5,
      message: `You already have ${topRepeatedTopic.count} posts covering "${topRepeatedTopic.label}".`,
      detail: "Consider spacing these across different days or rotating to another pillar.",
      actionLabel: "Filter Topic",
      actionType: "filter_topic",
      targetTopic: topRepeatedTopic.label,
    });
  }

  // 6. Pillar coverage gap this week
  const configuredPillars = (profile?.contentPillars || []).filter((p) => p?.title?.trim());
  if (configuredPillars.length > 0) {
    const weekPillars = new Set(
      weekSlots
        .flatMap((s) => s.allItems)
        .map((r) => (r.pillarTitle || "").toLowerCase().trim())
        .filter(Boolean)
    );
    const missingPillar = configuredPillars.find(
      (p) => !weekPillars.has(p.title.trim().toLowerCase())
    );
    if (missingPillar) {
      recs.push({
        id: `rec-pillar-gap-${missingPillar.title}`,
        kind: "pillar_gap",
        priority: 6,
        message: `Your "${missingPillar.title}" pillar has no content planned this week.`,
        detail: "Adding a post from this pillar keeps your weekly mix balanced.",
        actionLabel: "Draft for Pillar",
        actionType: "create_for_pillar",
        targetPillar: missingPillar.title,
      });
    }
  }

  // 7. Unfinished drafts reminder
  if (drafts.length > 0 && readyDrafts.length === 0) {
    recs.push({
      id: "rec-unfinished-drafts",
      kind: "unfinished_drafts",
      priority: 7,
      message: `You have ${drafts.length} unfinished ${drafts.length === 1 ? "draft" : "drafts"} waiting for review.`,
      detail: "Review and mark your strongest drafts as Ready to plan this week.",
      actionLabel: "Review Drafts",
      actionType: "filter_drafts",
    });
  }

  // 8. Duplicate detection alert
  const duplicates = detectDuplicateGroups(records);
  if (duplicates.length > 0) {
    recs.push({
      id: "rec-duplicates",
      kind: "duplicates",
      priority: 8,
      message: `${duplicates.length} potential duplicate ${duplicates.length === 1 ? "group" : "groups"} detected in your library.`,
      detail: "Review similar posts so you don't schedule the same content twice.",
      actionLabel: "Review Duplicates",
      actionType: "filter_duplicates",
    });
  }

  return recs.sort((a, b) => a.priority - b.priority).slice(0, 5);
}

/**
 * Deterministic fallback weekly plan suggestions (when AI is unavailable or offline).
 * Strictly obeys all AI Planning Rules:
 * - Never overwrites filled days
 * - Prefers reusing existing Ready/Draft posts, then saved Ideas
 * - Never invents engagement metrics
 */
export interface WeeklyPlanRecommendationItem {
  dateKey: string;
  dayName: string;
  actionType: "assign_existing_draft" | "develop_saved_idea" | "generate_new";
  existingRecordId?: string;
  title: string;
  topic: string;
  pillarTitle?: string;
  angle: string;
  rationale: string;
  source: "ai" | "deterministic";
}

export function buildDeterministicWeeklyPlanFallback(
  records: CanonicalContentRecord[],
  weekSlots: WeekDaySlot[],
  profile?: UserProfile | null,
  requestedTopic?: string
): WeeklyPlanRecommendationItem[] {
  const openDays = weekSlots.filter((s) => s.isOpen && !s.isPast);
  if (openDays.length === 0) return [];

  const assignedIds = new Set(weekSlots.flatMap((s) => s.allItems.map((i) => i.id)));
  const readyAndDrafts = records
    .filter((r) => (r.stage === "Ready" || r.stage === "Draft") && !assignedIds.has(r.id))
    .sort((a, b) => (a.stage === "Ready" ? -1 : 1) - (b.stage === "Ready" ? -1 : 1));

  const savedIdeas = records.filter((r) => r.stage === "Idea" && !assignedIds.has(r.id));
  const configuredPillars = (profile?.contentPillars || []).filter((p) => p?.title?.trim());
  const angles = [
    "Educational Breakdown",
    "Practical Framework",
    "Contrarian Insight",
    "Behind-the-Scenes Story",
    "Actionable Checklist",
    "Common Misconception",
    "Direct Conversation Starter",
  ];

  const usedDraftIds = new Set<string>();
  const usedIdeaIds = new Set<string>();
  const suggestions: WeeklyPlanRecommendationItem[] = [];

  openDays.forEach((slot, idx) => {
    const cleanReqTopic = (requestedTopic || "").trim();

    // 1. Prefer matching existing Ready/Draft post first
    const candidateDraft = readyAndDrafts.find((d) => {
      if (usedDraftIds.has(d.id)) return false;
      if (!cleanReqTopic) return true;
      return getRecordCombinedText(d).toLowerCase().includes(cleanReqTopic.toLowerCase());
    }) || (!cleanReqTopic ? readyAndDrafts.find((d) => !usedDraftIds.has(d.id)) : undefined);

    if (candidateDraft) {
      usedDraftIds.add(candidateDraft.id);
      suggestions.push({
        dateKey: slot.dateKey,
        dayName: slot.dayName,
        actionType: "assign_existing_draft",
        existingRecordId: candidateDraft.id,
        title: candidateDraft.title,
        topic: candidateDraft.topic || "General",
        pillarTitle: candidateDraft.pillarTitle,
        angle: candidateDraft.angle || angles[idx % angles.length],
        rationale:
          candidateDraft.stage === "Ready"
            ? "Reuses your completed Ready draft to fill this open day."
            : "Promotes an existing draft so you publish work you already started.",
        source: "deterministic",
      });
      return;
    }

    // 2. Next prefer saved Ideas
    const candidateIdea = savedIdeas.find((idea) => !usedIdeaIds.has(idea.id));
    if (candidateIdea) {
      usedIdeaIds.add(candidateIdea.id);
      suggestions.push({
        dateKey: slot.dateKey,
        dayName: slot.dayName,
        actionType: "develop_saved_idea",
        existingRecordId: candidateIdea.id,
        title: candidateIdea.title,
        topic: cleanReqTopic || candidateIdea.topic || candidateIdea.title,
        pillarTitle: candidateIdea.pillarTitle || configuredPillars[idx % Math.max(configuredPillars.length, 1)]?.title,
        angle: angles[idx % angles.length],
        rationale: "Develops a saved idea from your library into a structured Threads post.",
        source: "deterministic",
      });
      return;
    }

    // 3. Otherwise suggest generating a fresh post aligned with pillars / requested topic
    const pillar = configuredPillars.length > 0 ? configuredPillars[idx % configuredPillars.length] : undefined;
    const topicLabel = cleanReqTopic || pillar?.title || profile?.offer || "Creator Strategy";
    suggestions.push({
      dateKey: slot.dateKey,
      dayName: slot.dayName,
      actionType: "generate_new",
      title: `${angles[idx % angles.length]}: ${topicLabel}`,
      topic: topicLabel,
      pillarTitle: pillar?.title,
      angle: angles[idx % angles.length],
      rationale: cleanReqTopic
        ? `Covers your requested focus topic ("${cleanReqTopic}") with a distinct angle.`
        : pillar
        ? `Keeps your "${pillar.title}" content pillar active on an open day.`
        : "Fills an open day with a fresh content angle.",
      source: "deterministic",
    });
  });

  return suggestions;
}
