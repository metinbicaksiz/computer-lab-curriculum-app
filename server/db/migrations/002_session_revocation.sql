-- Login tokens issued before this time are rejected. Bumped on logout,
-- password change/reset and when a teacher turns an account off, which
-- ends every session for that user straight away.
-- (Existing sessions end when this migration runs; everyone logs in again.)
ALTER TABLE users ADD COLUMN sessions_valid_after TIMESTAMPTZ NOT NULL DEFAULT now();
