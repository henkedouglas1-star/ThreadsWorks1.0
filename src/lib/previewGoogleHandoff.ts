import { GoogleAuthProvider, signInWithCredential, type Auth } from "firebase/auth";
import { detectEmbeddedPreviewContext, logAuthDiagnostic, maskUidForDiagnostics } from "./authDiagnostics";
import { safeGetSessionStorage, safeRemoveSessionStorage, safeSetSessionStorage } from "./safeStorage";

export const PREVIEW_HANDOFF_STORAGE_KEY = "__tw_preview_google_handoff_v1__";
export const PREVIEW_BRIDGE_QUERY_KEY = "tw_google_bridge";
export const PREVIEW_BRIDGE_HANDOFF_PARAM = "handoff";
export const PREVIEW_BRIDGE_READY_MESSAGE = "TW_GOOGLE_BRIDGE_READY";
export const PREVIEW_BRIDGE_CANCELLED_MESSAGE = "TW_GOOGLE_BRIDGE_CANCELLED";

const MAX_PENDING_AGE_MS = 180_000;
const HEX_ID_PATTERN = /^[a-f0-9]{32,96}$/i;
const AI_STUDIO_PREVIEW_HOST_PATTERN = /^ais-(dev|pre)-[a-z0-9-]+\.run\.app$/i;

let activeClaimHandoffId: string | null = null;

export function setActivePreviewHandoffClaim(handoffId: string | null): void {
  activeClaimHandoffId = handoffId;
}

export function isPreviewHandoffClaimActive(handoffId: string): boolean {
  return activeClaimHandoffId === handoffId;
}

export interface PendingPreviewHandoff {
  handoffId: string;
  claimSecret: string;
  createdAt: number;
}

export type PreviewHandoffClaimResponse =
  | { status: "pending" }
  | { status: "cancelled" }
  | { status: "expired" }
  | { status: "forbidden" }
  | { status: "ready"; googleIdToken: string | null; googleAccessToken: string | null };

export interface PreviewHandoffResumeCallbacks<TUser = any> {
  onAuthenticating?: () => void;
  onSuccess?: (user: TUser) => void;
  onError?: (message: string) => void;
}

export interface PreviewHandoffResumeDeps<TUser = any> {
  claim?: (handoffId: string, claimSecret: string) => Promise<PreviewHandoffClaimResponse>;
  signInWithGoogleCredential?: (
    googleIdToken: string | null,
    googleAccessToken: string | null
  ) => Promise<TUser | null>;
  getPending?: () => PendingPreviewHandoff | null;
  clearPending?: () => void;
  pollIntervalMs?: number;
}

interface ActiveResumeRunner<TUser = any> {
  handoffId: string;
  callbacks: Set<PreviewHandoffResumeCallbacks<TUser>>;
  pollTimer: ReturnType<typeof setInterval> | null;
  inFlight: boolean;
  finished: boolean;
  cleanupListeners: () => void;
}

const activeResumeRunners = new Map<string, ActiveResumeRunner<any>>();

function maskHandoffId(handoffId: string): string {
  return handoffId ? `${handoffId.slice(0, 8)}...` : "none";
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateRandomHex(byteLength = 24): string {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const buf = new Uint8Array(byteLength);
    crypto.getRandomValues(buf);
    return bytesToHex(buf);
  }
  let out = "";
  while (out.length < byteLength * 2) {
    out += Math.floor(Math.random() * 16).toString(16);
  }
  return out;
}

async function computeSha256Hex(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return bytesToHex(new Uint8Array(digest));
}

/**
 * Returns true ONLY when running inside the Google AI Studio Preview embedded iframe
 * (ais-dev-*.run.app / ais-pre-*.run.app inside cross-origin parent aistudio.google.com).
 * Standalone production sites and top-level browser tabs always return false.
 */
export function isEmbeddedAiStudioPreview(): boolean {
  if (typeof window === "undefined") return false;
  const ctx = detectEmbeddedPreviewContext();
  return ctx.inIframe && ctx.isCrossOriginParent && AI_STUDIO_PREVIEW_HOST_PATTERN.test(ctx.hostname);
}

/**
 * Returns the validated handoffId if the current top-level window is the
 * AI Studio Preview Google Sign-In bridge popup (`/?tw_google_bridge=1&handoff=...`).
 */
