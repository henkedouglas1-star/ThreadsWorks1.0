import crypto from "crypto";

// =========================================================================
// THREADSWORKS AI COST & QUOTA OPTIMIZATION ENGINE
// Source of Truth for Context Minimization, Prompt Compression, Smart Routing, 
// Request Deduplication, Bounded Fallback, and Safe Telemetry.
// =========================================================================

// --- Canonical Available Gemini Models for ThreadsWorks ---
export const THREADSWORKS_MODELS = {
  FLASH_38: "gemini-3.8-flash",           // High-quality escalation (explicit workflows only)
  FLASH_37: "gemini-3.7-flash",           // Quality fallback for transient/model failures
  FLASH_36: "gemini-3.8-flash",           // Primary standard content generation workhorse
  FLASH_LITE_35: "gemini-3.5-flash-lite", // Lightweight tasks (metadata, extraction, summaries)
  FLASH_35: "gemini-3.5-flash",           // Standard flash alternate
  FLASH_LITE_31: "gemini-3.1-flash-lite", // Very light background tasks
  FLASH_PREVIEW_31: "gemini-3.1-flash-preview", // Preview testing only
  FLASH_LATEST: "gemini-flash-latest",     // Explicit admin override alias
  GEMINI_LATEST: "gemini-latest"          // Explicit admin override alias
} as const;

export type TaskComplexity = "LEVEL_0_NO_AI" | "LEVEL_1_LIGHT" | "LEVEL_2_STANDARD" | "LEVEL_3_ADVANCED";

export interface OptimizationConfig {
  taskCategory: string;
  expectedOutputTokens: number;
  complexity: TaskComplexity;
  cachable: boolean;
  requiredContexts: string[]; // List of section headers to KEEP
}

