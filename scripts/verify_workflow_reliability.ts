import { ContentIntegrityChecker } from "../server/contentIntegrityService";
import { cleanTopicString } from "../src/lib/contentSanitizer";
import { applyMyLinksToPost } from "../server/myLinksService";

console.log("=== THREADSWORKS CORE WORKFLOW RELIABILITY & REGRESSION PROTECTION TEST ===");

// 1. Verify cleanTopicString strips raw command wrappers
const rawPrompt1 = "Create 5 posts explaining how to audit your profile for higher conversion";
const cleaned1 = cleanTopicString(rawPrompt1);
console.log(`[Test 1] Cleaned Topic: "${cleaned1}"`);
if (cleaned1.toLowerCase().includes("create 5 posts") || cleaned1.toLowerCase().includes("explaining")) {
  throw new Error(`Test 1 Failed: Raw command prefix not stripped: ${cleaned1}`);
}
console.log("[PASS] Test 1: Command prefix stripped from content request");

// 2. Verify "80% of content creators quit" is neutralized
const statPost = {
  title: "Consistency",
  hook: "80% of content creators quit within their first three months.",
  singlePost: "80% of content creators quit within their first three months. Publishing without clear feedback creates fatigue. Focus on a single repeatable format.",
  threadParts: ["80% of content creators quit within their first three months. Publishing without clear feedback creates fatigue. Focus on a single repeatable format."]
};
const { post: repairedStat } = ContentIntegrityChecker.verifyAndRepairPost(statPost);
console.log(`[Test 2] Repaired Stat Post: "${repairedStat.singlePost}"`);
if (repairedStat.singlePost?.includes("80%")) {
  throw new Error(`Test 2 Failed: "80%" was not neutralized: ${repairedStat.singlePost}`);
}
console.log("[PASS] Test 2: Unsupported '80% of content creators quit' neutralized");

// 3. Verify invented shift times, weekly hours, and tool switching lore neutralized
const inventedLorePost = {
  title: "My Journey",
  hook: "When I worked 12-hour shifts at the hospital, I had zero energy.",
  singlePost: "When I worked 12-hour shifts at the hospital, I had zero energy.\n\nI was working 80 hours a week and switched from Notion to Buffer before realizing the real bottleneck.\n\nIt saved me 15 hours a week once I simplified my publishing process.",
  threadParts: [
    "When I worked 12-hour shifts at the hospital, I had zero energy.",
    "I was working 80 hours a week and switched from Notion to Buffer before realizing the real bottleneck.",
    "It saved me 15 hours a week once I simplified my publishing process."
  ]
};
const { post: repairedLore } = ContentIntegrityChecker.verifyAndRepairPost(inventedLorePost);
console.log(`[Test 3] Repaired Lore Parts:`, repairedLore.threadParts);
for (const part of repairedLore.threadParts || []) {
  if (/12-hour shifts|80 hours a week|switched from Notion|saved me 15 hours/i.test(part)) {
    throw new Error(`Test 3 Failed: Invented personal lore leaked: "${part}"`);
  }
}
console.log("[PASS] Test 3: Invented shifts, weekly hours, tool switching, and time savings neutralized");

// 4. Verify Perspective / Direction internal labels are purged
const metaLeakedPost = {
  title: "Perspective 27 - Profile Strategy",
  hook: "Direction 1: Profile clarity determines your follower conversion rate.",
  singlePost: "Direction 1: Profile clarity determines your follower conversion rate.\n\nPerspective 27: When your bio states the exact mechanism, readers understand immediately.",
  threadParts: [
    "Direction 1: Profile clarity determines your follower conversion rate.",
    "Perspective 27: When your bio states the exact mechanism, readers understand immediately."
  ]
};
const { post: repairedMeta } = ContentIntegrityChecker.verifyAndRepairPost(metaLeakedPost);
console.log(`[Test 4] Repaired Meta Parts:`, repairedMeta.threadParts);
for (const part of repairedMeta.threadParts || []) {
  if (/Perspective 27|Direction 1/i.test(part)) {
    throw new Error(`Test 4 Failed: Internal label leaked: "${part}"`);
  }
}
console.log("[PASS] Test 4: Internal metadata ('Perspective 27', 'Direction 1') purged");

// 5. Verify Single Post with open loop hook is completed (not left as solitary hook)
const solitaryHookPost = {
  title: "Writing Advice",
  hook: "Stop trying to sound smart in your first line. Do this instead:",
  singlePost: "Stop trying to sound smart in your first line. Do this instead:",
  threadParts: ["Stop trying to sound smart in your first line. Do this instead:"]
};
const { post: repairedHookOnly } = ContentIntegrityChecker.verifyAndRepairPost(solitaryHookPost);
console.log(`[Test 5] Repaired Single Post with open loop:`, repairedHookOnly.threadParts);
if (repairedHookOnly.threadParts && repairedHookOnly.threadParts.length === 1 && repairedHookOnly.threadParts[0].trim().endsWith(":")) {
  throw new Error("Test 5 Failed: Single post remains solitary unfulfilled hook ending in colon!");
}
console.log("[PASS] Test 5: Open-loop hook expanded/completed with explanation");

// 6. Verify duplicate CTA stacking prevention in myLinksService
const postWithExistingCta = {
  title: "Core Offer",
  hook: "A clear standard makes your primary message connect immediately.",
  singlePost: "A clear standard makes your primary message connect immediately.\n\nStart putting ThreadsWorks to work for your business at https://threadsworks.com/pricing.",
  threadParts: [
    "A clear standard makes your primary message connect immediately.",
    "Start putting ThreadsWorks to work for your business at https://threadsworks.com/pricing."
  ]
};
const { repairedPost } = applyMyLinksToPost(
  postWithExistingCta,
  [{ id: "1", name: "ThreadsWorks Pro Membership Upgrade ($7/month)", url: "https://threadsworks.com/pricing" }]
);
console.log(`[Test 6] Final thread parts with destination:`, repairedPost.threadParts);
const lastPart = repairedPost.threadParts[repairedPost.threadParts.length - 1];
// Count occurrences of pricing URL in last part
const urlMatches = lastPart.match(/https:\/\/threadsworks\.com\/pricing/g);
if (urlMatches && urlMatches.length > 1) {
  throw new Error(`Test 6 Failed: Duplicate URL / CTA stacked in post: ${lastPart}`);
}
if (/Start putting.*If you want to build/is.test(lastPart)) {
  throw new Error(`Test 6 Failed: Stacked duplicate CTA sentences in post: ${lastPart}`);
}
console.log("[PASS] Test 6: Zero duplicate stacked CTAs; clean single CTA applied");

console.log("\nALL 6 WORKFLOW RELIABILITY & REGRESSION PROTECTION TESTS PASSED!");
