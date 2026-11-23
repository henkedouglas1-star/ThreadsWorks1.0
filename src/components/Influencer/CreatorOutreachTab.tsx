import React, { useState, useEffect, useMemo } from "react";
import {
  SavedInfluencer,
  CreatorProfileData,
  CreatorOutreachBatch,
  CreatorOutreachItem,
  CreatorOutreachTargetPost,
  CreatorOutreachItemStatus,
} from "../../types/influencer";
import {
  retrieveOutreachPostsApi,
  generateOutreachCommentsApi,
  publishOutreachBatchApi,
  saveOutreachBatchApi,
  stopOutreachQueueApi,
  getOutreachBatchesApi,
  retryOutreachItemApi,
  buildThreadsProfileUrl,
  getVerifiedDirectoryApi,
  seedFeaturedCreatorsApi,
  quickAddCreatorApi,
} from "../../utils/influencerApi";
import { useThreadsConnection } from "../../context/ThreadsConnectionContext";
import {
  Users,
  Search,
  Sparkles,
  Send,
  StopCircle,
  RefreshCw,
  Clock,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Filter,
  ArrowRight,
  History,
  MessageSquare,
  Layers,
  ShieldAlert,
  Edit3,
  Sliders,
  CheckSquare,
  Square,
  ChevronDown,
  Info,
  UserPlus,
  Plus,
  Bookmark,
} from "lucide-react";

interface CreatorOutreachTabProps {
  userId: string;
  userContext?: any;
  savedInfluencers: SavedInfluencer[];
  initialSelectedCreators?: CreatorProfileData[];
  onOpenConnectThreads?: () => void;
  onRefreshSaved?: () => void;
}

