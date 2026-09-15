// One-off, pre-launch: empties tools, checkouts, returns and imports (and their audit rows). Accounts and workers stay.
// Run: node scripts/reset-inventory.mjs   then start the app; schema.sql recreates the tables in their new shape.
import Database from "better-sqlite3";

const db = new Database("data/tracker.db");
db.pragma("foreign_keys = OFF");
db.transaction(() => {
  db.exec("DROP TRIGGER IF EXISTS audit_log_no_delete");
  db.exec("DELETE FROM audit_log WHERE entity IN ('tool', 'tool_unit', 'checkout', 'return_event', 'import_run', 'translation')");
  for (const t of ["checkout_line_unit", "return_event", "checkout_line", "checkout", "tool_unit", "tool", "translation", "import_run"])
    db.exec(`DROP TABLE IF EXISTS ${t}`);
})();
db.exec("VACUUM");
console.log("Inventory and checkouts cleared. Users and workers kept:", db.prepare("SELECT (SELECT COUNT(*) FROM user) AS users, (SELECT COUNT(*) FROM worker) AS workers").get());
