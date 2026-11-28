import express from "express";
import type { Firestore } from "firebase-admin/firestore";
import type { Auth } from "firebase-admin/auth";
import { getAI, callGenerateContentWithRetry } from "./geminiClient";
import { validateFunnelPackage } from "./funnelworksValidation";
import { checkFunnelPro, reserveFunnelGeneration, finishFunnelGeneration } from "./funnelworksUsageService";
import {
  checkAndReserveGeneration,
  commitGeneration,
  releaseReservation
} from "./generationLimitService";
import { retrieveSharedIntelligenceContext } from "./sharedIntelligenceService";
import { buildProductPromotionPrompt } from "./ecosystemDomainLogic";

function buildFunnelPackagePrompt(input: {
  sourceTopic: string;
  audience: string;
  outcome: string;
  title: string;
  creatorBrand: string;
  goal: "lead_magnet" | "impulse_product";
  theme: "editorial_dark" | "swiss_light" | "terminal_contrast" | "warm_creator";
  price?: string;
}): string {
  return [
    "You are ProductWorks, an AI digital product architect for creators.",
    "Generate a complete, cohesive, practical digital product package strictly in valid JSON.",
    "RULES:",
    "- Do NOT invent customer testimonials, fake sales metrics, or fabricated URLs.",
    "- Every slide must be crisp, readable, and directly actionable.",
    "- slides must have EXACTLY 7 items: slideNumber 1..7, role='hook' for slide 1, 'step' for slides 2..6, 'cta' for slide 7.",
    "- playbook.pages must have EXACTLY 2 items: pageNumber 1 and 2, each with 2-4 blocks containing heading and 2-5 bullets.",
    "- companionPosts.threads <= 480 chars, companionPosts.x <= 260 chars, companionPosts.linkedin <= 1500 chars.",
    "- storefront.outcomeBullets must have EXACTLY 3 concise strings.",
    "",
    `Source Idea / Topic: ${input.sourceTopic}`,
    `Working Product Title: ${input.title}`,
    `Target Audience: ${input.audience}`,
    `Core Outcome: ${input.outcome}`,
    `Creator Brand: ${input.creatorBrand || "Independent Creator"}`,
    `Goal: ${input.goal}`,
    input.price ? `Suggested Price: ${input.price}` : "Suggested Price: Choose a realistic starter price suggestion (e.g. $19 or Free Lead Magnet).",
    "",
    "Return ONLY valid JSON with this exact schema:",
    JSON.stringify({
      slides: [
        { slideNumber: 1, role: "hook", eyebrow: "Short eyebrow", headline: "Compelling headline", body: "Clear body text" },
        { slideNumber: 2, role: "step", eyebrow: "STEP 01", headline: "Step headline", body: "Step explanation" },
        { slideNumber: 3, role: "step", eyebrow: "STEP 02", headline: "Step headline", body: "Step explanation" },
        { slideNumber: 4, role: "step", eyebrow: "STEP 03", headline: "Step headline", body: "Step explanation" },
        { slideNumber: 5, role: "step", eyebrow: "STEP 04", headline: "Step headline", body: "Step explanation" },
        { slideNumber: 6, role: "step", eyebrow: "STEP 05", headline: "Step headline", body: "Step explanation" },
        { slideNumber: 7, role: "cta", eyebrow: "NEXT STEP", headline: "Clear CTA headline", body: "Simple CTA body" }
      ],
      playbook: {
        title: input.title,
        subtitle: "Clear practical subtitle",
        pages: [
          {
            pageNumber: 1,
            sectionTitle: "Part 1: Core Framework",
            summary: "Overview of the framework.",
            blocks: [{ heading: "Key Step 1", bullets: ["Action item 1", "Action item 2"] }]
          },
          {
            pageNumber: 2,
            sectionTitle: "Part 2: Execution Checklist",
            summary: "How to apply this immediately.",
            blocks: [{ heading: "Implementation Plan", bullets: ["Action item 1", "Action item 2"] }]
          }
        ]
      },
      companionPosts: {
        threads: "Concise Threads post under 480 chars",
        x: "Concise X post under 260 chars",
        linkedin: "Practical breakdown post"
      },
      storefront: {
        productTitle: input.title,
        suggestedPrice: input.price || "$19",
        outcomeBullets: ["Outcome 1", "Outcome 2", "Outcome 3"],
        checkoutDescription: "Clear storefront description of what is included.",
        orderBumpPitch: "Optional companion checklist or walkthrough add-on.",
        ctaKeyword: "START"
      }
    })
  ].join("\n");
}

