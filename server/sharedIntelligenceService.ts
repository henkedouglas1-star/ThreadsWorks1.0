import { createHash } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Shared Intelligence Infrastructure (Hardened for Prompt D)
 *
 * Strictly enforces:
 * - Zero fabricated analytics, prices, audience pain points, or testimonials.
 * - Explicit provenance labeling on every fact:
 *     `verified_platform_data` | `user_provided_fact` | `ai_hypothesis` | `recommendation`
 * - Strict project ownership checks (throws ProjectOwnershipError / HTTP 403 on cross-user access).
 * - Deterministic contribution deduplication via SHA-256 fingerprint.
 * - Retrieval of saved `intelligence_contributions`, saved `ecosystem_assets`, and saved ProductWorks products.
 * - Configurable context size budget enforcement.
 * - User memory controls (list and delete saved contributions).
 */

export type IntelligenceProvenance =
  | "verified_platform_data"
  | "user_provided_fact"
  | "ai_hypothesis"
  | "recommendation";

export type IntelligenceDomain =
  | "identity"
  | "business"
  | "audience"
  | "projects"
  | "content"
  | "performance"
  | "products";

export interface SharedIntelligenceRequest {
  userId: string;
  appId: string;
  projectId?: string;
  taskType: string;
  domains?: IntelligenceDomain[];
  maxContextChars?: number;
}

export interface ProvenanceTaggedFact {
  id?: string;
  category: string;
  factType: string;
  sourceAppId: string;
  provenance: IntelligenceProvenance;
  confidence: "high" | "medium" | "low";
  data: any;
  evidence?: string;
  updatedAt?: string;
}

export interface SharedIntelligenceResponse {
  creatorIdentity?: {
    provenance: "user_provided_fact";
    displayName: string;
    positioning: string;
    voiceStyle: string;
    tone: string;
    wordsToUse: string;
    wordsToAvoid: string;
    hasProfileData: boolean;
  };
  audienceProfile?: {
    provenance: "user_provided_fact";
    targetAudience: string;
    desiredOutcome: string;
    hasAudienceData: boolean;
  };
  businessContext?: {
    provenance: "user_provided_fact";
    primaryOffer: string;
    businessModel: string;
    commercialObjective: string;
    hasBusinessData: boolean;
  };
  activeProject?: {
    provenance: "user_provided_fact";
    id: string;
    name: string;
    objective: string;
    description?: string;
    status: string;
    associatedAppIds: string[];
  };
  savedProducts?: {
    provenance: "user_provided_fact";
    items: Array<{
      id: string;
      title: string;
      subtitle?: string;
      audience?: string;
      outcome?: string;
      price?: string;
      version?: number;
    }>;
  };
  contentContext?: {
    provenance: "verified_platform_data";
    recentTopics: string[];
    totalSavedPosts: number;
    hasContentHistory: boolean;
  };
  performanceSignals?: {
    provenance: "verified_platform_data";
    hasRealMetrics: boolean;
    analyzedPostsCount: number;
    medianViews: number | null;
    avgEngagementRate: number | null;
    topPerformingTopics: string[];
  };
  savedContributions: ProvenanceTaggedFact[];
  provenanceSummary: {
    verifiedPlatformDataCount: number;
    userProvidedFactCount: number;
    aiHypothesisCount: number;
    recommendationCount: number;
  };
  metadata: {
    retrievedAt: string;
    appId: string;
    domainsLoaded: string[];
    contextVersion: string;
    budgetChars: number;
    actualChars: number;
    budgetTruncated: boolean;
  };
}

export interface SharedIntelligenceContribution {
  userId: string;
  sourceAppId: string;
  projectId?: string;
  category: "identity" | "audience" | "business" | "content" | "performance" | "offer" | "product" | "research";
  factType: string;
  provenance?: IntelligenceProvenance;
  data: any;
  evidence?: string;
  confidence?: "high" | "medium" | "low";
}

export class ProjectOwnershipError extends Error {
  statusCode = 403;
  constructor(message = "Access denied: project does not belong to the authenticated user.") {
    super(message);
    this.name = "ProjectOwnershipError";
  }
}

