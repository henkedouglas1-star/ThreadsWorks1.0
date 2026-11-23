import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildGatedWriteContext,
  resolveWritingLengthPlan,
  resolveEffectivePostCount,
  extractExplicitPostCount,
  extractExplicitPartCount,
  extractExplicitSentencesPerPart
} from '../server/writeContextGate.ts';
import { buildRollingLedger, planBatchSlots } from '../server/writeDiversityEngine.ts';
import {
  composeBatchWriterSystemInstruction,
  composeSingleWriteSystemInstruction,
  composeReviewerSystemInstruction
} from '../server/writePromptComposer.ts';
import {
  countPartSentences,
  checkStructuralCompletenessAndRepetition,
  validateSingleDraft,
  executeValidatedSingleWrite,
  writeValidatedChunk
} from '../server/contentBatchContract.ts';

// ---------------------------------------------------------------------------
// 1. Unified Length Decisions Across All 4 Required Archetypes
// ---------------------------------------------------------------------------

test('short observations: selects compact 1-2 part structure with 1-2 sentences and prevents unnecessary thread expansion', () => {
  const prompts = [
    'Short observation: most productivity apps create more work than they save.',
    'Quick thought on why silence beats background music when writing.'
  ];

  for (const contentRequest of prompts) {
    const plan = resolveWritingLengthPlan({ contentRequest, threadLength: 'auto', sentencesPerPart: 'auto' });
    assert.equal(plan.profile, 'short_observation', `Expected short_observation for: ${contentRequest}`);
    assert.equal(plan.partCountMode, 'auto');
    assert.equal(plan.recommendedParts, 1);
    assert.equal(plan.minParts, 1);
    assert.equal(plan.maxParts, 2);
    assert.ok(plan.recommendedSentencesPerPart >= 1 && plan.recommendedSentencesPerPart <= 2);
    assert.ok(plan.maxSentencesPerPart <= 3);

    // Every batch slot must stay compact (1-2 parts) — never force short observations into long threads
    const slots = planBatchSlots({ count: 4, ledger: buildRollingLedger(null), writingPlan: plan, randomSeed: 'obs-seed' });
    for (const slot of slots) {
      assert.ok((slot.targetParts || 0) >= 1 && (slot.targetParts || 0) <= 2);
      assert.equal(slot.maxParts, 2);
    }
  }
});

test('personal reflections: selects grounded universal 1-10 range with natural multi-part depth and 2-3 sentences per part', () => {
  const standardReflection = resolveWritingLengthPlan({
    contentRequest: 'Personal reflection on slowing down after years of chasing busyness.',
    threadLength: 'auto',
    sentencesPerPart: 'auto'
  });
  assert.equal(standardReflection.profile, 'personal_reflection');
  assert.ok(standardReflection.recommendedParts >= 2 && standardReflection.recommendedParts <= 5);
  assert.equal(standardReflection.minParts, 1);
  assert.equal(standardReflection.maxParts, 10);
  assert.ok(standardReflection.recommendedSentencesPerPart >= 2 && standardReflection.recommendedSentencesPerPart <= 3);

  const briefReflection = resolveWritingLengthPlan({
    contentRequest: 'Brief personal reflection on what I learned from stepping away from my phone this weekend.',
    threadLength: 'auto',
    sentencesPerPart: 'auto'
  });
  assert.equal(briefReflection.profile, 'personal_reflection');
  assert.ok(briefReflection.recommendedParts >= 1 && briefReflection.recommendedParts <= 3);
  assert.equal(briefReflection.maxParts, 10);

  const slots = planBatchSlots({ count: 3, ledger: buildRollingLedger(null), writingPlan: standardReflection, randomSeed: 'ref-seed' });
  for (const slot of slots) {
    assert.ok((slot.targetParts || 0) >= 1 && (slot.targetParts || 0) <= 10);
  }
});

