import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { hashPassword } from "@/lib/password";

const DB_PATH = path.join(process.cwd(), "data", "tracker.db");

function open() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(fs.readFileSync(path.join(process.cwd(), "src", "db", "schema.sql"), "utf8"));
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
