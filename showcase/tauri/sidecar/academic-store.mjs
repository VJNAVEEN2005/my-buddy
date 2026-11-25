// Academic storage & deterministic calculation engine for My Buddy.
// Stores courses, grade categories, assignments, deliverables, and syllabus sources in ~/Roamies/Data/academic.json.
// Also provides GPA projection, task decomposition, and professor email drafting.
import { DATA_DIR } from './datadir.mjs';
import { readJson, writeJson } from './store.mjs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';

export const ACADEMIC_FILE = path.join(DATA_DIR, 'academic.json');

const uid = (prefix = 'id') => `${prefix}_${Date.now().toString(36)}_${randomBytes(2).toString('hex')}`;

const DEFAULT_ACADEMIC_DATA = {
  version: 1,
  courses: [],
  assignments: [],
  sources: [],
};

export function getAcademicData() {
  const data = readJson(ACADEMIC_FILE, { backup: true });
  if (data?.version === 1 && Array.isArray(data.courses) && Array.isArray(data.assignments)) {
    return data;
  }
  return { ...DEFAULT_ACADEMIC_DATA, courses: [], assignments: [], sources: [] };
}

export async function saveAcademicData(data) {
  const payload = {
    version: 1,
    courses: data.courses || [],
    assignments: data.assignments || [],
    sources: data.sources || [],
    updatedAt: Date.now(),
  };
  await writeJson(ACADEMIC_FILE, payload, { backup: true });
  return payload;
}

// ---------- Courses ----------

export function listCourses() {
  return getAcademicData().courses;
}

export async function addCourse(course) {
  const data = getAcademicData();
  const id = course.id || uid('crs');
  const newCourse = {
    id,
    code: String(course.code || '').trim().toUpperCase(),
    name: String(course.name || course.title || 'Untitled Course').trim(),
    credit_hours: Number.isFinite(Number(course.credit_hours)) ? Number(course.credit_hours) : 3,
    term: course.term ? String(course.term).trim() : null,
    instructor: {
      name: course.instructor?.name ? String(course.instructor.name).trim() : null,
      email: course.instructor?.email ? String(course.instructor.email).trim() : null,
      office_hours: course.instructor?.office_hours ? String(course.instructor.office_hours).trim() : null,
    },
    grade_weights: Array.isArray(course.grade_weights)
      ? course.grade_weights.map((w, idx) => ({
          id: w.id || `w_${idx}_${randomBytes(2).toString('hex')}`,
          category: String(w.category || 'General').trim(),
          weight_pct: Math.min(100, Math.max(0, Number(w.weight_pct) || 0)),
        }))
      : [],
    color: course.color || '#6366f1',
    created_at: Date.now(),
  };
  data.courses.push(newCourse);
  await saveAcademicData(data);
  return newCourse;
}

export async function updateCourse(id, fields) {
  const data = getAcademicData();
  const idx = data.courses.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  data.courses[idx] = {
    ...data.courses[idx],
    ...fields,
    updated_at: Date.now(),
  };
  await saveAcademicData(data);
  return data.courses[idx];
}

export async function deleteCourse(id) {
  const data = getAcademicData();
  data.courses = data.courses.filter((c) => c.id !== id);
  data.assignments = data.assignments.filter((a) => a.course_id !== id);
  data.sources = data.sources.filter((s) => s.course_id !== id);
  await saveAcademicData(data);
  return true;
}

// ---------- Assignments & Deliverables ----------

export function listAssignments(courseId = null) {
  const all = getAcademicData().assignments;
  return courseId ? all.filter((a) => a.course_id === courseId) : all;
}

export async function addAssignment(assignment) {
  const data = getAcademicData();
  const id = assignment.id || uid('asg');
  const newAssignment = {
    id,
    course_id: assignment.course_id || null,
    title: String(assignment.title || 'Untitled Deliverable').trim(),
    category: assignment.category ? String(assignment.category).trim() : 'General',
    due_date: assignment.due_date ? String(assignment.due_date).trim() : null,
    status: assignment.status || 'pending', // 'pending' | 'in_progress' | 'completed'
    points_earned: assignment.points_earned != null && Number.isFinite(Number(assignment.points_earned)) ? Number(assignment.points_earned) : null,
    points_possible: assignment.points_possible != null && Number.isFinite(Number(assignment.points_possible)) ? Number(assignment.points_possible) : 100,
    weight_pct: assignment.weight_pct != null && Number.isFinite(Number(assignment.weight_pct)) ? Number(assignment.weight_pct) : null,
    notes: assignment.notes ? String(assignment.notes).trim() : '',
    steps: Array.isArray(assignment.steps) ? assignment.steps : [],
    created_at: Date.now(),
  };
  data.assignments.push(newAssignment);
  await saveAcademicData(data);
  return newAssignment;
}

