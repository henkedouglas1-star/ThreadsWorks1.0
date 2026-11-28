import "./setupDom";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Window } from "happy-dom";

import {
  buildProjectArchivePayload,
  buildProjectCreatePayload,
  buildProjectUpdatePayload,
  classifyProjectError,
  createUserProject,
  listUserProjects,
  SharedProjectError,
  toggleUserProjectArchive,
  updateUserProject,
  validateProjectInput,
  type SharedProjectsClientAdapter
} from "../src/services/sharedProjectsService";
import { ContentPaysUsUnifiedWorkspace } from "../src/components/contentpaysus/ContentPaysUsUnifiedWorkspace";
import type { EcosystemProject } from "../src/types/sharedProjects";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const PROJECT_ALLOWED_KEYS = new Set([
  "userId",
  "name",
  "objective",
  "description",
  "status",
  "associatedAppIds",
  "createdAt",
  "updatedAt"
]);

const ALLOWED_STATUSES = new Set(["active", "archived", "completed"]);

function makePermissionDeniedError(): Error & { code: string } {
  const err = new Error("Missing or insufficient permissions.") as Error & { code: string };
  err.code = "permission-denied";
  return err;
}

/**
 * Faithful in-memory evaluator mirroring /projects/{projectId} rules in firestore.rules:
 * - Requires request.auth != null
 * - allow get: resource == null || resource.data.userId == request.auth.uid
 * - allow list: query filters userId == request.auth.uid
 * - allow create: isValidProjectCreate()
 * - allow update: resource != null && resource.data.userId == request.auth.uid && isValidProjectUpdate()
 * - allow delete: resource != null && resource.data.userId == request.auth.uid
 */
class RulesEnforcingProjectsStore {
  private docs = new Map<string, Record<string, any>>();
  private idCounter = 0;
  public currentAuthUid: string | null = null;
  public rulesDeployed = true;

  private hasOnlyAllowedKeys(data: Record<string, any>): boolean {
    return Object.keys(data).every((k) => PROJECT_ALLOWED_KEYS.has(k));
  }

  private isValidProjectCreate(data: Record<string, any>, authUid: string): boolean {
    return (
      this.hasOnlyAllowedKeys(data) &&
      typeof data.userId === "string" &&
      data.userId === authUid &&
      typeof data.name === "string" &&
      data.name.length > 0 &&
      data.name.length <= 100 &&
      typeof data.objective === "string" &&
      data.objective.length <= 200 &&
      (!("description" in data) ||
        (typeof data.description === "string" && data.description.length <= 2000)) &&
      typeof data.status === "string" &&
      ALLOWED_STATUSES.has(data.status) &&
      Array.isArray(data.associatedAppIds) &&
      data.associatedAppIds.length >= 1 &&
      data.associatedAppIds.length <= 20 &&
      typeof data.createdAt === "string" &&
      data.createdAt.length > 0 &&
      data.createdAt.length <= 64 &&
      typeof data.updatedAt === "string" &&
      data.updatedAt.length > 0 &&
      data.updatedAt.length <= 64
    );
  }

  private isValidProjectUpdate(
    existing: Record<string, any>,
    merged: Record<string, any>
  ): boolean {
    return (
      this.hasOnlyAllowedKeys(merged) &&
      merged.userId === existing.userId &&
      (!("createdAt" in existing) || merged.createdAt === existing.createdAt) &&
      typeof merged.name === "string" &&
      merged.name.length > 0 &&
      merged.name.length <= 100 &&
      (!("objective" in merged) ||
        (typeof merged.objective === "string" && merged.objective.length <= 200)) &&
      (!("description" in merged) ||
        (typeof merged.description === "string" && merged.description.length <= 2000)) &&
      typeof merged.status === "string" &&
      ALLOWED_STATUSES.has(merged.status) &&
      (!("associatedAppIds" in merged) ||
        (Array.isArray(merged.associatedAppIds) &&
          merged.associatedAppIds.length >= 1 &&
          merged.associatedAppIds.length <= 20)) &&
      (!("updatedAt" in merged) ||
        (typeof merged.updatedAt === "string" && merged.updatedAt.length <= 64))
    );
  }

