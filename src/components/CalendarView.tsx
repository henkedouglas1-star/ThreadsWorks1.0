import React, { useState, useEffect, useMemo } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  FileText,
  Trash2,
  Trash,
  Edit2,
  X,
  AlertCircle,
  RefreshCw,
  Sparkles,
  ExternalLink,
  Copy,
  Check,
  Save,
  Filter,
  Search,
  ArrowUpRight,
  Layers,
  Send,
  CheckCircle2,
  List,
  Grid,
  ShieldCheck,
  Zap,
  CalendarX,
  Download,
  MessageSquare,
} from "lucide-react";
import { auth, db, handleFirestoreError, OperationType, withTimeout } from "../firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  deleteDoc,
  updateDoc,
  writeBatch,
  getDocs,
  limit,
  Timestamp,
} from "firebase/firestore";
import { UserProfile } from "../types";
import ScheduleModal from "./ScheduleModal";
import PublishModal from "./PublishModal";
import { 
  checkThreadsConnection, 
  getThreadsAppId, 
  generateThreadsAuthUrl, 
  invalidateThreadsConnectionCache,
  initiateThreadsOAuthFlow 
} from "../utils/threadsApi";
import { IntelligentContentMemoryView } from "./ContentMemory/IntelligentContentMemoryView";
import { useThreadsConnection } from "../context/ThreadsConnectionContext";
import ThreadsConnectButton from "./ThreadsConnectButton";
import { useContentPersistence } from "../context/ContentPersistenceContext";
import {
  CanonicalContentRecord,
  CanonicalStage,
  CONTENT_UPDATED_EVENT,
  fetchCanonicalRecords,
  saveCanonicalRecord,
  updateCanonicalRecord,
  deleteCanonicalRecord,
  readLocalCanonicalRecords,
  formatLocalDateKey,
  invalidateCanonicalCache,
} from "../lib/canonicalContent";
import { SmartRecommendation } from "../lib/contentIntelligence";
import SmartRecommendationsBar from "./Planner/SmartRecommendationsBar";
import ContentLibraryWorkspace from "./Planner/ContentLibraryWorkspace";
import WeeklyPlannerWorkspace from "./Planner/WeeklyPlannerWorkspace";

interface CalendarViewProps {
  profile: UserProfile | null;
  subscriptionStatus?: string;
  onNavigateToTab?: (tab: string) => void;
  initialSubView?: "calendar" | "weekly" | "library" | "memory";
}

export interface PostItem {
  id: string;
  userId: string;
  title: string;
  hook?: string;
  singlePost: string;
  threadParts?: string[];
  topic?: string;
  topics?: string[];
  pillarTitle?: string;
  sourceIdeaId?: string | null;
  stage?: CanonicalStage;
  status: "Idea" | "Draft" | "Ready" | "Planned" | "Scheduled" | "Published" | "Failed" | string;
  plannedDate?: string | null;
  scheduledFor?: any;
  scheduledAt?: any;
  createdAt?: any;
  error?: string;
  errorMessage?: string;
  scheduledDate?: Date | null;
}

