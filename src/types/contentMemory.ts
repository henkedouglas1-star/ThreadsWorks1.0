/**
 * ThreadsWorks Intelligent Content Memory Types
 * Provides structured, semantic understanding of creator ideas, relationships,
 * repetition intelligence, variations, performance connections, and content gaps.
 */

export type RelationshipType =
  | 'exact_duplicate'
  | 'near_duplicate'
  | 'same_idea'
  | 'same_topic'
  | 'same_strategic_angle'
  | 'related_idea'
  | 'variation'
  | 'expansion'
  | 'contrasting_perspective'
  | 'new_idea';

export type RelationshipConfidence = 'high' | 'moderate' | 'low' | 'uncertain';

export type RepetitionClassification = 'strategic' | 'accidental' | 'foundational' | 'standard';

export interface IdeaPerformanceSummary {
  sampleSize: number;
  medianViews: number;
  medianInteractions: number;
  avgEngagementRate: number;
  baselineVariancePct: number;
  strongestPostId?: string;
  strongestPostTitle?: string;
  strongestPostHook?: string;
  weakestPostId?: string;
  weakestPostTitle?: string;
}

export interface ContentIdeaVariation {
  postId: string;
  title: string;
  hook: string;
  format: string;
  strategicAngle?: string;
  contentType?: string;
  pillarTitle?: string;
  status: 'Draft' | 'Scheduled' | 'Published';
  createdAt?: any;
  views?: number;
  interactions?: number;
  engagementRate?: number;
}

export interface ContentIdea {
  id: string;
  userId: string;
  canonicalConcept: string; // The core thesis/idea (e.g., "Small audiences can generate high revenue with focused offers")
  summary: string; // Concise distillation of the underlying idea
  primaryTopic: string;
  primaryPillar?: string;
  postIds: string[];
  variations: ContentIdeaVariation[];
  usageCount: number;
  firstUsedAt?: string;
  lastUsedAt?: string;
  anglesUsed: string[];
  formatsUsed: string[];
  contentTypesUsed: string[];
  unusedFormats: string[]; // High-converting formats not yet explored for this idea
  unusedAngles: string[];
  performanceSummary?: IdeaPerformanceSummary;
  relatedOffers: string[];
  relatedCtas: string[];
  repetitionType: RepetitionClassification;
  repetitionAssessment: string; // e.g., "Strategic framework repetition: 4 variations across 3 distinct formats"
  isOverused?: boolean;
  expansionOpportunities: string[];
}

export interface ContentRelationship {
  id: string;
  sourcePostId: string;
  targetPostId: string;
  sourceTitle?: string;
  targetTitle?: string;
  relationshipType: RelationshipType;
  confidence: RelationshipConfidence;
  similarityScore: number; // 0.0 to 1.0
  rationale: string;
  createdAt: string;
}

export type ContentGapType =
  | 'pillar_underrepresented'
  | 'delivery_stage_gap' // e.g. lots of WHAT/WHY, low HOW
  | 'unexplored_high_performer' // successful idea with missing formats
  | 'buyer_awareness_gap'
  | 'missing_proof'
  | 'missing_tactical_breakdown';

export interface ContentGapOpportunity {
  id: string;
  type: ContentGapType;
  title: string;
  description: string;
  recommendation: string;
  targetPillar?: string;
  targetIdeaId?: string;
  suggestedFormats: string[];
  suggestedAngle?: string;
  actionablePrompt?: string;
  confidence: 'strong' | 'usable' | 'exploratory';
}

export interface RepetitionIntelligenceSummary {
  totalIdeas: number;
  strategicRepetitions: number;
  accidentalRepetitions: number;
  healthyRepetitionRatioPct: number;
  highestRepetitionIdea?: {
    concept: string;
    count: number;
    anglesCount: number;
  };
  mostVariedIdea?: {
    concept: string;
    variationsCount: number;
    formatsCount: number;
  };
  freshnessScore: number; // 0 to 100
}

export interface CoverageDistribution {
  pillarDistribution: Record<string, { count: number; percentage: number }>;
  deliveryTypeDistribution: {
    what: number; // What is it (definitions, concepts)
    why: number; // Why it matters (beliefs, stakes, urgency)
    how: number; // How to execute (steps, frameworks, tactics)
    proof: number; // Proof / case studies (transformations, data)
    action: number; // Direct hand-raisers, conversion offers
  };
  formatDistribution: Record<string, number>;
}

export interface IntelligentContentMemoryProfile {
  userId: string;
  lastUpdated: number;
  totalPostsIndexed: number;
  totalIdeasIdentified: number;
  ideas: ContentIdea[];
  relationships: ContentRelationship[];
  gaps: ContentGapOpportunity[];
  repetitionSummary: RepetitionIntelligenceSummary;
  coverage: CoverageDistribution;
  recentHooks: Array<{ hook: string; type?: string; topic?: string }>;
  authenticVocabulary: string[];
  signaturePhrases: string[];
}

export interface SemanticSearchQuery {
  query: string;
  userId?: string;
  pillarFilter?: string;
  formatFilter?: string;
  angleFilter?: string;
  minPerformanceFilter?: 'all' | 'above_baseline' | 'top_quartile';
  repetitionFilter?: 'all' | 'strategic' | 'multiple_uses' | 'single_use';
  limit?: number;
}

export interface SemanticSearchResultItem {
  post: {
    id: string;
    title: string;
    hook: string;
    singlePost: string;
    threadParts?: string[];
    topic?: string;
    format?: string;
    pillarTitle?: string;
    strategicAngle?: string;
    status?: string;
    createdAt?: any;
  };
  matchedIdea?: {
    id: string;
    canonicalConcept: string;
    usageCount: number;
  };
  relevanceScore: number;
  matchReason: string;
  relationshipToQuery: 'direct_concept_match' | 'thematic_match' | 'angle_match' | 'keyword_match';
}

export interface SemanticSearchResponse {
  results: SemanticSearchResultItem[];
  relatedIdeas: ContentIdea[];
  totalMatches: number;
  queryIntent: string;
}

export interface SimilarityCheckRequest {
  text: string;
  hook?: string;
  title?: string;
  userId?: string;
  pillarTitle?: string;
  format?: string;
}

export interface SimilarityCheckResult {
  status: 'likely_duplicate' | 'highly_similar' | 'related_idea' | 'new_variation' | 'new_idea';
  similarityScore: number; // 0.0 to 1.0
  matchedPost?: {
    id: string;
    title: string;
    hook: string;
    preview: string;
    createdAt?: any;
    status?: string;
  };
  matchedIdea?: {
    id: string;
    canonicalConcept: string;
    usageCount: number;
  };
  explanation: string;
  suggestedAction: string;
}

export interface RelevantMemoryContext {
  relevantIdeas: Array<{
    canonicalConcept: string;
    summary: string;
    usageCount: number;
    anglesUsed: string[];
    unusedFormats: string[];
    recentHooks: string[];
  }>;
  recentSimilarHooks: string[];
  protectedVocabulary: string[];
  recommendedUnusedAngles: string[];
  strategicContextNote?: string;
}
