// Superadmin only: creates and manages every account and class.
import bcrypt from "bcryptjs";
import type { FastifyInstance, FastifyReply } from "fastify";
import type pg from "pg";
import { z } from "zod";
import { loginFor, staffLogin, studentLogin } from "../accounts.ts";
import { requireSuperadmin } from "../auth.ts";
import { pool, query } from "../db.ts";

const displayName = z.string().trim().min(1).max(60);
const grade = z.number().int().min(1).max(12).nullable().optional();
const password = z.string().min(4, "Passwords need at least 4 characters.");
const id = z.number().int().positive();

const newUser = z.discriminatedUnion("role", [
  z.object({ role: z.literal("student"), username: studentLogin, displayName, grade, password, classId: id }),
  z.object({ role: z.literal("teacher"), username: staffLogin, displayName, password, classIds: z.array(id).optional() }),
]);

const classBody = z.object({
  name: z.string().trim().min(1).max(60),
  teacherIds: z.array(id).min(1, "A class needs at least one teacher."),
});

// For bulk imports, say which pasted line was wrong.
const bad = (reply: FastifyReply, err: z.ZodError) => {
  const issue = err.issues[0];
  const line = issue?.path[0] === "users" && typeof issue.path[1] === "number" ? `Line ${issue.path[1] + 1}: ` : "";
  return reply.code(400).send({ error: issue ? line + issue.message : "Bad request." });
};

