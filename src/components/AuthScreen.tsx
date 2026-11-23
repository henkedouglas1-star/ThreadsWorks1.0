import React, { useState } from "react";
import { auth, authPersistenceReady, db, ensureGoogleUserProfile, withTimeout } from "../firebase";
import ThreadsWorksLogo from "./ThreadsWorksLogo";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  sendPasswordResetEmail, 
  GoogleAuthProvider 
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { Send, LogIn, UserPlus, CheckCircle, KeyRound, ArrowLeft } from "lucide-react";
import { AuthUserLike, formatFirebaseAuthError } from "../lib/authContract";

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

  const activeError = error || externalError || "";

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
          setError("Account creation completed without an active user session. Please sign in.");
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
        setError("Sign-in completed without returning a user session. Please try again.");
      }
    } catch (err: any) {
      console.warn("Auth note:", err?.code || err?.message || err);
      const formatted = formatFirebaseAuthError(err, isSignUp ? "signup" : "signin");
      setErrorCode(formatted.code);
      setError(formatted.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setErrorCode("");
    setResetSuccess("");
    setLoading(true);

    try {
      await waitBoundedPersistence(authActions?.waitForPersistence);

      let userCredential: { user: AuthUserLike | null };
      if (authActions?.signInWithGooglePopup) {
        userCredential = await authActions.signInWithGooglePopup();
      } else {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });
        userCredential = await signInWithPopup(auth, provider);
      }

      const user = userCredential?.user || auth.currentUser;
      if (user) {
        const ensureProfileFn = authActions?.ensureGoogleProfile || ensureGoogleUserProfile;
        Promise.resolve()
          .then(() => ensureProfileFn(user))
          .catch((e) => {
            console.warn("Non-blocking Google profile initialization note:", e);
          });
        onSuccess(user);
        return;
      }

      setError("Google Sign-In did not return an authenticated user. Please try again.");
    } catch (popupErr: any) {
      const formatted = formatFirebaseAuthError(popupErr, "google");
      console.warn("Google Auth popup note:", formatted.code, popupErr?.message || popupErr);
      setErrorCode(formatted.code);
      setError(formatted.message);
    } finally {
      setLoading(false);
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
              disabled={loading}
              className="mt-2 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 transition-all duration-200 py-3 text-sm font-bold text-white shadow-[0_0_25px_rgba(168,85,247,0.4)] hover:shadow-[0_0_35px_rgba(168,85,247,0.6)] active:scale-[0.98] cursor-pointer disabled:opacity-50"
            >
              {loading ? (
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
                disabled={loading}
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
        </div>
      </div>
    </div>
  );
}
