/**
 * Development-only structured diagnostic instrumentation for ThreadsWorks authentication.
 *
 * Security & privacy invariants:
 * - Strictly disabled in production builds.
 * - NEVER logs access tokens, refresh tokens, ID tokens, OAuth credentials, passwords,
 *   query parameters, or full email addresses.
 * - Emits structured JSON-safe console entries with ISO timestamps, sequence numbers,
 *   pageLoadId (to detect unexpected iframe reloads), and correlation IDs.
 */

export type AuthDiagnosticEventName =
  | "page_boot"
  | "page_lifecycle"
  | "navigation_call"
  | "firebase_init_start"
  | "firebase_init_complete"
  | "persistence_resolved"
  | "initial_auth_resolved"
  | "google_popup_start"
  | "popup_promise_settled"
  | "popup_still_pending"
  | "google_popup_complete"
  | "google_popup_failed"
  | "auth_screen_callback"
  | "observer_event"
  | "session_state_change"
  | "firebase_user_confirmed"
  | "route_guard_decision"
  | "popstate_navigation"
  | "backend_auth_outcome"
  | "unexpected_login_navigation"
  | "preview_handoff_lifecycle";

export type AuthFailureCategory =
  | "firebase_authentication_failure"
  | "firebase_session_persistence_failure"
  | "application_auth_state_failure"
  | "protected_route_redirect_failure"
  | "backend_authorization_failure"
  | "browser_or_preview_environment_restriction"
  | "none";

export interface AuthDiagnosticEntry {
  seq: number;
  pageLoadId: string;
  timestamp: string;
  correlationId: string;
  event: AuthDiagnosticEventName;
  category?: AuthFailureCategory;
  details: Record<string, unknown>;
}

const MAX_DIAGNOSTIC_BUFFER = 160;
const SESSION_STORAGE_KEY = "__tw_auth_diag_v1__";
const CHUNK_RELOAD_TRIGGER_KEY = "__tw_chunk_reload_trigger__";
const MAX_PERSISTED_EVENTS = 100;
const SENSITIVE_KEY_PATTERN =
  /(token|secret|password|credential|authorization|cookie|apikey|api_key|email)/i;
const EMAIL_VALUE_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const JWT_LIKE_PATTERN = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;

