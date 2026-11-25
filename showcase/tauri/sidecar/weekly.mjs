// The weekly report card: the last 7 days of study (days studied, focus minutes by day, the streak), mock scores,
// flashcards and what to work on next, drawn as cards on the screen with no model call. Shown from the Study page
// ("Show my week") and on its own once a week, Sunday evening. Pure: the caller gathers the numbers.
const DAY = 864e5;
const isoDay = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const dayStart = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
export const hm = (min) => (min >= 60 ? `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ''}` : `${min} min`);
const short = (ms) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const cut = (s, n) => (String(s).length > n ? `${String(s).slice(0, n - 1)}…` : String(s));

/**
 * log: { days: ["YYYY-MM-DD"], mins: { day: minutes } }, streak: { current, best }, exams: examView()s,
 * flash: cardsView(), deadlines: [{ title, due: "YYYY-MM-DD" }]. → { text, beats, stats }.
 */
export function weekReport({ log = { days: [], mins: {} }, streak = { current: 0, best: 0 }, exams = [], flash = null, deadlines = [], now = Date.now() } = {}) {
  const today = dayStart(now), week = [];
  for (let i = 6; i >= 0; i--) { const at = dayStart(today - i * DAY + DAY / 4); const k = isoDay(at); week.push({ k, label: new Date(at).toLocaleDateString('en-GB', { weekday: 'short' }), on: log.days.includes(k), min: log.mins?.[k] ?? 0 }); }
  const studied = week.filter((d) => d.on).length, minutes = week.reduce((s, d) => s + d.min, 0);
  const exam = exams.filter((e) => e.daysLeft != null && e.daysLeft >= 0).sort((a, b) => a.daysLeft - b.daysLeft)[0] ?? exams[0] ?? null;
  const soon = deadlines.filter((d) => d.due && d.due >= isoDay(today) && d.due <= isoDay(today + 7 * DAY)).sort((a, b) => (a.due < b.due ? -1 : 1));
  const lines = [
    `Studied ${studied} of 7 days${minutes ? `, ${hm(minutes)} of focus` : ''}.`,
    `Streak: ${streak.current} day${streak.current === 1 ? '' : 's'} (best ${streak.best}).`,
  ];
  if (flash?.total) lines.push(`Flashcards: ${flash.due} due, ${flash.learnt} of ${flash.total} learnt.`);
  if (exam) lines.push(`${exam.name}: ${exam.done}/${exam.total} topics${exam.daysLeft != null ? `, ${exam.daysLeft} days left` : ''}${exam.mockLast != null ? `, last mock ${exam.mockLast}%` : ''}.`);
  const marks = [{ kind: 'card', heading: `Your week, ${short(today - 6 * DAY)} to ${short(today)}`, text: lines.join('\n'), card_size: 'large' }];
  if (minutes > 0) marks.push({ kind: 'bars', title: 'Focus minutes', unit: 'min', bars: week.map((d) => ({ label: d.label, value: d.min, tone: d.on ? 'teal' : 'white' })) });
  const mocks = (exam?.mocks ?? []).slice(-6);
  if (mocks.length >= 2) marks.push({ kind: 'bars', title: `${cut(exam.name, 30)} mocks`, unit: '%', bars: mocks.map((m, i) => ({ label: cut(m.name || `Mock ${i + 1}`, 12), value: Math.max(0, Math.round(m.pct ?? 0)), tone: 'sky' })) });
  const next = [
    ...soon.slice(0, 3).map((d) => cut(`${d.title}: due ${short(new Date(`${d.due}T12:00`).getTime())}`, 110)),
    ...(exam?.revise ?? []).slice(0, 2).map((t) => cut(`Revise ${t.name}`, 110)),
    ...(exam?.today ?? []).slice(0, 3).map((t) => cut(`Study ${t.name}`, 110)),
    ...(flash?.due ? [`Review ${flash.due} flashcard${flash.due === 1 ? '' : 's'}`] : []),
  ].slice(0, 6);
  if (next.length) marks.push({ kind: 'list', title: 'Next week', items: next });
  if (studied >= 5) marks.push({ kind: 'medal', text: `${studied} study days this week` });
  const say = studied >= 5 ? `Great week! You studied ${studied} of 7 days.` : studied ? `Here's your week: ${studied} study day${studied === 1 ? '' : 's'}. Let's get a few more in next week.` : "Here's your week. No study days logged yet, so let's start one today.";
  return { text: say, beats: [{ say, marks }], stats: { studied, minutes, week } };
}

/** Whether the weekly report is due on its own: Sunday from 6 PM, once per week (last: when it was last shown). */
export function weeklyDue(now = Date.now(), last = 0) {
  const d = new Date(now);
  if (d.getDay() !== 0 || d.getHours() < 18) return false;
  return !last || now - last > 3 * DAY;
}

/** The nearest exam as a desktop badge: { text, sub } or null. */
export function examBadge(exams, now = Date.now()) {
  const e = exams.filter((x) => x.daysLeft != null && x.daysLeft >= 0).sort((a, b) => a.daysLeft - b.daysLeft)[0];
  if (!e) return null;
  const when = e.daysLeft === 0 ? 'today' : e.daysLeft === 1 ? 'tomorrow' : `in ${e.daysLeft} days`;
  const todo = (e.today ?? []).length;
  return { text: `${cut(e.name, 24)} ${when}`, sub: todo ? `${todo} topic${todo === 1 ? '' : 's'} today` : e.total ? `${e.done}/${e.total} topics done` : '' };
}
