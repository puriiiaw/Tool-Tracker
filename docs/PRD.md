Product Requirements Document
Site Tool Tracker
Checkout and return tracking for construction site tools — EX-4002 QEII Halifax Infirmary Expansion
Field
 | Value
 | Version
 | 1.0 — Draft for review
 | Date
 | September 11, 2026
 | Author
 | Pouria — Site Administrative Assistant, Groupe Piché
 | Site
 | EX-4002 QEII Halifax Infirmary Expansion, Halifax NS
 | Status
 | Discovery complete — decisions locked with product owner
 | Source data
 | Assets_Details.xlsx (Hilti ON!Track export, 479 assets, 54 columns)
 | 
Contents
1. Overview
2. Discovery Summary — Locked Decisions
3. User Stories
4. Features and Functional Requirements
5. Data Model
6. Technical Requirements
7. Checkout Method Analysis
8. Success Metrics
9. Risks and Mitigations
10. Rollout Plan
11. Open Items
Appendix A — Tool Name Translation Table

1. Overview
1.1 Problem
Groupe Piché manages roughly 480 tracked assets on the EX-4002 site — Hilti Fleet power tools, batteries, chargers, lasers, plus owned equipment such as scissor lifts and fall-protection gear. Hilti ON!Track holds the asset register, but every asset is assigned to a single responsible employee and no tool has ever been transferred to a worker in the system. ON!Track was trialled for worker checkouts and rejected: too many steps per transfer, workers must first exist as ON!Track users, login friction on site phones, and a UI built for fleet finance rather than "who has what right now".
Today, when a foreman hands a tool or a set of batteries to a worker, nothing records it. When a tool is missing, there is no way to know who had it last.
1.2 Goal
A phone-first web app that lets a foreman or site admin record, in under ten seconds, which worker took which tools and how many — and lets the admin see, at any moment, everything that is out and who has it, and mark items back in full or in part until every line is closed.
1.3 Scope
In scope (v1)
 | Explicitly out of scope (v1)
 | Import the ON!Track export, recurring, keyed on Scan Code
 | Barcode / QR scanning — moved into scope 2026-09-14, see §12
 | Add and edit tools manually; every tool is one serial (unique/quantity split dropped 2026-09-15, see §13)
 | Worker self-service (workers never touch the app)
 | Foreman-mediated checkout: worker, tool from inventory list, quantity
 | Due dates, overdue status, alerts, notifications of any kind
 | Log page: all checkouts, filter to "not fully returned", full and partial returns
 | Consumables (blades, bits, screws)
 | Return statuses: returned, damaged, lost
 | Multi-site; the app is EX-4002 only
 | Live inventory: on hand vs. out, per tool and per quantity item
 | French UI (English only; tool names translated at import)
 | Phone-first admin dashboard
 | Procurement / fleet / warranty data (stays in ON!Track)
 | Email + password login; super-admin manages accounts
 | Report pages beyond CSV export
 | Immutable audit trail; edits keep the original
 | Integrations with Salus, Plexxis, payroll, ON!Track API
 | 
Design constraint that governs every screen: a checkout is one screen, three fields (who, what, how many), under ten seconds. Anything that adds a step to that flow is rejected by default.
1.4 Users
User
 | Who
 | What they do in the app
 | Super-admin
 | Pouria (site admin)
 | Everything an admin does, plus: create/disable accounts, reset passwords, run the ON!Track import, resolve import conflicts, export CSV.
 | Admin
 | Foremen and any other site admin — same role, same rights
 | Record checkouts, record full/partial returns, add tools and workers, view dashboard and log.
 | Read-only
 | Project Manager
 | View dashboard and log. No writes. Optional in v1.
 | Worker
 | Crew members (~100)
 | Not a user. Exists only as a roster record chosen at checkout. Must ask a foreman/admin for any tool.
 | 2. Discovery Summary — Locked Decisions
