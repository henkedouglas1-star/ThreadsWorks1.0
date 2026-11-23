// Error Architecture and Classification for ThreadsWorks
// Cleanly separates parsing, schema, content validation, provider, network, and application errors.

export type ErrorCategory =
  | "Network"
  | "HTTP/API"
  | "Timeout"
  | "Abort"
  | "Authentication"
  | "Rate limit"
  | "AI generation"
  | "Response parsing"
  | "Validation"
  | "Content validation"
  | "State/application"
  | "Storage"
  | "Unknown";

export interface ClassifiedError {
  category: ErrorCategory;
  errorCode?: string;
  title: string;
  userMessage: string;
  underlyingExceptionName: string;
  underlyingExceptionMessage: string;
  stack?: string;
  httpStatus?: number;
  technicalDetails?: string;
  isRetryable: boolean;
  timestamp: string;
}

export function createClassifiedError(
  category: ErrorCategory,
  title: string,
  userMessage: string,
  details?: string
): ClassifiedError {
  return {
    category,
    title,
    userMessage,
    underlyingExceptionName: category + "Error",
    underlyingExceptionMessage: userMessage,
    technicalDetails: details,
    isRetryable: category !== "Authentication" && category !== "Storage",
    timestamp: new Date().toISOString()
  };
}

function extractErrorCode(err: any, responseBodyText?: string): string | undefined {
  if (typeof err?.errorCode === "string" && err.errorCode.trim()) {
    return err.errorCode.trim();
  }
  if (responseBodyText) {
    try {
      const parsed = JSON.parse(responseBodyText);
      if (typeof parsed?.errorCode === "string" && parsed.errorCode.trim()) {
        return parsed.errorCode.trim();
      }
    } catch {
      // Ignore non-JSON bodies
    }
  }
  return undefined;
}

