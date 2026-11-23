import { auth } from "../firebase";
export { buildThreadsProfileUrl, getThreadsProfileUrl, normalizeThreadsUsername } from "./threadsProfileHelper";
import {
  CreatorProfileData,
  CreatorIntelligenceProfile,
  DMGenerationRequest,
  DMGenerationResponse,
  FollowUpRequest,
  InfluencerSearchFilters,
  SavedInfluencer,
  OutreachEvent,
  OutreachObjective,
  InfluencerRelationshipStatus,
  OutreachResponseStatus,
  IntelligenceOutcomesSummary,
  MultiTouchSequenceResponse,
  BulkDMResult,
  CampaignFolder,
  CoCreationPitchResponse,
  SignalQualityAudit,
} from "../types/influencer";

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  try {
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }
  } catch (_) {}
  return headers;
}

async function safeFetchJson<T>(url: string, options?: RequestInit, fallbackError = "API request failed"): Promise<T> {
  try {
    const res = await fetch(url, options);
    const text = await res.text();
    let json: any = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch (_) {}
    }
    if (json && typeof json === "object") {
      return json as T;
    }
    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}: ${text.slice(0, 100)}` } as unknown as T;
    }
    return { success: false, error: fallbackError } as unknown as T;
  } catch (err: any) {
    console.error(`[InfluencerApi] Request error for ${url}:`, err);
    return { success: false, error: err?.message || fallbackError } as unknown as T;
  }
}

export async function searchCreatorsApi(
  query: string,
  filters: InfluencerSearchFilters & {
    sortBy?: "most_relevant" | "recently_active" | "verified" | "emerging" | "largest_audience";
    page?: number;
    limit?: number;
  },
  userContext?: any
): Promise<{
  success: boolean;
  creators?: CreatorProfileData[];
  total?: number;
  page?: number;
  limit?: number;
  hasMore?: boolean;
  queryExpansions?: string[];
  discoveryStats?: any;
  error?: string;
}> {
  const headers = await getAuthHeaders();
  return safeFetchJson<{
    success: boolean;
    creators?: CreatorProfileData[];
    total?: number;
    page?: number;
    limit?: number;
    hasMore?: boolean;
    queryExpansions?: string[];
    discoveryStats?: any;
    error?: string;
  }>(
    "/api/influencer/discover",
    {
      method: "POST",
      headers,
      body: JSON.stringify({ query, filters, userContext }),
    },
    "Failed to search creators"
  );
}

export async function analyzeCreatorApi(
  creator: CreatorProfileData,
  userContext?: any,
  userId?: string
): Promise<{ success: boolean; intelligence?: CreatorIntelligenceProfile; error?: string }> {
  const headers = await getAuthHeaders();
  return safeFetchJson<{ success: boolean; intelligence?: CreatorIntelligenceProfile; error?: string }>(
    "/api/influencer/analyze",
    {
      method: "POST",
      headers,
      body: JSON.stringify({ creator, userContext, userId }),
    },
    "Failed to analyze creator"
  );
}

export async function generateDMApi(
  request: DMGenerationRequest
): Promise<{ success: boolean; data?: DMGenerationResponse; error?: string }> {
  const headers = await getAuthHeaders();
  return safeFetchJson<{ success: boolean; data?: DMGenerationResponse; error?: string }>(
    "/api/influencer/generate-dm",
    {
      method: "POST",
      headers,
      body: JSON.stringify(request),
    },
    "Failed to generate DM"
  );
}

export async function generateFollowUpDMApi(
  request: FollowUpRequest,
  userContext?: any
): Promise<{ success: boolean; data?: DMGenerationResponse; error?: string }> {
  const headers = await getAuthHeaders();
  return safeFetchJson<{ success: boolean; data?: DMGenerationResponse; error?: string }>(
    "/api/influencer/generate-followup",
    {
      method: "POST",
      headers,
      body: JSON.stringify({ ...request, userContext }),
    },
    "Failed to generate follow-up"
  );
}

export async function getSavedInfluencersApi(
  userId: string
): Promise<{ success: boolean; influencers?: SavedInfluencer[]; error?: string }> {
  const headers = await getAuthHeaders();
  return safeFetchJson<{ success: boolean; influencers?: SavedInfluencer[]; error?: string }>(
    `/api/influencer/saved?userId=${encodeURIComponent(userId)}`,
    { headers },
    "Failed to fetch saved creators"
  );
}

export async function saveInfluencerApi(
  userId: string,
  creator: CreatorProfileData,
  intelligence?: CreatorIntelligenceProfile,
  tags: string[] = [],
  notes = "",
  relationshipStatus: InfluencerRelationshipStatus = "new",
  campaign = ""
): Promise<{ success: boolean; influencer?: SavedInfluencer; error?: string }> {
  const headers = await getAuthHeaders();
  return safeFetchJson<{ success: boolean; influencer?: SavedInfluencer; error?: string }>(
    "/api/influencer/saved",
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        userId,
        creator,
        intelligence,
        tags,
        notes,
        relationshipStatus,
        campaign,
      }),
    },
    "Failed to save creator"
  );
}

export async function updateSavedInfluencerApi(
  id: string,
  updates: Partial<SavedInfluencer>
): Promise<{ success: boolean; influencer?: SavedInfluencer; error?: string }> {
  const headers = await getAuthHeaders();
  return safeFetchJson<{ success: boolean; influencer?: SavedInfluencer; error?: string }>(
    `/api/influencer/saved/${encodeURIComponent(id)}`,
    {
      method: "PUT",
      headers,
      body: JSON.stringify(updates),
    },
    "Failed to update saved creator"
  );
}

export async function deleteSavedInfluencerApi(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const headers = await getAuthHeaders();
  return safeFetchJson<{ success: boolean; error?: string }>(
    `/api/influencer/saved/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      headers,
    },
    "Failed to delete creator"
  );
}

