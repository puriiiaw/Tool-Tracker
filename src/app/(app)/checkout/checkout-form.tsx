"use client";

import { useEffect, useRef, useState } from "react";
import { Scanner } from "@/components/scanner";
import { ScanCard } from "@/components/scan-card";
import { ids } from "@/lib/format";
import { addScannedTool, addWorker, createCheckout, returnFromHolder, scanLookup, type Line } from "./actions";
import type { ScanHit } from "@/lib/scan";

type Worker = { id: number; name: string };
type Tool = {
  id: number;
  name: string;
  model: string | null;
  scan_code: string | null;
  serial_number: string | null;
  out_to: string | null;
};
type Draft = { worker: Worker | null; lines: Line[]; note: string };
type Pending = { hit: Exclude<ScanHit, { kind: "unknown" }> } | { code: string; name: string };

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
  const [extraTools, setExtraTools] = useState<Tool[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanLog, setScanLog] = useState<{ text: string; bad?: boolean }[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
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
  const allTools = [...tools, ...extraTools];
  const toolHits = toolQ
    ? allTools.filter((t) => matches([t.name, t.model, t.scan_code, t.serial_number], toolQ)).slice(0, 8)
    : [];
  const toolById = (id: number) => allTools.find((t) => t.id === id)!;

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
    if (t.out_to) return;
    setLines((ls) => (ls.some((l) => l.toolId === t.id) ? ls : [...ls, { toolId: t.id, longTerm: false }]));
    setToolQ("");
  }

  const log = (text: string, bad = false) => setScanLog((x) => [{ text, bad }, ...x].slice(0, 5));
  // The scan log is only visible while the camera is open; outside it, problems go to the page.
  const tell = (text: string, bad = false) => {
    log(text, bad);
    if (bad && !scanning) setError(text);
  };

  type ToolHit = Exclude<ScanHit, { kind: "unknown" }>;

  // A known tool, free to add. Server re-validates on save, so no local stock check here.
  function addHit(hit: ToolHit) {
    if (hit.status !== "active") return tell(`${hit.name} is ${hit.status}.`, true);
    if (lines.some((l) => l.toolId === hit.toolId)) return tell(`${hit.name} is already on this checkout.`, true);
    if (!allTools.some((t) => t.id === hit.toolId))
      setExtraTools((x) => [...x, { id: hit.toolId, name: hit.name, model: null, scan_code: hit.code, serial_number: hit.serial, out_to: null }]);
    setLines((ls) => (ls.some((l) => l.toolId === hit.toolId) ? ls : [...ls, { toolId: hit.toolId, longTerm: false }])); // checked against the newest list, so two quick reads cannot both add
    log(`${hit.name} added.`);
  }

  // Every scanned tool waits on a card (name, serial, code) until the foreman confirms.
  function present(hit: ToolHit) {
    if (hit.status !== "active") return tell(`${hit.name} is ${hit.status}.`, true);
    if (lines.some((l) => l.toolId === hit.toolId)) return tell(`${hit.name} is already on this checkout.`, true);
    setPending({ hit });
  }

  async function onCode(code: string) {
    const hit = await scanLookup(code);
    if (hit.kind === "unknown") return setPending({ code: hit.code, name: "" });
    present(hit);
  }

  // Tapping a tool that is out opens the same card as scanning it.
  async function pickOut(t: Tool) {
    setToolQ("");
    if (!t.scan_code) return;
    const hit = await scanLookup(t.scan_code);
    if (hit.kind === "tool") present(hit);
  }

  async function resolvePending() {
    if (!pending) return;
    setPending(null);
    if ("hit" in pending) {
      const h = pending.hit;
      if (h.outTo) {
        const res = await returnFromHolder(h.outTo.lineId, worker?.name);
        if ("error" in res) return tell(res.error, true);
        log(`Returned from ${h.outTo.worker}.`);
      }
      return addHit({ ...h, outTo: null });
    }
    const res = await addScannedTool(pending.code, pending.name);
    if ("error" in res) return tell(res.error, true);
    if (res.hit.kind === "unknown") return tell("Could not add that tag.", true);
    log(`Added to inventory: ${res.hit.name}.`);
    addHit(res.hit);
  }

  const card = pending && "hit" in pending && (
    <ScanCard
      hit={pending.hit}
      confirmLabel={pending.hit.outTo ? `Return from ${pending.hit.outTo.worker}${worker ? `, give to ${worker.name}` : ""}` : worker ? `Add to ${worker.name}` : "Add"}
      onConfirm={resolvePending}
      onCancel={() => setPending(null)}
    />
  );

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
    <div className="flex flex-col gap-3 pb-28">
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
                <div className="text-xs text-zinc-500">{ids(t.serial_number, t.scan_code)}</div>
              </div>
              <button className="btn" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>
                ✕
              </button>
            </div>
            <div className="flex items-center gap-3">
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
        <div className="flex gap-2">
          <input
            ref={toolInput}
            className="input flex-1"
            placeholder={lines.length ? "Add another tool" : "Tool name, model, or scan code"}
            value={toolQ}
            onChange={(e) => setToolQ(e.target.value)}
          />
          <button type="button" className="btn" onClick={() => { setScanLog([]); setPending(null); setScanning(true); }}>
            Scan
          </button>
        </div>
        {toolHits.length > 0 && (
          <ul className="card absolute z-10 mt-1 w-full p-0">
            {toolHits.map((t) => (
              <li key={t.id}>
                <button className={`row ${t.out_to ? "text-zinc-400" : ""}`} onClick={() => (t.out_to ? pickOut(t) : addLine(t))}>
                  <span>{t.name}</span>
                  <span className="block text-xs">{t.out_to ? `out to ${t.out_to} · ` : ""}{ids(t.serial_number, t.scan_code)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {toolQ && !toolHits.length && <p className="p-2 text-sm text-zinc-500">No matching tool.</p>}
      </div>

      <input className="input" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />

      {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}

      {!scanning && card}

      {scanning && (
        <Scanner onCode={onCode} onClose={() => setScanning(false)} hold={!!pending}>
          {card}
          {pending && "code" in pending && (
            <div className="mb-2 flex flex-col gap-2 rounded bg-amber-100 p-2 text-black">
              <p>Tag {pending.code} is not in inventory.</p>
              <input className="input" placeholder="Tool name" value={pending.name} onChange={(e) => setPending({ ...pending, name: e.target.value })} />
              <button className="btn" disabled={!pending.name.trim()} onClick={resolvePending}>Add as new tool</button>
              <button className="btn" onClick={() => setPending(null)}>Skip</button>
            </div>
          )}
          <p className="text-zinc-400">{worker ? worker.name : "No worker picked yet"} · {lines.length} line{lines.length === 1 ? "" : "s"}</p>
          {scanLog.map((e, i) => <p key={i} className={e.bad ? "text-red-400" : i === 0 ? "text-green-300" : "text-zinc-300"}>{e.text}</p>)}
          {!scanLog.length && <p className="text-zinc-500">Point the camera at a Hilti tag.</p>}
        </Scanner>
      )}

      <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] border-t bg-white p-3 lg:bottom-0">
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
