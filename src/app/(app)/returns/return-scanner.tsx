"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Scanner } from "@/components/scanner";
import { ScanCard } from "@/components/scan-card";
import { localHit, withQueue } from "@/lib/overlay";
import { enqueue, flush, newId, useQueued, within } from "@/lib/queue";
import type { ScanHit } from "@/lib/scan";
import { scanLookup } from "../checkout/actions";

type Tool = { id: number; name: string; scan_code: string | null; serial_number: string | null; out_to: string | null };

export function ReturnScanner({ tools }: { tools: Tool[] }) {
  const router = useRouter();
  const queued = useQueued();
  const [open, setOpen] = useState(false);
  const [log, setLog] = useState<{ text: string; bad?: boolean }[]>([]);
  const [pending, setPending] = useState<Extract<ScanHit, { kind: "tool" }> | null>(null);
  const say = (text: string, bad = false) => setLog((x) => [{ text, bad }, ...x].slice(0, 8));
  const mine = withQueue(tools, queued); // this phone's own copy, including returns still waiting to send

  // Each scanned tool waits on a card; the return is recorded only when the foreman confirms.
  const onCode = async (code: string) => {
    const hit = await within(scanLookup(code), 4000).catch(() => localHit(mine, code));
    if (hit.kind === "unknown") return say(`Tag ${hit.code} is not in inventory.`, true);
    const waiting = hit.outTo && mine.find((t) => t.id === hit.toolId)?.out_to === null; // already returned on this phone
    if (!hit.outTo || waiting) return say(`${hit.name} is not out.`, true);
    setPending(hit);
  };
  const confirm = async () => {
    const hit = pending!;
    setPending(null);
    try {
      await enqueue({ id: newId(), at: new Date().toISOString(), kind: "return", toolId: hit.toolId });
    } catch {
      return say("Could not save on this phone. Nothing was recorded.", true);
    }
    say(`${hit.name} back from ${hit.outTo!.worker}.`);
    flush().then((r) => {
      if (r.left) say("No signal: saved on this phone, it will send by itself.");
      r.messages.forEach((m) => say(m, true));
    });
  };
  return (
    <>
      <button type="button" className="btn" onClick={() => { setLog([]); setPending(null); setOpen(true); }}>
        Scan returns
      </button>
      {open && (
        <Scanner onCode={onCode} onClose={() => { setOpen(false); router.refresh(); }} hold={!!pending}>
          {pending && <ScanCard hit={pending} confirmLabel={`Return from ${pending.outTo!.worker}`} onConfirm={confirm} onCancel={() => setPending(null)} />}
          {log.map((e, i) => <p key={i} className={e.bad ? "text-red-400" : i === 0 ? "text-green-300" : "text-zinc-300"}>{e.text}</p>)}
          {!log.length && !pending && <p className="text-zinc-500">Scan each tag as it comes back. Any worker, any checkout.</p>}
        </Scanner>
      )}
    </>
  );
}
