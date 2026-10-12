import { Router, type Request } from 'express';
import multer from 'multer';
import path from 'node:path';
import { mkdirSync, unlink } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { query } from '../db.js';
import { config } from '../config.js';
import { ah, validate, HttpError } from '../middleware/error.js';
import { requireRole } from '../middleware/auth.js';
import { accessFilter } from '../services/rag.js';
import { ingestDocument } from '../services/ingest.js';

const r = Router();
const UPLOAD_DIR = path.resolve(config.UPLOAD_DIR);
mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED: Record<string, string> = { 'application/pdf': '.pdf', 'text/plain': '.txt', 'text/markdown': '.md' };
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => cb(null, randomUUID() + (ALLOWED[file.mimetype] ?? '')),   // never trust client filename
  }),
  limits: { fileSize: config.MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => (ALLOWED[file.mimetype] ? cb(null, true) : cb(new HttpError(415, 'Only PDF, TXT or MD files are allowed'))),
});

const Meta = z.object({
  title: z.string().trim().min(2).max(200),
  categoryId: z.coerce.number().int(),
  visibility: z.enum(['public', 'staff', 'course']).default('public'),
  courseId: z.coerce.number().int().optional(),
  sourceUrl: z.string().url().optional().or(z.literal('').transform(() => undefined)),
});

/** Teachers may only publish course documents for courses they teach. */
async function assertCanPublish(user: Request['user'], meta: z.infer<typeof Meta>) {
  if (user!.role === 'admin') return;
  if (meta.visibility !== 'course' || !meta.courseId) throw new HttpError(403, 'Teachers can only upload course materials');
  const { rowCount } = await query('SELECT 1 FROM course_teachers WHERE course_id=$1 AND user_id=$2', [meta.courseId, user!.id]);
  if (!rowCount) throw new HttpError(403, 'You do not teach this course');
}

async function verifyPdfMagic(file: Express.Multer.File) {
  if (file.mimetype !== 'application/pdf') return;
  const fh = await import('node:fs/promises').then(m => m.open(file.path, 'r'));
  const b = Buffer.alloc(5); await fh.read(b, 0, 5, 0); await fh.close();
  if (b.toString() !== '%PDF-') { unlink(file.path, () => {}); throw new HttpError(415, 'File is not a valid PDF'); }
}

r.get('/categories', ah(async (_req, res) => {
  res.json((await query('SELECT id, slug, name_sq, name_en FROM document_categories ORDER BY id')).rows);
}));

r.get('/', ah(async (req, res) => {
  const q = validate(z.object({
    search: z.string().max(100).optional(), categoryId: z.coerce.number().int().optional(),
    courseId: z.coerce.number().int().optional(), includeInactive: z.coerce.boolean().optional(),
  }), req.query);
  const params: unknown[] = [req.user!.id];
  let where = `WHERE ${accessFilter('d', req.user!, '$1')}`;
  if (!(q.includeInactive && req.user!.role === 'admin')) where += ' AND d.is_active';
  if (q.search) { params.push(`%${q.search}%`); where += ` AND (d.title ILIKE $${params.length} OR d.original_name ILIKE $${params.length})`; }
  if (q.categoryId) { params.push(q.categoryId); where += ` AND d.category_id=$${params.length}`; }
  if (q.courseId) { params.push(q.courseId); where += ` AND d.course_id=$${params.length}`; }
  const { rows } = await query(
    `SELECT d.id, d.title, d.visibility, d.course_id, c.name_sq AS course_sq, c.name_en AS course_en, d.original_name, d.mime_type,
            d.size_bytes, d.page_count, d.status, d.error, d.is_active, d.source_url, d.created_at, d.replaces_id,
            cat.slug AS category, cat.name_sq AS category_sq, cat.name_en AS category_en, d.category_id,
            u.first_name || ' ' || u.last_name AS uploaded_by, d.uploaded_by AS uploaded_by_id,
            (SELECT count(*) FROM document_chunks dc WHERE dc.document_id=d.id)::int AS chunks
     FROM documents d JOIN document_categories cat ON cat.id=d.category_id
     LEFT JOIN courses c ON c.id=d.course_id LEFT JOIN users u ON u.id=d.uploaded_by
     ${where} ORDER BY d.created_at DESC LIMIT 200`, params);
  res.json(rows);
}));

