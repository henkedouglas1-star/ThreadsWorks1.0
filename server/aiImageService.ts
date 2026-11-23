import crypto from "crypto";
import type { Firestore } from "firebase-admin/firestore";
import { getAI } from "./geminiClient";
import {
  ENTITLED_PRO_UIDS,
  isEntitledAccount,
} from "./generationLimitService";
import { buildContextualImagePrompt } from "./aiImagePromptBuilder";
import {
  type AiImageAssetStore,
  inspectImageBuffer,
  type StoredImageMetadata,
} from "./aiImageStorage";
import {
  buildAllowanceCopy,
  FREE_WEEKLY_IMAGE_LIMIT,
  PRO_DAILY_IMAGE_LIMIT,
  type GeneratePostImageResponse,
  type ImageAllowanceStatus,
  type ImageAspectRatio,
  type ImageGenerationRequestPayload,
  type ImagePlan,
  type PostAttachedImage,
} from "../src/types/aiImage";

export const AI_IMAGE_MODEL = "gemini-3.1-flash-lite-image";
export const IMAGE_RESERVATION_TTL_MS = 90_000;
export const DEFAULT_PROVIDER_TIMEOUT_MS = 45_000;

export interface UtcPeriodWindow {
  plan: ImagePlan;
  periodType: "weekly" | "daily";
  limit: number;
  periodKey: string;
  bucketKey: string;
  periodStartIso: string;
  nextResetAtIso: string;
}

/**
 * Computes authoritative UTC period window and reset boundary for the given plan:
 * - Free: calendar week anchored to Monday 00:00:00.000Z (resets every Monday 00:00 UTC)
 * - Pro: calendar day anchored to 00:00:00.000Z (resets every day 00:00 UTC)
 */
export function getUtcPeriodWindow(
  plan: ImagePlan,
  now: Date = new Date()
): UtcPeriodWindow {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const day = now.getUTCDate();

  if (plan === "pro") {
    const startMs = Date.UTC(year, month, day, 0, 0, 0, 0);
    const nextResetMs = Date.UTC(year, month, day + 1, 0, 0, 0, 0);
    const yyyy = String(year);
    const mm = String(month + 1).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    const periodKey = `${yyyy}-${mm}-${dd}`;
    return {
      plan: "pro",
      periodType: "daily",
      limit: PRO_DAILY_IMAGE_LIMIT,
      periodKey,
      bucketKey: `pro:daily:${periodKey}`,
      periodStartIso: new Date(startMs).toISOString(),
      nextResetAtIso: new Date(nextResetMs).toISOString(),
    };
  }

  // Free plan: Monday 00:00:00 UTC -> next Monday 00:00:00 UTC
  // JS getUTCDay(): Sun=0, Mon=1, Tue=2, ..., Sat=6 -> Mon=0..Sun=6
  const mondayOffset = (now.getUTCDay() + 6) % 7;
  const mondayStartMs = Date.UTC(year, month, day - mondayOffset, 0, 0, 0, 0);
  const nextMondayMs = mondayStartMs + 7 * 24 * 60 * 60 * 1000;
  const mondayDate = new Date(mondayStartMs);
  const mYear = String(mondayDate.getUTCFullYear());
  const mMonth = String(mondayDate.getUTCMonth() + 1).padStart(2, "0");
  const mDay = String(mondayDate.getUTCDate()).padStart(2, "0");
  const periodKey = `week-of-${mYear}-${mMonth}-${mDay}`;

  return {
    plan: "free",
    periodType: "weekly",
    limit: FREE_WEEKLY_IMAGE_LIMIT,
    periodKey,
    bucketKey: `free:weekly:${periodKey}`,
    periodStartIso: mondayDate.toISOString(),
    nextResetAtIso: new Date(nextMondayMs).toISOString(),
  };
}

export interface UsageReservationEntry {
  requestId: string;
  postId?: string;
  reservedAtMs: number;
  expiresAtMs: number;
}

export interface PlanPeriodBucket {
  plan: ImagePlan;
  bucketKey: string;
  limit: number;
  committedCount: number;
  committedRequestIds: string[];
  activeReservations: UsageReservationEntry[];
  updatedAt: string;
}

export interface ImageRequestLedgerRecord {
  requestId: string;
  userId: string;
  postId?: string;
  plan: ImagePlan;
  bucketKey: string;
  status: "reserved" | "succeeded" | "failed";
  image?: PostAttachedImage;
  error?: string;
  errorCode?: string;
  createdAt: string;
  updatedAt: string;
  expiresAtMs: number;
}

export interface UserImageUsageDoc {
  userId: string;
  buckets: Record<string, PlanPeriodBucket>;
  history: Array<{
    requestId: string;
    imageId: string;
    plan: ImagePlan;
    bucketKey: string;
    postId?: string;
    committedAt: string;
  }>;
  updatedAt: string;
}

export type ReserveSlotOutcome =
  | {
      kind: "reserved";
      allowance: ImageAllowanceStatus;
    }
  | {
      kind: "recovered";
      image: PostAttachedImage;
      allowance: ImageAllowanceStatus;
    }
  | {
      kind: "in_progress";
      allowance: ImageAllowanceStatus;
    }
  | {
      kind: "limit_reached";
      allowance: ImageAllowanceStatus;
    };

