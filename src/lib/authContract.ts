/**
 * ThreadsWorks Protected Authentication Contract
 *
 * Invariants locked by tests/authRegression.test.ts:
 * 1. Firebase Authentication is the authoritative identity source.
 * 2. Initializing, authenticating, authenticated, unauthenticated, and error states are strictly distinguished.
 * 3. Profile synchronization, backend API errors, and browser storage failures must NEVER silently invalidate authentication.
 * 4. Authentication failures must be observable with clear user-facing diagnostics.
 * 5. No feature may bypass or duplicate the established authentication state machine.
 */

import type { AuthFailureCategory } from "./authDiagnostics";

export const AUTH_CONTRACT_VERSION = "2.0.0";
export const AUTH_SIGNOUT_EVENT = "threadsworks-user-signout";

export type AuthStatus =
  | "initializing"
  | "loading"
  | "unauthenticated"
  | "authenticating"
  | "authenticated"
  | "error";

export type AuthPersistenceMode = "local" | "session" | "memory";
export type AppScreen = "handshake" | "loading" | "marketing" | "auth" | "workspace";

export interface AuthUserLike {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  emailVerified?: boolean;
  isAnonymous?: boolean;
  tenantId?: string | null;
  providerData?: Array<{ providerId?: string | null; email?: string | null }>;
  getIdToken?: (forceRefresh?: boolean) => Promise<string>;
}

export interface AuthSessionState {
  status: AuthStatus;
  user: AuthUserLike | null;
  authError: string | null;
  backendAuthError: string | null;
  initialized: boolean;
  authStateReady: boolean;
  confirmedByObserver: boolean;
  lastConfirmedUid: string | null;
  epoch: number;
  lastTransitionReason: string;
}

export type AuthTransitionAction =
  | { type: "AUTH_START"; method?: "google" | "email" | "signup" }
  | { type: "AUTH_ERROR"; message: string; liveCurrentUser?: AuthUserLike | null }
  | { type: "AUTH_STATE_READY"; liveCurrentUser: AuthUserLike | null }
  | { type: "LOGIN_SUCCEEDED"; user: AuthUserLike }
  | { type: "OBSERVER_USER"; user: AuthUserLike }
  | {
      type: "OBSERVER_NULL";
      liveCurrentUser: AuthUserLike | null;
      /** True only when an explicit login just succeeded and Firebase's observer has not yet confirmed that user */
      recentSignInActive: boolean;
      /** True once auth.authStateReady() (or initial observer resolution) has settled */
      authStateReady?: boolean;
    }
  | { type: "SIGN_OUT" }
  | { type: "OBSERVER_ERROR"; message: string; liveCurrentUser: AuthUserLike | null }
  | { type: "BACKEND_AUTH_ERROR"; message: string }
  | { type: "CLEAR_BACKEND_AUTH_ERROR" }
  | { type: "INIT_TIMEOUT"; liveCurrentUser: AuthUserLike | null };

export function isAuthStatusInitializing(status: AuthStatus): boolean {
  return status === "initializing" || status === "loading";
}

export function createInitialAuthSessionState(
  initialCurrentUser: AuthUserLike | null
): AuthSessionState {
  if (initialCurrentUser && initialCurrentUser.uid) {
    return {
      status: "authenticated",
      user: initialCurrentUser,
      authError: null,
      backendAuthError: null,
      initialized: true,
      authStateReady: true,
      confirmedByObserver: false,
      lastConfirmedUid: initialCurrentUser.uid,
      epoch: 1,
      lastTransitionReason: "initial_current_user",
    };
  }
  return {
    status: "initializing",
    user: null,
    authError: null,
    backendAuthError: null,
    initialized: false,
    authStateReady: false,
    confirmedByObserver: false,
    lastConfirmedUid: null,
    epoch: 0,
    lastTransitionReason: "initial_mount",
  };
}

/**
 * Pure, deterministic state transition reducer for the ThreadsWorks auth session.
 * Prevents delayed/duplicate null callbacks, in-flight popup transitions, backend errors,
 * or persistence hiccups from kicking an authenticated user back to the login screen
 * while preserving authoritative Firebase identity and explicit sign-out.
 */
