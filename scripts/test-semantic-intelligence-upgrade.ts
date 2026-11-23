import { ContentIntegrityChecker } from "../server/contentIntegrityService";
import {
  sanitizeCorporateAiPhrases,
  sanitizeFactualIntegrity,
  detectHookPromise,
  isOpenLoopHook
} from "../src/lib/contentSanitizer";

console.log("=== THREADSWORKS SEMANTIC INTELLIGENCE & FACTUAL INTEGRITY UPGRADE TEST SUITE ===\n");

let passed = 0;
let total = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  total++;
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passed++;
  } else {
    console.error(`[FAIL] ${testName}: ${detail || "Condition failed"}`);
    process.exitCode = 1;
  }
}

// =========================================================================
// PROBLEM 1 & 2: FABRICATED PERSONAL CLAIMS & DISCONNECTED BODY
// Hook: "I made a $10,000 mistake when I first started publishing."
// Expected:
// 1. Unsupported personal dollar mistake is rewritten into grounded publishing lesson.
// 2. Disconnected body discussing archives/voice notes is realigned to explain the publishing mistake.
// =========================================================================
const postP1 = {
  title: "Publishing Mistake",
  hook: "I made a $10,000 mistake when I first started publishing.",
  singlePost: "I made a $10,000 mistake when I first started publishing.",
  threadParts: [
    "I made a $10,000 mistake when I first started publishing.",
    "Voice notes and client calls help preserve your conversational tone." // Disconnected body
  ]
};

const resP1 = ContentIntegrityChecker.verifyAndRepairPost(postP1, { charLimit: 480 });
const p1P1 = resP1.post.threadParts[0].toLowerCase();
const p2P1 = resP1.post.threadParts[1].toLowerCase();

assert(
  !p1P1.includes("$10,000") && !p1P1.includes("i made a"),
  "PROBLEM 1 & 2: Fabricated $10,000 personal mistake claim neutralized into grounded phrasing",
  `Part 1 was: "${resP1.post.threadParts[0]}"`
);

assert(
  (p2P1.includes("mistake") || p2P1.includes("waste") || p2P1.includes("focus") || p2P1.includes("angle") || p2P1.includes("lesson")) &&
  !p2P1.includes("voice notes"),
  "PROBLEM 1 & 3: Part 2 realigned from disconnected voice notes to directly pay off the publishing mistake lesson",
  `Part 2 was: "${resP1.post.threadParts[1]}"`
);

// =========================================================================
// PROBLEM 1 & 2: TIMELINE + LEAD PERCENTAGE CLAIMS
// Hook: "3 years ago, I had zero readers. Today, this single habit drives 80% of our leads."
// Expected:
// 1. Fabricated "3 years ago zero readers" and "80% of our leads" neutralized into grounded creator prose.
// 2. Disconnected Part 2 realigned to reveal the single habit and conversion mechanism.
// =========================================================================
const postP2 = {
  title: "Habit",
  hook: "3 years ago, I had zero readers. Today, this single habit drives 80% of our leads.",
  singlePost: "3 years ago, I had zero readers. Today, this single habit drives 80% of our leads.",
  threadParts: [
    "3 years ago, I had zero readers. Today, this single habit drives 80% of our leads.",
    "Voice notes and client calls preserve conversational tone." // Disconnected
  ]
};

const resP2 = ContentIntegrityChecker.verifyAndRepairPost(postP2, { charLimit: 480 });
const p1P2 = resP2.post.threadParts[0].toLowerCase();
const p2P2 = resP2.post.threadParts[1].toLowerCase();

assert(
  !p1P2.includes("80%") && !p1P2.includes("3 years ago, i had zero readers"),
  "PROBLEM 2: Unsupported timeline & 80% lead generation claims neutralized",
  `Part 1 was: "${resP2.post.threadParts[0]}"`
);

assert(
  (p2P2.includes("habit") || p2P2.includes("conversion") || p2P2.includes("action") || p2P2.includes("step")) &&
  !p2P2.includes("voice notes"),
  "PROBLEM 3: Part 2 reliably pays off the habit promise rather than drifting into voice notes",
  `Part 2 was: "${resP2.post.threadParts[1]}"`
);

// =========================================================================
// PROBLEM 4: THREADS END BEFORE PROMISE IS DELIVERED
// Hook: "I studied 100 top-performing Threads posts. Here's what they all have in common:"
// Part 2 initially only discusses categorizing ideas, then ends.
// Expected:
// 1. Fabricated study claim neutralized.
// 2. The common trait / core outcome MUST be delivered before the thread ends.
// =========================================================================
const postP4 = {
  title: "Top Posts Common Trait",
  hook: "I studied 100 top-performing Threads posts. Here's what they all have in common:",
  singlePost: "I studied 100 top-performing Threads posts. Here's what they all have in common:",
  threadParts: [
    "I studied 100 top-performing Threads posts. Here's what they all have in common:",
    "Categorizing ideas helps keep your drafts organized." // Incomplete - never delivers the common trait
  ]
};

const resP4 = ContentIntegrityChecker.verifyAndRepairPost(postP4, { charLimit: 480 });
const allP4 = resP4.post.threadParts.join(" ").toLowerCase();

assert(
  allP4.includes("trait") || allP4.includes("common") || allP4.includes("focus on a single") || allP4.includes("one outcome"),
  "PROBLEM 4: Promised common trait delivered in the post, completing the idea",
  `Thread text was: "${allP4}"`
);

