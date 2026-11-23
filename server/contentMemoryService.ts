/**
 * ThreadsWorks Intelligent Content Memory Service
 * Provides server-side idea extraction, semantic clustering, relationship classification,
 * repetition intelligence, performance integration, variation detection, gap analysis,
 * conceptual search, and targeted AI context generation.
 */

import {
  ContentIdea,
  ContentRelationship,
  ContentGapOpportunity,
  IdeaPerformanceSummary,
  IntelligentContentMemoryProfile,
  RelationshipType,
  RelationshipConfidence,
  RepetitionClassification,
  SemanticSearchQuery,
  SemanticSearchResponse,
  SemanticSearchResultItem,
  SimilarityCheckRequest,
  SimilarityCheckResult,
  RelevantMemoryContext,
  ContentIdeaVariation
} from "../src/types/contentMemory";
import { UserProfile } from "../src/types";
import { PostAnalyticsRecord, CreatorPerformanceBaseline } from "../src/types/analytics";
import { GoogleGenAI, Type } from "@google/genai";

// In-memory cache for distilled intelligent memory profiles (5-minute TTL)
interface MemoryCacheEntry {
  profile: IntelligentContentMemoryProfile;
  rawPostCount: number;
  hash: string;
  timestamp: number;
}

const memoryCache = new Map<string, MemoryCacheEntry>();
const MEMORY_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Standard high-converting content formats for variation intelligence
const STANDARD_FORMAT_LIBRARY = [
  "Educational Explanation",
  "Contrarian Pattern Interrupt",
  "Step-by-Step Blueprint",
  "Real-World Case Study",
  "Common Mistakes Breakdown",
  "Myth-Busting & Paradigm Shift",
  "Direct Actionable Checklist",
  "Story & Personal Evolution"
];

// Stopwords for vocabulary analysis
const STOPWORDS = new Set([
  "the", "be", "to", "of", "and", "a", "in", "that", "have", "i", "it", "for", "not", "on", "with", "he", "as",
  "you", "do", "at", "this", "but", "his", "by", "from", "they", "we", "say", "her", "she", "or", "an", "will",
  "my", "one", "all", "would", "there", "their", "what", "so", "up", "out", "if", "about", "who", "get", "which",
  "go", "me", "when", "make", "can", "like", "time", "no", "just", "him", "know", "take", "people", "into", "year",
  "your", "good", "some", "could", "them", "see", "other", "than", "then", "now", "look", "only", "come", "its",
  "over", "think", "also", "back", "after", "use", "two", "how", "our", "work", "first", "well", "way", "even",
  "new", "want", "because", "any", "these", "give", "day", "most", "us", "is", "are", "was", "were", "been",
  "has", "had", "here", "why", "stop", "step", "part", "read", "thread"
]);

import { getAI } from "./geminiClient";

function getAiClient(): GoogleGenAI {
  return getAI();
}

/**
 * Text tokenization and cleaning helper
 */
function tokenizeText(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOPWORDS.has(t));
}

/**
 * Computes Jaccard word-set similarity (0.0 to 1.0)
 */
function computeJaccardSimilarity(textA: string, textB: string): number {
  const tokensA = new Set(tokenizeText(textA));
  const tokensB = new Set(tokenizeText(textB));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) intersection++;
  }
  const union = new Set([...tokensA, ...tokensB]).size;
  return union > 0 ? intersection / union : 0;
}

/**
 * Normalized string similarity for hook checks
 */
function computeExactHookSimilarity(hookA: string, hookB: string): number {
  if (!hookA || !hookB) return 0;
  const cleanA = hookA.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
  const cleanB = hookB.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
  if (cleanA === cleanB) return 1.0;

  const prefixA = cleanA.split(/\s+/).slice(0, 6).join(" ");
  const prefixB = cleanB.split(/\s+/).slice(0, 6).join(" ");
  if (prefixA.length > 15 && prefixA === prefixB) return 0.88;

  return computeJaccardSimilarity(cleanA, cleanB);
}

/**
 * Classify hook type for categorization
 */
function classifyHookCategory(hook: string): string {
  const lower = hook.toLowerCase();
  if (lower.startsWith("why") || lower.includes("why most") || lower.includes("why 90%")) return "Contrarian Mechanism";
  if (lower.startsWith("how to") || lower.startsWith("how we") || lower.startsWith("how i")) return "Step-by-Step How-To";
  if (lower.includes("unpopular opinion") || lower.includes("stop doing") || lower.includes("is dead")) return "Pattern Interrupt";
  if (/\b\d+\b/.test(lower) && (lower.includes("rule") || lower.includes("step") || lower.includes("framework"))) return "Numerical Blueprint";
  if (lower.startsWith("if you") || lower.startsWith("to every") || lower.startsWith("dear")) return "Targeted Callout";
  if (lower.endsWith("?")) return "Provocative Diagnostic";
  return "Direct Observation";
}

/**
 * Detect delivery stage (What vs Why vs How vs Proof vs Action)
 */
function detectDeliveryStage(text: string, title?: string, decision?: any): "what" | "why" | "how" | "proof" | "action" {
  const combined = `${title || ""} ${text || ""} ${decision?.strategicAngle || ""} ${decision?.contentType || ""}`.toLowerCase();
  
  if (combined.includes("case study") || combined.includes("client") || combined.includes("results") || combined.includes("revenue") || combined.includes("proof") || combined.includes("transformation")) {
    return "proof";
  }
  if (combined.includes("how to") || combined.includes("step 1") || combined.includes("step-by-step") || combined.includes("blueprint") || combined.includes("framework") || combined.includes("checklist") || combined.includes("actionable") || combined.includes("playbook")) {
    return "how";
  }
  if (combined.includes("why") || combined.includes("mistake") || combined.includes("reason") || combined.includes("truth") || combined.includes("shift") || combined.includes("belief") || combined.includes("cost of inaction")) {
    return "why";
  }
  if (combined.includes("link in bio") || combined.includes("grab the") || combined.includes("available now") || combined.includes("dm me") || combined.includes("comment") || combined.includes("pricing")) {
    return "action";
  }
  return "what";
}

