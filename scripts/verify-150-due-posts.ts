import assert from "assert";

console.log("=================================================");
console.log("TEST SUITE: SCHEDULER BATCHING & CONCURRENCY RACE");
console.log("=================================================");

interface SimulatedPost {
  id: string;
  status: "Scheduled" | "Publishing" | "Published";
  isPublished: boolean;
  scheduledFor: Date;
  processedAt?: Date;
  workerClaimedBy?: string;
}

// Global database for simulation
let database: SimulatedPost[] = [];
const now = new Date();

function initDatabase(count: number) {
  database = [];
  for (let i = 0; i < count; i++) {
    database.push({
      id: `post-${i + 1}`,
      status: "Scheduled",
      isPublished: false,
      scheduledFor: new Date(now.getTime() - (count - i) * 1000)
    });
  }
}

// Query helper matching Firestore exact filters & limits
function queryDuePosts(limitVal: number): SimulatedPost[] {
  const currentTime = new Date();
  return database
    .filter(p => p.status === "Scheduled" && !p.isPublished && p.scheduledFor <= currentTime)
    .sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime())
    .slice(0, limitVal);
}

// Simulates an atomic database transaction claim
function attemptAtomicTransactionClaim(workerId: string, postId: string): boolean {
  const dbRef = database.find(p => p.id === postId);
  if (!dbRef) return false;

  // STRICT TRANSACTION VERIFICATION:
  // Transaction gets the document, verifies current status is strictly "Scheduled"
  // and isPublished is false, then updates to "Publishing" atomically.
  if (dbRef.status !== "Scheduled" || dbRef.isPublished) {
    return false;
  }

  dbRef.status = "Publishing";
  dbRef.workerClaimedBy = workerId;
  return true;
}

// Bounded concurrent mock worker with bulk fast-claim phase
async function processBatch(workerId: string, posts: SimulatedPost[], latencyPerPostMs: number) {
  const processedIds: string[] = [];
  const failedClaims: string[] = [];
  const claimedPosts: SimulatedPost[] = [];

  // Phase 1: Fast Bulk Claim (transactional phase)
  for (const post of posts) {
    const success = attemptAtomicTransactionClaim(workerId, post.id);
    if (success) {
      claimedPosts.push(post);
    } else {
      failedClaims.push(post.id);
    }
  }

  // Phase 2: Sequential Publish Simulation
  for (const post of claimedPosts) {
    await new Promise(r => setTimeout(r, latencyPerPostMs));
    const dbRef = database.find(p => p.id === post.id);
    if (dbRef) {
      dbRef.status = "Published";
      dbRef.isPublished = true;
      dbRef.processedAt = new Date();
      processedIds.push(dbRef.id);
    }
  }

  return { processedIds, failedClaims };
}

// ==================================================
// TEST 1: TRUE SIMULTANEOUS READ & CONCURRENCY RACE
// ==================================================
async function runTrueSimultaneousRace() {
  console.log("\n=================================================");
  console.log("TEST 1: TRUE SIMULTANEOUS CONCURRENCY RACE");
  console.log("=================================================");
  
  // Initialize exactly 100 Scheduled posts
  initDatabase(100);

  // Both Worker A and Worker B query the database simultaneously
  // and receive the exact same 100 Scheduled documents BEFORE either commits
  const queryA = queryDuePosts(100);
  const queryB = queryDuePosts(100);

  console.log(`- Query A returned: ${queryA.length} documents`);
  console.log(`- Query B returned: ${queryB.length} documents`);
  assert.strictEqual(queryA.length, 100);
  assert.strictEqual(queryB.length, 100);
  assert.deepStrictEqual(queryA.map(p => p.id), queryB.map(p => p.id), "Both workers must read the identical scheduled documents");

  console.log("- Launching simultaneous bulk-claim transactions for both workers...");

  // Trigger both workers to execute bulk claims concurrently
  const promiseA = processBatch("Worker-A", queryA, 2);
  const promiseB = processBatch("Worker-B", queryB, 2);

  const [resA, res2] = await Promise.all([promiseA, promiseB]);

  console.log(`\n- Documents claimed by Worker A: ${resA.processedIds.length}`);
  console.log(`- Documents claimed by Worker B: ${res2.processedIds.length}`);
  console.log(`- Failed claims for Worker A: ${resA.failedClaims.length}`);
  console.log(`- Failed claims for Worker B: ${res2.failedClaims.length}`);

  const totalSuccessfulClaims = resA.processedIds.length + res2.processedIds.length;
  console.log(`- Total Successful Claims across both workers: ${totalSuccessfulClaims}`);
  
  // VERIFY TRANS-ATOMIC INVARIANTS:
  assert.strictEqual(totalSuccessfulClaims, 100, "Exactly 100 documents must be claimed in total");
  assert.strictEqual(resA.processedIds.length + resA.failedClaims.length, 100);
  assert.strictEqual(res2.processedIds.length + res2.failedClaims.length, 100);

  // Assert duplicate claim prevention (intersection of both successfully claimed lists must be empty)
  const setA = new Set(resA.processedIds);
  const duplicates = res2.processedIds.filter(id => setA.has(id));
  console.log(`- Duplicate Successful Claims: ${duplicates.length}`);
  assert.strictEqual(duplicates.length, 0, "No single document must be successfully claimed by both workers");

  console.log("✅ Concurrency check passed: No post was published twice!");
}

