import { NextResponse } from "next/server";
import { listAlerts, listDeskRows } from "@/lib/desk/queries";
import { seedDesk } from "@/lib/desk/seed";

export const dynamic = "force-dynamic";

/** GET /api/desk — all cases (live + simulated) and live pre-send alerts. Seeds simulated cases on first use. */
export async function GET() {
  await seedDesk();
  const [rows, alerts] = await Promise.all([listDeskRows(), listAlerts()]);
  return NextResponse.json({ rows, alerts, at: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