/**
 * Generate a deterministic fingerprint hash of the post set to invalidate cache cleanly
 */
function generatePostsHash(posts: any[]): string {
  return posts
    .slice(0, 30)
    .map(p => `${p.id || ""}_${(p.hook || p.title || "").slice(0, 20)}_${p.status || ""}`)
    .join("|");
}

/**
 * Primary Intelligent Memory Distillation Engine
 */
export async function distillIntelligentContentMemory(
  userId: string,
  rawPosts: any[],
  userProfile?: UserProfile | null,
  analyticsPosts?: PostAnalyticsRecord[],
  baselines?: CreatorPerformanceBaseline | null,
  savedTabId?: string
): Promise<IntelligentContentMemoryProfile> {
  const activeUid = userId || "anonymous";
  const tabId = savedTabId || "default";
  const isAnonymous = !userId || userId === "anonymous";
  const cacheKey = isAnonymous ? null : `${activeUid}_${tabId}`;

  const validPosts = Array.isArray(rawPosts)
    ? rawPosts.filter(p => p && (typeof p.singlePost === "string" || typeof p.hook === "string" || typeof p.title === "string") && (!p.savedTabId || p.savedTabId === tabId))
    : [];

  const now = Date.now();
  const currentHash = generatePostsHash(validPosts);
  const cached = cacheKey ? memoryCache.get(cacheKey) : null;

  if (cached && now - cached.timestamp < MEMORY_CACHE_TTL_MS && cached.hash === currentHash) {
    return cached.profile;
  }

  // 1. Build post analytics lookup map for fast linkage
  const analyticsByPostId = new Map<string, PostAnalyticsRecord>();
  const analyticsByHook = new Map<string, PostAnalyticsRecord>();
  if (Array.isArray(analyticsPosts)) {
    for (const ap of analyticsPosts) {
      if (ap.matchedContentPostId) {
        analyticsByPostId.set(ap.matchedContentPostId, ap);
      }
      if (ap.mediaId) {
        analyticsByPostId.set(ap.mediaId, ap);
      }
      if (ap.contentMemoryContext?.hook) {
        analyticsByHook.set(ap.contentMemoryContext.hook.toLowerCase().trim(), ap);
      }
    }
  }

  // 2. Normalization & Preprocessing of all posts
  const normalizedPosts = validPosts.map((p, index) => {
    const rawText = (p.singlePost || p.text || p.content || "").trim();
    const rawHook = (p.hook || (rawText ? rawText.split("\n\n")[0] : p.title) || `Draft #${index + 1}`).trim();
    const cleanHook = rawHook.replace(/^[#*\-\d.\s]+/, "").trim();
    const title = (p.title || p.concept || cleanHook.slice(0, 40)).trim();
    const topic = p.topic || p.decision?.topic || "Social Media Strategy";
    const pillarTitle = p.decision?.pillarTitle || p.pillar || undefined;
    const strategicAngle = p.decision?.strategicAngle || p.angle || undefined;
    const format = p.format || p.decision?.format || (Array.isArray(p.threadParts) && p.threadParts.length > 1 ? "Multi-Part Thread" : "Single Post");
    const contentType = p.decision?.contentType || classifyHookCategory(cleanHook);
    const postId = String(p.id || `post_${index}`);

    // Link performance if available
    const matchedAnalytics = analyticsByPostId.get(postId) || analyticsByHook.get(cleanHook.toLowerCase());
    const views = matchedAnalytics?.metrics.views || 0;
    const interactions = matchedAnalytics?.derivedMetrics.totalInteractions || 0;
    const engagementRate = matchedAnalytics?.derivedMetrics.engagementRate || 0;

    return {
      postId,
      title,
      hook: cleanHook,
      rawText,
      topic,
      pillarTitle,
      strategicAngle,
      format,
      contentType,
      status: (p.status || "Draft") as "Draft" | "Scheduled" | "Published",
      createdAt: p.createdAt,
      views,
      interactions,
      engagementRate,
      decision: p.decision,
      deliveryStage: detectDeliveryStage(rawText, title, p.decision)
    };
  });

  // 3. Cluster Posts into Semantic Ideas (Accurate Heuristic Clustering + LLM Refinement if >= 3 posts)
  const ideaClusters: Map<string, {
    canonicalConcept: string;
    summary: string;
    primaryTopic: string;
    primaryPillar?: string;
    posts: typeof normalizedPosts;
    angles: Set<string>;
    formats: Set<string>;
    contentTypes: Set<string>;
    offers: Set<string>;
    ctas: Set<string>;
  }> = new Map();

  // Heuristic clustering pass
  for (const post of normalizedPosts) {
    let matchedClusterKey: string | null = null;
    let highestSim = 0;

    for (const [key, cluster] of ideaClusters.entries()) {
      // Check title / hook / topic similarity
      const hookSim = computeExactHookSimilarity(post.hook, cluster.canonicalConcept);
      const titleSim = computeJaccardSimilarity(post.title, cluster.canonicalConcept);
      const textSim = computeJaccardSimilarity(post.rawText, cluster.posts[0]?.rawText || "");
      const maxSim = Math.max(hookSim, titleSim, textSim);

      // Same explicit pillar/topic match bonus
      const sameTopic = post.topic.toLowerCase() === cluster.primaryTopic.toLowerCase();
      const samePillar = post.pillarTitle && cluster.primaryPillar && post.pillarTitle.toLowerCase() === cluster.primaryPillar.toLowerCase();
      const adjustedSim = maxSim + (samePillar ? 0.15 : 0) + (sameTopic ? 0.08 : 0);

      // Strict grouping threshold: >= 0.62 to prevent false-positive idea collapse
      if (adjustedSim >= 0.62 && adjustedSim > highestSim) {
        highestSim = adjustedSim;
        matchedClusterKey = key;
      }
    }

    if (matchedClusterKey && ideaClusters.has(matchedClusterKey)) {
      const cluster = ideaClusters.get(matchedClusterKey)!;
      cluster.posts.push(post);
      if (post.strategicAngle) cluster.angles.add(post.strategicAngle);
      if (post.format) cluster.formats.add(post.format);
      if (post.contentType) cluster.contentTypes.add(post.contentType);
      if (post.decision?.offerRelationship && post.decision.offerRelationship !== "none") {
        cluster.offers.add(post.decision.offerRelationship);
      }
      if (post.decision?.cta) cluster.ctas.add(post.decision.cta);
    } else {
      const newKey = `idea_${ideaClusters.size + 1}_${post.postId}`;
      const angles = new Set<string>();
      if (post.strategicAngle) angles.add(post.strategicAngle);
      const formats = new Set<string>();
      if (post.format) formats.add(post.format);
      const contentTypes = new Set<string>();
      if (post.contentType) contentTypes.add(post.contentType);
      const offers = new Set<string>();
      if (post.decision?.offerRelationship && post.decision.offerRelationship !== "none") {
        offers.add(post.decision.offerRelationship);
      }
      const ctas = new Set<string>();
      if (post.decision?.cta) ctas.add(post.decision.cta);

      ideaClusters.set(newKey, {
        canonicalConcept: post.title || post.hook.slice(0, 60),
        summary: post.hook.slice(0, 140),
        primaryTopic: post.topic,
        primaryPillar: post.pillarTitle,
        posts: [post],
        angles,
        formats,
        contentTypes,
        offers,
        ctas
      });
    }
  }

  // 4. Transform Clusters into Structured ContentIdea Objects
  const baselineMedianViews = baselines?.medianViews || 50;
  const structuredIdeas: ContentIdea[] = [];
  let strategicRepetitionCount = 0;
  let accidentalRepetitionCount = 0;

  for (const [key, cluster] of ideaClusters.entries()) {
    const postCount = cluster.posts.length;
    const anglesUsed = Array.from(cluster.angles);
    const formatsUsed = Array.from(cluster.formats);
    const contentTypesUsed = Array.from(cluster.contentTypes);
    const relatedOffers = Array.from(cluster.offers);
    const relatedCtas = Array.from(cluster.ctas);

    // Identify unused standard formats
    const unusedFormats = STANDARD_FORMAT_LIBRARY.filter(f => 
      !formatsUsed.some(used => used.toLowerCase().includes(f.toLowerCase()) || f.toLowerCase().includes(used.toLowerCase())) &&
      !contentTypesUsed.some(used => used.toLowerCase().includes(f.toLowerCase()))
    );

    // Calculate Performance Metrics for this Idea
    const postsWithMetrics = cluster.posts.filter(p => p.views > 0);
    let performanceSummary: IdeaPerformanceSummary | undefined;

    if (postsWithMetrics.length > 0) {
      const sortedViews = postsWithMetrics.map(p => p.views).sort((a, b) => a - b);
      const midIndex = Math.floor(sortedViews.length / 2);
      const medianViews = sortedViews.length % 2 !== 0 ? sortedViews[midIndex] : Math.round((sortedViews[midIndex - 1] + sortedViews[midIndex]) / 2);
      
      const totalInteractions = postsWithMetrics.reduce((sum, p) => sum + p.interactions, 0);
      const medianInteractions = Math.round(totalInteractions / postsWithMetrics.length);
      const avgEngagementRate = Number((postsWithMetrics.reduce((sum, p) => sum + p.engagementRate, 0) / postsWithMetrics.length).toFixed(2));
      
      const baselineVariancePct = baselineMedianViews > 0
        ? Number((((medianViews - baselineMedianViews) / baselineMedianViews) * 100).toFixed(1))
        : 0;

      const strongest = [...postsWithMetrics].sort((a, b) => b.views - a.views)[0];
      const weakest = [...postsWithMetrics].sort((a, b) => a.views - b.views)[0];

      performanceSummary = {
        sampleSize: postsWithMetrics.length,
        medianViews,
        medianInteractions,
        avgEngagementRate,
        baselineVariancePct,
        strongestPostId: strongest?.postId,
        strongestPostTitle: strongest?.title,
        strongestPostHook: strongest?.hook,
        weakestPostId: weakest && weakest.postId !== strongest?.postId ? weakest.postId : undefined,
        weakestPostTitle: weakest && weakest.postId !== strongest?.postId ? weakest.title : undefined
      };
    }

    // Determine Repetition Classification (Strategic vs Accidental vs Standard)
    let repetitionType: RepetitionClassification = "standard";
    let repetitionAssessment = "Single standalone piece of content";

    if (postCount >= 2) {
      // Check diversity of angles and formats
      const hasDistinctAngles = anglesUsed.length >= 2 || contentTypesUsed.length >= 2 || formatsUsed.length >= 2;
      const averageTextSimilarity = cluster.posts.length > 1
        ? computeJaccardSimilarity(cluster.posts[0].rawText, cluster.posts[1].rawText)
        : 0;

      if (hasDistinctAngles && averageTextSimilarity < 0.75) {
        repetitionType = "strategic";
        repetitionAssessment = `Strategic framework repetition: ${postCount} variations exploring ${Math.max(anglesUsed.length, formatsUsed.length)} distinct angles/formats with compounding depth`;
        strategicRepetitionCount++;
      } else if (averageTextSimilarity >= 0.75) {
        repetitionType = "accidental";
        repetitionAssessment = `High surface overlap (${Math.round(averageTextSimilarity * 100)}% similarity). Recommend delivering this thesis through a fresh format (e.g., Case Study or Step-by-Step)`;
        accidentalRepetitionCount++;
      } else {
        repetitionType = "standard";
        repetitionAssessment = `Repeated ${postCount} times across library`;
      }
    } else if (postCount === 1 && (cluster.primaryPillar || relatedOffers.length > 0)) {
      repetitionType = "foundational";
      repetitionAssessment = "Foundational pillar thesis with multiple open variation opportunities";
    }

    // Map variations
    const variations: ContentIdeaVariation[] = cluster.posts.map(p => ({
      postId: p.postId,
      title: p.title,
      hook: p.hook,
      format: p.format,
      strategicAngle: p.strategicAngle,
      contentType: p.contentType,
      pillarTitle: p.pillarTitle,
      status: p.status,
      createdAt: p.createdAt,
      views: p.views || undefined,
      interactions: p.interactions || undefined,
      engagementRate: p.engagementRate || undefined
    }));

    // Generate expansion opportunities
    const expansionOpportunities: string[] = [];
    if (unusedFormats.includes("Real-World Case Study")) {
      expansionOpportunities.push("Demonstrate this concept with a specific client before/after breakdown");
    }
    if (unusedFormats.includes("Step-by-Step Blueprint")) {
      expansionOpportunities.push("Expand the high-level theory into a 3-part executable operational blueprint");
    }
    if (unusedFormats.includes("Contrarian Pattern Interrupt")) {
      expansionOpportunities.push("Challenge the dominant industry misconception regarding this topic");
    }
    if (unusedFormats.includes("Common Mistakes Breakdown")) {
      expansionOpportunities.push("Diagnose the top 3 hidden friction points preventing readers from achieving this result");
    }

    structuredIdeas.push({
      id: key,
      userId: activeUid,
      canonicalConcept: cluster.canonicalConcept,
      summary: cluster.summary,
      primaryTopic: cluster.primaryTopic,
      primaryPillar: cluster.primaryPillar,
      postIds: cluster.posts.map(p => p.postId),
      variations,
      usageCount: postCount,
      firstUsedAt: cluster.posts[cluster.posts.length - 1]?.createdAt ? String(cluster.posts[cluster.posts.length - 1].createdAt) : undefined,
      lastUsedAt: cluster.posts[0]?.createdAt ? String(cluster.posts[0].createdAt) : undefined,
      anglesUsed,
      formatsUsed,
      contentTypesUsed,
      unusedFormats: unusedFormats.slice(0, 4),
      unusedAngles: ["Audience Unit Economics", "Execution Blueprint", "Psychological Shift", "Mistake Diagnosis"].filter(a => !anglesUsed.includes(a)),
      performanceSummary,
      relatedOffers,
      relatedCtas,
      repetitionType,
      repetitionAssessment,
      isOverused: postCount >= 6 && anglesUsed.length <= 2,
      expansionOpportunities: expansionOpportunities.slice(0, 3)
    });
  }

  // Sort ideas by usage count and performance
  structuredIdeas.sort((a, b) => b.usageCount - a.usageCount);

  // 5. Post-to-Post Relationship Matrix (Evidence-based pairing)
  const relationships: ContentRelationship[] = [];
  for (let i = 0; i < normalizedPosts.length; i++) {
    for (let j = i + 1; j < normalizedPosts.length; j++) {
      const p1 = normalizedPosts[i];
      const p2 = normalizedPosts[j];

      const hookSim = computeExactHookSimilarity(p1.hook, p2.hook);
      const textSim = computeJaccardSimilarity(p1.rawText, p2.rawText);
      const overallSim = Math.max(hookSim, textSim);

      if (overallSim >= 0.40) {
        let relType: RelationshipType = "related_idea";
        let confidence: RelationshipConfidence = "moderate";
        let rationale = "Shared conceptual vocabulary and subject context";

        if (textSim >= 0.90 || hookSim >= 0.95) {
          relType = "exact_duplicate";
          confidence = "high";
          rationale = "Nearly identical wording and structural thesis";
        } else if (textSim >= 0.75 || hookSim >= 0.85) {
          relType = "near_duplicate";
          confidence = "high";
          rationale = "Very high overlap with minor phrasing modifications";
        } else if (p1.format !== p2.format && overallSim >= 0.55) {
          relType = "variation";
          confidence = "high";
          rationale = `Deliberate format rotation: ${p1.format} vs ${p2.format}`;
        } else if (p1.strategicAngle && p2.strategicAngle && p1.strategicAngle !== p2.strategicAngle) {
          relType = "variation";
          confidence = "high";
          rationale = `Different strategic angles: "${p1.strategicAngle}" vs "${p2.strategicAngle}"`;
        } else if (overallSim >= 0.60) {
          relType = "same_idea";
          confidence = "moderate";
          rationale = "Shares core thesis with independent sentence execution";
        }

        relationships.push({
          id: `rel_${p1.postId}_${p2.postId}`,
          sourcePostId: p1.postId,
          targetPostId: p2.postId,
          sourceTitle: p1.title,
          targetTitle: p2.title,
          relationshipType: relType,
          confidence,
          similarityScore: Number(overallSim.toFixed(2)),
          rationale,
          createdAt: new Date().toISOString()
        });
      }
    }
  }

  // 6. Content Coverage & Gaps Detection
  const pillarCounts: Record<string, number> = {};
  const deliveryStageCounts = { what: 0, why: 0, how: 0, proof: 0, action: 0 };
  const formatCounts: Record<string, number> = {};

  for (const p of normalizedPosts) {
    if (p.pillarTitle) {
      pillarCounts[p.pillarTitle] = (pillarCounts[p.pillarTitle] || 0) + 1;
    }
    deliveryStageCounts[p.deliveryStage]++;
    if (p.format) {
      formatCounts[p.format] = (formatCounts[p.format] || 0) + 1;
    }
  }

  const totalPosts = normalizedPosts.length;
  const pillarDistribution: Record<string, { count: number; percentage: number }> = {};
  for (const [pName, pCount] of Object.entries(pillarCounts)) {
    pillarDistribution[pName] = {
      count: pCount,
      percentage: totalPosts > 0 ? Math.round((pCount / totalPosts) * 100) : 0
    };
  }

  const gaps: ContentGapOpportunity[] = [];

  // Gap 1: Configured Content Pillars with 0 or low coverage
  if (userProfile?.contentPillars && Array.isArray(userProfile.contentPillars)) {
    for (const configuredPillar of userProfile.contentPillars) {
      const pCount = pillarCounts[configuredPillar.title] || 0;
      if (pCount === 0 && totalPosts >= 3) {
        gaps.push({
          id: `gap_pillar_${configuredPillar.title.toLowerCase().replace(/\s+/g, "_")}`,
          type: "pillar_underrepresented",
          title: `Unexplored Pillar: ${configuredPillar.title}`,
          description: `You have configured "${configuredPillar.title}" as a strategic Content Pillar, but have not yet created saved drafts or posts under this theme.`,
          recommendation: `Draft a foundational post or multi-part thread establishing your core methodology for ${configuredPillar.title}.`,
          targetPillar: configuredPillar.title,
          suggestedFormats: ["Educational Explanation", "Contrarian Pattern Interrupt"],
          suggestedAngle: "Foundational Framework",
          actionablePrompt: `Create an authoritative framework post breaking down ${configuredPillar.title}`,
          confidence: "strong"
        });
      } else if (pCount === 1 && totalPosts >= 6) {
        gaps.push({
          id: `gap_pillar_low_${configuredPillar.title.toLowerCase().replace(/\s+/g, "_")}`,
          type: "pillar_underrepresented",
          title: `Expand Pillar Coverage: ${configuredPillar.title}`,
          description: `"${configuredPillar.title}" represents only 1 post in your library. Deepen audience trust with a practical tactical follow-up.`,
          recommendation: `Add a step-by-step tutorial or diagnostic post under ${configuredPillar.title}.`,
          targetPillar: configuredPillar.title,
          suggestedFormats: ["Step-by-Step Blueprint", "Common Mistakes Breakdown"],
          confidence: "usable"
        });
      }
    }
  }

  // Gap 2: Delivery Stage Imbalance (e.g. high Why, zero How)
  if (totalPosts >= 4) {
    if (deliveryStageCounts.how === 0 && (deliveryStageCounts.why > 1 || deliveryStageCounts.what > 1)) {
      gaps.push({
        id: "gap_delivery_how",
        type: "missing_tactical_breakdown",
        title: "Tactical Execution Gap (Missing 'HOW-TO' Blueprints)",
        description: "Your library strongly explains WHAT concepts exist and WHY they matter, but lacks concrete, tactical step-by-step implementation blueprints.",
        recommendation: "Publish a 3-part or 5-step executable framework showing readers the exact workflow to achieve results.",
        suggestedFormats: ["Step-by-Step Blueprint", "Direct Actionable Checklist"],
        actionablePrompt: "Create a step-by-step blueprint breaking down execution steps",
        confidence: "strong"
      });
    }

    if (deliveryStageCounts.proof === 0 && totalPosts >= 5) {
      gaps.push({
        id: "gap_delivery_proof",
        type: "missing_proof",
        title: "Proof & Transformation Gap (Missing Case Studies)",
        description: "You have strong theoretical and educational content, but haven't yet showcased a client transformation or concrete before/after case study.",
        recommendation: "Break down a specific client journey or operational transformation to anchor credibility.",
        suggestedFormats: ["Real-World Case Study", "Story & Personal Evolution"],
        actionablePrompt: "Write a case study breaking down a specific client result or transformation",
        confidence: "usable"
      });
    }
  }

  // Gap 3: High-Performing Ideas with Unexplored Variations
  for (const idea of structuredIdeas) {
    if (idea.performanceSummary && idea.performanceSummary.baselineVariancePct > 15 && idea.unusedFormats.length > 0) {
      const topUnused = idea.unusedFormats[0];
      gaps.push({
        id: `gap_high_perf_${idea.id}`,
        type: "unexplored_high_performer",
        title: `High-Leverage Variation: "${idea.canonicalConcept}"`,
        description: `This idea is performing +${idea.performanceSummary.baselineVariancePct}% above your baseline. You have not yet tested it as a "${topUnused}".`,
        recommendation: `Leverage proven audience resonance by converting "${idea.canonicalConcept}" into a ${topUnused}.`,
        targetIdeaId: idea.id,
        suggestedFormats: [topUnused],
        suggestedAngle: "High-Leverage Variation",
        actionablePrompt: `Draft a ${topUnused} exploring: ${idea.canonicalConcept}`,
        confidence: "strong"
      });
      break; // Surface the single strongest performance variation
    }
  }

  // 7. Extract Authentic Vocabulary and Signature Phrases
  const wordFreq = new Map<string, number>();
  const phraseFreq = new Map<string, number>();

  for (const p of normalizedPosts) {
    const tokens = tokenizeText(p.rawText);
    for (let i = 0; i < tokens.length; i++) {
      wordFreq.set(tokens[i], (wordFreq.get(tokens[i]) || 0) + 1);
      if (i < tokens.length - 2) {
        const trigram = `${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`;
        phraseFreq.set(trigram, (phraseFreq.get(trigram) || 0) + 1);
      }
    }
  }

  const authenticVocabulary = Array.from(wordFreq.entries())
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([w]) => w);

  const signaturePhrases = Array.from(phraseFreq.entries())
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([p]) => p);

  // 8. Assemble Repetition Intelligence Summary
  const highestRep = structuredIdeas.length > 0
    ? {
        concept: structuredIdeas[0].canonicalConcept,
        count: structuredIdeas[0].usageCount,
        anglesCount: structuredIdeas[0].anglesUsed.length
      }
    : undefined;

  const mostVaried = [...structuredIdeas].sort((a, b) => b.formatsUsed.length - a.formatsUsed.length)[0];
  const mostVariedSummary = mostVaried && mostVaried.formatsUsed.length > 1
    ? {
        concept: mostVaried.canonicalConcept,
        variationsCount: mostVaried.usageCount,
        formatsCount: mostVaried.formatsUsed.length
      }
    : undefined;

  const totalRepetitions = strategicRepetitionCount + accidentalRepetitionCount;
  const healthyRatio = totalRepetitions > 0 ? Math.round((strategicRepetitionCount / totalRepetitions) * 100) : 100;
  const freshnessScore = Math.max(20, Math.min(100, 100 - (accidentalRepetitionCount * 12)));

  const profile: IntelligentContentMemoryProfile = {
    userId: activeUid,
    lastUpdated: now,
    totalPostsIndexed: validPosts.length,
    totalIdeasIdentified: structuredIdeas.length,
    ideas: structuredIdeas,
    relationships: relationships.slice(0, 30),
    gaps: gaps.slice(0, 6),
    repetitionSummary: {
      totalIdeas: structuredIdeas.length,
      strategicRepetitions: strategicRepetitionCount,
      accidentalRepetitions: accidentalRepetitionCount,
      healthyRepetitionRatioPct: healthyRatio,
      highestRepetitionIdea: highestRep,
      mostVariedIdea: mostVariedSummary,
      freshnessScore
    },
    coverage: {
      pillarDistribution,
      deliveryTypeDistribution: deliveryStageCounts,
      formatDistribution: formatCounts
    },
    recentHooks: normalizedPosts.slice(0, 20).map(p => ({
      hook: p.hook,
      type: p.contentType,
      topic: p.topic
    })),
    authenticVocabulary,
    signaturePhrases
  };

  // Cache compiled profile strictly scoped by userId and savedTabId
  if (cacheKey) {
    memoryCache.set(cacheKey, {
      profile,
      rawPostCount: validPosts.length,
      hash: currentHash,
      timestamp: now
    });
  }

  return profile;
}

