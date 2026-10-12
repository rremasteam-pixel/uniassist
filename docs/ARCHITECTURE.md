# UniAssist — Architecture

AI assistant for **Shkolla e Mesme Profesionale "Beqir Çela"** (Durrës). The original brief targeted a
university; it is adapted to the school's real structure: *nxënës* (students), *mësues* (teachers,
theory/practice instructors), administration, 5 vocational programs, 4 departments + 2 subject teams,
Matura and level exams, professional practicum.

```
┌──────────────── client (React + TS + Tailwind, Vite) ────────────────┐
│ Auth pages · Role dashboards · Chat · Docs · Search · i18n SQ/EN     │
│ Light/Dark · Toasts · Loading/empty/error states                     │
└───────────────▲──────────────────────────────────────────────────────┘
                │ REST /api (JWT bearer)
┌───────────────┴──────────────── server (Node + Express + TS) ────────┐
│ middleware: helmet, rate-limit, JWT auth, requireRole, zod validate  │
│ routes: auth · chat · documents · dashboard · search · academics     │
│         announcements · notifications · profile                      │
│ services:                                                            │
│   pdf.ts      PDF → per-page text (pdf.js)                        │
│   chunk.ts    page-aware chunking (~600 chars, 120 overlap)          │
│   embeddings  Voyage (voyage-3, 1024d)  | offline hashing fallback   │
│   rag.ts      hybrid search: pgvector cosine + Postgres FTS          │
│               access filter (visibility/course enrollment)           │
│               relevance threshold → "not available" (no invention)   │
│   llm.ts      Claude (grounded prompt, cites [n]) | extractive fallbk │
└───────────────▲──────────────────────────────────────────────────────┘
                │ pg
┌───────────────┴──────── PostgreSQL 16 + pgvector ────────────────────┐
│ see server/db/schema.sql                                             │
└──────────────────────────────────────────────────────────────────────┘
```

## RAG pipeline
1. Admin/teacher uploads PDF (or .txt/.md) → stored on disk (`server/uploads`, never served statically).
2. Text extracted per page → chunked with page number kept.
3. Each chunk embedded → `document_chunks.embedding vector(1024)` + generated `tsvector`.
4. Question → embedded → top-k by cosine, merged with FTS rank, filtered by what the user may read.
5. If the best score is under `RAG_MIN_SCORE` the assistant says the information is not in official documents.
6. Otherwise Claude answers **only** from the excerpts, citing `[1]`, `[2]`; the API returns
   `sources: [{title, page}]` rendered as “Burimi: <title>, faqe 12”.
7. Replacing a document deactivates the old version (kept for audit, excluded from search).

## Roles & access
| Area | student | teacher | admin |
|---|---|---|---|
| Chat, search, public docs | ✓ | ✓ | ✓ |
| Course docs | enrolled only | own courses | ✓ |
| Staff docs | – | ✓ | ✓ |
| Upload course materials, announcements | – | own courses | ✓ |
| Student questions per course | – | own courses | ✓ |
| Document admin, stats | – | – | ✓ |

## Data provenance
Knowledge-base seed documents contain only content published on beqircela.edu.al (history, staff
2024–2025, programs, departments, leadership, contacts). Timetables, exams, enrollments and accounts
are clearly marked **demo data** — the assistant will not present them as official documents.
