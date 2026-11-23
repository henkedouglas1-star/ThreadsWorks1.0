/**
 * ThreadsWorks Content Performance Intelligence - Types & Data Models
 * Defines normalized models for analyzing the relationship between:
 * CONTENT -> STRATEGY -> PERFORMANCE
 */

import { PostAnalyticsRecord, PostContentMemoryContext } from "./analytics";

export type PerformanceDimension = 
  | "pillar"
  | "format"
  | "angle"
  | "topic"
  | "cta"
  | "mediaType";

export type SampleSizeConfidence = 
  | "insufficient" // 1 post
  | "limited"      // 2 - 4 posts
  | "usable"       // 5 - 9 posts
  | "strong";      // 10+ posts

export type PerformanceTier = 
  | "significantly_above"  // > 2.0x median
  | "above"                // 1.25x - 2.0x median
  | "near"                 // 0.75x - 1.25x median
  | "below"                // 0.40x - 0.75x median
  | "significantly_below"; // < 0.40x median

/**
 * Creator's personal historical performance baseline
 * Used as the reference benchmark instead of arbitrary global metrics.
 */
export interface CreatorPerformanceBaseline {
  userId: string;
  period: "7d" | "14d" | "30d" | "90d" | "all";
  totalPostsSampled: number;
  postsWithMemoryContext: number;
  confidence: SampleSizeConfidence;
  
  // Views Distribution
  medianViews: number;
  averageViews: number;
  minViews: number;
  maxViews: number;
  p25Views: number;
  p75Views: number;
  recencyWeightedMedianViews?: number;

  // Maturation Breakdown
  maturePostsBaseline?: {
    medianViews: number;
    medianInteractions: number;
    medianEngagementRate: number;
    sampleSize: number;
  };
  maturationBreakdown?: {
    matureCount: number;
    maturingCount: number;
  };

  // Objective Specific Reference Baselines
  objectiveBaselines?: {
    reachMedianViews: number;
    engagementMedianRate: number;
    conversationMedianReplies: number;
    actionMedianQuotes: number;
  };
  
  // Engagement Distribution
  medianEngagementRate: number; // percentage
  averageEngagementRate: number;
  medianInteractions: number;
  averageInteractions: number;

  // Breakdown of averages
  averageLikes: number;
  averageReplies: number;
  averageReposts: number;
  averageQuotes: number;

  calculatedAt: string;
}

/**
 * Statistical aggregate for a specific strategic dimension key
 * (e.g. a specific Pillar, Format, Strategic Angle, Topic, or CTA)
 */
export interface DimensionAggregate {
  dimension: PerformanceDimension;
  dimensionLabel: string;
  key: string;
  displayName: string;
  postCount: number;
  sampleSizeConfidence: SampleSizeConfidence;
  
  // Volume & Metrics
  totalViews: number;
  averageViews: number;
  medianViews: number;
  minViews: number;
  maxViews: number;

  totalInteractions: number;
  averageInteractions: number;
  medianInteractions: number;
  
  averageLikes: number;
  averageReplies: number;
  averageReposts: number;
  averageQuotes: number;

  averageEngagementRate: number;
  medianEngagementRate: number;

  // Relative comparison to creator's personal baseline
  comparisonToBaseline: {
    viewsVsBaselineRatio: number;      // e.g. 1.28 (28% above)
    viewsVsBaselineDiffPercent: number; // e.g. +28.0%
    engagementRateDiff: number;        // e.g. +0.45%
    tier: PerformanceTier;
    factualStatement: string;          // Factual description based on actual evidence
  };

  // Top and bottom representative posts
  topPost?: {
    id: string;
    mediaId: string;
    text: string;
    views: number;
    engagementRate: number;
    publishedAt: string;
    permalink: string;
  };
  lowestPost?: {
    id: string;
    mediaId: string;
    text: string;
    views: number;
    engagementRate: number;
    publishedAt: string;
    permalink: string;
  };
}

/**
 * Multi-dimensional combination aggregate
 * (e.g. Content Pillar + Format, or Strategic Angle + Format)
 */