// Maps specific tasks to their optimal configuration
const TASK_CONFIG_MAP: Record<string, OptimizationConfig> = {
  "GENERATE_HOOKS": {
    taskCategory: "HOOK_GENERATION",
    expectedOutputTokens: 1000,
    complexity: "LEVEL_2_STANDARD",
    cachable: false,
    requiredContexts: ["CREATOR UNIFIED VOICE", "BUYER & CONVERSION INTELLIGENCE"]
  },
  "GENERATE_ANGLES": {
    taskCategory: "ANGLE_GENERATION",
    expectedOutputTokens: 2500,
    complexity: "LEVEL_2_STANDARD",
    cachable: false,
    requiredContexts: ["CREATOR UNIFIED VOICE", "CREATOR OFFER INTELLIGENCE"]
  },
  "GENERATE_ANGLE_HOOK": {
    taskCategory: "ANGLE_GENERATION",
    expectedOutputTokens: 1200,
    complexity: "LEVEL_2_STANDARD",
    cachable: false,
    requiredContexts: ["CREATOR UNIFIED VOICE"]
  },
  "DYNAMIC_HOOK": {
    taskCategory: "HOOK_GENERATION",
    expectedOutputTokens: 400,
    complexity: "LEVEL_2_STANDARD",
    cachable: false,
    requiredContexts: ["CREATOR UNIFIED VOICE"]
  },
  "DYNAMIC_ANGLE": {
    taskCategory: "ANGLE_GENERATION",
    expectedOutputTokens: 500,
    complexity: "LEVEL_2_STANDARD",
    cachable: false,
    requiredContexts: ["CREATOR UNIFIED VOICE"]
  },
  "GENERATE_CTAS": {
    taskCategory: "CTA_GENERATION",
    expectedOutputTokens: 400,
    complexity: "LEVEL_1_LIGHT",
    cachable: true,
    requiredContexts: ["CREATOR UNIFIED VOICE", "CTA PREFERENCES"]
  },
  "REGENERATE_POST": {
    taskCategory: "CONTENT_IMPROVEMENT",
    expectedOutputTokens: 5500,
    complexity: "LEVEL_2_STANDARD",
    cachable: false,
    requiredContexts: ["CREATOR UNIFIED VOICE", "UNIVERSAL GENERATION PIPELINE"]
  },
  "REPAIR_POST": {
    taskCategory: "CONTENT_REPAIR",
    expectedOutputTokens: 5500,
    complexity: "LEVEL_2_STANDARD",
    cachable: false,
    requiredContexts: ["CREATOR UNIFIED VOICE"]
  },
  "REVIEW_CONTENT_BATCH": {
    taskCategory: "CONTENT_REVIEW",
    expectedOutputTokens: 1600,
    complexity: "LEVEL_1_LIGHT",
    cachable: false,
    requiredContexts: []
  },
  "OPTIMIZE_POST": {
    taskCategory: "CONTENT_IMPROVEMENT",
    expectedOutputTokens: 3200,
    complexity: "LEVEL_2_STANDARD",
    cachable: false,
    requiredContexts: ["CREATOR UNIFIED VOICE"]
  },
  "GENERATE_THREADS": {
    taskCategory: "POST_GENERATION",
    expectedOutputTokens: 5500,
    complexity: "LEVEL_2_STANDARD",
    cachable: false,
    requiredContexts: ["CREATOR UNIFIED VOICE", "CREATOR OFFER INTELLIGENCE"]
  },
  "NEXT_PART": {
    taskCategory: "POST_GENERATION",
    expectedOutputTokens: 800,
    complexity: "LEVEL_2_STANDARD",
    cachable: false,
    requiredContexts: ["CREATOR UNIFIED VOICE"]
  },
  "REVISE_PART_LENGTH": {
    taskCategory: "CONTENT_TRANSFORM",
    expectedOutputTokens: 600,
    complexity: "LEVEL_1_LIGHT",
    cachable: false,
    requiredContexts: ["CREATOR UNIFIED VOICE"]
  },
  "TRANSFORM_HOOK": {
    taskCategory: "CONTENT_TRANSFORM",
    expectedOutputTokens: 600,
    complexity: "LEVEL_2_STANDARD",
    cachable: false,
    requiredContexts: ["CREATOR UNIFIED VOICE"]
  },
  "TRANSFORM_HOOK_ADD": {
    taskCategory: "CONTENT_TRANSFORM",
    expectedOutputTokens: 600,
    complexity: "LEVEL_2_STANDARD",
    cachable: false,
    requiredContexts: ["CREATOR UNIFIED VOICE"]
  },
  "TRANSFORM_HOOK_REMOVE": {
    taskCategory: "CONTENT_TRANSFORM",
    expectedOutputTokens: 600,
    complexity: "LEVEL_2_STANDARD",
    cachable: false,
    requiredContexts: ["CREATOR UNIFIED VOICE"]
  },
  "TRANSFORM_HOOK_REMOVE_THREAD": {
    taskCategory: "CONTENT_TRANSFORM",
    expectedOutputTokens: 600,
    complexity: "LEVEL_2_STANDARD",
    cachable: false,
    requiredContexts: ["CREATOR UNIFIED VOICE"]
  },
  "TRANSFORM_CTA": {
    taskCategory: "CONTENT_TRANSFORM",
    expectedOutputTokens: 600,
    complexity: "LEVEL_2_STANDARD",
    cachable: false,
    requiredContexts: ["CTA PREFERENCES"]
  },
  "TRANSFORM_CTA_ADD": {
    taskCategory: "CONTENT_TRANSFORM",
    expectedOutputTokens: 600,
    complexity: "LEVEL_2_STANDARD",
    cachable: false,
    requiredContexts: ["CTA PREFERENCES"]
  },
  "TRANSFORM_CTA_REMOVE": {
    taskCategory: "CONTENT_TRANSFORM",
    expectedOutputTokens: 600,
    complexity: "LEVEL_2_STANDARD",
    cachable: false,
    requiredContexts: ["CTA PREFERENCES"]
  },
  "GENERATE_POSTS_BATCH_PLAN": {
    taskCategory: "POST_PLANNING",
    expectedOutputTokens: 1200,
    complexity: "LEVEL_2_STANDARD",
    cachable: false,
    requiredContexts: ["CREATOR UNIFIED VOICE", "CREATOR OFFER INTELLIGENCE", "BUYER & CONVERSION INTELLIGENCE", "STRATEGIC PHASE"]
  },
  "GENERATE_POSTS_BATCH_WRITE": {
    taskCategory: "POST_GENERATION",
    expectedOutputTokens: 10000,
    complexity: "LEVEL_2_STANDARD",
    cachable: false,
    requiredContexts: ["CREATOR UNIFIED VOICE", "CREATOR OFFER INTELLIGENCE", "UNIVERSAL GENERATION PIPELINE"]
  },
  "GENERATE_POSTS_BATCH": {
    taskCategory: "POST_GENERATION",
    expectedOutputTokens: 10000,
    complexity: "LEVEL_2_STANDARD",
    cachable: false,
    requiredContexts: ["CREATOR UNIFIED VOICE", "CREATOR OFFER INTELLIGENCE", "UNIVERSAL GENERATION PIPELINE"]
  },
  "CREATE_BEST_POST": {
    taskCategory: "POST_GENERATION",
    expectedOutputTokens: 5500,
    complexity: "LEVEL_2_STANDARD",
    cachable: false,
    requiredContexts: ["CREATOR UNIFIED VOICE", "CREATOR OFFER INTELLIGENCE", "BUYER & CONVERSION INTELLIGENCE"]
  },
  "CONTENT_DECISIONS": {
    taskCategory: "STRATEGY_DECISIONS",
    expectedOutputTokens: 2500,
    complexity: "LEVEL_2_STANDARD",
    cachable: true,
    requiredContexts: ["CREATOR UNIFIED VOICE", "CREATOR OFFER INTELLIGENCE", "BUYER & CONVERSION INTELLIGENCE", "STRATEGIC PHASE"]
  },
  "GENERATE_PILLARS": {
    taskCategory: "CONTENT_PILLARS",
    expectedOutputTokens: 2500,
    complexity: "LEVEL_2_STANDARD",
    cachable: true,
    requiredContexts: ["CREATOR UNIFIED VOICE", "CREATOR OFFER INTELLIGENCE", "BUYER & CONVERSION INTELLIGENCE"]
  },
  "GENERATE_SINGLE_PILLAR": {
    taskCategory: "CONTENT_PILLARS",
    expectedOutputTokens: 1500,
    complexity: "LEVEL_2_STANDARD",
    cachable: true,
    requiredContexts: ["CREATOR UNIFIED VOICE", "CREATOR OFFER INTELLIGENCE"]
  },
  "STRATEGY_DIAGNOSIS": {
    taskCategory: "STRATEGY_ANALYSIS",
    expectedOutputTokens: 2000,
    complexity: "LEVEL_3_ADVANCED",
    cachable: true,
    requiredContexts: ["CREATOR UNIFIED VOICE", "BUYER & CONVERSION INTELLIGENCE", "CREATOR OFFER INTELLIGENCE"]
  },
  "EXTRACT_IDENTITY": {
    taskCategory: "METADATA_EXTRACTION",
    expectedOutputTokens: 1000,
    complexity: "LEVEL_1_LIGHT",
    cachable: true,
    requiredContexts: []
  },
  "EXTRACT_OFFER": {
    taskCategory: "METADATA_EXTRACTION",
    expectedOutputTokens: 1000,
    complexity: "LEVEL_1_LIGHT",
    cachable: true,
    requiredContexts: []
  },
  "EXTRACT_BUYER": {
    taskCategory: "METADATA_EXTRACTION",
    expectedOutputTokens: 1000,
    complexity: "LEVEL_1_LIGHT",
    cachable: true,
    requiredContexts: []
  },
  "INFLUENCER_TAG_ENRICH": {
    taskCategory: "METADATA_EXTRACTION",
    expectedOutputTokens: 400,
    complexity: "LEVEL_1_LIGHT",
    cachable: true,
    requiredContexts: []
  },
  "INFLUENCER_INITIAL_DM": {
    taskCategory: "OUTREACH_GENERATION",
    expectedOutputTokens: 500,
    complexity: "LEVEL_1_LIGHT",
    cachable: false,
    requiredContexts: []
  },
  "INFLUENCER_FOLLOWUP_DM": {
    taskCategory: "OUTREACH_GENERATION",
    expectedOutputTokens: 400,
    complexity: "LEVEL_1_LIGHT",
    cachable: false,
    requiredContexts: []
  },
  "PRODUCT_UPDATE_ANALYSIS": {
    taskCategory: "METADATA_EXTRACTION",
    expectedOutputTokens: 800,
    complexity: "LEVEL_1_LIGHT",
    cachable: true,
    requiredContexts: []
  },
  "PARTNER_PROMO_GENERATE": {
    taskCategory: "CONTENT_GENERATION",
    expectedOutputTokens: 1200,
    complexity: "LEVEL_2_STANDARD",
    cachable: false,
    requiredContexts: []
  }
};