const DEFAULT_MAX_CONTEXT_CHARS = 8000;

export function computeContributionFingerprint(
  userId: string,
  category: string,
  factType: string,
  data: unknown
): string {
  const stablePayload = JSON.stringify({
    u: userId,
    c: category.trim().toLowerCase(),
    f: factType.trim().toLowerCase(),
    d: data
  });
  return createHash("sha256").update(stablePayload).digest("hex").slice(0, 32);
}

function getDb(dbOverride?: Firestore): Firestore {
  return dbOverride || getFirestore();
}

function computeMedian(numbers: number[]): number | null {
  if (numbers.length === 0) return null;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  }
  return Math.round(sorted[mid]);
}

/**
 * Retrieves real, ownership-verified, provenance-labeled Shared Intelligence context.
 * Never fabricates fallback audience pain points, offers, or analytics metrics.
 */
export async function retrieveSharedIntelligenceContext(
  request: SharedIntelligenceRequest,
  dbOverride?: Firestore
): Promise<SharedIntelligenceResponse> {
  const { userId, appId, projectId, domains } = request;
  if (!userId) {
    throw new Error("userId is required to retrieve Shared Intelligence context.");
  }

  const db = getDb(dbOverride);
  const budgetChars = Math.max(1500, Math.min(request.maxContextChars || DEFAULT_MAX_CONTEXT_CHARS, 20000));
  const targetDomains: IntelligenceDomain[] =
    domains && domains.length > 0
      ? domains
      : ["identity", "business", "audience", "projects", "content", "performance", "products"];

  const response: SharedIntelligenceResponse = {
    savedContributions: [],
    provenanceSummary: {
      verifiedPlatformDataCount: 0,
      userProvidedFactCount: 0,
      aiHypothesisCount: 0,
      recommendationCount: 0
    },
    metadata: {
      retrievedAt: new Date().toISOString(),
      appId: appId || "threadsworks",
      domainsLoaded: [],
      contextVersion: "3.0-prompt-d-verified",
      budgetChars,
      actualChars: 0,
      budgetTruncated: false
    }
  };

  // 1. User Profile (Identity, Audience, Business) — STRICTLY user-provided facts, zero synthetic defaults
  if (
    targetDomains.includes("identity") ||
    targetDomains.includes("business") ||
    targetDomains.includes("audience")
  ) {
    const userDoc = await db.collection("users").doc(userId).get();
    const userData = userDoc.exists ? userDoc.data() || {} : {};
    const ci = (userData.creatorIdentity as Record<string, any>) || {};

    if (targetDomains.includes("identity")) {
      const displayName = String(userData.displayName || userData.name || "").trim();
      const positioning = String(ci.whatYoureKnownFor || userData.positioning || "").trim();
      const voiceStyle = String(ci.writingStyle || userData.writingStyle || "").trim();
      const tone = String(ci.tone || "").trim();
      const wordsToUse = String(ci.wordsYouUse || "").trim();
      const wordsToAvoid = String(ci.wordsYouAvoid || "").trim();
      const hasProfileData = Boolean(displayName || positioning || voiceStyle || tone);

      response.creatorIdentity = {
        provenance: "user_provided_fact",
        displayName,
        positioning,
        voiceStyle,
        tone,
        wordsToUse,
        wordsToAvoid,
        hasProfileData
      };
      if (hasProfileData) response.provenanceSummary.userProvidedFactCount += 1;
      response.metadata.domainsLoaded.push("identity");
    }

    if (targetDomains.includes("audience")) {
      const targetAudience = String(userData.audience || ci.whoYouHelp || "").trim();
      const desiredOutcome = String(userData.desiredResult || ci.whatYouHelpThemDo || "").trim();
      const hasAudienceData = Boolean(targetAudience || desiredOutcome);

      response.audienceProfile = {
        provenance: "user_provided_fact",
        targetAudience,
        desiredOutcome,
        hasAudienceData
      };
      if (hasAudienceData) response.provenanceSummary.userProvidedFactCount += 1;
      response.metadata.domainsLoaded.push("audience");
    }

    if (targetDomains.includes("business")) {
      const primaryOffer = String(userData.offer || "").trim();
      const businessModel = String(userData.businessModel || "").trim();
      const commercialObjective = String(userData.commercialObjective || userData.desiredResult || "").trim();
      const hasBusinessData = Boolean(primaryOffer || businessModel || commercialObjective);

      response.businessContext = {
        provenance: "user_provided_fact",
        primaryOffer,
        businessModel,
        commercialObjective,
        hasBusinessData
      };
      if (hasBusinessData) response.provenanceSummary.userProvidedFactCount += 1;
      response.metadata.domainsLoaded.push("business");
    }
  }

  // 2. Active Project Context — STRICT OWNERSHIP CHECK (403 on cross-user access)
  if (targetDomains.includes("projects") && projectId) {
    const projectSnap = await db.collection("projects").doc(projectId).get();
    if (projectSnap.exists) {
      const proj = projectSnap.data() || {};
      if (proj.userId !== userId) {
        throw new ProjectOwnershipError();
      }
      response.activeProject = {
        provenance: "user_provided_fact",
        id: projectSnap.id,
        name: String(proj.name || ""),
        objective: String(proj.objective || ""),
        description: proj.description ? String(proj.description) : undefined,
        status: String(proj.status || "active"),
        associatedAppIds: Array.isArray(proj.associatedAppIds) ? proj.associatedAppIds : []
      };
      response.provenanceSummary.userProvidedFactCount += 1;
      response.metadata.domainsLoaded.push("projects");
    }
  }

  // 3. Saved ProductWorks Products
  if (targetDomains.includes("products")) {
    try {
      const prodSnap = await db
        .collection("funnelworks_projects")
        .doc(userId)
        .collection("projects")
        .limit(8)
        .get();

      const items = prodSnap.docs.map((doc) => {
        const d = doc.data() || {};
        return {
          id: doc.id,
          title: String(d.playbook?.title || d.title || "Untitled Product"),
          subtitle: d.playbook?.subtitle ? String(d.playbook.subtitle) : undefined,
          audience: d.audience ? String(d.audience) : undefined,
          outcome: d.outcome ? String(d.outcome) : undefined,
          price: d.price ? String(d.price) : undefined,
          version: typeof d.version === "number" ? d.version : 1
        };
      });

      response.savedProducts = {
        provenance: "user_provided_fact",
        items
      };
      response.provenanceSummary.userProvidedFactCount += items.length;
      response.metadata.domainsLoaded.push("products");
    } catch (err) {
      console.warn("[SHARED_INTELLIGENCE] Failed reading ProductWorks products:", err);
    }
  }

  // 4. Content Context (Real posts in Firestore)
  if (targetDomains.includes("content")) {
    try {
      const postsSnap = await db
        .collection("posts")
        .where("userId", "==", userId)
        .limit(15)
        .get();

      const topics = new Set<string>();
      postsSnap.docs.forEach((doc) => {
        const d = doc.data() || {};
        if (typeof d.topic === "string" && d.topic.trim()) topics.add(d.topic.trim());
        if (typeof d.pillarTitle === "string" && d.pillarTitle.trim()) topics.add(d.pillarTitle.trim());
      });

      response.contentContext = {
        provenance: "verified_platform_data",
        recentTopics: Array.from(topics).slice(0, 8),
        totalSavedPosts: postsSnap.size,
        hasContentHistory: postsSnap.size > 0
      };
      if (postsSnap.size > 0) response.provenanceSummary.verifiedPlatformDataCount += 1;
      response.metadata.domainsLoaded.push("content");
    } catch (err) {
      console.warn("[SHARED_INTELLIGENCE] Failed reading posts:", err);
    }
  }

  // 5. Real Performance Signals (STRICTLY from analytics_posts; NEVER fabricated 50 / 3.5!)
  if (targetDomains.includes("performance")) {
    try {
      const analyticsSnap = await db
        .collection("analytics_posts")
        .where("userId", "==", userId)
        .limit(30)
        .get();

      const viewsList: number[] = [];
      const engagementRates: number[] = [];
      const rankedTopics: Array<{ text: string; score: number }> = [];

      analyticsSnap.docs.forEach((doc) => {
        const d = doc.data() || {};
        const metrics = (d.metrics as Record<string, any>) || {};
        const views = typeof metrics.views === "number" && metrics.views >= 0 ? metrics.views : null;
        const likes = typeof metrics.likes === "number" ? metrics.likes : 0;
        const replies = typeof metrics.replies === "number" ? metrics.replies : 0;
        const reposts = typeof metrics.reposts === "number" ? metrics.reposts : 0;
        const quotes = typeof metrics.quotes === "number" ? metrics.quotes : 0;
        const interactions = likes + replies + reposts + quotes;

        if (views !== null) {
          viewsList.push(views);
          if (views > 0) {
            engagementRates.push((interactions / views) * 100);
          }
        }
        if (typeof d.text === "string" && d.text.trim()) {
          rankedTopics.push({ text: d.text.trim().slice(0, 90), score: interactions + (views || 0) * 0.01 });
        }
      });

      const hasRealMetrics = analyticsSnap.size > 0;
      const medianViews = hasRealMetrics ? computeMedian(viewsList) : null;
      const avgEngagementRate =
        hasRealMetrics && engagementRates.length > 0
          ? Number((engagementRates.reduce((acc, v) => acc + v, 0) / engagementRates.length).toFixed(2))
          : null;

      rankedTopics.sort((a, b) => b.score - a.score);

      response.performanceSignals = {
        provenance: "verified_platform_data",
        hasRealMetrics,
        analyzedPostsCount: analyticsSnap.size,
        medianViews,
        avgEngagementRate,
        topPerformingTopics: rankedTopics.slice(0, 3).map((t) => t.text)
      };
      if (hasRealMetrics) response.provenanceSummary.verifiedPlatformDataCount += 1;
      response.metadata.domainsLoaded.push("performance");
    } catch (err) {
      console.warn("[SHARED_INTELLIGENCE] Failed reading analytics_posts:", err);
    }
  }

  // 6. Saved Intelligence Contributions (excluding isolated Project Z sandbox experiments unless caller IS projectz)
  try {
    const contribSnap = await db
      .collection("intelligence_contributions")
      .where("userId", "==", userId)
      .limit(20)
      .get();

    const contributions: ProvenanceTaggedFact[] = [];
    contribSnap.docs.forEach((doc) => {
      const d = doc.data() || {};
      if (d.sourceAppId === "projectz" && appId !== "projectz") {
        return; // Strictly isolate Project Z experiments from production apps
      }
      if (projectId && d.projectId && d.projectId !== projectId) {
        return;
      }
      const provenance: IntelligenceProvenance =
        d.provenance === "verified_platform_data" ||
        d.provenance === "user_provided_fact" ||
        d.provenance === "ai_hypothesis" ||
        d.provenance === "recommendation"
          ? d.provenance
          : "user_provided_fact";

      contributions.push({
        id: doc.id,
        category: String(d.category || "general"),
        factType: String(d.factType || "note"),
        sourceAppId: String(d.sourceAppId || "workspace"),
        provenance,
        confidence: d.confidence === "high" || d.confidence === "low" ? d.confidence : "medium",
        data: d.data,
        evidence: d.evidence ? String(d.evidence) : undefined,
        updatedAt: d.updatedAt ? String(d.updatedAt) : undefined
      });

      if (provenance === "verified_platform_data") response.provenanceSummary.verifiedPlatformDataCount += 1;
      else if (provenance === "user_provided_fact") response.provenanceSummary.userProvidedFactCount += 1;
      else if (provenance === "ai_hypothesis") response.provenanceSummary.aiHypothesisCount += 1;
      else response.provenanceSummary.recommendationCount += 1;
    });

    response.savedContributions = contributions;
  } catch (err) {
    console.warn("[SHARED_INTELLIGENCE] Failed reading intelligence_contributions:", err);
  }

  // 7. Enforce deterministic context size budget
  const measure = () => JSON.stringify(response).length;
  let currentSize = measure();
  if (currentSize > budgetChars) {
    response.metadata.budgetTruncated = true;
    while (response.savedContributions.length > 0 && measure() > budgetChars) {
      response.savedContributions.pop();
    }
    if (response.savedProducts && measure() > budgetChars) {
      while (response.savedProducts.items.length > 2 && measure() > budgetChars) {
        response.savedProducts.items.pop();
      }
    }
    currentSize = measure();
  }
  response.metadata.actualChars = currentSize;

  return response;
}

