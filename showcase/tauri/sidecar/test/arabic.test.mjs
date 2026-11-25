// Arabic replies: the font that draws them is bundled and declared in every page that shows text (desktop.html for the
// overlay, onboarding.css for the panel and setup guide), with its licence and credit. Run: npm test
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../../../', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, root), 'utf8');
const WOFF = 'onboarding/fonts/readex-pro-arabic.woff2';
assert.ok(fs.statSync(new URL(WOFF, root)).size > 10_000, 'the Arabic font file is bundled');
assert.ok(fs.statSync(new URL('onboarding/fonts/OFL-ReadexPro.txt', root)).size > 1000, 'with its licence text');
assert.match(fs.readFileSync(new URL('../THIRD_PARTY_NOTICES.md', root), 'utf8'), /Readex Pro/, 'and its credit');

for (const [file, url] of [['desktop.html', 'onboarding/fonts/readex-pro-arabic.woff2'], ['onboarding/onboarding.css', 'fonts/readex-pro-arabic.woff2']]) {
  const css = read(file);
  const face = (name) => new RegExp(`@font-face\\s*\\{[^}]*font-family:\\s*"${name}";[^}]*\\}`).exec(css)?.[0] ?? '';
  const letters = face('Roamies Arabic'), rtl = face('Roamies Arabic RTL');
  assert.ok(letters && rtl, `${file} declares both Arabic faces`);
  assert.ok(letters.includes(url) && rtl.includes(url), `${file}: both load the bundled file`);
  assert.ok(!/U\+0020/.test(letters), `${file}: the letters face leaves the space to the system font`);
  assert.ok(/U\+0020/.test(rtl) && /U\+0600-06FF/.test(rtl), `${file}: the right-to-left face also takes the space`);
}
const SANS = '"Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system';
assert.ok(read('onboarding/onboarding.css').includes(`--font: ${SANS}, "Roamies Arabic"`), 'the panel stack has the Arabic letters after the system font');

// Where the overlay draws or lays out text, Arabic gets the font: canvas stacks and the card / capsule / ask bar rules.
const js = (f) => read(`roamies/${f}`);
for (const f of ['glass.js', 'ink.js', 'agent-panel.js', 'agent-home.js', 'ask-bar.js', 'notch.js']) {
  assert.ok(js(f).includes(`${SANS}, "Roamies Arabic"`), `${f}: Arabic letters after the system font`);
}
// The bubble lays letters on a grid, one per column: its font must be monospace, or wide letters are cut off.
const bubbleFont = /const BUBBLE_FONT = '([^']*)'/.exec(js('agent.js'))?.[1] ?? '';
assert.match(bubbleFont, /^"Cascadia Mono", Consolas, .*"Roamies Arabic", monospace$/, 'the bubble font is monospace, with the Arabic letters');
assert.ok(js('core.js').includes(`R.rtlFont = (s, font) => (R.rtl(s) ? String(font).replace('${SANS}', '"Roamies Arabic RTL", ${SANS}')`), 'right-to-left canvas text puts the Arabic face first');
assert.ok(js('agent.js').includes('const rf = R.rtlFont(line.s, `${base} ${fpx}px ${G.SANS}`)'), 'the bubble draws Arabic lines whole, in the system font');
assert.match(js('agent-panel.js'), /\.rp-body :dir\(rtl\) \{ font-family: "Roamies Arabic RTL"/, 'the card too, per paragraph');
assert.match(js('notch.js'), /\.nc-line:dir\(rtl\) \{ font-family: "Roamies Arabic RTL"/, 'and the capsule, per line');
assert.match(js('ask-bar.js'), /ta\.dir = 'auto'/, 'typing Arabic runs right to left');

console.log('arabic tests: passed');
