import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { fmtTime } from "@/lib/format";
import { planImport, type ExportRow } from "@/lib/import";
import { stagedFile } from "@/lib/staging";
import { commitImport, uploadExport } from "./actions";

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; msg?: string }>;
}) {
  await requireUser("super_admin");
  const { t = "", msg } = await searchParams;
  const staged = t ? stagedFile<ExportRow>(t) : null;
  const runs = db
    .prepare("SELECT r.run_at, r.file_name, r.counts_json, u.name FROM import_run r JOIN user u ON u.id = r.run_by ORDER BY r.id DESC LIMIT 5")
    .all() as { run_at: string; file_name: string; counts_json: string; name: string }[];

  if (!staged) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-xl font-bold">Import from ON!Track</h1>
        {msg && <p className="rounded bg-amber-50 p-2 text-sm">{msg}</p>}
        <form action={uploadExport} className="card flex flex-col gap-2">
          <p className="text-sm text-zinc-600">
            Upload the Assets_Details.xlsx export as-is. Tools are matched on scan code: only new codes are added,
            existing ones are updated if a field changed. Nothing changes until you confirm the preview.
          </p>
          <input type="file" name="file" accept=".xlsx" required className="input py-2" />
          <button className="btn-primary">Preview import</button>
        </form>
        {runs.length > 0 && (
          <div className="card text-sm">
            <h2 className="font-semibold">Recent imports</h2>
            {runs.map((r, i) => {
              const c = JSON.parse(r.counts_json);
              return (
                <div key={i} className="text-zinc-600">
                  {fmtTime(r.run_at)} · {r.name} · {r.file_name} · {c.new} new, {c.updated} updated, {c.missing} missing
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const plan = planImport(db, staged.rows);
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-xl font-bold">Preview: {staged.fileName}</h1>
      <div className="card grid grid-cols-4 text-center text-sm">
        <div><b>{plan.counts.new}</b><br />new</div>
        <div><b>{plan.counts.updated}</b><br />updated</div>
        <div><b>{plan.counts.unchanged}</b><br />unchanged</div>
        <div><b>{plan.counts.missing}</b><br />missing</div>
      </div>

      <form action={commitImport}>
        <input type="hidden" name="t" value={t} />
        <button className="btn-primary w-full">Confirm import</button>
      </form>

      {plan.newTools.length > 0 && (
        <details className="card">
          <summary className="cursor-pointer font-semibold">New tools ({plan.newTools.length})</summary>
          {plan.newTools.map((r) => (
            <div key={r.scan_code} className="py-1 text-sm">
              {r.name} · {r.scan_code}{r.serial_number ? ` · ${r.serial_number}` : ""}
              {r.flag ? <span className="text-amber-700"> · {r.flag}</span> : ""}
            </div>
          ))}
        </details>
      )}
      {plan.updated.length > 0 && (
        <details className="card">
          <summary className="cursor-pointer font-semibold">Updated tools ({plan.updated.length})</summary>
          {plan.updated.map((r) => (
            <div key={r.id} className="py-1 text-sm">
              {r.name} · {r.scan_code}:{" "}
              {Object.entries(r.changes).map(([k, [a, b]]) => `${k} "${a ?? ""}" → "${b ?? ""}"`).join(", ")}
            </div>
          ))}
        </details>
      )}
      {plan.missing.length > 0 && (
        <details className="card">
          <summary className="cursor-pointer font-semibold">In app but not in file ({plan.missing.length}) — will be flagged, not removed</summary>
          {plan.missing.map((m) => (
            <div key={m.id} className="py-1 text-sm">
              {m.name} · {m.scan_code}
              {m.onSite && <span className="text-amber-700"> · added on site, tag it in ON!Track</span>}
            </div>
          ))}
        </details>
      )}
    </div>
  );
}