Decisions reached during the discovery interview. Each one closes a branch of the design; changing one reopens the branches under it.
#
 | Decision
 | Choice
 | Why
 | D1
 | Build vs. use ON!Track
 | Build a custom web app alongside ON!Track
 | ON!Track trial failed on every friction point: steps, user model, login, clutter.
 | D2
 | Checkout desk
 | Foreman = admin; no separate roles
 | Small site, one crib. Complexity is the enemy.
 | D3
 | Unit of tracking
 | Unique tools (serialized) + quantity items (batteries, chargers by count)
 | Counts stay the unit in reports. Since 2026-09-14 each battery tag is scanned at checkout and return so a missing one is traceable (§12).
 | D4
 | Worker identity
 | Pick from a roster seeded with all current workers; quick-add for newcomers; no free text
 | Free-text names destroy the "who has what" report within a month.
 | D5
 | Barcodes
 | Camera scan of the Hilti Data Matrix tag, foreman only, plus type-ahead search
 | Decided 2026-09-14 after the pilot; details in §12.
 | D6
 | Worker self-service
 | None. Every pickup goes through a foreman/admin
 | Honour-system forms get blamed for every missing tool.
 | D7
 | Due dates
 | None. States are simply out / partially back / back
 | Log page is the working queue; nothing expires.
 | D8
 | Returns
 | Full or partial; missing items stay open per line; statuses returned / damaged / lost
 | Matches how tools actually come back.
 | D9
 | Login
 | Email + password; super-admin creates accounts and resets passwords; emailed login link for resets
 | Owner's choice over M365 SSO.
 | D10
 | Audit edits
 | Edit allowed, original kept in trail; delete never available
 | Trust in the log is the whole product.
 | D11
 | Import
 | Recurring, keyed on Scan Code; never closes an open checkout; missing tags flagged, not retired
 | Fleet changes several times a year.
 | D12
 | Columns kept
 | Name (translated), Scan Code, Serial Number, Manufacturer, Model
 | Everything else is empty, constant, or procurement history.
 | D13
 | Scale
 | EX-4002 only; site_id on every table for later
 | Prove it on one site first.
 | D14
 | Language
 | English only
 | Halifax crew.
 | D15
 | Devices
 | Foremen's own phones; dashboard also on laptop
 | Phone-first layout, big tap targets.
 | D16
 | Stack / hosting
 | Deferred — proposal in §6, company-owned accounts required
 | Owner: "figure it out later."
 | 3. User Stories
3.1 Checkout
As a foreman, when a worker asks for a tool, I select the worker, select the tool from the inventory list, enter the quantity, and save — so the checkout is recorded in under ten seconds with the time stamped automatically.
As a foreman, I add several lines to one checkout (a screw gun, two batteries, one charger) so a single handover is one record.
As a foreman, I can only choose tools that exist in inventory and, for unique tools, only ones not already out — so I never record an impossible checkout.
As a foreman, if the worker is not on the roster, I add him (name, trade) right from the worker field without leaving the screen.
3.2 Returns
As an admin, I open the log, filter to "not fully returned", and see every worker who still has something.
As an admin, when a worker brings tools back, I open his checkout and mark it fully returned, or mark it partially returned and record exactly what is still missing, so the line stays open until everything is back.
As an admin, when a tool comes back broken or never comes back, I mark that item damaged or lost so the audit trail shows what happened and inventory reflects it.
3.3 Inventory
As a super-admin, I upload the latest ON!Track export and the app adds new tags, updates changed details, and flags tags that disappeared — without touching any open checkout.
As an admin, when new items arrive (a case of batteries, a new laser), I add them to inventory and they immediately appear in the checkout tool list.
As an admin, I see live counts per item: total, on hand, out, damaged, lost.
3.4 Dashboard and history
As an admin, on my phone at 7 AM, I see what is out right now and with whom, and current battery and charger stock, on one screen.
As an admin, I look up one worker and see everything he has and has ever taken; I look up one tool and see every hand it has passed through.
As a super-admin, I export the log to CSV for the PM.
3.5 Accounts and audit
As a super-admin, I create and disable admin accounts and reset passwords; a forgotten password is fixed by an emailed login link, not a phone call.
As a super-admin, when a foreman corrects a mistaken entry, I can still see the original value, who changed it, and when.
4. Features and Functional Requirements
4.1 Inventory
ID
 | Requirement
 | Priority
 | INV-1
 | Two item types. Unique: one record per physical tool, identified by Scan Code and Serial Number; can be out to at most one worker at a time. Quantity: one record per model (e.g. "Battery Nuron B 22-85") with a total count; checkouts reduce on-hand by the quantity taken.
 | Must
 | INV-2
 | Fields per tool: name (English), scan code, serial number, manufacturer, model, item type, status (active / damaged / lost / retired), total quantity (quantity type only), site_id, notes.
 | Must
 | INV-3
 | Add and edit tools manually. New tools are immediately selectable on the checkout screen.
 | Must
 | INV-4
 | Live counts per tool: on hand = total − out − damaged − lost. Computed from checkout lines, never stored as a separate editable number.
 | Must
 | INV-5
 | Search/type-ahead across name, model, scan code, serial. Three characters is enough to narrow "BX 4" or "B 22-85".
 | Must
 | INV-6
 | Retire a tool (soft delete). Retired tools are hidden from checkout but keep their history.
 | Should
 | 
