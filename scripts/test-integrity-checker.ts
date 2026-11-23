import { ContentIntegrityChecker } from "../server/contentIntegrityService";
import {
  sanitizeSentenceSpacing,
  sanitizeAndRepairMarkdown,
  sanitizeCorporateAiPhrases,
  repairThreadPart
} from "../src/lib/contentSanitizer";

console.log("=== THREADSWORKS CONTENT GENERATION & INTEGRITY TEST SUITE ===");

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`[FAIL] ${testName} - ${detail || "Condition not met"}`);
  }
}

// 1. Spacing Tests
const spacedPunctuation = sanitizeSentenceSpacing("Here is a sentence.Next sentence starts here.");
assert(spacedPunctuation.includes(". Next"), "Punctuation period spacing repaired", spacedPunctuation);

const spacedComma = sanitizeSentenceSpacing("First item,second item,third item.");
assert(spacedComma.includes(", second item, third item."), "Comma spacing repaired without breaking numbers", spacedComma);

const numberCommaPreserved = sanitizeSentenceSpacing("We reached 10,000 views and $5,000 revenue.");
assert(numberCommaPreserved.includes("10,000") && numberCommaPreserved.includes("$5,000"), "Number commas preserved", numberCommaPreserved);

// 2. Markdown Corruption Repair Tests
const mdCorrupted = "Here is the key Demonstration**.";
const mdRepaired = sanitizeAndRepairMarkdown(mdCorrupted);
assert(mdRepaired === "Here is the key Demonstration.", "Markdown corruption Demonstration**. repaired", mdRepaired);

const mdUnmatched = "This is *partially formatted text and **another broken part.";
const mdRepairedUnmatched = sanitizeAndRepairMarkdown(mdUnmatched);
assert(!mdRepairedUnmatched.includes("**") && !mdRepairedUnmatched.includes("*"), "Unmatched asterisks cleanly resolved", mdRepairedUnmatched);

// 3. Corporate AI Phrases Cleaned
const corporateAiText = "This predictable engine systematically eliminates friction and clears administrative bottlenecks to scale your impact.";
const { cleanText: humanizedText, replacedCount } = sanitizeCorporateAiPhrases(corporateAiText);
assert(replacedCount >= 3, "Corporate AI phrases detected and replaced count >= 3", `Count: ${replacedCount}`);
assert(!humanizedText.includes("systematically eliminates friction"), "Eliminated 'systematically eliminates friction'", humanizedText);
assert(!humanizedText.includes("administrative bottlenecks"), "Eliminated 'administrative bottlenecks'", humanizedText);
assert(!humanizedText.includes("scale your impact"), "Eliminated 'scale your impact'", humanizedText);

// 4. Broken fragments and random characters
const brokenPostText = "We show you how to claim s. This is proven because";
const { cleanText: cleanedRandom } = ContentIntegrityChecker.cleanRandomCharacters(brokenPostText);
assert(!cleanedRandom.includes("claim s."), "Broken 'claim s.' removed or repaired", cleanedRandom);

const { resolvedText } = ContentIntegrityChecker.resolveFragmentedThoughts(cleanedRandom);
assert(!resolvedText.endsWith("because"), "Dangling 'because' resolved", resolvedText);

// 5. Full Post Verification and Repair
const mockPost = {
  title: "Growth Strategy",
  hook: "Why most creators fail to get clients on Threads.",
  singlePost: "Why most creators fail to get clients on Threads.Demonstration**.\n\nThey face administrative bottlenecks,and try to scale your impact with generic tips.",
  threadParts: [
    "Why most creators fail to get clients on Threads.Demonstration**.",
    "They face administrative bottlenecks,and try to scale your impact with generic tips.",
    "Here is the simple 3-part framework:clarify your core offer,write for one person,and invite a direct response.",
    "If you want our notes for creators,reply 'GUIDE' below and I will send them over."
  ]
};

const result = ContentIntegrityChecker.verifyAndRepairPost(mockPost, {
  charLimit: 480,
  expectedHook: "Why most creators fail to get clients on Threads."
});

assert(result.post.threadParts![0] === "Why most creators fail to get clients on Threads.", "Part 1 is the hook alone", result.post.threadParts![0]);
assert(!result.post.threadParts![0].includes("**"), "No markdown corruption in Part 1", result.post.threadParts![0]);
assert(!result.post.threadParts![1].includes("administrative bottlenecks"), "No administrative bottlenecks in Part 2", result.post.threadParts![1]);
assert(result.post.threadParts![1].includes(", and"), "Comma spacing repaired in Part 2", result.post.threadParts![1]);
assert(result.report.passed === true, "Integrity report passed is true");
assert(result.report.score >= 85, "Integrity report score >= 85", `Score: ${result.report.score}`);

console.log(`\nResults: ${passedTests}/${totalTests} tests passed.`);
if (passedTests === totalTests) {
  console.log("ALL INTEGRITY AND CONTENT ARCHITECTURE TESTS PASSED!");
  process.exit(0);
} else {
  console.error("SOME TESTS FAILED!");
  process.exit(1);
}
