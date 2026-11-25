"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import TopBar from "@/components/TopBar";
import { api } from "@/lib/api";
import { useMe } from "@/lib/useMe";
import { useSchoolDomain } from "@/lib/useSchoolDomain";

type Person = { id: number; display_name: string; username: string };
type ClassRow = { id: number; name: string; student_count: number; teachers: Person[] };
type UserRow = Person & {
  role: "student" | "teacher" | "superadmin"; grade: number | null; active: boolean;
  class_id: number | null; class_name: string | null; classes: { id: number; name: string }[] | null;
};

const card = "rounded-xl bg-white p-5 shadow-sm";
const input = "rounded-lg border border-slate-300 px-3 py-2";
const btn = "rounded-lg px-4 py-2 font-semibold disabled:opacity-50";
const primary = `${btn} bg-indigo-600 text-white hover:bg-indigo-700`;
const subtle = "rounded-md border border-slate-300 px-2 py-1 text-sm hover:bg-slate-50";

export default function Admin() {
  const me = useMe("superadmin");
  const [tab, setTab] = useState<"classes" | "users" | "add">("classes");
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => {
    api<ClassRow[]>("/admin/classes").then(setClasses).catch(() => {});
    api<UserRow[]>("/admin/users").then(setUsers).catch(() => {});
  }, []);
  useEffect(() => { if (me) load(); }, [me, load]);

  /** Runs an API call, shows the outcome, reloads. Returns true on success. */
  const run = async (call: () => Promise<unknown>, done: string) => {
    try {
      await call();
      setMsg({ ok: true, text: done });
      load();
      return true;
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
      return false;
    }
  };

  const teachers = users.filter((u) => u.role === "teacher");
  const tabBtn = (id: typeof tab, label: string) => (
    <button onClick={() => { setTab(id); setMsg(null); }}
      className={`rounded-lg px-4 py-2 font-medium ${tab === id ? "bg-indigo-600 text-white" : "bg-white text-slate-700 hover:bg-slate-100"}`}>
      {label}
    </button>
  );

  return (
    <>
      <TopBar me={me}><span className="text-sm text-slate-500">Administrator</span></TopBar>
      <main className="mx-auto max-w-7xl space-y-5 p-6">
        <div className="flex flex-wrap gap-2">
          {tabBtn("classes", `Classes (${classes.length})`)}
          {tabBtn("users", `Users (${users.length})`)}
          {tabBtn("add", "Add users")}
          <div className="flex-1" />
          <Link href="/teacher" className="rounded-lg bg-white px-4 py-2 text-slate-700 hover:bg-slate-100">Student progress</Link>
        </div>
        {msg && <p className={`rounded-lg p-2 text-sm ${msg.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
        {tab === "classes" && <Classes classes={classes} teachers={teachers} run={run} />}
        {tab === "users" && <Users users={users} classes={classes} meId={me?.id} run={run} />}
        {tab === "add" && <AddUsers classes={classes} run={run} onDone={() => setTab("users")} />}
      </main>
    </>
  );
}

type Run = (call: () => Promise<unknown>, done: string) => Promise<boolean>;

function TeacherPicker({ teachers, value, onChange }: { teachers: UserRow[]; value: number[]; onChange: (ids: number[]) => void }) {
  if (!teachers.length) return <p className="text-sm text-slate-500">No teacher accounts yet. Add one under <b>Add users</b>.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {teachers.map((t) => (
        <label key={t.id} className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${value.includes(t.id) ? "border-indigo-400 bg-indigo-50" : "border-slate-300"}`}>
          <input type="checkbox" checked={value.includes(t.id)}
            onChange={(e) => onChange(e.target.checked ? [...value, t.id] : value.filter((x) => x !== t.id))} />
          {t.display_name}
        </label>
      ))}
    </div>
  );
}

