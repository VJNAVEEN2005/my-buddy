// The weekly report card (weekly.mjs): the numbers, what it draws (checked by the draw tool's own rules), when it shows
// on its own, and the exam countdown badge. Run: npm test
import assert from 'node:assert/strict';
import { checkDraw, DrawArgs } from '../draw.mjs';
import { examBadge, hm, weekReport, weeklyDue } from '../weekly.mjs';

const now = new Date(2026, 10, 29, 19).getTime(); // Sunday 29 Nov 2026, 7 PM
const log = { days: ['2026-11-23', '2026-11-24', '2026-11-26', '2026-11-27', '2026-11-29', '2026-11-01'], mins: { '2026-11-24': 50, '2026-11-26': 25, '2026-11-29': 75 } };
const exam = { name: 'GATE 2027', daysLeft: 70, done: 40, total: 120, mockLast: 61.5, today: [{ name: 'Fourier series' }, { name: 'Laplace' }], revise: [{ name: 'Matrices' }],
  mocks: [{ name: 'Mock 1', pct: 52 }, { name: 'Mock 2', pct: 58.4 }, { name: '', pct: 61.5 }] };
const r = weekReport({ log, streak: { current: 1, best: 3 }, exams: [exam], flash: { due: 4, total: 30, learnt: 12 }, deadlines: [{ title: 'Lab 4 report', due: '2026-12-02' }, { title: 'Old', due: '2026-11-20' }], now });
assert.equal(r.stats.studied, 5);
assert.equal(r.stats.minutes, 150);
assert.deepEqual(r.stats.week.map((d) => d.k), ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29']);
const kinds = r.beats[0].marks.map((m) => m.kind);
assert.deepEqual(kinds, ['card', 'bars', 'bars', 'list', 'medal']);
const card = r.beats[0].marks[0];
assert.match(card.text, /Studied 5 of 7 days, 2 h 30 min of focus\./);
assert.match(card.text, /Flashcards: 4 due, 12 of 30 learnt\./);
assert.match(card.text, /GATE 2027: 40\/120 topics, 70 days left, last mock 61.5%\./);
const list = r.beats[0].marks[3];
assert.equal(list.items[0], 'Lab 4 report: due 2 Dec');
assert.ok(list.items.includes('Revise Matrices'));
assert.ok(list.items.includes('Review 4 flashcards'));
// What it draws passes the draw tool's checks, like a drawing the model made.
assert.deepEqual(checkDraw({ beats: r.beats }), []);
DrawArgs.parse({ beats: r.beats });

// A quiet week: no bars, no medal, still a card that passes.
const q = weekReport({ now });
assert.deepEqual(q.beats[0].marks.map((m) => m.kind), ['card']);
assert.deepEqual(checkDraw({ beats: q.beats }), []);
assert.match(q.text, /No study days/);

// On its own: Sunday from 6 PM, not again within 3 days.
assert.equal(weeklyDue(now, 0), true);
assert.equal(weeklyDue(now, now - 3600e3), false);
assert.equal(weeklyDue(new Date(2026, 10, 29, 17).getTime(), 0), false);
assert.equal(weeklyDue(new Date(2026, 10, 28, 20).getTime(), 0), false);

// The badge: the nearest exam still to come.
assert.deepEqual(examBadge([exam, { name: 'CAT', daysLeft: 3, done: 0, total: 0, today: [] }, { name: 'Past', daysLeft: -2 }]), { text: 'CAT in 3 days', sub: '' });
assert.deepEqual(examBadge([exam]), { text: 'GATE 2027 in 70 days', sub: '2 topics today' });
assert.deepEqual(examBadge([{ name: 'NEET', daysLeft: 1, done: 5, total: 9, today: [] }]), { text: 'NEET tomorrow', sub: '5/9 topics done' });
assert.equal(examBadge([]), null);
assert.equal(hm(45), '45 min'); assert.equal(hm(120), '2 h'); assert.equal(hm(135), '2 h 15 min');
console.log('weekly ok');
