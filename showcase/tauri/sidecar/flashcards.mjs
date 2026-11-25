// Flashcards with spaced repetition (a Leitner box system): each card has a front (the question) and a back (the
// answer), sits in a box 0–5, and comes back after 0, 1, 3, 7, 14 or 30 days. "Got it" moves it up a box, "Again"
// sends it back to box 0 (due today). Quiz questions answered wrong on screen become cards too, so mistakes return.
// Kept in ~/Roamies/Data/flashcards.json, this computer only. Pure apart from load/save.
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { z } from 'zod';
import { DIR, readJson, writeJson } from './store.mjs';

const FILE = path.join(DIR, 'flashcards.json');
const DAY = 864e5;
export const GAPS = [0, 1, 3, 7, 14, 30];
export const MAX_CARDS = 2000;
const uid = () => `f${randomBytes(4).toString('hex')}`;
const clean = (s, n = 300) => String(s ?? '').replace(/[ \t]+/g, ' ').trim().slice(0, n);
export const isoDay = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const addDays = (ms, n) => { const d = new Date(ms); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return isoDay(d.getTime()); };

/** A new card due today. */
export function makeCard({ front, back, deck = 'General' }, now = Date.now()) {
  return { id: uid(), front: clean(front), back: clean(back, 600), deck: clean(deck, 40) || 'General', box: 0, due: isoDay(now), added: now, right: 0, wrong: 0 };
}

/** good: true for "Got it", false for "Again". Returns the card, moved. */
export function grade(card, good, now = Date.now()) {
  if (good) { card.box = Math.min(GAPS.length - 1, card.box + 1); card.right++; } else { card.box = 0; card.wrong++; }
  card.due = addDays(now, good ? GAPS[card.box] : 0);
  card.seen = now;
  return card;
}

/** Cards due today or before, the oldest due first and, among those, the lowest box (hardest) first. */
export function dueCards(cards, now = Date.now()) {
  const today = isoDay(now);
  return cards.filter((c) => c.due <= today).sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : a.box - b.box || a.added - b.added));
}

/** For the Study page: { due, total, learnt (box ≥ 3), decks: [{ name, total, due }], next: the first due card }. */
export function cardsView(cards, now = Date.now()) {
  const due = dueCards(cards, now), decks = new Map();
  for (const c of cards) { const d = decks.get(c.deck) ?? { name: c.deck, total: 0, due: 0 }; d.total++; decks.set(c.deck, d); }
  for (const c of due) decks.get(c.deck).due++;
  return { due: due.length, total: cards.length, learnt: cards.filter((c) => c.box >= 3).length, decks: [...decks.values()].sort((a, b) => b.due - a.due || a.name.localeCompare(b.name)), next: due[0] ?? null };
}

/** The questions of a drawn quiz answered wrong (or skipped) as cards: { front, back }. */
export function quizMisses(m, picks) {
  const qs = m?.questions ?? [];
  return qs.flatMap((q, i) => {
    const p = Number.isInteger(picks?.[i]) ? picks[i] : -1;
    if (p === q.right || q.right == null || q.right < 0) return [];
    return [{ front: q.text, back: `${q.options[q.right]}${q.explain ? `: ${q.explain}` : ''}` }];
  });
}

// ---------------------------------------------------------------- the store
let data = null;
const load = () => {
  if (data) return data;
  const j = readJson(FILE, { backup: true });
  data = j?.version === 1 && Array.isArray(j.cards) ? j : { version: 1, cards: [] };
  return data;
};
const save = () => writeJson(FILE, load(), { backup: true });
export const allCards = () => load().cards;
export const flashView = (now = Date.now()) => cardsView(load().cards, now);

/** Adds cards, skipping ones whose front is already in that deck. Returns how many were added. */
export async function addCards(list, deck = 'General', now = Date.now()) {
  const d = load(), have = new Set(d.cards.map((c) => `${c.deck.toLowerCase()}|${c.front.toLowerCase()}`));
  let n = 0;
  for (const x of list ?? []) {
    const c = makeCard({ ...x, deck: x.deck ?? deck }, now);
    const key = `${c.deck.toLowerCase()}|${c.front.toLowerCase()}`;
    if (c.front.length < 2 || !c.back || have.has(key)) continue;
    have.add(key); d.cards.push(c); n++;
  }
  if (d.cards.length > MAX_CARDS) d.cards = d.cards.slice(-MAX_CARDS);
  if (n) await save();
  return n;
}
export async function reviewCard(id, good, now = Date.now()) {
  const c = load().cards.find((x) => x.id === id);
  if (!c) return null;
  grade(c, good, now);
  await save();
  return c;
}
export async function editCard(id, { front, back, deck }) {
  const c = load().cards.find((x) => x.id === id);
  if (!c) return null;
  if (front) c.front = clean(front);
  if (back) c.back = clean(back, 600);
  if (deck) c.deck = clean(deck, 40);
  await save();
  return c;
}
export async function deleteCard(id) {
  const d = load(), n = d.cards.length;
  d.cards = d.cards.filter((c) => c.id !== id);
  if (d.cards.length !== n) await save();
  return d.cards.length !== n;
}

/** The assistant's tool: make cards from what was taught or from notes. */
export function createFlashcardTools({ changed = () => {} } = {}) {
  return [{
    name: 'add_flashcards',
    description: 'Save flashcards for the user to revise with spaced repetition (they review them on the Study page\'s Cards tab and old ones come back on the right day). Use when they ask for flashcards, or after teaching something worth remembering (offer first). Each card: front (a short question) and back (the answer, short). deck: the subject or chapter.',
    parameters: z.object({ deck: z.string().max(40).optional(), cards: z.array(z.object({ front: z.string().min(2).max(300), back: z.string().min(1).max(600) })).min(1).max(60) }),
    execute: async ({ deck = 'General', cards }) => {
      const n = await addCards(cards, deck);
      changed();
      const v = flashView();
      return `Saved ${n} card${n === 1 ? '' : 's'} to ${deck}${n < cards.length ? ` (${cards.length - n} were already there)` : ''}. ${v.due} due today, ${v.total} in all. They review them on the Study page, Cards tab.`;
    },
  }];
}