/**
 * Conceptual & Semantic Search across Content Memory
 */
export async function searchContentMemory(
  profile: IntelligentContentMemoryProfile,
  rawPosts: any[],
  query: SemanticSearchQuery
): Promise<SemanticSearchResponse> {
  const searchTerm = (query.query || "").trim().toLowerCase();
  const searchTokens = tokenizeText(searchTerm);

  const results: SemanticSearchResultItem[] = [];
  const matchedIdeaIds = new Set<string>();

  const validPosts = Array.isArray(rawPosts) ? rawPosts : [];

  for (const post of validPosts) {
    const rawText = (post.singlePost || post.text || post.content || "").toLowerCase();
    const title = (post.title || "").toLowerCase();
    const hook = (post.hook || "").toLowerCase();
    const topic = (post.topic || "").toLowerCase();
    const pillar = (post.decision?.pillarTitle || post.pillar || "").toLowerCase();
    const format = (post.format || "").toLowerCase();
    const angle = (post.decision?.strategicAngle || "").toLowerCase();

    // Apply strict filters if provided
    if (query.pillarFilter && query.pillarFilter !== "all" && !pillar.includes(query.pillarFilter.toLowerCase())) {
      continue;
    }
    if (query.formatFilter && query.formatFilter !== "all" && !format.includes(query.formatFilter.toLowerCase())) {
      continue;
    }
    if (query.angleFilter && query.angleFilter !== "all" && !angle.includes(query.angleFilter.toLowerCase())) {
      continue;
    }

    // Calculate conceptual match score
    let score = 0;
    let matchReason = "";
    let relToQuery: 'direct_concept_match' | 'thematic_match' | 'angle_match' | 'keyword_match' = 'keyword_match';

    // 1. Exact phrase or title match
    if (title.includes(searchTerm) || hook.includes(searchTerm)) {
      score += 0.85;
      matchReason = "Direct match in title or opening hook";
      relToQuery = "direct_concept_match";
    }

    // 2. Token overlap
    let tokenMatches = 0;
    for (const t of searchTokens) {
      if (rawText.includes(t) || title.includes(t) || hook.includes(t) || topic.includes(t) || pillar.includes(t)) {
        tokenMatches++;
      }
    }

    if (searchTokens.length > 0) {
      const tokenRatio = tokenMatches / searchTokens.length;
      score += tokenRatio * 0.50;
      if (tokenRatio >= 0.75 && !matchReason) {
        matchReason = "Strong thematic overlap across core concept terms";
        relToQuery = "thematic_match";
      }
    }

    // 3. Idea Cluster matching
    let matchedIdea: { id: string; canonicalConcept: string; usageCount: number } | undefined;
    const postId = String(post.id);
    for (const idea of profile.ideas) {
      if (idea.postIds.includes(postId)) {
        matchedIdea = {
          id: idea.id,
          canonicalConcept: idea.canonicalConcept,
          usageCount: idea.usageCount
        };
        // Check if query matches canonical concept
        if (idea.canonicalConcept.toLowerCase().includes(searchTerm)) {
          score += 0.40;
          matchedIdeaIds.add(idea.id);
          if (!matchReason) {
            matchReason = `Belongs to idea family "${idea.canonicalConcept}"`;
            relToQuery = "direct_concept_match";
          }
        }
        break;
      }
    }

    if (score >= 0.25 || !searchTerm) {
      results.push({
        post: {
          id: postId,
          title: post.title || "Untitled Draft",
          hook: post.hook || (rawText ? rawText.split("\n\n")[0] : ""),
          singlePost: post.singlePost || post.text || "",
          threadParts: post.threadParts,
          topic: post.topic,
          format: post.format,
          pillarTitle: post.decision?.pillarTitle,
          strategicAngle: post.decision?.strategicAngle,
          status: post.status,
          createdAt: post.createdAt
        },
        matchedIdea,
        relevanceScore: Number(Math.min(1.0, score).toFixed(2)),
        matchReason: matchReason || "Keyword and semantic presence in post body",
        relationshipToQuery: relToQuery
      });
    }
  }

  // Sort by relevance score
  results.sort((a, b) => b.relevanceScore - a.relevanceScore);

  const relatedIdeas = profile.ideas.filter(idea => 
    matchedIdeaIds.has(idea.id) ||
    idea.canonicalConcept.toLowerCase().includes(searchTerm) ||
    searchTokens.some(t => idea.canonicalConcept.toLowerCase().includes(t))
  );

  return {
    results: results.slice(0, query.limit || 20),
    relatedIdeas: relatedIdeas.slice(0, 5),
    totalMatches: results.length,
    queryIntent: searchTerm ? `Conceptual search for "${query.query}"` : "Full content library indexing"
  };
}

