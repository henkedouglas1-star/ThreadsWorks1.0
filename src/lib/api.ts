import { executeWithPerformanceEngine, invalidatePerformanceCache } from "./performanceEngine";
import { classifyGenerationError } from "../utils/errorClassifier";

export interface ApiFetchOptions extends RequestInit {
  timeoutMs?: number;
}

// Helper to fetch with resilient retry on transient network errors (e.g. Failed to fetch)
async function fetchWithRetry(url: string, options: ApiFetchOptions = {}, retries = 1): Promise<Response> {
  const timeoutMs = options.timeoutMs || 120000;
  let lastError: any;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort(new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s.`));
    }, timeoutMs);

    // If caller provided their own signal, listen to it
    if (options.signal) {
      options.signal.addEventListener("abort", () => {
        controller.abort(options.signal?.reason);
      });
    }

    try {
      const headers = new Headers(options.headers || {});
      if (typeof options.body === "string" && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (err: any) {
      clearTimeout(timeoutId);
      lastError = err;

      // Don't retry if manually canceled or aborted
      if (err?.name === "AbortError" || options.signal?.aborted) {
        throw err;
      }

      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }
  }

  throw lastError;
}

// Base API execution abstraction wrapper
export async function apiFetch<T>(endpoint: string, options: ApiFetchOptions = {}, disableCache = false): Promise<T> {
  // We want to cache deterministic AI extractions and analysis.
  // We do NOT want to cache dynamic generators like generate-content-angles or mutations.
  const isCachableEndpoint = (endpoint.startsWith("/api/extract") || 
                              endpoint.startsWith("/api/understand") || 
                              endpoint.startsWith("/api/offer-intelligence") ||
                              endpoint.startsWith("/api/buyer-intelligence") ||
                              endpoint.startsWith("/api/enhance-context")) &&
                             !endpoint.includes("generate");

  const runRequest = async (): Promise<T> => {
    try {
      const res = await fetchWithRetry(endpoint, options);
      if (!res.ok) {
        let errData;
        try { errData = await res.json(); } catch(e) {}
        const errorMsg = errData?.error || errData?.message || `Server returned ${res.status}: ${res.statusText}`;
        const classified = classifyGenerationError(new Error(errorMsg), {
          httpStatus: res.status,
          stage: "network_request"
        });
        throw new Error(classified.userMessage);
      }
      return await res.json() as T;
    } catch (err: any) {
      const classified = classifyGenerationError(err, { stage: "network_request" });
      throw new Error(classified.userMessage);
    }
  };

  if (!isCachableEndpoint || (options.method && options.method !== 'GET') || disableCache) {
    return runRequest();
  }

  // Generate cache key for GET and deterministic POST requests
  const cacheKey = `api_${endpoint}_${options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : ''}`;

  return executeWithPerformanceEngine<T>(
    cacheKey,
    runRequest,
    { forceRefresh: disableCache, ttlMs: 1000 * 60 * 30 } // 30 min cache for deterministic AI
  );
}
