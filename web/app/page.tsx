"use client";
import { useEffect } from "react";
import { api, homeFor, type Me } from "@/lib/api";

// Send people to the right home page.
export default function Home() {
  useEffect(() => {
    api<Me>("/me")
      .then((me) => location.replace(homeFor(me.role)))
      .catch(() => location.replace("/login"));
  }, []);
  return null;
}
