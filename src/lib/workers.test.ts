// Run: npm test. Worker file parsing, the import plan and reactivation against a throwaway database.
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import Database from "better-sqlite3";
import { applyWorkerImport, parseWorkerFile, planWorkerImport, upsertWorker, workerTemplate } from "./workers.ts";

test("template parses back to its example names; plan adds, skips, reactivates and warns", () => {
  const db = new Database(":memory:");
  db.exec(fs.readFileSync("src/db/schema.sql", "utf8"));
  db.exec(`
    INSERT INTO user (id, email, password_hash, name, role) VALUES (1, 'a', 'x', 'A', 'super_admin');
    INSERT INTO worker (id, name, active, hidden) VALUES (1, 'Jane Smith', 1, 0), (2, 'Marc Tremblay', 0, 1), (3, 'John Doe', 1, 0);
  `);
  assert.deepEqual(parseWorkerFile(workerTemplate()), ["Jane Smith", "Marc Tremblay"]);

  const plan = planWorkerImport(db, ["jane  smith", "Marc Tremblay", "John Doe Jr", "Ali Khan", "Ali Khan"]);
  assert.equal(plan.existing, 1); // Jane, case and spacing ignored
  assert.deepEqual(plan.reactivate.map((w) => w.id), [2]); // Marc was hidden
  assert.deepEqual(plan.add, ["John Doe Jr", "Ali Khan", "Ali Khan"]);
  assert.deepEqual(plan.similar, [{ name: "John Doe Jr", like: "John Doe" }]);

  applyWorkerImport(db, plan, 1);
  const rows = db.prepare("SELECT name, active, hidden FROM worker ORDER BY id").all() as { name: string; active: number; hidden: number }[];
  assert.equal(rows.length, 5); // duplicate Ali Khan collapsed by upsert
  assert.deepEqual(rows[1], { name: "Marc Tremblay", active: 1, hidden: 0 });
  assert.equal(upsertWorker(db, "ALI KHAN", 1), 5); // same person, not a sixth row
});
