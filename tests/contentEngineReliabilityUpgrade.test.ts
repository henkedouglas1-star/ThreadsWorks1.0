/**
 * Content Engine Intelligence & Reliability Upgrade Regression Suite
 *
 * Covers Phase 5 required verification scenarios (Tests A through H) plus
 * Phase 3/4 safe deterministic corrections and Phase 6 privacy-safe diagnostics.
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
} from "../server/writeDiversityEngine.ts";
import {
  composeBatchWriterSystemInstruction,
  composeReviewerSystemInstruction,
} from "../server/writePromptComposer.ts";
import {
  applySafeDeterministicCorrections,
  buildGenerationBatchDiagnostics,
  computeAdaptiveChunkSize,
  generateValidatedBatch,
  GenerationPipelineError,
  normalizeBatchPosts,
  validateSingleDraft,
  validateUniversalBatch,
  writeValidatedChunk,
} from "../server/contentBatchContract.ts";
import { normalizeCanonicalRecord } from "../src/lib/canonicalContent.ts";

const CLEAN_PARTS_POOL = [
  "Consistency beats intensity when every post teaches one clear decision.",
  "Creators lose momentum when they rewrite their whole process every Monday instead of keeping one repeatable draft rhythm.",
  "Separating rough capture from editing cuts drafting time without flattening your authentic voice.",
  "Every part in a thread should carry its own complete idea so mobile readers keep moving naturally.",
  "When a single sentence resolves the thought cleanly, stop there instead of stretching it into filler.",
  "A multi-part breakdown works best when each card adds a distinct mechanism, example, or practical step.",
  "Documenting real lessons from building a product creates stronger trust than abstract motivational slogans.",
  "Start with the tension your reader recognizes immediately, then walk through how to resolve it cleanly.",
  "Reviewing what sparked genuine replies last month beats guessing what an algorithm wants next week.",
  "Close with a clear takeaway readers can actually apply the next time they sit down to write.",
];

function makeDraft(partCount: number, prefix: string, omitSinglePost: boolean = true) {
  const first = `${prefix}: ${CLEAN_PARTS_POOL[0]}`;
  const threadParts = Array.from({ length: partCount }, (_, idx) =>
    `${prefix}: ${CLEAN_PARTS_POOL[idx] || `Additional substantive point ${idx + 1}.`}`
  );
  return {
    title: `${prefix} Title`,
    hook: first,
    ...(omitSinglePost ? {} : { singlePost: first }),
    threadParts,
    cta: "",
    ctaDecision: "omit",
  };
}

// ---------------------------------------------------------------------------
// Test A: Legacy localStorage value threads_thread_length = "1" is ignored
// ---------------------------------------------------------------------------
test("Test A: Legacy localStorage threads_thread_length = '1' does not affect automatic batch generation", () => {
  const persistenceSrc = readFileSync(
    new URL("../src/context/ContentPersistenceContext.tsx", import.meta.url),
    "utf8"
  );
  const engineSrc = readFileSync(
    new URL("../src/components/ContentEngineView.tsx", import.meta.url),
    "utf8"
  );

  // Persistence context must NEVER read legacy threadLength / sentencesPerPart keys from localStorage
  assert.equal(persistenceSrc.includes("localStorage.getItem('threads_thread_length')"), false);
  assert.equal(persistenceSrc.includes("localStorage.getItem('threads_sentences_per_part')"), false);
  assert.equal(persistenceSrc.includes("localStorage.getItem(`threads_thread_length_${user.uid}`)"), false);
  assert.equal(persistenceSrc.includes("localStorage.getItem(`threads_sentences_per_part_${user.uid}`)"), false);

  // ContentEngineView always resolves standard length settings to automatic
  assert.ok(engineSrc.includes("resolveStandardContentEngineLengthSettings"));
  assert.ok(engineSrc.includes('threadLength: "auto"'));
  assert.ok(engineSrc.includes('sentencesPerPart: "auto"'));
  assert.equal(engineSrc.includes("localStorage.getItem('threads_thread_length')"), false);

  // Verify returning creator and new creator both produce identical auto_1_to_10 writing plans
  const returningCreatorPlan = resolveWritingLengthPlan({
    contentRequest: "Write inspiring content about building a business on Threads",
    threadLength: "auto",
    sentencesPerPart: "auto",
  });
  const newCreatorPlan = resolveWritingLengthPlan({
    contentRequest: "Write inspiring content about building a business on Threads",
  });
  assert.equal(returningCreatorPlan.partCountMode, "auto");
  assert.equal(returningCreatorPlan.effectiveLengthPolicy, "auto_1_to_10");
  assert.equal(returningCreatorPlan.minParts, 1);
  assert.equal(returningCreatorPlan.maxParts, 10);
  assert.deepEqual(returningCreatorPlan, newCreatorPlan);
});

// ---------------------------------------------------------------------------
// Test B: Saved Creator Context never overrides automatic length mode
// ---------------------------------------------------------------------------
test("Test B: Saved Creator Context mentioning 'single posts and threads' or '1-part post' leaves automatic mode active", () => {
  const scenarios = [
    "I publish single posts and threads.",
    "I write single posts and multi-part threads for digital creators. Keep a grounded voice.",
    "I usually share 1-part posts and 2 sentences per part updates about software.",
  ];

  for (const creatorContext of scenarios) {
    const gated = buildGatedWriteContext(
      {
        writingStyle: "Direct, calm strategist",
        customInstruction: creatorContext,
      },
      {
        threadLength: "auto",
        sentencesPerPart: "auto",
        customInstruction: creatorContext,
      },
      "Write inspiring content"
    );

    assert.equal(
      gated.writingPlan.partCountMode,
      "auto",
      `Creator Context "${creatorContext}" must NOT trigger explicit partCountMode`
    );
    assert.equal(gated.writingPlan.effectiveLengthPolicy, "auto_1_to_10");
    assert.equal(gated.writingPlan.minParts, UNIVERSAL_AUTO_MIN_PARTS);
    assert.equal(gated.writingPlan.maxParts, UNIVERSAL_AUTO_MAX_PARTS);
    assert.equal(gated.directives.partCount, undefined);
    assert.equal(gated.writingPlan.sentencesMode, "auto");
    assert.equal(gated.factsPayload.creatorContext, creatorContext);
  }
});

// ---------------------------------------------------------------------------
// Test C: Short 3-word request evaluates depth independently of prompt length
// ---------------------------------------------------------------------------
test("Test C: Short 3-word request 'Write inspiring content' gets full 1–10 auto depth independently of word count", () => {
  const gated = buildGatedWriteContext(
    { writingStyle: "Clear, authoritative, encouraging" },
    { threadLength: "auto", sentencesPerPart: "auto" },
    "Write inspiring content"
  );

  assert.equal(gated.writingPlan.profile, "standard");
  assert.equal(gated.writingPlan.partCountMode, "auto");
  assert.equal(gated.writingPlan.effectiveLengthPolicy, "auto_1_to_10");
  assert.equal(gated.writingPlan.minParts, 1);
  assert.equal(gated.writingPlan.maxParts, 10);
  assert.ok(gated.writingPlan.recommendedParts >= 3, "3-word prompt must not collapse into a 1-part default");

  const slots = planEightPostAiDecideParts(
    planBatchSlots({
      count: 8,
      ledger: buildRollingLedger(null),
      writingPlan: gated.writingPlan,
      randomSeed: "short-prompt-seed",
    }),
    gated.writingPlan,
    { randomSeed: "short-prompt-seed" }
  );

  assert.equal(slots.length, 8);
  assert.ok(slots.some((s) => (s.targetParts || 0) >= 3), "Short prompt must allow multi-part threads");
  assert.ok(slots.every((s) => Boolean(s.editorialStructure)), "Each slot must carry a natural editorial structure option");

  const prompt = composeBatchWriterSystemInstruction(gated);
  assert.ok(prompt.includes("Judge depth by idea substance, not prompt word count"));
  assert.ok(prompt.length < 4500);
});

// ---------------------------------------------------------------------------
// Test D: Detailed origin/purpose request gets rich narrative evaluation & varied structures
// ---------------------------------------------------------------------------
test("Test D: Detailed creator origin request produces rich narrative depth and distinct editorial structures", () => {
  const request =
    "Write inspiring content about how I started ThreadsWorks. It was designed to help someone save time as a content creator.";
  const gated = buildGatedWriteContext(
    {
      writingStyle: "Conversational founder strategist",
      customInstruction: "I publish single posts and threads for creators who want consistent output without burnout.",
    },
    { threadLength: "auto", sentencesPerPart: "auto" },
    request
  );

  assert.equal(gated.writingPlan.partCountMode, "auto");
  assert.equal(gated.writingPlan.substanceLevel, "rich_narrative");
  assert.equal(gated.writingPlan.minParts, 1);
  assert.equal(gated.writingPlan.maxParts, 10);
  assert.ok(gated.writingPlan.recommendedParts >= 4);

  const slots = planEightPostAiDecideParts(
    planBatchSlots({
      count: 8,
      ledger: buildRollingLedger(null),
      writingPlan: gated.writingPlan,
      randomSeed: "threadsworks-origin-seed",
    }),
    gated.writingPlan,
    { randomSeed: "threadsworks-origin-seed" }
  );

  assert.equal(slots.length, 8);
  assert.ok(slots.some((s) => (s.targetParts || 0) >= 4), "Rich origin story request must plan multi-part threads");
  const distinctEditorial = new Set(slots.map((s) => s.editorialStructure));
  assert.ok(distinctEditorial.size >= 2, "Slot plan should consider multiple editorial structures");
  const distinctLenses = new Set(slots.map((s) => s.lensId));
  assert.equal(distinctLenses.size, 8, "8-post batch should assign 8 distinct rhetorical lenses");
});

// ---------------------------------------------------------------------------
// Test E: 8-post auto batch evaluates posts individually with zero artificial quotas
// ---------------------------------------------------------------------------
test("Test E: 8-post automatic batch evaluates completeness individually without imposing distribution quotas", async () => {
  // 1. Batch where posts naturally share part counts (e.g. six 3-part threads + two 1-part insights) passes cleanly
  const naturalBatch = [3, 3, 3, 3, 3, 3, 1, 1].map((parts, idx) =>
    makeDraft(parts, `NaturalPost${idx + 1}`)
  );
  const result = await generateValidatedBatch({
    totalCount: 8,
    chunkSize: 4,
    validation: {
      characterLimit: 500,
      minParts: 1,
      maxParts: 10,
      checkInternalRepetition: true,
      enforceGroundedness: true,
    },
    generateChunk: async ({ slotNumbers }) =>
      slotNumbers.map((slot) => naturalBatch[slot - 1]),
    reviewDrafts: async (drafts) =>
      drafts.map((d) => ({ slotNumber: d.slotNumber, passed: true, defects: [] })),
    repairDraft: async () => {
      throw new Error("Valid natural batch should not require repair");
    },
    replaceDraft: async () => {
      throw new Error("Valid natural batch should not require replacement");
    },
  });

  assert.equal(result.status, "complete");
  assert.equal(result.posts.length, 8);
  assert.deepEqual(
    result.posts.map((p) => p.threadParts.length),
    [3, 3, 3, 3, 3, 3, 1, 1]
  );
  // singlePost must be derived deterministically even when omitted by model schema
  assert.ok(result.posts.every((p) => p.singlePost === p.threadParts[0]));

  // 2. Reviewer prompt explicitly enforces Phase 2C completeness without mandatory part-count quotas
  const reviewerPrompt = composeReviewerSystemInstruction();
  assert.ok(reviewerPrompt.includes("delivers its opening promise"));
  assert.ok(reviewerPrompt.includes("A crisp 1-part post is valid when complete"));
  assert.ok(reviewerPrompt.includes("Never fail a draft merely for matching another post's part count"));
  assert.ok(reviewerPrompt.length < 3000);
});

// ---------------------------------------------------------------------------
// Test F: Valid 5-part response stays 5 parts across parse, validate, normalize, persist, render
// ---------------------------------------------------------------------------
test("Test F: Valid 5-part response remains 5 parts end-to-end through parsing, validation, normalization, and persistence", () => {
  const rawFivePart = makeDraft(5, "FivePartIntegrity", true);
  const rawModelJson = JSON.stringify([rawFivePart]);

  // 1. Parse model JSON payload
  const parsed = JSON.parse(rawModelJson);
  assert.ok(Array.isArray(parsed) && parsed.length === 1);
  assert.equal(parsed[0].threadParts.length, 5);

  // 2. Validate single draft (also deterministically derives singlePost = threadParts[0])
  const validated = validateSingleDraft(parsed[0], {
    slotNumber: 1,
    characterLimit: 500,
    minParts: 1,
    maxParts: 10,
    checkInternalRepetition: true,
    enforceGroundedness: true,
  });
  assert.equal(validated.threadParts.length, 5);
  assert.equal(validated.singlePost, validated.threadParts[0]);
  assert.equal(validated.structuralFormat, "thread");

  // 3. Normalize & universal batch validate
  const normalized = normalizeBatchPosts([validated], 1, {
    characterLimit: 500,
    minParts: 1,
    maxParts: 10,
    checkInternalRepetition: true,
  });
  assert.equal(normalized[0].threadParts.length, 5);
  assert.doesNotThrow(() =>
    validateUniversalBatch(normalized, { expectedCount: 1, minParts: 1, maxParts: 10, characterLimit: 500 })
  );

  // 4. Canonical persistence normalization preserves all 5 parts untouched
  const persisted = normalizeCanonicalRecord(
    {
      id: "post_five_part_test",
      title: normalized[0].title,
      hook: normalized[0].hook,
      singlePost: normalized[0].singlePost,
      threadParts: normalized[0].threadParts,
      cta: normalized[0].cta,
      status: "draft",
    },
    "user_test"
  );
  assert.equal(persisted.threadParts.length, 5);
  assert.deepEqual(persisted.threadParts, normalized[0].threadParts);
  assert.equal(persisted.singlePost, normalized[0].threadParts[0]);
});

// ---------------------------------------------------------------------------
// Test G: Current request explicitly asking for 3 parts enforces exact 3-part output
// ---------------------------------------------------------------------------
test("Test G: Current request explicitly asking for 3 parts produces exact 3-part plan and rejects wrong lengths", () => {
  const gated = buildGatedWriteContext(
    {
      writingStyle: "Direct strategist",
      customInstruction: "I publish single posts and threads.",
    },
    { threadLength: "auto", sentencesPerPart: "auto" },
    "Write a 3-part thread about why clear weekly publishing habits beat sporadic bursts."
  );

  assert.equal(gated.writingPlan.partCountMode, "explicit");
  assert.equal(gated.writingPlan.effectiveLengthPolicy, "explicit_request");
  assert.equal(gated.writingPlan.recommendedParts, 3);
  assert.equal(gated.writingPlan.minParts, 3);
  assert.equal(gated.writingPlan.maxParts, 3);
  assert.equal(gated.directives.partCount, 3);

  // Exact 3-part output passes
  const exactThree = makeDraft(3, "ExactThree");
  const validated = validateSingleDraft(exactThree, {
    slotNumber: 1,
    characterLimit: 500,
    partCount: 3,
    checkInternalRepetition: true,
  });
  assert.equal(validated.threadParts.length, 3);

  // 1-part or 4-part output fails clearly with CONTENT_VALIDATION_ERROR
  for (const badCount of [1, 4]) {
    assert.throws(
      () =>
        validateSingleDraft(makeDraft(badCount, `Bad${badCount}`), {
          slotNumber: 1,
          characterLimit: 500,
          partCount: 3,
          checkInternalRepetition: true,
        }),
      (err: unknown) =>
        err instanceof GenerationPipelineError &&
        err.code === "CONTENT_VALIDATION_ERROR" &&
        /Requested thread length was not followed/i.test(err.message)
    );
  }
});

// ---------------------------------------------------------------------------
// Test H: Malformed JSON, incomplete threads, provider failures, partial batch & safe deterministic fixes
// ---------------------------------------------------------------------------
test("Test H: Malformed JSON, incomplete threads, >500-char parts, provider failures, and partial batch failures recover safely without truncation or false success", async () => {
  // H1. Safe deterministic corrections fix harmless metadata/sync issues WITHOUT mutating prose or truncating
  const strayMeta = {
    title: "Clean Post",
    hook: `CleanMeta: ${CLEAN_PARTS_POOL[0]}...`,
    threadParts: [
      `CleanMeta: ${CLEAN_PARTS_POOL[0]}`,
      `CleanMeta: ${CLEAN_PARTS_POOL[1]}`,
      `CleanMeta: ${CLEAN_PARTS_POOL[2]}`,
    ],
    cta: "",
    ctaDecision: "none",
  };
  const corrected = applySafeDeterministicCorrections(strayMeta, { ctaOff: true });
  assert.equal(corrected.candidate.singlePost, strayMeta.threadParts[0]);
  assert.ok(strayMeta.threadParts[0].startsWith(corrected.candidate.hook), "Aligned hook must be an exact prefix of threadParts[0]");
  assert.equal(corrected.candidate.cta, "");
  assert.equal(corrected.candidate.ctaDecision, "omit");
  assert.equal(corrected.candidate.threadParts.length, 3, "Never compress multi-part threads");

  // Genuine CTA-Off violation (non-empty cta / ctaDecision: "include") must NOT be silently erased
  const realCtaViolation = {
    ...makeDraft(2, "RealCtaViolation"),
    cta: "Buy my course now",
    ctaDecision: "include",
  };
  assert.throws(
    () =>
      validateSingleDraft(realCtaViolation, {
        slotNumber: 1,
        characterLimit: 500,
        minParts: 1,
        maxParts: 10,
        ctaOff: true,
      }),
    (err: unknown) => err instanceof GenerationPipelineError && err.code === "CONTENT_VALIDATION_ERROR"
  );

  // H2. Never silently truncate >500-char part (must throw CONTENT_VALIDATION_ERROR for repair)
  const oversized = makeDraft(2, "OversizedPart");
  oversized.threadParts[1] = "X".repeat(520);
  assert.throws(
    () =>
      validateSingleDraft(oversized, {
        slotNumber: 1,
        characterLimit: 500,
        minParts: 1,
        maxParts: 10,
      }),
    (err: unknown) =>
      err instanceof GenerationPipelineError &&
      err.code === "CONTENT_VALIDATION_ERROR" &&
      /exceeds 500 characters/i.test(err.message)
  );

  // H3. Incomplete thread (dangling colon / teaser) triggers targeted single-draft repair while preserving valid siblings
  const validSibling = makeDraft(3, "ValidSibling");
  const incompleteDraft = {
    title: "Incomplete Thread",
    hook: "Here is why weekly habits matter.",
    threadParts: [
      "Here is why weekly habits matter.",
      "Let us break down the exact system:",
    ],
    cta: "",
    ctaDecision: "omit",
  };
  let repairCalls = 0;
  const recoveredChunk = await writeValidatedChunk({
    slotNumbers: [1, 2],
    priorAcceptedDrafts: [],
    validation: {
      characterLimit: 500,
      minParts: 1,
      maxParts: 10,
      checkInternalRepetition: true,
    },
    generateChunk: async () => [validSibling, incompleteDraft],
    reviewDrafts: async (drafts) =>
      drafts.map((d) => ({ slotNumber: d.slotNumber, passed: true, defects: [] })),
    repairDraft: async ({ slotNumber, defects }) => {
      repairCalls++;
      assert.equal(slotNumber, 2, "Only the defective slot should be repaired");
      assert.ok(defects.some((d) => /dangling colon/i.test(d)));
      return makeDraft(3, "RepairedSlot2");
    },
    replaceDraft: async () => {
      throw new Error("Should not replace after successful repair");
    },
  });
  assert.equal(repairCalls, 1);
  assert.equal(recoveredChunk.acceptedDrafts.length, 2);
  assert.equal(recoveredChunk.acceptedDrafts[0].hook, validSibling.hook, "Valid sibling must be preserved untouched");
  assert.equal(recoveredChunk.acceptedDrafts[1].threadParts.length, 3);

  // H4. Malformed JSON retries boundedly and throws PARSE_ERROR (never false success)
  let parseAttempts = 0;
  await assert.rejects(
    () =>
      writeValidatedChunk({
        slotNumbers: [1],
        priorAcceptedDrafts: [],
        validation: { characterLimit: 500, minParts: 1, maxParts: 10 },
        generateChunk: async () => {
          parseAttempts++;
          throw new GenerationPipelineError("PARSE_ERROR", "Malformed JSON");
        },
        reviewDrafts: async () => [],
        repairDraft: async () => ({}),
        replaceDraft: async () => ({}),
        maxMalformedChunkRetries: 1,
      }),
    (err: unknown) => err instanceof GenerationPipelineError && err.code === "PARSE_ERROR"
  );
  assert.equal(parseAttempts, 2, "Malformed JSON retry must stay strictly bounded");

  // H5. Provider error (429) propagates immediately without wasting repair calls
  let providerRepairCalls = 0;
  await assert.rejects(
    () =>
      writeValidatedChunk({
        slotNumbers: [1],
        priorAcceptedDrafts: [],
        validation: { characterLimit: 500, minParts: 1, maxParts: 10 },
        generateChunk: async () => {
          const err: any = new Error("RESOURCE_EXHAUSTED: rate limit exceeded");
          err.status = 429;
          throw err;
        },
        reviewDrafts: async () => [],
        repairDraft: async () => {
          providerRepairCalls++;
          return makeDraft(2, "NeverCalled");
        },
        replaceDraft: async () => makeDraft(2, "NeverCalled"),
      }),
    (err: unknown) => err instanceof GenerationPipelineError && err.code === "PROVIDER_ERROR" && err.httpStatus === 429
  );
  assert.equal(providerRepairCalls, 0);

  // H6. Partial batch failure without allowPartialResults fails clearly instead of returning incomplete batch as success
  await assert.rejects(
    () =>
      generateValidatedBatch({
        totalCount: 2,
        chunkSize: 2,
        allowPartialResults: false,
        validation: { characterLimit: 500, minParts: 1, maxParts: 10, checkInternalRepetition: true },
        generateChunk: async () => [makeDraft(2, "GoodOne"), incompleteDraft],
        reviewDrafts: async (drafts) =>
          drafts.map((d) => ({ slotNumber: d.slotNumber, passed: true, defects: [] })),
        repairDraft: async () => incompleteDraft,
        replaceDraft: async () => incompleteDraft,
      }),
    (err: unknown) =>
      err instanceof GenerationPipelineError &&
      err.code === "CONTENT_VALIDATION_ERROR" &&
      err.validDraftCount === 1 &&
      err.requestedCount === 2
  );
});

// ---------------------------------------------------------------------------
// Phase 3B + Phase 6: Adaptive Chunking Efficiency & Privacy-Safe Diagnostics
// ---------------------------------------------------------------------------
test("Adaptive chunking cuts 8-post auto round trips in half and diagnostics strictly omit sensitive creator data", () => {
  const secretContext = "PRIVATE_CREATOR_SECRET_CONTEXT_DO_NOT_LOG";
  const secretRequest = "PRIVATE_USER_REQUEST_TEXT_DO_NOT_LOG";

  const gated = buildGatedWriteContext(
    { writingStyle: "Sharp founder", customInstruction: secretContext },
    { threadLength: "auto", sentencesPerPart: "auto" },
    secretRequest
  );
  const slotPlan = planBatchSlots({
    count: 8,
    ledger: buildRollingLedger(null),
    writingPlan: gated.writingPlan,
    randomSeed: "diag-seed",
  });

  // Standard 8-post auto batch uses 4 posts/chunk (2 chunks instead of 4 sequential chunks)
  const chunkSize = computeAdaptiveChunkSize(8, gated.writingPlan, slotPlan);
  assert.ok(chunkSize >= 3 && chunkSize <= 4, `Expected chunkSize 3..4 for standard auto batch, got ${chunkSize}`);

  const diag = buildGenerationBatchDiagnostics({
    requestId: "req_test_diag",
    generationMode: "batch",
    writingPlan: gated.writingPlan,
    requestedPostCount: 8,
    acceptedPosts: [makeDraft(3, "A"), makeDraft(5, "B")],
    chunkSize,
    chunkCount: Math.ceil(8 / chunkSize),
    slotPlan,
    modelCallCount: 4,
    repairAttempts: 1,
    replacementAttempts: 0,
    failedSlotCount: 0,
    validationOutcome: "complete",
    totalDurationMs: 1245,
  });

  assert.equal(diag.requestId, "req_test_diag");
  assert.equal(diag.generationMode, "batch");
  assert.equal(diag.effectiveLengthPolicy, "auto_1_to_10");
  assert.equal(diag.writingPlan.profile, "standard");
  assert.equal(diag.requestedPostCount, 8);
  assert.equal(diag.plannedPartCounts.length, 8);
  assert.deepEqual(diag.actualPartCounts, [3, 5]);
  assert.equal(diag.modelCallCount, 4);
  assert.equal(diag.repairAttempts, 1);
  assert.equal(diag.validationOutcome, "complete");
  assert.equal(diag.totalDurationMs, 1245);

  const serialized = JSON.stringify(diag);
  assert.equal(serialized.includes(secretContext), false, "Diagnostics must never contain Creator Context");
  assert.equal(serialized.includes(secretRequest), false, "Diagnostics must never contain contentRequest");
});