export default function CreatorOutreachTab({
  userId,
  userContext,
  savedInfluencers,
  initialSelectedCreators,
  onOpenConnectThreads,
  onRefreshSaved,
}: CreatorOutreachTabProps) {
  // Main view mode: "workflow" | "history"
  const [viewMode, setViewMode] = useState<"workflow" | "history">("workflow");

  // Step state: 1: Select -> 2: Review Posts & Generate -> 3: Review Queue & Publish
  const [workflowStep, setWorkflowStep] = useState<1 | 2 | 3>(1);

  // Selection state
  const [selectedCreatorIds, setSelectedCreatorIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [cooldownDays, setCooldownDays] = useState<number>(7);
  const [commentDirection, setCommentDirection] = useState("");

  // Directory and Multi-Source Discovery state
  const [directoryCreators, setDirectoryCreators] = useState<CreatorProfileData[]>([]);
  const [isLoadingDirectory, setIsLoadingDirectory] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<"all" | "saved" | "directory">("all");

  // Quick Add & Seed state
  const [isSeeding, setIsSeeding] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddHandle, setQuickAddHandle] = useState("");
  const [isQuickAdding, setIsQuickAdding] = useState(false);
  const [quickAddError, setQuickAddError] = useState<string | null>(null);

  // Single Item Publishing State
  const [publishingItemId, setPublishingItemId] = useState<string | null>(null);

  // Batch & Processing state
  const [activeBatch, setActiveBatch] = useState<CreatorOutreachBatch | null>(null);
  const [isRetrievingPosts, setIsRetrievingPosts] = useState(false);
  const [isGeneratingComments, setIsGeneratingComments] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isStoppingQueue, setIsStoppingQueue] = useState(false);
  const [historyBatches, setHistoryBatches] = useState<CreatorOutreachBatch[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [retryingItemId, setRetryingItemId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Threads connection capability state from context
  const { 
    connected: threadsConnected, 
    username: threadsUsername, 
    hasPublishPermission,
    loading: isThreadsLoading,
    connectThreads
  } = useThreadsConnection();

  const threadsConnection = {
    connected: threadsConnected,
    threadsUsername: threadsUsername,
    hasPublishPermission: Boolean(hasPublishPermission),
    isLoading: isThreadsLoading,
  };

  const handleConnectThreads = () => {
    if (onOpenConnectThreads) {
      onOpenConnectThreads();
    } else {
      connectThreads();
    }
  };

  // Load verified directory on mount for immediate search & selection
  useEffect(() => {
    let mounted = true;
    const loadDir = async () => {
      setIsLoadingDirectory(true);
      try {
        const res = await getVerifiedDirectoryApi();
        if (mounted && res.success && res.creators) {
          setDirectoryCreators(res.creators);
        }
      } catch (err) {
        console.warn("[CreatorOutreachTab] Directory load error:", err);
      } finally {
        if (mounted) setIsLoadingDirectory(false);
      }
    };
    loadDir();
    return () => {
      mounted = false;
    };
  }, []);

  // Pre-populate if initialSelectedCreators passed
  useEffect(() => {
    if (initialSelectedCreators && initialSelectedCreators.length > 0) {
      const initialIds = new Set(initialSelectedCreators.map((c) => c.id || c.username));
      setSelectedCreatorIds(initialIds);
    }
  }, [initialSelectedCreators]);

  // Load history batches
  const fetchHistory = async () => {
    if (!userId) return;
    setIsLoadingHistory(true);
    try {
      const res = await getOutreachBatchesApi(userId);
      if (res.success && res.batches) {
        setHistoryBatches(res.batches);
      }
    } catch (err) {
      console.warn("[CreatorOutreachTab] Failed fetching history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (viewMode === "history") {
      fetchHistory();
    }
  }, [viewMode, userId]);

  // All available creators (combining saved database + verified directory)
  const availableCreators: Array<CreatorProfileData & { isSaved?: boolean }> = useMemo(() => {
    const seen = new Set<string>();
    const list: Array<CreatorProfileData & { isSaved?: boolean }> = [];

    // 1. Saved creators from Firestore
    const savedList = savedInfluencers.map((s) => s.creator).filter(Boolean);
    for (const c of savedList) {
      const handle = (c.threadsUsername || c.username || "").toLowerCase();
      if (handle && !seen.has(handle)) {
        seen.add(handle);
        list.push({ ...c, isSaved: true });
      }
    }

    // 2. Verified Directory Creators
    for (const c of directoryCreators) {
      const handle = (c.threadsUsername || c.username || "").toLowerCase();
      if (handle && !seen.has(handle)) {
        seen.add(handle);
        list.push({ ...c, isSaved: false });
      }
    }

    return list;
  }, [savedInfluencers, directoryCreators]);

  // Filtered and ranked creators for Step 1 with 5-tier normalized priority matching
  const filteredCreators = useMemo(() => {
    let list = availableCreators;
    if (sourceFilter === "saved") {
      list = list.filter((c) => c.isSaved);
    } else if (sourceFilter === "directory") {
      list = list.filter((c) => !c.isSaved);
    }

    const trimmed = searchQuery.trim();
    if (!trimmed) return list;

    // Normalization: trim, remove leading @, lowercase
    const q = trimmed.toLowerCase().replace(/^@/, "");

    const scored: Array<{ creator: (typeof availableCreators)[0]; score: number }> = [];

    for (const c of list) {
      const u = (c.threadsUsername || c.username || "").toLowerCase().replace(/^@/, "");
      const n = (c.name || "").toLowerCase();
      const niche = (c.niche || "").toLowerCase();
      const bio = (c.bio || "").toLowerCase();

      let score = 0;
      if (u === q) {
        score = 100; // Tier 1: Exact username match (e.g. "lexfridman", "@lexfridman")
      } else if (n === q || n === trimmed.toLowerCase()) {
        score = 90; // Tier 2: Exact display-name match (e.g. "Lex Fridman")
      } else if (u.startsWith(q)) {
        score = 80; // Tier 3: Username prefix match
      } else if (n.includes(q)) {
        score = 70; // Tier 4: Display-name partial match
      } else if (
        u.includes(q) ||
        niche.includes(q) ||
        bio.includes(q) ||
        c.topics?.some((t) => t.toLowerCase().includes(q))
      ) {
        score = 50; // Tier 5: Other relevant match
      }

      if (score > 0) {
        scored.push({ creator: c, score });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.creator);
  }, [availableCreators, sourceFilter, searchQuery]);

  // Quick Add handler
  const handleQuickAdd = async (handleToUse = quickAddHandle) => {
    const clean = handleToUse.trim().replace(/^@/, "");
    if (!clean) return;
    setIsQuickAdding(true);
    setQuickAddError(null);
    try {
      const res = await quickAddCreatorApi(userId, clean, userContext);
      if (res.success && res.creator) {
        setQuickAddHandle("");
        setShowQuickAdd(false);
        if (onRefreshSaved) onRefreshSaved();
        const newId = res.creator.id || res.creator.threadsUsername || clean;
        setSelectedCreatorIds((prev) => new Set(prev).add(newId));
        setSearchQuery("");
      } else {
        setQuickAddError(res.error || `Could not find creator @${clean}`);
      }
    } catch (err: any) {
      setQuickAddError(err.message || "Failed to add creator");
    } finally {
      setIsQuickAdding(false);
    }
  };

  // 1-Click Import Featured Creators
  const handleSeedFeatured = async () => {
    setIsSeeding(true);
    setErrorMessage(null);
    try {
      const res = await seedFeaturedCreatorsApi(userId);
      if (res.success) {
        if (onRefreshSaved) onRefreshSaved();
        if (res.influencers) {
          const next = new Set(selectedCreatorIds);
          res.influencers.forEach((inf) => {
            const h = inf.creator.threadsUsername || inf.creator.username;
            if (h) next.add(h);
          });
          setSelectedCreatorIds(next);
        }
      } else {
        setErrorMessage(res.error || "Failed to import featured creators.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Network error seeding creators.");
    } finally {
      setIsSeeding(false);
    }
  };

  // Checkbox handlers
  const handleToggleSelectOne = (id: string) => {
    const next = new Set(selectedCreatorIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedCreatorIds(next);
  };

  const isAllFilteredSelected =
    filteredCreators.length > 0 &&
    filteredCreators.every((c) => selectedCreatorIds.has(c.id || c.username));

  const handleToggleSelectAll = () => {
    const next = new Set(selectedCreatorIds);
    if (isAllFilteredSelected) {
      filteredCreators.forEach((c) => next.delete(c.id || c.username));
    } else {
      filteredCreators.forEach((c) => next.add(c.id || c.username));
    }
    setSelectedCreatorIds(next);
  };

  // Step 1 -> 2: Retrieve Recent Posts
  const handleFindRecentPosts = async () => {
    if (selectedCreatorIds.size === 0) return;
    setErrorMessage(null);
    setIsRetrievingPosts(true);

    try {
      const idsArray = Array.from(selectedCreatorIds);
      const res = await retrieveOutreachPostsApi(userId, idsArray, cooldownDays);
      if (res.success && res.batch) {
        setActiveBatch(res.batch);
        setWorkflowStep(2);
      } else {
        setErrorMessage(res.error || "Failed to retrieve recent posts.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Network error retrieving posts.");
    } finally {
      setIsRetrievingPosts(false);
    }
  };

  // Step 2 -> 3: Generate Comments
  const handleGenerateComments = async () => {
    if (!activeBatch) return;
    setErrorMessage(null);
    setIsGeneratingComments(true);

    try {
      const res = await generateOutreachCommentsApi(
        userId,
        activeBatch.id,
        activeBatch.items,
        commentDirection,
        userContext
      );
      if (res.success && res.batch) {
        setActiveBatch(res.batch);
        setWorkflowStep(3);
      } else {
        setErrorMessage(res.error || "Failed to generate comments.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "AI comment generation error.");
    } finally {
      setIsGeneratingComments(false);
    }
  };

  // Switch alternative post for an item
  const handleSwitchTargetPost = (itemId: string, newPost: CreatorOutreachTargetPost) => {
    if (!activeBatch) return;
    const updatedItems = activeBatch.items.map((item) => {
      if (item.id === itemId) {
        return {
          ...item,
          targetPost: newPost,
          canonicalTarget: item.canonicalTarget
            ? {
                ...item.canonicalTarget,
                targetPostId: newPost.id,
                targetPostUrl: newPost.url || item.canonicalTarget.targetPostUrl,
                targetPostText: newPost.text,
                commentText: undefined,
              }
            : undefined,
          generatedComment: undefined,
          approvedComment: undefined,
          status: newPost.eligible ? ("Draft" as CreatorOutreachItemStatus) : ("Skipped" as CreatorOutreachItemStatus),
          skipReason: newPost.skipReason,
          updatedAt: new Date().toISOString(),
        };
      }
      return item;
    });

    setActiveBatch({
      ...activeBatch,
      items: updatedItems,
      summary: recalculateSummary(updatedItems),
      updatedAt: new Date().toISOString(),
    });
  };

  // Edit comment text
  const handleEditCommentText = (itemId: string, newText: string) => {
    if (!activeBatch) return;
    const updatedItems = activeBatch.items.map((item) => {
      if (item.id === itemId) {
        return {
          ...item,
          generatedComment: newText,
          approvedComment: item.status === "Approved" ? newText : item.approvedComment,
          canonicalTarget: item.canonicalTarget
            ? {
                ...item.canonicalTarget,
                commentText: newText,
              }
            : undefined,
          characterCount: newText.length,
          updatedAt: new Date().toISOString(),
        };
      }
      return item;
    });

    const nextBatch = {
      ...activeBatch,
      items: updatedItems,
      summary: recalculateSummary(updatedItems),
      updatedAt: new Date().toISOString(),
    };
    setActiveBatch(nextBatch);
  };

  // Toggle approval on an item
  const handleToggleApproval = (itemId: string) => {
    if (!activeBatch) return;
    const updatedItems = activeBatch.items.map((item) => {
      if (item.id === itemId) {
        const isApproved = item.status === "Approved";
        const newStatus: CreatorOutreachItemStatus = isApproved ? "Ready For Review" : "Approved";
        const comment = (item.approvedComment || item.generatedComment || "").trim();
        return {
          ...item,
          status: newStatus,
          approvedComment: isApproved ? undefined : comment,
          updatedAt: new Date().toISOString(),
        };
      }
      return item;
    });

    const nextBatch = {
      ...activeBatch,
      items: updatedItems,
      summary: recalculateSummary(updatedItems),
      updatedAt: new Date().toISOString(),
    };
    setActiveBatch(nextBatch);
    saveOutreachBatchApi(nextBatch).catch((err) => {
      console.warn("[CreatorOutreachTab] Auto-save error:", err);
    });
  };

  // Bulk Approve all "Ready For Review" items
  const handleApproveAllReady = () => {
    if (!activeBatch) return;
    const updatedItems = activeBatch.items.map((item) => {
      const comment = (item.approvedComment || item.generatedComment || "").trim();
      if ((item.status === "Ready For Review" || item.status === "Draft") && comment) {
        return {
          ...item,
          status: "Approved" as CreatorOutreachItemStatus,
          approvedComment: comment,
          updatedAt: new Date().toISOString(),
        };
      }
      return item;
    });

    const nextBatch = {
      ...activeBatch,
      items: updatedItems,
      summary: recalculateSummary(updatedItems),
      updatedAt: new Date().toISOString(),
    };
    setActiveBatch(nextBatch);
    saveOutreachBatchApi(nextBatch).catch((err) => {
      console.warn("[CreatorOutreachTab] Auto-save error:", err);
    });
  };

  // Regenerate single item comment
  const handleRegenerateItem = async (itemId: string) => {
    if (!activeBatch) return;
    const targetItem = activeBatch.items.find((i) => i.id === itemId);
    if (!targetItem) return;

    // Temporarily mark as Generating
    const tempItems = activeBatch.items.map((i) =>
      i.id === itemId ? { ...i, status: "Generating" as CreatorOutreachItemStatus } : i
    );
    setActiveBatch({ ...activeBatch, items: tempItems });

    try {
      const res = await generateOutreachCommentsApi(
        userId,
        activeBatch.id,
        [targetItem],
        commentDirection,
        userContext
      );
      if (res.success && res.batch && res.batch.items[0]) {
        const updatedItem = res.batch.items[0];
        const nextItems = activeBatch.items.map((i) => (i.id === itemId ? updatedItem : i));
        setActiveBatch({
          ...activeBatch,
          items: nextItems,
          summary: recalculateSummary(nextItems),
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      console.error("[CreatorOutreachTab] Regenerate error:", err);
    }
  };

  // Publish Approved
  const handlePublishApproved = async () => {
    if (!activeBatch) return;
    if (!threadsConnection.connected || !threadsConnection.hasPublishPermission) {
      setErrorMessage("Publishing blocked: A connected Threads account with 'threads_content_publish' permission is required.");
      return;
    }

    setErrorMessage(null);
    setIsPublishing(true);

    try {
      // Prepare items: ensure all approved items have approvedComment populated.
      // If user clicked publish but hasn't toggled checkmarks, automatically approve any item with comment text!
      let itemsToSend = activeBatch.items.map((item) => {
        const comment = (item.approvedComment || item.generatedComment || "").trim();
        if (item.status === "Approved") {
          return {
            ...item,
            approvedComment: comment,
            updatedAt: new Date().toISOString(),
          };
        }
        return item;
      });

      const hasApproved = itemsToSend.some(
        (i) => i.status === "Approved" && Boolean((i.approvedComment || i.generatedComment || "").trim())
      );

      if (!hasApproved) {
        itemsToSend = itemsToSend.map((item) => {
          const comment = (item.approvedComment || item.generatedComment || "").trim();
          if (comment && item.status !== "Published" && item.status !== "Published As Reply" && item.status !== "Skipped") {
            return {
              ...item,
              status: "Approved" as CreatorOutreachItemStatus,
              approvedComment: comment,
              updatedAt: new Date().toISOString(),
            };
          }
          return item;
        });
      }

      const updatedBatch = {
        ...activeBatch,
        items: itemsToSend,
        summary: recalculateSummary(itemsToSend),
      };
      setActiveBatch(updatedBatch);

      // CRITICAL FIX: Pass updatedBatch.items to publishOutreachBatchApi so the server receives all approved items and latest edits!
      const res = await publishOutreachBatchApi(userId, activeBatch.id, undefined, itemsToSend);
      if (res.success && res.batch) {
        setActiveBatch(res.batch);
      } else {
        setErrorMessage(res.error || "Batch publish completed with warnings.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Publishing execution error.");
    } finally {
      setIsPublishing(false);
    }
  };

  // Publish a single item immediately to Meta Threads
  const handlePublishSingleItem = async (itemId: string) => {
    if (!activeBatch) return;
    if (!threadsConnection.connected || !threadsConnection.hasPublishPermission) {
      setErrorMessage("Publishing blocked: A connected Threads account with 'threads_content_publish' permission is required.");
      return;
    }

    setErrorMessage(null);
    setPublishingItemId(itemId);

    // Ensure target item is set to Approved with approvedComment
    const targetItem = activeBatch.items.find((i) => i.id === itemId);
    if (!targetItem) {
      setPublishingItemId(null);
      return;
    }

    const commentText = (targetItem.approvedComment || targetItem.generatedComment || "").trim();
    if (!commentText) {
      setErrorMessage("Cannot publish empty comment. Please type or generate a comment first.");
      setPublishingItemId(null);
      return;
    }

    const updatedItems = activeBatch.items.map((i) => {
      if (i.id === itemId) {
        return {
          ...i,
          status: "Approved" as CreatorOutreachItemStatus,
          approvedComment: commentText,
          updatedAt: new Date().toISOString(),
        };
      }
      return i;
    });

    const readyBatch = {
      ...activeBatch,
      items: updatedItems,
      summary: recalculateSummary(updatedItems),
    };
    setActiveBatch(readyBatch);

    try {
      // Pass updatedItems so server has this item's approved status and comment text!
      const res = await publishOutreachBatchApi(userId, activeBatch.id, [itemId], updatedItems);
      if (res.success && res.batch) {
        setActiveBatch(res.batch);
      } else {
        setErrorMessage(res.error || "Failed to publish reply.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to publish reply.");
    } finally {
      setPublishingItemId(null);
    }
  };

  // Stop Queue
  const handleStopQueue = async () => {
    if (!activeBatch) return;
    setIsStoppingQueue(true);
    try {
      await stopOutreachQueueApi(activeBatch.id);
      // Refresh batch after small delay
      setTimeout(async () => {
        const batches = await getOutreachBatchesApi(userId);
        if (batches.success && batches.batches) {
          const current = batches.batches.find((b) => b.id === activeBatch.id);
          if (current) setActiveBatch(current);
        }
        setIsStoppingQueue(false);
      }, 1500);
    } catch (err) {
      console.warn("[CreatorOutreachTab] Stop queue error:", err);
      setIsStoppingQueue(false);
    }
  };

  // Retry single failed item
  const handleRetryItem = async (batchId: string, itemId: string) => {
    setRetryingItemId(itemId);
    try {
      const res = await retryOutreachItemApi(userId, batchId, itemId);
      if (res.success && res.item) {
        if (activeBatch && activeBatch.id === batchId) {
          const nextItems = activeBatch.items.map((i) => (i.id === itemId ? res.item! : i));
          setActiveBatch({
            ...activeBatch,
            items: nextItems,
            summary: recalculateSummary(nextItems),
          });
        }
        fetchHistory();
      }
    } catch (err) {
      console.error("[CreatorOutreachTab] Retry item error:", err);
    } finally {
      setRetryingItemId(null);
    }
  };

  // Helper summary calculator
  function recalculateSummary(items: CreatorOutreachItem[]) {
    return {
      totalCreators: items.length,
      eligiblePosts: items.filter((i) => i.targetPost?.eligible).length,
      generatedComments: items.filter((i) => Boolean(i.generatedComment)).length,
      approvedComments: items.filter((i) => i.status === "Approved").length,
      publishedReplies: items.filter((i) => i.status === "Published" || i.status === "Published As Reply").length,
      skippedCount: items.filter((i) => i.status === "Skipped").length,
      failedCount: items.filter((i) => i.status === "Failed").length,
      awaitingConfirmationCount: items.filter((i) => i.status === "Awaiting Confirmation").length,
    };
  }

  // Summary counts
  const summary = activeBatch?.summary || {
    totalCreators: selectedCreatorIds.size,
    eligiblePosts: 0,
    generatedComments: 0,
    approvedComments: 0,
    publishedReplies: 0,
    skippedCount: 0,
    failedCount: 0,
    awaitingConfirmationCount: 0,
  };

  return (
    <div className="space-y-6">
      {/* Top Header & View Mode Switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-bg-card border border-border-primary">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold text-text-primary flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-purple-500" />
              Creator Outreach
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold border border-purple-500/20">
              Meta Threads Replies
            </span>
          </div>
          <p className="text-xs text-text-secondary mt-1">
            Target tracked creators, inspect recent posts, generate grounded comments, and publish verified replies to Threads.
          </p>
        </div>

        {/* View Switcher: Workflow vs History */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-bg-sidebar border border-border-primary text-xs font-semibold">
          <button
            onClick={() => setViewMode("workflow")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
              viewMode === "workflow"
                ? "bg-purple-600 text-white shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Outreach Workflow</span>
          </button>
          <button
            onClick={() => setViewMode("history")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
              viewMode === "history"
                ? "bg-purple-600 text-white shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Outreach History</span>
          </button>
        </div>
      </div>

      {/* Threads API Capability Banner */}
      {!threadsConnection.isLoading && (
        <div
          className={`p-3.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs ${
            threadsConnection.connected && threadsConnection.hasPublishPermission
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300"
              : "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {threadsConnection.connected && threadsConnection.hasPublishPermission ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
            )}
            <div>
              <span className="font-bold">
                {threadsConnection.connected && threadsConnection.hasPublishPermission
                  ? `Connected as @${threadsConnection.threadsUsername || "Threads User"} — Live Reply Publishing Authorized`
                  : "Threads Reply Publishing Capability Restricted"}
              </span>
              <p className="text-[11px] opacity-90 mt-0.5">
                {threadsConnection.connected && threadsConnection.hasPublishPermission
                  ? "Your account holds official 'threads_content_publish' scope to post replies to creators on Meta Threads."
                  : "Publishing requires an authenticated Threads account with 'threads_content_publish' permission."}
              </p>
            </div>
          </div>

          {(!threadsConnection.connected || !threadsConnection.hasPublishPermission) && (
            <button
              onClick={handleConnectThreads}
              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold transition text-xs shrink-0 cursor-pointer shadow-sm"
            >
              Connect Threads
            </button>
          )}
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-text-muted hover:text-text-primary text-xs font-bold px-2 py-0.5 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ============================================================ */}
      {/* WORKFLOW VIEW MODE */}
      {/* ============================================================ */}
      {viewMode === "workflow" && (
        <div className="space-y-6">
          {/* Step Progress Navigation Bar */}
          <div className="grid grid-cols-3 gap-2 p-1.5 rounded-2xl bg-bg-card border border-border-primary text-xs font-bold">
            <button
              onClick={() => setWorkflowStep(1)}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl transition cursor-pointer ${
                workflowStep === 1
                  ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
                  : "text-text-secondary hover:bg-bg-card-hover"
              }`}
            >
              <span className="w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-mono">
                1
              </span>
              <span>Select Creators</span>
            </button>

            <button
              onClick={() => activeBatch && setWorkflowStep(2)}
              disabled={!activeBatch}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl transition ${
                !activeBatch
                  ? "opacity-50 cursor-not-allowed text-text-muted"
                  : workflowStep === 2
                  ? "bg-purple-600 text-white shadow-md shadow-purple-600/20 cursor-pointer"
                  : "text-text-secondary hover:bg-bg-card-hover cursor-pointer"
              }`}
            >
              <span className="w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-mono">
                2
              </span>
              <span>Target Posts</span>
            </button>

            <button
              onClick={() => activeBatch && setWorkflowStep(3)}
              disabled={!activeBatch || summary.generatedComments === 0}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl transition ${
                !activeBatch || summary.generatedComments === 0
                  ? "opacity-50 cursor-not-allowed text-text-muted"
                  : workflowStep === 3
                  ? "bg-purple-600 text-white shadow-md shadow-purple-600/20 cursor-pointer"
                  : "text-text-secondary hover:bg-bg-card-hover cursor-pointer"
              }`}
            >
              <span className="w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-mono">
                3
              </span>
              <span>Review & Publish</span>
            </button>
          </div>

          {/* Workflow Summary Metrics Bar */}
          {activeBatch && (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2 p-3 rounded-2xl bg-bg-card border border-border-primary text-center">
              <div className="p-2 rounded-xl bg-bg-sidebar">
                <div className="text-[10px] font-mono text-text-muted uppercase">Selected</div>
                <div className="text-base font-extrabold text-text-primary">{summary.totalCreators}</div>
              </div>
              <div className="p-2 rounded-xl bg-bg-sidebar">
                <div className="text-[10px] font-mono text-text-muted uppercase">Eligible Posts</div>
                <div className="text-base font-extrabold text-blue-500">{summary.eligiblePosts}</div>
              </div>
              <div className="p-2 rounded-xl bg-bg-sidebar">
                <div className="text-[10px] font-mono text-text-muted uppercase">Generated</div>
                <div className="text-base font-extrabold text-brand-text">{summary.generatedComments}</div>
              </div>
              <div className="p-2 rounded-xl bg-bg-sidebar">
                <div className="text-[10px] font-mono text-text-muted uppercase">Approved</div>
                <div className="text-base font-extrabold text-status-success-text">{summary.approvedComments}</div>
              </div>
              <div className="p-2 rounded-xl bg-bg-sidebar">
                <div className="text-[10px] font-mono text-text-muted uppercase">Published</div>
                <div className="text-base font-extrabold text-status-success-text">{summary.publishedReplies}</div>
              </div>
              <div className="p-2 rounded-xl bg-bg-sidebar">
                <div className="text-[10px] font-mono text-text-muted uppercase">Skipped</div>
                <div className="text-base font-extrabold text-status-warning-text">{summary.skippedCount}</div>
              </div>
              <div className="p-2 rounded-xl bg-bg-sidebar">
                <div className="text-[10px] font-mono text-text-muted uppercase">Failed</div>
                <div className="text-base font-extrabold text-status-danger-text">{summary.failedCount}</div>
              </div>
              <div className="p-2 rounded-xl bg-bg-sidebar">
                <div className="text-[10px] font-mono text-text-muted uppercase">Awaiting</div>
                <div className="text-base font-extrabold text-status-info-text">{summary.awaitingConfirmationCount}</div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* STEP 1: SELECT CREATORS */}
          {/* ============================================================ */}
          {workflowStep === 1 && (
            <div className="space-y-5">
              {/* Controls: Search, Source Filter, Quick-Add, Seeding, Cooldown, Optional Direction */}
              <div className="p-5 rounded-2xl bg-bg-card border border-border-primary space-y-4">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  {/* Search */}
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search creators by name, @handle, niche, or topics..."
                      className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-bg-input border border-border-primary text-xs text-text-primary focus:outline-none focus:border-purple-500 placeholder:text-text-muted"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary text-xs font-bold"
                      >
                        ×
                      </button>
                    )}
                  </div>

                  {/* Quick Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <button
                      onClick={() => setShowQuickAdd(!showQuickAdd)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                        showQuickAdd
                          ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                          : "bg-bg-sidebar border-border-primary text-text-primary hover:text-purple-600 dark:hover:text-purple-300"
                      }`}
                    >
                      <UserPlus className="w-3.5 h-3.5 text-purple-500" />
                      <span>+ Add @username</span>
                    </button>

                    <button
                      onClick={handleSeedFeatured}
                      disabled={isSeeding}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
                      title="Import 12 verified high-signal creators with live post history"
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${isSeeding ? "animate-spin" : ""}`} />
                      <span>{isSeeding ? "Importing..." : "Import 12 Featured"}</span>
                    </button>

                    {/* Cooldown selector */}
                    <div className="flex items-center gap-1.5 bg-bg-sidebar px-2.5 py-1.5 rounded-xl border border-border-primary">
                      <span className="text-[11px] text-text-secondary whitespace-nowrap">Cooldown:</span>
                      <select
                        value={cooldownDays}
                        onChange={(e) => setCooldownDays(Number(e.target.value))}
                        className="bg-transparent text-xs font-semibold text-text-primary focus:outline-none cursor-pointer"
                      >
                        <option value={3}>3d</option>
                        <option value={7}>7d (Default)</option>
                        <option value={14}>14d</option>
                        <option value={30}>30d</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Quick Add Inline Drawer */}
                {showQuickAdd && (
                  <div className="p-4 rounded-xl bg-bg-sidebar border border-purple-500/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                        <UserPlus className="w-4 h-4 text-purple-500" />
                        Target Any Threads Creator for Comment Outreach
                      </span>
                      <button
                        onClick={() => {
                          setShowQuickAdd(false);
                          setQuickAddError(null);
                        }}
                        className="text-[11px] text-text-muted hover:text-text-primary"
                      >
                        Cancel
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={quickAddHandle}
                        onChange={(e) => setQuickAddHandle(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleQuickAdd()}
                        placeholder="Enter Threads username (e.g. @mosseri, @zuck, @shaanpuri)..."
                        className="flex-1 px-3.5 py-2 rounded-xl bg-bg-card border border-border-primary text-xs text-text-primary focus:outline-none focus:border-purple-500"
                      />
                      <button
                        onClick={() => handleQuickAdd()}
                        disabled={isQuickAdding || !quickAddHandle.trim()}
                        className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-xs transition cursor-pointer shrink-0"
                      >
                        {isQuickAdding ? "Adding..." : "Add & Select"}
                      </button>
                    </div>
                    {quickAddError && (
                      <p className="text-[11px] text-red-500 font-semibold">{quickAddError}</p>
                    )}
                  </div>
                )}

                {/* Optional Comment Direction Field */}
                <div>
                  <label className="block text-[11px] font-bold text-text-primary mb-1">
                    Comment Direction <span className="font-normal text-text-muted">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={commentDirection}
                    onChange={(e) => setCommentDirection(e.target.value)}
                    placeholder="Optional: Tell the AI your desired angle (e.g. share a practical framework, ask a thoughtful question, or offer tactical counter-point)..."
                    className="w-full px-3.5 py-2 rounded-xl bg-bg-input border border-border-primary text-xs text-text-primary focus:outline-none focus:border-purple-500 placeholder:text-text-muted"
                  />
                </div>

                {/* Source Filter Tabs & Selection Toolbar */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-border-primary text-xs">
                  {/* Source tabs */}
                  <div className="flex items-center gap-1.5 p-1 rounded-xl bg-bg-sidebar border border-border-primary">
                    <button
                      onClick={() => setSourceFilter("all")}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                        sourceFilter === "all"
                          ? "bg-purple-600 text-white shadow-sm"
                          : "text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      All Creators ({availableCreators.length})
                    </button>
                    <button
                      onClick={() => setSourceFilter("saved")}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                        sourceFilter === "saved"
                          ? "bg-purple-600 text-white shadow-sm"
                          : "text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      Saved Database ({savedInfluencers.length})
                    </button>
                    <button
                      onClick={() => setSourceFilter("directory")}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                        sourceFilter === "directory"
                          ? "bg-purple-600 text-white shadow-sm"
                          : "text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      Verified Directory ({directoryCreators.length})
                    </button>
                  </div>

                  {/* Select All & Selection Count */}
                  <div className="flex items-center gap-4">
                    <button
                      onClick={handleToggleSelectAll}
                      className="flex items-center gap-1.5 font-bold text-purple-600 dark:text-purple-400 hover:opacity-80 cursor-pointer"
                    >
                      {isAllFilteredSelected ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4 text-text-muted" />
                      )}
                      <span>
                        {isAllFilteredSelected
                          ? `Deselect All (${filteredCreators.length})`
                          : `Select All (${filteredCreators.length})`}
                      </span>
                    </button>

                    <div className="text-text-secondary font-semibold">
                      <span className="font-extrabold text-text-primary">{selectedCreatorIds.size}</span> creator(s) selected
                    </div>
                  </div>
                </div>
              </div>

              {/* Instant Handle Quick-Add Prompt Card if user searches an unlisted handle */}
              {searchQuery.trim() && !filteredCreators.some((c) => (c.threadsUsername || c.username || "").toLowerCase() === searchQuery.trim().toLowerCase().replace(/^@/, "")) && (
                <div className="p-4 rounded-2xl bg-purple-500/[0.04] border border-purple-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                      <UserPlus className="w-4 h-4 text-purple-500" />
                      Target @{searchQuery.replace(/^@/, "")} for Outreach
                    </h4>
                    <p className="text-[11px] text-text-secondary mt-0.5">
                      Add this creator to your tracked outreach pool and inspect their latest Threads posts.
                    </p>
                  </div>
                  <button
                    onClick={() => handleQuickAdd(searchQuery)}
                    disabled={isQuickAdding}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition shadow-sm cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isQuickAdding ? "Adding..." : `Add @${searchQuery.replace(/^@/, "")} & Target`}</span>
                  </button>
                </div>
              )}

              {/* Creators Grid / List */}
              {availableCreators.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-bg-card border border-dashed border-border-primary space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto">
                    <Bookmark className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-text-primary">No Tracked Creators in Outreach Yet</h3>
                    <p className="text-xs text-text-secondary mt-1 max-w-sm mx-auto">
                      Import 12 featured high-signal Threads creators with live post histories or search the verified directory to start commenting.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                    <button
                      onClick={handleSeedFeatured}
                      disabled={isSeeding}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition shadow-md shadow-purple-600/20 cursor-pointer"
                    >
                      <Sparkles className={`w-4 h-4 ${isSeeding ? "animate-spin" : ""}`} />
                      <span>{isSeeding ? "Importing..." : "Import 12 Featured Creators"}</span>
                    </button>
                    <button
                      onClick={() => setShowQuickAdd(true)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-bg-sidebar border border-border-primary hover:bg-bg-card-hover text-text-primary font-bold text-xs transition cursor-pointer"
                    >
                      <UserPlus className="w-4 h-4 text-purple-500" />
                      <span>Add by @username</span>
                    </button>
                  </div>
                </div>
              ) : filteredCreators.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-bg-card border border-border-primary text-xs text-text-secondary space-y-2">
                  <p>No creators match query "{searchQuery}".</p>
                  <button
                    onClick={() => setSearchQuery("")}
                    className="text-purple-600 dark:text-purple-400 font-bold hover:underline"
                  >
                    Clear Filter
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredCreators.map((creator) => {
                    const id = creator.id || creator.username;
                    const isSelected = selectedCreatorIds.has(id);
                    const handle = creator.threadsUsername || creator.username;

                    return (
                      <div
                        key={id}
                        onClick={() => handleToggleSelectOne(id)}
                        className={`p-4 rounded-2xl border transition cursor-pointer select-none flex flex-col justify-between gap-3 ${
                          isSelected
                            ? "bg-purple-500/10 border-purple-500/40 shadow-sm"
                            : "bg-bg-card border-border-primary hover:border-border-hover"
                        }`}
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <button
                                type="button"
                                className="text-purple-600 dark:text-purple-400 shrink-0"
                              >
                                {isSelected ? (
                                  <CheckSquare className="w-5 h-5" />
                                ) : (
                                  <Square className="w-5 h-5 text-text-muted" />
                                )}
                              </button>

                              {creator.profilePicUrl ? (
                                <img
                                  src={creator.profilePicUrl}
                                  alt={creator.name}
                                  className="w-10 h-10 rounded-xl object-cover shrink-0 border border-border-primary"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-xl bg-purple-600/20 text-purple-600 flex items-center justify-center font-bold text-xs shrink-0">
                                  {creator.name?.charAt(0) || "C"}
                                </div>
                              )}

                              <div className="min-w-0">
                                <h4 className="text-xs font-bold text-text-primary truncate">{creator.name}</h4>
                                <p className="text-[11px] font-mono text-purple-600 dark:text-purple-400 truncate">
                                  @{handle}
                                </p>
                              </div>
                            </div>

                            <span
                              className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded-full font-bold border shrink-0 ${
                                creator.isSaved
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                  : "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
                              }`}
                            >
                              {creator.isSaved ? "Saved" : "Directory"}
                            </span>
                          </div>

                          {creator.bio && (
                            <p className="text-[11px] text-text-secondary line-clamp-2 leading-relaxed">
                              {creator.bio}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-border-primary text-[10px] text-text-muted">
                          <span className="font-mono bg-bg-sidebar px-2 py-0.5 rounded-md truncate max-w-[130px]">
                            {creator.niche || "Creator"}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-purple-600 dark:text-purple-400 font-bold">
                              {isSelected ? "Selected ✓" : "Click to Select"}
                            </span>
                            <a
                              href={buildThreadsProfileUrl(handle)}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="hover:text-purple-500 flex items-center gap-1"
                              title="View Threads Profile"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Step 1 Bottom Action Bar */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-bg-card border border-border-primary">
                <div className="text-xs text-text-secondary">
                  Ready to inspect recent public posts for{" "}
                  <span className="font-extrabold text-text-primary">{selectedCreatorIds.size}</span> creators.
                </div>

                <button
                  onClick={handleFindRecentPosts}
                  disabled={selectedCreatorIds.size === 0 || isRetrievingPosts}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs text-white transition shadow-md cursor-pointer ${
                    selectedCreatorIds.size === 0 || isRetrievingPosts
                      ? "bg-purple-600/50 cursor-not-allowed"
                      : "bg-purple-600 hover:bg-purple-700 shadow-purple-600/20"
                  }`}
                >
                  {isRetrievingPosts ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Retrieving Posts...</span>
                    </>
                  ) : (
                    <>
                      <span>Find Recent Posts</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* STEP 2: TARGET POST INSPECTION & GENERATION */}
          {/* ============================================================ */}
          {workflowStep === 2 && activeBatch && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-bg-card border border-border-primary">
                <div>
                  <h3 className="text-sm font-bold text-text-primary">Retrieved Target Posts</h3>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Inspect each creator's primary target post. If multiple posts were found, you can switch targets.
                  </p>
                </div>

                <button
                  onClick={handleGenerateComments}
                  disabled={isGeneratingComments || summary.eligiblePosts === 0}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs text-white transition shadow-md cursor-pointer ${
                    isGeneratingComments || summary.eligiblePosts === 0
                      ? "bg-purple-600/50 cursor-not-allowed"
                      : "bg-purple-600 hover:bg-purple-700 shadow-purple-600/20"
                  }`}
                >
                  {isGeneratingComments ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Generating Comments...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Generate Comments ({summary.eligiblePosts} Eligible)</span>
                    </>
                  )}
                </button>
              </div>

              {/* Items List */}
              <div className="space-y-3">
                {activeBatch.items.map((item) => {
                  const post = item.targetPost;
                  const hasAlternatives = item.alternativePosts && item.alternativePosts.length > 1;

                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-2xl border transition ${
                        post.eligible
                          ? "bg-bg-card border-border-primary"
                          : "bg-bg-card/50 border-border-primary/60 opacity-80"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-border-primary">
                        <div className="flex items-center gap-3">
                          {item.creatorProfilePicUrl ? (
                            <img
                              src={item.creatorProfilePicUrl}
                              alt={item.creatorName}
                              className="w-8 h-8 rounded-full object-cover shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-purple-600/20 text-purple-600 flex items-center justify-center font-bold text-xs">
                              {item.creatorName?.charAt(0) || "C"}
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-text-primary">{item.creatorName}</span>
                              <span className="text-xs text-text-secondary">@{item.creatorUsername}</span>
                            </div>
                            <span className="text-[11px] text-text-muted">
                              Published: {post.publishedAt || "Recently"}
                            </span>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="flex items-center gap-2">
                          {post.eligible ? (
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-bold border border-emerald-500/20">
                              Eligible for Reply
                            </span>
                          ) : (
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-bold border border-amber-500/20">
                              Skipped
                            </span>
                          )}

                          <a
                            href={post.url || buildThreadsProfileUrl(item.creatorUsername)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-text-muted hover:text-purple-500 transition"
                            title="View on Threads"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>

                      {/* Full Exact Creator Post */}
                      <div className="mt-3 p-4 rounded-xl bg-bg-sidebar border border-border-primary text-xs space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-text-muted pb-1 border-b border-border-primary/60">
                          <span className="font-bold text-text-secondary flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0"></span>
                            <span>Full Exact Creator Post</span>
                            <span className="text-[10px] px-2 py-0.5 font-mono font-bold rounded-full bg-purple-500/10 text-purple-600 border border-purple-500/20">
                              {post.publishedAt ? `Published ${post.publishedAt}` : "Most Recent"}
                            </span>
                          </span>
                          <a
                            href={post.url || buildThreadsProfileUrl(item.creatorUsername)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-purple-600 hover:text-purple-700 flex items-center gap-1 font-semibold text-xs ml-auto"
                          >
                            <span>Open on Threads</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>

                        {/* Full exact body text without truncation */}
                        <div className="text-text-primary leading-relaxed whitespace-pre-wrap font-sans text-xs bg-bg-card/70 p-3.5 rounded-lg border border-border-primary/60">
                          {post.text}
                        </div>

                        {/* Engagement stats */}
                        {(post.likes || post.replies || post.reposts) ? (
                          <div className="flex items-center gap-4 pt-0.5 text-[11px] text-text-muted font-mono">
                            {post.likes ? <span>❤️ {Number(post.likes).toLocaleString()} likes</span> : null}
                            {post.replies ? <span>💬 {Number(post.replies).toLocaleString()} replies</span> : null}
                            {post.reposts ? <span>🔄 {Number(post.reposts).toLocaleString()} reposts</span> : null}
                          </div>
                        ) : null}
                      </div>

                      {/* Skip explanation or Alternative Posts */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mt-3 pt-2 text-xs">
                        {!post.eligible && item.skipReason && (
                          <div className="text-amber-600 dark:text-amber-400 text-[11px] flex items-center gap-1.5">
                            <Info className="w-3.5 h-3.5 shrink-0" />
                            <span>{item.skipReason}</span>
                          </div>
                        )}

                        {hasAlternatives && (
                          <div className="flex items-center gap-2 ml-auto">
                            <span className="text-[11px] text-text-muted font-medium">Select another recent post:</span>
                            <select
                              onChange={(e) => {
                                const selectedId = e.target.value;
                                const match = item.alternativePosts?.find((p) => p.id === selectedId);
                                if (match) handleSwitchTargetPost(item.id, match);
                              }}
                              value={post.id}
                              className="px-2.5 py-1.5 rounded-lg bg-bg-input border border-border-primary text-xs font-semibold text-text-primary cursor-pointer max-w-xs truncate"
                            >
                              {item.alternativePosts?.map((alt, idx) => (
                                <option key={alt.id} value={alt.id}>
                                  {idx === 0 ? "★ Most Recent" : `Post ${idx + 1}`} ({alt.publishedAt || "Recent"}): {alt.text.slice(0, 38)}...
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Action Bar */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-bg-card border border-border-primary">
                <button
                  onClick={() => setWorkflowStep(1)}
                  className="px-4 py-2 rounded-xl border border-border-primary text-xs font-bold text-text-secondary hover:text-text-primary hover:bg-bg-card-hover transition cursor-pointer"
                >
                  Back to Select
                </button>

                <button
                  onClick={handleGenerateComments}
                  disabled={isGeneratingComments || summary.eligiblePosts === 0}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs text-white transition shadow-md cursor-pointer ${
                    isGeneratingComments || summary.eligiblePosts === 0
                      ? "bg-purple-600/50 cursor-not-allowed"
                      : "bg-purple-600 hover:bg-purple-700 shadow-purple-600/20"
                  }`}
                >
                  {isGeneratingComments ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Generating AI Comments...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Generate Comments</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* STEP 3: REVIEW QUEUE & BULK PUBLISH */}
          {/* ============================================================ */}
          {workflowStep === 3 && activeBatch && (
            <div className="space-y-5">
              {/* Action Header: Bulk Approve, Publish, Stop Queue */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-2xl bg-bg-card border border-border-primary">
                <div>
                  <h3 className="text-sm font-bold text-text-primary">Review Queue</h3>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Review and edit generated replies. Only explicitly approved comments will be published.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Bulk Approve Button */}
                  <button
                    onClick={handleApproveAllReady}
                    className="px-3.5 py-2 rounded-xl bg-bg-sidebar border border-border-primary hover:bg-bg-card-hover text-xs font-bold text-text-primary transition cursor-pointer"
                  >
                    Approve All Ready
                  </button>

                  {/* Stop Queue Button (Active when publishing or queued) */}
                  {isPublishing && (
                    <button
                      onClick={handleStopQueue}
                      disabled={isStoppingQueue}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 font-bold text-xs hover:bg-red-500/20 transition cursor-pointer"
                    >
                      <StopCircle className="w-4 h-4" />
                      <span>{isStoppingQueue ? "Stopping..." : "Stop Queue"}</span>
                    </button>
                  )}

                  {/* Publish Approved Button */}
                  <button
                    onClick={handlePublishApproved}
                    disabled={
                      isPublishing ||
                      (summary.approvedComments === 0 && summary.generatedComments === 0) ||
                      !threadsConnection.connected ||
                      !threadsConnection.hasPublishPermission
                    }
                    className={`flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-xs text-white transition shadow-md cursor-pointer ${
                      isPublishing ||
                      (summary.approvedComments === 0 && summary.generatedComments === 0) ||
                      !threadsConnection.connected ||
                      !threadsConnection.hasPublishPermission
                        ? "bg-purple-600/50 cursor-not-allowed"
                        : "bg-purple-600 hover:bg-purple-700 shadow-purple-600/20"
                    }`}
                  >
                    {isPublishing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Publishing Queue...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>
                          {summary.approvedComments > 0
                            ? `Publish Approved (${summary.approvedComments})`
                            : `Approve & Publish All (${summary.generatedComments})`}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Review Queue Items */}
              <div className="space-y-4">
                {activeBatch.items.map((item) => {
                  const isApproved = item.status === "Approved";
                  const isPublished =
                    item.status === "Published" ||
                    item.status === "Published As Reply" ||
                    item.status === "Verified";
                  const isPublishingThis =
                    item.status === "Publishing" ||
                    item.status === "Queued" ||
                    item.status === "Creating Reply" ||
                    item.status === "Publishing Reply";
                  const isAwaiting = item.status === "Awaiting Confirmation";
                  const charCount = (item.generatedComment || "").length;
                  const isOverLimit = charCount > 500;
                  const isTargetValid = Boolean(
                    item.creatorUsername &&
                    item.targetPost &&
                    item.targetPost.id &&
                    item.targetPost.id !== "none" &&
                    item.targetPost.text &&
                    item.targetPost.text.trim().length >= 15
                  );
                  const hasComment = Boolean((item.approvedComment || item.generatedComment || "").trim());
                  const canPublishItem =
                    isTargetValid &&
                    hasComment &&
                    threadsConnection.connected &&
                    threadsConnection.hasPublishPermission &&
                    !isPublishing &&
                    publishingItemId !== item.id &&
                    !isPublishingThis;

                  return (
                    <div
                      key={item.id}
                      className={`p-5 rounded-2xl border transition space-y-3.5 ${
                        isPublished
                          ? item.status === "Verified" || item.verificationStatus === "Verified"
                            ? "bg-emerald-500/10 border-emerald-500/40"
                            : "bg-emerald-500/5 border-emerald-500/30"
                          : isApproved
                          ? "bg-purple-500/5 border-purple-500/40"
                          : item.status === "Failed"
                          ? "bg-red-500/5 border-red-500/30"
                          : !isTargetValid
                          ? "bg-amber-500/5 border-amber-500/30"
                          : "bg-bg-card border-border-primary"
                      }`}
                    >
                      {/* Target Identity & Canonical Pairing Banner */}
                      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-purple-600 dark:text-purple-400">Target Pairing:</span>
                          <span className="text-text-primary">
                            Leaving reply on <strong className="font-semibold text-purple-600">@{item.creatorUsername}</strong>'s post
                          </span>
                          <span className="font-mono text-[10px] text-text-muted bg-bg-card px-2 py-0.5 rounded border border-border-primary">
                            Target Post ID: {item.targetPost.id !== "none" ? item.targetPost.id : "Missing ID"}
                          </span>
                        </div>
                        {item.targetPost.url && (
                          <a
                            href={item.targetPost.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-semibold text-purple-600 hover:text-purple-700 flex items-center gap-1 ml-auto"
                            title="Verify target post on Threads"
                          >
                            <span>View Post</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>

                      {/* Safety Alert if Target is Invalid */}
                      {!isTargetValid && !isPublished && (
                        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
                          <span>
                            Target verification warning: Selected post could not be confirmed as belonging to @{item.creatorUsername}. Publishing is blocked to prevent cross-post reply errors.
                          </span>
                        </div>
                      )}

                      {/* Item Header */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {item.creatorProfilePicUrl ? (
                            <img
                              src={item.creatorProfilePicUrl}
                              alt={item.creatorName}
                              className="w-9 h-9 rounded-full object-cover shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-purple-600/20 text-purple-600 flex items-center justify-center font-bold text-xs">
                              {item.creatorName?.charAt(0) || "C"}
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-text-primary">{item.creatorName}</span>
                              <span className="text-xs text-text-secondary">@{item.creatorUsername}</span>
                            </div>
                            <a
                              href={item.targetPost.url || buildThreadsProfileUrl(item.creatorUsername)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-text-muted hover:text-purple-500 flex items-center gap-1"
                            >
                              <span>Target Post</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          </div>
                        </div>

                        {/* Status Badge & Approve / Action Buttons */}
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[11px] font-mono px-2.5 py-0.5 rounded-full font-bold border ${
                              isPublished
                                ? "bg-status-success-bg text-status-success-text border-status-success-border"
                                : isApproved
                                ? "bg-brand-surface text-brand-text border-brand-border"
                                : isPublishingThis
                                ? "bg-status-info-bg text-status-info-text border-status-info-border animate-pulse"
                                : isAwaiting
                                ? "bg-status-info-bg text-status-info-text border-status-info-border"
                                : item.status === "Failed"
                                ? "bg-status-danger-bg text-status-danger-text border-status-danger-border"
                                : "bg-bg-sidebar text-text-secondary border-border-primary"
                            }`}
                          >
                            {item.status}
                          </span>

                          {/* Regenerate Single Item */}
                          {!isPublished && (
                            <button
                              onClick={() => handleRegenerateItem(item.id)}
                              disabled={item.status === "Generating" || isPublishing || !isTargetValid}
                              className="p-1.5 rounded-lg border border-border-primary hover:bg-bg-card-hover text-text-secondary hover:text-text-primary transition cursor-pointer disabled:opacity-40"
                              title="Regenerate comment"
                            >
                              <RefreshCw
                                className={`w-3.5 h-3.5 ${item.status === "Generating" ? "animate-spin" : ""}`}
                              />
                            </button>
                          )}

                          {/* Approve / Deselect Toggle */}
                          {!isPublished && item.generatedComment && (
                            <button
                              onClick={() => handleToggleApproval(item.id)}
                              disabled={isPublishingThis || publishingItemId === item.id || !isTargetValid}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                                isApproved
                                  ? "bg-purple-600 text-white shadow-sm"
                                  : "bg-bg-sidebar border border-border-primary text-text-secondary hover:text-text-primary"
                              }`}
                              title={!isTargetValid ? "Cannot approve: target post not verified" : undefined}
                            >
                              {isApproved ? "Approved ✓" : "Approve"}
                            </button>
                          )}

                          {/* Individual Publish Live Button */}
                          {!isPublished && item.generatedComment && (
                            <button
                              onClick={() => handlePublishSingleItem(item.id)}
                              disabled={!canPublishItem}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white transition shadow-sm cursor-pointer"
                              title={!isTargetValid ? "Publishing blocked: target post not confirmed" : "Publish this comment directly to Threads"}
                            >
                              {publishingItemId === item.id ? (
                                <>
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  <span>Publishing...</span>
                                </>
                              ) : (
                                <>
                                  <Send className="w-3.5 h-3.5" />
                                  <span>Publish Live</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Target Post: Full Exact Creator Post Replying To */}
                      <div className="p-4 rounded-xl bg-bg-sidebar border border-border-primary text-xs space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] pb-1 border-b border-border-primary/60">
                          <span className="font-bold text-text-secondary flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                            <span>Full Exact Creator Post (Target for Reply)</span>
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 border border-purple-500/20">
                              {item.targetPost.publishedAt ? `Published ${item.targetPost.publishedAt}` : "Most Recent"}
                            </span>
                          </span>
                          <a
                            href={item.targetPost.url || buildThreadsProfileUrl(item.creatorUsername)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-semibold text-purple-600 hover:text-purple-700 flex items-center gap-1 ml-auto"
                            title="Open exact post on Threads"
                          >
                            <span>Open on Threads</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>

                        {/* Full exact body text */}
                        <div className="p-3 rounded-lg bg-bg-card/70 border border-border-primary/60 text-xs text-text-primary whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">
                          {item.targetPost.text}
                        </div>

                        {(item.targetPost.likes || item.targetPost.replies || item.targetPost.reposts) ? (
                          <div className="flex items-center gap-4 text-[11px] text-text-muted font-mono pt-0.5">
                            {item.targetPost.likes ? <span>❤️ {Number(item.targetPost.likes).toLocaleString()} likes</span> : null}
                            {item.targetPost.replies ? <span>💬 {Number(item.targetPost.replies).toLocaleString()} replies</span> : null}
                            {item.targetPost.reposts ? <span>🔄 {Number(item.targetPost.reposts).toLocaleString()} reposts</span> : null}
                          </div>
                        ) : null}
                      </div>

                      {/* Comment Editor Textarea */}
                      <div>
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="font-semibold text-text-secondary flex items-center gap-1">
                            <Edit3 className="w-3 h-3 text-purple-500" />
                            Generated Reply (Editable):
                          </span>
                          <span
                            className={`font-mono text-[10px] ${
                              isOverLimit ? "text-red-500 font-bold" : "text-text-muted"
                            }`}
                          >
                            {charCount} / 500 characters
                          </span>
                        </div>

                        <textarea
                          rows={3}
                          value={item.generatedComment || ""}
                          disabled={isPublished || isPublishingThis}
                          onChange={(e) => handleEditCommentText(item.id, e.target.value)}
                          placeholder="Comment text..."
                          className={`w-full p-3 rounded-xl bg-bg-input border text-xs text-text-primary focus:outline-none focus:border-purple-500 resize-none ${
                            isOverLimit ? "border-red-500" : "border-border-primary"
                          }`}
                        />
                      </div>

                      {/* Published Confirmation with Verified Target Details */}
                      {isPublished && (
                        <div
                          className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                            item.status === "Verified" || item.verificationStatus === "Verified"
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                              : "bg-blue-500/10 border-blue-500/30 text-blue-800 dark:text-blue-300"
                          }`}
                        >
                          <div className="flex items-center justify-between font-bold">
                            <span className="flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                              {item.status === "Verified" || item.verificationStatus === "Verified"
                                ? "Verified: Reply Confirmed Attached to Target Post ✓"
                                : "Published to Threads (Verification Pending)"}
                            </span>
                            {item.publishedPermalink && (
                              <a
                                href={item.publishedPermalink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-bold underline hover:opacity-80 flex items-center gap-1"
                              >
                                <span>View Live Reply</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                          <div className="font-mono text-[11px] opacity-90 space-y-0.5">
                            <div>Outreach Comment → @{item.creatorUsername} → Parent Post #{item.verificationDetails?.intendedParentPostId || item.targetPost.id}</div>
                            {item.publishedReplyId && <div>Published Reply ID: #{item.publishedReplyId}</div>}
                          </div>
                        </div>
                      )}

                      {/* Awaiting Confirmation */}
                      {isAwaiting && (
                        <div className="p-3 rounded-xl bg-status-info-bg border border-status-info-border text-xs text-status-info-text flex items-center justify-between">
                          <div>
                            <span className="font-bold">Awaiting Confirmation</span>
                            <p className="text-[11px] opacity-90 mt-0.5">{item.errorReason}</p>
                          </div>
                          <a
                            href={item.targetPost.url || buildThreadsProfileUrl(item.creatorUsername)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold underline text-xs"
                          >
                            Check Target Post
                          </a>
                        </div>
                      )}

                      {/* Error or Skip Explanation */}
                      {item.errorReason && !isAwaiting && (
                        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>{item.errorReason}</span>
                          </div>
                          <button
                            onClick={() => handleRetryItem(activeBatch.id, item.id)}
                            disabled={retryingItemId === item.id}
                            className="px-2.5 py-1 rounded-lg bg-red-600 text-white font-bold text-[11px] cursor-pointer hover:bg-red-700 transition"
                          >
                            {retryingItemId === item.id ? "Retrying..." : "Retry"}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Bottom Navigation */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-bg-card border border-border-primary">
                <button
                  onClick={() => setWorkflowStep(2)}
                  className="px-4 py-2 rounded-xl border border-border-primary text-xs font-bold text-text-secondary hover:text-text-primary hover:bg-bg-card-hover transition cursor-pointer"
                >
                  Back to Target Posts
                </button>

                <button
                  onClick={handlePublishApproved}
                  disabled={
                    isPublishing ||
                    (summary.approvedComments === 0 && summary.generatedComments === 0) ||
                    !threadsConnection.connected ||
                    !threadsConnection.hasPublishPermission
                  }
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs text-white transition shadow-md cursor-pointer ${
                    isPublishing ||
                    (summary.approvedComments === 0 && summary.generatedComments === 0) ||
                    !threadsConnection.connected ||
                    !threadsConnection.hasPublishPermission
                      ? "bg-purple-600/50 cursor-not-allowed"
                      : "bg-purple-600 hover:bg-purple-700 shadow-purple-600/20"
                  }`}
                >
                  {isPublishing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Publishing Queue...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>
                        {summary.approvedComments > 0
                          ? `Publish Approved (${summary.approvedComments})`
                          : `Approve & Publish All (${summary.generatedComments})`}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* HISTORY VIEW MODE */}
      {/* ============================================================ */}
      {viewMode === "history" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-2xl bg-bg-card border border-border-primary">
            <div>
              <h3 className="text-sm font-bold text-text-primary">Outreach History</h3>
              <p className="text-xs text-text-secondary mt-0.5">
                Past creator reply outreach batches, published outcomes, and retry controls.
              </p>
            </div>
            <button
              onClick={fetchHistory}
              disabled={isLoadingHistory}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-bg-sidebar border border-border-primary text-xs font-bold text-text-secondary hover:text-text-primary transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHistory ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>

          {isLoadingHistory ? (
            <div className="p-12 text-center text-xs text-text-muted">Loading history batches...</div>
          ) : historyBatches.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-bg-card border border-border-primary">
              <History className="w-8 h-8 text-text-muted mx-auto mb-2" />
              <p className="text-xs text-text-secondary">No previous outreach batches recorded yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {historyBatches.map((batch) => (
                <div key={batch.id} className="p-5 rounded-2xl bg-bg-card border border-border-primary space-y-3">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 border-b border-border-primary">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-text-primary">Batch #{batch.id.slice(-6)}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 font-bold">
                          {batch.status.toUpperCase()}
                        </span>
                      </div>
                      <span className="text-[11px] text-text-muted">
                        Created: {new Date(batch.createdAt).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-emerald-500 font-bold">
                        {batch.summary.publishedReplies} Published
                      </span>
                      {batch.summary.failedCount > 0 && (
                        <span className="text-red-500 font-bold">{batch.summary.failedCount} Failed</span>
                      )}
                    </div>
                  </div>

                  {/* Batch items list */}
                  <div className="space-y-2 pt-1">
                    {batch.items.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-xl bg-bg-sidebar border border-border-primary text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-text-primary">@{item.creatorUsername}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-bg-card text-text-muted border border-border-primary">
                              {item.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-text-secondary truncate max-w-lg mt-0.5">
                            "{item.approvedComment || item.generatedComment || "No comment"}"
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {item.publishedPermalink && (
                            <a
                              href={item.publishedPermalink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-purple-500 hover:underline flex items-center gap-1 text-[11px] font-bold"
                            >
                              <span>View Reply</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}

                          {item.status === "Failed" && (
                            <button
                              onClick={() => handleRetryItem(batch.id, item.id)}
                              disabled={retryingItemId === item.id}
                              className="px-2.5 py-1 rounded-lg bg-red-600 text-white font-bold text-[10px] cursor-pointer"
                            >
                              {retryingItemId === item.id ? "Retrying..." : "Retry"}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
