import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '../db.js';
import { ah, validate, HttpError } from '../middleware/error.js';
import { requireRole } from '../middleware/auth.js';
import { accessFilter } from '../services/rag.js';
import { loadMe } from './auth.js';

/* ───────────── announcements ───────────── */
export const announcements = Router();

announcements.get('/', ah(async (req, res) => {
  const u = req.user!;
  const scope = u.role === 'admin' ? 'TRUE'
    : u.role === 'teacher' ? `(a.course_id IS NULL OR a.course_id IN (SELECT course_id FROM course_teachers WHERE user_id=$1))`
    : `(a.course_id IS NULL OR a.course_id IN (SELECT e.course_id FROM enrollments e JOIN students s ON s.class_group_id=e.class_group_id WHERE s.user_id=$1))`;
  const { rows } = await query(
    `SELECT a.*, c.name_sq AS course_sq, c.name_en AS course_en, us.first_name||' '||us.last_name AS author
     FROM announcements a LEFT JOIN courses c ON c.id=a.course_id LEFT JOIN users us ON us.id=a.author_id
     WHERE ${scope} AND $1::uuid IS NOT NULL ORDER BY a.created_at DESC LIMIT 100`, [u.id]);
  res.json(rows);
}));

announcements.post('/', requireRole('teacher', 'admin'), ah(async (req, res) => {
  const b = validate(z.object({ title: z.string().trim().min(3).max(150), body: z.string().trim().min(3).max(5000), courseId: z.number().int().nullable().optional() }), req.body);
  if (req.user!.role === 'teacher') {
    if (!b.courseId) throw new HttpError(403, 'Teachers can only post course announcements');
    const ok = await query('SELECT 1 FROM course_teachers WHERE course_id=$1 AND user_id=$2', [b.courseId, req.user!.id]);
    if (!ok.rowCount) throw new HttpError(403, 'You do not teach this course');
  }
  const { rows } = await query(`INSERT INTO announcements(author_id, course_id, title, body) VALUES ($1,$2,$3,$4) RETURNING *`,
    [req.user!.id, b.courseId ?? null, b.title, b.body]);
  // Fan out notifications
  await query(
    b.courseId
      ? `INSERT INTO notifications(user_id,title,body,link) SELECT s.user_id,$2,$3,'/announcements' FROM students s JOIN enrollments e ON e.class_group_id=s.class_group_id WHERE e.course_id=$1`
      : `INSERT INTO notifications(user_id,title,body,link) SELECT id,$2,$3,'/announcements' FROM users WHERE id<>$1::uuid AND is_active`,
    [b.courseId ?? req.user!.id, b.title, b.body.slice(0, 200)]);
  res.status(201).json(rows[0]);
}));

announcements.delete('/:id', requireRole('teacher', 'admin'), ah(async (req, res) => {
  const id = z.coerce.number().int().parse(req.params.id);
  const cond = req.user!.role === 'admin' ? '' : 'AND author_id=$2';
  const r = await query(`DELETE FROM announcements WHERE id=$1 ${cond}`, req.user!.role === 'admin' ? [id] : [id, req.user!.id]);
  if (!r.rowCount) throw new HttpError(404, 'Not found');
  res.status(204).end();
}));

/* ───────────── notifications ───────────── */
export const notifications = Router();
notifications.get('/', ah(async (req, res) => {
  res.json((await query('SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100', [req.user!.id])).rows);
}));
notifications.post('/read-all', ah(async (req, res) => {
  await query('UPDATE notifications SET read_at=now() WHERE user_id=$1 AND read_at IS NULL', [req.user!.id]); res.json({ ok: true });
}));
notifications.post('/:id/read', ah(async (req, res) => {
  await query('UPDATE notifications SET read_at=now() WHERE id=$1 AND user_id=$2', [z.coerce.number().parse(req.params.id), req.user!.id]); res.json({ ok: true });
}));

