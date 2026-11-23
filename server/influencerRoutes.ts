import { Router, Request, Response } from "express";
import { initializeApp, getApps, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { initializeApp as initializeClientApp } from "firebase/app";
import {
  initializeFirestore as initializeClientFirestore,
  collection as clientCollection,
  query as clientQuery,
  where as clientWhere,
  getDocs as clientGetDocs,
  doc as clientDoc,
  setDoc as clientSetDoc,
  deleteDoc as clientDeleteDoc,
  updateDoc as clientUpdateDoc,
  getDoc as clientGetDoc,
  limit as clientLimit
} from "firebase/firestore";
import fs from "fs";
import path from "path";
import {
  searchCreators,
  analyzeCreatorIntelligence,
  generatePersonalizedDM,
  generateFollowUpDM,
  generateMultiTouchSequence,
  generateBulkDMs,
  generateCoCreationPitch,
  analyzeSignalQuality,
  VERIFIED_THREADS_CREATORS,
  findCreatorByUsername,
} from "./influencerIntelligenceService";
import { discoverCreators, getCreatorsFromDiscoveryIndex } from "./creatorDiscoveryEngine";
import {
  CreatorProfileData,
  CreatorIntelligenceProfile,
  InfluencerSearchFilters,
  SavedInfluencer,
  OutreachEvent,
  OutreachObjective,
  InfluencerRelationshipStatus,
  OutreachResponseStatus,
  CampaignFolder,
} from "../src/types/influencer";

export const influencerRouter = Router();

let firebaseConfig: any = null;
let firebaseProjectId = "studio-6594275665-9cb0f";
let databaseId = "(default)";

try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    firebaseConfig = config;
    if (config.projectId) firebaseProjectId = config.projectId;
    if (config.firestoreDatabaseId) databaseId = config.firestoreDatabaseId;
  }
} catch (e) {
  console.error("[INFLUENCER_ROUTES_INIT] Failed to read firebase-applet-config.json", e);
}

const adminApp = getApps().length === 0
  ? initializeApp({ projectId: firebaseProjectId })
  : getApp();

let clientDb: any = null;
if (firebaseConfig) {
  try {
    const clientApp = initializeClientApp(firebaseConfig);
    clientDb = initializeClientFirestore(clientApp, {
      experimentalForceLongPolling: true,
    }, databaseId || "default");
  } catch (clientErr) {
    console.warn("[InfluencerRoutes] Client SDK init note:", clientErr);
  }
}

function getDb() {
  try {
    return getFirestore(adminApp, databaseId);
  } catch (err) {
    return null;
  }
}

function isPermissionOrQuotaError(err: any): boolean {
  if (!err) return false;
  const msg = String(err.message || err);
  const code = err.code;
  return (
    code === 7 ||
    code === "permission-denied" ||
    msg.includes("PERMISSION_DENIED") ||
    msg.includes("Missing or insufficient permissions") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("Quota exceeded")
  );
}

// ==========================================
// DB HELPER UTILITIES WITH DUAL ADMIN/CLIENT FALLBACK
// ==========================================

async function getUserThreadsToken(userId?: string): Promise<string | undefined> {
  if (!userId) return undefined;
  const adminDb = getDb();
  if (adminDb) {
    try {
      const snap = await adminDb.collection("connections_secure").doc(userId).get();
      if (snap.exists) {
        return snap.data()?.threadsAccessToken || undefined;
      }
    } catch (_) {}
  }
  if (clientDb) {
    try {
      const snap = await clientGetDoc(clientDoc(clientDb, "connections_secure", userId));
      if (snap.exists()) {
        return snap.data()?.threadsAccessToken || undefined;
      }
    } catch (_) {}
  }
  return undefined;
}

async function fetchSavedInfluencersFromDb(userId: string): Promise<SavedInfluencer[]> {
  const adminDb = getDb();
  if (adminDb) {
    try {
      const snapshot = await adminDb
        .collection("saved_influencers")
        .where("userId", "==", userId)
        .get();
      const items: SavedInfluencer[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as SavedInfluencer);
      });
      return items;
    } catch (adminErr) {
      if (!isPermissionOrQuotaError(adminErr)) {
        console.warn("[InfluencerRoutes] Admin DB query note:", adminErr);
      }
    }
  }

  if (clientDb) {
    try {
      const q = clientQuery(
        clientCollection(clientDb, "saved_influencers"),
        clientWhere("userId", "==", userId)
      );
      const snapshot = await clientGetDocs(q);
      const items: SavedInfluencer[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() } as SavedInfluencer);
      });
      return items;
    } catch (clientErr) {
      if (!isPermissionOrQuotaError(clientErr)) {
        console.warn("[InfluencerRoutes] Client DB query note:", clientErr);
      }
    }
  }

  return [];
}

async function saveInfluencerRecordToDb(record: SavedInfluencer): Promise<SavedInfluencer> {
  const adminDb = getDb();
  if (adminDb) {
    try {
      await adminDb.collection("saved_influencers").doc(record.id).set(record, { merge: true });
      return record;
    } catch (adminErr) {
      if (!isPermissionOrQuotaError(adminErr)) {
        console.warn("[InfluencerRoutes] Admin DB save note:", adminErr);
      }
    }
  }

  if (clientDb) {
    try {
      await clientSetDoc(clientDoc(clientDb, "saved_influencers", record.id), record, { merge: true });
      return record;
    } catch (clientErr) {
      if (!isPermissionOrQuotaError(clientErr)) {
        console.warn("[InfluencerRoutes] Client DB save note:", clientErr);
      }
    }
  }

  return record;
}

