"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import BeltBadge from "@/components/BeltBadge";
import CodeEditorLazy from "@/components/CodeEditorLazy";
import TopBar from "@/components/TopBar";
import { api, type Path } from "@/lib/api";
import { useMe } from "@/lib/useMe";

type Student = {
  id: number; username: string; display_name: string; grade: number | null; active: boolean;
  last_active: string | null; earnedRank: number; xp: number; waitingReview: boolean;
  belts: { slug: string; done: number; total: number }[];
};
type Review = {
  user_id: number; lesson_id: number; code: string; updated_at: string;
  display_name: string; username: string; title: string; slug: string; language: string;
};
type BeltInfo = Path["belts"][number];

export default function Teacher() {
  const me = useMe("teacher");
  const [tab, setTab] = useState<"class" | "add" | "reviews">("class");
  const [students, setStudents] = useState<Student[] | null>(null); // null = still loading
  const [reviews, setReviews] = useState<Review[]>([]);
  const [belts, setBelts] = useState<BeltInfo[]>([]);

  const load = useCallback(() => {
    api<Student[]>("/teacher/students").then(setStudents).catch(() => {});
    api<Review[]>("/teacher/reviews").then(setReviews).catch(() => {});
    api<Path>("/path").then((p) => setBelts(p.belts)).catch(() => {});
  }, []);
  useEffect(() => {
    if (!me) return;
    load();
    const t = setInterval(load, 30_000); // keep the class view fresh during a lesson
    return () => clearInterval(t);
  }, [me, load]);

  const tabBtn = (id: typeof tab, label: string) => (
    <button onClick={() => setTab(id)}
      className={`rounded-lg px-4 py-2 font-medium ${tab === id ? "bg-indigo-600 text-white" : "bg-white text-slate-700 hover:bg-slate-100"}`}>
      {label}
    </button>
  );

  return (
    <>
      <TopBar me={me}><span className="text-sm text-slate-500">Teacher</span></TopBar>
      <main className="mx-auto max-w-7xl space-y-5 p-6">
        <div className="flex flex-wrap gap-2">
          {tabBtn("class", `Class (${students?.length ?? "…"})`)}
          {tabBtn("reviews", `Reviews (${reviews.length})`)}
          {tabBtn("add", "Add students")}
          <div className="flex-1" />
          {belts[0]?.lessons[0] && (
            <Link href={`/lesson/${belts[0].lessons[0].slug}`} className="rounded-lg bg-white px-4 py-2 text-slate-700 hover:bg-slate-100">
              Preview lessons
            </Link>
          )}
        </div>
        {tab === "class" && (students
          ? <ClassTable students={students} belts={belts} />
          : <p className="p-6 text-slate-500">Loading…</p>)}
        {tab === "reviews" && <Reviews reviews={reviews} onDone={load} />}
        {tab === "add" && <AddStudents onDone={() => { load(); setTab("class"); }} />}
      </main>
    </>
  );
}

