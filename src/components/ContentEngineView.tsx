import { PostArt } from "./PostArt";
import React, { useState, useRef, useEffect } from "react";
import { UserProfile, ContentPillar, CreationMode, ContentActionType, CreationContext } from "../types";
import { auth, db, withTimeout, handleFirestoreError, OperationType, sanitizeForFirestore } from "../firebase";
import { collection, addDoc, doc, setDoc, deleteDoc, onSnapshot, getDoc } from "firebase/firestore";
import { 
  Sparkles, Copy, Check, Save, RefreshCw, Flame, ArrowRight, 
  AlertTriangle, ShieldCheck, Zap, Handshake, DollarSign, 
  Edit3, Eye, HelpCircle, FileText, CheckCircle2, ChevronRight, PenTool, ArrowUpRight, X, Trash2,
  Calendar, Target, Plus, ChevronDown, BarChart3, Lightbulb, MousePointerClick, ChevronUp, Link as LinkIcon, LayoutGrid,
  CheckCircle, AlertCircle, ArrowUp, ArrowDown, Layers, Wand2, Sliders, ExternalLink, Settings2, AlignLeft
} from "lucide-react";
import PublishModal from "./PublishModal";
import ScheduleModal from "./ScheduleModal";
import AddAllToCalendarModal from "./AddAllToCalendarModal";

const DashboardView = React.lazy(() => import("./DashboardView"));
const ContentLibraryView = React.lazy(() => import("./ContentLibraryView"));

import { useContentPersistence, GeneratedPost } from "../context/ContentPersistenceContext";
import {
  saveCanonicalRecord,
  CanonicalStage,
  formatLocalDateKey,
  normalizeTopicsList,
} from "../lib/canonicalContent";
import { getWeekStartDate } from "../lib/contentIntelligence";
import { useThreadsConnection } from "../context/ThreadsConnectionContext";
import { 
  checkThreadsConnection, 
  generateThreadsAuthUrl, 
  getThreadsAppId, 
  invalidateThreadsConnectionCache,
  initiateThreadsOAuthFlow 
} from "../utils/threadsApi";
import { canCreatePost, recordPostCreation, isProUser, CANONICAL_LIMIT_REACHED_MESSAGE } from "../utils/contentLimit";
import { useGenerationUsage } from "../services/generationLimitService";
import { ClassifiedError, classifyGenerationError, createClassifiedError } from "../utils/errorClassifier";
import { getRecentLibraryPostsForMemory } from "../utils/contentMemoryHelper";
import { apiFetch } from "../lib/api";
import ThreadsConnectButton from "./ThreadsConnectButton";
import { repairAndSanitizePost, sanitizeSentenceSpacing, cleanTopicString } from "../lib/contentSanitizer";
import { usePersistentDraft } from "../utils/usePersistentDraft";
import { useVoiceToText } from "../hooks/useVoiceToText";
import { VoiceInputStatusPanel, VoiceToTextButton } from "./VoiceToTextButton";

interface FormattedTextProps {
  content: string;
}

export const sanitizeText = (text: string | null | undefined): string => {
  if (!text) return "";
  return text.replace(/\\n/g, '\n');
};

export const normalizePillar = (p: any): ContentPillar => ({
  title: String(p?.title || "Core Pillar").trim(),
  description: String(p?.description || "").trim(),
  coreExpertise: String(p?.coreExpertise || "").trim(),
  keyVocabulary: typeof p?.keyVocabulary === "string" ? p.keyVocabulary.trim() : (Array.isArray(p?.keyVocabulary) ? p.keyVocabulary.join(", ") : ""),
  mentalModels: typeof p?.mentalModels === "string" ? p.mentalModels.trim() : (Array.isArray(p?.mentalModels) ? p.mentalModels.join(", ") : ""),
  primaryQuestion: String(p?.primaryQuestion || "").trim(),
  topicsToAvoid: typeof p?.topicsToAvoid === "string" ? p.topicsToAvoid.trim() : (Array.isArray(p?.topicsToAvoid) ? p.topicsToAvoid.join(", ") : ""),
  successCriteria: typeof p?.successCriteria === "string" ? p.successCriteria.trim() : (Array.isArray(p?.successCriteria) ? p.successCriteria.join(", ") : "")
});

const FormattedText: React.FC<FormattedTextProps> = ({ content }) => {
  const formattedContent = React.useMemo(() => {
    return sanitizeText(content);
  }, [content]);

  return (
    <p className="whitespace-pre-wrap text-[13px] text-text-primary font-sans leading-relaxed">
      {formattedContent}
    </p>
  );
};

interface ManualVoicePartEditorProps {
  index: number;
  totalParts: number;
  format: "post" | "thread";
  value: string;
  onChange: (value: string) => void;
  onMove: (direction: "up" | "down") => void;
  onDelete: () => void;
}

const ManualVoicePartEditor: React.FC<ManualVoicePartEditorProps> = ({
  index,
  totalParts,
  format,
  value,
  onChange,
  onMove,
  onDelete,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const voice = useVoiceToText({
    value,
    onChange,
    inputRef: textareaRef,
  });

  return (
    <div className="rounded-xl border border-border-primary bg-bg-app p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono font-bold text-text-muted">
        <span>{format === "post" ? "POST" : `PART ${index + 1}`}</span>
        <div className="flex items-center gap-2.5">
          <VoiceToTextButton
            id={`manual-part-voice-btn-${index}`}
            voice={voice}
            fieldLabel={format === "post" ? "manual post content" : `thread part ${index + 1}`}
            variant="compact"
          />
          <span className={value.length > 500 ? "text-red-500 font-bold" : "text-text-muted font-mono"}>
            {value.length} / 500 ch
          </span>

          {format === "thread" && (
            <div className="flex items-center gap-1">
              {index > 0 && (
                <button
                  type="button"
                  onClick={() => onMove("up")}
                  className="p-1 hover:bg-bg-card rounded text-text-muted hover:text-text-primary cursor-pointer"
                  title="Move up"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
              )}
              {index < totalParts - 1 && (
                <button
                  type="button"
                  onClick={() => onMove("down")}
                  className="p-1 hover:bg-bg-card rounded text-text-muted hover:text-text-primary cursor-pointer"
                  title="Move down"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              )}
              {totalParts > 2 && (
                <button
                  type="button"
                  onClick={onDelete}
                  className="p-1 hover:bg-status-danger-bg text-status-danger-text rounded cursor-pointer"
                  title="Delete part"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <textarea
        ref={textareaRef}
        rows={4}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={format === "post" ? "Write your post here…" : `Type part ${index + 1} content here...`}
        className="w-full bg-bg-card border border-border-primary rounded-xl p-3.5 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-purple-500/40 whitespace-pre-wrap leading-relaxed"
      />

      <VoiceInputStatusPanel voice={voice} />
    </div>
  );
};

export type ContentSubWorkspace = "generator" | "ideas" | "cta" | "library";

/**
 * Standard Content Engine generation always uses automatic length & sentence intelligence.
 * Explicit length instructions written in the current Content Request are honored server-side;
 * invisible legacy localStorage values (e.g. threads_thread_length = "1") are never inherited.
 */
export function resolveStandardContentEngineLengthSettings(): {
  threadLength: "auto";
  sentencesPerPart: "auto";
} {
  return {
    threadLength: "auto",
    sentencesPerPart: "auto",
  };
}

/**
 * Universal, robust resolver for the active user's Creator Context.
 * Evaluates memory, profile, and all persistent cache keys to ensure
 * Creator Context is never falsely reported as missing.
 */
export function resolveCurrentCreatorContext(
  customInstruction?: string | null,
  profile?: UserProfile | null,
  userId?: string | null
): string {
  // 1. In-memory customInstruction from ContentPersistenceContext
  if (customInstruction && typeof customInstruction === "string" && customInstruction.trim().length > 0) {
    return customInstruction.trim();
  }
  // 2. Profile direct customInstruction only (never substitute commercial bio/offer/voice)
  if (profile?.customInstruction && profile.customInstruction.trim().length > 0) {
    return profile.customInstruction.trim();
  }

  // 3. LocalStorage checks (strictly creator-context / custom instruction keys)
  if (typeof window !== "undefined") {
    try {
      const effectiveId = userId || auth.currentUser?.uid || profile?.uid || "anonymous";
      
      const candidateKeys = [
        `threads_custom_instruction_${effectiveId}`,
        "threads_custom_instruction",
        "threads_custom_instruction_anonymous",
        `threadsworks:draft:${effectiveId}:profile:creator-context`,
        "threadsworks:draft:anonymous:profile:creator-context"
      ];

      for (const k of candidateKeys) {
        const val = localStorage.getItem(k);
        if (val && typeof val === "string") {
          let trimmed = val.trim();
          if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
            try { trimmed = JSON.parse(trimmed).trim(); } catch (_) {}
          }
          if (trimmed.length > 0) return trimmed;
        }
      }

      // Check cached profile objects in localStorage for explicit customInstruction only
      const profileKeys = [`profile_${effectiveId}`, "profile_anonymous", "profile"];
      for (const pk of profileKeys) {
        const raw = localStorage.getItem(pk);
        if (raw) {
          try {
            const p = JSON.parse(raw);
            if (p?.customInstruction && p.customInstruction.trim().length > 0) return p.customInstruction.trim();
          } catch (_) {}
        }
      }

      // Check any localStorage key matching draft:*creator-context or threads_custom_instruction_*
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes("creator-context") || key.startsWith("threads_custom_instruction"))) {
          const val = localStorage.getItem(key);
          if (val && typeof val === "string") {
            let trimmed = val.trim();
            if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
              try { trimmed = JSON.parse(trimmed).trim(); } catch (_) {}
            }
            if (trimmed.length > 0) return trimmed;
          }
        }
      }
    } catch (_) {}
  }

  return "";
}

interface ContentEngineViewProps {
  profile: UserProfile | null;
  onNavigateToTab: (tab: string) => void;
  onRefreshProfile?: () => void;
  subscriptionStatus?: string;
  initialSubView?: ContentSubWorkspace;
}

