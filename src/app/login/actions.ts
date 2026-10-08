"use server";

import { redirect } from "next/navigation";
import { db } from "@/db";
import { verifyPassword } from "@/lib/password";
import { startSession, endSession } from "@/lib/auth";
import { makeThrottle } from "@/lib/throttle";

const throttle = makeThrottle();

export async function login(_prev: { error: string } | null, form: FormData) {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const key = email.toLowerCase();
  if (throttle.locked(key)) return { error: "Too many wrong tries. Wait 15 minutes, or ask the super-admin." };
  const user = db
    .prepare("SELECT id, password_hash, active FROM user WHERE email = ?")
    .get(email) as { id: number; password_hash: string; active: number } | undefined;
  if (!user || !user.active || !verifyPassword(password, user.password_hash)) {
    throttle.fail(key);
    return { error: "Wrong email or password." };
  }
  throttle.ok(key);
  await startSession(user.id);
  redirect("/");
}

export async function logout() {
  await endSession();
  redirect("/login");
}