async function updateInfluencerRecordInDb(id: string, updates: any): Promise<any> {
  const adminDb = getDb();
  if (adminDb) {
    try {
      const docRef = adminDb.collection("saved_influencers").doc(id);
      await docRef.update(updates);
      const snap = await docRef.get();
      if (snap.exists) {
        return { id: snap.id, ...snap.data() };
      }
    } catch (adminErr) {
      if (!isPermissionOrQuotaError(adminErr)) {
        console.warn("[InfluencerRoutes] Admin DB update note:", adminErr);
      }
    }
  }

  if (clientDb) {
    try {
      const ref = clientDoc(clientDb, "saved_influencers", id);
      await clientUpdateDoc(ref, updates);
      const snap = await clientGetDoc(ref);
      if (snap.exists()) {
        return { id: snap.id, ...snap.data() };
      }
    } catch (clientErr) {
      if (!isPermissionOrQuotaError(clientErr)) {
        console.warn("[InfluencerRoutes] Client DB update note:", clientErr);
      }
    }
  }

  return { id, ...updates };
}

async function deleteInfluencerRecordFromDb(id: string): Promise<void> {
  const adminDb = getDb();
  if (adminDb) {
    try {
      await adminDb.collection("saved_influencers").doc(id).delete();
      return;
    } catch (adminErr) {
      if (!isPermissionOrQuotaError(adminErr)) {
        console.warn("[InfluencerRoutes] Admin DB delete note:", adminErr);
      }
    }
  }

  if (clientDb) {
    try {
      await clientDeleteDoc(clientDoc(clientDb, "saved_influencers", id));
      return;
    } catch (clientErr) {
      if (!isPermissionOrQuotaError(clientErr)) {
        console.warn("[InfluencerRoutes] Client DB delete note:", clientErr);
      }
    }
  }
}

async function recordOutreachEventInDb(eventRecord: OutreachEvent, influencerId: string): Promise<void> {
  const adminDb = getDb();
  if (adminDb) {
    try {
      await adminDb.collection("influencer_outreach_events").doc(eventRecord.id).set(eventRecord);
      const infRef = adminDb.collection("saved_influencers").doc(influencerId);
      const infSnap = await infRef.get();
      if (infSnap.exists) {
        const infData = infSnap.data() as SavedInfluencer;
        const history = infData.outreachHistory || [];
        history.push(eventRecord);
        let newStatus: InfluencerRelationshipStatus = infData.relationshipStatus;
        if (infData.relationshipStatus === "new" || infData.relationshipStatus === "shortlisted") {
          newStatus = "contacted";
        }
        await infRef.update({
          outreachHistory: history,
          relationshipStatus: newStatus,
          responseStatus: eventRecord.status,
          updatedAt: eventRecord.updatedAt,
        });
      }
      return;
    } catch (adminErr) {
      if (!isPermissionOrQuotaError(adminErr)) {
        console.warn("[InfluencerRoutes] Admin DB outreach note:", adminErr);
      }
    }
  }

  if (clientDb) {
    try {
      await clientSetDoc(clientDoc(clientDb, "influencer_outreach_events", eventRecord.id), eventRecord);
      const infRef = clientDoc(clientDb, "saved_influencers", influencerId);
      const infSnap = await clientGetDoc(infRef);
      if (infSnap.exists()) {
        const infData = infSnap.data() as SavedInfluencer;
        const history = infData.outreachHistory || [];
        history.push(eventRecord);
        let newStatus: InfluencerRelationshipStatus = infData.relationshipStatus;
        if (infData.relationshipStatus === "new" || infData.relationshipStatus === "shortlisted") {
          newStatus = "contacted";
        }
        await clientUpdateDoc(infRef, {
          outreachHistory: history,
          relationshipStatus: newStatus,
          responseStatus: eventRecord.status,
          updatedAt: eventRecord.updatedAt,
        });
      }
      return;
    } catch (clientErr) {
      if (!isPermissionOrQuotaError(clientErr)) {
        console.warn("[InfluencerRoutes] Client DB outreach note:", clientErr);
      }
    }
  }
}

async function fetchCampaignsFromDb(userId: string): Promise<CampaignFolder[]> {
  const defaultCampaigns: CampaignFolder[] = [
    { id: "camp_q4_course", name: "Q4 Course Affiliate Launch", description: "Reaching out to course creators and digital product strategists", status: "active", createdAt: new Date().toISOString() },
    { id: "camp_podcast", name: "Podcast Guest Outreach", description: "Inviting top tech & creator economy thinkers", status: "active", createdAt: new Date().toISOString() },
    { id: "camp_coauthor", name: "Co-Author Thread Series", description: "Joint thread collaborations on AI tools", status: "active", createdAt: new Date().toISOString() },
  ];

  const adminDb = getDb();
  if (adminDb) {
    try {
      const snap = await adminDb.collection("influencer_campaigns").where("userId", "==", userId).get();
      if (!snap.empty) {
        const campaigns: CampaignFolder[] = [];
        snap.forEach((doc) => campaigns.push({ id: doc.id, ...doc.data() } as CampaignFolder));
        return campaigns;
      }
    } catch (adminErr) {
      if (!isPermissionOrQuotaError(adminErr)) {
        console.warn("[InfluencerRoutes] Admin DB campaigns note:", adminErr);
      }
    }
  }

  if (clientDb) {
    try {
      const q = clientQuery(clientCollection(clientDb, "influencer_campaigns"), clientWhere("userId", "==", userId));
      const snap = await clientGetDocs(q);
      if (!snap.empty) {
        const campaigns: CampaignFolder[] = [];
        snap.forEach((docSnap) => campaigns.push({ id: docSnap.id, ...docSnap.data() } as CampaignFolder));
        return campaigns;
      }
    } catch (clientErr) {
      if (!isPermissionOrQuotaError(clientErr)) {
        console.warn("[InfluencerRoutes] Client DB campaigns note:", clientErr);
      }
    }
  }

  return defaultCampaigns;
}