4.2 Import from ON!Track export
ID
 | Requirement
 | Priority
 | IMP-1
 | Accept the ON!Track Assets_Details.xlsx as-is (header on row 2, count on row 1). No manual clean-up before upload.
 | Must
 | IMP-2
 | Key on Scan Code. Existing scan code → update name/serial/manufacturer/model if changed. New scan code → create tool. Scan code in app but absent from file → flag "not in latest export"; never retire automatically and never close an open checkout.
 | Must
 | IMP-3
 | Map French names to English via a translation table (Appendix A) maintained in the app; unknown names are imported untranslated and listed for the super-admin to translate.
 | Must
 | IMP-4
 | Rows with a blank Name (10 in the current file) are imported using Model as the name and flagged for review.
 | Must
 | IMP-5
 | Item-type assignment on import: rows whose name begins with Battery/Batterie/Charger/Chargeur default to quantity type, grouped by model; all others default to unique. Super-admin can override per row before confirming.
 | Must
 | IMP-6
 | Preview before commit: counts of new / updated / unchanged / missing, with a per-row list. Nothing is written until confirmed.
 | Must
 | IMP-7
 | Every import is itself an audit event (who, when, file name, counts).
 | Must
 | 
Column mapping. Of 54 columns in the export, 24 are entirely empty and 12 hold a single constant value across all 479 rows. Only five are carried into the app:
Export column
 | App field
 | Notes
 | Name
 | name
 | Translated FR→EN at import (Appendix A).
 | Scan Code
 | scan_code
 | 9-digit, unique on all 479 rows. Primary import key.
 | Serial Number
 | serial_number
 | Present on 414 rows; blank allowed.
 | Manufacturer
 | manufacturer
 | Hilti on 421 rows; blank allowed.
 | Model
 | model
 | Used as fallback name; groups quantity items.
 | All other 49 columns
 | — not imported
 | Ownership, fleet dates, PO, location, responsible employee, etc. remain in ON!Track as system of record.
 | 
4.3 Checkout (request page)
ID
 | Requirement
 | Priority
 | CO-1
 | Single screen. Fields: Worker (type-ahead over roster), then one or more lines of Tool (type-ahead over inventory list) + Quantity. Save. Timestamp and acting admin are set automatically; neither is editable at entry.
 | Must
 | CO-2
 | Tool list is the live inventory: every tool added manually or by import appears immediately; tools already out are shown greyed with "out to <worker>"; tapping one offers "Return from <worker>, give to <new worker>", which returns only that tool; with no signal the foreman still checks out and returns (including by scan): items wait on the phone and send by themselves, a bar shows how many are waiting, and a clash with another phone appears on the Dashboard for an admin to hand over or dismiss; quantity items show on-hand count and cannot be checked out beyond it.
 | Must
 | CO-3
 | Quantity defaults to 1 and is locked at 1 for unique tools.
 | Must
 | CO-4
 | Worker quick-add inline: name and trade; the new worker is selected and the checkout continues.
 | Must
 | CO-5
 | Optional free-text note per checkout (e.g. "for Level 5 framing").
 | Should
 | CO-6
 | Long-term flag per checkout line for kit a worker keeps (screw gun for the season). Purely informational; line still shows in the open list.
 | Should
 | CO-7
 | Target: three taps plus typing, under ten seconds end-to-end on a phone.
 | Must
 | 
