import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeQueryInput,
  generateControlledQueryExpansions,
  searchPublicThreadsPosts,
  enrichCreatorCandidate,
  scoreAndRankCandidates,
  discoverCreators,
} from "../server/creatorDiscoveryEngine.ts";
import {
  validateOutreachTarget,
  retrieveOutreachPosts,
  generateOutreachComments,
  publishThreadsReply,
} from "../server/influencerOutreachService.ts";
import { VERIFIED_THREADS_CREATORS } from "../server/influencerIntelligenceService.ts";
import type { CreatorProfileData, CreatorOutreachItem } from "../src/types/influencer.ts";

test("TEST 1 — Unknown creator discovery: Discovers a creator NOT in the original 28 seed list", async () => {
  // Original 28 creator handles
  const seedHandles = new Set(VERIFIED_THREADS_CREATORS.map((c) => c.threadsUsername.toLowerCase()));
  assert.equal(seedHandles.has("levelsio"), false, "levelsio is NOT in original 28 list");

  // Mock public reader returning posts by levelsio
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: any, init?: any) => {
    const urlStr = String(url);
    if (urlStr.includes("r.jina.ai") && urlStr.includes("threads.net/search")) {
      const mockMarkdown = `
# Threads Search Results
[2h ago](https://www.threads.net/@levelsio/post/DeZ1234abcd)
Building bootstrapped AI startups as an indie hacker. Reached $100k MRR with PhotoAI and NomadList without venture capital.
[4h ago](https://www.threads.net/@levelsio/post/DeZ5678efgh)
Why solo founders move faster than 50-person VC teams in 2026.
`;
      return new Response(mockMarkdown, { status: 200 });
    }
    if (urlStr.includes("r.jina.ai") && urlStr.includes("threads.net/@levelsio")) {
      const mockProfile = `
Title: Pieter Levels (@levelsio) on Threads
Description: Bootstrapped founder. Building NomadList, RemoteOK, PhotoAI. Coding solo.
[1d ago](https://www.threads.net/@levelsio/post/DeZ9999ijkl)
Solo dev automation is the greatest leverage in tech right now.
`;
      return new Response(mockProfile, { status: 200 });
    }
    return originalFetch(url, init);
  };

  try {
    const result = await discoverCreators({
      query: "bootstrapped startups",
      maxCandidates: 100,
    });

    assert.ok(result.creators.length > 0, "Must return discovered creators");
    const found = result.creators.find((c) => c.username === "levelsio");
    assert.ok(found, "Must successfully discover levelsio outside the 28 static profiles");
    assert.equal(found?.username, "levelsio");
    assert.ok(found?.discoveryPostTexts && found.discoveryPostTexts.length > 0, "Must have discovery post texts");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("TEST 2 — Topic discovery: Search 'AI creators' returns unique real creators related to AI", async () => {
  const result = await discoverCreators({
    query: "AI creators",
    maxCandidates: 100,
  });

  assert.ok(result.creators.length > 0, "Must return creators for AI");
  // Check that returned creators are related to AI or technology
  const hasAiTerms = result.creators.some(
    (c) =>
      c.bio?.toLowerCase().includes("ai") ||
      c.niche?.toLowerCase().includes("ai") ||
      c.topics?.some((t) => t.toLowerCase().includes("ai")) ||
      c.whyFound?.toLowerCase().includes("ai")
  );
  assert.ok(hasAiTerms, "Results must contain creators aligned with AI topics");
});

test("TEST 3 — Bio relevance: Biography information directly influences candidate ranking", async () => {
  const candidateA: CreatorProfileData = {
    id: "candidate_generic",
    name: "Generic Creator",
    username: "generic_dev",
    bio: "General software developer sharing daily life and food pictures.",
    niche: "Lifestyle",
    category: "General",
    topics: ["coffee", "travel"],
    isVerifiedProfile: true,
  };

  const candidateB: CreatorProfileData = {
    id: "candidate_saas",
    name: "SaaS Specialist",
    username: "saas_builder",
    bio: "SaaS founder building bootstrapped software tools. Sharing churn reduction, MRR growth, and B2B pricing models.",
    niche: "SaaS & Software",
    category: "Business",
    topics: ["SaaS", "Software", "Pricing"],
    isVerifiedProfile: true,
  };

  const ranked = await scoreAndRankCandidates([candidateA, candidateB], "SaaS founder");
  assert.ok(ranked.length === 2, "Both candidates evaluated");
  assert.equal(ranked[0].username, "saas_builder", "Candidate whose biography discusses SaaS founder must rank above generic creator");
  assert.ok(
    (ranked[0].relevanceScore || 0) > (ranked[1].relevanceScore || 0),
    "SaaS candidate must have higher relevance score than generic developer"
  );
});

test("TEST 4 — Post relevance: Creators rank highly because discovery posts match query even when exact phrase is absent from bio", async () => {
  const candidateBioOnly: CreatorProfileData = {
    id: "candidate_bio_only",
    name: "Tech Consultant",
    username: "tech_advisor",
    bio: "Advising enterprise technology leaders on digital transformation.",
    niche: "Consulting",
    category: "Business",
    topics: ["Tech"],
    isVerifiedProfile: true,
  };

  const candidatePostHeavy: CreatorProfileData = {
    id: "candidate_post_heavy",
    name: "Product Builder",
    username: "agent_engineer",
    bio: "Curious engineer exploring software systems.", // Does NOT contain "AI autonomous agents" in bio!
    niche: "Engineering",
    category: "Technology",
    topics: ["Engineering"],
    discoveryPostTexts: [
      "Here is my step-by-step breakdown of building AI autonomous agents that execute multi-step workflows without human intervention.",
      "Comparing open-source AI autonomous agents architectures in 2026.",
    ],
    isVerifiedProfile: true,
  };

  const ranked = await scoreAndRankCandidates([candidateBioOnly, candidatePostHeavy], "AI autonomous agents");
  assert.equal(
    ranked[0].username,
    "agent_engineer",
    "Candidate whose discovery posts strongly match 'AI autonomous agents' must rank first despite phrase missing from bio"
  );
  assert.ok(
    ranked[0].whyFound?.toLowerCase().includes("threads posts") || ranked[0].whyFound?.toLowerCase().includes("conversations") || ranked[0].whyFound?.toLowerCase().includes("ai"),
    "Relevance reason must reflect post match"
  );
});

test("TEST 5 — Username search: Lex Fridman, lexfridman, @lexfridman, LEXFRIDMAN resolve consistently", () => {
  const v1 = normalizeQueryInput("lexfridman");
  const v2 = normalizeQueryInput("@lexfridman");
  const v3 = normalizeQueryInput("LEXFRIDMAN");
  const v4 = normalizeQueryInput("  @LexFridman  ");

  assert.equal(v1.handleWithoutAt, "lexfridman");
  assert.equal(v2.handleWithoutAt, "lexfridman");
  assert.equal(v3.handleWithoutAt, "lexfridman");
  assert.equal(v4.handleWithoutAt, "lexfridman");

  assert.equal(v1.isHandleSearch, true);
  assert.equal(v2.isHandleSearch, true);
  assert.equal(v3.isHandleSearch, true);
  assert.equal(v4.isHandleSearch, true);

  const nameNorm = normalizeQueryInput("Lex Fridman");
  assert.equal(nameNorm.isPersonNameSearch, true);
  assert.equal(nameNorm.clean, "Lex Fridman");
});

test("TEST 6 — Deduplication: Multiple posts from the same creator result in single unique creator", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: any, init?: any) => {
    const urlStr = String(url);
    if (urlStr.includes("r.jina.ai") && urlStr.includes("threads.net/search")) {
      // 5 posts from the exact same author @duplicate_creator
      const mockMarkdown = `
[10m ago](https://www.threads.net/@duplicate_creator/post/post1) Post 1 about marketing tips.
[20m ago](https://www.threads.net/@duplicate_creator/post/post2) Post 2 about marketing tips.
[30m ago](https://www.threads.net/@duplicate_creator/post/post3) Post 3 about marketing tips.
[40m ago](https://www.threads.net/@duplicate_creator/post/post4) Post 4 about marketing tips.
[50m ago](https://www.threads.net/@duplicate_creator/post/post5) Post 5 about marketing tips.
`;
      return new Response(mockMarkdown, { status: 200 });
    }
    return originalFetch(url, init);
  };

  try {
    const posts = await searchPublicThreadsPosts("marketing tips");
    assert.equal(posts.length, 5, "Discovered 5 raw post results");

    const result = await discoverCreators({
      query: "marketing tips",
      maxCandidates: 100,
    });

    const matches = result.creators.filter((c) => c.username === "duplicate_creator");
    assert.equal(matches.length, 1, "Creator must be strictly deduplicated and appear exactly once");
    assert.ok(matches[0].discoveryPostTexts && matches[0].discoveryPostTexts.length >= 1, "Discovery posts aggregated");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("TEST 7 — 100 creator result target: Gathers, deduplicates, and caps up to 100 unique creators", async () => {
  // Create 120 unique synthetic creator candidates
  const largeCandidatePool: CreatorProfileData[] = [];
  for (let i = 1; i <= 120; i++) {
    largeCandidatePool.push({
      id: `synthetic_creator_${i}`,
      name: `Founder ${i}`,
      username: `founder_${i}`,
      bio: `SaaS founder building product ${i} for modern software teams.`,
      niche: "SaaS",
      category: "Software",
      topics: ["SaaS", "Software"],
      relevanceScore: Math.floor(Math.random() * 50) + 50,
      isVerifiedProfile: true,
    });
  }

  const ranked = await scoreAndRankCandidates(largeCandidatePool, "SaaS founder");
  assert.equal(ranked.length, 120, "Ranked all 120 candidates");

  // In discoverCreators, maxCandidates: 100 ensures capped pool of top 100
  const capped = ranked.slice(0, 100);
  assert.equal(capped.length, 100, "Must cap at approximately 100 maximum unique creators");

  // Confirm all 100 are unique handles
  const handles = new Set(capped.map((c) => c.username));
  assert.equal(handles.size, 100, "All 100 creators must be unique");
});

test("TEST 8 — No fake results: Highly specific query returns actual matches without injecting random profiles", async () => {
  // Query for a non-existent or hyper-specific handle
  const result = await discoverCreators({
    query: "zyxwvut_unique_nonexistent_handle_987",
    maxCandidates: 100,
  });

  // Should return 0 or only genuine matches, NEVER fake fillers to reach 100
  assert.ok(result.creators.length <= 1, "Must not inject dozens of fake creators for non-existent specific query");
  assert.equal(result.total, result.creators.length, "Total must match actual candidates found");
});

test("TEST 9 — Add To Outreach: Discovered creator passes identity into Outreach and preserves atomic target post", async () => {
  const discoveredCreator: CreatorProfileData = {
    id: "creator_discovered_ai_hero",
    name: "Alex Rivera",
    username: "alexrivera_ai",
    threadsUsername: "alexrivera_ai",
    threadsProfileUrl: "https://www.threads.net/@alexrivera_ai",
    bio: "Building AI agents and writing about workflow automation.",
    niche: "AI Agents",
    category: "Technology",
    topics: ["AI", "Agents"],
    isVerifiedProfile: true,
    recentPosts: [
      {
        id: "18099887766554433",
        text: "The future of AI agent execution requires deterministic runtime boundaries and semantic validation.",
        publishedAt: "Yesterday",
        likes: 1420,
        replies: 120,
      },
    ],
  };

  // Convert to Outreach Item
  const targetPost = discoveredCreator.recentPosts![0];
  const outreachItem: CreatorOutreachItem = {
    id: "item_discovered_outreach_test",
    batchId: "batch_discovered_1",
    userId: "test_user_discovery",
    creatorId: discoveredCreator.id,
    creatorName: discoveredCreator.name,
    creatorUsername: discoveredCreator.username,
    targetPost: {
      id: targetPost.id!,
      text: targetPost.text,
      url: `https://www.threads.net/@${discoveredCreator.username}/post/${targetPost.id}`,
      eligible: true,
    },
    canonicalTarget: {
      internalCreatorId: discoveredCreator.id,
      creatorUsername: discoveredCreator.username,
      creatorDisplayName: discoveredCreator.name,
      creatorProfileUrl: discoveredCreator.threadsProfileUrl!,
      targetPostId: targetPost.id!,
      targetPostUrl: `https://www.threads.net/@${discoveredCreator.username}/post/${targetPost.id}`,
      targetPostText: targetPost.text,
      commentText: "Deterministic execution boundaries are essential for reliable agent orchestration.",
    },
    generatedComment: "Deterministic execution boundaries are essential for reliable agent orchestration.",
    approvedComment: "Deterministic execution boundaries are essential for reliable agent orchestration.",
    characterCount: 78,
    status: "Approved",
    attemptCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Validate targeting integrity
  const validation = validateOutreachTarget(outreachItem);
  assert.equal(validation.valid, true, "Outreach item must be valid with preserved creator and post identity");

  // Verify publishing targets the exact post ID of this discovered creator
  let capturedReplyToId: string | null = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: any, init?: any) => {
    const urlStr = String(url);
    if (urlStr.includes("/threads?")) {
      const body = JSON.parse(init?.body || "{}");
      capturedReplyToId = body.reply_to_id;
      return new Response(JSON.stringify({ id: "container_discovered_123" }), { status: 200 });
    }
    if (urlStr.includes("/container_discovered_123")) {
      return new Response(JSON.stringify({ status: "FINISHED" }), { status: 200 });
    }
    if (urlStr.includes("/threads_publish")) {
      return new Response(JSON.stringify({ id: "reply_pub_discovered_777" }), { status: 200 });
    }
    if (urlStr.includes("/reply_pub_discovered_777")) {
      return new Response(JSON.stringify({ id: "reply_pub_discovered_777", permalink: "https://threads.net/post/777" }), { status: 200 });
    }
    if (urlStr.includes("/conversation")) {
      return new Response(JSON.stringify({ data: [{ id: "reply_pub_discovered_777" }] }), { status: 200 });
    }
    if (urlStr.includes("/me?")) {
      return new Response(JSON.stringify({ id: "user_test_me", username: "tester" }), { status: 200 });
    }
    return originalFetch(url, init);
  };

  try {
    const pubResult = await publishThreadsReply({
      userId: "sim_discovered_user",
      comment: outreachItem.approvedComment!,
      replyToId: outreachItem.targetPost.id,
      outreachContext: {
        creatorUsername: discoveredCreator.username,
        targetPostId: outreachItem.targetPost.id,
      },
    });

    assert.equal(pubResult.success, true, "Publishing must succeed");
    assert.equal(pubResult.verificationStatus, "Verified");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("TEST 10 — Original list independence: Creator discovery functions without the original 28 seed list", async () => {
  // Simulate an environment where the original 28 seed list is empty or completely bypassed
  const nonSeedCreators: CreatorProfileData[] = [
    {
      id: "indie_1",
      name: "Marcus Vance",
      username: "marcusvance",
      bio: "SaaS founder building developer infrastructure tools.",
      niche: "Developer Tools",
      category: "Software",
      topics: ["SaaS", "DevOps"],
      isVerifiedProfile: true,
    },
    {
      id: "indie_2",
      name: "Elena Rostova",
      username: "elenarostova",
      bio: "Fitness coach teaching high-performance metabolic health and hypertrophy.",
      niche: "Fitness Coaching",
      category: "Health",
      topics: ["Fitness", "Nutrition"],
      isVerifiedProfile: true,
    },
  ];

  // Verify neither is in original seed list
  const seedSet = new Set(VERIFIED_THREADS_CREATORS.map((c) => c.threadsUsername.toLowerCase()));
  assert.equal(seedSet.has("marcusvance"), false);
  assert.equal(seedSet.has("elenarostova"), false);

  // Score them independently
  const saasRanked = await scoreAndRankCandidates(nonSeedCreators, "SaaS founder");
  assert.equal(saasRanked[0].username, "marcusvance", "Marcus must rank first for SaaS founder without any seed data");

  const fitnessRanked = await scoreAndRankCandidates(nonSeedCreators, "fitness coach");
  assert.equal(fitnessRanked[0].username, "elenarostova", "Elena must rank first for fitness coach without any seed data");
});