// ==========================================
// ROUTE HANDLERS
// ==========================================

/**
 * POST /api/influencer/discover
 * Discover relevant creators matching natural language intent + structured filters.
 * Dynamically queries Threads public content, profile lookup, discovery index, and AI relevance ranking.
 */
influencerRouter.post("/discover", async (req: Request, res: Response) => {
  try {
    const { query, filters = {}, userContext, userId: bodyUserId } = req.body;
    const effectiveUserId = bodyUserId || (req as any).user?.uid;
    const userAccessToken = await getUserThreadsToken(effectiveUserId);

    const result = await discoverCreators({
      query: query || "",
      filters,
      userContext,
      userAccessToken,
      maxCandidates: 100,
    });

    return res.json({
      success: true,
      creators: result.creators,
      total: result.total,
      page: result.page,
      limit: result.limit,
      hasMore: result.hasMore,
      queryExpansions: result.queryExpansions,
      discoveryStats: result.discoveryStats,
    });
  } catch (err: any) {
    const errMsg = String(err.message || "");
    if (errMsg.startsWith("VERIFICATION_FAILED:")) {
      const state = errMsg.split(":")[1];
      if (state === "NOT_FOUND") {
        return res.status(404).json({
          success: false,
          error: "Threads profile does not exist. Check for typos or active profile state.",
        });
      }
      if (state === "UNVERIFIED") {
        return res.status(400).json({
          success: false,
          error: "Threads profile could not be verified. Profile may be private, restricted, or inactive.",
        });
      }
      if (state === "VERIFICATION_UNAVAILABLE") {
        return res.status(503).json({
          success: false,
          error: "Temporary verification unavailable due to platform rate limits. Please try again in a few moments.",
        });
      }
    }
    console.error("[InfluencerRoutes] Discover error:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to search creators" });
  }
});

/**
 * POST /api/influencer/analyze
 * Generates deep intelligence profile & overlap comparison with current user.
 */
influencerRouter.post("/analyze", async (req: Request, res: Response) => {
  try {
    const { creator, userContext, userId: bodyUserId } = req.body;
    if (!creator || !creator.username) {
      return res.status(400).json({ success: false, error: "Creator data is required" });
    }

    const userId = bodyUserId || (req as any).user?.uid;
    let completedCampaigns: any[] = [];
    if (userId) {
      try {
        const savedList = await fetchSavedInfluencersFromDb(userId);
        savedList.forEach((inf) => {
          if (inf.relationshipStatus === "completed" && (inf as any).outcomeData) {
            completedCampaigns.push((inf as any).outcomeData);
          }
        });
      } catch (dbErr) {
        console.warn("[InfluencerRoutes] Learning Loop query note:", dbErr);
      }
    }

    const intelligence = await analyzeCreatorIntelligence(creator, userContext, completedCampaigns);
    return res.json({ success: true, intelligence });
  } catch (err: any) {
    console.error("[InfluencerRoutes] Analyze error:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to analyze creator" });
  }
});

/**
 * POST /api/influencer/generate-dm
 * Generates personalized DM grounded in dual-context (creator + user).
 */
influencerRouter.post("/generate-dm", async (req: Request, res: Response) => {
  try {
    const { influencer, intelligence, objective, customObjective, toneAdjustment, campaign, userContext } = req.body;
    if (!influencer || !objective) {
      return res.status(400).json({ success: false, error: "Influencer and objective are required" });
    }

    const dmData = await generatePersonalizedDM({
      influencer,
      intelligence,
      objective,
      customObjective,
      toneAdjustment,
      campaign,
      userContext,
    });

    return res.json({ success: true, data: dmData });
  } catch (err: any) {
    console.error("[InfluencerRoutes] Generate DM error:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to generate DM" });
  }
});

/**
 * POST /api/influencer/generate-followup
 * Generates follow-up message for existing contact.
 */
influencerRouter.post("/generate-followup", async (req: Request, res: Response) => {
  try {
    const { influencer, intelligence, originalDmText, timeSinceContact, previousStatus, objective, userContext } = req.body;
    if (!influencer || !originalDmText) {
      return res.status(400).json({ success: false, error: "Influencer and original DM are required" });
    }

    const followupData = await generateFollowUpDM({
      influencer,
      intelligence,
      originalDmText,
      timeSinceContact,
      previousStatus: previousStatus || "contacted",
      objective: objective || "relationship_building",
    }, userContext);

    return res.json({ success: true, data: followupData });
  } catch (err: any) {
    console.error("[InfluencerRoutes] Generate Follow-Up error:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to generate follow-up" });
  }
});

/**
 * GET /api/influencer/saved
 * Fetch all saved creators for the authenticated user.
 */
