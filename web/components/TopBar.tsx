"use client";
import Link from "next/link";
import { api, homeFor, type Me } from "@/lib/api";

export default function TopBar({ me, children }: { me: Me | null; children?: React.ReactNode }) {
  const logout = async () => {
    await api("/auth/logout", { method: "POST" });
    location.href = "/login";
  };
  return (
    <header className="flex items-center gap-4 border-b border-slate-200 bg-white px-4 py-2">
      <Link href={me ? homeFor(me.role) : "/dashboard"} className="text-lg font-bold text-indigo-600">
        🥋 Code Lab
      </Link>
      <div className="flex flex-1 items-center gap-3">{children}</div>
      {me && (
        <div className="flex items-center gap-3 text-sm">
          {me.role === "student" && <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">⭐ {me.xp} XP</span>}
          <Link href="/account" className="text-slate-600 hover:underline">{me.display_name}</Link>
          <button onClick={logout} className="rounded-md border border-slate-300 px-2 py-1 text-slate-600 hover:bg-slate-50">
            Log out
          </button>
        </div>
      )}
    </header>
  );
}
