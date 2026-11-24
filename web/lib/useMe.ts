"use client";
import { useEffect, useState } from "react";
import { api, type Me } from "./api";

/** Loads the logged-in user. Redirects to /login if not logged in (handled in api()). */
export function useMe(requireRole?: "teacher" | "student") {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    api<Me>("/me").then((m) => {
      if (requireRole === "teacher" && m.role !== "teacher") location.href = "/dashboard";
      else setMe(m);
    }).catch(() => {});
  }, [requireRole]);
  return me;
}
