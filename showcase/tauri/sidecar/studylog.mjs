// The study streak: which days some studying happened (a topic or deadline ticked off, a mock logged, a focus block
// finished, something added on the Study page). Kept in ~/Roamies/Data/studylog.json, this computer only.
// streakView() works out the current run of days, the best run, and this week's days for the Study page.
import path from 'node:path';
import { DIR, readJson, writeJson } from './store.mjs';

const FILE = path.join(DIR, 'studylog.json');
const DAY = 864e5, KEEP = 400;
export const isoDay = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const dayStart = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };

let data = null;
const load = () => {
  if (data) return data;
  const j = readJson(FILE, { backup: true });
  data = j?.version === 1 && Array.isArray(j.days) ? j : { version: 1, days: [], focusMin: 0 };
  return data;
};

/** Marks a day (today by default) as studied; minutes: focus time to add. Saves only when something changed. */
export async function markStudyDay(now = Date.now(), minutes = 0) {
  const d = load(), k = isoDay(now);
  const fresh = !d.days.includes(k);
  if (fresh) { d.days.push(k); d.days.sort(); d.days = d.days.slice(-KEEP); }
  if (minutes > 0) {
    d.focusMin = (d.focusMin ?? 0) + Math.round(minutes);
    // Minutes by day, for the weekly report: the last 60 days.
    d.mins = { ...(d.mins ?? {}), [k]: (d.mins?.[k] ?? 0) + Math.round(minutes) };
    const keys = Object.keys(d.mins).sort();
    for (const old of keys.slice(0, Math.max(0, keys.length - 60))) delete d.mins[old];
  }
  if (fresh || minutes > 0) await writeJson(FILE, d, { backup: true });
  return fresh;
}

/**
 * days: the studied days as "YYYY-MM-DD". → { current, best, today, week: [{ day, label, on, today }] }.
 * The current run still counts when today isn't done yet (it runs to yesterday), so the streak doesn't drop at midnight.
 */
export function streakFrom(days, now = Date.now(), focusMin = 0) {
  const set = new Set(days), today = dayStart(now);
  const has = (ms) => set.has(isoDay(ms));
  const back = (ms) => dayStart(ms - DAY / 2); // a day before, safe across clock changes
  let current = 0;
  for (let t = has(today) ? today : back(today); has(t); t = back(t)) current++;
  let best = 0, run = 0, prev = null;
  for (const k of [...set].sort()) {
    const [y, m, d] = k.split('-').map(Number), t = new Date(y, m - 1, d).getTime();
    run = prev != null && Math.round((t - prev) / DAY) === 1 ? run + 1 : 1;
    best = Math.max(best, run); prev = t;
  }
  const week = [];
  for (let i = 6, t = today; i >= 0; i--) {
    const at = dayStart(today - i * DAY + DAY / 4);
    week.push({ day: isoDay(at), label: new Date(at).toLocaleDateString(undefined, { weekday: 'narrow' }), on: has(at), today: at === t });
  }
  return { current, best: Math.max(best, current), today: has(today), week, focusMin };
}
export const streakView = (now = Date.now()) => { const d = load(); return streakFrom(d.days, now, d.focusMin ?? 0); };
/** The studied days and focus minutes by day, for the weekly report. */
export const studyLog = () => { const d = load(); return { days: [...d.days], mins: { ...(d.mins ?? {}) } }; };
