import React, { useState } from "react";
import {
  auth,
  authPersistenceReady,
  db,
  ensureGoogleUserProfile,
  getFirebaseAuthDiagnosticsMeta,
  resolvedAuthPersistenceMode,
  withTimeout,
} from "../firebase";
import ThreadsWorksLogo from "./ThreadsWorksLogo";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  sendPasswordResetEmail, 
  GoogleAuthProvider 
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { Send, LogIn, UserPlus, CheckCircle, KeyRound, ArrowLeft, Copy, Check } from "lucide-react";
import {
  AuthStatus,
  AuthUserLike,
  classifyFirebaseAuthFailure,
  formatFirebaseAuthError,
} from "../lib/authContract";
import {
  detectEmbeddedPreviewContext,
  formatAuthDiagnosticsReport,
  isAuthDiagnosticsEnabled,
  logAuthDiagnostic,
  maskUidForDiagnostics,
  startAuthCorrelation,
} from "../lib/authDiagnostics";
import {
  PREVIEW_BRIDGE_CANCELLED_MESSAGE,
  PREVIEW_BRIDGE_READY_MESSAGE,
  claimPreviewHandoff,
  clearPendingPreviewHandoff,
  createPendingPreviewHandoff,
  isEmbeddedAiStudioPreview,
  registerPreviewHandoff,
  setActivePreviewHandoffClaim,
  signInIframeWithGoogleCredential,
} from "../lib/previewGoogleHandoff";

export interface AuthScreenActions {
  waitForPersistence?: () => Promise<unknown>;
  signInWithGooglePopup?: () => Promise<{ user: AuthUserLike | null }>;
  signInWithEmail?: (email: string, password: string) => Promise<{ user: AuthUserLike | null }>;
  signUpWithEmail?: (email: string, password: string) => Promise<{ user: AuthUserLike | null }>;
  sendPasswordReset?: (email: string) => Promise<void>;
  ensureGoogleProfile?: (user: AuthUserLike) => Promise<void>;
  initializeSignupProfile?: (user: AuthUserLike, fields: { offer: string; audience: string; desiredResult: string }) => Promise<void>;
}

interface AuthScreenProps {
  onSuccess: (user?: AuthUserLike | null) => void;
  onAuthStart?: (method: "google" | "email" | "signup") => void;
  onAuthError?: (message: string) => void;
  authStatus?: AuthStatus;
  initialMode?: "signin" | "signup";
  onBackToMarketing?: () => void;
  externalError?: string | null;
  authActions?: AuthScreenActions;
}

async function waitBoundedPersistence(waitFn?: () => Promise<unknown>): Promise<void> {
  const target = waitFn ? waitFn() : authPersistenceReady;
  try {
    await Promise.race([
      target,
      new Promise<void>((resolve) => setTimeout(resolve, 1500)),
    ]);
  } catch {
    // Persistence fallback errors must never block interactive authentication
  }
}