const DEFAULT_CONFIG: OptimizationConfig = {
  taskCategory: "DEFAULT",
  expectedOutputTokens: 3000,
  complexity: "LEVEL_2_STANDARD",
  cachable: false,
  requiredContexts: ["CREATOR UNIFIED VOICE", "CREATOR OFFER INTELLIGENCE", "BUYER & CONVERSION INTELLIGENCE", "STRATEGIC PHASE", "UNIVERSAL GENERATION PIPELINE"]
};

// --- In-Memory Caching & Deduplication ---
const requestCache = new Map<string, { result: any, timestamp: number }>();
const CACHE_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours TTL for deterministic intermediate intelligence
const activeRequests = new Map<string, Promise<any>>();

export function isTaskCachable(taskId: string): boolean {
  const cfg = TASK_CONFIG_MAP[taskId] || DEFAULT_CONFIG;
  return cfg.cachable;
}

export function getCachedResult(cacheKey: string): any | null {
  const item = requestCache.get(cacheKey);
  if (!item) return null;
  if (Date.now() - item.timestamp > CACHE_TTL_MS) {
    requestCache.delete(cacheKey);
    return null;
  }
  aiTelemetry.cacheHits++;
  return item.result;
}

export function setCachedResult(cacheKey: string, result: any): void {
  requestCache.set(cacheKey, { result, timestamp: Date.now() });
}

