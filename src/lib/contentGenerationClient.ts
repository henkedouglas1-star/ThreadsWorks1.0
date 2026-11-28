export interface GenerationJobProgressSnapshot {
  stage: string;
  completedCount: number;
  requestedCount: number;
  currentChunk: number;
  totalChunks: number;
  updatedAt?: number;
}

export interface PersistedActiveGenerationJob {
  jobId: string;
  jobToken: string;
  clientRequestId: string;
  idempotencyKey: string;
  userId: string;
  targetCategory: string;
  requestedCount: number;
  startedAt: number;
}

export interface ResilientBatchGenerationOptions {
  payloadString: string;
  clientRequestId: string;
  idempotencyKey?: string;
  userId?: string;
  targetCategory?: string;
  requestedCount?: number;
  signal: AbortSignal;
  getAuthToken?: () => Promise<string | null | undefined>;
  onProgress?: (progress: GenerationJobProgressSnapshot, meta?: { reconnecting?: boolean; attempt?: number }) => void;
  onJobStarted?: (job: PersistedActiveGenerationJob) => void;
  fetchImpl?: typeof fetch;
  sleepImpl?: (ms: number, signal?: AbortSignal) => Promise<void>;
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
  pollIntervalMs?: number;
  perRequestTimeoutMs?: number;
  maxStartAttempts?: number;
  maxConsecutivePollFailures?: number;
  jobsEndpoint?: string;
  syncFallbackEndpoint?: string;
}

export interface ResumeGenerationJobOptions {
  userId?: string;
  signal: AbortSignal;
  getAuthToken?: () => Promise<string | null | undefined>;
  onProgress?: (progress: GenerationJobProgressSnapshot, meta?: { reconnecting?: boolean; attempt?: number }) => void;
  fetchImpl?: typeof fetch;
  sleepImpl?: (ms: number, signal?: AbortSignal) => Promise<void>;
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
  pollIntervalMs?: number;
  perRequestTimeoutMs?: number;
  maxConsecutivePollFailures?: number;
  jobsEndpoint?: string;
}

export interface ResilientBatchGenerationResult {
  data: any;
  httpStatus: number;
  rawResponseBody: string;
  mode: "job" | "sync_fallback" | "recovered_job";
  jobId?: string;
  deduplicated?: boolean;
  targetCategory?: string;
  requestedCount?: number;
}

const ACTIVE_JOB_STORAGE_KEY = "threadsworks_active_content_gen_job_v1";
const PERSISTED_JOB_MAX_AGE_MS = 12 * 60 * 1000;
const TRANSIENT_HTTP_STATUSES = new Set([408, 429, 502, 503, 504]);

function getDefaultStorage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // storage unavailable (private mode / sandbox)
  }
  return null;
}

export function createIdempotencyKey(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `idem_${Date.now()}_${rand}`;
}

export function savePersistedActiveJob(
  job: PersistedActiveGenerationJob,
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null
): void {
  const store = storage === undefined ? getDefaultStorage() : storage;
  if (!store) return;
  try {
    store.setItem(ACTIVE_JOB_STORAGE_KEY, JSON.stringify(job));
  } catch {
    // ignore quota errors
  }
}

