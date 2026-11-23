/**
 * Server-Side Content Performance Intelligence Service
 * Analyzes the relationship between: CONTENT -> STRATEGY -> PERFORMANCE
 * Computes creator baselines, dimensional aggregations, combination patterns, and outliers.
 */

import {
  PostAnalyticsRecord,
  AccountAnalyticsSnapshot,
  PostContentMemoryContext
} from "../src/types/analytics";

import {
  PerformanceDimension,
  SampleSizeConfidence,
  PerformanceTier,
  CreatorPerformanceBaseline,
  DimensionAggregate,
  CombinationAggregate,
  PerformanceOutlier,
  StrategicObservation,
  ContentPerformanceIntelligenceSummary,
  SinglePostIntelligenceContext
} from "../src/types/intelligence";

/**
 * In-memory TTL cache for expensive statistical aggregations
 */
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}
const intelligenceCache = new Map<string, CacheEntry<ContentPerformanceIntelligenceSummary>>();

// 60-second TTL
const INTELLIGENCE_CACHE_TTL_MS = 60 * 1000;

export function getCachedIntelligence(key: string): ContentPerformanceIntelligenceSummary | null {
  const entry = intelligenceCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    intelligenceCache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCachedIntelligence(key: string, data: ContentPerformanceIntelligenceSummary): void {
  if (intelligenceCache.size > 100) {
    const oldestKey = intelligenceCache.keys().next().value;
    if (oldestKey) intelligenceCache.delete(oldestKey);
  }
  intelligenceCache.set(key, {
    data,
    expiresAt: Date.now() + INTELLIGENCE_CACHE_TTL_MS
  });
}

export function invalidateUserIntelligenceCache(userId: string): void {
  for (const key of intelligenceCache.keys()) {
    if (key.startsWith(`${userId}_`)) {
      intelligenceCache.delete(key);
    }
  }
}

/**
 * Statistical Helper: Calculate Median from numeric array
 */
export function calculateMedian(numbers: number[]): number {
  if (!numbers || numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(1));
  }
  return sorted[mid];
}

/**
 * Statistical Helper: Calculate Recency Weighted Median with exponential decay
 */
export function calculateRecencyWeightedMedian(postsList: PostAnalyticsRecord[]): number {
  if (postsList.length === 0) return 0;
  const now = Date.now();
  const weighted = postsList.map((p) => {
    const pubTime = new Date(p.publishedAt).getTime();
    const ageDays = Math.max(0, (now - (isNaN(pubTime) ? now : pubTime)) / (1000 * 3600 * 24));
    const weight = Math.exp(-ageDays / 30); // 30-day half life
    return { views: p.metrics?.views || 0, weight };
  });
  weighted.sort((a, b) => a.views - b.views);
  const totalWeight = weighted.reduce((acc, wp) => acc + wp.weight, 0);
  if (totalWeight === 0) return calculateMedian(postsList.map((p) => p.metrics?.views || 0));
  let cumulativeWeight = 0;
  for (const wp of weighted) {
    cumulativeWeight += wp.weight;
    if (cumulativeWeight >= totalWeight / 2) {
      return wp.views;
    }
  }
  return weighted[weighted.length - 1]?.views || 0;
}

/**
 * Identify Weak / Underperforming Content Patterns (Negative Evidence)
 */
export function identifyWeakPatterns(
  dimensionAggregates: {
    pillar: DimensionAggregate[];
    format: DimensionAggregate[];
    angle: DimensionAggregate[];
    topic: DimensionAggregate[];
    cta: DimensionAggregate[];
    mediaType: DimensionAggregate[];
  },
  baseline: CreatorPerformanceBaseline
): Array<{
  attributeType: "hook" | "angle" | "format" | "topic" | "cta";
  patternKey: string;
  sampleSize: number;
  ratioToBaseline: number;
  factualStatement: string;
}> {
  const weak: Array<{
    attributeType: "hook" | "angle" | "format" | "topic" | "cta";
    patternKey: string;
    sampleSize: number;
    ratioToBaseline: number;
    factualStatement: string;
  }> = [];

  const dimKeys: Array<["pillar" | "format" | "angle" | "topic" | "cta", "hook" | "angle" | "format" | "topic" | "cta"]> = [
    ["format", "format"],
    ["angle", "angle"],
    ["topic", "topic"],
    ["cta", "cta"]
  ];

  for (const [dimKey, attrType] of dimKeys) {
    const list = dimensionAggregates[dimKey] || [];
    for (const item of list) {
      if (item.postCount >= 2 && item.comparisonToBaseline.viewsVsBaselineRatio <= 0.70) {
        weak.push({
          attributeType: attrType,
          patternKey: item.key,
          sampleSize: item.postCount,
          ratioToBaseline: item.comparisonToBaseline.viewsVsBaselineRatio,
          factualStatement: `Posts using ${item.dimensionLabel} "${item.displayName}" perform ${((1 - item.comparisonToBaseline.viewsVsBaselineRatio) * 100).toFixed(1)}% below your historical baseline (median ${item.medianViews} views vs ${baseline.medianViews} baseline across ${item.postCount} posts).`
        });
      }
    }
  }

  return weak.sort((a, b) => a.ratioToBaseline - b.ratioToBaseline).slice(0, 5);
}

/**
 * Detect Pattern Fatigue / Saturation Signals
 */
export function detectPatternFatigue(
  posts: PostAnalyticsRecord[],
  baseline: CreatorPerformanceBaseline
): Array<{
  patternKey: string;
  dimension: string;
  recentMedianViews: number;
  olderMedianViews: number;
  declinePercent: number;
  factualStatement: string;
}> {
  const fatigueSignals: Array<{
    patternKey: string;
    dimension: string;
    recentMedianViews: number;
    olderMedianViews: number;
    declinePercent: number;
    factualStatement: string;
  }> = [];

  const groupMap = new Map<string, { dimension: string; key: string; posts: PostAnalyticsRecord[] }>();

  for (const p of posts) {
    const format = p.contentMemoryContext?.format;
    const angle = p.contentMemoryContext?.strategicAngle;

    if (format) {
      const k = `format_${format}`;
      if (!groupMap.has(k)) groupMap.set(k, { dimension: "Format", key: format, posts: [] });
      groupMap.get(k)!.posts.push(p);
    }
    if (angle) {
      const k = `angle_${angle}`;
      if (!groupMap.has(k)) groupMap.set(k, { dimension: "Strategic Angle", key: angle, posts: [] });
      groupMap.get(k)!.posts.push(p);
    }
  }

  for (const { dimension, key, posts: cohortPosts } of groupMap.values()) {
    if (cohortPosts.length >= 5) {
      const sorted = [...cohortPosts].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
      const recent3 = sorted.slice(0, 3);
      const older = sorted.slice(3);

      const recent3Median = calculateMedian(recent3.map((p) => p.metrics?.views || 0));
      const olderMedian = calculateMedian(older.map((p) => p.metrics?.views || 0));

      if (olderMedian >= 10 && recent3Median < olderMedian * 0.65) {
        const declinePercent = Number((((olderMedian - recent3Median) / olderMedian) * 100).toFixed(1));
        fatigueSignals.push({
          patternKey: key,
          dimension,
          recentMedianViews: recent3Median,
          olderMedianViews: olderMedian,
          declinePercent,
          factualStatement: `${dimension} "${key}" shows pattern fatigue: 3 most recent posts generated median ${recent3Median} views vs ${olderMedian} views in earlier posts (-${declinePercent}%).`
        });
      }
    }
  }

  return fatigueSignals;
}

