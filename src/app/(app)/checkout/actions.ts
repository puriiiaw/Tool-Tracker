"use server";

import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { categoryFor } from "@/lib/category";
import { lookupCode, type ScanHit } from "@/lib/scan";
import { cleanName, looseKey, upsertWorker } from "@/lib/workers";

export async function scanLookup(code: string): Promise<ScanHit> {
  await requireUser();
  return lookupCode(code);
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
