/**
 * Authoritative scheduled-post dispatch, cancellation, deletion, and retry guard.
 *
 * Guarantees:
 * 1. Deleted Firestore documents are NEVER claimed or published (evicted from cache).
 * 2. Canceled or unscheduled posts are NEVER claimed, published, or resurrected by retries.
 * 3. Concurrent claim vs cancel/delete races resolve atomically via transaction.
 * 4. Pre-publish verification re-checks authoritative storage immediately before Meta API calls.
 * 5. In-progress ("Publishing") posts cannot be silently marked canceled after external dispatch starts.
 */
import crypto from "node:crypto";

export const SCHEDULED_GRACE_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface ScheduledPostSnapshot {
  exists: boolean;
  data(): Record<string, any> | undefined;
}

export interface ScheduledPostTransaction {
  get(postId: string): Promise<ScheduledPostSnapshot>;
  update(postId: string, patch: Record<string, any>): void;
  delete(postId: string): void;
}

export interface ScheduledPostStoreAdapter {
  getPost(postId: string): Promise<Record<string, any> | null>;
  runTransaction<T>(fn: (tx: ScheduledPostTransaction) => Promise<T>): Promise<T>;
}

export function createFirestoreScheduledPostStore(serverDb: any): ScheduledPostStoreAdapter {
  return {
    async getPost(postId: string): Promise<Record<string, any> | null> {
      const snap = await serverDb.collection("posts").doc(postId).get();
      if (!snap || !snap.exists) return null;
      return snap.data() || null;
    },
    async runTransaction<T>(fn: (tx: ScheduledPostTransaction) => Promise<T>): Promise<T> {
      return serverDb.runTransaction(async (fsTx: any) => {
        const adapterTx: ScheduledPostTransaction = {
          async get(postId: string): Promise<ScheduledPostSnapshot> {
            const ref = serverDb.collection("posts").doc(postId);
            const snap = await fsTx.get(ref);
            return {
              exists: Boolean(snap && snap.exists),
              data: () => (snap && snap.exists ? snap.data() || {} : undefined),
            };
          },
          update(postId: string, patch: Record<string, any>): void {
            const ref = serverDb.collection("posts").doc(postId);
            fsTx.update(ref, patch);
          },
          delete(postId: string): void {
            const ref = serverDb.collection("posts").doc(postId);
            fsTx.delete(ref);
          },
        };
        return fn(adapterTx);
      });
    },
  };
}

export function parseScheduledTimestampMs(rawScheduledFor: unknown): number {
  if (!rawScheduledFor) return NaN;
  if (rawScheduledFor instanceof Date) {
    return rawScheduledFor.getTime();
  }
  if (typeof rawScheduledFor === "object") {
    const obj = rawScheduledFor as Record<string, any>;
    if (typeof obj.toDate === "function") {
      try {
        return obj.toDate().getTime();
      } catch {
        return NaN;
      }
    }
    if (typeof obj.seconds === "number") {
      return obj.seconds * 1000;
    }
    if (typeof obj._seconds === "number") {
      return obj._seconds * 1000;
    }
  }
  if (typeof rawScheduledFor === "string" || typeof rawScheduledFor === "number") {
    return new Date(rawScheduledFor).getTime();
  }
  return NaN;
}

export function isPostMarkedCanceled(postData: Record<string, any> | null | undefined): boolean {
  if (!postData || typeof postData !== "object") return false;
  if (
    postData.isCanceled === true ||
    postData.isCancelled === true ||
    Boolean(postData.canceledAt) ||
    Boolean(postData.cancelledAt) ||
    postData.cancelRequested === true
  ) {
    return true;
  }
  const normalizedStatus = String(postData.status || "").trim().toLowerCase();
  const normalizedStage = String(postData.stage || "").trim().toLowerCase();
  return (
    normalizedStatus === "canceled" ||
    normalizedStatus === "cancelled" ||
    normalizedStage === "canceled" ||
    normalizedStage === "cancelled"
  );
}

export interface EligibilityEvaluation {
  eligible: boolean;
  reason?: string;
  evictFromCache: boolean;
  scheduledMs?: number;
}

