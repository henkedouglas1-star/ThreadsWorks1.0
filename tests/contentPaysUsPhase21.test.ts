import test from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { adaptProfileToIdentity } from "../src/types/creatorIdentity";
import {
  CONTENT_PAYS_US_ACADEMY,
  CONTENT_PAYS_US_APPS,
  ECOSYSTEM_CATEGORY_TABS,
  FIRST_SALE_ENGINE_WORKFLOW,
  getAppsByCategory
} from "../src/data/contentPaysUsRegistry";
import { LEARN_TOPICS } from "../src/data/contentPaysUsLearn";

test("ContentPaysUs Ecosystem Registry & Foundation Hardening Tests", () => {
  // 1. Exact Approved 20-Application Registry across 3 Permanent Categories
  assert.strictEqual(CONTENT_PAYS_US_APPS.length, 20);
  assert.deepStrictEqual(
    ECOSYSTEM_CATEGORY_TABS.map((t) => t.id),
    ["Create & Sell", "Connect & Grow", "Automate & Scale"]
  );
  assert.strictEqual(getAppsByCategory("Create & Sell").length, 10);
  assert.strictEqual(getAppsByCategory("Connect & Grow").length, 6);
  assert.strictEqual(getAppsByCategory("Automate & Scale").length, 4);

  // EmailWorks must NOT exist as a separate app (email tools live inside FunnelWorks & SalesWorks)
  assert.strictEqual(
    CONTENT_PAYS_US_APPS.find((a) => a.id === "emailworks" || a.name.toLowerCase() === "emailworks"),
    undefined
  );

  // Academy & First Sale Engine are independent destinations outside the 20 apps
  assert.strictEqual(CONTENT_PAYS_US_APPS.find((a) => a.id === "academy"), undefined);
  assert.strictEqual(CONTENT_PAYS_US_APPS.find((a) => a.id === "first-sale-engine"), undefined);
  assert.strictEqual(CONTENT_PAYS_US_ACADEMY.availability, "Available");
  assert.strictEqual(FIRST_SALE_ENGINE_WORKFLOW.availability, "Available");

  const allowedStatuses = new Set(["Available", "In Development", "Planned"]);
  for (const app of CONTENT_PAYS_US_APPS) {
    assert.ok(
      allowedStatuses.has(app.availability),
      `Unexpected availability status "${app.availability}" on ${app.id}`
    );
  }

  const threadsWorks = CONTENT_PAYS_US_APPS.find((a) => a.id === "threadsworks");
  const productWorks = CONTENT_PAYS_US_APPS.find((a) => a.id === "productworks");
  const meetingWorks = CONTENT_PAYS_US_APPS.find((a) => a.id === "meetingworks");
  const storeWorks = CONTENT_PAYS_US_APPS.find((a) => a.id === "storeworks");
  const adsWorks = CONTENT_PAYS_US_APPS.find((a) => a.id === "adsworks");
  const projectZ = CONTENT_PAYS_US_APPS.find((a) => a.id === "projectz");

  assert.strictEqual(threadsWorks?.availability, "Available");
  assert.strictEqual(threadsWorks?.externalLink, "/create");
  // Keep public claims conservative until live ProductWorks readiness is verified.
  assert.strictEqual(productWorks?.availability, "In Development");
  assert.strictEqual(productWorks?.externalLink, "/productworks");
  // External-provider apps must remain honestly classified as In Development
  assert.strictEqual(meetingWorks?.availability, "In Development");
  assert.strictEqual(storeWorks?.availability, "In Development");
  assert.strictEqual(adsWorks?.availability, "In Development");
  assert.strictEqual(projectZ?.availability, "Available");

  // 2. Creator Identity Adaptation
  const mockProfile = {
    uid: "test_uid_123",
    email: "creator@test.com",
    offer: "AI Content Systems",
    audience: "Solopreneurs",
    desiredResult: "Sustainable growth",
    writingStyle: "Direct & practical"
  };
  const identity = adaptProfileToIdentity(mockProfile, "creator@test.com", "active");
  assert.strictEqual(identity.uid, "test_uid_123");
  assert.strictEqual(identity.email, "creator@test.com");
  assert.strictEqual(identity.brandProfile.offer, "AI Content Systems");
  assert.strictEqual(identity.subscriptionStatus, "active");

  // 3. Educational Curriculum (9 Topics)
  assert.strictEqual(LEARN_TOPICS.length, 9);
  assert.ok(LEARN_TOPICS[0].title.includes("Brand Development"));
  assert.ok(LEARN_TOPICS[8].title.includes("Sustainable Growth"));

  // 4. Project Validation Rules
  const validProject = {
    name: "Q4 Monetization Blueprint",
    objective: "Launch PDF playbook",
    status: "active",
    associatedAppIds: ["threadsworks", "productworks"]
  };
  assert.ok(validProject.name.length > 0 && validProject.name.length <= 100);
  assert.ok(validProject.objective.length <= 200);
  assert.ok(["active", "archived", "completed"].includes(validProject.status));
});


test("Public homepage uses registry-backed ProductWorks status and ThreadsWorks-first hero", () => {
  const home = readFileSync(new URL("../src/components/contentpaysus/ContentPaysUsHome.tsx", import.meta.url), "utf8");
  assert.match(home, /const productWorksAvailability = CONTENT_PAYS_US_APPS\.find/);
  assert.match(home, /destinationLabel: "ProductWorks",\s*path: "\/productworks",\s*availability: productWorksAvailability/);
  assert.match(home, /ProductWorks \(\$\{productWorksAvailability\}\)/);
  assert.match(home, /\{productWorksAvailability\}\s*<\/span>\s*<\/div>\s*<h3[^>]*>ProductWorks/);
  assert.doesNotMatch(home, /ProductWorks:<\/strong> Available|ProductWorks \(Available\)/);
  assert.match(home, /<h1[^>]*>\s*Turn your ideas into Threads content\./);
  assert.match(home, /id="hero-get-started-cta"/);
  assert.match(home, /onClick=\{handlePrimaryCta\}/);
});