function ClassTable({ students, belts }: { students: Student[]; belts: BeltInfo[] }) {
  const [filter, setFilter] = useState("");
  const shown = students.filter((s) =>
    `${s.display_name} ${s.username} ${s.grade ?? ""}`.toLowerCase().includes(filter.toLowerCase()));
  if (!students.length) return <p className="rounded-xl bg-white p-6 text-slate-600">No students yet. Use <b>Add students</b> to create accounts.</p>;
  return (
    <div className="space-y-3">
      <input placeholder="Search by name, username or grade…" value={filter} onChange={(e) => setFilter(e.target.value)}
        className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2" />
      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="p-3">Student</th>
              <th className="p-3">Grade</th>
              <th className="p-3">Belt</th>
              <th className="p-3">XP</th>
              {belts.map((b) => <th key={b.slug} className="p-2 text-center" title={b.name}><BeltBadge color={b.color} size={28} /></th>)}
              <th className="p-3">Last active</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((s) => {
              const belt = belts.find((b) => b.rank === s.earnedRank);
              return (
                <tr key={s.id} className={`border-t border-slate-100 hover:bg-slate-50 ${s.active ? "" : "opacity-50"}`}>
                  <td className="p-3">
                    <Link href={`/teacher/student/${s.id}`} className="font-medium text-indigo-700 hover:underline">{s.display_name}</Link>
                    <span className="ml-2 text-slate-400">{s.username}</span>
                    {s.waitingReview && <span className="ml-2 rounded bg-amber-100 px-1.5 text-xs text-amber-800">review</span>}
                  </td>
                  <td className="p-3">{s.grade ?? "–"}</td>
                  <td className="p-3">{belt?.name ?? "–"}</td>
                  <td className="p-3">{s.xp}</td>
                  {s.belts.map((b) => {
                    const pct = b.total ? b.done / b.total : 0;
                    return (
                      <td key={b.slug} className="p-2 text-center" title={`${b.done}/${b.total}`}>
                        <div className="mx-auto h-2 w-8 overflow-hidden rounded bg-slate-200">
                          <div className="h-full bg-green-500" style={{ width: `${pct * 100}%` }} />
                        </div>
                      </td>
                    );
                  })}
                  <td className="p-3 text-slate-500">{s.last_active ? new Date(s.last_active).toLocaleString() : "never"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Reviews({ reviews, onDone }: { reviews: Review[]; onDone: () => void }) {
  const [open, setOpen] = useState<Review | null>(null);
  const [feedback, setFeedback] = useState("");
  if (!reviews.length) return <p className="rounded-xl bg-white p-6 text-slate-600">Nothing to review right now.</p>;

  const decide = async (approve: boolean) => {
    if (!open) return;
    await api(`/teacher/reviews/${open.user_id}/${open.lesson_id}`, { body: { approve, feedback: feedback || undefined } });
    setOpen(null);
    setFeedback("");
    onDone();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
      <ul className="space-y-2">
        {reviews.map((r) => (
          <li key={`${r.user_id}-${r.lesson_id}`}>
            <button onClick={() => { setOpen(r); setFeedback(""); }}
              className={`w-full rounded-xl p-3 text-left shadow-sm ${open === r ? "bg-indigo-50 ring-2 ring-indigo-400" : "bg-white hover:bg-slate-50"}`}>
              <p className="font-medium">{r.display_name}</p>
              <p className="text-sm text-slate-500">{r.title} · {new Date(r.updated_at).toLocaleString()}</p>
            </button>
          </li>
        ))}
      </ul>
      {open && (
        <div className="space-y-3 rounded-xl bg-white p-4 shadow-sm">
          <h3 className="font-bold">{open.display_name}: {open.title}</h3>
          <div className="h-[420px] overflow-hidden rounded-lg">
            <CodeEditorLazy value={open.code} language={open.language === "python" ? "python" : open.language === "html" ? "html" : "javascript"} readOnly />
          </div>
          <textarea placeholder="Feedback for the student (optional)" value={feedback} onChange={(e) => setFeedback(e.target.value)}
            className="h-24 w-full rounded-lg border border-slate-300 p-2" />
          <div className="flex gap-2">
            <button onClick={() => decide(true)} className="rounded-lg bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-700">Approve 🏆</button>
            <button onClick={() => decide(false)} className="rounded-lg bg-slate-200 px-4 py-2 font-semibold hover:bg-slate-300">Send back with feedback</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Bulk add: one student per line, "username, Display Name, grade, password".
// Grade and password are optional; a missing password defaults to the shared one.
function AddStudents({ onDone }: { onDone: () => void }) {
  const [text, setText] = useState("");
  const [defaultPassword, setDefaultPassword] = useState("");
  const [error, setError] = useState("");

  const parsed = text.split("\n").map((l) => l.trim()).filter(Boolean).map((line) => {
    const [username, displayName, grade, password] = line.split(",").map((x) => x.trim());
    return {
      username: (username ?? "").toLowerCase(),
      displayName: displayName || username,
      grade: grade ? Number(grade) : null,
      password: password || defaultPassword,
    };
  });

  const submit = async () => {
    setError("");
    if (parsed.some((s) => !s.password || s.password.length < 4)) {
      setError("Every student needs a password of 4+ characters. Set a default password or add one per line.");
      return;
    }
    try {
      await api("/teacher/students", { body: { students: parsed } });
      setText("");
      onDone();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="max-w-3xl space-y-4 rounded-xl bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-lg font-bold">Add students</h2>
        <p className="text-sm text-slate-600">
          One student per line: <code className="rounded bg-slate-100 px-1">username, Display Name, grade, password</code>.
          Grade and password are optional. You can paste straight from a spreadsheet saved as CSV.
        </p>
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)}
        placeholder={"ayilmaz, Ayşe Yılmaz, 6\nbkaya, Berk Kaya, 7, rocket42"}
        className="h-48 w-full rounded-lg border border-slate-300 p-3 font-mono text-sm" />
      <label className="block">
        <span className="text-sm font-medium">Default password for lines without one</span>
        <input value={defaultPassword} onChange={(e) => setDefaultPassword(e.target.value)}
          className="mt-1 w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2" />
      </label>
      {error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      <button onClick={submit} disabled={!parsed.length}
        className="rounded-lg bg-indigo-600 px-5 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
        Create {parsed.length || ""} account{parsed.length === 1 ? "" : "s"}
      </button>
    </div>
  );
}
