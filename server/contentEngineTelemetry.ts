import crypto from "crypto";

export type ContentEngineFinalStatus =
  | "completed"
  | "partially_completed"
  | "failed"
  | "cancelled";

export type AiCallStep = "generate" | "review" | "repair" | "replace";

export interface AiCallTelemetryRecord {
  step: AiCallStep;
  model: string;
  slots: number[];
  queueDurationMs: number;
  durationMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  thoughtsTokens: number | null;
  cachedTokens: number | null;
  fallbackUsed: boolean;
  rateLimited: boolean;
  status: "ok" | "rate_limited" | "error";
  errorCode?: string;
}

export interface ContentEngineTelemetrySnapshot {
  requestId: string;
  jobId?: string;
  userIdHash: string;
  mode: "job" | "sync_batch";
  requestedCount: number;
  acceptedCount: number;
  failedCount: number;
  writerConcurrency: number;
  chunkSize: number;
  chunkCount: number;
  contextCacheHit: boolean;
  snapshotCacheHit: boolean;
  totalDurationMs: number;
  authDurationMs: number;
  contextRetrievalMs: number;
  promptAssemblyMs: number;
  planningMs: number;
  timeToFirstPostMs: number | null;
  timeToLastPostMs: number | null;
  validationDurationMs: number;
  retryDurationMs: number;
  persistenceDurationMs: number;
  responseDeliveryMs: number;
  rateLimitEvents: number;
  networkInterruptions: number;
  modelCallCount: number;
  repairAttempts: number;
  replacementAttempts: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalThoughtsTokens: number;
  totalCachedTokens: number;
  targetMs: number;
  targetMet: boolean;
  finalStatus: ContentEngineFinalStatus;
  errorCode?: string;
  aiCalls: AiCallTelemetryRecord[];
}

export function getTargetLatencyMs(postCount: number): number {
  if (postCount <= 1) return 5000;
  if (postCount <= 4) return 10000;
  if (postCount <= 16) return 20000;
  return 40000;
}

export function hashUserIdForTelemetry(userId: string): string {
  const clean = (userId || "anonymous").trim();
  if (clean === "anonymous") return "anon";
  return crypto.createHash("sha256").update(clean).digest("hex").slice(0, 12);
}

export class ContentEngineTelemetryCollector {
  readonly startedAt: number;
  readonly requestId: string;
  readonly jobId?: string;
  readonly userIdHash: string;
  readonly mode: "job" | "sync_batch";
  requestedCount: number;
  acceptedCount = 0;
  failedCount = 0;
  writerConcurrency = 1;
  chunkSize = 1;
  chunkCount = 1;
  contextCacheHit = false;
  snapshotCacheHit = false;

  authDurationMs = 0;
  contextRetrievalMs = 0;
  promptAssemblyMs = 0;
  planningMs = 0;
  timeToFirstPostMs: number | null = null;
  timeToLastPostMs: number | null = null;
  validationDurationMs = 0;
  retryDurationMs = 0;
  persistenceDurationMs = 0;
  responseDeliveryMs = 0;
  rateLimitEvents = 0;
  networkInterruptions = 0;
  repairAttempts = 0;
  replacementAttempts = 0;
  errorCode?: string;
  finalStatus: ContentEngineFinalStatus = "failed";

  readonly aiCalls: AiCallTelemetryRecord[] = [];

  constructor(params: {
    requestId: string;
    jobId?: string;
    userId: string;
    mode: "job" | "sync_batch";
    requestedCount: number;
  }) {
    this.startedAt = Date.now();
    this.requestId = params.requestId;
    this.jobId = params.jobId;
    this.userIdHash = hashUserIdForTelemetry(params.userId);
    this.mode = params.mode;
    this.requestedCount = Math.max(1, params.requestedCount);
  }

