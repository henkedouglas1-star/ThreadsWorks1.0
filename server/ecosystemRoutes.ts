import express from "express";
import { randomUUID } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import type { Auth } from "firebase-admin/auth";
import { getAI, callGenerateContentWithRetry } from "./geminiClient";
import {
  checkAndReserveGeneration,
  commitGeneration,
  releaseReservation
} from "./generationLimitService";
import {
  IntelligenceIntegrityError,
  ProjectOwnershipError,
  contributeSharedIntelligence,
  getSharedIntelligenceHubSummary,
  retrieveSharedIntelligenceContext
} from "./sharedIntelligenceService";
import {
  BusinessProfileAccessError,
  BusinessProfileValidationError,
  checkFounderPresetCapability,
  getFounderBusinessProfilePreset,
  loadBusinessProfile,
  saveBusinessProfile,
  syncCreatorWorksToBusinessProfile
} from "./businessProfileService";
import {
  APP_BUSINESS_CONTEXT_CONFIG,
  BILLING_AUTHORITY_NOTICE,
  DEFAULT_BUSINESS_ID
} from "../src/types/businessProfile";
import {
  computeFirstSaleEngineState,
  evaluateAutomationPolicy,
  isEligibleVerifiedCreatorSale,
  validateAffiliateReferral,
  type AutomationActionType,
  type VerifiedSaleCandidate
} from "./ecosystemDomainLogic";
import { getToolDefinition } from "../src/data/ecosystemToolRegistry";
import { readMembershipAccess } from "./membershipAccessService";
import { createMembershipCheckoutIntent } from "./membershipCheckoutIntent";

interface AuthedCaller {
  uid: string;
  email?: string;
  claims?: Record<string, unknown>;
}

const aiRateWindows = new Map<string, number[]>();
const AI_RATE_LIMIT_PER_MIN = 30;

function checkAiRateLimit(uid: string): boolean {
  const now = Date.now();
  const recent = (aiRateWindows.get(uid) || []).filter((ts) => now - ts < 60_000);
  if (recent.length >= AI_RATE_LIMIT_PER_MIN) {
    aiRateWindows.set(uid, recent);
    return false;
  }
  recent.push(now);
  aiRateWindows.set(uid, recent);
  return true;
}

async function verifyCaller(auth: Auth, req: express.Request): Promise<AuthedCaller | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  try {
    const decoded = await auth.verifyIdToken(header.slice(7));
    return {
      uid: decoded.uid,
      email: decoded.email,
      claims: decoded as unknown as Record<string, unknown>
    };
  } catch {
    return null;
  }
}

function cleanString(val: unknown, maxLen = 2000): string {
  return typeof val === "string" ? val.trim().slice(0, maxLen) : "";
}

