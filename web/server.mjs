// Starts Next.js behind a tiny custom server, for one reason: the API needs to
// know which student computer each request came from (for the login limiter).
// `next dev` / `next start` don't pass that along when they forward /api/* to
// Fastify, so every request would look like it came from this machine, and one
// student guessing passwords could lock the whole class out.
//
// Here we set X-Forwarded-For to the real network address of the connection,
// overwriting anything the client sent, so it can't be faked either. Next.js
// forwards request headers to the API untouched.
//
//   node server.mjs --dev    development (what `npm run dev` runs)
//   node server.mjs          production, after `npm run build` (`npm start`)
import { createServer } from "node:http";

const dev = process.argv.includes("--dev");
process.env.NODE_ENV = dev ? "development" : "production";
const hostname = "0.0.0.0"; // reachable from student computers on the LAN
const port = Number(process.env.PORT ?? 3000);

// Imported after NODE_ENV is set, so Next.js picks the right mode.
const { default: next } = await import("next");

const server = createServer();
const app = next({ dev, hostname, port, httpServer: server, dir: import.meta.dirname });
const handle = app.getRequestHandler();
await app.prepare();

server.on("request", (req, res) => {
  // The real address of the computer on the other end of this connection.
  // "::ffff:10.0.0.31" -> "10.0.0.31"
  const ip = (req.socket.remoteAddress ?? "").replace(/^::ffff:/, "");
  req.headers["x-forwarded-for"] = ip;
  handle(req, res);
});

server.listen(port, hostname, () => {
  console.log(`> Code Lab ready on http://localhost:${port} (${dev ? "development" : "production"})`);
});
