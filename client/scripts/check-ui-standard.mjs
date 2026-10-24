#!/usr/bin/env node
// Guard for the UI standard in AGENTS.md §17: fails when client CSS/TSX reintroduces a literal
// text size, an off-scale weight, a page-level font, a deleted or colliding token, an unscoped
// global selector in a feature stylesheet, or uppercase text outside table headers and tags.
//
// A genuine exception (an icon glyph, a printed form) is written down where it lives:
//   /* ui-standard-allow: <reason> */        on the same line or the line above
//   ui-standard-allow-start: <reason> … ui-standard-allow-end   around a block
// A marker without a reason does not count.
//
// Usage: node client/scripts/check-ui-standard.mjs [files…]   (no args = all of client/src)

import console from 'node:console';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const CLIENT_SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const REPO_ROOT = path.resolve(CLIENT_SRC, '../..');
// Only the shared layer may style elements and Bootstrap classes globally.
const GLOBAL_STYLE_DIR = path.join(CLIENT_SRC, 'shared/styles');

const SIZE_TOKEN =
  /^var\(--font-size-(display|page-title|kpi|modal-title|section-title|body|secondary|tertiary)\)$/;
const ALLOWED_WEIGHTS = new Set(['400', '500', '600', '700', 'normal', 'bold', 'inherit']);
const WEIGHT_TOKEN = /^var\(--weight-(regular|medium|semibold|bold)\)$/;
const DELETED_TOKEN = /var\(--font-(2xs|xs|sm|md|lg|lead|xl)\)/;
const UPPERCASE_OK = /(\bth\b|badge|tag|pill|-sev\b|-state\b)/;
// Uppercase reads as a label only when it is bold and letter-spaced — the table-header, tag and
// group-label roles. Plain uppercase body or field-label text fails.
const isTrackedLabel = (body) =>
  /letter-spacing\s*:\s*0?\.\d+em/.test(body) &&
  /font-weight\s*:\s*(600|700|var\(--weight-(semibold|bold)\))/.test(body);

