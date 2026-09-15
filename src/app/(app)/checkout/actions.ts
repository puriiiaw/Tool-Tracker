"use server";

import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { toolStock } from "@/lib/inventory";
import { categoryFor } from "@/lib/category";
import { lookupCode, unitHolder, type ScanHit } from "@/lib/scan";
import { recordReturns } from "@/app/(app)/log/actions";

// unitIds: tags scanned on a quantity line; never more than qty. Unique lines carry none.
export type Line = { toolId: number; qty: number; longTerm: boolean; unitIds?: number[] };

export async function scanLookup(code: string): Promise<ScanHit> {
  await requireUser();
  return lookupCode(code);
}

// The one-tap fix for "already out to X": return it from X now, then the caller adds the line.
export async function returnFromHolder(lineId: number, unitId?: number): Promise<{ error: string } | { ok: true }> {
  const actor = await requireUser();
  const checkoutId = db.prepare("SELECT checkout_id FROM checkout_line WHERE id = ?").pluck().get(lineId) as number | undefined;
  if (!checkoutId) return { error: "Line not found." };
  try {
    await recordReturns(actor.id, checkoutId, [{ lineId, qty: 1, outcome: "returned", unitIds: unitId ? [unitId] : undefined }]);
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// Unknown tag: one more unit of an existing model, or a brand-new unique tool. Records who added it and when.
export async function addScannedTool(
  code: string,
  target: { toolId: number } | { name: string }
): Promise<{ error: string } | { hit: ScanHit }> {
  const actor = await requireUser();
  const first = lookupCode(code);
  if (first.kind !== "unknown") return { hit: first };
  try {
    db.transaction(() => {
      if ("toolId" in target) {
        const t = db.prepare("SELECT id, item_type FROM tool WHERE id = ? AND status = 'active'").get(target.toolId) as { id: number; item_type: string } | undefined;
        if (!t || t.item_type !== "quantity") throw new Error("Pick a battery or charger model.");
        const before = db.prepare("SELECT total_qty FROM tool WHERE id = ?").get(t.id);
        const uid = Number(
          db.prepare("INSERT INTO tool_unit (tool_id, scan_code, created_at, created_by) VALUES (?, ?, datetime('now'), ?)")
            .run(t.id, first.code, actor.id).lastInsertRowid
        );
        db.prepare("UPDATE tool SET total_qty = total_qty + 1 WHERE id = ?").run(t.id);
        audit(actor.id, "tool_unit", uid, "create_on_site", before, { tool_id: t.id, scan_code: first.code });
      } else {
        const name = target.name.trim();
        if (!name) throw new Error("Give the tool a name.");
        const id = Number(
          db.prepare("INSERT INTO tool (name, scan_code, item_type, category, created_by) VALUES (?, ?, 'unique', ?, ?)")
            .run(name, first.code, categoryFor(name), actor.id).lastInsertRowid
        );
        audit(actor.id, "tool", id, "create_on_site", null, { id, name, scan_code: first.code });
      }
    })();
    return { hit: lookupCode(code) };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

function normalize(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Quick-add from the checkout screen. Warns on near-duplicate names unless force is set.
type AddWorkerResult = { error: string } | { similar: { id: number; name: string }[] } | { worker: { id: number; name: string } };

export async function addWorker(name: string, force = false): Promise<AddWorkerResult> {
  const actor = await requireUser();
  name = name.trim().replace(/\s+/g, " ");
  if (!name) return { error: "Name is required." };
  const key = normalize(name);
  const existing = db.prepare("SELECT id, name FROM worker WHERE active = 1").all() as {
    id: number;
    name: string;
  }[];
  const similar = existing.filter((w) => {
    const k = normalize(w.name);
    return k === key || k.includes(key) || key.includes(k);
  });
  if (similar.length && !force) return { similar };
  const id = db.transaction(() => {
    const id = Number(
      db.prepare("INSERT INTO worker (name, created_by) VALUES (?, ?)").run(name, actor.id).lastInsertRowid
    );
    audit(actor.id, "worker", id, "create", null, { id, name });
    return id;
  })();
  return { worker: { id, name } };
}

export async function createCheckout(input: {
  workerId: number;
  note: string;
  lines: Line[];
}): Promise<{ error: string } | { id: number }> {
  const actor = await requireUser();
  const worker = db.prepare("SELECT id, name FROM worker WHERE id = ? AND active = 1").get(input.workerId);
  if (!worker) return { error: "Pick a worker from the list." };
  if (!input.lines.length) return { error: "Add at least one tool." };

  try {
    const id = db.transaction(() => {
      // Validate against live stock inside the transaction so two foremen cannot double-book.
      for (const line of input.lines) {
        const tool = toolStock(line.toolId);
        if (!tool || tool.status !== "active") throw new Error("A tool on this checkout is not available.");
        const qty = Math.floor(line.qty);
        if (tool.item_type === "unique") {
          if (qty !== 1) throw new Error(`${tool.name}: quantity must be 1.`);
          if (tool.out_to) throw new Error(`${tool.name} is already out to ${tool.out_to}.`);
        } else if (qty < 1 || qty > tool.on_hand) {
          throw new Error(`${tool.name}: only ${tool.on_hand} on hand.`);
        }
        const units = line.unitIds ?? [];
        if (units.length > qty) throw new Error(`${tool.name}: more tags scanned than quantity.`);
        for (const u of units) {
          const owner = db.prepare("SELECT tool_id FROM tool_unit WHERE id = ?").pluck().get(u);
          if (owner !== tool.id) throw new Error(`${tool.name}: a scanned tag belongs to another model.`);
          const h = unitHolder(u);
          if (h) throw new Error(`${tool.name}: a scanned tag is already out to ${h.worker}.`);
        }
      }
      const id = Number(
        db.prepare("INSERT INTO checkout (worker_id, created_by, note) VALUES (?, ?, ?)")
          .run(input.workerId, actor.id, input.note.trim() || null).lastInsertRowid
      );
      const ins = db.prepare(
        "INSERT INTO checkout_line (checkout_id, tool_id, qty_out, long_term) VALUES (?, ?, ?, ?)"
      );
      const insUnit = db.prepare("INSERT INTO checkout_line_unit (checkout_line_id, tool_unit_id) VALUES (?, ?)");
      for (const line of input.lines) {
        const lineId = ins.run(id, line.toolId, Math.floor(line.qty), line.longTerm ? 1 : 0).lastInsertRowid;
        for (const u of line.unitIds ?? []) insUnit.run(lineId, u);
      }
      audit(actor.id, "checkout", id, "create", null, { ...input, id });
      return id;
    })();
    return { id };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
