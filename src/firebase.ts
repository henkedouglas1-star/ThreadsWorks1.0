import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  initializeAuth,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  inMemoryPersistence,
  browserPopupRedirectResolver,
  type Auth,
} from "firebase/auth";
import { initializeFirestore, memoryLocalCache, doc, getDoc, setDoc, setLogLevel, Timestamp } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";
import {
  configureAuthPersistenceWithFallback,
  type AuthPersistenceResult,
} from "./lib/authContract";

// Silence internal Firestore SDK diagnostic logs
setLogLevel("silent");

// Filter out internal benign BloomFilter SDK notices and closing IDBDatabase events from console logging methods
if (typeof window !== "undefined") {
  const isBenignSystemError = (...args: any[]) => {
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
             msg.includes("Applying bloom filter failed") ||
             msg.includes("database connection is closing") ||
             msg.includes("Failed to execute 'transaction' on 'IDBDatabase'") ||
             msg.includes("IDBDatabase");
    } catch {
      return false;
    }
  };

  const origError = console.error;
  console.error = (...args: any[]) => {
    if (isBenignSystemError(...args)) return;
    origError.apply(console, args);
  };

  const origWarn = console.warn;
  console.warn = (...args: any[]) => {
    if (isBenignSystemError(...args)) return;
    origWarn.apply(console, args);
  };

  // Intercept window unhandled rejection and error events for closing IDBDatabase connections
  window.addEventListener("error", (event) => {
    const errorMsg = event.message || (event.error && (event.error.message || String(event.error))) || "";
    if (
      errorMsg.includes("database connection is closing") ||
      errorMsg.includes("Failed to execute 'transaction' on 'IDBDatabase'") ||
      errorMsg.includes("IDBDatabase")
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  window.addEventListener("unhandledrejection", (event) => {
    const reasonMsg = event.reason?.message || String(event.reason || "");
    if (
      reasonMsg.includes("database connection is closing") ||
      reasonMsg.includes("Failed to execute 'transaction' on 'IDBDatabase'") ||
      reasonMsg.includes("IDBDatabase")
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
}

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

/**
 * Initialize Firebase Auth without IndexedDB persistence (which frequently stalls or closes
 * in cross-origin preview iframes like Google AI Studio) and with ordered fallback:
 * browserLocalPersistence -> browserSessionPersistence -> inMemoryPersistence.
 */
function createAuthoritativeAuth(): Auth {
  if (typeof window === "undefined") {
    return getAuth(app);
  }
  try {
    return initializeAuth(app, {
      persistence: [
        browserLocalPersistence,
        browserSessionPersistence,
        inMemoryPersistence,
      ],
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch {
    // Auth was already initialized for this Firebase app instance (e.g. module reload)
    return getAuth(app);
  }
}

export const auth: Auth = createAuthoritativeAuth();

/**
 * Ensures Auth persistence is resolved to the strongest storage supported in the current
 * browser context, degrading gracefully to session or in-memory persistence when blocked.
 */
export function configureAuthPersistence(authInstance: Auth = auth): Promise<AuthPersistenceResult> {
  return configureAuthPersistenceWithFallback(authInstance, setPersistence, {
    local: browserLocalPersistence,
    session: browserSessionPersistence,
    memory: inMemoryPersistence,
  });
}

// Resolve once at startup without ever racing sign-in or throwing when browser storage is blocked
export const authPersistenceReady: Promise<AuthPersistenceResult> =
  typeof window !== "undefined"
    ? configureAuthPersistence(auth).then((result) => {
        if (result.fallbackUsed) {
          console.warn(
            `[FIREBASE_AUTH] Using ${result.mode} persistence fallback in this browser context.`,
            result.errors
          );
        }
        return result;
      })
    : Promise.resolve({ mode: "memory", fallbackUsed: false, errors: [] });

export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
  localCache: memoryLocalCache(),
}, (firebaseConfig as any).firestoreDatabaseId || "(default)");

/**
 * Ensures a base user and settings profile exist in Firestore for Google authenticated users
 */
export async function ensureGoogleUserProfile(user: any) {
  if (!user || !user.uid) return;
  try {
    const docRef = doc(db, "users", user.uid);
    let docSnap: any = null;
    try {
      docSnap = await withTimeout(getDoc(docRef), 3000, true);
    } catch (getErr) {
      console.warn("Could not check existing Firestore profile:", getErr);
    }
    const snapExists = Boolean(docSnap && typeof docSnap.exists === "function" && docSnap.exists());
    if (!snapExists) {
      try {
        const defaultProfile = {
          uid: user.uid,
          email: user.email || "",
          offer: "",
          audience: "",
          desiredResult: "",
          writingStyle: "Direct, practical, conversational",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await withTimeout(setDoc(docRef, defaultProfile), 3000, true);
        await withTimeout(setDoc(doc(db, "settings", user.uid), {
          offer: "",
          audience: "",
          desiredResult: "",
          writingStyle: "Direct, practical, conversational"
        }), 3000, true);
      } catch (dbErr) {
        console.warn("Could not initialize default profile in Firestore:", dbErr);
      }
    }
  } catch (err) {
    console.warn("ensureGoogleUserProfile error:", err);
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMsg = error instanceof Error ? error.message : String(error);
  const isQuotaExceeded = 
    errMsg.includes("Quota limit exceeded") ||
    errMsg.includes("quota metric") ||
    errMsg.includes("Free daily read units") ||
    errMsg.includes("RESOURCE_EXHAUSTED") ||
    errMsg.includes("resource-exhausted") ||
    errMsg.includes("exceeded quota");

  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };

  if (isQuotaExceeded) {
    console.warn("[FIRESTORE_OFFLINE_FALLBACK] Free daily read quota reached; using local storage offline fallback for:", path);
  } else {
    console.error('Firestore Error: ', JSON.stringify(errInfo));
  }
  return errInfo;
}

/**
 * Recursively strips undefined fields from an object or array before persisting to Firestore.
 * Firestore rejects documents containing undefined fields.
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === undefined) {
    return null as any;
  }
  if (data === null || typeof data !== "object") {
    return data;
  }
  // Preserve Date instances
  if (data instanceof Date) {
    return data;
  }
  // Preserve Firestore Timestamp instances or duck-typed Timestamps
  if (
    data instanceof Timestamp ||
    typeof (data as any).toMillis === "function" ||
    typeof (data as any).toDate === "function" ||
    (data as any).constructor?.name === "Timestamp" ||
    (data as any)._nanoseconds !== undefined
  ) {
    return data;
  }
  // Reconstruct Timestamp if it is a plain serialized timestamp object
  if (
    typeof (data as any).seconds === "number" &&
    typeof (data as any).nanoseconds === "number" &&
    Object.keys(data).length <= 2
  ) {
    return new Timestamp((data as any).seconds, (data as any).nanoseconds) as any;
  }
  // Preserve Firestore FieldValue sentinels (e.g. serverTimestamp, deleteField, etc.)
  if (
    (data as any)._methodName ||
    (data as any).constructor?.name === "FieldValue" ||
    typeof (data as any).isEqual === "function"
  ) {
    return data;
  }
  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as any;
  }
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(data as Record<string, any>)) {
    if (value !== undefined) {
      result[key] = sanitizeForFirestore(value);
    }
  }
  return result as T;
}

/**
 * Promise timeout race wrapper to prevent Firestore operations from hanging indefinitely in offline/iframe proxies.
 */
export async function withTimeout<T>(promise: Promise<T>, ms = 4000, resolveOnTimeout = false): Promise<T> {
  let timeoutId: any;
  const timeoutMs = ms > 0 ? ms : 4000;
  const timeoutPromise = new Promise<T>((resolve, reject) => {
    timeoutId = setTimeout(() => {
      if (resolveOnTimeout) {
        console.warn(`Firestore operation timed out after ${timeoutMs}ms, resolving with fallback.`);
        resolve(null as any);
      } else {
        reject(new Error(`Firestore database connection timed out after ${timeoutMs}ms (offline fallbacks active).`));
      }
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
}