async function verifyCaller(auth: Auth, req: express.Request): Promise<{ uid: string; email?: string } | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  try {
    const decoded = await auth.verifyIdToken(header.slice(7));
    return { uid: decoded.uid, email: decoded.email };
  } catch {
    return null;
  }
}

export function createFunnelworksRouter(db: Firestore, auth: Auth) {
  const router = express.Router();

  router.get("/status", async (req, res) => {
    const caller = await verifyCaller(auth, req);
    if (!caller) return res.status(401).json({ error: "Sign in to access ProductWorks." });
    try {
      const [isPro, usageSnap] = await Promise.all([
        checkFunnelPro(db, caller.uid, caller.email),
        db.collection("funnelworks_usage").doc(caller.uid).get()
      ]);
      const completed = usageSnap.data()?.completed === true;
      return res.json({ isPro, freeGenerationUsed: completed, canGenerate: isPro || !completed });
    } catch {
      return res.status(503).json({ error: "Unable to verify ProductWorks access right now." });
    }
  });

  router.get("/projects", async (req, res) => {
    const caller = await verifyCaller(auth, req);
    if (!caller) return res.status(401).json({ error: "Sign in to view saved products." });
    try {
      const snap = await db
        .collection("funnelworks_projects")
        .doc(caller.uid)
        .collection("projects")
        .orderBy("createdAt", "desc")
        .limit(20)
        .get();
      return res.json({ projects: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) });
    } catch {
      return res.status(503).json({ error: "Unable to load saved ProductWorks projects." });
    }
  });

  router.delete("/projects/:id", async (req, res) => {
    const caller = await verifyCaller(auth, req);
    if (!caller) return res.status(401).json({ error: "Sign in to delete a product." });
    await db
      .collection("funnelworks_projects")
      .doc(caller.uid)
      .collection("projects")
      .doc(req.params.id)
      .delete();
    return res.json({ deleted: true });
  });

  /**
   * Persist inline edits to an existing ProductWorks project and increment version.
   */
  router.put("/projects/:id", async (req, res) => {
    const caller = await verifyCaller(auth, req);
    if (!caller) return res.status(401).json({ error: "Sign in to edit a product." });

    const projectId = String(req.params.id || "").trim();
    if (!projectId) return res.status(400).json({ error: "Invalid product ID." });

    const docRef = db
      .collection("funnelworks_projects")
      .doc(caller.uid)
      .collection("projects")
      .doc(projectId);

    try {
      const snap = await docRef.get();
      if (!snap.exists) {
        return res.status(404).json({ error: "ProductWorks project not found." });
      }
      const existing = snap.data() || {};
      const nextVersion = (typeof existing.version === "number" ? existing.version : 1) + 1;

      const allowedUpdates: Record<string, unknown> = {
        version: nextVersion,
        updatedAt: new Date().toISOString()
      };

      const body = (req.body || {}) as Record<string, unknown>;
      if (body.playbook && typeof body.playbook === "object") allowedUpdates.playbook = body.playbook;
      if (Array.isArray(body.slides)) allowedUpdates.slides = body.slides;
      if (body.companionPosts && typeof body.companionPosts === "object") {
        allowedUpdates.companionPosts = body.companionPosts;
      }
      if (body.storefront && typeof body.storefront === "object") {
        allowedUpdates.storefront = body.storefront;
      }
      if (typeof body.price === "string") allowedUpdates.price = body.price.trim().slice(0, 40);
      if (typeof body.url === "string") allowedUpdates.url = body.url.trim().slice(0, 300);
      if (typeof body.audience === "string") allowedUpdates.audience = body.audience.trim().slice(0, 240);
      if (typeof body.outcome === "string") allowedUpdates.outcome = body.outcome.trim().slice(0, 300);

      await docRef.set(allowedUpdates, { merge: true });
      const updatedSnap = await docRef.get();
      const updatedProject = { id: updatedSnap.id, ...updatedSnap.data() };
      return res.json({ project: updatedProject, funnel: updatedProject });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || "Failed to save ProductWorks edits." });
    }
  });

  router.post("/generate", async (req, res) => {
    const caller = await verifyCaller(auth, req);
    if (!caller) return res.status(401).json({ error: "Sign in to generate a digital product." });

    const body = (req.body || {}) as Record<string, any>;
    const concept = body.concept && typeof body.concept === "object" ? body.concept : body;
    const sourceTopic = String(concept.source || concept.topic || concept.title || "").trim().slice(0, 2000);
    if (!sourceTopic) {
      return res.status(400).json({ error: "A product topic or source idea is required." });
    }

    const title = String(concept.title || sourceTopic).trim().slice(0, 140);
    const audience = String(concept.audience || "Creators and entrepreneurs").trim().slice(0, 240);
    const outcome = String(concept.outcome || "Achieve a concrete practical result").trim().slice(0, 300);
    const creatorBrand = String(concept.creatorBrand || "").trim().slice(0, 100);
    const goal: "lead_magnet" | "impulse_product" =
      concept.goal === "lead_magnet" ? "lead_magnet" : "impulse_product";
    const allowedThemes = new Set(["editorial_dark", "swiss_light", "terminal_contrast", "warm_creator"]);
    const theme = (allowedThemes.has(concept.theme) ? concept.theme : "editorial_dark") as
      | "editorial_dark"
      | "swiss_light"
      | "terminal_contrast"
      | "warm_creator";
    const price = typeof body.price === "string" ? body.price.trim().slice(0, 40) : "";
    const url = typeof body.url === "string" ? body.url.trim().slice(0, 300) : "";

    let isPro = false;
    try {
      isPro = await checkFunnelPro(db, caller.uid, caller.email);
    } catch {
      return res.status(503).json({ error: "Unable to verify ProductWorks subscription status." });
    }

    const reservation = await reserveFunnelGeneration(db, caller.uid, isPro).catch(() => null);
    if (!reservation) return res.status(503).json({ error: "Unable to reserve ProductWorks generation." });
    if (!reservation.allowed) {
      return res.status(reservation.reason === "FREE_USED" ? 403 : 409).json({
        error:
          reservation.reason === "FREE_USED"
            ? "You've used your 1 free ProductWorks generation. Upgrade to Pro for unlimited product packages."
            : "A ProductWorks generation is already in progress. Please wait for it to finish.",
        code: reservation.reason
      });
    }

    try {
      const prompt = buildFunnelPackagePrompt({
        sourceTopic,
        audience,
        outcome,
        title,
        creatorBrand,
        goal,
        theme,
        price
      });
      const model = process.env.FUNNELWORKS_MODEL || "gemini-4-hydrogen";
      const response = await callGenerateContentWithRetry(
        getAI(),
        {
          model,
          contents: prompt,
          config: { responseMimeType: "application/json" },
          strictContentGeneration: true
        },
        2
      );
      const raw = typeof response?.text === "string" ? response.text : "";
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("ProductWorks returned an unreadable response.");
      const parsedPackage = JSON.parse(jsonMatch[0]);
      if (!validateFunnelPackage(parsedPackage)) {
        throw new Error("Generated product package was incomplete. Please try again.");
      }

      const now = new Date().toISOString();
      const record = {
        id: reservation.reservationId,
        createdAt: now,
        updatedAt: now,
        version: 1,
        sourceTopic,
        goal,
        theme,
        creatorHandle: caller.email ? caller.email.split("@")[0] : "creator",
        creatorBrand,
        audience,
        outcome,
        price: price || parsedPackage.storefront?.suggestedPrice || "",
        url,
        slides: parsedPackage.slides,
        companionPosts: parsedPackage.companionPosts,
        playbook: parsedPackage.playbook,
        storefront: parsedPackage.storefront
      };
      await finishFunnelGeneration(db, caller.uid, reservation.reservationId, true, record);
      return res.json({ funnel: record, project: record });
    } catch (error: any) {
      await finishFunnelGeneration(db, caller.uid, reservation.reservationId, false).catch(() => {});
      return res.status(502).json({
        error: error?.message || "ProductWorks generation failed. Your allowance was not used."
      });
    }
  });

  /**
   * ProductWorks Automatic Promotion:
   * Prepares 5 grounded Threads promotional drafts for a saved product using the
   * existing Gemini generation infrastructure & Shared Intelligence voice context.
   *
   * - Idempotent per (projectId, productVersion) unless `forceRegenerate: true`.
   * - Enforces monthly AI generation quota via `checkAndReserveGeneration`.
   * - Strictly grounded: never invents prices, URLs, or testimonials.
   * - Never auto-publishes externally.
   */
  router.post("/projects/:id/promote", async (req, res) => {
    const caller = await verifyCaller(auth, req);
    if (!caller) return res.status(401).json({ error: "Sign in to prepare product promotion drafts." });

    const projectId = String(req.params.id || "").trim();
    const forceRegenerate = req.body?.forceRegenerate === true;
    const docRef = db
      .collection("funnelworks_projects")
      .doc(caller.uid)
      .collection("projects")
      .doc(projectId);

    const snap = await docRef.get();
    if (!snap.exists) {
      return res.status(404).json({ error: "ProductWorks project not found." });
    }

    const project = snap.data() || {};
    const productVersion = typeof project.version === "number" ? project.version : 1;

    // Idempotency guard: prevent duplicate generation on page refresh or retries
    if (
      !forceRegenerate &&
      project.promotionGeneratedForVersion === productVersion &&
      Array.isArray(project.promotionDrafts) &&
      project.promotionDrafts.length > 0
    ) {
      return res.json({
        idempotentHit: true,
        productId: projectId,
        productVersion,
        drafts: project.promotionDrafts,
        generatedAt: project.promotionGeneratedAt
      });
    }

    // Respect existing monthly generation entitlements
    const quota = await checkAndReserveGeneration(db, caller.uid, caller.email);
    if (!quota.allowed) {
      return res.status(403).json({
        error: quota.error || "Monthly AI generation limit reached.",
        usage: quota
      });
    }

    try {
      const intelligence = await retrieveSharedIntelligenceContext(
        {
          userId: caller.uid,
          appId: "productworks",
          taskType: "product_promotion",
          domains: ["identity", "audience"]
        },
        db
      );

      const title = String(project.playbook?.title || project.storefront?.productTitle || project.title || "Digital Product").trim();
      const subtitle = String(project.playbook?.subtitle || "").trim();
      const playbookPoints = Array.isArray(project.playbook?.pages)
        ? project.playbook.pages
            .flatMap((page: any) => (Array.isArray(page.blocks) ? page.blocks : []))
            .map((b: any) => `${b.heading || ""}: ${Array.isArray(b.bullets) ? b.bullets.join("; ") : ""}`)
            .join("\n")
        : "";

      const prompt = buildProductPromotionPrompt({
        title,
        subtitle,
        audience: String(project.audience || intelligence.audienceProfile?.targetAudience || ""),
        outcome: String(project.outcome || intelligence.audienceProfile?.desiredOutcome || ""),
        playbookSummary: playbookPoints,
        price: typeof project.price === "string" ? project.price : "",
        url: typeof project.url === "string" ? project.url : "",
        creatorVoice: intelligence.creatorIdentity?.voiceStyle || ""
      });

      const response = await callGenerateContentWithRetry(
        getAI(),
        {
          model: process.env.FUNNELWORKS_MODEL || "gemini-4-hydrogen",
          contents: prompt,
          config: { responseMimeType: "application/json" },
          strictContentGeneration: true
        },
        2
      );

      const raw = typeof response?.text === "string" ? response.text : "";
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Could not parse promotional drafts response.");
      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed.drafts) || parsed.drafts.length === 0) {
        throw new Error("No promotional drafts were returned.");
      }

      const now = new Date().toISOString();
      const normalizedDrafts = parsed.drafts.slice(0, 5).map((d: any, index: number) => ({
        id: `promo_v${productVersion}_${index + 1}`,
        angle: String(d.angle || `angle_${index + 1}`),
        label: String(d.label || `Draft ${index + 1}`),
        parts: Array.isArray(d.parts)
          ? d.parts.map((p: unknown) => String(p || "").trim()).filter(Boolean)
          : [String(d.text || "").trim()].filter(Boolean),
        sourceProductId: projectId,
        sourceProductTitle: title,
        sourceProductVersion: productVersion,
        transferredToLibrary: false,
        updatedAt: now
      }));

      await docRef.set(
        {
          promotionDrafts: normalizedDrafts,
          promotionGeneratedForVersion: productVersion,
          promotionGeneratedAt: now,
          updatedAt: now
        },
        { merge: true }
      );

      if (!quota.isPro) {
        await commitGeneration(db, caller.uid, quota.reservationId);
      }

      return res.json({
        idempotentHit: false,
        productId: projectId,
        productVersion,
        drafts: normalizedDrafts,
        generatedAt: now
      });
    } catch (error: any) {
      if (!quota.isPro) {
        await releaseReservation(db, caller.uid, quota.reservationId);
      }
      return res.status(502).json({
        error: error?.message || "Failed to prepare promotional drafts."
      });
    }
  });

  /**
   * Transfers a selected ProductWorks promotional draft into the user's
   * ThreadsWorks Content Library as a safe editable draft (NEVER auto-publishes).
   */
  router.post("/projects/:id/transfer-promo-to-library", async (req, res) => {
    const caller = await verifyCaller(auth, req);
    if (!caller) return res.status(401).json({ error: "Sign in to transfer drafts to ThreadsWorks." });

    const projectId = String(req.params.id || "").trim();
    const { draftId, label, parts, sourceProductTitle } = (req.body || {}) as {
      draftId?: string;
      label?: string;
      parts?: string[];
      sourceProductTitle?: string;
    };

    const cleanParts = Array.isArray(parts)
      ? parts.map((p) => String(p || "").trim()).filter(Boolean)
      : [];
    if (cleanParts.length === 0) {
      return res.status(400).json({ error: "Promotional draft text is required." });
    }

    const transferKey = `pw_promo_${caller.uid}_${projectId}_${draftId || "custom"}`;
    const existingSnap = await db
      .collection("posts")
      .where("userId", "==", caller.uid)
      .where("promoTransferKey", "==", transferKey)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      return res.json({
        success: true,
        deduplicated: true,
        postId: existingSnap.docs[0].id
      });
    }

    const now = new Date().toISOString();
    const postRef = db.collection("posts").doc();
    await postRef.set({
      id: postRef.id,
      userId: caller.uid,
      title: `${sourceProductTitle || "ProductWorks"} — ${label || "Promo Draft"}`,
      hook: cleanParts[0].slice(0, 140),
      singlePost: cleanParts.length === 1 ? cleanParts[0] : "",
      threadParts: cleanParts,
      topic: sourceProductTitle || "Product Promotion",
      pillarTitle: "ProductWorks Promotion",
      stage: "draft",
      status: "draft",
      format: cleanParts.length > 1 ? "thread" : "single",
      sourceAppId: "productworks",
      sourceProductId: projectId,
      promoTransferKey: transferKey,
      notes: "Prepared via ProductWorks Automatic Promotion. Review before scheduling or publishing.",
      createdAt: now,
      updatedAt: now,
      isFavorite: false
    });

    return res.json({
      success: true,
      deduplicated: false,
      postId: postRef.id
    });
  });

  return router;
}