/* ───────────── profile ───────────── */
export const profile = Router();
profile.patch('/', ah(async (req, res) => {
  const b = validate(z.object({
    firstName: z.string().trim().min(1).max(60).optional(), lastName: z.string().trim().min(1).max(60).optional(),
    phone: z.string().trim().max(30).nullable().optional(), locale: z.enum(['sq', 'en']).optional(),
    office: z.string().trim().max(60).nullable().optional(),
  }), req.body);
  await query(`UPDATE users SET first_name=COALESCE($2,first_name), last_name=COALESCE($3,last_name),
               phone=CASE WHEN $4::boolean THEN $5 ELSE phone END, locale=COALESCE($6,locale) WHERE id=$1`,
    [req.user!.id, b.firstName ?? null, b.lastName ?? null, b.phone !== undefined, b.phone ?? null, b.locale ?? null]);
  if (b.office !== undefined && req.user!.role === 'teacher') await query('UPDATE teachers SET office=$2 WHERE user_id=$1', [req.user!.id, b.office]);
  res.json(await loadMe(req.user!.id));
}));
profile.post('/password', ah(async (req, res) => {
  const b = validate(z.object({ current: z.string().min(1), next: z.string().min(8).max(128).regex(/[A-Za-z]/).regex(/\d/) }), req.body);
  const { rows } = await query('SELECT password_hash FROM users WHERE id=$1', [req.user!.id]);
  if (!(await bcrypt.compare(b.current, rows[0].password_hash))) throw new HttpError(400, 'Current password is incorrect');
  await query('UPDATE users SET password_hash=$2 WHERE id=$1', [req.user!.id, await bcrypt.hash(b.next, 12)]);
  res.json({ ok: true });
}));

/* ───────────── admin dashboard ───────────── */
export const dashboard = Router();
dashboard.get('/admin', requireRole('admin'), ah(async (_req, res) => {
  const [counts, faq, recentUsers, recentDocs, unanswered, activity] = await Promise.all([
    query(`SELECT
      (SELECT count(*) FROM students)::int AS students, (SELECT count(*) FROM teachers)::int AS teachers,
      (SELECT count(*) FROM courses)::int AS courses, (SELECT count(*) FROM documents WHERE is_active)::int AS documents,
      (SELECT count(*) FROM conversations)::int AS conversations, (SELECT count(*) FROM messages WHERE role='user')::int AS questions,
      (SELECT count(*) FROM document_chunks)::int AS chunks`),
    query(`SELECT lower(trim(regexp_replace(content,'[?!.]+$',''))) AS question, count(*)::int AS count
           FROM messages WHERE role='user' GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 10`),
    query(`SELECT u.id, u.first_name, u.last_name, u.email, r.name AS role, u.created_at, u.last_login_at
           FROM users u JOIN roles r ON r.id=u.role_id ORDER BY u.created_at DESC LIMIT 8`),
    query(`SELECT d.id, d.title, d.status, d.created_at, c.name_sq AS category_sq, c.name_en AS category_en
           FROM documents d JOIN document_categories c ON c.id=d.category_id ORDER BY d.created_at DESC LIMIT 8`),
    query(`SELECT q.content AS question, q.created_at FROM messages a
           JOIN LATERAL (SELECT content, created_at FROM messages q WHERE q.conversation_id=a.conversation_id AND q.id<a.id AND q.role='user' ORDER BY q.id DESC LIMIT 1) q ON TRUE
           WHERE a.role='assistant' AND a.answered=false ORDER BY a.created_at DESC LIMIT 10`),
    query(`SELECT to_char(d,'YYYY-MM-DD') AS day, COALESCE(cnt,0)::int AS questions
           FROM generate_series(current_date-13, current_date, '1 day') d
           LEFT JOIN (SELECT created_at::date AS dd, count(*) cnt FROM messages WHERE role='user' GROUP BY 1) m ON m.dd=d ORDER BY d`),
  ]);
  res.json({ counts: counts.rows[0], faq: faq.rows, recentUsers: recentUsers.rows, recentDocuments: recentDocs.rows,
             unanswered: unanswered.rows, activity: activity.rows });
}));