export async function updateAssignment(id, fields) {
  const data = getAcademicData();
  const idx = data.assignments.findIndex((a) => a.id === id);
  if (idx === -1) return null;
  data.assignments[idx] = {
    ...data.assignments[idx],
    ...fields,
    updated_at: Date.now(),
  };
  await saveAcademicData(data);
  return data.assignments[idx];
}

export async function deleteAssignment(id) {
  const data = getAcademicData();
  data.assignments = data.assignments.filter((a) => a.id !== id);
  await saveAcademicData(data);
  return true;
}

// ---------- Grade Calculation & Deterministic GPA Projection ----------

export const GRADE_POINTS = [
  { min_pct: 93, letter: 'A', points: 4.0 },
  { min_pct: 90, letter: 'A-', points: 3.7 },
  { min_pct: 87, letter: 'B+', points: 3.3 },
  { min_pct: 83, letter: 'B', points: 3.0 },
  { min_pct: 80, letter: 'B-', points: 2.7 },
  { min_pct: 77, letter: 'C+', points: 2.3 },
  { min_pct: 73, letter: 'C', points: 2.0 },
  { min_pct: 70, letter: 'C-', points: 1.7 },
  { min_pct: 67, letter: 'D+', points: 1.3 },
  { min_pct: 60, letter: 'D', points: 1.0 },
  { min_pct: 0, letter: 'F', points: 0.0 },
];

export function pctToGrade(pct) {
  if (!Number.isFinite(pct) || pct < 0) return { letter: 'N/A', points: 0.0 };
  const rounded = Math.round(pct * 10) / 10;
  for (const g of GRADE_POINTS) {
    if (rounded >= g.min_pct) return { letter: g.letter, points: g.points, pct: rounded };
  }
  return { letter: 'F', points: 0.0, pct: rounded };
}

/**
 * Deterministically projects course grades and overall semester GPA.
 * Never guesses unlisted weights: only calculates against defined categories.
 * Accepts optional hypothetical overrides { [assignmentId]: targetPct }.
 */
