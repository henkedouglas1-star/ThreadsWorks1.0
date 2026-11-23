/**
 * ThreadsWorks Content Strategy Intelligence Service (Layer 5)
 * Synthesizes Creator Identity, Business Strategy, Offer Intelligence,
 * CTA Library, Intelligent Content Memory, and Performance Intelligence
 * into a unified Strategic Content Map and actionable Content Opportunities.
 */

import { GoogleGenAI, Type } from "@google/genai";
import {
  ContentOpportunity,
  OpportunityType,
  ContentStage,
  OpportunityStatus,
  StrategicContentMap,
  StrategyOverviewResponse,
  PillarEcosystemItem,
  StageDistributionItem,
  FormatEcosystemItem,
  AngleEcosystemItem,
  OpportunityActionRequest
} from "../src/types/strategy";
import { UserProfile, ContentPillar, ContentDestination } from "../src/types";
import { PostAnalyticsRecord, CreatorPerformanceBaseline } from "../src/types/analytics";
import { IntelligentContentMemoryProfile, ContentIdea } from "../src/types/contentMemory";
import { ContentPerformanceIntelligenceSummary, SampleSizeConfidence } from "../src/types/intelligence";

export interface StrategyIntelligenceDependencies {
  getIntelligenceSummary: (userId: string, period: "7d" | "14d" | "30d" | "90d" | "all", force?: boolean) => Promise<ContentPerformanceIntelligenceSummary>;
  getIntelligentContentMemory: (userId: string, posts: any[], userProfile?: UserProfile | null) => Promise<IntelligentContentMemoryProfile>;
  getPostAnalytics: (options: { userId: string; limit?: number }) => Promise<{ posts: PostAnalyticsRecord[]; total: number }>;
  getUserProfile: (userId: string) => Promise<UserProfile | null>;
  getPosts: (userId: string) => Promise<any[]>;
  clientDb?: any;
  serverDb?: any;
  clientDoc?: any;
  clientGetDoc?: any;
  clientSetDoc?: any;
  clientUpdateDoc?: any;
  clientCollection?: any;
  clientGetDocs?: any;
}

// In-memory cache for fast responsive returns
interface StrategyCacheEntry {
  response: StrategyOverviewResponse;
  timestamp: number;
}
const strategyCache = new Map<string, StrategyCacheEntry>();
const STRATEGY_CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

/**
 * Deterministic fast string hash for fingerprints
 */
function createSimpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Standard content formats library
 */
const HIGH_LEVERAGE_FORMATS = [
  "Step-by-Step Blueprint",
  "Contrarian Intervention",
  "Real-World Case Study",
  "Mistake Breakdown",
  "Framework & Mental Model",
  "Single Post",
  "Story Thread",
  "Myth Bust",
  "Checklist & Action Plan"
];

/**
 * Standard strategic angles taxonomy
 */
const STRATEGIC_ANGLES = [
  "Educational Explanation",
  "Contrarian Pattern Interrupt",
  "Personal Experience & Story",
  "Mistake & Anti-Pattern",
  "Framework & System",
  "Real-World Proof & Case Study",
  "Belief Shift & Reframing",
  "Problem → Mechanism → Solution",
  "Provocative Diagnostic"
];

import { getAI, callGenerateContentWithRetry } from "./geminiClient";

