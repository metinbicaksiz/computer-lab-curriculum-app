import type { NextConfig } from "next";
import { hostname, networkInterfaces } from "node:os";

const api = `http://127.0.0.1:${process.env.API_PORT ?? 4000}`;

// In dev mode Next.js blocks pages opened from any other address than localhost.
// Allow this computer's own LAN addresses and name, worked out at startup
// (the IP can change between networks or reboots). A bare "*" doesn't match IPs.
const lanAddresses = Object.values(networkInterfaces())
  .flat()
  .filter((a) => a && a.family === "IPv4" && !a.internal)
  .map((a) => a!.address);
const machineName = hostname().toLowerCase();

const config: NextConfig = {
  // Students only ever talk to this server; it forwards /api/* to the Fastify API.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${api}/api/:path*` }];
  },
  allowedDevOrigins: [...lanAddresses, machineName, `${machineName}.local`],
  // Python runs inside a sandboxed iframe with an opaque origin (see lib/runners),
  // so Pyodide's files are fetched cross-origin. They're public static files.
  async headers() {
    return [{ source: "/pyodide/:path*", headers: [{ key: "Access-Control-Allow-Origin", value: "*" }] }];
  },
};
export default config;
