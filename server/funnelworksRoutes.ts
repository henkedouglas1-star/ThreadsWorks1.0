import { Router } from "express";
import type { Firestore } from "firebase-admin/firestore";
import type { Auth } from "firebase-admin/auth";
import { getAI, callGenerateContentWithRetry } from "./geminiClient";
import { checkFunnelPro, reserveFunnelGeneration, finishFunnelGeneration } from "./funnelworksUsageService";
import { validateFunnelPackage } from "./funnelworksValidation";

export function createFunnelworksRouter(db: Firestore, firebaseAuth: Auth): Router {
  const router = Router();

  router.get("/projects", async (req, res) => {
    const bearer = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!bearer) return res.status(401).json({ error: "Sign in to view your projects." });
    try {
      const user = await firebaseAuth.verifyIdToken(bearer, true);
      const snap = await db.collection("funnelworks_projects").doc(user.uid)
        .collection("projects").orderBy("createdAt", "desc").limit(30).get();
      return res.json({ projects: snap.docs.map(doc => doc.data()) });
    } catch (error) {
      console.error("[FUNNELWORKS] Project retrieval failed", error);
      return res.status(503).json({ error: "Could not load saved projects." });
    }
  });

  router.post("/generate", async (req, res) => {
    const bearer = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!bearer) return res.status(401).json({ error: "Sign in to generate a funnel." });
    let uid: string;
    let email: string | undefined;
    try {
      const verified = await firebaseAuth.verifyIdToken(bearer, true);
      uid = verified.uid;
      email = verified.email;
    } catch {
      return res.status(401).json({ error: "Your session has expired. Please sign in again." });
    }

    const concept = req.body?.concept;
    const valid = concept && ["lead_magnet", "impulse_product"].includes(concept.goal)
      && ["editorial_dark", "swiss_light", "terminal_contrast", "warm_creator"].includes(concept.theme)
      && ["source", "audience", "outcome", "title"].every(k =>
        typeof concept[k] === "string" && concept[k].trim().length >= (k === "source" ? 10 : 1)
        && concept[k].length <= (k === "source" ? 4000 : 200));
    if (!valid) return res.status(400).json({ error: "Complete the product concept before generating." });

    let reservationId: string | undefined;
    let committed = false;
    try {
      const pro = await checkFunnelPro(db, uid, email);
      const reservation = await reserveFunnelGeneration(db, uid, pro);
      if (!reservation.allowed) {
        return res.status(403).json({
          code: reservation.reason,
          error: reservation.reason === "FREE_USED"
            ? "Your free FunnelWorks generation has been used. Upgrade to Pro for unlimited generations."
            : "A funnel generation is already in progress."
        });
      }
      reservationId = reservation.reservationId;

      const response = await callGenerateContentWithRetry(getAI(), {
        optimizationTaskId: "FUNNELWORKS_PACKAGE",
        optimizationComplexity: "LEVEL_2_STANDARD",
        strictContentGeneration: true,
        model: process.env.FUNNELWORKS_GEMINI_MODEL || "gemini-3.6-flash",
        contents: JSON.stringify({
          instruction: "Create one practical, accurate digital-product launch package. Avoid invented results, unverifiable promises, and generic filler. Return ONLY a valid JSON object, no markdown. The slides must contain exactly seven items: hook, five numbered steps, CTA. Playbook must have exactly two pages. The companion posts must suit Threads (under 500 chars), X (under 280 chars), and LinkedIn. Every part must reinforce the same buyer outcome.",
          shape: {
            slides: [{ slideNumber: 1, role: "hook|step|cta", eyebrow: "text", headline: "text", body: "text" }],
            playbook: { title: "text", subtitle: "text", pages: [{ pageNumber: 1, sectionTitle: "text", summary: "text", blocks: [{ heading: "text", bullets: ["text"] }] }] },
            companionPosts: { threads: "text", x: "text", linkedin: "text" },
            storefront: { productTitle: "text", suggestedPrice: "text", outcomeBullets: ["text", "text", "text"], checkoutDescription: "text", orderBumpPitch: "text", ctaKeyword: "text" }
          },
          concept
        }),
        config: { responseMimeType: "application/json", maxOutputTokens: 6500 }
      });
      if (response.isSimulated) throw new Error("Live AI generation unavailable.");
      const raw = String(response.text || "").trim();
      const parsed = JSON.parse(raw);
      if (!validateFunnelPackage(parsed)) throw new Error("Incomplete AI response. Please retry.");
      const funnel = { id: reservationId, createdAt: new Date().toISOString(),
        sourceTopic: concept.source, goal: concept.goal, theme: concept.theme,
        creatorHandle: "", ...parsed };
      await finishFunnelGeneration(db, uid, reservationId!, true, funnel);
      committed = true;
      return res.json({ success: true, funnel });
    } catch (error) {
      console.error("[FUNNELWORKS] Generation failed", error);
      return res.status(503).json({ error: "Funnel generation could not finish. Please try again." });
    } finally {
      if (reservationId && !committed) {
        try { await finishFunnelGeneration(db, uid, reservationId, false); }
        catch (error) { console.error("[FUNNELWORKS] Usage finalization failed", error); }
      }
    }
  });
  return router;
}