4.4 Returns and the Log page
ID
 | Requirement
 | Priority
 | LOG-1
 | Log page lists every checkout, newest first: worker, items, quantities, time out, admin, status (open / partial / closed).
 | Must
 | LOG-2
 | Filters: status (default = not fully returned), worker, tool, date range, admin. Filters persist while navigating.
 | Must
 | LOG-3
 | Return action per checkout: "Mark all returned" closes every line. "Partial return" shows each line with returned-so-far and a field for quantity returned now; unreturned remainder stays open on the same checkout.
 | Must
 | LOG-4
 | Per line, on return, choose outcome: returned / damaged / lost. Damaged and lost remove the item from on-hand and set tool status; the line closes with that outcome recorded.
 | Must
 | LOG-5
 | Each return is its own event with timestamp and acting admin; a checkout can have many return events.
 | Must
 | LOG-6
 | Worker detail: everything currently out to him, plus full history. Tool detail: every checkout and return of that tool.
 | Must
 | LOG-7
 | CSV export of the log with current filters applied.
 | Should
 | 
4.5 Dashboard
ID
 | Requirement
 | Priority
 | DB-1
 | Home screen answers, without scrolling on a phone: number of open checkouts, number of workers holding items, and a list of what is out with whom (most recent first).
 | Must
 | DB-2
 | Stock strip for quantity items: on hand / total for each battery and charger model.
 | Must
 | DB-3
 | One-tap entry points: New checkout, Log (not fully returned), Search worker, Search tool.
 | Must
 | DB-4
 | Badges for items needing attention: tools flagged by import, tools marked damaged, tools marked lost.
 | Should
 | 
4.6 Accounts, roles, audit
ID
 | Requirement
 | Priority
 | ACC-1
 | Email + password login. Passwords hashed (bcrypt/argon2). Session stays logged in on the phone for 30 days.
 | Must
 | ACC-2
 | Roles: super-admin, admin, read-only. Super-admin creates, disables, and resets accounts. Self-service reset via emailed one-time login link.
 | Must
 | ACC-3
 | All admins see all workers and all history (single site, single crib).
 | Must
 | AUD-1
 | Every write (checkout, return, edit, tool add/edit, worker add/edit, import, account change) creates an immutable audit record: actor, timestamp, entity, before, after.
 | Must
 | AUD-2
 | Checkouts and returns can be edited to fix mistakes; the audit record keeps the original. No delete action exists anywhere in the UI or API.
 | Must
 | 5. Data Model
Entity
 | Key fields
 | Notes
 | site
 | id, name
 | One row (EX-4002). Every other table carries site_id.
 | user
 | id, site_id, email, password_hash, name, role, active
 | Admins / super-admin / read-only.
 | worker
 | id, site_id, name, trade, active, created_by
 | Roster. Never a login.
 | tool
 | id, site_id, name, scan_code, serial_number, manufacturer, model, item_type (unique|quantity), total_qty, status, import_flag, notes
 | scan_code unique per site when present.
 | checkout
 | id, site_id, worker_id, created_by, created_at, note, status (open|partial|closed)
 | Header. Status derived from lines.
 | checkout_line
 | id, checkout_id, tool_id, qty_out, qty_returned, qty_damaged, qty_lost, long_term
 | Open while qty_out > returned + damaged + lost.
 | return_event
 | id, checkout_line_id, qty, outcome (returned|damaged|lost), created_by, created_at
 | Many per line. Source of the qty_* totals.
 | import_run
 | id, site_id, run_by, run_at, file_name, counts_json
 | One per upload.
 | audit_log
 | id, site_id, actor_id, at, entity, entity_id, action, before_json, after_json
 | Append-only; no update or delete permitted at DB level.
 | 
