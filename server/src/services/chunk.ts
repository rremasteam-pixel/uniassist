import type { PageText } from './pdf.js';

export interface Chunk { index: number; page: number; content: string; }

/**
 * Page-aware chunking: splits each page on paragraph/sentence boundaries into ~size chars
 * with overlap, so every chunk keeps an accurate page number for citations.
 */
export function chunkPages(pages: PageText[], size = 600, overlap = 120): Chunk[] {
  const out: Chunk[] = [];
  for (const { page, text } of pages) {
    const units = text.split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(Boolean);
    let buf = '';
    const flush = () => {
      if (buf.trim().length > 20) out.push({ index: out.length, page, content: buf.trim() });
      buf = buf.length > overlap ? buf.slice(-overlap).replace(/^\S*\s+/, '') : '';
    };
    for (const u of units) {
      if (u.length > size) {                       // very long unit: hard-split
        for (let i = 0; i < u.length; i += size - overlap) { buf += ' ' + u.slice(i, i + size); flush(); }
        continue;
      }
      if (buf.length + u.length + 1 > size) flush();
      buf += (buf ? ' ' : '') + u;
    }
    if (buf.trim().length > 20 && !out.at(-1)?.content.endsWith(buf.trim())) flush();
  }
  return out;
}
