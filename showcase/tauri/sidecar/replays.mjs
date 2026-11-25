// Kept walkthroughs: after Buddy walks the user through something step by step (a draw call whose beats wait for
// clicks), they can keep the steps. The same ask in the same app later replays them with no model call: the overlay
// finds each place again by its words on screen, so it still works when the window moved. Only walkthroughs whose
// every place is words on screen are kept (pixels and read_window ids go stale). ~/Roamies/Data/replays.json, this
// computer only.
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { DIR, readJson, writeJson } from './store.mjs';

const FILE = path.join(DIR, 'replays.json');
export const MAX_REPLAYS = 40;
// Marks that point at things on screen; a kept walkthrough has only these (and sounds or emotes).
const STEADY = new Set(['target', 'ring', 'point', 'frame', 'underline', 'num', 'label', 'check', 'highlight', 'spotlight', 'hover', 'scroll', 'sfx', 'emote']);
const PLACES = ['at', 'to', 'tie'];

/** The words of an ask, for matching: lower case, no punctuation or "hey buddy", single spaces. */
export function askKey(text) {
  return String(text ?? '').toLowerCase().normalize('NFKC')
    .replace(/^\s*(hey|hi|ok|okay)?\s*(my\s+)?buddy\b[\s,:!.-]*/, '')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
}
const appKey = (app) => String(app ?? '').trim().toLowerCase();

/** Whether a draw call's arguments are a walkthrough that can be kept and replayed. */
export function replayable(args) {
  const beats = Array.isArray(args?.beats) ? args.beats : [];
  if (!beats.length || !beats.some((b) => b?.wait === 'click') || args.edit?.length) return false;
  return beats.every((b) => Array.isArray(b?.marks) && b.marks.every((m) => {
    if (!STEADY.has(m?.kind) || m.points) return false;
    return PLACES.every((k) => m[k] == null || (typeof m[k] === 'object' && typeof m[k].text === 'string' && m[k].text.trim() && m[k].x == null && m[k].id == null));
  }));
}

let data = null;
const load = () => {
  if (data) return data;
  const j = readJson(FILE, { backup: true });
  data = j?.version === 1 && Array.isArray(j.replays) ? j : { version: 1, replays: [] };
  return data;
};
const save = () => writeJson(FILE, load(), { backup: true });

export const listReplays = () => load().replays.map((r) => ({ id: r.id, app: r.app, ask: r.ask, steps: r.args.beats.length, uses: r.uses ?? 0 }));
export const replayCount = () => load().replays.length;

/** The kept walkthrough for this ask in this app, or null. */
export function findReplay(app, text) {
  const a = appKey(app), k = askKey(text);
  if (!a || !k) return null;
  return load().replays.find((r) => r.app === a && r.ask === k) ?? null;
}

/** Keeps a walkthrough (replacing one for the same ask and app). → the kept entry, or null when it can't be kept. */
export async function keepReplay({ app, text, args }) {
  const a = appKey(app), k = askKey(text);
  if (!a || !k || !replayable(args)) return null;
  const d = load();
  d.replays = d.replays.filter((r) => !(r.app === a && r.ask === k));
  const r = { id: `w${randomBytes(3).toString('hex')}`, app: a, ask: k, args: { target: args.target, beats: args.beats }, at: Date.now(), uses: 0 };
  d.replays.unshift(r);
  d.replays = d.replays.slice(0, MAX_REPLAYS);
  await save();
  return r;
}

export async function usedReplay(id) {
  const r = load().replays.find((x) => x.id === id);
  if (r) { r.uses = (r.uses ?? 0) + 1; r.lastUsed = Date.now(); await save(); }
}

export async function dropReplay(id) {
  const d = load(), n = d.replays.length;
  d.replays = d.replays.filter((r) => r.id !== id);
  if (d.replays.length !== n) await save();
  return d.replays.length !== n;
}
