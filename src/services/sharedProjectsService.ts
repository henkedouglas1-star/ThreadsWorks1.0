import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
  type Firestore
} from "firebase/firestore";
import { auth, db, handleFirestoreError, OperationType, withTimeout } from "../firebase";
import { CONTENT_PAYS_US_APPS } from "../data/contentPaysUsRegistry";
import type { EcosystemProject } from "../types/sharedProjects";

export const PROJECT_NAME_MAX_LENGTH = 100;
export const PROJECT_OBJECTIVE_MAX_LENGTH = 200;
export const PROJECT_DESCRIPTION_MAX_LENGTH = 2000;
export const PROJECT_MAX_ASSOCIATED_APPS = 20;
export const DEFAULT_PROJECT_OBJECTIVE = "Build creator brand and earn verified sales";

export const ALLOWED_PROJECT_STATUSES: readonly EcosystemProject["status"][] = [
  "active",
  "archived",
  "completed"
];

export const VALID_ECOSYSTEM_APP_IDS = new Set<string>(CONTENT_PAYS_US_APPS.map((a) => a.id));

export type ProjectErrorKind =
  | "permission_denied"
  | "unauthenticated"
  | "validation"
  | "timeout"
  | "network"
  | "unknown";

export interface ClassifiedProjectError {
  kind: ProjectErrorKind;
  code: string;
  message: string;
  isPermissionError: boolean;
}

export class SharedProjectError extends Error {
  readonly kind: ProjectErrorKind;
  readonly code: string;
  readonly isPermissionError: boolean;

  constructor(info: ClassifiedProjectError) {
    super(info.message);
    this.name = "SharedProjectError";
    this.kind = info.kind;
    this.code = info.code;
    this.isPermissionError = info.isPermissionError;
  }
}

export function classifyProjectError(err: unknown, fallbackMessage = "Project operation failed."): ClassifiedProjectError {
  if (err instanceof SharedProjectError) {
    return {
      kind: err.kind,
      code: err.code,
      message: err.message,
      isPermissionError: err.isPermissionError
    };
  }

  const rawCode = String((err as any)?.code || "").toLowerCase();
  const rawMsg = err instanceof Error ? err.message : String(err || fallbackMessage);
  const lowerMsg = rawMsg.toLowerCase();

  if (
    rawCode.includes("permission-denied") ||
    lowerMsg.includes("missing or insufficient permissions") ||
    lowerMsg.includes("permission_denied") ||
    lowerMsg.includes("permission-denied")
  ) {
    return {
      kind: "permission_denied",
      code: "permission-denied",
      message: "Missing or insufficient permissions.",
      isPermissionError: true
    };
  }

  if (
    rawCode.includes("unauthenticated") ||
    lowerMsg.includes("not authenticated") ||
    lowerMsg.includes("sign in")
  ) {
    return {
      kind: "unauthenticated",
      code: rawCode || "unauthenticated",
      message: rawMsg || "Please sign in to manage shared projects.",
      isPermissionError: false
    };
  }

  if (lowerMsg.includes("timed out") || rawCode.includes("deadline-exceeded")) {
    return {
      kind: "timeout",
      code: rawCode || "deadline-exceeded",
      message: "Firestore request timed out. Please check your connection and try again.",
      isPermissionError: false
    };
  }

  if (rawCode.includes("unavailable") || lowerMsg.includes("network") || lowerMsg.includes("offline")) {
    return {
      kind: "network",
      code: rawCode || "unavailable",
      message: "Unable to reach Firestore right now. Please check your connection and retry.",
      isPermissionError: false
    };
  }

  return {
    kind: "unknown",
    code: rawCode || "unknown",
    message: rawMsg || fallbackMessage,
    isPermissionError: false
  };
}

export interface ProjectInput {
  name: string;
  objective?: string;
  description?: string;
  status?: EcosystemProject["status"];
  associatedAppIds: string[];
}

export interface ValidatedProjectFields {
  name: string;
  objective: string;
  description: string;
  status: EcosystemProject["status"];
  associatedAppIds: string[];
}