/**
 * Fast Pre-Save & Draft Similarity Protection
 */
export async function checkSimilarityAgainstMemory(
  profile: IntelligentContentMemoryProfile,
  rawPosts: any[],
  request: SimilarityCheckRequest
): Promise<SimilarityCheckResult> {
  const currentText = (request.text || "").trim();
  const currentHook = (request.hook || (currentText ? currentText.split("\n\n")[0] : "")).trim();
  const currentTitle = (request.title || "").trim();

  if (!currentText && !currentHook) {
    return {
      status: "new_idea",
      similarityScore: 0,
      explanation: "No content provided to evaluate.",
      suggestedAction: "Proceed with drafting."
    };
  }

  let highestScore = 0;
  let mostSimilarPost: any = null;
  let matchedIdea: any = null;

  for (const post of rawPosts) {
    const pText = (post.singlePost || post.text || post.content || "").trim();
    const pHook = (post.hook || (pText ? pText.split("\n\n")[0] : post.title) || "").trim();
    const pTitle = (post.title || "").trim();

    const hookSim = computeExactHookSimilarity(currentHook, pHook);
    const textSim = computeJaccardSimilarity(currentText, pText);
    const titleSim = computeJaccardSimilarity(currentTitle, pTitle);

    const combinedScore = Math.max(hookSim, textSim * 0.9 + titleSim * 0.1);

    if (combinedScore > highestScore) {
      highestScore = combinedScore;
      mostSimilarPost = post;
    }
  }

  // Find corresponding idea cluster
  if (mostSimilarPost) {
    const mostSimilarId = String(mostSimilarPost.id);
    for (const idea of profile.ideas) {
      if (idea.postIds.includes(mostSimilarId)) {
        matchedIdea = {
          id: idea.id,
          canonicalConcept: idea.canonicalConcept,
          usageCount: idea.usageCount
        };
        break;
      }
    }
  }

  const scoreRounded = Number(highestScore.toFixed(2));

  if (highestScore >= 0.88) {
    return {
      status: "likely_duplicate",
      similarityScore: scoreRounded,
      matchedPost: mostSimilarPost ? {
        id: mostSimilarPost.id,
        title: mostSimilarPost.title || "Existing Post",
        hook: mostSimilarPost.hook || "",
        preview: (mostSimilarPost.singlePost || "").slice(0, 120),
        status: mostSimilarPost.status,
        createdAt: mostSimilarPost.createdAt
      } : undefined,
      matchedIdea,
      explanation: `Very high similarity (${Math.round(scoreRounded * 100)}%) with a previous post in your library: "${mostSimilarPost?.title || mostSimilarPost?.hook?.slice(0, 40)}".`,
      suggestedAction: "Consider revising the hook angle or rotating the format (e.g. convert into a Step-by-Step Blueprint or Case Study) to avoid accidental duplication."
    };
  }

  if (highestScore >= 0.72) {
    return {
      status: "highly_similar",
      similarityScore: scoreRounded,
      matchedPost: mostSimilarPost ? {
        id: mostSimilarPost.id,
        title: mostSimilarPost.title || "Existing Post",
        hook: mostSimilarPost.hook || "",
        preview: (mostSimilarPost.singlePost || "").slice(0, 120),
        status: mostSimilarPost.status,
        createdAt: mostSimilarPost.createdAt
      } : undefined,
      matchedIdea,
      explanation: `Shares significant vocabulary and structure (${Math.round(scoreRounded * 100)}%) with "${mostSimilarPost?.title}".`,
      suggestedAction: "Ensure you are introducing a fresh nuance, distinctive example, or tactical step to create strategic variation."
    };
  }

  if (highestScore >= 0.50) {
    return {
      status: "related_idea",
      similarityScore: scoreRounded,
      matchedPost: mostSimilarPost ? {
        id: mostSimilarPost.id,
        title: mostSimilarPost.title || "Existing Post",
        hook: mostSimilarPost.hook || "",
        preview: (mostSimilarPost.singlePost || "").slice(0, 120),
        status: mostSimilarPost.status
      } : undefined,
      matchedIdea,
      explanation: `Related to your established concept family: "${matchedIdea?.canonicalConcept || mostSimilarPost?.title}".`,
      suggestedAction: "Great strategic connection. You are building on an established theme with fresh execution."
    };
  }

  return {
    status: "new_idea",
    similarityScore: scoreRounded,
    matchedIdea,
    explanation: "This content introduces a novel angle or fresh conceptual topic into your library.",
    suggestedAction: "Foundational new idea — clear creative space."
  };
}

