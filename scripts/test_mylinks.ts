import { applyMyLinksToBatch } from "../server/myLinksService";

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

const samplePost = {
  title: "Test Post",
  hook: "If your Threads posts get views but 0 replies, check your opening 5 words.",
  singlePost: "If your Threads posts get views but 0 replies, check your opening 5 words.",
  threadParts: [
    "If your Threads posts get views but 0 replies, check your opening 5 words.",
    "Your first five words determine whether someone stops scrolling or keeps moving.\n\nIf you want to turn your next idea into a finished post, start here:"
  ],
  cta: "If you want to turn your next idea into a finished post, start here:"
};

const result = applyMyLinksToBatch([samplePost], myLinksEntries);
console.log("Result posts:", JSON.stringify(result.posts, null, 2));
console.log("Link reports:", JSON.stringify(result.reports, null, 2));