dashboard.get('/summary', ah(async (req, res) => {
  const u = req.user!;
  const [unread, nextExam, ann] = await Promise.all([
    query('SELECT count(*)::int AS n FROM notifications WHERE user_id=$1 AND read_at IS NULL', [u.id]),
    query(`SELECT e.title, e.starts_at FROM exams e WHERE e.starts_at > now() AND
           (e.class_group_id IS NULL OR e.class_group_id=(SELECT class_group_id FROM students WHERE user_id=$1)
            OR e.course_id IN (SELECT course_id FROM course_teachers WHERE user_id=$1)) ORDER BY e.starts_at LIMIT 1`, [u.id]),
    query(`SELECT id, title, created_at FROM announcements ORDER BY created_at DESC LIMIT 3`),
  ]);
  res.json({ unread: unread.rows[0].n, nextExam: nextExam.rows[0] ?? null, announcements: ann.rows });
}));

/* ───────────── global search ───────────── */
export const search = Router();
search.get('/', ah(async (req, res) => {
  const q = validate(z.object({ q: z.string().trim().min(2).max(100) }), req.query).q;
  const like = `%${q}%`;
  const [courses, teachers, departments, programs, documents] = await Promise.all([
    query(`SELECT id, code, name_sq, name_en FROM courses WHERE unaccent_simple(name_sq||' '||name_en||' '||code) LIKE unaccent_simple($1) LIMIT 8`, [like]),
    query(`SELECT u.id, u.first_name, u.last_name, t.position FROM teachers t JOIN users u ON u.id=t.user_id
           WHERE unaccent_simple(u.first_name||' '||u.last_name||' '||t.position) LIKE unaccent_simple($1) LIMIT 8`, [like]),
    query(`SELECT id, name_sq, name_en, kind FROM departments WHERE unaccent_simple(name_sq||' '||name_en) LIKE unaccent_simple($1) LIMIT 8`, [like]),
    query(`SELECT id, name_sq, name_en FROM programs WHERE unaccent_simple(name_sq||' '||name_en) LIKE unaccent_simple($1) LIMIT 8`, [like]),
    // Documents (incl. procedures/regulations): title match + content match, access-filtered
    query(`SELECT d.id, d.title, cat.name_sq AS category_sq, cat.name_en AS category_en,
                  (SELECT left(content, 180) FROM document_chunks c WHERE c.document_id=d.id AND unaccent_simple(c.content) LIKE unaccent_simple($2) LIMIT 1) AS snippet
           FROM documents d JOIN document_categories cat ON cat.id=d.category_id
           WHERE d.is_active AND ${accessFilter('d', req.user!, '$1')}
             AND (unaccent_simple(d.title) LIKE unaccent_simple($2)
                  OR EXISTS (SELECT 1 FROM document_chunks c WHERE c.document_id=d.id AND unaccent_simple(c.content) LIKE unaccent_simple($2)))
           LIMIT 8`, [req.user!.id, like]),
  ]);
  res.json({ courses: courses.rows, teachers: teachers.rows, departments: departments.rows, programs: programs.rows, documents: documents.rows });
}));

/* ───────────── admin: users ───────────── */
export const users = Router();
users.get('/', requireRole('admin'), ah(async (_req, res) => {
  res.json((await query(`SELECT u.id, u.first_name, u.last_name, u.email, r.name AS role, u.is_active, u.created_at, u.last_login_at
                         FROM users u JOIN roles r ON r.id=u.role_id ORDER BY u.created_at DESC LIMIT 500`)).rows);
}));
users.patch('/:id', requireRole('admin'), ah(async (req, res) => {
  const b = validate(z.object({ isActive: z.boolean() }), req.body);
  const id = z.string().uuid().parse(req.params.id);
  if (id === req.user!.id) throw new HttpError(400, 'You cannot deactivate yourself');
  await query('UPDATE users SET is_active=$2 WHERE id=$1', [id, b.isActive]);
  res.json({ ok: true });
}));
