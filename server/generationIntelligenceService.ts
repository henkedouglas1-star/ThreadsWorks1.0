/**
 * Server-Side Generation Intelligence Service
 * 
 * Provides a single compact, generation-optimized intelligence snapshot per creator:
 * path: users/{userId}/generation_intelligence/current
 * 
 * Architecture Principle:
 * Create Content clicked -> Read compact intelligence snapshot (cached in memory) -> Generate content.
 * 
 * Avoids repeatedly scanning 60 historical posts, 500 analytics posts, and multiple strategy collections
 * during generation execution.
 */

import { summarizeDraftForLedger, type AngleLedgerEntry } from "./writeDiversityEngine";

export interface GenerationIntelligenceSnapshot {
  schemaVersion: number;
  userId: string;
  tabId?: string;
  summarizedCreatorContext: {
    offer: string;
    audience: string;
    desiredResult: string;
    writingStyle: string;
    customInstruction?: string;
    wordsToAvoid?: string;
    voiceNotes?: string;
    businessConcept?: string;
  };
  successfulContentPatterns: string[];
  weakContentPatterns: string[];
  recentThemes: string[];
  themesToAvoidRepeating: string[];
  recentHooks: string[];
  recentClosings: string[];
  recentCTAs: string[];
  recentAngleLedger?: AngleLedgerEntry[];
  topPerformingTopics: string[];
  topPerformingStructures: string[];
  performanceInsights: {
    topPillars: string[];
    topFormats: string[];
    topAngles: string[];
    observations: string[];
    medianViews?: number;
    medianLikes?: number;
  };
  contentGaps: string[];
  approvedOffers: Array<{ offer: string; pricePoint?: string }>;
  approvedLinks: string[];
  learnedStrategies: Array<{ id: string; title: string; mechanism: string; status: string }>;
  lastUpdated: string;
}

// In-memory TTL cache to prevent repeated getDoc calls during active creator generation sessions
interface MemoryCacheEntry {
  data: GenerationIntelligenceSnapshot;
  expiresAt: number;
}

const memoryCache = new Map<string, MemoryCacheEntry>();
const SNAPSHOT_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getCacheKey(userId: string, tabId?: string): string {
  return `${userId}_${tabId || "current"}`;
}

/**
 * Invalidate in-memory cache for a user
 */
export function invalidateGenerationIntelligenceCache(userId: string, tabId?: string): void {
  if (tabId) {
    memoryCache.delete(getCacheKey(userId, tabId));
  } else {
    for (const key of memoryCache.keys()) {
      if (key.startsWith(`${userId}_`)) {
        memoryCache.delete(key);
      }
    }
  }
}

/**
 * Retrieve or build the compact generation intelligence snapshot.
 * Reads exactly 1 document from Firestore on cache miss, or 0 when memory cached.
 */
export async function getOrBuildGenerationIntelligenceSnapshot(
  serverDb: any,
  userId: string,
  tabId?: string,
  contextData?: any
): Promise<GenerationIntelligenceSnapshot> {
  const cleanUserId = (userId || "anonymous").trim();
  const cleanTabId = tabId && tabId !== "default" ? tabId.trim() : "current";
  const cacheKey = getCacheKey(cleanUserId, cleanTabId);
  const now = Date.now();

  // 1. Return from in-memory cache if fresh (0 Firestore reads)
  const cached = memoryCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  // Fallback for anonymous users
  if (!cleanUserId || cleanUserId === "anonymous") {
    const anonymousSnapshot: GenerationIntelligenceSnapshot = buildDefaultSnapshot(cleanUserId, cleanTabId, contextData);
    memoryCache.set(cacheKey, { data: anonymousSnapshot, expiresAt: now + SNAPSHOT_CACHE_TTL_MS });
    return anonymousSnapshot;
  }

  // 2. Read single compact document from Firestore
  let docData: any = null;
  const docId = cleanTabId === "current" ? "current" : `tab_${cleanTabId}`;
  
  if (serverDb) {
    try {
      const docRef = serverDb
        .collection("users")
        .doc(cleanUserId)
        .collection("generation_intelligence")
        .doc(docId);
      const snap = await docRef.get();
      if (snap.exists) {
        docData = snap.data();
      }
    } catch (err: any) {
      console.warn(`[GenerationIntelligence] Note on reading snapshot for ${cleanUserId}:`, err?.message || err);
    }
  }

  if (docData && docData.summarizedCreatorContext) {
    const snapshot = docData as GenerationIntelligenceSnapshot;
    memoryCache.set(cacheKey, { data: snapshot, expiresAt: now + SNAPSHOT_CACHE_TTL_MS });
    return snapshot;
  }

  // 3. Document does not exist yet: initialize once and persist
  const newSnapshot = buildDefaultSnapshot(cleanUserId, cleanTabId, contextData);

  if (serverDb) {
    try {
      const docRef = serverDb
        .collection("users")
        .doc(cleanUserId)
        .collection("generation_intelligence")
        .doc(docId);
      await docRef.set(newSnapshot, { merge: true });
    } catch (writeErr: any) {
      console.warn(`[GenerationIntelligence] Note on initializing snapshot for ${cleanUserId}:`, writeErr?.message || writeErr);
    }
  }

  memoryCache.set(cacheKey, { data: newSnapshot, expiresAt: now + SNAPSHOT_CACHE_TTL_MS });
  return newSnapshot;
}