export function reduceAuthSession(
  state: AuthSessionState,
  action: AuthTransitionAction
): AuthSessionState {
  switch (action.type) {
    case "AUTH_START":
      if (state.status === "authenticated" && state.user) {
        return state;
      }
      return {
        ...state,
        status: "authenticating",
        authError: null,
        initialized: true,
        epoch: state.epoch + 1,
        lastTransitionReason: `auth_start_${action.method || "interactive"}`,
      };

    case "AUTH_ERROR":
      if (action.liveCurrentUser && action.liveCurrentUser.uid) {
        return {
          ...state,
          status: "authenticated",
          user: action.liveCurrentUser,
          authError: null,
          initialized: true,
          authStateReady: true,
          lastConfirmedUid: action.liveCurrentUser.uid,
          lastTransitionReason: "auth_error_ignored_live_user",
        };
      }
      return {
        ...state,
        status: "error",
        user: null,
        authError: action.message,
        initialized: true,
        lastConfirmedUid: null,
        epoch: state.epoch + 1,
        lastTransitionReason: "auth_error",
      };

    case "AUTH_STATE_READY":
      if (action.liveCurrentUser && action.liveCurrentUser.uid) {
        return {
          ...state,
          status: "authenticated",
          user: action.liveCurrentUser,
          authError: null,
          initialized: true,
          authStateReady: true,
          lastConfirmedUid: action.liveCurrentUser.uid,
          epoch:
            state.lastConfirmedUid === action.liveCurrentUser.uid ? state.epoch : state.epoch + 1,
          lastTransitionReason: "auth_state_ready_user",
        };
      }
      // Never abort an active interactive authentication flow (e.g. Google popup open)
      if (state.status === "authenticating") {
        return {
          ...state,
          initialized: true,
          authStateReady: true,
          lastTransitionReason: "auth_state_ready_during_authenticating",
        };
      }
      if (state.status === "authenticated" && state.user) {
        return {
          ...state,
          initialized: true,
          authStateReady: true,
          lastTransitionReason: "auth_state_ready_preserved_user",
        };
      }
      if (state.status === "error") {
        return {
          ...state,
          initialized: true,
          authStateReady: true,
          lastTransitionReason: "auth_state_ready_preserved_error",
        };
      }
      return {
        ...state,
        status: "unauthenticated",
        user: null,
        initialized: true,
        authStateReady: true,
        lastConfirmedUid: null,
        lastTransitionReason: "auth_state_ready_null",
      };

    case "LOGIN_SUCCEEDED":
      return {
        ...state,
        status: "authenticated",
        user: action.user,
        authError: null,
        backendAuthError: null,
        initialized: true,
        authStateReady: true,
        lastConfirmedUid: action.user.uid,
        epoch: state.lastConfirmedUid === action.user.uid ? state.epoch : state.epoch + 1,
        lastTransitionReason: "login_succeeded",
      };

    case "OBSERVER_USER":
      return {
        ...state,
        status: "authenticated",
        user: action.user,
        authError: null,
        initialized: true,
        authStateReady: true,
        confirmedByObserver: true,
        lastConfirmedUid: action.user.uid,
        epoch: state.lastConfirmedUid === action.user.uid ? state.epoch : state.epoch + 1,
        lastTransitionReason: "observer_user",
      };

    case "OBSERVER_NULL": {
      // If Firebase Auth itself still holds an active user, never drop the session.
      if (action.liveCurrentUser && action.liveCurrentUser.uid) {
        return {
          ...state,
          status: "authenticated",
          user: action.liveCurrentUser,
          authError: null,
          initialized: true,
          authStateReady: true,
          lastConfirmedUid: action.liveCurrentUser.uid,
          lastTransitionReason: "observer_null_ignored_live_user",
        };
      }
      // Rule A: Never treat temporary null while Firebase is still initializing authStateReady as logout.
      if (action.authStateReady === false && isAuthStatusInitializing(state.status)) {
        return {
          ...state,
          lastTransitionReason: "observer_null_deferred_until_auth_state_ready",
        };
      }
      // Rule A/C: Never bounce or clear state while an interactive sign-in popup is in flight.
      if (state.status === "authenticating") {
        return {
          ...state,
          initialized: true,
          authStateReady: action.authStateReady ?? state.authStateReady,
          lastTransitionReason: "observer_null_ignored_authenticating",
        };
      }
      // If a fresh sign-in just completed and an earlier startup null callback arrived late,
      // preserve the authenticated session rather than snapping back to login.
      if (action.recentSignInActive && state.status === "authenticated" && state.user) {
        return {
          ...state,
          initialized: true,
          authStateReady: true,
          lastTransitionReason: "observer_null_ignored_recent_signin",
        };
      }
      // Preserve an active recoverable login error message if user is already on the auth screen
      if (state.status === "error" && state.authError) {
        return {
          ...state,
          initialized: true,
          authStateReady: true,
          lastTransitionReason: "observer_null_preserved_error",
        };
      }
      return {
        ...state,
        status: "unauthenticated",
        user: null,
        authError: null,
        backendAuthError: null,
        initialized: true,
        authStateReady: true,
        confirmedByObserver: false,
        lastConfirmedUid: null,
        epoch: state.status === "authenticated" ? state.epoch + 1 : state.epoch,
        lastTransitionReason:
          state.status === "authenticated"
            ? "observer_null_dropped_authenticated_session"
            : "observer_null_unauthenticated",
      };
    }

    case "SIGN_OUT":
      return {
        status: "unauthenticated",
        user: null,
        authError: null,
        backendAuthError: null,
        initialized: true,
        authStateReady: true,
        confirmedByObserver: false,
        lastConfirmedUid: null,
        epoch: state.epoch + 1,
        lastTransitionReason: "explicit_sign_out",
      };

    case "OBSERVER_ERROR":
      if (action.liveCurrentUser && action.liveCurrentUser.uid) {
        return {
          ...state,
          status: "authenticated",
          user: action.liveCurrentUser,
          authError: action.message,
          initialized: true,
          authStateReady: true,
          lastConfirmedUid: action.liveCurrentUser.uid,
          lastTransitionReason: "observer_error_preserved_live_user",
        };
      }
      return {
        ...state,
        status: "error",
        user: null,
        authError: action.message,
        backendAuthError: null,
        initialized: true,
        authStateReady: true,
        confirmedByObserver: false,
        lastConfirmedUid: null,
        epoch: state.epoch + 1,
        lastTransitionReason: "observer_error",
      };

    case "BACKEND_AUTH_ERROR":
      // Rule B & F: Backend authorization failures MUST NOT clear Firebase authentication
      // or redirect an authenticated user back to the login screen.
      return {
        ...state,
        backendAuthError: action.message,
        lastTransitionReason: "backend_auth_error_session_preserved",
      };

    case "CLEAR_BACKEND_AUTH_ERROR":
      if (!state.backendAuthError) return state;
      return {
        ...state,
        backendAuthError: null,
        lastTransitionReason: "clear_backend_auth_error",
      };

    case "INIT_TIMEOUT":
      if (!isAuthStatusInitializing(state.status)) {
        return state;
      }
      if (action.liveCurrentUser && action.liveCurrentUser.uid) {
        return {
          ...state,
          status: "authenticated",
          user: action.liveCurrentUser,
          authError: null,
          initialized: true,
          authStateReady: true,
          lastConfirmedUid: action.liveCurrentUser.uid,
          epoch: state.epoch + 1,
          lastTransitionReason: "init_timeout_live_user",
        };
      }
      return {
        ...state,
        status: "unauthenticated",
        user: null,
        authError: null,
        initialized: true,
        authStateReady: true,
        lastConfirmedUid: null,
        lastTransitionReason: "init_timeout_unauthenticated",
      };

    default:
      return state;
  }
}

