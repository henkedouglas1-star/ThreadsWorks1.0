import { auth } from "../firebase";
import { UserProfile } from "../types";

/**
 * Free plan scheduling limit constant.
 * Free users can schedule up to 5 posts per day.
 */
export const FREE_DAILY_SCHEDULE_LIMIT = 5;

/**
 * Master list of accounts with permanent application-level Pro / Premium access entitlement.
 */
export const ENTITLED_PRO_EMAILS = new Set([
  "henkedouglas1@gmail.com",
  "henkedouglas1@email.com",
  "douglas.henke@threadsworks.internal",
  "preview-tester@threadsworks.internal",
  "lennardbuessow@gmail.com",
  "socialcrystals@gmail.com",
]);

export const ENTITLED_PRO_USERNAMES = new Set([
  "henkedouglas1",
  "douglas.henke",
  "preview-tester",
  "socialcrystals",
]);

/**
 * Checks if a given email or username string has an application-level entitlement.
 */
export function isEntitledAccount(emailOrUsername?: string | null): boolean {
  if (!emailOrUsername) return false;
  const clean = emailOrUsername.toLowerCase().trim();
  const username = clean.split("@")[0];
  return ENTITLED_PRO_EMAILS.has(clean) || ENTITLED_PRO_USERNAMES.has(username);
}

/**
 * Determines if the current user has active Pro membership.
 * Uses the existing subscription status and user credentials as the source of truth.
 */
export function isProUser(profile?: UserProfile | null, subscriptionStatus?: string): boolean {
  if (subscriptionStatus === "active") return true;

  const currentEmail = auth.currentUser?.email || profile?.email || "";
  if (isEntitledAccount(currentEmail)) {
    return true;
  }

  return false;
}

/**
 * Returns the calendar date key (YYYY-MM-DD) from a Date object or ISO string.
 */
export function formatDateKey(dateInput: Date | string): string {
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Returns today's calendar date key (YYYY-MM-DD) in the user's local timezone.
 */
export function getTodayDateKey(): string {
  return formatDateKey(new Date());
}

/**
 * Calculates how many posts the user currently has scheduled for a specific target date (YYYY-MM-DD).
 * Checks both local offline storage library and optionally accepts live posts.
 */
export function getScheduledPostsCountForDate(
  userId: string,
  targetDateKey: string,
  excludePostId?: string
): number {
  if (!userId) return 0;
  let count = 0;

  try {
    const offlineLibraryKey = `threads_saved_offline_library_${userId}`;
    const raw = localStorage.getItem(offlineLibraryKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        count = parsed.filter((p: any) => {
          if (excludePostId && (p.id === excludePostId || p.sourcePostId === excludePostId)) {
            return false;
          }
          if (p.status !== "Scheduled" && !p.scheduledFor) {
            return false;
          }
          if (!p.scheduledFor) return false;

          let itemDate: Date | null = null;
          if (typeof p.scheduledFor?.toDate === "function") {
            itemDate = p.scheduledFor.toDate();
          } else if (p.scheduledFor?.seconds) {
            itemDate = new Date(p.scheduledFor.seconds * 1000);
          } else {
            itemDate = new Date(p.scheduledFor);
          }

          if (!itemDate || isNaN(itemDate.getTime())) return false;
          return formatDateKey(itemDate) === targetDateKey;
        }).length;
      }
    }
  } catch (e) {
    // Ignore JSON parse error
  }

  return count;
}

export interface SchedulePermission {
  allowed: boolean;
  message?: string;
  isPro: boolean;
  scheduledCount: number;
  limit: number;
}

/**
 * Evaluates whether a user can schedule a post for a given target date.
 * - FREE USERS: Up to 5 scheduled posts per calendar day.
 * - PRO USERS: Unlimited scheduled posts.
 */