/** Streams the file only after the same access check used by the chatbot. */
r.get('/:id/file', ah(async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const { rows } = await query(`SELECT file_path, original_name, mime_type FROM documents d WHERE d.id=$2 AND ${accessFilter('d', req.user!, '$1')}`,
    [req.user!.id, id]);
  if (!rows[0]) throw new HttpError(404, 'Document not found');
  const p = path.resolve(UPLOAD_DIR, path.basename(rows[0].file_path));
     res.setHeader('Content-Type', rows[0].mime_type.startsWith('text/') ? `${rows[0].mime_type}; charset=utf-8` : rows[0].mime_type);
  res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(rows[0].original_name)}`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.sendFile(p);
}));

async function createFromUpload(req: Request, replacesId?: string) {
  if (!req.file) throw new HttpError(400, 'File is required');
  await verifyPdfMagic(req.file);
  const meta = validate(Meta, req.body);
  try { await assertCanPublish(req.user, meta); } catch (e) { unlink(req.file.path, () => {}); throw e; }
  const { rows } = await query(
    `INSERT INTO documents(title, category_id, visibility, course_id, file_path, original_name, mime_type, size_bytes, source_url, uploaded_by, replaces_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [meta.title, meta.categoryId, meta.visibility, meta.visibility === 'course' ? meta.courseId : null,
     path.basename(req.file.path), req.file.originalname.slice(0, 200), req.file.mimetype, req.file.size,
     meta.sourceUrl ?? null, req.user!.id, replacesId ?? null]);
  const doc = rows[0];
  // Process synchronously so the uploader gets ready/failed status in the response.
  try { await ingestDocument(doc.id, req.file.path, req.file.mimetype); } catch { /* status saved as failed */ }
  return (await query('SELECT * FROM documents WHERE id=$1', [doc.id])).rows[0];
}

r.post('/', requireRole('admin', 'teacher'), upload.single('file'), ah(async (req, res) => {
  const doc = await createFromUpload(req);
  if (doc.visibility === 'course' && doc.status === 'ready') {
    await query(`INSERT INTO notifications(user_id, title, body, link)
                 SELECT s.user_id, 'Material i ri', $2, '/documents' FROM students s
                 JOIN enrollments e ON e.class_group_id=s.class_group_id WHERE e.course_id=$1`, [doc.course_id, doc.title]);
  }
  res.status(doc.status === 'ready' ? 201 : 422).json(doc);
}));

/** Replace: upload new version, deactivate the old one (kept for audit, excluded from search). */
r.post('/:id/replace', requireRole('admin'), upload.single('file'), ah(async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const old = (await query('SELECT * FROM documents WHERE id=$1', [id])).rows[0];
  if (!old) throw new HttpError(404, 'Document not found');
  req.body.title ||= old.title; req.body.categoryId ||= old.category_id; req.body.visibility ||= old.visibility;
  if (old.course_id && !req.body.courseId) req.body.courseId = old.course_id;
  const doc = await createFromUpload(req, id);
  if (doc.status === 'ready') await query('UPDATE documents SET is_active=false WHERE id=$1', [id]);
  res.status(doc.status === 'ready' ? 201 : 422).json(doc);
}));

r.post('/:id/reprocess', requireRole('admin'), ah(async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const d = (await query('SELECT * FROM documents WHERE id=$1', [id])).rows[0];
  if (!d) throw new HttpError(404, 'Document not found');
  await query(`UPDATE documents SET status='processing' WHERE id=$1`, [id]);
  try { await ingestDocument(id, path.join(UPLOAD_DIR, d.file_path), d.mime_type); } catch { /* recorded */ }
  res.json((await query('SELECT * FROM documents WHERE id=$1', [id])).rows[0]);
}));

r.delete('/:id', requireRole('admin', 'teacher'), ah(async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const d = (await query('SELECT * FROM documents WHERE id=$1', [id])).rows[0];
  if (!d) throw new HttpError(404, 'Document not found');
  if (req.user!.role === 'teacher' && d.uploaded_by !== req.user!.id) throw new HttpError(403, 'You can only delete your own uploads');
  await query('DELETE FROM documents WHERE id=$1', [id]);
  unlink(path.join(UPLOAD_DIR, path.basename(d.file_path)), () => {});
  res.status(204).end();
}));

export default r;