// A selector must name a class or id of its own. Bare elements (`body`, `table`, `*`) never do;
// neither do these library classes — Bootstrap 5.3's (exact names, so a screen's own
// `btn-add-author` or `fw-header` still counts as scoped), react-select's and FullCalendar's.
const VARIANT = '(primary|secondary|success|danger|warning|info|light|dark)';
const LIBRARY_CLASS = new RegExp(
  '^(' +
    [
      `btn|btn-${VARIANT}|btn-outline-${VARIANT}|btn-(sm|lg|link|close|close-white|check|group|group-sm|group-lg|group-vertical|toolbar)`,
      'form-(control|control-sm|control-lg|control-plaintext|select|select-sm|select-lg|label|text|check|check-input|check-label|check-inline|switch|range|floating)',
      'modal|modal-(dialog|content|header|body|footer|title|backdrop|sm|lg|xl|fullscreen|dialog-centered|dialog-scrollable|static)',
      `table|table-(responsive|striped|hover|bordered|borderless|sm|active|group-divider|${VARIANT})`,
      'card|card-(body|header|footer|title|subtitle|text|link|group|img|img-top|img-bottom|img-overlay)',
      'nav|nav-(link|item|tabs|pills|fill|justified|underline)|navbar|navbar-(brand|nav|toggler|collapse|expand|expand-lg|text)',
      'badge|dropdown|dropdown-(menu|item|toggle|divider|header|item-text|menu-end|menu-start)|dropup|dropend|dropstart',
      'pagination|pagination-(sm|lg)|page-item|page-link',
      'tooltip|tooltip-inner|tooltip-arrow|popover|popover-(header|body|arrow)',
      'accordion|accordion-(item|header|button|body|collapse|flush)',
      `alert|alert-(${VARIANT.slice(1, -1)}|dismissible|heading|link)`,
      'container|container-fluid|container-(sm|md|lg|xl|xxl)|row|col|col-\\d+|col-(sm|md|lg|xl|xxl)(-\\d+|-auto)?|g-\\d|g[xy]-\\d',
      'input-group|input-group-(text|sm|lg)|list-group|list-group-(item|item-action|flush|numbered|horizontal)',
      `text-(${VARIANT.slice(1, -1)}|muted|white|black|body|body-secondary|center|start|end|truncate|nowrap|wrap|uppercase|lowercase|capitalize|decoration-none|reset|break)`,
      `bg-(${VARIANT.slice(1, -1)}|white|black|transparent|body|body-secondary|body-tertiary)`,
      'fw-(bold|bolder|semibold|medium|normal|light|lighter)|fs-\\d|lh-(1|sm|base|lg)|small|lead|display-\\d',
      'd-(none|inline|inline-block|block|flex|inline-flex|grid|table|table-cell)|[mp][trblxyse]?-(\\d|auto)|gap-\\d|[wh]-\\d+|mw-100|mh-100',
      'flex-(row|column|wrap|nowrap|fill|grow-\\d|shrink-\\d|row-reverse|column-reverse)|justify-content-[\\w-]+|align-(items|self|content)-[\\w-]+',
      'position-(static|relative|absolute|fixed|sticky)|top-\\d+|bottom-\\d+|start-\\d+|end-\\d+|translate-middle[\\w-]*',
      'border|border-\\w+|rounded|rounded-[\\w-]+|shadow|shadow-(sm|lg|none)|visually-hidden|overflow-\\w+',
      'active|show|fade|disabled|collapse|collapsing|collapse-horizontal|offcanvas|offcanvas-[\\w-]+|toast|toast-[\\w-]+',
      'spinner-border|spinner-border-sm|spinner-grow|spinner-grow-sm|progress|progress-bar',
      'invalid-feedback|valid-feedback|invalid-tooltip|valid-tooltip|is-invalid|is-valid|was-validated|close|clearfix|ratio',
      'react-select__[\\w-]+|css-[\\w-]+|fc|fc-[\\w-]+',
    ].join('|') +
    ')$',
);
// The shared Custom* components' own classes (read from their stylesheets): only those
// stylesheets may style them bare; a feature restyling `.custom-btn` alone changes every screen.
const COMPONENT_DIR = path.join(CLIENT_SRC, 'shared/components/ui');
const COMPONENT_CLASSES = new Set(
  fs
    .readdirSync(COMPONENT_DIR)
    .filter((f) => f.endsWith('.css'))
    .flatMap((f) => [
      ...fs.readFileSync(path.join(COMPONENT_DIR, f), 'utf8').matchAll(/\.(custom-[\w-]+)/g),
    ])
    .map((m) => m[1]),
);

const violations = [];

function report(file, line, rule, detail) {
  violations.push({ file: path.relative(REPO_ROOT, file), line, rule, detail });
}

/** Lines exempted by a marker: the marker's own line, the next one, and anything in a block. */
function exemptLines(text) {
  const lines = text.split('\n');
  const exempt = new Set();
  let inBlock = false;
  lines.forEach((line, i) => {
    const n = i + 1;
    if (/ui-standard-allow-start:\s*\S/.test(line)) inBlock = true;
    if (inBlock) exempt.add(n);
    if (/ui-standard-allow-end/.test(line)) inBlock = false;
    if (/ui-standard-allow:\s*\S/.test(line)) {
      exempt.add(n);
      // A marker on a line of its own covers the next line; one trailing code covers only that line.
      if (/^\s*(\/\*|\/\/|\{\/\*)/.test(line)) exempt.add(n + 1);
    }
  });
  return exempt;
}

const lineAt = (text, index) => text.slice(0, index).split('\n').length;

/** Comments replaced by spaces so indexes and line numbers still line up. */
const stripCssComments = (text) =>
  text.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));

