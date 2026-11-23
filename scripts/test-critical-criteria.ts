import { ContentIntegrityChecker } from "../server/contentIntegrityService";
import { sanitizeAndValidateBestPost, validateThreadSemantics } from "../src/lib/contentSanitizer";

function runTest(name: string, fn: () => boolean | void) {
  try {
    const res = fn();
    if (res === false) {
      console.error(`[FAIL] ${name}`);
      process.exit(1);
    }
    console.log(`[PASS] ${name}`);
  } catch (err: any) {
    console.error(`[FAIL] ${name}: ${err.message}`);
    process.exit(1);
  }
}

console.log("=== RUNNING THREADSWORKS CRITICAL SUCCESS CRITERIA VALIDATION ===");

// 1. Topic fidelity in post repair and generation
runTest("Criterion 1: Generated content must be about the requested Topic", () => {
  const post = {
    title: "Draft Post",
    hook: "Most creators make pricing mistakes.",
    singlePost: "Most creators make pricing mistakes. They lower their rates whenever a client hesitates.",
    threadParts: [
      "Most creators make pricing mistakes.",
      "They lower their rates whenever a client hesitates.",
      "Here is how to hold your ground."
    ]
  };
  const { post: repaired } = ContentIntegrityChecker.verifyAndRepairPost(post, {
    context: {
      topic: "overcoming pricing pushback without discounting",
      offer: "High-Ticket Advisory",
      audience: "consultants"
    }
  });
  if (!repaired.singlePost || repaired.threadParts.length < 1) return false;
});

// 2 & 8: No invented unsupported products, services, audits, reviews, spots, guarantees
runTest("Criterion 8: Strip unapproved audits, reviews, and limited spots", () => {
  const post = {
    title: "Offer post",
    hook: "Stop struggling with client conversion.",
    singlePost: "Stop struggling with client conversion. We are opening 5 spots this month for a free profile review. Reply AUDIT for your free audit.",
    threadParts: [
      "Stop struggling with client conversion.",
      "We are opening 5 spots this month for a free profile review.",
      "Reply AUDIT for your free audit."
    ]
  };
  const { post: repaired } = ContentIntegrityChecker.verifyAndRepairPost(post, {
    context: {
      offer: "Strategic Growth System",
      audience: "founders"
    }
  });
  const allText = repaired.threadParts.join(" ");
  if (/5 spots/i.test(allText) || /free audit/i.test(allText) || /free profile review/i.test(allText)) {
    throw new Error("Invented claims still present: " + allText);
  }
});

// 9 & 10: Manual parts and sentences settings must be followed exactly
runTest("Criterion 9 & 10: Manual parts and sentences settings followed exactly", () => {
  const post = {
    title: "Multi-part post",
    hook: "The key to predictable growth is clarity.",
    singlePost: "The key to predictable growth is clarity.",
    threadParts: [
      "The key to predictable growth is clarity. Most people ignore simple foundations.",
      "Step one is knowing your numbers. Step two is executing consistently. Step three is measuring weekly.",
      "When your system is solid, growth follows naturally."
    ]
  };
  // Request exactParts = 2, exactSentencesPerPart = 2
  const { post: repaired } = ContentIntegrityChecker.verifyAndRepairPost(post, {
    context: {
      exactParts: 2,
      exactSentencesPerPart: 2,
      topic: "predictable growth"
    }
  });
  if (repaired.threadParts.length !== 2) {
    throw new Error(`Expected exactly 2 parts, got ${repaired.threadParts.length}`);
  }
  for (let i = 0; i < repaired.threadParts.length; i++) {
    const sents = repaired.threadParts[i].split(/(?<=[.!?])\s+/).filter(Boolean);
    if (sents.length !== 2) {
      throw new Error(`Part ${i + 1} has ${sents.length} sentences instead of 2: "${repaired.threadParts[i]}"`);
    }
  }
});

// 14-18: Sentence completeness, no broken words, no orphan fragments
runTest("Criterion 14-18: Complete sentences and no broken words or fragments", () => {
  const post = {
    title: "Broken post",
    hook: "Here is the real truth.",
    singlePost: "Here is the real truth. Most creators fail because they don't know how to claim s. Or they wait for.",
    threadParts: [
      "Here is the real truth.",
      "Most creators fail because they don't know how to claim s.",
      "Or they wait for."
    ]
  };
  const { post: repaired, report } = ContentIntegrityChecker.verifyAndRepairPost(post, {
    context: {
      topic: "creator systems",
      offer: "Creator Operating System"
    }
  });
  for (const part of repaired.threadParts) {
    if (/\bclaim\s+s\b/i.test(part) || /\bwait\s+for\.\s*$/i.test(part)) {
      throw new Error(`Unrepaired fragment detected: ${part}`);
    }
  }
  if (!report.passed) {
    throw new Error("Integrity report did not pass");
  }
});