/**
 * Records a provenance-tagged contribution with deterministic deduplication and project ownership check.
 */
export async function contributeSharedIntelligence(
  contribution: SharedIntelligenceContribution,
  dbOverride?: Firestore
): Promise<{ success: boolean; id?: string; deduplicated?: boolean; error?: string }> {
  if (!contribution.userId || !contribution.category || !contribution.factType) {
    return { success: false, error: "Invalid contribution payload: userId, category, and factType are required." };
  }

  const db = getDb(dbOverride);

  // Enforce project ownership if projectId is supplied
  if (contribution.projectId) {
    const projectSnap = await db.collection("projects").doc(contribution.projectId).get();
    if (projectSnap.exists && projectSnap.data()?.userId !== contribution.userId) {
      throw new ProjectOwnershipError();
    }
  }

  const fingerprint = computeContributionFingerprint(
    contribution.userId,
    contribution.category,
    contribution.factType,
    contribution.data
  );

  // Check for existing identical contribution for this user (deduplication)
  const existingSnap = await db
    .collection("intelligence_contributions")
    .where("userId", "==", contribution.userId)
    .where("fingerprint", "==", fingerprint)
    .limit(1)
    .get();

  const now = new Date().toISOString();
  if (!existingSnap.empty) {
    const existingDoc = existingSnap.docs[0];
    await existingDoc.ref.set({ updatedAt: now }, { merge: true });
    return { success: true, id: existingDoc.id, deduplicated: true };
  }

  const provenance: IntelligenceProvenance =
    contribution.provenance ||
    (contribution.sourceAppId === "projectz" ? "ai_hypothesis" : "user_provided_fact");

  const ref = db.collection("intelligence_contributions").doc();
  await ref.set({
    userId: contribution.userId,
    sourceAppId: contribution.sourceAppId || "workspace",
    projectId: contribution.projectId || null,
    category: contribution.category,
    factType: contribution.factType,
    provenance,
    data: contribution.data,
    evidence: contribution.evidence || "",
    confidence: contribution.confidence || "medium",
    fingerprint,
    createdAt: now,
    updatedAt: now
  });

  return { success: true, id: ref.id, deduplicated: false };
}

