import fetch from "node-fetch";

async function runAdversarialVerification() {
  console.log("=== THREADSWORKS 32-POST ADVERSARIAL VERIFICATION RUN ===");
  const startTime = Date.now();

  const payload = {
    topic: "Turning daily observations and notes into consistent, high-performing Threads posts with ThreadsWorks",
    count: 32,
    category: "attention",
    threadLength: "auto",
    sentencesPerPart: "auto",
    customInstruction: "Audience: creators, solo founders, digital entrepreneurs. Connect to ThreadsWorks where naturally relevant without forcing promotion."
  };

  const response = await fetch("http://localhost:3000/api/generate-posts-batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    console.error("HTTP Error:", response.status, await response.text());
    process.exit(1);
  }

  const data = (await response.json()) as any;
  const posts = data.posts || [];
  console.log(`Successfully received ${posts.length} production posts in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

  if (posts.length !== 32) {
    console.error(`Expected 32 posts, received ${posts.length}`);
  }

  // Tracking Metrics
  const partCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 };
  
  const angleTitleLeaks: string[] = [];
  const planningMetadataLeaks: string[] = [];
  const unsupportedTechnicalExplanations: string[] = [];
  const unsupportedQuantifiedClaims: string[] = [];
  const unsupportedFactualClaims: string[] = [];
  const unsupportedComparativeClaims: string[] = [];
  const invalidNumberedSequences: string[] = [];
  const malformedQuotations: string[] = [];
  const forcedProductMentions: string[] = [];
  const exactDuplicates: string[] = [];
  const nearDuplicates: string[] = [];
  const ctaDuplicates: string[] = [];
  const partsOver500: string[] = [];
  const incompleteSentences: string[] = [];
  const humanEditorFlags: string[] = [];

  let threadsWorksMentions = 0;
  let nonProductPosts = 0;
  let ctaPosts = 0;
  let noCtaPosts = 0;

  // Pattern sets for adversarial checks
  const AI_TECH_EXPLANATION_PATTERNS = [
    /\bpulls the mathematical average\b/i,
    /\bstarts with complete amnesia\b/i,
    /\bhow the algorithm works\b/i,
    /\bthreads ranking algorithm\b/i,
    /\bneural network predicts\b/i,
    /\blarge language models calculate\b/i
  ];

  const UNGROUNDED_QUANTIFIED_OUTCOME_PATTERNS = [
    /\bunder twenty minutes\b/i,
    /\bin 20 minutes\b/i,
    /\bin 10 minutes\b/i,
    /\bin under 10 minutes\b/i,
    /\b2x your\b/i,
    /\bdouble your\b/i,
    /\btriple your\b/i,
    /\b50% faster\b/i,
    /\b10x faster\b/i,
    /\bcuts time in half\b/i
  ];

  const UNSUPPORTED_ABSOLUTE_PATTERNS = [
    /\bevery single time\b/i,
    /\bwill always\b/i,
    /\bguaranteed to\b/i,
    /\bwill increase\b/i,
    /\bwill double\b/i,
    /\bwill outperform\b/i,
    /\bmakes people pay attention\b/i,
    /\bcauses audiences to\b/i
  ];

  posts.forEach((post: any, idx: number) => {
    const parts: string[] = post.threadParts || post.parts || [post.singlePost || ""];
    const cnt = parts.length;
    partCounts[cnt] = (partCounts[cnt] || 0) + 1;

    const fullText = parts.join("\n\n");
    const firstPart = parts[0] || "";
    const lastPart = parts[parts.length - 1] || "";

    // CTA vs No-CTA
    const isCta = /\?|explore|check out|share below|let's discuss|if you|how do you|what strategy/i.test(lastPart);
    if (isCta) ctaPosts++;
    else noCtaPosts++;

    // Product Mentions
    const hasProduct = /ThreadsWorks/i.test(fullText);
    if (hasProduct) {
      threadsWorksMentions++;
    } else {
      nonProductPosts++;
    }

    // 1. ANGLE TITLE LEAKS
    // Check if firstPart contains angle title patterns or internal angle title reuse
    if (post.angleTitle) {
      const angleClean = post.angleTitle.trim().toLowerCase();
      const firstClean = firstPart.trim().toLowerCase();
      if (firstClean.startsWith(angleClean) || firstClean.includes(`${angleClean}. here is the breakdown`)) {
        angleTitleLeaks.push(`Post ${idx + 1}: ${firstPart.slice(0, 100)}... (Matched angle: "${post.angleTitle}")`);
      }
    }
    if (/here is the breakdown:/i.test(firstPart) && /^[A-Z][a-z]+ [A-Z]/.test(firstPart)) {
      angleTitleLeaks.push(`Post ${idx + 1}: Editorial title as hook: "${firstPart.slice(0, 80)}"`);
    }

    // 2. INTERNAL METADATA LEAKS
    const metadataFields = [
      post.angleTitle,
      post.subAngle,
      post.strategicObjective,
      post.hookConcept,
      post.coreMechanism,
      post.frameworkName
    ].filter(Boolean);

    metadataFields.forEach((field: string) => {
      if (field && field.length > 12) {
        // Look for exact field string inserted unnatural in sentence
        const normField = field.trim();
        if (fullText.includes(`focus on ${normField}`) || fullText.includes(`using ${normField} consistently`)) {
          planningMetadataLeaks.push(`Post ${idx + 1}: Unnatural metadata insertion: "${normField}" in prose`);
        }
      }
    });

    // Specific generic labels check
    const GENERIC_LABELS = [
      "Your Content Should Get Smarter",
      "Operator Economics",
      "Archive Reusability",
      "Conversational Voice Calibration",
      "Contrarian perspective"
    ];
    GENERIC_LABELS.forEach((label) => {
      if (fullText.includes(label)) {
        planningMetadataLeaks.push(`Post ${idx + 1}: Found strategy label "${label}"`);
      }
    });

    // 3. UNSUPPORTED TECHNICAL EXPLANATIONS
    AI_TECH_EXPLANATION_PATTERNS.forEach((pat) => {
      if (pat.test(fullText)) {
        const match = fullText.match(pat)?.[0];
        unsupportedTechnicalExplanations.push(`Post ${idx + 1}: Tech explanation match "${match}"`);
      }
    });

    // 4. QUANTIFIED OUTCOME CLAIMS
    UNGROUNDED_QUANTIFIED_OUTCOME_PATTERNS.forEach((pat) => {
      if (pat.test(fullText)) {
        const match = fullText.match(pat)?.[0];
        unsupportedQuantifiedClaims.push(`Post ${idx + 1}: Quantified outcome match "${match}"`);
      }
    });

    // 5. STRUCTURAL WRITING ERRORS
    // Check numbered list sequences in parts
    parts.forEach((part, pIdx) => {
      const numMatches = Array.from(part.matchAll(/(?:^|\n)\s*(\d+)[\.\)]\s+/g)).map(m => parseInt(m[1], 10));
      if (numMatches.length > 1) {
        for (let i = 1; i < numMatches.length; i++) {
          if (numMatches[i] !== numMatches[i - 1] + 1) {
            invalidNumberedSequences.push(`Post ${idx + 1} Part ${pIdx + 1}: Non-consecutive numbers [${numMatches.join(", ")}]`);
          }
        }
      }

      // Check unbalanced quotes or parentheses
      const openQuotes = (part.match(/"/g) || []).length;
      if (openQuotes % 2 !== 0) {
        malformedQuotations.push(`Post ${idx + 1} Part ${pIdx + 1}: Unbalanced quotation marks`);
      }

      // Check length > 500
      if (part.length > 500) {
        partsOver500.push(`Post ${idx + 1} Part ${pIdx + 1}: ${part.length} chars (Limit: 500)`);
      }

      // Incomplete sentences
      if (/ [a-z0-9,]+$/i.test(part.trim()) && !/[.!?:]$/.test(part.trim())) {
        incompleteSentences.push(`Post ${idx + 1} Part ${pIdx + 1}: Ends without punctuation: "${part.slice(-30)}"`);
      }
    });

    // 6. PRODUCT RELEVANCE / FORCED PROMOTION
    if (hasProduct) {
      // Check if ThreadsWorks is inserted without context
      const mentions = (fullText.match(/ThreadsWorks/gi) || []).length;
      if (mentions > 3) {
        forcedProductMentions.push(`Post ${idx + 1}: Excessive mentions (${mentions})`);
      }
    }

    // 7. CLAIM GROUNDING / ABSOLUTES
    UNSUPPORTED_ABSOLUTE_PATTERNS.forEach((pat) => {
      if (pat.test(fullText)) {
        const match = fullText.match(pat)?.[0];
        unsupportedFactualClaims.push(`Post ${idx + 1}: Absolute claim match "${match}"`);
      }
    });

    // Check CTA Duplication across parts
    if (parts.length > 1) {
      for (let i = 0; i < parts.length - 1; i++) {
        const p1 = parts[i].trim().toLowerCase();
        const p2 = parts[i + 1].trim().toLowerCase();
        if (p1 === p2) {
          exactDuplicates.push(`Post ${idx + 1}: Part ${i + 1} and Part ${i + 2} are exact duplicates`);
        } else if (p1.length > 20 && p2.includes(p1.slice(-30))) {
          ctaDuplicates.push(`Post ${idx + 1}: Duplicate ending between Part ${i + 1} and Part ${i + 2}`);
        }
      }
    }

    // 8. HUMAN EDITOR QUALITY AUDIT
    parts.forEach((part, pIdx) => {
      if (/\b(lorem|as an ai|in conclusion,|in summary,|furthermore,|moreover,)\b/i.test(part)) {
        humanEditorFlags.push(`Post ${idx + 1} Part ${pIdx + 1}: Robotic transitions detected`);
      }
      if (/\b(this post|this thread|in this post)\b/i.test(part)) {
        humanEditorFlags.push(`Post ${idx + 1} Part ${pIdx + 1}: Self-referential post meta-commentary`);
      }
    });
  });

  const totalDefects = 
    angleTitleLeaks.length +
    planningMetadataLeaks.length +
    unsupportedTechnicalExplanations.length +
    unsupportedQuantifiedClaims.length +
    unsupportedFactualClaims.length +
    unsupportedComparativeClaims.length +
    invalidNumberedSequences.length +
    malformedQuotations.length +
    forcedProductMentions.length +
    exactDuplicates.length +
    nearDuplicates.length +
    ctaDuplicates.length +
    partsOver500.length +
    incompleteSentences.length +
    humanEditorFlags.length;

  const runtimeResult = totalDefects === 0 ? "PASS" : "FAIL";

  console.log("\n==================================================");
  console.log("FINAL ADVERSARIAL VERIFICATION REPORT");
  console.log("==================================================\n");

  console.log(`RUNTIME RESULT:\n${runtimeResult}\n`);
  console.log(`32 POSTS:\n${posts.length === 32 ? "YES" : "NO"}\n`);

  console.log("PART DISTRIBUTION:");
  for (let i = 1; i <= 8; i++) {
    console.log(`${i}: ${partCounts[i] || 0}`);
  }
  console.log("");

  console.log(`Angle-title leaks: ${angleTitleLeaks.length}`);
  angleTitleLeaks.forEach(s => console.log(`  - ${s}`));

  console.log(`Planning metadata leaks: ${planningMetadataLeaks.length}`);
  planningMetadataLeaks.forEach(s => console.log(`  - ${s}`));

  console.log(`Unsupported technical explanations: ${unsupportedTechnicalExplanations.length}`);
  unsupportedTechnicalExplanations.forEach(s => console.log(`  - ${s}`));

  console.log(`Unsupported quantified claims: ${unsupportedQuantifiedClaims.length}`);
  unsupportedQuantifiedClaims.forEach(s => console.log(`  - ${s}`));

  console.log(`Unsupported factual claims: ${unsupportedFactualClaims.length}`);
  unsupportedFactualClaims.forEach(s => console.log(`  - ${s}`));

  console.log(`Unsupported comparative claims: ${unsupportedComparativeClaims.length}`);
  unsupportedComparativeClaims.forEach(s => console.log(`  - ${s}`));

  console.log(`Invalid numbered sequences: ${invalidNumberedSequences.length}`);
  invalidNumberedSequences.forEach(s => console.log(`  - ${s}`));

  console.log(`Malformed quotations: ${malformedQuotations.length}`);
  malformedQuotations.forEach(s => console.log(`  - ${s}`));

  console.log(`Forced product mentions: ${forcedProductMentions.length}`);
  forcedProductMentions.forEach(s => console.log(`  - ${s}`));

  console.log(`Exact duplicates: ${exactDuplicates.length}`);
  exactDuplicates.forEach(s => console.log(`  - ${s}`));

  console.log(`Near duplicates: ${nearDuplicates.length}`);
  nearDuplicates.forEach(s => console.log(`  - ${s}`));

  console.log(`CTA duplicates: ${ctaDuplicates.length}`);
  ctaDuplicates.forEach(s => console.log(`  - ${s}`));

  console.log(`Parts >500 characters: ${partsOver500.length}`);
  partsOver500.forEach(s => console.log(`  - ${s}`));

  console.log(`Incomplete sentences: ${incompleteSentences.length}`);
  incompleteSentences.forEach(s => console.log(`  - ${s}`));

  console.log(`Human-editor flags: ${humanEditorFlags.length}`);
  humanEditorFlags.forEach(s => console.log(`  - ${s}`));

  console.log("");
  console.log(`ThreadsWorks mentions: ${threadsWorksMentions}`);
  console.log(`Non-product posts: ${nonProductPosts}`);
  console.log(`CTA posts: ${ctaPosts}`);
  console.log(`No-CTA posts: ${noCtaPosts}`);
}

runAdversarialVerification().catch(err => {
  console.error("Adversarial Verification Failed:", err);
  process.exit(1);
});
