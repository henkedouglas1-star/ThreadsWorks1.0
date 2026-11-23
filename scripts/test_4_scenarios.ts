import fetch from "node-fetch";

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

const strategicAngles = [
  { id: "angle_1", angleTitle: "The Workflow Bottleneck", centralThesis: "Creators get stuck when they try to polish thoughts before clarifying the underlying mechanism.", summary: "Focus on the mechanism before polishing.", strategicLens: "Workflow Bottleneck" },
  { id: "angle_2", angleTitle: "Compounding Assets", centralThesis: "Every structured post should function as compounding equity rather than disposable feed noise.", summary: "Treat daily observations as compounding assets.", strategicLens: "Compounding Assets" },
  { id: "angle_3", angleTitle: "Eliminating Overthinking", centralThesis: "Removing unnecessary structural choices keeps publishing momentum high and predictable.", summary: "Standardize post structures to eliminate friction.", strategicLens: "Eliminating Overthinking" },
  { id: "angle_4", angleTitle: "Pattern Interrupt", centralThesis: "Confronting accepted industry dogmas immediately earns read retention and credibility.", summary: "Interrupt scrolling with counter-intuitive mechanisms.", strategicLens: "Pattern Interrupt" },
  { id: "angle_5", angleTitle: "Mechanism Over Motivation", centralThesis: "Readers remember and act on clear mechanisms, not motivational fluff.", summary: "Give readers concrete execution steps.", strategicLens: "Mechanism Over Motivation" },
  { id: "angle_6", angleTitle: "Reader-Centric Framing", centralThesis: "Personal observations only convert when framed around the reader urgent obstacle.", summary: "Frame personal realizations around reader problems.", strategicLens: "Reader-Centric Framing" },
  { id: "angle_7", angleTitle: "Specificity Multiplier", centralThesis: "Addressing an exact micro-problem creates instant resonance with high-intent readers.", summary: "Narrow precision beats generalized platitudes.", strategicLens: "Specificity Multiplier" },
  { id: "angle_8", angleTitle: "Repurposing Depth", centralThesis: "One verified friction point can be explored across multiple angles without repeating copy.", summary: "Extract ongoing value from verified core concepts.", strategicLens: "Repurposing Depth" }
];

const generatedHooks = [
  { id: "hook_1", text: "If you spend an hour staring at a blank screen, you don't have writer's block.", hookPromise: "Explains the real cause of drafting paralysis." },
  { id: "hook_2", text: "Most creators treat posts like lottery tickets instead of compounding equity.", hookPromise: "Contrasts disposable content with lasting assets." },
  { id: "hook_3", text: "The reason writing feels exhausting is because you're making 15 decisions per post.", hookPromise: "Shows how decision fatigue stops publishing." },
  { id: "hook_4", text: "Stop optimizing for likes when your goal is high-intent conversations.", hookPromise: "Interrupts vanity metrics chasing." },
  { id: "hook_5", text: "Inspiration is unreliable. A disciplined 3-step mechanism works every day.", hookPromise: "Replaces motivational fluff with execution." },
  { id: "hook_6", text: "Your audience doesn't care about your morning routine until they know what it does for them.", hookPromise: "Reframes personal stories around reader value." },
  { id: "hook_7", text: "A generic tip gets skimmed. A hyper-specific micro-solution gets saved.", hookPromise: "Demonstrates the power of precise problem solving." },
  { id: "hook_8", text: "You don't need 30 new ideas a month. You need 5 core insights explored 6 ways.", hookPromise: "Teaches sustainable idea depth." }
];

const strategicUnits = strategicAngles.map((angle, idx) => ({
  id: `cu_${idx + 1}`,
  sourceIdea: "Building a repeatable content engine with ThreadsWorks to reach predictable audience growth and monetize your expertise",
  angle: angle,
  hook: generatedHooks[idx],
  hookPromise: generatedHooks[idx].hookPromise
}));

