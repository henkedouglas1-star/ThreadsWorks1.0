import { 
  PerformanceDimension, 
  SampleSizeConfidence, 
  PerformanceTier 
} from "./intelligence";

export type RecommendationCategory = 
  | "what_to_repeat"
  | "what_to_test"
  | "what_to_refine"
  | "what_to_avoid_over_repeating"
  | "content_mix";

export type ContentIntent = "attention" | "conversation" | "offer_alignment";

export interface RecommendationEvidenceSourcePost {
  mediaId: string;
  text: string;
  publishedAt: string;
  views: number;
  engagementRate: number;
  permalink?: string;
}

export interface RecommendationEvidence {
  metric: "views" | "engagement_rate" | "interactions" | "combination";
  creatorBaseline: number;
  cohortMedian: number;
  variancePercent: number; // e.g., +42.5 or -15.0
  sampleSize: number;
  confidence: SampleSizeConfidence;
  confidenceExplanation: string;
  sourcePosts: RecommendationEvidenceSourcePost[];
  dimension?: PerformanceDimension;
  dimensionValue?: string;
}

export interface RecommendationStrategicContext {
  pillarTitle?: string;
  strategicAngle?: string;
  format?: string;
  topic?: string;
  cta?: string;
  mediaType?: string;
  intent?: ContentIntent;
  relatedOfferName?: string;
  approvedCtaUrl?: string;
}

export interface ContentPerformanceRecommendation {
  id: string;
  category: RecommendationCategory;
  title: string;
  recommendation: string;
  rationale: string;
  confidence: SampleSizeConfidence;
  evidence: RecommendationEvidence;
  strategicContext: RecommendationStrategicContext;
  suggestedAction?: {
    actionLabel: string;
    prefillTopic?: string;
    prefillAngle?: string;
    prefillFormat?: string;
    prefillPillar?: string;
    prefillCta?: string;
  };
  timeWindow: "7d" | "14d" | "30d" | "90d" | "all";
  createdAt: string;
  expiresAt?: string;
}

export interface PerformanceRecommendationsResponse {
  recommendations: ContentPerformanceRecommendation[];
  totalGenerated: number;
  timeWindow: "7d" | "14d" | "30d" | "90d" | "all";
  generatedAt: string;
  creatorBaselineMedianViews: number;
  creatorBaselineMedianEngagement: number;
  totalPostsAnalyzed: number;
  categoriesSummary: {
    whatToRepeatCount: number;
    whatToTestCount: number;
    whatToRefineCount: number;
    whatToAvoidCount: number;
    contentMixCount: number;
  };
}
