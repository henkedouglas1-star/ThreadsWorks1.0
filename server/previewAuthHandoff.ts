import crypto from "crypto";
import express from "express";
import type { Auth as AdminAuth } from "firebase-admin/auth";

export interface PreviewHandoffRecord {
  handoffId: string;
  claimHash: string;
  status: "pending" | "ready" | "cancelled";
  uid?: string;
  googleIdToken?: string | null;
  googleAccessToken?: string | null;
  createdAt: number;
  expiresAt: number;
}

export interface PreviewHandoffStoreOptions {
  ttlMs?: number;
  readyTtlMs?: number;
  maxRecords?: number;
  now?: () => number;
}

const HEX_ID_PATTERN = /^[a-f0-9]{32,96}$/i;
const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/i;

export function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function timingSafeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

export function isPreviewAuthHandoffEnvironment(env: NodeJS.ProcessEnv = process.env): boolean {
  return (
    env.NODE_ENV !== "production" ||
    Boolean(env.APPLET_ID) ||
    Boolean(env.K_SERVICE && /^ais-(dev|pre)-/i.test(env.K_SERVICE))
  );
}

/**
 * Memory-only, single-use, proof-of-possession OAuth credential handoff store for
 * real Google Sign-In inside Google AI Studio Preview iframes.
 *
 * Security invariants:
 * - Never active in standalone production deployments.
 * - Never persists tokens to disk or Firestore.
 * - Requires real firebase-admin verifyIdToken() before storing any OAuth credential.
 * - Requires SHA-256 timing-safe proof-of-possession (claimSecret kept only in iframe sessionStorage)
 *   to claim credentials, and deletes the entry immediately on claim (strictly single-use).
 */
export function createPreviewAuthHandoffStore(options: PreviewHandoffStoreOptions = {}) {
  const ttlMs = options.ttlMs ?? 180_000;
  const readyTtlMs = options.readyTtlMs ?? 90_000;
  const maxRecords = options.maxRecords ?? 25;
  const now = options.now ?? (() => Date.now());
  const records = new Map<string, PreviewHandoffRecord>();

  function prune(): void {
    const t = now();
    for (const [id, rec] of records.entries()) {
      if (rec.expiresAt <= t) {
        records.delete(id);
      }
    }
    while (records.size > maxRecords) {
      const oldestKey = records.keys().next().value;
      if (!oldestKey) break;
      records.delete(oldestKey);
    }
  }

  function init(handoffId: string, claimHash: string): { ok: true } | { ok: false; error: string } {
    prune();
    if (!HEX_ID_PATTERN.test(handoffId)) {
      return { ok: false, error: "Invalid handoffId format." };
    }
    if (!SHA256_HEX_PATTERN.test(claimHash)) {
      return { ok: false, error: "Invalid claimHash format." };
    }
    const existing = records.get(handoffId);
    if (existing) {
      if (timingSafeHexEqual(existing.claimHash, claimHash.toLowerCase())) {
        return { ok: true };
      }
      return { ok: false, error: "Handoff already registered." };
    }
    const t = now();
    records.set(handoffId, {
      handoffId,
      claimHash: claimHash.toLowerCase(),
      status: "pending",
      createdAt: t,
      expiresAt: t + ttlMs,
    });
    return { ok: true };
  }

  function complete(
    handoffId: string,
    payload: {
      uid: string;
      googleIdToken?: string | null;
      googleAccessToken?: string | null;
    }
  ): { ok: true } | { ok: false; statusCode: number; error: string } {
    prune();
    const record = records.get(handoffId);
    if (!record) {
      return { ok: false, statusCode: 404, error: "Handoff session not found or expired." };
    }
    if (record.status !== "pending") {
      return { ok: false, statusCode: 409, error: "Handoff session already completed." };
    }
    const idToken = typeof payload.googleIdToken === "string" && payload.googleIdToken.trim() ? payload.googleIdToken.trim() : null;
    const accessToken = typeof payload.googleAccessToken === "string" && payload.googleAccessToken.trim() ? payload.googleAccessToken.trim() : null;
    if (!idToken && !accessToken) {
      return { ok: false, statusCode: 400, error: "Missing Google OAuth credential." };
    }
    record.status = "ready";
    record.uid = payload.uid;
    record.googleIdToken = idToken;
    record.googleAccessToken = accessToken;
    record.expiresAt = now() + readyTtlMs;
    return { ok: true };
  }

  function cancel(handoffId: string): { ok: true } | { ok: false; statusCode: number; error: string } {
    prune();
    const record = records.get(handoffId);
    if (!record) {
      return { ok: false, statusCode: 404, error: "Handoff session not found." };
    }
    if (record.status === "pending") {
      record.status = "cancelled";
      record.expiresAt = now() + 30_000;
    }
    return { ok: true };
  }

  function claim(
    handoffId: string,
    claimSecret: string
  ):
    | { status: "pending" }
    | { status: "cancelled" }
    | { status: "expired" }
    | { status: "forbidden" }
    | { status: "ready"; googleIdToken: string | null; googleAccessToken: string | null } {
    prune();
    if (!HEX_ID_PATTERN.test(handoffId) || !HEX_ID_PATTERN.test(claimSecret)) {
      return { status: "forbidden" };
    }
    const record = records.get(handoffId);
    if (!record) {
      return { status: "expired" };
    }
    const computedHash = sha256Hex(claimSecret);
    if (!timingSafeHexEqual(computedHash, record.claimHash)) {
      return { status: "forbidden" };
    }
    if (record.status === "pending") {
      return { status: "pending" };
    }
    if (record.status === "cancelled") {
      records.delete(handoffId);
      return { status: "cancelled" };
    }
    // Single-use: immediately delete upon successful claim
    records.delete(handoffId);
    return {
      status: "ready",
      googleIdToken: record.googleIdToken || null,
      googleAccessToken: record.googleAccessToken || null,
    };
  }

  return { init, complete, cancel, claim, size: () => { prune(); return records.size; } };
}