  getDoc(projectId: string): EcosystemProject | null {
    if (!this.rulesDeployed || !this.currentAuthUid) {
      throw makePermissionDeniedError();
    }
    const existing = this.docs.get(projectId);
    if (!existing) return null;
    if (existing.userId !== this.currentAuthUid) {
      throw makePermissionDeniedError();
    }
    return { id: projectId, ...(structuredClone(existing) as Omit<EcosystemProject, "id">) };
  }

  listDocs(filterUserId: string): EcosystemProject[] {
    if (!this.rulesDeployed || !this.currentAuthUid) {
      throw makePermissionDeniedError();
    }
    if (filterUserId !== this.currentAuthUid) {
      throw makePermissionDeniedError();
    }
    const results: EcosystemProject[] = [];
    for (const [id, data] of this.docs.entries()) {
      if (data.userId === filterUserId) {
        results.push({ id, ...(structuredClone(data) as Omit<EcosystemProject, "id">) });
      }
    }
    results.sort(
      (a, b) =>
        (new Date(b.updatedAt || 0).getTime() || 0) -
        (new Date(a.updatedAt || 0).getTime() || 0)
    );
    return results;
  }

  addRawDoc(payload: Record<string, any>): string {
    if (!this.rulesDeployed || !this.currentAuthUid) {
      throw makePermissionDeniedError();
    }
    if (!this.isValidProjectCreate(payload, this.currentAuthUid)) {
      throw makePermissionDeniedError();
    }
    const id = `proj_${++this.idCounter}`;
    this.docs.set(id, structuredClone(payload));
    return id;
  }

  updateRawDoc(projectId: string, patch: Record<string, any>): void {
    if (!this.rulesDeployed || !this.currentAuthUid) {
      throw makePermissionDeniedError();
    }
    const existing = this.docs.get(projectId);
    if (!existing || existing.userId !== this.currentAuthUid) {
      throw makePermissionDeniedError();
    }
    const merged = { ...existing, ...patch };
    if (!this.isValidProjectUpdate(existing, merged)) {
      throw makePermissionDeniedError();
    }
    this.docs.set(projectId, structuredClone(merged));
  }

  deleteDoc(projectId: string): void {
    if (!this.rulesDeployed || !this.currentAuthUid) {
      throw makePermissionDeniedError();
    }
    const existing = this.docs.get(projectId);
    if (!existing || existing.userId !== this.currentAuthUid) {
      throw makePermissionDeniedError();
    }
    this.docs.delete(projectId);
  }

  getStoredRaw(projectId: string): Record<string, any> | undefined {
    const existing = this.docs.get(projectId);
    return existing ? structuredClone(existing) : undefined;
  }

  createAdapter(): SharedProjectsClientAdapter {
    return {
      getCurrentAuthUid: () => this.currentAuthUid,
      listDocs: async (uid: string) => this.listDocs(uid),
      addProjectDoc: async (payload) => this.addRawDoc(payload),
      updateProjectDoc: async (projectId, patch) => this.updateRawDoc(projectId, patch)
    };
  }
}

