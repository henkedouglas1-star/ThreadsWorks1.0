import { useState, useEffect } from "react";

// In-Memory cache for deterministic requests / DB reads
const requestCache = new Map<string, { data: any; expiry: number }>();
const inFlightRequests = new Map<string, Promise<any>>();

export interface CacheConfig {
  ttlMs?: number;
  forceRefresh?: boolean;
}

/**
 * Executes a Promise-returning function with Deduplication and Caching.
 * Eliminates duplicate concurrent requests and aggressively caches results.
 */
export async function executeWithPerformanceEngine<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  config: CacheConfig = {}
): Promise<T> {
  const ttl = config.ttlMs || 1000 * 60 * 5; // Default 5 minute cache

  // 1. Cache Check
  if (!config.forceRefresh) {
    const cached = requestCache.get(cacheKey);
    if (cached && Date.now() < cached.expiry) {
      return cached.data as T;
    }
  }

  // 2. Deduplication Check (In-Flight)
  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey) as Promise<T>;
  }

  // 3. Execution
  const fetchPromise = fetcher()
    .then((data) => {
      requestCache.set(cacheKey, { data, expiry: Date.now() + ttl });
      return data;
    })
    .finally(() => {
      inFlightRequests.delete(cacheKey);
    });

  inFlightRequests.set(cacheKey, fetchPromise);
  return fetchPromise;
}

/**
 * Clear the cache for a specific key (useful after mutations/optimistic updates)
 */
export function invalidatePerformanceCache(cacheKey: string) {
  requestCache.delete(cacheKey);
}

/**
 * Optimistic UI update helper.
 * Applies the UI state immediately, executes the async task, and rolls back if it fails.
 */
export async function executeOptimisticUpdate<T>(
  asyncTask: () => Promise<any>,
  updateUI: () => void,
  rollbackUI: () => void,
  onSuccess?: () => void,
  onError?: (err: any) => void
) {
  updateUI(); // Apply immediately
  try {
    await asyncTask();
    if (onSuccess) onSuccess();
  } catch (err) {
    rollbackUI(); // Rollback on failure
    if (onError) onError(err);
  }
}