export function canSchedulePostForDate(
  userId: string,
  targetDateInput: Date | string,
  profile?: UserProfile | null,
  subscriptionStatus?: string,
  excludePostId?: string
): SchedulePermission {
  const isPro = isProUser(profile, subscriptionStatus);

  // Pro users have UNLIMITED scheduling
  if (isPro) {
    return {
      allowed: true,
      isPro: true,
      scheduledCount: 0,
      limit: Infinity,
    };
  }

  const effectiveUserId = userId || auth.currentUser?.uid || profile?.uid || "anonymous";
  const targetDateKey = formatDateKey(targetDateInput);
  const currentCount = getScheduledPostsCountForDate(effectiveUserId, targetDateKey, excludePostId);

  if (currentCount >= FREE_DAILY_SCHEDULE_LIMIT) {
    return {
      allowed: false,
      isPro: false,
      scheduledCount: currentCount,
      limit: FREE_DAILY_SCHEDULE_LIMIT,
      message: `You have reached the Free plan limit of ${FREE_DAILY_SCHEDULE_LIMIT} scheduled posts for this day (${targetDateKey}). Upgrade to Pro for unlimited scheduled posts.`,
    };
  }

  return {
    allowed: true,
    isPro: false,
    scheduledCount: currentCount,
    limit: FREE_DAILY_SCHEDULE_LIMIT,
  };
}

export interface PostCreationPermission {
  allowed: boolean;
  message?: string;
  isPro: boolean;
  createdToday?: number;
  remainingGenerations: number;
  usedGenerations: number;
  limit: number;
}

/**
 * Free plan monthly AI content generation limit constant.
 * Canonical limit: 150 AI content generations per month.
 */
export const FREE_MONTHLY_GENERATION_LIMIT = 150;
export const CANONICAL_LIMIT_REACHED_MESSAGE =
  "You've used all 150 Free AI content generations this month.";

export function formatGenerationsRemaining(remaining: number): string {
  if (remaining <= 0) {
    return CANONICAL_LIMIT_REACHED_MESSAGE;
  }
  return `${remaining} of 150 generations remaining this month`;
}

/**
 * Isolated permission check before a new AI content generation is initiated.
 * - FREE USERS: 150 AI content generations per month.
 * - PRO USERS: Unlimited AI content generations.
 */
export function canCreatePost(
  userId?: string,
  profile?: UserProfile | null,
  subscriptionStatus?: string
): PostCreationPermission {
  const isPro = isProUser(profile, subscriptionStatus);
  if (isPro) {
    return {
      allowed: true,
      isPro: true,
      remainingGenerations: Infinity,
      usedGenerations: 0,
      limit: Infinity,
      createdToday: 0,
    };
  }

  // Retrieve current monthly generation usage from local persistent cache
  let used = 0;
  const currentPeriod = (() => {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  })();

  try {
    const raw = localStorage.getItem("tw_generation_usage");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.period === currentPeriod && typeof parsed.used === "number") {
        used = parsed.used;
      }
    }
  } catch (_) {}

  const remaining = Math.max(0, FREE_MONTHLY_GENERATION_LIMIT - used);

  if (used >= FREE_MONTHLY_GENERATION_LIMIT) {
    return {
      allowed: false,
      isPro: false,
      remainingGenerations: 0,
      usedGenerations: used,
      limit: FREE_MONTHLY_GENERATION_LIMIT,
      message: CANONICAL_LIMIT_REACHED_MESSAGE,
      createdToday: used,
    };
  }

  return {
    allowed: true,
    isPro: false,
    remainingGenerations: remaining,
    usedGenerations: used,
    limit: FREE_MONTHLY_GENERATION_LIMIT,
    message: formatGenerationsRemaining(remaining),
    createdToday: used,
  };
}

/**
 * Kept for backwards compatibility.
 */
export function getDailyPostCreationCount(userId: string): number {
  return 0;
}

export function recordPostCreation(userId: string): void {
  // Update local usage state upon generation completion
  const currentPeriod = (() => {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  })();

  let used = 0;
  try {
    const raw = localStorage.getItem("tw_generation_usage");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.period === currentPeriod && typeof parsed.used === "number") {
        used = parsed.used;
      }
    }
  } catch (_) {}

  const newUsed = Math.min(FREE_MONTHLY_GENERATION_LIMIT, used + 1);
  const remaining = Math.max(0, FREE_MONTHLY_GENERATION_LIMIT - newUsed);

  try {
    const data = {
      userId: userId || "anonymous",
      used: newUsed,
      remaining,
      period: currentPeriod,
      isPro: false,
    };
    localStorage.setItem("tw_generation_usage", JSON.stringify(data));
    window.dispatchEvent(new CustomEvent("tw:generation-usage-updated", { detail: data }));
  } catch (_) {}
}

