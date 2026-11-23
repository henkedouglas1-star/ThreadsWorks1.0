async function runFeatureTests() {
  const BASE_URL = "http://localhost:3000";
  console.log("=== TESTING ALL WORKING THREADSWORKS BACKEND FEATURES ===");
  
  let passedCount = 0;
  let totalCount = 0;

  function report(name: string, success: boolean, detail?: string) {
    totalCount++;
    if (success) {
      console.log(`[PASS] ${name}`);
      passedCount++;
    } else {
      console.error(`[FAIL] ${name}: ${detail || "Check failed"}`);
    }
  }

  const sampleProfile = {
    uid: "test_user_123",
    offer: "ThreadsWorks Growth System",
    audience: "creators and digital entrepreneurs",
    desiredResult: "$10k/month in consulting client revenue",
    writingStyle: "Punchy, relatable, authoritative, zero fluff",
    customInstruction: "Write short sentences. Never use buzzwords.",
    ctaPreferences: "Soft hand-raiser with keyword comments"
  };

  // Test 1: Batch Generation (Category: Attention)
  try {
    const res = await fetch(`${BASE_URL}/api/generate-posts-batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: "attention",
        count: 2,
        offer: sampleProfile.offer,
        audience: sampleProfile.audience,
        desiredResult: sampleProfile.desiredResult,
        writingStyle: sampleProfile.writingStyle,
        characterLimit: 480,
        sentencesPerPart: 3,
        threadLength: "3"
      })
    });
    const data = await res.json();
    const valid = res.ok && Array.isArray(data.posts) && data.posts.length > 0;
    const post0 = data.posts?.[0];
    const hasParts = Array.isArray(post0?.threadParts) && post0.threadParts.length >= 1;
    const noBrokenMarkdown = !post0?.singlePost?.includes("**.");
    const hasIntegrity = Boolean(post0?.integrityReport?.passed);
    report("API /api/generate-posts-batch (Attention)", valid && hasParts && noBrokenMarkdown, `status=${res.status}, parts=${post0?.threadParts?.length}, integrity=${hasIntegrity}`);
  } catch (err: any) {
    report("API /api/generate-posts-batch (Attention)", false, err.message);
  }

  // Test 2: Batch Generation (Category: Trust)
  try {
    const res = await fetch(`${BASE_URL}/api/generate-posts-batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: "trust",
        count: 2,
        offer: sampleProfile.offer,
        audience: sampleProfile.audience,
        desiredResult: sampleProfile.desiredResult,
        characterLimit: 480,
        sentencesPerPart: 2,
        threadLength: "3"
      })
    });
    const data = await res.json();
    report("API /api/generate-posts-batch (Trust)", res.ok && Array.isArray(data.posts), `status=${res.status}`);
  } catch (err: any) {
    report("API /api/generate-posts-batch (Trust)", false, err.message);
  }

  // Test 3: Batch Generation (Category: Sales with Soft Hand Raiser)
  try {
    const res = await fetch(`${BASE_URL}/api/generate-posts-batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: "sales",
        count: 2,
        offer: sampleProfile.offer,
        audience: sampleProfile.audience,
        desiredResult: sampleProfile.desiredResult,
        characterLimit: 480,
        sentencesPerPart: 3,
        threadLength: "4"
      })
    });
    const data = await res.json();
    const post = data.posts?.[0];
    const hasCta = post?.threadParts?.some((p: string) => /reply|comment|send|dm|reach out/i.test(p));
    report("API /api/generate-posts-batch (Sales)", res.ok && hasCta, `status=${res.status}, hasCta=${hasCta}`);
  } catch (err: any) {
    report("API /api/generate-posts-batch (Sales)", false, err.message);
  }

  // Test 4: Create Best Post (Automatic Opportunity Selection)
  try {
    const res = await fetch(`${BASE_URL}/api/create-best-post`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: sampleProfile.uid,
        profile: sampleProfile,
        focusInput: ""
      })
    });
    const data = await res.json();
    const valid = res.ok && data.post && Array.isArray(data.post.threadParts);
    const part1IsHook = data.post?.threadParts?.[0] === data.post?.hook;
    const hasReport = Boolean(data.post?.integrityReport);
    report("API /api/create-best-post (Auto)", valid && part1IsHook, `status=${res.status}, part1IsHook=${part1IsHook}, hasReport=${hasReport}`);
  } catch (err: any) {
    report("API /api/create-best-post (Auto)", false, err.message);
  }

  // Test 5: Create Best Post with Focus & Locked Opening Hook
  try {
    const lockedHook = "Stop trying to write for everyone. Write for the one person ready to buy.";
    const res = await fetch(`${BASE_URL}/api/create-best-post`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: sampleProfile.uid,
        profile: sampleProfile,
        focusInput: "Audience targeting & core client messaging",
        hook: lockedHook
      })
    });
    const data = await res.json();
    const matchesHook = data.post?.hook === lockedHook && data.post?.threadParts?.[0] === lockedHook;
    report("API /api/create-best-post (Locked Hook)", res.ok && matchesHook, `hookMatch=${matchesHook}`);
  } catch (err: any) {
    report("API /api/create-best-post (Locked Hook)", false, err.message);
  }

  // Test 6: Regenerate Single Post
  try {
    const res = await fetch(`${BASE_URL}/api/regenerate-single-post`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: "attention",
        offer: sampleProfile.offer,
        audience: sampleProfile.audience,
        desiredResult: sampleProfile.desiredResult,
        threadLength: "3",
        sentencesPerPart: 3
      })
    });
    const data = await res.json();
    report("API /api/regenerate-single-post", res.ok && Array.isArray(data.threadParts), `status=${res.status}`);
  } catch (err: any) {
    report("API /api/regenerate-single-post", false, err.message);
  }

  // Test 7: Optimize Post
  try {
    const res = await fetch(`${BASE_URL}/api/optimize-post`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        post: {
          id: "post_1",
          title: "Draft Post",
          hook: "Most creators fail to get clients.",
          singlePost: "Most creators fail to get clients.\n\nThey face administrative bottlenecks,and struggle to scale your impact.",
          threadParts: [
            "Most creators fail to get clients.",
            "They face administrative bottlenecks,and struggle to scale your impact."
          ],
          explanation: "Draft explanation",
          category: "attention"
        },
        profile: sampleProfile
      })
    });
    const data = await res.json();
    const optimized = data.optimizedPost;
    const noCorporate = !optimized?.threadParts?.some((p: string) => p.includes("administrative bottlenecks"));
    const hasScores = Boolean(data.scores && data.scores.overall);
    report("API /api/optimize-post", res.ok && noCorporate && hasScores, `status=${res.status}, score=${data.scores?.overall}`);
  } catch (err: any) {
    report("API /api/optimize-post", false, err.message);
  }

  // Test 8: Generate Next Part (Continuation)
  try {
    const res = await fetch(`${BASE_URL}/api/generate-next-part`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        existingParts: [
          "Most creators fail to get clients on Threads.",
          "They copy broad advice instead of speaking directly to their ideal buyer."
        ],
        category: "attention",
        offer: sampleProfile.offer,
        audience: sampleProfile.audience,
        desiredResult: sampleProfile.desiredResult
      })
    });
    const data = await res.json();
    const hasPart = Boolean(data.part && typeof data.part === "string");
    report("API /api/generate-next-part", res.ok && hasPart, `status=${res.status}, length=${data.part?.length}`);
  } catch (err: any) {
    report("API /api/generate-next-part", false, err.message);
  }

  // Test 9: Dynamic Hook Generation
  try {
    const res = await fetch(`${BASE_URL}/api/generate-dynamic-hook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: "attention",
        offer: sampleProfile.offer,
        audience: sampleProfile.audience,
        desiredResult: sampleProfile.desiredResult
      })
    });
    const data = await res.json();
    const hasHook = Boolean(data.hook && typeof data.hook === "string");
    report("API /api/generate-dynamic-hook", res.ok && hasHook, `status=${res.status}, hook="${data.hook?.slice(0, 40)}..."`);
  } catch (err: any) {
    report("API /api/generate-dynamic-hook", false, err.message);
  }

  // Test 10: Dynamic Angle Generation
  try {
    const res = await fetch(`${BASE_URL}/api/generate-dynamic-angle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: "trust",
        offer: sampleProfile.offer,
        audience: sampleProfile.audience,
        desiredResult: sampleProfile.desiredResult
      })
    });
    const data = await res.json();
    const hasAngle = Boolean(data.angle && typeof data.angle === "string");
    report("API /api/generate-dynamic-angle", res.ok && hasAngle, `status=${res.status}`);
  } catch (err: any) {
    report("API /api/generate-dynamic-angle", false, err.message);
  }

  console.log(`\nFeature test summary: ${passedCount}/${totalCount} tests passed.`);
  if (passedCount === totalCount) {
    console.log("ALL BACKEND ENDPOINTS ARE FULLY OPERATIONAL!");
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runFeatureTests().catch(err => {
  console.error("Test runner error:", err);
  process.exit(1);
});
