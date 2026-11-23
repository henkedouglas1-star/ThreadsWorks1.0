import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateValidatedBatch,
  writeValidatedChunk,
  checkUnsupportedClaims,
  validateSingleDraft,
  GenerationPipelineError,
  type DraftReviewResult
} from '../server/contentBatchContract.ts';
import { classifyGenerationError } from '../src/utils/errorClassifier.ts';

function makeDraft(slot: number, text?: string, overrides: Record<string, any> = {}) {
  const body = text ?? `Distinct grounded insight for post ${slot}: clarity compounds when each post focuses on one concrete mechanism.`;
  return {
    title: `Insight ${slot}`,
    hook: body,
    singlePost: body,
    threadParts: [body],
    cta: '',
    ctaDecision: 'omit',
    category: 'trust',
    ...overrides
  };
}

test('1. One invalid draft in ten: preserves 9 valid drafts, repairs only Post 8, revalidates, returns exact 10', async () => {
  const repairedSlots: number[] = [];
  const replacedSlots: number[] = [];
  const generatedChunks: number[][] = [];

  const result = await generateValidatedBatch({
    totalCount: 10,
    chunkSize: 2,
    allowPartialResults: false,
    validation: {
      characterLimit: 500,
      sourceTexts: ['Creator teaches practical writing systems for Threads.'],
      ctaOff: true,
      enforceGroundedness: true
    },
    generateChunk: async ({ slotNumbers }) => {
      generatedChunks.push([...slotNumbers]);
      return slotNumbers.map(slot =>
        slot === 8
          ? makeDraft(8, 'A customer DM\'d me yesterday asking how to fix their Threads reach.')
          : makeDraft(slot)
      );
    },
    reviewDrafts: async drafts =>
      drafts.map<DraftReviewResult>(({ slotNumber }) => ({
        slotNumber,
        passed: true,
        defects: []
      })),
    repairDraft: async ({ slotNumber, defects }) => {
      repairedSlots.push(slotNumber);
      assert.equal(slotNumber, 8);
      assert.ok(defects.some(d => /customer interaction/i.test(d)));
      return makeDraft(8, 'Imagine a reader asks why their posts stall after two lines: tighten the opening mechanism first.');
    },
    replaceDraft: async ({ slotNumber }) => {
      replacedSlots.push(slotNumber);
      return makeDraft(slotNumber);
    }
  });

  assert.equal(result.status, 'complete');
  assert.equal(result.posts.length, 10);
  assert.equal(result.acceptedCount, 10);
  assert.equal(result.failedSlots.length, 0);
  assert.deepEqual(repairedSlots, [8]);
  assert.deepEqual(replacedSlots, []);
  // Each of the 5 chunks generated exactly once — valid siblings (including Post 7) were never regenerated
  assert.equal(generatedChunks.length, 5);
  assert.equal(result.stats.initialValidCount, 9);
  assert.equal(result.stats.repairedCount, 1);
  assert.match(result.posts[7].singlePost, /^Imagine a reader asks/);
  // Verify Post 7 remained untouched
  assert.match(result.posts[6].singlePost, /Distinct grounded insight for post 7/);
});

