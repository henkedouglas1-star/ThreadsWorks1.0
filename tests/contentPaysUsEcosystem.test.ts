import test from "node:test";
import assert from "node:assert/strict";
import {
  CONTENT_PAYS_US_ACADEMY,
  CONTENT_PAYS_US_APPS,
  ECOSYSTEM_CATEGORY_TABS,
  FIRST_SALE_ENGINE_WORKFLOW,
  getAppsByCategory
} from "../src/data/contentPaysUsRegistry";
import {
  ECOSYSTEM_TOOL_REGISTRY,
  getToolDefinition,
  getToolsForApp
} from "../src/data/ecosystemToolRegistry";
import {
  buildProductPromotionPrompt,
  computeFirstSaleEngineState,
  evaluateAutomationPolicy,
  isEligibleVerifiedCreatorSale,
  validateAffiliateReferral
} from "../server/ecosystemDomainLogic";
import {
  ProjectOwnershipError,
  contributeSharedIntelligence,
  deleteSharedIntelligenceContribution,
  listSharedIntelligenceContributions,
  retrieveSharedIntelligenceContext
} from "../server/sharedIntelligenceService";

/**
 * Lightweight in-memory Firestore test double implementing only the subset
 * used by sharedIntelligenceService (collection -> doc/where/limit/get/set/delete).
 */
function createMockFirestore(initialCollections: Record<string, Record<string, any>> = {}) {
  const store = new Map<string, Map<string, any>>();
  for (const [col, docs] of Object.entries(initialCollections)) {
    const map = new Map<string, any>();
    for (const [id, data] of Object.entries(docs)) {
      map.set(id, { ...data });
    }
    store.set(col, map);
  }

  let autoIdCounter = 1;
  const getColMap = (name: string) => {
    if (!store.has(name)) store.set(name, new Map());
    return store.get(name)!;
  };

  function makeQuery(colName: string, filters: Array<{ field: string; value: any }> = [], maxLimit?: number) {
    return {
      where(field: string, _op: string, value: any) {
        return makeQuery(colName, [...filters, { field, value }], maxLimit);
      },
      orderBy() {
        return makeQuery(colName, filters, maxLimit);
      },
      limit(n: number) {
        return makeQuery(colName, filters, n);
      },
      async get() {
        const col = getColMap(colName);
        let entries = Array.from(col.entries()).filter(([, data]) =>
          filters.every((f) => data[f.field] === f.value)
        );
        if (typeof maxLimit === "number") entries = entries.slice(0, maxLimit);
        const docs = entries.map(([id, data]) => ({
          id,
          exists: true,
          ref: db.collection(colName).doc(id),
          data: () => ({ ...data })
        }));
        return {
          empty: docs.length === 0,
          size: docs.length,
          docs,
          forEach(cb: (d: any) => void) {
            docs.forEach(cb);
          }
        };
      }
    };
  }

  const db: any = {
    collection(colName: string) {
      return {
        ...makeQuery(colName),
        doc(id?: string) {
          const docId = id || `auto_${autoIdCounter++}`;
          return {
            id: docId,
            async get() {
              const col = getColMap(colName);
              const val = col.get(docId);
              return {
                id: docId,
                exists: val !== undefined,
                data: () => (val ? { ...val } : undefined)
              };
            },
            async set(data: any, opts?: { merge?: boolean }) {
              const col = getColMap(colName);
              if (opts?.merge && col.has(docId)) {
                col.set(docId, { ...col.get(docId), ...data });
              } else {
                col.set(docId, { ...data });
              }
            },
            async delete() {
              getColMap(colName).delete(docId);
            },
            collection(subName: string) {
              return db.collection(`${colName}/${docId}/${subName}`);
            }
          };
        },
        async add(data: any) {
          const docId = `auto_${autoIdCounter++}`;
          getColMap(colName).set(docId, { ...data });
          return { id: docId };
        }
      };
    }
  };

  return db;
}

test("Registry enforces exact 20 apps across 3 permanent categories and zero EmailWorks", () => {
  assert.equal(CONTENT_PAYS_US_APPS.length, 20);
  assert.deepEqual(
    ECOSYSTEM_CATEGORY_TABS.map((t) => t.id),
    ["Create & Sell", "Connect & Grow", "Automate & Scale"]
  );

  const createSell = getAppsByCategory("Create & Sell").map((a) => a.id);
  const connectGrow = getAppsByCategory("Connect & Grow").map((a) => a.id);
  const automateScale = getAppsByCategory("Automate & Scale").map((a) => a.id);

  assert.deepEqual(createSell, [
    "creatorworks",
    "demandworks",
    "offerworks",
    "productworks",
    "threadsworks",
    "contentworks",
    "funnelworks",
    "salesworks",
    "storeworks",
    "deliveryworks"
  ]);
  assert.deepEqual(connectGrow, [
    "communityworks",
    "meetingworks",
    "proofworks",
    "teamworks",
    "affiliateworks",
    "growthworks"
  ]);
  assert.deepEqual(automateScale, [
    "automationworks",
    "financeworks",
    "adsworks",
    "projectz"
  ]);

  assert.equal(CONTENT_PAYS_US_APPS.some((a) => a.id === "emailworks"), false);
  assert.equal(CONTENT_PAYS_US_ACADEMY.id, "academy");
  assert.equal(FIRST_SALE_ENGINE_WORKFLOW.id, "first-sale-engine");
});