export async function recordOutreachApi(payload: {
  userId: string;
  influencerId: string;
  objective: OutreachObjective;
  dmText: string;
  whyThisDmWorks?: string;
  status?: OutreachResponseStatus;
  notes?: string;
  isFollowUp?: boolean;
}): Promise<{ success: boolean; event?: OutreachEvent; error?: string }> {
  const headers = await getAuthHeaders();
  return safeFetchJson<{ success: boolean; event?: OutreachEvent; error?: string }>(
    "/api/influencer/outreach",
    {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    },
    "Failed to record outreach"
  );
}

export async function getOutcomesSummaryApi(
  userId: string
): Promise<{ success: boolean; summary?: IntelligenceOutcomesSummary; error?: string }> {
  const headers = await getAuthHeaders();
  return safeFetchJson<{ success: boolean; summary?: IntelligenceOutcomesSummary; error?: string }>(
    `/api/influencer/outcomes-summary?userId=${encodeURIComponent(userId)}`,
    { headers },
    "Failed to fetch outcomes summary"
  );
}

export async function generateSequenceApi(
  influencer: CreatorProfileData,
  intelligence?: CreatorIntelligenceProfile,
  objective?: OutreachObjective,
  userContext?: any
): Promise<{ success: boolean; sequence?: MultiTouchSequenceResponse; error?: string }> {
  const headers = await getAuthHeaders();
  return safeFetchJson<{ success: boolean; sequence?: MultiTouchSequenceResponse; error?: string }>(
    "/api/influencer/generate-sequence",
    {
      method: "POST",
      headers,
      body: JSON.stringify({ influencer, intelligence, objective, userContext }),
    },
    "Failed to generate sequence"
  );
}

export async function generateBulkDMApi(
  creators: CreatorProfileData[],
  objective?: OutreachObjective,
  userContext?: any
): Promise<{ success: boolean; results?: BulkDMResult[]; error?: string }> {
  const headers = await getAuthHeaders();
  return safeFetchJson<{ success: boolean; results?: BulkDMResult[]; error?: string }>(
    "/api/influencer/generate-bulk-dm",
    {
      method: "POST",
      headers,
      body: JSON.stringify({ creators, objective, userContext }),
    },
    "Failed to batch generate DMs"
  );
}