export function getInFlightRequest(cacheKey: string): Promise<any> | undefined {
  const active = activeRequests.get(cacheKey);
  if (active) {
    aiTelemetry.deduplications++;
  }
  return active;
}

export function setInFlightRequest(cacheKey: string, promise: Promise<any>): void {
  activeRequests.set(cacheKey, promise);
}

export function removeInFlightRequest(cacheKey: string): void {
  activeRequests.delete(cacheKey);
}

// --- Lightweight Telemetry & Quota Accounting ---
export const aiTelemetry = {
  totalRequests: 0,
  originalRequests: 0,
  retryRequests: 0,
  fallbackRequests: 0,
  repairRequests: 0,
  cacheHits: 0,
  deduplications: 0,
  estimatedTokensSaved: 0,
  totalTokensConsumed: 0,
  inputTokens: 0,
  outputTokens: 0,
  cachedTokens: 0,
  circuitBreakerTrips: 0,
  lastQuotaError: "",
  circuitBreakerUntil: 0,
  operations: new Map<string, {
    calls: number;
    retries: number;
    fallbacks: number;
    inputTokens: number;
    outputTokens: number;
    cachedTokens: number;
    lastLatencyMs: number;
  }>()
};

export function recordOperationTelemetry(
  taskId: string,
  model: string,
  isRetry: boolean,
  isFallback: boolean,
  inputTokens: number,
  outputTokens: number,
  cachedTokens: number,
  latencyMs: number
) {
  aiTelemetry.totalRequests++;
  if (isRetry) aiTelemetry.retryRequests++;
  else if (isFallback) aiTelemetry.fallbackRequests++;
  else aiTelemetry.originalRequests++;

  aiTelemetry.inputTokens += inputTokens;
  aiTelemetry.outputTokens += outputTokens;
  aiTelemetry.cachedTokens += cachedTokens;
  aiTelemetry.totalTokensConsumed += (inputTokens + outputTokens);

  const existing = aiTelemetry.operations.get(taskId) || {
    calls: 0,
    retries: 0,
    fallbacks: 0,
    inputTokens: 0,
    outputTokens: 0,
    cachedTokens: 0,
    lastLatencyMs: 0
  };
  existing.calls++;
  if (isRetry) existing.retries++;
  if (isFallback) existing.fallbacks++;
  existing.inputTokens += inputTokens;
  existing.outputTokens += outputTokens;
  existing.cachedTokens += cachedTokens;
  existing.lastLatencyMs = latencyMs;
  aiTelemetry.operations.set(taskId, existing);
}

