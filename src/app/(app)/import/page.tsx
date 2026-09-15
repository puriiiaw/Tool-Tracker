import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { fmtTime } from "@/lib/format";
import { planImport, type NameRule, type Translation } from "@/lib/import";
import { stagedFile } from "@/lib/staging";
import { commitImport, saveTranslations, uploadExport } from "./actions";

function NameRows({ rows, token }: { rows: (NameRule | Translation)[]; token: string }) {
  return (
    <form action={saveTranslations} className="card flex flex-col gap-2">
      <input type="hidden" name="t" value={token} />
      <div className="flex flex-col divide-y">
        {rows.map((r, i) => {
          const source = "source" in r ? r.source : r.source_name;
          const english = "english" in r ? r.english : r.english_name;
          const type = "type" in r ? r.type : r.item_type;
          const known = "known" in r ? r.known : true;
          return (
            <div key={source} className={`flex flex-col gap-1 py-2 ${known ? "" : "bg-amber-50"}`}>
              <div className="text-xs text-zinc-500">
                {source}
                {"count" in r ? ` · ${r.count} row${r.count === 1 ? "" : "s"}` : ""}
                {known ? "" : " · NEW, please translate"}
              </div>
              <input type="hidden" name={`src_${i}`} value={source} />
              <div className="flex gap-2">
                <input name={`en_${i}`} defaultValue={english} className="input" />
                <select name={`type_${i}`} defaultValue={type ?? "unique"} className="input w-32">
                  <option value="unique">Unique</option>
                  <option value="quantity">Quantity</option>
                </select>
              </div>
            </div>
          );
        })}
      </div>
      <button className="btn">Save names{token ? " and refresh preview" : ""}</button>
    </form>
  );
}

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; msg?: string }>;
}) {
  await requireUser("super_admin");
  const { t = "", msg } = await searchParams;
  const staged = t ? stagedFile(t) : null;
  const runs = db
    .prepare("SELECT r.run_at, r.file_name, r.counts_json, u.name FROM import_run r JOIN user u ON u.id = r.run_by ORDER BY r.id DESC LIMIT 5")
    .all() as { run_at: string; file_name: string; counts_json: string; name: string }[];

  if (!staged) {
    const translations = db.prepare("SELECT source_name, english_name, item_type FROM translation ORDER BY source_name").all() as Translation[];
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-xl font-bold">Import from ON!Track</h1>
        {msg && <p className="rounded bg-amber-50 p-2 text-sm">{msg}</p>}
        <form action={uploadExport} className="card flex flex-col gap-2">
          <p className="text-sm text-zinc-600">Upload the Assets_Details.xlsx export as-is. Nothing changes until you confirm the preview.</p>
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
        <h2 className="font-semibold">Name translations</h2>
        <NameRows rows={translations} token="" />
      </div>
    );
  }

  const plan = planImport(db, staged.rows);
  const unknown = plan.names.filter((n) => !n.known).length;
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-xl font-bold">Preview: {staged.fileName}</h1>
      <div className="card grid grid-cols-4 text-center text-sm">
        <div><b>{plan.counts.new}</b><br />new</div>
        <div><b>{plan.counts.updated}</b><br />updated</div>
        <div><b>{plan.counts.unchanged}</b><br />unchanged</div>
        <div><b>{plan.counts.missing}</b><br />missing</div>
      </div>

      {plan.conflicts.length > 0 && (
        <div className="card border-red-300 bg-red-50 text-sm">
          <b>Skipped rows</b>
          {plan.conflicts.map((c) => <div key={c}>{c}</div>)}
        </div>
      )}

      <form action={commitImport}>
        <input type="hidden" name="t" value={t} />
        <button className="btn-primary w-full">Confirm import</button>
      </form>

      <h2 className="font-semibold">
        Names in this file {unknown > 0 && <span className="text-amber-700">· {unknown} not yet translated</span>}
      </h2>
      <NameRows rows={plan.names} token={t} />

      {plan.quantityGroups.length > 0 && (
        <details className="card">
          <summary className="cursor-pointer font-semibold">Quantity items ({plan.quantityGroups.length})</summary>
          {plan.quantityGroups.map((g) => (
            <div key={g.name} className="py-1 text-sm">
              {g.name}: +{g.newUnits.length} new, {g.existingUnits} already in app
              {g.toolId ? "" : " (new record)"}
              {g.flag ? <span className="text-amber-700"> · {g.flag}</span> : ""}
            </div>
          ))}
        </details>
      )}
      {plan.newUnique.length > 0 && (
        <details className="card">
          <summary className="cursor-pointer font-semibold">New unique tools ({plan.newUnique.length})</summary>
          {plan.newUnique.map((r) => (
            <div key={r.scan_code} className="py-1 text-sm">
              {r.name} · {r.scan_code}{r.serial_number ? ` · ${r.serial_number}` : ""}
              {r.flag ? <span className="text-amber-700"> · {r.flag}</span> : ""}
            </div>
          ))}
        </details>
      )}
      {plan.updatedUnique.length > 0 && (
        <details className="card">
          <summary className="cursor-pointer font-semibold">Updated tools ({plan.updatedUnique.length})</summary>
          {plan.updatedUnique.map((r) => (
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
            <div key={`${m.kind}${m.id}`} className="py-1 text-sm">
              {m.name} · {m.scan_code}{m.kind === "unit" ? " (unit)" : ""}
              {m.onSite && <span className="text-amber-700"> · added on site, tag it in ON!Track</span>}
            </div>
          ))}
        </details>
      )}
    </div>
  );
}
