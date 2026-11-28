import crypto from "crypto";
import type { Firestore } from "firebase-admin/firestore";

export type ContentGenerationJobStatus =
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface ContentGenerationJobProgress {
  stage: string;
  completedCount: number;
  requestedCount: number;
  currentChunk: number;
  totalChunks: number;
  updatedAt: number;
}

export interface ContentGenerationJobFailure {
  httpStatus: number;
  error: string;
  errorCode: string;
  retryable: boolean;
  message: string;
  failedDrafts?: unknown[];
  validDraftCount?: number;
  requestedCount?: number;
}

export interface ContentGenerationJobRecord {
  jobId: string;
  requestId: string;
  idempotencyKey: string | null;
  ownerUserId: string;
  accessToken: string | null;
  accessTokenHash: string;
  status: ContentGenerationJobStatus;
  category: string;
  requestedCount: number;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
  progress: ContentGenerationJobProgress;
  partialPosts: unknown[];
  result: Record<string, unknown> | null;
  failure: ContentGenerationJobFailure | null;
  abortController: AbortController;
  limitHandle: string | null;
}

export interface ContentGenerationJobPublicResponse {
  jobId: string;
  requestId: string;
  idempotencyKey?: string;
  status: ContentGenerationJobStatus;
  category: string;
  requestedCount: number;
  progress: ContentGenerationJobProgress;
  partialPosts?: unknown[];
  elapsedMs: number;
  result?: Record<string, unknown>;
  httpStatus?: number;
  error?: string;
  errorCode?: string;
  retryable?: boolean;
  message?: string;
  failedDrafts?: unknown[];
  validDraftCount?: number;
}

export interface CreateContentGenerationJobParams {
  requestId: string;
  ownerUserId: string;
  category: string;
  requestedCount: number;
  idempotencyKey?: string | null;
  limitHandle?: string | null;
}

export type CreateContentGenerationJobResult =
  | { ok: true; job: ContentGenerationJobRecord; deduplicated: boolean }
  | { ok: false; reason: "TOO_MANY_CONCURRENT_JOBS" };

export interface JobAccessAuthContext {
  jobToken?: string | null;
  verifiedUid?: string | null;
}

export interface ContentGenerationJobStoreOptions {
  finishedJobTtlMs?: number;
  runningJobMaxAgeMs?: number;
  maxActivePerUser?: number;
  maxTotalJobs?: number;
  enableCleanupTimer?: boolean;
  firestoreDb?: Firestore | null;
}

const JOB_ID_PATTERN = /^job_[a-zA-Z0-9_-]{8,64}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[a-zA-Z0-9_.:-]{6,128}$/;
const FIRESTORE_COLLECTION = "generation_jobs";
const FIRESTORE_OP_TIMEOUT_MS = 2500;

export function isValidJobId(jobId: unknown): jobId is string {
  return typeof jobId === "string" && JOB_ID_PATTERN.test(jobId);
}

export function normalizeIdempotencyKey(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || !IDEMPOTENCY_KEY_PATTERN.test(trimmed)) return null;
  return trimmed;
}

function hashAccessToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function constantTimeHexMatch(aHex: string, bHex: string): boolean {
  const a = Buffer.from(aHex, "utf8");
  const b = Buffer.from(bHex, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function stripUndefinedDeep<T>(value: T): T {
  if (value === undefined || value === null) return value;
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => stripUndefinedDeep(item)) as unknown as T;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = stripUndefinedDeep(v);
      }
    }
    return out as T;
  }
  return value;
}

