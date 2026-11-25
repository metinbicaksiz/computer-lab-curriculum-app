// Thin fetch wrapper. All calls go to /api/* on the same origin; Next.js
// proxies them to the Fastify server, and the login cookie rides along.

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
    headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined" && !location.pathname.startsWith("/login")) {
      location.href = "/login";
    }
    throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`);
  }
  return data as T;
}

export type Role = "student" | "teacher" | "superadmin";

/** Where each role lands after logging in. */
export const homeFor = (role: string) => role === "superadmin" ? "/admin" : role === "teacher" ? "/teacher" : "/dashboard";

export type Me = {
  id: number; username: string; display_name: string; role: Role;
  grade: number | null; earnedRank: number; xp: number;
};

export type LessonStatus = "locked" | "available" | "started" | "submitted" | "completed";
export type LessonSummary = { id: number; slug: string; title: string; kind: string; language: string; xp: number; status: LessonStatus };
export type BeltPath = {
  slug: string; name: string; color: string; rank: number; focus: string; description: string;
  unlocked: boolean; completed: boolean; lessons: LessonSummary[];
};
export type TrackPath = { slug: string; name: string; description: string; min_belt_rank: number; unlocked: boolean; lessons: LessonSummary[] };
export type Path = { earnedRank: number; xp: number; belts: BeltPath[]; tracks: TrackPath[] };

export type Language = "blocks" | "javascript" | "python" | "html";
export type Lesson = {
  slug: string; title: string; kind: "code" | "quiz" | "capstone"; language: Language;
  instructions: string; starterCode: string; expectedOutput: string | null; hints: string[];
  quiz: { question: string; options: string[] }[] | null; xp: number;
  track: { slug: string; name: string };
  belt: { slug: string; name: string; color: string } | null;
  progress: { status: LessonStatus; code: string; attempts: number; feedback: string | null } | null;
  nextSlug: string | null;
};

/** The school email domain accounts use (e.g. "gobindsarvar.ca"). Fetched once per page load. */
let configPromise: Promise<{ schoolDomain: string }> | null = null;
export const getConfig = () => (configPromise ??= api<{ schoolDomain: string }>("/config"));