export function evaluateScheduledEligibility(
  postData: Record<string, any> | null | undefined,
  nowMs: number = Date.now(),
  options?: { allowPublishingState?: boolean; skipGraceWindowCheck?: boolean }
): EligibilityEvaluation {
  if (!postData || typeof postData !== "object") {
    return { eligible: false, reason: "DELETED", evictFromCache: true };
  }

  if (isPostMarkedCanceled(postData)) {
    return { eligible: false, reason: "POST_CANCELED", evictFromCache: true };
  }

  const normalizedStatus = String(postData.status || "").trim().toLowerCase();
  if (postData.isPublished === true || normalizedStatus === "published") {
    return { eligible: false, reason: "ALREADY_PUBLISHED", evictFromCache: true };
  }

  if (normalizedStatus === "publishing") {
    if (!options?.allowPublishingState) {
      return { eligible: false, reason: "ALREADY_PUBLISHING", evictFromCache: false };
    }
  } else if (normalizedStatus !== "scheduled") {
    return {
      eligible: false,
      reason: `STATUS_NOT_SCHEDULED:${normalizedStatus || "empty"}`,
      evictFromCache: true,
    };
  }

  const scheduledMs = parseScheduledTimestampMs(postData.scheduledFor);
  if (!Number.isFinite(scheduledMs) || scheduledMs <= 0) {
    return { eligible: false, reason: "INVALID_SCHEDULED_FOR", evictFromCache: true };
  }

  if (scheduledMs > nowMs) {
    return { eligible: false, reason: "NOT_DUE_YET", evictFromCache: false, scheduledMs };
  }

  if (!options?.skipGraceWindowCheck && scheduledMs < nowMs - SCHEDULED_GRACE_WINDOW_MS) {
    return { eligible: false, reason: "MISSED", evictFromCache: true, scheduledMs };
  }

  return { eligible: true, evictFromCache: false, scheduledMs };
}

export interface ClaimScheduledPostResult {
  claimed: boolean;
  evictFromCache: boolean;
  reason?: string;
  claimToken?: string;
  postData?: Record<string, any>;
}

export async function claimScheduledPostTransaction(
  store: ScheduledPostStoreAdapter,
  postId: string,
  nowMs: number = Date.now()
): Promise<ClaimScheduledPostResult> {
  const nowIso = new Date(nowMs).toISOString();
  const claimToken = `claim_${nowMs}_${crypto.randomBytes(6).toString("hex")}`;

  return store.runTransaction(async (tx) => {
    const snap = await tx.get(postId);
    if (!snap.exists) {
      // Deleted Firestore documents MUST NEVER be claimed or published.
      return { claimed: false, evictFromCache: true, reason: "DELETED" };
    }

    const data = snap.data() || {};
    const evalResult = evaluateScheduledEligibility(data, nowMs);
    if (!evalResult.eligible) {
      if (evalResult.reason === "MISSED") {
        tx.update(postId, {
          status: "Missed",
          error: "This post missed its scheduled time by more than 24 hours. Reschedule it or publish it now.",
          errorMessage: "This post missed its scheduled time by more than 24 hours. Reschedule it or publish it now.",
          updatedAt: nowIso,
        });
      }
      return {
        claimed: false,
        evictFromCache: evalResult.evictFromCache,
        reason: evalResult.reason,
        postData: data,
      };
    }

    tx.update(postId, {
      status: "Publishing",
      publishingClaimedAt: nowIso,
      publishingClaimToken: claimToken,
      updatedAt: nowIso,
    });

    return {
      claimed: true,
      evictFromCache: false,
      claimToken,
      postData: {
        ...data,
        status: "Publishing",
        publishingClaimedAt: nowIso,
        publishingClaimToken: claimToken,
      },
    };
  });
}

export interface PrePublishVerificationResult {
  allowed: boolean;
  evictFromCache: boolean;
  alreadyPublished?: boolean;
  existingPostId?: string;
  reason?: string;
}

/**
 * Re-verifies authoritative Firestore state immediately before issuing external
 * Meta Threads API calls. Aborts cleanly if the post was deleted, canceled,
 * unscheduled, or already published between claim and dispatch.
 */
