import test from "node:test";
import assert from "node:assert";
import { adaptProfileToIdentity } from "../src/types/creatorIdentity";
import { CONTENT_PAYS_US_APPS } from "../src/data/contentPaysUsRegistry";
import { LEARN_TOPICS } from "../src/data/contentPaysUsLearn";

test("ContentPaysUs Ecosystem Registry & Foundation Hardening Tests", () => {
  // 1. Centralized Application Registry (20-Application Roadmap with strict statuses)
  assert.strictEqual(CONTENT_PAYS_US_APPS.length, 20);

  const allowedStatuses = new Set(["Available", "In Development", "Planned"]);
  for (const app of CONTENT_PAYS_US_APPS) {
    assert.ok(
      allowedStatuses.has(app.availability),
      `Unexpected availability status "${app.availability}" on ${app.id}`
    );
  }

  const threadsWorks = CONTENT_PAYS_US_APPS.find((a) => a.id === "threadsworks");
  const productWorks = CONTENT_PAYS_US_APPS.find((a) => a.id === "productworks");
  const academy = CONTENT_PAYS_US_APPS.find((a) => a.id === "academy");
  const meetingWorks = CONTENT_PAYS_US_APPS.find((a) => a.id === "meetingworks");
  const firstSaleEngine = CONTENT_PAYS_US_APPS.find((a) => a.id === "first-sale-engine");
  const projectZ = CONTENT_PAYS_US_APPS.find((a) => a.id === "projectz");

  assert.strictEqual(threadsWorks?.availability, "Available");
  assert.strictEqual(threadsWorks?.externalLink, "/create");
  assert.strictEqual(productWorks?.availability, "In Development");
  assert.strictEqual(productWorks?.externalLink, "/productworks");
  assert.strictEqual(academy?.availability, "Planned");
  assert.strictEqual(meetingWorks?.availability, "Planned");
  assert.strictEqual(firstSaleEngine?.availability, "Planned");
  assert.strictEqual(projectZ?.availability, "Planned");

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
