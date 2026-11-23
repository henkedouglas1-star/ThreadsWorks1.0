/**
 * Build-time Static Pre-Renderer for ThreadsWorks Public Marketing Routes
 *
 * Executed during `npm run build` immediately after `vite build`:
 * 1. Saves a clean `dist/app.html` (`noindex, nofollow`, empty #root) for protected app routes.
 * 2. Pre-renders every public route in PUBLIC_MARKETING_ROUTES to `dist/index.html` (for `/`)
 *    and `dist/<slug>.html` (for sub-routes) with full semantic HTML, unique metadata,
 *    canonical URLs, Open Graph / Twitter cards, and Schema.org JSON-LD.
 * 3. Synchronizes `public/sitemap.xml`, `dist/sitemap.xml`, `public/robots.txt`, and `dist/robots.txt`.
 */

import fs from "node:fs";
import path from "node:path";
import {
  PUBLIC_MARKETING_ROUTES,
  buildRobotsTxt,
  buildSitemapXml
} from "../src/marketing/marketingRoutes";
import {
  renderNoIndexAppShellHtml,
  renderPublicRouteHtml
} from "../server/seoPrerender";

function main() {
  const rootDir = process.cwd();
  const distDir = path.join(rootDir, "dist");
  const publicDir = path.join(rootDir, "public");
  const baseIndexPath = path.join(distDir, "index.html");

  if (!fs.existsSync(baseIndexPath)) {
    throw new Error(`Expected Vite build output at ${baseIndexPath}, but it was not found.`);
  }

  const baseTemplate = fs.readFileSync(baseIndexPath, "utf8");

  // 1. Write clean noindex app shell for authenticated/protected SPA routes
  const appShellHtml = renderNoIndexAppShellHtml(baseTemplate);
  fs.writeFileSync(path.join(distDir, "app.html"), appShellHtml, "utf8");

  // 2. Statically pre-render every public indexable marketing & legal route
  for (const route of PUBLIC_MARKETING_ROUTES) {
    const html = renderPublicRouteHtml(baseTemplate, route);
    const outPath = path.join(distDir, route.outputFile);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, html, "utf8");
    console.log(`[PRERENDER] ${route.path.padEnd(28)} -> dist/${route.outputFile} (${Buffer.byteLength(html, "utf8")} bytes)`);
  }

  // 3. Synchronize sitemap.xml and robots.txt in both dist/ and public/
  const sitemapXml = buildSitemapXml();
  const robotsTxt = buildRobotsTxt();

  fs.writeFileSync(path.join(distDir, "sitemap.xml"), sitemapXml, "utf8");
  fs.writeFileSync(path.join(distDir, "robots.txt"), robotsTxt, "utf8");

  if (fs.existsSync(publicDir)) {
    fs.writeFileSync(path.join(publicDir, "sitemap.xml"), sitemapXml, "utf8");
    fs.writeFileSync(path.join(publicDir, "robots.txt"), robotsTxt, "utf8");
  }

  console.log(`[PRERENDER] Generated ${PUBLIC_MARKETING_ROUTES.length} static public pages + dist/app.html + sitemap.xml + robots.txt`);
}

main();
