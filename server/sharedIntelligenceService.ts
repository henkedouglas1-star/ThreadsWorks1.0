/**
 * ContentPaysUs Centralized Shared Intelligence Service
 * Unifies Creator, Audience, Commercial, Project, Content, and Performance Intelligence
 * across all 16 specialized ecosystem applications.
 */

import { initializeApp, getApps, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";
import { distillIntelligentContentMemory } from "./contentMemoryService";

let firebaseConfig: any = null;
let firebaseProjectId = "studio-6594275665-9cb0f";
let databaseId = "(default)";

try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    firebaseConfig = config;
    if (config.projectId) firebaseProjectId = config.projectId;
    if (config.firestoreDatabaseId) databaseId = config.firestoreDatabaseId;
  }
} catch (e) {
  console.error("[SHARED_INTELLIGENCE_INIT] Failed to read config", e);
}

const adminApp = getApps().length === 0
  ? initializeApp({ projectId: firebaseProjectId })
  : getApp();

let db: any = null;
try {
  db = getFirestore(adminApp, databaseId);
} catch (err) {
  console.warn("[SHARED_INTELLIGENCE_INIT] Firestore Admin DB not available:", err);
}

export interface SharedIntelligenceRequest {
  userId: string;
  appId: string;
  projectId?: string;
  taskType: "content_generation" | "offer_positioning" | "audience_analysis" | "performance_review" | "general";
  domains?: ("creator" | "audience" | "commercial" | "project" | "content" | "performance")[];
  sizeBudgetTokens?: number;
}

export interface SharedIntelligenceResponse {
  userId: string;
  appId: string;
  projectId?: string;
  freshness: string;
  domains: {
    creator?: {
      offer: string;
      audience: string;
      desiredResult: string;
      writingStyle: string;
      customInstruction?: string;
    };
    audience?: {
      targetAudience: string;
      painPoints: string[];
      objectives: string[];
    };
    commercial?: {
      offerDetails: string;
      pricingModel?: string;
      salesObjectives?: string;
    };
    project?: {
      id?: string;
      name?: string;
      objective?: string;
      status?: string;
      associatedAppIds?: string[];
    };
    content?: {
      totalPostsIndexed: number;
      topIdeasCount: number;
      authenticVocabulary: string[];
      signaturePhrases: string[];
    };
    performance?: {
      medianViews: number | null;
      avgEngagementRate: number | null;
      topPerformingConcept?: string;
    };
  };
  sourceReferences: string[];
  missingInformation: string[];
}

export interface IntelligenceContributionPayload {
  userId: string;
  sourceAppId: string;
  projectId?: string;
  category: "creator" | "audience" | "commercial" | "project" | "content" | "performance";
  factType: "user_provided_fact" | "verified_platform_data" | "ai_observation" | "unverified_hypothesis";
  data: Record<string, any>;
  evidence?: string;
  confidence?: number;
}