let circuitBreakerUntil = 0;
let lastCircuitBreakerError = "";

export function tripQuotaCircuitBreaker(reason: string, durationMs: number = 30000): void {
  circuitBreakerUntil = Date.now() + durationMs;
  lastCircuitBreakerError = reason;
  aiTelemetry.circuitBreakerTrips++;
  aiTelemetry.circuitBreakerUntil = circuitBreakerUntil;
  aiTelemetry.lastQuotaError = reason;
  console.warn(`[CIRCUIT BREAKER] Tripped for ${durationMs}ms due to quota exhaustion: ${reason}`);
}

export function isQuotaCircuitActive(): boolean {
  return Date.now() < circuitBreakerUntil;
}

// --- Phase 16: Quota Error Classification ---
export type QuotaErrorType = 
  | "RATE_LIMIT"
  | "DAILY_QUOTA"
  | "TOKEN_RATE_LIMIT"
  | "MODEL_UNAVAILABLE"
  | "INVALID_REQUEST"
  | "AUTH_CONFIGURATION"
  | "NETWORK_TRANSIENT"
  | "SERVER_TRANSIENT"
  | "MODEL_NOT_FOUND"
  | "UNKNOWN_ERROR";

export interface ErrorClassification {
  type: QuotaErrorType;
  retryable: boolean;
  message: string;
}

export function classifyGeminiError(err: any): ErrorClassification {
  if (!err) return { type: "UNKNOWN_ERROR", retryable: false, message: "Unknown error." };
  
  let errStr = "";
  try {
    errStr = (String(err) + " " + String(err.message || "") + " " + String(err.status || "") + " " + String(err.code || "")).toLowerCase();
  } catch {
    errStr = String(err).toLowerCase();
  }

  const status = err?.status || err?.code || 0;

  // 1. Non-retryable Invalid Request / Schema / Validation errors (Fail Fast)
  if (status === 400 || errStr.includes("invalid argument") || errStr.includes("schema") || errStr.includes("malformed") || errStr.includes("bad request")) {
    return { type: "INVALID_REQUEST", retryable: false, message: err?.message || "Invalid request schema or parameters." };
  }

  // 2. Auth / Configuration / Missing Keys
  if (status === 401 || status === 403 || errStr.includes("api_key") || errStr.includes("unauthorized") || errStr.includes("permission denied")) {
    return { type: "AUTH_CONFIGURATION", retryable: false, message: err?.message || "Authentication or API key configuration failure." };
  }

  // 3. Model Not Found
  if (status === 404 || errStr.includes("not found") || errStr.includes("model_not_found")) {
    return { type: "MODEL_NOT_FOUND", retryable: false, message: err?.message || "Requested Gemini model identifier not found." };
  }

  // 4. Quota and Rate Limit Distinctions
  if (status === 429 || errStr.includes("resource_exhausted") || errStr.includes("quota")) {
    if (errStr.includes("daily") || errStr.includes("per day") || errStr.includes("credit") || errStr.includes("billing")) {
      return { type: "DAILY_QUOTA", retryable: false, message: err?.message || "Daily quota limit reached." };
    }
    if (errStr.includes("tpm") || errStr.includes("token")) {
      return { type: "TOKEN_RATE_LIMIT", retryable: true, message: err?.message || "Token per minute (TPM) limit reached." };
    }
    return { type: "RATE_LIMIT", retryable: true, message: err?.message || "Request rate limit (RPM) reached." };
  }

  // 5. Model Unavailable / Overloaded
  if (status === 503 || errStr.includes("unavailable") || errStr.includes("overloaded") || errStr.includes("temporarily unavailable")) {
    return { type: "MODEL_UNAVAILABLE", retryable: true, message: err?.message || "Model temporarily unavailable." };
  }

  // 6. Generic 5xx Server Transient
  if (status >= 500 && status < 600) {
    return { type: "SERVER_TRANSIENT", retryable: true, message: err?.message || "Gemini server transient error." };
  }

  // 7. Network Transient
  if (errStr.includes("econnreset") || errStr.includes("etimedout") || errStr.includes("fetch failed") || errStr.includes("network")) {
    return { type: "NETWORK_TRANSIENT", retryable: true, message: err?.message || "Transient network failure." };
  }

  return { type: "UNKNOWN_ERROR", retryable: false, message: err?.message || "Unclassified error." };
}