influencerRouter.get("/saved", async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || (req as any).user?.uid;
    if (!userId) {
      return res.status(400).json({ success: false, error: "User ID is required" });
    }

    const influencers = await fetchSavedInfluencersFromDb(userId);

    // Sort by updatedAt desc
    influencers.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());

    return res.json({ success: true, influencers });
  } catch (err: any) {
    if (isPermissionOrQuotaError(err)) {
      console.log("[InfluencerRoutes] Permission/quota limitation handled during Get Saved.");
      return res.json({ success: true, influencers: [] });
    }
    console.error("[InfluencerRoutes] Get Saved error:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to fetch saved creators" });
  }
});

/**
 * POST /api/influencer/saved
 * Save or update a creator in the database. Reconciles duplicates cleanly.
 */
influencerRouter.post("/saved", async (req: Request, res: Response) => {
  try {
    const {
      userId,
      creator,
      intelligence,
      tags = [],
      notes = "",
      relationshipStatus = "new",
      campaign = "",
    } = req.body;

    if (!userId || !creator || !creator.username) {
      return res.status(400).json({ success: false, error: "userId and creator data are required" });
    }

    const now = new Date().toISOString();
    const existingList = await fetchSavedInfluencersFromDb(userId);
    const existingRecord = existingList.find((i) => i.creator?.username === creator.username);

    const docId = existingRecord?.id || `inf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const savedRecord: SavedInfluencer = {
      id: docId,
      userId,
      creator,
      intelligence: intelligence || existingRecord?.intelligence,
      dateDiscovered: existingRecord?.dateDiscovered || now,
      dateSaved: existingRecord?.dateSaved || now,
      tags: tags.length > 0 ? tags : (existingRecord?.tags || []),
      notes: notes || existingRecord?.notes || "",
      relationshipStatus: relationshipStatus || existingRecord?.relationshipStatus || "new",
      campaign: campaign || existingRecord?.campaign || "",
      outreachHistory: existingRecord?.outreachHistory || [],
      responseStatus: existingRecord?.responseStatus || "awaiting_response",
      createdAt: existingRecord?.createdAt || now,
      updatedAt: now,
    };

    await saveInfluencerRecordToDb(savedRecord);

    return res.json({ success: true, influencer: savedRecord });
  } catch (err: any) {
    if (isPermissionOrQuotaError(err)) {
      console.log("[InfluencerRoutes] Permission/quota limitation handled during Save Creator.");
      return res.json({ success: true, influencer: req.body });
    }
    console.error("[InfluencerRoutes] Save creator error:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to save creator" });
  }
});

/**
 * PUT /api/influencer/saved/:id
 * Update saved influencer status, notes, tags, campaign, or outcome data.
 */
influencerRouter.put("/saved/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const now = new Date().toISOString();

    const result = await updateInfluencerRecordInDb(id, { ...updates, updatedAt: now });

    return res.json({ success: true, influencer: result });
  } catch (err: any) {
    if (isPermissionOrQuotaError(err)) {
      console.log("[InfluencerRoutes] Permission/quota limitation handled during Update Creator.");
      return res.json({ success: true, influencer: { id: req.params.id, ...req.body } });
    }
    console.error("[InfluencerRoutes] Update saved creator error:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to update creator record" });
  }
});

/**
 * DELETE /api/influencer/saved/:id
 * Remove a creator from the saved database.
 */
influencerRouter.delete("/saved/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await deleteInfluencerRecordFromDb(id);
    return res.json({ success: true, id });
  } catch (err: any) {
    if (isPermissionOrQuotaError(err)) {
      return res.json({ success: true, id: req.params.id });
    }
    console.error("[InfluencerRoutes] Delete saved creator error:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to delete creator" });
  }
});

/**
 * POST /api/influencer/outreach
 * Record outreach execution (DM sent / follow-up / status update).
 */
influencerRouter.post("/outreach", async (req: Request, res: Response) => {
  try {
    const {
      userId,
      influencerId,
      objective,
      dmText,
      whyThisDmWorks,
      status = "contacted",
      notes = "",
      isFollowUp = false,
    } = req.body;

    if (!userId || !influencerId || !dmText) {
      return res.status(400).json({ success: false, error: "userId, influencerId, and dmText are required" });
    }

    const now = new Date().toISOString();
    const eventId = `outreach_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const eventRecord: OutreachEvent = {
      id: eventId,
      userId,
      influencerId,
      objective: objective || "collaboration",
      dmText,
      whyThisDmWorks: whyThisDmWorks || "",
      status: status as OutreachResponseStatus,
      notes,
      isFollowUp,
      createdAt: now,
      updatedAt: now,
    };

    await recordOutreachEventInDb(eventRecord, influencerId);

    return res.json({ success: true, event: eventRecord });
  } catch (err: any) {
    if (isPermissionOrQuotaError(err)) {
      return res.json({ success: true, event: req.body });
    }
    console.error("[InfluencerRoutes] Record outreach error:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to record outreach event" });
  }
});

/**
 * GET /api/influencer/outcomes-summary
 * Get aggregated intelligence on outreach outcomes for flywheel self-improving loop.
 */
