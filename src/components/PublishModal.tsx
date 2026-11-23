import React, { useState, useEffect, useRef } from "react";
import { 
  X, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  ArrowUpRight, 
  ShieldCheck, 
  Clock,
  RotateCcw
} from "lucide-react";
import { db, auth } from "../firebase";
import { doc, updateDoc } from "firebase/firestore";
import { getThreadsAppId, validateAccessToken } from "../utils/threadsApi";
import { useThreadsConnection } from "../context/ThreadsConnectionContext";
import ThreadsConnectButton from "./ThreadsConnectButton";
import { emitContentUpdatedEvent, invalidateCanonicalCache, isLocalOnlyId } from "../lib/canonicalContent";

export type PublishStatus = 
  | "idle"
  | "validating"
  | "creating"
  | "processing"
  | "publishing"
  | "confirming"
  | "success"
  | "failed"
  | "timeout"
  | "publishing_uncertain";

interface PublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  postText: string;
  parts?: string[];
  userId: string;
  onNavigateToTab?: (tab: string) => void;
  postId?: string;
}

export default function PublishModal({ 
  isOpen, 
  onClose, 
  postText, 
  parts, 
  userId, 
  onNavigateToTab, 
  postId 
}: PublishModalProps) {
  const { 
    loading: loadingConn,
    connected,
    username: threadsUsername,
    isSandbox,
    connectionDetails
  } = useThreadsConnection();

  // Multi-part threads and state machine
  const [threadParts, setThreadParts] = useState<string[]>([]);
  const [publishStatus, setPublishStatus] = useState<PublishStatus>("idle");
  const [publishError, setPublishError] = useState("");
  const [errorStage, setErrorStage] = useState<string>("");
  const [publishedUrl, setPublishedUrl] = useState("");
  const [activeIdempotencyKey, setActiveIdempotencyKey] = useState<string>("");
  const [uiProgressNote, setUiProgressNote] = useState<string>("");

  const lastClickRef = useRef<number>(0);
  const reconcileTimerRef = useRef<any>(null);
  const slowTimerRef = useRef<any>(null);

  const hasExcessivePartLength = threadParts.some((part) => part.length > 500);
  const isAnyPartEmpty = threadParts.some((part) => !part.trim());
  const isPublishingActive = [
    "validating",
    "creating",
    "processing",
    "publishing",
    "confirming"
  ].includes(publishStatus);

  // Helper to sync local storage library cache when a post publishes
  const syncLocalLibraryCache = (effectiveUserId: string, liveUrl: string, targetPostId?: string, partsFirstItem?: string) => {
    try {
      const libKey = `threads_saved_offline_library_${effectiveUserId}`;
      const cached = localStorage.getItem(libKey);
      if (cached) {
        const list = JSON.parse(cached);
        const nowIso = new Date().toISOString();
        const updated = list.map((p: any) =>
          (p.id === targetPostId || (p.singlePost && p.singlePost.trim() === partsFirstItem?.trim()))
            ? {
                ...p,
                stage: "Published",
                status: "Published",
                isPublished: true,
                publishedAt: nowIso,
                permalink: liveUrl,
                threadsPermalink: liveUrl,
                plannedDate: null,
                scheduledFor: null,
                scheduledAt: null,
                updatedAt: nowIso,
              }
            : p
        );
        localStorage.setItem(libKey, JSON.stringify(updated));
      }
      invalidateCanonicalCache(effectiveUserId);
      emitContentUpdatedEvent({ userId: effectiveUserId, recordId: targetPostId, action: "publish" });
    } catch (_) {}
  };

  // Reconcile status loop against backend (used only for recovery / conflicts / disconnects)
  const reconcileStatus = async (key: string, pId?: string, uId?: string) => {
    setPublishStatus("confirming");
    let attempts = 0;
    const maxAttempts = 20; // 20 * 2s = 40 seconds max polling

    if (reconcileTimerRef.current) {
      clearInterval(reconcileTimerRef.current);
      reconcileTimerRef.current = null;
    }

    const effectiveUserId = uId || userId || auth.currentUser?.uid || "";
    const effectiveKey = key || activeIdempotencyKey || pId || "";
    const effectivePId = pId || postId || "";

    const checkOnce = async (): Promise<boolean> => {
      try {
        const query = new URLSearchParams();
        if (effectiveKey) query.set("key", effectiveKey);
        if (effectivePId) query.set("postId", effectivePId);
        if (effectiveUserId) query.set("userId", effectiveUserId);

        const res = await fetch(`/api/threads/publish-status?${query.toString()}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === "published") {
            setPublishStatus("success");
            const username = threadsUsername || "user";
            const liveUrl = data.permalink || `https://threads.net/@${username}/post/${data.postId || ""}`;
            setPublishedUrl(liveUrl);

            // Sync Firestore post doc status
            if (effectivePId && !isLocalOnlyId(effectivePId) && auth.currentUser) {
              try {
                await updateDoc(doc(db, "posts", effectivePId), {
                  stage: "Published",
                  status: "Published",
                  isPublished: true,
                  publishedPostId: data.postId || "",
                  permalink: liveUrl,
                  threadsPermalink: liveUrl,
                  publishedAt: data.publishedAt || new Date().toISOString(),
                  plannedDate: null,
                  scheduledFor: null,
                  scheduledAt: null,
                  updatedAt: new Date().toISOString(),
                });
              } catch (_) {}
            }

            syncLocalLibraryCache(effectiveUserId, liveUrl, effectivePId, threadParts[0]);
            return true; // resolved
          } else if (data.status === "failed") {
            setPublishStatus("failed");
            setErrorStage("publishing");
            setPublishError(data.error || "Publishing encountered an error on Meta Threads.");
            return true; // resolved as failed
          } else if (data.status === "processing") {
            setPublishStatus("confirming");
            return false; // still processing
          }
        }
      } catch (err) {
        console.warn("[RECONCILE] Error checking status:", err);
      }
      return false;
    };

    const resolved = await checkOnce();
    if (resolved) return;

    reconcileTimerRef.current = setInterval(async () => {
      attempts++;
      const isResolved = await checkOnce();
      if (isResolved || attempts >= maxAttempts) {
        if (reconcileTimerRef.current) {
          clearInterval(reconcileTimerRef.current);
          reconcileTimerRef.current = null;
        }
        if (!isResolved && attempts >= maxAttempts) {
          setPublishStatus("publishing_uncertain");
        }
      }
    }, 2000);
  };

  // Reset states on open (DO NOT auto-reconcile on mount for idle posts)
  useEffect(() => {
    if (isOpen) {
      if (parts && parts.length > 0) {
        setThreadParts(parts);
      } else {
        setThreadParts(postText ? [postText] : [""]);
      }
      setPublishStatus("idle");
      setPublishError("");
      setErrorStage("");
      setPublishedUrl("");
      setUiProgressNote("");
      const targetKey = postId || `pub_${Date.now()}`;
      setActiveIdempotencyKey(targetKey);
    } else {
      if (reconcileTimerRef.current) {
        clearInterval(reconcileTimerRef.current);
        reconcileTimerRef.current = null;
      }
      if (slowTimerRef.current) {
        clearTimeout(slowTimerRef.current);
        slowTimerRef.current = null;
      }
    }
  }, [isOpen, postText, parts, postId]);

  const handlePublish = async () => {
    // 1. Double-click & duplicate debounce protection
    const now = Date.now();
    if (now - lastClickRef.current < 1200) {
      console.warn("[PUBLISH_MODAL] Debouncing duplicate click.");
      return;
    }
    lastClickRef.current = now;

    if (!connected || hasExcessivePartLength || isAnyPartEmpty || isPublishingActive) {
      return;
    }

    const effectiveUserId = userId || auth.currentUser?.uid || "";
    if (!effectiveUserId) {
      setPublishStatus("failed");
      setErrorStage("authentication");
      setPublishError("User authentication session invalid. Please log in again.");
      return;
    }

    const idempotencyKey = activeIdempotencyKey || postId || `pub_${effectiveUserId}_${Date.now()}`;
    setActiveIdempotencyKey(idempotencyKey);

    setPublishStatus("validating");
    setPublishError("");
    setErrorStage("");
    setUiProgressNote("");

    // UI-only progress notice timer (at 25 seconds) to keep user informed on longer multi-part threads
    if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
    slowTimerRef.current = setTimeout(() => {
      setUiProgressNote("Publishing is taking a few extra seconds on Meta Threads... Please keep this window open.");
    }, 25000);

    try {
      let appId = "";
      try {
        appId = getThreadsAppId();
      } catch (guardErr: any) {
        throw new Error(`Integration Blocked: App ID guard failed. ${guardErr.message}`);
      }

      const conn = connectionDetails;
      const rawAccessToken = conn?.accessToken || "";
      const threadsUserId = conn?.threadsUserId || "";
      const username = conn?.threadsUsername || threadsUsername || "threads_user";

      let validatedToken = "";
      if (rawAccessToken) {
        try {
          validatedToken = validateAccessToken(rawAccessToken);
        } catch (_) {}
      }

      // Step transition: Creating containers & publishing
      setPublishStatus("creating");

      // CRITICAL: The HTTP POST request remains active without an artificial client-side abort
      const res = await fetch("/api/threads/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: effectiveUserId,
          parts: threadParts.map((p) => p.trim()),
          ...(validatedToken ? { accessToken: validatedToken } : {}),
          ...(threadsUserId ? { threadsUserId } : {}),
          threadsUsername: username,
          client_id: appId,
          idempotencyKey,
          postId
        })
      });

      if (slowTimerRef.current) {
        clearTimeout(slowTimerRef.current);
        slowTimerRef.current = null;
      }

      const data = await res.json().catch(() => null);

      if (res.ok && data && data.success) {
        setPublishStatus("success");
        const liveUrl = data.permalink || `https://threads.net/@${username}/post/${data.postId || ""}`;
        setPublishedUrl(liveUrl);

        // Sync Firestore post doc status to Published
        if (postId && !isLocalOnlyId(postId) && auth.currentUser) {
          try {
            await updateDoc(doc(db, "posts", postId), {
              stage: "Published",
              status: "Published",
              isPublished: true,
              publishedPostId: data.postId || "",
              permalink: liveUrl,
              threadsPermalink: liveUrl,
              publishedAt: new Date().toISOString(),
              plannedDate: null,
              scheduledFor: null,
              scheduledAt: null,
              updatedAt: new Date().toISOString(),
            });
          } catch (pUpdateErr) {
            console.warn("Could not update post doc to Published:", pUpdateErr);
          }
        }

        syncLocalLibraryCache(effectiveUserId, liveUrl, postId, threadParts[0]);

      } else {
        // If server returns HTTP 409 Conflict ("already in progress"), transition to status reconciliation
        if (res.status === 409 || data?.status === "processing") {
          reconcileStatus(idempotencyKey, postId, effectiveUserId);
        } else {
          setPublishStatus("failed");
          setErrorStage(data?.stage || "publishing");
          setPublishError(data?.error || `Server returned status ${res.status}`);
        }
      }

    } catch (fetchErr: any) {
      if (slowTimerRef.current) {
        clearTimeout(slowTimerRef.current);
        slowTimerRef.current = null;
      }

      console.warn("[PUBLISH_MODAL] Network error or disconnect during publish. Starting status reconciliation...", fetchErr);
      // Fallback status reconciliation if client network dropped during HTTP request
      reconcileStatus(idempotencyKey, postId, effectiveUserId);
    }
  };

  const handleRetry = async () => {
    // Before attempting a new publish, check authoritative status to guarantee no duplicate post is created
    setPublishStatus("validating");
    try {
      const query = new URLSearchParams({ key: activeIdempotencyKey, userId });
      if (postId) query.set("postId", postId);
      const checkRes = await fetch(`/api/threads/publish-status?${query.toString()}`);
      if (checkRes.ok) {
        const checkData = await checkRes.json();
        if (checkData.status === "published") {
          setPublishStatus("success");
          const liveUrl = checkData.permalink || `https://threads.net/@${threadsUsername || "user"}/post/${checkData.postId || ""}`;
          setPublishedUrl(liveUrl);
          return;
        } else if (checkData.status === "processing") {
          reconcileStatus(activeIdempotencyKey, postId, userId);
          return;
        }
      }
    } catch (_) {}

    // If check confirmed not published and not processing, proceed to publish
    setPublishStatus("idle");
    handlePublish();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" id="publish-threads-modal">
      <div className="relative w-full max-w-lg rounded-2xl border border-border-primary bg-bg-card p-6 shadow-2xl space-y-5 flex flex-col justify-between max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border-primary">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Publish to Threads</h3>
          </div>
          <button 
            onClick={onClose}
            aria-label="Close publish dialog"
            className="text-text-muted hover:text-text-primary transition cursor-pointer p-1 rounded-lg hover:bg-bg-card-hover"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Dynamic Display Body */}
        {loadingConn ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="h-6 w-6 text-purple-500 animate-spin" />
            <p className="text-xs text-text-muted font-medium">Validating secure Threads session ...</p>
          </div>
        ) : !connected ? (
          /* Disconnected Screen */
          <div className="py-6 space-y-5 text-center">
            <div className="mx-auto w-12 h-12 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div className="space-y-2">
              <h4 className="text-sm font-bold text-text-primary">Threads Not Connected</h4>
              <p className="text-xs text-text-muted leading-relaxed max-w-xs mx-auto">
                Please authorize your official Threads account to enable direct 1-click publishing.
              </p>
            </div>
            <div className="flex justify-center pt-2">
              <ThreadsConnectButton returnTo="content-engine" />
            </div>
          </div>
        ) : isPublishingActive ? (
          /* Deterministic Publishing / Confirming In-Progress State */
          <div className="py-8 flex flex-col items-center justify-center space-y-4 text-center">
            <div className="relative flex items-center justify-center">
              <RefreshCw className="h-10 w-10 text-purple-500 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="h-3 w-3 rounded-full bg-purple-400 animate-pulse" />
              </div>
            </div>

            <div className="space-y-1.5 max-w-xs">
              <h4 className="text-sm font-bold text-text-primary capitalize">
                {publishStatus === "validating" && "Validating Thread Payload..."}
                {publishStatus === "creating" && "Creating Post Container..."}
                {publishStatus === "processing" && "Processing Thread Media..."}
                {publishStatus === "publishing" && "Publishing to Threads..."}
                {publishStatus === "confirming" && "Confirming Publication..."}
              </h4>
              <p className="text-xs text-text-muted leading-relaxed">
                {uiProgressNote || (publishStatus === "confirming"
                  ? "Meta is processing your thread. Confirming live publication status..."
                  : "Communicating with official Meta Threads API...")}
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="text-[11px] text-text-muted hover:text-text-primary underline transition cursor-pointer"
              >
                Close (runs in background)
              </button>
            </div>
          </div>
        ) : publishStatus === "publishing_uncertain" ? (
          /* Ambiguous / Slow Processing Reconciliation State */
          <div className="py-6 space-y-4 text-center">
            <div className="mx-auto w-12 h-12 bg-brand-surface text-brand-text border border-brand-border rounded-full flex items-center justify-center">
              <Clock className="h-6 w-6" />
            </div>
            <div className="space-y-1.5">
              <h4 className="text-sm font-bold text-text-primary">Confirming Publication</h4>
              <p className="text-xs text-text-muted leading-relaxed max-w-sm mx-auto">
                Publication is taking longer than expected on Meta Threads. Your post may still be processing. Please check your Threads profile before attempting to retry.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row justify-center gap-2 pt-2">
              <a
                href={`https://threads.net/@${threadsUsername || "user"}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 font-bold px-4 py-2.5 text-xs text-white transition cursor-pointer shadow-md"
              >
                <span>View Threads Profile</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
              <button
                type="button"
                onClick={() => reconcileStatus(activeIdempotencyKey, postId, userId)}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-bg-app hover:bg-bg-card-hover border border-border-primary font-bold px-4 py-2.5 text-xs text-text-primary transition cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Check Status Again</span>
              </button>
            </div>
          </div>
        ) : publishStatus === "success" ? (
          /* Successfully Published Overlay */
          <div className="py-6 space-y-5 text-center">
            <div className="mx-auto w-12 h-12 bg-status-success-bg text-status-success-text border border-status-success-border rounded-full flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div className="space-y-1.5">
              <h4 className="text-sm font-bold text-text-primary">✓ Published to Threads</h4>
              <p className="text-xs text-text-muted leading-relaxed max-w-sm mx-auto">
                Your post is live and ready for interactions on Meta Threads.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-2 pt-2">
              {publishedUrl && (
                <a 
                  href={publishedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-bg-app hover:bg-bg-card-hover border border-border-primary font-bold px-4 py-2 text-xs text-text-primary transition cursor-pointer"
                >
                  <span>View on Threads</span>
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              )}
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center rounded-xl bg-purple-600 hover:bg-purple-500 font-bold px-4 py-2 text-xs text-white transition cursor-pointer shadow-md"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Active Posting Review Flow (idle or failed) */
          <div className="space-y-4">
            {/* Status Information Ribbon */}
            <div className="flex items-center justify-between text-xs bg-bg-app p-2 text-text-muted rounded-lg border border-border-primary">
              <span className="flex items-center gap-1.5 font-medium text-text-muted">
                <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                Connected as <span className="text-text-primary font-bold">@{threadsUsername}</span>
              </span>
              <span className={`text-[10px] uppercase font-mono font-semibold px-1.5 py-0.5 rounded border ${isSandbox ? "bg-status-warning-bg text-status-warning-text border-status-warning-border" : "bg-brand-surface text-brand-text-strong border-brand-border"}`}>
                {isSandbox ? "Sandbox" : "Live API"}
              </span>
            </div>

            {/* Error Banner */}
            {publishStatus === "failed" && (
              <div className="rounded-xl border border-status-danger-border bg-status-danger-bg p-3.5 space-y-2 text-xs text-status-danger-text">
                <div className="flex items-center gap-2 font-bold">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>Failed To Publish {errorStage ? `(${errorStage})` : ""}</span>
                </div>
                <p className="text-[11px] text-text-secondary leading-relaxed font-sans">{publishError}</p>
                <div className="pt-1 flex gap-2">
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold transition cursor-pointer"
                  >
                    <RotateCcw className="h-3 w-3" /> Retry
                  </button>
                </div>
              </div>
            )}

            {/* Multi-part Thread Editor */}
            <div className="space-y-3.5 max-h-[360px] overflow-y-auto pr-1">
              <div className="flex justify-between items-center text-xs select-none">
                <span className="font-bold uppercase tracking-wide text-text-muted text-[10px]">Review Thread Parts</span>
                <span className="text-[10px] text-text-muted font-mono">
                  {threadParts.length} {threadParts.length === 1 ? "part" : "parts"}
                </span>
              </div>

              <div className="space-y-3">
                {threadParts.map((part, index) => {
                  const isPartOverLimit = part.length > 500;
                  return (
                    <div key={index} className="space-y-2 border border-border-primary bg-bg-app p-3 rounded-xl transition hover:border-border-secondary">
                      <div className="flex justify-between items-center text-xs select-none">
                        <span className="font-bold text-brand-text-strong font-mono text-[10px]">
                          PART {index + 1}
                        </span>
                        <div className="flex items-center gap-2.5">
                          <span className={`font-mono text-[10px] ${isPartOverLimit ? "text-status-danger-text font-bold" : "text-text-muted"}`}>
                            {part.length} / 500
                          </span>
                          {threadParts.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const updated = threadParts.filter((_, i) => i !== index);
                                setThreadParts(updated);
                              }}
                              className="text-status-danger-text hover:underline font-semibold text-[10px] uppercase tracking-wider transition cursor-pointer"
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
                        placeholder={`Write thread Part ${index + 1}...`}
                        rows={3}
                        className="w-full rounded-lg border border-border-primary bg-bg-card p-2.5 text-xs text-text-primary placeholder-text-muted outline-none focus:border-purple-500 transition font-sans leading-relaxed resize-none"
                      />

                      {isPartOverLimit && (
                        <p className="text-[10px] text-status-danger-text leading-normal">
                          ⚠️ Exceeds Meta's 500 character limit. Please trim this part.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="pt-1 flex justify-start">
                <button
                  type="button"
                  onClick={() => setThreadParts([...threadParts, ""])}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-brand-border bg-brand-surface hover:bg-brand-surface-hover text-brand-text-strong font-bold px-3 py-1.5 text-[11px] transition cursor-pointer"
                >
                  + Add to Thread
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2.5 pt-3 border-t border-border-primary">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-border-primary bg-bg-app px-4 py-2 text-xs font-semibold text-text-secondary hover:text-text-primary transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePublish}
                disabled={hasExcessivePartLength || isAnyPartEmpty || threadParts.length === 0 || isPublishingActive}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-purple-600/20 cursor-pointer transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>Publish Thread</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
