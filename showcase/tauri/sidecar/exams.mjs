// Competitive exam preparation (UPSC, SSC, banking, GATE, CAT, NEET, JEE, placement tests …): each exam has a date, its
// syllabus as topics grouped by subject, and mock test scores. Kept in ~/Roamies/Data/exams.json, this computer only.
// The view (examView) works out the days left, progress by subject, the mock trend and today's plan: new topics at the
// pace the days left need, plus topics finished a week or more ago coming back for revision. Pure apart from load/save.
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { z } from 'zod';
import { DIR, readJson, writeJson } from './store.mjs';

const FILE = path.join(DIR, 'exams.json');
const DAY = 864e5;
export const MAX_EXAMS = 12, MAX_TOPICS = 400, MAX_MOCKS = 200;
export const STATUSES = ['todo', 'learning', 'done'];
const uid = (p) => `${p}${randomBytes(3).toString('hex')}`;
const clean = (s, n = 120) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

/**
 * A syllabus as written → topics. Takes "Subject: topic, topic; topic" lines, a "Subject" heading line followed by
 * "- topic" / "1. topic" lines, or plain topic lines (subject "General").
 */
export function parseSyllabus(text) {
  const out = [], seen = new Set();
  let subject = 'General';
  const add = (s, t) => {
    const name = clean(t.replace(/^[-*•·\d.)\s]+/, ''), 120), sub = clean(s, 60) || 'General';
    const key = `${sub.toLowerCase()}|${name.toLowerCase()}`;
    if (name.length < 2 || seen.has(key)) return;
    seen.add(key); out.push({ subject: sub, name });
  };
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = /^([^:]{2,60}):\s*(.+)$/.exec(line);
    if (m && !/^[-*•\d]/.test(line)) { subject = m[1]; m[2].split(/[,;]/).forEach((t) => add(subject, t)); continue; }
    const bullet = /^([-*•·]|\d+[.)])\s+/.test(line);
    // A short line with no bullet and no comma, followed by bullets, is a subject heading.
    if (!bullet && !line.includes(',') && line.length <= 40 && /[A-Za-z]/.test(line) && !/[.?!]$/.test(line) && line.split(' ').length <= 5) {
      const heading = line.replace(/:$/, '');
      subject = heading; continue;
    }
    (bullet ? [line] : line.split(/[,;]/)).forEach((t) => add(subject, t));
  }
  return out.slice(0, MAX_TOPICS);
}

/** "2027-06-14" → local ms at that day's start, or null. */
export function examDay(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s ?? ''));
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}
const startOfDay = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };

