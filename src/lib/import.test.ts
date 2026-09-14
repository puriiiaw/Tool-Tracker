// Run: npm test. Import plan and apply against a throwaway database.
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import Database from "better-sqlite3";
import { applyImport, planImport, type ExportRow } from "./import.ts";

function fresh() {
  const db = new Database(":memory:");
  db.exec(fs.readFileSync("src/db/schema.sql", "utf8"));
  db.exec(`
    INSERT INTO user (id, email, password_hash, name, role) VALUES (1, 'a', 'x', 'A', 'super_admin');
    INSERT INTO tool (id, name, scan_code, serial_number, item_type) VALUES (1, 'Old drill name', '100', 'S1', 'unique');
    INSERT INTO tool (id, name, scan_code, item_type) VALUES (2, 'Gone laser', '200', 'unique');
    INSERT INTO worker (id, name) VALUES (1, 'Bob');
    INSERT INTO checkout (id, worker_id, created_by) VALUES (1, 1, 1);
    INSERT INTO checkout_line (checkout_id, tool_id, qty_out) VALUES (1, 2, 1);
  `);
  return db;
}

const rows: ExportRow[] = [
  { name: "Batterie Nuron B 22-85", scan_code: "301", serial_number: null, manufacturer: "Hilti", model: "Batterie Nuron B 22-85" },
  { name: null, scan_code: "302", serial_number: null, manufacturer: "Hilti", model: "Batterie Nuron B 22-85" },
  { name: "Visseuse à chocs sans fil SID 6-22", scan_code: "100", serial_number: "S1", manufacturer: "Hilti", model: "SID 6-22" },
  { name: "Mystery gadget", scan_code: "400", serial_number: null, manufacturer: null, model: null },
];

test("plan: translates, groups batteries, updates, flags missing, keeps checkouts", () => {
  const db = fresh();
  const plan = planImport(db, rows);
  assert.equal(plan.counts.new, 3); // 2 battery units + gadget
  assert.equal(plan.counts.updated, 1); // drill renamed
  assert.equal(plan.counts.missing, 1); // laser
  assert.equal(plan.quantityGroups[0].name, "Battery Nuron B 22-85");
  assert.equal(plan.quantityGroups[0].newUnits.length, 2);
  assert.equal(plan.updatedUnique[0].changes.name[1], "Cordless impact driver SID 6-22");
  assert.ok(plan.names.find((n) => n.source === "Mystery gadget" && !n.known));

  applyImport(db, plan, 1, "test.xlsx");
  const battery = db.prepare("SELECT total_qty, import_flag FROM tool WHERE name = 'Battery Nuron B 22-85'").get() as { total_qty: number; import_flag: string };
  assert.equal(battery.total_qty, 2);
  assert.match(battery.import_flag, /blank name/);
  assert.equal((db.prepare("SELECT import_flag FROM tool WHERE id = 2").get() as { import_flag: string }).import_flag, "not in latest export");
  assert.equal((db.prepare("SELECT status FROM tool WHERE id = 2").get() as { status: string }).status, "active");
  assert.equal(db.prepare("SELECT COUNT(*) c FROM return_event").pluck().get(), 0);
  assert.equal(db.prepare("SELECT COUNT(*) c FROM import_run").pluck().get(), 1);

  // Second run of the same file: nothing new.
  const again = planImport(db, rows);
  assert.equal(again.counts.new, 0);
  assert.equal(again.counts.updated, 0);
});
