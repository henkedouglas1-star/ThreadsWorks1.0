import type { PostAttachedImage } from "../src/types/aiImage";
import {
  type AiImageAssetStore,
  buildSignedPublicImageUrl,
  MAX_IMAGE_BYTES,
  THREADS_ALLOWED_MIME_TYPES,
} from "./aiImageStorage";

export interface ThreadsPartContainerSpec {
  partIndex: number;
  mediaType: "TEXT" | "IMAGE";
  text: string;
  imageUrl?: string;
  altText?: string;
}

export interface PrepareThreadsMediaResult {
  ok: boolean;
  partSpecs: ThreadsPartContainerSpec[];
  attachedPartIndex: number | null;
  mediaPreparationFailed?: boolean;
  allowTextOnlyFallbackOption?: boolean;
  usedExplicitTextOnlyFallback?: boolean;
  error?: string;
}

export function isPublicHttpsBaseUrl(baseUrl: string): boolean {
  try {
    const parsed = new URL(baseUrl);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host.endsWith(".local")
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Prepares per-part Meta Threads container payloads for single-part or multi-part threads.
 * - Attaches at most 1 image to 1 selected part (default part 0 / Part 1).
 * - Never duplicates an image across multiple parts.
 * - Validates format (PNG/JPEG), size (<= 8MB), ownership, and public HTTPS accessibility.
 * - NEVER silently falls back to text-only publishing when media preparation fails unless
 *   `allowTextOnlyFallback === true` is explicitly passed by the creator.
 */
export async function prepareThreadsMediaPayloads(params: {
  parts: string[];
  attachedImage?: PostAttachedImage | null;
  userId: string;
  publicBaseUrl?: string;
  assetStore: AiImageAssetStore;
  allowTextOnlyFallback?: boolean;
  nowMs?: number;
}): Promise<PrepareThreadsMediaResult> {
  const {
    parts,
    attachedImage,
    userId,
    publicBaseUrl,
    assetStore,
    allowTextOnlyFallback = false,
    nowMs = Date.now(),
  } = params;

  const cleanParts = parts.map((p) => String(p || "").trim()).filter(Boolean);
  if (cleanParts.length === 0) {
    return {
      ok: false,
      partSpecs: [],
      attachedPartIndex: null,
      error: "Post text cannot be empty.",
    };
  }

  // No attached image => standard text-only publishing
  if (!attachedImage || !attachedImage.imageId) {
    return {
      ok: true,
      partSpecs: cleanParts.map((text, idx) => ({
        partIndex: idx,
        mediaType: "TEXT",
        text,
      })),
      attachedPartIndex: null,
    };
  }

  const requestedPartIndex =
    typeof attachedImage.partIndex === "number" &&
    Number.isInteger(attachedImage.partIndex)
      ? attachedImage.partIndex
      : 0;

  if (requestedPartIndex < 0 || requestedPartIndex >= cleanParts.length) {
    const errMsg = `Attached image part index (${requestedPartIndex + 1}) is out of range for a ${cleanParts.length}-part thread.`;
    if (allowTextOnlyFallback) {
      return {
        ok: true,
        partSpecs: cleanParts.map((text, idx) => ({
          partIndex: idx,
          mediaType: "TEXT",
          text,
        })),
        attachedPartIndex: null,
        usedExplicitTextOnlyFallback: true,
      };
    }
    return {
      ok: false,
      partSpecs: [],
      attachedPartIndex: null,
      mediaPreparationFailed: true,
      allowTextOnlyFallbackOption: true,
      error: errMsg,
    };
  }

  // Verify asset existence, ownership, format, size, and public delivery URL
  const loaded = await assetStore.loadBinary(attachedImage.imageId);
  if (!loaded || loaded.metadata.userId !== userId) {
    const errMsg =
      "The attached AI image could not be loaded or does not belong to your account.";
    if (allowTextOnlyFallback) {
      return {
        ok: true,
        partSpecs: cleanParts.map((text, idx) => ({
          partIndex: idx,
          mediaType: "TEXT",
          text,
        })),
        attachedPartIndex: null,
        usedExplicitTextOnlyFallback: true,
      };
    }
    return {
      ok: false,
      partSpecs: [],
      attachedPartIndex: null,
      mediaPreparationFailed: true,
      allowTextOnlyFallbackOption: true,
      error: errMsg,
    };
  }

  if (!THREADS_ALLOWED_MIME_TYPES.has(loaded.metadata.mimeType)) {
    const errMsg = `Image format (${loaded.metadata.mimeType}) is not supported by Meta Threads. Only PNG and JPEG images can be published.`;
    if (allowTextOnlyFallback) {
      return {
        ok: true,
        partSpecs: cleanParts.map((text, idx) => ({
          partIndex: idx,
          mediaType: "TEXT",
          text,
        })),
        attachedPartIndex: null,
        usedExplicitTextOnlyFallback: true,
      };
    }
    return {
      ok: false,
      partSpecs: [],
      attachedPartIndex: null,
      mediaPreparationFailed: true,
      allowTextOnlyFallbackOption: true,
      error: errMsg,
    };
  }

  if (loaded.buffer.length === 0 || loaded.buffer.length > MAX_IMAGE_BYTES) {
    const errMsg = "Attached image exceeds Meta Threads file size requirements.";
    if (allowTextOnlyFallback) {
      return {
        ok: true,
        partSpecs: cleanParts.map((text, idx) => ({
          partIndex: idx,
          mediaType: "TEXT",
          text,
        })),
        attachedPartIndex: null,
        usedExplicitTextOnlyFallback: true,
      };
    }
    return {
      ok: false,
      partSpecs: [],
      attachedPartIndex: null,
      mediaPreparationFailed: true,
      allowTextOnlyFallbackOption: true,
      error: errMsg,
    };
  }

  const resolvedBaseUrl = (publicBaseUrl || "").trim();
  if (!isPublicHttpsBaseUrl(resolvedBaseUrl)) {
    const errMsg =
      "A publicly accessible HTTPS media URL is required for Meta Threads image publishing. Verify APP_URL is configured or explicitly choose to publish as text-only.";
    if (allowTextOnlyFallback) {
      return {
        ok: true,
        partSpecs: cleanParts.map((text, idx) => ({
          partIndex: idx,
          mediaType: "TEXT",
          text,
        })),
        attachedPartIndex: null,
        usedExplicitTextOnlyFallback: true,
      };
    }
    return {
      ok: false,
      partSpecs: [],
      attachedPartIndex: null,
      mediaPreparationFailed: true,
      allowTextOnlyFallbackOption: true,
      error: errMsg,
    };
  }

  const signedImageUrl = buildSignedPublicImageUrl(
    resolvedBaseUrl,
    attachedImage.imageId,
    30 * 60 * 1000,
    nowMs
  );

  const partSpecs: ThreadsPartContainerSpec[] = cleanParts.map((text, idx) => {
    if (idx === requestedPartIndex) {
      return {
        partIndex: idx,
        mediaType: "IMAGE",
        text,
        imageUrl: signedImageUrl,
        altText: attachedImage.altText || loaded.metadata.altText || undefined,
      };
    }
    return {
      partIndex: idx,
      mediaType: "TEXT",
      text,
    };
  });

  return {
    ok: true,
    partSpecs,
    attachedPartIndex: requestedPartIndex,
  };
}

/**
 * Authoritative dispatch eligibility guard for scheduled posts.
 * Guarantees that confirmed canceled, unscheduled, draft, or already-published
 * posts are NEVER dispatched by delayed workers or retries.
 */
export function isScheduledPostEligibleForDispatch(
  postData: Record<string, any> | null | undefined,
  nowMs: number = Date.now()
): { eligible: boolean; reason?: string } {
  if (!postData || typeof postData !== "object") {
    return { eligible: false, reason: "MISSING_POST_DATA" };
  }

  if (
    postData.isCanceled === true ||
    postData.isCancelled === true ||
    postData.canceledAt ||
    postData.cancelledAt
  ) {
    return { eligible: false, reason: "POST_CANCELED" };
  }

  const normalizedStatus = String(postData.status || "").trim().toLowerCase();
  const normalizedStage = String(postData.stage || "").trim().toLowerCase();

  if (
    normalizedStatus === "canceled" ||
    normalizedStatus === "cancelled" ||
    normalizedStage === "canceled" ||
    normalizedStage === "cancelled"
  ) {
    return { eligible: false, reason: "POST_CANCELED" };
  }

  if (normalizedStatus !== "scheduled") {
    return { eligible: false, reason: `STATUS_NOT_SCHEDULED:${normalizedStatus || "empty"}` };
  }

  if (postData.isPublished === true) {
    return { eligible: false, reason: "ALREADY_PUBLISHED" };
  }

  const rawScheduledFor = postData.scheduledFor;
  if (!rawScheduledFor) {
    return { eligible: false, reason: "MISSING_SCHEDULED_FOR" };
  }

  let scheduledMs = NaN;
  if (rawScheduledFor instanceof Date) {
    scheduledMs = rawScheduledFor.getTime();
  } else if (typeof rawScheduledFor?.toDate === "function") {
    scheduledMs = rawScheduledFor.toDate().getTime();
  } else if (typeof rawScheduledFor?.seconds === "number") {
    scheduledMs = rawScheduledFor.seconds * 1000;
  } else if (typeof rawScheduledFor?._seconds === "number") {
    scheduledMs = rawScheduledFor._seconds * 1000;
  } else if (typeof rawScheduledFor === "string" || typeof rawScheduledFor === "number") {
    scheduledMs = new Date(rawScheduledFor).getTime();
  }

  if (!Number.isFinite(scheduledMs) || scheduledMs <= 0) {
    return { eligible: false, reason: "INVALID_SCHEDULED_FOR" };
  }

  if (scheduledMs > nowMs) {
    return { eligible: false, reason: "NOT_DUE_YET" };
  }

  return { eligible: true };
}
