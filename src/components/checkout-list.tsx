import Link from "next/link";
import type { CheckoutRow } from "@/lib/checkouts";
import { ageOf, fmtTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS = {
  open: "bg-accent text-accent-foreground",
  partial: "bg-warn/15 text-[#7a5a00]",
  closed: "bg-muted text-muted-foreground",
};
const STATUS_LABEL = { open: "Out", partial: "Partly back", closed: "Closed" };

export function StatusChip({ status }: { status: CheckoutRow["status"] }) {
  return (
    <span className={cn("rounded-sm px-2 py-0.5 font-heading text-xs font-semibold uppercase tracking-wide", STATUS[status])}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function AgeChip({ at }: { at: string }) {
  const a = ageOf(at);
  return (
    <span
      className={cn(
        "inline-block min-w-12 rounded-sm px-1.5 py-0.5 text-center font-heading text-xs font-semibold tabular-nums",
        a.level === "bad" ? "bg-bad text-white" : a.level === "warn" ? "bg-warn text-[#1b1b1d]" : "bg-muted text-muted-foreground"
      )}
    >
      {a.label}
    </span>
  );
}

export function CheckoutList({ rows, empty = "Nothing here.", showAge }: { rows: CheckoutRow[]; empty?: string; showAge?: boolean }) {
  if (!rows.length) return <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((c) => (
        <li key={c.id}>
          <Link href={`/log/${c.id}`} className="block rounded-lg border bg-card p-3 shadow-xs transition-colors active:bg-muted">
            <div className="flex items-center gap-2">
              <span className="font-heading text-lg font-semibold leading-tight">{c.worker_name}</span>
              <span className="ml-auto flex items-center gap-1.5">
                {showAge && c.status !== "closed" && <AgeChip at={c.created_at} />}
                <StatusChip status={c.status} />
              </span>
            </div>
            <div className="mt-1 text-sm">
              {c.lines.map((l) => {
                const back = l.returned + l.damaged + l.lost;
                return (
                  <div key={l.id} className={back === l.qty_out ? "text-muted-foreground line-through" : ""}>
                    {l.qty_out > 1 ? `${l.qty_out}× ` : ""}
                    {l.tool_name}
                    {back > 0 && back < l.qty_out ? ` (${back} back)` : ""}
                    {l.long_term ? " · long-term" : ""}
                  </div>
                );
              })}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {fmtTime(c.created_at)} · {c.admin_name}
              {c.note ? ` · ${c.note}` : ""}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