/**
 * Update generation intelligence snapshot when meaningful source data changes:
 * - Creator context saved / edited
 * - Analytics sync completes
 * - Learned strategy added / removed
 */
export async function updateGenerationIntelligenceSnapshot(
  serverDb: any,
  userId: string,
  tabId: string | undefined,
  partialUpdate: Partial<GenerationIntelligenceSnapshot>
): Promise<void> {
  const cleanUserId = (userId || "").trim();
  if (!cleanUserId || cleanUserId === "anonymous") return;

  const cleanTabId = tabId && tabId !== "default" ? tabId.trim() : "current";
  const docId = cleanTabId === "current" ? "current" : `tab_${cleanTabId}`;
  const cacheKey = getCacheKey(cleanUserId, cleanTabId);

  const payload = {
    ...partialUpdate,
    schemaVersion: 1,
    lastUpdated: new Date().toISOString()
  };

  // 1. Update in-memory cache immediately
  const existing = memoryCache.get(cacheKey);
  if (existing) {
    memoryCache.set(cacheKey, {
      data: { ...existing.data, ...payload },
      expiresAt: Date.now() + SNAPSHOT_CACHE_TTL_MS
    });
  }

  // 2. Persist to Firestore
  if (serverDb) {
    try {
      const docRef = serverDb
        .collection("users")
        .doc(cleanUserId)
        .collection("generation_intelligence")
        .doc(docId);
      await docRef.set(payload, { merge: true });
    } catch (err: any) {
      console.warn(`[GenerationIntelligence] Failed updating snapshot for ${cleanUserId}:`, err?.message || err);
    }
  }
}

/**
 * Record a newly generated/published batch into the repetition history window.
 * Keeps rolling history of recent topics, hooks, closings, and CTAs (max 10 entries).
 */