export function parseScheduledDate(scheduledFor: any): Date | null {
  if (!scheduledFor) return null;
  if (typeof scheduledFor.toDate === "function") {
    const d = scheduledFor.toDate();
    return isNaN(d.getTime()) ? null : d;
  }
  if (scheduledFor.seconds) {
    const d = new Date(scheduledFor.seconds * 1000);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(scheduledFor);
  return isNaN(d.getTime()) ? null : d;
}

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarView({
  profile,
  subscriptionStatus,
  onNavigateToTab,
  initialSubView = "calendar",
}: CalendarViewProps) {
  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState<number>(() => today.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(() => today.getMonth());

  // Main sub-view switcher: "weekly" (7-Day Plan), "calendar" (Month Grid), "library" (Smart Content Library), or "memory" (Intelligent Content Memory)
  const [subView, setSubView] = useState<"calendar" | "weekly" | "library" | "memory">(initialSubView);
  const { setActiveIdea } = useContentPersistence();

  useEffect(() => {
    setSubView(initialSubView);
  }, [initialSubView]);

  // Global canonical records + PostItem mirror for existing Month Grid & bulk modals
  const [canonicalRecords, setCanonicalRecords] = useState<CanonicalContentRecord[]>([]);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Smart Library filter state (controllable by SmartRecommendationsBar)
  const [libraryStageFilter, setLibraryStageFilter] = useState<CanonicalStage | "all" | "unfinished">("all");
  const [libraryTopicFilter, setLibraryTopicFilter] = useState<string>("all");
  const [libraryPillarFilter, setLibraryPillarFilter] = useState<string>("all");
  const [libraryOnlyDuplicates, setLibraryOnlyDuplicates] = useState<boolean>(false);

  // Legacy filter state preserved for internal references
  const [libraryFilter, setLibraryFilter] = useState<"all" | "Draft" | "Scheduled" | "Published">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 250);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Visual actions & editor state
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSinglePost, setEditSinglePost] = useState("");
  const [editThreadParts, setEditThreadParts] = useState<string[]>([]);
  const [regeneratingIds, setRegeneratingIds] = useState<Record<string, boolean>>({});

  // Removal & Toast states
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [removalLoading, setRemovalLoading] = useState(false);
  const [isUnscheduleConfirmOpen, setIsUnscheduleConfirmOpen] = useState(false);
  const [unscheduleLoading, setUnscheduleLoading] = useState(false);
  const [deletePermanentlyOnUnschedule, setDeletePermanentlyOnUnschedule] = useState(false);
  const [isDraftsConfirmOpen, setIsDraftsConfirmOpen] = useState(false);
  const [draftsRemovalLoading, setDraftsRemovalLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals & Scheduling state
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [schedulingDate, setSchedulingDate] = useState<string | undefined>(undefined);
  const [activeSchedulePost, setActiveSchedulePost] = useState<PostItem | null>(null);

  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [activePublishPost, setActivePublishPost] = useState<PostItem | null>(null);

  const [selectedPostDetails, setSelectedPostDetails] = useState<PostItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Show / Hide Unscheduled Drafts tray on calendar grid
  const [isDraftsTrayOpen, setIsDraftsTrayOpen] = useState(true);

  // Threads connection tracking
  const { 
    loading: loadingConn,
    connected,
    username,
    profilePictureUrl,
    connectThreads
  } = useThreadsConnection();
  const connection = { connected, username, profilePictureUrl };

  const getLibraryKey = () => {
    const uId = auth.currentUser?.uid || profile?.uid || "anonymous";
    return `threads_saved_offline_library_${uId}`;
  };

  // Connect / Reconnect Threads Account OAuth Trigger
  const handleConnectThreads = async () => {
    const currentUid = auth.currentUser?.uid || profile?.uid;
    if (!currentUid) {
      alert("Please sign in before connecting your Meta Threads account.");
      return;
    }
    const result = await connectThreads("/calendar");
    if (result.success) {
      setToastMessage(`Successfully connected to Meta Threads account`);
      setTimeout(() => setToastMessage(null), 4000);
    } else if (result.error !== "Cancelled") {
      alert("Failed to initiate Threads connection: " + result.error);
    }
  };

  const mapCanonicalToPostItem = (rec: CanonicalContentRecord): PostItem => ({
    id: rec.id,
    userId: rec.userId,
    title: rec.title,
    hook: rec.hook,
    singlePost: rec.singlePost,
    threadParts: rec.threadParts,
    topic: rec.topic,
    topics: rec.topics,
    pillarTitle: rec.pillarTitle,
    sourceIdeaId: rec.sourceIdeaId,
    stage: rec.stage,
    status: rec.status,
    plannedDate: rec.plannedDate || null,
    scheduledFor: rec.scheduledFor || null,
    scheduledAt: rec.scheduledAt || null,
    createdAt: rec.createdAt,
    error: rec.errorMessage || "",
    errorMessage: rec.errorMessage || "",
    scheduledDate: parseScheduledDate(rec.scheduledFor),
  });

  // 2. Unified Canonical Firestore & Local Storage synchronization for all user content
  const fetchAllPosts = async (forceRefresh = false) => {
    setError(null);
    const activeUid = auth.currentUser?.uid || profile?.uid || "anonymous";

    // A. Instant local-first render
    const localCanonical = readLocalCanonicalRecords(activeUid);
    if (localCanonical.length > 0) {
      setCanonicalRecords(localCanonical);
      setPosts(localCanonical.map(mapCanonicalToPostItem));
      setLoading(false);
    }

    // Trigger background check for due scheduled posts
    const scheduledCandidates = localCanonical
      .filter((p) => p.stage === "Scheduled" && Boolean(p.scheduledFor))
      .map((p) => ({
        id: p.id,
        userId: p.userId,
        title: p.title,
        singlePost: p.singlePost,
        threadParts: p.threadParts,
        status: "Scheduled",
        scheduledFor: p.scheduledFor,
      }));

    if (scheduledCandidates.length > 0) {
      (async () => {
        try {
          const idToken = await auth.currentUser?.getIdToken();
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (idToken) headers["Authorization"] = `Bearer ${idToken}`;
          fetch("/api/posts/dispatch-due", {
            method: "POST",
            headers,
            body: JSON.stringify({
              userId: activeUid,
              posts: scheduledCandidates,
            }),
          }).catch(() => {});
        } catch (_) {}
      })();
    }

    if (!auth.currentUser?.uid && !profile?.uid) {
      setLoading(false);
      return;
    }

    // B. Load complete unified canonical library (Ideas, Drafts, Ready, Planned, Scheduled, Published, Failed)
    try {
      const merged = await fetchCanonicalRecords(activeUid, { forceRefresh });
      setCanonicalRecords(merged);
      setPosts(merged.map(mapCanonicalToPostItem));
      setLoading(false);
      setError(null);
    } catch (err: any) {
      console.warn("Could not refresh cloud posts; using offline storage:", err?.message || err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllPosts(true);
  }, [profile?.uid, auth.currentUser?.uid]);

  // Listen for cross-view content updates (Content Engine, ScheduleModal, PublishModal, etc.)
  useEffect(() => {
    const handleUpdated = () => {
      const activeUid = auth.currentUser?.uid || profile?.uid || "anonymous";
      const freshLocal = readLocalCanonicalRecords(activeUid);
      setCanonicalRecords(freshLocal);
      setPosts(freshLocal.map(mapCanonicalToPostItem));
    };
    window.addEventListener(CONTENT_UPDATED_EVENT, handleUpdated);
    return () => window.removeEventListener(CONTENT_UPDATED_EVENT, handleUpdated);
  }, [profile?.uid, auth.currentUser?.uid]);

  // Derived: Scheduled posts for calendar grid and bulk actions (source of truth: status === "Scheduled" or "Missed")
  const scheduledPosts = useMemo(() => {
    return posts.filter((p) => {
      const s = String(p.status || "").trim().toLowerCase();
      return s === "scheduled" || s === "missed";
    });
  }, [posts]);

  // Derived: Planned posts with a plannedDate for Month Grid visibility
  const plannedPosts = useMemo(() => {
    return posts.filter((p) => p.stage === "Planned" && Boolean(p.plannedDate));
  }, [posts]);

  // Derived: Unscheduled drafts for quick tray
  const unscheduledDrafts = useMemo(() => {
    return posts.filter(
      (p) =>
        p.stage === "Draft" ||
        p.stage === "Ready" ||
        p.stage === "Idea" ||
        (!p.scheduledFor && p.status !== "Published" && p.stage !== "Planned")
    );
  }, [posts]);

  // Derived: Filtered posts for library list view
  const filteredLibraryPosts = useMemo(() => {
    return posts.filter((post) => {
      // 1. Status Filter
      if (libraryFilter === "Draft" && post.status !== "Draft" && (post.scheduledFor || post.status === "Scheduled")) return false;
      if (libraryFilter === "Scheduled" && post.status !== "Scheduled" && !post.scheduledFor) return false;
      if (libraryFilter === "Published" && post.status !== "Published") return false;

      // 2. Search Query Filter
      if (debouncedSearchQuery.trim()) {
        const query = debouncedSearchQuery.toLowerCase();
        const titleMatch = (post.title || "").toLowerCase().includes(query);
        const textMatch = (post.singlePost || "").toLowerCase().includes(query);
        const hookMatch = (post.hook || "").toLowerCase().includes(query);
        const topicMatch = (post.topic || "").toLowerCase().includes(query);
        return titleMatch || textMatch || hookMatch || topicMatch;
      }
      return true;
    }).sort((a, b) => {
      const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      return timeB - timeA;
    });
  }, [posts, libraryFilter, debouncedSearchQuery]);

  const hasPublishedPosts = useMemo(() => {
    return posts.some((p) => p.status === "Published");
  }, [posts]);

  // Derived: All Draft posts (unscheduled and not published)
  const draftPosts = useMemo(() => {
    return posts.filter((p) => (p.status === "Draft" || !p.status) && !p.scheduledFor && p.status !== "Published");
  }, [posts]);

  const hasDrafts = useMemo(() => {
    return draftPosts.length > 0;
  }, [draftPosts]);

  // ---------------------------------------------------------------------------
  // Calendar Navigation Handlers
  // ---------------------------------------------------------------------------
  const handlePreviousMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((prev) => prev - 1);
    } else {
      setViewMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((prev) => prev + 1);
    } else {
      setViewMonth((prev) => prev + 1);
    }
  };

  const handleToday = () => {
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
  };

  const currentMonthDisplay = useMemo(() => {
    const d = new Date(viewYear, viewMonth, 1);
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }, [viewYear, viewMonth]);

  // Calendar Grid Matrix Calculation
  const calendarGrid = useMemo(() => {
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();
    const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    interface CalendarCell {
      dayNumber: number;
      month: number;
      year: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      dateKey: string;
      dateObj: Date;
      posts: PostItem[];
    }

    const cells: CalendarCell[] = [];

    // 1. Trailing days from previous month
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevMonth = viewMonth === 0 ? 11 : viewMonth - 1;
      const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear;
      const cellDate = new Date(prevYear, prevMonth, dayNum);
      const dateKey = `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;

      cells.push({
        dayNumber: dayNum,
        month: prevMonth,
        year: prevYear,
        isCurrentMonth: false,
        isToday:
          cellDate.getDate() === today.getDate() &&
          cellDate.getMonth() === today.getMonth() &&
          cellDate.getFullYear() === today.getFullYear(),
        dateKey,
        dateObj: cellDate,
        posts: [],
      });
    }

    // 2. Days of current month
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const cellDate = new Date(viewYear, viewMonth, d);
      const dateKey = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

      cells.push({
        dayNumber: d,
        month: viewMonth,
        year: viewYear,
        isCurrentMonth: true,
        isToday:
          d === today.getDate() &&
          viewMonth === today.getMonth() &&
          viewYear === today.getFullYear(),
        dateKey,
        dateObj: cellDate,
        posts: [],
      });
    }

    // 3. Leading days of next month
    const remainingCells = (7 - (cells.length % 7)) % 7;
    const targetTotal = cells.length + remainingCells < 35 ? 35 : cells.length + remainingCells;
    const nextDaysNeeded = targetTotal - cells.length;

    for (let d = 1; d <= nextDaysNeeded; d++) {
      const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;
      const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;
      const cellDate = new Date(nextYear, nextMonth, d);
      const dateKey = `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

      cells.push({
        dayNumber: d,
        month: nextMonth,
        year: nextYear,
        isCurrentMonth: false,
        isToday:
          cellDate.getDate() === today.getDate() &&
          cellDate.getMonth() === today.getMonth() &&
          cellDate.getFullYear() === today.getFullYear(),
        dateKey,
        dateObj: cellDate,
        posts: [],
      });
    }

    // 4. Map scheduled & planned posts to corresponding calendar days
    scheduledPosts.forEach((post) => {
      if (!post.scheduledDate) return;
      const pYear = post.scheduledDate.getFullYear();
      const pMonth = post.scheduledDate.getMonth();
      const pDay = post.scheduledDate.getDate();

      const matchingCell = cells.find(
        (cell) =>
          cell.year === pYear && cell.month === pMonth && cell.dayNumber === pDay
      );
      if (matchingCell) {
        matchingCell.posts.push(post);
      }
    });

    plannedPosts.forEach((post) => {
      if (!post.plannedDate) return;
      const matchingCell = cells.find((cell) => cell.dateKey === post.plannedDate);
      if (matchingCell && !matchingCell.posts.some((existing) => existing.id === post.id)) {
        matchingCell.posts.push(post);
      }
    });

    // 5. Sort posts in cell chronologically (Scheduled first by time, then Planned)
    cells.forEach((cell) => {
      cell.posts.sort((a, b) => {
        const timeA = a.scheduledDate ? a.scheduledDate.getTime() : Number.MAX_SAFE_INTEGER;
        const timeB = b.scheduledDate ? b.scheduledDate.getTime() : Number.MAX_SAFE_INTEGER;
        return timeA - timeB;
      });
    });

    return cells;
  }, [viewYear, viewMonth, today, scheduledPosts, plannedPosts]);

  // Open Scheduler with a prefilled date
  const handleOpenScheduleForDate = (dateObj?: Date, postToSchedule?: PostItem) => {
    if (dateObj) {
      const target = new Date(dateObj);
      const now = new Date();
      if (
        target.getFullYear() === now.getFullYear() &&
        target.getMonth() === now.getMonth() &&
        target.getDate() === now.getDate()
      ) {
        target.setTime(now.getTime() + 20 * 60 * 1000);
      } else {
        target.setHours(9, 0, 0, 0);
      }

      const y = target.getFullYear();
      const m = String(target.getMonth() + 1).padStart(2, "0");
      const d = String(target.getDate()).padStart(2, "0");
      const hh = String(target.getHours()).padStart(2, "0");
      const mm = String(target.getMinutes()).padStart(2, "0");
      setSchedulingDate(`${y}-${m}-${d}T${hh}:${mm}`);
    } else {
      setSchedulingDate(undefined);
    }
    setActiveSchedulePost(postToSchedule || null);
    setIsScheduleModalOpen(true);
    setSelectedPostDetails(null);
  };

  // Direct Publish Trigger
  const handleTriggerPublish = (post: PostItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActivePublishPost(post);
    setIsPublishModalOpen(true);
    setSelectedPostDetails(null);
  };

  // Delete / Unsave post handler
  const handleDeletePost = async (postId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this post?")) {
      return;
    }

    setDeletingId(postId);
    try {
      // 1. Atomically cancel/delete on backend so server dispatch cache is evicted and in-flight Publishing states are respected
      if (postId && !postId.startsWith("local-")) {
        let handledByBackend = false;
        const currentUser = auth.currentUser;
        if (currentUser) {
          try {
            const idToken = await currentUser.getIdToken();
            const res = await fetch(`/api/posts/${encodeURIComponent(postId)}/cancel`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
              },
              body: JSON.stringify({
                userId: currentUser.uid,
                mode: "delete",
              }),
            });
            if (res.status === 409) {
              const conflictBody = await res.json().catch(() => ({}));
              setToastMessage(
                conflictBody?.error ||
                  "Publishing is already in progress or completed; this post cannot be deleted right now."
              );
              setTimeout(() => setToastMessage(null), 5000);
              return;
            }
            if (res.ok) {
              handledByBackend = true;
            }
          } catch (apiErr) {
            console.warn("[CalendarView] Backend cancel/delete unavailable, falling back to Firestore:", apiErr);
          }
        }
        if (!handledByBackend) {
          await deleteDoc(doc(db, "posts", postId));
        }
      }

      // 2. Remove from local storage cache
      const key = getLibraryKey();
      const cached = localStorage.getItem(key);
      if (cached) {
        const parsed = JSON.parse(cached);
        const updated = parsed.filter((p: any) => p.id !== postId);
        localStorage.setItem(key, JSON.stringify(updated));
      }

      // 3. Update local state
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      if (selectedPostDetails?.id === postId) {
        setSelectedPostDetails(null);
      }
      setToastMessage("Post deleted successfully.");
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err: any) {
      console.error("Failed to delete post:", err);
      setToastMessage("Failed to delete post: " + (err.message || String(err)));
      setTimeout(() => setToastMessage(null), 4000);
    } finally {
      setDeletingId(null);
    }
  };

  // Mass Removal of Published Posts
  const handleRemovePublishedPosts = async () => {
    setRemovalLoading(true);
    try {
      const publishedPosts = posts.filter((p) => p.status === "Published");
      const publishedIds = publishedPosts.map((p) => p.id);

      // 1. Immediately remove from local state
      setPosts((prev) => prev.filter((p) => p.status !== "Published"));

      // 2. Remove from local storage
      const key = getLibraryKey();
      const cached = localStorage.getItem(key);
      if (cached) {
        const parsed = JSON.parse(cached);
        const updated = parsed.filter((p: any) => !publishedIds.includes(p.id));
        localStorage.setItem(key, JSON.stringify(updated));
      }

      // 3. Remove from Firestore
      if (auth.currentUser) {
        const deletePromises = publishedPosts
          .filter((p) => !p.id.startsWith("local-"))
          .map(async (p) => {
            try {
              await deleteDoc(doc(db, "posts", p.id));
            } catch (e) {
              console.error(`Failed to delete doc ${p.id}:`, e);
            }
          });
        await Promise.all(deletePromises);
      }

      setToastMessage("All published posts cleared.");
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err) {
      console.error("Error removing published posts:", err);
    } finally {
      setRemovalLoading(false);
      setIsConfirmOpen(false);
    }
  };

  // Mass Removal / Unscheduling of All Scheduled Posts (One Click Processes All)
  const handleUnscheduleAllPosts = async () => {
    const scheduled = posts.filter(
      (p) => String(p.status || "").trim().toLowerCase() === "scheduled"
    );
    if (scheduled.length === 0 && scheduledPosts.length === 0) {
      setIsUnscheduleConfirmOpen(false);
      return;
    }

    setUnscheduleLoading(true);
    const count = scheduled.length || scheduledPosts.length;
    const isDelete = deletePermanentlyOnUnschedule;
    const currentUid = auth.currentUser?.uid || profile?.uid || "anonymous";

    try {
      // 1. Await Backend API to process all scheduled posts in database in supported write batches
      let idToken: string | undefined;
      try {
        if (auth.currentUser) {
          idToken = await auth.currentUser.getIdToken();
        }
      } catch (_) {}

      let backendSuccess = false;
      let backendProcessedCount = 0;

      try {
        const response = await fetch("/api/posts/unschedule-all", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
          },
          body: JSON.stringify({ userId: currentUid, deletePermanently: isDelete }),
        });

        if (response.ok) {
          const resData = await response.json();
          if (resData.success) {
            backendSuccess = true;
            backendProcessedCount = resData.count || 0;
          }
        }
      } catch (apiErr) {
        console.warn("Backend unschedule-all API call failed:", apiErr);
      }

      // Fallback: If backend was not reached or returned failure, process directly via client Firestore writeBatch
      if (!backendSuccess && currentUid && currentUid !== "anonymous") {
        try {
          const targetDocs = scheduled.filter((p) => !p.id.startsWith("local-"));
          const BATCH_SIZE = 400;
          for (let i = 0; i < targetDocs.length; i += BATCH_SIZE) {
            const chunk = targetDocs.slice(i, i + BATCH_SIZE);
            const batch = writeBatch(db);
            for (const p of chunk) {
              const docRef = doc(db, "posts", p.id);
              if (isDelete) {
                batch.delete(docRef);
              } else {
                batch.update(docRef, {
                  status: "Draft",
                  scheduledFor: null,
                  scheduledAt: null,
                });
              }
            }
            await batch.commit();
          }
        } catch (clientBatchErr) {
          console.error("Client writeBatch fallback error:", clientBatchErr);
        }
      }

      // 2. Clear / update localStorage cache so stale records cannot repopulate
      const key = getLibraryKey();
      try {
        const cached = localStorage.getItem(key);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            let updated;
            if (isDelete) {
              updated = parsed.filter(
                (p: any) => String(p.status || "").trim().toLowerCase() !== "scheduled"
              );
            } else {
              updated = parsed.map((p: any) => {
                if (String(p.status || "").trim().toLowerCase() === "scheduled") {
                  return {
                    ...p,
                    status: "Draft",
                    scheduledFor: null,
                    scheduledAt: null,
                    scheduledDate: null,
                  };
                }
                return p;
              });
            }
            localStorage.setItem(key, JSON.stringify(updated));
          }
        }
      } catch (cacheErr) {
        console.warn("Failed to update localStorage after unscheduling all:", cacheErr);
      }

      // 3. Immediately update React state so calendar reflects changes instantly
      if (isDelete) {
        setPosts((prev) =>
          prev.filter((p) => String(p.status || "").trim().toLowerCase() !== "scheduled")
        );
      } else {
        setPosts((prev) =>
          prev.map((p) => {
            if (String(p.status || "").trim().toLowerCase() === "scheduled") {
              return {
                ...p,
                status: "Draft",
                scheduledFor: null,
                scheduledAt: null,
                scheduledDate: null,
              };
            }
            return p;
          })
        );
      }

      const totalRemoved = Math.max(count, backendProcessedCount);
      if (isDelete) {
        setToastMessage(`Permanently deleted ${totalRemoved} scheduled post${totalRemoved === 1 ? "" : "s"} from calendar.`);
      } else {
        setToastMessage(`Unscheduled ${totalRemoved} post${totalRemoved === 1 ? "" : "s"} and removed from calendar.`);
      }
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      console.error("Error unscheduling all posts:", err);
      alert("Failed to unschedule all posts: " + (err.message || String(err)));
    } finally {
      setUnscheduleLoading(false);
      setIsUnscheduleConfirmOpen(false);
    }
  };

  // Mass Removal of All Drafts from Saved Content & Drafts
  const handleRemoveAllDrafts = async () => {
    if (draftPosts.length === 0) {
      setIsDraftsConfirmOpen(false);
      return;
    }

    setDraftsRemovalLoading(true);
    const count = draftPosts.length;
    try {
      const draftIds = new Set(draftPosts.map((p) => p.id));

      // 1. Immediately update React state
      setPosts((prev) => prev.filter((p) => !draftIds.has(p.id)));

      // 2. Immediately update local storage cache
      const key = getLibraryKey();
      const cached = localStorage.getItem(key);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            const updated = parsed.filter((p: any) => !draftIds.has(p.id));
            localStorage.setItem(key, JSON.stringify(updated));
          }
        } catch (e) {
          console.warn("Failed to update localStorage after removing drafts:", e);
        }
      }

      // 3. Delete from Firestore
      const currentUid = auth.currentUser?.uid || profile?.uid;
      if (currentUid) {
        const promises = draftPosts
          .filter((p) => !p.id.startsWith("local-"))
          .map(async (p) => {
            try {
              await deleteDoc(doc(db, "posts", p.id));
            } catch (e) {
              console.error(`Failed to delete draft doc ${p.id}:`, e);
            }
          });
        await Promise.all(promises);
      }

      // 4. Server-side batch deletion endpoint
      try {
        await fetch("/api/posts/delete-all-drafts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: currentUid }),
        });
      } catch (e) {
        // Non-blocking
      }

      setToastMessage(`Permanently deleted ${count} draft post${count === 1 ? "" : "s"} from Saved Content & Drafts.`);
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      console.error("Error removing all drafts:", err);
      alert("Failed to remove all drafts: " + (err.message || String(err)));
    } finally {
      setDraftsRemovalLoading(false);
      setIsDraftsConfirmOpen(false);
    }
  };

  // Copy thread to clipboard
  const handleCopyToClipboard = (post: PostItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const parts = post.threadParts || [post.singlePost || ""];
    const combinedText = `${post.title || "Untitled Draft"}\n\n${parts.join("\n\n---\n\n")}`;
    navigator.clipboard.writeText(combinedText)
      .then(() => {
        setCopiedId(post.id);
        setTimeout(() => setCopiedId(null), 2000);
      })
      .catch(() => {
        alert("Failed to copy to clipboard.");
      });
  };

  // In-place AI regeneration
  const handleRegeneratePost = async (post: PostItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setRegeneratingIds((prev) => ({ ...prev, [post.id]: true }));
    try {
      const effectiveTopic = post.title || post.hook || (post.singlePost || "").slice(0, 140) || "";
      const response = await fetch("/api/regenerate-single-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: (post as any).category || "trust",
          topic: effectiveTopic,
          previousHook: post.hook || "",
          offer: profile?.offer || "",
          audience: profile?.audience || "",
          desiredResult: profile?.desiredResult || "",
          writingStyle: profile?.writingStyle || "",
          rawVoice: profile?.rawVoice || undefined,
          rawBusinessText: profile?.rawBusinessText || undefined,
          customInstruction: profile?.customInstruction || undefined,
          characterLimit: 500,
          creatorIdentity: profile?.creatorIdentity,
          ctaPreferences: profile?.ctaPreferences,
          contentDestinations: profile?.contentDestinations,
          userId: auth.currentUser?.uid || profile?.uid || "anonymous",
          selectedSavedTabId: (profile as any)?.activeSavedTabId || (profile as any)?.savedTabId || undefined,
          recentLibraryPosts: posts.slice(0, 30)
        })
      });

      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }

      const dataJson = await response.json();
      const newTitle = dataJson.title || post.title;
      const newHook = dataJson.hook || "";
      const newSinglePost = dataJson.singlePost || "";
      const newThreadParts = Array.isArray(dataJson.threadParts) ? dataJson.threadParts : [newSinglePost];

      // Update state
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? {
                ...p,
                title: newTitle,
                hook: newHook,
                singlePost: newSinglePost,
                threadParts: newThreadParts
              }
            : p
        )
      );

      // Save to localStorage
      const key = getLibraryKey();
      const cached = localStorage.getItem(key);
      if (cached) {
        const parsed = JSON.parse(cached);
        const updated = parsed.map((p: any) =>
          p.id === post.id
            ? {
                ...p,
                title: newTitle,
                hook: newHook,
                singlePost: newSinglePost,
                threadParts: newThreadParts
              }
            : p
        );
        localStorage.setItem(key, JSON.stringify(updated));
      }

      // Save to Firestore
      if (!post.id.startsWith("local-") && auth.currentUser) {
        await updateDoc(doc(db, "posts", post.id), {
          title: newTitle,
          hook: newHook,
          singlePost: newSinglePost,
          threadParts: newThreadParts
        });
      }

      setToastMessage(`Regenerated draft: "${newTitle}"!`);
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err: any) {
      alert("Regeneration failed: " + (err.message || String(err)));
    } finally {
      setRegeneratingIds((prev) => ({ ...prev, [post.id]: false }));
    }
  };

  // Start inline editing
  const startEditing = (post: PostItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingId(post.id);
    setEditTitle(post.title || "Untitled Draft");
    const cleanSingle = (post.singlePost || "").trim();
    setEditSinglePost(cleanSingle);
    const parts = (post.threadParts || [post.singlePost || ""]).map((p) => typeof p === "string" ? p.trim() : "");
    setEditThreadParts(parts);
  };

  // Save inline edits
  const saveEdits = async (postId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const parts = editThreadParts.filter((p) => typeof p === "string").map((p) => p.trim());
      const mainPost = parts[0] || editSinglePost || "";
      const displayHook = mainPost.slice(0, 100) + (mainPost.length > 100 ? "..." : "");

      // Update state
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                title: editTitle,
                singlePost: mainPost,
                threadParts: parts,
                hook: displayHook
              }
            : p
        )
      );

      // Update localStorage
      const key = getLibraryKey();
      const cached = localStorage.getItem(key);
      if (cached) {
        const parsed = JSON.parse(cached);
        const updated = parsed.map((p: any) =>
          p.id === postId
            ? {
                ...p,
                title: editTitle,
                singlePost: mainPost,
                threadParts: parts,
                hook: displayHook
              }
            : p
        );
        localStorage.setItem(key, JSON.stringify(updated));
      }

      // Update Firestore
      if (!postId.startsWith("local-") && auth.currentUser) {
        await updateDoc(doc(db, "posts", postId), {
          title: editTitle,
          singlePost: mainPost,
          threadParts: parts,
          hook: displayHook
        });
      }

      setEditingId(null);
      setToastMessage("Changes saved successfully!");
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err: any) {
      alert("Failed to save changes: " + (err.message || String(err)));
    }
  };

  const formatTimeOnly = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatFullDate = (dateInput: any) => {
    try {
      if (!dateInput) return "N/A";
      const date = dateInput.toDate ? dateInput.toDate() : new Date(dateInput);
      return isNaN(date.getTime()) ? "N/A" : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch (e) {
      return "N/A";
    }
  };

  // Unified workspace action handlers for Smart Library & Weekly Planner
  const activeUserId = auth.currentUser?.uid || profile?.uid || "anonymous";

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleCanonicalCreate = async (input: {
    title: string;
    body: string;
    stage: "Idea" | "Draft" | "Ready";
    topic?: string;
    pillarTitle?: string;
    notes?: string;
  }) => {
    const saved = await saveCanonicalRecord(
      {
        title: input.title,
        singlePost: input.body,
        threadParts: [input.body],
        stage: input.stage,
        topic: input.topic || "General",
        topics: input.topic ? [input.topic] : [],
        pillarTitle: input.pillarTitle,
        notes: input.notes,
        sourceApp: "content-library",
      },
      profile
    );
    setCanonicalRecords((prev) => [saved, ...prev.filter((r) => r.id !== saved.id)]);
    setPosts((prev) => [mapCanonicalToPostItem(saved), ...prev.filter((p) => p.id !== saved.id)]);
    showToast(`Saved ${input.stage.toLowerCase()} to your Content Library.`);
  };

  const handleCanonicalUpdate = async (
    recordId: string,
    updates: Partial<CanonicalContentRecord>
  ) => {
    const updated = await updateCanonicalRecord(recordId, updates, activeUserId);
    if (updated) {
      setCanonicalRecords((prev) => prev.map((r) => (r.id === recordId ? updated : r)));
      setPosts((prev) => prev.map((p) => (p.id === recordId ? mapCanonicalToPostItem(updated) : p)));
    }
  };

  const handleCanonicalDelete = async (recordId: string) => {
    await deleteCanonicalRecord(recordId, activeUserId);
    setCanonicalRecords((prev) => prev.filter((r) => r.id !== recordId));
    setPosts((prev) => prev.filter((p) => p.id !== recordId));
    showToast("Content item removed.");
  };

  const handleAssignToDay = async (recordId: string, dateKey: string) => {
    await handleCanonicalUpdate(recordId, {
      stage: "Planned",
      status: "Planned",
      plannedDate: dateKey,
    });
    showToast(`Planned for ${dateKey}.`);
  };

  const handleUnplanRecord = async (recordId: string) => {
    await handleCanonicalUpdate(recordId, {
      stage: "Ready",
      status: "Ready",
      plannedDate: null,
    });
    showToast("Moved back to Ready drafts.");
  };

  const handleOpenScheduleCanonical = (
    rec: CanonicalContentRecord,
    preferredDateKey?: string
  ) => {
    let targetDate: Date | undefined = rec.scheduledFor ? new Date(rec.scheduledFor) : undefined;
    if (preferredDateKey && /^\d{4}-\d{2}-\d{2}$/.test(preferredDateKey)) {
      const [y, m, d] = preferredDateKey.split("-").map(Number);
      targetDate = new Date(y, m - 1, d, 9, 0, 0, 0);
    }
    handleOpenScheduleForDate(targetDate, mapCanonicalToPostItem(rec));
  };

  const handleOpenPublishCanonical = (rec: CanonicalContentRecord) => {
    handleTriggerPublish(mapCanonicalToPostItem(rec));
  };

  const handleDevelopIdea = (rec: CanonicalContentRecord) => {
    setActiveIdea({
      id: rec.id,
      title: rec.title,
      summary: rec.singlePost || rec.notes || rec.hook || rec.title,
      originalIdea: rec.singlePost || rec.title,
      pillarTitle: rec.pillarTitle,
      topic: rec.topic,
      targetPlannedDate: rec.plannedDate || undefined,
    });
    if (onNavigateToTab) onNavigateToTab("engine");
  };

  const handleCreateForDay = (params: {
    dateKey: string;
    title?: string;
    topic?: string;
    pillarTitle?: string;
    summary?: string;
    sourceIdeaId?: string;
  }) => {
    setActiveIdea({
      id: params.sourceIdeaId,
      title: params.title || `Post for ${params.dateKey}`,
      summary: params.summary || `Create a Threads post planned for ${params.dateKey}.`,
      originalIdea: params.topic || params.title || `Weekly plan post (${params.dateKey})`,
      pillarTitle: params.pillarTitle,
      topic: params.topic,
      targetPlannedDate: params.dateKey,
    });
    if (onNavigateToTab) onNavigateToTab("engine");
  };

  const handleRecommendationAction = (rec: SmartRecommendation) => {
    switch (rec.actionType) {
      case "filter_ready":
        setSubView("library");
        setLibraryOnlyDuplicates(false);
        setLibraryStageFilter("Ready");
        break;
      case "filter_drafts":
        setSubView("library");
        setLibraryOnlyDuplicates(false);
        setLibraryStageFilter("Draft");
        break;
      case "filter_failed":
        setSubView("library");
        setLibraryOnlyDuplicates(false);
        setLibraryStageFilter("Failed");
        break;
      case "filter_duplicates":
        setSubView("library");
        setLibraryOnlyDuplicates(true);
        break;
      case "filter_topic":
        setSubView("library");
        setLibraryOnlyDuplicates(false);
        setLibraryStageFilter("all");
        if (rec.targetTopic) setLibraryTopicFilter(rec.targetTopic);
        break;
      case "open_weekly_day":
        setSubView("weekly");
        break;
      case "develop_idea": {
        const ideaRec = canonicalRecords.find((r) => r.id === rec.targetRecordId);
        if (ideaRec) {
          handleDevelopIdea(ideaRec);
        } else {
          setSubView("library");
          setLibraryStageFilter("Idea");
        }
        break;
      }
      case "create_for_pillar":
        handleCreateForDay({
          dateKey: formatLocalDateKey(new Date()),
          title: rec.targetPillar ? `${rec.targetPillar} Post` : "New Pillar Post",
          pillarTitle: rec.targetPillar,
          topic: rec.targetPillar,
          summary: `Create a Threads post covering your "${rec.targetPillar || "Core"}" pillar.`,
        });
        break;
      default:
        setSubView("weekly");
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12" id="threadsworks-calendar-engine">
      {/* ----------------------------------------------------------------- */}
      {/* 1. TOP HEADER WITH VIEW SWITCHER, META STATUS & PRIMARY ACTIONS */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-border-primary">
        {/* Left Title & View Switcher */}
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <h1 className="!text-left !mx-0 text-2xl font-extrabold tracking-tight text-text-primary font-sans flex items-center gap-2">
              <CalendarIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              <span>Content Planning &amp; Library</span>
            </h1>
            <p className="!text-left !mx-0 text-xs text-text-secondary mt-0.5 font-medium">
              Organize ideas &amp; drafts, plan your 7-day week, and schedule posts directly to Meta Threads.
            </p>
          </div>

          {/* Sub-view switcher tabs */}
          <div className="inline-flex flex-wrap items-center rounded-xl border border-border-primary bg-bg-card p-1 shadow-sm gap-0.5">
            <button
              id="calendar-subview-weekly-btn"
              onClick={() => setSubView("weekly")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                subView === "weekly"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-card-hover"
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Weekly Plan</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${subView === "weekly" ? "bg-white/20 text-white" : "bg-bg-app text-text-muted"}`}>
                {plannedPosts.length + scheduledPosts.length}
              </span>
            </button>

            <button
              id="calendar-subview-grid-btn"
              onClick={() => setSubView("calendar")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                subView === "calendar"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-card-hover"
              }`}
            >
              <Grid className="h-3.5 w-3.5" />
              <span>Month Calendar</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${subView === "calendar" ? "bg-white/20 text-white" : "bg-bg-app text-text-muted"}`}>
                {scheduledPosts.length}
              </span>
            </button>

            <button
              id="calendar-subview-library-btn"
              onClick={() => setSubView("library")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                subView === "library"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-card-hover"
              }`}
            >
              <List className="h-3.5 w-3.5" />
              <span>Content Library</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${subView === "library" ? "bg-white/20 text-white" : "bg-bg-app text-text-muted"}`}>
                {canonicalRecords.length}
              </span>
            </button>

            <button
              id="calendar-subview-memory-btn"
              onClick={() => setSubView("memory")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                subView === "memory"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-card-hover"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Intelligent Memory</span>
            </button>
          </div>
        </div>

        {/* Right Actions & Meta Account Status */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Threads Connection Status Badge */}
          {connection.connected ? (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Connected: @{connection.username || "threads_user"}</span>
              <button
                onClick={handleConnectThreads}
                className="text-[10px] text-text-secondary hover:text-text-primary underline ml-1 cursor-pointer font-normal"
                title="Switch or reconnect Threads account"
              >
                Switch
              </button>
            </div>
          ) : (
            <ThreadsConnectButton 
              returnTo="/calendar"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 text-xs font-bold transition cursor-pointer"
              icon={<Sparkles className="h-3.5 w-3.5" />}
            />
          )}

          {/* Primary Action Button */}
          <button
            id="calendar-top-schedule-btn"
            onClick={() => handleOpenScheduleForDate()}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-md transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Schedule Post</span>
          </button>
        </div>
      </div>

      {/* Error Alert if any */}
      {error && (
        <div className="rounded-xl border border-status-danger-border bg-status-danger-bg p-3.5 flex items-start gap-2.5 text-xs text-status-danger-text font-medium">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <p className="!text-left !mx-0">{error}</p>
        </div>
      )}

      {/* Grounded Smart Recommendations & Lifecycle Strip (across Planning, Calendar & Library) */}
      {subView !== "memory" && (
        <SmartRecommendationsBar
          records={canonicalRecords}
          profile={profile}
          onSelectStageFilter={(stage) => {
            setSubView("library");
            setLibraryOnlyDuplicates(false);
            setLibraryStageFilter(stage);
          }}
          onRecommendationAction={handleRecommendationAction}
        />
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 1.5 SUB-VIEW: 7-DAY WEEKLY CONTENT PLANNER */}
      {/* ----------------------------------------------------------------- */}
      {subView === "weekly" && (
        <WeeklyPlannerWorkspace
          records={canonicalRecords}
          userId={activeUserId}
          profile={profile}
          onAssignToDay={handleAssignToDay}
          onUnplanRecord={handleUnplanRecord}
          onOpenSchedule={handleOpenScheduleCanonical}
          onOpenPublish={handleOpenPublishCanonical}
          onCreateForDay={handleCreateForDay}
        />
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 2. SUB-VIEW: CALENDAR MONTH GRID VIEW */}
      {/* ----------------------------------------------------------------- */}
      {subView === "calendar" && (
        <div className="space-y-6">
          {/* Calendar Month Navigation Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-bg-card p-3 rounded-2xl border border-border-primary">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center rounded-lg border border-border-primary bg-bg-app p-1 shadow-sm">
                <button
                  id="calendar-grid-prev-btn"
                  onClick={handlePreviousMonth}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-bg-card rounded-md transition cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>Prev</span>
                </button>

                <button
                  id="calendar-grid-today-btn"
                  onClick={handleToday}
                  className="px-3 py-1.5 text-xs font-semibold text-text-primary hover:bg-bg-card rounded-md transition cursor-pointer border-x border-border-primary"
                >
                  Today
                </button>

                <button
                  id="calendar-grid-next-btn"
                  onClick={handleNextMonth}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-bg-card rounded-md transition cursor-pointer"
                >
                  <span>Next</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-text-primary font-sans">
                {currentMonthDisplay}
              </h2>
            </div>

            {/* Right Calendar Grid Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                id="calendar-unschedule-all-btn"
                onClick={() => {
                  setDeletePermanentlyOnUnschedule(false);
                  setIsUnscheduleConfirmOpen(true);
                }}
                disabled={scheduledPosts.length === 0 || unscheduleLoading}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition cursor-pointer ${
                  scheduledPosts.length === 0
                    ? "opacity-50 border-border-primary bg-bg-app text-text-muted cursor-not-allowed"
                    : "border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400"
                }`}
                title={
                  scheduledPosts.length === 0
                    ? "No posts currently scheduled"
                    : "Unschedule all posts and remove them from the calendar"
                }
              >
                {unscheduleLoading ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CalendarX className="h-3.5 w-3.5" />
                )}
                <span>Remove All Scheduled</span>
                <span className="text-[10px] bg-amber-500/20 px-1.5 rounded-full font-mono">
                  {scheduledPosts.length}
                </span>
              </button>

              <button
                onClick={() => setIsDraftsTrayOpen(!isDraftsTrayOpen)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition cursor-pointer ${
                  isDraftsTrayOpen
                    ? "border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400"
                    : "border-border-primary bg-bg-app text-text-secondary hover:text-text-primary"
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>{isDraftsTrayOpen ? "Hide Unscheduled Tray" : "Show Unscheduled Tray"}</span>
                <span className="text-[10px] bg-purple-500/20 px-1.5 rounded-full font-mono">
                  {unscheduledDrafts.length}
                </span>
              </button>
            </div>
          </div>

          {/* 7-Column Month Matrix Grid */}
          <div className="rounded-2xl border border-border-primary bg-bg-card overflow-hidden shadow-sm">
            {/* Days Header */}
            <div className="grid grid-cols-7 border-b border-border-primary bg-bg-sidebar/50 text-center text-xs font-bold text-text-secondary uppercase tracking-wider py-2.5">
              {DAYS_OF_WEEK.map((day) => (
                <div key={day} className="py-1">
                  <span className="hidden sm:inline">{day}</span>
                  <span className="sm:hidden">{day.slice(0, 1)}</span>
                </div>
              ))}
            </div>

            {/* Matrix Cells */}
            <div className="grid grid-cols-7 divide-x divide-y divide-border-primary auto-rows-fr bg-bg-card">
              {calendarGrid.map((cell, index) => {
                const hasPosts = cell.posts.length > 0;

                return (
                  <div
                    key={index}
                    onClick={() => handleOpenScheduleForDate(cell.dateObj)}
                    className={`group relative min-h-[110px] sm:min-h-[140px] p-1.5 sm:p-2.5 flex flex-col justify-between transition hover:bg-bg-card-hover/60 cursor-pointer ${
                      !cell.isCurrentMonth
                        ? "bg-bg-app/40 text-text-muted opacity-60"
                        : "text-text-primary"
                    } ${cell.isToday ? "ring-1 ring-inset ring-purple-500/50 bg-purple-500/[0.03]" : ""}`}
                  >
                    {/* Cell Day Number & Hover Schedule Action */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                          cell.isToday
                            ? "bg-purple-600 text-white font-bold"
                            : cell.isCurrentMonth
                            ? "text-text-primary"
                            : "text-text-muted"
                        }`}
                      >
                        {cell.dayNumber}
                      </span>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenScheduleForDate(cell.dateObj);
                        }}
                        title={`Schedule post for ${cell.dateKey}`}
                        className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-purple-600 dark:hover:text-purple-400 rounded transition cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Posts in Cell */}
                    <div className="mt-1.5 space-y-1 overflow-y-auto max-h-[85px] sm:max-h-[100px] pr-0.5">
                      {cell.posts.map((post) => {
                        const isPlanned = post.stage === "Planned" && !post.scheduledDate;
                        const timeLabel = post.scheduledDate ? formatTimeOnly(post.scheduledDate) : isPlanned ? "Planned" : "";
                        const partCount = post.threadParts?.length || 1;
                        const isMissed = String(post.status).trim().toLowerCase() === "missed";

                        return (
                          <div
                            key={post.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPostDetails(post);
                            }}
                            className={
                              isMissed
                                ? "group/item rounded-lg border border-status-danger-border bg-status-danger-bg hover:bg-red-100 dark:hover:bg-red-500/20 p-1.5 transition text-left cursor-pointer space-y-0.5"
                                : isPlanned
                                ? "group/item rounded-lg border border-status-warning-border bg-status-warning-bg hover:bg-amber-100 dark:hover:bg-amber-500/20 p-1.5 transition text-left cursor-pointer space-y-0.5"
                                : "group/item rounded-lg border border-brand-border bg-brand-surface/70 dark:bg-purple-500/10 hover:bg-brand-surface-hover dark:hover:bg-purple-500/25 p-1.5 transition text-left cursor-pointer space-y-0.5"
                            }
                          >
                            <div
                              className={
                                isMissed
                                  ? "flex items-center justify-between text-[10px] font-mono font-bold text-status-danger-text"
                                  : isPlanned
                                  ? "flex items-center justify-between text-[10px] font-mono font-bold text-status-warning-text"
                                  : "flex items-center justify-between text-[10px] font-mono font-bold text-brand-text-strong"
                              }
                            >
                              <span className="flex items-center gap-1">
                                <Clock className="h-2.5 w-2.5" />
                                {timeLabel}
                              </span>
                              {partCount > 1 && (
                                <span
                                  className={
                                    isMissed
                                      ? "text-[9px] bg-red-200/70 dark:bg-red-500/20 px-1 rounded font-sans font-semibold text-status-danger-text"
                                      : isPlanned
                                      ? "text-[9px] bg-amber-200/70 dark:bg-amber-500/20 px-1 rounded font-sans font-semibold text-status-warning-text"
                                      : "text-[9px] bg-purple-200/80 dark:bg-purple-500/20 px-1 rounded font-sans font-semibold text-brand-text-strong"
                                  }
                                >
                                  {partCount}p
                                </span>
                              )}
                            </div>
                            <p className="!text-left !mx-0 text-[11px] font-medium text-text-primary line-clamp-1 leading-tight font-sans">
                              {isMissed ? `⚠️ [MISSED] ${post.title || post.hook || post.singlePost}` : (post.title || post.hook || post.singlePost)}
                            </p>
                          </div>
                        );
                      })}
                    </div>

                    {/* Cell Footer */}
                    <div className="mt-auto pt-1 flex justify-end">
                      {hasPosts && (
                        <span className="text-[9px] font-mono text-text-muted">
                          {cell.posts.length} {cell.posts.length === 1 ? "post" : "posts"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* --------------------------------------------------------------- */}
          {/* UNSCHEDULED DRAFTS TRAY (Quick Add to Calendar) */}
          {/* --------------------------------------------------------------- */}
          {isDraftsTrayOpen && (
            <div className="rounded-2xl border border-border-primary bg-bg-card p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-border-primary pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                    <Layers className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-text-primary font-sans">Unscheduled Drafts & Ideas</h3>
                    <p className="text-[11px] text-text-secondary">Ready to be scheduled onto the calendar or published directly to Threads.</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {unscheduledDrafts.length > 0 && (
                    <button
                      id="tray-clear-all-drafts-btn"
                      onClick={() => setIsDraftsConfirmOpen(true)}
                      disabled={draftsRemovalLoading}
                      className="inline-flex items-center gap-1 text-xs font-bold text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 px-2.5 py-1 rounded-lg transition cursor-pointer border border-rose-500/20"
                      title="Permanently remove all unscheduled drafts"
                    >
                      {draftsRemovalLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Trash className="h-3 w-3" />}
                      <span>Clear Drafts ({unscheduledDrafts.length})</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (onNavigateToTab) onNavigateToTab("engine");
                    }}
                    className="inline-flex items-center gap-1 text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Create New Draft</span>
                  </button>
                </div>
              </div>

              {unscheduledDrafts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {unscheduledDrafts.map((draft) => (
                    <div
                      key={draft.id}
                      className="p-3.5 rounded-xl border border-border-primary bg-bg-app hover:border-purple-500/30 transition flex flex-col justify-between gap-3 group"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">
                            {draft.topic || "Draft"}
                          </span>
                          <span className="text-[10px] font-mono text-text-muted">
                            {draft.threadParts?.length || 1} Part{(draft.threadParts?.length || 1) > 1 ? "s" : ""}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-text-primary line-clamp-1 font-sans mt-1">
                          {draft.title || "Untitled Draft"}
                        </h4>
                        <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">
                          {draft.hook || draft.singlePost}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-border-primary/60">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleTriggerPublish(draft)}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-500/10 rounded-lg transition cursor-pointer"
                            title="Publish immediately to Threads"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => startEditing(draft)}
                            className="p-1.5 text-blue-600 hover:bg-blue-500/10 rounded-lg transition cursor-pointer"
                            title="Edit Draft"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeletePost(draft.id)}
                            className="p-1.5 text-red-600 hover:bg-red-500/10 rounded-lg transition cursor-pointer"
                            title="Delete Draft"
                          >
                            <Trash className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <button
                          onClick={() => handleOpenScheduleForDate(undefined, draft)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition cursor-pointer shadow-sm"
                        >
                          <CalendarIcon className="h-3 w-3" />
                          <span>Schedule</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 border border-dashed border-border-primary rounded-xl">
                  <p className="text-xs text-text-muted">No unscheduled drafts right now.</p>
                  <button
                    onClick={() => {
                      if (onNavigateToTab) onNavigateToTab("engine");
                    }}
                    className="mt-2 text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
                  >
                    Generate new posts in Content Engine →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 3. SUB-VIEW: SMART CONTENT LIBRARY WORKSPACE */}
      {/* ----------------------------------------------------------------- */}
      {subView === "library" && (
        <div className="space-y-4" id="library-integrated-view">
          <ContentLibraryWorkspace
            records={canonicalRecords}
            userId={activeUserId}
            profile={profile}
            stageFilter={libraryStageFilter}
            onStageFilterChange={setLibraryStageFilter}
            topicFilter={libraryTopicFilter}
            onTopicFilterChange={setLibraryTopicFilter}
            pillarFilter={libraryPillarFilter}
            onPillarFilterChange={setLibraryPillarFilter}
            onlyDuplicates={libraryOnlyDuplicates}
            onOnlyDuplicatesChange={setLibraryOnlyDuplicates}
            onCreateRecord={handleCanonicalCreate}
            onUpdateRecord={handleCanonicalUpdate}
            onDeleteRecord={handleCanonicalDelete}
            onOpenSchedule={handleOpenScheduleCanonical}
            onOpenPublish={handleOpenPublishCanonical}
            onDevelopIdea={handleDevelopIdea}
          />

          {/* Compact Bulk Cleanup Utilities */}
          {(draftPosts.length > 0 || scheduledPosts.length > 0 || hasPublishedPosts) && (
            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-border-primary/60">
              {draftPosts.length > 0 && (
                <button
                  id="library-clear-all-drafts-btn"
                  onClick={() => setIsDraftsConfirmOpen(true)}
                  disabled={draftsRemovalLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition border cursor-pointer text-status-danger-text bg-status-danger-bg border-status-danger-border hover:bg-red-100 dark:hover:bg-rose-500/15"
                >
                  {draftsRemovalLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Trash className="h-3 w-3" />}
                  <span>Clear Drafts ({draftPosts.length})</span>
                </button>
              )}
              {scheduledPosts.length > 0 && (
                <button
                  id="library-unschedule-all-btn"
                  onClick={() => {
                    setDeletePermanentlyOnUnschedule(false);
                    setIsUnscheduleConfirmOpen(true);
                  }}
                  disabled={unscheduleLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition border cursor-pointer text-status-warning-text bg-status-warning-bg border-status-warning-border hover:bg-amber-100 dark:hover:bg-amber-500/15"
                >
                  {unscheduleLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <CalendarX className="h-3 w-3" />}
                  <span>Unschedule All ({scheduledPosts.length})</span>
                </button>
              )}
              {hasPublishedPosts && (
                <button
                  onClick={() => setIsConfirmOpen(true)}
                  disabled={removalLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition border cursor-pointer text-status-danger-text bg-status-danger-bg border-status-danger-border hover:bg-red-100 dark:hover:bg-red-500/15"
                >
                  {removalLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Trash className="h-3 w-3" />}
                  <span>Clear Published</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 4. SUB-VIEW: INTELLIGENT CONTENT MEMORY */}
      {/* ----------------------------------------------------------------- */}
      {subView === "memory" && (
        <IntelligentContentMemoryView
          profile={profile}
          onNavigateToTab={onNavigateToTab}
          onLaunchComposerWithIdea={(payload) => {
            if (onNavigateToTab) {
              onNavigateToTab("engine");
            }
          }}
        />
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 4. MODALS: POST DETAILS PREVIEW MODAL */}
      {/* ----------------------------------------------------------------- */}
      {selectedPostDetails && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
          onClick={() => setSelectedPostDetails(null)}
        >
          <div
            className="relative w-full max-w-lg rounded-2xl border border-border-primary bg-bg-card p-6 shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-border-primary">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text-primary font-sans">
                    Scheduled Post Details
                  </h3>
                  {selectedPostDetails.scheduledDate && (
                    <p className="text-[11px] font-mono text-purple-600 dark:text-purple-400 font-semibold">
                      {selectedPostDetails.scheduledDate.toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}{" "}
                      at {formatTimeOnly(selectedPostDetails.scheduledDate)}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelectedPostDetails(null)}
                className="text-text-muted hover:text-text-primary p-1 rounded-lg transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Overdue/Missed Post Warning Banner */}
            {selectedPostDetails && String(selectedPostDetails.status).trim().toLowerCase() === "missed" && (
              <div className="rounded-xl border border-status-danger-border bg-status-danger-bg p-3.5 flex items-start gap-2.5 text-xs text-status-danger-text animate-fade-in">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="text-left">
                  <p className="!text-left !mx-0 font-bold">Missed Publishing Window</p>
                  <p className="!text-left !mx-0 text-[11px] mt-0.5 leading-snug">
                    This post missed its scheduled time. Reschedule it or publish it now.
                  </p>
                </div>
              </div>
            )}

            {/* Title */}
            <div>
              <span className="text-[10px] font-mono uppercase font-bold text-text-muted block mb-1">
                Title / Topic
              </span>
              <p className="text-sm font-bold text-text-primary font-sans">
                {selectedPostDetails.title}
              </p>
            </div>

            {/* Content Thread Preview */}
            <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
              <span className="text-[10px] font-mono uppercase font-bold text-text-muted block">
                Thread Content ({selectedPostDetails.threadParts?.length || 1} parts)
              </span>

              {(selectedPostDetails.threadParts || [selectedPostDetails.singlePost]).map(
                (part, i) => (
                  <div
                    key={i}
                    className="rounded-xl bg-bg-app p-3.5 border border-border-primary space-y-1"
                  >
                    <span className="text-[10px] font-mono font-bold text-text-muted">
                      PART {i + 1}
                    </span>
                    <p className="text-xs text-text-primary whitespace-pre-wrap leading-relaxed font-sans">
                      {part}
                    </p>
                  </div>
                )
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-border-primary">
              <button
                type="button"
                onClick={() => handleDeletePost(selectedPostDetails.id)}
                disabled={deletingId === selectedPostDetails.id}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition cursor-pointer"
              >
                {deletingId === selectedPostDetails.id ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                <span>Cancel Schedule</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleTriggerPublish(selectedPostDetails)}
                  className="inline-flex items-center gap-1 px-3 py-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg transition cursor-pointer"
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  <span>Publish Now</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenScheduleForDate(selectedPostDetails.scheduledDate || undefined, selectedPostDetails)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-lg shadow-sm transition cursor-pointer"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  <span>Reschedule</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 5. MODALS: SCHEDULE POST MODAL */}
      {/* ----------------------------------------------------------------- */}
      <ScheduleModal
        isOpen={isScheduleModalOpen}
        onClose={() => {
          setIsScheduleModalOpen(false);
          setActiveSchedulePost(null);
        }}
        postText={activeSchedulePost ? activeSchedulePost.singlePost : ""}
        parts={activeSchedulePost ? activeSchedulePost.threadParts : undefined}
        postId={activeSchedulePost ? activeSchedulePost.id : undefined}
        title={activeSchedulePost ? activeSchedulePost.title : undefined}
        topic={activeSchedulePost ? activeSchedulePost.topic : undefined}
        topics={activeSchedulePost ? activeSchedulePost.topics : undefined}
        pillarTitle={activeSchedulePost ? activeSchedulePost.pillarTitle : undefined}
        sourceIdeaId={activeSchedulePost ? activeSchedulePost.sourceIdeaId : undefined}
        initialDateTime={schedulingDate}
        profile={profile}
        subscriptionStatus={subscriptionStatus}
        onSuccess={() => {
          setIsScheduleModalOpen(false);
          setActiveSchedulePost(null);
          invalidateCanonicalCache(activeUserId);
          fetchAllPosts(true);
          setToastMessage("Post scheduled successfully onto Calendar!");
          setTimeout(() => setToastMessage(null), 3500);
        }}
        onNavigateToTab={onNavigateToTab}
      />

      {/* ----------------------------------------------------------------- */}
      {/* 6. MODALS: PUBLISH NOW TO META THREADS MODAL */}
      {/* ----------------------------------------------------------------- */}
      {activePublishPost && (
        <PublishModal
          isOpen={isPublishModalOpen}
          onClose={() => {
            setIsPublishModalOpen(false);
            setActivePublishPost(null);
            fetchAllPosts();
          }}
          postText={activePublishPost.singlePost || ""}
          parts={activePublishPost.threadParts || [activePublishPost.singlePost || ""]}
          userId={auth.currentUser?.uid || profile?.uid || ""}
          postId={activePublishPost.id}
          onNavigateToTab={onNavigateToTab}
        />
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 7. MODALS: CONFIRM REMOVAL / UNSCHEDULING OF ALL SCHEDULED POSTS */}
      {/* ----------------------------------------------------------------- */}
      {isUnscheduleConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md rounded-2xl border border-border-primary bg-bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-border-primary">
              <div className="h-7 w-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                <CalendarX className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider font-sans">
                Remove All Scheduled Posts
              </h3>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed">
              Are you sure you want to remove all <strong className="text-text-primary">{scheduledPosts.length}</strong> scheduled posts? This will unschedule all posts and immediately clear them from your calendar grid.
            </p>

            <div className="p-3 rounded-xl bg-bg-app border border-border-primary space-y-2">
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="radio"
                  name="unschedule-mode"
                  checked={!deletePermanentlyOnUnschedule}
                  onChange={() => setDeletePermanentlyOnUnschedule(false)}
                  className="mt-0.5 text-purple-600 focus:ring-purple-500"
                />
                <div>
                  <span className="text-xs font-bold text-text-primary block">
                    Unschedule & keep as drafts (Recommended)
                  </span>
                  <span className="text-[11px] text-text-muted">
                    Removes posts from the calendar while preserving your written content in your saved drafts library.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer select-none pt-2 border-t border-border-primary/50">
                <input
                  type="radio"
                  name="unschedule-mode"
                  checked={deletePermanentlyOnUnschedule}
                  onChange={() => setDeletePermanentlyOnUnschedule(true)}
                  className="mt-0.5 text-red-600 focus:ring-red-500"
                />
                <div>
                  <span className="text-xs font-bold text-red-500 block">
                    Permanently delete scheduled posts
                  </span>
                  <span className="text-[11px] text-text-muted">
                    Completely deletes these posts from both the calendar and your content library.
                  </span>
                </div>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setIsUnscheduleConfirmOpen(false)}
                className="rounded-xl border border-border-primary bg-bg-app hover:bg-bg-card-hover text-text-secondary hover:text-text-primary font-semibold px-4 py-2 text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="confirm-unschedule-all-btn"
                onClick={handleUnscheduleAllPosts}
                disabled={unscheduleLoading}
                className={`rounded-xl font-bold px-4 py-2 text-xs transition cursor-pointer flex items-center gap-1.5 text-white ${
                  deletePermanentlyOnUnschedule
                    ? "bg-red-600 hover:bg-red-500 disabled:opacity-50"
                    : "bg-amber-600 hover:bg-amber-500 disabled:opacity-50"
                }`}
              >
                {unscheduleLoading && <RefreshCw className="h-3 w-3 animate-spin" />}
                <span>
                  {deletePermanentlyOnUnschedule
                    ? `Delete All (${scheduledPosts.length})`
                    : `Unschedule All (${scheduledPosts.length})`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 8. MODALS: CONFIRM REMOVAL OF ALL DRAFTS */}
      {/* ----------------------------------------------------------------- */}
      {isDraftsConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md rounded-2xl border border-border-primary bg-bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-border-primary">
              <div className="h-7 w-7 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-500">
                <Trash className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider font-sans">
                Remove All Drafts
              </h3>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed">
              Are you sure you want to delete all <strong className="text-text-primary">{draftPosts.length}</strong> unscheduled drafts from your Saved Content and Drafts? This action cannot be undone.
            </p>

            <div className="p-3 rounded-xl bg-bg-app border border-border-primary text-[11px] text-text-muted">
              <p className="text-text-secondary">
                Scheduled and published posts will <strong>not</strong> be affected. Only unscheduled draft threads will be cleared.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setIsDraftsConfirmOpen(false)}
                className="rounded-xl border border-border-primary bg-bg-app hover:bg-bg-card-hover text-text-secondary hover:text-text-primary font-semibold px-4 py-2 text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="confirm-remove-all-drafts-btn"
                onClick={handleRemoveAllDrafts}
                disabled={draftsRemovalLoading}
                className="rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold px-4 py-2 text-xs transition cursor-pointer flex items-center gap-1.5"
              >
                {draftsRemovalLoading && <RefreshCw className="h-3 w-3 animate-spin" />}
                <span>Delete All Drafts ({draftPosts.length})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 9. MODALS: CONFIRM REMOVAL OF PUBLISHED POSTS */}
      {/* ----------------------------------------------------------------- */}
      {isConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md rounded-2xl border border-border-primary bg-bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-border-primary">
              <div className="h-7 w-7 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500">
                <Trash className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider font-sans">
                Clear Published Posts
              </h3>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed">
              Are you sure you want to clear all published posts from your saved list? This will remove already-published entries to keep your workspace clean.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setIsConfirmOpen(false)}
                className="rounded-xl border border-border-primary bg-bg-app hover:bg-bg-card-hover text-text-secondary hover:text-text-primary font-semibold px-4 py-2 text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleRemovePublishedPosts}
                disabled={removalLoading}
                className="rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold px-4 py-2 text-xs transition cursor-pointer flex items-center gap-1.5"
              >
                {removalLoading && <RefreshCw className="h-3 w-3 animate-spin" />}
                <span>Clear Published Posts</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 8. SUCCESS TOAST NOTIFICATION */}
      {/* ----------------------------------------------------------------- */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-bg-card border border-border-primary text-text-primary px-4 py-3 rounded-2xl shadow-2xl animate-fade-in">
          <div className="h-5 w-5 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center">
            <Check className="h-3.5 w-3.5" />
          </div>
          <span className="text-xs font-bold font-sans">{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-text-muted hover:text-text-primary ml-2 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