export interface AiImageUsageStore {
  getAllowanceStatus(
    userId: string,
    plan: ImagePlan,
    now: Date
  ): Promise<ImageAllowanceStatus>;
  reserveSlot(params: {
    userId: string;
    plan: ImagePlan;
    requestId: string;
    postId?: string;
    now: Date;
    reservationTtlMs: number;
  }): Promise<ReserveSlotOutcome>;
  commitSuccess(params: {
    userId: string;
    plan: ImagePlan;
    requestId: string;
    postId?: string;
    image: PostAttachedImage;
    now: Date;
  }): Promise<ImageAllowanceStatus>;
  releaseReservation(params: {
    userId: string;
    plan: ImagePlan;
    requestId: string;
    error: string;
    errorCode: string;
    now: Date;
  }): Promise<ImageAllowanceStatus>;
  findRecoverableImage(
    userId: string,
    postId?: string,
    requestId?: string
  ): Promise<PostAttachedImage | null>;
}

function buildAllowanceStatusFromBucket(
  window: UtcPeriodWindow,
  bucket: PlanPeriodBucket | undefined,
  nowMs: number
): ImageAllowanceStatus {
  const committed = bucket?.committedCount || 0;
  const activeReservations = (bucket?.activeReservations || []).filter(
    (r) => r.expiresAtMs > nowMs
  );
  const reservedInFlight = activeReservations.length;
  const effectiveUsed = committed + reservedInFlight;
  const remaining = Math.max(0, window.limit - effectiveUsed);
  const copy = buildAllowanceCopy(window.plan, window.limit, remaining);

  return {
    plan: window.plan,
    isPro: window.plan === "pro",
    limit: window.limit,
    used: committed,
    remaining,
    reservedInFlight,
    periodType: window.periodType,
    periodKey: window.periodKey,
    nextResetAtIso: window.nextResetAtIso,
    resetLabel: copy.resetLabel,
    remainingText: copy.remainingText,
    exhaustedText: copy.exhaustedText,
    upgradePrompt: copy.upgradePrompt,
  };
}

function normalizeBucket(
  existing: PlanPeriodBucket | undefined,
  window: UtcPeriodWindow,
  nowMs: number
): PlanPeriodBucket {
  const activeReservations = (existing?.activeReservations || []).filter(
    (r) => r.expiresAtMs > nowMs
  );
  return {
    plan: window.plan,
    bucketKey: window.bucketKey,
    limit: window.limit,
    committedCount: existing?.committedCount || 0,
    committedRequestIds: Array.isArray(existing?.committedRequestIds)
      ? [...existing.committedRequestIds]
      : [],
    activeReservations,
    updatedAt: new Date(nowMs).toISOString(),
  };
}

function ledgerKey(userId: string, requestId: string): string {
  const safeUid = userId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
  const safeReq = requestId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
  return `${safeUid}__${safeReq}`;
}

/**
 * Serializes concurrent operations per user within this Node process.
 */
class PerUserLock {
  private readonly chains = new Map<string, Promise<unknown>>();

  async run<T>(userId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.chains.get(userId) || Promise.resolve();
    let release!: () => void;
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.chains.set(userId, next);

    try {
      await prev;
      return await fn();
    } finally {
      release();
      if (this.chains.get(userId) === next) {
        this.chains.delete(userId);
      }
    }
  }
}

/**
 * In-memory atomic usage store for deterministic unit/integration testing
 * and local fallback when Firestore is unavailable.
 */
export class InMemoryAiImageUsageStore implements AiImageUsageStore {
  private readonly usageByUser = new Map<string, UserImageUsageDoc>();
  private readonly requestsByKey = new Map<string, ImageRequestLedgerRecord>();
  private readonly lock = new PerUserLock();

  private getOrCreateUsage(userId: string, nowIso: string): UserImageUsageDoc {
    let doc = this.usageByUser.get(userId);
    if (!doc) {
      doc = { userId, buckets: {}, history: [], updatedAt: nowIso };
      this.usageByUser.set(userId, doc);
    }
    return doc;
  }

  async getAllowanceStatus(
    userId: string,
    plan: ImagePlan,
    now: Date
  ): Promise<ImageAllowanceStatus> {
    const window = getUtcPeriodWindow(plan, now);
    const doc = this.usageByUser.get(userId);
    const bucket = doc?.buckets[window.bucketKey];
    return buildAllowanceStatusFromBucket(window, bucket, now.getTime());
  }

