# UniAssist — Asistenti AI i shkollës "Beqir Çela"

AI information assistant for **Shkolla e Mesme Profesionale "Beqir Çela"** (Durrës). Students, teachers
and administrators ask questions in Albanian or English; answers come **only** from the school's
official documents, with a source and page for every answer. When the documents don't cover a
question, the assistant says so and points to the secretary's office instead of guessing.

> The original brief described a university. Beqir Çela is a vocational secondary school, so the
> model uses its real structure: students (*nxënës*), teachers / instructors, 5 vocational programs,
> 4 departments + 2 subject teams, class groups, Matura and level exams, practicum.

**Stack:** React 18 + TypeScript + Tailwind (Vite) · Node 20+ / Express REST API (TypeScript) ·
PostgreSQL 16 + pgvector · Claude (answers) · Voyage AI (embeddings) · pdf.js (PDF text extraction).

## Quick start

```bash
# 1. Database (Postgres 16 + pgvector)
docker compose up -d db

# 2. API
cd server
cp .env.example .env          # set JWT_SECRET; optionally ANTHROPIC_API_KEY and VOYAGE_API_KEY
npm install
npm run db:init               # DEV ONLY: drops & recreates the schema
npm run seed                  # real school info + demo accounts/timetables, ingests the knowledge base
npm run dev                   # http://localhost:4000

# 3. Web app (new terminal)
cd client
npm install
npm run dev                   # http://localhost:5173  (proxies /api → :4000)
```

| Role | Email | Password |
|---|---|---|
| Student (TIK 11-A) | `nxenes@uniassist.demo` | `Nxenes2026!` |
| Teacher (ICT) | `mesues.tik@uniassist.demo` | `Mesues2026!` |
| Teacher (Electrical) | `mesues.ele@uniassist.demo` | `Mesues2026!` |
| Admin | `admin@uniassist.demo` | `Admin2026!` |

### AI modes
- **Full mode** — set `ANTHROPIC_API_KEY` (Claude writes grounded answers with `[n]` citations) and
  `VOYAGE_API_KEY` (semantic embeddings). After setting/changing `VOYAGE_API_KEY`, re-run
  `npm run db:init && npm run seed` so stored vectors match the provider.
- **Offline mode** (no keys) — local lexical embeddings + full-text search, and the assistant quotes the
  matching sentences verbatim. Useful for development; it never paraphrases, so it cannot invent facts.

`GET /api/health` reports which mode is active.

## What's real vs. demo
- **Real (from beqircela.edu.al):** history, address/phone/email/office hours, leadership, 2024–2025 staff
  list, programs, departments, Matura/self-assessment report listings. These are the knowledge-base
  documents, each with its source URL.
- **Demo:** class groups, courses, timetables, exams, enrollments and the login accounts above. They are
  labelled "Të dhëna demo" in the UI and are **not** in the knowledge base, so the assistant will not
  present them as official.
- Staff from the official list are directory entries that cannot log in (`*@beqircela.invalid`).
- The site does not publish rules such as attendance policy or exam registration procedures, so the
  assistant correctly answers "not available" for those until the school uploads the regulations. The
  admin dashboard lists those unanswered questions so the school knows which documents to add.

## Architecture
See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and the full schema in
[`server/db/schema.sql`](server/db/schema.sql).

```
PDF/TXT/MD upload → pdf.js text per page → page-aware chunks (~600 chars, overlap)
  → embeddings (Voyage 1024-d | local) → document_chunks (pgvector HNSW + unaccented FTS)
Question → embed → hybrid search (cosine + full-text), filtered by the user's document access
  → below RAG_MIN_SCORE → "not available"
  → else Claude answers only from excerpts, citing [n] → sources {title, page} shown under the answer
```

### Project layout
```
server/
  db/schema.sql            tables, indexes, pgvector, unaccent
  src/index.ts             Express app, security middleware, route mounting
  src/middleware/          JWT auth, requireRole, zod validation, error handler
  src/services/            pdf · chunk · embeddings · rag · llm · ingest
  src/routes/              auth · chat · documents · academics · misc (announcements, notifications,
                           profile, dashboard, search, users)
  src/seed/                seed.ts + kb/*.md (knowledge base from the official site)
client/src/
  lib/                     api client, auth, i18n (SQ/EN), UI kit (toasts, modal, states, theme)
  components/Layout.tsx    sidebar, top bar, global search, theme & language toggles
  pages/                   Auth · Dashboard (student/teacher/admin) · Chat · Documents · Academics
                           (courses, schedule, exams, directory) · Communication (announcements,
                           notifications, student questions) · Account (profile, search, users)
```

## API overview (all under `/api`, JWT bearer unless noted)
| Method | Path | Access |
|---|---|---|
| POST | `/auth/register`, `/auth/login` (public, rate-limited) · GET `/auth/me`, `/auth/options` | all |
| GET/POST/PATCH/DELETE | `/chat/conversations[/:id]`, POST `/chat/conversations/:id/messages` | owner only |
| GET | `/documents`, `/documents/categories`, `/documents/:id/file` | access-filtered |
| POST | `/documents` (multipart) | admin; teacher → own courses only |
| POST | `/documents/:id/replace`, `/documents/:id/reprocess` | admin |
| DELETE | `/documents/:id` | admin; teacher → own uploads |
| GET | `/academics/courses · schedule · exams · departments · teachers` | role-scoped |
| GET | `/academics/questions` | teacher (own courses), admin |
| GET/POST/DELETE | `/announcements` | read all; post teacher (own course) / admin |
| GET/POST | `/notifications`, `/notifications/read-all`, `/notifications/:id/read` | self |
| PATCH/POST | `/profile`, `/profile/password` | self |
| GET | `/dashboard/admin` (admin) · `/dashboard/summary` | |
| GET | `/search?q=` | access-filtered |
| GET/PATCH | `/users` | admin |

## Security
- Passwords hashed with bcrypt (cost 12); password policy enforced server-side.
- JWT auth on every non-auth route; role checks via `requireRole`; per-resource checks (conversation
  ownership, course teaching assignments, uploader ownership).
- Document access rule is shared by the chatbot, listing, search and file download: `public` → all,
  `staff` → teachers/admin, `course` → enrolled class groups, assigned teachers, admin. Files are stored
  under random names outside any static path and only streamed after that check.
- Uploads: MIME allow-list, PDF magic-byte check, size limit, client filename never used on disk.
- zod validation on all inputs, parameterised SQL everywhere, helmet headers, CORS locked to the client
  origin, rate limits on auth and chat, generic login errors.

### Before production
- Self-registration currently lets a student pick their class group (which grants course-material
  access). For production, have the school import students/classes or approve registrations, and add
  email verification.
- Move tokens to httpOnly cookies + CSRF protection if the app is served from the same origin.
- Run ingestion in a background queue for large PDFs (it is synchronous today), add OCR for scanned PDFs,
  and use migrations (e.g. node-pg-migrate) instead of `db:init`.
- Upload the school's actual regulations, academic calendar and exam rules — the assistant can only
  answer what is in the documents.
