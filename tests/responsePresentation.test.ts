import { test } from "node:test";
import assert from "node:assert/strict";
import { parseInline, parseReport, reportToHtml } from "../src/utils/responsePresentation";

test("formats the heading, bold and bullet syntax seen in generated reports", () => {
  assert.deepEqual(parseReport("#### Testing revenue\n* **Question:** What would help?\n* Another question"), [
    { kind: "heading", text: "Testing revenue" },
    { kind: "list", ordered: false, items: ["**Question:** What would help?", "Another question"] }
  ]);
  assert.deepEqual(parseInline("**Question:** What would help?"), [
    { kind: "strong", text: "Question:" }, { kind: "text", text: " What would help?" }
  ]);
});

test("renders comparisons as tables and numbered steps as lists", () => {
  const blocks = parseReport("1. First\n2. Second\n\n| Option | Cost |\n| --- | --- |\n| A | $5 |");
  assert.deepEqual(blocks, [
    { kind: "list", ordered: true, items: ["First", "Second"] },
    { kind: "table", headers: ["Option", "Cost"], rows: [["A", "$5"]] }
  ]);
});

test("HTML export escapes model and user supplied HTML", () => {
  const html = reportToHtml("## <script>alert(1)</script>\n* **<img src=x onerror=alert(1)>**");
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("<strong>&lt;img"));
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<img"));
});

test("handles empty responses and preserves unrecognized text", () => {
  assert.deepEqual(parseReport(" \n "), []);
  assert.deepEqual(parseReport("Price: $7/month\nUnclosed **bold"), [
    { kind: "paragraph", text: "Price: $7/month" },
    { kind: "paragraph", text: "Unclosed **bold" }
  ]);
});
