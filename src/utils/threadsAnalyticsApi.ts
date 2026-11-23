/**
 * ThreadsWorks Client Analytics API
 * Interacts with backend Analytics Data Layer endpoints without exposing tokens or raw Meta structures.
 */

import {
  AccountAnalyticsSnapshot,
  PostAnalyticsRecord,
  AnalyticsSyncSummary,
  PostAnalyticsFilterOptions
} from '../types/analytics';
import { auth } from '../firebase';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }
  } catch (_) {}
  return headers;
}

async function safeFetchJson<T>(
  url: string,
  options?: RequestInit,
  fallbackError: string = 'Failed to communicate with analytics server.'
): Promise<T> {
  try {
    const res = await fetch(url, options);
    const text = await res.text();

    let json: any = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch (_) {
        // Response is not JSON (e.g. HTML or plain text error page)
      }
    }

    if (json && typeof json === 'object') {
      return json as T;
    }

    // Handle non-JSON response with HTTP status
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
    console.error(`[ThreadsAnalyticsApi] Request failed for ${url}:`, err);
    return {
      success: false,
      error: err?.message || fallbackError
    } as unknown as T;
  }
}

export async function syncThreadsAnalytics(
  userId: string,
  options?: { maxPosts?: number; forceRefresh?: boolean }
): Promise<{
  success: boolean;
  accountSnapshot?: AccountAnalyticsSnapshot;
  posts?: PostAnalyticsRecord[];
  summary?: AnalyticsSyncSummary;
  error?: string;
}> {
  if (!userId) {
    return { success: false, error: "Authentication required (userId missing)." };
  }

  const headers = await getAuthHeaders();
  return safeFetchJson<{
    success: boolean;
    accountSnapshot?: AccountAnalyticsSnapshot;
    posts?: PostAnalyticsRecord[];
    summary?: AnalyticsSyncSummary;
    error?: string;
  }>(
    '/api/threads/analytics/sync',
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        userId,
        maxPosts: options?.maxPosts || 30,
        forceRefresh: Boolean(options?.forceRefresh)
      })
    },
    'Failed to synchronize Threads analytics.'
  );
}

export async function getThreadsAccountAnalytics(
  userId: string,
  window?: "1d" | "7d" | "30d"
): Promise<{
  success: boolean;
  account?: AccountAnalyticsSnapshot | null;
  error?: string;
}> {
  if (!userId) return { success: false, error: 'User ID is required.' };

  const headers = await getAuthHeaders();
  const windowQuery = window ? `&window=${encodeURIComponent(window)}` : '';
  return safeFetchJson<{
    success: boolean;
    account?: AccountAnalyticsSnapshot | null;
    error?: string;
  }>(
    `/api/threads/analytics/account?userId=${encodeURIComponent(userId)}${windowQuery}`,
    { headers },
    'Failed fetching account analytics.'
  );
}

export async function getThreadsPostAnalytics(options: PostAnalyticsFilterOptions): Promise<{
  success: boolean;
  posts: PostAnalyticsRecord[];
  total: number;
  error?: string;
}> {
  if (!options.userId) return { success: false, posts: [], total: 0, error: 'User ID is required.' };

  const params = new URLSearchParams();
  params.set('userId', options.userId);
  if (options.limit) params.set('limit', String(options.limit));
  if (options.offset) params.set('offset', String(options.offset));
  if (options.sortBy) params.set('sortBy', options.sortBy);
  if (options.sortDirection) params.set('sortDirection', options.sortDirection);
  if (options.topic) params.set('topic', options.topic);
  if (options.pillarTitle) params.set('pillarTitle', options.pillarTitle);
  if (options.mediaType) params.set('mediaType', options.mediaType);
  if (options.since) params.set('since', options.since);
  if (options.until) params.set('until', options.until);

  const headers = await getAuthHeaders();
  const res = await safeFetchJson<{
    success: boolean;
    posts?: PostAnalyticsRecord[];
    total?: number;
    error?: string;
  }>(
    `/api/threads/analytics/posts?${params.toString()}`,
    { headers },
    'Failed fetching post analytics.'
  );

  return {
    success: Boolean(res.success),
    posts: res.posts || [],
    total: res.total || (res.posts ? res.posts.length : 0),
    error: res.error
  };
}

export async function getThreadsSinglePostAnalytics(userId: string, mediaId: string): Promise<{
  success: boolean;
  post?: PostAnalyticsRecord | null;
  error?: string;
}> {
  if (!userId || !mediaId) return { success: false, error: 'Both userId and mediaId are required.' };

  const headers = await getAuthHeaders();
  return safeFetchJson<{
    success: boolean;
    post?: PostAnalyticsRecord | null;
    error?: string;
  }>(
    `/api/threads/analytics/post/${encodeURIComponent(mediaId)}?userId=${encodeURIComponent(userId)}`,
    { headers },
    'Failed fetching single post analytics.'
  );
}

export async function getThreadsAnalyticsSyncStatus(userId: string): Promise<{
  success: boolean;
  summary?: AnalyticsSyncSummary | null;
  error?: string;
}> {
  if (!userId) return { success: false, error: 'User ID is required.' };

  const headers = await getAuthHeaders();
  return safeFetchJson<{
    success: boolean;
    summary?: AnalyticsSyncSummary | null;
    error?: string;
  }>(
    `/api/threads/analytics/sync-status?userId=${encodeURIComponent(userId)}`,
    { headers },
    'Failed fetching sync status.'
  );
}

