"use client";
import { useEffect, useState } from "react";
import type { CustomDetailCellRendererProps } from "ag-grid-react";
import type { DeskRow } from "@/lib/desk/queries";
import { LANGUAGES } from "@/lib/bridge/readback";

interface Detail {
  packet: {
    simulated: boolean;
    caseTimeline: { at: string; event: string; actor: string }[];
    conversation: { at: string; author: string; text: string; lang: string; translation: { text: string; lang: string } | null }[];
    instruction: { transcript: string; language: string; understoodBy: string } | null;
    payment: { paypal: { orderId?: string; captureId?: string }; risk: { level?: string; signals?: { code: string }[] } | null } | null;
    evidence: { score: number; facts: Record<string, boolean> };
  };
  sha256: string;
  items: { key: string; label: string; points: number }[];
}

const langName = (c: string) => LANGUAGES.find((l) => l.code === c)?.englishName ?? c;

const ACTIONS: { action: "remind" | "escalate" | "close"; label: string; allowed: string[] }[] = [
  { action: "remind", label: "Send reminder", allowed: ["LINK_SENT", "VIEWED", "REPLIED"] },
  { action: "escalate", label: "Escalate", allowed: ["LINK_SENT", "VIEWED", "REPLIED"] },
  { action: "close", label: "Close case", allowed: ["RETURNED", "REFUSED", "ESCALATED"] },
];

/** Expanded row: translated timeline, conversation, evidence checklist, quick actions and downloads. */
export function CaseDetail(props: CustomDetailCellRendererProps<DeskRow> & { onChanged?: () => void }) {
  const row = props.data!;
  const [d, setD] = useState<Detail | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/desk/cases/${row.id}`)
      .then((r) => r.json())
      .then((j) => alive && setD(j));
    return () => {
      alive = false;
    };
  }, [row.id, row.state]);

  async function act(action: string) {
    setBusy(action);
    setNote(null);
    const r = await fetch(`/api/desk/cases/${row.id}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    const j = await r.json();
    setNote(r.ok ? `Done — case is now ${j.state}.` : `Not allowed (${j.error}).`);
    setBusy(null);
    (props.context as { refresh?: () => void } | undefined)?.refresh?.();
  }

  if (!d) return <div className="p-6 text-ink-3">Loading case…</div>;
  const p = d.packet;

  return (
    <div className="grid gap-6 bg-paper-2 p-5 text-[15px] lg:grid-cols-[1.2fr_1fr_0.9fr]">
      <section aria-label="Timeline">
        <h4 className="text-xs font-bold uppercase tracking-wider text-ink-3">Timeline</h4>
        <ol className="mt-2 space-y-1.5 border-l-2 border-line pl-3">
          {p.caseTimeline.map((e, i) => (
            <li key={i}>
              <span className="font-bold">{e.event.replace(/_/g, " ").toLowerCase()}</span>
              <span className="text-ink-3"> · {e.actor} · {new Date(e.at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span>
            </li>
          ))}
        </ol>
        {p.instruction && (
          <p className="mt-3 rounded-v bg-card p-3">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-3">Said ({langName(p.instruction.language)})</span>
            <span lang={p.instruction.language} className="mt-1 block">“{p.instruction.transcript}”</span>
          </p>
        )}
      </section>

      <section aria-label="Conversation">
        <h4 className="text-xs font-bold uppercase tracking-wider text-ink-3">
          Conversation · {langName(row.senderLanguage)} ↔ {langName(row.recipientLanguage)}
        </h4>
        {p.conversation.length ? (
          <ol className="mt-2 space-y-2">
            {p.conversation.map((m, i) => (
              <li key={i} className="rounded-v bg-card p-3">
                <p className="text-xs font-bold text-ink-3">{m.author}</p>
                <p lang={m.lang}>{m.text}</p>
                {m.translation ? (
                  <p lang={m.translation.lang} className="mt-1 border-t border-line pt-1 text-ink-2">
                    → {m.translation.text}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-ink-3">not translated</p>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-ink-3">{p.simulated ? "Simulated cases carry no messages." : "No messages yet."}</p>
        )}
      </section>

      <section aria-label="Evidence and actions">
        <h4 className="text-xs font-bold uppercase tracking-wider text-ink-3">Evidence {p.evidence.score}/100</h4>
        <ul className="mt-2 space-y-1">
          {d.items.map((i) => (
            <li key={i.key} className={p.evidence.facts[i.key] ? "" : "text-ink-3"}>
              <span aria-hidden>{p.evidence.facts[i.key] ? "✓" : "○"}</span> {i.label}
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          <a className="rounded-v bg-ink px-4 py-2 text-sm font-bold text-paper" href={`/api/desk/cases/${row.id}/evidence?format=pdf`}>
            Evidence PDF
          </a>
          <a className="rounded-v border-2 border-line-strong px-4 py-2 text-sm font-bold" href={`/api/desk/cases/${row.id}/evidence?format=json`}>
            JSON
          </a>
        </div>
        <p className="mt-1 break-all font-mono text-[11px] text-ink-3" title="SHA-256 of the JSON packet">
          sha256 {d.sha256.slice(0, 16)}…
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {ACTIONS.filter((a) => a.allowed.includes(row.state)).map((a) => (
            <button
              key={a.action}
              type="button"
              disabled={busy !== null}
              onClick={() => act(a.action)}
              className={`rounded-v px-4 py-2 text-sm font-bold disabled:opacity-50 ${
                a.action === "escalate" ? "bg-terracotta-soft text-terracotta" : "bg-evergreen-soft text-evergreen"
              }`}
            >
              {busy === a.action ? "…" : a.label}
            </button>
          ))}
        </div>
        {note && <p className="mt-2 text-sm">{note}</p>}
      </section>
    </div>
  );
}
