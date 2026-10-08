"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Full-screen rear camera in continuous mode: every new Data Matrix / QR read calls onCode once,
// with a beep and a green flash. The parent renders its own status panel as children.
// While `hold` is true (a confirm card is open) reads are ignored.
export function Scanner({ onCode, onClose, hold = false, children }: { onCode: (code: string) => void; onClose: () => void; hold?: boolean; children?: ReactNode }) {
  const video = useRef<HTMLVideoElement>(null);
  const holdRef = useRef(hold);
  holdRef.current = hold;
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode; // the camera effect runs once; always call the latest handler
  const [flash, setFlash] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer = 0;
    let stopped = false;
    const seen = new Map<string, number>();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    let audio: AudioContext | null = null;
    const beep = () => {
      audio ??= new AudioContext();
      const o = audio.createOscillator();
      o.frequency.value = 1200;
      o.connect(audio.destination);
      o.start();
      o.stop(audio.currentTime + 0.08);
    };

    (async () => {
      const { readBarcodes, setZXingModuleOverrides } = await import("zxing-wasm/reader");
      // Served from /public (copy of node_modules/zxing-wasm/dist/reader/zxing_reader.wasm; refresh it when zxing-wasm is upgraded) so scanning works offline.
      setZXingModuleOverrides({ locateFile: (path, prefix) => (path.endsWith(".wasm") ? "/zxing_reader.wasm" : prefix + path) });
      if (!navigator.mediaDevices?.getUserMedia) return setError("The camera only works over HTTPS on this phone.");
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
      } catch {
        setError("Camera access was refused. Allow the camera for this site and try again.");
        return;
      }
      if (stopped) return stream.getTracks().forEach((t) => t.stop());
      video.current!.srcObject = stream;
      await video.current!.play();
      let busy = false;
      timer = window.setInterval(async () => {
        const v = video.current;
        if (busy || !v || v.readyState < 2) return;
        busy = true;
        const scale = Math.min(1, 800 / v.videoWidth);
        canvas.width = v.videoWidth * scale;
        canvas.height = v.videoHeight * scale;
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const hits = await readBarcodes(img, { formats: ["DataMatrix", "QRCode", "Code128"], maxNumberOfSymbols: 1 }).catch(() => []);
        const now = Date.now();
        for (const h of hits) {
          if (!h.text) continue;
          const last = seen.get(h.text) ?? 0;
          seen.set(h.text, now); // every read refreshes it: a tag held in frame counts once, until it leaves for 1.5 s
          if (holdRef.current || now - last < 1500) continue;
          beep();
          setFlash(true);
          setTimeout(() => setFlash(false), 200);
          onCodeRef.current(h.text);
        }
        busy = false;
      }, 150);
    })();

    return () => {
      stopped = true;
      clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
      audio?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- camera opens once per mount
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <div className={`relative flex-1 overflow-hidden ${flash ? "ring-8 ring-inset ring-green-400" : ""}`}>
        <video ref={video} playsInline muted autoPlay className="size-full object-cover" />
        {error && <p className="absolute inset-x-4 top-1/2 rounded bg-red-700 p-3 text-center text-sm">{error}</p>}
      </div>
      <div className="max-h-[45vh] overflow-y-auto bg-zinc-900 p-3 text-sm">{children}</div>
      <button className="m-3 min-h-12 rounded-lg bg-white font-semibold text-black" onClick={onClose}>
        Done
      </button>
    </div>
  );
}