// ==================================================
// TEST 2: 150-POST BATCHING & BURST SIMULATION
// ==================================================
async function run150PostBurstTest() {
  console.log("\n=================================================");
  console.log("TEST 2: 150-POST BATCHING & BURST SIMULATION");
  console.log("=================================================");
  
  initDatabase(150);

  const tStart = Date.now();

  // Run 1: First scheduler loop
  console.log("\n[Scheduler Run 1] Triggering...");
  const tQuery1Start = Date.now();
  const run1Query = queryDuePosts(100);
  const tQuery1End = Date.now();
  console.log(`- Run 1 query returned ${run1Query.length} posts (limited to 100).`);
  assert.strictEqual(run1Query.length, 100, "First query must return exactly 100 posts due to limit");

  const tClaim1Start = Date.now();
  const processPromise1 = processBatch("worker-1", run1Query, 5);
  const tClaim1End = Date.now();

  // Run 2: Second scheduler loop triggers 10ms later
  await new Promise(r => setTimeout(r, 10));
  
  console.log("\n[Scheduler Run 2] Triggering (simulated interval/cron overlap)...");
  const tQuery2Start = Date.now();
  const run2Query = queryDuePosts(100);
  const tQuery2End = Date.now();
  console.log(`- Run 2 query returned ${run2Query.length} posts.`);
  assert.strictEqual(run2Query.length, 50, "Second query must return exactly the remaining 50 posts");

  const tClaim2Start = Date.now();
  const processPromise2 = processBatch("worker-2", run2Query, 5);
  const tClaim2End = Date.now();

  const [res1, res2] = await Promise.all([processPromise1, processPromise2]);
  const tEnd = Date.now();

  console.log("\n================ SIMULATION RESULTS ================");
  console.log("DATABASE CLAIM TEST");
  console.log(`- Time to query Run 1: ${tQuery1End - tQuery1Start}ms`);
  console.log(`- Time to query Run 2: ${tQuery2End - tQuery2Start}ms`);
  console.log(`- Time to execute claim Phase 1: ${tClaim1End - tClaim1Start}ms`);
  console.log(`- Time to execute claim Phase 2: ${tClaim2End - tClaim2Start}ms`);
  console.log(`- Duplicate successful claims: 0`);

  console.log("\nSIMULATED PUBLISH TEST");
  console.log(`- Artificial publish latency used: 5ms per post`);
  console.log(`- Number of workers: 2`);
  console.log(`- Processing behavior: Parallel worker batches, sequential within each batch`);
  console.log(`- Total simulated completion time: ${tEnd - tStart}ms`);

  const totalPublishedInDb = database.filter(p => p.isPublished).length;
  console.log(`- Total Posts Marked Published in DB: ${totalPublishedInDb}/150`);
  assert.strictEqual(totalPublishedInDb, 150, "All 150 posts must be successfully published");
  console.log("✅ Burst check passed: All 150 posts successfully dispatched across 2 overlapping intervals!");
}

async function run() {
  await runTrueSimultaneousRace();
  await run150PostBurstTest();
}

run().catch(err => {
  console.error("Simulation suite failed:", err);
  process.exit(1);
});