On-hand rule. For quantity items: on_hand = total_qty − Σ(qty_out − qty_returned − qty_damaged − qty_lost) across open lines − damaged − lost. For unique items: out if any open line exists. Both are computed, never stored as editable fields.
6. Technical Requirements
6.1 Proposed stack (decision deferred)
The owner deferred the stack decision. The proposal below is what the PRD assumes; swapping components does not change any requirement above.
Layer
 | Proposal
 | Rationale
 | Frontend + API
 | Next.js (App Router), TypeScript, Tailwind
 | One codebase, server actions for writes, phone-first layouts.
 | Database
 | Postgres (Neon or Supabase)
 | Relational fits the checkout/line/return model; audit table with append-only policy.
 | Auth
 | Auth.js (credentials provider) or Supabase Auth
 | Email + password per D9; magic-link reset.
 | Hosting
 | Vercel
 | Already connected; zero-ops; free tier sufficient for one site.
 | Import parsing
 | SheetJS server-side
 | Reads the ON!Track xlsx directly.
 | Email
 | Resend or SMTP via M365
 | Reset links only.
 | 
Non-negotiable regardless of stack: all accounts (Vercel, database, email) are owned by Groupe Piché, not a personal account. A tool on a personal account dies when its author changes roles.
6.2 Non-functional
Mobile: designed at 390 px width first; tap targets ≥ 44 px; works in Safari and Chrome on iOS/Android; usable with gloves — no hover-only controls.
Performance: checkout save under 1 s on site Wi-Fi; type-ahead results under 300 ms for 500 tools / 150 workers; dashboard loads under 2 s.
Connectivity: online-only (site connectivity confirmed adequate). Unsaved checkout data is kept in the browser if the connection drops mid-entry so the foreman can retry.
Scale: designed for 1 site, ~500 tools, ~150 workers, ~10 admins, a few hundred checkouts per week. No architecture work for multi-site beyond site_id.
Security: HTTPS only; passwords hashed; sessions HTTP-only cookies; role checks server-side on every write; audit table append-only via DB permissions; worker names are personal data — no public pages, no data outside the company-owned database; nightly backups.
Availability: if the app is down, the fallback is a paper sheet at the crib, entered into the app afterward with the real time set via the edit path (audited).
Browser support: last two versions of iOS Safari, Android Chrome, desktop Chrome/Edge.
7. Checkout Method Analysis
The original brief proposed two methods. Discovery settled the choice, but the reasoning is recorded so it is not relitigated.

 | Option A — Worker scans wall barcode → web form
 | Option B — Foreman/admin enters checkout on site
 | Who acts
 | Worker, on his own phone
 | Foreman or admin, on his phone
 | Identity
 | Self-declared. Without a trusted ID it is free text or an honour-system pick
 | Chosen from the roster by someone who knows the crew
 | Data quality
 | Low: duplicate names, forgotten entries, wrong quantities
 | High: one trained person per crew, consistent
 | Speed at crib
 | Fast for the worker, but depends on him bothering
 | Ten seconds per handover; the foreman is already there
 | Accountability
 | Diffuse — "the app let him take it"
 | Clear — the foreman handed it over and recorded it
 | Hardware
 | Printed barcodes, camera scanning in dust/gloves
 | None
 | Adoption risk
 | High: ~100 workers must change behaviour
 | Low: ~10 foremen must change behaviour
 | Fits ON!Track lesson
 | Repeats the failure: another app workers must open
 | Removes workers from the loop entirely
 | 
7.1 Recommendation
Option B only, with the worker as a roster record and the foreman as the operator. Every pickup goes through a foreman or admin; a worker cannot take anything without asking. This is the workflow the owner confirmed, and it is the only one where the log can be trusted when a tool goes missing. Option A is not deferred — it is removed. The one piece of it worth keeping is already in the data model: the Hilti scan code on every tool, so that camera scanning can be added to Option B later as a shortcut for the foreman, not as a path for the worker.
8. Success Metrics
The owner chose not to quantify today's losses, so the baseline is established in the first 30 days of use rather than from history.
Metric
 | Target
 | How measured
 | Adoption
 | 100% of foremen record ≥ 1 checkout per working day within 2 weeks of go-live
 | Checkouts per admin per day, from the log
 | Checkout speed
 | Median under 10 s from opening the screen to save
 | Client-side timing, sampled
 | Log completeness
 | Every tool physically out of the crib appears in the open list — verified by a weekly spot-count of 20 random tools
 | Spot-count discrepancies, tracked weekly
 | Return closure
 | ≥ 90% of checkouts closed within 7 days; open lines older than 30 days reviewed monthly
 | Status distribution on the log
 | Missing-tool resolution
 | For every tool reported missing, the last worker holding it is identifiable in the app
 | Count of missing-tool cases with vs. without a log trail
 | Data hygiene
 | Zero duplicate workers in the roster; zero free-text worker names
 | Roster audit, monthly
 | Import
 | Monthly ON!Track import completes in under 15 minutes including conflict review
 | Import run timing
 | 9. Risks and Mitigations
