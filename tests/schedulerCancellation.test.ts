/**
 * Regression test suite for scheduled-post cancellation, deletion, unscheduling,
 * concurrent race handling, retry non-resurrection, duplicate prevention, and worker restart durability.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateScheduledEligibility,
  claimScheduledPostTransaction,
  verifyBeforeExternalPublish,
  cancelScheduledPostTransaction,
  requeueTransientFailureTransaction,
  finalizeAbortedPrePublishCancellation,
  type ScheduledPostStoreAdapter,
  type ScheduledPostTransaction,
} from "../server/scheduledDispatchGuard.ts";

/**
 * Deterministic in-memory Firestore transaction simulator that serializes
 * transactions atomically just like Cloud Firestore optimistic concurrency.
 */
class MockAuthoritativePostStore implements ScheduledPostStoreAdapter {
  public docs = new Map<string, Record<string, any>>();
  private txChain: Promise<unknown> = Promise.resolve();

  seed(postId: string, data: Record<string, any>) {
    this.docs.set(postId, structuredClone(data));
  }

  rawDelete(postId: string) {
    this.docs.delete(postId);
  }

  async getPost(postId: string): Promise<Record<string, any> | null> {
    const doc = this.docs.get(postId);
    return doc ? structuredClone(doc) : null;
  }

  async runTransaction<T>(fn: (tx: ScheduledPostTransaction) => Promise<T>): Promise<T> {
    const run = async (): Promise<T> => {
      const stagedWrites: Array<{ type: "update" | "delete"; postId: string; patch?: Record<string, any> }> = [];
      const tx: ScheduledPostTransaction = {
        get: async (postId: string) => {
          const current = this.docs.get(postId);
          return {
            exists: Boolean(current),
            data: () => (current ? structuredClone(current) : undefined),
          };
        },
        update: (postId: string, patch: Record<string, any>) => {
          stagedWrites.push({ type: "update", postId, patch: structuredClone(patch) });
        },
        delete: (postId: string) => {
          stagedWrites.push({ type: "delete", postId });
        },
      };

      const result = await fn(tx);
      for (const write of stagedWrites) {
        if (write.type === "delete") {
          this.docs.delete(write.postId);
        } else if (write.type === "update" && write.patch) {
          const prev = this.docs.get(write.postId) || {};
          this.docs.set(write.postId, { ...prev, ...write.patch });
        }
      }
      return result;
    };

    const next = this.txChain.then(run, run);
    this.txChain = next.catch(() => {});
    return next;
  }
}

const DUE_TIME_MS = Date.parse("2026-06-15T14:00:00.000Z");
const BEFORE_DUE_MS = Date.parse("2026-06-15T13:55:00.000Z");
const AFTER_DUE_MS = Date.parse("2026-06-15T14:01:00.000Z");

function makeScheduledDoc(overrides: Record<string, any> = {}) {
  return {
    userId: "user-creator-1",
    status: "Scheduled",
    stage: "Scheduled",
    isPublished: false,
    scheduledFor: new Date(DUE_TIME_MS).toISOString(),
    threadParts: ["Scheduled thread part one."],
    ...overrides,
  };
}

test("1. Cancel scheduled post before due time -> never claimed, never published, evicted from cache", async () => {
  const store = new MockAuthoritativePostStore();
  const inMemoryCache = new Map<string, Record<string, any>>();
  const doc = makeScheduledDoc();
  store.seed("post-cancel-1", doc);
  inMemoryCache.set("post-cancel-1", { ...doc });

  // Cancel before due time
  const cancelRes = await cancelScheduledPostTransaction(store, {
    postId: "post-cancel-1",
    userId: "user-creator-1",
    mode: "cancel",
    nowMs: BEFORE_DUE_MS,
  });
  assert.equal(cancelRes.ok, true);
  assert.equal(cancelRes.outcome, "canceled");
  assert.equal(cancelRes.evictFromCache, true);

  // Even if a stale cache copy survived on another worker, claim MUST be denied and instruct eviction
  const claimRes = await claimScheduledPostTransaction(store, "post-cancel-1", AFTER_DUE_MS);
  assert.equal(claimRes.claimed, false);
  assert.equal(claimRes.evictFromCache, true);
  assert.equal(claimRes.reason, "POST_CANCELED");

  const stored = await store.getPost("post-cancel-1");
  assert.equal(stored?.status, "Canceled");
  assert.equal(stored?.isCanceled, true);
  assert.equal(stored?.scheduledFor, null);
});

