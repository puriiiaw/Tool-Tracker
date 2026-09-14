import Link from "next/link";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { createWorker } from "./actions";

type Row = { id: number; name: string; active: number; out_lines: number };

export default async function WorkersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; msg?: string; add?: string }>;
}) {
  await requireUser();
  const { q = "", msg, add } = await searchParams;
  const rows = (
    db
      .prepare(
        `SELECT w.id, w.name, w.active,
           (SELECT COUNT(*) FROM checkout_line cl JOIN checkout c ON c.id = cl.checkout_id
             WHERE c.worker_id = w.id
               AND cl.qty_out > (SELECT COALESCE(SUM(qty), 0) FROM return_event WHERE checkout_line_id = cl.id)) AS out_lines
         FROM worker w ORDER BY w.active DESC, w.name`
      )
      .all() as Row[]
  ).filter((w) => !q || w.name.toLowerCase().includes(q.toLowerCase()));

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
      <form className="flex gap-2">
        <input name="q" defaultValue={q} placeholder="Search name" className="input" />
        <button className="btn">Go</button>
      </form>
      <ul className="flex flex-col gap-1">
        {rows.map((w) => (
          <li key={w.id}>
            <Link href={`/workers/${w.id}`} className={`card flex items-center justify-between ${w.active ? "" : "opacity-50"}`}>
              <span className="font-semibold">{w.name}</span>
              <span className="text-sm text-zinc-500">
                {w.active ? (w.out_lines ? `${w.out_lines} item${w.out_lines === 1 ? "" : "s"} out` : "nothing out") : "inactive"}
              </span>
            </Link>
          </li>
        ))}
        {!rows.length && <li className="p-3 text-sm text-zinc-500">No workers.</li>}
      </ul>
    </div>
  );
}
