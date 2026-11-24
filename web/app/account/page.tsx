"use client";
import { useState } from "react";
import TopBar from "@/components/TopBar";
import { api } from "@/lib/api";
import { useMe } from "@/lib/useMe";

export default function Account() {
  const me = useMe();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api("/me/password", { body: { current, next } });
      setMsg({ ok: true, text: "Password changed." });
      setCurrent("");
      setNext("");
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    }
  };

  return (
    <>
      <TopBar me={me} />
      <main className="mx-auto max-w-md p-6">
        <h1 className="mb-4 text-2xl font-bold">My account</h1>
        {me && <p className="mb-6 text-slate-600">Logged in as <b>{me.username}</b></p>}
        <form onSubmit={submit} className="space-y-3 rounded-xl bg-white p-5 shadow-sm">
          <h2 className="font-semibold">Change password</h2>
          <input type="password" placeholder="Current password" value={current} onChange={(e) => setCurrent(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2" />
          <input type="password" placeholder="New password (4+ characters)" value={next} onChange={(e) => setNext(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2" />
          {msg && <p className={msg.ok ? "text-green-700" : "text-red-700"}>{msg.text}</p>}
          <button className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700">Save</button>
        </form>
      </main>
    </>
  );
}
