import React, { useState, useEffect, useRef, useCallback, useMemo, Suspense, lazy } from "react";
import { auth, db, withTimeout, handleFirestoreError, OperationType, ensureGoogleUserProfile } from "./firebase";
import { doc, getDoc, setDoc, addDoc, collection, query, where, onSnapshot, limit } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { UserProfile } from "./types";
import Sidebar from "./components/Sidebar";
import TopNav from "./components/TopNav";
import { Sparkles, CircleIcon } from "lucide-react";
import { ContentPersistenceProvider } from "./context/ContentPersistenceContext";
import { PrivacyPolicyModal, TermsOfServiceModal } from "./components/LegalModals";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import { ThreadsConnectionProvider } from "./context/ThreadsConnectionContext";
import ContentEngineView from "./components/ContentEngineView";
import { isEntitledAccount } from "./utils/contentLimit";
import { clearThreadsLocalConnection, invalidateThreadsConnectionCache, checkThreadsConnection } from "./utils/threadsApi";
import { useAuthSession } from "./hooks/useAuthSession";
import { resolveAppScreen, type AppScreen } from "./lib/authContract";
import { logAuthDiagnostic, maskUidForDiagnostics } from "./lib/authDiagnostics";
import {
  attachPreviewHandoffResume,
  getPreviewGoogleBridgeHandoffId,
  isEmbeddedAiStudioPreview,
} from "./lib/previewGoogleHandoff";
import PreviewGoogleBridgeView from "./components/PreviewGoogleBridgeView";
import {
  safeGetLocalStorage,
  safeSetLocalStorage,
  safeRemoveLocalStorage,
  safeGetSessionStorage,
  safeSetSessionStorage,
} from "./lib/safeStorage";

// Safe dynamic import helper with automatic retry and stale chunk recovery
function lazyWithRetry<T extends React.ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>,
  retriesLeft = 3,
  interval = 800
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    for (let attempt = 0; attempt <= retriesLeft; attempt++) {
      try {
        return await componentImport();
      } catch (error: any) {
        const msg = String(error?.message || error || "");
        const isChunkOrMimeError =
          msg.includes("MIME type") ||
          msg.includes("Failed to fetch dynamically imported module") ||
          msg.includes("Importing a module script failed");

        if (attempt >= retriesLeft) {
          if (typeof window !== "undefined" && isChunkOrMimeError) {
            const reloadKey = "chunk_lazy_reload_" + window.location.pathname;
            if (!safeGetSessionStorage(reloadKey)) {
              safeSetSessionStorage(reloadKey, Date.now().toString());
              window.location.reload();
            }
          }
          throw error;
        }
        await new Promise((r) => setTimeout(r, interval * (attempt + 1)));
      }
    }
    return await componentImport();
  });
}

import AuthScreen from "./components/AuthScreen";
import ProfileView from "./components/ProfileView";
import MobileBottomNav from "./components/MobileBottomNav";
import DashboardView from "./components/DashboardView";
import MyIdentityView from "./components/MyIdentityView";
import MyBusinessView from "./components/MyBusinessView";
import ContentLibraryView from "./components/ContentLibraryView";
import CalendarView from "./components/CalendarView";
import AnalyticsView from "./components/AnalyticsView";
import PricingView from "./components/PricingView";
import PartnerHubView from "./components/PartnerHub/PartnerHubView";
import InfluencerIntelligenceView from "./components/Influencer/InfluencerIntelligenceView";
import PreviewEditionView from "./components/PreviewEditionView";
import PublicMarketingPage from "./components/PublicMarketingPage";
import { trackReferralClick, attributeUserToReferral } from "./services/partnerService";
import {
  DEFAULT_OG_IMAGE,
  SITE_NAME,
  buildStructuredDataForRoute,
  getCanonicalUrl,
  getPublicMarketingRoute,
  normalizeMarketingPath
} from "./marketing/marketingRoutes";

const urlToTab: Record<string, string> = {
  "/": "engine",
  "/create": "engine",
  "/apps": "apps",
  "/dashboard": "apps",
  "/content-ideas": "engine",
  "/ai-threads-post-generator": "engine",
  "/profile": "profile",
  "/my-identity": "profile",
  "/identity": "profile",
  "/my-business": "profile",
  "/business": "profile",
  "/strategy": "engine",
  "/strategy-app": "engine",
  "/brand-audit": "engine",
  "/brand-audit-app": "engine",
  "/content-strategy": "engine",
  "/opportunity-engine": "engine",
  "/creator-profile": "profile",
  "/content-profile": "profile",
  "/settings": "profile",
  "/calendar": "calendar",
  "/content-calendar": "calendar",
  "/threads-scheduler": "calendar",
  "/schedule": "calendar",
  "/analytics": "analytics",
  "/threads-analytics": "analytics",
  "/viral-flywheel": "engine",
  "/flywheel": "engine",
  "/overview": "engine",
  "/call-to-action-generator": "profile",
  "/cta-generator": "profile",
  "/cta": "profile",
  "/cta-studio": "profile",
  "/threads-hook-generator": "engine",
  "/saved-content": "library",
  "/content-memory": "engine",
  "/memory": "engine",
  "/memory-workflow": "engine",
  "/memory-workflow-app": "engine",

  "/preview": "preview",
  "/preview-edition": "preview",
  "/pricing": "pricing",
  "/partner": "partner",
  "/partner-hub": "partner",
  "/affiliate": "partner",
  "/affiliates": "partner",
  "/intelligence": "engine",
  "/adaptive-intelligence": "engine",
  "/influencer": "influencer",
  "/influencers": "influencer",
  "/influencer-intelligence": "influencer"
};

