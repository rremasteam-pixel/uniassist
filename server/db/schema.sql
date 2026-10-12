-- UniAssist schema · PostgreSQL 16 + pgvector
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Immutable wrapper so it can be used in generated columns (ë→e, ç→c for Albanian search)
CREATE OR REPLACE FUNCTION unaccent_simple(t text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, lower(t)) $$;

CREATE TABLE roles (
  id   SMALLINT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL CHECK (name IN ('student','teacher','admin'))
);
INSERT INTO roles VALUES (1,'student'),(2,'teacher'),(3,'admin') ON CONFLICT DO NOTHING;

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL CHECK (email = lower(email)),
  password_hash TEXT NOT NULL,
  first_name    TEXT NOT NULL,
  last_name     TEXT NOT NULL,
  role_id       SMALLINT NOT NULL REFERENCES roles(id),
  locale        TEXT NOT NULL DEFAULT 'sq' CHECK (locale IN ('sq','en')),
  phone         TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

CREATE TABLE departments (
  id          SERIAL PRIMARY KEY,
  code        TEXT UNIQUE NOT NULL,
  name_sq     TEXT NOT NULL,
  name_en     TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('department','subject_team')),
  head_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  source_url  TEXT
);

-- Vocational programs (drejtime)
CREATE TABLE programs (
  id            SERIAL PRIMARY KEY,
  code          TEXT UNIQUE NOT NULL,
  name_sq       TEXT NOT NULL,
  name_en       TEXT NOT NULL,
  department_id INT REFERENCES departments(id),
  source_url    TEXT
);

CREATE TABLE class_groups (               -- e.g. "TIK 11-A"
  id         SERIAL PRIMARY KEY,
  name       TEXT UNIQUE NOT NULL,
  program_id INT NOT NULL REFERENCES programs(id),
  grade      SMALLINT NOT NULL CHECK (grade BETWEEN 10 AND 13),
  school_year TEXT NOT NULL
);

CREATE TABLE students (
  user_id        UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  student_number TEXT UNIQUE NOT NULL,
  class_group_id INT REFERENCES class_groups(id),
  enrolled_year  SMALLINT
);

CREATE TABLE teachers (
  user_id       UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  position      TEXT NOT NULL,              -- e.g. "mësues teorie", "instruktor"
  department_id INT REFERENCES departments(id),
  office        TEXT
);

CREATE TABLE courses (                    -- lëndë / module
  id            SERIAL PRIMARY KEY,
  code          TEXT UNIQUE NOT NULL,
  name_sq       TEXT NOT NULL,
  name_en       TEXT NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('general','theory','practice')),
  weekly_hours  SMALLINT NOT NULL DEFAULT 2,
  program_id    INT REFERENCES programs(id),
  department_id INT REFERENCES departments(id),
  description_sq TEXT,
  description_en TEXT
);

CREATE TABLE course_teachers (
  course_id INT  REFERENCES courses(id) ON DELETE CASCADE,
  user_id   UUID REFERENCES teachers(user_id) ON DELETE CASCADE,
  PRIMARY KEY (course_id, user_id)
);

CREATE TABLE enrollments (                -- class group takes course
  course_id      INT REFERENCES courses(id) ON DELETE CASCADE,
  class_group_id INT REFERENCES class_groups(id) ON DELETE CASCADE,
  PRIMARY KEY (course_id, class_group_id)
);

CREATE TABLE schedules (
  id             SERIAL PRIMARY KEY,
  course_id      INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  class_group_id INT NOT NULL REFERENCES class_groups(id) ON DELETE CASCADE,
  teacher_id     UUID REFERENCES teachers(user_id) ON DELETE SET NULL,
  weekday        SMALLINT NOT NULL CHECK (weekday BETWEEN 1 AND 5),
  start_time     TIME NOT NULL,
  end_time       TIME NOT NULL,
  room           TEXT,
  CHECK (end_time > start_time)
);

CREATE TABLE exams (
  id             SERIAL PRIMARY KEY,
  title          TEXT NOT NULL,
  kind           TEXT NOT NULL CHECK (kind IN ('matura','level','term','practicum')),
  course_id      INT REFERENCES courses(id) ON DELETE SET NULL,
  class_group_id INT REFERENCES class_groups(id) ON DELETE CASCADE,
  starts_at      TIMESTAMPTZ NOT NULL,
  room           TEXT,
  notes          TEXT,
  is_demo        BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE document_categories (
  id      SERIAL PRIMARY KEY,
  slug    TEXT UNIQUE NOT NULL,
  name_sq TEXT NOT NULL,
  name_en TEXT NOT NULL
);

CREATE TABLE documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  category_id   INT NOT NULL REFERENCES document_categories(id),
  visibility    TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','staff','course')),
  course_id     INT REFERENCES courses(id) ON DELETE CASCADE,
  file_path     TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type     TEXT NOT NULL,
  size_bytes    INT NOT NULL,
  page_count    INT,
  source_url    TEXT,
  status        TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','ready','failed')),
  error         TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  replaces_id   UUID REFERENCES documents(id) ON DELETE SET NULL,
  uploaded_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (visibility <> 'course' OR course_id IS NOT NULL)
);
CREATE INDEX documents_active_idx ON documents(is_active, status);

CREATE TABLE document_chunks (
  id          BIGSERIAL PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  page        INT,
  content     TEXT NOT NULL,
  embedding   vector(1024),
  tsv         tsvector GENERATED ALWAYS AS (to_tsvector('simple', unaccent_simple(content))) STORED
);
CREATE INDEX chunks_doc_idx ON document_chunks(document_id);
CREATE INDEX chunks_tsv_idx ON document_chunks USING GIN (tsv);
CREATE INDEX chunks_vec_idx ON document_chunks USING hnsw (embedding vector_cosine_ops);

CREATE TABLE conversations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL DEFAULT 'Bisedë e re',
  course_id  INT REFERENCES courses(id) ON DELETE SET NULL,  -- optional context
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX conversations_user_idx ON conversations(user_id, updated_at DESC);

CREATE TABLE messages (
  id              BIGSERIAL PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content         TEXT NOT NULL,
  sources         JSONB NOT NULL DEFAULT '[]',
  answered        BOOLEAN,                 -- assistant: found grounding?
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX messages_conv_idx ON messages(conversation_id, id);

CREATE TABLE announcements (
  id         SERIAL PRIMARY KEY,
  author_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  course_id  INT REFERENCES courses(id) ON DELETE CASCADE,  -- NULL = school-wide
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  body       TEXT,
  link       TEXT,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON notifications(user_id, created_at DESC);
