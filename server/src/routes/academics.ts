import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { ah, HttpError } from '../middleware/error.js';
import { requireRole } from '../middleware/auth.js';

const r = Router();

/** Course ids visible as "mine" for the current user (admin → all). */
const myCoursesSql = (role: string) =>
  role === 'student'
    ? `SELECT e.course_id FROM enrollments e JOIN students s ON s.class_group_id=e.class_group_id WHERE s.user_id=$1`
    : role === 'teacher'
      ? `SELECT course_id FROM course_teachers WHERE user_id=$1`
      : `SELECT id FROM courses WHERE $1::uuid IS NOT NULL`;

r.get('/courses', ah(async (req, res) => {
  const mine = req.query.mine !== 'false';
  const { rows } = await query(
    `SELECT c.id, c.code, c.name_sq, c.name_en, c.kind, c.weekly_hours, c.description_sq, c.description_en,
            p.name_sq AS program_sq, p.name_en AS program_en, d.name_sq AS department_sq, d.name_en AS department_en,
            COALESCE(json_agg(json_build_object('id',u.id,'name',u.first_name||' '||u.last_name))
                     FILTER (WHERE u.id IS NOT NULL),'[]') AS teachers
     FROM courses c LEFT JOIN programs p ON p.id=c.program_id LEFT JOIN departments d ON d.id=c.department_id
     LEFT JOIN course_teachers ct ON ct.course_id=c.id LEFT JOIN users u ON u.id=ct.user_id
     WHERE ${mine ? `c.id IN (${myCoursesSql(req.user!.role)})` : '$1::uuid IS NOT NULL'}
     GROUP BY c.id, p.id, d.id ORDER BY c.name_sq`, [req.user!.id]);
  res.json(rows);
}));

r.get('/schedule', ah(async (req, res) => {
  const role = req.user!.role;
  const where = role === 'student'
    ? 'sc.class_group_id = (SELECT class_group_id FROM students WHERE user_id=$1)'
    : role === 'teacher' ? 'sc.teacher_id=$1' : '$1::uuid IS NOT NULL';
  const { rows } = await query(
    `SELECT sc.id, sc.weekday, to_char(sc.start_time,'HH24:MI') AS start, to_char(sc.end_time,'HH24:MI') AS "end", sc.room,
            c.code, c.name_sq, c.name_en, c.kind, cg.name AS class_group, u.first_name||' '||u.last_name AS teacher
     FROM schedules sc JOIN courses c ON c.id=sc.course_id JOIN class_groups cg ON cg.id=sc.class_group_id
     LEFT JOIN users u ON u.id=sc.teacher_id
     WHERE ${where} ORDER BY sc.weekday, sc.start_time LIMIT 300`, [req.user!.id]);
  res.json(rows);
}));

r.get('/exams', ah(async (req, res) => {
  const role = req.user!.role;
  const where = role === 'student'
    ? '(e.class_group_id = (SELECT class_group_id FROM students WHERE user_id=$1) OR e.class_group_id IS NULL)'
    : role === 'teacher'
      ? `(e.course_id IN (SELECT course_id FROM course_teachers WHERE user_id=$1) OR e.class_group_id IS NULL)`
      : '$1::uuid IS NOT NULL';
  const { rows } = await query(
    `SELECT e.id, e.title, e.kind, e.starts_at, e.room, e.notes, e.is_demo, c.name_sq AS course_sq, c.name_en AS course_en, cg.name AS class_group
     FROM exams e LEFT JOIN courses c ON c.id=e.course_id LEFT JOIN class_groups cg ON cg.id=e.class_group_id
     WHERE ${where} ORDER BY e.starts_at`, [req.user!.id]);
  res.json(rows);
}));

r.get('/departments', ah(async (_req, res) => {
  const { rows } = await query(
    `SELECT d.*, (SELECT count(*) FROM teachers t WHERE t.department_id=d.id)::int AS teacher_count,
            COALESCE((SELECT json_agg(json_build_object('id',p.id,'name_sq',p.name_sq,'name_en',p.name_en)) FROM programs p WHERE p.department_id=d.id),'[]') AS programs
     FROM departments d ORDER BY d.kind, d.name_sq`);
  res.json(rows);
}));

r.get('/teachers', ah(async (_req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.first_name, u.last_name, t.position, t.office, d.name_sq AS department_sq, d.name_en AS department_en
     FROM teachers t JOIN users u ON u.id=t.user_id LEFT JOIN departments d ON d.id=t.department_id
     WHERE u.is_active ORDER BY u.last_name, u.first_name`);
  res.json(rows);
}));

/** Teacher: questions students asked the assistant in conversations scoped to the teacher's courses. */
r.get('/questions', requireRole('teacher', 'admin'), ah(async (req, res) => {
  const courseId = req.query.courseId ? z.coerce.number().int().parse(req.query.courseId) : null;
  const scope = req.user!.role === 'admin' ? '$1::uuid IS NOT NULL' : 'cv.course_id IN (SELECT course_id FROM course_teachers WHERE user_id=$1)';
  const { rows } = await query(
    `SELECT m.id, m.content AS question, m.created_at, c.name_sq AS course_sq, c.name_en AS course_en, cv.course_id,
            u.first_name||' '||u.last_name AS student,
            (SELECT a.answered FROM messages a WHERE a.conversation_id=m.conversation_id AND a.id>m.id AND a.role='assistant' ORDER BY a.id LIMIT 1) AS answered
     FROM messages m JOIN conversations cv ON cv.id=m.conversation_id JOIN courses c ON c.id=cv.course_id
     JOIN users u ON u.id=cv.user_id JOIN roles r ON r.id=u.role_id AND r.name='student'
     WHERE m.role='user' AND ${scope} ${courseId ? 'AND cv.course_id=$2' : ''}
     ORDER BY m.created_at DESC LIMIT 200`, courseId ? [req.user!.id, courseId] : [req.user!.id]);
  res.json(rows);
}));

r.get('/courses/:id', ah(async (req, res) => {
  const id = z.coerce.number().int().parse(req.params.id);
  const { rows } = await query('SELECT * FROM courses WHERE id=$1', [id]);
  if (!rows[0]) throw new HttpError(404, 'Course not found');
  res.json(rows[0]);
}));

export default r;
