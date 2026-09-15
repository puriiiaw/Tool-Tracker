import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { allToolStock } from "@/lib/inventory";
import { CheckoutForm } from "./checkout-form";

export default async function CheckoutPage() {
  await requireUser();
  const workers = db
    .prepare("SELECT id, name FROM worker WHERE active = 1 ORDER BY name")
    .all() as { id: number; name: string }[];
  const tools = allToolStock()
    .filter((t) => t.status === "active")
    .map((t) => ({
      id: t.id,
      name: t.name,
      model: t.model,
      scan_code: t.scan_code,
      serial_number: t.serial_number,
      out_to: t.out_to,
    }));
  return <CheckoutForm workers={workers} tools={tools} />;
}