Risk
 | Likelihood
 | Impact
 | Mitigation
 | Foremen skip the app under time pressure, like they skipped ON!Track
 | High
 | High
 | Ten-second design constraint; pilot with one foreman for two weeks and fix friction before rollout; super-admin reviews checkouts-per-day in week 1.
 | Roster duplicates creep in via quick-add
 | Medium
 | Medium
 | Quick-add searches existing names first and warns on near-matches; monthly roster merge by super-admin.
 | Partial returns misrecorded, on-hand counts drift
 | Medium
 | High
 | Counts are computed from events, never hand-edited; weekly 20-tool spot count; damaged/lost outcomes force the line to close cleanly.
 | ON!Track import overwrites or retires something in use
 | Low
 | High
 | Import never closes checkouts or retires tools; preview-then-commit; missing tags flagged for a human.
 | Password support becomes the super-admin's daily job
 | Medium
 | Low
 | Emailed one-time login link; 30-day sessions on phones.
 | App lives on a personal account and dies with a role change
 | Medium
 | High
 | Company-owned Vercel/DB/email accounts from day one; a second super-admin named before go-live.
 | No due dates means long-forgotten items pile up in the open list
 | Medium
 | Medium
 | Log sorted oldest-open first with age shown; monthly review of open lines older than 30 days.
 | Workers object to being tracked by name
 | Low
 | Medium
 | Purpose is tool accountability only; no location or time-on-site inference; PM read-only; revisit if raised by the union.
 | Site connectivity worse than assumed at the crib
 | Low
 | Medium
 | Draft preserved in browser on failure; if repeated, revisit offline-first in v2.
 | 10. Rollout Plan
Phase
 | Duration
 | Scope
 | Exit criterion
 | 0. Setup
 | 1 week
 | Company accounts, database, auth, import of current export with translations, roster load
 | Super-admin can log in, sees 479 tools and full roster
 | 1. Build
 | 3–4 weeks
 | Checkout, log with partial returns, dashboard, audit, manual tool add
 | All Must requirements pass a walkthrough on a phone
 | 2. Pilot
 | 2 weeks
 | One foreman, one crew, real checkouts; paper backup running in parallel
 | Foreman records daily without prompting; spot count matches
 | 3. Rollout
 | 1 week
 | All foremen, PM read-only, paper backup retired
 | Every foreman has logged ≥ 5 checkouts
 | 4. Steady state
 | Ongoing
 | Monthly ON!Track import; monthly open-line and roster review
 | Success metrics reported monthly
 | 11. Open Items
Stack and hosting confirmation (§6.1) and who at Groupe Piché owns the accounts.
Name of the second super-admin.
Whether the PM read-only role is wanted in v1 or deferred.
Confirmation that scissor lifts, harnesses and fall-arrest gear are imported as unique tools (they are in the file) or excluded from the checkout list.
Review of Appendix A translations by a foreman before import.