/** One exam as the Study page and the plan tool see it. now: ms. */
export function examView(exam, now = Date.now()) {
  const topics = exam.topics ?? [], today = startOfDay(now), day = examDay(exam.date);
  const daysLeft = day == null ? null : Math.round((day - today) / DAY);
  const done = topics.filter((t) => t.status === 'done'), left = topics.filter((t) => t.status !== 'done');
  const subjects = [];
  for (const t of topics) {
    let s = subjects.find((x) => x.name === t.subject);
    if (!s) subjects.push(s = { name: t.subject, done: 0, total: 0 });
    s.total++; if (t.status === 'done') s.done++;
  }
  // Pace: new topics a day so the syllabus is done with a revision stretch (15% of the time, up to 2 weeks) to spare.
  const buffer = daysLeft == null ? 0 : Math.min(14, Math.floor(Math.max(0, daysLeft) * 0.15));
  const studyDays = daysLeft == null ? null : Math.max(1, daysLeft - buffer);
  const perDay = left.length ? (studyDays == null ? Math.min(3, left.length) : Math.max(1, Math.ceil(left.length / studyDays))) : 0;
  // Today: topics already being learnt first, then the next ones round the subjects (so no subject is left to the end).
  const learning = left.filter((t) => t.status === 'learning');
  const queue = [...learning];
  const bySub = new Map();
  for (const t of left.filter((x) => x.status === 'todo')) { if (!bySub.has(t.subject)) bySub.set(t.subject, []); bySub.get(t.subject).push(t); }
  const lanes = [...bySub.values()];
  for (let i = 0; queue.length < Math.max(perDay, learning.length) && lanes.some((l) => l.length); i++) { const l = lanes[i % lanes.length]; if (l.length) queue.push(l.shift()); }
  // Revision: done a week or more ago and not revised since, oldest first, two a day.
  const revise = done.filter((t) => t.doneAt && now - (t.revisedAt ?? t.doneAt) >= 7 * DAY)
    .sort((a, b) => (a.revisedAt ?? a.doneAt) - (b.revisedAt ?? b.doneAt)).slice(0, 2);
  const mocks = (exam.mocks ?? []).slice().sort((a, b) => a.at - b.at).map((m) => ({ ...m, pct: m.total > 0 ? Math.round((m.score / m.total) * 1000) / 10 : null }));
  const pcts = mocks.map((m) => m.pct).filter((p) => p != null);
  const avg = pcts.length ? Math.round((pcts.reduce((a, b) => a + b, 0) / pcts.length) * 10) / 10 : null;
  const last = pcts.at(-1) ?? null, prev = pcts.length > 1 ? pcts.at(-2) : null;
  return {
    id: exam.id, name: exam.name, date: exam.date ?? null, daysLeft, target: exam.target ?? null,
    done: done.length, total: topics.length, subjects,
    perDay, today: queue.slice(0, Math.max(perDay, learning.length)).map((t) => ({ id: t.id, name: t.name, subject: t.subject, status: t.status })),
    revise: revise.map((t) => ({ id: t.id, name: t.name, subject: t.subject })),
    mocks: mocks.slice(-12).map((m) => ({ id: m.id, at: m.at, score: m.score, total: m.total, pct: m.pct, name: m.name ?? '' })),
    mockAvg: avg, mockLast: last, mockChange: last != null && prev != null ? Math.round((last - prev) * 10) / 10 : null,
  };
}

/** The plan as words, for the agent to read out or build on. */
export function planText(v) {
  const head = `${v.name}: ${v.daysLeft == null ? 'no date set' : v.daysLeft < 0 ? 'the exam date has passed' : v.daysLeft === 0 ? 'the exam is today' : `${v.daysLeft} day${v.daysLeft === 1 ? '' : 's'} left`}. ${v.done}/${v.total} topics done.`;
  const pace = v.total - v.done ? ` Pace: ${v.perDay} new topic${v.perDay === 1 ? '' : 's'} a day.` : ' Whole syllabus done: mocks and revision now.';
  const today = v.today.length ? `\nToday: ${v.today.map((t) => `${t.name} (${t.subject}${t.status === 'learning' ? ', carrying on' : ''})`).join('; ')}.` : '';
  const rev = v.revise.length ? `\nRevise: ${v.revise.map((t) => `${t.name} (${t.subject})`).join('; ')}.` : '';
  const mock = v.mockLast != null ? `\nMocks: last ${v.mockLast}%${v.mockChange != null ? ` (${v.mockChange >= 0 ? '+' : ''}${v.mockChange})` : ''}, average ${v.mockAvg}%${v.target ? `, target ${v.target}` : ''}.` : '';
  const weak = v.subjects.filter((s) => s.total).sort((a, b) => a.done / a.total - b.done / b.total)[0];
  return `${head}${pace}${today}${rev}${mock}${weak && v.done < v.total ? `\nFurthest behind: ${weak.name} (${weak.done}/${weak.total}).` : ''}`;
}