export function getPreviewGoogleBridgeHandoffId(): string | null {
  if (typeof window === "undefined") return null;
  const ctx = detectEmbeddedPreviewContext();
  if (ctx.inIframe) return null;
  if (!AI_STUDIO_PREVIEW_HOST_PATTERN.test(ctx.hostname)) return null;
  const params = new URLSearchParams(window.location.search);
  if (params.get(PREVIEW_BRIDGE_QUERY_KEY) !== "1") return null;
  const handoffId = (params.get(PREVIEW_BRIDGE_HANDOFF_PARAM) || "").trim();
  if (!HEX_ID_PATTERN.test(handoffId)) return null;
  return handoffId;
}

export function isPreviewGoogleBridgeWindow(): boolean {
  return getPreviewGoogleBridgeHandoffId() !== null;
}

/**
 * Synchronously creates a pending handoff record in sessionStorage (survives iframe reload)
 * and builds the top-level bridge URL containing ONLY the opaque handoffId (never claimSecret).
 */
export function createPendingPreviewHandoff(): PendingPreviewHandoff & { bridgeUrl: string } {
  const handoffId = generateRandomHex(24);
  const claimSecret = generateRandomHex(24);
  const record: PendingPreviewHandoff = {
    handoffId,
    claimSecret,
    createdAt: Date.now(),
  };
  safeSetSessionStorage(PREVIEW_HANDOFF_STORAGE_KEY, JSON.stringify(record));
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const bridgeUrl = `${origin}/?${PREVIEW_BRIDGE_QUERY_KEY}=1&${PREVIEW_BRIDGE_HANDOFF_PARAM}=${encodeURIComponent(handoffId)}`;
  return { ...record, bridgeUrl };
}

export function getPendingPreviewHandoff(): PendingPreviewHandoff | null {
  const raw = safeGetSessionStorage(PREVIEW_HANDOFF_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PendingPreviewHandoff>;
    if (
      typeof parsed?.handoffId === "string" &&
      typeof parsed?.claimSecret === "string" &&
      typeof parsed?.createdAt === "number" &&
      HEX_ID_PATTERN.test(parsed.handoffId) &&
      HEX_ID_PATTERN.test(parsed.claimSecret)
    ) {
      if (Date.now() - parsed.createdAt > MAX_PENDING_AGE_MS) {
        safeRemoveSessionStorage(PREVIEW_HANDOFF_STORAGE_KEY);
        return null;
      }
      return {
        handoffId: parsed.handoffId,
        claimSecret: parsed.claimSecret,
        createdAt: parsed.createdAt,
      };
    }
  } catch {
    // Ignore corrupted storage
  }
  safeRemoveSessionStorage(PREVIEW_HANDOFF_STORAGE_KEY);
  return null;
}

export function clearPendingPreviewHandoff(): void {
  safeRemoveSessionStorage(PREVIEW_HANDOFF_STORAGE_KEY);
}

export async function registerPreviewHandoff(handoffId: string, claimSecret: string): Promise<boolean> {
  const claimHash = await computeSha256Hex(claimSecret);
  const res = await fetch("/api/auth/preview-handoff/init", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ handoffId, claimHash }),
    keepalive: true,
  });
  logAuthDiagnostic("preview_handoff_lifecycle", {
    phase: "init_response",
    handoffIdPrefix: maskHandoffId(handoffId),
    ok: res.ok,
    httpStatus: res.status,
  });
  return res.ok;
}

export async function completePreviewHandoff(params: {
  handoffId: string;
  firebaseIdToken: string;
  googleIdToken: string | null;
  googleAccessToken: string | null;
}): Promise<{ ok: boolean; status: number; error?: string }> {
  const attempt = async () => {
    const res = await fetch("/api/auth/preview-handoff/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, error: data?.error };
  };

  const first = await attempt();
  if (!first.ok && first.status === 404) {
    // Handle tiny race if iframe's /init fetch was still in flight
    await new Promise((r) => setTimeout(r, 600));
    return attempt();
  }
  return first;
}

export async function cancelPreviewHandoff(handoffId: string): Promise<void> {
  try {
    await fetch("/api/auth/preview-handoff/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handoffId }),
      keepalive: true,
    });
  } catch {
    // Best-effort cancellation signal
  }
}