const PAGE_LOAD_ID = `load_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
let sequenceCounter = 0;
let activeCorrelationId = createCorrelationId();
let navigationDiagnosticsInstalled = false;
const diagnosticBuffer: AuthDiagnosticEntry[] = loadPersistedDiagnostics();

function createCorrelationId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `auth_${Date.now().toString(36)}_${rand}`;
}

function loadPersistedDiagnostics(): AuthDiagnosticEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const valid = parsed.filter(
        (item) => item && typeof item === "object" && typeof item.event === "string"
      ) as AuthDiagnosticEntry[];
      const maxSeq = valid.reduce((m, e) => (typeof e.seq === "number" && e.seq > m ? e.seq : m), 0);
      sequenceCounter = maxSeq;
      return valid.slice(-MAX_PERSISTED_EVENTS);
    }
  } catch {
    // Ignore blocked or unavailable sessionStorage in embedded iframes
  }
  return [];
}

function persistDiagnostics(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify(diagnosticBuffer.slice(-MAX_PERSISTED_EVENTS))
    );
  } catch {
    // Ignore blocked or unavailable sessionStorage in embedded iframes
  }
}

export function isAuthDiagnosticsEnabled(): boolean {
  try {
    const metaEnv = (import.meta as any)?.env;
    if (metaEnv && typeof metaEnv.DEV === "boolean") {
      return metaEnv.DEV;
    }
    if (metaEnv && metaEnv.MODE === "production") {
      return false;
    }
  } catch {
    // Fallback below for Node/tsx test execution
  }
  if (typeof process !== "undefined" && process.env?.NODE_ENV === "production") {
    return false;
  }
  return true;
}

export function startAuthCorrelation(prefix = "signin"): string {
  const rand = Math.random().toString(36).slice(2, 8);
  activeCorrelationId = `${prefix}_${Date.now().toString(36)}_${rand}`;
  return activeCorrelationId;
}

export function getAuthCorrelationId(): string {
  return activeCorrelationId;
}

export function getAuthPageLoadId(): string {
  return PAGE_LOAD_ID;
}

export function maskUidForDiagnostics(uid: string | null | undefined): string | null {
  if (!uid || typeof uid !== "string") return null;
  const trimmed = uid.trim();
  if (!trimmed) return null;
  if (trimmed.length <= 4) return `${trimmed[0]}***`;
  return `${trimmed.slice(0, 4)}...(${trimmed.length})`;
}

export function sanitizeDiagnosticValue(value: unknown, depth = 0): unknown {
  if (depth > 3) return "[truncated]";
  if (value === null || value === undefined) return value;
  if (typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") {
    return value
      .replace(JWT_LIKE_PATTERN, "[REDACTED_TOKEN]")
      .replace(EMAIL_VALUE_PATTERN, "[REDACTED_EMAIL]")
      .slice(0, 240);
  }
  if (Array.isArray(value)) {
    return value.slice(0, 10).map((item) => sanitizeDiagnosticValue(item, depth + 1));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, rawVal] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        out[key] = "[REDACTED]";
      } else {
        out[key] = sanitizeDiagnosticValue(rawVal, depth + 1);
      }
    }
    return out;
  }
  return String(value).slice(0, 120);
}

export function detectEmbeddedPreviewContext(): {
  inIframe: boolean;
  origin: string;
  hostname: string;
  pathname: string;
  isCrossOriginParent: boolean;
} {
  if (typeof window === "undefined") {
    return {
      inIframe: false,
      origin: "ssr",
      hostname: "ssr",
      pathname: "/",
      isCrossOriginParent: false,
    };
  }
  let inIframe = false;
  let isCrossOriginParent = false;
  try {
    inIframe = window.self !== window.top;
  } catch {
    inIframe = true;
    isCrossOriginParent = true;
  }
  if (inIframe && !isCrossOriginParent) {
    try {
      void window.top?.location?.href;
    } catch {
      isCrossOriginParent = true;
    }
  }
  return {
    inIframe,
    origin: window.location?.origin || "unknown",
    hostname: window.location?.hostname || "unknown",
    pathname: window.location?.pathname || "/",
    isCrossOriginParent,
  };
}

export function logAuthDiagnostic(
  event: AuthDiagnosticEventName,
  details: Record<string, unknown> = {},
  options: { correlationId?: string; category?: AuthFailureCategory; level?: "info" | "warn" } = {}
): AuthDiagnosticEntry | null {
  if (!isAuthDiagnosticsEnabled()) {
    return null;
  }

  const entry: AuthDiagnosticEntry = {
    seq: ++sequenceCounter,
    pageLoadId: PAGE_LOAD_ID,
    timestamp: new Date().toISOString(),
    correlationId: options.correlationId || activeCorrelationId,
    event,
    ...(options.category ? { category: options.category } : {}),
    details: sanitizeDiagnosticValue(details) as Record<string, unknown>,
  };

  diagnosticBuffer.push(entry);
  if (diagnosticBuffer.length > MAX_DIAGNOSTIC_BUFFER) {
    diagnosticBuffer.shift();
  }
  persistDiagnostics();

  if (typeof window !== "undefined") {
    (window as any).__THREADSWORKS_AUTH_DIAGNOSTICS__ = diagnosticBuffer;
  }

  const level =
    options.level ||
    (event === "google_popup_failed" || event === "unexpected_login_navigation"
      ? "warn"
      : "info");

  // Skip verbose console output during Node unit tests unless explicitly enabled
  const isNodeTestEnv =
    typeof process !== "undefined" &&
    Boolean(process.env?.NODE_TEST_CONTEXT || process.argv?.some((a) => a.includes("--test")));
  if (!isNodeTestEnv) {
    const logger = level === "warn" ? console.warn : console.info;
    logger(`[TW_AUTH_DIAG] #${entry.seq} ${entry.event}`, entry);
  }

  return entry;
}

export function getAuthDiagnosticsSnapshot(): AuthDiagnosticEntry[] {
  return diagnosticBuffer.slice();
}