export async function getCampaignsApi(
  userId: string
): Promise<{ success: boolean; campaigns?: CampaignFolder[]; error?: string }> {
  const headers = await getAuthHeaders();
  return safeFetchJson<{ success: boolean; campaigns?: CampaignFolder[]; error?: string }>(
    `/api/influencer/campaigns?userId=${encodeURIComponent(userId)}`,
    { headers },
    "Failed to fetch campaigns"
  );
}

export async function createCampaignApi(
  userId: string,
  name: string,
  description?: string,
  targetObjective?: OutreachObjective
): Promise<{ success: boolean; campaign?: CampaignFolder; error?: string }> {
  const headers = await getAuthHeaders();
  return safeFetchJson<{ success: boolean; campaign?: CampaignFolder; error?: string }>(
    "/api/influencer/campaigns",
    {
      method: "POST",
      headers,
      body: JSON.stringify({ userId, name, description, targetObjective }),
    },
    "Failed to create campaign"
  );
}

export async function generateCoCreationPitchApi(
  influencer: CreatorProfileData,
  intelligence?: CreatorIntelligenceProfile,
  userContext?: any
): Promise<{ success: boolean; pitch?: CoCreationPitchResponse; error?: string }> {
  const headers = await getAuthHeaders();
  return safeFetchJson<{ success: boolean; pitch?: CoCreationPitchResponse; error?: string }>(
    "/api/influencer/co-creation-pitch",
    {
      method: "POST",
      headers,
      body: JSON.stringify({ influencer, intelligence, userContext }),
    },
    "Failed to generate co-creation pitch"
  );
}

export async function analyzeSignalQualityApi(
  influencer: CreatorProfileData
): Promise<{ success: boolean; audit?: SignalQualityAudit; error?: string }> {
  const headers = await getAuthHeaders();
  return safeFetchJson<{ success: boolean; audit?: SignalQualityAudit; error?: string }>(
    "/api/influencer/signal-quality",
    {
      method: "POST",
      headers,
      body: JSON.stringify({ influencer }),
    },
    "Failed to audit signal quality"
  );
}

// ==========================================
// CREATOR OUTREACH ENGINE API METHODS
// ==========================================

import {
  CreatorOutreachBatch,
  CreatorOutreachItem,
  OutreachRetrievePostsResponse,
  OutreachGenerateCommentsResponse,
  OutreachPublishBatchResponse,
} from "../types/influencer";

export async function retrieveOutreachPostsApi(
  userId: string,
  creatorIds: string[],
  cooldownDays = 7
): Promise<{ success: boolean; batch?: CreatorOutreachBatch; error?: string }> {
  const headers = await getAuthHeaders();
  return safeFetchJson<{ success: boolean; batch?: CreatorOutreachBatch; error?: string }>(
    "/api/influencer/outreach/retrieve-posts",
    {
      method: "POST",
      headers,
      body: JSON.stringify({ userId, creatorIds, cooldownDays }),
    },
    "Failed to retrieve creator posts"
  );
}

export async function generateOutreachCommentsApi(
  userId: string,
  batchId: string,
  items: CreatorOutreachItem[],
  commentDirection?: string,
  userContext?: any
): Promise<{ success: boolean; batch?: CreatorOutreachBatch; error?: string }> {
  const headers = await getAuthHeaders();
  return safeFetchJson<{ success: boolean; batch?: CreatorOutreachBatch; error?: string }>(
    "/api/influencer/outreach/generate-comments",
    {
      method: "POST",
      headers,
      body: JSON.stringify({ userId, batchId, items, commentDirection, userContext }),
    },
    "Failed to generate outreach comments"
  );
}

