import { auth, db, sanitizeForFirestore, withTimeout } from "../firebase";
import {
  collection,
  query,
  where,
  limit,
  getDocs,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
} from "firebase/firestore";
import { UserProfile } from "../types";

export type CanonicalStage =
  | "Idea"
  | "Draft"
  | "Ready"
  | "Planned"
  | "Scheduled"
  | "Published"
  | "Failed";

export const LIFECYCLE_STAGE_ORDER: Record<CanonicalStage, number> = {
  Idea: 0,
  Draft: 1,
  Ready: 2,
  Planned: 3,
  Scheduled: 4,
  Published: 5,
  Failed: 6,
};

export interface CanonicalProfileContext {
  voice?: string;
  business?: string;
  instructions?: string;
  cta?: string;
  snapshotDate?: string;
}

export interface CanonicalPerformance {
  views?: number;
  likes?: number;
  replies?: number;
  reposts?: number;
  quotes?: number;
  engagementRate?: number;
  performanceRatio?: number;
  analyzedAt?: string | null;
  learnedAt?: string | null;
}

export interface CanonicalContentRecord {
  id: string;
  userId: string;
  title: string;
  singlePost: string;
  threadParts: string[];
  hook: string;
  stage: CanonicalStage;
  status: CanonicalStage;
  plannedDate?: string | null; // YYYY-MM-DD local date key for 7-day planning
  scheduledFor?: string | null; // ISO string in memory/localStorage; Firestore stores Timestamp when Scheduled
  scheduledAt?: string | null;
  publishedAt?: string | null;
  threadsMediaId?: string | null;
  threadsPermalink?: string | null;
  topic: string;
  topics: string[];
  pillarTitle?: string;
  sourceIdeaId?: string | null;
  relatedIdeaIds?: string[];
  notes?: string;
  angle?: string;
  cta?: string;
  format?: "single" | "thread" | "post";
  category?: string;
  sourceApp?: string;
  errorMessage?: string;
  isIdea?: boolean;
  isPublished?: boolean;
  profileContext?: CanonicalProfileContext;
  performance?: CanonicalPerformance;
  createdAt: string;
  updatedAt: string;
}

export const CONTENT_UPDATED_EVENT = "threadsworks-content-updated";

export function getLibraryStorageKey(userId: string): string {
  return `threads_saved_offline_library_${userId || "anonymous"}`;
}

export function isLocalOnlyId(id?: string | null): boolean {
  if (!id) return true;
  return (
    id.startsWith("local-") ||
    id.startsWith("local_") ||
    id.startsWith("sim-") ||
    id.startsWith("temp-") ||
    id.startsWith("post-") ||
    id.startsWith("gen-") ||
    id.startsWith("scheduled-")
  );
}

