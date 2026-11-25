// Loads src/curriculum.ts into the database, creates the superadmin and the demo class.
// Safe to re-run: rows are upserted by slug, and lessons removed from the
// curriculum file are deleted (along with progress on them).
import bcrypt from "bcryptjs";
import type pg from "pg";
import { SCHOOL_DOMAIN } from "./accounts.ts";
import { pool } from "./db.ts";
import { belts, lessons, tracks } from "./curriculum.ts";

/** A demo class with one teacher and one student. Only adds what is missing. */
async function seedDemo(client: pg.PoolClient) {
  const password = await bcrypt.hash("demo1234", 10);
  const { rows: [cls] } = await client.query(
    `INSERT INTO classes (name) VALUES ('Demo Class 6A')
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`);
  const { rows: [teacher] } = await client.query(
    `INSERT INTO users (username, display_name, password_hash, role) VALUES ('demo.teacher', 'Demo Teacher', $1, 'teacher')
     ON CONFLICT (username) DO UPDATE SET username = EXCLUDED.username RETURNING id, role`, [password]);
  if (teacher.role === "teacher") {
    await client.query("INSERT INTO class_teachers (class_id, teacher_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [cls.id, teacher.id]);
  }
  // Students log in with a school email. Earlier seeds used plain "demo.student"; rename it.
  const studentLogin = `demo.student@${SCHOOL_DOMAIN}`;
  await client.query(
    `UPDATE users SET username = $1 WHERE username = 'demo.student' AND role = 'student'
       AND NOT EXISTS (SELECT 1 FROM users WHERE username = $1)`, [studentLogin]);
  await client.query(
    `INSERT INTO users (username, display_name, password_hash, role, grade, class_id)
     VALUES ($3, 'Demo Student', $1, 'student', 6, $2) ON CONFLICT (username) DO NOTHING`, [password, cls.id, studentLogin]);
  console.log(`demo data ready: class "Demo Class 6A", demo.teacher / ${studentLogin} (password demo1234)`);
}

const client = await pool.connect();
try {
  await client.query("BEGIN");

  for (const b of belts) {
    await client.query(
      `INSERT INTO belts (slug, name, color, rank, focus, description) VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (slug) DO UPDATE SET name=$2, color=$3, rank=$4, focus=$5, description=$6`,
      [b.slug, b.name, b.color, b.rank, b.focus, b.description],
    );
  }
  for (const t of tracks) {
    await client.query(
      `INSERT INTO tracks (slug, name, description, min_belt_rank, position) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (slug) DO UPDATE SET name=$2, description=$3, min_belt_rank=$4, position=$5`,
      [t.slug, t.name, t.description, t.minBeltRank, t.position],
    );
  }

  const beltIds = new Map((await client.query("SELECT id, slug FROM belts")).rows.map((r) => [r.slug, r.id]));
  const trackIds = new Map((await client.query("SELECT id, slug FROM tracks")).rows.map((r) => [r.slug, r.id]));

  // Position = order within its belt (core) or track (specialty).
  const counters = new Map<string, number>();
  for (const l of lessons) {
    const trackId = trackIds.get(l.track);
    if (!trackId) throw new Error(`lesson ${l.slug}: unknown track ${l.track}`);
    const beltId = l.belt ? beltIds.get(l.belt) : null;
    if (l.track === "core" && !beltId) throw new Error(`core lesson ${l.slug} needs a valid belt`);
    const group = `${l.track}/${l.belt ?? ""}`;
    const position = (counters.get(group) ?? 0) + 1;
    counters.set(group, position);

    await client.query(
      `INSERT INTO lessons (slug, track_id, belt_id, position, title, kind, language, instructions,
                            starter_code, expected_output, hints, quiz, xp)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (slug) DO UPDATE SET track_id=$2, belt_id=$3, position=$4, title=$5, kind=$6,
         language=$7, instructions=$8, starter_code=$9, expected_output=$10, hints=$11, quiz=$12, xp=$13`,
      [
        l.slug, trackId, beltId, position, l.title, l.kind, l.language ?? "javascript", l.instructions,
        l.starterCode ?? "", l.expectedOutput ?? null, JSON.stringify(l.hints ?? []),
        l.quiz ? JSON.stringify(l.quiz) : null, l.xp ?? 10,
      ],
    );
  }
  const removed = await client.query("DELETE FROM lessons WHERE NOT (slug = ANY($1)) RETURNING slug", [lessons.map((l) => l.slug)]);
  if (removed.rowCount) console.log(`removed lessons: ${removed.rows.map((r) => r.slug).join(", ")}`);

  // The one superadmin account: creates classes, teachers and students.
  const hasAdmin = await client.query("SELECT 1 FROM users WHERE role = 'superadmin'");
  if (!hasAdmin.rowCount) {
    const username = (process.env.SUPERADMIN_USERNAME || "admin").toLowerCase();
    const password = process.env.SUPERADMIN_PASSWORD || "changeme";
    const taken = await client.query("SELECT 1 FROM users WHERE username = $1", [username]);
    if (taken.rowCount) throw new Error(`can't create superadmin "${username}": that username is taken. Set SUPERADMIN_USERNAME in .env.`);
    await client.query(
      "INSERT INTO users (username, display_name, password_hash, role) VALUES ($1, 'Administrator', $2, 'superadmin')",
      [username, await bcrypt.hash(password, 10)],
    );
    console.log(`created superadmin account "${username}" (change the password after logging in)`);
  }

  // Demo data so the roles can be tried straight away. Turn off with SEED_DEMO=false.
  if (process.env.SEED_DEMO !== "false") await seedDemo(client);

  await client.query("COMMIT");
  console.log(`seeded ${belts.length} belts, ${tracks.length} tracks, ${lessons.length} lessons`);
} catch (err) {
  await client.query("ROLLBACK");
  console.error(err);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