/**
 * Statistical Helper: Calculate Percentile from numeric array
 */
export function calculatePercentile(numbers: number[], percentile: number): number {
  if (!numbers || numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  if (lower === upper) return sorted[lower];
  return Number((sorted[lower] * (1 - weight) + sorted[upper] * weight).toFixed(1));
}

/**
 * Sample Size Confidence Classifier
 * 1 -> Insufficient
 * 2 - 4 -> Limited
 * 5 - 9 -> Usable
 * 10+ -> Strong
 */
export function evaluateSampleSizeConfidence(sampleSize: number): SampleSizeConfidence {
  if (sampleSize <= 1) return "insufficient";
  if (sampleSize <= 4) return "limited";
  if (sampleSize <= 9) return "usable";
  return "strong";
}

/**
 * Relative Performance Tier Classifier against Baseline
 */
export function classifyPerformanceTier(ratioToBaseline: number): PerformanceTier {
  if (ratioToBaseline >= 2.0) return "significantly_above";
  if (ratioToBaseline >= 1.25) return "above";
  if (ratioToBaseline >= 0.75) return "near";
  if (ratioToBaseline >= 0.40) return "below";
  return "significantly_below";
}

/**
 * Factual description generator for comparison against baseline
 */
function buildFactualComparisonStatement(
  name: string,
  sampleSize: number,
  medianVal: number,
  avgVal: number,
  baselineMedian: number,
  diffPercent: number,
  rateDiff: number
): string {
  if (sampleSize === 1) {
    return `Single post observation (${medianVal} views, ${avgVal} average). Insufficient sample size to establish a reliable pattern.`;
  }

  const comparisonPhrase = diffPercent === 0 
    ? "aligns with your baseline"
    : diffPercent > 0 
      ? `+${diffPercent.toFixed(1)}% above your historical baseline`
      : `${diffPercent.toFixed(1)}% below your historical baseline`;

  if (sampleSize <= 4) {
    return `Based on ${sampleSize} posts: median ${medianVal} views (${comparisonPhrase}). Limited evidence.`;
  }

  if (sampleSize <= 9) {
    return `Posts using this attribute have historically generated a median of ${medianVal} views across ${sampleSize} posts (${comparisonPhrase}).`;
  }

  return `Across ${sampleSize} posts, this attribute has averaged ${avgVal.toFixed(0)} views (median ${medianVal}), performing ${comparisonPhrase}.`;
}

export interface PerformanceIntelligenceEngineDependencies {
  getPostAnalytics: (options: any) => Promise<{ posts: PostAnalyticsRecord[]; total: number }>;
  getAccountAnalytics: (userId: string) => Promise<AccountAnalyticsSnapshot | null>;
}

export function createPerformanceIntelligenceService(deps: PerformanceIntelligenceEngineDependencies) {
  const { getPostAnalytics, getAccountAnalytics } = deps;

  /**
   * Filter posts by time window
   */
  function filterPostsByPeriod(
    posts: PostAnalyticsRecord[],
    period: "7d" | "14d" | "30d" | "90d" | "all"
  ): PostAnalyticsRecord[] {
    if (period === "all") return posts;
    const now = Date.now();
    const daysMap = { "7d": 7, "14d": 14, "30d": 30, "90d": 90 };
    const cutoff = now - (daysMap[period] || 30) * 24 * 60 * 60 * 1000;
    return posts.filter((p) => {
      const pubTime = new Date(p.publishedAt).getTime();
      return !isNaN(pubTime) && pubTime >= cutoff;
    });
  }

  /**
   * Calculate Creator Baseline
   */
  function computeCreatorBaseline(
    userId: string,
    posts: PostAnalyticsRecord[],
    period: "7d" | "14d" | "30d" | "90d" | "all"
  ): CreatorPerformanceBaseline {
    const totalSampled = posts.length;
    const withMemory = posts.filter(
      (p) => p.contentMemoryContext && (p.contentMemoryContext.pillarTitle || p.contentMemoryContext.strategicAngle || p.contentMemoryContext.format)
    ).length;

    if (totalSampled === 0) {
      return {
        userId,
        period,
        totalPostsSampled: 0,
        postsWithMemoryContext: 0,
        confidence: "insufficient",
        medianViews: 0,
        averageViews: 0,
        minViews: 0,
        maxViews: 0,
        p25Views: 0,
        p75Views: 0,
        medianEngagementRate: 0,
        averageEngagementRate: 0,
        medianInteractions: 0,
        averageInteractions: 0,
        averageLikes: 0,
        averageReplies: 0,
        averageReposts: 0,
        averageQuotes: 0,
        calculatedAt: new Date().toISOString()
      };
    }

    const viewsList = posts.map((p) => p.metrics?.views || 0);
    const engRatesList = posts.map((p) => p.derivedMetrics?.engagementRate || 0);
    const interactionsList = posts.map((p) => p.derivedMetrics?.totalInteractions || 0);
    const likesList = posts.map((p) => p.metrics?.likes || 0);
    const repliesList = posts.map((p) => p.metrics?.replies || 0);
    const repostsList = posts.map((p) => p.metrics?.reposts || 0);
    const quotesList = posts.map((p) => p.metrics?.quotes || 0);

    const sum = (arr: number[]) => arr.reduce((acc, v) => acc + v, 0);

    const averageViews = Number((sum(viewsList) / totalSampled).toFixed(1));
    const medianViews = calculateMedian(viewsList);
    const minViews = Math.min(...viewsList);
    const maxViews = Math.max(...viewsList);
    const p25Views = calculatePercentile(viewsList, 25);
    const p75Views = calculatePercentile(viewsList, 75);

    // Recency Weighted Median Views
    const recencyWeightedMedianViews = calculateRecencyWeightedMedian(posts);

    // Maturation breakdown
    const maturePosts = posts.filter(p => p.maturationStatus === "mature" || (p.observationAgeHours || 0) >= 48);
    const maturingPosts = posts.filter(p => p.maturationStatus === "maturing" && (p.observationAgeHours || 0) < 48);

    const matureViews = maturePosts.map(p => p.metrics?.views || 0);
    const matureInteractions = maturePosts.map(p => p.derivedMetrics?.totalInteractions || 0);
    const matureEngRates = maturePosts.map(p => p.derivedMetrics?.engagementRate || 0);

    const maturePostsBaseline = maturePosts.length > 0 ? {
      medianViews: calculateMedian(matureViews),
      medianInteractions: calculateMedian(matureInteractions),
      medianEngagementRate: Number(calculateMedian(matureEngRates).toFixed(2)),
      sampleSize: maturePosts.length
    } : undefined;

    const maturationBreakdown = {
      matureCount: maturePosts.length,
      maturingCount: maturingPosts.length
    };

    const averageEngagementRate = Number((sum(engRatesList) / totalSampled).toFixed(2));
    const medianEngagementRate = Number(calculateMedian(engRatesList).toFixed(2));

    const averageInteractions = Number((sum(interactionsList) / totalSampled).toFixed(1));
    const medianInteractions = calculateMedian(interactionsList);

    const averageLikes = Number((sum(likesList) / totalSampled).toFixed(1));
    const averageReplies = Number((sum(repliesList) / totalSampled).toFixed(1));
    const averageReposts = Number((sum(repostsList) / totalSampled).toFixed(1));
    const averageQuotes = Number((sum(quotesList) / totalSampled).toFixed(1));

    const objectiveBaselines = {
      reachMedianViews: medianViews,
      engagementMedianRate: medianEngagementRate,
      conversationMedianReplies: calculateMedian(repliesList),
      actionMedianQuotes: calculateMedian(quotesList)
    };

    return {
      userId,
      period,
      totalPostsSampled: totalSampled,
      postsWithMemoryContext: withMemory,
      confidence: evaluateSampleSizeConfidence(totalSampled),
      medianViews,
      averageViews,
      minViews,
      maxViews,
      p25Views,
      p75Views,
      recencyWeightedMedianViews,
      maturePostsBaseline,
      maturationBreakdown,
      objectiveBaselines,
      medianEngagementRate,
      averageEngagementRate,
      medianInteractions,
      averageInteractions,
      averageLikes,
      averageReplies,
      averageReposts,
      averageQuotes,
      calculatedAt: new Date().toISOString()
    };
  }

  /**
   * Aggregate Posts by a specific Dimension
   */
  function aggregateByDimension(
    posts: PostAnalyticsRecord[],
    dimension: PerformanceDimension,
    dimensionLabel: string,
    keyExtractor: (p: PostAnalyticsRecord) => string | undefined,
    baseline: CreatorPerformanceBaseline
  ): DimensionAggregate[] {
    const grouped = new Map<string, PostAnalyticsRecord[]>();

    for (const post of posts) {
      let key = keyExtractor(post);
      if (!key || typeof key !== "string" || !key.trim()) {
        continue;
      }
      key = key.trim();
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(post);
    }

    const results: DimensionAggregate[] = [];

    for (const [key, cohortPosts] of grouped.entries()) {
      const count = cohortPosts.length;
      const confidence = evaluateSampleSizeConfidence(count);

      const viewsList = cohortPosts.map((p) => p.metrics?.views || 0);
      const engRatesList = cohortPosts.map((p) => p.derivedMetrics?.engagementRate || 0);
      const interactionsList = cohortPosts.map((p) => p.derivedMetrics?.totalInteractions || 0);
      const likesList = cohortPosts.map((p) => p.metrics?.likes || 0);
      const repliesList = cohortPosts.map((p) => p.metrics?.replies || 0);
      const repostsList = cohortPosts.map((p) => p.metrics?.reposts || 0);
      const quotesList = cohortPosts.map((p) => p.metrics?.quotes || 0);

      const sum = (arr: number[]) => arr.reduce((acc, v) => acc + v, 0);

      const totalViews = sum(viewsList);
      const averageViews = Number((totalViews / count).toFixed(1));
      const medianViews = calculateMedian(viewsList);
      const minViews = Math.min(...viewsList);
      const maxViews = Math.max(...viewsList);

      const totalInteractions = sum(interactionsList);
      const averageInteractions = Number((totalInteractions / count).toFixed(1));
      const medianInteractions = calculateMedian(interactionsList);

      const averageLikes = Number((sum(likesList) / count).toFixed(1));
      const averageReplies = Number((sum(repliesList) / count).toFixed(1));
      const averageReposts = Number((sum(repostsList) / count).toFixed(1));
      const averageQuotes = Number((sum(quotesList) / count).toFixed(1));

      const averageEngagementRate = Number((sum(engRatesList) / count).toFixed(2));
      const medianEngagementRate = Number(calculateMedian(engRatesList).toFixed(2));

      // Comparison to baseline
      const baseMedian = baseline.medianViews > 0 ? baseline.medianViews : 1;
      const viewsRatio = Number((medianViews / baseMedian).toFixed(2));
      const viewsDiffPercent = Number((((medianViews - baseMedian) / baseMedian) * 100).toFixed(1));
      const engRateDiff = Number((medianEngagementRate - baseline.medianEngagementRate).toFixed(2));
      const tier = classifyPerformanceTier(viewsRatio);

      const factualStatement = buildFactualComparisonStatement(
        key,
        count,
        medianViews,
        averageViews,
        baseline.medianViews,
        viewsDiffPercent,
        engRateDiff
      );

      // Identify top & bottom posts in cohort
      const sortedByViews = [...cohortPosts].sort((a, b) => (b.metrics?.views || 0) - (a.metrics?.views || 0));
      const topP = sortedByViews[0];
      const lowP = sortedByViews[sortedByViews.length - 1];

      results.push({
        dimension,
        dimensionLabel,
        key,
        displayName: key,
        postCount: count,
        sampleSizeConfidence: confidence,
        totalViews,
        averageViews,
        medianViews,
        minViews,
        maxViews,
        totalInteractions,
        averageInteractions,
        medianInteractions,
        averageLikes,
        averageReplies,
        averageReposts,
        averageQuotes,
        averageEngagementRate,
        medianEngagementRate,
        comparisonToBaseline: {
          viewsVsBaselineRatio: viewsRatio,
          viewsVsBaselineDiffPercent: viewsDiffPercent,
          engagementRateDiff: engRateDiff,
          tier,
          factualStatement
        },
        topPost: topP ? {
          id: topP.id,
          mediaId: topP.mediaId,
          text: topP.text || "",
          views: topP.metrics?.views || 0,
          engagementRate: topP.derivedMetrics?.engagementRate || 0,
          publishedAt: topP.publishedAt,
          permalink: topP.permalink
        } : undefined,
        lowestPost: lowP && lowP.id !== topP?.id ? {
          id: lowP.id,
          mediaId: lowP.mediaId,
          text: lowP.text || "",
          views: lowP.metrics?.views || 0,
          engagementRate: lowP.derivedMetrics?.engagementRate || 0,
          publishedAt: lowP.publishedAt,
          permalink: lowP.permalink
        } : undefined
      });
    }

    // Sort by median views descending, then post count descending
    results.sort((a, b) => {
      if (b.medianViews !== a.medianViews) {
        return b.medianViews - a.medianViews;
      }
      return b.postCount - a.postCount;
    });

    return results;
  }

  /**
   * Multi-dimensional Combinations (e.g. Pillar + Format, Angle + Format)
   */
  function aggregateCombinations(
    posts: PostAnalyticsRecord[],
    baseline: CreatorPerformanceBaseline,
    minPostCount: number = 2
  ): CombinationAggregate[] {
    const pairKeys = [
      {
        primaryDim: "pillar" as PerformanceDimension,
        primaryLabel: "Content Pillar",
        secDim: "format" as PerformanceDimension,
        secLabel: "Format",
        getPrim: (p: PostAnalyticsRecord) => p.contentMemoryContext?.pillarTitle,
        getSec: (p: PostAnalyticsRecord) => p.contentMemoryContext?.format
      },
      {
        primaryDim: "angle" as PerformanceDimension,
        primaryLabel: "Strategic Angle",
        secDim: "format" as PerformanceDimension,
        secLabel: "Format",
        getPrim: (p: PostAnalyticsRecord) => p.contentMemoryContext?.strategicAngle,
        getSec: (p: PostAnalyticsRecord) => p.contentMemoryContext?.format
      },
      {
        primaryDim: "pillar" as PerformanceDimension,
        primaryLabel: "Content Pillar",
        secDim: "cta" as PerformanceDimension,
        secLabel: "Call to Action",
        getPrim: (p: PostAnalyticsRecord) => p.contentMemoryContext?.pillarTitle,
        getSec: (p: PostAnalyticsRecord) => p.contentMemoryContext?.cta
      },
      {
        primaryDim: "topic" as PerformanceDimension,
        primaryLabel: "Topic",
        secDim: "format" as PerformanceDimension,
        secLabel: "Format",
        getPrim: (p: PostAnalyticsRecord) => p.contentMemoryContext?.topic,
        getSec: (p: PostAnalyticsRecord) => p.contentMemoryContext?.format
      }
    ];

    const combinations: CombinationAggregate[] = [];

    for (const pair of pairKeys) {
      const grouped = new Map<string, { primVal: string; secVal: string; posts: PostAnalyticsRecord[] }>();

      for (const post of posts) {
        const primVal = pair.getPrim(post)?.trim();
        const secVal = pair.getSec(post)?.trim();

        if (!primVal || !secVal) continue;
        const comboKey = `${primVal}__${secVal}`;

        if (!grouped.has(comboKey)) {
          grouped.set(comboKey, { primVal, secVal, posts: [] });
        }
        grouped.get(comboKey)!.posts.push(post);
      }

      for (const [comboKey, data] of grouped.entries()) {
        const count = data.posts.length;
        if (count < minPostCount) continue; // Only surface combinations with repeated observations

        const viewsList = data.posts.map((p) => p.metrics?.views || 0);
        const engRatesList = data.posts.map((p) => p.derivedMetrics?.engagementRate || 0);

        const sum = (arr: number[]) => arr.reduce((acc, v) => acc + v, 0);
        const medianViews = calculateMedian(viewsList);
        const averageViews = Number((sum(viewsList) / count).toFixed(1));
        const medianEngagementRate = Number(calculateMedian(engRatesList).toFixed(2));
        const averageEngagementRate = Number((sum(engRatesList) / count).toFixed(2));

        const baseMedian = baseline.medianViews > 0 ? baseline.medianViews : 1;
        const viewsRatio = Number((medianViews / baseMedian).toFixed(2));
        const diffPercent = Number((((medianViews - baseMedian) / baseMedian) * 100).toFixed(1));
        const tier = classifyPerformanceTier(viewsRatio);

        const confidence = evaluateSampleSizeConfidence(count);
        const diffLabel = diffPercent >= 0 ? `+${diffPercent.toFixed(1)}%` : `${diffPercent.toFixed(1)}%`;
        const factualStatement = `Combination of "${data.primVal}" + "${data.secVal}" has ${count} posts with median ${medianViews} views (${diffLabel} vs baseline).`;

        combinations.push({
          id: `${pair.primaryDim}_${pair.secDim}_${comboKey}`,
          primaryDimension: pair.primaryDim,
          primaryKey: data.primVal,
          primaryLabel: pair.primaryLabel,
          secondaryDimension: pair.secDim,
          secondaryKey: data.secVal,
          secondaryLabel: pair.secLabel,
          postCount: count,
          sampleSizeConfidence: confidence,
          medianViews,
          averageViews,
          medianEngagementRate,
          averageEngagementRate,
          viewsVsBaselineDiffPercent: diffPercent,
          tier,
          factualStatement
        });
      }
    }

    // Sort by post count * median views to highlight strong repeated patterns
    combinations.sort((a, b) => {
      const scoreB = b.postCount >= 3 ? b.medianViews * 1.5 : b.medianViews;
      const scoreA = a.postCount >= 3 ? a.medianViews * 1.5 : a.medianViews;
      return scoreB - scoreA;
    });

    return combinations.slice(0, 10);
  }

  /**
   * Identify Outliers Relative to Creator Baseline
   */
  function identifyOutliers(
    posts: PostAnalyticsRecord[],
    baseline: CreatorPerformanceBaseline
  ): PerformanceOutlier[] {
    if (posts.length < 3 || baseline.medianViews === 0) return [];

    const outliers: PerformanceOutlier[] = [];
    const baseMedian = baseline.medianViews;
    const baseEngRate = baseline.medianEngagementRate;

    for (const post of posts) {
      const postViews = post.metrics?.views || 0;
      const postEngRate = post.derivedMetrics?.engagementRate || 0;
      const viewRatio = postViews / baseMedian;

      if (viewRatio >= 2.0 && postViews >= 50) {
        outliers.push({
          post,
          classification: "significantly_above_baseline",
          primaryMetric: "views",
          metricValue: postViews,
          creatorBaselineValue: baseMedian,
          deviationRatio: Number(viewRatio.toFixed(2)),
          factualSummary: `Generated ${viewRatio.toFixed(1)}x your baseline median views (${postViews} vs ${baseMedian} baseline).`,
          strategicContext: post.contentMemoryContext
        });
      } else if (viewRatio >= 1.4 && postViews >= 30) {
        outliers.push({
          post,
          classification: "above_baseline",
          primaryMetric: "views",
          metricValue: postViews,
          creatorBaselineValue: baseMedian,
          deviationRatio: Number(viewRatio.toFixed(2)),
          factualSummary: `Performed above your baseline median views (${postViews} vs ${baseMedian} baseline).`,
          strategicContext: post.contentMemoryContext
        });
      } else if (viewRatio <= 0.35 && baseMedian >= 20) {
        outliers.push({
          post,
          classification: "significantly_below_baseline",
          primaryMetric: "views",
          metricValue: postViews,
          creatorBaselineValue: baseMedian,
          deviationRatio: Number(viewRatio.toFixed(2)),
          factualSummary: `Performed significantly below your baseline median views (${postViews} vs ${baseMedian} baseline).`,
          strategicContext: post.contentMemoryContext
        });
      } else if (postEngRate >= baseEngRate * 2.5 && postEngRate >= 5.0 && postViews >= 20) {
        outliers.push({
          post,
          classification: "above_baseline",
          primaryMetric: "engagementRate",
          metricValue: postEngRate,
          creatorBaselineValue: baseEngRate,
          deviationRatio: Number((postEngRate / (baseEngRate || 1)).toFixed(2)),
          factualSummary: `Generated ${postEngRate}% engagement rate (${(postEngRate / (baseEngRate || 1)).toFixed(1)}x your baseline rate).`,
          strategicContext: post.contentMemoryContext
        });
      }
    }

    // Sort outliers by deviation ratio descending
    outliers.sort((a, b) => b.deviationRatio - a.deviationRatio);
    return outliers.slice(0, 12);
  }

  /**
   * Derive Structured Factual Strategic Observations
   */
  function deriveStrategicObservations(
    baseline: CreatorPerformanceBaseline,
    pillars: DimensionAggregate[],
    formats: DimensionAggregate[],
    angles: DimensionAggregate[],
    combinations: CombinationAggregate[],
    outliers: PerformanceOutlier[]
  ): StrategicObservation[] {
    const observations: StrategicObservation[] = [];

    // 1. Sample Size Observation
    if (baseline.totalPostsSampled === 0) {
      observations.push({
        id: "obs_no_data",
        category: "sample_size_guidance",
        title: "No Historical Data Available",
        statement: "No synchronized Threads posts were found for this time window. Synchronize your latest analytics to discover patterns.",
        sampleSize: 0,
        confidence: "insufficient"
      });
      return observations;
    }

    if (baseline.totalPostsSampled < 5) {
      observations.push({
        id: "obs_early_data",
        category: "sample_size_guidance",
        title: "Early Pattern Detection",
        statement: `Analysis is based on ${baseline.totalPostsSampled} historical ${baseline.totalPostsSampled === 1 ? "post" : "posts"}. As you publish more content, pattern confidence will increase.`,
        sampleSize: baseline.totalPostsSampled,
        confidence: baseline.confidence
      });
    }

    // 2. High-Performing Content Pillar Pattern
    const usablePillars = pillars.filter((p) => p.postCount >= 2 && p.comparisonToBaseline.tier !== "near");
    if (usablePillars.length > 0) {
      const topPillar = usablePillars[0];
      if (topPillar.comparisonToBaseline.viewsVsBaselineDiffPercent > 0) {
        observations.push({
          id: `obs_pillar_${topPillar.key}`,
          category: "dimension_pattern",
          dimension: "pillar",
          title: `Content Pillar: ${topPillar.displayName}`,
          statement: `Posts in "${topPillar.displayName}" have generated a median of ${topPillar.medianViews} views across ${topPillar.postCount} posts (${topPillar.comparisonToBaseline.viewsVsBaselineDiffPercent > 0 ? "+" : ""}${topPillar.comparisonToBaseline.viewsVsBaselineDiffPercent}% vs your baseline).`,
          sampleSize: topPillar.postCount,
          confidence: topPillar.sampleSizeConfidence,
          supportingData: {
            keyName: topPillar.displayName,
            medianValue: topPillar.medianViews,
            baselineValue: baseline.medianViews,
            differencePercent: topPillar.comparisonToBaseline.viewsVsBaselineDiffPercent
          }
        });
      }
    }

    // 3. Format Pattern
    const usableFormats = formats.filter((f) => f.postCount >= 2);
    if (usableFormats.length >= 2) {
      const topFormat = usableFormats[0];
      observations.push({
        id: `obs_format_${topFormat.key}`,
        category: "dimension_pattern",
        dimension: "format",
        title: `Format Distribution: ${topFormat.displayName}`,
        statement: `Your most frequent format "${topFormat.displayName}" (${topFormat.postCount} posts) has averaged ${topFormat.averageViews.toFixed(0)} views (median ${topFormat.medianViews}).`,
        sampleSize: topFormat.postCount,
        confidence: topFormat.sampleSizeConfidence,
        supportingData: {
          keyName: topFormat.displayName,
          medianValue: topFormat.medianViews,
          baselineValue: baseline.medianViews,
          differencePercent: topFormat.comparisonToBaseline.viewsVsBaselineDiffPercent
        }
      });
    }

    // 4. Strategic Angle Pattern
    const usableAngles = angles.filter((a) => a.postCount >= 2 && a.comparisonToBaseline.viewsVsBaselineDiffPercent > 10);
    if (usableAngles.length > 0) {
      const topAngle = usableAngles[0];
      observations.push({
        id: `obs_angle_${topAngle.key}`,
        category: "dimension_pattern",
        dimension: "angle",
        title: `Strategic Angle: ${topAngle.displayName}`,
        statement: `Posts utilizing the "${topAngle.displayName}" angle have historically averaged ${topAngle.averageViews.toFixed(0)} views (median ${topAngle.medianViews}) across ${topAngle.postCount} posts.`,
        sampleSize: topAngle.postCount,
        confidence: topAngle.sampleSizeConfidence,
        supportingData: {
          keyName: topAngle.displayName,
          medianValue: topAngle.medianViews,
          baselineValue: baseline.medianViews,
          differencePercent: topAngle.comparisonToBaseline.viewsVsBaselineDiffPercent
        }
      });
    }

    // 5. Multi-dimensional Combination Observation
    if (combinations.length > 0) {
      const topCombo = combinations[0];
      if (topCombo.postCount >= 2 && topCombo.viewsVsBaselineDiffPercent > 0) {
        observations.push({
          id: `obs_combo_${topCombo.id}`,
          category: "combination_pattern",
          title: `Strategic Combination: ${topCombo.primaryKey} + ${topCombo.secondaryKey}`,
          statement: topCombo.factualStatement,
          sampleSize: topCombo.postCount,
          confidence: topCombo.sampleSizeConfidence,
          supportingData: {
            medianValue: topCombo.medianViews,
            baselineValue: baseline.medianViews,
            differencePercent: topCombo.viewsVsBaselineDiffPercent
          }
        });
      }
    }

    return observations.slice(0, 6);
  }

  /**
   * Main API: Generate Complete Content Performance Intelligence Summary
   */
  async function generateIntelligenceSummary(
    userId: string,
    period: "7d" | "14d" | "30d" | "90d" | "all" = "all",
    forceRefresh: boolean = false
  ): Promise<ContentPerformanceIntelligenceSummary> {
    const cacheKey = `${userId}_${period}`;
    if (!forceRefresh) {
      const cached = getCachedIntelligence(cacheKey);
      if (cached) return cached;
    }

    // Fetch all user posts from normalized analytics storage
    const { posts } = await getPostAnalytics({
      userId,
      limit: 500, // retrieve full historical analytics set for statistical analysis
      offset: 0,
      sortBy: "publishedAt",
      sortDirection: "desc"
    });

    const filteredPosts = filterPostsByPeriod(posts, period);
    const baseline = computeCreatorBaseline(userId, filteredPosts, period);

    if (filteredPosts.length === 0) {
      const emptySummary: ContentPerformanceIntelligenceSummary = {
        userId,
        period,
        generatedAt: new Date().toISOString(),
        totalPostsAnalyzed: 0,
        totalPostsWithMemoryContext: 0,
        baseline,
        dimensionAggregates: {
          pillar: [],
          format: [],
          angle: [],
          topic: [],
          cta: [],
          mediaType: []
        },
        topCombinations: [],
        outliers: [],
        observations: [
          {
            id: "empty_posts",
            category: "sample_size_guidance",
            title: "No Posts Found",
            statement: "No published posts found for the selected time window. Try selecting 'All Historical' or syncing latest analytics.",
            sampleSize: 0,
            confidence: "insufficient"
          }
        ],
        hasSufficientData: false,
        emptyStateReason: "No published posts found for this time period."
      };
      setCachedIntelligence(cacheKey, emptySummary);
      return emptySummary;
    }

    // Aggregate by Dimensions
    const pillarAggregates = aggregateByDimension(
      filteredPosts,
      "pillar",
      "Content Pillar",
      (p) => p.contentMemoryContext?.pillarTitle,
      baseline
    );

    const formatAggregates = aggregateByDimension(
      filteredPosts,
      "format",
      "Format",
      (p) => p.contentMemoryContext?.format,
      baseline
    );

    const angleAggregates = aggregateByDimension(
      filteredPosts,
      "angle",
      "Strategic Angle",
      (p) => p.contentMemoryContext?.strategicAngle,
      baseline
    );

    const topicAggregates = aggregateByDimension(
      filteredPosts,
      "topic",
      "Topic",
      (p) => p.contentMemoryContext?.topic,
      baseline
    );

    const ctaAggregates = aggregateByDimension(
      filteredPosts,
      "cta",
      "Call to Action",
      (p) => p.contentMemoryContext?.cta,
      baseline
    );

    const mediaTypeAggregates = aggregateByDimension(
      filteredPosts,
      "mediaType",
      "Media Type",
      (p) => p.mediaType,
      baseline
    );

    // Multi-dimensional Combinations
    const topCombinations = aggregateCombinations(filteredPosts, baseline, 2);

    // Outlier Analysis
    const outliers = identifyOutliers(filteredPosts, baseline);

    // Negative Evidence / Weak Pattern Analysis
    const dimensionMap = {
      pillar: pillarAggregates,
      format: formatAggregates,
      angle: angleAggregates,
      topic: topicAggregates,
      cta: ctaAggregates,
      mediaType: mediaTypeAggregates
    };
    const weakPatterns = identifyWeakPatterns(dimensionMap, baseline);

    // Pattern Fatigue Signals
    const patternFatigueSignals = detectPatternFatigue(filteredPosts, baseline);

    // Factual Strategic Observations
    const observations = deriveStrategicObservations(
      baseline,
      pillarAggregates,
      formatAggregates,
      angleAggregates,
      topCombinations,
      outliers
    );

    // Historical Coverage Calculation
    const sortedByDate = [...filteredPosts].sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());
    const historicalCoverage = {
      discoveredTotal: filteredPosts.length,
      alreadyKnown: filteredPosts.filter((p) => !p.isHistoricalImport).length,
      newlyImported: filteredPosts.filter((p) => p.isHistoricalImport).length,
      earliestPostDate: sortedByDate.length > 0 ? sortedByDate[0].publishedAt : undefined,
      metricsAvailableCount: filteredPosts.filter((p) => p.metricsAvailable !== false).length,
      limitationsNoted: filteredPosts.some((p) => p.metricsAvailable === false)
        ? "Some historical posts do not return Meta insights API metrics; text and pattern structures are preserved without zero-bias."
        : undefined
    };

    const topPerformingCombinations = topCombinations
      .filter((c) => c.tier === "significantly_above" || c.tier === "above")
      .slice(0, 5)
      .map((c) => ({
        ratioToBaseline: Number((c.medianViews / (baseline.medianViews || 1)).toFixed(2)),
        hookPattern: c.primaryKey,
        anglePattern: c.secondaryKey,
        formatPattern: c.primaryDimension === "format" ? c.primaryKey : c.secondaryKey
      }));

    const emergingCombinations = topCombinations
      .filter((c) => c.sampleSizeConfidence === "limited" && c.viewsVsBaselineDiffPercent > 10)
      .slice(0, 3)
      .map((c) => ({
        ratioToBaseline: Number((c.medianViews / (baseline.medianViews || 1)).toFixed(2)),
        hookPattern: c.primaryKey,
        anglePattern: c.secondaryKey,
        formatPattern: c.primaryDimension === "format" ? c.primaryKey : c.secondaryKey
      }));

    const summary: ContentPerformanceIntelligenceSummary = {
      userId,
      period,
      generatedAt: new Date().toISOString(),
      totalPostsAnalyzed: filteredPosts.length,
      totalPostsWithMemoryContext: baseline.postsWithMemoryContext,
      baseline,
      dimensionAggregates: dimensionMap,
      topCombinations,
      topPerformingCombinations,
      emergingCombinations,
      weakPatterns,
      patternFatigueSignals,
      historicalCoverage,
      outliers,
      observations,
      hasSufficientData: filteredPosts.length >= 2,
      emptyStateReason: filteredPosts.length < 2 ? "Limited data: 1 post analyzed." : undefined
    };

    setCachedIntelligence(cacheKey, summary);
    return summary;
  }

  /**
   * Evaluate Context for a Single Specific Post
   */
  async function getSinglePostContext(
    userId: string,
    mediaId: string
  ): Promise<SinglePostIntelligenceContext | null> {
    const { posts } = await getPostAnalytics({ userId, limit: 500 });
    const targetPost = posts.find((p) => p.mediaId === mediaId || p.id === `${userId}_${mediaId}`);
    if (!targetPost) return null;

    const baseline = computeCreatorBaseline(userId, posts, "all");
    const postViews = targetPost.metrics?.views || 0;
    const postEngRate = targetPost.derivedMetrics?.engagementRate || 0;

    const baseMedian = baseline.medianViews > 0 ? baseline.medianViews : 1;
    const viewsRatio = Number((postViews / baseMedian).toFixed(2));
    const viewsDiffPercent = Number((((postViews - baseMedian) / baseMedian) * 100).toFixed(1));
    const engRateDiff = Number((postEngRate - baseline.medianEngagementRate).toFixed(2));
    const tier = classifyPerformanceTier(viewsRatio);

    const diffPhrase = viewsDiffPercent >= 0 
      ? `+${viewsDiffPercent.toFixed(1)}% above` 
      : `${viewsDiffPercent.toFixed(1)}% below`;

    const factualStatement = postViews === baseMedian
      ? `This post generated ${postViews} views, aligning with your historical median.`
      : `This post generated ${postViews} views (${diffPhrase} your historical median of ${baseMedian}).`;

    // Cohort comparisons
    const pillarName = targetPost.contentMemoryContext?.pillarTitle;
    const formatName = targetPost.contentMemoryContext?.format;
    const angleName = targetPost.contentMemoryContext?.strategicAngle;

    const pillarCohortPosts = pillarName ? posts.filter((p) => p.contentMemoryContext?.pillarTitle === pillarName) : [];
    const formatCohortPosts = formatName ? posts.filter((p) => p.contentMemoryContext?.format === formatName) : [];
    const angleCohortPosts = angleName ? posts.filter((p) => p.contentMemoryContext?.strategicAngle === angleName) : [];

    return {
      post: targetPost,
      baseline,
      performanceTier: tier,
      viewsVsBaselineRatio: viewsRatio,
      viewsVsBaselineDiffPercent: viewsDiffPercent,
      engagementRateVsBaselineDiff: engRateDiff,
      factualStatement,
      cohortComparisons: {
        pillarCohort: pillarName ? {
          name: pillarName,
          cohortMedianViews: calculateMedian(pillarCohortPosts.map((p) => p.metrics?.views || 0)),
          sampleSize: pillarCohortPosts.length
        } : undefined,
        formatCohort: formatName ? {
          name: formatName,
          cohortMedianViews: calculateMedian(formatCohortPosts.map((p) => p.metrics?.views || 0)),
          sampleSize: formatCohortPosts.length
        } : undefined,
        angleCohort: angleName ? {
          name: angleName,
          cohortMedianViews: calculateMedian(angleCohortPosts.map((p) => p.metrics?.views || 0)),
          sampleSize: angleCohortPosts.length
        } : undefined
      }
    };
  }

  return {
    generateIntelligenceSummary,
    getSinglePostContext,
    invalidateUserIntelligenceCache
  };
}

