import Link from "next/link";
import type { CheckoutRow } from "@/lib/checkouts";
import { fmtTime } from "@/lib/format";

const STATUS = {
  open: "bg-amber-100 text-amber-800",
  partial: "bg-blue-100 text-blue-800",
  closed: "bg-zinc-100 text-zinc-600",
};

export function CheckoutList({ rows, empty = "Nothing here." }: { rows: CheckoutRow[]; empty?: string }) {
  if (!rows.length) return <p className="p-3 text-sm text-zinc-500">{empty}</p>;
  return (
    <ul className="flex flex-col gap-1">
      {rows.map((c) => (
        <li key={c.id}>
          <Link href={`/log/${c.id}`} className="card block">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{c.worker_name}</span>
              <span className={`rounded px-2 py-0.5 text-xs ${STATUS[c.status]}`}>
                {c.status === "open" ? "out" : c.status === "partial" ? "partly back" : "closed"}
              </span>
            </div>
            <div className="text-sm">
              {c.lines.map((l) => {
                const back = l.returned + l.damaged + l.lost;
                return (
                  <div key={l.id} className={back === l.qty_out ? "text-zinc-400 line-through" : ""}>
                    {l.qty_out > 1 ? `${l.qty_out}× ` : ""}
                    {l.tool_name}
                    {back > 0 && back < l.qty_out ? ` (${back} back)` : ""}
                    {l.long_term ? " · long-term" : ""}
                  </div>
                );
              })}
            </div>
            <div className="text-xs text-zinc-500">
              {fmtTime(c.created_at)} · {c.admin_name}
              {c.note ? ` · ${c.note}` : ""}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
