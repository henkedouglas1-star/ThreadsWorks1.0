import fetch from "node-fetch";

async function debugBatch() {
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
    }
  ];

  const payload = {
    topic: "Building a repeatable content engine with ThreadsWorks to reach predictable audience growth",
    category: "auto",
    count: "2",
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
  console.log("Status:", res.status);
  console.log("Link Reports:", JSON.stringify(data.linkReports, null, 2));
  console.log("URL Stats:", JSON.stringify(data.urlStats, null, 2));
  console.log("Posts:", JSON.stringify(data.posts, null, 2));
}

debugBatch().catch(console.error);
