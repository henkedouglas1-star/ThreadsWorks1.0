/**
 * Shared HTML Pre-Rendering & SEO Head Injection Utility
 *
 * Used by:
 * 1. scripts/prerender-marketing.ts during `npm run build` (static pre-render into dist/)
 * 2. server.ts in development mode (so dev preview serves identical pre-rendered HTML)
 */

import React from "react";
import { renderToString } from "react-dom/server";
import PublicMarketingPage from "../src/components/PublicMarketingPage";
import {
  DEFAULT_OG_IMAGE,
  PublicMarketingRoute,
  SITE_NAME,
  buildStructuredDataForRoute,
  getCanonicalUrl
} from "../src/marketing/marketingRoutes";

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Safely serializes JSON-LD so closing </script> sequences can never break HTML parsing.
 */
function serializeJsonLd(data: Record<string, any>): string {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
}

function stripExistingSeoTags(html: string): string {
  return html
    .replace(/<title>[\s\S]*?<\/title>\s*/gi, "")
    .replace(/<meta\s+[^>]*name=["']description["'][^>]*>\s*/gi, "")
    .replace(/<meta\s+[^>]*name=["']robots["'][^>]*>\s*/gi, "")
    .replace(/<link\s+[^>]*rel=["']canonical["'][^>]*>\s*/gi, "")
    .replace(/<meta\s+[^>]*property=["']og:[^"']+["'][^>]*>\s*/gi, "")
    .replace(/<meta\s+[^>]*name=["']twitter:[^"']+["'][^>]*>\s*/gi, "")
    .replace(/<script\s+[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>\s*/gi, "");
}

function injectHeadTags(template: string, headBlock: string): string {
  const cleaned = stripExistingSeoTags(template);
  if (cleaned.includes("</head>")) {
    return cleaned.replace("</head>", `${headBlock}\n  </head>`);
  }
  return cleaned;
}

function injectRootContent(html: string, innerHtml: string): string {
  return html.replace(/<div\s+id=["']root["'][^>]*>[\s\S]*?<\/div>/i, `<div id="root">${innerHtml}</div>`);
}

/**
 * Renders a complete, crawlable static HTML document for a public marketing route,
 * preserving all Vite-bundled script and stylesheet assets from the base template.
 */
export function renderPublicRouteHtml(templateHtml: string, route: PublicMarketingRoute): string {
  const canonical = getCanonicalUrl(route.path);
  const structuredDataList = buildStructuredDataForRoute(route);
  const jsonLdTags = structuredDataList
    .map(
      (obj, idx) =>
        `    <script type="application/ld+json" id="threadsworks-ld-${idx}">${serializeJsonLd(obj)}</script>`
    )
    .join("\n");

  const seoHeadBlock = `    <title>${escapeHtmlText(route.title)}</title>
    <meta name="description" content="${escapeHtmlAttr(route.description)}" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${escapeHtmlAttr(canonical)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${escapeHtmlAttr(SITE_NAME)}" />
    <meta property="og:title" content="${escapeHtmlAttr(route.title)}" />
    <meta property="og:description" content="${escapeHtmlAttr(route.description)}" />
    <meta property="og:url" content="${escapeHtmlAttr(canonical)}" />
    <meta property="og:image" content="${escapeHtmlAttr(DEFAULT_OG_IMAGE)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtmlAttr(route.title)}" />
    <meta name="twitter:description" content="${escapeHtmlAttr(route.description)}" />
    <meta name="twitter:url" content="${escapeHtmlAttr(canonical)}" />
    <meta name="twitter:image" content="${escapeHtmlAttr(DEFAULT_OG_IMAGE)}" />
${jsonLdTags}`;

  const renderedMarkup = renderToString(React.createElement(PublicMarketingPage, { route }));
  const withHead = injectHeadTags(templateHtml, seoHeadBlock);
  return injectRootContent(withHead, renderedMarkup);
}

/**
 * Renders the clean, non-indexed SPA shell (`dist/app.html`) for authenticated and
 * internal application routes so private dashboards never serve duplicate marketing HTML.
 */
export function renderNoIndexAppShellHtml(templateHtml: string): string {
  const appHeadBlock = `    <title>ThreadsWorks Workspace</title>
    <meta name="description" content="Sign in to your private ThreadsWorks creator workspace." />
    <meta name="robots" content="noindex, nofollow" />`;

  const withHead = injectHeadTags(templateHtml, appHeadBlock);
  return injectRootContent(withHead, "");
}
