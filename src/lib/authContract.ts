/**
 * ThreadsWorks Protected Authentication Contract
 *
 * Invariants locked by tests/authRegression.test.ts:
 * 1. Firebase Authentication is the authoritative identity source.
 * 2. Loading, authenticated, and unauthenticated states are strictly distinguished.
 * 3. Profile synchronization and browser storage failures must NEVER silently invalidate authentication.
 * 4. Authentication failures must be observable with clear user-facing diagnostics.
 * 5. No feature may bypass or duplicate the established authentication state machine.
 */

export const AUTH_CONTRACT_VERSION = "1.0.0";
export const AUTH_SIGNOUT_EVENT = "threadsworks-user-signout";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";
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
  initialized: boolean;
  lastConfirmedUid: string | null;
}

export type AuthTransitionAction =
  | { type: "LOGIN_SUCCEEDED"; user: AuthUserLike }
  | { type: "OBSERVER_USER"; user: AuthUserLike }
  | {
      type: "OBSERVER_NULL";
      liveCurrentUser: AuthUserLike | null;
      /** True only when an explicit login just succeeded and Firebase's observer has not yet confirmed that user */
      recentSignInActive: boolean;
    }
  | { type: "SIGN_OUT" }
  | { type: "OBSERVER_ERROR"; message: string; liveCurrentUser: AuthUserLike | null }
  | { type: "INIT_TIMEOUT"; liveCurrentUser: AuthUserLike | null };

export function createInitialAuthSessionState(
  initialCurrentUser: AuthUserLike | null
): AuthSessionState {
  if (initialCurrentUser && initialCurrentUser.uid) {
    return {
      status: "authenticated",
      user: initialCurrentUser,
      authError: null,
      initialized: true,
      lastConfirmedUid: initialCurrentUser.uid,
    };
  }
  return {
    status: "loading",
    user: null,
    authError: null,
    initialized: false,
    lastConfirmedUid: null,
  };
}

/**
 * Pure, deterministic state transition reducer for the ThreadsWorks auth session.
 * Prevents delayed/duplicate null callbacks or persistence hiccups from kicking an
 * authenticated user back to the login screen while preserving authoritative sign-out.
 */
export function reduceAuthSession(
  state: AuthSessionState,
  action: AuthTransitionAction
): AuthSessionState {
  switch (action.type) {
    case "LOGIN_SUCCEEDED":
    case "OBSERVER_USER":
      return {
        status: "authenticated",
        user: action.user,
        authError: null,
        initialized: true,
        lastConfirmedUid: action.user.uid,
      };

    case "OBSERVER_NULL":
      // If Firebase Auth itself still holds an active user, never drop the session.
      if (action.liveCurrentUser && action.liveCurrentUser.uid) {
        return {
          status: "authenticated",
          user: action.liveCurrentUser,
          authError: null,
          initialized: true,
          lastConfirmedUid: action.liveCurrentUser.uid,
        };
      }
      // If a fresh sign-in just completed and an earlier startup null callback arrived late,
      // preserve the authenticated session rather than snapping back to login.
      if (action.recentSignInActive && state.status === "authenticated" && state.user) {
        return {
          ...state,
          initialized: true,
        };
      }
      return {
        status: "unauthenticated",
        user: null,
        authError: null,
        initialized: true,
        lastConfirmedUid: null,
      };

    case "SIGN_OUT":
      return {
        status: "unauthenticated",
        user: null,
        authError: null,
        initialized: true,
        lastConfirmedUid: null,
      };

    case "OBSERVER_ERROR":
      if (action.liveCurrentUser && action.liveCurrentUser.uid) {
        return {
          status: "authenticated",
          user: action.liveCurrentUser,
          authError: action.message,
          initialized: true,
          lastConfirmedUid: action.liveCurrentUser.uid,
        };
      }
      return {
        status: "unauthenticated",
        user: null,
        authError: action.message,
        initialized: true,
        lastConfirmedUid: null,
      };

    case "INIT_TIMEOUT":
      if (state.status !== "loading") {
        return state;
      }
      if (action.liveCurrentUser && action.liveCurrentUser.uid) {
        return {
          status: "authenticated",
          user: action.liveCurrentUser,
          authError: null,
          initialized: true,
          lastConfirmedUid: action.liveCurrentUser.uid,
        };
      }
      return {
        status: "unauthenticated",
        user: null,
        authError: null,
        initialized: true,
        lastConfirmedUid: null,
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
 * Once authenticated, the user unconditionally enters the workspace regardless of
 * marketing path or background profile loading state.
 */
export function resolveAppScreen(params: ResolveAppScreenParams): AppScreen {
  if (params.handshakeStatus) {
    return "handshake";
  }
  if (params.authStatus === "authenticated" && params.user) {
    return "workspace";
  }
  if (params.authStatus === "loading") {
    if (params.isPublicMarketingRoute && params.authPortalMode === null) {
      return "marketing";
    }
    return "loading";
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
      code === "auth/operation-not-supported-in-this-environment" ||
      rawMessage.includes("operation-not-supported-in-this-environment")
    ) {
      return {
        code: code || "auth/operation-not-supported-in-this-environment",
        message:
          "Browser storage restrictions in this embedded window prevented Google popup completion. Try opening the preview in a new tab or sign in with email and password.",
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
