import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { query, tx } from '../db.js';
import { ah, validate, HttpError } from '../middleware/error.js';
import { requireAuth, signToken, type Role } from '../middleware/auth.js';

const r = Router();
const limiter = rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: true, legacyHeaders: false });

const password = z.string().min(8).max(128).regex(/[A-Za-z]/, 'letter required').regex(/\d/, 'digit required');
const Register = z.object({
  email: z.string().email().max(200).transform(s => s.toLowerCase()),
  password,
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  role: z.enum(['student', 'teacher']),
  classGroupId: z.number().int().optional(),
  departmentId: z.number().int().optional(),
  locale: z.enum(['sq', 'en']).default('sq'),
});

export async function loadMe(id: string) {
  const { rows } = await query(
    `SELECT u.id, u.email, u.first_name, u.last_name, r.name AS role, u.locale, u.phone, u.created_at,
            s.student_number, cg.name AS class_group, cg.id AS class_group_id, p.name_sq AS program_sq, p.name_en AS program_en,
            t.position, t.office, d.name_sq AS department_sq, d.name_en AS department_en
     FROM users u JOIN roles r ON r.id=u.role_id
     LEFT JOIN students s ON s.user_id=u.id LEFT JOIN class_groups cg ON cg.id=s.class_group_id
     LEFT JOIN programs p ON p.id=cg.program_id
     LEFT JOIN teachers t ON t.user_id=u.id LEFT JOIN departments d ON d.id=t.department_id
     WHERE u.id=$1`, [id]);
  return rows[0];
}

r.post('/register', limiter, ah(async (req, res) => {
  const b = validate(Register, req.body);
  const exists = await query('SELECT 1 FROM users WHERE email=$1', [b.email]);
  if (exists.rowCount) throw new HttpError(409, 'Email already registered');
  const hash = await bcrypt.hash(b.password, 12);
  const id = await tx(async c => {
    const roleId = b.role === 'student' ? 1 : 2;
    const { rows } = await c.query(
      `INSERT INTO users(email,password_hash,first_name,last_name,role_id,locale) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [b.email, hash, b.firstName, b.lastName, roleId, b.locale]);
    const uid = rows[0].id;
    if (b.role === 'student') {
      await c.query(`INSERT INTO students(user_id, student_number, class_group_id, enrolled_year)
                     VALUES ($1, 'BC' || to_char(now(),'YY') || lpad((floor(random()*99999))::text,5,'0'), $2, extract(year from now()))`,
        [uid, b.classGroupId ?? null]);
    } else {
      // Self-registered teachers get no course access until an admin assigns courses.
      await c.query(`INSERT INTO teachers(user_id, position, department_id) VALUES ($1,'mësues',$2)`, [uid, b.departmentId ?? null]);
    }
    return uid;
  });
  const user = await loadMe(id);
  res.status(201).json({ token: signToken({ id, role: b.role as Role, email: b.email }), user });
}));

r.post('/login', limiter, ah(async (req, res) => {
  const b = validate(z.object({ email: z.string().email().transform(s => s.toLowerCase()), password: z.string().min(1).max(128) }), req.body);
  const { rows } = await query(
    `SELECT u.id, u.email, u.password_hash, u.is_active, r.name AS role FROM users u JOIN roles r ON r.id=u.role_id WHERE email=$1`, [b.email]);
  const u = rows[0];
  // Constant-ish work even when user missing, to avoid user enumeration by timing
  const ok = await bcrypt.compare(b.password, u?.password_hash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva');
  if (!u || !ok || !u.is_active) throw new HttpError(401, 'Invalid email or password');
  await query('UPDATE users SET last_login_at=now() WHERE id=$1', [u.id]);
  res.json({ token: signToken({ id: u.id, role: u.role, email: u.email }), user: await loadMe(u.id) });
}));

r.get('/me', requireAuth, ah(async (req, res) => { res.json(await loadMe(req.user!.id)); }));

// Public lookups for the registration form
r.get('/options', ah(async (_req, res) => {
  const [cg, d] = await Promise.all([
    query('SELECT id, name FROM class_groups ORDER BY name'),
    query(`SELECT id, name_sq, name_en FROM departments ORDER BY name_sq`),
  ]);
  res.json({ classGroups: cg.rows, departments: d.rows });
}));

export default r;
