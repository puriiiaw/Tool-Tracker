"use server";

import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { toolStock } from "@/lib/inventory";
import { categoryFor } from "@/lib/category";
import { lookupCode, type ScanHit } from "@/lib/scan";
import { cleanName, looseKey, upsertWorker } from "@/lib/workers";
import { recordReturns } from "@/app/(app)/log/actions";

export type Line = { toolId: number; longTerm: boolean };

export async function scanLookup(code: string): Promise<ScanHit> {
  await requireUser();
  return lookupCode(code);
}

// Returns exactly this one line (X's other tools stay out). At checkout: the one-tap fix for
// "already out to X", `to` names who gets it next; the caller then adds the line.
export async function returnFromHolder(lineId: number, to?: string): Promise<{ error: string } | { ok: true }> {
  const actor = await requireUser();
  const checkoutId = db.prepare("SELECT checkout_id FROM checkout_line WHERE id = ?").pluck().get(lineId) as number | undefined;
  if (!checkoutId) return { error: "Line not found." };
  try {
    await recordReturns(actor.id, checkoutId, [{ lineId, outcome: "returned", ...(to && { to }) }]);
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// Unknown tag: a brand-new tool. Records who added it and when so the next import can list it.
export async function addScannedTool(code: string, name: string): Promise<{ error: string } | { hit: ScanHit }> {
  const actor = await requireUser();
  const first = lookupCode(code);
  if (first.kind !== "unknown") return { hit: first };
  name = name.trim();
  if (!name) return { error: "Give the tool a name." };
  db.transaction(() => {
    const id = Number(
      db.prepare("INSERT INTO tool (name, scan_code, category, created_by) VALUES (?, ?, ?, ?)")
        .run(name, first.code, categoryFor(name), actor.id).lastInsertRowid
    );
    audit(actor.id, "tool", id, "create_on_site", null, { id, name, scan_code: first.code });
  })();
  return { hit: lookupCode(code) };
}

// Quick-add from the checkout screen. Warns on near-duplicate names unless force is set.
type AddWorkerResult = { error: string } | { similar: { id: number; name: string }[] } | { worker: { id: number; name: string } };

export async function addWorker(name: string, force = false): Promise<AddWorkerResult> {
  const actor = await requireUser();
  name = cleanName(name);
  if (!name) return { error: "Name is required." };
  const key = looseKey(name);
  const existing = db.prepare("SELECT id, name FROM worker WHERE active = 1 AND hidden = 0").all() as {
    id: number;
    name: string;
  }[];
  const similar = existing.filter((w) => {
    const k = looseKey(w.name);
    return k === key || k.includes(key) || key.includes(k);
  });
  if (similar.length && !force) return { similar };
  const id = db.transaction(() => upsertWorker(db, name, actor.id))();
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
  const lines = [...new Map(input.lines.map((l) => [l.toolId, l])).values()]; // one serial can only be out once per checkout

  try {
    const id = db.transaction(() => {
      // Validate against live stock inside the transaction so two foremen cannot double-book.
      for (const line of lines) {
        const tool = toolStock(line.toolId);
        if (!tool || tool.status !== "active") throw new Error("A tool on this checkout is not available.");
        if (tool.out_to) throw new Error(`${tool.name} is already out to ${tool.out_to}.`);
      }
      const id = Number(
        db.prepare("INSERT INTO checkout (worker_id, created_by, note) VALUES (?, ?, ?)")
          .run(input.workerId, actor.id, input.note.trim() || null).lastInsertRowid
      );
      const ins = db.prepare("INSERT INTO checkout_line (checkout_id, tool_id, long_term) VALUES (?, ?, ?)");
      for (const line of lines) ins.run(id, line.toolId, line.longTerm ? 1 : 0);
      audit(actor.id, "checkout", id, "create", null, { ...input, lines, id });
      return id;
    })();
    return { id };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