test('2. Multiple invalid drafts (slots 2, 5, 8 in 10): preserves all 7 valid drafts and repairs only failing slots', async () => {
  const repairedSlots: number[] = [];
  const reviewFailuresSeen = new Set<number>();

  const result = await generateValidatedBatch({
    totalCount: 10,
    chunkSize: 2,
    allowPartialResults: false,
    validation: {
      characterLimit: 500,
      sourceTexts: ['Creator shares solo writing habits.'],
      ctaOff: true,
      enforceGroundedness: true
    },
    generateChunk: async ({ slotNumbers }) =>
      slotNumbers.map(slot => {
        if (slot === 2) {
          // Violates CTA Off
          return makeDraft(2, 'Clear thinking beats volume every week.', { cta: 'Buy my course now', ctaDecision: 'include' });
        }
        if (slot === 5) {
          // Violates deterministic groundedness (invented testimonial/metric)
          return makeDraft(5, 'One of my clients doubled their reach and made $12,000 in two weeks.');
        }
        if (slot === 8) {
          // Passes deterministic check, fails semantic review on first pass
          return makeDraft(8, 'When I ran my SaaS agency in 2019, I hired twelve writers to scale.');
        }
        return makeDraft(slot);
      }),
    reviewDrafts: async drafts =>
      drafts.map<DraftReviewResult>(({ slotNumber, draft }) => {
        if (slotNumber === 8 && /SaaS agency in 2019/i.test(draft.singlePost)) {
          reviewFailuresSeen.add(slotNumber);
          return {
            slotNumber,
            passed: false,
            defects: ['Post 8 invents personal history ("ran my SaaS agency in 2019") not in supplied facts.']
          };
        }
        return { slotNumber, passed: true, defects: [] };
      }),
    repairDraft: async ({ slotNumber, defects }) => {
      repairedSlots.push(slotNumber);
      assert.ok(defects.length > 0);
      return makeDraft(slotNumber, `Repaired grounded insight for post ${slotNumber}: focus on one testable writing habit per day.`);
    },
    replaceDraft: async () => {
      throw new Error('replaceDraft should not be called when repair succeeds');
    }
  });

  assert.equal(result.status, 'complete');
  assert.equal(result.posts.length, 10);
  assert.deepEqual(repairedSlots, [2, 5, 8]);
  assert.ok(reviewFailuresSeen.has(8));
  assert.equal(result.stats.initialValidCount, 7);
  assert.equal(result.stats.repairedCount, 3);
  assert.equal(result.stats.replacedCount, 0);
  // Check untouched valid posts still hold original content
  assert.match(result.posts[0].singlePost, /Distinct grounded insight for post 1/);
  assert.match(result.posts[5].singlePost, /Distinct grounded insight for post 6/);
  assert.match(result.posts[9].singlePost, /Distinct grounded insight for post 10/);
});

test('3. Failed repair triggers fresh replacement and revalidates replacement; never accepts failed repair', async () => {
  let repairCalls = 0;
  let replaceCalls = 0;
  const reviewedSlot8Texts: string[] = [];

  const result = await generateValidatedBatch({
    totalCount: 4,
    chunkSize: 2,
    allowPartialResults: false,
    validation: {
      characterLimit: 500,
      sourceTexts: ['Creator builds tools for writing on Threads.'],
      enforceGroundedness: true
    },
    generateChunk: async ({ slotNumbers }) =>
      slotNumbers.map(slot =>
        slot === 4
          ? makeDraft(4, 'Yesterday a customer emailed me begging for this workflow.')
          : makeDraft(slot)
      ),
    reviewDrafts: async drafts =>
      drafts.map<DraftReviewResult>(({ slotNumber, draft }) => {
        if (slotNumber === 4) reviewedSlot8Texts.push(draft.singlePost);
        if (slotNumber === 4 && /still ungrounded/i.test(draft.singlePost)) {
          return {
            slotNumber,
            passed: false,
            defects: ['Post 4 still invents customer interactions during repair.']
          };
        }
        return { slotNumber, passed: true, defects: [] };
      }),
    repairDraft: async ({ slotNumber }) => {
      repairCalls++;
      // Repair fails semantic review
      return makeDraft(slotNumber, 'Draft still ungrounded because it claims unnamed beta users approved the roadmap.');
    },
    replaceDraft: async ({ slotNumber, defects }) => {
      replaceCalls++;
      assert.ok(defects.some(d => /still invents customer interactions/i.test(d)));
      return makeDraft(slotNumber, 'Replacement post 4: writing one sharp observation beats publishing five vague summaries.');
    }
  });

  assert.equal(result.status, 'complete');
  assert.equal(result.posts.length, 4);
  assert.equal(repairCalls, 1);
  assert.equal(replaceCalls, 1);
  assert.equal(result.stats.initialValidCount, 3);
  assert.equal(result.stats.repairedCount, 0);
  assert.equal(result.stats.replacedCount, 1);
  assert.equal(result.posts[3].singlePost, 'Replacement post 4: writing one sharp observation beats publishing five vague summaries.');
  assert.equal(reviewedSlot8Texts.length, 2); // Both repair attempt and replacement were revalidated!
});

