// Works out what each student can see and do. Rules:
//  - Core belt N opens when every lesson in belts 1..N-1 is completed.
//  - Inside a belt or track, lessons open one at a time, in order.
//  - A specialty track opens once the student has earned its min_belt_rank.
import { query } from "./db.ts";

export type LessonStatus = "locked" | "available" | "started" | "submitted" | "completed";

type Row = {
  id: number; slug: string; title: string; kind: string; language: string; xp: number; position: number;
  track_slug: string; belt_slug: string | null; belt_rank: number | null; status: string | null;
};

export async function getPath(userId: number) {
  const [belts, tracks, rows] = await Promise.all([
    query<{ slug: string; name: string; color: string; rank: number; focus: string; description: string }>(
      "SELECT slug, name, color, rank, focus, description FROM belts ORDER BY rank"),
    query<{ slug: string; name: string; description: string; min_belt_rank: number }>(
      "SELECT slug, name, description, min_belt_rank FROM tracks ORDER BY position"),
    query<Row>(
      `SELECT l.id, l.slug, l.title, l.kind, l.language, l.xp, l.position,
              t.slug AS track_slug, b.slug AS belt_slug, b.rank AS belt_rank, p.status
         FROM lessons l
         JOIN tracks t ON t.id = l.track_id
         LEFT JOIN belts b ON b.id = l.belt_id
         LEFT JOIN progress p ON p.lesson_id = l.id AND p.user_id = $1
        ORDER BY t.position, b.rank NULLS LAST, l.position`,
      [userId],
    ),
  ]);

  const toLesson = (r: Row, status: LessonStatus) => ({
    id: r.id, slug: r.slug, title: r.title, kind: r.kind, language: r.language, xp: r.xp, status,
  });
  // Walk lessons in order; each one is open only if everything before it in its group is done.
  const walk = (group: Row[], open: boolean) => {
    let prevDone = open;
    return group.map((r) => {
      const status: LessonStatus = r.status ? (r.status as LessonStatus) : prevDone ? "available" : "locked";
      prevDone = status === "completed";
      return toLesson(r, status);
    });
  };

  let earnedRank = 0;
  let open = true;
  const beltPath = belts.map((b) => {
    const lessons = walk(rows.filter((r) => r.belt_slug === b.slug), open);
    const done = lessons.length > 0 && lessons.every((l) => l.status === "completed");
    const unlocked = open;
    if (done && open) earnedRank = b.rank;
    open = open && done;
    return { ...b, unlocked, completed: done, lessons };
  });

  const specialty = tracks
    .filter((t) => t.slug !== "core")
    .map((t) => {
      const unlocked = earnedRank >= t.min_belt_rank;
      return { ...t, unlocked, lessons: walk(rows.filter((r) => r.track_slug === t.slug), unlocked) };
    });

  const xp = rows.filter((r) => r.status === "completed").reduce((sum, r) => sum + r.xp, 0);
  return { earnedRank, xp, belts: beltPath, tracks: specialty };
}

export async function lessonStatus(userId: number, slug: string): Promise<LessonStatus | null> {
  const path = await getPath(userId);
  for (const group of [...path.belts, ...path.tracks]) {
    const l = group.lessons.find((x) => x.slug === slug);
    if (l) return l.status;
  }
  return null;
}

/** Compare program output loosely: ignore trailing spaces and blank lines at the end. */
export function outputMatches(actual: string, expected: string) {
  const norm = (s: string) => s.replace(/\r\n/g, "\n").split("\n").map((l) => l.trimEnd()).join("\n").trim();
  return norm(actual) === norm(expected);
}
