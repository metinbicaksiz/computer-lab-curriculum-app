"use client";
import { useEffect } from "react";
import { api, type Me } from "@/lib/api";

// Send people to the right home page.
export default function Home() {
  useEffect(() => {
    api<Me>("/me")
      .then((me) => location.replace(me.role === "teacher" ? "/teacher" : "/dashboard"))
      .catch(() => location.replace("/login"));
  }, []);
  return null;
}
