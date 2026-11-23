import fetch from "node-fetch";

interface MyLink {
  id: string;
  name: string;
  url: string;
  purpose: string;
}

const myLinksEntries: MyLink[] = [
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

const anglesList = [
  { angleTitle: "Why standard vanity tracking misses conversion on", centralThesis: "Measuring surface engagement distracts from the specific friction that actually drives audience decisions." },
  { angleTitle: "Sequential execution framework for turning observations into", centralThesis: "Breaking down the transition from raw note to structured post removes drafting paralysis." },
  { angleTitle: "The silent friction point when capturing insights on", centralThesis: "Creators struggle when they try to polish thoughts before clarifying the underlying mechanism." },
  { angleTitle: "Treating daily creator observations as permanent leverage behind", centralThesis: "Every structured post should function as compounding equity rather than disposable feed noise." },
  { angleTitle: "Challenging mainstream assumptions about publishing", centralThesis: "Confronting accepted industry dogmas immediately earns read retention and credibility." },
  { angleTitle: "Fast decision rules that cut drafting friction on", centralThesis: "Removing unnecessary structural choices keeps publishing momentum high and predictable." },
  { angleTitle: "Extracting multiple distinct perspectives from one insight on", centralThesis: "One verified friction point can be explored across multiple angles without repeating copy." },
  { angleTitle: "Maximum publishing authority with minimal drafting time on", centralThesis: "Sustainable output comes from disciplined constraints, not brute-force hours." }
];

const hooksList = [
  "If your Threads posts get views but zero replies, check your opening five words.",
  "Most creators do not have a writing problem. They have an idea capture bottleneck.",
  "Stop trying to write finished posts from scratch every single morning.",
  "The single biggest mistake in social writing is treating drafting like performance art.",
  "Your best content is already sitting in your client notes and voice memos.",
  "Publishing three strong ideas consistently compounds faster than sporadic genius.",
  "When your message speaks to everyone, high-intent readers keep scrolling.",
  "The secret to predictable audience growth is removing daily drafting decisions."
];

const basePayload = {
  topic: "Building a repeatable content engine with ThreadsWorks to reach predictable audience growth and monetize your expertise",
  category: "auto",
  count: "8",
  threadLength: "auto",
  sentencesPerPart: "3",
  characterLimit: 500,
  offer: "ThreadsWorks Pro Membership Upgrade ($7/month)",
  audience: "ambitious creators, consultants, and founders",
  desiredResult: "predictable audience growth and client inquiries",
  writingStyle: "Direct, high-value, casual, authoritative",
  contentDestinations: myLinksEntries,
  ctaPreferences: "When a post includes a call to action, naturally connect to the most relevant saved MY LINKS destination URL."
};

interface TestResult {
  testName: string;
  postsGenerated: number;
  naturalEndings: number;
  engagementCtas: number;
  destinationCtas: number;
  destinationCtasWithExactUrl: number;
  destinationCtasMissingUrl: number;
  urlsInPart1: number;
  inventedUrls: number;
  modifiedUrls: number;
  wrongUrls: number;
  partsOver500: number;
  details?: any[];
}

import http from "http";

const httpAgent = new http.Agent({ keepAlive: false });

async function runTest(testName: string, extraPayload: any): Promise<TestResult> {
  const fullPayload = { ...basePayload, ...extraPayload };
  const res = await fetch("http://localhost:3000/api/generate-posts-batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fullPayload),
    agent: httpAgent
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Test ${testName} failed with status ${res.status}: ${errText}`);
  }

  const data: any = await res.json();
  const posts: any[] = data.posts || [];
  const linkReports: any[] = data.linkReports || [];

  let naturalEndings = 0;
  let engagementCtas = 0;
  let destinationCtas = 0;
  let destinationCtasWithExactUrl = 0;
  let destinationCtasMissingUrl = 0;
  let urlsInPart1 = 0;
  let inventedUrls = 0;
  let modifiedUrls = 0;
  let wrongUrls = 0;
  let partsOver500 = 0;
  const details: any[] = [];

  const storedUrls = myLinksEntries.map(l => l.url);

  posts.forEach((p, idx) => {
    const postNum = idx + 1;
    const parts: string[] = Array.isArray(p.threadParts) && p.threadParts.length > 0 ? p.threadParts : [p.singlePost || ""];
    const report = linkReports[idx] || {};

    // Character length verification
    parts.forEach(part => {
      if (part.length > 500) partsOver500++;
    });

    // Check Part 1 URL violation
    const part1Urls = (parts[0] || "").match(/https?:\/\/[^\s)]+/g) || [];
    if (part1Urls.length > 0) urlsInPart1++;

    // Overall post URLs
    const fullText = parts.join("\n---\n");
    const allUrls = fullText.match(/https?:\/\/[^\s)]+/g) || [];
    const lastPart = parts[parts.length - 1] || "";
    const isEngagement = !allUrls.length && (/\?/.test(lastPart) || /\b(reply|comment|share)\b/i.test(lastPart));

    if (report.hasCta && report.exactUrl) {
      destinationCtas++;
      const reportedUrl = report.exactUrl;
      const matchingStored = myLinksEntries.find(l => l.url === reportedUrl);

      if (!matchingStored) {
        if (!reportedUrl.includes("threadsworks.com") && !reportedUrl.includes("contentpaysyou.com")) {
          inventedUrls++;
        } else {
          modifiedUrls++;
        }
      } else {
        // Check if matchingStored is exact
        if (matchingStored.url === reportedUrl) {
          destinationCtasWithExactUrl++;
        } else {
          modifiedUrls++;
        }
      }

      // Check if rendered in part text
      const partIdxWithUrl = parts.findIndex(part => part.includes(reportedUrl));
      if (partIdxWithUrl === -1) {
        destinationCtasMissingUrl++;
      }

      details.push({
        postNumber: postNum,
        angleUsed: p.angle || (extraPayload.strategicUnits ? extraPayload.strategicUnits[idx]?.angle?.angleTitle : "Direct topic"),
        hookUsed: (parts[0] || "").split("\n\n")[0],
        ctaType: "Destination CTA",
        ctaText: report.ctaText,
        selectedEntry: report.selectedDestination?.name || "ThreadsWorks Pro",
        storedUrl: matchingStored?.url || report.selectedDestination?.url,
        renderedUrl: reportedUrl,
        partNumberContainingUrl: partIdxWithUrl !== -1 ? partIdxWithUrl + 1 : "Missing",
        finalPartText: parts[parts.length - 1]
      });
    } else if (allUrls.length > 0) {
      destinationCtas++;
      const foundUrl = allUrls[0];
      if (storedUrls.includes(foundUrl)) {
        destinationCtasWithExactUrl++;
      } else {
        wrongUrls++;
      }
    } else if (isEngagement) {
      engagementCtas++;
    } else {
      naturalEndings++;
    }
  });

  return {
    testName,
    postsGenerated: posts.length,
    naturalEndings,
    engagementCtas,
    destinationCtas,
    destinationCtasWithExactUrl,
    destinationCtasMissingUrl,
    urlsInPart1,
    inventedUrls,
    modifiedUrls,
    wrongUrls,
    partsOver500,
    details
  };
}

async function main() {
  console.log("==================================================");
  console.log("STARTING 4-MODE 8-POST SYSTEM VERIFICATION RUN");
  console.log("==================================================");

  // TEST 1: Angles OFF, Hooks OFF
  console.log("\nRunning TEST 1: Angles OFF, Hooks OFF...");
  const t1 = await runTest("TEST 1: Angles OFF, Hooks OFF", {});
  await new Promise(r => setTimeout(r, 2500));

  // TEST 2: Angles ON, Hooks OFF
  console.log("Running TEST 2: Angles ON, Hooks OFF...");
  const t2 = await runTest("TEST 2: Angles ON, Hooks OFF", {
    strategicUnits: anglesList.map((a, idx) => ({
      id: `cu_${idx + 1}`,
      sourceIdea: basePayload.topic,
      angle: a,
      hookPromise: a.centralThesis
    }))
  });
  await new Promise(r => setTimeout(r, 2500));

  // TEST 3: Angles OFF, Hooks ON
  console.log("Running TEST 3: Angles OFF, Hooks ON...");
  const t3 = await runTest("TEST 3: Angles OFF, Hooks ON", {
    all32Hooks: hooksList
  });
  await new Promise(r => setTimeout(r, 2500));

  // TEST 4: Angles ON, Hooks ON
  console.log("Running TEST 4: Angles ON, Hooks ON...");
  const t4 = await runTest("TEST 4: Angles ON, Hooks ON", {
    strategicUnits: anglesList.map((a, idx) => ({
      id: `cu_${idx + 1}`,
      sourceIdea: basePayload.topic,
      angle: a,
      hook: { text: hooksList[idx] },
      hookPromise: a.centralThesis
    })),
    all32Hooks: hooksList
  });

  const allTests = [t1, t2, t3, t4];

  for (const t of allTests) {
    console.log("\n==================================================");
    console.log(`REPORT FOR ${t.testName}`);
    console.log("==================================================");
    console.log(`Posts generated: ${t.postsGenerated} / 8`);
    console.log(`Natural endings: ${t.naturalEndings}`);
    console.log(`Engagement CTAs: ${t.engagementCtas}`);
    console.log(`Destination CTAs: ${t.destinationCtas}`);
    console.log(`Destination CTAs with exact Your Links URL: ${t.destinationCtasWithExactUrl}`);
    console.log(`Destination CTAs missing URL: ${t.destinationCtasMissingUrl}`);
    console.log(`URLs in Part 1: ${t.urlsInPart1}`);
    console.log(`Invented URLs: ${t.inventedUrls}`);
    console.log(`Modified URLs: ${t.modifiedUrls}`);
    console.log(`Wrong URLs: ${t.wrongUrls}`);
    console.log(`Parts over 500 characters: ${t.partsOver500}`);
  }

  console.log("\n==================================================");
  console.log("ANGLE + HOOK TEST DETAILS (TEST 4)");
  console.log("==================================================");

  if (t4.details && t4.details.length > 0) {
    t4.details.forEach(d => {
      console.log(`\nPost number: ${d.postNumber}`);
      console.log(`Angle used: ${d.angleUsed}`);
      console.log(`Hook used: ${d.hookUsed}`);
      console.log(`CTA type: ${d.ctaType}`);
      console.log(`CTA text: ${d.ctaText.replace(/\n/g, " \\n ")}`);
      console.log(`Selected Your Links entry: ${d.selectedEntry}`);
      console.log(`Stored URL: ${d.storedUrl}`);
      console.log(`Rendered URL: ${d.renderedUrl}`);
      console.log(`Part number containing URL: Part ${d.partNumberContainingUrl}`);
      console.log(`Final part text:\n"${d.finalPartText}"`);
    });
  }

  // Verification
  let pass = true;
  for (const t of allTests) {
    if (t.postsGenerated !== 8) pass = false;
    if (t.destinationCtas < 3) pass = false;
    if (t.destinationCtasWithExactUrl !== t.destinationCtas) pass = false;
    if (t.destinationCtasMissingUrl !== 0) pass = false;
    if (t.urlsInPart1 !== 0) pass = false;
    if (t.inventedUrls !== 0) pass = false;
    if (t.modifiedUrls !== 0) pass = false;
    if (t.wrongUrls !== 0) pass = false;
    if (t.partsOver500 !== 0) pass = false;
  }

  console.log("\n==================================================");
  console.log(`OVERALL RESULT: ${pass ? "PASS" : "FAIL"}`);
  console.log("==================================================");

  if (!pass) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