test('educational explanations: selects universal 2-10 part depth scaled to topic structure with 2-4 sentences per part', () => {
  const conceptPlan = resolveWritingLengthPlan({
    contentRequest: 'Explain how compound interest works and why starting early matters more than contributing more later.',
    threadLength: 'auto',
    sentencesPerPart: 'auto'
  });
  assert.equal(conceptPlan.profile, 'educational_explanation');
  assert.ok(conceptPlan.recommendedParts >= 3 && conceptPlan.recommendedParts <= 6);
  assert.equal(conceptPlan.minParts, 2);
  assert.equal(conceptPlan.maxParts, 10);
  assert.equal(conceptPlan.recommendedSentencesPerPart, 3);
  assert.equal(conceptPlan.maxSentencesPerPart, 4);

  const fourPrinciplesPlan = resolveWritingLengthPlan({
    contentRequest: 'Explain the 4 principles of readable mobile typography.',
    threadLength: 'auto',
    sentencesPerPart: 'auto'
  });
  assert.equal(fourPrinciplesPlan.profile, 'educational_explanation');
  assert.ok(fourPrinciplesPlan.recommendedParts >= 4 && fourPrinciplesPlan.recommendedParts <= 6);
  assert.ok(fourPrinciplesPlan.minParts >= 2 && fourPrinciplesPlan.maxParts === 10);

  // Single-post call (count: 1) must get a multi-part target >= 2, NOT collapse to single_punch
  const singleSlot = planBatchSlots({ count: 1, ledger: buildRollingLedger(null), writingPlan: conceptPlan, randomSeed: 'edu-seed' })[0];
  assert.ok((singleSlot.targetParts || 0) >= 2 && (singleSlot.targetParts || 0) <= 10);
  assert.notEqual(singleSlot.structuralShape, 'single_punch');
});

test('complex tutorials: selects 4-10 parts with 500-char readable sentence pacing and never collapses Slot 1 to 1 part', () => {
  const tutorialPlan = resolveWritingLengthPlan({
    contentRequest:
      'Write a complete step-by-step tutorial on setting up automated database backups, restore verification checks, and failure alerting from scratch.',
    threadLength: 'auto',
    sentencesPerPart: 'auto'
  });
  assert.equal(tutorialPlan.profile, 'complex_tutorial');
  assert.ok(tutorialPlan.recommendedParts >= 4 && tutorialPlan.recommendedParts <= 10);
  assert.ok(tutorialPlan.minParts >= 4);
  assert.equal(tutorialPlan.maxParts, 10);
  assert.ok(tutorialPlan.recommendedSentencesPerPart >= 2 && tutorialPlan.recommendedSentencesPerPart <= 3);
  assert.ok(tutorialPlan.maxSentencesPerPart <= 4);

  const sixStageTutorial = resolveWritingLengthPlan({
    contentRequest: 'Step-by-step tutorial: 6 stages to launch a weekly newsletter from scratch.',
    threadLength: 'auto',
    sentencesPerPart: 'auto'
  });
  assert.equal(sixStageTutorial.profile, 'complex_tutorial');
  assert.ok(sixStageTutorial.recommendedParts >= 6 && sixStageTutorial.recommendedParts <= 8);
  assert.ok(sixStageTutorial.minParts >= 4 && sixStageTutorial.maxParts === 10);

  // Single-post Slot 1 MUST receive developed_thread (>= 4 parts), fixing legacy single_punch bug
  const slot1 = planBatchSlots({ count: 1, ledger: buildRollingLedger(null), writingPlan: tutorialPlan, randomSeed: 'tut-seed' })[0];
  assert.equal(slot1.structuralShape, 'developed_thread');
  assert.ok((slot1.targetParts || 0) >= 4 && (slot1.targetParts || 0) <= 10);
});

// ---------------------------------------------------------------------------
// 2. Explicit User Instructions (Parameters AND Text Directives)
// ---------------------------------------------------------------------------

