// Cut-out characters: each pose is a picture cut from the character's own art sheet (roamies/looks/<id>/<pose>.webp),
// and the motion comes from here: a float or a breath, squash and stretch, hops, a shake, a lean, a soft blend from
// one pose to the next, listening rings and a glow underfoot. 10-dither.js draws a look like this on the canvas
// (it's marked vector), with the same state the other looks get: mode (listen, think, talk), the act (wave, hype,
// remind, upset, motivate), the moods (happy, wide, dizzy, sleepy), the blink, the voice, how fast it moves and the size.
//
// R.spriteLook(id, def) registers window.Roamie[id]. def:
//   poses: { name: [w, h] }  the pictures and their sizes (all cut from one sheet, so they share a scale)
//   pick(s): the pose for a state s (see read() below), from the poses it has
//   height: how tall the idle pose stands, in body radii; ground: true for a walker (no float, a shadow, it turns)
//   glow: the colour of the light under it
(() => {
  const R = window.Roamie;
  if (!R) return;
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
  const here = (typeof document !== 'undefined' && document.currentScript?.src) || '';
  const BASE = here.replace(/[^/]*$/, '') + 'looks/';

  // What it's doing, in plain words, for the look's pick().
  function read(st) {
    const A = st.act, mode = st.mode, feel = st.feel, brow = st.brow;
    return {
      act: A ?? null, a: st.actA ?? 0, dur: st.actDur ?? 3, mode, feel: feel ?? null,
      sleepy: st.sleepy > 0.5, dizzy: st.dizzy > 0.5, blink: (st.open ?? 1) < 0.3,
      sad: brow === 'sad' || feel === 'sad' || feel === 'cry' || feel === 'tired',
      angry: brow === 'angry' || feel === 'angry' || feel === 'shout',
      surprised: st.wide > 0.5 || feel === 'surprised' || feel === 'scared',
      curious: feel === 'curious',
      happy: st.happy > 0.5 || feel === 'joy' || feel === 'laugh',
      pointing: (st.arms ?? 0) > 0.3 && !!st.hands?.[1] && Math.hypot(st.hands[1][0], st.hands[1][1]) > 1.1,
      moving: Math.abs(st.vx ?? 0) > 60, dir: (st.vx ?? 0) < 0 ? -1 : 1,
    };
  }

  R.spriteLook = (id, def) => {
    const imgs = {};
    const img = (name) => {
      if (!imgs[name]) { const i = new Image(); i.decoding = 'async'; i.src = `${BASE}${id}/${name}.webp`; imgs[name] = i; }
      return imgs[name];
    };
    // Preload every pose so a change never shows a gap.
    if (typeof Image !== 'undefined') { for (const n in def.poses) img(n); for (const n in def.cursors || {}) img(n); if (def.toCursor) img('tx-cursor'); if (def.entry) img('tx-entry'); }
    const ready = (n) => { const i = imgs[n]; return i && i.complete && i.naturalWidth > 0; };
    // Per-character memory (the pose it's in, the one it's leaving, which way it faces), kept on its state object.
    const mem = new WeakMap();
    const memo = (st) => { let m = mem.get(st); if (!m) { m = { pose: null, prev: null, fade: 1, face: 1, t: st.t }; mem.set(st, m); } return m; };
    const refH = def.poses.idle[1];

    // One pose picture, bottom-centre at (x, y), h tall, with a flip, squash and alpha.
    const put = (c, name, x, y, h, flip, sx, sy, alpha) => {
      if (!ready(name) || alpha <= 0.01) return;
      const [w0, h0] = def.poses[name], k = h / refH, w = w0 * k, hh = h0 * k;
      c.save();
      c.globalAlpha *= alpha;
      c.translate(x, y); c.scale(flip * sx, sy);
      c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
      c.drawImage(imgs[name], -w / 2, -hh, w, hh);
      c.restore();
    };

    // One frame of the character-to-cursor clip, with the clip point (px, py) placed at (x, y), scaled by k.
    const clip = (c, i, x, y, px, py, k, alpha = 1) => {
      const T = def.toCursor, im = imgs['tx-cursor'];
      if (!T || !im || !im.complete || !im.naturalWidth) return false;
      i = Math.max(0, Math.min(T.n - 1, i));
      c.save(); c.globalAlpha *= alpha; c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
      c.drawImage(im, (i % T.cols) * T.w, Math.floor(i / T.cols) * T.h, T.w, T.h, x - px * k, y - py * k, T.w * k, T.h * k);
      c.restore(); return true;
    };
    // Is the clip playing? Starts when the form changes to or from the cursor.
    const txAt = (st) => {
      const m = memo(st), f = st.form === 'cursor' ? 'cursor' : 'body';
      if (m.form && m.form !== f && def.toCursor) m.tx = { t0: st.t, dir: f === 'cursor' ? 1 : -1 };
      m.form = f;
      if (!m.tx) return null;
      // skip: the clip's opening frames (Flow's redraw of the character) are left out; it starts at the sparkle swirl.
      const T = def.toCursor, k0 = T.skip || 0, i = Math.floor((st.t - m.tx.t0) * T.fps);
      if (i >= T.n - k0 || i < 0) { m.tx = null; return null; }
      return m.tx.dir > 0 ? k0 + i : T.n - 1 - i;
    };
    // The drawn cursor art for this state, its tip on (hx, hy). False when there's none (or it hasn't loaded).
    const curArt = (c, st, hx, hy, alpha) => {
      if (!def.cursors) return false;
      const s = read(st), t = st.t;
      const name = s.mode === 'think' ? 'cur-busy' : s.act === 'hype' || s.act === 'wave' || s.act === 'motivate' || s.happy ? 'cur-click'
        : s.mode === 'listen' || s.mode === 'talk' || s.surprised || s.curious ? 'cur-look' : 'cur-normal';
      const cur = def.cursors[name] ? name : 'cur-normal', im = img(cur);
      if (!im.complete || !im.naturalWidth) return false;
      if (alpha <= 0.01) return true;
      const [w, h, tx, ty] = def.cursors[cur], H = 34, k = H / h;
      const bob = s.mode === 'think' ? 0 : Math.sin(t * 3) * 0.6, sq = cur === 'cur-click' ? 1 - 0.06 * Math.abs(Math.sin(t * 9)) : 1;
      c.save(); c.globalAlpha *= alpha; c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
      c.translate(hx, hy); c.scale(sq, sq); c.drawImage(im, -tx * k, -ty * k + bob, w * k, H); c.restore();
      return true;
    };
    // Draw clip frame fi, easing size and place from the body (frame 0) to the cursor (last frame).
    const txDraw = (c, fi, st) => {
      const T = def.toCursor, m = memo(st), b = m.body || m.cur, h = m.cur || m.body;
      if (!b) return false;
      const k0 = T.skip || 0, r = fi - k0, p = r / (T.n - 1 - k0), e = p * p * (3 - 2 * p), L = (u, v) => u + (v - u) * e;
      // The video's first frames don't match the pose exactly, so the pose melts into the clip inside a soft flash.
      const q = smooth(r / (T.blend ?? 8)), x = L(b.x, h.x), y = L(b.y, h.y), kk = L(b.k, h.k);
      if (q < 1) {
        const H = T.bodyH * kk, pose = m.pose && def.poses[m.pose] ? m.pose : 'idle';
        c.save(); c.translate(x, y); put(c, pose, 0, 0, H * (def.poses.idle[1] / refH), 1, 1, 1, 1 - q); c.restore();
        const fl = Math.sin(q * Math.PI), cy = y - H * 0.5, r = H * (0.55 + 0.25 * q);
        if (fl > 0.02) {
          c.save(); const g = c.createRadialGradient(x, cy, 0, x, cy, r);
          g.addColorStop(0, `rgba(230,250,255,${0.55 * fl})`); g.addColorStop(0.45, `rgba(127,233,255,${0.3 * fl})`); g.addColorStop(1, 'rgba(127,233,255,0)');
          c.fillStyle = g; c.beginPath(); c.arc(x, cy, r, 0, TAU); c.fill(); c.restore();
        }
      }
      // Same at the cursor end: the clip melts into the drawn cursor art.
      const q2 = smooth((T.n - 1 - fi) / (T.blend ?? 8));
      if (q2 < 1) curArt(c, st, h.x, h.y, 1 - q2);
      return clip(c, fi, x, y, L(T.body[0], T.tip[0]), L(T.body[1], T.tip[1]), kk, Math.min(q, q2));
    };

    const look = {
      vector: true,
      name: def.name,
      toCursor: def.toCursor || null,
      entry: def.entry || null,
      extent: { l: 2.2, r: 2.2, t: 2.6, b: 2.2 },
      poseFor: (st) => def.pick(read(st), def.poses),

      draw(c, x, y, rad, st) {
        if (st.form === 'cursor') return look.cursor(c, x, y, st);
        // Entrance clip (st.entryU 0..1 while appearing): the character forms out of sparkles; the clip's last
        // frame is the idle pose itself, so the last few frames just fade into the live pose.
        const E = def.entry, eu = st.entryU;
        if (E && eu != null && eu < 1) {
          const im = img('tx-entry');
          if (im.complete && im.naturalWidth) {
            const fi = Math.min(E.n - 1, Math.floor(eu * E.n)), q = smooth((fi - (E.n - 1 - (E.blend ?? 5))) / (E.blend ?? 5));
            const k = (rad * def.height) / E.bodyH, ax = x, ay = y + rad * def.foot;
            if (q < 1) { c.save(); c.globalAlpha *= 1 - q; c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; c.drawImage(im, (fi % E.cols) * E.w, Math.floor(fi / E.cols) * E.h, E.w, E.h, ax - E.body[0] * k, ay - E.body[1] * k, E.w * k, E.h * k); c.restore(); }
            if (q <= 0) return;
            st.entryU = null; c.save(); c.globalAlpha *= q; look.draw(c, x, y, rad, st); c.restore(); st.entryU = eu; return;
          }
        }
        const fi = txAt(st);
        if (def.toCursor) memo(st).body = { x, y: y + rad * def.foot, k: (rad * def.height) / def.toCursor.bodyH };
        if (fi != null && txDraw(c, fi, st)) return;
        const s = read(st), m = memo(st), t = st.t;
        const dt = clamp(t - m.t, 0, 0.1); m.t = t;
        let pose = def.pick(s, def.poses);
        if (!def.poses[pose]) pose = 'idle';
        if (pose !== m.pose) { m.prev = m.pose; m.pose = pose; m.fade = m.prev ? 0 : 1; }
        m.fade = Math.min(1, m.fade + dt / 0.16);
        if (s.moving) m.face = s.dir;
        const flip = def.ground ? m.face : 1;

        // The voice: a little pulse while it talks or hears you.
        const v = st.mode === 'talk' ? (st.voice != null ? clamp(st.voice, 0, 1) : 0.4 + 0.3 * Math.abs(Math.sin(t * 11))) : st.mode === 'listen' ? clamp(st.heard ?? 0.3, 0, 1) : 0;
        const H = rad * def.height;
        // Motion.
        const hop = s.act === 'hype' ? Math.abs(Math.sin(s.a * 6.5)) * rad * 0.55 : s.act === 'motivate' ? Math.abs(Math.sin(s.a * 4)) * rad * 0.2 : 0;
        const float = def.ground || s.sleepy ? 0 : Math.sin(t * 2) * rad * 0.07;
        const breath = Math.sin(t * (s.sleepy ? 1.2 : 2.2)) * (s.sleepy ? 0.025 : 0.012);
        const step = def.ground && s.moving ? Math.abs(Math.sin(t * 9)) * rad * 0.06 : 0;
        const shake = s.act === 'upset' && s.a % 0.9 < 0.3 ? Math.sin(t * 50) * rad * 0.04 : s.angry ? Math.sin(t * 40) * rad * 0.015 : 0;
        const sq = clamp(st.sq ?? 0, -1, 1);
        const talk = st.mode === 'talk' ? v * 0.05 * Math.abs(Math.sin(t * 13)) : 0;
        const sy = 1 + breath - sq * 0.08 + talk, sx = 1 - breath * 0.6 + sq * 0.06 - talk * 0.5;
        const lean = clamp((st.vx ?? 0) * -0.0008, -0.12, 0.12) * (def.ground ? 0.3 : 1)
          + (s.mode === 'listen' ? 0.06 : 0) + (s.pointing && !def.poses.pointing ? 0.08 : 0) + (s.dizzy ? Math.sin(t * 6) * 0.1 : 0);
        const footY = y + rad * def.foot;

        // The light under it: a soft glow, smaller as it rises.
        const up = hop + Math.max(0, -float);
        const k = clamp(1 - up / (rad * 1.4), 0.35, 1);
        c.save();
        const gw = rad * 0.95 * k, gy = footY + rad * 0.06;
        const g = c.createRadialGradient(x, gy, 0, x, gy, gw);
        g.addColorStop(0, def.glow.replace('A', String(0.55 * k))); g.addColorStop(1, def.glow.replace('A', '0'));
        c.fillStyle = g; c.beginPath(); c.ellipse(x, gy, gw, gw * 0.22, 0, 0, TAU); c.fill();
        c.restore();

        // Listening: sound rings either side.
        if (st.mode === 'listen') {
          c.save(); c.strokeStyle = def.ring ?? '#7fe9ff'; c.lineCap = 'round'; c.shadowColor = c.strokeStyle; c.shadowBlur = rad * 0.2;
          const cy = footY - H * 0.62;
          for (let i = 0; i < 3; i++) {
            const ph = (t * 1.6 + i / 3) % 1, rr = rad * (1.05 + ph * 0.6 * (0.5 + v));
            c.globalAlpha = (1 - ph) * 0.75; c.lineWidth = Math.max(1, rad * 0.045);
            for (const sd of [-1, 1]) { c.beginPath(); c.arc(x, cy, rr, sd > 0 ? -0.45 : Math.PI - 0.45, sd > 0 ? 0.45 : Math.PI + 0.45); c.stroke(); }
          }
          c.restore();
        }

        c.save();
        c.translate(x + shake, footY + float - hop - step);
        c.rotate(lean);
        const fIn = smooth(m.fade);
        if (m.prev && fIn < 1) put(c, m.prev, 0, 0, H, flip, sx, sy, 1 - fIn);
        put(c, m.pose, 0, 0, H, flip, sx, sy, m.prev ? fIn : 1);
        c.restore();

        // Thinking hard or hyped: a few sparkles round it.
        if (s.act === 'hype' || s.act === 'motivate' || s.act === 'wave') {
          c.save();
          for (let i = 0; i < 5; i++) {
            const a = i * 1.26 + t * 1.5, r = rad * (1.2 + 0.2 * Math.sin(t * 3 + i));
            const px = x + Math.cos(a) * r, py = footY - H * 0.55 + Math.sin(a) * r * 0.8 - hop, sz = rad * (0.05 + 0.04 * Math.sin(t * 5 + i));
            c.fillStyle = i % 2 ? '#ffffff' : (def.ring ?? '#7fe9ff'); c.shadowColor = c.fillStyle; c.shadowBlur = sz * 3; c.globalAlpha = 0.85;
            c.beginPath(); c.moveTo(px, py - sz * 2); c.lineTo(px + sz * 0.5, py - sz * 0.5); c.lineTo(px + sz * 2, py); c.lineTo(px + sz * 0.5, py + sz * 0.5);
            c.lineTo(px, py + sz * 2); c.lineTo(px - sz * 0.5, py + sz * 0.5); c.lineTo(px - sz * 2, py); c.lineTo(px - sz * 0.5, py - sz * 0.5); c.fill();
          }
          c.restore();
        }
      },

      // Cursor size: a small glowing arrow tip at the hotspot with the character, tiny, tucked below and to the right.
      cursor(c, x, y, st) {
        const t = st.t, hx = st.hot?.[0] ?? x - 8, hy = st.hot?.[1] ?? y - 12;
        const fi = txAt(st);
        if (def.toCursor) memo(st).cur = { x: hx, y: hy, k: 34 / def.toCursor.curH };
        if (fi != null && txDraw(c, fi, st)) return;
        // Drawn cursor art (the character hugging an arrow): its tip sits on the hotspot.
        if (curArt(c, st, hx, hy, 1)) return;
        c.save();
        c.fillStyle = '#ffffff'; c.shadowColor = def.ring ?? '#7fe9ff'; c.shadowBlur = 5;
        c.beginPath(); c.moveTo(hx, hy); c.lineTo(hx + 9, hy + 3.2); c.lineTo(hx + 3.2, hy + 9); c.closePath(); c.fill();
        c.shadowBlur = 0;
        const s = read(st);
        let pose = def.pick(s, def.poses); if (!def.poses[pose] || pose === 'walking' || pose === 'sleep' || pose === 'sleeping') pose = s.sleepy ? pose : 'idle';
        // At rest it points back up at the arrow tip (the pointing pose, mirrored), as if leading the mouse.
        let flip = 1;
        if ((pose === 'idle' || pose === 'sitting') && def.poses.pointing && !s.sleepy) { pose = 'pointing'; flip = -1; }
        put(c, def.poses[pose] ? pose : 'idle', hx + 15, hy + 30 + Math.sin(t * 3) * 0.8, 24, flip, 1, 1, 1);
        c.restore();
      },
    };
    R[id] = look;
    return look;
  };
})();