test('4A. Malformed JSON output (PARSE_ERROR) retries once and fails cleanly with PARSE_ERROR if persistent', async () => {
  let attempts = 0;

  await assert.rejects(
    generateValidatedBatch({
      totalCount: 2,
      chunkSize: 2,
      allowPartialResults: false,
      validation: { characterLimit: 500 },
      generateChunk: async () => {
        attempts++;
        throw new GenerationPipelineError('PARSE_ERROR', 'Batch writer returned malformed JSON: Unexpected token');
      },
      reviewDrafts: async () => [],
      repairDraft: async () => makeDraft(1),
      replaceDraft: async () => makeDraft(1)
    }),
    (err: any) => {
      assert.ok(err instanceof GenerationPipelineError);
      assert.equal(err.code, 'PARSE_ERROR');
      assert.equal(err.httpStatus, 502);
      return true;
    }
  );
  assert.equal(attempts, 2); // Initial attempt + 1 bounded malformed retry
});

test('4B. Wrong output schema (SCHEMA_ERROR) is distinguished from PARSE_ERROR and CONTENT_VALIDATION_ERROR', async () => {
  let attempts = 0;

  await assert.rejects(
    generateValidatedBatch({
      totalCount: 2,
      chunkSize: 2,
      allowPartialResults: false,
      validation: { characterLimit: 500 },
      generateChunk: async () => {
        attempts++;
        return { notAnArray: true };
      },
      reviewDrafts: async () => [],
      repairDraft: async () => makeDraft(1),
      replaceDraft: async () => makeDraft(1)
    }),
    (err: any) => {
      assert.ok(err instanceof GenerationPipelineError);
      assert.equal(err.code, 'SCHEMA_ERROR');
      assert.equal(err.httpStatus, 502);
      return true;
    }
  );
  assert.equal(attempts, 2);
});

test('4C. Mixed chunk with one valid draft and one malformed draft preserves valid draft and replaces malformed slot', async () => {
  const result = await writeValidatedChunk({
    slotNumbers: [1, 2],
    priorAcceptedDrafts: [],
    validation: { characterLimit: 500 },
    generateChunk: async () => [makeDraft(1), { title: 'Broken', hook: '', threadParts: [] }],
    reviewDrafts: async drafts => drafts.map(({ slotNumber }) => ({ slotNumber, passed: true, defects: [] })),
    repairDraft: async () => ({ brokenAgain: true }),
    replaceDraft: async ({ slotNumber }) => makeDraft(slotNumber, 'Recovered replacement draft for slot 2 with complete structure.')
  });

  assert.equal(result.acceptedDrafts.length, 2);
  assert.equal(result.failedSlots.length, 0);
  assert.equal(result.stats.initialValidCount, 1);
  assert.equal(result.stats.replacedCount, 1);
  assert.match(result.acceptedDrafts[0].singlePost, /Distinct grounded insight for post 1/);
  assert.match(result.acceptedDrafts[1].singlePost, /Recovered replacement draft for slot 2/);
});

test('4D. Editorial review omitting a draft slot never allows unreviewed draft through', async () => {
  await assert.rejects(
    writeValidatedChunk({
      slotNumbers: [1, 2],
      priorAcceptedDrafts: [],
      validation: { characterLimit: 500 },
      generateChunk: async () => [makeDraft(1), makeDraft(2)],
      // Omits slot 2 on every review attempt
      reviewDrafts: async () => [{ slotNumber: 1, passed: true, defects: [] }],
      repairDraft: async () => makeDraft(2),
      replaceDraft: async () => makeDraft(2)
    }),
    (err: any) => {
      assert.ok(err instanceof GenerationPipelineError);
      assert.equal(err.code, 'SCHEMA_ERROR');
      assert.match(err.message, /omitted required evaluation for slot\(s\): 2/);
      return true;
    }
  );
});

