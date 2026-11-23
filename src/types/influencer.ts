export type OutreachObjective =
  | "collaboration"
  | "promotion"
  | "affiliate_partnership"
  | "podcast_interview"
  | "product_partnership"
  | "relationship_building"
  | "expert_connection"
  | "custom";

export type InfluencerRelationshipStatus =
  | "new"
  | "shortlisted"
  | "contacted"
  | "responded"
  | "active"
  | "completed"
  | "archived";

export type OutreachResponseStatus =
  | "contacted"
  | "awaiting_response"
  | "responded"
  | "interested"
  | "not_interested"
  | "follow_up_needed"
  | "collaboration_active"
  | "completed"
  | "no_response";

export interface CreatorProfileData {
  id: string;
  name: string;
  username: string;
  threadsUsername?: string; // Canonical normalized username (e.g. "justinwelsh")
  threadsProfileUrl?: string; // Canonical Threads profile URL (e.g. "https://www.threads.net/@justinwelsh")
  isVerifiedProfile?: boolean; // True if account is verified real Threads account
  source?: string; // Origin data source e.g. "verified_threads_directory"
  platform?: string; // e.g. "Threads"
  profilePicUrl?: string;
  bio: string;
  followerCount?: number;
  niche: string;
  category: string;
  topics: string[];
  location?: string;
  creatorType?: string; // e.g. "Educator", "Builder", "Strategist", "Thought Leader"
  lastVerifiedAt?: string;
  verificationStatus?: string;
  verificationMethod?: string;
  verificationConfidence?: string;
  verificationEvidence?: any;
  recentPosts?: Array<{
    id?: string;
    text: string;
    publishedAt?: string;
    likes?: number;
    replies?: number;
    reposts?: number;
    url?: string;
  }>;
  engagementInfo?: {
    avgLikes?: number;
    avgReplies?: number;
    estimatedEngagementRate?: string;
  };
  whyFound?: string; // "Why ThreadsWorks found them"
  collabRelevance?: string; // Potential collaboration relevance summary
  internalCreatorId?: string;
  threadsUserId?: string;
  displayName?: string;
  profileImageUrl?: string;
  biography?: string;
  profileUrl?: string;
  verified?: boolean;
  discoveredFromQuery?: string;
  discoveryPostIds?: string[];
  discoveryPostTexts?: string[];
  lastDiscoveredAt?: string;
  lastProfileRefreshAt?: string;
  lastPostsRefreshAt?: string;
  relevanceScore?: number;
  matchReason?: string;
}

export interface CreatorContentIntelligence {
  recurringTopics: string[];
  contentThemes: string[];
  contentStyle: string; // e.g. "Direct, step-by-step tactical breakdowns"
  messagingPatterns: string;
  audienceInterests: string[];
  commonProblemsDiscussed: string[];
  productsServicesMentioned: string[];
  collaborationOpportunities: string[];
}

export interface RelevanceToMe {
  overallOverlapScore: number; // 0 - 100
  overlapSummary: string;
  sharedTopics: string[];
  audienceIntersection: string;
  nicheAlignment: string;
  offerCompatibility: string;
  whyRelevant: string; // Factual contextual explanation comparison
}

export interface InfluenceSponsorshipDetails {
  lowRange: number;
  recommendedOffer: number;
  highRange: number;
  deliverable: string;
}

export interface InfluenceValuation {
  influenceScore: number; // 0 - 100
  confidence: "HIGH" | "MEDIUM" | "LOW";
  confidenceExplanation: string;
  recommendedSponsorships: Record<string, {
    lowRange: number;
    recommendedOffer: number;
    highRange: number;
    deliverable: string;
  }>;
  negotiationSupport: {
    recommendedOpeningOffer: number;
    targetRange: string;
    estimatedFairValue: number;
  };
  whyThisPrice: string;
  metricConfidenceScore: number;
  factors: {
    baseValue: number;
    engagementPremium: number;
    replyPremium: number;
    audienceFitPremium: number;
    rankPremium: number;
    deliverableAdjustments: Record<string, number>;
  };
}

export interface CreatorIntelligenceProfile {
  overview: CreatorProfileData;
  contentIntelligence: CreatorContentIntelligence;
  relevanceToMe: RelevanceToMe;
  valuation?: InfluenceValuation;
}

