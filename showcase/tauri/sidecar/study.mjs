// The Study page's data: what the panel shows from the Academic Hub (academic.json), worked out here so the panel
// only draws it. Today (overdue and due today), the next two weeks, each course, a 30-day calendar and the GPA.
// Pure: it takes the hub's data and the time, and changes nothing.

const DAY = 864e5;
/** A due date as written in the hub ("2026-11-30" or "2026-11-30T23:59") → local ms at that day's start, or null. */
export function dueDay(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s ?? ''));
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}
const startOfDay = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
const isoDay = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const dayLabel = (ms, today) => {
  const diff = Math.round((ms - today) / DAY);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return new Date(ms).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
};

/**
 * data: { courses, assignments } from getAcademicData(); gpa: projectGpa()'s result (or null).
 * → { empty, today, upcoming, courses, calendar, gpa }
 */
export function studyState(data, gpa = null, now = Date.now()) {
  const courses = Array.isArray(data?.courses) ? data.courses : [];
  const all = Array.isArray(data?.assignments) ? data.assignments : [];
  const today = startOfDay(now);
  const byId = new Map(courses.map((c) => [c.id, c]));
  const row = (a) => {
    const day = dueDay(a.due_date), c = byId.get(a.course_id);
    return {
      id: a.id, title: a.title, course: c?.code || c?.name || '', category: a.category || '',
      day, when: day == null ? 'No due date' : dayLabel(day, today),
      overdue: day != null && day < today && a.status !== 'completed', done: a.status === 'completed',
    };
  };
  const open = all.filter((a) => a.status !== 'completed').map(row);
  const soon = (r) => r.day ?? Infinity;
  const todayList = open.filter((r) => r.day != null && r.day <= today).sort((a, b) => soon(a) - soon(b));
  const upcoming = open.filter((r) => r.day != null && r.day > today && r.day <= today + 14 * DAY).sort((a, b) => soon(a) - soon(b));
  const grades = new Map((gpa?.courses ?? []).map((g) => [g.courseId, g]));
  const courseRows = courses.map((c) => {
    const mine = all.filter((a) => a.course_id === c.id), g = grades.get(c.id);
    const next = mine.filter((a) => a.status !== 'completed').map(row).filter((r) => r.day != null && r.day >= today).sort((a, b) => a.day - b.day)[0];
    return {
      id: c.id, code: c.code || '', name: c.name || '', credits: c.credit_hours ?? null, term: c.term || '',
      instructor: c.instructor?.name || '', email: c.instructor?.email || '', office: c.instructor?.office_hours || '',
      open: mine.filter((a) => a.status !== 'completed').length, done: mine.filter((a) => a.status === 'completed').length,
      grade: g && g.currentGrade !== 'N/A' ? `${g.currentGrade}${g.currentPct != null ? ` (${g.currentPct}%)` : ''}` : '',
      next: next ? `${next.title} · ${next.when}` : '',
      weights: (c.grade_weights ?? []).map((w) => `${w.category} ${w.weight_pct}%`).join(', '),
    };
  });
  const days = new Map();
  for (const r of open) {
    if (r.day == null || r.day < today || r.day > today + 30 * DAY) continue;
    const k = isoDay(r.day);
    if (!days.has(k)) days.set(k, { day: k, label: dayLabel(r.day, today), items: [] });
    days.get(k).items.push(r);
  }
  const calendar = [...days.values()].sort((a, b) => (a.day < b.day ? -1 : 1));
  return {
    empty: !courses.length && !all.length,
    today: todayList, upcoming, courses: courseRows, calendar,
    // The map: each course and its open deliverables (soonest first, at most 12 a course), for the draggable graph.
    map: {
      courses: courses.map((c) => ({ id: c.id, label: c.code || c.name || 'Course', name: c.name || '' })),
      tasks: open.filter((r) => byId.has(all.find((a) => a.id === r.id)?.course_id))
        .sort((a, b) => soon(a) - soon(b))
        .reduce((acc, r) => { const cid = all.find((a) => a.id === r.id).course_id; if (acc.filter((t) => t.course === cid).length < 12) acc.push({ id: r.id, label: r.title, course: cid, when: r.when, overdue: r.overdue }); return acc; }, []),
    },
    gpa: gpa ? {
      now: gpa.gpa, projected: gpa.projectedGpa, credits: gpa.totalCredits ?? 0,
      courses: (gpa.courses ?? []).map((g) => ({ code: g.code || g.name, name: g.name, credits: g.credit_hours, now: g.currentGrade, nowPct: g.currentPct, projected: g.projectedGrade, projectedPct: g.projectedPct, graded: g.gradedCount, total: g.totalCount })),
    } : null,
  };
}
