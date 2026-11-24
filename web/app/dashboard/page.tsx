"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import BeltBadge from "@/components/BeltBadge";
import TopBar from "@/components/TopBar";
import { api, type LessonSummary, type Path } from "@/lib/api";
import { useMe } from "@/lib/useMe";

const kindIcon: Record<string, string> = { blocks: "🧩", javascript: "📜", python: "🐍", html: "🌐" };
const statusStyle: Record<string, string> = {
  completed: "border-green-300 bg-green-50 text-green-900",
  submitted: "border-amber-300 bg-amber-50 text-amber-900",
  started: "border-indigo-300 bg-indigo-50 text-indigo-900",
  available: "border-indigo-400 bg-white text-slate-900 ring-2 ring-indigo-200",
  locked: "border-slate-200 bg-slate-100 text-slate-400",
};

function LessonTile({ l }: { l: LessonSummary }) {
  const icon = l.kind === "quiz" ? "❓" : l.kind === "capstone" ? "🏆" : kindIcon[l.language] ?? "📜";
  const badge = l.status === "completed" ? "✅" : l.status === "submitted" ? "⏳" : l.status === "locked" ? "🔒" : "";
  const body = (
    <div className={`flex h-full items-center gap-2 rounded-xl border p-3 transition ${statusStyle[l.status]} ${l.status !== "locked" ? "hover:-translate-y-0.5 hover:shadow" : ""}`}>
      <span className="text-xl">{icon}</span>
      <span className="flex-1 text-sm font-medium">{l.title}</span>
      <span>{badge}</span>
    </div>
  );
  return l.status === "locked" ? <div title="Finish the lesson before this one">{body}</div> : <Link href={`/lesson/${l.slug}`}>{body}</Link>;
}

export default function Dashboard() {
  const me = useMe();
  const [path, setPath] = useState<Path | null>(null);
  useEffect(() => {
    api<Path>("/path").then(setPath).catch(() => {});
  }, []);

  if (!path) return <><TopBar me={me} /><p className="p-8 text-slate-500">Loading…</p></>;

  const current = path.belts.find((b) => b.unlocked && !b.completed);
  const earned = path.belts.filter((b) => b.rank <= path.earnedRank).at(-1);
  const nextLesson = [...path.belts, ...path.tracks].flatMap((g) => g.lessons).find((l) => l.status === "available" || l.status === "started");

  return (
    <>
      <TopBar me={me} />
      <main className="mx-auto max-w-5xl space-y-8 p-6">
        <section className="flex flex-wrap items-center gap-6 rounded-2xl bg-white p-6 shadow-sm">
          <BeltBadge color={earned?.color ?? "#e2e8f0"} size={96} title={earned?.name ?? "No belt yet"} />
          <div className="flex-1">
            <p className="text-sm uppercase tracking-wide text-slate-500">Your belt</p>
            <h1 className="text-3xl font-bold">{earned?.name ?? "Getting started"}</h1>
            {current && <p className="text-slate-600">Working toward <b>{current.name}</b> · {current.focus}</p>}
            {!current && path.earnedRank > 0 && <p className="font-semibold text-green-700">You've earned every belt. Amazing! 🎉</p>}
          </div>
          {nextLesson && (
            <Link href={`/lesson/${nextLesson.slug}`} className="rounded-xl bg-indigo-600 px-5 py-3 text-lg font-semibold text-white shadow hover:bg-indigo-700">
              Continue: {nextLesson.title} →
            </Link>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold">Belt path</h2>
          {path.belts.map((b) => {
            const done = b.lessons.filter((l) => l.status === "completed").length;
            return (
              <div key={b.slug} className={`rounded-2xl bg-white p-5 shadow-sm ${b.unlocked ? "" : "opacity-60"}`}>
                <div className="mb-3 flex items-center gap-3">
                  <BeltBadge color={b.color} size={48} title={b.name} />
                  <div className="flex-1">
                    <h3 className="font-bold">{b.name} <span className="font-normal text-slate-500">· {b.focus}</span></h3>
                    <p className="text-sm text-slate-600">{b.description}</p>
                  </div>
                  <span className="text-sm text-slate-500">{b.completed ? "🏅 Earned" : b.unlocked ? `${done}/${b.lessons.length}` : "🔒"}</span>
                </div>
                {b.unlocked && (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {b.lessons.map((l) => <LessonTile key={l.slug} l={l} />)}
                  </div>
                )}
              </div>
            );
          })}
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold">Specialty tracks</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {path.tracks.map((t) => (
              <div key={t.slug} className={`rounded-2xl bg-white p-5 shadow-sm ${t.unlocked ? "" : "opacity-60"}`}>
                <h3 className="font-bold">{t.name}</h3>
                <p className="mb-3 text-sm text-slate-600">{t.description}</p>
                {t.unlocked ? (
                  <div className="space-y-2">{t.lessons.map((l) => <LessonTile key={l.slug} l={l} />)}</div>
                ) : (
                  <p className="text-sm text-slate-500">🔒 Opens at {path.belts.find((b) => b.rank === t.min_belt_rank)?.name}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
