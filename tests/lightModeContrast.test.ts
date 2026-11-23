import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CSS_PATH = path.join(ROOT, 'src', 'index.css');

function parseHexToRgb(hex: string): [number, number, number] {
  const clean = hex.trim().replace(/^#/, '');
  assert.match(clean, /^[0-9a-fA-F]{6}$/, `Expected 6-digit hex color, got: ${hex}`);
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(fgHex: string, bgHex: string): number {
  const l1 = relativeLuminance(fgHex);
  const l2 = relativeLuminance(bgHex);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function extractCssBlockVars(css: string, selectorRegex: RegExp): Record<string, string> {
  const match = css.match(selectorRegex);
  assert.ok(match, `Could not find CSS block matching ${selectorRegex}`);
  const body = match[1];
  const vars: Record<string, string> = {};
  const varRegex = /(--[a-zA-Z0-9-]+)\s*:\s*([^;]+);/g;
  let m: RegExpExecArray | null;
  while ((m = varRegex.exec(body)) !== null) {
    vars[m[1]] = m[2].replace(/\/\*[\s\S]*?\*\//g, '').trim();
  }
  return vars;
}

const cssContent = fs.readFileSync(CSS_PATH, 'utf8');
const lightVars = extractCssBlockVars(cssContent, /:root\s*\{([\s\S]*?)\n\}/);
const darkVars = extractCssBlockVars(cssContent, /\.dark,\s*\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/);

test('Tailwind v4 dark variant is explicitly bound to .dark and data-theme="dark"', () => {
  assert.match(
    cssContent,
    /@custom-variant\s+dark\s*\(&:where\(\.dark,\s*\.dark \*,\s*\[data-theme="dark"\],\s*\[data-theme="dark"\] \*\)\);/,
    'Missing Tailwind v4 class/attribute-based @custom-variant dark declaration'
  );
});

test('Light Mode primary, secondary, muted, and brand typography meet WCAG AA (>= 4.5:1) on all surfaces', () => {
  const surfaces = ['--bg-card', '--bg-app', '--bg-sidebar', '--bg-input', '--bg-card-hover'] as const;
  const textTokens = ['--text-primary', '--text-secondary', '--text-muted', '--brand-text', '--brand-text-strong'] as const;

  for (const surface of surfaces) {
    const bgHex = lightVars[surface];
    assert.ok(bgHex, `Missing Light Mode surface token ${surface}`);
    for (const textToken of textTokens) {
      const fgHex = lightVars[textToken];
      assert.ok(fgHex, `Missing Light Mode text token ${textToken}`);
      const ratio = contrastRatio(fgHex, bgHex);
      assert.ok(
        ratio >= 4.5,
        `Contrast failure for ${textToken} (${fgHex}) on ${surface} (${bgHex}): ${ratio.toFixed(2)}:1 < 4.5:1`
      );
    }
  }
});

test('Light Mode brand badges and semantic status indicators meet WCAG AA (>= 4.5:1)', () => {
  const pairs: Array<[string, string]> = [
    ['--brand-text', '--brand-surface'],
    ['--brand-text-strong', '--brand-surface'],
    ['--brand-text-strong', '--brand-surface-hover'],
    ['--status-active-text', '--status-active-bg'],
    ['--status-success-text', '--status-success-bg'],
    ['--status-warning-text', '--status-warning-bg'],
    ['--status-danger-text', '--status-danger-bg'],
    ['--status-info-text', '--status-info-bg'],
  ];

  for (const [fgToken, bgToken] of pairs) {
    const fgHex = lightVars[fgToken];
    const bgHex = lightVars[bgToken];
    assert.ok(fgHex && bgHex, `Missing Light Mode tokens ${fgToken} or ${bgToken}`);
    const ratio = contrastRatio(fgHex, bgHex);
    assert.ok(
      ratio >= 4.5,
      `Contrast failure for ${fgToken} (${fgHex}) on ${bgToken} (${bgHex}): ${ratio.toFixed(2)}:1 < 4.5:1`
    );
  }
});

test('Light Mode zinc text tokens remain high-contrast on light surfaces', () => {
  const lightSurfaces = [lightVars['--zinc-950'], lightVars['--zinc-900']];
  const zincTextTokens = ['--zinc-600', '--zinc-550', '--zinc-500', '--zinc-400', '--zinc-300', '--zinc-200', '--zinc-100', '--zinc-50'];

  for (const bgHex of lightSurfaces) {
    for (const token of zincTextTokens) {
      const fgHex = lightVars[token];
      assert.ok(fgHex, `Missing Light Mode token ${token}`);
      const ratio = contrastRatio(fgHex, bgHex);
      assert.ok(
        ratio >= 4.5,
        `Zinc Light Mode contrast failure for ${token} (${fgHex}) on ${bgHex}: ${ratio.toFixed(2)}:1 < 4.5:1`
      );
    }
  }
});

test('Light Mode logo vector primary stops maintain strong contrast (>= 3.0:1) against light header/sidebar', () => {
  const headerBg = lightVars['--bg-sidebar'];
  const logoStops = ['--logo-primary-0', '--logo-primary-1', '--logo-primary-2', '--logo-secondary-0', '--logo-secondary-1'];
  for (const stop of logoStops) {
    const hex = lightVars[stop];
    assert.ok(hex, `Missing logo token ${stop}`);
    const ratio = contrastRatio(hex, headerBg);
    assert.ok(
      ratio >= 3.0,
      `Logo stop ${stop} (${hex}) has insufficient contrast on ${headerBg}: ${ratio.toFixed(2)}:1 < 3.0:1`
    );
  }
});

test('Dark Mode palette tokens remain preserved without regression', () => {
  assert.equal(darkVars['--bg-app'], '#09090b');
  assert.equal(darkVars['--bg-card'], '#18181b');
  assert.equal(darkVars['--bg-card-hover'], '#27272a');
  assert.equal(darkVars['--bg-sidebar'], '#09090b');
  assert.equal(darkVars['--bg-input'], '#09090b');
  assert.equal(darkVars['--text-primary'], '#f4f4f5');
  assert.equal(darkVars['--text-secondary'], '#d4d4d8');
  assert.equal(darkVars['--text-muted'], '#a1a1aa');
  assert.equal(darkVars['--brand-text'], '#c084fc');
  assert.equal(darkVars['--status-active-text'], '#6ee7b7');
});

test('Key UI components use centralized semantic tokens and dark-scope protection where required', () => {
  const contentEngine = fs.readFileSync(path.join(ROOT, 'src', 'components', 'ContentEngineView.tsx'), 'utf8');
  assert.match(contentEngine, /bg-status-active-bg/, 'ContentEngineView should use bg-status-active-bg for active AI status indicator');
  assert.match(contentEngine, /text-status-active-text/, 'ContentEngineView should use text-status-active-text for active AI status indicator');
  assert.match(contentEngine, /Edit Context/, 'ContentEngineView should render Edit Context button');
  assert.doesNotMatch(
    contentEngine,
    /(?<!dark:)\btext-(purple|emerald)-(200|300)\b/,
    'ContentEngineView should not contain unprefixed pale purple/emerald text classes'
  );

  const logo = fs.readFileSync(path.join(ROOT, 'src', 'components', 'ThreadsWorksLogo.tsx'), 'utf8');
  assert.match(logo, /var\(--logo-primary-0\)/, 'ThreadsWorksLogo should reference centralized theme CSS variables');

  const authScreen = fs.readFileSync(path.join(ROOT, 'src', 'components', 'AuthScreen.tsx'), 'utf8');
  assert.match(authScreen, /data-theme="dark"/, 'AuthScreen must lock its permanently dark canvas with data-theme="dark"');

  const marketingPage = fs.readFileSync(path.join(ROOT, 'src', 'components', 'PublicMarketingPage.tsx'), 'utf8');
  assert.match(marketingPage, /data-theme="dark"/, 'PublicMarketingPage must lock its permanently dark canvas with data-theme="dark"');
});
