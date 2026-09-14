import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";

const COOKIE = "session";
const THIRTY_DAYS = 30 * 24 * 60 * 60;

export type User = {
  id: number;
  email: string;
  name: string;
  role: "super_admin" | "admin";
  active: number;
};

export async function getUser(): Promise<User | null> {
  const id = (await cookies()).get(COOKIE)?.value;
  if (!id) return null;
  return (
    (db
      .prepare(
        `SELECT u.id, u.email, u.name, u.role, u.active FROM session s
         JOIN user u ON u.id = s.user_id
         WHERE s.id = ? AND s.expires_at > datetime('now') AND u.active = 1`
      )
      .get(id) as User | undefined) ?? null
  );
}

export async function requireUser(role?: "super_admin"): Promise<User> {
  const user = await getUser();
  if (!user) redirect("/login");
  if (role && user.role !== role) redirect("/");
  return user;
}

export async function startSession(userId: number) {
  const id = randomBytes(32).toString("hex");
  db.prepare(
    "INSERT INTO session (id, user_id, expires_at) VALUES (?, ?, datetime('now', '+30 days'))"
  ).run(id, userId);
  (await cookies()).set(COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: THIRTY_DAYS,
    path: "/",
  });
}

export async function endSession() {
  const store = await cookies();
  const id = store.get(COOKIE)?.value;
  if (id) db.prepare("UPDATE session SET expires_at = datetime('now') WHERE id = ?").run(id);
  store.set(COOKIE, "", { maxAge: 0, path: "/" });
}
