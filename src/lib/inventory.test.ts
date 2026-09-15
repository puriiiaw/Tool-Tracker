// Run: npm test. Checks the on-hand maths against a throwaway database.
import assert from "node:assert/strict";
import { test } from "node:test";
import Database from "better-sqlite3";
import fs from "node:fs";

test("on-hand is 1 minus out minus damaged minus lost, out_to names the holder", () => {
  const db = new Database(":memory:");
  db.exec(fs.readFileSync("src/db/schema.sql", "utf8"));
  db.exec(`
    INSERT INTO user (id, email, password_hash, name, role) VALUES (1, 'a', 'x', 'A', 'admin');
    INSERT INTO worker (id, name) VALUES (1, 'Bob');
    INSERT INTO tool (id, name, scan_code) VALUES (1, 'Battery', '1'), (2, 'Drill', '2'), (3, 'Saw', '3');
    INSERT INTO checkout (id, worker_id, created_by) VALUES (1, 1, 1);
    INSERT INTO checkout_line (id, checkout_id, tool_id) VALUES (1, 1, 1), (2, 1, 2), (3, 1, 3);
    INSERT INTO return_event (checkout_line_id, qty, outcome, created_by) VALUES (1, 1, 'damaged', 1), (3, 1, 'returned', 1);
  `);
  const sql = fs.readFileSync("src/db/stock.sql", "utf8");
  const rows = db.prepare(`${sql} ORDER BY t.id`).all() as { on_hand: number; out_qty: number; damaged_qty: number; out_to: string | null }[];
  assert.equal(rows[0].damaged_qty, 1);
  assert.equal(rows[0].on_hand, 0);
  assert.equal(rows[0].out_to, null);
  assert.equal(rows[1].out_qty, 1);
  assert.equal(rows[1].on_hand, 0);
  assert.equal(rows[1].out_to, "Bob");
  assert.equal(rows[2].on_hand, 1);
});