test("2. Delete scheduled post before due time -> missing Firestore doc NEVER claimed or published", async () => {
  const store = new MockAuthoritativePostStore();
  const inMemoryCache = new Map<string, Record<string, any>>();
  const doc = makeScheduledDoc();
  store.seed("post-del-1", doc);
  inMemoryCache.set("post-del-1", { ...doc });

  // Simulate direct Firestore delete (e.g., from CalendarView fallback) leaving stale inMemoryCache
  store.rawDelete("post-del-1");

  // Worker wakes up with stale inMemoryCache entry at due time
  assert.equal(inMemoryCache.has("post-del-1"), true);
  const claimRes = await claimScheduledPostTransaction(store, "post-del-1", AFTER_DUE_MS);
  assert.equal(claimRes.claimed, false, "Deleted Firestore document must NEVER be granted a publish claim");
  assert.equal(claimRes.evictFromCache, true, "Deleted document must be evicted from in-memory cache");
  assert.equal(claimRes.reason, "DELETED");

  if (claimRes.evictFromCache) {
    inMemoryCache.delete("post-del-1");
  }
  assert.equal(inMemoryCache.has("post-del-1"), false);

  // Pre-publish check also blocks missing docs
  const preCheck = await verifyBeforeExternalPublish(store, "post-del-1", { nowMs: AFTER_DUE_MS });
  assert.equal(preCheck.allowed, false);
  assert.equal(preCheck.reason, "DELETED");
});

test("3. Unschedule single post back to Ready/Draft -> never claimed by future ticks", async () => {
  const store = new MockAuthoritativePostStore();
  store.seed("post-unsched-1", makeScheduledDoc());

  const unschedRes = await cancelScheduledPostTransaction(store, {
    postId: "post-unsched-1",
    userId: "user-creator-1",
    mode: "unschedule",
    nextStatus: "Ready",
    nowMs: BEFORE_DUE_MS,
  });
  assert.equal(unschedRes.ok, true);
  assert.equal(unschedRes.outcome, "unscheduled");
  assert.equal(unschedRes.evictFromCache, true);

  const claimRes = await claimScheduledPostTransaction(store, "post-unsched-1", AFTER_DUE_MS);
  assert.equal(claimRes.claimed, false);
  assert.equal(claimRes.evictFromCache, true);

  const stored = await store.getPost("post-unsched-1");
  assert.equal(stored?.status, "Ready");
  assert.equal(stored?.scheduledFor, null);
});

