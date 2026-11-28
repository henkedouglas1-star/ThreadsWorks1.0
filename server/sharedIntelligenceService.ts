import { createHash } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import { getFirestore } from "firebase-admin/firestore";
import {
  APP_BUSINESS_CONTEXT_CONFIG,
  DEFAULT_BUSINESS_ID,
  type BusinessOfferItem,
  type BusinessProfileRecord
} from "../src/types/businessProfile";
import type {
  IntelligenceInformationSource,
  SharedIntelligenceHubSummary
} from "../src/types/sharedIntelligence";
import { loadBusinessProfile } from "./businessProfileService";

/**
 * Shared Intelligence Infrastructure (Commercial Foundation 1)
 *
 * Strictly enforces:
 * - Zero fabricated analytics, prices, audience pain points, or testimonials.
 * - Explicit provenance labeling on every fact:
 *     `verified_platform_data` | `user_provided_fact` | `ai_hypothesis` | `recommendation`
 * - Explicit separation between `available` and `planned` offerings.
 * - Strict project ownership checks (throws ProjectOwnershipError / HTTP 403 on cross-user access).
 * - Strict provenance integrity (direct client writes cannot assign `verified_platform_data`).
 * - Deterministic contribution deduplication via SHA-256 fingerprint.
 * - Business-scoped retrieval across all 20 ContentPaysUs applications with budget enforcement.
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
  businessId?: string;
  projectId?: string;
  taskType: string;
  domains?: Array<IntelligenceDomain | string>;
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
    professionalBackground?: string;
    expertise?: string;
    experience?: string;
    personality?: string;
    positioning: string;
    voiceStyle: string;
    communicationPreferences?: string;
    tone: string;
    wordsToUse: string;
    wordsToAvoid: string;
    defaultCta?: string;
    hasProfileData: boolean;
  };
  audienceProfile?: {
    provenance: "user_provided_fact";
    targetAudience: string;
    customerProblems?: string;
    desiredOutcome: string;
    buyingMotivations?: string;
    commonObjections?: string;
    preferredChannels?: string;
    hasAudienceData: boolean;
  };
  businessContext?: {
    provenance: "user_provided_fact";
    businessId: string;
    businessName?: string;
    website?: string;
    industry?: string;
    mission?: string;
    vision?: string;
    businessDescription?: string;
    positioning?: string;
    primaryOffer: string;
    businessModel: string;
    revenueStreams?: string;
    competitiveAdvantages?: string;
    currentBusinessStage?: string;
    commercialObjective: string;
    longTermObjectives?: string;
    ecosystemSummary?: string;
    availableOfferings: BusinessOfferItem[];
    plannedOfferings: BusinessOfferItem[];
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
  missingInformation?: string[];
  provenanceSummary: {
    verifiedPlatformDataCount: number;
    userProvidedFactCount: number;
    aiHypothesisCount: number;
    recommendationCount: number;
  };
  metadata: {
    retrievedAt: string;
    appId: string;
    businessId: string;
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

export class IntelligenceIntegrityError extends Error {
  statusCode = 403;
  constructor(message = "Direct client writes cannot assign verified_platform_data provenance.") {
    super(message);
    this.name = "IntelligenceIntegrityError";
  }
}

const VALID_DOMAINS = new Set<IntelligenceDomain>([
  "identity",
  "business",
  "audience",
  "projects",
  "content",
  "performance",
  "products"
]);

export function normalizeRequestedDomains(
  appId: string,
  requested?: Array<IntelligenceDomain | string>
): IntelligenceDomain[] {
  const aliasMap: Record<string, IntelligenceDomain> = {
    creator: "identity",
    commercial: "business",
    offers: "products",
    analytics: "performance"
  };

  if (Array.isArray(requested) && requested.length > 0) {
    const out = new Set<IntelligenceDomain>();
    for (const raw of requested) {
      const key = String(raw || "").trim().toLowerCase();
      const mapped = aliasMap[key] || (key as IntelligenceDomain);
      if (VALID_DOMAINS.has(mapped)) {
        out.add(mapped);
      }
    }
    if (out.size > 0) return Array.from(out);
  }

  const appSpec = APP_BUSINESS_CONTEXT_CONFIG[String(appId || "").toLowerCase()];
  if (appSpec && appSpec.domains.length > 0) {
    return [...appSpec.domains];
  }

  return ["identity", "business", "audience", "projects", "content", "performance", "products"];
}

function computeMissingBusinessInfo(
  bp: BusinessProfileRecord,
  hasRealMetrics: boolean
): string[] {
  const missing: string[] = [];
  if (!bp.creatorProfile.creatorName && !bp.creatorProfile.writingVoice && !bp.creatorContext) {
    missing.push("Creator Profile: add your name, expertise, or writing voice.");
  }
  if (!bp.businessProfile.businessName && !bp.businessProfile.businessDescription) {
    missing.push("Business Profile: add your business name and core description.");
  }
  if (!bp.businessProfile.positioning) {
    missing.push("Business Profile: define your positioning statement.");
  }
  if (!bp.businessProfile.shortTermObjectives && !bp.businessProfile.mission) {
    missing.push("Business Objectives: set your mission or short-term objectives.");
  }
  if (bp.productsAndOffers.length === 0) {
    missing.push("Products & Offers: add at least one available or planned offer.");
  }
  if (!bp.targetAudience.idealCustomers) {
    missing.push("Target Audience: describe your ideal customers.");
  }
  if (!bp.targetAudience.customerProblems) {
    missing.push("Target Audience: capture core customer problems and objections.");
  }
  if (!hasRealMetrics) {
    missing.push("Verified Performance Metrics: connect and sync Threads analytics to unlock real performance signals.");
  }
  return missing;
}

const DEFAULT_MAX_CONTEXT_CHARS = 10000;

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
  const businessId = request.businessId || DEFAULT_BUSINESS_ID;
  const budgetChars = Math.max(1500, Math.min(request.maxContextChars || DEFAULT_MAX_CONTEXT_CHARS, 24000));
  const targetDomains = normalizeRequestedDomains(appId || "threadsworks", domains);

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
      businessId,
      domainsLoaded: [],
      contextVersion: "4.0-commercial-foundation-1",
      budgetChars,
      actualChars: 0,
      budgetTruncated: false
    }
  };

  let loadedBusinessProfile: BusinessProfileRecord | null = null;

  // 1. Business-Scoped Profile + Legacy User Profile Fallback — STRICTLY user-provided facts, zero synthetic defaults
  if (
    targetDomains.includes("identity") ||
    targetDomains.includes("business") ||
    targetDomains.includes("audience")
  ) {
    const [{ profile: bp }, userDoc] = await Promise.all([
      loadBusinessProfile(db, userId, businessId),
      db.collection("users").doc(userId).get().catch(() => ({ exists: false, data: () => ({}) }))
    ]);
    loadedBusinessProfile = bp;
    const userData: Record<string, any> = userDoc.exists ? (userDoc.data() as Record<string, any>) || {} : {};
    const ci = (userData.creatorIdentity as Record<string, any>) || {};

    if (targetDomains.includes("identity")) {
      const displayName = String(bp.creatorProfile.creatorName || userData.displayName || userData.name || "").trim();
      const positioning = String(
        bp.businessProfile.positioning || bp.creatorProfile.professionalBackground || ci.whatYoureKnownFor || userData.positioning || ""
      ).trim();
      const voiceStyle = String(bp.creatorProfile.writingVoice || ci.writingStyle || userData.writingStyle || "").trim();
      const tone = String(ci.tone || bp.creatorProfile.personality || "").trim();
      const wordsToUse = String(ci.wordsYouUse || "").trim();
      const wordsToAvoid = String(bp.creatorProfile.wordsToAvoid || ci.wordsYouAvoid || "").trim();
      const hasProfileData = Boolean(
        displayName ||
          positioning ||
          voiceStyle ||
          tone ||
          bp.creatorProfile.expertise ||
          bp.creatorProfile.professionalBackground ||
          bp.creatorContext
      );

      response.creatorIdentity = {
        provenance: "user_provided_fact",
        displayName,
        professionalBackground: bp.creatorProfile.professionalBackground || undefined,
        expertise: bp.creatorProfile.expertise || undefined,
        experience: bp.creatorProfile.experience || undefined,
        personality: bp.creatorProfile.personality || undefined,
        positioning,
        voiceStyle,
        communicationPreferences: bp.creatorProfile.communicationPreferences || undefined,
        tone,
        wordsToUse,
        wordsToAvoid,
        defaultCta: bp.creatorProfile.defaultCta || undefined,
        hasProfileData
      };
      if (hasProfileData) response.provenanceSummary.userProvidedFactCount += 1;
      response.metadata.domainsLoaded.push("identity");
    }

    if (targetDomains.includes("audience")) {
      const targetAudience = String(bp.targetAudience.idealCustomers || userData.audience || ci.whoYouHelp || "").trim();
      const desiredOutcome = String(bp.targetAudience.desiredOutcomes || userData.desiredResult || ci.whatYouHelpThemDo || "").trim();
      const hasAudienceData = Boolean(
        targetAudience ||
          desiredOutcome ||
          bp.targetAudience.customerProblems ||
          bp.targetAudience.buyingMotivations ||
          bp.targetAudience.commonObjections
      );

      response.audienceProfile = {
        provenance: "user_provided_fact",
        targetAudience,
        customerProblems: bp.targetAudience.customerProblems || undefined,
        desiredOutcome,
        buyingMotivations: bp.targetAudience.buyingMotivations || undefined,
        commonObjections: bp.targetAudience.commonObjections || undefined,
        preferredChannels: bp.targetAudience.preferredCommunicationChannels || undefined,
        hasAudienceData
      };
      if (hasAudienceData) response.provenanceSummary.userProvidedFactCount += 1;
      response.metadata.domainsLoaded.push("audience");
    }

    if (targetDomains.includes("business")) {
      const availableOfferings = bp.productsAndOffers.filter((o) => o.availabilityStatus === "available");
      const plannedOfferings = bp.productsAndOffers.filter(
        (o) => o.availabilityStatus === "planned" || o.availabilityStatus === "in_development"
      );
      const primaryOffer = String(
        availableOfferings[0]?.name || bp.productsAndOffers[0]?.name || userData.offer || ""
      ).trim();
      const businessModel = String(bp.businessProfile.businessModel || userData.businessModel || "").trim();
      const commercialObjective = String(
        bp.businessProfile.shortTermObjectives ||
          bp.businessProfile.mission ||
          userData.commercialObjective ||
          userData.desiredResult ||
          ""
      ).trim();
      const hasBusinessData = Boolean(
        bp.businessProfile.businessName ||
          bp.businessProfile.businessDescription ||
          bp.businessProfile.positioning ||
          primaryOffer ||
          businessModel ||
          commercialObjective ||
          availableOfferings.length > 0 ||
          plannedOfferings.length > 0
      );

      response.businessContext = {
        provenance: "user_provided_fact",
        businessId: bp.businessId,
        businessName: bp.businessProfile.businessName || undefined,
        website: bp.businessProfile.website || undefined,
        industry: bp.businessProfile.industry || undefined,
        mission: bp.businessProfile.mission || undefined,
        vision: bp.businessProfile.vision || undefined,
        businessDescription: bp.businessProfile.businessDescription || undefined,
        positioning: bp.businessProfile.positioning || undefined,
        primaryOffer,
        businessModel,
        revenueStreams: bp.businessProfile.revenueStreams || undefined,
        competitiveAdvantages: bp.businessProfile.competitiveAdvantages || undefined,
        currentBusinessStage: bp.businessProfile.currentBusinessStage || undefined,
        commercialObjective,
        longTermObjectives: bp.businessProfile.longTermObjectives || undefined,
        ecosystemSummary: bp.businessProfile.ecosystemSummary || undefined,
        availableOfferings,
        plannedOfferings,
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

  if (loadedBusinessProfile) {
    response.missingInformation = computeMissingBusinessInfo(
      loadedBusinessProfile,
      Boolean(response.performanceSignals?.hasRealMetrics)
    );
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
    if (response.businessContext && measure() > budgetChars) {
      while (response.businessContext.plannedOfferings.length > 3 && measure() > budgetChars) {
        response.businessContext.plannedOfferings.pop();
      }
    }
    currentSize = measure();
  }
  response.metadata.actualChars = currentSize;

  return response;
}

/**
 * Records a provenance-tagged contribution with deterministic deduplication, project ownership check,
 * and strict provenance integrity guard (direct client writes cannot assign `verified_platform_data`).
 */
