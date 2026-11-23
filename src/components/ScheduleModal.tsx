import React, { useState, useEffect } from "react";
import { X, Calendar, Clock, Sparkles, CheckCircle2, AlertCircle, RefreshCw, ArrowRight } from "lucide-react";
import { db, auth, withTimeout, handleFirestoreError, OperationType, sanitizeForFirestore } from "../firebase";
import { collection, doc, setDoc, addDoc, Timestamp, query, where, getDocs, limit } from "firebase/firestore";
import { UserProfile } from "../types";
import { canSchedulePostForDate, formatDateKey, isProUser, FREE_DAILY_SCHEDULE_LIMIT } from "../utils/contentLimit";
import {
  isLocalOnlyId,
  formatLocalDateKey,
  normalizeTopicsList,
  normalizeCanonicalRecord,
  upsertLocalCanonicalRecord,
  emitContentUpdatedEvent,
  invalidateCanonicalCache,
} from "../lib/canonicalContent";

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  postText: string;
  parts?: string[];
  postId?: string; // Optional: if scheduling an existing draft from the library
  title?: string;
  topic?: string;
  topics?: string[];
  pillarTitle?: string;
  sourceIdeaId?: string | null;
  initialDateTime?: string; // Optional: prefill date from calendar selection
  profile?: UserProfile | null;
  subscriptionStatus?: string;
  onSuccess?: () => void;
  onScheduled?: (recordId: string, scheduledIso: string) => void;
  onNavigateToTab?: (tab: string) => void;
}

const parseLocalHTMLDatetime = (str: string): Date => {
  if (!str) return new Date();
  const [datePart, timePart] = str.split("T");
  if (!datePart || !timePart) return new Date(str);
  const [year, month, day] = datePart.split("-").map(num => parseInt(num, 10));
  const [hours, minutes] = timePart.split(":").map(num => parseInt(num, 10));
  return new Date(year, month - 1, day, hours, minutes);
};

