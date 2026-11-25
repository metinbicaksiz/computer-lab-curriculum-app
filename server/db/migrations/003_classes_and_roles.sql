-- Roles: one superadmin (creates users and classes), teachers (follow the
-- students in their classes) and students.
ALTER TABLE users DROP CONSTRAINT users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('student', 'teacher', 'superadmin'));
-- Only one superadmin account can exist.
CREATE UNIQUE INDEX users_one_superadmin ON users (role) WHERE role = 'superadmin';

CREATE TABLE classes (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Which teachers follow which classes. The API keeps at least one teacher on every class.
CREATE TABLE class_teachers (
  class_id   INT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (class_id, teacher_id)
);
CREATE INDEX class_teachers_teacher_idx ON class_teachers (teacher_id);

-- Every student belongs to exactly one class; nobody else has one.
-- A class with students in it can't be deleted.
ALTER TABLE users ADD COLUMN class_id INT REFERENCES classes(id) ON DELETE RESTRICT;
CREATE INDEX users_class_idx ON users (class_id);

-- Students who exist before this migration go into a "General" class, followed
-- by every existing teacher, so nobody loses access to their progress.
DO $$
DECLARE general_id INT;
BEGIN
  IF EXISTS (SELECT 1 FROM users WHERE role = 'student') THEN
    INSERT INTO classes (name) VALUES ('General') RETURNING id INTO general_id;
    UPDATE users SET class_id = general_id WHERE role = 'student';
    INSERT INTO class_teachers (class_id, teacher_id)
      SELECT general_id, id FROM users WHERE role = 'teacher';
  END IF;
END $$;

ALTER TABLE users ADD CONSTRAINT users_class_by_role
  CHECK ((role = 'student') = (class_id IS NOT NULL));