export async function contributeSharedIntelligence(
  contribution: SharedIntelligenceContribution,
  dbOverride?: Firestore,
  options?: { allowVerifiedPlatformWrite?: boolean }
): Promise<{ success: boolean; id?: string; deduplicated?: boolean; error?: string }> {
  if (!contribution.userId || !contribution.category || !contribution.factType) {
    return { success: false, error: "Invalid contribution payload: userId, category, and factType are required." };
  }

  if (
    contribution.provenance === "verified_platform_data" &&
    options?.allowVerifiedPlatformWrite !== true
  ) {
    throw new IntelligenceIntegrityError(
      'Direct client writes cannot assign "verified_platform_data" provenance.'
    );
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

function summarizeContributionData(data: unknown): string {
  if (!data) return "";
  if (typeof data === "string") return data.slice(0, 260);
  if (typeof data === "object") {
    const obj = data as Record<string, any>;
    const title = typeof obj.title === "string" ? obj.title.trim() : "";
    const summary = typeof obj.summary === "string" ? obj.summary.trim() : "";
    if (title && summary) return `${title} — ${summary}`.slice(0, 260);
    if (title) return title.slice(0, 260);
    if (summary) return summary.slice(0, 260);
    try {
      return JSON.stringify(obj).slice(0, 260);
    } catch {
      return "";
    }
  }
  return String(data).slice(0, 260);
}

/**
 * Builds the strictly grounded Section 5 ("Shared Intelligence") Hub Summary
 * for the authenticated member. Zero fabricated metrics, sales, or insights.
 */
export async function getSharedIntelligenceHubSummary(
  userId: string,
  dbOverride?: Firestore,
  businessId: string = DEFAULT_BUSINESS_ID
): Promise<SharedIntelligenceHubSummary> {
  const db = getDb(dbOverride);

  const [
    businessLoaded,
    postsSnap,
    projectsSnap,
    productsSnap,
    assetsSnap,
    analyticsSnap,
    contributions
  ] = await Promise.all([
    loadBusinessProfile(db, userId, businessId),
    db.collection("posts").where("userId", "==", userId).limit(100).get().catch(() => ({ size: 0, docs: [] })),
    db.collection("projects").where("userId", "==", userId).limit(50).get().catch(() => ({ size: 0, docs: [] })),
    db.collection("funnelworks_projects").doc(userId).collection("projects").limit(30).get().catch(() => ({ size: 0, docs: [] })),
    db.collection("ecosystem_assets").where("userId", "==", userId).limit(100).get().catch(() => ({ size: 0, docs: [] })),
    db.collection("analytics_posts").where("userId", "==", userId).limit(50).get().catch(() => ({ size: 0, docs: [] })),
    listSharedIntelligenceContributions(userId, db).catch(() => [])
  ]);

  const bp = businessLoaded.profile;

  // Real synced metrics ONLY (never fabricated!)
  const viewsList: number[] = [];
  const engagementRates: number[] = [];
  let totalViews = 0;
  let totalInteractions = 0;

  (analyticsSnap.docs || []).forEach((doc: any) => {
    const m = (doc.data()?.metrics as Record<string, any>) || {};
    const views = typeof m.views === "number" && m.views >= 0 ? m.views : null;
    const interactions =
      (typeof m.likes === "number" ? m.likes : 0) +
      (typeof m.replies === "number" ? m.replies : 0) +
      (typeof m.reposts === "number" ? m.reposts : 0) +
      (typeof m.quotes === "number" ? m.quotes : 0);
    if (views !== null) {
      viewsList.push(views);
      totalViews += views;
      if (views > 0) engagementRates.push((interactions / views) * 100);
    }
    totalInteractions += interactions;
  });

  const syncedPostsCount = analyticsSnap.size || 0;
  const hasRealMetrics = syncedPostsCount > 0;
  const medianViews = hasRealMetrics ? computeMedian(viewsList) : null;
  const avgEngagementRate =
    hasRealMetrics && engagementRates.length > 0
      ? Number((engagementRates.reduce((acc, v) => acc + v, 0) / engagementRates.length).toFixed(2))
      : null;

  const aiInsights = contributions
    .filter((c) => c.provenance === "recommendation" || c.provenance === "ai_hypothesis")
    .map((c) => ({
      id: c.id || "",
      sourceAppId: c.sourceAppId,
      category: c.category,
      factType: c.factType,
      provenance: c.provenance as "recommendation" | "ai_hypothesis",
      summary: summarizeContributionData(c.data),
      createdAt: c.updatedAt || ""
    }));

  const savedBusinessKnowledge = contributions.map((c) => ({
    id: c.id || "",
    sourceAppId: c.sourceAppId,
    category: c.category,
    factType: c.factType,
    provenance: c.provenance,
    summary: summarizeContributionData(c.data),
    createdAt: c.updatedAt || "",
    isolated: c.sourceAppId === "projectz"
  }));

  const availableCount = bp.productsAndOffers.filter((o) => o.availabilityStatus === "available").length;
  const plannedCount = bp.productsAndOffers.filter(
    (o) => o.availabilityStatus === "planned" || o.availabilityStatus === "in_development"
  ).length;

  const informationSources: IntelligenceInformationSource[] = [
    {
      id: "source_business_profile",
      label: "Business Profile & Offers",
      sourceType: "business_profile",
      provenance: "user_provided_fact",
      status: businessLoaded.hasSavedBusinessProfile ? "connected" : "empty",
      summary: businessLoaded.hasSavedBusinessProfile
        ? `${bp.businessProfile.businessName || "Saved business profile"} (${availableCount} available, ${plannedCount} planned offers)`
        : "Not yet saved in Business Profile; using legacy Creator Context if present.",
      updatedAt: bp.updatedAt || null
    },
    {
      id: "source_creator_context",
      label: "Creator Context & Voice",
      sourceType: "legacy_creator_context",
      provenance: "user_provided_fact",
      status: bp.creatorContext || bp.creatorProfile.writingVoice ? "connected" : "empty",
      summary: bp.creatorContext
        ? `Natural-language creator context (${bp.creatorContext.length} chars)`
        : bp.creatorProfile.writingVoice
        ? "Structured writing voice configured"
        : "No Creator Context saved yet.",
      updatedAt: bp.updatedAt || null
    },
    {
      id: "source_projects",
      label: "Shared Workspace Projects",
      sourceType: "projects",
      provenance: "user_provided_fact",
      status: (projectsSnap.size || 0) > 0 ? "connected" : "empty",
      summary:
        (projectsSnap.size || 0) > 0
          ? `${projectsSnap.size} saved project(s) available across applications`
          : "No shared projects created yet."
    },
    {
      id: "source_products",
      label: "ProductWorks Digital Products",
      sourceType: "products",
      provenance: "user_provided_fact",
      status: (productsSnap.size || 0) > 0 ? "connected" : "empty",
      summary:
        (productsSnap.size || 0) > 0
          ? `${productsSnap.size} saved digital product package(s)`
          : "No ProductWorks products created yet."
    },
    {
      id: "source_analytics",
      label: "Synced Threads Analytics",
      sourceType: "analytics",
      provenance: "verified_platform_data",
      status: hasRealMetrics ? "connected" : "empty",
      summary: hasRealMetrics
        ? `${syncedPostsCount} synced Threads post(s) with verified platform metrics`
        : "No synced Threads analytics metrics yet — zero metrics fabricated."
    },
    {
      id: "source_contributions",
      label: "Application Memory Contributions",
      sourceType: "contributions",
      provenance: "recommendation",
      status: contributions.length > 0 ? "connected" : "empty",
      summary:
        contributions.length > 0
          ? `${contributions.length} saved intelligence record(s) from workspace applications`
          : "No saved cross-app intelligence contributions yet."
    }
  ];

  return {
    businessId: bp.businessId,
    businessObjectives: {
      mission: bp.businessProfile.mission || "",
      shortTermObjectives: bp.businessProfile.shortTermObjectives || "",
      longTermObjectives: bp.businessProfile.longTermObjectives || "",
      provenance: "user_provided_fact"
    },
    historicalActivity: {
      savedPostsCount: postsSnap.size || 0,
      savedProjectsCount: projectsSnap.size || 0,
      savedProductsCount: productsSnap.size || 0,
      savedEcosystemAssetsCount: assetsSnap.size || 0,
      savedContributionsCount: contributions.length,
      provenance: "verified_platform_data"
    },
    verifiedPerformanceMetrics: {
      hasRealMetrics,
      syncedPostsCount,
      medianViews,
      avgEngagementRate,
      totalViews: hasRealMetrics ? totalViews : null,
      totalInteractions: hasRealMetrics ? totalInteractions : null,
      provenance: "verified_platform_data",
      note: hasRealMetrics
        ? `Computed directly from ${syncedPostsCount} synced Threads analytics record(s).`
        : "No synced platform metrics recorded yet. Connect Threads and sync analytics to populate verified metrics."
    },
    aiInsights,
    savedBusinessKnowledge,
    informationSources,
    missingInformation: computeMissingBusinessInfo(bp, hasRealMetrics),
    generatedAt: new Date().toISOString()
  };
}