export function toIsoStringSafe(value: any): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value.toDate === "function") {
    const d = value.toDate();
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (typeof value.seconds === "number") {
    const d = new Date(value.seconds * 1000);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

export function formatLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parsePlannedDateKey(plannedDate?: string | null): string | null {
  if (!plannedDate || typeof plannedDate !== "string") return null;
  const trimmed = plannedDate.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? null : formatLocalDateKey(d);
}

export function normalizeTopicsList(topic?: string, topics?: string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  const add = (val?: string) => {
    if (!val || typeof val !== "string") return;
    const clean = val.trim();
    if (!clean) return;
    const lower = clean.toLowerCase();
    // Skip generic boilerplate labels
    if (
      lower === "threadsworks dna content" ||
      lower === "threadsworks dna content: scheduled" ||
      lower === "threadsworks content: scheduled" ||
      lower === "threadsworks content"
    ) {
      return;
    }
    if (!seen.has(lower)) {
      seen.add(lower);
      result.push(clean);
    }
  };
  if (Array.isArray(topics)) {
    topics.forEach(add);
  }
  if (topic) {
    topic.split(/[,|]/).forEach(add);
  }
  return result.slice(0, 6);
}

/**
 * Resolves authoritative lifecycle stage while preserving compatibility
 * with existing Meta Threads publishing/scheduling statuses.
 */
export function resolveCanonicalStage(raw: any): CanonicalStage {
  const rawStatus = String(raw?.status || raw?.stage || "").trim().toLowerCase();

  // Published is authoritative and immutable for planning transitions
  if (rawStatus === "published" || raw?.isPublished === true || Boolean(raw?.publishedAt && rawStatus !== "failed")) {
    return "Published";
  }
  if (rawStatus === "failed" || rawStatus === "missed" || rawStatus === "error") {
    return "Failed";
  }
  if (rawStatus === "scheduled" || (Boolean(raw?.scheduledFor) && rawStatus !== "draft" && rawStatus !== "ready" && rawStatus !== "planned" && rawStatus !== "idea")) {
    return "Scheduled";
  }
  if (rawStatus === "planned" || Boolean(parsePlannedDateKey(raw?.plannedDate))) {
    return "Planned";
  }
  if (rawStatus === "ready") {
    return "Ready";
  }
  if (rawStatus === "idea" || raw?.isIdea === true) {
    return "Idea";
  }
  return "Draft";
}

/**
 * Normalizes any legacy Firestore or localStorage record into a strict CanonicalContentRecord.
 */
export function normalizeCanonicalRecord(raw: any, userId: string): CanonicalContentRecord {
  const stage = resolveCanonicalStage(raw);
  const singlePost = String(raw?.singlePost || raw?.content || raw?.text || raw?.postText || "").replace(/\\n/g, "\n");
  const rawParts =
    Array.isArray(raw?.threadParts) && raw.threadParts.length > 0
      ? raw.threadParts
      : Array.isArray(raw?.threadPosts) && raw.threadPosts.length > 0
      ? raw.threadPosts
      : [singlePost];
  const threadParts = rawParts
    .map((p: any) => (typeof p === "string" ? p.replace(/\\n/g, "\n") : ""))
    .filter((p: string, idx: number, arr: string[]) => p.length > 0 || arr.length === 1);

  const primaryBody = threadParts[0] || singlePost;
  const hook =
    (typeof raw?.hook === "string" && raw.hook.trim()) ||
    (primaryBody ? primaryBody.split("\n")[0].slice(0, 120) : "");
  const title =
    (typeof raw?.title === "string" && raw.title.trim()) ||
    (typeof raw?.concept === "string" && raw.concept.trim()) ||
    (hook ? hook.slice(0, 64) : stage === "Idea" ? "Untitled Idea" : "Untitled Draft");

  const scheduledForIso = toIsoStringSafe(raw?.scheduledFor);
  const scheduledAtIso = toIsoStringSafe(raw?.scheduledAt);
  const publishedAtIso = toIsoStringSafe(raw?.publishedAt);
  const createdAtIso = toIsoStringSafe(raw?.createdAt) || new Date().toISOString();
  const updatedAtIso = toIsoStringSafe(raw?.updatedAt) || createdAtIso;
  const plannedDate = parsePlannedDateKey(raw?.plannedDate);

  const normalizedTopics = normalizeTopicsList(raw?.topic, raw?.topics);
  const primaryTopic =
    normalizedTopics[0] ||
    (typeof raw?.topic === "string" && raw.topic.trim() ? raw.topic.trim() : "General");

  const pillarTitle =
    (typeof raw?.pillarTitle === "string" && raw.pillarTitle.trim()) ||
    (typeof raw?.decision?.pillarTitle === "string" && raw.decision.pillarTitle.trim()) ||
    (typeof raw?.pillar === "string" &&
    !["attention", "trust", "sales", ""].includes(raw.pillar.trim().toLowerCase())
      ? raw.pillar.trim()
      : undefined);

  const relatedIdeaIds: string[] = Array.isArray(raw?.relatedIdeaIds)
    ? Array.from(
        new Set(
          raw.relatedIdeaIds.filter((id: unknown): id is string => typeof id === "string" && Boolean(id.trim()))
        )
      )
    : [];
  const sourceIdeaId = typeof raw?.sourceIdeaId === "string" && raw.sourceIdeaId.trim() ? raw.sourceIdeaId.trim() : null;
  if (sourceIdeaId && !relatedIdeaIds.includes(sourceIdeaId)) {
    relatedIdeaIds.unshift(sourceIdeaId);
  }

  return {
    id: String(raw?.id || `local-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`),
    userId: String(raw?.userId || userId),
    title,
    singlePost: primaryBody,
    threadParts: threadParts.length > 0 ? threadParts : [primaryBody],
    hook,
    stage,
    status: stage,
    plannedDate: stage === "Planned" || plannedDate ? plannedDate : null,
    scheduledFor: stage === "Scheduled" ? scheduledForIso : null,
    scheduledAt: scheduledAtIso,
    publishedAt: publishedAtIso || (stage === "Published" ? updatedAtIso : null),
    threadsMediaId: raw?.threadsMediaId || raw?.publishedPostId || raw?.threadsPostId || null,
    threadsPermalink: raw?.threadsPermalink || raw?.permalink || null,
    topic: primaryTopic,
    topics: normalizedTopics.length > 0 ? normalizedTopics : [primaryTopic],
    pillarTitle,
    sourceIdeaId,
    relatedIdeaIds,
    notes: typeof raw?.notes === "string" ? raw.notes : "",
    angle: raw?.angle || raw?.decision?.strategicAngle || "",
    cta: raw?.cta || raw?.decision?.cta || "",
    format: (() => {
      let f = raw?.format || (threadParts.length > 1 ? "thread" : "post");
      if (f === "single") f = "post";
      if (f === "thread" && threadParts.length <= 1) f = "post";
      return f;
    })(),
    category: raw?.category || (["attention", "trust", "sales"].includes(String(raw?.pillar || "").toLowerCase()) ? String(raw.pillar).toLowerCase() : undefined),
    sourceApp: raw?.sourceApp || "manual",
    errorMessage: raw?.errorMessage || raw?.error || "",
    isIdea: stage === "Idea",
    isPublished: stage === "Published",
    profileContext: raw?.profileContext || {
      voice: raw?.voice || "",
      business: raw?.business || "",
      instructions: raw?.instructions || "",
      cta: raw?.cta || "",
      snapshotDate: createdAtIso,
    },
    performance: raw?.performance || {
      views: raw?.views || 0,
      likes: raw?.likes || 0,
      replies: raw?.replies || 0,
      reposts: raw?.reposts || 0,
      quotes: raw?.quotes || 0,
      engagementRate: raw?.engagementRate || 0,
      performanceRatio: raw?.performanceRatio || 1.0,
      analyzedAt: raw?.analyzedAt || null,
      learnedAt: raw?.learnedAt || null,
    },
    createdAt: createdAtIso,
    updatedAt: updatedAtIso,
  };
}

export function emitContentUpdatedEvent(detail?: { userId?: string; recordId?: string; action?: string }) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CONTENT_UPDATED_EVENT, { detail }));
  }
}