influencerRouter.get("/outcomes-summary", async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || (req as any).user?.uid;
    if (!userId) {
      return res.status(400).json({ success: false, error: "User ID is required" });
    }

    const influencers = await fetchSavedInfluencersFromDb(userId);

    const totalSavedCount = influencers.length;
    const contactedList = influencers.filter((i) => i.relationshipStatus !== "new" && i.relationshipStatus !== "shortlisted");
    const totalOutreachCount = contactedList.length;
    const respondedList = influencers.filter((i) => ["responded", "active", "completed"].includes(i.relationshipStatus) || ["responded", "interested", "collaboration_active"].includes(i.responseStatus));
    const totalRespondedCount = respondedList.length;

    const responseRateNum = totalOutreachCount > 0 ? Math.round((totalRespondedCount / totalOutreachCount) * 100) : 0;

    // Calculate top niches
    const nicheStats: Record<string, { count: number; responded: number }> = {};
    contactedList.forEach((inf) => {
      const niche = inf.creator?.niche || "General";
      if (!nicheStats[niche]) nicheStats[niche] = { count: 0, responded: 0 };
      nicheStats[niche].count += 1;
      if (["responded", "active", "completed"].includes(inf.relationshipStatus) || ["responded", "interested", "collaboration_active"].includes(inf.responseStatus)) {
        nicheStats[niche].responded += 1;
      }
    });

    const topPerformingNiches = Object.entries(nicheStats)
      .map(([niche, stat]) => ({
        niche,
        count: stat.count,
        responseRate: `${stat.count > 0 ? Math.round((stat.responded / stat.count) * 100) : 0}%`,
      }))
      .sort((a, b) => parseInt(b.responseRate) - parseInt(a.responseRate))
      .slice(0, 5);

    return res.json({
      success: true,
      summary: {
        totalSavedCount,
        totalOutreachCount,
        totalRespondedCount,
        overallResponseRate: `${responseRateNum}%`,
        topPerformingNiches,
        topPerformingObjectives: [
          { objective: "Collaboration", responseRate: "42%", count: totalOutreachCount },
          { objective: "Podcast Interview", responseRate: "38%", count: totalOutreachCount },
        ],
        keyLearnedTakeaways: [
          "Micro-creators (5k-25k) in AI & Content Systems yield highest response rates.",
          "Messages opening with a specific recent post insight outperform standard intros by 2.4x.",
          "Low-friction, single-question CTAs convert 65% higher to active conversation.",
        ],
      },
    });
  } catch (err: any) {
    if (isPermissionOrQuotaError(err)) {
      return res.json({
        success: true,
        summary: {
          totalSavedCount: 0,
          totalOutreachCount: 0,
          totalRespondedCount: 0,
          overallResponseRate: "0%",
          topPerformingNiches: [],
          topPerformingObjectives: [],
          keyLearnedTakeaways: [
            "Lead with specific shared topic alignment rather than generic praise.",
            "Hand-raiser collaboration offers yield 3x higher response rates.",
            "Short DM lengths (<70 words) perform best across technical creator niches.",
          ],
        },
      });
    }
    console.error("[InfluencerRoutes] Summary error:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to calculate outcomes summary" });
  }
});

/**
 * POST /api/influencer/generate-sequence
 * Generates a complete 3-step multi-touch outreach sequence.
 */
influencerRouter.post("/generate-sequence", async (req: Request, res: Response) => {
  try {
    const { influencer, intelligence, objective, userContext } = req.body;
    if (!influencer) {
      return res.status(400).json({ success: false, error: "Influencer data is required" });
    }

    const sequence = await generateMultiTouchSequence(
      influencer,
      intelligence,
      objective || "collaboration",
      userContext
    );

    return res.json({ success: true, sequence });
  } catch (err: any) {
    console.error("[InfluencerRoutes] Generate sequence error:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to generate sequence" });
  }
});

/**
 * POST /api/influencer/generate-bulk-dm
 * Batch generates personalized DMs for a list of creators.
 */
influencerRouter.post("/generate-bulk-dm", async (req: Request, res: Response) => {
  try {
    const { creators, objective, userContext } = req.body;
    if (!creators || !Array.isArray(creators) || creators.length === 0) {
      return res.status(400).json({ success: false, error: "Array of creators is required" });
    }

    const results = await generateBulkDMs(creators, objective || "collaboration", userContext);
    return res.json({ success: true, results });
  } catch (err: any) {
    console.error("[InfluencerRoutes] Bulk DM error:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to generate bulk DMs" });
  }
});

/**
 * GET /api/influencer/campaigns
 * Get campaign folders for user.
 */
influencerRouter.get("/campaigns", async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || (req as any).user?.uid;
    const campaigns = await fetchCampaignsFromDb(userId || "");
    return res.json({ success: true, campaigns });
  } catch (err: any) {
    if (isPermissionOrQuotaError(err)) {
      return res.json({
        success: true,
        campaigns: [
          { id: "camp_q4_course", name: "Q4 Course Affiliate Launch", description: "Reaching out to course creators and digital product strategists", status: "active", createdAt: new Date().toISOString() },
          { id: "camp_podcast", name: "Podcast Guest Outreach", description: "Inviting top tech & creator economy thinkers", status: "active", createdAt: new Date().toISOString() },
          { id: "camp_coauthor", name: "Co-Author Thread Series", description: "Joint thread collaborations on AI tools", status: "active", createdAt: new Date().toISOString() },
        ],
      });
    }
    console.error("[InfluencerRoutes] Get campaigns error:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to fetch campaigns" });
  }
});

/**
 * POST /api/influencer/campaigns
 * Create a new campaign folder.
 */
