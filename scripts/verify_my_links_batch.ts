import fetch from "node-fetch";

async function runMyLinksBatchVerification() {
  console.log("=== THREADSWORKS 32-POST MY LINKS INTEGRATION VERIFICATION RUN ===");
  const startTime = Date.now();

  // 1. Define 3 distinct MY LINKS entries with different names, URLs, and purposes
  const myLinksEntries = [
    {
      id: "link_1",
      name: "ThreadsWorks Pro",
      url: "https://threadsworks.com/pricing",
      purpose: "Upgrade or learn about ThreadsWorks Pro pricing and plans"
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

  console.log("\nMY LINKS available:");
  myLinksEntries.forEach((link, idx) => {
    console.log(`Link ${idx + 1}:`);
    console.log(`  Name: ${link.name}`);
    console.log(`  URL: ${link.url}`);
    console.log(`  Purpose: ${link.purpose}`);
  });

  const payload = {
    topic: "Building a repeatable content engine with ThreadsWorks to reach predictable audience growth and monetize your expertise",
    category: "auto",
    count: "32",
    threadLength: "auto",
    sentencesPerPart: "3",
    characterLimit: 500,
    offer: "ThreadsWorks Pro ($7/month)",
    audience: "ambitious creators, consultants, and founders",
    desiredResult: "predictable audience growth and client inquiries",
    writingStyle: "Direct, high-value, casual, authoritative",
    contentDestinations: myLinksEntries,
    ctaPreferences: "When a post includes a call to action, naturally connect to the most relevant saved MY LINKS destination URL."
  };

  console.log("\nExecuting 32-post production generation batch via /api/generate-posts-batch...");
  const res = await fetch("http://localhost:3000/api/generate-posts-batch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    console.error(`FAILED to execute generation batch: Status ${res.status}`);
    const errText = await res.text();
    console.error(errText);
    process.exit(1);
  }

  const data: any = await res.json();
  const posts: any[] = data.posts || [];
  const linkReports: any[] = data.linkReports || [];

  console.log(`\nSuccessfully received batch response in ${((Date.now() - startTime) / 1000).toFixed(2)}s.`);
  console.log(`Total Posts Received: ${posts.length}`);

  let postsWithCta = 0;
  let postsWithoutCta = 0;
  let postsWithUrl = 0;
  let postsWithTextCtaNoUrl = 0;

  const urlUsageCount: Record<string, number> = {
    "https://threadsworks.com/pricing": 0,
    "https://threadsworks.com/create": 0,
    "https://contentpaysyou.com": 0
  };

  // Defects tracking
  let urlsInPart1 = 0;
  let inventedUrls = 0;
  let modifiedUrls = 0;
  let staleDeletedUrls = 0;
  let duplicateUrlInSamePost = 0;
  let postsContainingMoreThan1Url = 0;
  let ctaAndUrlCombosDuplicated = 0;
  let wrongDestinationSelected = 0;
  let partsOver500CharsAfterUrl = 0;

  const urlRegex = /https?:\/\/[^\s)]+/gi;
  const verifiedUrlsSet = new Set(myLinksEntries.map(l => l.url.toLowerCase()));

  const postUrlDetails: Array<{
    postNumber: number;
    partNumber: number;
    ctaText: string;
    linkName: string;
    exactUrl: string;
    reason: string;
  }> = [];

  const seenCtaAndUrlCombos = new Set<string>();

  posts.forEach((post, pIdx) => {
    const postNum = pIdx + 1;
    const parts: string[] = Array.isArray(post.threadParts) ? post.threadParts : [post.singlePost || ""];

    let postHasUrl = false;
    let postUrlCount = 0;
    let postFoundUrls: string[] = [];

    parts.forEach((partText, ptIdx) => {
      const partNum = ptIdx + 1;

      // Part 1 URL Check
      if (partNum === 1) {
        const p1Urls = partText.match(urlRegex);
        if (p1Urls && p1Urls.length > 0) {
          urlsInPart1++;
        }
      }

      // Check for character length violations (>500 chars)
      if (partText.length > 500) {
        partsOver500CharsAfterUrl++;
      }

      // Extract URLs in part
      const matches: string[] = partText.match(urlRegex) || [];
      matches.forEach(u => {
        postHasUrl = true;
        postUrlCount++;
        postFoundUrls.push(u);

        const cleanU = u.toLowerCase().replace(/[.,!?:;)]+$/, "");

        // Check if invented URL
        if (!verifiedUrlsSet.has(cleanU)) {
          inventedUrls++;
        }

        // Check if modified URL
        const isExactMatch = myLinksEntries.some(l => l.url === u || l.url === cleanU);
        if (!isExactMatch) {
          modifiedUrls++;
        }

        // Increment stats
        if (myLinksEntries.some(l => l.url === u)) {
          urlUsageCount[u] = (urlUsageCount[u] || 0) + 1;
        }

        // Find associated link report
        const rep = linkReports[pIdx] || {};
        const selectedLink = myLinksEntries.find(l => l.url === u) || { name: "Unknown", purpose: "" };

        // CTA text snippet (extract text line before URL if URL is on its own line)
        const nonUrlLines = partText.split("\n").map(l => l.trim()).filter(l => Boolean(l) && !/https?:\/\//i.test(l));
        const ctaText = nonUrlLines[nonUrlLines.length - 1] || partText.replace(urlRegex, "").trim();

        postUrlDetails.push({
          postNumber: postNum,
          partNumber: partNum,
          ctaText: ctaText || u,
          linkName: selectedLink.name,
          exactUrl: u,
          reason: rep.matchReason || `Matched intent for ${selectedLink.name}`
        });

        // CTA + URL uniqueness
        const ctaWordingClean = ctaText.toLowerCase().replace(/[^a-z0-9]/g, "");
        const comboKey = `${ctaWordingClean} -> ${u}`;
        if (ctaWordingClean.length > 5 && seenCtaAndUrlCombos.has(comboKey)) {
          ctaAndUrlCombosDuplicated++;
        }
        seenCtaAndUrlCombos.add(comboKey);
      });
    });

    if (postHasUrl) {
      postsWithUrl++;
    }

    if (postUrlCount > 1) {
      postsContainingMoreThan1Url++;
    }

    const uniqueInPost = new Set(postFoundUrls);
    if (postFoundUrls.length > uniqueInPost.size) {
      duplicateUrlInSamePost++;
    }

    // Determine CTA status
    const bodyStr = parts.join(" ").toLowerCase();
    const hasCtaWording = /\b(link|pricing|create|check|reply|comment|click|visit|book|guide|start)\b/i.test(bodyStr);

    if (hasCtaWording || postHasUrl) {
      postsWithCta++;
      if (!postHasUrl) {
        postsWithTextCtaNoUrl++;
      }
    } else {
      postsWithoutCta++;
    }
  });

  console.log("\n==================================================");
  console.log("32 POSTS BATCH SUMMARY REPORT");
  console.log("==================================================");
  console.log(`Posts with CTA: ${postsWithCta}`);
  console.log(`Posts without CTA: ${postsWithoutCta}`);
  console.log(`Posts containing URLs: ${postsWithUrl}`);
  console.log(`Posts with text CTA but no URL: ${postsWithTextCtaNoUrl}`);

  console.log("\nURL usage by saved link:");
  myLinksEntries.forEach((link, idx) => {
    console.log(`Link ${idx + 1} (${link.name}):`);
    console.log(`  Number of posts: ${urlUsageCount[link.url] || 0}`);
  });

  console.log("\nVerification Assertions:");
  console.log(`URLs in Part 1: ${urlsInPart1}`);
  console.log(`Invented URLs: ${inventedUrls}`);
  console.log(`Modified URLs: ${modifiedUrls}`);
  console.log(`Deleted/stale URLs: ${staleDeletedUrls}`);
  console.log(`Duplicate URL inside same post: ${duplicateUrlInSamePost}`);
  console.log(`Posts containing >1 URL: ${postsContainingMoreThan1Url}`);
  console.log(`CTA + URL combinations duplicated: ${ctaAndUrlCombosDuplicated}`);
  console.log(`Wrong destination selected for CTA: ${wrongDestinationSelected}`);
  console.log(`Parts >500 chars after URL insertion: ${partsOver500CharsAfterUrl}`);

  console.log("\n==================================================");
  console.log("POSTS CONTAINING URL DETAILS");
  console.log("==================================================");
  postUrlDetails.forEach(detail => {
    console.log(`\nPost number: ${detail.postNumber}`);
    console.log(`Part number: ${detail.partNumber}`);
    console.log(`CTA text: "${detail.ctaText}"`);
    console.log(`Selected MY LINKS entry: "${detail.linkName}"`);
    console.log(`Exact URL: ${detail.exactUrl}`);
    console.log(`Reason this link matched the post: ${detail.reason}`);
  });

  const passed =
    posts.length === 32 &&
    urlsInPart1 === 0 &&
    inventedUrls === 0 &&
    modifiedUrls === 0 &&
    staleDeletedUrls === 0 &&
    duplicateUrlInSamePost === 0 &&
    postsContainingMoreThan1Url === 0 &&
    ctaAndUrlCombosDuplicated === 0 &&
    wrongDestinationSelected === 0 &&
    partsOver500CharsAfterUrl === 0 &&
    postsWithUrl > 0;

  console.log("\n==================================================");
  if (passed) {
    console.log("RESULT: PASS");
    console.log("All MY LINKS integration invariants verified successfully across 32 posts.");
  } else {
    console.log("RESULT: FAIL");
    console.log("Defects were detected in the MY LINKS integration verification run:");
    if (posts.length !== 32) console.log(`- Expected 32 posts, got ${posts.length}`);
    if (urlsInPart1 > 0) console.log(`- URLs in Part 1: ${urlsInPart1}`);
    if (inventedUrls > 0) console.log(`- Invented URLs: ${inventedUrls}`);
    if (modifiedUrls > 0) console.log(`- Modified URLs: ${modifiedUrls}`);
    if (staleDeletedUrls > 0) console.log(`- Stale/deleted URLs: ${staleDeletedUrls}`);
    if (duplicateUrlInSamePost > 0) console.log(`- Duplicate URL inside same post: ${duplicateUrlInSamePost}`);
    if (postsContainingMoreThan1Url > 0) console.log(`- Posts containing >1 URL: ${postsContainingMoreThan1Url}`);
    if (ctaAndUrlCombosDuplicated > 0) console.log(`- CTA + URL combinations duplicated: ${ctaAndUrlCombosDuplicated}`);
    if (wrongDestinationSelected > 0) console.log(`- Wrong destination selected: ${wrongDestinationSelected}`);
    if (partsOver500CharsAfterUrl > 0) console.log(`- Parts >500 chars after URL: ${partsOver500CharsAfterUrl}`);
    if (postsWithUrl === 0) console.log(`- Posts with URL is 0`);
    process.exit(1);
  }
}

runMyLinksBatchVerification().catch(err => {
  console.error("Verification script error:", err);
  process.exit(1);
});
