import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { Firestore } from "firebase-admin/firestore";

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // Meta Threads max 8MB
export const THREADS_ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
]);
export const STORAGE_ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export interface StoredImageMetadata {
  imageId: string;
  userId: string;
  postId?: string;
  partIndex: number;
  requestId: string;
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
  aspectRatio: string;
  altText?: string;
  promptSummary: string;
  status: "generated" | "accepted" | "removed";
  storageRef: string;
  createdAt: string;
  updatedAt: string;
  expiresAtMs?: number | null;
}

export interface SaveImageAssetInput {
  imageId: string;
  userId: string;
  postId?: string;
  partIndex: number;
  requestId: string;
  buffer: Buffer;
  mimeType: string;
  aspectRatio: string;
  altText?: string;
  promptSummary: string;
  nowMs?: number;
}

export interface LoadedImageBinary {
  metadata: StoredImageMetadata;
  buffer: Buffer;
}

export interface AiImageAssetStore {
  saveAsset(input: SaveImageAssetInput): Promise<StoredImageMetadata>;
  getMetadata(imageId: string): Promise<StoredImageMetadata | null>;
  loadBinary(imageId: string): Promise<LoadedImageBinary | null>;
  markAccepted(
    imageId: string,
    userId: string,
    postId?: string,
    partIndex?: number
  ): Promise<StoredImageMetadata | null>;
  markRemoved(imageId: string, userId: string): Promise<boolean>;
  cleanupExpiredUnaccepted(nowMs?: number): Promise<number>;
}

const SAFE_ID_REGEX = /^[a-zA-Z0-9_-]{4,96}$/;
const UNACCEPTED_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours for unaccepted temporary previews

export function sanitizeIdentifier(id: string): string {
  const cleaned = String(id || "").replace(/[^a-zA-Z0-9_-]/g, "");
  if (!SAFE_ID_REGEX.test(cleaned)) {
    throw new Error("Invalid image or user identifier.");
  }
  return cleaned;
}

export function extensionForMimeType(mimeType: string): string {
  switch (mimeType.toLowerCase()) {
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      throw new Error(`Unsupported image MIME type: ${mimeType}`);
  }
}

/**
 * Validates binary magic bytes and extracts width/height directly from PNG, JPEG, or WebP headers.
 */
export function inspectImageBuffer(
  buffer: Buffer,
  declaredMimeType?: string
): { mimeType: string; width: number; height: number; byteSize: number } {
  if (!Buffer.isBuffer(buffer) || buffer.length < 24) {
    throw new Error("Generated image payload is empty or truncated.");
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new Error("Generated image exceeds the 8MB Meta Threads limit.");
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A, IHDR width at offset 16, height at offset 20
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    if (width <= 0 || height <= 0) {
      throw new Error("Invalid PNG dimensions.");
    }
    return { mimeType: "image/png", width, height, byteSize: buffer.length };
  }

  // JPEG: FF D8
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    let width = 0;
    let height = 0;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = buffer[offset + 1];
      // SOF0..SOF3, SOF5..SOF7, SOF9..SOF11, SOF13..SOF15
      const isSof =
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf);
      if (isSof) {
        height = buffer.readUInt16BE(offset + 5);
        width = buffer.readUInt16BE(offset + 7);
        break;
      }
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
        offset += 2;
        continue;
      }
      if (offset + 4 >= buffer.length) break;
      const segLen = buffer.readUInt16BE(offset + 2);
      if (segLen < 2) break;
      offset += 2 + segLen;
    }
    if (width <= 0 || height <= 0) {
      // Valid JPEG header but exotic marker layout; enforce sane fallback dimensions check
      throw new Error("Unable to verify JPEG image dimensions.");
    }
    return { mimeType: "image/jpeg", width, height, byteSize: buffer.length };
  }

  // WebP: RIFF....WEBP
  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    const chunkHeader = buffer.subarray(12, 16).toString("ascii");
    let width = 0;
    let height = 0;
    if (chunkHeader === "VP8X" && buffer.length >= 30) {
      width = 1 + buffer.readUIntLE(24, 3);
      height = 1 + buffer.readUIntLE(27, 3);
    } else if (chunkHeader === "VP8 " && buffer.length >= 30) {
      width = buffer.readUInt16LE(26) & 0x3fff;
      height = buffer.readUInt16LE(28) & 0x3fff;
    } else if (chunkHeader === "VP8L" && buffer.length >= 25) {
      const bits = buffer.readUInt32LE(21);
      width = (bits & 0x3fff) + 1;
      height = ((bits >> 14) & 0x3fff) + 1;
    }
    if (width <= 0 || height <= 0) {
      throw new Error("Unable to verify WebP image dimensions.");
    }
    return { mimeType: "image/webp", width, height, byteSize: buffer.length };
  }

  throw new Error(
    `Unsupported or corrupted image data (declared: ${declaredMimeType || "unknown"}).`
  );
}

