/**
 * Threads Profile URL & Username Helper Utility
 * Provides canonical normalization and URL generation for external Threads profiles.
 */

/**
 * Normalizes a raw Threads username or profile URL into a clean username handle string.
 *
 * Examples:
 * - "@creatorname" -> "creatorname"
 * - " creatorname " -> "creatorname"
 * - "https://www.threads.net/@creatorname" -> "creatorname"
 * - "https://threads.com/@creatorname/" -> "creatorname"
 *
 * @param usernameOrUrl Raw username, @username, or full profile URL
 * @returns Clean normalized username handle or empty string if invalid
 */
export function normalizeThreadsUsername(usernameOrUrl?: string | null): string {
  if (!usernameOrUrl || typeof usernameOrUrl !== "string") return "";

  let cleaned = usernameOrUrl.trim();
  if (!cleaned) return "";

  // Strip single trailing slash first so trailing slashes don't trigger malformed slash reject logic
  if (cleaned.endsWith("/")) {
    cleaned = cleaned.slice(0, -1).trim();
  }

  // If contains a slash, but doesn't start with http, www., threads.net, or threads.com, reject as malformed
  if (cleaned.includes("/")) {
    const isUrl = /^(https?:\/\/|www\.|threads\.net|threads\.com)/i.test(cleaned);
    if (!isUrl) {
      return "";
    }
  }

  // 1. Strip protocol, domain, and @ prefixes
  cleaned = cleaned.replace(/^(https?:\/\/)?(www\.)?(threads\.net|threads\.com)\/@?/i, "");

  // 2. Remove leading @
  cleaned = cleaned.replace(/^@+/, "").trim();

  // 3. Remove trailing path segments, query parameters, or hash
  if (cleaned.includes("/")) {
    cleaned = cleaned.split("/")[0];
  }
  if (cleaned.includes("?")) {
    cleaned = cleaned.split("?")[0];
  }
  if (cleaned.includes("#")) {
    cleaned = cleaned.split("#")[0];
  }

  // 4. Remove any remaining leading/trailing @ or slashes
  cleaned = cleaned.replace(/^@+/, "").replace(/\/+$/, "").trim();

  // 5. Reject invalid strings, undefined, null, or invalid characters
  if (!cleaned || cleaned === "undefined" || cleaned === "null" || cleaned.length < 1) {
    return "";
  }

  // Reject malformed characters (spaces, colons, brackets, slashes)
  if (/[\s:<>\/\\\{\}\(\)]/.test(cleaned)) {
    return "";
  }

  return cleaned;
}

/**
 * Builds the canonical Threads profile URL for a given username handle.
 *
 * Architecture:
 * buildThreadsProfileUrl(threadsUsername) -> "https://www.threads.net/@{normalizedUsername}"
 *
 * @param usernameOrUrl Raw username or URL
 * @returns Absolute public Threads URL or empty string if invalid
 */
export function buildThreadsProfileUrl(usernameOrUrl?: string | null): string {
  const normalized = normalizeThreadsUsername(usernameOrUrl);
  if (!normalized) return "";
  return `https://www.threads.net/@${normalized}`;
}

/**
 * Legacy alias for backwards compatibility
 */
export const getThreadsProfileUrl = buildThreadsProfileUrl;