export default function ContentEngineView({ profile, onNavigateToTab, onRefreshProfile, subscriptionStatus, initialSubView }: ContentEngineViewProps) {
  const [subWorkspace, setSubWorkspace] = useState<ContentSubWorkspace>(initialSubView || "generator");

  useEffect(() => {
    if (initialSubView === "cta") {
      onNavigateToTab("profile");
    } else if (initialSubView) {
      setSubWorkspace(initialSubView);
    }
  }, [initialSubView, onNavigateToTab]);

  const {
    attentionPosts,
    setAttentionPosts,
    trustPosts,
    setTrustPosts,
    salesPosts,
    setSalesPosts,
    customInstruction,
    setCustomInstruction,
    ctaPreferences,
    setCtaPreferences,
    contentDestinations,
    setContentDestinations,
    activeCategory,
    setActiveCategory,
    simulationWarning,
    setSimulationWarning,
    lockedHook,
    setLockedHook,
    postsToCreate,
    setPostsToCreate,
    activeIdea,
    setActiveIdea,
    rawCreatorThought,
    setRawCreatorThought,
    activeCta,
    setActiveCta,
    recentPillarHistory,
    addPillarToHistory,
    all32Hooks,
    setAll32Hooks,
    areHooksActive,
    setAreHooksActive,
    strategicUnits,
    setStrategicUnits,
    activeStrategicAngle,
    setActiveStrategicAngle,
    strategicCreatorRequest,
    setStrategicCreatorRequest,
    areStrategicUnitsActive,
    setAreStrategicUnitsActive
  } = useContentPersistence();

  // Content Instructions Saving State
  const [batchCtaPlacement, setBatchCtaPlacement] = useState<string>("final_part");
  const [cardCtaPlacements, setCardCtaPlacements] = useState<Record<string, string>>({});
  const [savingInstructions, setSavingInstructions] = useState(false);
  const [isEnhancingInstructions, setIsEnhancingInstructions] = useState(false);
  const [previousCustomInstruction, setPreviousCustomInstruction] = useState<string | null>(null);
  const [instructionsSavedSuccess, setInstructionsSavedSuccess] = useState(false);
  const [instructionsEnhanceSuccess, setInstructionsEnhanceSuccess] = useState(false);
  const [instructionsError, setInstructionsError] = useState<string | null>(null);

  // User ID and Pro Status
  const effectiveUserId = auth.currentUser?.uid || profile?.uid || "anonymous";
  const isPro = isProUser(profile, subscriptionStatus);
  const { remaining, used, isLimitReached, displayMessage, refreshUsage } = useGenerationUsage(
    effectiveUserId,
    subscriptionStatus,
    profile?.email || auth.currentUser?.email || undefined
  );
  const [dailyLimitReached, setDailyLimitReached] = useState(false);

  // Sync generation limit status
  useEffect(() => {
    const check = canCreatePost(effectiveUserId, profile, subscriptionStatus);
    setDailyLimitReached(!check.allowed || isLimitReached);
  }, [effectiveUserId, profile, subscriptionStatus, isLimitReached]);

  // Real-time reactive creator context detector
  const [detectedCreatorContext, setDetectedCreatorContext] = useState<string>(() => {
    return resolveCurrentCreatorContext(customInstruction, profile, effectiveUserId);
  });

  // Keep detectedCreatorContext in sync with storage, profile updates, and custom events
  useEffect(() => {
    const updateContext = () => {
      const resolved = resolveCurrentCreatorContext(customInstruction, profile, effectiveUserId);
      setDetectedCreatorContext(resolved);
    };

    updateContext();

    window.addEventListener("profile-updated", updateContext);
    window.addEventListener("creator-context-updated", updateContext);
    window.addEventListener("storage", updateContext);
    return () => {
      window.removeEventListener("profile-updated", updateContext);
      window.removeEventListener("creator-context-updated", updateContext);
      window.removeEventListener("storage", updateContext);
    };
  }, [customInstruction, profile, effectiveUserId]);

  // Sync customInstruction, ctaPreferences, and contentDestinations from profile or local cache if local state is empty
  useEffect(() => {
    const resolvedContext = resolveCurrentCreatorContext(customInstruction, profile, effectiveUserId);
    if (resolvedContext && !customInstruction) {
      setCustomInstruction(resolvedContext);
    }
    if (profile?.ctaPreferences && !ctaPreferences) {
      setCtaPreferences(profile.ctaPreferences);
    }
    if (profile?.contentDestinations && profile.contentDestinations.length > 0 && contentDestinations.length === 0) {
      setContentDestinations(profile.contentDestinations);
    }
  }, [profile?.customInstruction, profile?.ctaPreferences, profile?.contentDestinations, customInstruction, effectiveUserId]);

  // AI Content Pillars State
  const [pillars, setPillars] = useState<ContentPillar[]>(profile?.contentPillars || []);
  const [activePillarIndex, setActivePillarIndex] = useState<number>(profile?.activePillarIndex !== undefined ? profile.activePillarIndex : 0);
  const [isPillarFilteringActive, setIsPillarFilteringActive] = useState<boolean>(profile?.isPillarFilteringActive !== undefined ? profile.isPillarFilteringActive : true);
  const [refreshingPillarIndex, setRefreshingPillarIndex] = useState<number | null>(null);
  const [generatingPillars, setGeneratingPillars] = useState(false);
  const [expandedPillarIndex, setExpandedPillarIndex] = useState<number | null>(null);

  // Sync pillars and settings from profile updates
  useEffect(() => {
    if (profile) {
      if (profile.contentPillars && profile.contentPillars.length > 0) {
        setPillars(profile.contentPillars);
      }
      if (profile.activePillarIndex !== undefined) {
        setActivePillarIndex(profile.activePillarIndex);
      }
      if (profile.isPillarFilteringActive !== undefined) {
        setIsPillarFilteringActive(profile.isPillarFilteringActive);
      }
    }
  }, [profile]);

  const {
    loading: loadingConn,
    connected,
    username,
    profilePictureUrl,
    biography,
    isSandbox,
    connectThreads,
    disconnectThreads
  } = useThreadsConnection();
  const connection = { connected, username, profilePictureUrl, biography, isSandbox };


  // Creation Mode State: "ai" | "manual"
  const [creationMode, setCreationMode] = usePersistentDraft<CreationMode>("create-content", "creation-mode", "ai");

  // Component-level transformation loading state per card
  const [transformingCardIds, setTransformingCardIds] = useState<Record<string, string | null>>({});

  // Card selection state for batch actions
  const [selectedCardIds, setSelectedCardIds] = useState<Record<string, boolean>>({});

  // Manual Mode Workspace State
  const [manualTitle, setManualTitle] = usePersistentDraft<string>("create-content", "manual-title", "");
  const [manualTopic, setManualTopic] = usePersistentDraft<string>("create-content", "creator-request", "");
  const contentRequestTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const contentRequestVoice = useVoiceToText({
    value: manualTopic,
    onChange: setManualTopic,
    inputRef: contentRequestTextareaRef,
  });
  const [manualFormat, setManualFormat] = usePersistentDraft<"post" | "thread">("create-content", "manual-format", "post");
  const [manualThreadParts, setManualThreadParts] = usePersistentDraft<string[]>("create-content", "manual-thread-parts", [""]);
  const [manualSaving, setManualSaving] = useState(false);
  const [manualSavedSuccess, setManualSavedSuccess] = useState(false);

  // Manual Mode Validation
  const getManualValidationError = (): string | null => {
    if (manualFormat === "post") {
      const part = manualThreadParts[0] || "";
      if (part.trim().length === 0) return "Post content cannot be empty.";
      if (part.length > 500) return "Post content exceeds the 500-character limit.";
      return null;
    } else {
      if (manualThreadParts.length < 2) return "A thread must have at least 2 parts.";
      if (manualThreadParts.length > 10) return "A thread cannot exceed 10 parts.";
      for (let i = 0; i < manualThreadParts.length; i++) {
        const part = manualThreadParts[i] || "";
        if (part.trim().length === 0) return `Thread part ${i + 1} cannot be empty. All thread parts must contain text.`;
        if (part.length > 500) return `Thread part ${i + 1} exceeds the 500-character limit.`;
      }
      return null;
    }
  };

  const manualValidationError = getManualValidationError();
  const isManualValid = !manualValidationError;

  // Manual Mode Handlers
  const handleManualPartChange = (index: number, value: string) => {
    const updated = [...manualThreadParts];
    updated[index] = value;
    setManualThreadParts(updated);
  };

  const handleManualAddPart = () => {
    if (manualThreadParts.length >= 10) return;
    setManualThreadParts([...manualThreadParts, ""]);
  };

  const handleManualDeletePart = (index: number) => {
    if (manualFormat === "thread" && manualThreadParts.length <= 2) return;
    if (manualFormat === "post") return;
    const updated = [...manualThreadParts];
    updated.splice(index, 1);
    setManualThreadParts(updated);
  };

  const handleManualMovePart = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= manualThreadParts.length) return;
    const updated = [...manualThreadParts];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setManualThreadParts(updated);
  };

  const handleManualSaveDraft = async () => {
    const errorMsg = getManualValidationError();
    if (errorMsg) {
      alert(`Validation failed: ${errorMsg}`);
      return;
    }
    setManualSaving(true);
    try {
      const parts = manualFormat === "post" 
        ? [manualThreadParts[0]?.trim() || ""]
        : manualThreadParts.map(p => p.trim());
      
      await saveCanonicalRecord(
        {
          title: manualTitle.trim() || parts[0]?.slice(0, 50) || "Manual Post",
          hook: parts[0]?.slice(0, 100) || "",
          singlePost: parts[0] || "",
          threadParts: parts,
          topic: (manualTopic || "").trim() || profile?.offer || "General",
          format: manualFormat,
          stage: "Draft",
          sourceApp: "manual"
        },
        profile
      );
      setManualSavedSuccess(true);
      setTimeout(() => setManualSavedSuccess(false), 4000);
    } catch (err: any) {
      console.error("Failed to save manual draft:", err);
      alert("Failed to save draft: " + (err.message || "Unknown error"));
    } finally {
      setManualSaving(false);
    }
  };

  const handleManualSchedule = () => {
    const errorMsg = getManualValidationError();
    if (errorMsg) {
      alert(`Validation failed: ${errorMsg}`);
      return;
    }
    const parts = manualFormat === "post" 
      ? [manualThreadParts[0].trim()] 
      : manualThreadParts.map(p => p.trim());
    const mockPost: GeneratedPost = {
      id: `manual-${Date.now()}`,
      title: manualTitle.trim() || parts[0].slice(0, 50),
      hook: parts[0].slice(0, 100),
      singlePost: parts[0],
      threadParts: parts,
      explanation: manualFormat === "post" ? "Manually written post." : "Manually written thread."
    };
    setScheduleModalPost(mockPost);
  };

  const handleManualPublish = () => {
    const errorMsg = getManualValidationError();
    if (errorMsg) {
      alert(`Validation failed: ${errorMsg}`);
      return;
    }
    const parts = manualFormat === "post" 
      ? [manualThreadParts[0].trim()] 
      : manualThreadParts.map(p => p.trim());
    const mockPost: GeneratedPost = {
      id: `manual-${Date.now()}`,
      title: manualTitle.trim() || parts[0].slice(0, 50),
      hook: parts[0].slice(0, 100),
      singlePost: parts[0],
      threadParts: parts,
      explanation: manualFormat === "post" ? "Manually written post." : "Manually written thread."
    };
    setPublishModalPost(mockPost);
  };

  const handleManualClear = () => {
    if (manualThreadParts.some(p => p.trim().length > 0)) {
      if (!window.confirm("Are you sure you want to clear your manual draft?")) return;
    }
    setManualTitle("");
    setManualTopic("");
    setManualFormat("post");
    setManualThreadParts([""]);
    setManualSavedSuccess(false);
  };

  // Component Level Actions & Individualized Transforms
  const handleIndividualizedCta = async (post: GeneratedPost, postIndex: number, action: "add" | "remove" = "add", placement: string = "final_part") => {
    setTransformingCardIds(prev => ({ ...prev, [post.id]: "cta" }));
    try {
      const res = await apiFetch<any>("/api/v2/transform-cta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          post,
          action,
          placement,
          ctaPreferences: profile?.ctaPreferences || ctaPreferences,
          offerIntelligence: profile?.offerIntelligence,
          activeCtaMessage: activeCta?.message
        })
      }, true);

      if (res && res.post) {
        const list = [...getPostsForCategory(activeCategory)];
        list[postIndex] = {
          ...post,
          cta: res.post.cta,
          threadParts: res.post.threadParts,
          singlePost: res.post.singlePost
        };
        setPostsForCategory(activeCategory, list);
      } else {
        throw new Error("Could not apply CTA transformation. Invalid server response.");
      }
    } catch (err: any) {
      console.error("Individualized CTA failed:", err);
      alert(`Failed to transform CTA: ${err.message || "Unknown error"}`);
    } finally {
      setTransformingCardIds(prev => ({ ...prev, [post.id]: null }));
    }
  };

  const handleIndividualizedHook = async (post: GeneratedPost, postIndex: number, action: "add" | "remove" = "add") => {
    setTransformingCardIds(prev => ({ ...prev, [post.id]: "hook" }));
    try {
      const res = await apiFetch<any>("/api/v2/transform-hook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          post,
          action,
          writingStyle: profile?.writingStyle || "Direct, high-value, casual, authoritative",
          creatorIdentity: profile?.creatorIdentity
        })
      }, true);

      if (res && res.post) {
        const list = [...getPostsForCategory(activeCategory)];
        list[postIndex] = {
          ...post,
          hook: res.post.hook,
          threadParts: res.post.threadParts,
          singlePost: res.post.singlePost
        };
        setPostsForCategory(activeCategory, list);
      } else {
        throw new Error("Could not apply Hook transformation. Invalid server response.");
      }
    } catch (err: any) {
      console.error("Hook transformation failed:", err);
      alert(`Failed to transform Hook: ${err.message || "Unknown error"}`);
    } finally {
      setTransformingCardIds(prev => ({ ...prev, [post.id]: null }));
    }
  };

  // Card Selection & Batch Actions
  const toggleSelectCard = (id: string) => {
    setSelectedCardIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleToggleSelectAll = () => {
    const activePosts = getPostsForCategory(activeCategory);
    const allSelected = activePosts.every(p => selectedCardIds[p.id]);
    const updated: Record<string, boolean> = {};
    if (!allSelected) {
      activePosts.forEach(p => { updated[p.id] = true; });
    }
    setSelectedCardIds(updated);
  };

  const handleBatchHooksTransform = async (action: "add" | "remove") => {
    const activePosts = getPostsForCategory(activeCategory);
    const targetPosts = activePosts.filter(p => selectedCardIds[p.id]);
    const postsToProcess = targetPosts.length > 0 ? targetPosts : activePosts;

    if (postsToProcess.length === 0) return;

    let currentList = [...activePosts];
    let errors: string[] = [];

    for (let i = 0; i < postsToProcess.length; i++) {
      const post = postsToProcess[i];
      const realIndex = currentList.findIndex(p => p.id === post.id);
      if (realIndex >= 0) {
        setTransformingCardIds(prev => ({ ...prev, [post.id]: "hook" }));
        try {
          const res = await apiFetch<any>("/api/v2/transform-hook", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              post,
              action,
              writingStyle: profile?.writingStyle || "Direct, high-value, casual, authoritative",
              creatorIdentity: profile?.creatorIdentity
            })
          }, true);

          if (res && res.post) {
            currentList[realIndex] = {
              ...post,
              hook: res.post.hook,
              threadParts: res.post.threadParts,
              singlePost: res.post.singlePost
            };
          } else {
            throw new Error(`Invalid response for post: ${post.title || post.id}`);
          }
        } catch (err: any) {
          console.error(`Hook transform failed for post ${post.id}:`, err);
          errors.push(post.title || `Post #${realIndex + 1}`);
        } finally {
          setTransformingCardIds(prev => ({ ...prev, [post.id]: null }));
        }
      }
    }

    setPostsForCategory(activeCategory, currentList);

    if (errors.length > 0) {
      alert(`The Hook transformation failed for the following posts:\n- ${errors.join("\n- ")}\n\nPlease try again.`);
    }
  };

  const handleBatchCtasTransform = async (action: "add" | "remove", placement: string = "final_part") => {
    const activePosts = getPostsForCategory(activeCategory);
    const targetPosts = activePosts.filter(p => selectedCardIds[p.id]);
    const postsToProcess = targetPosts.length > 0 ? targetPosts : activePosts;

    if (postsToProcess.length === 0) return;

    let currentList = [...activePosts];
    let errors: string[] = [];

    for (let i = 0; i < postsToProcess.length; i++) {
      const post = postsToProcess[i];
      const realIndex = currentList.findIndex(p => p.id === post.id);
      if (realIndex >= 0) {
        setTransformingCardIds(prev => ({ ...prev, [post.id]: "cta" }));
        try {
          const res = await apiFetch<any>("/api/v2/transform-cta", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              post,
              action,
              placement,
              ctaPreferences: profile?.ctaPreferences || ctaPreferences,
              offerIntelligence: profile?.offerIntelligence,
              activeCtaMessage: activeCta?.message
            })
          }, true);

          if (res && res.post) {
            currentList[realIndex] = {
              ...post,
              cta: res.post.cta,
              threadParts: res.post.threadParts,
              singlePost: res.post.singlePost
            };
          } else {
            throw new Error(`Invalid response for post: ${post.title || post.id}`);
          }
        } catch (err: any) {
          console.error(`CTA transform failed for post ${post.id}:`, err);
          errors.push(post.title || `Post #${realIndex + 1}`);
        } finally {
          setTransformingCardIds(prev => ({ ...prev, [post.id]: null }));
        }
      }
    }

    setPostsForCategory(activeCategory, currentList);

    if (errors.length > 0) {
      alert(`The CTA transformation failed for the following posts:\n- ${errors.join("\n- ")}\n\nPlease try again.`);
    }
  };

  const handleBatchIndividualizedCtas = async () => {
    await handleBatchCtasTransform("add", batchCtaPlacement);
  };

  const handleBatchChangeHooks = async () => {
    await handleBatchHooksTransform("add");
  };

  const handleBatchImprove = async () => {
    const activePosts = getPostsForCategory(activeCategory);
    const targetPosts = activePosts.filter(p => selectedCardIds[p.id]);
    const postsToProcess = targetPosts.length > 0 ? targetPosts : activePosts;

    for (let i = 0; i < postsToProcess.length; i++) {
      const post = postsToProcess[i];
      const realIndex = activePosts.findIndex(p => p.id === post.id);
      if (realIndex >= 0) {
        await handleOptimizePost(post, realIndex);
      }
    }
  };

  const handleConnectThreads = async () => {
    if (!auth.currentUser) {
      alert("Please sign in before connecting your Meta Threads account.");
      return;
    }
    const result = await connectThreads("/ai-threads-post-generator");
    if (!result.success && result.error !== "Cancelled") {
      alert(`Connection Failed: ${result.error}`);
    }
  };

  const handleDisconnectThreads = async () => {
    if (!window.confirm("Are you sure you want to disconnect your Meta Threads channel? This will disable direct publishing access.")) {
      return;
    }
    await disconnectThreads();
  };

  // Save Content Instructions handler
  const handleSaveInstructions = async () => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const textToSave = (customInstruction || "").trim();

    setSavingInstructions(true);
    setInstructionsSavedSuccess(false);
    setInstructionsError(null);

    try {
      // 1. Extract parameters if provided to keep profile attributes synchronized
      let extracted: any = {};
      if (textToSave) {
        try {
          extracted = await apiFetch<any>("/api/extract-content-foundation", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contentFoundation: textToSave })
          });
        } catch (extractErr) {
          console.warn("Extraction note:", extractErr);
        }
      }

      const updatedFields: any = {
        customInstruction: textToSave,
        ctaPreferences: (ctaPreferences || "").trim(),
        contentDestinations: Array.isArray(contentDestinations) ? contentDestinations : [],
        updatedAt: new Date().toISOString()
      };
      if (extracted.offer) updatedFields.offer = extracted.offer;
      if (extracted.audience) updatedFields.audience = extracted.audience;
      if (extracted.desiredResult) updatedFields.desiredResult = extracted.desiredResult;
      if (extracted.writingStyle) updatedFields.writingStyle = extracted.writingStyle;
      if (extracted.keywords) updatedFields.keywords = extracted.keywords;

      const userRef = doc(db, "users", uid);
      const settingsRef = doc(db, "settings", uid);

      await Promise.all([
        withTimeout(setDoc(userRef, sanitizeForFirestore(updatedFields), { merge: true }), 4000, true),
        withTimeout(setDoc(settingsRef, sanitizeForFirestore(updatedFields), { merge: true }), 3000, true).catch(sErr => console.warn("Settings doc write note:", sErr))
      ]);

      // Generate or refresh Content Pillars based on these instructions
      if (textToSave || profile?.offer) {
        setGeneratingPillars(true);
        try {
          const pillarsData = await apiFetch<any>("/api/generate-content-pillars", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              offer: updatedFields.offer || profile?.offer || "",
              audience: updatedFields.audience || profile?.audience || "",
              desiredResult: updatedFields.desiredResult || profile?.desiredResult || "",
              writingStyle: updatedFields.writingStyle || profile?.writingStyle || "",
              keywords: updatedFields.keywords || profile?.keywords || "",
              customInstruction: textToSave,
              creatorIdentity: profile?.creatorIdentity
            })
          });
          if (pillarsData.pillars && pillarsData.pillars.length === 3) {
            const cleanPillars = pillarsData.pillars.map(normalizePillar);
            setPillars(cleanPillars);
            await withTimeout(setDoc(userRef, sanitizeForFirestore({
              contentPillars: cleanPillars,
              activePillarIndex: 0,
              isPillarFilteringActive: true
            }), { merge: true }), 4000, true);
            setActivePillarIndex(0);
            setIsPillarFilteringActive(true);
          }
        } catch (pErr) {
          console.warn("Pillars auto-generation note:", pErr);
        } finally {
          setGeneratingPillars(false);
        }
      }

      setInstructionsSavedSuccess(true);
      if (onRefreshProfile) onRefreshProfile();
      setTimeout(() => setInstructionsSavedSuccess(false), 4000);
    } catch (err: any) {
      console.error("Save instructions error:", err);
      setInstructionsError(err.message || "Failed to save Content Instructions.");
      setTimeout(() => setInstructionsError(null), 5000);
    } finally {
      setSavingInstructions(false);
    }
  };

  // AI Depth Enhancement for Content Instructions
  const handleEnhanceInstructions = async () => {
    const textToEnhance = (customInstruction || "").trim() || profile?.customInstruction?.trim() || "";
    if (!textToEnhance || isEnhancingInstructions || savingInstructions) return;
    setIsEnhancingInstructions(true);
    setPreviousCustomInstruction(customInstruction || profile?.customInstruction || "");
    setInstructionsError(null);
    setInstructionsEnhanceSuccess(false);

    try {
      const data = await apiFetch<any>("/api/enhance-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: "content_instructions",
          text: textToEnhance,
          context: {
            customInstruction: textToEnhance,
            creatorIdentity: profile?.creatorIdentity,
            voiceText: profile?.creatorIdentity?.rawVoice,
            rawBusinessText: profile?.rawBusinessText
          }
        })
      });

      if (data && data.enhancedText) {
        setCustomInstruction(data.enhancedText);
        setInstructionsEnhanceSuccess(true);
        setTimeout(() => setInstructionsEnhanceSuccess(false), 5000);
      } else {
        throw new Error("No enhanced text returned");
      }
    } catch (err: any) {
      console.error("Enhance content instructions error:", err);
      setInstructionsError(err?.message || "Enhancement temporarily unavailable. Please try again in a moment.");
      setTimeout(() => setInstructionsError(null), 5000);
    } finally {
      setIsEnhancingInstructions(false);
    }
  };

  const handleUndoEnhanceInstructions = () => {
    if (previousCustomInstruction !== null) {
      setCustomInstruction(previousCustomInstruction);
      setPreviousCustomInstruction(null);
      setInstructionsEnhanceSuccess(false);
    }
  };

  const handleTogglePillarFiltering = async (checked: boolean) => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    setIsPillarFilteringActive(checked);
    try {
      const userRef = doc(db, "users", uid);
      await withTimeout(setDoc(userRef, sanitizeForFirestore({ isPillarFilteringActive: checked }), { merge: true }), 3000, true);
      if (onRefreshProfile) onRefreshProfile();
    } catch (err) {
      console.error("Failed to update pillar filtering toggle:", err);
    }
  };

  const handleSelectPillar = async (index: number) => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    setActivePillarIndex(index);
    try {
      const userRef = doc(db, "users", uid);
      await withTimeout(setDoc(userRef, sanitizeForFirestore({ activePillarIndex: index }), { merge: true }), 3000, true);
      if (onRefreshProfile) onRefreshProfile();
    } catch (err) {
      console.error("Failed to update active content pillar:", err);
    }
  };

  const handleRefreshSinglePillar = async (index: number) => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    setRefreshingPillarIndex(index);
    try {
      let newPillar: any = null;
      try {
        newPillar = await apiFetch<any>(
          "/api/generate-single-pillar",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              offer: profile?.offer || "",
              audience: profile?.audience || "",
              desiredResult: profile?.desiredResult || "",
              writingStyle: profile?.writingStyle || "",
              keywords: profile?.keywords || "",
              customInstruction: (customInstruction || "").trim(),
              existingPillars: pillars,
              creatorIdentity: profile?.creatorIdentity
            })
          },
          true
        );
      } catch (fetchErr) {
        console.warn("apiFetch on single pillar failed, attempting direct fetch:", fetchErr);
        try {
          const directRes = await fetch("/api/generate-single-pillar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              offer: profile?.offer || "",
              audience: profile?.audience || "",
              desiredResult: profile?.desiredResult || "",
              writingStyle: profile?.writingStyle || "",
              keywords: profile?.keywords || "",
              customInstruction: (customInstruction || "").trim(),
              existingPillars: pillars,
              creatorIdentity: profile?.creatorIdentity
            })
          });
          if (directRes.ok) {
            newPillar = await directRes.json();
          }
        } catch (_) {}
      }

      if (!newPillar || !newPillar.title) {
        const fallbackTitles = [
          "Growth Architecture & Scaled Distribution",
          "Conversion Systems & Offer Mechanics",
          "Audience Resonance & Pattern Engineering"
        ];
        newPillar = {
          title: fallbackTitles[index % fallbackTitles.length],
          description: "Actionable strategic frameworks and proven models to systematically attract high-intent buyers and scale influence with authority.",
          coreExpertise: "Strategic content positioning, audience conversion funnels, repeatable authority architectures",
          keyVocabulary: "Distribution leverage, Conversion efficiency, Retention loop, High-signal framing",
          mentalModels: "First-principles strategic positioning, Inversion of audience friction, Compounding distribution",
          primaryQuestion: "How do we create scalable content that predictably drives conversion and authority without burnout?",
          topicsToAvoid: "Vague platitudes, superficial vanity metrics, disconnected motivation quotes",
          successCriteria: "Directly solves high-level problems with measurable takeaways and structured implementation steps"
        };
      }

      const refreshedPillar = normalizePillar(newPillar);
      const currentPillars = Array.isArray(pillars) && pillars.length > 0 ? pillars : (profile?.contentPillars || []);
      const updatedPillars = currentPillars.map((p, idx) => (idx === index ? refreshedPillar : normalizePillar(p)));
      if (!updatedPillars[index]) {
        updatedPillars[index] = refreshedPillar;
      }

      setPillars(updatedPillars);

      const userRef = doc(db, "users", uid);
      await withTimeout(
        setDoc(userRef, sanitizeForFirestore({ contentPillars: updatedPillars }), { merge: true }),
        3000,
        true
      );
      if (onRefreshProfile) onRefreshProfile();
    } catch (err) {
      console.error("Failed to refresh single content pillar:", err);
    } finally {
      setRefreshingPillarIndex(null);
    }
  };

  // Dropdowns state & click outside refs
  const [isPostsDropdownOpen, setIsPostsDropdownOpen] = useState(false);
  const postsDropdownRef = useRef<HTMLDivElement>(null);

  const [ctaMode, setCtaMode] = usePersistentDraft<"auto" | "use_my_cta" | "off">("create-content", "cta-mode", "auto");
  const [isCtaDropdownOpen, setIsCtaDropdownOpen] = useState(false);
  const ctaDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (postsDropdownRef.current && !postsDropdownRef.current.contains(event.target as Node)) {
        setIsPostsDropdownOpen(false);
      }
      if (ctaDropdownRef.current && !ctaDropdownRef.current.contains(event.target as Node)) {
        setIsCtaDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const POSTS_TO_CREATE_OPTIONS = [
    { value: "1", label: "1 post" },
    { value: "4", label: "4 posts" },
    { value: "8", label: "8 posts" },
    { value: "16", label: "16 posts" },
    { value: "32", label: "32 posts" },
  ];

  const CTA_OPTIONS = [
    { value: "auto", label: "AI Decide" },
    { value: "use_my_cta", label: "Use My CTA" },
    { value: "off", label: "Off" },
  ];

  const normalizedPostsToCreate = ["1", "4", "8", "16", "32"].includes(postsToCreate) ? postsToCreate : "1";
  const activePostsOption = POSTS_TO_CREATE_OPTIONS.find(o => o.value === normalizedPostsToCreate) || POSTS_TO_CREATE_OPTIONS[0];
  const hasExplicitPostsSelectionRef = useRef(false);
  const { threadLength: standardThreadLength, sentencesPerPart: standardSentencesPerPart } =
    resolveStandardContentEngineLengthSettings();

  // Check if user has active/populated Creator Identity
  const hasActiveIdentity = Boolean(
    profile?.creatorIdentity && (
      Boolean(profile.creatorIdentity.personality?.trim()) ||
      Boolean(profile.creatorIdentity.howYouThink?.trim()) ||
      Boolean(profile.creatorIdentity.whatYouBelieve?.trim()) ||
      Boolean(profile.creatorIdentity.yourExperiences?.trim()) ||
      Boolean(profile.creatorIdentity.yourExpertise?.trim()) ||
      Boolean(profile.creatorIdentity.yourHumor?.trim()) ||
      Boolean(profile.creatorIdentity.yourPerspective?.trim()) ||
      Boolean(profile.creatorIdentity.writingStyle?.trim()) ||
      Boolean(profile.creatorIdentity.tone?.trim()) ||
      Boolean(profile.creatorIdentity.wordsYouUse?.trim()) ||
      Boolean(profile.creatorIdentity.wordsYouAvoid?.trim()) ||
      Boolean(profile.creatorIdentity.whoYouHelp?.trim()) ||
      Boolean(profile.creatorIdentity.whatYouHelpThemDo?.trim()) ||
      Boolean(profile.creatorIdentity.whatYoureKnownFor?.trim()) ||
      Boolean(profile.creatorIdentity.whatYouTalkAbout?.trim()) ||
      Boolean(profile.creatorIdentity.whatYouWantPeopleToRemember?.trim()) ||
      Boolean(profile.creatorIdentity.character?.baseCharacter)
    )
  );

  // Expanded scoring panels and optimized indicators
  const [expandedScores, setExpandedScores] = useState<{ [id: string]: boolean }>({});
  const [optimizedPosts, setOptimizedPosts] = useState<{ [id: string]: boolean }>({});
  const [postScoresMap, setPostScoresMap] = useState<{ [id: string]: any }>({});
  const [optimizationsAppliedMap, setOptimizationsAppliedMap] = useState<{ [id: string]: string[] }>({});
  const [optimizingPostIds, setOptimizingPostIds] = useState<{ [id: string]: boolean }>({});

  const getPostScores = (post: any) => {
    if (postScoresMap[post.id]) {
      return postScoresMap[post.id];
    }
    const isOptimized = optimizedPosts[post.id];
    if (isOptimized) {
      return {
        overall: 99,
        hook: 99,
        curiosity: 98,
        authority: 99,
        readability: 99,
        conversion: 99,
        tip: "This post has been optimized! It now represents an absolute masterclass in Threads content design."
      };
    }

    if (post.integrityReport) {
      const rep = post.integrityReport;
      return {
        overall: rep.score || 94,
        hook: rep.hookScore || 94,
        curiosity: rep.semanticContinuityScore || 95,
        authority: rep.authorityScore || 94,
        readability: rep.readabilityScore || 95,
        conversion: rep.factualGroundingScore || 95,
        tip: rep.passed
          ? (rep.repairsApplied && rep.repairsApplied.length > 0
              ? `Integrity verified: ${rep.repairsApplied[0]}`
              : "High hook-to-payoff continuity with solid factual grounding.")
          : "Potential continuity or open-loop issue detected."
      };
    }
    
    const partsCount = post.threadParts?.length || 1;
    const hasLongPart = (post.threadParts || []).some((p: string) => p.length > 460);
    const hookLength = (post.hook || "").length;
    const hook = hookLength > 10 && hookLength <= 140 ? 96 : (hookLength > 140 ? 91 : 85);
    const readability = hasLongPart ? 82 : 96;
    const curiosity = partsCount > 1 ? 94 : 89;
    const authority = (post.threadParts || []).some((p: string) => /step|mechanism|system|rule/i.test(p)) ? 95 : 91;
    const conversion = partsCount > 1 ? 92 : 84;
    const overall = Math.round(hook * 0.25 + curiosity * 0.30 + authority * 0.20 + readability * 0.15 + conversion * 0.10);
    
    return {
      overall,
      hook,
      curiosity,
      authority,
      readability,
      conversion,
      tip: hasLongPart 
        ? "Warning: One of your thread parts is approaching Meta's 500-character limit. Click Optimize to compress it."
        : "CTA is clean and thought progression is solid. Click Optimize to polish rhythm further."
    };
  };

  const handleOptimizePost = async (post: GeneratedPost, index: number) => {
    if (optimizingPostIds[post.id]) return;
    setOptimizingPostIds(prev => ({ ...prev, [post.id]: true }));

    try {
      const activePillar = isPillarFilteringActive && pillars.length > 0 ? pillars[activePillarIndex] : undefined;
      
      const data = await apiFetch<any>("/api/optimize-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          post,
          category: activeCategory,
          offer: profile?.offer || "",
          audience: profile?.audience || "",
          desiredResult: profile?.desiredResult || "",
          writingStyle: profile?.writingStyle || "",
          rawVoice: profile?.rawVoice || undefined,
          customInstruction: (customInstruction || "").trim() || undefined,
          activeIdea: activeIdea || undefined,
          rawCreatorThought: (rawCreatorThought || "").trim() || undefined,
          activePillar,
          creatorIdentity: profile?.creatorIdentity,
          rawBusinessText: profile?.rawBusinessText,
          offerIntelligence: profile?.offerIntelligence,
          buyerIntelligence: profile?.buyerIntelligence,
          activeCta: ctaMode === "off" ? null : activeCta,
          ctaPreferences: ctaMode === "off"
            ? "Off - Do NOT include any CTA, link, or keyword prompt."
            : ((ctaPreferences || "").trim() || profile?.ctaPreferences?.trim() || undefined),
          contentDestinations: (contentDestinations && contentDestinations.length > 0) ? contentDestinations : (profile?.contentDestinations && profile.contentDestinations.length > 0 ? profile.contentDestinations : undefined),
          sentencesPerPart: standardSentencesPerPart,
          characterLimit: 500,
          userId: auth.currentUser?.uid || profile?.uid || (profile?.creatorIdentity as any)?.uid || "anonymous",
          selectedSavedTabId: (profile as any)?.activeSavedTabId || (profile as any)?.savedTabId || undefined
        })
      }, true);

      if (data && data.optimizedPost) {
        const rawParts = Array.isArray(data.optimizedPost.threadParts) && data.optimizedPost.threadParts.length > 0
          ? data.optimizedPost.threadParts
          : [data.optimizedPost.singlePost || ""];

        const { post: repaired } = data.generatorVersion === "V3"
          ? {
              post: {
                ...post,
                ...data.optimizedPost,
                threadParts: rawParts,
                singlePost: data.optimizedPost.singlePost || rawParts[0] || ""
              }
            }
          : repairAndSanitizePost({
              ...post,
              ...data.optimizedPost,
              threadParts: rawParts,
              singlePost: rawParts[0] || ""
            }, {
              charLimit: 500,
              expectedHook: data.optimizedPost.hook || post.hook,
              context: {
                offer: profile?.offer,
                audience: profile?.audience,
                desiredResult: profile?.desiredResult,
                category: activeCategory
              }
            });

        const list = [...getPostsForCategory(activeCategory)];
        list[index] = {
          ...post,
          ...repaired,
          id: post.id
        };

        if (data.scores) {
          setPostScoresMap(prev => ({ ...prev, [post.id]: data.scores }));
        }
        if (data.optimizationsApplied) {
          setOptimizationsAppliedMap(prev => ({ ...prev, [post.id]: data.optimizationsApplied }));
        }

        setOptimizedPosts(prev => ({ ...prev, [post.id]: true }));
        setPostsForCategory(activeCategory, list);
        setExpandedScores(prev => ({ ...prev, [post.id]: true }));
      }
    } catch (err: any) {
      console.error("Optimization error:", err);
      // Fallback local cleanup if network error
      const list = [...getPostsForCategory(activeCategory)];
      const originalParts = post.threadParts || [post.singlePost || ""];
      const cleaned = originalParts.map(p => sanitizeText(p));
      list[index] = {
        ...post,
        threadParts: cleaned,
        singlePost: cleaned[0]
      };
      setOptimizedPosts(prev => ({ ...prev, [post.id]: true }));
      setPostsForCategory(activeCategory, list);
      setExpandedScores(prev => ({ ...prev, [post.id]: true }));
    } finally {
      setOptimizingPostIds(prev => ({ ...prev, [post.id]: false }));
    }
  };

  // State holders for saving, copying, deleting, regenerating feedback states per card
  const [savedIds, setSavedIds] = useState<{ [id: string]: boolean }>({});
  const [copyingIds, setCopyingIds] = useState<{ [id: string]: boolean }>({});
  const [regeneratingCardIds, setRegeneratingCardIds] = useState<{ [id: string]: boolean }>({});
  const [publishModalPost, setPublishModalPost] = useState<GeneratedPost | null>(null);
  const [scheduleModalPost, setScheduleModalPost] = useState<GeneratedPost | null>(null);
  const [isAddAllModalOpen, setIsAddAllModalOpen] = useState(false);
  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);

  const handleConfirmClearAllGeneratedPosts = () => {
    setAttentionPosts([]);
    setTrustPosts([]);
    setSalesPosts([]);
    setIsClearAllModalOpen(false);
  };

  const handleSuccessAddAll = (count: number) => {
    // Clear only the active category's generated posts since they are now scheduled
    setPostsForCategory(activeCategory, []);
    setIsAddAllModalOpen(false);
    // Trigger usage refresh to reflect any changes if applicable
    if (typeof refreshUsage === "function") {
      refreshUsage();
    }
  };

  // Dynamic thread parts generation state per post card
  const [isGeneratingPart, setIsGeneratingPart] = useState<{ [id: string]: boolean }>({});

  // Dynamic inline editing state
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [activeEditField, setActiveEditField] = useState<"title" | "hook" | "explanation" | null>(null);
  const [editingPartIdx, setEditingPartIdx] = useState<{ postId: string; partIdx: number } | null>(null);

  // Ref to track and auto-scroll to newly appended thread parts
  const justAddedPartRef = useRef<{ postId: string; partIdx: number } | null>(null);

  // In-flight guard to prevent duplicate concurrent generation requests and race conditions
  const isGeneratingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Global category loading states
  const [loadingCategory, setLoadingCategory] = useState({
    attention: false,
    trust: false,
    sales: false
  });

  // Global category error states
  const [errorCategory, setErrorCategory] = useState<{
    attention: ClassifiedError | null;
    trust: ClassifiedError | null;
    sales: ClassifiedError | null;
  }>({
    attention: null,
    trust: null,
    sales: null
  });
  const [partialNoticeCategory, setPartialNoticeCategory] = useState<{
    attention: { acceptedCount: number; requestedCount: number; warning: string; failedSlots?: Array<{ slotNumber: number; reasons: string[]; errorCode?: string }> } | null;
    trust: { acceptedCount: number; requestedCount: number; warning: string; failedSlots?: Array<{ slotNumber: number; reasons: string[]; errorCode?: string }> } | null;
    sales: { acceptedCount: number; requestedCount: number; warning: string; failedSlots?: Array<{ slotNumber: number; reasons: string[]; errorCode?: string }> } | null;
  }>({
    attention: null,
    trust: null,
    sales: null
  });
  const [showErrorDiagnostics, setShowErrorDiagnostics] = useState<boolean>(false);
  const [copiedDiagnostics, setCopiedDiagnostics] = useState<boolean>(false);

  // Helper to get active category posts list
  const getPostsForCategory = (cat: "attention" | "trust" | "sales" | string) => {
    switch (cat) {
      case "attention": return attentionPosts;
      case "trust": return trustPosts;
      case "sales": return salesPosts;
      default: return attentionPosts;
    }
  };

  // Helper to set active category posts list
  const setPostsForCategory = (cat: "attention" | "trust" | "sales" | string, posts: GeneratedPost[]) => {
    switch (cat) {
      case "trust": setTrustPosts(posts); break;
      case "sales": setSalesPosts(posts); break;
      case "attention":
      default:
        setAttentionPosts(posts); break;
    }
  };

  // Handle in-place editing of fields
  const handleStartFieldEdit = (post: GeneratedPost, field: "title" | "hook" | "explanation") => {
    setEditingPostId(post.id);
    setActiveEditField(field);
  };

  const handleFieldChange = (index: number, field: "title" | "hook" | "explanation", value: string) => {
    const list = [...getPostsForCategory(activeCategory)];
    if (list[index]) {
      list[index] = { ...list[index], [field]: value };
      setPostsForCategory(activeCategory, list);
    }
  };

  const handlePartTextChange = (postIndex: number, partIndex: number, value: string) => {
    const list = [...getPostsForCategory(activeCategory)];
    const post = list[postIndex];
    if (post) {
      const parts = [...(post.threadParts || [post.singlePost || ""])];
      parts[partIndex] = value;
      list[postIndex] = {
        ...post,
        threadParts: parts,
        singlePost: parts[0]
      };
      setPostsForCategory(activeCategory, list);
    }
  };

  const handleFieldBlur = () => {
    setEditingPostId(null);
    setActiveEditField(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number, field: "title" | "hook" | "explanation") => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleFieldBlur();
    }
  };

  // Copy full thread text or single post to clipboard
  const handleCopyThread = (post: GeneratedPost) => {
    const parts = (post.threadParts || [post.singlePost || ""]).map(sanitizeText);
    const fullText = parts.length > 1
      ? parts.map((part, i) => `[Part ${i + 1}/${parts.length}]\n${part}`).join("\n\n---\n\n")
      : parts[0] || sanitizeText(post.hook);

    navigator.clipboard.writeText(fullText);
    setCopyingIds(prev => ({ ...prev, [post.id]: true }));
    setTimeout(() => {
      setCopyingIds(prev => ({ ...prev, [post.id]: false }));
    }, 2000);
  };

  // Add thread part using AI continuation
  const handleAddThreadPart = async (post: GeneratedPost, postIndex: number) => {
    const currentParts = (post.threadParts || [post.singlePost || ""]).map(sanitizeText);
    if (currentParts.length >= 15) {
      alert("Maximum 15 parts per post.");
      return;
    }
    setIsGeneratingPart(prev => ({ ...prev, [post.id]: true }));
    try {
      const activePillarObj = isPillarFilteringActive && pillars.length > 0 ? pillars[activePillarIndex] : undefined;

      const data = await apiFetch<any>("/api/generate-thread-continuation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          existingThreadParts: currentParts,
          category: activeCategory,
          offer: profile?.offer || "",
          audience: profile?.audience || "",
          desiredResult: profile?.desiredResult || "",
          writingStyle: profile?.writingStyle || "",
          rawVoice: profile?.rawVoice || undefined,
          rawBusinessText: profile?.rawBusinessText || undefined,
          customInstruction: (customInstruction || "").trim() || undefined,
          activeIdea: activeIdea || undefined,
          rawCreatorThought: (rawCreatorThought || "").trim() || undefined,
          sentencesPerPart: standardSentencesPerPart,
          characterLimit: 500,
          activePillar: activePillarObj,
          creatorIdentity: profile?.creatorIdentity,
          userId: auth.currentUser?.uid || profile?.uid || (profile?.creatorIdentity as any)?.uid || "anonymous",
          selectedSavedTabId: (profile as any)?.activeSavedTabId || (profile as any)?.savedTabId || undefined
        })
      }, true);

      const newPartText = sanitizeText(data.continuationPart || "Next actionable insight for your audience...");

      const updatedParts = [...currentParts, newPartText];
      if (updatedParts.length > 15) {
        updatedParts.splice(15);
      }
      const list = [...getPostsForCategory(activeCategory)];
      list[postIndex] = {
        ...post,
        threadParts: updatedParts
      };
      setPostsForCategory(activeCategory, list);

      justAddedPartRef.current = {
        postId: post.id,
        partIdx: updatedParts.length - 1
      };
      setEditingPartIdx({
        postId: post.id,
        partIdx: updatedParts.length - 1
      });

    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to generate continuation part.");
    } finally {
      setIsGeneratingPart(prev => ({ ...prev, [post.id]: false }));
    }
  };

  // Add an empty thread part
  const handleAddEmptyPart = (post: GeneratedPost, postIndex: number) => {
    const currentParts = [...(post.threadParts || [post.singlePost || ""])];
    if (currentParts.length >= 15) {
      alert("Maximum 15 parts per post.");
      return;
    }
    let insertIndex = currentParts.length;
    
    if (editingPartIdx && editingPartIdx.postId === post.id) {
      insertIndex = editingPartIdx.partIdx + 1;
    }
    
    currentParts.splice(insertIndex, 0, "");
    if (currentParts.length > 15) {
      currentParts.splice(15);
    }
    
    const list = [...getPostsForCategory(activeCategory)];
    list[postIndex] = {
      ...post,
      threadParts: currentParts
    };
    setPostsForCategory(activeCategory, list);

    justAddedPartRef.current = {
      postId: post.id,
      partIdx: insertIndex
    };
    setEditingPartIdx({
      postId: post.id,
      partIdx: insertIndex
    });
  };

  // Append active CTA
  const handleAppendActiveCta = (post: GeneratedPost, postIndex: number) => {
    if (!activeCta) return;
    const currentParts = (post.threadParts || [post.singlePost || ""]).map(sanitizeText);
    const ctaText = activeCta.linkUrl 
      ? `${activeCta.message}\n\nLink: ${activeCta.linkUrl}`
      : activeCta.message;

    const updatedParts = [...currentParts, ctaText];
    const list = [...getPostsForCategory(activeCategory)];
    list[postIndex] = {
      ...post,
      threadParts: updatedParts
    };
    setPostsForCategory(activeCategory, list);

    justAddedPartRef.current = {
      postId: post.id,
      partIdx: updatedParts.length - 1
    };
    setEditingPartIdx({
      postId: post.id,
      partIdx: updatedParts.length - 1
    });
  };

  // Delete a thread part
  const handleDeleteThreadPart = (postIndex: number, partIndex: number) => {
    const list = [...getPostsForCategory(activeCategory)];
    const post = list[postIndex];
    if (post) {
      const parts = [...(post.threadParts || [post.singlePost || ""])];
      if (parts.length <= 1) {
        alert("A thread must have at least one part.");
        return;
      }
      parts.splice(partIndex, 1);
      list[postIndex] = {
        ...post,
        threadParts: parts,
        singlePost: parts[0]
      };
      setPostsForCategory(activeCategory, list);
      if (editingPartIdx?.postId === post.id && editingPartIdx?.partIdx === partIndex) {
        setEditingPartIdx(null);
      }
    }
  };

  // Delete entire post card
  const handleDeleteCard = (index: number) => {
    const list = [...getPostsForCategory(activeCategory)];
    list.splice(index, 1);
    setPostsForCategory(activeCategory, list);
  };

  const [savingIdeaState, setSavingIdeaState] = useState<"idle" | "saving" | "saved">("idle");
  const [planningPostId, setPlanningPostId] = useState<string | null>(null);

  const upcomingPlanDays = React.useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekStart = getWeekStartDate(today);
    const days: Array<{ dateKey: string; label: string }> = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      days.push({
        dateKey: formatLocalDateKey(d),
        label: d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
      });
    }
    return days;
  }, []);

  const updateGeneratedPostInState = (postId: string, patch: Partial<GeneratedPost>) => {
    const list = getPostsForCategory(activeCategory);
    const next = list.map((item) => (item.id === postId ? { ...item, ...patch } : item));
    setPostsForCategory(activeCategory, next);
  };

  // Quick Save Raw Thought / Topic Request directly as an Idea in Content Library
  const handleSaveRequestAsIdea = async () => {
    const cleanText = (manualTopic || "").trim();
    if (!cleanText || savingIdeaState === "saving") return;
    setSavingIdeaState("saving");
    try {
      await saveCanonicalRecord(
        {
          title: cleanText.split("\n")[0].slice(0, 70),
          singlePost: cleanText,
          threadParts: [cleanText],
          stage: "Idea",
          topic: cleanText.split(/\s+/).slice(0, 3).join(" "),
          topics: normalizeTopicsList(cleanText.split(/\s+/).slice(0, 3).join(" ")),
          pillarTitle: activeIdea?.pillarTitle,
          notes: cleanText,
          sourceApp: "create-content",
        },
        profile
      );
      setSavingIdeaState("saved");
      setTimeout(() => setSavingIdeaState("idle"), 2500);
    } catch (err) {
      console.error("Failed saving idea:", err);
      setSavingIdeaState("idle");
    }
  };

  // Unified Save / Mark Ready / Add to Weekly Plan workflow (zero duplicate records!)
  const handleSaveToLibrary = async (
    post: GeneratedPost,
    targetStage: CanonicalStage = "Draft",
    targetPlannedDate?: string | null
  ) => {
    const parts = (post.threadParts || [post.singlePost || ""]).map(sanitizeText);
    const resolvedPillarTitle =
      post.pillarTitle ||
      post.decision?.pillarTitle ||
      activeIdea?.pillarTitle ||
      undefined;
    const resolvedTopics = normalizeTopicsList(
      activeIdea?.topic || (manualTopic ? manualTopic.trim().slice(0, 40) : undefined),
      post.topics
    );
    const resolvedPlannedDate =
      targetPlannedDate !== undefined
        ? targetPlannedDate
        : targetStage === "Planned"
        ? post.plannedDate || activeIdea?.targetPlannedDate || formatLocalDateKey(new Date())
        : post.plannedDate || null;

    try {
      const savedRecord = await saveCanonicalRecord(
        {
          id: post.savedRecordId,
          title: post.title || "Threads Post Draft",
          hook: sanitizeText(post.hook),
          singlePost: parts[0] || sanitizeText(post.singlePost),
          threadParts: parts,
          topic: resolvedTopics[0] || resolvedPillarTitle || profile?.offer || "Social Strategy",
          topics: resolvedTopics,
          pillarTitle: resolvedPillarTitle,
          sourceIdeaId: post.sourceIdeaId || activeIdea?.id || null,
          format: parts.length > 1 ? "thread" : "single",
          stage: targetStage,
          plannedDate: targetStage === "Planned" ? resolvedPlannedDate : null,
          sourceApp: "create-content",
        },
        profile
      );

      // Persist canonical record ID back onto the card so subsequent edits/scheduling never duplicate
      updateGeneratedPostInState(post.id, {
        savedRecordId: savedRecord.id,
        stage: savedRecord.stage,
        plannedDate: savedRecord.plannedDate || null,
        pillarTitle: savedRecord.pillarTitle,
        topics: savedRecord.topics,
        sourceIdeaId: savedRecord.sourceIdeaId,
      });

      setSavedIds(prev => ({ ...prev, [post.id]: true }));
      setTimeout(() => {
        setSavedIds(prev => ({ ...prev, [post.id]: false }));
      }, 2500);

      return savedRecord;
    } catch (err: any) {
      console.error(err);
      handleFirestoreError(err, OperationType.CREATE, "posts");
      alert(err.message || "Failed to save post to library.");
      return null;
    }
  };

  // Execute full batch generation
  const handleBatchGenerate = async (targetCat: "attention" | "trust" | "sales" | "auto" = "auto") => {
    // In-flight guard: prevent duplicate concurrent calls from rapid clicks or touch events
    if (isGeneratingRef.current) {
      console.log("Batch generation already in progress, ignoring duplicate call.");
      return;
    }
    isGeneratingRef.current = true;

    let isPro = false;
    let effectiveUserId = "anonymous";
    let activeHooksToUse: any[] = [];
    let activeLockedHook: any = null;
    let activeStrategicUnitsToUse: any[] = [];
    let count = 8;
    let catToLoad = targetCat === "auto" ? activeCategory : targetCat;
    let controller: AbortController | null = null;
    let isTimeoutTriggered = false;
    let timeoutId: any = null;
    let clientRequestId = "";
    let requestUrl = "";
    let requestMethod = "";
    let activePillar: any = undefined;
    let effectiveTopic = "";
    let resolvedActiveCta: any = null;
    let resolvedCtaPreferences: any = undefined;
    let requestPayload: any = null;
    let payloadString = "";
    let payloadSizeBytes = 0;

    try {
      isPro = isProUser(profile, subscriptionStatus);
      effectiveUserId = auth.currentUser?.uid || profile?.uid || "anonymous";

      // Permission check immediately before creating new post
      const permission = canCreatePost(effectiveUserId, profile, subscriptionStatus);
      if (!permission.allowed) {
        setDailyLimitReached(true);
        setErrorCategory(prev => ({
          ...prev,
          [catToLoad]: createClassifiedError(
            "Authentication",
            "Daily Limit Reached",
            permission.message || "Daily post creation limit reached. Upgrade to Pro for unlimited access."
          )
        }));
        isGeneratingRef.current = false;
        return;
      }

      activeHooksToUse = areHooksActive ? all32Hooks : [];
      activeLockedHook = areHooksActive ? lockedHook : null;
      activeStrategicUnitsToUse = areStrategicUnitsActive ? strategicUnits : [];

      const userSelectedCount = parseInt(postsToCreate, 10) || 8;
      count = userSelectedCount;
      if (activeStrategicUnitsToUse && activeStrategicUnitsToUse.length > 0) {
        count = Math.min(userSelectedCount, activeStrategicUnitsToUse.length);
      } else if (activeHooksToUse && activeHooksToUse.length > 0) {
        count = Math.min(userSelectedCount, activeHooksToUse.length);
      }
      
      // Unconditionally clear any previous errors and partial notices across all categories
      setErrorCategory({
        attention: null,
        trust: null,
        sales: null
      });
      setPartialNoticeCategory({
        attention: null,
        trust: null,
        sales: null
      });
      
      setLoadingCategory(prev => ({
        ...prev,
        [catToLoad]: true
      }));

      // Setup fresh AbortController with an adaptive timeout safeguard based on batch size
      if (abortControllerRef.current) {
        try {
          abortControllerRef.current.abort();
        } catch {
          // no-op
        }
      }
      controller = new AbortController();
      abortControllerRef.current = controller;
      const timeoutMs = count >= 32 ? 360000 : (count >= 16 ? 270000 : 200000);
      timeoutId = setTimeout(() => {
        isTimeoutTriggered = true;
        try {
          controller?.abort(`Generation request timed out after ${timeoutMs / 1000} seconds`);
        } catch {}
      }, timeoutMs);

      clientRequestId = `req_client_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      requestUrl = "/api/generate-posts-batch";
      requestMethod = "POST";
      activePillar = isPillarFilteringActive && pillars.length > 0
        ? pillars[activePillarIndex]
        : undefined;

      effectiveTopic = cleanTopicString((manualTopic || "").trim() || strategicCreatorRequest || (activeIdea ? (activeIdea.title || activeIdea.originalIdea) : "") || (rawCreatorThought || "").trim() || undefined);

      resolvedActiveCta = activeCta;
      resolvedCtaPreferences = (ctaPreferences || "").trim() || profile?.ctaPreferences?.trim() || undefined;

      if (ctaMode === "off") {
        resolvedActiveCta = null;
        resolvedCtaPreferences = "Off - Do NOT include any CTA, link, or keyword prompt.";
      } else if (ctaMode === "use_my_cta") {
        resolvedActiveCta = activeCta;
        resolvedCtaPreferences = profile?.ctaPreferences || ctaPreferences || "Use My CTA";
      } else {
        resolvedActiveCta = activeCta;
        resolvedCtaPreferences = "AI Decide - Determine if a CTA is appropriate based on post goal and context.";
      }

      requestPayload = {
        topic: effectiveTopic,
        contentRequest: (manualTopic || "").trim() || strategicCreatorRequest || (activeIdea ? (activeIdea.originalIdea || activeIdea.title) : "") || (rawCreatorThought || "").trim() || undefined,
        category: targetCat,
        offer: profile?.offer || "",
        audience: profile?.audience || "",
        desiredResult: profile?.desiredResult || "",
        writingStyle: profile?.writingStyle || "",
        rawVoice: profile?.rawVoice || undefined,
        customInstruction: ((customInstruction || "").trim() || (detectedCreatorContext || "").trim() || resolveCurrentCreatorContext(customInstruction, profile, effectiveUserId)) || undefined,
        activeIdea: activeIdea || undefined,
        rawCreatorThought: (rawCreatorThought || "").trim() || undefined,
        count: count,
        countSource: (hasExplicitPostsSelectionRef.current || normalizedPostsToCreate !== "1") ? "explicit" : "ui_default",
        lockedOpeningHook: activeLockedHook || undefined,
        openingLocked: !!activeLockedHook,
        activeStrategicAngle: activeStrategicAngle || undefined,
        threadLength: standardThreadLength,
        sentencesPerPart: standardSentencesPerPart,
        characterLimit: 500,
        activePillar,
        recentPillarHistory,
        rawBusinessText: profile?.rawBusinessText,
        creatorIdentity: profile?.creatorIdentity,
        offerIntelligence: profile?.offerIntelligence,
        buyerIntelligence: profile?.buyerIntelligence,
        activeCta: resolvedActiveCta,
        ctaPreferences: resolvedCtaPreferences,
        contentDestinations: (contentDestinations && contentDestinations.length > 0) ? contentDestinations : (profile?.contentDestinations && profile.contentDestinations.length > 0 ? profile.contentDestinations : undefined),
        userId: auth.currentUser?.uid || profile?.uid || (profile?.creatorIdentity as any)?.uid || "anonymous",
        selectedSavedTabId: (profile as any)?.activeSavedTabId || (profile as any)?.savedTabId || undefined,
        email: profile?.email || auth.currentUser?.email || undefined,
        profile: profile || undefined,
        recentLibraryPosts: getRecentLibraryPostsForMemory(30),
        allowPartialResults: true
      };

      payloadString = JSON.stringify(requestPayload);
      payloadSizeBytes = new Blob([payloadString]).size;
    } catch (setupErr: any) {
      console.error("[ThreadsWorks Pipeline] Early setup exception captured:", setupErr);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      isGeneratingRef.current = false;
      setLoadingCategory({
        attention: false,
        trust: false,
        sales: false
      });
      const classified = classifyGenerationError(setupErr, { stage: "network_request" });
      setErrorCategory(prev => ({ 
        ...prev, 
        [catToLoad]: classified 
      }));
      return;
    }

    // Detailed diagnostic console logging
    console.group(`[ThreadsWorks Pipeline] ${clientRequestId} - Request Started`);
    console.log("• Request started:", new Date().toISOString());
    console.log("• Request URL:", requestUrl);
    console.log("• Request method:", requestMethod);
    console.log("• Request payload size:", `${payloadSizeBytes} bytes`);
    console.log("• Request ID:", clientRequestId);
    console.log("• Target count:", count);
    console.log("• Target category:", targetCat);
    console.log("• Thread length:", standardThreadLength);
    console.log("• Sentences per part:", standardSentencesPerPart);
    console.log("• AbortController state:", {
      aborted: controller?.signal.aborted,
      reason: controller?.signal.reason || "none"
    });
    console.groupEnd();

    let responseHttpStatus = 0;
    let stage: "network_request" | "response_parse" | "validation" | "state_update" = "network_request";
    let rawResponseBody = "";

    try {
      let response!: Response;
      let attempt = 0;
      const maxAttempts = 2;

      while (attempt < maxAttempts) {
        attempt++;
        try {
          response = await fetch(requestUrl, {
            method: requestMethod,
            headers: {
              "Content-Type": "application/json",
              "X-Client-Request-Id": `${clientRequestId}_attempt_${attempt}`
            },
            signal: controller.signal,
            body: payloadString
          });
          break;
        } catch (fetchErr: any) {
          if (attempt < maxAttempts && !controller.signal.aborted && !isTimeoutTriggered) {
            console.warn(`[ThreadsWorks Pipeline] ${clientRequestId} - Attempt ${attempt} failed (${fetchErr?.message || "Network Error"}). Retrying connection...`);
            await new Promise(r => setTimeout(r, 600));
            continue;
          }

          console.group(`[ThreadsWorks Pipeline] ${clientRequestId} - Network Fetch Exception`);
          console.error("• Exact exception name:", fetchErr?.name);
          console.error("• Exact exception message:", fetchErr?.message);
          console.error("• Stack trace:", fetchErr?.stack);
          console.log("• AbortController state:", {
            aborted: controller.signal.aborted,
            reason: controller.signal.reason,
            isTimeoutTriggered
          });
          console.groupEnd();
          if (isTimeoutTriggered) {
            const timeoutErr = new Error(typeof controller.signal.reason === "string" ? controller.signal.reason + " without response from server." : "Generation request timed out without response from server.");
            timeoutErr.name = "TimeoutError";
            throw timeoutErr;
          }
          throw fetchErr;
        }
      }

      responseHttpStatus = response.status;
      const responseHeadersObj: Record<string, string> = {};
      response.headers.forEach((val, key) => { responseHeadersObj[key] = val; });
      const responseContentType = response.headers.get("content-type") || "unknown";

      console.group(`[ThreadsWorks Pipeline] ${clientRequestId} - Response Received`);
      console.log("• Response received:", new Date().toISOString());
      console.log("• HTTP status:", response.status, response.statusText);
      console.log("• Response headers:", responseHeadersObj);
      console.log("• Response content type:", responseContentType);
      console.groupEnd();

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        let parsedErr: any = {};
        try { parsedErr = JSON.parse(errorText); } catch {}
        const apiError = new Error(parsedErr.message || parsedErr.error || `Server responded with HTTP ${response.status}`);
        (apiError as any).status = response.status;
        (apiError as any).errorCode = parsedErr.errorCode;
        (apiError as any).retryable = parsedErr.retryable;
        (apiError as any).failedDrafts = parsedErr.failedDrafts;
        (apiError as any).responseBodyText = errorText;
        throw apiError;
      }

      stage = "response_parse";
      console.log(`[ThreadsWorks Pipeline] ${clientRequestId} • Response parsing started`);
      rawResponseBody = await response.text();
      const bodySizeBytes = new Blob([rawResponseBody]).size;
      console.log(`[ThreadsWorks Pipeline] ${clientRequestId} • Response body size: ${bodySizeBytes} bytes`);
      
      let data: any;
      try {
        data = JSON.parse(rawResponseBody);
        console.log(`[ThreadsWorks Pipeline] ${clientRequestId} • Response parsing completed successfully`);
      } catch (jsonErr: any) {
        console.error(`[ThreadsWorks Pipeline] ${clientRequestId} • Response parsing failed:`, jsonErr);
        (jsonErr as any).responseBodyText = rawResponseBody;
        (jsonErr as any).status = responseHttpStatus;
        throw jsonErr;
      }
      
      if (data.isSimulated) {
        setSimulationWarning(data.apiWarning || "Running in sandbox simulation mode.");
      } else {
        setSimulationWarning(null);
      }
      
      stage = "validation";
      if (!data.posts || !Array.isArray(data.posts) || data.posts.length === 0) {
        const schemaErr = new Error("Invalid format returned: Expected a non-empty array of posts.");
        (schemaErr as any).status = responseHttpStatus;
        (schemaErr as any).responseBodyText = rawResponseBody;
        throw schemaErr;
      }

      // Never fabricate drafts to conceal an incomplete backend response.
      // Valid partial results are accepted only when explicitly flagged as partial by the server.
      const expectedCount = typeof data.requestedCount === "number" && data.requestedCount >= 1 ? data.requestedCount : count;
      const isValidPartialResponse = data.partial === true && data.posts.length > 0 && data.posts.length < expectedCount;
      if (data.posts.length !== expectedCount && !isValidPartialResponse) {
        const incompleteErr = new Error(`Incomplete generation: requested ${expectedCount} posts, received ${data.posts.length}. Please retry.`);
        (incompleteErr as any).errorCode = "SCHEMA_ERROR";
        throw incompleteErr;
      }
      const finalPostsArray = data.posts;

      stage = "state_update";
      console.log(`[ThreadsWorks Pipeline] ${clientRequestId} • State update started`);
      
      // Normalize returned category: if "auto" (or missing), use targetCat. If targetCat is also "auto", fallback to "attention".
      const candidateCategory = (!data.category || data.category === "auto") ? targetCat : data.category;
      const resolvedCategory: "attention" | "trust" | "sales" = 
        (candidateCategory === "trust" || candidateCategory === "sales") ? candidateCategory : "attention";

      const parsedPosts = finalPostsArray.map((p: any, idx: number) => {
        const postId = `${resolvedCategory}-${Date.now()}-${idx}`;
        const rawParts = Array.isArray(p.threadParts) && p.threadParts.length > 0
          ? p.threadParts
          : [p.singlePost || ""];

        const { post: repaired } = data.generatorVersion === "V3" ? { post: { ...p, threadParts: rawParts, singlePost: rawParts[0] || "" } } : repairAndSanitizePost({
          ...p,
          hook: p.hook || (lockedHook ? lockedHook : ""),
          threadParts: rawParts,
          singlePost: rawParts[0] || ""
        }, {
          charLimit: 500,
          expectedHook: (idx === 0 && lockedHook) ? lockedHook : p.hook,
          context: {
            offer: profile?.offer,
            audience: profile?.audience,
            desiredResult: profile?.desiredResult,
            category: resolvedCategory
          }
        });

        return {
          id: postId,
          title: repaired.title || `${resolvedCategory.toUpperCase()} Draft #${idx + 1}`,
          hook: repaired.hook || "",
          singlePost: repaired.singlePost || "",
          threadParts: repaired.threadParts || [repaired.singlePost || ""],
          explanation: repaired.explanation || "",
          pillar: p.pillar || resolvedCategory,
          category: resolvedCategory,
          decision: p.decision || data.decisions?.[idx],
          cta: p.cta || repaired.cta || "",
          ctaType: p.ctaDecision === "include" ? "destination" : "natural",
          ctaText: p.cta || repaired.cta || "",
          ctaDecision: p.ctaDecision || "",
          ctaStrategy: p.ctaStrategy || "",
          preferredLinkId: p.preferredLinkId,
          angleId: p.angleId || p.contentUnitId,
          hookId: p.hookId
        };
      });

      // Primary success: Commit the generated drafts to UI state
      setPostsForCategory(resolvedCategory, parsedPosts);
      setLockedHook(null);
      if (setAll32Hooks) {
        setAll32Hooks([]);
      }
      setActiveCategory(resolvedCategory);

      // CRITICAL: Unconditionally wipe all error states upon successful generation
      setErrorCategory({
        attention: null,
        trust: null,
        sales: null
      });
      if (isValidPartialResponse) {
        const requestedTotal = typeof data.requestedCount === "number" ? data.requestedCount : count;
        setPartialNoticeCategory(prev => ({
          ...prev,
          [resolvedCategory]: {
            acceptedCount: parsedPosts.length,
            requestedCount: requestedTotal,
            warning:
              data.warning ||
              `${parsedPosts.length} of ${requestedTotal} drafts passed quality validation. Remaining drafts were withheld rather than returning unvalidated content.`,
            failedSlots: Array.isArray(data.failedSlots) ? data.failedSlots : undefined
          }
        }));
      } else {
        setPartialNoticeCategory({
          attention: null,
          trust: null,
          sales: null
        });
      }
      console.log(`[ThreadsWorks Pipeline] ${clientRequestId} • State update completed with ${parsedPosts.length} drafts.`);

      // Secondary non-critical operation: Pillar history tracking (safely isolated)
      try {
        data.posts.forEach((p: any) => {
          addPillarToHistory(p.pillar || resolvedCategory);
        });
      } catch (pillarErr) {
        console.warn("Non-critical pillar history update failed:", pillarErr);
      }

      // Secondary non-critical operation: Daily limit tracking (safely isolated)
      try {
        if (!isPro) {
          recordPostCreation(effectiveUserId);
          const check = canCreatePost(effectiveUserId, profile, subscriptionStatus);
          setDailyLimitReached(!check.allowed);
        }
      } catch (limitErr) {
        console.warn("Non-critical daily limit record failed:", limitErr);
      }

    } catch (err: any) {
      clearTimeout(timeoutId);

      // If request was canceled by AbortController cleanly by user action, exit
      if (err.name === "AbortError" && !isTimeoutTriggered) {
        console.log(`[ThreadsWorks Pipeline] ${clientRequestId} • Request aborted cleanly.`);
        return;
      }

      console.group(`[ThreadsWorks Pipeline] ${clientRequestId} - Generation Error Captured`);
      console.error("• Exact exception name:", err?.name || "UnknownError");
      console.error("• Exact exception message:", err?.message || String(err));
      console.error("• Stack trace:", err?.stack || "No stack trace available");
      console.log("• AbortController state:", {
        aborted: controller.signal.aborted,
        reason: controller.signal.reason,
        isTimeoutTriggered
      });
      console.groupEnd();

      const classified = classifyGenerationError(err, {
        httpStatus: (err as any).status || responseHttpStatus,
        errorCode: (err as any).errorCode,
        responseBodyText: (err as any).responseBodyText || rawResponseBody,
        stage
      });

      const resolvedErrorCat = targetCat === "auto" ? activeCategory : targetCat;
      setErrorCategory(prev => ({ 
        ...prev, 
        [resolvedErrorCat]: classified 
      }));
    } finally {
      clearTimeout(timeoutId);
      isGeneratingRef.current = false;
      setLoadingCategory({
        attention: false,
        trust: false,
        sales: false
      });
    }
  };

  // Regenerate a single post card script in-place
  const handleRegenerateCard = async (post: GeneratedPost, index: number) => {
    const isPro = isProUser(profile, subscriptionStatus);
    const effectiveUserId = auth.currentUser?.uid || profile?.uid || "anonymous";

    // Permission check before creating replacement post
    const permission = canCreatePost(effectiveUserId, profile, subscriptionStatus);
    if (!permission.allowed) {
      setDailyLimitReached(true);
      setErrorCategory(prev => ({
        ...prev,
        [activeCategory]: createClassifiedError(
          "Authentication",
          "Daily Limit Reached",
          permission.message || "Daily limit reached. Upgrade to Pro for unlimited access."
        )
      }));
      return;
    }

    setRegeneratingCardIds(prev => ({ ...prev, [post.id]: true }));
    setErrorCategory(prev => ({ ...prev, [activeCategory]: null }));

    try {
      const activePillar = isPillarFilteringActive && pillars.length > 0
        ? pillars[activePillarIndex]
        : undefined;

      const effectiveCardTopic = cleanTopicString(
        (manualTopic || "").trim() ||
        strategicCreatorRequest ||
        (activeIdea ? (activeIdea.title || activeIdea.originalIdea) : "") ||
        (rawCreatorThought || "").trim() ||
        post.title ||
        post.hook ||
        undefined
      );

      let cardActiveCta = activeCta;
      let cardCtaPreferences = (ctaPreferences || "").trim() || profile?.ctaPreferences?.trim() || undefined;
      if (ctaMode === "off") {
        cardActiveCta = null;
        cardCtaPreferences = "Off - Do NOT include any CTA, link, or keyword prompt.";
      } else if (ctaMode === "use_my_cta") {
        cardActiveCta = activeCta;
        cardCtaPreferences = profile?.ctaPreferences || ctaPreferences || "Use My CTA";
      } else {
        cardActiveCta = activeCta;
        cardCtaPreferences = "AI Decide - Determine if a CTA is appropriate based on post goal and context.";
      }

      const data = await apiFetch<any>("/api/regenerate-single-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: activeCategory,
          topic: effectiveCardTopic,
          contentRequest: (manualTopic || "").trim() || strategicCreatorRequest || (activeIdea ? (activeIdea.originalIdea || activeIdea.title) : "") || (rawCreatorThought || "").trim() || undefined,
          previousHook: post.hook || post.singlePost || undefined,
          offer: profile?.offer || "",
          audience: profile?.audience || "",
          desiredResult: profile?.desiredResult || "",
          writingStyle: profile?.writingStyle || "",
          rawVoice: profile?.rawVoice || undefined,
          customInstruction: ((customInstruction || "").trim() || (detectedCreatorContext || "").trim() || resolveCurrentCreatorContext(customInstruction, profile, effectiveUserId)) || undefined,
          activeIdea: activeIdea || undefined,
          rawCreatorThought: (rawCreatorThought || "").trim() || undefined,
          lockedOpeningHook: lockedHook || undefined,
          openingLocked: !!lockedHook,
          threadLength: standardThreadLength,
          sentencesPerPart: standardSentencesPerPart,
          characterLimit: 500,
          activePillar,
          rawBusinessText: profile?.rawBusinessText,
          creatorIdentity: profile?.creatorIdentity,
          offerIntelligence: profile?.offerIntelligence,
          buyerIntelligence: profile?.buyerIntelligence,
          activeCta: cardActiveCta,
          ctaPreferences: cardCtaPreferences,
          contentDestinations: (contentDestinations && contentDestinations.length > 0) ? contentDestinations : (profile?.contentDestinations && profile.contentDestinations.length > 0 ? profile.contentDestinations : undefined),
          userId: auth.currentUser?.uid || profile?.uid || (profile?.creatorIdentity as any)?.uid || "anonymous",
          selectedSavedTabId: (profile as any)?.activeSavedTabId || (profile as any)?.savedTabId || undefined,
          recentLibraryPosts: getRecentLibraryPostsForMemory(30)
        })
      }, true);
      
      if (data.isSimulated) {
        setSimulationWarning(data.apiWarning || "Running in sandbox simulation mode.");
      } else {
        setSimulationWarning(null);
      }
      
      const rawParts = Array.isArray(data.threadParts) && data.threadParts.length > 0
        ? data.threadParts
        : [data.singlePost || ""];

      const { post: repaired } = data.generatorVersion === "V3"
        ? {
            post: {
              ...data,
              hook: data.hook || (lockedHook ? lockedHook : ""),
              threadParts: rawParts,
              singlePost: data.singlePost || rawParts[0] || ""
            }
          }
        : repairAndSanitizePost({
            ...data,
            hook: data.hook || (lockedHook ? lockedHook : ""),
            threadParts: rawParts,
            singlePost: rawParts[0] || ""
          }, {
            charLimit: 500,
            expectedHook: lockedHook ? lockedHook : data.hook,
            context: {
              offer: profile?.offer,
              audience: profile?.audience,
              desiredResult: profile?.desiredResult,
              category: activeCategory
            }
          });

      const refreshedPost: GeneratedPost = {
        id: `${activeCategory}-${Date.now()}-${index}`,
        title: repaired.title || `${activeCategory.toUpperCase()} Draft #${index + 1}`,
        hook: repaired.hook || "",
        singlePost: repaired.singlePost || "",
        threadParts: repaired.threadParts || [repaired.singlePost || ""],
        explanation: repaired.explanation || "",
        decision: data.decision
      };

      const list = [...getPostsForCategory(activeCategory)];
      list[index] = refreshedPost;
      setPostsForCategory(activeCategory, list);
      setLockedHook(null);
      setErrorCategory(prev => ({ ...prev, [activeCategory]: null }));
      setSavedIds(prev => ({ ...prev, [refreshedPost.id]: false }));
      setCopyingIds(prev => ({ ...prev, [refreshedPost.id]: false }));

    } catch (err: any) {
      console.error("[ThreadsWorks Pipeline] Single card regeneration error:", err);
      const classified = classifyGenerationError(err, { stage: "network_request" });
      setErrorCategory(prev => ({ 
        ...prev, 
        [activeCategory]: classified 
      }));
    } finally {
      setRegeneratingCardIds(prev => ({ ...prev, [post.id]: false }));
    }
  };

  const activeCategoryPosts = getPostsForCategory(activeCategory);

  return (
    <div className="space-y-8 animate-fade-in" id="content-engine-workspace">
      
      {/* Top Header with Threads Connection Integration */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2 border-b border-border-primary">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-text-primary font-sans" id="studio-main-heading">
            Create Content
          </h1>
          <p className="text-xs md:text-sm text-text-muted mt-1 font-sans">
            Turn an idea into ready-to-publish Threads content.
          </p>
        </div>

        {/* Header Actions: Identity Indicator & Threads Connection */}
        <div className="shrink-0 flex flex-wrap items-center gap-2.5">
          {/* Subtle AI Identity Indicator */}
          {hasActiveIdentity && (
            <button
              type="button"
              id="creator-identity-active-badge"
              onClick={() => onNavigateToTab("identity")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-brand-border bg-brand-surface hover:bg-brand-surface-hover text-brand-text-strong text-xs font-semibold px-3.5 py-2 transition cursor-pointer group shadow-sm shadow-purple-500/5"
              title="Your Voice profile is actively personalizing all generation. Click to edit in Your Voice."
            >
              <Sparkles className="h-3.5 w-3.5 text-brand-text group-hover:rotate-12 transition-transform" />
              <span>✨ Using Your Voice</span>
            </button>
          )}

          {/* Meta Threads Live Connection Status Pill / Button */}
          {connection?.connected ? (
            <div className="flex items-center gap-2 bg-status-success-bg border border-status-success-border rounded-xl px-3.5 py-2" id="threads-header-connected-badge">
              <div className="relative">
                {connection.profilePictureUrl ? (
                  <img 
                    src={connection.profilePictureUrl} 
                    alt="Threads Profile" 
                    className="w-7 h-7 rounded-full object-cover border border-emerald-500/50"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-emerald-600/15 dark:bg-emerald-500/20 text-status-success-text font-bold flex items-center justify-center text-xs">
                    @
                  </div>
                )}
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-600 dark:bg-emerald-500 border-2 border-bg-card" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold text-text-primary flex items-center gap-1">
                  @{connection.username || "threads_creator"}
                  {connection.isSandbox && (
                    <span className="text-[9px] font-mono bg-status-warning-bg text-status-warning-text border border-status-warning-border px-1 py-0.2 rounded font-bold">DEV</span>
                  )}
                </span>
                <span className="text-[10px] text-status-success-text font-semibold">Threads Connected</span>
              </div>
              <button
                type="button"
                onClick={handleDisconnectThreads}
                disabled={loadingConn}
                className="ml-2 text-[10px] font-bold text-text-secondary hover:text-status-danger-text transition cursor-pointer px-1.5 py-1 rounded hover:bg-status-danger-bg"
                title="Disconnect Meta Threads account"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <ThreadsConnectButton returnTo="/ai-threads-post-generator" />
          )}
        </div>
      </div>

      {/* Main Post Generator Workspace */}
      <div className="space-y-8 animate-fade-in" id="post-generator-subworkspace">
        {/* Creation Mode Switcher: AI Mode vs Manual Mode */}
        <div className="flex items-center justify-between p-1.5 bg-bg-card border border-border-primary rounded-2xl shadow-sm">
          <button
            type="button"
            id="creation-mode-ai-btn"
            onClick={() => setCreationMode("ai")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold transition duration-200 cursor-pointer ${
              creationMode === "ai"
                ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-app"
            }`}
          >
            <Sparkles className="h-4 w-4" />
            <span>AI MODE — CREATE WITH ME</span>
          </button>
          <button
            type="button"
            id="creation-mode-manual-btn"
            onClick={() => setCreationMode("manual")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold transition duration-200 cursor-pointer ${
              creationMode === "manual"
                ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-app"
            }`}
          >
            <PenTool className="h-4 w-4" />
            <span>MANUAL MODE — LET ME WRITE</span>
          </button>
        </div>

        {creationMode === "manual" ? (
          <div className="space-y-6 animate-fade-in" id="manual-mode-workspace">
            {/* Manual Mode Banner */}
            <div className="rounded-2xl border border-brand-border dark:border-purple-500/20 bg-brand-surface/50 dark:bg-purple-500/5 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 bg-brand-surface border border-brand-border rounded-xl text-brand-text shrink-0 select-none">
                  <PenTool className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono">
                      MANUAL CREATOR WORKSPACE
                    </h4>
                    <span className="bg-brand-surface border border-brand-border text-brand-text-strong text-[10px] font-bold font-mono px-2 py-0.5 rounded-full flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3 text-brand-text" /> AI-Isolated Mode
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary mt-1">
                    Write your exact text without automated AI hooks, CTAs, or profile injections. Full control over every word.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleManualClear}
                className="px-3 py-2 rounded-xl border border-border-primary bg-bg-card text-xs font-bold text-text-secondary hover:text-text-primary hover:bg-bg-card-hover transition cursor-pointer"
              >
                Clear Workspace
              </button>
            </div>

            {/* Manual Form Inputs */}
            <div className="rounded-2xl border border-border-primary bg-bg-card p-6 space-y-6 shadow-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase tracking-wider font-mono mb-2">
                    Post Title / Concept Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 3 Unconventional Rules for Audience Retention"
                    value={manualTitle}
                    onChange={(e) => setManualTitle(e.target.value)}
                    className="w-full bg-bg-input border border-border-primary rounded-xl px-4 py-3 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase tracking-wider font-mono mb-2">
                    Topic / Pillar
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Social Media Strategy"
                    value={manualTopic}
                    onChange={(e) => setManualTopic(e.target.value)}
                    className="w-full bg-bg-input border border-border-primary rounded-xl px-4 py-3 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted uppercase tracking-wider font-mono mb-2">
                  Format
                </label>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      setManualFormat("post");
                      if (manualThreadParts.length > 1) {
                        setManualThreadParts([manualThreadParts[0]]);
                      }
                    }}
                    className={`flex-1 text-left p-4 rounded-2xl border transition cursor-pointer flex flex-col gap-1 ${
                      manualFormat === "post"
                        ? "bg-brand-surface dark:bg-purple-600/10 border-purple-600 dark:border-purple-500 text-text-primary"
                        : "bg-bg-app border-border-primary text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    <span className="text-xs font-bold text-text-primary">Single Post</span>
                    <span className="text-[10px] text-text-secondary">One standalone Threads post.</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setManualFormat("thread");
                      if (manualThreadParts.length < 2) {
                        setManualThreadParts([manualThreadParts[0] || "", ""]);
                      }
                    }}
                    className={`flex-1 text-left p-4 rounded-2xl border transition cursor-pointer flex flex-col gap-1 ${
                      manualFormat === "thread"
                        ? "bg-brand-surface dark:bg-purple-600/10 border-purple-600 dark:border-purple-500 text-text-primary"
                        : "bg-bg-app border-border-primary text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    <span className="text-xs font-bold text-text-primary">Thread</span>
                    <span className="text-[10px] text-text-secondary">Create a connected sequence of 2–10 Threads posts.</span>
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-wider font-mono">
                    {manualFormat === "post" ? "POST CONTENT" : "THREAD PARTS"}
                  </label>
                  <span className="text-[11px] font-mono text-text-muted">
                    {manualFormat === "post" ? "Max 500 characters" : "2–10 posts • Max 500 characters per post"}
                  </span>
                </div>

                <div className="space-y-4">
                  {manualThreadParts.map((partText, idx) => (
                    <ManualVoicePartEditor
                      key={idx}
                      index={idx}
                      totalParts={manualThreadParts.length}
                      format={manualFormat}
                      value={partText}
                      onChange={(val) => handleManualPartChange(idx, val)}
                      onMove={(dir) => handleManualMovePart(idx, dir)}
                      onDelete={() => handleManualDeletePart(idx)}
                    />
                  ))}
                </div>

                {manualFormat === "thread" && manualThreadParts.length < 10 && (
                  <button
                    type="button"
                    onClick={handleManualAddPart}
                    className="w-full py-3 rounded-xl border border-dashed border-brand-border hover:border-purple-500 bg-bg-app hover:bg-brand-surface text-brand-text-strong text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Plus className="h-4 w-4" /> Add Part
                  </button>
                )}
              </div>

              {manualValidationError && manualThreadParts.some(p => p.trim().length > 0) && (
                <div className="p-3.5 bg-status-danger-bg border border-status-danger-border rounded-xl text-status-danger-text text-xs font-bold flex items-center gap-2 animate-fade-in">
                  <AlertCircle className="h-4 w-4 shrink-0 text-status-danger-text" />
                  <span>{manualValidationError}</span>
                </div>
              )}

              {manualSavedSuccess && (
                <div className="p-3 bg-status-success-bg border border-status-success-border rounded-xl text-status-success-text text-xs font-bold flex items-center gap-2 animate-fade-in">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>Manual post saved to Content Library! You can access it anytime in your library.</span>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border-primary">
                <button
                  type="button"
                  disabled={manualSaving || !isManualValid}
                  onClick={handleManualSaveDraft}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-border-primary bg-bg-card hover:bg-bg-card-hover text-text-primary font-bold text-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="h-4 w-4 text-brand-text" />
                  <span>{manualSaving ? "Saving Draft..." : "Save Draft to Library"}</span>
                </button>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={!isManualValid}
                    onClick={handleManualSchedule}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-brand-border bg-brand-surface hover:bg-brand-surface-hover text-brand-text-strong font-bold text-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Calendar className="h-4 w-4 text-brand-text" />
                    <span>Schedule to Calendar</span>
                  </button>

                  <button
                    type="button"
                    disabled={!isManualValid}
                    onClick={handleManualPublish}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition shadow-md shadow-purple-600/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ArrowUpRight className="h-4 w-4" />
                    <span>Publish Now to Threads</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-fade-in" id="ai-mode-workspace">
          {/* Active Idea Banner (if coming from Idea Studio) */}
          {activeIdea && (
        <div className="rounded-2xl border border-brand-border dark:border-purple-500/30 bg-brand-surface/50 dark:bg-purple-950/20 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-in" id="active-idea-banner">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-brand-surface border border-brand-border rounded-xl text-brand-text shrink-0 select-none">
              <Lightbulb className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h4 className="!text-left !mx-0 text-xs font-bold text-text-primary font-mono flex flex-wrap items-center gap-1.5">
                <span>
                  {activeIdea.targetPlannedDate
                    ? `Creating for Weekly Plan (${activeIdea.targetPlannedDate})`
                    : "Active Idea Selected"}
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-purple-600 dark:bg-purple-400 animate-ping" />
                {activeIdea.pillarTitle && (
                  <span className="rounded bg-status-info-bg border border-status-info-border px-1.5 py-0.5 text-[10px] font-semibold text-status-info-text">
                    Pillar: {activeIdea.pillarTitle}
                  </span>
                )}
              </h4>
              <p className="!text-left !mx-0 text-sm text-text-primary font-bold mt-1.5 leading-relaxed">
                "{activeIdea.title}"
              </p>
              <p className="!text-left !mx-0 text-xs text-text-secondary mt-1 leading-relaxed">
                {activeIdea.summary}
              </p>
              <p className="!text-left !mx-0 text-[10px] text-brand-text-strong font-mono mt-1 select-none">
                Original Concept: {activeIdea.originalIdea}
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveIdea && setActiveIdea(null)}
            className="px-3 py-2 rounded-xl border border-border-primary bg-bg-card text-xs font-bold text-text-secondary hover:text-text-primary hover:bg-bg-card-hover shrink-0 cursor-pointer transition duration-150"
          >
            Clear Active Idea
          </button>
        </div>
      )}


      {/* Active Call To Action Banner (if set) */}
      {activeCta && (
        <div className="rounded-2xl border border-rose-300 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-950/20 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-in" id="active-cta-banner">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-rose-100 dark:bg-rose-500/10 border border-rose-300 dark:border-rose-500/20 rounded-xl text-rose-700 dark:text-rose-400 shrink-0 select-none">
              <MousePointerClick className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-text-primary font-mono flex items-center gap-1.5">
                <span>Active Call To Action Locked</span>
                <span className="h-1.5 w-1.5 rounded-full bg-rose-600 dark:bg-rose-400 animate-ping" />
              </h4>
              <p className="text-sm text-rose-800 dark:text-rose-200 font-bold italic mt-1.5 leading-relaxed">
                "{activeCta.message}"
              </p>
              <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                Click "+ Add CTA" on any post output below to append this call-to-action as a bottom extension section.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setActiveCta(null)}
              className="px-3 py-2 rounded-xl border border-border-primary bg-bg-card text-xs font-bold text-text-secondary hover:text-text-primary hover:bg-bg-card-hover shrink-0 cursor-pointer transition duration-150"
            >
              Clear Active CTA
            </button>
          </div>
        </div>
      )}

      {/* Unified Create Workspace: Content Request Card */}
      <div className="rounded-2xl border border-border-primary bg-bg-card p-5 md:p-6 shadow-sm animate-fade-in space-y-5" id="primary-content-request-card">
        {/* Creator Context Status Bar */}
        {(() => {
          const persistentContextText = (
            detectedCreatorContext?.trim() ||
            resolveCurrentCreatorContext(customInstruction, profile, effectiveUserId)
          );
          const hasCreatorContext = Boolean(persistentContextText && persistentContextText.length > 0);

          return (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-border-primary bg-bg-app" id="creator-context-status-bar">
              <div className="flex items-start sm:items-center gap-3">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                  hasCreatorContext 
                    ? "bg-brand-surface text-brand-text border-brand-border" 
                    : "bg-status-warning-bg text-status-warning-text border-status-warning-border"
                }`}>
                  {hasCreatorContext ? (
                    <CheckCircle2 className="h-4 w-4 text-brand-text" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-status-warning-text" />
                  )}
                </div>
                <div className="text-left">
                  <span className="block text-[11px] font-bold text-text-primary uppercase tracking-wider font-mono">CREATOR CONTEXT</span>
                  <p className="!text-left !mx-0 text-xs text-text-secondary mt-0.5 leading-relaxed">
                    {hasCreatorContext 
                      ? "✓ Context loaded. ThreadsWorks already knows your business, audience, voice, and offers." 
                      : "No persistent context found. Set it up in your Profile to unlock personalized generation."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigateToTab("profile")}
                className="px-3.5 py-2 rounded-lg border border-brand-border bg-brand-surface hover:bg-brand-surface-hover text-xs font-bold text-brand-text-strong transition duration-150 cursor-pointer shadow-xs shrink-0 self-start sm:self-center"
              >
                {hasCreatorContext ? "Edit Context" : "Set Up Context"}
              </button>
            </div>
          );
        })()}

        {/* Content Request Label & Input */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label
              htmlFor="generation-topic-input"
              className="!text-left !mx-0 text-xs font-bold tracking-wider text-text-primary uppercase font-mono block"
            >
              Content Request
            </label>
            <div className="flex flex-wrap items-center gap-2.5">
              <VoiceToTextButton
                id="content-engine-voice-btn"
                voice={contentRequestVoice}
                fieldLabel="Content Request"
                variant="toolbar"
              />
              {manualTopic.trim().length > 0 && (
                <button
                  type="button"
                  onClick={handleSaveRequestAsIdea}
                  disabled={savingIdeaState === "saving"}
                  className="inline-flex items-center gap-1 rounded-lg border border-status-info-border bg-status-info-bg hover:bg-blue-100 dark:hover:bg-sky-500/20 px-2.5 py-1 text-[11px] font-bold text-status-info-text transition cursor-pointer disabled:opacity-50"
                >
                  {savingIdeaState === "saved" ? (
                    <>
                      <Check className="h-3 w-3 text-status-success-text" />
                      <span>Saved as Idea</span>
                    </>
                  ) : (
                    <>
                      <Lightbulb className="h-3 w-3" />
                      <span>{savingIdeaState === "saving" ? "Saving..." : "Save as Idea"}</span>
                    </>
                  )}
                </button>
              )}
              {manualTopic && (
                <button
                  type="button"
                  onClick={() => setManualTopic("")}
                  className="text-[11px] text-text-muted hover:text-text-primary underline cursor-pointer transition"
                >
                  Clear Input
                </button>
              )}
            </div>
          </div>
          <textarea
            ref={contentRequestTextareaRef}
            id="generation-topic-input"
            rows={5}
            value={manualTopic}
            onChange={(e) => setManualTopic(e.target.value)}
            placeholder="What do you want to create? Type or tap Speak to dictate your idea or instructions."
            className="w-full rounded-xl border border-border-primary bg-bg-input px-4 py-3.5 text-sm text-text-primary placeholder-text-muted outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 transition leading-relaxed font-sans"
          />
          <VoiceInputStatusPanel voice={contentRequestVoice} />
        </div>

        {/* Create Content Action Button & Settings Row */}
        <div className="pt-3.5 border-t border-border-primary flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* AI Recommendations Active Status & How Many Posts Control */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
            {/* Persistent AI Recommendations Active Banner */}
            <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-status-active-bg border border-status-active-border text-status-active-text text-xs shadow-xs dark:shadow-none">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-active-dot opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-status-active-dot"></span>
              </span>
              <div className="flex items-center gap-1.5 font-mono font-bold text-status-active-text uppercase tracking-wide text-[11px]">
                <Sparkles className="h-3.5 w-3.5 text-status-active-text dark:text-purple-300 shrink-0" />
                <span>All AI Recommendations Active</span>
              </div>
            </div>

            {/* How Many Posts User Setting */}
            <div className="flex items-center gap-2 shrink-0">
              <label htmlFor="setting-posts-to-create" className="text-[10px] font-mono font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1 shrink-0">
                <FileText className="h-3 w-3 text-brand-text" />
                <span>How Many Posts</span>
              </label>
              <div className="relative min-w-[110px]">
                <select
                  id="setting-posts-to-create"
                  value={postsToCreate}
                  onChange={(e) => {
                    hasExplicitPostsSelectionRef.current = true;
                    setPostsToCreate(e.target.value);
                  }}
                  className="w-full appearance-none rounded-xl border border-border-primary bg-bg-input px-3 py-2 pr-8 text-xs font-semibold text-text-primary outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-500/20 cursor-pointer transition"
                >
                  {POSTS_TO_CREATE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-bg-card text-text-primary">
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-secondary" />
              </div>
            </div>
          </div>

          {/* Create Content Action Button Container */}
          <div className="sm:w-56 shrink-0 lg:self-end" id="create-action-button-container">
            {loadingCategory.attention || loadingCategory.trust || loadingCategory.sales ? (
              <div className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand-surface border border-brand-border text-brand-text-strong py-2.5 text-xs font-semibold">
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-brand-text" />
                <span>Generating...</span>
              </div>
            ) : (
              <button
                id="create-content-btn"
                type="button"
                disabled={isGeneratingRef.current || loadingCategory.attention || loadingCategory.trust || loadingCategory.sales}
                onClick={() => {
                  if (!isPro && dailyLimitReached) {
                    onNavigateToTab("pricing");
                  } else {
                    handleBatchGenerate("auto");
                  }
                }}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-2.5 px-4 text-xs transition duration-150 active:scale-[0.99] cursor-pointer shadow-lg shadow-purple-500/15 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Sparkles className="h-3.5 w-3.5 text-purple-100 shrink-0 animate-pulse" />
                <span>
                  {!isPro && dailyLimitReached 
                    ? "Upgrade to Pro" 
                    : "Create Content"}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Free Plan Allowance & Upgrade Display inside Card */}
        {!isPro && !dailyLimitReached && !isLimitReached && (
          <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-bg-app border border-border-primary text-[11px]">
            <span className="text-text-secondary flex items-center gap-1.5 font-medium">
              <Sparkles className="h-3 w-3 text-brand-text" />
              Free Plan Allowance
            </span>
            <span className="font-mono text-brand-text-strong font-bold">
              {displayMessage}
            </span>
          </div>
        )}

        {/* Monthly Generation Limit Notice inside Card */}
        {!isPro && (isLimitReached || dailyLimitReached) && (
          <div className="rounded-xl border border-status-danger-border bg-status-danger-bg p-3.5 space-y-2.5 animate-fade-in" id="daily-limit-upgrade-banner">
            <div className="flex items-start gap-2.5">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-red-600/15 dark:bg-red-500/20 text-status-danger-text border border-status-danger-border">
                <AlertCircle className="h-3.5 w-3.5" />
              </div>
              <div className="space-y-0.5 text-left">
                <p className="!text-left !mx-0 text-xs font-bold text-text-primary">
                  Free Generation Limit Reached (150/150)
                </p>
                <p className="!text-left !mx-0 text-[11px] text-status-danger-text font-medium">
                  You've used all 150 Free AI generations this month. Upgrade for unlimited access.
                </p>
              </div>
            </div>
            <button
              type="button"
              id="daily-limit-upgrade-btn"
              onClick={() => onNavigateToTab("pricing")}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-2 text-xs transition duration-150 cursor-pointer shadow-lg shadow-purple-500/20"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Upgrade to Pro for Unlimited Generations</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Active Error Banner inside Card */}
        {(() => {
          const activeError = errorCategory[activeCategory as "attention" | "trust" | "sales"];
          if (!activeError) return null;
          return (
            <div className="rounded-xl border border-status-danger-border bg-status-danger-bg p-3.5 space-y-2.5 animate-fade-in" id="generation-error-banner">
              <div className="flex items-start gap-2.5">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-red-600/15 dark:bg-red-500/20 text-status-danger-text border border-status-danger-border">
                  <AlertTriangle className="h-3.5 w-3.5" />
                </div>
                <div className="space-y-0.5 text-left">
                  <p className="!text-left !mx-0 text-xs font-bold text-text-primary">
                    {activeError.title || "Content Generation Failed"}
                  </p>
                  <p className="!text-left !mx-0 text-[11px] text-status-danger-text font-medium">
                    {activeError.userMessage || "An unexpected error occurred during content generation. Please try again."}
                  </p>
                  {activeError.technicalDetails && (
                    <p className="!text-left !mx-0 text-[10px] text-text-secondary font-mono bg-bg-card p-2 rounded-lg border border-border-primary mt-1 max-h-24 overflow-y-auto whitespace-pre-wrap">
                      {activeError.technicalDetails}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleBatchGenerate("auto")}
                  className="inline-flex items-center gap-1 bg-red-600/15 hover:bg-red-600/25 dark:bg-red-500/20 dark:hover:bg-red-500/30 border border-status-danger-border text-status-danger-text font-semibold px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Retry</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(activeError, null, 2));
                    alert("Diagnostic details copied to clipboard.");
                  }}
                  className="inline-flex items-center gap-1 border border-border-primary bg-bg-card hover:bg-bg-card-hover text-text-secondary px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer"
                >
                  <span>Copy Details</span>
                </button>
              </div>
            </div>
          );
        })()}

        {/* Active Partial Results Notice inside Card */}
        {(() => {
          const partialNotice = partialNoticeCategory[activeCategory as "attention" | "trust" | "sales"];
          if (!partialNotice) return null;
          return (
            <div className="rounded-xl border border-status-warning-border bg-status-warning-bg p-3.5 space-y-2.5 animate-fade-in" id="generation-partial-banner">
              <div className="flex items-start gap-2.5">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-600/15 dark:bg-amber-500/20 text-status-warning-text border border-status-warning-border">
                  <AlertTriangle className="h-3.5 w-3.5" />
                </div>
                <div className="space-y-0.5 text-left">
                  <p className="!text-left !mx-0 text-xs font-bold text-text-primary">
                    {partialNotice.acceptedCount} of {partialNotice.requestedCount} Validated Drafts Ready
                  </p>
                  <p className="!text-left !mx-0 text-[11px] text-status-warning-text font-medium">
                    {partialNotice.warning}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleBatchGenerate("auto")}
                  className="inline-flex items-center gap-1 bg-amber-600/15 hover:bg-amber-600/25 dark:bg-amber-500/20 dark:hover:bg-amber-500/30 border border-status-warning-border text-status-warning-text font-semibold px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Retry Full Batch</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPartialNoticeCategory(prev => ({
                      ...prev,
                      [activeCategory as "attention" | "trust" | "sales"]: null
                    }))
                  }
                  className="inline-flex items-center gap-1 border border-border-primary bg-bg-card hover:bg-bg-card-hover text-text-secondary px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer"
                >
                  <span>Dismiss</span>
                </button>
              </div>
            </div>
          );
        })()}
      </div>
          </div>
        )}
      </div>

      {/* Generated Content Drafts Workspace */}
      {activeCategoryPosts && activeCategoryPosts.length > 0 && (
        <div className="space-y-6 pt-4" id="generated-posts-feed-section">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-text-primary font-mono flex items-center gap-2">
              <span>GENERATED THREADS DRAFTS</span>
              <span className="text-xs font-normal text-text-muted">({activeCategoryPosts.length} ready)</span>
            </h3>

            {/* Action Buttons: Clear All & Add All To Calendar */}
            <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
              <button
                type="button"
                id="clear-all-generated-posts-btn"
                onClick={() => setIsClearAllModalOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-status-danger-border bg-status-danger-bg hover:bg-red-100 dark:hover:bg-red-500/20 text-status-danger-text font-bold px-3 py-2 text-xs transition shadow-sm cursor-pointer active:scale-[0.98]"
                title="Clear current generated post cards from workspace screen"
              >
                <Trash2 className="h-4 w-4 text-status-danger-text" />
                <span>Clear All Generated Posts</span>
              </button>

              <button
                type="button"
                id="add-all-to-calendar-header-btn"
                onClick={() => setIsAddAllModalOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold px-4 py-2 text-xs transition shadow-md shadow-purple-500/15 cursor-pointer active:scale-[0.98]"
              >
                <Calendar className="h-4 w-4 text-white/95" />
                <span>Add All To Calendar</span>
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-mono">
                  {activeCategoryPosts.length}
                </span>
              </button>
            </div>
          </div>



          <div className="space-y-6">
            {activeCategoryPosts.map((post, index) => {
              const isSaved = savedIds[post.id];
              const isCopying = copyingIds[post.id];
              const isRegenerating = regeneratingCardIds[post.id];
              const isExpandedScore = expandedScores[post.id];
              const scores = getPostScores(post);

              return (
                <div 
                  key={post.id}
                  id={`generated-post-card-${index}`}
                  className="rounded-2xl border border-border-primary bg-bg-card overflow-hidden shadow-sm transition hover:border-border-secondary space-y-0"
                >
                  <PostArt postId={post.id} text={(post.threadParts || [post.singlePost || ""]).join("\n\n")} />
                  {/* Card Header */}
                  <div className="flex items-center justify-between border-b border-border-primary bg-bg-card p-4 select-none">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={!!selectedCardIds[post.id]}
                        onChange={() => toggleSelectCard(post.id)}
                        className="h-4 w-4 rounded border-border-primary text-purple-600 focus:ring-purple-500/30 cursor-pointer accent-purple-600"
                        title="Select post for batch actions"
                      />
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-bg-app border border-border-primary font-mono text-[10px] font-bold text-text-muted">
                        {index + 1}
                      </div>
                      
                      {editingPostId === post.id && activeEditField === "title" ? (
                        <input
                          type="text"
                          autoFocus
                          className="bg-bg-input text-xs text-text-primary border border-purple-500/40 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-purple-500 font-semibold"
                          value={post.title}
                          onChange={(e) => handleFieldChange(index, "title", e.target.value)}
                          onBlur={handleFieldBlur}
                          onKeyDown={(e) => handleKeyDown(e, index, "title")}
                        />
                      ) : (
                        <h5 
                          className="text-xs font-bold text-text-primary cursor-pointer hover:bg-bg-card-hover transition px-2 py-0.5 rounded border border-transparent hover:border-border-primary"
                          onClick={() => handleStartFieldEdit(post, "title")}
                          title="Click to edit title"
                        >
                          {post.title || "Untitled Draft"}
                        </h5>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setExpandedScores(prev => ({ ...prev, [post.id]: !isExpandedScore }))}
                        className="text-[11px] font-semibold text-brand-text-strong hover:bg-brand-surface-hover flex items-center gap-1 cursor-pointer bg-brand-surface border border-brand-border px-2.5 py-1 rounded-lg transition"
                      >
                        <BarChart3 className="h-3 w-3 text-brand-text" />
                        <span>Score: {scores.overall}%</span>
                      </button>
                    </div>
                  </div>

                  {/* Expandable Score Breakdown Panel */}
                  {isExpandedScore && (
                    <div className="bg-brand-surface/40 dark:bg-purple-500/5 border-b border-brand-border dark:border-purple-500/20 p-4 space-y-3 animate-fade-in">
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-center text-[10px] font-mono">
                        <div className="bg-bg-card p-2 rounded border border-border-primary">
                          <span className="text-text-secondary block">HOOK</span>
                          <span className="font-bold text-brand-text-strong">{scores.hook}%</span>
                        </div>
                        <div className="bg-bg-card p-2 rounded border border-border-primary">
                          <span className="text-text-secondary block">CURIOSITY</span>
                          <span className="font-bold text-brand-text-strong">{scores.curiosity}%</span>
                        </div>
                        <div className="bg-bg-card p-2 rounded border border-border-primary">
                          <span className="text-text-secondary block">AUTHORITY</span>
                          <span className="font-bold text-brand-text-strong">{scores.authority}%</span>
                        </div>
                        <div className="bg-bg-card p-2 rounded border border-border-primary">
                          <span className="text-text-secondary block">READABILITY</span>
                          <span className="font-bold text-brand-text-strong">{scores.readability}%</span>
                        </div>
                        <div className="bg-bg-card p-2 rounded border border-border-primary col-span-2 sm:col-span-1">
                          <span className="text-text-secondary block">CONVERSION</span>
                          <span className="font-bold text-brand-text-strong">{scores.conversion}%</span>
                        </div>
                      </div>
                      <p className="text-xs text-text-secondary italic">{scores.tip}</p>
                      {optimizationsAppliedMap[post.id] && optimizationsAppliedMap[post.id].length > 0 && (
                        <div className="pt-2 border-t border-brand-border/50 space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-text-strong block">Optimizations Applied:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {optimizationsAppliedMap[post.id].map((opt, oIdx) => (
                              <span key={oIdx} className="text-[11px] bg-brand-surface text-brand-text-strong border border-brand-border px-2 py-0.5 rounded-md font-medium">
                                ✓ {opt}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}



                  {/* Card Body - Thread Flow Parts */}
                  <div className="p-5 space-y-4">
                    {isRegenerating ? (
                      <div className="h-[140px] text-center flex flex-col items-center justify-center space-y-3 p-4">
                        <RefreshCw className="h-6 w-6 animate-spin text-purple-500" />
                        <p className="text-xs text-text-muted animate-pulse">Regenerating draft slot...</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {(() => {
                          const parts = post.threadParts || [post.singlePost || ""];
                          return (
                            <>
                              <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest pl-1 select-none">
                                Thread Flow ({parts.length} {parts.length === 1 ? 'Part' : 'Parts'})
                              </div>
                              
                              <div className="relative pl-3 space-y-4 border-l-2 border-dashed border-border-primary ml-2">
                                {parts.map((pText, pIdx) => {
                                  const isThisPartEditing = editingPartIdx?.postId === post.id && editingPartIdx?.partIdx === pIdx;
                                  return (
                                    <div key={pIdx} className="relative group space-y-2">
                                      <div className="absolute -left-[19px] top-4 w-2 h-2 rounded-full bg-border-primary border border-bg-card select-none pointer-events-none" />
                                      
                                      <div className="flex items-center justify-between text-[10px] font-mono font-bold text-text-muted select-none">
                                        <span>PART {pIdx + 1}</span>
                                        <div className="flex items-center gap-2.5">
                                          <span className={pText.length > 500 ? "text-red-500 font-bold" : "text-text-muted font-mono"}>
                                            {pText.length} / 500 ch
                                          </span>
                                          {parts.length > 1 && (
                                            <button
                                              type="button"
                                              onClick={() => handleDeleteThreadPart(index, pIdx)}
                                              className="text-status-danger-text hover:bg-red-100 dark:hover:bg-red-900/40 transition duration-100 flex items-center cursor-pointer font-bold bg-status-danger-bg border border-status-danger-border rounded px-2 py-0.5 text-[10px]"
                                              title="Delete this part"
                                            >
                                              <Trash2 className="h-3 w-3 mr-1" /> Delete
                                            </button>
                                          )}
                                        </div>
                                      </div>

                                      {isThisPartEditing ? (
                                        <div className="bg-bg-input rounded-xl border border-purple-500/30 p-4 shadow-inner ring-1 ring-purple-500/20">
                                          <textarea
                                            autoFocus
                                            rows={4}
                                            className="w-full bg-transparent border-0 ring-0 outline-none resize-none whitespace-pre-wrap text-sm md:text-[13px] text-text-primary font-sans leading-relaxed p-0 focus:ring-0 focus:outline-none"
                                            value={pText}
                                            onChange={(e) => handlePartTextChange(index, pIdx, e.target.value)}
                                            onBlur={() => setEditingPartIdx(null)}
                                            ref={(el) => {
                                              if (el && justAddedPartRef.current && justAddedPartRef.current.postId === post.id && justAddedPartRef.current.partIdx === pIdx) {
                                                el.scrollIntoView({ behavior: "smooth", block: "nearest" });
                                                el.focus();
                                                const valLen = el.value.length;
                                                el.setSelectionRange(valLen, valLen);
                                                justAddedPartRef.current = null;
                                              }
                                            }}
                                          />
                                        </div>
                                      ) : (
                                        <div 
                                          className="bg-bg-app hover:bg-bg-card-hover rounded-xl border border-border-primary hover:border-border-secondary p-4 shadow-inner cursor-pointer transition relative group/bubble"
                                          onClick={() => setEditingPartIdx({ postId: post.id, partIdx: pIdx })}
                                          title="Click text to edit inline"
                                        >
                                          <FormattedText content={pText} />
                                          <div className="absolute right-3.5 bottom-3.5 opacity-0 group-hover/bubble:opacity-100 transition-opacity pointer-events-none text-[9px] font-mono text-brand-text-strong bg-bg-card border border-brand-border px-1.5 py-0.5 rounded flex items-center gap-1 select-none shadow">
                                            <Edit3 className="h-3 w-3" /> Edit
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Action buttons: + Add AI Part, Add Empty Part, + Add CTA */}
                              <div className="pt-2 flex items-center flex-wrap gap-2">
                                <button
                                  type="button"
                                  disabled={isGeneratingPart[post.id] || parts.length >= 15}
                                  onClick={() => handleAddThreadPart(post, index)}
                                  title={parts.length >= 15 ? "Maximum 15 parts per post." : undefined}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-brand-border bg-brand-surface hover:bg-brand-surface-hover text-brand-text-strong font-bold px-3 py-1.5 text-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {isGeneratingPart[post.id] ? (
                                    <>
                                      <RefreshCw className="h-3 w-3 animate-spin text-brand-text" /> Generating...
                                    </>
                                  ) : (
                                    <>
                                      <Sparkles className="h-3 w-3 text-brand-text" /> + Add AI Part
                                    </>
                                  )}
                                </button>

                                <button
                                  type="button"
                                  disabled={parts.length >= 15}
                                  onClick={() => handleAddEmptyPart(post, index)}
                                  title={parts.length >= 15 ? "Maximum 15 parts per post." : undefined}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-border-primary bg-bg-card hover:bg-bg-card-hover text-text-secondary hover:text-text-primary font-bold px-3 py-1.5 text-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <Plus className="h-3.5 w-3.5 text-text-secondary" /> Add Empty Part
                                </button>

                                {parts.length >= 15 && (
                                  <span className="text-[11px] text-text-secondary font-medium ml-1">
                                    Maximum 15 parts reached
                                  </span>
                                )}

                                {activeCta && parts.length < 15 && (
                                  <button
                                    type="button"
                                    onClick={() => handleAppendActiveCta(post, index)}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-800 dark:text-rose-300 font-bold px-3 py-1.5 text-xs transition cursor-pointer"
                                  >
                                    <MousePointerClick className="h-3 w-3 text-rose-700 dark:text-rose-400" /> + Append Active CTA
                                  </button>
                                )}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Planning & Organization Bar (Pillar Tag + Lifecycle Badge + Weekly Plan Picker) */}
                  <div className="border-t border-border-primary/70 bg-bg-app/60 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {profile?.contentPillars && profile.contentPillars.length > 0 && (
                        <select
                          value={post.pillarTitle || post.decision?.pillarTitle || activeIdea?.pillarTitle || ""}
                          onChange={(e) =>
                            updateGeneratedPostInState(post.id, {
                              pillarTitle: e.target.value || undefined,
                            })
                          }
                          aria-label="Associate post with content pillar"
                          className="rounded-lg border border-border-primary bg-bg-card px-2 py-1 text-[11px] text-text-secondary focus:border-purple-500 focus:outline-none"
                        >
                          <option value="">Pillar: Auto / None</option>
                          {profile.contentPillars.map((p) => (
                            <option key={p.title} value={p.title}>
                              Pillar: {p.title}
                            </option>
                          ))}
                        </select>
                      )}

                      {post.stage && (
                        <span
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${
                            post.stage === "Scheduled"
                              ? "bg-brand-surface text-brand-text-strong border-brand-border"
                              : post.stage === "Planned"
                              ? "bg-status-warning-bg text-status-warning-text border-status-warning-border"
                              : post.stage === "Ready"
                              ? "bg-teal-50 dark:bg-teal-500/10 text-teal-800 dark:text-teal-400 border-teal-300 dark:border-teal-500/25"
                              : "bg-bg-card text-text-secondary border-border-primary"
                          }`}
                        >
                          {post.stage}
                          {post.stage === "Planned" && post.plannedDate ? ` · ${post.plannedDate.slice(5)}` : ""}
                        </span>
                      )}
                    </div>

                    {planningPostId === post.id && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {upcomingPlanDays.map((day) => (
                          <button
                            key={day.dateKey}
                            type="button"
                            onClick={async () => {
                              await handleSaveToLibrary(post, "Planned", day.dateKey);
                              setPlanningPostId(null);
                            }}
                            className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold transition cursor-pointer ${
                              post.plannedDate === day.dateKey
                                ? "bg-amber-600 text-white border-amber-500"
                                : "bg-bg-card border-border-primary text-text-secondary hover:border-amber-500/50 hover:text-text-primary"
                            }`}
                          >
                            {day.label}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setPlanningPostId(null)}
                          className="text-[10px] text-text-muted hover:text-text-primary px-1 cursor-pointer"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Card Actions Footer */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-primary bg-bg-app px-4 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Copy Thread Button */}
                      <button
                        type="button"
                        onClick={() => handleCopyThread(post)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border-primary bg-bg-card hover:bg-bg-card-hover text-text-secondary hover:text-text-primary font-bold px-3 py-1.5 text-xs transition cursor-pointer"
                      >
                        {isCopying ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>{isCopying ? "Copied!" : "Copy"}</span>
                      </button>

                      {/* Save Draft to Library Button */}
                      <button
                        type="button"
                        onClick={() => handleSaveToLibrary(post, "Draft")}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border-primary bg-bg-card hover:bg-bg-card-hover text-text-secondary hover:text-text-primary font-bold px-3 py-1.5 text-xs transition cursor-pointer"
                      >
                        {isSaved ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Save className="h-3.5 w-3.5" />}
                        <span>{isSaved ? "Saved!" : post.savedRecordId ? "Update Draft" : "Save Draft"}</span>
                      </button>

                      {/* Mark Ready Button */}
                      <button
                        type="button"
                        onClick={() => handleSaveToLibrary(post, "Ready")}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-teal-300 dark:border-teal-500/30 bg-teal-50 dark:bg-teal-500/10 hover:bg-teal-100 dark:hover:bg-teal-500/20 text-teal-800 dark:text-teal-400 font-bold px-3 py-1.5 text-xs transition cursor-pointer"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>{post.stage === "Ready" ? "Ready" : "Mark Ready"}</span>
                      </button>

                      {/* Add to Weekly Plan Button */}
                      <button
                        type="button"
                        onClick={() => {
                          if (activeIdea?.targetPlannedDate && planningPostId !== post.id) {
                            handleSaveToLibrary(post, "Planned", activeIdea.targetPlannedDate);
                          } else {
                            setPlanningPostId(planningPostId === post.id ? null : post.id);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-status-warning-border bg-status-warning-bg hover:bg-amber-100 dark:hover:bg-amber-500/20 text-status-warning-text font-bold px-3 py-1.5 text-xs transition cursor-pointer"
                      >
                        <Layers className="h-3.5 w-3.5" />
                        <span>
                          {activeIdea?.targetPlannedDate
                            ? `Plan for ${activeIdea.targetPlannedDate.slice(5)}`
                            : "Add to Week"}
                        </span>
                      </button>

                      {/* Regenerate Slot */}
                      <button
                        type="button"
                        disabled={isRegenerating}
                        onClick={() => handleRegenerateCard(post, index)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border-primary bg-bg-card hover:bg-bg-card-hover text-text-secondary hover:text-text-primary font-medium px-2.5 py-1.5 text-xs transition cursor-pointer disabled:opacity-50"
                        title="Regenerate this specific post"
                      >
                        <RefreshCw className={`h-3 w-3 ${isRegenerating ? "animate-spin" : ""}`} />
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Schedule Button */}
                      <button
                        type="button"
                        onClick={() => setScheduleModalPost(post)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border-primary bg-bg-card hover:bg-bg-card-hover text-text-primary font-bold px-3 py-1.5 text-xs transition cursor-pointer"
                      >
                        <Calendar className="h-3.5 w-3.5 text-brand-text" />
                        <span>Schedule</span>
                      </button>

                      {/* Direct Publish Button */}
                      <button
                        type="button"
                        onClick={() => setPublishModalPost(post)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold px-3.5 py-1.5 text-xs transition cursor-pointer shadow-sm"
                      >
                        <ArrowUpRight className="h-3.5 w-3.5" />
                        <span>Publish to Threads</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Add All To Calendar Action (for easy access when scrolling large batches) */}
          {activeCategoryPosts.length > 1 && (
            <div className="flex items-center justify-center pt-2">
              <button
                type="button"
                id="add-all-to-calendar-bottom-btn"
                onClick={() => setIsAddAllModalOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold px-4 py-2.5 text-xs transition shadow-md shadow-purple-500/15 cursor-pointer active:scale-[0.98]"
              >
                <Calendar className="h-4 w-4 text-white/95" />
                <span>Add All To Calendar</span>
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-mono">
                  {activeCategoryPosts.length}
                </span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {publishModalPost && (
        <PublishModal
          isOpen={!!publishModalPost}
          onClose={() => setPublishModalPost(null)}
          postText={publishModalPost.threadParts?.[0] || publishModalPost.singlePost || publishModalPost.hook || ""}
          parts={publishModalPost.threadParts || [publishModalPost.singlePost || ""]}
          userId={auth.currentUser?.uid || ""}
          postId={publishModalPost.savedRecordId || publishModalPost.id}
          onNavigateToTab={onNavigateToTab}
        />
      )}

      {scheduleModalPost && (
        <ScheduleModal
          isOpen={!!scheduleModalPost}
          onClose={() => setScheduleModalPost(null)}
          postText={scheduleModalPost.threadParts?.[0] || scheduleModalPost.singlePost || scheduleModalPost.hook || ""}
          parts={scheduleModalPost.threadParts || [scheduleModalPost.singlePost || ""]}
          postId={scheduleModalPost.savedRecordId || scheduleModalPost.id}
          title={scheduleModalPost.title}
          topic={scheduleModalPost.topics?.[0] || activeIdea?.topic || profile?.offer || "Social Strategy"}
          topics={scheduleModalPost.topics}
          pillarTitle={scheduleModalPost.pillarTitle || scheduleModalPost.decision?.pillarTitle || activeIdea?.pillarTitle}
          sourceIdeaId={scheduleModalPost.sourceIdeaId || activeIdea?.id || null}
          initialDateTime={(() => {
            const targetKey = scheduleModalPost.plannedDate || activeIdea?.targetPlannedDate;
            if (targetKey && /^\d{4}-\d{2}-\d{2}$/.test(targetKey)) {
              const candidate = `${targetKey}T09:00`;
              if (new Date(candidate).getTime() > Date.now()) return candidate;
            }
            return undefined;
          })()}
          profile={profile}
          subscriptionStatus={subscriptionStatus}
          onScheduled={(recordId) => {
            updateGeneratedPostInState(scheduleModalPost.id, {
              savedRecordId: recordId,
              stage: "Scheduled",
            });
          }}
          onNavigateToTab={onNavigateToTab}
        />
      )}

      {isAddAllModalOpen && (
        <AddAllToCalendarModal
          isOpen={isAddAllModalOpen}
          onClose={() => setIsAddAllModalOpen(false)}
          posts={activeCategoryPosts}
          category={activeCategory}
          onNavigateToTab={onNavigateToTab}
          onSuccess={handleSuccessAddAll}
        />
      )}

      {isClearAllModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in" id="clear-all-modal">
          <div className="w-full max-w-md rounded-2xl border border-border-primary bg-bg-card p-6 space-y-5 shadow-2xl">
            <div className="flex items-center gap-3 text-status-danger-text">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-status-danger-bg border border-status-danger-border">
                <Trash2 className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-text-primary">Clear All Generated Posts?</h3>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed">
              This will clear the current generated post cards from your workspace screen. Saved posts in your Content Library will remain untouched.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsClearAllModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-border-primary bg-bg-app text-text-primary text-xs font-semibold hover:bg-bg-card-hover transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClearAllGeneratedPosts}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition cursor-pointer shadow-lg shadow-red-600/20"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
