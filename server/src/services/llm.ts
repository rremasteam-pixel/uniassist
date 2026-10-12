import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import { queryTerms, type Retrieved } from './rag.js';

export interface Answer { text: string; answered: boolean; usedSources: number[]; }
type Turn = { role: 'user' | 'assistant'; content: string };

const client = config.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: config.ANTHROPIC_API_KEY }) : null;
export const llmProvider = client ? 'claude' : 'extractive';

const NOT_FOUND = {
  sq: 'Nuk e gjeta këtë informacion në dokumentet zyrtare të shkollës. Ju lutem kontaktoni sekretarinë (052 26 45 28, bcelamt@yahoo.com, Hënë–Premte 07:40–16:00).',
  en: "I couldn't find this in the school's official documents. Please contact the secretary's office (052 26 45 28, bcelamt@yahoo.com, Mon–Fri 07:40–16:00).",
};

const SYSTEM = (lang: 'sq' | 'en') => `You are UniAssist, the official information assistant of Shkolla e Mesme Profesionale "Beqir Çela" (Durrës, Albania).
Rules — follow strictly:
1. Answer ONLY using the numbered EXCERPTS provided in the latest user turn. Never use outside knowledge about the school.
2. Cite every factual claim with its excerpt number in square brackets, e.g. [1] or [2][3].
3. If the excerpts do not contain the answer, reply exactly with the token NOT_FOUND and nothing else. Do not guess dates, names, rules or numbers.
4. If the excerpts answer only part of the question, answer that part and state clearly what is not covered.
5. Be concise and clear; use short lists when helpful.
6. Reply in ${lang === 'sq' ? 'Albanian (shqip)' : 'English'}.`;

export async function answer(question: string, ctx: Retrieved[], history: Turn[], lang: 'sq' | 'en'): Promise<Answer> {
  if (ctx.length === 0) return { text: NOT_FOUND[lang], answered: false, usedSources: [] };
  if (!client) return extractive(question, ctx, lang);

  const excerpts = ctx.map((c, i) => `[${i + 1}] (${c.title}${c.page ? `, p.${c.page}` : ''})\n${c.content}`).join('\n\n');
  const msg = await client.messages.create({
    model: config.ANTHROPIC_MODEL,
    max_tokens: 900,
    temperature: 0,
    system: SYSTEM(lang),
    messages: [
      ...history.slice(-8),
      { role: 'user', content: `EXCERPTS:\n${excerpts}\n\nQUESTION: ${question}` },
    ],
  });
  const text = msg.content.map(b => (b.type === 'text' ? b.text : '')).join('').trim();
  if (!text || text.startsWith('NOT_FOUND')) return { text: NOT_FOUND[lang], answered: false, usedSources: [] };
  const used = [...new Set([...text.matchAll(/\[(\d+)\]/g)].map(m => Number(m[1]) - 1))].filter(i => i >= 0 && i < ctx.length);
  return { text, answered: true, usedSources: used.length ? used : [0] };
}

/** Offline mode: quote the best-matching sentences verbatim (never paraphrases → never invents). */
function extractive(question: string, ctx: Retrieved[], lang: 'sq' | 'en'): Answer {
  const fold = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const terms = queryTerms(question).map(w => new RegExp(`(^|[^a-z0-9])${w.slice(0, 6)}`));
  const scored: { s: string; i: number; score: number }[] = [];
  ctx.slice(0, 3).forEach((c, i) => {
    for (const s of c.content.split(/(?<=[.!?])\s+|\n+/)) {
      const f = fold(s);
      const score = terms.filter(t => t.test(f)).length;
      if (score > 0 && s.length > 15) scored.push({ s: s.trim(), i, score: score - i * 0.1 });
    }
  });
  const best = scored.sort((a, b) => b.score - a.score).slice(0, 3);
  if (!best.length) return { text: NOT_FOUND[lang], answered: false, usedSources: [] };
  const head = lang === 'sq'
    ? 'Modalitet pa AI (pa çelës API). Fragmentet përkatëse nga dokumentet zyrtare:'
    : 'Offline mode (no AI key). Relevant passages from official documents:';
  return {
    text: `${head}\n\n${best.map(b => `- ${b.s} [${b.i + 1}]`).join('\n')}`,
    answered: true,
    usedSources: [...new Set(best.map(b => b.i))],
  };
}

/** Short conversation title from the first question. */
export const titleFrom = (q: string) => (q.length > 60 ? q.slice(0, 57) + '…' : q);
