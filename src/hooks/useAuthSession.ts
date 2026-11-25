import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { UserProfile } from "../types";
import {
  AUTH_SIGNOUT_EVENT,
  AuthSessionState,
  AuthUserLike,
  createInitialAuthSessionState,
  isAuthStatusInitializing,
  reduceAuthSession,
} from "../lib/authContract";
import {
  logAuthDiagnostic,
  maskUidForDiagnostics,
} from "../lib/authDiagnostics";
import {
  safeGetLocalStorage,
  safeRemoveSessionStorage,
  safeSetSessionStorage,
} from "../lib/safeStorage";

export interface AuthSessionAdapter {
  getCurrentUser: () => AuthUserLike | null;
  subscribeAuthState: (
    onNext: (user: AuthUserLike | null) => void,
    onError: (err: unknown) => void
  ) => () => void;
  /** Resolves when Firebase Auth completes initial persistence/session restoration */
  waitForAuthStateReady?: () => Promise<void>;
  ensureProfile?: (user: AuthUserLike) => Promise<void>;
  fetchProfile?: (uid: string, email: string) => Promise<UserProfile | null>;
  attributeReferral?: (refCode: string) => Promise<void>;
  /** Optional fallback timeout (ms) used ONLY when waitForAuthStateReady is not provided */
  initTimeoutMs?: number;
  /** Window (ms) protecting a fresh interactive sign-in from a stale startup null callback */
  recentSignInGraceMs?: number;
}

export interface UseAuthSessionResult extends AuthSessionState {
  profile: UserProfile | null;
  setProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  loading: boolean;
  beginAuthenticating: (method?: "google" | "email" | "signup") => void;
  failAuthenticating: (message: string) => void;
  notifyLoginSuccess: (authenticatedUser?: AuthUserLike | null) => void;
  notifySignOut: () => void;
  reportBackendAuthError: (message: string, endpoint?: string, statusCode?: number) => void;
  clearBackendAuthError: () => void;
  refreshProfile: () => void;
}

function hydrateProfileFromStorage(uid: string, email: string): UserProfile {
  const cached = safeGetLocalStorage(`profile_${uid}`);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (parsed && typeof parsed === "object") {
        if (parsed.customInstruction === undefined || parsed.customInstruction === null) {
          const localInst =
            safeGetLocalStorage(`threads_custom_instruction_${uid}`) ??
            safeGetLocalStorage("threads_custom_instruction");
          if (localInst !== null) parsed.customInstruction = localInst;
        }
        if (parsed.rawVoice === undefined || parsed.rawVoice === null) {
          const localVoice =
            safeGetLocalStorage(`threads_raw_voice_${uid}`) ??
            safeGetLocalStorage("threads_raw_voice");
          if (localVoice !== null) parsed.rawVoice = localVoice;
        }
        return parsed as UserProfile;
      }
    } catch {
      // Ignore malformed cached JSON and return safe baseline profile
    }
  }

  return {
    uid,
    email,
    offer: "",
    audience: "",
    desiredResult: "",
    writingStyle: "",
    customInstruction: safeGetLocalStorage(`threads_custom_instruction_${uid}`) || "",
    rawVoice: safeGetLocalStorage(`threads_raw_voice_${uid}`) || "",
  };
}

/**
 * Authoritative React session controller enforcing the ThreadsWorks Authentication Contract.
 * - Firebase Auth is the single identity source.
 * - Initializing, authenticating, authenticated, unauthenticated, and error states are strictly separated.
 * - Properly sequences authStateReady() with onAuthStateChanged() so temporary startup nulls never redirect.
 * - Monotonic session epochs prevent stale async callbacks from overwriting newer authenticated state.
 * - Profile, storage, and backend API errors NEVER invalidate Firebase authentication.
 */