const tabToUrl: Record<string, string> = {
  engine: "/create",
  create: "/create",
  apps: "/apps",
  dashboard: "/apps",
  profile: "/profile",
  identity: "/profile",
  business: "/profile",
  calendar: "/calendar",
  analytics: "/analytics",
  flywheel: "/create",
  library: "/saved-content",
  memory: "/create",
  drive: "/google-drive",
  preview: "/preview",
  pricing: "/pricing",
  intelligence: "/create",
  strategy: "/create",
  partner: "/partner-hub",
  influencer: "/influencers"
};

const tabMetadata: Record<string, { title: string; description: string }> = {
  engine: {
    title: "AI Threads Writer Workspace | ThreadsWorks",
    description: "Draft Meta Threads posts, multi-part threads, and opening hooks calibrated to your Creator Profile."
  },
  calendar: {
    title: "Threads Content Calendar & Scheduling | ThreadsWorks",
    description: "Visualize, plan, schedule, and auto-publish your Meta Threads posts on one calendar."
  },
  analytics: {
    title: "Threads Analytics | ThreadsWorks",
    description: "Track real-time Meta Threads performance metrics inside your private workspace."
  },
  profile: {
    title: "Creator Profile & Business Positioning | ThreadsWorks",
    description: "Manage your Voice, Business Offers, CTA Preferences, and Meta Threads Account Connection."
  },
  pricing: {
    title: "ThreadsWorks Pricing — Free & Pro Creator Plans",
    description: "Compare ThreadsWorks Free and Pro plans for AI Threads post writing, hook tools, and scheduling."
  },
  partner: {
    title: "ThreadsWorks Partner Hub",
    description: "Manage your ThreadsWorks affiliate link, referrals, and commissions."
  },
  influencer: {
    title: "Influencer Intelligence | ThreadsWorks",
    description: "Discover relevant creators and manage outreach inside your ThreadsWorks workspace."
  }
};

