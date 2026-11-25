// Rules for login names. Students log in with their school email; staff may use
// a school email or a short username (e.g. "admin"). Any email must be on the school domain.
import { z } from "zod";

export const SCHOOL_DOMAIN = (process.env.SCHOOL_EMAIL_DOMAIN || "gobindsarvar.ca").trim().toLowerCase();

const escaped = SCHOOL_DOMAIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const schoolEmail = new RegExp(`^[a-z0-9._%+-]+@${escaped}$`);
const plainUsername = /^[a-z0-9._-]{2,32}$/;

export const isSchoolEmail = (s: string) => schoolEmail.test(s);

const login = z.string().trim().toLowerCase().max(254);

export const studentLogin = login.refine(isSchoolEmail, {
  message: `Students need a school email ending in @${SCHOOL_DOMAIN}.`,
});

export const staffLogin = login.refine((s) => isSchoolEmail(s) || plainUsername.test(s), {
  message: `Use a school email (@${SCHOOL_DOMAIN}) or a username of letters, numbers, . _ - (2-32).`,
});

export const loginFor = (role: string) => (role === "student" ? studentLogin : staffLogin);
