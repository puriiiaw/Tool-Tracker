"use server";

import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { toolStock } from "@/lib/inventory";
import { categoryFor } from "@/lib/category";
import { lookupCode, type ScanHit } from "@/lib/scan";
import { recordReturns } from "@/app/(app)/log/actions";

export type Line = { toolId: number; longTerm: boolean };

export async function scanLookup(code: string): Promise<ScanHit> {
  await requireUser();
  return lookupCode(code);
}

// The one-tap fix for "already out to X": return it from X now, then the caller adds the line.
export async function returnFromHolder(lineId: number): Promise<{ error: string } | { ok: true }> {
  const actor = await requireUser();
  const checkoutId = db.prepare("SELECT checkout_id FROM checkout_line WHERE id = ?").pluck().get(lineId) as number | undefined;
  if (!checkoutId) return { error: "Line not found." };
  try {
    await recordReturns(actor.id, checkoutId, [{ lineId, outcome: "returned" }]);
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
        if (tool.out_to) throw new Error(`${tool.name} is already out to ${tool.out_to}.`);
      }
      const id = Number(
        db.prepare("INSERT INTO checkout (worker_id, created_by, note) VALUES (?, ?, ?)")
          .run(input.workerId, actor.id, input.note.trim() || null).lastInsertRowid
      );
      const ins = db.prepare("INSERT INTO checkout_line (checkout_id, tool_id, long_term) VALUES (?, ?, ?)");
      for (const line of input.lines) ins.run(id, line.toolId, line.longTerm ? 1 : 0);
      audit(actor.id, "checkout", id, "create", null, { ...input, id });
      return id;
    })();
    return { id };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