export function validateProjectInput(input: ProjectInput): {
  valid: boolean;
  errors: string[];
  data?: ValidatedProjectFields;
} {
  const errors: string[] = [];

  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name) {
    errors.push("Project name is required.");
  } else if (name.length > PROJECT_NAME_MAX_LENGTH) {
    errors.push(`Project name must be ${PROJECT_NAME_MAX_LENGTH} characters or fewer.`);
  }

  const rawObjective = typeof input.objective === "string" ? input.objective.trim() : "";
  const objective = rawObjective || DEFAULT_PROJECT_OBJECTIVE;
  if (objective.length > PROJECT_OBJECTIVE_MAX_LENGTH) {
    errors.push(`Project objective must be ${PROJECT_OBJECTIVE_MAX_LENGTH} characters or fewer.`);
  }

  const description = typeof input.description === "string" ? input.description.trim() : "";
  if (description.length > PROJECT_DESCRIPTION_MAX_LENGTH) {
    errors.push(`Project description must be ${PROJECT_DESCRIPTION_MAX_LENGTH} characters or fewer.`);
  }

  const status: EcosystemProject["status"] = input.status || "active";
  if (!(ALLOWED_PROJECT_STATUSES as readonly string[]).includes(status)) {
    errors.push(`Invalid project status "${String(status)}".`);
  }

  const rawApps = Array.isArray(input.associatedAppIds) ? input.associatedAppIds : [];
  const dedupedApps: string[] = [];
  const seen = new Set<string>();
  for (const appId of rawApps) {
    const cleanId = typeof appId === "string" ? appId.trim().toLowerCase() : "";
    if (!cleanId) continue;
    if (!VALID_ECOSYSTEM_APP_IDS.has(cleanId)) {
      errors.push(`Unknown application identifier "${cleanId}".`);
      continue;
    }
    if (!seen.has(cleanId)) {
      seen.add(cleanId);
      dedupedApps.push(cleanId);
    }
  }

  if (dedupedApps.length === 0) {
    errors.push("Associate the project with at least one ContentPaysUs application.");
  } else if (dedupedApps.length > PROJECT_MAX_ASSOCIATED_APPS) {
    errors.push(`A project can be associated with at most ${PROJECT_MAX_ASSOCIATED_APPS} applications.`);
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    data: {
      name,
      objective,
      description,
      status,
      associatedAppIds: dedupedApps
    }
  };
}

export function buildProjectCreatePayload(
  uid: string,
  input: ProjectInput,
  now: string = new Date().toISOString()
): Omit<EcosystemProject, "id"> {
  const cleanUid = typeof uid === "string" ? uid.trim() : "";
  if (!cleanUid) {
    throw new SharedProjectError({
      kind: "unauthenticated",
      code: "unauthenticated",
      message: "You must be signed in to create a project.",
      isPermissionError: false
    });
  }

  const validation = validateProjectInput({ ...input, status: "active" });
  if (!validation.valid || !validation.data) {
    throw new SharedProjectError({
      kind: "validation",
      code: "invalid-argument",
      message: validation.errors[0] || "Invalid project fields.",
      isPermissionError: false
    });
  }

  return {
    userId: cleanUid,
    name: validation.data.name,
    objective: validation.data.objective,
    description: validation.data.description,
    status: "active",
    associatedAppIds: validation.data.associatedAppIds,
    createdAt: now,
    updatedAt: now
  };
}

export function buildProjectUpdatePayload(
  input: ProjectInput,
  now: string = new Date().toISOString()
): Omit<EcosystemProject, "id" | "userId" | "createdAt"> {
  const validation = validateProjectInput(input);
  if (!validation.valid || !validation.data) {
    throw new SharedProjectError({
      kind: "validation",
      code: "invalid-argument",
      message: validation.errors[0] || "Invalid project fields.",
      isPermissionError: false
    });
  }

  // Explicitly omits userId and createdAt so project ownership and creation time stay immutable
  return {
    name: validation.data.name,
    objective: validation.data.objective,
    description: validation.data.description,
    status: validation.data.status,
    associatedAppIds: validation.data.associatedAppIds,
    updatedAt: now
  };
}

export function buildProjectArchivePayload(
  currentStatus: EcosystemProject["status"],
  now: string = new Date().toISOString()
): { status: "active" | "archived"; updatedAt: string } {
  return {
    status: currentStatus === "archived" ? "active" : "archived",
    updatedAt: now
  };
}

export interface SharedProjectsClientAdapter {
  getCurrentAuthUid: () => string | null;
  listDocs: (uid: string) => Promise<EcosystemProject[]>;
  addProjectDoc: (payload: Omit<EcosystemProject, "id">) => Promise<string>;
  updateProjectDoc: (projectId: string, patch: Record<string, unknown>) => Promise<void>;
}

