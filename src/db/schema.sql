CREATE TABLE IF NOT EXISTS site (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user (
  id INTEGER PRIMARY KEY,
  site_id INTEGER NOT NULL DEFAULT 1,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS session (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES user(id),
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS worker (
  id INTEGER PRIMARY KEY,
  site_id INTEGER NOT NULL DEFAULT 1,
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_by INTEGER REFERENCES user(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Unique tools: one row per physical tool, scan_code on the row.
-- Quantity tools: one row per model with total_qty; individual scan codes live in tool_unit.
CREATE TABLE IF NOT EXISTS tool (
  id INTEGER PRIMARY KEY,
  site_id INTEGER NOT NULL DEFAULT 1,
  name TEXT NOT NULL,
  scan_code TEXT UNIQUE,
  serial_number TEXT,
  manufacturer TEXT,
  model TEXT,
  item_type TEXT NOT NULL CHECK (item_type IN ('unique', 'quantity')),
  total_qty INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'damaged', 'lost', 'retired')),
  import_flag TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tool_unit (
  id INTEGER PRIMARY KEY,
  tool_id INTEGER NOT NULL REFERENCES tool(id),
  scan_code TEXT UNIQUE,
  serial_number TEXT,
  import_flag TEXT
);

CREATE TABLE IF NOT EXISTS checkout (
  id INTEGER PRIMARY KEY,
  site_id INTEGER NOT NULL DEFAULT 1,
  worker_id INTEGER NOT NULL REFERENCES worker(id),
  created_by INTEGER NOT NULL REFERENCES user(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  note TEXT
);

CREATE TABLE IF NOT EXISTS checkout_line (
  id INTEGER PRIMARY KEY,
  checkout_id INTEGER NOT NULL REFERENCES checkout(id),
  tool_id INTEGER NOT NULL REFERENCES tool(id),
  qty_out INTEGER NOT NULL CHECK (qty_out > 0),
  long_term INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS return_event (
  id INTEGER PRIMARY KEY,
  checkout_line_id INTEGER NOT NULL REFERENCES checkout_line(id),
  qty INTEGER NOT NULL CHECK (qty > 0),
  outcome TEXT NOT NULL CHECK (outcome IN ('returned', 'damaged', 'lost')),
  created_by INTEGER NOT NULL REFERENCES user(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS import_run (
  id INTEGER PRIMARY KEY,
  site_id INTEGER NOT NULL DEFAULT 1,
  run_by INTEGER NOT NULL REFERENCES user(id),
  run_at TEXT NOT NULL DEFAULT (datetime('now')),
  file_name TEXT NOT NULL,
  counts_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS translation (
  source_name TEXT PRIMARY KEY,
  english_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY,
  site_id INTEGER NOT NULL DEFAULT 1,
  actor_id INTEGER REFERENCES user(id),
  at TEXT NOT NULL DEFAULT (datetime('now')),
  entity TEXT NOT NULL,
  entity_id INTEGER,
  action TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT
);

CREATE TRIGGER IF NOT EXISTS audit_log_no_update BEFORE UPDATE ON audit_log
BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;

CREATE TRIGGER IF NOT EXISTS audit_log_no_delete BEFORE DELETE ON audit_log
BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;

INSERT OR IGNORE INTO site (id, name) VALUES (1, 'EX-4002 QEII Halifax Infirmary Expansion');
