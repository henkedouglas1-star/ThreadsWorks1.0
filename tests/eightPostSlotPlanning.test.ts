import test from 'node:test';
import assert from 'node:assert/strict';
import { planEightPostAiDecideParts } from '../server/writeDiversityEngine.ts';

const slots = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    slotNumber: i + 1,
    lensId: 'observation',
    lensLabel: 'Observation',
    lensGuidance: 'Write clearly',
    structuralShape: 'single_punch' as const,
    shapeGuidance: 'Single',
    targetParts: 1,
    minParts: 1,
    maxParts: 10
  }));

const plan = {
  partCountMode: 'auto',
  minParts: 1,
  maxParts: 10,
  recommendedParts: 3,
  sentencesMode: 'auto',
  minSentencesPerPart: 1,
  maxSentencesPerPart: 4
} as any;

test('eight auto slots plan AI-guided targets across 1–10 parts with deterministic controlled randomness', () => {
  const resultA = planEightPostAiDecideParts(slots(8), plan, { randomSeed: 'seed-alpha' });
  const resultB = planEightPostAiDecideParts(slots(8), plan, { randomSeed: 'seed-alpha' });
  assert.equal(resultA.length, 8);
  assert.ok(resultA.every(slot => slot.targetParts! >= 1 && slot.targetParts! <= 10));
  assert.ok(resultA.every(slot => slot.minParts === 1 && slot.maxParts === 10));
  assert.deepEqual(
    resultA.map(s => s.targetParts),
    resultB.map(s => s.targetParts),
    'same seed should produce deterministic targets'
  );
  // Must avoid collapsing all 8 posts into 1-part singletons on general auto plans
  assert.ok(
    resultA.some(slot => slot.targetParts! >= 2),
    'auto planning should include meaningful multi-part depth rather than collapsing all 8 slots to 1 part'
  );
});

test('other auto batch sizes receive universal 1–10 planning while explicit part choices remain untouched', () => {
  const seven = slots(7);
  const plannedSeven = planEightPostAiDecideParts(seven, plan, { randomSeed: 'seven-seed' });
  assert.equal(plannedSeven.length, 7);
  assert.ok(plannedSeven.every(slot => slot.targetParts! >= 1 && slot.targetParts! <= 10));
  const eight = slots(8);
  assert.strictEqual(planEightPostAiDecideParts(eight, { ...plan, partCountMode: 'explicit' }), eight);
});

test('narrow auto writing range (maxParts: 1) is respected and not silently widened', () => {
  const eight = slots(8);
  const narrow = planEightPostAiDecideParts(eight, { ...plan, minParts: 1, maxParts: 1, recommendedParts: 1 });
  assert.ok(narrow.every(slot => slot.targetParts === 1 && slot.maxParts === 1));
});
