import test from "node:test";
import assert from "node:assert/strict";

// Provide a minimal in-memory window/localStorage shim for browser-persisted canonicalContent tests
const memoryStore = new Map<string, string>();
const dispatchedEvents: Array<{ type: string; detail: any }> = [];

if (typeof (globalThis as any).window === "undefined") {
  (globalThis as any).window = {
    dispatchEvent: (evt: any) => {
      dispatchedEvents.push({ type: evt?.type, detail: evt?.detail });
      return true;
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}
if (typeof (globalThis as any).CustomEvent === "undefined") {
  (globalThis as any).CustomEvent = class CustomEvent {
    type: string;
    detail: any;
    constructor(type: string, init?: { detail?: any }) {
      this.type = type;
      this.detail = init?.detail;
    }
  };
}
if (typeof (globalThis as any).localStorage === "undefined") {
  (globalThis as any).localStorage = {
    getItem: (k: string) => (memoryStore.has(k) ? memoryStore.get(k)! : null),
    setItem: (k: string, v: string) => {
      memoryStore.set(k, String(v));
    },
    removeItem: (k: string) => {
      memoryStore.delete(k);
    },
    clear: () => {
      memoryStore.clear();
    },
  };
}

import {
  CanonicalContentRecord,
  CONTENT_UPDATED_EVENT,
  normalizeCanonicalRecord,
  saveCanonicalRecord,
  updateCanonicalRecord,
  updateCanonicalStage,
  readLocalCanonicalRecords,
  writeLocalCanonicalRecords,
  upsertLocalCanonicalRecord,
  mergeCanonicalRecords,
  formatLocalDateKey,
} from "../src/lib/canonicalContent.ts";

import {
  filterAndSortLibraryRecords,
  extractAvailableFacets,
  detectDuplicateGroups,
  findRelatedContent,
  buildWeeklyPlanSlots,
  buildGroundedRecommendations,
  buildDeterministicWeeklyPlanFallback,
} from "../src/lib/contentIntelligence.ts";

import {
  classifyContentOrganization,
  deterministicClassifyItems,
  generateWeeklyPlanRecommendations,
  buildDeterministicWeeklyPlanServer,
} from "../server/contentPlanningService.ts";

function resetStorage() {
  memoryStore.clear();
  dispatchedEvents.length = 0;
}

const SAMPLE_PROFILE: any = {
  uid: "user-alpha",
  offer: "Threads Growth System",
  audience: "Solo creators and consultants",
  desiredResult: "Consistent inbound leads without burnout",
  writingStyle: "Direct, practical, conversational",
  contentPillars: [
    { id: "p1", title: "Audience Growth", description: "Organic reach and hooks on Threads" },
    { id: "p2", title: "Offer Positioning", description: "Turning profile visits into client inquiries" },
    { id: "p3", title: "Weekly Systems", description: "Sustainable content batching and planning" },
  ],
};

// 1. Create & save an Idea
test("1. Creating and saving an Idea stores canonical Idea stage with zero scheduledFor", async () => {
  resetStorage();
  const saved = await saveCanonicalRecord(
    {
      userId: "user-alpha",
      title: "Why daily consistency beats viral spikes",
      singlePost: "A 15-minute daily publishing cadence compounds faster than chasing one viral thread.",
      stage: "Idea",
      topic: "Consistency",
      topics: ["Consistency", "Creator Habits"],
      pillarTitle: "Weekly Systems",
    },
    SAMPLE_PROFILE
  );

  assert.equal(saved.stage, "Idea");
  assert.equal(saved.status, "Idea");
  assert.equal(saved.isIdea, true);
  assert.equal(saved.scheduledFor, null);
  assert.equal(saved.pillarTitle, "Weekly Systems");
  assert.deepEqual(saved.topics, ["Consistency", "Creator Habits"]);

  const stored = readLocalCanonicalRecords("user-alpha");
  assert.equal(stored.length, 1);
  assert.equal(stored[0].id, saved.id);
  assert.ok(dispatchedEvents.some((e) => e.type === CONTENT_UPDATED_EVENT));
});

// 2. Generate/link content from a saved Idea
test("2. Content created from a saved Idea maintains sourceIdeaId and relatedIdeaIds lineage", async () => {
  resetStorage();
  const idea = await saveCanonicalRecord(
    {
      userId: "user-alpha",
      title: "Offer clarity checklist",
      singlePost: "Three signals your profile bio clearly communicates what you sell.",
      stage: "Idea",
      topic: "Offer Positioning",
      pillarTitle: "Offer Positioning",
    },
    SAMPLE_PROFILE
  );

  const draft = await saveCanonicalRecord(
    {
      userId: "user-alpha",
      title: "3 signals your Threads bio converts visitors",
      singlePost: "1. Specific audience named.\n2. Clear outcome stated.\n3. Simple next step pinned.",
      stage: "Draft",
      topic: "Offer Positioning",
      pillarTitle: "Offer Positioning",
      sourceIdeaId: idea.id,
    },
    SAMPLE_PROFILE
  );

  assert.equal(draft.sourceIdeaId, idea.id);
  assert.ok(draft.relatedIdeaIds?.includes(idea.id));

  const all = readLocalCanonicalRecords("user-alpha");
  const related = findRelatedContent(draft, all, 3);
  assert.equal(related.length, 1);
  assert.equal(related[0].record.id, idea.id);
  assert.equal(related[0].reason, "Same source idea");
});

// 3 & 4. Search, filter by topic/pillar/status, and sort in Content Library
test("3 & 4. Library search, topic/pillar/status filters, facets, and sorting work accurately", () => {
  const baseRecords: CanonicalContentRecord[] = [
    normalizeCanonicalRecord(
      {
        id: "r1",
        userId: "user-alpha",
        title: "Alpha Hook Breakdown",
        singlePost: "Strong openings state a clear observation in one line.",
        stage: "Ready",
        topics: ["Hooks", "Audience Growth"],
        pillarTitle: "Audience Growth",
        createdAt: "2026-06-01T10:00:00.000Z",
        updatedAt: "2026-06-03T10:00:00.000Z",
      },
      "user-alpha"
    ),
    normalizeCanonicalRecord(
      {
        id: "r2",
        userId: "user-alpha",
        title: "Zeta Batching Workflow",
        singlePost: "Plan Monday through Sunday in twenty minutes.",
        stage: "Draft",
        topics: ["Batching"],
        pillarTitle: "Weekly Systems",
        createdAt: "2026-06-02T10:00:00.000Z",
        updatedAt: "2026-06-02T10:00:00.000Z",
      },
      "user-alpha"
    ),
    normalizeCanonicalRecord(
      {
        id: "r3",
        userId: "user-alpha",
        title: "Beta Positioning Idea",
        singlePost: "Pin one case study post at the top of your profile.",
        stage: "Idea",
        topics: ["Case Studies"],
        pillarTitle: "Offer Positioning",
        createdAt: "2026-06-03T10:00:00.000Z",
        updatedAt: "2026-06-04T10:00:00.000Z",
      },
      "user-alpha"
    ),
    normalizeCanonicalRecord(
      {
        id: "r4",
        userId: "user-alpha",
        title: "Published Milestone",
        singlePost: "Reflecting on ninety consecutive days of Threads posts.",
        stage: "Published",
        topics: ["Consistency"],
        pillarTitle: "Weekly Systems",
        publishedAt: "2026-06-04T12:00:00.000Z",
        createdAt: "2026-06-04T10:00:00.000Z",
        updatedAt: "2026-06-04T12:00:00.000Z",
      },
      "user-alpha"
    ),
  ];

  // Text search across body/title
  const searchMatches = filterAndSortLibraryRecords(baseRecords, { searchQuery: "twenty minutes" });
  assert.deepEqual(searchMatches.map((r) => r.id), ["r2"]);

  // Filter by topic
  const topicMatches = filterAndSortLibraryRecords(baseRecords, { topic: "Hooks" });
  assert.deepEqual(topicMatches.map((r) => r.id), ["r1"]);

  // Filter by pillar
  const pillarMatches = filterAndSortLibraryRecords(baseRecords, { pillar: "Weekly Systems" });
  assert.deepEqual(pillarMatches.map((r) => r.id), ["r4", "r2"]);

  // Filter unfinished (Idea + Draft only)
  const unfinished = filterAndSortLibraryRecords(baseRecords, { stage: "unfinished" });
  assert.deepEqual(unfinished.map((r) => r.id), ["r3", "r2"]);

  // Sort by title ascending
  const byTitle = filterAndSortLibraryRecords(baseRecords, { sortBy: "title" });
  assert.deepEqual(byTitle.map((r) => r.id), ["r1", "r3", "r4", "r2"]);

  // Sort by lifecycle stage order (Idea -> Draft -> Ready -> ... -> Published)
  const byStage = filterAndSortLibraryRecords(baseRecords, { sortBy: "stage" });
  assert.deepEqual(byStage.map((r) => r.stage), ["Idea", "Draft", "Ready", "Published"]);

  // Facets include profile pillars and record topics
  const facets = extractAvailableFacets(baseRecords, SAMPLE_PROFILE);
  assert.ok(facets.topics.includes("Hooks"));
  assert.ok(facets.pillars.includes("Audience Growth"));
  assert.ok(facets.pillars.includes("Offer Positioning"));
});

// 5, 6, 7, 8, 9. Lifecycle transitions Draft -> Ready -> Planned -> Move Day -> Scheduled with ZERO duplicates + duplicate detection
test("5-9. Full lifecycle transitions preserve single record ID with zero duplicates and detect intentional duplicates", async () => {
  resetStorage();
  const refDate = new Date(2026, 5, 10, 9, 0, 0); // Wed June 10, 2026 (local)
  const slotsBefore = buildWeeklyPlanSlots([], 0, refDate);
  const thursdayKey = slotsBefore[3].dateKey; // Thu
  const fridayKey = slotsBefore[4].dateKey; // Fri

  // Step 5: Create Draft and mark Ready
  const created = await saveCanonicalRecord(
    {
      userId: "user-alpha",
      title: "Framework for clear Threads replies",
      singlePost: "Add one concrete example to every reply so readers immediately see your perspective.",
      stage: "Draft",
      topic: "Engagement",
      pillarTitle: "Audience Growth",
    },
    SAMPLE_PROFILE
  );
  const ready = await updateCanonicalStage(created.id, "Ready", undefined, "user-alpha");
  assert.equal(ready?.id, created.id);
  assert.equal(ready?.stage, "Ready");
  assert.equal(readLocalCanonicalRecords("user-alpha").length, 1);

  // Step 6: Add Ready draft to Thursday on 7-day plan
  const plannedThu = await updateCanonicalStage(
    created.id,
    "Planned",
    { plannedDate: thursdayKey },
    "user-alpha"
  );
  assert.equal(plannedThu?.stage, "Planned");
  assert.equal(plannedThu?.plannedDate, thursdayKey);
  assert.equal(plannedThu?.scheduledFor, null);

  const slotsThu = buildWeeklyPlanSlots(readLocalCanonicalRecords("user-alpha"), 0, refDate);
  assert.equal(slotsThu[3].plannedPosts.length, 1);
  assert.equal(slotsThu[3].isOpen, false);
  assert.equal(slotsThu[4].isOpen, true);

  // Step 7: Move Planned post from Thursday to Friday
  const movedFri = await updateCanonicalRecord(
    created.id,
    { stage: "Planned", plannedDate: fridayKey },
    "user-alpha"
  );
  assert.equal(movedFri?.id, created.id);
  assert.equal(movedFri?.plannedDate, fridayKey);

  const slotsFri = buildWeeklyPlanSlots(readLocalCanonicalRecords("user-alpha"), 0, refDate);
  assert.equal(slotsFri[3].plannedPosts.length, 0);
  assert.equal(slotsFri[3].isOpen, true);
  assert.equal(slotsFri[4].plannedPosts.length, 1);
  assert.equal(slotsFri[4].isOpen, false);

  // Step 8: Schedule the planned post (simulating ScheduleModal replacing temporary local ID with Firestore doc ID)
  const fridayScheduledIso = new Date(2026, 5, 12, 14, 0, 0).toISOString();
  const scheduledRecord = normalizeCanonicalRecord(
    {
      ...movedFri,
      id: "firestore-doc-123",
      stage: "Scheduled",
      status: "Scheduled",
      plannedDate: fridayKey,
      scheduledFor: fridayScheduledIso,
    },
    "user-alpha"
  );
  upsertLocalCanonicalRecord("user-alpha", scheduledRecord, created.id);

  // Step 9a: Confirm ZERO duplicates across entire lifecycle
  const afterSchedule = readLocalCanonicalRecords("user-alpha");
  assert.equal(afterSchedule.length, 1);
  assert.equal(afterSchedule[0].id, "firestore-doc-123");
  assert.equal(afterSchedule[0].stage, "Scheduled");
  assert.equal(afterSchedule[0].scheduledFor, fridayScheduledIso);

  const slotsScheduled = buildWeeklyPlanSlots(afterSchedule, 0, refDate);
  assert.equal(slotsScheduled[4].scheduledPosts.length, 1);
  assert.equal(slotsScheduled[4].plannedPosts.length, 0);
  assert.equal(slotsScheduled[4].isOpen, false);

  // Step 9b: Confirm duplicate detector accurately flags intentional exact/near duplicates
  const intentionalCopy = normalizeCanonicalRecord(
    {
      id: "dup-copy-1",
      userId: "user-alpha",
      title: "Framework for clear Threads replies (copy)",
      singlePost: "Add one concrete example to every reply so readers immediately see your perspective.",
      stage: "Draft",
    },
    "user-alpha"
  );
  const dupGroups = detectDuplicateGroups([afterSchedule[0], intentionalCopy]);
  assert.equal(dupGroups.length, 1);
  assert.equal(dupGroups[0].reason, "exact");
  assert.equal(dupGroups[0].primaryRecordId, "firestore-doc-123"); // Scheduled prioritized over Draft
});

// 10. Confirm persistence across reload (localStorage hydration + cloud merge)
test("10. Records persist cleanly across reload and merge cloud/local without duplicating IDs", () => {
  resetStorage();
  const cloudRec = normalizeCanonicalRecord(
    {
      id: "cloud-1",
      userId: "user-alpha",
      title: "Cloud Draft Updated",
      singlePost: "Updated body from Firestore cloud truth.",
      stage: "Ready",
      createdAt: "2026-06-05T10:00:00.000Z",
    },
    "user-alpha"
  );
  const staleLocalCopy = normalizeCanonicalRecord(
    {
      id: "cloud-1",
      userId: "user-alpha",
      title: "Stale Local Draft",
      singlePost: "Old body before cloud update.",
      stage: "Draft",
      createdAt: "2026-06-05T10:00:00.000Z",
    },
    "user-alpha"
  );
  const offlineIdea = normalizeCanonicalRecord(
    {
      id: "local-offline-idea",
      userId: "user-alpha",
      title: "Offline Captured Idea",
      singlePost: "Captured while commuting.",
      stage: "Idea",
      createdAt: "2026-06-06T10:00:00.000Z",
    },
    "user-alpha"
  );

  writeLocalCanonicalRecords("user-alpha", [staleLocalCopy, offlineIdea]);
  const reloadedLocal = readLocalCanonicalRecords("user-alpha");
  assert.equal(reloadedLocal.length, 2);

  const merged = mergeCanonicalRecords([cloudRec], reloadedLocal, "user-alpha");
  assert.equal(merged.length, 2);
  const byId = new Map(merged.map((r) => [r.id, r]));
  // Cloud wins for matching ID
  assert.equal(byId.get("cloud-1")?.stage, "Ready");
  assert.equal(byId.get("cloud-1")?.title, "Cloud Draft Updated");
  // Local-only record preserved
  assert.equal(byId.get("local-offline-idea")?.stage, "Idea");
});

// 11. Confirm Published posts never lose authoritative Published status
test("11. Published posts cannot be downgraded to Draft, Ready, or Planned", async () => {
  resetStorage();
  const pub = await saveCanonicalRecord(
    {
      id: "pub-99",
      userId: "user-alpha",
      title: "Live Threads Post",
      singlePost: "Already published to Threads.",
      stage: "Published",
      publishedAt: "2026-06-01T15:00:00.000Z",
      threadsPermalink: "https://www.threads.net/@creator/post/abc123",
    },
    SAMPLE_PROFILE
  );
  assert.equal(pub.stage, "Published");

  // Attempt downgrade via saveCanonicalRecord
  const attemptedSave = await saveCanonicalRecord(
    {
      id: "pub-99",
      userId: "user-alpha",
      stage: "Draft",
      status: "Draft",
      plannedDate: "2026-06-15",
    },
    SAMPLE_PROFILE
  );
  assert.equal(attemptedSave.stage, "Published");
  assert.equal(attemptedSave.isPublished, true);

  // Attempt downgrade via updateCanonicalStage
  const attemptedUpdate = await updateCanonicalStage("pub-99", "Ready", undefined, "user-alpha");
  assert.equal(attemptedUpdate?.stage, "Published");
  assert.equal(attemptedUpdate?.status, "Published");
});

// 12. Confirm strict multi-user isolation
test("12. Multi-user isolation prevents User A records from leaking into User B", async () => {
  resetStorage();
  const userARec = await saveCanonicalRecord(
    {
      id: "a-secret-1",
      userId: "user-alpha",
      title: "User Alpha Confidential Launch",
      singlePost: "Private launch notes for User Alpha.",
      stage: "Ready",
    },
    SAMPLE_PROFILE
  );

  const userBRec = await saveCanonicalRecord(
    {
      id: "b-post-1",
      userId: "user-beta",
      title: "User Beta Public Post",
      singlePost: "Content belonging solely to User Beta.",
      stage: "Draft",
    },
    { uid: "user-beta" } as any
  );

  // Storage key isolation
  const readB = readLocalCanonicalRecords("user-beta");
  assert.equal(readB.length, 1);
  assert.equal(readB[0].id, userBRec.id);

  // Even if cross-user records are passed into mergeCanonicalRecords, they are filtered out
  const mergedB = mergeCanonicalRecords([userARec, userBRec], [userARec], "user-beta");
  assert.deepEqual(mergedB.map((r) => r.id), [userBRec.id]);
});

// 13. Confirm AI failure/unavailable fallback preserves saved data and returns deterministic suggestions
test("13. AI topic classification and weekly planning gracefully fall back when AI is unavailable", async () => {
  const prevApiKey = process.env.API_KEY;
  const prevGeminiKey = process.env.GEMINI_API_KEY;
  delete process.env.API_KEY;
  delete process.env.GEMINI_API_KEY;

  try {
    const classifyRes = await classifyContentOrganization({
      items: [
        {
          id: "c1",
          title: "Growing organic reach with hooks",
          body: "Focus on clear opening hooks to accelerate organic reach on Threads.",
        },
      ],
      availablePillars: SAMPLE_PROFILE.contentPillars,
      creatorContext: { offer: SAMPLE_PROFILE.offer, audience: SAMPLE_PROFILE.audience },
    });

    assert.equal(classifyRes.source, "fallback");
    assert.equal(classifyRes.aiUnavailable, true);
    assert.equal(classifyRes.results.length, 1);
    assert.equal(classifyRes.results[0].suggestedPillarTitle, "Audience Growth");
    assert.ok(classifyRes.results[0].suggestedTopics.length >= 1);

    const planRes = await generateWeeklyPlanRecommendations({
      weekDays: [
        { dateKey: "2026-06-15", dayName: "Monday", isOpen: false, isPast: false, existingTitles: ["Already Scheduled"] },
        { dateKey: "2026-06-16", dayName: "Tuesday", isOpen: true, isPast: false, existingTitles: [] },
        { dateKey: "2026-06-17", dayName: "Wednesday", isOpen: true, isPast: false, existingTitles: [] },
      ],
      existingPosts: [
        {
          id: "ready-1",
          title: "My Ready Draft",
          bodyPreview: "Completed draft ready for Tuesday.",
          stage: "Ready",
          topic: "Hooks",
          pillarTitle: "Audience Growth",
        },
        {
          id: "idea-1",
          title: "Saved Bio Idea",
          bodyPreview: "Quick idea about profile bio clarity.",
          stage: "Idea",
          topic: "Offer Positioning",
          pillarTitle: "Offer Positioning",
        },
      ],
      profile: SAMPLE_PROFILE,
    });

    assert.equal(planRes.source, "fallback");
    assert.equal(planRes.aiUnavailable, true);
    assert.equal(planRes.recommendations.length, 2);
    // Monday was filled -> MUST NOT be overwritten
    assert.ok(!planRes.recommendations.some((r) => r.dateKey === "2026-06-15"));
    // Prefers Ready draft first, then saved Idea
    assert.equal(planRes.recommendations[0].actionType, "assign_existing_draft");
    assert.equal(planRes.recommendations[0].existingRecordId, "ready-1");
    assert.equal(planRes.recommendations[1].actionType, "develop_saved_idea");
    assert.equal(planRes.recommendations[1].existingRecordId, "idea-1");
  } finally {
    if (prevApiKey !== undefined) process.env.API_KEY = prevApiKey;
    if (prevGeminiKey !== undefined) process.env.GEMINI_API_KEY = prevGeminiKey;
  }
});

// 14. Confirm AI Planning Rules & Grounded Smart Recommendations (no invented metrics, respects requested topic & filled days)
test("14. Grounded recommendations and weekly planner obey all planning rules with zero invented metrics", () => {
  const refDate = new Date(2026, 5, 8, 9, 0, 0); // Monday June 8, 2026
  const monKey = formatLocalDateKey(refDate);
  const tueKey = formatLocalDateKey(new Date(2026, 5, 9));

  const records: CanonicalContentRecord[] = [
    normalizeCanonicalRecord(
      {
        id: "sched-mon",
        userId: "user-alpha",
        title: "Monday Scheduled Anchor",
        singlePost: "Scheduled post already filling Monday.",
        stage: "Scheduled",
        scheduledFor: new Date(2026, 5, 8, 15, 0, 0).toISOString(),
        topic: "Hooks",
        pillarTitle: "Audience Growth",
      },
      "user-alpha"
    ),
    normalizeCanonicalRecord(
      {
        id: "ready-1",
        userId: "user-alpha",
        title: "Ready Post on Hooks",
        singlePost: "First ready post about opening hooks.",
        stage: "Ready",
        topic: "Hooks",
        pillarTitle: "Audience Growth",
      },
      "user-alpha"
    ),
    normalizeCanonicalRecord(
      {
        id: "draft-2",
        userId: "user-alpha",
        title: "Second Hooks Draft",
        singlePost: "Another draft discussing hooks for Threads.",
        stage: "Draft",
        topic: "Hooks",
        pillarTitle: "Audience Growth",
      },
      "user-alpha"
    ),
    normalizeCanonicalRecord(
      {
        id: "idea-1",
        userId: "user-alpha",
        title: "How to outline weekly posts on Sunday",
        singlePost: "Short outline idea for Sunday planning.",
        stage: "Idea",
        topic: "Planning",
        pillarTitle: "Weekly Systems",
      },
      "user-alpha"
    ),
  ];

  // Grounded recommendations reflect real counts and open days
  const smartRecs = buildGroundedRecommendations(records, SAMPLE_PROFILE, refDate);
  assert.ok(smartRecs.some((r) => r.kind === "ready_drafts" && r.message.includes("1 completed draft")));
  assert.ok(smartRecs.some((r) => r.kind === "open_day" && r.targetDateKey === tueKey && r.message.includes("Tuesday")));
  assert.ok(smartRecs.some((r) => r.kind === "saved_idea" && r.targetRecordId === "idea-1"));
  assert.ok(smartRecs.some((r) => r.kind === "topic_overlap" && r.message.includes("Hooks")));

  // Ensure no invented engagement percentages or viral guarantees exist
  for (const r of smartRecs) {
    assert.doesNotMatch(`${r.message} ${r.detail || ""}`, /\b(\d+%\s*(engagement|growth|viral)|guaranteed|predicted views)\b/i);
  }

  // Deterministic weekly planner respects filled Monday, uses requested topic on open days, avoids inventing metrics
  const slots = buildWeeklyPlanSlots(records, 0, refDate);
  assert.equal(slots[0].dateKey, monKey);
  assert.equal(slots[0].isOpen, false);

  const fallbackPlan = buildDeterministicWeeklyPlanFallback(records, slots, SAMPLE_PROFILE, "Newsletter Growth");
  assert.equal(fallbackPlan.length, 6); // 6 open days (Tue-Sun), Monday untouched
  assert.ok(!fallbackPlan.some((rec) => rec.dateKey === monKey));
  assert.ok(fallbackPlan.some((rec) => rec.topic.includes("Newsletter Growth")));

  // Server deterministic classifier also handles empty/clean inputs cleanly
  const classified = deterministicClassifyItems({
    items: [{ id: "x1", title: "Weekly batching checklist", body: "Sustainable content batching and planning." }],
    availablePillars: SAMPLE_PROFILE.contentPillars,
  });
  assert.equal(classified[0].suggestedPillarTitle, "Weekly Systems");

  // Server deterministic planner respects already-filled days and prioritizes Ready over Draft
  const serverPlan = buildDeterministicWeeklyPlanServer({
    weekDays: slots.map((s) => ({
      dateKey: s.dateKey,
      dayName: s.dayName,
      isOpen: s.isOpen,
      isPast: s.isPast,
      existingTitles: s.allItems.map((i) => i.title),
    })),
    existingPosts: records.map((r) => ({
      id: r.id,
      title: r.title,
      bodyPreview: r.singlePost,
      stage: r.stage,
      topic: r.topic,
      pillarTitle: r.pillarTitle,
    })),
    profile: SAMPLE_PROFILE,
  });
  assert.equal(serverPlan.length, 6);
  assert.equal(serverPlan[0].existingRecordId, "ready-1"); // Ready prioritized over Draft
  assert.equal(serverPlan[1].existingRecordId, "draft-2"); // Draft prioritized over Idea
  assert.equal(serverPlan[2].existingRecordId, "idea-1"); // Idea prioritized over generate_new
  assert.equal(serverPlan[3].actionType, "generate_new");
});