function checkDeclarations(file, text, exempt) {
  const decl = /(font-size|font-weight|font-family|text-transform)\s*:\s*([^;}{\n]+)/g;
  for (const m of text.matchAll(decl)) {
    const line = lineAt(text, m.index);
    if (exempt.has(line)) continue;
    const [prop, raw] = [m[1], m[2].replace(/!important/, '').trim()];
    if (prop === 'font-size' && !SIZE_TOKEN.test(raw) && raw !== 'inherit') {
      report(file, line, 'type-size', `font-size: ${raw} — use a --font-size-* role token`);
    }
    if (prop === 'font-weight' && !ALLOWED_WEIGHTS.has(raw) && !WEIGHT_TOKEN.test(raw)) {
      report(file, line, 'type-weight', `font-weight: ${raw} — only 400/500/600/700`);
    }
    if (
      prop === 'font-family' &&
      raw !== 'inherit' &&
      raw !== 'var(--font-family-base)' &&
      !/monospace/.test(raw) &&
      !/^system-ui/.test(raw)
    ) {
      report(file, line, 'type-family', `font-family: ${raw} — the portal uses one font`);
    }
  }
}

function checkCss(file) {
  const original = fs.readFileSync(file, 'utf8');
  const exempt = exemptLines(original);
  const text = stripCssComments(original);
  checkDeclarations(file, text, exempt);
  checkTokens(file, text, exempt);
  checkRules(file, text, exempt);
}

/** Selector scope and uppercase, rule by rule. `text` is CSS whose lines match the file's. */
function checkRules(file, text, exempt) {
  // Walk rule preludes, ignoring @keyframes bodies.
  const isGlobalLayer = file.startsWith(GLOBAL_STYLE_DIR);
  const stack = [];
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '{') {
      const prelude = text.slice(start, i).trim();
      const inKeyframes = stack.some((p) => /^@(-\w+-)?keyframes/.test(p));
      stack.push(prelude);
      if (!prelude.startsWith('@') && !inKeyframes) {
        const line = lineAt(text, start + text.slice(start, i).search(/\S/));
        const body = text.slice(i + 1, text.indexOf('}', i));
        if (!isGlobalLayer && !exempt.has(line)) checkSelector(file, line, prelude);
        if (
          /text-transform\s*:\s*uppercase/.test(body) &&
          !UPPERCASE_OK.test(prelude) &&
          !isTrackedLabel(body)
        ) {
          const bodyLine = lineAt(text, i + 1 + body.search(/text-transform/));
          if (!exempt.has(bodyLine) && !exempt.has(line)) {
            report(
              file,
              bodyLine,
              'uppercase',
              `${prelude} — uppercase is for table headers, tags and group labels (bold and letter-spaced)`,
            );
          }
        }
      }
      start = i + 1;
    } else if (ch === '}') {
      stack.pop();
      start = i + 1;
    } else if (ch === ';' && stack.length === 0) {
      start = i + 1; // @import / @charset
    }
  }
}

/** True when a selector names something of its own — a class or id that isn't a library's. */
function isScoped(selector, ownsComponents) {
  const classes = [...selector.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]);
  if (/#[_a-zA-Z]/.test(selector)) return true;
  return classes.some(
    (c) => !LIBRARY_CLASS.test(c) && (ownsComponents || !COMPONENT_CLASSES.has(c)),
  );
}

function checkSelector(file, line, prelude) {
  const ownsComponents = file.startsWith(COMPONENT_DIR);
  for (const raw of prelude.split(',')) {
    // Drop :not()/:has() arguments and attribute selectors: they narrow, they don't scope.
    // :is()/:where() stay — `:is(.screen-a, .screen-b) .x` is scoped by its arguments.
    const selector = raw
      .trim()
      .replace(/:(not|has)\((?:[^()]|\([^()]*\))*\)/g, '')
      .replace(/\[[^\]]*\]/g, '');
    if (!selector || selector === ':root' || /^(from|to|\d+%)$/.test(selector)) continue;
    if (!isScoped(selector, ownsComponents)) {
      report(
        file,
        line,
        'global-selector',
        `"${raw.trim()}" restyles every screen — scope it under this screen's class`,
      );
      continue;
    }
    const others = otherScreensReached(file, selector);
    if (others.length) {
      const key = `${relSrc(file)}|${raw.trim().replace(/\s+/g, ' ')}`;
      if (BASELINE.has(key)) {
        baselineHit.add(key);
      } else {
        report(
          file,
          line,
          'cross-screen',
          `"${raw.trim()}" also styles ${others.join(', ')} — scope it under this screen's root class`,
        );
      }
    }
  }
}