export function loadPersistedActiveJob(
  expectedUserId?: string,
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null
): PersistedActiveGenerationJob | null {
  const store = storage === undefined ? getDefaultStorage() : storage;
  if (!store) return null;
  try {
    const raw = store.getItem(ACTIVE_JOB_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedActiveGenerationJob;
    if (!parsed || typeof parsed.jobId !== "string" || !parsed.jobId) {
      return null;
    }
    if (typeof parsed.startedAt !== "number" || Date.now() - parsed.startedAt > PERSISTED_JOB_MAX_AGE_MS) {
      store.removeItem(ACTIVE_JOB_STORAGE_KEY);
      return null;
    }
    if (
      expectedUserId &&
      expectedUserId !== "anonymous" &&
      parsed.userId &&
      parsed.userId !== "anonymous" &&
      parsed.userId !== expectedUserId
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPersistedActiveJob(
  expectedJobId?: string,
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null
): void {
  const store = storage === undefined ? getDefaultStorage() : storage;
  if (!store) return;
  try {
    if (expectedJobId) {
      const current = loadPersistedActiveJob(undefined, store);
      if (current && current.jobId !== expectedJobId) {
        return;
      }
    }
    store.removeItem(ACTIVE_JOB_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function isTransientNetworkError(err: unknown): boolean {
  if (!err) return false;
  const name = String((err as any)?.name || "");
  const message = String((err as any)?.message || err || "").toLowerCase();
  if (name === "AbortError") return false;
  return (
    name === "TypeError" ||
    message.includes("load failed") ||
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("network request failed") ||
    message.includes("network connection was lost") ||
    message.includes("the internet connection appears to be offline") ||
    message.includes("fetch failed") ||
    message.includes("socket") ||
    message.includes("econnreset") ||
    message.includes("etimedout") ||
    message.includes("aborted due to per-poll timeout")
  );
}

function createAbortError(message = "Generation request was cancelled."): Error {
  const err = new Error(message);
  err.name = "AbortError";
  return err;
}

function createApiError(
  message: string,
  meta: {
    status?: number;
    errorCode?: string;
    retryable?: boolean;
    failedDrafts?: unknown;
    responseBodyText?: string;
  }
): Error {
  const err = new Error(message);
  (err as any).status = meta.status;
  (err as any).errorCode = meta.errorCode;
  (err as any).retryable = meta.retryable;
  (err as any).failedDrafts = meta.failedDrafts;
  (err as any).responseBodyText = meta.responseBodyText;
  return err;
}

export function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(createAbortError());
  }
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      cleanup();
      reject(createAbortError());
    };
    const onOnline = () => {
      cleanup();
      resolve();
    };
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      if (typeof window !== "undefined" && typeof window.removeEventListener === "function") {
        window.removeEventListener("online", onOnline);
      }
    };
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
    if (ms >= 1500 && typeof window !== "undefined" && typeof window.addEventListener === "function") {
      window.addEventListener("online", onOnline, { once: true });
    }
  });
}

async function fetchWithPerRequestTimeout(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  outerSignal: AbortSignal,
  timeoutMs: number
): Promise<Response> {
  if (outerSignal.aborted) {
    throw createAbortError();
  }

  const localController = new AbortController();
  let timedOut = false;

  const onOuterAbort = () => {
    try {
      localController.abort(outerSignal.reason || createAbortError());
    } catch {
      // no-op
    }
  };
  outerSignal.addEventListener("abort", onOuterAbort, { once: true });

  const timer = setTimeout(() => {
    timedOut = true;
    try {
      localController.abort(new Error("Request aborted due to per-poll timeout"));
    } catch {
      // no-op
    }
  }, timeoutMs);

  try {
    return await fetchImpl(url, {
      ...init,
      signal: localController.signal,
    });
  } catch (err: any) {
    if (outerSignal.aborted) {
      throw createAbortError(
        typeof outerSignal.reason === "string"
          ? outerSignal.reason
          : "Generation request was cancelled."
      );
    }
    if (timedOut) {
      throw new Error("Request aborted due to per-poll timeout");
    }
    throw err;
  } finally {
    clearTimeout(timer);
    outerSignal.removeEventListener("abort", onOuterAbort);
  }
}

async function parseErrorResponse(response: Response): Promise<{
  errorText: string;
  parsed: any;
}> {
  const errorText = await response.text().catch(() => "");
  let parsed: any = {};
  try {
    parsed = errorText ? JSON.parse(errorText) : {};
  } catch {
    parsed = {};
  }
  return { errorText, parsed };
}

function sendBestEffortCancel(
  fetchImpl: typeof fetch,
  jobsEndpoint: string,
  jobId: string,
  jobToken: string | null,
  authHeader: string | null
): void {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (jobToken) {
    headers["X-Job-Token"] = jobToken;
  }
  if (authHeader) {
    headers["Authorization"] = authHeader;
  }
  try {
    void fetchImpl(`${jobsEndpoint}/${encodeURIComponent(jobId)}/cancel`, {
      method: "POST",
      headers,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // no-op
  }
}

async function resolveAuthHeader(
  getAuthToken?: () => Promise<string | null | undefined>
): Promise<string | null> {
  if (!getAuthToken) return null;
  try {
    const token = await getAuthToken();
    if (token && token.trim()) {
      return `Bearer ${token.trim()}`;
    }
  } catch {
    return null;
  }
  return null;
}

async function pollJobUntilSettled(params: {
  jobId: string;
  jobToken: string | null;
  clientRequestId: string;
  targetCategory?: string;
  requestedCount?: number;
  deduplicated?: boolean;
  mode: "job" | "recovered_job";
  jobsEndpoint: string;
  pollIntervalMs: number;
  perRequestTimeoutMs: number;
  maxConsecutivePollFailures: number;
  signal: AbortSignal;
  getAuthToken?: () => Promise<string | null | undefined>;
  initialAuthHeader: string | null;
  onProgress?: (progress: GenerationJobProgressSnapshot, meta?: { reconnecting?: boolean; attempt?: number }) => void;
  fetchImpl: typeof fetch;
  sleepImpl: (ms: number, signal?: AbortSignal) => Promise<void>;
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
  cancelOnAbort: boolean;
  immediateFirstPoll?: boolean;
}): Promise<ResilientBatchGenerationResult> {
  let consecutivePollFailures = 0;
  let pollCount = 0;
  let cancelSent = false;
  let authHeader = params.initialAuthHeader;
  let lastProgress: GenerationJobProgressSnapshot = {
    stage: "generating",
    completedCount: 0,
    requestedCount: params.requestedCount || 1,
    currentChunk: 0,
    totalChunks: 1,
  };

  const onOuterAbort = () => {
    if (params.cancelOnAbort && !cancelSent) {
      cancelSent = true;
      clearPersistedActiveJob(params.jobId, params.storage);
      sendBestEffortCancel(params.fetchImpl, params.jobsEndpoint, params.jobId, params.jobToken, authHeader);
    }
  };
  params.signal.addEventListener("abort", onOuterAbort, { once: true });

  try {
    while (true) {
      if (params.signal.aborted) {
        onOuterAbort();
        throw createAbortError();
      }

      if (pollCount > 0 || !params.immediateFirstPoll) {
        const waitMs = pollCount === 0
          ? Math.min(600, params.pollIntervalMs)
          : pollCount > 25
            ? Math.min(2000, Math.round(params.pollIntervalMs * 1.35))
            : params.pollIntervalMs;
        await params.sleepImpl(waitMs, params.signal);
      }
      pollCount++;

      // Refresh auth header periodically if recovering or after transient error
      if (!authHeader || consecutivePollFailures > 0 || pollCount % 20 === 0) {
        const refreshed = await resolveAuthHeader(params.getAuthToken);
        if (refreshed) authHeader = refreshed;
      }

      const pollHeaders: Record<string, string> = {
        "Cache-Control": "no-cache",
        "X-Client-Request-Id": `${params.clientRequestId}_poll_${pollCount}`,
      };
      if (params.jobToken) {
        pollHeaders["X-Job-Token"] = params.jobToken;
      }
      if (authHeader) {
        pollHeaders["Authorization"] = authHeader;
      }

      try {
        const pollRes = await fetchWithPerRequestTimeout(
          params.fetchImpl,
          `${params.jobsEndpoint}/${encodeURIComponent(params.jobId)}`,
          {
            method: "GET",
            headers: pollHeaders,
            cache: "no-store",
          },
          params.signal,
          params.perRequestTimeoutMs
        );

        if (!pollRes.ok) {
          const { errorText, parsed } = await parseErrorResponse(pollRes);
          if (
            TRANSIENT_HTTP_STATUSES.has(pollRes.status) &&
            consecutivePollFailures < params.maxConsecutivePollFailures &&
            !params.signal.aborted
          ) {
            consecutivePollFailures++;
            params.onProgress?.(lastProgress, { reconnecting: true, attempt: consecutivePollFailures });
            await params.sleepImpl(
              Math.min(4500, 700 * consecutivePollFailures),
              params.signal
            );
            continue;
          }
          clearPersistedActiveJob(params.jobId, params.storage);
          throw createApiError(
            parsed.message || parsed.error || `Server responded with HTTP ${pollRes.status}`,
            {
              status: pollRes.status,
              errorCode: parsed.errorCode || parsed.code,
              retryable: parsed.retryable ?? true,
              failedDrafts: parsed.failedDrafts,
              responseBodyText: errorText,
            }
          );
        }

        const rawPollBody = await pollRes.text();
        let pollData: any;
        try {
          pollData = JSON.parse(rawPollBody);
        } catch (jsonErr: any) {
          if (
            consecutivePollFailures < params.maxConsecutivePollFailures &&
            !params.signal.aborted
          ) {
            consecutivePollFailures++;
            params.onProgress?.(lastProgress, { reconnecting: true, attempt: consecutivePollFailures });
            await params.sleepImpl(
              Math.min(3500, 700 * consecutivePollFailures),
              params.signal
            );
            continue;
          }
          jsonErr.responseBodyText = rawPollBody;
          jsonErr.status = pollRes.status;
          throw jsonErr;
        }

        consecutivePollFailures = 0;

        if (pollData.progress) {
          lastProgress = pollData.progress;
          params.onProgress?.(pollData.progress, { reconnecting: false });
        }

        if (pollData.status === "completed") {
          clearPersistedActiveJob(params.jobId, params.storage);
          const resultPayload = pollData.result ?? pollData;
          return {
            data: resultPayload,
            httpStatus: 200,
            rawResponseBody: JSON.stringify(resultPayload),
            mode: params.mode,
            jobId: params.jobId,
            deduplicated: params.deduplicated,
            targetCategory: params.targetCategory || pollData.category || resultPayload?.category,
            requestedCount: params.requestedCount || pollData.requestedCount || resultPayload?.requestedCount,
          };
        }

        if (pollData.status === "failed") {
          clearPersistedActiveJob(params.jobId, params.storage);
          throw createApiError(
            pollData.message || pollData.error || "Content generation failed.",
            {
              status: pollData.httpStatus || 500,
              errorCode: pollData.errorCode || "INTERNAL_ERROR",
              retryable: pollData.retryable ?? true,
              failedDrafts: pollData.failedDrafts,
              responseBodyText: rawPollBody,
            }
          );
        }

        if (pollData.status === "cancelled") {
          clearPersistedActiveJob(params.jobId, params.storage);
          throw createAbortError("Generation job was cancelled.");
        }
      } catch (pollErr: any) {
        if (params.signal.aborted || pollErr?.name === "AbortError") {
          throw pollErr;
        }
        if (
          isTransientNetworkError(pollErr) &&
          consecutivePollFailures < params.maxConsecutivePollFailures
        ) {
          consecutivePollFailures++;
          params.onProgress?.(lastProgress, { reconnecting: true, attempt: consecutivePollFailures });
          const backoffMs = Math.min(5000, 700 * consecutivePollFailures);
          await params.sleepImpl(backoffMs, params.signal);
          continue;
        }
        throw pollErr;
      }
    }
  } finally {
    params.signal.removeEventListener("abort", onOuterAbort);
  }
}

async function runSyncFallback(
  fetchImpl: typeof fetch,
  sleepImpl: (ms: number, signal?: AbortSignal) => Promise<void>,
  endpoint: string,
  payloadString: string,
  clientRequestId: string,
  authHeader: string | null,
  signal: AbortSignal
): Promise<ResilientBatchGenerationResult> {
  const maxAttempts = 2;
  let lastErr: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (signal.aborted) throw createAbortError();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Client-Request-Id": `${clientRequestId}_sync_attempt_${attempt}`,
    };
    if (authHeader) {
      headers["Authorization"] = authHeader;
    }

    try {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers,
        signal,
        body: payloadString,
      });

      if (!response.ok) {
        const { errorText, parsed } = await parseErrorResponse(response);
        throw createApiError(
          parsed.message || parsed.error || `Server responded with HTTP ${response.status}`,
          {
            status: response.status,
            errorCode: parsed.errorCode,
            retryable: parsed.retryable,
            failedDrafts: parsed.failedDrafts,
            responseBodyText: errorText,
          }
        );
      }

      const rawResponseBody = await response.text();
      let data: any;
      try {
        data = JSON.parse(rawResponseBody);
      } catch (jsonErr: any) {
        jsonErr.responseBodyText = rawResponseBody;
        jsonErr.status = response.status;
        throw jsonErr;
      }

      return {
        data,
        httpStatus: response.status,
        rawResponseBody,
        mode: "sync_fallback",
      };
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts && !signal.aborted && isTransientNetworkError(err)) {
        await sleepImpl(600 * attempt, signal);
        continue;
      }
      throw err;
    }
  }

  throw lastErr;
}