/** Runs fn in a transaction and turns common database errors into readable 4xx replies. */
async function tx<T>(reply: FastifyReply, fn: (c: pg.PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (err: any) {
    await client.query("ROLLBACK");
    if (err instanceof HttpError) return reply.code(err.status).send({ error: err.message });
    if (err.code === "23505") return reply.code(409).send({ error: `Already taken: ${err.detail ?? ""}` });
    if (err.code === "23503") return reply.code(400).send({ error: "That class or teacher doesn't exist." });
    throw err;
  } finally {
    client.release();
  }
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function checkTeachers(c: pg.PoolClient, teacherIds: number[]) {
  const { rowCount } = await c.query("SELECT 1 FROM users WHERE id = ANY($1) AND role = 'teacher'", [teacherIds]);
  if (rowCount !== new Set(teacherIds).size) throw new HttpError(400, "Every assigned person must be a teacher account.");
}

async function setClassTeachers(c: pg.PoolClient, classId: number, teacherIds: number[]) {
  await checkTeachers(c, teacherIds);
  await c.query("DELETE FROM class_teachers WHERE class_id = $1", [classId]);
  await c.query(
    "INSERT INTO class_teachers (class_id, teacher_id) SELECT $1, unnest($2::int[]) ON CONFLICT DO NOTHING",
    [classId, teacherIds]);
}

/** Classes that would be left without a teacher if these teachers left them. */
async function orphanedClasses(c: pg.PoolClient) {
  const { rows } = await c.query(
    `SELECT c.name FROM classes c WHERE NOT EXISTS (
       SELECT 1 FROM class_teachers ct JOIN users t ON t.id = ct.teacher_id
        WHERE ct.class_id = c.id AND t.role = 'teacher')`);
  return rows.map((r) => r.name as string);
}

export default async function adminRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireSuperadmin);

  // ---- classes ----

  app.get("/api/admin/classes", async () => query(
    `SELECT c.id, c.name,
            (SELECT count(*)::int FROM users u WHERE u.class_id = c.id) AS student_count,
            COALESCE((SELECT json_agg(json_build_object('id', t.id, 'display_name', t.display_name, 'username', t.username)
                                      ORDER BY t.display_name)
                        FROM class_teachers ct JOIN users t ON t.id = ct.teacher_id
                       WHERE ct.class_id = c.id), '[]') AS teachers
       FROM classes c ORDER BY c.name`));

  app.post("/api/admin/classes", async (req, reply) => {
    const body = classBody.safeParse(req.body);
    if (!body.success) return bad(reply, body.error);
    return tx(reply, async (c) => {
      const { rows: [row] } = await c.query("INSERT INTO classes (name) VALUES ($1) RETURNING id", [body.data.name]);
      await setClassTeachers(c, row.id, body.data.teacherIds);
      return { id: row.id };
    });
  });

  app.patch<{ Params: { id: string } }>("/api/admin/classes/:id", async (req, reply) => {
    const body = classBody.partial().safeParse(req.body);
    if (!body.success) return bad(reply, body.error);
    const classId = Number(req.params.id);
    return tx(reply, async (c) => {
      const { rowCount } = await c.query(
        "UPDATE classes SET name = COALESCE($2, name) WHERE id = $1", [classId, body.data.name ?? null]);
      if (!rowCount) throw new HttpError(404, "Class not found.");
      if (body.data.teacherIds) await setClassTeachers(c, classId, body.data.teacherIds);
      return { ok: true };
    });
  });

  // A class with students needs a decision about them: ?moveTo=<classId> moves them to
  // another class, ?deleteStudents=true deletes their accounts and progress with the class.
  app.delete<{ Params: { id: string }; Querystring: { moveTo?: string; deleteStudents?: string } }>(
    "/api/admin/classes/:id",
    async (req, reply) => {
      const classId = Number(req.params.id);
      const moveTo = req.query.moveTo ? Number(req.query.moveTo) : null;
      const deleteStudents = req.query.deleteStudents === "true";
      if (moveTo === classId) return reply.code(400).send({ error: "Pick a different class to move the students to." });
      return tx(reply, async (c) => {
        const { rowCount: exists } = await c.query("SELECT 1 FROM classes WHERE id = $1 FOR UPDATE", [classId]);
        if (!exists) throw new HttpError(404, "Class not found.");
        const { rows: [{ n }] } = await c.query("SELECT count(*)::int AS n FROM users WHERE class_id = $1", [classId]);
        if (n && moveTo) {
          const { rowCount } = await c.query("SELECT 1 FROM classes WHERE id = $1", [moveTo]);
          if (!rowCount) throw new HttpError(400, "The class to move students to doesn't exist.");
          await c.query("UPDATE users SET class_id = $2 WHERE class_id = $1", [classId, moveTo]);
        } else if (n && deleteStudents) {
          await c.query("DELETE FROM users WHERE class_id = $1 AND role = 'student'", [classId]);
        } else if (n) {
          throw new HttpError(409, `This class has ${n} student(s). Move them to another class or delete them with it.`);
        }
        await c.query("DELETE FROM classes WHERE id = $1", [classId]);
        return { ok: true, moved: moveTo ? n : 0, deleted: deleteStudents ? n : 0 };
      });
    },
  );

  // ---- users ----

  app.get("/api/admin/users", async () => query(
    `SELECT u.id, u.username, u.display_name, u.role, u.grade, u.active, u.class_id, c.name AS class_name,
            CASE WHEN u.role = 'teacher' THEN COALESCE(
              (SELECT json_agg(json_build_object('id', tc.id, 'name', tc.name) ORDER BY tc.name)
                 FROM class_teachers ct JOIN classes tc ON tc.id = ct.class_id WHERE ct.teacher_id = u.id), '[]') END AS classes
       FROM users u LEFT JOIN classes c ON c.id = u.class_id
      ORDER BY CASE u.role WHEN 'superadmin' THEN 0 WHEN 'teacher' THEN 1 ELSE 2 END,
               c.name NULLS FIRST, u.display_name`));

  // Create one or many teachers/students (bulk import from a pasted list).
  app.post("/api/admin/users", async (req, reply) => {
    const body = z.object({ users: z.array(newUser).min(1).max(500) }).safeParse(req.body);
    if (!body.success) return bad(reply, body.error);
    return tx(reply, async (c) => {
      for (const u of body.data.users) {
        const hash = await bcrypt.hash(u.password, 10);
        if (u.role === "student") {
          await c.query(
            "INSERT INTO users (username, display_name, grade, password_hash, role, class_id) VALUES ($1,$2,$3,$4,'student',$5)",
            [u.username, u.displayName, u.grade ?? null, hash, u.classId]);
        } else {
          const { rows: [row] } = await c.query(
            "INSERT INTO users (username, display_name, password_hash, role) VALUES ($1,$2,$3,'teacher') RETURNING id",
            [u.username, u.displayName, hash]);
          if (u.classIds?.length) {
            await c.query(
              "INSERT INTO class_teachers (class_id, teacher_id) SELECT unnest($1::int[]), $2 ON CONFLICT DO NOTHING",
              [u.classIds, row.id]);
          }
        }
      }
      return { created: body.data.users.length };
    });
  });

  // Deletes the account and, for students, all their progress and code. The superadmin
  // can't be deleted, and a teacher can't be deleted while a class depends on them alone.
  app.delete<{ Params: { id: string } }>("/api/admin/users/:id", async (req, reply) => {
    const userId = Number(req.params.id);
    return tx(reply, async (c) => {
      const { rows: [user] } = await c.query("SELECT role FROM users WHERE id = $1 FOR UPDATE", [userId]);
      if (!user) throw new HttpError(404, "User not found.");
      if (user.role === "superadmin") throw new HttpError(400, "The superadmin account can't be deleted.");
      await c.query("DELETE FROM users WHERE id = $1", [userId]);
      if (user.role === "teacher") {
        const orphans = await orphanedClasses(c);
        if (orphans.length) throw new HttpError(409, `These classes would have no teacher: ${orphans.join(", ")}. Assign another teacher first.`);
      }
      return { ok: true };
    });
  });

  app.patch<{ Params: { id: string } }>("/api/admin/users/:id", async (req, reply) => {
    const body = z.object({
      username: z.string().optional(),      // checked below against the account's role
      displayName: displayName.optional(),
      grade,
      password: password.optional(),
      active: z.boolean().optional(),
      classId: id.optional(),               // students: move to another class
      classIds: z.array(id).optional(),     // teachers: the classes they follow
    }).safeParse(req.body);
    if (!body.success) return bad(reply, body.error);
    const d = body.data;
    const userId = Number(req.params.id);
    if (userId === req.user.id && d.active === false) {
      return reply.code(400).send({ error: "You can't turn off your own account." });
    }
    return tx(reply, async (c) => {
      const { rows: [user] } = await c.query("SELECT role FROM users WHERE id = $1", [userId]);
      if (!user) throw new HttpError(404, "User not found.");
      if (d.classId !== undefined && user.role !== "student") throw new HttpError(400, "Only students belong to a class.");
      if (d.classIds !== undefined && user.role !== "teacher") throw new HttpError(400, "Only teachers follow classes.");
      let newUsername: string | null = null;
      if (d.username !== undefined) {
        const parsed = loginFor(user.role).safeParse(d.username);
        if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid username.");
        newUsername = parsed.data;
      }

      await c.query(
        `UPDATE users SET
           display_name = COALESCE($2, display_name),
           grade = CASE WHEN $3::boolean AND role = 'student' THEN $4::int ELSE grade END,
           password_hash = COALESCE($5, password_hash),
           active = COALESCE($6, active),
           class_id = COALESCE($7, class_id),
           username = COALESCE($8, username),
           -- A password reset, rename or turning the account off logs them out everywhere.
           sessions_valid_after = CASE WHEN $5 IS NOT NULL OR $6 = false OR ($8 IS NOT NULL AND $8 <> username)
                                       THEN clock_timestamp() ELSE sessions_valid_after END
         WHERE id = $1`,
        [userId, d.displayName ?? null, d.grade !== undefined, d.grade ?? null,
         d.password ? await bcrypt.hash(d.password, 10) : null, d.active ?? null, d.classId ?? null, newUsername]);

      if (d.classIds !== undefined) {
        await c.query("DELETE FROM class_teachers WHERE teacher_id = $1", [userId]);
        await c.query(
          "INSERT INTO class_teachers (class_id, teacher_id) SELECT unnest($1::int[]), $2 ON CONFLICT DO NOTHING",
          [d.classIds, userId]);
        const orphans = await orphanedClasses(c);
        if (orphans.length) throw new HttpError(409, `These classes would have no teacher: ${orphans.join(", ")}. Assign another teacher first.`);
      }
      return { ok: true };
    });
  });
}
