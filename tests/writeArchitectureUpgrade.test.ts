import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  stripSyntheticDefault,
  classifyBusinessRelevance,
  buildGatedWriteContext
} from '../server/writeContextGate.ts';
import {
  RHETORICAL_LENSES,
  buildRollingLedger,
  planBatchSlots,
  checkDraftNovelty,
  detectFormulaicOpener,
  buildCompactExclusionSummary
} from '../server/writeDiversityEngine.ts';
import {
  composeBatchWriterSystemInstruction,
  composeReviewerSystemInstruction,
  composeSingleWriteSystemInstruction
} from '../server/writePromptComposer.ts';
import {
  validateSingleDraft,
  checkUnsupportedClaims,
  executeValidatedSingleWrite,
  GenerationPipelineError
} from '../server/contentBatchContract.ts';

// ---------------------------------------------------------------------------
// 1. Context Gatekeeper (writeContextGate.ts)
// ---------------------------------------------------------------------------

test('writeContextGate: strips synthetic placeholder defaults cleanly', () => {
  assert.equal(stripSyntheticDefault('a high-value product or service'), '');
  assert.equal(stripSyntheticDefault('custom training frameworks'), '');
  assert.equal(stripSyntheticDefault('ambitious learners'), '');
  assert.equal(stripSyntheticDefault('streamlined execution'), '');
  assert.equal(stripSyntheticDefault('desired outcome'), '');
  assert.equal(stripSyntheticDefault('ThreadsWorks Pro'), 'ThreadsWorks Pro');
});

test('writeContextGate: omits business positioning on off-niche prompt while preserving creator voice', () => {
  const gated = buildGatedWriteContext(
    {
      writingStyle: 'dry humor, concise sentences, observational',
      rawVoice: 'I write short field notes with concrete sensory details.',
      creatorIdentity: { role: 'Indie founder', wordsYouAvoid: 'synergy, delve' },
      offer: 'B2B Revenue Automation Suite',
      rawBusinessText: 'We sell enterprise CRM workflow automation to SaaS VPs of Sales.',
      audience: 'SaaS VPs of Sales',
      desiredResult: 'shorter enterprise sales cycles'
    },
    {
      category: 'attention',
      ctaPreferences: 'AI Decide'
    },
    'Explain why sourdough fermentation slows down in winter kitchens'
  );

  assert.equal(gated.businessRelevance, 'omit');
  assert.deepEqual(gated.gatedBusiness, {});
  assert.equal(gated.factsPayload.offer, undefined);
  assert.equal(gated.factsPayload.rawBusinessText, undefined);
  assert.equal(gated.voice.writingStyle, 'dry humor, concise sentences, observational');
  assert.equal(gated.voice.rawVoice, 'I write short field notes with concrete sensory details.');
  assert.equal(gated.voice.wordsToAvoid, 'synergy, delve');
  assert.equal(gated.factsPayload.writingStyle, 'dry humor, concise sentences, observational');
});

test('writeContextGate: applies light_lens on single-term overlap and include_full on direct offer or sales category', () => {
  const business = {
    offer: 'Newsletter Growth Accelerator',
    rawBusinessText: 'Coaching solo writers to monetize paid newsletters.',
    audience: 'independent newsletter writers',
    desiredResult: 'predictable recurring subscriber revenue',
    offerInformation: {},
    audienceInformation: {}
  };

  const light = classifyBusinessRelevance({
    contentRequest: 'Why consistency matters for busy writers',
    business,
    category: 'trust',
    ctaOff: false
  });
  assert.equal(light.level, 'light_lens');

  const direct = classifyBusinessRelevance({
    contentRequest: 'How Newsletter Growth Accelerator helps build subscriber retention',
    business,
    category: 'trust',
    ctaOff: false
  });
  assert.equal(direct.level, 'include_full');

  const sales = classifyBusinessRelevance({
    contentRequest: 'A quick reflection on morning routines',
    business,
    category: 'sales',
    ctaOff: false
  });
  assert.equal(sales.level, 'include_full');
});

test('writeContextGate: strips legacy customInstruction when identical to rawBusinessText', () => {
  const bizText = 'We build enterprise dental scheduling software for multi-location practices.';
  const gated = buildGatedWriteContext(
    {
      rawBusinessText: bizText,
      customInstruction: bizText,
      writingStyle: 'plainspoken and analytical'
    },
    { category: 'attention' },
    'Why good coffee grinders matter more than espresso machines'
  );

  assert.equal(gated.businessRelevance, 'omit');
  assert.equal(gated.directives.customInstruction, '');
  assert.equal(gated.factsPayload.creatorContext, undefined);
  assert.equal(gated.voice.writingStyle, 'plainspoken and analytical');
});