async function runTest(name: string, payloadOverrides: any) {
  console.log(`\n==================================================`);
  console.log(`RUNNING: ${name}`);
  console.log(`==================================================`);

  const payload = {
    topic: "Building a repeatable content engine with ThreadsWorks to reach predictable audience growth and monetize your expertise",
    category: "auto",
    count: 8,
    threadLength: "auto",
    sentencesPerPart: "3",
    characterLimit: 500,
    offer: "Threadsworks Pro Membership Upgrade ($7/month)",
    audience: "ambitious creators, consultants, and founders",
    desiredResult: "predictable audience growth and client inquiries",
    writingStyle: "Direct, high-value, casual, authoritative",
    contentDestinations: myLinksEntries,
    ctaPreferences: "When a post includes a call to action, naturally connect to the most relevant saved MY LINKS destination URL.",
    ...payloadOverrides
  };

  const res = await fetch("http://localhost:3000/api/generate-posts-batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    console.error(`Request failed with status ${res.status}`);
    const err = await res.text();
    console.error(err);
    return null;
  }

  const data: any = await res.json();
  const posts: any[] = data.posts || [];
  const linkReports: any[] = data.linkReports || [];

  console.log(`Total posts returned: ${posts.length}`);

  let destinationCount = 0;
  let destinationWithUrlCount = 0;
  let destinationMissingUrlCount = 0;
  let naturalCount = 0;
  let urlInPart1Count = 0;
  let over500Count = 0;

  posts.forEach((p, idx) => {
    const parts = Array.isArray(p.threadParts) && p.threadParts.length > 0 ? p.threadParts : [p.singlePost];
    const fullText = parts.join("\n---\n");
    const urls = fullText.match(/https?:\/\/[^\s)]+/g) || [];
    const report = linkReports[idx] || {};

    const hasDestinationCta = report.hasCta || p.ctaDecision === "include" || urls.length > 0;
    
    if (urls.length > 0 && parts[0].includes(urls[0])) {
      urlInPart1Count++;
    }

    parts.forEach((pt: string) => {
      if (pt.length > 500) over500Count++;
    });

    if (hasDestinationCta) {
      destinationCount++;
      if (urls.length > 0) {
        destinationWithUrlCount++;
      } else {
        destinationMissingUrlCount++;
      }
      console.log(`Post #${idx + 1}: DESTINATION CTA | URLs: ${urls.join(", ") || "NONE"} | ctaDecision: ${p.ctaDecision} | report.hasCta: ${report.hasCta}`);
    } else {
      naturalCount++;
      console.log(`Post #${idx + 1}: NATURAL ENDING | URLs: ${urls.join(", ") || "0"} | ctaDecision: ${p.ctaDecision}`);
    }
  });

  console.log(`\nResults for ${name}:`);
  console.log(`  Destination CTAs: ${destinationCount}`);
  console.log(`  Destination with exact URL: ${destinationWithUrlCount}`);
  console.log(`  Destination missing URL: ${destinationMissingUrlCount}`);
  console.log(`  Natural endings: ${naturalCount}`);
  console.log(`  URLs in Part 1: ${urlInPart1Count}`);
  console.log(`  Parts over 500 chars: ${over500Count}`);

  return { posts, linkReports, destinationCount, destinationWithUrlCount, destinationMissingUrlCount };
}

async function main() {
  // Test 1: Angles OFF, Hooks OFF
  await runTest("TEST 1: Angles OFF, Hooks OFF", {});

  // Test 2: Angles ON, Hooks OFF
  await runTest("TEST 2: Angles ON, Hooks OFF", {
    strategicUnits: strategicAngles.map((a, i) => ({ id: `cu_${i+1}`, angle: a, sourceIdea: "Repeatable content engine" })),
    activeStrategicAngle: strategicAngles[0]
  });

  // Test 3: Angles OFF, Hooks ON
  await runTest("TEST 3: Angles OFF, Hooks ON", {
    all32Hooks: generatedHooks
  });

  // Test 4: Angles ON, Hooks ON
  await runTest("TEST 4: Angles ON, Hooks ON", {
    strategicUnits: strategicUnits,
    all32Hooks: generatedHooks,
    activeStrategicAngle: strategicAngles[0]
  });
}

main().catch(console.error);