  recordPostDelivered(nowMs: number = Date.now()): void {
    const elapsed = Math.max(0, nowMs - this.startedAt);
    if (this.timeToFirstPostMs === null) {
      this.timeToFirstPostMs = elapsed;
    }
    this.timeToLastPostMs = elapsed;
  }

  recordAiCall(record: AiCallTelemetryRecord): void {
    this.aiCalls.push(record);
    if (record.rateLimited || record.status === "rate_limited") {
      this.rateLimitEvents++;
    }
    if (record.step === "repair") {
      this.repairAttempts++;
      this.retryDurationMs += Math.max(0, record.durationMs);
    } else if (record.step === "replace") {
      this.replacementAttempts++;
      this.retryDurationMs += Math.max(0, record.durationMs);
    }
  }

  recordNetworkInterruption(): void {
    this.networkInterruptions++;
  }

  snapshot(finalStatus?: ContentEngineFinalStatus): ContentEngineTelemetrySnapshot {
    const status = finalStatus || this.finalStatus;
    const totalDurationMs = Math.max(0, Date.now() - this.startedAt);
    const targetMs = getTargetLatencyMs(this.requestedCount);

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalThoughtsTokens = 0;
    let totalCachedTokens = 0;
    for (const call of this.aiCalls) {
      totalInputTokens += call.inputTokens || 0;
      totalOutputTokens += call.outputTokens || 0;
      totalThoughtsTokens += call.thoughtsTokens || 0;
      totalCachedTokens += call.cachedTokens || 0;
    }

    return {
      requestId: this.requestId,
      ...(this.jobId ? { jobId: this.jobId } : {}),
      userIdHash: this.userIdHash,
      mode: this.mode,
      requestedCount: this.requestedCount,
      acceptedCount: this.acceptedCount,
      failedCount: this.failedCount,
      writerConcurrency: this.writerConcurrency,
      chunkSize: this.chunkSize,
      chunkCount: this.chunkCount,
      contextCacheHit: this.contextCacheHit,
      snapshotCacheHit: this.snapshotCacheHit,
      totalDurationMs,
      authDurationMs: Math.round(this.authDurationMs),
      contextRetrievalMs: Math.round(this.contextRetrievalMs),
      promptAssemblyMs: Math.round(this.promptAssemblyMs),
      planningMs: Math.round(this.planningMs),
      timeToFirstPostMs: this.timeToFirstPostMs !== null ? Math.round(this.timeToFirstPostMs) : null,
      timeToLastPostMs: this.timeToLastPostMs !== null ? Math.round(this.timeToLastPostMs) : null,
      validationDurationMs: Math.round(this.validationDurationMs),
      retryDurationMs: Math.round(this.retryDurationMs),
      persistenceDurationMs: Math.round(this.persistenceDurationMs),
      responseDeliveryMs: Math.round(this.responseDeliveryMs),
      rateLimitEvents: this.rateLimitEvents,
      networkInterruptions: this.networkInterruptions,
      modelCallCount: this.aiCalls.length,
      repairAttempts: this.repairAttempts,
      replacementAttempts: this.replacementAttempts,
      totalInputTokens,
      totalOutputTokens,
      totalThoughtsTokens,
      totalCachedTokens,
      targetMs,
      targetMet:
        status === "completed" &&
        this.acceptedCount === this.requestedCount &&
        totalDurationMs <= targetMs,
      finalStatus: status,
      ...(this.errorCode ? { errorCode: this.errorCode } : {}),
      aiCalls: this.aiCalls.map(c => ({ ...c, slots: [...c.slots] }))
    };
  }

  emitLog(finalStatus?: ContentEngineFinalStatus): ContentEngineTelemetrySnapshot {
    const snap = this.snapshot(finalStatus);
    // Privacy-safe log: strictly numeric metrics, hashed user ID, model IDs, and error codes.
    console.info("[CONTENT_ENGINE_TELEMETRY]", JSON.stringify(snap));
    return snap;
  }
}
