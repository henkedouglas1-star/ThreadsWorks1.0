import test from 'node:test';
import assert from 'node:assert/strict';
import { selectVerifiedPerformanceSignals } from '../server/analyticsService.ts';
const post = (views: number, topic: string, overrides: Record<string, unknown> = {}) => ({
  metrics: { views, likes: 0, replies: 0, reposts: 0, quotes: 0 },
  metricsAvailable: true, maturationStatus: 'mature',
  contentMemoryContext: { topic, format: 'thread', pillarTitle: 'education', hook: 'Hook' },
  ...overrides
});
test('ranked signals use verified mature views, not API retrieval order', () => {
  const result = selectVerifiedPerformanceSignals([post(10, 'low'), post(200, 'high'), post(80, 'middle')] as any);
  assert.deepEqual(result.topics, ['high', 'middle', 'low']);
  assert.equal(result.sampleSize, 3);
});
test('unavailable insights and immature posts never become performance evidence', () => {
  const result = selectVerifiedPerformanceSignals([
    post(1000, 'missing', { metricsAvailable: false }),
    post(900, 'new', { maturationStatus: 'maturing' }),
    post(25, 'verified')
  ] as any);
  assert.deepEqual(result.topics, ['verified']);
  assert.deepEqual(selectVerifiedPerformanceSignals([post(0, 'none', { metricsAvailable: false })] as any).topics, []);
});
test('signals are derived solely from supplied creator posts and do not mutate them', () => {
  const posts = [post(5, 'one'), post(10, 'two')];
  const before = JSON.stringify(posts);
  assert.deepEqual(selectVerifiedPerformanceSignals(posts as any).topics, ['two', 'one']);
  assert.equal(JSON.stringify(posts), before);
});
