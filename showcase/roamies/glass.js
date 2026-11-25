// The card look shared by the Sidekick's own UI (bubbles, the thinking tag, task tags, the step list): the same
// round corners, dark glass, cyan edge, glint and system font as the drawings' cards (ink.js) and the reminders.
(() => {
  const R = window.Roamie;
  if (!R || typeof document === 'undefined') return;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // Classic Obsidian Cyan Glass palette for AI speech, thoughts and quips
  // Dark (this) or Light (setTheme below): follows the panel's Appearance > Theme.
  let ACC = '#78efff', HOT = '#dcfbff', MID = '#2f4c6d', DEEP = '#0c162c', EDGE = 'rgba(120, 239, 255, 0.45)';
  let GLASS = 'rgba(10, 16, 28, 0.94)', TEXT = '#dcfbff', DIM = '#7090b0', CORAL = '#ff5b79', NOTE = '#ff7590';
  let SHADOW = 'rgba(0, 8, 24, 0.55)', LAND = '#ffffff', LINK = '#78efff';
  const SANS = '"Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, "Roamies Arabic", sans-serif';
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const rgba = (h, a) => `rgba(${hex(h).join(',')},${a})`;

  // The outline, clockwise from the top-left, with round corners (radius from c); tail: { side: 'top'|'right'|
  // 'bottom'|'left', at, to: [x, y] } adds a smooth pointed tail on that side, centred at `at` and leaning toward `to`.
  function cardOutline(x, y, w, h, c = 8, tail = null) {
    const b = y + h, r = x + w, rad = Math.min(c * 1.5, w / 2, h / 2);
    const arc = (cx, cy, a0) => Array.from({ length: 5 }, (_, i) => { const a = a0 + ((i + 1) * Math.PI) / 12; return [cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]; });
    const pts = [], start = {};
    start.top = pts.push([x + rad, y]) - 1; pts.push([r - rad, y], ...arc(r - rad, y + rad, -Math.PI / 2));
    start.right = pts.push([r, y + rad]) - 1; pts.push([r, b - rad], ...arc(r - rad, b - rad, 0));
    start.bottom = pts.push([r - rad, b]) - 1; pts.push([x + rad, b], ...arc(x + rad, b - rad, Math.PI / 2));
    start.left = pts.push([x, b - rad]) - 1; pts.push([x, y + rad], ...arc(x + rad, y + rad, Math.PI));
    if (!tail) return pts;
    // Each side as the path walks it: where it starts, its direction and its outward normal.
    const SIDE = { top: [[x, y], [1, 0], [0, -1]], right: [[r, y], [0, 1], [1, 0]], bottom: [[r, b], [-1, 0], [0, 1]], left: [[x, b], [0, -1], [-1, 0]] }[tail.side];
    if (!SIDE) return pts;
    const [o, e, n] = SIDE, len = Math.abs(e[0]) ? w : h;
    // Position along the walked side, kept clear of the corners.
    const w0 = tail.w ?? 12, along = clamp(Math.abs(e[0]) ? (tail.at - o[0]) * e[0] : (tail.at - o[1]) * e[1], rad + w0 / 2 + 2, len - rad - w0 / 2 - 2);
    const base = [o[0] + e[0] * along, o[1] + e[1] * along];
    const to = tail.to ?? [base[0] + n[0] * 14, base[1] + n[1] * 14];
    const depth = clamp((to[0] - base[0]) * n[0] + (to[1] - base[1]) * n[1], 6, tail.max ?? 18), shift = (to[0] - base[0]) * e[0] + (to[1] - base[1]) * e[1];
    const P = (a, d) => [base[0] + e[0] * a + n[0] * d, base[1] + e[1] * a + n[1] * d];
    pts.splice(start[tail.side] + 1, 0, P(-w0 / 2, 0), P(shift * 0.8, depth), P(w0 / 2, 0));
    return pts;
  }
  const outlinePath = (x, y, w, h, c, tail) => { const p = new Path2D(); cardOutline(x, y, w, h, c, tail).forEach((q, i) => (i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1]))); p.closePath(); return p; };

  // Obsidian Cyan Glass card with cyan edge, deep blue-black glass, and soft glow
  function chrome(c, x, y, w, h, o = {}) {
    const path = o.path || outlinePath(x, y, w, h, o.corner ?? 8, o.tail), edge = o.edge || EDGE;
    c.save();
    c.fillStyle = o.fill || GLASS;
    c.shadowColor = SHADOW;
    c.shadowBlur = 18;
    c.shadowOffsetY = 6;
    c.fill(path);
    c.shadowBlur = 0;
    c.strokeStyle = edge;
    c.lineWidth = 1.5;
    c.stroke(path);
    c.restore();
  }

  const meas = document.createElement('canvas').getContext('2d');
  const textW = (s, font) => { meas.font = font; return meas.measureText(String(s ?? '')).width; };
  // Words typing themselves in; the last couple land white. Returns the full width.
  function typed(c, str, x, y, font, color, u = 1, o = {}) {
    str = String(str ?? '');
    c.save(); c.font = R.rtlFont ? R.rtlFont(str, font) : font; c.textBaseline = o.baseline || 'middle'; c.textAlign = 'left';
    const full = c.measureText(str).width, x0 = o.anchor === 'middle' ? x - full / 2 : o.anchor === 'end' ? x - full : x;
    const n = Math.floor(str.length * clamp(u, 0, 1));
    if (n >= str.length) { c.fillStyle = color; c.fillText(str, x0, y); }
    else if (n > 0) { const head = str.slice(0, Math.max(0, n - 2)); c.fillStyle = color; c.fillText(head, x0, y); c.fillStyle = LAND; c.fillText(str.slice(head.length, n), x0 + c.measureText(head).width, y); }
    c.restore();
    return full;
  }
  // Lines of at most w px (a word wider than a line is broken); past max rows the last one ends in an ellipsis.
  function wrapRows(str, w, font, max = Infinity) {
    meas.font = font;
    const fits = (t) => meas.measureText(t).width <= w, rows = [];
    for (const para of String(str ?? '').split('\n')) {
      let row = '';
      for (let wd of para.split(/\s+/).filter(Boolean)) {
        const tr = row ? `${row} ${wd}` : wd;
        if (fits(tr)) { row = tr; continue; }
        if (row) { rows.push(row); row = ''; }
        while (!fits(wd)) { let k = wd.length - 1; while (k > 1 && !fits(wd.slice(0, k))) k--; rows.push(wd.slice(0, k)); wd = wd.slice(k); }
        row = wd;
      }
      rows.push(row);
    }
    if (rows.length > max) {
      const rest = rows.splice(max), full = `${rows[max - 1]} ${rest.join(' ')}`;
      let last = full;
      while (last && !fits(`${last}…`)) last = last.slice(0, -1);
      // End on a whole word when one is close, rather than mid-word.
      const sp = last.lastIndexOf(' ');
      if (full[last.length] !== ' ' && sp > last.length * 0.6) last = last.slice(0, sp);
      rows[max - 1] = `${last.trimEnd()}…`;
    }
    return rows;
  }
  // A hand-drawn ring: a slightly wobbly circle that overshoots where it closes, the same each time for one seed.
  const ringPts = (cx, cy, r, seed = 0) => Array.from({ length: 34 }, (_, i) => {
    const a = -2.2 + (i / 30) * Math.PI * 2, k = 1 + 0.06 * Math.sin(i * 1.7 + seed) + (i > 28 ? 0.08 : 0);
    return [cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k];
  });
  // The pen's stroke (a dark edge so it reads on white, then the colour with a soft glow), drawn up to u of its length.
  function pen(c, pts, color, w = 2.2, u = 1) {
    const n = Math.max(2, Math.ceil(pts.length * clamp(u, 0, 1)));
    if (u <= 0) return;
    const path = new Path2D(); pts.slice(0, n).forEach((q, i) => (i ? path.lineTo(q[0], q[1]) : path.moveTo(q[0], q[1])));
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = EDGE; c.lineWidth = w + 2; c.stroke(path);
    c.shadowColor = rgba(color, 0.7); c.shadowBlur = 6; c.strokeStyle = color; c.lineWidth = w; c.stroke(path);
    c.restore();
  }

  // A button like the drawings' chips (ink.js): filled is cyan with dark ink, otherwise dark glass with a cyan
  // edge and light ink. focus adds a bright ring, so the keyboard's choice shows; down presses it into its shadow.
  const CHIP_F = `700 11px ${SANS}`;
  let INK_DARK = '#030e27';
  const mix = (a, b, k) => `rgb(${hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * k)).join(',')})`;
  const chipW = (label) => Math.round(textW(label, CHIP_F) + 22);
  function chip(c, x, y, w, h, label, o = {}) {
    c.save();
    if (o.focus) { c.strokeStyle = HOT; c.lineWidth = 2; c.stroke(outlinePath(x - 3.5, y - 3.5, w + 7, h + 9, 6)); }
    if (o.down) c.translate(0, 2);
    c.fillStyle = o.filled ? mix(ACC, '#000000', 0.62) : 'rgba(0,0,0,0.45)'; c.fill(outlinePath(x, y + (o.down ? 1 : 3), w, h, 4));
    const face = outlinePath(x, y, w, h, 4);
    if (o.filled) {
      c.fillStyle = o.hover ? mix(ACC, '#ffffff', 0.3) : ACC; c.fill(face);
      c.fillStyle = 'rgba(255,255,255,0.55)'; c.fillRect(x + 4, y + 1, w - 8, 1.5); c.fillStyle = 'rgba(3, 14, 39,0.25)'; c.fillRect(x + 4, y + h - 2.5, w - 8, 1.5);
    } else {
      c.fillStyle = GLASS; c.fill(face);
      if (o.hover) { c.fillStyle = rgba(ACC, 0.16); c.fill(face); }
      c.strokeStyle = ACC; c.lineWidth = 1.5; c.stroke(face);
    }
    c.font = CHIP_F; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = o.filled ? INK_DARK : TEXT;
    c.fillText(String(label ?? ''), x + w / 2, y + h / 2 + 0.5);
    c.restore();
  }

  const THEMES = {
    dark: { ACC, HOT, MID, DEEP, EDGE, GLASS, TEXT, DIM, CORAL, NOTE, SHADOW, LAND, LINK, INK_DARK },
    light: { ACC: '#18181b', HOT: '#09090b', MID: '#a1a1aa', DEEP: '#f4f4f5', EDGE: 'rgba(0, 0, 0, 0.14)', GLASS: 'rgba(255, 255, 255, 0.97)', TEXT: '#18181b', DIM: '#71717a', CORAL: '#e11d48', NOTE: '#e11d48', SHADOW: 'rgba(0, 0, 0, 0.16)', LAND: '#a1a1aa', LINK: '#2563eb', INK_DARK: '#ffffff' },
  };
  // Swaps the palette; everything reads it as it draws, so the next frame has it.
  function setTheme(t) {
    const p = THEMES[t === 'light' ? 'light' : 'dark'];
    ({ ACC, HOT, MID, DEEP, EDGE, GLASS, TEXT, DIM, CORAL, NOTE, SHADOW, LAND, LINK, INK_DARK } = p);
    Object.assign(R.glass, { ACC, HOT, MID, DEEP, EDGE, GLASS, TEXT, DIM, CORAL, NOTE, LINK, LAND, theme: t === 'light' ? 'light' : 'dark' });
  }
  R.glass = { ACC, HOT, MID, DEEP, EDGE, GLASS, TEXT, DIM, CORAL, NOTE, LINK, LAND, theme: 'dark', setTheme, SANS, rgba, cardOutline, outlinePath, chrome, textW, typed, wrapRows, ringPts, pen, chip, chipW, CHIP_H: 23 };
})();
