import test from "node:test";
import assert from "node:assert/strict";
import { postArtAllowance, POST_ART_IMAGES_PER_REQUEST } from "../src/lib/postArtPolicy";
test("art requests produce exactly one image", () => assert.equal(POST_ART_IMAGES_PER_REQUEST, 1));
test("free art allowance resets Monday UTC", () => {
  const a = postArtAllowance(false, new Date("2026-11-29T23:59:59Z"));
  assert.equal(a.limit, 1);
  assert.equal(a.start, "2026-11-23T00:00:00.000Z");
  assert.equal(a.end, "2026-11-30T00:00:00.000Z");
});
test("pro art allowance resets daily UTC", () => {
  const a = postArtAllowance(true, new Date("2026-11-29T23:59:59Z"));
  assert.equal(a.limit, 1);
  assert.equal(a.start, "2026-11-29T00:00:00.000Z");
  assert.equal(a.end, "2026-11-30T00:00:00.000Z");
});