test('preserves explicit user instructions for post counts, thread lengths, and sentences per part', () => {
  // Explicit text instructions in contentRequest
  assert.equal(extractExplicitPostCount('Write 4 posts about deep work habits'), 4);
  assert.equal(extractExplicitPostCount('Create 3 separate threads about pricing psychology'), 3);
  assert.equal(extractExplicitPostCount('Write a 5-part thread about morning walks'), undefined); // 5-part thread is partCount, NOT 5 posts
  assert.equal(extractExplicitPartCount('Write a 5-part thread about morning walks'), 5);
  assert.equal(extractExplicitPartCount('Write a single post explaining why sleep helps memory'), 1);
  assert.equal(extractExplicitSentencesPerPart('Write a 4-part thread with 2 sentences per part about focus'), 2);
  assert.equal(extractExplicitSentencesPerPart('Give me a one-liner about patience'), 1);

  // resolveEffectivePostCount honors explicit UI count vs untouched ui_default
  assert.equal(
    resolveEffectivePostCount({ count: 1, countSource: 'ui_default' }, 'Write 4 posts about morning focus'),
    4
  );
  assert.equal(
    resolveEffectivePostCount({ count: 8, countSource: 'explicit' }, 'Write 4 posts about morning focus'),
    8
  );
  assert.equal(
    resolveEffectivePostCount({ count: 'auto' }, 'Create 3 threads about pricing'),
    3
  );

  // Explicit thread length & sentences in contentRequest override auto profile in AI Mode
  const gatedTextExplicit = buildGatedWriteContext(
    { writingStyle: 'clear and direct' },
    { threadLength: 'auto', sentencesPerPart: 'auto' },
    'Write a 5-part thread with 2 sentences per part as a short observation about clean code.'
  );
  assert.equal(gatedTextExplicit.writingPlan.partCountMode, 'explicit');
  assert.equal(gatedTextExplicit.writingPlan.recommendedParts, 5);
  assert.equal(gatedTextExplicit.writingPlan.minParts, 5);
  assert.equal(gatedTextExplicit.writingPlan.maxParts, 5);
  assert.equal(gatedTextExplicit.directives.partCount, 5);
  assert.equal(gatedTextExplicit.writingPlan.sentencesMode, 'explicit');
  assert.equal(gatedTextExplicit.writingPlan.recommendedSentencesPerPart, 2);
  assert.equal(gatedTextExplicit.directives.sentencesPerPart, 2);

  // Explicit API parameters override auto heuristics
  const gatedParamExplicit = buildGatedWriteContext(
    { writingStyle: 'clear and direct' },
    { threadLength: '4', sentencesPerPart: '2' },
    'Short observation: clarity beats volume.'
  );
  assert.equal(gatedParamExplicit.writingPlan.partCountMode, 'explicit');
  assert.equal(gatedParamExplicit.directives.partCount, 4);
  assert.equal(gatedParamExplicit.writingPlan.sentencesMode, 'explicit');
  assert.equal(gatedParamExplicit.directives.sentencesPerPart, 2);
});

test('adapts auto sentence budget dynamically to tighter character limits', () => {
  const tightPlan = resolveWritingLengthPlan({
    contentRequest: 'Explain how spaced repetition improves long-term memory.',
    threadLength: 'auto',
    sentencesPerPart: 'auto',
    characterLimit: 220
  });
  const standardPlan = resolveWritingLengthPlan({
    contentRequest: 'Explain how spaced repetition improves long-term memory.',
    threadLength: 'auto',
    sentencesPerPart: 'auto',
    characterLimit: 500
  });
  assert.ok(tightPlan.maxSentencesPerPart <= 2);
  assert.ok(standardPlan.maxSentencesPerPart >= 3);
});

// ---------------------------------------------------------------------------
// 3. Prompt Composer & Output Validation Enforcement
// ---------------------------------------------------------------------------

test('prompt composer communicates the exact WritingLengthPlan across batch, single-write, and reviewer prompts', () => {
  const obsGated = buildGatedWriteContext(
    { writingStyle: 'sharp, observational' },
    { threadLength: 'auto', sentencesPerPart: 'auto' },
    'Short observation: most status meetings exist because written updates are unclear.'
  );
  const batchObsPrompt = composeBatchWriterSystemInstruction(obsGated);
  assert.ok(batchObsPrompt.length < 4500);
  assert.match(batchObsPrompt, /short_observation/i);
  assert.match(batchObsPrompt, /between 1 and 2 parts/i);

  const tutGated = buildGatedWriteContext(
    { writingStyle: 'clear, technical' },
    { threadLength: 'auto', sentencesPerPart: 'auto' },
    'Write a step-by-step tutorial on setting up end-to-end automated backups and restore drills from scratch.'
  );
  const singleTutPrompt = composeSingleWriteSystemInstruction('GENERATE_THREAD', tutGated);
  assert.ok(singleTutPrompt.length < 3500);
  assert.match(singleTutPrompt, /complex_tutorial/i);
  assert.match(singleTutPrompt, /between 4 and 10 parts/i);

  const reviewerPrompt = composeReviewerSystemInstruction();
  assert.ok(reviewerPrompt.length < 3000);
  assert.match(reviewerPrompt, /settings\.writingPlan/);
  assert.match(reviewerPrompt, /unnecessary thread padding/i);
  assert.match(reviewerPrompt, /1–10 part depth/i);
});

