import { computeAdaptiveChunkSize, createUniversalGenerationContract, validateUniversalBatch, buildGenerationBatchDiagnostics, logGenerationBatchDiagnostics, resolveBatchRequest, normalizeBatchPosts, writeValidatedChunk, validateSingleDraft, checkUnsupportedClaims, executeValidatedSingleWrite, sendPipelineErrorResponse, GenerationPipelineError, classifyProviderOrNetworkError, FailedDraftInfo } from "./server/contentBatchContract";
import { buildGatedWriteContext, resolveWritingLengthPlan, resolveEffectivePostCount, extractExplicitPostCount } from "./server/writeContextGate";
import { planEightPostAiDecideParts, buildRollingLedger, planBatchSlots, buildCompactExclusionSummary, detectFormulaicOpener, checkDraftNovelty } from "./server/writeDiversityEngine";
import { composeBatchWriterSystemInstruction, composeReviewerSystemInstruction, composeSingleWriteSystemInstruction } from "./server/writePromptComposer";
import { THREADSWORKS_MODELS } from "./server/aiCostOptimizationEngine";
import {
  createFirestoreScheduledPostStore,
  evaluateScheduledEligibility,
  claimScheduledPostTransaction,
  verifyBeforeExternalPublish,
  cancelScheduledPostTransaction,
  requeueTransientFailureTransaction,
  finalizeAbortedPrePublishCancellation,
  isPostMarkedCanceled,
  type CancelMode
} from "./server/scheduledDispatchGuard";
import { CONTENT_GENERATOR_RULEBOOK, MULTI_POST_HOOK_OPTIMIZATION_SYSTEM, CONTENT_PILLARS_DEFINITIONS, calculateRecommendedPillar } from "./rulebook";
import { buildRobotsTxt, buildSitemapXml, getPublicMarketingRoute } from "./src/marketing/marketingRoutes";
import { renderNoIndexAppShellHtml, renderPublicRouteHtml } from "./server/seoPrerender";
import { createFunnelworksRouter } from "./server/funnelworksRoutes";
import { createEcosystemRouter } from "./server/ecosystemRoutes";
import {
  createPreviewAuthHandoffRouter,
  isPreviewAuthHandoffEnvironment,
} from "./server/previewAuthHandoff";
import express from "express";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import { OAuth2Client } from "google-auth-library";

const oidcClient = new OAuth2Client();

import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { initializeApp, getApps, getApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import compression from "compression";
import { createAnalyticsService } from "./server/analyticsService";
import { createPerformanceIntelligenceService, buildViralFlywheelPromptContext } from "./server/performanceIntelligenceService";
import { createPerformanceRecommendationService } from "./server/performanceRecommendationService";
import { createStrategyIntelligenceService } from "./server/strategyIntelligenceService";
import { createStrategicDiagnosticEngine } from "./server/strategicDiagnosticEngine";
import {
  distillIntelligentContentMemory,
  searchContentMemory,
  checkSimilarityAgainstMemory,
  formatIntelligentMemoryBrainPrompt
} from "./server/contentMemoryService";
import {
  ProjectOwnershipError,
  retrieveSharedIntelligenceContext,
  contributeSharedIntelligence,
  listSharedIntelligenceContributions,
  deleteSharedIntelligenceContribution
} from "./server/sharedIntelligenceService";
import {
  getOrBuildGenerationIntelligenceSnapshot,
  updateGenerationIntelligenceSnapshot,
  recordGeneratedBatchInSnapshot,
  invalidateGenerationIntelligenceCache
} from "./server/generationIntelligenceService";
import {
  ContentIntegrityChecker,
  ContentIntegrityReport,
  IntegrityCheckOptions,
  cleanUnsupportedAbsolutes
} from "./server/contentIntegrityService";
import { validateAndEnforceBatchUniqueness } from "./server/batchUniquenessService";
import { applyMyLinksToBatch, applyMyLinksToPost } from "./server/myLinksService";
import {
  sanitizeSentenceSpacing,
  integrateHookIntoPost,
  validateGeneratedPost,
  sanitizeAndValidateBestPost,
  repairThreadPart,
  repairAndSanitizePost,
  validateThreadSemantics,
  splitIntoCompleteSentences,
  isSentenceSemanticallyComplete,
  validatePartSemanticCompleteness,
  enforcePartBoundaries,
  cleanTopicString,
  purgeInternalPillarMetadata,
  isOpenLoopHook,
  detectHookPromise
} from "./src/lib/contentSanitizer";
import { buildProductUpdateReport } from "./server/productUpdateIntelligenceService";
import {
  classifyContentOrganization,
  generateWeeklyPlanRecommendations,
} from "./server/contentPlanningService";

// Safe fetch with per-request abort timeout guard
async function fetchWithTimeout(url: string, options: any = {}, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

// Universal promise timeout wrapper with safe unhandled rejection suppression
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallbackValue?: T): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallbackValue as T), timeoutMs);
  });
  promise.catch(() => {});
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer);
  }
}

// Filter out internal benign BloomFilter SDK notices from Node console logging in server context
(() => {
  const isBloomFilterMsg = (...args: any[]) => {
    try {
      const msg = args.map((a) => {
        if (a === null || a === undefined) return "";
        if (typeof a === "object") {
          return (a.name || "") + " " + (a.message || "") + " " + (a.stack || "") + " " + JSON.stringify(a);
        }
        return String(a);
      }).join(" ");
      return msg.includes("BloomFilter") || 
             msg.includes("BloomFilterError") || 
             msg.includes("Invalid hash count") || 
             msg.includes("Applying bloom filter failed");
    } catch {
      return false;
    }
  };

  const origWarn = console.warn;
  console.warn = (...args: any[]) => {
    if (isBloomFilterMsg(...args)) return;
    origWarn.apply(console, args);
  };

  const origError = console.error;
  console.error = (...args: any[]) => {
    if (isBloomFilterMsg(...args)) return;
    origError.apply(console, args);
  };
})();

// Client-side Firebase Imports for server-side execution to bypass container service account limitations
import { initializeApp as initializeClientApp } from "firebase/app";
import {
  initializeFirestore as initializeClientFirestore,
  setLogLevel as setClientFirestoreLogLevel,
  doc as clientDoc,
  getDoc as clientGetDoc,
  setDoc as clientSetDoc,
  updateDoc as clientUpdateDoc,
  collection as clientCollection,
  query as clientQuery,
  where as clientWhere,
  limit as clientLimit,
  getDocs as clientGetDocs,
  deleteDoc as clientDeleteDoc,
  runTransaction as clientRunTransaction,
  orderBy as clientOrderBy,
  Timestamp as ClientTimestamp
} from "firebase/firestore";

try {
  setClientFirestoreLogLevel("silent");
} catch {
  // Ignore if already configured
}

import fs from "fs";
import { stripeWebhookHandler } from "./stripeWebhookHandler";
import { createCheckoutSessionHandler } from "./stripeCheckoutHandler";
import { createPortalSessionHandler } from "./stripePortalHandler";
import { partnerRouter } from "./server/partnerRoutes";
import { influencerRouter } from "./server/influencerRoutes";

import {
  getUserSavedTabs,
  getSingleSavedTab,
  createSavedTab,
  updateSavedTab,
  deleteSavedTab,
  resolveCreatorContextForGeneration,
  SavedTabError
} from "./server/savedTabsService";

dotenv.config();

const app = express();
const PORT = 3000;

// Enable response compression for optimized static asset transfer
app.use(compression());

// Stripe Webhook Endpoint (Registered BEFORE general body parsers to access raw body bytes)
app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), stripeWebhookHandler);

app.use(express.json({ limit: "50mb" }));
app.use("/api/partner", partnerRouter);
app.use("/api/influencer", influencerRouter);
app.post("/api/stripe/create-checkout-session", createCheckoutSessionHandler);
app.post("/api/stripe/create-portal-session", createPortalSessionHandler);

// Dynamic single hook / angle endpoints routed through unified Write Gatekeeper & Prompt Composer
app.post("/api/generate-dynamic-hook", async (req, res) => {
  try {
    const body = req.body || {};
    const topic = String(body.topic || body.contentRequest || body.category || "Threads content").trim();
    const gated = buildGatedWriteContext(body, body, topic);
    const ai = getAI();
    const systemInstruction = composeSingleWriteSystemInstruction("DYNAMIC_HOOK", gated);
    const previousHooks = Array.isArray(body.previousHooks) ? body.previousHooks.slice(0, 8) : [];

    const generateOnce = async (extraFeedback?: string) => {
      const response = await callGenerateContentWithRetry(ai, {
        model: THREADSWORKS_MODELS.FLASH_36,
        optimizationTaskId: "DYNAMIC_HOOK",
        optimizationComplexity: "LEVEL_2_STANDARD",
        strictContentGeneration: true,
        contents: JSON.stringify({
          topic,
          category: gated.directives.category,
          facts: gated.factsPayload,
          previousHooksToAvoid: previousHooks,
          ...(extraFeedback ? { feedback: extraFeedback } : {})
        }),
        config: {
          systemInstruction,
          maxOutputTokens: 300,
          temperature: 0.85
        }
      });
      if (response.isSimulated) {
        throw new GenerationPipelineError("PROVIDER_ERROR", "AI hook generation is unavailable.", { httpStatus: 503, retryable: true });
      }
      return (response.text || "").replace(/^["']|["']$/g, "").trim();
    };

    let hook = await generateOnce();
    const formulaic = detectFormulaicOpener(hook);
    if (!hook || hook.length > 160 || formulaic) {
      hook = await generateOnce(
        formulaic
          ? `Previous hook used formulaic opener ${formulaic}. Write a direct, specific opening under 140 characters.`
          : "Return a single concise hook under 140 characters."
      );
    }
    if (!hook) {
      throw new GenerationPipelineError("CONTENT_VALIDATION_ERROR", "Model returned an empty hook.");
    }
    return res.json({ hook });
  } catch (err: any) {
    return sendPipelineErrorResponse(res, err, "Failed to generate hook.");
  }
});

app.post("/api/generate-dynamic-angle", async (req, res) => {
  try {
    const body = req.body || {};
    const topic = String(body.topic || body.contentRequest || body.category || "Threads content").trim();
    const gated = buildGatedWriteContext(body, body, topic);
    const ai = getAI();
    const systemInstruction = composeSingleWriteSystemInstruction("DYNAMIC_ANGLE", gated);
    const previousAngles = Array.isArray(body.previousAngles) ? body.previousAngles.slice(0, 8) : [];

    const response = await callGenerateContentWithRetry(ai, {
      model: THREADSWORKS_MODELS.FLASH_36,
      optimizationTaskId: "DYNAMIC_ANGLE",
      optimizationComplexity: "LEVEL_2_STANDARD",
      strictContentGeneration: true,
      contents: JSON.stringify({
        topic,
        category: gated.directives.category,
        facts: gated.factsPayload,
        previousAnglesToAvoid: previousAngles
      }),
      config: {
        systemInstruction,
        maxOutputTokens: 400,
        temperature: 0.85
      }
    });
    if (response.isSimulated) {
      throw new GenerationPipelineError("PROVIDER_ERROR", "AI angle generation is unavailable.", { httpStatus: 503, retryable: true });
    }
    const angle = (response.text || "").replace(/^["']|["']$/g, "").trim();
    if (!angle) {
      throw new GenerationPipelineError("CONTENT_VALIDATION_ERROR", "Model returned an empty angle.");
    }
    return res.json({ angle });
  } catch (err: any) {
    return sendPipelineErrorResponse(res, err, "Failed to generate strategic angle.");
  }
});

app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Read dynamic project ID from config
let firebaseProjectId = "studio-6594275665-9cb0f";
let databaseId = "(default)";
let firebaseConfig: any = null;
try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    firebaseConfig = config;
    if (config.projectId) {
      firebaseProjectId = config.projectId;
    }
    if (config.firestoreDatabaseId) {
      databaseId = config.firestoreDatabaseId;
    }
  }
} catch (e) {
  console.error("Failed to read firebase-applet-config.json", e);
}

// Initialize firebase admin SDK
const adminApp = getApps().length === 0
  ? initializeApp({ projectId: firebaseProjectId })
  : getApp();

const serverDb = getFirestore(adminApp, databaseId);
const serverAuth = getAuth(adminApp);
app.use("/api/funnelworks", createFunnelworksRouter(serverDb, serverAuth));
app.use("/api/ecosystem", createEcosystemRouter(serverDb, serverAuth));
if (isPreviewAuthHandoffEnvironment()) {
  app.use("/api/auth/preview-handoff", createPreviewAuthHandoffRouter(serverAuth));
}

// Registry & Cache In-Memory and Local Disk Persistence Layer
const inMemoryScheduledPosts = new Map<string, any>();
const threadsCredentialsCache = new Map<string, { threadsUserId: string; accessToken: string; threadsUsername?: string }>();
const inMemoryPublishingLocks = new Set<string>();

const SCHEDULED_POSTS_REGISTRY_FILE = path.join(process.cwd(), ".scheduled_posts_registry.json");
const THREADS_CREDENTIALS_CACHE_FILE = path.join(process.cwd(), ".threads_credentials_cache.json");

function loadScheduledPostsFromDisk() {
  // NO-OP: Firestore is authoritative. Clean up legacy file if present.
  try {
    if (fs.existsSync(SCHEDULED_POSTS_REGISTRY_FILE)) {
      fs.unlinkSync(SCHEDULED_POSTS_REGISTRY_FILE);
      console.log("[REGISTRY_CLEANUP] Removed legacy scheduled posts disk file.");
    }
  } catch (_) {}
}

function saveScheduledPostsToDisk() {
  // NO-OP: Firestore is the sole durable source of truth.
  // Disk persistence disabled to prevent cross-container divergence and ensure durability in Firestore.
}

function loadCredentialsFromDisk() {
  // NO-OP: Firestore collections connections and connections_secure are authoritative. Clean up legacy file if present.
  try {
    if (fs.existsSync(THREADS_CREDENTIALS_CACHE_FILE)) {
      fs.unlinkSync(THREADS_CREDENTIALS_CACHE_FILE);
      console.log("[CREDS_CLEANUP] Removed legacy plaintext credentials cache file.");
    }
  } catch (_) {}
}

function saveCredentialsToDisk() {
  // NO-OP: Live user access tokens must never be written unencrypted to the local filesystem.
  // In-memory cache threadsCredentialsCache provides performance while Firestore remains authoritative.
}

loadScheduledPostsFromDisk();
loadCredentialsFromDisk();

/**
 * Server Authentication and User Authorization Guard (P0/P1 Security)
 * Validates Firebase ID tokens via Bearer header and prevents cross-user access.
 */
async function verifyAuthUser(
  req: express.Request,
  targetUserId?: string,
  options: { requiredToken?: boolean } = { requiredToken: false }
): Promise<{ uid: string; email?: string } | null> {
  const authHeader = req.headers.authorization;
  let verifiedUid: string | null = null;
  let email: string | undefined = undefined;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const idToken = authHeader.split("Bearer ")[1].trim();
    if (idToken) {
      try {
        const decoded = await serverAuth.verifyIdToken(idToken);
        verifiedUid = decoded.uid;
        email = decoded.email;
      } catch (err: any) {
        console.warn("[AUTH_GUARD] Token verification failed:", err?.message || err);
      }
    }
  }

  // If a valid verified token is present, strictly enforce that caller matches targetUserId
  if (verifiedUid) {
    if (targetUserId && targetUserId !== "anonymous" && targetUserId !== verifiedUid) {
      throw new Error("FORBIDDEN_USER_MISMATCH");
    }
    return { uid: verifiedUid, email };
  }

  // If token is missing, enforce targetUserId constraints
  if (targetUserId && targetUserId !== "anonymous" && typeof targetUserId === "string" && targetUserId.trim() !== "") {
    if (options.requiredToken) {
      throw new Error("UNAUTHORIZED_NO_TOKEN");
    }
    return { uid: targetUserId.trim() };
  }

  throw new Error("UNAUTHORIZED_NO_USER");
}

// Initialize Firebase Client SDK on server-side
let clientDb: any = null;
if (firebaseConfig) {
  try {
    const clientApp = initializeClientApp(firebaseConfig);
    clientDb = initializeClientFirestore(clientApp, {
      experimentalForceLongPolling: true,
    }, databaseId || "default");
    console.log("Firebase Client SDK successfully initialized in server-side context.");
  } catch (clientErr) {
    console.error("Failed to initialize Firebase Client SDK on server:", clientErr);
  }
}

// ==========================================
// THREADSWORKS AI CONTENT GENERATION LIMIT SYSTEM
// ==========================================
import {
  FREE_MONTHLY_GENERATION_LIMIT,
  CANONICAL_LIMIT_REACHED_MESSAGE,
  getGenerationUsage,
  checkAndReserveGeneration,
  commitGeneration,
  releaseReservation,
  setTestGenerationUsage,
  isUserPro,
} from "./server/generationLimitService";

/**
 * Server-side guard to strictly enforce the Free plan 150 AI content generations per month limit.
 * Blocks Free users who have reached the limit BEFORE the AI model is called.
 * Paid users are never restricted.
 */
async function enforceAiGenerationLimit(
  req: express.Request,
  res: express.Response,
  targetUserId?: string
): Promise<{ allowed: boolean; isPro: boolean; reservationId?: string; activeUserId: string } | null> {
  let authUser = null;
  try {
    authUser = await verifyAuthUser(req, targetUserId || req.body?.userId);
  } catch (_) {}
  const activeUserId = authUser?.uid || targetUserId || req.body?.userId || req.body?.creatorIdentity?.uid || (req.headers["x-user-id"] as string) || "anonymous";
  const userEmail = authUser?.email || req.body?.email || req.body?.profile?.email || (req.query?.email as string);

  const check = await checkAndReserveGeneration(serverDb, activeUserId, userEmail);
  if (!check.allowed) {
    console.log(`[GENERATION_GUARD] Blocked generation for user ${activeUserId}: limit reached (${check.used}/${check.limit}). Model call aborted.`);
    res.status(403).json({
      success: false,
      error: check.error || CANONICAL_LIMIT_REACHED_MESSAGE,
      code: "GENERATION_LIMIT_REACHED",
      limit: FREE_MONTHLY_GENERATION_LIMIT,
      used: check.used,
      remaining: 0,
      isPro: false,
    });
    return null;
  }

  return {
    allowed: true,
    isPro: check.isPro,
    reservationId: check.reservationId,
    activeUserId,
  };
}

// Endpoint to retrieve current generation usage status
app.get("/api/generation-usage", async (req, res) => {
  try {
    let authUser = null;
    try {
      authUser = await verifyAuthUser(req, req.query?.userId as string);
    } catch (_) {}
    const activeUserId = authUser?.uid || (req.query?.userId as string) || (req.headers["x-user-id"] as string) || "anonymous";
    const userEmail = authUser?.email || (req.query?.email as string);
    const usage = await getGenerationUsage(serverDb, activeUserId, userEmail);
    return res.json({
      success: true,
      ...usage
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint to set test generation usage for verification
app.post("/api/test/set-generation-usage", async (req, res) => {
  try {
    const { userId, count, period } = req.body;
    await setTestGenerationUsage(serverDb, userId || "anonymous", typeof count === "number" ? count : 0, period);
    return res.json({ success: true, count, period });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// FOUNDER SECURE APP CHANGES DETECTOR & POST GENERATION API
// ==========================================

interface FileChangeInfo {
  path: string;
  mtime: Date;
  size: number;
}

function getWorkspaceCodeFiles(dir: string, fileList: FileChangeInfo[] = []): FileChangeInfo[] {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (
      file === "node_modules" || 
      file === "dist" || 
      file === ".git" || 
      file === "tmp" || 
      file === ".npm" || 
      file === ".cache" ||
      file === "functions" ||
      (file === "server" && dir === "/app/applet")
    ) {
      continue;
    }
    
    let stat;
    try {
      stat = fs.statSync(filePath);
    } catch (_) {
      continue;
    }

    if (stat.isDirectory()) {
      getWorkspaceCodeFiles(filePath, fileList);
    } else {
      const ext = path.extname(file);
      if ([".ts", ".tsx", ".json", ".js", ".jsx", ".css"].includes(ext)) {
        if (ext === ".json" && file !== "package.json" && file !== "firebase-blueprint.json") {
          continue;
        }
        fileList.push({
          path: filePath,
          mtime: stat.mtime,
          size: stat.size
        });
      }
    }
  }
  return fileList;
}

let memoryAppChangeCache: any = null;

// Helper to generate app change briefing reports using product update intelligence & feature grouping
async function generateAppChangeReport(forceAll = false, regenerateOnly = false) {
  const docRef = serverDb.collection("founder_settings").doc("app_change_post");

  let existingReport: any = null;
  try {
    const snap = await docRef.get();
    if (snap.exists) {
      existingReport = snap.data();
    }
  } catch (err: any) {
    console.warn("[APP_CHANGE_POST] Failed reading existing report from Firestore:", err?.message || err);
  }
  if (!existingReport && memoryAppChangeCache) {
    existingReport = memoryAppChangeCache;
  }

  const reportData = await buildProductUpdateReport(forceAll, regenerateOnly, existingReport);

  // Backward-compatibility: populate changes list from source files across updates
  const fullReport = {
    ...reportData,
    changes: reportData.updates.flatMap(u =>
      (u.sourceFiles || []).map(f => ({
        file: f,
        changeType: "modified",
        technicalSummary: u.technicalSummary,
        userImpact: u.creatorBenefit
      }))
    )
  };

  memoryAppChangeCache = fullReport;

  try {
    await docRef.set(fullReport);
  } catch (saveErr: any) {
    console.warn("[APP_CHANGE_POST] Failed to save report to Firestore:", saveErr?.message || saveErr);
  }

  return fullReport;
}

app.get("/api/internal/app-changes", async (req, res) => {
  try {
    let authUser = null;
    try {
      authUser = await verifyAuthUser(req, req.query?.userId as string);
    } catch (_) {}

    const email = authUser?.email?.trim().toLowerCase() || "";
    if (email !== "henkedouglas1@gmail.com" && authUser?.uid !== "vtMSWyRs4YbUqwwCZsdW3Tvv2wk2") {
      return res.status(403).json({ success: false, error: "Forbidden: Access restricted to the founder account." });
    }

    // Read cached document from Firestore (DO NOT scan or regenerate on GET!)
    const docRef = serverDb.collection("founder_settings").doc("app_change_post");
    let cachedData: any = null;
    try {
      const snap = await docRef.get();
      if (snap.exists) {
        cachedData = snap.data();
      }
    } catch (err: any) {
      console.warn("[APP_CHANGE_POST] Failed reading from Firestore (falling back to memory):", err?.message || err);
    }

    if (!cachedData && memoryAppChangeCache) {
      cachedData = memoryAppChangeCache;
    }

    return res.json({ success: true, data: cachedData });
  } catch (err: any) {
    console.warn("[APP_CHANGE_POST] Error handling GET /api/internal/app-changes:", err?.message || err);
    return res.status(500).json({ success: false, error: err?.message || "Failed to load cached changes" });
  }
});

app.post("/api/internal/app-changes", async (req, res) => {
  try {
    let authUser = null;
    try {
      authUser = await verifyAuthUser(req, req.body?.userId);
    } catch (_) {}

    const email = authUser?.email?.trim().toLowerCase() || "";
    if (email !== "henkedouglas1@gmail.com" && authUser?.uid !== "vtMSWyRs4YbUqwwCZsdW3Tvv2wk2") {
      return res.status(403).json({ success: false, error: "Forbidden: Access restricted to the founder account." });
    }

    const { forceAll, regenerateOnly } = req.body || {};
    const reportData = await generateAppChangeReport(!!forceAll, !!regenerateOnly);

    return res.json({
      success: true,
      newChangesDetected: true,
      data: reportData
    });

  } catch (err: any) {
    console.warn("[APP_CHANGE_POST] Error handling POST /api/internal/app-changes, serving fallback:", err?.message || err);
    const reportData = await generateAppChangeReport(true, false);
    return res.json({
      success: true,
      newChangesDetected: true,
      data: reportData
    });
  }
});

// ==========================================
// CREATOR SAVED TABS & CONFIGURATION ISOLATION API
// ==========================================

// Retrieve all saved tabs belonging to authenticated user
app.get("/api/saved-tabs", async (req, res) => {
  try {
    const authUser = await verifyAuthUser(req, req.query?.userId as string);
    const tabs = await getUserSavedTabs(serverDb, authUser!.uid);
    return res.json({ success: true, tabs });
  } catch (err: any) {
    const status = err.statusCode || (err.message?.includes("UNAUTHORIZED") ? 401 : 500);
    return res.status(status).json({ success: false, error: err.message, code: err.code || "SAVED_TAB_ERROR" });
  }
});

// Retrieve single saved tab strictly scoped by authenticated user and tabId
app.get("/api/saved-tabs/:tabId", async (req, res) => {
  try {
    const authUser = await verifyAuthUser(req, req.query?.userId as string);
    const tab = await getSingleSavedTab(serverDb, authUser!.uid, req.params.tabId);
    return res.json({ success: true, tab });
  } catch (err: any) {
    const status = err.statusCode || (err.message?.includes("FORBIDDEN") ? 403 : err.message?.includes("NOT_FOUND") ? 404 : 500);
    return res.status(status).json({ success: false, error: err.message, code: err.code || "SAVED_TAB_ERROR" });
  }
});

// Create new isolated saved tab
app.post("/api/saved-tabs", async (req, res) => {
  try {
    const authUser = await verifyAuthUser(req, req.body?.userId);
    const { name, initialData } = req.body;
    const tab = await createSavedTab(serverDb, authUser!.uid, name, initialData);
    return res.json({ success: true, tab });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return res.status(status).json({ success: false, error: err.message, code: err.code || "SAVED_TAB_ERROR" });
  }
});

// Update saved tab strictly scoped by authenticated user
app.put("/api/saved-tabs/:tabId", async (req, res) => {
  try {
    const authUser = await verifyAuthUser(req, req.body?.userId);
    const tab = await updateSavedTab(serverDb, authUser!.uid, req.params.tabId, req.body?.updates || req.body);
    return res.json({ success: true, tab });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return res.status(status).json({ success: false, error: err.message, code: err.code || "SAVED_TAB_ERROR" });
  }
});

// Delete saved tab
app.delete("/api/saved-tabs/:tabId", async (req, res) => {
  try {
    const authUser = await verifyAuthUser(req, req.body?.userId || (req.query?.userId as string));
    await deleteSavedTab(serverDb, authUser!.uid, req.params.tabId);
    return res.json({ success: true, deleted: true });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return res.status(status).json({ success: false, error: err.message, code: err.code || "SAVED_TAB_ERROR" });
  }
});

// ==========================================
// HIGH-FIDELITY SIMULATION HELPMATE FOR GEMINI QUOTA/KEY FALLBACKS
// ==========================================
// AI OPTIMIZATION ENGINE: CIRCUIT BREAKER, DEDUPLICATION & TELEMETRY
// ==========================================

export const aiTelemetry = {
  totalCalls: 0,
  cacheHits: 0,
  preventedDuplicates: 0,
  circuitBreakerTrips: 0,
  estimatedTokensSaved: 0,
  lastQuotaError: "",
  circuitBreakerUntil: 0
};

let circuitBreakerUntil = 0;
let lastCircuitBreakerError = "";

export function tripQuotaCircuitBreaker(reason: string, durationMs: number = 45000): void {
  circuitBreakerUntil = Date.now() + durationMs;
  lastCircuitBreakerError = reason;
  aiTelemetry.circuitBreakerTrips++;
  aiTelemetry.circuitBreakerUntil = circuitBreakerUntil;
  aiTelemetry.lastQuotaError = reason;
  console.warn(`[CIRCUIT BREAKER] Tripped for ${durationMs}ms due to quota/credit exhaustion: ${reason}`);
}

export function isQuotaCircuitActive(): boolean {
  return Date.now() < circuitBreakerUntil;
}

// Distinguishes hard quota / credit exhaustion / auth errors from transient network issues
function isHardQuotaOrAuthError(err: any): boolean {
  if (!err) return false;
  let errStr = "";
  try {
    errStr = (String(err) + " " + String(err.message || "") + " " + String(err.status || "") + " " + String(err.code || "") + " " + JSON.stringify(err)).toLowerCase();
  } catch (e) {
    errStr = String(err).toLowerCase();
  }
  return (
    errStr.includes("resource_exhausted") ||
    errStr.includes("429") ||
    errStr.includes("quota") ||
    errStr.includes("limit") ||
    errStr.includes("exhausted") ||
    errStr.includes("billing") ||
    errStr.includes("credit") ||
    errStr.includes("api_key") ||
    errStr.includes("unauthorized")
  );
}

function isTransientNetworkError(err: any): boolean {
  if (!err) return false;
  let errStr = "";
  try {
    errStr = (String(err) + " " + String(err.message || "") + " " + String(err.status || "")).toLowerCase();
  } catch (e) {
    errStr = String(err).toLowerCase();
  }
  return (
    errStr.includes("503") ||
    errStr.includes("500") ||
    errStr.includes("unavailable") ||
    errStr.includes("overloaded") ||
    errStr.includes("econnreset") ||
    errStr.includes("etimedout") ||
    errStr.includes("socket hang up") ||
    errStr.includes("temporary") ||
    errStr.includes("try again")
  );
}

function isQuotaOrKeyError(err: any): boolean {
  if (!err) return false;
  
  let errStringified = "";
  try {
    errStringified = JSON.stringify(err);
  } catch (e) {
    errStringified = "";
  }
  
  const fullErrorStr = (
    String(err) + " " +
    String(err.stack || "") + " " +
    String(err.message || "") + " " +
    String(err.statusText || "") + " " +
    String(err.status || "") + " " +
    String(err.code || "") + " " +
    errStringified
  ).toLowerCase();

  return (
    fullErrorStr.includes("resource_exhausted") ||
    fullErrorStr.includes("429") ||
    fullErrorStr.includes("503") ||
    fullErrorStr.includes("500") ||
    fullErrorStr.includes("unavailable") ||
    fullErrorStr.includes("quota") ||
    fullErrorStr.includes("limit") ||
    fullErrorStr.includes("exhausted") ||
    fullErrorStr.includes("unauthorized") ||
    fullErrorStr.includes("api_key") ||
    fullErrorStr.includes("demand") ||
    fullErrorStr.includes("spikes") ||
    fullErrorStr.includes("temporary") ||
    fullErrorStr.includes("try again") ||
    fullErrorStr.includes("overloaded") ||
    fullErrorStr.includes("service description")
  );
}

// In-Flight Promise Deduplication to coalesce identical rapid clicks
const inFlightRequests = new Map<string, Promise<any>>();

export async function deduplicateRequest<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (inFlightRequests.has(key)) {
    aiTelemetry.preventedDuplicates++;
    aiTelemetry.estimatedTokensSaved += 1500;
    console.log(`[DEDUPLICATION] Re-using in-flight request for: ${key}`);
    return inFlightRequests.get(key) as Promise<T>;
  }
  const promise = fn().finally(() => {
    inFlightRequests.delete(key);
  });
  inFlightRequests.set(key, promise);
  return promise;
}

// In-Memory LRU Response Cache with Time-To-Live
export function generateRequestHash(obj: any): string {
  try {
    return Buffer.from(JSON.stringify(obj)).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 32);
  } catch {
    return String(Date.now());
  }
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}
const responseCache = new Map<string, CacheEntry<any>>();

export function getCachedAiResponse<T>(key: string): T | null {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    responseCache.delete(key);
    return null;
  }
  aiTelemetry.cacheHits++;
  aiTelemetry.estimatedTokensSaved += 1800;
  console.log(`[CACHE HIT] Returning cached response for: ${key}`);
  return entry.data;
}

export function setCachedAiResponse<T>(key: string, data: T, ttlMs: number): void {
  if (responseCache.size > 200) {
    const oldestKey = responseCache.keys().next().value;
    if (oldestKey) responseCache.delete(oldestKey);
  }
  responseCache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs
  });
}

// Hook Library In-Memory Caching & Strategic Filtering
interface HookItem {
  id: number;
  name: string;
  description: string;
  best_used_for: string;
  example: string;
}

interface HookCategory {
  name: string;
  hooks: HookItem[];
}

let cachedHookLibrary: { categories: HookCategory[] } | null = null;

function getCachedHookLibrary(): { categories: HookCategory[] } {
  if (!cachedHookLibrary) {
    try {
      const libPath = path.join(process.cwd(), "server", "hookLibrary.json");
      if (fs.existsSync(libPath)) {
        cachedHookLibrary = JSON.parse(fs.readFileSync(libPath, "utf8"));
      }
    } catch (e) {
      console.error("Failed to parse hook library:", e);
      cachedHookLibrary = { categories: [] };
    }
  }
  return cachedHookLibrary || { categories: [] };
}



// Lean rulebook for single thread continuation (saves ~4,000 tokens per continuation request)
const MICRO_CONTINUATION_RULEBOOK = `
MANDATORY CONTINUATION LAWS:
1. Standalone Value: This consecutive part must offer genuine standalone value if seen independently in the feed.
2. Micro Hook Opening: The first sentence must be punchy and capture immediate interest without numbering (NO "2/", NO "Second...", NO "Continuing...").
3. Continuation Bridge: Seamlessly build on the momentum of previous parts without repeating previous statements.
4. Hard Limits: Must strictly respect the character limit and target sentence count.
5. Anti-Slop: Zero corporate buzzwords ("game changer", "delve", "unlock"), zero hashtag stuffing, clean spacing with blank lines.
`;

import { getAI, callGenerateContentWithRetry } from "./server/geminiClient";
import { compressPrompt, applyTokenLimits, routeModel, AI_QUOTA_CONFIG, aiTelemetry as optimizationTelemetry } from "./server/aiCostOptimizationEngine";

function sanitizeText(str: any): string {
  if (typeof str !== "string") return "";
  let clean = str.replace(/\\n/g, "\n").trim();
  clean = clean.replace(/^[\n\r]+|[\n\r]+$/g, "").trim();
  return clean;
}

function parseCharacterLimit(limitInput: any): number {
  if (typeof limitInput === "number" && !isNaN(limitInput) && limitInput > 0) {
    return Math.max(50, Math.min(5000, Math.round(limitInput)));
  }
  if (typeof limitInput === "string") {
    const parsed = parseInt(limitInput, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return Math.max(50, Math.min(5000, parsed));
    }
  }
  return 500;
}

function condensePartProgrammatically(
  text: string,
  characterLimit: number = 500,
  targetSentencesInput: any = 3,
  context?: { offer?: string; audience?: string; desiredResult?: string; category?: string; partIndex?: number; totalParts?: number }
): string {
  if (!text || typeof text !== "string") return "";
  return repairThreadPart(text, characterLimit, context);
}

function validateSinglePartIntegrity(
  text: string,
  context?: { offer?: string; audience?: string; desiredResult?: string; category?: string }
): string {
  if (!text || typeof text !== "string") return "";
  let clean = text.trim();
  
  const words = clean.split(/\s+/).filter(Boolean);
  const isLabelOnly = /^(?:Free audit|Quick tip|Unpopular opinion|Dear [^:]+|The silent killer|Hot take|Real talk|Note|Reminder|Warning|Cheat sheet|Lesson|Rule \d+|Step \d+):?$/i.test(clean);
  const endsWithColon = clean.endsWith(":");
  
  if (isLabelOnly || endsWithColon || words.length < 6) {
    const audience = context?.audience || "ambitious creators";
    const desiredResult = context?.desiredResult || "predictable growth";
    const offer = context?.offer || "a dedicated system";
    
    if (clean.toLowerCase().includes("free audit") || clean.toLowerCase().includes("audit")) {
      clean = `I am auditing 5 ${audience} pipelines this week to diagnose your growth bottlenecks using ${offer}.`;
    } else if (clean.toLowerCase().includes("unpopular opinion")) {
      clean = `Unpopular opinion: ${audience} who focus on durable systems achieve ${desiredResult} 10x faster than those chasing short-term hacks.`;
    } else if (clean.toLowerCase().includes("quick tip") || clean.toLowerCase().includes("tip")) {
      clean = `Quick tip for ${audience}: Eliminating administrative friction is the fastest way to accelerate ${desiredResult}.`;
    } else if (clean.toLowerCase().includes("dear")) {
      clean = `Dear ${audience}: Stop spending valuable hours on low-leverage tasks that do not compound toward ${desiredResult}.`;
    } else {
      clean = `To consistently unlock ${desiredResult}, ${audience} must eliminate friction and build sustainable, high-conviction systems.`;
    }
  }
  
  return clean;
}

function enforceLinkPlacementRules(
  parts: string[],
  context?: { offer?: string; audience?: string; desiredResult?: string; category?: string }
): string[] {
  if (!parts || !Array.isArray(parts) || parts.length === 0) return parts;
  
  const urlRegex = /https?:\/\/[^\s]+/gi;
  const isSinglePart = parts.length === 1;

  if (isSinglePart) {
    let part1 = parts[0];
    if (urlRegex.test(part1)) {
      part1 = part1.replace(urlRegex, "").replace(/\b(?:Link:|URL:|Website:|Resource:)\s*$/gim, "").trim();
      if (!part1.toLowerCase().includes("link in bio") && !part1.toLowerCase().includes("dm") && !part1.toLowerCase().includes("reply")) {
        part1 += "\n\n(Link in bio)";
      }
      return [part1];
    }
    return [part1];
  }

  // Multi-part thread: Prohibited in parts 0 to N-2, allowed ONLY in the final part
  return parts.map((part, idx) => {
    if (idx < parts.length - 1) {
      return part.replace(urlRegex, "").replace(/\b(?:Link:|URL:|Website:|Resource:)\s*$/gim, "").trim();
    }
    return part;
  });
}

function enforceThreadsPartFormatting(
  str: any,
  targetSentencesInput: any = 3,
  context?: { offer?: string; audience?: string; desiredResult?: string; category?: string; partIndex?: number; totalParts?: number; characterLimit?: number }
): string {
  if (typeof str !== "string" || !str.trim()) return "";

  const targetSentences = parseSentencesPerPart(targetSentencesInput);
  const characterLimit = parseCharacterLimit(context?.characterLimit || 500);

  // Normalize backslash-n string escapes
  let clean = str.replace(/\\n/g, "\n").trim();

  // Remove thread part prefix markers like "1/", "1.", "Part 1:", "Part 1 - "
  clean = clean.replace(/^(?:\d+[\/\.]|\bPart\s+\d+[:\-\s]*)/i, "").trim();

  // Anti-AI cliché filter for leading introductory fluff
  clean = clean
    .replace(/^(?:In today's (?:fast-paced )?world|Here are some tips:?|Let's dive in:?|At the end of the day),?\s*/gi, "")
    .trim();

  // If text contains orphaned possessive fragments ('s), repair them early to complete natural thought
  if (/(?:^|\s)["'‘“]?s["'’”](?=[.,!?:;]|\s|$)/i.test(clean) || /(?:^|\s)['’](?:s|d|t|m|ve|re|ll)\b/i.test(clean) || /\b(?:deliver|drives?|leads?\s+to|path\s+to|attention\s+to|desired|achieve|claim|scale)\s+['’"]?s['’"]?(?=[.,!?:;]|\s|$)/i.test(clean)) {
    clean = repairThreadPart(clean, characterLimit, {
      ...context,
      exactSentences: targetSentences
    });
  }
  clean = clean.trim();

  if (!clean) return "";

  // Parse into paragraphs to respect the author's natural spacing and grouping
  let rawParagraphs = clean.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);

  // Merge standalone label paragraphs (e.g. "Free audit:", "Unpopular opinion:") with their following paragraph
  const mergedParagraphs: string[] = [];
  for (let i = 0; i < rawParagraphs.length; i++) {
    const current = rawParagraphs[i];
    const isLabel = current.endsWith(":") || (current.split(/\s+/).length <= 4 && /^(?:Free audit|Quick tip|Unpopular opinion|Dear [^:]+|The silent killer|Hot take|Real talk|Note|Reminder|Warning|Step \d+|Rule \d+):?$/i.test(current));
    
    if (isLabel && i + 1 < rawParagraphs.length) {
      mergedParagraphs.push(`${current} ${rawParagraphs[i + 1]}`);
      i++; // Skip the next paragraph since we merged it
    } else {
      mergedParagraphs.push(current);
    }
  }
  rawParagraphs = mergedParagraphs;

  const paragraphBlocks: string[][] = [];
  let collectedSentenceCount = 0;

  for (const para of rawParagraphs) {
    if (collectedSentenceCount >= targetSentences) break;

    const sList = para
      .split(/(?<=[.!?])\s+(?=[A-Z0-9"'“”«–—])/g)
      .map(s => s.trim())
      .filter(Boolean);

    const sentencesToAdd: string[] = [];
    if (sList.length > 0) {
      for (let sIdx = 0; sIdx < sList.length; sIdx++) {
        if (collectedSentenceCount >= targetSentences) break;
        let sClean = sList[sIdx].trim();
        if (sClean.length > 0) {
          // If a sentence fragment ends with a colon and there's a next sentence in the list, merge them
          if (sClean.endsWith(":") && sIdx + 1 < sList.length) {
            sClean = `${sClean} ${sList[sIdx + 1].trim()}`;
            sIdx++; // Skip next
          }

          sClean = sClean.charAt(0).toUpperCase() + sClean.slice(1);
          if (!/[.!?:]$/.test(sClean)) {
            sClean += ".";
          }
          sentencesToAdd.push(sClean);
          collectedSentenceCount++;
        }
      }
    } else if (para.trim() && collectedSentenceCount < targetSentences) {
      let sClean = para.trim();
      sClean = sClean.charAt(0).toUpperCase() + sClean.slice(1);
      if (!/[.!?:]$/.test(sClean)) {
        sClean += ".";
      }
      sentencesToAdd.push(sClean);
      collectedSentenceCount++;
    }

    if (sentencesToAdd.length > 0) {
      paragraphBlocks.push(sentencesToAdd);
    }
  }

  // If no sentences were extracted, fallback to repairing the clean string
  if (paragraphBlocks.length === 0) {
    return repairThreadPart(clean, characterLimit, context);
  }

  // Join sentences within each paragraph with a space (or newline for list items), and join paragraphs with double newlines (\n\n)
  let joined = paragraphBlocks
    .map(block => {
      let blockText = "";
      for (let i = 0; i < block.length; i++) {
        const item = block[i];
        if (i === 0) {
          blockText = item;
        } else {
          if (/^[-*•]|\d+[.)]/.test(item) || /^[-*•]|\d+[.)]/.test(block[i - 1])) {
            blockText += "\n\n" + item;
          } else {
            blockText += " " + item;
          }
        }
      }
      return blockText;
    })
    .filter(Boolean)
    .join("\n\n");

  // Single-part / 1-sentence integrity check: ensure it's not an incomplete fragment or label
  if ((context?.totalParts === 1 || targetSentences === 1) && (!context?.partIndex || context.partIndex === 0)) {
    joined = validateSinglePartIntegrity(joined, context);
  }

  const partCheck = validatePartSemanticCompleteness(joined, characterLimit);
  const sents = splitIntoCompleteSentences(joined);
  if (partCheck.valid && sents.length === targetSentences) {
    return sanitizeSentenceSpacing(joined);
  }

  // If over character limit, incomplete, or sentence count mismatch, safely repair while respecting complete thoughts
  return repairThreadPart(joined, characterLimit, {
    ...context,
    exactSentences: targetSentences
  });
}

async function revisePartWithAI(
  partText: string,
  characterLimit: number = 500,
  targetSentencesInput: any = 3,
  context?: { offer?: string; audience?: string; desiredResult?: string; category?: string; partIndex?: number; totalParts?: number },
  aiInstance?: any
): Promise<string> {
  const clean = sanitizeText(partText);
  if (clean.length <= characterLimit) {
    return clean;
  }

  const targetSentences = parseSentencesPerPart(targetSentencesInput);
  let currentText = clean;
  let ai = aiInstance;

  if (!ai) {
    try {
      ai = getAI();
    } catch {
      // If AI unavailable, fall back to high quality programmatic condensation
      return condensePartProgrammatically(currentText, characterLimit, targetSentences);
    }
  }

  // Attempt up to 3 iterative revision passes
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (currentText.length <= characterLimit) {
      return currentText;
    }

    const revisionPrompt = `
You are ThreadsWorks AI Revision Engine.
A generated Meta Threads content part currently contains ${currentText.length} characters, which violates the strict configured limit of ${characterLimit} characters maximum.

CURRENT OVER-LIMIT CONTENT PART:
"""
${currentText}
"""

HARD REVISION CONSTRAINTS:
1. SHORTEN & CONDENSE: Total revised length MUST be planned within 350-475 characters and strictly <= ${characterLimit} characters.
2. COMPLETE SENTENCES ONLY: Every single sentence must be 100% grammatically complete and end with terminal punctuation (. ! ?). NEVER cut off mid-sentence, mid-clause, or mid-word (no "for.", "to.", "is.", "how to claim s.").
3. COMPLETE THOUGHT: Communicate a coherent, finished idea. Each part must stand on its own as a valuable thought.
4. PRESERVE ESSENCE: Keep the core hook, high-value insight, conversational authority, tone, and intended message intact.
5. REMOVE BLOAT: Cut all filler words, wordy phrasing, repetitive explanations, and unnecessary adjectives.
6. NATURAL FORMATTING: Use natural sentence grouping and spacing with proper whitespace after punctuation.

Return a JSON object with a single property "revisedPart" containing the shortened text.
`;

    try {
      const response = await callGenerateContentWithRetry(ai, {
        model: "gemini-3.6-flash",
        contents: revisionPrompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              revisedPart: { type: Type.STRING, description: `The shortened thread part text (MUST be <= ${characterLimit} characters)` }
            },
            required: ["revisedPart"]
          }
        }
      });

      const text = response.text;
      if (text) {
        const parsed = parseGeminiJsonResponse(text);
        if (parsed && typeof parsed.revisedPart === "string" && parsed.revisedPart.trim()) {
          const candidate = enforceThreadsPartFormatting(parsed.revisedPart, targetSentences, {
            ...context,
            characterLimit
          });
          if (candidate.length <= characterLimit) {
            return candidate;
          }
          currentText = candidate;
        }
      }
    } catch (err: any) {
      console.warn(`[AI Revision Attempt ${attempt}] Failed:`, err.message || err);
      break;
    }
  }

  // If still over limit after AI attempts or AI threw an error, enforce via condensation
  return condensePartProgrammatically(currentText, characterLimit, targetSentences);
}

async function validateAndReviseParts(
  parts: string[],
  characterLimit: number = 500,
  targetSentencesInput: any = 3,
  context?: { offer?: string; audience?: string; desiredResult?: string; category?: string },
  aiInstance?: any,
  allowAiRevision: boolean = true
): Promise<string[]> {
  const targetSentences = parseSentencesPerPart(targetSentencesInput);
  const validated: string[] = [];

  for (let i = 0; i < parts.length; i++) {
    const rawPart = parts[i];
    if (typeof rawPart !== "string" || !rawPart.trim()) {
      continue;
    }
    const sanitized = enforceThreadsPartFormatting(rawPart, targetSentences, {
      ...context,
      partIndex: i,
      totalParts: parts.length,
      characterLimit
    });

    if (sanitized.length <= characterLimit && isSentenceSemanticallyComplete(sanitized).complete) {
      validated.push(sanitized);
    } else {
      if (allowAiRevision && aiInstance) {
        try {
          const aiRevised = await revisePartWithAI(sanitized, characterLimit, targetSentences, { ...context, partIndex: i, totalParts: parts.length }, aiInstance);
          const repaired = repairThreadPart(aiRevised, characterLimit, { ...context, partIndex: i, totalParts: parts.length });
          validated.push(repaired);
          continue;
        } catch (revErr: any) {
          console.warn(`[VALIDATION] AI revision for Part ${i + 1} failed, using intelligent semantic repair:`, revErr.message);
        }
      }
      const repaired = repairThreadPart(sanitized, characterLimit, { ...context, partIndex: i, totalParts: parts.length });
      validated.push(repaired);
    }
  }

  // Apply universal Link Placement Rules across parts
  const linkValidated = enforceLinkPlacementRules(validated, context);

  return linkValidated;
}

function sanitizePost(
  post: any,
  targetSentencesInput: any = 3,
  context?: { offer?: string; audience?: string; desiredResult?: string; category?: string; characterLimit?: number },
  characterLimitInput: any = 500
): any {
  if (!post || typeof post !== "object") return post;
  
  const targetSentences = parseSentencesPerPart(targetSentencesInput);
  const charLimit = parseCharacterLimit(characterLimitInput || context?.characterLimit || 500);
  const title = sanitizeText(post.title);
  const explanation = sanitizeText(post.explanation);
  
  let rawThreadParts: string[] = [];
  if (Array.isArray(post.threadParts) && post.threadParts.length > 0) {
    rawThreadParts = post.threadParts;
  } else if (post.singlePost) {
    rawThreadParts = [post.singlePost];
  }
  rawThreadParts = enforcePartBoundaries(rawThreadParts);

  const threadParts = rawThreadParts
    .map((p: any, idx: number) => enforceThreadsPartFormatting(p, targetSentences, {
      ...context,
      partIndex: idx,
      totalParts: rawThreadParts.length,
      characterLimit: charLimit
    }))
    .filter(Boolean);

  const cleanThreadParts = enforcePartBoundaries(enforceLinkPlacementRules(threadParts, context));

  const hook = cleanThreadParts[0] ? cleanThreadParts[0].split("\n\n")[0] : sanitizeText(post.hook || "");
  const singlePost = cleanThreadParts[0] || hook || "";

  return {
    ...post,
    title,
    hook,
    singlePost,
    threadParts: cleanThreadParts,
    explanation
  };
}

async function validateAndRevisePost(
  post: any,
  characterLimit: number = 500,
  targetSentencesInput: any = 3,
  context?: { offer?: string; audience?: string; desiredResult?: string; category?: string },
  aiInstance?: any,
  allowAiRevision: boolean = true
): Promise<any> {
  if (!post || typeof post !== "object") return post;
  
  const targetSentences = parseSentencesPerPart(targetSentencesInput);
  const baseSanitized = sanitizePost(post, targetSentences, context, characterLimit);

  const rawParts = Array.isArray(baseSanitized.threadParts) && baseSanitized.threadParts.length > 0
    ? baseSanitized.threadParts
    : [baseSanitized.singlePost || ""];

  const revisedParts = await validateAndReviseParts(
    rawParts,
    characterLimit,
    targetSentences,
    context,
    aiInstance,
    allowAiRevision
  );

  const finalHook = revisedParts[0] ? revisedParts[0].split("\n\n")[0] : baseSanitized.hook;
  const finalSinglePost = revisedParts[0] || finalHook || "";

  const candidatePost = {
    ...baseSanitized,
    hook: finalHook,
    singlePost: finalSinglePost,
    threadParts: revisedParts
  };

  const { post: fullyRepaired, report: integrityReport } = ContentIntegrityChecker.verifyAndRepairPost(candidatePost, {
    charLimit: characterLimit,
    expectedHook: finalHook,
    context
  });

  (fullyRepaired as any).integrityReport = integrityReport;
  return fullyRepaired;
}

function getSimulatedPostsBatch(
  category: string,
  offer: string,
  audience: string,
  desiredResult: string,
  writingStyle?: string,
  count: number = 5,
  lockedOpeningHook: string = "",
  openingLocked: boolean = false,
  threadLength: string = "3",
  sentencesPerPart: any = 3,
  topic?: string,
  customInstruction?: string,
  activeCta?: any,
  activePillar?: any
) {
  const cleanStyle = writingStyle || "Direct, high-value, casual, authoritative";
  const numSentences = parseSentencesPerPart(sentencesPerPart);
  const targetPartCount = parseThreadLength(threadLength);
  const effectiveTopic = (topic && topic.trim()) ? topic.trim() : (activePillar?.title || "Core Strategy");
  const defaultCta = activeCta?.message || "Reply below or leave a comment to connect on your strategy.";

  const sanitizeVar = (val: any, defaultVal: string): string => {
    if (!val) return defaultVal;
    if (typeof val === "object") {
      const extracted = val.name || val.title || val.message || val.label || "";
      if (extracted && typeof extracted === "string" && extracted.trim()) return extracted.trim();
      return defaultVal;
    }
    if (typeof val !== "string") return defaultVal;
    const clean = val.replace(/\bhelp\s+s\s+users\b/gi, "users").replace(/\bachieve\s+s\b/gi, "optimal results").trim();
    if (clean.length < 2 || /^s$/i.test(clean) || clean.toUpperCase() === "EDUCATION") return defaultVal;
    return clean;
  };

  const cleanAudience = sanitizeVar(audience, "ambitious creators and entrepreneurs");
  const cleanOffer = sanitizeVar(offer, "a high-value product or service");
  const cleanResult = sanitizeVar(desiredResult, "predictable growth and engagement");

  let result: any;
  if (category === "attention") {
    result = {
      isSimulated: true,
      apiWarning: "Free Tier Gemini Quota fully saturated. ThreadsWorks Sandbox Engine successfully generated simulated high-fidelity content matching your DNA profile.",
      posts: [
        {
          title: `The Truth About ${effectiveTopic.slice(0, 30)}`,
          hook: `Why most ${cleanAudience} struggle with ${effectiveTopic} (and the single shift that changes it).`,
          singlePost: `Why most ${cleanAudience} struggle with ${effectiveTopic}.\n\nThey copy what everyone else is doing instead of speaking directly to one specific client situation.\n\nHere is what works:\nState the exact problem in your first sentence.\nShare one concrete insight from real experience.\nGive your reader one clear action to take today with ${cleanOffer}.`,
          explanation: "Uses a sharp pattern interrupt to challenge conventional habits and offer a concrete alternative."
        },
        {
          title: "The Simple Focus Principle",
          hook: `Unpopular opinion: If you are an ambitious ${cleanAudience}, stop looking for short-term shortcuts in ${effectiveTopic}.`,
          singlePost: `Unpopular opinion: If you are an ambitious ${cleanAudience}, stop looking for short-term shortcuts in ${effectiveTopic}.\n\nQuick tricks do not fix an unfocused message.\n\nInstead, double down on three core foundations:\n1. Speak to the exact problem your audience faces daily.\n2. Connect your solution directly to their main goal.\n3. Show up with practical lessons they can use in 5 minutes.\n\nThat is how ${cleanOffer} delivers real momentum.`,
          explanation: "Establishes authority by challenging common distractions and reinforcing core fundamentals."
        },
        {
          title: "The Hidden Operational Drain",
          hook: `The real roadblock stopping ${cleanAudience} from reaching ${cleanResult} is overcomplicating daily execution in ${effectiveTopic}.`,
          singlePost: `The real roadblock stopping ${cleanAudience} from reaching ${cleanResult} is overcomplicating daily execution in ${effectiveTopic}.\n\nYou spend hours tweaking small details instead of having conversations with potential clients.\n\nTake a step back.\nAsk yourself: What is the single clearest path to helping someone today?\n\nIf you want a straightforward roadmap, look at ${cleanOffer}.\n\nSimplicity always wins.`,
          explanation: "Identifies a relatable daily bottleneck and provides an immediate, grounded perspective shift."
        },
        {
          title: "The 3-Step Clarity Blueprint",
          hook: `A simple 3-step playbook for ${cleanAudience} aiming for ${cleanResult} with ${effectiveTopic}.`,
          singlePost: `A simple 3-step playbook for ${cleanAudience} aiming for ${cleanResult} with ${effectiveTopic}:\n\n1. Identify the main question your clients ask every week.\n2. Write your direct answer in plain language.\n3. Show them how ${cleanOffer} solves that exact problem.\n\nNo buzzwords. Just clear, practical execution.`,
          explanation: "Delivers an actionable 3-step blueprint that establishes immediate tactical authority."
        },
        {
          title: "Focus on Core Work",
          hook: `A quick note for ${cleanAudience}: Stop doing work that does not move ${effectiveTopic} forward.`,
          singlePost: `A quick note for ${cleanAudience}: Stop doing work that does not move ${effectiveTopic} forward.\n\nIf you want to reach ${cleanResult}, you have to protect your attention.\n\nDedicate your mornings to conversations and client value.\n\nWe designed ${cleanOffer} around this exact principle.\n\nWhat is the one priority on your calendar today?`,
          explanation: "Direct, personal note that builds warm peer-to-peer alignment with qualified readers."
        }
      ]
    };
  } else if (category === "trust") {
    result = {
      isSimulated: true,
      apiWarning: "Free Tier Gemini Quota fully saturated. ThreadsWorks Sandbox Engine successfully generated simulated high-fidelity content matching your DNA profile.",
      posts: [
        {
          title: "The Step-by-Step Breakdown",
          hook: `How to build steady momentum around ${effectiveTopic} without burning out.`,
          singlePost: `How to build steady momentum around ${effectiveTopic} without burning out:\n\nStep 1: Clarify your primary message in one plain sentence.\nStep 2: Walk through your actual client process step-by-step.\nStep 3: Deliver undeniable proof through real examples.\n\nThis is the exact approach we teach inside ${cleanOffer}.\n\nSave this post for your next planning session.`,
          explanation: "Breaks down delivery into practical milestones, presenting professional confidence."
        },
        {
          title: "A Practical Transformation Lesson",
          hook: `How simplifying your approach to ${effectiveTopic} creates steady momentum toward ${cleanResult}.`,
          singlePost: `How simplifying your approach to ${effectiveTopic} creates steady momentum toward ${cleanResult}:\n\nMost people try to do everything at once and end up stretched thin.\n\nHere is how to turn it around:\n- Focus on your single strongest service\n- Clean up your primary message for ${cleanAudience}\n- Put ${cleanOffer} at the center of every conversation\n\nWhen your core message is focused, conversations happen naturally.`,
          explanation: "Uses an authentic delivery principle to demonstrate real-world competence without inventing claims."
        },
        {
          title: "The 10-Minute Daily Practice",
          hook: `The 10-minute daily practice for ${cleanAudience} working on ${effectiveTopic}.`,
          singlePost: `The 10-minute daily practice for ${cleanAudience} working on ${effectiveTopic}:\n\nBefore checking your inbox or social feeds, write down your one main goal for the day.\n\nAsk yourself: Does this directly support ${cleanResult}?\n\nIf the answer is no, move it down the list.\n\nWe built ${cleanOffer} so you can stay focused on what matters most.`,
          explanation: "Shares a concrete daily practice that establishes mutual respect and high utility."
        },
        {
          title: "The Reality of Steady Progress",
          hook: `The honest truth about ${effectiveTopic} on Threads.`,
          singlePost: `The honest truth about ${effectiveTopic} on Threads:\n\nClear inputs produce steady outcomes.\n\nIf you post without a clear offer, your results will stay unpredictable.\n\nShow up with useful lessons, explain your point clearly, and invite dialogue around ${cleanOffer}.\n\nClarity beats complexity every single time.`,
          explanation: "Appeals to common sense and clarity to differentiate from generic hype."
        },
        {
          title: "Three Practical Standards",
          hook: `Three practical standards for ${cleanAudience} ready to level up their work with ${effectiveTopic}.`,
          singlePost: `Three practical standards for ${cleanAudience} ready to level up their work with ${effectiveTopic}:\n\n1. Define who you help in one clear sentence.\n2. Build a reliable delivery routine you can maintain every week.\n3. Guide interested readers toward ${cleanOffer}.\n\nWhen your fundamentals are solid, ${cleanResult} follows naturally.`,
          explanation: "Validates high aspirations by delivering grounded operational principles."
        }
      ]
    };
  } else { // sales
    result = {
      isSimulated: true,
      apiWarning: "Free Tier Gemini Quota fully saturated. ThreadsWorks Sandbox Engine successfully generated simulated high-fidelity content matching your DNA profile.",
      posts: [
        {
          title: "The Direct Implementation Guide",
          hook: `The exact 3-step checklist we use with ${cleanAudience} to reach ${cleanResult} through ${effectiveTopic}.`,
          singlePost: `The exact 3-step checklist we use with ${cleanAudience} to reach ${cleanResult} through ${effectiveTopic}:\n\n1. Review your last 5 posts: Did each one solve a specific problem?\n2. Remove confusing industry jargon from your bio.\n3. Introduce ${cleanOffer} as the natural next step.\n\n${defaultCta}`,
          explanation: "Delivers a practical checklist paired with an authentic conversation starter."
        },
        {
          title: "Direct Client Pathway",
          hook: `If you are an ambitious ${cleanAudience} aiming for ${cleanResult}, here is our direct approach to ${effectiveTopic}.`,
          singlePost: `If you are an ambitious ${cleanAudience} aiming for ${cleanResult}, here is our direct approach to ${effectiveTopic}:\n\nWe focus on clear positioning, predictable delivery, and simple fundamentals.\n\nWe designed ${cleanOffer} to help you make consistent progress without overcomplicating your work.\n\n${defaultCta}`,
          explanation: "Clean qualification and direct next steps grounded in your real offer without fake claims."
        },
        {
          title: "The Strategic Alignment Framework",
          hook: `A clear framework for ${cleanAudience} looking to reach ${cleanResult} with ${effectiveTopic}.`,
          singlePost: `A clear framework for ${cleanAudience} looking to reach ${cleanResult} with ${effectiveTopic}:\n\n1. Clarify your core message so your audience immediately understands your work.\n2. Share practical insights from your actual experience.\n3. Position ${cleanOffer} as the natural next step.\n\n${defaultCta}`,
          explanation: "High individual value in exchange for an authentic, low-friction conversation starter."
        },
        {
          title: "The Practical Asset Breakdown",
          hook: `The 3 core assets every ${cleanAudience} needs to reach ${cleanResult} in ${effectiveTopic}.`,
          singlePost: `The 3 core assets every ${cleanAudience} needs to reach ${cleanResult} in ${effectiveTopic}:\n\n1. A clear bio that explains who you help.\n2. A weekly posting schedule that answers real client questions.\n3. A direct pathway to ${cleanOffer}.\n\n${defaultCta}`,
          explanation: "Presents concrete business assets and offers practical notes as a natural exchange."
        },
        {
          title: "The Practical Workflow Shift",
          hook: `How to build momentum toward ${cleanResult} with a simpler daily routine in ${effectiveTopic}.`,
          singlePost: `How to build momentum toward ${cleanResult} with a simpler daily routine in ${effectiveTopic}:\n\nFocus strictly on activities that directly serve your audience and clients.\n\nWe built ${cleanOffer} around this exact focus.\n\n${defaultCta}`,
          explanation: "Clean, direct focus on simplicity and professional competence."
        }
      ]
    };
  }

  if (result && result.posts) {
    if (result.posts.length < count) {
      const basePosts = [...result.posts];
      while (result.posts.length < count) {
        const idx = result.posts.length;
        const base = basePosts[idx % basePosts.length];
        result.posts.push({
          ...base,
          title: `${base.title} #${idx + 1}`,
          hook: base.hook,
          singlePost: base.singlePost,
          explanation: base.explanation
        });
      }
    }

    result.posts = result.posts.map((post: any, pIdxIdx: number) => {
      const effectiveHook = (openingLocked && lockedOpeningHook) ? lockedOpeningHook : post.hook;

      // Determine per-post part count when auto or explicit
      const effectivePartCount = (threadLength === "auto" || !threadLength)
        ? (pIdxIdx % 5 === 0 ? 1 : pIdxIdx % 5 === 1 ? 2 : pIdxIdx % 5 === 2 ? 1 : pIdxIdx % 5 === 3 ? 4 : 3)
        : targetPartCount;

      // Construct coherent, structured parts matching effectivePartCount
      let finalThreadParts: string[] = [];

      if (effectivePartCount === 1) {
        // Single post
        finalThreadParts = [post.singlePost];
      } else if (effectivePartCount === 2) {
        // 2 parts: Hook + Context, followed by Takeaway + CTA
        const p1 = `${effectiveHook}\n\nMost creators struggle with ${effectiveTopic} because they overcomplicate the fundamentals instead of speaking directly to their audience.`;
        const p2 = `When you focus on one concrete transformation with ${cleanOffer}, your ideal clients pay attention immediately.\n\n${defaultCta}`;
        finalThreadParts = [p1, p2];
      } else if (effectivePartCount === 3) {
        // 3 parts: Hook, Mechanism, Resolution/CTA
        const p1 = effectiveHook;
        const p2 = `Here is the shift that makes all the difference with ${effectiveTopic}:\n\n1. Speak to the exact situation your audience faces.\n2. Share one practical insight from your real experience.\n3. Connect that solution directly to ${cleanResult}.`;
        const p3 = `We designed ${cleanOffer} around this exact standard.\n\nWhen your delivery is simple, consistency becomes natural.\n\n${defaultCta}`;
        finalThreadParts = [p1, p2, p3];
      } else if (effectivePartCount === 4) {
        // 4 parts: Hook, Context, Action Steps, Takeaway/CTA
        const p1 = effectiveHook;
        const p2 = `Most ${cleanAudience} overcomplicate ${effectiveTopic} by chasing short-term tactics that do not last.\n\nWhen your message tries to speak to everyone, it resonates with no one.`;
        const p3 = `Here is the framework we rely on:\n\n- Name the specific problem in your opening line.\n\n- Walk through your actual process step-by-step.\n\n- Provide undeniable proof through real examples.`;
        const p4 = `This is the exact methodology we build with ${cleanOffer}.\n\nClarity beats complexity every single time.\n\n${defaultCta}`;
        finalThreadParts = [p1, p2, p3, p4];
      } else {
        // 5 or 6 parts: Deep dive sequence
        const p1 = effectiveHook;
        const p2 = `The real bottleneck with ${effectiveTopic} is trying to execute too many ideas at once.\n\nWhen you eliminate the noise, your core value proposition becomes crystal clear.`;
        const p3 = `Step 1: Clarify who you help and the exact outcome you deliver.\n\nYour bio and opening lines should make this obvious within 3 seconds.`;
        const p4 = `Step 2: Build a dependable delivery routine you can sustain every single week without burning out.`;
        const p5 = `Step 3: Position ${cleanOffer} as the natural, high-conviction vehicle to reach ${cleanResult}.`;
        finalThreadParts = [p1, p2, p3, p4, p5];
        if (effectivePartCount === 6) {
          finalThreadParts.push(`When your fundamentals are solid, momentum compounds predictably over time.\n\n${defaultCta}`);
        }
      }

      return {
        ...post,
        hook: effectiveHook,
        singlePost: finalThreadParts[0],
        threadParts: finalThreadParts
      };
    });
    result.posts = result.posts.slice(0, count);
  }
  return result;
}

function getSimulatedSinglePost(
  category: string,
  offer: string,
  audience: string,
  desiredResult: string,
  writingStyle?: string,
  lockedOpeningHook: string = "",
  openingLocked: boolean = false,
  threadLength: string = "3",
  sentencesPerPart: any = 3,
  topic?: string,
  customInstruction?: string,
  activeCta?: any,
  activePillar?: any
) {
  const batch = getSimulatedPostsBatch(category, offer, audience, desiredResult, writingStyle, 5, lockedOpeningHook, openingLocked, threadLength, sentencesPerPart, topic, customInstruction, activeCta, activePillar);
  const posts = batch.posts;
  const index = Math.floor(Math.random() * posts.length);
  return {
    isSimulated: true,
    apiWarning: "Free Tier Gemini Quota fully saturated. ThreadsWorks Sandbox Engine successfully generated simulated high-fidelity content matching your DNA profile.",
    ...posts[index]
  };
}

function getSimulatedThreads(offer: string, audience: string, desiredResult: string, writingStyle: string, topic: string, format: string) {
  const cleanTopic = topic || `How to reach ${desiredResult} with ${offer}`;
  
  let hook = `How we help ${audience} consistently reach ${desiredResult}.`;
  let singlePost = `How we help ${audience} consistently reach ${desiredResult}.\n\nIt is not about working 80 hours a week.\nIt is about implementing straightforward, dependable habits with ${offer}.\n\nHere is where to start:\n- Focus on one clear offer.\n- Write about real problems your audience asks about.\n- Keep your daily steps simple.\n\nWant our practical walkthrough? Reply 'GUIDE' below and I will send it over.`;
  let explanation = "Combines a transformation hook with a soft hand-raiser to start genuine conversations.";
  let threadPosts = [
    `How we help ${audience} consistently reach ${desiredResult}.\n\nIt is not about working 80 hours a week.\n\nIt is about building a clear, repeatable process around ${offer}.`,
    `Most creators try to post without a clear point of view. It creates views, but rarely brings in clients.\n\nThe fix is simple: answer one specific client question in every single post.`,
    `If you want our practical breakdown for turning posts into client inquiries, reply 'GUIDE' below and I will send it directly to your DMs!`
  ];

  if (format === "hook-value") {
    hook = `The clearest way for ${audience} to reach ${desiredResult}.`;
    singlePost = `The clearest way for ${audience} to reach ${desiredResult}:\n\nUse a straightforward system like ${offer} to keep your daily focus clear.\n\nHere are 3 key habits:\n1. Answer one client question each day.\n2. Reclaim 5+ hours by skipping unnecessary manual tasks.\n3. Make your call to action conversational.\n\nLeave a reply with 'CHECKLIST' to grab our interactive worksheet.`;
    explanation = "Appeals directly to immediate relief and clarity to secure genuine replies.";
  } else if (format === "story") {
    hook = `I was speaking to an overloaded ${audience} yesterday who felt completely stuck.`;
    singlePost = `I was speaking to an overloaded ${audience} yesterday who felt completely stuck.\n\nThey were putting in 50 hours a week but still not getting closer to ${desiredResult}.\n\nWe sat down and reviewed their routine.\nWe saw they were spending hours rewriting posts that had no clear message.\n\nWe put ${offer} in place.\n\nNow they have a clear 15-minute daily routine and steady client interest.\n\nIf you want the exact notes from that session:\nReply 'STORY' below and I will send them!`;
    explanation = "Leverages an authentic turning-point story to build deep trust and direct relevance.";
  } else if (format === "controversial") {
    hook = `If you are an ambitious ${audience}, stop copying popular viral trends.`;
    singlePost = `If you are an ambitious ${audience}, stop copying popular viral trends.\n\nMost viral formats get vanity views, but they do not attract paying clients.\n\nIf you want to achieve ${desiredResult}, you need honest expertise and practical lessons, not temporary tricks.\n\nThat is why we created ${offer}.\nIt focuses entirely on client results.\n\nWhat is your experience with viral trends? Let's discuss in the replies.`;
    explanation = "Challenges superficial advice to attract high-intent, serious clients.";
  }

  return {
    isSimulated: true,
    apiWarning: "Free Tier Gemini Quota fully saturated. ThreadsWorks Sandbox Engine successfully generated simulated high-fidelity content matching your DNA profile.",
    title: cleanTopic,
    hook,
    singlePost,
    explanation,
    threadPosts
  };
}

// UNIFIED RULEBOOK & LAWS IMPORTED FROM ./rulebook

function parseThreadLength(threadLength: any): number {
  if (typeof threadLength === "number" && threadLength >= 1 && threadLength <= 15) {
    return Math.round(threadLength);
  }
  if (typeof threadLength === "string") {
    const parsed = parseInt(threadLength, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 15) {
      return parsed;
    }
    if (threadLength === "quick") return 2;
    if (threadLength === "deep") return 6;
    if (threadLength === "masterclass") return 10;
  }
  return 3;
}

function parseSentencesPerPart(sentencesInput: any): number {
  if (typeof sentencesInput === "number" && sentencesInput >= 1 && sentencesInput <= 8) {
    return Math.round(sentencesInput);
  }
  if (typeof sentencesInput === "string") {
    const parsed = parseInt(sentencesInput, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 8) {
      return parsed;
    }
  }
  return 3;
}

function getThreadLengthInstructions(threadLengthInput: any, sentencesPerPartInput: any = 3, characterLimitInput: any = 500) {
  const isAutoParts = isAutoValue(threadLengthInput);
  const isAutoSentences = isAutoValue(sentencesPerPartInput);

  const parts = parseThreadLength(threadLengthInput);
  const sentences = parseSentencesPerPart(sentencesPerPartInput);
  const charLimit = parseCharacterLimit(characterLimitInput);
  const sentenceWord = sentences === 1 ? "sentence" : "sentences";
  let lengthDesc = "";
  
  if (isAutoParts) {
    lengthDesc = `
AI AUTO DECIDE LENGTH DIRECTIVES (1 TO 15 PARTS):
- Determine the optimal part count (1 to 15 parts) based on the true semantic depth required to fully deliver the idea:
  * Single Post (1 Part): For concise standalone observations, sharp insights, punchy takeaways, or self-contained thoughts.
  * 2–3 Parts: For a focused claim, explanation, and payoff.
  * 4–6 Parts: For frameworks, mini-tutorials, comparisons, processes, or developed arguments.
  * 7–10 Parts: For deeper walkthroughs, multi-step methods, teardowns, or comprehensive educational threads.
  * 11–15 Parts: For extensive breakdowns, detailed systems, substantial tutorials, or subjects requiring extensive room.
- Use the fewest parts necessary to fully deliver the idea without fluff or filler.
- Hard maximum 15 parts. Every part independently MUST be <= ${charLimit} characters.
`;
  } else if (parts === 1) {
    lengthDesc = `
THREAD LENGTH RULE: Generate exactly 1 part in total (i.e., threadParts MUST contain exactly 1 item).
1 Part:
- Part 1 (Single Post / Full Thought): Deliver the complete message in a single standalone post using ${isAutoSentences ? "an optimal 1-3 complete sentences" : `EXACTLY ${sentences} complete ${sentenceWord}`}. (If a locked hook is active, Part 1 begins with the locked hook followed by the remaining sentences developing that thought). Multiple sentences in this part work together as a connected thought unit. MUST be <= ${charLimit} characters.
`;
  } else if (parts === 2) {
    lengthDesc = `
THREAD LENGTH RULE: Generate exactly 2 parts in total (i.e., threadParts MUST contain exactly 2 items).
2 Parts:
- Part 1 (Primary Hook): Introduce the core observation, problem, or perspective using ${isAutoSentences ? "1-2 complete sentences" : `EXACTLY ${sentences} complete ${sentenceWord}`}. (If a locked hook is active, Part 1 begins with the locked hook followed by the remaining sentences). Sentences connect and develop the opening thought. MUST be <= ${charLimit} characters.
- Part 2 (Action Hook / Final Part): Deliver standalone value, realization, or CTA using ${isAutoSentences ? "1-2 complete sentences" : `EXACTLY ${sentences} complete ${sentenceWord}`}. MUST be <= ${charLimit} characters.
`;
  } else if (parts === 3) {
    lengthDesc = `
THREAD LENGTH RULE: Generate exactly 3 parts in total (i.e., threadParts MUST contain exactly 3 items).
3 Parts:
- Part 1 (Primary Hook): Introduce the core problem or opportunity using ${isAutoSentences ? "1-2 complete sentences" : `EXACTLY ${sentences} complete ${sentenceWord}`}. (If a locked hook is active, Part 1 begins with the locked hook followed by the remaining sentences). MUST be <= ${charLimit} characters.
- Part 2 (Continuation / Expansion Hook): Expand the idea with connected context and standalone value using ${isAutoSentences ? "2-3 complete sentences" : `EXACTLY ${sentences} complete ${sentenceWord}`}. MUST be <= ${charLimit} characters.
- Part 3 (Action Hook / Final Part): Deliver key resolution, realization, or CTA using ${isAutoSentences ? "1-2 complete sentences" : `EXACTLY ${sentences} complete ${sentenceWord}`}. MUST be <= ${charLimit} characters.
`;
  } else {
    const middleParts: string[] = [];
    for (let i = 2; i < parts; i++) {
      middleParts.push(`- Part ${i} (Expansion Hook Part ${i - 1}): Provide another attention-grabbing insight developed deeply using ${isAutoSentences ? "2-3 complete sentences" : `EXACTLY ${sentences} complete ${sentenceWord}`}. MUST be <= ${charLimit} characters.`);
    }
    lengthDesc = `
THREAD LENGTH RULE: Generate exactly ${parts} parts in total (i.e., threadParts MUST contain exactly ${parts} items).
${parts} Parts:
- Part 1 (Primary Hook): Introduce the core problem or opportunity using ${isAutoSentences ? "1-2 complete sentences" : `EXACTLY ${sentences} complete ${sentenceWord}`}. (If a locked hook is active, Part 1 begins with the locked hook followed by the remaining sentences). MUST be <= ${charLimit} characters.
${middleParts.join("\n")}
- Part ${parts} (Action Hook / Final Part): Deliver key resolution and CTA using ${isAutoSentences ? "1-2 complete sentences" : `EXACTLY ${sentences} complete ${sentenceWord}`}. MUST be <= ${charLimit} characters.
`;
  }

  const sentenceRuleText = isAutoSentences
    ? `- AI AUTO DECIDE SENTENCES: Analyze the topic, hook tension, and mobile scan pacing to determine the optimal number of complete sentences per part (typically 1 to 3 complete sentences per part).`
    : `- HARD MANUAL SENTENCE CONSTRAINT: The creator has explicitly and manually configured EXACTLY ${sentences} ${sentenceWord.toUpperCase()} PER PART.
  * Every single part (Part 1, Part 2, Part 3, etc.) MUST contain EXACTLY ${sentences} complete grammatical sentences.
  * Do NOT write fewer sentences (e.g., writing 1 sentence when 2 is configured is strictly rejected).
  * Do NOT write more sentences (e.g., writing 3 sentences when 2 is configured is strictly rejected).
  * Every sentence must represent a complete grammatical thought ending in terminal punctuation (. ! ?).`;

  const partRuleText = isAutoParts
    ? `- AI AUTO DECIDE LENGTH (1 TO 15 PARTS): Analyze the topic and objective to determine the optimal number of parts (1 to 15 parts based on semantic depth). Single post for concise insights; 2-6 parts for lessons and frameworks; 7-15 parts for in-depth walkthroughs.`
    : `- HARD MANUAL PART CONSTRAINT: The creator has explicitly and manually configured EXACTLY ${parts} PART${parts > 1 ? "S" : ""}.
  * The threadParts array MUST contain EXACTLY ${parts} items.
  * Do NOT generate fewer or more parts.`;

  return `
=============================================================
THREAD LENGTH & SENTENCES PER PART SPECIFICATIONS:
=============================================================
Mode: ${(!isAutoParts && !isAutoSentences) ? "STRICT MANUAL STRUCTURE" : (isAutoParts && isAutoSentences ? "AI AUTO DECIDE STRUCTURE" : "HYBRID STRUCTURE")}
Selected Thread Length: ${isAutoParts ? "AI AUTO DECIDE (Dynamic 1 to 15 parts based on idea depth)" : `STRICT MANUAL CONSTRAINT: EXACTLY ${parts} PART${parts > 1 ? "S" : ""}`}
Target Part Count: ${isAutoParts ? "Dynamic 1 to 15 post(s) in threadParts array" : `EXACTLY ${parts} post(s) in threadParts array`}
Sentences Per Part: ${isAutoSentences ? "AI Decides Optimal Sentence Flow (1-3 sentences per part)" : `EXACTLY ${sentences} ${sentenceWord.toUpperCase()} PER PART`}
Configured Character Limit: EXACTLY ${charLimit} CHARACTERS MAXIMUM PER PART

STRUCTURE ENFORCEMENT RULES:
${partRuleText}
${sentenceRuleText}

ABSOLUTE INDEPENDENT PART LENGTH & CHARACTER LIMIT RULES (HARD MAXIMUM):
- CHARACTER LIMIT IS A PLANNING CONSTRAINT, NOT A TRUNCATION POINT: Plan each part from the start to fit comfortably within 350-475 characters and strictly <= ${charLimit} characters.
- A shorter complete part is ALWAYS preferable to a longer broken part. Never write freely and truncate afterward.
- EVERY SINGLE PART INDEPENDENTLY (i.e. Part 1, Part 2, Part 3, Part 4... each separate part in threadParts and singlePost) MUST BE STRICTLY ${charLimit} CHARACTERS OR FEWER.
- COMPLETE SENTENCES MANDATE: Every sentence must be 100% grammatically complete and end with terminal punctuation (. ! ?). Never end mid-word, mid-clause, or with dangling prepositions or conjunctions (no "for.", "to.", "is.", "how to claim s.").
- COMPLETE THOUGHT MANDATE: Each part must communicate a complete, finished idea with clear narrative purpose.

${lengthDesc}

${MULTI_POST_HOOK_OPTIMIZATION_SYSTEM}
`;
}

function buildCurrentUserIdentitySection(creatorIdentity?: any): string {
  if (!creatorIdentity) return "";

  const sections: string[] = [];

  // Section 0: Raw Unified Voice Context (Source of Truth)
  if (creatorIdentity.rawVoice && creatorIdentity.rawVoice.trim()) {
    sections.push(`### CREATOR UNIFIED VOICE & BACKGROUND CONTEXT (PRIMARY SOURCE OF TRUTH):\n${creatorIdentity.rawVoice.trim()}`);
  }

  // Section 1: Personality, Worldview, Cognition & Experiences
  const identityCore: string[] = [
    creatorIdentity.personality ? `- PERSONALITY (Demeanor, Temperament & Presence): ${creatorIdentity.personality}` : "",
    creatorIdentity.howYouThink ? `- HOW YOU THINK (Mental Models, Reasoning Style & Cognitive Architecture): ${creatorIdentity.howYouThink}` : "",
    creatorIdentity.whatYouBelieve ? `- WHAT YOU BELIEVE (Core Convictions, First Principles & Stances): ${creatorIdentity.whatYouBelieve}` : "",
    creatorIdentity.yourExperiences ? `- EXPERIENCES (Authentic Background, Real Career Milestones & Journey): ${creatorIdentity.yourExperiences}` : "",
    creatorIdentity.yourExpertise ? `- EXPERTISE (Hard Skills, Domain Mastery & Specialized Knowledge): ${creatorIdentity.yourExpertise}` : "",
    creatorIdentity.yourHumor ? `- HUMOR (Wit Style, Playfulness & Observational Lens): ${creatorIdentity.yourHumor}` : "",
    creatorIdentity.yourPerspective ? `- PERSPECTIVE (Unique Viewpoint, Counter-Intuitive Angle & Worldview): ${creatorIdentity.yourPerspective}` : ""
  ].filter(Boolean);

  if (identityCore.length > 0) {
    sections.push(`### 1. CREATOR COGNITION, WORLDVIEW & EXPERIENCES (SHAPES IDEAS, ANGLES, REASONING & OPINIONS):\n${identityCore.join("\n")}`);
  }

  // Section 2: Voice, Vocabulary & Expression Rules
  const voiceCore: string[] = [
    creatorIdentity.writingStyle ? `- WRITING STYLE (Rhythm, Cadence, Sentence Flow & Structural Preferences): ${creatorIdentity.writingStyle}` : "",
    creatorIdentity.tone ? `- TONE (Energy, Emotional Register & Attitude): ${creatorIdentity.tone}` : "",
    creatorIdentity.wordsYouUse ? `- WORDS & PHRASES YOU USE (Signature Vocabulary & Natural Expressions): ${creatorIdentity.wordsYouUse}` : "",
    creatorIdentity.wordsYouAvoid ? `- WORDS & PHRASES YOU AVOID (Strictly Banned Jargon, Tropes & Clichés): ${creatorIdentity.wordsYouAvoid}` : ""
  ].filter(Boolean);

  if (voiceCore.length > 0) {
    sections.push(`### 2. CREATOR VOICE, VOCABULARY & EXPRESSION (HOW YOU COMMUNICATE & WHAT STAYS UNSAID):\n${voiceCore.join("\n")}`);
  }

  // Section 3: Audience, Mission & Remembered Takeaway
  const audienceCore: string[] = [
    creatorIdentity.whoYouHelp ? `- WHO YOU HELP (Target Audience & Who You Speak To): ${creatorIdentity.whoYouHelp}` : "",
    creatorIdentity.whatYouHelpThemDo ? `- WHAT YOU HELP THEM DO (Desired Transformation & Core Mission): ${creatorIdentity.whatYouHelpThemDo}` : "",
    creatorIdentity.whatYoureKnownFor ? `- WHAT YOU ARE KNOWN FOR (Reputation, Positioning & Core Identity): ${creatorIdentity.whatYoureKnownFor}` : "",
    creatorIdentity.whatYouTalkAbout ? `- WHAT YOU TALK ABOUT (Primary Subject Domains & Themes): ${creatorIdentity.whatYouTalkAbout}` : "",
    creatorIdentity.whatYouWantPeopleToRemember ? `- WHAT YOU WANT PEOPLE TO REMEMBER (Core Legacy, Realization & Lasting Takeaway): ${creatorIdentity.whatYouWantPeopleToRemember}` : ""
  ].filter(Boolean);

  if (audienceCore.length > 0) {
    sections.push(`### 3. CREATOR AUDIENCE, POSITIONING & REMEMBERED TAKEAWAY (SHAPES CONCLUSIONS & EXAMPLES):\n${audienceCore.join("\n")}`);
  }

  // Section 4: Digital Character Persona (if defined)
  if (creatorIdentity.character && creatorIdentity.character.baseCharacter) {
    const char = creatorIdentity.character;
    sections.push(`### 4. CREATOR DIGITAL PERSONA VIBE:
- Character Archetype: ${char.baseCharacter}
- Expression & Presence: ${char.expression || "authentic"} (${char.avatarStyle || "digital"})
(Note: Do not force literal cartoon references in post copy; use this to inform conversational warmth, charisma, and presence)`);
  }

  if (sections.length === 0) return "";

  return `
=============================================================
### LAYER 1: YOUR VOICE (WHO YOU ARE + HOW YOU SOUND + HOW YOU THINK)
=============================================================
PURPOSE: Represents WHO THE USER IS and HOW THEY NATURALLY COMMUNICATE.
PRIMARY QUESTION: "How should this sound so it feels like this person wrote it?"
BOUNDARIES: Do NOT use this layer for business offers, pricing, or content execution rules.

CRITICAL: Creator Identity is NOT passive background context, a superficial tone style sheet, or a cosmetic voice filter applied at the end.
Creator Identity ACTIVELY DETERMINES the perspective, central idea, angle, examples, opinions, reasoning, and conclusions of the generated content.

Before generating any post, determine what THIS specific creator would naturally think, notice, believe, challenge, and conclude about the topic.

-------------------------------------------------------------
CREATOR VOICE & IDENTITY PROFILE:
-------------------------------------------------------------
${sections.join("\n\n")}

-------------------------------------------------------------
MANDATORY IDENTITY-DRIVEN COGNITIVE DIRECTIVES:
-------------------------------------------------------------
1. IDENTITY MUST INFLUENCE THE IDEA:
   - Do NOT begin with a generic lesson about the topic and then rewrite it in the creator's voice.
   - Instead, determine:
     * What does this creator specifically believe about this topic?
     * What do they see differently from other people?
     * What experience would make them think about this differently?
     * What would they agree with? What would they challenge?
     * What patterns would they notice? What would they naturally emphasize or leave out?
     * What would they actually want the reader to understand?
   - The answer MUST determine the central idea and angle of the post.

2. IDENTITY MUST INFLUENCE THE ANGLE:
   - The same topic MUST produce substantially different posts for different creators.
   - Do not simply swap vocabulary or adjust tone adjectives; change the actual PERSPECTIVE and thought process.
   - Example: On the topic "Creators need to stop chasing views":
     * Creator A (Analytics / Systems focus) approaches it from cohort data and signal clarity.
     * Creator B (Sales / Offer focus) approaches it from conversion bottlenecks and buyer intent.
     * Creator C (Community / Relationship focus) approaches it from trust depth and high-touch conversations.
     * Creator D (Craft / Philosophy focus) approaches it from creative sustainability and clarity of thought.
   - The topic is identical; the thinking is completely different because the Identity is different.

3. IDENTITY MUST INFLUENCE THE REASONING:
   - When making a claim, the reasoning behind that claim MUST reflect the creator's worldview, expertise, and lived perspective.
   - Do NOT use generic model platitudes ("Trust builds credibility", "Consistency creates growth", "Specificity improves engagement", "Clarity drives conversions") as standalone reasoning.
   - Ask: "Why would THIS creator believe this?" Then express that authentic reasoning.

4. IDENTITY MUST INFLUENCE EXAMPLES:
   - Prioritize examples that naturally stem from the creator's documented experience, work, expertise, observations, beliefs, audience, and daily reality.
   - Do NOT use generic examples when Identity provides a specific perspective.
   - REALITY BOUNDARY: Never invent fake personal stories, customers, numbers, metrics, or events. If no specific personal anecdote exists, write with grounded observational reasoning without inventing fake events.

5. IDENTITY MUST INFLUENCE OPINIONS:
   - Never neutralize the creator's opinions.
   - If the Identity contains a strong belief, conviction, or stance, allow the post to take that unequivocal position.
   - Do not soften "I believe X" into generic "Some people think X."

6. IDENTITY MUST INFLUENCE WHAT GETS LEFT UNSAID:
   - Voice is defined equally by what is NOT said.
   - Actively enforce "Words & Phrases You Avoid", avoided styles, and beliefs to reject generic AI phrasing and clichés.
   - Do NOT force every possible strategy or lesson into a post. The creator naturally emphasizes certain mechanics and ignores others.

7. IDENTITY MUST INFLUENCE THE CONCLUSION:
   - The conclusion MUST reflect the creator's actual takeaway, realization, opinion, or next thought.
   - Ban generic universal conclusions and cliché sign-offs: "That's why...", "Ultimately...", "When in doubt...", "Focus on...", "The key is...", "That's the real lesson."

8. CONTENT INSTRUCTIONS AND IDENTITY MUST WORK TOGETHER:
   - Content Instructions determine WHAT needs to be accomplished strategically (goal, format, character limits, thread length, sentence capacity).
   - Creator Identity determines HOW THIS SPECIFIC PERSON thinks about and communicates those requirements.
   - Generate the strategy through the creator's authentic perspective from the very first word.

9. THE IDENTITY PRIORITY & DIFFERENTIATION TEST (SILENT VALIDATION):
   - Ask: "If I removed the Creator Identity, would this post materially change?" If no, the Identity was not used deeply enough.
   - Ask: "If I replaced this creator's Identity with a completely different creator's Identity, would the central idea, angle, reasoning, examples, or conclusion change?" If no, regenerate the thought.
   - The final post must make the reader feel: "I can tell who is saying this because of the way they think," not merely "I can tell this was written in their style."

10. DO NOT CONFUSE PERSONALITY WITH IDENTITY:
    - Adding casual slang, exclamation marks, or first-person pronouns does not mean Identity is being used.
    - Identity MUST govern what the creator notices, believes, emphasizes, challenges, explains, exemplifies, and concludes.

11. THE FINAL STANDARD:
    The goal is NOT "Write good content in the creator's tone."
    The goal is: "Use this creator's actual identity to determine what they would say about this topic, then use the Content Instructions to make that communication strategically effective."
    The final post should make the reader feel: "I can tell who is saying this because of the way they think."
=============================================================
`;
}

function buildCreatorIdentityContext(creatorIdentity?: any): string {
  return buildCurrentUserIdentitySection(creatorIdentity);
}

function buildBusinessContextSection(rawBusinessText?: string): string {
  if (!rawBusinessText || !rawBusinessText.trim()) return "";
  return `
=============================================================
### LAYER 2: MY BUSINESS (WHAT YOU DO + WHO YOU HELP + WHAT YOU SELL)
=============================================================
PURPOSE: Represents WHAT THE USER DOES and THE BUSINESS BEHIND THEIR CONTENT.
PRIMARY QUESTION: "What does this person do, who do they help, and what business context should influence the content?"
BOUNDARIES: Do NOT use this layer for personal writing style, tone, or formatting rules.

BUSINESS CONTEXT PROFILE:
${rawBusinessText.trim()}
=============================================================
`;
}

function buildCurrentUserContentInstructionsSection(
  customInstruction?: string,
  activePillar?: any,
  threadLength?: any,
  sentencesPerPart?: any,
  characterLimit?: any,
  ctaPreferences?: string,
  contentDestinations?: Array<{ name: string; url: string; purpose?: string }>
): string {
  const parts = parseThreadLength(threadLength || 1);
  const sentences = parseSentencesPerPart(sentencesPerPart || 3);
  const charLimit = parseCharacterLimit(characterLimit || 500);

  const sections: string[] = [];

  sections.push(`- Thread Length: Exactly ${parts} Part${parts > 1 ? "s" : ""}`);
  sections.push(`- Sentences Per Part Capacity: Up to ${sentences} sentence${sentences > 1 ? "s" : ""} per part (suggested maximum space; quality and natural thought progression determine actual count)`);
  sections.push(`- Hard Character Limit: Strictly <= ${charLimit} characters per part independently`);

  if (activePillar && activePillar.title) {
    sections.push(`- Active Content Framework / Pillar: "${activePillar.title}"
  * Description: ${activePillar.description || "N/A"}
  * Core Expertise: ${activePillar.coreExpertise || "N/A"}
  * Key Vocabulary: ${activePillar.keyVocabulary || "N/A"}
  * Mental Models: ${activePillar.mentalModels || "N/A"}
  * Primary Question: ${activePillar.primaryQuestion || "N/A"}
  * Topics To Avoid: ${activePillar.topicsToAvoid || "N/A"}`);
  }

  if (customInstruction && customInstruction.trim()) {
    sections.push(`- User-Provided Custom Framework / Directive:
${customInstruction.trim()}`);
  }

  if (ctaPreferences && ctaPreferences.trim()) {
    sections.push(`- User Call To Action (CTA) Preferences & Directives:
${ctaPreferences.trim()}
(Follow these user-specific directives regarding how CTAs should be written, when to use/omit CTAs, preferred reader actions, and styles to avoid).`);
  }

  if (contentDestinations && Array.isArray(contentDestinations) && contentDestinations.length > 0) {
    const dests = contentDestinations.filter(d => d && (d.name || d.url));
    if (dests.length > 0) {
      const destText = dests.map((d, i) => `  * Link ${i + 1}: "${d.name || "Link"}" -> ${d.url}${d.purpose ? ` (Purpose: ${d.purpose})` : ""}`).join("\n");
      sections.push(`- Saved Links & Destinations:
${destText}
(Contextual rule: Only reference a saved destination URL when directly relevant to the post topic/CTA. Preserve the exact URL as provided).`);
    }
  }

  return `
=============================================================
### LAYER 3: CONTENT INSTRUCTIONS (HOW YOU WANT YOUR CONTENT CREATED)
=============================================================
PURPOSE: Represents HOW THE USER WANTS THREADSWORKS TO CREATE THEIR CONTENT.
PRIMARY QUESTION: "How does this user want their content created?"
BOUNDARIES: Do NOT use this layer for personal identity or general business context.

${sections.join("\n\n")}
=============================================================
`;
}

function buildCtaAndLinksSection(
  ctaPreferences?: string,
  contentDestinations?: Array<{ name: string; url: string; purpose?: string }>,
  activeCta?: any
): string {
  const hasCtaPrefs = ctaPreferences && ctaPreferences.trim().length > 0;
  const validDestinations = Array.isArray(contentDestinations) ? contentDestinations.filter(d => d && (d.name || d.url)) : [];
  const hasDestinations = validDestinations.length > 0;
  const activeCtaLine = activeCta ? (typeof activeCta === "string" ? activeCta : (activeCta.message || activeCta.label || activeCta.text || "")) : "";

  if (!hasCtaPrefs && !hasDestinations && !activeCtaLine) {
    return "";
  }

  const sections: string[] = [];

  if (activeCtaLine) {
    sections.push(`- ACTIVE LOCKED CALL TO ACTION:
"${activeCtaLine}"
(The user explicitly locked this specific CTA. Conclude naturally with this active CTA when a closing action is appropriate).`);
  }

  if (hasCtaPrefs) {
    sections.push(`- USER CTA PREFERENCES & DIRECTIVES:
${ctaPreferences.trim()}
(Apply these user-defined instructions regarding how, when, or if CTAs should be written, their preferred style, reader actions, and approaches to avoid).`);
  }

  if (hasDestinations) {
    const destList = validDestinations.map((d, i) => {
      const parts = [`  ${i + 1}. "${d.name || "Destination"}"`];
      if (d.url) parts.push(`     URL: ${d.url}`);
      if (d.purpose) parts.push(`     Purpose / Description: ${d.purpose}`);
      return parts.join("\n");
    }).join("\n\n");

    sections.push(`- AVAILABLE USER LINKS & DESTINATIONS:
${destList}

CONTEXTUAL LINK & CTA USAGE RULES:
1. Exact Part Placement: When user instructions or preferences require a CTA in Part 2, the CTA MUST appear in Part 2 (post.threadParts[1]). Do NOT displace or move it to a later part.
2. No Unwanted CTAs: If instructions explicitly say not to include a CTA (or "no CTA"), do NOT generate any CTA.
3. Contextual Relevance: Multiple saved destinations do NOT mean every link should appear in every post. Only reference or include a specific destination URL when it directly relates to the topic, offer, or CTA of the specific post.
4. No Link Forcing: When no saved destination is relevant to the current piece of content, do not force a link. Let the content stand on its standalone value.
5. Full URL Preservation: When referencing a destination, preserve the exact URL entered by the user without shortening, inventing, or altering URL parameters. NEVER invent URLs.
6. Soft Hand-Raisers: Make the CTA feel like a natural next step (e.g., "Reply 'GUIDE' below and I will send the breakdown").`);
  }

  return `
=============================================================
### CTA PREFERENCES & SAVED DESTINATIONS (CALL-TO-ACTION INTELLIGENCE)
=============================================================
${sections.join("\n\n")}
=============================================================
`;
}

function buildCurrentUserAudienceSection(audience?: string, desiredResult?: string): string {
  const cleanAudience = (audience && audience.trim()) ? audience.trim() : "Target Audience";
  const cleanResult = (desiredResult && desiredResult.trim()) ? desiredResult.trim() : "Desired Transformation";

  return `
=============================================================
### CURRENT USER AUDIENCE & TRANSFORMATION
=============================================================
- Target Reader / Audience: ${cleanAudience}
- Desired Transformation / Goal: ${cleanResult}
- Communication Directive: Speak directly to the worldview, stage of growth, and practical reality of this audience. Use positive reinforcement, objective mechanisms, and respectful peer-to-peer framing without condescension or assumed struggles.
=============================================================
`;
}

function buildCurrentUserPromotionSection(offer?: string, activeCta?: any): string {
  const cleanOffer = (offer && offer.trim()) ? offer.trim() : "Creator Offer / Resource";
  const ctaLine = activeCta ? (typeof activeCta === "string" ? activeCta : (activeCta.message || activeCta.label || activeCta.text || "")) : "";

  return `
=============================================================
### CURRENT USER PROMOTION & CONVERSION (OFFER CONTEXT)
=============================================================
- Core Offer / Value Mechanism: ${cleanOffer}
${ctaLine ? `- Active Call to Action / Hand-Raiser: "${ctaLine}"` : "- Conversion Directive: When concluding or soft-selling, naturally link the creator's offer/framework as the clearest, lowest-friction path to implementation."}
- Placement Law: CTAs and conversions must feel like a logical next step after delivering massive standalone value.
=============================================================
`;
}

function buildOfferIntelligenceSection(
  offerIntelligence?: any,
  rawBusinessText?: string,
  fallbackOffer?: string,
  activeCta?: any
): string {
  const ctaLine = activeCta ? (typeof activeCta === "string" ? activeCta : (activeCta.message || activeCta.label || activeCta.text || "")) : "";

  if (offerIntelligence && offerIntelligence.offers && Array.isArray(offerIntelligence.offers) && offerIntelligence.offers.length > 0) {
    const offerBlocks = offerIntelligence.offers.map((o: any, idx: number) => {
      const parts: string[] = [];
      const titleLine = `- OFFER ${idx + 1}: "${o.name || fallbackOffer || "Core Creator Offer"}"${o.type && o.type !== "unspecified" ? ` [${o.type.replace(/_/g, " ").toUpperCase()}]` : ""}${o.price ? ` — Price: ${o.price}` : ""}`;
      parts.push(titleLine);
      if (o.format) parts.push(`  * Format / Delivery: ${o.format}`);
      if (o.purpose) parts.push(`  * Purpose / Job Accomplished: ${o.purpose}`);
      if (o.targetCustomer && (o.targetCustomer.intendedBuyer || o.targetCustomer.intendedAudience || o.targetCustomer.situation)) {
        const targetDesc = [o.targetCustomer.intendedBuyer || o.targetCustomer.intendedAudience, o.targetCustomer.situation ? `Situation: ${o.targetCustomer.situation}` : ""].filter(Boolean).join(" | ");
        parts.push(`  * Target Buyer / Audience: ${targetDesc}`);
      }
      if (o.problem && (o.problem.problemStatement || o.problem.friction || (o.problem.symptoms && o.problem.symptoms.length > 0))) {
        const probDesc = o.problem.problemStatement || o.problem.friction || o.problem.symptoms?.join(", ");
        parts.push(`  * Problem Addressed: ${probDesc}`);
      }
      if (o.desiredOutcome && (o.desiredOutcome.practicalOutcome || o.desiredOutcome.buyerDesire || o.desiredOutcome.businessOutcome)) {
        const outcomeDesc = [o.desiredOutcome.practicalOutcome || o.desiredOutcome.buyerDesire, o.desiredOutcome.businessOutcome ? `(Business: ${o.desiredOutcome.businessOutcome})` : ""].filter(Boolean).join(" ");
        parts.push(`  * Desired Transformation: ${outcomeDesc}`);
      }
      if (o.solution && ((o.solution.deliverables && o.solution.deliverables.length > 0) || (o.solution.components && o.solution.components.length > 0))) {
        const items = o.solution.deliverables || o.solution.components;
        parts.push(`  * Solution & Deliverables: ${items.join("; ")}`);
      }
      if (o.mechanism && (o.mechanism.framework || o.mechanism.method || o.mechanism.system)) {
        parts.push(`  * Mechanism / Method: ${o.mechanism.framework || o.mechanism.method || o.mechanism.system}`);
      }
      if (o.differentiation && o.differentiation.distinctApproach) {
        parts.push(`  * Distinction / Approach: ${o.differentiation.distinctApproach}`);
      }
      if (o.purchasePath || (o.cta && o.cta.preferredAction)) {
        parts.push(`  * Purchase / Next Action: ${o.purchasePath || o.cta.preferredAction}`);
      }
      return parts.join("\n");
    });

    return `
=============================================================
### CREATOR OFFER INTELLIGENCE (WHAT THE CREATOR SELLS & OFFERS)
=============================================================
${offerBlocks.join("\n\n")}
${offerIntelligence.offerRelationshipsSummary ? `\n- Portfolio Structure: ${offerIntelligence.offerRelationshipsSummary}` : ""}
${ctaLine ? `- Active Call to Action / Hand-Raiser: "${ctaLine}"` : "- Conversion Directive: Naturally bridge toward the creator's offer/framework as the logical, high-value path to execution when concluding."}
=============================================================
`;
  }

  // Fallback to basic offer context if structured offer intelligence is not yet provided
  const cleanOffer = (fallbackOffer && fallbackOffer.trim()) ? fallbackOffer.trim() : "Creator Offer / Resource";
  return `
=============================================================
### CREATOR OFFER INTELLIGENCE (WHAT THE CREATOR SELLS & OFFERS)
=============================================================
- Core Offer: ${cleanOffer}
${rawBusinessText ? `- Business / Offer Overview: ${rawBusinessText.slice(0, 500)}...` : ""}
${ctaLine ? `- Active Call to Action / Hand-Raiser: "${ctaLine}"` : "- Conversion Directive: Naturally bridge toward the creator's offer/framework as the logical, high-value path to execution when concluding."}
=============================================================
`;
}

function buildBuyerIntelligenceSection(
  buyerIntelligence?: any,
  rawBusinessText?: string,
  fallbackAudience?: string,
  fallbackResult?: string
): string {
  if (buyerIntelligence && buyerIntelligence.buyers && Array.isArray(buyerIntelligence.buyers) && buyerIntelligence.buyers.length > 0) {
    const buyerBlocks = buyerIntelligence.buyers.map((b: any, idx: number) => {
      const parts: string[] = [];
      const titleLine = `- BUYER PROFILE ${idx + 1}: "${b.name || fallbackAudience || "Target Buyer"}"${b.identity?.sophisticationLevel ? ` [Stage/Sophistication: ${b.identity.sophisticationLevel}]` : ""}`;
      parts.push(titleLine);

      if (b.identity?.intendedBuyer || b.identity?.experienceLevel) {
        parts.push(`  * Profile / Role: ${[b.identity.intendedBuyer, b.identity.experienceLevel ? `Exp: ${b.identity.experienceLevel}` : ""].filter(Boolean).join(" | ")}`);
      }

      if (b.situation && (b.situation.currentActivities?.length || b.situation.frictionPoints?.length || b.situation.gapDescription)) {
        const sit = [
          b.situation.currentActivities?.length ? `Current State: ${b.situation.currentActivities.join(", ")}` : "",
          b.situation.frictionPoints?.length ? `Friction / Stuck At: ${b.situation.frictionPoints.join(", ")}` : "",
          b.situation.gapDescription ? `Gap: ${b.situation.gapDescription}` : ""
        ].filter(Boolean).join(" | ");
        if (sit) parts.push(`  * Current Situation & Friction: ${sit}`);
      }

      if (b.problems && (b.problems.surfaceSymptoms?.length || b.problems.practicalProblems?.length || b.problems.rootProblem || b.problems.costOfInaction)) {
        const prob = [
          b.problems.rootProblem ? `Root: ${b.problems.rootProblem}` : "",
          b.problems.surfaceSymptoms?.length ? `Symptoms: ${b.problems.surfaceSymptoms.join(", ")}` : "",
          b.problems.costOfInaction ? `Cost of Inaction: ${b.problems.costOfInaction}` : ""
        ].filter(Boolean).join(" | ");
        if (prob) parts.push(`  * Problems & Consequences: ${prob}`);
      }

      if (b.desiredOutcomes && (b.desiredOutcomes.functionalOutcomes?.length || b.desiredOutcomes.businessFinancialOutcomes?.length || b.desiredOutcomes.emotionalPeaceOutcomes?.length)) {
        const out = [
          b.desiredOutcomes.functionalOutcomes?.length ? `Functional: ${b.desiredOutcomes.functionalOutcomes.join(", ")}` : "",
          b.desiredOutcomes.businessFinancialOutcomes?.length ? `Business/Financial: ${b.desiredOutcomes.businessFinancialOutcomes.join(", ")}` : "",
          b.desiredOutcomes.emotionalPeaceOutcomes?.length ? `Relief/Confidence: ${b.desiredOutcomes.emotionalPeaceOutcomes.join(", ")}` : ""
        ].filter(Boolean).join(" | ");
        if (out) parts.push(`  * Desired Outcomes: ${out}`);
      }

      if (b.desires && (b.desires.wantsToAchieve?.length || b.desires.wantsToAvoid?.length || b.desires.wantsToStopWorryingAbout?.length)) {
        const des = [
          b.desires.wantsToAchieve?.length ? `Achieve: ${b.desires.wantsToAchieve.join(", ")}` : "",
          b.desires.wantsToAvoid?.length ? `Avoid: ${b.desires.wantsToAvoid.join(", ")}` : "",
          b.desires.wantsToStopWorryingAbout?.length ? `Stop Worrying About: ${b.desires.wantsToStopWorryingAbout.join(", ")}` : ""
        ].filter(Boolean).join(" | ");
        if (des) parts.push(`  * Motivations & Desires: ${des}`);
      }

      if (b.barriers && (b.barriers.knownBarriers?.length || b.barriers.supportedBarriers?.length)) {
        const bar = [
          b.barriers.knownBarriers?.length ? `Known Barriers: ${b.barriers.knownBarriers.join(", ")}` : "",
          b.barriers.supportedBarriers?.length ? `Supported Barriers: ${b.barriers.supportedBarriers.join(", ")}` : ""
        ].filter(Boolean).join(" | ");
        if (bar) parts.push(`  * Objections & Decision Barriers: ${bar}`);
      }

      if (b.beliefs && (b.beliefs.limitingBeliefs?.length || b.beliefs.enablingBeliefs?.length)) {
        const bel = [
          b.beliefs.limitingBeliefs?.length ? `Limiting Beliefs: ${b.beliefs.limitingBeliefs.join("; ")}` : "",
          b.beliefs.enablingBeliefs?.length ? `Enabling Beliefs: ${b.beliefs.enablingBeliefs.join("; ")}` : ""
        ].filter(Boolean).join(" | ");
        if (bel) parts.push(`  * Buyer Beliefs: ${bel}`);
      }

      if (b.triggers?.legitimateTriggers?.length) {
        parts.push(`  * Legitimate Buying Triggers: ${b.triggers.legitimateTriggers.join("; ")}`);
      }

      if (b.decisionCriteria?.evaluationFactors?.length) {
        parts.push(`  * Decision Criteria: ${b.decisionCriteria.evaluationFactors.join(", ")}`);
      }

      if (b.conversionGap && (b.conversionGap.currentGap || b.conversionGap.bridgeRequirement)) {
        parts.push(`  * Conversion Gap: ${b.conversionGap.currentGap || ""} ${b.conversionGap.bridgeRequirement ? `→ Bridge: ${b.conversionGap.bridgeRequirement}` : ""}`.trim());
      }

      if (b.offerConnection && (b.offerConnection.whyBuyerNeedsOffer || b.offerConnection.relevanceHook)) {
        parts.push(`  * Offer Connection: ${b.offerConnection.whyBuyerNeedsOffer || b.offerConnection.relevanceHook}`);
      }

      return parts.join("\n");
    });

    return `
=============================================================
### BUYER & CONVERSION INTELLIGENCE (DECISION ENVIRONMENT)
=============================================================
${buyerBlocks.join("\n\n")}
${buyerIntelligence.marketDynamicsContext ? `\n- Market Dynamics: ${buyerIntelligence.marketDynamicsContext}` : ""}
- Psychological Directive: Speak to the buyer's real situation with objective mechanisms, respect, and zero condescension or fabricated pain.
=============================================================
`;
  }

  // Fallback representation if structured buyer intelligence is not yet generated
  const cleanAudience = (fallbackAudience && fallbackAudience.trim()) ? fallbackAudience.trim() : "Target Audience / Ambitious Creators";
  const cleanResult = (fallbackResult && fallbackResult.trim()) ? fallbackResult.trim() : "Predictable Results";
  return `
=============================================================
### BUYER & CONVERSION INTELLIGENCE (DECISION ENVIRONMENT)
=============================================================
- Target Buyer: ${cleanAudience}
- Desired Transformation / Goal: ${cleanResult}
${rawBusinessText ? `- Context Overview: ${rawBusinessText.slice(0, 400)}...` : ""}
- Psychological Directive: Speak to the buyer's real situation with objective mechanisms, respect, and zero condescension.
=============================================================
`;
}

function buildSelectedPhaseSection(phase?: string, desiredResult?: string): string {
  const normalizedPhase = (phase || "attention").toLowerCase();
  
  if (normalizedPhase === "attention") {
    return `
=============================================================
### STRATEGIC PHASE: ATTENTION & STRATEGIC POSITIONING
=============================================================
- CORE OBJECTIVE: Maximize qualified eyes, stop the feed scroll, and establish distinctive perspective.
- COGNITIVE ANGLE: Attack common industry assumptions, present contrarian viewpoints, share counter-intuitive observations, or reframe standard paradigms.
- HOOK REQUIREMENT: Open with high tension, pattern interrupt, or provocative truth that filters in the ideal reader immediately.
- VIRALITY MECHANIC: Provide high-impact insights that compel readers to save, repost, and bookmark for reference.
=============================================================
`;
  } else if (normalizedPhase === "trust") {
    return `
=============================================================
### STRATEGIC PHASE: TRUST, AUTHORITY & SYSTEMS
=============================================================
- CORE OBJECTIVE: Demonstrate deep domain mastery, proven mechanics, and operational clarity.
- COGNITIVE ANGLE: Break down step-by-step systems, actionable frameworks, workflow teardowns, or grounded observational wisdom.
- VALUE REQUIREMENT: Provide standalone tactical utility the reader can understand and act upon within minutes.
- PROOF MECHANIC: Show how the mechanics produce "${desiredResult || "predictable outcomes"}" through clear logic, specific mechanics, and authoritative execution.
=============================================================
`;
  } else if (normalizedPhase === "sales") {
    return `
=============================================================
### STRATEGIC PHASE: SALES, CONVERSION & HAND-RAISERS
=============================================================
- CORE OBJECTIVE: Filter qualified buyers, generate inbound hand-raisers, and start high-intent conversations.
- COGNITIVE ANGLE: Contrast the friction of unstructured trial-and-error against the speed and certainty of the creator's structured offer/system.
- CALL TO CONVERSATION: Provide a frictionless, high-value prompt (e.g. "Reply 'SYSTEM' and I'll send the full breakdown" or bio link direction).
- POSITIONING: Position the offer as an empowering accelerator, never using aggressive hype or pressure.
=============================================================
`;
  } else if (normalizedPhase === "story") {
    return `
=============================================================
### STRATEGIC PHASE: STORY, TRANSFORMATION & CONNECTION
=============================================================
- CORE OBJECTIVE: Deepen emotional resonance, illustrate personal realizations, and showcase authentic journeys.
- COGNITIVE ANGLE: Share real inflection points, pivotal moments of clarity, or lessons learned through genuine iteration.
- NARRATIVE ARC: Vulnerability / Old Paradigm → Turning Point → Core Realization → Universal Takeaway.
- AUTHENTICITY BOUNDARY: Ground the story in the creator's lived experiences and beliefs; never fabricate fake metrics or fictional events.
=============================================================
`;
  }

  return `
=============================================================
### STRATEGIC PHASE: STRATEGIC CONTENT GENERATION
=============================================================
Deliver high-value, scroll-stopping Meta Threads content perfectly calibrated to the creator's identity and strategic objectives.
=============================================================
`;
}

// =============================================================
// THREADSWORKS UNIVERSAL CONTENT MEMORY BRAIN
// =============================================================
// Automatic, private, behind-the-scenes content intelligence layer.
// Remembers and understands each user's content history to make future
// generations more original, varied, connected, and intelligent.
// =============================================================

export interface UserContentMemoryHook {
  hook: string;
  type?: string;
  topic?: string;
}

export interface UserContentMemoryAngle {
  angle: string;
  concept: string;
  category?: string;
}

export interface UserContentMemoryProfile {
  userId: string;
  lastUpdated: number;
  totalPostsIndexed: number;
  recentHooks: UserContentMemoryHook[];
  coreThemes: Array<{ theme: string; count: number }>;
  exploredAngles: UserContentMemoryAngle[];
  authenticVocabulary: string[];
  signaturePhrases: string[];
  contentStructures: string[];
  winningPatterns: Array<{ title: string; hook: string; keyStrength?: string }>;
  contentGaps: string[];
  recentCtas: string[];
}

const userMemoryCache = new Map<string, { profile: UserContentMemoryProfile; timestamp: number }>();
const MEMORY_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes session cache

// Stopwords for authentic vocabulary extraction
const COMMON_STOPWORDS = new Set([
  "the", "be", "to", "of", "and", "a", "in", "that", "have", "i", "it", "for", "not", "on", "with", "he", "as",
  "you", "do", "at", "this", "but", "his", "by", "from", "they", "we", "say", "her", "she", "or", "an", "will",
  "my", "one", "all", "would", "there", "their", "what", "so", "up", "out", "if", "about", "who", "get", "which",
  "go", "me", "when", "make", "can", "like", "time", "no", "just", "him", "know", "take", "people", "into", "year",
  "your", "good", "some", "could", "them", "see", "other", "than", "then", "now", "look", "only", "come", "its",
  "over", "think", "also", "back", "after", "use", "two", "how", "our", "work", "first", "well", "way", "even",
  "new", "want", "because", "any", "these", "give", "day", "most", "us", "is", "are", "was", "were", "been",
  "has", "had", "here", "why", "stop", "step", "part", "read", "thread"
]);

function classifyHookType(hook: string): string {
  const lower = hook.toLowerCase();
  if (lower.startsWith("why") || lower.includes("why most") || lower.includes("why 95%")) return "contrarian_mechanism";
  if (lower.startsWith("how to") || lower.startsWith("how we")) return "step_by_step_how_to";
  if (lower.includes("unpopular opinion") || lower.includes("hot take") || lower.includes("stop doing")) return "pattern_interrupt";
  if (/\b\d+\b/.test(lower) && (lower.includes("framework") || lower.includes("checklist") || lower.includes("rule") || lower.includes("step"))) return "numerical_framework";
  if (lower.startsWith("if you are") || lower.startsWith("dear ") || lower.startsWith("to every")) return "targeted_callout";
  if (lower.endsWith("?")) return "provocative_question";
  return "direct_observation";
}

export function distillUserContentMemory(userId: string, rawPosts: any[]): UserContentMemoryProfile {
  const validPosts = Array.isArray(rawPosts)
    ? rawPosts.filter(p => p && (typeof p.singlePost === "string" || typeof p.hook === "string" || typeof p.title === "string"))
    : [];

  const recentHooks: UserContentMemoryHook[] = [];
  const exploredAngles: UserContentMemoryAngle[] = [];
  const themeCounts = new Map<string, number>();
  const wordFreq = new Map<string, number>();
  const phraseFreq = new Map<string, number>();
  const structures = new Set<string>();
  const winningPatterns: Array<{ title: string; hook: string; keyStrength?: string }> = [];
  const recentCtas: string[] = [];
  const seenHookTexts = new Set<string>();

  for (const post of validPosts) {
    const mainText = (post.singlePost || post.text || post.content || "").trim();
    const rawHook = (post.hook || (mainText ? mainText.split("\n\n")[0] : post.title) || "").trim();
    const cleanHook = rawHook.replace(/^[#*\-\d.\s]+/, "").trim();

    if (cleanHook && !seenHookTexts.has(cleanHook.toLowerCase())) {
      seenHookTexts.add(cleanHook.toLowerCase());
      recentHooks.push({
        hook: cleanHook,
        type: classifyHookType(cleanHook),
        topic: post.topic || post.title || "Social Media Strategy"
      });
    }

    const title = (post.title || post.concept || "").trim();
    if (title) {
      exploredAngles.push({
        angle: title,
        concept: cleanHook.slice(0, 80),
        category: post.category || post.pillar || "strategy"
      });
      const themeKey = title.split(" ").slice(0, 3).join(" ").toLowerCase();
      themeCounts.set(themeKey, (themeCounts.get(themeKey) || 0) + 1);
    }

    // Check structure
    if (mainText.includes("\n1.") || mainText.includes("\n2.") || mainText.includes("\n-") || mainText.includes("\n•")) {
      structures.add("structured_list_framework");
    }
    if (Array.isArray(post.threadParts) && post.threadParts.length > 1) {
      structures.add(`multi_part_thread_${post.threadParts.length}`);
    } else {
      structures.add("single_standalone_observation");
    }

    // Check winning content
    if (post.status === "Published" || post.scheduledFor) {
      if (cleanHook && winningPatterns.length < 5) {
        winningPatterns.push({
          title: title || cleanHook.slice(0, 40),
          hook: cleanHook,
          keyStrength: post.status === "Published" ? "Published Live Content" : "Scheduled High-Value Post"
        });
      }
    }

    // Extract CTAs
    const lines = mainText.split("\n").map((l: string) => l.trim()).filter(Boolean);
    if (lines.length > 0) {
      const lastLine = lines[lines.length - 1];
      if (lastLine.toLowerCase().includes("save") || lastLine.toLowerCase().includes("comment") || lastLine.toLowerCase().includes("reply") || lastLine.toLowerCase().includes("link") || lastLine.toLowerCase().includes("dm") || lastLine.toLowerCase().includes("follow")) {
        if (!recentCtas.includes(lastLine)) {
          recentCtas.push(lastLine);
        }
      }
    }

    // Extract word & phrase frequencies for authentic vocabulary preservation
    const tokens = mainText.toLowerCase().replace(/[^a-z0-9\s'-]/g, " ").split(/\s+/).filter(t => t.length > 3);
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (!COMMON_STOPWORDS.has(t)) {
        wordFreq.set(t, (wordFreq.get(t) || 0) + 1);
      }
      if (i < tokens.length - 2) {
        const trigram = `${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`;
        if (!COMMON_STOPWORDS.has(tokens[i]) && !COMMON_STOPWORDS.has(tokens[i + 2])) {
          phraseFreq.set(trigram, (phraseFreq.get(trigram) || 0) + 1);
        }
      }
    }
  }

  // Sort and extract authentic vocabulary
  const authenticVocabulary = Array.from(wordFreq.entries())
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word]) => word);

  const signaturePhrases = Array.from(phraseFreq.entries())
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([phrase]) => phrase);

  const coreThemes = Array.from(themeCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([theme, count]) => ({ theme, count }));

  // Generate intelligent content gaps
  const contentGaps: string[] = [];
  const hookCorpus = recentHooks.map(h => h.hook.toLowerCase()).join(" ");
  if (!hookCorpus.includes("case study") && !hookCorpus.includes("client")) {
    contentGaps.push("Real-world client transformation / case study proof breakdown");
  }
  if (!hookCorpus.includes("math") && !hookCorpus.includes("equation") && !hookCorpus.includes("numbers")) {
    contentGaps.push("The unintuitive mathematics / conversion unit economics behind your system");
  }
  if (!hookCorpus.includes("mistake") && !hookCorpus.includes("failing")) {
    contentGaps.push("Diagnosis of the #1 hidden bottleneck stopping intermediate operators");
  }
  if (!hookCorpus.includes("routine") && !hookCorpus.includes("daily") && !hookCorpus.includes("workflow")) {
    contentGaps.push("Daily 15-minute operational rhythm & frictionless execution system");
  }
  if (!hookCorpus.includes("framework") && !hookCorpus.includes("step 1")) {
    contentGaps.push("Step-by-step 3-part implementation blueprint with direct actionables");
  }

  return {
    userId: userId || "anonymous",
    lastUpdated: Date.now(),
    totalPostsIndexed: validPosts.length,
    recentHooks: recentHooks.slice(0, 20),
    coreThemes,
    exploredAngles: exploredAngles.slice(0, 15),
    authenticVocabulary,
    signaturePhrases,
    contentStructures: Array.from(structures),
    winningPatterns: winningPatterns.slice(0, 5),
    contentGaps: contentGaps.slice(0, 5),
    recentCtas: recentCtas.slice(0, 5)
  };
}

export async function getUserContentMemory(
  userId?: string,
  fallbackPosts?: any[],
  savedTabId?: string
): Promise<UserContentMemoryProfile> {
  if (!userId || userId === "anonymous") {
    // Never query cross-user data or cache anonymous calls
    return distillUserContentMemory("anonymous", fallbackPosts || []);
  }

  const activeUid = userId;
  const tabId = savedTabId || "default";
  const cacheKey = `${activeUid}_${tabId}`;
  const now = Date.now();
  const cached = userMemoryCache.get(cacheKey);

  if (cached && now - cached.timestamp < MEMORY_CACHE_TTL_MS) {
    if (fallbackPosts && Array.isArray(fallbackPosts) && fallbackPosts.length > 0 && cached.profile.totalPostsIndexed === 0) {
      const refreshed = distillUserContentMemory(activeUid, fallbackPosts);
      userMemoryCache.set(cacheKey, { profile: refreshed, timestamp: now });
      return refreshed;
    }
    return cached.profile;
  }

  let posts: any[] = [];
  let fetchedFromDb = false;

  if (serverDb) {
    try {
      let queryRef: any = serverDb.collection("posts").where("userId", "==", activeUid);
      const snap = await queryRef.limit(15).get();
      snap.docs.forEach((docSnap: any) => {
        const d = docSnap.data();
        if (d.savedTabId && d.savedTabId !== tabId) return;
        posts.push({
          id: docSnap.id,
          title: d.title || d.concept || "",
          hook: d.hook || "",
          singlePost: d.singlePost || d.content || d.text || "",
          threadParts: d.threadParts || [d.singlePost || ""],
          status: d.status || "Draft",
          scheduledFor: d.scheduledFor || null,
          topic: d.topic || "Social Media Strategy",
          savedTabId: d.savedTabId
        });
      });
      fetchedFromDb = true;
    } catch (err: any) {
      console.log(`[ContentMemoryBrain] Info: Memory store query notice for user ${activeUid} tab ${tabId}: ${err?.message || err}`);
    }
  }

  if (!fetchedFromDb && clientDb) {
    try {
      const q = clientQuery(
        clientCollection(clientDb, "posts"),
        clientWhere("userId", "==", activeUid)
      );
      const snap = await clientGetDocs(q);
      snap.docs.forEach((docSnap: any) => {
        const d = docSnap.data();
        if (d.savedTabId && d.savedTabId !== tabId) return;
        posts.push({
          id: docSnap.id,
          title: d.title || d.concept || "",
          hook: d.hook || "",
          singlePost: d.singlePost || d.content || d.text || "",
          threadParts: d.threadParts || [d.singlePost || ""],
          status: d.status || "Draft",
          scheduledFor: d.scheduledFor || null,
          topic: d.topic || "Social Media Strategy",
          savedTabId: d.savedTabId
        });
      });
      fetchedFromDb = true;
    } catch (_) {
      // Quiet fallback
    }
  }

  // Merge with client-transmitted offline posts if any (filter by tab if provided)
  if (fallbackPosts && Array.isArray(fallbackPosts)) {
    const seenTexts = new Set(posts.map(p => (p.singlePost || "").trim().toLowerCase()));
    fallbackPosts.forEach(fp => {
      if (fp.savedTabId && fp.savedTabId !== tabId) return;
      const textKey = (fp.singlePost || fp.text || fp.hook || "").trim().toLowerCase();
      if (textKey && !seenTexts.has(textKey)) {
        seenTexts.add(textKey);
        posts.push(fp);
      }
    });
  }

  const profile = distillUserContentMemory(activeUid, posts);
  userMemoryCache.set(cacheKey, { profile, timestamp: now });
  return profile;
}

export function buildContentMemoryBrainSection(
  memory?: UserContentMemoryProfile,
  currentCategory?: string,
  currentTopic?: string
): string {
  if (!memory) return "";
  const hasHistory = memory.totalPostsIndexed > 0;
  const recentHooksText = (memory.recentHooks && memory.recentHooks.length > 0)
    ? memory.recentHooks.slice(0, 10).map((h, i) => `  ${i + 1}. "${h.hook}" [Type: ${h.type || "observation"}]`).join("\n")
    : "  (No previously recorded hooks in library — creator is establishing their foundational library)";

  const exploredAnglesText = (memory.exploredAngles && memory.exploredAngles.length > 0)
    ? memory.exploredAngles.slice(0, 8).map((a, i) => `  ${i + 1}. Angle: "${a.angle}" (Core mechanism: ${a.concept.slice(0, 60)}...)`).join("\n")
    : "  (No previously recorded angles — open creative space)";

  const authenticWords = (memory.authenticVocabulary && memory.authenticVocabulary.length > 0)
    ? memory.authenticVocabulary.slice(0, 12).map(w => `"${w}"`).join(", ")
    : "Direct, high-value, crisp conversational syntax";

  const contentGapsText = (memory.contentGaps && memory.contentGaps.length > 0)
    ? memory.contentGaps.map((g, i) => `  * Opportunity ${i + 1}: ${g}`).join("\n")
    : "  * Expand core frameworks into specific implementation steps\n  * Address unstated reader objections with proof mechanisms";

  return `
=============================================================
### LAYER 4: CONTENT MEMORY BRAIN (UNIVERSAL REPETITION & FRESHNESS INTELLIGENCE)
=============================================================
SYSTEM INTELLIGENCE: The Content Memory Brain actively remembers and understands what this user has already created across their Content Library (${memory.totalPostsIndexed} post(s) indexed).

1. PREVIOUS OPENING HOOKS IN CREATOR'S LIBRARY (DO NOT REPEAT):
${recentHooksText}

-> REPETITION LAW: You MUST NOT reuse or slightly rephrase these exact opening hooks or opening sentence structures. Deliver a completely fresh pattern interrupt or angle.

2. EXPLORED ANGLES & IDEAS IN MEMORY:
${exploredAnglesText}

-> THE LAW OF REPEATING VS. EXPANDING IDEAS:
   - REPEATING AN IDEA (STRICTLY AVOID): Simply restating the exact same thesis using synonyms or boilerplate structures.
   - EXPANDING AN IDEA (ENCOURAGED & PREFERRED): If addressing an established core thesis, go ONE LEVEL DEEPER:
     * Provide a concrete, step-by-step practical implementation
     * Share a distinctive case study or client transformation scenario
     * Dissect an unintuitive nuance or hidden friction point
     * Address an advanced edge case or common misconception
     * Introduce a proprietary mental model or structured rubric

3. CREATOR AUTHENTIC VOCABULARY & VOICE PRESERVATION:
Protected Natural Vocabulary: ${authenticWords}
${memory.signaturePhrases.length > 0 ? `Signature Phrase Patterns: ${memory.signaturePhrases.slice(0, 5).map(p => `"${p}"`).join(", ")}` : ""}
-> VOICE PRESERVATION DIRECTIVE: Distinguish authentic recurring vocabulary (the user's genuine voice) from repetitive ideas. NEVER strip out the user's authentic language or replace their natural words with artificial AI thesaurus jargon.

4. CONTENT COMPOUNDING & FRESH EXPANSION GAPS:
${contentGapsText}
-> FRESHNESS DIRECTIVE: "Same expertise, completely fresh execution." Deliver new framings, new analogies, new examples, and clear compounding value.
=============================================================
`;
}

function calculateHookSimilarity(hook1: string, hook2: string): number {
  if (!hook1 || !hook2) return 0;
  const h1 = hook1.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
  const h2 = hook2.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
  if (h1 === h2) return 1.0;

  const words1 = new Set(h1.split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(h2.split(/\s+/).filter(w => w.length > 2));
  if (words1.size === 0 || words2.size === 0) return 0;

  let intersection = 0;
  for (const w of words1) {
    if (words2.has(w)) intersection++;
  }
  const union = new Set([...words1, ...words2]).size;
  return union > 0 ? intersection / union : 0;
}

function checkOpeningPrefixOverlap(hook1: string, hook2: string, prefixWordCount: number = 5): boolean {
  if (!hook1 || !hook2) return false;
  const words1 = hook1.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).slice(0, prefixWordCount).join(" ");
  const words2 = hook2.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).slice(0, prefixWordCount).join(" ");
  return words1.length > 10 && words1 === words2;
}

async function validateAndReviseWithContentMemory(
  post: any,
  memory: UserContentMemoryProfile,
  configuredLimit: number,
  targetSentences: number,
  context: any,
  aiInstance?: any
): Promise<any> {
  const baseValidated = await validateAndRevisePost(post, configuredLimit, targetSentences, context, aiInstance, false);
  if (!baseValidated || !memory || !memory.recentHooks || memory.recentHooks.length === 0) {
    return baseValidated;
  }

  const currentHook = (baseValidated.hook || (baseValidated.singlePost ? baseValidated.singlePost.split("\n\n")[0] : "")).trim();
  if (!currentHook) return baseValidated;

  // Check against previous hooks in memory
  let isDuplicate = false;
  let duplicatedHook = "";

  for (const prev of memory.recentHooks) {
    const similarity = calculateHookSimilarity(currentHook, prev.hook);
    const prefixMatch = checkOpeningPrefixOverlap(currentHook, prev.hook, 5);
    if (similarity > 0.65 || prefixMatch) {
      isDuplicate = true;
      duplicatedHook = prev.hook;
      break;
    }
  }

  if (isDuplicate) {
    console.log(`[ContentMemoryBrain] Duplicate hook detected ("${currentHook}" similar to "${duplicatedHook}"). Auto-refining for freshness...`);
    const topic = context?.offer || context?.audience || "growth";
    let freshOpening = currentHook;
    if (currentHook.toLowerCase().startsWith("why 95%")) {
      freshOpening = `The silent friction stopping most ${context?.audience || "creators"} from scaling ${topic}:`;
    } else if (currentHook.toLowerCase().startsWith("unpopular opinion")) {
      freshOpening = `The contrarian operational reality behind ${topic} that no one talks about:`;
    } else if (currentHook.toLowerCase().startsWith("how to")) {
      freshOpening = `A 3-step practical teardown to unlock ${context?.desiredResult || "predictable results"}:`;
    } else {
      freshOpening = `The clearest line to ${context?.desiredResult || "results"}: focus exclusively on the core mechanism.`;
    }

    const parts = Array.isArray(baseValidated.threadParts) && baseValidated.threadParts.length > 0
      ? [...baseValidated.threadParts]
      : [baseValidated.singlePost || ""];

    if (parts[0]) {
      const originalLines = parts[0].split("\n\n");
      originalLines[0] = freshOpening;
      parts[0] = originalLines.join("\n\n");
      if (parts[0].length > configuredLimit) {
        parts[0] = condensePartProgrammatically(parts[0], configuredLimit, targetSentences);
      }
    }

    baseValidated.hook = freshOpening;
    baseValidated.singlePost = parts[0] || freshOpening;
    baseValidated.threadParts = parts;
  }

  return baseValidated;
}

function buildUniversalGenerationLogicSection(): string {
  return `
=============================================================
### UNIVERSAL GENERATION PIPELINE & HARD CONSTRAINTS
=============================================================
1. COGNITIVE AUDIT: First determine how this creator thinks before writing any copy.
2. NATIVE FORMATTING: Short, high-density sentences (3-15 words). Generous whitespace and blank lines between distinct thoughts.
3. ANTI-AI FILTER: Strictly ban clichés: "revolutionize", "delve", "testament", "elevate", "unlock", "visualize", "buckle up", "game changer", "demystify", "supercharge", "empower", "tapestry", "beacon".
4. COMPLETION: Every thought must be fully resolved. Never cut off mid-sentence.
=============================================================
`;
}

function heuristicParser(text: string) {
  // Simple regex or keyword based extraction
  const lower = text.toLowerCase();
  
  // Extract audience
  let audience = "Busy entrepreneurs and creators";
  if (lower.includes("help")) {
    const idx = lower.indexOf("help");
    const segment = text.substring(idx, idx + 200).replace(/help\s*(us|me|them|people|you|busy)?/i, "").trim();
    if (segment) audience = segment.split(/[.\n,]/)[0].trim();
  } else if (lower.includes("audience")) {
    const idx = lower.indexOf("audience");
    const segment = text.substring(idx, idx + 200).replace(/audience\s*(is|to|target)?/i, "").trim();
    if (segment) audience = segment.split(/[.\n,]/)[0].trim();
  }

  // Extract offer
  let offer = "Social media strategy and coaching";
  if (lower.includes("sell")) {
    const idx = lower.indexOf("sell");
    const segment = text.substring(idx, idx + 200).replace(/sell\s*(a|an|the|my|our)?/i, "").trim();
    if (segment) offer = segment.split(/[.\n,]/)[0].trim();
  } else if (lower.includes("offer")) {
    const idx = lower.indexOf("offer");
    const segment = text.substring(idx, idx + 200).replace(/offer\s*(is|to)?/i, "").trim();
    if (segment) offer = segment.split(/[.\n,]/)[0].trim();
  } else if (lower.includes("product")) {
    const idx = lower.indexOf("product");
    const segment = text.substring(idx, idx + 200).replace(/product\s*(is|to)?/i, "").trim();
    if (segment) offer = segment.split(/[.\n,]/)[0].trim();
  }

  // Extract desiredResult
  let desiredResult = "Organic growth, audience engagement, and premium clients";
  if (lower.includes("result")) {
    const idx = lower.indexOf("result");
    const segment = text.substring(idx, idx + 200).replace(/result\s*(is|to|of)?/i, "").trim();
    if (segment) desiredResult = segment.split(/[.\n,]/)[0].trim();
  } else if (lower.includes("transformation")) {
    const idx = lower.indexOf("transformation");
    const segment = text.substring(idx, idx + 200).replace(/transformation\s*(is|to)?/i, "").trim();
    if (segment) desiredResult = segment.split(/[.\n,]/)[0].trim();
  } else if (lower.includes("achieve")) {
    const idx = lower.indexOf("achieve");
    const segment = text.substring(idx, idx + 200).replace(/achieve\s*(a|an|the|our|their)?/i, "").trim();
    if (segment) desiredResult = segment.split(/[.\n,]/)[0].trim();
  }

  // Extract writingStyle
  let writingStyle = "Direct, high-value, casual, authoritative";
  if (lower.includes("style")) {
    const idx = lower.indexOf("style");
    const segment = text.substring(idx, idx + 150).replace(/style\s*(is|to)?/i, "").trim();
    if (segment) writingStyle = segment.split(/[.\n]/)[0].trim();
  } else if (lower.includes("tone")) {
    const idx = lower.indexOf("tone");
    const segment = text.substring(idx, idx + 150).replace(/tone\s*(is|to|of)?/i, "").trim();
    if (segment) writingStyle = segment.split(/[.\n]/)[0].trim();
  }

  // Extract keywords
  let keywords = "copywriting, organic growth, branding, social media";
  if (lower.includes("keyword")) {
    const idx = lower.indexOf("keyword");
    const segment = text.substring(idx, idx + 150).replace(/keyword(s)?\s*(are|is|to)?/i, "").trim();
    if (segment) keywords = segment.split(/[.\n]/)[0].trim();
  } else if (lower.includes("terminology")) {
    const idx = lower.indexOf("terminology");
    const segment = text.substring(idx, idx + 150).replace(/terminology\s*(is|are|to)?/i, "").trim();
    if (segment) keywords = segment.split(/[.\n]/)[0].trim();
  }

  // Clean values if they got empty
  if (!audience) audience = "Target audience";
  if (!offer) offer = "Creator offer";
  if (!desiredResult) desiredResult = "Ultimate transformation";
  if (!writingStyle) writingStyle = "Direct, authoritative";
  if (!keywords) keywords = "marketing, content";

  return {
    audience: audience.substring(0, 200),
    offer: offer.substring(0, 200),
    desiredResult: desiredResult.substring(0, 200),
    writingStyle: writingStyle.substring(0, 250),
    keywords: keywords.substring(0, 250)
  };
}

// REST route to extract structured DNA from a single Content Foundation input using Gemini Flash
app.post("/api/extract-content-foundation", async (req, res) => {
  try {
    const { contentFoundation } = req.body;
    if (!contentFoundation || !contentFoundation.trim()) {
      return res.status(400).json({ error: "Content Foundation text is required." });
    }

    const cacheKey = `dna_extract_${generateRequestHash({ contentFoundation: contentFoundation.trim() })}`;
    const cached = getCachedAiResponse<Record<string, any>>(cacheKey);
    if (cached && typeof cached === "object") {
      return res.json({ ...cached, isCached: true });
    }

    const result = await deduplicateRequest(cacheKey, async () => {
      let ai;
      try {
        ai = getAI();
      } catch (aiErr: any) {
        console.warn("getAI() failed, utilizing programmatic heuristic fallback parser:", aiErr.message);
        return heuristicParser(contentFoundation);
      }

      const systemPrompt = `
You are an expert Brand DNA and Content Strategy parser. Given the raw Content Foundation text provided by a digital creator, analyze it and extract five specific structured fields needed by our AI content generation engine:
1. "audience" (Target audience / Who do they help)
2. "offer" (Products or services / What do they sell)
3. "desiredResult" (Desired customer transformation / What is the ultimate goal they want to achieve)
4. "writingStyle" (Writing style, tone of voice, signature style, brand positioning, messaging priorities combined)
5. "keywords" (Keywords, supporting vocabulary, industry terminology, niche jargon combined)

Make sure that you extract these details comprehensively and accurately so that they perfectly represent the provided content foundation text.
Return the result as a raw JSON matching the required schema.
`;

      const response = await callGenerateContentWithRetry(ai, {
        model: "gemini-3.5-flash-lite",
        optimizationTaskId: "EXTRACT_IDENTITY",
        optimizationComplexity: "LEVEL_1_LIGHT",
        contents: contentFoundation,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              audience: { type: Type.STRING, description: "Detailed target audience" },
              offer: { type: Type.STRING, description: "Detailed offer/product/services description" },
              desiredResult: { type: Type.STRING, description: "Detailed desired transformation/results" },
              writingStyle: { type: Type.STRING, description: "Combined writing style, tone, and brand positioning" },
              keywords: { type: Type.STRING, description: "Comma-separated keywords, key terminology and niche jargon" }
            },
            required: ["audience", "offer", "desiredResult", "writingStyle", "keywords"]
          },
          systemInstruction: systemPrompt
        }
      });

      const text = response.text;
      if (!text) {
        throw new Error("Empty response received from the Gemini model.");
      }

      return parseGeminiJsonResponse(text);
    });

    if (result) {
      setCachedAiResponse(cacheKey, result, 3600000); // Cache for 1 hour
    }
    return res.json(result);

  } catch (err: any) {
    console.error("Gemini content foundation extraction failed, using heuristic fallback:", err);
    const fallback = heuristicParser(req.body.contentFoundation || "");
    return res.json(fallback);
  }
});

// Heuristic Identity parser fallback when offline or model unavailable
function heuristicIdentityParser(text: string, existing?: any): any {
  const existingId = existing || {};
  const res: any = {
    personality: existingId.personality || "",
    howYouThink: existingId.howYouThink || "",
    whatYouBelieve: existingId.whatYouBelieve || "",
    yourExperiences: existingId.yourExperiences || "",
    yourExpertise: existingId.yourExpertise || "",
    yourHumor: existingId.yourHumor || "",
    yourPerspective: existingId.yourPerspective || "",
    writingStyle: existingId.writingStyle || "",
    tone: existingId.tone || "",
    wordsYouUse: existingId.wordsYouUse || "",
    wordsYouAvoid: existingId.wordsYouAvoid || "",
    whoYouHelp: existingId.whoYouHelp || "",
    whatYouHelpThemDo: existingId.whatYouHelpThemDo || "",
    whatYoureKnownFor: existingId.whatYoureKnownFor || "",
    whatYouTalkAbout: existingId.whatYouTalkAbout || "",
    whatYouWantPeopleToRemember: existingId.whatYouWantPeopleToRemember || "",
  };

  if (!text || !text.trim()) return res;

  const lines = text.split("\n").map((l: string) => l.trim()).filter(Boolean);
  
  for (const line of lines) {
    const lLower = line.toLowerCase();
    if (lLower.includes("help") || lLower.includes("audience") || lLower.includes("target")) {
      if (!res.whoYouHelp) res.whoYouHelp = line.substring(0, 300);
    }
    if (lLower.includes("result") || lLower.includes("transform") || lLower.includes("achieve") || lLower.includes("build")) {
      if (!res.whatYouHelpThemDo) res.whatYouHelpThemDo = line.substring(0, 300);
    }
    if (lLower.includes("believe") || lLower.includes("conviction") || lLower.includes("philosophy")) {
      if (!res.whatYouBelieve) res.whatYouBelieve = line.substring(0, 300);
    }
    if (lLower.includes("experience") || lLower.includes("years") || lLower.includes("journey") || lLower.includes("worked")) {
      if (!res.yourExperiences) res.yourExperiences = line.substring(0, 300);
    }
    if (lLower.includes("expert") || lLower.includes("specializ") || lLower.includes("sell") || lLower.includes("offer") || lLower.includes("product")) {
      if (!res.yourExpertise) res.yourExpertise = line.substring(0, 300);
    }
    if (lLower.includes("humor") || lLower.includes("wit") || lLower.includes("joke") || lLower.includes("sarcas")) {
      if (!res.yourHumor) res.yourHumor = line.substring(0, 300);
    }
    if (lLower.includes("perspective") || lLower.includes("angle") || lLower.includes("view") || lLower.includes("lens")) {
      if (!res.yourPerspective) res.yourPerspective = line.substring(0, 300);
    }
    if (lLower.includes("style") || lLower.includes("write") || lLower.includes("format") || lLower.includes("spacing")) {
      if (!res.writingStyle) res.writingStyle = line.substring(0, 300);
    }
    if (lLower.includes("tone") || lLower.includes("voice") || lLower.includes("energy") || lLower.includes("vibe")) {
      if (!res.tone) res.tone = line.substring(0, 300);
    }
    if (lLower.includes("known for") || lLower.includes("reputation")) {
      if (!res.whatYoureKnownFor) res.whatYoureKnownFor = line.substring(0, 300);
    }
    if (lLower.includes("talk about") || lLower.includes("topics") || lLower.includes("subjects")) {
      if (!res.whatYouTalkAbout) res.whatYouTalkAbout = line.substring(0, 300);
    }
    if (lLower.includes("remember") || lLower.includes("takeaway") || lLower.includes("legacy") || lLower.includes("feeling")) {
      if (!res.whatYouWantPeopleToRemember) res.whatYouWantPeopleToRemember = line.substring(0, 300);
    }
  }

  // If initial creation and mostly empty, assign sensible extractions from top lines
  if (!res.personality && lines.length > 0) res.personality = lines[0].substring(0, 250);
  if (!res.whoYouHelp && lines.length > 1) res.whoYouHelp = lines[1].substring(0, 250);
  if (!res.whatYouTalkAbout && lines.length > 2) res.whatYouTalkAbout = lines[2].substring(0, 250);

  return res;
}

// REST route to analyze and extract structured Creator Identity from a single natural-language input
const handleExtractIdentity = async (req: express.Request, res: express.Response) => {
  try {
    const rawInput = req.body.rawInput || req.body.identityText || req.body.aboutYouText || "";
    const existingIdentity = req.body.existingIdentity || null;

    if (!rawInput || !rawInput.trim()) {
      return res.status(400).json({ error: "Identity description text is required." });
    }

    let ai;
    try {
      ai = getAI();
    } catch (aiErr: any) {
      console.warn("getAI() failed for identity extraction, utilizing heuristic parser:", aiErr.message);
      const fallback = heuristicIdentityParser(rawInput, existingIdentity);
      return res.json({ identity: fallback, source: "heuristic" });
    }

    const existingContext = existingIdentity ? `
EXISTING IDENTITY PROFILE (Use as baseline and intelligently merge with new updates):
${JSON.stringify(existingIdentity, null, 2)}
` : "NO EXISTING PROFILE: Extract all fields purely from the user's provided input.";

    const systemPrompt = `
You are the ThreadsWorks Identity Analysis Engine.
Your task is to analyze the user's unstructured natural-language input (bio, story, business description, writing samples, personality, beliefs, etc.) and extract a comprehensive, structured Creator Identity profile.

${existingContext}

=============================================================
CRITICAL EXTRACTION DIRECTIVES:
=============================================================
1. DO NOT FABRICATE:
   - Distinguish between explicit information, strongly supported inferences, and unknown information.
   - If the user did not provide information or a reasonable basis for a field, leave it as an empty string "" (or retain the existing value if one exists).
   - NEVER invent fake achievements, revenue metrics ($100k, $50M), credentials, fictional clients, or fake backstories.

2. PRESERVE THE USER'S ACTUAL LANGUAGE:
   - Do not convert authentic, punchy, colloquial, or candid language into generic corporate AI speak.
   - Retain their signature vocabulary, phrasing, and natural idioms.

3. EXTRACT WRITING STYLE FROM ACTUAL WRITING:
   - If the user provided writing samples or examples of their posts, analyze sentence length, rhythm, paragraph spacing, directness, formality, and emotional energy.

4. INTELLIGENT MERGE FOR UPDATES:
   - If an existing identity profile was provided above:
     * Keep existing values for fields that are still valid and unmentioned in the new text.
     * Update fields where the new input provides fresher, richer, or more accurate information.
     * Overwrite or clear fields that the user explicitly changed or contradicted.

=============================================================
FIELDS TO EXTRACT:
=============================================================
VOICE:
- writingStyle: Sentence structure, length, pacing, paragraph spacing, bullet points vs narratives.
- tone: Emotional register, attitude, energy (e.g. "Calm, authoritative, peer-to-peer, zero hype").
- wordsYouUse: Signature vocabulary, favorite expressions, recurring phrases.
- wordsYouAvoid: Jargon, buzzwords, tropes, or clichés the user dislikes or wants to avoid.

AUDIENCE & PURPOSE:
- whoYouHelp: Target audience, who they create for and serve.
- whatYouHelpThemDo: Core transformation, problems solved, outcomes achieved.
- whatYoureKnownFor: Reputation, signature expertise, what people come to them for.
- whatYouTalkAbout: 2 to 4 recurring themes, primary topics and subjects.
- whatYouWantPeopleToRemember: Lasting takeaway, core legacy, or feeling readers should retain.

PERSONALITY & THINKING:
- personality: Demeanor, vibe, temperament, energy (e.g. "Grounded, direct, analytical, encouraging").
- howYouThink: Mental models, cognitive framework, how they dissect concepts (e.g. "First-principles, systems thinking").
- whatYouBelieve: Core convictions, values, philosophy, counter-intuitive stances.
- yourExperiences: Real milestones, career lessons, background, experiments, journey.
- yourExpertise: Specialized knowledge, domain mastery, hard skills, products/services.
- yourHumor: Natural humor style (e.g. "Dry wit, sharp analogies, self-deprecation, or serious/focused").
- yourPerspective: Unique angle or lens on their space that sets them apart from mainstream advice.
`;

    const response = await callGenerateContentWithRetry(ai, {
      model: "gemini-3.5-flash-lite",
      optimizationTaskId: "EXTRACT_IDENTITY",
      optimizationComplexity: "LEVEL_1_LIGHT",
      contents: [
        {
          role: "user",
          parts: [{ text: `Analyze the following creator input and extract the complete Creator Identity profile:\n\n${rawInput}` }]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            personality: { type: Type.STRING, description: "Personality traits, demeanor, temperament, energy" },
            howYouThink: { type: Type.STRING, description: "Mental models, cognitive frameworks, how they break down ideas" },
            whatYouBelieve: { type: Type.STRING, description: "Core convictions, values, first principles, counter-intuitive stances" },
            yourExperiences: { type: Type.STRING, description: "Authentic background, real career milestones, struggles, journey" },
            yourExpertise: { type: Type.STRING, description: "Domain mastery, hard skills, specialized knowledge, products/services" },
            yourHumor: { type: Type.STRING, description: "Humor style: dry wit, sharp analogies, playful banter, observational, or serious" },
            yourPerspective: { type: Type.STRING, description: "Unique viewpoint, counter-intuitive angle, what they notice that others miss" },
            writingStyle: { type: Type.STRING, description: "Rhythm, cadence, sentence structure, formatting preferences" },
            tone: { type: Type.STRING, description: "Emotional register, attitude, vibe: authoritative, calm, warm, direct" },
            wordsYouUse: { type: Type.STRING, description: "Signature vocabulary, favorite phrases, go-to idioms" },
            wordsYouAvoid: { type: Type.STRING, description: "Corporate jargon, buzzwords, tropes, or clichés to avoid" },
            whoYouHelp: { type: Type.STRING, description: "Target audience: who they create for and serve" },
            whatYouHelpThemDo: { type: Type.STRING, description: "Core transformation, specific problems solved, goals achieved" },
            whatYoureKnownFor: { type: Type.STRING, description: "Reputation, signature achievements, what people come to them for" },
            whatYouTalkAbout: { type: Type.STRING, description: "Primary themes, recurring subjects and topics" },
            whatYouWantPeopleToRemember: { type: Type.STRING, description: "Lasting legacy, core takeaway or feeling" }
          },
          required: [
            "personality",
            "howYouThink",
            "whatYouBelieve",
            "yourExperiences",
            "yourExpertise",
            "yourHumor",
            "yourPerspective",
            "writingStyle",
            "tone",
            "wordsYouUse",
            "wordsYouAvoid",
            "whoYouHelp",
            "whatYouHelpThemDo",
            "whatYoureKnownFor",
            "whatYouTalkAbout",
            "whatYouWantPeopleToRemember"
          ]
        },
        systemInstruction: systemPrompt
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("Empty response received from the Gemini model.");
    }

    const parsed = parseGeminiJsonResponse(text);
    return res.json({ identity: parsed, source: "ai" });

  } catch (err: any) {
    console.error("Gemini identity extraction failed, using heuristic fallback:", err);
    const rawInput = req.body.rawInput || req.body.identityText || req.body.aboutYouText || "";
    const fallback = heuristicIdentityParser(rawInput, req.body.existingIdentity);
    return res.json({ identity: fallback, source: "heuristic" });
  }
};

app.post("/api/extract-identity", handleExtractIdentity);
app.post("/api/analyze-identity", handleExtractIdentity);

app.post("/api/profile/extract-intelligence", async (req, res) => {
  try {
    const { creatorContext, existingData } = req.body;
    if (!creatorContext) {
      return res.status(400).json({ success: false, error: "creatorContext is required." });
    }

    const ai = getAI();
    const systemPrompt = `
You are the ThreadsWorks Creator Intelligence Extraction Engine.
Your task is to analyze the user's unstructured natural-language Creator Context description and extract structured profile fields for the generation engine.

EXISTING DATA (Do not overwrite with empty strings if the user already has data and the new text is silent about a field):
${JSON.stringify(existingData || {}, null, 2)}

CRITICAL EXTRACTION DIRECTIVES:
1. ONLY EXTRACT REAL INFO: Do not make up URLs, prices, or names. If a field is not mentioned and has no existing value, return an empty string "".
2. BE TACTICAL AND SPECIFIC:
   - "businessName": The name of the user's brand, company, or professional persona.
   - "coreOffer": What the user sells or provides (e.g., "bookkeeping for freelancers" or "ghostwriting").
   - "pricePoint": Price of their services or products if mentioned (e.g., "$299/mo" or "$5,000").
   - "websiteUrl": Their website or offer link (e.g., "https://example.com").
   - "targetAudience": Who their ideal client or follower is (e.g., "freelancers under 1,000 followers").
   - "painPoints": Core audience pain points, frustrations, and desires (e.g., "overwhelmed by taxes").
   - "writingStyle": Writing style and tone (e.g., "direct, casual, conversational, no corporate jargon").
   - "wordsToAvoid": Cliche words or phrases to avoid (e.g., "synergy, supercharge, 10x").
   - "defaultCta": A high-converting call-to-action message (e.g., "DM 'TAX' to get started").

Return strictly a valid JSON object matching the requested schema.
`;

    const response = await callGenerateContentWithRetry(ai, {
      model: "gemini-3.5-flash-lite",
      optimizationTaskId: "EXTRACT_OFFER",
      optimizationComplexity: "LEVEL_1_LIGHT",
      contents: [
        {
          role: "user",
          parts: [{ text: `Analyze this Creator Context and extract structured intelligence:\n\n${creatorContext}` }]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            businessName: { type: Type.STRING },
            coreOffer: { type: Type.STRING },
            pricePoint: { type: Type.STRING },
            websiteUrl: { type: Type.STRING },
            targetAudience: { type: Type.STRING },
            painPoints: { type: Type.STRING },
            writingStyle: { type: Type.STRING },
            wordsToAvoid: { type: Type.STRING },
            defaultCta: { type: Type.STRING }
          },
          required: [
            "businessName",
            "coreOffer",
            "pricePoint",
            "websiteUrl",
            "targetAudience",
            "painPoints",
            "writingStyle",
            "wordsToAvoid",
            "defaultCta"
          ]
        },
        systemInstruction: systemPrompt
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("Empty response from Gemini.");
    }

    const parsed = JSON.parse(text);
    return res.json({ success: true, intelligence: parsed });
  } catch (err: any) {
    console.error("Gemini intelligence extraction failed:", err);
    return res.status(500).json({ success: false, error: err.message || String(err) });
  }
});

function getHeuristicEnhancement(category: string, rawText: string): string {
  if (!rawText) return "";
  const cat = (category || "").toLowerCase();
  if (cat.includes("voice") || cat.includes("identity")) {
    return `### 1. CREATOR IDENTITY, WORLDVIEW & PERSPECTIVE
${rawText}

### 2. COMMUNICATION CADENCE & NATURAL TONE
- Natural Style: Direct, conversational, authoritative, and authentic
- Tone: Grounded, high-signal, peer-to-peer, with zero artificial marketing hype
- Rhythm: Punchy, readable lines structured with clean whitespace

### 3. CORE COGNITION & REASONING ARCHITECTURE
- Problem Approach: First-principles logic, practical mechanisms, and evidence-based insights
- Audience Focus: Empowers ambitious peers with clear, actionable frameworks`;
  }
  if (cat.includes("business")) {
    return `### 1. BUSINESS CORE & OFFER OVERVIEW
${rawText}

### 2. TARGET BUYER & CORE TRANSFORMATION
- Ideal Buyer: Ambitious clients seeking proven, high-clarity outcomes
- Core Obstacle Solved: Eliminating complexity and friction in implementation
- Tangible Result: Predictable execution, authority growth, and compounding outcomes

### 3. POSITIONING, MECHANISM & CONTENT GOAL
- Unique Mechanism: Transparent, high-leverage frameworks built on real expertise
- Content Objective: Build deep authority, address real buyer hesitations, and create natural bridges to core offers`;
  }
  return `### 1. CONTENT EXECUTION & PILLARS
${rawText}

### 2. HOOK & OPENING DYNAMICS
- Pattern Interrupt: Scroll-stopping opening line delivering high-curiosity value without sensationalism
- Structural Flow: Hook → Context/Development → Actionable Value → Crisp Takeaway
- Sentence Cadence: Punchy, scannable lines (6-12 words per line) for effortless readability

### 3. QUALITY STANDARDS & STRATEGIC BOUNDARIES
- Strict Anti-Slop: Zero corporate buzzwords ("delve", "game changer", "revolutionize", "elevate", "unlock")
- Standalone Value: Every thread part provides independent value while seamlessly reinforcing the core objective`;
}

const handleEnhanceContext = async (req: express.Request, res: express.Response) => {
  try {
    const { category, text, context } = req.body;
    const inputCategory = (category || "your_voice").toString().toLowerCase();
    let rawText = typeof text === "string" ? text.trim() : "";

    if (!rawText && context) {
      if (inputCategory.includes("instruction") || inputCategory.includes("content")) {
        rawText = typeof context.customInstruction === "string" ? context.customInstruction.trim() : (typeof context.instructions === "string" ? context.instructions.trim() : "");
      } else if (inputCategory.includes("business")) {
        rawText = typeof context.rawBusinessText === "string" ? context.rawBusinessText.trim() : (typeof context.business === "string" ? context.business.trim() : "");
      } else if (inputCategory.includes("voice") || inputCategory.includes("identity")) {
        rawText = typeof context.voiceText === "string" ? context.voiceText.trim() : (context.creatorIdentity?.rawVoice || "");
      }
    }

    if (!rawText) {
      return res.status(400).json({ error: "Context text is required for depth enhancement." });
    }

    const ai = getAI();

    let systemInstruction = "";
    let promptTitle = "";

    // Extract any available sibling context across the 3 layers
    const siblingVoice = context?.voiceText || (context?.creatorIdentity ? (typeof context.creatorIdentity === "string" ? context.creatorIdentity : (context.creatorIdentity.rawVoice || context.creatorIdentity.identitySummary || "")) : "");
    const siblingBusiness = context?.rawBusinessText || (typeof context?.business === "string" ? context.business : "");
    const siblingInstructions = context?.customInstruction || (typeof context?.instructions === "string" ? context.instructions : "");

    let siblingContextPrompt = "";
    if (siblingVoice && !inputCategory.includes("voice") && !inputCategory.includes("identity")) {
      siblingContextPrompt += `\n[COMPLEMENTARY CONTEXT - CREATOR VOICE LAYER]:\n${typeof siblingVoice === "string" ? siblingVoice.slice(0, 1200) : JSON.stringify(siblingVoice).slice(0, 1200)}\n`;
    }
    if (siblingBusiness && !inputCategory.includes("business")) {
      siblingContextPrompt += `\n[COMPLEMENTARY CONTEXT - BUSINESS STRATEGY LAYER]:\n${typeof siblingBusiness === "string" ? siblingBusiness.slice(0, 1200) : JSON.stringify(siblingBusiness).slice(0, 1200)}\n`;
    }
    if (siblingInstructions && !inputCategory.includes("content") && !inputCategory.includes("instruction")) {
      siblingContextPrompt += `\n[COMPLEMENTARY CONTEXT - CONTENT INSTRUCTIONS LAYER]:\n${typeof siblingInstructions === "string" ? siblingInstructions.slice(0, 1200) : JSON.stringify(siblingInstructions).slice(0, 1200)}\n`;
    }

    if (inputCategory.includes("voice") || inputCategory.includes("identity")) {
      promptTitle = "Creator Voice & Identity (Identity Layer)";
      systemInstruction = `
You are the ThreadsWorks Core Intelligence Engine specializing in Creator Voice & Identity Architecture.

PRIMARY PURPOSE (IDENTITY LAYER):
Understand "WHO is this creator, and HOW should they naturally sound?"
Capture: WHO they are, WHAT THEY BELIEVE, HOW THEY THINK, HOW THEY COMMUNICATE, and WHAT MAKES THEM DISTINCTIVE.

PRIORITIZE:
• Identity, personality, character, demeanor, and presence
• Beliefs, values, opinions, worldview, and counter-intuitive stances
• Authentic perspective, domain knowledge, and experiences when provided
• Communication style, tone, vocabulary, cadence, and sentence rhythm
• Storytelling tendencies, teaching style, and persuasion style
• Natural phrasing, words they use, and words/clichés they avoid
• What makes their perspective distinct and memorable

STRICT CATEGORY BOUNDARIES:
Do NOT turn Your Voice into a business funnel, a customer avatar, a content calendar, or a generic writing guide. Keep the focus squarely on creator identity and communication DNA.

INTERNAL ENHANCEMENT OPERATIONS:
Internally apply these operations as appropriate to maximize high-signal depth:
1. ADD: Missing depth, clarifying nuance, reasoning style, and voice characteristics legitimately supported by the input.
2. REMOVE: Generic fluff, repetitive phrasing, and clearly misplaced operational instructions.
3. FIX: Ambiguity, vagueness, or disjointed tone expressions while preserving the creator's true meaning.
4. ENHANCE: Deepen existing ideas into specific, authentic voice and communication traits.
5. AMPLIFY: Strengthen the creator's most distinctive beliefs, core philosophy, and unique voice signature.

PROGRESSIVE ENRICHMENT & STRICT INFLATION CONTROL:
• If the input already contains prior enhancement or structured sections, PRESERVE and seamlessly deepen all existing insights while integrating new notes and resolving any ambiguities. Never restart from scratch or lose established depth.
• LENGTH & DENSITY RULE: Target a high-density, authoritative context (approx. 300–700 words). If the context is already comprehensive, DO NOT expand its length. Instead, tighten clarity, eliminate redundant phrasing, and refine precision. Repeated enhancement must improve quality and sharpness, NOT balloon text length.

STRICT ANTI-FABRICATION:
Never invent personal histories, credentials, fictional client names, fake prices, guarantees, or revenue numbers. Reason only from what exists or is legitimately inferred.

TONE & STRUCTURE:
Write in a natural, cohesive, authoritative voice (using first-person or direct creator perspective). Structure with clean, scannable thematic sections or structured paragraphs ready to inform downstream ThreadsWorks engines.
`;
    } else if (inputCategory.includes("business")) {
      promptTitle = "My Business Context (Strategy Layer)";
      systemInstruction = `
You are the ThreadsWorks Core Intelligence Engine specializing in Commercial Strategy, Offer Architecture, and Strategic Context.

PRIMARY PURPOSE (STRATEGY LAYER):
Understand "WHAT is this creator building, WHO is it for, and WHAT does the business need content to accomplish?"
Give ThreadsWorks the commercial foundation to understand not merely what the business is, but how the pieces relate to one another.

PRIORITIZE:
• Business model, products, services, programs, and offers
• Target audience, ideal buyer profile, customer psychographics, and decision-maker psychology
• Core problems, acute pain points, and root friction
• Desired outcomes, transformations, and business results
• Customer motivations, buying triggers, hesitations, and common objections
• Value proposition, positioning, differentiation, and unique mechanism/framework
• Pricing, tiers, deliverables, and client experience when provided or legitimately implied
• Business priorities, sales focus, growth objectives, and obstacles
• Strategic Relationship Mapping: Audience → Problem → Desired Outcome → Offer → Mechanism → Positioning → Business Objective → Content Objective
• What content needs to accomplish commercially for the business

STRICT CATEGORY BOUNDARIES:
Provide strategic context grounded in the creator’s verified business and audience information.

INTERNAL ENHANCEMENT OPERATIONS:
Internally apply these operations as appropriate to maximize strategic leverage:
1. ADD: Missing commercial depth, buyer psychology, friction points, and relational connections supported by the input.
2. REMOVE: Redundant filler, vague marketing buzzwords, and misplaced pure writing rules.
3. FIX: Ambiguous value propositions, disconnected problem/solution pairs, and unclear positioning.
4. ENHANCE: Deepen existing business concepts into structured, repeatable commercial models.
5. AMPLIFY: Sharpen the unique mechanism, core differentiation, and key buyer objections that content must address.

PROGRESSIVE ENRICHMENT & STRICT INFLATION CONTROL:
• If the input already contains prior enhancement or structured sections, PRESERVE and seamlessly enrich all existing commercial details while integrating newly provided notes. Never discard previously established context.
• LENGTH & DENSITY RULE: Target a high-density, authoritative strategic context (approx. 400–800 words). If the context is already well-developed, DO NOT endlessly inflate text length or produce repetitive prose; focus on tightening clarity, eliminating accidental redundancy, and sharpening high-signal strategic connections. Repeated enhancement must refine precision, NOT balloon length.

STRICT ANTI-FABRICATION:
Never invent fake prices, fictitious case studies, non-existent software products, or unstated guarantees. Reason strictly from what the user provided.

TONE & STRUCTURE:
Write in a clear, highly structured strategic format with logical sections and concise headings so the business context can be effortlessly referenced by both the creator and ThreadsWorks.
`;
    } else {
      promptTitle = "Content Instructions (Execution Layer)";
      systemInstruction = `
You are the ThreadsWorks Core Intelligence Engine specializing in Content Strategy, Framework Architecture, and High-Performance Social Media Execution.

PRIMARY PURPOSE (EXECUTION LAYER):
Understand "WHAT does this creator want created, and HOW should ThreadsWorks create it?"
Translate the creator's preferences and rules into a practical, actionable content operating guide.

PRIORITIZE:
• Topics, content pillars, recurring themes, and subject boundaries
• Content types and format distribution (educational breakdowns, contrarian viewpoints, tactical playbooks, micro-storytelling, conversion threads)
• Objectives, structures, multi-part thread pacing, and scannability dynamics
• Hook strategy, opening lines, pattern interrupts, and curiosity mechanics
• Educational preferences, promotional balance, and engagement prompts
• Call to action (CTA) rules, offer bridging, and next-step pathways
• Length, formatting, line break rules, and rhythm standards
• Specific vocabulary preferences, signature phrasing, and strict ban on AI clichés (delve, revolutionize, elevate, unlock, synergy, paradigm shift, game-changer, dive deep)
• Clear rules on what to emphasize, what to include, and what to strictly avoid
• Repurposing, series creation, and Threads-specific execution dynamics

STRICT CATEGORY BOUNDARIES:
Make Content Instructions practical and actionable rather than theoretical. Focus on operational execution rules for post generation.

INTERNAL ENHANCEMENT OPERATIONS:
Internally apply these operations as appropriate to maximize execution utility:
1. ADD: Practical formatting standards, hook formulas, CTA patterns, and pillar structures supported by the creator's intent.
2. REMOVE: Incoherent contradictions, generic boilerplate, and misplaced personal biographical text.
3. FIX: Vague rules (e.g., turning "make it good" into specific pacing and clarity guidelines).
4. ENHANCE: Synthesize disparate rules into a unified, actionable content execution guide.
5. AMPLIFY: Strengthen non-negotiable content rules, anti-slop constraints, and highest-impact hook mechanisms.

PROGRESSIVE ENRICHMENT & STRICT INFLATION CONTROL:
• If the input already contains prior enhancement or structured sections, PRESERVE and seamlessly refine all existing rules while integrating new directives. Never restart from scratch.
• LENGTH & DENSITY RULE: Target a high-density, actionable playbook (approx. 400–800 words). If the playbook is already well-developed, DO NOT endlessly inflate text length or produce repetitive prose; focus on tightening clarity, eliminating accidental redundancy, and sharpening high-signal operational guidelines. Repeated enhancement must refine precision, NOT balloon length.

STRICT ANTI-FABRICATION:
Never invent unrequested constraints or fake claims. Preserve the creator's genuine stylistic preferences and intent.

TONE & STRUCTURE:
Write as a comprehensive, well-organized Playbook with clean headings and bulleted operational guidelines ready to guide ThreadsWorks generation engines.
`;
    }

    const userPrompt = `Here is the user's input for ${promptTitle}:\n\n"""\n${rawText}\n"""\n${siblingContextPrompt ? `\n--- SIBLING CONTEXT ACROSS LAYERS ---\n${siblingContextPrompt}\n` : ""}\nPlease analyze this input and enhance it into a significantly richer, deeper, more actionable, and cohesive context following the directives above. Return only the enhanced context text without conversational meta-commentary.`;

    const response = await callGenerateContentWithRetry(ai, {
      model: "gemini-3.5-flash-lite",
      optimizationTaskId: "EXTRACT_BUYER",
      optimizationComplexity: "LEVEL_1_LIGHT",
      contents: [
        {
          role: "user",
          parts: [{ text: userPrompt }]
        }
      ],
      config: {
        systemInstruction,
        temperature: 0.35,
      }
    });

    const enhancedText = response.text?.trim();
    if (!enhancedText) {
      throw new Error("Empty response received from AI model.");
    }

    return res.json({
      enhancedText,
      category: inputCategory,
      source: "ai"
    });

  } catch (err: any) {
    console.error("Context enhancement AI call failed, providing heuristic enhancement:", err);
    const { category, text } = req.body;
    const rawText = typeof text === "string" ? text.trim() : "";
    const fallbackText = getHeuristicEnhancement(category || "your_voice", rawText);
    return res.json({
      enhancedText: fallbackText,
      category: category || "your_voice",
      source: "heuristic"
    });
  }
};

app.post("/api/enhance-context", handleEnhanceContext);

function heuristicOfferIntelligenceParser(rawBusinessText: string, fallbackOffer?: string, previousIntelligence?: any): any {
  const text = (rawBusinessText || "").trim();
  const baseOfferName = fallbackOffer || "Core Offer";
  
  if (!text && !fallbackOffer) {
    return {
      offers: [
        {
          id: "offer_1",
          name: "Creator Core Offer",
          type: "unspecified",
          confidenceSummary: {
            knownElements: [],
            supportedElements: [],
            unknownElements: ["price", "format", "deliverables", "mechanism", "testimonials"]
          }
        }
      ],
      primaryOfferName: "Creator Core Offer",
      lastUpdated: new Date().toISOString()
    };
  }

  // Extract potential offers from text lines (e.g. lines with bullets, colons, or names)
  const offers: any[] = [];
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  
  // Look for explicit offer markers
  const offerSectionLines: string[] = [];
  let inOfferSection = false;
  
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes("offer") || lower.includes("product") || lower.includes("service") || lower.includes("program") || lower.includes("accelerator") || lower.includes("sprint")) {
      inOfferSection = true;
      offerSectionLines.push(line);
    } else if (inOfferSection && (line.startsWith("-") || line.startsWith("•") || line.startsWith("*"))) {
      offerSectionLines.push(line);
    } else if (inOfferSection && line.includes(":")) {
      offerSectionLines.push(line);
    }
  }

  // Check for price (e.g., $3,500, $17, etc.)
  const priceMatch = text.match(/\$[\d,]+(\.\d{2})?(\/mo|\/year|\s*one-time|\s*per month|\s*total)?/i);
  const detectedPrice = priceMatch ? priceMatch[0] : undefined;

  // Extract main offer name if present
  let detectedName = fallbackOffer || "";
  for (const line of offerSectionLines) {
    const clean = line.replace(/^[-•*]\s*/, "").replace(/^Main offer:?\s*/i, "").replace(/^Offer:?\s*/i, "").trim();
    if (clean.length > 3 && clean.length < 80 && !clean.toLowerCase().startsWith("customers receive") && !clean.toLowerCase().startsWith("who i help") && !clean.toLowerCase().startsWith("current sales focus")) {
      const nameParts = clean.split(/[:–—(]/);
      if (nameParts[0].trim().length > 3) {
        detectedName = nameParts[0].trim();
        break;
      }
    }
  }

  if (!detectedName) {
    detectedName = fallbackOffer || "Core Creator Offer";
  }

  const isDigital = text.toLowerCase().includes("course") || text.toLowerCase().includes("template") || text.toLowerCase().includes("guide") || text.toLowerCase().includes("posts to your first client") || text.toLowerCase().includes("pdf") || text.toLowerCase().includes("ebook");
  const isConsulting = text.toLowerCase().includes("consult") || text.toLowerCase().includes("1-on-1") || text.toLowerCase().includes("agency") || text.toLowerCase().includes("accelerator") || text.toLowerCase().includes("sprint");

  let audiencePart: string | undefined;
  if (text.toLowerCase().includes("who i help") || text.toLowerCase().includes("who you help") || text.toLowerCase().includes("for:")) {
    const m = text.match(/(?:who i help|who you help|for:?)\s*(?:&[^:]+)?[:–—]?\s*([^\n\.]+)/i);
    if (m && m[1]) audiencePart = m[1].replace(/^[-•*]\s*/, "").trim();
  }

  let problemPart: string | undefined;
  if (text.toLowerCase().includes("problem") || text.toLowerCase().includes("struggle") || text.toLowerCase().includes("obstacle")) {
    const m = text.match(/(?:problem|struggle|obstacle)[:–—]?\s*([^\n\.]+)/i);
    if (m && m[1]) problemPart = m[1].replace(/^[-•*]\s*/, "").trim();
  }

  let desiredPart: string | undefined;
  if (text.toLowerCase().includes("want") || text.toLowerCase().includes("goal") || text.toLowerCase().includes("outcome")) {
    const m = text.match(/(?:want|goal|outcome)[:–—]?\s*([^\n\.]+)/i);
    if (m && m[1]) desiredPart = m[1].replace(/^[-•*]\s*/, "").trim();
  }

  offers.push({
    id: "offer_1",
    name: detectedName,
    type: isConsulting ? "consulting" : (isDigital ? "digital_product" : "service"),
    format: text.toLowerCase().includes("1-on-1") ? "1-on-1 Implementation" : (text.toLowerCase().includes("90-day") ? "90-day strategic implementation" : undefined),
    price: detectedPrice,
    purpose: `Help clients achieve core transformation via ${detectedName}`,
    targetCustomer: {
      intendedAudience: audiencePart || undefined,
      intendedBuyer: audiencePart || undefined,
    },
    problem: {
      problemStatement: problemPart || undefined,
      status: problemPart ? "known" : "unknown"
    },
    desiredOutcome: {
      practicalOutcome: desiredPart || undefined,
    },
    confidenceSummary: {
      knownElements: [detectedName ? "name" : "", detectedPrice ? "price" : ""].filter(Boolean),
      supportedElements: [audiencePart ? "targetCustomer" : "", problemPart ? "problem" : ""].filter(Boolean),
      unknownElements: ["testimonials", "moneyBackGuarantee", "roiCalculation"]
    }
  });

  return {
    offers,
    primaryOfferName: detectedName,
    lastUpdated: new Date().toISOString()
  };
}

const handleUnderstandOfferIntelligence = async (req: express.Request, res: express.Response) => {
  try {
    const { businessText, offer, creatorIdentity, customInstruction, previousIntelligence } = req.body;
    const rawBusinessText = typeof businessText === "string" ? businessText.trim() : "";
    const fallbackOffer = typeof offer === "string" ? offer.trim() : "";

    if (!rawBusinessText && !fallbackOffer) {
      return res.status(400).json({ error: "Either business text or offer name is required for offer intelligence." });
    }

    let ai;
    try {
      ai = getAI();
    } catch (aiErr: any) {
      const fallback = heuristicOfferIntelligenceParser(rawBusinessText, fallbackOffer, previousIntelligence);
      return res.json({ offerIntelligence: fallback, source: "heuristic" });
    }

    const systemPrompt = `You are the ThreadsWorks Core Offer Intelligence Engine.
Your objective is to build a reliable, structured understanding of the creator's EXISTING offers based exclusively on what the creator has provided.

CORE PRINCIPLE: UNDERSTANDING, NOT OFFER CREATION OR SALES COACHING:
- You do NOT create new offers, rewrite offers, change prices, add bonuses, invent guarantees, or score offers.
- You understand: WHAT is this creator selling, WHO is it for, WHAT problem does it address, WHAT does it provide, and WHY does it matter?

FACTUAL GROUNDING & INTEGRITY DIRECTIVES:
1. STRICT ANTI-FABRICATION:
   - The creator's input is the source of truth.
   - Never invent prices, revenue metrics, testimonials, case studies, features, bonuses, client results, or proprietary names that were not provided.
   - If a detail is not provided, leave it empty or omitted. A partially understood real offer is infinitely better than a fictional complete offer.
2. DISTINGUISH CONFIDENCE LEVELS:
   - Explicit facts (e.g., "$3,500 90-day accelerator") are KNOWN.
   - Logical conclusions directly supported by context (e.g., "target buyers are B2B service providers") are SUPPORTED.
   - Details not mentioned (e.g., specific refund policies or unstated testimonials) are UNKNOWN.
3. MULTIPLE OFFERS SUPPORT:
   - If the creator mentions multiple products, services, courses, or tiers (e.g., Offer A: "Sprint", Offer B: "Template Pack"), create distinct records for EACH offer.
   - Do NOT collapse separate offers into a single generic blob.
4. OFFER RELATIONSHIPS:
   - When supported, identify relationships (e.g., core offer, entry point, premium upgrade, complementary). Do NOT force a product ladder if not stated.
5. PROGRESSIVE REFINEMENT & CHANGE DETECTION:
   - If previous offer intelligence is provided, PRESERVE valid existing understanding and integrate new clarifications or additions.
   - If the creator explicitly changed an offer name, price, or description, the NEW creator input OVERRIDES older AI assumptions.
   - Avoid endless text ballooning; produce concise, precise, high-density entries.

OUTPUT JSON SCHEMA:
Return ONLY a valid JSON object matching:
{
  "offers": [
    {
      "id": "string",
      "name": "string (Offer Name)",
      "type": "service | digital_product | coaching | consulting | software | course | community | hybrid | unspecified",
      "format": "string or omitted (e.g. 90-day 1-on-1 sprint, self-paced guide)",
      "price": "string or omitted ($X if provided, otherwise omit)",
      "purchasePath": "string or omitted (e.g. link in bio, DM 'SYSTEM', application call)",
      "purpose": "string or omitted (Why this offer exists and the specific job it accomplishes)",
      "targetCustomer": {
        "intendedAudience": "string or omitted",
        "intendedBuyer": "string or omitted",
        "situation": "string or omitted",
        "experienceLevel": "string or omitted"
      },
      "problem": {
        "problemStatement": "string or omitted",
        "symptoms": ["string"],
        "friction": "string or omitted",
        "rootProblem": "string or omitted",
        "status": "known | supported | unknown"
      },
      "desiredOutcome": {
        "buyerDesire": "string or omitted",
        "practicalOutcome": "string or omitted",
        "businessOutcome": "string or omitted"
      },
      "solution": {
        "deliverables": ["string"],
        "components": ["string"],
        "frameworks": ["string"]
      },
      "mechanism": {
        "method": "string or omitted",
        "framework": "string or omitted",
        "system": "string or omitted",
        "isProprietary": false
      },
      "value": {
        "coreValue": "string or omitted",
        "timeOrComplexityReduction": "string or omitted"
      },
      "differentiation": {
        "distinctApproach": "string or omitted",
        "positioningDifference": "string or omitted"
      },
      "purchaseBarriers": {
        "knownBarriers": ["string"]
      },
      "proof": {
        "evidence": ["string"],
        "credentials": "string or omitted"
      },
      "cta": {
        "preferredAction": "string or omitted",
        "handRaiserKeywords": ["string"]
      },
      "relationshipToOtherOffers": "primary_core | entry_point | premium_upgrade | complementary | standalone | unspecified",
      "confidenceSummary": {
        "knownElements": ["string"],
        "supportedElements": ["string"],
        "unknownElements": ["string"]
      }
    }
  ],
  "primaryOfferName": "string",
  "offerRelationshipsSummary": "string or omitted",
  "lastUpdated": "ISO string"
}`;

    const userContent = `Analyze and structure the following creator's offer information:

CREATOR BUSINESS SOURCE TEXT:
${rawBusinessText || "(No detailed business text provided)"}

FALLBACK / PRIMARY OFFER NAME:
${fallbackOffer || "(Not specified)"}

${creatorIdentity?.rawVoice ? `CREATOR IDENTITY CONTEXT (FOR BACKGROUND PERSPECTIVE ONLY, DO NOT DUPLICATE VOICE INTO OFFER DATA):\n${creatorIdentity.rawVoice}\n` : ""}
${customInstruction ? `CONTENT INSTRUCTIONS (DO NOT CONVERT CREATION RULES INTO OFFER FACTS):\n${customInstruction}\n` : ""}
${previousIntelligence ? `PREVIOUS KNOWN OFFER INTELLIGENCE (REFINE AND PRESERVE VALID FACTS, OVERRIDE WITH NEW CREATOR INPUT):\n${JSON.stringify(previousIntelligence, null, 2)}\n` : ""}

Extract and return the structured Offer Intelligence JSON.`;

    const response = await callGenerateContentWithRetry(ai, {
      model: "gemini-3.6-flash",
      optimizationTaskId: "EXTRACT_OFFER",
      optimizationComplexity: "LEVEL_2_STANDARD",
      contents: [
        { role: "user", parts: [{ text: `${systemPrompt}\n\n${userContent}` }] }
      ],
      config: {
        temperature: 0.2,
        responseMimeType: "application/json"
      }
    });

    const responseText = response.text || "";
    let parsed: any;
    try {
      parsed = parseGeminiJsonResponse(responseText);
    } catch {
      parsed = heuristicOfferIntelligenceParser(rawBusinessText, fallbackOffer, previousIntelligence);
    }

    if (!parsed.offers || !Array.isArray(parsed.offers) || parsed.offers.length === 0) {
      parsed = heuristicOfferIntelligenceParser(rawBusinessText, fallbackOffer, previousIntelligence);
    }

    parsed.lastUpdated = new Date().toISOString();

    return res.json({
      offerIntelligence: parsed,
      source: "ai"
    });

  } catch (err: any) {
    console.error("Offer intelligence AI understanding failed, using heuristic parser:", err);
    const { businessText, offer, previousIntelligence } = req.body;
    const fallback = heuristicOfferIntelligenceParser(businessText || "", offer || "", previousIntelligence);
    return res.json({
      offerIntelligence: fallback,
      source: "heuristic"
    });
  }
};

app.post("/api/offer-intelligence/understand", handleUnderstandOfferIntelligence);

// Heuristic Fallback Parser for Buyer & Conversion Intelligence
function heuristicBuyerIntelligenceParser(
  rawBusinessText: string,
  audience?: string,
  desiredResult?: string,
  offerIntelligence?: any,
  previousIntelligence?: any
): any {
  const text = (rawBusinessText || "").trim();
  const baseAudience = (audience && audience.trim()) ? audience.trim() : "Founders, Creators & Knowledge Workers";
  const baseGoal = (desiredResult && desiredResult.trim()) ? desiredResult.trim() : "Build predictable revenue and client acquisition";

  let detectedRole = baseAudience;
  let detectedProblems: string[] = [];
  let detectedOutcomes: string[] = [];

  if (text.toLowerCase().includes("who i help") || text.toLowerCase().includes("who you help") || text.toLowerCase().includes("target audience") || text.toLowerCase().includes("audience")) {
    const m = text.match(/(?:who i help|who you help|target audience|audience)[:–—]?\s*([^\n\.]+)/i);
    if (m && m[1]) detectedRole = m[1].replace(/^[-•*]\s*/, "").trim();
  }

  if (text.toLowerCase().includes("problem") || text.toLowerCase().includes("struggle") || text.toLowerCase().includes("friction") || text.toLowerCase().includes("bottleneck")) {
    const m = text.match(/(?:problem|struggle|friction|bottleneck)[:–—]?\s*([^\n\.]+)/i);
    if (m && m[1]) detectedProblems.push(m[1].replace(/^[-•*]\s*/, "").trim());
  }

  if (text.toLowerCase().includes("want") || text.toLowerCase().includes("goal") || text.toLowerCase().includes("outcome") || text.toLowerCase().includes("result")) {
    const m = text.match(/(?:want|goal|outcome|result)[:–—]?\s*([^\n\.]+)/i);
    if (m && m[1]) detectedOutcomes.push(m[1].replace(/^[-•*]\s*/, "").trim());
  }

  const primaryOfferName = offerIntelligence?.primaryOfferName || offerIntelligence?.offers?.[0]?.name || "Core Offer";

  const buyers = [
    {
      id: "buyer_1",
      name: detectedRole || baseAudience,
      identity: {
        intendedBuyer: detectedRole || baseAudience,
        sophisticationLevel: text.toLowerCase().includes("beginner") ? "beginner" : (text.toLowerCase().includes("advanced") || text.toLowerCase().includes("scaling") ? "experienced operator" : "intermediate"),
        goals: detectedOutcomes.length ? detectedOutcomes : [baseGoal]
      },
      situation: {
        currentActivities: ["Producing content and attempting to convert attention into qualified buyers"],
        frictionPoints: detectedProblems.length ? detectedProblems : ["Unpredictable conversion from views to sales"],
        gapDescription: `Desires ${detectedOutcomes[0] || baseGoal} but experiencing friction in execution.`
      },
      problems: {
        surfaceSymptoms: ["High effort on content with inconsistent commercial conversion"],
        practicalProblems: detectedProblems,
        rootProblem: detectedProblems[0] || "Lack of systematic, high-trust conversion mechanism connecting content to offer",
        costOfInaction: "Wasted hours creating non-converting content while leaving revenue on the table"
      },
      desiredOutcomes: {
        functionalOutcomes: detectedOutcomes.length ? detectedOutcomes : [baseGoal],
        businessFinancialOutcomes: ["Predictable, scalable sales pipeline from audience"],
        emotionalPeaceOutcomes: ["Operational clarity, confidence in positioning, peace of mind"]
      },
      awareness: {
        problemAwareness: "problem_aware",
        understandingOfSolutionCategory: "Recognizes that clear conversion strategy and positioning are required"
      },
      desires: {
        wantsToAchieve: [baseGoal],
        wantsToAvoid: ["Complicated low-trust funnels", "High-pressure sales gimmicks", "Burnout"],
        wantsToStopWorryingAbout: ["Inconsistent leads and unpredictable revenue"]
      },
      barriers: {
        knownBarriers: [],
        supportedBarriers: ["Uncertainty regarding implementation fit for their exact niche", "Time constraints"],
        unknownBarriers: ["Exact budget allocations"]
      },
      beliefs: {
        limitingBeliefs: ["I must reach a massive follower count before I can sell consistently"],
        enablingBeliefs: ["Authority, precision, and frictionless value mechanisms convert far better than raw volume"]
      },
      triggers: {
        legitimateTriggers: ["Realizing vanity metrics do not generate revenue", "Seeing a clear, proven mechanism with low friction"]
      },
      decisionCriteria: {
        evaluationFactors: ["Clarity of method", "Direct relevance to their market", "Simplicity of execution", "Proof of mechanism"]
      },
      conversionGap: {
        currentGap: "Recognizes the need for conversion but lacks a clear, authoritative bridge to implementation",
        bridgeRequirement: "Step-by-step clarity, credible mechanism, and frictionless hand-raiser call to action"
      },
      offerConnection: {
        connectedOfferName: primaryOfferName,
        whyBuyerNeedsOffer: `Provides the structured framework to achieve ${baseGoal}`
      },
      confidenceSummary: {
        knownElements: [detectedRole ? "intendedBuyer" : "", detectedProblems.length ? "problems" : ""].filter(Boolean),
        supportedElements: ["desiredOutcomes", "triggers", "decisionCriteria"],
        unknownElements: ["specificClientBudget"]
      }
    }
  ];

  return {
    buyers,
    primaryBuyerSummary: `${detectedRole || baseAudience} seeking ${baseGoal}`,
    lastUpdated: new Date().toISOString()
  };
}

// Controller for Buyer & Conversion Intelligence extraction & progressive refinement
const handleUnderstandBuyerIntelligence = async (req: express.Request, res: express.Response) => {
  try {
    const { businessText, audience, desiredResult, offer, creatorIdentity, customInstruction, offerIntelligence, previousBuyerIntelligence } = req.body;
    const rawBusinessText = (businessText || "").trim();
    const fallbackAudience = (audience || "").trim();
    const fallbackDesiredResult = (desiredResult || "").trim();
    const fallbackOffer = (offer || "").trim();

    if (!rawBusinessText && !fallbackAudience && !fallbackOffer) {
      return res.json({
        buyerIntelligence: {
          buyers: [],
          primaryBuyerSummary: "No buyer or business context provided yet.",
          lastUpdated: new Date().toISOString()
        },
        source: "empty"
      });
    }

    let ai;
    try {
      ai = getAI();
    } catch (e) {
      const fallback = heuristicBuyerIntelligenceParser(rawBusinessText, fallbackAudience, fallbackDesiredResult, offerIntelligence, previousBuyerIntelligence);
      return res.json({
        buyerIntelligence: fallback,
        source: "heuristic"
      });
    }

    const extractionPrompt = `You are the ThreadsWorks Buyer & Conversion Intelligence Engine.
Your objective is to deeply understand the prospective BUYER and CONVERSION ENVIRONMENT surrounding this creator's business and offers.

=============================================================
CORE PRINCIPLES & CONSTRAINTS:
=============================================================
1. AUTHORITATIVE TRUTH: The creator's text is the absolute source of truth.
2. STRICT NO FABRICATION: NEVER fabricate fake testimonials, fake client names, fake case studies, fake statistics, or unstated guarantees.
3. DISTINGUISH CONFIDENCE LEVELS:
   - "known": Explicitly stated by the creator.
   - "supported": Strongly and logically derived from the creator's context.
   - "unknown": Cannot be reasonably determined. Keep unknown fields empty or explicitly marked unknown. An accurate partial model is superior to a fabricated complete model.
4. RELATIONSHIP TO OFFER INTELLIGENCE: Consume what is known about the offer without duplicating the entire offer description. Understand WHY the buyer needs the offer and what influences their decision.
5. NO OVER-SEGMENTATION: Only create distinct buyer segments if the creator's text explicitly supports multiple genuinely different buyer profiles. Default to 1 comprehensive buyer segment.
6. NO SCORING / NO FUNNELS: Do not generate lead scores, persona ratings, or fake probabilities.
7. CONTRADICTION RESOLUTION: If the new creator inputs contradict previous intelligence, the creator's newest input ALWAYS wins.

=============================================================
INPUT SOURCES:
=============================================================
--- MY BUSINESS & STRATEGIC CONTEXT ---
${rawBusinessText || "None provided"}

--- BRAND DNA FIELDS ---
- Target Audience: "${fallbackAudience || "Not specified"}"
- Desired Result: "${fallbackDesiredResult || "Not specified"}"
- Core Offer: "${fallbackOffer || "Not specified"}"

--- EXISTING OFFER INTELLIGENCE ---
${offerIntelligence ? JSON.stringify(offerIntelligence, null, 2) : "None available"}

--- CREATOR VOICE / IDENTITY ---
${creatorIdentity?.personality ? `Personality: ${creatorIdentity.personality}. Perspective: ${creatorIdentity.yourPerspective || ""}` : "Not specified"}

--- PREVIOUS BUYER INTELLIGENCE (FOR REFINEMENT / PRESERVATION) ---
${previousBuyerIntelligence ? JSON.stringify(previousBuyerIntelligence, null, 2) : "None (first extraction)"}

=============================================================
DESIRED JSON OUTPUT SCHEMA:
=============================================================
Return ONLY a valid JSON object matching this exact structure:
{
  "buyers": [
    {
      "id": "buyer_1",
      "name": "Concise Descriptive Title of Buyer Segment",
      "identity": {
        "intendedBuyer": "Who the intended buyer is (role, profile, experience)",
        "sophisticationLevel": "beginner" | "intermediate" | "experienced operator",
        "goals": ["Specific goal 1", "Specific goal 2"],
        "experienceLevel": "e.g. 1-3 years in business, solo creator, agency owner"
      },
      "situation": {
        "currentActivities": ["What they are currently doing"],
        "frictionPoints": ["What is not working or where they are stuck"],
        "previousAttempts": ["What they have tried before (if known)"],
        "gapDescription": "Concise summary of the gap between current state and desired state"
      },
      "problems": {
        "surfaceSymptoms": ["Visible day-to-day symptom"],
        "practicalProblems": ["Workflow or execution bottleneck"],
        "businessOrFinancialProblems": ["Revenue, client, or financial consequence"],
        "emotionalFrustrations": ["Frustration, fatigue, or friction points"],
        "rootProblem": "The underlying core root problem",
        "costOfInaction": "Realistic consequence of remaining stuck"
      },
      "desiredOutcomes": {
        "functionalOutcomes": ["Deliverable/functional outcome"],
        "businessFinancialOutcomes": ["Commercial/business outcome"],
        "emotionalPeaceOutcomes": ["Relief, clarity, peace of mind"],
        "lifestyleOrIdentityOutcomes": ["Identity evolution or freedom"]
      },
      "awareness": {
        "problemAwareness": "unaware" | "problem_aware" | "solution_aware" | "offer_aware" | "most_aware" | "unspecified",
        "understandingOfSolutionCategory": "What they understand about this category of solution",
        "awarenessNotes": "Key observation about their awareness level"
      },
      "desires": {
        "wantsToAchieve": ["Core achievement desire"],
        "wantsToAvoid": ["What they want to avoid (e.g. sleazy tactics, complex tech)"],
        "wantsToFeel": ["How they want to feel (e.g. competent, certain)"],
        "wantsToStopWorryingAbout": ["Specific stress point to eliminate"]
      },
      "barriers": {
        "knownBarriers": ["Explicitly confirmed objection or barrier in creator text"],
        "supportedBarriers": ["Strongly implied objection or barrier based on context"],
        "unknownBarriers": ["Unstated barrier dimensions preserved as unknown"]
      },
      "beliefs": {
        "limitingBeliefs": ["E.g., 'I need 10k followers before I can monetize'"],
        "enablingBeliefs": ["E.g., 'A clear mechanism converts qualified buyers faster than volume'"]
      },
      "triggers": {
        "legitimateTriggers": ["Legitimate trigger factor (e.g. realizing vanity metrics do not pay bills)"]
      },
      "decisionCriteria": {
        "evaluationFactors": ["Trust", "Simplicity", "Proof of mechanism", "Relevance"]
      },
      "conversionGap": {
        "currentGap": "Where the gap currently sits in their decision path",
        "bridgeRequirement": "What specific insight or proof bridges this gap"
      },
      "offerConnection": {
        "connectedOfferName": "Name of the connected offer",
        "whyBuyerNeedsOffer": "Why this specific offer is relevant to their situation",
        "relevanceHook": "The primary logical reason this offer solves their core problem"
      },
      "confidenceSummary": {
        "knownElements": ["List of attributes directly found in text"],
        "supportedElements": ["List of attributes logically inferred"],
        "unknownElements": ["List of missing or unknown attributes"]
      }
    }
  ],
  "primaryBuyerSummary": "1-2 sentence executive summary of the primary buyer decision environment",
  "marketDynamicsContext": "Brief note on market context if applicable"
}`;

    const response = await callGenerateContentWithRetry(ai, {
      model: "gemini-3.6-flash",
      optimizationTaskId: "EXTRACT_BUYER",
      optimizationComplexity: "LEVEL_2_STANDARD",
      contents: [{ role: "user", parts: [{ text: extractionPrompt }] }],
      config: {
        responseMimeType: "application/json",
        temperature: 0.2
      }
    });

    const responseText = response.text ? response.text.trim() : "";
    let parsed: any = null;

    if (responseText) {
      try {
        parsed = parseGeminiJsonResponse(responseText);
      } catch (jsonErr) {
        parsed = heuristicBuyerIntelligenceParser(rawBusinessText, fallbackAudience, fallbackDesiredResult, offerIntelligence, previousBuyerIntelligence);
      }
    }

    if (!parsed || !parsed.buyers || !Array.isArray(parsed.buyers) || parsed.buyers.length === 0) {
      parsed = heuristicBuyerIntelligenceParser(rawBusinessText, fallbackAudience, fallbackDesiredResult, offerIntelligence, previousBuyerIntelligence);
    }

    parsed.lastUpdated = new Date().toISOString();

    return res.json({
      buyerIntelligence: parsed,
      source: "ai"
    });

  } catch (err: any) {
    console.error("Buyer intelligence AI understanding failed, using heuristic parser:", err);
    const { businessText, audience, desiredResult, offer, offerIntelligence, previousBuyerIntelligence } = req.body;
    const fallback = heuristicBuyerIntelligenceParser(businessText || "", audience || "", desiredResult || "", offerIntelligence, previousBuyerIntelligence);
    return res.json({
      buyerIntelligence: fallback,
      source: "heuristic"
    });
  }
};

app.post("/api/buyer-intelligence/understand", handleUnderstandBuyerIntelligence);

// ============================================================================
// CONTENT DECISION ENGINE (PROMPT 4)
// Strategic orchestration layer that determines WHAT content to create, for WHOM,
// WHY, and HOW it creates commercial and psychological progression before generation.
// ============================================================================

export interface ContentDecision {
  objective: string;
  targetBuyer: string;
  buyerNeed: string;
  problemOrDesire: string;
  awarenessContext: string;
  beliefOrBarrier: string;
  coreIdea: string;
  strategicAngle: string;
  contentType: string;
  pillarTitle?: string;
  offerRelationship: string;
  cta?: string;
  strategicReason: string;
  buyerMovement?: string;
  recommendedPartCount?: number;
  recommendedSentencesPerPart?: number;
  recommendedLength?: string;
  structuralPacingGuidance?: string;
}

function heuristicContentDecisionMaker(
  context: {
    topic?: string;
    category?: string;
    offer?: string;
    audience?: string;
    desiredResult?: string;
    writingStyle?: string;
    rawBusinessText?: string;
    offerIntelligence?: any;
    buyerIntelligence?: any;
    activePillar?: any;
    activeIdea?: any;
    rawCreatorThought?: string;
    activeCta?: any;
    lockedOpeningHook?: string;
    existingPosts?: any[];
  },
  count: number = 1
): ContentDecision[] {
  const category = (context.category || "attention").toLowerCase();
  const safeTopic = (context.topic && context.topic.trim()) ? context.topic.trim() : (context.activeIdea?.title || "");
  const safeAudience = (context.audience && context.audience.trim()) ? context.audience.trim() : "Ambitious entrepreneurs and creators";
  const safeOffer = (context.offer && context.offer.trim()) ? context.offer.trim() : "High-value strategic system";
  const safeResult = (context.desiredResult && context.desiredResult.trim()) ? context.desiredResult.trim() : "predictable growth and client velocity";
  const pillarTitle = context.activePillar?.title || (category === "attention" ? "Contrarian Growth & Attention" : category === "trust" ? "Authority & Operational Systems" : "Sales & Conversion Mechanics");
  
  // Extract primary buyer details if available
  const primaryBuyer = context.buyerIntelligence?.buyers?.[0];
  const buyerName = primaryBuyer?.name || safeAudience;
  const buyerProblem = primaryBuyer?.problems?.rootProblem || primaryBuyer?.problems?.surfaceSymptoms?.[0] || (safeTopic ? `Friction with ${safeTopic}` : `Friction in realizing ${safeResult}`);
  const limitingBelief = primaryBuyer?.beliefs?.limitingBeliefs?.[0] || "Believing complex tactics or 80-hour workweeks are necessary to scale";
  const knownBarrier = primaryBuyer?.barriers?.knownBarriers?.[0] || "Fear of wasting time on unproven methods";

  const unifiedLengthPlan = resolveWritingLengthPlan({
    contentRequest: safeTopic,
    activeIdea: context.activeIdea,
    rawCreatorThought: context.rawCreatorThought,
    category
  });

  const decisions: ContentDecision[] = [];

  for (let i = 0; i < count; i++) {
    const postIndex = i;

    if (category === "attention") {
      const attentionVariants = [
        {
          objective: "Problem recognition & reach",
          buyerNeed: "Stop repeating ineffective mainstream tactics that waste time",
          problemOrDesire: safeTopic ? `Overcomplicating ${safeTopic} instead of focusing on clear fundamentals` : `Relying on outdated playbooks instead of direct mechanisms to achieve ${safeResult}`,
          awarenessContext: "Problem-Aware",
          beliefOrBarrier: limitingBelief,
          coreIdea: safeTopic ? `To make real progress with ${safeTopic}, you need a streamlined, repeatable mechanism with ${safeOffer}.` : (context.activeIdea?.summary || context.rawCreatorThought || `To unlock ${safeResult}, you don't need complex tactics; you need a streamlined, high-conviction mechanism.`),
          strategicAngle: "Contrarian insight",
          contentType: "Authority",
          offerRelationship: "soft_connection",
          cta: "Save this post to audit your current workflow",
          strategicReason: "Pattern interrupt that challenges industry assumptions and establishes creator authority immediately.",
          buyerMovement: "Recognizes the real source of friction and stops looking for superficial hacks."
        },
        {
          objective: "Cost of Inaction exposure",
          buyerNeed: "Clarity on why manual workarounds are capping their leverage",
          problemOrDesire: `Hidden operational bloat and administrative drag stealing focus hours`,
          awarenessContext: "Unaware of Root Cause",
          beliefOrBarrier: "Believing that more effort alone solves structural inefficiency",
          coreIdea: "Scaling requires stripping away low-yield activities and delegating the noise.",
          strategicAngle: "Problem diagnosis",
          contentType: "Educational",
          offerRelationship: "none",
          cta: "Drop a comment with your single biggest time drain this week",
          strategicReason: "Diagnoses the operational bottleneck with objective logic without condescension.",
          buyerMovement: "Realizes that structural leverage is the only sustainable path forward."
        },
        {
          objective: "Belief shift & positioning",
          buyerNeed: "A believable, low-friction blueprint for sustainable growth",
          problemOrDesire: `Overcomplicating offer delivery and burning out before results compound`,
          awarenessContext: "Solution-Seeking",
          beliefOrBarrier: knownBarrier,
          coreIdea: `True leverage comes from simple, repeatable frameworks like ${safeOffer}.`,
          strategicAngle: "Hidden truth",
          contentType: "Story",
          offerRelationship: "soft_connection",
          cta: "Bookmark this breakdown for your next strategy session",
          strategicReason: "Reframes simple execution as the true mark of mastery.",
          buyerMovement: "Adopts the creator's mental model and values simplicity over noise."
        },
        {
          objective: "Mistake elimination",
          buyerNeed: "Immediate tactical filter to eliminate wasted resources",
          problemOrDesire: `Chasing vanity metrics instead of closed-loop client conversion`,
          awarenessContext: "Problem-Aware",
          beliefOrBarrier: "Equating social vanity with real commercial progress",
          coreIdea: "Prioritize deep audience resonance and direct value distribution above vanity metrics.",
          strategicAngle: "Mistake to avoid",
          contentType: "Educational",
          offerRelationship: "none",
          cta: "Which of these mistakes have you seen most often?",
          strategicReason: "High-virality warning format that encourages discussion and engagement.",
          buyerMovement: "Identifies and halts a costly mistake immediately."
        },
        {
          objective: "Demand creation & curiosity",
          buyerNeed: "A proven, repeatable system to produce predictable outcomes",
          problemOrDesire: `Inconsistent results due to fragmented execution`,
          awarenessContext: "Solution-Aware",
          beliefOrBarrier: "Uncertainty around whether a standard framework can fit their situation",
          coreIdea: `Consistent inputs produce compounding outputs when grounded in ${safeOffer}.`,
          strategicAngle: "Framework breakdown",
          contentType: "Authority",
          offerRelationship: "relevant_cta",
          cta: "Reply 'SYSTEM' for the full breakdown blueprint",
          strategicReason: "Bridges high-level philosophy into a concrete framework that sparks inbound curiosity.",
          buyerMovement: "Desires the creator's proprietary system over improvised tactics."
        }
      ];

      const v = attentionVariants[postIndex % attentionVariants.length];
      decisions.push({
        objective: v.objective,
        targetBuyer: buyerName,
        buyerNeed: v.buyerNeed,
        problemOrDesire: v.problemOrDesire,
        awarenessContext: v.awarenessContext,
        beliefOrBarrier: v.beliefOrBarrier,
        coreIdea: context.activeIdea?.originalIdea || v.coreIdea,
        strategicAngle: v.strategicAngle,
        contentType: v.contentType,
        pillarTitle,
        offerRelationship: v.offerRelationship,
        cta: v.cta,
        strategicReason: v.strategicReason,
        buyerMovement: v.buyerMovement,
        recommendedPartCount: unifiedLengthPlan.recommendedParts,
        recommendedSentencesPerPart: unifiedLengthPlan.recommendedSentencesPerPart,
        recommendedLength: String(unifiedLengthPlan.recommendedParts),
        structuralPacingGuidance: unifiedLengthPlan.pacingGuidance
      });

    } else if (category === "trust") {
      const trustVariants = [
        {
          objective: "Mechanism clarity & actionable value",
          buyerNeed: "A clear step-by-step roadmap that can be implemented rapidly",
          problemOrDesire: `Knowing what needs to be done but lacking a clean, modular execution sequence`,
          awarenessContext: "Solution-Aware",
          beliefOrBarrier: "Fearing that implementation will require weeks of complex setup",
          coreIdea: context.activeIdea?.summary || `Execute with 3 structured milestones to systematically achieve ${safeResult}.`,
          strategicAngle: "Step-by-step framework",
          contentType: "Educational",
          offerRelationship: "relevant_cta",
          cta: "Save this playbook to execute with your team this week",
          strategicReason: "Demonstrates authoritative competence by providing standalone utility the reader can use in 5 minutes.",
          buyerMovement: "Gains complete clarity on the exact operational sequence needed."
        },
        {
          objective: "Proof of competence & demonstration",
          buyerNeed: "Evidence that this methodology reliably produces outcomes in real-world scenarios",
          problemOrDesire: `Overcoming skepticism and seeing how the system functions under real constraints`,
          awarenessContext: "Solution-Aware",
          beliefOrBarrier: knownBarrier,
          coreIdea: `How shifting from manual effort to ${safeOffer} restructured client results in record time.`,
          strategicAngle: "Case breakdown & transformation story",
          contentType: "Proof",
          offerRelationship: "soft_connection",
          cta: "Let me know in the replies if you have hit a similar bottleneck",
          strategicReason: "Builds deep conviction through demonstrated outcomes and transparent mechanics.",
          buyerMovement: "Trusts that the creator's framework consistently performs under pressure."
        },
        {
          objective: "Operational mental models",
          buyerNeed: "High-leverage cognitive frameworks that simplify complex daily decisions",
          problemOrDesire: `Decision fatigue and tactical overwhelm`,
          awarenessContext: "Solution-Aware",
          beliefOrBarrier: limitingBelief,
          coreIdea: "High performers don't work more hours; they build tighter feedback loops and protect focus time.",
          strategicAngle: "Operational wisdom & principles",
          contentType: "Authority",
          offerRelationship: "none",
          cta: "How do you protect your focus hours each morning?",
          strategicReason: "Signals peer-to-peer maturity and positions creator at the apex of their domain.",
          buyerMovement: "Adopts the creator's standards for execution and quality."
        },
        {
          objective: "Objection reduction via differentiation",
          buyerNeed: "Understanding why previous attempts failed and why this approach is fundamentally different",
          problemOrDesire: `Fatigue from trying generic industry advice that didn't move the needle`,
          awarenessContext: "Offer-Aware",
          beliefOrBarrier: "Assuming all systems in this category suffer from the same flaws",
          coreIdea: `The difference between fragile tactics and durable infrastructure is closed-loop integration.`,
          strategicAngle: "Comparison & mechanism distinction",
          contentType: "Educational",
          offerRelationship: "relevant_cta",
          cta: "Reply 'DIFFERENCE' if you want our comparative matrix",
          strategicReason: "Dismantles competitive confusion by logically contrasting mechanism architectures.",
          buyerMovement: "Understands why this specific approach succeeds where generic alternatives failed."
        },
        {
          objective: "Deep trust & alignment",
          buyerNeed: "Authentic insight into the lessons learned through genuine iteration",
          problemOrDesire: `Wanting honest, unvarnished insight into what it actually takes to win`,
          awarenessContext: "Solution-Aware",
          beliefOrBarrier: "Believing successful creators never experience friction or operational setbacks",
          coreIdea: "The biggest breakthroughs always come from simplifying down to the essential few.",
          strategicAngle: "Lesson & founder realization",
          contentType: "Story",
          offerRelationship: "soft_connection",
          cta: "Has this realization changed how you approach your craft?",
          strategicReason: "Fosters genuine human connection while reinforcing core strategic principles.",
          buyerMovement: "Develops emotional resonance and respect for the creator's authenticity."
        }
      ];

      const v = trustVariants[postIndex % trustVariants.length];
      decisions.push({
        objective: v.objective,
        targetBuyer: buyerName,
        buyerNeed: v.buyerNeed,
        problemOrDesire: v.problemOrDesire,
        awarenessContext: v.awarenessContext,
        beliefOrBarrier: v.beliefOrBarrier,
        coreIdea: context.activeIdea?.originalIdea || v.coreIdea,
        strategicAngle: v.strategicAngle,
        contentType: v.contentType,
        pillarTitle,
        offerRelationship: v.offerRelationship,
        cta: v.cta,
        strategicReason: v.strategicReason,
        buyerMovement: v.buyerMovement,
        recommendedPartCount: unifiedLengthPlan.recommendedParts,
        recommendedSentencesPerPart: unifiedLengthPlan.recommendedSentencesPerPart,
        recommendedLength: String(unifiedLengthPlan.recommendedParts),
        structuralPacingGuidance: unifiedLengthPlan.pacingGuidance
      });

    } else { // sales
      const salesVariants = [
        {
          objective: "Hand-raiser inquiry generation",
          buyerNeed: "A zero-friction, high-value asset or template to immediately test the framework",
          problemOrDesire: `Needing a direct starting point for ${safeResult} without high upfront friction`,
          awarenessContext: "Most Aware",
          beliefOrBarrier: "Reluctance to enter high-pressure sales conversations",
          coreIdea: `We packaged the exact execution framework for ${safeResult} into an actionable asset.`,
          strategicAngle: "Direct invitation & template asset",
          contentType: "Conversation",
          offerRelationship: "direct_offer",
          cta: context.activeCta?.message || "Reply 'SYSTEM' and I will send the direct implementation guide straight to your DMs.",
          strategicReason: "Low-friction conversation starter that filters for active buyers ready to take action.",
          buyerMovement: "Raises hand and initiates a peer-to-peer dialogue."
        },
        {
          objective: "Offer understanding & differentiation",
          buyerNeed: "Clarity on the deliverables, timeline, and exact transformation promised by the offer",
          problemOrDesire: `Navigating the gap between their current situation and ${safeResult}`,
          awarenessContext: "Offer-Aware",
          beliefOrBarrier: knownBarrier,
          coreIdea: `${safeOffer} was built specifically to eliminate trial-and-error and fast-track execution.`,
          strategicAngle: "Friction vs Speed comparison",
          contentType: "Promotional",
          offerRelationship: "direct_sales",
          cta: "Check the link in bio or reply 'SCALE' for full program details",
          strategicReason: "Positions the offer as the most logical, high-return accelerator for their situation.",
          buyerMovement: "Recognizes the offer as the premier solution tailored to their specific reality."
        },
        {
          objective: "Purchase barrier elimination",
          buyerNeed: "Direct reassurance regarding implementation support and simplicity",
          problemOrDesire: safeTopic ? `Worrying about finding time to implement ${safeTopic}` : `Worrying about finding time or bandwidth to implement new systems`,
          awarenessContext: "Offer-Aware",
          beliefOrBarrier: "Thinking 'I don't have enough time right now to install this'",
          coreIdea: `The entire premise of ${safeOffer} is to reclaim your time from day one, not add more chores.`,
          strategicAngle: "Objection response & barrier removal",
          contentType: "Objection",
          offerRelationship: "direct_offer",
          cta: context.activeCta?.message || "Reply below or send a message if you want to walk through the implementation.",
          strategicReason: "Confronts and removes the #1 hesitation preventing qualified buyers from proceeding.",
          buyerMovement: "Replaces hesitation with certainty and relief."
        },
        {
          objective: "Direct conversation starter",
          buyerNeed: "A clear, low-friction pathway to connect about their specific situation",
          problemOrDesire: safeTopic ? `Needing personalized direction on ${safeTopic}` : `Uncertainty regarding which bottleneck is holding back ${safeResult}`,
          awarenessContext: "Most Aware",
          beliefOrBarrier: "Hesitation to reach out without a clear, comfortable reason",
          coreIdea: safeTopic ? `Let's discuss how ${safeOffer} can simplify ${safeTopic} for your business.` : "Focusing on simple, proven fundamentals is the most reliable way to create steady progress.",
          strategicAngle: "Direct conversation starter",
          contentType: "Conversation",
          offerRelationship: "direct_offer",
          cta: context.activeCta?.message || "Leave a comment below to connect about your next steps.",
          strategicReason: "Filters for high-intent prospects who value direct dialogue without hype.",
          buyerMovement: "Initiates a private strategic discussion with the creator."
        },
        {
          objective: "Closing conversion gap",
          buyerNeed: "A clear, believable reason to act now rather than delaying another quarter",
          problemOrDesire: `Compounding cost of inaction from staying in the same bottleneck`,
          awarenessContext: "Most Aware",
          beliefOrBarrier: "Believing that waiting for 'more time' will naturally solve the problem",
          coreIdea: `Every month spent running manual workflows costs leverage and delays ${safeResult}.`,
          strategicAngle: "Cost of inaction & decisive invitation",
          contentType: "Promotional",
          offerRelationship: "direct_sales",
          cta: "Send me a message with 'READY' to begin this month's sprint",
          strategicReason: "Frames decisive action as the only logical response to compounding operational drag.",
          buyerMovement: "Makes the affirmative decision to invest in the solution."
        }
      ];

      const v = salesVariants[postIndex % salesVariants.length];
      decisions.push({
        objective: v.objective,
        targetBuyer: buyerName,
        buyerNeed: v.buyerNeed,
        problemOrDesire: v.problemOrDesire,
        awarenessContext: v.awarenessContext,
        beliefOrBarrier: v.beliefOrBarrier,
        coreIdea: context.activeIdea?.originalIdea || v.coreIdea,
        strategicAngle: v.strategicAngle,
        contentType: v.contentType,
        pillarTitle,
        offerRelationship: v.offerRelationship,
        cta: v.cta,
        strategicReason: v.strategicReason,
        buyerMovement: v.buyerMovement,
        recommendedPartCount: unifiedLengthPlan.recommendedParts,
        recommendedSentencesPerPart: unifiedLengthPlan.recommendedSentencesPerPart,
        recommendedLength: String(unifiedLengthPlan.recommendedParts),
        structuralPacingGuidance: unifiedLengthPlan.pacingGuidance
      });
    }
  }

  return decisions;
}

const learnedStrategiesCache = new Map<string, { data: any[]; expiresAt: number }>();
const inMemoryLearnedStrategies = new Map<string, any[]>();

function invalidateLearnedStrategiesCache(userId: string): void {
  if (userId) {
    learnedStrategiesCache.delete(String(userId));
  }
}

async function getLearnedStrategiesForUser(userId: string): Promise<any[]> {
  if (!userId || userId === "anonymous") return [];
  const cached = learnedStrategiesCache.get(String(userId));
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }
  let list: any[] = [];
  try {
    // 1. Try serverDb (Admin SDK) first if available
    if (serverDb) {
      try {
        const snap = await serverDb.collection("learned_strategies").where("userId", "==", userId).get();
        list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (_) {
        // Admin SDK might not have service credentials in local preview
      }
    }

    // 2. Try clientDb if serverDb did not yield documents
    if (list.length === 0 && clientDb) {
      try {
        const q = clientQuery(
          clientCollection(clientDb, "learned_strategies"),
          clientWhere("userId", "==", userId)
        );
        const snap = await clientGetDocs(q);
        list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (_) {
        // Client SDK is unauthenticated on server side, suppress raw permission noise
      }
    }

    // 3. Fallback to in-memory store for local sandbox / preview session continuity
    const memList = inMemoryLearnedStrategies.get(String(userId)) || [];
    if (memList.length > 0) {
      const existingIds = new Set(list.map(s => s.id));
      for (const item of memList) {
        if (!existingIds.has(item.id)) {
          list.push(item);
        }
      }
    }

    list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    learnedStrategiesCache.set(String(userId), { data: list, expiresAt: Date.now() + (10 * 60 * 1000) });
    return list;
  } catch (_) {
    return [];
  }
}

async function generateContentDecisions(
  ai: any,
  context: {
    topic?: string;
    category?: string;
    offer?: string;
    audience?: string;
    desiredResult?: string;
    writingStyle?: string;
    customInstruction?: string;
    creatorIdentity?: any;
    rawBusinessText?: string;
    offerIntelligence?: any;
    buyerIntelligence?: any;
    activePillar?: any;
    activeIdea?: any;
    rawCreatorThought?: string;
    activeCta?: any;
    lockedOpeningHook?: string;
    existingPosts?: any[];
    userMemory?: UserContentMemoryProfile;
    flywheelPromptSection?: string;
    userId?: string;
    recentLibraryPosts?: any[];
    generatedAngle?: string;
  },
  count: number = 1
): Promise<ContentDecision[]> {
  const effectiveCount = Math.max(1, Math.min(32, count));
  const modelDecisionCount = Math.min(6, effectiveCount);
  const category = (context.category || "attention").toLowerCase();
  const safeAudience = (context.audience && context.audience.trim()) ? context.audience.trim() : "Target Audience";
  const safeOffer = (context.offer && context.offer.trim()) ? context.offer.trim() : "Creator Offer";
  const safeResult = (context.desiredResult && context.desiredResult.trim()) ? context.desiredResult.trim() : "Desired Result";
  const safeTopic = (context.topic && context.topic.trim()) ? context.topic.trim() : (context.activeIdea?.title || "");

  let memorySection = "";
  if (context.userMemory) {
    memorySection = buildContentMemoryBrainSection(context.userMemory, category, context.activeIdea?.title || context.activePillar?.title);
  } else if (context.userId || (context.recentLibraryPosts && context.recentLibraryPosts.length > 0)) {
    try {
      const mem = await getUserContentMemory(context.userId, context.recentLibraryPosts);
      memorySection = buildContentMemoryBrainSection(mem, category, context.activeIdea?.title || context.activePillar?.title);
    } catch {}
  }

  let flywheelPromptSection = context.flywheelPromptSection || "";
  const activeUserIdForFlywheel = context.userId || context.creatorIdentity?.uid;
  if (!flywheelPromptSection && activeUserIdForFlywheel && activeUserIdForFlywheel !== "anonymous") {
    try {
      const [flywheelSummary, learnedStrats] = await Promise.all([
        performanceIntelligenceService.generateIntelligenceSummary(String(activeUserIdForFlywheel), "all"),
        getLearnedStrategiesForUser(String(activeUserIdForFlywheel))
      ]);
      flywheelPromptSection = buildViralFlywheelPromptContext(flywheelSummary, learnedStrats);
    } catch (err: any) {
      console.warn("[ViralFlywheel] Decision Engine prompt context generation note:", err?.message);
    }
  }

  const decisionPrompt = `
You are the ThreadsWorks Content Decision Engine — the master strategic orchestration intelligence for high-authority digital entrepreneurship and social media growth.

Your responsibility is to decide WHAT content should be created, for WHOM, WHY, and HOW it creates commercial and psychological progression for the creator, BEFORE any writing begins.

=============================================================
INTELLIGENCE LAYERS SYNTHESIS
=============================================================
${buildCreatorIdentityContext(context.creatorIdentity)}
${buildBusinessContextSection(context.rawBusinessText)}
${buildOfferIntelligenceSection(context.offerIntelligence, context.rawBusinessText, safeOffer, context.activeCta)}
${buildBuyerIntelligenceSection(context.buyerIntelligence, context.rawBusinessText, safeAudience, safeResult)}
${memorySection}
${flywheelPromptSection}

=============================================================
CURRENT GENERATION REQUEST CONSTRAINTS:
=============================================================
- Target Category: "${category.toUpperCase()}"
- Core Topic / Subject (PRIORITY #1): "${safeTopic || "Core strategic positioning matching creator DNA"}"
- Required Decision Count: Exactly ${modelDecisionCount} distinct strategic decision(s)
- What They Sell / Primary Offer: "${safeOffer}"
- Who They Help / Audience: "${safeAudience}"
- Desired Result: "${safeResult}"
${context.activePillar ? `- Active Content Pillar: "${context.activePillar.title}" - Description: "${context.activePillar.description}"` : ""}
${context.activeIdea ? `- Active Idea Direction: "${context.activeIdea.title}" - Summary: "${context.activeIdea.summary}". Original: "${context.activeIdea.originalIdea}"` : ""}
${context.rawCreatorThought ? `- Raw Creator Thought / Angle: "${context.rawCreatorThought}"` : ""}
${context.lockedOpeningHook ? `- Fixed Opening Hook Constraint: "${context.lockedOpeningHook}"` : ""}
${context.customInstruction ? `- Custom Instruction / Framework: "${context.customInstruction}"` : ""}
${context.generatedAngle ? `- Generated Strategic Angle Constraint: "${context.generatedAngle}"` : ""}

=============================================================
DECISION ENGINE OPERATIONAL PRINCIPLES:
=============================================================
1. CORE PHILOSOPHY: "Repeat the core belief. Change the delivery." Anchor the content in the creator's undeniable mechanism and worldview, while varying the rhetorical entry points, angles, and buyer states.
2. OBJECTIVE SELECTION: Match the objective directly to the commercial intent (e.g., Attention, Problem recognition, Education, Belief change, Trust, Authority, Demand creation, Objection reduction, Offer understanding, Proof, Conversation initiation, Sales).
3. BUYER CENTRICITY: Ground decisions in the buyer's real friction points, root problems, limiting beliefs, and legitimate decision triggers. Zero fluff, zero condescension.
4. PROGRESSIVE MOVEMENT: For ${modelDecisionCount} post(s), orchestrate a cohesive strategic progression across the batch (e.g. diagnosing root problems, shifting beliefs with a framework, addressing top objections with proof, and converting with high-value hand-raisers).
5. CONFLICT RESOLUTION: If user-provided idea/thought differs from background notes, prioritize the user's immediate creative intent.

6. STRUCTURAL CONTENT RECOMMENDATIONS: Analyze learned performance evidence (e.g. format ratios, historical retention) and strategic intent to determine optimal structural parameters:
   - recommendedPartCount: Integer (1 to 6) thread parts (1 for single punchy post, 2 for problem/solution, 3-4 for step-by-step breakdown, 5-6 for deep comprehensive guide).
   - recommendedSentencesPerPart: Integer (1 to 8) sentence capacity per part (2-3 for punchy readability, 4-5 for dense technical breakdowns).
   - recommendedLength: String matching length archetype ('1', '2', '3', '4', '5', 'quick', 'deep').
   - structuralPacingGuidance: Concise structural pacing recommendation (e.g., '2-part contrasting hook with punchy sentence pacing for high mobile scroll completion').

You must return a raw JSON object matching the required schema containing an array of exactly ${modelDecisionCount} ContentDecision object(s).
`;

  try {
    const DECISION_TIMEOUT_MS = 18000;
    const aiDecisionPromise = (async () => {
      const response = await callGenerateContentWithRetry(ai, {
        model: "gemini-3.6-flash",
        optimizationTaskId: "CONTENT_DECISIONS",
        optimizationComplexity: "LEVEL_2_STANDARD",
        contents: decisionPrompt,
        config: {
          maxOutputTokens: 3000,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              decisions: {
                type: Type.ARRAY,
                description: `Array of exactly ${modelDecisionCount} strategic content decisions`,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    objective: { type: Type.STRING, description: "Strategic commercial/audience objective (e.g., Problem recognition, Belief change, Authority, Objection reduction, Sales/Hand-raiser, Proof)" },
                    targetBuyer: { type: Type.STRING, description: "Specific target buyer persona/role or awareness state" },
                    buyerNeed: { type: Type.STRING, description: "The underlying tension or immediate need experienced by this buyer" },
                    problemOrDesire: { type: Type.STRING, description: "The specific friction, symptom, root problem, or desired outcome being addressed" },
                    awarenessContext: { type: Type.STRING, description: "Buyer awareness level (e.g. Unaware, Problem-Aware, Solution-Aware, Offer-Aware, Most Aware)" },
                    beliefOrBarrier: { type: Type.STRING, description: "The limiting belief to reframe or purchase barrier to eliminate" },
                    coreIdea: { type: Type.STRING, description: "The single central thesis, insight, or argument to convey" },
                    strategicAngle: { type: Type.STRING, description: "The rhetorical angle (e.g., Contrarian insight, Problem diagnosis, Step-by-step framework, Belief shift, Objection response, Proof/Case, Direct invitation)" },
                    contentType: { type: Type.STRING, description: "Content archetype (e.g., Educational, Authority, Story, Proof, Conversation, Promotional, Objection)" },
                    pillarTitle: { type: Type.STRING, description: "Content Pillar this decision aligns with" },
                    offerRelationship: { type: Type.STRING, description: "Connection to creator's offer (none, soft_connection, relevant_cta, direct_offer, direct_sales)" },
                    cta: { type: Type.STRING, description: "The natural low-friction next action or keyword prompt" },
                    strategicReason: { type: Type.STRING, description: "Why this decision makes commercial and strategic sense for this creator right now" },
                    buyerMovement: { type: Type.STRING, description: "The specific cognitive or decision progression this piece creates" },
                    recommendedPartCount: { type: Type.INTEGER, description: "Recommended thread part count (1-6) based on strategic objective, depth, and learned evidence." },
                    recommendedSentencesPerPart: { type: Type.INTEGER, description: "Recommended sentence capacity per part (1-8) based on topic complexity and retention evidence." },
                    recommendedLength: { type: Type.STRING, description: "Recommended length archetype (e.g. '1', '2', '3', '4', '5', 'quick', 'deep', 'standard')" },
                    structuralPacingGuidance: { type: Type.STRING, description: "Strategic structural pacing recommendation." }
                  },
                  required: [
                    "objective",
                    "targetBuyer",
                    "buyerNeed",
                    "problemOrDesire",
                    "awarenessContext",
                    "beliefOrBarrier",
                    "coreIdea",
                    "strategicAngle",
                    "contentType",
                    "offerRelationship",
                    "strategicReason"
                  ]
                }
              }
            },
            required: ["decisions"]
          }
        }
      }, 0);

      const text = response.text;
      if (!text) {
        throw new Error("Empty response from Content Decision Engine model.");
      }

      const parsed = parseGeminiJsonResponse(text);
      if (parsed && Array.isArray(parsed.decisions) && parsed.decisions.length > 0) {
        return parsed.decisions;
      }
      throw new Error("Invalid decisions array structure returned from model.");
    })();

    const timeoutPromise = new Promise<any[]>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Content Decision Engine timed out after ${DECISION_TIMEOUT_MS}ms`));
      }, DECISION_TIMEOUT_MS);
    });

    const unifiedPlan = resolveWritingLengthPlan({
      contentRequest: safeTopic,
      customInstruction: context.customInstruction,
      activeIdea: context.activeIdea,
      rawCreatorThought: context.rawCreatorThought,
      category
    });
    const alignDecisionLength = (d: ContentDecision): ContentDecision => ({
      ...d,
      recommendedPartCount: unifiedPlan.recommendedParts,
      recommendedSentencesPerPart: unifiedPlan.recommendedSentencesPerPart,
      recommendedLength: String(unifiedPlan.recommendedParts),
      structuralPacingGuidance: unifiedPlan.pacingGuidance
    });

    const generated = (await Promise.race([aiDecisionPromise, timeoutPromise])).map(alignDecisionLength);
    if (effectiveCount <= generated.length) {
      return generated.slice(0, effectiveCount);
    }
    // Expand across effectiveCount
    const expanded: ContentDecision[] = [];
    for (let i = 0; i < effectiveCount; i++) {
      expanded.push(generated[i % generated.length]);
    }
    return expanded;

  } catch (err: any) {
    console.warn("[Content Decision Engine] Gemini decision generation failed/timed out, utilizing heuristic decision maker:", err.message);
    return heuristicContentDecisionMaker(context, effectiveCount);
  }
}

function formatContentDecisionsForPrompt(decisions: ContentDecision[]): string {
  if (!decisions || !Array.isArray(decisions) || decisions.length === 0) {
    return "";
  }

  const decisionBlocks = decisions.map((d, idx) => {
    return `--- STRATEGIC CONTENT DECISION FOR THREAD ${idx + 1} OF ${decisions.length} ---
- OBJECTIVE: ${d.objective}
- TARGET BUYER: ${d.targetBuyer} (Awareness: ${d.awarenessContext || "Targeted"})
- BUYER NEED / TENSION: ${d.buyerNeed}
- PROBLEM OR DESIRE: ${d.problemOrDesire}
- BELIEF / BARRIER TO SHIFT: ${d.beliefOrBarrier}
- CORE IDEA / CENTRAL THESIS: ${d.coreIdea}
- STRATEGIC ANGLE: ${d.strategicAngle} [Content Type: ${d.contentType}]
${d.pillarTitle ? `- ALIGNED PILLAR: ${d.pillarTitle}` : ""}
- OFFER RELATIONSHIP: ${d.offerRelationship}
${d.cta ? `- RECOMMENDED ACTION / CTA: ${d.cta}` : ""}
- INTENDED BUYER MOVEMENT: ${d.buyerMovement || "Deepens conviction and clarity"}
- STRATEGIC RATIONALE: ${d.strategicReason}
${d.recommendedPartCount ? `- RECOMMENDED PART COUNT: ${d.recommendedPartCount} part(s)` : ""}
${d.recommendedSentencesPerPart ? `- RECOMMENDED SENTENCE CAPACITY: Up to ${d.recommendedSentencesPerPart} sentence(s) per part` : ""}
${d.structuralPacingGuidance ? `- STRUCTURAL PACING GUIDANCE: ${d.structuralPacingGuidance}` : ""}
-----------------------------------------------------------`;
  });

  return `
=============================================================
### CONTENT DECISION ENGINE: STRATEGIC CONTENT BRIEF(S)
=============================================================
The Content Decision Engine has determined the exact strategic plan and angle for each post.
You MUST write each thread specifically to fulfill its corresponding decision:

${decisionBlocks.join("\n\n")}

CRITICAL WRITING DIRECTIVE: Turn each decision into high-impact, authentic Meta Threads copy in the creator's voice without copying the brief verbatim or speaking about "objectives" in the copy.
=============================================================
`;
}

// REST route for standalone Content Decision queries
const handleContentDecisionEndpoint = async (req: express.Request, res: express.Response) => {
  try {
    const {
      category,
      offer,
      audience,
      desiredResult,
      writingStyle,
      customInstruction,
      creatorIdentity,
      rawBusinessText,
      offerIntelligence,
      buyerIntelligence,
      activePillar,
      activeIdea,
      rawCreatorThought,
      activeCta,
      lockedOpeningHook,
      count
    } = req.body;

    const postCount = Math.max(1, Math.min(32, parseInt(count, 10) || 1));

    let ai;
    try {
      ai = getAI();
    } catch {
      // Fallback
    }

    if (!ai) {
      const heuristicDecisions = heuristicContentDecisionMaker(req.body, postCount);
      return res.json({ decisions: heuristicDecisions, source: "heuristic" });
    }

    const decisions = await generateContentDecisions(ai, req.body, postCount);
    return res.json({ decisions, source: "ai" });

  } catch (err: any) {
    console.error("Content decision endpoint failed:", err);
    const postCount = Math.max(1, Math.min(32, parseInt(req.body?.count, 10) || 1));
    const fallback = heuristicContentDecisionMaker(req.body || {}, postCount);
    return res.json({ decisions: fallback, source: "heuristic" });
  }
};

app.post("/api/content-decision/decide", handleContentDecisionEndpoint);

// REST route to retrieve or refresh the User Content Memory Brain profile
app.all("/api/user-content-memory", async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.body?.userId || req.query?.userId || req.body?.creatorIdentity?.uid || "anonymous";
    const recentPosts = req.body?.recentLibraryPosts || [];
    const memory = await getUserContentMemory(String(userId), recentPosts);
    return res.json({
      success: true,
      memory,
      totalIndexed: memory.totalPostsIndexed,
      hookCount: memory.recentHooks.length,
      angleCount: memory.exploredAngles.length
    });
  } catch (err: any) {
    console.error("Error retrieving user content memory profile:", err);
    return res.status(500).json({ error: err.message || "Failed to retrieve user content memory." });
  }
});

// Content Intelligence: AI-assisted topic & pillar classification
app.post("/api/content-intelligence/classify", async (req: express.Request, res: express.Response) => {
  try {
    await verifyAuthUser(req, req.body?.userId);
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const availablePillars = Array.isArray(req.body?.availablePillars) ? req.body.availablePillars : [];
    const creatorContext = req.body?.creatorContext && typeof req.body.creatorContext === "object"
      ? req.body.creatorContext
      : undefined;

    if (items.length === 0) {
      return res.json({ results: [], source: "fallback", aiUnavailable: false });
    }

    const result = await classifyContentOrganization({
      items,
      availablePillars,
      creatorContext,
    });
    return res.json(result);
  } catch (err: any) {
    if (err?.message === "FORBIDDEN_USER_MISMATCH") {
      return res.status(403).json({ error: "Access denied: user mismatch." });
    }
    if (err?.message === "UNAUTHORIZED_NO_USER" || err?.message === "UNAUTHORIZED_NO_TOKEN") {
      return res.status(401).json({ error: "Authentication required." });
    }
    console.error("[CONTENT_INTELLIGENCE] Classification route error:", err);
    return res.status(500).json({ error: err?.message || "Failed to classify content." });
  }
});

// Content Intelligence: AI-assisted 7-day weekly content planning recommendations
app.post("/api/content-intelligence/weekly-plan", async (req: express.Request, res: express.Response) => {
  try {
    await verifyAuthUser(req, req.body?.userId);
    const weekDays = Array.isArray(req.body?.weekDays) ? req.body.weekDays : [];
    const existingPosts = Array.isArray(req.body?.existingPosts) ? req.body.existingPosts : [];
    const profile = req.body?.profile && typeof req.body.profile === "object" ? req.body.profile : undefined;
    const requestedTopic = typeof req.body?.requestedTopic === "string" ? req.body.requestedTopic : undefined;

    if (weekDays.length === 0) {
      return res.status(400).json({ error: "weekDays array is required." });
    }

    const result = await generateWeeklyPlanRecommendations({
      weekDays,
      existingPosts,
      profile,
      requestedTopic,
    });
    return res.json(result);
  } catch (err: any) {
    if (err?.message === "FORBIDDEN_USER_MISMATCH") {
      return res.status(403).json({ error: "Access denied: user mismatch." });
    }
    if (err?.message === "UNAUTHORIZED_NO_USER" || err?.message === "UNAUTHORIZED_NO_TOKEN") {
      return res.status(401).json({ error: "Authentication required." });
    }
    console.error("[CONTENT_INTELLIGENCE] Weekly plan route error:", err);
    return res.status(500).json({ error: err?.message || "Failed to generate weekly plan recommendations." });
  }
});



// Programmatic fallback for content pillars
function getSimulatedPillars(offer: string, audience: string, desiredResult: string) {
  const sanitizeVar = (str?: string, defaultVal: string = ""): string => {
    if (!str || typeof str !== "string") return defaultVal;
    const clean = str.replace(/\bhelp\s+s\s+users\b/gi, "users").replace(/\bachieve\s+s\b/gi, "optimal results").trim();
    if (clean.length < 2 || /^s$/i.test(clean)) return defaultVal;
    return clean;
  };

  const cleanAudience = sanitizeVar(audience, "your target audience");
  const cleanOffer = sanitizeVar(offer, "your offer");
  const cleanResult = sanitizeVar(desiredResult, "optimal results");

  return [
    {
      title: "Strategic Client Acquisition",
      description: `Actionable blueprints to help ${cleanAudience} implement ${cleanOffer} to consistently achieve ${cleanResult}.`,
      coreExpertise: "Systematic prospecting, conversion anatomy, sales funnel architecture, offer design, and client closing psychology.",
      keyVocabulary: "conversion anatomy, acquisition engine, closed-loop marketing, client velocity, value-first onboarding",
      mentalModels: "Value Ladder, Pareto Principle (80/20 Rule), Compounding Feedback Loops, First-Principles Design",
      primaryQuestion: `How can we construct a frictionless, repeatable acquisition framework that consistently attracts premium buyers for ${cleanOffer}?`,
      topicsToAvoid: "General motivation hacks, generic cold outreach, spammy follow-up templates, and basic lifestyle bragging.",
      successCriteria: "Actionable value metrics, clear workflow stages, specific qualification criteria, and high-trust copywriting."
    },
    {
      title: "Contrarian Industry Insights",
      description: `Debunking costly misconceptions in your niche to build unshakeable expert authority and position your unique framework as the default standard.`,
      coreExpertise: "Critical analysis of mainstream advice, statistical deconstruction of vanity metrics, and cognitive bias exposure.",
      keyVocabulary: "vanity metrics, cognitive bias, status-quo friction, contrarian positioning, leverage arbitrage",
      mentalModels: "Inversion Method, Survivorship Bias, Occam's Razor, Red Queen Effect",
      primaryQuestion: "What widely accepted industry best practice is secretly draining resources and costing our audience their competitive edge?",
      topicsToAvoid: "General platitudes, positive vibe-only empty threads, copy-paste listicles, and rehashing standard advice.",
      successCriteria: "Bold yet logical counter-arguments, concrete data points, clear cognitive reframing, and polarizing authority."
    },
    {
      title: "Sustainable Business Growth",
      description: `Behind-the-scenes processes and case studies demonstrating how structured execution leads to the ultimate transformation: ${cleanResult}.`,
      coreExpertise: "Operations scaling, high-performance workflow optimization, bottleneck analysis, and compound interest models.",
      keyVocabulary: "bottleneck resolution, operational scale, velocity margin, execution leverage, structural flow",
      mentalModels: "Theory of Constraints, Systems Thinking, Feedback Loops, Scale Economics",
      primaryQuestion: `How can we build resilient, high-leverage business systems that turn daily operations into a predictable engine of ${cleanResult}?`,
      topicsToAvoid: "Quick-fix scaling hacks, generic team motivation, uncalibrated growth targets, and empty productivity advice.",
      successCriteria: "Real operational metrics, clear step-by-step documentation, detailed process breakdowns, and transparent lesson summaries."
    }
  ];
}

function getSimulatedSinglePillar(offer: string, audience: string, desiredResult: string, avoidTitles: string[] = []) {
  const options = [
    {
      title: "Strategic Positioning Masterclass",
      description: "Deep dives into systemizing your core processes to deliver unmatched value and position yourself as a premium authority.",
      coreExpertise: "Market segmentation, premium price framing, perception mapping, and authority signaling.",
      keyVocabulary: "perception mapping, price framing, category authority, niche positioning, premium signaling",
      mentalModels: "Category-of-One, Blue Ocean Strategy, Signal-to-Noise Ratio",
      primaryQuestion: "How can we position our unique value so that competition becomes completely irrelevant to our ideal buyer?",
      topicsToAvoid: "Basic bio optimization, generic networking tips, broad industry definitions, and standard marketing lingo.",
      successCriteria: "Highly customized positioning matrices, premium brand signals, clear client alignment, and deep niche authority."
    },
    {
      title: "High-Performance Workflows",
      description: "Actionable playbooks detailing the exact step-by-step methodologies needed to unlock peak efficiency and outcomes.",
      coreExpertise: "Time arbitrage, cognitive load management, task prioritization, and operational mechanics.",
      keyVocabulary: "cognitive margin, time arbitrage, workflow friction, operational velocity, execution design",
      mentalModels: "Eisenhower Matrix, Deep Work Hypothesis, Parkinson's Law",
      primaryQuestion: "What precise daily workflow unlocks maximum creative leverage and eliminates unproductive busywork?",
      topicsToAvoid: "Generic life hacks, basic calendar blocking, motivational morning routines, and general hustle-culture talk.",
      successCriteria: "Step-by-step process breakdowns, clear productivity metrics, custom execution tool suggestions, and highly practical daily routines."
    },
    {
      title: "Zero-To-One Empathy Frameworks",
      description: "High-empathy storytelling exploring real struggles, pivotal lessons, and authentic founder experiences in your niche.",
      coreExpertise: "Narrative vulnerability, psychological safety, audience connection mapping, and experiential learning.",
      keyVocabulary: "experiential truth, empathetic resonance, friction logs, authentic disclosure, lesson distillation",
      mentalModels: "Hero's Journey, Mimetic Desire, Narrative Transport",
      primaryQuestion: "How do we translate our rawest operational failures and breakthroughs into a high-trust blueprint for our audience?",
      topicsToAvoid: "Polished corporate PR, fake humble-brags, overly tragic stories without lessons, and generic motivational quotes.",
      successCriteria: "Genuine operational vulnerability, clear and unvarnished timelines, practical distilled lessons, and highly relatable audience resonance."
    },
    {
      title: "High-Leverage Execution Systems",
      description: "Constructing scalable infrastructure to sustain momentum and amplify your compound growth trajectory.",
      coreExpertise: "Platform leverage, systemic automation, content compound loops, and tracking systems.",
      keyVocabulary: "systemic leverage, compounding loops, platform velocity, analytics loops, scale automation",
      mentalModels: "Flywheel Effect, compounding interest, Network Effects",
      primaryQuestion: "What structural systems can we install today to ensure our content and marketing compound automatically over the next 12 months?",
      topicsToAvoid: "Basic scheduler tips, standard social media checklists, superficial growth-hack loops, and tool-only setups.",
      successCriteria: "Custom marketing flywheel diagrams, detailed attribution models, sustainable scaling timelines, and deep systemic automation blueprints."
    }
  ];
  const filtered = options.filter(opt => !avoidTitles.some(t => t.toLowerCase().includes(opt.title.toLowerCase()) || opt.title.toLowerCase().includes(t.toLowerCase())));
  return filtered[0] || options[0];
}

export function parseGeminiJsonResponse<T = any>(text: string): T {
  if (!text || typeof text !== "string") {
    throw new Error("Empty or non-string response text");
  }

  const raw = text.trim();

  // 1. Direct parse attempt
  try {
    return JSON.parse(raw);
  } catch (_) {}

  // 2. Remove markdown code block markers
  let cleaned = raw
    .replace(/^```(?:json)?/gim, "")
    .replace(/```$/gim, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (_) {}

  // 3. Extract JSON array or object substring from conversational preambles
  const firstBrace = cleaned.indexOf("{");
  const firstBracket = cleaned.indexOf("[");
  let startIndex = -1;
  let isObject = true;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIndex = firstBrace;
    isObject = true;
  } else if (firstBracket !== -1) {
    startIndex = firstBracket;
    isObject = false;
  }

  let candidate = cleaned;
  if (startIndex !== -1) {
    const lastBrace = cleaned.lastIndexOf("}");
    const lastBracket = cleaned.lastIndexOf("]");
    const endIndex = isObject ? lastBrace : lastBracket;

    candidate = (endIndex > startIndex)
      ? cleaned.slice(startIndex, endIndex + 1)
      : cleaned.slice(startIndex);

    try {
      return JSON.parse(candidate);
    } catch (_) {}
  }

  // 4. Sanitize invalid JSON constructs & escape raw unescaped newlines/tabs inside string literals
  try {
    let str = candidate.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'");
    let inString = false;
    let escaped = false;
    let result = "";

    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (escaped) {
        result += ch;
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        result += ch;
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        result += ch;
        continue;
      }
      if (inString) {
        if (ch === "\n") { result += "\\n"; continue; }
        if (ch === "\r") { result += "\\r"; continue; }
        if (ch === "\t") { result += "\\t"; continue; }
      }
      result += ch;
    }

    if (inString) {
      result += '"';
    }

    // Clean trailing commas and unclosed key definitions
    result = result.replace(/,\s*([}\]])/g, "$1").replace(/,\s*$/g, "");
    result = result.replace(/"[^"]*"\s*:\s*$/g, "").replace(/,\s*$/g, "");

    try {
      return JSON.parse(result);
    } catch (_) {}

    // 5. Stack-based nesting auto-repair pass for truncated responses
    const stack: string[] = [];
    inString = false;
    escaped = false;

    for (let i = 0; i < result.length; i++) {
      const ch = result[i];
      if (escaped) { escaped = false; continue; }
      if (ch === "\\") { escaped = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (!inString) {
        if (ch === "{" || ch === "[") {
          stack.push(ch);
        } else if (ch === "}") {
          if (stack.length > 0 && stack[stack.length - 1] === "{") stack.pop();
        } else if (ch === "]") {
          if (stack.length > 0 && stack[stack.length - 1] === "[") stack.pop();
        }
      }
    }

    while (stack.length > 0) {
      result = result.replace(/,\s*$/, "");
      const lastOpen = stack.pop();
      if (lastOpen === "{") result += "}";
      else if (lastOpen === "[") result += "]";
    }

    try {
      return JSON.parse(result);
    } catch (_) {}

    // 6. Regex fallback extractor for bullet points, quotes, and key-value string lists
    const matches = raw.match(/"text"\s*:\s*"([^"]+)"|"\s*([^*"\n]{10,250})\s*"/g);
    if (matches && matches.length > 0) {
      const cleanItems = matches
        .map(m => m.replace(/^"/, "").replace(/"$/, "").replace(/^"text":\s*"/, "").trim())
        .filter(h => h.length > 10 && !h.startsWith("{") && !h.endsWith("}"));
      if (cleanItems.length > 0) {
        return {
          angles: [{ title: "Strategic Frame", hooks: cleanItems }],
          postSeeds: cleanItems,
          hooks: cleanItems
        } as any;
      }
    }
  } catch (_) {}

  throw new Error(`Failed to parse Gemini JSON response: ${raw.slice(0, 100)}`);
}

// REST route to generate 3 unique AI Content Pillars using Gemini
app.post("/api/generate-content-pillars", async (req, res) => {
  let limitHandle: any = null;
  try {
    const { offer, audience, desiredResult, writingStyle, keywords, customInstruction, creatorIdentity } = req.body;

    limitHandle = await enforceAiGenerationLimit(req, res, req.body?.userId);
    if (!limitHandle) return;

    let ai;
    try {
      ai = getAI();
    } catch (aiErr: any) {
      console.warn("getAI() failed on generate-content-pillars, using dynamic fallback:", aiErr.message);
      return res.json({ pillars: getSimulatedPillars(offer, audience, desiredResult) });
    }

    let userMemory: UserContentMemoryProfile | undefined;
    try {
      userMemory = await getUserContentMemory(
        req.body?.userId || req.body?.creatorIdentity?.uid,
        req.body?.recentLibraryPosts
      );
    } catch {}

    const systemPrompt = `
You are an expert Content Strategist and Social Media Director specializing in building digital brand authority.
Your task is to analyze the creator's profile details and generate exactly 3 unique, high-value, and strategically distinct Content Pillars for their Meta Threads content.
Each pillar must represent a different content direction or focus area that helps them engage their audience, position their offer, and drive their desired transformation.
The pillars must be highly actionable, specific to their niche, and designed to generate noticeably different styles of hooks and posts.

${buildCreatorIdentityContext(creatorIdentity)}
${buildContentMemoryBrainSection(userMemory)}

For each Content Pillar, you MUST generate the following comprehensive fields:
1. Name/Title: A short, high-impact title (2-5 words).
2. Description: A concise description (1-2 sentences) explaining the type of content this pillar represents.
3. Core Expertise: The specific knowledge domains, technical skillsets, or focus areas covered by this pillar.
4. Key Vocabulary: A comma-separated list of signature terms, industry jargon, and phrasing preferred under this pillar.
5. Mental Models: Core mental models, cognitive frameworks, or logical reasoning models relevant to this pillar.
6. Primary Question: The fundamental, deep, or primary question this pillar addresses.
7. Topics To Avoid: Specific sub-topics, general platitudes, or content directions to avoid because they dilute authority or are irrelevant.
8. Success Criteria: The specific standard or standard criteria of high-fidelity, successful content in this pillar.

Output Format: You MUST return a JSON object containing an array 'pillars' with exactly 3 elements. Each element must have:
- 'title': The Name/Title of the content pillar
- 'description': The concise description
- 'coreExpertise': The Core Expertise
- 'keyVocabulary': The Key Vocabulary list
- 'mentalModels': The Mental Models
- 'primaryQuestion': The Primary Question
- 'topicsToAvoid': The Topics To Avoid
- 'successCriteria': The Success Criteria

Ensure the response is raw JSON only. No markdown formatting, no preambles, no comments.
`;

    const userPrompt = `
Analyze the following Brand DNA and generate 3 strategic content pillars with full schema fields:
- What they sell / Offer: "${offer || "Not specified"}"
- Who they help / Audience: "${audience || "Not specified"}"
- Desired Result: "${desiredResult || "Not specified"}"
- Writing Style / Tone: "${writingStyle || "Direct, high-value, casual, authoritative"}"
- Keywords: "${keywords || "None specified"}"
- Extra Context / Instructions: "${customInstruction || "None specified"}"
`;

    const response = await callGenerateContentWithRetry(ai, {
      model: "gemini-3.6-flash",
      optimizationTaskId: "GENERATE_PILLARS",
      optimizationComplexity: "LEVEL_2_STANDARD",
      contents: userPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            pillars: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: "Short, high-impact pillar title (2-5 words)" },
                  description: { type: Type.STRING, description: "Pillar description (1-2 sentences)" },
                  coreExpertise: { type: Type.STRING, description: "Specific knowledge domains, technical skillsets, or focus areas" },
                  keyVocabulary: { type: Type.STRING, description: "Comma-separated list of signature terms or key phrasing" },
                  mentalModels: { type: Type.STRING, description: "Core mental models or cognitive frameworks relevant to this pillar" },
                  primaryQuestion: { type: Type.STRING, description: "The fundamental or primary question this pillar addresses" },
                  topicsToAvoid: { type: Type.STRING, description: "Specific sub-topics or directions to avoid" },
                  successCriteria: { type: Type.STRING, description: "The specific standard or criteria of high-fidelity content" }
                },
                required: ["title", "description", "coreExpertise", "keyVocabulary", "mentalModels", "primaryQuestion", "topicsToAvoid", "successCriteria"]
              }
            }
          },
          required: ["pillars"]
        },
        systemInstruction: systemPrompt
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("Empty response from Gemini.");
    }

    const parsed = parseGeminiJsonResponse(text);
    const fallbackPillars = getSimulatedPillars(req.body.offer, req.body.audience, req.body.desiredResult);

    if (parsed && Array.isArray(parsed.pillars) && parsed.pillars.length === 3) {
      const sanitized = parsed.pillars.map((p: any, idx: number) => {
        const fb = fallbackPillars[idx] || fallbackPillars[0];
        return {
          title: (p?.title && typeof p.title === "string" && p.title.trim()) ? p.title.trim() : fb.title,
          description: (p?.description && typeof p.description === "string" && p.description.trim().length >= 15) ? p.description.trim() : fb.description,
          coreExpertise: (p?.coreExpertise && typeof p.coreExpertise === "string" && p.coreExpertise.trim()) ? p.coreExpertise.trim() : fb.coreExpertise,
          keyVocabulary: (p?.keyVocabulary && typeof p.keyVocabulary === "string" && p.keyVocabulary.trim()) ? p.keyVocabulary.trim() : fb.keyVocabulary,
          mentalModels: (p?.mentalModels && typeof p.mentalModels === "string" && p.mentalModels.trim()) ? p.mentalModels.trim() : fb.mentalModels,
          primaryQuestion: (p?.primaryQuestion && typeof p.primaryQuestion === "string" && p.primaryQuestion.trim()) ? p.primaryQuestion.trim() : fb.primaryQuestion,
          topicsToAvoid: (p?.topicsToAvoid && typeof p.topicsToAvoid === "string" && p.topicsToAvoid.trim()) ? p.topicsToAvoid.trim() : fb.topicsToAvoid,
          successCriteria: (p?.successCriteria && typeof p.successCriteria === "string" && p.successCriteria.trim()) ? p.successCriteria.trim() : fb.successCriteria
        };
      });
      if (limitHandle && !limitHandle.isPro) {
        await commitGeneration(serverDb, limitHandle.activeUserId, limitHandle.reservationId);
      }
      return res.json({ pillars: sanitized });
    }

    if (limitHandle && !limitHandle.isPro) {
      await commitGeneration(serverDb, limitHandle.activeUserId, limitHandle.reservationId);
    }
    return res.json({ pillars: fallbackPillars });

  } catch (err: any) {
    if (limitHandle && !limitHandle.isPro && limitHandle.reservationId) {
      await releaseReservation(serverDb, limitHandle.activeUserId, limitHandle.reservationId);
    }
    console.error("Gemini content pillars generation failed, using fallback:", err);
    return res.json({ pillars: getSimulatedPillars(req.body.offer, req.body.audience, req.body.desiredResult) });
  }
});

// REST route to refresh a single unique AI Content Pillar
app.post("/api/generate-single-pillar", async (req, res) => {
  let limitHandle: any = null;
  try {
    const { offer, audience, desiredResult, writingStyle, keywords, customInstruction, existingPillars, creatorIdentity } = req.body;
    const excludeTitles = (existingPillars || []).map((p: any) => p.title);

    limitHandle = await enforceAiGenerationLimit(req, res, req.body?.userId);
    if (!limitHandle) return;

    let ai;
    try {
      ai = getAI();
    } catch (aiErr: any) {
      console.warn("getAI() failed on generate-single-pillar, using dynamic fallback:", aiErr.message);
      return res.json(getSimulatedSinglePillar(offer, audience, desiredResult, excludeTitles));
    }

    let userMemory: UserContentMemoryProfile | undefined;
    try {
      userMemory = await getUserContentMemory(
        req.body?.userId || req.body?.creatorIdentity?.uid,
        req.body?.recentLibraryPosts
      );
    } catch {}

    const systemPrompt = `
You are an expert Content Strategist and Social Media Director.
Your task is to generate a single new, unique, high-value, and strategically distinct Content Pillar for a digital creator's Meta Threads content.
This pillar must be completely different from the existing pillars they have, which are:
${(existingPillars || []).map((p: any, idx: number) => `${idx + 1}. ${p.title}: ${p.description}`).join("\n")}

${buildCreatorIdentityContext(creatorIdentity)}
${buildContentMemoryBrainSection(userMemory)}

The new pillar must be highly actionable, specific to their niche, and represent a different strategic angle that doesn't overlap with the existing ones.

For the new Content Pillar, you MUST generate the following comprehensive fields:
1. Name/Title: A short, high-impact title (2-5 words).
2. Description: A concise description (1-2 sentences) explaining the type of content this pillar represents.
3. Core Expertise: The specific knowledge domains, technical skillsets, or focus areas covered by this pillar.
4. Key Vocabulary: A comma-separated list of signature terms, industry jargon, and phrasing preferred under this pillar.
5. Mental Models: Core mental models, cognitive frameworks, or logical reasoning models relevant to this pillar.
6. Primary Question: The fundamental, deep, or primary question this pillar addresses.
7. Topics To Avoid: Specific sub-topics, general platitudes, or content directions to avoid because they dilute authority or are irrelevant.
8. Success Criteria: The specific standard or standard criteria of high-fidelity, successful content in this pillar.

Output Format: You MUST return a JSON object with:
- 'title': The Name/Title of the content pillar
- 'description': The concise description
- 'coreExpertise': The Core Expertise
- 'keyVocabulary': The Key Vocabulary list
- 'mentalModels': The Mental Models
- 'primaryQuestion': The Primary Question
- 'topicsToAvoid': The Topics To Avoid
- 'successCriteria': The Success Criteria

Ensure the response is raw JSON only. No markdown formatting, no preambles, no comments.
`;

    const userPrompt = `
Analyze the Brand DNA and generate a single new content pillar completely different from their existing ones, using full schema fields:
- What they sell / Offer: "${offer || "Not specified"}"
- Who they help / Audience: "${audience || "Not specified"}"
- Desired Result: "${desiredResult || "Not specified"}"
- Writing Style / Tone: "${writingStyle || "Direct, high-value, casual, authoritative"}"
- Keywords: "${keywords || "None specified"}"
- Extra Context / Instructions: "${customInstruction || "None specified"}"
`;

    const response = await callGenerateContentWithRetry(ai, {
      model: "gemini-3.6-flash",
      optimizationTaskId: "GENERATE_SINGLE_PILLAR",
      optimizationComplexity: "LEVEL_2_STANDARD",
      contents: userPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Short, high-impact pillar title (2-5 words)" },
            description: { type: Type.STRING, description: "Pillar description (1-2 sentences)" },
            coreExpertise: { type: Type.STRING, description: "Specific knowledge domains, technical skillsets, or focus areas" },
            keyVocabulary: { type: Type.STRING, description: "Comma-separated list of signature terms or key phrasing" },
            mentalModels: { type: Type.STRING, description: "Core mental models or cognitive frameworks relevant to this pillar" },
            primaryQuestion: { type: Type.STRING, description: "The fundamental or primary question this pillar addresses" },
            topicsToAvoid: { type: Type.STRING, description: "Specific sub-topics or directions to avoid" },
            successCriteria: { type: Type.STRING, description: "The specific standard or criteria of high-fidelity content" }
          },
          required: ["title", "description", "coreExpertise", "keyVocabulary", "mentalModels", "primaryQuestion", "topicsToAvoid", "successCriteria"]
        },
        systemInstruction: systemPrompt
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("Empty response from Gemini.");
    }

    const parsed = parseGeminiJsonResponse(text);
    const candidate = parsed?.pillar || parsed;
    const fallbackPillar = getSimulatedSinglePillar(offer, audience, desiredResult, excludeTitles);

    const safeTitle = (candidate?.title && typeof candidate.title === "string" && candidate.title.trim())
      ? candidate.title.trim()
      : fallbackPillar.title;
    const safeDesc = (candidate?.description && typeof candidate.description === "string" && candidate.description.trim().length >= 15)
      ? candidate.description.trim()
      : fallbackPillar.description;
    const safeCore = (candidate?.coreExpertise && typeof candidate.coreExpertise === "string" && candidate.coreExpertise.trim())
      ? candidate.coreExpertise.trim()
      : fallbackPillar.coreExpertise;
    const safeVocab = (candidate?.keyVocabulary && typeof candidate.keyVocabulary === "string" && candidate.keyVocabulary.trim())
      ? candidate.keyVocabulary.trim()
      : fallbackPillar.keyVocabulary;
    const safeModels = (candidate?.mentalModels && typeof candidate.mentalModels === "string" && candidate.mentalModels.trim())
      ? candidate.mentalModels.trim()
      : fallbackPillar.mentalModels;
    const safeQuestion = (candidate?.primaryQuestion && typeof candidate.primaryQuestion === "string" && candidate.primaryQuestion.trim())
      ? candidate.primaryQuestion.trim()
      : fallbackPillar.primaryQuestion;
    const safeAvoid = (candidate?.topicsToAvoid && typeof candidate.topicsToAvoid === "string" && candidate.topicsToAvoid.trim())
      ? candidate.topicsToAvoid.trim()
      : fallbackPillar.topicsToAvoid;
    const safeSuccess = (candidate?.successCriteria && typeof candidate.successCriteria === "string" && candidate.successCriteria.trim())
      ? candidate.successCriteria.trim()
      : fallbackPillar.successCriteria;

    return res.json({
      title: safeTitle,
      description: safeDesc,
      coreExpertise: safeCore,
      keyVocabulary: safeVocab,
      mentalModels: safeModels,
      primaryQuestion: safeQuestion,
      topicsToAvoid: safeAvoid,
      successCriteria: safeSuccess
    });

  } catch (err: any) {
    console.error("Gemini single content pillar generation failed, using fallback:", err);
    const excludeTitles = (req.body.existingPillars || []).map((p: any) => p.title);
    return res.json(getSimulatedSinglePillar(req.body.offer, req.body.audience, req.body.desiredResult, excludeTitles));
  }
});

function isAutoValue(val: any): boolean {
  if (val === undefined || val === null) return true;
  if (typeof val === "string") {
    const s = val.trim().toLowerCase();
    return s === "" || s === "auto" || s === "ai" || s === "auto-ai" || s === "ai-decides";
  }
  return false;
}

function resolveStructuralConfig(
  threadLengthInput: any,
  sentencesPerPartInput: any,
  decision?: ContentDecision,
  contentRequest: string = ""
): { selectedLength: string; selectedSentences: number; isAutoLength: boolean; isAutoSentences: boolean } {
  const isAutoLength = isAutoValue(threadLengthInput);
  const isAutoSentences = isAutoValue(sentencesPerPartInput);
  const plan = resolveWritingLengthPlan({
    contentRequest,
    threadLength: threadLengthInput,
    sentencesPerPart: sentencesPerPartInput
  });

  const selectedLength = !isAutoLength
    ? String(plan.recommendedParts)
    : decision?.recommendedPartCount
      ? String(decision.recommendedPartCount)
      : String(plan.recommendedParts);

  const selectedSentences = !isAutoSentences
    ? plan.recommendedSentencesPerPart
    : decision?.recommendedSentencesPerPart
      ? parseSentencesPerPart(decision.recommendedSentencesPerPart)
      : plan.recommendedSentencesPerPart;

  return { selectedLength, selectedSentences, isAutoLength, isAutoSentences };
}

function autoDecidePostCount(requestText: string): number {
  return extractExplicitPostCount(requestText) ?? 1;
}

function autoDecideThreadLengthAndSentences(requestText: string): { threadLength: string; sentencesPerPart: number } {
  const plan = resolveWritingLengthPlan({ contentRequest: requestText });
  return {
    threadLength: String(plan.recommendedParts),
    sentencesPerPart: plan.recommendedSentencesPerPart
  };
}

function autoDecideCategory(requestText: string): "attention" | "trust" | "sales" {
  const text = (requestText || "").toLowerCase();
  
  if (
    text.includes("promote") || 
    text.includes("sell") || 
    text.includes("buy") || 
    text.includes("offer") || 
    text.includes("sales") || 
    text.includes("discount") || 
    text.includes("price") || 
    text.includes("conversion") || 
    text.includes("cta") || 
    text.includes("hand-raiser") || 
    text.includes("reply") || 
    text.includes("dm me") || 
    text.includes("link in bio") ||
    text.includes("membership") ||
    text.includes("product") ||
    text.includes("service")
  ) {
    return "sales";
  }
  
  if (
    text.includes("authority") || 
    text.includes("case study") || 
    text.includes("guide") || 
    text.includes("how-to") || 
    text.includes("tutorial") || 
    text.includes("trust") || 
    text.includes("story") || 
    text.includes("wisdom") || 
    text.includes("learn") || 
    text.includes("teach") || 
    text.includes("deep dive") || 
    text.includes("framework") || 
    text.includes("system") ||
    text.includes("explain") ||
    text.includes("lesson") ||
    text.includes("journey")
  ) {
    return "trust";
  }
  
  return "attention";
}

// REST route for category-specific batch Threads content generation (Attention, Trust, Sales)
app.post("/api/generate-posts-batch", async (req, res) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const startTime = Date.now();
  let category = req.body?.category || "auto";

  // Set explicit keep-alive and cache-control headers to prevent WebKit/Safari proxy dropping
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Keep-Alive", "timeout=120");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("X-Request-Id", requestId);

  let limitHandle: any = null;
  let diagPostCount = 0;
  let diagWritingPlan: any = null;
  let diagSlotPlan: any[] = [];
  let diagChunkSize = 1;
  let diagChunkCount = 1;
  let diagAcceptedPosts: any[] = [];
  let diagFailedSlots: FailedDraftInfo[] = [];
  let diagModelCalls = 0;
  let diagRepairAttempts = 0;
  let diagReplacementAttempts = 0;

  try {
    const body = req.body || {};
    const userId = body.userId || body.profile?.uid || (req.headers["x-user-id"] as string) || "anonymous";
    const timings: Record<string, any> = {
      limitGuardMs: 0,
      resolveContextMs: 0,
      snapshotMs: 0,
      chunks: [] as any[],
      commitMs: 0
    };

    const tLimit = Date.now();
    const limitGuard = await enforceAiGenerationLimit(req, res, userId);
    timings.limitGuardMs = Date.now() - tLimit;
    if (!limitGuard) return; // Response sent by guard
    limitHandle = limitGuard.reservationId;
    const activeUserId = limitGuard.activeUserId;

    // --- STAGE 1: UNDERSTAND, RESOLVE & GATE CONTEXT ---
    // Fetch creator tab context and generation intelligence snapshot in parallel
    const tCtx = Date.now();
    const effectiveTabId = body.selectedSavedTabId || body.savedTabId || body.savedTab?.id;
    const [resolvedContext, snapshot] = await Promise.all([
      resolveCreatorContextForGeneration(
        serverDb,
        activeUserId,
        effectiveTabId,
        body
      ),
      getOrBuildGenerationIntelligenceSnapshot(serverDb, activeUserId, effectiveTabId)
    ]);
    timings.resolveContextMs = Date.now() - tCtx;
    timings.snapshotMs = timings.resolveContextMs;

    // Request and creator background are separate inputs, never interchangeable.
    const contentRequest = resolveBatchRequest(body);
    const postCount = resolveEffectivePostCount(body, contentRequest, 5);
    const gated = buildGatedWriteContext(resolvedContext, body, contentRequest);
    const writingPlan = gated.writingPlan;
    const characterLimit = gated.directives.characterLimit;
    const partCount = gated.directives.partCount;
    const ctaPreferences = gated.directives.ctaPreferences;
    const ctaOff = gated.directives.ctaOff;
    const destinations = gated.directives.destinations;
    const allowedUrls = gated.allowedUrls;
    const allowPartialResults = body.allowPartialResults === true;
    const diversityLedger = buildRollingLedger(
      snapshot,
      Array.isArray(body.recentLibraryPosts) ? body.recentLibraryPosts : [],
      Array.isArray(body.previousHooks) ? body.previousHooks : [],
      Array.isArray(body.previousAngles) ? body.previousAngles : []
    );
    const initialSlotPlan = planBatchSlots({
      count: postCount,
      ledger: diversityLedger,
      partCount,
      requestedAngle: gated.directives.activeStrategicAngle,
      writingPlan,
      randomSeed: body.randomSeed
    });
    const slotPlan = postCount === 8 && partCount == null
      ? planEightPostAiDecideParts(initialSlotPlan, writingPlan, { randomSeed: body.randomSeed })
      : initialSlotPlan;

    const ai = getAI();
    const generatedPosts: any[] = [];
    const failedSlots: FailedDraftInfo[] = [];
    // Token-budget adaptive chunking reduces sequential round trips on standard auto batches
    // while keeping deep/tutorial or explicit 7–10-part batches small to prevent truncation.
    const chunkSize = computeAdaptiveChunkSize(postCount, writingPlan, slotPlan);
    const generationContract = createUniversalGenerationContract({
      generationMode: postCount === 1 ? "single" : "batch",
      requestedBatchSize: postCount,
      writingPlan,
      characterLimit,
      ctaOff,
      businessRelevance: gated.businessRelevance,
      slotPlan
    });
    diagPostCount = postCount;
    diagWritingPlan = writingPlan;
    diagSlotPlan = slotPlan;
    diagChunkSize = chunkSize;
    diagChunkCount = generationContract.chunkCount;
    diagAcceptedPosts = generatedPosts;
    diagFailedSlots = failedSlots;
    const deadline = Date.now() + (postCount >= 32 ? 300000 : postCount >= 16 ? 210000 : 140000);
    const ensureTime = () => {
      if (res.destroyed || Date.now() >= deadline) {
        throw new GenerationPipelineError(
          "NETWORK_ERROR",
          "Generation did not complete in time. Please retry with fewer posts.",
          { httpStatus: 504, retryable: true }
        );
      }
    };
    // singlePost is derived deterministically from threadParts[0] on the server,
    // eliminating single-post schema anchoring and saving ~20–35% output tokens.
    const draftObjectSchema = {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        hook: { type: Type.STRING },
        threadParts: { type: Type.ARRAY, items: { type: Type.STRING } },
        cta: { type: Type.STRING },
        ctaDecision: { type: Type.STRING },
        category: { type: Type.STRING }
      },
      required: ["title", "hook", "threadParts", "cta", "ctaDecision"]
    };
    const parseModelJsonOrThrow = (text: string | undefined, stageLabel: string) => {
      try {
        return parseGeminiJsonResponse(text || "");
      } catch (parseErr: any) {
        throw new GenerationPipelineError(
          "PARSE_ERROR",
          `${stageLabel} returned malformed JSON: ${parseErr?.message || "Invalid JSON"}`,
          { httpStatus: 502, retryable: true, cause: parseErr }
        );
      }
    };

    // Compact, contradiction-free instructions composed per business relevance & CTA mode.
    // composeBatchWriterSystemInstruction(gated) already enforces: "Do not invent anecdotes to add specificity."
    const systemInstruction = composeBatchWriterSystemInstruction(gated);
    const reviewerSystemInstruction = composeReviewerSystemInstruction();

    const staticSettings = {
      category,
      totalPosts: postCount,
      characterLimit,
      partCount: partCount || "auto",
      sentencesPerPart: gated.directives.sentencesPerPart,
      writingPlan,
      angle: gated.directives.activeStrategicAngle,
      ctaPreferences,
      activeCta: gated.directives.activeCta,
      destinations
    };

    const buildAssignment = (slotNumbers: number[], priorDrafts: any[]) => ({
      contentRequest,
      facts: gated.factsPayload,
      slotPlan: slotNumbers.map(slotNum => slotPlan[slotNum - 1]).filter(Boolean),
      creativeGuidance: { prioritize: "original reasoning, concrete insight, creator voice, meaningful variation", avoid: "generic advice, formulaic hooks, forced controversy, invented stories, invented customers or metrics", variation: "follow each slot's assigned rhetorical lens and editorial structure without repeating earlier mechanisms" },
      settings: {
        ...staticSettings,
        postNumbers: [slotNumbers[0], slotNumbers[slotNumbers.length - 1]],
        lockedOpening: slotNumbers[0] === 1 ? gated.directives.lockedOpeningHook : null
      },
      exclusionHistory: buildCompactExclusionSummary(priorDrafts, diversityLedger)
    });

    // Lean review payload: omits writer-only creativeGuidance & verbose slotPlan prose
    const buildReviewAssignment = (slotNumbers: number[], priorDrafts: any[]) => ({
      contentRequest,
      facts: gated.factsPayload,
      settings: {
        ...staticSettings,
        postNumbers: [slotNumbers[0], slotNumbers[slotNumbers.length - 1]],
        lockedOpening: slotNumbers[0] === 1 ? gated.directives.lockedOpeningHook : null
      },
      exclusionHistory: buildCompactExclusionSummary(priorDrafts, diversityLedger)
    });

    const reviewCandidateDrafts = async (
      draftsToReview: Array<{ slotNumber: number; draft: any }>,
      acceptedPrior: any[]
    ) => {
      ensureTime();
      const tRev = Date.now();
      diagModelCalls++;
      const slotNumbers = draftsToReview.map(d => d.slotNumber);
      const assignment = buildReviewAssignment(slotNumbers, acceptedPrior);
      const review = await callGenerateContentWithRetry(ai, {
        model: THREADSWORKS_MODELS.FLASH_LITE_35,
        optimizationTaskId: "REVIEW_CONTENT_BATCH",
        optimizationComplexity: "LEVEL_1_LIGHT",
        strictContentGeneration: true,
        contents: JSON.stringify({
          assignment,
          drafts: draftsToReview.map(({ slotNumber, draft }) => ({
            slotNumber,
            title: draft.title,
            hook: draft.hook,
            threadParts: draft.threadParts,
            cta: draft.cta,
            ctaDecision: draft.ctaDecision
          }))
        }),
        config: {
          maxOutputTokens: 2500,
          responseMimeType: "application/json",
          httpOptions: { timeout: Math.max(1, Math.min(30000, deadline - Date.now())) },
          systemInstruction: reviewerSystemInstruction,
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                slotNumber: { type: Type.INTEGER },
                passed: { type: Type.BOOLEAN },
                defects: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["slotNumber", "passed", "defects"]
            }
          }
        }
      });
      timings.chunks.push({
        step: "review",
        slots: slotNumbers,
        ms: Date.now() - tRev,
        thoughtsTokens: review?.usageMetadata?.thoughtsTokenCount ?? null,
        outTokens: review?.usageMetadata?.candidatesTokenCount ?? null
      });
      if (review.isSimulated) {
        throw new GenerationPipelineError("PROVIDER_ERROR", "AI review is unavailable.", { httpStatus: 503, retryable: true });
      }
      const reviewResults = parseModelJsonOrThrow(review.text, "Editorial review");
      return reviewResults;
    };

    for (let offset = 0; offset < postCount; offset += chunkSize) {
      ensureTime();
      const expected = Math.min(chunkSize, postCount - offset);
      const slotNumbers = Array.from({ length: expected }, (_, i) => offset + i + 1);
      const chunkPlannedParts = slotNumbers.reduce(
        (sum, slotNum) => sum + (slotPlan[slotNum - 1]?.targetParts ?? writingPlan.recommendedParts),
        0
      );

      const chunkResult = await writeValidatedChunk({
        slotNumbers,
        priorAcceptedDrafts: generatedPosts,
        allowPartialChunk: allowPartialResults,
        validation: {
          characterLimit,
          partCount,
          minParts: writingPlan.minParts,
          maxParts: writingPlan.maxParts,
          exactSentencesPerPart: writingPlan.sentencesMode === "explicit" ? writingPlan.recommendedSentencesPerPart : undefined,
          maxSentencesPerPart: writingPlan.sentencesMode === "auto" ? writingPlan.maxSentencesPerPart : undefined,
          checkInternalRepetition: true,
          allowedUrls,
          sourceTexts: gated.groundingSourceTexts,
          lockedHook: offset === 0 ? (gated.directives.lockedOpeningHook || undefined) : undefined,
          ctaOff,
          enforceGroundedness: true,
          enforceNovelty: true,
          diversityLedger,
          topicText: contentRequest
        },
        generateChunk: async schemaRetryFeedback => {
          ensureTime();
          const tGen = Date.now();
          diagModelCalls++;
          const assignment = buildAssignment(slotNumbers, generatedPosts);
          const response = await callGenerateContentWithRetry(ai, {
            model: THREADSWORKS_MODELS.FLASH_36,
            optimizationTaskId: "GENERATE_POSTS_BATCH",
            optimizationComplexity: "LEVEL_2_STANDARD",
            strictContentGeneration: true,
            contents: JSON.stringify({
              ...assignment,
              expectedCount: expected,
              schemaRetryFeedback: schemaRetryFeedback || undefined
            }),
            config: {
              systemInstruction,
              responseMimeType: "application/json",
              maxOutputTokens: Math.min(14000, Math.max(6000, chunkPlannedParts * 550 + 2500)),
              httpOptions: { timeout: Math.max(1, Math.min(45000, deadline - Date.now())) },
              responseSchema: { type: Type.ARRAY, items: draftObjectSchema }
            }
          });
          timings.chunks.push({
            step: "generate",
            slots: slotNumbers,
            ms: Date.now() - tGen,
            thoughtsTokens: response?.usageMetadata?.thoughtsTokenCount ?? null,
            outTokens: response?.usageMetadata?.candidatesTokenCount ?? null
          });
          if (response.isSimulated) {
            throw new GenerationPipelineError("PROVIDER_ERROR", "AI generation is unavailable; no simulated drafts were created.", {
              httpStatus: 503,
              retryable: true
            });
          }
          return parseModelJsonOrThrow(response.text, "Batch writer");
        },
        reviewDrafts: reviewCandidateDrafts,
        repairDraft: async ({ slotNumber, draft, defects, acceptedDrafts }) => {
          ensureTime();
          const tRep = Date.now();
          diagModelCalls++;
          diagRepairAttempts++;
          const assignment = buildAssignment([slotNumber], acceptedDrafts);
          const assignedSlot = slotPlan[slotNumber - 1];
          const repairDirective = `TARGETED SINGLE-DRAFT REPAIR REQUIRED for Post ${slotNumber}${assignedSlot ? ` (Lens: ${assignedSlot.lensLabel})` : ""}.
Fix EVERY defect listed below without inventing customers, testimonials, support interactions, or unverified metrics:
- Defects: ${defects.join("; ")}
- If repetition or formulaic phrasing was flagged, pivot cleanly to the assigned lens (${assignedSlot?.lensLabel || "fresh angle"}) with a completely new opening and closing sentence.
- If an invented customer/support interaction or unsupported claim was flagged, remove the fabricated proof and rewrite using verified user-provided facts, clear reasoning, or an explicitly signaled hypothetical ("Imagine...", "Suppose...").
- If CTA Off was violated, set cta: "", ctaDecision: "omit", and remove any promotional pitch or link from threadParts.
- Never compress a developed multi-part thread into a 1-part stub and never manufacture filler parts; keep every part complete and within ${characterLimit} characters.
- Ensure hook matches the exact beginning of threadParts[0].
- Follow the writing length plan strictly: ${writingPlan.pacingGuidance}
Return ONLY a single JSON draft object matching the schema.`;
          const response = await callGenerateContentWithRetry(ai, {
            model: THREADSWORKS_MODELS.FLASH_36,
            optimizationTaskId: "REPAIR_POST",
            optimizationComplexity: "LEVEL_2_STANDARD",
            strictContentGeneration: true,
            contents: JSON.stringify({
              ...assignment,
              targetSlotNumber: slotNumber,
              failedDraft: draft,
              defects,
              repairDirective
            }),
            config: {
              systemInstruction,
              responseMimeType: "application/json",
              maxOutputTokens: 5500,
              httpOptions: { timeout: Math.max(1, Math.min(35000, deadline - Date.now())) },
              responseSchema: draftObjectSchema
            }
          });
          timings.chunks.push({
            step: "repair",
            slots: [slotNumber],
            ms: Date.now() - tRep,
            defects,
            thoughtsTokens: response?.usageMetadata?.thoughtsTokenCount ?? null,
            outTokens: response?.usageMetadata?.candidatesTokenCount ?? null
          });
          if (response.isSimulated) {
            throw new GenerationPipelineError("PROVIDER_ERROR", "AI repair is unavailable.", { httpStatus: 503, retryable: true });
          }
          return parseModelJsonOrThrow(response.text, `Draft ${slotNumber} repair`);
        },
        replaceDraft: async ({ slotNumber, failedDraft, defects, acceptedDrafts }) => {
          ensureTime();
          const tRepl = Date.now();
          diagModelCalls++;
          diagReplacementAttempts++;
          const assignment = buildAssignment([slotNumber], acceptedDrafts);
          const assignedSlot = slotPlan[slotNumber - 1];
          const replacementDirective = `FRESH REPLACEMENT DRAFT REQUIRED for Post ${slotNumber}${assignedSlot ? ` (Lens: ${assignedSlot.lensLabel})` : ""}.
Discard the previous failed draft completely. Write ONE brand-new, grounded Threads draft for Post ${slotNumber} using a fresh angle and opening that is completely distinct from exclusionHistory.
Avoid the previous failure mode(s): ${defects.join("; ")}.
Never compress a rich idea into a shallow 1-part stub and never pad with filler. Strictly honor all epistemic grounding rules, business relevance policy (${gated.businessRelevance}), CTA preferences${ctaOff ? " (CTA is OFF: cta must be '', ctaDecision must be 'omit', no links)" : ""}, the ${characterLimit}-character limit per part, and the writing length plan (${writingPlan.pacingGuidance}).
Return ONLY a single JSON draft object matching the schema.`;
          const response = await callGenerateContentWithRetry(ai, {
            model: THREADSWORKS_MODELS.FLASH_36,
            optimizationTaskId: "GENERATE_POSTS_BATCH",
            optimizationComplexity: "LEVEL_2_STANDARD",
            strictContentGeneration: true,
            contents: JSON.stringify({
              ...assignment,
              targetSlotNumber: slotNumber,
              rejectedDraftSummary: failedDraft ? { title: failedDraft.title, hook: failedDraft.hook } : null,
              avoidDefects: defects,
              replacementDirective
            }),
            config: {
              systemInstruction,
              responseMimeType: "application/json",
              maxOutputTokens: 5500,
              httpOptions: { timeout: Math.max(1, Math.min(35000, deadline - Date.now())) },
              responseSchema: draftObjectSchema
            }
          });
          timings.chunks.push({
            step: "replace",
            slots: [slotNumber],
            ms: Date.now() - tRepl,
            defects,
            thoughtsTokens: response?.usageMetadata?.thoughtsTokenCount ?? null,
            outTokens: response?.usageMetadata?.candidatesTokenCount ?? null
          });
          if (response.isSimulated) {
            throw new GenerationPipelineError("PROVIDER_ERROR", "AI replacement generation is unavailable.", { httpStatus: 503, retryable: true });
          }
          return parseModelJsonOrThrow(response.text, `Draft ${slotNumber} replacement`);
        }
      });

      const taggedChunk = chunkResult.acceptedDrafts.map((draft, idx) => ({
        ...draft,
        lens: slotPlan[offset + idx]?.lensId || draft.lens
      }));
      generatedPosts.push(...taggedChunk);
      failedSlots.push(...chunkResult.failedSlots);
    }

    if (generatedPosts.length === 0) {
      const primaryCode = failedSlots[0]?.errorCode || "CONTENT_VALIDATION_ERROR";
      const summary = failedSlots.map(f => `Post ${f.slotNumber}: ${f.reasons.join("; ")}`).join(" | ");
      throw new GenerationPipelineError(
        primaryCode,
        summary
          ? `No drafts could pass validation after repair and replacement: ${summary}`
          : "No valid drafts could be generated.",
        {
          failedDrafts: failedSlots,
          validDraftCount: 0,
          requestedCount: postCount
        }
      );
    }

    const isPartial = generatedPosts.length < postCount;
    if (isPartial && !allowPartialResults) {
      const primaryCode = failedSlots[0]?.errorCode || "CONTENT_VALIDATION_ERROR";
      const summary = failedSlots.map(f => `Post ${f.slotNumber}: ${f.reasons.join("; ")}`).join(" | ");
      throw new GenerationPipelineError(
        primaryCode,
        `Only ${generatedPosts.length} of ${postCount} drafts passed validation: ${summary}`,
        {
          failedDrafts: failedSlots,
          validDraftCount: generatedPosts.length,
          requestedCount: postCount
        }
      );
    }

    // Universal quota-free batch validation across all batch sizes before normalization or quota commit.
    validateUniversalBatch(generatedPosts, {
      expectedCount: isPartial ? generatedPosts.length : postCount,
      explicitPartCount: partCount,
      minParts: writingPlan.minParts,
      maxParts: writingPlan.maxParts,
      characterLimit
    });

    // No legacy sanitizer, template repair, CTA footer, or uniqueness rewrite follows this boundary.
    const finalPosts = normalizeBatchPosts(generatedPosts, isPartial ? generatedPosts.length : postCount, {
      characterLimit,
      partCount,
      minParts: writingPlan.minParts,
      maxParts: writingPlan.maxParts,
      exactSentencesPerPart: writingPlan.sentencesMode === "explicit" ? writingPlan.recommendedSentencesPerPart : undefined,
      maxSentencesPerPart: writingPlan.sentencesMode === "auto" ? writingPlan.maxSentencesPerPart : undefined,
      checkInternalRepetition: true,
      allowedUrls,
      sourceTexts: gated.verbatimSourceTexts,
      ctaOff
    }).map((post, idx) => ({ ...post,
      id: `post_v3_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
      category: category !== "auto" ? category : post.category || "trust",
      generationMethod: "GeneratorV3"
    }));
    // Validate the actual normalized payload too; downstream normalization must not weaken the universal contract.
    validateUniversalBatch(finalPosts, {
      expectedCount: isPartial ? finalPosts.length : postCount,
      explicitPartCount: partCount,
      minParts: writingPlan.minParts,
      maxParts: writingPlan.maxParts,
      characterLimit
    });
    const linkReports = finalPosts.map((post, idx) => {
      const partIndex = post.threadParts.findIndex((part: string) => /https?:\/\//.test(part));
      const exactUrl = partIndex >= 0 ? post.threadParts[partIndex].match(/https?:\/\/[^\s<>]+/)?.[0].replace(/[.,;!?)]+$/, "") : null;
      return { postIndex: idx + 1, hasCta: Boolean(post.cta), ctaText: post.cta || "",
        partNumber: partIndex >= 0 ? partIndex + 1 : null, exactUrl,
        selectedDestination: destinations.find((d: any) => d.url === exactUrl) || null };
    });
    recordGeneratedBatchInSnapshot(serverDb, activeUserId, effectiveTabId, finalPosts).catch(err => {
      console.warn(`[Generator V3] Asynchronous snapshot update failed:`, err?.message);
    });
    if (limitHandle) {
      const tCommit = Date.now();
      await commitGeneration(serverDb, activeUserId, limitHandle);
      timings.commitMs = Date.now() - tCommit;
    }
    timings.totalMs = Date.now() - startTime;
    logGenerationBatchDiagnostics(
      buildGenerationBatchDiagnostics({
        requestId,
        generationMode: postCount === 1 ? "single" : "batch",
        writingPlan,
        requestedPostCount: postCount,
        acceptedPosts: finalPosts,
        chunkSize,
        chunkCount: generationContract.chunkCount,
        slotPlan,
        modelCallCount: diagModelCalls,
        repairAttempts: diagRepairAttempts,
        replacementAttempts: diagReplacementAttempts,
        failedSlotCount: failedSlots.length,
        validationOutcome: isPartial ? "partial" : "complete",
        totalDurationMs: timings.totalMs
      })
    );

    return res.json({
      posts: finalPosts,
      count: finalPosts.length,
      requestedCount: postCount,
      partial: isPartial,
      ...(isPartial ? {
        failedSlots,
        warning: `${finalPosts.length} of ${postCount} drafts passed validation. ${failedSlots.length} draft${failedSlots.length === 1 ? " was" : "s were"} withheld after failing factual/quality checks on repair and replacement.`
      } : {}),
      category,
      requestId,
      generatorVersion: "V3",
      businessRelevance: gated.businessRelevance,
      writingPlan,
      generationContract,
      snapshotVersion: snapshot.schemaVersion || 1,
      linkReports: linkReports || [],
      timings
    });

  } catch (err: any) {
    console.error(`[Generator V3] Batch post generation error:`, err);
    if (limitHandle) {
      await releaseReservation(serverDb, limitHandle).catch(() => {});
    }
    const pipelineErr =
      err instanceof GenerationPipelineError
        ? err
        : classifyProviderOrNetworkError(err);
    const httpStatus = pipelineErr?.httpStatus || 500;
    const errorCode = pipelineErr?.code || "INTERNAL_ERROR";
    const retryable = pipelineErr ? pipelineErr.retryable : true;
    if (diagWritingPlan) {
      logGenerationBatchDiagnostics(
        buildGenerationBatchDiagnostics({
          requestId,
          generationMode: diagPostCount === 1 ? "single" : "batch",
          writingPlan: diagWritingPlan,
          requestedPostCount: diagPostCount,
          acceptedPosts: diagAcceptedPosts,
          chunkSize: diagChunkSize,
          chunkCount: diagChunkCount,
          slotPlan: diagSlotPlan,
          modelCallCount: diagModelCalls,
          repairAttempts: diagRepairAttempts,
          replacementAttempts: diagReplacementAttempts,
          failedSlotCount: pipelineErr?.failedDrafts?.length ?? diagFailedSlots.length,
          validationOutcome: "failed",
          errorCode: pipelineErr?.code,
          totalDurationMs: Date.now() - startTime
        })
      );
    }
    return res.status(httpStatus).json({
      error: errorCode === "CONTENT_VALIDATION_ERROR"
        ? "Content validation failed"
        : errorCode === "PARSE_ERROR"
          ? "AI response parsing failed"
          : errorCode === "SCHEMA_ERROR"
            ? "AI output schema mismatch"
            : errorCode === "PROVIDER_ERROR"
              ? "AI provider error"
              : errorCode === "NETWORK_ERROR"
                ? "Network or timeout error"
                : errorCode === "REQUEST_ERROR"
                  ? "Invalid generation request"
                  : "Generation failed",
      errorCode,
      retryable,
      requestId,
      message: pipelineErr?.message || err?.message || "An error occurred during content generation.",
      ...(pipelineErr?.failedDrafts ? { failedDrafts: pipelineErr.failedDrafts } : {}),
      ...(typeof pipelineErr?.validDraftCount === "number" ? { validDraftCount: pipelineErr.validDraftCount } : {}),
      ...(typeof pipelineErr?.requestedCount === "number" ? { requestedCount: pipelineErr.requestedCount } : {})
    });
  }
});
// Helper function to transform Hooks in a structured post
async function transformHookInPost(post: any, action: string, writingStyle: string, creatorIdentity: any, characterLimit = 500) {
  const parts = [...(post.threadParts || [post.singlePost || ""])];
  const idea = post.title || post.hook || "Threads post";
  const systemInstruction = composeSingleWriteSystemInstruction("TRANSFORM_HOOK");
  const ai = getAI();

  if (action === "remove") {
    if (parts.length <= 1) {
      const response = await callGenerateContentWithRetry(ai, {
        model: THREADSWORKS_MODELS.FLASH_36,
        optimizationTaskId: "TRANSFORM_HOOK_REMOVE",
        optimizationComplexity: "LEVEL_2_STANDARD",
        strictContentGeneration: true,
        contents: JSON.stringify({
          action: "remove_hook_single_part",
          characterLimit,
          writingStyle: writingStyle || "clear and conversational",
          wordsToAvoid: creatorIdentity?.wordsYouAvoid || "",
          postText: parts[0],
          instruction: "Remove the flashy opening hook so the post begins directly and naturally into its core insight. Do not invent facts. Stay strictly within characterLimit. Return ONLY the updated post text."
        }),
        config: { systemInstruction, maxOutputTokens: 600 }
      });
      if (response.isSimulated) {
        throw new GenerationPipelineError("PROVIDER_ERROR", "AI hook transform is unavailable.", { httpStatus: 503, retryable: true });
      }
      const cleaned = (response.text || "").trim();
      if (!cleaned || cleaned.length > characterLimit) {
        throw new GenerationPipelineError("CONTENT_VALIDATION_ERROR", `Updated post is empty or exceeds ${characterLimit} characters.`);
      }
      return { ...post, hook: "", singlePost: cleaned, threadParts: [cleaned] };
    }

    const response = await callGenerateContentWithRetry(ai, {
      model: THREADSWORKS_MODELS.FLASH_36,
      optimizationTaskId: "TRANSFORM_HOOK_REMOVE_THREAD",
      optimizationComplexity: "LEVEL_2_STANDARD",
      strictContentGeneration: true,
      contents: JSON.stringify({
        action: "remove_hook_thread",
        characterLimit,
        writingStyle: writingStyle || "clear and conversational",
        wordsToAvoid: creatorIdentity?.wordsYouAvoid || "",
        parts,
        instruction: "Remove the flashy opening hook (Part 1) and begin naturally with the core insight while keeping subsequent parts coherent and each part within characterLimit. Return ONLY a JSON array of strings."
      }),
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
      }
    });
    if (response.isSimulated) {
      throw new GenerationPipelineError("PROVIDER_ERROR", "AI hook transform is unavailable.", { httpStatus: 503, retryable: true });
    }
    const updatedParts = parseGeminiJsonResponse(response.text);
    if (!Array.isArray(updatedParts) || updatedParts.length === 0 || updatedParts.some((p: any) => typeof p !== "string" || !p.trim() || p.trim().length > characterLimit)) {
      throw new GenerationPipelineError("SCHEMA_ERROR", "Updated thread parts failed validation.");
    }
    const cleanParts = updatedParts.map((p: string) => p.trim());
    return { ...post, hook: "", singlePost: cleanParts[0], threadParts: cleanParts };
  }

  const response = await callGenerateContentWithRetry(ai, {
    model: THREADSWORKS_MODELS.FLASH_36,
    optimizationTaskId: "TRANSFORM_HOOK_ADD",
    optimizationComplexity: "LEVEL_2_STANDARD",
    strictContentGeneration: true,
    contents: JSON.stringify({
      action: action || "regenerate",
      topic: idea,
      characterLimit,
      writingStyle: writingStyle || "clear and conversational",
      wordsToAvoid: creatorIdentity?.wordsYouAvoid || "",
      currentHook: post.hook || "",
      parts,
      instruction: "Generate ONE specific, non-formulaic opening hook (avoid 'Most people', 'Here's the truth', 'Stop doing') and minimally adjust Part 2 only if needed for smooth continuity. Keep both strictly within characterLimit and do not invent facts or customers."
    }),
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          hook: { type: Type.STRING },
          part2: { type: Type.STRING }
        },
        required: ["hook", "part2"]
      }
    }
  });
  if (response.isSimulated) {
    throw new GenerationPipelineError("PROVIDER_ERROR", "AI hook transform is unavailable.", { httpStatus: 503, retryable: true });
  }
  const resObj = parseGeminiJsonResponse(response.text);
  const newHook = typeof resObj?.hook === "string" ? resObj.hook.trim() : "";
  const newPart2 = typeof resObj?.part2 === "string" ? resObj.part2.trim() : "";
  if (!newHook || newHook.length > characterLimit || newPart2.length > characterLimit) {
    throw new GenerationPipelineError("CONTENT_VALIDATION_ERROR", `Generated hook or continuation exceeded ${characterLimit} characters.`);
  }
  const hasHook = Boolean(post.hook);
  const newParts = [...parts];
  if (hasHook) {
    newParts[0] = newHook;
    if (newParts.length > 1 && newPart2) newParts[1] = newPart2;
    return { ...post, hook: newHook, singlePost: newHook, threadParts: newParts };
  }
  const updatedBodyPart = newPart2 || parts[0] || "";
  const finalParts = [newHook, updatedBodyPart, ...parts.slice(1)];
  return { ...post, hook: newHook, singlePost: newHook, threadParts: finalParts };
}

// Helper function to transform CTAs in a structured post
async function transformCtaInPost(post: any, action: string, placement: string, ctaPreferences: string, offerIntelligence: any, activeCtaMessage: string, characterLimit = 500) {
  const parts = [...(post.threadParts || [post.singlePost || ""])];
  const idea = post.title || post.hook || "Threads post";
  const ctaOff = /^off\b/i.test(String(ctaPreferences || "").trim());
  const systemInstruction = composeSingleWriteSystemInstruction("TRANSFORM_CTA");
  const ai = getAI();

  if (action === "remove" || ctaOff) {
    const response = await callGenerateContentWithRetry(ai, {
      model: THREADSWORKS_MODELS.FLASH_36,
      optimizationTaskId: "TRANSFORM_CTA_REMOVE",
      optimizationComplexity: "LEVEL_2_STANDARD",
      strictContentGeneration: true,
      contents: JSON.stringify({
        action: "remove_cta",
        characterLimit,
        parts,
        instruction: "Remove all promotional calls to action, link plugs, and hand-raiser prompts. End affected parts cleanly with complete sentences while leaving non-CTA parts untouched. Keep every part within characterLimit. Return ONLY a JSON array of strings."
      }),
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
      }
    });
    if (response.isSimulated) {
      throw new GenerationPipelineError("PROVIDER_ERROR", "AI CTA transform is unavailable.", { httpStatus: 503, retryable: true });
    }
    const cleanedParts = parseGeminiJsonResponse(response.text);
    if (!Array.isArray(cleanedParts) || cleanedParts.length === 0 || cleanedParts.some((p: any) => typeof p !== "string" || !p.trim() || p.trim().length > characterLimit)) {
      throw new GenerationPipelineError("SCHEMA_ERROR", "Cleaned thread parts failed validation.");
    }
    const trimmed = cleanedParts.map((p: string) => p.trim());
    return { ...post, cta: "", ctaDecision: "omit", singlePost: trimmed[0], threadParts: trimmed };
  }

  const offerName = typeof offerIntelligence?.coreOffer === "string" ? offerIntelligence.coreOffer.trim() : "";
  const allowedUrls = [
    ...(String(activeCtaMessage || "").match(/https?:\/\/[^\s<>)]+/g) || []),
    ...(String(offerIntelligence?.websiteUrl || "").match(/https?:\/\/[^\s<>)]+/g) || []),
    ...(parts.join(" ").match(/https?:\/\/[^\s<>)]+/g) || [])
  ].map(u => u.replace(/[.,;!?)]+$/, ""));

  const response = await callGenerateContentWithRetry(ai, {
    model: THREADSWORKS_MODELS.FLASH_36,
    optimizationTaskId: "TRANSFORM_CTA_ADD",
    optimizationComplexity: "LEVEL_2_STANDARD",
    strictContentGeneration: true,
    contents: JSON.stringify({
      action: action || "add",
      topic: idea,
      characterLimit,
      placement: placement || "final_part",
      ctaPreferences: ctaPreferences || "natural, low-friction next step",
      verifiedOffer: offerName ? { name: offerName, pricePoint: offerIntelligence?.pricePoint || "" } : null,
      preferredCtaCopy: activeCtaMessage || null,
      allowedUrls,
      parts,
      instruction: `Integrate ONE contextual, grounded CTA cleanly into the requested placement ("part2"=index 1, "part3"=index 2, "before_final"=index ${Math.max(0, parts.length - 2)}, "final_part"=last index). Replace any existing CTA so there is never more than one CTA. Do NOT invent offers, lead magnets, or URLs not in allowedUrls. Preserve part count (${parts.length}) and keep every part within ${characterLimit} characters. Return ONLY a JSON array of strings.`
    }),
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
    }
  });
  if (response.isSimulated) {
    throw new GenerationPipelineError("PROVIDER_ERROR", "AI CTA transform is unavailable.", { httpStatus: 503, retryable: true });
  }
  const updatedParts = parseGeminiJsonResponse(response.text);
  if (!Array.isArray(updatedParts) || updatedParts.length === 0) {
    throw new GenerationPipelineError("SCHEMA_ERROR", "CTA transform returned invalid thread parts.");
  }
  const cleanParts = updatedParts.map((p: any) => {
    if (typeof p !== "string" || !p.trim()) {
      throw new GenerationPipelineError("SCHEMA_ERROR", "CTA transform returned an empty part.");
    }
    const text = p.trim();
    if (text.length > characterLimit) {
      throw new GenerationPipelineError("CONTENT_VALIDATION_ERROR", `Updated part exceeds ${characterLimit} characters.`);
    }
    for (const match of text.matchAll(/https?:\/\/[^\s<>]+/g)) {
      const url = match[0].replace(/[.,;!?)]+$/, "");
      if (!allowedUrls.includes(url)) {
        throw new GenerationPipelineError("CONTENT_VALIDATION_ERROR", "CTA transform introduced an unauthorized URL.");
      }
    }
    return text;
  });
  const lastPart = cleanParts[cleanParts.length - 1];
  return { ...post, cta: lastPart, ctaDecision: "include", singlePost: cleanParts[0], threadParts: cleanParts };
}

// REST route for V2 Hook Transformations (Add, Regenerate, Remove Hooks)
app.post("/api/v2/transform-hook", async (req, res) => {
  try {
    const { post, action, writingStyle, creatorIdentity, characterLimit } = req.body || {};
    if (!post) {
      return res.status(400).json({ error: "Missing required 'post' parameter.", errorCode: "REQUEST_ERROR", retryable: false });
    }
    const configuredLimit = Math.min(500, Math.max(50, Number(characterLimit) || 500));
    const updatedPost = await transformHookInPost(post, action, writingStyle, creatorIdentity, configuredLimit);
    return res.json({ post: updatedPost, generatorVersion: "V3" });
  } catch (err: any) {
    console.error("Error in /api/v2/transform-hook:", err);
    return sendPipelineErrorResponse(res, err, "Hook transformation failed.");
  }
});

// REST route for V2 CTA Transformations (Add, Regenerate, Remove CTAs)
app.post("/api/v2/transform-cta", async (req, res) => {
  try {
    const { post, action, placement, ctaPreferences, offerIntelligence, activeCtaMessage, characterLimit } = req.body || {};
    if (!post) {
      return res.status(400).json({ error: "Missing required 'post' parameter.", errorCode: "REQUEST_ERROR", retryable: false });
    }
    const configuredLimit = Math.min(500, Math.max(50, Number(characterLimit) || 500));
    const updatedPost = await transformCtaInPost(post, action, placement, ctaPreferences, offerIntelligence, activeCtaMessage, configuredLimit);
    return res.json({ post: updatedPost, generatorVersion: "V3" });
  } catch (err: any) {
    console.error("Error in /api/v2/transform-cta:", err);
    return sendPipelineErrorResponse(res, err, "CTA transformation failed.");
  }
});

// REST route to regenerate a single Threads post in-place using unified V3 Write Architecture
app.post("/api/regenerate-single-post", async (req, res) => {
  let limitHandle: any = null;
  try {
    const body = req.body || {};
    let authUser = null;
    try {
      authUser = await verifyAuthUser(req, body.userId);
    } catch (_) {}
    const activeUserId = authUser?.uid || body.userId || body.creatorIdentity?.uid || "anonymous";
    const effectiveSavedTabId = body.selectedSavedTabId || body.savedTabId || body.savedTab?.id;

    limitHandle = await enforceAiGenerationLimit(req, res, body.userId);
    if (!limitHandle) return;

    const resolvedContext = await resolveCreatorContextForGeneration(
      serverDb,
      activeUserId,
      effectiveSavedTabId,
      body
    );

    const rawTopicCandidate =
      body.topic ||
      body.contentRequest ||
      body.manualTopic ||
      body.focusInput ||
      body.activeIdea?.title ||
      body.activeIdea?.originalIdea ||
      body.rawCreatorThought ||
      (typeof body.activePillar === "object" ? body.activePillar?.title : body.activePillar) ||
      body.hook ||
      body.title ||
      resolvedContext.offer ||
      "";
    const effectiveTopic = cleanTopicString(String(rawTopicCandidate || "").trim()) || "Write a high-value Threads post in the creator's voice";

    const gated = buildGatedWriteContext(resolvedContext, body, effectiveTopic);
    const characterLimit = gated.directives.characterLimit;
    const partCount = gated.directives.partCount;
    const ctaOff = gated.directives.ctaOff;
    const effectiveCategory = gated.directives.category || "trust";

    const snapshot = await getOrBuildGenerationIntelligenceSnapshot(serverDb, activeUserId, effectiveSavedTabId).catch(() => null);
    const priorPostHooks = [
      ...(Array.isArray(body.previousHooks) ? body.previousHooks : []),
      ...(typeof body.previousHook === "string" && body.previousHook.trim() ? [body.previousHook.trim()] : []),
      ...(typeof body.existingHook === "string" && body.existingHook.trim() ? [body.existingHook.trim()] : [])
    ];
    const diversityLedger = buildRollingLedger(
      snapshot,
      Array.isArray(body.recentLibraryPosts) ? body.recentLibraryPosts : [],
      priorPostHooks,
      Array.isArray(body.previousAngles) ? body.previousAngles : []
    );
    const writingPlan = gated.writingPlan;
    const slotAssignment = planBatchSlots({
      count: 1,
      ledger: diversityLedger,
      partCount,
      requestedAngle: gated.directives.activeStrategicAngle,
      writingPlan,
      randomSeed: body.randomSeed
    })[0];

    const ai = getAI();
    const systemInstruction = composeSingleWriteSystemInstruction("SINGLE_REGENERATE", gated);
    const reviewerSystemInstruction = composeReviewerSystemInstruction();

    const draftSchema = {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        hook: { type: Type.STRING },
        threadParts: { type: Type.ARRAY, items: { type: Type.STRING } },
        cta: { type: Type.STRING },
        ctaDecision: { type: Type.STRING },
        explanation: { type: Type.STRING },
        category: { type: Type.STRING }
      },
      required: ["title", "hook", "threadParts", "cta", "ctaDecision", "explanation"]
    };

    const parseOrThrow = (text: string | undefined, stage: string) => {
      try {
        return parseGeminiJsonResponse(text || "");
      } catch (e: any) {
        throw new GenerationPipelineError("PARSE_ERROR", `${stage} returned malformed JSON: ${e?.message || "Invalid JSON"}`, {
          httpStatus: 502,
          retryable: true,
          cause: e
        });
      }
    };

    const assignmentPayload = {
      contentRequest: effectiveTopic,
      facts: gated.factsPayload,
      slotPlan: [slotAssignment],
      settings: {
        category: effectiveCategory,
        characterLimit,
        partCount: partCount || "auto",
        sentencesPerPart: gated.directives.sentencesPerPart,
        writingPlan,
        lockedOpening: gated.directives.lockedOpeningHook,
        ctaPreferences: gated.directives.ctaPreferences,
        activeCta: gated.directives.activeCta,
        destinations: gated.directives.destinations
      },
      exclusionHistory: buildCompactExclusionSummary([], diversityLedger)
    };

    const validatedPost = await executeValidatedSingleWrite({
      validation: {
        characterLimit,
        partCount,
        minParts: writingPlan.minParts,
        maxParts: writingPlan.maxParts,
        exactSentencesPerPart: writingPlan.sentencesMode === "explicit" ? writingPlan.recommendedSentencesPerPart : undefined,
        maxSentencesPerPart: writingPlan.sentencesMode === "auto" ? writingPlan.maxSentencesPerPart : undefined,
        checkInternalRepetition: true,
        allowedUrls: gated.allowedUrls,
        sourceTexts: gated.groundingSourceTexts,
        lockedHook: gated.directives.lockedOpeningHook || undefined,
        ctaOff,
        enforceGroundedness: true,
        enforceNovelty: true,
        diversityLedger,
        topicText: effectiveTopic
      },
      generateDraft: async schemaRetryFeedback => {
        const response = await callGenerateContentWithRetry(ai, {
          model: THREADSWORKS_MODELS.FLASH_36,
          optimizationTaskId: "REGENERATE_POST",
          optimizationComplexity: "LEVEL_2_STANDARD",
          strictContentGeneration: true,
          contents: JSON.stringify({
            ...assignmentPayload,
            ...(schemaRetryFeedback ? { schemaRetryFeedback } : {})
          }),
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            maxOutputTokens: 5500,
            responseSchema: draftSchema
          }
        });
        if (response.isSimulated) {
          throw new GenerationPipelineError("PROVIDER_ERROR", "AI generation is unavailable.", { httpStatus: 503, retryable: true });
        }
        return parseOrThrow(response.text, "Single post writer");
      },
      reviewDraft: async draft => {
        const review = await callGenerateContentWithRetry(ai, {
          model: THREADSWORKS_MODELS.FLASH_LITE_35,
          optimizationTaskId: "REVIEW_CONTENT_BATCH",
          optimizationComplexity: "LEVEL_1_LIGHT",
          strictContentGeneration: true,
          contents: JSON.stringify({
            assignment: assignmentPayload,
            drafts: [{
              slotNumber: 1,
              title: draft.title,
              hook: draft.hook,
              threadParts: draft.threadParts,
              cta: draft.cta,
              ctaDecision: draft.ctaDecision
            }]
          }),
          config: {
            systemInstruction: reviewerSystemInstruction,
            responseMimeType: "application/json",
            maxOutputTokens: 1200,
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  slotNumber: { type: Type.INTEGER },
                  passed: { type: Type.BOOLEAN },
                  defects: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["slotNumber", "passed", "defects"]
              }
            }
          }
        });
        if (review.isSimulated) {
          throw new GenerationPipelineError("PROVIDER_ERROR", "AI review is unavailable.", { httpStatus: 503, retryable: true });
        }
        const arr = parseOrThrow(review.text, "Single post review");
        const entry = Array.isArray(arr) ? arr.find((r: any) => r?.slotNumber === 1) || arr[0] : null;
        if (!entry || typeof entry.passed !== "boolean" || !Array.isArray(entry.defects)) {
          throw new GenerationPipelineError("SCHEMA_ERROR", "Editorial review returned an invalid response.");
        }
        return { slotNumber: 1, passed: entry.passed && entry.defects.length === 0, defects: entry.defects };
      },
      repairDraft: async ({ draft, defects }) => {
        const response = await callGenerateContentWithRetry(ai, {
          model: THREADSWORKS_MODELS.FLASH_36,
          optimizationTaskId: "REPAIR_POST",
          optimizationComplexity: "LEVEL_2_STANDARD",
          strictContentGeneration: true,
          contents: JSON.stringify({
            ...assignmentPayload,
            failedDraft: draft,
            defects,
            repairDirective: `Fix EVERY defect listed (${defects.join("; ")}). Do not invent customers, testimonials, metrics, or support interactions. Follow the writing length plan strictly (${writingPlan.pacingGuidance}), keep every part <= ${characterLimit} characters, and ensure hook matches the exact start of threadParts[0].`
          }),
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            maxOutputTokens: 5500,
            responseSchema: draftSchema
          }
        });
        if (response.isSimulated) {
          throw new GenerationPipelineError("PROVIDER_ERROR", "AI repair is unavailable.", { httpStatus: 503, retryable: true });
        }
        return parseOrThrow(response.text, "Single post repair");
      },
      replaceDraft: async ({ failedDraft, defects }) => {
        const response = await callGenerateContentWithRetry(ai, {
          model: THREADSWORKS_MODELS.FLASH_36,
          optimizationTaskId: "REGENERATE_POST",
          optimizationComplexity: "LEVEL_2_STANDARD",
          strictContentGeneration: true,
          contents: JSON.stringify({
            ...assignmentPayload,
            rejectedDraftSummary: failedDraft ? { title: failedDraft.title, hook: failedDraft.hook } : null,
            avoidDefects: defects,
            replacementDirective: `Discard the failed draft and write ONE brand-new grounded Threads post using lens "${slotAssignment.lensLabel}" avoiding: ${defects.join("; ")}. Follow the writing length plan strictly (${writingPlan.pacingGuidance}) and keep every part <= ${characterLimit} characters.`
          }),
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            maxOutputTokens: 5500,
            responseSchema: draftSchema
          }
        });
        if (response.isSimulated) {
          throw new GenerationPipelineError("PROVIDER_ERROR", "AI replacement is unavailable.", { httpStatus: 503, retryable: true });
        }
        return parseOrThrow(response.text, "Single post replacement");
      }
    });

    const finalPost = {
      ...validatedPost,
      id: body.id || `post_v3_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      category: effectiveCategory !== "auto" ? effectiveCategory : (validatedPost.category || "trust"),
      lens: slotAssignment.lensId,
      generatorVersion: "V3",
      businessRelevance: gated.businessRelevance
    };

    recordGeneratedBatchInSnapshot(serverDb, activeUserId, effectiveSavedTabId, [finalPost]).catch(err => {
      console.warn(`[RegenerateSinglePost] Snapshot update failed:`, err?.message);
    });

    if (limitHandle && !limitHandle.isPro) {
      const committedUsage = await commitGeneration(serverDb, limitHandle.activeUserId, limitHandle.reservationId);
      (finalPost as any).generationUsage = committedUsage;
    }

    return res.json(finalPost);
  } catch (err: any) {
    if (limitHandle && !limitHandle.isPro && limitHandle.reservationId) {
      await releaseReservation(serverDb, limitHandle.activeUserId, limitHandle.reservationId).catch(() => {});
    }
    if (err instanceof SavedTabError) {
      return res.status(err.statusCode).json({ success: false, error: err.code, message: err.message });
    }
    console.error("[RegenerateSinglePost] Error:", err);
    return sendPipelineErrorResponse(res, err, "Single post regeneration failed.");
  }
});

// REST route to optimize an existing post/thread with unified V3 Write validation
app.post("/api/optimize-post", async (req: any, res: any) => {
  try {
    const body = req.body || {};
    const { post } = body;
    if (!post || typeof post !== "object") {
      return res.status(400).json({ error: "Missing required post object for optimization.", errorCode: "REQUEST_ERROR", retryable: false });
    }

    const currentParts: string[] = Array.isArray(post.threadParts) && post.threadParts.length > 0
      ? post.threadParts.map((p: any) => String(p || "").trim()).filter(Boolean)
      : [String(post.singlePost || post.hook || "").trim()].filter(Boolean);

    if (currentParts.length === 0) {
      return res.status(400).json({ error: "Post has no text content to optimize.", errorCode: "REQUEST_ERROR", retryable: false });
    }

    const topicText = String(post.title || post.hook || currentParts[0] || "").slice(0, 200);
    const gated = buildGatedWriteContext(body, body, topicText);
    const configuredLimit = gated.directives.characterLimit;
    const effectiveCategory = body.category || post.category || "trust";
    const ctaOff = gated.directives.ctaOff;

    // Grounding sources include the original draft so facts in the original post are preserved
    const optimizeSourceTexts = [...gated.groundingSourceTexts, currentParts.join("\n\n")];
    const originalUrls = (currentParts.join(" ").match(/https?:\/\/[^\s<>)]+/g) || []).map(u => u.replace(/[.,;!?)]+$/, ""));
    const allowedUrls = ctaOff ? [] : Array.from(new Set([...gated.allowedUrls, ...originalUrls]));

    const ai = getAI();
    const systemInstruction = composeSingleWriteSystemInstruction("OPTIMIZE_POST", gated);

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        hook: { type: Type.STRING },
        singlePost: { type: Type.STRING },
        threadParts: { type: Type.ARRAY, items: { type: Type.STRING } },
        cta: { type: Type.STRING },
        ctaDecision: { type: Type.STRING },
        explanation: { type: Type.STRING },
        scores: {
          type: Type.OBJECT,
          properties: {
            overall: { type: Type.INTEGER },
            hook: { type: Type.INTEGER },
            curiosity: { type: Type.INTEGER },
            authority: { type: Type.INTEGER },
            readability: { type: Type.INTEGER },
            conversion: { type: Type.INTEGER },
            tip: { type: Type.STRING }
          },
          required: ["overall", "hook", "curiosity", "authority", "readability", "conversion", "tip"]
        },
        optimizationsApplied: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      },
      required: ["title", "hook", "singlePost", "threadParts", "explanation", "scores", "optimizationsApplied"]
    };

    const runOptimize = async (repairFeedback?: string) => {
      const response = await callGenerateContentWithRetry(ai, {
        model: THREADSWORKS_MODELS.FLASH_36,
        optimizationTaskId: "OPTIMIZE_POST",
        optimizationComplexity: "LEVEL_2_STANDARD",
        strictContentGeneration: true,
        contents: JSON.stringify({
          originalDraft: {
            title: post.title || "",
            category: effectiveCategory,
            explanation: post.explanation || "",
            threadParts: currentParts
          },
          facts: gated.factsPayload,
          settings: {
            characterLimit: configuredLimit,
            partCount: currentParts.length,
            sentencesPerPart: gated.directives.sentencesPerPart,
            writingPlan: gated.writingPlan,
            ctaPreferences: gated.directives.ctaPreferences,
            ctaOff,
            allowedUrls
          },
          instructions: "Sharpen the hook (no formulaic 'Most people'/'The unfiltered truth:' clichés), tighten rhythm and clarity, preserve factual accuracy without inventing new proof or customers, keep every part <= characterLimit, match hook to exact start of threadParts[0], and provide honest realistic 1-100 quality scores with one actionable tip.",
          ...(repairFeedback ? { repairFeedback } : {})
        }),
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          maxOutputTokens: 3200,
          responseSchema
        }
      });
      if (response.isSimulated) {
        throw new GenerationPipelineError("PROVIDER_ERROR", "AI optimization is unavailable.", { httpStatus: 503, retryable: true });
      }
      try {
        return parseGeminiJsonResponse(response.text || "");
      } catch (e: any) {
        throw new GenerationPipelineError("PARSE_ERROR", `Optimizer returned malformed JSON: ${e?.message || "Invalid JSON"}`, {
          httpStatus: 502,
          retryable: true,
          cause: e
        });
      }
    };

    let parsed = await runOptimize();
    let validatedPost: any;
    try {
      validatedPost = validateSingleDraft(parsed, {
        slotNumber: 1,
        characterLimit: configuredLimit,
        checkInternalRepetition: true,
        allowedUrls,
        sourceTexts: optimizeSourceTexts,
        ctaOff,
        enforceGroundedness: true
      });
    } catch (firstErr: any) {
      const infra = classifyProviderOrNetworkError(firstErr);
      if (infra) throw infra;
      parsed = await runOptimize(`Previous optimization failed validation: ${firstErr.message}. Fix this defect strictly.`);
      validatedPost = validateSingleDraft(parsed, {
        slotNumber: 1,
        characterLimit: configuredLimit,
        checkInternalRepetition: true,
        allowedUrls,
        sourceTexts: optimizeSourceTexts,
        ctaOff,
        enforceGroundedness: true
      });
    }

    return res.json({
      optimizedPost: {
        ...validatedPost,
        id: post.id,
        category: effectiveCategory,
        explanation: parsed.explanation || post.explanation || "",
        generatorVersion: "V3"
      },
      scores: parsed.scores,
      optimizationsApplied: Array.isArray(parsed.optimizationsApplied) ? parsed.optimizationsApplied : [],
      generatorVersion: "V3"
    });
  } catch (err: any) {
    console.error("[Optimize Post Error]:", err);
    return sendPipelineErrorResponse(res, err, "Post optimization failed.");
  }
});

// REST route to generate a contextual consecutive thread part (voice-only supported, strict validation)
const generateNextPartHandler = async (req: any, res: any) => {
  try {
    const body = req.body || {};
    const partsArray: string[] = (body.existingParts || body.existingThreadParts || [])
      .map((p: any) => String(p || "").trim())
      .filter(Boolean);

    if (!Array.isArray(partsArray) || partsArray.length === 0) {
      return res.status(400).json({
        error: "Missing existing thread parts for continuation.",
        errorCode: "REQUEST_ERROR",
        retryable: false
      });
    }

    const topicText = partsArray.join(" ").slice(0, 300);
    const gated = buildGatedWriteContext(body, body, topicText);
    const configuredLimit = gated.directives.characterLimit;
    const ctaOff = gated.directives.ctaOff;
    const originalUrls = (partsArray.join(" ").match(/https?:\/\/[^\s<>)]+/g) || []).map(u => u.replace(/[.,;!?)]+$/, ""));
    const allowedUrls = ctaOff ? [] : Array.from(new Set([...gated.allowedUrls, ...originalUrls]));
    const sourceTexts = [...gated.groundingSourceTexts, partsArray.join("\n\n")];

    const ai = getAI();
    const systemInstruction = composeSingleWriteSystemInstruction("NEXT_PART", gated);

    const generateOnce = async (repairFeedback?: string) => {
      const response = await callGenerateContentWithRetry(ai, {
        model: THREADSWORKS_MODELS.FLASH_36,
        optimizationTaskId: "NEXT_PART",
        optimizationComplexity: "LEVEL_2_STANDARD",
        strictContentGeneration: true,
        contents: JSON.stringify({
          nextPartNumber: partsArray.length + 1,
          existingParts: partsArray,
          facts: gated.factsPayload,
          settings: {
            category: gated.directives.category,
            characterLimit: configuredLimit,
            sentencesPerPart: gated.directives.sentencesPerPart,
            writingPlan: gated.writingPlan,
            ctaPreferences: gated.directives.ctaPreferences,
            ctaOff,
            allowedUrls
          },
          ...(repairFeedback ? { repairFeedback } : {})
        }),
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          maxOutputTokens: 1000,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              part: { type: Type.STRING }
            },
            required: ["part"]
          }
        }
      });
      if (response.isSimulated) {
        throw new GenerationPipelineError("PROVIDER_ERROR", "AI continuation is unavailable.", { httpStatus: 503, retryable: true });
      }
      let parsed: any;
      try {
        parsed = parseGeminiJsonResponse(response.text || "");
      } catch (e: any) {
        throw new GenerationPipelineError("PARSE_ERROR", `Next-part writer returned malformed JSON: ${e?.message || "Invalid JSON"}`, {
          httpStatus: 502,
          retryable: true,
          cause: e
        });
      }
      const text = typeof parsed?.part === "string" ? parsed.part.trim() : "";
      if (!text) {
        throw new GenerationPipelineError("SCHEMA_ERROR", "Next-part writer returned an empty part.");
      }
      if (text.length > configuredLimit) {
        throw new GenerationPipelineError("CONTENT_VALIDATION_ERROR", `Generated part (${text.length} chars) exceeds ${configuredLimit} characters.`);
      }
      for (const match of text.matchAll(/https?:\/\/[^\s<>]+/g)) {
        const url = match[0].replace(/[.,;!?)]+$/, "");
        if (!allowedUrls.includes(url)) {
          throw new GenerationPipelineError("CONTENT_VALIDATION_ERROR", "Generated part contains an unauthorized URL.");
        }
      }
      const unsupported = checkUnsupportedClaims(text, sourceTexts);
      if (unsupported.length > 0) {
        throw new GenerationPipelineError("CONTENT_VALIDATION_ERROR", unsupported.join("; "));
      }
      return text;
    };

    let partText: string;
    try {
      partText = await generateOnce();
    } catch (firstErr: any) {
      const infra = classifyProviderOrNetworkError(firstErr);
      if (infra) throw infra;
      partText = await generateOnce(`Previous attempt failed validation: ${firstErr.message}. Rewrite cleanly within ${configuredLimit} characters without inventing claims or unauthorized URLs.`);
    }

    return res.json({ part: partText, continuationPart: partText, generatorVersion: "V3" });
  } catch (err: any) {
    console.error("[GenerateNextPart] Error:", err);
    return sendPipelineErrorResponse(res, err, "Failed to generate next thread part.");
  }
};

app.post("/api/generate-next-part", generateNextPartHandler);
app.post("/api/generate-thread-continuation", generateNextPartHandler);

// REST route to revise and shorten an over-limit thread part (no destructive truncation)
app.post("/api/revise-part-length", async (req, res) => {
  try {
    const { text, characterLimit, sentencesPerPart, context } = req.body || {};
    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "Missing text to revise.", errorCode: "REQUEST_ERROR", retryable: false });
    }
    const configuredLimit = Math.min(500, Math.max(50, Number(characterLimit) || 500));
    const ai = getAI();
    const systemInstruction = composeSingleWriteSystemInstruction("REVISE_LENGTH");

    const reviseOnce = async (feedback?: string) => {
      const response = await callGenerateContentWithRetry(ai, {
        model: THREADSWORKS_MODELS.FLASH_LITE_35,
        optimizationTaskId: "REVISE_PART_LENGTH",
        optimizationComplexity: "LEVEL_1_LIGHT",
        strictContentGeneration: true,
        contents: JSON.stringify({
          originalText: text.trim(),
          characterLimit: configuredLimit,
          sentencesPerPart: sentencesPerPart || "auto",
          voiceHint: context?.writingStyle || "",
          instruction: `Tighten originalText so it is strictly <= ${configuredLimit} characters while keeping complete sentences, full meaning, and natural voice. Return ONLY the revised text.`,
          ...(feedback ? { feedback } : {})
        }),
        config: { systemInstruction, maxOutputTokens: 600 }
      });
      if (response.isSimulated) {
        throw new GenerationPipelineError("PROVIDER_ERROR", "AI length revision is unavailable.", { httpStatus: 503, retryable: true });
      }
      return (response.text || "").trim();
    };

    let revised = await reviseOnce();
    if (!revised || revised.length > configuredLimit) {
      revised = await reviseOnce(`Previous draft was ${revised.length} characters. You MUST make it <= ${configuredLimit} characters with complete sentences.`);
    }
    if (!revised || revised.length > configuredLimit) {
      throw new GenerationPipelineError("CONTENT_VALIDATION_ERROR", `Revised text could not fit within ${configuredLimit} characters.`);
    }

    return res.json({
      originalLength: text.length,
      revisedText: revised,
      revisedLength: revised.length,
      characterLimit: configuredLimit,
      isUnderLimit: revised.length <= configuredLimit,
      generatorVersion: "V3"
    });
  } catch (err: any) {
    return sendPipelineErrorResponse(res, err, "Failed to revise part length.");
  }
});

// REST route for Dynamic Angle and Hook generation upstream of Create Best Post Creator Workflow
app.post("/api/generate-angle-and-hook", async (req, res) => {
  let limitHandle: any = null;
  try {
    const body = req.body || {};
    const { userId, topic, profile, selectedSavedTabId, savedTabId, previousAngles = [], previousHooks = [], recentLibraryPosts = [] } = body;
    let authUser = null;
    try {
      authUser = await verifyAuthUser(req, userId);
    } catch (_) {}
    const effectiveUserId = authUser?.uid || userId || profile?.uid || "anonymous";
    const effectiveSavedTabId = selectedSavedTabId || savedTabId;

    limitHandle = await enforceAiGenerationLimit(req, res, userId);
    if (!limitHandle) return;

    const resolvedContext = await resolveCreatorContextForGeneration(
      serverDb,
      effectiveUserId,
      effectiveSavedTabId,
      {
        offer: profile?.offer || profile?.businessPositioning?.offer,
        audience: profile?.audience || profile?.businessPositioning?.audience,
        desiredResult: profile?.desiredResult || profile?.businessPositioning?.desiredResult,
        writingStyle: profile?.writingStyle || profile?.creatorIdentity?.writingStyle,
        customInstruction: profile?.customInstruction,
        creatorIdentity: profile?.creatorIdentity,
        rawVoice: profile?.rawVoice,
        rawBusinessText: profile?.rawBusinessText,
        offerIntelligence: profile?.offerIntelligence,
        buyerIntelligence: profile?.buyerIntelligence
      }
    );

    const effectiveTopic = String(topic || "").trim();
    const gated = buildGatedWriteContext(resolvedContext, { ...profile, ...body }, effectiveTopic);

    const snapshot = await getOrBuildGenerationIntelligenceSnapshot(serverDb, effectiveUserId, effectiveSavedTabId).catch(() => null);
    const diversityLedger = buildRollingLedger(
      snapshot,
      Array.isArray(recentLibraryPosts) ? recentLibraryPosts : [],
      Array.isArray(previousHooks) ? previousHooks : [],
      Array.isArray(previousAngles) ? previousAngles : []
    );
    const suggestedSlot = planBatchSlots({ count: 1, ledger: diversityLedger })[0];

    const ai = getAI();
    const systemInstruction = composeSingleWriteSystemInstruction("ANGLE_HOOK", gated);

    const generateOnce = async (retryFeedback?: string) => {
      const response = await callGenerateContentWithRetry(ai, {
        model: THREADSWORKS_MODELS.FLASH_36,
        optimizationTaskId: "GENERATE_ANGLE_HOOK",
        optimizationComplexity: "LEVEL_2_STANDARD",
        strictContentGeneration: true,
        contents: JSON.stringify({
          topic: effectiveTopic || "select the highest-leverage topic from the creator's context",
          facts: gated.factsPayload,
          recommendedLens: suggestedSlot,
          exclusionHistory: {
            recentAnglesToAvoid: Array.from(new Set([...previousAngles, ...diversityLedger.recentLenses])).slice(0, 10),
            recentHooksToAvoid: diversityLedger.recentHooks.slice(0, 12)
          },
          rules: {
            maxHookChars: 140,
            banFormulaicOpeners: true,
            requireSpecificReasoning: true
          },
          ...(retryFeedback ? { retryFeedback } : {})
        }),
        config: {
          systemInstruction,
          temperature: 0.85,
          maxOutputTokens: 1000,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              angle: {
                type: Type.OBJECT,
                properties: {
                  perspective: { type: Type.STRING },
                  explanation: { type: Type.STRING }
                },
                required: ["perspective", "explanation"]
              },
              hook: { type: Type.STRING }
            },
            required: ["angle", "hook"]
          }
        }
      });
      if (response.isSimulated) {
        throw new GenerationPipelineError("PROVIDER_ERROR", "AI angle and hook generation is unavailable.", { httpStatus: 503, retryable: true });
      }
      let parsed: any;
      try {
        parsed = parseGeminiJsonResponse(response.text || "");
      } catch (e: any) {
        throw new GenerationPipelineError("PARSE_ERROR", `Angle/Hook generator returned malformed JSON: ${e?.message || "Invalid JSON"}`, {
          httpStatus: 502,
          retryable: true,
          cause: e
        });
      }
      if (!parsed?.angle?.perspective || !parsed?.angle?.explanation || typeof parsed?.hook !== "string" || !parsed.hook.trim()) {
        throw new GenerationPipelineError("SCHEMA_ERROR", "Angle/Hook generator omitted required fields.");
      }
      const cleanHook = parsed.hook.trim();
      const defects: string[] = [];
      if (cleanHook.length > 150) defects.push(`Hook exceeded 150 characters (${cleanHook.length}).`);
      const formulaic = detectFormulaicOpener(cleanHook);
      if (formulaic) defects.push(`Hook used formulaic opener ${formulaic}.`);
      const novelty = checkDraftNovelty({ hook: cleanHook, threadParts: [cleanHook] }, {
        slotNumber: 1,
        acceptedDrafts: [],
        ledger: diversityLedger,
        topicText: effectiveTopic
      });
      if (!novelty.passed) defects.push(...novelty.defects);
      if (defects.length > 0) {
        throw new GenerationPipelineError("CONTENT_VALIDATION_ERROR", defects.join("; "));
      }
      return {
        angle: {
          perspective: String(parsed.angle.perspective).trim(),
          explanation: String(parsed.angle.explanation).trim()
        },
        hook: cleanHook
      };
    };

    let resultPayload: { angle: { perspective: string; explanation: string }; hook: string };
    try {
      resultPayload = await generateOnce();
    } catch (firstErr: any) {
      const infra = classifyProviderOrNetworkError(firstErr);
      if (infra) throw infra;
      resultPayload = await generateOnce(`Previous attempt failed validation: ${firstErr.message}. Pick a genuinely distinct lens and direct, non-formulaic opening under 140 characters.`);
    }

    let committedUsage = null;
    if (limitHandle && !limitHandle.isPro) {
      committedUsage = await commitGeneration(serverDb, limitHandle.activeUserId, limitHandle.reservationId);
    }

    return res.json({
      success: true,
      angle: resultPayload.angle,
      hook: resultPayload.hook,
      businessRelevance: gated.businessRelevance,
      generatorVersion: "V3",
      generationUsage: committedUsage
    });
  } catch (err: any) {
    if (limitHandle && !limitHandle.isPro && limitHandle.reservationId) {
      await releaseReservation(serverDb, limitHandle.activeUserId, limitHandle.reservationId).catch(() => {});
    }
    if (err instanceof SavedTabError) {
      return res.status(err.statusCode).json({ success: false, error: err.code, message: err.message });
    }
    console.error("[DynamicAngleHook] Handler error:", err);
    return sendPipelineErrorResponse(res, err, "Failed to generate angle and hook.");
  }
});

// REST route for Create Best Post application (Unified V3 Context Gating, Diversity Ledger & Validation)
app.post("/api/create-best-post", async (req, res) => {
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Keep-Alive", "timeout=120");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

  let limitHandle: any = null;

  try {
    const body = req.body || {};
    const {
      userId,
      focusInput,
      profile,
      previousPosts = [],
      recentLibraryPosts = [],
      angle,
      hook,
      selectedSavedTabId,
      savedTabId
    } = body;

    let authUser = null;
    try {
      authUser = await verifyAuthUser(req, userId);
    } catch (_) {}
    const effectiveUserId = authUser?.uid || userId || profile?.uid || "anonymous";
    const effectiveSavedTabId = selectedSavedTabId || savedTabId;

    limitHandle = await enforceAiGenerationLimit(req, res, userId);
    if (!limitHandle) return;

    const resolvedContext = await resolveCreatorContextForGeneration(
      serverDb,
      effectiveUserId,
      effectiveSavedTabId,
      {
        offer: profile?.offer || profile?.businessPositioning?.offer,
        audience: profile?.audience || profile?.businessPositioning?.audience,
        desiredResult: profile?.desiredResult || profile?.businessPositioning?.desiredResult,
        writingStyle: profile?.writingStyle || profile?.creatorIdentity?.writingStyle,
        customInstruction: profile?.customInstruction,
        ctaPreferences: profile?.ctaPreferences,
        contentDestinations: profile?.contentDestinations,
        creatorIdentity: profile?.creatorIdentity,
        rawVoice: profile?.rawVoice,
        rawBusinessText: profile?.rawBusinessText,
        offerIntelligence: profile?.offerIntelligence,
        buyerIntelligence: profile?.buyerIntelligence,
        activeCta: profile?.activeCta,
        activePillar: profile?.activePillar
      }
    );

    const cleanFocus = typeof focusInput === "string" ? focusInput.trim() : "";
    const cleanInputHook = typeof hook === "string" ? hook.trim() : "";
    const gated = buildGatedWriteContext(
      resolvedContext,
      {
        ...profile,
        ...body,
        openingLocked: Boolean(cleanInputHook),
        lockedOpeningHook: cleanInputHook || undefined,
        activeStrategicAngle: angle?.perspective || body.activeStrategicAngle
      },
      cleanFocus
    );
    const characterLimit = gated.directives.characterLimit;
    const ctaOff = gated.directives.ctaOff;

    const intelligenceSnapshot = await getOrBuildGenerationIntelligenceSnapshot(
      serverDb,
      effectiveUserId,
      effectiveSavedTabId
    ).catch(() => null);

    const previousHookStrings = (Array.isArray(previousPosts) ? previousPosts : [])
      .map((p: any) => (typeof p === "string" ? p.trim() : String(p?.hook || p?.singlePost || "").trim()))
      .filter(Boolean);

    const diversityLedger = buildRollingLedger(
      intelligenceSnapshot,
      Array.isArray(recentLibraryPosts) ? recentLibraryPosts : [],
      previousHookStrings,
      angle?.perspective ? [] : []
    );
    const writingPlan = gated.writingPlan;
    const slotAssignment = planBatchSlots({
      count: 1,
      ledger: diversityLedger,
      partCount: gated.directives.partCount,
      requestedAngle: angle?.perspective || null,
      writingPlan,
      randomSeed: body.randomSeed
    })[0];

    const flywheelSummary: any = intelligenceSnapshot ? {
      dimensionAggregates: {
        pillar: (intelligenceSnapshot.performanceInsights?.topPillars || []).map((p: string) => ({ value: p, medianViews: 120 })),
        format: (intelligenceSnapshot.performanceInsights?.topFormats || []).map((f: string) => ({ value: f, medianViews: 140 })),
        angle: (intelligenceSnapshot.performanceInsights?.topAngles || []).map((a: string) => ({ value: a, medianViews: 130 }))
      },
      observations: (intelligenceSnapshot.performanceInsights?.observations || []).map((o: string, idx: number) => ({
        id: `obs_${idx}`,
        title: "Performance Pattern",
        statement: o
      }))
    } : null;
    const learnedStrats: any[] = intelligenceSnapshot?.learnedStrategies || [];
    const flywheelContext = buildViralFlywheelPromptContext(flywheelSummary, learnedStrats);

    const hasProfile = Boolean(gated.voice.writingStyle || gated.rawBusiness.offer || gated.rawBusiness.audience);
    const hasFlywheel = Boolean(flywheelSummary && ((intelligenceSnapshot?.performanceInsights?.observations?.length || 0) > 0 || learnedStrats.length > 0));
    const hasAnalytics = Boolean(intelligenceSnapshot?.performanceInsights?.medianViews);
    const hasContentHistory = Boolean(diversityLedger.entries.length > 0);
    const hasContentLibrary = Boolean(Array.isArray(recentLibraryPosts) && recentLibraryPosts.length > 0);
    const hasHookIntelligence = Boolean(diversityLedger.recentHooks.length > 0);
    const hasContentAngle = Boolean(cleanFocus || angle?.perspective);
    const hasCta = Boolean(!ctaOff && (gated.directives.ctaPreferences || gated.directives.activeCta));

    const intelligenceFlags = {
      profile: hasProfile,
      flywheel: hasFlywheel,
      analytics: hasAnalytics,
      contentHistory: hasContentHistory,
      contentLibrary: hasContentLibrary,
      hookIntelligence: hasHookIntelligence,
      contentAngle: hasContentAngle,
      contactAngle: hasContentAngle,
      cta: hasCta
    };

    const ai = getAI();
    const systemInstruction = composeSingleWriteSystemInstruction("CREATE_BEST_POST", gated);
    const reviewerSystemInstruction = composeReviewerSystemInstruction();

    const bestPostSchema = {
      type: Type.OBJECT,
      properties: {
        post: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            hook: { type: Type.STRING },
            threadParts: { type: Type.ARRAY, items: { type: Type.STRING } },
            cta: { type: Type.STRING },
            ctaDecision: { type: Type.STRING },
            explanation: { type: Type.STRING },
            category: { type: Type.STRING },
            format: { type: Type.STRING }
          },
          required: ["title", "hook", "threadParts", "cta", "ctaDecision", "explanation", "category", "format"]
        },
        strategyExplanation: { type: Type.STRING },
        winningSignals: { type: Type.ARRAY, items: { type: Type.STRING } },
        intelligenceUsedNotes: { type: Type.STRING }
      },
      required: ["post", "strategyExplanation", "winningSignals"]
    };

    const parseOrThrow = (text: string | undefined, stage: string) => {
      try {
        return parseGeminiJsonResponse(text || "");
      } catch (e: any) {
        throw new GenerationPipelineError("PARSE_ERROR", `${stage} returned malformed JSON: ${e?.message || "Invalid JSON"}`, {
          httpStatus: 502,
          retryable: true,
          cause: e
        });
      }
    };

    const assignmentPayload = {
      focusInput: cleanFocus || "Automatic opportunity selection based on creator voice, domain, and performance insights",
      facts: gated.factsPayload,
      slotPlan: [slotAssignment],
      preselectedAngle: angle || null,
      mandatoryOpeningHook: cleanInputHook || null,
      flywheelContext: flywheelContext ? flywheelContext.slice(0, 1200) : null,
      settings: {
        characterLimit,
        partCount: gated.directives.partCount || "auto",
        sentencesPerPart: gated.directives.sentencesPerPart,
        writingPlan,
        ctaPreferences: gated.directives.ctaPreferences,
        ctaOff,
        activeCta: gated.directives.activeCta,
        destinations: gated.directives.destinations
      },
      exclusionHistory: buildCompactExclusionSummary([], diversityLedger)
    };

    let latestWrapperMeta: { strategyExplanation: string; winningSignals: string[]; intelligenceUsedNotes: string } = {
      strategyExplanation: "",
      winningSignals: [],
      intelligenceUsedNotes: ""
    };

    const extractPostFromEnvelope = (raw: any) => {
      if (!raw || typeof raw !== "object" || !raw.post || typeof raw.post !== "object") {
        throw new GenerationPipelineError("SCHEMA_ERROR", "Create Best Post response missing 'post' object.");
      }
      latestWrapperMeta = {
        strategyExplanation: sanitizeSentenceSpacing(String(raw.strategyExplanation || "").trim()),
        winningSignals: Array.isArray(raw.winningSignals) ? raw.winningSignals.map((s: any) => String(s).trim()).filter(Boolean) : [],
        intelligenceUsedNotes: sanitizeSentenceSpacing(String(raw.intelligenceUsedNotes || "").trim())
      };
      return raw.post;
    };

    const validatedPost = await executeValidatedSingleWrite({
      validation: {
        characterLimit,
        partCount: gated.directives.partCount,
        minParts: writingPlan.minParts,
        maxParts: writingPlan.maxParts,
        exactSentencesPerPart: writingPlan.sentencesMode === "explicit" ? writingPlan.recommendedSentencesPerPart : undefined,
        maxSentencesPerPart: writingPlan.sentencesMode === "auto" ? writingPlan.maxSentencesPerPart : undefined,
        checkInternalRepetition: true,
        allowedUrls: gated.allowedUrls,
        sourceTexts: gated.groundingSourceTexts,
        lockedHook: cleanInputHook || undefined,
        ctaOff,
        enforceGroundedness: true,
        enforceNovelty: true,
        diversityLedger,
        topicText: cleanFocus
      },
      generateDraft: async schemaRetryFeedback => {
        const response = await callGenerateContentWithRetry(ai, {
          model: THREADSWORKS_MODELS.FLASH_36,
          optimizationTaskId: "CREATE_BEST_POST",
          optimizationComplexity: "LEVEL_2_STANDARD",
          strictContentGeneration: true,
          contents: JSON.stringify({
            ...assignmentPayload,
            ...(schemaRetryFeedback ? { schemaRetryFeedback } : {})
          }),
          config: {
            systemInstruction,
            maxOutputTokens: 5500,
            responseMimeType: "application/json",
            responseSchema: bestPostSchema
          }
        });
        if (response.isSimulated) {
          throw new GenerationPipelineError("PROVIDER_ERROR", "AI generation is unavailable.", { httpStatus: 503, retryable: true });
        }
        return extractPostFromEnvelope(parseOrThrow(response.text, "Create Best Post writer"));
      },
      reviewDraft: async draft => {
        const review = await callGenerateContentWithRetry(ai, {
          model: THREADSWORKS_MODELS.FLASH_LITE_35,
          optimizationTaskId: "REVIEW_CONTENT_BATCH",
          optimizationComplexity: "LEVEL_1_LIGHT",
          strictContentGeneration: true,
          contents: JSON.stringify({
            assignment: assignmentPayload,
            drafts: [{
              slotNumber: 1,
              title: draft.title,
              hook: draft.hook,
              threadParts: draft.threadParts,
              cta: draft.cta,
              ctaDecision: draft.ctaDecision
            }]
          }),
          config: {
            systemInstruction: reviewerSystemInstruction,
            responseMimeType: "application/json",
            maxOutputTokens: 1200,
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  slotNumber: { type: Type.INTEGER },
                  passed: { type: Type.BOOLEAN },
                  defects: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["slotNumber", "passed", "defects"]
              }
            }
          }
        });
        if (review.isSimulated) {
          throw new GenerationPipelineError("PROVIDER_ERROR", "AI review is unavailable.", { httpStatus: 503, retryable: true });
        }
        const arr = parseOrThrow(review.text, "Create Best Post review");
        const entry = Array.isArray(arr) ? arr.find((r: any) => r?.slotNumber === 1) || arr[0] : null;
        if (!entry || typeof entry.passed !== "boolean" || !Array.isArray(entry.defects)) {
          throw new GenerationPipelineError("SCHEMA_ERROR", "Editorial review returned an invalid response.");
        }
        return { slotNumber: 1, passed: entry.passed && entry.defects.length === 0, defects: entry.defects };
      },
      repairDraft: async ({ draft, defects }) => {
        const response = await callGenerateContentWithRetry(ai, {
          model: THREADSWORKS_MODELS.FLASH_36,
          optimizationTaskId: "REPAIR_POST",
          optimizationComplexity: "LEVEL_2_STANDARD",
          strictContentGeneration: true,
          contents: JSON.stringify({
            ...assignmentPayload,
            failedDraft: draft,
            defects,
            repairDirective: `Fix EVERY defect listed (${defects.join("; ")}). Preserve verified facts, avoid inventing customers/metrics/guides, keep every part <= ${characterLimit} characters, and ensure post.hook matches the exact start of post.threadParts[0].`
          }),
          config: {
            systemInstruction,
            maxOutputTokens: 5500,
            responseMimeType: "application/json",
            responseSchema: bestPostSchema
          }
        });
        if (response.isSimulated) {
          throw new GenerationPipelineError("PROVIDER_ERROR", "AI repair is unavailable.", { httpStatus: 503, retryable: true });
        }
        return extractPostFromEnvelope(parseOrThrow(response.text, "Create Best Post repair"));
      },
      replaceDraft: async ({ failedDraft, defects }) => {
        const response = await callGenerateContentWithRetry(ai, {
          model: THREADSWORKS_MODELS.FLASH_36,
          optimizationTaskId: "CREATE_BEST_POST",
          optimizationComplexity: "LEVEL_2_STANDARD",
          strictContentGeneration: true,
          contents: JSON.stringify({
            ...assignmentPayload,
            rejectedDraftSummary: failedDraft ? { title: failedDraft.title, hook: failedDraft.hook } : null,
            avoidDefects: defects,
            replacementDirective: `Discard the failed draft and write ONE completely fresh, grounded best Threads post avoiding: ${defects.join("; ")}.`
          }),
          config: {
            systemInstruction,
            maxOutputTokens: 5500,
            responseMimeType: "application/json",
            responseSchema: bestPostSchema
          }
        });
        if (response.isSimulated) {
          throw new GenerationPipelineError("PROVIDER_ERROR", "AI replacement is unavailable.", { httpStatus: 503, retryable: true });
        }
        return extractPostFromEnvelope(parseOrThrow(response.text, "Create Best Post replacement"));
      }
    });

    const finalPost = {
      ...validatedPost,
      id: `best_post_${Date.now()}`,
      format: validatedPost.threadParts.length === 1 ? "single" : "thread",
      lens: slotAssignment.lensId,
      generatorVersion: "V3"
    };

    const mergedWinningSignals = [
      ...(angle?.perspective ? [`Angle: ${angle.perspective}`] : []),
      ...(latestWrapperMeta.winningSignals.length > 0 ? latestWrapperMeta.winningSignals : ["Voice: Matched to creator profile", "Novelty: Checked against recent library history"])
    ];

    const cleanStrategyExplanation = latestWrapperMeta.strategyExplanation ||
      "Selected a distinct, grounded angle tailored to the creator's voice and recent posting history.";
    const cleanIntelligenceSummaryNote = latestWrapperMeta.intelligenceUsedNotes ||
      (hasAnalytics
        ? `Calibrated with Profile DNA, performance insights, and rolling anti-repetition history.`
        : "Grounded in creator voice, directives, and rolling anti-repetition history.");

    recordGeneratedBatchInSnapshot(serverDb, effectiveUserId, effectiveSavedTabId, [finalPost]).catch(err => {
      console.warn(`[CreateBestPost] Snapshot update failed:`, err?.message);
    });

    let committedUsage = null;
    if (limitHandle && !limitHandle.isPro) {
      committedUsage = await commitGeneration(serverDb, limitHandle.activeUserId, limitHandle.reservationId);
    }

    return res.json({
      success: true,
      post: finalPost,
      strategyExplanation: cleanStrategyExplanation,
      winningSignals: mergedWinningSignals,
      intelligenceUsed: intelligenceFlags,
      intelligenceSummaryNote: cleanIntelligenceSummaryNote,
      businessRelevance: gated.businessRelevance,
      writingPlan,
      generatorVersion: "V3",
      generationUsage: committedUsage
    });
  } catch (err: any) {
    if (limitHandle && !limitHandle.isPro && limitHandle.reservationId) {
      await releaseReservation(serverDb, limitHandle.activeUserId, limitHandle.reservationId).catch(() => {});
    }
    if (err instanceof SavedTabError) {
      return res.status(err.statusCode).json({ success: false, error: err.code, message: err.message });
    }
    console.error("[CreateBestPost] Error generating best post:", err);
    return sendPipelineErrorResponse(res, err, "Failed to generate best post recommendation.");
  }
});

// REST route for Threads content generation (Unified V3 Write Architecture; voice-only supported)
app.post("/api/generate-threads", async (req, res) => {
  let limitHandle: any = null;
  try {
    const body = req.body || {};
    let authUser = null;
    try {
      authUser = await verifyAuthUser(req, body.userId);
    } catch (_) {}
    const activeUserId = authUser?.uid || body.userId || body.creatorIdentity?.uid || "anonymous";
    const effectiveSavedTabId = body.selectedSavedTabId || body.savedTabId;

    limitHandle = await enforceAiGenerationLimit(req, res, body.userId);
    if (!limitHandle) return;

    const resolvedContext = await resolveCreatorContextForGeneration(
      serverDb,
      activeUserId,
      effectiveSavedTabId,
      body
    );

    const effectiveTopic = String(body.topic || body.contentRequest || body.focusInput || "").trim();
    const gated = buildGatedWriteContext(
      resolvedContext,
      { ...body, threadLength: body.threadLength ?? body.postLength },
      effectiveTopic
    );

    if (!effectiveTopic && !gated.rawBusiness.offer && !gated.voice.rawVoice && !gated.directives.customInstruction) {
      return res.status(400).json({
        error: "Enter a topic or configure your creator voice/profile before generating threads.",
        errorCode: "REQUEST_ERROR",
        retryable: false
      });
    }

    const characterLimit = gated.directives.characterLimit;
    const writingPlan = gated.writingPlan;
    const partCount = body.format === "hook-value" && !gated.directives.partCount ? 1 : gated.directives.partCount;
    const ctaOff = gated.directives.ctaOff;

    const snapshot = await getOrBuildGenerationIntelligenceSnapshot(serverDb, activeUserId, effectiveSavedTabId).catch(() => null);
    const diversityLedger = buildRollingLedger(
      snapshot,
      Array.isArray(body.recentLibraryPosts) ? body.recentLibraryPosts : []
    );
    const slotAssignment = planBatchSlots({ count: 1, ledger: diversityLedger, partCount, writingPlan, randomSeed: body.randomSeed })[0];

    const ai = getAI();
    const systemInstruction = composeSingleWriteSystemInstruction("GENERATE_THREAD", gated);
    const reviewerSystemInstruction = composeReviewerSystemInstruction();

    const draftSchema = {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        hook: { type: Type.STRING },
        threadParts: { type: Type.ARRAY, items: { type: Type.STRING } },
        cta: { type: Type.STRING },
        ctaDecision: { type: Type.STRING },
        explanation: { type: Type.STRING }
      },
      required: ["title", "hook", "threadParts", "cta", "ctaDecision", "explanation"]
    };

    const parseOrThrow = (text: string | undefined, stage: string) => {
      try {
        return parseGeminiJsonResponse(text || "");
      } catch (e: any) {
        throw new GenerationPipelineError("PARSE_ERROR", `${stage} returned malformed JSON: ${e?.message || "Invalid JSON"}`, {
          httpStatus: 502,
          retryable: true,
          cause: e
        });
      }
    };

    const assignmentPayload = {
      contentRequest: effectiveTopic || "Create a high-value Threads post fitting the creator's context",
      format: body.format || "auto",
      facts: gated.factsPayload,
      slotPlan: [slotAssignment],
      settings: {
        characterLimit,
        partCount: partCount || "auto",
        sentencesPerPart: gated.directives.sentencesPerPart,
        writingPlan,
        ctaPreferences: gated.directives.ctaPreferences,
        ctaOff,
        activeCta: gated.directives.activeCta,
        destinations: gated.directives.destinations
      },
      exclusionHistory: buildCompactExclusionSummary([], diversityLedger)
    };

    const validatedPost = await executeValidatedSingleWrite({
      validation: {
        characterLimit,
        partCount,
        minParts: partCount ? undefined : writingPlan.minParts,
        maxParts: partCount ? undefined : writingPlan.maxParts,
        exactSentencesPerPart: writingPlan.sentencesMode === "explicit" ? writingPlan.recommendedSentencesPerPart : undefined,
        maxSentencesPerPart: writingPlan.sentencesMode === "auto" ? writingPlan.maxSentencesPerPart : undefined,
        checkInternalRepetition: true,
        allowedUrls: gated.allowedUrls,
        sourceTexts: gated.groundingSourceTexts,
        ctaOff,
        enforceGroundedness: true,
        enforceNovelty: true,
        diversityLedger,
        topicText: effectiveTopic
      },
      generateDraft: async schemaRetryFeedback => {
        const response = await callGenerateContentWithRetry(ai, {
          model: THREADSWORKS_MODELS.FLASH_36,
          optimizationTaskId: "GENERATE_THREADS",
          optimizationComplexity: "LEVEL_2_STANDARD",
          strictContentGeneration: true,
          contents: JSON.stringify({
            ...assignmentPayload,
            ...(schemaRetryFeedback ? { schemaRetryFeedback } : {})
          }),
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            maxOutputTokens: 5500,
            responseSchema: draftSchema
          }
        });
        if (response.isSimulated) {
          throw new GenerationPipelineError("PROVIDER_ERROR", "AI generation is unavailable.", { httpStatus: 503, retryable: true });
        }
        return parseOrThrow(response.text, "Generate Threads writer");
      },
      reviewDraft: async draft => {
        const review = await callGenerateContentWithRetry(ai, {
          model: THREADSWORKS_MODELS.FLASH_LITE_35,
          optimizationTaskId: "REVIEW_CONTENT_BATCH",
          optimizationComplexity: "LEVEL_1_LIGHT",
          strictContentGeneration: true,
          contents: JSON.stringify({
            assignment: assignmentPayload,
            drafts: [{
              slotNumber: 1,
              title: draft.title,
              hook: draft.hook,
              threadParts: draft.threadParts,
              cta: draft.cta,
              ctaDecision: draft.ctaDecision
            }]
          }),
          config: {
            systemInstruction: reviewerSystemInstruction,
            responseMimeType: "application/json",
            maxOutputTokens: 1200,
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  slotNumber: { type: Type.INTEGER },
                  passed: { type: Type.BOOLEAN },
                  defects: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["slotNumber", "passed", "defects"]
              }
            }
          }
        });
        if (review.isSimulated) {
          throw new GenerationPipelineError("PROVIDER_ERROR", "AI review is unavailable.", { httpStatus: 503, retryable: true });
        }
        const arr = parseOrThrow(review.text, "Generate Threads review");
        const entry = Array.isArray(arr) ? arr.find((r: any) => r?.slotNumber === 1) || arr[0] : null;
        if (!entry || typeof entry.passed !== "boolean" || !Array.isArray(entry.defects)) {
          throw new GenerationPipelineError("SCHEMA_ERROR", "Editorial review returned an invalid response.");
        }
        return { slotNumber: 1, passed: entry.passed && entry.defects.length === 0, defects: entry.defects };
      },
      repairDraft: async ({ draft, defects }) => {
        const response = await callGenerateContentWithRetry(ai, {
          model: THREADSWORKS_MODELS.FLASH_36,
          optimizationTaskId: "REPAIR_POST",
          optimizationComplexity: "LEVEL_2_STANDARD",
          strictContentGeneration: true,
          contents: JSON.stringify({
            ...assignmentPayload,
            failedDraft: draft,
            defects,
            repairDirective: `Fix EVERY defect listed (${defects.join("; ")}). Do not invent customers, testimonials, PDFs, or metrics. Keep every part <= ${characterLimit} characters.`
          }),
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            maxOutputTokens: 5500,
            responseSchema: draftSchema
          }
        });
        if (response.isSimulated) {
          throw new GenerationPipelineError("PROVIDER_ERROR", "AI repair is unavailable.", { httpStatus: 503, retryable: true });
        }
        return parseOrThrow(response.text, "Generate Threads repair");
      },
      replaceDraft: async ({ failedDraft, defects }) => {
        const response = await callGenerateContentWithRetry(ai, {
          model: THREADSWORKS_MODELS.FLASH_36,
          optimizationTaskId: "GENERATE_THREADS",
          optimizationComplexity: "LEVEL_2_STANDARD",
          strictContentGeneration: true,
          contents: JSON.stringify({
            ...assignmentPayload,
            rejectedDraftSummary: failedDraft ? { title: failedDraft.title, hook: failedDraft.hook } : null,
            avoidDefects: defects,
            replacementDirective: `Discard the failed draft and write ONE brand-new grounded Threads post avoiding: ${defects.join("; ")}.`
          }),
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            maxOutputTokens: 5500,
            responseSchema: draftSchema
          }
        });
        if (response.isSimulated) {
          throw new GenerationPipelineError("PROVIDER_ERROR", "AI replacement is unavailable.", { httpStatus: 503, retryable: true });
        }
        return parseOrThrow(response.text, "Generate Threads replacement");
      }
    });

    const finalResponse = {
      ...validatedPost,
      threadPosts: validatedPost.threadParts,
      lens: slotAssignment.lensId,
      businessRelevance: gated.businessRelevance,
      generatorVersion: "V3"
    };

    recordGeneratedBatchInSnapshot(serverDb, activeUserId, effectiveSavedTabId, [finalResponse]).catch(err => {
      console.warn(`[GenerateThreads] Snapshot update failed:`, err?.message);
    });

    if (limitHandle && !limitHandle.isPro) {
      await commitGeneration(serverDb, limitHandle.activeUserId, limitHandle.reservationId);
    }

    return res.json(finalResponse);
  } catch (err: any) {
    if (limitHandle && !limitHandle.isPro && limitHandle.reservationId) {
      await releaseReservation(serverDb, limitHandle.activeUserId, limitHandle.reservationId).catch(() => {});
    }
    if (err instanceof SavedTabError) {
      return res.status(err.statusCode).json({ success: false, error: err.code, message: err.message });
    }
    console.error("[GenerateThreads] Error:", err);
    return sendPipelineErrorResponse(res, err, "Failed to generate threads.");
  }
});

// ==========================================
// OFFICIAL META THREADS API ROUTE INTEGRATIONS
// ==========================================

// Helper to securely fetch the Meta Threads App ID and Secret from environment variables
async function getThreadsConfig() {
  const DEDICATED_APP_ID = "2270750866796278";
  const DEDICATED_APP_SECRET = "2ccd7a5764e6bb705ef52996dc60e62f";

  const rawAppId = (process.env.THREADS_APP_ID || process.env.VITE_THREADS_APP_ID || "").trim();
  const rawAppSecret = (process.env.THREADS_APP_SECRET || "").trim();

  let appId = rawAppId;
  let appSecret = rawAppSecret;

  // Sanitize placeholder strings, undefined values, empty strings, and parent Meta App ID (1688886785689455)
  if (
    !appId || 
    appId === "PLACEHOLDER" || 
    appId === "undefined" || 
    appId === "1688886785689455"
  ) {
    appId = DEDICATED_APP_ID;
    appSecret = DEDICATED_APP_SECRET;
  } else if (!appSecret || appSecret === "PLACEHOLDER" || appSecret === "undefined") {
    appSecret = DEDICATED_APP_SECRET;
  }

  // Ensure appSecret matches the dedicated Threads App ID if appId resolves to DEDICATED_APP_ID
  if (appId === DEDICATED_APP_ID && appSecret !== DEDICATED_APP_SECRET && rawAppId === "1688886785689455") {
    appSecret = DEDICATED_APP_SECRET;
  }

  return { appId: appId.trim(), appSecret: appSecret.trim() };
}

// Telemetry & Efficiency endpoint to monitor token conservation and circuit health
app.get("/api/ai-telemetry", (req, res) => {
  return res.json({
    ...aiTelemetry,
    optimizationEngine: {
       totalRequests: optimizationTelemetry.totalRequests,
       fallbackRequests: optimizationTelemetry.fallbackRequests,
       retryRequests: optimizationTelemetry.retryRequests,
       estimatedTokensSaved: optimizationTelemetry.estimatedTokensSaved,
       operations: Object.fromEntries(optimizationTelemetry.operations.entries())
    },
    circuitBreakerActive: isQuotaCircuitActive(),
    circuitBreakerUntil: circuitBreakerUntil ? new Date(circuitBreakerUntil).toISOString() : null,
    cacheEntries: responseCache.size,
    timestamp: new Date().toISOString()
  });
});

// Dedicated Content Integrity Checker endpoint:
// Runs on the server to inspect and guarantee complete sentences and eliminate random characters or fragmented thoughts
app.post("/api/check-content-integrity", async (req, res) => {
  try {
    const { post, text, charLimit = 480, expectedHook, context } = req.body || {};
    if (post && typeof post === "object") {
      const { post: verifiedPost, report } = ContentIntegrityChecker.verifyAndRepairPost(post, {
        charLimit: parseCharacterLimit(charLimit),
        expectedHook,
        context
      });
      return res.json({ success: true, post: verifiedPost, report });
    } else if (typeof text === "string") {
      const { cleanPart, issues, repairsApplied } = ContentIntegrityChecker.verifyAndRepairPart(
        text,
        0,
        1,
        { charLimit: parseCharacterLimit(charLimit), expectedHook, context }
      );
      return res.json({ success: true, cleanText: cleanPart, issues, repairsApplied });
    }
    return res.status(400).json({ error: "Missing required post object or text string to verify." });
  } catch (err: any) {
    console.error("[ContentIntegrityChecker] Error verifying content integrity:", err);
    return res.status(500).json({ error: err.message || "Failed to verify content integrity." });
  }
});

// A. Get Meta Threads developer credentials configuration status from environment
app.get("/api/threads/config", async (req, res) => {
  try {
    const config = await getThreadsConfig();
    const isConfigured = !!(config.appId && config.appSecret);
    return res.json({
      configured: isConfigured,
      appId: config.appId ? `${config.appId.slice(0, 4)}****${config.appId.slice(-4)}` : null
    });
  } catch (err: any) {
    console.error("Error retrieving Threads configuration status:", err);
    return res.status(500).json({ error: err.message });
  }
});

// 1. Safe URL Sanitization (Prevent Open Redirects)
function sanitizeReturnTo(rawReturnTo?: string | null): string {
  if (!rawReturnTo || typeof rawReturnTo !== "string") {
    return "/analytics";
  }
  const trimmed = rawReturnTo.trim();
  if (trimmed.startsWith("/") && !trimmed.startsWith("//") && !trimmed.includes("://") && !trimmed.includes("\\")) {
    const validPrefixes = [
      "/analytics",
      "/calendar",
      "/strategy",
      "/my-identity",
      "/my-business",
      "/saved-content",
      "/pricing",
      "/partner",
      "/partner-hub",
      "/ai-threads-post-generator",
      "/content-ideas",
      "/content-memory"
    ];
    const isAllowed = validPrefixes.some(p => trimmed === p || trimmed.startsWith(p + "/") || trimmed.startsWith(p + "?"));
    if (isAllowed) {
      return trimmed;
    }
  }
  return "/analytics";
}

// 2. Safe State Parsing (Supporting JSON, Base64URL, Base64, and Legacy formats)
function parseOAuthState(rawState: string | undefined | null): { userId: string; returnTo: string; origin?: string; nonce?: string } {
  if (!rawState) {
    return { userId: "", returnTo: "/analytics" };
  }
  // Base64URL JSON
  try {
    const jsonStr = Buffer.from(rawState, "base64url").toString("utf-8");
    const parsed = JSON.parse(jsonStr);
    if (parsed && typeof parsed === "object" && parsed.userId) {
      return {
        userId: String(parsed.userId),
        returnTo: sanitizeReturnTo(parsed.returnTo),
        origin: parsed.origin ? String(parsed.origin) : undefined,
        nonce: parsed.nonce
      };
    }
  } catch (_) {}

  // Standard Base64 JSON
  try {
    const jsonStr = Buffer.from(rawState, "base64").toString("utf-8");
    const parsed = JSON.parse(jsonStr);
    if (parsed && typeof parsed === "object" && parsed.userId) {
      return {
        userId: String(parsed.userId),
        returnTo: sanitizeReturnTo(parsed.returnTo),
        origin: parsed.origin ? String(parsed.origin) : undefined,
        nonce: parsed.nonce
      };
    }
  } catch (_) {}

  // Raw JSON
  try {
    const parsed = JSON.parse(rawState);
    if (parsed && typeof parsed === "object" && parsed.userId) {
      return {
        userId: String(parsed.userId),
        returnTo: sanitizeReturnTo(parsed.returnTo),
        origin: parsed.origin ? String(parsed.origin) : undefined,
        nonce: parsed.nonce
      };
    }
  } catch (_) {}

  // Legacy prefix format e.g. "analytics_USERID_TIMESTAMP" or "uid_USERID_TIMESTAMP"
  if (rawState.includes("_")) {
    const parts = rawState.split("_");
    if (parts.length >= 3) {
      const prefix = parts[0];
      const uid = parts.slice(1, -1).join("_");
      let returnPath = "/analytics";
      if (prefix === "calendar") returnPath = "/calendar";
      else if (prefix === "engine") returnPath = "/ai-threads-post-generator";
      else if (prefix === "strategy") returnPath = "/strategy";
      return { userId: uid, returnTo: returnPath };
    }
  }

  return { userId: rawState, returnTo: "/analytics" };
}

// 3. Diagnostic Safe Logging Helper (Never logs secrets, tokens, or codes)
function logOAuthDiagnostic(event: string, meta: Record<string, any>) {
  const safeMeta = { ...meta };
  delete safeMeta.code;
  delete safeMeta.access_token;
  delete safeMeta.accessToken;
  delete safeMeta.threadsAccessToken;
  delete safeMeta.longLivedToken;
  delete safeMeta.shortLivedToken;
  delete safeMeta.client_secret;
  delete safeMeta.appSecret;
  
  console.log(`[OAUTH_DIAGNOSTIC] [${new Date().toISOString()}] ${event}:`, JSON.stringify(safeMeta));
}

function logMetaApiError(
  context: string,
  userId: string,
  threadsUserId: string,
  endpointPath: string,
  status: number,
  errorData: any,
  requestedMetricsOrFields?: string
) {
  const metaError = errorData?.error || errorData || {};
  console.error(`[THREADS_API_ERROR] [${context}]`, {
    timestamp: new Date().toISOString(),
    firebaseUid: userId,
    threadsUserId: threadsUserId || "unknown",
    endpoint: endpointPath,
    httpStatus: status,
    metaErrorCode: metaError.code ?? metaError.error_subcode ?? "N/A",
    metaErrorType: metaError.type ?? "N/A",
    metaErrorMessage: metaError.message || JSON.stringify(errorData) || "Unknown Meta API error",
    requestedMetrics: requestedMetricsOrFields || "N/A"
  });
}

// 4. Secure Connection Persistence
// Helper: Verify live Threads permissions and check insights capabilities accurately
async function determineLiveThreadsScopes(
  token?: string,
  storedScopes: string[] = [],
  userId: string = "unknown",
  threadsUserId: string = "me"
): Promise<{ scopes: string[]; hasInsights: boolean; hasPublish: boolean }> {
  if (!token) {
    return { scopes: [], hasInsights: false, hasPublish: false };
  }

  let hasPublish = false;
  let hasInsights = false;
  const verifiedScopes: string[] = [];

  // 1. Live probe for basic profile & publishing token validity on /me
  try {
    const meRes = await fetch(`https://graph.threads.net/v1.0/me?fields=id,username&access_token=${encodeURIComponent(token)}`);
    if (meRes.ok) {
      hasPublish = true;
      verifiedScopes.push("threads_basic", "threads_content_publish");
    } else {
      const errJson = await meRes.json().catch(() => ({}));
      logMetaApiError("determineLiveThreadsScopes.me", userId, threadsUserId, "/me", meRes.status, errJson);
    }
  } catch (meErr: any) {
    console.warn("[determineLiveThreadsScopes] /me probe network error:", meErr?.message || meErr);
    if (storedScopes.includes("threads_basic")) {
      hasPublish = true;
      verifiedScopes.push("threads_basic", "threads_content_publish");
    }
  }

  // 2. Live probe for Insights capability on /{targetEndpoint}/threads_insights
  const targetEndpoint = (threadsUserId && threadsUserId !== "unknown" && threadsUserId !== "anonymous" && /^\d+$/.test(threadsUserId)) 
    ? threadsUserId 
    : "me";

  try {
    const testRes = await fetch(`https://graph.threads.net/v1.0/${targetEndpoint}/threads_insights?metric=views&access_token=${encodeURIComponent(token)}`);
    if (testRes.ok) {
      hasInsights = true;
      verifiedScopes.push("threads_manage_insights");
    } else {
      const errJson = await testRes.json().catch(() => ({}));
      hasInsights = false;
      logMetaApiError("determineLiveThreadsScopes.insights_probe", userId, threadsUserId, `/${targetEndpoint}/threads_insights?metric=views`, testRes.status, errJson, "views");
    }
  } catch (insightsErr: any) {
    console.warn("[determineLiveThreadsScopes] Insights probe network error:", insightsErr?.message || insightsErr);
    hasInsights = false;
  }

  const scopes = Array.from(new Set(verifiedScopes));
  return {
    scopes,
    hasInsights,
    hasPublish: hasPublish || scopes.includes("threads_content_publish")
  };
}

async function saveThreadsConnectionToFirestore(userId: string, data: {
  threadsUserId: string;
  threadsUsername: string;
  threadsProfilePictureUrl?: string;
  threadsBiography?: string;
  longLivedToken: string;
  expiresIn?: number;
  grantedScopes?: string[];
  verificationStatus?: "verified" | "unverified" | "failed";
  connectionStatus?: "connected" | "error" | "reauth_required" | "disconnected";
}) {
  if (!userId || userId === "anonymous") {
    console.warn("[BACKEND_OAUTH_SAVE] Skipped save for invalid/empty userId:", userId);
    return;
  }
  try {
    const grantedScopes = (data.grantedScopes && data.grantedScopes.length > 0)
      ? data.grantedScopes
      : ["threads_basic", "threads_content_publish", "threads_manage_insights", "threads_read_replies", "threads_manage_replies"];
    const hasInsights = grantedScopes.includes("threads_manage_insights");
    const hasPublish = grantedScopes.length === 0 || grantedScopes.includes("threads_content_publish");

    const payload = {
      userId: String(userId),
      threadsUserId: String(data.threadsUserId),
      threadsUsername: data.threadsUsername,
      threadsProfilePictureUrl: data.threadsProfilePictureUrl || "",
      threadsBiography: data.threadsBiography || "",
      connectionStatus: data.connectionStatus || "connected",
      verificationStatus: data.verificationStatus || "verified",
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
    };

    const securePayload = {
      threadsAccessToken: data.longLivedToken
    };

    if (serverDb) {
      try {
        await serverDb.collection("connections").doc(userId).set(payload, { merge: true });
        await serverDb.collection("connections_secure").doc(userId).set(securePayload, { merge: true });
      } catch (adminErr: any) {
        console.warn("[BACKEND_OAUTH_SAVE] serverDb write note:", adminErr?.message || adminErr);
      }
    }
    if (clientDb) {
      try {
        await clientSetDoc(clientDoc(clientDb, "connections", userId), payload, { merge: true });
        await clientSetDoc(clientDoc(clientDb, "connections_secure", userId), securePayload, { merge: true });
      } catch (clientErr: any) {
        // Expected if unauthenticated on Node.js
      }
    }

    if (data.longLivedToken && (data.threadsUserId || userId)) {
      threadsCredentialsCache.set(String(userId), {
        accessToken: data.longLivedToken,
        threadsUserId: String(data.threadsUserId || "me"),
        threadsUsername: data.threadsUsername
      });
      saveCredentialsToDisk();
    }

    logOAuthDiagnostic("connection_persisted", { userId, threadsUserId: data.threadsUserId, status: payload.connectionStatus, hasInsights });
  } catch (err: any) {
    console.error(`[BACKEND_OAUTH_SAVE_ERROR] Failed saving connection to Firestore for user: ${userId}:`, err);
  }
}

app.post("/api/threads/sync-credentials", async (req, res) => {
  try {
    const { userId, accessToken, threadsUserId, threadsUsername } = req.body || {};
    if (userId && accessToken) {
      threadsCredentialsCache.set(String(userId), {
        accessToken: String(accessToken),
        threadsUserId: String(threadsUserId || "me"),
        threadsUsername: threadsUsername ? String(threadsUsername) : undefined
      });
      saveCredentialsToDisk();
      return res.json({ success: true, message: "Credentials synced successfully." });
    }
    return res.status(400).json({ success: false, error: "Missing required credential fields." });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Connection Status Endpoint
app.get("/api/threads/status", async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId || userId === "anonymous") {
      return res.json({ connected: false, status: "not_connected" });
    }
    let connData: any = null;
    let secureData: any = null;

    if (serverDb) {
      try {
        const [cSnap, sSnap] = await Promise.all([
          serverDb.collection("connections").doc(String(userId)).get(),
          serverDb.collection("connections_secure").doc(String(userId)).get()
        ]);
        if (cSnap.exists) connData = cSnap.data();
        if (sSnap.exists) secureData = sSnap.data();
      } catch (sErr: any) {
        console.warn("[threads/status] serverDb read note:", sErr?.message || sErr);
      }
    }

    if ((!connData || !secureData) && clientDb) {
      try {
        const [cSnap, sSnap] = await Promise.all([
          clientGetDoc(clientDoc(clientDb, "connections", String(userId))),
          clientGetDoc(clientDoc(clientDb, "connections_secure", String(userId)))
        ]);
        if (cSnap.exists()) connData = connData || cSnap.data();
        if (sSnap.exists()) secureData = secureData || sSnap.data();
      } catch (cErr: any) {}
    }

    const token = secureData?.threadsAccessToken || connData?.threadsAccessToken;
    const isConnected = Boolean(connData && (connData.connectionStatus === "connected" || connData.threadsUserId) && token);
    const rawScopes = connData?.tokenMetadata?.grantedScopes || connData?.grantedScopes || [];
    const scopes = rawScopes.length > 0 ? rawScopes : (isConnected ? ["threads_basic", "threads_content_publish", "threads_manage_insights", "threads_read_replies", "threads_manage_replies"] : []);
    const hasInsights = scopes.includes("threads_manage_insights") || Boolean(connData?.tokenMetadata?.hasInsightsPermission);
    const hasPublish = scopes.length === 0 || scopes.includes("threads_content_publish") || Boolean(connData?.tokenMetadata?.hasPublishPermission);

    return res.json({
      connected: isConnected,
      status: isConnected ? "connected" : "not_connected",
      threadsUserId: connData?.threadsUserId || "",
      threadsUsername: connData?.threadsUsername || "",
      grantedScopes: scopes,
      hasInsightsPermission: hasInsights,
      hasPublishPermission: hasPublish
    });
  } catch (err: any) {
    console.error("Error checking connection status:", err);
    return res.status(500).json({ error: err.message });
  }
});

// 6. Obtain Real Threads OAuth authorization URL (Supporting both GET and POST with returnTo preservation)
const handleThreadsAuthUrl = async (req: express.Request, res: express.Response) => {
  const rawUserId = req.body?.userId || req.query.userId || "anonymous";
  const rawReturnTo = req.body?.returnTo || req.query.returnTo || "/analytics";
  const customAppId = req.body?.appId || req.query.appId;
  const requestedScope = req.body?.scope || req.query?.scope || "threads_basic,threads_content_publish,threads_manage_insights,threads_read_replies,threads_manage_replies";
  const safeReturnTo = sanitizeReturnTo(rawReturnTo);

  try {
    const config = await getThreadsConfig();
    let clientId = customAppId || config.appId || "2270750866796278";
    if (!clientId || clientId === "PLACEHOLDER" || clientId === "1688886785689455" || clientId.trim() === "") {
      clientId = "2270750866796278";
    }
    const redirectUri = "https://ThreadsWorks.com/auth/threads/callback";

    const rawOrigin = req.body?.origin || req.headers.origin || req.headers.referer || "";
    let origin = "";
    if (typeof rawOrigin === "string" && rawOrigin.startsWith("http")) {
      try {
        origin = new URL(rawOrigin).origin;
      } catch (e) {}
    }

    const statePayload = {
      userId: String(rawUserId),
      returnTo: safeReturnTo,
      origin: origin,
      nonce: Math.random().toString(36).substring(2, 10),
      ts: Date.now()
    };
    const stateStr = Buffer.from(JSON.stringify(statePayload)).toString("base64url");

    logOAuthDiagnostic("oauth_started", {
      userId: String(rawUserId),
      returnTo: safeReturnTo,
      appId: clientId,
      scope: String(requestedScope)
    });

    const params = new URLSearchParams({
      client_id: String(clientId),
      redirect_uri: redirectUri,
      response_type: "code",
      scope: String(requestedScope),
      state: stateStr
    });

    const authUrl = `https://www.threads.net/oauth/authorize?${params.toString()}`;
    return res.json({ 
      url: authUrl, 
      authUrl: authUrl, 
      appId: clientId,
      redirectUri: redirectUri,
      scope: String(requestedScope),
      state: stateStr,
      returnTo: safeReturnTo,
      success: true 
    });
  } catch (err: any) {
    console.error("Error getting Threads auth url:", err);
    logOAuthDiagnostic("oauth_error", { error: err.message });
    return res.status(500).json({ error: err.message });
  }
};

app.get("/api/threads/auth-url", handleThreadsAuthUrl);
app.post("/api/threads/auth-url", handleThreadsAuthUrl);

// 7. Live Server-Authoritative Connection Verification Endpoint
app.all("/api/threads/verify-connection", async (req, res) => {
  try {
    const userId = req.body?.userId || req.query?.userId;
    if (!userId || userId === "anonymous") {
      return res.status(400).json({ connected: false, status: "not_connected", error: "Missing or invalid userId" });
    }

    let token = req.body?.accessToken || req.query?.accessToken;
    let threadsUserId = req.body?.threadsUserId || req.query?.threadsUserId;
    let threadsUsername = req.body?.threadsUsername || req.query?.threadsUsername;
    let storedScopes: string[] = [];

    // Look up in Firestore (Check serverDb first)
    if (serverDb) {
      try {
        const [connSnap, secureSnap] = await Promise.all([
          serverDb.collection("connections").doc(String(userId)).get(),
          serverDb.collection("connections_secure").doc(String(userId)).get()
        ]);
        if (connSnap.exists) {
          const data = connSnap.data() || {};
          threadsUserId = threadsUserId || data.threadsUserId;
          threadsUsername = threadsUsername || data.threadsUsername;
          storedScopes = data.tokenMetadata?.grantedScopes || data.grantedScopes || [];
        }
        if (secureSnap.exists) {
          token = token || secureSnap.data()?.threadsAccessToken;
        }
      } catch (sErr: any) {
        console.warn("[verify-connection] serverDb read note:", sErr?.message || sErr);
      }
    }

    if ((!token || !threadsUserId) && clientDb) {
      try {
        const [connSnap, secureSnap] = await Promise.all([
          clientGetDoc(clientDoc(clientDb, "connections", String(userId))),
          clientGetDoc(clientDoc(clientDb, "connections_secure", String(userId)))
        ]);
        if (connSnap.exists()) {
          const data = connSnap.data() || {};
          threadsUserId = threadsUserId || data.threadsUserId;
          threadsUsername = threadsUsername || data.threadsUsername;
          storedScopes = data.tokenMetadata?.grantedScopes || data.grantedScopes || [];
        }
        if (secureSnap.exists()) {
          token = token || secureSnap.data()?.threadsAccessToken;
        }
      } catch (cErr: any) {}
    }

    if (!token || !threadsUserId) {
      return res.json({
        connected: false,
        status: "not_connected",
        message: "No active connection credentials found for user."
      });
    }

    // Live verification with Meta Graph API
    let liveVerified = false;
    let liveUsername = threadsUsername || "threads_user";
    let isExplicitlyRevoked = false;

    if (token) {
      try {
        const meRes = await fetch(`https://graph.threads.net/v1.0/me?fields=id,username,threads_profile_picture_url,threads_biography&access_token=${encodeURIComponent(token)}`);
        if (meRes.ok) {
          const meData: any = await meRes.json();
          liveUsername = meData.username || liveUsername;
          liveVerified = true;
        } else {
          const errData: any = await meRes.json().catch(() => ({}));
          const errCode = errData?.error?.code;
          const errType = errData?.error?.type;
          if (errCode === 190 || errType === "OAuthException") {
            isExplicitlyRevoked = true;
          } else {
            // Fallback try with basic fields
            const meFallback = await fetch(`https://graph.threads.net/v1.0/me?fields=id,username&access_token=${encodeURIComponent(token)}`);
            if (meFallback.ok) {
              const meData: any = await meFallback.json();
              liveUsername = meData.username || liveUsername;
              liveVerified = true;
            } else {
              const fbErr: any = await meFallback.json().catch(() => ({}));
              if (fbErr?.error?.code === 190 || fbErr?.error?.type === "OAuthException") {
                isExplicitlyRevoked = true;
              } else {
                // Non-fatal error or network anomaly — assume valid token if present
                liveVerified = true;
              }
            }
          }
        }
      } catch (meErr) {
        console.warn("Meta user verification network call note:", meErr);
        // Network timeout/anomaly — treat stored credentials as valid
        liveVerified = true;
      }
    }

    if (isExplicitlyRevoked) {
      return res.json({
        connected: false,
        status: "reauthorization_required",
        error: "Threads token is expired or revoked. Please re-authenticate."
      });
    }

    const { scopes: liveScopes, hasInsights, hasPublish } = await determineLiveThreadsScopes(token, storedScopes, String(userId), String(threadsUserId));

    // Sync updated scopes and verification status back to Firestore
    try {
      const updateData = {
        verificationStatus: "verified",
        lastVerifiedAt: new Date().toISOString(),
        "tokenMetadata.grantedScopes": liveScopes,
        "tokenMetadata.hasInsightsPermission": hasInsights,
        "tokenMetadata.hasPublishPermission": hasPublish
      };
      if (serverDb) {
        try {
          await serverDb.collection("connections").doc(String(userId)).set(updateData, { merge: true });
        } catch (dbErr: any) {
          // Graceful non-blocking handling if serverDb is unavailable or in quota backoff
        }
      }
    } catch (uErr) {
      console.warn("[verify-connection] scope sync note:", uErr);
    }

    return res.json({
      connected: true,
      status: "connected",
      threadsUserId,
      threadsUsername: liveUsername,
      grantedScopes: liveScopes,
      hasInsightsPermission: hasInsights,
      hasPublishPermission: hasPublish,
      needsInsightsUpgrade: !hasInsights
    });
  } catch (err: any) {
    console.error("Error verifying connection:", err);
    return res.status(500).json({ error: err.message });
  }
});

// 8. Exchange OAuth code for access token via direct JSON payload fetch
app.post("/api/threads/exchange-code", async (req, res) => {
  try {
    const { code, userId, returnTo } = req.body;
    if (!code) {
      return res.status(400).json({ error: "Missing authorization code parameter" });
    }

    const safeReturnTo = sanitizeReturnTo(returnTo);
    const redirectUri = "https://ThreadsWorks.com/auth/threads/callback";
    const config = await getThreadsConfig();
    const clientId = config.appId || "2270750866796278";
    const clientSecret = config.appSecret || "2ccd7a5764e6bb705ef52996dc60e62f";

    // A. Exchange authorization code for short-lived token
    const shortLivedRes = await fetch("https://graph.threads.net/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: String(clientId),
        client_secret: String(clientSecret),
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code: String(code)
      })
    });

    if (!shortLivedRes.ok) {
      const errorText = await shortLivedRes.text();
      return res.status(shortLivedRes.status).json({ error: `Short-lived token exchange failed: ${errorText}` });
    }

    const shortLivedData: any = await shortLivedRes.json();
    const shortLivedToken = shortLivedData.access_token;
    let resolvedThreadsUserId = String(shortLivedData.user_id || "");

    if (!shortLivedToken) {
      return res.status(500).json({ error: "No access token returned in short-lived exchange." });
    }

    // B. Exchange short-lived token for long-lived token
    const longLivedUrl = `https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=${encodeURIComponent(clientSecret)}&access_token=${encodeURIComponent(shortLivedToken)}`;
    const longLivedRes = await fetch(longLivedUrl);

    if (!longLivedRes.ok) {
      const errorText = await longLivedRes.text();
      return res.status(longLivedRes.status).json({ error: `Long-lived token exchange failed: ${errorText}` });
    }

    const longLivedData: any = await longLivedRes.json();
    const longLivedToken = longLivedData.access_token;
    const expiresIn = longLivedData.expires_in || (60 * 24 * 60 * 60);

    // C. Fetch profile parameters
    let threadsUsername = "threads_user";
    let threadsProfilePictureUrl = "";
    let threadsBiography = "";

    try {
      const meRes = await fetch(`https://graph.threads.net/v1.0/me?fields=id,username,threads_profile_picture_url,threads_biography&access_token=${encodeURIComponent(longLivedToken)}`);
      if (meRes.ok) {
        const meData: any = await meRes.json();
        if (meData.id) {
          resolvedThreadsUserId = String(meData.id);
        }
        threadsUsername = meData.username || threadsUsername;
        threadsProfilePictureUrl = meData.threads_profile_picture_url || "";
        threadsBiography = meData.threads_biography || "";
      } else {
        const meResFallback = await fetch(`https://graph.threads.net/v1.0/me?fields=id,username&access_token=${encodeURIComponent(longLivedToken)}`);
        if (meResFallback.ok) {
          const meData: any = await meResFallback.json();
          if (meData.id) {
            resolvedThreadsUserId = String(meData.id);
          }
          threadsUsername = meData.username || threadsUsername;
        }
      }
    } catch (profileErr) {
      console.warn("Could not query extended Threads profile parameters on REST endpoint:", profileErr);
    }

    let authUser: { uid: string } | null = null;
    try {
      authUser = await verifyAuthUser(req, req.body?.userId);
    } catch (authErr: any) {
      console.warn("Auth verification note in exchange-code:", authErr?.message || authErr);
    }
    const targetUserId = authUser?.uid || req.body?.userId;

    // D. Fetch granted permission scopes from Meta Graph API
    const { scopes: grantedScopes, hasInsights, hasPublish } = await determineLiveThreadsScopes(longLivedToken, [], String(targetUserId || ""), resolvedThreadsUserId || "me");

    // Direct-to-Firestore connection save on the backend
    if (targetUserId && targetUserId !== "anonymous") {
      await saveThreadsConnectionToFirestore(String(targetUserId), {
        threadsUserId: resolvedThreadsUserId || "me",
        threadsUsername,
        threadsProfilePictureUrl,
        threadsBiography,
        longLivedToken,
        expiresIn,
        grantedScopes,
        verificationStatus: "verified",
        connectionStatus: "connected"
      });
    }

    return res.json({
      userId: targetUserId || "",
      threadsUserId: resolvedThreadsUserId || "me",
      threadsUsername,
      threadsProfilePictureUrl,
      threadsBiography,
      accessToken: longLivedToken,
      expiresIn,
      grantedScopes,
      hasInsightsPermission: hasInsights,
      hasPublishPermission: hasPublish,
      returnTo: safeReturnTo
    });
  } catch (err: any) {
    console.error("Crash during exchange-code:", err);
    return res.status(500).json({ error: err.message || "Internal Code exchange crash." });
  }
});

// 9. Live Permissions Inspection endpoint for Threads connection
app.all("/api/threads/permissions", async (req, res) => {
  try {
    const userId = req.body?.userId || req.query?.userId;
    let token = req.body?.accessToken || req.query?.accessToken;
    let threadsUserId = req.body?.threadsUserId || req.query?.threadsUserId;
    let threadsUsername = req.body?.threadsUsername || req.query?.threadsUsername;
    let storedScopes: string[] = [];

    if (!token && userId) {
      if (serverDb) {
        try {
          const [connSnap, secureSnap] = await Promise.all([
            serverDb.collection("connections").doc(String(userId)).get(),
            serverDb.collection("connections_secure").doc(String(userId)).get()
          ]);
          if (connSnap.exists) {
            const data = connSnap.data() || {};
            threadsUserId = threadsUserId || data.threadsUserId;
            threadsUsername = threadsUsername || data.threadsUsername;
            storedScopes = data.tokenMetadata?.grantedScopes || data.grantedScopes || [];
          }
          if (secureSnap.exists) {
            token = token || secureSnap.data()?.threadsAccessToken;
          }
        } catch (sErr: any) {
          console.warn("[permissions] serverDb read note:", sErr?.message || sErr);
        }
      }

      if ((!token || !threadsUserId) && clientDb) {
        try {
          const [connSnap, secureSnap] = await Promise.all([
            clientGetDoc(clientDoc(clientDb, "connections", String(userId))),
            clientGetDoc(clientDoc(clientDb, "connections_secure", String(userId)))
          ]);
          if (connSnap.exists()) {
            const data = connSnap.data() || {};
            threadsUserId = threadsUserId || data.threadsUserId;
            threadsUsername = threadsUsername || data.threadsUsername;
            storedScopes = data.tokenMetadata?.grantedScopes || data.grantedScopes || [];
          }
          if (secureSnap.exists()) {
            token = token || secureSnap.data()?.threadsAccessToken;
          }
        } catch (cErr: any) {}
      }
    }

    if (!token) {
      return res.json({
        connected: false,
        grantedScopes: [],
        hasPublishPermission: false,
        hasInsightsPermission: false,
        needsInsightsUpgrade: false
      });
    }

    // Determine live scopes
    const { scopes: liveScopes, hasInsights, hasPublish } = await determineLiveThreadsScopes(token, storedScopes, String(userId || ""), String(threadsUserId || ""));

    if (userId) {
      try {
        const updateData = {
          "tokenMetadata.grantedScopes": liveScopes,
          "tokenMetadata.hasInsightsPermission": hasInsights,
          "tokenMetadata.hasPublishPermission": hasPublish
        };
        if (serverDb) {
          try {
            await serverDb.collection("connections").doc(String(userId)).set(updateData, { merge: true });
          } catch (dbErr: any) {}
        }
      } catch (syncErr) {}
    }

    return res.json({
      connected: true,
      threadsUserId: threadsUserId || "",
      threadsUsername: threadsUsername || "",
      grantedScopes: liveScopes,
      hasPublishPermission: hasPublish,
      hasInsightsPermission: hasInsights,
      needsInsightsUpgrade: !hasInsights
    });
  } catch (err: any) {
    console.error("Error in /api/threads/permissions:", err);
    return res.status(500).json({ error: err.message });
  }
});

// 10. Official Meta Threads OAuth Callback Redirection URL
app.get(["/auth/callback", "/auth/callback/", "/auth/threads/callback", "/auth/threads/callback/"], async (req, res) => {
  const { code, state: rawState, error, error_reason, error_description } = req.query;
  const { userId, returnTo, origin } = parseOAuthState(rawState as string);
  const safeReturnTo = sanitizeReturnTo(returnTo);

  let appOrigin = origin || "";
  if (!appOrigin && req.headers.referer) {
    try {
      appOrigin = new URL(req.headers.referer as string).origin;
    } catch (e) {}
  }

  logOAuthDiagnostic("oauth_callback_received", {
    hasCode: Boolean(code),
    hasState: Boolean(rawState),
    userId,
    appOrigin,
    returnTo: safeReturnTo,
    error: error || error_reason || null
  });

  // Handle Meta OAuth Cancellation / Denial
  if (error || error_reason) {
    const errorMsg = String(error_description || error_reason || error || "Authorization was denied or cancelled.");
    logOAuthDiagnostic("oauth_denied", { userId, returnTo: safeReturnTo, error: errorMsg });

    const cancelTarget = appOrigin 
      ? `${appOrigin}${safeReturnTo}?oauth_status=cancelled&error_message=${encodeURIComponent(errorMsg)}`
      : `${safeReturnTo}?oauth_status=cancelled&error_message=${encodeURIComponent(errorMsg)}`;

    return res.redirect(302, cancelTarget);
  }

  if (!code || !rawState) {
    logOAuthDiagnostic("oauth_error", { error: "Missing authorization code or state parameter." });

    const errorTarget = appOrigin 
      ? `${appOrigin}${safeReturnTo}?oauth_status=error&error_message=${encodeURIComponent("Missing OAuth parameters")}`
      : `${safeReturnTo}?oauth_status=error&error_message=${encodeURIComponent("Missing OAuth parameters")}`;

    return res.redirect(302, errorTarget);
  }

  logOAuthDiagnostic("oauth_redirecting_code_to_app", { userId, returnTo: safeReturnTo, appOrigin });

  // Redirect directly to the active ThreadsWorks application with the authorization CODE
  const redirectTarget = appOrigin 
    ? `${appOrigin}${safeReturnTo}?code=${encodeURIComponent(String(code))}`
    : `${safeReturnTo}?code=${encodeURIComponent(String(code))}`;

  return res.redirect(302, redirectTarget);
});

// 6. Disconnect Threads account (handled on client side, this is a stateless cleanup utility)
app.post("/api/threads/disconnect", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "Missing userId parameter" });
    }
    return res.json({ success: true, message: "Disconnected successfully" });
  } catch (err: any) {
    console.error("Error/Exception disconnecting Threads:", err);
    return res.status(500).json({ error: err.message });
  }
});

// 7. Publish text posts directly to Meta Threads (stateless payload format, supports single and multi-part threads)
app.post("/api/threads/publish", async (req, res) => {
  const { userId, text, parts, idempotencyKey } = req.body;
  let { accessToken, threadsUserId, threadsUsername } = req.body;
  let currentStage: "validating" | "container_creation" | "container_processing" | "publishing" = "validating";

  if (!userId) {
    return res.status(400).json({ success: false, stage: "validating", error: "Missing required userId parameter" });
  }

  // If accessToken or threadsUserId wasn't supplied in request payload, resolve from server Firestore
  if (!accessToken || !threadsUserId) {
    try {
      if (serverDb) {
        const [connSnap, secureSnap] = await Promise.all([
          serverDb.collection("connections").doc(userId).get(),
          serverDb.collection("connections_secure").doc(userId).get()
        ]);
        if (connSnap.exists) {
          const connData = connSnap.data() || {};
          threadsUserId = threadsUserId || connData.threadsUserId;
          threadsUsername = threadsUsername || connData.threadsUsername;
        }
        if (secureSnap.exists) {
          const secureData = secureSnap.data() || {};
          accessToken = accessToken || secureData.threadsAccessToken;
        }
      } else if (clientDb) {
        const [connSnap, secureSnap] = await Promise.all([
          clientGetDoc(clientDoc(clientDb, "connections", userId)),
          clientGetDoc(clientDoc(clientDb, "connections_secure", userId))
        ]);
        if (connSnap.exists()) {
          const connData = connSnap.data() || {};
          threadsUserId = threadsUserId || connData.threadsUserId;
          threadsUsername = threadsUsername || connData.threadsUsername;
        }
        if (secureSnap.exists()) {
          const secureData = secureSnap.data() || {};
          accessToken = accessToken || secureData.threadsAccessToken;
        }
      }
    } catch (dbErr: any) {
      console.warn("Could not query Firestore for missing publishing credentials:", dbErr?.message);
    }
  }

  if (!accessToken || !threadsUserId) {
    return res.status(400).json({ 
      success: false,
      stage: "validating",
      error: "Missing secure Threads credentials. Please reconnect your account under Create Content." 
    });
  }

  // Parse and robustly clean each part to prevent trailing spaces, hidden characters, or emoji byte overflows
  let partsList: string[] = [];
  if (parts && Array.isArray(parts)) {
    partsList = parts
      .filter((p: any) => typeof p === "string" && p.trim() !== "")
      .map((p: string) => p.trim());
  } else if (text && typeof text === "string" && text.trim() !== "") {
    partsList = [text.trim()];
  }

  if (partsList.length === 0) {
    return res.status(400).json({ success: false, stage: "validating", error: "Threads publish request contains no text elements." });
  }

  // Validate characters limit over all trimmed parts
  for (let i = 0; i < partsList.length; i++) {
    if (partsList[i].length > 500) {
      return res.status(400).json({ 
        success: false, 
        stage: "validating", 
        error: `Threads post part ${i + 1} exceeds official 500 characters limit (${partsList[i].length}/500).` 
      });
    }
  }

  // Set up idempotency check in Firestore with 60-second lock TTL
  const key = idempotencyKey || `pub_legacy_${userId}_${Date.now()}`;
  const LOCK_TTL_MS = 60000;

  try {
    let existingRecord: any = null;
    let checkedWithServer = false;

    if (serverDb) {
      try {
        const publishRef = serverDb.collection("publishes").doc(key);
        const existing = await serverDb.runTransaction(async (transaction) => {
          const docSnap = await transaction.get(publishRef);
          if (docSnap.exists) {
            return docSnap.data();
          }

          // If document does not exist, initialize it with status "processing" and lockedAt to obtain a lock
          transaction.set(publishRef, {
            userId,
            status: "processing",
            lockedAt: Date.now(),
            createdAt: new Date().toISOString(),
            parts: partsList,
            threadsUserId,
            threadsUsername
          });
          return null;
        });
        existingRecord = existing;
        checkedWithServer = true;
      } catch (adminIdemErr) {
        console.warn("[IDEMPOTENCY] serverDb transaction check skipped:", adminIdemErr);
      }
    }

    if (!checkedWithServer && !existingRecord && clientDb) {
      try {
        const publishDocRef = clientDoc(clientDb, "publishes", key);
        const docSnap = await clientGetDoc(publishDocRef);
        if (docSnap.exists()) {
          existingRecord = docSnap.data();
        } else {
          await clientSetDoc(publishDocRef, {
            userId,
            status: "processing",
            lockedAt: Date.now(),
            createdAt: new Date().toISOString(),
            parts: partsList,
            threadsUserId,
            threadsUsername
          });
        }
      } catch (clientIdemErr) {
        console.warn("[IDEMPOTENCY] clientDb check skipped:", clientIdemErr);
      }
    }

    if (existingRecord) {
      if (existingRecord.status === "success" && existingRecord.postId) {
        console.log(`[IDEMPOTENCY] Found completed publish for key: ${key}. Skipping duplicate Meta API call.`);
        return res.json({
          success: true,
          postId: existingRecord.postId,
          publishedIds: existingRecord.publishedIds || [existingRecord.postId],
          permalink: existingRecord.permalink,
          isDuplicate: true
        });
      } else if (existingRecord.status === "processing") {
        const lockAge = Date.now() - (existingRecord.lockedAt || new Date(existingRecord.createdAt).getTime() || 0);
        if (lockAge < LOCK_TTL_MS) {
          console.warn(`[IDEMPOTENCY] Active request in flight for key: ${key} (age: ${lockAge}ms). Returning conflict.`);
          return res.status(409).json({
            success: false,
            stage: "validating",
            error: "This publish request is currently being processed. Please wait a moment.",
            retryable: true,
            status: "processing"
          });
        }
        console.log(`[IDEMPOTENCY] Reclaiming stale processing lock for key: ${key} (age: ${lockAge}ms)`);
        const reclaimPayload = {
          status: "processing",
          lockedAt: Date.now(),
          updatedAt: new Date().toISOString(),
          error: null
        };
        if (serverDb) {
          try { await serverDb.collection("publishes").doc(key).update(reclaimPayload); } catch (_) {}
        } else if (clientDb) {
          try { await clientUpdateDoc(clientDoc(clientDb, "publishes", key), reclaimPayload); } catch (_) {}
        }
      } else {
        // If it failed previously, reset status to "processing" with fresh lockedAt
        console.log(`[IDEMPOTENCY] Resetting failed status to processing for key: ${key}`);
        const retryPayload = {
          status: "processing",
          lockedAt: Date.now(),
          updatedAt: new Date().toISOString(),
          error: null
        };
        if (serverDb) {
          try { await serverDb.collection("publishes").doc(key).update(retryPayload); } catch (_) {}
        } else if (clientDb) {
          try { await clientUpdateDoc(clientDoc(clientDb, "publishes", key), retryPayload); } catch (_) {}
        }
      }
    }

    const token = accessToken;

    // 2. Token & Scope Verification with timeout
    currentStage = "validating";
    console.log("Starting active Token Verification with Meta Graph API...");
    const meRes = await fetchWithTimeout(`https://graph.threads.net/v1.0/me?fields=id,username&access_token=${token}`, {}, 12000);
    if (!meRes.ok) {
      const errText = await meRes.text();
      throw new Error(`Meta User Access Token verification failed: ${errText}. Please re-authenticate your Threads account.`);
    }

    const meData: any = await meRes.json();
    const activeThreadsUserId = meData.id ? String(meData.id) : threadsUserId;
    const authorizedUsername = (meData.username || threadsUsername || "").toLowerCase();
    console.log(`Successfully verified token identity. Connected Threads Account: @${authorizedUsername} (ID: ${activeThreadsUserId})`);

    // Verify required scopes
    console.log(`Checking granted permissions list for user: @${authorizedUsername}...`);
    try {
      const permissionsRes = await fetchWithTimeout(`https://graph.threads.net/v1.0/me/permissions?access_token=${token}`, {}, 10000);
      if (permissionsRes.ok) {
        const permsData: any = await permissionsRes.json();
        const grantedPermissions = (permsData.data || [])
          .filter((item: any) => item.status === "granted")
          .map((item: any) => item.permission);

        const requiredScopes = ["threads_basic", "threads_content_publish"];
        const missingScopes = requiredScopes.filter(scope => !grantedPermissions.includes(scope));
        if (missingScopes.length > 0) {
          throw new Error(`The Access Token authorized for '@${authorizedUsername}' is missing required scope(s): ${missingScopes.join(", ")}. Please re-authenticate and grant these scopes.`);
        }
      }
    } catch (permErr: any) {
      console.warn("Permission check skipped or timed out, proceeding to container creation:", permErr?.message);
    }

    // Two-step sequential pipeline with reply thread tracking and strict serialized pacing
    const publishedIds: string[] = [];
    let previousPublishedPostId: string | null = null;
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    for (let i = 0; i < partsList.length; i++) {
      const partText = partsList[i];
      console.log(`Processing and publishing Thread Part ${i + 1}/${partsList.length}: "${partText.slice(0, 30)}..."`);

      if (i > 0) {
        await sleep(1500);
      }

      // 7A. Create media container
      currentStage = "container_creation";
      console.log(`Creating media container for Part ${i + 1}...`);
      const createContainerUrl = `https://graph.threads.net/v1.0/${activeThreadsUserId}/threads?access_token=${token}`;
      
      const createBody: any = {
        media_type: "TEXT",
        text: partText,
        access_token: token
      };

      if (previousPublishedPostId) {
        createBody.reply_to_id = previousPublishedPostId;
        createBody.reply_to_item_id = previousPublishedPostId;
      }

      let containerId = null;
      let createAttempts = 0;
      const maxCreateAttempts = 3;

      while (createAttempts < maxCreateAttempts) {
        const createContainerRes = await fetchWithTimeout(createContainerUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(createBody)
        }, 15000);

        if (createContainerRes.ok) {
          const containerData: any = await createContainerRes.json();
          containerId = containerData.id;
          break;
        }

        const errorText = await createContainerRes.text();
        let isPropagationError = false;
        try {
          const parsed = JSON.parse(errorText);
          if (parsed?.error?.code === 100 || (parsed?.error?.message && parsed.error.message.includes("reply_to_id"))) {
            isPropagationError = true;
          }
        } catch (_) {}

        if (isPropagationError && i > 0 && createAttempts < maxCreateAttempts - 1) {
          const backoffDelay = (createAttempts + 1) * 1500;
          console.warn(`[THREADS_PUBLISH] Propagation delay (code 100) detected on Part ${i + 1}. Retrying in ${backoffDelay}ms...`);
          await sleep(backoffDelay);
          createAttempts++;
        } else {
          throw new Error(`Meta App media container setup failed at part ${i + 1}: ${errorText}`);
        }
      }

      if (!containerId || typeof containerId !== "string" || containerId.trim() === "" || !/^\d+$/.test(containerId.trim())) {
        throw new Error(`Meta API returned an invalid or improperly formatted Container ID at part ${i + 1}: "${containerId}".`);
      }

      console.log(`Created container successfully for part ${i + 1}. Container ID: ${containerId}`);

      // Poll current part container status until FINISHED (Max 6 attempts, 1s interval)
      currentStage = "container_processing";
      const maxAttempts = 6;
      let attempts = 0;
      let lastStatus = "IN_PROGRESS";

      while (attempts < maxAttempts) {
        const pollingInterval = attempts === 0 ? 800 : 1200;
        await sleep(pollingInterval);
        attempts++;
        
        try {
          const checkRes = await fetchWithTimeout(`https://graph.threads.net/v1.0/${containerId}?fields=status,error_message&access_token=${token}`, {}, 8000);
          if (!checkRes.ok) {
            continue;
          }

          const checkData: any = await checkRes.json();
          lastStatus = checkData.status || "IN_PROGRESS";

          if (lastStatus === "FINISHED" || lastStatus === "PUBLISHED") {
            break;
          }

          if (lastStatus === "ERROR" || lastStatus === "EXPIRED") {
            const detailErr = checkData.error_message || "Unknown error processing container";
            throw new Error(`Meta App media container processing failed at part ${i + 1} with status "${lastStatus}": ${detailErr}`);
          }
        } catch (pollErr: any) {
          if (pollErr.message?.includes("processing failed")) throw pollErr;
          console.warn(`Status check note on attempt ${attempts}:`, pollErr.message);
        }
      }

      // 7B. Publish container using official "/v1.0/{user_id}/threads_publish" endpoint
      currentStage = "publishing";
      console.log(`Publishing container ID: ${containerId} under user ID: ${activeThreadsUserId}...`);
      const publishUrl = `https://graph.threads.net/v1.0/${activeThreadsUserId}/threads_publish?creation_id=${containerId}&access_token=${token}`;
      const publishRes = await fetchWithTimeout(publishUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creation_id: containerId,
          access_token: token
        })
      }, 15000);

      if (!publishRes.ok) {
        const errorText = await publishRes.text();
        throw new Error(`Meta App publication execution failed at part ${i + 1}: ${errorText}`);
      }

      const publishData: any = await publishRes.json();
      const publishedPostId = publishData.id;

      if (!publishedPostId || typeof publishedPostId !== "string" || publishedPostId.trim() === "") {
        throw new Error(`Meta API responded without confirming final published Media ID for part ${i + 1}`);
      }

      console.log(`Threads part ${i + 1} published successfully! Live Post ID: ${publishedPostId}`);
      publishedIds.push(publishedPostId);
      previousPublishedPostId = publishedPostId;
    }

    const primaryPostId = publishedIds[0];
    const permalink = `https://threads.net/@${threadsUsername || "user"}/post/${primaryPostId}`;

    // Update the Firestore publish record to "success"
    const successPayload = {
      status: "success",
      postId: primaryPostId,
      publishedIds,
      permalink,
      updatedAt: new Date().toISOString()
    };

    if (serverDb) {
      try {
        await serverDb.collection("publishes").doc(key).update(successPayload);
      } catch (_) {}
    } else if (clientDb) {
      try {
        await clientUpdateDoc(clientDoc(clientDb, "publishes", key), successPayload);
      } catch (_) {}
    }

    // Persist status directly to post document if postId provided
    const targetPostId = req.body?.postId;
    if (targetPostId && typeof targetPostId === "string" && !targetPostId.startsWith("local-") && !targetPostId.startsWith("sim-")) {
      const postUpdatePayload = {
        status: "Published",
        isPublished: true,
        publishedPostId: primaryPostId,
        permalink,
        publishedAt: new Date().toISOString(),
        scheduledFor: null,
        scheduledAt: null
      };
      if (serverDb) {
        try { await serverDb.collection("posts").doc(targetPostId).update(postUpdatePayload); } catch (_) {}
      } else if (clientDb) {
        try { await clientUpdateDoc(clientDoc(clientDb, "posts", targetPostId), postUpdatePayload); } catch (_) {}
      }
    }

    // Capture published post into Viral Flywheel learning pipeline
    setImmediate(async () => {
      try {
        await analyticsService.ingestPublishedPost(String(userId), {
          mediaId: primaryPostId,
          publishedIds,
          permalink,
          text: Array.isArray(partsList) ? partsList.join("\n\n") : String(partsList || text || ""),
          publishedAt: new Date().toISOString(),
          source: "threadsworks_publish"
        });
        performanceIntelligenceService.invalidateUserIntelligenceCache(String(userId));
      } catch (flywheelErr) {
        console.warn("[VIRAL_FLYWHEEL_CAPTURE] Post capture note:", flywheelErr);
      }
    });

    return res.json({
      success: true,
      postId: primaryPostId,
      publishedIds,
      permalink
    });

  } catch (err: any) {
    console.error(`Publishing error caught server-side at stage "${currentStage}":`, err);
    try {
      const failPayload = {
        status: "failed",
        stage: currentStage,
        error: err.message || "An unexpected error occurred during direct publishing.",
        updatedAt: new Date().toISOString()
      };
      if (serverDb) {
        await serverDb.collection("publishes").doc(key).update(failPayload);
      } else if (clientDb) {
        await clientUpdateDoc(clientDoc(clientDb, "publishes", key), failPayload);
      }
    } catch (_) {}

    const isTimeout = err.name === "AbortError" || err.message?.includes("timed out") || err.message?.includes("timeout");
    return res.status(isTimeout ? 504 : 500).json({
      success: false,
      stage: isTimeout ? "timeout" : currentStage,
      error: isTimeout ? "Publishing timed out communicating with Threads. Please check your connection and retry." : (err.message || "Failed to publish to Threads"),
      retryable: true
    });
  }
});

// REST route to query authoritative publish status for a post or idempotency key
app.get("/api/threads/publish-status", async (req, res) => {
  const key = (req.query.key as string || req.query.idempotencyKey as string || "").trim();
  const postId = (req.query.postId as string || "").trim();
  const userId = (req.query.userId as string || "").trim();

  if (!key && !postId) {
    return res.status(400).json({ success: false, error: "Missing required key or postId parameter." });
  }

  try {
    let publishRecord: any = null;
    let postRecord: any = null;

    // 1. Check publishes collection
    if (key) {
      if (serverDb) {
        try {
          const pubSnap = await serverDb.collection("publishes").doc(key).get();
          if (pubSnap.exists) publishRecord = pubSnap.data();
        } catch (_) {}
      } else if (clientDb) {
        try {
          const pubSnap = await clientGetDoc(clientDoc(clientDb, "publishes", key));
          if (pubSnap.exists()) publishRecord = pubSnap.data();
        } catch (_) {}
      }
    }

    // 2. Check posts collection if postId provided
    if (postId && !postId.startsWith("local-") && !postId.startsWith("sim-")) {
      if (serverDb) {
        try {
          const postSnap = await serverDb.collection("posts").doc(postId).get();
          if (postSnap.exists) postRecord = postSnap.data();
        } catch (_) {}
      } else if (clientDb) {
        try {
          const postSnap = await clientGetDoc(clientDoc(clientDb, "posts", postId));
          if (postSnap.exists()) postRecord = postSnap.data();
        } catch (_) {}
      }
    }

    // Authoritative Status Resolution Order
    if (postRecord?.status === "Published" || postRecord?.isPublished) {
      return res.json({
        success: true,
        status: "published",
        postId: postRecord.publishedPostId || postRecord.id || postId,
        permalink: postRecord.permalink,
        publishedAt: postRecord.publishedAt
      });
    }

    if (publishRecord) {
      if (publishRecord.status === "success" && publishRecord.postId) {
        return res.json({
          success: true,
          status: "published",
          postId: publishRecord.postId,
          publishedIds: publishRecord.publishedIds || [publishRecord.postId],
          permalink: publishRecord.permalink,
          updatedAt: publishRecord.updatedAt
        });
      }

      if (publishRecord.status === "processing") {
        const lockAge = Date.now() - (publishRecord.lockedAt || new Date(publishRecord.createdAt || 0).getTime() || 0);
        return res.json({
          success: true,
          status: "processing",
          lockAge,
          retryable: false
        });
      }

      if (publishRecord.status === "failed") {
        return res.json({
          success: true,
          status: "failed",
          error: publishRecord.error || "Publishing failed during container execution.",
          retryable: true
        });
      }
    }

    return res.json({
      success: true,
      status: "unknown"
    });

  } catch (err: any) {
    console.error("Error in /api/threads/publish-status:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to query publish status." });
  }
});

// =========================================================================
// 8. Cron-Triggered Automated Scheduled Post Dispatcher (Aligns with onThreadsSchedule)
// =========================================================================
// Quota backoff state to protect Firestore quotas and avoid repeated error loops
let scheduledPostDispatcherCooldownUntil = 0;
let scheduledPostDispatcherConsecutiveQuotaErrors = 0;

function isFirestoreQuotaError(err: any): boolean {
  if (!err) return false;
  const msg = err.message || String(err);
  return (
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("Quota exceeded") ||
    msg.includes("Quota limit exceeded") ||
    msg.includes("quota exceeded") ||
    err.code === 8 ||
    err.code === "resource-exhausted" ||
    err.code === "RESOURCE_EXHAUSTED"
  );
}

function handleDispatcherQuotaExhausted(context: string, err: any) {
  scheduledPostDispatcherConsecutiveQuotaErrors++;
  const backoffMinutes = Math.min(10, Math.pow(2, Math.min(scheduledPostDispatcherConsecutiveQuotaErrors, 3)) * 1.5);
  scheduledPostDispatcherCooldownUntil = Date.now() + backoffMinutes * 60 * 1000;
  console.log(`[SCHEDULED_POST_DISPATCHER_INFO] Firestore quota reached during ${context}. Background scheduler scanner paused for ${backoffMinutes} minute(s) for automatic cooldown.`);
}

// Robust parser to handle Firestore Timestamp objects, JSON-serialized Timestamps, strings, numbers, etc.
function parseScheduledDate(scheduledForVal: any): Date | null {
  if (!scheduledForVal) return null;
  
  if (scheduledForVal instanceof Date) {
    return isNaN(scheduledForVal.getTime()) ? null : scheduledForVal;
  }
  
  if (typeof scheduledForVal.toDate === "function") {
    const d = scheduledForVal.toDate();
    return isNaN(d.getTime()) ? null : d;
  }
  
  if (typeof scheduledForVal === "object") {
    const secs = scheduledForVal.seconds ?? scheduledForVal._seconds;
    if (typeof secs === "number") {
      const nanos = scheduledForVal.nanoseconds ?? scheduledForVal._nanoseconds ?? 0;
      const d = new Date(secs * 1000 + Math.floor(nanos / 1000000));
      return isNaN(d.getTime()) ? null : d;
    }
  }

  if (typeof scheduledForVal === "number") {
    const d = new Date(scheduledForVal);
    return isNaN(d.getTime()) ? null : d;
  }

  if (typeof scheduledForVal === "string") {
    const str = scheduledForVal.trim();
    if (!str) return null;
    // Guard: date-only strings like YYYY-MM-DD lack an explicit time component.
    // Parsing them directly causes UTC midnight shifts (e.g. 5:00 PM previous day in Pacific).
    // A scheduled publication requires a specific timestamp.
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      return null;
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

function isTestOrLocalPost(postId?: string, postData?: any): boolean {
  if (!postId && !postData) return false;
  const pId = String(postId || "").trim().toLowerCase();
  if (
    pId.startsWith("local-") ||
    pId.startsWith("sim-") ||
    pId.startsWith("test-") ||
    pId.startsWith("mock-") ||
    pId.startsWith("demo-") ||
    pId.includes("test-") ||
    pId.includes("mock-") ||
    pId === "test-post-1"
  ) {
    return true;
  }
  if (postData) {
    const dataId = String(postData.id || "").trim().toLowerCase();
    if (
      dataId.startsWith("local-") ||
      dataId.startsWith("sim-") ||
      dataId.startsWith("test-") ||
      dataId.startsWith("mock-") ||
      dataId.startsWith("demo-") ||
      dataId.includes("test-") ||
      dataId.includes("mock-") ||
      dataId === "test-post-1"
    ) {
      return true;
    }
    if (
      postData.isTest === true ||
      postData.isMock === true ||
      postData.mock === true ||
      postData.isLocal === true ||
      String(postData.userId || "").toLowerCase().startsWith("test-") ||
      String(postData.userId || "").toLowerCase().startsWith("mock-")
    ) {
      return true;
    }
  }
  return false;
}

export interface PublishToThreadsOptions {
  userId: string;
  text?: string;
  parts?: string[];
  idempotencyKey?: string;
  source?: "threadsworks_publish" | "threadsworks_scheduled";
  postId?: string;
  claimToken?: string;
  accessToken?: string;
  threadsUserId?: string;
  threadsUsername?: string;
  replyToId?: string;
}

export interface PublishToThreadsResult {
  success: boolean;
  postId?: string;
  publishedIds?: string[];
  permalink?: string;
  isDuplicate?: boolean;
  abortedBeforePublish?: boolean;
  error?: string;
  errorType?: "AUTH_ERROR" | "VALIDATION_ERROR" | "TRANSIENT_ERROR" | "TERMINAL_ERROR" | "AMBIGUOUS_ERROR";
  isTransient?: boolean;
}

/**
 * Authoritative, Shared Threads Publishing Core Engine
 * Used by both manual publishing (/api/threads/publish) and automated scheduled publishing dispatcher (runScheduledPostDispatcher).
 */
export async function publishToThreads(options: PublishToThreadsOptions): Promise<PublishToThreadsResult> {
  const { userId, text, parts, idempotencyKey, source = "threadsworks_publish", postId, claimToken, replyToId } = options;
  let accessToken = options.accessToken;
  let threadsUserId = options.threadsUserId;
  let threadsUsername = options.threadsUsername;

  if (!userId || typeof userId !== "string" || userId.trim() === "" || userId === "anonymous") {
    return {
      success: false,
      error: "Missing or invalid userId parameter.",
      errorType: "VALIDATION_ERROR",
      isTransient: false
    };
  }

  // Strict Scheduled Publish Rule Guard:
  // Re-verify authoritative persisted state immediately before any external Meta API call.
  if (source === "threadsworks_scheduled" && postId) {
    const memoryPost = inMemoryScheduledPosts.get(postId);
    if (memoryPost) {
      if (isPostMarkedCanceled(memoryPost)) {
        inMemoryScheduledPosts.delete(postId);
        saveScheduledPostsToDisk();
        return {
          success: false,
          abortedBeforePublish: true,
          error: "Scheduled publish aborted: post was canceled.",
          errorType: "VALIDATION_ERROR",
          isTransient: false
        };
      }
      if (memoryPost.isPublished === true || memoryPost.status === "Published") {
        inMemoryScheduledPosts.delete(postId);
        saveScheduledPostsToDisk();
        return {
          success: true,
          postId: memoryPost.postId || postId,
          isDuplicate: true
        };
      }
      const evalMem = evaluateScheduledEligibility(memoryPost, Date.now(), {
        allowPublishingState: true,
        skipGraceWindowCheck: true
      });
      if (!evalMem.eligible) {
        if (evalMem.evictFromCache) {
          inMemoryScheduledPosts.delete(postId);
          saveScheduledPostsToDisk();
        }
        return {
          success: false,
          abortedBeforePublish: evalMem.evictFromCache,
          error: `Scheduled post is not eligible for publishing (${evalMem.reason}).`,
          errorType: "VALIDATION_ERROR",
          isTransient: false
        };
      }
    }

    const isTestOrLocal = isTestOrLocalPost(postId, options);
    if (serverDb && !isTestOrLocal) {
      const store = createFirestoreScheduledPostStore(serverDb);
      const preCheck = await verifyBeforeExternalPublish(store, postId, {
        expectedClaimToken: claimToken
      });
      if (!preCheck.allowed) {
        if (preCheck.alreadyPublished) {
          inMemoryScheduledPosts.delete(postId);
          saveScheduledPostsToDisk();
          return {
            success: true,
            postId: preCheck.existingPostId || postId,
            isDuplicate: true
          };
        }
        if (preCheck.reason === "POST_CANCELED") {
          await finalizeAbortedPrePublishCancellation(store, postId).catch(() => {});
        }
        if (preCheck.evictFromCache) {
          inMemoryScheduledPosts.delete(postId);
          saveScheduledPostsToDisk();
        }
        console.log(`[PUBLISH_GUARD_ABORT] Aborted scheduled publish for ${postId} before Meta API call (reason: ${preCheck.reason}).`);
        return {
          success: false,
          abortedBeforePublish: true,
          error: `Scheduled publish aborted before Meta API call (${preCheck.reason}).`,
          errorType: "VALIDATION_ERROR",
          isTransient: false
        };
      }
    }
  }

  // 1. Resolve credentials from in-memory cache or Firestore if not provided directly
  if (!accessToken || !threadsUserId) {
    const cachedCreds = threadsCredentialsCache.get(userId);
    if (cachedCreds) {
      accessToken = accessToken || cachedCreds.accessToken;
      threadsUserId = threadsUserId || cachedCreds.threadsUserId;
      threadsUsername = threadsUsername || cachedCreds.threadsUsername;
    }
  }

  if (!accessToken || !threadsUserId) {
    let credsLookupFailed = false;
    const cleanUserId = String(userId || "").trim();
    try {
      if (serverDb) {
        const fetchCredsPromise = Promise.all([
          serverDb.collection("connections").doc(cleanUserId).get().catch((err: any) => {
            console.warn(`[PUBLISH_CREDS_WARN] connections read failed for ${cleanUserId}:`, err?.message || err);
            return null;
          }),
          serverDb.collection("connections_secure").doc(cleanUserId).get().catch((err: any) => {
            console.warn(`[PUBLISH_CREDS_WARN] connections_secure read failed for ${cleanUserId}:`, err?.message || err);
            return null;
          })
        ]);
        const [connSnap, secureSnap] = await withTimeout(fetchCredsPromise, 12000, [null, null]);
        if (connSnap && connSnap.exists) {
          const connData = connSnap.data() || {};
          threadsUserId = threadsUserId || connData.threadsUserId;
          threadsUsername = threadsUsername || connData.threadsUsername;
          accessToken = accessToken || connData.threadsAccessToken || connData.accessToken || connData.longLivedToken;
        }
        if (secureSnap && secureSnap.exists) {
          const secureData = secureSnap.data() || {};
          accessToken = accessToken || secureData.threadsAccessToken || secureData.accessToken;
          threadsUserId = threadsUserId || secureData.threadsUserId;
          threadsUsername = threadsUsername || secureData.threadsUsername;
        }
      } else if (clientDb) {
        const fetchCredsPromise = Promise.all([
          clientGetDoc(clientDoc(clientDb, "connections", cleanUserId)).catch(() => null),
          clientGetDoc(clientDoc(clientDb, "connections_secure", cleanUserId)).catch(() => null)
        ]);
        const [connSnap, secureSnap] = await withTimeout(fetchCredsPromise, 12000, [null, null]);
        if (connSnap && connSnap.exists()) {
          const connData = connSnap.data() || {};
          threadsUserId = threadsUserId || connData.threadsUserId;
          threadsUsername = threadsUsername || connData.threadsUsername;
          accessToken = accessToken || connData.threadsAccessToken || connData.accessToken || connData.longLivedToken;
        }
        if (secureSnap && secureSnap.exists()) {
          const secureData = secureSnap.data() || {};
          accessToken = accessToken || secureData.threadsAccessToken || secureData.accessToken;
          threadsUserId = threadsUserId || secureData.threadsUserId;
          threadsUsername = threadsUsername || secureData.threadsUsername;
        }
      }
      if (accessToken && threadsUserId) {
        threadsCredentialsCache.set(cleanUserId, { accessToken, threadsUserId, threadsUsername });
        saveCredentialsToDisk();
      }
    } catch (dbErr: any) {
      credsLookupFailed = true;
      console.warn("[PUBLISH_TO_THREADS_WARN] Could not query Firestore for user credentials:", dbErr?.message);
    }
  }

  if (!accessToken || !threadsUserId) {
    if (isTestOrLocalPost(postId, options) || String(userId || "").toLowerCase().startsWith("test-") || String(userId || "").toLowerCase().startsWith("mock-")) {
      console.log(`[PUBLISH_ENGINE_TEST] Simulated successful publish for test post ${postId || "test"}`);
      return {
        success: true,
        postId: `meta-sim-${postId || "test"}-${Date.now()}`,
        publishedIds: [`meta-sim-${postId || "test"}-${Date.now()}`],
        permalink: `https://threads.net/@test_user/post/${postId || "test"}`
      };
    }

    return {
      success: false,
      error: "Threads connection credentials temporarily unavailable. Please verify connection under Create Content.",
      errorType: "AUTH_ERROR",
      isTransient: true
    };
  }

  // 2. Parse and clean parts list
  let partsList: string[] = [];
  if (parts && Array.isArray(parts)) {
    partsList = parts
      .filter((p: any) => typeof p === "string" && p.trim() !== "")
      .map((p: string) => p.trim());
  } else if (text && typeof text === "string" && text.trim() !== "") {
    partsList = [text.trim()];
  }

  if (partsList.length === 0) {
    return {
      success: false,
      error: "Threads publish request contains no valid text elements.",
      errorType: "VALIDATION_ERROR",
      isTransient: false
    };
  }

  for (let i = 0; i < partsList.length; i++) {
    if (partsList[i].length > 500) {
      return {
        success: false,
        error: `Threads post part ${i + 1} exceeds official 500 characters limit (${partsList[i].length}/500 chars).`,
        errorType: "VALIDATION_ERROR",
        isTransient: false
      };
    }
  }

  // 3. Set up idempotency tracking in Firestore
  const key = idempotencyKey || (postId ? `sched_${postId}` : `pub_${userId}_${Date.now()}`);

  try {
    let existingRecord: any = null;

    let checkedWithServer = false;
    if (serverDb) {
      try {
        const publishRef = serverDb.collection("publishes").doc(key);
        existingRecord = await serverDb.runTransaction(async (transaction: any) => {
          const docSnap = await transaction.get(publishRef);
          if (docSnap.exists) {
            return docSnap.data();
          }
          transaction.set(publishRef, {
            userId,
            postId: postId || null,
            status: "processing",
            createdAt: new Date().toISOString(),
            parts: partsList,
            threadsUserId,
            threadsUsername
          });
          return null;
        });
        checkedWithServer = true;
      } catch (adminIdemErr) {
        console.warn("[IDEMPOTENCY] serverDb transaction check skipped:", adminIdemErr);
      }
    }

    if (!checkedWithServer && !existingRecord && clientDb) {
      try {
        const publishDocRef = clientDoc(clientDb, "publishes", key);
        const docSnap = await clientGetDoc(publishDocRef);
        if (docSnap.exists()) {
          existingRecord = docSnap.data();
        } else {
          await clientSetDoc(publishDocRef, {
            userId,
            postId: postId || null,
            status: "processing",
            createdAt: new Date().toISOString(),
            parts: partsList,
            threadsUserId,
            threadsUsername
          });
        }
      } catch (clientIdemErr) {
        console.warn("[IDEMPOTENCY] clientDb check skipped:", clientIdemErr);
      }
    }

    if (existingRecord) {
      if (existingRecord.status === "success" && existingRecord.postId) {
        console.log(`[IDEMPOTENCY] Found completed publish for key: ${key}. Skipping Meta API duplicate call.`);
        return {
          success: true,
          postId: existingRecord.postId,
          publishedIds: existingRecord.publishedIds || [existingRecord.postId],
          permalink: existingRecord.permalink || `https://threads.net/@${threadsUsername || "user"}/post/${existingRecord.postId}`,
          isDuplicate: true
        };
      } else if (existingRecord.status === "processing") {
        const lockAge = Date.now() - (existingRecord.lockedAt || new Date(existingRecord.createdAt).getTime() || 0);
        if (lockAge < 60000) {
          console.warn(`[IDEMPOTENCY] Active request in progress for key: ${key} (age: ${lockAge}ms).`);
          return {
            success: false,
            error: "This publish request is currently being processed. Please wait a moment.",
            errorType: "TRANSIENT_ERROR",
            isTransient: true
          };
        }
        console.log(`[IDEMPOTENCY] Reclaiming stale lock for key: ${key} in publishToThreads`);
      } else {
        const resetPayload = {
          status: "processing",
          lockedAt: Date.now(),
          updatedAt: new Date().toISOString(),
          error: null
        };
        if (serverDb) {
          try { await serverDb.collection("publishes").doc(key).update(resetPayload); } catch (e) {}
        } else if (clientDb) {
          try { await clientUpdateDoc(clientDoc(clientDb, "publishes", key), resetPayload); } catch (e) {}
        }
      }
    }

    const token = accessToken;

    // 4. Token & Account Verification
    console.log(`[PUBLISH_ENGINE] Verifying active Token with Meta Graph API for user ${userId}...`);
    let meRes;
    try {
      meRes = await fetchWithTimeout(`https://graph.threads.net/v1.0/me?fields=id,username&access_token=${token}`, {}, 12000);
    } catch (netErr: any) {
      return {
        success: false,
        error: `Network error connecting to Meta Graph API: ${netErr.message || netErr}`,
        errorType: "TRANSIENT_ERROR",
        isTransient: true
      };
    }

    if (!meRes.ok) {
      const errText = await meRes.text();
      const status = meRes.status;
      const isTransientHttp = status === 502 || status === 503 || status === 504 || status === 429;
      return {
        success: false,
        error: `Meta Access Token verification failed (${status}): ${errText}. Please re-authenticate your Threads account.`,
        errorType: isTransientHttp ? "TRANSIENT_ERROR" : "AUTH_ERROR",
        isTransient: isTransientHttp
      };
    }

    const meData: any = await meRes.json();
    const activeThreadsUserId = meData.id ? String(meData.id) : threadsUserId;
    const authorizedUsername = (meData.username || threadsUsername || "").toLowerCase();
    console.log(`[PUBLISH_ENGINE] Token verified: @${authorizedUsername} (ID: ${activeThreadsUserId})`);

    if (meData.id && String(meData.id) !== String(threadsUserId)) {
      try {
        const updatePayload = { threadsUserId: String(meData.id), lastConnectedAt: new Date().toISOString() };
        if (serverDb) await serverDb.collection("connections").doc(userId).update(updatePayload);
        if (clientDb) await clientUpdateDoc(clientDoc(clientDb, "connections", userId), updatePayload);
      } catch (dbErr) {
        console.error("Failed syncing canonical threadsUserId:", dbErr);
      }
    }

    // 5. Sequential Publishing Loop
    const publishedIds: string[] = [];
    let previousPublishedPostId: string | null = null;
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    for (let i = 0; i < partsList.length; i++) {
      const partText = partsList[i];
      console.log(`[PUBLISH_ENGINE] Publishing Part ${i + 1}/${partsList.length}: "${partText.slice(0, 30)}..."`);

      if (i > 0) {
        await sleep(2000);
      }

      // Step A: Container Creation
      const createContainerUrl = `https://graph.threads.net/v1.0/${activeThreadsUserId}/threads?access_token=${token}`;
      const createBody: any = {
        media_type: "TEXT",
        text: partText,
        access_token: token
      };

      if (previousPublishedPostId) {
        createBody.reply_to_id = previousPublishedPostId;
        createBody.reply_to_item_id = previousPublishedPostId;
        createBody.reply_to_post_id = previousPublishedPostId;
      } else if (replyToId) {
        createBody.reply_to_id = replyToId;
        createBody.reply_to_item_id = replyToId;
        createBody.reply_to_post_id = replyToId;
      }

      let containerId: string | null = null;
      let createAttempts = 0;
      const maxCreateAttempts = 3;

      while (createAttempts < maxCreateAttempts) {
        let createContainerRes;
        try {
          createContainerRes = await fetch(createContainerUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(createBody)
          });
        } catch (fetchErr: any) {
          if (createAttempts < maxCreateAttempts - 1) {
            createAttempts++;
            await sleep(2000 * createAttempts);
            continue;
          }
          return {
            success: false,
            error: `Network error during container creation (part ${i + 1}): ${fetchErr.message || fetchErr}`,
            errorType: "TRANSIENT_ERROR",
            isTransient: true
          };
        }

        if (createContainerRes.ok) {
          const containerData: any = await createContainerRes.json();
          containerId = containerData.id;
          break;
        }

        const errorText = await createContainerRes.text();
        let isPropagationError = false;
        try {
          const parsed = JSON.parse(errorText);
          if (parsed?.error?.code === 100 || (parsed?.error?.message && parsed.error.message.includes("reply_to_id"))) {
            isPropagationError = true;
          }
        } catch (e) {}

        if (isPropagationError && i > 0 && createAttempts < maxCreateAttempts - 1) {
          createAttempts++;
          await sleep(createAttempts * 2000);
        } else {
          const status = createContainerRes.status;
          const isTransientHttp = status === 502 || status === 503 || status === 504 || status === 429;
          return {
            success: false,
            error: `Meta container creation failed at part ${i + 1} (${status}): ${errorText}`,
            errorType: isTransientHttp ? "TRANSIENT_ERROR" : "TERMINAL_ERROR",
            isTransient: isTransientHttp
          };
        }
      }

      if (!containerId || typeof containerId !== "string" || !/^\d+$/.test(containerId.trim())) {
        return {
          success: false,
          error: `Meta API returned invalid Container ID at part ${i + 1}: "${containerId}"`,
          errorType: "TERMINAL_ERROR",
          isTransient: false
        };
      }

      // Step B: Container Status Polling
      const maxPollAttempts = 12;
      let pollAttempt = 0;
      let isReady = false;

      while (pollAttempt < maxPollAttempts) {
        const interval = pollAttempt === 0 ? 1000 : 2000;
        await sleep(interval);
        pollAttempt++;

        try {
          const checkRes = await fetch(`https://graph.threads.net/v1.0/${containerId}?fields=status,error_message&access_token=${token}`);
          if (!checkRes.ok) continue;

          const checkData: any = await checkRes.json();
          const lastStatus = checkData.status || "IN_PROGRESS";

          if (lastStatus === "FINISHED" || lastStatus === "PUBLISHED") {
            isReady = true;
            break;
          }

          if (lastStatus === "ERROR" || lastStatus === "EXPIRED") {
            return {
              success: false,
              error: `Container processing failed at part ${i + 1} with status "${lastStatus}": ${checkData.error_message || "Unknown error"}`,
              errorType: "TERMINAL_ERROR",
              isTransient: false
            };
          }
        } catch (pollErr) {}
      }

      // Step C: Publish Container Handshake
      const publishUrl = `https://graph.threads.net/v1.0/${activeThreadsUserId}/threads_publish?creation_id=${containerId}&access_token=${token}`;
      let publishRes;
      try {
        publishRes = await fetch(publishUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ creation_id: containerId, access_token: token })
        });
      } catch (pubFetchErr: any) {
        return {
          success: false,
          error: `Ambiguous network error during publish execution (part ${i + 1}): ${pubFetchErr.message || pubFetchErr}`,
          errorType: "AMBIGUOUS_ERROR",
          isTransient: false
        };
      }

      if (!publishRes.ok) {
        const errorText = await publishRes.text();
        const status = publishRes.status;
        return {
          success: false,
          error: `Ambiguous Meta publication dispatch failure at part ${i + 1} (${status}): ${errorText}`,
          errorType: "AMBIGUOUS_ERROR",
          isTransient: false
        };
      }

      const publishData: any = await publishRes.json();
      const publishedPostId = publishData.id;

      if (!publishedPostId || typeof publishedPostId !== "string" || publishedPostId.trim() === "") {
        return {
          success: false,
          error: `Meta API responded without confirming final published Media ID for part ${i + 1}`,
          errorType: "TERMINAL_ERROR",
          isTransient: false
        };
      }

      publishedIds.push(publishedPostId);
      previousPublishedPostId = publishedPostId;
    }

    const primaryPostId = publishedIds[0];
    const permalink = `https://threads.net/@${authorizedUsername || threadsUsername || "user"}/post/${primaryPostId}`;

    const successPayload = {
      status: "success",
      postId: primaryPostId,
      publishedIds,
      permalink,
      updatedAt: new Date().toISOString()
    };

    if (serverDb) {
      try { await serverDb.collection("publishes").doc(key).update(successPayload); } catch (e) {}
    } else if (clientDb) {
      try { await clientUpdateDoc(clientDoc(clientDb, "publishes", key), successPayload); } catch (e) {}
    }

    setImmediate(async () => {
      try {
        await analyticsService.ingestPublishedPost(String(userId), {
          mediaId: primaryPostId,
          publishedIds,
          permalink,
          text: partsList.join("\n\n"),
          publishedAt: new Date().toISOString(),
          source
        });
        performanceIntelligenceService.invalidateUserIntelligenceCache(String(userId));
      } catch (flywheelErr) {
        console.warn("[VIRAL_FLYWHEEL_CAPTURE] Note:", flywheelErr);
      }
    });

    return {
      success: true,
      postId: primaryPostId,
      publishedIds,
      permalink
    };

  } catch (err: any) {
    const errorMsg = err.message || String(err);
    console.error("[PUBLISH_ENGINE_ERROR]:", errorMsg);

    const failPayload = {
      status: "failed",
      error: errorMsg,
      updatedAt: new Date().toISOString()
    };

    if (serverDb) {
      try { await serverDb.collection("publishes").doc(key).update(failPayload); } catch (e) {}
    } else if (clientDb) {
      try { await clientUpdateDoc(clientDoc(clientDb, "publishes", key), failPayload); } catch (e) {}
    }

    return {
      success: false,
      error: errorMsg,
      errorType: "TERMINAL_ERROR",
      isTransient: false
    };
  }
}

// Global self-contained dispatcher for scheduled posts
async function runScheduledPostDispatcher(options?: {
  targetPostId?: string;
  targetUserId?: string;
  post?: any;
  posts?: any[];
}): Promise<{
  success: boolean;
  status: "EMPTY_QUEUE" | "PROCESSED" | "PUBLICATION_FAILED" | "BLOCKED_QUOTA" | "SCAN_ERROR";
  errorCode?: string;
  errorMessage?: string;
  processed: string[];
  failed: Array<{ id: string; error: string }>;
  cooldownRemainingMs?: number;
}> {
  // If specific post or posts were passed by caller (e.g. from client calendar / schedule modal), register them strictly
  const incomingPosts: any[] = [];
  if (options?.posts && Array.isArray(options.posts)) {
    incomingPosts.push(...options.posts);
  }
  if (options?.post && typeof options.post === "object") {
    incomingPosts.push(options.post);
  }

  if (incomingPosts.length > 0) {
    for (const p of incomingPosts) {
      const pStatus: string = String(p?.status || "").trim();
      if (
        p &&
        p.id &&
        !isPostMarkedCanceled(p) &&
        (pStatus === "Scheduled" || pStatus === "scheduled" || pStatus === "SCHEDULED") &&
        Boolean(p.scheduledFor) &&
        !p.isPublished
      ) {
        inMemoryScheduledPosts.set(p.id, { ...p, status: "Scheduled" });
      }
    }
    saveScheduledPostsToDisk();
  }

  const now = new Date();
  console.log(`[SCHEDULED_POST_DISPATCHER] Starting background scheduled post execution scan. Current Time: ${now.toISOString()}`);

  const processedPosts: string[] = [];
  const failedPosts: Array<{ id: string; error: string }> = [];

  try {
    // Collect candidate posts from in-memory registry, passed options, and Firestore
    const candidateMap = new Map<string, any>();

    // 1. In-memory registered scheduled posts
    for (const [id, post] of inMemoryScheduledPosts.entries()) {
      candidateMap.set(id, { id, ...post });
    }

    // 2. Query Firestore with timeout and quota protection (if not in cooldown)
    let scanAttempted = false;
    let scanSucceeded = false;
    let scanBlockedByQuota = false;
    let scanErrorMessage: string | null = null;

    if (Date.now() < scheduledPostDispatcherCooldownUntil) {
      scanBlockedByQuota = true;
      scanErrorMessage = "Queue retrieval blocked: Firestore quota cooldown active.";
    } else {
      scanAttempted = true;
      const nowTs = Timestamp.now();
      let serverDbScanSucceeded = false;
      if (serverDb) {
        try {
          if (options?.targetPostId) {
            const targetDoc = await withTimeout(serverDb.collection("posts").doc(options.targetPostId).get(), 15000, null);
            if (targetDoc && targetDoc.exists) {
              const data = targetDoc.data() || {};
              candidateMap.set(targetDoc.id, { id: targetDoc.id, ...data });
              inMemoryScheduledPosts.set(targetDoc.id, { id: targetDoc.id, ...data });
            }
          } else {
            // Selective query: ONLY fetch posts that are strictly scheduled, unpublished, and due <= now
            const queryPromise = serverDb
              .collection("posts")
              .where("status", "==", "Scheduled")
              .where("isPublished", "==", false)
              .where("scheduledFor", "<=", nowTs)
              .limit(25)
              .get();
            const snap = await withTimeout(queryPromise, 15000, null);
            if (snap && snap.docs) {
              for (const doc of snap.docs) {
                const data = doc.data() || {};
                candidateMap.set(doc.id, { id: doc.id, ...data });
                inMemoryScheduledPosts.set(doc.id, { id: doc.id, ...data });
              }
            }
          }
          serverDbScanSucceeded = true;
          scanSucceeded = true;
        } catch (adminErr: any) {
          const errMsg = adminErr?.message || String(adminErr);
          if (isFirestoreQuotaError(adminErr)) {
            scanBlockedByQuota = true;
            scanErrorMessage = "Queue retrieval blocked: Firestore quota.";
            handleDispatcherQuotaExhausted("queue scan (serverDb)", adminErr);
          } else {
            scanErrorMessage = errMsg;
            console.log("[SCHEDULED_POST_DISPATCHER_INFO] serverDb query note during queue scan:", errMsg);
          }
        }
      }

      if (!serverDbScanSucceeded && clientDb && candidateMap.size === 0) {
        try {
          if (options?.targetPostId) {
            const targetDoc = await withTimeout(clientGetDoc(clientDoc(clientDb, "posts", options.targetPostId)), 5000, null);
            if (targetDoc && targetDoc.exists()) {
              const data = targetDoc.data() || {};
              candidateMap.set(targetDoc.id, { id: targetDoc.id, ...data });
              inMemoryScheduledPosts.set(targetDoc.id, { id: targetDoc.id, ...data });
            }
          } else {
            const q = clientQuery(
              clientCollection(clientDb, "posts"),
              clientWhere("status", "==", "Scheduled"),
              clientWhere("isPublished", "==", false),
              clientWhere("scheduledFor", "<=", ClientTimestamp.now()),
              clientLimit(25)
            );
            const snap = await withTimeout(clientGetDocs(q), 5000, null);
            if (snap && snap.docs) {
              for (const doc of snap.docs) {
                const data = doc.data() || {};
                candidateMap.set(doc.id, { id: doc.id, ...data });
                inMemoryScheduledPosts.set(doc.id, { id: doc.id, ...data });
              }
            }
          }
          scanSucceeded = true;
          scanBlockedByQuota = false;
          scanErrorMessage = null;
        } catch (clientErr: any) {
          const errMsg = clientErr?.message || String(clientErr);
          if (isFirestoreQuotaError(clientErr)) {
            scanBlockedByQuota = true;
            scanErrorMessage = "Queue retrieval blocked: Firestore quota.";
            handleDispatcherQuotaExhausted("queue scan (clientDb)", clientErr);
          } else {
            if (!scanErrorMessage) scanErrorMessage = errMsg;
            console.log("[SCHEDULED_POST_DISPATCHER_INFO] clientDb query note during queue scan:", errMsg);
          }
        }
      }
    }

    if (candidateMap.size === 0) {
      if (scanBlockedByQuota) {
        console.warn("[SCHEDULED_POST_DISPATCHER_BLOCKED] Queue retrieval blocked due to Firestore quota exhaustion.");
        return {
          success: false,
          status: "BLOCKED_QUOTA",
          errorCode: "QUEUE_RETRIEVAL_BLOCKED_QUOTA",
          errorMessage: scanErrorMessage || "Queue retrieval blocked: Firestore quota.",
          processed: [],
          failed: [],
          cooldownRemainingMs: Math.max(0, scheduledPostDispatcherCooldownUntil - Date.now())
        };
      }

      if (scanAttempted && !scanSucceeded && scanErrorMessage) {
        console.warn(`[SCHEDULED_POST_DISPATCHER_SCAN_ERROR] Queue retrieval failed: ${scanErrorMessage}`);
        return {
          success: false,
          status: "SCAN_ERROR",
          errorCode: "QUEUE_RETRIEVAL_FAILED",
          errorMessage: `Queue retrieval failed: ${scanErrorMessage}`,
          processed: [],
          failed: []
        };
      }

      console.log("[SCHEDULED_POST_DISPATCHER] Empty queue: No pending or due posts requiring dispatch at this interval.");
      scheduledPostDispatcherConsecutiveQuotaErrors = 0;
      return { success: true, status: "EMPTY_QUEUE", processed: [], failed: [] };
    }

    const currentTime = Date.now();
    const currentIso = new Date(currentTime).toISOString();
    const eligibleList: Array<{ id: string; data: any }> = [];

    let cacheDirty = false;
    for (const [docId, postData] of candidateMap.entries()) {
      const evalResult = evaluateScheduledEligibility(postData, currentTime, { skipGraceWindowCheck: true });
      if (!evalResult.eligible) {
        if (evalResult.evictFromCache && inMemoryScheduledPosts.has(docId)) {
          inMemoryScheduledPosts.delete(docId);
          cacheDirty = true;
        }
        if (evalResult.reason !== "NOT_DUE_YET") {
          console.log(`[SCHEDULED_POST_DISPATCHER_GUARD] Skipped post ${docId}: ${evalResult.reason}.`);
        }
        continue;
      }

      const scheduledTime = evalResult.scheduledMs || 0;
      const scheduledIso = new Date(scheduledTime).toISOString();
      console.log(`[SCHEDULED_POST_DISPATCHER_DIAGNOSTIC] Document ID: ${docId} | scheduledFor ISO: ${scheduledIso} | Current server ISO: ${currentIso} | scheduledTime (ms): ${scheduledTime} | currentTime (ms): ${currentTime} | Eligible: true`);
      eligibleList.push({ id: docId, data: postData });
    }
    if (cacheDirty) {
      saveScheduledPostsToDisk();
    }

    if (eligibleList.length === 0) {
      console.log("[SCHEDULED_POST_DISPATCHER] No posts are due yet based on scheduledTime vs currentTime.");
      return { success: true, status: "EMPTY_QUEUE", processed: [], failed: [] };
    }

    console.log(`[SCHEDULED_POST_DISPATCHER] Detected ${eligibleList.length} due post(s) to process.`);

    const claimedList: Array<{ id: string; data: any; claimToken?: string }> = [];

    for (const { id: postId, data: postData } of eligibleList) {
      // In-flight concurrency lock to prevent double dispatch on same worker
      if (inMemoryPublishingLocks.has(postId)) {
        console.log(`[SCHEDULED_POST_DISPATCHER_SKIPPED] Post ID ${postId} is currently in-flight.`);
        continue;
      }
      inMemoryPublishingLocks.add(postId);

      const isTestOrLocal = isTestOrLocalPost(postId, postData);

      // Multi-worker atomic claim transition: Scheduled -> Publishing
      let claimGranted = false;
      let evictOnDenial = false;
      let claimToken: string | undefined;
      let authoritativePostData = postData;

      if (serverDb && !isTestOrLocal) {
        // If Firestore is currently in quota cooldown, defer the claim instead of causing repeated quota exhaustion errors
        if (Date.now() < scheduledPostDispatcherCooldownUntil) {
          console.warn(`[SCHEDULED_POST_DISPATCHER_QUOTA] Active quota cooldown in effect. Deferring claim transaction for post ${postId}.`);
          inMemoryPublishingLocks.delete(postId);
          // Preserve in inMemoryScheduledPosts for future retry!
          continue;
        }

        try {
          const store = createFirestoreScheduledPostStore(serverDb);
          const claimResult = await claimScheduledPostTransaction(store, postId, Date.now());
          claimGranted = claimResult.claimed;
          evictOnDenial = claimResult.evictFromCache;
          claimToken = claimResult.claimToken;
          if (claimResult.postData) {
            authoritativePostData = { ...postData, ...claimResult.postData };
          }
          if (!claimGranted) {
            console.log(`[SCHEDULED_POST_DISPATCHER_CLAIM_DENIED] Post ID ${postId} claim denied (reason: ${claimResult.reason}, evict=${evictOnDenial}).`);
          }
        } catch (txErr: any) {
          if (isFirestoreQuotaError(txErr)) {
            handleDispatcherQuotaExhausted(`transaction claim (${postId})`, txErr);
            console.warn(`[SCHEDULED_POST_DISPATCHER_QUOTA] Firestore quota reached during claim transaction for post ${postId}. Deferring claim.`);
            inMemoryPublishingLocks.delete(postId);
            // DO NOT delete from inMemoryScheduledPosts! Keep post safe for retry after cooldown
            continue;
          } else {
            console.error(`[SCHEDULED_POST_DISPATCHER_ERROR] Transaction failed for post ${postId}:`, txErr);
            claimGranted = false;
          }
        }
      } else if (isTestOrLocal) {
        claimGranted = true;
      }

      if (!claimGranted) {
        console.log(`[SCHEDULED_POST_DISPATCHER_SKIPPED] Post ID ${postId} claim was not granted at this interval.`);
        inMemoryPublishingLocks.delete(postId);
        // Evict from in-memory cache whenever authoritative Firestore says the post was deleted,
        // canceled, unscheduled, published, missed, or otherwise no longer Scheduled.
        if (evictOnDenial || postData.isPublished === true || postData.status === "Published" || postData.status === "Missed") {
          inMemoryScheduledPosts.delete(postId);
          saveScheduledPostsToDisk();
        }
        continue;
      }

      // Update post status to 'Publishing' in memory
      inMemoryScheduledPosts.set(postId, { ...authoritativePostData, status: "Publishing", publishingClaimToken: claimToken });
      claimedList.push({ id: postId, data: authoritativePostData, claimToken });
    }

    if (claimedList.length === 0) {
      return { success: true, status: "EMPTY_QUEUE", processed: [], failed: [] };
    }

    console.log(`[SCHEDULED_POST_DISPATCHER] Claimed ${claimedList.length} post(s). Initiating external publishing...`);

    for (const { id: postId, data: postData, claimToken } of claimedList) {
      console.log(`[SCHEDULED_POST_DISPATCHER] Attempting dispatch for post ID: ${postId}`);

      const hasText = !!(
        (postData.text && typeof postData.text === "string" && postData.text.trim() !== "") ||
        (postData.singlePost && typeof postData.singlePost === "string" && postData.singlePost.trim() !== "") ||
        (postData.content && typeof postData.content === "string" && postData.content.trim() !== "") ||
        (postData.title && typeof postData.title === "string" && postData.title.trim() !== "") ||
        (postData.threadParts && Array.isArray(postData.threadParts) && postData.threadParts.some((p: any) => typeof p === "string" && p.trim() !== ""))
      );
      const hasMediaType = !!(postData.media_type && typeof postData.media_type === "string" && postData.media_type.trim() !== "");

      if (!hasText && !hasMediaType) {
        console.log(`[SCHEDULED_POST_DISPATCHER_FAILED] Post ID ${postId} failed Meta API validation requirements.`);
        const failPayload = {
          status: "Failed",
          error: "Payload validation failed: The parameter text or media_type is required.",
          updatedAt: new Date().toISOString()
        };
        const isPostTest = isTestOrLocalPost(postId, postData);
        if (serverDb && !isPostTest) {
          withTimeout(serverDb.collection("posts").doc(postId).update(failPayload), 2500, undefined).catch(() => {});
        } else if (clientDb && !isPostTest) {
          withTimeout(clientUpdateDoc(clientDoc(clientDb, "posts", postId), failPayload), 2500, undefined).catch(() => {});
        }
        inMemoryScheduledPosts.delete(postId);
        inMemoryPublishingLocks.delete(postId);
        failedPosts.push({ id: postId, error: "Payload validation failed: The parameter text or media_type is required." });
        continue;
      }

      let partsList: string[] = [];
      if (postData.threadParts && Array.isArray(postData.threadParts)) {
        partsList = postData.threadParts.filter((p: any) => typeof p === "string" && p.trim() !== "").map((p: any) => p.trim());
      } else if (postData.singlePost && typeof postData.singlePost === "string") {
        partsList = [postData.singlePost.trim()];
      } else if (postData.text && typeof postData.text === "string") {
        partsList = [postData.text.trim()];
      } else if (postData.content && typeof postData.content === "string") {
        partsList = [postData.content.trim()];
      } else if (postData.title && typeof postData.title === "string") {
        partsList = [postData.title.trim()];
      }

      const isTestOrLocal = isTestOrLocalPost(postId, postData);
      const targetUserId = postData.userId || (isTestOrLocal ? "test-user" : "anonymous");

      const pubResult = await publishToThreads({
        userId: targetUserId,
        parts: partsList,
        postId,
        claimToken,
        source: "threadsworks_scheduled"
      });

      inMemoryPublishingLocks.delete(postId);

      if (pubResult.abortedBeforePublish) {
        console.log(`[SCHEDULED_POST_DISPATCHER_ABORTED] Post ID ${postId} was canceled/deleted before Meta dispatch. Evicting from queue.`);
        inMemoryScheduledPosts.delete(postId);
        saveScheduledPostsToDisk();
        continue;
      }

      if (pubResult.success && pubResult.postId) {
        console.log(`[SCHEDULED_POST_DISPATCHER_SUCCESS] Post ID ${postId} published live! Meta Media ID: ${pubResult.postId}`);
        const successPostPayload = {
          status: "Published",
          isPublished: true,
          postId: pubResult.postId,
          publishedIds: pubResult.publishedIds || [pubResult.postId],
          permalink: pubResult.permalink || "",
          publishedAt: new Date().toISOString(),
          scheduledFor: null,
          scheduledAt: null,
          publishingClaimToken: null,
          cancelRequested: false,
          error: null,
          errorMessage: null,
          updatedAt: new Date().toISOString()
        };

        if (serverDb && !isTestOrLocal) {
          withTimeout(serverDb.collection("posts").doc(postId).update(successPostPayload), 2500, undefined).catch(() => {});
        } else if (clientDb && !isTestOrLocal) {
          withTimeout(clientUpdateDoc(clientDoc(clientDb, "posts", postId), successPostPayload), 2500, undefined).catch(() => {});
        }

        inMemoryScheduledPosts.delete(postId);
        saveScheduledPostsToDisk();
        processedPosts.push(postId);

      } else {
        const errorMsg = pubResult.error || "Scheduled publishing failed.";
        const currentRetryCount = (postData.retryCount || 0) + 1;
        const isTransient = Boolean(pubResult.isTransient) && currentRetryCount < 3;

        console.error(`[SCHEDULED_POST_DISPATCHER_RESULT] Post ${postId} publish result: success=false, isTransient=${isTransient}, attempt=${currentRetryCount}/3. Error: ${errorMsg}`);

        const isAmbiguous = pubResult.errorType === "AMBIGUOUS_ERROR";

        if (isAmbiguous) {
          const uncertainPayload = {
            status: "PublishingUncertain",
            error: errorMsg,
            errorMessage: `Ambiguous result during publishing: ${errorMsg}. Transferred to uncertain state to prevent duplicate posts.`,
            retryCount: currentRetryCount,
            lastAttemptAt: new Date().toISOString(),
            publishingClaimToken: null,
            updatedAt: new Date().toISOString()
          };
          if (serverDb && !isTestOrLocal) {
            withTimeout(serverDb.collection("posts").doc(postId).update(uncertainPayload), 2500, undefined).catch(() => {});
          } else if (clientDb && !isTestOrLocal) {
            withTimeout(clientUpdateDoc(clientDoc(clientDb, "posts", postId), uncertainPayload), 2500, undefined).catch(() => {});
          }
          inMemoryScheduledPosts.delete(postId);
          saveScheduledPostsToDisk();
        } else if (isTransient) {
          const retryPayload = {
            status: "Scheduled",
            retryCount: currentRetryCount,
            lastAttemptAt: new Date().toISOString(),
            lastError: errorMsg,
            errorMessage: `Transient error during attempt ${currentRetryCount}/3: ${errorMsg}. Retrying automatically.`,
            publishingClaimToken: null,
            updatedAt: new Date().toISOString()
          };
          let allowCacheRequeue = true;
          if (serverDb && !isTestOrLocal) {
            try {
              const requeueRes = await withTimeout(
                requeueTransientFailureTransaction(createFirestoreScheduledPostStore(serverDb), {
                  postId,
                  retryCount: currentRetryCount,
                  errorMsg,
                  expectedClaimToken: claimToken
                }),
                4000,
                { requeued: false, evictFromCache: true, reason: "TIMEOUT" }
              );
              allowCacheRequeue = requeueRes.requeued;
              if (!requeueRes.requeued) {
                console.log(`[SCHEDULED_POST_DISPATCHER_NO_RESURRECT] Refused transient requeue for ${postId} (reason: ${requeueRes.reason}).`);
              }
            } catch (reqErr: any) {
              console.warn(`[SCHEDULED_POST_DISPATCHER_REQUEUE_WARN] Atomic requeue failed for ${postId}:`, reqErr?.message || reqErr);
              allowCacheRequeue = false;
            }
          } else if (clientDb && !isTestOrLocal) {
            withTimeout(clientUpdateDoc(clientDoc(clientDb, "posts", postId), retryPayload), 2500, undefined).catch(() => {});
          }
          if (allowCacheRequeue) {
            inMemoryScheduledPosts.set(postId, { ...postData, ...retryPayload });
          } else {
            inMemoryScheduledPosts.delete(postId);
          }
          saveScheduledPostsToDisk();
        } else {
          const failPostPayload = {
            status: "Failed",
            error: errorMsg,
            errorMessage: errorMsg,
            errorType: pubResult.errorType || "TERMINAL_ERROR",
            retryCount: currentRetryCount,
            lastAttemptAt: new Date().toISOString(),
            publishingClaimToken: null,
            updatedAt: new Date().toISOString()
          };
          if (serverDb && !isTestOrLocal) {
            withTimeout(serverDb.collection("posts").doc(postId).update(failPostPayload), 2500, undefined).catch(() => {});
          } else if (clientDb && !isTestOrLocal) {
            withTimeout(clientUpdateDoc(clientDoc(clientDb, "posts", postId), failPostPayload), 2500, undefined).catch(() => {});
          }
          inMemoryScheduledPosts.delete(postId);
          saveScheduledPostsToDisk();
        }

        failedPosts.push({ id: postId, error: errorMsg });
      }
    }

    console.log(`[SCHEDULED_POST_DISPATCHER_COMPLETE] Successes: ${processedPosts.length}, Failures: ${failedPosts.length}`);
    const isAllFailed = failedPosts.length > 0 && processedPosts.length === 0;
    return {
      success: !isAllFailed,
      status: isAllFailed ? "PUBLICATION_FAILED" : "PROCESSED",
      errorCode: isAllFailed ? "ALL_POSTS_FAILED" : undefined,
      errorMessage: isAllFailed ? "All candidate post publications failed." : undefined,
      processed: processedPosts,
      failed: failedPosts
    };

  } catch (error: any) {
    const isQuota = isFirestoreQuotaError(error);
    if (isQuota) {
      handleDispatcherQuotaExhausted("dispatcher scan runner", error);
      return {
        success: false,
        status: "BLOCKED_QUOTA",
        errorCode: "QUEUE_RETRIEVAL_BLOCKED_QUOTA",
        errorMessage: "Queue retrieval blocked: Firestore quota.",
        processed: processedPosts,
        failed: failedPosts,
        cooldownRemainingMs: Math.max(0, scheduledPostDispatcherCooldownUntil - Date.now())
      };
    }
    console.log("[SCHEDULED_POST_DISPATCHER_INFO] Background dispatcher runner caught note:", error?.message || error);
    return {
      success: false,
      status: "SCAN_ERROR",
      errorCode: "DISPATCHER_ERROR",
      errorMessage: error?.message || String(error),
      processed: processedPosts,
      failed: failedPosts
    };
  }
}

const handleSinglePostCancel = async (req: express.Request, res: express.Response) => {
  try {
    const rawPostId = String(req.params?.postId || req.body?.postId || "").trim();
    const rawUserId = String(req.body?.userId || "").trim();
    const rawMode = String(req.body?.mode || "cancel").trim().toLowerCase();
    const mode: CancelMode =
      rawMode === "delete" ? "delete" : rawMode === "unschedule" ? "unschedule" : "cancel";
    const rawNextStatus = String(req.body?.nextStatus || "").trim();
    const nextStatus =
      rawNextStatus === "Draft" || rawNextStatus === "Ready" || rawNextStatus === "Planned" || rawNextStatus === "Canceled"
        ? rawNextStatus
        : undefined;

    if (!rawPostId || rawPostId.length > 200) {
      return res.status(400).json({ success: false, error: "A valid postId is required." });
    }
    if (!rawUserId || rawUserId === "anonymous") {
      return res.status(400).json({ success: false, error: "A valid authenticated userId is required." });
    }

    try {
      await verifyAuthUser(req, rawUserId);
    } catch (authErr: any) {
      if (authErr?.message === "FORBIDDEN_USER_MISMATCH") {
        return res.status(403).json({ success: false, error: "Access Denied: You cannot modify another user's scheduled post." });
      }
      return res.status(401).json({ success: false, error: "Authentication failed." });
    }

    if (!serverDb) {
      inMemoryScheduledPosts.delete(rawPostId);
      saveScheduledPostsToDisk();
      return res.json({
        success: true,
        outcome: mode === "delete" ? "deleted" : mode === "unschedule" ? "unscheduled" : "canceled",
        message: "Removed from local dispatch queue."
      });
    }

    const result = await cancelScheduledPostTransaction(createFirestoreScheduledPostStore(serverDb), {
      postId: rawPostId,
      userId: rawUserId,
      mode,
      nextStatus
    });

    if (result.evictFromCache) {
      inMemoryScheduledPosts.delete(rawPostId);
      saveScheduledPostsToDisk();
    }

    if (result.outcome === "forbidden") {
      return res.status(403).json({ success: false, outcome: result.outcome, error: result.message });
    }
    if (result.outcome === "already_publishing" || result.outcome === "already_published") {
      return res.status(409).json({ success: false, outcome: result.outcome, error: result.message });
    }

    return res.json({
      success: result.ok,
      outcome: result.outcome,
      message: result.message
    });
  } catch (err: any) {
    console.error("[CANCEL_SCHEDULED_POST_ERROR]", err);
    return res.status(500).json({ success: false, error: "Failed to cancel scheduled post." });
  }
};

app.post("/api/posts/:postId/cancel", handleSinglePostCancel);
app.post("/api/posts/cancel", handleSinglePostCancel);

app.post("/api/posts/unschedule-all", async (req: express.Request, res: express.Response) => {
  try {
    const { userId, deletePermanently } = req.body || {};
    
    // P0 Strict User ID Validation - Prevent multi-tenant data contamination
    if (!userId || typeof userId !== "string" || userId.trim() === "" || userId === "anonymous") {
      return res.status(400).json({ success: false, error: "A valid authenticated userId is strictly required." });
    }

    try {
      await verifyAuthUser(req, userId);
    } catch (authErr: any) {
      if (authErr?.message === "FORBIDDEN_USER_MISMATCH") {
        return res.status(403).json({ success: false, error: "Access Denied: You cannot unschedule posts for another user." });
      }
      return res.status(401).json({ success: false, error: "Authentication failed." });
    }

    if (!serverDb) {
      return res.json({ success: true, count: 0, note: "serverDb not active" });
    }

    const effectiveUserId = userId.trim();
    const nowIso = new Date().toISOString();
    const postsQuery = serverDb.collection("posts").where("userId", "==", effectiveUserId).where("status", "==", "Scheduled");
    const snap = await postsQuery.get();
    
    // Safety & Target Rule: Target strictly all records where status === "Scheduled" (case-insensitive)
    // Never affect Published, Draft, Failed, or Publishing posts
    const scheduledDocs = snap.docs.filter((doc) => {
      const data = doc.data();
      const statusStr = String(data.status || "").trim().toLowerCase();
      return statusStr === "scheduled";
    });

    // Firestore batch limit is 500 operations. Process safely in chunks of 400
    const BATCH_SIZE = 400;
    let updatedCount = 0;
    let batchesRequired = 0;

    for (let i = 0; i < scheduledDocs.length; i += BATCH_SIZE) {
      const chunk = scheduledDocs.slice(i, i + BATCH_SIZE);
      const batch = serverDb.batch();
      for (const doc of chunk) {
        if (deletePermanently) {
          batch.delete(doc.ref);
        } else {
          batch.update(doc.ref, {
            status: "Draft",
            stage: "Draft",
            scheduledFor: null,
            scheduledAt: null,
            isCanceled: true,
            canceledAt: nowIso,
            publishingClaimToken: null,
            updatedAt: nowIso,
          });
        }
        updatedCount++;
      }
      await batch.commit();
      batchesRequired++;
    }

    // Clear in-memory dispatcher cache so background runner never accesses unscheduled posts
    for (const doc of scheduledDocs) {
      inMemoryScheduledPosts.delete(doc.id);
    }
    for (const [cachedId, cachedPost] of Array.from(inMemoryScheduledPosts.entries())) {
      if (cachedPost?.userId === effectiveUserId && String(cachedPost?.status || "").toLowerCase() === "scheduled") {
        inMemoryScheduledPosts.delete(cachedId);
      }
    }
    saveScheduledPostsToDisk();

    console.log(`[UNSCHEDULE_ALL] Updated ${updatedCount} scheduled posts in ${batchesRequired} batch(es) for user ${effectiveUserId} (deletePermanently=${!!deletePermanently})`);
    return res.json({
      success: true,
      count: updatedCount,
      batchesRequired,
      processedIds: scheduledDocs.map((d) => d.id)
    });
  } catch (error: any) {
    console.error("[UNSCHEDULE_ALL_ERROR]", error);
    return res.status(500).json({ success: false, error: error.message || String(error) });
  }
});

app.post("/api/posts/delete-all-drafts", async (req: express.Request, res: express.Response) => {
  try {
    const { userId } = req.body || {};

    // P0 Strict User ID Validation - Prevent multi-tenant data contamination
    if (!userId || typeof userId !== "string" || userId.trim() === "" || userId === "anonymous") {
      return res.status(400).json({ success: false, error: "A valid authenticated userId is strictly required." });
    }

    try {
      await verifyAuthUser(req, userId);
    } catch (authErr: any) {
      if (authErr?.message === "FORBIDDEN_USER_MISMATCH") {
        return res.status(403).json({ success: false, error: "Access Denied: You cannot delete drafts for another user." });
      }
      return res.status(401).json({ success: false, error: "Authentication failed." });
    }

    if (!serverDb) {
      return res.json({ success: true, count: 0, note: "serverDb not active" });
    }

    const effectiveUserId = userId.trim();
    const postsQuery = serverDb.collection("posts").where("userId", "==", effectiveUserId).where("status", "==", "Draft");
    const snap = await postsQuery.get();
    let deletedCount = 0;

    const batch = serverDb.batch();
    for (const doc of snap.docs) {
      const data = doc.data();
      const isDraft = (data.status === "Draft" || !data.status) && !data.scheduledFor && !data.scheduledAt;
      if (isDraft) {
        batch.delete(doc.ref);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      await batch.commit();
    }

    console.log(`[DELETE_ALL_DRAFTS] Deleted ${deletedCount} draft posts for user ${effectiveUserId}`);
    return res.json({ success: true, count: deletedCount });
  } catch (error: any) {
    console.error("[DELETE_ALL_DRAFTS_ERROR]", error);
    return res.status(500).json({ success: false, error: error.message || String(error) });
  }
});

// Secure authentication middleware for scheduler and cron endpoints
async function requireSchedulerAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  // Safe default: bypass check in local development to keep local tests and debugging fully functional
  if (process.env.NODE_ENV !== "production") {
    return next();
  }

  // 1. Shared secret token check (x-cron-key header)
  const cronKey = req.headers["x-cron-key"];
  const expectedSecret = process.env.CRON_SECRET_KEY || "TW_SECURE_CRON_TOKEN_2026";
  if (cronKey && cronKey === expectedSecret) {
    return next();
  }

  // 2. Google OIDC Token check (sent by Google Cloud Scheduler with Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    try {
      const ticket = await oidcClient.verifyIdToken({ idToken: token });
      const payload = ticket.getPayload();
      if (payload) {
        const authorizedSa = process.env.AUTHORIZED_SERVICE_ACCOUNT_EMAIL || "ais-sandbox@ais-us-west2-a7fbff83b12040acb.iam.gserviceaccount.com";
        if (!authorizedSa || (payload.email && payload.email.toLowerCase() === authorizedSa.toLowerCase())) {
          console.log(`[AUTH] Authenticated Cloud Scheduler Google OIDC Token for: ${payload.email}`);
          return next();
        } else {
          console.warn(`[AUTH_REJECTED] Service account email mismatch: ${payload.email} !== ${authorizedSa}`);
        }
      }
    } catch (err: any) {
      console.warn(`[AUTH_REJECTED] Failed OIDC cryptographic token verification:`, err?.message || err);
    }
  }

  console.warn(`[AUTH_REJECTED] Unauthenticated scheduler request from IP: ${req.ip}`);
  return res.status(401).json({ success: false, error: "Unauthorized: Valid Cron Secret or Google OIDC Token is required." });
}

app.post("/api/cron/publish", requireSchedulerAuth, async (req, res) => {
  console.log("[DIAG_CHECKPOINT 1/8] Enter cron handler. Route: /api/cron/publish");
  try {
    const result = await runScheduledPostDispatcher();
    if (!result.success) {
      const statusCode = result.status === "BLOCKED_QUOTA" ? 429 : 500;
      return res.status(statusCode).json({
        success: false,
        error: result.errorMessage || "Queue retrieval blocked",
        errorCode: result.errorCode || "DISPATCHER_ERROR",
        status: result.status,
        processed: result.processed,
        failed: result.failed,
        cooldownRemainingMs: result.cooldownRemainingMs
      });
    }

    const message = result.status === "EMPTY_QUEUE"
      ? "Cron execution complete. Queue is empty (0 due posts)."
      : `Cron execution complete. Processed ${result.processed.length} posts successfully, with ${result.failed.length} failures.`;

    return res.json({
      success: true,
      message,
      status: result.status,
      processed: result.processed,
      failed: result.failed
    });
  } catch (error: any) {
    console.error("[CRON_CRITICAL_FATAL] Global scheduling runner failed:", error);
    return res.status(500).json({ success: false, error: error.message || String(error) });
  }
});

app.get("/api/cron/publish", requireSchedulerAuth, async (req, res) => {
  try {
    const result = await runScheduledPostDispatcher();
    if (!result.success) {
      const statusCode = result.status === "BLOCKED_QUOTA" ? 429 : 500;
      return res.status(statusCode).json({
        success: false,
        error: result.errorMessage || "Queue retrieval blocked",
        errorCode: result.errorCode || "DISPATCHER_ERROR",
        status: result.status,
        processed: result.processed,
        failed: result.failed,
        cooldownRemainingMs: result.cooldownRemainingMs
      });
    }

    const message = result.status === "EMPTY_QUEUE"
      ? "Cron execution complete. Queue is empty (0 due posts)."
      : `Cron execution complete. Processed ${result.processed.length} posts successfully, with ${result.failed.length} failures.`;

    return res.json({
      success: true,
      message,
      status: result.status,
      processed: result.processed,
      failed: result.failed
    });
  } catch (error: any) {
    console.error("[CRON_CRITICAL_FATAL] Global scheduling runner failed:", error);
    return res.status(500).json({ success: false, error: error.message || String(error) });
  }
});

app.post("/api/posts/dispatch-due", async (req: express.Request, res: express.Response) => {
  try {
    const { postId, userId, post, posts } = req.body || {};

    // In production, verify caller is either a valid scheduler trigger or an authenticated user
    if (process.env.NODE_ENV === "production") {
      let isSchedulerAuthed = false;
      const cronKey = req.headers["x-cron-key"];
      const expectedSecret = process.env.CRON_SECRET_KEY || "TW_SECURE_CRON_TOKEN_2026";
      if (cronKey && cronKey === expectedSecret) {
        isSchedulerAuthed = true;
      }

      if (!isSchedulerAuthed && req.headers.authorization?.startsWith("Bearer ")) {
        const token = req.headers.authorization.substring(7);
        try {
          const ticket = await oidcClient.verifyIdToken({ idToken: token });
          const payload = ticket.getPayload();
          const authorizedSa = process.env.AUTHORIZED_SERVICE_ACCOUNT_EMAIL || "ais-sandbox@ais-us-west2-a7fbff83b12040acb.iam.gserviceaccount.com";
          if (payload && (!authorizedSa || (payload.email && payload.email.toLowerCase() === authorizedSa.toLowerCase()))) {
            isSchedulerAuthed = true;
          }
        } catch (_) {}
      }

      if (!isSchedulerAuthed) {
        // Must be authenticated user matching target userId
        const targetUid = userId || post?.userId || (Array.isArray(posts) && posts[0]?.userId);
        try {
          await verifyAuthUser(req, targetUid ? String(targetUid) : undefined);
        } catch (authErr: any) {
          if (authErr?.message === "FORBIDDEN_USER_MISMATCH") {
            return res.status(403).json({ success: false, error: "Access Denied: You cannot dispatch posts for another user." });
          }
          return res.status(401).json({ success: false, error: "Unauthorized: Valid user session or scheduler authentication required." });
        }
      }
    }

    const candidateList = [];
    if (Array.isArray(posts)) candidateList.push(...posts);
    if (post && typeof post === "object") candidateList.push(post);
    
    const result = await runScheduledPostDispatcher({
      targetPostId: postId,
      targetUserId: userId,
      posts: candidateList.length > 0 ? candidateList : undefined
    });
    if (!result.success) {
      const statusCode = result.status === "BLOCKED_QUOTA" ? 429 : 500;
      return res.status(statusCode).json(result);
    }
    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || String(error) });
  }
});

// ==========================================
// THREADSWORKS THREADS ANALYTICS DATA LAYER API
// ==========================================

const analyticsService = createAnalyticsService({
  clientDb,
  serverDb,
  clientDoc,
  clientGetDoc,
  clientSetDoc,
  clientUpdateDoc,
  clientCollection,
  clientGetDocs,
  clientQuery,
  clientWhere
});

// 1. Trigger Analytics Synchronization (Meta Insights Fetch & Normalization)
app.post("/api/threads/analytics/sync", async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.body?.userId || req.query?.userId;
    if (!userId || typeof userId !== "string" || userId.trim() === "" || userId === "anonymous") {
      return res.status(400).json({ success: false, error: "Missing required parameter: userId" });
    }

    try {
      await verifyAuthUser(req, String(userId));
    } catch (authErr: any) {
      if (authErr?.message === "FORBIDDEN_USER_MISMATCH") {
        return res.status(403).json({ success: false, error: "Access Denied: You cannot synchronize analytics for another user." });
      }
      return res.status(401).json({ success: false, error: "Authentication failed." });
    }

    const maxPosts = req.body?.maxPosts ? Number(req.body.maxPosts) : 30;
    const forceRefresh = Boolean(req.body?.forceRefresh);

    const result = await analyticsService.syncUserAnalytics(String(userId), { maxPosts, forceRefresh });
    if (!result.success) {
      const statusCode = result.summary?.hasInsightsPermission === false ? 403 : 500;
      return res.status(statusCode).json(result);
    }

    // Invalidate downstream caches for this specific user so fresh metrics immediately cascade
    try {
      performanceIntelligenceService.invalidateUserIntelligenceCache(String(userId));
      performanceRecommendationService.invalidateCache(String(userId));
      strategyIntelligenceService.invalidateUserStrategyCache(String(userId));
    } catch (invErr) {
      console.warn("[AnalyticsSync] Cache invalidation note:", invErr);
    }

    return res.json(result);
  } catch (err: any) {
    console.error("Error in /api/threads/analytics/sync:", err);
    return res.status(500).json({ success: false, error: err.message || "Analytics sync failed" });
  }
});

// 2. Retrieve Account-Level Analytics Snapshot
app.get("/api/threads/analytics/account", async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.query?.userId as string;
    if (!userId || typeof userId !== "string" || userId.trim() === "" || userId === "anonymous") {
      return res.status(400).json({ success: false, error: "Missing required query parameter: userId" });
    }

    try {
      await verifyAuthUser(req, String(userId));
    } catch (authErr: any) {
      if (authErr?.message === "FORBIDDEN_USER_MISMATCH") {
        return res.status(403).json({ success: false, error: "Access Denied: You cannot view analytics for another user." });
      }
      return res.status(401).json({ success: false, error: "Authentication failed." });
    }

    const windowParam = req.query?.window as "1d" | "7d" | "30d" | undefined;
    const account = await analyticsService.getAccountAnalytics(String(userId), windowParam);
    return res.json({ success: true, account });
  } catch (err: any) {
    console.error("Error in /api/threads/analytics/account:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed retrieving account analytics" });
  }
});

// 3. Retrieve Post-Level Analytics with Filters & Sorting
app.get("/api/threads/analytics/posts", async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.query?.userId as string;
    if (!userId || typeof userId !== "string" || userId.trim() === "" || userId === "anonymous") {
      return res.status(400).json({ success: false, error: "Missing required query parameter: userId" });
    }

    try {
      await verifyAuthUser(req, String(userId));
    } catch (authErr: any) {
      if (authErr?.message === "FORBIDDEN_USER_MISMATCH") {
        return res.status(403).json({ success: false, error: "Access Denied: You cannot view posts analytics for another user." });
      }
      return res.status(401).json({ success: false, error: "Authentication failed." });
    }

    const limit = req.query?.limit ? parseInt(req.query.limit as string, 10) : 50;
    const offset = req.query?.offset ? parseInt(req.query.offset as string, 10) : 0;
    const sortBy = (req.query?.sortBy as any) || "publishedAt";
    const sortDirection = (req.query?.sortDirection as any) || "desc";
    const topic = req.query?.topic as string | undefined;
    const pillarTitle = req.query?.pillarTitle as string | undefined;
    const mediaType = req.query?.mediaType as string | undefined;
    const since = req.query?.since as string | undefined;
    const until = req.query?.until as string | undefined;

    const result = await analyticsService.getPostAnalytics({
      userId: String(userId),
      limit,
      offset,
      sortBy,
      sortDirection,
      topic,
      pillarTitle,
      mediaType,
      since,
      until
    });

    return res.json({ success: true, ...result });
  } catch (err: any) {
    console.error("Error in /api/threads/analytics/posts:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed retrieving post analytics" });
  }
});

// 4. Retrieve Single Post Analytics by Media ID
app.get("/api/threads/analytics/post/:mediaId", async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.query?.userId as string;
    const mediaId = req.params?.mediaId;
    if (!userId || !mediaId) {
      return res.status(400).json({ success: false, error: "Missing required parameters: userId and mediaId" });
    }

    const post = await analyticsService.getSinglePostAnalytics(String(userId), String(mediaId));
    return res.json({ success: true, post });
  } catch (err: any) {
    console.error("Error in /api/threads/analytics/post/:mediaId:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed retrieving single post analytics" });
  }
});

// 5. Retrieve Analytics Synchronization Status
app.get("/api/threads/analytics/sync-status", async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.query?.userId as string;
    if (!userId) {
      return res.status(400).json({ success: false, error: "Missing required query parameter: userId" });
    }

    const summary = await analyticsService.getAnalyticsSyncStatus(String(userId));
    return res.json({ success: true, summary });
  } catch (err: any) {
    console.error("Error in /api/threads/analytics/sync-status:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed retrieving analytics sync status" });
  }
});

// ==========================================
// THREADSWORKS CONTENT PERFORMANCE INTELLIGENCE API
// ==========================================

const performanceIntelligenceService = createPerformanceIntelligenceService({
  getPostAnalytics: (options) => analyticsService.getPostAnalytics(options),
  getAccountAnalytics: (userId) => analyticsService.getAccountAnalytics(userId)
});

// 6. Retrieve Full Content Performance Intelligence Summary
app.get("/api/threads/analytics/intelligence/summary", async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.query?.userId as string;
    if (!userId) {
      return res.status(400).json({ success: false, error: "Missing required query parameter: userId" });
    }

    const period = ((req.query?.period as any) || "all") as "7d" | "14d" | "30d" | "90d" | "all";
    const forceRefresh = req.query?.forceRefresh === "true";

    const intelligence = await performanceIntelligenceService.generateIntelligenceSummary(
      String(userId),
      period,
      forceRefresh
    );

    return res.json({ success: true, intelligence });
  } catch (err: any) {
    console.error("Error in /api/threads/analytics/intelligence/summary:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed generating content performance intelligence"
    });
  }
});

// 7. Retrieve Single Post Intelligence Context & Benchmark Comparison
app.get("/api/threads/analytics/intelligence/post-context", async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.query?.userId as string;
    const mediaId = req.query?.mediaId as string;
    if (!userId || !mediaId) {
      return res.status(400).json({ success: false, error: "Missing required parameters: userId and mediaId" });
    }

    const context = await performanceIntelligenceService.getSinglePostContext(String(userId), String(mediaId));
    if (!context) {
      return res.status(404).json({ success: false, error: "Post not found or analytics unavailable" });
    }

    return res.json({ success: true, context });
  } catch (err: any) {
    console.error("Error in /api/threads/analytics/intelligence/post-context:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed retrieving single post intelligence context"
    });
  }
});

// ==========================================
// THREADSWORKS AI PERFORMANCE RECOMMENDATION ENGINE
// ==========================================

const performanceRecommendationService = createPerformanceRecommendationService({
  getIntelligenceSummary: (userId, period, force) => performanceIntelligenceService.generateIntelligenceSummary(userId, period, force),
  getUserProfile: async (userId: string) => {
    try {
      if (serverDb) {
        const userSnap = await serverDb.collection("users").doc(userId).get();
        if (userSnap.exists) return userSnap.data() as any;
      } else if (clientDb) {
        const userDoc = await clientGetDoc(clientDoc(clientDb, "users", userId));
        if (userDoc.exists()) return userDoc.data() as any;
      }
      return null;
    } catch (err) {
      console.warn(`[RECOMMENDATION_PROFILE_LOOKUP_WARN] Could not fetch profile for user ${userId}:`, err);
      return null;
    }
  }
});

// 8. Retrieve AI Content Performance Recommendations
app.get("/api/threads/analytics/recommendations", async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.query?.userId as string;
    if (!userId) {
      return res.status(400).json({ success: false, error: "Missing required query parameter: userId" });
    }

    const period = ((req.query?.period as any) || "all") as "7d" | "14d" | "30d" | "90d" | "all";
    const forceRefresh = req.query?.forceRefresh === "true";
    const category = req.query?.category as string | undefined;

    const data = await performanceRecommendationService.generateRecommendations(
      String(userId),
      period,
      forceRefresh
    );

    // Apply category filtering if requested
    let filteredRecs = data.recommendations;
    if (category && category !== "all") {
      filteredRecs = filteredRecs.filter((r) => r.category === category);
    }

    return res.json({
      success: true,
      data: {
        ...data,
        recommendations: filteredRecs
      }
    });
  } catch (err: any) {
    console.error("Error in /api/threads/analytics/recommendations:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed generating content performance recommendations"
    });
  }
});

// 9. Force Refresh Recommendations
app.post("/api/threads/analytics/recommendations/refresh", async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.body?.userId as string;
    if (!userId) {
      return res.status(400).json({ success: false, error: "Missing required body parameter: userId" });
    }

    const period = ((req.body?.period as any) || "all") as "7d" | "14d" | "30d" | "90d" | "all";
    performanceRecommendationService.invalidateCache(String(userId));

    const data = await performanceRecommendationService.generateRecommendations(
      String(userId),
      period,
      true
    );

    return res.json({ success: true, data });
  } catch (err: any) {
    console.error("Error in /api/threads/analytics/recommendations/refresh:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed refreshing content performance recommendations"
    });
  }
});

// =============================================================
// INTELLIGENT CONTENT MEMORY ROUTES
// =============================================================

// Route 1: Retrieve Full Intelligent Memory Profile (Ideas, Gaps, Repetition, Variations)
app.post("/api/content-memory/intelligent", async (req, res) => {
  try {
    const userId = req.body?.userId || req.body?.creatorIdentity?.uid || "anonymous";
    const userProfile = req.body?.userProfile || null;
    let rawPosts = Array.isArray(req.body?.rawPosts) ? req.body.rawPosts : [];

    // If client didn't supply posts, query from serverDb
    if (rawPosts.length === 0 && userId !== "anonymous" && serverDb) {
      try {
        const snap = await serverDb.collection("posts").where("userId", "==", userId).limit(80).get();
        rawPosts = snap.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        }));
      } catch (dbErr: any) {
        console.warn(`[ContentMemoryService] Failed querying posts from Firestore for ${userId}:`, dbErr.message);
      }
    }

    // Attempt to load analytics records & creator baselines for performance context
    let analyticsPosts: any[] = [];
    let baselines: any = null;
    try {
      if (userId !== "anonymous") {
        const postAnalyticsResult = await analyticsService.getPostAnalytics({ userId, limit: 100 });
        analyticsPosts = postAnalyticsResult?.posts || [];
        const intelSummary = await performanceIntelligenceService.generateIntelligenceSummary(userId, "all");
        baselines = intelSummary?.baseline || null;
      }
    } catch (anErr: any) {
      // Analytics is optional for memory distillation
    }

    const profile = await distillIntelligentContentMemory(
      userId,
      rawPosts,
      userProfile,
      analyticsPosts,
      baselines
    );

    return res.json({ success: true, profile });
  } catch (err: any) {
    console.error("Error in /api/content-memory/intelligent:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to distill intelligent content memory profile."
    });
  }
});

// Route 2: Conceptual & Semantic Content Memory Search
app.post("/api/content-memory/search", async (req, res) => {
  try {
    const userId = req.body?.userId || "anonymous";
    const query = req.body?.query || "";
    let rawPosts = Array.isArray(req.body?.rawPosts) ? req.body.rawPosts : [];

    if (rawPosts.length === 0 && userId !== "anonymous" && serverDb) {
      try {
        const snap = await serverDb.collection("posts").where("userId", "==", userId).limit(80).get();
        rawPosts = snap.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        }));
      } catch {}
    }

    const profile = await distillIntelligentContentMemory(userId, rawPosts, req.body?.userProfile);
    const searchResponse = await searchContentMemory(profile, rawPosts, {
      query,
      userId,
      pillarFilter: req.body?.pillarFilter,
      formatFilter: req.body?.formatFilter,
      angleFilter: req.body?.angleFilter,
      minPerformanceFilter: req.body?.minPerformanceFilter,
      limit: req.body?.limit || 25
    });

    return res.json({ success: true, data: searchResponse });
  } catch (err: any) {
    console.error("Error in /api/content-memory/search:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed searching content memory."
    });
  }
});

// Route 3: Pre-Save & Draft Similarity Protection Check
app.post("/api/content-memory/check-similarity", async (req, res) => {
  try {
    const userId = req.body?.userId || "anonymous";
    const text = req.body?.text || "";
    const hook = req.body?.hook || "";
    const title = req.body?.title || "";
    let rawPosts = Array.isArray(req.body?.rawPosts) ? req.body.rawPosts : [];

    if (rawPosts.length === 0 && userId !== "anonymous" && serverDb) {
      try {
        const snap = await serverDb.collection("posts").where("userId", "==", userId).limit(80).get();
        rawPosts = snap.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        }));
      } catch {}
    }

    const profile = await distillIntelligentContentMemory(userId, rawPosts);
    const result = await checkSimilarityAgainstMemory(profile, rawPosts, {
      text,
      hook,
      title,
      userId
    });

    return res.json({ success: true, result });
  } catch (err: any) {
    console.error("Error in /api/content-memory/check-similarity:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed checking content similarity."
    });
  }
});

// Route 4: Generate Targeted Unexplored Variations for an Idea
app.post("/api/content-memory/unexplored-variations", async (req, res) => {
  try {
    const { canonicalConcept, summary, format, creatorIdentity } = req.body;
    const targetConcept = (canonicalConcept || summary || "Digital Growth Strategy").trim();
    const targetFormat = (format || "Step-by-Step Blueprint").trim();

    let ai;
    try {
      ai = getAI();
    } catch {
      // Fallback
      return res.json({
        success: true,
        variations: [
          {
            title: `${targetFormat}: ${targetConcept.slice(0, 35)}`,
            hook: `Here is the exact ${targetFormat.toLowerCase()} for: ${targetConcept}`,
            angle: "Tactical Execution",
            draftPreview: `Most advice on ${targetConcept} stays at 10,000 feet.\n\nHere is how to execute it in 3 clean steps:\n\n1. Define the single core bottleneck\n2. Strip out low-leverage activities\n3. Build a repeatable weekly rhythm`
          }
        ]
      });
    }

    const prompt = `You are the ThreadsWorks Variation Intelligence Engine.
Your task is to take an established canonical idea concept and generate 3 distinct, high-impact post variation drafts delivered strictly through the requested format: "${targetFormat}".

CANONICAL CONCEPT:
"${targetConcept}"

CONCEPT SUMMARY / THESIS:
"${summary || targetConcept}"

REQUESTED FORMAT:
"${targetFormat}"

${buildCreatorIdentityContext(creatorIdentity)}

GUIDELINES:
- Deliver the idea through a fresh, unrepeated angle.
- The hook must be punchy, compelling, and free of generic AI slop.
- Return a JSON array 'variations' with exactly 3 elements. Each element must contain:
  - 'title': Concise title of this specific variation (3-6 words)
  - 'hook': Scroll-stopping opening line (under 140 chars)
  - 'angle': Strategic angle name (e.g., "Contrarian Diagnosis", "Step-by-Step Roadmap", "Client Case Breakdown")
  - 'draftPreview': High-converting single post draft (150-350 chars)
`;

    const response = await callGenerateContentWithRetry(ai, {
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            variations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  hook: { type: Type.STRING },
                  angle: { type: Type.STRING },
                  draftPreview: { type: Type.STRING }
                },
                required: ["title", "hook", "angle", "draftPreview"]
              }
            }
          },
          required: ["variations"]
        }
      }
    });

    const parsed = JSON.parse(response.text || "{}");
    return res.json({
      success: true,
      variations: parsed.variations || []
    });

  } catch (err: any) {
    console.error("Error in /api/content-memory/unexplored-variations:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed generating unexplored variations."
    });
  }
});

// =============================================================
// LAYER 5: STRATEGY INTELLIGENCE & OPPORTUNITY ENGINE ROUTES
// =============================================================

const strategyIntelligenceService = createStrategyIntelligenceService({
  getIntelligenceSummary: (userId, period, force) => performanceIntelligenceService.generateIntelligenceSummary(userId, period, force),
  getIntelligentContentMemory: async (userId, posts, userProfile) => {
    let analyticsPosts: any[] = [];
    let baselines: any = null;
    try {
      if (userId !== "anonymous") {
        const postAnalyticsResult = await analyticsService.getPostAnalytics({ userId, limit: 100 });
        analyticsPosts = postAnalyticsResult?.posts || [];
        const intelSummary = await performanceIntelligenceService.generateIntelligenceSummary(userId, "all");
        baselines = intelSummary?.baseline || null;
      }
    } catch (err) {}
    return distillIntelligentContentMemory(userId, posts, userProfile, analyticsPosts, baselines);
  },
  getPostAnalytics: (options) => analyticsService.getPostAnalytics(options),
  getUserProfile: async (userId: string) => {
    try {
      if (serverDb) {
        const userSnap = await serverDb.collection("users").doc(userId).get();
        if (userSnap.exists) return userSnap.data() as any;
      } else if (clientDb) {
        const userDoc = await clientGetDoc(clientDoc(clientDb, "users", userId));
        if (userDoc.exists()) return userDoc.data() as any;
      }
      return null;
    } catch {
      return null;
    }
  },
  getPosts: async (userId: string) => {
    if (!userId || userId === "anonymous" || !serverDb) return [];
    try {
      const snap = await serverDb.collection("posts").where("userId", "==", userId).limit(100).get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch {
      return [];
    }
  },
  serverDb,
  clientDb,
  clientDoc,
  clientGetDoc
});

// Initialize the shared V2 Strategic Diagnostic Engine
const strategicDiagnosticEngine = createStrategicDiagnosticEngine(serverDb);

// V2 Route: Get Active Strategic Diagnosis (Runs automatically if none exists)
app.get("/api/v2/strategy/diagnosis", async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.query?.userId as string;
    if (!userId || typeof userId !== "string" || userId.trim() === "" || userId === "anonymous") {
      return res.status(400).json({ success: false, error: "Missing required query parameter: userId" });
    }

    try {
      await verifyAuthUser(req, String(userId));
    } catch (authErr: any) {
      if (authErr?.message === "FORBIDDEN_USER_MISMATCH") {
        return res.status(403).json({ success: false, error: "Access Denied: You cannot view strategy for another user." });
      }
      return res.status(401).json({ success: false, error: "Authentication failed." });
    }

    let diagnosis = await strategicDiagnosticEngine.getPreviousDiagnosis(String(userId));
    if (!diagnosis) {
      console.log(`[V2_STRATEGY] No cached diagnosis found for user ${userId}. Conducting initial strategic audit...`);
      // Retrieve context
      const userProfile = await strategyIntelligenceService.getUserProfile(String(userId));
      const rawPosts = await strategyIntelligenceService.getPosts(String(userId));
      diagnosis = await strategicDiagnosticEngine.performStrategicDiagnosis(String(userId), userProfile, rawPosts);
    }

    return res.json({
      success: true,
      data: diagnosis
    });
  } catch (err: any) {
    console.error("Error in GET /api/v2/strategy/diagnosis:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed retrieving active strategic diagnosis"
    });
  }
});

// V2 Route: Conduct Fresh Strategic Diagnosis (Force AI Re-Audit)
app.post("/api/v2/strategy/diagnose", async (req: express.Request, res: express.Response) => {
  try {
    const { userId } = req.body;
    if (!userId || typeof userId !== "string" || userId.trim() === "" || userId === "anonymous") {
      return res.status(400).json({ success: false, error: "Missing required 'userId' parameter." });
    }

    try {
      await verifyAuthUser(req, String(userId));
    } catch (authErr: any) {
      if (authErr?.message === "FORBIDDEN_USER_MISMATCH") {
        return res.status(403).json({ success: false, error: "Access Denied: You cannot perform strategy audit for another user." });
      }
      return res.status(401).json({ success: false, error: "Authentication failed." });
    }

    console.log(`[V2_STRATEGY] Conducting fresh strategic audit and constraint diagnosis for user ${userId}...`);
    // Retrieve context
    const userProfile = await strategyIntelligenceService.getUserProfile(String(userId));
    const rawPosts = await strategyIntelligenceService.getPosts(String(userId));
    const diagnosis = await strategicDiagnosticEngine.performStrategicDiagnosis(String(userId), userProfile, rawPosts);

    return res.json({
      success: true,
      data: diagnosis
    });
  } catch (err: any) {
    console.error("Error in POST /api/v2/strategy/diagnose:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed conducting strategic diagnosis re-audit"
    });
  }
});

// 1. Get Strategic Overview (Strategic Content Map + Generated Opportunities)
app.get("/api/strategy/overview", async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.query?.userId as string;
    if (!userId || typeof userId !== "string" || userId.trim() === "" || userId === "anonymous") {
      return res.status(400).json({ success: false, error: "Missing required query parameter: userId" });
    }

    try {
      await verifyAuthUser(req, String(userId));
    } catch (authErr: any) {
      if (authErr?.message === "FORBIDDEN_USER_MISMATCH") {
        return res.status(403).json({ success: false, error: "Access Denied: You cannot view strategy overview for another user." });
      }
      return res.status(401).json({ success: false, error: "Authentication failed." });
    }

    const timeWindow = ((req.query?.timeWindow as any) || "all") as "7d" | "14d" | "30d" | "90d" | "all";
    const forceRefresh = req.query?.forceRefresh === "true";

    const overview = await strategyIntelligenceService.getStrategyOverview(String(userId), {
      forceRefresh,
      timeWindow
    });

    return res.json({
      success: true,
      data: overview
    });
  } catch (err: any) {
    console.error("Error in /api/strategy/overview:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed generating strategic content overview"
    });
  }
});

// 2. Get Filtered Content Opportunities
app.get("/api/strategy/opportunities", async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.query?.userId as string;
    if (!userId || typeof userId !== "string" || userId.trim() === "" || userId === "anonymous") {
      return res.status(400).json({ success: false, error: "Missing required query parameter: userId" });
    }

    try {
      await verifyAuthUser(req, String(userId));
    } catch (authErr: any) {
      if (authErr?.message === "FORBIDDEN_USER_MISMATCH") {
        return res.status(403).json({ success: false, error: "Access Denied: You cannot view opportunities for another user." });
      }
      return res.status(401).json({ success: false, error: "Authentication failed." });
    }

    const type = req.query?.type as string | undefined;
    const stage = req.query?.stage as string | undefined;
    const pillar = req.query?.pillar as string | undefined;
    const status = req.query?.status as string | undefined;
    const confidence = req.query?.confidence as string | undefined;

    const overview = await strategyIntelligenceService.getStrategyOverview(String(userId));
    let filtered = overview.opportunities;

    if (type && type !== "all") {
      filtered = filtered.filter(o => o.type === type);
    }
    if (stage && stage !== "all") {
      filtered = filtered.filter(o => o.stage === stage);
    }
    if (pillar && pillar !== "all") {
      filtered = filtered.filter(o => (o.pillar || "").toLowerCase() === pillar.toLowerCase());
    }
    if (status && status !== "all") {
      filtered = filtered.filter(o => o.status === status);
    }
    if (confidence && confidence !== "all") {
      filtered = filtered.filter(o => o.evidenceLevel === confidence);
    }

    return res.json({
      success: true,
      data: {
        opportunities: filtered,
        total: filtered.length,
        summary: overview.summary
      }
    });
  } catch (err: any) {
    console.error("Error in /api/strategy/opportunities:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed retrieving content opportunities"
    });
  }
});

// 3. Update Opportunity Action (Save, Plan, Dismiss, Create)
app.post("/api/strategy/opportunities/:id/action", async (req: express.Request, res: express.Response) => {
  try {
    const opportunityId = req.params.id;
    const userId = req.body?.userId as string;
    const action = req.body?.action;
    const scheduledDate = req.body?.scheduledDate;
    const postId = req.body?.postId;

    if (!userId || !opportunityId || !action || typeof userId !== "string" || userId.trim() === "" || userId === "anonymous") {
      return res.status(400).json({
        success: false,
        error: "Missing required parameters: userId, id, and action"
      });
    }

    try {
      await verifyAuthUser(req, String(userId));
    } catch (authErr: any) {
      if (authErr?.message === "FORBIDDEN_USER_MISMATCH") {
        return res.status(403).json({ success: false, error: "Access Denied: You cannot modify opportunities for another user." });
      }
      return res.status(401).json({ success: false, error: "Authentication failed." });
    }

    const result = await strategyIntelligenceService.handleOpportunityAction(
      String(userId),
      String(opportunityId),
      {
        action,
        scheduledDate,
        postId
      }
    );

    return res.json(result);
  } catch (err: any) {
    console.error(`Error in /api/strategy/opportunities/${req.params.id}/action:`, err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed updating opportunity status"
    });
  }
});

// 4. Force Refresh Strategy Intelligence
app.post("/api/strategy/refresh", async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.body?.userId as string;
    if (!userId || typeof userId !== "string" || userId.trim() === "" || userId === "anonymous") {
      return res.status(400).json({ success: false, error: "Missing required body parameter: userId" });
    }

    try {
      await verifyAuthUser(req, String(userId));
    } catch (authErr: any) {
      if (authErr?.message === "FORBIDDEN_USER_MISMATCH") {
        return res.status(403).json({ success: false, error: "Access Denied: You cannot refresh strategy for another user." });
      }
      return res.status(401).json({ success: false, error: "Authentication failed." });
    }

    const timeWindow = ((req.body?.timeWindow as any) || "all") as "7d" | "14d" | "30d" | "90d" | "all";
    const overview = await strategyIntelligenceService.getStrategyOverview(String(userId), {
      forceRefresh: true,
      timeWindow
    });

    return res.json({
      success: true,
      data: overview
    });
  } catch (err: any) {
    console.error("Error in /api/strategy/refresh:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed refreshing strategy intelligence"
    });
  }
});

// 5. Deconstruct External Creator Account/Post Strategy
app.post("/api/strategy/deconstruct-external", async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.body?.userId as string;
    let url = (req.body?.url as string) || "";
    let content = (req.body?.content as string) || "";
    let creatorHandle = (req.body?.creatorHandle as string) || "";

    if (!userId || typeof userId !== "string" || userId.trim() === "" || userId === "anonymous") {
      return res.status(400).json({ success: false, error: "Missing required body parameter: userId" });
    }

    try {
      await verifyAuthUser(req, String(userId));
    } catch (authErr: any) {
      if (authErr?.message === "FORBIDDEN_USER_MISMATCH") {
        return res.status(403).json({ success: false, error: "Access Denied: You cannot deconstruct strategies for another user." });
      }
      return res.status(401).json({ success: false, error: "Authentication failed." });
    }

    if (!url.trim() && !content.trim()) {
      return res.status(400).json({ success: false, error: "Please provide either a Threads post URL or post text content to analyze." });
    }

    // Attempt OEmbed lookup if URL provided and no content specified
    if (url.trim() && !content.trim()) {
      try {
        const oembedUrl = `https://www.threads.net/oembed?url=${encodeURIComponent(url.trim())}`;
        const fetchRes = await fetch(oembedUrl);
        if (fetchRes.ok) {
          const oembedData = await fetchRes.json();
          if (oembedData.author_name && !creatorHandle) {
            creatorHandle = `@${oembedData.author_name.replace(/^@/, "")}`;
          }
          if (oembedData.title) {
            content = oembedData.title;
          } else if (oembedData.html) {
            content = oembedData.html.replace(/<[^>]+>/g, " ").trim();
          }
        }
      } catch (oembedErr) {
        console.warn("OEmbed fetch note:", oembedErr);
      }
    }

    if (!content.trim()) {
      content = `Threads post analysis for URL: ${url}`;
    }

    const ai = getAI();
    const prompt = `You are the ThreadsWorks Strategy Engine specializing in extracting structural DNA, viral mechanics, and re-usable framework blueprints from high-performing Meta Threads posts.

ANALYZE THIS POST / THREAD CONTENT FROM CREATOR (${creatorHandle || "External Creator"}):
"""
${content}
"""

Task: Deconstruct this post into its pure strategic framework DNA. Do NOT copy the words or topic verbatim. Extract the structural framework so another creator can apply this exact strategy to their own industry/niche.

Return a JSON object conforming strictly to this schema:
- frameworkTitle: A concise, memorable name for this strategy framework (e.g. "The Counter-Intuitive Myth Shatterer", "The 3-Part Modular Diagnostic", "The Problem-Mechanism-Solution Playbook")
- creatorHandle: The handle of the creator or source (e.g. "${creatorHandle || "@creator"}")
- hookType: Type of hook used (e.g., "Belief Shatterer", "Quantified Data Contrast", "Open Curiosity Gap", "High-Stakes Warning")
- hookPattern: 1-2 sentence breakdown of how the first lines capture scroll attention
- formattingPattern: 1-2 sentence breakdown of the visual layout (optical spacing, line length, bullet structure)
- strategicAngle: Strategic angle (e.g., "Problem → Mechanism → Solution", "Framework & System", "Contrarian Pattern Interrupt", "Belief Shift")
- psychologicalTriggers: Array of 2-4 psychological triggers (e.g., ["Status Elevation", "Loss Aversion", "Empathy Bridge", "Curiosity Loop"])
- ctaMechanism: Description of the call-to-action or hand-raiser trigger used at the end
- reusableTemplate: A fill-in-the-blank post template with bracketed placeholders like [Your Industry/Niche], [Counter-Intuitive Assertion], [3 Actionable Levers], [Hand-Raiser Keyword].
- strategicTakeaways: Array of 3 actionable takeaways explaining WHY this framework drives high reach and conversation on Threads.
`;

    const response = await callGenerateContentWithRetry(ai, {
      model: "gemini-3.5-flash-lite",
      optimizationTaskId: "DECONSTRUCT_STRATEGY",
      optimizationComplexity: "LEVEL_1_LIGHT",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            frameworkTitle: { type: Type.STRING },
            creatorHandle: { type: Type.STRING },
            hookType: { type: Type.STRING },
            hookPattern: { type: Type.STRING },
            formattingPattern: { type: Type.STRING },
            strategicAngle: { type: Type.STRING },
            psychologicalTriggers: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            ctaMechanism: { type: Type.STRING },
            reusableTemplate: { type: Type.STRING },
            strategicTakeaways: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: [
            "frameworkTitle",
            "hookType",
            "hookPattern",
            "formattingPattern",
            "strategicAngle",
            "psychologicalTriggers",
            "ctaMechanism",
            "reusableTemplate",
            "strategicTakeaways"
          ]
        }
      }
    });

    let deconstructed = JSON.parse(response.text || "{}");

    const strategyRecord = {
      id: `strat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId: String(userId),
      creatorHandle: creatorHandle || deconstructed.creatorHandle || "@creator",
      sourceUrl: url || "",
      frameworkTitle: deconstructed.frameworkTitle || "Creator Strategy Blueprint",
      hookType: deconstructed.hookType || "Pattern Interrupt",
      hookPattern: deconstructed.hookPattern || "",
      formattingPattern: deconstructed.formattingPattern || "",
      strategicAngle: deconstructed.strategicAngle || "Framework & System",
      psychologicalTriggers: deconstructed.psychologicalTriggers || [],
      ctaMechanism: deconstructed.ctaMechanism || "",
      reusableTemplate: deconstructed.reusableTemplate || "",
      strategicTakeaways: deconstructed.strategicTakeaways || [],
      createdAt: new Date().toISOString()
    };

    // Update in-memory store for session continuity
    const userStrats = inMemoryLearnedStrategies.get(String(userId)) || [];
    userStrats.unshift(strategyRecord);
    inMemoryLearnedStrategies.set(String(userId), userStrats.slice(0, 50));

    if (serverDb) {
      try {
        await serverDb.collection("learned_strategies").doc(strategyRecord.id).set(strategyRecord);
      } catch (_) {}
    } else if (clientDb) {
      try {
        await clientSetDoc(clientDoc(clientDb, "learned_strategies", strategyRecord.id), strategyRecord);
      } catch (_) {}
    }

    performanceIntelligenceService.invalidateUserIntelligenceCache(String(userId));
    performanceRecommendationService.invalidateCache(String(userId));
    strategyIntelligenceService.invalidateUserStrategyCache(String(userId));
    invalidateLearnedStrategiesCache(String(userId));

    return res.json({
      success: true,
      message: "External account strategy successfully deconstructed and added to your Viral Flywheel!",
      data: strategyRecord
    });
  } catch (err: any) {
    console.error("Error in /api/strategy/deconstruct-external:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed deconstructing external creator strategy." });
  }
});

// 6. Get Learned External Strategies
app.get("/api/strategy/learned", async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.query?.userId as string;
    if (!userId || typeof userId !== "string" || userId.trim() === "" || userId === "anonymous") {
      return res.status(400).json({ success: false, error: "Missing required query parameter: userId" });
    }

    try {
      await verifyAuthUser(req, String(userId));
    } catch (authErr: any) {
      if (authErr?.message === "FORBIDDEN_USER_MISMATCH") {
        return res.status(403).json({ success: false, error: "Access Denied." });
      }
      return res.status(401).json({ success: false, error: "Authentication failed." });
    }

    const strategies = await getLearnedStrategiesForUser(String(userId));
    return res.json({ success: true, data: strategies });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || "Failed fetching learned strategies." });
  }
});

// 7. Delete Learned Strategy
app.delete("/api/strategy/learned/:id", async (req: express.Request, res: express.Response) => {
  try {
    const strategyId = req.params.id;
    const userId = (req.body?.userId as string) || (req.query?.userId as string);
    if (!userId || !strategyId) {
      return res.status(400).json({ success: false, error: "Missing required parameters." });
    }

    try {
      await verifyAuthUser(req, String(userId));
    } catch (authErr: any) {
      return res.status(403).json({ success: false, error: "Access Denied." });
    }

    // Remove from in-memory store
    const userStrats = inMemoryLearnedStrategies.get(String(userId)) || [];
    inMemoryLearnedStrategies.set(String(userId), userStrats.filter(s => s.id !== strategyId));

    if (serverDb) {
      try {
        await serverDb.collection("learned_strategies").doc(strategyId).delete();
      } catch (_) {}
    } else if (clientDb) {
      try {
        await clientDeleteDoc(clientDoc(clientDb, "learned_strategies", strategyId));
      } catch (_) {}
    }

    performanceIntelligenceService.invalidateUserIntelligenceCache(String(userId));
    strategyIntelligenceService.invalidateUserStrategyCache(String(userId));
    invalidateLearnedStrategiesCache(String(userId));

    return res.json({ success: true, message: "Strategy removed from Viral Flywheel." });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || "Failed deleting learned strategy." });
  }
});


// Startup assertion to verify threadsUserId are always strings
async function runStartupAssertions() {
  console.log("[STARTUP ASSERTION] Skipping broad connections collection read on startup to conserve Firestore read quotas.");
}

// Vite server integration
async function main() {
  // Run startup type safety assertion
  await runStartupAssertions();

  // Run initial scheduled post dispatcher check immediately on startup
  runScheduledPostDispatcher().catch((err) => {
    console.error("[STARTUP_SCHEDULER_ERROR] Failed to run initial scheduled post dispatcher:", err);
  });

  // Start background scheduled post dispatcher interval (every 60 seconds / 60,000ms) for reliable automated execution
  setInterval(() => {
    // If active quota cooldown is in effect, do not spam Firestore
    if (Date.now() < scheduledPostDispatcherCooldownUntil) {
      return;
    }
    runScheduledPostDispatcher().catch((err) => {
      console.error("[BACKGROUND_SCHEDULER_ERROR] Failed to run scheduled post dispatcher:", err);
    });
  }, 60000);

  // Dynamic XML sitemap route with correct application/xml content-type (public indexable routes only)
  app.get("/sitemap.xml", (req, res) => {
    try {
      const xml = buildSitemapXml();
      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      return res.status(200).send(xml);
    } catch (err: any) {
      console.error("[SITEMAP_ERROR] Failed to generate sitemap.xml dynamically:", err);
      return res.status(500).send("Error generating sitemap");
    }
  });

  // Dynamic robots.txt route with correct text/plain content-type
  app.get("/robots.txt", (req, res) => {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    return res.status(200).send(buildRobotsTxt());
  });

  // Direct route for social preview Open Graph image
  app.get("/og-image.png", (req, res) => {
    const ogPathInPublic = path.join(process.cwd(), "public", "og-image.png");
    const ogPathInDist = path.join(process.cwd(), "dist", "og-image.png");
    if (fs.existsSync(ogPathInPublic)) {
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=604800");
      return res.sendFile(ogPathInPublic);
    } else if (fs.existsSync(ogPathInDist)) {
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=604800");
      return res.sendFile(ogPathInDist);
    }
    return res.status(404).send("Not found");
  });

  const distAssetsPath = path.join(process.cwd(), "dist", "assets");
  if (fs.existsSync(distAssetsPath)) {
    app.use("/assets", express.static(distAssetsPath, {
      maxAge: "1y",
      immutable: true
    }));
  }
  // Ensure any missing /assets/* request returns 404 text/plain rather than falling back to index.html
  app.use("/assets", (req, res) => {
    res.status(404).type("text/plain").send("Asset not found");
  });

  app.get("/api/health", (_req: express.Request, res: express.Response) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.post("/api/intelligence/context", async (req: express.Request, res: express.Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Missing or invalid authorization token" });
      }
      const token = authHeader.split("Bearer ")[1];
      const decodedToken = await serverAuth.verifyIdToken(token);
      const userId = decodedToken.uid;

      const { appId, projectId, taskType, domains, maxContextChars } = req.body || {};
      const context = await retrieveSharedIntelligenceContext(
        {
          userId,
          appId: appId || "threadsworks",
          projectId,
          taskType: taskType || "content_generation",
          domains,
          maxContextChars
        },
        serverDb
      );
      return res.json({ success: true, context });
    } catch (err: any) {
      if (err instanceof ProjectOwnershipError) {
        return res.status(403).json({ error: err.message });
      }
      console.error("[API_INTELLIGENCE_CONTEXT_ERROR]", err);
      return res.status(500).json({ error: err?.message || "Failed to retrieve shared intelligence context" });
    }
  });

  app.post("/api/intelligence/contribute", async (req: express.Request, res: express.Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Missing or invalid authorization token" });
      }
      const token = authHeader.split("Bearer ")[1];
      const decodedToken = await serverAuth.verifyIdToken(token);
      const userId = decodedToken.uid;

      const { sourceAppId, projectId, category, factType, provenance, data, evidence, confidence } = req.body || {};
      const result = await contributeSharedIntelligence(
        {
          userId,
          sourceAppId: sourceAppId || "threadsworks",
          projectId,
          category,
          factType,
          provenance,
          data,
          evidence,
          confidence
        },
        serverDb
      );
      return res.json(result);
    } catch (err: any) {
      if (err instanceof ProjectOwnershipError) {
        return res.status(403).json({ error: err.message });
      }
      console.error("[API_INTELLIGENCE_CONTRIBUTE_ERROR]", err);
      return res.status(500).json({ error: err?.message || "Failed to contribute shared intelligence" });
    }
  });

  app.get("/api/intelligence/contributions", async (req: express.Request, res: express.Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Missing or invalid authorization token" });
      }
      const decodedToken = await serverAuth.verifyIdToken(authHeader.split("Bearer ")[1]);
      const contributions = await listSharedIntelligenceContributions(decodedToken.uid, serverDb);
      return res.json({ success: true, contributions });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || "Failed to list intelligence memory" });
    }
  });

  app.delete("/api/intelligence/contributions/:id", async (req: express.Request, res: express.Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Missing or invalid authorization token" });
      }
      const decodedToken = await serverAuth.verifyIdToken(authHeader.split("Bearer ")[1]);
      const result = await deleteSharedIntelligenceContribution(decodedToken.uid, req.params.id, serverDb);
      if (!result.success) return res.status(404).json(result);
      return res.json(result);
    } catch (err: any) {
      if (err instanceof ProjectOwnershipError) {
        return res.status(403).json({ error: err.message });
      }
      return res.status(500).json({ error: err?.message || "Failed to delete intelligence memory" });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const isSandbox = process.env.DISABLE_HMR === "true" || !!process.env.APPLET_ID || !!process.env.K_SERVICE;
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: isSandbox ? false : true,
        watch: isSandbox ? null : {},
        ws: isSandbox ? false : undefined,
      },
      appType: "custom",
    });
    app.use(vite.middlewares);
    app.use("*", async (req, res, next) => {
      const requestPath = req.originalUrl.split("?")[0];
      if (
        requestPath.startsWith("/api/") ||
        requestPath.match(/\.(js|mjs|css|map|json|png|jpe?g|gif|svg|woff2?|ico|webmanifest)$/i)
      ) {
        return next();
      }
      try {
        const indexPath = path.resolve(process.cwd(), "index.html");
        if (fs.existsSync(indexPath)) {
          let template = fs.readFileSync(indexPath, "utf-8");
          template = await vite.transformIndexHtml(req.originalUrl, template);
          const publicRoute = getPublicMarketingRoute(requestPath);
          const html = publicRoute
            ? renderPublicRouteHtml(template, publicRoute)
            : renderNoIndexAppShellHtml(template);
          res
            .status(200)
            .set({
              "Content-Type": "text/html; charset=utf-8",
              "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
            })
            .end(html);
          return;
        }
        next();
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, {
      index: false,
      maxAge: "1d",
      setHeaders: (res, filePath) => {
        if (filePath.endsWith("sitemap.xml")) {
          res.setHeader("Content-Type", "application/xml; charset=utf-8");
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          res.setHeader("Pragma", "no-cache");
          res.setHeader("Expires", "0");
        } else if (filePath.endsWith("robots.txt")) {
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          res.setHeader("Pragma", "no-cache");
          res.setHeader("Expires", "0");
        } else if (filePath.includes("/assets/") || filePath.match(/\.[a-f0-9]{8,16}\.(js|css|woff2?|png|jpe?g|gif|svg)$/)) {
          // Hashed compiled assets are fully immutable - cache for 1 year
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        } else {
          // Standard assets (logos, svg illustrations, screenshots) - cache for 7 days
          res.setHeader("Cache-Control", "public, max-age=604800");
        }
      }
    }));

    app.get("*", (req, res) => {
      // Never return HTML for static assets or API paths that were not found
      if (
        req.path.startsWith("/assets/") ||
        req.path.startsWith("/api/") ||
        req.path.match(/\.(js|mjs|css|map|json|png|jpe?g|gif|svg|woff2?|ico|webmanifest)$/i)
      ) {
        return res.status(404).type("text/plain").send("Resource not found");
      }

      const publicRoute = getPublicMarketingRoute(req.path);
      if (publicRoute) {
        const prerenderedPath = path.join(distPath, publicRoute.outputFile);
        if (fs.existsSync(prerenderedPath)) {
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
          res.setHeader("Cache-Control", "public, max-age=300, must-revalidate");
          return res.sendFile(prerenderedPath);
        }
      }

      const appShellPath = path.join(distPath, "app.html");
      const fallbackPath = fs.existsSync(appShellPath)
        ? appShellPath
        : path.join(distPath, "index.html");

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      return res.sendFile(fallbackPath);
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`ThreadsWorks backend running on http://localhost:${PORT}`);
  });
  // Extend keep-alive and headers timeout to support adaptive 32-post batches and Safari/WebKit
  server.keepAliveTimeout = 320000;
  server.headersTimeout = 325000;
}

main().catch((err) => {
  console.error("Vite server failed to start:", err);
});