test("Ecosystem Tool Registry covers all 20 apps and honestly gates external-provider tools", () => {
  for (const app of CONTENT_PAYS_US_APPS) {
    const tools = getToolsForApp(app.id);
    assert.ok(tools.length >= 1, `Expected at least 1 registered tool for ${app.id}`);
  }

  // External-provider tools must remain honestly gated as In Development
  for (const [appId, toolId] of [
    ["demandworks", "live_market_scrape"],
    ["funnelworks", "outbound_email_broadcast"],
    ["storeworks", "live_marketplace_checkout"],
    ["meetingworks", "live_audio_video_room"],
    ["adsworks", "live_ad_account_launch"]
  ]) {
    const tool = getToolDefinition(appId, toolId);
    assert.ok(tool, `Missing gated tool ${appId}/${toolId}`);
    assert.equal(tool!.availability, "In Development");
    assert.ok(tool!.availabilityNote && tool!.availabilityNote.length > 20);
  }

  assert.ok(ECOSYSTEM_TOOL_REGISTRY.length >= 30);
});

test("Shared Intelligence eliminates fabricated defaults, enforces ownership, deduplicates, and isolates Project Z", async () => {
  const db = createMockFirestore({
    users: {
      user_a: {
        email: "creatorA@example.com",
        offer: "First Sale Playbook",
        audience: "Solo creators",
        writingStyle: "Clear and practical"
      }
    },
    projects: {
      proj_a: { userId: "user_a", name: "Launch 1", objective: "First 10 sales", status: "active" },
      proj_b: { userId: "user_b", name: "Foreign Project", objective: "Secret", status: "active" }
    }
  });

  // 1. Zero fabricated metrics when analytics_posts is empty (previously fabricated 50 / 3.5)
  const ctx = await retrieveSharedIntelligenceContext(
    {
      userId: "user_a",
      appId: "growthworks",
      taskType: "growth_review",
      projectId: "proj_a",
      domains: ["identity", "business", "audience", "performance", "projects"]
    },
    db
  );
  assert.equal(ctx.performanceSignals?.hasRealMetrics, false);
  assert.equal(ctx.performanceSignals?.medianViews, null);
  assert.equal(ctx.performanceSignals?.avgEngagementRate, null);
  assert.equal(ctx.activeProject?.name, "Launch 1");

  // 2. Cross-user projectId MUST throw ProjectOwnershipError (HTTP 403)
  await assert.rejects(
    () =>
      retrieveSharedIntelligenceContext(
        {
          userId: "user_a",
          appId: "offerworks",
          taskType: "offer_blueprint",
          projectId: "proj_b",
          domains: ["projects"]
        },
        db
      ),
    (err: unknown) => err instanceof ProjectOwnershipError
  );

  // 3. Deduplication via SHA-256 fingerprint
  const first = await contributeSharedIntelligence(
    {
      userId: "user_a",
      sourceAppId: "offerworks",
      category: "offer",
      factType: "offer_blueprint",
      provenance: "user_provided_fact",
      data: { title: "Starter Playbook", price: "$29" }
    },
    db
  );
  const dup = await contributeSharedIntelligence(
    {
      userId: "user_a",
      sourceAppId: "offerworks",
      category: "offer",
      factType: "offer_blueprint",
      provenance: "user_provided_fact",
      data: { title: "Starter Playbook", price: "$29" }
    },
    db
  );
  assert.equal(first.deduplicated, false);
  assert.equal(dup.deduplicated, true);
  assert.equal(dup.id, first.id);

  // 4. Project Z isolation: Project Z contributions must NEVER appear in production app context
  const pz = await contributeSharedIntelligence(
    {
      userId: "user_a",
      sourceAppId: "projectz",
      category: "research",
      factType: "wild_experiment",
      provenance: "ai_hypothesis",
      data: { title: "Hypothetical $9999 experiment" }
    },
    db
  );
  assert.equal(pz.success, true);

  const prodCtx = await retrieveSharedIntelligenceContext(
    { userId: "user_a", appId: "productworks", taskType: "product_build", domains: ["identity"] },
    db
  );
  assert.equal(
    prodCtx.savedContributions.some((c) => c.sourceAppId === "projectz"),
    false,
    "Project Z contribution leaked into ProductWorks context!"
  );

  // 5. Creator memory inspect & delete (cross-user delete must throw ProjectOwnershipError)
  const list = await listSharedIntelligenceContributions("user_a", db);
  assert.equal(list.length, 2);
  await assert.rejects(
    () => deleteSharedIntelligenceContribution("user_b", first.id!, db),
    (err: unknown) => err instanceof ProjectOwnershipError
  );
  const delOwn = await deleteSharedIntelligenceContribution("user_a", first.id!, db);
  assert.equal(delOwn.deleted, true);
});

