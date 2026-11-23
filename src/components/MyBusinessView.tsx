import React, { useState, useEffect, useCallback } from "react";
import { UserProfile } from "../types";
import { usePersistentDraft } from "../utils/usePersistentDraft";
import {
  Briefcase,
  Sparkles,
  Check,
  Copy,
  RotateCcw,
  BookOpen,
  Loader2,
  Cloud,
  AlertCircle,
  CheckCircle2,
  ArrowRight
} from "lucide-react";
import { auth, db, withTimeout, handleFirestoreError, OperationType, sanitizeForFirestore } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import { apiFetch } from "../lib/api";

interface MyBusinessViewProps {
  profile?: UserProfile | null;
  onNavigateToTab?: (tab: string) => void;
  onRefreshProfile?: () => void;
}

const EXAMPLE_BUSINESS_TEXT = `I run a high-ticket boutique positioning and content consultancy for B2B founders, agency owners, and independent consultants.

Main offer:
- The Inbound Authority Accelerator: A 90-day 1-on-1 strategic implementation ($3,500).
- Customers receive: Complete offer sharpening, organic Threads distribution roadmap, and 12 high-converting hand-raiser frameworks customized to their mechanism.

Who I help & their problem:
- I help B2B service providers who have high expertise but suffer from sporadic, unpredictable outbound pipelines.
- They are dealing with low conversion on generic social content and want consistent, qualified inbound client conversations without relying on paid ads or cold outreach.

Our unique approach & differentiation:
- We don't preach generic vanity metrics or 10-posts-a-day burnout.
- We believe in "Single-Mechanism Positioning": isolating one high-specificity client outcome and installing clear hand-raiser triggers into organic discussion.

Current sales focus & priority:
- Right now, I am focused on signing 4 new quarterly clients for the accelerator.
- Current obstacle: Many prospects understand their service deeply, but hesitate because their messaging sounds identical to general marketing agencies.`;