export async function publishOutreachBatchApi(
  userId: string,
  batchId: string,
  itemIds?: string[],
  items?: CreatorOutreachItem[]
): Promise<{ success: boolean; batch?: CreatorOutreachBatch; error?: string }> {
  const headers = await getAuthHeaders();
  return safeFetchJson<{ success: boolean; batch?: CreatorOutreachBatch; error?: string }>(
    "/api/influencer/outreach/publish-batch",
    {
      method: "POST",
      headers,
      body: JSON.stringify({ userId, batchId, itemIds, items }),
    },
    "Failed to publish outreach batch"
  );
}

export async function saveOutreachBatchApi(
  batch: CreatorOutreachBatch
): Promise<{ success: boolean; batch?: CreatorOutreachBatch; error?: string }> {
  const headers = await getAuthHeaders();
  return safeFetchJson<{ success: boolean; batch?: CreatorOutreachBatch; error?: string }>(
    "/api/influencer/outreach/save-batch",
    {
      method: "POST",
      headers,
      body: JSON.stringify({ batch }),
    },
    "Failed to save outreach batch"
  );
}

export async function stopOutreachQueueApi(
  batchId: string
): Promise<{ success: boolean; stopped?: boolean; error?: string }> {
  const headers = await getAuthHeaders();
  return safeFetchJson<{ success: boolean; stopped?: boolean; error?: string }>(
    "/api/influencer/outreach/stop-queue",
    {
      method: "POST",
      headers,
      body: JSON.stringify({ batchId }),
    },
    "Failed to stop outreach queue"
  );
}

export async function getOutreachBatchesApi(
  userId: string
): Promise<{ success: boolean; batches?: CreatorOutreachBatch[]; error?: string }> {
  return safeFetchJson<{ success: boolean; batches?: CreatorOutreachBatch[]; error?: string }>(
    `/api/influencer/outreach/batches?userId=${encodeURIComponent(userId)}`,
    {
      method: "GET",
    },
    "Failed to fetch outreach batches"
  );
}

export async function retryOutreachItemApi(
  userId: string,
  batchId: string,
  itemId: string
): Promise<{ success: boolean; item?: CreatorOutreachItem; error?: string }> {
  const headers = await getAuthHeaders();
  return safeFetchJson<{ success: boolean; item?: CreatorOutreachItem; error?: string }>(
    "/api/influencer/outreach/retry-item",
    {
      method: "POST",
      headers,
      body: JSON.stringify({ userId, batchId, itemId }),
    },
    "Failed to retry outreach item"
  );
}

export async function getVerifiedDirectoryApi(): Promise<{
  success: boolean;
  creators?: CreatorProfileData[];
  error?: string;
}> {
  return safeFetchJson<{ success: boolean; creators?: CreatorProfileData[]; error?: string }>(
    "/api/influencer/directory",
    { method: "GET" },
    "Failed to fetch creator directory"
  );
}

export async function seedFeaturedCreatorsApi(
  userId: string
): Promise<{ success: boolean; seededCount?: number; influencers?: SavedInfluencer[]; error?: string }> {
  const headers = await getAuthHeaders();
  return safeFetchJson<{ success: boolean; seededCount?: number; influencers?: SavedInfluencer[]; error?: string }>(
    "/api/influencer/seed-featured",
    {
      method: "POST",
      headers,
      body: JSON.stringify({ userId }),
    },
    "Failed to seed featured creators"
  );
}

export async function quickAddCreatorApi(
  userId: string,
  username: string,
  userContext?: any
): Promise<{ success: boolean; creator?: CreatorProfileData; influencer?: SavedInfluencer; error?: string }> {
  const headers = await getAuthHeaders();
  return safeFetchJson<{ success: boolean; creator?: CreatorProfileData; influencer?: SavedInfluencer; error?: string }>(
    "/api/influencer/quick-add",
    {
      method: "POST",
      headers,
      body: JSON.stringify({ userId, username, userContext }),
    },
    "Failed to add creator"
  );
}



