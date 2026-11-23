/**
 * ThreadsWorks Content Strategy Intelligence & Content Opportunity Engine - Types & Models
 * Layer 5: Strategic reasoning layer that synthesizes Creator Identity, Business Strategy,
 * Offer Intelligence, CTA Library, Intelligent Content Memory, and Performance Intelligence.
 */

import { SampleSizeConfidence } from "./intelligence";
import { UserProfile, ContentPillar, IdentifiedOffer, ContentDestination } from "../types";

export type OpportunityType =
  | "expand"      // Proven/established concept has additional unexplored depth
  | "reframe"     // Approach existing concept from a substantially different angle/stage
  | "fill_gap"    // Important strategic area (pillar, stage, audience problem) is underrepresented
  | "vary"        // High-leverage variation (Concept + New Format + New Stage)
  | "strengthen"  // Content stage/pillar needs more development based on creator strategy
  | "test"        // Meaningful untested combination framed as an experiment
  | "continue"    // Recurring concept or series has a logical next installment
  | "convert";    // Opportunity naturally connects to an existing creator offer/CTA

export type ContentStage = "what" | "why" | "how" | "proof" | "action";

export type OpportunityStatus =
  | "new"
  | "viewed"
  | "saved"
  | "planned"
  | "created"
  | "published"
  | "observing"
  | "learned"
  | "dismissed"
  | "stale";

export interface OpportunityPerformanceContext {
  baselineMedianViews?: number;
  cohortMedianViews?: number;
  variancePercent?: number; // e.g. +38.5% vs baseline
  sampleSize?: number;
  confidence: SampleSizeConfidence;
  historicalNote: string;
}

export interface OpportunitySourcePost {
  mediaId?: string;
  id?: string;
  title?: string;
  hook?: string;
  publishedAt?: string;
  views?: number;
  engagementRate?: number;
  format?: string;
  strategicAngle?: string;
  stage?: ContentStage;
  permalink?: string;
}

export interface OpportunitySuggestedCTA {
  label: string;
  message: string;
  destinationUrl?: string;
  destinationName?: string;
  relationship: "none" | "soft_connection" | "relevant_cta" | "direct_offer" | "direct_sales";
  offerName?: string;
}

export interface ContentOpportunity {
  id: string; // Deterministic: `opp_${type}_${fingerprint}`
  creatorId: string;
  type: OpportunityType;
  title: string;
  strategicReason: string;
  concept: string; // The core canonical idea/thesis
  pillar?: string;
  angle?: string;
  stage: ContentStage;
  format: string;
  audienceProblem?: string;
  businessConnection?: string;
  performanceContext?: OpportunityPerformanceContext;
  evidenceLevel: SampleSizeConfidence;
  evidenceExplanation: string;
  sourceContentIds: string[];
  sourcePosts?: OpportunitySourcePost[];
  relatedConceptIds: string[];
  recommendedAction: string;
  suggestedCTA?: OpportunitySuggestedCTA;
  status: OpportunityStatus;
  fingerprint: string;
  freshnessScore: number; // 0 to 100
  createdAt: string;
  updatedAt: string;
  scheduledDate?: string;
  createdPostId?: string;
}

export interface PillarEcosystemItem {
  title: string;
  description?: string;
  postCount: number;
  sharePercent: number;
  medianViews: number;
  viewsVsBaselineRatio: number;
  status: "active" | "underrepresented" | "over_indexed" | "unexplored";
  sampleSizeConfidence: SampleSizeConfidence;
  evidenceNote: string;
  identifiedGaps: string[];
  unexploredFormats: string[];
  unexploredAngles: string[];
}

export interface StageDistributionItem {
  stage: ContentStage;
  label: string;
  description: string;
  count: number;
  percentage: number;
  status: "healthy" | "underrepresented" | "over_indexed" | "gap";
  recommendationNote: string;
}

export interface FormatEcosystemItem {
  format: string;
  postCount: number;
  medianViews: number;
  viewsVsBaselineRatio: number;
  sampleSizeConfidence: SampleSizeConfidence;
  status: "frequently_used" | "proven_performer" | "underused" | "unexplored";
  evidenceNote: string;
}

export interface AngleEcosystemItem {
  angle: string;
  postCount: number;
  medianViews: number;
  viewsVsBaselineRatio: number;
  sampleSizeConfidence: SampleSizeConfidence;
  status: "frequently_used" | "high_performing" | "underused" | "unexplored";
  evidenceNote: string;
}

export interface StrategicContentMap {
  creatorId: string;
  generatedAt: string;
  identitySummary: {
    voiceSummary: string;
    writingStyle: string;
    tone: string;
    whoYouHelp: string;
    whatYouHelpThemDo: string;
    primaryKeywords: string[];
  };
  businessSummary: {
    primaryOffers: Array<{ id: string; name: string; type?: string; relationship?: string }>;
    approvedCtaDestinations: ContentDestination[];
    keyBuyerProblems: string[];
  };
  pillars: PillarEcosystemItem[];
  stages: Record<ContentStage, StageDistributionItem>;
  topFormats: FormatEcosystemItem[];
  topAngles: AngleEcosystemItem[];
  performanceBaselines: {
    medianViews: number;
    averageViews: number;
    medianEngagementRate: number;
    totalSampledPosts: number;
    confidence: SampleSizeConfidence;
  };
  strategicGaps: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    priority: "high" | "medium" | "exploratory";
    targetPillar?: string;
    targetStage?: ContentStage;
    suggestedAction: string;
  }>;
}

export interface StrategyOverviewResponse {
  map: StrategicContentMap;
  opportunities: ContentOpportunity[];
  summary: {
    totalOpportunities: number;
    byType: Record<OpportunityType, number>;
    byStage: Record<ContentStage, number>;
    byConfidence: Record<SampleSizeConfidence, number>;
    savedCount: number;
    plannedCount: number;
    createdCount: number;
    dismissedCount: number;
  };
  generatedAt: string;
  timeWindow: "7d" | "14d" | "30d" | "90d" | "all";
  hasAnalytics: boolean;
  hasMemory: boolean;
}

export interface OpportunityActionRequest {
  action: "view" | "save" | "plan" | "create" | "dismiss" | "restore" | "refresh";
  scheduledDate?: string;
  postId?: string;
}
