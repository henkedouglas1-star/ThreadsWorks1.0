import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveWinningComboFormat } from '../server/performanceIntelligenceService.ts';

test('uses the observed format pattern even when primary dimension is not format', () => {
  assert.equal(resolveWinningComboFormat({ formatPattern: 'Numbered thread', primaryDimension: 'hook', primaryKey: 'Contrarian hook' }), 'Numbered thread');
});

test('uses the primary key only for format dimension when no format pattern is recorded', () => {
  assert.equal(resolveWinningComboFormat({ primaryDimension: 'format', primaryKey: 'Short paragraphs' }), 'Short paragraphs');
  assert.equal(resolveWinningComboFormat({ primaryDimension: 'topic', primaryKey: 'Marketing' }), 'Thread Format');
  assert.equal(resolveWinningComboFormat({}), 'Thread Format');
});