test('5. Unsupported claims are rejected (invented customers, support tickets, testimonials, metrics)', () => {
  const source = ['I build a writing workspace for Threads creators. Planned roadmap includes analytics.'];

  const customerDm = checkUnsupportedClaims('A customer DM\'d me yesterday saying they loved the workflow.', source);
  assert.ok(customerDm.length > 0, 'Should flag invented customer DM');

  const supportTickets = checkUnsupportedClaims('We got 14 support tickets this week about hooks.', source);
  assert.ok(supportTickets.length > 0, 'Should flag invented support tickets');

  const testimonial = checkUnsupportedClaims('One of my clients doubled their engagement in a week.', source);
  assert.ok(testimonial.length > 0, 'Should flag invented testimonial');

  const metric = checkUnsupportedClaims('This structure boosted engagement by 340% across accounts.', source);
  assert.ok(metric.length > 0, 'Should flag unsupported percentage metric');

  const revenue = checkUnsupportedClaims('Creators using this system earned $15,000 in 30 days.', source);
  assert.ok(revenue.length > 0, 'Should flag unsupported revenue claim');

  // validateSingleDraft with enforceGroundedness rejects with CONTENT_VALIDATION_ERROR
  assert.throws(
    () =>
      validateSingleDraft(makeDraft(8, 'A customer emailed me saying they grew 5,000 followers overnight.'), {
        slotNumber: 8,
        characterLimit: 500,
        sourceTexts: source,
        enforceGroundedness: true
      }),
    (err: any) => err instanceof GenerationPipelineError && err.code === 'CONTENT_VALIDATION_ERROR'
  );
});

test('6. Legitimate hypotheticals, user-provided facts, planned features, and persuasive content are allowed', () => {
  const source = [
    'I work at Peet\'s Coffee and build ThreadsWorks on my breaks.',
    'A customer DM\'d me about scheduling last month, and our test group improved completion by 40%.'
  ];

  // Explicit hypothetical scenarios (including multi-sentence continuation)
  assert.deepEqual(
    checkUnsupportedClaims(
      'Imagine a customer DMs you asking how your tool saves time. Suppose you can explain it in two clear sentences.',
      ['I build a writing workspace.']
    ),
    []
  );
  assert.deepEqual(
    checkUnsupportedClaims(
      'For example, say 20% of readers click your profile after reading a clear breakdown.',
      ['I build a writing workspace.']
    ),
    []
  );
  assert.deepEqual(
    checkUnsupportedClaims(
      'Imagine a solo founder launching a product. A customer DMs them asking for a feature they have not built yet.',
      ['I build a writing workspace.']
    ),
    []
  );

  // User-provided facts present in source
  assert.deepEqual(
    checkUnsupportedClaims(
      'A customer DM\'d me about scheduling last month, which showed why reliable queues matter.',
      source
    ),
    []
  );
  assert.deepEqual(
    checkUnsupportedClaims(
      'Simplifying the workflow improved completion by 40% in our test group.',
      source
    ),
    []
  );

  // Planned features framed honestly + legitimate persuasive content
  assert.deepEqual(
    checkUnsupportedClaims(
      'We are building deeper analytics on our upcoming roadmap. Right now, clear writing mechanisms create consistent audience momentum in 15 minutes a day.',
      ['I build a writing workspace.']
    ),
    []
  );
});