// ---------------------------------------------------------------------------
// 2. Diversity & Anti-Repetition Engine (writeDiversityEngine.ts)
// ---------------------------------------------------------------------------

test('writeDiversityEngine: hydrates rolling ledger and rotates 8 rhetorical lenses deprioritizing recent lenses', () => {
  const ledger = buildRollingLedger(
    {
      recentAngleLedger: [
        {
          lens: 'observation',
          title: 'Quiet coffee shop focus',
          hook: 'A noisy cafe makes your thinking sharper than silence.',
          hookPrefix: 'a noisy cafe makes',
          thesisSummary: 'Ambient sound lowers self-editing friction.',
          closingSkeleton: 'try working somewhere mildly busy tomorrow'
        }
      ],
      recentHooks: ['Speed beats polish when testing a brand new format.']
    },
    [
      {
        title: 'Shipping daily drafts',
        hook: 'Publishing rough notes trains your taste faster than outlining.',
        singlePost: 'Publishing rough notes trains your taste faster than outlining. Feedback arrives in hours instead of months.',
        strategicAngle: 'tradeoff'
      }
    ]
  );

  assert.equal(ledger.entries.length, 3);
  assert.ok(ledger.recentLenses.includes('observation'));
  assert.ok(ledger.recentLenses.includes('tradeoff'));

  const slots = planBatchSlots({ count: 8, ledger });
  assert.equal(slots.length, 8);
  const uniqueLensIds = new Set(slots.map(s => s.lensId));
  assert.equal(uniqueLensIds.size, RHETORICAL_LENSES.length);
  // Recently used lenses ('observation', 'tradeoff') must be pushed to the back of the rotation
  assert.notEqual(slots[0].lensId, 'observation');
  assert.notEqual(slots[0].lensId, 'tradeoff');
  assert.notEqual(slots[1].lensId, 'observation');
  assert.notEqual(slots[1].lensId, 'tradeoff');
});

