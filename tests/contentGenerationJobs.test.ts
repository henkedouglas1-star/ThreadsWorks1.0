import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ContentGenerationJobStore,
  isValidJobId,
  normalizeIdempotencyKey,
} from "../server/contentGenerationJobs.ts";
import {
  runResilientBatchGeneration,
  resumePersistedGenerationJob,
  savePersistedActiveJob,
  loadPersistedActiveJob,
  clearPersistedActiveJob,
  isTransientNetworkError,
} from "../src/lib/contentGenerationClient.ts";
import {
  commitGeneration,
  releaseReservation,
  checkAndReserveGeneration,
} from "../server/generationLimitService.ts";

function createMemoryStorage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => {
      map.set(k, String(v));
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
  };
}

function createFakeFirestore() {
  const docs = new Map<string, Record<string, any>>();
  const collection = (colName: string) => ({
    doc: (docId: string) => {
      const fullKey = `${colName}/${docId}`;
      return {
        get: async () => ({
          id: docId,
          exists: docs.has(fullKey),
          data: () => (docs.has(fullKey) ? structuredClone(docs.get(fullKey)) : undefined),
        }),
        set: async (data: Record<string, any>, opts?: { merge?: boolean }) => {
          const prev = opts?.merge && docs.has(fullKey) ? docs.get(fullKey)! : {};
          docs.set(fullKey, structuredClone({ ...prev, ...data }));
        },
      };
    },
    where: (field: string, _op: string, value: any) => {
      const filters: Array<[string, any]> = [[field, value]];
      const queryObj: any = {
        where: (f2: string, _op2: string, v2: any) => {
          filters.push([f2, v2]);
          return queryObj;
        },
        limit: (_n: number) => queryObj,
        get: async () => {
          const matched: Array<{ id: string; data: () => any }> = [];
          for (const [key, docData] of docs.entries()) {
            if (!key.startsWith(`${colName}/`)) continue;
            if (filters.every(([f, v]) => docData[f] === v)) {
              matched.push({
                id: key.slice(colName.length + 1),
                data: () => structuredClone(docData),
              });
            }
          }
          return { empty: matched.length === 0, docs: matched };
        },
      };
      return queryObj;
    },
  });

  return {
    docs,
    collection,
    runTransaction: async <T>(fn: (tx: any) => Promise<T>): Promise<T> => {
      const tx = {
        get: (ref: any) => ref.get(),
        set: (ref: any, data: any, opts?: any) => ref.set(data, opts),
      };
      return fn(tx);
    },
  };
}

test("ContentGenerationJobStore: creates jobs, enforces ownership/token auth, and persists to Firestore without storing plaintext token", async () => {
  const fakeDb = createFakeFirestore();
  const store = new ContentGenerationJobStore({
    enableCleanupTimer: false,
    firestoreDb: fakeDb as any,
  });

  const created = store.createJob({
    requestId: "req_auth_1",
    ownerUserId: "user_alice",
    category: "trust",
    requestedCount: 7,
    idempotencyKey: "idem_alice_001",
    limitHandle: "res_alice_001",
  });

  assert.equal(created.ok, true);
  if (!created.ok) return;
  assert.equal(created.deduplicated, false);
  const { job } = created;
  assert.ok(isValidJobId(job.jobId));
  assert.ok(job.accessToken && job.accessToken.length >= 32);

  // Access control checks
  assert.equal(store.authorizeJobAccess(job, { jobToken: job.accessToken }), true);
  assert.equal(store.authorizeJobAccess(job, { verifiedUid: "user_alice" }), true);
  assert.equal(store.authorizeJobAccess(job, { jobToken: "wrong_token" }), false);
  assert.equal(store.authorizeJobAccess(job, { verifiedUid: "user_bob" }), false);
  // Even with a leaked token, a different verified user is rejected
  assert.equal(
    store.authorizeJobAccess(job, { jobToken: job.accessToken, verifiedUid: "user_bob" }),
    false
  );

  // Complete job and verify Firestore persistence strips plaintext accessToken
  await store.completeJob(job.jobId, {
    posts: Array.from({ length: 7 }, (_, i) => ({
      id: `p_${i + 1}`,
      title: `Post ${i + 1}`,
      hook: `Hook ${i + 1}`,
      threadParts: [`Hook ${i + 1} full body`],
    })),
    count: 7,
    requestedCount: 7,
    category: "trust",
  });

  const persistedDoc = fakeDb.docs.get(`generation_jobs/${job.jobId}`);
  assert.ok(persistedDoc, "Completed job must be persisted to Firestore generation_jobs");
  assert.equal(persistedDoc.userId, "user_alice");
  assert.equal(persistedDoc.status, "completed");
  assert.equal("accessToken" in persistedDoc, false, "Plaintext accessToken must never be persisted");
  assert.ok(persistedDoc.accessTokenHash, "Hashed token must be persisted");
  assert.equal(persistedDoc.result.posts.length, 7);

  // Simulate server restart: new empty in-memory store recovers job from Firestore
  const restartedStore = new ContentGenerationJobStore({
    enableCleanupTimer: false,
    firestoreDb: fakeDb as any,
  });
  const recovered = await restartedStore.getJobAsync(job.jobId);
  assert.ok(recovered, "Job must be recoverable from Firestore after server restart");
  assert.equal(recovered.status, "completed");
  assert.equal((recovered.result as any).posts.length, 7);
  // Both token hash and verified UID still authorize after rehydration
  assert.equal(restartedStore.authorizeJobAccess(recovered, { jobToken: job.accessToken }), true);
  assert.equal(restartedStore.authorizeJobAccess(recovered, { verifiedUid: "user_alice" }), true);
  assert.equal(restartedStore.authorizeJobAccess(recovered, { verifiedUid: "user_bob" }), false);

  store.dispose();
  restartedStore.dispose();
});

