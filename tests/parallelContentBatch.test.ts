import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../server.ts", import.meta.url), "utf8");
const start = source.indexOf("    const prefetched = new Map<number, PrefetchedChunk>();");
const end = source.indexOf("    for (let offset = 0; offset < postCount; offset += chunkSize)", start);
assert.ok(start >= 0 && end > start);
const wave = source.slice(start, end)
  .replace("new Map<number, PrefetchedChunk>()", "new Map()")
  .replace("prefetchWave(offset: number)", "prefetchWave(offset)");

function setup(count: number, chunkSize: number, failSlot?: number) {
  let active = 0;
  let maxActive = 0;
  const calls: number[][] = [];
  const priors: unknown[][] = [];
  const generatedPosts = [{hook:"accepted"}];
  const context = vm.createContext({
    generatedPosts, postCount: count, chunkSize, writerConcurrency: 2,
    slotPlan: Array.from({length: count}, () => ({targetParts: 3})),
    writingPlan: {recommendedParts: 3},
    generateRawChunk: async (slots: number[], expected: number, parts: number, prior: unknown[]) => {
      active++;
      maxActive = Math.max(maxActive, active);
      calls.push(slots); priors.push(prior);
      assert.equal(expected, slots.length);
      assert.equal(parts, slots.length * 3);
      await Promise.resolve();
      active--;
      if (slots[0] === failSlot) throw new Error("provider failure");
      return slots;
    }
  });
  const result = vm.runInContext(wave + "\n({prefetched, prefetchWave})", context);
  return {...result, calls, priors, generatedPosts, maxActive: () => maxActive};
}

test("32 posts: writer waves cover every slot exactly once with concurrency bounded at two", async () => {
  const s = setup(32, 3);
  for (let offset = 0; offset < 32; offset += 6) {
    await s.prefetchWave(offset);
    for (let n = offset; n < Math.min(offset+6,32); n += 3) {
      assert.equal(s.prefetched.get(n).ok, true);
      s.prefetched.delete(n);
    }
  }
  assert.deepEqual(Array.from(s.calls.flat()), Array.from({length:32},(_,i)=>i+1));
  assert.equal(s.maxActive(), 2);
  assert.ok(s.priors.every(p => p !== s.generatedPosts));
});

test("a failed speculative writer is captured without rejecting a valid sibling", async () => {
  const s = setup(32, 4, 5);
  await s.prefetchWave(0);
  assert.equal(s.prefetched.get(0).ok, true);
  assert.equal(s.prefetched.get(4).ok, false);
  assert.equal(s.prefetched.get(4).error.message, "provider failure");
});

test("large-batch recovery remains gated and never bypasses final validation", () => {
  assert.match(source, /body\.allowPartialResults !== false && process\.env\.CONTENT_BATCH_PARALLEL_ENABLED === "true"/);
  assert.match(source, /!allowPartialResults \|\| res\.destroyed \|\| !generatedPosts\.length/);
  assert.match(source, /failure\.code !== "NETWORK_ERROR" && failure\.code !== "PROVIDER_ERROR"/);
  const boundary = source.indexOf("Generation interrupted before this draft could be validated.");
  const validation = source.indexOf("validateUniversalBatch(generatedPosts", boundary);
  const commit = source.indexOf("await commitGeneration(serverDb, activeUserId, limitHandle)", validation);
  assert.ok(boundary >= 0 && validation > boundary && commit > validation);
});
