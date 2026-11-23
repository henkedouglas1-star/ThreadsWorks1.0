import test from 'node:test';
import assert from 'node:assert/strict';
import { enforceEightPostAiDecideReview, validateEightPostAiDecideBatch } from '../server/contentBatchContract.ts';

const draft = (parts: number) => ({
  threadParts: Array.from({ length: parts }, (_, i) => `Part ${i + 1}: grounded, distinct writing point ${i + 1}.`)
});

test('eight-post AI Decide accepts valid 1–10 part distributions without diversity quotas', () => {
  assert.doesNotThrow(() =>
    validateEightPostAiDecideBatch([draft(1), draft(2), draft(3), draft(4), draft(5), draft(7), draft(8), draft(10)])
  );
  // Repeated part counts and multiple single-part posts are explicitly allowed when content depth warrants them
  assert.doesNotThrow(() => validateEightPostAiDecideBatch(Array.from({ length: 8 }, () => draft(1))));
  assert.doesNotThrow(() => validateEightPostAiDecideBatch(Array.from({ length: 8 }, () => draft(4))));
  assert.doesNotThrow(() => validateEightPostAiDecideBatch(Array.from({ length: 8 }, () => draft(10))));
});

test('eight-post AI Decide rejects incomplete and oversized post or part counts', () => {
  assert.throws(() => validateEightPostAiDecideBatch(Array.from({ length: 7 }, () => draft(2))), /requested 8|exactly eight/i);
  assert.throws(() => validateEightPostAiDecideBatch([...Array.from({ length: 7 }, () => draft(2)), draft(11)]), /1–10|exceeds maximum/i);
  assert.throws(() => validateEightPostAiDecideBatch([...Array.from({ length: 7 }, () => draft(2)), draft(0)]), /no valid threadParts|1–10/i);
});

test('validation does not pad, truncate or mutate generated drafts', () => {
  const posts = Array.from({ length: 8 }, () => draft(3));
  const before = JSON.stringify(posts);
  validateEightPostAiDecideBatch(posts);
  assert.equal(JSON.stringify(posts), before);
});

test('eight-post AI Decide rejects blank, non-text, or duplicate parts', () => {
  const posts = Array.from({ length: 8 }, () => draft(2));
  posts[3].threadParts[1] = '  ';
  assert.throws(() => validateEightPostAiDecideBatch(posts), /empty or invalid/i);
  (posts[3].threadParts as unknown[])[1] = null;
  assert.throws(() => validateEightPostAiDecideBatch(posts), /empty or invalid/i);

  const dupPosts = Array.from({ length: 8 }, () => draft(2));
  dupPosts[2].threadParts[1] = dupPosts[2].threadParts[0];
  assert.throws(() => validateEightPostAiDecideBatch(dupPosts), /duplicate thread parts/i);
});

test('enforceEightPostAiDecideReview preserves natural part counts without quota-forcing repair', () => {
  const reviews = [
    { slotNumber: 3, passed: true, defects: [] },
    { slotNumber: 4, passed: true, defects: [] }
  ];
  const drafts = [
    { slotNumber: 3, draft: draft(1) },
    { slotNumber: 4, draft: draft(1) }
  ];
  const result = enforceEightPostAiDecideReview(reviews, drafts, [draft(1)]) as typeof reviews;
  assert.deepEqual(result, reviews);
});

test('multi-part drafts and explicit reviewer failures remain unchanged', () => {
  const reviews = [{ slotNumber: 2, passed: false, defects: ['Other issue'] }];
  const result = enforceEightPostAiDecideReview(reviews, [{ slotNumber: 2, draft: draft(3) }], [draft(1)]) as typeof reviews;
  assert.deepEqual(result, reviews);
});
