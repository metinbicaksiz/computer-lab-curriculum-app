import bcrypt from "bcryptjs";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { requireStaff } from "../auth.ts";
import { query } from "../db.ts";
import { getPath } from "../progression.ts";

/**
 * SQL condition limiting `u` (a users row) to students this person may see:
 * a teacher sees the students in their own classes, the superadmin sees every student.
 * `param` is the placeholder number the user id goes into.
 */
function visibleStudents(req: FastifyRequest, param: number) {
  if (req.user.role === "superadmin") return { sql: `u.role = 'student' AND $${param}::int IS NOT NULL`, id: req.user.id };
  return {
    sql: `u.role = 'student' AND u.class_id IN (SELECT class_id FROM class_teachers WHERE teacher_id = $${param})`,
    id: req.user.id,
  };
}

export default async function teacherRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireStaff);

  // Classes this person follows (all classes for the superadmin), for the class filter.
  app.get("/api/teacher/classes", async (req) => query(
    req.user.role === "superadmin"
      ? "SELECT id, name FROM classes ORDER BY name"
      : `SELECT c.id, c.name FROM classes c JOIN class_teachers ct ON ct.class_id = c.id
          WHERE ct.teacher_id = $1 ORDER BY c.name`,
    req.user.role === "superadmin" ? [] : [req.user.id]));

  // Class overview: one row per visible student with belt progress.
  app.get("/api/teacher/students", async (req) => {
    const scope = visibleStudents(req, 1);
    const students = await query(
      `SELECT u.id, u.username, u.display_name, u.grade, u.active, u.class_id, c.name AS class_name,
              (SELECT max(updated_at) FROM progress p WHERE p.user_id = u.id) AS last_active
         FROM users u JOIN classes c ON c.id = u.class_id
        WHERE ${scope.sql} ORDER BY c.name, u.grade NULLS LAST, u.display_name`, [scope.id]);
    // getPath is a few small queries; fine for a lab of ~30-60 students.
    return Promise.all(students.map(async (s) => {
      const path = await getPath(s.id);
      return {
        ...s,
        earnedRank: path.earnedRank,
        xp: path.xp,
        belts: path.belts.map((b) => ({
          slug: b.slug,
          done: b.lessons.filter((l) => l.status === "completed").length,
          total: b.lessons.length,
        })),
        waitingReview: [...path.belts, ...path.tracks].some((g) => g.lessons.some((l) => l.status === "submitted")),
      };
    }));
  });

  // Teachers can reset a password for a student in their class. Creating accounts,
  // moving students between classes and turning accounts off are superadmin jobs (/api/admin).
  app.post<{ Params: { id: string } }>("/api/teacher/students/:id/password", async (req, reply) => {
    const body = z.object({ password: z.string().min(4) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "Password must be at least 4 characters." });
    const scope = visibleStudents(req, 3);
    const rows = await query(
      // A password reset logs the student out everywhere.
      `UPDATE users u SET password_hash = $2, sessions_valid_after = clock_timestamp()
        WHERE u.id = $1 AND ${scope.sql} RETURNING u.id`,
      [req.params.id, await bcrypt.hash(body.data.password, 10), scope.id]);
    if (!rows.length) return reply.code(404).send({ error: "Student not found." });
    return { ok: true };
  });

  // Everything one student has done, including their code.
  app.get<{ Params: { id: string } }>("/api/teacher/students/:id", async (req, reply) => {
    const scope = visibleStudents(req, 2);
    const [student] = await query(
      `SELECT u.id, u.username, u.display_name, u.grade, u.active, u.class_id, c.name AS class_name
         FROM users u JOIN classes c ON c.id = u.class_id
        WHERE u.id = $1 AND ${scope.sql}`, [req.params.id, scope.id]);
    if (!student) return reply.code(404).send({ error: "Student not found." });
    const [path, work] = await Promise.all([
      getPath(student.id),
      query("SELECT lesson_id, code, attempts, feedback, updated_at FROM progress WHERE user_id = $1", [student.id]),
    ]);
    return { student, path, work };
  });

  // Capstones waiting for approval, from visible students only.
  app.get("/api/teacher/reviews", async (req) => {
    const scope = visibleStudents(req, 1);
    return query(
      `SELECT p.user_id, p.lesson_id, p.code, p.updated_at, u.display_name, u.username, u.class_id, c.name AS class_name,
              l.title, l.slug, l.language
         FROM progress p JOIN users u ON u.id = p.user_id JOIN lessons l ON l.id = p.lesson_id
         JOIN classes c ON c.id = u.class_id
        WHERE p.status = 'submitted' AND ${scope.sql} ORDER BY p.updated_at`, [scope.id]);
  });

  app.post<{ Params: { userId: string; lessonId: string } }>(
    "/api/teacher/reviews/:userId/:lessonId",
    async (req, reply) => {
      const body = z.object({ approve: z.boolean(), feedback: z.string().max(5000).optional() }).safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: "Bad request." });
      const scope = visibleStudents(req, 5);
      const rows = await query(
        `UPDATE progress SET status = $3, feedback = $4, updated_at = now(),
                completed_at = CASE WHEN $3 = 'completed' THEN now() ELSE completed_at END
          WHERE user_id = $1 AND lesson_id = $2 AND status = 'submitted'
            AND user_id IN (SELECT u.id FROM users u WHERE ${scope.sql})
          RETURNING user_id`,
        [req.params.userId, req.params.lessonId, body.data.approve ? "completed" : "started",
         body.data.feedback ?? null, scope.id]);
      if (!rows.length) return reply.code(404).send({ error: "Nothing waiting for review." });
      return { ok: true };
    },
  );
}