export async function claimPreviewHandoff(
  handoffId: string,
  claimSecret: string
): Promise<PreviewHandoffClaimResponse> {
  const res = await fetch("/api/auth/preview-handoff/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ handoffId, claimSecret }),
  });
  if (res.status === 403) return { status: "forbidden" };
  if (res.status === 404) return { status: "expired" };
  const data = await res.json().catch(() => ({ status: "pending" }));
  if (data?.status === "ready") {
    return {
      status: "ready",
      googleIdToken: data.googleIdToken || null,
      googleAccessToken: data.googleAccessToken || null,
    };
  }
  if (data?.status === "cancelled") return { status: "cancelled" };
  return { status: "pending" };
}

export async function signInIframeWithGoogleCredential(
  auth: Auth,
  googleIdToken: string | null,
  googleAccessToken: string | null,
  correlationId?: string
) {
  const credential = GoogleAuthProvider.credential(
    googleIdToken || undefined,
    googleAccessToken || undefined
  );
  const userCredential = await signInWithCredential(auth, credential);
  if (typeof (auth as any).authStateReady === "function") {
    await auth.authStateReady();
  }
  const confirmedUser = auth.currentUser || userCredential.user || null;
  logAuthDiagnostic(
    "google_popup_complete",
    {
      via: "preview_top_level_bridge",
      hasCredentialUser: Boolean(userCredential?.user?.uid),
      postReadyCurrentUserPresent: Boolean(auth.currentUser?.uid),
      uidHint: maskUidForDiagnostics(confirmedUser?.uid),
    },
    { correlationId }
  );
  return confirmedUser;
}

/**
 * Module-level singleton resume runner for post-reload AI Studio Preview Google Sign-In handoff.
 *
 * CRITICAL: React <StrictMode> mounts -> unmounts (~3ms) -> remounts every component on boot.
 * Because `/api/auth/preview-handoff/claim` is strictly single-use on the server, an effect-local
 * `cancelled = true` guard would discard a `"ready"` credential returned to Mount 1 while Mount 2
 * receives `404 expired`. Keeping the active runner at module scope guarantees:
 *   1. At most ONE `/claim` request is ever in flight per `handoffId`.
 *   2. An in-flight `"ready"` claim is NEVER discarded by a StrictMode unmount — it always
 *      completes `signInWithCredential` and notifies whichever callbacks are currently attached.
 */