export async function recordGeneratedBatchInSnapshot(
  serverDb: any,
  userId: string,
  tabId: string | undefined,
  posts: Array<{ title?: string; hook?: string; singlePost?: string; threadParts?: string[]; cta?: string; lens?: string; strategicAngle?: string }>
): Promise<void> {
  const cleanUserId = (userId || "").trim();
  if (!cleanUserId || cleanUserId === "anonymous" || !Array.isArray(posts) || posts.length === 0) return;

  try {
    const current = await getOrBuildGenerationIntelligenceSnapshot(serverDb, cleanUserId, tabId);

    const newLedgerEntries: AngleLedgerEntry[] = posts
      .map(p => summarizeDraftForLedger(p, p.lens || p.strategicAngle))
      .filter(entry => Boolean(entry.hook));

    const existingLedger = Array.isArray(current.recentAngleLedger) ? current.recentAngleLedger : [];
    const seenLedgerKeys = new Set<string>();
    const updatedAngleLedger: AngleLedgerEntry[] = [];
    for (const entry of [...newLedgerEntries, ...existingLedger]) {
      const key = (entry.hookPrefix || entry.hook || "").toLowerCase().trim();
      if (!key || seenLedgerKeys.has(key)) continue;
      seenLedgerKeys.add(key);
      // Keep snapshot compact in Firestore (strip bodyTokens array bloat, keep essential fingerprint fields)
      updatedAngleLedger.push({
        ...(entry.lens ? { lens: entry.lens } : {}),
        ...(entry.title ? { title: entry.title.slice(0, 100) } : {}),
        hook: entry.hook.slice(0, 220),
        hookPrefix: entry.hookPrefix.slice(0, 80),
        thesisSummary: (entry.thesisSummary || "").slice(0, 180),
        closingSkeleton: (entry.closingSkeleton || "").slice(0, 140),
        createdAt: entry.createdAt || new Date().toISOString()
      });
      if (updatedAngleLedger.length >= 25) break;
    }

    const newTopics = posts.map(p => p.title).filter(Boolean) as string[];
    const newHooks = posts.map(p => p.hook || p.singlePost?.split("\n\n")[0]).filter(Boolean) as string[];
    const newClosings = newLedgerEntries.map(e => e.closingSkeleton).filter(Boolean);
    const newCTAs = posts.map(p => p.cta).filter(Boolean) as string[];

    const updatedThemes = Array.from(new Set([...newTopics, ...(current.recentThemes || [])])).slice(0, 15);
    const updatedHooks = Array.from(new Set([...newHooks, ...(current.recentHooks || [])])).slice(0, 15);
    const updatedClosings = Array.from(new Set([...newClosings, ...(current.recentClosings || [])])).slice(0, 15);
    const updatedCTAs = Array.from(new Set([...newCTAs, ...(current.recentCTAs || [])])).slice(0, 5);

    await updateGenerationIntelligenceSnapshot(serverDb, cleanUserId, tabId, {
      recentThemes: updatedThemes,
      recentHooks: updatedHooks,
      recentClosings: updatedClosings,
      recentCTAs: updatedCTAs,
      recentAngleLedger: updatedAngleLedger
    });
  } catch (err: any) {
    console.warn(`[GenerationIntelligence] Note on recording batch for ${cleanUserId}:`, err?.message);
  }
}

/**
 * Helper to construct an initial snapshot from available context
 */
function buildDefaultSnapshot(
  userId: string,
  tabId: string,
  contextData?: any
): GenerationIntelligenceSnapshot {
  const offer = contextData?.offer && contextData.offer !== "a high-value product or service" ? contextData.offer.trim() : "";
  const audience = contextData?.audience || "";
  const desiredResult = contextData?.desiredResult || "";
  const writingStyle = contextData?.writingStyle || "";
  const customInstruction = contextData?.customInstruction || "";
  const wordsToAvoid = contextData?.creatorIdentity?.wordsYouAvoid || "";
  const voiceNotes = contextData?.rawVoice || "";
  const businessConcept = contextData?.rawBusinessText || "";

  const pricePoint = contextData?.offerIntelligence?.pricePoint || "";
  const websiteUrl = contextData?.offerIntelligence?.websiteUrl || "";

  const approvedLinks: string[] = [];
  if (websiteUrl) approvedLinks.push(websiteUrl);
  if (Array.isArray(contextData?.contentDestinations)) {
    contextData.contentDestinations.forEach((d: any) => {
      const u = typeof d === "string" ? d : (d?.url || d?.link);
      if (u && !approvedLinks.includes(u)) approvedLinks.push(u);
    });
  }

  return {
    schemaVersion: 1,
    userId,
    tabId,
    summarizedCreatorContext: {
      offer,
      audience,
      desiredResult,
      writingStyle,
      customInstruction,
      wordsToAvoid,
      voiceNotes,
      businessConcept
    },
    successfulContentPatterns: [],
    weakContentPatterns: [],
    recentThemes: [],
    themesToAvoidRepeating: [],
    recentHooks: [],
    recentClosings: [],
    recentCTAs: contextData?.activeCta ? [contextData.activeCta] : [],
    recentAngleLedger: [],
    topPerformingTopics: [],
    topPerformingStructures: [],
    performanceInsights: {
      topPillars: [],
      topFormats: [],
      topAngles: [],
      observations: []
    },
    contentGaps: [],
    approvedOffers: offer ? [{ offer, pricePoint }] : [],
    approvedLinks,
    learnedStrategies: [],
    lastUpdated: new Date().toISOString()
  };
}
