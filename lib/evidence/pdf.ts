/**
 * One-to-two page PDF summary of an evidence packet, with the JSON's SHA-256 on every page.
 * pdf-lib 1.17 standard fonts only encode WinAnsi (Latin); text in other scripts is shown as a pointer to the
 * JSON (which holds the exact original) rather than dropped silently.
 * Source: pdf-lib 1.17.1 PDFDocument.create / embedFont(StandardFonts.Helvetica) / page.drawText / setCreationDate.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { EvidencePacket } from "./packet";
import { EVIDENCE_ITEMS } from "./meter";

const INK = rgb(0.114, 0.102, 0.086);
const MUTED = rgb(0.435, 0.4, 0.353);
const GREEN = rgb(0.118, 0.353, 0.294);

/** Keep Latin-1 text; replace anything the standard font can't encode. */
export function pdfSafe(s: string): string {
  return /^[ -~ -ÿ\n]*$/.test(s) ? s : "[text in non-Latin script — exact original in the JSON packet]";
}

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export async function renderPdf(p: EvidencePacket): Promise<Uint8Array> {
  const { packet, sha256 } = p;
  const doc = await PDFDocument.create();
  const generated = new Date(packet.generatedAt as unknown as string);
  doc.setTitle(`Verbo evidence ${packet.case.id}`);
  doc.setProducer("Verbo");
  doc.setCreator("Verbo");
  doc.setCreationDate(generated);
  doc.setModificationDate(generated);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = doc.addPage([595, 842]);
  let y = 790;
  const footer = (pg: PDFPage) =>
    pg.drawText(`SHA-256 of JSON packet: ${sha256}`, { x: 40, y: 28, size: 7.5, font, color: MUTED });
  const line = (text: string, o: { f?: PDFFont; size?: number; color?: typeof INK; gap?: number } = {}) => {
    const size = o.size ?? 10;
    if (y < 60) {
      footer(page);
      page = doc.addPage([595, 842]);
      y = 790;
    }
    page.drawText(pdfSafe(text).slice(0, 110), { x: 40, y, size, font: o.f ?? font, color: o.color ?? INK });
    y -= o.gap ?? size + 6;
  };

  line("Verbo — evidence packet", { f: bold, size: 18, gap: 26 });
  line(`${packet.simulated ? "SIMULATED DEMO DATA · " : ""}PayPal sandbox · ${packet.format} · generated ${generated.toISOString()}`, {
    size: 8,
    color: MUTED,
    gap: 20,
  });

  line("Case", { f: bold, size: 12 });
  line(`ID ${packet.case.id} · state ${packet.case.state} · opened ${new Date(packet.case.openedAt as unknown as string).toISOString()}`);
  line(`Amount ${usd(packet.case.amount.cents)} ${packet.case.amount.currency} · reminders sent ${packet.case.remindersSent}`);
  line(`Sender: ${packet.case.sender.name} (${packet.case.sender.language})`);
  line(`Recipient: ${packet.case.recipient.name} (${packet.case.recipient.language})`, { gap: 20 });

  if (packet.payment) {
    line("Payment", { f: bold, size: 12 });
    const pp = packet.payment.paypal;
    line(`Order ${pp.orderId ?? "—"} · Authorization ${pp.authorizationId ?? "—"}`);
    line(`Capture ${pp.captureId ?? "—"} · Payout batch ${pp.payoutBatchId ?? "—"}`);
    line(`Sender ${packet.payment.senderEmail} → recipient ${packet.payment.recipientEmail}`);
    const risk = packet.payment.risk as { level?: string; signals?: { code: string }[] } | null;
    line(`Pre-send risk: ${risk?.level ?? "not recorded"}${risk?.signals?.length ? ` (${risk.signals.map((s) => s.code).join(", ")})` : ""}`, { gap: 20 });
  }

  if (packet.instruction) {
    line("Instruction", { f: bold, size: 12 });
    line(`Said (${packet.instruction.language}): ${packet.instruction.transcript}`);
    const rb = packet.instruction.readBack;
    line(`Read back from a fixed ${rb.templateLanguage} template (${rb.machineTranslated ? "machine-translated" : "authored"}${rb.reviewed ? ", reviewed" : ", not native-reviewed"}); understood by ${packet.instruction.understoodBy}`, { gap: 20 });
  }

  line("Case timeline", { f: bold, size: 12 });
  for (const e of packet.caseTimeline) line(`${new Date(e.at as unknown as string).toISOString()}  ${e.event}  (${e.actor})`, { size: 9 });
  y -= 8;

  if (packet.conversation.length) {
    line("Conversation", { f: bold, size: 12 });
    for (const m of packet.conversation) {
      line(`${m.author} (${m.lang}): ${m.text}`, { size: 9 });
      if (m.translation) line(`   → ${m.translation.lang}: ${m.translation.text}`, { size: 9, color: MUTED });
    }
    y -= 8;
  }

  if (packet.returnPayment) {
    line("Return payment", { f: bold, size: 12 });
    line(`State ${packet.returnPayment.state} · Order ${packet.returnPayment.paypal.orderId ?? "—"} · Capture ${packet.returnPayment.paypal.captureId ?? "—"}`, { gap: 20 });
  }

  line(`Evidence completeness: ${packet.evidence.score}/100`, { f: bold, size: 12, color: GREEN });
  for (const i of EVIDENCE_ITEMS) line(`${packet.evidence.facts[i.key] ? "[x]" : "[ ]"} ${i.label} (${i.points})`, { size: 9 });
  y -= 8;
  line(packet.disclaimer, { size: 8, color: MUTED });
  footer(page);
  return doc.save();
}