export interface OutreachEvent {
  id: string;
  userId: string;
  influencerId: string;
  objective: OutreachObjective;
  customObjectiveDescription?: string;
  dmText: string;
  whyThisDmWorks: string; // Brief internal explanation
  status: OutreachResponseStatus;
  notes?: string;
  isFollowUp?: boolean;
  parentEventId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavedInfluencer {
  id: string;
  userId: string;
  creator: CreatorProfileData;
  intelligence?: CreatorIntelligenceProfile;
  dateDiscovered: string;
  dateSaved: string;
  tags: string[];
  notes: string;
  relationshipStatus: InfluencerRelationshipStatus;
  campaign?: string;
  outreachHistory: OutreachEvent[];
  responseStatus: OutreachResponseStatus;
  outcomeData?: {
    outcomeNotes?: string;
    rating?: number;
    convertedAt?: string;
    dealValue?: string;
    // Campaign feedback loop outcomes
    actualPrice?: number;
    actualViews?: number;
    actualLikes?: number;
    actualReplies?: number;
    actualClicks?: number;
    actualConversions?: number;
    actualRevenue?: number;
    roiPercentage?: string;
    deliverableType?: string;
    campaignDate?: string;
    campaignOutcome?: "success" | "neutral" | "unsuccessful" | "";
  };
  createdAt: string;
  updatedAt: string;
}

export interface InfluencerSearchFilters {
  niche?: string;
  category?: string;
  keywords?: string;
  audienceSize?: string; // "all" | "micro" | "mid" | "macro"
  creatorType?: string;
  topics?: string;
  location?: string;
  minEngagement?: string;
}

export interface MultiTouchSequenceStep {
  stepNumber: number;
  title: string;
  delayDays: number;
  recommendedTimeWindow: string; // e.g. "Tue-Thu 10 AM - 1 PM local time"
  dmText: string;
  angleExplanation: string;
}

export interface MultiTouchSequenceResponse {
  creatorUsername: string;
  optimalSendWindow: string;
  steps: MultiTouchSequenceStep[];
}

export interface CampaignFolder {
  id: string;
  userId?: string;
  name: string;
  description?: string;
  targetObjective?: OutreachObjective;
  status: "active" | "completed" | "draft";
  createdAt: string;
}

export interface BulkDMResult {
  creator: CreatorProfileData;
  intelligence?: CreatorIntelligenceProfile;
  dmText: string;
  whyThisDmWorks: string;
}

export interface InfluencerROIMetrics {
  totalInvestment: number;
  totalRevenueGenerated: number;
  totalDealsClosed: number;
  netProfit: number;
  roiPercentage: string;
}

export interface DMGenerationRequest {
  influencer: CreatorProfileData;
  intelligence?: CreatorIntelligenceProfile;
  objective: OutreachObjective;
  customObjective?: string;
  toneAdjustment?: "default" | "shorter" | "casual" | "direct" | "warmer";
  campaign?: string;
  userContext?: any;
  citeRecentPostHook?: boolean;
}

export interface DMGenerationResponse {
  dmText: string;
  whyThisDmWorks: string;
  suggestedFollowUpAngle?: string;
}

export interface FollowUpRequest {
  influencer: CreatorProfileData;
  intelligence: CreatorIntelligenceProfile;
  originalDmText: string;
  timeSinceContact: string; // e.g. "3 days ago"
  previousStatus: OutreachResponseStatus;
  objective: OutreachObjective;
}

export interface IntelligenceOutcomesSummary {
  totalSavedCount: number;
  totalOutreachCount: number;
  totalRespondedCount: number;
  overallResponseRate: string;
  topPerformingNiches: Array<{ niche: string; responseRate: string; count: number }>;
  topPerformingObjectives: Array<{ objective: string; responseRate: string; count: number }>;
  keyLearnedTakeaways: string[];
}

export interface JointThreadConcept {
  title: string;
  dualAngleSummary: string;
  myPerspectiveRole: string;
  creatorPerspectiveRole: string;
  outlinePosts: string[];
  pitchDmSummary: string;
}

export interface CoCreationPitchResponse {
  creatorUsername: string;
  pitchHeadline: string;
  concepts: JointThreadConcept[];
  onePagerMarkdown: string;
}

export interface SignalQualityAudit {
  qualityScore: number; // 0 - 100
  tier: "Elite High-Signal" | "Solid Engagement" | "Niche Micro-Community" | "Low Signals";
  commentDepthRating: string;
  replyVelocity: string;
  greenFlags: string[];
  redFlags: string[];
  recommendedOutreachApproach: string;
}

export type CreatorOutreachItemStatus =
  | "Draft"
  | "Generating"
  | "Ready For Review"
  | "Approved"
  | "Queued"
  | "Creating Reply"
  | "Reply Container Created"
  | "Publishing Reply"
  | "Publishing"
  | "Replied"
  | "Published"
  | "Published As Reply"
  | "Verified"
  | "Verification Pending"
  | "Awaiting Confirmation"
  | "Failed"
  | "Reply Failed"
  | "Reply Restricted"
  | "Skipped"
  | "Cancelled";

export interface CreatorOutreachTargetPost {
  id: string; // Meta post ID or tracked ID
  shortcode?: string;
  permalink?: string;
  username?: string;
  text: string;
  publishedAt?: string;
  url?: string;
  likes?: number;
  replies?: number;
  reposts?: number;
  isSensitive?: boolean;
  eligible: boolean;
  skipReason?: string;
}

export interface CanonicalCreatorTarget {
  internalCreatorId: string;
  creatorThreadsId?: string;
  creatorUsername: string;
  creatorDisplayName: string;
  creatorProfileUrl: string;
  creatorProfilePicUrl?: string;
  targetPostId: string;
  targetPostUrl: string;
  targetPostText: string;
  commentText?: string;
}

export interface OutreachDiagnosticInfo {
  stage?: string;
  metaCode?: number;
  metaSubcode?: number;
  safeMessage?: string;
  targetPostId?: string;
  creationId?: string;
  publishedMediaId?: string;
  grantedScopes?: string[];
  rawMetaError?: any;
}

export interface CreatorOutreachItem {
  id: string; // Canonical unique outreachItemId
  batchId: string;
  userId: string;
  creatorId: string; // internalCreatorId
  creatorName: string; // displayName
  creatorUsername: string; // Threads username (e.g. "lexfridman")
  creatorThreadsId?: string;
  creatorProfilePicUrl?: string;
  targetPost: CreatorOutreachTargetPost;
  alternativePosts?: CreatorOutreachTargetPost[];
  canonicalTarget?: CanonicalCreatorTarget;
  commentDirection?: string;
  generatedComment?: string;
  approvedComment?: string;
  characterCount: number;
  status: CreatorOutreachItemStatus;
  skipReason?: string;
  errorReason?: string;
  attemptCount: number;
  publishedReplyId?: string;
  publishedPermalink?: string;
  publishedAt?: string;
  verificationStatus?: "Verified" | "Verification Pending" | "Unverified" | "Failed";
  verificationDetails?: {
    intendedCreatorUsername: string;
    intendedParentPostId: string;
    publishedReplyId: string;
    parentPostConfirmed?: boolean;
    conversationConfirmed?: boolean;
    verifiedAt?: string;
  };
  diagnosticInfo?: OutreachDiagnosticInfo;
  createdAt: string;
  updatedAt: string;
}

export interface CreatorOutreachBatch {
  id: string;
  userId: string;
  threadsUserId?: string;
  threadsUsername?: string;
  status: "draft" | "review" | "queued" | "publishing" | "completed" | "stopped" | "failed";
  items: CreatorOutreachItem[];
  commentDirection?: string;
  cooldownDays: number;
  summary: {
    totalCreators: number;
    eligiblePosts: number;
    generatedComments: number;
    approvedComments: number;
    publishedReplies: number;
    skippedCount: number;
    failedCount: number;
    awaitingConfirmationCount: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface OutreachRetrievePostsRequest {
  creatorIds: string[];
  cooldownDays?: number;
  userId: string;
}

export interface OutreachRetrievePostsResponse {
  success: boolean;
  items: CreatorOutreachItem[];
  error?: string;
}

export interface OutreachGenerateCommentsRequest {
  batchId?: string;
  userId: string;
  items: CreatorOutreachItem[];
  commentDirection?: string;
  userContext?: any;
}

export interface OutreachGenerateCommentsResponse {
  success: boolean;
  items: CreatorOutreachItem[];
  error?: string;
}

export interface OutreachPublishBatchRequest {
  batchId: string;
  userId: string;
  itemIds?: string[]; // Specific approved items to publish, or all approved if omitted
}

export interface OutreachPublishBatchResponse {
  success: boolean;
  batchId: string;
  processedCount: number;
  publishedCount: number;
  failedCount: number;
  awaitingConfirmationCount: number;
  items: CreatorOutreachItem[];
  error?: string;
}


