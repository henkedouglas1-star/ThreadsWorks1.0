import fetch from "node-fetch";
import fs from "fs";
import crypto from "crypto";

async function runExactVerification() {
  console.log("================================================================================");
  console.log("THREADSWORKS — EXACT TEST INPUTS GENERATION RUN");
  console.log("================================================================================");

  const customInstruction = `I’m the creator of ThreadsWorks, an AI platform I’m building to help Threads creators create, organize, schedule, publish, and improve their content using analytics. My vision is for it to become a complete AI operating system for Threads creators, with a simple workflow that helps them move from an idea to published content and learn from what happens afterward.

I’m building ThreadsWorks while working at Peet’s Coffee and managing everyday responsibilities. My creator journey happens around a real work schedule, limited time, and the challenges of building a business. That experience shapes how I think about the product. I want ThreadsWorks to reduce the work required to stay consistent, make decisions, and turn ideas into useful content.

My broader brand is Content Pays You. I believe content can help creators build trust, start conversations, attract clients, sell products, and earn income. The business principle behind my work is: Attention → Conversations → Clarity → Sale. I care about helping creators understand what to do with the attention they earn and how their content connects to something they offer.

My audience includes creators with small audiences, people building personal brands, digital product sellers, and entrepreneurs who are creating content alongside other responsibilities. Some struggle to publish consistently. Others already get views and engagement but have trouble turning that activity into business opportunities. I want my content to speak to those specific experiences without assuming everyone has the same problem.

ThreadsWorks is both a business I’m developing and a personal journey I’m willing to share. My content should let people understand the person making the decisions: what I’m working toward, what I’m learning, what frustrates me, and why certain problems matter enough for me to solve them.

Building the product has involved broken content workflows, scheduling and publishing issues, technical limits, and repeated troubleshooting. Those experiences have made reliability a central priority. Creating content, scheduling it, publishing it to Threads, and learning from analytics are the core workflow. New features should strengthen that workflow, and product updates should preserve what already works.

I’ve also learned how easily added features can create more work for the user. Extra input boxes, disconnected tools, and unnecessary steps can make a product harder to use. I favor simple, reusable systems that help a creator get a useful result with less effort. AI should help people make progress without requiring them to become prompt engineers.

My personal content can explore balancing employment and entrepreneurship, making time to build, handling frustration, staying motivated through setbacks, and deciding what deserves my attention. It can also reflect my curiosity about AI, creative work, and turning ideas into something people can use. Personal posts should have room to stand on their own without always becoming a lesson or a promotion for ThreadsWorks.

My business content can explore creator problems, content strategy, positioning, monetization, product development, customer experience, and the decisions behind ThreadsWorks. I’m interested in what helps someone get value quickly, return to a tool, and make it part of their routine. When I share product decisions, explain the creator problem behind them and the practical benefit I’m working toward.

The connection between personal and business content should feel natural. A frustrating development experience might lead to a reflection about expectations. Simplifying a workflow might lead to an insight about respecting a customer’s time. A small win might simply be something I’m proud to share. Avoid forcing every experience into a business lesson.

My voice is direct, conversational, thoughtful, and practical. I prefer clear language, specific observations, and concise writing that sounds like a person sharing something they have experienced. Avoid corporate language, exaggerated promises, generic motivational advice, and presenting me as someone who has everything figured out.

Use the information I provide as the factual foundation. Do not invent personal events, conversations, customer feedback, testimonials, revenue, growth metrics, or successful outcomes. Distinguish between my vision for ThreadsWorks, work in progress, and capabilities that are confirmed to function. When a specific story is unavailable, express a perspective or observation without fabricating an experience.

The overall goal is to build a recognizable personal brand alongside ThreadsWorks. I want people to connect with me, understand the problems I care about, learn something useful from my content, and develop trust in the business I’m building.`;

  const exactContentRequest = `Create a varied collection of Threads posts about my personal journey and the business I’m building through ThreadsWorks. Use my creator context to connect my experiences, beliefs, challenges, and ambitions with useful insights for creators and entrepreneurs. Distribute attention across personal reflection, building updates, product decisions, creator challenges, and business perspectives, incorporating my real experiences balancing a day job at Peet's Coffee, Content Pays You principles, and simplifying creator workflows without invented statistics or fake client stories.`;

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

  const payload = {
    topic: exactContentRequest,
    category: "auto",
    count: 8,
    threadLength: "auto",
    sentencesPerPart: "auto",
    characterLimit: 500,
    offer: "ThreadsWorks Pro ($7/month)",
    audience: "Creators with small audiences, personal brand builders, digital product sellers, and entrepreneurs creating content alongside other responsibilities",
    desiredResult: "predictable audience growth and client inquiries without burning out",
    writingStyle: "Direct, conversational, thoughtful, practical, clear language, specific observations, and concise writing based on real experiences without fake stories or exaggerated promises",
    customInstruction: customInstruction,
    contentDestinations: myLinksEntries,
    ctaPreferences: "When a post includes a call to action, naturally connect to the most relevant saved MY LINKS destination URL.",
    activeStrategicAngle: undefined,
    lockedOpeningHook: undefined,
    openingLocked: false,
    userId: "vtMSWyRs4YbUqwwCZsdW3Tvv2wk2"
  };

  console.log("Dispatching request to http://localhost:3000/api/generate-posts-batch...");
  const t0 = Date.now();
  const res = await fetch("http://localhost:3000/api/generate-posts-batch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": "vtMSWyRs4YbUqwwCZsdW3Tvv2wk2"
    },
    body: JSON.stringify(payload)
  });

  const durationSec = ((Date.now() - t0) / 1000).toFixed(2);
  console.log(`Response status: ${res.status} (took ${durationSec}s)`);

  if (!res.ok) {
    const errText = await res.text();
    console.error("Request failed:", res.status, errText);
    process.exit(1);
  }

  const rawText = await res.text();
  const checksum = crypto.createHash("sha256").update(rawText).digest("hex");
  const data = JSON.parse(rawText);
  const posts: any[] = data.posts || [];
  console.log(`Generated Posts count: ${posts.length}`);
  console.log(`Response SHA256 Checksum: ${checksum}`);

  fs.writeFileSync(
    "scripts/live_exact_request_result.json",
    JSON.stringify({ checksum, payload, data }, null, 2),
    "utf-8"
  );
  console.log("Saved exact test run payload and output to scripts/live_exact_request_result.json\n");

  return { checksum, payload, data, posts };
}

runExactVerification().catch(err => {
  console.error("Verification script error:", err);
  process.exit(1);
});
