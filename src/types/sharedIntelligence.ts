/**
    * Shared Intelligence Layer Typed Interfaces
    * Prepares future applications to contribute and retrieve shared context
    * without duplicating creator information.
    */
import { EcosystemCreatorIdentity } from "./creatorIdentity";
import { EcosystemProject } from "./sharedProjects";

export type IntelligenceDomain =
  | "identity"
  | "business"
  | "audience"
  | "projects"
  | "content"
  | "performance"
  | "products";

export type IntelligenceProvenance =
  | "verified_platform_data"
  | "user_provided_fact"
  | "ai_hypothesis"
  | "recommendation";

export interface IntelligenceInformationSource {
  id: string;
  label: string;
  sourceType: "business_profile" | "legacy_creator_context" | "projects" | "products" | "analytics" | "contributions";
  provenance: IntelligenceProvenance;
  status: "connected" | "empty";
  summary: string;
  updatedAt?: string | null;
}

export interface SharedIntelligenceHubSummary {
  businessId: string;
  businessObjectives: {
    mission: string;
    shortTermObjectives: string;
    longTermObjectives: string;
    provenance: "user_provided_fact";
  };
  historicalActivity: {
    savedPostsCount: number;
    savedProjectsCount: number;
    savedProductsCount: number;
    savedEcosystemAssetsCount: number;
    savedContributionsCount: number;
    provenance: "verified_platform_data";
  };
  verifiedPerformanceMetrics: {
    hasRealMetrics: boolean;
    syncedPostsCount: number;
    medianViews: number | null;
    avgEngagementRate: number | null;
    totalViews: number | null;
    totalInteractions: number | null;
    provenance: "verified_platform_data";
    note: string;
  };
  aiInsights: Array<{
    id: string;
    sourceAppId: string;
    category: string;
    factType: string;
    provenance: "recommendation" | "ai_hypothesis";
    summary: string;
    createdAt: string;
  }>;
  savedBusinessKnowledge: Array<{
    id: string;
    sourceAppId: string;
    category: string;
    factType: string;
    provenance: IntelligenceProvenance;
    summary: string;
    createdAt: string;
    isolated?: boolean;
  }>;
  informationSources: IntelligenceInformationSource[];
  missingInformation: string[];
  generatedAt: string;
}

export interface SharedIntelligenceContext {
  creator: EcosystemCreatorIdentity;
  activeProjects: EcosystemProject[];
  recentMemoryContext?: {
    partCount: number;
    lastGeneratedAt?: string;
  };
}
