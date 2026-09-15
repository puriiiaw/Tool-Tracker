"use server";

import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { applyImport, parseExport, planImport } from "@/lib/import";
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
