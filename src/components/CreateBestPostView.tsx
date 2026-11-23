import React, { useRef, useState } from "react";
import {
  Sparkles,
  ArrowLeft,
  Edit3,
  Save,
  Calendar,
  Send,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Zap,
  Target,
  ShieldCheck,
  Check,
  Plus,
  Trash2,
  ExternalLink,
  Layers,
  Award,
  BookOpen
} from "lucide-react";
import { db, auth, withTimeout, handleFirestoreError, OperationType } from "../firebase";
import { collection, addDoc, doc, updateDoc } from "firebase/firestore";
import { UserProfile } from "../types";
import { apiFetch } from "../lib/api";
import { useThreadsConnection } from "../context/ThreadsConnectionContext";
import { useGenerationUsage } from "../services/generationLimitService";
import { recordPostCreation, isProUser, CANONICAL_LIMIT_REACHED_MESSAGE } from "../utils/contentLimit";
import ScheduleModal from "./ScheduleModal";
import PublishModal from "./PublishModal";
import { usePersistentDraft } from "../utils/usePersistentDraft";
import {
  sanitizeSentenceSpacing,
  sanitizeAndValidateBestPost,
  validateGeneratedPost
} from "../lib/contentSanitizer";
import { classifyGenerationError } from "../utils/errorClassifier";
import { useVoiceToText } from "../hooks/useVoiceToText";
import { VoiceInputStatusPanel, VoiceToTextButton } from "./VoiceToTextButton";

interface GeneratedBestPost {
  id: string;
  title: string;
  hook: string;
  singlePost: string;
  threadParts: string[];
  explanation: string;
  category: "attention" | "trust" | "sales" | string;
  format: "single" | "thread" | string;
}

interface IntelligenceFlags {
  profile: boolean;
  flywheel: boolean;
  analytics: boolean;
  contentHistory: boolean;
  contentLibrary: boolean;
  hookIntelligence: boolean;
  contactAngle: boolean;
  cta: boolean;
}

interface CreateBestPostViewProps {
  profile?: UserProfile | null;
  subscriptionStatus?: string;
  onNavigateToTab?: (tab: string) => void;
  onBack?: () => void;
  initialTopic?: string;
}

