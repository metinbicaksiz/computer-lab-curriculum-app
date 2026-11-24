CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('student', 'teacher')),
  grade         INT CHECK (grade BETWEEN 1 AND 12),
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ranked belts: you must finish every lesson of belt N before belt N+1 opens.
CREATE TABLE belts (
  id          SERIAL PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL,          -- hex, used for the badge
  rank        INT  NOT NULL UNIQUE,   -- 1 = first belt
  focus       TEXT NOT NULL,          -- e.g. "Blocks", "JavaScript"
  description TEXT NOT NULL
);

-- "core" is the main belt path; the others are specialty tracks that open
-- once the student has earned min_belt_rank.
CREATE TABLE tracks (
  id            SERIAL PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL,
  min_belt_rank INT  NOT NULL DEFAULT 0,
  position      INT  NOT NULL DEFAULT 0
);

CREATE TABLE lessons (
  id              SERIAL PRIMARY KEY,
  slug            TEXT NOT NULL UNIQUE,
  track_id        INT  NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  belt_id         INT  REFERENCES belts(id) ON DELETE CASCADE, -- core lessons only
  position        INT  NOT NULL,
  title           TEXT NOT NULL,
  -- kind decides how a lesson is passed: code = output check, quiz = server-graded,
  -- capstone = teacher approval. language decides which editor the student gets.
  kind            TEXT NOT NULL CHECK (kind IN ('code', 'quiz', 'capstone')),
  language        TEXT NOT NULL DEFAULT 'javascript' CHECK (language IN ('blocks', 'javascript', 'python', 'html')),
  instructions    TEXT NOT NULL,      -- markdown-ish text
  starter_code    TEXT NOT NULL DEFAULT '',
  expected_output TEXT,               -- exact output to pass; for html: CSS selectors, one per line
  hints           JSONB NOT NULL DEFAULT '[]',
  quiz            JSONB,              -- [{question, options[], answer}] for kind = quiz
  xp              INT NOT NULL DEFAULT 10
);
CREATE INDEX lessons_track_idx ON lessons (track_id, belt_id, position);

-- status: started -> completed, or for capstones started -> submitted -> completed
CREATE TABLE progress (
  user_id      INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id    INT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  status       TEXT NOT NULL CHECK (status IN ('started', 'submitted', 'completed')),
  code         TEXT NOT NULL DEFAULT '',
  attempts     INT  NOT NULL DEFAULT 0,
  feedback     TEXT,
  completed_at TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lesson_id)
);