  async reserveSlot(params: {
    userId: string;
    plan: ImagePlan;
    requestId: string;
    postId?: string;
    now: Date;
    reservationTtlMs: number;
  }): Promise<ReserveSlotOutcome> {
    return this.lock.run(params.userId, async () => {
      const nowMs = params.now.getTime();
      const nowIso = params.now.toISOString();
      const window = getUtcPeriodWindow(params.plan, params.now);
      const usageDoc = this.getOrCreateUsage(params.userId, nowIso);
      const bucket = normalizeBucket(
        usageDoc.buckets[window.bucketKey],
        window,
        nowMs
      );
      usageDoc.buckets[window.bucketKey] = bucket;

      const reqKey = ledgerKey(params.userId, params.requestId);
      const existingReq = this.requestsByKey.get(reqKey);
      if (existingReq) {
        if (existingReq.status === "succeeded" && existingReq.image) {
          return {
            kind: "recovered",
            image: existingReq.image,
            allowance: buildAllowanceStatusFromBucket(window, bucket, nowMs),
          };
        }
        if (
          existingReq.status === "reserved" &&
          existingReq.expiresAtMs > nowMs
        ) {
          return {
            kind: "in_progress",
            allowance: buildAllowanceStatusFromBucket(window, bucket, nowMs),
          };
        }
      }

      if (bucket.committedCount + bucket.activeReservations.length >= window.limit) {
        return {
          kind: "limit_reached",
          allowance: buildAllowanceStatusFromBucket(window, bucket, nowMs),
        };
      }

      const expiresAtMs = nowMs + params.reservationTtlMs;
      bucket.activeReservations.push({
        requestId: params.requestId,
        postId: params.postId,
        reservedAtMs: nowMs,
        expiresAtMs,
      });
      bucket.updatedAt = nowIso;
      usageDoc.updatedAt = nowIso;

      this.requestsByKey.set(reqKey, {
        requestId: params.requestId,
        userId: params.userId,
        postId: params.postId,
        plan: params.plan,
        bucketKey: window.bucketKey,
        status: "reserved",
        createdAt: nowIso,
        updatedAt: nowIso,
        expiresAtMs,
      });

      return {
        kind: "reserved",
        allowance: buildAllowanceStatusFromBucket(window, bucket, nowMs),
      };
    });
  }

  async commitSuccess(params: {
    userId: string;
    plan: ImagePlan;
    requestId: string;
    postId?: string;
    image: PostAttachedImage;
    now: Date;
  }): Promise<ImageAllowanceStatus> {
    return this.lock.run(params.userId, async () => {
      const nowMs = params.now.getTime();
      const nowIso = params.now.toISOString();
      const window = getUtcPeriodWindow(params.plan, params.now);
      const usageDoc = this.getOrCreateUsage(params.userId, nowIso);
      const bucket = normalizeBucket(
        usageDoc.buckets[window.bucketKey],
        window,
        nowMs
      );

      bucket.activeReservations = bucket.activeReservations.filter(
        (r) => r.requestId !== params.requestId
      );

      if (!bucket.committedRequestIds.includes(params.requestId)) {
        bucket.committedRequestIds.push(params.requestId);
        bucket.committedCount += 1;
        usageDoc.history.push({
          requestId: params.requestId,
          imageId: params.image.imageId,
          plan: params.plan,
          bucketKey: window.bucketKey,
          postId: params.postId,
          committedAt: nowIso,
        });
        if (usageDoc.history.length > 60) {
          usageDoc.history = usageDoc.history.slice(-60);
        }
      }

      bucket.updatedAt = nowIso;
      usageDoc.buckets[window.bucketKey] = bucket;
      usageDoc.updatedAt = nowIso;

      const reqKey = ledgerKey(params.userId, params.requestId);
      const existing = this.requestsByKey.get(reqKey);
      this.requestsByKey.set(reqKey, {
        requestId: params.requestId,
        userId: params.userId,
        postId: params.postId,
        plan: params.plan,
        bucketKey: window.bucketKey,
        status: "succeeded",
        image: params.image,
        createdAt: existing?.createdAt || nowIso,
        updatedAt: nowIso,
        expiresAtMs: nowMs,
      });

      return buildAllowanceStatusFromBucket(window, bucket, nowMs);
    });
  }

  async releaseReservation(params: {
    userId: string;
    plan: ImagePlan;
    requestId: string;
    error: string;
    errorCode: string;
    now: Date;
  }): Promise<ImageAllowanceStatus> {
    return this.lock.run(params.userId, async () => {
      const nowMs = params.now.getTime();
      const nowIso = params.now.toISOString();
      const window = getUtcPeriodWindow(params.plan, params.now);
      const usageDoc = this.getOrCreateUsage(params.userId, nowIso);
      const bucket = normalizeBucket(
        usageDoc.buckets[window.bucketKey],
        window,
        nowMs
      );

      bucket.activeReservations = bucket.activeReservations.filter(
        (r) => r.requestId !== params.requestId
      );
      bucket.updatedAt = nowIso;
      usageDoc.buckets[window.bucketKey] = bucket;
      usageDoc.updatedAt = nowIso;

      const reqKey = ledgerKey(params.userId, params.requestId);
      const existing = this.requestsByKey.get(reqKey);
      this.requestsByKey.set(reqKey, {
        requestId: params.requestId,
        userId: params.userId,
        postId: existing?.postId,
        plan: params.plan,
        bucketKey: window.bucketKey,
        status: "failed",
        error: params.error,
        errorCode: params.errorCode,
        createdAt: existing?.createdAt || nowIso,
        updatedAt: nowIso,
        expiresAtMs: nowMs,
      });

      return buildAllowanceStatusFromBucket(window, bucket, nowMs);
    });
  }

  async findRecoverableImage(
    userId: string,
    postId?: string,
    requestId?: string
  ): Promise<PostAttachedImage | null> {
    if (requestId) {
      const direct = this.requestsByKey.get(ledgerKey(userId, requestId));
      if (direct && direct.status === "succeeded" && direct.image) {
        return direct.image;
      }
    }
    if (!postId) return null;

    let latest: ImageRequestLedgerRecord | null = null;
    for (const rec of this.requestsByKey.values()) {
      if (
        rec.userId === userId &&
        rec.postId === postId &&
        rec.status === "succeeded" &&
        rec.image
      ) {
        if (!latest || rec.updatedAt > latest.updatedAt) {
          latest = rec;
        }
      }
    }
    return latest?.image ?? null;
  }

