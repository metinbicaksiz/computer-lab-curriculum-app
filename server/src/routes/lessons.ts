import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { requireUser } from "../auth.ts";
import { query } from "../db.ts";
import { getPath, lessonStatus, outputMatches } from "../progression.ts";

type QuizQ = { question: string; options: string[]; answer: number };
type SlugReq = FastifyRequest<{ Params: { slug: string } }>;

/** Loads a lesson and checks the student may open it. Teachers can open anything. */
async function loadLesson(req: SlugReq, reply: FastifyReply) {
  const [lesson] = await query(
    `SELECT l.*, t.slug AS track_slug, t.name AS track_name,
            b.slug AS belt_slug, b.name AS belt_name, b.color AS belt_color
       FROM lessons l JOIN tracks t ON t.id = l.track_id LEFT JOIN belts b ON b.id = l.belt_id
      WHERE l.slug = $1`, [req.params.slug]);
  if (!lesson) {
    reply.code(404).send({ error: "Lesson not found." });
    return null;
  }
  if (req.user.role !== "teacher") {
    const status = await lessonStatus(req.user.id, lesson.slug);
    if (!status || status === "locked") {
      reply.code(403).send({ error: "Finish the earlier lessons to unlock this one." });
      return null;
    }
  }
  return lesson;
}

async function saveProgress(userId: number, lessonId: number, fields: {
  status?: "started" | "submitted" | "completed"; code?: string; attempt?: boolean;
}) {
  // A completed lesson is never downgraded back to started/submitted.
  await query(
    `INSERT INTO progress (user_id, lesson_id, status, code, attempts, completed_at)
     VALUES ($1, $2, COALESCE($3, 'started'), COALESCE($4, ''), $5::int,
             CASE WHEN $3 = 'completed' THEN now() END)
     ON CONFLICT (user_id, lesson_id) DO UPDATE SET
       status = CASE WHEN progress.status = 'completed' THEN 'completed'
                     ELSE COALESCE($3, progress.status) END,
       code = COALESCE($4, progress.code),
       attempts = progress.attempts + $5::int,
       completed_at = CASE WHEN progress.status <> 'completed' AND $3 = 'completed' THEN now()
                           ELSE progress.completed_at END,
       updated_at = now()`,
    [userId, lessonId, fields.status ?? null, fields.code ?? null, fields.attempt ? 1 : 0],
  );
}

const codeBody = z.object({ code: z.string().max(200_000) });

export default async function lessonRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireUser);

  app.get("/api/path", async (req) => getPath(req.user.id));

  app.get<{ Params: { slug: string } }>("/api/lessons/:slug", async (req, reply) => {
    const lesson = await loadLesson(req, reply);
    if (!lesson) return;
    const [progress] = await query(
      "SELECT status, code, attempts, feedback FROM progress WHERE user_id = $1 AND lesson_id = $2",
      [req.user.id, lesson.id]);
    const [next] = await query(
      `SELECT slug FROM lessons
        WHERE track_id = $1 AND belt_id IS NOT DISTINCT FROM $2 AND position > $3
        ORDER BY position LIMIT 1`, [lesson.track_id, lesson.belt_id, lesson.position]);
    // Quiz answers stay on the server.
    const quiz = (lesson.quiz as QuizQ[] | null)?.map(({ question, options }) => ({ question, options })) ?? null;
    return {
      slug: lesson.slug, title: lesson.title, kind: lesson.kind, language: lesson.language,
      instructions: lesson.instructions, starterCode: lesson.starter_code, expectedOutput: lesson.expected_output,
      hints: lesson.hints, quiz, xp: lesson.xp,
      track: { slug: lesson.track_slug, name: lesson.track_name },
      belt: lesson.belt_slug ? { slug: lesson.belt_slug, name: lesson.belt_name, color: lesson.belt_color } : null,
      progress: progress ?? null,
      nextSlug: next?.slug ?? null,
    };
  });

  // Autosave.
  app.put<{ Params: { slug: string } }>("/api/lessons/:slug/code", async (req, reply) => {
    const body = codeBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "Bad request." });
    const lesson = await loadLesson(req, reply);
    if (!lesson) return;
    await saveProgress(req.user.id, lesson.id, { code: body.data.code });
    return { ok: true };
  });

  // A Run of a code lesson. The browser runs the program and reports its output;
  // the server decides whether it matches. A student with dev tools could fake
  // this, which is an acceptable trade-off in a classroom: the teacher sees the code.
  app.post<{ Params: { slug: string } }>("/api/lessons/:slug/attempt", async (req, reply) => {
    const body = codeBody.extend({
      output: z.string().max(100_000).optional(),
      passed: z.boolean().optional(),
    }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "Bad request." });
    const lesson = await loadLesson(req, reply);
    if (!lesson) return;
    if (lesson.kind !== "code") return reply.code(400).send({ error: "This lesson isn't checked by running code." });
    const passed = lesson.language === "html"
      ? body.data.passed === true
      : lesson.expected_output != null && outputMatches(body.data.output ?? "", lesson.expected_output);
    await saveProgress(req.user.id, lesson.id, {
      code: body.data.code, attempt: true, status: passed ? "completed" : undefined,
    });
    return { passed };
  });

  app.post<{ Params: { slug: string } }>("/api/lessons/:slug/quiz", async (req, reply) => {
    const body = z.object({ answers: z.array(z.number().int()) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "Bad request." });
    const lesson = await loadLesson(req, reply);
    if (!lesson) return;
    const quiz = lesson.quiz as QuizQ[] | null;
    if (lesson.kind !== "quiz" || !quiz) return reply.code(400).send({ error: "Not a quiz." });
    const correct = quiz.map((q, i) => body.data.answers[i] === q.answer);
    const passed = correct.every(Boolean);
    await saveProgress(req.user.id, lesson.id, { attempt: true, status: passed ? "completed" : undefined });
    return { passed, correct };
  });

  app.post<{ Params: { slug: string } }>("/api/lessons/:slug/submit", async (req, reply) => {
    const body = codeBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "Bad request." });
    const lesson = await loadLesson(req, reply);
    if (!lesson) return;
    if (lesson.kind !== "capstone") return reply.code(400).send({ error: "Only capstones are submitted for review." });
    await saveProgress(req.user.id, lesson.id, { code: body.data.code, status: "submitted" });
    return { ok: true };
  });
}