export function isHardQuotaOrAuthError(err: any): boolean {
  const classification = classifyGeminiError(err);
  return classification.type === "DAILY_QUOTA" || classification.type === "AUTH_CONFIGURATION";
}

export function generateCacheKey(taskId: string, promptText: string): string {
  const hash = crypto.createHash("sha256");
  hash.update(taskId);
  hash.update(promptText);
  return hash.digest("hex");
}

// --- Prompt Compressor & Context Optimizer (Phase 4 & 9) ---
export function compressPrompt(taskId: string, rawPrompt: string): string {
  const config = TASK_CONFIG_MAP[taskId] || DEFAULT_CONFIG;
  
  if (config.taskCategory === "DEFAULT") return rawPrompt;

  let optimizedPrompt = rawPrompt;
  const originalLength = optimizedPrompt.length;

  // Context sections that can be stripped if not required for this task
  const allSections = [
    "CREATOR UNIFIED VOICE & BACKGROUND CONTEXT",
    "CREATOR OFFER INTELLIGENCE",
    "BUYER & CONVERSION INTELLIGENCE",
    "STRATEGIC PHASE",
    "CTA PREFERENCES & SAVED DESTINATIONS",
    "UNIVERSAL GENERATION PIPELINE & HARD CONSTRAINTS"
  ];

  for (const section of allSections) {
    const isRequired = config.requiredContexts.some(req => section.includes(req));
    if (!isRequired) {
      const regex = new RegExp(`={40,}\\s*### ${section}[\\s\\S]*?={40,}`, "g");
      optimizedPrompt = optimizedPrompt.replace(regex, "");
    }
  }

  optimizedPrompt = optimizedPrompt.replace(/\n{3,}/g, "\n\n");

  const newLength = optimizedPrompt.length;
  if (originalLength > newLength) {
    const savedChars = originalLength - newLength;
    const estTokensSaved = Math.round(savedChars / 4);
    aiTelemetry.estimatedTokensSaved += estTokensSaved;
  }

  return optimizedPrompt;
}

// --- Phase 2: Centralized Model Router ---
// Enforces:
// LIGHTWEIGHT: Gemini 3.5 Flash Lite (primary) -> Gemini 3.6 Flash (fallback)
// STANDARD GENERATION: Gemini 3.6 Flash (primary) -> Gemini 3.7 Flash (fallback)
// QUALITY FALLBACK: Gemini 3.7 Flash
// HIGH QUALITY ESCALATION: Gemini 3.8 Flash (primary) -> Gemini 3.7 Flash (fallback)
// VERY LIGHT BACKGROUND: Gemini 3.1 Flash Lite
export interface ModelRouteDecision {
  primaryModel: string;
  fallbackModel: string;
}