export function readLocalCanonicalRecords(userId: string): CanonicalContentRecord[] {
  if (typeof window === "undefined" || !userId) return [];
  try {
    const key = getLibraryStorageKey(userId);
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const map = new Map<string, CanonicalContentRecord>();
    for (const item of parsed) {
      if (!item) continue;
      // Enforce strict user isolation even in localStorage
      if (item.userId && item.userId !== userId && userId !== "anonymous") continue;
      const norm = normalizeCanonicalRecord(item, userId);
      map.set(norm.id, norm);
    }
    return Array.from(map.values());
  } catch (err) {
    console.warn("[CanonicalContent] Failed reading local records:", err);
    return [];
  }
}

export function writeLocalCanonicalRecords(userId: string, records: CanonicalContentRecord[]): void {
  if (typeof window === "undefined" || !userId) return;
  try {
    const key = getLibraryStorageKey(userId);
    localStorage.setItem(key, JSON.stringify(records));
  } catch (err) {
    console.warn("[CanonicalContent] Failed writing local records:", err);
  }
}

export function upsertLocalCanonicalRecord(
  userId: string,
  record: CanonicalContentRecord,
  replaceOldId?: string
): CanonicalContentRecord[] {
  const existing = readLocalCanonicalRecords(userId);
  const filtered = existing.filter((item) => {
    if (item.id === record.id) return false;
    if (replaceOldId && item.id === replaceOldId) return false;
    return true;
  });
  const next = [record, ...filtered];
  writeLocalCanonicalRecords(userId, next);
  return next;
}

