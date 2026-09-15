"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Scanner } from "@/components/scanner";
import { returnByScan } from "./actions";

export function ReturnScanner() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [log, setLog] = useState<{ text: string; bad?: boolean }[]>([]);
  const onCode = async (code: string) => {
    const r = await returnByScan(code);
    setLog((x) => [r, ...x].slice(0, 8));
  };
  return (
    <>
      <button type="button" className="btn" onClick={() => { setLog([]); setOpen(true); }}>
        Scan returns
      </button>
      {open && (
        <Scanner onCode={onCode} onClose={() => { setOpen(false); router.refresh(); }}>
          {log.map((e, i) => <p key={i} className={e.bad ? "text-red-400" : i === 0 ? "text-green-300" : "text-zinc-300"}>{e.text}</p>)}
          {!log.length && <p className="text-zinc-500">Scan each tag as it comes back. Any worker, any checkout.</p>}
        </Scanner>
      )}
    </>
  );
}
