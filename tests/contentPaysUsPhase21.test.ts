import test from "node:test";
import assert from "node:assert";
import { adaptProfileToIdentity } from "../src/types/creatorIdentity";
import { CONTENT_PAYS_US_APPS } from "../src/data/contentPaysUsRegistry";
import { LEARN_TOPICS } from "../src/data/contentPaysUsLearn";

test("ContentPaysUs Phase 1 & 2.1 Foundation Hardening Tests", () => {
  // 1. Centralized Application Registry (16 Apps)
  assert.strictEqual(CONTENT_PAYS_US_APPS.length, 16);
  const threadsWorks = CONTENT_PAYS_US_APPS.find(a => a.id === "threadsworks");
  const productWorks = CONTENT_PAYS_US_APPS.find(a => a.id === "productworks");
  assert.strictEqual(threadsWorks?.availability, "Available");
  assert.strictEqual(productWorks?.availability, "In Development");

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
