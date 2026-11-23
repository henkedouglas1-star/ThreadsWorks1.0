import fetch from "node-fetch";

async function test32() {
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

  const res = await fetch("http://localhost:3000/api/generate-posts-batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data: any = await res.json();
  const posts: any[] = data.posts || [];
  const linkReports: any[] = data.linkReports || [];

  let naturalEndings = 0;
  let engagementCtas = 0;
  let destinationCtas = 0;
  let postsWithUrl = 0;
  let maxPartLength = 0;
  let partsOver500 = 0;

  posts.forEach((p, idx) => {
    const parts = p.threadParts || [p.singlePost];
    const fullText = parts.join("\n---\n");
    const urls = fullText.match(/https?:\/\/[^\s)]+/g) || [];
    const lastPart = parts[parts.length - 1] || "";
    const lastPartLower = lastPart.toLowerCase();

    parts.forEach(part => {
      if (part.length > maxPartLength) maxPartLength = part.length;
      if (part.length > 500) partsOver500++;
    });

    const isEngagement = /\?/.test(lastPart) || /\b(reply|comment|share|what part|how do you|do you|have you|did you)\b/i.test(lastPartLower);
    const hasUrl = urls.length > 0;

    if (hasUrl) {
      destinationCtas++;
      postsWithUrl++;
      console.log(`Post #${idx + 1} [Destination CTA]: URL=${urls[0]} | Last part: "${lastPart.slice(-80)}"`);
    } else if (isEngagement) {
      engagementCtas++;
      console.log(`Post #${idx + 1} [Engagement CTA]: No URL (Question/Prompt)`);
    } else {
      naturalEndings++;
      console.log(`Post #${idx + 1} [Natural Ending]: No URL`);
    }
  });

  console.log("\n==================================================");
  console.log("CTA OPTIONALITY & MY LINKS SUMMARY REPORT");
  console.log("==================================================");
  console.log(`Total Posts Generated: ${posts.length}`);
  console.log(`Natural-ending posts: ${naturalEndings}`);
  console.log(`Engagement-CTA posts: ${engagementCtas}`);
  console.log(`Destination-CTA posts: ${destinationCtas}`);
  console.log(`Posts with URLs: ${postsWithUrl}`);
  console.log(`Maximum final part length: ${maxPartLength} characters`);
  console.log(`Parts over 500 characters: ${partsOver500}`);
  console.log("==================================================");
}

test32().catch(console.error);
