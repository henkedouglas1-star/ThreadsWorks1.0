import React from "react";
import { X, ShieldAlert, FileText, CheckCircle } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PrivacyPolicyModal({ isOpen, onClose }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" id="privacy-policy-modal">
      <div className="relative w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl border border-border-primary bg-bg-card shadow-2xl text-text-secondary">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-primary px-6 py-4.5 bg-bg-app">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-purple-500/20 bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <ShieldAlert className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-text-primary tracking-tight">Privacy Policy</h3>
              <p className="text-[10px] font-mono text-text-muted leading-none mt-1">META PLATFORM COMPLIANT DECREE</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-border-primary bg-bg-card-hover p-1.5 text-text-muted hover:text-text-primary transition cursor-pointer"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 text-xs leading-relaxed select-text font-sans">
          <div className="border border-purple-500/15 bg-purple-500/5 rounded-xl p-4 text-purple-700 dark:text-purple-300">
            <strong>Platform Compliance Statement:</strong> This document is hosted natively on the ThreadsWorks platform at 
            <span className="text-text-primary font-mono bg-bg-app px-1.5 py-0.5 rounded ml-1 text-[11px]">https://ais-pre-wqabw2zr6tsvgudvy34ugu-618639502215.us-west2.run.app/privacy</span>, as well as globally from the Creator Suite footer and settings panel. All integration actions adhere strictly to Meta Developer Platform Policies.
          </div>

          <div>
            <h4 className="text-sm font-bold text-text-primary mb-2">1. Introduction & Scope</h4>
            <p className="text-text-secondary">
              ThreadsWorks ("we", "our", "us") values your privacy. This Privacy Policy outlines our strict operational guidelines regarding the processing, security, and lifecycle of user data in connection with our Meta Threads publishing services. This policy is established to satisfy the transparency guidelines of the Meta General Developer Terms and California Consumer Privacy Act (CCPA).
            </p>
          </div>

          <div>
            <h4 className="text-sm font-bold text-text-primary mb-2">2. Categories of Information We Process</h4>
            <p className="text-text-secondary">
              To operate our service as a smart assistant for Threads published workflows, we explicitly process the following categories of data, and only after you authorize access via the Meta OAuth Dialog:
            </p>
            <ul className="list-disc list-inside mt-2 pl-2 space-y-1 text-text-secondary">
              <li><strong className="text-text-primary">Meta Access Tokens:</strong> Both short-lived user tokens and secure long-lived user access tokens requested via <code className="text-purple-600 dark:text-purple-400">threads_basic</code> and <code className="text-purple-600 dark:text-purple-400">threads_content_publish</code> scopes.</li>
              <li><strong className="text-text-primary">Public Profile Attributes:</strong> Your Threads identifier, active Threads username, profile image rendering URL, and biography details.</li>
              <li><strong className="text-text-primary">Creator Hub Manuscripts:</strong> Draft posts, prompt models, and content items designed or compiled using our built-in Gemini Assistant workspace.</li>
              <li><strong className="text-text-primary">Authenticating Details:</strong> Standard login emails and Firestore credentials necessary to protect your workspace.</li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-bold text-text-primary mb-2">3. Direct Data Usage Guidelines</h4>
            <p className="text-text-secondary">
              Your platform information is processed strictly to maintain authorized application capabilities. ThreadsWorks guarantees:
            </p>
            <ul className="list-disc list-inside mt-2 pl-2 space-y-1 text-text-secondary">
              <li>We <strong className="text-text-primary uppercase font-semibold">NEVER</strong> sell, rent, lease, trade, or distribute your account info, connected tokens, or intellectual documents to any external advertising aggregators or third parties.</li>
              <li>User Access Tokens are stored within secure, user-level scoped Firestore documents, and are accessed strictly on the secure backend during user-directed container creations (<code className="text-purple-600 dark:text-purple-400">/threads</code> endpoint) and publishing releases (<code className="text-purple-600 dark:text-purple-400">/threads_publish</code> endpoint).</li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-bold text-text-primary mb-2">4. User Data Deletion Instructions (Meta Section 3(d)(i))</h4>
            <p className="text-text-secondary font-medium">
              We respect your right to completely purge connected profiles and purge stored tokens. To execute direct removal, select one of the following Meta-approved procedures:
            </p>
            <div className="bg-bg-app border border-border-primary rounded-xl p-4 mt-3 space-y-3.5">
              <div>
                <strong className="text-purple-600 dark:text-purple-400 block mb-0.5">Option A: Native In-App Disconnection (Instant & Automated)</strong>
                <p className="text-text-secondary">
                  Navigate to the <span className="text-text-primary font-semibold">Settings</span> tab inside your ThreadsWorks dashboard, scroll to the "Threads Connection" workspace card, and click <strong className="text-status-danger-text">"Disconnect Threads"</strong>. This instantly, securely, and permanently deletes your connection documents (<code className="text-text-muted font-mono">connections</code> and <code className="text-text-muted font-mono">connections_secure</code> collections) from our Firestore database.
                </p>
              </div>
              <div className="border-t border-border-primary pt-3">
                <strong className="text-purple-600 dark:text-purple-400 block mb-0.5">Option B: Meta Platform Revocation</strong>
                <p className="text-text-secondary">
                  You can revoke application credentials at any time directly on native Meta platforms. Visit your Threads App Settings page, select "Developer App Permissions", and remove "ThreadsWorks" from your active account feeds.
                </p>
              </div>
              <div className="border-t border-border-primary pt-3">
                <strong className="text-purple-600 dark:text-purple-400 block mb-0.5">Option C: Direct Email Deletion Support</strong>
                <p className="text-text-secondary">
                  You can request manual data deletion by emailing our support desk at <strong className="text-text-primary">henkedouglas1@gmail.com</strong> with the subject line <em>"ThreadsWorks Data Deletion Request"</em>. Direct support will delete your account document and permanently revoke associated token keys within forty-eight (48) hours.
                </p>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-bold text-text-primary mb-2">5. Data Retention Boundaries</h4>
            <p className="text-text-secondary">
              Long-lived Access Tokens expire automatically ninety (90) days after generation. Stale connection rows are wiped during routine security hygiene audits. Your local drafts persist securely within your private user row under Firebase standards.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-bold text-text-primary mb-2">6. Security Precautions</h4>
            <p className="text-text-secondary">
              We govern storage files using tight Firebase security rules that prevent unauthorized extraction of platform tokens. All server processing is structured server-side, ensuring Meta credentials remain hidden from client browsers.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border-primary px-6 py-4 bg-bg-app rounded-b-2xl">
          <span className="text-[9px] font-mono text-text-muted">LAST REVISED: JUNE 22, 2026</span>
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 px-4 py-2 text-xs font-semibold text-white transition cursor-pointer"
          >
            I Acknowledge
          </button>
        </div>

      </div>
    </div>
  );
}

