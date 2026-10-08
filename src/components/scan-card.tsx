"use client";

import { fmtTime, ids } from "@/lib/format";
import type { ScanHit } from "@/lib/scan";

// One scanned tool, held until the foreman taps Confirm. Shared by checkout and returns.
export function ScanCard({ hit, confirmLabel, onConfirm, onCancel }: {
  hit: Extract<ScanHit, { kind: "tool" }>;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const o = hit.outTo;
  return (
    <div className={`mb-2 flex flex-col gap-2 rounded p-2 text-black ${o ? "bg-amber-100" : "bg-white"}`}>
      <div>
        <div className="font-semibold">{hit.name}</div>
        <div className="text-xs">{ids(hit.serial, hit.code)}</div>
      </div>
      {o && (
        <p>
          Still on {o.worker}&apos;s list (out since {fmtTime(o.since)}).
          {o.others > 0 && ` ${o.worker} has ${o.others} other tool${o.others === 1 ? "" : "s"} out; they stay out.`}
        </p>
      )}
      <button className="btn" onClick={onConfirm}>{confirmLabel}</button>
      <button className="btn" onClick={onCancel}>Cancel</button>
    </div>
  );
}