function upsertMetaTag(attr: "name" | "property", key: string, content: string) {
  let tag = document.querySelector(`meta[${attr}="${key}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

function clearDynamicStructuredData() {
  const legacy = document.getElementById("structured-data-seo");
  if (legacy) legacy.remove();
  document.querySelectorAll('script[id^="threadsworks-ld-"]').forEach((node) => node.remove());
}

function applyDocumentSeo(pathname: string, isAuthenticatedWorkspace: boolean, activeTab: string) {
  if (typeof document === "undefined") return;
  const normalizedPath = normalizeMarketingPath(pathname);
  const publicRoute = getPublicMarketingRoute(normalizedPath);
  const isLegal = normalizedPath === "/privacy" || normalizedPath === "/terms";

  if (publicRoute && (!isAuthenticatedWorkspace || isLegal)) {
    const canonical = getCanonicalUrl(publicRoute.path);
    document.title = publicRoute.title;
    upsertMetaTag("name", "description", publicRoute.description);
    upsertMetaTag("name", "robots", "index, follow");

    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement("link");
      canonicalLink.setAttribute("rel", "canonical");
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute("href", canonical);

    upsertMetaTag("property", "og:site_name", SITE_NAME);
    upsertMetaTag("property", "og:type", "website");
    upsertMetaTag("property", "og:title", publicRoute.title);
    upsertMetaTag("property", "og:description", publicRoute.description);
    upsertMetaTag("property", "og:url", canonical);
    upsertMetaTag("property", "og:image", DEFAULT_OG_IMAGE);

    upsertMetaTag("name", "twitter:card", "summary_large_image");
    upsertMetaTag("name", "twitter:title", publicRoute.title);
    upsertMetaTag("name", "twitter:description", publicRoute.description);
    upsertMetaTag("name", "twitter:url", canonical);
    upsertMetaTag("name", "twitter:image", DEFAULT_OG_IMAGE);

    clearDynamicStructuredData();
    const schemas = buildStructuredDataForRoute(publicRoute);
    schemas.forEach((schema, idx) => {
      const script = document.createElement("script");
      script.setAttribute("type", "application/ld+json");
      script.setAttribute("id", `threadsworks-ld-${idx}`);
      script.textContent = JSON.stringify(schema);
      document.head.appendChild(script);
    });
    return;
  }

  // Private or authenticated workspace route: mark noindex and remove marketing JSON-LD
  const workspaceMeta = tabMetadata[activeTab] || {
    title: "ThreadsWorks Workspace",
    description: "Sign in to your private ThreadsWorks creator workspace."
  };
  document.title = workspaceMeta.title;
  upsertMetaTag("name", "description", workspaceMeta.description);
  upsertMetaTag("name", "robots", "noindex, nofollow");
  const canonicalLink = document.querySelector('link[rel="canonical"]');
  if (canonicalLink) canonicalLink.remove();
  clearDynamicStructuredData();
}

function MainApp() {
  const { theme } = useTheme();

  // Fetch full brand Profile from Firestore for the active user (non-blocking; never invalidates auth)
  const fetchProfileRecord = useCallback(async (uid: string, fallbackEmail: string): Promise<UserProfile | null> => {
    try {
      const cached = safeGetLocalStorage(`profile_${uid}`) || safeGetLocalStorage("profile");
      const docRef = doc(db, "users", uid);
      let docSnap: any;
      try {
        docSnap = await withTimeout(getDoc(docRef), 3000, true);
      } catch (getErr) {
        console.warn("Firestore profile get note:", getErr);
      }

      if (docSnap && docSnap.exists && docSnap.exists()) {
        const data = docSnap.data() as UserProfile;
        if (data.customInstruction === undefined || data.customInstruction === null) {
          const localInst = safeGetLocalStorage(`threads_custom_instruction_${uid}`) ?? safeGetLocalStorage("threads_custom_instruction");
          if (localInst !== null) data.customInstruction = localInst;
        }
        if (data.rawVoice === undefined || data.rawVoice === null) {
          const localVoice = safeGetLocalStorage(`threads_raw_voice_${uid}`) ?? safeGetLocalStorage("threads_raw_voice");
          if (localVoice !== null) data.rawVoice = localVoice;
        }
        safeSetLocalStorage(`profile_${uid}`, JSON.stringify(data));
        return data;
      }

      if (!cached) {
        const localInst = safeGetLocalStorage(`threads_custom_instruction_${uid}`) || safeGetLocalStorage("threads_custom_instruction") || "";
        const localVoice = safeGetLocalStorage(`threads_raw_voice_${uid}`) || safeGetLocalStorage("threads_raw_voice") || "";
        const defaultProfile: UserProfile = {
          uid,
          email: fallbackEmail || auth.currentUser?.email || "",
          offer: "",
          audience: "",
          desiredResult: "",
          writingStyle: "",
          customInstruction: localInst,
          rawVoice: localVoice
        };
        safeSetLocalStorage(`profile_${uid}`, JSON.stringify(defaultProfile));
        try {
          await withTimeout(setDoc(docRef, defaultProfile), 3000, true);
        } catch (setErr) {
          console.warn("Firestore profile default set note:", setErr);
        }
        return defaultProfile;
      }
      return null;
    } catch (err: any) {
      console.warn("Firestore error loading user profile, preserving authenticated session with fallback:", err);
      const cached = safeGetLocalStorage(`profile_${uid}`);
      if (cached) {
        try {
          return JSON.parse(cached) as UserProfile;
        } catch (_) {}
      }
      return {
        uid,
        email: fallbackEmail || auth.currentUser?.email || "",
        offer: "",
        audience: "",
        desiredResult: "",
        writingStyle: "",
        customInstruction: safeGetLocalStorage(`threads_custom_instruction_${uid}`) || "",
        rawVoice: safeGetLocalStorage(`threads_raw_voice_${uid}`) || ""
      };
    }
  }, []);

  const authAdapter = useMemo(() => ({
    getCurrentUser: () => auth.currentUser,
    subscribeAuthState: (onNext: (u: any) => void, onError: (e: unknown) => void) =>
      onAuthStateChanged(auth, onNext, onError),
    waitForAuthStateReady: () =>
      typeof (auth as any).authStateReady === "function"
        ? auth.authStateReady()
        : Promise.resolve(),
    ensureProfile: ensureGoogleUserProfile,
    fetchProfile: fetchProfileRecord,
    attributeReferral: async (refCode: string) => {
      await attributeUserToReferral(refCode);
    },
  }), [fetchProfileRecord]);

  const {
    status: authStatus,
    user,
    authError,
    backendAuthError,
    lastTransitionReason,
    profile,
    setProfile,
    beginAuthenticating,
    failAuthenticating,
    notifyLoginSuccess,
    clearBackendAuthError,
    refreshProfile: handleRefreshProfile,
  } = useAuthSession(authAdapter);
  
  const [currentPath, setCurrentPath] = useState<string>(() =>
    normalizeMarketingPath(typeof window !== "undefined" ? window.location.pathname : "/")
  );
  const [authPortalMode, setAuthPortalMode] = useState<"signin" | "signup" | null>(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const requestedAuth = params.get("auth");
    if (requestedAuth === "signup" || requestedAuth === "signin") {
      return requestedAuth;
    }
    return null;
  });

  const [activeTab, setActiveTabState] = useState<string>(() => {
    const path = normalizeMarketingPath(window.location.pathname);
    return urlToTab[path] || "dashboard";
  });
  const [workspaceResetKey, setWorkspaceResetKey] = useState<number>(0);

  const setActiveTab = (tab: string) => {
    if (tab === "apps" || tab === "dashboard") {
      setWorkspaceResetKey((prev) => prev + 1);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("reset-workspace-root"));
      }
    }
    setActiveTabState(tab);
    const path = tabToUrl[tab] || "/dashboard";
    setCurrentPath(path);
    if (window.location.pathname !== path) {
      window.history.pushState(null, "", path);
    }
  };

  const handlePublicNavigate = useCallback((targetPath: string) => {
    const normalized = normalizeMarketingPath(targetPath);
    setAuthPortalMode(null);
    setCurrentPath(normalized);
    const mappedTab = urlToTab[normalized];
    if (mappedTab) {
      setActiveTabState(mappedTab);
    }
    if (typeof window !== "undefined") {
      if (window.location.pathname !== normalized) {
        window.history.pushState(null, "", normalized);
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  const [subscriptionStatus, setSubscriptionStatus] = useState<string>("free");
  const [handshakeStatus, setHandshakeStatus] = useState<string | null>(null);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const processedCodesRef = useRef(new Set<string>());

  // Synchronize document SEO metadata cleanly for public routes vs authenticated workspace
  useEffect(() => {
    const showingAuthenticatedWorkspace = Boolean(user) || authPortalMode !== null;
    applyDocumentSeo(currentPath, showingAuthenticatedWorkspace, activeTab);
  }, [currentPath, user, authPortalMode, activeTab]);

  // Handle browser popstate events (back/forward history buttons)
  useEffect(() => {
    const handlePopState = () => {
      const path = normalizeMarketingPath(window.location.pathname);
      logAuthDiagnostic("popstate_navigation", {
        windowPathname: window.location.pathname,
        normalizedPath: path,
      });
      setCurrentPath(path);
      setAuthPortalMode(null);
      const tab = urlToTab[path];
      if (tab) {
        setActiveTabState(tab);
      } else if (path === "/" || path === "") {
        setActiveTabState("dashboard");
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Capture incoming referral parameters (?ref= or ?via=) on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const refCode = params.get("ref") || params.get("via");
    const src = params.get("src") || params.get("utm_source") || "";
    if (refCode && refCode.trim() !== "") {
      const cleanRef = refCode.trim();
      safeSetLocalStorage("threadsworks_partner_ref", cleanRef);
      safeSetSessionStorage("threadsworks_partner_ref", cleanRef);
      trackReferralClick(cleanRef, src).catch((e) => {
        console.warn("[PARTNER_REFERRAL] Click track note:", e);
      });
    }
  }, []);

  // Bridge to save generated promotional copy directly into user's content library
  const handleSavePromoToLibrary = async (text: string, title?: string) => {
    if (!user) {
      alert("Please sign in to save promotional posts.");
      return;
    }
    try {
      const currentUid = user.uid;
      const cleanText = text.replace(/\\n/g, "\n").trim();
      const savedDocPayload = {
        userId: currentUid,
        title: title || "Threads Promotional Post",
        hook: cleanText.slice(0, 100),
        singlePost: cleanText,
        threadPosts: [cleanText],
        explanation: "Generated via ThreadsWorks Partner Hub AI Promoter",
        topic: profile?.offer || "Partner Promotion",
        format: "single",
        category: "promotional",
        createdAt: new Date().toISOString()
      };

      await withTimeout(
        addDoc(collection(db, "posts"), savedDocPayload),
        4000,
        true
      );

      // Persist to local offline storage cache so ContentLibraryView renders it immediately
      try {
        const cacheKey = `threads_saved_offline_library_${currentUid}`;
        const existingRaw = localStorage.getItem(cacheKey);
        const existingList = existingRaw ? JSON.parse(existingRaw) : [];
        const newLocalItem = {
          id: "local_" + Date.now(),
          ...savedDocPayload
        };
        localStorage.setItem(cacheKey, JSON.stringify([newLocalItem, ...existingList]));
      } catch (_) {}

    } catch (err: any) {
      console.error("[PARTNER_HUB] Save to library error:", err);
      handleFirestoreError(err, OperationType.CREATE, "posts");
    }
  };

  // Once authenticated on '/', transition cleanly to '/create' while preserving any intended protected destination
  useEffect(() => {
    if (authStatus !== "authenticated" || !user) return;
    setAuthPortalMode(null);
    if (currentPath === "/" || currentPath === "") {
      setCurrentPath("/create");
      setActiveTabState("engine");
      if (typeof window !== "undefined" && window.location.pathname !== "/create") {
        window.history.replaceState(null, "", "/create");
      }
    }
  }, [authStatus, user, currentPath]);

  // Recover an in-flight AI Studio Preview Google Sign-In handoff if the Preview wrapper
  // navigated/reloaded the iframe via applet-auth-bridge while the user was authenticating.
  // Uses a module-level singleton runner so React <StrictMode> mount/unmount/remount cycles
  // never double-claim or discard the single-use credential.
  useEffect(() => {
    if (user || !isEmbeddedAiStudioPreview()) return;
    return attachPreviewHandoffResume(auth, {
      onAuthenticating: () => {
        beginAuthenticating("google");
      },
      onSuccess: (confirmedUser) => {
        Promise.resolve()
          .then(() => ensureGoogleUserProfile(confirmedUser))
          .catch((e) => {
            console.warn("Non-blocking Google profile initialization note:", e);
          });
        notifyLoginSuccess(confirmedUser);
        setAuthPortalMode(null);
      },
      onError: (message) => {
        failAuthenticating(message);
      },
    });
  }, [user, beginAuthenticating, failAuthenticating, notifyLoginSuccess]);

  // Listen to subscription status in real-time
  useEffect(() => {
    if (!user) {
      setSubscriptionStatus("free");
      return;
    }

    const email = user.email || "";
    if (isEntitledAccount(email)) {
      setSubscriptionStatus("active");
      return;
    }

    const q = query(
      collection(db, "stripe_subscriptions"),
      where("userId", "==", user.uid),
      where("status", "==", "active"),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setSubscriptionStatus("active");
      } else {
        setSubscriptionStatus("free");
      }
    }, (error) => {
      console.warn("[SUBSCRIPTION_LISTENER] Failed to listen to subscription updates:", error);
    });

    return () => unsubscribe();
  }, [user]);

  // Hook to handle incoming Thread OAuth handshake, postMessage, or redirects on mount
  useEffect(() => {
    if (!user) return;

    const queryParams = new URLSearchParams(window.location.search);
    const code = queryParams.get("code") || queryParams.get("amp;code");
    const cachedPayloadStr = safeGetLocalStorage("threads_oauth_payload");
    const oauthStatus = queryParams.get("oauth_status");

    const handlePayloadSync = async (payload: any) => {
      if (!payload || !user) return;
      let returnDestination = payload.returnTo || "/analytics";
      const targetTab = urlToTab[returnDestination] || "analytics";

      const grantedScopes = payload.grantedScopes || ["threads_basic", "threads_content_publish"];
      const hasInsights = grantedScopes.includes("threads_manage_insights");
      const hasPublish = grantedScopes.length === 0 || grantedScopes.includes("threads_content_publish");

      // Write directly to Firestore collections to synchronize immediately
      await setDoc(doc(db, "connections", user.uid), {
        userId: user.uid,
        threadsUserId: String(payload.threadsUserId || ""),
        threadsUsername: payload.threadsUsername || "threads_user",
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
          grantedScopes,
          hasInsightsPermission: hasInsights,
          hasPublishPermission: hasPublish
        }
      });

      const activeToken = payload.accessToken || payload.threadsAccessToken;
      if (activeToken) {
        await setDoc(doc(db, "connections_secure", user.uid), {
          threadsAccessToken: activeToken
        });
        fetch("/api/threads/sync-credentials", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.uid,
            accessToken: activeToken,
            threadsUserId: String(payload.threadsUserId || ""),
            threadsUsername: payload.threadsUsername || ""
          })
        }).catch(() => {});
      }

      // Store namespaced connected flags for optimistic UI and zero-lag load
      safeSetLocalStorage(`threads_is_connected_${user.uid}`, "true");
      safeSetLocalStorage(`threads_connected_username_${user.uid}`, payload.threadsUsername || "threads_user");
      safeRemoveLocalStorage("is_connected");
      safeRemoveLocalStorage("threads_connected_username");
      safeRemoveLocalStorage("threads_oauth_payload");

      console.log(`Successfully synchronized Threads credentials. Navigating to ${returnDestination} (${targetTab}).`);
      setActiveTabState(targetTab);
      window.history.replaceState(null, "", returnDestination);
      window.dispatchEvent(new CustomEvent("threads-connection-updated"));
      handleRefreshProfile();
    };

    // Listen for popup window postMessage
    const handleOAuthMessage = (event: MessageEvent) => {
      if (event.data?.type === "THREADS_AUTH_SUCCESS" || event.data?.type === "OAUTH_AUTH_SUCCESS") {
        const payload = event.data.data || event.data.payload;
        if (payload) {
          handlePayloadSync(payload).catch((e) => console.error("[OAUTH_POSTMESSAGE_ERR]", e));
        }
      }
    };
    window.addEventListener("message", handleOAuthMessage);

    const processOAuthHandshake = async () => {
      // Scenario A: Check for legacy cached payload
      if (cachedPayloadStr) {
        try {
          setHandshakeStatus("Synchronizing with newly connected Threads profile credentials...");
          const payload = JSON.parse(cachedPayloadStr);
          await handlePayloadSync(payload);
        } catch (err) {
          console.error("Error processing cached OAuth payload:", err);
        } finally {
          safeRemoveLocalStorage("threads_oauth_payload");
          setHandshakeStatus(null);
          handleRefreshProfile();
        }
      }

      // Scenario B: Direct code param found in the address bar (whole-window redirect flow)
      if (code) {
        const cleanCode = String(code).trim();
        if (processedCodesRef.current.has(cleanCode)) {
          console.log("[OAUTH_HANDSHAKE] Skipping duplicate exchange request for authorization code:", cleanCode);
          return;
        }
        processedCodesRef.current.add(cleanCode);

        let isResolvedSuccessfully = false;
        let returnDestination = "/analytics";
        try {
          setHandshakeStatus("Surgically exchanging authorization code for long-lived access tokens...");
          
          const idToken = await user.getIdToken();
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (idToken) {
            headers["Authorization"] = `Bearer ${idToken}`;
          }

          const response = await fetch("/api/threads/exchange-code", {
            method: "POST",
            headers,
            body: JSON.stringify({ 
              code: cleanCode, 
              userId: user.uid,
              returnTo: window.location.pathname || "/analytics"
            })
          });

          if (response.ok) {
            const data = await response.json();
            returnDestination = data.returnTo || window.location.pathname || "/analytics";
            const targetTab = urlToTab[returnDestination] || "analytics";
            
            const grantedScopes = data.grantedScopes || ["threads_basic", "threads_content_publish"];
            const hasInsights = grantedScopes.includes("threads_manage_insights");
            const hasPublish = grantedScopes.length === 0 || grantedScopes.includes("threads_content_publish");

            // Save non-sensitive profile UI metadata in client Firestore (guarded so client Firestore rule notices do not block a verified backend exchange)
            try {
              await setDoc(doc(db, "connections", user.uid), {
                userId: user.uid,
                threadsUserId: String(data.threadsUserId || ""),
                threadsUsername: data.threadsUsername || "threads_user",
                threadsProfilePictureUrl: data.threadsProfilePictureUrl || "",
                threadsBiography: data.threadsBiography || "",
                connectionStatus: "connected",
                verificationStatus: "verified",
                lastConnectedAt: new Date().toISOString(),
                lastVerifiedAt: new Date().toISOString(),
                tokenMetadata: {
                  generatedAt: new Date().toISOString(),
                  expiresAt: new Date(Date.now() + (data.expiresIn || 5184000) * 1000).toISOString(),
                  sandbox: false,
                  grantedScopes,
                  hasInsightsPermission: hasInsights,
                  hasPublishPermission: hasPublish
                }
              });
            } catch (clientFsErr) {
              console.warn("[OAUTH_CLIENT_FS_SYNC_NOTE] Client Firestore sync note (server-side persistence already succeeded):", clientFsErr);
            }

            safeSetLocalStorage(`threads_is_connected_${user.uid}`, "true");
            safeSetLocalStorage(`threads_connected_username_${user.uid}`, data.threadsUsername || "threads_user");
            safeRemoveLocalStorage("is_connected");
            safeRemoveLocalStorage("threads_connected_username");

            // If running inside an OAuth popup window, communicate result to window.opener and close popup
            if (window.opener && window.opener !== window) {
              try {
                window.opener.postMessage({
                  type: "THREADS_AUTH_SUCCESS",
                  payload: {
                    connected: true,
                    threadsUserId: String(data.threadsUserId || ""),
                    threadsUsername: data.threadsUsername || "",
                    threadsProfilePictureUrl: data.threadsProfilePictureUrl || "",
                    threadsBiography: data.threadsBiography || "",
                    accessToken: data.accessToken,
                    grantedScopes,
                    hasInsightsPermission: hasInsights,
                    hasPublishPermission: hasPublish,
                    verificationStatus: "verified"
                  }
                }, "*");
                window.close();
                return;
              } catch (popupMsgErr) {
                console.warn("[OAUTH_POPUP_POSTMESSAGE_NOTE]", popupMsgErr);
              }
            }

            console.log(`Direct address bar hand-shake completed. Returning to ${returnDestination} (${targetTab}).`);
            isResolvedSuccessfully = true;

            setActiveTabState(targetTab);

            // Dispatch global event so active view components react immediately
            window.dispatchEvent(new CustomEvent("threads-connection-updated"));
          } else {
            const errJson = await response.json().catch(() => ({}));
            const errorText = errJson.error || errJson.message || `HTTP ${response.status}`;
            console.error("[OAUTH_HANDSHAKE_EXCHANGE_ERROR]", { status: response.status, details: errJson });
            throw new Error(`Token exchange failed (${response.status}): ${errorText}`);
          }
        } catch (err: any) {
          console.error("Direct code exchange caught exception:", err);
          alert(`Threads Connection Notice: ${err.message || String(err)}`);
        } finally {
          setHandshakeStatus(null);
          if (isResolvedSuccessfully) {
            window.history.replaceState(null, "", returnDestination);
          }
          handleRefreshProfile();
        }
      }

      // Scenario C: oauth_status query parameter from redirect completion
      if (oauthStatus === "connected") {
        try {
          invalidateThreadsConnectionCache(user.uid);
          const verified = await checkThreadsConnection(user.uid, true);
          if (verified.connected) {
            window.dispatchEvent(new CustomEvent("threads-connection-updated"));
          }
        } catch (statusErr) {
          console.warn("[OAUTH_STATUS_CHECK] Note:", statusErr);
        } finally {
          const cleanUrl = window.location.pathname;
          window.history.replaceState(null, "", cleanUrl);
        }
      }
    };

    processOAuthHandshake();

    return () => {
      window.removeEventListener("message", handleOAuthMessage);
    };
  }, [user]);

  // Listen for real-time profile update events across views
  useEffect(() => {
    const handleProfileUpdated = (event: any) => {
      if (event?.detail) {
        setProfile(event.detail);
      }
    };
    const handleCreatorContextUpdated = (event: any) => {
      const newContext = typeof event?.detail === "string" ? event.detail : "";
      if (typeof event?.detail === "string") {
        setProfile(prev => {
          if (!prev) {
            return {
              uid: user?.uid || "anonymous",
              email: user?.email || "",
              customInstruction: newContext,
              rawVoice: newContext,
              writingStyle: "Direct, practical, conversational"
            } as UserProfile;
          }
          return {
            ...prev,
            customInstruction: newContext,
            rawVoice: newContext
          };
        });
      }
    };
    window.addEventListener("profile-updated", handleProfileUpdated as EventListener);
    window.addEventListener("creator-context-updated", handleCreatorContextUpdated as EventListener);
    return () => {
      window.removeEventListener("profile-updated", handleProfileUpdated as EventListener);
      window.removeEventListener("creator-context-updated", handleCreatorContextUpdated as EventListener);
    };
  }, []);

  // Auth state, profile hydration, and sign-out lifecycle are managed by useAuthSession above.

  // Global Google Analytics Tag Loader
  useEffect(() => {
    // 1. Fetch Google Analytics ID strictly from environment variable
    const gaId = (import.meta as any).env?.VITE_GA_TRACKING_ID;
    if (!gaId || gaId.trim() === "" || gaId === "G-XXXXXXXXXX") return;

    let formattedId = gaId.trim();
    if (!formattedId.startsWith("G-") && !formattedId.startsWith("GTM-") && !formattedId.startsWith("UA-")) {
      formattedId = "G-" + formattedId;
    }

    // 2. Prevent duplicate script insertions
    if (document.querySelector(`script[src*="gtag/js?id=${formattedId}"]`)) return;

    try {
      // 3. Inject the Google Analytics tag script
      const script = document.createElement("script");
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${formattedId}`;
      script.onerror = () => {
        console.warn("Analytics script failed to load (possibly blocked by privacy settings).");
      };
      document.head.appendChild(script);

      // 4. Set up the datalayer and configure GA
      (window as any).dataLayer = (window as any).dataLayer || [];
      function gtag(...args: any[]) {
        (window as any).dataLayer.push(args);
      }
      (window as any).gtag = gtag;

      gtag("js", new Date());
      gtag("config", formattedId, {
        page_path: window.location.pathname,
      });

      console.log(`Google Analytics connection initialized.`);
    } catch (e) {
      console.warn("Failed to initialize Google Analytics:", e);
    }
  }, []);

  const publicMarketingRoute = getPublicMarketingRoute(currentPath);
  const activeScreen = resolveAppScreen({
    authStatus,
    user,
    handshakeStatus,
    isPublicMarketingRoute: Boolean(publicMarketingRoute),
    authPortalMode,
  });

  const prevScreenRef = useRef<AppScreen | null>(null);
  useEffect(() => {
    const prevScreen = prevScreenRef.current;
    if (prevScreen !== activeScreen) {
      logAuthDiagnostic("route_guard_decision", {
        fromScreen: prevScreen,
        toScreen: activeScreen,
        authStatus,
        path: currentPath,
        windowPathname: typeof window !== "undefined" ? window.location.pathname : currentPath,
        activeTab,
        authPortalMode,
        isPublicMarketingRoute: Boolean(publicMarketingRoute),
        hasUser: Boolean(user?.uid),
        uidHint: maskUidForDiagnostics(user?.uid),
        hasAuthError: Boolean(authError),
        reason: lastTransitionReason,
      });
      if (
        prevScreen === "workspace" &&
        activeScreen === "auth" &&
        lastTransitionReason !== "explicit_sign_out"
      ) {
        logAuthDiagnostic(
          "unexpected_login_navigation",
          {
            fromScreen: prevScreen,
            toScreen: activeScreen,
            authStatus,
            path: currentPath,
            windowPathname: typeof window !== "undefined" ? window.location.pathname : currentPath,
            authPortalMode,
            reason: lastTransitionReason,
          },
          { category: "protected_route_redirect_failure", level: "warn" }
        );
      }
      prevScreenRef.current = activeScreen;
    }
  }, [
    activeScreen,
    activeTab,
    authError,
    authPortalMode,
    authStatus,
    currentPath,
    lastTransitionReason,
    publicMarketingRoute,
    user?.uid,
  ]);

  // Handshake and OAuth Code Verification Loader Screen
  if (activeScreen === "handshake") {
    return (
      <div className={`flex min-h-screen flex-col items-center justify-center bg-bg-app text-text-primary p-6 text-center ${theme}`}>
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border-primary bg-bg-card text-brand-text animate-spin mb-6 shadow-xl">
          <Sparkles className="h-7 w-7 text-brand-text" />
        </div>
        <h3 className="text-base font-bold text-text-primary tracking-tight mb-2">Meta Threads Connection</h3>
        <p className="text-xs text-text-secondary max-w-xs leading-relaxed">{handshakeStatus}</p>
      </div>
    );
  }

  // Public marketing routes render immediately for unauthenticated visitors (matching static pre-rendered HTML)
  if (activeScreen === "marketing" && publicMarketingRoute) {
    return (
      <PublicMarketingPage
        route={publicMarketingRoute}
        onNavigate={handlePublicNavigate}
        onOpenAuth={(mode) => setAuthPortalMode(mode)}
      />
    );
  }

  // Loading Screen (for protected app routes while resolving auth)
  if (activeScreen === "loading") {
    return (
      <div className={`flex min-h-screen flex-col items-center justify-center bg-bg-app text-text-primary ${theme}`}>
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border-primary bg-bg-card text-brand-text animate-spin mb-4">
          <Sparkles className="h-6 w-6" />
        </div>
        <p className="text-sm font-medium tracking-tight text-text-secondary">Loading ThreadsWorks session...</p>
      </div>
    );
  }

  // Not authenticated? Show the existing Sign In / Sign Up portal
  if (activeScreen === "auth" || !user) {
    return (
      <Suspense fallback={
        <div className={`flex min-h-screen flex-col items-center justify-center bg-bg-app text-text-primary ${theme}`}>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border-primary bg-bg-card text-brand-text animate-spin mb-4">
            <Sparkles className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium tracking-tight text-text-secondary">Loading authentication portal...</p>
        </div>
      }>
        <AuthScreen
          initialMode={authPortalMode || "signin"}
          externalError={authError}
          authStatus={authStatus}
          onAuthStart={beginAuthenticating}
          onAuthError={failAuthenticating}
          onBackToMarketing={publicMarketingRoute ? () => setAuthPortalMode(null) : undefined}
          onSuccess={(authenticatedUser) => {
            notifyLoginSuccess(authenticatedUser);
            setAuthPortalMode(null);
          }}
        />
      </Suspense>
    );
  }

  // Render main core layout of ThreadsWorks
  return (
    <div className={`flex min-h-screen flex-col bg-bg-app text-text-primary transition-colors duration-300 ${theme}`}>
      
      {/* Top Command Header Bar */}
      <TopNav 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        userEmail={user.email} 
        subscriptionStatus={subscriptionStatus}
        profile={profile}
        onOpenPrivacy={() => setPrivacyOpen(true)}
        onOpenTerms={() => setTermsOpen(true)}
      />

      {/* Non-destructive authorization error banner (preserves Firebase session without redirecting to login) */}
      {backendAuthError && (
        <div
          id="backend-auth-error-banner"
          role="alert"
          className="mx-auto mt-3 w-full max-w-7xl px-4 md:px-8 lg:px-10"
        >
          <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
            <span>{backendAuthError}</span>
            <button
              type="button"
              onClick={clearBackendAuthError}
              className="shrink-0 font-semibold text-amber-300 hover:text-amber-100 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Primary Workspace Panel */}
      <main className="flex-1 overflow-y-auto px-4 pt-6 pb-[calc(2rem+env(safe-area-inset-bottom))] md:px-8 lg:px-10">
        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* Active render view conditional matching */}
          <Suspense fallback={
            <div className="flex flex-col items-center justify-center p-12 min-h-[400px]">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border-primary bg-bg-card text-brand-text animate-spin">
                <Sparkles className="h-5 w-5" />
              </div>
              <p className="text-xs text-text-muted mt-4 font-medium">Loading workspace...</p>
            </div>
          }>
            {(activeTab === "engine" || activeTab === "create") && (
              <div className="animate-fade-in">
                <ContentEngineView 
                  profile={profile} 
                  onNavigateToTab={setActiveTab} 
                  onRefreshProfile={handleRefreshProfile}
                  subscriptionStatus={subscriptionStatus}
                />
              </div>
            )}

            {(activeTab === "apps" || activeTab === "dashboard") && (
              <div className="animate-fade-in" key={`workspace-view-${workspaceResetKey}`}>
                <DashboardView 
                  key={`workspace-dashboard-${workspaceResetKey}`}
                  profile={profile} 
                  onRefreshProfile={handleRefreshProfile}
                  onNavigateToTab={setActiveTab}
                  subscriptionStatus={subscriptionStatus}
                />
              </div>
            )}

            {(activeTab === "profile" || activeTab === "identity" || activeTab === "business" || activeTab === "settings" || activeTab === "partner") && (
              <div className="animate-fade-in">
                <ProfileView 
                  profile={profile} 
                  onNavigateToTab={setActiveTab} 
                  onRefreshProfile={handleRefreshProfile}
                  subscriptionStatus={subscriptionStatus}
                  initialSubTab={
                    activeTab === "partner" 
                      ? "partner" 
                      : activeTab === "business" 
                      ? "business" 
                      : activeTab === "settings" 
                      ? "account" 
                      : "voice"
                  }
                  onOpenPrivacy={() => setPrivacyOpen(true)}
                  onOpenTerms={() => setTermsOpen(true)}
                  userEmail={user?.email || ""}
                  onSaveToLibrary={handleSavePromoToLibrary}
                />
              </div>
            )}

            {activeTab === "calendar" && (
              <div className="animate-fade-in">
                <CalendarView 
                  profile={profile} 
                  subscriptionStatus={subscriptionStatus}
                  onNavigateToTab={setActiveTab} 
                  initialSubView="calendar"
                />
              </div>
            )}

            {activeTab === "library" && (
              <div className="animate-fade-in">
                <CalendarView 
                  profile={profile} 
                  subscriptionStatus={subscriptionStatus}
                  onNavigateToTab={setActiveTab}
                  initialSubView="library"
                />
              </div>
            )}

            {activeTab === "analytics" && (
              <div className="animate-fade-in">
                <AnalyticsView
                  profile={profile}
                  subscriptionStatus={subscriptionStatus}
                />
              </div>
            )}

            {activeTab === "pricing" && (
              <div className="animate-fade-in">
                <PricingView 
                  subscriptionStatus={subscriptionStatus} 
                />
              </div>
            )}

            {activeTab === "influencer" && (
              <div className="animate-fade-in">
                <InfluencerIntelligenceView 
                  userId={user.uid}
                  userContext={profile}
                />
              </div>
            )}

            {activeTab === "preview" && (
              <div className="animate-fade-in">
                <PreviewEditionView
                  profile={profile}
                  subscriptionStatus={subscriptionStatus}
                  onNavigateToTab={setActiveTab}
                />
              </div>
            )}
          </Suspense>

        </div>
      </main>
      <MobileBottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
      <PrivacyPolicyModal isOpen={privacyOpen} onClose={() => setPrivacyOpen(false)} />
      <TermsOfServiceModal isOpen={termsOpen} onClose={() => setTermsOpen(false)} />
    </div>
  );
}