export default function MyBusinessView({
  profile,
  onNavigateToTab,
  onRefreshProfile
}: MyBusinessViewProps) {
  const currentUid = auth.currentUser?.uid || profile?.uid || "";
  const [activeUid, setActiveUid] = useState<string>(currentUid);

  // Single unified business text state
  const [businessText, setBusinessText] = usePersistentDraft<string>("my-business", "business-text", profile?.rawBusinessText || "");

  const [isEnhancingBusiness, setIsEnhancingBusiness] = useState<boolean>(false);
  const [previousBusinessText, setPreviousBusinessText] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveToast, setSaveToast] = useState<boolean>(false);
  const [saveToastMessage, setSaveToastMessage] = useState<string>("My Business saved successfully!");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [copiedSummary, setCopiedSummary] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync when profile arrives or changes
  useEffect(() => {
    if (!currentUid) {
      setActiveUid("");
      return;
    }

    if (currentUid !== activeUid) {
      setActiveUid(currentUid);
      let loadedText = profile?.rawBusinessText || "";

      if (!loadedText) {
        const cached = localStorage.getItem(`threadsworks_business_${currentUid}`);
        if (cached) {
          loadedText = cached;
        }
      }

      setBusinessText(loadedText);
      if (loadedText) {
        try {
          localStorage.setItem(`threadsworks_business_${currentUid}`, loadedText);
        } catch (_) {}
      }
    } else if (profile?.rawBusinessText && !businessText.trim()) {
      setBusinessText(profile.rawBusinessText);
    }
  }, [currentUid, activeUid, profile, businessText]);

  // Persist raw natural-language business context to Firestore and LocalStorage
  const persistBusinessData = useCallback(
    async (rawText: string, targetUid: string) => {
      if (!targetUid) return;

      try {
        setSaveStatus("saving");

        // 1. Cache locally
        localStorage.setItem(`threadsworks_business_${targetUid}`, rawText);

        // 2. Firestore user doc
        const userRef = doc(db, "users", targetUid);
        const payload = {
          rawBusinessText: rawText,
          updatedAt: new Date().toISOString(),
        };

        // Parallelize writes for faster response
        await Promise.all([
          withTimeout(setDoc(userRef, sanitizeForFirestore(payload), { merge: true }), 5000, true),
          withTimeout(setDoc(doc(db, "settings", targetUid), sanitizeForFirestore({ rawBusinessText: rawText, updatedAt: new Date().toISOString() }), { merge: true }), 3000, true).catch(() => {})
        ]);

        // 4. Update cached profile in localStorage
        const profileCacheKey = `profile_${targetUid}`;
        const existingCacheStr = localStorage.getItem(profileCacheKey);
        let existingProfile: any = {};
        if (existingCacheStr) {
          try {
            existingProfile = JSON.parse(existingCacheStr);
          } catch (_) {}
        }
        const updatedProfile = {
          ...existingProfile,
          ...payload,
          uid: targetUid,
          email: auth.currentUser?.email || existingProfile.email || "",
        };
        localStorage.setItem(profileCacheKey, JSON.stringify(updatedProfile));

        // 5. Invalidate server-side Cash Machine cache so strategic diagnosis evaluates fresh business context
        try {
          await apiFetch("/api/cash-machine/clear", { method: "POST" });
        } catch (_) {}

        // 6. Asynchronously extract and structure Offer & Buyer Intelligence from business context
        try {
          apiFetch<any>("/api/offer-intelligence/understand", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              businessText: rawText,
              offer: profile?.offer,
              creatorIdentity: profile?.creatorIdentity,
              customInstruction: profile?.customInstruction,
              previousIntelligence: profile?.offerIntelligence
            })
          })
            .then(async data => {
              const offerData = data?.offerIntelligence;
              if (offerData) {
                const intelPayload = {
                  offerIntelligence: offerData,
                  updatedAt: new Date().toISOString()
                };
                await setDoc(userRef, sanitizeForFirestore(intelPayload), { merge: true }).catch(() => {});
                const freshCacheStr = localStorage.getItem(profileCacheKey);
                if (freshCacheStr) {
                  try {
                    const fresh = JSON.parse(freshCacheStr);
                    localStorage.setItem(profileCacheKey, JSON.stringify({ ...fresh, ...intelPayload }));
                  } catch (_) {}
                }
                if (onRefreshProfile) onRefreshProfile();
              }

              // Extract Buyer & Conversion Intelligence with current offer context
              apiFetch<any>("/api/buyer-intelligence/understand", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  businessText: rawText,
                  audience: profile?.audience,
                  desiredResult: profile?.desiredResult,
                  offer: profile?.offer,
                  creatorIdentity: profile?.creatorIdentity,
                  customInstruction: profile?.customInstruction,
                  offerIntelligence: offerData || profile?.offerIntelligence,
                  previousBuyerIntelligence: profile?.buyerIntelligence
                })
              })
                .then(async bData => {
                  if (bData?.buyerIntelligence) {
                    const buyerPayload = {
                      buyerIntelligence: bData.buyerIntelligence,
                      updatedAt: new Date().toISOString()
                    };
                    await setDoc(userRef, sanitizeForFirestore(buyerPayload), { merge: true }).catch(() => {});
                    const freshCacheStr2 = localStorage.getItem(profileCacheKey);
                    if (freshCacheStr2) {
                      try {
                        const fresh2 = JSON.parse(freshCacheStr2);
                        localStorage.setItem(profileCacheKey, JSON.stringify({ ...fresh2, ...buyerPayload }));
                      } catch (_) {}
                    }
                    if (onRefreshProfile) onRefreshProfile();
                  }
                })
                .catch(e => console.warn("Background Buyer Intelligence extraction error:", e));
            })
            .catch(e => console.warn("Background Offer Intelligence extraction error:", e));
        } catch (_) {}

        setSaveStatus("saved");

        if (onRefreshProfile) {
          onRefreshProfile();
        }
      } catch (err: any) {
        console.error("Failed saving business profile:", err);
        handleFirestoreError(err, OperationType.WRITE, `users/${targetUid}`);
        setSaveStatus("error");
      }
    },
    [onRefreshProfile]
  );

  // Main Save Handler
  const handleSaveBusiness = async () => {
    if (!businessText.trim()) {
      setErrorMsg("Please enter something about your business, offers, or goals.");
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    try {
      const targetUid = auth.currentUser?.uid || profile?.uid || "local_user";
      await persistBusinessData(businessText, targetUid);

      setSaveToastMessage("Business context saved & integrated with strategy!");
      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 3500);
    } catch (err: any) {
      console.error("Save business context error:", err);
      setErrorMsg(err.message || "Failed to save business context.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = () => {
    if (!businessText.trim()) return;
    navigator.clipboard.writeText(businessText);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  // AI Depth Enhancement for My Business
  const handleEnhanceBusiness = async () => {
    if (!businessText.trim() || isEnhancingBusiness || isSaving) return;
    setIsEnhancingBusiness(true);
    setPreviousBusinessText(businessText);
    setErrorMsg(null);

    try {
      const data = await apiFetch<any>("/api/enhance-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: "my_business",
          text: businessText.trim(),
          context: {
            rawBusinessText: businessText.trim(),
            creatorIdentity: profile?.creatorIdentity,
            voiceText: profile?.creatorIdentity?.rawVoice,
            customInstruction: profile?.customInstruction
          }
        })
      });

      if (data && data.enhancedText) {
        setBusinessText(data.enhancedText);
        setSaveToastMessage("Enhanced Your Business with commercial depth. Review and edit, or click Save.");
        setSaveToast(true);
        setTimeout(() => setSaveToast(false), 4000);
      }
    } catch (err: any) {
      console.error("Enhance business error:", err);
      setErrorMsg("Enhancement temporarily unavailable. Please try again in a moment.");
    } finally {
      setIsEnhancingBusiness(false);
    }
  };

  const handleUndoEnhanceBusiness = () => {
    if (previousBusinessText !== null) {
      setBusinessText(previousBusinessText);
      setPreviousBusinessText(null);
    }
  };

  const handleReset = () => {
    if (window.confirm("Are you sure you want to clear your business context?")) {
      setBusinessText("");
      setErrorMsg(null);
      setSaveStatus("idle");
    }
  };

  const handleLoadExample = () => {
    setBusinessText(EXAMPLE_BUSINESS_TEXT);
    setErrorMsg(null);
  };

  const wordCount = businessText.trim() ? businessText.trim().split(/\s+/).length : 0;
  const hasContent = Boolean(businessText && businessText.trim().length > 20);

  return (
    <div id="my-business-view-root" className="space-y-8 animate-fade-in pb-16 max-w-5xl mx-auto">
      {/* Toast Notification */}
      {saveToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-xl animate-fade-in font-medium text-xs">
          <CheckCircle2 className="w-4 h-4" />
          <span>{saveToastMessage}</span>
        </div>
      )}

      {/* Main Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-bg-card via-bg-card to-purple-50/70 dark:to-purple-950/20 border border-border-primary p-6 md:p-8 shadow-sm">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-surface text-brand-text text-xs font-semibold border border-brand-border">
                <Briefcase className="w-3.5 h-3.5" />
                <span>My Business</span>
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-bg-app border border-brand-border text-text-secondary">
                <span>WHAT YOU DO + WHO YOU HELP + WHAT YOU SELL</span>
              </div>

              {/* Status Badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-bg-app border border-border-primary">
                {saveStatus === "saving" && (
                  <span className="flex items-center gap-1.5 text-status-warning-text font-semibold animate-pulse">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving Context...</span>
                  </span>
                )}
                {saveStatus === "saved" && (
                  <span className="flex items-center gap-1.5 text-status-success-text font-semibold">
                    <Check className="w-3.5 h-3.5" />
                    <span>Business Context Active ✓</span>
                  </span>
                )}
                {saveStatus === "error" && (
                  <span className="flex items-center gap-1.5 text-status-warning-text">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Saved locally</span>
                  </span>
                )}
                {saveStatus === "idle" && (
                  <span className="flex items-center gap-1.5 text-text-secondary">
                    <Cloud className="w-3.5 h-3.5 text-brand-text" />
                    <span>{hasContent ? "Context Available" : "Ready for Input"}</span>
                  </span>
                )}
              </div>
            </div>

            <h1 className="text-2xl md:text-3xl font-extrabold text-text-primary tracking-tight font-sans">
              My Business
            </h1>

            <p className="text-text-secondary text-sm md:text-base leading-relaxed">
              My Business represents what you do and the commercial context behind your content. It establishes your industry, audience, customer problems, outcomes, products, offers, pricing, positioning, and differentiation.
            </p>
          </div>

          {/* Header Action Tools */}
          <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
            <button
              id="business-load-example-btn"
              type="button"
              onClick={handleLoadExample}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-bg-card hover:bg-bg-card-hover text-text-secondary hover:text-text-primary border border-border-primary rounded-xl transition cursor-pointer"
              title="Load a sample business description"
            >
              <BookOpen className="w-3.5 h-3.5 text-purple-500" />
              <span>Sample Business</span>
            </button>

            {businessText && (
              <button
                id="business-copy-btn"
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-bg-card hover:bg-bg-card-hover text-text-secondary hover:text-text-primary border border-border-primary rounded-xl transition cursor-pointer"
                title="Copy business text to clipboard"
              >
                {copiedSummary ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSummary ? "Copied" : "Copy"}</span>
              </button>
            )}

            <button
              id="business-reset-btn"
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-bg-card hover:bg-bg-card-hover text-text-secondary hover:text-text-primary border border-border-primary rounded-xl transition cursor-pointer"
              title="Clear business text"
            >
              <RotateCcw className="w-3.5 h-3.5 text-text-muted" />
              <span>Reset</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Business Context Form Panel */}
      <div className="rounded-2xl border border-border-primary bg-bg-card p-6 md:p-8 space-y-6 shadow-sm">
        {/* Exact Introductory Copy as Required */}
        <div className="space-y-3">
          <div className="space-y-2 text-xs md:text-sm text-text-secondary leading-relaxed max-w-3xl">
            <p>
              Share what you do, who you help, what you sell, customer problems, solutions, offers, pricing, and business goals.
            </p>
            <p className="text-purple-600 dark:text-purple-400 font-medium">
              Primary question: &ldquo;What does this person do, who do they help, and what business context should influence the content?&rdquo;
            </p>
            <p className="text-text-muted text-[11px]">
              Note: Personal voice, tone, and identity belong in <strong>Your Voice</strong>. Strategy and post generation rules belong in <strong>Create Content</strong>.
            </p>
          </div>
        </div>

        {/* Single Unified Textarea */}
        <div className="space-y-2">
          <div className="relative">
            <textarea
              id="my-business-textarea"
              value={businessText}
              onChange={(e) => {
                setBusinessText(e.target.value);
                setSaveStatus("idle");
                if (errorMsg) setErrorMsg(null);
              }}
              disabled={isSaving}
              placeholder={`Tell us about your business so ThreadsWorks understands the commercial direction for your content:

• What you do & your industry/domain expertise
• Who you help (target audience, buyer segments, current situation)
• What problems you solve & the outcomes you provide
• What you sell (products, services, offers, formats, pricing)
• Positioning & unique mechanism (why your approach works differently)
• Current business goals, promotions, or primary calls-to-action

MY BUSINESS = WHAT YOU DO + WHO YOU HELP + WHAT YOU SELL`}
              className="w-full rounded-xl border border-border-primary bg-bg-app px-4 py-4 text-xs md:text-sm text-text-primary placeholder:text-text-muted/60 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none transition leading-relaxed resize-y min-h-[300px] font-sans"
            />
            <div className="absolute bottom-3 right-3 text-[10px] text-text-muted font-mono bg-bg-app/90 px-2 py-0.5 rounded border border-border-primary/50 backdrop-blur">
              {wordCount} {wordCount === 1 ? "word" : "words"} · {businessText.length} chars
            </div>
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 text-xs text-status-danger-text bg-status-danger-bg border border-status-danger-border px-3.5 py-2.5 rounded-xl font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Action Bottom Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-border-primary">
          <div className="flex items-center gap-2 text-xs text-text-muted">
            {hasContent ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                <span>Context ready. Saved context directly informs content strategy & diagnosis.</span>
              </span>
            ) : (
              <span>Your natural-language context provides direct grounding for content creation.</span>
            )}
            {previousBusinessText !== null && (
              <button
                type="button"
                onClick={handleUndoEnhanceBusiness}
                className="text-xs text-text-secondary hover:text-text-primary underline cursor-pointer shrink-0 ml-2"
              >
                Undo Enhancement
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            <button
              id="enhance-your-business-btn"
              type="button"
              onClick={handleEnhanceBusiness}
              disabled={isEnhancingBusiness || isSaving || !businessText.trim()}
              className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs md:text-sm transition cursor-pointer border ${
                isEnhancingBusiness || isSaving || !businessText.trim()
                  ? "border-border-primary text-text-muted bg-bg-app/50 cursor-not-allowed"
                  : "border-brand-border bg-brand-surface hover:bg-brand-surface-hover text-brand-text shadow-sm hover:scale-[1.01]"
              }`}
              title="Develop and enrich your business context with commercial depth"
            >
              {isEnhancingBusiness ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-500" />
                  <span>Enhancing Business...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                  <span>Enhance Your Business</span>
                </>
              )}
            </button>

            <button
              id="my-business-save-btn"
              type="button"
              onClick={handleSaveBusiness}
              disabled={isSaving || isEnhancingBusiness || !businessText.trim()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs md:text-sm shadow-md shadow-purple-500/20 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Context...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save Business Context</span>
                </>
              )}
            </button>

            {onNavigateToTab && (
              <button
                type="button"
                onClick={() => onNavigateToTab("engine")}
                className="hidden md:inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-bg-app hover:bg-bg-card-hover text-text-secondary hover:text-text-primary text-xs font-semibold border border-border-primary transition cursor-pointer"
              >
                <span>Go to Create Content</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