  /** Test helper to inspect historical usage records. */
  getUserUsageSnapshot(userId: string): UserImageUsageDoc | undefined {
    return this.usageByUser.get(userId);
  }
}

/**
 * Production Firestore transactional usage store with per-user serialization
 * and automatic fallback recovery.
 */
export class FirestoreAiImageUsageStore implements AiImageUsageStore {
  private readonly serverDb: Firestore;
  private readonly lock = new PerUserLock();

  constructor(serverDb: Firestore) {
    this.serverDb = serverDb;
  }

  async getAllowanceStatus(
    userId: string,
    plan: ImagePlan,
    now: Date
  ): Promise<ImageAllowanceStatus> {
    const window = getUtcPeriodWindow(plan, now);
    const snap = await this.serverDb
      .collection("ai_image_usage")
      .doc(userId)
      .get();
    const docData = snap.exists ? (snap.data() as UserImageUsageDoc) : undefined;
    const bucket = docData?.buckets?.[window.bucketKey];
    return buildAllowanceStatusFromBucket(window, bucket, now.getTime());
  }

  async reserveSlot(params: {
    userId: string;
    plan: ImagePlan;
    requestId: string;
    postId?: string;
    now: Date;
    reservationTtlMs: number;
  }): Promise<ReserveSlotOutcome> {
    return this.lock.run(params.userId, async () => {
      const nowMs = params.now.getTime();
      const nowIso = params.now.toISOString();
      const window = getUtcPeriodWindow(params.plan, params.now);
      const usageRef = this.serverDb
        .collection("ai_image_usage")
        .doc(params.userId);
      const reqRef = this.serverDb
        .collection("ai_image_requests")
        .doc(ledgerKey(params.userId, params.requestId));

      return this.serverDb.runTransaction(async (tx) => {
        const [usageSnap, reqSnap] = await Promise.all([
          tx.get(usageRef),
          tx.get(reqRef),
        ]);

        const usageDoc: UserImageUsageDoc = usageSnap.exists
          ? (usageSnap.data() as UserImageUsageDoc)
          : { userId: params.userId, buckets: {}, history: [], updatedAt: nowIso };
        usageDoc.buckets = usageDoc.buckets || {};
        usageDoc.history = usageDoc.history || [];

        const bucket = normalizeBucket(
          usageDoc.buckets[window.bucketKey],
          window,
          nowMs
        );

        if (reqSnap.exists) {
          const existingReq = reqSnap.data() as ImageRequestLedgerRecord;
          if (existingReq.status === "succeeded" && existingReq.image) {
            return {
              kind: "recovered" as const,
              image: existingReq.image,
              allowance: buildAllowanceStatusFromBucket(window, bucket, nowMs),
            };
          }
          if (
            existingReq.status === "reserved" &&
            existingReq.expiresAtMs > nowMs
          ) {
            return {
              kind: "in_progress" as const,
              allowance: buildAllowanceStatusFromBucket(window, bucket, nowMs),
            };
          }
        }

        if (bucket.committedCount + bucket.activeReservations.length >= window.limit) {
          return {
            kind: "limit_reached" as const,
            allowance: buildAllowanceStatusFromBucket(window, bucket, nowMs),
          };
        }

        const expiresAtMs = nowMs + params.reservationTtlMs;
        bucket.activeReservations.push({
          requestId: params.requestId,
          ...(params.postId ? { postId: params.postId } : {}),
          reservedAtMs: nowMs,
          expiresAtMs,
        });
        bucket.updatedAt = nowIso;
        usageDoc.buckets[window.bucketKey] = bucket;
        usageDoc.updatedAt = nowIso;

        const reqRecord: ImageRequestLedgerRecord = {
          requestId: params.requestId,
          userId: params.userId,
          ...(params.postId ? { postId: params.postId } : {}),
          plan: params.plan,
          bucketKey: window.bucketKey,
          status: "reserved",
          createdAt: nowIso,
          updatedAt: nowIso,
          expiresAtMs,
        };

        tx.set(usageRef, usageDoc, { merge: true });
        tx.set(reqRef, reqRecord, { merge: true });

        return {
          kind: "reserved" as const,
          allowance: buildAllowanceStatusFromBucket(window, bucket, nowMs),
        };
      });
    });
  }

