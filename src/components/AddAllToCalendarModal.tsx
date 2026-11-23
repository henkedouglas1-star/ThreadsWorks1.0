import React, { useState, useEffect } from "react";
import { X, Calendar, Clock, Sparkles, CheckCircle2, AlertCircle, RefreshCw, ArrowRight } from "lucide-react";
import { GeneratedPost } from "../context/ContentPersistenceContext";
import { db, auth, withTimeout, handleFirestoreError, OperationType, sanitizeForFirestore } from "../firebase";
import { collection, doc, setDoc, query, where, getDocs, addDoc, Timestamp, limit } from "firebase/firestore";
import {
  isLocalOnlyId,
  formatLocalDateKey,
  normalizeTopicsList,
  emitContentUpdatedEvent,
  invalidateCanonicalCache,
} from "../lib/canonicalContent";

interface AddAllToCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  posts: GeneratedPost[];
  category?: string;
  onNavigateToTab?: (tab: string) => void;
  onSuccess?: (count: number) => void;
}

export default function AddAllToCalendarModal({
  isOpen,
  onClose,
  posts,
  category = "general",
  onNavigateToTab,
  onSuccess
}: AddAllToCalendarModalProps) {
  const [startDate, setStartDate] = useState<string>("");
  const [postingTime, setPostingTime] = useState<string>("09:00");
  const [alreadyScheduledIds, setAlreadyScheduledIds] = useState<Set<string>>(new Set());
  const [checkingDuplicates, setCheckingDuplicates] = useState<boolean>(true);

  // Operation state
  const [statusState, setStatusState] = useState<"idle" | "saving" | "success" | "partial" | "failed">("idle");
  const [scheduledCount, setScheduledCount] = useState<number>(0);
  const [failedCount, setFailedCount] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Default start date & time setup
  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      const defaultTimeStr = "09:00";
      const [hours, minutes] = defaultTimeStr.split(":").map(Number);
      
      const todayPostingTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
      const defaultDate = new Date(now);
      
      if (todayPostingTime.getTime() <= now.getTime()) {
        // Today's 09:00 AM has already passed, default to tomorrow
        defaultDate.setDate(now.getDate() + 1);
      }
      
      const yyyy = defaultDate.getFullYear();
      const mm = String(defaultDate.getMonth() + 1).padStart(2, "0");
      const dd = String(defaultDate.getDate()).padStart(2, "0");
      
      setStartDate(`${yyyy}-${mm}-${dd}`);
      setPostingTime(defaultTimeStr);
      setStatusState("idle");
      setErrorMessage("");
      setScheduledCount(0);
      setFailedCount(0);
      checkExistingScheduled();
    }
  }, [isOpen, posts]);

  // Check which posts in the current batch are already scheduled
  const checkExistingScheduled = async () => {
    setCheckingDuplicates(true);
    const userId = auth.currentUser?.uid || "anonymous";
    const scheduled = new Set<string>();

    try {
      // 1. Check local offline storage library
      const libraryKey = `threads_saved_offline_library_${userId}`;
      const raw = localStorage.getItem(libraryKey);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.forEach((item: any) => {
              if (item.status === "Scheduled") {
                if (item.sourcePostId) scheduled.add(item.sourcePostId);
                if (item.id) scheduled.add(item.id);
                if (item.singlePost) scheduled.add(item.singlePost.trim());
              }
            });
          }
        } catch (e) {
          // ignore parsing error
        }
      }

      // 2. Query Firestore if online (bounded to 50 items)
      if (userId && userId !== "anonymous") {
        const postsRef = collection(db, "posts");
        const q = query(
          postsRef, 
          where("userId", "==", userId),
          where("status", "==", "Scheduled"),
          limit(50)
        );
        const snapshot = await withTimeout(getDocs(q), 4000, false).catch((err) => {
          handleFirestoreError(err, OperationType.LIST, "posts");
          return null;
        });
        if (snapshot && !snapshot.empty) {
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.status === "Scheduled") {
              if (data.sourcePostId) scheduled.add(data.sourcePostId);
              if (docSnap.id) scheduled.add(docSnap.id);
              if (data.singlePost) scheduled.add(data.singlePost.trim());
            }
          });
        }
      }
    } catch (err) {
      console.warn("Could not check duplicate scheduled posts:", err);
    }

    // Match posts
    const matchedIds = new Set<string>();
    posts.forEach((p) => {
      const single = (p.threadParts?.[0] || p.singlePost || "").trim();
      if (scheduled.has(p.id) || (p.savedRecordId && scheduled.has(p.savedRecordId)) || scheduled.has(single)) {
        matchedIds.add(p.id);
      }
    });

    setAlreadyScheduledIds(matchedIds);
    setCheckingDuplicates(false);
  };

  if (!isOpen) return null;

  // Filter posts to add
  const unscheduledPosts = posts.filter((p) => !alreadyScheduledIds.has(p.id));
  const totalPostsCount = posts.length;
  const unscheduledCount = unscheduledPosts.length;
  const alreadyScheduledCount = alreadyScheduledIds.size;
  const isAllAlreadyScheduled = totalPostsCount > 0 && unscheduledCount === 0;

  // Parse start date & calculate end date
  const computeDates = () => {
    if (!startDate || !postingTime) {
      return { startDateObj: new Date(), endDateObj: new Date(), formattedStart: "", formattedEnd: "", formattedTime: "" };
    }

    const [year, month, day] = startDate.split("-").map((n) => parseInt(n, 10));
    const [hours, minutes] = postingTime.split(":").map((n) => parseInt(n, 10));

    const startDateObj = new Date(year, month - 1, day, hours, minutes, 0, 0);

    // End date is (unscheduledCount - 1) days after start date
    const daysOffset = Math.max(0, unscheduledCount - 1);
    const endDateObj = new Date(year, month - 1, day + daysOffset, hours, minutes, 0, 0);

    const formatOptions: Intl.DateTimeFormatOptions = { month: "long", day: "numeric", year: "numeric" };
    const formattedStart = startDateObj.toLocaleDateString("en-US", formatOptions);
    const formattedEnd = endDateObj.toLocaleDateString("en-US", formatOptions);

    // Format time e.g. "9:00 AM"
    const timeOptions: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit", hour12: true };
    const formattedTime = startDateObj.toLocaleTimeString("en-US", timeOptions);

    return { startDateObj, endDateObj, formattedStart, formattedEnd, formattedTime };
  };

  const { formattedStart, formattedEnd, formattedTime } = computeDates();

  // Handle batch scheduling
  const handleConfirmAddAll = async (e: React.FormEvent) => {
    e.preventDefault();

    if (unscheduledCount === 0) {
      return;
    }

    if (!startDate) {
      setErrorMessage("Please select a valid start date.");
      return;
    }

    if (!postingTime) {
      setErrorMessage("Please select a posting time.");
      return;
    }

    const [startYear, startMonth, startDay] = startDate.split("-").map((n) => parseInt(n, 10));
    const [hours, minutes] = postingTime.split(":").map((n) => parseInt(n, 10));

    // Pre-submission future-time validation loop
    const now = new Date();
    const calculatedDates: Date[] = [];
    for (let i = 0; i < unscheduledPosts.length; i++) {
      const postDate = new Date(startYear, startMonth - 1, startDay + i, hours, minutes, 0, 0);
      if (isNaN(postDate.getTime())) {
        setErrorMessage("Invalid date or time calculation. Please check your selections.");
        return;
      }
      if (postDate.getTime() <= now.getTime()) {
        const formattedOverdue = postDate.toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" });
        setErrorMessage(`Cannot schedule posts in the past. Calculated slot for Post #${i + 1} (${formattedOverdue}) is in the past. Please select a future start date or posting time.`);
        return;
      }
      calculatedDates.push(postDate);
    }

    setStatusState("saving");
    setErrorMessage("");

    const userId = auth.currentUser?.uid || "anonymous";
    let successfulAdds = 0;
    let failedAdds = 0;
    const newScheduledIds = new Set(alreadyScheduledIds);

    // Get current offline library to update
    const libraryKey = `threads_saved_offline_library_${userId}`;
    let offlineList: any[] = [];
    try {
      const raw = localStorage.getItem(libraryKey);
      if (raw) offlineList = JSON.parse(raw);
    } catch {
      offlineList = [];
    }

    for (let i = 0; i < unscheduledPosts.length; i++) {
      const post = unscheduledPosts[i];
      try {
        // Safe calendar date calculation (handles month boundaries, leap years, timezones)
        const postDate = new Date(startYear, startMonth - 1, startDay + i, hours, minutes, 0, 0);
        const firestoreTimestamp = Timestamp.fromDate(postDate);

        const rawParts = post.threadParts || [post.singlePost || ""];
        const parts = rawParts
          .filter((p) => typeof p === "string" && p.trim().length > 0)
          .map((p) => p.trim());

        const mainPostText = parts[0] || post.singlePost || "";
        const hookText = post.hook || mainPostText.slice(0, 100) + (mainPostText.length > 100 ? "..." : "");
        const postTitle = post.title?.trim() || `Scheduled Post #${i + 1}`;

        const normalizedTopics = normalizeTopicsList(undefined, post.topics);
        const primaryTopic = normalizedTopics[0] || post.pillarTitle || "General";
        const scheduledDateKey = formatLocalDateKey(postDate);
        const nowIso = new Date().toISOString();
        const existingCloudId = post.savedRecordId && !isLocalOnlyId(post.savedRecordId)
          ? post.savedRecordId
          : !isLocalOnlyId(post.id)
          ? post.id
          : null;

        const payload = sanitizeForFirestore({
          userId,
          sourcePostId: post.id,
          title: postTitle,
          hook: hookText,
          singlePost: mainPostText,
          threadParts: parts.length > 0 ? parts : [mainPostText],
          category: post.category || post.pillar || category,
          topic: primaryTopic,
          topics: normalizedTopics,
          ...(post.pillarTitle ? { pillarTitle: post.pillarTitle } : {}),
          ...(post.sourceIdeaId ? { sourceIdeaId: post.sourceIdeaId } : {}),
          stage: "Scheduled",
          status: "Scheduled",
          plannedDate: scheduledDateKey,
          isIdea: false,
          isPublished: false,
          scheduledFor: firestoreTimestamp,
          scheduledAt: Timestamp.now(),
          updatedAt: nowIso,
          ...(!existingCloudId ? { createdAt: nowIso } : {}),
        });

        // 1. Write to Firestore (update in-place if already saved to library, else create)
        let docId = existingCloudId || post.id;
        try {
          if (existingCloudId) {
            await withTimeout(setDoc(doc(db, "posts", existingCloudId), payload, { merge: true }), 6000, false);
            docId = existingCloudId;
          } else {
            const collectionRef = collection(db, "posts");
            const docRef = await withTimeout(addDoc(collectionRef, payload), 6000, false);
            docId = docRef.id;
          }
        } catch (dbErr) {
          handleFirestoreError(dbErr, existingCloudId ? OperationType.UPDATE : OperationType.CREATE, "posts");
          console.warn(`Firestore write warning for post ${i + 1}, fallback to offline:`, dbErr);
        }

        // 2. Write to local offline storage library without creating duplicates
        const localDoc = {
          id: docId || `scheduled-${Date.now()}-${i}`,
          userId,
          sourcePostId: post.id,
          title: postTitle,
          hook: hookText,
          singlePost: mainPostText,
          threadParts: parts.length > 0 ? parts : [mainPostText],
          category: post.category || post.pillar || category,
          topic: primaryTopic,
          topics: normalizedTopics,
          pillarTitle: post.pillarTitle,
          sourceIdeaId: post.sourceIdeaId || null,
          stage: "Scheduled",
          status: "Scheduled",
          plannedDate: scheduledDateKey,
          isIdea: false,
          isPublished: false,
          scheduledFor: postDate.toISOString(),
          scheduledAt: nowIso,
          updatedAt: nowIso,
          createdAt: nowIso,
        };

        offlineList = [
          localDoc,
          ...offlineList.filter(
            (item) =>
              item.sourcePostId !== post.id &&
              item.id !== post.id &&
              item.id !== docId &&
              (!post.savedRecordId || item.id !== post.savedRecordId)
          ),
        ];
        newScheduledIds.add(post.id);
        successfulAdds++;
      } catch (err: any) {
        console.error(`Failed to schedule post index ${i}:`, err);
        failedAdds++;
      }
    }

    // Save consolidated offline list
    try {
      localStorage.setItem(libraryKey, JSON.stringify(offlineList));
      invalidateCanonicalCache(userId);
      emitContentUpdatedEvent({ userId, action: "batch-schedule" });
    } catch (saveErr) {
      console.warn("Could not save offline calendar cache:", saveErr);
    }

    // Trigger background check for due scheduled posts with batch payload
    const batchCandidates = offlineList.filter((p: any) => p.status === "Scheduled" && Boolean(p.scheduledFor) && !p.isPublished && p.status !== "Published");
    if (batchCandidates.length > 0) {
      (async () => {
        try {
          const idToken = await auth.currentUser?.getIdToken();
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (idToken) headers["Authorization"] = `Bearer ${idToken}`;
          fetch("/api/posts/dispatch-due", {
            method: "POST",
            headers,
            body: JSON.stringify({
              userId,
              posts: batchCandidates
            })
          }).catch(() => {});
        } catch (_) {}
      })();
    }

    setAlreadyScheduledIds(newScheduledIds);
    setScheduledCount(successfulAdds);
    setFailedCount(failedAdds);

    if (failedAdds === 0) {
      setStatusState("success");
      if (onSuccess) onSuccess(successfulAdds);
    } else if (successfulAdds > 0) {
      setStatusState("partial");
      if (onSuccess) onSuccess(successfulAdds);
    } else {
      setStatusState("failed");
      setErrorMessage("Could not schedule posts. Please check your connection and try again.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div 
        className="w-full max-w-lg rounded-2xl border border-border-primary bg-bg-card shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        id="add-all-to-calendar-modal"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border-primary px-6 py-4 bg-bg-app/50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-surface border border-brand-border text-brand-text">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary">Add All To Calendar</h2>
              <p className="text-xs text-text-secondary">Batch schedule your generated content queue</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={statusState === "saving"}
            className="rounded-lg p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-card-hover transition cursor-pointer disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* SUCCESS STATE */}
          {statusState === "success" && (
            <div className="text-center py-6 space-y-4 animate-fade-in" id="add-all-success-state">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-status-success-bg border border-status-success-border text-status-success-text">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-text-primary">
                  {scheduledCount} Posts Added To Calendar
                </h3>
                <p className="text-xs text-text-secondary max-w-sm mx-auto">
                  Your posts are scheduled across {scheduledCount} consecutive days ({formattedStart} – {formattedEnd}) at {formattedTime}.
                </p>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
                {onNavigateToTab && (
                  <button
                    type="button"
                    id="view-calendar-btn"
                    onClick={() => {
                      onClose();
                      onNavigateToTab("calendar");
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold px-6 py-2.5 text-xs transition shadow-lg shadow-purple-500/20 cursor-pointer"
                  >
                    <Calendar className="h-4 w-4" />
                    <span>View Calendar</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-border-primary bg-bg-app hover:bg-bg-card text-text-secondary hover:text-text-primary font-bold px-5 py-2.5 text-xs transition cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {/* PARTIAL STATE */}
          {statusState === "partial" && (
            <div className="text-center py-6 space-y-4 animate-fade-in" id="add-all-partial-state">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-status-warning-bg border border-status-warning-border text-status-warning-text">
                <AlertCircle className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-text-primary">
                  {scheduledCount} Posts Added
                </h3>
                <p className="text-xs text-status-warning-text font-medium max-w-sm mx-auto">
                  {failedCount} posts could not be added due to a network interruption.
                </p>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
                {onNavigateToTab && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigateToTab("calendar");
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold px-6 py-2.5 text-xs transition cursor-pointer"
                  >
                    <Calendar className="h-4 w-4" />
                    <span>View Calendar</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleConfirmAddAll}
                  className="rounded-xl border border-border-primary bg-bg-app hover:bg-bg-card text-text-primary font-bold px-5 py-2.5 text-xs transition cursor-pointer"
                >
                  Retry Remaining ({failedCount})
                </button>
              </div>
            </div>
          )}

          {/* ALL ALREADY SCHEDULED STATE */}
          {statusState === "idle" && isAllAlreadyScheduled && !checkingDuplicates && (
            <div className="text-center py-6 space-y-4 animate-fade-in" id="all-already-scheduled-state">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-surface border border-brand-border text-brand-text">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-text-primary">
                  All {totalPostsCount} Posts Are Already In Your Calendar
                </h3>
                <p className="text-xs text-text-secondary max-w-sm mx-auto">
                  Every post in this generated batch has already been placed in your scheduling calendar.
                </p>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
                {onNavigateToTab && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigateToTab("calendar");
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold px-6 py-2.5 text-xs transition shadow-lg shadow-purple-500/20 cursor-pointer"
                  >
                    <Calendar className="h-4 w-4" />
                    <span>View Calendar</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-border-primary bg-bg-app hover:bg-bg-card text-text-secondary hover:text-text-primary font-bold px-5 py-2.5 text-xs transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {/* CONFIGURATION & CONFIRMATION FORM */}
          {statusState === "idle" && !isAllAlreadyScheduled && (
            <form onSubmit={handleConfirmAddAll} className="space-y-5">
              {/* Batch Info Summary */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border-primary bg-bg-app p-3 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted font-mono">Available Posts</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-bold text-text-primary">{unscheduledCount}</span>
                    <span className="text-xs text-text-muted">of {totalPostsCount}</span>
                  </div>
                </div>

                <div className="rounded-xl border border-border-primary bg-bg-app p-3 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted font-mono">Frequency</span>
                  <p className="text-xs font-bold text-brand-text-strong pt-1">1 post per day</p>
                </div>
              </div>

              {/* Partial duplicate note */}
              {alreadyScheduledCount > 0 && (
                <div className="rounded-xl border border-brand-border bg-brand-surface p-3 flex items-start gap-2.5 text-xs text-brand-text-strong">
                  <Sparkles className="h-4 w-4 text-brand-text shrink-0 mt-0.5" />
                  <span>
                    <strong>{alreadyScheduledCount}</strong> of {totalPostsCount} posts are already scheduled. Only the remaining <strong>{unscheduledCount}</strong> will be added.
                  </span>
                </div>
              )}

              {/* Date and Time Inputs */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1.5 flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-brand-text" />
                    <span>Start Date</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    min={(() => {
                      const now = new Date();
                      const yyyy = now.getFullYear();
                      const mm = String(now.getMonth() + 1).padStart(2, "0");
                      const dd = String(now.getDate()).padStart(2, "0");
                      return `${yyyy}-${mm}-${dd}`;
                    })()}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-xl border border-border-primary bg-bg-app px-3.5 py-2.5 text-xs text-text-primary focus:border-purple-500 focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1.5 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-brand-text" />
                    <span>Posting Time</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={postingTime}
                    onChange={(e) => setPostingTime(e.target.value)}
                    className="w-full rounded-xl border border-border-primary bg-bg-app px-3.5 py-2.5 text-xs text-text-primary focus:border-purple-500 focus:outline-none transition"
                  />
                </div>
              </div>

              {/* Confirmation Preview Card */}
              {startDate && postingTime && (
                <div className="rounded-xl border border-border-secondary bg-bg-app/70 p-4 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-border-primary pb-2">
                    <span className="text-xs font-bold text-text-primary">Ready To Add {unscheduledCount} Posts</span>
                    <span className="text-[11px] font-mono text-brand-text-strong font-semibold">{unscheduledCount} days</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-text-muted block text-[11px]">Start Date</span>
                      <span className="text-text-primary font-medium">{formattedStart}</span>
                    </div>
                    <div>
                      <span className="text-text-muted block text-[11px]">Posting Time</span>
                      <span className="text-text-primary font-medium">{formattedTime}</span>
                    </div>
                    <div>
                      <span className="text-text-muted block text-[11px]">Schedule</span>
                      <span className="text-text-primary font-medium">1 post per day</span>
                    </div>
                    <div>
                      <span className="text-text-muted block text-[11px]">End Date</span>
                      <span className="text-text-primary font-medium">{formattedEnd}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Error display */}
              {errorMessage && (
                <p className="text-xs text-status-danger-text bg-status-danger-bg p-3 rounded-xl border border-status-danger-border flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {errorMessage}
                </p>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-border-primary bg-bg-app hover:bg-bg-card text-text-secondary hover:text-text-primary font-bold px-4 py-2.5 text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="confirm-add-all-btn"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold px-5 py-2.5 text-xs transition shadow-lg shadow-purple-500/20 cursor-pointer active:scale-[0.98]"
                >
                  <Calendar className="h-4 w-4" />
                  <span>Add {unscheduledCount} Posts To Calendar</span>
                </button>
              </div>
            </form>
          )}

          {/* SAVING / LOADING STATE */}
          {statusState === "saving" && (
            <div className="text-center py-10 space-y-4 animate-fade-in" id="add-all-loading-state">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-surface border border-brand-border text-brand-text">
                <RefreshCw className="h-7 w-7 animate-spin" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-text-primary">
                  Adding {unscheduledCount} Posts...
                </h3>
                <p className="text-xs text-text-secondary">
                  Calculating daily distribution and registering scheduled dates...
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
