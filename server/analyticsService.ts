/**
 * Server-Side Threads Analytics Service & Data Layer
 * Handles fetching, normalizing, storing, deduplicating, and querying Threads Insights.
 * Features in-memory caching and resilient quota-exhaustion fallback handling.
 */

import {
  AccountAnalyticsSnapshot,
  AccountTimeSeriesPoint,
  AccountTimeframeMetrics,
  PostAnalyticsRecord,
  AnalyticsSyncSummary,
  PostAnalyticsFilterOptions,
  PostContentMemoryContext
} from "../src/types/analytics";
import { updateGenerationIntelligenceSnapshot } from "./generationIntelligenceService";

/** Use only mature posts with actual Meta insights when labeling performance leaders. */
export function selectVerifiedPerformanceSignals(posts: PostAnalyticsRecord[]) {
  const eligible = posts.filter(p => p.metricsAvailable === true && p.maturationStatus === "mature" && Number.isFinite(p.metrics?.views));
  eligible.sort((a, b) => b.metrics.views - a.metrics.views);
  const unique = (field: "topic" | "format" | "pillarTitle", limit: number) =>
    Array.from(new Set(eligible.map(p => p.contentMemoryContext?.[field]).filter((v): v is string => typeof v === "string" && Boolean(v.trim())))).slice(0, limit);
  return { sampleSize: eligible.length, topics: unique("topic", 5), formats: unique("format", 3), pillars: unique("pillarTitle", 3) };
}

export interface AnalyticsServiceDependencies {
  clientDb: any;
  serverDb: any;
  clientDoc: any;
  clientGetDoc: any;
  clientSetDoc: any;
  clientUpdateDoc: any;
  clientCollection: any;
  clientGetDocs: any;
  clientQuery: any;
  clientWhere: any;
}

/**
 * Helper to identify Firestore quota exhaustion errors.
 */
export function isFirestoreQuotaError(err: any): boolean {
  if (!err) return false;
  const msg = err.message || String(err);
  return (
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("Quota exceeded") ||
    msg.includes("Quota limit exceeded") ||
    msg.includes("quota exceeded") ||
    err.code === 8 ||
    err.code === "resource-exhausted" ||
    err.code === "RESOURCE_EXHAUSTED"
  );
}

/**
 * Helper to parse a metric object from Meta Threads API.
 * Supports both daily time series (values array) and period aggregates (total_value).
 */
export function extractMetaMetricValues(item: any): { total: number; values: { value: number; endTime?: string; dateKey: string }[] } {
  if (!item) return { total: 0, values: [] };
  const rawValues = Array.isArray(item.values) ? item.values : [];
  const parsedValues: { value: number; endTime?: string; dateKey: string }[] = [];
  let sumOfValues = 0;

  for (const v of rawValues) {
    const valNum = typeof v.value === "number" ? v.value : Number(v.value) || 0;
    const endTime = v.end_time || new Date().toISOString();
    const dateKey = endTime.split("T")[0];
    parsedValues.push({ value: valNum, endTime, dateKey });
    sumOfValues += valNum;
  }

  let total = 0;
  if (item.total_value && typeof item.total_value.value !== "undefined") {
    total = typeof item.total_value.value === "number" ? item.total_value.value : Number(item.total_value.value) || 0;
  } else if (parsedValues.length > 0) {
    if (item.name === "followers_count") {
      total = parsedValues[parsedValues.length - 1].value;
    } else {
      total = sumOfValues;
    }
  }

  return { total, values: parsedValues };
}

/**
 * Normalizes single window raw insights response into AccountTimeframeMetrics.
 */
export function normalizeTimeframeMetrics(rawInsightsData: any): {
  metrics: AccountTimeframeMetrics;
  timeSeries: AccountTimeSeriesPoint[];
  dailySnapshots: Record<string, any>;
} {
  const metrics: AccountTimeframeMetrics = {
    views: 0,
    likes: 0,
    replies: 0,
    reposts: 0,
    quotes: 0,
    followersCount: 0,
    totalEngagements: 0,
    engagementRateOnViews: 0
  };

  const timeSeries: AccountTimeSeriesPoint[] = [];
  const dailySnapshots: Record<string, any> = {};

  if (rawInsightsData && Array.isArray(rawInsightsData.data)) {
    for (const item of rawInsightsData.data) {
      const metricName = item.name;
      const period = item.period || "day";
      const { total, values } = extractMetaMetricValues(item);

      if (metricName === "views") metrics.views = total;
      else if (metricName === "likes") metrics.likes = total;
      else if (metricName === "replies" || metricName === "thread_replies") metrics.replies = total;
      else if (metricName === "reposts") metrics.reposts = total;
      else if (metricName === "quotes") metrics.quotes = total;
      else if (metricName === "followers_count") metrics.followersCount = total;

      for (const v of values) {
        timeSeries.push({
          metric: metricName,
          value: v.value,
          period,
          endTime: v.endTime,
          dateKey: v.dateKey
        });

        if (!dailySnapshots[v.dateKey]) {
          dailySnapshots[v.dateKey] = { recordedAt: v.endTime };
        }
        if (metricName === "views") dailySnapshots[v.dateKey].views = v.value;
        else if (metricName === "likes") dailySnapshots[v.dateKey].likes = v.value;
        else if (metricName === "replies" || metricName === "thread_replies") dailySnapshots[v.dateKey].replies = v.value;
        else if (metricName === "reposts") dailySnapshots[v.dateKey].reposts = v.value;
        else if (metricName === "quotes") dailySnapshots[v.dateKey].quotes = v.value;
        else if (metricName === "followers_count") dailySnapshots[v.dateKey].followersCount = v.value;
      }
    }
  }

  metrics.totalEngagements = metrics.likes + metrics.replies + metrics.reposts + metrics.quotes;
  metrics.engagementRateOnViews = metrics.views > 0 ? Number(((metrics.totalEngagements / metrics.views) * 100).toFixed(2)) : 0;

  return { metrics, timeSeries, dailySnapshots };
}

/**
 * Normalizes raw account insights payload from Meta Graph API into stable ThreadsWorks model
 * supporting accurate 1D, 7D, and 30D rolling timeframes.
 */
