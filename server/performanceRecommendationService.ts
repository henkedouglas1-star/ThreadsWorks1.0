/**
 * ThreadsWorks AI Content Performance Recommendation Engine
 * Transforms verified performance evidence and creator context into actionable, evidence-based recommendations.
 */

import { GoogleGenAI, Type } from "@google/genai";
import { 
  ContentPerformanceIntelligenceSummary,
  DimensionAggregate,
  CombinationAggregate,
  PerformanceOutlier,
  SampleSizeConfidence
} from "../src/types/intelligence";
import {
  ContentPerformanceRecommendation,
  PerformanceRecommendationsResponse,
  RecommendationCategory,
  RecommendationEvidence
} from "../src/types/recommendations";
import { UserProfile } from "../src/types";

interface CacheEntry {
  response: PerformanceRecommendationsResponse;
  timestamp: number;
}

// In-memory cache for recommendation summaries (5-minute TTL)
const recommendationsCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export interface PerformanceRecommendationServiceDependencies {
  getIntelligenceSummary: (userId: string, period: "7d" | "14d" | "30d" | "90d" | "all", force?: boolean) => Promise<ContentPerformanceIntelligenceSummary>;
  getUserProfile: (userId: string) => Promise<UserProfile | null>;
}

import { getAI, callGenerateContentWithRetry } from "./geminiClient";

