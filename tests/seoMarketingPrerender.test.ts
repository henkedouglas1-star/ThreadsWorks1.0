import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  HEADER_NAV_ROUTES,
  PUBLIC_MARKETING_ROUTES,
  SITE_ORIGIN,
  buildRobotsTxt,
  buildSitemapXml,
  buildStructuredDataForRoute,
  getCanonicalUrl,
  getPublicMarketingRoute
} from "../src/marketing/marketingRoutes";
import { renderNoIndexAppShellHtml, renderPublicRouteHtml } from "../server/seoPrerender";
import { FREE_MONTHLY_GENERATION_LIMIT } from "../server/generationLimitService";
import { RHETORICAL_LENSES } from "../server/writeDiversityEngine";

const BASE_TEMPLATE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Placeholder</title>
    <meta name="description" content="Placeholder" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;

const DISALLOWED_MARKETING_PHRASES = [
  "Content Creation Engine",
  "Persuasive Writing Platform",
  "Strategic Content Engine",
  "AI-Powered Content Solutions"
];

const UNIMPLEMENTED_FRAMEWORKS = [
  /\bAIDA\b/,
  /\bPAS\b/,
  /\bProblem-Agitate-Solve\b/i,
  /\bBefore-After-Bridge\b/i,
  /\bStoryBrand\b/i
];

test("all public marketing routes have unique SEO titles, descriptions, and canonical URLs", () => {
  const titles = new Set<string>();
  const descriptions = new Set<string>();
  const paths = new Set<string>();

  // 12 intended public indexable routes:
  // /, /applications, /learn, /about, /productworks, /ai-threads-post-generator,
  // /threads-hook-generator, /threads-scheduler, /content-ideas, /pricing, /privacy, /terms
  assert.equal(PUBLIC_MARKETING_ROUTES.length, 12);

  for (const route of PUBLIC_MARKETING_ROUTES) {
    assert.ok(!paths.has(route.path), `Duplicate route path: ${route.path}`);
    paths.add(route.path);

    assert.ok(!titles.has(route.title), `Duplicate title: ${route.title}`);
    titles.add(route.title);
    assert.ok(
      route.title.length >= 25 && route.title.length <= 65,
      `Title length out of healthy SEO bounds (${route.title.length}): ${route.title}`
    );

    assert.ok(!descriptions.has(route.description), `Duplicate description on ${route.path}`);
    descriptions.add(route.description);
    assert.ok(
      route.description.length >= 115 && route.description.length <= 170,
      `Description length out of healthy SEO bounds (${route.description.length}): ${route.description}`
    );

    const canonical = getCanonicalUrl(route.path);
    assert.ok(canonical.startsWith(`${SITE_ORIGIN}/`), `Invalid canonical: ${canonical}`);
  }
});

test("homepage renders customer-outcome hero, connected journey, ThreadsWorks frameworks, tutorial, and free-plan copy", () => {
  const home = getPublicMarketingRoute("/");
  assert.ok(home, "Homepage route must exist");

  const html = renderPublicRouteHtml(BASE_TEMPLATE, home);

  // Customer-outcome ContentPaysUs + ThreadsWorks hero
  assert.match(html, /ContentPaysUs · Home of ThreadsWorks for Meta Threads creators\./);
  assert.match(html, /<h1[^>]*>Turn your ideas into Threads content\.<\/h1>/);
  assert.match(html, /Create, organize, schedule, and publish your content with one AI-powered workspace\./);
  assert.match(
    html,
    /Create · Organize · Publish/
  );
  assert.match(html, /60 FREE POSTS EVERY MONTH ON THREADSWORKS\./);
  assert.match(html, /GET STARTED FREE/);

  // 8-stage connected journey + origin story + mission
  assert.match(html, /Learn → Identify → Build → Attract → Connect → Sell → Deliver → Grow/);
  assert.match(html, /It started with a thread\./);
  assert.match(html, /1,000 creators, 1,000 first sales\./);

  // Framework explanations section grounded in actual codebase
  assert.match(html, /BETTER WRITING STARTS WITH BETTER STRUCTURE\./);
  assert.ok(home.frameworkItems && home.frameworkItems.length >= 2 && home.frameworkItems.length <= 4);
  for (const item of home.frameworkItems!) {
    assert.ok(item.name.length > 5);
    assert.ok(item.problemSolved.length > 20);
    assert.ok(item.explanation.length > 30);
    assert.ok(item.example.length > 20);
  }
  // Verify the 8 rhetorical lenses mentioned match writeDiversityEngine.ts
  assert.equal(RHETORICAL_LENSES.length, 8);
  assert.match(html, /Applied automatically across batches/);
  assert.match(html, /User-selectable in the writer/);

  // 3-step tutorial sections preserved without any screenshot placeholders or missing-image captions
  assert.match(html, /TURN IDEAS INTO POSTS\./);
  assert.match(html, /DEVELOP STRONGER HOOKS\./);
  assert.match(html, /ORGANIZE AND SCHEDULE CONTENT\./);
  assert.ok(!html.includes("APPLICATION SCREENSHOT PLACEHOLDER"));
  assert.ok(!html.includes("Screenshot Required"));
  assert.ok(!html.includes("public/screenshots/"));
  assert.ok(!html.includes("<figure"));

  // Turn Ideas Into Posts section has no Attention/Trust/Sales tab references
  const turnIdeasSection = html.match(/<section[^>]*id="tutorial-turn-ideas-into-posts"[\s\S]*?<\/section>/i)?.[0] || "";
  assert.ok(turnIdeasSection.length > 0, "Turn Ideas Into Posts section must exist");
  assert.ok(!/Attention,\s*Trust,\s*(?:or|and)\s*Sales/i.test(turnIdeasSection));

  // Free plan matches verified live backend limit (150 monthly generations / 5 daily scheduled posts)
  assert.equal(FREE_MONTHLY_GENERATION_LIMIT, 150);
  assert.match(html, /60 FREE POSTS\. EVERY MONTH\./);
  assert.match(html, /150 free AI generations every month/);
  assert.match(html, /Up to 5 scheduled Meta Threads posts per day/);
});

