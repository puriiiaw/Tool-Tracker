import Link from "next/link";
import { AlertTriangle, ArrowRight, PlusSquare } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listCheckouts, recentActivity } from "@/lib/checkouts";
import { allToolStock } from "@/lib/inventory";
import { ageOf, fmtTime } from "@/lib/format";
import { AgeChip, CheckoutList, StatusChip } from "@/components/checkout-list";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

function Stat({ label, value, tone, href, wide }: { label: string; value: number; tone?: "warn" | "bad"; href: string; wide?: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative overflow-hidden rounded-lg border bg-card p-4 shadow-xs transition-colors hover:border-foreground/30",
        wide && "col-span-2 lg:col-span-1",
        tone === "bad" && value > 0 && "border-bad/40",
        tone === "warn" && value > 0 && "border-warn/60"
      )}
    >
      <div className="font-heading text-4xl font-bold leading-none tabular-nums lg:text-5xl">{value}</div>
      <div className="mt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <ArrowRight className="absolute right-3 top-3 size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}

export default async function Home() {
  await requireUser();
  const open = listCheckouts({ status: "open" }, 500).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const holders = new Set(open.map((c) => c.worker_id)).size;
  const itemsOut = open.reduce((s, c) => s + c.remaining, 0);
  const old = open.filter((c) => ageOf(c.created_at).days >= 7).length;
  const tools = allToolStock();
  const stock = tools.filter((t) => t.item_type === "quantity" && t.status === "active");
  const attention = tools.filter((t) => t.import_flag || t.status === "damaged" || t.status === "lost");
  const activity = recentActivity();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold leading-none lg:text-4xl">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">EX-4002 QEII Halifax</p>
        </div>
        <Link
          href="/checkout"
          className="inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-md bg-primary px-4 font-heading text-lg font-semibold text-primary-foreground shadow-sm hover:brightness-95"
        >
          <PlusSquare className="size-5" /> New checkout
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Open checkouts" value={open.length} href="/log" />
        <Stat label="Workers holding kit" value={holders} href="/workers" />
        <Stat label="Items out" value={itemsOut} href="/log" />
        <Stat label="Out over 7 days" value={old} tone="warn" href="/log" />
        <Stat label="Damaged or lost" value={attention.filter((t) => t.status !== "active").length} tone="bad" href="/tools?status=damaged" wide />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Out now */}
        <section className="min-w-0">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="font-heading text-2xl font-semibold">Out now</h2>
            <Link href="/log" className="text-sm text-muted-foreground underline-offset-4 hover:underline">Full log</Link>
          </div>
          <div className="lg:hidden">
            <CheckoutList rows={open} empty="Everything is in." showAge />
          </div>
          <div className="hidden overflow-hidden rounded-lg border bg-card shadow-xs lg:block">
            {open.length ? (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/60 hover:bg-muted/60">
                    <TableHead className="w-24">Age</TableHead>
                    <TableHead>Worker</TableHead>
                    <TableHead>Items still out</TableHead>
                    <TableHead className="w-40">Out since</TableHead>
                    <TableHead className="w-28">By</TableHead>
                    <TableHead className="w-28 text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {open.map((c) => (
                    <TableRow key={c.id} className="cursor-pointer">
                      <TableCell><AgeChip at={c.created_at} /></TableCell>
                      <TableCell>
                        <Link href={`/log/${c.id}`} className="font-heading text-lg font-semibold hover:underline">{c.worker_name}</Link>
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        {c.lines
                          .filter((l) => l.qty_out - l.returned - l.damaged - l.lost > 0)
                          .map((l) => `${l.qty_out - l.returned - l.damaged - l.lost > 1 ? `${l.qty_out - l.returned - l.damaged - l.lost}× ` : ""}${l.tool_name}`)
                          .join(", ")}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{fmtTime(c.created_at)}</TableCell>
                      <TableCell className="text-muted-foreground">{c.admin_name}</TableCell>
                      <TableCell className="text-right"><StatusChip status={c.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="p-8 text-center text-muted-foreground">Everything is in.</p>
            )}
          </div>
        </section>

        <aside className="flex flex-col gap-5">
          {/* Stock */}
          <section className="rounded-lg border bg-card p-4 shadow-xs">
            <h2 className="mb-3 font-heading text-xl font-semibold">Batteries & chargers</h2>
            <ul className="flex flex-col gap-2.5">
              {stock.map((t) => {
                const pct = t.total_qty ? Math.round((t.on_hand / t.total_qty) * 100) : 0;
                return (
                  <li key={t.id}>
                    <Link href={`/tools/${t.id}`} className="block">
                      <div className="flex items-baseline justify-between text-sm">
                        <span className="truncate pr-2">{t.name}</span>
                        <span className={cn("font-heading text-base font-semibold tabular-nums", t.on_hand === 0 && "text-bad")}>
                          {t.on_hand}<span className="text-muted-foreground">/{t.total_qty}</span>
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-sm bg-muted">
                        <div className={cn("h-full", pct < 20 ? "bg-bad" : pct < 50 ? "bg-warn" : "bg-foreground")} style={{ width: `${pct}%` }} />
                      </div>
                    </Link>
                  </li>
                );
              })}
              {!stock.length && <li className="text-sm text-muted-foreground">No quantity items yet.</li>}
            </ul>
          </section>

          {/* Attention */}
          {attention.length > 0 && (
            <section className="rounded-lg border border-warn/50 bg-card p-4 shadow-xs">
              <h2 className="mb-2 flex items-center gap-2 font-heading text-xl font-semibold">
                <AlertTriangle className="size-5 text-warn" /> Needs attention
              </h2>
              <ul className="flex flex-col gap-1 text-sm">
                {attention.slice(0, 8).map((t) => (
                  <li key={t.id}>
                    <Link href={`/tools/${t.id}`} className="flex justify-between gap-2 hover:underline">
                      <span className="truncate">{t.name}</span>
                      <span className={cn("shrink-0 text-xs", t.status !== "active" ? "text-bad" : "text-muted-foreground")}>
                        {t.status !== "active" ? t.status : t.import_flag}
                      </span>
                    </Link>
                  </li>
                ))}
                {attention.length > 8 && (
                  <li><Link href="/tools?flag=1" className="text-xs text-muted-foreground underline">{attention.length - 8} more</Link></li>
                )}
              </ul>
            </section>
          )}

          {/* Activity */}
          <section className="rounded-lg border bg-card p-4 shadow-xs">
            <h2 className="mb-2 font-heading text-xl font-semibold">Recent activity</h2>
            <ol className="relative flex flex-col gap-3 border-l pl-4 text-sm">
              {activity.map((a, i) => (
                <li key={i} className="relative">
                  <span className={cn("absolute -left-[21px] top-1.5 size-2.5 rounded-full", a.kind === "checkout" ? "bg-primary" : "bg-foreground")} />
                  <Link href={`/log/${a.checkout_id}`} className="block hover:underline">
                    <span className="font-medium">{a.worker_name}</span>{" "}
                    <span className="text-muted-foreground">{a.kind === "checkout" ? "took" : "brought back"}</span> {a.summary}
                  </Link>
                  <div className="text-xs text-muted-foreground">{fmtTime(a.at)} · {a.admin_name}</div>
                </li>
              ))}
              {!activity.length && <li className="text-muted-foreground">No activity yet.</li>}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}