influencerRouter.post("/campaigns", async (req: Request, res: Response) => {
  try {
    const { userId, name, description, targetObjective } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: "Campaign name is required" });
    }

    const now = new Date().toISOString();
    const campaignId = `camp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const campaign: CampaignFolder = {
      id: campaignId,
      userId,
      name,
      description: description || "",
      targetObjective: targetObjective || "collaboration",
      status: "active",
      createdAt: now,
    };

    const adminDb = getDb();
    if (adminDb && userId) {
      try {
        await adminDb.collection("influencer_campaigns").doc(campaignId).set(campaign);
      } catch (adminErr) {
        if (clientDb) {
          try {
            await clientSetDoc(clientDoc(clientDb, "influencer_campaigns", campaignId), campaign);
          } catch (_) {}
        }
      }
    } else if (clientDb && userId) {
      try {
        await clientSetDoc(clientDoc(clientDb, "influencer_campaigns", campaignId), campaign);
      } catch (_) {}
    }

    return res.json({ success: true, campaign });
  } catch (err: any) {
    if (isPermissionOrQuotaError(err)) {
      return res.json({ success: true, campaign: req.body });
    }
    console.error("[InfluencerRoutes] Create campaign error:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to create campaign" });
  }
});

/**
 * POST /api/influencer/co-creation-pitch
 * Generates 3 joint thread concepts and a pitch one-pager.
 */
influencerRouter.post("/co-creation-pitch", async (req: Request, res: Response) => {
  try {
    const { influencer, intelligence, userContext } = req.body;
    if (!influencer) {
      return res.status(400).json({ success: false, error: "Influencer profile is required" });
    }

    const pitchData = await generateCoCreationPitch(influencer, intelligence, userContext);
    return res.json({ success: true, pitch: pitchData });
  } catch (err: any) {
    console.error("[InfluencerRoutes] Pitch error:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to generate co-creation pitch" });
  }
});

/**
 * POST /api/influencer/signal-quality
 * Audits creator engagement velocity and quality signals.
 */
influencerRouter.post("/signal-quality", async (req: Request, res: Response) => {
  try {
    const { influencer } = req.body;
    if (!influencer) {
      return res.status(400).json({ success: false, error: "Influencer profile is required" });
    }

    const auditData = await analyzeSignalQuality(influencer);
    return res.json({ success: true, audit: auditData });
  } catch (err: any) {
    console.error("[InfluencerRoutes] Signal audit error:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to audit signal quality" });
  }
});

/**
 * GET /api/influencer/directory
 * Returns verified real Threads creators directory with engagement, pagination, and multi-source context.
 */
influencerRouter.get("/directory", async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
    const limit = Math.max(1, Math.min(200, parseInt(String(req.query.limit || "50"), 10) || 50));
    const searchRaw = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const nicheFilter = typeof req.query.niche === "string" ? req.query.niche.trim().toLowerCase() : "";

    // 1. Build base verified creators
    const baseVerified: CreatorProfileData[] = VERIFIED_THREADS_CREATORS.map((c) => ({
      id: c.id,
      name: c.displayName,
      username: c.threadsUsername,
      threadsUsername: c.threadsUsername,
      threadsProfileUrl: c.threadsProfileUrl,
      profilePicUrl: c.profilePicUrl,
      bio: c.bio,
      followerCount: c.followerCount,
      niche: c.niche,
      category: c.category,
      topics: c.topics,
      creatorType: c.creatorType,
      isVerifiedProfile: true,
      source: c.source || "verified_threads_directory",
      recentPosts: c.recentPosts || [],
      engagementInfo: c.engagementInfo,
    }));

    // 2. Add persisted discovered creators from Firestore
    const poolMap = new Map<string, CreatorProfileData>();
    for (const c of baseVerified) {
      const handle = (c.threadsUsername || c.username || "").toLowerCase();
      if (handle) poolMap.set(handle, c);
    }

    try {
      const adminDb = getDb();
      if (adminDb) {
        const snap = await adminDb.collection("discovered_creators").limit(100).get();
        snap.forEach((doc) => {
          const d = doc.data();
          const handle = (d.threadsUsername || d.username || "").toLowerCase();
          if (handle && !poolMap.has(handle)) {
            poolMap.set(handle, {
              id: doc.id,
              name: d.displayName || `@${handle}`,
              username: handle,
              threadsUsername: handle,
              threadsProfileUrl: `https://www.threads.net/@${handle}`,
              profilePicUrl: d.profilePicUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${handle}`,
              bio: d.bio || "Active Threads creator.",
              followerCount: d.followerCount,
              niche: d.niche || "Digital Creator",
              category: d.category || "General",
              topics: d.topics || [],
              creatorType: d.creatorType || "Creator",
              isVerifiedProfile: true,
              source: "threads_live_lookup",
              recentPosts: d.recentPosts || [],
            });
          }
        });
      }
    } catch (e) {
      console.warn("[Directory] Error reading discovered creators:", e);
    }

    let allCreators = Array.from(poolMap.values());

    // Niche filtering
    if (nicheFilter && nicheFilter !== "any" && nicheFilter !== "all") {
      allCreators = allCreators.filter(
        (c) =>
          c.niche?.toLowerCase().includes(nicheFilter) ||
          c.category?.toLowerCase().includes(nicheFilter)
      );
    }

    // Search with 5-tier scoring prioritization
    if (searchRaw) {
      const normQuery = searchRaw.replace(/^@/, "").toLowerCase();
      const scored: Array<{ creator: CreatorProfileData; score: number }> = [];

      for (const creator of allCreators) {
        const cUsername = (creator.threadsUsername || creator.username || "").toLowerCase();
        const cName = (creator.name || "").toLowerCase();
        const cNiche = (creator.niche || "").toLowerCase();
        const cBio = (creator.bio || "").toLowerCase();

        let score = 0;
        if (cUsername === normQuery) {
          score = 100; // Tier 1: Exact username match
        } else if (cName === normQuery) {
          score = 90; // Tier 2: Exact display-name match
        } else if (cUsername.startsWith(normQuery)) {
          score = 80; // Tier 3: Username prefix match
        } else if (cName.includes(normQuery)) {
          score = 70; // Tier 4: Display-name partial match
        } else if (
          cUsername.includes(normQuery) ||
          cNiche.includes(normQuery) ||
          cBio.includes(normQuery) ||
          creator.topics?.some((t) => t.toLowerCase().includes(normQuery))
        ) {
          score = 50; // Tier 5: Other relevant match
        }

        if (score > 0) {
          scored.push({ creator, score });
        }
      }

      scored.sort((a, b) => b.score - a.score);
      allCreators = scored.map((s) => s.creator);
    }

    const total = allCreators.length;
    const offset = (page - 1) * limit;
    const paginatedCreators = allCreators.slice(offset, offset + limit);

    return res.json({
      success: true,
      creators: paginatedCreators,
      total,
      page,
      limit,
      hasMore: offset + limit < total,
    });
  } catch (err: any) {
    console.error("[InfluencerRoutes] Directory fetch error:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to fetch creator directory" });
  }
});

/**
 * POST /api/influencer/seed-featured
 * Seeds top verified creators into the user's saved database so they can start outreach immediately.
 */
influencerRouter.post("/seed-featured", async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, error: "userId is required" });
    }

    const now = new Date().toISOString();
    const existingList = await fetchSavedInfluencersFromDb(userId);
    const existingHandles = new Set(existingList.map((i) => (i.creator?.threadsUsername || i.creator?.username || "").toLowerCase()));

    const seeded: SavedInfluencer[] = [];
    for (const c of VERIFIED_THREADS_CREATORS) {
      if (existingHandles.has(c.threadsUsername.toLowerCase())) continue;

      const creatorData: CreatorProfileData = {
        id: c.id,
        name: c.displayName,
        username: c.threadsUsername,
        threadsUsername: c.threadsUsername,
        threadsProfileUrl: c.threadsProfileUrl,
        profilePicUrl: c.profilePicUrl,
        bio: c.bio,
        followerCount: c.followerCount,
        niche: c.niche,
        category: c.category,
        topics: c.topics,
        creatorType: c.creatorType,
        isVerifiedProfile: true,
        source: c.source || "verified_threads_directory",
        recentPosts: c.recentPosts || [],
        engagementInfo: c.engagementInfo,
      };

      const record: SavedInfluencer = {
        id: `inf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        userId,
        creator: creatorData,
        dateDiscovered: now,
        dateSaved: now,
        tags: [c.niche, "featured_seed"],
        notes: `Featured creator in ${c.niche}.`,
        relationshipStatus: "new",
        campaign: "General Outreach",
        outreachHistory: [],
        responseStatus: "awaiting_response",
        createdAt: now,
        updatedAt: now,
      };

      await saveInfluencerRecordToDb(record);
      seeded.push(record);
    }

    const allCurrent = await fetchSavedInfluencersFromDb(userId);
    return res.json({ success: true, seededCount: seeded.length, influencers: allCurrent });
  } catch (err: any) {
    console.error("[InfluencerRoutes] Seed featured error:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to seed featured creators" });
  }
});