export function projectGpa(hypotheticals = {}) {
  const { courses, assignments } = getAcademicData();
  if (!courses.length) {
    return { gpa: null, projectedGpa: null, courses: [] };
  }

  const courseResults = courses.map((course) => {
    const courseAsgs = assignments.filter((a) => a.course_id === course.id);
    const weights = course.grade_weights || [];
    const hasWeights = weights.length > 0;

    let earnedWeighted = 0;
    let totalAssessedWeight = 0;
    let projEarnedWeighted = 0;
    let projTotalWeight = 0;

    if (hasWeights) {
      // Group by category
      for (const w of weights) {
        const catAsgs = courseAsgs.filter((a) => (a.category || '').toLowerCase() === (w.category || '').toLowerCase());
        const graded = catAsgs.filter((a) => a.points_earned != null && a.points_possible > 0);
        if (graded.length > 0) {
          const catPct = graded.reduce((acc, a) => acc + (a.points_earned / a.points_possible), 0) / graded.length * 100;
          earnedWeighted += (catPct * (w.weight_pct / 100));
          totalAssessedWeight += w.weight_pct;
        }

        // Projected includes completed + hypotheticals or uncompleted defaults
        const allCatWithHypo = catAsgs.map((a) => {
          if (a.points_earned != null && a.points_possible > 0) return (a.points_earned / a.points_possible) * 100;
          if (hypotheticals[a.id] != null) return Number(hypotheticals[a.id]);
          return null;
        }).filter((p) => p != null);

        if (allCatWithHypo.length > 0) {
          const projCatPct = allCatWithHypo.reduce((a, b) => a + b, 0) / allCatWithHypo.length;
          projEarnedWeighted += (projCatPct * (w.weight_pct / 100));
          projTotalWeight += w.weight_pct;
        }
      }
    } else {
      // Unweighted / raw points average
      const graded = courseAsgs.filter((a) => a.points_earned != null && a.points_possible > 0);
      if (graded.length > 0) {
        const avg = graded.reduce((acc, a) => acc + (a.points_earned / a.points_possible), 0) / graded.length * 100;
        earnedWeighted = avg;
        totalAssessedWeight = 100;
      }
      const allWithHypo = courseAsgs.map((a) => {
        if (a.points_earned != null && a.points_possible > 0) return (a.points_earned / a.points_possible) * 100;
        if (hypotheticals[a.id] != null) return Number(hypotheticals[a.id]);
        return null;
      }).filter((p) => p != null);
      if (allWithHypo.length > 0) {
        projEarnedWeighted = allWithHypo.reduce((a, b) => a + b, 0) / allWithHypo.length;
        projTotalWeight = 100;
      }
    }

    const currentPct = totalAssessedWeight > 0 ? (earnedWeighted / totalAssessedWeight) * 100 : null;
    const projectedPct = projTotalWeight > 0 ? (projEarnedWeighted / projTotalWeight) * 100 : currentPct;

    const currentGrade = currentPct != null ? pctToGrade(currentPct) : null;
    const projectedGrade = projectedPct != null ? pctToGrade(projectedPct) : null;

    return {
      courseId: course.id,
      code: course.code,
      name: course.name,
      credit_hours: course.credit_hours || 3,
      currentPct: currentPct != null ? Math.round(currentPct * 10) / 10 : null,
      currentGrade: currentGrade ? currentGrade.letter : 'N/A',
      currentPoints: currentGrade ? currentGrade.points : null,
      projectedPct: projectedPct != null ? Math.round(projectedPct * 10) / 10 : null,
      projectedGrade: projectedGrade ? projectedGrade.letter : 'N/A',
      projectedPoints: projectedGrade ? projectedGrade.points : null,
      gradedCount: courseAsgs.filter((a) => a.points_earned != null).length,
      totalCount: courseAsgs.length,
    };
  });

  // Calculate overall GPA
  let totalCredits = 0;
  let totalGradePoints = 0;
  let projGradePoints = 0;
  let creditsWithGrades = 0;

  for (const c of courseResults) {
    totalCredits += c.credit_hours;
    if (c.currentPoints != null) {
      totalGradePoints += (c.currentPoints * c.credit_hours);
      creditsWithGrades += c.credit_hours;
    }
    if (c.projectedPoints != null) {
      projGradePoints += (c.projectedPoints * c.credit_hours);
    }
  }

  const gpa = creditsWithGrades > 0 ? Math.round((totalGradePoints / creditsWithGrades) * 100) / 100 : null;
  const projectedGpa = totalCredits > 0 && projGradePoints > 0 ? Math.round((projGradePoints / totalCredits) * 100) / 100 : gpa;

  return {
    gpa,
    projectedGpa,
    totalCredits,
    creditsWithGrades,
    courses: courseResults,
  };
}

// ---------- Student-Tuned Task Decomposition ----------

export function decomposeAcademicTask(task) {
  const title = String(task.title || '').trim();
  const lower = title.toLowerCase();
  const totalMin = Math.max(30, Number(task.estimated_minutes) || 90);
  let steps;

  if (/exam|midterm|final|quiz|test|review/.test(lower)) {
    steps = [
      'Inventory required topics, formulas, and lecture slides',
      'Conduct an unassisted diagnostic pass to identify weak areas',
      'Targeted deep-dive review on the 2 weakest concepts',
      'Complete a timed practice problem set or mock exam',
      'Draft a high-yield 1-page condensed review/formula sheet',
    ];
  } else if (/essay|paper|report|thesis|dissertation|writing/.test(lower)) {
    steps = [
      'Define clear thesis statement, deliverable goals, and grading rubric',
      'Gather core scholarly sources, citations, and evidence',
      'Construct a detailed outline and section skeleton',
      'Draft the rough first pass without stopping to edit',
      'Substantive revision, citation check, and final proofread',
    ];
  } else if (/problem|homework|assignment|pset|lab|exercise|code/.test(lower)) {
    steps = [
      'Read entire specification/prompt and flag immediate blockers',
      'Complete straightforward problems / setup code first',
      'Tackle difficult algorithm, derivation, or complex sections',
      'Verify results, edge cases, and test inputs against rubric',
      'Clean up documentation, format code/writeup, and submit',
    ];
  } else {
    steps = [
      'Clarify finished criteria and required deliverables',
      'Assemble all source materials, notes, and tools',
      'Complete the first working milestone',
      'Resolve the hardest blocker or remaining gap',
      'Final review and completion check',
    ];
  }

  const eachMin = Math.max(10, Math.round(totalMin / steps.length / 5) * 5);
  return steps.map((s, idx) => ({
    id: `step_${idx + 1}`,
    title: s,
    order_index: idx,
    estimated_minutes: eachMin,
    completed: false,
  }));
}

// ---------- Professor Email Drafter & Gmail Compose ----------

