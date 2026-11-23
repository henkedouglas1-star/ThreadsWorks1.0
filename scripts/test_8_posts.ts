import fetch from "node-fetch";

async function test8() {
  console.log("==================================================");
  console.log("THREADSWORKS — 8-POST YOUR LINKS VERIFICATION RUN");
  console.log("==================================================");

  const myLinksEntries = [
    {
      id: "link_1",
      name: "Threadsworks Pro Membership Upgrade",
      url: "https://threadsworks.com/pricing",
      purpose: "Upgrade or learn about ThreadsWorks Pro membership and pricing"
    },
    {
      id: "link_2",
      name: "Create Content",
      url: "https://threadsworks.com/create",
      purpose: "Start creating content with ThreadsWorks post builder"
    },
    {
      id: "link_3",
      name: "Content Pays You",
      url: "https://contentpaysyou.com",
      purpose: "Learn more about Content Pays You creator ecosystem and strategy"
    }
  ];

  console.log("\nStored Your Links Records in My Profile:");
  myLinksEntries.forEach((l, idx) => {
    console.log(`  [Link ${idx + 1}] Name: "${l.name}" | URL: "${l.url}"`);
  });

  const payload = {
    topic: "Building a repeatable content engine with ThreadsWorks to reach predictable audience growth and monetize your expertise",
    category: "auto",
    count: "8",
    threadLength: "auto",
    sentencesPerPart: "3",
    characterLimit: 500,
    offer: "Threadsworks Pro Membership Upgrade ($7/month)",
    audience: "ambitious creators, consultants, and founders",
    desiredResult: "predictable audience growth and client inquiries",
    writingStyle: "Direct, high-value, casual, authoritative",
    contentDestinations: myLinksEntries,
    ctaPreferences: "When a post includes a call to action, naturally connect to the most relevant saved MY LINKS destination URL."
  };

  console.log("\nCalling /api/generate-posts-batch for 8 posts...");
  const res = await fetch("http://localhost:3000/api/generate-posts-batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    console.error(`Request failed with status ${res.status}`);
    const err = await res.text();
    console.error(err);
    process.exit(1);
  }

  const data: any = await res.json();
  const posts: any[] = data.posts || [];
  const linkReports: any[] = data.linkReports || [];

  console.log(`Total posts returned: ${posts.length}`);

  let destinationCount = 0;
  let naturalCount = 0;
  let defects = 0;

  console.log("\n==================================================");
  console.log("DETAILED POST VERIFICATION");
  console.log("==================================================");

  posts.forEach((p, idx) => {
    const postNum = idx + 1;
    const parts: string[] = Array.isArray(p.threadParts) && p.threadParts.length > 0 ? p.threadParts : [p.singlePost];
    const fullText = parts.join("\n---\n");
    const urls = fullText.match(/https?:\/\/[^\s)]+/g) || [];
    const report = linkReports[idx] || {};

    console.log(`\n--- Post #${postNum} (${parts.length} parts) ---`);

    if (report.hasCta && report.selectedDestination) {
      destinationCount++;
      const selected = report.selectedDestination;
      const storedUrl = myLinksEntries.find(l => l.name === selected.name || l.url === selected.url)?.url || selected.url;
      const selectedUrl = report.exactUrl;
      const renderedCta = report.ctaText;

      console.log(`• link name: "${selected.name}"`);
      console.log(`• stored URL: "${storedUrl}"`);
      console.log(`• selected URL: "${selectedUrl}"`);
      console.log(`• final rendered CTA: "${renderedCta.replace(/\n/g, "\\n")}"`);

      // 1. Verify URL matches stored URL exactly
      if (selectedUrl !== storedUrl) {
        console.error(`  [DEFECT] URL mismatch! stored="${storedUrl}", selected="${selectedUrl}"`);
        defects++;
      } else {
        console.log(`  ✓ Exact stored URL verified`);
      }

      // 2. Verify full URL visibly appears after "start here:"
      const expectedPrefix = `If you want to build your next post with ${selected.name}, start here:`;
      const lastPart = parts[parts.length - 1] || "";
      if (lastPart.includes("start here:")) {
        const afterStartHere = lastPart.slice(lastPart.indexOf("start here:") + "start here:".length);
        if (afterStartHere.includes(storedUrl)) {
          console.log(`  ✓ Full URL visibly appears after "start here:"`);
        } else {
          console.error(`  [DEFECT] Full URL does NOT appear after "start here:"! Output after: "${afterStartHere}"`);
          defects++;
        }
      } else {
        console.error(`  [DEFECT] "start here:" not found in final part!`);
        defects++;
      }

      // 3. Verify CTA is rendered only once
      const startHereCount = (fullText.match(/start here:/gi) || []).length;
      const urlCount = urls.length;

      if (startHereCount === 1 && urlCount === 1) {
        console.log(`  ✓ CTA is rendered only once (start here count: 1, URL count: 1)`);
      } else {
        console.error(`  [DEFECT] Duplicate CTA detected! startHereCount=${startHereCount}, urlCount=${urlCount}`);
        defects++;
      }

      // 4. Verify no duplicate hook in subsequent parts
      const hook = parts[0].trim();
      let hookRepeated = false;
      for (let pt = 1; pt < parts.length; pt++) {
        if (parts[pt].toLowerCase().includes(hook.toLowerCase().slice(0, 30))) {
          hookRepeated = true;
          break;
        }
      }
      if (hookRepeated) {
        console.error(`  [DEFECT] Duplicate hook block detected in subsequent parts!`);
        defects++;
      } else {
        console.log(`  ✓ No duplicate hook block across thread parts`);
      }

      // 5. Verify part lengths <= 500
      const over500 = parts.filter(pt => pt.length > 500);
      if (over500.length > 0) {
        console.error(`  [DEFECT] ${over500.length} part(s) exceed 500 characters!`);
        defects++;
      } else {
        console.log(`  ✓ All parts <= 500 chars (max: ${Math.max(...parts.map(pt => pt.length))} chars)`);
      }

    } else {
      naturalCount++;
      console.log(`• Ending type: Natural ending / reflection question (no destination CTA)`);
      if (urls.length > 0) {
        console.error(`  [DEFECT] Natural ending post contains unexpected URL: ${urls.join(", ")}`);
        defects++;
      } else {
        console.log(`  ✓ 0 URLs present`);
      }
      const startHereCount = (fullText.match(/start here:/gi) || []).length;
      if (startHereCount > 0) {
        console.error(`  [DEFECT] Stray "start here:" found in natural ending post!`);
        defects++;
      } else {
        console.log(`  ✓ 0 stray CTA phrases`);
      }
    }
  });

  console.log("\n==================================================");
  console.log("FINAL 8-POST TEST SUMMARY");
  console.log("==================================================");
  console.log(`Total Posts: ${posts.length}`);
  console.log(`Destination CTA Posts: ${destinationCount}`);
  console.log(`Natural Ending Posts: ${naturalCount}`);
  console.log(`Total Defects Found: ${defects}`);
  console.log("==================================================");

  if (defects === 0) {
    console.log(">>> SUCCESS: ALL VERIFICATIONS PASSED WITH ZERO DEFECTS <<<");
  } else {
    console.error(`>>> FAILURE: ${defects} DEFECT(S) DETECTED <<<`);
    process.exit(1);
  }
}

test8().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