export function normalizeAccountInsights(
  rawInsightsPayload: any,
  userId: string,
  threadsUserId: string,
  threadsUsername: string,
  previousAccountSnapshot?: AccountAnalyticsSnapshot | null
): AccountAnalyticsSnapshot {
  let windowsMap: {
    "1d": AccountTimeframeMetrics;
    "7d": AccountTimeframeMetrics;
    "30d": AccountTimeframeMetrics;
  };

  let allTimeSeries: AccountTimeSeriesPoint[] = [];
  let mergedDailySnapshots: Record<string, any> = {
    ...(previousAccountSnapshot?.dailySnapshots || {})
  };

  // Check if payload contains multi-window responses
  if (rawInsightsPayload && (rawInsightsPayload["1d"] || rawInsightsPayload["7d"] || rawInsightsPayload["30d"])) {
    const norm1D = normalizeTimeframeMetrics(rawInsightsPayload["1d"]);
    const norm7D = normalizeTimeframeMetrics(rawInsightsPayload["7d"]);
    const norm30D = normalizeTimeframeMetrics(rawInsightsPayload["30d"]);

    windowsMap = {
      "1d": norm1D.metrics,
      "7d": norm7D.metrics,
      "30d": norm30D.metrics
    };

    allTimeSeries = [...norm30D.timeSeries];
    mergedDailySnapshots = {
      ...mergedDailySnapshots,
      ...norm30D.dailySnapshots,
      ...norm7D.dailySnapshots,
      ...norm1D.dailySnapshots
    };
  } else {
    // Single window fallback
    const norm = normalizeTimeframeMetrics(rawInsightsPayload);
    windowsMap = {
      "1d": { ...norm.metrics },
      "7d": { ...norm.metrics },
      "30d": { ...norm.metrics }
    };
    allTimeSeries = norm.timeSeries;
    mergedDailySnapshots = {
      ...mergedDailySnapshots,
      ...norm.dailySnapshots
    };
  }

  // Calculate follower growth across windows if historical snapshots exist
  const sortedDateKeys = Object.keys(mergedDailySnapshots).sort();
  const currentFollowers = windowsMap["7d"].followersCount || windowsMap["30d"].followersCount || windowsMap["1d"].followersCount;

  for (const winKey of ["1d", "7d", "30d"] as const) {
    const days = winKey === "1d" ? 1 : winKey === "7d" ? 7 : 30;
    const targetDateKey = new Date(Date.now() - days * 86400000).toISOString().split("T")[0];
    const pastSnapshot = mergedDailySnapshots[targetDateKey] || (sortedDateKeys.length > 0 ? mergedDailySnapshots[sortedDateKeys[0]] : null);

    if (pastSnapshot && typeof pastSnapshot.followersCount === "number" && currentFollowers > 0) {
      windowsMap[winKey].followerGrowth = currentFollowers - pastSnapshot.followersCount;
    } else {
      windowsMap[winKey].isCollectingHistory = true;
      windowsMap[winKey].statusMessage = "Collecting analytics history";
    }
  }

  // Default active metric set represents the 7-day rolling window
  const defaultMetrics = { ...windowsMap["7d"] };
  const totalEngagements = defaultMetrics.totalEngagements;
  const engagementRateOnViews = defaultMetrics.engagementRateOnViews;

  return {
    id: userId,
    userId,
    threadsUserId,
    threadsUsername: threadsUsername || "",
    source: "meta_threads_api",
    period: "7d",
    lastSyncedAt: new Date().toISOString(),
    selectedWindow: "7d",
    windows: windowsMap,
    metrics: {
      views: defaultMetrics.views,
      likes: defaultMetrics.likes,
      replies: defaultMetrics.replies,
      reposts: defaultMetrics.reposts,
      quotes: defaultMetrics.quotes,
      followersCount: defaultMetrics.followersCount
    },
    derivedMetrics: {
      totalEngagements,
      engagementRateOnViews,
      followerGrowth: defaultMetrics.followerGrowth,
      isCollectingHistory: defaultMetrics.isCollectingHistory,
      statusMessage: defaultMetrics.statusMessage
    },
    timeSeries: allTimeSeries,
    dailySnapshots: mergedDailySnapshots
  };
}

/**
 * Normalizes raw post insights from Meta Graph API into stable ThreadsWorks PostAnalyticsRecord.
 */