// Ephemeral fallback signing key if env var is not configured
let cachedFallbackSigningSecret: string | null = null;

function getMediaSigningSecret(): string {
  const fromEnv =
    process.env.THREADS_MEDIA_SIGNING_SECRET ||
    process.env.MEDIA_SIGNING_SECRET ||
    process.env.SESSION_SECRET;
  if (fromEnv && fromEnv.trim().length >= 16) {
    return fromEnv.trim();
  }
  if (!cachedFallbackSigningSecret) {
    cachedFallbackSigningSecret = crypto.randomBytes(32).toString("hex");
  }
  return cachedFallbackSigningSecret;
}

export function createPublicMediaSignature(
  imageId: string,
  expiresAtMs: number
): string {
  const secret = getMediaSigningSecret();
  return crypto
    .createHmac("sha256", secret)
    .update(`${imageId}:${expiresAtMs}`)
    .digest("hex");
}

export function verifyPublicMediaSignature(
  imageId: string,
  expiresAtMs: number,
  signature: string,
  nowMs: number = Date.now()
): boolean {
  if (!imageId || !signature || !Number.isFinite(expiresAtMs)) {
    return false;
  }
  if (expiresAtMs <= nowMs) {
    return false;
  }
  const expected = createPublicMediaSignature(imageId, expiresAtMs);
  const sigBuf = Buffer.from(signature, "utf8");
  const expBuf = Buffer.from(expected, "utf8");
  if (sigBuf.length !== expBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(sigBuf, expBuf);
}

export function buildSignedPublicImageUrl(
  baseUrl: string,
  imageId: string,
  ttlMs: number = 30 * 60 * 1000,
  nowMs: number = Date.now()
): string {
  const cleanBase = baseUrl.replace(/\/+$/, "");
  const exp = nowMs + ttlMs;
  const sig = createPublicMediaSignature(imageId, exp);
  return `${cleanBase}/api/images/public/${encodeURIComponent(imageId)}?exp=${exp}&sig=${sig}`;
}

/**
 * Production disk + Firestore metadata asset store with strict path confinement
 * and zero large binary blobs stored directly in Firestore documents.
 */
export class DiskFirestoreImageAssetStore implements AiImageAssetStore {
  private readonly baseDir: string;
  private readonly serverDb: Firestore | null;
  private readonly metaCache = new Map<string, StoredImageMetadata>();

  constructor(options: { baseDir?: string; serverDb?: Firestore | null }) {
    this.baseDir = path.resolve(
      options.baseDir || path.join(process.cwd(), ".threadsworks-media")
    );
    this.serverDb = options.serverDb || null;
  }

  private resolveSafeFilePath(userId: string, imageId: string, ext: string): string {
    const safeUid = sanitizeIdentifier(userId);
    const safeImageId = sanitizeIdentifier(imageId);
    const userDir = path.resolve(this.baseDir, safeUid);
    if (!userDir.startsWith(this.baseDir + path.sep)) {
      throw new Error("Invalid media storage directory path.");
    }
    const targetPath = path.resolve(userDir, `${safeImageId}.${ext}`);
    if (!targetPath.startsWith(userDir + path.sep)) {
      throw new Error("Invalid media file target path.");
    }
    return targetPath;
  }

  async saveAsset(input: SaveImageAssetInput): Promise<StoredImageMetadata> {
    const nowMs = input.nowMs ?? Date.now();
    const inspected = inspectImageBuffer(input.buffer, input.mimeType);
    if (!STORAGE_ALLOWED_MIME_TYPES.has(inspected.mimeType)) {
      throw new Error(`Unsupported image format: ${inspected.mimeType}`);
    }

    const ext = extensionForMimeType(inspected.mimeType);
    const filePath = this.resolveSafeFilePath(input.userId, input.imageId, ext);
    const dir = path.dirname(filePath);

    fs.mkdirSync(dir, { recursive: true });
    // Atomic temp-then-rename write
    const tmpPath = `${filePath}.${crypto.randomBytes(6).toString("hex")}.tmp`;
    try {
      fs.writeFileSync(tmpPath, input.buffer);
      fs.renameSync(tmpPath, filePath);
    } catch (err) {
      try {
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
      } catch (_) {}
      throw err;
    }

    const nowIso = new Date(nowMs).toISOString();
    const metadata: StoredImageMetadata = {
      imageId: sanitizeIdentifier(input.imageId),
      userId: sanitizeIdentifier(input.userId),
      ...(input.postId ? { postId: String(input.postId).slice(0, 128) } : {}),
      partIndex: Math.max(0, Math.floor(input.partIndex || 0)),
      requestId: String(input.requestId).slice(0, 128),
      mimeType: inspected.mimeType,
      byteSize: inspected.byteSize,
      width: inspected.width,
      height: inspected.height,
      aspectRatio: input.aspectRatio || "1:1",
      altText: input.altText || "",
      promptSummary: input.promptSummary || "",
      status: "generated",
      storageRef: path.relative(this.baseDir, filePath),
      createdAt: nowIso,
      updatedAt: nowIso,
      expiresAtMs: nowMs + UNACCEPTED_TTL_MS,
    };

    if (this.serverDb) {
      await this.serverDb
        .collection("ai_image_assets")
        .doc(metadata.imageId)
        .set(metadata, { merge: true });
    }
    this.metaCache.set(metadata.imageId, metadata);
    return metadata;
  }

  async getMetadata(imageId: string): Promise<StoredImageMetadata | null> {
    let safeId: string;
    try {
      safeId = sanitizeIdentifier(imageId);
    } catch {
      return null;
    }

    const cached = this.metaCache.get(safeId);
    if (cached) return cached;

    if (this.serverDb) {
      const snap = await this.serverDb
        .collection("ai_image_assets")
        .doc(safeId)
        .get();
      if (snap.exists) {
        const data = snap.data() as StoredImageMetadata;
        this.metaCache.set(safeId, data);
        return data;
      }
    }
    return null;
  }

  async loadBinary(imageId: string): Promise<LoadedImageBinary | null> {
    const metadata = await this.getMetadata(imageId);
    if (!metadata || metadata.status === "removed") return null;

    const resolvedPath = path.resolve(this.baseDir, metadata.storageRef);
    if (!resolvedPath.startsWith(this.baseDir + path.sep)) {
      return null;
    }
    if (!fs.existsSync(resolvedPath)) {
      return null;
    }
    const buffer = fs.readFileSync(resolvedPath);
    return { metadata, buffer };
  }

  async markAccepted(
    imageId: string,
    userId: string,
    postId?: string,
    partIndex?: number
  ): Promise<StoredImageMetadata | null> {
    const metadata = await this.getMetadata(imageId);
    if (!metadata || metadata.userId !== sanitizeIdentifier(userId)) {
      return null;
    }
    const updated: StoredImageMetadata = {
      ...metadata,
      status: "accepted",
      ...(postId ? { postId: String(postId).slice(0, 128) } : {}),
      ...(typeof partIndex === "number"
        ? { partIndex: Math.max(0, Math.floor(partIndex)) }
        : {}),
      expiresAtMs: null,
      updatedAt: new Date().toISOString(),
    };

    if (this.serverDb) {
      await this.serverDb
        .collection("ai_image_assets")
        .doc(updated.imageId)
        .set(updated, { merge: true });
    }
    this.metaCache.set(updated.imageId, updated);
    return updated;
  }

  async markRemoved(imageId: string, userId: string): Promise<boolean> {
    const metadata = await this.getMetadata(imageId);
    if (!metadata || metadata.userId !== sanitizeIdentifier(userId)) {
      return false;
    }

    const updated: StoredImageMetadata = {
      ...metadata,
      status: "removed",
      updatedAt: new Date().toISOString(),
    };

    if (this.serverDb) {
      await this.serverDb
        .collection("ai_image_assets")
        .doc(updated.imageId)
        .set(updated, { merge: true });
    }
    this.metaCache.set(updated.imageId, updated);

    const resolvedPath = path.resolve(this.baseDir, metadata.storageRef);
    if (
      resolvedPath.startsWith(this.baseDir + path.sep) &&
      fs.existsSync(resolvedPath)
    ) {
      try {
        fs.unlinkSync(resolvedPath);
      } catch (_) {}
    }
    return true;
  }

  async cleanupExpiredUnaccepted(nowMs: number = Date.now()): Promise<number> {
    let cleaned = 0;
    for (const [id, meta] of this.metaCache.entries()) {
      if (
        meta.status === "generated" &&
        typeof meta.expiresAtMs === "number" &&
        meta.expiresAtMs <= nowMs
      ) {
        const ok = await this.markRemoved(id, meta.userId);
        if (ok) cleaned++;
      }
    }
    return cleaned;
  }
}

/**
 * In-memory asset store for deterministic unit/integration tests and fault injection.
 */
export class InMemoryImageAssetStore implements AiImageAssetStore {
  public readonly records = new Map<
    string,
    { metadata: StoredImageMetadata; buffer: Buffer }
  >();
  public failNextSaveError: Error | null = null;

  async saveAsset(input: SaveImageAssetInput): Promise<StoredImageMetadata> {
    if (this.failNextSaveError) {
      const err = this.failNextSaveError;
      this.failNextSaveError = null;
      throw err;
    }
    const nowMs = input.nowMs ?? Date.now();
    const inspected = inspectImageBuffer(input.buffer, input.mimeType);
    const nowIso = new Date(nowMs).toISOString();
    const metadata: StoredImageMetadata = {
      imageId: sanitizeIdentifier(input.imageId),
      userId: sanitizeIdentifier(input.userId),
      ...(input.postId ? { postId: input.postId } : {}),
      partIndex: Math.max(0, Math.floor(input.partIndex || 0)),
      requestId: input.requestId,
      mimeType: inspected.mimeType,
      byteSize: inspected.byteSize,
      width: inspected.width,
      height: inspected.height,
      aspectRatio: input.aspectRatio || "1:1",
      altText: input.altText || "",
      promptSummary: input.promptSummary || "",
      status: "generated",
      storageRef: `mem://${input.userId}/${input.imageId}`,
      createdAt: nowIso,
      updatedAt: nowIso,
      expiresAtMs: nowMs + UNACCEPTED_TTL_MS,
    };
    this.records.set(metadata.imageId, {
      metadata,
      buffer: Buffer.from(input.buffer),
    });
    return metadata;
  }

  async getMetadata(imageId: string): Promise<StoredImageMetadata | null> {
    return this.records.get(imageId)?.metadata ?? null;
  }

  async loadBinary(imageId: string): Promise<LoadedImageBinary | null> {
    const rec = this.records.get(imageId);
    if (!rec || rec.metadata.status === "removed") return null;
    return { metadata: rec.metadata, buffer: Buffer.from(rec.buffer) };
  }

  async markAccepted(
    imageId: string,
    userId: string,
    postId?: string,
    partIndex?: number
  ): Promise<StoredImageMetadata | null> {
    const rec = this.records.get(imageId);
    if (!rec || rec.metadata.userId !== userId) return null;
    const updated: StoredImageMetadata = {
      ...rec.metadata,
      status: "accepted",
      ...(postId ? { postId } : {}),
      ...(typeof partIndex === "number"
        ? { partIndex: Math.max(0, Math.floor(partIndex)) }
        : {}),
      expiresAtMs: null,
      updatedAt: new Date().toISOString(),
    };
    rec.metadata = updated;
    return updated;
  }

  async markRemoved(imageId: string, userId: string): Promise<boolean> {
    const rec = this.records.get(imageId);
    if (!rec || rec.metadata.userId !== userId) return false;
    rec.metadata = {
      ...rec.metadata,
      status: "removed",
      updatedAt: new Date().toISOString(),
    };
    return true;
  }

  async cleanupExpiredUnaccepted(nowMs: number = Date.now()): Promise<number> {
    let count = 0;
    for (const [id, rec] of this.records.entries()) {
      if (
        rec.metadata.status === "generated" &&
        typeof rec.metadata.expiresAtMs === "number" &&
        rec.metadata.expiresAtMs <= nowMs
      ) {
        await this.markRemoved(id, rec.metadata.userId);
        count++;
      }
    }
    return count;
  }
}