test('7. Exact counts enforced when partial results disabled; valid partial results returned when explicitly enabled', async () => {
  const makeOptions = (allowPartialResults: boolean) => ({
    totalCount: 10,
    chunkSize: 2,
    allowPartialResults,
    validation: {
      characterLimit: 500,
      sourceTexts: ['Creator shares Threads writing advice.'],
      enforceGroundedness: true
    },
    generateChunk: async ({ slotNumbers }: { slotNumbers: number[] }) =>
      slotNumbers.map(slot =>
        slot === 8
          ? makeDraft(8, 'A customer DM\'d me yesterday about this.')
          : makeDraft(slot)
      ),
    reviewDrafts: async (drafts: Array<{ slotNumber: number; draft: any }>) =>
      drafts.map<DraftReviewResult>(({ slotNumber }) => ({ slotNumber, passed: true, defects: [] })),
    // Both repair and replacement fail for slot 8
    repairDraft: async () => makeDraft(8, 'Our support team told me 92% of users struggle with this.'),
    replaceDraft: async () => makeDraft(8, 'One of my clients made $25,000 using this hack.')
  });

  // Strict exact count mode: fails with CONTENT_VALIDATION_ERROR instead of returning 9 or padding a 10th
  await assert.rejects(
    generateValidatedBatch(makeOptions(false)),
    (err: any) => {
      assert.ok(err instanceof GenerationPipelineError);
      assert.equal(err.code, 'CONTENT_VALIDATION_ERROR');
      assert.equal(err.httpStatus, 422);
      assert.equal(err.failedDrafts?.[0]?.slotNumber, 8);
      return true;
    }
  );

  // Partial results mode (explicitly supported by UI): preserves all 9 validated drafts and excludes unvalidated Post 8
  const partialResult = await generateValidatedBatch(makeOptions(true));
  assert.equal(partialResult.status, 'partial');
  assert.equal(partialResult.posts.length, 9);
  assert.equal(partialResult.acceptedCount, 9);
  assert.equal(partialResult.requestedCount, 10);
  assert.equal(partialResult.failedSlots.length, 1);
  assert.equal(partialResult.failedSlots[0].slotNumber, 8);
  assert.equal(partialResult.failedSlots[0].errorCode, 'CONTENT_VALIDATION_ERROR');
  // Confirm zero unvalidated drafts slipped through
  for (const draft of partialResult.posts) {
    assert.deepEqual(checkUnsupportedClaims(draft.singlePost, ['Creator shares Threads writing advice.']), []);
  }
});

test('8A. Complete failure throws typed CONTENT_VALIDATION_ERROR even when allowPartialResults is true', async () => {
  await assert.rejects(
    generateValidatedBatch({
      totalCount: 4,
      chunkSize: 2,
      allowPartialResults: true,
      validation: {
        characterLimit: 500,
        sourceTexts: ['Creator writes about productivity.'],
        enforceGroundedness: true
      },
      generateChunk: async ({ slotNumbers }) =>
        slotNumbers.map(slot => makeDraft(slot, `A customer DM'd me about post ${slot} and made $10,000.`)),
      reviewDrafts: async drafts => drafts.map(({ slotNumber }) => ({ slotNumber, passed: true, defects: [] })),
      repairDraft: async ({ slotNumber }) => makeDraft(slotNumber, `We got 50 support tickets about post ${slotNumber}.`),
      replaceDraft: async ({ slotNumber }) => makeDraft(slotNumber, `One of my clients doubled revenue with post ${slotNumber}.`)
    }),
    (err: any) => {
      assert.ok(err instanceof GenerationPipelineError);
      assert.equal(err.code, 'CONTENT_VALIDATION_ERROR');
      assert.equal(err.validDraftCount, 0);
      assert.equal(err.requestedCount, 4);
      assert.equal(err.failedDrafts?.length, 4);
      return true;
    }
  );
});

test('8B. Provider and network errors propagate immediately without writing/repair retries', async () => {
  let repairCalls = 0;
  let replaceCalls = 0;

  await assert.rejects(
    generateValidatedBatch({
      totalCount: 4,
      chunkSize: 2,
      allowPartialResults: true,
      validation: { characterLimit: 500 },
      generateChunk: async () => {
        throw new Error('429 RESOURCE_EXHAUSTED: Gemini rate limit exceeded');
      },
      reviewDrafts: async () => [],
      repairDraft: async () => {
        repairCalls++;
        return makeDraft(1);
      },
      replaceDraft: async () => {
        replaceCalls++;
        return makeDraft(1);
      }
    }),
    (err: any) => {
      assert.ok(err instanceof GenerationPipelineError);
      assert.equal(err.code, 'PROVIDER_ERROR');
      assert.equal(err.httpStatus, 429);
      return true;
    }
  );

  await assert.rejects(
    generateValidatedBatch({
      totalCount: 4,
      chunkSize: 2,
      allowPartialResults: true,
      validation: { characterLimit: 500 },
      generateChunk: async () => {
        throw new Error('fetch failed: ECONNRESET');
      },
      reviewDrafts: async () => [],
      repairDraft: async () => {
        repairCalls++;
        return makeDraft(1);
      },
      replaceDraft: async () => {
        replaceCalls++;
        return makeDraft(1);
      }
    }),
    (err: any) => {
      assert.ok(err instanceof GenerationPipelineError);
      assert.equal(err.code, 'NETWORK_ERROR');
      assert.equal(err.httpStatus, 502);
      return true;
    }
  );

  assert.equal(repairCalls, 0);
  assert.equal(replaceCalls, 0);
});

