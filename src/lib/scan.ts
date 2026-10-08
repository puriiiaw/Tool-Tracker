import { db } from "@/db";
import { normalizeCode } from "@/lib/format";
import { holderOf, type HolderRow } from "@/lib/holder";

// `since` is empty when a phone built the hit offline from its own copy of the list.
export type Holder = Omit<HolderRow, "workerId">;
export type ScanHit =
  | { kind: "tool"; toolId: number; name: string; serial: string | null; code: string; status: string; outTo: Holder | null }
  | { kind: "unknown"; code: string };

export function lookupCode(raw: string): ScanHit {
  const code = normalizeCode(raw);
  const tool = db.prepare("SELECT id, name, serial_number AS serial, status FROM tool WHERE scan_code = ?").get(code) as
    | { id: number; name: string; serial: string | null; status: string }
    | undefined;
  if (tool) return { kind: "tool", toolId: tool.id, name: tool.name, serial: tool.serial, code, status: tool.status, outTo: holderOf(db, tool.id) };
  return { kind: "unknown", code };
}