test("ContentPaysUs public ecosystem routes (/applications, /learn, /about) prerender with exact positioning", () => {
  const applications = getPublicMarketingRoute("/applications");
  const learn = getPublicMarketingRoute("/learn");
  const about = getPublicMarketingRoute("/about");
  assert.ok(applications && learn && about, "All three ContentPaysUs public routes must exist");

  const appsHtml = renderPublicRouteHtml(BASE_TEMPLATE, applications);
  assert.match(appsHtml, /Three Permanent Categories, 20 Specialized Applications/);
  assert.match(appsHtml, /Create &amp; Sell \(10 Applications\)/);
  assert.match(appsHtml, /Connect &amp; Grow \(6 Applications\)/);
  assert.match(appsHtml, /Automate &amp; Scale \(4 Applications\)/);
  assert.match(appsHtml, /ThreadsWorks \(Available\)/);
  assert.match(appsHtml, /ProductWorks \(In Development\)/);

  const learnHtml = renderPublicRouteHtml(BASE_TEMPLATE, learn);
  assert.match(learnHtml, /Learn for free\. Build with AI\. Grow together\./);
  assert.match(learnHtml, /How to Get Your First Sale/);

  const aboutHtml = renderPublicRouteHtml(BASE_TEMPLATE, about);
  assert.match(aboutHtml, /It started with a thread\./);
  assert.match(aboutHtml, /1,000 creators\. 1,000 first sales\./);
});

test("no public marketing route uses banned vague phrases, unimplemented frameworks, or unsupported platforms", () => {
  for (const route of PUBLIC_MARKETING_ROUTES) {
    const html = renderPublicRouteHtml(BASE_TEMPLATE, route);

    for (const banned of DISALLOWED_MARKETING_PHRASES) {
      assert.ok(
        !html.toLowerCase().includes(banned.toLowerCase()),
        `Route ${route.path} contains disallowed phrase "${banned}"`
      );
    }

    for (const unimplemented of UNIMPLEMENTED_FRAMEWORKS) {
      assert.ok(
        !unimplemented.test(html),
        `Route ${route.path} mentions unimplemented framework matching ${unimplemented}`
      );
    }

    // Must not claim cross-posting to unsupported platforms in body markup
    const bodyOnly = html.split("<main")[1] || "";
    assert.ok(!/\bLinkedIn\b/i.test(bodyOnly), `Route ${route.path} must not claim LinkedIn support`);
    assert.ok(!/\bInstagram\b/i.test(bodyOnly), `Route ${route.path} must not claim Instagram support`);
    assert.ok(!/\bTwitter\b/i.test(bodyOnly), `Route ${route.path} must not claim Twitter support`);
  }
});

test("pre-rendered public HTML has exactly one H1, indexable robots, valid JSON-LD, and zero fabricated claims", () => {
  for (const route of PUBLIC_MARKETING_ROUTES) {
    const html = renderPublicRouteHtml(BASE_TEMPLATE, route);

    const h1Matches = html.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/gi) || [];
    assert.equal(h1Matches.length, 1, `Route ${route.path} must have exactly 1 H1, found ${h1Matches.length}`);

    assert.match(html, /<meta name="robots" content="index, follow" \/>/);
    assert.ok(
      html.includes(`<link rel="canonical" href="${getCanonicalUrl(route.path)}" />`),
      `Route ${route.path} missing exact canonical tag`
    );

    const ldScripts = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
    assert.ok(ldScripts.length >= 2, `Route ${route.path} must include structured data JSON-LD`);

    for (const match of ldScripts) {
      const parsed = JSON.parse(match[1]);
      assert.equal(parsed["@context"], "https://schema.org");
      // Ensure zero invented ratings, reviews, or inaccurate $19 prices
      assert.equal(parsed.aggregateRating, undefined);
      assert.equal(parsed.review, undefined);
      assert.equal(parsed.offers, undefined);
    }

    const schemas = buildStructuredDataForRoute(route);
    assert.equal(schemas.length, ldScripts.length);
  }
});

