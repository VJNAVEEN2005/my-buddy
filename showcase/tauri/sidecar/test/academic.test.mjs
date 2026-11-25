// Unit tests for Academic Hub: syllabus parsing, deterministic GPA calculation,
// academic task decomposition, professor emailing, and iCal import. Run: npm test
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  addAssignment,
  addCourse,
  buildGmailComposeUrl,
  buildOutlookComposeUrl,
  decomposeAcademicTask,
  deleteAssignment,
  deleteCourse,
  formatProfessorEmail,
  getAcademicData,
  listAssignments,
  listCourses,
  parseIcsCalendar,
  pctToGrade,
  projectGpa,
  saveAcademicData,
  updateAssignment,
  updateCourse,
} from '../academic-store.mjs';
import {
  extractTextFromFile,
  parseJsonBlock,
  parseSyllabusWithModel,
  sanitizeSyllabusData,
} from '../syllabus-parser.mjs';
import { createAcademicTools } from '../academic-tools.mjs';

// Clean slate in academic storage for testing
await saveAcademicData({ version: 1, courses: [], assignments: [], sources: [] });

// ---------- Test 1: Course & Assignment CRUD ----------
{
  const c1 = await addCourse({
    code: 'CS 201',
    name: 'Data Structures',
    credit_hours: 4,
    term: 'Fall 2026',
    instructor: { name: 'Dr. Turing', email: 'turing@cs.edu', office_hours: 'TuTh 10am' },
    grade_weights: [
      { category: 'Exams', weight_pct: 40 },
      { category: 'Projects', weight_pct: 35 },
      { category: 'Homework', weight_pct: 25 },
    ],
  });

  assert.equal(c1.code, 'CS 201');
  assert.equal(c1.credit_hours, 4);
  assert.equal(c1.grade_weights.length, 3);
  assert.equal(listCourses().length, 1);

  const a1 = await addAssignment({
    course_id: c1.id,
    title: 'Project 1: Binary Search Trees',
    category: 'Projects',
    due_date: '2026-10-20',
    points_earned: 90,
    points_possible: 100,
  });

  const a2 = await addAssignment({
    course_id: c1.id,
    title: 'Midterm Exam',
    category: 'Exams',
    due_date: '2026-11-05',
    points_earned: 85,
    points_possible: 100,
  });

  assert.equal(listAssignments().length, 2);
  assert.equal(listAssignments(c1.id).length, 2);

  await updateAssignment(a1.id, { points_earned: 95 });
  const updatedAsgs = listAssignments(c1.id);
  const foundA1 = updatedAsgs.find((a) => a.id === a1.id);
  assert.equal(foundA1.points_earned, 95);
}

// ---------- Test 2: Deterministic Grade & GPA Calculation ----------
{
  // Test percentage to letter grade & points
  assert.deepEqual(pctToGrade(96), { letter: 'A', points: 4.0, pct: 96 });
  assert.deepEqual(pctToGrade(88.5), { letter: 'B+', points: 3.3, pct: 88.5 });
  assert.deepEqual(pctToGrade(74), { letter: 'C', points: 2.0, pct: 74 });
  assert.deepEqual(pctToGrade(55), { letter: 'F', points: 0.0, pct: 55 });

  // Test GPA calculation for our course
  const proj = projectGpa();
  assert.ok(proj.courses.length >= 1);
  const cData = proj.courses[0];

  // Assessed weights so far: Projects (35%, score 95%) and Exams (40%, score 85%)
  // Weighted: (95 * 0.35) + (85 * 0.40) = 33.25 + 34 = 67.25 out of 75 total assessed weight
  // Percentage: (67.25 / 75) * 100 = 89.67% -> B+ (3.3)
  assert.ok(cData.currentPct >= 89.6 && cData.currentPct <= 89.7, `Expected ~89.67, got ${cData.currentPct}`);
  assert.equal(cData.currentGrade, 'B+');
  assert.equal(cData.currentPoints, 3.3);
  assert.equal(proj.gpa, 3.3);

  // Test hypothetical future grade scenario
  // Add Homework assignment (25% weight) with no grade yet
  const c = listCourses()[0];
  const hw = await addAssignment({
    course_id: c.id,
    title: 'Homework 1',
    category: 'Homework',
    due_date: '2026-11-20',
    points_earned: null,
    points_possible: 100,
  });

  // What if student gets 100% on Homework 1?
  // New projected weighted: 67.25 + (100 * 0.25) = 92.25 out of 100% = 92.25% -> A- (3.7)
  const hypoProj = projectGpa({ [hw.id]: 100 });
  const hypoCourse = hypoProj.courses.find((x) => x.courseId === c.id);
  assert.ok(hypoCourse.projectedPct >= 92.2 && hypoCourse.projectedPct <= 92.3);
  assert.equal(hypoCourse.projectedGrade, 'A-');
}