export async function verifyBeforeExternalPublish(
  store: ScheduledPostStoreAdapter,
  postId: string,
  options?: { expectedClaimToken?: string; nowMs?: number }
): Promise<PrePublishVerificationResult> {
  const data = await store.getPost(postId);
  if (!data) {
    return { allowed: false, evictFromCache: true, reason: "DELETED" };
  }

  if (isPostMarkedCanceled(data)) {
    return { allowed: false, evictFromCache: true, reason: "POST_CANCELED" };
  }

  const normalizedStatus = String(data.status || "").trim().toLowerCase();
  if (data.isPublished === true || normalizedStatus === "published") {
    return {
      allowed: false,
      evictFromCache: true,
      alreadyPublished: true,
      existingPostId: typeof data.postId === "string" ? data.postId : undefined,
      reason: "ALREADY_PUBLISHED",
    };
  }

  if (normalizedStatus !== "publishing" && normalizedStatus !== "scheduled") {
    return {
      allowed: false,
      evictFromCache: true,
      reason: `STATUS_CHANGED:${normalizedStatus || "empty"}`,
    };
  }

  if (
    options?.expectedClaimToken &&
    data.publishingClaimToken &&
    data.publishingClaimToken !== options.expectedClaimToken
  ) {
    return {
      allowed: false,
      evictFromCache: false,
      reason: "CLAIM_TOKEN_MISMATCH",
    };
  }

  const evalResult = evaluateScheduledEligibility(data, options?.nowMs ?? Date.now(), {
    allowPublishingState: true,
    skipGraceWindowCheck: true,
  });
  if (!evalResult.eligible) {
    return {
      allowed: false,
      evictFromCache: evalResult.evictFromCache,
      reason: evalResult.reason,
    };
  }

  return { allowed: true, evictFromCache: false };
}

export type CancelMode = "cancel" | "unschedule" | "delete";

export type CancelOutcome =
  | "canceled"
  | "unscheduled"
  | "deleted"
  | "not_found"
  | "already_publishing"
  | "already_published"
  | "forbidden";

export interface CancelScheduledPostResult {
  ok: boolean;
  outcome: CancelOutcome;
  evictFromCache: boolean;
  message: string;
}

/**
 * Atomically cancels, unschedules, or deletes a scheduled post.
 * Explicitly distinguishes pre-publish cancellation from irreversible in-progress
 * ("Publishing") or completed ("Published") states.
 */
export async function cancelScheduledPostTransaction(
  store: ScheduledPostStoreAdapter,
  params: {
    postId: string;
    userId: string;
    mode: CancelMode;
    nextStatus?: "Draft" | "Ready" | "Planned" | "Canceled";
    nowMs?: number;
  }
): Promise<CancelScheduledPostResult> {
  const nowIso = new Date(params.nowMs ?? Date.now()).toISOString();

  return store.runTransaction(async (tx) => {
    const snap = await tx.get(params.postId);
    if (!snap.exists) {
      return {
        ok: true,
        outcome: "not_found",
        evictFromCache: true,
        message: "Post was already removed.",
      };
    }

    const data = snap.data() || {};
    if (data.userId && String(data.userId).trim() !== String(params.userId).trim()) {
      return {
        ok: false,
        outcome: "forbidden",
        evictFromCache: false,
        message: "Access denied: cannot modify another user's post.",
      };
    }

    const normalizedStatus = String(data.status || "").trim().toLowerCase();
    if (data.isPublished === true || normalizedStatus === "published") {
      return {
        ok: false,
        outcome: "already_published",
        evictFromCache: true,
        message: "This post has already been published to Threads and cannot be canceled.",
      };
    }

    if (normalizedStatus === "publishing") {
      // Signal pre-publish abort guard in case external Meta API call has not started yet,
      // while clearly reporting that publishing is already in progress.
      tx.update(params.postId, {
        cancelRequested: true,
        cancelRequestedAt: nowIso,
        updatedAt: nowIso,
      });
      return {
        ok: false,
        outcome: "already_publishing",
        evictFromCache: false,
        message:
          "Publishing is already in progress. Cancellation was requested before external dispatch; refresh shortly to confirm final status.",
      };
    }

    if (params.mode === "delete") {
      tx.delete(params.postId);
      return {
        ok: true,
        outcome: "deleted",
        evictFromCache: true,
        message: "Scheduled post permanently deleted and removed from dispatch queue.",
      };
    }

    if (params.mode === "unschedule") {
      const targetStage = params.nextStatus || "Ready";
      tx.update(params.postId, {
        status: targetStage,
        stage: targetStage,
        scheduledFor: null,
        scheduledAt: null,
        isCanceled: true,
        canceledAt: nowIso,
        cancelRequested: false,
        publishingClaimToken: null,
        updatedAt: nowIso,
      });
      return {
        ok: true,
        outcome: "unscheduled",
        evictFromCache: true,
        message: `Post unscheduled and moved to ${targetStage}.`,
      };
    }

    tx.update(params.postId, {
      status: "Canceled",
      stage: "Canceled",
      scheduledFor: null,
      scheduledAt: null,
      isCanceled: true,
      canceledAt: nowIso,
      cancelRequested: false,
      publishingClaimToken: null,
      updatedAt: nowIso,
    });
    return {
      ok: true,
      outcome: "canceled",
      evictFromCache: true,
      message: "Scheduled post canceled and removed from dispatch queue.",
    };
  });
}