export default function AuthScreen({
  onSuccess,
  onAuthStart,
  onAuthError,
  authStatus,
  initialMode = "signin",
  onBackToMarketing,
  externalError,
  authActions,
}: AuthScreenProps) {
  const [isSignUp, setIsSignUp] = useState(initialMode === "signup");
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // Default parameters for new signups
  const [offer, setOffer] = useState("");
  const [audience, setAudience] = useState("");
  const [desiredResult, setDesiredResult] = useState("");
  const [diagCopyState, setDiagCopyState] = useState<"idle" | "copied" | "fallback">("idle");
  const [diagReportText, setDiagReportText] = useState("");
  const [diagPanelOpen, setDiagPanelOpen] = useState(false);

  const showDevDiagnostics = isAuthDiagnosticsEnabled();
  const isBusy = loading || authStatus === "authenticating";
  const activeError = error || externalError || "";

  const handleCopyAuthDiagnostics = () => {
    const report = formatAuthDiagnosticsReport({
      ...getFirebaseAuthDiagnosticsMeta(),
      authStatusProp: authStatus || "unknown",
      authScreenLoading: loading,
      authScreenBusy: isBusy,
      authScreenErrorCode: errorCode || null,
      hasVisibleErrorBanner: Boolean(activeError),
    });
    // Always open the selectable read-only panel synchronously first so blocked/hanging
    // iframe clipboard permissions never make the button appear dead or unclickable.
    setDiagReportText(report);
    setDiagPanelOpen(true);

    let copied = false;
    if (typeof document !== "undefined") {
      try {
        const el = document.createElement("textarea");
        el.value = report;
        el.setAttribute("readonly", "");
        el.style.position = "fixed";
        el.style.opacity = "0";
        document.body.appendChild(el);
        el.select();
        copied = document.execCommand("copy");
        document.body.removeChild(el);
      } catch {
        copied = false;
      }
    }

    if (copied) {
      setDiagCopyState("copied");
      setTimeout(() => setDiagCopyState("idle"), 2500);
      return;
    }

    setDiagCopyState("fallback");
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      Promise.race([
        navigator.clipboard.writeText(report).then(() => true),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 400)),
      ])
        .then((asyncCopied) => {
          if (asyncCopied) {
            setDiagCopyState("copied");
            setTimeout(() => setDiagCopyState("idle"), 2500);
          }
        })
        .catch(() => {
          // Keep fallback textarea visible
        });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setErrorCode("");
    setLoading(true);

    if (!email || !password) {
      setError("Please fill in email and password.");
      setLoading(false);
      return;
    }

    const authMethod = isSignUp ? "signup" : "email";
    onAuthStart?.(authMethod);

    try {
      await waitBoundedPersistence(authActions?.waitForPersistence);

      if (isSignUp) {
        // Validation check for sign up defaults
        if (!offer || !audience || !desiredResult) {
          setError("Please complete the basic profile fields below to personalize your Content Engine.");
          setLoading(false);
          return;
        }

        // Create Firebase Authentication User
        const userCredential = authActions?.signUpWithEmail
          ? await authActions.signUpWithEmail(email.trim(), password)
          : await createUserWithEmailAndPassword(auth, email.trim(), password);
        const user = userCredential?.user || auth.currentUser;

        if (!user) {
          const msg = "Account creation completed without an active user session. Please sign in.";
          setError(msg);
          onAuthError?.(msg);
          return;
        }

        // Initialize Firestore User Profile & Settings in background so slow/blocked Firestore never blocks dashboard entry
        if (authActions?.initializeSignupProfile) {
          authActions
            .initializeSignupProfile(user, { offer, audience, desiredResult })
            .catch((dbErr) => console.warn("Could not initialize signup profile:", dbErr));
        } else {
          Promise.all([
            withTimeout(
              setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                email: user.email,
                offer,
                audience,
                desiredResult,
                writingStyle: "Direct, high-value, casual, authoritative",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }),
              2500,
              true
            ).catch((dbErr) => {
              console.warn("Could not write Firestore profile document during sign up:", dbErr);
            }),
            withTimeout(
              setDoc(doc(db, "settings", user.uid), {
                offer,
                audience,
                desiredResult,
                writingStyle: "Direct, high-value, casual, authoritative",
              }),
              2500,
              true
            ).catch((statusErr) => {
              console.warn("Could not write Firestore settings document during sign up:", statusErr);
            }),
          ]).catch(() => {});
        }

        onSuccess(user);
        return;
      } else {
        // Standard Email/Password Sign In
        const userCredential = authActions?.signInWithEmail
          ? await authActions.signInWithEmail(email.trim(), password)
          : await signInWithEmailAndPassword(auth, email.trim(), password);
        const user = userCredential?.user || auth.currentUser;
        if (user) {
          onSuccess(user);
          return;
        }
        const msg = "Sign-in completed without returning a user session. Please try again.";
        setError(msg);
        onAuthError?.(msg);
      }
    } catch (err: any) {
      console.warn("Auth note:", err?.code || err?.message || err);
      const formatted = formatFirebaseAuthError(err, isSignUp ? "signup" : "signin");
      setErrorCode(formatted.code);
      setError(formatted.message);
      onAuthError?.(formatted.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setErrorCode("");
    setResetSuccess("");
    setLoading(true);

    const correlationId = startAuthCorrelation("google_popup");
    const previewCtx = detectEmbeddedPreviewContext();
    const firebaseMeta = getFirebaseAuthDiagnosticsMeta();

    logAuthDiagnostic(
      "google_popup_start",
      {
        persistenceMode: resolvedAuthPersistenceMode,
        inIframe: previewCtx.inIframe,
        isCrossOriginParent: previewCtx.isCrossOriginParent,
        hostname: previewCtx.hostname,
        pathname: previewCtx.pathname,
        authStatusAtClick: authStatus || "unknown",
        initialCurrentUserPresent: Boolean(auth.currentUser?.uid),
        firebaseAppCount: firebaseMeta.firebaseAppCount,
        authInstanceId: firebaseMeta.authInstanceId,
      },
      { correlationId }
    );

    logAuthDiagnostic(
      "auth_screen_callback",
      { callback: "onAuthStart", method: "google" },
      { correlationId }
    );
    onAuthStart?.("google");

    const popupStartedAt = Date.now();
    let popupPendingTimer: ReturnType<typeof setTimeout> | null = null;

    try {
      let userCredential: { user: AuthUserLike | null };
      const usingMockPopupAction = Boolean(authActions?.signInWithGooglePopup);

      if (!usingMockPopupAction && isEmbeddedAiStudioPreview()) {
        // AI Studio Preview embedded iframe path:
        // Open a top-level bridge window synchronously (zero prior await) so real Google
        // signInWithPopup runs outside the cross-origin iframe and survives any Preview
        // wrapper / applet-auth-bridge iframe re-navigation via sessionStorage handoff.
        const handoff = createPendingPreviewHandoff();
        setActivePreviewHandoffClaim(handoff.handoffId);
        try {
          const bridgePopup = window.open(
            handoff.bridgeUrl,
            "tw_google_auth_bridge",
            "width=520,height=640,menubar=no,toolbar=no,status=no,resizable=yes,scrollbars=yes"
          );
          if (!bridgePopup) {
            clearPendingPreviewHandoff();
            logAuthDiagnostic(
              "preview_handoff_lifecycle",
              { phase: "bridge_popup_blocked", handoffIdPrefix: `${handoff.handoffId.slice(0, 8)}...` },
              { correlationId, level: "warn" }
            );
            const blockedErr: any = new Error("Firebase: Error (auth/popup-blocked).");
            blockedErr.code = "auth/popup-blocked";
            throw blockedErr;
          }
          logAuthDiagnostic(
            "preview_handoff_lifecycle",
            { phase: "bridge_popup_opened", handoffIdPrefix: `${handoff.handoffId.slice(0, 8)}...` },
            { correlationId }
          );
          try {
            bridgePopup.focus();
          } catch {
            // Ignore focus errors in strict browsers
          }

          const registered = await registerPreviewHandoff(handoff.handoffId, handoff.claimSecret);
          if (!registered) {
            clearPendingPreviewHandoff();
            throw new Error("Could not initialize AI Studio Preview Google sign-in handoff. Please try again.");
          }

          const claimed = await new Promise<{
            googleIdToken: string | null;
            googleAccessToken: string | null;
          }>((resolve, reject) => {
            let settled = false;
            let inFlightClaim = false;
            let closedGraceTimer: ReturnType<typeof setTimeout> | null = null;
            const startedAt = Date.now();

            const finish = (fn: () => void) => {
              if (settled) return;
              settled = true;
              window.removeEventListener("message", onMessage);
              document.removeEventListener("visibilitychange", onVisibility);
              clearInterval(pollTimer);
              if (closedGraceTimer) clearTimeout(closedGraceTimer);
              fn();
            };

            const tryClaim = async () => {
              if (settled || inFlightClaim) return;
              inFlightClaim = true;
              try {
                const res = await claimPreviewHandoff(handoff.handoffId, handoff.claimSecret);
                if (res.status === "ready") {
                  finish(() =>
                    resolve({
                      googleIdToken: res.googleIdToken,
                      googleAccessToken: res.googleAccessToken,
                    })
                  );
                } else if (res.status === "cancelled") {
                  finish(() => {
                    const err: any = new Error("Firebase: Error (auth/popup-closed-by-user).");
                    err.code = "auth/popup-closed-by-user";
                    reject(err);
                  });
                } else if (res.status === "expired" || res.status === "forbidden") {
                  finish(() =>
                    reject(new Error("Google Sign-In handoff expired. Please click Sign in with Google again."))
                  );
                }
              } catch {
                // Retry on next poll / visibility event
              } finally {
                inFlightClaim = false;
              }
            };

            const onMessage = (event: MessageEvent) => {
              if (event.origin !== window.location.origin) return;
              if (event.data?.handoffId !== handoff.handoffId) return;
              if (event.data?.type === PREVIEW_BRIDGE_READY_MESSAGE) {
                void tryClaim();
              } else if (event.data?.type === PREVIEW_BRIDGE_CANCELLED_MESSAGE) {
                finish(() => {
                  const err: any = new Error("Firebase: Error (auth/popup-closed-by-user).");
                  err.code = "auth/popup-closed-by-user";
                  reject(err);
                });
              }
            };

            const onVisibility = () => {
              if (document.visibilityState === "visible") {
                void tryClaim();
              }
            };

            window.addEventListener("message", onMessage);
            document.addEventListener("visibilitychange", onVisibility);

            const pollTimer = setInterval(() => {
              void tryClaim();
              if (Date.now() - startedAt > 175_000) {
                finish(() =>
                  reject(new Error("Google Sign-In timed out before completing. Please try again."))
                );
                return;
              }
              if (bridgePopup.closed && !closedGraceTimer) {
                closedGraceTimer = setTimeout(() => {
                  void tryClaim().finally(() => {
                    finish(() => {
                      const err: any = new Error("Firebase: Error (auth/popup-closed-by-user).");
                      err.code = "auth/popup-closed-by-user";
                      reject(err);
                    });
                  });
                }, 3500);
              }
            }, 1200);
          });

          clearPendingPreviewHandoff();
          const confirmedUser = await signInIframeWithGoogleCredential(
            auth,
            claimed.googleIdToken,
            claimed.googleAccessToken,
            correlationId
          );
          if (!confirmedUser) {
            throw new Error("Google Sign-In completed, but Firebase could not establish the session in this window.");
          }

          const ensureProfileFn = authActions?.ensureGoogleProfile || ensureGoogleUserProfile;
          Promise.resolve()
            .then(() => ensureProfileFn(confirmedUser))
            .catch((e) => {
              console.warn("Non-blocking Google profile initialization note:", e);
            });
          logAuthDiagnostic(
            "auth_screen_callback",
            { callback: "onSuccess", uidHint: maskUidForDiagnostics(confirmedUser.uid), via: "preview_top_level_bridge" },
            { correlationId }
          );
          onSuccess(confirmedUser);
          return;
        } finally {
          setActivePreviewHandoffClaim(null);
        }
      }

      if (usingMockPopupAction) {
        if (authActions?.waitForPersistence) {
          await waitBoundedPersistence(authActions.waitForPersistence);
        }
        userCredential = await authActions!.signInWithGooglePopup!();
      } else {
        // CRITICAL FOR GAS PREVIEW & STRICT BROWSERS:
        // Invoke signInWithPopup() synchronously inside the click handler with ZERO prior await,
        // preserving transient user activation so the browser keeps popup window.opener intact.
        // Persistence was already configured synchronously in initializeAuth().
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });
        const popupPromise = signInWithPopup(auth, provider);

        // Purely observational marker if signInWithPopup stays pending for 10s (never alters auth state)
        if (showDevDiagnostics) {
          popupPendingTimer = setTimeout(() => {
            logAuthDiagnostic(
              "popup_still_pending",
              {
                elapsedMs: Date.now() - popupStartedAt,
                currentUserPresent: Boolean(auth.currentUser?.uid),
                visibilityState: typeof document !== "undefined" ? document.visibilityState : "unknown",
                hasFocus:
                  typeof document !== "undefined" && typeof document.hasFocus === "function"
                    ? document.hasFocus()
                    : null,
              },
              { correlationId, level: "warn" }
            );
          }, 10000);
        }

        userCredential = await popupPromise.then(
          (cred) => {
            logAuthDiagnostic(
              "popup_promise_settled",
              {
                outcome: "resolved",
                elapsedMs: Date.now() - popupStartedAt,
                hasCredentialUser: Boolean(cred?.user?.uid),
                credentialUidHint: maskUidForDiagnostics(cred?.user?.uid),
                currentUserAtSettle: Boolean(auth.currentUser?.uid),
                currentUserUidHint: maskUidForDiagnostics(auth.currentUser?.uid),
                visibilityState: typeof document !== "undefined" ? document.visibilityState : "unknown",
                hasFocus:
                  typeof document !== "undefined" && typeof document.hasFocus === "function"
                    ? document.hasFocus()
                    : null,
              },
              { correlationId }
            );
            return cred;
          },
          (err: any) => {
            logAuthDiagnostic(
              "popup_promise_settled",
              {
                outcome: "rejected",
                elapsedMs: Date.now() - popupStartedAt,
                errorCode: String(err?.code || "unknown"),
                errorName: String(err?.name || "Error"),
                currentUserAtSettle: Boolean(auth.currentUser?.uid),
                visibilityState: typeof document !== "undefined" ? document.visibilityState : "unknown",
                hasFocus:
                  typeof document !== "undefined" && typeof document.hasFocus === "function"
                    ? document.hasFocus()
                    : null,
              },
              { correlationId, level: "warn" }
            );
            throw err;
          }
        );
      }

      const credentialUser = userCredential?.user || null;

      // For real Firebase Auth, verify Firebase actually retained the session on auth.currentUser
      if (!usingMockPopupAction) {
        // Point 3 diagnostic: capture auth.currentUser IMMEDIATELY after popup completion
        const immediateCurrentUser = auth.currentUser;
        const hadAuthStateReadyFn = typeof (auth as any).authStateReady === "function";
        if (hadAuthStateReadyFn) {
          await auth.authStateReady();
        }
        // Point 3 diagnostic: capture auth.currentUser AFTER auth.authStateReady()
        const postReadyCurrentUser = auth.currentUser;

        logAuthDiagnostic(
          "google_popup_complete",
          {
            hasCredentialUser: Boolean(credentialUser?.uid),
            credentialUidHint: maskUidForDiagnostics(credentialUser?.uid),
            immediateCurrentUserPresent: Boolean(immediateCurrentUser?.uid),
            immediateCurrentUserUidHint: maskUidForDiagnostics(immediateCurrentUser?.uid),
            postReadyCurrentUserPresent: Boolean(postReadyCurrentUser?.uid),
            postReadyCurrentUserUidHint: maskUidForDiagnostics(postReadyCurrentUser?.uid),
            hasLiveCurrentUser: Boolean(postReadyCurrentUser?.uid),
            uidMatch: Boolean(
              credentialUser?.uid &&
                postReadyCurrentUser?.uid &&
                credentialUser.uid === postReadyCurrentUser.uid
            ),
            uidHint: maskUidForDiagnostics(postReadyCurrentUser?.uid || credentialUser?.uid),
            persistenceMode: resolvedAuthPersistenceMode,
            inIframe: previewCtx.inIframe,
            firebaseAppCount: getFirebaseAuthDiagnosticsMeta().firebaseAppCount,
          },
          { correlationId }
        );

        const confirmedUser = postReadyCurrentUser || credentialUser || null;
        if (!confirmedUser) {
          const msg =
            "Google Sign-In completed, but Firebase could not retain the authenticated session in this browser window. Allow third-party storage/cookies for this preview or open ThreadsWorks in a top-level tab.";
          logAuthDiagnostic(
            "google_popup_failed",
            {
              reason: "credential_returned_but_firebase_current_user_null",
              hasCredentialUser: Boolean(credentialUser?.uid),
              immediateCurrentUserPresent: Boolean(immediateCurrentUser?.uid),
              postReadyCurrentUserPresent: false,
              persistenceMode: resolvedAuthPersistenceMode,
              inIframe: previewCtx.inIframe,
            },
            {
              correlationId,
              category: "firebase_session_persistence_failure",
              level: "warn",
            }
          );
          setErrorCode("auth/session-not-retained");
          setError(msg);
          logAuthDiagnostic(
            "auth_screen_callback",
            { callback: "onAuthError", errorCode: "auth/session-not-retained" },
            { correlationId, level: "warn" }
          );
          onAuthError?.(msg);
          return;
        }

        const ensureProfileFn = authActions?.ensureGoogleProfile || ensureGoogleUserProfile;
        Promise.resolve()
          .then(() => ensureProfileFn(confirmedUser))
          .catch((e) => {
            console.warn("Non-blocking Google profile initialization note:", e);
          });
        logAuthDiagnostic(
          "auth_screen_callback",
          {
            callback: "onSuccess",
            uidHint: maskUidForDiagnostics(confirmedUser.uid),
          },
          { correlationId }
        );
        onSuccess(confirmedUser);
        return;
      }

      // Mocked unit test path
      const mockUser = credentialUser || auth.currentUser;
      if (mockUser) {
        logAuthDiagnostic(
          "google_popup_complete",
          {
            hasCredentialUser: Boolean(credentialUser?.uid),
            hasLiveCurrentUser: Boolean(mockUser?.uid),
            uidMatch: true,
            uidHint: maskUidForDiagnostics(mockUser.uid),
            persistenceMode: resolvedAuthPersistenceMode,
            inIframe: previewCtx.inIframe,
          },
          { correlationId }
        );
        const ensureProfileFn = authActions?.ensureGoogleProfile || ensureGoogleUserProfile;
        Promise.resolve()
          .then(() => ensureProfileFn(mockUser))
          .catch((e) => {
            console.warn("Non-blocking Google profile initialization note:", e);
          });
        logAuthDiagnostic(
          "auth_screen_callback",
          { callback: "onSuccess", uidHint: maskUidForDiagnostics(mockUser.uid) },
          { correlationId }
        );
        onSuccess(mockUser);
        return;
      }

      const missingUserMsg =
        "Google Sign-In did not return an authenticated user. Please try again.";
      setError(missingUserMsg);
      logAuthDiagnostic(
        "auth_screen_callback",
        { callback: "onAuthError", errorCode: "auth/missing-user" },
        { correlationId, level: "warn" }
      );
      onAuthError?.(missingUserMsg);
    } catch (popupErr: any) {
      const formatted = formatFirebaseAuthError(popupErr, "google");
      const category = classifyFirebaseAuthFailure(popupErr);
      logAuthDiagnostic(
        "google_popup_failed",
        {
          errorCode: formatted.code || "unknown",
          rawErrorName: popupErr?.name || "Error",
          immediateCurrentUserPresent: Boolean(auth.currentUser?.uid),
          persistenceMode: resolvedAuthPersistenceMode,
          inIframe: previewCtx.inIframe,
          hostname: previewCtx.hostname,
        },
        { correlationId, category, level: "warn" }
      );
      console.warn("Google Auth popup note:", formatted.code, popupErr?.message || popupErr);
      setErrorCode(formatted.code);
      setError(formatted.message);
      logAuthDiagnostic(
        "auth_screen_callback",
        { callback: "onAuthError", errorCode: formatted.code || "unknown" },
        { correlationId, level: "warn" }
      );
      onAuthError?.(formatted.message);
    } finally {
      if (popupPendingTimer) {
        clearTimeout(popupPendingTimer);
      }
      setLoading(false);
    }
  };

  const handleInstantPreviewLogin = () => {
    const previewUser = {
      uid: "preview_test_creator_01",
      email: "henkedouglas1@gmail.com",
      displayName: "Douglas Henke"
    };
    logAuthDiagnostic("auth_screen_callback", { callback: "onSuccess", uidHint: "preview_test_creator_01", via: "instant_preview_login" });
    onSuccess(previewUser as any);
  };

  const handleOpenNewTab = () => {
    if (typeof window !== "undefined") {
      window.open(window.location.href, '_blank');
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setErrorCode("");
    setResetSuccess("");

    if (!email) {
      setError("Please enter your registered email address to receive a password reset link.");
      return;
    }

    setLoading(true);
    try {
      if (authActions?.sendPasswordReset) {
        await authActions.sendPasswordReset(email.trim());
      } else {
        await sendPasswordResetEmail(auth, email.trim());
      }
      setResetSuccess(`Password reset email sent to ${email}. Please check your inbox and spam folder.`);
    } catch (err: any) {
      console.warn("Password reset note:", err?.code || err?.message || err);
      const formatted = formatFirebaseAuthError(err, "reset");
      setErrorCode(formatted.code);
      setError(formatted.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      data-theme="dark"
      className="dark relative min-h-screen w-full flex flex-col items-center justify-center bg-[#030206] px-4 py-8 md:py-12 text-zinc-100 overflow-x-hidden selection:bg-purple-500/30"
    >
      
      {/* 1080p HD Multi-layer Atmospheric Background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Deep radial dark background base */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#120626_0%,_#05020c_50%,_#030106_100%)]" />

        {/* Primary Ambient Purple Light Glow behind Header */}
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[750px] h-[750px] bg-purple-600/20 blur-[160px] rounded-full" />
        
        {/* Secondary Indigo Atmospheric Ambient Light */}
        <div className="absolute -bottom-48 right-1/4 w-[650px] h-[650px] bg-indigo-600/15 blur-[170px] rounded-full" />

        {/* Faint Vector SVG Orbit Curves (Crisp 1080p Scalable) */}
        <svg className="absolute inset-0 w-full h-full opacity-25 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50%" cy="42%" r="340" fill="none" stroke="url(#hdOrbitGrad)" strokeWidth="1" strokeDasharray="4 12" />
          <circle cx="50%" cy="42%" r="520" fill="none" stroke="url(#hdOrbitGrad)" strokeWidth="1" opacity="0.4" />
          <path d="M -200 300 Q 500 100 1400 700" fill="none" stroke="url(#hdOrbitGrad)" strokeWidth="1.5" opacity="0.25" />
          <defs>
            <linearGradient id="hdOrbitGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#C084FC" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#818CF8" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#C084FC" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>

        {/* Subtle Vignette Overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_40%,_#030206_95%)]" />
      </div>

      <div className="relative z-10 w-full max-w-md my-auto flex flex-col items-center">
        {onBackToMarketing && (
          <div className="mb-4 w-full flex justify-start">
            <button
              type="button"
              onClick={onBackToMarketing}
              className="text-xs font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              ← Back to ThreadsWorks
            </button>
          </div>
        )}
        
        {/* Brand Header */}
        <div className="mb-6 md:mb-8 text-center w-full flex flex-col items-center justify-center" id="auth-header">
          
          {/* Recreated Proprietary Vector ThreadsWorks Logo App Icon */}
          <div className="mb-4">
            <ThreadsWorksLogo variant="app-icon" size="xl" />
          </div>

          {/* Wordmark: Threads (white) + Works (gradient) */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white font-sans drop-shadow-sm mt-2">
            Threads<span className="bg-gradient-to-r from-purple-400 via-fuchsia-300 to-indigo-300 bg-clip-text text-transparent">Works</span>
          </h1>

          {/* Tagline */}
          <p className="mt-3 text-[10px] sm:text-xs font-bold uppercase tracking-[0.25em] text-purple-300/90 max-w-xs sm:max-w-sm mx-auto leading-normal">
            YOUR AI OPERATING SYSTEM FOR THREADS
          </p>
        </div>

        {/* Premium Glass Login Panel */}
        <div 
          className="w-full rounded-[2rem] border border-purple-500/25 bg-zinc-950/70 p-6 sm:p-8 backdrop-blur-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9),0_0_40px_rgba(147,51,234,0.15)] relative z-10 transition-all duration-300 hover:border-purple-500/35" 
          id="auth-card"
        >
          {isForgotPassword ? (
            <form onSubmit={handlePasswordReset} className="space-y-5">
              <div className="text-center mb-1">
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">Reset Account Password</h2>
                <p className="text-xs text-zinc-400 mt-1">Enter your registered email below to receive a reset link.</p>
              </div>

              {resetSuccess && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-300 flex items-start gap-2.5 shadow-inner">
                  <CheckCircle className="h-4 w-4 shrink-0 mt-0.5 text-emerald-400" />
                  <span className="leading-relaxed">{resetSuccess}</span>
                </div>
              )}

              {activeError && (
                <div id="auth-error-banner" role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-300 flex items-start gap-2.5 shadow-inner">
                  <span className="font-bold shrink-0 text-red-400">Error:</span>
                  <span className="leading-relaxed">{activeError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                  Account Email Address
                </label>
                <input
                  id="forgot-password-email-input"
                  type="email"
                  required
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950/90 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none transition-all duration-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30 hover:border-zinc-700"
                  placeholder="you@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <button
                id="forgot-password-submit-button"
                type="submit"
                disabled={loading}
                className="mt-2 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 transition-all duration-200 py-3 text-sm font-bold text-white shadow-[0_0_25px_rgba(168,85,247,0.4)] hover:shadow-[0_0_35px_rgba(168,85,247,0.6)] active:scale-[0.98] cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    <KeyRound className="h-4 w-4" /> Send Reset Link
                  </>
                )}
              </button>

              <div className="pt-4 text-center border-t border-zinc-800/80">
                <button
                  type="button"
                  id="forgot-password-back-button"
                  onClick={() => {
                    setIsForgotPassword(false);
                    setError("");
                    setResetSuccess("");
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-purple-300 transition underline cursor-pointer"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign In
                </button>
              </div>
            </form>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-5">
            
            {activeError && (
              <div id="auth-error-banner" role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-300 flex items-start gap-2.5 shadow-inner">
                <span className="font-bold shrink-0 text-red-400">Error:</span>
                <span className="leading-relaxed">{activeError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                Email Address
              </label>
              <input
                id="auth-email-input"
                type="email"
                required
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950/90 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none transition-all duration-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30 hover:border-zinc-700"
                placeholder="you@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Password
                </label>
                {!isSignUp && (
                  <button
                    type="button"
                    id="auth-forgot-password-link"
                    onClick={() => {
                      setIsForgotPassword(true);
                      setError("");
                      setResetSuccess("");
                    }}
                    className="text-[11px] text-purple-400 hover:text-purple-300 transition hover:underline font-medium cursor-pointer"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <input
                id="auth-password-input"
                type="password"
                required
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950/90 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none transition-all duration-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30 hover:border-zinc-700"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {/* Extra user profile setup fields for Sign Up */}
            {isSignUp && (
              <div className="pt-3 border-t border-zinc-800/80 space-y-4">
                <div className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                  <Send className="h-3.5 w-3.5" /> Core Content Profile
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    What Do You Sell? <span className="text-purple-400">*</span>
                  </label>
                  <input
                    id="signup-offer-input"
                    type="text"
                    required
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950/90 px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30 hover:border-zinc-700"
                    placeholder="e.g. Content Strategy Consulting, $200 Dev Audits"
                    value={offer}
                    onChange={(e) => setOffer(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Who Do You Help? <span className="text-purple-400">*</span>
                  </label>
                  <input
                    id="signup-audience-input"
                    type="text"
                    required
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950/90 px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30 hover:border-zinc-700"
                    placeholder="e.g. Creators Under 1,000 Followers"
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Desired Result? <span className="text-purple-400">*</span>
                  </label>
                  <input
                    id="signup-result-input"
                    type="text"
                    required
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950/90 px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30 hover:border-zinc-700"
                    placeholder="e.g. Get More High-Paying Clients"
                    value={desiredResult}
                    onChange={(e) => setDesiredResult(e.target.value)}
                  />
                </div>
              </div>
            )}

            <button
              id="auth-submit-button"
              type="submit"
              disabled={isBusy}
              className="mt-2 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 transition-all duration-200 py-3 text-sm font-bold text-white shadow-[0_0_25px_rgba(168,85,247,0.4)] hover:shadow-[0_0_35px_rgba(168,85,247,0.6)] active:scale-[0.98] cursor-pointer disabled:opacity-50"
            >
              {isBusy ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : isSignUp ? (
                <>
                  <UserPlus className="h-4 w-4" /> Sign Up & Initialize
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" /> Sign In Securely
                </>
              )}
            </button>
          </form>
          </>
          )}

          {!isForgotPassword && (
            <>
              {/* Visual Divider and Google SSO button */}
              <div className="relative my-6 flex py-1 items-center">
                <div className="flex-grow border-t border-zinc-800" />
                <span className="mx-4 shrink-0 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">or continue with</span>
                <div className="flex-grow border-t border-zinc-800" />
              </div>

              <button
                id="auth-google-button"
                type="button"
                disabled={isBusy}
                onClick={handleGoogleSignIn}
                className="flex min-h-[48px] w-full items-center justify-center gap-2.5 rounded-xl border border-zinc-800 bg-zinc-950/90 hover:bg-zinc-900/90 hover:border-purple-500/40 text-xs font-bold text-zinc-200 py-3 shadow-md transition-all duration-200 active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mb-2"
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <g transform="matrix(1, 0, 0, 1, 0, 0)">
                    <path d="M21.35,11.1H12v2.7h5.38c-0.24,1.28 -0.96,2.37 -2.04,3.1v2.56h3.3c1.93,-1.78 3.04,-4.4 3.04,-7.49 0,-0.61 -0.05,-1.2 -0.15,-1.78z" fill="#4285F4" />
                    <path d="M12,20.6c2.43,0 4.47,-0.8 5.96,-2.18l-3.3,-2.56c-0.91,0.61 -2.08,0.98 -3.22,0.98 -2.48,0 -4.58,-1.67 -5.33,-3.92H2.1v2.66c1.49,2.97 4.56,5.02 8.16,5.02z" fill="#34A853" />
                    <path d="M6.67,13.1c-0.19,-0.57 -0.3,-1.17 -0.3,-1.8s0.11,-1.24 0.3,-1.8V6.84H2.1c-0.64,1.28 -1,2.72 -1,4.26s0.36,2.98 1,4.26l3.57,-2.68c0.11,-0.57 0.11,-1.24 0,-1.82z" fill="#FBBC05" />
                    <path d="M12,5.98c1.32,0 2.51,0.45 3.44,1.35l2.58,-2.58C16.46,3.22 14.43,2.4 12,2.4c-3.6,0 -6.67,2.05 -8.16,5.02l3.57,2.78c0.75,-2.25 2.85,-3.92 5.33,-3.92z" fill="#EA4335" />
                  </g>
                </svg>
                Sign in with Google
              </button>

              <div className="mt-2.5 flex gap-2">
                {showDevDiagnostics && (
                  <button
                    id="instant-preview-login-button"
                    type="button"
                    onClick={handleInstantPreviewLogin}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-purple-500/30 bg-purple-950/40 hover:bg-purple-900/50 text-[11px] font-bold text-purple-200 py-2.5 transition cursor-pointer"
                  >
                    ⚡ Instant Preview Login
                  </button>
                )}
                <button
                  id="open-new-tab-button"
                  type="button"
                  onClick={handleOpenNewTab}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/80 hover:bg-zinc-800 text-[11px] font-bold text-zinc-300 py-2.5 transition cursor-pointer"
                >
                  🔗 Open in New Tab
                </button>
              </div>

              {/* Toggle link */}
              <div className="mt-6 text-center">
                <button
                  id="auth-toggle-view"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setError("");
                  }}
                  className="text-xs text-zinc-400 hover:text-purple-300 transition underline font-medium cursor-pointer"
                >
                  {isSignUp 
                    ? "Already have an account? Sign In" 
                    : "New here? Create your content machine profile"}
                </button>
              </div>
            </>
          )}

          {/* Temporary development-only redacted diagnostics copy helper (disabled in production) */}
          {showDevDiagnostics && (
            <div className="relative z-50 pointer-events-auto mt-5 pt-4 border-t border-zinc-800/70 flex flex-col items-center gap-2">
              <p className="text-[10px] font-mono text-zinc-500">
                auth={authStatus || "unknown"} | busy={String(isBusy)} | persistence={resolvedAuthPersistenceMode}
              </p>
              <button
                id="copy-auth-diagnostics-button"
                type="button"
                onClick={handleCopyAuthDiagnostics}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-[11px] font-medium text-zinc-300 hover:text-white hover:border-zinc-600 transition cursor-pointer"
              >
                {diagCopyState === "copied" ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    Copied redacted auth diagnostics
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy auth diagnostics
                  </>
                )}
              </button>
              {diagPanelOpen && diagReportText && (
                <div className="w-full space-y-1">
                  <p className="text-[10px] text-zinc-400 text-center">
                    {diagCopyState === "copied"
                      ? "Copied to clipboard (also shown below):"
                      : "Select all and copy below:"}
                  </p>
                  <textarea
                    id="auth-diagnostics-fallback-output"
                    readOnly
                    value={diagReportText}
                    onFocus={(e) => e.currentTarget.select()}
                    rows={6}
                    className="w-full rounded-lg border border-zinc-800 bg-black/70 p-2 font-mono text-[10px] text-zinc-300 outline-none"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
