import React, { useState, useRef, useEffect } from "react";
import { UserProfile } from "../types";
import { useContentPersistence } from "../context/ContentPersistenceContext";
import { 
  User, 
  Briefcase, 
  Target, 
  FileText, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Sliders,
  Handshake,
  Share2,
  Copy,
  Check,
  Globe,
  ExternalLink,
  Save,
  RefreshCw,
  Wand2,
  DollarSign,
  MessageSquare,
  Zap,
  MousePointerClick,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import PartnerHubView from "./PartnerHub/PartnerHubView";
import YourLinksSection from "./YourLinksSection";
import { usePersistentDraft } from "../utils/usePersistentDraft";
import { fetchMyPartnerProfile } from "../services/partnerService";
import { PartnerProfile } from "../types/partner";
import { auth, db, handleFirestoreError, OperationType, sanitizeForFirestore, withTimeout } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import { useVoiceToText } from "../hooks/useVoiceToText";
import { VoiceInputStatusPanel, VoiceToTextButton } from "./VoiceToTextButton";

interface ProfileViewProps {
  profile: UserProfile | null;
  onNavigateToTab?: (tab: string) => void;
  onRefreshProfile?: () => void;
  subscriptionStatus?: string;
  initialSubTab?: string;
  onOpenPrivacy?: () => void;
  onOpenTerms?: () => void;
  userEmail?: string;
  onSaveToLibrary?: (text: string, title?: string) => void;
  isAdmin?: boolean;
}

const DEFAULT_EXAMPLE_CONTEXT = "";

export default function ProfileView({
  profile,
  onNavigateToTab,
  onRefreshProfile,
  subscriptionStatus,
  initialSubTab,
  onOpenPrivacy,
  onOpenTerms,
  userEmail,
  onSaveToLibrary,
  isAdmin = false
}: ProfileViewProps) {
  const { 
    customInstruction, 
    setCustomInstruction, 
    ctaPreferences, 
    setCtaPreferences, 
    contentDestinations, 
    setContentDestinations 
  } = useContentPersistence();

  const baseOrigin = typeof window !== "undefined" && window.location.origin
    ? window.location.origin
    : "https://threadsworks.com";

  // Partner Program State
  const [partner, setPartner] = useState<PartnerProfile | null>(null);
  const [loadingPartner, setLoadingPartner] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Active Tab View in Profile ("context" | "partner" | "share")
  const [activeProfileTab, setActiveProfileTab] = useState<"context" | "partner" | "share">(() => {
    if (initialSubTab === "partner") return "partner";
    if (initialSubTab === "share") return "share";
    return "context";
  });

  // Track whether the user has actively edited Creator Context in this session or if it has hydrated
  const hasUserEditedRef = useRef(false);
  const isHydratedRef = useRef(false);

  // Natural Language Creator Context Input
  const [creatorContext, setCreatorContext] = usePersistentDraft<string>("profile", "creator-context", (() => {
    // 1. Check if an explicit draft exists in localStorage first
    if (typeof window !== "undefined") {
      const uid = auth.currentUser?.uid || profile?.uid || "anonymous";
      const draftKey = `threadsworks:draft:${uid}:profile:creator-context`;
      const savedDraft = localStorage.getItem(draftKey);
      if (savedDraft !== null) {
        try {
          isHydratedRef.current = true;
          return JSON.parse(savedDraft);
        } catch (_) {}
      }
    }
    // 2. Explicit profile customInstruction or rawVoice (distinguish "" from undefined/null)
    if (profile?.customInstruction !== undefined && profile?.customInstruction !== null) {
      isHydratedRef.current = true;
      return profile.customInstruction;
    }
    if (profile?.rawVoice !== undefined && profile?.rawVoice !== null) {
      isHydratedRef.current = true;
      return profile.rawVoice;
    }
    // 3. ContentPersistenceContext in-memory customInstruction
    if (customInstruction !== undefined && customInstruction !== null && customInstruction !== "") {
      isHydratedRef.current = true;
      return customInstruction;
    }
    // 4. Stored user instructions in localStorage
    if (typeof window !== "undefined") {
      const uid = auth.currentUser?.uid || profile?.uid;
      const stored = 
        (uid ? localStorage.getItem(`threads_custom_instruction_${uid}`) : null) ??
        (uid ? localStorage.getItem(`threads_raw_voice_${uid}`) : null) ??
        localStorage.getItem("threads_custom_instruction") ??
        localStorage.getItem("threads_raw_voice");
      if (stored !== null && stored !== undefined) {
        isHydratedRef.current = true;
        return stored;
      }
    }
    return "";
  })());

  const handleCreatorContextChange = (newVal: string) => {
    hasUserEditedRef.current = true;
    setCreatorContext(newVal);
    setCustomInstruction(newVal);
    if (typeof window !== "undefined") {
      const uid = auth.currentUser?.uid || profile?.uid;
      try {
        localStorage.setItem("threads_custom_instruction", newVal);
        localStorage.setItem("threads_raw_voice", newVal);
        if (uid) {
          localStorage.setItem(`threads_custom_instruction_${uid}`, newVal);
          localStorage.setItem(`threads_raw_voice_${uid}`, newVal);
          localStorage.setItem(`threadsworks:draft:${uid}:profile:creator-context`, JSON.stringify(newVal));
        }
        localStorage.setItem("threads_custom_instruction_anonymous", newVal);
        localStorage.setItem("threads_raw_voice_anonymous", newVal);
        localStorage.setItem("threadsworks:draft:anonymous:profile:creator-context", JSON.stringify(newVal));
        
        // Optimistically update cached profile so all views immediately reflect it
        const cachedKey = uid ? `profile_${uid}` : "profile_anonymous";
        const rawCached = localStorage.getItem(cachedKey) || localStorage.getItem("profile");
        const p = rawCached ? JSON.parse(rawCached) : (profile ? { ...profile } : {});
        p.customInstruction = newVal;
        p.rawVoice = newVal;
        if (uid) p.uid = uid;
        localStorage.setItem(cachedKey, JSON.stringify(p));
        localStorage.setItem("profile", JSON.stringify(p));
        if (uid) localStorage.setItem(`profile_${uid}`, JSON.stringify(p));
        window.dispatchEvent(new CustomEvent("creator-context-updated", { detail: newVal }));
      } catch (e) {
        console.warn("Failed syncing creatorContext changes:", e);
      }
    }
  };

  const creatorContextTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const creatorContextVoice = useVoiceToText({
    value: creatorContext,
    onChange: handleCreatorContextChange,
    inputRef: creatorContextTextareaRef,
  });

  // Structured Creator Intelligence State
  const [businessName, setBusinessName] = usePersistentDraft<string>("profile", "business-name", (() => {
    return profile?.offerIntelligence?.primaryOfferName || profile?.offer || "";
  })());
  const [coreOffer, setCoreOffer] = usePersistentDraft<string>("profile", "core-offer", (() => {
    return profile?.offer || "";
  })());
  const [pricePoint, setPricePoint] = usePersistentDraft<string>("profile", "price-point", (() => {
    return profile?.offerIntelligence?.offers?.[0]?.price || profile?.desiredResult || "";
  })());
  const [websiteUrl, setWebsiteUrl] = usePersistentDraft<string>("profile", "website-url", (() => {
    return contentDestinations?.[0]?.url || profile?.contentDestinations?.[0]?.url || "";
  })());

  const [targetAudience, setTargetAudience] = usePersistentDraft<string>("profile", "target-audience", (() => {
    return profile?.audience || "";
  })());
  const [painPoints, setPainPoints] = usePersistentDraft<string>("profile", "pain-points", (() => {
    return profile?.buyerIntelligence?.buyers?.[0]?.problems?.rootProblem || "";
  })());

  const [writingStyle, setWritingStyle] = usePersistentDraft<string>("profile", "writing-style", (() => {
    return profile?.writingStyle || "";
  })());
  const [wordsToAvoid, setWordsToAvoid] = usePersistentDraft<string>("profile", "words-to-avoid", (() => {
    return profile?.creatorIdentity?.wordsYouAvoid || "";
  })());

  const [defaultCta, setDefaultCta] = usePersistentDraft<string>("profile", "default-cta", (() => {
    return ctaPreferences || profile?.ctaPreferences || "";
  })());

  // Saving / Feedback State
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [extractSuccess, setExtractSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load Partner Profile
  useEffect(() => {
    const loadPartner = async () => {
      try {
        const data = await fetchMyPartnerProfile();
        setPartner(data);
      } catch (e) {
        console.warn("[PROFILE_VIEW] Failed to fetch partner status:", e);
      } finally {
        setLoadingPartner(false);
      }
    };
    loadPartner();
  }, []);

  // Synchronize state when profile updates
  useEffect(() => {
    if (profile) {
      // Only hydrate creatorContext if the user has NOT edited it in this session and it hasn't hydrated yet
      if (!hasUserEditedRef.current && !isHydratedRef.current) {
        const profileContext = profile.customInstruction ?? profile.rawVoice;
        if (profileContext !== undefined && profileContext !== null) {
          setCreatorContext(profileContext);
          setCustomInstruction(profileContext);
          isHydratedRef.current = true;
        }
      }
      if (!coreOffer && profile.offer) setCoreOffer(profile.offer);
      if (!targetAudience && profile.audience) setTargetAudience(profile.audience);
      if (!writingStyle && profile.writingStyle) setWritingStyle(profile.writingStyle);
      if (!defaultCta && profile.ctaPreferences) setDefaultCta(profile.ctaPreferences);
    }
  }, [profile]);

  const [isIntelligenceExpanded, setIsIntelligenceExpanded] = useState(false);

  // Save Edits directly without triggering Gemini extraction
  const handleSaveStructuredIntelligenceOnly = async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const user = auth.currentUser;
      const uid = user?.uid || profile?.uid;

      // Local Persistence Context Update
      setCustomInstruction(creatorContext);
      setCtaPreferences(defaultCta);

      if (websiteUrl.trim() && contentDestinations.length === 0) {
        const primaryLink = {
          id: "primary_link",
          name: businessName || "Primary Link",
          url: websiteUrl.trim(),
          purpose: "Primary Offer / Website",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        setContentDestinations([primaryLink]);
      }

      // Firestore Persistence Update
      if (uid) {
        const profilePayload: Partial<UserProfile> = {
          offer: coreOffer.trim() || profile?.offer || "",
          audience: targetAudience.trim() || profile?.audience || "",
          writingStyle: writingStyle.trim() || profile?.writingStyle || "Direct, practical, conversational",
          desiredResult: pricePoint.trim() || profile?.desiredResult || "",
          customInstruction: creatorContext.trim(),
          ctaPreferences: defaultCta.trim(),
          rawVoice: creatorContext.trim(),
          rawBusinessText: `${businessName} | ${coreOffer} | ${pricePoint} | ${websiteUrl}`.trim(),
          offerIntelligence: {
            primaryOfferName: businessName,
            offers: [
              {
                id: "primary",
                name: coreOffer,
                price: pricePoint,
                purchasePath: websiteUrl
              } as any
            ]
          },
          buyerIntelligence: {
            buyers: [
              {
                id: "primary",
                name: targetAudience,
                problems: {
                  rootProblem: painPoints
                }
              } as any
            ]
          },
          creatorIdentity: {
            wordsYouAvoid: wordsToAvoid,
            writingStyle: writingStyle
          } as any,
          updatedAt: new Date().toISOString()
        };

        const updatedProfile: UserProfile = {
          ...(profile || { uid, email: user?.email || "" }),
          ...profilePayload
        } as UserProfile;

        // Immediately update localStorage profile cache so UI and fetchProfile always have fresh data instantly
        if (typeof window !== "undefined") {
          localStorage.setItem(`profile_${uid}`, JSON.stringify(updatedProfile));
          localStorage.setItem("profile", JSON.stringify(updatedProfile));
          window.dispatchEvent(new CustomEvent("profile-updated", { detail: updatedProfile }));
        }

        const docRef = doc(db, "users", uid);
        await withTimeout(setDoc(docRef, sanitizeForFirestore(profilePayload), { merge: true }), 4000, true);
      }

      // LocalStorage Backup
      if (typeof window !== "undefined") {
        if (uid) {
          localStorage.setItem(`threads_raw_voice_${uid}`, creatorContext);
          localStorage.setItem(`threads_custom_instruction_${uid}`, creatorContext);
          localStorage.setItem(`threads_cta_preferences_${uid}`, defaultCta);
          localStorage.setItem(`threadsworks:draft:${uid}:profile:creator-context`, JSON.stringify(creatorContext));
        }
        localStorage.setItem("threads_raw_voice", creatorContext);
        localStorage.setItem("threads_custom_instruction", creatorContext);
        localStorage.setItem("threads_cta_preferences", defaultCta);
        localStorage.setItem("threads_raw_voice_anonymous", creatorContext);
        localStorage.setItem("threads_custom_instruction_anonymous", creatorContext);
        localStorage.setItem("threadsworks:draft:anonymous:profile:creator-context", JSON.stringify(creatorContext));
        window.dispatchEvent(new CustomEvent("creator-context-updated", { detail: creatorContext }));
      }

      hasUserEditedRef.current = false;
      isHydratedRef.current = true;
      setSaveSuccess(true);
      if (onRefreshProfile) onRefreshProfile();
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      console.error("[PROFILE_SAVE_ERROR]", err);
      setSaveError(err.message || "Failed to save profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Save All Creator Context & Structured Intelligence to Firestore (triggers Gemini extraction if text has content)
  const handleSaveProfile = async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const user = auth.currentUser;
      const idToken = user ? await user.getIdToken() : "";
      const uid = user?.uid || profile?.uid;

      let currentBusinessName = businessName;
      let currentCoreOffer = coreOffer;
      let currentPricePoint = pricePoint;
      let currentWebsiteUrl = websiteUrl;
      let currentTargetAudience = targetAudience;
      let currentPainPoints = painPoints;
      let currentWritingStyle = writingStyle;
      let currentWordsToAvoid = wordsToAvoid;
      let currentDefaultCta = defaultCta;

      // Only perform Gemini extraction if Creator Context is populated and significantly different or new
      if (creatorContext && creatorContext.trim().length > 10) {
        try {
          const response = await fetch("/api/profile/extract-intelligence", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": idToken ? `Bearer ${idToken}` : ""
            },
            body: JSON.stringify({
              creatorContext,
              existingData: {
                businessName,
                coreOffer,
                pricePoint,
                websiteUrl,
                targetAudience,
                painPoints,
                writingStyle,
                wordsToAvoid,
                defaultCta
              }
            })
          });
          const data = await response.json();
          if (data.success && data.intelligence) {
            const intel = data.intelligence;
            if (intel.businessName) { setBusinessName(intel.businessName); currentBusinessName = intel.businessName; }
            if (intel.coreOffer) { setCoreOffer(intel.coreOffer); currentCoreOffer = intel.coreOffer; }
            if (intel.pricePoint) { setPricePoint(intel.pricePoint); currentPricePoint = intel.pricePoint; }
            if (intel.websiteUrl) { setWebsiteUrl(intel.websiteUrl); currentWebsiteUrl = intel.websiteUrl; }
            if (intel.targetAudience) { setTargetAudience(intel.targetAudience); currentTargetAudience = intel.targetAudience; }
            if (intel.painPoints) { setPainPoints(intel.painPoints); currentPainPoints = intel.painPoints; }
            if (intel.writingStyle) { setWritingStyle(intel.writingStyle); currentWritingStyle = intel.writingStyle; }
            if (intel.wordsToAvoid) { setWordsToAvoid(intel.wordsToAvoid); currentWordsToAvoid = intel.wordsToAvoid; }
            if (intel.defaultCta) { setDefaultCta(intel.defaultCta); currentDefaultCta = intel.defaultCta; }
            setExtractSuccess(true);
            setTimeout(() => setExtractSuccess(false), 3000);
          }
        } catch (extractErr) {
          console.warn("AI extraction failed, continuing with direct save of current fields:", extractErr);
        }
      }

      // Local Persistence Context Update
      setCustomInstruction(creatorContext);
      setCtaPreferences(currentDefaultCta);

      if (currentWebsiteUrl.trim() && contentDestinations.length === 0) {
        const primaryLink = {
          id: "primary_link",
          name: currentBusinessName || "Primary Link",
          url: currentWebsiteUrl.trim(),
          purpose: "Primary Offer / Website",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        setContentDestinations([primaryLink]);
      }

      // Firestore Persistence Update
      if (uid) {
        const profilePayload: Partial<UserProfile> = {
          offer: currentCoreOffer.trim() || profile?.offer || "",
          audience: currentTargetAudience.trim() || profile?.audience || "",
          writingStyle: currentWritingStyle.trim() || profile?.writingStyle || "Direct, practical, conversational",
          desiredResult: currentPricePoint.trim() || profile?.desiredResult || "",
          customInstruction: creatorContext.trim(),
          ctaPreferences: currentDefaultCta.trim(),
          rawVoice: creatorContext.trim(),
          rawBusinessText: `${currentBusinessName} | ${currentCoreOffer} | ${currentPricePoint} | ${currentWebsiteUrl}`.trim(),
          offerIntelligence: {
            primaryOfferName: currentBusinessName,
            offers: [
              {
                id: "primary",
                name: currentCoreOffer,
                price: currentPricePoint,
                purchasePath: currentWebsiteUrl
              } as any
            ]
          },
          buyerIntelligence: {
            buyers: [
              {
                id: "primary",
                name: currentTargetAudience,
                problems: {
                  rootProblem: currentPainPoints
                }
              } as any
            ]
          },
          creatorIdentity: {
            wordsYouAvoid: currentWordsToAvoid,
            writingStyle: currentWritingStyle
          } as any,
          updatedAt: new Date().toISOString()
        };

        const updatedProfile: UserProfile = {
          ...(profile || { uid, email: user?.email || "" }),
          ...profilePayload
        } as UserProfile;

        // Immediately update localStorage profile cache so UI and fetchProfile always have fresh data instantly
        if (typeof window !== "undefined") {
          localStorage.setItem(`profile_${uid}`, JSON.stringify(updatedProfile));
          localStorage.setItem("profile", JSON.stringify(updatedProfile));
          window.dispatchEvent(new CustomEvent("profile-updated", { detail: updatedProfile }));
        }

        const docRef = doc(db, "users", uid);
        await withTimeout(setDoc(docRef, sanitizeForFirestore(profilePayload), { merge: true }), 4000, true);
      }

      // LocalStorage Backup
      if (typeof window !== "undefined") {
        if (uid) {
          localStorage.setItem(`threads_raw_voice_${uid}`, creatorContext);
          localStorage.setItem(`threads_custom_instruction_${uid}`, creatorContext);
          localStorage.setItem(`threads_cta_preferences_${uid}`, currentDefaultCta);
          localStorage.setItem(`threadsworks:draft:${uid}:profile:creator-context`, JSON.stringify(creatorContext));
        }
        localStorage.setItem("threads_raw_voice", creatorContext);
        localStorage.setItem("threads_custom_instruction", creatorContext);
        localStorage.setItem("threads_cta_preferences", currentDefaultCta);
        localStorage.setItem("threads_raw_voice_anonymous", creatorContext);
        localStorage.setItem("threads_custom_instruction_anonymous", creatorContext);
        localStorage.setItem("threadsworks:draft:anonymous:profile:creator-context", JSON.stringify(creatorContext));
        window.dispatchEvent(new CustomEvent("creator-context-updated", { detail: creatorContext }));
      }

      hasUserEditedRef.current = false;
      isHydratedRef.current = true;
      setSaveSuccess(true);
      if (onRefreshProfile) onRefreshProfile();
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      console.error("[PROFILE_SAVE_ERROR]", err);
      setSaveError(err.message || "Failed to save profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const isPro = subscriptionStatus === "active";
  const isProfileConfigured = Boolean(creatorContext && creatorContext.length > 20);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 md:py-8 space-y-8 animate-fade-in pb-24">
      {/* 1. CREATOR CONTEXT HEADER BAR */}
      <div className="rounded-3xl border border-border-primary bg-bg-card p-6 md:p-8 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-border-primary">
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl md:text-2xl font-bold text-text-primary font-display">
                Creator Context & Intelligence Hub
              </h1>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-extrabold uppercase border ${
                isPro 
                  ? "bg-brand-surface text-brand-text-strong border-brand-border" 
                  : "bg-bg-app text-text-secondary border-border-primary"
              }`}>
                {isPro ? "PRO CREATOR" : "FREE PLAN"}
              </span>
            </div>
            <p className="text-xs md:text-sm text-text-muted leading-relaxed">
              Teach ThreadsWorks who you are, what you do, and how you communicate. ThreadsWorks uses this persistent context to generate high-converting Threads content.
            </p>
          </div>

          {/* Save Profile Top Header Action */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleSaveProfile}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-500/20 transition cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : saveSuccess ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span>{isSaving ? "Saving Context..." : saveSuccess ? "Saved!" : "Save Creator Context"}</span>
            </button>
          </div>
        </div>

        {/* Tab Selector Nav */}
        <div className="flex items-center gap-2 flex-wrap pt-1">
          <button
            onClick={() => setActiveProfileTab("context")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer border ${
              activeProfileTab === "context"
                ? "bg-brand-surface text-brand-text-strong border-brand-border shadow-sm"
                : "bg-bg-app border-border-primary text-text-secondary hover:text-text-primary hover:bg-bg-card-hover"
            }`}
          >
            <User className="w-3.5 h-3.5 text-brand-text" />
            <span>Creator Context & Intelligence</span>
          </button>

          <button
            onClick={() => setActiveProfileTab("partner")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer border ${
              activeProfileTab === "partner"
                ? "bg-brand-surface text-brand-text-strong border-brand-border shadow-sm"
                : "bg-bg-app border-border-primary text-text-secondary hover:text-text-primary hover:bg-bg-card-hover"
            }`}
          >
            <Handshake className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
            <span>Partner Hub</span>
          </button>

          <button
            onClick={() => setActiveProfileTab("share")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer border ${
              activeProfileTab === "share"
                ? "bg-brand-surface text-brand-text-strong border-brand-border shadow-sm"
                : "bg-bg-app border-border-primary text-text-secondary hover:text-text-primary hover:bg-bg-card-hover"
            }`}
          >
            <Share2 className="w-3.5 h-3.5 text-indigo-700 dark:text-indigo-400" />
            <span>Share & Earn</span>
          </button>
        </div>
      </div>

      {/* Save Success / Error Banners */}
      {saveSuccess && (
        <div className="p-4 rounded-2xl bg-status-success-bg border border-status-success-border text-status-success-text text-xs font-bold flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-status-success-text shrink-0" />
            <span>✓ Creator Context and Profile settings saved successfully! All future generations will use this updated intelligence.</span>
          </div>
        </div>
      )}

      {saveError && (
        <div className="p-4 rounded-2xl bg-status-danger-bg border border-status-danger-border text-status-danger-text text-xs font-bold flex items-center gap-2 animate-fade-in">
          <AlertCircle className="h-4 w-4 text-status-danger-text shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {/* MAIN TAB 1: CREATOR CONTEXT & INTELLIGENCE */}
      {activeProfileTab === "context" && (
        <div className="space-y-8 animate-fade-in">
          {/* SECTION 1: CREATOR CONTEXT NATURAL LANGUAGE INPUT */}
          <div className="rounded-3xl border border-border-primary bg-bg-card p-6 md:p-8 space-y-4 shadow-sm">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-brand-text" />
                  <h2 className="text-base md:text-lg font-bold text-text-primary font-display">
                    Creator Context
                  </h2>
                </div>
                <p className="text-xs text-text-muted mt-1 leading-relaxed max-w-3xl">
                  Tell ThreadsWorks about you, your business, audience, offers, voice, and anything it should know when creating content.
                </p>
              </div>
              <VoiceToTextButton
                id="creator-context-voice-btn"
                voice={creatorContextVoice}
                fieldLabel="Creator Context"
                variant="toolbar"
              />
            </div>

            <textarea
              ref={creatorContextTextareaRef}
              id="creator-context-input"
              rows={8}
              value={creatorContext}
              onChange={(e) => handleCreatorContextChange(e.target.value)}
              placeholder="Describe who you are, what you offer, your target audience, communication style, voice preferences, and any important directives or context for your Threads posts."
              className="w-full rounded-2xl border border-border-primary bg-bg-input px-4 py-3.5 text-sm text-text-primary placeholder-text-muted outline-none focus:border-purple-500 transition leading-relaxed font-sans"
            />
            <VoiceInputStatusPanel voice={creatorContextVoice} />

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-500/20 transition cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <RefreshCw className="h-4 w-4 animate-spin animate-spin-slow" />
                ) : saveSuccess ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                ) : (
                  <Sparkles className="h-4 w-4 text-purple-200" />
                )}
                <span>{isSaving ? "Saving Context..." : saveSuccess ? "Context Saved!" : "Save Creator Context"}</span>
              </button>
            </div>
          </div>

          {/* SECTION 2: YOUR LINKS */}
          <YourLinksSection 
            destinations={contentDestinations || []} 
            onChangeDestinations={setContentDestinations} 
          />
        </div>
      )}

      {/* MAIN TAB 2: PARTNER HUB */}
      {activeProfileTab === "partner" && (
        <div className="animate-fade-in">
          <PartnerHubView />
        </div>
      )}

      {/* MAIN TAB 3: SHARE & EARN */}
      {activeProfileTab === "share" && (
        <div className="rounded-3xl border border-border-primary bg-bg-card p-6 md:p-8 space-y-6 shadow-sm animate-fade-in">
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-text-primary font-display flex items-center gap-2">
              <Share2 className="h-5 w-5 text-indigo-700 dark:text-indigo-400" />
              <span>Share ThreadsWorks & Earn Commission</span>
            </h2>
            <p className="text-xs text-text-muted leading-relaxed">
              Share your affiliate link with fellow creators and founders to earn passive revenue on every referral.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-bg-app border border-border-primary space-y-3">
            <label className="text-xs font-bold text-text-secondary uppercase font-mono">
              Your Referral Link
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={`${baseOrigin}/?ref=${partner?.referralCode || auth.currentUser?.uid || "creator"}`}
                className="w-full rounded-xl border border-border-primary bg-bg-input px-3.5 py-2.5 text-xs text-text-primary font-mono outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  const link = `${baseOrigin}/?ref=${partner?.referralCode || auth.currentUser?.uid || "creator"}`;
                  navigator.clipboard.writeText(link);
                  setCopiedKey("ref_link");
                  setTimeout(() => setCopiedKey(null), 2000);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shrink-0 transition cursor-pointer"
              >
                {copiedKey === "ref_link" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span>{copiedKey === "ref_link" ? "Copied" : "Copy Link"}</span>
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