export interface ResolveAppScreenParams {
  authStatus: AuthStatus;
  user: AuthUserLike | null;
  handshakeStatus: string | null;
  isPublicMarketingRoute: boolean;
  authPortalMode: "signin" | "signup" | null;
}

/**
 * Single authoritative screen selector preventing login/dashboard redirect loops.
 * - Never routes a protected path to login while Firebase Auth is initializing.
 * - Never unmounts AuthScreen during an active interactive popup authentication.
 * - Once Firebase confirms an authenticated user, the user unconditionally enters the workspace.
 */
export function resolveAppScreen(params: ResolveAppScreenParams): AppScreen {
  if (params.handshakeStatus) {
    return "handshake";
  }
  if (params.authStatus === "authenticated" && params.user) {
    return "workspace";
  }
  if (isAuthStatusInitializing(params.authStatus)) {
    if (params.isPublicMarketingRoute && params.authPortalMode === null) {
      return "marketing";
    }
    return "loading";
  }
  if (params.authStatus === "authenticating") {
    return "auth";
  }
  if (params.isPublicMarketingRoute && params.authPortalMode === null) {
    return "marketing";
  }
  return "auth";
}

export interface AuthPersistenceResult {
  mode: AuthPersistenceMode;
  fallbackUsed: boolean;
  errors: string[];
}