  async commitSuccess(params: {
    userId: string;
    plan: ImagePlan;
    requestId: string;
    postId?: string;
    image: PostAttachedImage;
    now: Date;
  }): Promise<ImageAllowanceStatus> {
    return this.lock.run(params.userId, async () => {
      const nowMs = params.now.getTime();
      const nowIso = params.now.toISOString();
      const window = getUtcPeriodWindow(params.plan, params.now);
      const usageRef = this.serverDb
        .collection("ai_image_usage")
        .doc(params.userId);
      const reqRef = this.serverDb
        .collection("ai_image_requests")
        .doc(ledgerKey(params.userId, params.requestId));

      return this.serverDb.runTransaction(async (tx) => {
        const usageSnap = await tx.get(usageRef);
        const usageDoc: UserImageUsageDoc = usageSnap.exists
          ? (usageSnap.data() as UserImageUsageDoc)
          : { userId: params.userId, buckets: {}, history: [], updatedAt: nowIso };
        usageDoc.buckets = usageDoc.buckets || {};
        usageDoc.history = usageDoc.history || [];

        const bucket = normalizeBucket(
          usageDoc.buckets[window.bucketKey],
          window,
          nowMs
        );

        bucket.activeReservations = bucket.activeReservations.filter(
          (r) => r.requestId !== params.requestId
        );

        if (!bucket.committedRequestIds.includes(params.requestId)) {
          bucket.committedRequestIds.push(params.requestId);
          bucket.committedCount += 1;
          usageDoc.history.push({
            requestId: params.requestId,
            imageId: params.image.imageId,
            plan: params.plan,
            bucketKey: window.bucketKey,
            ...(params.postId ? { postId: params.postId } : {}),
            committedAt: nowIso,
          });
          if (usageDoc.history.length > 60) {
            usageDoc.history = usageDoc.history.slice(-60);
          }
        }

        bucket.updatedAt = nowIso;
        usageDoc.buckets[window.bucketKey] = bucket;
        usageDoc.updatedAt = nowIso;

        tx.set(usageRef, usageDoc, { merge: true });
        tx.set(
          reqRef,
          {
            requestId: params.requestId,
            userId: params.userId,
            ...(params.postId ? { postId: params.postId } : {}),
            plan: params.plan,
            bucketKey: window.bucketKey,
            status: "succeeded",
            image: params.image,
            updatedAt: nowIso,
            expiresAtMs: nowMs,
          },
          { merge: true }
        );

        return buildAllowanceStatusFromBucket(window, bucket, nowMs);
      });
    });
  }

  async releaseReservation(params: {
    userId: string;
    plan: ImagePlan;
    requestId: string;
    error: string;
    errorCode: string;
    now: Date;
  }): Promise<ImageAllowanceStatus> {
    return this.lock.run(params.userId, async () => {
      const nowMs = params.now.getTime();
      const nowIso = params.now.toISOString();
      const window = getUtcPeriodWindow(params.plan, params.now);
      const usageRef = this.serverDb
        .collection("ai_image_usage")
        .doc(params.userId);
      const reqRef = this.serverDb
        .collection("ai_image_requests")
        .doc(ledgerKey(params.userId, params.requestId));

      return this.serverDb.runTransaction(async (tx) => {
        const usageSnap = await tx.get(usageRef);
        const usageDoc: UserImageUsageDoc = usageSnap.exists
          ? (usageSnap.data() as UserImageUsageDoc)
          : { userId: params.userId, buckets: {}, history: [], updatedAt: nowIso };
        usageDoc.buckets = usageDoc.buckets || {};

        const bucket = normalizeBucket(
          usageDoc.buckets[window.bucketKey],
          window,
          nowMs
        );
        bucket.activeReservations = bucket.activeReservations.filter(
          (r) => r.requestId !== params.requestId
        );
        bucket.updatedAt = nowIso;
        usageDoc.buckets[window.bucketKey] = bucket;
        usageDoc.updatedAt = nowIso;

        tx.set(usageRef, usageDoc, { merge: true });
        tx.set(
          reqRef,
          {
            requestId: params.requestId,
            userId: params.userId,
            plan: params.plan,
            bucketKey: window.bucketKey,
            status: "failed",
            error: params.error,
            errorCode: params.errorCode,
            updatedAt: nowIso,
            expiresAtMs: nowMs,
          },
          { merge: true }
        );

        return buildAllowanceStatusFromBucket(window, bucket, nowMs);
      });
    });
  }

  async findRecoverableImage(
    userId: string,
    postId?: string,
    requestId?: string
  ): Promise<PostAttachedImage | null> {
    if (requestId) {
      const snap = await this.serverDb
        .collection("ai_image_requests")
        .doc(ledgerKey(userId, requestId))
        .get();
      if (snap.exists) {
        const data = snap.data() as ImageRequestLedgerRecord;
        if (
          data.userId === userId &&
          data.status === "succeeded" &&
          data.image
        ) {
          return data.image;
        }
      }
    }

    if (!postId) return null;
    try {
      const snap = await this.serverDb
        .collection("ai_image_requests")
        .where("userId", "==", userId)
        .where("postId", "==", postId)
        .where("status", "==", "succeeded")
        .limit(5)
        .get();

      let latest: ImageRequestLedgerRecord | null = null;
      for (const docSnap of snap.docs) {
        const data = docSnap.data() as ImageRequestLedgerRecord;
        if (data.image && (!latest || data.updatedAt > latest.updatedAt)) {
          latest = data;
        }
      }
      return latest?.image ?? null;
    } catch {
      return null;
    }
  }
}

/**
 * Strictly resolves subscription entitlement server-side from verified accounts,
 * Firestore user records, and active Stripe subscriptions.
 * NEVER trusts client-supplied plan fields and NEVER escalates on error.
 */