export function createEcosystemRouter(db: Firestore, auth: Auth) {
  const router = express.Router();

  // Require valid Firebase ID token on EVERY ecosystem route
  router.use(async (req, res, next) => {
    const caller = await verifyCaller(auth, req);
    if (!caller) {
      return res.status(401).json({ error: "Authentication required to access ContentPaysUs workspace tools." });
    }
    (req as any).caller = caller;
    return next();
  });

  // =========================================================================
  // 0. BUSINESS PROFILE & SHARED INTELLIGENCE HUB ROUTES (Commercial Foundation 1)
  // =========================================================================
  // Scoped billing is read from server-owned subscription records only.
  router.get("/memberships/access", async (req, res) => {
    const caller = (req as any).caller as AuthedCaller;
    res.set("Cache-Control", "no-store");
    try {
      return res.json(await readMembershipAccess(db, caller.uid));
    } catch {
      return res.status(503).json({ error: "Membership access could not be verified." });
    }
  });

  router.post("/memberships/checkout", async (req, res) => {
    const caller = (req as any).caller as AuthedCaller;
    const planId = req.body?.planId;
    if (planId !== "contentpaysclub" && planId !== "contentpaysbundle") {
      return res.status(400).json({ error: "Choose a valid membership." });
    }
    if (process.env.MEMBERSHIP_CHECKOUT_ENABLED !== "true") {
      return res.status(503).json({ error: "Membership checkout is not available yet." });
    }
    if (!checkAiRateLimit(caller.uid)) return res.status(429).json({ error: "Too many requests." });
    res.set("Cache-Control", "no-store");
    try {
      const access = await readMembershipAccess(db, caller.uid);
      if (access.planIds.includes(planId) || (planId === "contentpaysclub" && access.planIds.includes("contentpaysbundle"))) {
        return res.status(409).json({ error: "Your membership already includes this access." });
      }
      return res.json(await createMembershipCheckoutIntent(db, caller.uid, planId));
    } catch {
      return res.status(503).json({ error: "Membership checkout could not be initialized." });
    }
  });

  router.get("/business-profile", async (req, res) => {
    const caller = (req as any).caller as AuthedCaller;
    const businessId = cleanString(req.query.businessId, 64) || DEFAULT_BUSINESS_ID;
    try {
      const [loaded, canUseFounderPreset] = await Promise.all([
        loadBusinessProfile(db, caller.uid, businessId),
        checkFounderPresetCapability(db, caller)
      ]);
      return res.json({
        success: true,
        profile: loaded.profile,
        source: loaded.source,
        hasSavedBusinessProfile: loaded.hasSavedBusinessProfile,
        canUseFounderPreset,
        billingAuthorityNotice: BILLING_AUTHORITY_NOTICE
      });
    } catch (err: any) {
      if (err instanceof BusinessProfileAccessError) {
        return res.status(403).json({ error: err.message });
      }
      return res.status(500).json({ error: err?.message || "Failed to load business profile." });
    }
  });

  router.put("/business-profile", async (req, res) => {
    const caller = (req as any).caller as AuthedCaller;
    const businessId = cleanString(req.body?.businessId || req.query.businessId, 64) || DEFAULT_BUSINESS_ID;
    try {
      const result = await saveBusinessProfile(db, caller.uid, req.body, businessId);
      return res.json({
        success: true,
        profile: result.profile,
        legacySynced: result.legacySynced,
        billingAuthorityNotice: result.billingAuthorityNotice
      });
    } catch (err: any) {
      if (err instanceof BusinessProfileAccessError) {
        return res.status(403).json({ error: err.message });
      }
      if (err instanceof BusinessProfileValidationError) {
        return res.status(400).json({ error: err.message, errors: err.errors });
      }
      return res.status(500).json({ error: err?.message || "Failed to save business profile." });
    }
  });

  router.get("/business-profile/founder-preset", async (req, res) => {
    const caller = (req as any).caller as AuthedCaller;
    try {
      const result = await getFounderBusinessProfilePreset(db, caller);
      return res.json({ success: true, ...result });
    } catch (err: any) {
      if (err instanceof BusinessProfileAccessError) {
        return res.status(403).json({ error: err.message });
      }
      return res.status(500).json({ error: err?.message || "Failed to load founder configuration preset." });
    }
  });

  router.get("/intelligence/hub-summary", async (req, res) => {
    const caller = (req as any).caller as AuthedCaller;
    const businessId = cleanString(req.query.businessId, 64) || DEFAULT_BUSINESS_ID;
    try {
      const summary = await getSharedIntelligenceHubSummary(caller.uid, db, businessId);
      return res.json({ success: true, summary });
    } catch (err: any) {
      if (err instanceof BusinessProfileAccessError) {
        return res.status(403).json({ error: err.message });
      }
      return res.status(500).json({ error: err?.message || "Failed to load Shared Intelligence summary." });
    }
  });

  // =========================================================================
  // 1. UNIVERSAL TOOL EXECUTION ENGINE (Reuses Gemini + Shared Intelligence)
  // =========================================================================
  router.post("/run-tool", async (req, res) => {
    const caller = (req as any).caller as AuthedCaller;
    const { appId, toolId, inputs, projectId, productId, refinementMode } = (req.body || {}) as {
      appId?: string;
      toolId?: string;
      inputs?: Record<string, string>;
      projectId?: string;
      productId?: string;
      refinementMode?: "default" | "tighten" | "expand";
    };

    if (!appId || !toolId) {
      return res.status(400).json({ error: "Both appId and toolId are required." });
    }

    const tool = getToolDefinition(appId, toolId);
    if (!tool) {
      return res.status(404).json({ error: `Tool "${toolId}" is not registered under "${appId}".` });
    }

    // Honest feature gating for tools requiring unconfigured external providers
    if (tool.availability !== "Available") {
      return res.status(501).json({
        error: tool.availabilityNote || `${tool.name} is currently ${tool.availability} and requires external integration setup.`,
        availability: tool.availability
      });
    }

    if (tool.mode === "operational" && tool.outputSchema.length === 0) {
      return res.status(400).json({ error: `${tool.name} is an operational workspace module, not a text generator.` });
    }

    // Validate required inputs
    const safeInputs: Record<string, string> = {};
    for (const field of [...tool.requiredInputs, ...tool.optionalInputs]) {
      const value = cleanString(inputs?.[field.key], 4000);
      safeInputs[field.key] = value;
      if (tool.requiredInputs.some((r) => r.key === field.key) && !value) {
        return res.status(400).json({ error: `Missing required input: ${field.label}` });
      }
    }

    if (!checkAiRateLimit(caller.uid)) {
      return res.status(429).json({ error: "Rate limit exceeded. Please wait a minute before running more AI tools." });
    }

    // Enforce monthly generation quota (Pro = unlimited, Free = 150/month)
    const quota = await checkAndReserveGeneration(db, caller.uid, caller.email);
    if (!quota.allowed) {
      return res.status(403).json({
        error: quota.error || "Monthly AI generation allowance reached.",
        usage: quota
      });
    }

    try {
      const appContextConfig = APP_BUSINESS_CONTEXT_CONFIG[String(appId || "").toLowerCase()];
      const mergedDomains = Array.from(
        new Set([
          ...(appContextConfig?.domains || ["identity", "business", "audience"]),
          ...(tool.autoContextDomains || [])
        ])
      );

      const intelligence = await retrieveSharedIntelligenceContext(
        {
          userId: caller.uid,
          appId,
          projectId: projectId || undefined,
          taskType: toolId,
          domains: mergedDomains
        },
        db
      );

      let selectedProductNote = "";
      if (productId && intelligence.savedProducts?.items) {
        const match = intelligence.savedProducts.items.find((p) => p.id === productId);
        if (match) {
          selectedProductNote = `Selected ProductWorks Asset: ${match.title}${match.subtitle ? ` — ${match.subtitle}` : ""}${match.price ? ` (Price: ${match.price})` : ""}`;
        }
      }

      const schemaTemplate = Object.fromEntries(
        tool.outputSchema.map((field) => [field.key, `Detailed, practical, editable content for ${field.label}`])
      );

      const refinementInstruction =
        refinementMode === "tighten"
          ? "REFINEMENT MODE: Make every section significantly tighter, punchier, and more concise."
          : refinementMode === "expand"
          ? "REFINEMENT MODE: Expand each section with deeper practical steps and concrete working checklists."
          : "";

      const prompt = [
        `You are executing the ContentPaysUs tool "${tool.name}" inside application "${appId}".`,
        `Tool Intent: ${tool.intent}`,
        `Instructions: ${tool.aiInstructions}`,
        "PRESENTATION STANDARD: Write in clear everyday language for a first-time creator. Lead each section with its main takeaway, then use short paragraphs, concise bullets or numbered steps where useful. Use simple Markdown headings, bold emphasis, and tables only when they improve comprehension. Avoid repeated information, business jargon, invented facts, and excessive formatting. Preserve exact quotes and any requested technical or creative artifact. Distinguish user-supplied evidence from AI hypotheses; when evidence is missing, say so and suggest a practical way to check it. Keep the requested JSON keys and string values unchanged.",
        "OFFERING INTEGRITY RULE: Explicitly distinguish AVAILABLE offerings from PLANNED offerings. NEVER describe planned or in-development offerings as live, launched, or currently available for purchase. NEVER invent revenue, sales, customer counts, testimonials, or unverified metrics.",
        refinementInstruction,
        appId === "projectz"
          ? "ISOLATION NOTICE: Clearly label all outputs as HYPOTHETICAL SANDBOX EXPERIMENTS."
          : "",
        "",
        "SHARED CREATOR & BUSINESS INTELLIGENCE (Strictly real user-provided facts and verified platform data — do NOT fabricate missing details):",
        JSON.stringify(
          {
            identity: intelligence.creatorIdentity,
            audience: intelligence.audienceProfile,
            business: intelligence.businessContext,
            activeProject: intelligence.activeProject,
            selectedProduct: selectedProductNote || undefined,
            realPerformance: intelligence.performanceSignals?.hasRealMetrics
              ? intelligence.performanceSignals
              : "No synced analytics metrics yet — do NOT invent metrics.",
            recentContributions: intelligence.savedContributions.slice(0, 5)
          },
          null,
          2
        ),
        "",
        "USER INPUTS (Explicit user inputs always take priority over saved defaults):",
        JSON.stringify(safeInputs, null, 2),
        "",
        "Return ONLY valid JSON with these exact string keys (use clean Markdown formatting inside each string value):",
        JSON.stringify(schemaTemplate, null, 2)
      ]
        .filter(Boolean)
        .join("\n");

      const model = process.env.ECOSYSTEM_AI_MODEL || "gemini-4-hydrogen";
      const aiResponse = await callGenerateContentWithRetry(
        getAI(),
        {
          model,
          contents: prompt,
          config: { responseMimeType: "application/json" },
          strictContentGeneration: true
        },
        2
      );

      const raw = typeof aiResponse?.text === "string" ? aiResponse.text : "";
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) {
        throw new Error("The AI engine returned an unreadable response. Please retry.");
      }

      const parsedJson = JSON.parse(match[0]) as Record<string, unknown>;
      const sections: Record<string, string> = {};
      for (const field of tool.outputSchema) {
        const val = parsedJson[field.key];
        sections[field.key] =
          typeof val === "string"
            ? val.trim()
            : val !== undefined && val !== null
            ? JSON.stringify(val, null, 2)
            : "";
      }

      if (!quota.isPro) {
        await commitGeneration(db, caller.uid, quota.reservationId);
      }

      return res.json({
        success: true,
        appId,
        toolId,
        toolName: tool.name,
        provenance: tool.provenanceDefault,
        isolatedExperiment: appId === "projectz",
        sections,
        contextUsed: {
          domainsLoaded: intelligence.metadata.domainsLoaded,
          hasProfileData: Boolean(intelligence.creatorIdentity?.hasProfileData),
          hasRealMetrics: Boolean(intelligence.performanceSignals?.hasRealMetrics),
          activeProjectName: intelligence.activeProject?.name || null
        },
        usage: {
          isPro: quota.isPro,
          displayRemaining: quota.displayRemaining
        }
      });
    } catch (err: any) {
      if (!quota.isPro) {
        await releaseReservation(db, caller.uid, quota.reservationId);
      }
      if (err instanceof ProjectOwnershipError) {
        return res.status(403).json({ error: err.message });
      }
      return res.status(502).json({
        error: err?.message || "Tool execution failed. Your allowance was released."
      });
    }
  });

  // =========================================================================
  // 2. PERSISTENT ECOSYSTEM ASSETS (CRUD + Version History + Profile Sync)
  // =========================================================================
  router.get("/assets", async (req, res) => {
    const caller = (req as any).caller as AuthedCaller;
    const appIdFilter = cleanString(req.query.appId, 60);

    try {
      const snap = await db
        .collection("ecosystem_assets")
        .where("userId", "==", caller.uid)
        .limit(100)
        .get();

      let assets = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      if (appIdFilter) {
        assets = assets.filter((a: any) => a.appId === appIdFilter);
      }
      assets.sort((a: any, b: any) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
      return res.json({ assets });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || "Failed to load saved assets." });
    }
  });

  router.post("/assets", async (req, res) => {
    const caller = (req as any).caller as AuthedCaller;
    const {
      appId,
      toolId,
      title,
      sections,
      inputs,
      projectId,
      sourceAppId,
      sourceAssetId,
      provenance,
      syncToProfile,
      contributeToIntelligence
    } = (req.body || {}) as Record<string, any>;

    const cleanAppId = cleanString(appId, 60);
    const cleanToolId = cleanString(toolId, 80);
    const cleanTitle = cleanString(title, 160);
    if (!cleanAppId || !cleanToolId || !cleanTitle || !sections || typeof sections !== "object") {
      return res.status(400).json({ error: "appId, toolId, title, and sections are required." });
    }

    if (projectId) {
      const pSnap = await db.collection("projects").doc(String(projectId)).get();
      if (pSnap.exists && pSnap.data()?.userId !== caller.uid) {
        return res.status(403).json({ error: "Access denied: project does not belong to your account." });
      }
    }

    const now = new Date().toISOString();
    const ref = db.collection("ecosystem_assets").doc();
    // Prevent direct client assets from claiming verified_platform_data provenance
    const safeProvenance =
      provenance === "user_provided_fact" || provenance === "ai_hypothesis" || provenance === "recommendation"
        ? provenance
        : cleanAppId === "projectz"
        ? "ai_hypothesis"
        : "user_provided_fact";

    const record = {
      id: ref.id,
      userId: caller.uid,
      appId: cleanAppId,
      toolId: cleanToolId,
      title: cleanTitle,
      sections,
      inputs: inputs || {},
      projectId: projectId || null,
      sourceAppId: sourceAppId || null,
      sourceAssetId: sourceAssetId || null,
      provenance: safeProvenance,
      isolatedExperiment: cleanAppId === "projectz",
      version: 1,
      versions: [{ version: 1, savedAt: now, sections }],
      createdAt: now,
      updatedAt: now
    };

    await ref.set(record);

    // CreatorWorks -> Sync approved brand assets cleanly into Business Profile + legacy user profile
    // (Role separation: CreatorWorks develops -> Hub stores/manages -> Shared Intelligence retrieves)
    if (syncToProfile === true && cleanAppId === "creatorworks") {
      await syncCreatorWorksToBusinessProfile(db, caller.uid, sections).catch(async () => {
        const profilePatch: Record<string, any> = { updatedAt: now };
        if (typeof sections.positioningStatement === "string" && sections.positioningStatement) {
          profilePatch.positioning = sections.positioningStatement.slice(0, 600);
        }
        if (typeof sections.audienceSummary === "string" && sections.audienceSummary) {
          profilePatch.audience = sections.audienceSummary.slice(0, 600);
        }
        if (typeof sections.voiceSummary === "string" && sections.voiceSummary) {
          profilePatch.writingStyle = sections.voiceSummary.slice(0, 600);
        }
        await db.collection("users").doc(caller.uid).set(profilePatch, { merge: true });
      });
    }

    // Optional Shared Intelligence contribution (never leaks Project Z into production apps)
    if (contributeToIntelligence !== false && cleanAppId !== "projectz") {
      await contributeSharedIntelligence(
        {
          userId: caller.uid,
          sourceAppId: cleanAppId,
          projectId: projectId || undefined,
          category:
            cleanAppId === "creatorworks"
              ? "identity"
              : cleanAppId === "demandworks"
              ? "research"
              : cleanAppId === "offerworks"
              ? "offer"
              : cleanAppId === "productworks"
              ? "product"
              : "business",
          factType: cleanToolId,
          provenance: safeProvenance,
          data: { title: cleanTitle, summary: Object.values(sections).join(" ").slice(0, 500) },
          confidence: "high"
        },
        db
      ).catch((err) => {
        if (err instanceof IntelligenceIntegrityError) {
          console.warn("[ECOSYSTEM_ASSETS] Blocked invalid provenance contribution:", err.message);
        }
      });
    }

    return res.json({ asset: record });
  });

  router.put("/assets/:id", async (req, res) => {
    const caller = (req as any).caller as AuthedCaller;
    const ref = db.collection("ecosystem_assets").doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Asset not found." });
    const existing = snap.data() || {};
    if (existing.userId !== caller.uid) {
      return res.status(403).json({ error: "Access denied: asset belongs to another account." });
    }

    const now = new Date().toISOString();
    const nextVersion = (typeof existing.version === "number" ? existing.version : 1) + 1;
    const sections = req.body?.sections && typeof req.body.sections === "object" ? req.body.sections : existing.sections;
    const title = cleanString(req.body?.title, 160) || existing.title;
    const existingVersions = Array.isArray(existing.versions) ? existing.versions : [];
    const nextVersions = [...existingVersions, { version: nextVersion, savedAt: now, sections }].slice(-10);

    await ref.set(
      {
        title,
        sections,
        version: nextVersion,
        versions: nextVersions,
        updatedAt: now
      },
      { merge: true }
    );

    const updated = await ref.get();
    return res.json({ asset: { id: updated.id, ...updated.data() } });
  });

  router.delete("/assets/:id", async (req, res) => {
    const caller = (req as any).caller as AuthedCaller;
    const ref = db.collection("ecosystem_assets").doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Asset not found." });
    if (snap.data()?.userId !== caller.uid) {
      return res.status(403).json({ error: "Access denied." });
    }
    await ref.delete();
    return res.json({ deleted: true });
  });

  // =========================================================================
  // 3. SALESWORKS CRM & FUNNELWORKS LEAD CAPTURE
  // =========================================================================
  router.get("/crm/contacts", async (req, res) => {
    const caller = (req as any).caller as AuthedCaller;
    const snap = await db.collection("crm_contacts").where("userId", "==", caller.uid).limit(100).get();
    const contacts = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    return res.json({ contacts });
  });

  router.post("/crm/contacts", async (req, res) => {
    const caller = (req as any).caller as AuthedCaller;
    const name = cleanString(req.body?.name, 120);
    if (!name) return res.status(400).json({ error: "Contact name is required." });

    // Prevent direct client writes from falsely asserting transaction_verified status
    if (req.body?.verificationStatus === "transaction_verified") {
      return res.status(403).json({
        error: 'Direct client writes cannot assign "transaction_verified" status. Verified status is assigned strictly by verified payment records.'
      });
    }

    const allowedStages = new Set(["lead", "qualified", "meeting_booked", "proposal_sent", "won_verified", "closed_lost"]);
    const stage = allowedStages.has(req.body?.stage) ? req.body.stage : "lead";
    const now = new Date().toISOString();
    const ref = db.collection("crm_contacts").doc();
    const contact = {
      id: ref.id,
      userId: caller.uid,
      name,
      email: cleanString(req.body?.email, 160),
      handle: cleanString(req.body?.handle, 80),
      source: cleanString(req.body?.source, 80) || "threads",
      stage,
      offerInterest: cleanString(req.body?.offerInterest, 160),
      dealValueCents: Math.max(0, Math.round(Number(req.body?.dealValueCents || 0))),
      verificationStatus:
        req.body?.verificationStatus === "evidence_supported"
          ? "evidence_supported"
          : "self_reported",
      isTestRecord: req.body?.isTestRecord === true,
      notes: cleanString(req.body?.notes, 2000),
      nextAction: cleanString(req.body?.nextAction, 240),
      createdAt: now,
      updatedAt: now
    };
    await ref.set(contact);
    return res.json({ contact });
  });

  router.put("/crm/contacts/:id", async (req, res) => {
    const caller = (req as any).caller as AuthedCaller;
    const ref = db.collection("crm_contacts").doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Contact not found." });
    if (snap.data()?.userId !== caller.uid) return res.status(403).json({ error: "Access denied." });

    if (req.body?.verificationStatus === "transaction_verified") {
      return res.status(403).json({
        error: 'Direct client writes cannot assign "transaction_verified" status.'
      });
    }

    const patch: Record<string, any> = { updatedAt: new Date().toISOString() };
    for (const key of ["name", "email", "handle", "source", "stage", "offerInterest", "notes", "nextAction"]) {
      if (typeof req.body?.[key] === "string") patch[key] = cleanString(req.body[key], 2000);
    }
    if (req.body?.verificationStatus === "self_reported" || req.body?.verificationStatus === "evidence_supported") {
      patch.verificationStatus = req.body.verificationStatus;
    }
    if (typeof req.body?.dealValueCents === "number") {
      patch.dealValueCents = Math.max(0, Math.round(req.body.dealValueCents));
    }
    await ref.set(patch, { merge: true });
    const updated = await ref.get();
    return res.json({ contact: { id: updated.id, ...updated.data() } });
  });

  router.delete("/crm/contacts/:id", async (req, res) => {
    const caller = (req as any).caller as AuthedCaller;
    const ref = db.collection("crm_contacts").doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Contact not found." });
    if (snap.data()?.userId !== caller.uid) return res.status(403).json({ error: "Access denied." });
    await ref.delete();
    return res.json({ deleted: true });
  });

  // =========================================================================
  // 4. STOREWORKS LISTINGS & DISCOUNTS (Stripe Connect Honestly Gated)
  // =========================================================================
  router.get("/store/listings", async (req, res) => {
    const caller = (req as any).caller as AuthedCaller;
    const snap = await db.collection("store_listings").where("userId", "==", caller.uid).limit(60).get();
    const listings = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    return res.json({
      listings,
      stripeConnectConfigured: Boolean(process.env.STRIPE_CONNECT_CLIENT_ID),
      marketplaceStatusNote: process.env.STRIPE_CONNECT_CLIENT_ID
        ? "Stripe Connect configured."
        : "Storefront catalog, pricing, bundles, and discount codes are live. Live buyer card checkout & seller payouts require Stripe Connect provisioning (separate from ThreadsWorks SaaS billing)."
    });
  });

  router.post("/store/listings", async (req, res) => {
    const caller = (req as any).caller as AuthedCaller;
    const title = cleanString(req.body?.title, 160);
    if (!title) return res.status(400).json({ error: "Listing title is required." });

    const now = new Date().toISOString();
    const ref = db.collection("store_listings").doc();
    const listing = {
      id: ref.id,
      userId: caller.uid,
      title,
      description: cleanString(req.body?.description, 2000),
      priceCents: Math.max(0, Math.round(Number(req.body?.priceCents || 0))),
      currency: "USD",
      pricingTier: cleanString(req.body?.pricingTier, 60) || "Standard",
      discountCode: cleanString(req.body?.discountCode, 40).toUpperCase(),
      discountPercent: Math.max(0, Math.min(90, Math.round(Number(req.body?.discountPercent || 0)))),
      isBundle: req.body?.isBundle === true,
      linkedProductId: cleanString(req.body?.linkedProductId, 120) || null,
      status: req.body?.status === "published" ? "published" : "draft",
      createdAt: now,
      updatedAt: now
    };
    await ref.set(listing);
    return res.json({ listing });
  });

  router.delete("/store/listings/:id", async (req, res) => {
    const caller = (req as any).caller as AuthedCaller;
    const ref = db.collection("store_listings").doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Listing not found." });
    if (snap.data()?.userId !== caller.uid) return res.status(403).json({ error: "Access denied." });
    await ref.delete();
    return res.json({ deleted: true });
  });

  // =========================================================================
  // 5. DELIVERYWORKS DIGITAL ACCESS & COURSE HOSTING
  // =========================================================================
  router.get("/delivery/items", async (req, res) => {
    const caller = (req as any).caller as AuthedCaller;
    const snap = await db.collection("delivery_items").where("userId", "==", caller.uid).limit(60).get();
    const items = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    return res.json({ items });
  });

  router.post("/delivery/items", async (req, res) => {
    const caller = (req as any).caller as AuthedCaller;
    const title = cleanString(req.body?.title, 160);
    if (!title) return res.status(400).json({ error: "Delivery item title is required." });

    const now = new Date().toISOString();
    const ref = db.collection("delivery_items").doc();
    const item = {
      id: ref.id,
      userId: caller.uid,
      title,
      deliveryType: req.body?.deliveryType === "course" ? "course" : "digital_download",
      welcomeNote: cleanString(req.body?.welcomeNote, 2000),
      accessInstructions: cleanString(req.body?.accessInstructions, 2000),
      modules: Array.isArray(req.body?.modules) ? req.body.modules.slice(0, 20) : [],
      enrolledEmails: Array.isArray(req.body?.enrolledEmails) ? req.body.enrolledEmails.slice(0, 50) : [],
      accessToken: randomUUID().slice(0, 12),
      createdAt: now,
      updatedAt: now
    };
    await ref.set(item);
    return res.json({ item });
  });

  router.delete("/delivery/items/:id", async (req, res) => {
    const caller = (req as any).caller as AuthedCaller;
    const ref = db.collection("delivery_items").doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Item not found." });
    if (snap.data()?.userId !== caller.uid) return res.status(403).json({ error: "Access denied." });
    await ref.delete();
    return res.json({ deleted: true });
  });

  // =========================================================================
  // 6. COMMUNITYWORKS INTERNAL CREATOR SOCIAL NETWORK
  // =========================================================================
  router.get("/community/feed", async (req, res) => {
    const caller = (req as any).caller as AuthedCaller;
    const [postsSnap, groupsSnap, blocksSnap, followsSnap, messagesSnap] = await Promise.all([
      db.collection("community_posts").limit(40).get(),
      db.collection("community_groups").limit(20).get(),
      db.collection("community_moderation").where("userId", "==", caller.uid).limit(50).get(),
      db.collection("community_follows").where("followerId", "==", caller.uid).limit(100).get(),
      db.collection("community_messages").where("participants", "array-contains", caller.uid).limit(40).get()
    ]);

    const blockedUids = new Set(
      blocksSnap.docs
        .filter((d) => d.data()?.action === "block")
        .map((d) => String(d.data()?.targetUid || ""))
    );

    const posts = postsSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((p: any) => !blockedUids.has(p.authorId))
      .sort((a: any, b: any) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

    const groups = groupsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const followingIds = followsSnap.docs.map((d) => String(d.data()?.targetUid || ""));
    const messages = messagesSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

    return res.json({ posts, groups, followingIds, blockedCount: blockedUids.size, messages });
  });

  router.post("/community/posts", async (req, res) => {
    const caller = (req as any).caller as AuthedCaller;
    const body = cleanString(req.body?.body, 1500);
    if (!body) return res.status(400).json({ error: "Post content is required." });

    const userSnap = await db.collection("users").doc(caller.uid).get();
    const authorName =
      cleanString(userSnap.data()?.displayName, 80) ||
      (caller.email ? caller.email.split("@")[0] : "Creator");

    const now = new Date().toISOString();
    const ref = db.collection("community_posts").doc();
    const post = {
      id: ref.id,
      authorId: caller.uid,
      authorName,
      category: cleanString(req.body?.category, 60) || "Discussion",
      body,
      sharedAssetTitle: cleanString(req.body?.sharedAssetTitle, 140) || null,
      sharedAssetType: cleanString(req.body?.sharedAssetType, 40) || null,
      likedBy: [],
      savedBy: [],
      repostedBy: [],
      comments: [],
      createdAt: now,
      updatedAt: now
    };
    await ref.set(post);
    return res.json({ post });
  });

  router.post("/community/posts/:id/interact", async (req, res) => {
    const caller = (req as any).caller as AuthedCaller;
    const action = cleanString(req.body?.action, 30);
    const ref = db.collection("community_posts").doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Community post not found." });
    const data = snap.data() || {};
    const now = new Date().toISOString();

    if (action === "like" || action === "save" || action === "repost") {
      const field = action === "like" ? "likedBy" : action === "save" ? "savedBy" : "repostedBy";
      const list: string[] = Array.isArray(data[field]) ? [...data[field]] : [];
      const idx = list.indexOf(caller.uid);
      if (idx >= 0) list.splice(idx, 1);
      else list.push(caller.uid);
      await ref.set({ [field]: list, updatedAt: now }, { merge: true });
      return res.json({ success: true, [field]: list });
    }

    if (action === "comment") {
      const text = cleanString(req.body?.text, 600);
      if (!text) return res.status(400).json({ error: "Comment text is required." });
      const comments = Array.isArray(data.comments) ? [...data.comments] : [];
      comments.push({
        id: randomUUID().slice(0, 10),
        authorId: caller.uid,
        authorName: caller.email ? caller.email.split("@")[0] : "Creator",
        text,
        createdAt: now
      });
      await ref.set({ comments: comments.slice(-50), updatedAt: now }, { merge: true });
      return res.json({ success: true, comments });
    }

    return res.status(400).json({ error: "Unsupported community action." });
  });

  router.post("/community/groups", async (req, res) => {
    const caller = (req as any).caller as AuthedCaller;
    const name = cleanString(req.body?.name, 100);
    if (!name) return res.status(400).json({ error: "Group name is required." });
    const now = new Date().toISOString();
    const ref = db.collection("community_groups").doc();
    const group = {
      id: ref.id,
      ownerId: caller.uid,
      name,
      description: cleanString(req.body?.description, 400),
      memberIds: [caller.uid],
      createdAt: now
    };
    await ref.set(group);
    return res.json({ group });
  });

  router.post("/community/messages", async (req, res) => {
    const caller = (req as any).caller as AuthedCaller;
    const recipientId = cleanString(req.body?.recipientId, 128);
    const text = cleanString(req.body?.text, 1000);
    if (!recipientId || !text) return res.status(400).json({ error: "recipientId and text are required." });
    const now = new Date().toISOString();
    const ref = db.collection("community_messages").doc();
    const message = {
      id: ref.id,
      senderId: caller.uid,
      recipientId,
      participants: Array.from(new Set([caller.uid, recipientId])),
      text,
      createdAt: now
    };
    await ref.set(message);
    return res.json({ message });
  });

  router.post("/community/moderate", async (req, res) => {
    const caller = (req as any).caller as AuthedCaller;
    const action = req.body?.action === "block" ? "block" : "report";
    const targetUid = cleanString(req.body?.targetUid, 128);
    const targetPostId = cleanString(req.body?.targetPostId, 128);
    const reason = cleanString(req.body?.reason, 400);
    if (!targetUid && !targetPostId) return res.status(400).json({ error: "Target is required." });
    const ref = db.collection("community_moderation").doc();
    await ref.set({
      id: ref.id,
      userId: caller.uid,
      action,
      targetUid: targetUid || null,
      targetPostId: targetPostId || null,
      reason,
      createdAt: new Date().toISOString()
    });
    return res.json({ success: true, action });
  });

  // =========================================================================
  // 7. MEETINGWORKS ROOMS, SCHEDULER & CHAT (WebRTC Honestly Gated)
  // =========================================================================
  router.get("/meetings", async (req, res) => {
    const caller = (req as any).caller as AuthedCaller;
    const snap = await db.collection("meetings").where("userId", "==", caller.uid).limit(50).get();
    const meetings = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    return res.json({
      meetings,
      liveMediaSupported: false,
      liveMediaStatusNote:
        "Persistent meeting rooms, appointments, shareable invitations, agendas, in-room chat, product links, and AI summaries are live. Browser-native live audio/video/screen share requires external WebRTC SFU/TURN infrastructure."
    });
  });

  router.post("/meetings", async (req, res) => {
    const caller = (req as any).caller as AuthedCaller;
    const title = cleanString(req.body?.title, 160);
    if (!title) return res.status(400).json({ error: "Meeting title is required." });
    const now = new Date().toISOString();
    const ref = db.collection("meetings").doc();
    const meeting = {
      id: ref.id,
      userId: caller.uid,
      title,
      scheduledFor: cleanString(req.body?.scheduledFor, 60) || now,
      inviteCode: `MW-${randomUUID().slice(0, 8).toUpperCase()}`,
      agenda: cleanString(req.body?.agenda, 2000),
      productLink: cleanString(req.body?.productLink, 300),
      hostNotes: cleanString(req.body?.hostNotes, 4000),
      linkedContactId: cleanString(req.body?.linkedContactId, 120) || null,
      chatMessages: [],
      status: "scheduled",
      createdAt: now,
      updatedAt: now
    };
    await ref.set(meeting);
    return res.json({ meeting });
  });

  router.put("/meetings/:id", async (req, res) => {
    const caller = (req as any).caller as AuthedCaller;
    const ref = db.collection("meetings").doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Meeting not found." });
    const existing = snap.data() || {};
    if (existing.userId !== caller.uid) return res.status(403).json({ error: "Access denied." });

    const now = new Date().toISOString();
    const patch: Record<string, any> = { updatedAt: now };
    for (const key of ["title", "scheduledFor", "agenda", "productLink", "hostNotes", "status"]) {
      if (typeof req.body?.[key] === "string") patch[key] = cleanString(req.body[key], 4000);
    }
    if (typeof req.body?.newChatMessage === "string" && req.body.newChatMessage.trim()) {
      const chatMessages = Array.isArray(existing.chatMessages) ? [...existing.chatMessages] : [];
      chatMessages.push({
        id: randomUUID().slice(0, 10),
        sender: caller.email ? caller.email.split("@")[0] : "Host",
        text: cleanString(req.body.newChatMessage, 600),
        createdAt: now
      });
      patch.chatMessages = chatMessages.slice(-100);
    }
    await ref.set(patch, { merge: true });
    const updated = await ref.get();
    return res.json({ meeting: { id: updated.id, ...updated.data() } });
  });

  // =========================================================================
  // 8. PROOFWORKS EVIDENCE LIBRARY
  // =========================================================================
  router.get("/proof", async (req, res) => {
    const caller = (req as any).caller as AuthedCaller;
    const snap = await db.collection("proof_items").where("userId", "==", caller.uid).limit(60).get();
    const items = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    return res.json({ items });
  });

  router.post("/proof", async (req, res) => {
    const caller = (req as any).caller as AuthedCaller;
    const customerName = cleanString(req.body?.customerName, 120);
    const outcomeSummary = cleanString(req.body?.outcomeSummary, 1000);
    if (!customerName || !outcomeSummary) {
      return res.status(400).json({ error: "Customer name and outcome summary are required." });
    }
    if (req.body?.verificationTier === "transaction_verified") {
      return res.status(403).json({
        error: 'Direct client writes cannot assign "transaction_verified" tier. Verified proof requires verified payment records.'
      });
    }
    const tier =
      req.body?.verificationTier === "evidence_supported"
        ? "evidence_supported"
        : "self_reported";

    const now = new Date().toISOString();
    const ref = db.collection("proof_items").doc();
    const item = {
      id: ref.id,
      userId: caller.uid,
      customerName,
      quote: cleanString(req.body?.quote, 1500),
      outcomeSummary,
      evidenceUrl: cleanString(req.body?.evidenceUrl, 300),
      verificationTier: tier,
      linkedProductId: cleanString(req.body?.linkedProductId, 120) || null,
      createdAt: now
    };
    await ref.set(item);
    return res.json({ item });
  });

  router.delete("/proof/:id", async (req, res) => {
    const caller = (req as any).caller as AuthedCaller;
    const ref = db.collection("proof_items").doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Proof item not found." });
    if (snap.data()?.userId !== caller.uid) return res.status(403).json({ error: "Access denied." });
    await ref.delete();
    return res.json({ deleted: true });
  });

  // =========================================================================
  // 9. TEAMWORKS SHARED WORKSPACES, TASKS & APPROVALS
  // =========================================================================
  router.get("/team/workspaces", async (req, res) => {
    const caller = (req as any).caller as AuthedCaller;
    const snap = await db.collection("team_workspaces").where("ownerId", "==", caller.uid).limit(20).get();
    const workspaces = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return res.json({ workspaces });
  });

  router.post("/team/workspaces", async (req, res) => {
    const caller = (req as any).caller as AuthedCaller;
    const name = cleanString(req.body?.name, 120);
    if (!name) return res.status(400).json({ error: "Workspace name is required." });
    const now = new Date().toISOString();
    const ref = db.collection("team_workspaces").doc();
    const workspace = {
      id: ref.id,
      ownerId: caller.uid,
      name,
      members: [{ email: caller.email || caller.uid, role: "owner", addedAt: now }],
      tasks: [],
      approvals: [],
      createdAt: now,
      updatedAt: now
    };
    await ref.set(workspace);
    return res.json({ workspace });
  });

  router.put("/team/workspaces/:id", async (req, res) => {
    const caller = (req as any).caller as AuthedCaller;
    const ref = db.collection("team_workspaces").doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Workspace not found." });
    const existing = snap.data() || {};
    if (existing.ownerId !== caller.uid) return res.status(403).json({ error: "Only workspace owner can update." });

    const now = new Date().toISOString();
    const patch: Record<string, any> = { updatedAt: now };
    if (Array.isArray(req.body?.members)) patch.members = req.body.members.slice(0, 25);
    if (Array.isArray(req.body?.tasks)) patch.tasks = req.body.tasks.slice(0, 100);
    if (Array.isArray(req.body?.approvals)) patch.approvals = req.body.approvals.slice(0, 50);
    await ref.set(patch, { merge: true });
    const updated = await ref.get();
    return res.json({ workspace: { id: updated.id, ...updated.data() } });
  });

  // =========================================================================
  // 10. AFFILIATEWORKS PROGRAMS & SELF-REFERRAL GUARD
  // =========================================================================
  router.get("/affiliates", async (req, res) => {
    const caller = (req as any).caller as AuthedCaller;
    const [progSnap, partnerSnap] = await Promise.all([
      db.collection("affiliate_programs").where("userId", "==", caller.uid).limit(20).get(),
      db.collection("partners").doc(caller.uid).get()
    ]);
    return res.json({
      programs: progSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      partnerProfile: partnerSnap.exists ? partnerSnap.data() : null
    });
  });

  router.post("/affiliates", async (req, res) => {
    const caller = (req as any).caller as AuthedCaller;
    const name = cleanString(req.body?.name, 120);
    if (!name) return res.status(400).json({ error: "Program name is required." });
    const now = new Date().toISOString();
    const ref = db.collection("affiliate_programs").doc();
    const code = cleanString(req.body?.referralCode, 32).toUpperCase() || `REF-${randomUUID().slice(0, 6).toUpperCase()}`;
    const program = {
      id: ref.id,
      userId: caller.uid,
      name,
      commissionPercent: Math.max(1, Math.min(80, Math.round(Number(req.body?.commissionPercent || 30)))),
      referralCode: code,
      destinationUrl: cleanString(req.body?.destinationUrl, 300) || "https://threadsworks.com",
      selfReferralBlocked: true,
      createdAt: now
    };
    await ref.set(program);
    return res.json({ program });
  });

  router.post("/affiliates/validate-referral", async (req, res) => {
    const caller = (req as any).caller as AuthedCaller;
    const referrerUid = cleanString(req.body?.referrerUid, 128);
    const buyerUid = cleanString(req.body?.buyerUid, 128) || caller.uid;
    const result = validateAffiliateReferral(
      referrerUid,
      buyerUid,
      cleanString(req.body?.referrerEmail, 160),
      cleanString(req.body?.buyerEmail, 160) || caller.email
    );
    return res.status(result.valid ? 200 : 400).json(result);
  });

  // =========================================================================
  // 11. GROWTHWORKS REAL ANALYTICS SUMMARY (ZERO FABRICATED NUMBERS)
  // =========================================================================
  router.get("/growth/summary", async (req, res) => {
    const caller = (req as any).caller as AuthedCaller;
    const [analyticsSnap, postsSnap, crmSnap, financeSnap, assetsSnap] = await Promise.all([
      db.collection("analytics_posts").where("userId", "==", caller.uid).limit(50).get(),
      db.collection("posts").where("userId", "==", caller.uid).limit(100).get(),
      db.collection("crm_contacts").where("userId", "==", caller.uid).limit(100).get(),
      db.collection("finance_entries").where("userId", "==", caller.uid).limit(100).get(),
      db.collection("ecosystem_assets").where("userId", "==", caller.uid).limit(100).get()
    ]);

    let totalViews = 0;
    let totalInteractions = 0;
    analyticsSnap.docs.forEach((doc) => {
      const m = (doc.data()?.metrics as Record<string, any>) || {};
      totalViews += typeof m.views === "number" ? m.views : 0;
      totalInteractions +=
        (typeof m.likes === "number" ? m.likes : 0) +
        (typeof m.replies === "number" ? m.replies : 0) +
        (typeof m.reposts === "number" ? m.reposts : 0) +
        (typeof m.quotes === "number" ? m.quotes : 0);
    });

    const verifiedRevenueCents = financeSnap.docs.reduce((sum, doc) => {
      const d = doc.data() || {};
      if (d.type === "verified_sale" && d.status === "verified" && d.isTestTransaction !== true) {
        return sum + (typeof d.amountCents === "number" ? d.amountCents : 0);
      }
      return sum;
    }, 0);

    return res.json({
      provenance: "verified_platform_data",
      hasSyncedThreadsMetrics: analyticsSnap.size > 0,
      syncedThreadsPostsCount: analyticsSnap.size,
      totalThreadsViews: analyticsSnap.size > 0 ? totalViews : null,
      totalThreadsInteractions: analyticsSnap.size > 0 ? totalInteractions : null,
      savedPostsCount: postsSnap.size,
      crmContactsCount: crmSnap.size,
      savedEcosystemAssetsCount: assetsSnap.size,
      verifiedRevenueCents
    });
  });

  // =========================================================================
  // 12. AUTOMATIONWORKS WORKFLOWS & IDEMPOTENT EXECUTION ENGINE
  // =========================================================================
  router.get("/automations", async (req, res) => {
    const caller = (req as any).caller as AuthedCaller;
    const [wfSnap, runsSnap] = await Promise.all([
      db.collection("automation_workflows").where("userId", "==", caller.uid).limit(30).get(),
      db.collection("automation_runs").where("userId", "==", caller.uid).limit(30).get()
    ]);
    return res.json({
      workflows: wfSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      runs: runsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a: any, b: any) => String(b.executedAt || "").localeCompare(String(a.executedAt || "")))
    });
  });

  router.post("/automations", async (req, res) => {
    const caller = (req as any).caller as AuthedCaller;
    const name = cleanString(req.body?.name, 140);
    const trigger = cleanString(req.body?.trigger, 80);
    const actionType = cleanString(req.body?.actionType, 80) as AutomationActionType;
    if (!name || !trigger || !actionType) {
      return res.status(400).json({ error: "name, trigger, and actionType are required." });
    }
    const now = new Date().toISOString();
    const ref = db.collection("automation_workflows").doc();
    const workflow = {
      id: ref.id,
      userId: caller.uid,
      name,
      trigger,
      condition: cleanString(req.body?.condition, 240) || "Always when trigger fires",
      actionType,
      requiresApproval: req.body?.requiresApproval !== false,
      maxRetries: Math.max(0, Math.min(3, Math.round(Number(req.body?.maxRetries ?? 2)))),
      enabled: true,
      createdAt: now,
      updatedAt: now
    };
    await ref.set(workflow);
    return res.json({ workflow });
  });

  router.post("/automations/:id/run", async (req, res) => {
    const caller = (req as any).caller as AuthedCaller;
    const wfRef = db.collection("automation_workflows").doc(req.params.id);
    const wfSnap = await wfRef.get();
    if (!wfSnap.exists) return res.status(404).json({ error: "Workflow not found." });
    const wf = wfSnap.data() || {};
    if (wf.userId !== caller.uid) return res.status(403).json({ error: "Access denied." });

    const idempotencyKey =
      cleanString(req.body?.idempotencyKey, 120) || `${wfSnap.id}_${Date.now()}`;

    // Idempotency check
    const existingRun = await db
      .collection("automation_runs")
      .where("userId", "==", caller.uid)
      .where("idempotencyKey", "==", idempotencyKey)
      .limit(1)
      .get();

    if (!existingRun.empty) {
      return res.json({
        idempotentHit: true,
        run: { id: existingRun.docs[0].id, ...existingRun.docs[0].data() }
      });
    }

    const decision = evaluateAutomationPolicy({
      actionType: wf.actionType as AutomationActionType,
      requiresApproval: Boolean(wf.requiresApproval),
      approvedByUser: req.body?.approvedByUser === true,
      maxRetries: wf.maxRetries
    });

    const now = new Date().toISOString();
    const runRef = db.collection("automation_runs").doc();
    const runRecord = {
      id: runRef.id,
      userId: caller.uid,
      workflowId: wfSnap.id,
      workflowName: wf.name,
      actionType: wf.actionType,
      idempotencyKey,
      status: decision.status,
      reason: decision.reason,
      boundedMaxRetries: decision.boundedMaxRetries,
      executedAt: now
    };

    await runRef.set(runRecord);
    return res.status(decision.status === "BLOCKED_EXTERNAL_APPROVAL_REQUIRED" ? 403 : 200).json({
      idempotentHit: false,
      run: runRecord
    });
  });

  // =========================================================================
  // 13. FINANCEWORKS REAL LEDGER, INVOICES & P&L
  // =========================================================================
  router.get("/finance/entries", async (req, res) => {
    const caller = (req as any).caller as AuthedCaller;
    const snap = await db.collection("finance_entries").where("userId", "==", caller.uid).limit(120).get();
    const entries = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

    let verifiedRevenueCents = 0;
    let totalExpensesCents = 0;
    let totalRefundsCents = 0;
    let totalCommissionsCents = 0;

    for (const e of entries as any[]) {
      const amt = typeof e.amountCents === "number" ? e.amountCents : 0;
      if (e.isTestTransaction === true) continue;
      if (e.type === "verified_sale" && (e.status === "verified" || e.status === "paid")) {
        verifiedRevenueCents += amt;
      } else if (e.type === "expense") {
        totalExpensesCents += amt;
      } else if (e.type === "refund") {
        totalRefundsCents += amt;
      } else if (e.type === "commission") {
        totalCommissionsCents += amt;
      }
    }

    return res.json({
      entries,
      summary: {
        provenance: "user_provided_fact",
        verifiedRevenueCents,
        totalExpensesCents,
        totalRefundsCents,
        totalCommissionsCents,
        netProfitCents: verifiedRevenueCents - totalExpensesCents - totalRefundsCents - totalCommissionsCents
      }
    });
  });

  router.post("/finance/entries", async (req, res) => {
    const caller = (req as any).caller as AuthedCaller;
    const allowedTypes = new Set(["expense", "verified_sale", "refund", "commission", "invoice"]);
    const type = allowedTypes.has(req.body?.type) ? req.body.type : "expense";
    const description = cleanString(req.body?.description, 240);
    const amountCents = Math.max(0, Math.round(Number(req.body?.amountCents || 0)));
    if (!description || amountCents <= 0) {
      return res.status(400).json({ error: "Description and positive amount are required." });
    }
    const now = new Date().toISOString();
    const ref = db.collection("finance_entries").doc();
    const entry = {
      id: ref.id,
      userId: caller.uid,
      type,
      description,
      amountCents,
      category: cleanString(req.body?.category, 80) || "Operations",
      clientName: cleanString(req.body?.clientName, 120),
      buyerUid: cleanString(req.body?.buyerUid, 128) || null,
      invoiceNumber: type === "invoice" ? `INV-${Date.now().toString().slice(-6)}` : cleanString(req.body?.invoiceNumber, 40),
      status: cleanString(req.body?.status, 40) || (type === "verified_sale" ? "verified" : "recorded"),
      source: cleanString(req.body?.source, 60) || "manual_creator_record",
      isTestTransaction: req.body?.isTestTransaction === true,
      createdAt: now
    };
    await ref.set(entry);
    return res.json({ entry });
  });

  router.delete("/finance/entries/:id", async (req, res) => {
    const caller = (req as any).caller as AuthedCaller;
    const ref = db.collection("finance_entries").doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Entry not found." });
    if (snap.data()?.userId !== caller.uid) return res.status(403).json({ error: "Access denied." });
    await ref.delete();
    return res.json({ deleted: true });
  });

  // =========================================================================
  // 14. ACADEMY PERSISTENT PROGRESS
  // =========================================================================
  router.get("/academy/progress", async (req, res) => {
    const caller = (req as any).caller as AuthedCaller;
    const snap = await db.collection("academy_progress").doc(caller.uid).get();
    const data = snap.exists ? snap.data() || {} : {};
    return res.json({
      completedLessonIds: Array.isArray(data.completedLessonIds) ? data.completedLessonIds : [],
      assignmentNotes: data.assignmentNotes && typeof data.assignmentNotes === "object" ? data.assignmentNotes : {},
      updatedAt: data.updatedAt || null
    });
  });

  router.put("/academy/progress", async (req, res) => {
    const caller = (req as any).caller as AuthedCaller;
    const completedLessonIds = Array.isArray(req.body?.completedLessonIds)
      ? req.body.completedLessonIds.map((id: unknown) => cleanString(id, 80)).filter(Boolean).slice(0, 50)
      : [];
    const assignmentNotes =
      req.body?.assignmentNotes && typeof req.body.assignmentNotes === "object"
        ? req.body.assignmentNotes
        : {};
    const now = new Date().toISOString();
    await db
      .collection("academy_progress")
      .doc(caller.uid)
      .set({ userId: caller.uid, completedLessonIds, assignmentNotes, updatedAt: now }, { merge: true });
    return res.json({ success: true, completedLessonIds, assignmentNotes, updatedAt: now });
  });

  // =========================================================================
  // 15. FIRST SALE ENGINE DYNAMIC STATUS (Strictly Grounded in Real Records)
  // =========================================================================
  router.get("/first-sale-status", async (req, res) => {
    const caller = (req as any).caller as AuthedCaller;
    const [
      businessLoaded,
      userSnap,
      assetsSnap,
      productsSnap,
      postsSnap,
      crmSnap,
      meetingsSnap,
      listingsSnap,
      deliverySnap,
      proofSnap,
      financeSnap
    ] = await Promise.all([
      loadBusinessProfile(db, caller.uid, DEFAULT_BUSINESS_ID),
      db.collection("users").doc(caller.uid).get(),
      db.collection("ecosystem_assets").where("userId", "==", caller.uid).limit(100).get(),
      db.collection("funnelworks_projects").doc(caller.uid).collection("projects").limit(20).get(),
      db.collection("posts").where("userId", "==", caller.uid).limit(20).get(),
      db.collection("crm_contacts").where("userId", "==", caller.uid).limit(50).get(),
      db.collection("meetings").where("userId", "==", caller.uid).limit(20).get(),
      db.collection("store_listings").where("userId", "==", caller.uid).limit(20).get(),
      db.collection("delivery_items").where("userId", "==", caller.uid).limit(20).get(),
      db.collection("proof_items").where("userId", "==", caller.uid).limit(20).get(),
      db.collection("finance_entries").where("userId", "==", caller.uid).limit(100).get()
    ]);

    const userData = userSnap.exists ? userSnap.data() || {} : {};
    const bp = businessLoaded.profile;
    const assets = assetsSnap.docs.map((d) => d.data() || {});
    const products = productsSnap.docs.map((d) => d.data() || {});

    let verifiedCreatorSalesCount = 0;
    let excludedSalesCount = 0;

    financeSnap.docs.forEach((doc) => {
      const d = doc.data() || {};
      if (d.type !== "verified_sale") return;
      const candidate: VerifiedSaleCandidate = {
        id: doc.id,
        sellerUid: caller.uid,
        buyerUid: d.buyerUid || null,
        amountCents: Number(d.amountCents || 0),
        status: String(d.status || ""),
        isTestTransaction: d.isTestTransaction === true,
        source: String(d.source || "")
      };
      const check = isEligibleVerifiedCreatorSale(candidate);
      if (check.eligible) verifiedCreatorSalesCount += 1;
      else excludedSalesCount += 1;
    });

    const state = computeFirstSaleEngineState({
      hasCreatorProfile: Boolean(
        bp.businessProfile.businessName ||
          bp.businessProfile.positioning ||
          bp.creatorProfile.creatorName ||
          userData.offer ||
          userData.audience ||
          userData.positioning ||
          assets.some((a) => a.appId === "creatorworks")
      ),
      hasDemandResearch: assets.some((a) => a.appId === "demandworks"),
      hasOfferBlueprint:
        bp.productsAndOffers.length > 0 ||
        Boolean(userData.offer) ||
        assets.some((a) => a.appId === "offerworks"),
      hasDigitalProduct: products.length > 0 || assets.some((a) => a.appId === "productworks"),
      hasProductPromotionDrafts: products.some(
        (p) => Array.isArray(p.promotionDrafts) && p.promotionDrafts.length > 0
      ),
      hasThreadsContent: postsSnap.size > 0,
      hasFunnelOrLeadAsset: assets.some((a) => a.appId === "funnelworks"),
      hasCrmLeads: crmSnap.size > 0,
      hasDiscoveryMeetings: meetingsSnap.size > 0,
      hasStoreListing: listingsSnap.size > 0,
      hasDeliverySetup: deliverySnap.size > 0 || assets.some((a) => a.appId === "deliveryworks"),
      hasProofItem: proofSnap.size > 0 || assets.some((a) => a.appId === "proofworks"),
      verifiedCreatorSalesCount,
      excludedSalesCount
    });

    return res.json(state);
  });

  return router;
}