/**
 * Starts a persistent, idempotent batch generation job (`POST /api/generate-posts-jobs`)
 * and polls short-lived status requests (`GET /api/generate-posts-jobs/:jobId`) with
 * automatic reconnection and browser-refresh persistence.
 */
export async function runResilientBatchGeneration(
  options: ResilientBatchGenerationOptions
): Promise<ResilientBatchGenerationResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleepImpl = options.sleepImpl ?? abortableSleep;
  const jobsEndpoint = options.jobsEndpoint ?? "/api/generate-posts-jobs";
  const syncFallbackEndpoint = options.syncFallbackEndpoint ?? "/api/generate-posts-batch";
  const basePollIntervalMs = options.pollIntervalMs ?? 1000;
  const perRequestTimeoutMs = options.perRequestTimeoutMs ?? 20000;
  const maxStartAttempts = options.maxStartAttempts ?? 3;
  const maxConsecutivePollFailures = options.maxConsecutivePollFailures ?? 12;
  const idempotencyKey = options.idempotencyKey || createIdempotencyKey();

  const authHeader = await resolveAuthHeader(options.getAuthToken);

  // Stage 1: Start background generation job with idempotency key so retries never double-run or double-charge
  let startData: any = null;
  let startAttempt = 0;

  while (startAttempt < maxStartAttempts) {
    startAttempt++;
    if (options.signal.aborted) {
      throw createAbortError();
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Client-Request-Id": `${options.clientRequestId}_start_${startAttempt}`,
      "X-Idempotency-Key": idempotencyKey,
    };
    if (authHeader) {
      headers["Authorization"] = authHeader;
    }

    try {
      const startRes = await fetchWithPerRequestTimeout(
        fetchImpl,
        jobsEndpoint,
        {
          method: "POST",
          headers,
          body: options.payloadString,
        },
        options.signal,
        perRequestTimeoutMs
      );

      if (startRes.status === 404) {
        return runSyncFallback(
          fetchImpl,
          sleepImpl,
          syncFallbackEndpoint,
          options.payloadString,
          options.clientRequestId,
          authHeader,
          options.signal
        );
      }

      if (!startRes.ok) {
        const { errorText, parsed } = await parseErrorResponse(startRes);
        if (
          TRANSIENT_HTTP_STATUSES.has(startRes.status) &&
          startAttempt < maxStartAttempts &&
          !options.signal.aborted
        ) {
          await sleepImpl(450 * startAttempt * startAttempt, options.signal);
          continue;
        }
        throw createApiError(
          parsed.message || parsed.error || `Server responded with HTTP ${startRes.status}`,
          {
            status: startRes.status,
            errorCode: parsed.errorCode || parsed.code,
            retryable: parsed.retryable,
            failedDrafts: parsed.failedDrafts,
            responseBodyText: errorText,
          }
        );
      }

      const startRaw = await startRes.text();
      try {
        startData = JSON.parse(startRaw);
      } catch (jsonErr: any) {
        jsonErr.responseBodyText = startRaw;
        jsonErr.status = startRes.status;
        throw jsonErr;
      }

      // If deduplicated job was already completed, return immediately
      if (startData?.status === "completed" && startData?.result) {
        clearPersistedActiveJob(startData.jobId, options.storage);
        return {
          data: startData.result,
          httpStatus: 200,
          rawResponseBody: JSON.stringify(startData.result),
          mode: "job",
          jobId: startData.jobId,
          deduplicated: Boolean(startData.deduplicated),
          targetCategory: options.targetCategory || startData.category,
          requestedCount: options.requestedCount || startData.requestedCount,
        };
      }

      if (Array.isArray(startData?.posts) && startData.posts.length > 0) {
        return {
          data: startData,
          httpStatus: startRes.status,
          rawResponseBody: startRaw,
          mode: "job",
          jobId: startData.jobId,
        };
      }

      if (!startData?.jobId || (!startData?.jobToken && !authHeader)) {
        throw createApiError("Invalid job start response from server.", {
          status: startRes.status,
          errorCode: "SCHEMA_ERROR",
          responseBodyText: startRaw,
        });
      }

      break;
    } catch (err) {
      if (
        startAttempt < maxStartAttempts &&
        !options.signal.aborted &&
        isTransientNetworkError(err)
      ) {
        await sleepImpl(500 * startAttempt * startAttempt, options.signal);
        continue;
      }
      throw err;
    }
  }

  const persistedJob: PersistedActiveGenerationJob = {
    jobId: startData.jobId,
    jobToken: startData.jobToken || "",
    clientRequestId: options.clientRequestId,
    idempotencyKey,
    userId: options.userId || "anonymous",
    targetCategory: options.targetCategory || startData.category || "auto",
    requestedCount: options.requestedCount || startData.requestedCount || 4,
    startedAt: Date.now(),
  };

  savePersistedActiveJob(persistedJob, options.storage);
  options.onJobStarted?.(persistedJob);

  if (startData.progress && options.onProgress) {
    options.onProgress(startData.progress, { reconnecting: false });
  }

  const pollIntervalMs =
    typeof startData.pollIntervalMs === "number" && startData.pollIntervalMs >= 250
      ? startData.pollIntervalMs
      : basePollIntervalMs;

  return pollJobUntilSettled({
    jobId: persistedJob.jobId,
    jobToken: persistedJob.jobToken || null,
    clientRequestId: options.clientRequestId,
    targetCategory: persistedJob.targetCategory,
    requestedCount: persistedJob.requestedCount,
    deduplicated: Boolean(startData.deduplicated),
    mode: "job",
    jobsEndpoint,
    pollIntervalMs,
    perRequestTimeoutMs,
    maxConsecutivePollFailures,
    signal: options.signal,
    getAuthToken: options.getAuthToken,
    initialAuthHeader: authHeader,
    onProgress: options.onProgress,
    fetchImpl,
    sleepImpl,
    storage: options.storage,
    cancelOnAbort: true,
    immediateFirstPoll: false,
  });
}