export async function resolveVerifiedImagePlan(
  serverDb: Firestore | null,
  userId: string,
  email?: string
): Promise<ImagePlan> {
  if (!userId || userId === "anonymous") {
    return "free";
  }

  if (isEntitledAccount(email) || ENTITLED_PRO_UIDS.has(userId)) {
    return "pro";
  }

  if (!serverDb) {
    return "free";
  }

  try {
    const userSnap = await serverDb.collection("users").doc(userId).get();
    if (userSnap.exists) {
      const data = userSnap.data() || {};
      if (isEntitledAccount(data.email)) {
        return "pro";
      }
      if (
        data.subscriptionStatus === "active" ||
        data.subscriptionTier === "pro" ||
        data.subscriptionActive === true
      ) {
        return "pro";
      }
    }

    const subSnap = await serverDb
      .collection("stripe_subscriptions")
      .where("userId", "==", userId)
      .where("status", "in", ["active", "trialing"])
      .limit(1)
      .get();

    if (!subSnap.empty) {
      return "pro";
    }
  } catch (err: any) {
    console.warn(
      `[AI_IMAGE_ENTITLEMENT] Failed to verify subscription for ${userId}; failing closed to free:`,
      err?.message || err
    );
    return "free";
  }

  return "free";
}

export interface ImageProviderOutput {
  buffer: Buffer;
  mimeType: string;
}

export type ImageProviderFn = (params: {
  prompt: string;
  aspectRatio: ImageAspectRatio;
  signal?: AbortSignal;
}) => Promise<ImageProviderOutput>;

/**
 * Default Gemini image generation provider using `gemini-3.1-flash-lite-image`.
 * Never sets responseMimeType, responseSchema, thinkingBudget, or googleSearch.
 */
export async function geminiFlashLiteImageProvider(params: {
  prompt: string;
  aspectRatio: ImageAspectRatio;
}): Promise<ImageProviderOutput> {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: AI_IMAGE_MODEL,
    contents: {
      parts: [{ text: params.prompt }],
    },
    config: {
      imageConfig: {
        aspectRatio: params.aspectRatio,
      },
    },
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    const inline = (part as any)?.inlineData;
    if (inline?.data && typeof inline.data === "string") {
      const buffer = Buffer.from(inline.data, "base64");
      const mimeType =
        typeof inline.mimeType === "string" && inline.mimeType
          ? inline.mimeType
          : "image/png";
      return { buffer, mimeType };
    }
  }

  throw new Error(
    "The AI image model did not return a usable image. Please try again."
  );
}

function toPostAttachedImage(meta: StoredImageMetadata): PostAttachedImage {
  return {
    imageId: meta.imageId,
    requestId: meta.requestId,
    ...(meta.postId ? { postId: meta.postId } : {}),
    partIndex: meta.partIndex,
    mimeType: meta.mimeType,
    width: meta.width,
    height: meta.height,
    aspectRatio: meta.aspectRatio,
    altText: meta.altText || undefined,
    previewUrl: `/api/images/asset/${encodeURIComponent(meta.imageId)}`,
    status: meta.status === "accepted" ? "accepted" : "generated",
    createdAt: meta.createdAt,
  };
}

export interface AiImageServiceOptions {
  usageStore: AiImageUsageStore;
  assetStore: AiImageAssetStore;
  resolvePlan: (userId: string, email?: string) => Promise<ImagePlan>;
  imageProvider?: ImageProviderFn;
  nowFn?: () => Date;
  reservationTtlMs?: number;
  providerTimeoutMs?: number;
  rateLimitMaxPerMinute?: number;
}

export class AiImageService {
  private readonly usageStore: AiImageUsageStore;
  private readonly assetStore: AiImageAssetStore;
  private readonly resolvePlan: (
    userId: string,
    email?: string
  ) => Promise<ImagePlan>;
  private readonly imageProvider: ImageProviderFn;
  private readonly nowFn: () => Date;
  private readonly reservationTtlMs: number;
  private readonly providerTimeoutMs: number;
  private readonly rateLimitMaxPerMinute: number;
  private readonly rateBuckets = new Map<string, number[]>();

  constructor(options: AiImageServiceOptions) {
    this.usageStore = options.usageStore;
    this.assetStore = options.assetStore;
    this.resolvePlan = options.resolvePlan;
    this.imageProvider = options.imageProvider || geminiFlashLiteImageProvider;
    this.nowFn = options.nowFn || (() => new Date());
    this.reservationTtlMs = options.reservationTtlMs ?? IMAGE_RESERVATION_TTL_MS;
    this.providerTimeoutMs =
      options.providerTimeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS;
    this.rateLimitMaxPerMinute = options.rateLimitMaxPerMinute ?? 8;
  }

  private checkRateLimit(userId: string, nowMs: number): boolean {
    const windowMs = 60_000;
    const recent = (this.rateBuckets.get(userId) || []).filter(
      (ts) => nowMs - ts < windowMs
    );
    if (recent.length >= this.rateLimitMaxPerMinute) {
      this.rateBuckets.set(userId, recent);
      return false;
    }
    recent.push(nowMs);
    this.rateBuckets.set(userId, recent);
    return true;
  }

  async getAllowanceAndRecovery(params: {
    userId: string;
    email?: string;
    postId?: string;
    requestId?: string;
  }): Promise<{
    allowance: ImageAllowanceStatus;
    recoverableImage: PostAttachedImage | null;
  }> {
    const now = this.nowFn();
    const plan = await this.resolvePlan(params.userId, params.email);
    const allowance = await this.usageStore.getAllowanceStatus(
      params.userId,
      plan,
      now
    );

    let recoverableImage: PostAttachedImage | null = null;
    if (params.postId || params.requestId) {
      const candidate = await this.usageStore.findRecoverableImage(
        params.userId,
        params.postId,
        params.requestId
      );
      if (candidate) {
        const meta = await this.assetStore.getMetadata(candidate.imageId);
        if (meta && meta.userId === params.userId && meta.status !== "removed") {
          recoverableImage = toPostAttachedImage(meta);
        }
      }
    }

    return { allowance, recoverableImage };
  }