test('contentBatchContract enforces auto part bounds, explicit sentence counts, and rejects repetition or unfinished explanations', () => {
  // URL-safe & abbreviation-safe sentence counting
  assert.equal(
    countPartSentences('Check e.g. version 2.5 at https://example.com/docs/v2.5 today. It runs cleanly.'),
    2
  );
  assert.equal(countPartSentences('1. First action step.\n2. Second action step.'), 2);

  // Short observation (minParts: 1, maxParts: 1): rejects 3-part unnecessary expansion
  assert.throws(
    () =>
      validateSingleDraft(
        {
          title: 'Too long',
          hook: 'Most productivity tools add friction.',
          threadParts: [
            'Most productivity tools add friction.',
            'People spend hours tweaking tags instead of finishing work.',
            'A plain checklist beats a complicated dashboard.'
          ],
          cta: ''
        },
        { slotNumber: 1, characterLimit: 500, minParts: 1, maxParts: 1, maxSentencesPerPart: 2, checkInternalRepetition: true }
      ),
    /exceeding the 1-part limit/i
  );

  // Complex tutorial (minParts: 4, maxParts: 6): rejects 1-part truncated tutorial
  assert.throws(
    () =>
      validateSingleDraft(
        {
          title: 'Truncated tutorial',
          hook: 'Setting up automated backups takes four steps.',
          threadParts: ['Setting up automated backups takes four steps. Schedule dumps, encrypt snapshots, test restores, and alert on failure.'],
          cta: ''
        },
        { slotNumber: 1, characterLimit: 500, minParts: 4, maxParts: 6, maxSentencesPerPart: 4, checkInternalRepetition: true }
      ),
    /fewer than the 4-part minimum/i
  );

  // Explicit sentence count enforcement (2 sentences per part)
  assert.throws(
    () =>
      validateSingleDraft(
        {
          title: 'Wrong sentence count',
          hook: 'One sentence only here.',
          threadParts: ['One sentence only here.'],
          cta: ''
        },
        { slotNumber: 1, characterLimit: 500, partCount: 1, exactSentencesPerPart: 2 }
      ),
    /2 sentence\(s\) per part were explicitly requested/i
  );

  // Repetitive filler sentence detection & unfinished explanation detection
  const repDefects = checkStructuralCompletenessAndRepetition([
    'Clear writing starts with cutting filler words before publishing your draft.',
    'Clear writing starts with cutting filler words before publishing your draft. Every extra phrase slows readers down.'
  ]);
  assert.ok(repDefects.some(d => /repeats near-identical filler sentence/i.test(d)));

  const unfinishedDefects = checkStructuralCompletenessAndRepetition([
    'Step 1: Export your database snapshot every midnight.',
    'Step 2: Verify the restore on a staging instance:'
  ]);
  assert.ok(unfinishedDefects.some(d => /dangling colon/i.test(d)));

  const teaserDefects = checkStructuralCompletenessAndRepetition([
    'Step 1: Export your database snapshot every midnight.',
    'Next, we will cover alerting and recovery — continued in the next part.'
  ]);
  assert.ok(teaserDefects.some(d => /unfinished/i.test(d)));
});

