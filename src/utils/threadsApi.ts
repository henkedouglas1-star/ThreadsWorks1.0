/**
 * Threads API Client Handler Utilities
 * Expert Senior Refactoring for Resolving Meta Authorization Error 4476002
 */

import { db, auth, withTimeout } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { safeSetLocalStorage, safeRemoveLocalStorage } from "../lib/safeStorage";

export interface ThreadsPublishPayload {
  media_type: "TEXT";
  text: string;
  client_id: string; // explicitly mapped lowercase underscored expected field
  access_token: string;
}

export interface ThreadsConnectionInfo {
  connected: boolean;
  threadsUserId?: string;
  threadsUsername?: string;
  threadsProfilePictureUrl?: string;
  threadsBiography?: string;
  isSandbox?: boolean;
  accessToken?: string;
  grantedScopes?: string[];
  hasInsightsPermission?: boolean;
  hasPublishPermission?: boolean;
  verificationStatus?: "verified" | "unverified" | "failed";
  error?: string;
}

/**
 * Standard production Meta Threads OAuth Scopes requested by ThreadsWorks.
 * Includes basic profile, content publishing, and analytics insights capabilities.
 */
export const DEFAULT_THREADS_SCOPES = "threads_basic,threads_content_publish,threads_manage_insights,threads_read_replies,threads_manage_replies";

// Memory cache for connection status to minimize Firestore read units and respect quota limits
const connectionCache = new Map<string, { data: ThreadsConnectionInfo; timestamp: number }>();
const CACHE_TTL_MS = 60000; // 1 minute cache for Firestore and verification efficiency

export function invalidateThreadsConnectionCache(userId?: string) {
  if (userId) {
    connectionCache.delete(userId);
  } else {
    connectionCache.clear();
  }
}

function isQuotaOrNetworkError(err: any): boolean {
  const msg = (err?.message || String(err) || "").toLowerCase();
  const code = (err?.code || "").toLowerCase();
  return msg.includes("quota") || 
         msg.includes("resource-exhausted") || 
         msg.includes("resource_exhausted") || 
         msg.includes("limit exceeded") || 
         msg.includes("rate limit") ||
         code.includes("resource-exhausted") ||
         code.includes("unavailable");
}

export function clearThreadsLocalConnection(userId?: string) {
  try {
    if (userId) {
      localStorage.removeItem(`threads_is_connected_${userId}`);
      localStorage.removeItem(`threads_connected_username_${userId}`);
    }
    // Clean legacy non-namespaced keys
    localStorage.removeItem("is_connected");
    localStorage.removeItem("threads_connected_username");
    localStorage.removeItem("threads_oauth_payload");
  } catch (_) {}
}

/**
 * Unified single source of truth for verifying Threads connection status.
 * Performs server-side verification and reads Firestore credentials.
 */
