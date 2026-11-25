"use client";
import { useEffect, useState } from "react";
import { api, homeFor, type Me } from "./api";

/**
 * Loads the logged-in user. Redirects to /login if not logged in (handled in api()).
 * "staff" = teachers and the superadmin. Anyone without the required role goes to their own home page.
 */
export function useMe(requireRole?: "staff" | "superadmin") {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    api<Me>("/me").then((m) => {
      const allowed = !requireRole
        || (requireRole === "staff" && m.role !== "student")
        || (requireRole === "superadmin" && m.role === "superadmin");
      if (allowed) setMe(m);
      else location.href = homeFor(m.role);
    }).catch(() => {});
  }, [requireRole]);
  return me;
}