/**
 * Recovers an in-progress or recently completed generation job after a page refresh,
 * tab reload, or full browser disconnect without creating duplicate AI calls.
 */
export async function resumePersistedGenerationJob(
  options: ResumeGenerationJobOptions
): Promise<ResilientBatchGenerationResult | null> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleepImpl = options.sleepImpl ?? abortableSleep;
  const jobsEndpoint = options.jobsEndpoint ?? "/api/generate-posts-jobs";
  const pollIntervalMs = options.pollIntervalMs ?? 1000;
  const perRequestTimeoutMs = options.perRequestTimeoutMs ?? 20000;
  const maxConsecutivePollFailures = options.maxConsecutivePollFailures ?? 12;

  const authHeader = await resolveAuthHeader(options.getAuthToken);
  const persisted = loadPersistedActiveJob(options.userId, options.storage);

  if (persisted) {
    return pollJobUntilSettled({
      jobId: persisted.jobId,
      jobToken: persisted.jobToken || null,
      clientRequestId: persisted.clientRequestId || `recover_${Date.now()}`,
      targetCategory: persisted.targetCategory,
      requestedCount: persisted.requestedCount,
      deduplicated: true,
      mode: "recovered_job",
      jobsEndpoint,
      pollIntervalMs,
      perRequestTimeoutMs,
      maxConsecutivePollFailures,
      signal: options.signal,
      getAuthToken: options.getAuthToken,
      initialAuthHeader: authHeader,
      onProgress: options.onProgress,
      fetchImpl,
      sleepImpl,
      storage: options.storage,
      cancelOnAbort: false,
      immediateFirstPoll: true,
    });
  }

  // Fallback for authenticated users when localStorage was cleared: check server latest active job
  if (!authHeader) return null;

  try {
    const latestRes = await fetchWithPerRequestTimeout(
      fetchImpl,
      `${jobsEndpoint}/latest`,
      {
        method: "GET",
        headers: {
          "Cache-Control": "no-cache",
          Authorization: authHeader,
        },
        cache: "no-store",
      },
      options.signal,
      perRequestTimeoutMs
    );
    if (!latestRes.ok) return null;
    const latestData = await latestRes.json().catch(() => null);
    if (!latestData?.job || latestData.job.status !== "running") {
      return null;
    }

    return pollJobUntilSettled({
      jobId: latestData.job.jobId,
      jobToken: null,
      clientRequestId: `recover_srv_${Date.now()}`,
      targetCategory: latestData.job.category,
      requestedCount: latestData.job.requestedCount,
      deduplicated: true,
      mode: "recovered_job",
      jobsEndpoint,
      pollIntervalMs,
      perRequestTimeoutMs,
      maxConsecutivePollFailures,
      signal: options.signal,
      getAuthToken: options.getAuthToken,
      initialAuthHeader: authHeader,
      onProgress: options.onProgress,
      fetchImpl,
      sleepImpl,
      storage: options.storage,
      cancelOnAbort: false,
      immediateFirstPoll: true,
    });
  } catch {
    return null;
  }
}