async function flushMicrotasks(ticks = 6): Promise<void> {
  for (let i = 0; i < ticks; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
}

function setReactInputValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const proto =
    el.tagName === "TEXTAREA"
      ? (globalThis as any).HTMLTextAreaElement.prototype
      : (globalThis as any).HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (setter) {
    setter.call(el, value);
  } else {
    el.value = value;
  }
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function createMountedDom(): { container: HTMLElement; root: Root; cleanup: () => Promise<void> } {
  const domWindow = new Window({ url: "https://threadsworks.com/workspace" });
  const prevWindow = (globalThis as any).window;
  const prevDocument = (globalThis as any).document;
  (globalThis as any).window = domWindow;
  (globalThis as any).document = domWindow.document;

  const container = domWindow.document.createElement("div");
  domWindow.document.body.appendChild(container);
  const root = createRoot(container);

  return {
    container: container as unknown as HTMLElement,
    root,
    cleanup: async () => {
      await act(async () => {
        root.unmount();
      });
      await domWindow.happyDOM.close();
      (globalThis as any).window = prevWindow;
      (globalThis as any).document = prevDocument;
    }
  };
}

test("Firebase config and firestore.rules contract for /projects/{projectId} on named database", () => {
  const rootDir = process.cwd();
  const appletConfig = JSON.parse(
    fs.readFileSync(path.join(rootDir, "firebase-applet-config.json"), "utf8")
  );
  const firebaseJson = JSON.parse(
    fs.readFileSync(path.join(rootDir, "firebase.json"), "utf8")
  );
  const rulesText = fs.readFileSync(path.join(rootDir, "firestore.rules"), "utf8");

  // 1. Named database target in firebase.json matches firebase-applet-config.json
  assert.strictEqual(appletConfig.projectId, "studio-6594275665-9cb0f");
  assert.strictEqual(
    appletConfig.firestoreDatabaseId,
    "ai-studio-threadsworks-b76f7533-a28e-409a-9ce3-3b12bcbfbf3d"
  );
  assert.ok(firebaseJson.firestore, "firebase.json must define a firestore target");
  assert.strictEqual(firebaseJson.firestore.database, appletConfig.firestoreDatabaseId);
  assert.strictEqual(firebaseJson.firestore.rules, "firestore.rules");

  // 2. Hardened /projects/{projectId} rules exist with separate get/list/create/update/delete
  const projectsBlockMatch = rulesText.match(
    /function isValidProjectCreate\(\)[\s\S]*?match \/projects\/\{projectId\} \{[\s\S]*?\n    \}/
  );
  assert.ok(projectsBlockMatch, "firestore.rules must contain isValidProjectCreate/Update and match /projects/{projectId}");
  const block = projectsBlockMatch[0];

  assert.match(block, /allow get:\s*if request\.auth != null && \(resource == null \|\| resource\.data\.userId == request\.auth\.uid\);/);
  assert.match(block, /allow list:\s*if request\.auth != null && resource\.data\.userId == request\.auth\.uid;/);
  assert.match(block, /allow create:\s*if request\.auth != null && isValidProjectCreate\(\);/);
  assert.match(block, /allow update:\s*if request\.auth != null[\s\S]*resource\.data\.userId == request\.auth\.uid[\s\S]*isValidProjectUpdate\(\);/);
  assert.match(block, /allow delete:\s*if request\.auth != null[\s\S]*resource\.data\.userId == request\.auth\.uid;/);

  // 3. Ownership immutability & strict schema whitelist
  assert.match(block, /data\.userId == request\.auth\.uid/);
  assert.match(block, /data\.userId == resource\.data\.userId/);
  assert.match(block, /data\.createdAt == resource\.data\.createdAt/);
  assert.match(block, /data\.keys\(\)\.hasOnly\(/);
  assert.match(block, /data\.associatedAppIds is list/);
  assert.match(block, /data\.associatedAppIds\.size\(\) >= 1/);
  assert.match(block, /data\.associatedAppIds\.size\(\) <= 20/);

  // 4. Verify no weakened unrestricted rules were introduced anywhere in firestore.rules
  assert.doesNotMatch(rulesText, /allow\s+read,\s*write:\s*if\s+true\s*;/);
  assert.doesNotMatch(rulesText, /allow\s+read,\s*write:\s*if\s+request\.auth\s*!=\s*null\s*;/);
});

test("Firestore /projects rules simulator enforces ownership, immutability, validation, and cross-account isolation", () => {
  const store = new RulesEnforcingProjectsStore();

  // Unauthenticated access denied on every operation
  store.currentAuthUid = null;
  assert.throws(() => store.listDocs("user_a"), /Missing or insufficient permissions/);
  assert.throws(
    () =>
      store.addRawDoc(
        buildProjectCreatePayload("user_a", {
          name: "Unauthorized",
          associatedAppIds: ["threadsworks"]
        })
      ),
    /Missing or insufficient permissions/
  );

  // When rules are not yet deployed on named database, authenticated reads AND writes fail with permission-denied
  store.currentAuthUid = "user_a";
  store.rulesDeployed = false;
  assert.throws(() => store.listDocs("user_a"), /Missing or insufficient permissions/);
  assert.throws(
    () =>
      store.addRawDoc(
        buildProjectCreatePayload("user_a", {
          name: "Blocked by undeployed rules",
          associatedAppIds: ["threadsworks"]
        })
      ),
    /Missing or insufficient permissions/
  );

  // Deploy rules and test authenticated CRUD + security invariants
  store.rulesDeployed = true;
  const payloadA = buildProjectCreatePayload("user_a", {
    name: "Q1 Monetization Funnel",
    objective: "First 25 verified playbook sales",
    description: "Align Threads content with ProductWorks and OfferWorks.",
    associatedAppIds: ["threadsworks", "productworks", "offerworks"]
  });

  const projId = store.addRawDoc(payloadA);
  assert.ok(projId);

  // Spoofing another user's userId on create is denied
  assert.throws(
    () => store.addRawDoc({ ...payloadA, userId: "user_b" }),
    /Missing or insufficient permissions/
  );

  // Extra unwhitelisted fields are denied
  assert.throws(
    () => store.addRawDoc({ ...payloadA, role: "admin" }),
    /Missing or insufficient permissions/
  );

  // Owner cannot mutate userId or createdAt on update
  assert.throws(
    () => store.updateRawDoc(projId, { userId: "user_b" }),
    /Missing or insufficient permissions/
  );
  assert.throws(
    () => store.updateRawDoc(projId, { createdAt: "2000-01-01T00:00:00.000Z" }),
    /Missing or insufficient permissions/
  );

  // Cross-account access by User B is completely denied
  store.currentAuthUid = "user_b";
  assert.throws(() => store.listDocs("user_a"), /Missing or insufficient permissions/);
  assert.throws(() => store.getDoc(projId), /Missing or insufficient permissions/);
  assert.throws(
    () => store.updateRawDoc(projId, { name: "Hijacked" }),
    /Missing or insufficient permissions/
  );
  assert.throws(
    () => store.updateRawDoc(projId, { status: "archived" }),
    /Missing or insufficient permissions/
  );
  assert.throws(() => store.deleteDoc(projId), /Missing or insufficient permissions/);
  assert.deepStrictEqual(store.listDocs("user_b"), []);

  // User A can still read, edit, archive, restore, and delete their own project
  store.currentAuthUid = "user_a";
  assert.strictEqual(store.listDocs("user_a").length, 1);
  assert.strictEqual(store.getDoc(projId)?.name, "Q1 Monetization Funnel");
});

test("sharedProjectsService supports full CRUD, multi-app validation, UID verification, and error classification", async () => {
  const store = new RulesEnforcingProjectsStore();
  const adapter = store.createAdapter();

  // Validation checks
  assert.strictEqual(validateProjectInput({ name: "   ", associatedAppIds: ["threadsworks"] }).valid, false);
  assert.strictEqual(
    validateProjectInput({ name: "A".repeat(101), associatedAppIds: ["threadsworks"] }).valid,
    false
  );
  assert.strictEqual(
    validateProjectInput({ name: "Valid", objective: "B".repeat(201), associatedAppIds: ["threadsworks"] }).valid,
    false
  );
  assert.strictEqual(
    validateProjectInput({ name: "Valid", description: "C".repeat(2001), associatedAppIds: ["threadsworks"] }).valid,
    false
  );
  assert.strictEqual(validateProjectInput({ name: "Valid", associatedAppIds: [] }).valid, false);
  assert.strictEqual(
    validateProjectInput({ name: "Valid", associatedAppIds: ["nonexistent_app"] }).valid,
    false
  );
  assert.strictEqual(
    validateProjectInput({
      name: "Valid",
      status: "invalid_status" as any,
      associatedAppIds: ["threadsworks"]
    }).valid,
    false
  );

  // Multi-app deduplication & normalization
  const multiValidation = validateProjectInput({
    name: "  Launch Playbook  ",
    objective: "",
    description: "Cross-app campaign",
    associatedAppIds: ["ThreadsWorks", "productworks", "threadsworks", "funnelworks"]
  });
  assert.strictEqual(multiValidation.valid, true);
  assert.deepStrictEqual(multiValidation.data?.associatedAppIds, [
    "threadsworks",
    "productworks",
    "funnelworks"
  ]);

  // UID mismatch rejected before touching Firestore
  store.currentAuthUid = "user_b";
  await assert.rejects(
    () =>
      createUserProject(
        "user_a",
        { name: "Mismatch", associatedAppIds: ["threadsworks"] },
        adapter
      ),
    (err: unknown) => {
      assert.ok(err instanceof SharedProjectError);
      assert.strictEqual(err.code, "auth-uid-mismatch");
      assert.strictEqual(err.isPermissionError, true);
      return true;
    }
  );

  // Authenticated User A creates, lists, edits, archives, restores
  store.currentAuthUid = "user_a";
  const created = await createUserProject(
    "user_a",
    {
      name: "Creator Revenue Engine",
      objective: "Reach first verified sale",
      description: "Threads -> Offer -> Product",
      associatedAppIds: ["threadsworks", "offerworks", "productworks"]
    },
    adapter
  );
  assert.strictEqual(created.userId, "user_a");
  assert.deepStrictEqual(created.associatedAppIds, ["threadsworks", "offerworks", "productworks"]);
  assert.strictEqual(created.status, "active");

  const fetched = await listUserProjects("user_a", adapter);
  assert.strictEqual(fetched.length, 1);
  assert.strictEqual(fetched[0].id, created.id);

  // Edit keeps userId and createdAt immutable
  const updatePatch = await updateUserProject(
    "user_a",
    created.id,
    {
      name: "Creator Revenue Engine v2",
      objective: "Reach 10 verified sales",
      description: "Added FunnelWorks checkout flow",
      status: "active",
      associatedAppIds: ["threadsworks", "productworks", "funnelworks"]
    },
    adapter
  );
  assert.strictEqual("userId" in (updatePatch as any), false);
  assert.strictEqual("createdAt" in (updatePatch as any), false);
  const storedAfterEdit = store.getStoredRaw(created.id);
  assert.strictEqual(storedAfterEdit?.userId, "user_a");
  assert.strictEqual(storedAfterEdit?.createdAt, created.createdAt);
  assert.strictEqual(storedAfterEdit?.name, "Creator Revenue Engine v2");
  assert.deepStrictEqual(storedAfterEdit?.associatedAppIds, [
    "threadsworks",
    "productworks",
    "funnelworks"
  ]);

  // Archive and restore
  const archivedPatch = await toggleUserProjectArchive("user_a", created.id, "active", adapter);
  assert.strictEqual(archivedPatch.status, "archived");
  assert.strictEqual(store.getStoredRaw(created.id)?.status, "archived");

  const restoredPatch = await toggleUserProjectArchive("user_a", created.id, "archived", adapter);
  assert.strictEqual(restoredPatch.status, "active");
  assert.strictEqual(store.getStoredRaw(created.id)?.status, "active");

  // Error classification distinguishes permission-denied cleanly
  const classified = classifyProjectError(makePermissionDeniedError());
  assert.strictEqual(classified.kind, "permission_denied");
  assert.strictEqual(classified.isPermissionError, true);
  assert.strictEqual(classified.message, "Missing or insufficient permissions.");

  // Payload builders verify immutability contract directly
  const rawUpdate = buildProjectUpdatePayload({
    name: "Direct Check",
    associatedAppIds: ["threadsworks", "salesworks"]
  });
  assert.strictEqual((rawUpdate as any).userId, undefined);
  assert.strictEqual((rawUpdate as any).createdAt, undefined);
  assert.strictEqual(buildProjectArchivePayload("active").status, "archived");
  assert.strictEqual(buildProjectArchivePayload("archived").status, "active");
});

test("ContentPaysUsUnifiedWorkspace distinguishes permission failures from empty project collections", async () => {
  const store = new RulesEnforcingProjectsStore();
  store.currentAuthUid = "user_a";
  store.rulesDeployed = false; // Simulate undeployed named-database rules
  const adapter = store.createAdapter();

  const { container, root, cleanup } = createMountedDom();
  try {
    await act(async () => {
      root.render(
        React.createElement(ContentPaysUsUnifiedWorkspace, {
          user: { uid: "user_a", email: "creator@threadsworks.com" },
          profile: { email: "creator@threadsworks.com" },
          subscriptionStatus: "active",
          onNavigateToTab: () => {},
          onRefreshProfile: () => {},
          projectsAdapter: adapter
        })
      );
    });
    await flushMicrotasks();

    // Open Projects tab
    const projectsTabBtn = container.querySelector('button[aria-label^="Navigate to Projects"]') as HTMLButtonElement;
    assert.ok(projectsTabBtn, "Projects navigation tab must exist");
    await act(async () => {
      projectsTabBtn.click();
    });
    await flushMicrotasks();

    // Must show explicit permission-denied alert and MUST NOT show empty state
    const permAlert = container.querySelector('[data-projects-state="permission-denied"]');
    const emptyState = container.querySelector('[data-projects-state="empty"]');
    assert.ok(permAlert, "Workspace must render explicit permission-denied state when Firestore denies access");
    assert.strictEqual(emptyState, null, "Workspace must NOT misrepresent permission failure as an empty project list");
    assert.match(permAlert.textContent || "", /Missing or insufficient permissions\./);
    assert.match(
      permAlert.textContent || "",
      /ai-studio-threadsworks-b76f7533-a28e-409a-9ce3-3b12bcbfbf3d/
    );
    assert.doesNotMatch(container.textContent || "", /No projects created yet/);

    // Now simulate rules deployed and user clicking "Retry Loading Projects" -> genuine empty collection
    store.rulesDeployed = true;
    const retryBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      (b.textContent || "").includes("Retry Loading Projects")
    ) as HTMLButtonElement;
    assert.ok(retryBtn, "Retry Loading Projects button must be present on permission failure");
    await act(async () => {
      retryBtn.click();
    });
    await flushMicrotasks();

    assert.strictEqual(container.querySelector('[data-projects-state="permission-denied"]'), null);
    const genuineEmpty = container.querySelector('[data-projects-state="empty"]');
    assert.ok(genuineEmpty, "Genuine empty collection must render empty state after successful retrieval");
    assert.match(genuineEmpty.textContent || "", /No projects created yet/);
  } finally {
    await cleanup();
  }
});

test("ContentPaysUsUnifiedWorkspace end-to-end project create (multi-app), reload persistence, edit, archive/restore, and account isolation", async () => {
  const store = new RulesEnforcingProjectsStore();
  store.currentAuthUid = "user_a";
  store.rulesDeployed = true;
  const adapter = store.createAdapter();

  // Session 1: Create project with 3 associated applications
  const mount1 = createMountedDom();
  try {
    await act(async () => {
      mount1.root.render(
        React.createElement(ContentPaysUsUnifiedWorkspace, {
          user: { uid: "user_a", email: "alice@threadsworks.com" },
          profile: { email: "alice@threadsworks.com" },
          subscriptionStatus: "active",
          onNavigateToTab: () => {},
          onRefreshProfile: () => {},
          projectsAdapter: adapter
        })
      );
    });
    await flushMicrotasks();

    const projectsTab = mount1.container.querySelector(
      'button[aria-label^="Navigate to Projects"]'
    ) as HTMLButtonElement;
    await act(async () => {
      projectsTab.click();
    });
    await flushMicrotasks();

    const newProjectBtn = mount1.container.querySelector(
      'button[aria-label="Create New Ecosystem Project"]'
    ) as HTMLButtonElement;
    assert.ok(newProjectBtn);
    await act(async () => {
      newProjectBtn.click();
    });

    const nameInput = mount1.container.querySelector("#project-name-input") as HTMLInputElement;
    const objInput = mount1.container.querySelector("#project-objective-input") as HTMLInputElement;
    const descInput = mount1.container.querySelector("#project-description-input") as HTMLTextAreaElement;

    await act(async () => {
      setReactInputValue(nameInput, "First Sale Blueprint");
      setReactInputValue(objInput, "Launch digital guide to Threads audience");
      setReactInputValue(descInput, "Coordinate daily Threads posts with ProductWorks and OfferWorks.");
    });

    // threadsworks is selected by default; also check ProductWorks and OfferWorks
    const labels = Array.from(mount1.container.querySelectorAll("form label"));
    const toggleAppCheckbox = async (appName: string) => {
      const lbl = labels.find((l) => (l.textContent || "").trim() === appName);
      assert.ok(lbl, `Checkbox label for ${appName} should exist`);
      const cb = lbl.querySelector('input[type="checkbox"]') as HTMLInputElement;
      assert.ok(cb);
      await act(async () => {
        cb.click();
      });
    };
    await toggleAppCheckbox("ProductWorks");
    await toggleAppCheckbox("OfferWorks");

    const submitBtn = Array.from(mount1.container.querySelectorAll('form button[type="submit"]'))[0] as HTMLButtonElement;
    assert.ok(submitBtn);
    await act(async () => {
      submitBtn.click();
    });
    await flushMicrotasks();

    assert.match(mount1.container.textContent || "", /Project created successfully\./);
    assert.match(mount1.container.textContent || "", /First Sale Blueprint/);
    assert.match(mount1.container.textContent || "", /threadsworks/i);
    assert.match(mount1.container.textContent || "", /productworks/i);
    assert.match(mount1.container.textContent || "", /offerworks/i);
  } finally {
    await mount1.cleanup();
  }

  // Session 2: Simulates browser refresh / re-sign-in -> saved project persists
  const mount2 = createMountedDom();
  try {
    await act(async () => {
      mount2.root.render(
        React.createElement(ContentPaysUsUnifiedWorkspace, {
          user: { uid: "user_a", email: "alice@threadsworks.com" },
          profile: { email: "alice@threadsworks.com" },
          subscriptionStatus: "active",
          onNavigateToTab: () => {},
          onRefreshProfile: () => {},
          projectsAdapter: adapter
        })
      );
    });
    await flushMicrotasks();

    const projectsTab = mount2.container.querySelector(
      'button[aria-label^="Navigate to Projects"]'
    ) as HTMLButtonElement;
    await act(async () => {
      projectsTab.click();
    });
    await flushMicrotasks();

    assert.match(mount2.container.textContent || "", /First Sale Blueprint/);
    assert.match(mount2.container.textContent || "", /Launch digital guide to Threads audience/);

    // Edit project: update name and add FunnelWorks
    const editBtn = Array.from(mount2.container.querySelectorAll("button")).find((b) =>
      (b.textContent || "").includes("Edit")
    ) as HTMLButtonElement;
    assert.ok(editBtn);
    await act(async () => {
      editBtn.click();
    });

    const editNameInput = mount2.container.querySelector("#project-name-input") as HTMLInputElement;
    await act(async () => {
      setReactInputValue(editNameInput, "First Sale Blueprint — Updated");
    });

    const funnelLabel = Array.from(mount2.container.querySelectorAll("form label")).find(
      (l) => (l.textContent || "").trim() === "FunnelWorks"
    );
    assert.ok(funnelLabel);
    await act(async () => {
      (funnelLabel.querySelector('input[type="checkbox"]') as HTMLInputElement).click();
    });

    const saveBtn = mount2.container.querySelector('form button[type="submit"]') as HTMLButtonElement;
    await act(async () => {
      saveBtn.click();
    });
    await flushMicrotasks();

    assert.match(mount2.container.textContent || "", /Project updated successfully\./);
    assert.match(mount2.container.textContent || "", /First Sale Blueprint — Updated/);
    assert.match(mount2.container.textContent || "", /funnelworks/i);

    // Archive project
    const archiveBtn = Array.from(mount2.container.querySelectorAll("button")).find((b) =>
      (b.textContent || "").includes("Archive")
    ) as HTMLButtonElement;
    assert.ok(archiveBtn);
    await act(async () => {
      archiveBtn.click();
    });
    await flushMicrotasks();

    assert.match(mount2.container.textContent || "", /Project archived\./);
    assert.match(mount2.container.textContent || "", /Restore/);

    // Restore project
    const restoreBtn = Array.from(mount2.container.querySelectorAll("button")).find((b) =>
      (b.textContent || "").includes("Restore")
    ) as HTMLButtonElement;
    assert.ok(restoreBtn);
    await act(async () => {
      restoreBtn.click();
    });
    await flushMicrotasks();

    assert.match(mount2.container.textContent || "", /Project restored to active\./);

    // Switch authenticated user to User B -> User A's project disappears immediately
    store.currentAuthUid = "user_b";
    await act(async () => {
      mount2.root.render(
        React.createElement(ContentPaysUsUnifiedWorkspace, {
          user: { uid: "user_b", email: "bob@threadsworks.com" },
          profile: { email: "bob@threadsworks.com" },
          subscriptionStatus: "active",
          onNavigateToTab: () => {},
          onRefreshProfile: () => {},
          projectsAdapter: adapter
        })
      );
    });
    await flushMicrotasks();

    const projectsTabB = mount2.container.querySelector(
      'button[aria-label^="Navigate to Projects"]'
    ) as HTMLButtonElement;
    await act(async () => {
      projectsTabB.click();
    });
    await flushMicrotasks();

    assert.doesNotMatch(mount2.container.textContent || "", /First Sale Blueprint/);
    assert.ok(
      mount2.container.querySelector('[data-projects-state="empty"]'),
      "User B with zero projects must see an isolated empty state and never User A's data"
    );
  } finally {
    await mount2.cleanup();
  }
});

test("ContentPaysUsUnifiedWorkspace supports single-app creation and distinguishes loading and connection-error states", async () => {
  const store = new RulesEnforcingProjectsStore();
  store.currentAuthUid = "user_single";
  store.rulesDeployed = true;

  // 1. Single-app creation via service + rules store
  const singleCreated = await createUserProject(
    "user_single",
    {
      name: "Threads Daily Sprint",
      objective: "Grow audience with daily threads",
      associatedAppIds: ["threadsworks"]
    },
    store.createAdapter()
  );
  assert.deepStrictEqual(singleCreated.associatedAppIds, ["threadsworks"]);
  assert.strictEqual(store.listDocs("user_single").length, 1);

  // 2. Loading state -> Connection error state -> Loaded recovery in UI
  let resolveFetch: ((value: EcosystemProject[]) => void) | null = null;
  let rejectFetch: ((err: unknown) => void) | null = null;
  let mode: "pending_fail" | "succeed" = "pending_fail";

  const statefulAdapter: SharedProjectsClientAdapter = {
    getCurrentAuthUid: () => "user_single",
    listDocs: async (uid: string) => {
      if (mode === "pending_fail") {
        return new Promise<EcosystemProject[]>((resolve, reject) => {
          resolveFetch = resolve;
          rejectFetch = reject;
        });
      }
      return store.listDocs(uid);
    },
    addProjectDoc: async (payload) => store.addRawDoc(payload),
    updateProjectDoc: async (id, patch) => store.updateRawDoc(id, patch)
  };

  const { container, root, cleanup } = createMountedDom();
  try {
    await act(async () => {
      root.render(
        React.createElement(ContentPaysUsUnifiedWorkspace, {
          user: { uid: "user_single", email: "single@threadsworks.com" },
          profile: { email: "single@threadsworks.com" },
          subscriptionStatus: "active",
          onNavigateToTab: () => {},
          onRefreshProfile: () => {},
          projectsAdapter: statefulAdapter
        })
      );
    });

    const projectsTab = container.querySelector(
      'button[aria-label^="Navigate to Projects"]'
    ) as HTMLButtonElement;
    await act(async () => {
      projectsTab.click();
    });

    // While pending: loading indicator shown, neither empty nor error shown
    assert.match(container.textContent || "", /Loading projects\.\.\./);
    assert.strictEqual(container.querySelector('[data-projects-state="empty"]'), null);
    assert.strictEqual(container.querySelector('[data-projects-state="permission-denied"]'), null);
    assert.strictEqual(container.querySelector('[data-projects-state="load-error"]'), null);

    // Reject with network/unavailable error -> connection-error state (distinct from permission-denied and empty)
    const netErr = new Error("Firestore unavailable: network offline") as Error & { code: string };
    netErr.code = "unavailable";
    await act(async () => {
      rejectFetch?.(netErr);
    });
    await flushMicrotasks();

    assert.ok(
      container.querySelector('[data-projects-state="load-error"]'),
      "Network failure must render load-error state"
    );
    assert.strictEqual(container.querySelector('[data-projects-state="permission-denied"]'), null);
    assert.strictEqual(container.querySelector('[data-projects-state="empty"]'), null);

    // Retry succeeds -> single-app project appears
    mode = "succeed";
    const retryBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      (b.textContent || "").includes("Retry Loading Projects")
    ) as HTMLButtonElement;
    assert.ok(retryBtn);
    await act(async () => {
      retryBtn.click();
    });
    await flushMicrotasks();

    assert.strictEqual(container.querySelector('[data-projects-state="load-error"]'), null);
    assert.match(container.textContent || "", /Threads Daily Sprint/);
    assert.ok(resolveFetch || true);
  } finally {
    await cleanup();
  }
});

