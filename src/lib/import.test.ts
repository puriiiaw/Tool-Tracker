// Run: npm test. Import plan and apply against a throwaway database; set ASSETS_XLSX to also run the real export.
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import Database from "better-sqlite3";
import { applyImport, parseExport, planImport, type ExportRow } from "./import.ts";

function fresh() {
  const db = new Database(":memory:");
  db.exec(fs.readFileSync("src/db/schema.sql", "utf8"));
  db.exec(`
    INSERT INTO user (id, email, password_hash, name, role) VALUES (1, 'a', 'x', 'A', 'super_admin');
    INSERT INTO tool (id, name, scan_code, serial_number) VALUES (1, 'Old drill name', '100', 'S1');
    INSERT INTO tool (id, name, scan_code, created_by) VALUES (2, 'Gone laser', '200', 1);
    INSERT INTO worker (id, name) VALUES (1, 'Bob');
    INSERT INTO checkout (id, worker_id, created_by) VALUES (1, 1, 1);
    INSERT INTO checkout_line (checkout_id, tool_id) VALUES (1, 2);
  `);
  return db;
}

const rows: ExportRow[] = [
  { name: "Battery Nuron B 22-85", scan_code: "301", serial_number: null, manufacturer: "Hilti", model: "Battery Nuron B 22-85" },
  { name: null, scan_code: "302", serial_number: null, manufacturer: "Hilti", model: "Battery Nuron B 22-85" },
  { name: "Cordless impact driver SID 6-22", scan_code: "100", serial_number: "S1", manufacturer: "Hilti", model: "SID 6-22" },
];

test("plan: adds new codes only, updates changed, flags missing, keeps checkouts", () => {
  const db = fresh();
  const plan = planImport(db, rows);
  assert.equal(plan.counts.new, 2);
  assert.equal(plan.counts.updated, 1); // drill renamed
  assert.equal(plan.counts.missing, 1); // laser
  assert.equal(plan.updated[0].changes.name[1], "Cordless impact driver SID 6-22");

  applyImport(db, plan, 1, "test.xlsx");
  const blank = db.prepare("SELECT name, import_flag, category FROM tool WHERE scan_code = '302'").get() as { name: string; import_flag: string; category: string };
  assert.equal(blank.name, "Battery Nuron B 22-85"); // model column fills a blank name
  assert.match(blank.import_flag, /blank name/);
  assert.equal(blank.category, "Batteries");
  assert.equal((db.prepare("SELECT import_flag FROM tool WHERE id = 2").get() as { import_flag: string }).import_flag, "added on site, not in ON!Track");
  assert.equal((db.prepare("SELECT status FROM tool WHERE id = 2").get() as { status: string }).status, "active");
  assert.equal(db.prepare("SELECT COUNT(*) FROM return_event").pluck().get(), 0);

  // Same file again: nothing new, nothing updated.
  const again = planImport(db, rows);
  assert.equal(again.counts.new, 0);
  assert.equal(again.counts.updated, 0);
  assert.equal(again.counts.unchanged, 3);
});

const REAL = process.env.ASSETS_XLSX;
test("real export: every row becomes one tool, a second upload adds nothing", { skip: !REAL || !fs.existsSync(REAL) }, () => {
  const db = fresh();
  const real = parseExport(fs.readFileSync(REAL!));
  const first = planImport(db, real);
  assert.equal(first.counts.new, real.length);
  applyImport(db, first, 1, "Assets_Details.xlsx");
  assert.equal(db.prepare("SELECT COUNT(*) FROM tool").pluck().get(), real.length + 2); // plus the two fixture tools
  const second = planImport(db, real);
  assert.deepEqual([second.counts.new, second.counts.updated], [0, 0]);
});