// ---------- Test 3: Student-Tuned Task Decomposition ----------
{
  const examSteps = decomposeAcademicTask({ title: 'Physics 101 Final Exam', estimated_minutes: 100 });
  assert.equal(examSteps.length, 5);
  assert.ok(examSteps[0].title.toLowerCase().includes('inventory'));
  assert.ok(examSteps[1].title.toLowerCase().includes('diagnostic'));
  assert.ok(examSteps[4].title.toLowerCase().includes('sheet'));

  const essaySteps = decomposeAcademicTask({ title: 'Literature Term Paper', estimated_minutes: 120 });
  assert.equal(essaySteps.length, 5);
  assert.ok(essaySteps[0].title.toLowerCase().includes('thesis'));
  assert.ok(essaySteps[2].title.toLowerCase().includes('outline'));

  const psetSteps = decomposeAcademicTask({ title: 'Math Problem Set 4', estimated_minutes: 60 });
  assert.equal(psetSteps.length, 5);
  assert.ok(psetSteps[0].title.toLowerCase().includes('specification'));
  assert.ok(psetSteps[3].title.toLowerCase().includes('verify'));
}

// ---------- Test 4: Professor Email Drafter & Zero-Auth Gmail URL ----------
{
  const email = formatProfessorEmail({
    professorName: 'Smith',
    courseCode: 'CS 101',
    studentName: 'Alex Mercer',
    scenario: 'extension',
    assignmentTitle: 'Project 2',
    reason: 'I came down with a fever and need two additional days.',
    proposedDate: 'Monday, Oct 27th',
  });

  assert.ok(email.subject.includes('[CS 101] Extension Request: Project 2'));
  assert.ok(email.body.includes('Dear Professor Smith,'));
  assert.ok(email.body.includes('Monday, Oct 27th'));
  assert.ok(email.body.includes('Alex Mercer'));

  const gmailUrl = buildGmailComposeUrl({
    to: 'prof.smith@university.edu',
    subject: email.subject,
    body: email.body,
    authUserEmail: 'alex@student.edu',
  });

  assert.ok(gmailUrl.startsWith('https://mail.google.com/mail/?authuser=alex%40student.edu&view=cm'));
  assert.ok(gmailUrl.includes('to=prof.smith%40university.edu'));
  assert.ok(gmailUrl.includes('su=' + encodeURIComponent(email.subject)));

  const outlookUrl = buildOutlookComposeUrl({ to: 'ravi@example.com', subject: 'Running late', body: 'See you at 5 & not 4' });
  assert.ok(outlookUrl.startsWith('https://outlook.office.com/mail/deeplink/compose?'));
  assert.ok(outlookUrl.includes('to=ravi%40example.com'));
  assert.ok(outlookUrl.includes('subject=Running%20late'));
  assert.ok(outlookUrl.includes('%26'));
  assert.ok(!outlookUrl.includes('+'));
}