/**
 * Formats accumulated Viral Flywheel Performance Intelligence into a clean, actionable,
 * evidence-informed prompt instruction block for AI content generation.
 * Integrates Universal Threads Creator Success Frameworks alongside personal evidence.
 */
/** Prefer a measured combination’s actual format over its primary dimension label. */
export function resolveWinningComboFormat(combo: { formatPattern?: string; primaryDimension?: string; primaryKey?: string }): string {
  return combo.formatPattern || (combo.primaryDimension === "format" ? combo.primaryKey || "Thread Format" : "Thread Format");
}

export function buildViralFlywheelPromptContext(
  summary?: ContentPerformanceIntelligenceSummary | null,
  learnedStrategies?: any[] | null
): string {
  let learnedStrategiesBlock = "";
  if (Array.isArray(learnedStrategies) && learnedStrategies.length > 0) {
    learnedStrategiesBlock = `
DECONSTRUCTED EXTERNAL CREATOR STRATEGIES (LEARNED FROM SUCCESSFUL THREADS ACCOUNTS):
${learnedStrategies.slice(0, 5).map((s, idx) => `
- Strategy ${idx + 1}: ${s.frameworkTitle || "Creator Strategy"} (Source / Creator: ${s.creatorHandle || "@creator"})
  * Hook Pattern: ${s.hookPattern || s.hookType || "Pattern Interrupt"}
  * Formatting & Rhythm: ${s.formattingPattern || "Mobile 1-2 line rhythm"}
  * Strategic Angle: ${s.strategicAngle || "Framework & System"}
  * Psychological Triggers: ${Array.isArray(s.psychologicalTriggers) ? s.psychologicalTriggers.join(", ") : "Curiosity, Contrast"}
  * CTA Mechanism: ${s.ctaMechanism || "Hand-raiser comment trigger"}
  * Reusable Structure Template:
${s.reusableTemplate || ""}
`).join("\n")}
`;
  }

  const universalFrameworksBlock = `
UNIVERSAL VIRAL THREADS CREATOR SUCCESS FRAMEWORKS (SHARED WRITING STRATEGY):
- Framework 1: High-Contrast Pattern Interrupt (Belief Shatterer)
  * Hook DNA: Open with a bold, counter-intuitive assertion that reframes industry consensus (e.g. "The biggest mistake in X isn't Y. It's Z.").
  * Layout: Use 1-2 line sentences with stark optical spacing. Never bundle concepts into dense blocks.
- Framework 2: Problem → Mechanism → Solution Playbook
  * Core Structure: State a common frustration -> Reveal the non-obvious mechanism behind it -> Provide 3 modular, step-by-step levers to execute immediately.
- Framework 3: High-Retention Mobile Formatting
  * Rule: Keep lines under 60 characters for effortless mobile reading.
  * Structure: Use bullet lists with heavy contrast verbs. Avoid preamble or conversational fluff.
- Framework 4: Low-Friction Hand-Raiser & Conversion CTAs
  * CTA Mechanism: Close with a specific, low-effort keyword response trigger ("Reply 'FRAMEWORK' and I'll send over the complete breakdown") or direct bio-link callouts.
- Framework 5: Empathy to High-Leverage Authority Bridge
  * Tone: Speak as a peer-to-peer strategist. Frame around gains, systems, and leverage rather than fixing flaws.
${learnedStrategiesBlock}
`;

  if (!summary || !summary.baseline || summary.totalPostsAnalyzed < 1) {
    return `
================================================================================
VIRAL FLYWHEEL INTELLIGENCE & UNIVERSAL CREATOR SUCCESS FRAMEWORKS
================================================================================
${universalFrameworksBlock}
================================================================================
PRIORITY HIERARCHY & FLYWHEEL INTEGRATION INSTRUCTIONS:
================================================================================
1. CONTEXT PRIORITY (STRICT CONSTRAINTS):
   - Priority 1: YOUR VOICE (How the creator communicates — tone, personality, worldview).
   - Priority 2: MY BUSINESS (Offer positioning, Target Audience, and Desired Result).
   - Priority 3: CONTENT INSTRUCTIONS (Custom frameworks and explicit user generation rules).
   - Priority 4: VIRAL FLYWHEEL INTELLIGENCE & UNIVERSAL CREATOR FRAMEWORKS.
   - CRITICAL: Use these proven viral frameworks as your writing instrument, while strictly maintaining the creator's unique identity and voice.

2. EVIDENCE-INFORMED SYNTHESIS:
   - Apply the Universal Creator Success Frameworks to give every post maximum scroll-stopping power, value density, and engagement momentum.
   - Extract and reuse the underlying structural DNA (psychological contrast, hook rhythm, mobile layout) without copying text verbatim.
================================================================================
`;
  }

  const { baseline, topPerformingCombinations, emergingCombinations, weakPatterns, patternFatigueSignals, dimensionAggregates } = summary;

  // 1. Personal Performance Baseline & Evidence Level
  const confidenceLabel = (baseline.confidence || "limited").toUpperCase();
  const recencyMedianStr = baseline.recencyWeightedMedianViews !== undefined ? ` | Recency-Weighted Median Views: ${baseline.recencyWeightedMedianViews}` : "";
  const objectiveStr = baseline.objectiveBaselines
    ? ` | Reach Median: ${baseline.objectiveBaselines.reachMedianViews} views, Engagement Rate Median: ${baseline.objectiveBaselines.engagementMedianRate}%, Conversation Median: ${baseline.objectiveBaselines.conversationMedianReplies} replies`
    : "";

  const baselineSummaryText = `Personal Median Views: ${baseline.medianViews} (25th–75th range: ${baseline.p25Views}–${baseline.p75Views})${recencyMedianStr} | Median Interactions: ${baseline.medianInteractions}${objectiveStr} [Sample: ${summary.totalPostsAnalyzed} real published Threads posts, Evidence Level: ${confidenceLabel}]`;

  // 2. Proven Winning Content Combinations
  const winningCombosText = (topPerformingCombinations || summary.topCombinations || [])
    .filter((c: any) => c.ratioToBaseline ? c.ratioToBaseline >= 1.15 : c.viewsVsBaselineDiffPercent > 15)
    .slice(0, 4)
    .map((combo: any, idx: number) => {
      const perfRatio = combo.ratioToBaseline ? combo.ratioToBaseline.toFixed(2) : (1 + (combo.viewsVsBaselineDiffPercent || 0) / 100).toFixed(2);
      const hook = combo.hookPattern || combo.primaryKey || "Pattern Hook";
      const angle = combo.anglePattern || combo.secondaryKey || "Strategic Angle";
      const format = resolveWinningComboFormat(combo);
      return `  ${idx + 1}. [PROVEN WINNER (${perfRatio}x baseline)] Hook Style: "${hook}" | Angle: "${angle}" | Format: "${format}"`;
    })
    .join("\n");

  // 3. Top Performing Formats & Hook Structures
  const formatsAggregate = dimensionAggregates?.format || [];
  const topFormatsText = formatsAggregate
    .filter(f => (f.comparisonToBaseline?.viewsVsBaselineRatio || 1) >= 1.15 && f.postCount >= 1)
    .slice(0, 3)
    .map(f => `  - ${f.displayName || f.key}: ${(f.comparisonToBaseline?.viewsVsBaselineRatio || 1).toFixed(2)}x baseline (median ${f.medianViews} views across ${f.postCount} post(s))`)
    .join("\n");

  // 4. Top Performing Strategic Angles
  const anglesAggregate = dimensionAggregates?.angle || [];
  const topAnglesText = anglesAggregate
    .filter(a => (a.comparisonToBaseline?.viewsVsBaselineRatio || 1) >= 1.15 && a.postCount >= 1)
    .slice(0, 3)
    .map(a => `  - ${a.displayName || a.key}: ${(a.comparisonToBaseline?.viewsVsBaselineRatio || 1).toFixed(2)}x baseline (median ${a.medianViews} views across ${a.postCount} post(s))`)
    .join("\n");

  // 5. Top Performing Topics & CTAs
  const topicsAggregate = dimensionAggregates?.topic || [];
  const topTopicsText = topicsAggregate
    .filter(t => (t.comparisonToBaseline?.viewsVsBaselineRatio || 1) >= 1.10 && t.postCount >= 1)
    .slice(0, 3)
    .map(t => `  - ${t.displayName || t.key}: ${(t.comparisonToBaseline?.viewsVsBaselineRatio || 1).toFixed(2)}x baseline (${t.postCount} post(s))`)
    .join("\n");

  const ctaAggregate = dimensionAggregates?.cta || [];
  const topCtasText = ctaAggregate
    .filter(c => (c.comparisonToBaseline?.viewsVsBaselineRatio || 1) >= 1.05 && c.postCount >= 1)
    .slice(0, 3)
    .map(c => `  - ${c.displayName || c.key}: ${(c.comparisonToBaseline?.viewsVsBaselineRatio || 1).toFixed(2)}x baseline (${c.postCount} post(s))`)
    .join("\n");

  // 6. Emerging Growth Patterns
  const emergingText = (emergingCombinations || [])
    .slice(0, 3)
    .map(e => `  - Hook: "${e.hookPattern}" + Angle: "${e.anglePattern}" (${e.ratioToBaseline.toFixed(2)}x baseline, initial sample growing)`)
    .join("\n");

  // 7. Negative Evidence / Weak Patterns to Avoid
  const weakPatternsText = (weakPatterns || [])
    .slice(0, 3)
    .map(w => `  - [UNDERPERFORMING APPROACH] ${w.factualStatement}`)
    .join("\n");

  // 8. Pattern Fatigue / Saturation Signals
  const fatigueText = (patternFatigueSignals || [])
    .slice(0, 3)
    .map(f => `  - [PATTERNS SHOWING FATIGUE] ${f.factualStatement}`)
    .join("\n");

  return `
================================================================================
VIRAL FLYWHEEL PERFORMANCE INTELLIGENCE & UNIVERSAL SUCCESS FRAMEWORKS
================================================================================
${universalFrameworksBlock}

PERSONAL HISTORICAL BASELINE & PERFORMANCE DATA:
${baselineSummaryText}

PROVEN WINNING CONTENT COMBINATIONS:
${winningCombosText || "  (Accumulating initial performance data across published posts)"}

TOP PERFORMING FORMATS & HOOK STRUCTURES:
${topFormatsText || "  (Analyzing format performance from real posted content)"}

TOP PERFORMING STRATEGIC ANGLES:
${topAnglesText || "  (Analyzing angle performance from real posted content)"}

${topTopicsText ? `TOP PERFORMING TOPICS:\n${topTopicsText}\n` : ""}${topCtasText ? `TOP CONVERSATION-DRIVING CTAS:\n${topCtasText}\n` : ""}${emergingText ? `EMERGING GROWTH PATTERNS (TESTING OPPORTUNITIES):\n${emergingText}\n` : ""}${weakPatternsText ? `UNDERPERFORMING PATTERNS TO AVOID (NEGATIVE EVIDENCE):\n${weakPatternsText}\n` : ""}${fatigueText ? `PATTERNS SHOWING SATURATION / FATIGUE:\n${fatigueText}\n` : ""}
================================================================================
PRIORITY HIERARCHY & FLYWHEEL INTEGRATION INSTRUCTIONS:
================================================================================
1. CONTEXT PRIORITY (STRICT CONSTRAINTS):
   - Priority 1: YOUR VOICE (How the creator communicates — tone, personality, worldview).
   - Priority 2: MY BUSINESS (Offer positioning, Target Audience, and Desired Result).
   - Priority 3: CONTENT INSTRUCTIONS (Custom frameworks and explicit user generation rules).
   - Priority 4: VIRAL FLYWHEEL INTELLIGENCE (Evidence from real Threads publishing performance + Universal Success Frameworks).
   - CRITICAL: Flywheel intelligence provides evidence-informed guidance. Do NOT allow Flywheel patterns to contradict explicit creator instructions or overwrite creator voice.

2. EVIDENCE-INFORMED SYNTHESIS:
   - Fuse the Universal Creator Success Frameworks with personal historical winners to maximize engagement, reach, and conversation momentum.
   - Extract and reuse the underlying structural DNA (psychological contrast, hook rhythm, strategic angle, and value density) without copying wording verbatim.
   - Avoid overusing fatigued patterns or relying on underperforming weak structures.
================================================================================
`;
}