export interface RequeueTransientFailureResult {
  requeued: boolean;
  evictFromCache: boolean;
  reason?: string;
}

/**
 * Atomically transitions a transient publish failure from Publishing -> Scheduled.
 * NEVER resurrects a post that was deleted, canceled, unscheduled, or published
 * while the publish attempt was running.
 */
export async function requeueTransientFailureTransaction(
  store: ScheduledPostStoreAdapter,
  params: {
    postId: string;
    retryCount: number;
    errorMsg: string;
    expectedClaimToken?: string;
    nowMs?: number;
  }
): Promise<RequeueTransientFailureResult> {
  const nowIso = new Date(params.nowMs ?? Date.now()).toISOString();

  return store.runTransaction(async (tx) => {
    const snap = await tx.get(params.postId);
    if (!snap.exists) {
      return { requeued: false, evictFromCache: true, reason: "DELETED" };
    }

    const data = snap.data() || {};
    const normalizedStatus = String(data.status || "").trim().toLowerCase();

    if (isPostMarkedCanceled(data)) {
      if (normalizedStatus === "publishing") {
        tx.update(params.postId, {
          status: "Canceled",
          stage: "Canceled",
          scheduledFor: null,
          scheduledAt: null,
          isCanceled: true,
          canceledAt: data.canceledAt || nowIso,
          cancelRequested: false,
          publishingClaimToken: null,
          updatedAt: nowIso,
        });
      }
      return { requeued: false, evictFromCache: true, reason: "POST_CANCELED" };
    }

    if (data.isPublished === true || normalizedStatus === "published") {
      return { requeued: false, evictFromCache: true, reason: "ALREADY_PUBLISHED" };
    }

    if (normalizedStatus !== "publishing") {
      return {
        requeued: false,
        evictFromCache: true,
        reason: `STATUS_CHANGED:${normalizedStatus || "empty"}`,
      };
    }

    if (
      params.expectedClaimToken &&
      data.publishingClaimToken &&
      data.publishingClaimToken !== params.expectedClaimToken
    ) {
      return { requeued: false, evictFromCache: false, reason: "CLAIM_TOKEN_MISMATCH" };
    }

    tx.update(params.postId, {
      status: "Scheduled",
      retryCount: params.retryCount,
      lastAttemptAt: nowIso,
      lastError: params.errorMsg,
      errorMessage: `Transient error during attempt ${params.retryCount}/3: ${params.errorMsg}. Retrying automatically.`,
      publishingClaimToken: null,
      updatedAt: nowIso,
    });

    return { requeued: true, evictFromCache: false };
  });
}

/**
 * Safely settles a post that was aborted before Meta API dispatch because a
 * cancellation arrived during the claim-to-publish micro-window.
 */
export async function finalizeAbortedPrePublishCancellation(
  store: ScheduledPostStoreAdapter,
  postId: string,
  nowMs: number = Date.now()
): Promise<void> {
  const nowIso = new Date(nowMs).toISOString();
  await store.runTransaction(async (tx) => {
    const snap = await tx.get(postId);
    if (!snap.exists) return;
    const data = snap.data() || {};
    const normalizedStatus = String(data.status || "").trim().toLowerCase();
    if (normalizedStatus === "publishing" && data.cancelRequested === true) {
      tx.update(postId, {
        status: "Canceled",
        stage: "Canceled",
        scheduledFor: null,
        scheduledAt: null,
        isCanceled: true,
        canceledAt: data.canceledAt || nowIso,
        cancelRequested: false,
        publishingClaimToken: null,
        updatedAt: nowIso,
      });
    }
  });
}
