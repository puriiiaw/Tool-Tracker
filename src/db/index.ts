import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { hashPassword } from "@/lib/password";
import { categoryFor } from "@/lib/category";

const DB_PATH = path.join(process.cwd(), "data", "tracker.db");

function open() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(fs.readFileSync(path.join(process.cwd(), "src", "db", "schema.sql"), "utf8"));
  // Columns added after the first release; CREATE TABLE IF NOT EXISTS does not add them.
  const cols = (t: string) => (db.pragma(`table_info(${t})`) as { name: string }[]).map((c) => c.name);
  if (!cols("tool").includes("category")) db.exec("ALTER TABLE tool ADD COLUMN category TEXT");
  if (!cols("return_event").includes("voided")) db.exec("ALTER TABLE return_event ADD COLUMN voided INTEGER NOT NULL DEFAULT 0");
  if (!cols("checkout_line").includes("removed")) db.exec("ALTER TABLE checkout_line ADD COLUMN removed INTEGER NOT NULL DEFAULT 0");
  if (!cols("tool").includes("created_by")) db.exec("ALTER TABLE tool ADD COLUMN created_by INTEGER REFERENCES user(id)");
  if (!cols("worker").includes("hidden")) db.exec("ALTER TABLE worker ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0");
  const upd = db.prepare("UPDATE tool SET category = ? WHERE id = ?");
  for (const t of db.prepare("SELECT id, name FROM tool WHERE category IS NULL").all() as { id: number; name: string }[]) upd.run(categoryFor(t.name), t.id);
  // First run: seed a super-admin so the owner can log in and change it.
  if (!db.prepare("SELECT 1 FROM user LIMIT 1").get()) {
    db.prepare(
      "INSERT OR IGNORE INTO user (email, password_hash, name, role) VALUES (?, ?, ?, 'super_admin')"
    ).run("admin", hashPassword("admin"), "Site Admin");
  }
  return db;
}

// Next dev reloads modules; keep one connection on the global object.
const g = globalThis as unknown as { __db?: Database.Database };
export const db = g.__db ?? (g.__db = open());
