/**
 * ThreadsWorks Client Performance Intelligence API
 * Connects the UI to the backend Content Performance Intelligence engine.
 */

import {
  ContentPerformanceIntelligenceSummary,
  SinglePostIntelligenceContext
} from "../types/intelligence";
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
  fallbackError: string = 'Failed to communicate with intelligence engine.'
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
    console.error(`[ThreadsIntelligenceApi] Request failed for ${url}:`, err);
    return {
      success: false,
      error: err?.message || fallbackError
    } as unknown as T;
  }
}

// In-memory cache for intelligence summaries to reduce redundant network calls
const intelligenceCache = new Map<string, { data: ContentPerformanceIntelligenceSummary; timestamp: number }>();
const CACHE_TTL_MS = 30 * 1000; // 30 second client-side TTL

export async function getThreadsPerformanceIntelligence(
  userId: string,
  period: "7d" | "14d" | "30d" | "90d" | "all" = "all",
  forceRefresh: boolean = false
): Promise<{
  success: boolean;
  intelligence?: ContentPerformanceIntelligenceSummary;
  error?: string;
}> {
  if (!userId) {
    return { success: false, error: "User ID is required." };
  }

  const cacheKey = `${userId}_${period}`;
  if (!forceRefresh) {
    const cached = intelligenceCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return { success: true, intelligence: cached.data };
    }
  }

  const params = new URLSearchParams();
  params.set("userId", userId);
  params.set("period", period);
  if (forceRefresh) params.set("forceRefresh", "true");

  const headers = await getAuthHeaders();
  const result = await safeFetchJson<{
    success: boolean;
    intelligence?: ContentPerformanceIntelligenceSummary;
    error?: string;
  }>(
    `/api/threads/analytics/intelligence/summary?${params.toString()}`,
    { headers },
    'Failed to communicate with intelligence engine.'
  );

  if (result.success && result.intelligence) {
    intelligenceCache.set(cacheKey, { data: result.intelligence, timestamp: Date.now() });
  }

  return result;
}

export async function getSinglePostPerformanceContext(
  userId: string,
  mediaId: string
): Promise<{
  success: boolean;
  context?: SinglePostIntelligenceContext | null;
  error?: string;
}> {
  if (!userId || !mediaId) {
    return { success: false, error: "Both userId and mediaId are required." };
  }

  const params = new URLSearchParams();
  params.set("userId", userId);
  params.set("mediaId", mediaId);

  const headers = await getAuthHeaders();
  return safeFetchJson<{
    success: boolean;
    context?: SinglePostIntelligenceContext | null;
    error?: string;
  }>(
    `/api/threads/analytics/intelligence/post-context?${params.toString()}`,
    { headers },
    'Failed fetching single post performance context.'
  );
}

