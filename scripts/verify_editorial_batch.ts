async function runVerification() {
  console.log("=== THREADSWORKS 32-POST EDITORIAL RUNTIME VERIFICATION ===");
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
    return;
  }

  const data = await response.json();
  const posts = data.posts || [];
  console.log(`Generated ${posts.length} posts in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

  // 1. PART COUNT VERIFICATION
  const partCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 };
  posts.forEach((p: any, idx: number) => {
    const parts = p.threadParts || p.parts || [p.singlePost];
    const cnt = parts.length;
    partCounts[cnt] = (partCounts[cnt] || 0) + 1;
    console.log(`Post ${idx + 1}: ${cnt} parts`);
  });

  console.log("\n--- PART COUNT SUMMARY ---");
  for (let i = 1; i <= 8; i++) {
    console.log(`${i} part: ${partCounts[i] || 0}`);
  }

  // 2. CTA & DUPLICATION AUDIT
  let duplicateCtaCount = 0;
  let threadsWorksMentions = 0;
  let ctaCount = 0;
  let noCtaCount = 0;
  let absolutesCount = 0;
  let planningLeaksCount = 0;

  const ABSOLUTE_WORDS = [
    /\bwill always beat\b/i,
    /\bwill always outperform\b/i,
    /\bwill increase conversion\b/i,
    /\bwill double\b/i,
    /\bwill triple\b/i,
    /\beffortless(?:ly)?\b/i,
    /\bevery single time\b/i,
    /\bguaranteed to\b/i,
    /\bmakes people pay attention\b/i,
    /\bcauses audiences to\b/i
  ];

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
    "Topic Repertoire Expansion"
  ];

  posts.forEach((p: any, idx: number) => {
    const parts = p.threadParts || p.parts || [p.singlePost];
    const fullText = parts.join("\n\n");
    const lastPart = parts[parts.length - 1] || "";

    // CTA analysis
    const isCtaLike = /\?|explore|check out|share below|let's discuss|threadsworks/i.test(lastPart);
    if (isCtaLike) ctaCount++;
    else noCtaCount++;

    // Duplicate CTA in separate parts
    if (parts.length > 1) {
      for (let i = 0; i < parts.length - 1; i++) {
        const normCurrent = parts[i].toLowerCase().replace(/[^a-z0-9]/g, "");
        const normLast = lastPart.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (normCurrent.length > 15 && normCurrent.includes(normLast)) {
          duplicateCtaCount++;
          console.log(`[DUPLICATE CTA DETECTED] Post ${idx + 1}`);
        }
      }
    }

    // ThreadsWorks mentions
    if (/ThreadsWorks/i.test(fullText)) {
      threadsWorksMentions++;
    }

    // Absolutes
    ABSOLUTE_WORDS.forEach(regex => {
      if (regex.test(fullText)) {
        absolutesCount++;
        console.log(`[ABSOLUTE DETECTED] Post ${idx + 1}: match ${regex}`);
      }
    });

    // Planning Leaks
    PLANNING_LABELS.forEach(label => {
      if (fullText.includes(label)) {
        planningLeaksCount++;
        console.log(`[PLANNING LEAK] Post ${idx + 1}: ${label}`);
      }
    });
  });

  console.log("\n--- QUALITY & EDITORIAL SUMMARY ---");
  console.log(`Total Posts: ${posts.length}`);
  console.log(`CTA Posts: ${ctaCount}`);
  console.log(`No-CTA Posts: ${noCtaCount}`);
  console.log(`Duplicate CTAs: ${duplicateCtaCount}`);
  console.log(`ThreadsWorks Mentions: ${threadsWorksMentions}`);
  console.log(`Unsupported Absolutes Detected: ${absolutesCount}`);
  console.log(`Planning Metadata Leaks: ${planningLeaksCount}`);
}

runVerification().catch(console.error);
