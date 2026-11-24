"use client";
import { useState } from "react";
import { api } from "@/lib/api";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { role } = await api<{ role: string }>("/auth/login", { body: { username, password } });
      location.href = role === "teacher" ? "/teacher" : "/dashboard";
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-full items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-8 shadow-xl">
        <div className="text-center">
          <div className="text-5xl">🥋</div>
          <h1 className="mt-2 text-2xl font-bold">Code Lab</h1>
          <p className="text-slate-500">Earn your belts, one lesson at a time.</p>
        </div>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Username</span>
          <input
            autoFocus autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-lg focus:border-indigo-500 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Password</span>
          <input
            type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-lg focus:border-indigo-500 focus:outline-none"
          />
        </label>
        {error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        <button
          disabled={busy || !username || !password}
          className="w-full rounded-lg bg-indigo-600 py-2.5 text-lg font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {busy ? "Logging in…" : "Log in"}
        </button>
      </form>
    </main>
  );
}