export function routeModel(complexity: TaskComplexity, requestedModel?: string): ModelRouteDecision {
  // Normalize and cleanse any obsolete or 1.5 references
  let cleanRequested = requestedModel;
  if (cleanRequested && (cleanRequested.includes("1.5") || cleanRequested.includes("pro-preview"))) {
    cleanRequested = undefined;
  }

  // Explicit allowed model overrides
  if (cleanRequested) {
    if (cleanRequested === THREADSWORKS_MODELS.FLASH_38) {
      return { primaryModel: THREADSWORKS_MODELS.FLASH_38, fallbackModel: THREADSWORKS_MODELS.FLASH_37 };
    }
    if (cleanRequested === THREADSWORKS_MODELS.FLASH_37) {
      return { primaryModel: THREADSWORKS_MODELS.FLASH_37, fallbackModel: THREADSWORKS_MODELS.FLASH_36 };
    }
    if (cleanRequested === THREADSWORKS_MODELS.FLASH_36) {
      return { primaryModel: THREADSWORKS_MODELS.FLASH_36, fallbackModel: THREADSWORKS_MODELS.FLASH_37 };
    }
    if (cleanRequested === THREADSWORKS_MODELS.FLASH_35) {
      return { primaryModel: THREADSWORKS_MODELS.FLASH_35, fallbackModel: THREADSWORKS_MODELS.FLASH_37 };
    }
    if (cleanRequested === THREADSWORKS_MODELS.FLASH_LITE_35) {
      return { primaryModel: THREADSWORKS_MODELS.FLASH_LITE_35, fallbackModel: THREADSWORKS_MODELS.FLASH_36 };
    }
    if (cleanRequested === THREADSWORKS_MODELS.FLASH_LITE_31) {
      return { primaryModel: THREADSWORKS_MODELS.FLASH_LITE_31, fallbackModel: THREADSWORKS_MODELS.FLASH_LITE_35 };
    }
    if (cleanRequested === THREADSWORKS_MODELS.FLASH_PREVIEW_31) {
      return { primaryModel: THREADSWORKS_MODELS.FLASH_PREVIEW_31, fallbackModel: THREADSWORKS_MODELS.FLASH_36 };
    }
    if (cleanRequested === THREADSWORKS_MODELS.FLASH_LATEST) {
      return { primaryModel: THREADSWORKS_MODELS.FLASH_LATEST, fallbackModel: THREADSWORKS_MODELS.FLASH_37 };
    }
    if (cleanRequested === THREADSWORKS_MODELS.GEMINI_LATEST) {
      return { primaryModel: THREADSWORKS_MODELS.GEMINI_LATEST, fallbackModel: THREADSWORKS_MODELS.FLASH_37 };
    }
  }

  switch (complexity) {
    case "LEVEL_1_LIGHT":
      // Metadata, classifications, format validations, simple extractions
      return {
        primaryModel: THREADSWORKS_MODELS.FLASH_LITE_35,
        fallbackModel: THREADSWORKS_MODELS.FLASH_36
      };

    case "LEVEL_3_ADVANCED":
      // High-quality escalation: deep strategy diagnosis, holistic brand audit
      return {
        primaryModel: THREADSWORKS_MODELS.FLASH_38,
        fallbackModel: THREADSWORKS_MODELS.FLASH_37
      };

    case "LEVEL_2_STANDARD":
    default:
      // Standard content workhorse: posts, hooks, angles, rewrites, normal plans
      return {
        primaryModel: THREADSWORKS_MODELS.FLASH_36,
        fallbackModel: THREADSWORKS_MODELS.FLASH_37
      };
  }
}

// --- Global Quota Management & Concurrency Controls ---
export const AI_QUOTA_CONFIG = {
  // Maximum concurrent Gemini requests globally (Phase 14)
  MAX_CONCURRENCY: 16,
  
  // Maximum retries per model (Phase 3 & 5: simple 1 primary + 1 fallback policy)
  MAX_RETRIES_PER_MODEL: 0, // Fail directly to fallback model to avoid retry storms
  
  // Maximum total retries allowed for a single high-level user operation
  MAX_TOTAL_RETRY_BUDGET: 2, // 1 primary attempt + 1 fallback attempt max
  
  // TTL for circuit breaker (ms)
  CIRCUIT_BREAKER_DURATION_MS: 30000,
  
  // Backoff settings (ms)
  BASE_RETRY_DELAY_MS: 800,
  MAX_RETRY_DELAY_MS: 4000
};

// --- Token Output Controller (Phase 15) ---
export function applyTokenLimits(taskId: string, configObj: any) {
  const config = TASK_CONFIG_MAP[taskId] || DEFAULT_CONFIG;
  if (!configObj) return;
  if (configObj.maxOutputTokens) {
    configObj.maxOutputTokens = Math.min(configObj.maxOutputTokens, config.expectedOutputTokens);
  } else {
    configObj.maxOutputTokens = config.expectedOutputTokens;
  }
}
