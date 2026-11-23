/**
 * Universal Content Engine regression suite covering:
 * - AI-guided 1–10 part generation across single, batch (4/8/16/32), regenerate, best-post, and thread flows
 * - Controlled randomness (deterministic with seed, natural variation without mandatory diversity quotas)
 * - Explicit creator overrides (exact part counts 1..10, exact sentences per part)
 * - Adaptive internal batch chunking for large/deep generation requests
 * - Quota-free validation & bounded malformed/duplicate recovery
 * - Persistence & UI thread-length compatibility (1–10 parts)
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildGatedWriteContext,
  resolveWritingLengthPlan,
  UNIVERSAL_AUTO_MIN_PARTS,
  UNIVERSAL_AUTO_MAX_PARTS,
} from "../server/writeContextGate.ts";
import {
  buildRollingLedger,
  planBatchSlots,
  planEightPostAiDecideParts,
  createSeededRandom,
} from "../server/writeDiversityEngine.ts";
import {
  computeAdaptiveChunkSize,
  createUniversalGenerationContract,
  validateUniversalBatch,
  normalizeBatchPosts,
  writeValidatedChunk,
} from "../server/contentBatchContract.ts";

const DISTINCT_PART_BODIES = [
  "opening observation that frames the central tradeoff clearly.",
  "why short routines outperform ambitious plans after the second week.",
  "measuring output quality by reader replies rather than raw impressions.",
  "separating drafting sessions from editing passes so momentum stays high.",
  "choosing concrete client questions over abstract industry clichés.",
  "trimming throat-clearing intros so the real claim lands in sentence one.",
  "organizing multi-part threads so each card carries one standalone point.",
  "tracking which angles spark bookmarks across a thirty-day publishing window.",
  "reviewing archived notes before opening a blank editor every Monday morning.",
  "closing with a calm takeaway that invites thoughtful discussion without hype.",
];

function buildValidDraft(parts: number, label: string) {
  const firstPart = `${label}: ${DISTINCT_PART_BODIES[0]}`;
  return {
    title: `${label} title`,
    hook: firstPart,
    singlePost: firstPart,
    threadParts: Array.from({ length: parts }, (_, idx) =>
      `${label}: ${DISTINCT_PART_BODIES[idx] || `distinct closing point number ${idx + 1}.`}`
    ),
    cta: "",
    ctaDecision: "omit",
  };
}

test("A. Universal auto range spans 1–10 parts and prevents shallow 1-part trap on normal short prompts", () => {
  assert.equal(UNIVERSAL_AUTO_MIN_PARTS, 1);
  assert.equal(UNIVERSAL_AUTO_MAX_PARTS, 10);

  // Typical short creator topic (formerly trapped into short_observation by wordCount <= 16)
  const normalTopic = resolveWritingLengthPlan({
    contentRequest: "Content consistency for solo founders on Threads",
    threadLength: "auto",
    sentencesPerPart: "auto",
  });
  assert.notEqual(
    normalTopic.profile,
    "short_observation",
    "Normal short creator topics must not be trapped in short_observation"
  );
  assert.equal(normalTopic.minParts, 1);
  assert.equal(normalTopic.maxParts, 10);
  assert.ok(normalTopic.recommendedParts >= 2);
});

test("B. 8-post auto batch uses AI-guided 1–10 planning without collapsing to all 1-part stubs and without mandatory diversity quotas", () => {
  const gated = buildGatedWriteContext(
    { writingStyle: "Direct, practical strategist" },
    { threadLength: "auto", sentencesPerPart: "auto" },
    "Audience building and authority positioning on Threads"
  );
  const ledger = buildRollingLedger(null);
  const initialSlots = planBatchSlots({
    count: 8,
    ledger,
    writingPlan: gated.writingPlan,
    randomSeed: "batch-8-seed",
  });
  const planned = planEightPostAiDecideParts(initialSlots, gated.writingPlan, {
    randomSeed: "batch-8-seed",
  });

  assert.equal(planned.length, 8);
  assert.ok(planned.every((s) => (s.targetParts || 0) >= 1 && (s.targetParts || 0) <= 10));
  assert.ok(
    planned.some((s) => (s.targetParts || 0) >= 3),
    "Auto 8-post plan must include multi-part depth rather than all shallow 1-part posts"
  );

  // Quota-free validation: both varied batches AND naturally repeated part counts pass
  const variedEight = [1, 2, 3, 4, 5, 6, 8, 10].map((p, i) => buildValidDraft(p, `Varied ${i + 1}`));
  assert.doesNotThrow(() =>
    validateUniversalBatch(variedEight, {
      expectedCount: 8,
      minParts: 1,
      maxParts: 10,
      characterLimit: 500,
    })
  );

  const naturalRepeatsEight = [3, 3, 3, 4, 4, 4, 2, 2].map((p, i) => buildValidDraft(p, `Repeat ${i + 1}`));
  assert.doesNotThrow(() =>
    validateUniversalBatch(naturalRepeatsEight, {
      expectedCount: 8,
      minParts: 1,
      maxParts: 10,
      characterLimit: 500,
    })
  );
});

test("C. Adaptive internal chunking keeps large (16, 32) and deep (7–10 part) requests safe while preserving exact total post count", () => {
  const autoPlan = resolveWritingLengthPlan({
    contentRequest: "Practical growth systems for digital creators",
    threadLength: "auto",
    sentencesPerPart: "auto",
  });
  assert.equal(computeAdaptiveChunkSize(1, autoPlan), 1);
  assert.equal(computeAdaptiveChunkSize(4, autoPlan), 4);
  assert.equal(computeAdaptiveChunkSize(8, autoPlan), 4);
  assert.equal(computeAdaptiveChunkSize(16, autoPlan), 4);
  assert.equal(computeAdaptiveChunkSize(32, autoPlan), 4);
  // Deep tutorial / high-depth auto plans stay capped at <= 2 posts per chunk to prevent truncation
  const deepAutoPlan = resolveWritingLengthPlan({
    contentRequest: "Complete step-by-step tutorial on building a distributed event pipeline from scratch",
    threadLength: "auto",
    sentencesPerPart: "auto",
  });
  assert.equal(computeAdaptiveChunkSize(8, deepAutoPlan), 2);
  assert.equal(computeAdaptiveChunkSize(16, deepAutoPlan), 2);

  // Explicit single-part batches can safely pack 4 per chunk; deep explicit 7–10 part threads pack 1 per chunk
  assert.equal(computeAdaptiveChunkSize(16, { partCountMode: "explicit", recommendedParts: 1, maxParts: 1 }), 4);
  assert.equal(computeAdaptiveChunkSize(16, { partCountMode: "explicit", recommendedParts: 2, maxParts: 2 }), 3);
  assert.equal(computeAdaptiveChunkSize(16, { partCountMode: "explicit", recommendedParts: 5, maxParts: 5 }), 2);
  assert.equal(computeAdaptiveChunkSize(8, { partCountMode: "explicit", recommendedParts: 8, maxParts: 8 }), 1);
  assert.equal(computeAdaptiveChunkSize(8, { partCountMode: "explicit", recommendedParts: 10, maxParts: 10 }), 1);

  for (const batchSize of [1, 4, 8, 16, 32]) {
    const ledger = buildRollingLedger(null);
    const slotPlan = planBatchSlots({
      count: batchSize,
      ledger,
      writingPlan: autoPlan,
      randomSeed: `size-${batchSize}`,
    });
    const contract = createUniversalGenerationContract({
      generationMode: batchSize === 1 ? "single" : "batch",
      requestedBatchSize: batchSize,
      writingPlan: autoPlan,
      characterLimit: 500,
      ctaOff: false,
      slotPlan,
    });
    assert.equal(contract.requestedBatchSize, batchSize);
    assert.equal(contract.slotPlanSummary.length, batchSize);
    assert.equal(contract.partsMode, "auto");
    assert.equal(contract.minParts, 1);
    assert.equal(contract.maxParts, 10);
    assert.ok(contract.chunkSize >= 1 && contract.chunkSize <= 4);
    assert.equal(contract.chunkCount, Math.ceil(batchSize / contract.chunkSize));
  }
});

test("D. Explicit creator overrides (1, 5, 8, 10 parts) override auto heuristics and ignore randomness", () => {
  for (const explicitParts of [1, 5, 8, 10]) {
    const gated = buildGatedWriteContext(
      { writingStyle: "Sharp and clear" },
      { threadLength: String(explicitParts), sentencesPerPart: "auto" },
      "Why simple publishing workflows outperform complex calendars"
    );
    assert.equal(gated.writingPlan.partCountMode, "explicit");
    assert.equal(gated.writingPlan.recommendedParts, explicitParts);
    assert.equal(gated.writingPlan.minParts, explicitParts);
    assert.equal(gated.writingPlan.maxParts, explicitParts);
    assert.equal(gated.directives.partCount, explicitParts);

    const slotsA = planBatchSlots({
      count: 4,
      ledger: buildRollingLedger(null),
      partCount: explicitParts,
      writingPlan: gated.writingPlan,
      randomSeed: "seed-1",
    });
    const slotsB = planBatchSlots({
      count: 4,
      ledger: buildRollingLedger(null),
      partCount: explicitParts,
      writingPlan: gated.writingPlan,
      randomSeed: "seed-999",
    });
    assert.ok(slotsA.every((s) => s.targetParts === explicitParts));
    assert.ok(slotsB.every((s) => s.targetParts === explicitParts));

    const validPosts = Array.from({ length: 4 }, (_, i) => buildValidDraft(explicitParts, `Explicit${explicitParts}-${i + 1}`));
    assert.doesNotThrow(() =>
      validateUniversalBatch(validPosts, {
        expectedCount: 4,
        explicitPartCount: explicitParts,
        characterLimit: 500,
      })
    );

    // Off-by-one part count must fail explicit validation
    const wrongCount = explicitParts === 10 ? 9 : explicitParts + 1;
    assert.throws(
      () =>
        validateUniversalBatch(
          [...validPosts.slice(0, 3), buildValidDraft(wrongCount, "Wrong")],
          { expectedCount: 4, explicitPartCount: explicitParts, characterLimit: 500 }
        ),
      /explicitly requested/i
    );
  }
});

test("E. Controlled randomness is deterministic per seed and produces natural variation across distinct seeds", () => {
  const rng1 = createSeededRandom("creator-seed-42");
  const rng2 = createSeededRandom("creator-seed-42");
  assert.deepEqual(
    [rng1(), rng1(), rng1(), rng1()],
    [rng2(), rng2(), rng2(), rng2()]
  );

  const plan = resolveWritingLengthPlan({
    contentRequest: "Turning client observations into high-trust Threads posts",
    threadLength: "auto",
    sentencesPerPart: "auto",
  });
  const ledger = buildRollingLedger(null);
  const runA = planBatchSlots({ count: 8, ledger, writingPlan: plan, randomSeed: "seed-one" }).map(
    (s) => s.targetParts
  );
  const runB = planBatchSlots({ count: 8, ledger, writingPlan: plan, randomSeed: "seed-one" }).map(
    (s) => s.targetParts
  );
  const runC = planBatchSlots({ count: 8, ledger, writingPlan: plan, randomSeed: "seed-two" }).map(
    (s) => s.targetParts
  );

  assert.deepEqual(runA, runB, "Same seed must be reproducible");
  assert.notDeepEqual(runA, runC, "Distinct seeds should produce natural variation in auto mode");
});

test("F. Malformed, oversized (>10), >500 char, empty, and duplicate parts are rejected and recovered cleanly", async () => {
  // Reject >10 parts
  assert.throws(
    () =>
      validateUniversalBatch([buildValidDraft(11, "Oversized")], {
        expectedCount: 1,
        minParts: 1,
        maxParts: 10,
      }),
    /must contain 1–10 thread parts/i
  );

  // Reject >500 character part
  const tooLong = buildValidDraft(2, "TooLong");
  tooLong.threadParts[1] = "A".repeat(505);
  assert.throws(
    () =>
      validateUniversalBatch([tooLong], {
        expectedCount: 1,
        minParts: 1,
        maxParts: 10,
        characterLimit: 500,
      }),
    /exceeds the 500-character limit/i
  );

  // Reject exact duplicate parts inside a thread
  const duplicated = buildValidDraft(3, "Dup");
  duplicated.threadParts[2] = duplicated.threadParts[1];
  assert.throws(
    () =>
      validateUniversalBatch([duplicated], {
        expectedCount: 1,
        minParts: 1,
        maxParts: 10,
      }),
    /duplicate thread parts/i
  );

  // Bounded repair recovers a duplicate-part draft into a valid 7-part thread
  let repaired = false;
  const chunk = await writeValidatedChunk({
    slotNumbers: [1],
    priorAcceptedDrafts: [],
    validation: {
      characterLimit: 500,
      minParts: 1,
      maxParts: 10,
      checkInternalRepetition: true,
    },
    generateChunk: async () => [duplicated],
    reviewDrafts: async (drafts) => drafts.map((d) => ({ slotNumber: d.slotNumber, passed: true, defects: [] })),
    repairDraft: async () => {
      repaired = true;
      return buildValidDraft(7, "RepairedSevenPart");
    },
    replaceDraft: async () => {
      throw new Error("Should not replace after successful repair");
    },
  });
  assert.equal(repaired, true);
  assert.equal(chunk.acceptedDrafts.length, 1);
  assert.equal(chunk.acceptedDrafts[0].threadParts.length, 7);

  // normalizeBatchPosts preserves 10-part threads without truncating
  const tenPart = buildValidDraft(10, "DeepTen");
  const normalized = normalizeBatchPosts([tenPart], 1, {
    characterLimit: 500,
    minParts: 1,
    maxParts: 10,
    checkInternalRepetition: true,
  });
  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].threadParts.length, 10);
});

test("G. Server & client wiring preserves 1–10 parts and removes legacy eightPostAiDecideRule conflicts", () => {
  const serverSrc = readFileSync(new URL("../server.ts", import.meta.url), "utf8");
  const engineSrc = readFileSync(new URL("../src/components/ContentEngineView.tsx", import.meta.url), "utf8");
  const persistenceSrc = readFileSync(new URL("../src/context/ContentPersistenceContext.tsx", import.meta.url), "utf8");

  assert.equal(
    serverSrc.includes("eightPostAiDecideRule:"),
    false,
    "Legacy conflicting eightPostAiDecideRule prompt must be removed from server.ts"
  );
  assert.ok(serverSrc.includes("computeAdaptiveChunkSize(postCount, writingPlan, slotPlan)"));
  assert.ok(serverSrc.includes("validateUniversalBatch("));
  assert.ok(engineSrc.includes("resolveStandardContentEngineLengthSettings"), "ContentEngineView must resolve standard auto length settings cleanly");
  assert.equal(persistenceSrc.includes("localStorage.getItem('threads_thread_length')"), false, "ContentPersistenceContext must not hydrate hidden legacy length overrides");
});