test("First Sale Engine enforces strict verified-sale exclusions and dynamically computes milestones", () => {
  // Strictly excluded transactions
  assert.equal(
    isEligibleVerifiedCreatorSale({
      id: "t1",
      sellerUid: "u1",
      buyerUid: "u2",
      amountCents: 2900,
      status: "verified",
      isTestTransaction: true,
      source: "manual"
    }).eligible,
    false
  );
  assert.equal(
    isEligibleVerifiedCreatorSale({
      id: "t2",
      sellerUid: "u1",
      buyerUid: "u1",
      amountCents: 2900,
      status: "verified",
      isTestTransaction: false,
      source: "manual"
    }).eligible,
    false
  );
  assert.equal(
    isEligibleVerifiedCreatorSale({
      id: "t3",
      sellerUid: "u1",
      buyerUid: "u2",
      amountCents: 2900,
      status: "refunded",
      isTestTransaction: false,
      source: "manual"
    }).eligible,
    false
  );
  assert.equal(
    isEligibleVerifiedCreatorSale({
      id: "t4",
      sellerUid: "u1",
      buyerUid: "u2",
      amountCents: 1900,
      status: "paid",
      isTestTransaction: false,
      source: "threadsworks_saas_subscription"
    }).eligible,
    false
  );

  // Legitimate verified creator sale
  assert.equal(
    isEligibleVerifiedCreatorSale({
      id: "t5",
      sellerUid: "u1",
      buyerUid: "buyer_real_99",
      amountCents: 2900,
      status: "verified",
      isTestTransaction: false,
      source: "creator_store"
    }).eligible,
    true
  );

  // Dynamic milestone progression skips already-completed steps
  const state = computeFirstSaleEngineState({
    hasCreatorProfile: true,
    hasDemandResearch: true,
    hasOfferBlueprint: true,
    hasDigitalProduct: false,
    hasProductPromotionDrafts: false,
    hasThreadsContent: true,
    hasFunnelOrLeadAsset: false,
    hasCrmLeads: false,
    hasDiscoveryMeetings: false,
    hasStoreListing: false,
    hasDeliverySetup: false,
    hasProofItem: false,
    verifiedCreatorSalesCount: 0,
    excludedSalesCount: 1
  });
  assert.equal(state.totalMilestones, 12);
  assert.equal(state.completedCount, 4);
  assert.equal(state.nextRecommendedMilestone?.id, "product_creation");
  assert.equal(state.excludedSalesCount, 1);
});

test("ProductWorks automatic promotion prompt strictly grounds price & URL without inventing facts", () => {
  const withoutPriceOrUrl = buildProductPromotionPrompt({
    title: "Threads Growth Checklist",
    audience: "Solo creators",
    outcome: "Publish 5 clear posts a week",
    playbookSummary: "Step 1: Lock your hook\nStep 2: Keep one idea per post"
  });
  assert.match(withoutPriceOrUrl, /DO NOT invent or mention any dollar amount or price/i);
  assert.match(withoutPriceOrUrl, /DO NOT invent or include any website URL or link/i);
  assert.match(withoutPriceOrUrl, /DO NOT invent customer testimonials/i);

  const withPriceAndUrl = buildProductPromotionPrompt({
    title: "Threads Growth Checklist",
    price: "$29",
    url: "https://threadsworks.com/productworks"
  });
  assert.match(withPriceAndUrl, /exact provided price: \$29/);
  assert.match(withPriceAndUrl, /ONLY this exact URL: https:\/\/threadsworks\.com\/productworks/);
});

test("AutomationWorks policy blocks unsafe external actions, enforces approval gates, and bounds retries", () => {
  const blockedPublish = evaluateAutomationPolicy({
    actionType: "publish_to_threads_external",
    requiresApproval: false,
    approvedByUser: true,
    maxRetries: 99
  });
  assert.equal(blockedPublish.allowed, false);
  assert.equal(blockedPublish.status, "BLOCKED_EXTERNAL_APPROVAL_REQUIRED");
  assert.equal(blockedPublish.boundedMaxRetries, 3);

  const pendingGate = evaluateAutomationPolicy({
    actionType: "prepare_promo_brief",
    requiresApproval: true,
    approvedByUser: false,
    maxRetries: -5
  });
  assert.equal(pendingGate.allowed, false);
  assert.equal(pendingGate.status, "PENDING_APPROVAL");
  assert.equal(pendingGate.boundedMaxRetries, 0);

  const allowedSafe = evaluateAutomationPolicy({
    actionType: "prepare_promo_brief",
    requiresApproval: true,
    approvedByUser: true,
    maxRetries: 2
  });
  assert.equal(allowedSafe.allowed, true);
  assert.equal(allowedSafe.status, "EXECUTED");
});

test("AffiliateWorks referral validation strictly blocks self-referrals by UID or email", () => {
  assert.equal(validateAffiliateReferral("uid_1", "uid_1").valid, false);
  assert.equal(
    validateAffiliateReferral("uid_1", "uid_2", "Creator@Example.com", "creator@example.com").valid,
    false
  );
  assert.equal(
    validateAffiliateReferral("uid_1", "uid_2", "partner@example.com", "buyer@example.com").valid,
    true
  );
});
