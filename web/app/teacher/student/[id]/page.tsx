"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import BeltBadge from "@/components/BeltBadge";
import CodeEditorLazy from "@/components/CodeEditorLazy";
import TopBar from "@/components/TopBar";
import { api, type LessonSummary, type Path } from "@/lib/api";
import { useMe } from "@/lib/useMe";

type Detail = {
  student: { id: number; username: string; display_name: string; grade: number | null; active: boolean };
  path: Path;
  work: { lesson_id: number; code: string; attempts: number; feedback: string | null; updated_at: string }[];
};

const statusLabel: Record<string, string> = {
  completed: "✅ done", submitted: "⏳ review", started: "✏️ working", available: "open", locked: "🔒",
};

export default function StudentDetail() {
  const { id } = useParams<{ id: string }>();
  const me = useMe("teacher");
  const [data, setData] = useState<Detail | null>(null);
  const [viewing, setViewing] = useState<LessonSummary | null>(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    api<Detail>(`/teacher/students/${id}`).then(setData).catch((e) => setMsg(e.message));
  }, [id]);
  useEffect(() => { if (me) load(); }, [me, load]);

  const update = async (body: object, done: string) => {
    try {
      await api(`/teacher/students/${id}`, { method: "PATCH", body });
      setMsg(done);
      load();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };
  const resetPassword = () => {
    const password = prompt("New password for this student (4+ characters):");
    if (password) update({ password }, "Password reset.");
  };

  if (!data) return <><TopBar me={me} /><p className="p-8 text-slate-500">{msg || "Loading…"}</p></>;
  const { student, path, work } = data;
  const workFor = (lessonId: number) => work.find((w) => w.lesson_id === lessonId);
  const earned = path.belts.find((b) => b.rank === path.earnedRank);
  const shownWork = viewing ? workFor(viewing.id) : null;

  return (
    <>
      <TopBar me={me}><Link href="/teacher" className="text-sm text-slate-500 hover:underline">← Class</Link></TopBar>
      <main className="mx-auto max-w-7xl space-y-5 p-6">
        <section className="flex flex-wrap items-center gap-4 rounded-xl bg-white p-5 shadow-sm">
          <BeltBadge color={earned?.color ?? "#e2e8f0"} size={72} />
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{student.display_name}</h1>
            <p className="text-slate-600">
              {student.username} · Grade {student.grade ?? "–"} · {earned?.name ?? "No belt yet"} · {path.xp} XP
              {!student.active && <span className="ml-2 text-red-600">(account off)</span>}
            </p>
          </div>
          <button onClick={resetPassword} className="rounded-lg border border-slate-300 px-3 py-2 hover:bg-slate-50">Reset password</button>
          <button onClick={() => update({ active: !student.active }, student.active ? "Account turned off." : "Account turned on.")}
            className="rounded-lg border border-slate-300 px-3 py-2 hover:bg-slate-50">
            {student.active ? "Turn account off" : "Turn account on"}
          </button>
        </section>
        {msg && <p className="text-sm text-slate-600">{msg}</p>}

        <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
          <div className="space-y-3">
            {[...path.belts, ...path.tracks].map((g) => (
              <div key={g.slug} className="rounded-xl bg-white p-3 shadow-sm">
                <p className="mb-1 font-semibold">{g.name}</p>
                <ul className="text-sm">
                  {g.lessons.map((l) => (
                    <li key={l.slug}>
                      <button onClick={() => setViewing(l)} disabled={!workFor(l.id)}
                        className={`flex w-full justify-between rounded px-2 py-1 text-left enabled:hover:bg-slate-100 disabled:text-slate-400 ${viewing?.id === l.id ? "bg-indigo-50" : ""}`}>
                        <span>{l.title}</span>
                        <span>{statusLabel[l.status]}{workFor(l.id) ? ` · ${workFor(l.id)!.attempts} tries` : ""}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            {viewing && shownWork ? (
              <>
                <h2 className="mb-2 font-bold">{viewing.title}</h2>
                <p className="mb-2 text-sm text-slate-500">Last saved {new Date(shownWork.updated_at).toLocaleString()}</p>
                {viewing.language === "blocks" ? (
                  <p className="text-sm text-slate-600">Block lessons are saved as a Blockly workspace. Open the lesson to see blocks; here is the saved data:</p>
                ) : null}
                <div className="h-[520px] overflow-hidden rounded-lg">
                  <CodeEditorLazy value={shownWork.code}
                    language={viewing.language === "python" ? "python" : viewing.language === "html" ? "html" : "javascript"} readOnly />
                </div>
              </>
            ) : (
              <p className="text-slate-500">Pick a lesson on the left to see this student's code.</p>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
