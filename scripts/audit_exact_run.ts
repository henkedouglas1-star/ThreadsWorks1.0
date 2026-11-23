import fs from "fs";

function auditExactRun() {
  const filePath = "scripts/live_exact_request_result.json";
  if (!fs.existsSync(filePath)) {
    console.error("Result file not found!");
    process.exit(1);
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(raw);
  const checksum = parsed.checksum || "N/A";
  const data = parsed.data || {};
  const payload = parsed.payload || {};
  const posts = data.posts || [];

  console.log("================================================================================");
  console.log("THREADSWORKS — VERBATIM DISPLAY & PROGRAMMATIC AUDIT OF LIVE RESPONSE");
  console.log("================================================================================");
  console.log(`RESPONSE SHA256 CHECKSUM: ${checksum}`);
  console.log(`\nEXACT SUBMITTED CONTENT REQUEST:`);
  console.log(`"${payload.topic}"`);
  console.log(`\nEXACT SUBMITTED CREATOR CONTEXT LENGTH: ${payload.customInstruction?.length} characters`);
  console.log(`GENERATION SETTINGS RECORDED:`);
  console.log(`- Count: ${payload.count}`);
  console.log(`- Category: ${payload.category}`);
  console.log(`- Character Limit: ${payload.characterLimit}`);
  console.log(`- Active Strategic Angle: ${payload.activeStrategicAngle ?? "EMPTY (undefined)"}`);
  console.log(`- Locked Opening Hook: ${payload.lockedOpeningHook ?? "EMPTY (undefined)"}`);
  console.log(`- Content Destinations Count: ${payload.contentDestinations?.length}`);

  console.log(`\nReturned Posts Count: ${posts.length}`);

  let singleCount = 0;
  let threadCount = 0;

  posts.forEach((post: any, idx: number) => {
    const postNum = idx + 1;
    const parts: string[] = (post.threadParts && post.threadParts.length > 0)
      ? post.threadParts
      : (post.parts && post.parts.length > 0)
        ? post.parts
        : [post.singlePost || ""];

    const isThread = parts.length > 1;
    if (isThread) threadCount++;
    else singleCount++;

    console.log("\n--------------------------------------------------------------------------------");
    console.log(`POST ${postNum} (ID: post-${postNum}): [${isThread ? "thread (" + parts.length + " parts)" : "single"}] "${post.title || post.hook || "Untitled"}"`);
    console.log(`Hook: "${post.hook || parts[0]?.split("\n")[0] || ""}"`);
    
    parts.forEach((p, pIdx) => {
      const pLen = p.length; // Exact programmatic string length including spaces & newlines
      const overLimit = pLen > 500 ? " [EXCEEDS 500 CHAR LIMIT!]" : "";
      console.log(`  Part ${pIdx + 1} (post-${postNum}-part-${pIdx + 1}): ${pLen} chars${overLimit}`);
    });

    console.log(`\nVERBATIM FULL POST TEXT (From Captured Response Object):`);
    parts.forEach((p, pIdx) => {
      console.log(`\n--- Part ${pIdx + 1} (${p.length} chars) ---`);
      console.log(p);
    });
  });

  console.log("\n================================================================================");
  console.log("PROGRAMMATICALLY CALCULATED BATCH METRICS:");
  console.log("================================================================================");
  console.log(`- Total Single Posts: ${singleCount}`);
  console.log(`- Total Multi-part Threads: ${threadCount}`);
  console.log(`- Total Posts Returned: ${posts.length}`);
  console.log("================================================================================");
}

auditExactRun();
