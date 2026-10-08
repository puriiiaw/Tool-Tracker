import Link from "next/link";
import {
  AlertTriangle, ArrowRight, BatteryCharging, Briefcase, ChevronRight, Drill, FileText, HardHat,
  Plug, Ruler, Undo2, Upload, Users, type LucideIcon,
} from "lucide-react";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { fmtTime } from "@/lib/format";
import { dismissAttention, handOverAttention } from "./sync/actions";
import { listCheckouts } from "@/lib/checkouts";
import { allToolStock } from "@/lib/inventory";
import { CATEGORIES, type Category } from "@/lib/category";
import { AgeChip } from "@/components/checkout-list";
import { cn } from "@/lib/utils";

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");

const CAT_META: Record<Category, { icon: LucideIcon; bar: string }> = {
  Batteries: { icon: BatteryCharging, bar: "bg-green" },
  Chargers: { icon: Plug, bar: "bg-blue" },
  "Power Tools": { icon: Drill, bar: "bg-navy" },
  "Safety Equipment": { icon: HardHat, bar: "bg-amber" },
  "Lasers & Layout": { icon: Ruler, bar: "bg-blue" },
  "Access Equipment": { icon: Briefcase, bar: "bg-navy" },
};

function Stat({ icon: Icon, label, value, sub, tone, href }: {
  icon: LucideIcon; label: string; value: number; sub: string; tone: "blue" | "green" | "navy" | "red"; href: string;
}) {
  const tones = {
    blue: "bg-[#eaf2fd] border-[#d3e2f7] text-blue",
    green: "bg-[#ebf7ee] border-[#cfe9d6] text-green",
    navy: "bg-[#eaf1fa] border-[#d3e0f2] text-navy",
    red: "bg-[#fdeeee] border-[#f6d2d0] text-red",
  }[tone];
  return (
    <Link href={href} className={cn("panel flex gap-4 border p-5 transition-shadow hover:shadow-md", tones)}>
      <span className="grid size-14 shrink-0 place-items-center rounded-full bg-white/80 lg:size-16"><Icon className="size-7 lg:size-8" strokeWidth={2} /></span>
      <div className="min-w-0">
        <div className="text-sm font-semibold leading-tight text-foreground lg:text-base">{label}</div>
        <div className="mt-1 text-4xl font-bold leading-none tabular-nums lg:text-6xl">{value}</div>
        <div className="mt-2 hidden text-sm text-muted-foreground sm:block">{sub}</div>
      </div>
    </Link>
  );
}

type Attn = { id: number; message: string; worker_id: number | null; tool_id: number | null; tap_at: string };

