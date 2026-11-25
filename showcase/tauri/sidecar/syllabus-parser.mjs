// Syllabus document extractor for My Buddy.
// Reads PDF, Word (.docx), and plain text documents and structures them with AI.
import fs from 'node:fs';
import path from 'node:path';

export const SYLLABUS_PROMPT_PREFIX = `You are an academic syllabus parser. Extract structured data from this course syllabus.
Respond with ONLY a raw JSON object (no markdown fences, no explanation) matching this schema:
{
  "course": {
    "name": string,
    "code": string or null,
    "credit_hours": number or null,
    "term": string or null
  },
  "instructor": {
    "name": string or null,
    "email": string or null,
    "office_hours": string or null
  },
  "grade_weights": [
    { "category": string, "weight_pct": number }
  ],
  "assignments": [
    {
      "title": string,
      "due_date": "YYYY-MM-DD" or null,
      "category": string or null,
      "points_possible": number or null
    }
  ]
}

Extraction rules:
- Include ONLY facts directly stated in the syllabus. Never invent dates, assignments, or weights.
- Read through the full syllabus, especially any weekly course schedule, tables, or grading breakdown.
- Every graded item, exam, quiz, homework, problem set, presentation, report, and lab is an assignment.
- Exams, midterms, and finals count as assignments even if they appear only inside a schedule table row.
- Format due_date as ISO YYYY-MM-DD. If year is absent, infer from the term; otherwise null.
- weight_pct should be a number (e.g. 25 for 25%).
- Categories for assignments should match the grade_weights categories whenever possible.
- If an item or value is unknown, use null (or [] for arrays).

Everything after the separator ===SYLLABUS=== is source document content:
===SYLLABUS===
`;

export async function extractTextFromFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const ext = path.extname(filePath).toLowerCase();
  const buffer = fs.readFileSync(filePath);

  if (ext === '.pdf') {
    const { extractText } = await import('unpdf');
    const result = await extractText(new Uint8Array(buffer));
    // unpdf returns { text: string[] | string, totalPages: number }
    if (Array.isArray(result.text)) {
      return result.text.join('\n\n');
    }
    return String(result.text || '');
  }

  if (ext === '.docx' || ext === '.doc') {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return String(result.value || '');
  }

  // Fallback for plain text, markdown, csv, etc.
  return buffer.toString('utf8');
}

export function parseJsonBlock(text) {
  let raw = String(text || '').trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fence) raw = fence[1].trim();
  else {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start !== -1 && end > start) {
      raw = raw.slice(start, end + 1);
    }
  }
  try {
    return { ok: true, data: JSON.parse(raw) };
  } catch (err) {
    return { ok: false, error: err.message, rawText: text };
  }
}

export function sanitizeSyllabusData(parsed) {
  const course = parsed?.course || {};
  const instructor = parsed?.instructor || {};
  const cleanStr = (s) => (typeof s === 'string' && s.trim() ? s.trim() : null);
  const cleanNum = (n) => (Number.isFinite(Number(n)) && n != null ? Number(n) : null);
  const isoDate = (d) => (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.trim()) ? d.trim() : null);

  const gradeWeights = (Array.isArray(parsed?.grade_weights) ? parsed.grade_weights : [])
    .map((w) => ({
      category: cleanStr(w.category) || 'General',
      weight_pct: Math.min(100, Math.max(0, cleanNum(w.weight_pct) || 0)),
    }))
    .filter((w) => w.weight_pct > 0);

  const assignments = (Array.isArray(parsed?.assignments) ? parsed.assignments : [])
    .map((a) => ({
      title: cleanStr(a.title) || 'Untitled Assignment',
      due_date: isoDate(a.due_date),
      category: cleanStr(a.category) || 'General',
      points_possible: cleanNum(a.points_possible) || 100,
    }))
    .filter((a) => a.title);

  return {
    course: {
      name: cleanStr(course.name) || 'Untitled Course',
      code: cleanStr(course.code),
      credit_hours: cleanNum(course.credit_hours) || 3,
      term: cleanStr(course.term),
    },
    instructor: {
      name: cleanStr(instructor.name),
      email: cleanStr(instructor.email),
      office_hours: cleanStr(instructor.office_hours),
    },
    grade_weights: gradeWeights,
    assignments,
  };
}

export async function parseSyllabusWithModel(rawText, callModel) {
  const truncated = rawText.slice(0, 100000);
  const prompt = SYLLABUS_PROMPT_PREFIX + truncated;
  const reply = await callModel(prompt);
  const jsonResult = parseJsonBlock(typeof reply === 'string' ? reply : reply?.text);
  if (!jsonResult.ok) {
    throw new Error(`Failed to parse syllabus JSON from model: ${jsonResult.error}`);
  }
  return sanitizeSyllabusData(jsonResult.data);
}