export function removeLocalCanonicalRecord(userId: string, recordId: string): CanonicalContentRecord[] {
  const existing = readLocalCanonicalRecords(userId);
  const next = existing.filter((item) => item.id !== recordId);
  writeLocalCanonicalRecords(userId, next);
  return next;
}

/**
 * Pure merge helper: combines cloud Firestore records with local offline records
 * strictly isolated to userId, without creating duplicates when IDs match.
 */
export function mergeCanonicalRecords(
  cloudRecords: CanonicalContentRecord[],
  localRecords: CanonicalContentRecord[],
  userId: string
): CanonicalContentRecord[] {
  const merged = new Map<string, CanonicalContentRecord>();

  // Cloud is authoritative when an ID exists in both cloud and local
  for (const rec of cloudRecords) {
    if (rec.userId && rec.userId !== userId && userId !== "anonymous") continue;
    merged.set(rec.id, rec);
  }

  // Include local-only or pending records without duplicating existing IDs
  for (const rec of localRecords) {
    if (rec.userId && rec.userId !== userId && userId !== "anonymous") continue;
    if (!merged.has(rec.id)) {
      merged.set(rec.id, rec);
    }
  }

  return Array.from(merged.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Builds the Firestore-safe payload for a CanonicalContentRecord.
 * Guarantees scheduledFor is either null or a future Firestore Timestamp (required by firestore.rules).
 */
function buildFirestorePayload(record: CanonicalContentRecord): Record<string, any> {
  let firestoreScheduledFor: Timestamp | null = null;
  if (record.stage === "Scheduled" && record.scheduledFor) {
    const dt = new Date(record.scheduledFor);
    if (!isNaN(dt.getTime()) && dt.getTime() > Date.now()) {
      firestoreScheduledFor = Timestamp.fromDate(dt);
    }
  }

  return sanitizeForFirestore({
    userId: record.userId,
    title: record.title,
    singlePost: record.singlePost,
    threadParts: record.threadParts,
    hook: record.hook,
    status: record.stage,
    stage: record.stage,
    plannedDate: record.plannedDate || null,
    isIdea: record.stage === "Idea",
    isPublished: record.stage === "Published",
    scheduledFor: firestoreScheduledFor,
    scheduledAt: record.stage === "Scheduled" ? (record.scheduledAt || new Date().toISOString()) : null,
    publishedAt: record.publishedAt || null,
    threadsMediaId: record.threadsMediaId || null,
    threadsPermalink: record.threadsPermalink || null,
    topic: record.topic,
    topics: record.topics,
    pillarTitle: record.pillarTitle || null,
    sourceIdeaId: record.sourceIdeaId || null,
    relatedIdeaIds: record.relatedIdeaIds || [],
    notes: record.notes || "",
    angle: record.angle || "",
    cta: record.cta || "",
    format: record.format || "post",
    category: record.category || null,
    sourceApp: record.sourceApp || "manual",
    errorMessage: record.errorMessage || "",
    profileContext: record.profileContext || null,
    performance: record.performance || null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

// In-memory cache to prevent redundant Firestore reads across rapid mounts
const canonicalRecordsCache = new Map<string, { data: CanonicalContentRecord[]; expiresAt: number }>();
const inFlightCanonicalRequests = new Map<string, Promise<CanonicalContentRecord[]>>();
const CANONICAL_CACHE_TTL_MS = 45 * 1000;

export function invalidateCanonicalCache(userId?: string) {
  if (userId) {
    canonicalRecordsCache.delete(userId);
  } else {
    canonicalRecordsCache.clear();
  }
}

/**
 * Creates or updates a unified content record in-place without duplicating records.
 * Protects Published records from accidental stage downgrades.
 */
export async function saveCanonicalRecord(
  payload: Partial<CanonicalContentRecord> & { singlePost?: string },
  profile?: UserProfile | null
): Promise<CanonicalContentRecord> {
  const activeUid = auth.currentUser?.uid || profile?.uid || payload.userId || "anonymous";
  const now = new Date().toISOString();

  // Check if updating an existing local record to preserve immutable fields (like Published status & createdAt)
  const existingLocal = readLocalCanonicalRecords(activeUid).find((r) => payload.id && r.id === payload.id);

  // Guard: never downgrade an already Published post via generic save
  let requestedStage: CanonicalStage =
    payload.stage ||
    (payload.status as CanonicalStage) ||
    existingLocal?.stage ||
    (payload.scheduledFor ? "Scheduled" : payload.plannedDate ? "Planned" : payload.publishedAt ? "Published" : "Draft");

  if (existingLocal?.stage === "Published" && requestedStage !== "Published") {
    requestedStage = "Published";
  }

  const currentProfileSnapshot: CanonicalProfileContext = {
    voice: profile?.writingStyle || profile?.creatorIdentity?.writingStyle || profile?.rawVoice || "",
    business: profile?.offer || profile?.rawBusinessText || "",
    instructions: profile?.customInstruction || "",
    cta: profile?.ctaPreferences || "",
    snapshotDate: now,
  };

  const singlePost = payload.singlePost !== undefined ? payload.singlePost : (existingLocal?.singlePost || "");
  const threadParts =
    payload.threadParts && payload.threadParts.length > 0
      ? payload.threadParts
      : existingLocal?.threadParts && existingLocal.threadParts.length > 0
      ? existingLocal.threadParts
      : [singlePost];

  const topics = normalizeTopicsList(
    payload.topic ?? existingLocal?.topic,
    payload.topics ?? existingLocal?.topics
  );
  const primaryTopic = topics[0] || (payload.topic?.trim() || existingLocal?.topic || "General");

  const plannedDate =
    requestedStage === "Planned"
      ? parsePlannedDateKey(payload.plannedDate ?? existingLocal?.plannedDate)
      : payload.plannedDate !== undefined
      ? parsePlannedDateKey(payload.plannedDate)
      : requestedStage === "Scheduled"
      ? existingLocal?.plannedDate || null
      : null;

  const initialId =
    payload.id || `local-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const record: CanonicalContentRecord = normalizeCanonicalRecord(
    {
      ...existingLocal,
      ...payload,
      id: initialId,
      userId: activeUid,
      title:
        payload.title ||
        existingLocal?.title ||
        (payload.hook ? payload.hook.slice(0, 60) : singlePost ? singlePost.split("\n")[0].slice(0, 60) : requestedStage === "Idea" ? "Untitled Idea" : "Untitled Draft"),
      singlePost,
      threadParts,
      hook: payload.hook ?? existingLocal?.hook ?? singlePost.split("\n")[0].slice(0, 120),
      stage: requestedStage,
      status: requestedStage,
      plannedDate,
      scheduledFor: requestedStage === "Scheduled" ? (payload.scheduledFor ?? existingLocal?.scheduledFor ?? null) : null,
      publishedAt: requestedStage === "Published" ? (payload.publishedAt ?? existingLocal?.publishedAt ?? now) : null,
      topic: primaryTopic,
      topics: topics.length > 0 ? topics : [primaryTopic],
      pillarTitle: payload.pillarTitle !== undefined ? payload.pillarTitle : existingLocal?.pillarTitle,
      sourceIdeaId: payload.sourceIdeaId !== undefined ? payload.sourceIdeaId : existingLocal?.sourceIdeaId ?? null,
      relatedIdeaIds: payload.relatedIdeaIds ?? existingLocal?.relatedIdeaIds ?? [],
      notes: payload.notes !== undefined ? payload.notes : existingLocal?.notes ?? "",
      profileContext: payload.profileContext || existingLocal?.profileContext || currentProfileSnapshot,
      createdAt: existingLocal?.createdAt || payload.createdAt || now,
      updatedAt: now,
    },
    activeUid
  );

  // 1. Optimistically persist to localStorage
  upsertLocalCanonicalRecord(activeUid, record);

  // 2. Persist to Firestore if authenticated
  if (auth.currentUser && activeUid !== "anonymous") {
    try {
      const firestoreDoc = buildFirestorePayload(record);

      if (!isLocalOnlyId(record.id)) {
        const docRef = doc(db, "posts", record.id);
        await withTimeout(setDoc(docRef, firestoreDoc, { merge: true }), 6000, false);
      } else {
        const postsRef = collection(db, "posts");
        const newDocRef = await withTimeout(addDoc(postsRef, firestoreDoc), 6000, false);
        const previousTempId = record.id;
        record.id = newDocRef.id;
        // Replace the temporary local ID cleanly so zero duplicates exist in localStorage
        upsertLocalCanonicalRecord(activeUid, record, previousTempId);
      }
      invalidateCanonicalCache(activeUid);
    } catch (err) {
      console.warn("[CanonicalContent] Firestore save warning (local-first copy preserved):", err);
    }
  }

  emitContentUpdatedEvent({ userId: activeUid, recordId: record.id, action: "save" });
  return record;
}

/**
 * Loads all unified content records for a user from Cloud & Local persistence with caching & deduplication.
 */
export async function fetchCanonicalRecords(
  userId: string,
  options?: { forceRefresh?: boolean; maxLimit?: number }
): Promise<CanonicalContentRecord[]> {
  const activeUid = userId || auth.currentUser?.uid || "anonymous";
  const forceRefresh = Boolean(options?.forceRefresh);
  const maxLimit = options?.maxLimit || 200;

  if (!forceRefresh) {
    const cached = canonicalRecordsCache.get(activeUid);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }
  }

  if (inFlightCanonicalRequests.has(activeUid)) {
    return inFlightCanonicalRequests.get(activeUid)!;
  }

  const fetchPromise = (async () => {
    const localRecords = readLocalCanonicalRecords(activeUid);
    const cloudRecords: CanonicalContentRecord[] = [];

    if (auth.currentUser && activeUid !== "anonymous") {
      try {
        const postsRef = collection(db, "posts");
        const q = query(postsRef, where("userId", "==", activeUid), limit(maxLimit));
        const snap = await withTimeout(getDocs(q), 6000, false);

        snap.forEach((docSnap) => {
          const raw = { id: docSnap.id, ...docSnap.data() };
          cloudRecords.push(normalizeCanonicalRecord(raw, activeUid));
        });
      } catch (err) {
        console.warn("[CanonicalContent] Cloud fetch note (using local cache):", err);
      }
    }

    const merged = mergeCanonicalRecords(cloudRecords, localRecords, activeUid);

    // Keep local cache hydrated with cloud truth so offline/reload is instantaneous
    if (cloudRecords.length > 0) {
      writeLocalCanonicalRecords(activeUid, merged);
    }

    canonicalRecordsCache.set(activeUid, {
      data: merged,
      expiresAt: Date.now() + CANONICAL_CACHE_TTL_MS,
    });
    return merged;
  })().finally(() => {
    inFlightCanonicalRequests.delete(activeUid);
  });

  inFlightCanonicalRequests.set(activeUid, fetchPromise);
  return fetchPromise;
}

/**
 * Updates lifecycle stage, planning date, or organization metadata on an existing record in-place.
 * Never downgrades a Published record.
 */
export async function updateCanonicalRecord(
  recordId: string,
  updates: Partial<CanonicalContentRecord>,
  userId?: string
): Promise<CanonicalContentRecord | null> {
  const activeUid = userId || auth.currentUser?.uid || "anonymous";
  const now = new Date().toISOString();
  const localRecords = readLocalCanonicalRecords(activeUid);
  const existing = localRecords.find((r) => r.id === recordId);

  // Protect Published records from losing their authoritative Published state
  let nextStage: CanonicalStage | undefined = updates.stage || (updates.status as CanonicalStage | undefined);
  if (existing?.stage === "Published" && nextStage && nextStage !== "Published") {
    nextStage = "Published";
  }

  const mergedRaw = {
    ...(existing || { id: recordId, userId: activeUid, singlePost: "" }),
    ...updates,
    ...(nextStage ? { stage: nextStage, status: nextStage } : {}),
    updatedAt: now,
  };

  const isUnscheduling = Boolean(
    (existing?.stage === "Scheduled" || updates.scheduledFor === null) &&
      nextStage &&
      ["Idea", "Draft", "Ready", "Planned"].includes(nextStage)
  );

  // Clear scheduledFor if moving back to non-scheduled planning stages
  if (nextStage && ["Idea", "Draft", "Ready", "Planned"].includes(nextStage)) {
    mergedRaw.scheduledFor = null;
    mergedRaw.scheduledAt = null;
  }
  // Clear plannedDate if explicitly unplanning back to Idea/Draft/Ready
  if (nextStage && ["Idea", "Draft", "Ready"].includes(nextStage) && updates.plannedDate === undefined) {
    mergedRaw.plannedDate = null;
  }

  let handledUnscheduleOnBackend = false;
  if (isUnscheduling && auth.currentUser && !isLocalOnlyId(recordId)) {
    try {
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch(`/api/posts/${encodeURIComponent(recordId)}/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({
          userId: auth.currentUser.uid,
          mode: "unschedule",
          nextStatus: nextStage === "Draft" || nextStage === "Planned" ? nextStage : "Ready",
        }),
      });
      if (res.status === 409) {
        const conflictBody = await res.json().catch(() => ({}));
        throw new Error(
          conflictBody?.error ||
            "This post is already publishing or published and cannot be unscheduled."
        );
      }
      if (res.ok) {
        handledUnscheduleOnBackend = true;
      }
    } catch (apiErr: any) {
      if (apiErr?.message && /already publishing|cannot be unscheduled/i.test(apiErr.message)) {
        throw apiErr;
      }
      console.warn("[CanonicalContent] Backend unschedule sync note:", apiErr);
    }
  }

  const normalized = normalizeCanonicalRecord(mergedRaw, activeUid);
  upsertLocalCanonicalRecord(activeUid, normalized);

  if (auth.currentUser && !isLocalOnlyId(recordId)) {
    try {
      const docRef = doc(db, "posts", recordId);
      const firestorePayload = buildFirestorePayload(normalized);
      if (isUnscheduling && !handledUnscheduleOnBackend) {
        (firestorePayload as Record<string, any>).isCanceled = true;
        (firestorePayload as Record<string, any>).canceledAt = now;
      }
      await withTimeout(setDoc(docRef, firestorePayload, { merge: true }), 6000, false);
      invalidateCanonicalCache(activeUid);
    } catch (err) {
      console.warn("[CanonicalContent] Firestore update error:", err);
    }
  }

  emitContentUpdatedEvent({ userId: activeUid, recordId, action: "update" });
  return normalized;
}

/**
 * Backward-compatible helper for stage transitions.
 */
export async function updateCanonicalStage(
  recordId: string,
  newStage: CanonicalStage,
  additionalMeta?: {
    plannedDate?: string | null;
    scheduledFor?: string | null;
    publishedAt?: string | null;
    threadsMediaId?: string | null;
    threadsPermalink?: string | null;
    errorMessage?: string;
  },
  userId?: string
): Promise<CanonicalContentRecord | null> {
  return updateCanonicalRecord(
    recordId,
    {
      stage: newStage,
      status: newStage,
      ...(additionalMeta?.plannedDate !== undefined ? { plannedDate: additionalMeta.plannedDate } : {}),
      ...(additionalMeta?.scheduledFor !== undefined ? { scheduledFor: additionalMeta.scheduledFor } : {}),
      ...(additionalMeta?.publishedAt !== undefined ? { publishedAt: additionalMeta.publishedAt } : {}),
      ...(additionalMeta?.threadsMediaId !== undefined ? { threadsMediaId: additionalMeta.threadsMediaId } : {}),
      ...(additionalMeta?.threadsPermalink !== undefined ? { threadsPermalink: additionalMeta.threadsPermalink } : {}),
      ...(additionalMeta?.errorMessage !== undefined ? { errorMessage: additionalMeta.errorMessage } : {}),
    },
    userId
  );
}

/**
 * Deletes a canonical content record from localStorage and Firestore.
 */
export async function deleteCanonicalRecord(recordId: string, userId?: string): Promise<void> {
  const activeUid = userId || auth.currentUser?.uid || "anonymous";

  if (auth.currentUser && !isLocalOnlyId(recordId)) {
    let handledByBackend = false;
    try {
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch(`/api/posts/${encodeURIComponent(recordId)}/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({
          userId: auth.currentUser.uid,
          mode: "delete",
        }),
      });
      if (res.status === 409) {
        const conflictBody = await res.json().catch(() => ({}));
        throw new Error(
          conflictBody?.error ||
            "This post is already publishing or published and cannot be deleted."
        );
      }
      if (res.ok) {
        handledByBackend = true;
      }
    } catch (apiErr: any) {
      if (apiErr?.message && /already publishing|cannot be deleted/i.test(apiErr.message)) {
        throw apiErr;
      }
      console.warn("[CanonicalContent] Backend delete sync unavailable, falling back to Firestore:", apiErr);
    }

    if (!handledByBackend) {
      try {
        await withTimeout(deleteDoc(doc(db, "posts", recordId)), 6000, false);
      } catch (err) {
        console.warn("[CanonicalContent] Firestore delete error:", err);
      }
    }
    invalidateCanonicalCache(activeUid);
  }

  removeLocalCanonicalRecord(activeUid, recordId);
  emitContentUpdatedEvent({ userId: activeUid, recordId, action: "delete" });
}

/**
 * Idempotently records an analytics update on a canonical post record.
 */
export async function recordAnalyticsUpdate(
  recordId: string,
  performanceData: CanonicalPerformance
): Promise<void> {
  const activeUid = auth.currentUser?.uid || "anonymous";
  const now = new Date().toISOString();

  try {
    const list = readLocalCanonicalRecords(activeUid);
    const updated = list.map((item) => {
      if (item.id === recordId || (item.threadsMediaId && item.threadsMediaId === recordId)) {
        return {
          ...item,
          performance: {
            ...(item.performance || {}),
            ...performanceData,
            analyzedAt: now,
            learnedAt: now,
          },
          updatedAt: now,
        };
      }
      return item;
    });
    writeLocalCanonicalRecords(activeUid, updated);
  } catch (_) {}

  if (auth.currentUser && !isLocalOnlyId(recordId)) {
    try {
      const docRef = doc(db, "posts", recordId);
      await updateDoc(docRef, {
        performance: sanitizeForFirestore({
          ...performanceData,
          analyzedAt: now,
          learnedAt: now,
        }),
        updatedAt: now,
      });
    } catch (err) {
      console.warn("[CanonicalContent] Analytics update error:", err);
    }
  }
}