function createFirestoreAdapter(firestoreDb: Firestore = db): SharedProjectsClientAdapter {
  return {
    getCurrentAuthUid: () => auth.currentUser?.uid || null,
    listDocs: async (uid: string) => {
      const q = query(collection(firestoreDb, "projects"), where("userId", "==", uid));
      const snapshot = await withTimeout(getDocs(q), 8000, false);
      const list: EcosystemProject[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() || {};
        list.push({
          id: docSnap.id,
          userId: String(data.userId || uid),
          name: String(data.name || ""),
          objective: String(data.objective || ""),
          description: typeof data.description === "string" ? data.description : "",
          status:
            data.status === "archived" || data.status === "completed" ? data.status : "active",
          associatedAppIds: Array.isArray(data.associatedAppIds)
            ? data.associatedAppIds.map((x: unknown) => String(x)).filter(Boolean)
            : [],
          createdAt: String(data.createdAt || ""),
          updatedAt: String(data.updatedAt || data.createdAt || "")
        });
      });
      list.sort(
        (a, b) =>
          (new Date(b.updatedAt || 0).getTime() || 0) -
          (new Date(a.updatedAt || 0).getTime() || 0)
      );
      return list;
    },
    addProjectDoc: async (payload) => {
      const docRef = await withTimeout(addDoc(collection(firestoreDb, "projects"), payload), 8000, false);
      return docRef.id;
    },
    updateProjectDoc: async (projectId, patch) => {
      await withTimeout(updateDoc(doc(firestoreDb, "projects", projectId), patch), 8000, false);
    }
  };
}

function assertVerifiedSessionUid(expectedUid: string, adapter: SharedProjectsClientAdapter): string {
  const cleanExpected = typeof expectedUid === "string" ? expectedUid.trim() : "";
  const liveAuthUid = adapter.getCurrentAuthUid();
  if (!cleanExpected || !liveAuthUid) {
    throw new SharedProjectError({
      kind: "unauthenticated",
      code: "unauthenticated",
      message: "Your authentication session is not ready. Please sign in again.",
      isPermissionError: false
    });
  }
  if (liveAuthUid !== cleanExpected) {
    throw new SharedProjectError({
      kind: "permission_denied",
      code: "auth-uid-mismatch",
      message: "Authenticated account changed. Reloading projects for the active account.",
      isPermissionError: true
    });
  }
  return liveAuthUid;
}

export async function listUserProjects(
  uid: string,
  adapter: SharedProjectsClientAdapter = createFirestoreAdapter()
): Promise<EcosystemProject[]> {
  const verifiedUid = assertVerifiedSessionUid(uid, adapter);
  try {
    return await adapter.listDocs(verifiedUid);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, "projects");
    throw new SharedProjectError(
      classifyProjectError(err, "Failed to retrieve shared projects.")
    );
  }
}

export async function createUserProject(
  uid: string,
  input: ProjectInput,
  adapter: SharedProjectsClientAdapter = createFirestoreAdapter()
): Promise<EcosystemProject> {
  const verifiedUid = assertVerifiedSessionUid(uid, adapter);
  const payload = buildProjectCreatePayload(verifiedUid, input);
  try {
    const id = await adapter.addProjectDoc(payload);
    return { id, ...payload };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, "projects");
    throw new SharedProjectError(
      classifyProjectError(err, "Failed to create project.")
    );
  }
}

export async function updateUserProject(
  uid: string,
  projectId: string,
  input: ProjectInput,
  adapter: SharedProjectsClientAdapter = createFirestoreAdapter()
): Promise<Omit<EcosystemProject, "id" | "userId" | "createdAt">> {
  assertVerifiedSessionUid(uid, adapter);
  const cleanId = typeof projectId === "string" ? projectId.trim() : "";
  if (!cleanId) {
    throw new SharedProjectError({
      kind: "validation",
      code: "invalid-argument",
      message: "Project ID is required.",
      isPermissionError: false
    });
  }
  const patch = buildProjectUpdatePayload(input);
  try {
    await adapter.updateProjectDoc(cleanId, patch);
    return patch;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `projects/${cleanId}`);
    throw new SharedProjectError(
      classifyProjectError(err, "Failed to update project.")
    );
  }
}

export async function toggleUserProjectArchive(
  uid: string,
  projectId: string,
  currentStatus: EcosystemProject["status"],
  adapter: SharedProjectsClientAdapter = createFirestoreAdapter()
): Promise<{ status: "active" | "archived"; updatedAt: string }> {
  assertVerifiedSessionUid(uid, adapter);
  const cleanId = typeof projectId === "string" ? projectId.trim() : "";
  if (!cleanId) {
    throw new SharedProjectError({
      kind: "validation",
      code: "invalid-argument",
      message: "Project ID is required.",
      isPermissionError: false
    });
  }
  const patch = buildProjectArchivePayload(currentStatus);
  try {
    await adapter.updateProjectDoc(cleanId, patch);
    return patch;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `projects/${cleanId}`);
    throw new SharedProjectError(
      classifyProjectError(err, "Failed to update project status.")
    );
  }
}
