import { config, EMBED_DIM } from '../config.js';

/**
 * Embeddings provider.
 * - VOYAGE_API_KEY set → Voyage AI (Anthropic's recommended embeddings partner), 1024 dims.
 * - otherwise → deterministic local feature-hashing embeddings (offline dev/testing).
 *   Quality is lexical, not semantic; FTS in rag.ts compensates. Re-run `npm run seed`
 *   after switching providers so stored vectors match.
 */
export const embeddingProvider = config.VOYAGE_API_KEY ? 'voyage' : 'local';

export async function embed(texts: string[], kind: 'document' | 'query'): Promise<number[][]> {
  if (embeddingProvider === 'voyage') return voyage(texts, kind);
  return texts.map(localEmbed);
}

async function voyage(texts: string[], kind: 'document' | 'query'): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 64) {
    const res = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.VOYAGE_API_KEY}` },
      body: JSON.stringify({ input: texts.slice(i, i + 64), model: config.VOYAGE_MODEL, input_type: kind }),
    });
    if (!res.ok) throw new Error(`Voyage embeddings failed: ${res.status} ${await res.text()}`);
    const j = (await res.json()) as { data: { embedding: number[] }[] };
    out.push(...j.data.map(d => d.embedding));
  }
  return out;
}

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
function hash(s: string) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

export function localEmbed(text: string): number[] {
  const v = new Array(EMBED_DIM).fill(0);
  const words = fold(text).match(/[a-z0-9]{2,}/g) ?? [];
  const add = (f: string, w: number) => { const h = hash(f); v[h % EMBED_DIM] += (h & 1 ? 1 : -1) * w; };
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    add(w.slice(0, 6), 1);                                  // crude stem
    for (let j = 0; j + 3 <= w.length; j++) add('#' + w.slice(j, j + 3), 0.3);
    if (i + 1 < words.length) add(w.slice(0, 5) + '_' + words[i + 1].slice(0, 5), 0.5);
  }
  const n = Math.hypot(...v) || 1;
  return v.map(x => x / n);
}