export async function retrieveSharedIntelligenceContext(
  req: SharedIntelligenceRequest
): Promise<SharedIntelligenceResponse> {
  const { userId, appId, projectId, taskType, domains = ["creator", "commercial", "content", "performance"], sizeBudgetTokens = 2000 } = req;

  if (!userId || userId === "anonymous") {
    throw new Error("Unauthorized: Valid authenticated userId required for shared intelligence retrieval.");
  }

  const sourceReferences: string[] = [];
  const missingInformation: string[] = [];
  const responseDomains: SharedIntelligenceResponse["domains"] = {};

  if (!db) {
    throw new Error("Firestore Admin DB unavailable");
  }

  // 1. Fetch User Profile
  let profileData: any = null;
  try {
    const userDocRef = db.collection("users").doc(userId);
    const userSnap = await userDocRef.get();
    if (userSnap.exists) {
      profileData = userSnap.data();
      sourceReferences.push(`users/${userId}`);
    }
  } catch (err) {
    console.warn("[SHARED_INTELLIGENCE] Profile fetch note:", err);
  }

  // Creator Intelligence Domain
  if (domains.includes("creator")) {
    responseDomains.creator = {
      offer: profileData?.offer || "",
      audience: profileData?.audience || "",
      desiredResult: profileData?.desiredResult || "",
      writingStyle: profileData?.writingStyle || "",
      customInstruction: profileData?.customInstruction || profileData?.rawVoice || ""
    };
    if (!profileData?.writingStyle) {
      missingInformation.push("creator.writingStyle");
    }
  }

  // Audience Intelligence Domain
  if (domains.includes("audience")) {
    responseDomains.audience = {
      targetAudience: profileData?.audience || "",
      painPoints: [],
      objectives: profileData?.desiredResult ? [profileData.desiredResult] : []
    };
  }

  // Commercial Intelligence Domain
  if (domains.includes("commercial")) {
    responseDomains.commercial = {
      offerDetails: profileData?.offer || "",
      
      salesObjectives: profileData?.desiredResult || ""
    };
    if (!profileData?.offer) {
      missingInformation.push("commercial.offerDetails");
    }
  }

  // Project Intelligence Domain
  if (domains.includes("project") && projectId) {
    try {
      const projDocRef = db.collection("projects").doc(projectId);
      const projSnap = await projDocRef.get();
      if (projSnap.exists) {
        const pData = projSnap.data();
        if (pData?.userId === userId) {
          responseDomains.project = {
            id: projSnap.id,
            name: pData.name,
            objective: pData.objective,
            status: pData.status,
            associatedAppIds: pData.associatedAppIds || []
          };
          sourceReferences.push(`projects/${projectId}`);
        }
      }
    } catch (err) {
      console.warn("[SHARED_INTELLIGENCE] Project fetch note:", err);
    }
  }

  // Content Intelligence Domain
  if (domains.includes("content")) {
    try {
      const postsSnap = await db.collection("posts").where("userId", "==", userId).limit(50).get();
      const rawPosts: any[] = [];
      postsSnap.forEach((d: any) => rawPosts.push({ id: d.id, ...d.data() }));

      const memoryProfile = await distillIntelligentContentMemory(userId, rawPosts, profileData);
      responseDomains.content = {
        totalPostsIndexed: memoryProfile.totalPostsIndexed,
        topIdeasCount: memoryProfile.ideas.length,
        authenticVocabulary: memoryProfile.authenticVocabulary.slice(0, 10),
        signaturePhrases: memoryProfile.signaturePhrases.slice(0, 5)
      };
      sourceReferences.push(`posts (indexed: ${rawPosts.length})`);
    } catch (err) {
      console.warn("[SHARED_INTELLIGENCE] Content memory distillation note:", err);
      responseDomains.content = {
        totalPostsIndexed: 0,
        topIdeasCount: 0,
        authenticVocabulary: [],
        signaturePhrases: []
      };
    }
  }

  // Performance Intelligence Domain
  if (domains.includes("performance")) {
    try {
      const analyticsSnap = await db.collection("analytics_posts").where("userId", "==", userId).limit(20).get();
      const analyticsRecords: any[] = [];
      analyticsSnap.forEach((d: any) => analyticsRecords.push(d.data()));

      responseDomains.performance = {
        medianViews: null,
        avgEngagementRate: null
      };
      sourceReferences.push(`analytics_posts (records: ${analyticsRecords.length})`);
      missingInformation.push("performance.medianViews", "performance.avgEngagementRate");
    } catch (err) {
      console.warn("[SHARED_INTELLIGENCE] Performance intelligence note:", err);
      missingInformation.push("performance.medianViews", "performance.avgEngagementRate");
      responseDomains.performance = {
        medianViews: null,
        avgEngagementRate: null
      };
    }
  }

  return {
    userId,
    appId,
    projectId,
    freshness: new Date().toISOString(),
    domains: responseDomains,
    sourceReferences,
    missingInformation
  };
}

export async function contributeSharedIntelligence(
  payload: IntelligenceContributionPayload
): Promise<{ success: boolean; contributionId: string }> {
  const { userId, sourceAppId, projectId, category, factType, data, evidence, confidence = 0.8 } = payload;

  if (!userId || userId === "anonymous") {
    throw new Error("Unauthorized: Valid authenticated userId required for intelligence contribution.");
  }

  if (!db) {
    throw new Error("Firestore Admin DB unavailable");
  }

  const contributionRecord = {
    userId,
    sourceAppId,
    projectId: projectId || null,
    category,
    factType,
    data,
    evidence: evidence || null,
    confidence: factType === "user_provided_fact" ? 1.0 : confidence,
    verificationStatus: factType === "user_provided_fact" ? "verified" : "unverified",
    createdAt: new Date().toISOString()
  };

  const docRef = await db.collection("intelligence_contributions").add(contributionRecord);
  return { success: true, contributionId: docRef.id };
}