export function createStrategyIntelligenceService(deps: StrategyIntelligenceDependencies) {
  const getAiClient = () => getAI();

  /**
   * Builds the Strategic Content Map for a creator
   */
  function buildStrategicContentMap(
    userId: string,
    rawPosts: any[],
    profile: UserProfile | null,
    memoryProfile: IntelligentContentMemoryProfile,
    intelligence: ContentPerformanceIntelligenceSummary
  ): StrategicContentMap {
    const baselineMedianViews = intelligence.baseline?.medianViews || 50;
    const baselineMedianEng = intelligence.baseline?.medianEngagementRate || 0;
    const baselineConfidence: SampleSizeConfidence = intelligence.baseline?.confidence || "insufficient";

    // 1. Identity & Voice Summary
    const identitySummary = {
      voiceSummary: profile?.creatorIdentity?.tone || profile?.writingStyle || "Authoritative, direct, and actionable peer-to-peer communication",
      writingStyle: profile?.creatorIdentity?.writingStyle || profile?.writingStyle || "Concise, evidence-based, high-retention syntax",
      tone: profile?.creatorIdentity?.tone || "Professional, direct, clear",
      whoYouHelp: profile?.creatorIdentity?.whoYouHelp || profile?.audience || "Digital entrepreneurs and creators",
      whatYouHelpThemDo: profile?.creatorIdentity?.whatYouHelpThemDo || profile?.desiredResult || "Build sustainable organic audience and revenue",
      primaryKeywords: profile?.keywords ? profile.keywords.split(",").map(k => k.trim()).filter(Boolean) : ["Strategy", "Execution", "Systems"]
    };

    // 2. Business & Offers Summary
    const offersList = Array.isArray(profile?.offerIntelligence?.offers)
      ? profile!.offerIntelligence!.offers.map(o => ({
          id: o.id,
          name: o.name,
          type: o.type,
          relationship: o.relationshipToOtherOffers
        }))
      : (profile?.offer ? [{ id: "primary-offer", name: profile.offer, type: "core_offer" }] : []);

    const approvedDestinations = Array.isArray(profile?.contentDestinations) ? profile!.contentDestinations : [];
    
    // Extract buyer problems
    const buyerProblems: string[] = [];
    if (Array.isArray(profile?.buyerIntelligence?.buyers)) {
      for (const b of profile!.buyerIntelligence!.buyers) {
        if (b.problems?.practicalProblems) buyerProblems.push(...b.problems.practicalProblems);
        if (b.problems?.surfaceSymptoms) buyerProblems.push(...b.problems.surfaceSymptoms);
      }
    }
    if (buyerProblems.length === 0 && profile?.audience) {
      buyerProblems.push(`Overcoming friction in executing ${profile.desiredResult || "growth"}`);
    }

    const businessSummary = {
      primaryOffers: offersList,
      approvedCtaDestinations: approvedDestinations,
      keyBuyerProblems: Array.from(new Set(buyerProblems)).slice(0, 8)
    };

    // 3. Pillar Ecosystem
    const totalPostsCount = Math.max(rawPosts.length, 1);
    const configuredPillars = Array.isArray(profile?.contentPillars) ? profile!.contentPillars : [];
    
    // Map performance aggregates for pillars
    const pillarPerfMap = new Map<string, any>();
    if (Array.isArray(intelligence.dimensionAggregates?.pillar)) {
      for (const pa of intelligence.dimensionAggregates.pillar) {
        pillarPerfMap.set(pa.displayName.toLowerCase().trim(), pa);
      }
    }

    const pillarItems: PillarEcosystemItem[] = configuredPillars.map((p) => {
      const pTitle = p.title.trim();
      const matchingPosts = rawPosts.filter(
        post => (post.pillarTitle || post.decision?.pillarTitle || post.pillar || "").toLowerCase().trim() === pTitle.toLowerCase()
      );
      const postCount = matchingPosts.length;
      const sharePercent = Number(((postCount / totalPostsCount) * 100).toFixed(1));
      
      const perf = pillarPerfMap.get(pTitle.toLowerCase());
      const medianViews = perf?.medianViews || (postCount > 0 ? baselineMedianViews : 0);
      const viewsRatio = baselineMedianViews > 0 ? Number((medianViews / baselineMedianViews).toFixed(2)) : 1.0;
      
      let status: "active" | "underrepresented" | "over_indexed" | "unexplored" = "active";
      if (postCount === 0) status = "unexplored";
      else if (sharePercent < 15 && configuredPillars.length > 1) status = "underrepresented";
      else if (sharePercent > 50 && configuredPillars.length > 2) status = "over_indexed";

      const sampleConf: SampleSizeConfidence = 
        postCount >= 10 ? "strong" : postCount >= 5 ? "usable" : postCount >= 2 ? "limited" : "insufficient";

      // Formats and angles used in this pillar
      const usedFormats = new Set<string>();
      const usedAngles = new Set<string>();
      for (const mp of matchingPosts) {
        if (mp.format || mp.decision?.format) usedFormats.add(mp.format || mp.decision?.format);
        if (mp.strategicAngle || mp.decision?.strategicAngle) usedAngles.add(mp.strategicAngle || mp.decision?.strategicAngle);
      }

      const unexploredFormats = HIGH_LEVERAGE_FORMATS.filter(f => !usedFormats.has(f)).slice(0, 3);
      const unexploredAngles = STRATEGIC_ANGLES.filter(a => !usedAngles.has(a)).slice(0, 3);

      const identifiedGaps: string[] = [];
      if (postCount === 0) identifiedGaps.push("No published or drafted content under this pillar yet.");
      if (unexploredFormats.length > 0) identifiedGaps.push(`Missing formats: ${unexploredFormats.join(", ")}`);
      if (sharePercent < 15 && postCount > 0) identifiedGaps.push("Underrepresented in your recent content mix.");

      return {
        title: pTitle,
        description: p.description,
        postCount,
        sharePercent,
        medianViews,
        viewsVsBaselineRatio: viewsRatio,
        status,
        sampleSizeConfidence: sampleConf,
        evidenceNote: postCount > 0 
          ? `${postCount} post${postCount === 1 ? '' : 's'} (${sharePercent}% of library). Median reach: ${medianViews.toLocaleString()} views (${viewsRatio >= 1.0 ? '+' : ''}${((viewsRatio - 1) * 100).toFixed(0)}% vs baseline).`
          : "Unexplored pillar with no historical post evidence.",
        identifiedGaps,
        unexploredFormats,
        unexploredAngles
      };
    });

    // 4. Content Stage Distribution (What, Why, How, Proof, Action)
    const stageCounts: Record<ContentStage, number> = {
      what: 0,
      why: 0,
      how: 0,
      proof: 0,
      action: 0
    };

    for (const p of rawPosts) {
      const text = `${p.singlePost || p.text || p.content || ""} ${p.title || ""} ${p.decision?.strategicAngle || ""}`.toLowerCase();
      if (text.includes("case study") || text.includes("client") || text.includes("proof") || text.includes("results") || text.includes("transformation")) {
        stageCounts.proof++;
      } else if (text.includes("how to") || text.includes("step 1") || text.includes("step-by-step") || text.includes("blueprint") || text.includes("framework") || text.includes("checklist") || text.includes("playbook")) {
        stageCounts.how++;
      } else if (text.includes("why ") || text.includes("stop ") || text.includes("mistake") || text.includes("the reason") || text.includes("believe") || text.includes("mindset")) {
        stageCounts.why++;
      } else if (text.includes("offer") || text.includes("dm ") || text.includes("link in") || text.includes("enroll") || text.includes("book a call") || text.includes("grab the")) {
        stageCounts.action++;
      } else {
        stageCounts.what++;
      }
    }

    const stages: Record<ContentStage, StageDistributionItem> = {
      what: {
        stage: "what",
        label: "What (Definitions & Concepts)",
        description: "Introduces core terminology, ideas, and foundational mental models.",
        count: stageCounts.what,
        percentage: Number(((stageCounts.what / totalPostsCount) * 100).toFixed(1)),
        status: (stageCounts.what / totalPostsCount) > 0.45 ? "over_indexed" : (stageCounts.what / totalPostsCount) < 0.1 ? "underrepresented" : "healthy",
        recommendationNote: (stageCounts.what / totalPostsCount) > 0.45 
          ? "High volume of foundational definitions. Consider shifting some concepts into actionable 'How' blueprints or 'Proof' case studies."
          : "Balanced conceptual framing."
      },
      why: {
        stage: "why",
        label: "Why (Beliefs & Stakes)",
        description: "Establishes urgency, pattern interrupts, mistakes to avoid, and belief shifts.",
        count: stageCounts.why,
        percentage: Number(((stageCounts.why / totalPostsCount) * 100).toFixed(1)),
        status: (stageCounts.why / totalPostsCount) > 0.45 ? "over_indexed" : (stageCounts.why / totalPostsCount) < 0.1 ? "underrepresented" : "healthy",
        recommendationNote: (stageCounts.why / totalPostsCount) < 0.15
          ? "Low volume of 'Why' posts. Adding contrarian pattern interrupts or mistake breakdowns increases conversation and audience buy-in."
          : "Strong urgency and perspective framing."
      },
      how: {
        stage: "how",
        label: "How (Step-by-Step Execution)",
        description: "Actionable frameworks, practical blueprints, and tactical workflows.",
        count: stageCounts.how,
        percentage: Number(((stageCounts.how / totalPostsCount) * 100).toFixed(1)),
        status: (stageCounts.how / totalPostsCount) < 0.15 ? "underrepresented" : "healthy",
        recommendationNote: (stageCounts.how / totalPostsCount) < 0.15
          ? "Underrepresented execution content. Step-by-step blueprints establish authority and earn high bookmark/save rates."
          : "Healthy distribution of tactical implementation guides."
      },
      proof: {
        stage: "proof",
        label: "Proof (Case Studies & Data)",
        description: "Demonstrates real-world results, transformations, and client outcomes.",
        count: stageCounts.proof,
        percentage: Number(((stageCounts.proof / totalPostsCount) * 100).toFixed(1)),
        status: (stageCounts.proof / totalPostsCount) < 0.10 ? "underrepresented" : "healthy",
        recommendationNote: (stageCounts.proof / totalPostsCount) < 0.10
          ? "Proof is underrepresented. Case studies and before/after breakdowns bridge the gap between authority and buyer trust."
          : "Strong empirical evidence and case study representation."
      },
      action: {
        stage: "action",
        label: "Action (Direct Conversion & CTAs)",
        description: "Invites qualified audience members to take concrete next steps or explore offers.",
        count: stageCounts.action,
        percentage: Number(((stageCounts.action / totalPostsCount) * 100).toFixed(1)),
        status: (stageCounts.action / totalPostsCount) > 0.35 ? "over_indexed" : (stageCounts.action / totalPostsCount) < 0.05 ? "underrepresented" : "healthy",
        recommendationNote: (stageCounts.action / totalPostsCount) < 0.05
          ? "Very low conversion hand-raisers. When appropriate, pairing high-value proof posts with approved CTA paths drives business momentum."
          : "Appropriate conversion pacing."
      }
    };

    // 5. Format Ecosystem
    const formatPerfMap = new Map<string, any>();
    if (Array.isArray(intelligence.dimensionAggregates?.format)) {
      for (const fa of intelligence.dimensionAggregates.format) {
        formatPerfMap.set(fa.displayName.toLowerCase().trim(), fa);
      }
    }

    const topFormats: FormatEcosystemItem[] = HIGH_LEVERAGE_FORMATS.map((fmt) => {
      const matching = rawPosts.filter(p => (p.format || p.decision?.format || "").toLowerCase().includes(fmt.toLowerCase().slice(0, 8)));
      const postCount = matching.length;
      const perf = formatPerfMap.get(fmt.toLowerCase());
      const medianViews = perf?.medianViews || (postCount > 0 ? baselineMedianViews : 0);
      const viewsRatio = baselineMedianViews > 0 ? Number((medianViews / baselineMedianViews).toFixed(2)) : 1.0;
      const sampleConf: SampleSizeConfidence = 
        postCount >= 10 ? "strong" : postCount >= 5 ? "usable" : postCount >= 2 ? "limited" : "insufficient";

      let status: "frequently_used" | "proven_performer" | "underused" | "unexplored" = "underused";
      if (postCount === 0) status = "unexplored";
      else if (viewsRatio > 1.2 && postCount >= 2) status = "proven_performer";
      else if (postCount >= 4) status = "frequently_used";

      return {
        format: fmt,
        postCount,
        medianViews,
        viewsVsBaselineRatio: viewsRatio,
        sampleSizeConfidence: sampleConf,
        status,
        evidenceNote: postCount > 0
          ? `${postCount} post${postCount === 1 ? '' : 's'} tested. Median: ${medianViews.toLocaleString()} views (${viewsRatio >= 1.0 ? '+' : ''}${((viewsRatio - 1) * 100).toFixed(0)}% vs baseline).`
          : "Not yet tested in your published library."
      };
    });

    // 6. Strategic Angles
    const anglePerfMap = new Map<string, any>();
    if (Array.isArray(intelligence.dimensionAggregates?.angle)) {
      for (const aa of intelligence.dimensionAggregates.angle) {
        anglePerfMap.set(aa.displayName.toLowerCase().trim(), aa);
      }
    }

    const topAngles: AngleEcosystemItem[] = STRATEGIC_ANGLES.map((ang) => {
      const matching = rawPosts.filter(p => (p.strategicAngle || p.decision?.strategicAngle || "").toLowerCase().includes(ang.toLowerCase().slice(0, 8)));
      const postCount = matching.length;
      const perf = anglePerfMap.get(ang.toLowerCase());
      const medianViews = perf?.medianViews || (postCount > 0 ? baselineMedianViews : 0);
      const viewsRatio = baselineMedianViews > 0 ? Number((medianViews / baselineMedianViews).toFixed(2)) : 1.0;
      const sampleConf: SampleSizeConfidence = 
        postCount >= 10 ? "strong" : postCount >= 5 ? "usable" : postCount >= 2 ? "limited" : "insufficient";

      let status: "frequently_used" | "high_performing" | "underused" | "unexplored" = "underused";
      if (postCount === 0) status = "unexplored";
      else if (viewsRatio > 1.2 && postCount >= 2) status = "high_performing";
      else if (postCount >= 4) status = "frequently_used";

      return {
        angle: ang,
        postCount,
        medianViews,
        viewsVsBaselineRatio: viewsRatio,
        sampleSizeConfidence: sampleConf,
        status,
        evidenceNote: postCount > 0
          ? `${postCount} post${postCount === 1 ? '' : 's'} recorded. Median: ${medianViews.toLocaleString()} views.`
          : "Unexplored strategic angle."
      };
    });

    // 7. Synthesize Strategic Gaps
    const strategicGaps: StrategicContentMap["strategicGaps"] = [];
    
    // Check pillar gaps
    for (const p of pillarItems) {
      if (p.status === "unexplored") {
        strategicGaps.push({
          id: `gap-pillar-${createSimpleHash(p.title)}`,
          type: "unexplored_pillar",
          title: `Unexplored Pillar: ${p.title}`,
          description: `You have configured the "${p.title}" pillar, but have not yet developed posts around its core mental models.`,
          priority: "high",
          targetPillar: p.title,
          suggestedAction: `Publish a foundational framework post under "${p.title}".`
        });
      } else if (p.status === "underrepresented") {
        strategicGaps.push({
          id: `gap-pillar-${createSimpleHash(p.title)}`,
          type: "underrepresented_pillar",
          title: `Underrepresented Pillar: ${p.title}`,
          description: `"${p.title}" accounts for only ${p.sharePercent}% of your content library.`,
          priority: "medium",
          targetPillar: p.title,
          suggestedAction: `Develop a step-by-step or case study post to strengthen this pillar.`
        });
      }
    }

    // Check stage gaps
    if (stages.how.status === "underrepresented") {
      strategicGaps.push({
        id: "gap-stage-how",
        type: "stage_gap_how",
        title: "Execution Stage Gap (How-To / Blueprints)",
        description: "Tactical step-by-step guides represent less than 15% of your content. Adding actionable blueprints increases bookmark and save rates.",
        priority: "high",
        targetStage: "how",
        suggestedAction: "Create a tactical blueprint breaking down an exact process."
      });
    }

    if (stages.proof.status === "underrepresented") {
      strategicGaps.push({
        id: "gap-stage-proof",
        type: "stage_gap_proof",
        title: "Evidence & Proof Gap (Case Studies)",
        description: "Case studies and real-world results represent less than 10% of your posts. Proof anchors abstract concepts in reality.",
        priority: "medium",
        targetStage: "proof",
        suggestedAction: "Draft a breakdown detailing a client transformation or concrete milestone."
      });
    }

    return {
      creatorId: userId,
      generatedAt: new Date().toISOString(),
      identitySummary,
      businessSummary,
      pillars: pillarItems,
      stages,
      topFormats,
      topAngles,
      performanceBaselines: {
        medianViews: baselineMedianViews,
        averageViews: intelligence.baseline?.averageViews || baselineMedianViews,
        medianEngagementRate: baselineMedianEng,
        totalSampledPosts: intelligence.baseline?.totalPostsSampled || rawPosts.length,
        confidence: baselineConfidence
      },
      strategicGaps
    };
  }

  /**
   * Deterministic Rule-Based Opportunity Engine
   * Generates high-leverage opportunities grounded strictly in real creator context and evidence
   */
  function generateDeterministicOpportunities(
    userId: string,
    rawPosts: any[],
    profile: UserProfile | null,
    memoryProfile: IntelligentContentMemoryProfile,
    map: StrategicContentMap
  ): ContentOpportunity[] {
    const opportunities: ContentOpportunity[] = [];
    const baselineMedianViews = map.performanceBaselines.medianViews || 50;
    const approvedDestinations = map.businessSummary.approvedCtaDestinations || [];
    const primaryOffer = map.businessSummary.primaryOffers[0];
    const nowStr = new Date().toISOString();

    const ideas = Array.isArray(memoryProfile.ideas) ? memoryProfile.ideas : [];
    const gaps = map.strategicGaps;

    // Helper: Find matching source posts for a concept
    const getSourcePostsForIdea = (idea: ContentIdea) => {
      return idea.variations.slice(0, 3).map(v => {
        const fullPost = rawPosts.find(p => String(p.id) === String(v.postId));
        return {
          mediaId: v.postId,
          id: v.postId,
          title: v.title,
          hook: v.hook,
          views: v.views || 0,
          engagementRate: v.engagementRate || 0,
          format: v.format,
          strategicAngle: v.strategicAngle,
          publishedAt: v.createdAt
        };
      });
    };

    // -------------------------------------------------------------
    // 1. EXPAND OPPORTUNITIES: Proven concepts with unexplored depth
    // -------------------------------------------------------------
    for (const idea of ideas) {
      if (idea.usageCount >= 1 && idea.unusedFormats.length > 0) {
        const targetFormat = idea.unusedFormats.find(f => f.includes("Case Study") || f.includes("Blueprint") || f.includes("Breakdown")) || idea.unusedFormats[0];
        const sourcePosts = getSourcePostsForIdea(idea);
        const topPostViews = idea.performanceSummary?.medianViews || baselineMedianViews;
        const conf: SampleSizeConfidence = idea.usageCount >= 5 ? "strong" : idea.usageCount >= 2 ? "usable" : "limited";

        const fingerprint = createSimpleHash(`expand_${idea.canonicalConcept}_${targetFormat}`);
        const oppId = `opp_expand_${fingerprint}`;

        opportunities.push({
          id: oppId,
          creatorId: userId,
          type: "expand",
          title: `Expand "${idea.canonicalConcept.slice(0, 45)}..." into a ${targetFormat}`,
          strategicReason: `You have published on this concept ${idea.usageCount} time${idea.usageCount === 1 ? '' : 's'} primarily in ${idea.formatsUsed.join(', ') || 'single post format'}. Converting it into a ${targetFormat} unlocks deeper technical execution for your audience.`,
          concept: idea.canonicalConcept,
          pillar: idea.primaryPillar || map.pillars[0]?.title,
          angle: "Framework & System",
          stage: targetFormat.includes("Case Study") ? "proof" : "how",
          format: targetFormat,
          audienceProblem: `Audience understands the high-level concept but needs a structured implementation blueprint.`,
          businessConnection: `Deepens authority on core topic and establishes clear competence.`,
          performanceContext: {
            baselineMedianViews,
            cohortMedianViews: topPostViews,
            variancePercent: baselineMedianViews > 0 ? Number((((topPostViews - baselineMedianViews) / baselineMedianViews) * 100).toFixed(1)) : 0,
            sampleSize: idea.usageCount,
            confidence: conf,
            historicalNote: `${idea.usageCount} historical post${idea.usageCount === 1 ? '' : 's'} recorded with median reach of ${topPostViews.toLocaleString()} views.`
          },
          evidenceLevel: conf,
          evidenceExplanation: `Surfaced because you have tested this idea in ${idea.formatsUsed.join(', ') || 'basic formats'}, but a structured ${targetFormat} variation has not yet been published.`,
          sourceContentIds: idea.postIds,
          sourcePosts,
          relatedConceptIds: [idea.id],
          recommendedAction: `Create a ${targetFormat} breaking down the operational mechanics of "${idea.canonicalConcept.slice(0, 40)}".`,
          status: "new",
          fingerprint,
          freshnessScore: 92,
          createdAt: nowStr,
          updatedAt: nowStr
        });
      }
    }

    // -------------------------------------------------------------
    // 2. REFRAME OPPORTUNITIES: Approach concept from contrasting angle
    // -------------------------------------------------------------
    for (const idea of ideas) {
      if (idea.usageCount >= 1) {
        const hasContrarian = idea.anglesUsed.some(a => a.toLowerCase().includes("contrarian") || a.toLowerCase().includes("mistake"));
        const targetAngle = hasContrarian ? "Personal Experience & Story" : "Contrarian Pattern Interrupt";
        const targetStage: ContentStage = hasContrarian ? "proof" : "why";
        const sourcePosts = getSourcePostsForIdea(idea);
        const conf: SampleSizeConfidence = idea.usageCount >= 4 ? "strong" : "limited";

        const fingerprint = createSimpleHash(`reframe_${idea.canonicalConcept}_${targetAngle}`);
        const oppId = `opp_reframe_${fingerprint}`;

        opportunities.push({
          id: oppId,
          creatorId: userId,
          type: "reframe",
          title: `Reframe "${idea.canonicalConcept.slice(0, 40)}..." as a ${targetAngle}`,
          strategicReason: `Your previous content on this idea was delivered through ${idea.anglesUsed.join(', ') || 'direct explanation'}. Reframing it through a ${targetAngle} disrupts conventional assumptions and stimulates comment engagement.`,
          concept: idea.canonicalConcept,
          pillar: idea.primaryPillar || map.pillars[0]?.title,
          angle: targetAngle,
          stage: targetStage,
          format: "Contrarian Intervention",
          audienceProblem: `Audience is adhering to traditional dogmas that limit their results.`,
          businessConnection: `Positions your methodology as distinct from generic industry advice.`,
          performanceContext: {
            baselineMedianViews,
            cohortMedianViews: baselineMedianViews,
            variancePercent: 0,
            sampleSize: idea.usageCount,
            confidence: conf,
            historicalNote: `Previous posts on this idea averaged ${idea.performanceSummary?.medianViews || baselineMedianViews} views.`
          },
          evidenceLevel: conf,
          evidenceExplanation: `Surfaced because existing posts used ${idea.anglesUsed.join(', ') || 'standard framing'}; a contrasting ${targetAngle} introduces productive novelty.`,
          sourceContentIds: idea.postIds,
          sourcePosts,
          relatedConceptIds: [idea.id],
          recommendedAction: `Draft a pattern interrupt challenging common misconceptions regarding "${idea.canonicalConcept.slice(0, 35)}".`,
          status: "new",
          fingerprint,
          freshnessScore: 88,
          createdAt: nowStr,
          updatedAt: nowStr
        });
      }
    }

    // -------------------------------------------------------------
    // 3. VARY OPPORTUNITIES: Strategic variations in format and angle
    // -------------------------------------------------------------
    for (const idea of ideas) {
      if (idea.usageCount >= 1) {
        const unusedAngles = ["Framework & System", "Problem → Mechanism → Solution", "Common Mistakes & Traps", "Data & Observation", "Actionable Checklist"].filter(
          a => !idea.anglesUsed.some(u => u.toLowerCase() === a.toLowerCase())
        );
        const targetAngle = unusedAngles[0] || "Problem → Mechanism → Solution";
        const targetFormat = idea.unusedFormats[0] || "Step-by-Step Blueprint";
        const sourcePosts = getSourcePostsForIdea(idea);
        const topPostViews = idea.performanceSummary?.medianViews || baselineMedianViews;
        const conf: SampleSizeConfidence = idea.usageCount >= 3 ? "usable" : "limited";

        const fingerprint = createSimpleHash(`vary_${idea.canonicalConcept}_${targetAngle}_${targetFormat}`);
        const oppId = `opp_vary_${fingerprint}`;

        opportunities.push({
          id: oppId,
          creatorId: userId,
          type: "vary",
          title: `Variation: Apply "${targetAngle}" to "${idea.canonicalConcept.slice(0, 35)}..."`,
          strategicReason: `You have addressed this concept with ${idea.anglesUsed.join(', ') || 'initial framing'}. Testing a "${targetAngle}" in a ${targetFormat} structure verifies if alternative framing unlocks higher audience reach.`,
          concept: idea.canonicalConcept,
          pillar: idea.primaryPillar || map.pillars[0]?.title,
          angle: targetAngle,
          stage: "how",
          format: targetFormat,
          audienceProblem: `Audience requires an alternative framing mechanism to integrate this concept into their daily workflow.`,
          businessConnection: `Tests multi-angle audience resonance on core topics.`,
          performanceContext: {
            baselineMedianViews,
            cohortMedianViews: topPostViews,
            variancePercent: baselineMedianViews > 0 ? Number((((topPostViews - baselineMedianViews) / baselineMedianViews) * 100).toFixed(1)) : 0,
            sampleSize: idea.usageCount,
            confidence: conf,
            historicalNote: `${idea.usageCount} historical post${idea.usageCount === 1 ? '' : 's'} on this concept with median reach of ${topPostViews.toLocaleString()} views.`
          },
          evidenceLevel: conf,
          evidenceExplanation: `Surfaced because this concept has established baseline traction, but the "${targetAngle}" angle has not yet been deployed.`,
          sourceContentIds: idea.postIds,
          sourcePosts,
          relatedConceptIds: [idea.id],
          recommendedAction: `Draft a ${targetFormat} framing "${idea.canonicalConcept.slice(0, 35)}" through ${targetAngle}.`,
          status: "new",
          fingerprint,
          freshnessScore: 89,
          createdAt: nowStr,
          updatedAt: nowStr
        });
        break; // Keep feed balanced
      }
    }

    // -------------------------------------------------------------
    // 4. STRENGTHEN OPPORTUNITIES: Reinforce underrepresented pillars & stages
    // -------------------------------------------------------------
    for (const pillar of map.pillars) {
      if (pillar.sharePercent < 20 && pillar.postCount >= 1) {
        const fingerprint = createSimpleHash(`strengthen_${pillar.title}`);
        const oppId = `opp_strengthen_${fingerprint}`;

        opportunities.push({
          id: oppId,
          creatorId: userId,
          type: "strengthen",
          title: `Strengthen Pillar: Deepen authority on "${pillar.title}"`,
          strategicReason: `Your content ecosystem currently allocates only ${pillar.sharePercent}% of recent volume to "${pillar.title}". Deepening this pillar establishes balanced multi-dimensional authority.`,
          concept: `Core Methodology for ${pillar.title}`,
          pillar: pillar.title,
          angle: "Framework & System",
          stage: "how",
          format: "Step-by-Step Blueprint",
          audienceProblem: `Audience needs deeper, consistent coverage of ${pillar.title} to master foundational execution.`,
          businessConnection: `Maintains a balanced knowledge graph across your primary expertise areas.`,
          performanceContext: {
            baselineMedianViews,
            sampleSize: pillar.postCount,
            confidence: "usable" as SampleSizeConfidence,
            historicalNote: `${pillar.postCount} post${pillar.postCount === 1 ? '' : 's'} published in this pillar.`
          },
          evidenceLevel: "usable",
          evidenceExplanation: `Surfaced because "${pillar.title}" is a primary content pillar but represents only ${pillar.sharePercent}% of published content.`,
          sourceContentIds: [],
          sourcePosts: [],
          relatedConceptIds: [],
          recommendedAction: `Publish a structured implementation framework on "${pillar.title}" to reinforce this pillar's share of voice.`,
          status: "new",
          fingerprint,
          freshnessScore: 91,
          createdAt: nowStr,
          updatedAt: nowStr
        });
        break;
      }
    }

    // -------------------------------------------------------------
    // 5. CONTINUE OPPORTUNITIES: Next installment in proven series / concepts
    // -------------------------------------------------------------
    for (const idea of ideas) {
      if (idea.usageCount >= 2) {
        const fingerprint = createSimpleHash(`continue_${idea.canonicalConcept}`);
        const oppId = `opp_continue_${fingerprint}`;
        const sourcePosts = getSourcePostsForIdea(idea);
        const topPostViews = idea.performanceSummary?.medianViews || baselineMedianViews;

        opportunities.push({
          id: oppId,
          creatorId: userId,
          type: "continue",
          title: `Continue Series: Advanced Implementation of "${idea.canonicalConcept.slice(0, 35)}..."`,
          strategicReason: `You have built proven audience recognition with ${idea.usageCount} posts on this concept. Creating an advanced sequel or deep-dive progression rewards repeat followers and deepens trust.`,
          concept: `${idea.canonicalConcept} - Advanced Operational Phase`,
          pillar: idea.primaryPillar || map.pillars[0]?.title,
          angle: "Advanced Execution & Nuance",
          stage: "how",
          format: "Step-by-Step Blueprint",
          audienceProblem: `Audience has learned the fundamentals and now faces intermediate execution roadblocks.`,
          businessConnection: `Transitions casual readers into committed practitioners.`,
          performanceContext: {
            baselineMedianViews,
            cohortMedianViews: topPostViews,
            variancePercent: baselineMedianViews > 0 ? Number((((topPostViews - baselineMedianViews) / baselineMedianViews) * 100).toFixed(1)) : 0,
            sampleSize: idea.usageCount,
            confidence: idea.usageCount >= 4 ? "strong" : "usable",
            historicalNote: `${idea.usageCount} previous posts established core audience familiarity.`
          },
          evidenceLevel: idea.usageCount >= 4 ? "strong" : "usable",
          evidenceExplanation: `Surfaced because high usage count (${idea.usageCount} posts) indicates an established thematic series that warrants a natural sequential progression.`,
          sourceContentIds: idea.postIds,
          sourcePosts,
          relatedConceptIds: [idea.id],
          recommendedAction: `Publish Part 2 / Advanced Deep Dive addressing edge-cases and optimization tactics for "${idea.canonicalConcept.slice(0, 35)}".`,
          status: "new",
          fingerprint,
          freshnessScore: 93,
          createdAt: nowStr,
          updatedAt: nowStr
        });
        break;
      }
    }

    // -------------------------------------------------------------
    // 6. FILL_GAP OPPORTUNITIES: Address strategic gaps
    // -------------------------------------------------------------
    for (const gap of gaps) {
      const fingerprint = createSimpleHash(`gap_${gap.id}`);
      const oppId = `opp_gap_${fingerprint}`;
      const targetPillar = gap.targetPillar || map.pillars[0]?.title || "Core Strategy";
      const targetStage: ContentStage = gap.targetStage || "how";

      opportunities.push({
        id: oppId,
        creatorId: userId,
        type: "fill_gap",
        title: `Strategic Gap: ${gap.title}`,
        strategicReason: gap.description,
        concept: `${gap.title} - Comprehensive Framework`,
        pillar: targetPillar,
        angle: targetStage === "how" ? "Framework & System" : "Educational Explanation",
        stage: targetStage,
        format: targetStage === "how" ? "Step-by-Step Blueprint" : "Single Post",
        audienceProblem: `Audience lacks structured guidance in this critical operational area.`,
        businessConnection: `Balances your content ecosystem and eliminates blind spots in audience education.`,
        performanceContext: {
          baselineMedianViews,
          historicalNote: "Identified from content mix distribution analysis.",
          confidence: "usable" as SampleSizeConfidence
        },
        evidenceLevel: "usable",
        evidenceExplanation: `Surfaced because current content distribution shows a clear deficit in ${gap.title}.`,
        sourceContentIds: [],
        sourcePosts: [],
        relatedConceptIds: [],
        recommendedAction: gap.suggestedAction,
        status: "new",
        fingerprint,
        freshnessScore: 95,
        createdAt: nowStr,
        updatedAt: nowStr
      });
    }

    // -------------------------------------------------------------
    // 7. TEST OPPORTUNITIES: Experimental combinations
    // -------------------------------------------------------------
    for (const fmt of map.topFormats) {
      if (fmt.status === "unexplored") {
        const pillar = map.pillars[0]?.title || "Core Strategy";
        const fingerprint = createSimpleHash(`test_${pillar}_${fmt.format}`);
        const oppId = `opp_test_${fingerprint}`;

        opportunities.push({
          id: oppId,
          creatorId: userId,
          type: "test",
          title: `Format Experiment: Test ${fmt.format} on "${pillar}"`,
          strategicReason: `You have not yet tested the ${fmt.format} structure in your library. Running a controlled test against your baseline will benchmark its audience resonance.`,
          concept: `Applying ${fmt.format} to ${pillar}`,
          pillar,
          angle: "Framework & System",
          stage: "how",
          format: fmt.format,
          audienceProblem: `Testing whether a structured ${fmt.format} delivers superior retention compared to standard posts.`,
          businessConnection: `Identifies high-performing content formats for your specific audience.`,
          performanceContext: {
            baselineMedianViews,
            sampleSize: 0,
            confidence: "insufficient",
            historicalNote: "Experimental format test. No historical posts yet."
          },
          evidenceLevel: "insufficient",
          evidenceExplanation: `Surfaced as a strategic experiment because this high-leverage format is completely untested in your library.`,
          sourceContentIds: [],
          sourcePosts: [],
          relatedConceptIds: [],
          recommendedAction: `Publish a single ${fmt.format} and observe 7-day retention vs your personal baseline of ${baselineMedianViews} views.`,
          status: "new",
          fingerprint,
          freshnessScore: 85,
          createdAt: nowStr,
          updatedAt: nowStr
        });
        break; // Only 1-2 experiments at a time
      }
    }

    // -------------------------------------------------------------
    // 5. CONVERT OPPORTUNITIES: Contextually aligned with creator's offers
    // -------------------------------------------------------------
    if (primaryOffer && approvedDestinations.length > 0) {
      const topDest = approvedDestinations[0];
      const matchingPillar = map.pillars[0]?.title || "Strategy";
      const fingerprint = createSimpleHash(`convert_${primaryOffer.name}_${topDest.id}`);
      const oppId = `opp_convert_${fingerprint}`;

      opportunities.push({
        id: oppId,
        creatorId: userId,
        type: "convert",
        title: `Offer Alignment: Connect "${matchingPillar}" to ${primaryOffer.name}`,
        strategicReason: `Demonstrate concrete problem recognition in "${matchingPillar}" and introduce ${primaryOffer.name} via your approved destination link "${topDest.name}".`,
        concept: `Solving the core friction point addressed by ${primaryOffer.name}`,
        pillar: matchingPillar,
        angle: "Problem → Mechanism → Solution",
        stage: "action",
        format: "Real-World Case Study",
        audienceProblem: map.businessSummary.keyBuyerProblems[0] || `Friction in achieving consistent outcomes with ${matchingPillar}.`,
        businessConnection: `Directly drives qualified interest to ${primaryOffer.name}.`,
        performanceContext: {
          baselineMedianViews,
          historicalNote: "Conversion opportunity linked to verified creator offer.",
          confidence: "usable" as SampleSizeConfidence
        },
        evidenceLevel: "usable",
        evidenceExplanation: `Surfaced because you have a configured offer (${primaryOffer.name}) and an approved destination (${topDest.name}) with no active conversion posts in your recent pipeline.`,
        sourceContentIds: [],
        sourcePosts: [],
        relatedConceptIds: [],
        recommendedAction: `Draft a high-value breakdown showing how to solve the root problem, inviting interested readers to check out ${topDest.name}.`,
        suggestedCTA: {
          label: `Check out ${primaryOffer.name}`,
          message: `If you want the complete implementation system, explore ${topDest.name}:`,
          destinationUrl: topDest.url,
          destinationName: topDest.name,
          relationship: "relevant_cta",
          offerName: primaryOffer.name
        },
        status: "new",
        fingerprint,
        freshnessScore: 90,
        createdAt: nowStr,
        updatedAt: nowStr
      });
    }

    return opportunities;
  }

  /**
   * Generates or retrieves full Strategy Overview
   */
  async function getStrategyOverview(
    userId: string,
    options?: { forceRefresh?: boolean; timeWindow?: "7d" | "14d" | "30d" | "90d" | "all" }
  ): Promise<StrategyOverviewResponse> {
    const period = options?.timeWindow || "all";
    const cacheKey = `${userId}:${period}`;
    const now = Date.now();

    if (!options?.forceRefresh) {
      const cached = strategyCache.get(cacheKey);
      if (cached && now - cached.timestamp < STRATEGY_CACHE_TTL_MS) {
        return cached.response;
      }
    }

    // 1. Fetch dependencies in parallel
    const [rawPosts, profile, intelligence, memoryProfile] = await Promise.all([
      deps.getPosts(userId).catch(() => []),
      deps.getUserProfile(userId).catch(() => null),
      deps.getIntelligenceSummary(userId, period).catch(() => ({
        userId,
        period,
        baseline: {
          userId,
          period,
          totalPostsSampled: 0,
          postsWithMemoryContext: 0,
          confidence: "insufficient" as SampleSizeConfidence,
          medianViews: 50,
          averageViews: 50,
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
        },
        dimensionAggregates: { pillar: [], format: [], angle: [], topic: [], cta: [], mediaType: [] },
        combinationAggregates: [],
        outliers: [],
        observations: [],
        generatedAt: new Date().toISOString(),
        hasPostAnalytics: false
      } as unknown as ContentPerformanceIntelligenceSummary)),
      deps.getIntelligentContentMemory(userId, await deps.getPosts(userId).catch(() => []), await deps.getUserProfile(userId).catch(() => null))
        .catch(() => ({
          userId,
          lastUpdated: Date.now(),
          totalPostsIndexed: 0,
          totalIdeasIdentified: 0,
          ideas: [],
          relationships: [],
          gaps: [],
          repetitionSummary: {
            totalIdeas: 0,
            strategicRepetitions: 0,
            accidentalRepetitions: 0,
            healthyRepetitionRatioPct: 100,
            freshnessScore: 100
          },
          coverage: {
            pillarDistribution: {},
            deliveryTypeDistribution: { what: 0, why: 0, how: 0, proof: 0, action: 0 },
            formatDistribution: {}
          },
          recentHooks: [],
          authenticVocabulary: [],
          signaturePhrases: []
        } as IntelligentContentMemoryProfile))
    ]);

    // 2. Build the Strategic Content Map
    const map = buildStrategicContentMap(userId, rawPosts, profile, memoryProfile, intelligence);

    // 3. Generate Opportunities (Deterministic Baseline)
    let opportunities = generateDeterministicOpportunities(userId, rawPosts, profile, memoryProfile, map);

    // 4. Try AI-powered refinement if Gemini API is active
    if (process.env.GEMINI_API_KEY && rawPosts.length >= 2) {
      try {
        const ai = getAiClient();
        const prompt = `You are the ThreadsWorks Strategic Opportunity Engine.
Synthesize the following creator profile, performance evidence, and content memory into 4 to 6 strategic, high-leverage content opportunities.

CREATOR IDENTITY:
Voice: ${map.identitySummary.voiceSummary}
Writing Style: ${map.identitySummary.writingStyle}
Target Audience: ${map.identitySummary.whoYouHelp}
Desired Result: ${map.identitySummary.whatYouHelpThemDo}

STRATEGIC PILLARS:
${map.pillars.map(p => `- ${p.title} (${p.postCount} posts, ${p.sharePercent}%, status: ${p.status})`).join("\n")}

CONTENT STAGE DISTRIBUTION:
- What: ${map.stages.what.count} (${map.stages.what.percentage}%)
- Why: ${map.stages.why.count} (${map.stages.why.percentage}%)
- How: ${map.stages.how.count} (${map.stages.how.percentage}%)
- Proof: ${map.stages.proof.count} (${map.stages.proof.percentage}%)
- Action: ${map.stages.action.count} (${map.stages.action.percentage}%)

IDENTIFIED STRATEGIC GAPS:
${map.strategicGaps.map(g => `- ${g.title}: ${g.description}`).join("\n")}

CANONICAL IDEAS IN MEMORY (${memoryProfile.ideas.length}):
${memoryProfile.ideas.slice(0, 5).map(i => `- "${i.canonicalConcept}" (used ${i.usageCount}x, angles: ${i.anglesUsed.join(", ")}, unused formats: ${i.unusedFormats.join(", ")})`).join("\n")}

CREATOR OFFERS:
${map.businessSummary.primaryOffers.map(o => `- ${o.name} (${o.type || "offer"})`).join("\n") || "None configured"}

APPROVED CTA DESTINATIONS (DO NOT INVENT ANY OTHER URLS):
${map.businessSummary.approvedCtaDestinations.map(d => `- ${d.name}: ${d.url}`).join("\n") || "None configured"}

REQUIREMENTS:
1. Provide opportunities across types: 'expand', 'reframe', 'fill_gap', 'vary', 'strengthen', 'test', 'convert'.
2. For each opportunity, provide a factual, evidence-based strategic reason.
3. If type is 'convert', use ONLY approved CTA destinations. Never invent a URL.
4. Output JSON strictly matching the schema.`;

        const aiResponse = await callGenerateContentWithRetry(ai, {
          model: "gemini-2.5-flash",
          optimizationTaskId: "STRATEGY_OPPORTUNITIES",
          optimizationComplexity: "LEVEL_3_ADVANCED",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING, enum: ["expand", "reframe", "fill_gap", "vary", "strengthen", "test", "continue", "convert"] },
                  title: { type: Type.STRING },
                  strategicReason: { type: Type.STRING },
                  concept: { type: Type.STRING },
                  pillar: { type: Type.STRING },
                  angle: { type: Type.STRING },
                  stage: { type: Type.STRING, enum: ["what", "why", "how", "proof", "action"] },
                  format: { type: Type.STRING },
                  audienceProblem: { type: Type.STRING },
                  businessConnection: { type: Type.STRING },
                  recommendedAction: { type: Type.STRING },
                  ctaLabel: { type: Type.STRING },
                  ctaMessage: { type: Type.STRING },
                  ctaDestinationName: { type: Type.STRING }
                },
                required: ["type", "title", "strategicReason", "concept", "stage", "format", "recommendedAction"]
              }
            }
          }
        });

        if (aiResponse.text) {
          const parsed = JSON.parse(aiResponse.text);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const aiOpps: ContentOpportunity[] = parsed.map((item, idx) => {
              const fingerprint = createSimpleHash(`ai_${item.type}_${item.concept}_${item.format}_${idx}`);
              const oppId = `opp_${item.type}_${fingerprint}`;
              
              // Validate CTA
              let suggestedCTA = undefined;
              if (item.type === "convert" && item.ctaDestinationName) {
                const matchedDest = map.businessSummary.approvedCtaDestinations.find(
                  d => d.name.toLowerCase() === item.ctaDestinationName.toLowerCase()
                ) || map.businessSummary.approvedCtaDestinations[0];

                if (matchedDest) {
                  suggestedCTA = {
                    label: item.ctaLabel || `Check out ${matchedDest.name}`,
                    message: item.ctaMessage || `Explore ${matchedDest.name}:`,
                    destinationUrl: matchedDest.url,
                    destinationName: matchedDest.name,
                    relationship: "relevant_cta" as const
                  };
                }
              }

              return {
                id: oppId,
                creatorId: userId,
                type: item.type as OpportunityType,
                title: item.title,
                strategicReason: item.strategicReason,
                concept: item.concept,
                pillar: item.pillar || map.pillars[0]?.title,
                angle: item.angle || "Framework & System",
                stage: item.stage as ContentStage,
                format: item.format,
                audienceProblem: item.audienceProblem || "Overcoming friction in execution",
                businessConnection: item.businessConnection || "Strengthens core authority",
                performanceContext: {
                  baselineMedianViews: map.performanceBaselines.medianViews,
                  historicalNote: "Generated from synthesized creator intelligence.",
                  confidence: (rawPosts.length >= 5 ? "usable" : "limited") as SampleSizeConfidence
                },
                evidenceLevel: (rawPosts.length >= 5 ? "usable" : "limited") as SampleSizeConfidence,
                evidenceExplanation: item.strategicReason,
                sourceContentIds: [],
                sourcePosts: [],
                relatedConceptIds: [],
                recommendedAction: item.recommendedAction,
                suggestedCTA,
                status: "new" as OpportunityStatus,
                fingerprint,
                freshnessScore: 94,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              };
            });

            if (aiOpps.length > 0) {
              opportunities = aiOpps;
            }
          }
        }
      } catch (aiErr: any) {
        console.warn("[StrategyIntelligence] AI generation fallback to deterministic rules:", aiErr?.message || aiErr);
      }
    }

    // 5. Merge with Stored User Strategy State from Firestore (Persisting Saved, Planned, Dismissed status)
    if (deps.serverDb && userId !== "anonymous") {
      try {
        const snap = await deps.serverDb.collection("strategy_opportunities")
          .where("userId", "==", userId)
          .get();

        if (!snap.empty) {
          const storedMap = new Map<string, any>();
          snap.forEach((doc: any) => {
            const data = doc.data();
            storedMap.set(data.fingerprint || data.id, data);
          });

          // Merge stored status
          opportunities = opportunities.map(opp => {
            const existing = storedMap.get(opp.fingerprint) || storedMap.get(opp.id);
            if (existing) {
              return {
                ...opp,
                status: existing.status || opp.status,
                scheduledDate: existing.scheduledDate || opp.scheduledDate,
                createdPostId: existing.createdPostId || opp.createdPostId
              };
            }
            return opp;
          });

          // Add any previously saved or planned opportunities not present in current generation
          snap.forEach((doc: any) => {
            const data = doc.data();
            if (data.status === "saved" || data.status === "planned") {
              const alreadyIncluded = opportunities.some(o => o.id === data.id || o.fingerprint === data.fingerprint);
              if (!alreadyIncluded) {
                opportunities.push(data as ContentOpportunity);
              }
            }
          });
        }
      } catch (dbErr: any) {
        console.warn("[StrategyIntelligence] Firestore read error:", dbErr.message);
      }
    }

    // 6. Summary Tally
    const byType: Record<OpportunityType, number> = {
      expand: 0,
      reframe: 0,
      fill_gap: 0,
      vary: 0,
      strengthen: 0,
      test: 0,
      continue: 0,
      convert: 0
    };
    const byStage: Record<ContentStage, number> = {
      what: 0,
      why: 0,
      how: 0,
      proof: 0,
      action: 0
    };
    const byConfidence: Record<SampleSizeConfidence, number> = {
      insufficient: 0,
      limited: 0,
      usable: 0,
      strong: 0
    };

    let savedCount = 0;
    let plannedCount = 0;
    let createdCount = 0;
    let dismissedCount = 0;

    for (const o of opportunities) {
      if (byType[o.type] !== undefined) byType[o.type]++;
      if (byStage[o.stage] !== undefined) byStage[o.stage]++;
      if (byConfidence[o.evidenceLevel] !== undefined) byConfidence[o.evidenceLevel]++;

      if (o.status === "saved") savedCount++;
      if (o.status === "planned") plannedCount++;
      if (o.status === "created") createdCount++;
      if (o.status === "dismissed") dismissedCount++;
    }

    const response: StrategyOverviewResponse = {
      map,
      opportunities,
      summary: {
        totalOpportunities: opportunities.length,
        byType,
        byStage,
        byConfidence,
        savedCount,
        plannedCount,
        createdCount,
        dismissedCount
      },
      generatedAt: new Date().toISOString(),
      timeWindow: period,
      hasAnalytics: Boolean(intelligence.baseline?.totalPostsSampled > 0),
      hasMemory: Boolean(memoryProfile.ideas.length > 0)
    };

    strategyCache.set(cacheKey, { response, timestamp: now });
    return response;
  }

  /**
   * Updates an Opportunity Action (Save, Plan, Dismiss, Create Link)
   */
  async function handleOpportunityAction(
    userId: string,
    opportunityId: string,
    actionReq: OpportunityActionRequest
  ): Promise<{ success: boolean; updatedOpportunity?: ContentOpportunity; message?: string }> {
    if (!userId || !opportunityId) {
      return { success: false, message: "Missing userId or opportunityId" };
    }

    // Invalidate cache
    for (const key of strategyCache.keys()) {
      if (key.startsWith(`${userId}:`)) strategyCache.delete(key);
    }

    let newStatus: OpportunityStatus = "new";
    if (actionReq.action === "save") newStatus = "saved";
    else if (actionReq.action === "plan") newStatus = "planned";
    else if (actionReq.action === "dismiss") newStatus = "dismissed";
    else if (actionReq.action === "create") newStatus = "created";
    else if (actionReq.action === "restore") newStatus = "new";

    const updatePayload: any = {
      userId,
      opportunityId,
      status: newStatus,
      updatedAt: new Date().toISOString()
    };

    if (actionReq.scheduledDate) updatePayload.scheduledDate = actionReq.scheduledDate;
    if (actionReq.postId) updatePayload.createdPostId = actionReq.postId;

    // Persist to Firestore
    if (deps.serverDb && userId !== "anonymous") {
      try {
        await deps.serverDb.collection("strategy_opportunities").doc(`${userId}_${opportunityId}`).set(updatePayload, { merge: true });
      } catch (err: any) {
        console.warn("[StrategyIntelligence] Firestore opportunity status write error:", err.message);
      }
    }

    return {
      success: true,
      message: `Opportunity ${opportunityId} updated to ${newStatus}`
    };
  }

  function invalidateUserStrategyCache(userId: string): void {
    if (!userId) return;
    for (const key of strategyCache.keys()) {
      if (key.startsWith(`${userId}:`)) strategyCache.delete(key);
    }
  }

  return {
    getStrategyOverview,
    handleOpportunityAction,
    buildStrategicContentMap,
    generateDeterministicOpportunities,
    invalidateUserStrategyCache,
    getUserProfile: deps.getUserProfile,
    getPosts: deps.getPosts
  };
}