/**
 * Targeted AI Context Generator
 * Retrieves only the most relevant ideas, recent hooks, and unused variations
 * for a specific prompt/category, avoiding full history dumps.
 */
export function retrieveTargetedMemoryContext(
  profile: IntelligentContentMemoryProfile,
  category?: string,
  topic?: string,
  pillarTitle?: string
): RelevantMemoryContext {
  const targetTerm = `${category || ""} ${topic || ""} ${pillarTitle || ""}`.toLowerCase();
  
  // Find top 3 relevant ideas
  const scoredIdeas = profile.ideas.map(idea => {
    let score = 0;
    const conceptLower = idea.canonicalConcept.toLowerCase();
    const pillarLower = (idea.primaryPillar || "").toLowerCase();
    const topicLower = idea.primaryTopic.toLowerCase();

    if (pillarTitle && pillarLower.includes(pillarTitle.toLowerCase())) score += 5;
    if (topic && topicLower.includes(topic.toLowerCase())) score += 4;
    if (targetTerm && conceptLower.includes(targetTerm)) score += 3;

    return { idea, score };
  });

  scoredIdeas.sort((a, b) => b.score - a.score || b.idea.usageCount - a.idea.usageCount);
  const relevantIdeas = scoredIdeas.slice(0, 3).map(item => ({
    canonicalConcept: item.idea.canonicalConcept,
    summary: item.idea.summary,
    usageCount: item.idea.usageCount,
    anglesUsed: item.idea.anglesUsed,
    unusedFormats: item.idea.unusedFormats,
    recentHooks: item.idea.variations.slice(0, 3).map(v => v.hook)
  }));

  // Retrieve recent hooks
  const recentSimilarHooks = profile.recentHooks.slice(0, 10).map(h => h.hook);

  // Recommended unused angles from gaps
  const recommendedUnusedAngles = profile.gaps
    .flatMap(g => g.suggestedFormats)
    .slice(0, 4);

  return {
    relevantIdeas,
    recentSimilarHooks,
    protectedVocabulary: profile.authenticVocabulary.slice(0, 12),
    recommendedUnusedAngles,
    strategicContextNote: profile.repetitionSummary.highestRepetitionIdea
      ? `Core high-repetition theme in library: "${profile.repetitionSummary.highestRepetitionIdea.concept}" (${profile.repetitionSummary.highestRepetitionIdea.count} times). Ensure fresh pattern interrupts.`
      : undefined
  };
}

