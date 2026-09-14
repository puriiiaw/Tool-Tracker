"use server";

import { redirect } from "next/navigation";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { hashPassword } from "@/lib/password";

type Row = { id: number; email: string; name: string; role: string; active: number };
const getRow = db.prepare("SELECT id, email, name, role, active FROM user WHERE id = ?");

function done(msg: string): never {
  redirect(`/accounts?msg=${encodeURIComponent(msg)}`);
}

export async function createAccount(form: FormData) {
  const actor = await requireUser("super_admin");
  const email = String(form.get("email") ?? "").trim();
  const name = String(form.get("name") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const role = form.get("role") === "super_admin" ? "super_admin" : "admin";
  if (!email || !name || password.length < 6) done("Email, name and a password of 6+ characters are required.");
  if (db.prepare("SELECT 1 FROM user WHERE email = ?").get(email)) done("That email already has an account.");
  db.transaction(() => {
    const id = Number(
      db.prepare("INSERT INTO user (email, password_hash, name, role) VALUES (?, ?, ?, ?)")
        .run(email, hashPassword(password), name, role).lastInsertRowid
    );
    audit(actor.id, "user", id, "create", null, getRow.get(id));
  })();
  done(`Account created for ${name}.`);
}

export async function setPassword(form: FormData) {
  const actor = await requireUser("super_admin");
  const id = Number(form.get("id"));
  const password = String(form.get("password") ?? "");
  if (password.length < 6) done("Password must be 6+ characters.");
  db.transaction(() => {
    db.prepare("UPDATE user SET password_hash = ? WHERE id = ?").run(hashPassword(password), id);
    db.prepare("UPDATE session SET expires_at = datetime('now') WHERE user_id = ?").run(id);
    audit(actor.id, "user", id, "set_password", null, null);
  })();
  done("Password changed. That person must sign in again.");
}

export async function setActive(form: FormData) {
  const actor = await requireUser("super_admin");
  const id = Number(form.get("id"));
  const active = form.get("active") === "1" ? 1 : 0;
  if (id === actor.id) done("You cannot disable your own account.");
  db.transaction(() => {
    const before = getRow.get(id) as Row;
    db.prepare("UPDATE user SET active = ? WHERE id = ?").run(active, id);
    if (!active) db.prepare("UPDATE session SET expires_at = datetime('now') WHERE user_id = ?").run(id);
    audit(actor.id, "user", id, active ? "enable" : "disable", before, getRow.get(id));
  })();
  done(active ? "Account enabled." : "Account disabled.");
}
