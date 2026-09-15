import fs from "node:fs";
import path from "node:path";
import { db } from "@/db";

export type ToolStock = {
  id: number;
  name: string;
  model: string | null;
  scan_code: string | null;
  serial_number: string | null;
  manufacturer: string | null;
  status: "active" | "damaged" | "lost" | "retired";
  import_flag: string | null;
  notes: string | null;
  category: string | null;
  created_at: string;
  added_by: string | null; // set when added on site rather than imported
  out_qty: number;
  damaged_qty: number;
  lost_qty: number;
  on_hand: number;
  out_to: string | null; // worker currently holding it
};

// on_hand = 1 - out - damaged - lost, computed from checkout lines and return events.
const STOCK_SQL = fs.readFileSync(path.join(process.cwd(), "src", "db", "stock.sql"), "utf8");

export function allToolStock(): ToolStock[] {
  return db.prepare(`${STOCK_SQL} ORDER BY t.name`).all() as ToolStock[];
}

export function toolStock(id: number): ToolStock | undefined {
  return db.prepare(`${STOCK_SQL} WHERE t.id = ?`).get(id) as ToolStock | undefined;
}
