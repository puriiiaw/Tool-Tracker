"use server";

import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { applyImport, nameKey, parseExport, planImport } from "@/lib/import";
import { STAGING_DIR as DIR, stagedFile } from "@/lib/staging";

function fail(msg: string): never {
  redirect(`/import?msg=${encodeURIComponent(msg)}`);
}

// Parse the upload once and stage it on disk so the preview can be revisited and then committed.
export async function uploadExport(form: FormData) {
  await requireUser("super_admin");
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) fail("Choose the Assets_Details.xlsx file first.");
  let rows: ReturnType<typeof parseExport>;
  try {
    rows = parseExport(await file.arrayBuffer());
  } catch (e) {
    fail((e as Error).message);
  }
  if (!rows.length) fail("No rows with a scan code found in that file.");
  fs.mkdirSync(DIR, { recursive: true });
  const token = randomBytes(16).toString("hex");
  fs.writeFileSync(path.join(DIR, `${token}.json`), JSON.stringify({ fileName: file.name, rows }));
  redirect(`/import?t=${token}`);
}

// Name and type edits from the preview (or the translation table) are saved, then the preview recomputes.
export async function saveTranslations(form: FormData) {
  const actor = await requireUser("super_admin");
  const token = String(form.get("t") ?? "");
  const existing = db.prepare("SELECT source_name FROM translation").all() as { source_name: string }[];
  const byKey = new Map(existing.map((r) => [nameKey(r.source_name), r.source_name]));
  db.transaction(() => {
    for (const [k, v] of form.entries()) {
      const m = /^en_(\d+)$/.exec(k);
      if (!m) continue;
      const source = String(form.get(`src_${m[1]}`) ?? "").trim();
      const english = String(v).trim();
      const t = form.get(`type_${m[1]}`);
      const item_type = t === "quantity" || t === "unique" ? t : null;
      if (!source || !english) continue;
      const key = byKey.get(nameKey(source)) ?? source;
      db.prepare(
        `INSERT INTO translation (source_name, english_name, item_type) VALUES (?, ?, ?)
         ON CONFLICT(source_name) DO UPDATE SET english_name = excluded.english_name, item_type = excluded.item_type`
      ).run(key, english, item_type);
    }
    db.prepare("INSERT INTO audit_log (actor_id, entity, action) VALUES (?, 'translation', 'update')").run(actor.id);
  })();
  redirect(token ? `/import?t=${token}` : "/import?msg=" + encodeURIComponent("Translations saved."));
}

export async function commitImport(form: FormData) {
  const actor = await requireUser("super_admin");
  const token = String(form.get("t") ?? "");
  const staged = stagedFile(token);
  if (!staged) fail("That preview has expired. Upload the file again.");
  const plan = planImport(db, staged.rows);
  applyImport(db, plan, actor.id, staged.fileName);
  fs.unlinkSync(path.join(DIR, `${token}.json`));
  redirect(
    `/import?msg=${encodeURIComponent(
      `Imported ${staged.fileName}: ${plan.counts.new} new, ${plan.counts.updated} updated, ${plan.counts.unchanged} unchanged, ${plan.counts.missing} flagged missing.`
    )}`
  );
}
