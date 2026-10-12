import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { query } from '../db.js';
import { ah, validate, HttpError } from '../middleware/error.js';
import { retrieve } from '../services/rag.js';
import { answer, titleFrom } from '../services/llm.js';
import { config } from '../config.js';

const r = Router();
const chatLimiter = rateLimit({ windowMs: 60_000, limit: 20, keyGenerator: req => req.user?.id ?? req.ip ?? 'x' });

async function owned(convId: string, userId: string) {
  const { rows } = await query('SELECT * FROM conversations WHERE id=$1 AND user_id=$2', [convId, userId]);
  if (!rows[0]) throw new HttpError(404, 'Conversation not found');
  return rows[0];
}

r.get('/conversations', ah(async (req, res) => {
  const { rows } = await query(
    `SELECT id, title, course_id, updated_at FROM conversations WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 100`, [req.user!.id]);
  res.json(rows);
}));

r.post('/conversations', ah(async (req, res) => {
  const b = validate(z.object({ courseId: z.number().int().optional() }), req.body ?? {});
  const { rows } = await query(`INSERT INTO conversations(user_id, course_id) VALUES ($1,$2) RETURNING id, title, course_id, updated_at`,
    [req.user!.id, b.courseId ?? null]);
  res.status(201).json(rows[0]);
}));

r.get('/conversations/:id', ah(async (req, res) => {
  const conv = await owned(z.string().uuid().parse(req.params.id), req.user!.id);
  const { rows } = await query(`SELECT id, role, content, sources, answered, created_at FROM messages WHERE conversation_id=$1 ORDER BY id`, [conv.id]);
  res.json({ ...conv, messages: rows });
}));

r.patch('/conversations/:id', ah(async (req, res) => {
  const conv = await owned(z.string().uuid().parse(req.params.id), req.user!.id);
  const b = validate(z.object({ title: z.string().trim().min(1).max(100) }), req.body);
  await query('UPDATE conversations SET title=$2 WHERE id=$1', [conv.id, b.title]);
  res.json({ ok: true });
}));

r.delete('/conversations/:id', ah(async (req, res) => {
  const conv = await owned(z.string().uuid().parse(req.params.id), req.user!.id);
  await query('DELETE FROM conversations WHERE id=$1', [conv.id]);
  res.status(204).end();
}));

r.post('/conversations/:id/messages', chatLimiter, ah(async (req, res) => {
  const conv = await owned(z.string().uuid().parse(req.params.id), req.user!.id);
  const b = validate(z.object({ content: z.string().trim().min(1).max(2000), lang: z.enum(['sq', 'en']).default('sq') }), req.body);

  const hist = await query<{ role: 'user' | 'assistant'; content: string }>(
    'SELECT role, content FROM messages WHERE conversation_id=$1 ORDER BY id DESC LIMIT 8', [conv.id]);
  const history = hist.rows.reverse();

  // Follow-up questions ("and the deadline?") retrieve better with the previous user turn attached.
  const lastUser = [...history].reverse().find(m => m.role === 'user')?.content;
  const retrievalQuery = lastUser && b.content.length < 80 ? `${lastUser}\n${b.content}` : b.content;

  const ctx = (await retrieve(retrievalQuery, req.user!)).filter(c => c.score >= config.RAG_MIN_SCORE);
  const a = await answer(b.content, ctx, history, b.lang);

  // Number sources in the same order as the [n] markers in the answer text
  const sources = a.usedSources.map(i => ({ n: i + 1, documentId: ctx[i].documentId, title: ctx[i].title, page: ctx[i].page }));

  await query(`INSERT INTO messages(conversation_id, role, content) VALUES ($1,'user',$2)`, [conv.id, b.content]);
  const { rows } = await query(
    `INSERT INTO messages(conversation_id, role, content, sources, answered) VALUES ($1,'assistant',$2,$3,$4)
     RETURNING id, role, content, sources, answered, created_at`,
    [conv.id, a.text, JSON.stringify(sources), a.answered]);
  await query(`UPDATE conversations SET updated_at=now(), title=CASE WHEN title='Bisedë e re' THEN $2 ELSE title END WHERE id=$1`,
    [conv.id, titleFrom(b.content)]);
  res.json(rows[0]);
}));

export default r;
