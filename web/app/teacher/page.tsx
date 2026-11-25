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
  class_id: number; class_name: string; last_active: string | null; earnedRank: number; xp: number; waitingReview: boolean;
  belts: { slug: string; done: number; total: number }[];
};
type Review = {
  user_id: number; lesson_id: number; code: string; updated_at: string;
  display_name: string; username: string; class_id: number; class_name: string; title: string; slug: string; language: string;
};
type BeltInfo = Path["belts"][number];

export default function Teacher() {
  const me = useMe("staff");
  const [tab, setTab] = useState<"class" | "reviews">("class");
  const [students, setStudents] = useState<Student[] | null>(null); // null = still loading
  const [reviews, setReviews] = useState<Review[]>([]);
  const [belts, setBelts] = useState<BeltInfo[]>([]);
  const [classes, setClasses] = useState<{ id: number; name: string }[]>([]);
  const [classId, setClassId] = useState<number | "all">("all");

  const load = useCallback(() => {
    api<Student[]>("/teacher/students").then(setStudents).catch(() => {});
    api<Review[]>("/teacher/reviews").then(setReviews).catch(() => {});
    api<{ id: number; name: string }[]>("/teacher/classes").then(setClasses).catch(() => {});
    api<Path>("/path").then((p) => setBelts(p.belts)).catch(() => {});
  }, []);
  const inClass = <T extends { class_id: number }>(rows: T[]) =>
    classId === "all" ? rows : rows.filter((r) => r.class_id === classId);
  const shownStudents = students && inClass(students);
  const shownReviews = inClass(reviews);
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
      <TopBar me={me}>
        {me?.role === "superadmin"
          ? <Link href="/admin" className="text-sm text-slate-500 hover:underline">← Admin</Link>
          : <span className="text-sm text-slate-500">Teacher</span>}
      </TopBar>
      <main className="mx-auto max-w-7xl space-y-5 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <select value={classId} onChange={(e) => setClassId(e.target.value === "all" ? "all" : Number(e.target.value))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-medium">
            <option value="all">All my classes</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {tabBtn("class", `Students (${shownStudents?.length ?? "…"})`)}
          {tabBtn("reviews", `Reviews (${shownReviews.length})`)}
          <div className="flex-1" />
          {belts[0]?.lessons[0] && (
            <Link href={`/lesson/${belts[0].lessons[0].slug}`} className="rounded-lg bg-white px-4 py-2 text-slate-700 hover:bg-slate-100">
              Preview lessons
            </Link>
          )}
        </div>
        {tab === "class" && (shownStudents
          ? <ClassTable students={shownStudents} belts={belts} noClasses={!classes.length} />
          : <p className="p-6 text-slate-500">Loading…</p>)}
        {tab === "reviews" && <Reviews reviews={shownReviews} onDone={load} />}
      </main>
    </>
  );
}

function ClassTable({ students, belts, noClasses }: { students: Student[]; belts: BeltInfo[]; noClasses: boolean }) {
  const [filter, setFilter] = useState("");
  const shown = students.filter((s) =>
    `${s.display_name} ${s.username} ${s.grade ?? ""} ${s.class_name}`.toLowerCase().includes(filter.toLowerCase()));
  if (!students.length) return (
    <p className="rounded-xl bg-white p-6 text-slate-600">
      {noClasses
        ? "You aren't assigned to any class yet. Ask the administrator to add you to one."
        : "No students in this class yet. The administrator creates student accounts."}
    </p>
  );
  return (
    <div className="space-y-3">
      <input placeholder="Search by name, username or grade…" value={filter} onChange={(e) => setFilter(e.target.value)}
        className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2" />
      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="p-3">Student</th>
              <th className="p-3">Class</th>
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
                  <td className="p-3">{s.class_name}</td>
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
              <p className="text-sm text-slate-500">{r.class_name} · {r.title} · {new Date(r.updated_at).toLocaleString()}</p>
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