test('9. Frontend error classifier separates content validation, schema, parse, provider, Firestore, and network errors', () => {
  // Exact reported error — MUST NOT say "The AI output did not match the expected Threads draft format."
  const reportedErr = classifyGenerationError(
    new Error('Content could not pass validation after one revision: Post 8 invents customer interactions'),
    { httpStatus: 500, stage: 'network_request' }
  );
  assert.equal(reportedErr.category, 'Content validation');
  assert.equal(reportedErr.title, 'Draft Quality Check Failed');
  assert.notEqual(reportedErr.userMessage, 'The AI output did not match the expected Threads draft format. Please try again.');

  // Structured CONTENT_VALIDATION_ERROR from upgraded backend
  const structuredContentErr = classifyGenerationError(
    new Error('Only 9 of 10 drafts passed validation: Post 8: invents customer interactions'),
    { httpStatus: 422, errorCode: 'CONTENT_VALIDATION_ERROR', stage: 'network_request' }
  );
  assert.equal(structuredContentErr.category, 'Content validation');
  assert.equal(structuredContentErr.isRetryable, true);

  // Structured SCHEMA_ERROR -> Draft Format Mismatch
  const schemaErr = classifyGenerationError(
    new Error('Expected a JSON array of 2 Threads drafts, but received object.'),
    { httpStatus: 502, errorCode: 'SCHEMA_ERROR', stage: 'network_request' }
  );
  assert.equal(schemaErr.category, 'Validation');
  assert.equal(schemaErr.title, 'Draft Format Mismatch');
  assert.match(schemaErr.userMessage, /expected Threads draft format/);

  // Structured PARSE_ERROR -> Response parsing
  const parseErr = classifyGenerationError(
    new Error('Batch writer returned malformed JSON: Unexpected end of JSON input'),
    { httpStatus: 502, errorCode: 'PARSE_ERROR', stage: 'network_request' }
  );
  assert.equal(parseErr.category, 'Response parsing');
  assert.equal(parseErr.title, 'Malformed AI Response');

  // Structured PROVIDER_ERROR (429 Gemini rate limit) -> NOT mislabeled as Firestore quota!
  const providerRateErr = classifyGenerationError(
    new Error('429 RESOURCE_EXHAUSTED: Gemini rate limit exceeded'),
    { httpStatus: 429, errorCode: 'PROVIDER_ERROR', stage: 'network_request' }
  );
  assert.equal(providerRateErr.category, 'Rate limit');
  assert.equal(providerRateErr.title, 'AI Provider Rate Limit Reached');
  assert.equal(providerRateErr.isRetryable, true);

  // Genuine Firestore quota error stays clearly labeled
  const firestoreErr = classifyGenerationError(
    new Error('gRPC status 8 RESOURCE_EXHAUSTED on Cloud Firestore read'),
    { httpStatus: 429, stage: 'network_request' }
  );
  assert.equal(firestoreErr.title, 'Firestore Read Quota Error');

  // Structured NETWORK_ERROR timeout
  const timeoutErr = classifyGenerationError(
    new Error('Generation did not complete in time. Please retry with fewer posts.'),
    { httpStatus: 504, errorCode: 'NETWORK_ERROR', stage: 'network_request' }
  );
  assert.equal(timeoutErr.category, 'Timeout');
});