Appendix A — Tool Name Translation Table
Every distinct Name in the current export, with the English name the app will use and the proposed item type. Rows marked quantity are grouped by model into one inventory record with a count.
Export name (FR / as-is)
 | App name (EN)
 | Type
 | Rows
 | Batterie Nuron B 22-85
 | Battery Nuron B 22-85
 | Quantity
 | 160
 | Batterie Nuron B 22-55
 | Battery Nuron B 22-55
 | Quantity
 | 46
 | Batterie Nuron B 22-195
 | Battery Nuron B 22-195
 | Quantity
 | 40
 | Chargeur compact Nuron C 4-22
 | Compact charger Nuron C 4-22
 | Quantity
 | 20
 | Scissor Lift / Scissor Lifts / Scissor lifts
 | Scissor lift
 | Unique
 | 19
 | Lampe de chantier à LED SL 6-22
 | LED work light SL 6-22
 | Unique
 | 14
 | Saftey Harness / Safety Harness
 | Safety harness
 | Unique
 | 14
 | Chargeur Ultimate Nuron C 8-22
 | Ultimate charger Nuron C 8-22
 | Quantity
 | 10
 | Chargeur flash à deux emplacements C 8DC-22 Nuron
 | Dual-bay flash charger C 8DC-22 Nuron
 | Quantity
 | 10
 | Cloueuse pour béton sans fil BX 4-22
 | Cordless concrete nailer BX 4-22
 | Unique
 | 9
 | Grignoteuse sans fil SPN 6-22 RN
 | Cordless nibbler SPN 6-22 RN
 | Unique
 | 8
 | Visseuse à chocs sans fil SID 6-22
 | Cordless impact driver SID 6-22
 | Unique
 | 8
 | Outil à découper SCO 6-22
 | Cut-out tool SCO 6-22
 | Unique
 | 8
 | Perforateur sans fil TE 6-22
 | Cordless rotary hammer TE 6-22
 | Unique
 | 8
 | Laser multidirectionnel PM 50MG-22
 | Multi-line laser PM 50MG-22
 | Unique
 | 8
 | Visseuse plaquiste sans fil SD 5000-22
 | Cordless drywall screwdriver SD 5000-22
 | Unique
 | 8
 | Batterie Nuron B 22-290
 | Battery Nuron B 22-290
 | Quantity
 | 6
 | Scie circulaire sans fil pour métal SC 6ML-22
 | Cordless metal circular saw SC 6ML-22
 | Unique
 | 5
 | Fall arrest systems 11ft
 | Fall arrest system 11 ft
 | Unique
 | 5
 | Batterie 12 V B 12-30
 | Battery 12 V B 12-30
 | Quantity
 | 4
 | Aspirateur sans fil VC 2D-22
 | Cordless vacuum VC 2D-22
 | Unique
 | 4
 | Extracteur de poussière VC 150-10 XE
 | Dust extractor VC 150-10 XE
 | Unique
 | 3
 | PR 40G-22 Niveau laser rotatif vert à pente unique
 | Green rotating laser, single slope PR 40G-22
 | Unique
 | 3
 | Pince d'injection de calfeutrage sans fil CD 4-22
 | Cordless caulking dispenser CD 4-22
 | Unique
 | 3
 | Fall arrest systems 30ft
 | Fall arrest system 30 ft
 | Unique
 | 3
 | B 22/3.0 / B22 / B22/4.0 li lion
 | Battery B22 (legacy)
 | Quantity
 | 5
 | Scie circulaire sans fil pour bois SC 6WL-22
 | Cordless wood circular saw SC 6WL-22
 | Unique
 | 2
 | Système de récupération de la poussière TE DRS 4/6
 | Dust removal system TE DRS 4/6
 | Unique
 | 2
 | Dewalt laser / Dw088cg Dewalt laser
 | DeWalt laser DW088CG
 | Unique
 | 3
 | Fall protection / Fall limiter
 | Fall protection device
 | Unique
 | 3
 | Multi-outil oscillant sans fil SMT 6-22
 | Cordless oscillating multi-tool SMT 6-22
 | Unique
 | 2
 | Meuleuse d'angle sans fil AG 6D-22 (5")
 | Cordless angle grinder AG 6D-22 (5")
 | Unique
 | 2
 | Fall arrest systems 50ft
 | Fall arrest system 50 ft
 | Unique
 | 2
 | Cloueur d'isolation à gaz GX-IE
 | Gas insulation nailer GX-IE
 | Unique
 | 2
 | Chargeur compact C4/12-50 / C 4/36-90
 | Compact charger (legacy)
 | Quantity
 | 3
 | Pm 30-mg
 | Line laser PM 30-MG
 | Unique
 | 2
 | Scie sabre SR 6-22
 | Reciprocating saw SR 6-22
 | Unique
 | 2
 | Elingue Pour Conteneur / Sling For Container
 | Container sling
 | Unique
 | 1
 | Field Tablet
 | Field tablet
 | Unique
 | 1
 | Poa 67 / Poa 75
 | Laser accessory POA 67 / POA 75
 | Unique
 | 2
 | Plt 300
 | Layout tool PLT 300
 | Unique
 | 1
 | Pua 36
 | Laser accessory PUA 36
 | Unique
 | 1
 | Sc 4wl-22
 | Cordless circular saw SC 4WL-22
 | Unique
 | 1
 | Scie sur table sans fil SCT 60-22
 | Cordless table saw SCT 60-22
 | Unique
 | 1
 | Scie sauteuse sans fil SJT 6-22
 | Cordless jigsaw SJT 6-22
 | Unique
 | 1
 | Spn 6-a22 / Sid 6-22
 | Nibbler SPN 6-A22 / Impact driver SID 6-22 (legacy naming)
 | Unique
 | 2
 | Tronçonneuse à batterie 12 po DSH 700-22 ATC
 | Cordless 12" cut-off saw DSH 700-22 ATC
 | Unique
 | 1
 | Visseuse-perceuse à percussion sans fil SF 6H-22
 | Cordless hammer drill driver SF 6H-22
 | Unique
 | 1
 | (blank — 10 rows)
 | Use Model column; flag for review
 | Review
 | 10
 | 

13. One serial per row (decided 2026-09-15)
Every tool, battery and charger included, is one inventory row keyed by its ON!Track scan code. The unique/quantity split, `tool_unit`, `checkout_line_unit` and the translation table are gone. The export is produced in English, so names import as written; a blank Name falls back to Model and is flagged.
Checkout has no quantity field: the foreman scans the tag or searches and picks the exact serial. Returns scan the tag or tick the tool. An unknown tag can only be added as a new tool with a typed name.
Stock Summary on the dashboard and the Tools page group rows by category or model name for display ("on hand / total" = counted rows); every count still comes from checkout lines and return events.
Pre-launch reset: `scripts/reset-inventory.mjs` emptied tools, checkouts, returns and imports once; accounts and workers were kept. Sections above that describe quantity items, translations or a quantity field are historical.

14. Worker roster upload and lifecycle (decided 2026-09-15)
Adding: any admin adds one worker by name (Workers page or checkout quick-add). The super-admin can also upload a .xlsx with one name per row under a "Name" header; a template is downloadable from the Workers page and kept at docs/workers-template.xlsx. Upload shows a preview (new / brought back / already here, plus look-alike names) before Confirm. It never removes anyone.
Matching: names compare case- and whitespace-insensitively. A name that matches an inactive or removed worker reactivates that row rather than creating a duplicate.
Lifecycle: Active and Inactive tabs with counts. Any admin can inactivate (blocked while the worker holds tools) or reactivate from the worker page. Super-admin can remove an inactive worker: the row is hidden from the roster but kept, so the log still shows their history.

12. Scanning (decided 2026-09-14)
Who: the foreman or admin, on their own phone, inside the checkout and returns screens. Workers never scan.
How: a camera button next to the tool field opens continuous mode; each read beeps, flashes and adds a line; Done closes the camera. The Hilti tag is a Data Matrix; decoded on the phone with zxing, no data leaves the site.
Unique tools: a scan adds that tool's line. Already out → blocked with "Out to X. Return from X, then check out to Y" as one tap.
Batteries and chargers are serials like any other tool since 2026-09-15 (§13); a scan adds that one tag's line.
Unknown tag: the screen shows the code and asks for a name; the tool is added as new. The record keeps the date and the user who added it, the Tools page shows a column and an "added on site" filter, and the next import preview lists on-site additions absent from ON!Track so they get tagged there.
Hosting: phone cameras require HTTPS, so scanning ships with company-owned hosting (Vercel) and the database off the laptop. A self-signed certificate is acceptable for testing only.
Not now: worker badges, scanning by workers.