// ---------- storage ----------
let data = null;
const load = () => {
  if (data) return data;
  const j = readJson(FILE, { backup: true });
  data = j?.version === 1 && Array.isArray(j.exams) ? j : { version: 1, exams: [] };
  return data;
};
const save = () => writeJson(FILE, load(), { backup: true });
export const listExams = () => load().exams;
export function findExam(ref) {
  const r = clean(ref, 120).toLowerCase(), all = load().exams;
  if (!r) return all.length === 1 ? all[0] : null;
  return all.find((e) => e.id === ref) ?? all.find((e) => e.name.toLowerCase() === r) ?? all.find((e) => e.name.toLowerCase().includes(r) || r.includes(e.name.toLowerCase())) ?? null;
}
export async function addExam({ name, date = null, target = null, syllabus = '', topics = [] }) {
  const d = load();
  if (d.exams.length >= MAX_EXAMS) throw new Error(`There are already ${MAX_EXAMS} exams. Remove one first.`);
  const parsed = [...(topics ?? []).map((t) => ({ subject: clean(t.subject, 60) || 'General', name: clean(t.name ?? t, 120) })), ...parseSyllabus(syllabus)];
  const seen = new Set();
  const list = parsed.filter((t) => { const k = `${t.subject.toLowerCase()}|${t.name.toLowerCase()}`; if (t.name.length < 2 || seen.has(k)) return false; seen.add(k); return true; }).slice(0, MAX_TOPICS);
  const exam = { id: uid('x'), name: clean(name, 80), date: examDay(date) ? String(date).slice(0, 10) : null, target: target ? clean(target, 40) : null, topics: list.map((t) => ({ id: uid('t'), ...t, status: 'todo' })), mocks: [], at: Date.now() };
  d.exams.push(exam); await save(); return exam;
}
export async function addTopics(exam, { syllabus = '', topics = [] }) {
  const have = new Set(exam.topics.map((t) => `${t.subject.toLowerCase()}|${t.name.toLowerCase()}`));
  const more = [...(topics ?? []).map((t) => ({ subject: clean(t.subject, 60) || 'General', name: clean(t.name ?? t, 120) })), ...parseSyllabus(syllabus)]
    .filter((t) => { const k = `${t.subject.toLowerCase()}|${t.name.toLowerCase()}`; if (t.name.length < 2 || have.has(k)) return false; have.add(k); return true; });
  exam.topics.push(...more.slice(0, MAX_TOPICS - exam.topics.length).map((t) => ({ id: uid('t'), ...t, status: 'todo' })));
  await save(); return more.length;
}
/** Marks topics (by id, or by name: exact, else the one containing the words) learning, done, revised or to do. */
export async function markTopics(exam, refs, status, now = Date.now()) {
  const hit = [], missed = [];
  for (const ref of refs) {
    const r = clean(ref, 120).toLowerCase();
    const t = exam.topics.find((x) => x.id === ref) ?? exam.topics.find((x) => x.name.toLowerCase() === r) ?? exam.topics.find((x) => x.name.toLowerCase().includes(r));
    if (!t) { missed.push(ref); continue; }
    if (status === 'revised') { t.revisedAt = now; t.revisions = (t.revisions ?? 0) + 1; if (t.status !== 'done') { t.status = 'done'; t.doneAt = now; } }
    else { t.status = status; if (status === 'done') t.doneAt = now; else { delete t.doneAt; delete t.revisedAt; } }
    hit.push(t.name);
  }
  if (hit.length) await save();
  return { hit, missed };
}
export async function logMock(exam, { score, total, name = '', at = Date.now() }) {
  const m = { id: uid('m'), score: Number(score), total: Number(total), name: clean(name, 60), at };
  exam.mocks = [...(exam.mocks ?? []), m].slice(-MAX_MOCKS); await save(); return m;
}
export async function removeExam(id) {
  const d = load(), n = d.exams.length;
  d.exams = d.exams.filter((e) => e.id !== id);
  if (d.exams.length !== n) await save();
  return d.exams.length !== n;
}

