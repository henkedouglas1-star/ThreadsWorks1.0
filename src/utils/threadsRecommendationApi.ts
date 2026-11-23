/**
 * ThreadsWorks Client Performance Recommendation API
 * Connects the UI to the backend AI Content Performance Recommendation engine.
 */

import {
  PerformanceRecommendationsResponse,
  ContentPerformanceRecommendation,
  RecommendationCategory
} from "../types/recommendations";
import { auth } from "../firebase";

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

async function safeFetchJson<T>(
  url: string,
  options?: RequestInit,
  fallbackError: string = 'Failed to communicate with recommendation engine.'
): Promise<T> {
  try {
    const res = await fetch(url, options);
    const text = await res.text();

    let json: any = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch (_) {}
    }

    if (json && typeof json === 'object') {
      return json as T;
    }

    if (!res.ok) {
      const trimmed = text.trim();
      const cleanSnippet = trimmed.startsWith('<') ? `HTTP ${res.status} error` : (trimmed.slice(0, 150) || `HTTP ${res.status}`);
      return {
        success: false,
        error: `Server responded with ${cleanSnippet}`
      } as unknown as T;
    }

    return {
      success: false,
      error: fallbackError
    } as unknown as T;
  } catch (err: any) {
    console.error(`[ThreadsRecommendationApi] Request failed for ${url}:`, err);
    return {
      success: false,
      error: err?.message || fallbackError
    } as unknown as T;
  }
}

export async function getThreadsPerformanceRecommendations(
  userId: string,
  period: "7d" | "14d" | "30d" | "90d" | "all" = "all",
  category?: RecommendationCategory | "all",
  forceRefresh: boolean = false
): Promise<{
  success: boolean;
  data?: PerformanceRecommendationsResponse;
  error?: string;
}> {
  if (!userId) {
    return { success: false, error: "User ID is required." };
  }

  const params = new URLSearchParams();
  params.set("userId", userId);
  params.set("period", period);
  if (category && category !== "all") {
    params.set("category", category);
  }
  if (forceRefresh) {
    params.set("forceRefresh", "true");
  }

  const headers = await getAuthHeaders();
  return safeFetchJson<{
    success: boolean;
    data?: PerformanceRecommendationsResponse;
    error?: string;
  }>(
    `/api/threads/analytics/recommendations?${params.toString()}`,
    { headers },
    'Failed fetching recommendations.'
  );
}

export async function refreshThreadsPerformanceRecommendations(
  userId: string,
  period: "7d" | "14d" | "30d" | "90d" | "all" = "all"
): Promise<{
  success: boolean;
  data?: PerformanceRecommendationsResponse;
  error?: string;
}> {
  if (!userId) {
    return { success: false, error: "User ID is required." };
  }

  const headers = await getAuthHeaders();
  return safeFetchJson<{
    success: boolean;
    data?: PerformanceRecommendationsResponse;
    error?: string;
  }>(
    "/api/threads/analytics/recommendations/refresh",
    {
      method: "POST",
      headers,
      body: JSON.stringify({ userId, period })
    },
    'Failed to refresh recommendations.'
  );
}

