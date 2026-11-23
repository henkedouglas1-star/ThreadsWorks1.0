/**
 * ThreadsWorks Analytics Data Layer - Types & Models
 * Defines normalized internal data structures for Meta Threads Account and Post Insights.
 */

export interface RawMetaMetricValue {
  value: number;
  end_time?: string;
}

export interface RawMetaInsightMetric {
  name: string;
  period: string;
  values: RawMetaMetricValue[];
  title?: string;
  description?: string;
  id?: string;
}

export interface RawMetaInsightsResponse {
  data: RawMetaInsightMetric[];
  paging?: {
    previous?: string;
    next?: string;
  };
}

export interface RawMetaMediaItem {
  id: string;
  media_product_type?: string;
  media_type?: string;
  text?: string;
  permalink?: string;
  timestamp?: string;
  shortcode?: string;
  is_quote_post?: boolean;
}

export interface RawMetaMediaResponse {
  data: RawMetaMediaItem[];
  paging?: {
    cursors?: {
      before?: string;
      after?: string;
    };
    next?: string;
  };
}

/**
 * Normalized Account Metric point in time
 */
export interface AccountTimeSeriesPoint {
  metric: "views" | "likes" | "replies" | "reposts" | "quotes" | "followers_count" | string;
  value: number;
  period: string;
  endTime?: string;
  dateKey: string; // YYYY-MM-DD
}

/**
 * Metric set for a specific rolling timeframe (1D, 7D, 30D)
 */
export interface AccountTimeframeMetrics {
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  followersCount: number;
  totalEngagements: number;
  engagementRateOnViews: number;
  followerGrowth?: number;
  isCollectingHistory?: boolean;
  statusMessage?: string;
}

/**
 * Normalized Account Analytics Data Model
 */
export interface AccountAnalyticsSnapshot {
  id: string; // userId or userId_date
  userId: string;
  threadsUserId: string;
  threadsUsername: string;
  source: "meta_threads_api";
  period: string;
  lastSyncedAt: string;
  selectedWindow?: "1d" | "7d" | "30d";
  windows?: {
    "1d": AccountTimeframeMetrics;
    "7d": AccountTimeframeMetrics;
    "30d": AccountTimeframeMetrics;
  };
  metrics: {
    views: number;
    likes: number;
    replies: number;
    reposts: number;
    quotes: number;
    followersCount: number;
  };
  derivedMetrics: {
    totalEngagements: number; // likes + replies + reposts + quotes
    engagementRateOnViews: number; // (totalEngagements / views) * 100
    followerGrowth?: number;
    isCollectingHistory?: boolean;
    statusMessage?: string;
  };
  timeSeries: AccountTimeSeriesPoint[];
  dailySnapshots?: Record<string, {
    views?: number;
    likes?: number;
    replies?: number;
    reposts?: number;
    quotes?: number;
    followersCount?: number;
    recordedAt: string;
  }>;
}

/**
 * Content Memory performance context linking posts to strategic metadata
 */
export interface PostContentMemoryContext {
  hook: string;
  topic?: string;
  format?: string;
  pillarTitle?: string;
  strategicAngle?: string;
  contentType?: string;
  cta?: string;
  offerRelationship?: string;
  targetBuyer?: string;
  strategicReason?: string;
  partCount?: number;
  sentencesPerPart?: number;
  recommendedLength?: string;
  structuralPacingGuidance?: string;
}

/**
 * Normalized Post Analytics Data Model
 */
export interface PostAnalyticsRecord {
  id: string; // Deterministic: `${userId}_${mediaId}`
  userId: string;
  threadsUserId: string;
  threadsUsername?: string;
  mediaId: string;
  text: string;
  permalink: string;
  mediaType: string;
  publishedAt: string;
  period: "lifetime";
  lastSyncedAt: string;
  metrics: {
    views: number;
    likes: number;
    replies: number;
    reposts: number;
    quotes: number;
  };
  metricsAvailable?: boolean;
  observationAgeHours?: number;
  maturationStatus?: "maturing" | "mature";
  isHistoricalImport?: boolean;
  derivedMetrics: {
    totalInteractions: number; // likes + replies + reposts + quotes
    engagementRate: number; // (totalInteractions / views) * 100 if views > 0
  };
  matchedContentPostId?: string | null;
  contentMemoryContext?: PostContentMemoryContext;
}

/**
 * Analytics Synchronization Status & Summary
 */
export interface AnalyticsSyncSummary {
  userId: string;
  threadsUserId: string;
  threadsUsername: string;
  status: "idle" | "syncing" | "success" | "partial" | "error";
  lastSyncedAt: string;
  accountMetricsSynced: boolean;
  postsSyncedCount: number;
  postsDiscoveredCount: number;
  historicalPostsDiscovered?: number;
  alreadyKnownCount?: number;
  newlyImportedCount?: number;
  earliestPostDate?: string;
  hasInsightsPermission: boolean;
  error?: string | null;
  syncDurationMs?: number;
}

/**
 * Query filters for post analytics
 */
export interface PostAnalyticsFilterOptions {
  userId: string;
  limit?: number;
  offset?: number;
  sortBy?: "views" | "likes" | "replies" | "reposts" | "quotes" | "engagementRate" | "publishedAt";
  sortDirection?: "asc" | "desc";
  since?: string;
  until?: string;
  topic?: string;
  pillarTitle?: string;
  mediaType?: string;
}

export * from './intelligence';
export * from './recommendations';
