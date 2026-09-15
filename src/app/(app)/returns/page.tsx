import Link from "next/link";
import { Undo2 } from "lucide-react";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { listCheckouts } from "@/lib/checkouts";
import { fmtTime } from "@/lib/format";
import { AgeChip } from "@/components/checkout-list";
import { recordWorkerReturn } from "./actions";
import { ReturnScanner } from "./return-scanner";

type Holder = { id: number; name: string; items: number };

export default async function ReturnsPage({ searchParams }: { searchParams: Promise<{ worker?: string; q?: string; msg?: string }> }) {
  await requireUser();
  const { worker, q = "", msg } = await searchParams;
  const workerId = Number(worker) || 0;
  const holders = (
    db.prepare(
      `SELECT w.id, w.name, SUM(cl.qty_out - (SELECT COALESCE(SUM(qty), 0) FROM return_event WHERE checkout_line_id = cl.id AND voided = 0)) AS items
       FROM worker w JOIN checkout c ON c.worker_id = w.id JOIN checkout_line cl ON cl.checkout_id = c.id AND cl.removed = 0
       GROUP BY w.id HAVING items > 0 ORDER BY w.name`
    ).all() as Holder[]
  ).filter((h) => !q || h.name.toLowerCase().includes(q.toLowerCase()));
  const selected = workerId ? holders.find((h) => h.id === workerId) : undefined;
  const open = selected ? listCheckouts({ worker: selected.id, status: "open" }) : [];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Record Return</h1>
          <p className="text-muted-foreground">Scan the tags, or pick the worker and tick what came back.</p>
        </div>
        <ReturnScanner />
      </div>
      {msg && <p className="rounded-lg border border-green/30 bg-[#ebf7ee] p-3 text-sm text-green">{msg}</p>}

      <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <section className="panel p-4">
          <form className="flex gap-2">
            <input name="q" defaultValue={q} placeholder="Search worker" className="input" />
            <button className="btn">Go</button>
          </form>
          <ul className="mt-3 flex flex-col gap-1">
            {holders.map((h) => (
              <li key={h.id}>
                <Link
                  href={`/returns?worker=${h.id}`}
                  className={`flex items-center justify-between rounded-lg px-3 py-3 ${h.id === workerId ? "bg-primary text-white" : "hover:bg-muted"}`}
                >
                  <span className="font-medium">{h.name}</span>
                  <span className={`text-sm ${h.id === workerId ? "text-white/80" : "text-muted-foreground"}`}>
                    {h.items} item{h.items === 1 ? "" : "s"}
                  </span>
                </Link>
              </li>
            ))}
            {!holders.length && <li className="p-3 text-sm text-muted-foreground">Nobody has anything out.</li>}
          </ul>
        </section>

        <section className="panel p-4">
          {!selected ? (
            <div className="flex h-full min-h-48 flex-col items-center justify-center gap-2 text-muted-foreground">
              <Undo2 className="size-8" />
              <p>Choose a worker on the left.</p>
            </div>
          ) : (
            <form action={recordWorkerReturn} className="flex flex-col gap-3">
              <input type="hidden" name="worker" value={selected.id} />
              <h2 className="text-2xl font-bold">{selected.name}</h2>
              {open.map((c) => (
                <div key={c.id} className="rounded-lg border">
                  <div className="flex items-center justify-between border-b bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                    <span>Out {fmtTime(c.created_at)} · {c.admin_name}{c.note ? ` · ${c.note}` : ""}</span>
                    <AgeChip at={c.created_at} />
                  </div>
                  {c.lines.map((l) => {
                    const remaining = l.qty_out - l.returned - l.damaged - l.lost;
                    if (remaining <= 0) return null;
                    const key = `${c.id}_${l.id}`;
                    return (
                      <div key={l.id} className="flex flex-wrap items-center gap-3 border-b px-3 py-3 last:border-0">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium">{l.tool_name}</div>
                          <div className="text-xs text-muted-foreground">{remaining} still out{l.long_term ? " · long-term" : ""}</div>
                        </div>
                        {l.item_type === "quantity" ? (
                          <input type="number" inputMode="numeric" name={`qty_${key}`} min={0} max={remaining} placeholder={`0–${remaining}`} className="input w-24" />
                        ) : (
                          <label className="flex min-h-11 items-center gap-2 px-1">
                            <input type="checkbox" name={`qty_${key}`} value="1" className="size-5" /> Back
                          </label>
                        )}
                        <select name={`outcome_${key}`} defaultValue="returned" className="input w-32">
                          <option value="returned">Returned</option>
                          <option value="damaged">Damaged</option>
                          <option value="lost">Lost</option>
                        </select>
                      </div>
                    );
                  })}
                </div>
              ))}
              <button className="btn-primary">Save return</button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
