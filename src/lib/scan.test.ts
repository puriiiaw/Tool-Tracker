// Run: npm test. A scanned battery is out until its own tag is scanned back, a count-only return closes the line,
// and a voided return puts the tag back out.
import assert from "node:assert/strict";
import { test } from "node:test";
import Database from "better-sqlite3";
import fs from "node:fs";

test("unit holder follows scanned returns, voids and count-only returns", () => {
  const db = new Database(":memory:");
  db.exec(fs.readFileSync("src/db/schema.sql", "utf8"));
  db.exec(`
    INSERT INTO user (id, email, password_hash, name, role) VALUES (1, 'a', 'x', 'A', 'admin');
    INSERT INTO worker (id, name) VALUES (1, 'Ali');
    INSERT INTO tool (id, name, item_type, total_qty) VALUES (1, 'Battery', 'quantity', 3);
    INSERT INTO tool_unit (id, tool_id, scan_code) VALUES (1, 1, '111'), (2, 1, '222'), (3, 1, '333');
    INSERT INTO checkout (id, worker_id, created_by) VALUES (1, 1, 1);
    INSERT INTO checkout_line (id, checkout_id, tool_id, qty_out) VALUES (1, 1, 1, 3);
    INSERT INTO checkout_line_unit (id, checkout_line_id, tool_unit_id) VALUES (1, 1, 1), (2, 1, 2), (3, 1, 3);
  `);
  const sql = fs.readFileSync("src/lib/scan.ts", "utf8");
  // Pull the SQL out of the module without importing it (the module opens the real database).
  const live = /const LIVE_LINE = `([^`]+)`/.exec(sql)![1];
  const holder = /UNIT_HOLDER_SQL = `([^`]+)`/.exec(sql)![1].replace("${LIVE_LINE}", live);
  const who = (u: number) => (db.prepare(holder).get(u) as { worker: string } | undefined)?.worker ?? null;

  assert.equal(who(1), "Ali");
  // Tag 1 scanned back.
  db.exec("INSERT INTO return_event (id, checkout_line_id, qty, outcome, created_by) VALUES (1, 1, 1, 'returned', 1)");
  db.exec("UPDATE checkout_line_unit SET return_event_id = 1 WHERE id = 1");
  assert.equal(who(1), null);
  assert.equal(who(2), "Ali");
  // That return was a mistake.
  db.exec("UPDATE return_event SET voided = 1 WHERE id = 1");
  assert.equal(who(1), "Ali");
  // Everything comes back by count, no scan: nothing is out, even though no tag was named.
  db.exec("INSERT INTO return_event (checkout_line_id, qty, outcome, created_by) VALUES (1, 3, 'returned', 1)");
  assert.equal(who(1), null);
  assert.equal(who(3), null);
});
