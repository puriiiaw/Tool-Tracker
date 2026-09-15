# Site Tool Tracker

Phone-first web app for one construction site (EX-4002, Halifax). Foremen record which
worker took which tools; admins see what is out and mark things back. Full requirements
live in the PRD (`docs/PRD.md`). This file records the decisions that govern the code.

## Locked decisions (do not reopen without the product owner)

- One site only. Every table still carries `site_id = 1` so multi-site is a data change later.
- Two login roles: `super_admin` and `admin`. No read-only role. No worker logins ever.
- Super-admin creates accounts and sets or changes any password directly. No email, no reset links.
- Workers are roster rows: `name` only, no trade. Quick-add from the checkout screen.
- Tools are `unique` (one row per serial, out to at most one worker) or `quantity`
  (one row per model, e.g. "Battery Nuron B 22-85", with a total count). Batteries and
  chargers are grouped by model; their individual scan codes live in `tool_unit`.
- Scanning (decided 2026-09-14): the foreman scans the Hilti Data Matrix tag with the phone
  camera as a shortcut inside checkout and returns. Workers still never touch the app.
  Continuous mode: camera stays open, each scan adds a line, Done closes it.
  A scanned unique tool adds its line. A scanned battery adds one to its model's line and
  records the unit (`checkout_line_unit`); returns scan the units back, or fall back to a
  typed count marked unscanned. A unit already out is blocked with a one-tap
  "return from X, then check out" fix. Reports group by model; tapping expands to tags.
  Unknown tag: add as a unit of an existing model, or as a new tool; `created_at` and
  `created_by` record who added it on site, and the next import lists on-site additions
  missing from ON!Track. Decoder: zxing, runs on the phone. Needs HTTPS hosting.
- Scissor lifts, harnesses, fall-arrest gear import as unique tools and are visible at checkout.
- No due dates, no notifications, no French UI, no consumables. No worker badges yet.
- Nothing is ever deleted. Edits keep the original in `audit_log`. Retire = soft hide.
- On-hand counts are computed from checkout lines and return events, never stored.
- The import never closes a checkout and never retires a tool; missing tags are flagged.
- Checkout is one screen, three fields (worker, tool, quantity), under ten seconds.
  Anything that adds a step to that flow is rejected by default.
- A checkout can be edited in full (worker, lines, quantities, time, note) by an admin;
  the audit record holds the before and after. A mistaken return is voided
  (`return_event.voided`), a mistaken line is marked `checkout_line.removed`. Every stock
  and log query excludes both. Nothing is deleted.

## Stack

- Next.js (App Router) + TypeScript + Tailwind. Server actions for every write.
- SQLite file (`data/tracker.db`) via `better-sqlite3`, plain SQL, no ORM.
  Schema in `src/db/schema.sql`, applied on startup. Postgres swap is a later task.
- Auth: hand-rolled. `crypto.scrypt` password hashes, `session` table, HTTP-only cookie,
  30-day expiry. Role check happens server-side inside every action.
- Import: `xlsx` (SheetJS) reads the ON!Track `Assets_Details.xlsx` as-is (header on row 2).
- Runs locally with `npm run dev`. No external services required.
- Repo: https://github.com/puriiiaw/Tool-Tracker

## Build order

1. Schema, login, account management
2. Checkout screen with worker quick-add
3. Log page with full and partial returns, damaged and lost outcomes
4. Dashboard
5. ON!Track import with preview, translation table, item-type override
6. CSV export and checkout editing
7. Camera scanning at checkout and returns; on-site add of unknown tags; HTTPS hosting

Each step is checked on a phone-width viewport before the next starts.

## Code rules

- Least code that solves the problem. No abstractions for single-use code, no config
  for values that never change, no error handling for scenarios that cannot happen.
- Prefer stdlib and platform features over dependencies. Ask before adding a package.
- Server components by default; `'use client'` only for hooks, browser APIs, or handlers.
- Every server action: check session and role first, then write inside one transaction,
  then append to `audit_log` in the same transaction.
- Validate at the boundary: worker exists, tool exists and is active, quantity within on-hand,
  unique tool not already out. Reject with a plain message the foreman can read.
- Mobile first at 390 px, tap targets at least 44 px, no hover-only controls.
- No delete statements anywhere in application code. The audit table gets inserts only.
- Short inline comments only. No docstring padding. Delete code your change made unused.
- Match existing style. Do not refactor or reformat code the task does not touch.

## Working with the product owner

- State assumptions before implementing. If a requirement has two readings, ask with a
  concrete example rather than picking silently.
- Explain in plain language, not engineering shorthand. Give an example when introducing a term.
- Keep the PRD and this file in sync when a decision changes.

## Verification

- `npm run build` must pass before any commit.
- Non-trivial logic (on-hand maths, import diff, partial returns) gets one small test in
  `src/**/*.test.ts` run with `node --test` via `npm test`.
- Walk through the changed screen at phone width before calling a step done.