test('writeDiversityEngine: rejects opening prefix, paraphrased hook, body recycling, closing clone, formulaic repeat, and library duplicate', () => {
  const basePost = {
    title: 'Clear briefs save time',
    hook: 'Writing a crisp three-line brief saves two hours of messy revisions.',
    threadParts: [
      'Writing a crisp three-line brief saves two hours of messy revisions. When the objective stays blurry, every draft drifts off course and wastes energy. Define the single takeaway before opening your editor.'
    ]
  };

  // (a) Repeated 4-word opening prefix
  const prefixClone = checkDraftNovelty(
    {
      hook: 'Writing a crisp three-line outline prevents endless back-and-forth meetings.',
      threadParts: ['Writing a crisp three-line outline prevents endless back-and-forth meetings. Align stakeholders early.']
    },
    { slotNumber: 2, acceptedDrafts: [basePost] }
  );
  assert.equal(prefixClone.passed, false);
  assert.match(prefixClone.defects[0], /opening phrase/i);

  // (b) Paraphrased hook (>= 58% lexical Jaccard)
  const hookClone = checkDraftNovelty(
    {
      hook: 'A crisp three-line brief saves hours of messy revisions every week.',
      threadParts: ['A crisp three-line brief saves hours of messy revisions every week. Keep your specs short.']
    },
    { slotNumber: 2, acceptedDrafts: [basePost] }
  );
  assert.equal(hookClone.passed, false);
  assert.match(hookClone.defects[0], /paraphrases/i);

  // (c) Recycled body phrasing
  const bodyClone = checkDraftNovelty(
    {
      hook: 'Skip vague brainstorming sessions completely.',
      threadParts: [
        'Skip vague brainstorming sessions completely. When the objective stays blurry, every draft drifts off course and wastes energy while messy revisions pile up.'
      ]
    },
    { slotNumber: 2, acceptedDrafts: [basePost] }
  );
  assert.equal(bodyClone.passed, false);
  assert.match(bodyClone.defects[0], /recycles phrasing/i);

  // (d) Duplicate closing sentence skeleton
  const closingClone = checkDraftNovelty(
    {
      hook: 'Editors cut fluff faster when they read aloud.',
      threadParts: [
        'Editors cut fluff faster when they read aloud. Your ear catches clunky phrasing instantly. Define the single takeaway before opening your editor.'
      ]
    },
    { slotNumber: 2, acceptedDrafts: [basePost] }
  );
  assert.equal(closingClone.passed, false);
  assert.match(closingClone.defects[0], /closing sentence/i);

  // (e) Repeated formulaic opener in the same batch
  assert.ok(detectFormulaicOpener('Most creators overcomplicate their morning workflow.'));
  const formulaicFirst = {
    hook: 'Most creators overcomplicate their morning workflow.',
    threadParts: ['Most creators overcomplicate their morning workflow. Keep a single scratchpad beside your keyboard.']
  };
  const formulaicSecond = checkDraftNovelty(
    {
      hook: "Here's the uncomfortable truth about batch scheduling tools.",
      threadParts: ["Here's the uncomfortable truth about batch scheduling tools. Calendars never fix bland ideas."]
    },
    { slotNumber: 2, acceptedDrafts: [formulaicFirst] }
  );
  assert.equal(formulaicSecond.passed, false);
  assert.match(formulaicSecond.defects[0], /formulaic opener/i);

  // (f) Cross-run duplicate from recentLibraryPosts
  const ledger = buildRollingLedger(null, [basePost]);
  const crossRunDup = checkDraftNovelty(
    {
      hook: 'Writing a crisp three-line brief saves two hours of messy revisions.',
      threadParts: ['Writing a crisp three-line brief saves two hours of messy revisions. Start with constraints first.']
    },
    { slotNumber: 1, acceptedDrafts: [], ledger }
  );
  assert.equal(crossRunDup.passed, false);
  assert.match(crossRunDup.defects[0], /content history|library/i);

  // (g) Distinct rhetorical lens on the SAME topic MUST PASS
  const distinctAngle = checkDraftNovelty(
    {
      title: 'Tradeoff between speed and depth',
      hook: 'Tight deadlines expose whether you understand the problem or only the jargon.',
      threadParts: [
        'Tight deadlines expose whether you understand the problem or only the jargon. Give yourself twenty minutes to sketch the core constraint on paper before touching slides.'
      ]
    },
    {
      slotNumber: 2,
      acceptedDrafts: [basePost],
      topicText: 'writing better project briefs'
    }
  );
  assert.equal(distinctAngle.passed, true);
  assert.equal(distinctAngle.defects.length, 0);

  // Verify compact exclusion summary stays O(N) without full thread dumps
  const summary = buildCompactExclusionSummary([basePost], ledger);
  assert.equal(summary.currentBatchPrior.length, 1);
  assert.ok(summary.currentBatchPrior[0].thesisSummary.length <= 140);
});

// ---------------------------------------------------------------------------
// 3. Compact Prompt Composer (writePromptComposer.ts)
// ---------------------------------------------------------------------------

test('writePromptComposer: keeps prompts compact, contradiction-free, and enforces omit/CTA-Off contracts', () => {
  const gatedOmit = buildGatedWriteContext(
    {
      writingStyle: 'conversational, direct',
      offer: 'Enterprise ERP Consulting'
    },
    {
      category: 'attention',
      ctaPreferences: 'Off - Do NOT include any CTA, link, or keyword prompt.'
    },
    'Why walking without headphones improves creative recall'
  );

  const batchPrompt = composeBatchWriterSystemInstruction(gatedOmit);
  assert.ok(batchPrompt.length < 4500, `Expected compact batch prompt (<4500 chars), got ${batchPrompt.length}`);
  assert.ok(batchPrompt.includes('Do not invent anecdotes to add specificity.'));
  assert.ok(batchPrompt.includes('Business context is omitted'));
  assert.ok(batchPrompt.includes('CTA is OFF'));
  assert.equal(batchPrompt.includes('CONTENT_GENERATOR_RULEBOOK'), false);
  assert.equal(batchPrompt.includes('all 92-99'), false);

  const reviewerPrompt = composeReviewerSystemInstruction();
  assert.ok(reviewerPrompt.length < 3000);
  assert.ok(reviewerPrompt.includes('hypothetical examples'));

  const singlePrompt = composeSingleWriteSystemInstruction('OPTIMIZE_POST', gatedOmit);
  assert.ok(singlePrompt.length < 3500);
  assert.ok(singlePrompt.includes('do not inflate every score to 92-99'));
});