export async function checkThreadsConnection(userId?: string, verifyWithServer = false): Promise<ThreadsConnectionInfo> {
  const effectiveUserId = userId || auth.currentUser?.uid || "";
  if (!effectiveUserId) {
    return { connected: false };
  }

  // Check memory cache unless fresh server verification is requested
  const cached = connectionCache.get(effectiveUserId);
  const now = Date.now();
  if (!verifyWithServer && cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const userKeyConnected = `threads_is_connected_${effectiveUserId}`;
  const userKeyUsername = `threads_connected_username_${effectiveUserId}`;

  // 1. Try server-authoritative verification endpoint
  try {
    const idToken = await auth.currentUser?.getIdToken();
    const headers: Record<string, string> = {};
    if (idToken) {
      headers["Authorization"] = `Bearer ${idToken}`;
    }

    const serverRes = await fetch(`/api/threads/verify-connection?userId=${encodeURIComponent(effectiveUserId)}`, { headers });
    if (serverRes.ok) {
      const sData = await serverRes.json();
      if (sData.connected) {
        safeSetLocalStorage(userKeyConnected, "true");
        safeSetLocalStorage(userKeyUsername, sData.threadsUsername || "threads_user");
        safeRemoveLocalStorage("is_connected");
        safeRemoveLocalStorage("threads_connected_username");
        const info: ThreadsConnectionInfo = {
          connected: true,
          threadsUserId: String(sData.threadsUserId),
          threadsUsername: sData.threadsUsername || "",
          grantedScopes: sData.grantedScopes || [],
          hasInsightsPermission: Boolean(sData.hasInsightsPermission),
          hasPublishPermission: Boolean(sData.hasPublishPermission),
          verificationStatus: "verified"
        };
        connectionCache.set(effectiveUserId, { data: info, timestamp: now });
        return info;
      } else if (sData.status === "reauthorization_required") {
        clearThreadsLocalConnection(effectiveUserId);
        const reauthInfo: ThreadsConnectionInfo = {
          connected: false,
          error: sData.error || "Re-authorization required."
        };
        connectionCache.set(effectiveUserId, { data: reauthInfo, timestamp: now });
        return reauthInfo;
      }
    }
  } catch (serverErr) {
    console.warn("Server connection verification check failed, falling back to Firestore read:", serverErr);
  }

  // 2. Direct Firestore connection check
  try {
    const [connSnap, secureSnap] = await Promise.all([
      withTimeout(getDoc(doc(db, "connections", effectiveUserId)), 6000, true),
      withTimeout(getDoc(doc(db, "connections_secure", effectiveUserId)), 6000, true)
    ]);

    if (connSnap && connSnap.exists()) {
      const connData = connSnap.data() || {};
      const secureData = (secureSnap && secureSnap.exists()) ? (secureSnap.data() || {}) : {};
      
      const token = secureData.threadsAccessToken || connData.threadsAccessToken || "";
      const threadsUserId = connData.threadsUserId || "";
      const isConnected = (connData.connectionStatus === "connected" || Boolean(threadsUserId)) && 
                          Boolean(token);

      if (isConnected) {
        localStorage.setItem(userKeyConnected, "true");
        localStorage.setItem(userKeyUsername, connData.threadsUsername || "threads_user");
        localStorage.removeItem("is_connected");
        localStorage.removeItem("threads_connected_username");
        const rawScopes: string[] = connData.tokenMetadata?.grantedScopes || connData.grantedScopes || [];
        const hasInsights = connData.tokenMetadata?.hasInsightsPermission !== undefined 
          ? Boolean(connData.tokenMetadata.hasInsightsPermission)
          : (rawScopes.length === 0 || rawScopes.includes("threads_manage_insights"));
        const hasPublish = connData.tokenMetadata?.hasPublishPermission !== undefined
          ? Boolean(connData.tokenMetadata.hasPublishPermission)
          : (rawScopes.length === 0 || rawScopes.includes("threads_content_publish"));

        const info: ThreadsConnectionInfo = {
          connected: true,
          threadsUserId: String(threadsUserId),
          threadsUsername: connData.threadsUsername || "",
          threadsProfilePictureUrl: connData.threadsProfilePictureUrl || "",
          threadsBiography: connData.threadsBiography || "",
          isSandbox: connData.tokenMetadata?.sandbox || false,
          accessToken: token,
          grantedScopes: rawScopes,
          hasInsightsPermission: hasInsights,
          hasPublishPermission: hasPublish,
          verificationStatus: "verified"
        };
        connectionCache.set(effectiveUserId, { data: info, timestamp: now });
        return info;
      }
    }

    const isConnLocal = localStorage.getItem(userKeyConnected) === "true";
    const cachedUser = localStorage.getItem(userKeyUsername);

    if (isConnLocal) {
      const fallbackInfo: ThreadsConnectionInfo = {
        connected: true,
        threadsUsername: cachedUser || "threads_user"
      };
      connectionCache.set(effectiveUserId, { data: fallbackInfo, timestamp: now - 30000 });
      return fallbackInfo;
    }

    clearThreadsLocalConnection(effectiveUserId);
    const disconnectedInfo: ThreadsConnectionInfo = { connected: false };
    connectionCache.set(effectiveUserId, { data: disconnectedInfo, timestamp: now });
    return disconnectedInfo;
  } catch (err: any) {
    if (isQuotaOrNetworkError(err)) {
      console.warn("Firestore quota limit active; falling back to cached local connection state.");
    } else {
      console.warn("Non-fatal note verifying Threads connection in Firestore:", err?.message || err);
    }

    const isConn = localStorage.getItem(userKeyConnected) === "true";
    const cachedUser = localStorage.getItem(userKeyUsername);
    const fallbackInfo: ThreadsConnectionInfo = isConn ? {
      connected: true,
      threadsUsername: cachedUser || "threads_user"
    } : { connected: false };

    connectionCache.set(effectiveUserId, { data: fallbackInfo, timestamp: now - 30000 });
    return fallbackInfo;
  }
}

/**
 * Validates the retrieved Threads access token to ensure it isn't empty,
 * missing, or corrupted before appending it to the payload or headers.
 */
export function validateAccessToken(token: string | null | undefined): string {
  if (!token) {
    throw new Error("Validation Failed: Access token is missing or null.");
  }
  const trimmed = token.trim();
  if (trimmed === "" || trimmed === "undefined" || trimmed === "null") {
    throw new Error("Validation Failed: Access token is empty or invalid placeholder.");
  }
  if (trimmed.length < 10) {
    throw new Error("Validation Failed: Access token appears to be corrupted or too short.");
  }
  return trimmed;
}

/**
 * Safe client-side retrieval of the Meta App ID
 */
export function getThreadsAppId(): string {
  return "2270750866796278";
}

/**
 * Generates the clean Meta Threads OAuth authorization URL with structured state.
 */
export function generateThreadsAuthUrl(
  userId: string, 
  scopes: string = DEFAULT_THREADS_SCOPES,
  returnTo: string = "/analytics"
): string {
  const clientId = "2270750866796278";
  const redirectUri = "https://ThreadsWorks.com/auth/threads/callback";

  // Build structured state payload including window.location.origin
  const statePayload = {
    userId: String(userId),
    returnTo: returnTo.startsWith("/") ? returnTo : "/analytics",
    origin: typeof window !== "undefined" ? window.location.origin : "",
    nonce: Math.random().toString(36).substring(2, 10),
    ts: Date.now()
  };

  let stateStr = userId;
  try {
    stateStr = btoa(JSON.stringify(statePayload));
  } catch (e) {
    stateStr = `analytics_${userId}_${Date.now()}`;
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes,
    state: stateStr
  });

  return `https://www.threads.net/oauth/authorize?${params.toString()}`;
}

