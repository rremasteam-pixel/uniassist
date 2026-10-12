import { query, tx, toVector } from '../db.js';
import { extractPages } from './pdf.js';
import { chunkPages } from './chunk.js';
import { embed } from './embeddings.js';

/** PDF/text → pages → chunks → embeddings → document_chunks. Marks document ready/failed. */
export async function ingestDocument(documentId: string, filePath: string, mime: string) {
  try {
    const pages = await extractPages(filePath, mime);
    if (!pages.length) throw new Error('No extractable text (scanned PDF? run OCR first)');
    const chunks = chunkPages(pages);
    const vectors = await embed(chunks.map(c => c.content), 'document');
    await tx(async c => {
      await c.query('DELETE FROM document_chunks WHERE document_id=$1', [documentId]);
      for (let i = 0; i < chunks.length; i++) {
        await c.query(
          'INSERT INTO document_chunks(document_id, chunk_index, page, content, embedding) VALUES ($1,$2,$3,$4,$5)',
          [documentId, chunks[i].index, chunks[i].page, chunks[i].content, toVector(vectors[i])],
        );
      }
      await c.query(`UPDATE documents SET status='ready', error=NULL, page_count=$2 WHERE id=$1`,
        [documentId, Math.max(...pages.map(p => p.page))]);
    });
    return chunks.length;
  } catch (e: any) {
    await query(`UPDATE documents SET status='failed', error=$2 WHERE id=$1`, [documentId, String(e?.message ?? e).slice(0, 500)]);
    throw e;
  }
}
