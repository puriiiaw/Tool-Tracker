import { normalizeCode } from "./format.ts";
import type { ScanHit } from "./scan.ts";
import type { QItem } from "./sync.ts";

type T = { id: number; name: string; scan_code: string | null; serial_number: string | null; out_to: string | null };

// What this phone has queued beats the server's older copy: tools in waiting checkouts are out, waiting returns are in.
export function withQueue<X extends { id: number; out_to: string | null }>(tools: X[], items: QItem[]): X[] {
  if (!items.length) return tools;
  const out = new Map<number, string | null>();
  for (const it of items) {
    if (it.kind === "return") out.set(it.toolId, null);
    else for (const l of it.lines) out.set(l.toolId, it.worker.name);
  }
  return tools.map((t) => (out.has(t.id) ? { ...t, out_to: out.get(t.id)! } : t));
}

// The scan card for a tag, built from the phone's own copy of the tool list (no signal needed).
export function localHit(tools: T[], raw: string): ScanHit {
  const code = normalizeCode(raw);
  const t = tools.find((x) => x.scan_code === code);
  if (!t) return { kind: "unknown", code };
  return {
    kind: "tool", toolId: t.id, name: t.name, serial: t.serial_number, code, status: "active",
    outTo: t.out_to ? { worker: t.out_to, lineId: 0, since: "", others: 0 } : null,
  };
}