export function TermsOfServiceModal({ isOpen, onClose }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" id="terms-of-service-modal">
      <div className="relative w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl border border-border-primary bg-bg-card shadow-2xl text-text-secondary">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-primary px-6 py-4.5 bg-bg-app">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-purple-500/20 bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <FileText className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-text-primary tracking-tight">Terms of Service</h3>
              <p className="text-[10px] font-mono text-text-muted leading-none mt-1">META PLATFORM COMPLIANT DECREE</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-border-primary bg-bg-card-hover p-1.5 text-text-muted hover:text-text-primary transition cursor-pointer"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 text-xs leading-relaxed select-text font-sans">
          <div className="border border-purple-500/15 bg-purple-500/5 rounded-xl p-4 text-purple-700 dark:text-purple-300">
            <strong>Platform Accessibility Notice:</strong> These Terms of Service are hosted natively on the ThreadsWorks platform at 
            <span className="text-text-primary font-mono bg-bg-app px-1.5 py-0.5 rounded ml-1 text-[11px]">https://ais-pre-wqabw2zr6tsvgudvy34ugu-618639502215.us-west2.run.app/terms</span>, as well as globally from the Creator Suite footer and settings panel. By authenticating, you agree to comply with all Meta Community Standards.
          </div>

          <div>
            <h4 className="text-sm font-bold text-text-primary mb-2">1. Binding Agreement</h4>
            <p className="text-text-secondary">
              By registering an account and connecting your Meta Threads account with ThreadsWorks ("Service"), you explicitly agree to make usage of our capabilities according to these Terms of Service. If you do not agree to be bound by these legal policies, please cease using our software immediately.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-bold text-text-primary mb-2">2. Authorized API Usage & Content Standards</h4>
            <p className="text-text-secondary">
              ThreadsWorks publishes digital manuscripts to the Threads network on behalf of the user using official Meta Graph APIs. All users agree to:
            </p>
            <ul className="list-disc list-inside mt-2 pl-2 space-y-1 text-text-secondary">
              <li>Ensure all submitted content complies fully with the <strong className="text-text-primary hover:underline cursor-pointer">Threads Terms of Use</strong>, Meta Developers Platform Regulations, and Meta Community Standards.</li>
              <li>Refrain from dispatching any automatic spam generators, high-frequency bot runs, deceptive phishing schemes, or copyright-violating text packets.</li>
              <li>Take sole and personal responsibility for all drafts, statements, replies, or links dispatched to the public domain from their authorized profile ID.</li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-bold text-text-primary mb-2">3. Workspace & Access Token Account Responsibilities</h4>
            <p className="text-text-secondary">
              To leverage draft synchronization and publisher capabilities, you must authenticate credentials through the official Meta Graph OAuth secure gateway. You are entirely responsible for protecting your workspace access credentials and preventing unauthorized operations on your associated Threads profile.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-bold text-text-primary mb-2">4. Disclaimers & Limits of Liability</h4>
            <p className="text-text-secondary leading-normal">
              THREADSWORKS PROVIDES ALL CAPABILITIES "AS IS" AND "AS AVAILABLE", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED. 
            </p>
            <p className="text-text-secondary mt-2">
              We make no representations or guarantees regarding the continuous availability of third-party Meta Graph APIs, server response speeds, token longevity, or platform access restrictions or modifications imposed by Meta. In no event shall ThreadsWorks, its developers, or its stakeholders be liable for any direct, indirect, incidental, or consequential damages resulting from connection failure, API deprecation, account suspensions, or loss of content.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-bold text-text-primary mb-2">5. Immediate Termination & Account Disconnection</h4>
            <p className="text-text-secondary">
              We reserve the right to suspend user profiles instantly and without prior warning if we discover operations that violate Meta brand standards, involve automated abusive spam, or compromise backend database files. You are free to disconnect your account credentials and request total token deletion at any time via the automated mechanisms defined in our CCPA/Meta-compliant Privacy Policy.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-bold text-text-primary mb-2">6. Contact Information</h4>
            <p className="text-text-secondary">
              For any clarifications, legal issues, or platform inquiries, please reach out directly via support email: <strong className="text-text-primary font-bold">henkedouglas1@gmail.com</strong>.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border-primary px-6 py-4 bg-bg-app rounded-b-2xl">
          <span className="text-[9px] font-mono text-text-muted">LAST REVISED: JUNE 22, 2026</span>
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 px-4 py-2 text-xs font-semibold text-white transition cursor-pointer"
          >
            I Accept Terms
          </button>
        </div>

      </div>
    </div>
  );
}