async function withBoundedTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export class ContentGenerationJobStore {
  private readonly jobs = new Map<string, ContentGenerationJobRecord>();
  private readonly idempotencyIndex = new Map<string, string>();
  private readonly finishedJobTtlMs: number;
  private readonly runningJobMaxAgeMs: number;
  private readonly maxActivePerUser: number;
  private readonly maxTotalJobs: number;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private firestoreDb: Firestore | null = null;

  constructor(options: ContentGenerationJobStoreOptions = {}) {
    this.finishedJobTtlMs = options.finishedJobTtlMs ?? 30 * 60 * 1000;
    this.runningJobMaxAgeMs = options.runningJobMaxAgeMs ?? 10 * 60 * 1000;
    this.maxActivePerUser = options.maxActivePerUser ?? 5;
    this.maxTotalJobs = options.maxTotalJobs ?? 500;
    this.firestoreDb = options.firestoreDb ?? null;

    if (options.enableCleanupTimer !== false) {
      this.cleanupTimer = setInterval(() => {
        this.pruneExpired();
      }, 2 * 60 * 1000);
      if (typeof this.cleanupTimer.unref === "function") {
        this.cleanupTimer.unref();
      }
    }
  }

  attachFirestore(db: Firestore | null): void {
    this.firestoreDb = db;
  }

  private getIdempotencyCompositeKey(ownerUserId: string, idempotencyKey: string): string {
    return `${ownerUserId}::${idempotencyKey}`;
  }

  private isJobReusableForIdempotency(job: ContentGenerationJobRecord, now: number): boolean {
    if (job.status === "running") {
      return now - job.createdAt <= this.runningJobMaxAgeMs;
    }
    if (job.status === "completed") {
      return job.completedAt === null || now - job.completedAt <= this.finishedJobTtlMs;
    }
    return false;
  }

  async findByIdempotencyKey(
    ownerUserId: string,
    rawIdempotencyKey?: string | null
  ): Promise<ContentGenerationJobRecord | null> {
    const idempotencyKey = normalizeIdempotencyKey(rawIdempotencyKey);
    if (!idempotencyKey) return null;
    const ownerKey = (ownerUserId || "anonymous").trim() || "anonymous";
    const now = Date.now();
    this.pruneExpired(now);

    const composite = this.getIdempotencyCompositeKey(ownerKey, idempotencyKey);
    const existingId = this.idempotencyIndex.get(composite);
    if (existingId) {
      const existing = this.jobs.get(existingId);
      if (existing && this.isJobReusableForIdempotency(existing, now)) {
        return existing;
      }
      this.idempotencyIndex.delete(composite);
    }

    // Check Firestore for cross-instance or post-restart deduplication
    if (this.firestoreDb && ownerKey !== "anonymous") {
      try {
        const snap = await withBoundedTimeout(
          this.firestoreDb
            .collection(FIRESTORE_COLLECTION)
            .where("userId", "==", ownerKey)
            .where("idempotencyKey", "==", idempotencyKey)
            .limit(3)
            .get(),
          FIRESTORE_OP_TIMEOUT_MS,
          null
        );
        if (snap && !snap.empty) {
          for (const doc of snap.docs) {
            const hydrated = this.hydrateFromFirestoreDoc(doc.id, doc.data());
            if (hydrated && this.isJobReusableForIdempotency(hydrated, now)) {
              this.jobs.set(hydrated.jobId, hydrated);
              this.idempotencyIndex.set(composite, hydrated.jobId);
              return hydrated;
            }
          }
        }
      } catch (err: any) {
        console.warn("[CONTENT_JOBS] Idempotency Firestore lookup warning:", err?.message || err);
      }
    }

    return null;
  }

  createJob(params: CreateContentGenerationJobParams): CreateContentGenerationJobResult {
    const now = Date.now();
    this.pruneExpired(now);

    const ownerKey = (params.ownerUserId || "anonymous").trim() || "anonymous";
    const idempotencyKey = normalizeIdempotencyKey(params.idempotencyKey);

    if (idempotencyKey) {
      const composite = this.getIdempotencyCompositeKey(ownerKey, idempotencyKey);
      const existingId = this.idempotencyIndex.get(composite);
      if (existingId) {
        const existing = this.jobs.get(existingId);
        if (existing && this.isJobReusableForIdempotency(existing, now)) {
          return { ok: true, job: existing, deduplicated: true };
        }
      }
    }

    let activeForUser = 0;
    for (const existing of this.jobs.values()) {
      if (existing.ownerUserId === ownerKey && existing.status === "running") {
        activeForUser++;
      }
    }
    if (activeForUser >= this.maxActivePerUser) {
      return { ok: false, reason: "TOO_MANY_CONCURRENT_JOBS" };
    }

    if (this.jobs.size >= this.maxTotalJobs) {
      this.evictOldestFinished();
    }

    const jobId = `job_${now}_${crypto.randomBytes(6).toString("hex")}`;
    const accessToken = crypto.randomBytes(24).toString("hex");
    const accessTokenHash = hashAccessToken(accessToken);
    const requestedCount = Math.max(1, Math.floor(params.requestedCount || 1));

    const job: ContentGenerationJobRecord = {
      jobId,
      requestId: params.requestId,
      idempotencyKey,
      ownerUserId: ownerKey,
      accessToken,
      accessTokenHash,
      status: "running",
      category: params.category || "auto",
      requestedCount,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      progress: {
        stage: "queued",
        completedCount: 0,
        requestedCount,
        currentChunk: 0,
        totalChunks: 1,
        updatedAt: now,
      },
      partialPosts: [],
      result: null,
      failure: null,
      abortController: new AbortController(),
      limitHandle: params.limitHandle || null,
    };

    this.jobs.set(jobId, job);
    if (idempotencyKey) {
      this.idempotencyIndex.set(
        this.getIdempotencyCompositeKey(ownerKey, idempotencyKey),
        jobId
      );
    }

    // Fire-and-forget initial persistence so job creation stays <100ms
    void this.persistJobSnapshot(job);

    return { ok: true, job, deduplicated: false };
  }

  getJob(jobId: string): ContentGenerationJobRecord | null {
    if (!isValidJobId(jobId)) return null;
    const job = this.jobs.get(jobId);
    if (!job) return null;

    const now = Date.now();
    if (job.completedAt !== null && now - job.completedAt > this.finishedJobTtlMs) {
      this.deleteJobFromMemory(jobId);
      return null;
    }
    return job;
  }

  async getJobAsync(jobId: string): Promise<ContentGenerationJobRecord | null> {
    const inMem = this.getJob(jobId);
    if (inMem) return inMem;
    if (!isValidJobId(jobId) || !this.firestoreDb) return null;

    try {
      const snap = await withBoundedTimeout(
        this.firestoreDb.collection(FIRESTORE_COLLECTION).doc(jobId).get(),
        FIRESTORE_OP_TIMEOUT_MS,
        null
      );
      if (!snap || !snap.exists) return null;
      const hydrated = this.hydrateFromFirestoreDoc(snap.id, snap.data());
      if (!hydrated) return null;

      const now = Date.now();
      if (hydrated.completedAt !== null && now - hydrated.completedAt > this.finishedJobTtlMs) {
        return null;
      }
      this.jobs.set(hydrated.jobId, hydrated);
      if (hydrated.idempotencyKey) {
        this.idempotencyIndex.set(
          this.getIdempotencyCompositeKey(hydrated.ownerUserId, hydrated.idempotencyKey),
          hydrated.jobId
        );
      }
      return hydrated;
    } catch (err: any) {
      console.warn(`[CONTENT_JOBS] Firestore getJobAsync warning for ${jobId}:`, err?.message || err);
      return null;
    }
  }

  async getLatestRecoverableJobForUser(
    ownerUserId: string,
    maxAgeMs: number = 10 * 60 * 1000
  ): Promise<ContentGenerationJobRecord | null> {
    const ownerKey = (ownerUserId || "").trim();
    if (!ownerKey || ownerKey === "anonymous") return null;

    const now = Date.now();
    this.pruneExpired(now);

    let best: ContentGenerationJobRecord | null = null;
    for (const job of this.jobs.values()) {
      if (job.ownerUserId !== ownerKey) continue;
      if (job.status !== "running" && job.status !== "completed") continue;
      if (now - job.updatedAt > maxAgeMs) continue;
      if (!best || job.updatedAt > best.updatedAt) {
        best = job;
      }
    }

    if (best) return best;

    if (this.firestoreDb) {
      try {
        const snap = await withBoundedTimeout(
          this.firestoreDb
            .collection(FIRESTORE_COLLECTION)
            .where("userId", "==", ownerKey)
            .limit(10)
            .get(),
          FIRESTORE_OP_TIMEOUT_MS,
          null
        );
        if (snap && !snap.empty) {
          for (const doc of snap.docs) {
            const hydrated = this.hydrateFromFirestoreDoc(doc.id, doc.data());
            if (!hydrated) continue;
            if (hydrated.status !== "running" && hydrated.status !== "completed") continue;
            if (now - hydrated.updatedAt > maxAgeMs) continue;
            if (!best || hydrated.updatedAt > best.updatedAt) {
              best = hydrated;
            }
          }
          if (best) {
            this.jobs.set(best.jobId, best);
          }
        }
      } catch (err: any) {
        console.warn("[CONTENT_JOBS] Firestore latest recoverable lookup warning:", err?.message || err);
      }
    }

    return best;
  }

  authorizeJobAccess(
    job: ContentGenerationJobRecord,
    authContext: JobAccessAuthContext
  ): boolean {
    const verifiedUid =
      typeof authContext.verifiedUid === "string" && authContext.verifiedUid.trim()
        ? authContext.verifiedUid.trim()
        : null;
    const jobToken =
      typeof authContext.jobToken === "string" && authContext.jobToken.trim()
        ? authContext.jobToken.trim()
        : null;

    // Never allow a verified caller to inspect or cancel another authenticated user's job.
    if (
      verifiedUid &&
      job.ownerUserId !== "anonymous" &&
      verifiedUid !== job.ownerUserId
    ) {
      return false;
    }

    if (jobToken && job.accessTokenHash) {
      const providedHash = hashAccessToken(jobToken);
      if (constantTimeHexMatch(providedHash, job.accessTokenHash)) {
        return true;
      }
    }

    if (verifiedUid && job.ownerUserId !== "anonymous" && verifiedUid === job.ownerUserId) {
      return true;
    }

    return false;
  }

  updateProgress(
    jobId: string,
    patch: Partial<Omit<ContentGenerationJobProgress, "updatedAt">> & {
      partialPosts?: unknown[];
    }
  ): void {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== "running") return;
    const now = Date.now();
    const { partialPosts, ...progressPatch } = patch;
    job.updatedAt = now;
    job.progress = {
      ...job.progress,
      ...progressPatch,
      updatedAt: now,
    };
    if (Array.isArray(partialPosts)) {
      job.partialPosts = [...partialPosts];
    }
    void this.persistJobSnapshot(job);
  }

  async completeJob(jobId: string, result: Record<string, unknown>): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== "running") return false;
    const now = Date.now();
    job.status = "completed";
    job.result = result;
    job.failure = null;
    job.limitHandle = null;
    job.updatedAt = now;
    job.completedAt = now;
    const acceptedPosts = Array.isArray((result as any).posts) ? (result as any).posts : [];
    job.partialPosts = acceptedPosts;
    job.progress = {
      ...job.progress,
      stage: "completed",
      completedCount: acceptedPosts.length || job.progress.completedCount,
      updatedAt: now,
    };
    await this.persistJobSnapshot(job);
    return true;
  }

  async failJob(jobId: string, failure: ContentGenerationJobFailure): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== "running") return false;
    const now = Date.now();
    job.status = "failed";
    job.failure = failure;
    job.result = null;
    job.limitHandle = null;
    job.updatedAt = now;
    job.completedAt = now;
    job.progress = {
      ...job.progress,
      stage: "failed",
      updatedAt: now,
    };
    await this.persistJobSnapshot(job);
    return true;
  }

  cancelJob(jobId: string): { cancelled: boolean; limitHandle: string | null } {
    const job = this.jobs.get(jobId);
    if (!job) {
      return { cancelled: false, limitHandle: null };
    }
    if (job.status !== "running") {
      return { cancelled: job.status === "cancelled", limitHandle: null };
    }
    const now = Date.now();
    const limitHandle = job.limitHandle;
    job.limitHandle = null;
    job.status = "cancelled";
    job.updatedAt = now;
    job.completedAt = now;
    job.progress = {
      ...job.progress,
      stage: "cancelled",
      updatedAt: now,
    };
    try {
      job.abortController.abort("Generation job cancelled by client");
    } catch {
      // no-op
    }
    void this.persistJobSnapshot(job);
    return { cancelled: true, limitHandle };
  }

  consumeLimitHandle(jobId: string): string | null {
    const job = this.jobs.get(jobId);
    if (!job || !job.limitHandle) return null;
    const handle = job.limitHandle;
    job.limitHandle = null;
    return handle;
  }

  toPublicResponse(job: ContentGenerationJobRecord): ContentGenerationJobPublicResponse {
    const endTime = job.completedAt ?? Date.now();
    const base: ContentGenerationJobPublicResponse = {
      jobId: job.jobId,
      requestId: job.requestId,
      ...(job.idempotencyKey ? { idempotencyKey: job.idempotencyKey } : {}),
      status: job.status,
      category: job.category,
      requestedCount: job.requestedCount,
      progress: { ...job.progress },
      ...(job.partialPosts.length > 0 && job.status === "running"
        ? { partialPosts: job.partialPosts }
        : {}),
      elapsedMs: Math.max(0, endTime - job.createdAt),
    };

    if (job.status === "completed" && job.result) {
      base.result = job.result;
    } else if (job.status === "failed" && job.failure) {
      base.httpStatus = job.failure.httpStatus;
      base.error = job.failure.error;
      base.errorCode = job.failure.errorCode;
      base.retryable = job.failure.retryable;
      base.message = job.failure.message;
      if (job.failure.failedDrafts) {
        base.failedDrafts = job.failure.failedDrafts;
      }
      if (typeof job.failure.validDraftCount === "number") {
        base.validDraftCount = job.failure.validDraftCount;
      }
    }

    return base;
  }

  pruneExpired(now: number = Date.now()): number {
    let removed = 0;
    for (const [jobId, job] of this.jobs.entries()) {
      if (job.completedAt !== null && now - job.completedAt > this.finishedJobTtlMs) {
        this.deleteJobFromMemory(jobId);
        removed++;
      } else if (job.status === "running" && now - job.createdAt > this.runningJobMaxAgeMs) {
        try {
          job.abortController.abort("Generation job exceeded maximum lifetime");
        } catch {
          // no-op
        }
        job.status = "failed";
        job.completedAt = now;
        job.updatedAt = now;
        job.failure = {
          httpStatus: 504,
          error: "Network or timeout error",
          errorCode: "NETWORK_ERROR",
          retryable: true,
          message: "Generation exceeded the maximum server execution window. Please retry.",
        };
        void this.persistJobSnapshot(job);
      }
    }
    return removed;
  }

  size(): number {
    return this.jobs.size;
  }

  dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.jobs.clear();
    this.idempotencyIndex.clear();
  }

  private deleteJobFromMemory(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (job?.idempotencyKey) {
      const composite = this.getIdempotencyCompositeKey(job.ownerUserId, job.idempotencyKey);
      if (this.idempotencyIndex.get(composite) === jobId) {
        this.idempotencyIndex.delete(composite);
      }
    }
    this.jobs.delete(jobId);
  }

  private evictOldestFinished(): void {
    let oldestId: string | null = null;
    let oldestTime = Infinity;
    for (const [jobId, job] of this.jobs.entries()) {
      if (job.completedAt !== null && job.completedAt < oldestTime) {
        oldestTime = job.completedAt;
        oldestId = jobId;
      }
    }
    if (oldestId) {
      this.deleteJobFromMemory(oldestId);
    }
  }

  private async persistJobSnapshot(job: ContentGenerationJobRecord): Promise<void> {
    if (!this.firestoreDb || job.ownerUserId === "anonymous") {
      return;
    }
    try {
      const docPayload = stripUndefinedDeep({
        jobId: job.jobId,
        requestId: job.requestId,
        idempotencyKey: job.idempotencyKey,
        userId: job.ownerUserId,
        accessTokenHash: job.accessTokenHash,
        status: job.status,
        category: job.category,
        requestedCount: job.requestedCount,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        completedAt: job.completedAt,
        progress: job.progress,
        partialPosts: job.partialPosts,
        result: job.result,
        failure: job.failure,
      });
      await withBoundedTimeout(
        this.firestoreDb
          .collection(FIRESTORE_COLLECTION)
          .doc(job.jobId)
          .set(docPayload, { merge: true }),
        FIRESTORE_OP_TIMEOUT_MS,
        undefined
      );
    } catch (err: any) {
      console.warn(`[CONTENT_JOBS] Firestore persist warning for ${job.jobId}:`, err?.message || err);
    }
  }

  private hydrateFromFirestoreDoc(
    docId: string,
    data: Record<string, any> | undefined
  ): ContentGenerationJobRecord | null {
    if (!data || !isValidJobId(docId)) return null;
    const status = data.status as ContentGenerationJobStatus;
    if (
      status !== "running" &&
      status !== "completed" &&
      status !== "failed" &&
      status !== "cancelled"
    ) {
      return null;
    }
    return {
      jobId: docId,
      requestId: typeof data.requestId === "string" ? data.requestId : `req_hydrated_${docId}`,
      idempotencyKey: typeof data.idempotencyKey === "string" ? data.idempotencyKey : null,
      ownerUserId: typeof data.userId === "string" ? data.userId : "anonymous",
      accessToken: null,
      accessTokenHash: typeof data.accessTokenHash === "string" ? data.accessTokenHash : "",
      status,
      category: typeof data.category === "string" ? data.category : "auto",
      requestedCount: typeof data.requestedCount === "number" ? data.requestedCount : 1,
      createdAt: typeof data.createdAt === "number" ? data.createdAt : Date.now(),
      updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : Date.now(),
      completedAt: typeof data.completedAt === "number" ? data.completedAt : null,
      progress: data.progress && typeof data.progress === "object"
        ? {
            stage: String(data.progress.stage || status),
            completedCount: Number(data.progress.completedCount || 0),
            requestedCount: Number(data.progress.requestedCount || data.requestedCount || 1),
            currentChunk: Number(data.progress.currentChunk || 0),
            totalChunks: Number(data.progress.totalChunks || 1),
            updatedAt: Number(data.progress.updatedAt || Date.now()),
          }
        : {
            stage: status,
            completedCount: 0,
            requestedCount: Number(data.requestedCount || 1),
            currentChunk: 0,
            totalChunks: 1,
            updatedAt: Date.now(),
          },
      partialPosts: Array.isArray(data.partialPosts) ? data.partialPosts : [],
      result: data.result && typeof data.result === "object" ? data.result : null,
      failure: data.failure && typeof data.failure === "object" ? data.failure : null,
      abortController: new AbortController(),
      limitHandle: null,
    };
  }
}

export const contentGenerationJobStore = new ContentGenerationJobStore();