// ---------------------------------------------------------------------------
// 4. Unified Validation & Groundedness Refinements (contentBatchContract.ts)
// ---------------------------------------------------------------------------

test('contentBatchContract: allows benign $0 and rhetorical 100% while still blocking fabricated metrics & customer interactions', () => {
  // Benign $0 and standalone rhetorical 100% pass without source text
  assert.deepEqual(
    checkUnsupportedClaims('You can start a habit tracker for $0 and stay 100% focused on one daily metric.', []),
    []
  );

  // Fabricated dollar figures, percentages, and customer interactions are still caught
  const metricDefects = checkUnsupportedClaims('This workflow generated $15,000 in 30 days and boosted clicks by 340%.', []);
  assert.ok(metricDefects.length > 0);

  const statDefects = checkUnsupportedClaims('92% of users abandon drafts before hitting publish.', []);
  assert.ok(statDefects.length > 0);

  const customerDefects = checkUnsupportedClaims('A client DMd me yesterday asking how to fix their funnel.', []);
  assert.ok(customerDefects.length > 0);
});

test('contentBatchContract: validateSingleDraft enforces deterministic novelty when enabled', () => {
  const accepted = [
    {
      title: 'Morning notes',
      hook: 'Writing before checking notifications keeps your attention intact.',
      singlePost: 'Writing before checking notifications keeps your attention intact. One quiet half-hour beats three fragmented afternoons.',
      threadParts: [
        'Writing before checking notifications keeps your attention intact. One quiet half-hour beats three fragmented afternoons.'
      ],
      cta: '',
      ctaDecision: 'omit'
    }
  ];

  assert.throws(
    () =>
      validateSingleDraft(
        {
          title: 'Morning notes copy',
          hook: 'Writing before checking notifications protects your focus all day.',
          threadParts: [
            'Writing before checking notifications protects your focus all day. One quiet half-hour beats three fragmented afternoons.'
          ],
          cta: ''
        },
        {
          slotNumber: 2,
          characterLimit: 500,
          enforceNovelty: true,
          acceptedDrafts: accepted
        }
      ),
    /opening phrase|recycles phrasing|paraphrases/i
  );
});

test('contentBatchContract: executeValidatedSingleWrite repairs invalid drafts and replaces when repair fails', async () => {
  let repairs = 0;
  let replacements = 0;

  // Scenario A: initial draft invents a customer interaction -> targeted repair succeeds
  const repaired = await executeValidatedSingleWrite({
    validation: { characterLimit: 500, sourceTexts: ['Focus on daily writing habits.'] },
    generateDraft: async () => ({
      title: 'Habit note',
      hook: 'A client DMd me yesterday about daily writing.',
      threadParts: ['A client DMd me yesterday about daily writing. Consistency compounds over time.'],
      cta: ''
    }),
    repairDraft: async ({ defects }) => {
      repairs++;
      assert.ok(defects.some(d => /customer|interaction|invented|unsupported/i.test(d)));
      return {
        title: 'Habit note',
        hook: 'Showing up for fifteen minutes builds writing momentum faster than weekend marathons.',
        threadParts: ['Showing up for fifteen minutes builds writing momentum faster than weekend marathons. Small reps remove resistance.'],
        cta: ''
      };
    },
    replaceDraft: async () => {
      replacements++;
      throw new Error('Should not reach replacement when repair succeeds');
    }
  });

  assert.equal(repairs, 1);
  assert.equal(replacements, 0);
  assert.match(repaired.singlePost, /fifteen minutes/);

  // Scenario B: initial draft + repair both fail -> fresh replacement succeeds
  let bRepairs = 0;
  let bReplacements = 0;
  const replaced = await executeValidatedSingleWrite({
    validation: { characterLimit: 500, sourceTexts: [] },
    generateDraft: async () => ({
      title: 'Bad',
      hook: 'Principle #1: Too long',
      threadParts: ['Principle #1: Too long'],
      cta: ''
    }),
    repairDraft: async () => {
      bRepairs++;
      return {
        title: 'Still bad',
        hook: 'Clients constantly tell me this saves $50,000.',
        threadParts: ['Clients constantly tell me this saves $50,000.'],
        cta: ''
      };
    },
    replaceDraft: async () => {
      bReplacements++;
      return {
        title: 'Fresh replacement',
        hook: 'Clear constraints make daily publishing lighter.',
        threadParts: ['Clear constraints make daily publishing lighter. Pick one format and repeat it for a week.'],
        cta: ''
      };
    }
  });

  assert.equal(bRepairs, 1);
  assert.equal(bReplacements, 1);
  assert.match(replaced.singlePost, /Clear constraints/);

  // Scenario C: provider error propagates cleanly without burning repair retries
  let providerRepairs = 0;
  await assert.rejects(
    executeValidatedSingleWrite({
      validation: { characterLimit: 500 },
      generateDraft: async () => {
        throw new Error('429 RESOURCE_EXHAUSTED quota');
      },
      repairDraft: async () => {
        providerRepairs++;
        return {};
      },
      replaceDraft: async () => ({})
    }),
    (err: any) => err instanceof GenerationPipelineError && err.code === 'PROVIDER_ERROR'
  );
  assert.equal(providerRepairs, 0);
});

