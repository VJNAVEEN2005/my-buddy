// The study streak (studylog.mjs): days in a row, the best run, and this week. Run: npm test
import assert from 'node:assert/strict';
import { isoDay, streakFrom } from '../studylog.mjs';

const at = (s) => new Date(`${s}T10:00`).getTime();
// Three days up to today: 3 in a row, done today.
let k = streakFrom(['2026-11-23', '2026-11-24', '2026-11-25'], at('2026-11-25'));
assert.equal(k.current, 3); assert.equal(k.today, true); assert.equal(k.best, 3);
// Today not done yet: the run up to yesterday still counts, so it doesn't drop at midnight.
k = streakFrom(['2026-11-23', '2026-11-24'], at('2026-11-25'));
assert.equal(k.current, 2); assert.equal(k.today, false);
// A day missed breaks it; the best run is kept.
k = streakFrom(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-20', '2026-11-25'], at('2026-11-25'));
assert.equal(k.current, 1); assert.equal(k.best, 4);
// Nothing yet.
k = streakFrom([], at('2026-11-25'));
assert.equal(k.current, 0); assert.equal(k.best, 0);
// This week: seven days ending today, today last and marked.
k = streakFrom(['2026-11-25', '2026-11-21'], at('2026-11-25'));
assert.equal(k.week.length, 7); assert.equal(k.week[6].day, '2026-11-25'); assert.equal(k.week[6].today, true); assert.equal(k.week[6].on, true);
assert.equal(k.week[2].day, '2026-11-21'); assert.equal(k.week[2].on, true); assert.equal(k.week[3].on, false);
// Across a month end.
k = streakFrom(['2026-11-30', '2026-12-01'], at('2026-12-01'));
assert.equal(k.current, 2);
assert.equal(isoDay(at('2026-03-05')), '2026-03-05');
console.log('studylog tests: passed');