test("4. Concurrent cancel vs claim at due boundary -> atomic serialization ensures zero double-action", async () => {
  // Case A: Cancel commits first, then Claim runs
  const storeA = new MockAuthoritativePostStore();
  storeA.seed("race-a", makeScheduledDoc());

  const [cancelA, claimA] = await Promise.all([
    cancelScheduledPostTransaction(storeA, {
      postId: "race-a",
      userId: "user-creator-1",
      mode: "cancel",
      nowMs: AFTER_DUE_MS,
    }),
    claimScheduledPostTransaction(storeA, "race-a", AFTER_DUE_MS),
  ]);
  assert.equal(cancelA.ok, true);
  assert.equal(cancelA.outcome, "canceled");
  assert.equal(claimA.claimed, false);
  assert.equal(claimA.evictFromCache, true);

  // Case B: Claim commits first, then Cancel runs during in-progress window before Meta API call
  const storeB = new MockAuthoritativePostStore();
  storeB.seed("race-b", makeScheduledDoc());

  const [claimB, cancelB] = await Promise.all([
    claimScheduledPostTransaction(storeB, "race-b", AFTER_DUE_MS),
    cancelScheduledPostTransaction(storeB, {
      postId: "race-b",
      userId: "user-creator-1",
      mode: "cancel",
      nowMs: AFTER_DUE_MS,
    }),
  ]);
  assert.equal(claimB.claimed, true);
  assert.equal(cancelB.ok, false);
  assert.equal(cancelB.outcome, "already_publishing", "Must explicitly distinguish in-progress publishing from clean pre-publish cancellation");

  // Pre-publish authoritative check immediately before Meta API sees cancelRequested and aborts!
  let metaApiCalled = false;
  const preCheck = await verifyBeforeExternalPublish(storeB, "race-b", {
    expectedClaimToken: claimB.claimToken,
    nowMs: AFTER_DUE_MS,
  });
  assert.equal(preCheck.allowed, false);
  assert.equal(preCheck.reason, "POST_CANCELED");
  if (preCheck.allowed) {
    metaApiCalled = true;
  }
  assert.equal(metaApiCalled, false, "External Meta API must not be called when cancellation arrives before dispatch");

  await finalizeAbortedPrePublishCancellation(storeB, "race-b", AFTER_DUE_MS);
  const finalB = await storeB.getPost("race-b");
  assert.equal(finalB?.status, "Canceled");
  assert.equal(finalB?.isCanceled, true);
});

test("5. Transient failure retry NEVER resurrects a canceled, deleted, or unscheduled post", async () => {
  // 5a: Post deleted while publishing failed transiently
  const storeDeleted = new MockAuthoritativePostStore();
  storeDeleted.seed("retry-del", makeScheduledDoc());
  const claimDel = await claimScheduledPostTransaction(storeDeleted, "retry-del", AFTER_DUE_MS);
  assert.equal(claimDel.claimed, true);

  storeDeleted.rawDelete("retry-del");
  const requeueDel = await requeueTransientFailureTransaction(storeDeleted, {
    postId: "retry-del",
    retryCount: 1,
    errorMsg: "Network timeout",
    expectedClaimToken: claimDel.claimToken,
    nowMs: AFTER_DUE_MS + 5000,
  });
  assert.equal(requeueDel.requeued, false);
  assert.equal(requeueDel.evictFromCache, true);
  assert.equal(requeueDel.reason, "DELETED");
  assert.equal(await storeDeleted.getPost("retry-del"), null);

  // 5b: Post cancelRequested while publishing failed transiently
  const storeCanceled = new MockAuthoritativePostStore();
  storeCanceled.seed("retry-cancel", makeScheduledDoc());
  const claimCancel = await claimScheduledPostTransaction(storeCanceled, "retry-cancel", AFTER_DUE_MS);
  assert.equal(claimCancel.claimed, true);

  await cancelScheduledPostTransaction(storeCanceled, {
    postId: "retry-cancel",
    userId: "user-creator-1",
    mode: "cancel",
    nowMs: AFTER_DUE_MS + 1000,
  });

  const requeueCancel = await requeueTransientFailureTransaction(storeCanceled, {
    postId: "retry-cancel",
    retryCount: 1,
    errorMsg: "503 Service Unavailable",
    expectedClaimToken: claimCancel.claimToken,
    nowMs: AFTER_DUE_MS + 5000,
  });
  assert.equal(requeueCancel.requeued, false, "Transient retry must NEVER resurrect a canceled post");
  assert.equal(requeueCancel.evictFromCache, true);
  assert.equal(requeueCancel.reason, "POST_CANCELED");
  const settled = await storeCanceled.getPost("retry-cancel");
  assert.equal(settled?.status, "Canceled");
  assert.equal(settled?.scheduledFor, null);

  // 5c: Legitimate transient failure without cancellation DOES requeue cleanly
  const storeLegit = new MockAuthoritativePostStore();
  storeLegit.seed("retry-legit", makeScheduledDoc());
  const claimLegit = await claimScheduledPostTransaction(storeLegit, "retry-legit", AFTER_DUE_MS);
  assert.equal(claimLegit.claimed, true);

  const requeueLegit = await requeueTransientFailureTransaction(storeLegit, {
    postId: "retry-legit",
    retryCount: 1,
    errorMsg: "Temporary 502",
    expectedClaimToken: claimLegit.claimToken,
    nowMs: AFTER_DUE_MS + 5000,
  });
  assert.equal(requeueLegit.requeued, true);
  assert.equal(requeueLegit.evictFromCache, false);
  const requeuedDoc = await storeLegit.getPost("retry-legit");
  assert.equal(requeuedDoc?.status, "Scheduled");
  assert.equal(requeuedDoc?.retryCount, 1);
});

