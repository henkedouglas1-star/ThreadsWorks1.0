import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { UserProfile } from "../types";
import {
  AUTH_SIGNOUT_EVENT,
  AuthSessionState,
  AuthUserLike,
  createInitialAuthSessionState,
  reduceAuthSession,
} from "../lib/authContract";
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
  ensureProfile?: (user: AuthUserLike) => Promise<void>;
  fetchProfile?: (uid: string, email: string) => Promise<UserProfile | null>;
  attributeReferral?: (refCode: string) => Promise<void>;
  /** Safety timeout (ms) so loading state cannot hang forever if preview storage stalls */
  initTimeoutMs?: number;
  /** Window (ms) protecting a fresh interactive sign-in from a stale startup null callback */
  recentSignInGraceMs?: number;
}

export interface UseAuthSessionResult extends AuthSessionState {
  profile: UserProfile | null;
  setProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  loading: boolean;
  notifyLoginSuccess: (authenticatedUser?: AuthUserLike | null) => void;
  notifySignOut: () => void;
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
 * - Loading, authenticated, and unauthenticated states are cleanly separated.
 * - Profile & storage failures NEVER invalidate or block authentication.
 * - Duplicate, delayed, or out-of-order callbacks are safely deduplicated.
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

  const activeUidRef = useRef<string | null>(adapter.getCurrentUser()?.uid || null);
  const hydratedUidRef = useRef<string | null>(null);
  const recentSignInRef = useRef<{ uid: string; at: number } | null>(null);
  const observerConfirmedUidRef = useRef<string | null>(null);
  const profileRunIdRef = useRef(0);

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

    // Background profile ensure — errors MUST NOT affect auth state
    if (adapterRef.current.ensureProfile) {
      Promise.resolve()
        .then(() => adapterRef.current.ensureProfile!(authenticatedUser))
        .catch((err) => {
          console.warn("Background profile ensure note:", err);
        });
    }

    // Background profile fetch — errors or timeouts MUST NOT log out the user
    if (adapterRef.current.fetchProfile) {
      Promise.resolve()
        .then(() => adapterRef.current.fetchProfile!(uid, email))
        .then((fetched) => {
          if (activeUidRef.current !== uid || profileRunIdRef.current !== runId) return;
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
    profileRunIdRef.current += 1;
    safeRemoveSessionStorage("threadsworks_active_session_uid");
    safeRemoveSessionStorage("threadsworks_active_session_email");
    setProfile(null);
  }, []);

  const notifyLoginSuccess = useCallback(
    (authenticatedUser?: AuthUserLike | null) => {
      const resolvedUser = authenticatedUser || adapterRef.current.getCurrentUser();
      if (!resolvedUser || !resolvedUser.uid) {
        return;
      }
      recentSignInRef.current = { uid: resolvedUser.uid, at: Date.now() };
      activeUidRef.current = resolvedUser.uid;
      dispatch({ type: "LOGIN_SUCCEEDED", user: resolvedUser });
      runNonBlockingHydration(resolvedUser, false);
    },
    [runNonBlockingHydration]
  );

  const notifySignOut = useCallback(() => {
    clearSessionSideEffects();
    dispatch({ type: "SIGN_OUT" });
  }, [clearSessionSideEffects]);

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

  // Authoritative Firebase Auth state observer
  useEffect(() => {
    let isMounted = true;

    // Hydrate immediately if Firebase Auth already has a synchronous currentUser
    const initialUser = adapterRef.current.getCurrentUser();
    if (initialUser && initialUser.uid) {
      activeUidRef.current = initialUser.uid;
      dispatch({ type: "OBSERVER_USER", user: initialUser });
      runNonBlockingHydration(initialUser, false);
    }

    const fallbackTimer = setTimeout(() => {
      if (!isMounted) return;
      const liveUser = adapterRef.current.getCurrentUser();
      dispatch({ type: "INIT_TIMEOUT", liveCurrentUser: liveUser });
      if (liveUser && liveUser.uid) {
        runNonBlockingHydration(liveUser, false);
      }
    }, initTimeoutMs);

    const unsubscribe = adapterRef.current.subscribeAuthState(
      (firebaseUser) => {
        if (!isMounted) return;
        clearTimeout(fallbackTimer);

        if (firebaseUser && firebaseUser.uid) {
          observerConfirmedUidRef.current = firebaseUser.uid;
          recentSignInRef.current = null;
          activeUidRef.current = firebaseUser.uid;
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

        dispatch({
          type: "OBSERVER_NULL",
          liveCurrentUser,
          recentSignInActive,
        });

        if (liveCurrentUser && liveCurrentUser.uid) {
          runNonBlockingHydration(liveCurrentUser, false);
        } else if (!recentSignInActive) {
          clearSessionSideEffects();
        }
      },
      (authErr) => {
        if (!isMounted) return;
        clearTimeout(fallbackTimer);
        console.warn("onAuthStateChanged error:", authErr);
        const liveCurrentUser = adapterRef.current.getCurrentUser();
        const message =
          authErr instanceof Error
            ? authErr.message
            : typeof authErr === "string"
            ? authErr
            : "Authentication state could not be verified. Please sign in again.";
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
      clearTimeout(fallbackTimer);
      unsubscribe();
    };
  }, [clearSessionSideEffects, initTimeoutMs, recentSignInGraceMs, runNonBlockingHydration]);

  return {
    ...session,
    profile,
    setProfile,
    loading: session.status === "loading",
    notifyLoginSuccess,
    notifySignOut,
    refreshProfile,
  };
}