export default async function Home({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requireUser();
  const { msg } = await searchParams;
  const asks = db.prepare("SELECT id, message, worker_id, tool_id, tap_at FROM attention WHERE resolution IS NULL ORDER BY id").all() as Attn[];
  const open = listCheckouts({ status: "open" }, 500).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const outRows = open.flatMap((c) =>
    c.lines
      .map((l) => ({ ...l, remaining: l.qty_out - l.returned - l.damaged - l.lost, checkout: c }))
      .filter((l) => l.remaining > 0)
  );
  const holders = new Set(open.map((c) => c.worker_id)).size;
  const tools = allToolStock();
  const active = tools.filter((t) => t.status === "active");
  const onHand = active.reduce((s, t) => s + Math.max(0, t.on_hand), 0);
  const attention = tools.filter((t) => t.import_flag || t.status === "damaged" || t.status === "lost");
  const byCat = CATEGORIES.map((cat) => {
    const rows = active.filter((t) => t.category === cat);
    return { cat, onHand: rows.reduce((s, t) => s + Math.max(0, t.on_hand), 0), total: rows.length };
  }).filter((c) => c.total > 0);

  return (
    <div className="flex flex-col gap-5">
      {msg && <p className="rounded-lg bg-green-100 px-3 py-2 text-sm text-green-900">{msg}</p>}
      {asks.length > 0 && (
        <section className="panel border border-red/30 p-4">
          <h2 className="text-xl font-bold">Sent from a phone, needs a decision</h2>
          <ul className="mt-2 divide-y">
            {asks.map((a) => (
              <li key={a.id} className="flex flex-col gap-2 py-3">
                <p>{a.message}</p>
                <p className="text-xs text-muted-foreground">Recorded on the phone {fmtTime(a.tap_at)}</p>
                <div className="flex gap-2">
                  {a.worker_id && a.tool_id && (
                    <form action={handOverAttention}>
                      <input type="hidden" name="id" value={a.id} />
                      <button className="btn-primary">Hand over</button>
                    </form>
                  )}
                  <form action={dismissAttention}>
                    <input type="hidden" name="id" value={a.id} />
                    <button className="btn">Dismiss</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5">
        <Stat icon={Upload} label="Open Checkouts" value={open.length} sub="Tools currently out on site" tone="blue" href="/log" />
        <Stat icon={Users} label="Workers Holding Tools" value={holders} sub="Active workers with tools" tone="green" href="/workers" />
        <Stat icon={Briefcase} label="Tools On Hand" value={onHand} sub="Available on site" tone="navy" href="/tools" />
        <Stat icon={AlertTriangle} label="Items Needing Attention" value={attention.length} sub="Damaged, lost or flagged" tone="red" href="/tools?flag=1" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Currently out */}
        <section className="panel p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Currently Out</h2>
            <Link href="/log" className="flex items-center gap-1 text-sm font-medium text-blue hover:underline">View all <ArrowRight className="size-4" /></Link>
          </div>
          {outRows.length ? (
            <table className="mt-3 w-full text-[15px]">
              <thead>
                <tr className="border-b text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="py-2 font-semibold">Worker</th>
                  <th className="py-2 font-semibold">Tool</th>
                  <th className="py-2 text-right font-semibold">Qty</th>
                  <th className="hidden py-2 text-right font-semibold sm:table-cell">Age</th>
                </tr>
              </thead>
              <tbody>
                {outRows.slice(0, 8).map((r) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="py-2.5">
                      <Link href={`/log/${r.checkout.id}`} className="flex items-center gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold text-navy">{initials(r.checkout.worker_name)}</span>
                        <span className="font-medium">{r.checkout.worker_name}</span>
                      </Link>
                    </td>
                    <td className="py-2.5">{r.tool_name}</td>
                    <td className="py-2.5 text-right tabular-nums">{r.remaining}</td>
                    <td className="hidden py-2.5 text-right sm:table-cell"><AgeChip at={r.checkout.created_at} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="py-10 text-center text-muted-foreground">Everything is in.</p>
          )}
          {outRows.length > 8 && (
            <Link href="/log" className="mt-2 block text-center text-sm text-muted-foreground hover:underline">{outRows.length - 8} more</Link>
          )}
        </section>

        {/* Stock summary */}
        <section className="panel p-5">
          <h2 className="text-2xl font-bold">Stock Summary</h2>
          <div className="mt-3 flex justify-between border-b pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Category</span><span>On hand / Total</span>
          </div>
          <ul>
            {byCat.map(({ cat, onHand, total }) => {
              const { icon: Icon, bar } = CAT_META[cat];
              const pct = total ? Math.round((onHand / total) * 100) : 0;
              return (
                <li key={cat} className="border-b py-3.5 last:border-0">
                  <Link href={`/tools?category=${encodeURIComponent(cat)}`} className="grid grid-cols-[auto_1fr_minmax(0,1fr)] items-center gap-4">
                    <Icon className={cn("size-6", bar.replace("bg-", "text-"))} strokeWidth={2} />
                    <span className="font-semibold">{cat}</span>
                    <span className="min-w-0">
                      <span className="block text-right text-lg tabular-nums"><b>{onHand}</b> <span className="text-muted-foreground">/ {total}</span></span>
                      <span className="mt-1 block h-2 overflow-hidden rounded-full bg-muted">
                        <span className={cn("block h-full rounded-full", bar)} style={{ width: `${pct}%` }} />
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
            {!byCat.length && <li className="py-6 text-center text-muted-foreground">No tools yet.</li>}
          </ul>
        </section>
      </div>

      {/* Action cards */}
      <div className="panel grid gap-3 p-3 lg:grid-cols-3 lg:gap-4 lg:p-4">
        {[
          { href: "/checkout", icon: ArrowRight, title: "New Checkout", sub: "Assign tools to a worker", primary: true },
          { href: "/returns", icon: Undo2, title: "Record Return", sub: "Check tools back in" },
          { href: "/log", icon: FileText, title: "View Log", sub: "See all activity" },
        ].map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className={cn(
              "flex items-center gap-4 rounded-xl border px-5 py-4 transition-shadow hover:shadow-md",
              a.primary ? "border-primary bg-primary text-white" : "border-border bg-card"
            )}
          >
            <span className={cn("grid size-12 shrink-0 place-items-center rounded-full", a.primary ? "bg-white/15" : "bg-secondary text-navy")}>
              <a.icon className="size-6" strokeWidth={2.2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xl font-semibold">{a.title}</span>
              <span className={cn("block text-sm", a.primary ? "text-white/80" : "text-muted-foreground")}>{a.sub}</span>
            </span>
            <ChevronRight className="size-6 shrink-0 opacity-70" />
          </Link>
        ))}
      </div>
    </div>
  );
}