/**
 * Format intelligent memory into concise, high-authority AI system prompt context
 */
export function formatIntelligentMemoryBrainPrompt(
  profile?: IntelligentContentMemoryProfile,
  category?: string,
  topic?: string,
  pillarTitle?: string
): string {
  if (!profile || profile.totalPostsIndexed === 0) {
    return `
=============================================================
### LAYER 4: INTELLIGENT CONTENT MEMORY
=============================================================
(Creator is establishing their foundational Content Library. Open creative space.)
=============================================================
`;
  }

  const targeted = retrieveTargetedMemoryContext(profile, category, topic, pillarTitle);

  const ideasContextText = targeted.relevantIdeas.length > 0
    ? targeted.relevantIdeas.map((idea, idx) => {
        const unused = idea.unusedFormats.length > 0 ? ` [Unexplored Formats: ${idea.unusedFormats.join(", ")}]` : "";
        return `  ${idx + 1}. Concept: "${idea.canonicalConcept}" (Used ${idea.usageCount}x)${unused}`;
      }).join("\n")
    : "  (No direct overlapping ideas in memory)";

  const recentHooksList = targeted.recentSimilarHooks.slice(0, 8)
    .map((h, i) => `  ${i + 1}. "${h}"`)
    .join("\n");

  const gapOpportunitiesText = profile.gaps.slice(0, 3)
    .map((g, i) => `  * ${g.title}: ${g.recommendation}`)
    .join("\n");

  const protectedVocab = targeted.protectedVocabulary.length > 0
    ? targeted.protectedVocabulary.map(w => `"${w}"`).join(", ")
    : "Direct, concise, peer-to-peer conversational standard";

  return `
=============================================================
### LAYER 4: INTELLIGENT CONTENT MEMORY BRAIN
=============================================================
SYSTEM CONTEXT: ${profile.totalPostsIndexed} post(s) indexed across ${profile.totalIdeasIdentified} canonical idea families.
Repetition Balance: ${profile.repetitionSummary.strategicRepetitions} strategic variation(s), Freshness Score: ${profile.repetitionSummary.freshnessScore}/100.

1. ESTABLISHED IDEA FAMILIES & UNEXPLORED VARIATIONS:
${ideasContextText}
-> LAW OF STRATEGIC VARIATION: If addressing an established idea family, you MUST deliver it through an UNEXPLORED format or deeper angle (e.g. Case Study, Step-by-Step Blueprint, or Mistake Breakdown). Do NOT repeat the exact same phrasing or structure.

2. RECENT OPENING HOOKS IN LIBRARY (DO NOT DUPLICATE):
${recentHooksList}
-> REPETITION LAW: Do NOT reuse these exact opening hook formulations or sentence structures. Deliver a completely fresh pattern interrupt.

3. STRATEGIC CONTENT GAPS TO CAPITALIZE ON:
${gapOpportunitiesText}

4. CREATOR AUTHENTIC VOCABULARY:
${protectedVocab}
-> VOICE PRESERVATION: Preserve authentic creator terminology while varying structural delivery.
=============================================================
`;
}