test('pipeline end-to-end recovery: repairs an over-expanded short observation into a crisp 1-part post and validates a complete 5-part tutorial', async () => {
  // Short observation pipeline auto-repairs a 3-part over-expansion down to 1 crisp part
  const obsGated = buildGatedWriteContext(
    { writingStyle: 'direct and calm' },
    { threadLength: 'auto', sentencesPerPart: 'auto' },
    'Short observation: a clear calendar beats a packed task manager.'
  );
  let repairedObs = false;
  const obsResult = await executeValidatedSingleWrite({
    validation: {
      characterLimit: 500,
      partCount: obsGated.directives.partCount,
      minParts: obsGated.writingPlan.minParts,
      maxParts: obsGated.writingPlan.maxParts,
      maxSentencesPerPart: obsGated.writingPlan.maxSentencesPerPart,
      checkInternalRepetition: true
    },
    generateDraft: async () => ({
      title: 'Calendar clarity',
      hook: 'A clear calendar beats a packed task manager.',
      threadParts: [
        'A clear calendar beats a packed task manager.',
        'Tasks without time blocks stay wishful thinking.',
        'Block two hours tomorrow morning.'
      ],
      cta: ''
    }),
    repairDraft: async ({ defects }) => {
      repairedObs = true;
      assert.ok(defects.some(d => /exceeding the 2-part limit/i.test(d)));
      return {
        title: 'Calendar clarity',
        hook: 'A clear calendar beats a packed task manager.',
        threadParts: [
          'A clear calendar beats a packed task manager. Time blocks force honest tradeoffs that endless checklists hide.'
        ],
        cta: ''
      };
    },
    replaceDraft: async () => {
      throw new Error('Should not replace after successful repair');
    }
  });
  assert.equal(repairedObs, true);
  assert.equal(obsResult.threadParts.length, 1);
  assert.equal(countPartSentences(obsResult.threadParts[0]), 2);

  // Complex tutorial passes cleanly as a complete 5-part thread with 2–3 sentences per part
  const tutGated = buildGatedWriteContext(
    { writingStyle: 'clear technical mentor' },
    { threadLength: 'auto', sentencesPerPart: 'auto' },
    'Write a complete step-by-step tutorial on setting up automated PostgreSQL backups, restore tests, and alerting from scratch.'
  );
  const tutChunk = await writeValidatedChunk({
    slotNumbers: [1],
    priorAcceptedDrafts: [],
    validation: {
      characterLimit: 500,
      partCount: tutGated.directives.partCount,
      minParts: tutGated.writingPlan.minParts,
      maxParts: tutGated.writingPlan.maxParts,
      maxSentencesPerPart: tutGated.writingPlan.maxSentencesPerPart,
      checkInternalRepetition: true
    },
    generateChunk: async () => [
      {
        title: 'Automated Postgres Backups',
        hook: 'Unverified database backups are guesses, not insurance.',
        threadParts: [
          'Unverified database backups are guesses, not insurance. Here is a practical five-step setup you can run from scratch in one afternoon.',
          'Step 1: Schedule compressed pg_dump snapshots on a dedicated cron worker. Name every archive with a UTC timestamp so rollbacks stay unambiguous.',
          'Step 2: Encrypt each snapshot with age or KMS before uploading it to an isolated object-storage bucket with versioning enabled. Keep bucket credentials write-only for the backup worker.',
          'Step 3: Automate a weekly restore drill into an ephemeral container and run a lightweight schema plus row-count sanity query. A backup only counts once a clean restore finishes.',
          'Step 4: Wire dead-man switch alerts so you get notified both on job errors and when a scheduled backup fails to arrive. Review retention policies quarterly to keep storage lean.'
        ],
        cta: '',
        ctaDecision: 'omit'
      }
    ],
    reviewDrafts: async drafts => drafts.map(d => ({ slotNumber: d.slotNumber, passed: true, defects: [] })),
    repairDraft: async () => {
      throw new Error('Valid tutorial should not require repair');
    },
    replaceDraft: async () => {
      throw new Error('Valid tutorial should not require replacement');
    }
  });
  assert.equal(tutChunk.acceptedDrafts.length, 1);
  assert.equal(tutChunk.acceptedDrafts[0].threadParts.length, 5);
  for (const part of tutChunk.acceptedDrafts[0].threadParts) {
    assert.ok(part.length <= 500);
    assert.ok(countPartSentences(part) >= 2 && countPartSentences(part) <= 3);
  }
});

// ---------------------------------------------------------------------------
// 4. Frontend & Saved Tabs AI Mode Auto-Default Contract Audit
// ---------------------------------------------------------------------------

test('frontend & savedTabs default threadLength and sentencesPerPart to auto so AI Mode is never silently forced to 3', () => {
  const savedTabs = readFileSync(new URL('../server/savedTabsService.ts', import.meta.url), 'utf8');
  const persistence = readFileSync(new URL('../src/context/ContentPersistenceContext.tsx', import.meta.url), 'utf8');
  const contentEngine = readFileSync(new URL('../src/components/ContentEngineView.tsx', import.meta.url), 'utf8');

  // savedTabsService no longer hardcodes "3"
  assert.equal(savedTabs.includes('threadLength: "3"'), false);
  assert.equal(savedTabs.includes('sentencesPerPart: "3"'), false);
  assert.ok(savedTabs.includes('threadLength: "auto"'));
  assert.ok(savedTabs.includes('sentencesPerPart: "auto"'));

  // ContentPersistenceContext ignores legacy localStorage threadLength/sentencesPerPart overrides and defaults to "auto"
  assert.equal(persistence.includes('setThreadLengthState("3")'), false);
  assert.equal(persistence.includes('setSentencesPerPartState("3")'), false);
  assert.equal(persistence.includes("localStorage.getItem('threads_thread_length')"), false);
  assert.equal(persistence.includes("localStorage.getItem('threads_sentences_per_part')"), false);
  assert.ok(persistence.includes('useState<string>("auto")'));

  // ContentEngineView sends standard automatic length settings and preserves countSource
  assert.ok(contentEngine.includes('resolveStandardContentEngineLengthSettings'));
  assert.ok(contentEngine.includes('countSource:'));
  assert.ok(contentEngine.includes('threadLength: standardThreadLength'));
  assert.ok(contentEngine.includes('sentencesPerPart: standardSentencesPerPart'));
});
