import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import Fastify from "fastify";
import { COOKIE } from "./auth.ts";
import adminRoutes from "./routes/admin.ts";
import authRoutes from "./routes/auth.ts";
import lessonRoutes from "./routes/lessons.ts";
import teacherRoutes from "./routes/teacher.ts";

const secret = process.env.JWT_SECRET;
if (!secret || secret.startsWith("change-me")) {
  console.error("Set JWT_SECRET in .env to a long random string (see .env.example).");
  process.exit(1);
}

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? "info" },
  // Every request arrives through the Next.js proxy on this machine. web/server.mjs
  // puts the student computer's real address in X-Forwarded-For (overwriting any
  // value the client sent). Only trust that header from localhost.
  trustProxy: ["127.0.0.1", "::1"],
});

await app.register(cookie);
await app.register(jwt, { secret, cookie: { cookieName: COOKIE, signed: false } });

app.get("/api/health", async () => ({ ok: true }));
await app.register(authRoutes);
await app.register(lessonRoutes);
await app.register(teacherRoutes);
await app.register(adminRoutes);

// The API binds to localhost only. Students reach it through the Next.js
// server, which proxies /api/* here, so there is a single port to open on the LAN.
const host = process.env.API_HOST ?? "127.0.0.1";
const port = Number(process.env.API_PORT ?? 4000);
await app.listen({ host, port });
