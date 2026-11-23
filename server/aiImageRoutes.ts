import type { Express, Request, Response } from "express";
import type { AiImageService } from "./aiImageService";
import {
  type AiImageAssetStore,
  verifyPublicMediaSignature,
} from "./aiImageStorage";
import type { ImageGenerationRequestPayload } from "../src/types/aiImage";

export interface AuthenticatedRouteUser {
  uid: string;
  email?: string;
}

export type VerifyRouteUserFn = (
  req: Request
) => Promise<AuthenticatedRouteUser | null>;

/**
 * Registers all ThreadsWorks AI image generation, allowance, recovery, and
 * creator-isolated media delivery routes on the Express app.
 */
export function registerImageGenerationRoutes(params: {
  app: Express;
  service: AiImageService;
  assetStore: AiImageAssetStore;
  verifyAuth: VerifyRouteUserFn;
  nowFn?: () => Date;
}) {
  const { app, service, assetStore, verifyAuth, nowFn = () => new Date() } = params;

  // 1. GET /api/images/allowance — Authoritative allowance status + recovery lookup
  app.get("/api/images/allowance", async (req: Request, res: Response) => {
    const authUser = await verifyAuth(req);
    if (!authUser?.uid || authUser.uid === "anonymous") {
      return res.status(401).json({
        success: false,
        error: "Authentication required to check AI image allowance.",
        errorCode: "UNAUTHENTICATED",
      });
    }

    try {
      const postId =
        typeof req.query.postId === "string" ? req.query.postId.trim() : undefined;
      const requestId =
        typeof req.query.requestId === "string"
          ? req.query.requestId.trim()
          : undefined;

      const result = await service.getAllowanceAndRecovery({
        userId: authUser.uid,
        email: authUser.email,
        postId,
        requestId,
      });

      return res.status(200).json({
        success: true,
        allowance: result.allowance,
        recoverableImage: result.recoverableImage,
      });
    } catch (err: any) {
      console.error("[AI_IMAGE_ALLOWANCE_ERROR]", err?.message || err);
      return res.status(500).json({
        success: false,
        error: "Unable to load AI image allowance right now.",
      });
    }
  });

  // 2. POST /api/images/generate — Generate contextual AI image with atomic server enforcement
  app.post("/api/images/generate", async (req: Request, res: Response) => {
    const authUser = await verifyAuth(req);
    if (!authUser?.uid || authUser.uid === "anonymous") {
      return res.status(401).json({
        success: false,
        error: "Authentication required to generate AI images.",
        errorCode: "UNAUTHENTICATED",
      });
    }

    try {
      // Strictly pick only expected prompt fields — ignore any client-supplied plan/tier/userId
      const raw = req.body || {};
      const payload: ImageGenerationRequestPayload = {
        requestId: String(raw.requestId || "").trim(),
        postId: raw.postId ? String(raw.postId).trim() : undefined,
        postText: String(raw.postText || ""),
        parts: Array.isArray(raw.parts)
          ? raw.parts.map((p: unknown) => String(p || ""))
          : undefined,
        partIndex:
          typeof raw.partIndex === "number" ? raw.partIndex : undefined,
        topic: raw.topic ? String(raw.topic) : undefined,
        pillarTitle: raw.pillarTitle ? String(raw.pillarTitle) : undefined,
        tone: raw.tone ? String(raw.tone) : undefined,
        audience: raw.audience ? String(raw.audience) : undefined,
        brandStyle: raw.brandStyle ? String(raw.brandStyle) : undefined,
        brandColors: Array.isArray(raw.brandColors)
          ? raw.brandColors.map((c: unknown) => String(c || ""))
          : undefined,
        visualDirection: raw.visualDirection
          ? String(raw.visualDirection)
          : undefined,
        aspectRatio: raw.aspectRatio,
        isRegeneration: Boolean(raw.isRegeneration),
      };

      const { statusCode, body } = await service.generatePostImage({
        userId: authUser.uid,
        email: authUser.email,
        payload,
      });

      return res.status(statusCode).json(body);
    } catch (err: any) {
      console.error("[AI_IMAGE_GENERATE_ROUTE_ERROR]", err?.message || err);
      return res.status(500).json({
        success: false,
        error: "Unexpected error while generating image.",
      });
    }
  });

  // 3. POST /api/images/:imageId/accept — Mark generated image accepted/attached (never consumes allowance)
  app.post("/api/images/:imageId/accept", async (req: Request, res: Response) => {
    const authUser = await verifyAuth(req);
    if (!authUser?.uid || authUser.uid === "anonymous") {
      return res.status(401).json({
        success: false,
        error: "Authentication required.",
        errorCode: "UNAUTHENTICATED",
      });
    }

    const imageId = String(req.params.imageId || "").trim();
    const postId = req.body?.postId ? String(req.body.postId).trim() : undefined;
    const partIndex =
      typeof req.body?.partIndex === "number" ? req.body.partIndex : undefined;

    const result = await service.acceptImage({
      userId: authUser.uid,
      imageId,
      postId,
      partIndex,
    });

    return res.status(result.statusCode).json({
      success: result.ok,
      image: result.image,
      error: result.error,
    });
  });

  // 4. DELETE /api/images/:imageId — Remove image owned by creator (never refunds committed allowance)
  app.delete("/api/images/:imageId", async (req: Request, res: Response) => {
    const authUser = await verifyAuth(req);
    if (!authUser?.uid || authUser.uid === "anonymous") {
      return res.status(401).json({
        success: false,
        error: "Authentication required.",
        errorCode: "UNAUTHENTICATED",
      });
    }

    const imageId = String(req.params.imageId || "").trim();
    const result = await service.removeImage({
      userId: authUser.uid,
      imageId,
    });

    return res.status(result.statusCode).json({
      success: result.ok,
      error: result.error,
    });
  });

  // 5. GET /api/images/asset/:imageId — Creator-isolated authenticated image preview/download
  app.get("/api/images/asset/:imageId", async (req: Request, res: Response) => {
    const authUser = await verifyAuth(req);
    if (!authUser?.uid || authUser.uid === "anonymous") {
      return res.status(401).json({
        success: false,
        error: "Authentication required to access this image.",
      });
    }

    const imageId = String(req.params.imageId || "").trim();
    const loaded = await service.loadOwnedImage({
      userId: authUser.uid,
      imageId,
    });

    if (!loaded.ok || !loaded.buffer || !loaded.mimeType) {
      return res.status(loaded.statusCode).json({
        success: false,
        error: loaded.error || "Image unavailable.",
      });
    }

    res.setHeader("Content-Type", loaded.mimeType);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.status(200).send(loaded.buffer);
  });

  // 6. GET /api/images/public/:imageId — HMAC-signed temporary delivery for Meta Threads ingestion ONLY
  app.get("/api/images/public/:imageId", async (req: Request, res: Response) => {
    const imageId = String(req.params.imageId || "").trim();
    const exp = Number(req.query.exp);
    const sig = typeof req.query.sig === "string" ? req.query.sig : "";

    if (!verifyPublicMediaSignature(imageId, exp, sig, nowFn().getTime())) {
      return res.status(403).type("text/plain").send("Invalid or expired media token.");
    }

    const loaded = await assetStore.loadBinary(imageId);
    if (!loaded) {
      return res.status(404).type("text/plain").send("Media asset not found.");
    }

    res.setHeader("Content-Type", loaded.metadata.mimeType);
    res.setHeader("Cache-Control", "public, max-age=600");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.status(200).send(loaded.buffer);
  });
}
