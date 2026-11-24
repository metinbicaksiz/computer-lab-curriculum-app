import pg from "pg";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env in the project root.");
  process.exit(1);
}

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export async function query<T extends pg.QueryResultRow = any>(text: string, params: unknown[] = []) {
  const res = await pool.query<T>(text, params);
  return res.rows;
}