test("6. Concurrent duplicate scheduler workers -> post is claimed and published at most once", async () => {
  const store = new MockAuthoritativePostStore();
  store.seed("dup-post-1", makeScheduledDoc());

  const [worker1, worker2, worker3] = await Promise.all([
    claimScheduledPostTransaction(store, "dup-post-1", AFTER_DUE_MS),
    claimScheduledPostTransaction(store, "dup-post-1", AFTER_DUE_MS),
    claimScheduledPostTransaction(store, "dup-post-1", AFTER_DUE_MS),
  ]);

  const winners = [worker1, worker2, worker3].filter((r) => r.claimed);
  assert.equal(winners.length, 1, "Exactly one concurrent worker may claim a due scheduled post");

  const losers = [worker1, worker2, worker3].filter((r) => !r.claimed);
  assert.equal(losers.length, 2);
  assert.ok(losers.every((l) => l.reason === "ALREADY_PUBLISHING"));
});

test("7. Authorization & ownership check + Published immutability on cancel endpoint", async () => {
  const store = new MockAuthoritativePostStore();
  store.seed("owned-post", makeScheduledDoc({ userId: "owner-uid" }));

  const forbidden = await cancelScheduledPostTransaction(store, {
    postId: "owned-post",
    userId: "attacker-uid",
    mode: "delete",
    nowMs: BEFORE_DUE_MS,
  });
  assert.equal(forbidden.ok, false);
  assert.equal(forbidden.outcome, "forbidden");
  assert.ok(await store.getPost("owned-post"), "Unauthorized delete must leave document intact");

  store.seed("published-post", makeScheduledDoc({ status: "Published", isPublished: true, scheduledFor: null }));
  const pubCancel = await cancelScheduledPostTransaction(store, {
    postId: "published-post",
    userId: "user-creator-1",
    mode: "cancel",
    nowMs: AFTER_DUE_MS,
  });
  assert.equal(pubCancel.ok, false);
  assert.equal(pubCancel.outcome, "already_published");
});

test("8. Worker restart & future-post durability: canceled/deleted/future posts never fire", async () => {
  const store = new MockAuthoritativePostStore();
  store.seed("future-post", makeScheduledDoc({ scheduledFor: new Date(AFTER_DUE_MS + 600_000).toISOString() }));
  store.seed("canceled-post", makeScheduledDoc());

  await cancelScheduledPostTransaction(store, {
    postId: "canceled-post",
    userId: "user-creator-1",
    mode: "cancel",
    nowMs: BEFORE_DUE_MS,
  });

  // Simulate worker restart with empty in-memory cache scanning persisted docs
  const persistedFuture = await store.getPost("future-post");
  const persistedCanceled = await store.getPost("canceled-post");

  const evalFuture = evaluateScheduledEligibility(persistedFuture, AFTER_DUE_MS);
  assert.equal(evalFuture.eligible, false);
  assert.equal(evalFuture.reason, "NOT_DUE_YET");
  assert.equal(evalFuture.evictFromCache, false);

  const evalCanceled = evaluateScheduledEligibility(persistedCanceled, AFTER_DUE_MS);
  assert.equal(evalCanceled.eligible, false);
  assert.equal(evalCanceled.reason, "POST_CANCELED");
  assert.equal(evalCanceled.evictFromCache, true);
});