/**
 * Ordered browser persistence degradation for embedded preview iframes:
 * browserLocalPersistence -> browserSessionPersistence -> inMemoryPersistence.
 * Never throws so authentication can always proceed even when browser storage is blocked.
 */
export async function configureAuthPersistenceWithFallback<TAuth, TPersistence>(
  authInstance: TAuth,
  setPersistenceFn: (auth: TAuth, persistence: TPersistence) => Promise<void>,
  persistences: {
    local: TPersistence;
    session: TPersistence;
    memory: TPersistence;
  }
): Promise<AuthPersistenceResult> {
  const errors: string[] = [];
  const candidates: Array<{ mode: AuthPersistenceMode; persistence: TPersistence }> = [
    { mode: "local", persistence: persistences.local },
    { mode: "session", persistence: persistences.session },
    { mode: "memory", persistence: persistences.memory },
  ];

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    try {
      await setPersistenceFn(authInstance, candidate.persistence);
      return {
        mode: candidate.mode,
        fallbackUsed: i > 0,
        errors,
      };
    } catch (err: any) {
      const msg = err?.code || err?.message || String(err);
      errors.push(`${candidate.mode}: ${msg}`);
    }
  }

  return {
    mode: "memory",
    fallbackUsed: true,
    errors,
  };
}

/**
 * Classifies a Firebase or browser authentication failure into one of the six
 * diagnostic root-cause categories for troubleshooting preview vs production issues.
 */
export function classifyFirebaseAuthFailure(err: any): AuthFailureCategory {
  const code = String(err?.code || "");
  const rawMessage = String(err?.message || err || "");

  if (
    code === "auth/web-storage-unsupported" ||
    code === "auth/operation-not-supported-in-this-environment" ||
    code === "auth/popup-blocked" ||
    rawMessage.includes("web-storage-unsupported") ||
    rawMessage.includes("operation-not-supported-in-this-environment")
  ) {
    return "browser_or_preview_environment_restriction";
  }
  if (
    code === "auth/unauthorized-domain" ||
    code === "auth/popup-closed-by-user" ||
    code === "auth/cancelled-popup-request" ||
    code === "auth/invalid-credential" ||
    code === "auth/network-request-failed" ||
    code.startsWith("auth/")
  ) {
    return "firebase_authentication_failure";
  }
  if (rawMessage.toLowerCase().includes("persistence") || rawMessage.toLowerCase().includes("storage")) {
    return "firebase_session_persistence_failure";
  }
  return "firebase_authentication_failure";
}

/**
 * Formats Firebase authentication errors into clear, observable messages so real
 * authentication failures are never swallowed or disguised as silent login loops.
 */
