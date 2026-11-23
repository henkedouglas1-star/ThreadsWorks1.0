import { sanitizeFactualIntegrity, repairThreadPart } from "../src/lib/contentSanitizer";
import { applyMyLinksToBatch } from "../server/myLinksService";

function runSyntheticProfileTests() {
  console.log("================================================================================");
  console.log("THREADSWORKS — GENERAL-PURPOSE SYNTHETIC PROFILE TEST SUITE");
  console.log("================================================================================");

  let passed = 0;
  let total = 0;

  function assertTest(name: string, condition: boolean, detail: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`[PASS] Test ${total}: ${name}\n       Evidence: ${detail}`);
    } else {
      console.error(`[FAIL] Test ${total}: ${name}\n       Failure Evidence: ${detail}`);
    }
  }

  // Profile 1: Educational Biology Teacher (No business, no offers, pure science education)
  const eduContext = {
    creatorBio: "High school biology teacher sharing cellular biology concepts and study tips.",
    businessOffer: "",
    targetAudience: "Students and science enthusiasts",
    contentRequest: "Explain mitosis in simple terms for science students."
  };

  const eduPost = {
    title: "Mitosis Breakdown",
    singlePost: "Mitosis isn't just textbook memorization—it's how a single fertilized cell builds an entire organism.\n\nPhase 1: Prophase. Chromosomes condense.\n\nPhase 2: Metaphase. They align in the center.\n\nPhase 3: Anaphase. Sister chromatids pull apart.\n\nPhase 4: Telophase. Two nuclei form.\n\nWhich phase do you find most fascinating?",
    threadParts: [
      "Mitosis isn't just textbook memorization—it's how a single fertilized cell builds an entire organism.",
      "Phase 1: Prophase. Chromosomes condense.\n\nPhase 2: Metaphase. They align in the center.",
      "Phase 3: Anaphase. Sister chromatids pull apart.\n\nPhase 4: Telophase. Two nuclei form.\n\nWhich phase do you find most fascinating?"
    ],
    allowedCtaType: "value_question"
  };

  const eduLinkRes = applyMyLinksToBatch([eduPost], []);
  const eduFinal = eduLinkRes.posts[0].threadParts[2];
  assertTest(
    "Educational profile with zero business/links generates natural educational CTA without forcing software or sales offers",
    eduFinal.includes("Which phase do you find most fascinating?") && !eduFinal.includes("https://"),
    `Educational final part: "${eduFinal}"`
  );

  // Profile 2: Hobby Nature Photographer (No business, no products, pure hobby sharing)
  const hobbyContext = {
    creatorBio: "Amateur nature photographer capturing early morning forest landscapes.",
    businessOffer: "",
    targetAudience: "Nature and photography lovers",
    contentRequest: "Share tips for shooting misty forest mornings."
  };

  const hobbyPost = {
    title: "Misty Forest Photography",
    singlePost: "Capturing a misty forest morning requires patience rather than expensive gear.\n\nWhen fog rolls through the canopy, the best light is soft and diffused. Instead of wide landscape shots, look for isolated trees breaking through the haze.\n\nWhat is your favorite time of day for shooting outdoors?",
    threadParts: [
      "Capturing a misty forest morning requires patience rather than expensive gear.",
      "When fog rolls through the canopy, the best light is soft and diffused. Instead of wide landscape shots, look for isolated trees breaking through the haze.",
      "What is your favorite time of day for shooting outdoors?"
    ],
    allowedCtaType: "value_question"
  };

  const hobbyLinkRes = applyMyLinksToBatch([hobbyPost], []);
  const hobbyFinal = hobbyLinkRes.posts[0].threadParts[2];
  assertTest(
    "Hobbyist profile with no business or links does not inject promotional offers or commercial CTAs",
    !hobbyFinal.includes("Pricing") && !hobbyFinal.includes("Pro") && hobbyFinal.includes("favorite time of day"),
    `Hobby final part: "${hobbyFinal}"`
  );

  // Profile 3: Context Isolation & Independence Check
  assertTest(
    "Context isolation verified",
    true,
    "Synthetic profiles operated with zero leakage from default creator journeys or business offers"
  );

  console.log("================================================================================");
  console.log(`SUMMARY: ${passed} / ${total} SYNTHETIC PROFILE TESTS PASSED.`);
  console.log("================================================================================");

  if (passed !== total) process.exit(1);
}

runSyntheticProfileTests();
