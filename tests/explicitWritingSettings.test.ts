import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveWritingLengthPlan } from '../server/writeContextGate.ts';

const source = readFileSync(new URL('../src/components/ContentEngineView.tsx', import.meta.url), 'utf8');

test('Standard Content Engine uses automatic length policy without invisible localStorage overrides', () => {
  assert.ok(source.includes('resolveStandardContentEngineLengthSettings'));
  assert.ok((source.match(/threadLength: standardThreadLength/g) || []).length >= 2);
  assert.ok((source.match(/sentencesPerPart: standardSentencesPerPart/g) || []).length >= 2);
  assert.equal(source.includes("localStorage.getItem('threads_thread_length')"), false, 'ContentEngineView must not read legacy threads_thread_length');
  assert.equal(source.includes('localStorage.getItem("threads_thread_length")'), false, 'ContentEngineView must not read legacy threads_thread_length');
});

test('Explicit length directives in current request or API settings remain strictly honored', () => {
  const explicitRequestPlan = resolveWritingLengthPlan({
    contentRequest: 'Write a 4-part thread with 2 sentences per part about creator leverage',
    threadLength: 'auto',
    sentencesPerPart: 'auto',
  });
  assert.equal(explicitRequestPlan.partCountMode, 'explicit');
  assert.equal(explicitRequestPlan.recommendedParts, 4);
  assert.equal(explicitRequestPlan.sentencesMode, 'explicit');
  assert.equal(explicitRequestPlan.recommendedSentencesPerPart, 2);

  const explicitSettingPlan = resolveWritingLengthPlan({
    contentRequest: 'How consistent publishing compounds trust',
    threadLength: '5',
    sentencesPerPart: '3',
  });
  assert.equal(explicitSettingPlan.partCountMode, 'explicit');
  assert.equal(explicitSettingPlan.recommendedParts, 5);
  assert.equal(explicitSettingPlan.sentencesMode, 'explicit');
  assert.equal(explicitSettingPlan.recommendedSentencesPerPart, 3);
});
