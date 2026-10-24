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
      exempt.add(n + 1);
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
    // Drop :not()/:has()/:is() arguments and attribute selectors: they narrow, they don't scope.
    const selector = raw
      .trim()
      .replace(/:(not|has|is|where)\((?:[^()]|\([^()]*\))*\)/g, '')
      .replace(/\[[^\]]*\]/g, '');
    if (!selector || selector === ':root' || /^(from|to|\d+%)$/.test(selector)) continue;
    if (!isScoped(selector, ownsComponents)) {
      report(
        file,
        line,
        'global-selector',
        `"${raw.trim()}" restyles every screen — scope it under this screen's class`,
      );
    }
  }
}

function checkTokens(file, text, exempt) {
  for (const m of text.matchAll(new RegExp(DELETED_TOKEN.source, 'g'))) {
    const line = lineAt(text, m.index);
    if (!exempt.has(line))
      report(file, line, 'deleted-token', `${m[0]} was removed — use --font-size-*`);
  }
  // --text-* names are colours; one inside a size is invalid at computed-value time.
  const sizeWithColour = /(font-size|fontSize)\s*:[^;,}\n]*var\(--text-[\w-]+\)/g;
  for (const m of text.matchAll(sizeWithColour)) {
    const line = lineAt(text, m.index);
    if (!exempt.has(line))
      report(file, line, 'colour-as-size', `${m[0].trim()} — --text-* is a colour token`);
  }
}

function checkTsx(file) {
  const text = fs.readFileSync(file, 'utf8');
  const exempt = exemptLines(text);
  // CSS written inside <style> template strings.
  checkDeclarations(file, text, exempt);
  checkTokens(file, text, exempt);

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

const args = process.argv.slice(2).map((f) => path.resolve(f));
const files = args.length ? args.filter((f) => /\.(css|tsx)$/.test(f)) : walk(CLIENT_SRC);
for (const file of files) {
  if (file.endsWith('.css')) checkCss(file);
  else checkTsx(file);
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