function Classes({ classes, teachers, run }: { classes: ClassRow[]; teachers: UserRow[]; run: Run }) {
  const [name, setName] = useState("");
  const [teacherIds, setTeacherIds] = useState<number[]>([]);
  const [editing, setEditing] = useState<{ id: number; name: string; teacherIds: number[] } | null>(null);
  const [deleting, setDeleting] = useState<{ id: number; moveTo: number | "" } | null>(null);

  const create = async () => {
    if (await run(() => api("/admin/classes", { body: { name, teacherIds } }), `Class "${name}" created.`)) {
      setName("");
      setTeacherIds([]);
    }
  };
  const save = async () => {
    if (!editing) return;
    if (await run(() => api(`/admin/classes/${editing.id}`, { method: "PATCH", body: { name: editing.name, teacherIds: editing.teacherIds } }), "Class saved.")) {
      setEditing(null);
    }
  };

  return (
    <div className="space-y-5">
      <section className={`${card} space-y-3`}>
        <h2 className="text-lg font-bold">New class</h2>
        <input placeholder="Class name, e.g. 7B" value={name} onChange={(e) => setName(e.target.value)} className={`${input} w-full max-w-sm`} />
        <div>
          <p className="mb-1 text-sm font-medium">Teachers (at least one)</p>
          <TeacherPicker teachers={teachers} value={teacherIds} onChange={setTeacherIds} />
        </div>
        <button onClick={create} disabled={!name.trim() || !teacherIds.length} className={primary}>Create class</button>
      </section>

      {!classes.length && <p className={`${card} text-slate-600`}>No classes yet.</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {classes.map((c) => editing?.id === c.id ? (
          <section key={c.id} className={`${card} space-y-3 ring-2 ring-indigo-300`}>
            <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className={`${input} w-full`} />
            <TeacherPicker teachers={teachers} value={editing.teacherIds} onChange={(ids) => setEditing({ ...editing, teacherIds: ids })} />
            <div className="flex gap-2">
              <button onClick={save} disabled={!editing.name.trim() || !editing.teacherIds.length} className={primary}>Save</button>
              <button onClick={() => setEditing(null)} className={`${btn} bg-slate-200 hover:bg-slate-300`}>Cancel</button>
            </div>
          </section>
        ) : (
          <section key={c.id} className={card}>
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <h3 className="text-lg font-bold">{c.name}</h3>
                <p className="text-sm text-slate-500">{c.student_count} student{c.student_count === 1 ? "" : "s"}</p>
              </div>
              <button onClick={() => setEditing({ id: c.id, name: c.name, teacherIds: c.teachers.map((t) => t.id) })} className={subtle}>Edit</button>
              <button onClick={() => c.student_count
                  ? setDeleting({ id: c.id, moveTo: "" })
                  : confirm(`Delete class "${c.name}"?`) && run(() => api(`/admin/classes/${c.id}`, { method: "DELETE" }), `Class "${c.name}" deleted.`)}
                className={`${subtle} text-red-700`}>Delete</button>
            </div>
            <p className="mt-2 text-sm">
              <span className="text-slate-500">Teachers: </span>
              {c.teachers.length ? c.teachers.map((t) => t.display_name).join(", ") : <span className="text-red-600">none, assign one</span>}
            </p>
            {deleting?.id === c.id && (
              <div className="mt-3 space-y-2 rounded-lg bg-red-50 p-3 text-sm">
                <p className="font-medium text-red-800">"{c.name}" has {c.student_count} student{c.student_count === 1 ? "" : "s"}. What should happen to them?</p>
                <div className="flex flex-wrap items-center gap-2">
                  <select value={deleting.moveTo} onChange={(e) => setDeleting({ ...deleting, moveTo: e.target.value ? Number(e.target.value) : "" })}
                    className="rounded border border-slate-300 bg-white px-2 py-1">
                    <option value="">Move them to…</option>
                    {classes.filter((o) => o.id !== c.id).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                  <button disabled={!deleting.moveTo} className={`${subtle} bg-white`}
                    onClick={async () => {
                      const to = classes.find((o) => o.id === deleting.moveTo)?.name;
                      if (await run(() => api(`/admin/classes/${c.id}?moveTo=${deleting.moveTo}`, { method: "DELETE" }),
                        `Class "${c.name}" deleted; students moved to ${to}.`)) setDeleting(null);
                    }}>Move and delete class</button>
                  <button className={`${subtle} border-red-300 bg-white text-red-700`}
                    onClick={async () => {
                      if (!confirm(`Delete "${c.name}" AND its ${c.student_count} student account(s) with all their progress and code? This can't be undone.`)) return;
                      if (await run(() => api(`/admin/classes/${c.id}?deleteStudents=true`, { method: "DELETE" }),
                        `Class "${c.name}" and its students deleted.`)) setDeleting(null);
                    }}>Delete students too</button>
                  <button onClick={() => setDeleting(null)} className="text-slate-600 hover:underline">Cancel</button>
                </div>
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

const roleLabel = { superadmin: "Superadmin", teacher: "Teacher", student: "Student" };

function Users({ users, classes, meId, run }: { users: UserRow[]; classes: ClassRow[]; meId?: number; run: Run }) {
  const [filter, setFilter] = useState("");
  const domain = useSchoolDomain();
  const shown = users.filter((u) =>
    `${u.display_name} ${u.username} ${u.role} ${u.class_name ?? ""}`.toLowerCase().includes(filter.toLowerCase()));
  const patch = (u: UserRow, body: object, done: string) =>
    run(() => api(`/admin/users/${u.id}`, { method: "PATCH", body }), done);
  const resetPassword = (u: UserRow) => {
    const password = prompt(`New password for ${u.display_name} (4+ characters):`);
    if (password) patch(u, { password }, `Password reset for ${u.display_name}.`);
  };
  const rename = (u: UserRow) => {
    const hint = u.role === "student" ? `school email (@${domain})` : `school email (@${domain}) or username`;
    const next = prompt(`New login for ${u.display_name}: ${hint}`, u.username);
    if (next && next.trim().toLowerCase() !== u.username) {
      patch(u, { username: next }, `${u.display_name} now logs in as ${next.trim().toLowerCase()}.`);
    }
  };
  const remove = (u: UserRow) => {
    const what = u.role === "student" ? " and all their progress and code" : "";
    if (confirm(`Delete ${u.display_name} (${u.username})${what}? This can't be undone. To keep the account but block logins, use "Turn off" instead.`)) {
      run(() => api(`/admin/users/${u.id}`, { method: "DELETE" }), `${u.display_name} deleted.`);
    }
  };

  return (
    <div className="space-y-3">
      <input placeholder="Search by name, username, role or class…" value={filter} onChange={(e) => setFilter(e.target.value)}
        className={`${input} w-full max-w-sm`} />
      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr><th className="p-3">Name</th><th className="p-3">Role</th><th className="p-3">Class</th><th className="p-3">Grade</th><th className="p-3 text-right">Actions</th></tr>
          </thead>
          <tbody>
            {shown.map((u) => (
              <tr key={u.id} className={`border-t border-slate-100 ${u.active ? "" : "opacity-50"}`}>
                <td className="p-3">
                  {u.role === "student"
                    ? <Link href={`/teacher/student/${u.id}`} className="font-medium text-indigo-700 hover:underline">{u.display_name}</Link>
                    : <span className="font-medium">{u.display_name}</span>}
                  <span className="ml-2 text-slate-400">{u.username}</span>
                  {u.role === "student" && domain && !u.username.endsWith(`@${domain}`) && (
                    <button onClick={() => rename(u)} title="Students should log in with their school email"
                      className="ml-2 rounded bg-amber-100 px-1.5 text-xs text-amber-800 hover:bg-amber-200">not a school email</button>
                  )}
                  {!u.active && <span className="ml-2 text-xs text-red-600">off</span>}
                </td>
                <td className="p-3">{roleLabel[u.role]}</td>
                <td className="p-3">
                  {u.role === "student" ? (
                    <select value={u.class_id ?? ""} className="rounded border border-slate-300 px-1 py-0.5"
                      onChange={(e) => patch(u, { classId: Number(e.target.value) }, `${u.display_name} moved to ${classes.find((c) => c.id === Number(e.target.value))?.name}.`)}>
                      {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  ) : u.role === "teacher" ? (
                    u.classes?.length ? u.classes.map((c) => c.name).join(", ") : <span className="text-slate-400">no classes</span>
                  ) : <span className="text-slate-400">all</span>}
                </td>
                <td className="p-3">{u.role === "student" ? u.grade ?? "–" : ""}</td>
                <td className="space-x-1 p-3 text-right whitespace-nowrap">
                  <button onClick={() => rename(u)} className={subtle}>Change login</button>
                  <button onClick={() => resetPassword(u)} className={subtle}>Reset password</button>
                  {u.id !== meId && (
                    <button onClick={() => patch(u, { active: !u.active }, `${u.display_name} turned ${u.active ? "off" : "on"}.`)} className={subtle}>
                      {u.active ? "Turn off" : "Turn on"}
                    </button>
                  )}
                  {u.role !== "superadmin" && (
                    <button onClick={() => remove(u)} className={`${subtle} text-red-700`}>Delete</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-slate-500">To change which classes a teacher follows, edit the class under <b>Classes</b>.</p>
    </div>
  );
}

// Bulk add, one person per line.
// Students: "username, Display Name, grade, password"; teachers: "username, Display Name, password".
// A missing password defaults to the shared one.
function AddUsers({ classes, run, onDone }: { classes: ClassRow[]; run: Run; onDone: () => void }) {
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [classId, setClassId] = useState<number | "">("");
  const [teacherClassIds, setTeacherClassIds] = useState<number[]>([]);
  const [text, setText] = useState("");
  const [defaultPassword, setDefaultPassword] = useState("");
  const [error, setError] = useState("");
  const domain = useSchoolDomain();
  const d = domain || "school.ca";

  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const parsed = lines.map((line) => {
    const parts = line.split(",").map((x) => x.trim());
    const username = (parts[0] ?? "").toLowerCase();
    const displayName = parts[1] || username.split("@")[0];
    if (role === "student") {
      return { role, username, displayName, grade: parts[2] ? Number(parts[2]) : null, password: parts[3] || defaultPassword, classId: Number(classId) };
    }
    return { role, username, displayName, password: parts[2] || defaultPassword, classIds: teacherClassIds };
  });

  const submit = async () => {
    setError("");
    if (role === "student" && !classId) return setError("Pick the class these students belong to.");
    const notSchool = parsed.findIndex((u) => role === "student" && !u.username.endsWith(`@${domain}`));
    if (domain && notSchool >= 0) {
      return setError(`Line ${notSchool + 1}: students need a school email ending in @${domain}.`);
    }
    if (parsed.some((u) => !u.password || u.password.length < 4)) {
      return setError("Everyone needs a password of 4+ characters. Set a default password or add one per line.");
    }
    if (await run(() => api("/admin/users", { body: { users: parsed } }), `Created ${parsed.length} account${parsed.length === 1 ? "" : "s"}.`)) {
      setText("");
      onDone();
    }
  };

  return (
    <div className={`${card} max-w-3xl space-y-4`}>
      <div className="flex gap-2">
        {(["student", "teacher"] as const).map((r) => (
          <button key={r} onClick={() => setRole(r)}
            className={`rounded-lg px-4 py-2 font-medium ${role === r ? "bg-indigo-600 text-white" : "bg-slate-100 hover:bg-slate-200"}`}>
            {r === "student" ? "Students" : "Teachers"}
          </button>
        ))}
      </div>

      {role === "student" ? (
        <label className="block">
          <span className="text-sm font-medium">Class</span>
          {classes.length ? (
            <select value={classId} onChange={(e) => setClassId(e.target.value ? Number(e.target.value) : "")} className={`${input} mt-1 block`}>
              <option value="">Choose a class…</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          ) : <p className="text-sm text-red-700">Create a class first (it needs a teacher).</p>}
        </label>
      ) : (
        <div>
          <p className="mb-1 text-sm font-medium">Classes these teachers follow (optional)</p>
          <div className="flex flex-wrap gap-2">
            {classes.map((c) => (
              <label key={c.id} className="flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1 text-sm">
                <input type="checkbox" checked={teacherClassIds.includes(c.id)}
                  onChange={(e) => setTeacherClassIds(e.target.checked ? [...teacherClassIds, c.id] : teacherClassIds.filter((x) => x !== c.id))} />
                {c.name}
              </label>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-sm text-slate-600">
          One per line:{" "}
          <code className="rounded bg-slate-100 px-1">
            {role === "student" ? "school email, Display Name, grade, password" : "school email or username, Display Name, password"}
          </code>
          . {role === "student"
            ? <>Students must use their <b>@{d}</b> email. Grade and password are optional.</>
            : "Password is optional."} You can paste from a spreadsheet saved as CSV.
        </p>
        <textarea value={text} onChange={(e) => setText(e.target.value)}
          placeholder={role === "student"
            ? `ayilmaz@${d}, Ayşe Yılmaz, 6\nbkaya@${d}, Berk Kaya, 7, rocket42`
            : `mdemir@${d}, Mehmet Demir\nzarslan@${d}, Zeynep Arslan, teach2026`}
          className="mt-2 h-44 w-full rounded-lg border border-slate-300 p-3 font-mono text-sm" />
      </div>
      <label className="block">
        <span className="text-sm font-medium">Default password for lines without one</span>
        <input value={defaultPassword} onChange={(e) => setDefaultPassword(e.target.value)} className={`${input} mt-1 block w-full max-w-xs`} />
      </label>
      {error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      <button onClick={submit} disabled={!parsed.length} className={primary}>
        Create {parsed.length || ""} {role} account{parsed.length === 1 ? "" : "s"}
      </button>
    </div>
  );
}