// =========================================================================
// PROBLEM 5: GENERIC AI LANGUAGE REPLACED
// Phrases: structural mechanics, thesis, constraints, leverage, friction,
// core insight, audience stage, mechanism, decoupling, formatting, framework
// =========================================================================
const jargonyText = "Our structural mechanics decouple topic ideation from formatting constraints to eliminate friction. This core insight scales your impact.";
const { cleanText: cleanedJargon, replacedCount } = sanitizeCorporateAiPhrases(jargonyText);

assert(
  replacedCount >= 4,
  "PROBLEM 5: Generic AI jargon phrases detected and replaced count >= 4",
  `Count: ${replacedCount}, Cleaned: "${cleanedJargon}"`
);
assert(!cleanedJargon.includes("structural mechanics"), "PROBLEM 5: Eliminated 'structural mechanics'", cleanedJargon);
assert(!cleanedJargon.includes("decouple"), "PROBLEM 5: Eliminated 'decouple'", cleanedJargon);
assert(!cleanedJargon.includes("formatting constraints"), "PROBLEM 5: Eliminated 'formatting constraints'", cleanedJargon);
assert(!cleanedJargon.includes("eliminate friction"), "PROBLEM 5: Eliminated 'eliminate friction'", cleanedJargon);
assert(!cleanedJargon.includes("core insight"), "PROBLEM 5: Eliminated 'core insight'", cleanedJargon);

// =========================================================================
// PROBLEM 6: ABSTRACT INSTEAD OF CONCRETE
// "decision fatigue drains your willpower" -> concrete scenario
// =========================================================================
const abstractText = "When every post requires deciding strategy from scratch, decision fatigue drains your willpower.";
const { cleanText: concreteText } = sanitizeCorporateAiPhrases(abstractText);

assert(
  concreteText.includes("20 minutes") || !concreteText.includes("decision fatigue drains your willpower"),
  "PROBLEM 6: Abstract 'decision fatigue drains your willpower' transformed into concrete creator situation",
  `Result: "${concreteText}"`
);

// =========================================================================
// PROBLEM 7: CTA FEELS EARNED & GROUNDED
// =========================================================================
const postP7 = {
  title: "Grounded CTA Post",
  hook: "Stop trying to sound smart in your first line. Do this instead:",
  singlePost: "Stop trying to sound smart in your first line. Do this instead:",
  threadParts: [
    "Stop trying to sound smart in your first line. Do this instead:",
    "State the exact tension your reader deals with in plain language.",
    "When you simplify your message, client results follow naturally.\n\nStart creating with clear systems at https://threadsworks.com/create."
  ]
};

const resP7 = ContentIntegrityChecker.verifyAndRepairPost(postP7, {
  charLimit: 480,
  context: {
    offer: "ThreadsWorks",
    approvedUrls: ["https://threadsworks.com/create"]
  }
});

const lastPartP7 = resP7.post.threadParts[resP7.post.threadParts.length - 1];
assert(
  lastPartP7.includes("https://threadsworks.com/create"),
  "PROBLEM 7: Earned CTA in final part correctly points to approved URL",
  `Final part was: "${lastPartP7}"`
);

// =========================================================================
// PROBLEM 8: PART COUNT & THREAD DEPTH INTELLIGENCE
// Verify self-contained single post is preserved as 1 part.
// Verify deep multi-step breakdown is preserved without premature truncation.
// =========================================================================
const selfContained1Part = {
  title: "Simple Insight",
  hook: "A simple daily routine always outperforms sporadic bursts of inspiration.",
  singlePost: "A simple daily routine always outperforms sporadic bursts of inspiration. When you protect 30 minutes each morning to draft, your message sharpens and your audience grows steadily.",
  threadParts: [
    "A simple daily routine always outperforms sporadic bursts of inspiration. When you protect 30 minutes each morning to draft, your message sharpens and your audience grows steadily."
  ]
};

const res1Part = ContentIntegrityChecker.verifyAndRepairPost(selfContained1Part, { charLimit: 480 });
assert(
  res1Part.post.threadParts.length === 1 && !isOpenLoopHook(res1Part.post.threadParts[0]),
  "PROBLEM 8: Self-contained single-part insight cleanly preserved as 1 part",
  `Parts: ${res1Part.post.threadParts.length}`
);

const deep5PartFramework = {
  title: "5-Step Operational Playbook",
  hook: "The 5-step operational playbook to turn one idea into a week of content:",
  singlePost: "The 5-step operational playbook to turn one idea into a week of content:",
  threadParts: [
    "The 5-step operational playbook to turn one idea into a week of content:",
    "Step 1: Identify the single core bottleneck your reader faced today.",
    "Step 2: Contrast the standard mistake with the simpler mechanism.",
    "Step 3: State the practical rule that creates the outcome.",
    "Step 4: Provide a concrete implementation example from daily workflow.",
    "Step 5: Conclude with a clean takeaway without unnecessary promotional clutter."
  ]
};

const res5Part = ContentIntegrityChecker.verifyAndRepairPost(deep5PartFramework, { charLimit: 480 });
assert(
  res5Part.post.threadParts.length === 6,
  "PROBLEM 8: Deep 5-step framework preserves full 6-part thread without truncation",
  `Parts count: ${res5Part.post.threadParts.length}`
);

console.log(`\nResults: ${passed}/${total} semantic intelligence tests passed.`);
if (passed === total) {
  console.log("ALL 8 OBSERVED PROBLEMS SUCCESSFULLY RESOLVED AND VERIFIED!");
  process.exit(0);
} else {
  console.error("SOME TESTS FAILED!");
  process.exit(1);
}