  async generatePostImage(params: {
    userId: string;
    email?: string;
    payload: ImageGenerationRequestPayload;
  }): Promise<{ statusCode: number; body: GeneratePostImageResponse }> {
    const now = this.nowFn();
    const nowMs = now.getTime();
    const { userId, email, payload } = params;

    const plan = await this.resolvePlan(userId, email);

    // Input validation
    const requestId = String(payload?.requestId || "").trim();
    const postText = String(payload?.postText || "").trim();
    const parts = Array.isArray(payload?.parts)
      ? payload.parts.map((p) => String(p || "").trim()).filter(Boolean)
      : [];

    if (!requestId || requestId.length < 4 || requestId.length > 96) {
      const allowance = await this.usageStore.getAllowanceStatus(
        userId,
        plan,
        now
      );
      return {
        statusCode: 400,
        body: {
          success: false,
          allowance,
          error: "A valid requestId is required for AI image generation.",
          errorCode: "INVALID_INPUT",
        },
      };
    }

    if (!postText && parts.length === 0) {
      const allowance = await this.usageStore.getAllowanceStatus(
        userId,
        plan,
        now
      );
      return {
        statusCode: 400,
        body: {
          success: false,
          allowance,
          error:
            "Complete your post text before generating a contextual AI image.",
          errorCode: "INVALID_INPUT",
        },
      };
    }

    // Per-user rate limit (skip for direct recovery of an already-succeeded requestId)
    const alreadyRecovered = await this.usageStore.findRecoverableImage(
      userId,
      undefined,
      requestId
    );
    if (alreadyRecovered) {
      const meta = await this.assetStore.getMetadata(alreadyRecovered.imageId);
      const allowance = await this.usageStore.getAllowanceStatus(
        userId,
        plan,
        now
      );
      if (meta && meta.userId === userId && meta.status !== "removed") {
        return {
          statusCode: 200,
          body: {
            success: true,
            image: toPostAttachedImage(meta),
            allowance,
            recovered: true,
          },
        };
      }
    }

    if (!this.checkRateLimit(userId, nowMs)) {
      const allowance = await this.usageStore.getAllowanceStatus(
        userId,
        plan,
        now
      );
      return {
        statusCode: 429,
        body: {
          success: false,
          allowance,
          error: "Too many image requests in a short time. Please wait a moment.",
          errorCode: "RATE_LIMITED",
        },
      };
    }

    // 1. Atomically reserve allowance slot BEFORE invoking external image provider
    const reservation = await this.usageStore.reserveSlot({
      userId,
      plan,
      requestId,
      postId: payload.postId,
      now,
      reservationTtlMs: this.reservationTtlMs,
    });

    if (reservation.kind === "recovered") {
      return {
        statusCode: 200,
        body: {
          success: true,
          image: reservation.image,
          allowance: reservation.allowance,
          recovered: true,
        },
      };
    }

    if (reservation.kind === "in_progress") {
      return {
        statusCode: 409,
        body: {
          success: false,
          inProgress: true,
          allowance: reservation.allowance,
          error:
            "This image generation request is already in progress. Please wait for it to finish.",
          errorCode: "REQUEST_IN_PROGRESS",
        },
      };
    }

    if (reservation.kind === "limit_reached") {
      return {
        statusCode: 429,
        body: {
          success: false,
          allowance: reservation.allowance,
          error: reservation.allowance.exhaustedText,
          errorCode: "IMAGE_LIMIT_REACHED",
        },
      };
    }

    // 2. Build contextual prompt from completed post + creator brand preferences
    const builtPrompt = buildContextualImagePrompt({
      postText: postText || parts.join("\n\n"),
      parts: parts.length > 0 ? parts : undefined,
      topic: payload.topic,
      pillarTitle: payload.pillarTitle,
      tone: payload.tone,
      audience: payload.audience,
      brandStyle: payload.brandStyle,
      brandColors: payload.brandColors,
      visualDirection: payload.visualDirection,
      aspectRatio: payload.aspectRatio,
    });

    // 3. Call image provider with bounded timeout
    let providerOutput: ImageProviderOutput;
    const controller = new AbortController();
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    try {
      providerOutput = await Promise.race([
        this.imageProvider({
          prompt: builtPrompt.prompt,
          aspectRatio: builtPrompt.aspectRatio,
          signal: controller.signal,
        }),
        new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(() => {
            controller.abort();
            const timeoutErr = new Error(
              "AI image generation timed out. Your image allowance was not used."
            );
            (timeoutErr as any).code = "PROVIDER_TIMEOUT";
            reject(timeoutErr);
          }, this.providerTimeoutMs);
        }),
      ]);
    } catch (err: any) {
      const isTimeout = err?.code === "PROVIDER_TIMEOUT";
      const errorCode = isTimeout ? "PROVIDER_TIMEOUT" : "PROVIDER_ERROR";
      const errorMessage = isTimeout
        ? "AI image generation timed out. Your image allowance was not used."
        : "AI image generation failed before an image was created. Your allowance was not used.";

      const updatedAllowance = await this.usageStore.releaseReservation({
        userId,
        plan,
        requestId,
        error: err?.message || errorMessage,
        errorCode,
        now: this.nowFn(),
      });

      return {
        statusCode: isTimeout ? 504 : 502,
        body: {
          success: false,
          allowance: updatedAllowance,
          error: errorMessage,
          errorCode,
        },
      };
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }

    // 4. Validate returned bytes produce a usable image before committing allowance
    try {
      inspectImageBuffer(providerOutput.buffer, providerOutput.mimeType);
    } catch (err: any) {
      const updatedAllowance = await this.usageStore.releaseReservation({
        userId,
        plan,
        requestId,
        error: err?.message || "Invalid image output from provider.",
        errorCode: "PROVIDER_ERROR",
        now: this.nowFn(),
      });
      return {
        statusCode: 502,
        body: {
          success: false,
          allowance: updatedAllowance,
          error:
            "The AI image provider returned an unusable image. Your allowance was not used.",
          errorCode: "PROVIDER_ERROR",
        },
      };
    }

    // 5. Persist image asset securely for this creator
    const imageId = `img_${crypto.randomBytes(12).toString("hex")}`;
    const safePartIndex =
      typeof payload.partIndex === "number" && Number.isInteger(payload.partIndex)
        ? Math.max(0, Math.min(Math.max(0, parts.length - 1), payload.partIndex))
        : 0;

    let storedMetadata: StoredImageMetadata;
    try {
      storedMetadata = await this.assetStore.saveAsset({
        imageId,
        userId,
        postId: payload.postId,
        partIndex: safePartIndex,
        requestId,
        buffer: providerOutput.buffer,
        mimeType: providerOutput.mimeType,
        aspectRatio: builtPrompt.aspectRatio,
        altText: builtPrompt.altText,
        promptSummary: builtPrompt.promptSummary,
        nowMs: this.nowFn().getTime(),
      });
    } catch (err: any) {
      // Storage failed before the user could receive a usable stored image -> release reservation cleanly
      const updatedAllowance = await this.usageStore.releaseReservation({
        userId,
        plan,
        requestId,
        error: err?.message || "Image storage write failed.",
        errorCode: "STORAGE_ERROR",
        now: this.nowFn(),
      });
      return {
        statusCode: 500,
        body: {
          success: false,
          allowance: updatedAllowance,
          error:
            "We could not save your generated image. Your allowance was not used — please try again.",
          errorCode: "STORAGE_ERROR",
        },
      };
    }

    // 6. Atomically commit allowance ONLY now that a usable image is stored
    const attachedImage = toPostAttachedImage(storedMetadata);
    const finalAllowance = await this.usageStore.commitSuccess({
      userId,
      plan,
      requestId,
      postId: payload.postId,
      image: attachedImage,
      now: this.nowFn(),
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        image: attachedImage,
        allowance: finalAllowance,
      },
    };
  }

  /**
   * Marks an already-generated image as accepted/attached to a post.
   * NEVER consumes an image allowance.
   */
  async acceptImage(params: {
    userId: string;
    imageId: string;
    postId?: string;
    partIndex?: number;
  }): Promise<{ ok: boolean; statusCode: number; image?: PostAttachedImage; error?: string }> {
    const existing = await this.assetStore.getMetadata(params.imageId);
    if (!existing || existing.status === "removed") {
      return { ok: false, statusCode: 404, error: "Image not found." };
    }
    if (existing.userId !== params.userId) {
      return { ok: false, statusCode: 403, error: "You do not have access to this image." };
    }
    const updated = await this.assetStore.markAccepted(
      params.imageId,
      params.userId,
      params.postId,
      params.partIndex
    );
    if (!updated) {
      return { ok: false, statusCode: 404, error: "Image could not be updated." };
    }
    return { ok: true, statusCode: 200, image: toPostAttachedImage(updated) };
  }

  /**
   * Removes/discards an image asset owned by the creator.
   * NEVER refunds a committed generation allowance.
   */
  async removeImage(params: {
    userId: string;
    imageId: string;
  }): Promise<{ ok: boolean; statusCode: number; error?: string }> {
    const existing = await this.assetStore.getMetadata(params.imageId);
    if (!existing) {
      return { ok: false, statusCode: 404, error: "Image not found." };
    }
    if (existing.userId !== params.userId) {
      return { ok: false, statusCode: 403, error: "You do not have access to this image." };
    }
    await this.assetStore.markRemoved(params.imageId, params.userId);
    return { ok: true, statusCode: 200 };
  }

  /**
   * Loads an authenticated creator's private image asset with strict owner isolation.
   */
  async loadOwnedImage(params: {
    userId: string;
    imageId: string;
  }): Promise<{
    ok: boolean;
    statusCode: number;
    mimeType?: string;
    buffer?: Buffer;
    error?: string;
  }> {
    const existing = await this.assetStore.getMetadata(params.imageId);
    if (!existing || existing.status === "removed") {
      return { ok: false, statusCode: 404, error: "Image not found." };
    }
    if (existing.userId !== params.userId) {
      return { ok: false, statusCode: 403, error: "Forbidden." };
    }
    const loaded = await this.assetStore.loadBinary(params.imageId);
    if (!loaded) {
      return { ok: false, statusCode: 404, error: "Image file not found." };
    }
    return {
      ok: true,
      statusCode: 200,
      mimeType: loaded.metadata.mimeType,
      buffer: loaded.buffer,
    };
  }
}