test("ContentGenerationJobStore: idempotencyKey deduplicates retries in-memory and across restarts", async () => {
  const fakeDb = createFakeFirestore();
  const store = new ContentGenerationJobStore({
    enableCleanupTimer: false,
    firestoreDb: fakeDb as any,
  });

  assert.equal(normalizeIdempotencyKey("idem_valid-123.abc"), "idem_valid-123.abc");
  assert.equal(normalizeIdempotencyKey("bad key with spaces!"), null);

  const first = store.createJob({
    requestId: "req_dedup_1",
    ownerUserId: "user_dedup",
    category: "attention",
    requestedCount: 4,
    idempotencyKey: "idem_retry_test_42",
  });
  assert.equal(first.ok, true);
  if (!first.ok) return;

  const second = store.createJob({
    requestId: "req_dedup_2",
    ownerUserId: "user_dedup",
    category: "attention",
    requestedCount: 4,
    idempotencyKey: "idem_retry_test_42",
  });
  assert.equal(second.ok, true);
  if (!second.ok) return;
  assert.equal(second.deduplicated, true);
  assert.equal(second.job.jobId, first.job.jobId);

  // Different user with same idempotencyKey does NOT collide
  const otherUser = store.createJob({
    requestId: "req_dedup_3",
    ownerUserId: "user_other",
    category: "attention",
    requestedCount: 4,
    idempotencyKey: "idem_retry_test_42",
  });
  assert.equal(otherUser.ok, true);
  if (!otherUser.ok) return;
  assert.equal(otherUser.deduplicated, false);
  assert.notEqual(otherUser.job.jobId, first.job.jobId);

  // Across restart lookup via Firestore
  await store.completeJob(first.job.jobId, { posts: [{ hook: "A" }], count: 1, requestedCount: 1 });
  const restarted = new ContentGenerationJobStore({
    enableCleanupTimer: false,
    firestoreDb: fakeDb as any,
  });
  const found = await restarted.findByIdempotencyKey("user_dedup", "idem_retry_test_42");
  assert.ok(found);
  assert.equal(found.jobId, first.job.jobId);

  store.dispose();
  restarted.dispose();
});