export function attachPreviewHandoffResume<TUser = any>(
  auth: Auth,
  callbacks: PreviewHandoffResumeCallbacks<TUser>,
  deps: PreviewHandoffResumeDeps<TUser> = {}
): () => void {
  const getPending = deps.getPending || getPendingPreviewHandoff;
  const clearPending = deps.clearPending || clearPendingPreviewHandoff;
  const claimFn = deps.claim || claimPreviewHandoff;
  const signInFn =
    deps.signInWithGoogleCredential ||
    ((idTok, accTok) => signInIframeWithGoogleCredential(auth, idTok, accTok) as unknown as Promise<TUser | null>);
  const pollIntervalMs = deps.pollIntervalMs ?? 1200;

  const pending = getPending();
  if (!pending) {
    return () => {};
  }

  const existing = activeResumeRunners.get(pending.handoffId) as ActiveResumeRunner<TUser> | undefined;
  if (existing && !existing.finished) {
    existing.callbacks.add(callbacks);
    logAuthDiagnostic("preview_handoff_lifecycle", {
      phase: "resume_reattached",
      handoffIdPrefix: maskHandoffId(pending.handoffId),
      listenerCount: existing.callbacks.size,
      inFlight: existing.inFlight,
    });
    return () => {
      existing.callbacks.delete(callbacks);
    };
  }

  // If AuthScreen's live popup handler is already claiming this exact handoff, do not race it.
  if (isPreviewHandoffClaimActive(pending.handoffId)) {
    return () => {};
  }

  const runner: ActiveResumeRunner<TUser> = {
    handoffId: pending.handoffId,
    callbacks: new Set([callbacks]),
    pollTimer: null,
    inFlight: false,
    finished: false,
    cleanupListeners: () => {},
  };

  activeResumeRunners.set(pending.handoffId, runner);
  setActivePreviewHandoffClaim(pending.handoffId);

  const stopRunner = () => {
    if (runner.finished) return;
    runner.finished = true;
    if (runner.pollTimer) {
      clearInterval(runner.pollTimer);
      runner.pollTimer = null;
    }
    runner.cleanupListeners();
    activeResumeRunners.delete(pending.handoffId);
    if (activeClaimHandoffId === pending.handoffId) {
      setActivePreviewHandoffClaim(null);
    }
  };

  const notifyAll = (invoke: (cb: PreviewHandoffResumeCallbacks<TUser>) => void) => {
    for (const cb of Array.from(runner.callbacks)) {
      try {
        invoke(cb);
      } catch {
        // Never allow a callback error to break handoff completion
      }
    }
  };

  const attemptClaim = async () => {
    if (runner.finished || runner.inFlight) return;
    const latestPending = getPending();
    if (!latestPending || latestPending.handoffId !== pending.handoffId) {
      stopRunner();
      return;
    }
    runner.inFlight = true;
    try {
      const res = await claimFn(pending.handoffId, pending.claimSecret);
      logAuthDiagnostic("preview_handoff_lifecycle", {
        phase: "resume_claim_result",
        handoffIdPrefix: maskHandoffId(pending.handoffId),
        status: res.status,
        hasIdToken: res.status === "ready" ? Boolean(res.googleIdToken) : false,
        hasAccessToken: res.status === "ready" ? Boolean(res.googleAccessToken) : false,
      });

      if (res.status === "ready") {
        // Stop polling immediately so no duplicate claim can fire, then complete real Firebase sign-in
        // unconditionally (even if React StrictMode momentarily unmounted the caller).
        if (runner.pollTimer) {
          clearInterval(runner.pollTimer);
          runner.pollTimer = null;
        }
        runner.cleanupListeners();
        clearPending();
        notifyAll((cb) => cb.onAuthenticating?.());

        const confirmedUser = await signInFn(res.googleIdToken, res.googleAccessToken);
        stopRunner();

        if (confirmedUser) {
          logAuthDiagnostic("preview_handoff_lifecycle", {
            phase: "resume_signin_success",
            handoffIdPrefix: maskHandoffId(pending.handoffId),
            uidHint: maskUidForDiagnostics((confirmedUser as any)?.uid),
            listenerCount: runner.callbacks.size,
          });
          notifyAll((cb) => cb.onSuccess?.(confirmedUser));
        } else {
          logAuthDiagnostic(
            "preview_handoff_lifecycle",
            {
              phase: "resume_signin_empty_user",
              handoffIdPrefix: maskHandoffId(pending.handoffId),
            },
            { level: "warn" }
          );
          notifyAll((cb) =>
            cb.onError?.("Google Sign-In completed, but Firebase could not establish the session in this window.")
          );
        }
      } else if (res.status === "cancelled" || res.status === "expired" || res.status === "forbidden") {
        clearPending();
        stopRunner();
        if (res.status === "forbidden") {
          notifyAll((cb) =>
            cb.onError?.("Google Sign-In handoff could not be verified. Please click Sign in with Google again.")
          );
        }
      }
    } catch (err: any) {
      logAuthDiagnostic(
        "preview_handoff_lifecycle",
        {
          phase: "resume_claim_error",
          handoffIdPrefix: maskHandoffId(pending.handoffId),
          errorCode: err?.code || "unknown",
        },
        { level: "warn" }
      );
      // Only clear and fail if signInWithCredential threw (after ready); transient network errors keep polling
      if (!getPending()) {
        stopRunner();
        notifyAll((cb) =>
          cb.onError?.(err?.message || "Unable to complete Google Sign-In after preview reload. Please try again.")
        );
      }
    } finally {
      runner.inFlight = false;
    }
  };

  logAuthDiagnostic("preview_handoff_lifecycle", {
    phase: "resume_start",
    handoffIdPrefix: maskHandoffId(pending.handoffId),
    ageMs: Math.max(0, Date.now() - pending.createdAt),
  });

  const onVisibility = () => {
    if (typeof document !== "undefined" && document.visibilityState === "visible") {
      void attemptClaim();
    }
  };
  const onFocus = () => {
    void attemptClaim();
  };

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVisibility);
  }
  if (typeof window !== "undefined") {
    window.addEventListener("focus", onFocus);
  }
  runner.cleanupListeners = () => {
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", onVisibility);
    }
    if (typeof window !== "undefined") {
      window.removeEventListener("focus", onFocus);
    }
  };

  void attemptClaim();
  runner.pollTimer = setInterval(() => {
    void attemptClaim();
  }, pollIntervalMs);

  return () => {
    runner.callbacks.delete(callbacks);
  };
}
