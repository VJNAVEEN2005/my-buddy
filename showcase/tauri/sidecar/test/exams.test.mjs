// Competitive exam preparation (exams.mjs): reading a syllabus, the pace and today's plan, revision, mocks. Run: npm test
import assert from 'node:assert/strict';
import { examView, parseSyllabus, planText } from '../exams.mjs';

// "Subject: a, b" lines, headings with bullets, and duplicates dropped.
const t = parseSyllabus(`Quantitative Aptitude: Percentages, Ratio and Proportion; Time and Work
Reasoning
- Syllogism
- Blood Relations
1. Seating Arrangement
English: Reading Comprehension, Cloze Test, Percentages`);
assert.deepEqual(t.map((x) => `${x.subject}/${x.name}`), [
  'Quantitative Aptitude/Percentages', 'Quantitative Aptitude/Ratio and Proportion', 'Quantitative Aptitude/Time and Work',
  'Reasoning/Syllogism', 'Reasoning/Blood Relations', 'Reasoning/Seating Arrangement',
  'English/Reading Comprehension', 'English/Cloze Test', 'English/Percentages',
]);
assert.deepEqual(parseSyllabus(''), []);

const DAY = 864e5, now = new Date(2026, 10, 25, 9).getTime();
const topics = Array.from({ length: 30 }, (_, i) => ({ id: `t${i}`, subject: ['Quant', 'Reasoning', 'English'][i % 3], name: `Topic ${i}`, status: 'todo' }));
topics[0].status = 'done'; topics[0].doneAt = now - 10 * DAY; // due for revision
topics[1].status = 'done'; topics[1].doneAt = now - 2 * DAY; // not yet
topics[2].status = 'learning';
const exam = { id: 'x1', name: 'SSC CGL', date: '2026-12-25', topics, mocks: [{ id: 'm1', score: 120, total: 200, at: now - 5 * DAY }, { id: 'm2', score: 138, total: 200, at: now - DAY }] };
const v = examView(exam, now);
assert.equal(v.daysLeft, 30);
assert.equal(v.done, 2); assert.equal(v.total, 30);
// 28 left over 30 days less a 4-day revision stretch (15%): 2 a day.
assert.equal(v.perDay, 2);
// The topic being learnt comes first, then the next one from another subject.
assert.equal(v.today[0].id, 't2');
assert.equal(v.today.length, 2);
assert.notEqual(v.today[1].subject, v.today[0].subject);
assert.deepEqual(v.revise.map((x) => x.id), ['t0']);
assert.deepEqual(v.subjects.map((s) => `${s.name} ${s.done}/${s.total}`), ['Quant 1/10', 'Reasoning 1/10', 'English 0/10']);
assert.equal(v.mockLast, 69); assert.equal(v.mockChange, 9); assert.equal(v.mockAvg, 64.5);
const text = planText(v);
assert.ok(text.startsWith('SSC CGL: 30 days left. 2/30 topics done. Pace: 2 new topics a day.'));
assert.ok(text.includes('Revise: Topic 0 (Quant)'));
assert.ok(text.includes('Furthest behind: English (0/10)'));
// No date: a steady 3 a day; past the date: said so.
assert.equal(examView({ ...exam, date: null }, now).perDay, 3);
assert.ok(planText(examView({ ...exam, date: '2026-11-01' }, now)).includes('has passed'));
console.log('exams ok');