export function formatFirebaseAuthError(
  err: any,
  context: "google" | "signin" | "signup" | "reset"
): { code: string; message: string } {
  const code = String(err?.code || "");
  const rawMessage = String(err?.message || err || "");

  if (context === "google") {
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
      return {
        code,
        message: "Google Sign-In was canceled before completing. Please try again.",
      };
    }
    if (code === "auth/popup-blocked") {
      return {
        code,
        message:
          "Google Sign-In popup was blocked by your browser. Please allow popups for this preview or sign in with email and password above.",
      };
    }
    if (code === "auth/unauthorized-domain" || rawMessage.includes("unauthorized-domain")) {
      return {
        code: code || "auth/unauthorized-domain",
        message:
          "This preview domain is not authorized for Google Sign-In in Firebase Authentication. Authorize this host in Firebase Console or sign in with email and password.",
      };
    }
    if (
      code === "auth/web-storage-unsupported" ||
      rawMessage.includes("web-storage-unsupported") ||
      code === "auth/operation-not-supported-in-this-environment" ||
      rawMessage.includes("operation-not-supported-in-this-environment")
    ) {
      return {
        code: code || "auth/operation-not-supported-in-this-environment",
        message:
          "Browser storage restrictions in this embedded window prevented Google popup completion. Allow third-party storage/cookies for this preview or sign in with email and password.",
      };
    }
    if (code === "auth/network-request-failed" || rawMessage.includes("network-request-failed")) {
      return {
        code: code || "auth/network-request-failed",
        message: "Network error while contacting Firebase Authentication. Please check your connection and try again.",
      };
    }
    return {
      code: code || rawMessage,
      message: code
        ? `Unable to complete Google Sign-In (${code}). Please try again or sign in with email and password above.`
        : "Unable to complete Google Sign-In in this window. Please sign in with email and password above.",
    };
  }

  if (context === "reset") {
    if (code === "auth/user-not-found" || rawMessage.includes("user-not-found")) {
      return {
        code,
        message: "No account found with this email address. Please check your spelling or sign up below.",
      };
    }
    if (code === "auth/invalid-email" || rawMessage.includes("invalid-email")) {
      return {
        code,
        message: "Please enter a valid email address.",
      };
    }
    return {
      code: code || rawMessage,
      message: "Failed to send password reset email. Please verify your email and try again.",
    };
  }

  if (code === "auth/email-already-in-use" || rawMessage.includes("auth/email-already-in-use")) {
    return { code, message: "This email is already in use. Try signing in instead." };
  }
  if (code === "auth/wrong-password" || rawMessage.includes("auth/wrong-password")) {
    return { code, message: "Incorrect password. Please check your password and try again." };
  }
  if (
    code === "auth/invalid-credential" ||
    code === "auth/user-not-found" ||
    code === "auth/invalid-login-credentials" ||
    rawMessage.includes("auth/invalid-credential") ||
    rawMessage.includes("invalid-credential")
  ) {
    return {
      code,
      message:
        context === "signup"
          ? "Invalid details during registration. Please make sure your email format is valid and password is at least 6 characters."
          : "Invalid email or password. If you haven't created an account yet, switch to 'Sign Up' below.",
    };
  }
  if (code === "auth/weak-password" || rawMessage.includes("auth/weak-password")) {
    return { code, message: "Password must be at least 6 characters long." };
  }
  if (code === "auth/invalid-email" || rawMessage.includes("auth/invalid-email")) {
    return { code, message: "Please provide a valid email address." };
  }
  if (code === "auth/too-many-requests" || rawMessage.includes("auth/too-many-requests")) {
    return {
      code,
      message: "Too many unsuccessful sign-in attempts. Please wait a few minutes or reset your password.",
    };
  }
  if (code === "auth/operation-not-allowed" || rawMessage.includes("auth/operation-not-allowed")) {
    return {
      code,
      message: "Email/Password sign-ins are not enabled in this Firebase project. Please use 'Sign in with Google' below!",
    };
  }
  if (code === "auth/network-request-failed" || rawMessage.includes("network-request-failed")) {
    return {
      code: code || "auth/network-request-failed",
      message: "Network error while signing in. Please check your connection and try again.",
    };
  }
  if (rawMessage && !rawMessage.startsWith("Firebase:")) {
    return { code: code || rawMessage, message: rawMessage };
  }
  return {
    code: code || rawMessage,
    message: "An authentication error occurred. Please check your credentials.",
  };
}
