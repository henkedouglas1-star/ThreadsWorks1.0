import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeDemandSources, searchDemandSources } from "../server/demandResearch";

test("normalizes only real provider result records with safe links", () => {
  const sources = normalizeDemandSources({ web: { results: [
    { title: "Example", url: "https://example.com/article#intro", description: "Public snippet" },
    { title: "Duplicate", url: "https://example.com/article#other" },
    { title: "Unsafe", url: "javascript:alert(1)" },
    { title: "Missing URL" },
    { title: "Invalid", url: "https://user:secret@example.com" }
  ] } });
  assert.deepEqual(sources, [{ title: "Example", url: "https://example.com/article", snippet: "Public snippet" }]);
  assert.deepEqual(normalizeDemandSources(null), []);
});

test("sends only a bounded explicit public query to the fixed provider endpoint", async () => {
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.origin, "https://api.search.brave.com");
    assert.equal(url.searchParams.get("q"), "digital products");
    assert.equal(url.searchParams.get("count"), "8");
    assert.equal(new Headers(init?.headers).get("X-Subscription-Token"), "test-key");
    assert.equal(init?.redirect, "error");
    return new Response(JSON.stringify({ web: { results: [] } }), { status: 200 });
  };
  assert.deepEqual(await searchDemandSources(" digital products ", "test-key", fetcher), []);
});

test("fails without configuration or on provider failure, never fabricates sources", async () => {
  const fetcher: typeof fetch = async () => new Response("", { status: 503 });
  await assert.rejects(searchDemandSources("topic", "", fetcher), /not configured/);
  await assert.rejects(searchDemandSources("topic", "test-key", fetcher), /unavailable/);
  await assert.rejects(searchDemandSources("x".repeat(201), "test-key", fetcher), /1–200/);
});

test("caps the number of public source records", () => {
  const results = Array.from({ length: 20 }, (_, i) => ({ title: "Source " + i, url: "https://example.com/" + i }));
  assert.equal(normalizeDemandSources({ web: { results } }).length, 8);
});