test("generationLimitService: commitGeneration and releaseReservation are strictly idempotent per reservationId", async () => {
  const fakeDb = createFakeFirestore();
  const userId = "free_user_accounting_test";

  const reserved = await checkAndReserveGeneration(fakeDb as any, userId, "free@example.com");
  assert.equal(reserved.allowed, true);
  assert.equal(reserved.isPro, false);
  assert.ok(reserved.reservationId);

  // Commit twice with same reservationId -> must charge only ONCE
  const c1 = await commitGeneration(fakeDb as any, userId, reserved.reservationId);
  const c2 = await commitGeneration(fakeDb as any, userId, reserved.reservationId);
  assert.equal(c1.used, 1);
  assert.equal(c2.used, 1);

  const usageDoc = fakeDb.docs.get(`generation_usage/${userId}`);
  assert.equal(usageDoc?.count, 1);
  assert.equal(usageDoc?.inFlight, 0);

  // Second reservation that fails -> release twice -> must NOT charge and must decrement inFlight only once
  const reserved2 = await checkAndReserveGeneration(fakeDb as any, userId, "free@example.com");
  assert.equal(reserved2.allowed, true);
  assert.equal(fakeDb.docs.get(`generation_usage/${userId}`)?.inFlight, 1);

  await releaseReservation(fakeDb as any, userId, reserved2.reservationId);
  await releaseReservation(fakeDb as any, userId, reserved2.reservationId);

  const usageAfterRelease = fakeDb.docs.get(`generation_usage/${userId}`);
  assert.equal(usageAfterRelease?.count, 1, "Failed/cancelled generation must not consume allowance");
  assert.equal(usageAfterRelease?.inFlight, 0, "In-flight reservation must be released cleanly");
});