// ---------- Test 5: iCalendar (.ics) Parsing ----------
{
  const sampleIcs = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:Midterm Examination
DTSTART:20261015T090000Z
DESCRIPTION:Covers chapters 1 to 5. Room 302.
END:VEVENT
BEGIN:VEVENT
SUMMARY:Lab Report 3 Due
DTSTART:20261022T235900Z
DESCRIPTION:Submit via portal.
END:VEVENT
END:VCALENDAR`;

  const parsed = parseIcsCalendar(sampleIcs);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].title, 'Midterm Examination');
  assert.equal(parsed[0].due_date, '2026-10-15');
  assert.ok(parsed[0].notes.includes('Room 302'));
  assert.equal(parsed[1].title, 'Lab Report 3 Due');
  assert.equal(parsed[1].due_date, '2026-10-22');
}

// ---------- Test 6: Syllabus Parser Utilities & Sanitization ----------
{
  const jsonWithFence = '```json\n{"course": {"name": "Algorithms", "code": "CS 300", "credit_hours": 3}, "grade_weights": [{"category": "Exams", "weight_pct": 50}], "assignments": [{"title": "Exam 1", "due_date": "2026-10-10", "category": "Exams"}]}\n```';
  const parsed = parseJsonBlock(jsonWithFence);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.data.course.code, 'CS 300');

  const sanitized = sanitizeSyllabusData(parsed.data);
  assert.equal(sanitized.course.name, 'Algorithms');
  assert.equal(sanitized.course.credit_hours, 3);
  assert.equal(sanitized.grade_weights[0].weight_pct, 50);
  assert.equal(sanitized.assignments[0].due_date, '2026-10-10');

  // Test with mock model runner
  const mockModel = async (prompt) => {
    assert.ok(prompt.includes('===SYLLABUS==='));
    return JSON.stringify({
      course: { name: 'Biology 101', code: 'BIO 101', credit_hours: 4 },
      instructor: { name: 'Dr. Green', email: 'green@bio.edu' },
      grade_weights: [{ category: 'Labs', weight_pct: 100 }],
      assignments: [{ title: 'Dissection Lab', due_date: '2026-11-01', category: 'Labs' }],
    });
  };

  const modelResult = await parseSyllabusWithModel('Fake syllabus text', mockModel);
  assert.equal(modelResult.course.name, 'Biology 101');
  assert.equal(modelResult.instructor.name, 'Dr. Green');
  assert.equal(modelResult.assignments.length, 1);
}

// ---------- Test 7: Academic Tools Execution ----------
{
  let openedUrl = null;
  const mockOpenUrl = (url) => { openedUrl = url; };
  const mockModel = async () => JSON.stringify({
    course: { name: 'Organic Chemistry', code: 'CHEM 220', credit_hours: 4 },
    instructor: { name: 'Prof. Curie' },
    grade_weights: [{ category: 'Labs', weight_pct: 40 }, { category: 'Exams', weight_pct: 60 }],
    assignments: [{ title: 'Lab 1', due_date: '2026-09-30', category: 'Labs' }],
  });

  const tools = createAcademicTools({ openUrl: mockOpenUrl, callModel: mockModel, userName: 'Taylor' });
  assert.equal(tools.length, 6);

  const draftTool = tools.find((t) => t.name === 'draft_professor_email');
  const draftResult = await draftTool.execute({
    scenario: 'office_hours',
    professor_name: 'Curie',
    course_code: 'CHEM 220',
    question: 'How to calculate reaction equilibrium?',
    open_in_gmail: true,
  });

  assert.ok(draftResult.includes('Drafted email for Professor Curie'));
  assert.ok(draftResult.includes('CHEM 220'));
  assert.ok(openedUrl && openedUrl.includes('https://mail.google.com/mail'));

  const mailTool = tools.find((t) => t.name === 'open_email_draft');
  const mailResult = await mailTool.execute({ to: 'ravi@example.com', subject: 'Hi', body: 'Hello', app: 'outlook' });
  assert.ok(mailResult.includes('Nothing was sent'));
  assert.ok(openedUrl.startsWith('https://outlook.office.com/mail/deeplink/compose?'));

  const decompTool = tools.find((t) => t.name === 'decompose_academic_task');
  const decompResult = await decompTool.execute({ title: 'Chemistry Exam 1', estimated_minutes: 120 });
  assert.ok(decompResult.includes('Study breakdown for "Chemistry Exam 1"'));

  const gpaTool = tools.find((t) => t.name === 'project_gpa');
  const gpaResult = await gpaTool.execute({});
  assert.ok(gpaResult.includes('GPA:'));
}

console.log('academic tests: passed');