export default function CreateBestPostView({
  profile,
  subscriptionStatus,
  onNavigateToTab,
  onBack,
  initialTopic
}: CreateBestPostViewProps) {
  const { connected, username: threadsUsername } = useThreadsConnection();
  const effectiveUserId = auth.currentUser?.uid || profile?.uid || "anonymous";
  const isPro = isProUser(profile, subscriptionStatus);
  const { remaining, used, isLimitReached, displayMessage, refreshUsage } = useGenerationUsage(
    effectiveUserId,
    subscriptionStatus,
    profile?.email || auth.currentUser?.email || undefined
  );

  // Inputs
  const [focusInput, setFocusInput] = usePersistentDraft<string>("create-best-post", "focus-input", initialTopic || "");
  const focusTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const focusVoice = useVoiceToText({
    value: focusInput,
    onChange: setFocusInput,
    inputRef: focusTextareaRef,
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState("");
  const [generationError, setGenerationError] = useState("");

  // Pre-generated Strategic Angle and Hook states
  const [generatedAngle, setGeneratedAngle] = usePersistentDraft<{ perspective: string; explanation: string } | null>("create-best-post", "generated-angle", null);
  const [generatedHook, setGeneratedHook] = usePersistentDraft<string | null>("create-best-post", "generated-hook", null);
  const [isPreGenerating, setIsPreGenerating] = useState(false);
  const [preGenerateError, setPreGenerateError] = useState("");
  const [previousAngles, setPreviousAngles] = usePersistentDraft<string[]>("create-best-post", "previous-angles", []);
  const [previousHooks, setPreviousHooks] = usePersistentDraft<string[]>("create-best-post", "previous-hooks", []);

  const getRecentLibraryPosts = () => {
    try {
      const raw = localStorage.getItem(`threadsworks_library_${effectiveUserId}`);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.slice(0, 30).map((p: any) => ({
        title: p?.title || "",
        hook: p?.hook || "",
        singlePost: p?.singlePost || "",
        threadParts: Array.isArray(p?.threadParts) ? p.threadParts : []
      }));
    } catch {
      return [];
    }
  };

  // Result state
  const [postResult, setPostResult] = usePersistentDraft<GeneratedBestPost | null>("create-best-post", "post-result", null);
  const [strategyExplanation, setStrategyExplanation] = usePersistentDraft<string>("create-best-post", "strategy-explanation", "");
  const [winningSignals, setWinningSignals] = usePersistentDraft<string[]>("create-best-post", "winning-signals", []);
  const [intelligenceUsed, setIntelligenceUsed] = useState<IntelligenceFlags>({
    profile: true,
    flywheel: false,
    analytics: false,
    contentHistory: false,
    contentLibrary: false,
    hookIntelligence: false,
    contactAngle: false,
    cta: false
  });
  const [intelligenceSummaryNote, setIntelligenceSummaryNote] = useState("");
  const [integrityReport, setIntegrityReport] = useState<any>(null);

  // Edit Mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editableParts, setEditableParts] = usePersistentDraft<string[]>("create-best-post", "editable-parts", []);

  // Post Status state
  const [postStatus, setPostStatus] = usePersistentDraft<"DRAFT" | "READY" | "SCHEDULED" | "PUBLISHED">("create-best-post", "post-status", "READY");
  const [savedPostId, setSavedPostId] = useState<string | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState("");

  // History tracking for "Create Another"
  const [previousGenerations, setPreviousGenerations] = useState<string[]>([]);

  // Modals state
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);

  // Execute Pre-Generation of Strategic Angle & Hook
  const handlePreGenerateAngleAndHook = async () => {
    if (!isPro && isLimitReached) {
      if (onNavigateToTab) onNavigateToTab("pricing");
      return;
    }
    if (isPreGenerating) return;
    setIsPreGenerating(true);
    setPreGenerateError("");
    setSaveSuccessMsg("");

    try {
      const res: any = await apiFetch("/api/generate-angle-and-hook", {
        method: "POST",
        body: JSON.stringify({
          userId: effectiveUserId,
          selectedSavedTabId: (profile as any)?.activeSavedTabId || (profile as any)?.savedTabId || "default",
          topic: focusInput.trim() || "creating high-converting Threads content",
          profile,
          previousAngles,
          previousHooks,
          recentLibraryPosts: getRecentLibraryPosts()
        })
      });

      if (res && res.success && res.angle && res.hook) {
        setGeneratedAngle(res.angle);
        setGeneratedHook(res.hook);
        setPreviousAngles(prev => [res.angle.perspective, ...prev].slice(0, 10));
        setPreviousHooks(prev => [res.hook, ...prev].slice(0, 10));
      } else {
        throw new Error(res?.error || "Failed to pre-generate angle and hook.");
      }
    } catch (err: any) {
      console.error("Error pre-generating angle/hook:", err);
      setPreGenerateError(err?.message || "Failed to pre-generate. Please check your topic/connection.");
    } finally {
      setIsPreGenerating(false);
    }
  };

  // Execute Best Post Generation
  const handleGenerateBestPost = async () => {
    if (!isPro && isLimitReached) {
      if (onNavigateToTab) onNavigateToTab("pricing");
      return;
    }
    if (isGenerating) return;

    setIsGenerating(true);
    setPreGenerateError("");
    setGenerationError("");
    setSaveSuccessMsg("");
    setPublishedUrl(null);
    setPostStatus("READY");

    const recentLibraryPosts = getRecentLibraryPosts();
    const activeTabId = (profile as any)?.activeSavedTabId || (profile as any)?.savedTabId || "default";

    let activeAngle: { perspective: string; explanation: string } | null = generatedAngle || null;
    let activeHook: string | null = generatedHook || null;

    // 1. Reuse pre-generated angle & hook if available; otherwise formulate fresh ones
    if (!activeAngle || !activeHook) {
      setGenerationStep("Formulating Strategic Angle & Hook...");
      try {
        const resAngle: any = await apiFetch("/api/generate-angle-and-hook", {
          method: "POST",
          body: JSON.stringify({
            userId: effectiveUserId,
            selectedSavedTabId: activeTabId,
            topic: focusInput.trim() || "creating high-converting Threads content",
            profile,
            previousAngles,
            previousHooks,
            recentLibraryPosts
          })
        });
        if (resAngle && resAngle.success && resAngle.angle && resAngle.hook) {
          activeAngle = resAngle.angle;
          activeHook = resAngle.hook;
          setGeneratedAngle(resAngle.angle);
          setGeneratedHook(resAngle.hook);
          setPreviousAngles(prev => [resAngle.angle.perspective, ...prev].slice(0, 10));
          setPreviousHooks(prev => [resAngle.hook, ...prev].slice(0, 10));
        }
      } catch (err) {
        console.warn("Auto angle/hook formulation note:", err);
      }
    }

    const steps = [
      "Synthesizing Profile DNA & Identity...",
      "Analyzing Viral Flywheel & Historical Signals...",
      "Applying Strategic Angle & Locked Hook...",
      "Formulating Strongest Next Opportunity..."
    ];

    let stepIdx = 0;
    setGenerationStep(steps[0]);
    const stepInterval = setInterval(() => {
      stepIdx = (stepIdx + 1) % steps.length;
      setGenerationStep(steps[stepIdx]);
    }, 1200);

    try {
      const res: any = await apiFetch("/api/create-best-post", {
        method: "POST",
        body: JSON.stringify({
          userId: effectiveUserId,
          selectedSavedTabId: activeTabId,
          focusInput: focusInput.trim(),
          profile,
          previousPosts: previousGenerations,
          recentLibraryPosts,
          angle: activeAngle,
          hook: activeHook
        })
      });

      clearInterval(stepInterval);

      if (res && res.success && res.post) {
        const sanitizedPost = res.generatorVersion === "V3"
          ? res.post
          : sanitizeAndValidateBestPost(res.post, activeHook || undefined, 480, {
              offer: profile?.offer,
              audience: profile?.audience,
              desiredResult: profile?.desiredResult
            }).post;
        setPostResult(sanitizedPost);
        const finalParts = sanitizedPost.threadParts && sanitizedPost.threadParts.length > 0
          ? [...sanitizedPost.threadParts]
          : [sanitizedPost.singlePost];
        setEditableParts(finalParts);
        setStrategyExplanation(sanitizeSentenceSpacing(res.strategyExplanation || "Formulated grounded in your strongest profile positioning and performance intelligence."));
        setWinningSignals(res.winningSignals || ["Topic: High-performing positioning", "Hook: Pattern interrupt", "Format: Mobile 1-2 line rhythm"]);
        
        if (res.intelligenceUsed) {
          setIntelligenceUsed(res.intelligenceUsed);
        }
        if (res.integrityReport) {
          setIntegrityReport(res.integrityReport);
        }
        setIntelligenceSummaryNote(sanitizeSentenceSpacing(res.intelligenceSummaryNote || "Grounded in Profile DNA and performance intelligence."));

        // Track generation to prevent repetition in subsequent runs
        if (sanitizedPost.singlePost) {
          setPreviousGenerations(prev => [sanitizedPost.singlePost, ...prev].slice(0, 10));
        }

        // Record successful generation and refresh limit usage
        recordPostCreation(effectiveUserId);
        refreshUsage();
      } else {
        throw new Error(res?.error || "Failed to generate recommendation.");
      }
    } catch (err: any) {
      clearInterval(stepInterval);
      console.error("Error generating best post:", err);
      const classified = classifyGenerationError(err, { stage: "network_request" });
      setGenerationError(
        classified.userMessage || err?.message || "Failed to generate your best post. Please try again."
      );
    } finally {
      setIsGenerating(false);
      setGenerationStep("");
    }
  };

  // Editable part changes
  const handlePartChange = (index: number, value: string) => {
    const updated = [...editableParts];
    updated[index] = value;
    setEditableParts(updated);
  };

  const handleAddPart = () => {
    if (editableParts.length >= 5) return;
    setEditableParts([...editableParts, ""]);
  };

  const handleRemovePart = (index: number) => {
    if (editableParts.length <= 1) return;
    setEditableParts(editableParts.filter((_, i) => i !== index));
  };

  // Save Draft Action
  const handleSaveDraft = async () => {
    if (!postResult || isSavingDraft) return;
    setIsSavingDraft(true);
    setSaveSuccessMsg("");

    const rawPartsToSave = isEditing ? editableParts : (postResult.threadParts || [postResult.singlePost]);
    const partsToSave = rawPartsToSave.map(sanitizeSentenceSpacing);

    try {
      const savedDocPayload = {
        userId: effectiveUserId,
        title: postResult.title || "Best Post Recommendation",
        hook: partsToSave[0] ? partsToSave[0].split("\n")[0].slice(0, 140) : "Recommended Post",
        singlePost: partsToSave[0] || "",
        threadParts: partsToSave,
        threadPosts: partsToSave,
        explanation: strategyExplanation,
        topic: profile?.offer || "Social Strategy",
        format: partsToSave.length > 1 ? "thread" : "single",
        category: postResult.category || "trust",
        status: "Draft",
        isPublished: false,
        createdAt: new Date().toISOString(),
        sourceApp: "create-best-post"
      };

      const docRef = await withTimeout(
        addDoc(collection(db, "posts"), savedDocPayload),
        4000,
        true
      );

      setSavedPostId(docRef.id);
      setPostStatus("DRAFT");
      setSaveSuccessMsg("Saved as Draft in Content Library!");
      setTimeout(() => setSaveSuccessMsg(""), 4000);
    } catch (err: any) {
      console.error("Failed to save draft:", err);
      handleFirestoreError(err, OperationType.CREATE, "posts");
      alert("Failed to save draft to database. Please check connection.");
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Callback when scheduling succeeds
  const handleScheduleSuccess = () => {
    setPostStatus("SCHEDULED");
    setSaveSuccessMsg("Post scheduled successfully! Check Calendar.");
    setTimeout(() => setSaveSuccessMsg(""), 5000);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto px-2 sm:px-4 py-4" id="create-best-post-view">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-primary pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {onBack && (
              <button
                onClick={onBack}
                className="inline-flex items-center gap-1.5 text-xs text-text-secondary hover:text-brand-text transition-colors mr-2 cursor-pointer"
                id="back-to-apps-btn"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Apps
              </button>
            )}
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-brand-surface text-brand-text border border-brand-border uppercase tracking-wider">
              <Sparkles className="w-3 h-3" />
              Content Intelligence
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight flex items-center gap-2">
            Create Your Best Next Post
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary max-w-2xl leading-relaxed">
            ThreadsWorks analyzes your creator profile, content history, performance, audience signals, and learned patterns to determine what you should create next.
          </p>
        </div>

        {onNavigateToTab && (
          <button
            onClick={() => onNavigateToTab("library")}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-bg-card border border-border-primary text-text-secondary hover:text-text-primary hover:bg-bg-card-hover transition-all self-start sm:self-auto cursor-pointer"
            id="open-library-btn"
          >
            <BookOpen className="w-3.5 h-3.5 text-brand-text" />
            Content Library
          </button>
        )}
      </div>

      {/* Input Section */}
      <div className="bg-bg-card border border-border-primary rounded-xl p-4 sm:p-6 space-y-4 shadow-sm">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label
              htmlFor="focus-direction-input"
              className="text-xs font-semibold text-text-primary uppercase tracking-wider flex items-center gap-2"
            >
              <span>Anything you want to focus on?</span>
              <span className="text-[10px] text-text-muted font-normal">Optional</span>
            </label>
            <VoiceToTextButton
              id="best-post-voice-btn"
              voice={focusVoice}
              fieldLabel="focus direction"
              variant="compact"
            />
          </div>
          <textarea
            ref={focusTextareaRef}
            value={focusInput}
            onChange={(e) => setFocusInput(e.target.value)}
            placeholder="Optional. Give ThreadsWorks a topic, offer, idea, promotion, or goal to prioritize..."
            rows={2}
            className="w-full bg-bg-input border border-border-primary rounded-lg p-3 text-xs sm:text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-purple-600 transition-colors resize-none"
            id="focus-direction-input"
          />
          <VoiceInputStatusPanel voice={focusVoice} />
          <p className="text-[11px] text-text-muted mt-1.5 leading-normal">
            If blank, ThreadsWorks determines the content opportunity automatically from your profile, audience response, and performance history.
          </p>
        </div>

        {/* Dynamic Pre-Generation Panel */}
        <div className="border-t border-border-primary pt-4 mt-2 space-y-4">
          {/* Free Generation Allowance / Limit Indicator */}
          {!isPro && (
            <div>
              {isLimitReached ? (
                <div className="p-3.5 rounded-xl border border-status-danger-border bg-status-danger-bg space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-status-danger-text">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Free Generation Limit Reached (150/150)</span>
                  </div>
                  <p className="text-xs text-status-danger-text">
                    You've used all 150 Free AI content generations this month.
                  </p>
                  <button
                    onClick={() => onNavigateToTab?.("pricing")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 shadow-md transition cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Upgrade to Pro for Unlimited Generations</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-bg-app border border-border-primary text-xs">
                  <span className="text-text-secondary flex items-center gap-1.5 font-medium">
                    <Sparkles className="w-3.5 h-3.5 text-brand-text" />
                    Free Plan Allowance
                  </span>
                  <span className="font-mono text-brand-text font-bold">
                    {displayMessage}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Single Primary Action: Create Best Post */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <button
              onClick={handleGenerateBestPost}
              disabled={isGenerating}
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-600/20 transition-all active:scale-[0.99] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              id="create-best-post-btn"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-purple-100" />
                  <span>Creating best post...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-purple-100" />
                  <span>Create Best Post</span>
                </>
              )}
            </button>

            <p className="text-xs text-text-secondary flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-brand-text shrink-0" />
              <span>ThreadsWorks will automatically determine the strongest angle, hook, and post.</span>
            </p>
          </div>
        </div>
      </div>

      {/* Generation Error Banner */}
      {generationError && (
        <div className="p-3.5 bg-status-danger-bg border border-status-danger-border rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-status-danger-text animate-fade-in">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{generationError}</span>
          </div>
          <button
            onClick={handleGenerateBestPost}
            disabled={isGenerating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-bg-card hover:bg-bg-card-hover border border-status-danger-border text-status-danger-text font-semibold transition-colors cursor-pointer shrink-0 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? "animate-spin" : ""}`} />
            Try Again
          </button>
        </div>
      )}

      {/* Saved / Success Banner */}
      {saveSuccessMsg && (
        <div className="p-3 bg-status-success-bg border border-status-success-border rounded-lg flex items-center gap-2 text-xs text-status-success-text font-medium animate-fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Generated Post Result Card */}
      {postResult && (
        <div className="space-y-6 animate-fade-in">
          {/* Main Recommended Post Card */}
          <div className="bg-bg-card border border-brand-border rounded-xl overflow-hidden shadow-md">
            {/* Header Bar */}
            <div className="bg-bg-app px-4 sm:px-6 py-3.5 border-b border-border-primary flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-purple-600 dark:bg-purple-400 animate-pulse" />
                <span className="text-xs font-bold text-text-primary tracking-wide uppercase">
                  YOUR RECOMMENDED POST
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-semibold bg-brand-surface text-brand-text border border-brand-border">
                  {postResult.format === "thread" ? "Multi-Part Thread" : "Single Post"}
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-semibold bg-status-success-bg text-status-success-text border border-status-success-border" title="Content Integrity Checker: 100% complete sentences, zero fragmented thoughts, zero random characters.">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Integrity Verified</span>
                </span>

                <span className={`text-[10px] px-2 py-0.5 rounded font-semibold border ${
                  postStatus === "PUBLISHED"
                    ? "bg-status-success-bg text-status-success-text border-status-success-border"
                    : postStatus === "SCHEDULED"
                    ? "bg-status-info-bg text-status-info-text border-status-info-border"
                    : postStatus === "DRAFT"
                    ? "bg-status-warning-bg text-status-warning-text border-status-warning-border"
                    : "bg-brand-surface text-brand-text border-brand-border"
                }`}>
                  STATUS: {postStatus}
                </span>

                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    isEditing
                      ? "bg-purple-600 text-white"
                      : "bg-bg-card border border-border-primary text-text-secondary hover:text-text-primary hover:bg-bg-card-hover"
                  }`}
                  id="toggle-edit-post-btn"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  {isEditing ? "Done Editing" : "Edit"}
                </button>
              </div>
            </div>

            {/* Post Content Body */}
            <div className="p-4 sm:p-6 space-y-4">
              {isEditing ? (
                /* Edit Mode */
                <div className="space-y-4">
                  <p className="text-xs text-brand-text font-medium">
                    Edit your post content before publishing or scheduling:
                  </p>
                  {editableParts.map((partText, idx) => (
                    <div key={idx} className="bg-bg-input border border-border-primary rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-text-muted">
                        <span className="font-semibold text-text-primary">Part {idx + 1}</span>
                        <div className="flex items-center gap-2">
                          <span className={partText.length > 500 ? "text-status-danger-text font-bold" : "text-text-muted"}>
                            {partText.length} / 500
                          </span>
                          {editableParts.length > 1 && (
                            <button
                              onClick={() => handleRemovePart(idx)}
                              className="text-text-muted hover:text-status-danger-text transition-colors p-1 cursor-pointer"
                              title="Remove part"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      <textarea
                        value={partText}
                        onChange={(e) => handlePartChange(idx, e.target.value)}
                        rows={4}
                        className="w-full bg-transparent text-xs sm:text-sm text-text-primary placeholder:text-text-muted focus:outline-none resize-y leading-relaxed font-sans"
                      />
                    </div>
                  ))}

                  {editableParts.length < 5 && (
                    <button
                      onClick={handleAddPart}
                      className="inline-flex items-center gap-1.5 text-xs text-brand-text hover:underline transition-colors font-semibold pt-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Thread Part
                    </button>
                  )}
                </div>
              ) : (
                /* Read / Display Mode */
                <div className="space-y-3">
                  {editableParts.map((partText, idx) => (
                    <div
                      key={idx}
                      className="bg-bg-app border border-border-primary rounded-lg p-4 space-y-2 relative group hover:border-border-secondary transition-colors"
                    >
                      {editableParts.length > 1 && (
                        <div className="text-[10px] font-mono text-brand-text font-semibold uppercase tracking-wider">
                          Part {idx + 1}
                        </div>
                      )}
                      <p className="text-xs sm:text-sm text-text-primary whitespace-pre-wrap leading-relaxed font-sans">
                        {partText}
                      </p>
                      <div className="flex items-center justify-between pt-2 border-t border-border-primary text-[10px] text-text-muted">
                        <span>{partText.length} characters</span>
                        <span>Optimized for mobile reading</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div className="bg-bg-app px-4 sm:px-6 py-4 border-t border-border-primary flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleSaveDraft}
                  disabled={isSavingDraft}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-bg-card border border-border-primary text-text-primary hover:bg-bg-card-hover transition-all shadow-xs cursor-pointer"
                  id="save-draft-btn"
                >
                  <Save className="w-3.5 h-3.5 text-status-warning-text" />
                  <span>Save Draft</span>
                </button>

                <button
                  onClick={() => setIsScheduleModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-bg-card border border-border-primary text-text-primary hover:bg-bg-card-hover transition-all shadow-xs cursor-pointer"
                  id="schedule-post-btn"
                >
                  <Calendar className="w-3.5 h-3.5 text-status-info-text" />
                  <span>Schedule</span>
                </button>

                <button
                  onClick={() => setIsPublishModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 transition-all shadow-md active:scale-95 cursor-pointer"
                  id="post-now-btn"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Post Now</span>
                </button>
              </div>

              <button
                onClick={handleGenerateBestPost}
                disabled={isGenerating}
                className="inline-flex items-center gap-1.5 text-xs text-brand-text hover:underline font-semibold transition-colors cursor-pointer"
                id="create-another-btn"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? "animate-spin" : ""}`} />
                <span>Create Another</span>
              </button>
            </div>
          </div>

          {/* Strategy & Intelligence Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* WHY THIS POST */}
            <div className="bg-bg-card border border-border-primary rounded-xl p-5 space-y-3 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-bold text-text-primary uppercase tracking-wider">
                <Target className="w-4 h-4 text-brand-text" />
                <span>WHY THIS POST</span>
              </div>
              <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                {strategyExplanation}
              </p>

              {/* WINNING SIGNALS */}
              {winningSignals.length > 0 && (
                <div className="pt-2 border-t border-border-primary space-y-2">
                  <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                    WINNING SIGNALS
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {winningSignals.map((sig, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-brand-surface text-brand-text border border-brand-border"
                      >
                        <Zap className="w-3 h-3" />
                        {sig}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* INTELLIGENCE USED */}
            <div className="bg-bg-card border border-border-primary rounded-xl p-5 space-y-3 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-bold text-text-primary uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4 text-status-success-text" />
                <span>INTELLIGENCE USED</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className={`p-2 rounded-lg border flex items-center gap-2 font-medium ${
                  intelligenceUsed.profile
                    ? "bg-status-success-bg border-status-success-border text-status-success-text"
                    : "bg-bg-app border-border-primary text-text-muted"
                }`}>
                  <Check className="w-3.5 h-3.5" />
                  <span>Profile DNA</span>
                </div>

                <div className={`p-2 rounded-lg border flex items-center gap-2 font-medium ${
                  intelligenceUsed.flywheel || intelligenceUsed.analytics
                    ? "bg-status-success-bg border-status-success-border text-status-success-text"
                    : "bg-bg-app border-border-primary text-text-muted"
                }`}>
                  <Check className="w-3.5 h-3.5" />
                  <span>Winning Topics</span>
                </div>

                <div className={`p-2 rounded-lg border flex items-center gap-2 font-medium ${
                  intelligenceUsed.hookIntelligence
                    ? "bg-status-success-bg border-status-success-border text-status-success-text"
                    : "bg-bg-app border-border-primary text-text-muted"
                }`}>
                  <Check className="w-3.5 h-3.5" />
                  <span>Winning Hooks</span>
                </div>

                <div className={`p-2 rounded-lg border flex items-center gap-2 font-medium ${
                  intelligenceUsed.analytics
                    ? "bg-status-success-bg border-status-success-border text-status-success-text"
                    : "bg-bg-app border-border-primary text-text-muted"
                }`}>
                  <Check className="w-3.5 h-3.5" />
                  <span>Recent Performance</span>
                </div>

                <div className={`p-2 rounded-lg border flex items-center gap-2 font-medium ${
                  intelligenceUsed.contentHistory
                    ? "bg-status-success-bg border-status-success-border text-status-success-text"
                    : "bg-bg-app border-border-primary text-text-muted"
                }`}>
                  <Check className="w-3.5 h-3.5" />
                  <span>Content History</span>
                </div>

                <div className={`p-2 rounded-lg border flex items-center gap-2 font-medium ${
                  intelligenceUsed.cta
                    ? "bg-status-success-bg border-status-success-border text-status-success-text"
                    : "bg-bg-app border-border-primary text-text-muted"
                }`}>
                  <Check className="w-3.5 h-3.5" />
                  <span>CTA Intelligence</span>
                </div>
              </div>

              <p className="text-[11px] text-text-muted pt-1 leading-normal italic">
                {intelligenceSummaryNote}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Modal Integration */}
      {isScheduleModalOpen && postResult && (
        <ScheduleModal
          isOpen={isScheduleModalOpen}
          onClose={() => setIsScheduleModalOpen(false)}
          postText={editableParts[0] || ""}
          parts={editableParts}
          title={postResult.title}
          topic={profile?.offer || "Social Strategy"}
          profile={profile}
          subscriptionStatus={subscriptionStatus}
          onSuccess={handleScheduleSuccess}
          onNavigateToTab={onNavigateToTab}
        />
      )}

      {/* Direct Threads Publish Modal Integration */}
      {isPublishModalOpen && postResult && (
        <PublishModal
          isOpen={isPublishModalOpen}
          onClose={() => setIsPublishModalOpen(false)}
          postText={editableParts[0] || ""}
          parts={editableParts}
          userId={effectiveUserId}
          onNavigateToTab={onNavigateToTab}
          postId={savedPostId || `best_post_${Date.now()}`}
        />
      )}
    </div>
  );
}