export interface CombinationAggregate {
  id: string;
  primaryDimension: PerformanceDimension;
  primaryKey: string;
  primaryLabel: string;
  secondaryDimension: PerformanceDimension;
  secondaryKey: string;
  secondaryLabel: string;
  postCount: number;
  sampleSizeConfidence: SampleSizeConfidence;
  
  medianViews: number;
  averageViews: number;
  medianEngagementRate: number;
  averageEngagementRate: number;
  
  viewsVsBaselineDiffPercent: number;
  tier: PerformanceTier;
  factualStatement: string;
}

/**
 * Historical Post Outlier classified against the creator's baseline
 */
export interface PerformanceOutlier {
  post: PostAnalyticsRecord;
  classification: "significantly_above_baseline" | "above_baseline" | "below_baseline" | "significantly_below_baseline";
  primaryMetric: "views" | "engagementRate";
  metricValue: number;
  creatorBaselineValue: number;
  deviationRatio: number;
  factualSummary: string;
  strategicContext?: PostContentMemoryContext;
}

/**
 * Factual strategic observation derived from actual data
 */
export interface StrategicObservation {
  id: string;
  category: "dimension_pattern" | "combination_pattern" | "outlier_observation" | "sample_size_guidance";
  dimension?: PerformanceDimension;
  title: string;
  statement: string; // Strictly non-causative factual observation
  sampleSize: number;
  confidence: SampleSizeConfidence;
  supportingData?: {
    keyName?: string;
    medianValue?: number;
    baselineValue?: number;
    differencePercent?: number;
  };
}

/**
 * Full Performance Intelligence Summary Payload
 */
export interface ContentPerformanceIntelligenceSummary {
  userId: string;
  period: "7d" | "14d" | "30d" | "90d" | "all";
  generatedAt: string;
  totalPostsAnalyzed: number;
  totalPostsWithMemoryContext: number;
  
  baseline: CreatorPerformanceBaseline;
  dimensionAggregates: {
    pillar: DimensionAggregate[];
    format: DimensionAggregate[];
    angle: DimensionAggregate[];
    topic: DimensionAggregate[];
    cta: DimensionAggregate[];
    mediaType: DimensionAggregate[];
  };
  topCombinations: CombinationAggregate[];
  topPerformingCombinations?: Array<{
    ratioToBaseline: number;
    hookPattern: string;
    anglePattern: string;
    formatPattern: string;
  }>;
  emergingCombinations?: Array<{
    ratioToBaseline: number;
    hookPattern: string;
    anglePattern: string;
    formatPattern: string;
  }>;
  dimensionalAggregates?: {
    hooks?: DimensionAggregate[];
    angles?: DimensionAggregate[];
    formats?: DimensionAggregate[];
  };
  winningPatterns?: any[];
  weakPatterns?: Array<{
    attributeType: "hook" | "angle" | "format" | "topic" | "cta";
    patternKey: string;
    sampleSize: number;
    ratioToBaseline: number;
    factualStatement: string;
  }>;
  patternFatigueSignals?: Array<{
    patternKey: string;
    dimension: string;
    recentMedianViews: number;
    olderMedianViews: number;
    declinePercent: number;
    factualStatement: string;
  }>;
  historicalCoverage?: {
    discoveredTotal: number;
    alreadyKnown: number;
    newlyImported: number;
    earliestPostDate?: string;
    metricsAvailableCount: number;
    limitationsNoted?: string;
  };
  outliers: PerformanceOutlier[];
  observations: StrategicObservation[];
  
  // Status flags
  hasSufficientData: boolean;
  emptyStateReason?: string;
}

/**
 * Context comparison for a single individual post against creator baseline and cohorts
 */
export interface SinglePostIntelligenceContext {
  post: PostAnalyticsRecord;
  baseline: CreatorPerformanceBaseline;
  performanceTier: PerformanceTier;
  viewsVsBaselineRatio: number;
  viewsVsBaselineDiffPercent: number;
  engagementRateVsBaselineDiff: number;
  factualStatement: string;
  cohortComparisons: {
    pillarCohort?: { name: string; cohortMedianViews: number; sampleSize: number };
    formatCohort?: { name: string; cohortMedianViews: number; sampleSize: number };
    angleCohort?: { name: string; cohortMedianViews: number; sampleSize: number };
  };
}