test("protected app shell renders noindex/nofollow with empty root and zero marketing copy", () => {
  const html = renderNoIndexAppShellHtml(BASE_TEMPLATE);
  assert.match(html, /<meta name="robots" content="noindex, nofollow" \/>/);
  assert.match(html, /<div id="root"><\/div>/);
  assert.ok(!html.includes("Turn what you know into what you earn."));
  assert.ok(!html.includes("application/ld+json"));
});

test("sitemap.xml and robots.txt include only public indexable routes and disallow private app routes", () => {
  const sitemap = buildSitemapXml("2026-11-27");
  for (const route of PUBLIC_MARKETING_ROUTES) {
    assert.ok(sitemap.includes(`<loc>${getCanonicalUrl(route.path)}</loc>`), `Missing ${route.path} in sitemap`);
  }
  for (const forbidden of [
    "/workspace",
    "/saved-content",
    "/creator-profile",
    "/todays-plan",
    "/apps",
    "/create",
    "/calendar",
    "/analytics",
    "/profile",
    "/settings"
  ]) {
    assert.ok(!sitemap.includes(forbidden), `Private route ${forbidden} must not appear in sitemap.xml`);
  }

  const robots = buildRobotsTxt();
  assert.match(robots, /User-agent: \*/);
  assert.match(robots, /Allow: \//);
  assert.match(robots, /Disallow: \/api\//);
  assert.match(robots, /Disallow: \/workspace/);
  assert.match(robots, /Disallow: \/calendar/);
  assert.match(robots, /Disallow: \/saved-content/);
  assert.match(robots, /Sitemap: https:\/\/threadsworks\.com\/sitemap\.xml/);
});

test("all internal navigation and related links resolve to valid public marketing routes", () => {
  const validPaths = new Set(PUBLIC_MARKETING_ROUTES.map((r) => r.path));
  assert.deepEqual(
    HEADER_NAV_ROUTES.map((r) => r.path),
    ["/productworks", "/ai-threads-post-generator", "/threads-scheduler", "/content-ideas", "/pricing"]
  );
  for (const navItem of HEADER_NAV_ROUTES) {
    assert.ok(validPaths.has(navItem.path));
  }
  for (const route of PUBLIC_MARKETING_ROUTES) {
    for (const link of route.relatedLinks) {
      assert.ok(validPaths.has(link.path), `Broken related link ${link.path} on ${route.path}`);
    }
    for (const item of route.frameworkItems || []) {
      if (item.featureLinkPath) {
        assert.ok(validPaths.has(item.featureLinkPath), `Broken framework link ${item.featureLinkPath}`);
      }
    }
    for (const sec of route.screenshotSections || []) {
      if (sec.featureLinkPath) {
        assert.ok(validPaths.has(sec.featureLinkPath), `Broken tutorial link ${sec.featureLinkPath}`);
      }
    }
  }
});

test("index.html maintains ThreadsWorks & ContentPaysUs SEO title without legacy slogan", () => {
  const indexHtml = fs.readFileSync(path.resolve(process.cwd(), "index.html"), "utf-8");
  assert.ok(!indexHtml.includes("ThreadsWorks - Content Creation Engine"));
  assert.match(
    indexHtml,
    /<title>ThreadsWorks &amp; ContentPaysUs \| AI Creator Business Ecosystem<\/title>/
  );
  assert.match(indexHtml, /<link rel="canonical" href="https:\/\/threadsworks\.com\/" \/>/);
});

test("shared public footer displays updated description and excludes Hook Generator from Product links", () => {
  for (const route of PUBLIC_MARKETING_ROUTES) {
    const html = renderPublicRouteHtml(BASE_TEMPLATE, route);
    const footer = html.match(/<footer[\s\S]*?<\/footer>/i)?.[0] || "";
    assert.ok(footer.length > 0, `Route ${route.path} must render a footer`);
    assert.ok(
      footer.includes("Write, organize, and schedule Threads posts in one place."),
      `Footer on ${route.path} missing updated description`
    );
    assert.ok(
      !footer.includes("AI Threads writer, hook tools, content library, and Meta Threads scheduler."),
      `Footer on ${route.path} still has old description`
    );
    assert.ok(
      !footer.includes("Hook Generator") && !footer.includes('href="/threads-hook-generator"'),
      `Footer on ${route.path} must not include Hook Generator`
    );
  }
});
