// Run: npm test. Queued phone items: applied once, partial on clashes, stale returns refused, new names merged.
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import Database from "better-sqlite3";
import { applyItem, type QItem } from "./sync.ts";
import { withQueue } from "./overlay.ts";

const NOW = new Date("2026-10-02T12:00:00Z");
const setup = () => {
  const db = new Database(":memory:");
  db.exec(fs.readFileSync("src/db/schema.sql", "utf8"));
  db.exec(`
    INSERT INTO user (id, email, password_hash, name, role) VALUES (1, 'a', 'x', 'A', 'admin');
    INSERT INTO worker (id, name) VALUES (1, 'Sam'), (2, 'Mike');
    INSERT INTO tool (id, name, scan_code) VALUES (1, 'Drill', '100000001'), (2, 'Saw', '100000002'), (3, 'Laser', '100000003');
  `);
  return db;
};
const co = (id: string, at: string, worker: number, tools: number[]): QItem => ({
  id, at, kind: "checkout", worker: { id: worker, name: worker === 1 ? "Sam" : "Mike" }, note: "", lines: tools.map((toolId) => ({ toolId, longTerm: false })),
});
const count = (db: Database.Database, sql: string) => db.prepare(sql).pluck().get() as number;

test("a retried send is applied once", () => {
  const db = setup();
  const item = co("a1", "2026-10-02T09:00:00Z", 1, [1, 2]);
  assert.equal(applyItem(db, 1, item, NOW).outcome, "done");
  assert.equal(applyItem(db, 1, item, NOW).outcome, "done");
  assert.equal(count(db, "SELECT count(*) FROM checkout"), 1);
  assert.equal(count(db, "SELECT count(*) FROM checkout_line"), 2);
  assert.equal(db.prepare("SELECT created_at FROM checkout").pluck().get(), "2026-10-02 09:00:00"); // tap time, not arrival
});

test("clash: free tools are saved, the tool already out becomes an attention item", () => {
  const db = setup();
  applyItem(db, 1, co("a1", "2026-10-02T09:00:00Z", 1, [2]), NOW);
  const r = applyItem(db, 1, co("b1", "2026-10-02T09:05:00Z", 2, [1, 2]), NOW);
  assert.equal(r.outcome, "done");
  assert.equal(count(db, "SELECT count(*) FROM checkout_line cl JOIN checkout c ON c.id = cl.checkout_id WHERE c.worker_id = 2"), 1);
  const a = db.prepare("SELECT worker_id, tool_id, resolution FROM attention").get();
  assert.deepEqual(a, { worker_id: 2, tool_id: 2, resolution: null });
  assert.match(r.messages[0], /already out to Sam/);
});

test("a return only closes the line that was out when it was recorded, and only that one", () => {
  const db = setup();
  applyItem(db, 1, co("a1", "2026-10-02T09:00:00Z", 1, [1, 2, 3]), NOW);
  assert.equal(applyItem(db, 1, { id: "r1", at: "2026-10-02T10:00:00Z", kind: "return", toolId: 1 }, NOW).outcome, "done");
  assert.equal(count(db, "SELECT count(*) FROM return_event"), 1); // Sam's other two stay out
  assert.equal(applyItem(db, 1, { id: "r2", at: "2026-10-02T10:01:00Z", kind: "return", toolId: 1 }, NOW).outcome, "ignored"); // already back
  applyItem(db, 1, co("b1", "2026-10-02T11:00:00Z", 2, [1]), NOW); // Mike takes it
  const stale = applyItem(db, 1, { id: "r3", at: "2026-10-02T10:30:00Z", kind: "return", toolId: 1 }, NOW); // old phone, tapped before Mike
  assert.equal(stale.outcome, "rejected");
  assert.equal(count(db, "SELECT count(*) FROM return_event"), 1); // Mike still has it
});

test("new worker and new tool made offline merge by name and scan code", () => {
  const db = setup();
  const item = (id: string): QItem => ({
    id, at: "2026-10-02T09:00:00Z", kind: "checkout", worker: { id: -5, name: "  Zed   Ng " }, note: "",
    lines: [{ toolId: -7, longTerm: false, newTool: { code: "999999999", name: "Grinder" } }],
  });
  applyItem(db, 1, item("n1"), NOW);
  assert.equal(count(db, "SELECT count(*) FROM worker WHERE name = 'Zed Ng'"), 1);
  assert.equal(count(db, "SELECT count(*) FROM tool WHERE scan_code = '999999999'"), 1);
  applyItem(db, 1, item("n2"), NOW); // second phone adds the same names
  assert.equal(count(db, "SELECT count(*) FROM worker WHERE name = 'Zed Ng'"), 1);
  assert.equal(count(db, "SELECT count(*) FROM tool WHERE scan_code = '999999999'"), 1);
});

test("an inactive worker's checkout is refused, and a clock far in the future is ignored", () => {
  const db = setup();
  db.exec("UPDATE worker SET active = 0 WHERE id = 1");
  assert.equal(applyItem(db, 1, co("x1", "2026-10-02T09:00:00Z", 1, [1]), NOW).outcome, "rejected");
  assert.equal(count(db, "SELECT count(*) FROM checkout"), 0);
  applyItem(db, 1, co("x2", "2030-01-01T00:00:00Z", 2, [3]), NOW);
  assert.equal(db.prepare("SELECT created_at FROM checkout").pluck().get(), "2026-10-02 12:00:00");
});

test("the phone's queue marks tools out or back in its own copy of the list", () => {
  const tools = [{ id: 1, out_to: null as string | null }, { id: 2, out_to: "Sam" as string | null }];
  const q: QItem[] = [co("a", "t", 2, [1]), { id: "r", at: "t", kind: "return", toolId: 2 }];
  assert.deepEqual(withQueue(tools, q), [{ id: 1, out_to: "Mike" }, { id: 2, out_to: null }]);
});
