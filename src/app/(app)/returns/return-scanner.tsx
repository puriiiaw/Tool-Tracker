"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Scanner } from "@/components/scanner";
import { ScanCard } from "@/components/scan-card";
import type { ScanHit } from "@/lib/scan";
import { returnFromHolder, scanLookup } from "../checkout/actions";

export function ReturnScanner() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [log, setLog] = useState<{ text: string; bad?: boolean }[]>([]);
  const [pending, setPending] = useState<Extract<ScanHit, { kind: "tool" }> | null>(null);
  const say = (text: string, bad = false) => setLog((x) => [{ text, bad }, ...x].slice(0, 8));
  // Each scanned tool waits on a card; the return is recorded only when the foreman confirms.
  const onCode = async (code: string) => {
    const hit = await scanLookup(code);
    if (hit.kind === "unknown") return say(`Tag ${hit.code} is not in inventory.`, true);
    if (!hit.outTo) return say(`${hit.name} is not out.`, true);
    setPending(hit);
  };
  const confirm = async () => {
    const hit = pending!;
    setPending(null);
    const r = await returnFromHolder(hit.outTo!.lineId);
    if ("error" in r) return say(r.error, true);
    say(`${hit.name} back from ${hit.outTo!.worker}.`);
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