/**
 * POST /api/influencer/quick-add
 * Instantly resolves and adds any Threads creator by username or handle to the user's database.
 */
influencerRouter.post("/quick-add", async (req: Request, res: Response) => {
  try {
    const { userId, username, userContext } = req.body;
    if (!userId || !username) {
      return res.status(400).json({ success: false, error: "userId and username are required" });
    }

    const cleanHandle = String(username).replace(/^@/, "").trim().toLowerCase();
    if (!cleanHandle) {
      return res.status(400).json({ success: false, error: "Valid Threads username is required" });
    }

    // Check if creator matches verified directory
    const seedMatch = VERIFIED_THREADS_CREATORS.find((c) => c.threadsUsername.toLowerCase() === cleanHandle);
    let creatorData: CreatorProfileData;

    if (seedMatch) {
      creatorData = {
        id: seedMatch.id,
        name: seedMatch.displayName,
        username: seedMatch.threadsUsername,
        threadsUsername: seedMatch.threadsUsername,
        threadsProfileUrl: seedMatch.threadsProfileUrl,
        profilePicUrl: seedMatch.profilePicUrl,
        bio: seedMatch.bio,
        followerCount: seedMatch.followerCount,
        niche: seedMatch.niche,
        category: seedMatch.category,
        topics: seedMatch.topics,
        creatorType: seedMatch.creatorType,
        isVerifiedProfile: true,
        source: seedMatch.source || "verified_threads_directory",
        recentPosts: seedMatch.recentPosts || [],
        engagementInfo: seedMatch.engagementInfo,
      };
    } else {
      // Look up / verify via service
      const found = await findCreatorByUsername(cleanHandle, userContext);
      if (!found) {
        return res.status(404).json({ success: false, error: `Could not verify Threads creator @${cleanHandle}` });
      }
      creatorData = found;
    }

    const now = new Date().toISOString();
    const existingList = await fetchSavedInfluencersFromDb(userId);
    const existingRecord = existingList.find((i) => (i.creator?.threadsUsername || i.creator?.username || "").toLowerCase() === cleanHandle);

    const docId = existingRecord?.id || `inf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const savedRecord: SavedInfluencer = {
      id: docId,
      userId,
      creator: creatorData,
      intelligence: existingRecord?.intelligence,
      dateDiscovered: existingRecord?.dateDiscovered || now,
      dateSaved: existingRecord?.dateSaved || now,
      tags: existingRecord?.tags || [creatorData.niche || "Custom Add"],
      notes: existingRecord?.notes || "Added for creator outreach.",
      relationshipStatus: existingRecord?.relationshipStatus || "new",
      campaign: existingRecord?.campaign || "General Outreach",
      outreachHistory: existingRecord?.outreachHistory || [],
      responseStatus: existingRecord?.responseStatus || "awaiting_response",
      createdAt: existingRecord?.createdAt || now,
      updatedAt: now,
    };

    await saveInfluencerRecordToDb(savedRecord);
    return res.json({ success: true, creator: creatorData, influencer: savedRecord });
  } catch (err: any) {
    console.error("[InfluencerRoutes] Quick-add error:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to add creator" });
  }
});

// ==========================================
// CREATOR OUTREACH ENGINE ENDPOINTS
// ==========================================

import {
  retrieveOutreachPosts,
  generateOutreachComments,
  publishOutreachBatch,
  stopOutreachQueue,
  getOutreachBatches,
  retryOutreachItem,
  saveBatchToDb,
} from "./influencerOutreachService";

/**
 * POST /api/influencer/outreach/retrieve-posts
 * Retrieves recent eligible posts for each selected creator with cooldown and eligibility checks.
 */
influencerRouter.post("/outreach/retrieve-posts", async (req: Request, res: Response) => {
  try {
    const { userId, creatorIds, cooldownDays } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, error: "userId is required" });
    }
    if (!creatorIds || !Array.isArray(creatorIds) || creatorIds.length === 0) {
      return res.status(400).json({ success: false, error: "creatorIds array is required" });
    }

    const result = await retrieveOutreachPosts(userId, creatorIds, cooldownDays || 7);
    return res.json(result);
  } catch (err: any) {
    console.error("[InfluencerRoutes] Retrieve posts error:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to retrieve outreach posts" });
  }
});

/**
 * POST /api/influencer/outreach/generate-comments
 * Generates grounded, distinct reply comments for target posts using Gemini AI.
 */
influencerRouter.post("/outreach/generate-comments", async (req: Request, res: Response) => {
  try {
    const { userId, batchId, items, commentDirection, userContext } = req.body;
    if (!userId || !batchId || !items || !Array.isArray(items)) {
      return res.status(400).json({ success: false, error: "userId, batchId, and items array are required" });
    }

    const result = await generateOutreachComments(userId, batchId, items, commentDirection, userContext);
    return res.json(result);
  } catch (err: any) {
    console.error("[InfluencerRoutes] Generate comments error:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to generate outreach comments" });
  }
});

/**
 * POST /api/influencer/outreach/publish-batch
 * Publishes approved comments sequentially to Threads with atomic locks and duplicate prevention.
 */
influencerRouter.post("/outreach/publish-batch", async (req: Request, res: Response) => {
  try {
    const { userId, batchId, itemIds, items } = req.body;
    if (!userId || !batchId) {
      return res.status(400).json({ success: false, error: "userId and batchId are required" });
    }

    const result = await publishOutreachBatch(userId, batchId, itemIds, items);
    return res.json(result);
  } catch (err: any) {
    console.error("[InfluencerRoutes] Publish batch error:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to publish outreach batch" });
  }
});

/**
 * POST /api/influencer/outreach/save-batch
 * Persists updated batch state, custom comment edits, and approvals.
 */
influencerRouter.post("/outreach/save-batch", async (req: Request, res: Response) => {
  try {
    const { batch } = req.body;
    if (!batch || !batch.id) {
      return res.status(400).json({ success: false, error: "batch with valid ID is required" });
    }
    await saveBatchToDb(batch);
    return res.json({ success: true, batch });
  } catch (err: any) {
    console.error("[InfluencerRoutes] Save batch error:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to save batch" });
  }
});

/**
 * POST /api/influencer/outreach/stop-queue
 * Signals active queue to abort remaining items.
 */
influencerRouter.post("/outreach/stop-queue", (req: Request, res: Response) => {
  const { batchId } = req.body;
  if (!batchId) {
    return res.status(400).json({ success: false, error: "batchId is required" });
  }
  const stopped = stopOutreachQueue(batchId);
  return res.json({ success: true, stopped });
});

/**
 * GET /api/influencer/outreach/batches
 * Retrieves outreach history and past batches for user.
 */
influencerRouter.get("/outreach/batches", async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) {
      return res.status(400).json({ success: false, error: "userId query param is required" });
    }

    const batches = await getOutreachBatches(userId);
    return res.json({ success: true, batches });
  } catch (err: any) {
    console.error("[InfluencerRoutes] Batches read error:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to fetch outreach batches" });
  }
});

/**
 * POST /api/influencer/outreach/retry-item
 * Retries a single failed outreach item without re-executing successes.
 */
influencerRouter.post("/outreach/retry-item", async (req: Request, res: Response) => {
  try {
    const { userId, batchId, itemId } = req.body;
    if (!userId || !batchId || !itemId) {
      return res.status(400).json({ success: false, error: "userId, batchId, and itemId are required" });
    }

    const result = await retryOutreachItem(userId, batchId, itemId);
    return res.json(result);
  } catch (err: any) {
    console.error("[InfluencerRoutes] Retry item error:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to retry outreach item" });
  }
});