export function createPreviewAuthHandoffRouter(
  serverAuth: Pick<AdminAuth, "verifyIdToken">,
  options: PreviewHandoffStoreOptions = {}
): express.Router {
  const router = express.Router();
  const store = createPreviewAuthHandoffStore(options);

  router.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    next();
  });

  router.post("/init", (req, res) => {
    const handoffId = typeof req.body?.handoffId === "string" ? req.body.handoffId.trim() : "";
    const claimHash = typeof req.body?.claimHash === "string" ? req.body.claimHash.trim() : "";
    const result = store.init(handoffId, claimHash);
    if ("error" in result) {
      return res.status(400).json({ error: result.error });
    }
    return res.status(200).json({ ok: true });
  });

  router.post("/complete", async (req, res) => {
    const handoffId = typeof req.body?.handoffId === "string" ? req.body.handoffId.trim() : "";
    const firebaseIdToken =
      typeof req.body?.firebaseIdToken === "string" ? req.body.firebaseIdToken.trim() : "";
    const googleIdToken =
      typeof req.body?.googleIdToken === "string" ? req.body.googleIdToken.trim() : null;
    const googleAccessToken =
      typeof req.body?.googleAccessToken === "string" ? req.body.googleAccessToken.trim() : null;

    if (!HEX_ID_PATTERN.test(handoffId)) {
      return res.status(400).json({ error: "Invalid handoffId." });
    }
    if (!firebaseIdToken) {
      return res.status(401).json({ error: "Missing Firebase ID token." });
    }

    let decodedUid: string;
    try {
      const decoded = await serverAuth.verifyIdToken(firebaseIdToken);
      if (!decoded?.uid) {
        return res.status(401).json({ error: "Invalid Firebase ID token." });
      }
      decodedUid = decoded.uid;
    } catch {
      return res.status(401).json({ error: "Firebase ID token verification failed." });
    }

    const result = store.complete(handoffId, {
      uid: decodedUid,
      googleIdToken,
      googleAccessToken,
    });
    if ("error" in result) {
      return res.status(result.statusCode).json({ error: result.error });
    }
    return res.status(200).json({ ok: true });
  });

  router.post("/cancel", (req, res) => {
    const handoffId = typeof req.body?.handoffId === "string" ? req.body.handoffId.trim() : "";
    if (!HEX_ID_PATTERN.test(handoffId)) {
      return res.status(400).json({ error: "Invalid handoffId." });
    }
    store.cancel(handoffId);
    return res.status(200).json({ ok: true });
  });

  router.post("/claim", (req, res) => {
    const handoffId = typeof req.body?.handoffId === "string" ? req.body.handoffId.trim() : "";
    const claimSecret =
      typeof req.body?.claimSecret === "string" ? req.body.claimSecret.trim() : "";
    const result = store.claim(handoffId, claimSecret);
    if (result.status === "forbidden") {
      return res.status(403).json({ status: "forbidden", error: "Invalid handoff credentials." });
    }
    if (result.status === "expired") {
      return res.status(404).json({ status: "expired" });
    }
    return res.status(200).json(result);
  });

  return router;
}