export function formatProfessorEmail({
  professorName,
  courseCode,
  courseName,
  studentName,
  scenario, // 'extension' | 'office_hours' | 'grade_inquiry' | 'general'
  assignmentTitle,
  reason,
  proposedDate,
  question,
}) {
  const salutation = professorName ? `Dear Professor ${professorName.replace(/^prof(essor)?\.?\s*/i, '')},` : 'Dear Professor,';
  const signoff = `Sincerely,\n${studentName || '[Your Name]'}\n${courseCode ? `${courseCode}` : ''}`;
  const courseTag = courseCode ? `[${courseCode}]` : '';

  let subject = '';
  let body = '';

  switch (scenario) {
    case 'extension': {
      subject = `${courseTag} Extension Request: ${assignmentTitle || 'Upcoming Assignment'}`;
      body = `${salutation}\n\nI am writing to respectfully ask if it might be possible to request an extension on ${assignmentTitle || 'the upcoming assignment'}.\n\n${reason || 'Due to unexpected circumstances, I need a brief extension to ensure the submission meets the course standards.'}\n\nWould it be possible to submit this by ${proposedDate || 'the end of the week'}? Thank you very much for your understanding and consideration.\n\n${signoff}`;
      break;
    }
    case 'office_hours': {
      subject = `${courseTag} Office Hours Question / Meeting Inquiry`;
      body = `${salutation}\n\nI hope your week is going well. I have a question regarding ${assignmentTitle || 'the recent lecture topics'} and would appreciate a few minutes to discuss it during your office hours.\n\n${question || 'I have reviewed the notes and attempted the problems, but wanted to clarify a specific concept.'}\n\nAre you available during your scheduled office hours, or would an alternate time work better for you?\n\nThank you,\n${signoff}`;
      break;
    }
    case 'grade_inquiry': {
      subject = `${courseTag} Question regarding grade on ${assignmentTitle || 'Assignment'}`;
      body = `${salutation}\n\nI hope you are having a good week. I noticed the feedback posted for ${assignmentTitle || 'the recent assignment'} and was hoping to better understand where I lost points so I can improve on future work.\n\nCould we briefly connect during office hours to review the rubric feedback together?\n\nThank you for your time and guidance.\n\n${signoff}`;
      break;
    }
    case 'general':
    default: {
      subject = `${courseTag} Question regarding ${courseName || 'Coursework'}`;
      body = `${salutation}\n\nI hope you are doing well. I had a brief question regarding ${courseName || 'our class'}:\n\n${question || reason || 'Could you please clarify the upcoming requirements?'}\n\nThank you for your assistance.\n\n${signoff}`;
      break;
    }
  }

  return { subject, body };
}

export function buildGmailComposeUrl({ to, subject, body, authUserEmail }) {
  const cleanTo = String(to || '').trim();
  const cleanSubj = String(subject || '').slice(0, 300);
  const cleanBody = String(body || '').slice(0, 6000);
  const auth = authUserEmail ? `?authuser=${encodeURIComponent(authUserEmail)}&` : '?';
  return `https://mail.google.com/mail/${auth}view=cm&fs=1&to=${encodeURIComponent(cleanTo)}&su=${encodeURIComponent(cleanSubj)}&body=${encodeURIComponent(cleanBody)}`;
}

/** An Outlook on the web compose window, pre-filled. Nothing is sent until the user presses Send there. */
export function buildOutlookComposeUrl({ to, subject, body }) {
  const q = new URLSearchParams({ to: String(to || '').trim(), subject: String(subject || '').slice(0, 300), body: String(body || '').slice(0, 6000) });
  return `https://outlook.office.com/mail/deeplink/compose?${q.toString().replace(/\+/g, '%20')}`;
}

// ---------- iCalendar (.ics) Parser ----------

export function parseIcsCalendar(text) {
  const unfolded = String(text || '').replace(/\r?\n[ \t]/g, '');
  const blocks = unfolded.split('BEGIN:VEVENT').slice(1).map((p) => p.split('END:VEVENT')[0]);
  return blocks.map((block) => {
    const fields = {};
    for (const line of block.split(/\r?\n/)) {
      const idx = line.indexOf(':');
      if (idx < 0) continue;
      const key = line.slice(0, idx).split(';')[0];
      fields[key] = line.slice(idx + 1).replace(/\\n/g, '\n').replace(/\\,/g, ',');
    }
    const rawDate = fields.DTSTART || fields.DTEND || '';
    const dateMatch = rawDate.match(/^(\d{4})(\d{2})(\d{2})/);
    return {
      title: fields.SUMMARY || 'Academic Event',
      due_date: dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : null,
      notes: fields.DESCRIPTION || fields.LOCATION || '',
    };
  }).filter((e) => e.title);
}
