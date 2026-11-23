export type ImagePlan = "free" | "pro";

export type ImageAspectRatio = "1:1" | "3:4" | "4:3";

export type AttachedImageStatus = "generated" | "accepted";

export interface PostAttachedImage {
  imageId: string;
  requestId: string;
  postId?: string;
  partIndex: number;
  mimeType: string;
  width?: number;
  height?: number;
  aspectRatio: ImageAspectRatio | string;
  altText?: string;
  previewUrl: string;
  status: AttachedImageStatus;
  createdAt: string;
}

export interface ImageAllowanceStatus {
  plan: ImagePlan;
  isPro: boolean;
  limit: number;
  used: number;
  remaining: number;
  reservedInFlight: number;
  periodType: "weekly" | "daily";
  periodKey: string;
  nextResetAtIso: string;
  resetLabel: string;
  remainingText: string;
  exhaustedText: string;
  upgradePrompt: string | null;
}

export interface ImageGenerationRequestPayload {
  requestId: string;
  postId?: string;
  postText: string;
  parts?: string[];
  partIndex?: number;
  topic?: string;
  pillarTitle?: string;
  tone?: string;
  audience?: string;
  brandStyle?: string;
  brandColors?: string[];
  visualDirection?: string;
  aspectRatio?: ImageAspectRatio;
  isRegeneration?: boolean;
}

export interface GeneratePostImageResponse {
  success: boolean;
  image?: PostAttachedImage;
  allowance: ImageAllowanceStatus;
  recovered?: boolean;
  inProgress?: boolean;
  error?: string;
  errorCode?:
    | "UNAUTHENTICATED"
    | "INVALID_INPUT"
    | "RATE_LIMITED"
    | "IMAGE_LIMIT_REACHED"
    | "REQUEST_IN_PROGRESS"
    | "PROVIDER_ERROR"
    | "PROVIDER_TIMEOUT"
    | "STORAGE_ERROR"
    | "FORBIDDEN"
    | "NOT_FOUND";
}

export const FREE_WEEKLY_IMAGE_LIMIT = 1;
export const PRO_DAILY_IMAGE_LIMIT = 1;

export const FREE_IMAGE_UPGRADE_PROMPT =
  "Want more AI images? Pro includes 1 image every day.";

/**
 * Formats authoritative allowance copy strings for Free (weekly, resets Monday UTC)
 * and Pro (daily, resets 00:00 UTC) plans.
 */
export function buildAllowanceCopy(
  plan: ImagePlan,
  limit: number,
  remaining: number
): {
  resetLabel: string;
  remainingText: string;
  exhaustedText: string;
  upgradePrompt: string | null;
} {
  const safeRemaining = Math.max(0, Math.min(limit, remaining));
  if (plan === "pro") {
    return {
      resetLabel: "Resets tomorrow",
      remainingText: `${safeRemaining} of ${limit} daily images remaining`,
      exhaustedText: "Your daily AI image has been used. Resets tomorrow.",
      upgradePrompt: null,
    };
  }
  return {
    resetLabel: "Resets Monday",
    remainingText: `${safeRemaining} of ${limit} weekly images remaining`,
    exhaustedText: "Your weekly AI image has been used. Resets Monday.",
    upgradePrompt: safeRemaining <= 0 ? FREE_IMAGE_UPGRADE_PROMPT : null,
  };
}

/**
 * Formats a server-provided UTC ISO timestamp in the viewer's local time zone.
 * Never uses the local device clock to compute reset eligibility.
 */
export function formatResetTimestampLocal(
  nextResetAtIso: string,
  locale?: string,
  timeZone?: string
): string {
  const date = new Date(nextResetAtIso);
  if (Number.isNaN(date.getTime())) {
    return nextResetAtIso;
  }
  try {
    return new Intl.DateTimeFormat(locale || undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
      ...(timeZone ? { timeZone } : {}),
    }).format(date);
  } catch {
    return date.toUTCString();
  }
}