/**
 * Lists all saved Shared Intelligence memory records belonging to the user.
 */
export async function listSharedIntelligenceContributions(
  userId: string,
  dbOverride?: Firestore
): Promise<ProvenanceTaggedFact[]> {
  const db = getDb(dbOverride);
  const snap = await db
    .collection("intelligence_contributions")
    .where("userId", "==", userId)
    .limit(50)
    .get();

  return snap.docs.map((doc) => {
    const d = doc.data() || {};
    return {
      id: doc.id,
      category: String(d.category || "general"),
      factType: String(d.factType || "note"),
      sourceAppId: String(d.sourceAppId || "workspace"),
      provenance: (d.provenance as IntelligenceProvenance) || "user_provided_fact",
      confidence: d.confidence === "high" || d.confidence === "low" ? d.confidence : "medium",
      data: d.data,
      evidence: d.evidence ? String(d.evidence) : undefined,
      updatedAt: d.updatedAt ? String(d.updatedAt) : d.createdAt ? String(d.createdAt) : undefined
    };
  });
}

/**
 * Deletes a saved Shared Intelligence memory record after verifying strict ownership.
 */
export async function deleteSharedIntelligenceContribution(
  userId: string,
  contributionId: string,
  dbOverride?: Firestore
): Promise<{ success: boolean; deleted: boolean; error?: string }> {
  const db = getDb(dbOverride);
  const ref = db.collection("intelligence_contributions").doc(contributionId);
  const snap = await ref.get();
  if (!snap.exists) {
    return { success: false, deleted: false, error: "Contribution not found." };
  }
  if (snap.data()?.userId !== userId) {
    throw new ProjectOwnershipError("Access denied: contribution does not belong to the authenticated user.");
  }
  await ref.delete();
  return { success: true, deleted: true };
}
