import { readFile } from 'node:fs/promises';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

export interface PageText { page: number; text: string; }

/** Extract text per page (pdf.js). Plain text / markdown: pages split on form-feed. */
export async function extractPages(path: string, mime: string): Promise<PageText[]> {
  const buf = await readFile(path);
  if (mime === 'application/pdf') {
    const pdf = await getDocument({ data: new Uint8Array(buf), useSystemFonts: true, isEvalSupported: false, verbosity: 0 }).promise;
    const pages: PageText[] = [];
    try {
      for (let i = 1; i <= pdf.numPages; i++) {
        const tc = await (await pdf.getPage(i)).getTextContent();
        let last: number | undefined; let s = '';
        for (const it of tc.items as any[]) {
          if (!('str' in it)) continue;
          const y = it.transform[5];
          s += (last !== undefined && Math.abs(y - last) > 2 ? '\n' : ' ') + it.str;
          last = y;
        }
        pages.push({ page: i, text: clean(s) });
      }
    } finally { await pdf.destroy(); }
    return pages.filter(p => p.text.length > 0);
  }
  const text = buf.toString('utf8');
  return text.split('\f').map((t, i) => ({ page: i + 1, text: clean(t) })).filter(p => p.text.length > 0);
}

const clean = (s: string) => s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
