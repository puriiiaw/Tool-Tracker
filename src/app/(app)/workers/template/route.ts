import { getUser } from "@/lib/auth";
import { workerTemplate } from "@/lib/workers";

// The one-column .xlsx for a foreman to fill in and hand to the super-admin.
export async function GET() {
  if (!(await getUser())) return new Response("Sign in first.", { status: 401 });
  return new Response(new Uint8Array(workerTemplate()), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="workers-template.xlsx"',
    },
  });
}
