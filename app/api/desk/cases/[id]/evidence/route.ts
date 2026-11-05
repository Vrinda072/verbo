import { buildPacket } from "@/lib/evidence/packet";
import { renderPdf } from "@/lib/evidence/pdf";

export const dynamic = "force-dynamic";

/** GET /api/desk/cases/:id/evidence?format=json|pdf — downloadable evidence packet. Hash header lets anyone verify. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const format = new URL(req.url).searchParams.get("format") === "pdf" ? "pdf" : "json";
  const p = await buildPacket(id);
  if (!p) return new Response("not found", { status: 404 });
  const name = `verbo-evidence-${id}`;
  const headers = { "X-Evidence-SHA256": p.sha256, "Cache-Control": "no-store" };
  if (format === "pdf") {
    const bytes = await renderPdf(p);
    return new Response(Buffer.from(bytes), {
      headers: { ...headers, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}.pdf"` },
    });
  }
  return new Response(p.json, {
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="${name}.json"` },
  });
}
