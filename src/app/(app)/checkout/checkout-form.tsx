"use client";

import { useEffect, useRef, useState } from "react";
import { addWorker, createCheckout, type Line } from "./actions";

type Worker = { id: number; name: string };
type Tool = {
  id: number;
  name: string;
  model: string | null;
  scan_code: string | null;
  serial_number: string | null;
  item_type: "unique" | "quantity";
  on_hand: number;
  out_to: string | null;
};
type Draft = { worker: Worker | null; lines: Line[]; note: string };

const DRAFT_KEY = "checkout-draft";
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function matches(hay: (string | null)[], q: string) {
  const k = norm(q);
  return k.length > 0 && hay.some((h) => h && norm(h).includes(k));
}

export function CheckoutForm({ workers, tools }: { workers: Worker[]; tools: Tool[] }) {
  const [worker, setWorker] = useState<Worker | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [note, setNote] = useState("");
  const [workerQ, setWorkerQ] = useState("");
  const [toolQ, setToolQ] = useState("");
  const [similar, setSimilar] = useState<Worker[] | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [saving, setSaving] = useState(false);
  const [extraWorkers, setExtraWorkers] = useState<Worker[]>([]);
  const toolInput = useRef<HTMLInputElement>(null);

  // Keep the half-typed checkout if the connection drops mid-entry.
  useEffect(() => {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null") as Draft | null;
      if (d) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from localStorage after hydration
        setWorker(d.worker);
        setLines(d.lines);
        setNote(d.note);
      }
    } catch {}
  }, []);
  useEffect(() => {
    try {
      if (worker || lines.length || note) localStorage.setItem(DRAFT_KEY, JSON.stringify({ worker, lines, note }));
      else localStorage.removeItem(DRAFT_KEY);
    } catch {}
  }, [worker, lines, note]);

  const allWorkers = [...workers, ...extraWorkers];
  const workerHits = workerQ ? allWorkers.filter((w) => matches([w.name], workerQ)).slice(0, 8) : [];
  const exactWorker = allWorkers.some((w) => norm(w.name) === norm(workerQ));
  const toolHits = toolQ
    ? tools.filter((t) => matches([t.name, t.model, t.scan_code, t.serial_number], toolQ)).slice(0, 8)
    : [];
  const toolById = (id: number) => tools.find((t) => t.id === id)!;

  function pickWorker(w: Worker) {
    setWorker(w);
    setWorkerQ("");
    setSimilar(null);
    setTimeout(() => toolInput.current?.focus(), 0);
  }

  async function quickAdd(force: boolean) {
    const res = await addWorker(workerQ, force);
    if ("error" in res) return setError(res.error);
    if ("similar" in res) return setSimilar(res.similar);
    setExtraWorkers((x) => [...x, res.worker]);
    pickWorker(res.worker);
  }

  function addLine(t: Tool) {
    if (t.item_type === "unique" && t.out_to) return;
    if (t.on_hand < 1) return;
    setLines((ls) =>
      ls.some((l) => l.toolId === t.id) ? ls : [...ls, { toolId: t.id, qty: 1, longTerm: false }]
    );
    setToolQ("");
  }

  function setQty(i: number, delta: number, absolute?: number) {
    setLines((ls) =>
      ls.map((l, j) => {
        if (j !== i) return l;
        const max = toolById(l.toolId).on_hand;
        return { ...l, qty: Math.max(1, Math.min(max, absolute ?? l.qty + delta)) };
      })
    );
  }

  async function save() {
    if (!worker) return setError("Pick a worker.");
    setSaving(true);
    setError("");
    const res = await createCheckout({ workerId: worker.id, note, lines });
    setSaving(false);
    if ("error" in res) return setError(res.error);
    setSaved(`Saved: ${worker.name}, ${lines.length} item${lines.length === 1 ? "" : "s"}.`);
    setWorker(null);
    setLines([]);
    setNote("");
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {}
    // Stock changed; reload the tool list on the next entry.
    setTimeout(() => location.reload(), 1200);
  }

  return (
    <div className="flex flex-col gap-3 pb-24">
      <h1 className="text-xl font-bold">New checkout</h1>
      {saved && <p className="rounded bg-green-50 p-2 text-sm text-green-800">{saved}</p>}

      {/* Worker */}
      {worker ? (
        <div className="card flex items-center justify-between">
          <span className="font-semibold">{worker.name}</span>
          <button className="btn" onClick={() => setWorker(null)}>
            Change
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            autoFocus
            className="input"
            placeholder="Worker name"
            value={workerQ}
            onChange={(e) => {
              setWorkerQ(e.target.value);
              setSimilar(null);
            }}
          />
          {(workerHits.length > 0 || (workerQ.trim() && !exactWorker)) && (
            <ul className="card absolute z-10 mt-1 w-full p-0">
              {workerHits.map((w) => (
                <li key={w.id}>
                  <button className="row" onClick={() => pickWorker(w)}>
                    {w.name}
                  </button>
                </li>
              ))}
              {workerQ.trim() && !exactWorker && (
                <li>
                  <button className="row text-blue-700" onClick={() => quickAdd(false)}>
                    + Add “{workerQ.trim()}” as a new worker
                  </button>
                </li>
              )}
            </ul>
          )}
          {similar && (
            <div className="card mt-1 flex flex-col gap-2 border-amber-300 bg-amber-50">
              <p className="text-sm">Similar names already on the roster:</p>
              {similar.map((w) => (
                <button key={w.id} className="btn" onClick={() => pickWorker(w)}>
                  Use {w.name}
                </button>
              ))}
              <button className="btn" onClick={() => quickAdd(true)}>
                Add “{workerQ.trim()}” anyway
              </button>
            </div>
          )}
        </div>
      )}

      {/* Lines */}
      {lines.map((l, i) => {
        const t = toolById(l.toolId);
        return (
          <div key={l.toolId} className="card flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold">{t.name}</div>
                <div className="text-xs text-zinc-500">
                  {t.item_type === "unique" ? t.serial_number || t.scan_code : `${t.on_hand} on hand`}
                </div>
              </div>
              <button className="btn" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>
                ✕
              </button>
            </div>
            <div className="flex items-center gap-3">
              {t.item_type === "quantity" ? (
                <div className="flex items-center gap-1">
                  <button className="btn w-11" onClick={() => setQty(i, -1)}>
                    −
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    className="input w-16 text-center"
                    value={l.qty}
                    onChange={(e) => setQty(i, 0, Number(e.target.value) || 1)}
                  />
                  <button className="btn w-11" onClick={() => setQty(i, 1)}>
                    +
                  </button>
                </div>
              ) : (
                <span className="text-sm text-zinc-500">Qty 1</span>
              )}
              <label className="ml-auto flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-5"
                  checked={l.longTerm}
                  onChange={(e) =>
                    setLines((ls) => ls.map((x, j) => (j === i ? { ...x, longTerm: e.target.checked } : x)))
                  }
                />
                Long-term
              </label>
            </div>
          </div>
        );
      })}

      {/* Tool picker */}
      <div className="relative">
        <input
          ref={toolInput}
          className="input"
          placeholder={lines.length ? "Add another tool" : "Tool name, model, or scan code"}
          value={toolQ}
          onChange={(e) => setToolQ(e.target.value)}
        />
        {toolHits.length > 0 && (
          <ul className="card absolute z-10 mt-1 w-full p-0">
            {toolHits.map((t) => {
              const unavailable = t.item_type === "unique" ? !!t.out_to : t.on_hand < 1;
              return (
                <li key={t.id}>
                  <button
                    className={`row ${unavailable ? "text-zinc-400" : ""}`}
                    disabled={unavailable}
                    onClick={() => addLine(t)}
                  >
                    <span>{t.name}</span>
                    <span className="block text-xs">
                      {t.item_type === "unique"
                        ? t.out_to
                          ? `out to ${t.out_to}`
                          : t.serial_number || t.scan_code || ""
                        : `${t.on_hand} on hand`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {toolQ && !toolHits.length && <p className="p-2 text-sm text-zinc-500">No matching tool.</p>}
      </div>

      <input className="input" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />

      {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}

      <div className="fixed inset-x-0 bottom-0 border-t bg-white p-3">
        <button
          className="btn-primary w-full"
          disabled={saving || !worker || !lines.length}
          onClick={save}
        >
          {saving ? "Saving…" : "Save checkout"}
        </button>
      </div>
    </div>
  );
}