export function classifyGenerationError(
  err: any,
  context?: {
    httpStatus?: number;
    responseBodyText?: string;
    errorCode?: string;
    stage?: "network_request" | "response_parse" | "validation" | "state_update" | "storage";
  }
): ClassifiedError {
  const timestamp = new Date().toISOString();
  const rawName = err?.name || (err instanceof Error ? err.constructor.name : "Error");
  const rawMessage = err?.message || (typeof err === "string" ? err : "An unexpected error occurred.");
  const lowerMessage = rawMessage.toLowerCase();
  const rawStack = err?.stack || "";
  const httpStatus = context?.httpStatus ?? (typeof err?.status === "number" ? err.status : undefined);
  const stage = context?.stage;
  const errorCode = context?.errorCode || extractErrorCode(err, context?.responseBodyText);

  // 0. Structured server error codes take precedence to prevent cross-stage misclassification
  if (errorCode === "CONTENT_VALIDATION_ERROR") {
    return {
      category: "Content validation",
      errorCode,
      title: "Draft Quality Check Failed",
      userMessage:
        "One or more generated drafts could not pass factual or editorial quality checks (such as unsupported claims or CTA rules) and were withheld. Please try again or refine your prompt.",
      underlyingExceptionName: rawName,
      underlyingExceptionMessage: rawMessage,
      stack: rawStack,
      httpStatus: httpStatus || 422,
      technicalDetails: `Content validation rejected draft(s): ${rawMessage}`,
      isRetryable: true,
      timestamp
    };
  }

  if (errorCode === "PARSE_ERROR") {
    return {
      category: "Response parsing",
      errorCode,
      title: "Malformed AI Response",
      userMessage:
        "The AI returned malformed output that could not be parsed. Please try again.",
      underlyingExceptionName: rawName,
      underlyingExceptionMessage: rawMessage,
      stack: rawStack,
      httpStatus: httpStatus || 502,
      technicalDetails: `Model JSON parsing failed: ${rawMessage}`,
      isRetryable: true,
      timestamp
    };
  }

  if (errorCode === "SCHEMA_ERROR") {
    return {
      category: "Validation",
      errorCode,
      title: "Draft Format Mismatch",
      userMessage:
        "The AI output did not match the expected Threads draft format. Please try again.",
      underlyingExceptionName: rawName,
      underlyingExceptionMessage: rawMessage,
      stack: rawStack,
      httpStatus: httpStatus || 502,
      technicalDetails: `Draft schema mismatch: ${rawMessage}`,
      isRetryable: true,
      timestamp
    };
  }

  if (errorCode === "REQUEST_ERROR") {
    return {
      category: "Validation",
      errorCode,
      title: "Invalid Generation Request",
      userMessage: rawMessage || "Please check your content request and try again.",
      underlyingExceptionName: rawName,
      underlyingExceptionMessage: rawMessage,
      stack: rawStack,
      httpStatus: httpStatus || 400,
      technicalDetails: `Invalid request input: ${rawMessage}`,
      isRetryable: false,
      timestamp
    };
  }

  if (errorCode === "PROVIDER_ERROR") {
    if (httpStatus === 401 || httpStatus === 403 || lowerMessage.includes("api key") || lowerMessage.includes("api_key")) {
      return {
        category: "Authentication",
        errorCode,
        title: "AI Provider Authorization Error",
        userMessage: "The AI provider rejected the request credentials. Please verify your account or server configuration.",
        underlyingExceptionName: rawName,
        underlyingExceptionMessage: rawMessage,
        stack: rawStack,
        httpStatus: httpStatus || 403,
        technicalDetails: `AI provider auth error: ${rawMessage}`,
        isRetryable: false,
        timestamp
      };
    }
    if (httpStatus === 429 || lowerMessage.includes("quota") || lowerMessage.includes("rate limit") || lowerMessage.includes("resource_exhausted")) {
      const isDaily = lowerMessage.includes("daily") || lowerMessage.includes("billing") || lowerMessage.includes("credit");
      return {
        category: "Rate limit",
        errorCode,
        title: "AI Provider Rate Limit Reached",
        userMessage: isDaily
          ? "The AI provider quota has been exhausted. Please wait or upgrade your API quota before retrying."
          : "The AI provider is temporarily rate-limiting requests. Please wait a few seconds and try again.",
        underlyingExceptionName: rawName,
        underlyingExceptionMessage: rawMessage,
        stack: rawStack,
        httpStatus: 429,
        technicalDetails: `AI provider rate/quota limit: ${rawMessage}`,
        isRetryable: !isDaily,
        timestamp
      };
    }
    return {
      category: "AI generation",
      errorCode,
      title: "AI Service Temporarily Unavailable",
      userMessage: "The AI model is experiencing high demand or temporary unavailability. Please try again in a few seconds.",
      underlyingExceptionName: rawName,
      underlyingExceptionMessage: rawMessage,
      stack: rawStack,
      httpStatus: httpStatus || 503,
      technicalDetails: `AI provider failure: ${rawMessage}`,
      isRetryable: err?.retryable !== false,
      timestamp
    };
  }

  if (errorCode === "NETWORK_ERROR") {
    const isTimeout = httpStatus === 504 || httpStatus === 408 || lowerMessage.includes("time");
    return {
      category: isTimeout ? "Timeout" : "Network",
      errorCode,
      title: isTimeout ? "Request Timed Out" : "Upstream Connection Interrupted",
      userMessage: isTimeout
        ? "The generation server took longer than expected to complete. Please try again with fewer posts or shorter thread lengths."
        : "The connection to the AI service was interrupted before generation completed. Please try again.",
      underlyingExceptionName: rawName,
      underlyingExceptionMessage: rawMessage,
      stack: rawStack,
      httpStatus: httpStatus || (isTimeout ? 504 : 502),
      technicalDetails: `Upstream network/timeout error: ${rawMessage}`,
      isRetryable: true,
      timestamp
    };
  }

  // 1. Abort
  if (rawName === "AbortError" || lowerMessage.includes("aborted") || lowerMessage.includes("user canceled")) {
    return {
      category: "Abort",
      title: "Generation Canceled",
      userMessage: "The content generation request was canceled.",
      underlyingExceptionName: rawName,
      underlyingExceptionMessage: rawMessage,
      stack: rawStack,
      httpStatus,
      technicalDetails: `Request aborted cleanly via AbortController at stage [${stage || "unknown"}].`,
      isRetryable: true,
      timestamp
    };
  }

  // 2. Timeout
  if (
    rawName === "TimeoutError" ||
    lowerMessage.includes("timeout") ||
    lowerMessage.includes("timed out") ||
    lowerMessage.includes("did not complete in time") ||
    httpStatus === 504 ||
    httpStatus === 408
  ) {
    return {
      category: "Timeout",
      title: "Request Timed Out",
      userMessage: "The generation server took longer than expected to complete. Please try again with fewer posts or shorter thread lengths.",
      underlyingExceptionName: rawName,
      underlyingExceptionMessage: rawMessage,
      stack: rawStack,
      httpStatus: httpStatus || 504,
      technicalDetails: `Generation timed out at stage [${stage || "unknown"}]. Server response was not received within timeout limit.`,
      isRetryable: true,
      timestamp
    };
  }

  // 3. Authentication
  if (
    httpStatus === 401 ||
    httpStatus === 403 ||
    lowerMessage.includes("unauthorized") ||
    lowerMessage.includes("forbidden") ||
    lowerMessage.includes("permission denied") ||
    lowerMessage.includes("api key") ||
    lowerMessage.includes("api_key") ||
    lowerMessage.includes("auth")
  ) {
    return {
      category: "Authentication",
      title: "Authentication Required",
      userMessage: "Your session or API authorization could not be verified. Please check your account status.",
      underlyingExceptionName: rawName,
      underlyingExceptionMessage: rawMessage,
      stack: rawStack,
      httpStatus: httpStatus || 401,
      technicalDetails: `Auth rejection with status ${httpStatus}: ${rawMessage}`,
      isRetryable: false,
      timestamp
    };
  }

  // 4. Rate Limit / Quota (distinguish Firestore vs AI Provider)
  if (
    httpStatus === 429 ||
    lowerMessage.includes("rate limit") ||
    lowerMessage.includes("resource_exhausted") ||
    lowerMessage.includes("quota") ||
    lowerMessage.includes("too many requests")
  ) {
    const isFirestoreQuota = lowerMessage.includes("firestore") || lowerMessage.includes("grpc");
    if (isFirestoreQuota) {
      return {
        category: "Rate limit",
        title: "Firestore Read Quota Error",
        userMessage: "Google Cloud API returned status 8 RESOURCE_EXHAUSTED for database read requests. Please check Cloud Firestore API Quota metrics in Google Cloud Console.",
        underlyingExceptionName: rawName,
        underlyingExceptionMessage: rawMessage,
        stack: rawStack,
        httpStatus: 429,
        technicalDetails: `gRPC Status 8 RESOURCE_EXHAUSTED: ${rawMessage}`,
        isRetryable: false,
        timestamp
      };
    }
    const isDaily = lowerMessage.includes("daily") || lowerMessage.includes("billing") || lowerMessage.includes("credit");
    return {
      category: "Rate limit",
      title: "AI Provider Rate Limit Reached",
      userMessage: isDaily
        ? "The AI provider quota has been exhausted. Please wait or check your billing quota before retrying."
        : "The AI provider is temporarily rate-limiting requests. Please wait a few seconds and try again.",
      underlyingExceptionName: rawName,
      underlyingExceptionMessage: rawMessage,
      stack: rawStack,
      httpStatus: 429,
      technicalDetails: `Rate limit / quota response: ${rawMessage}`,
      isRetryable: !isDaily,
      timestamp
    };
  }

  // 5. Response Parsing (JSON syntax / truncated response)
  if (
    stage === "response_parse" ||
    err instanceof SyntaxError ||
    lowerMessage.includes("malformed json") ||
    lowerMessage.includes("invalid json") ||
    lowerMessage.includes("unexpected token") ||
    (lowerMessage.includes("json") && !lowerMessage.includes("validation"))
  ) {
    return {
      category: "Response parsing",
      title: "Response Parsing Error",
      userMessage: "The server response could not be parsed as valid JSON. The generation stream may have been truncated.",
      underlyingExceptionName: rawName,
      underlyingExceptionMessage: rawMessage,
      stack: rawStack,
      httpStatus,
      technicalDetails: `Parsing failed: ${rawMessage}. Sample body: ${context?.responseBodyText?.slice(0, 200) || "N/A"}`,
      isRetryable: true,
      timestamp
    };
  }

  // 6A. Content / Editorial Validation (distinct from schema/format mismatch!)
  if (
    httpStatus === 422 ||
    lowerMessage.includes("could not pass validation") ||
    lowerMessage.includes("passed validation") ||
    lowerMessage.includes("draft validation failed") ||
    lowerMessage.includes("invents ") ||
    lowerMessage.includes("unsupported metric") ||
    lowerMessage.includes("unsupported financial") ||
    lowerMessage.includes("unsupported quantified") ||
    lowerMessage.includes("cta off") ||
    lowerMessage.includes("editorial")
  ) {
    return {
      category: "Content validation",
      errorCode: "CONTENT_VALIDATION_ERROR",
      title: "Draft Quality Check Failed",
      userMessage:
        "One or more generated drafts could not pass factual or editorial quality checks (such as unsupported claims or CTA rules) and were withheld. Please try again or refine your prompt.",
      underlyingExceptionName: rawName,
      underlyingExceptionMessage: rawMessage,
      stack: rawStack,
      httpStatus: httpStatus || 422,
      technicalDetails: `Content validation rejected draft(s): ${rawMessage}`,
      isRetryable: true,
      timestamp
    };
  }

  // 6B. Structural / Schema Validation
  if (
    stage === "validation" ||
    lowerMessage.includes("expected array of posts") ||
    lowerMessage.includes("expected a non-empty array") ||
    lowerMessage.includes("incomplete generation") ||
    lowerMessage.includes("schema") ||
    lowerMessage.includes("invalid format") ||
    lowerMessage.includes("validation")
  ) {
    return {
      category: "Validation",
      errorCode: "SCHEMA_ERROR",
      title: "Draft Format Mismatch",
      userMessage: "The AI output did not match the expected Threads draft format. Please try again.",
      underlyingExceptionName: rawName,
      underlyingExceptionMessage: rawMessage,
      stack: rawStack,
      httpStatus,
      technicalDetails: `Schema/format validation failed on payload: ${rawMessage}`,
      isRetryable: true,
      timestamp
    };
  }

  // 7. State / Application
  if (stage === "state_update") {
    return {
      category: "State/application",
      title: "Application State Error",
      userMessage: "An error occurred while updating the application with your generated drafts.",
      underlyingExceptionName: rawName,
      underlyingExceptionMessage: rawMessage,
      stack: rawStack,
      httpStatus,
      technicalDetails: `React state update exception: ${rawMessage}`,
      isRetryable: true,
      timestamp
    };
  }

  // 8. Storage
  if (
    stage === "storage" ||
    lowerMessage.includes("localstorage") ||
    lowerMessage.includes("quotaexceedederror")
  ) {
    return {
      category: "Storage",
      title: "Local Storage Error",
      userMessage: "Could not save drafts to browser storage. Your browser storage may be full.",
      underlyingExceptionName: rawName,
      underlyingExceptionMessage: rawMessage,
      stack: rawStack,
      httpStatus,
      technicalDetails: `Storage exception: ${rawMessage}`,
      isRetryable: false,
      timestamp
    };
  }

  // 9. AI Generation Provider
  if (
    httpStatus === 503 ||
    lowerMessage.includes("gemini") ||
    lowerMessage.includes("model is overloaded") ||
    lowerMessage.includes("high demand") ||
    lowerMessage.includes("safety filter") ||
    lowerMessage.includes("temporarily unavailable") ||
    lowerMessage.includes("ai generation is unavailable") ||
    lowerMessage.includes("candidate")
  ) {
    return {
      category: "AI generation",
      title: "AI Service Temporarily Unavailable",
      userMessage: "The AI model is experiencing high demand or temporary unavailability. Please try again in a few seconds.",
      underlyingExceptionName: rawName,
      underlyingExceptionMessage: rawMessage,
      stack: rawStack,
      httpStatus: httpStatus || 503,
      technicalDetails: `AI Generation model failure: ${rawMessage}`,
      isRetryable: true,
      timestamp
    };
  }

  // 10. HTTP 413 Request Too Large
  if (
    httpStatus === 413 ||
    lowerMessage.includes("413") ||
    lowerMessage.includes("payload too large") ||
    lowerMessage.includes("request entity too large") ||
    lowerMessage.includes("request too large")
  ) {
    return {
      category: "HTTP/API",
      title: "Request Too Large",
      userMessage: "The generation request payload exceeds server limits. Please trim custom instructions or context before retrying.",
      underlyingExceptionName: "PayloadTooLargeError",
      underlyingExceptionMessage: rawMessage,
      stack: rawStack,
      httpStatus: 413,
      technicalDetails: `HTTP 413 Payload Too Large: ${rawMessage}`,
      isRetryable: false,
      timestamp
    };
  }

  // 11. HTTP / API
  if (httpStatus && httpStatus >= 400) {
    return {
      category: "HTTP/API",
      title: `Server Error (${httpStatus})`,
      userMessage: `The server encountered an error (${httpStatus}) while processing the request: ${rawMessage}`,
      underlyingExceptionName: rawName,
      underlyingExceptionMessage: rawMessage,
      stack: rawStack,
      httpStatus,
      technicalDetails: `HTTP ${httpStatus} error returned from server: ${rawMessage}`,
      isRetryable: true,
      timestamp
    };
  }

  // 12. Network (ONLY if genuinely offline or standard fetch network connection failure)
  const isOffline = typeof navigator !== "undefined" && navigator.onLine === false;
  const isFetchNetworkFail =
    rawName === "TypeError" &&
    (lowerMessage === "load failed" ||
      lowerMessage === "failed to fetch" ||
      lowerMessage.includes("network error") ||
      lowerMessage.includes("networkrequestfailed"));

  if (isOffline) {
    return {
      category: "Network",
      title: "Internet Disconnected",
      userMessage: "Your browser appears to be offline. Please verify your network connection and try again.",
      underlyingExceptionName: rawName,
      underlyingExceptionMessage: rawMessage,
      stack: rawStack,
      httpStatus,
      technicalDetails: `Navigator offline (${navigator.onLine}) with network error: ${rawMessage}`,
      isRetryable: true,
      timestamp
    };
  }

  if (isFetchNetworkFail) {
    return {
      category: "Network",
      title: "Connection Lost",
      userMessage: "The connection to the server was closed or interrupted before the generation could complete. Please try again.",
      underlyingExceptionName: rawName,
      underlyingExceptionMessage: rawMessage,
      stack: rawStack,
      httpStatus,
      technicalDetails: `Fetch network failure (${rawName}: ${rawMessage}). Possible socket closure, proxy disconnect, or WebKit fetch reset.`,
      isRetryable: true,
      timestamp
    };
  }

  // 13. Unknown
  return {
    category: "Unknown",
    title: "Unexpected Error",
    userMessage: rawMessage || "An unexpected error occurred while generating threads.",
    underlyingExceptionName: rawName,
    underlyingExceptionMessage: rawMessage,
    stack: rawStack,
    httpStatus,
    technicalDetails: `Unclassified exception: ${rawName}: ${rawMessage}`,
    isRetryable: true,
    timestamp
  };
}
