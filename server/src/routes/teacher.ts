import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireTeacher } from "../auth.ts";
import { pool, query } from "../db.ts";
import { getPath } from "../progression.ts";

const username = z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{2,32}$/, "letters, numbers, . _ - only");
const newStudent = z.object({
  username,
  displayName: z.string().trim().min(1).max(60),
  grade: z.number().int().min(1).max(12).nullable().optional(),
  password: z.string().min(4),
});

export default async function teacherRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireTeacher);

  // Class overview: one row per student with belt progress.
  app.get("/api/teacher/students", async () => {
    const students = await query(
      `SELECT u.id, u.username, u.display_name, u.grade, u.active,
              (SELECT max(updated_at) FROM progress p WHERE p.user_id = u.id) AS last_active
         FROM users u WHERE role = 'student' ORDER BY u.grade NULLS LAST, u.display_name`);
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

  // Add one or many students (bulk import from a pasted list).
  app.post("/api/teacher/students", async (req, reply) => {
    const body = z.object({ students: z.array(newStudent).min(1).max(500) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.issues[0]?.message ?? "Bad request." });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const s of body.data.students) {
        await client.query(
          "INSERT INTO users (username, display_name, grade, password_hash, role) VALUES ($1,$2,$3,$4,'student')",
          [s.username, s.displayName, s.grade ?? null, await bcrypt.hash(s.password, 10)]);
      }
      await client.query("COMMIT");
      return { created: body.data.students.length };
    } catch (err: any) {
      await client.query("ROLLBACK");
      if (err.code === "23505") return reply.code(409).send({ error: `Username already taken: ${err.detail ?? ""}` });
      throw err;
    } finally {
      client.release();
    }
  });

  app.patch<{ Params: { id: string } }>("/api/teacher/students/:id", async (req, reply) => {
    const body = z.object({
      displayName: z.string().trim().min(1).max(60).optional(),
      grade: z.number().int().min(1).max(12).nullable().optional(),
      password: z.string().min(4).optional(),
      active: z.boolean().optional(),
    }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.issues[0]?.message ?? "Bad request." });
    const d = body.data;
    const rows = await query(
      `UPDATE users SET
         display_name = COALESCE($2, display_name),
         grade = CASE WHEN $3::boolean THEN $4::int ELSE grade END,
         password_hash = COALESCE($5, password_hash),
         active = COALESCE($6, active),
         -- A password reset or turning the account off logs the student out everywhere.
         sessions_valid_after = CASE WHEN $5 IS NOT NULL OR $6 = false THEN clock_timestamp() ELSE sessions_valid_after END
       WHERE id = $1 AND role = 'student' RETURNING id`,
      [req.params.id, d.displayName ?? null, d.grade !== undefined, d.grade ?? null,
       d.password ? await bcrypt.hash(d.password, 10) : null, d.active ?? null]);
    if (!rows.length) return reply.code(404).send({ error: "Student not found." });
    return { ok: true };
  });

  // Everything one student has done, including their code.
  app.get<{ Params: { id: string } }>("/api/teacher/students/:id", async (req, reply) => {
    const [student] = await query(
      "SELECT id, username, display_name, grade, active FROM users WHERE id = $1 AND role = 'student'", [req.params.id]);
    if (!student) return reply.code(404).send({ error: "Student not found." });
    const [path, work] = await Promise.all([
      getPath(student.id),
      query("SELECT lesson_id, code, attempts, feedback, updated_at FROM progress WHERE user_id = $1", [student.id]),
    ]);
    return { student, path, work };
  });

  // Capstones waiting for approval.
  app.get("/api/teacher/reviews", async () => query(
    `SELECT p.user_id, p.lesson_id, p.code, p.updated_at, u.display_name, u.username, l.title, l.slug, l.language
       FROM progress p JOIN users u ON u.id = p.user_id JOIN lessons l ON l.id = p.lesson_id
      WHERE p.status = 'submitted' ORDER BY p.updated_at`));

  app.post<{ Params: { userId: string; lessonId: string } }>(
    "/api/teacher/reviews/:userId/:lessonId",
    async (req, reply) => {
      const body = z.object({ approve: z.boolean(), feedback: z.string().max(5000).optional() }).safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: "Bad request." });
      const rows = await query(
        `UPDATE progress SET status = $3, feedback = $4, updated_at = now(),
                completed_at = CASE WHEN $3 = 'completed' THEN now() ELSE completed_at END
          WHERE user_id = $1 AND lesson_id = $2 AND status = 'submitted' RETURNING user_id`,
        [req.params.userId, req.params.lessonId, body.data.approve ? "completed" : "started", body.data.feedback ?? null]);
      if (!rows.length) return reply.code(404).send({ error: "Nothing waiting for review." });
      return { ok: true };
    },
  );
}