function sanitizeUrlToOriginAndPath(rawUrl: string | URL | null | undefined): {
  origin: string | null;
  pathname: string | null;
  hadQuery: boolean;
  hadHash: boolean;
} {
  if (!rawUrl) {
    return { origin: null, pathname: null, hadQuery: false, hadHash: false };
  }
  try {
    const base = typeof window !== "undefined" ? window.location.href : "https://localhost/";
    const parsed = new URL(String(rawUrl), base);
    return {
      origin: parsed.origin || null,
      pathname: parsed.pathname || "/",
      hadQuery: Boolean(parsed.search),
      hadHash: Boolean(parsed.hash),
    };
  } catch {
    return { origin: null, pathname: String(rawUrl).split(/[?#]/)[0].slice(0, 120), hadQuery: false, hadHash: false };
  }
}

function getNavigationBootMeta(): Record<string, unknown> {
  if (typeof window === "undefined") {
    return { navigationType: "ssr" };
  }
  let navigationType = "unknown";
  let redirectCount: number | null = null;
  try {
    const entries = window.performance?.getEntriesByType?.("navigation") as PerformanceNavigationTiming[] | undefined;
    if (entries && entries.length > 0) {
      navigationType = entries[0].type || "unknown";
      redirectCount = typeof entries[0].redirectCount === "number" ? entries[0].redirectCount : null;
    }
  } catch {
    // Ignore unsupported performance timing API
  }

  const referrerInfo = sanitizeUrlToOriginAndPath(typeof document !== "undefined" ? document.referrer : "");
  let chunkReloadTrigger: unknown = null;
  let hasChunkReloadKey = false;
  try {
    const rawTrigger = window.sessionStorage.getItem(CHUNK_RELOAD_TRIGGER_KEY);
    if (rawTrigger) {
      chunkReloadTrigger = JSON.parse(rawTrigger);
      window.sessionStorage.removeItem(CHUNK_RELOAD_TRIGGER_KEY);
    }
    const pathname = window.location?.pathname || "/";
    hasChunkReloadKey = Boolean(
      window.sessionStorage.getItem(`chunk_reload_${pathname}`) ||
        window.sessionStorage.getItem(`chunk_lazy_reload_${pathname}`)
    );
  } catch {
    // Ignore blocked sessionStorage
  }

  return {
    navigationType,
    redirectCount,
    referrerOrigin: referrerInfo.origin,
    referrerPathname: referrerInfo.pathname,
    referrerHadQuery: referrerInfo.hadQuery,
    pathname: window.location?.pathname || "/",
    hadSearchParams: Boolean(window.location?.search),
    hadHash: Boolean(window.location?.hash),
    visibilityState: typeof document !== "undefined" ? document.visibilityState : "unknown",
    hasFocus: typeof document !== "undefined" && typeof document.hasFocus === "function" ? document.hasFocus() : null,
    historyLength: typeof window.history?.length === "number" ? window.history.length : null,
    hasChunkReloadKey,
    chunkReloadTrigger,
  };
}

function extractCompactCallerHint(): string | null {
  try {
    const stack = new Error().stack;
    if (!stack) return null;
    const lines = stack
      .split("\n")
      .slice(2, 6)
      .map((line) => line.trim().replace(/https?:\/\/[^/\s]+/g, ""))
      .filter((line) => !line.includes("authDiagnostics"));
    return lines.slice(0, 2).join(" <- ").slice(0, 180) || null;
  } catch {
    return null;
  }
}

/**
 * Installs development-only browser lifecycle and navigation diagnostics so full page reloads,
 * tab/iframe visibility transitions, referrer/navigationType, and app history mutations are
 * persisted in sessionStorage across reloads without exposing tokens or credentials.
 */
export function installAuthNavigationDiagnostics(): void {
  if (navigationDiagnosticsInstalled || !isAuthDiagnosticsEnabled()) {
    return;
  }
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }
  const isNodeTestEnv =
    typeof process !== "undefined" &&
    Boolean(process.env?.NODE_TEST_CONTEXT || process.argv?.some((a) => a.includes("--test")));
  if (isNodeTestEnv) {
    return;
  }

  navigationDiagnosticsInstalled = true;

  logAuthDiagnostic("page_boot", getNavigationBootMeta());

  window.addEventListener("beforeunload", () => {
    logAuthDiagnostic("page_lifecycle", {
      event: "beforeunload",
      pathname: window.location?.pathname || "/",
      visibilityState: document.visibilityState,
      hasFocus: typeof document.hasFocus === "function" ? document.hasFocus() : null,
    });
  });

  window.addEventListener("pagehide", (event: PageTransitionEvent) => {
    logAuthDiagnostic("page_lifecycle", {
      event: "pagehide",
      persisted: Boolean(event?.persisted),
      pathname: window.location?.pathname || "/",
      visibilityState: document.visibilityState,
    });
  });

  document.addEventListener("visibilitychange", () => {
    logAuthDiagnostic("page_lifecycle", {
      event: "visibilitychange",
      visibilityState: document.visibilityState,
      hasFocus: typeof document.hasFocus === "function" ? document.hasFocus() : null,
      pathname: window.location?.pathname || "/",
    });
  });

  window.addEventListener("blur", () => {
    logAuthDiagnostic("page_lifecycle", {
      event: "window_blur",
      visibilityState: document.visibilityState,
      pathname: window.location?.pathname || "/",
    });
  });

  window.addEventListener("focus", () => {
    logAuthDiagnostic("page_lifecycle", {
      event: "window_focus",
      visibilityState: document.visibilityState,
      pathname: window.location?.pathname || "/",
    });
  });

  try {
    const origPushState = window.history.pushState.bind(window.history);
    const origReplaceState = window.history.replaceState.bind(window.history);

    window.history.pushState = function patchedPushState(
      data: any,
      unused: string,
      url?: string | URL | null
    ) {
      const fromPathname = window.location?.pathname || "/";
      const targetInfo = sanitizeUrlToOriginAndPath(url);
      logAuthDiagnostic("navigation_call", {
        method: "history.pushState",
        fromPathname,
        toPathname: targetInfo.pathname,
        toOrigin: targetInfo.origin,
        hadQuery: targetInfo.hadQuery,
        callerHint: extractCompactCallerHint(),
      });
      return origPushState(data, unused, url);
    };

    window.history.replaceState = function patchedReplaceState(
      data: any,
      unused: string,
      url?: string | URL | null
    ) {
      const fromPathname = window.location?.pathname || "/";
      const targetInfo = sanitizeUrlToOriginAndPath(url);
      logAuthDiagnostic("navigation_call", {
        method: "history.replaceState",
        fromPathname,
        toPathname: targetInfo.pathname,
        toOrigin: targetInfo.origin,
        hadQuery: targetInfo.hadQuery,
        callerHint: extractCompactCallerHint(),
      });
      return origReplaceState(data, unused, url);
    };
  } catch {
    // Never break history API if frozen or restricted by sandbox
  }
}

export function formatAuthDiagnosticsReport(
  runtimeMeta: Record<string, unknown> = {}
): string {
  const ctx = detectEmbeddedPreviewContext();
  const payload = {
    diagnosticFormat: "threadsworks-auth-trace-v3",
    capturedAt: new Date().toISOString(),
    pageLoadId: PAGE_LOAD_ID,
    previewContext: {
      origin: ctx.origin,
      pathname: ctx.pathname,
      inIframe: ctx.inIframe,
      isCrossOriginParent: ctx.isCrossOriginParent,
    },
    navigationBoot: getNavigationBootMeta(),
    runtime: sanitizeDiagnosticValue(runtimeMeta),
    eventCount: diagnosticBuffer.length,
    events: diagnosticBuffer.slice(),
  };
  return JSON.stringify(payload, null, 2);
}

export function clearAuthDiagnosticsForTests(): void {
  diagnosticBuffer.length = 0;
  sequenceCounter = 0;
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      window.sessionStorage.removeItem(CHUNK_RELOAD_TRIGGER_KEY);
    } catch {
      // Ignore blocked storage
    }
  }
}
