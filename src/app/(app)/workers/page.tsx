import Link from "next/link";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { planWorkerImport } from "@/lib/workers";
import { stagedFile } from "@/lib/staging";
import { commitWorkers, createWorker, uploadWorkers } from "./actions";

type Row = { id: number; name: string; active: number; out_lines: number };

export default async function WorkersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; msg?: string; add?: string; tab?: string; t?: string }>;
}) {
  const user = await requireUser();
  const { q = "", msg, add, tab, t = "" } = await searchParams;
  const inactive = tab === "inactive";
  const all = db
    .prepare(
      `SELECT w.id, w.name, w.active,
         (SELECT COUNT(*) FROM checkout_line cl JOIN checkout c ON c.id = cl.checkout_id
           WHERE c.worker_id = w.id AND cl.removed = 0
             AND cl.qty_out > (SELECT COALESCE(SUM(qty), 0) FROM return_event WHERE checkout_line_id = cl.id AND voided = 0)) AS out_lines
       FROM worker w WHERE w.hidden = 0 ORDER BY w.name`
    )
    .all() as Row[];
  const counts = { active: all.filter((w) => w.active).length, inactive: all.filter((w) => !w.active).length };
  const rows = all.filter((w) => !!w.active !== inactive && (!q || w.name.toLowerCase().includes(q.toLowerCase())));
  const staged = user.role === "super_admin" && t ? stagedFile<string>(t) : null;
  const plan = staged ? planWorkerImport(db, staged.rows) : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Workers</h1>
        <Link href="/workers?add=1" className="btn flex items-center">+ Add worker</Link>
      </div>
      {msg && <p className="rounded bg-amber-50 p-2 text-sm">{msg}</p>}

      {add && (
        <form action={createWorker} className="card flex gap-2">
          <input name="name" placeholder="Full name" required autoFocus className="input" />
          <button className="btn-primary">Add</button>
        </form>
      )}

      {plan && staged ? (
        <div className="card flex flex-col gap-2">
          <h2 className="font-semibold">Check {staged.fileName}, then confirm</h2>
          <p className="text-sm text-zinc-600">Nothing is saved until you press the button below.</p>
          <div className="grid grid-cols-3 text-center text-sm">
            <div><b>{plan.add.length}</b><br />new</div>
            <div><b>{plan.reactivate.length}</b><br />brought back</div>
            <div><b>{plan.existing}</b><br />already here</div>
          </div>
          {plan.similar.length > 0 && (
            <div className="rounded bg-amber-50 p-2 text-sm">
              <b>Look-alike names</b> — they will be added as new people. Fix the file and upload again if they are the same person.
              {plan.similar.map((s) => <div key={s.name}>{s.name} ≈ {s.like}</div>)}
            </div>
          )}
          {plan.add.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer">New names ({plan.add.length})</summary>
              {plan.add.map((n) => <div key={n} className="py-0.5">{n}</div>)}
            </details>
          )}
          {plan.reactivate.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer">Brought back ({plan.reactivate.length})</summary>
              {plan.reactivate.map((w) => <div key={w.id} className="py-0.5">{w.name}</div>)}
            </details>
          )}
          <form action={commitWorkers} className="flex gap-2">
            <input type="hidden" name="t" value={t} />
            <button className="btn-primary flex-1">
              {plan.add.length + plan.reactivate.length ? `Add ${plan.add.length + plan.reactivate.length} to roster` : "Nothing to add"}
            </button>
            <Link href="/workers" className="btn flex items-center">Cancel</Link>
          </form>
        </div>
      ) : (
        user.role === "super_admin" && (
          <form action={uploadWorkers} className="card flex flex-col gap-2">
            <p className="text-sm text-zinc-600">
              Upload a .xlsx with one name per row under a <b>Name</b> header
              (<a href="/workers/template" className="underline">download the template</a>). Names already on the roster are skipped; nothing is removed.
            </p>
            <div className="flex gap-2">
              <input type="file" name="file" accept=".xlsx" required className="input min-w-0 flex-1 py-2" />
              <button className="btn-primary">Upload</button>
            </div>
          </form>
        )
      )}

      <div className="flex gap-1 border-b">
        {(["active", "inactive"] as const).map((k) => (
          <Link
            key={k}
            href={k === "active" ? "/workers" : "/workers?tab=inactive"}
            className={`min-h-11 flex-1 px-3 py-2 text-center font-semibold ${inactive === (k === "inactive") ? "border-b-2 border-primary text-primary" : "text-zinc-500"}`}
          >
            {k === "active" ? "Active" : "Inactive"} ({counts[k]})
          </Link>
        ))}
      </div>

      <form className="flex gap-2">
        {inactive && <input type="hidden" name="tab" value="inactive" />}
        <input name="q" defaultValue={q} placeholder="Search name" className="input" />
        <button className="btn">Go</button>
      </form>
      <ul className="flex flex-col gap-1">
        {rows.map((w) => (
          <li key={w.id}>
            <Link href={`/workers/${w.id}`} className="card flex items-center justify-between">
              <span className="font-semibold">{w.name}</span>
              <span className="text-sm text-zinc-500">
                {w.active ? (w.out_lines ? `${w.out_lines} item${w.out_lines === 1 ? "" : "s"} out` : "nothing out") : "inactive"}
              </span>
            </Link>
          </li>
        ))}
        {!rows.length && <li className="p-3 text-sm text-zinc-500">{inactive ? "No inactive workers." : "No workers."}</li>}
      </ul>
    </div>
  );
}
