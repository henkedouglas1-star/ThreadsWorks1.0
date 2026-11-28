import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { 
  compressPrompt, 
  applyTokenLimits, 
  routeModel, 
  AI_QUOTA_CONFIG, 
  isQuotaCircuitActive, 
  tripQuotaCircuitBreaker,
  classifyGeminiError,
  generateCacheKey,
  isTaskCachable,
  getCachedResult,
  setCachedResult,
  getInFlightRequest,
  setInFlightRequest,
  removeInFlightRequest,
  recordOperationTelemetry,
  TaskComplexity
} from "./aiCostOptimizationEngine";

let aiClient: GoogleGenAI | null = null;

// Simple semaphore for global concurrency control (Phase 14)
let activeGeminiRequests = 0;

/**
 * Shared, canonical Gemini API client singleton for ThreadsWorks.
 * Preserves GEMINI_API_KEY single credential source of truth.
 */
export function getAI(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key || !key.trim()) {
      throw new Error(
        "GEMINI_API_KEY environment variable is missing. Automatic credential creation is disabled."
      );
    }
    aiClient = new GoogleGenAI({
      apiKey: key.trim(),
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

export interface GeminiCallParams {
  model?: string;
  optimizationTaskId?: string;
  optimizationComplexity?: TaskComplexity;
  strictContentGeneration?: boolean;
  contents?: any;
  config?: any;
  [key: string]: any;
}

/**
 * Resilient, quota-aware wrapper for all ThreadsWorks Gemini API calls.
 * Fulfills Phases 2, 3, 4, 5, 8, 9, 10, 14, 15, 16, 17, 18.
 */
export async function callGenerateContentWithRetry(
  aiClientInstance: any, 
  params: GeminiCallParams, 
  maxRetries = 1
): Promise<any> {
  const { strictContentGeneration = false, ...providerParams } = params;
  params = providerParams;
  const taskId = params.optimizationTaskId || "DEFAULT";
  const complexity = params.optimizationComplexity || "LEVEL_2_STANDARD";

  // 1. Context Optimization & Prompt Compression (Phase 4 & 9)
  let promptTextForHash = "";
  if (strictContentGeneration) {
    promptTextForHash = JSON.stringify({ contents: params.contents, config: params.config });
  } else if (params.contents) {
    if (typeof params.contents === "string") {
      params.contents = compressPrompt(taskId, params.contents);
      promptTextForHash = params.contents;
    } else if (Array.isArray(params.contents)) {
      params.contents = params.contents.map(item => {
        if (typeof item === "string") {
          const comp = compressPrompt(taskId, item);
          promptTextForHash += comp;
          return { role: "user", parts: [{ text: comp }] };
        }
        if (item && item.parts && Array.isArray(item.parts)) {
          item.parts = item.parts.map((p: any) => {
            if (p.text) {
              p.text = compressPrompt(taskId, p.text);
              promptTextForHash += p.text;
            }
            return p;
          });
        }
        return item;
      });
    }
  }

  // 2. In-Memory Caching for Deterministic Intermediate Results (Phase 8)
  const cacheKey = generateCacheKey(taskId, promptTextForHash);
  if (isTaskCachable(taskId)) {
    const cached = getCachedResult(cacheKey);
    if (cached) {
      return cached;
    }
  }

  // 3. In-Flight Request Deduplication (Phase 8: Prevents double-clicks / component remount bursts)
  const inFlight = getInFlightRequest(cacheKey);
  if (inFlight) {
    return await inFlight;
  }

  const executionPromise = (async () => {
    // 4. Concurrency Control (Phase 14) with low-overhead queue wakeup + measurement
    const queueStartTime = Date.now();
    while (activeGeminiRequests >= AI_QUOTA_CONFIG.MAX_CONCURRENCY) {
      await new Promise(resolve => setTimeout(resolve, 35 + Math.random() * 25));
    }
    const queueDurationMs = Date.now() - queueStartTime;
    activeGeminiRequests++;

    let sawRateLimit = false;

    try {
      // 5. Circuit Breaker Check (Phase 4 & 7)
      if (isQuotaCircuitActive()) {
        if (strictContentGeneration) throw new Error("AI generation is temporarily unavailable. Please try again later.");
        return {
          text: JSON.stringify({
            title: "Simulated Content Strategy",
            hook: "A practical approach to building consistent audience momentum.",
            parts: [
              "A practical approach to building consistent audience momentum.",
              "When you streamline your core workflow, publishing high-value insights becomes much easier.",
              "Focus on clear mechanisms and practical value that your audience can apply immediately."
            ],
            cta: "Explore the workflow engine",
            explanation: "Generated via offline simulation due to API quota limits."
          }),
          isSimulated: true
        };
      }

      // 6. Token Output Control (Phase 15)
      if (!params.config) params.config = {};
      if (!strictContentGeneration) applyTokenLimits(taskId, params.config);

      // 7. Centralized Model Routing (Phase 2 & 3)
      const route = routeModel(complexity, params.model);
      const modelsToTry = [route.primaryModel, route.fallbackModel];

      let lastError: any = null;
      let attemptsCount = 0;
      const MAX_TOTAL_BUDGET = AI_QUOTA_CONFIG.MAX_TOTAL_RETRY_BUDGET; // Strict 2 attempts max

      for (let mIdx = 0; mIdx < modelsToTry.length; mIdx++) {
        const currentModel = modelsToTry[mIdx];
        const isFallback = mIdx > 0;
        attemptsCount++;

        if (attemptsCount > MAX_TOTAL_BUDGET) {
          break;
        }

        const callStartTime = Date.now();
        try {
          const supportsThinkingLevel = /^gemini-(?:3|4)/i.test(currentModel);
          const effectiveConfig =
            supportsThinkingLevel &&
            complexity !== "LEVEL_3_ADVANCED" &&
            !params.config?.thinkingConfig
              ? {
                  ...params.config,
                  thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
                }
              : params.config;
          const currentParams = { ...params, model: currentModel, config: effectiveConfig };
          const response = await aiClientInstance.models.generateContent(currentParams);

          const latencyMs = Date.now() - callStartTime;
          const usage = response?.usageMetadata || {};
          const inTokens = usage.promptTokenCount || 0;
          const outTokens = usage.candidatesTokenCount || 0;
          const thoughtsTok = usage.thoughtsTokenCount || 0;
          const cachedTok = usage.cachedContentTokenCount || 0;

          // Record telemetry
          recordOperationTelemetry(
            taskId,
            currentModel,
            false,
            isFallback,
            inTokens,
            outTokens,
            cachedTok,
            latencyMs
          );

          if (response && typeof response === "object") {
            try {
              Object.defineProperty(response, "_telemetry", {
                value: {
                  modelUsed: currentModel,
                  fallbackUsed: isFallback,
                  queueDurationMs,
                  providerDurationMs: latencyMs,
                  rateLimited: sawRateLimit,
                  inputTokens: inTokens,
                  outputTokens: outTokens,
                  thoughtsTokens: thoughtsTok,
                  cachedTokens: cachedTok
                },
                enumerable: false,
                configurable: true
              });
            } catch {
              // Ignore non-extensible mock responses
            }
          }

          // Cache deterministic result
          if (isTaskCachable(taskId)) {
            setCachedResult(cacheKey, response);
          }

          return response;
        } catch (err: any) {
          lastError = err;
          const classification = classifyGeminiError(err);
          const isTransientRateLimit =
            classification.type === "RATE_LIMIT" ||
            classification.type === "TOKEN_RATE_LIMIT";
          if (isTransientRateLimit) {
            sawRateLimit = true;
          }

          // Trip global circuit breaker ONLY on non-retryable daily quota, billing (402), or auth failures.
          // Transient RPM/TPM 429s must back off and fail over cleanly without killing concurrent healthy workers.
          const isHardTerminalFailure =
            !classification.retryable ||
            classification.type === "DAILY_QUOTA" ||
            classification.type === "AUTH_CONFIGURATION" ||
            err?.message?.includes("402");

          if (isHardTerminalFailure) {
            console.warn(`[GEMINI_CLIENT] Hard quota or non-retryable error (${classification.type}) on ${currentModel}.`);
            if (classification.type === "DAILY_QUOTA" || classification.type === "AUTH_CONFIGURATION" || err?.message?.includes("402")) {
              tripQuotaCircuitBreaker(classification.message, AI_QUOTA_CONFIG.CIRCUIT_BREAKER_DURATION_MS);
            }
            if (strictContentGeneration) throw err;
            return {
              text: JSON.stringify({
                title: "Simulated Content Strategy",
                hook: "A practical approach to building consistent audience momentum.",
                parts: [
                  "A practical approach to building consistent audience momentum.",
                  "When you streamline your core workflow, publishing high-value insights becomes much easier.",
                  "Focus on clear mechanisms and practical value that your audience can apply immediately."
                ],
                cta: "Explore the workflow engine",
                explanation: "Generated via offline simulation due to API quota limits."
              }),
              isSimulated: true
            };
          }

          // Transient failure (RPM/TPM 429, 503, 5xx, network): bounded jittered backoff before fallback model
          if (mIdx < modelsToTry.length - 1 && attemptsCount < MAX_TOTAL_BUDGET) {
            const baseDelay = isTransientRateLimit ? 450 : 350;
            const delay = Math.min(baseDelay * (mIdx + 1), AI_QUOTA_CONFIG.MAX_RETRY_DELAY_MS) + (Math.random() * 200);
            console.warn(`[GEMINI_CLIENT] Transient failure (${classification.type}) on ${currentModel}. Failing over to ${modelsToTry[mIdx + 1]} in ${Math.round(delay)}ms...`);
            await new Promise(r => setTimeout(r, delay));
            continue;
          }
        }
      }

      throw lastError || new Error(`Gemini request failed for ${taskId} after bounded fallback.`);
    } finally {
      activeGeminiRequests--;
      removeInFlightRequest(cacheKey);
    }
  })();

  setInFlightRequest(cacheKey, executionPromise);
  return await executionPromise;
}
