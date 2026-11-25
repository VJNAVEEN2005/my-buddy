// Flashcards with spaced repetition (flashcards.mjs): boxes and due days, the review order, the Study page view and
// quiz mistakes turned into cards. Run: npm test
import assert from 'node:assert/strict';
import { cardsView, dueCards, GAPS, grade, isoDay, makeCard, quizMisses } from '../flashcards.mjs';

const DAY = 864e5, now = new Date(2026, 10, 25, 10).getTime();
const c = makeCard({ front: '  What is 7 × 8? ', back: '56', deck: 'Maths' }, now);
assert.equal(c.front, 'What is 7 × 8?');
assert.equal(c.box, 0); assert.equal(c.due, '2026-11-25');

// Got it moves it up a box and out by that box's gap; Again sends it back to box 0, due today.
grade(c, true, now);
assert.equal(c.box, 1); assert.equal(c.due, isoDay(now + GAPS[1] * DAY));
grade(c, true, now + DAY);
assert.equal(c.box, 2); assert.equal(c.due, '2026-11-29');
grade(c, false, now + 4 * DAY);
assert.equal(c.box, 0); assert.equal(c.due, '2026-11-29'); assert.equal(c.wrong, 1); assert.equal(c.right, 2);
// The top box stays the top box.
for (let i = 0; i < 9; i++) grade(c, true, now);
assert.equal(c.box, GAPS.length - 1); assert.equal(c.due, '2026-12-25');

// Due: the oldest due first, then the lowest box; tomorrow's cards wait.
const a = { ...makeCard({ front: 'a?', back: 'a' }, now), due: '2026-11-20', box: 2 };
const b = { ...makeCard({ front: 'b?', back: 'b' }, now), due: '2026-11-20', box: 0 };
const t = { ...makeCard({ front: 't?', back: 't' }, now), due: '2026-11-26' };
const today = makeCard({ front: 'c?', back: 'c', deck: 'Physics' }, now);
assert.deepEqual(dueCards([a, t, today, b], now).map((x) => x.front), ['b?', 'a?', 'c?']);

const v = cardsView([a, b, t, today, { ...makeCard({ front: 'd?', back: 'd' }, now), box: 4, due: '2027-01-01' }], now);
assert.equal(v.due, 3); assert.equal(v.total, 5); assert.equal(v.learnt, 1);
assert.deepEqual(v.decks, [{ name: 'General', total: 4, due: 2 }, { name: 'Physics', total: 1, due: 1 }]);
assert.equal(v.next.front, 'b?');
assert.deepEqual(cardsView([], now), { due: 0, total: 0, learnt: 0, decks: [], next: null });

// A quiz answered on screen: the wrong and skipped questions become cards, with the explanation on the back.
const quiz = { questions: [
  { text: 'What is 7 × 8?', options: ['54', '56'], right: 1, explain: '7 × 8 = 56' },
  { text: 'Capital of India?', options: ['New Delhi', 'Mumbai'], right: 0 },
  { text: 'H2O is?', options: ['Water', 'Salt'], right: 0 },
] };
assert.deepEqual(quizMisses(quiz, [0, 0, -1]), [{ front: 'What is 7 × 8?', back: '56: 7 × 8 = 56' }, { front: 'H2O is?', back: 'Water' }]);
assert.deepEqual(quizMisses(quiz, [1, 0, 0]), []);
assert.deepEqual(quizMisses(null, []), []);
console.log('flashcards ok');