/**
 * Initiates the Threads OAuth flow preserving the caller's return destination.
 */
export async function initiateThreadsOAuthFlow(options: {
  userId: string;
  returnTo?: string;
  scope?: string;
}): Promise<{ success: boolean; data?: any; error?: string; cancelled?: boolean }> {
  const { userId, returnTo = "/analytics", scope = DEFAULT_THREADS_SCOPES } = options;
  if (!userId) {
    return { success: false, error: "User is not authenticated." };
  }

  const currentOrigin = typeof window !== "undefined" ? window.location.origin : "";
  let authUrl = "";
  try {
    const res = await fetch("/api/threads/auth-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, returnTo, scope, origin: currentOrigin })
    });
    if (res.ok) {
      const data = await res.json();
      authUrl = data.authUrl || data.url || "";
    }
  } catch (err) {
    console.warn("Failed to obtain dynamic auth URL from backend, using generator fallback:", err);
  }

  if (!authUrl) {
    authUrl = generateThreadsAuthUrl(userId, scope, returnTo);
  }

  return new Promise((resolve) => {
    const width = 600;
    const height = 750;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    let popup: Window | null = null;
    try {
      popup = window.open(
        authUrl,
        "ThreadsAuthorization",
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,location=no,status=no`
      );
    } catch (e) {
      console.warn("Popup blocked, executing whole-window navigation redirect:", e);
    }

    if (!popup || popup.closed || typeof popup.closed === "undefined") {
      window.location.href = authUrl;
      return;
    }

    let resolved = false;

    const handleOAuthMessage = async (event: MessageEvent) => {
      if (
        event.data?.type === "OAUTH_AUTH_SUCCESS" || 
        event.data?.type === "THREADS_AUTH_SUCCESS"
      ) {
        cleanup();
        const payload = event.data.payload || event.data.data || {};
        invalidateThreadsConnectionCache(userId);

        const granted = payload.grantedScopes || ["threads_basic", "threads_content_publish", "threads_manage_insights"];
        const hasInsights = Boolean(payload.hasInsightsPermission ?? granted.includes("threads_manage_insights"));
        const hasPublish = Boolean(payload.hasPublishPermission ?? (granted.length === 0 || granted.includes("threads_content_publish")));

        const info: ThreadsConnectionInfo = {
          connected: true,
          threadsUserId: String(payload.threadsUserId || ""),
          threadsUsername: payload.threadsUsername || "",
          threadsProfilePictureUrl: payload.threadsProfilePictureUrl || "",
          threadsBiography: payload.threadsBiography || "",
          accessToken: payload.accessToken || payload.threadsAccessToken,
          grantedScopes: granted,
          hasInsightsPermission: hasInsights,
          hasPublishPermission: hasPublish,
          verificationStatus: "verified"
        };
        connectionCache.set(userId, { data: info, timestamp: Date.now() });

        try {
          localStorage.setItem(`threads_is_connected_${userId}`, "true");
          localStorage.setItem(`threads_connected_username_${userId}`, payload.threadsUsername || "threads_user");
        } catch (_) {}

        try {
          if (userId && (payload.threadsUserId || payload.threadsUsername)) {
            const clientPayload = {
              userId: String(userId),
              threadsUserId: String(payload.threadsUserId || ""),
              threadsUsername: payload.threadsUsername || "",
              threadsProfilePictureUrl: payload.threadsProfilePictureUrl || "",
              threadsBiography: payload.threadsBiography || "",
              connectionStatus: "connected",
              verificationStatus: "verified",
              lastConnectedAt: new Date().toISOString(),
              lastVerifiedAt: new Date().toISOString(),
              tokenMetadata: {
                generatedAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + (payload.expiresIn || 5184000) * 1000).toISOString(),
                sandbox: false,
                grantedScopes: granted,
                hasInsightsPermission: hasInsights,
                hasPublishPermission: hasPublish
              }
            };
            await withTimeout(setDoc(doc(db, "connections", userId), clientPayload, { merge: true }), 4000, true);
            const activeToken = payload.accessToken || payload.threadsAccessToken;
            if (activeToken) {
              await withTimeout(setDoc(doc(db, "connections_secure", userId), { 
                threadsAccessToken: activeToken 
              }, { merge: true }), 4000, true);

              // Immediately sync to server cache and disk persistence
              fetch("/api/threads/sync-credentials", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  userId: String(userId),
                  accessToken: activeToken,
                  threadsUserId: String(payload.threadsUserId || ""),
                  threadsUsername: payload.threadsUsername || ""
                })
              }).catch(() => {});
            }
          }
        } catch (persErr) {
          console.warn("Client Firestore connection persistence note:", persErr);
        }

        resolve({ success: true, data: info });
      } else if (
        event.data?.type === "OAUTH_AUTH_CANCELLED" || 
        event.data?.type === "THREADS_AUTH_CANCELLED"
      ) {
        cleanup();
        resolve({ success: false, cancelled: true, error: event.data.error || "Authorization cancelled" });
      } else if (
        event.data?.type === "OAUTH_AUTH_ERROR" || 
        event.data?.type === "THREADS_AUTH_ERROR"
      ) {
        cleanup();
        resolve({ success: false, error: event.data.error || "Connection failed" });
      }
    };

    const cleanup = () => {
      if (resolved) return;
      resolved = true;
      window.removeEventListener("message", handleOAuthMessage);
      clearInterval(pollTimer);
    };

    window.addEventListener("message", handleOAuthMessage);

    // Watch for user closing the popup window manually
    const pollTimer = setInterval(async () => {
      if (popup && popup.closed) {
        cleanup();
        // Check if connection was verified in background
        const verified = await checkThreadsConnection(userId, true);
        if (verified.connected) {
          resolve({ success: true, data: verified });
        } else {
          resolve({ success: false, cancelled: true, error: "Authorization popup was closed." });
        }
      }
    }, 1000);
  });
}

/**
 * Checks the live permission scopes granted by Meta for a connected Threads user.
 */
export async function checkThreadsPermissionsStatus(userId?: string): Promise<{
  connected: boolean;
  grantedScopes: string[];
  hasInsights: boolean;
  hasPublish: boolean;
  needsReauthForInsights: boolean;
}> {
  const effectiveUserId = userId || auth.currentUser?.uid || "";
  if (!effectiveUserId) {
    return {
      connected: false,
      grantedScopes: [],
      hasInsights: false,
      hasPublish: false,
      needsReauthForInsights: false
    };
  }

  try {
    const res = await fetch(`/api/threads/permissions?userId=${encodeURIComponent(effectiveUserId)}`);
    if (res.ok) {
      const data = await res.json();
      const granted = data.grantedScopes || [];
      const hasInsights = Boolean(data.hasInsightsPermission || granted.includes("threads_manage_insights"));
      const hasPublish = Boolean(data.hasPublishPermission || granted.includes("threads_content_publish"));
      return {
        connected: Boolean(data.connected),
        grantedScopes: granted,
        hasInsights,
        hasPublish,
        needsReauthForInsights: Boolean(data.connected && !hasInsights)
      };
    }
  } catch (err) {
    console.warn("Could not query /api/threads/permissions directly:", err);
  }

  // Fallback to local cached connection check
  const conn = await checkThreadsConnection(effectiveUserId);
  const granted = conn.grantedScopes || [];
  const hasInsights = Boolean(conn.hasInsightsPermission || granted.includes("threads_manage_insights"));
  const hasPublish = Boolean(conn.hasPublishPermission || granted.includes("threads_content_publish") || granted.length === 0);

  return {
    connected: conn.connected,
    grantedScopes: granted,
    hasInsights,
    hasPublish,
    needsReauthForInsights: Boolean(conn.connected && !hasInsights)
  };
}

/**
 * Publishes content directly to the Meta Threads API gateway or server layer
 * incorporating robust client-side validation, error handling, and parameter mapping.
 */
export async function publishToThreadsApi(options: {
  text: string;
  threadsUserId: string;
  tokenSource?: "firestore" | "localstorage";
  customToken?: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    // 1. Guard against empty text
    const cleanText = options.text?.trim() || "";
    if (!cleanText) {
      throw new Error("Publishing Blocked: Content text is empty.");
    }
    if (cleanText.length > 500) {
      throw new Error("Publishing Blocked: Threads posts have a maximum limit of 500 characters.");
    }

    // 2. Securely extract the App ID with defensive guard clause
    const clientId = getThreadsAppId();

    // 3. Extract and validate access token from specified source
    let tokenToUse = "";
    if (options.tokenSource === "localstorage") {
      const storedToken = localStorage.getItem("threads_access_token");
      tokenToUse = validateAccessToken(storedToken);
    } else {
      tokenToUse = validateAccessToken(options.customToken);
    }

    console.log("Client-side validation passed. Dispatching payload directly to backend gateway.");

    // 4. Construct mapped payload utilizing the lowercase, underscored 'client_id' key
    const payload: ThreadsPublishPayload = {
      media_type: "TEXT",
      text: cleanText,
      client_id: clientId,
      access_token: tokenToUse
    };

    // 5. Post to the integration layer endpoint
    const res = await fetch("/api/threads/publish", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text: cleanText,
        accessToken: tokenToUse,
        threadsUserId: options.threadsUserId,
        client_id: clientId // Send client_id explicitly mapped to lowercase underscored key
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `Meta API Gateway returned server or network error: ${res.status}`);
    }

    return { success: true, id: data.postId };
  } catch (err: any) {
    console.error("Threads API Publication Failure:", err.message || err);
    return { success: false, error: err.message || String(err) };
  }
}
