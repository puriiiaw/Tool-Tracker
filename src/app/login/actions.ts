"use server";

import { redirect } from "next/navigation";
import { db } from "@/db";
import { verifyPassword } from "@/lib/password";
import { startSession, endSession } from "@/lib/auth";

export async function login(_prev: { error: string } | null, form: FormData) {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const user = db
    .prepare("SELECT id, password_hash, active FROM user WHERE email = ?")
    .get(email) as { id: number; password_hash: string; active: number } | undefined;
  if (!user || !user.active || !verifyPassword(password, user.password_hash)) {
    return { error: "Wrong email or password." };
  }
  await startSession(user.id);
  redirect("/");
}

export async function logout() {
  await endSession();
  redirect("/login");
}
