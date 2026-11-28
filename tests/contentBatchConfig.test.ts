import { test } from "node:test";
import assert from "node:assert/strict";
import { CONTENT_BATCH_SIZES, DEFAULT_CONTENT_BATCH_SIZE, MAX_CONTENT_BATCH_SIZE, CONTENT_BATCH_TARGET_MS, normalizeContentBatchSelection } from "../contentBatchConfig";

test("interactive batch sizes and performance target are stable", () => {
  assert.deepEqual([...CONTENT_BATCH_SIZES], [1, 4, 7]);
  assert.equal(DEFAULT_CONTENT_BATCH_SIZE, 4);
  assert.equal(MAX_CONTENT_BATCH_SIZE, 7);
  assert.equal(CONTENT_BATCH_TARGET_MS, 20000);
});

test("legacy and invalid selections fall back to four", () => {
  for (const value of ["8", "16", "32", "", null, undefined, "auto"]) {
    assert.equal(normalizeContentBatchSelection(value), "4");
  }
  for (const value of ["1", "4", "7"]) {
    assert.equal(normalizeContentBatchSelection(value), value);
  }
});
