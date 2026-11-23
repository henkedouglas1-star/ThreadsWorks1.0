import fs from "fs";

const raw = fs.readFileSync("scripts/live_8_posts_result.json", "utf-8");
const data = JSON.parse(raw);
const posts: any[] = data.posts || [];

console.log("================================================================================");
console.log("=== 8-POST LIVE GENERATION VERIFICATION AUDIT ===");
console.log("================================================================================");
console.log(`Generator Version: ${data.generatorVersion}`);
console.log(`Request ID: ${data.requestId}`);
console.log(`Total Posts: ${posts.length}\n`);

const PLANNING_LABELS = [
  "Contrarian perspective",
  "Operator Economics",
  "Archive Reusability",
  "Feedback Loop Mechanism",
  "Reader Outcome Bridge",
  "Implementation Speed",
  "Simplicity Over Complexity",
  "Attention Economics",
  "Conversational Voice Calibration",
  "Topic Repertoire Expansion",
  "Strategic Lens",
  "Central Thesis",
  "Step 1: Identify",
  "POST SPECIFICATION",
  "Hook Pattern",
  "Target Format"
];

let urlCtaCount = 0;
let softCtaCount = 0;
let noCtaCount = 0;

posts.forEach((p, idx) => {
  const postNum = idx + 1;
  const parts: string[] = p.threadParts || [p.singlePost];
  const fullText = parts.join("\n\n---\n\n");
  const urls = fullText.match(/https?:\/\/[^\s)]+/g) || [];

  console.log("--------------------------------------------------------------------------------");
  console.log(`POST ${postNum} / 8: [${p.structuralFormat || (parts.length > 1 ? "thread" : "single")}] "${p.title}"`);
  console.log(`Hook: "${p.hook}"`);
  console.log(`Parts Count: ${parts.length}`);
  console.log(`Part Lengths: ${parts.map((pt, i) => `Part ${i + 1}: ${pt.length} chars`).join(", ")}`);
  console.log(`Max Part Length: ${Math.max(...parts.map(pt => pt.length))} chars (Platform Limit: 500)`);
  console.log(`URLs: ${urls.length ? urls.join(", ") : "None"}`);
  console.log(`CTA property: "${p.cta || ""}"`);

  // Planning labels / instruction leakage check
  const foundLabels = PLANNING_LABELS.filter(l => fullText.toLowerCase().includes(l.toLowerCase()));
  console.log(`Planning Labels / Prompt Leakage: ${foundLabels.length === 0 ? "CLEAN (0 found)" : "DETECTED: " + foundLabels.join(", ")}`);

  // CTA classification
  const lastPart = parts[parts.length - 1];
  if (urls.length > 0) {
    urlCtaCount++;
    console.log("CTA Classification: Direct Verified URL Destination");
  } else if (/\?/.test(lastPart) || /reply|comment|share below|tell me|thoughts/i.test(lastPart)) {
    softCtaCount++;
    console.log("CTA Classification: Conversational Value Question / Engagement");
  } else {
    noCtaCount++;
    console.log("CTA Classification: Non-promotional Concluding Observation");
  }

  console.log("\nFULL POST CONTENT:");
  parts.forEach((pt, pIdx) => {
    console.log(`[Part ${pIdx + 1}] (${pt.length} chars):\n${pt}\n`);
  });
});

console.log("================================================================================");
console.log("BATCH-WIDE SUMMARY & CRITERIA VERIFICATION:");
console.log(`- Direct URL CTAs: ${urlCtaCount}`);
console.log(`- Conversational / Question CTAs: ${softCtaCount}`);
console.log(`- Non-promotional Closings: ${noCtaCount}`);
console.log(`- Total Posts with Max Chars <= 500: ${posts.every(p => (p.threadParts || [p.singlePost]).every(pt => pt.length <= 500)) ? "YES (100% compliant)" : "NO"}`);
console.log(`- Total Unique Titles / Subjects: ${new Set(posts.map(p => p.title)).size} / ${posts.length}`);
console.log(`- Total Unique Hooks: ${new Set(posts.map(p => p.hook)).size} / ${posts.length}`);
console.log("================================================================================");
