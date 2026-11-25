"use client";
import { useEffect, useState } from "react";
import { getConfig } from "./api";

export function useSchoolDomain() {
  const [domain, setDomain] = useState("");
  useEffect(() => { getConfig().then((c) => setDomain(c.schoolDomain)).catch(() => {}); }, []);
  return domain;
}
