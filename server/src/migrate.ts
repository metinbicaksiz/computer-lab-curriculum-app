// Applies every .sql file in db/migrations that hasn't been applied yet, in name order.
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { pool } from "./db.ts";

const dir = join(import.meta.dirname, "..", "db", "migrations");

await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
  name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
const done = new Set((await pool.query("SELECT name FROM schema_migrations")).rows.map((r) => r.name));

for (const file of (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort()) {
  if (done.has(file)) continue;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(await readFile(join(dir, file), "utf8"));
    await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
    await client.query("COMMIT");
    console.log(`applied ${file}`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`failed on ${file}:`, err);
    process.exitCode = 1;
    break;
  } finally {
    client.release();
  }
}
console.log("migrations up to date");
await pool.end();