// ---------- the agent's tools ----------
export function createExamTools({ changed = () => {} } = {}) {
  const pick = (ref) => {
    const e = findExam(ref ?? '');
    if (!e) throw new Error(listExams().length ? `No exam matches "${ref}". There is: ${listExams().map((x) => x.name).join(', ')}.` : 'No exams yet: add one with add_exam.');
    return e;
  };
  const TopicIn = z.object({ subject: z.string().max(60), name: z.string().max(120) });
  return [
    {
      name: 'add_exam',
      description: 'Start tracking a competitive or entrance exam the user is preparing for (UPSC, SSC CGL, IBPS PO, GATE, CAT, NEET, JEE, a placement test…). name: the exam. date: YYYY-MM-DD if known. target: their goal (a rank, cutoff or score) if said. syllabus: the syllabus as text ("Subject: topic, topic" lines, or a subject line followed by "- topic" lines); or topics: [{subject, name}]. If they gave no syllabus, write the standard one for that exam from what you know, kept to its real sections. To add topics to an exam already here, pass the same name: they are added.',
      parameters: z.object({ name: z.string().min(2).max(80), date: z.string().max(10).optional(), target: z.string().max(40).optional(), syllabus: z.string().max(20000).optional(), topics: z.array(TopicIn).max(MAX_TOPICS).optional() }),
      execute: async ({ name, date, target, syllabus = '', topics = [] }) => {
        const old = findExam(name);
        if (old && old.name.toLowerCase() === clean(name).toLowerCase()) {
          const n = await addTopics(old, { syllabus, topics });
          if (date && examDay(date)) old.date = String(date).slice(0, 10);
          if (target) old.target = clean(target, 40);
          await save(); changed();
          return `Added ${n} topic${n === 1 ? '' : 's'} to ${old.name} (${old.topics.length} in all). It shows on the Study page's Exams tab.`;
        }
        const e = await addExam({ name, date, target, syllabus, topics });
        changed();
        return `Tracking ${e.name}${e.date ? ` on ${e.date}` : ''} with ${e.topics.length} topics. ${planText(examView(e))}\nIt shows on the Study page's Exams tab.`;
      },
    },
    {
      name: 'update_exam_topics',
      description: 'Mark syllabus topics of an exam: status "done" (finished studying), "learning" (started), "revised" (went over it again), or "todo" (undo). exam: its name (can be left out when there is only one). topics: topic names as the user said them, or ids.',
      parameters: z.object({ exam: z.string().max(80).optional(), topics: z.array(z.string().max(120)).min(1).max(50), status: z.enum(['done', 'learning', 'revised', 'todo']) }),
      execute: async ({ exam, topics, status }) => {
        const e = pick(exam);
        const { hit, missed } = await markTopics(e, topics, status);
        changed();
        const v = examView(e);
        return `${hit.length ? `Marked ${status}: ${hit.join(', ')}.` : 'Nothing matched.'}${missed.length ? ` Not found: ${missed.join(', ')}.` : ''} ${v.done}/${v.total} done.`;
      },
    },
    {
      name: 'log_mock_test',
      description: 'Save a mock test or practice paper score for an exam. score and total in marks (e.g. 142 of 200). name: the test, if said.',
      parameters: z.object({ exam: z.string().max(80).optional(), score: z.number(), total: z.number().positive(), name: z.string().max(60).optional() }),
      execute: async ({ exam, score, total, name }) => {
        const e = pick(exam);
        await logMock(e, { score, total, name });
        changed();
        const v = examView(e);
        return `Saved ${score}/${total} (${v.mockLast}%). ${v.mockChange != null ? `That's ${v.mockChange >= 0 ? 'up' : 'down'} ${Math.abs(v.mockChange)} points on the last one. ` : ''}Average ${v.mockAvg}% over ${v.mocks.length}.`;
      },
    },
    {
      name: 'exam_plan',
      description: "The user's exam preparation status and today's study plan: days left, topics done, today's topics at the pace needed, topics due for revision, mock trend, the subject furthest behind. Use for \"what should I study today\", \"how is my prep going\". exam: leave out for all of them.",
      parameters: z.object({ exam: z.string().max(80).optional() }),
      execute: async ({ exam }) => {
        const list = exam ? [pick(exam)] : listExams();
        return list.length ? list.map((e) => planText(examView(e))).join('\n\n') : 'No exams yet. Ask which exam they are preparing for and its date, then call add_exam.';
      },
    },
  ];
}
