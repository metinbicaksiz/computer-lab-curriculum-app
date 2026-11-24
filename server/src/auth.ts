import type { FastifyReply, FastifyRequest } from "fastify";
import { query } from "./db.ts";

export type SessionUser = { id: number; role: "student" | "teacher"; username: string };

// `t` = when the session started, in milliseconds. The standard JWT `iat` is
// only whole seconds, too coarse: a logout or password reset in the same second
// as a login wouldn't end that login.
declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: SessionUser & { t: number };
    user: SessionUser & { t?: number };
  }
}

export const COOKIE = "token";

/**
 * Checks the login token AND the database on every request, so an account
 * that was turned off, or whose sessions were ended, is locked out at once
 * instead of when its token expires. Role also comes from the database.
 */
export async function requireUser(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify();
  } catch {
    return reply.code(401).send({ error: "Please log in." });
  }
  const [row] = await query<{ role: SessionUser["role"]; username: string; active: boolean; valid_after_ms: number }>(
    `SELECT role, username, active, (extract(epoch FROM sessions_valid_after) * 1000)::float8 AS valid_after_ms
       FROM users WHERE id = $1`, [req.user.id]);
  // Tokens without `t` predate this check and are treated as ended.
  if (!row || !row.active || (req.user.t ?? 0) < row.valid_after_ms) {
    reply.clearCookie(COOKIE, { path: "/" });
    return reply.code(401).send({ error: "Please log in." });
  }
  req.user.role = row.role;
  req.user.username = row.username;
}

export async function requireTeacher(req: FastifyRequest, reply: FastifyReply) {
  await requireUser(req, reply);
  if (reply.sent) return;
  if (req.user.role !== "teacher") return reply.code(403).send({ error: "Teachers only." });
}

/** Ends every existing session for a user (all computers). Returns the cutoff in ms. */
export async function endSessions(userId: number): Promise<number> {
  const [row] = await query<{ ms: number }>(
    `UPDATE users SET sessions_valid_after = clock_timestamp() WHERE id = $1
     RETURNING (extract(epoch FROM sessions_valid_after) * 1000)::float8 AS ms`, [userId]);
  return row?.ms ?? Date.now();
}