export default function ScheduleModal({
  isOpen,
  onClose,
  postText,
  parts,
  postId,
  title,
  topic,
  topics,
  pillarTitle,
  sourceIdeaId,
  initialDateTime,
  profile,
  subscriptionStatus,
  onSuccess,
  onScheduled,
  onNavigateToTab
}: ScheduleModalProps) {
  // Post editorial state
  const [threadParts, setThreadParts] = useState<string[]>([]);
  const [draftTitle, setDraftTitle] = useState("");
  
  // Schedule state
  const [scheduledTime, setScheduledTime] = useState("");
  const [minDateTime, setMinDateTime] = useState("");

  // Plan limits state
  const [scheduledCountForDate, setScheduledCountForDate] = useState<number>(0);
  const [limitCheckLoading, setLimitCheckLoading] = useState<boolean>(false);

  // UI state
  const [saving, setSaving] = useState(false);
  const [statusState, setStatusState] = useState<"idle" | "success" | "failed">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const isPro = isProUser(profile, subscriptionStatus);
  const effectiveUserId = auth.currentUser?.uid || profile?.uid || "anonymous";

  // Setup minimum date/time limit to prevent selecting past dates
  useEffect(() => {
    const getMinDateTimeString = () => {
      const now = new Date();
      // Add 2 minutes buffer to ensure scheduling is set in the future
      const bufferTime = new Date(now.getTime() + 2 * 60 * 1000);
      
      // Explicitly extract local date components to avoid UTC shift
      const localYear = bufferTime.getFullYear();
      const localMonth = String(bufferTime.getMonth() + 1).padStart(2, "0");
      const localDay = String(bufferTime.getDate()).padStart(2, "0");
      const localHours = String(bufferTime.getHours()).padStart(2, "0");
      const localMinutes = String(bufferTime.getMinutes()).padStart(2, "0");
      
      return `${localYear}-${localMonth}-${localDay}T${localHours}:${localMinutes}`;
    };

    const minStr = getMinDateTimeString();
    setMinDateTime(minStr);
    
    if (initialDateTime) {
      setScheduledTime(initialDateTime);
      return;
    }

    // Default scheduled time to 20 minutes from now, or incremented by 20 minutes from the last scheduled post in this session
    let defaultTime = new Date(Date.now() + 20 * 60 * 1000);
    const lastTimeStr = sessionStorage.getItem("threads_last_scheduled_time");
    if (lastTimeStr) {
      const lastTime = new Date(lastTimeStr);
      if (!isNaN(lastTime.getTime())) {
        const incrementedTime = new Date(lastTime.getTime() + 20 * 60 * 1000);
        if (incrementedTime.getTime() > Date.now()) {
          defaultTime = incrementedTime;
        }
      }
    }
    const defYear = defaultTime.getFullYear();
    const defMonth = String(defaultTime.getMonth() + 1).padStart(2, "0");
    const defDay = String(defaultTime.getDate()).padStart(2, "0");
    const defHours = String(defaultTime.getHours()).padStart(2, "0");
    const defMinutes = String(defaultTime.getMinutes()).padStart(2, "0");
    setScheduledTime(`${defYear}-${defMonth}-${defDay}T${defHours}:${defMinutes}`);
  }, [isOpen, initialDateTime]);

  // Load default text content when modal opens
  useEffect(() => {
    if (isOpen) {
      if (parts && parts.length > 0) {
        setThreadParts(parts);
      } else {
        setThreadParts(postText ? [postText] : [""]);
      }
      setDraftTitle(title || `Scheduled Thread #${Date.now().toString().slice(-4)}`);
      setStatusState("idle");
      setErrorMessage("");
    }
  }, [isOpen, postText, parts, title]);

  // Check scheduled post count for the selected date
  useEffect(() => {
    if (!isOpen || !scheduledTime) return;

    const checkCount = async () => {
      const targetDateKey = formatDateKey(scheduledTime);
      let count = 0;

      // 1. Check local offline storage library
      try {
        const libraryKey = `threads_saved_offline_library_${effectiveUserId}`;
        const raw = localStorage.getItem(libraryKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            count = parsed.filter((p: any) => {
              if (postId && (p.id === postId || p.sourcePostId === postId)) return false;
              if (p.status !== "Scheduled" && !p.scheduledFor) return false;
              let itemDate: Date | null = null;
              if (typeof p.scheduledFor?.toDate === "function") {
                itemDate = p.scheduledFor.toDate();
              } else if (p.scheduledFor?.seconds) {
                itemDate = new Date(p.scheduledFor.seconds * 1000);
              } else if (p.scheduledFor) {
                itemDate = new Date(p.scheduledFor);
              }
              if (!itemDate || isNaN(itemDate.getTime())) return false;
              return formatDateKey(itemDate) === targetDateKey;
            }).length;
          }
        }
      } catch (e) {
        // ignore
      }

      // 2. Query Firestore strictly scoped to the target single day (limit 2) only if free user & count is 0
      if (effectiveUserId && effectiveUserId !== "anonymous" && !isPro && count === 0) {
        try {
          const [year, month, day] = targetDateKey.split("-").map(Number);
          if (year && month && day) {
            const dayStart = new Date(year, month - 1, day, 0, 0, 0, 0);
            const dayEnd = new Date(year, month - 1, day, 23, 59, 59, 999);
            const postsRef = collection(db, "posts");
            const q = query(
              postsRef, 
              where("userId", "==", effectiveUserId),
              where("scheduledFor", ">=", Timestamp.fromDate(dayStart)),
              where("scheduledFor", "<=", Timestamp.fromDate(dayEnd)),
              limit(2)
            );
            const snapshot = await withTimeout(getDocs(q), 2500, false).catch(() => null);
            if (snapshot && !snapshot.empty) {
              const matchingDocs = snapshot.docs.filter((d) => !postId || d.id !== postId);
              count = Math.max(count, matchingDocs.length);
            }
          }
        } catch (err) {
          // ignore
        }
      }

      setScheduledCountForDate(count);
    };

    checkCount();
  }, [isOpen, scheduledTime, effectiveUserId, postId, isPro]);

  if (!isOpen) return null;

  const hasExcessivePartLength = threadParts.some((part) => part.length > 500);
  const isAnyPartEmpty = threadParts.some((part) => !part.trim());
  const isTitleEmpty = !draftTitle.trim();
  const isTimeInvalid = !scheduledTime || parseLocalHTMLDatetime(scheduledTime).getTime() <= Date.now();
  const isFreeDailyLimitReached = !isPro && scheduledCountForDate >= FREE_DAILY_SCHEDULE_LIMIT;

  /**
   * FRONTEND FIRESTORE HANDLER: handleSchedulePost
   * Saves or updates 'posts' collection with status: 'scheduled'
   */
  const handleSchedulePost = async (e: React.FormEvent) => {
    e.preventDefault();

    // Free plan scheduling limit check: 5 scheduled posts per day
    if (!isPro) {
      const permission = canSchedulePostForDate(effectiveUserId, scheduledTime, profile, subscriptionStatus, postId);
      if (!permission.allowed) {
        setErrorMessage(permission.message || `Free plan is limited to ${FREE_DAILY_SCHEDULE_LIMIT} scheduled posts per day. Upgrade to Pro ($7/month) for unlimited scheduling.`);
        setStatusState("failed");
        return;
      }
    }

    // Guard validations
    if (isTitleEmpty) {
      setErrorMessage("Please assign a title for this scheduled draft.");
      setStatusState("failed");
      return;
    }
    if (threadParts.length === 0 || isAnyPartEmpty) {
      setErrorMessage("Cannot schedule empty post thread content.");
      setStatusState("failed");
      return;
    }
    if (hasExcessivePartLength) {
      setErrorMessage("One or more thread parts exceed Meta's 500 characters limit.");
      setStatusState("failed");
      return;
    }
    if (isTimeInvalid) {
      setErrorMessage("Selected publication time must be in the future.");
      setStatusState("failed");
      return;
    }

    setSaving(true);
    setStatusState("idle");
    setErrorMessage("");

    const currentUid = auth.currentUser?.uid || profile?.uid || effectiveUserId;
    if (!currentUid || currentUid === "anonymous") {
      setErrorMessage("Please sign in to your account to schedule posts.");
      setStatusState("failed");
      setSaving(false);
      return;
    }
    const userId = currentUid;
    const selectedDate = parseLocalHTMLDatetime(scheduledTime);
    
    // Translate date string directly to proper Firestore Timestamp
    const firestoreTimestamp = Timestamp.fromDate(selectedDate);

    try {
      const consolidatedThreadParts = threadParts
        .filter((p) => typeof p === "string")
        .map((p) => p.trim());

      if (consolidatedThreadParts.length === 0) {
        throw new Error("Cannot schedule empty thread content.");
      }

      console.log(`[SCHEDULE_CONSOLIDATION] Scheduling ${consolidatedThreadParts.length}-part thread.`);

      const normalizedTopics = normalizeTopicsList(topic, topics);
      const primaryTopic = normalizedTopics[0] || (topic && !topic.includes("ThreadsWorks") ? topic : "General");
      const nowIso = new Date().toISOString();
      const scheduledDateKey = formatLocalDateKey(selectedDate);
      const isExistingCloudDoc = Boolean(postId && !isLocalOnlyId(postId));

      // Clean payload preserving unified identity and planning metadata
      const payload: Record<string, any> = {
        userId,
        title: draftTitle.trim(),
        hook: consolidatedThreadParts[0].slice(0, 100) + (consolidatedThreadParts[0].length > 100 ? "..." : ""),
        singlePost: consolidatedThreadParts[0],
        threadParts: consolidatedThreadParts,
        topic: primaryTopic,
        topics: normalizedTopics,
        ...(pillarTitle ? { pillarTitle } : {}),
        ...(sourceIdeaId ? { sourceIdeaId } : {}),
        stage: "Scheduled",
        status: "Scheduled",
        plannedDate: scheduledDateKey,
        isIdea: false,
        isPublished: false,
        isCanceled: false,
        isCancelled: false,
        canceledAt: null,
        cancelledAt: null,
        cancelRequested: false,
        cancelRequestedAt: null,
        publishingClaimToken: null,
        scheduledFor: firestoreTimestamp,
        scheduledAt: Timestamp.now(),
        updatedAt: nowIso,
      };
      if (!isExistingCloudDoc) {
        payload.createdAt = nowIso;
      }

      let savedDocId = postId;

      const sanitizedPayload = sanitizeForFirestore(payload);

      if (isExistingCloudDoc && postId) {
        const postRef = doc(db, "posts", postId);
        // Direct setDoc with merge preserves existing createdAt and metadata without extra read
        await withTimeout(
          setDoc(postRef, sanitizedPayload, { merge: true }),
          8000,
          false
        );
      } else {
        // Create a new post document
        const collectionRef = collection(db, "posts");
        const docRef = await withTimeout(
          addDoc(collectionRef, sanitizedPayload),
          8000,
          false
        );
        savedDocId = docRef.id;
      }

      invalidateCanonicalCache(userId);

      // Sync to offline library local storage replacing any temporary/local ID cleanly (zero duplicates)
      try {
        const canonicalLocal = normalizeCanonicalRecord(
          {
            id: savedDocId || postId || `local-${Date.now()}`,
            userId,
            title: draftTitle.trim(),
            hook: payload.hook,
            singlePost: payload.singlePost,
            threadParts: payload.threadParts,
            topic: primaryTopic,
            topics: normalizedTopics,
            pillarTitle,
            sourceIdeaId: sourceIdeaId || null,
            stage: "Scheduled",
            status: "Scheduled",
            plannedDate: scheduledDateKey,
            isIdea: false,
            isPublished: false,
            scheduledFor: selectedDate.toISOString(),
            scheduledAt: nowIso,
            updatedAt: nowIso,
            createdAt: nowIso,
          },
          userId
        );
        upsertLocalCanonicalRecord(userId, canonicalLocal, postId);
      } catch (locErr) {
        console.warn("Offline fallback sync failed, continuing", locErr);
      }

      emitContentUpdatedEvent({ userId, recordId: savedDocId, action: "schedule" });

      setStatusState("success");
      // Trigger background check for due scheduled posts with post payload
      (async () => {
        try {
          const idToken = await auth.currentUser?.getIdToken();
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (idToken) headers["Authorization"] = `Bearer ${idToken}`;
          fetch("/api/posts/dispatch-due", {
            method: "POST",
            headers,
            body: JSON.stringify({
              postId: savedDocId,
              userId,
              post: {
                id: savedDocId,
                ...sanitizedPayload,
                scheduledFor: selectedDate.toISOString()
              }
            })
          }).catch(() => {});
        } catch (_) {}
      })();
      try {
        sessionStorage.setItem("threads_last_scheduled_time", selectedDate.toISOString());
      } catch (sessErr) {
        console.warn("Could not save last scheduled time to session storage:", sessErr);
      }
      if (onScheduled && savedDocId) {
        onScheduled(savedDocId, selectedDate.toISOString());
      }
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.error("[SCHEDULE_SAVE_ERROR] Save operation failed:", err);
      setStatusState("failed");
      setErrorMessage(err.message || "Failed to commit scheduled parameters to database.");
      
      try {
        handleFirestoreError(err, postId ? OperationType.UPDATE : OperationType.CREATE, `posts/${postId || ""}`);
      } catch (logErr) {
        // Bypassed
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in" id="schedule-threads-modal">
      <div className="relative w-full max-w-lg rounded-2xl border border-border-primary bg-bg-card p-6 shadow-2xl space-y-5 flex flex-col justify-between max-h-[90vh] overflow-y-auto">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border-primary">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-brand-surface flex items-center justify-center text-brand-text border border-brand-border">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider font-sans">Schedule Thread</h3>
              <p className="text-[11px] text-text-muted">
                {isPro ? "Pro Plan: Unlimited Scheduling" : `Free Plan: ${scheduledCountForDate}/${FREE_DAILY_SCHEDULE_LIMIT} scheduled for selected date`}
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition cursor-pointer p-1 rounded-lg hover:bg-bg-card-hover"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Success State Overlay */}
        {statusState === "success" ? (
          <div className="py-8 space-y-5 text-center animate-fade-in">
            <div className="mx-auto w-12 h-12 bg-status-success-bg text-status-success-text rounded-full flex items-center justify-center border border-status-success-border">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div className="space-y-2">
              <h4 className="text-base font-bold text-text-primary">✅ Scheduled Successfully</h4>
              <p className="text-xs text-text-secondary leading-relaxed max-w-sm mx-auto mt-2">
                Your thread has been scheduled for:
              </p>
              <div className="inline-flex flex-col items-center gap-1.5 rounded-xl bg-bg-app px-6 py-3 border border-border-primary mt-2">
                <span className="text-sm font-bold text-text-primary font-mono">
                  {new Date(scheduledTime).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
                <span className="text-xs font-semibold text-brand-text-strong font-mono">
                  {new Date(scheduledTime).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>

            <div className="pt-6 flex flex-col sm:flex-row gap-2.5 justify-center">
              {onNavigateToTab && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigateToTab("calendar");
                    }}
                    className="rounded-xl border border-brand-border bg-brand-surface hover:bg-brand-surface-hover text-brand-text-strong font-bold px-4 py-2.5 text-xs shadow-sm transition cursor-pointer"
                  >
                    View In Calendar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigateToTab("library");
                    }}
                    className="rounded-xl border border-border-primary bg-bg-app hover:bg-bg-card-hover text-text-secondary hover:text-text-primary font-bold px-4 py-2.5 text-xs shadow-lg transition cursor-pointer"
                  >
                    View In Library
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold px-5 py-2.5 text-xs shadow-lg transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Active Schedule Setup Flow */
          <form onSubmit={handleSchedulePost} className="space-y-4">
            
            {/* Free Plan Daily Limit Exceeded Banner */}
            {!isPro && isFreeDailyLimitReached && (
              <div className="rounded-xl border border-brand-border bg-brand-surface p-4 space-y-3 animate-fade-in" id="schedule-limit-banner">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 text-brand-text mt-0.5 shrink-0" />
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-text-primary">Daily Scheduling Limit Reached (5/5)</p>
                    <p className="text-xs text-text-secondary">
                      The Free plan allows up to 5 scheduled posts per day. Upgrade to Pro ($7/month) for unlimited scheduled posts.
                    </p>
                  </div>
                </div>
                {onNavigateToTab && (
                  <button
                    type="button"
                    id="schedule-modal-upgrade-btn"
                    onClick={() => {
                      onClose();
                      onNavigateToTab("pricing");
                    }}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 text-xs transition cursor-pointer shadow-lg shadow-purple-500/20"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Upgrade to Pro ($7/mo) for Unlimited Scheduling</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* Error Banner */}
            {statusState === "failed" && (
              <div className="rounded-lg border border-status-danger-border bg-status-danger-bg p-3.5 flex items-start gap-2.5 text-xs text-status-danger-text animate-fade-in">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-bold">Scheduling Interrupted</p>
                  <p className="text-[11px] mt-0.5 leading-snug">{errorMessage}</p>
                </div>
              </div>
            )}

            {/* Title Entry */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest font-sans">
                Post Title / Topic
              </label>
              <input
                type="text"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                required
                placeholder="E.g. Authority Building hook"
                className="w-full bg-bg-app border border-border-primary px-3 py-2 rounded-xl text-text-primary font-sans text-base md:text-xs focus:outline-none focus:border-purple-500 transition"
              />
            </div>

            {/* Interactive Thread Editor Section */}
            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
              <div className="flex justify-between items-center text-[10px] uppercase font-bold text-text-muted select-none">
                <span>Thread Content</span>
                <span>{threadParts.length} {threadParts.length === 1 ? "part" : "parts"} total</span>
              </div>

              <div className="space-y-3">
                {threadParts.map((part, index) => {
                  const isPartOverLimit = part.length > 500;
                  return (
                    <div key={index} className="space-y-1.5 bg-bg-app border border-border-primary p-3 rounded-xl">
                      <div className="flex justify-between items-center text-[10px] font-bold text-text-secondary select-none">
                        <span>PART {index + 1}</span>
                        <div className="flex items-center gap-2">
                          <span className={isPartOverLimit ? "text-status-danger-text font-extrabold" : "text-text-muted font-mono"}>
                            {part.length} / 500
                          </span>
                          {index > 0 && (
                            <button
                              type="button"
                              onClick={() => setThreadParts(threadParts.filter((_, i) => i !== index))}
                              className="text-status-danger-text hover:underline font-semibold uppercase"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                      
                      <textarea
                        value={part}
                        onChange={(e) => {
                          const updated = [...threadParts];
                          updated[index] = e.target.value;
                          setThreadParts(updated);
                        }}
                        placeholder={`Write part ${index + 1}...`}
                        rows={3}
                        className="w-full rounded-lg border border-border-primary bg-bg-card p-2.5 text-base md:text-xs text-text-primary placeholder-text-muted outline-none focus:border-purple-500 transition font-sans leading-relaxed resize-none"
                      />
                      {isPartOverLimit && (
                        <p className="text-[10px] text-status-danger-text font-medium">
                          ⚠️ Exceeds Meta Threads API character limit.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={threadParts.length >= 15}
                  onClick={() => {
                    if (threadParts.length < 15) {
                      setThreadParts([...threadParts, ""]);
                    }
                  }}
                  title={threadParts.length >= 15 ? "Maximum 15 parts per post." : undefined}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-brand-border bg-brand-surface hover:bg-brand-surface-hover text-brand-text-strong font-bold px-4 py-2.5 md:px-3 md:py-1.5 text-xs md:text-[10px] uppercase transition cursor-pointer min-h-[44px] md:min-h-0 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  + Add Part
                </button>
                {threadParts.length >= 15 && (
                  <span className="text-[10px] text-text-muted">Max 15 parts</span>
                )}
              </div>
            </div>

            {/* DATE & TIME SELECTOR */}
            <div className="pt-3 border-t border-border-primary grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest font-sans">
                  Select Release Date & Time
                </label>
                <div className="relative">
                  <input
                    type="datetime-local"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    min={minDateTime}
                    required
                    className="w-full bg-bg-app border border-border-primary px-3 py-2 rounded-xl text-text-primary font-sans text-base md:text-xs focus:outline-none focus:border-purple-500 transition"
                  />
                </div>
                {!isPro && (
                  <p className="text-[10px] text-text-muted">
                    {scheduledCountForDate} of {FREE_DAILY_SCHEDULE_LIMIT} posts scheduled for this day
                  </p>
                )}
              </div>

              <div className="rounded-xl bg-brand-surface border border-brand-border p-3 flex flex-col justify-center space-y-1">
                <span className="text-[10px] font-bold text-brand-text-strong uppercase tracking-wide flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> Automatic Delivery
                </span>
                <p className="text-[10px] text-text-secondary leading-snug">
                  The automated Threads engine scans the queue and executes direct API handshakes with Meta Threads.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2.5 pt-4 border-t border-border-primary">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="rounded-lg border border-border-primary bg-bg-app px-5 py-3 md:px-4 md:py-2 text-sm md:text-xs font-semibold text-text-secondary hover:text-text-primary transition cursor-pointer disabled:opacity-40 min-h-[44px] md:min-h-0 flex items-center justify-center"
              >
                Cancel
              </button>
              
              <button
                type="submit"
                id="schedule-modal-submit-btn"
                disabled={saving || hasExcessivePartLength || isAnyPartEmpty || isTitleEmpty || isTimeInvalid || (!isPro && isFreeDailyLimitReached)}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 px-6 py-3.5 md:px-5 md:py-2.5 text-sm md:text-xs font-bold text-white shadow-lg cursor-pointer transition disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] md:min-h-0 flex-1 sm:flex-initial"
              >
                {saving ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Scheduling...
                  </>
                ) : (
                  <>
                    <Calendar className="h-3.5 w-3.5" /> Schedule Post
                  </>
                )}
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
}