// ---------------------------------------------------------------------------
// 5. Architectural Contract Audit Across All 12 Write Routes & UI Callers
// ---------------------------------------------------------------------------

test('server.ts Write routes: zero rulebook bloat, zero legacy post mutators, unified tab ledger, and FLASH_36 creative routing', () => {
  const server = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');

  // No Write route may inject the legacy 33.9 KB CONTENT_GENERATOR_RULEBOOK
  assert.equal(server.includes('${CONTENT_GENERATOR_RULEBOOK}'), false);

  // Legacy hardcoded/contradictory strings must be gone from active Write endpoints
  const activeWriteRoutes = server.slice(server.indexOf('app.post("/api/generate-posts-batch"'));
  assert.equal(activeWriteRoutes.includes('ThreadsWorks Suite'), false);
  assert.equal(activeWriteRoutes.includes('The unfiltered truth: '), false);
  assert.equal(activeWriteRoutes.includes("reply 'GUIDE' below"), false);
  assert.equal(activeWriteRoutes.includes('all 92-99'), false);

  // Batch endpoint reads and writes generation_intelligence under the same effectiveTabId
  const batchSlice = server.slice(
    server.indexOf('app.post("/api/generate-posts-batch"'),
    server.indexOf('// Helper function to transform Hooks')
  );
  assert.ok(batchSlice.includes('const effectiveTabId ='));
  assert.ok(batchSlice.includes('getOrBuildGenerationIntelligenceSnapshot(serverDb, activeUserId, effectiveTabId)'));
  assert.ok(batchSlice.includes('recordGeneratedBatchInSnapshot(serverDb, activeUserId, effectiveTabId'));
  assert.ok(batchSlice.includes('THREADSWORKS_MODELS.FLASH_36'));
  assert.ok(batchSlice.includes('enforceNovelty: true'));

  // All upgraded single-write routes avoid legacy verifyAndRepairPost / applyMyLinksToPost / sanitizeAndValidateBestPost
  const writeRoutesTail = server.slice(
    server.indexOf('app.post("/api/regenerate-single-post"'),
    server.indexOf('app.post("/api/check-content-integrity"')
  );
  assert.equal(writeRoutesTail.includes('verifyAndRepairPost('), false);
  assert.equal(writeRoutesTail.includes('applyMyLinksToPost('), false);
  assert.equal(writeRoutesTail.includes('sanitizeAndValidateBestPost('), false);
});

test('frontend Write callers: zero synthetic fallback offers and no silent hardcoded fake best-post fallback', () => {
  const contentEngine = readFileSync(new URL('../src/components/ContentEngineView.tsx', import.meta.url), 'utf8');
  const createBestPost = readFileSync(new URL('../src/components/CreateBestPostView.tsx', import.meta.url), 'utf8');
  const libraryView = readFileSync(new URL('../src/components/ContentLibraryView.tsx', import.meta.url), 'utf8');
  const calendarView = readFileSync(new URL('../src/components/CalendarView.tsx', import.meta.url), 'utf8');

  assert.equal(libraryView.includes('custom training frameworks'), false);
  assert.equal(calendarView.includes('custom training frameworks'), false);
  assert.equal(contentEngine.includes('offer: profile?.offer || "high-value offer"'), false);

  // CreateBestPostView no longer fabricates a hardcoded fake post on API failure
  assert.equal(createBestPost.includes('Here is the exact 3-step framework we use to turn attention into active clients'), false);
  assert.ok(createBestPost.includes('res.generatorVersion === "V3"'));
  assert.ok(createBestPost.includes('generationError'));
});