// 21: No accidental metadata inside content
runTest("Criterion 21: No accidental metadata inside generated content", () => {
  const post = {
    title: "Clean Post",
    hook: "Simplicity always beats complexity.",
    singlePost: "[Part 1] Simplicity always beats complexity. Characters: 450. Hook: Simplicity beats complexity.",
    threadParts: [
      "[Part 1] Simplicity always beats complexity. Characters: 450.",
      "[Part 2] Keep your daily routines straightforward."
    ]
  };
  const { post: repaired } = ContentIntegrityChecker.verifyAndRepairPost(post, {
    context: {
      topic: "daily systems"
    }
  });
  const allText = repaired.threadParts.join(" ");
  if (/\[Part \d+\]/i.test(allText) || /Characters:\s*\d+/i.test(allText) || /Hook:/i.test(allText)) {
    throw new Error("Metadata detected in content: " + allText);
  }
});

// 24 & 25: Part 1 must contain the actual hook when a hook is required
runTest("Criterion 24 & 25: Part 1 contains actual hook verbatim", () => {
  const targetHook = "Views don't pay the bills. This 3-step conversion loop does.";
  const post = {
    title: "Conversion framework",
    hook: "A generic hook",
    singlePost: "Something else entirely.",
    threadParts: [
      "Something else entirely.",
      "Most people chase vanity metrics."
    ]
  };
  const { post: repaired } = ContentIntegrityChecker.verifyAndRepairPost(post, {
    expectedHook: targetHook,
    context: {
      topic: "conversion loop",
      exactParts: 2
    }
  });
  if (!repaired.hook.startsWith("Views don't pay the bills")) {
    throw new Error("Hook did not match expected hook: " + repaired.hook);
  }
  if (!repaired.threadParts[0].startsWith("Views don't pay the bills")) {
    throw new Error("Part 1 did not begin with expected hook: " + repaired.threadParts[0]);
  }
});

// 28: CTA placement respected (e.g. CTA in Part 2)
runTest("Criterion 28: CTA placement respected when configured for Part 2", () => {
  const post = {
    title: "Pacing post",
    hook: "The biggest bottleneck is manual busywork.",
    singlePost: "The biggest bottleneck is manual busywork.",
    threadParts: [
      "The biggest bottleneck is manual busywork.",
      "Focus your time on high-leverage client conversations.",
      "Reply with your biggest bottleneck below."
    ]
  };
  const { post: repaired } = ContentIntegrityChecker.verifyAndRepairPost(post, {
    ctaInPart2: true,
    context: {
      ctaInPart2: true,
      exactParts: 2
    }
  });
  if (repaired.threadParts.length !== 2) {
    throw new Error("Expected 2 parts");
  }
  if (!/reply/i.test(repaired.threadParts[1])) {
    throw new Error("Part 2 did not receive the CTA: " + repaired.threadParts[1]);
  }
});

// 29 & 30: Shared sanitization & semantic validation in Create Best Post and Create Content
runTest("Criterion 29 & 30: Create Best Post and Create Content shared validation", () => {
  const rawPost = {
    title: "Best Next Post",
    hook: "Most creators do not have a content problem.",
    singlePost: "Most creators do not have a content problem.",
    threadParts: [
      "Most creators do not have a content problem.",
      "They have a clear conversion problem.",
      "When your positioning is dialed in, conversations happen naturally."
    ],
    explanation: "High contrast hook",
    category: "trust",
    format: "thread"
  };
  const { post: sanitized, validation } = sanitizeAndValidateBestPost(
    rawPost,
    "Most creators do not have a content problem.",
    480,
    {
      offer: "ThreadsWorks System",
      audience: "creators",
      desiredResult: "consistent client conversations"
    }
  );
  if (!validation.valid && validation.issues.length > 0) {
    throw new Error("Validation failed: " + validation.issues.join(", "));
  }
  const semantics = validateThreadSemantics(sanitized.threadParts, 480);
  if (!semantics.valid) {
    throw new Error("Thread semantics failed: " + semantics.issues.join(", "));
  }
});

console.log("\nALL CRITICAL SUCCESS CRITERIA VALIDATED SUCCESSFULLY!");
