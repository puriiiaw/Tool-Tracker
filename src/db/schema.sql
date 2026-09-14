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
  category TEXT,
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
  long_term INTEGER NOT NULL DEFAULT 0,
  removed INTEGER NOT NULL DEFAULT 0 -- a line taken off a checkout by an edit; audit keeps it
);

CREATE TABLE IF NOT EXISTS return_event (
  id INTEGER PRIMARY KEY,
  checkout_line_id INTEGER NOT NULL REFERENCES checkout_line(id),
  qty INTEGER NOT NULL CHECK (qty > 0),
  outcome TEXT NOT NULL CHECK (outcome IN ('returned', 'damaged', 'lost')),
  created_by INTEGER NOT NULL REFERENCES user(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  voided INTEGER NOT NULL DEFAULT 0 -- a mistaken return is voided, never deleted
);

CREATE TABLE IF NOT EXISTS import_run (
  id INTEGER PRIMARY KEY,
  site_id INTEGER NOT NULL DEFAULT 1,
  run_by INTEGER NOT NULL REFERENCES user(id),
  run_at TEXT NOT NULL DEFAULT (datetime('now')),
  file_name TEXT NOT NULL,
  counts_json TEXT NOT NULL
);

-- ON!Track export name -> app name. item_type NULL means "decide by the battery/charger rule".
CREATE TABLE IF NOT EXISTS translation (
  source_name TEXT PRIMARY KEY,
  english_name TEXT NOT NULL,
  item_type TEXT CHECK (item_type IN ('unique', 'quantity'))
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

-- Appendix A of the PRD: every distinct name in the first export.
INSERT OR IGNORE INTO translation (source_name, english_name, item_type) VALUES
  ('Batterie Nuron B 22-85', 'Battery Nuron B 22-85', 'quantity'),
  ('Batterie Nuron B 22-55', 'Battery Nuron B 22-55', 'quantity'),
  ('Batterie Nuron B 22-195', 'Battery Nuron B 22-195', 'quantity'),
  ('Batterie Nuron B 22-290', 'Battery Nuron B 22-290', 'quantity'),
  ('Batterie 12 V B 12-30', 'Battery 12 V B 12-30', 'quantity'),
  ('B 22/3.0', 'Battery B22 (legacy)', 'quantity'),
  ('B22', 'Battery B22 (legacy)', 'quantity'),
  ('B22/4.0 li lion', 'Battery B22 (legacy)', 'quantity'),
  ('Chargeur compact Nuron C 4-22', 'Compact charger Nuron C 4-22', 'quantity'),
  ('Chargeur Ultimate Nuron C 8-22', 'Ultimate charger Nuron C 8-22', 'quantity'),
  ('Chargeur flash à deux emplacements C 8DC-22 Nuron', 'Dual-bay flash charger C 8DC-22 Nuron', 'quantity'),
  ('Chargeur compact C4/12-50', 'Compact charger (legacy)', 'quantity'),
  ('C 4/36-90', 'Compact charger (legacy)', 'quantity'),
  ('Scissor Lift', 'Scissor lift', 'unique'),
  ('Scissor Lifts', 'Scissor lift', 'unique'),
  ('Lampe de chantier à LED SL 6-22', 'LED work light SL 6-22', 'unique'),
  ('Saftey Harness', 'Safety harness', 'unique'),
  ('Safety Harness', 'Safety harness', 'unique'),
  ('Cloueuse pour béton sans fil BX 4-22', 'Cordless concrete nailer BX 4-22', 'unique'),
  ('Grignoteuse sans fil SPN 6-22 RN', 'Cordless nibbler SPN 6-22 RN', 'unique'),
  ('Visseuse à chocs sans fil SID 6-22', 'Cordless impact driver SID 6-22', 'unique'),
  ('Outil à découper SCO 6-22', 'Cut-out tool SCO 6-22', 'unique'),
  ('Perforateur sans fil TE 6-22', 'Cordless rotary hammer TE 6-22', 'unique'),
  ('Laser multidirectionnel PM 50MG-22', 'Multi-line laser PM 50MG-22', 'unique'),
  ('Visseuse plaquiste sans fil SD 5000-22', 'Cordless drywall screwdriver SD 5000-22', 'unique'),
  ('Scie circulaire sans fil pour métal SC 6ML-22', 'Cordless metal circular saw SC 6ML-22', 'unique'),
  ('Fall arrest systems 11ft', 'Fall arrest system 11 ft', 'unique'),
  ('Fall arrest systems 30ft', 'Fall arrest system 30 ft', 'unique'),
  ('Fall arrest systems 50ft', 'Fall arrest system 50 ft', 'unique'),
  ('Aspirateur sans fil VC 2D-22', 'Cordless vacuum VC 2D-22', 'unique'),
  ('Extracteur de poussière VC 150-10 XE', 'Dust extractor VC 150-10 XE', 'unique'),
  ('PR 40G-22 Niveau laser rotatif vert à pente unique', 'Green rotating laser, single slope PR 40G-22', 'unique'),
  ('Pince d''injection de calfeutrage sans fil CD 4-22', 'Cordless caulking dispenser CD 4-22', 'unique'),
  ('Scie circulaire sans fil pour bois SC 6WL-22', 'Cordless wood circular saw SC 6WL-22', 'unique'),
  ('Système de récupération de la poussière TE DRS 4/6', 'Dust removal system TE DRS 4/6', 'unique'),
  ('Dewalt laser', 'DeWalt laser DW088CG', 'unique'),
  ('Dw088cg Dewalt laser', 'DeWalt laser DW088CG', 'unique'),
  ('Fall protection', 'Fall protection device', 'unique'),
  ('Fall limiter', 'Fall protection device', 'unique'),
  ('Multi-outil oscillant sans fil SMT 6-22', 'Cordless oscillating multi-tool SMT 6-22', 'unique'),
  ('Meuleuse d''angle sans fil AG 6D-22 (5 ")', 'Cordless angle grinder AG 6D-22 (5")', 'unique'),
  ('Cloueur d''isolation à gaz GX-IE', 'Gas insulation nailer GX-IE', 'unique'),
  ('Pm 30-mg', 'Line laser PM 30-MG', 'unique'),
  ('Scie sabre SR 6-22', 'Reciprocating saw SR 6-22', 'unique'),
  ('Elingue Pour Conteneur / Sling For Container', 'Container sling', 'unique'),
  ('Field Tablet', 'Field tablet', 'unique'),
  ('Poa 67', 'Laser accessory POA 67', 'unique'),
  ('Poa 75', 'Laser accessory POA 75', 'unique'),
  ('Plt 300', 'Layout tool PLT 300', 'unique'),
  ('Pua 36', 'Laser accessory PUA 36', 'unique'),
  ('Sc 4wl-22', 'Cordless circular saw SC 4WL-22', 'unique'),
  ('Scie sur table sans fil SCT 60-22', 'Cordless table saw SCT 60-22', 'unique'),
  ('Scie sauteuse sans fil SJT 6-22', 'Cordless jigsaw SJT 6-22', 'unique'),
  ('Spn 6-a22', 'Cordless nibbler SPN 6-A22 (legacy)', 'unique'),
  ('Sid 6-22', 'Cordless impact driver SID 6-22 (legacy)', 'unique'),
  ('Tronçonneuse à batterie 12 po DSH 700-22 ATC', 'Cordless 12" cut-off saw DSH 700-22 ATC', 'unique'),
  ('Visseuse-perceuse à percussion sans fil SF 6H-22', 'Cordless hammer drill driver SF 6H-22', 'unique');