export function createPerformanceRecommendationService(deps: PerformanceRecommendationServiceDependencies) {
  // Use shared Gemini AI Client singleton
  const getAiClient = () => getAI();

  /**
   * Deterministic rule-based recommendation fallback
   * Ensures high-quality recommendations are always available even if AI quota or connectivity is interrupted
   */
  function buildDeterministicRecommendations(
    intelligence: ContentPerformanceIntelligenceSummary,
    profile: UserProfile | null,
    period: "7d" | "14d" | "30d" | "90d" | "all"
  ): ContentPerformanceRecommendation[] {
    const recommendations: ContentPerformanceRecommendation[] = [];
    const baselineMedianViews = intelligence.baseline.medianViews || 1;
    const baselineMedianEng = intelligence.baseline.medianEngagementRate || 0;

    // 1. WHAT TO REPEAT: High performing Pillars & Formats
    const strongPillars = intelligence.dimensionAggregates.pillar.filter(
      (p) => p.comparisonToBaseline.tier === "above" || p.comparisonToBaseline.tier === "significantly_above"
    );
    if (strongPillars.length > 0) {
      const topPillar = strongPillars[0];
      recommendations.push({
        id: `rec-repeat-pillar-${topPillar.key}`,
        category: "what_to_repeat",
        title: `Scale Core Pillar: "${topPillar.displayName}"`,
        recommendation: `Incorporate another post centered on "${topPillar.displayName}". This pillar has consistently generated higher reach than your personal baseline.`,
        rationale: `Across ${topPillar.postCount} historical posts, "${topPillar.displayName}" generated a median of ${topPillar.medianViews.toLocaleString()} views (${topPillar.comparisonToBaseline.viewsVsBaselineDiffPercent > 0 ? "+" : ""}${topPillar.comparisonToBaseline.viewsVsBaselineDiffPercent.toFixed(1)}% vs your baseline median of ${baselineMedianViews.toLocaleString()}).`,
        confidence: topPillar.sampleSizeConfidence,
        evidence: {
          metric: "views",
          creatorBaseline: baselineMedianViews,
          cohortMedian: topPillar.medianViews,
          variancePercent: topPillar.comparisonToBaseline.viewsVsBaselineDiffPercent,
          sampleSize: topPillar.postCount,
          confidence: topPillar.sampleSizeConfidence,
          confidenceExplanation: `${topPillar.postCount} posts analyzed (${topPillar.sampleSizeConfidence} evidence tier).`,
          dimension: "pillar",
          dimensionValue: topPillar.displayName,
          sourcePosts: topPillar.topPost ? [{
            mediaId: topPillar.topPost.mediaId,
            text: topPillar.topPost.text,
            publishedAt: topPillar.topPost.publishedAt,
            views: topPillar.topPost.views,
            engagementRate: topPillar.topPost.engagementRate,
            permalink: topPillar.topPost.permalink
          }] : []
        },
        strategicContext: {
          pillarTitle: topPillar.displayName,
          intent: "attention"
        },
        suggestedAction: {
          actionLabel: `Draft "${topPillar.displayName}" Post`,
          prefillPillar: topPillar.displayName
        },
        timeWindow: period,
        createdAt: new Date().toISOString()
      });
    }

    // 2. WHAT TO REPEAT / TEST: High performing Combinations
    if (intelligence.topCombinations.length > 0) {
      const topCombo = intelligence.topCombinations[0];
      const isUsable = topCombo.sampleSizeConfidence === "strong" || topCombo.sampleSizeConfidence === "usable";
      recommendations.push({
        id: `rec-combo-${topCombo.id}`,
        category: isUsable ? "what_to_repeat" : "what_to_test",
        title: `Leverage Strategic Pattern: ${topCombo.primaryKey} + ${topCombo.secondaryKey}`,
        recommendation: `Draft a new post combining ${topCombo.primaryKey} with ${topCombo.secondaryKey}. This structural pairing exhibits strong performance in your historical data.`,
        rationale: topCombo.factualStatement,
        confidence: topCombo.sampleSizeConfidence,
        evidence: {
          metric: "combination",
          creatorBaseline: baselineMedianViews,
          cohortMedian: topCombo.medianViews,
          variancePercent: topCombo.viewsVsBaselineDiffPercent,
          sampleSize: topCombo.postCount,
          confidence: topCombo.sampleSizeConfidence,
          confidenceExplanation: `${topCombo.postCount} posts analyzed.`,
          dimensionValue: `${topCombo.primaryKey} + ${topCombo.secondaryKey}`,
          sourcePosts: []
        },
        strategicContext: {
          pillarTitle: topCombo.primaryDimension === "pillar" ? topCombo.primaryKey : undefined,
          format: topCombo.secondaryDimension === "format" ? topCombo.secondaryKey : undefined,
          strategicAngle: topCombo.primaryDimension === "angle" ? topCombo.primaryKey : (topCombo.secondaryDimension === "angle" ? topCombo.secondaryKey : undefined),
          intent: "attention"
        },
        suggestedAction: {
          actionLabel: `Test ${topCombo.primaryKey} + ${topCombo.secondaryKey}`,
          prefillPillar: topCombo.primaryDimension === "pillar" ? topCombo.primaryKey : undefined,
          prefillFormat: topCombo.secondaryDimension === "format" ? topCombo.secondaryKey : undefined
        },
        timeWindow: period,
        createdAt: new Date().toISOString()
      });
    }

    // 3. WHAT TO TEST: Promising Formats or Angles with limited sample
    const testFormats = intelligence.dimensionAggregates.format.filter(
      (f) => f.sampleSizeConfidence === "limited" && (f.comparisonToBaseline.tier === "above" || f.comparisonToBaseline.tier === "significantly_above")
    );
    if (testFormats.length > 0) {
      const formatItem = testFormats[0];
      recommendations.push({
        id: `rec-test-format-${formatItem.key}`,
        category: "what_to_test",
        title: `Test Emerging Format: "${formatItem.displayName}"`,
        recommendation: `Run 2–3 additional tests using the "${formatItem.displayName}" format. Early data shows above-baseline reach, but more samples are needed to establish reliability.`,
        rationale: `Across ${formatItem.postCount} posts, this format achieved a median of ${formatItem.medianViews.toLocaleString()} views (${formatItem.comparisonToBaseline.viewsVsBaselineDiffPercent > 0 ? "+" : ""}${formatItem.comparisonToBaseline.viewsVsBaselineDiffPercent.toFixed(1)}% vs baseline).`,
        confidence: "limited",
        evidence: {
          metric: "views",
          creatorBaseline: baselineMedianViews,
          cohortMedian: formatItem.medianViews,
          variancePercent: formatItem.comparisonToBaseline.viewsVsBaselineDiffPercent,
          sampleSize: formatItem.postCount,
          confidence: "limited",
          confidenceExplanation: `Early signal from ${formatItem.postCount} posts. Requires further testing.`,
          dimension: "format",
          dimensionValue: formatItem.displayName,
          sourcePosts: formatItem.topPost ? [{
            mediaId: formatItem.topPost.mediaId,
            text: formatItem.topPost.text,
            publishedAt: formatItem.topPost.publishedAt,
            views: formatItem.topPost.views,
            engagementRate: formatItem.topPost.engagementRate,
            permalink: formatItem.topPost.permalink
          }] : []
        },
        strategicContext: {
          format: formatItem.displayName,
          intent: "attention"
        },
        suggestedAction: {
          actionLabel: `Draft "${formatItem.displayName}" Post`,
          prefillFormat: formatItem.displayName
        },
        timeWindow: period,
        createdAt: new Date().toISOString()
      });
    }

    // 4. WHAT TO REFINE: Formats or Angles with high views but low engagement
    const refineItems = intelligence.dimensionAggregates.angle.filter(
      (a) => a.postCount >= 2 && a.medianViews >= baselineMedianViews && a.medianEngagementRate < baselineMedianEng * 0.8
    );
    if (refineItems.length > 0) {
      const refineAngle = refineItems[0];
      recommendations.push({
        id: `rec-refine-angle-${refineAngle.key}`,
        category: "what_to_refine",
        title: `Refine Conversation Hook for "${refineAngle.displayName}"`,
        recommendation: `Pair posts using the "${refineAngle.displayName}" angle with an open-ended conversational prompt to boost discussion and replies.`,
        rationale: `This angle attracts views (${refineAngle.medianViews.toLocaleString()} median views), but interaction rates are lower (${refineAngle.medianEngagementRate.toFixed(2)}% vs ${baselineMedianEng.toFixed(2)}% baseline).`,
        confidence: refineAngle.sampleSizeConfidence,
        evidence: {
          metric: "engagement_rate",
          creatorBaseline: baselineMedianEng,
          cohortMedian: refineAngle.medianEngagementRate,
          variancePercent: ((refineAngle.medianEngagementRate - baselineMedianEng) / Math.max(0.1, baselineMedianEng)) * 100,
          sampleSize: refineAngle.postCount,
          confidence: refineAngle.sampleSizeConfidence,
          confidenceExplanation: `Based on ${refineAngle.postCount} posts using this angle.`,
          dimension: "angle",
          dimensionValue: refineAngle.displayName,
          sourcePosts: []
        },
        strategicContext: {
          strategicAngle: refineAngle.displayName,
          intent: "conversation"
        },
        suggestedAction: {
          actionLabel: `Refine "${refineAngle.displayName}" Prompt`,
          prefillAngle: refineAngle.displayName
        },
        timeWindow: period,
        createdAt: new Date().toISOString()
      });
    }

    // 5. CONTENT MIX: Pillar balance observation
    if (intelligence.dimensionAggregates.pillar.length >= 2) {
      const pillars = intelligence.dimensionAggregates.pillar;
      const sortedByCount = [...pillars].sort((a, b) => b.postCount - a.postCount);
      const mostUsed = sortedByCount[0];
      const underUsedHighPerf = sortedByCount.slice(1).find((p) => p.comparisonToBaseline.tier === "above" || p.comparisonToBaseline.tier === "significantly_above");

      if (mostUsed && underUsedHighPerf && mostUsed.postCount >= underUsedHighPerf.postCount * 2) {
        recommendations.push({
          id: `rec-mix-pillars`,
          category: "content_mix",
          title: `Rebalance Content Mix: Re-introduce "${underUsedHighPerf.displayName}"`,
          recommendation: `Consider allocating more publishing slots to "${underUsedHighPerf.displayName}". It has demonstrated strong reach per post despite having fewer total publications.`,
          rationale: `"${mostUsed.displayName}" accounts for ${mostUsed.postCount} posts, while "${underUsedHighPerf.displayName}" has ${underUsedHighPerf.postCount} posts with a median of ${underUsedHighPerf.medianViews.toLocaleString()} views (+${underUsedHighPerf.comparisonToBaseline.viewsVsBaselineDiffPercent.toFixed(1)}% vs baseline).`,
          confidence: underUsedHighPerf.sampleSizeConfidence,
          evidence: {
            metric: "views",
            creatorBaseline: baselineMedianViews,
            cohortMedian: underUsedHighPerf.medianViews,
            variancePercent: underUsedHighPerf.comparisonToBaseline.viewsVsBaselineDiffPercent,
            sampleSize: underUsedHighPerf.postCount,
            confidence: underUsedHighPerf.sampleSizeConfidence,
            confidenceExplanation: `Comparison between high volume pillar (${mostUsed.postCount} posts) and high efficiency pillar (${underUsedHighPerf.postCount} posts).`,
            dimension: "pillar",
            dimensionValue: underUsedHighPerf.displayName,
            sourcePosts: []
          },
          strategicContext: {
            pillarTitle: underUsedHighPerf.displayName,
            intent: "attention"
          },
          suggestedAction: {
            actionLabel: `Plan "${underUsedHighPerf.displayName}" Batch`,
            prefillPillar: underUsedHighPerf.displayName
          },
          timeWindow: period,
          createdAt: new Date().toISOString()
        });
      }
    }

    return recommendations;
  }

  /**
   * Main generation method: Combines deterministic intelligence with Gemini AI strategic reasoning
   */
  async function generateRecommendations(
    userId: string,
    period: "7d" | "14d" | "30d" | "90d" | "all" = "all",
    forceRefresh: boolean = false
  ): Promise<PerformanceRecommendationsResponse> {
    const cacheKey = `${userId}:${period}`;
    const now = Date.now();

    if (!forceRefresh) {
      const cached = recommendationsCache.get(cacheKey);
      if (cached && now - cached.timestamp < CACHE_TTL_MS) {
        return cached.response;
      }
    }

    // 1. Gather all prerequisite context in parallel
    const [intelligence, profile] = await Promise.all([
      deps.getIntelligenceSummary(userId, period, forceRefresh),
      deps.getUserProfile(userId)
    ]);

    const baselineMedianViews = intelligence.baseline.medianViews || 0;
    const baselineMedianEng = intelligence.baseline.medianEngagementRate || 0;
    const totalPosts = intelligence.totalPostsAnalyzed || 0;

    // Build deterministic baseline recommendations
    const deterministicRecs = buildDeterministicRecommendations(intelligence, profile, period);

    // If there is zero or only 1 post, return early with qualified message
    if (totalPosts < 2) {
      const emptyResponse: PerformanceRecommendationsResponse = {
        recommendations: deterministicRecs,
        totalGenerated: deterministicRecs.length,
        timeWindow: period,
        generatedAt: new Date().toISOString(),
        creatorBaselineMedianViews: baselineMedianViews,
        creatorBaselineMedianEngagement: baselineMedianEng,
        totalPostsAnalyzed: totalPosts,
        categoriesSummary: {
          whatToRepeatCount: 0,
          whatToTestCount: 0,
          whatToRefineCount: 0,
          whatToAvoidCount: 0,
          contentMixCount: 0
        }
      };
      recommendationsCache.set(cacheKey, { response: emptyResponse, timestamp: now });
      return emptyResponse;
    }

    let finalRecommendations = [...deterministicRecs];

    // 2. Invoke Gemini AI Reasoning Engine if API key is present
    if (process.env.GEMINI_API_KEY) {
      try {
        const ai = getAiClient();

        // Extract authenticated user's specific CTA destinations, offers, and handle
        const userDestinations = Array.isArray(profile?.contentDestinations)
          ? profile.contentDestinations.filter((d: any) => d && (d.name || d.url))
          : [];
        const userOffers = Array.isArray(profile?.offerIntelligence?.offers)
          ? profile.offerIntelligence.offers.filter((o: any) => o && o.name)
          : [];
        const ctaPreferences = profile?.ctaPreferences || "";
        const creatorHandle = profile?.creatorIdentity?.character?.name || "";

        const userCtaContext = {
          ctaPreferences: ctaPreferences || undefined,
          availableDestinations: userDestinations.map((d: any) => ({
            name: d.name,
            url: d.url,
            purpose: d.purpose || undefined
          })),
          availableOffers: userOffers.map((o: any) => ({
            name: o.name,
            type: o.type || undefined,
            purpose: o.purpose || undefined
          })),
          creatorHandle: creatorHandle || undefined
        };

        // Build compact, structured evidence prompt
        const promptContext = {
          creatorContext: {
            audience: profile?.audience || "Digital creators and operators",
            writingStyle: profile?.writingStyle || "Direct, authoritative, positive",
            customInstructions: profile?.customInstruction || "",
            primaryOffer: profile?.offer || profile?.offerIntelligence?.primaryOfferName || "",
            personality: profile?.creatorIdentity?.personality || "",
            tone: profile?.creatorIdentity?.tone || ""
          },
          baseline: {
            medianViews: intelligence.baseline.medianViews,
            averageViews: intelligence.baseline.averageViews,
            p25Views: intelligence.baseline.p25Views,
            p75Views: intelligence.baseline.p75Views,
            medianEngagementRate: intelligence.baseline.medianEngagementRate,
            totalPostsAnalyzed: intelligence.totalPostsAnalyzed
          },
          topPillars: intelligence.dimensionAggregates.pillar.slice(0, 5).map((p) => ({
            name: p.displayName,
            postCount: p.postCount,
            medianViews: p.medianViews,
            varianceVsBaseline: p.comparisonToBaseline.viewsVsBaselineDiffPercent,
            tier: p.comparisonToBaseline.tier,
            confidence: p.sampleSizeConfidence,
            topPostText: p.topPost?.text?.slice(0, 100) || "",
            topPostMediaId: p.topPost?.mediaId || ""
          })),
          topFormats: intelligence.dimensionAggregates.format.slice(0, 5).map((f) => ({
            name: f.displayName,
            postCount: f.postCount,
            medianViews: f.medianViews,
            varianceVsBaseline: f.comparisonToBaseline.viewsVsBaselineDiffPercent,
            tier: f.comparisonToBaseline.tier,
            confidence: f.sampleSizeConfidence
          })),
          topAngles: intelligence.dimensionAggregates.angle.slice(0, 5).map((a) => ({
            name: a.displayName,
            postCount: a.postCount,
            medianViews: a.medianViews,
            medianEngagement: a.medianEngagementRate,
            varianceVsBaseline: a.comparisonToBaseline.viewsVsBaselineDiffPercent,
            confidence: a.sampleSizeConfidence
          })),
          topCombinations: intelligence.topCombinations.slice(0, 4).map((c) => ({
            combo: `${c.primaryKey} + ${c.secondaryKey}`,
            postCount: c.postCount,
            medianViews: c.medianViews,
            varianceVsBaseline: c.viewsVsBaselineDiffPercent,
            confidence: c.sampleSizeConfidence
          })),
          outliers: intelligence.outliers.slice(0, 4).map((o) => ({
            mediaId: o.post.mediaId,
            text: o.post.text?.slice(0, 120) || "",
            views: o.post.metrics?.views || 0,
            engagementRate: o.post.derivedMetrics?.engagementRate || 0,
            deviationRatio: o.deviationRatio,
            classification: o.classification,
            pillar: o.strategicContext?.pillarTitle || "",
            format: o.strategicContext?.format || ""
          })),
          userCtaContext
        };

        const systemInstruction = `You are the ThreadsWorks AI Content Performance Recommendation Engine.
Your task is to analyze factual performance evidence from Meta Threads analytics and transform it into high-impact, evidence-based recommendations for future content decisions.

CORE RULES:
1. EVIDENCE FIRST: Every recommendation MUST cite specific metrics (views, variance %, post count).
2. DO NOT INVENT METRICS, SAMPLE SIZES, OR CAUSAL CLAIMS. Never say "X caused Y" or "guaranteed results". Use correlation phrasing: "Posts using X historically generated +Y% vs baseline".
3. STRICT CATEGORIZATION:
   - "what_to_repeat": Proven patterns that repeatedly perform above baseline (sampleSize >= 4).
   - "what_to_test": Promising patterns with limited sample size (sampleSize 2-3) or new combinations.
   - "what_to_refine": Patterns with high views but low engagement, or promising topics needing stronger hooks.
   - "what_to_avoid_over_repeating": Only if sample size is strong (5+) and consistently below baseline.
   - "content_mix": Balance suggestions across pillars.
4. CONFIDENCE LEVELS: "strong" (10+ posts), "usable" (5-9 posts), "limited" (2-4 posts), "insufficient" (1 post).
5. TONE & BRAND: Direct, professional, authoritative, actionable. Match Douglas C. Henke's strategic standard.
6. CTA DISCIPLINE: CTA strategy (Follow, Free Resource, Product Offer, Conversation Starter) is global intelligence, but CTA destinations and URLs are strictly user-specific. When suggesting CTAs, reference only the authenticated user's configured destinations or offers in userCtaContext. If the user has no configured URL for an offer or resource, recommend strategic direction (e.g., 'Test a conversational closing question' or 'Include a follow CTA') rather than fabricating a URL. Never invent URLs or keyword comment/DM triggers.
7. Return 3 to 5 distinct, high-leverage recommendations across different categories.`;

        const response = await callGenerateContentWithRetry(ai, {
          model: "gemini-2.5-flash",
          optimizationTaskId: "PERFORMANCE_RECO",
          optimizationComplexity: "LEVEL_3_ADVANCED",
          contents: `Analyze this creator's performance evidence and generate 3 to 5 distinct, evidence-based recommendations:\n\n${JSON.stringify(promptContext, null, 2)}`,
          config: {
            systemInstruction,
            temperature: 0.2,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                recommendations: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      category: {
                        type: Type.STRING,
                        description: "Must be one of: what_to_repeat, what_to_test, what_to_refine, what_to_avoid_over_repeating, content_mix"
                      },
                      title: {
                        type: Type.STRING,
                        description: "Concise actionable title (e.g., 'Scale Core Pillar: Monetization')"
                      },
                      recommendation: {
                        type: Type.STRING,
                        description: "Direct, actionable recommendation on what to do next."
                      },
                      rationale: {
                        type: Type.STRING,
                        description: "Factual explanation referencing specific numbers and variance vs baseline."
                      },
                      confidence: {
                        type: Type.STRING,
                        description: "Must be: strong, usable, limited, or insufficient"
                      },
                      metric: {
                        type: Type.STRING,
                        description: "views, engagement_rate, interactions, or combination"
                      },
                      cohortMedian: {
                        type: Type.NUMBER,
                        description: "Median value of the analyzed cohort"
                      },
                      variancePercent: {
                        type: Type.NUMBER,
                        description: "Percentage difference vs baseline median (+42.5 or -10.0)"
                      },
                      sampleSize: {
                        type: Type.INTEGER,
                        description: "Number of posts in the cohort"
                      },
                      dimension: {
                        type: Type.STRING,
                        description: "pillar, angle, format, topic, cta, or mediaType"
                      },
                      dimensionValue: {
                        type: Type.STRING,
                        description: "Name of the pillar, format, or angle"
                      },
                      suggestedActionLabel: {
                        type: Type.STRING,
                        description: "Button label for drafting next post"
                      },
                      prefillPillar: { type: Type.STRING },
                      prefillFormat: { type: Type.STRING },
                      prefillAngle: { type: Type.STRING },
                      prefillTopic: { type: Type.STRING },
                      prefillCta: { type: Type.STRING, description: "Only user's configured destination or strategic CTA if appropriate" }
                    },
                    required: ["category", "title", "recommendation", "rationale", "confidence", "metric", "sampleSize"]
                  }
                }
              },
              required: ["recommendations"]
            }
          }
        });

        const rawText = response.text?.trim();
        if (rawText) {
          const parsed = JSON.parse(rawText);
          if (parsed && Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0) {
            const aiRecs: ContentPerformanceRecommendation[] = parsed.recommendations.map((item: any, idx: number) => {
              const validCategory: RecommendationCategory = [
                "what_to_repeat",
                "what_to_test",
                "what_to_refine",
                "what_to_avoid_over_repeating",
                "content_mix"
              ].includes(item.category) ? item.category : "what_to_repeat";

              const validConfidence: SampleSizeConfidence = [
                "strong",
                "usable",
                "limited",
                "insufficient"
              ].includes(item.confidence) ? item.confidence : "usable";

              // Find matching source post from intelligence if available
              const sourcePosts: any[] = [];
              if (item.dimension === "pillar" && item.dimensionValue) {
                const match = intelligence.dimensionAggregates.pillar.find(
                  (p) => p.displayName.toLowerCase() === item.dimensionValue.toLowerCase()
                );
                if (match?.topPost) {
                  sourcePosts.push({
                    mediaId: match.topPost.mediaId,
                    text: match.topPost.text,
                    publishedAt: match.topPost.publishedAt,
                    views: match.topPost.views,
                    engagementRate: match.topPost.engagementRate,
                    permalink: match.topPost.permalink
                  });
                }
              }

              return {
                id: `rec-ai-${period}-${idx}-${Date.now().toString(36)}`,
                category: validCategory,
                title: item.title,
                recommendation: item.recommendation,
                rationale: item.rationale,
                confidence: validConfidence,
                evidence: {
                  metric: item.metric || "views",
                  creatorBaseline: baselineMedianViews,
                  cohortMedian: Number(item.cohortMedian) || baselineMedianViews,
                  variancePercent: Number(item.variancePercent) || 0,
                  sampleSize: Number(item.sampleSize) || 1,
                  confidence: validConfidence,
                  confidenceExplanation: `${item.sampleSize || 1} posts analyzed (${validConfidence} evidence tier).`,
                  dimension: item.dimension,
                  dimensionValue: item.dimensionValue,
                  sourcePosts
                },
                strategicContext: {
                  pillarTitle: item.prefillPillar || (item.dimension === "pillar" ? item.dimensionValue : undefined),
                  strategicAngle: item.prefillAngle || (item.dimension === "angle" ? item.dimensionValue : undefined),
                  format: item.prefillFormat || (item.dimension === "format" ? item.dimensionValue : undefined),
                  topic: item.prefillTopic,
                  intent: validCategory === "what_to_refine" ? "conversation" : "attention"
                },
                suggestedAction: item.suggestedActionLabel ? {
                  actionLabel: item.suggestedActionLabel,
                  prefillPillar: item.prefillPillar,
                  prefillFormat: item.prefillFormat,
                  prefillAngle: item.prefillAngle,
                  prefillTopic: item.prefillTopic,
                  prefillCta: item.prefillCta
                } : undefined,
                timeWindow: period,
                createdAt: new Date().toISOString()
              };
            });

            if (aiRecs.length > 0) {
              finalRecommendations = aiRecs;
            }
          }
        }
      } catch (aiErr: any) {
        console.warn("[RECOMMENDATION_AI_WARN] AI reasoning fallback used deterministic recommendations:", aiErr?.message || aiErr);
      }
    }

    // Tally category breakdown
    const categoriesSummary = {
      whatToRepeatCount: finalRecommendations.filter((r) => r.category === "what_to_repeat").length,
      whatToTestCount: finalRecommendations.filter((r) => r.category === "what_to_test").length,
      whatToRefineCount: finalRecommendations.filter((r) => r.category === "what_to_refine").length,
      whatToAvoidCount: finalRecommendations.filter((r) => r.category === "what_to_avoid_over_repeating").length,
      contentMixCount: finalRecommendations.filter((r) => r.category === "content_mix").length
    };

    const finalResponse: PerformanceRecommendationsResponse = {
      recommendations: finalRecommendations,
      totalGenerated: finalRecommendations.length,
      timeWindow: period,
      generatedAt: new Date().toISOString(),
      creatorBaselineMedianViews: baselineMedianViews,
      creatorBaselineMedianEngagement: baselineMedianEng,
      totalPostsAnalyzed: totalPosts,
      categoriesSummary
    };

    recommendationsCache.set(cacheKey, { response: finalResponse, timestamp: now });
    return finalResponse;
  }

  /**
   * Clears recommendation cache for a specific user or globally
   */
  function invalidateCache(userId?: string) {
    if (!userId) {
      recommendationsCache.clear();
      return;
    }
    for (const key of recommendationsCache.keys()) {
      if (key.startsWith(`${userId}:`)) {
        recommendationsCache.delete(key);
      }
    }
  }

  return {
    generateRecommendations,
    invalidateCache
  };
}