export function useAuthSession(adapter: AuthSessionAdapter): UseAuthSessionResult {
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;

  const [session, dispatch] = useReducer(
    reduceAuthSession,
    undefined,
    () => createInitialAuthSessionState(adapter.getCurrentUser())
  );
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    const initialUser = adapter.getCurrentUser();
    return initialUser ? hydrateProfileFromStorage(initialUser.uid, initialUser.email || "") : null;
  });

  const sessionStatusRef = useRef(session.status);
  sessionStatusRef.current = session.status;

  const activeUidRef = useRef<string | null>(adapter.getCurrentUser()?.uid || null);
  const hydratedUidRef = useRef<string | null>(null);
  const recentSignInRef = useRef<{ uid: string; at: number } | null>(null);
  const observerConfirmedUidRef = useRef<string | null>(null);
  const explicitSignOutRef = useRef<boolean>(false);
  const initialResolutionLoggedRef = useRef<boolean>(false);
  const authStateReadySettledRef = useRef<boolean>(
    Boolean(adapter.getCurrentUser()?.uid) || typeof adapter.waitForAuthStateReady !== "function"
  );
  const sessionEpochRef = useRef<number>(adapter.getCurrentUser()?.uid ? 1 : 0);
  const profileRunIdRef = useRef<number>(0);
  const mountCounterRef = useRef<number>(0);
  const prevLoggedSessionRef = useRef<{
    status: string;
    epoch: number;
    uid: string | null;
    reason: string;
  } | null>(null);

  // Point 5 diagnostic: log every authoritative useAuthSession status/epoch/reason transition
  useEffect(() => {
    const uid = session.user?.uid || null;
    const prev = prevLoggedSessionRef.current;
    if (
      !prev ||
      prev.status !== session.status ||
      prev.epoch !== session.epoch ||
      prev.uid !== uid ||
      prev.reason !== session.lastTransitionReason
    ) {
      logAuthDiagnostic("session_state_change", {
        fromStatus: prev?.status || null,
        toStatus: session.status,
        fromEpoch: prev?.epoch ?? null,
        toEpoch: session.epoch,
        uidHint: maskUidForDiagnostics(uid),
        initialized: session.initialized,
        authStateReady: session.authStateReady,
        confirmedByObserver: session.confirmedByObserver,
        hasAuthError: Boolean(session.authError),
        reason: session.lastTransitionReason,
      });
      prevLoggedSessionRef.current = {
        status: session.status,
        epoch: session.epoch,
        uid,
        reason: session.lastTransitionReason,
      };
    }
  }, [
    session.authError,
    session.authStateReady,
    session.confirmedByObserver,
    session.epoch,
    session.initialized,
    session.lastTransitionReason,
    session.status,
    session.user?.uid,
  ]);

  const initTimeoutMs = adapter.initTimeoutMs ?? 5000;
  const recentSignInGraceMs = adapter.recentSignInGraceMs ?? 4000;

  const runNonBlockingHydration = useCallback((authenticatedUser: AuthUserLike, force = false) => {
    const uid = authenticatedUser.uid;
    const email = authenticatedUser.email || "";

    safeSetSessionStorage("threadsworks_active_session_uid", uid);
    safeSetSessionStorage("threadsworks_active_session_email", email);

    // Deduplicate rapid duplicate callbacks (e.g. AuthScreen.onSuccess + onAuthStateChanged)
    if (!force && hydratedUidRef.current === uid) {
      return;
    }
    hydratedUidRef.current = uid;
    activeUidRef.current = uid;

    // Immediate non-blocking local fallback profile so dashboard renders instantly
    const optimisticProfile = hydrateProfileFromStorage(uid, email);
    setProfile((prev) => (prev && prev.uid === uid ? prev : optimisticProfile));

    const runId = ++profileRunIdRef.current;
    const capturedEpoch = sessionEpochRef.current;

    // Background profile ensure — errors MUST NOT affect auth state
    if (adapterRef.current.ensureProfile) {
      Promise.resolve()
        .then(() => adapterRef.current.ensureProfile!(authenticatedUser))
        .catch((err) => {
          console.warn("Background profile ensure note:", err);
        });
    }

    // Background profile fetch — stale epochs and errors MUST NOT overwrite or log out the user
    if (adapterRef.current.fetchProfile) {
      Promise.resolve()
        .then(() => adapterRef.current.fetchProfile!(uid, email))
        .then((fetched) => {
          if (
            activeUidRef.current !== uid ||
            profileRunIdRef.current !== runId ||
            sessionEpochRef.current !== capturedEpoch
          ) {
            return;
          }
          if (fetched) {
            setProfile(fetched);
          }
        })
        .catch((err) => {
          console.warn("Background profile fetch note (session preserved):", err);
        });
    }

    // Background partner referral attribution (safe against blocked storage)
    if (adapterRef.current.attributeReferral) {
      const pendingRef =
        safeGetLocalStorage("threadsworks_partner_ref") ||
        (() => {
          try {
            return typeof window !== "undefined"
              ? window.sessionStorage.getItem("threadsworks_partner_ref")
              : null;
          } catch {
            return null;
          }
        })();
      if (pendingRef) {
        Promise.resolve()
          .then(() => adapterRef.current.attributeReferral!(pendingRef))
          .catch((err) => console.warn("Background partner attribution note:", err));
      }
    }
  }, []);

  const clearSessionSideEffects = useCallback(() => {
    activeUidRef.current = null;
    hydratedUidRef.current = null;
    recentSignInRef.current = null;
    observerConfirmedUidRef.current = null;
    sessionEpochRef.current += 1;
    profileRunIdRef.current += 1;
    safeRemoveSessionStorage("threadsworks_active_session_uid");
    safeRemoveSessionStorage("threadsworks_active_session_email");
    setProfile(null);
  }, []);

  const beginAuthenticating = useCallback((method: "google" | "email" | "signup" = "google") => {
    explicitSignOutRef.current = false;
    sessionEpochRef.current += 1;
    dispatch({ type: "AUTH_START", method });
  }, []);

  const failAuthenticating = useCallback((message: string) => {
    const liveCurrentUser = adapterRef.current.getCurrentUser();
    dispatch({ type: "AUTH_ERROR", message, liveCurrentUser });
  }, []);

  const notifyLoginSuccess = useCallback(
    (authenticatedUser?: AuthUserLike | null) => {
      const liveUser = adapterRef.current.getCurrentUser();
      const resolvedUser = authenticatedUser || liveUser;
      if (!resolvedUser || !resolvedUser.uid) {
        return;
      }
      explicitSignOutRef.current = false;
      recentSignInRef.current = { uid: resolvedUser.uid, at: Date.now() };
      if (activeUidRef.current !== resolvedUser.uid) {
        sessionEpochRef.current += 1;
      }
      activeUidRef.current = resolvedUser.uid;
      authStateReadySettledRef.current = true;
      logAuthDiagnostic("firebase_user_confirmed", {
        source: "interactive_login",
        uidHint: maskUidForDiagnostics(resolvedUser.uid),
        liveCurrentUserPresent: Boolean(liveUser?.uid),
        liveUidMatches: Boolean(liveUser?.uid && liveUser.uid === resolvedUser.uid),
      });
      dispatch({ type: "LOGIN_SUCCEEDED", user: resolvedUser });
      runNonBlockingHydration(resolvedUser, false);
    },
    [runNonBlockingHydration]
  );

  const notifySignOut = useCallback(() => {
    explicitSignOutRef.current = true;
    clearSessionSideEffects();
    dispatch({ type: "SIGN_OUT" });
  }, [clearSessionSideEffects]);

  const reportBackendAuthError = useCallback(
    (message: string, endpoint?: string, statusCode?: number) => {
      logAuthDiagnostic(
        "backend_auth_outcome",
        {
          endpoint: endpoint || "unknown",
          statusCode: statusCode ?? 401,
          ok: false,
          sessionPreserved: true,
        },
        { category: "backend_authorization_failure", level: "warn" }
      );
      dispatch({ type: "BACKEND_AUTH_ERROR", message });
    },
    []
  );

  const clearBackendAuthError = useCallback(() => {
    dispatch({ type: "CLEAR_BACKEND_AUTH_ERROR" });
  }, []);

  const refreshProfile = useCallback(() => {
    const uid = activeUidRef.current;
    if (!uid) return;
    const currentUser = adapterRef.current.getCurrentUser();
    const email = currentUser?.email || session.user?.email || "";
    runNonBlockingHydration({ uid, email }, true);
  }, [runNonBlockingHydration, session.user?.email]);

  // Listen to explicit manual sign-out events dispatched by TopNav, Sidebar, DashboardView, SettingsModal
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleSignoutEvent = () => {
      notifySignOut();
    };
    window.addEventListener(AUTH_SIGNOUT_EVENT, handleSignoutEvent);
    return () => window.removeEventListener(AUTH_SIGNOUT_EVENT, handleSignoutEvent);
  }, [notifySignOut]);

  // Authoritative Firebase Auth state observer sequenced with authStateReady()
  useEffect(() => {
    let isMounted = true;
    const mountId = ++mountCounterRef.current;
    const mountStartedAt = Date.now();
    const mountEpoch = sessionEpochRef.current;
    const hasAuthStateReady = typeof adapterRef.current.waitForAuthStateReady === "function";

    logAuthDiagnostic("session_state_change", {
      lifecycle: "observer_effect_mount",
      mountId,
      mountEpoch,
      hasAuthStateReady,
      initialCurrentUserPresent: Boolean(adapterRef.current.getCurrentUser()?.uid),
    });

    // Hydrate immediately if Firebase Auth already has a synchronous currentUser
    const initialUser = adapterRef.current.getCurrentUser();
    if (initialUser && initialUser.uid) {
      authStateReadySettledRef.current = true;
      activeUidRef.current = initialUser.uid;
      dispatch({ type: "OBSERVER_USER", user: initialUser });
      runNonBlockingHydration(initialUser, false);
      if (!initialResolutionLoggedRef.current) {
        initialResolutionLoggedRef.current = true;
        logAuthDiagnostic("initial_auth_resolved", {
          source: "initial_current_user",
          hasUser: true,
          uidHint: maskUidForDiagnostics(initialUser.uid),
          durationMs: Date.now() - mountStartedAt,
        });
      }
    }

    // Proper sequencing: await Firebase's authStateReady() before treating startup nulls as logged out
    if (hasAuthStateReady) {
      Promise.resolve()
        .then(() => adapterRef.current.waitForAuthStateReady!())
        .then(() => {
          if (!isMounted) return;
          authStateReadySettledRef.current = true;
          const liveUser = adapterRef.current.getCurrentUser();
          // Ignore stale authStateReady resolution if a newer interactive session already succeeded
          if (liveUser && liveUser.uid) {
            if (activeUidRef.current !== liveUser.uid) {
              sessionEpochRef.current += 1;
            }
            activeUidRef.current = liveUser.uid;
            dispatch({ type: "AUTH_STATE_READY", liveCurrentUser: liveUser });
            runNonBlockingHydration(liveUser, false);
          } else if (sessionEpochRef.current === mountEpoch) {
            dispatch({ type: "AUTH_STATE_READY", liveCurrentUser: null });
          }
          if (!initialResolutionLoggedRef.current) {
            initialResolutionLoggedRef.current = true;
            logAuthDiagnostic("initial_auth_resolved", {
              source: "auth_state_ready",
              hasUser: Boolean(liveUser?.uid),
              uidHint: maskUidForDiagnostics(liveUser?.uid),
              durationMs: Date.now() - mountStartedAt,
            });
          }
        })
        .catch((err) => {
          if (!isMounted) return;
          authStateReadySettledRef.current = true;
          const liveUser = adapterRef.current.getCurrentUser();
          logAuthDiagnostic(
            "initial_auth_resolved",
            {
              source: "auth_state_ready_error",
              hasUser: Boolean(liveUser?.uid),
              errorCode: (err as any)?.code || "unknown",
              durationMs: Date.now() - mountStartedAt,
            },
            { category: "firebase_session_persistence_failure", level: "warn" }
          );
          if (sessionEpochRef.current === mountEpoch || (liveUser && liveUser.uid)) {
            dispatch({ type: "AUTH_STATE_READY", liveCurrentUser: liveUser });
          }
        });
    }

    // Legacy safety timer ONLY when adapter does NOT expose authStateReady() (e.g. unit mocks)
    const fallbackTimer =
      !hasAuthStateReady && initTimeoutMs > 0
        ? setTimeout(() => {
            if (!isMounted) return;
            const liveUser = adapterRef.current.getCurrentUser();
            dispatch({ type: "INIT_TIMEOUT", liveCurrentUser: liveUser });
            if (liveUser && liveUser.uid) {
              runNonBlockingHydration(liveUser, false);
            }
          }, initTimeoutMs)
        : null;

    const unsubscribe = adapterRef.current.subscribeAuthState(
      (firebaseUser) => {
        if (!isMounted) return;
        if (fallbackTimer) clearTimeout(fallbackTimer);

        const liveBeforeHandle = adapterRef.current.getCurrentUser();
        const recentSnapshot = recentSignInRef.current;
        const recentActiveSnapshot = Boolean(
          recentSnapshot &&
            observerConfirmedUidRef.current !== recentSnapshot.uid &&
            Date.now() - recentSnapshot.at < recentSignInGraceMs
        );

        // Point 4 diagnostic: log EVERY onAuthStateChanged callback verbatim (redacted)
        logAuthDiagnostic("observer_event", {
          mountId,
          callbackHasUser: Boolean(firebaseUser?.uid),
          callbackUidHint: maskUidForDiagnostics(firebaseUser?.uid),
          liveCurrentUserPresent: Boolean(liveBeforeHandle?.uid),
          liveUidHint: maskUidForDiagnostics(liveBeforeHandle?.uid),
          currentSessionStatus: sessionStatusRef.current,
          sessionEpoch: sessionEpochRef.current,
          authStateReadySettled: authStateReadySettledRef.current,
          recentSignInActive: recentActiveSnapshot,
          explicitSignOut: explicitSignOutRef.current,
        });

        if (firebaseUser && firebaseUser.uid) {
          authStateReadySettledRef.current = true;
          explicitSignOutRef.current = false;
          const isNewUser = activeUidRef.current !== firebaseUser.uid;
          if (isNewUser) {
            sessionEpochRef.current += 1;
          }
          observerConfirmedUidRef.current = firebaseUser.uid;
          recentSignInRef.current = null;
          activeUidRef.current = firebaseUser.uid;
          if (!initialResolutionLoggedRef.current) {
            initialResolutionLoggedRef.current = true;
            logAuthDiagnostic("initial_auth_resolved", {
              source: "observer_user",
              hasUser: true,
              uidHint: maskUidForDiagnostics(firebaseUser.uid),
              durationMs: Date.now() - mountStartedAt,
            });
          }
          logAuthDiagnostic("firebase_user_confirmed", {
            source: "observer",
            uidHint: maskUidForDiagnostics(firebaseUser.uid),
            isNewUser,
          });
          dispatch({ type: "OBSERVER_USER", user: firebaseUser });
          runNonBlockingHydration(firebaseUser, false);
          return;
        }

        const liveCurrentUser = adapterRef.current.getCurrentUser();
        const recent = recentSignInRef.current;
        const recentSignInActive = Boolean(
          recent &&
            observerConfirmedUidRef.current !== recent.uid &&
            Date.now() - recent.at < recentSignInGraceMs
        );

        // If authStateReady() has NOT settled yet and we are still initializing, defer null
        // rather than treating startup null as a confirmed unauthenticated redirect.
        if (
          hasAuthStateReady &&
          !authStateReadySettledRef.current &&
          !liveCurrentUser &&
          isAuthStatusInitializing(sessionStatusRef.current)
        ) {
          dispatch({
            type: "OBSERVER_NULL",
            liveCurrentUser: null,
            recentSignInActive,
            authStateReady: false,
          });
          return;
        }

        const wasAuthenticatedUid = activeUidRef.current;
        const wasExplicitSignOut = explicitSignOutRef.current;

        if (!initialResolutionLoggedRef.current && !hasAuthStateReady) {
          initialResolutionLoggedRef.current = true;
          logAuthDiagnostic("initial_auth_resolved", {
            source: "observer_null",
            hasUser: Boolean(liveCurrentUser?.uid),
            durationMs: Date.now() - mountStartedAt,
          });
        }

        dispatch({
          type: "OBSERVER_NULL",
          liveCurrentUser,
          recentSignInActive,
          authStateReady: authStateReadySettledRef.current || !hasAuthStateReady,
        });

        if (liveCurrentUser && liveCurrentUser.uid) {
          runNonBlockingHydration(liveCurrentUser, false);
        } else if (!recentSignInActive && sessionStatusRef.current !== "authenticating") {
          if (wasAuthenticatedUid && !wasExplicitSignOut) {
            logAuthDiagnostic(
              "unexpected_login_navigation",
              {
                cause: "firebase_observer_emitted_null_without_signout",
                previousUidHint: maskUidForDiagnostics(wasAuthenticatedUid),
                observerHadConfirmedUid: observerConfirmedUidRef.current === wasAuthenticatedUid,
                liveCurrentUserPresent: false,
                explicitSignOut: false,
              },
              { category: "firebase_session_persistence_failure", level: "warn" }
            );
          }
          clearSessionSideEffects();
        }
      },
      (authErr) => {
        if (!isMounted) return;
        if (fallbackTimer) clearTimeout(fallbackTimer);
        console.warn("onAuthStateChanged error:", authErr);
        const liveCurrentUser = adapterRef.current.getCurrentUser();
        const message =
          authErr instanceof Error
            ? authErr.message
            : typeof authErr === "string"
            ? authErr
            : "Authentication state could not be verified. Please sign in again.";
        logAuthDiagnostic(
          "unexpected_login_navigation",
          {
            cause: "firebase_observer_error",
            errorCode: (authErr as any)?.code || "observer_error",
            liveCurrentUserPresent: Boolean(liveCurrentUser?.uid),
          },
          { category: "firebase_authentication_failure", level: "warn" }
        );
        dispatch({
          type: "OBSERVER_ERROR",
          message,
          liveCurrentUser,
        });
        if (!liveCurrentUser) {
          clearSessionSideEffects();
        }
      }
    );

    return () => {
      isMounted = false;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      logAuthDiagnostic("session_state_change", {
        lifecycle: "observer_effect_unmount",
        mountId,
        currentSessionStatus: sessionStatusRef.current,
        sessionEpoch: sessionEpochRef.current,
      });
      unsubscribe();
    };
  }, [clearSessionSideEffects, initTimeoutMs, recentSignInGraceMs, runNonBlockingHydration]);

  return {
    ...session,
    profile,
    setProfile,
    loading: isAuthStatusInitializing(session.status),
    beginAuthenticating,
    failAuthenticating,
    notifyLoginSuccess,
    notifySignOut,
    reportBackendAuthError,
    clearBackendAuthError,
    refreshProfile,
  };
}
