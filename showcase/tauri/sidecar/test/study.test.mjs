// The Study page's data (study.mjs). Run: npm test
import assert from 'node:assert/strict';
import { dueDay, studyState } from '../study.mjs';

const now = new Date(2026, 10, 25, 10, 0).getTime(); // 25 Nov 2026, 10 am local
const data = {
  courses: [{ id: 'c1', code: 'CS 101', name: 'Intro to CS', credit_hours: 4, instructor: { name: 'Prof. Rao' }, grade_weights: [{ category: 'Labs', weight_pct: 40 }] }],
  assignments: [
    { id: 'a1', course_id: 'c1', title: 'Lab 3', due_date: '2026-11-24', status: 'pending' },
    { id: 'a2', course_id: 'c1', title: 'Quiz 2', due_date: '2026-11-25', status: 'pending' },
    { id: 'a3', course_id: 'c1', title: 'Project', due_date: '2026-12-01', status: 'pending' },
    { id: 'a4', course_id: 'c1', title: 'Lab 1', due_date: '2026-11-01', status: 'completed' },
    { id: 'a5', course_id: 'c1', title: 'Final', due_date: '2027-01-30', status: 'pending' },
    { id: 'a6', course_id: null, title: 'Reading', due_date: null, status: 'pending' },
  ],
};
const gpa = { gpa: 3.7, projectedGpa: 3.5, totalCredits: 4, courses: [{ courseId: 'c1', code: 'CS 101', name: 'Intro to CS', credit_hours: 4, currentGrade: 'A-', currentPct: 91.2, projectedGrade: 'B+', projectedPct: 88, gradedCount: 1, totalCount: 6 }] };

assert.equal(dueDay('nope'), null);
assert.equal(dueDay('2026-11-25T23:59'), new Date(2026, 10, 25).getTime());

const s = studyState(data, gpa, now);
assert.equal(s.empty, false);
// Today: the overdue lab first, then today's quiz; nothing done, nothing undated.
assert.deepEqual(s.today.map((r) => r.id), ['a1', 'a2']);
assert.equal(s.today[0].overdue, true);
assert.equal(s.today[1].when, 'Today');
// The next two weeks only.
assert.deepEqual(s.upcoming.map((r) => r.id), ['a3']);
// The course row: counts, grade and what's next.
assert.equal(s.courses[0].open, 4);
assert.equal(s.courses[0].done, 1);
assert.equal(s.courses[0].grade, 'A- (91.2%)');
assert.ok(s.courses[0].next.startsWith('Quiz 2'));
assert.equal(s.courses[0].weights, 'Labs 40%');
// Calendar: today and 1 Dec, not the overdue one or January.
assert.deepEqual(s.calendar.map((d) => d.day), ['2026-11-25', '2026-12-01']);
assert.equal(s.gpa.now, 3.7);
// The map: the course, and its open deliverables soonest first (not the done one, not the one with no course).
assert.deepEqual(s.map.courses.map((c) => c.label), ['CS 101']);
assert.deepEqual(s.map.tasks.map((t) => t.id), ['a1', 'a2', 'a3', 'a5']);
assert.equal(s.map.tasks[0].overdue, true);
assert.equal(s.gpa.courses[0].projected, 'B+');
// No data at all.
const e = studyState({ courses: [], assignments: [] }, null, now);
assert.equal(e.empty, true);
assert.equal(e.gpa, null);
console.log('study ok');
