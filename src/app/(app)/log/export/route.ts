import { getUser } from "@/lib/auth";
import { filtersFromParams, listCheckouts } from "@/lib/checkouts";
import { fmtTime } from "@/lib/format";

const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

// CSV of the log with the same filters as the page. One row per checkout line.
export async function GET(req: Request) {
  if (!(await getUser())) return new Response("Sign in first.", { status: 401 });
  const p = Object.fromEntries(new URL(req.url).searchParams);
  const rows = listCheckouts(filtersFromParams(p), 10000);
  const head = ["checkout", "worker", "tool", "qty_out", "returned", "damaged", "lost", "still_out", "status", "long_term", "time_out", "admin", "note"];
  const lines = rows.flatMap((c) =>
    c.lines.map((l) =>
      [c.id, c.worker_name, l.tool_name, l.qty_out, l.returned, l.damaged, l.lost,
        l.qty_out - l.returned - l.damaged - l.lost, c.status, l.long_term ? "yes" : "",
        fmtTime(c.created_at), c.admin_name, c.note].map(cell).join(",")
    )
  );
  return new Response("﻿" + [head.join(","), ...lines].join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tool-log-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