test("runResilientBatchGeneration: recovers seamlessly from repeated WebKit TypeError: Load failed drops during start and polling without duplicate jobs", async () => {
  assert.equal(isTransientNetworkError(new TypeError("Load failed")), true);

  const storage = createMemoryStorage();
  const seenStartIdempotencyKeys: string[] = [];
  let startCalls = 0;
  let pollCalls = 0;
  const reconnectingEvents: number[] = [];

  const mockFetch: typeof fetch = async (input, init) => {
    const url = String(input);
    const headers = (init?.headers || {}) as Record<string, string>;

    if (url === "/api/generate-posts-jobs" && init?.method === "POST") {
      startCalls++;
      seenStartIdempotencyKeys.push(headers["X-Idempotency-Key"]);
      if (startCalls === 1) {
        // Simulate Safari/WebKit dropping the initial response
        throw new TypeError("Load failed");
      }
      return new Response(
        JSON.stringify({
          jobId: "job_12345678_abcdef",
          jobToken: "tok_secret_abcdef",
          requestId: "req_1",
          status: "running",
          category: "trust",
          requestedCount: 7,
          progress: { stage: "generating", completedCount: 0, requestedCount: 7, currentChunk: 1, totalChunks: 3 },
          pollIntervalMs: 250,
          deduplicated: true,
        }),
        { status: 202, headers: { "Content-Type": "application/json" } }
      );
    }

    if (url === "/api/generate-posts-jobs/job_12345678_abcdef" && init?.method === "GET") {
      assert.equal(headers["X-Job-Token"], "tok_secret_abcdef");
      pollCalls++;
      // Simulate 3 consecutive WebKit Load failed drops + one 503 proxy disconnect
      if (pollCalls <= 3) {
        throw new TypeError("Load failed");
      }
      if (pollCalls === 4) {
        return new Response("Bad Gateway", { status: 503 });
      }
      if (pollCalls === 5) {
        return new Response(
          JSON.stringify({
            jobId: "job_12345678_abcdef",
            requestId: "req_1",
            status: "running",
            category: "trust",
            requestedCount: 7,
            progress: { stage: "validating", completedCount: 4, requestedCount: 7, currentChunk: 2, totalChunks: 3 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({
          jobId: "job_12345678_abcdef",
          requestId: "req_1",
          status: "completed",
          category: "trust",
          requestedCount: 7,
          progress: { stage: "completed", completedCount: 7, requestedCount: 7, currentChunk: 3, totalChunks: 3 },
          result: {
            posts: Array.from({ length: 7 }, (_, i) => ({
              id: `post_${i + 1}`,
              title: `Post ${i + 1}`,
              hook: `Hook ${i + 1}`,
              threadParts: [`Hook ${i + 1} body`],
            })),
            count: 7,
            requestedCount: 7,
            category: "trust",
            generatorVersion: "V3",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    throw new Error(`Unexpected fetch call: ${init?.method} ${url}`);
  };

  const controller = new AbortController();
  const result = await runResilientBatchGeneration({
    payloadString: JSON.stringify({ contentRequest: "Test 7 posts", count: 7 }),
    clientRequestId: "req_client_test",
    idempotencyKey: "idem_fixed_key_777",
    userId: "user_1",
    targetCategory: "trust",
    requestedCount: 7,
    signal: controller.signal,
    storage,
    fetchImpl: mockFetch,
    sleepImpl: async () => {},
    onProgress: (_p, meta) => {
      if (meta?.reconnecting && meta.attempt) {
        reconnectingEvents.push(meta.attempt);
      }
    },
  });

  assert.equal(startCalls, 2);
  assert.deepEqual(seenStartIdempotencyKeys, ["idem_fixed_key_777", "idem_fixed_key_777"]);
  assert.equal(pollCalls, 6);
  assert.deepEqual(reconnectingEvents, [1, 2, 3, 4]);
  assert.equal(result.mode, "job");
  assert.equal(result.data.posts.length, 7);
  assert.equal(loadPersistedActiveJob("user_1", storage), null, "Completed job must clear localStorage entry");
});

test("resumePersistedGenerationJob: recovers completed posts after a simulated browser refresh", async () => {
  const storage = createMemoryStorage();
  savePersistedActiveJob(
    {
      jobId: "job_99999999_refresh",
      jobToken: "tok_refresh_xyz",
      clientRequestId: "req_before_refresh",
      idempotencyKey: "idem_before_refresh",
      userId: "user_refresh",
      targetCategory: "sales",
      requestedCount: 4,
      startedAt: Date.now(),
    },
    storage
  );

  let fetchedUrls: string[] = [];
  const mockFetch: typeof fetch = async (input) => {
    fetchedUrls.push(String(input));
    return new Response(
      JSON.stringify({
        jobId: "job_99999999_refresh",
        requestId: "req_before_refresh",
        status: "completed",
        category: "sales",
        requestedCount: 4,
        progress: { stage: "completed", completedCount: 4, requestedCount: 4, currentChunk: 2, totalChunks: 2 },
        result: {
          posts: Array.from({ length: 4 }, (_, i) => ({
            id: `recovered_${i + 1}`,
            title: `Recovered ${i + 1}`,
            hook: `Recovered Hook ${i + 1}`,
            threadParts: [`Recovered Hook ${i + 1} content`],
          })),
          count: 4,
          requestedCount: 4,
          category: "sales",
          generatorVersion: "V3",
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  const controller = new AbortController();
  const recovered = await resumePersistedGenerationJob({
    userId: "user_refresh",
    signal: controller.signal,
    storage,
    fetchImpl: mockFetch,
    sleepImpl: async () => {},
  });

  assert.ok(recovered);
  assert.equal(recovered.mode, "recovered_job");
  assert.equal(recovered.data.posts.length, 4);
  assert.deepEqual(fetchedUrls, ["/api/generate-posts-jobs/job_99999999_refresh"]);
  assert.equal(loadPersistedActiveJob("user_refresh", storage), null);
  clearPersistedActiveJob(undefined, storage);
});

test("server.ts contract: bounded parallel generation is enabled for 4 and 7 posts and releaseReservation always passes userId", () => {
  const serverSrc = readFileSync(new URL("../server.ts", import.meta.url), "utf8");

  assert.ok(
    serverSrc.includes('const parallelEnabled = postCount >= 4 && process.env.CONTENT_BATCH_PARALLEL_ENABLED !== "false";'),
    "Bounded parallel generation must be enabled for 4 and 7 posts"
  );
  assert.ok(
    serverSrc.includes('app.post("/api/generate-posts-jobs"'),
    "Async job creation route must exist"
  );
  assert.ok(
    serverSrc.includes('app.get("/api/generate-posts-jobs/latest"'),
    "Latest recoverable job route must exist"
  );
  assert.ok(
    serverSrc.includes('app.get("/api/generate-posts-jobs/:jobId"'),
    "Job status polling route must exist"
  );
  assert.ok(
    serverSrc.includes('app.post("/api/generate-posts-jobs/:jobId/cancel"'),
    "Job cancellation route must exist"
  );
  assert.equal(
    serverSrc.includes("releaseReservation(serverDb, unreleasedHandle)"),
    false,
    "releaseReservation must never omit activeUserId"
  );
  assert.equal(
    serverSrc.includes("releaseReservation(serverDb, limitHandle)"),
    false,
    "releaseReservation must never omit userId"
  );
});