export default function App() {
  const bridgeHandoffId = getPreviewGoogleBridgeHandoffId();
  if (bridgeHandoffId) {
    return <PreviewGoogleBridgeView handoffId={bridgeHandoffId} />;
  }

  return (
    <ThemeProvider>
      <ThreadsConnectionProvider>
        <ContentPersistenceProvider>
          <AppContent />
        </ContentPersistenceProvider>
      </ThreadsConnectionProvider>
    </ThemeProvider>
  );
}

function AppContent() {
  const [legalPath, setLegalPath] = useState<string>(() =>
    normalizeMarketingPath(typeof window !== "undefined" ? window.location.pathname : "/")
  );

  useEffect(() => {
    const syncPath = () => setLegalPath(normalizeMarketingPath(window.location.pathname));
    window.addEventListener("popstate", syncPath);
    return () => window.removeEventListener("popstate", syncPath);
  }, []);

  if (legalPath === "/privacy" || legalPath === "/terms") {
    const legalRoute = getPublicMarketingRoute(legalPath);
    if (legalRoute) {
      applyDocumentSeo(legalPath, false, "engine");
      return (
        <PublicMarketingPage
          route={legalRoute}
          onNavigate={(targetPath) => {
            const normalized = normalizeMarketingPath(targetPath);
            if (window.location.pathname !== normalized) {
              window.history.pushState(null, "", normalized);
            }
            setLegalPath(normalized);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          onOpenAuth={(mode) => {
            const target = mode === "signup" ? "/create?auth=signup" : "/create";
            window.history.pushState(null, "", target);
            setLegalPath("/create");
          }}
        />
      );
    }
  }

  return <MainApp />;
}
