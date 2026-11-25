// Academic tools for My Buddy agent.
// Integrates syllabus parsing, GPA projection, academic task decomposition, professor emailing, and .ics calendar import.
import { z } from 'zod';
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
  projectGpa,
  updateAssignment,
  updateCourse,
} from './academic-store.mjs';
import { extractTextFromFile, parseSyllabusWithModel } from './syllabus-parser.mjs';
import fs from 'node:fs';

export function createAcademicTools({ openUrl = () => {}, callModel = async () => ({ text: '{}' }), userName = 'Student' }) {
  const tools = [
    {
      name: 'parse_syllabus',
      description: 'Ingest and parse an academic course syllabus from a PDF, Word (.docx), or text document. Extracts course code, name, credits, grade weights, and assignments/deliverables with due dates, and saves them to the student\'s Academic Hub.',
      parameters: z.object({
        path: z.string().describe('File path to the syllabus (.pdf, .docx, or .txt)'),
        save_to_hub: z.boolean().optional().describe('Whether to save extracted course and assignments to the Academic Hub (default true)'),
      }),
      execute: async ({ path: filePath, save_to_hub = true }) => {
        const rawText = await extractTextFromFile(filePath);
        if (!rawText.trim()) throw new Error('Could not extract readable text from the syllabus file.');

        const structured = await parseSyllabusWithModel(rawText, callModel);
        let savedCourse = null;
        const savedAssignments = [];

        if (save_to_hub !== false) {
          savedCourse = await addCourse({
            code: structured.course.code,
            name: structured.course.name,
            credit_hours: structured.course.credit_hours,
            term: structured.course.term,
            instructor: structured.instructor,
            grade_weights: structured.grade_weights,
          });

          for (const a of structured.assignments) {
            const asg = await addAssignment({
              course_id: savedCourse.id,
              title: a.title,
              due_date: a.due_date,
              category: a.category,
              points_possible: a.points_possible || 100,
            });
            savedAssignments.push(asg);
          }
        }

        const weightsDesc = structured.grade_weights.map((w) => `${w.category}: ${w.weight_pct}%`).join(', ');
        const assignmentCount = structured.assignments.length;
        const withDates = structured.assignments.filter((a) => a.due_date).length;

        return `Successfully parsed syllabus for ${structured.course.code || ''} ${structured.course.name}. ` +
          `Instructor: ${structured.instructor?.name || 'Not specified'}. ` +
          `Grade breakdown: [${weightsDesc || 'None listed'}]. ` +
          `Found ${assignmentCount} assignments/deliverables (${withDates} with scheduled due dates).` +
          (savedCourse ? ` Saved to Academic Hub under Course ID ${savedCourse.id}.` : '');
      },
    },

    {
      name: 'project_gpa',
      description: 'Calculate and project semester GPA based on current course grades and hypothetical future scores without guessing unlisted weights.',
      parameters: z.object({
        hypotheticals: z.string().optional().describe('Optional JSON string mapping assignment IDs or category names to projected percentage scores, e.g. {"Lab 1": 95}'),
      }),
      execute: async ({ hypotheticals }) => {
        let hypoObj = {};
        if (hypotheticals) {
          try { hypoObj = JSON.parse(hypotheticals); } catch {}
        }
        const result = projectGpa(hypoObj);
        if (!result.courses.length) {
          return 'No enrolled courses found in Academic Hub. Add courses or import a syllabus first.';
        }

        const lines = result.courses.map((c) => {
          const cur = c.currentPct != null ? `${c.currentPct}% (${c.currentGrade}, ${c.currentPoints} pts)` : 'Ungraded';
          const proj = c.projectedPct != null ? ` -> Projected: ${c.projectedPct}% (${c.projectedGrade})` : '';
          return `• ${c.code ? `[${c.code}] ` : ''}${c.name} (${c.credit_hours} cr): ${cur}${proj}`;
        });

        const overallCur = result.gpa != null ? `Current GPA: ${result.gpa.toFixed(2)}` : 'Current GPA: N/A (no graded items yet)';
        const overallProj = result.projectedGpa != null ? `Projected GPA: ${result.projectedGpa.toFixed(2)}` : '';

        return `${overallCur}${overallProj ? ` | ${overallProj}` : ''} (out of 4.0 scale across ${result.totalCredits} credits)\n\n` + lines.join('\n');
      },
    },

    {
      name: 'decompose_academic_task',
      description: 'Break down an academic assignment, exam, paper, or problem set into high-retention student study steps.',
      parameters: z.object({
        title: z.string().describe('Title of the assignment, exam, or study task (e.g. "Calculus Midterm 2", "History Research Paper")'),
        estimated_minutes: z.number().optional().describe('Estimated total study/work minutes (default 90)'),
        assignment_id: z.string().optional().describe('Optional assignment ID in Academic Hub to attach these steps to'),
      }),
      execute: async ({ title, estimated_minutes, assignment_id }) => {
        const steps = decomposeAcademicTask({ title, estimated_minutes });
        if (assignment_id) {
          await updateAssignment(assignment_id, { steps });
        }
        const stepList = steps.map((s, i) => `${i + 1}. ${s.title} (~${s.estimated_minutes} min)`).join('\n');
        return `Study breakdown for "${title}":\n${stepList}${assignment_id ? ` (Attached to assignment ${assignment_id})` : ''}`;
      },
    },

    {
      name: 'draft_professor_email',
      description: 'Draft a professional student-to-faculty email (extension request, office hours inquiry, grade review, or general question) and optionally open a pre-filled compose window in Gmail.',
      parameters: z.object({
        scenario: z.string().describe('Email purpose: "extension", "office_hours", "grade_inquiry", or "general"'),
        professor_name: z.string().optional().describe('Professor\'s last name or full name (e.g. "Smith" or "Prof. Davis")'),
        course_code: z.string().optional().describe('Course code, e.g. "CS 101" or "CHEM 204"'),
        course_name: z.string().optional().describe('Full course title'),
        assignment_title: z.string().optional().describe('Title of the assignment or deliverable'),
        reason: z.string().optional().describe('Reason for extension request or context for inquiry'),
        proposed_date: z.string().optional().describe('Proposed new submission date for extension (e.g. "Friday, Oct 24th")'),
        question: z.string().optional().describe('Specific question or blocker for office hours'),
        open_in_gmail: z.boolean().optional().describe('Whether to open a pre-filled Gmail compose window in browser (default true)'),
        recipient_email: z.string().optional().describe('Professor\'s email address to pre-fill in To field'),
        auth_user_email: z.string().optional().describe('Optional student Gmail address to route through (e.g. student@university.edu)'),
      }),
      execute: async ({
        scenario,
        professor_name,
        course_code,
        course_name,
        assignment_title,
        reason,
        proposed_date,
        question,
        open_in_gmail = true,
        recipient_email = '',
        auth_user_email = '',
      }) => {
        const { subject, body } = formatProfessorEmail({
          professorName: professor_name,
          courseCode: course_code,
          courseName: course_name,
          studentName: userName,
          scenario,
          assignmentTitle: assignment_title,
          reason,
          proposedDate: proposed_date,
          question,
        });

        const gmailUrl = buildGmailComposeUrl({
          to: recipient_email,
          subject,
          body,
          authUserEmail: auth_user_email,
        });

        if (open_in_gmail !== false) {
          try {
            await openUrl(gmailUrl);
          } catch (e) {
            console.error('[academic] Failed to open Gmail url:', e);
          }
        }

        return `Drafted email for Professor ${professor_name || ''}:\n` +
          `Subject: ${subject}\n\n` +
          `Body:\n${body}\n\n` +
          `Gmail compose link: ${gmailUrl}`;
      },
    },

    {
      name: 'open_email_draft',
      description: 'Open a pre-filled email draft for the user to review and send themselves, in Gmail or Outlook on the web, with no account connection. Use for any email they want written ("email Ravi that I\'ll be late"). Write the subject and body yourself. Nothing is sent: they press Send. Use draft_professor_email instead for emails to a professor.',
      parameters: z.object({
        to: z.string().max(500).optional().describe('Recipient address(es), comma separated, only if the user gave them'),
        subject: z.string().max(300),
        body: z.string().max(6000),
        app: z.enum(['gmail', 'outlook']).optional().describe('Where to open it (default gmail)'),
        auth_user_email: z.string().optional().describe('Which Gmail account to open it in, if the user has several'),
      }),
      execute: async ({ to = '', subject, body, app = 'gmail', auth_user_email = '' }) => {
        const url = app === 'outlook'
          ? buildOutlookComposeUrl({ to, subject, body })
          : buildGmailComposeUrl({ to, subject, body, authUserEmail: auth_user_email });
        await openUrl(url);
        return `Opened the draft in ${app === 'outlook' ? 'Outlook' : 'Gmail'} for the user to check and send. Nothing was sent.`;
      },
    },

    {
      name: 'import_ics_calendar',
      description: 'Import an academic calendar or course schedule from an iCalendar (.ics) file into Academic Hub and commitments.',
      parameters: z.object({
        path: z.string().describe('File path to the .ics file'),
        course_id: z.string().optional().describe('Optional course ID to associate these deliverables with'),
      }),
      execute: async ({ path: filePath, course_id }) => {
        if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
        const text = fs.readFileSync(filePath, 'utf8');
        const events = parseIcsCalendar(text);
        if (!events.length) return 'No events or assignments found in the .ics file.';

        let count = 0;
        for (const ev of events) {
          await addAssignment({
            course_id: course_id || null,
            title: ev.title,
            due_date: ev.due_date,
            notes: ev.notes,
            category: 'Calendar',
          });
          count++;
        }

        return `Successfully imported ${count} academic events/deadlines from ${filePath} into Academic Hub.`;
      },
    },
  ];

  return tools;
}