export function normalizePostInsights(
  rawPostInsights: any,
  mediaItem: any,
  userId: string,
  threadsUserId: string,
  threadsUsername?: string,
  matchedContentPost?: any
): PostAnalyticsRecord {
  const mediaId = String(mediaItem.id);
  const metrics = {
    views: 0,
    likes: 0,
    replies: 0,
    reposts: 0,
    quotes: 0
  };

  let metricsAvailable = false;

  if (rawPostInsights && Array.isArray(rawPostInsights.data) && rawPostInsights.data.length > 0) {
    metricsAvailable = true;
    for (const item of rawPostInsights.data) {
      const metricName = item.name;
      const values = Array.isArray(item.values) ? item.values : [];
      let numVal = 0;
      if (values.length > 0) {
        numVal = typeof values[0].value === "number" ? values[0].value : Number(values[0].value) || 0;
      } else if (item.total_value && typeof item.total_value.value !== "undefined") {
        numVal = typeof item.total_value.value === "number" ? item.total_value.value : Number(item.total_value.value) || 0;
      }

      if (metricName === "views") metrics.views = numVal;
      else if (metricName === "likes") metrics.likes = numVal;
      else if (metricName === "replies" || metricName === "thread_replies") metrics.replies = numVal;
      else if (metricName === "reposts") metrics.reposts = numVal;
      else if (metricName === "quotes") metrics.quotes = numVal;
    }
  }

  const totalInteractions = metrics.likes + metrics.replies + metrics.reposts + metrics.quotes;
  const engagementRate = metrics.views > 0 ? (totalInteractions / metrics.views) * 100 : 0;

  const postText = mediaItem.text || matchedContentPost?.singlePost || matchedContentPost?.hook || "";
  const firstLineHook = postText ? postText.split("\n")[0].slice(0, 150) : "";

  const publishedAt = mediaItem.timestamp || new Date().toISOString();
  const pubTime = new Date(publishedAt).getTime();
  const observationAgeHours = Math.max(0, Number(((Date.now() - (isNaN(pubTime) ? Date.now() : pubTime)) / (1000 * 3600)).toFixed(1)));
  const maturationStatus: "maturing" | "mature" = observationAgeHours >= 48 ? "mature" : "maturing";
  const isHistoricalImport = !matchedContentPost;

  // Extract structural hook pattern for historical posts if not explicitly provided
  let hookPattern = "Standard Hook";
  if (firstLineHook.includes("?") || /^(how|why|what|is|are|do|can|did|should)\b/i.test(firstLineHook)) {
    hookPattern = "Direct Question Hook";
  } else if (/\b(but|however|instead|stop|never|don't)\b/i.test(firstLineHook)) {
    hookPattern = "Contrast / Counter-Intuitive Hook";
  } else if (/^\d+|^\#\d+|\b\d+\b/.test(firstLineHook)) {
    hookPattern = "Number / List Hook";
  } else if (/^(I|When I|Years ago|Last week|My|In 20)\b/i.test(firstLineHook)) {
    hookPattern = "Story / Personal Opening Hook";
  } else if (/\b(truth|secret|mistake|nobody|unpopular)\b/i.test(firstLineHook)) {
    hookPattern = "Bold Claim Hook";
  }

  let inferredFormat = matchedContentPost?.format || "Short Post";
  if (!matchedContentPost) {
    if (postText.length > 300 || postText.includes("\n\n")) {
      inferredFormat = "Long Form Text";
    } else if (mediaItem.media_type === "IMAGE" || mediaItem.media_type === "CAROUSEL_ALBUM") {
      inferredFormat = "Visual Media Post";
    }
  }

  let contentMemoryContext: PostContentMemoryContext | undefined;

  if (matchedContentPost) {
    const derivedPartCount = matchedContentPost.decision?.recommendedPartCount ||
      (Array.isArray(matchedContentPost.threadParts) ? matchedContentPost.threadParts.length : undefined);
    contentMemoryContext = {
      hook: matchedContentPost.hook || firstLineHook,
      topic: matchedContentPost.topic || matchedContentPost.title,
      format: matchedContentPost.format || inferredFormat,
      pillarTitle: matchedContentPost.decision?.pillarTitle,
      strategicAngle: matchedContentPost.decision?.strategicAngle || hookPattern,
      contentType: matchedContentPost.decision?.contentType,
      cta: matchedContentPost.decision?.cta,
      offerRelationship: matchedContentPost.decision?.offerRelationship,
      targetBuyer: matchedContentPost.decision?.targetBuyer,
      strategicReason: matchedContentPost.decision?.strategicReason,
      partCount: derivedPartCount,
      sentencesPerPart: matchedContentPost.decision?.recommendedSentencesPerPart,
      recommendedLength: matchedContentPost.decision?.recommendedLength,
      structuralPacingGuidance: matchedContentPost.decision?.structuralPacingGuidance
    };
  } else if (firstLineHook) {
    const textPartCount = postText.includes("\n---") || postText.includes("\n\n---") ? postText.split(/\n-+\n|\n\n-+/).length : undefined;
    contentMemoryContext = {
      hook: firstLineHook,
      format: inferredFormat,
      strategicAngle: hookPattern,
      partCount: textPartCount
    };
  }

  return {
    id: `${userId}_${mediaId}`,
    userId,
    threadsUserId,
    threadsUsername: threadsUsername || "",
    mediaId,
    text: postText,
    permalink: mediaItem.permalink || `https://threads.net/@${threadsUsername || "user"}/post/${mediaId}`,
    mediaType: mediaItem.media_type || mediaItem.media_product_type || "TEXT_POST",
    publishedAt,
    period: "lifetime",
    lastSyncedAt: new Date().toISOString(),
    metrics,
    metricsAvailable,
    observationAgeHours,
    maturationStatus,
    isHistoricalImport,
    derivedMetrics: {
      totalInteractions,
      engagementRate: Number(engagementRate.toFixed(2))
    },
    matchedContentPostId: matchedContentPost?.id || null,
    contentMemoryContext
  };
}

/**
 * Creates and initializes the AnalyticsService instance with memory-first caching.
 */
export function createAnalyticsService(deps: AnalyticsServiceDependencies) {
  const {
    clientDb,
    serverDb,
    clientDoc,
    clientGetDoc,
    clientSetDoc,
    clientUpdateDoc,
    clientCollection,
    clientGetDocs,
    clientQuery,
    clientWhere
  } = deps;

  // In-Memory Storage Cache (Guarantees instant response & resilient operation during Firestore quota periods)
  const memoryCache = {
    accountAnalytics: new Map<string, { data: AccountAnalyticsSnapshot; timestamp: number }>(),
    postAnalytics: new Map<string, { data: PostAnalyticsRecord[]; timestamp: number }>(),
    singlePosts: new Map<string, { data: PostAnalyticsRecord; timestamp: number }>(),
    syncStatus: new Map<string, { data: AnalyticsSyncSummary; timestamp: number }>(),
    userConnections: new Map<string, { data: any; token: string; timestamp: number }>(),
    libraryPosts: new Map<string, { data: any[]; timestamp: number }>()
  };

  // Single-flight synchronization lock to prevent duplicate concurrent executions for the same user
  const activeSyncLocks = new Map<string, Promise<any>>();

  // Cooldown tracker for Firestore Quota limits
  let quotaCooldownUntil = 0;

  function markQuotaExhausted(operationName: string, err: any) {
    quotaCooldownUntil = Date.now() + 15 * 60 * 1000; // 15 min cooldown
    console.log(`[AnalyticsService] Firestore quota reached during ${operationName}. Serving from in-memory cache.`);
  }

  /**
   * Helper: Retrieve user connection & secure token safely.
   */
  async function getUserConnectionWithToken(userId: string): Promise<{
    connection: any;
    token: string;
    threadsUserId: string;
    threadsUsername: string;
  } | null> {
    if (!userId) return null;

    // Check memory cache first
    const cached = memoryCache.userConnections.get(userId);
    if (cached && (Date.now() - cached.timestamp < 10 * 60 * 1000 || Date.now() < quotaCooldownUntil)) {
      if (cached.data && cached.token) {
        return {
          connection: cached.data,
          token: cached.token,
          threadsUserId: String(cached.data.threadsUserId || "me"),
          threadsUsername: String(cached.data.threadsUsername || "")
        };
      }
    }

    let connection: any = null;
    let token = "";

    if (serverDb && Date.now() >= quotaCooldownUntil) {
      try {
        const [connDoc, secDoc] = await Promise.all([
          serverDb.collection("connections").doc(String(userId)).get(),
          serverDb.collection("connections_secure").doc(String(userId)).get()
        ]);

        if (connDoc.exists) {
          connection = connDoc.data();
        }
        if (secDoc.exists) {
          token = secDoc.data()?.threadsAccessToken || "";
        }
      } catch (adminErr: any) {
        if (isFirestoreQuotaError(adminErr)) {
          markQuotaExhausted("getUserConnectionWithToken", adminErr);
        } else {
          console.log(`[AnalyticsService] Admin SDK reading connection for ${userId}:`, adminErr?.message || adminErr);
        }
      }
    }

    // Secondary lookup in clientDb if token or connection not found
    if ((!connection || !token) && clientDb) {
      try {
        const [cSnap, sSnap] = await Promise.all([
          clientGetDoc(clientDoc(clientDb, "connections", String(userId))),
          clientGetDoc(clientDoc(clientDb, "connections_secure", String(userId)))
        ]);
        if (cSnap.exists()) {
          connection = connection || cSnap.data();
        }
        if (sSnap.exists()) {
          token = token || sSnap.data()?.threadsAccessToken || "";
        }
      } catch (_) {}
    }

    // Check if token was stored directly in connection doc
    if (connection && !token && connection.threadsAccessToken) {
      token = connection.threadsAccessToken;
    }

    // If serverDb failed with quota or didn't find, fallback to cached
    if ((!connection || !token) && cached) {
      connection = connection || cached.data;
      token = token || cached.token;
    }

    if (!connection || !token) {
      return null;
    }

    // Save to memory cache
    memoryCache.userConnections.set(userId, { data: connection, token, timestamp: Date.now() });

    return {
      connection,
      token,
      threadsUserId: String(connection.threadsUserId || "me"),
      threadsUsername: String(connection.threadsUsername || "")
    };
  }

  /**
   * Safe Diagnostic Logger for Meta API Calls
   * Logs full error context without leaking access tokens, secrets, or private credentials.
   */
  function logMetaApiError(
    context: string,
    userId: string,
    threadsUserId: string,
    endpointPath: string,
    status: number,
    errorData: any,
    requestedMetricsOrFields?: string
  ) {
    const metaError = errorData?.error || errorData || {};
    console.error(`[THREADS_API_ERROR] [${context}]`, {
      timestamp: new Date().toISOString(),
      firebaseUid: userId,
      threadsUserId: threadsUserId || "unknown",
      endpoint: endpointPath,
      httpStatus: status,
      metaErrorCode: metaError.code ?? metaError.error_subcode ?? "N/A",
      metaErrorType: metaError.type ?? "N/A",
      metaErrorMessage: metaError.message || JSON.stringify(errorData) || "Unknown Meta API error",
      requestedMetrics: requestedMetricsOrFields || "N/A"
    });
  }

  /**
   * Helper: Verify active granted permissions on Meta Graph API with a live probe.
   */
  async function checkInsightsPermission(
    token: string,
    threadsUserId: string = "me",
    userId: string = "unknown"
  ): Promise<{
    hasInsights: boolean;
    hasPublish: boolean;
    grantedScopes: string[];
    diagnosticError?: {
      status: number;
      code?: number;
      type?: string;
      message?: string;
    };
  }> {
    if (!token) {
      return { hasInsights: false, hasPublish: false, grantedScopes: [] };
    }

    const defaultScopes = ["threads_basic", "threads_content_publish", "threads_manage_insights", "threads_profile_discovery"];
    const targetEndpoint = (threadsUserId && threadsUserId !== "me" && threadsUserId !== "unknown" && threadsUserId !== "anonymous" && /^\d+$/.test(threadsUserId)) 
      ? threadsUserId 
      : "me";

    try {
      // Direct live verification of Insights API capability on graph.threads.net
      const res = await fetch(
        `https://graph.threads.net/v1.0/${targetEndpoint}/threads_insights?metric=views&access_token=${encodeURIComponent(token)}`
      );

      if (res.ok) {
        return {
          hasInsights: true,
          hasPublish: true,
          grantedScopes: defaultScopes
        };
      }

      const errJson: any = await res.json().catch(() => ({}));
      const metaErr = errJson?.error || {};
      logMetaApiError(
        "checkInsightsPermission",
        userId,
        threadsUserId,
        `/${targetEndpoint}/threads_insights?metric=views`,
        res.status,
        errJson,
        "views"
      );

      // Verify whether basic publishing/profile token is at least valid
      let hasPublish = false;
      try {
        const meRes = await fetch(
          `https://graph.threads.net/v1.0/me?fields=id,username&access_token=${encodeURIComponent(token)}`
        );
        hasPublish = meRes.ok;
      } catch (_) {}

      return {
        hasInsights: false,
        hasPublish,
        grantedScopes: hasPublish ? ["threads_basic", "threads_content_publish"] : [],
        diagnosticError: {
          status: res.status,
          code: metaErr.code,
          type: metaErr.type,
          message: metaErr.message || `HTTP ${res.status} returned by Meta Graph API`
        }
      };
    } catch (err: any) {
      console.warn("[AnalyticsService] Network probe failed when checking Insights capability:", err?.message || err);
      return {
        hasInsights: false,
        hasPublish: false,
        grantedScopes: [],
        diagnosticError: {
          status: 0,
          message: err?.message || "Network error communicating with Meta Graph API"
        }
      };
    }
  }

  /**
   * Helper: Retrieve existing user Content Library posts from Firestore for Content Memory linking.
   */
  async function getUserLibraryPosts(userId: string): Promise<any[]> {
    const cached = memoryCache.libraryPosts.get(userId);
    if (cached && (Date.now() - cached.timestamp < 10 * 60 * 1000 || Date.now() < quotaCooldownUntil)) {
      return cached.data;
    }

    const posts: any[] = [];

    if (serverDb && Date.now() >= quotaCooldownUntil) {
      try {
        const snap = await serverDb.collection("posts").where("userId", "==", userId).limit(50).get();
        snap.forEach((d: any) => posts.push({ id: d.id, ...d.data() }));
        memoryCache.libraryPosts.set(userId, { data: posts, timestamp: Date.now() });
        return posts;
      } catch (err: any) {
        if (isFirestoreQuotaError(err)) {
          markQuotaExhausted("getUserLibraryPosts", err);
        } else {
          console.log(`[AnalyticsService] Admin SDK query posts note:`, err?.message || err);
        }
      }
    }

    return cached?.data || [];
  }

  /**
   * Helper: Match a Meta media item with existing ThreadsWorks content post.
   */
  function matchContentPost(mediaItem: any, userPosts: any[]): any | null {
    if (!userPosts || userPosts.length === 0) return null;

    const mediaId = String(mediaItem.id);
    const mediaText = (mediaItem.text || "").trim().toLowerCase();

    // 1. Check direct publishedPostId, postId, threadsPostId, threadsMediaId, or publishedIds array
    const directMatch = userPosts.find((p) => 
      p.publishedPostId === mediaId || 
      p.postId === mediaId || 
      p.threadsPostId === mediaId || 
      p.threadsMediaId === mediaId ||
      (Array.isArray(p.publishedIds) && p.publishedIds.includes(mediaId))
    );
    if (directMatch) return directMatch;

    if (!mediaText) return null;

    // 2. Check exact or high-similarity hook / singlePost
    for (const post of userPosts) {
      const postHook = (post.hook || "").trim().toLowerCase();
      const postSingle = (post.singlePost || "").trim().toLowerCase();

      if (postHook && (mediaText.startsWith(postHook) || postHook.startsWith(mediaText.slice(0, 50)))) {
        return post;
      }
      if (postSingle && (mediaText === postSingle || mediaText.startsWith(postSingle.slice(0, 60)))) {
        return post;
      }
    }

    return null;
  }

  /**
   * Helper: Write doc to Firestore with in-memory cache backing.
   */
  async function writeDocument(collectionName: string, docId: string, data: any): Promise<void> {
    // 1. Always store to local memory cache first
    if (collectionName === "analytics_account") {
      const userId = data.userId || docId;
      memoryCache.accountAnalytics.set(userId, { data, timestamp: Date.now() });
    } else if (collectionName === "analytics_posts") {
      const userId = data.userId;
      memoryCache.singlePosts.set(docId, { data, timestamp: Date.now() });
      if (userId) {
        const existingList = memoryCache.postAnalytics.get(userId)?.data || [];
        const filtered = existingList.filter(p => p.id !== docId);
        filtered.push(data);
        memoryCache.postAnalytics.set(userId, { data: filtered, timestamp: Date.now() });
      }
    } else if (collectionName === "analytics_sync_state") {
      memoryCache.syncStatus.set(docId, { data, timestamp: Date.now() });
    }

    // 2. Write to server Firestore if not in quota cooldown
    if (serverDb && Date.now() >= quotaCooldownUntil) {
      try {
        await serverDb.collection(collectionName).doc(docId).set(data, { merge: true });
      } catch (adminErr: any) {
        if (isFirestoreQuotaError(adminErr)) {
          markQuotaExhausted(`writeDocument(${collectionName}/${docId})`, adminErr);
        } else {
          console.log(`[AnalyticsService] Admin write to ${collectionName}/${docId} note:`, adminErr?.message || adminErr);
        }
      }
    }
  }

  /**
   * Helper: Batch write documents to Firestore in supported chunks (up to 400 docs per commit).
   */
  async function writeDocumentsBatch(items: { collection: string; id: string; data: any }[]): Promise<void> {
    if (!items || items.length === 0) return;

    // 1. Update memory cache first
    for (const item of items) {
      if (item.collection === "analytics_account") {
        const userId = item.data.userId || item.id;
        memoryCache.accountAnalytics.set(userId, { data: item.data, timestamp: Date.now() });
      } else if (item.collection === "analytics_posts") {
        memoryCache.singlePosts.set(item.id, { data: item.data, timestamp: Date.now() });
      } else if (item.collection === "analytics_sync_state") {
        memoryCache.syncStatus.set(item.id, { data: item.data, timestamp: Date.now() });
      }
    }

    // 2. Commit in batches to server Firestore
    if (serverDb && Date.now() >= quotaCooldownUntil) {
      try {
        const BATCH_SIZE = 400;
        for (let i = 0; i < items.length; i += BATCH_SIZE) {
          const chunk = items.slice(i, i + BATCH_SIZE);
          const batch = serverDb.batch();
          for (const c of chunk) {
            const docRef = serverDb.collection(c.collection).doc(c.id);
            batch.set(docRef, c.data, { merge: true });
          }
          await batch.commit();
        }
      } catch (err: any) {
        if (isFirestoreQuotaError(err)) {
          markQuotaExhausted(`writeDocumentsBatch(${items.length} items)`, err);
        } else {
          console.warn("[AnalyticsService] Batch write error:", err?.message || err);
        }
      }
    }
  }

  /**
   * Synchronizes user's Threads account and post analytics from Meta Graph API.
   * Features:
   * - Single-flight lock preventing duplicate concurrent executions.
   * - Parallel 1D, 7D, and 30D window metrics from Meta Graph API.
   * - Incremental, timeframe-aware post discovery (no arbitrary 100-post limit).
   * - Batched Firestore writes for optimal performance and quota preservation.
   */
  async function syncUserAnalytics(
    userId: string,
    options: { maxPosts?: number; forceRefresh?: boolean } = {}
  ): Promise<{
    success: boolean;
    accountSnapshot?: AccountAnalyticsSnapshot;
    posts?: PostAnalyticsRecord[];
    summary: AnalyticsSyncSummary;
    error?: string;
  }> {
    // 0. Single Flight Lock Check: If sync is already running for this user, await existing operation
    if (activeSyncLocks.has(userId)) {
      console.log(`[AnalyticsService] Sync already in-flight for user ${userId}. Joining existing promise.`);
      return activeSyncLocks.get(userId)!;
    }

    // Cache check: if synced recently (< 120s) and not forced, return cached snapshot immediately
    if (!options.forceRefresh) {
      const cachedSummary = memoryCache.syncStatus.get(userId)?.data;
      const cachedAccount = memoryCache.accountAnalytics.get(userId)?.data;
      const cachedPosts = memoryCache.postAnalytics.get(userId)?.data;
      if (cachedSummary && cachedAccount && cachedSummary.lastSyncedAt) {
        const ageMs = Date.now() - new Date(cachedSummary.lastSyncedAt).getTime();
        if (ageMs < 120 * 1000) {
          return {
            success: true,
            accountSnapshot: cachedAccount,
            posts: cachedPosts || [],
            summary: cachedSummary
          };
        }
      }
    }

    const syncPromise = (async () => {
      const startTime = Date.now();

      // 1. Verify User & Token
      const userAuth = await getUserConnectionWithToken(userId);
      if (!userAuth) {
        const errorMsg = "No connected Threads account found for this user. Please connect your Threads account.";
        return {
          success: false,
          summary: {
            userId,
            threadsUserId: "",
            threadsUsername: "",
            status: "error" as const,
            lastSyncedAt: undefined as any,
            accountMetricsSynced: false,
            postsSyncedCount: 0,
            postsDiscoveredCount: 0,
            hasInsightsPermission: false,
            error: errorMsg
          },
          error: errorMsg
        };
      }

      const { token, threadsUserId, threadsUsername } = userAuth;

      // 2. Check Insights Permission via live probe
      const permStatus = await checkInsightsPermission(token, threadsUserId, userId);
      if (!permStatus.hasInsights) {
        const metaCode = permStatus.diagnosticError?.code ? ` (#${permStatus.diagnosticError.code})` : "";
        const metaMsg = permStatus.diagnosticError?.message || "Application does not have the 'threads_manage_insights' permission";
        const permError = `Meta rejected Insights access (HTTP ${permStatus.diagnosticError?.status || 403}${metaCode}: ${metaMsg}). Please grant the 'threads_manage_insights' permission.`;
        
        const errorSummary: AnalyticsSyncSummary = {
          userId,
          threadsUserId,
          threadsUsername,
          status: "error",
          lastSyncedAt: undefined as any,
          accountMetricsSynced: false,
          postsSyncedCount: 0,
          postsDiscoveredCount: 0,
          hasInsightsPermission: false,
          error: permError
        };
        await writeDocument("analytics_sync_state", userId, errorSummary);

        return {
          success: false,
          summary: errorSummary,
          error: permError
        };
      }

      // Update status to syncing
      await writeDocument("analytics_sync_state", userId, {
        userId,
        threadsUserId,
        threadsUsername,
        status: "syncing",
        hasInsightsPermission: true
      });

      try {
        // 3. Fetch Account-Level Insights for 1D, 7D, and 30D rolling windows in parallel
        const nowSec = Math.floor(Date.now() / 1000);
        const targetEndpoint = (threadsUserId && threadsUserId !== "me" && threadsUserId !== "unknown" && threadsUserId !== "anonymous" && /^\d+$/.test(threadsUserId)) 
          ? threadsUserId 
          : "me";

        const accountMetricsQuery = "views,likes,replies,reposts,quotes,followers_count";
        const fallbackMetricsQuery = "views,likes,replies,reposts,quotes";

        const fetchWindowInsights = async (sinceSec: number, untilSec: number) => {
          const primaryUrl = `https://graph.threads.net/v1.0/${targetEndpoint}/threads_insights?metric=${accountMetricsQuery}&since=${sinceSec}&until=${untilSec}&access_token=${encodeURIComponent(token)}`;
          let res = await fetch(primaryUrl);
          if (res.ok) {
            return await res.json();
          }
          // Fallback query if followers_count is restricted
          const fallbackUrl = `https://graph.threads.net/v1.0/${targetEndpoint}/threads_insights?metric=${fallbackMetricsQuery}&since=${sinceSec}&until=${untilSec}&access_token=${encodeURIComponent(token)}`;
          res = await fetch(fallbackUrl);
          if (res.ok) {
            return await res.json();
          }
          const errJson = await res.json().catch(() => ({}));
          logMetaApiError("syncUserAnalytics.fetchWindowInsights", userId, threadsUserId, `/${targetEndpoint}/threads_insights`, res.status, errJson, accountMetricsQuery);
          return null;
        };

        const [raw1D, raw7D, raw30D] = await Promise.all([
          fetchWindowInsights(nowSec - 86400, nowSec),
          fetchWindowInsights(nowSec - 7 * 86400, nowSec),
          fetchWindowInsights(nowSec - 30 * 86400, nowSec)
        ]);

        const rawMultiWindowPayload = {
          "1d": raw1D,
          "7d": raw7D,
          "30d": raw30D
        };

        // Retrieve previous snapshot to merge daily history
        const previousSnapshot = await getAccountAnalytics(userId);

        // Normalize Account Insights across all three timeframes
        const accountSnapshot = normalizeAccountInsights(
          rawMultiWindowPayload,
          userId,
          threadsUserId,
          threadsUsername,
          previousSnapshot
        );

        // 4. Timeframe-Aware & Paginated Media Discovery
        // Fetch up to 35 days of posts or 150 posts, following cursors naturally
        let mediaItems: any[] = [];
        let currentMediaUrl: string | null = `https://graph.threads.net/v1.0/me/threads?fields=id,media_product_type,media_type,text,permalink,timestamp,shortcode,is_quote_post&limit=50&access_token=${encodeURIComponent(token)}`;
        let pagesFetched = 0;
        const maxPages = 10; // Supports up to 500 posts discovery
        const cutoffTime = Date.now() - 35 * 86400000; // 35 days ago

        while (currentMediaUrl && pagesFetched < maxPages) {
          pagesFetched++;
          const mediaRes = await fetch(currentMediaUrl);
          if (mediaRes.ok) {
            const mediaJson: any = await mediaRes.json();
            const pageData = Array.isArray(mediaJson.data) ? mediaJson.data : [];
            mediaItems.push(...pageData);

            // Check timestamp of the oldest item on this page
            let oldestOnPage = pageData.length > 0 ? new Date(pageData[pageData.length - 1].timestamp).getTime() : 0;
            if (mediaJson.paging?.next && pageData.length > 0 && (oldestOnPage >= cutoffTime || mediaItems.length < 50)) {
              currentMediaUrl = mediaJson.paging.next;
            } else {
              currentMediaUrl = null;
            }
          } else {
            const errJson = await mediaRes.json().catch(() => ({}));
            logMetaApiError("syncUserAnalytics.userMedia", userId, threadsUserId, "/me/threads", mediaRes.status, errJson);
            currentMediaUrl = null;
          }
        }

        // Fetch user's local Content Library posts for Content Memory cross-referencing
        const userLibraryPosts = await getUserLibraryPosts(userId);

        // Check existing cached posts to track reconciliation statistics
        const existingPostsResult = await getPostAnalytics({ userId, limit: 1000 });
        const existingPostsMap = new Map<string, PostAnalyticsRecord>(
          existingPostsResult.posts.map(p => [p.mediaId, p])
        );

        let alreadyKnownCount = 0;
        let newlyImportedCount = 0;
        let earliestPostDate: string | undefined = undefined;

        if (mediaItems.length > 0) {
          const sortedDates = mediaItems
            .map(m => m.timestamp)
            .filter(Boolean)
            .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
          if (sortedDates.length > 0) {
            earliestPostDate = sortedDates[0];
          }
        }

        // 5. Fetch Post-Level Insights for active posts concurrently in chunks of 8
        const normalizedPosts: PostAnalyticsRecord[] = [];
        const postMetricsQuery = "views,likes,replies,reposts,quotes";
        const docsToWrite: { collection: string; id: string; data: any }[] = [];

        // Limit individual insight calls to the most active posts (up to 80 recent posts)
        const postsToQuery = mediaItems.slice(0, 80);
        const CONCURRENCY = 8;

        for (let i = 0; i < postsToQuery.length; i += CONCURRENCY) {
          const chunk = postsToQuery.slice(i, i + CONCURRENCY);
          const chunkResults = await Promise.all(
            chunk.map(async (item) => {
              if (!item.id) return null;
              if (existingPostsMap.has(item.id)) {
                alreadyKnownCount++;
              } else {
                newlyImportedCount++;
              }

              let rawPostInsights: any = null;
              try {
                const postInsightsUrl = `https://graph.threads.net/v1.0/${item.id}/insights?metric=${postMetricsQuery}&access_token=${encodeURIComponent(token)}`;
                const postInsightsRes = await fetch(postInsightsUrl);
                if (postInsightsRes.ok) {
                  rawPostInsights = await postInsightsRes.json();
                } else {
                  const errJson = await postInsightsRes.json().catch(() => ({}));
                  logMetaApiError("syncUserAnalytics.postInsights", userId, threadsUserId, `/${item.id}/insights`, postInsightsRes.status, errJson, postMetricsQuery);
                }
              } catch (postErr) {
                console.warn(`[AnalyticsService] Error fetching post insights for ${item.id}:`, postErr);
              }

              const matchedPost = matchContentPost(item, userLibraryPosts);
              const postRecord = normalizePostInsights(
                rawPostInsights,
                item,
                userId,
                threadsUserId,
                threadsUsername,
                matchedPost
              );

              return postRecord;
            })
          );

          for (const postRecord of chunkResults) {
            if (postRecord) {
              normalizedPosts.push(postRecord);
              docsToWrite.push({
                collection: "analytics_posts",
                id: postRecord.id,
                data: postRecord
              });
            }
          }
        }

        // Also normalize remaining discovered posts (without separate insights calls)
        if (mediaItems.length > postsToQuery.length) {
          for (let j = postsToQuery.length; j < mediaItems.length; j++) {
            const item = mediaItems[j];
            if (!item.id) continue;
            const matchedPost = matchContentPost(item, userLibraryPosts);
            const postRecord = normalizePostInsights(null, item, userId, threadsUserId, threadsUsername, matchedPost);
            normalizedPosts.push(postRecord);
            docsToWrite.push({
              collection: "analytics_posts",
              id: postRecord.id,
              data: postRecord
            });
          }
        }

        // 6. Record Sync Completion Summary
        const syncSummary: AnalyticsSyncSummary = {
          userId,
          threadsUserId,
          threadsUsername,
          status: "success",
          lastSyncedAt: new Date().toISOString(),
          accountMetricsSynced: Boolean(raw1D || raw7D || raw30D),
          postsSyncedCount: normalizedPosts.length,
          postsDiscoveredCount: mediaItems.length,
          historicalPostsDiscovered: mediaItems.length,
          alreadyKnownCount,
          newlyImportedCount,
          earliestPostDate,
          hasInsightsPermission: true,
          error: null,
          syncDurationMs: Date.now() - startTime
        };

        // Prepare Account & Sync State Docs for Batched Commit
        const todayDateKey = new Date().toISOString().split("T")[0];
        docsToWrite.push(
          { collection: "analytics_account", id: userId, data: accountSnapshot },
          { collection: "analytics_account", id: `${userId}_${todayDateKey}`, data: { ...accountSnapshot, id: `${userId}_${todayDateKey}`, snapshotDate: todayDateKey } },
          { collection: "analytics_sync_state", id: userId, data: syncSummary }
        );

        // Commit all changes in batched Firestore operations
        await writeDocumentsBatch(docsToWrite);

        // Update in-memory lists
        memoryCache.accountAnalytics.set(userId, { data: accountSnapshot, timestamp: Date.now() });
        memoryCache.postAnalytics.set(userId, { data: normalizedPosts, timestamp: Date.now() });
        memoryCache.syncStatus.set(userId, { data: syncSummary, timestamp: Date.now() });

        // Update compact Generation Intelligence Snapshot with fresh analytics intelligence
        try {
          const signals = selectVerifiedPerformanceSignals(normalizedPosts);
          if (signals.sampleSize > 0) {
            await updateGenerationIntelligenceSnapshot(serverDb, userId, undefined, {
              topPerformingTopics: signals.topics,
              topPerformingStructures: signals.formats,
              performanceInsights: {
                topPillars: signals.pillars,
                topFormats: signals.formats,
                topAngles: [],
                observations: [`Ranked by verified views across ${signals.sampleSize} mature posts; descriptive, not predictive.`]
              }
            });
          }
        } catch (_) {}

        console.log(`[AnalyticsService] Sync completed for ${userId} (${threadsUsername}): ${normalizedPosts.length} posts tracked in ${Date.now() - startTime}ms.`);

        return {
          success: true,
          accountSnapshot,
          posts: normalizedPosts,
          summary: syncSummary
        };
      } catch (syncErr: any) {
        console.error("[AnalyticsService] Synchronization error:", syncErr);
        const errorSummary: AnalyticsSyncSummary = {
          userId,
          threadsUserId,
          threadsUsername,
          status: "error",
          lastSyncedAt: undefined as any,
          accountMetricsSynced: false,
          postsSyncedCount: 0,
          postsDiscoveredCount: 0,
          hasInsightsPermission: false,
          error: syncErr.message || "Failed to complete Threads analytics synchronization."
        };
        await writeDocument("analytics_sync_state", userId, errorSummary);

        return {
          success: false,
          summary: errorSummary,
          error: syncErr.message
        };
      }
    })();

    // Store in-flight promise and cleanup upon completion
    activeSyncLocks.set(userId, syncPromise);
    try {
      return await syncPromise;
    } finally {
      activeSyncLocks.delete(userId);
    }
  }

  /**
   * Retrieves stored Account Analytics for a verified user with optional timeframe selection.
   */
  async function getAccountAnalytics(
    userId: string,
    window?: "1d" | "7d" | "30d"
  ): Promise<AccountAnalyticsSnapshot | null> {
    if (!userId) return null;

    let snapshot: AccountAnalyticsSnapshot | null = null;

    // Check memory cache first
    const cached = memoryCache.accountAnalytics.get(userId);
    if (cached && (Date.now() - cached.timestamp < 5 * 60 * 1000 || Date.now() < quotaCooldownUntil)) {
      snapshot = cached.data;
    }

    if (!snapshot && serverDb && Date.now() >= quotaCooldownUntil) {
      try {
        const snap = await serverDb.collection("analytics_account").doc(String(userId)).get();
        if (snap.exists) {
          snapshot = snap.data() as AccountAnalyticsSnapshot;
          memoryCache.accountAnalytics.set(userId, { data: snapshot, timestamp: Date.now() });
        }
      } catch (err: any) {
        if (isFirestoreQuotaError(err)) {
          markQuotaExhausted("getAccountAnalytics", err);
        } else {
          console.log(`[AnalyticsService] Admin SDK reading account analytics note:`, err?.message || err);
        }
      }
    }

    if (!snapshot && cached) {
      snapshot = cached.data;
    }

    if (!snapshot) return null;

    // If a specific window is requested and exists in snapshot.windows, adapt the active metrics
    if (window && snapshot.windows && snapshot.windows[window]) {
      const winMetrics = snapshot.windows[window];
      return {
        ...snapshot,
        selectedWindow: window,
        period: window,
        metrics: {
          views: winMetrics.views,
          likes: winMetrics.likes,
          replies: winMetrics.replies,
          reposts: winMetrics.reposts,
          quotes: winMetrics.quotes,
          followersCount: winMetrics.followersCount
        },
        derivedMetrics: {
          totalEngagements: winMetrics.totalEngagements,
          engagementRateOnViews: winMetrics.engagementRateOnViews,
          followerGrowth: winMetrics.followerGrowth,
          isCollectingHistory: winMetrics.isCollectingHistory,
          statusMessage: winMetrics.statusMessage
        }
      };
    }

    return snapshot;
  }

  /**
   * Retrieves, filters, and sorts stored Post Analytics for a verified user.
   */
  async function getPostAnalytics(options: PostAnalyticsFilterOptions): Promise<{
    posts: PostAnalyticsRecord[];
    total: number;
  }> {
    const { userId, limit = 50, offset = 0, sortBy = "publishedAt", sortDirection = "desc" } = options;
    if (!userId) return { posts: [], total: 0 };

    let allPosts: PostAnalyticsRecord[] = [];

    // Check memory cache
    const cached = memoryCache.postAnalytics.get(userId);
    if (cached && (Date.now() - cached.timestamp < 5 * 60 * 1000 || Date.now() < quotaCooldownUntil)) {
      allPosts = [...cached.data];
    } else if (serverDb && Date.now() >= quotaCooldownUntil) {
      try {
        const snap = await serverDb.collection("analytics_posts").where("userId", "==", userId).limit(Math.min(limit, 100)).get();
        snap.forEach((d: any) => allPosts.push(d.data() as PostAnalyticsRecord));
        memoryCache.postAnalytics.set(userId, { data: allPosts, timestamp: Date.now() });
      } catch (err: any) {
        if (isFirestoreQuotaError(err)) {
          markQuotaExhausted("getPostAnalytics", err);
          if (cached) allPosts = [...cached.data];
        } else {
          console.log(`[AnalyticsService] Admin SDK fetching analytics posts note:`, err?.message || err);
        }
      }
    } else if (cached) {
      allPosts = [...cached.data];
    }

    // Apply optional filters
    if (options.topic) {
      const topicLower = options.topic.toLowerCase();
      allPosts = allPosts.filter((p) => p.contentMemoryContext?.topic?.toLowerCase().includes(topicLower));
    }
    if (options.pillarTitle) {
      const pillarLower = options.pillarTitle.toLowerCase();
      allPosts = allPosts.filter((p) => p.contentMemoryContext?.pillarTitle?.toLowerCase().includes(pillarLower));
    }
    if (options.mediaType) {
      allPosts = allPosts.filter((p) => p.mediaType === options.mediaType);
    }
    if (options.since) {
      allPosts = allPosts.filter((p) => new Date(p.publishedAt) >= new Date(options.since!));
    }
    if (options.until) {
      allPosts = allPosts.filter((p) => new Date(p.publishedAt) <= new Date(options.until!));
    }

    // Apply Sorting
    allPosts.sort((a, b) => {
      let valA: any;
      let valB: any;

      if (sortBy === "views") {
        valA = a.metrics.views;
        valB = b.metrics.views;
      } else if (sortBy === "likes") {
        valA = a.metrics.likes;
        valB = b.metrics.likes;
      } else if (sortBy === "replies") {
        valA = a.metrics.replies;
        valB = b.metrics.replies;
      } else if (sortBy === "reposts") {
        valA = a.metrics.reposts;
        valB = b.metrics.reposts;
      } else if (sortBy === "quotes") {
        valA = a.metrics.quotes;
        valB = b.metrics.quotes;
      } else if (sortBy === "engagementRate") {
        valA = a.derivedMetrics.engagementRate;
        valB = b.derivedMetrics.engagementRate;
      } else {
        valA = new Date(a.publishedAt).getTime();
        valB = new Date(b.publishedAt).getTime();
      }

      if (sortDirection === "asc") {
        return valA > valB ? 1 : -1;
      } else {
        return valA < valB ? 1 : -1;
      }
    });

    const total = allPosts.length;
    const paginated = allPosts.slice(offset, offset + limit);

    return { posts: paginated, total };
  }

  /**
   * Retrieves single Post Analytics record by media ID.
   */
  async function getSinglePostAnalytics(userId: string, mediaId: string): Promise<PostAnalyticsRecord | null> {
    if (!userId || !mediaId) return null;
    const docId = `${userId}_${mediaId}`;

    const cached = memoryCache.singlePosts.get(docId);
    if (cached && (Date.now() - cached.timestamp < 5 * 60 * 1000 || Date.now() < quotaCooldownUntil)) {
      return cached.data;
    }

    if (serverDb && Date.now() >= quotaCooldownUntil) {
      try {
        const snap = await serverDb.collection("analytics_posts").doc(docId).get();
        if (snap.exists) {
          const data = snap.data() as PostAnalyticsRecord;
          memoryCache.singlePosts.set(docId, { data, timestamp: Date.now() });
          return data;
        }
      } catch (err: any) {
        if (isFirestoreQuotaError(err)) {
          markQuotaExhausted("getSinglePostAnalytics", err);
        } else {
          console.log(`[AnalyticsService] Admin SDK reading post analytics note:`, err?.message || err);
        }
      }
    }

    return cached?.data || null;
  }

  /**
   * Retrieves Sync Status for a user.
   */
  async function getAnalyticsSyncStatus(userId: string): Promise<AnalyticsSyncSummary | null> {
    if (!userId) return null;

    const cached = memoryCache.syncStatus.get(userId);
    if (cached && (Date.now() - cached.timestamp < 5 * 60 * 1000 || Date.now() < quotaCooldownUntil)) {
      return cached.data;
    }

    if (serverDb && Date.now() >= quotaCooldownUntil) {
      try {
        const snap = await serverDb.collection("analytics_sync_state").doc(String(userId)).get();
        if (snap.exists) {
          const data = snap.data() as AnalyticsSyncSummary;
          memoryCache.syncStatus.set(userId, { data, timestamp: Date.now() });
          return data;
        }
      } catch (err: any) {
        if (isFirestoreQuotaError(err)) {
          markQuotaExhausted("getAnalyticsSyncStatus", err);
        } else {
          console.log(`[AnalyticsService] Admin SDK reading sync status note:`, err?.message || err);
        }
      }
    }

    if (cached) {
      return cached.data;
    }

    return null;
  }

  /**
   * Directly ingests a post published through ThreadsWorks (immediate or scheduled).
   * Immediately records the post in analytics_posts and memory context.
   */
  async function ingestPublishedPost(
    userId: string,
    payload: {
      mediaId: string;
      publishedIds?: string[];
      permalink?: string;
      text: string;
      publishedAt?: string;
      source?: string;
    }
  ): Promise<PostAnalyticsRecord> {
    const userAuth = await getUserConnectionWithToken(userId);
    const threadsUserId = userAuth?.threadsUserId || "me";
    const threadsUsername = userAuth?.threadsUsername || "";
    const mediaId = payload.mediaId || (payload.publishedIds && payload.publishedIds[0]) || `tw_${Date.now()}`;

    const userLibraryPosts = await getUserLibraryPosts(userId);
    const fakeMediaItem = {
      id: mediaId,
      text: payload.text,
      permalink: payload.permalink || `https://threads.net/@${threadsUsername || "user"}/post/${mediaId}`,
      media_type: "TEXT_POST",
      timestamp: payload.publishedAt || new Date().toISOString()
    };

    const matchedPost = matchContentPost(fakeMediaItem, userLibraryPosts);

    const postRecord = normalizePostInsights(
      null,
      fakeMediaItem,
      userId,
      threadsUserId,
      threadsUsername,
      matchedPost
    );

    await writeDocument("analytics_posts", postRecord.id, postRecord);

    memoryCache.singlePosts.set(postRecord.id, { data: postRecord, timestamp: Date.now() });

    return postRecord;
  }

  return {
    syncUserAnalytics,
    getAccountAnalytics,
    getPostAnalytics,
    getSinglePostAnalytics,
    getAnalyticsSyncStatus,
    checkInsightsPermission,
    ingestPublishedPost
  };
}

