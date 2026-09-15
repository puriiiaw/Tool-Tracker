"use server";

import { redirect } from "next/navigation";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { applyImport, parseExport, planImport, type ExportRow } from "@/lib/import";
import { dropStaged, stageFile, stagedFile } from "@/lib/staging";

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
  redirect(`/import?t=${stageFile({ fileName: file.name, rows })}`);
}

export async function commitImport(form: FormData) {
  const actor = await requireUser("super_admin");
  const token = String(form.get("t") ?? "");
  const staged = stagedFile<ExportRow>(token);
  if (!staged) fail("That preview has expired. Upload the file again.");
  const plan = planImport(db, staged.rows);
  applyImport(db, plan, actor.id, staged.fileName);
  dropStaged(token);
  redirect(
    `/import?msg=${encodeURIComponent(
      `Imported ${staged.fileName}: ${plan.counts.new} new, ${plan.counts.updated} updated, ${plan.counts.unchanged} unchanged, ${plan.counts.missing} flagged missing.`
    )}`
  );
}
