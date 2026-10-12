import { query, toVector } from '../db.js';
import { config } from '../config.js';
import { embed, embeddingProvider } from './embeddings.js';
import type { AuthUser } from '../middleware/auth.js';

export interface Retrieved {
  chunkId: number; documentId: string; title: string; page: number | null;
  content: string; score: number;
}

/**
 * SQL fragment restricting documents to what `user` may read.
 * public → everyone · staff → teachers/admin · course → enrolled students, assigned teachers, admin.
 */
export function accessFilter(alias: string, user: AuthUser, userParam: string) {
  if (user.role === 'admin') return 'TRUE';
  if (user.role === 'teacher') return `(${alias}.visibility IN ('public','staff')
     OR (${alias}.visibility='course' AND ${alias}.course_id IN
         (SELECT course_id FROM course_teachers WHERE user_id=${userParam})))`;
  return `(${alias}.visibility='public'
     OR (${alias}.visibility='course' AND ${alias}.course_id IN
         (SELECT e.course_id FROM enrollments e JOIN students s ON s.class_group_id=e.class_group_id
          WHERE s.user_id=${userParam})))`;
}

const STOP = new Set(['dhe','ose','per','nga','te','ne','me','eshte','jane','cfare','cili','cila','kush','si','ku','kur','sa',
  'shkolla','shkolles','shkollen','shkolle','beqir','cela','the','and','school','for','what','who','how','where','when','is','are','of','to','in','a','an','do','does','i','my']);

/** OR-tsquery of prefix terms (accent-folded) so partial matches still rank. */
export function queryTerms(q: string) {
  return (q.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/[a-z0-9]{3,}/g) ?? [])
    .filter(w => !STOP.has(w) && !w.startsWith('shkoll')).slice(0, 12);
}
export function orQuery(q: string) {
  const words = queryTerms(q);
  return words.length ? words.map(w => `${w.slice(0, 6)}:*`).join(' | ') : 'zzzznomatch';
}

/** Hybrid retrieval: vector cosine similarity blended with full-text rank. */
export async function retrieve(question: string, user: AuthUser, k = config.RAG_TOP_K): Promise<Retrieved[]> {
  const [qv] = await embed([question], 'query');
  const vecWeight = embeddingProvider === 'voyage' ? 0.75 : 0.45;
  const { rows } = await query<any>(
    `WITH q AS (SELECT $1::vector AS v, to_tsquery('simple', $2) AS t)
     SELECT c.id, c.document_id, d.title, c.page, c.content,
            (1 - (c.embedding <=> q.v)) AS vec,
            ts_rank_cd(c.tsv, q.t) AS fts
     FROM document_chunks c
     JOIN documents d ON d.id = c.document_id, q
     WHERE d.is_active AND d.status='ready' AND ${accessFilter('d', user, '$3')}
     ORDER BY c.embedding <=> q.v
     LIMIT 40`,
    [toVector(qv), orQuery(question), user.id],
  );
  return rows
    .map(r => {
      const fts = Math.min(1, Number(r.fts) * 4);
      // Offline (lexical) embeddings are not trustworthy on their own: require a keyword hit.
      const grounded = embeddingProvider === 'voyage' || Number(r.fts) > 0;
      return {
        chunkId: Number(r.id), documentId: r.document_id, title: r.title, page: r.page,
        content: r.content, score: grounded ? vecWeight * Number(r.vec) + (1 - vecWeight) * fts : 0,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