// ---- Cross-screen collisions ------------------------------------------------------------------
// Every stylesheet is loaded on every page, so a rule leaks when each class of its own is also used
// in the markup of another screen. A screen is a folder under features/ (user-dashboard/<page>
// counts as one) or shared/<dir>; a stylesheet also belongs to every screen that imports it.
// Collisions that predate the guard sit in ui-standard-baseline.json, which may only shrink.
const BASELINE_FILE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'ui-standard-baseline.json',
);
// key → the reason recorded for it
const BASELINE = new Map(
  Object.entries(
    fs.existsSync(BASELINE_FILE) ? JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')).entries : {},
  ),
);
const baselineHit = new Set();
const relSrc = (file) => path.relative(CLIENT_SRC, file).split(path.sep).join('/');

function screenOf(file) {
  const parts = relSrc(file).split('/');
  if (parts[0] === 'features') {
    return parts[1] === 'user-dashboard' && parts.length > 3
      ? `user-dashboard/${parts[2]}`
      : parts[1];
  }
  return parts[0] === 'shared' ? `shared/${parts[1]}` : parts[0];
}

let screenIndex = null;
function buildScreenIndex() {
  const usedIn = new Map(); // class name → screens whose markup uses it
  const owners = new Map(); // stylesheet → screens that import it
  const add = (map, key, value) => {
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(value);
  };
  const all = walk(CLIENT_SRC);
  for (const file of all.filter((f) => f.endsWith('.tsx'))) {
    const text = fs.readFileSync(file, 'utf8');
    const screen = screenOf(file);
    for (const m of text.matchAll(/className=(?:"([^"]*)"|\{((?:[^{}]|\{[^{}]*\})*)\})/g)) {
      const raw = m[1] ?? [...m[2].matchAll(/['"`]([^'"`]*)['"`]/g)].map((s) => s[1]).join(' ');
      for (const c of raw.replace(/\$\{[^}]*\}/g, ' ').match(/[A-Za-z_][\w-]*/g) || []) {
        add(usedIn, c, screen);
      }
    }
    for (const m of text.matchAll(/import\s+['"]([^'"]+\.css)['"]/g)) {
      add(owners, path.resolve(path.dirname(file), m[1]), screen);
    }
  }
  // @import chains: an imported stylesheet belongs to its importer's screens as well.
  const sheets = all.filter((f) => f.endsWith('.css'));
  for (let pass = 0; pass < 3; pass += 1) {
    for (const sheet of sheets) {
      for (const m of fs.readFileSync(sheet, 'utf8').matchAll(/@import\s+['"]([^'"]+\.css)['"]/g)) {
        const target = path.resolve(path.dirname(sheet), m[1]);
        add(owners, target, screenOf(sheet));
        for (const s of owners.get(sheet) || []) add(owners, target, s);
      }
    }
  }
  return { usedIn, owners };
}

/** Screens other than this stylesheet's own that the selector's classes all appear in. */
/**
 * Other screens whose markup uses every one of the selector's own classes — the screens the rule
 * can actually match. A class used on screen B and another used on screen C reach neither, so the
 * sets are intersected, not combined.
 */
function otherScreensReached(file, selector, index = null) {
  if (!file.startsWith(CLIENT_SRC) || file.startsWith(COMPONENT_DIR)) return [];
  const { usedIn, owners } = index ?? (screenIndex ??= buildScreenIndex());
  const mine = new Set([screenOf(file), ...(owners.get(file) || [])]);
  const own = [...selector.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)]
    .map((m) => m[1])
    .filter((c) => !LIBRARY_CLASS.test(c) && !COMPONENT_CLASSES.has(c));
  if (!own.length) return [];
  const [first, ...rest] = own.map(
    (c) => new Set([...(usedIn.get(c) || [])].filter((s) => !mine.has(s))),
  );
  return [...first].filter((screen) => rest.every((set) => set.has(screen))).sort();
}

function checkTokens(file, text, exempt) {
  for (const m of text.matchAll(new RegExp(DELETED_TOKEN.source, 'g'))) {
    const line = lineAt(text, m.index);
    if (!exempt.has(line))
      report(file, line, 'deleted-token', `${m[0]} was removed — use --font-size-*`);
  }
  // And the reverse: a size token in a colour property silently falls back to the inherited colour.
  const colourWithSize =
    /\b(color|background(?:-color)?|border(?:-[a-z]+)?-color|fill|stroke|backgroundColor|borderColor)\s*:\s*'?var\(--font-size-[\w-]+\)/g;
  for (const m of text.matchAll(colourWithSize)) {
    const line = lineAt(text, m.index);
    if (!exempt.has(line))
      report(file, line, 'size-as-colour', `${m[0].trim()} — --font-size-* is a size token`);
  }
  // --text-* names are colours; one inside a size is invalid at computed-value time.
  const sizeWithColour = /(font-size|fontSize)\s*:[^;,}\n]*var\(--text-[\w-]+\)/g;
  for (const m of text.matchAll(sizeWithColour)) {
    const line = lineAt(text, m.index);
    if (!exempt.has(line))
      report(file, line, 'colour-as-size', `${m[0].trim()} — --text-* is a colour token`);
  }
}

/**
 * The CSS inside a component's <style>{`…`}</style> blocks, with everything else blanked to
 * spaces so line numbers still match the .tsx file.
 */
function embeddedCss(text) {
  const keep = new Array(text.length).fill(false);
  for (const m of text.matchAll(/<style[^>]*>\s*\{\s*`([\s\S]*?)`\s*\}\s*<\/style>/g)) {
    const start = m.index + m[0].indexOf(m[1]);
    for (let i = start; i < start + m[1].length; i += 1) keep[i] = true;
  }
  return [...text].map((ch, i) => (keep[i] || ch === '\n' ? ch : ' ')).join('');
}

function checkTsx(file) {
  const text = fs.readFileSync(file, 'utf8');
  const exempt = exemptLines(text);
  // CSS written inside <style> template strings: declarations, tokens, selectors, uppercase.
  checkDeclarations(file, text, exempt);
  checkTokens(file, text, exempt);
  checkRules(file, stripCssComments(embeddedCss(text)), exempt);

  // The shared layer is imported once, by main.tsx through index.css, after every feature
  // stylesheet. Imported from a feature it loads early and feature CSS outranks it.
  if (!file.endsWith(`${path.sep}main.tsx`)) {
    for (const m of text.matchAll(/import\s+['"][^'"]*shared\/styles\/[^'"]+\.css['"]/g)) {
      const line = lineAt(text, m.index);
      if (!exempt.has(line)) {
        report(
          file,
          line,
          'shared-style-import',
          'shared/styles is imported once, from main.tsx — remove this import',
        );
      }
    }
  }

  // Inline uppercase follows the same rule as CSS: only as a bold, letter-spaced label.
  for (const m of text.matchAll(/textTransform\s*:\s*['"`]uppercase['"`]/g)) {
    const line = lineAt(text, m.index);
    if (exempt.has(line)) continue;
    const open = text.lastIndexOf('{', m.index);
    const close = text.indexOf('}', m.index);
    const style = text.slice(open, close);
    const tracked =
      /letterSpacing\s*:/.test(style) &&
      /fontWeight\s*:\s*['"`]?(600|700|var\(--weight-(semibold|bold)\))/.test(style);
    if (!tracked) {
      report(
        file,
        line,
        'uppercase',
        "textTransform: 'uppercase' — only for a bold, letter-spaced label (table header, tag, group label)",
      );
    }
  }

  const prop = /\b(fontSize|fontWeight|fontFamily)\s*:\s*((?:'[^']*'|"[^"]*"|`[^`]*`|[^,}\n])+)/g;
  for (const m of text.matchAll(prop)) {
    const line = lineAt(text, m.index);
    if (exempt.has(line)) continue;
    const [name, value] = [m[1], m[2].trim()];
    const strings = [...value.matchAll(/'([^']*)'|"([^"]*)"|`([^`]*)`/g)].map(
      (s) => s[1] ?? s[2] ?? s[3],
    );
    const numbers = [
      ...value.replace(/'[^']*'|"[^"]*"|`[^`]*`/g, '').matchAll(/(?<![\w.])\d+(\.\d+)?(?![\w.])/g),
    ].map((n) => n[0]);
    if (name === 'fontSize') {
      const bad = strings.filter((s) => !SIZE_TOKEN.test(s) && s !== 'inherit').concat(numbers);
      if (bad.length)
        report(file, line, 'type-size', `fontSize: ${value} — use 'var(--font-size-*)'`);
    }
    if (name === 'fontWeight') {
      const bad = strings
        .filter((s) => !ALLOWED_WEIGHTS.has(s) && !WEIGHT_TOKEN.test(s))
        .concat(numbers.filter((n) => !ALLOWED_WEIGHTS.has(n)));
      if (bad.length)
        report(file, line, 'type-weight', `fontWeight: ${value} — only 400/500/600/700`);
    }
    if (name === 'fontFamily') {
      const bad = strings.filter((s) => s !== 'inherit' && !/monospace/.test(s));
      if (bad.length)
        report(file, line, 'type-family', `fontFamily: ${value} — the portal uses one font`);
    }
  }
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(css|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function run(files) {
  violations.length = 0;
  for (const file of files) {
    if (file.endsWith('.css')) checkCss(file);
    else checkTsx(file);
  }
  return violations.map((v) => `${path.basename(v.file)}:${v.line} ${v.rule}`);
}

// Fixtures for both paths — a stylesheet and a component's <style> block and inline styles.
// Each entry is the exact set of findings expected; `--self-test` fails on any difference.
const SELF_TEST = {
  'fixture.css': {
    source: [
      '.p .a { font-size: 15px; font-weight: 800; }', // 1: type-size, type-weight
      '.p .b { font-size: var(--text-body); }', // 2: type-size, colour-as-size
      '.p .c { color: var(--font-size-body); }', // 3: size-as-colour
      '.btn { padding: 0; }', // 4: global-selector
      '.p .d { text-transform: uppercase; }', // 5: uppercase
      '.p .e { font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; }', // 6: ok
      '.p .f { font-size: 18px; } /* ui-standard-allow: icon glyph */', // 7: exempt
      '.p .g { font-size: var(--font-size-body); font-family: Poppins; }', // 8: type-family
    ].join('\n'),
    expect: [
      'fixture.css:1 type-size',
      'fixture.css:1 type-weight',
      'fixture.css:2 type-size',
      'fixture.css:2 colour-as-size',
      'fixture.css:3 size-as-colour',
      'fixture.css:4 global-selector',
      'fixture.css:5 uppercase',
      'fixture.css:8 type-family',
    ],
  },
  'Fixture.tsx': {
    source: [
      'export const A = () => (', // 1
      '  <div>', // 2
      '    <style>{`', // 3
      '      body { margin: 0; }', // 4: global-selector
      '      .p .h { text-transform: uppercase; }', // 5: uppercase
      '      .p .i { font-size: 13px; }', // 6: type-size
      '    `}</style>', // 7
      "    <span style={{ fontSize: '0.9rem', fontWeight: 900 }} />", // 8: type-size, type-weight
      "    <span style={{ textTransform: 'uppercase' }} />", // 9: uppercase
      "    <span style={{ textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }} />", // 10: ok
      "    <span style={{ fontSize: 'var(--font-size-secondary)' }} />", // 11: ok
      '  </div>', // 12
      ');', // 13
      "import '../../shared/styles/base.css';", // 14: shared-style-import
    ].join('\n'),
    expect: [
      'Fixture.tsx:4 global-selector',
      'Fixture.tsx:5 uppercase',
      'Fixture.tsx:6 type-size',
      'Fixture.tsx:8 type-size',
      'Fixture.tsx:8 type-weight',
      'Fixture.tsx:9 uppercase',
      'Fixture.tsx:14 shared-style-import',
    ],
  },
};

if (process.argv.includes('--self-test')) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-standard-'));
  let failed = 0;
  for (const [name, { source, expect }] of Object.entries(SELF_TEST)) {
    const file = path.join(dir, name);
    fs.writeFileSync(file, source);
    const got = run([file]).sort();
    const want = [...expect].sort();
    const missing = want.filter((w) => !got.includes(w));
    const extra = got.filter((g) => !want.includes(g));
    if (missing.length || extra.length) {
      failed += 1;
      console.log(
        `self-test ${name}: missing ${JSON.stringify(missing)} extra ${JSON.stringify(extra)}`,
      );
    }
  }
  fs.rmSync(dir, { recursive: true, force: true });
  // Collision logic on a synthetic index: a screen counts only when it uses every own class.
  const sheet = path.join(CLIENT_SRC, 'features/alpha/alpha.css');
  const index = {
    owners: new Map(),
    usedIn: new Map([
      ['x', new Set(['beta'])],
      ['y', new Set(['gamma'])],
      ['z', new Set(['beta', 'gamma'])],
    ]),
  };
  const collisionCases = [
    ['.x.y', []], // x only on beta, y only on gamma: no screen matches both
    ['.x .z', ['beta']], // beta uses both
    ['.z', ['beta', 'gamma']],
    ['.alpha-only', []], // used nowhere else
  ];
  for (const [selector, want] of collisionCases) {
    const got = otherScreensReached(sheet, selector, index);
    if (JSON.stringify(got) !== JSON.stringify(want)) {
      failed += 1;
      console.log(
        `self-test collision ${selector}: want ${JSON.stringify(want)} got ${JSON.stringify(got)}`,
      );
    }
  }
  if (failed) process.exit(1);
  console.log(
    `UI standard self-test: ${Object.keys(SELF_TEST).length} fixtures and ${collisionCases.length} collision cases pass.`,
  );
  process.exit(0);
}

const args = process.argv
  .slice(2)
  .filter((a) => !a.startsWith('--'))
  .map((f) => path.resolve(f));
const files = args.length ? args.filter((f) => /\.(css|tsx)$/.test(f)) : walk(CLIENT_SRC);
run(files);

// --write-baseline records today's cross-screen collisions (review the diff: it should only shrink).
// It needs the full scan: entries for files not scanned would otherwise be dropped. Entries still
// colliding are matched by the baseline and never become violations, so they are carried over
// with their recorded reason; only new collisions come from the violations.
if (process.argv.includes('--write-baseline')) {
  if (args.length) {
    console.log('--write-baseline needs a full scan — run it without file arguments.');
    process.exit(1);
  }
  const fresh = violations
    .filter((v) => v.rule === 'cross-screen')
    .map((v) => [
      `${relSrc(path.resolve(REPO_ROOT, v.file))}|${v.detail.match(/^"([^"]+)"/)[1].replace(/\s+/g, ' ')}`,
      v.detail.replace(/^"[^"]+" /, ''),
    ]);
  const kept = [...baselineHit].map((key) => [key, BASELINE.get(key)]);
  const entries = Object.fromEntries([...kept, ...fresh].sort(([a], [b]) => a.localeCompare(b)));
  const note =
    'Cross-screen collisions that predate the guard (duplicated stylesheets). Fix and delete entries; never add one by hand.';
  fs.writeFileSync(BASELINE_FILE, `${JSON.stringify({ note, entries }, null, 2)}\n`);
  console.log(`Wrote ${Object.keys(entries).length} baseline entries.`);
  process.exit(0);
}

// A full run also fails on baseline entries that no longer collide, so the baseline only shrinks.
if (!args.length) {
  for (const key of BASELINE.keys()) {
    if (!baselineHit.has(key)) {
      violations.push({
        file: path.relative(REPO_ROOT, BASELINE_FILE),
        line: 1,
        rule: 'stale-baseline',
        detail: `"${key}" no longer collides — delete it from the baseline`,
      });
    }
  }
}

if (violations.length) {
  for (const v of violations) console.log(`${v.file}:${v.line}  [${v.rule}]  ${v.detail}`);
  console.log(
    `\n${violations.length} UI standard violation(s) in ${new Set(violations.map((v) => v.file)).size} file(s). ` +
      'See AGENTS.md §17; a genuine exception needs a `ui-standard-allow: <reason>` comment.',
  );
  process.exit(1);
}
console.log(`UI standard: ${files.length} files checked, no violations.`);
