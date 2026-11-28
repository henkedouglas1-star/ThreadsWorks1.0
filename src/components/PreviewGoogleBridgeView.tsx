import React, { useState, useRef } from "react";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { CheckCircle, AlertCircle } from "lucide-react";
import { auth } from "../firebase";
import { formatFirebaseAuthError } from "../lib/authContract";
import {
  PREVIEW_BRIDGE_CANCELLED_MESSAGE,
  PREVIEW_BRIDGE_READY_MESSAGE,
  cancelPreviewHandoff,
  completePreviewHandoff,
} from "../lib/previewGoogleHandoff";
import ThreadsWorksLogo from "./ThreadsWorksLogo";

interface PreviewGoogleBridgeViewProps {
  handoffId: string;
}

/**
 * Top-level Google Sign-In window opened strictly by Google AI Studio Preview iframes.
 * Runs real Firebase signInWithPopup() outside the cross-origin iframe so Google OAuth
 * completes without 3P storage partitioning or Preview wrapper iframe reloads, then
 * securely hands off the verified Google OAuth credential to the originating Preview iframe.
 */
export default function PreviewGoogleBridgeView({ handoffId }: PreviewGoogleBridgeViewProps) {
  const [status, setStatus] = useState<"idle" | "signing_in" | "completing" | "done" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const inFlightRef = useRef(false);

  const handleContinueWithGoogle = async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setErrorMessage("");
    setStatus("signing_in");
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const userCredential = await signInWithPopup(auth, provider);
      const oauthCred = GoogleAuthProvider.credentialFromResult(userCredential);
      const googleIdToken = oauthCred?.idToken || null;
      const googleAccessToken = oauthCred?.accessToken || null;

      if (!googleIdToken && !googleAccessToken) {
        throw new Error("Google Sign-In did not return a verifiable OAuth credential.");
      }

      setStatus("completing");
      const firebaseIdToken = await userCredential.user.getIdToken();
      const result = await completePreviewHandoff({
        handoffId,
        firebaseIdToken,
        googleIdToken,
        googleAccessToken,
      });

      if (!result.ok) {
        throw new Error(
          result.error || "Could not complete sign-in handoff back to AI Studio Preview. Please retry from Preview."
        );
      }

      setStatus("done");
      try {
        window.opener?.postMessage(
          { type: PREVIEW_BRIDGE_READY_MESSAGE, handoffId },
          window.location.origin
        );
      } catch {
        // Preview iframe also polls & resumes via sessionStorage if reloaded
      }
      setTimeout(() => {
        try {
          window.close();
        } catch {
          // User can close tab manually if browser blocks window.close()
        }
      }, 450);
    } catch (err: any) {
      const formatted = formatFirebaseAuthError(err, "google");
      setErrorMessage(formatted.message);
      setStatus("error");
      if (formatted.code === "auth/popup-closed-by-user" || formatted.code === "auth/cancelled-popup-request") {
        await cancelPreviewHandoff(handoffId);
        try {
          window.opener?.postMessage(
            { type: PREVIEW_BRIDGE_CANCELLED_MESSAGE, handoffId },
            window.location.origin
          );
        } catch {
          // Ignore postMessage errors
        }
      }
    } finally {
      inFlightRef.current = false;
    }
  };

  return (
    <div
      data-theme="dark"
      className="dark min-h-screen w-full flex flex-col items-center justify-center bg-[#030206] px-4 py-8 text-zinc-100"
    >
      <div className="w-full max-w-sm rounded-[1.75rem] border border-purple-500/25 bg-zinc-950/90 p-7 text-center shadow-2xl space-y-5">
        <div className="flex flex-col items-center gap-3">
          <ThreadsWorksLogo variant="app-icon" size="lg" />
          <h1 className="text-xl font-black tracking-tight text-white">
            Sign in to Threads<span className="text-purple-400">Works</span>
          </h1>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Complete Google authentication in this top-level window to sign into your ThreadsWorks AI Studio Preview session.
          </p>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-left text-xs text-red-300 flex items-start gap-2"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {status === "done" ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-300 flex flex-col items-center gap-2">
            <CheckCircle className="h-5 w-5 text-emerald-400" />
            <p className="font-semibold">Google Sign-In verified!</p>
            <p className="text-zinc-300">
              Returning you to ThreadsWorks in AI Studio Preview. You may close this window if it does not close automatically.
            </p>
          </div>
        ) : (
          <button
            id="preview-bridge-google-button"
            type="button"
            disabled={status === "signing_in" || status === "completing"}
            onClick={handleContinueWithGoogle}
            className="flex min-h-[48px] w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-sm font-bold text-white py-3 shadow-lg transition cursor-pointer disabled:opacity-60"
          >
            {status === "signing_in" || status === "completing" ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                {status === "completing" ? "Returning to Preview..." : "Signing in with Google..."}
              </>
            ) : (
              <>
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M21.35,11.1H12v2.7h5.38c-0.24,1.28 -0.96,2.37 -2.04,3.1v2.56h3.3c1.93,-1.78 3.04,-4.4 3.04,-7.49 0,-0.61 -0.05,-1.2 -0.15,-1.78z" fill="#4285F4" />
                  <path d="M12,20.6c2.43,0 4.47,-0.8 5.96,-2.18l-3.3,-2.56c-0.91,0.61 -2.08,0.98 -3.22,0.98 -2.48,0 -4.58,-1.67 -5.33,-3.92H2.1v2.66c1.49,2.97 4.56,5.02 8.16,5.02z" fill="#34A853" />
                  <path d="M6.67,13.1c-0.19,-0.57 -0.3,-1.17 -0.3,-1.8s0.11,-1.24 0.3,-1.8V6.84H2.1c-0.64,1.28 -1,2.72 -1,4.26s0.36,2.98 1,4.26l3.57,-2.68c0.11,-0.57 0.11,-1.24 0,-1.82z" fill="#FBBC05" />
                  <path d="M12,5.98c1.32,0 2.51,0.45 3.44,1.35l2.58,-2.58C16.46,3.22 14.43,2.4 12,2.4c-3.6,0 -6.67,2.05 -8.16,5.02l3.57,2.78c0.75,-2.25 2.85,-3.92 5.33,-3.92z" fill="#EA4335" />
                </svg>
                Continue with Google
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
