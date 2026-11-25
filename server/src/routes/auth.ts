import bcrypt from "bcryptjs";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { SCHOOL_DOMAIN } from "../accounts.ts";
import { COOKIE, endSessions, requireUser, type SessionUser } from "../auth.ts";
import { query } from "../db.ts";
import { lockedFor, recordFailure, recordSuccess } from "../loginLimiter.ts";
import { getPath } from "../progression.ts";

const tooMany = (reply: FastifyReply, seconds: number) =>
  reply.code(429).send({ error: `Too many wrong passwords. Try again in ${Math.ceil(seconds / 60)} minute(s).` });

export default async function authRoutes(app: FastifyInstance) {
  // notBefore: a session cutoff just set by endSessions; the new session must start after it.
  const startSession = (reply: FastifyReply, user: SessionUser, notBefore = 0) => {
    const t = Math.max(Date.now(), Math.ceil(notBefore));
    const token = app.jwt.sign(
      { id: user.id, role: user.role, username: user.username, t }, { expiresIn: "12h" });
    reply.setCookie(COOKIE, token, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 12 * 3600 });
  };

  // Public: lets the pages show which email domain accounts use.
  app.get("/api/config", async () => ({ schoolDomain: SCHOOL_DOMAIN }));

  app.post("/api/auth/login", async (req, reply) => {
    const body = z.object({ username: z.string().trim().toLowerCase(), password: z.string() }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "Enter your school email and password." });
    const { username, password } = body.data;

    const wait = lockedFor(req.ip, username);
    if (wait) return tooMany(reply, wait);

    const [user] = await query("SELECT * FROM users WHERE username = $1", [username]);
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      recordFailure(req.ip, username);
      req.log.warn({ ip: req.ip, username }, "failed login");
      return reply.code(401).send({ error: "Wrong email or password." });
    }
    recordSuccess(req.ip, username);
    if (!user.active) return reply.code(403).send({ error: "This account is turned off. Ask your teacher." });
    startSession(reply, user);
    return { role: user.role };
  });

  // Logging out ends the session on every computer, not just this one, which
  // matters on shared lab machines where a student forgets to log out.
  app.post("/api/auth/logout", async (req, reply) => {
    try {
      await req.jwtVerify();
      await endSessions(req.user.id);
    } catch {
      // not logged in; just clear the cookie
    }
    reply.clearCookie(COOKIE, { path: "/" });
    return { ok: true };
  });

  app.get("/api/me", { preHandler: requireUser }, async (req, reply) => {
    const [user] = await query(
      "SELECT id, username, display_name, role, grade FROM users WHERE id = $1 AND active", [req.user.id]);
    if (!user) return reply.code(401).send({ error: "Please log in." });
    const { earnedRank, xp } = user.role === "student" ? await getPath(user.id) : { earnedRank: 0, xp: 0 };
    return { ...user, earnedRank, xp };
  });

  app.post("/api/me/password", { preHandler: requireUser }, async (req, reply) => {
    const body = z.object({ current: z.string(), next: z.string().min(4) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "New password must be at least 4 characters." });
    // Someone at an unlocked computer shouldn't be able to guess the current password freely either.
    const wait = lockedFor(req.ip, req.user.username);
    if (wait) return tooMany(reply, wait);
    const [user] = await query("SELECT password_hash FROM users WHERE id = $1", [req.user.id]);
    if (!(await bcrypt.compare(body.data.current, user.password_hash))) {
      recordFailure(req.ip, req.user.username);
      return reply.code(400).send({ error: "Current password is wrong." });
    }
    await query("UPDATE users SET password_hash = $1 WHERE id = $2", [await bcrypt.hash(body.data.next, 10), req.user.id]);
    // Sign out everywhere else, then give this computer a fresh session.
    const cutoff = await endSessions(req.user.id);
    startSession(reply, req.user, cutoff);
    return { ok: true };
  });
}
