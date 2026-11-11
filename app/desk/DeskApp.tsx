"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AgGridReact, type CustomCellRendererProps } from "ag-grid-react";
import type { ColDef, GetRowIdParams } from "ag-grid-community";
import type { AlertRow, DeskRow } from "@/lib/desk/queries";
import { LANGUAGES } from "@/lib/bridge/readback";
import { registerGrid, verboGridTheme } from "./grid";
import { CaseDetail } from "./CaseDetail";

registerGrid();

// Studio needs the browser, so it isn't server-rendered.
const DeadlineTimeline = dynamic(() => import("./timeline/DeadlineTimeline"), {
  ssr: false,
  loading: () => <p className="text-ink-3">Loading timeline…</p>,
});
const StudioDashboard = dynamic(() => import("./studio/StudioDashboard"), {
  ssr: false,
  loading: () => <p className="py-20 text-center text-ink-3">Loading dashboard…</p>,
});

const lang = (c: string) => LANGUAGES.find((l) => l.code === c);
const usd = (c: number) => `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STATE_STYLE: Record<string, string> = {
  LINK_SENT: "bg-sky-soft text-sky",
  VIEWED: "bg-sky-soft text-sky",
  REPLIED: "bg-marigold-soft text-marigold-ink",
  RETURNED: "bg-brand-soft text-brand",
  REFUSED: "bg-paper-2 text-ink-2",
  ESCALATED: "bg-terracotta-soft text-terracotta",
  CLOSED: "bg-paper-2 text-ink-3",
  OPENED: "bg-paper-2 text-ink-2",
};

function StatePill({ value }: CustomCellRendererProps<DeskRow, string>) {
  if (!value) return null;
  return <span className={`rounded-v px-2.5 py-0.5 text-xs font-semibold ${STATE_STYLE[value] ?? ""}`}>{value.replace("_", " ").toLowerCase()}</span>;
}

function EvidenceMeter({ value }: CustomCellRendererProps<DeskRow, number>) {
  if (value == null) return null;
  const tone = value >= 80 ? "bg-brand" : value >= 50 ? "bg-marigold" : "bg-terracotta";
  return (
    <span className="flex h-full items-center gap-2" aria-label={`Evidence ${value} of 100`}>
      <span className="h-2 w-20 overflow-hidden rounded-full bg-line">
        <span className={`block h-full ${tone}`} style={{ width: `${value}%` }} />
      </span>
      <span className="tabular-nums text-ink-2">{value}</span>
    </span>
  );
}

function CaseCell({ data }: CustomCellRendererProps<DeskRow>) {
  if (!data) return null;
  return (
    <span className="flex items-center gap-2">
      <span className="font-mono">{data.shortId}</span>
      {data.simulated ? (
        <span className="rounded bg-paper-2 px-1.5 text-[11px] font-semibold uppercase text-ink-3">sim</span>
      ) : (
        <span className="rounded bg-brand-soft px-1.5 text-[11px] font-semibold uppercase text-brand">live</span>
      )}
    </span>
  );
}

function LangPair({ data }: CustomCellRendererProps<DeskRow>) {
  if (!data) return null;
  return (
    <span>
      <span lang={data.senderLanguage}>{lang(data.senderLanguage)?.nativeName ?? data.senderLanguage}</span>
      <span className="text-ink-3"> → </span>
      <span lang={data.recipientLanguage}>{lang(data.recipientLanguage)?.nativeName ?? data.recipientLanguage}</span>
    </span>
  );
}

/** One line per tab saying what it is for, so the views read as steps rather than separate tools. */
const TAB_HELP = {
  dashboard: "Totals, outcomes and evidence across all cases. Ask the analyst a question in plain words.",
  cases: "Every recovery case after money went to the wrong person. Open a row for its timeline, messages and evidence packet.",
  timeline: "Open cases by deadline. Drag the end of a bar to change when a case escalates.",
  alerts: "Payments that were checked before sending: similar names, pressure, first payments and unusual amounts.",
} as const;

export function DeskApp() {
  const [rows, setRows] = useState<DeskRow[] | null>(null);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [tab, setTab] = useState<"dashboard" | "timeline" | "cases" | "alerts">("dashboard");
  const [scope, setScope] = useState<"all" | "live" | "sim">("all");
  const [quick, setQuick] = useState("");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/desk", { cache: "no-store" });
      const j = await r.json();
      // Keep the same arrays when nothing changed, so the dashboard and grids don't redraw on every poll.
      setRows((old) => (JSON.stringify(old) === JSON.stringify(j.rows) ? old : j.rows));
      setAlerts((old) => (JSON.stringify(old) === JSON.stringify(j.alerts) ? old : j.alerts));
    } catch {
      setError("Couldn’t load cases.");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(refresh, 15000);
    return () => clearInterval(id);
  }, [refresh]);

  const scoped = useMemo(
    () => (rows ?? []).filter((r) => (scope === "all" ? true : scope === "live" ? !r.simulated : r.simulated)),
    [rows, scope],
  );

  const live = (rows ?? []).filter((r) => !r.simulated).length;
  const sim = (rows ?? []).length - live;

  const columns = useMemo<ColDef<DeskRow>[]>(
    () => [
      { headerName: "Case", field: "shortId", cellRenderer: "agGroupCellRenderer", cellRendererParams: { innerRenderer: CaseCell }, minWidth: 170, pinned: "left" },
      { headerName: "State", field: "state", cellRenderer: StatePill, filter: "agSetColumnFilter", enableRowGroup: true, minWidth: 120 },
      { headerName: "Amount", field: "cents", valueFormatter: (p) => (p.value != null ? usd(p.value) : ""), type: "rightAligned", filter: "agNumberColumnFilter", minWidth: 110 },
      { headerName: "Languages", colId: "langs", cellRenderer: LangPair, valueGetter: (p) => `${p.data?.senderLanguage ?? ""}→${p.data?.recipientLanguage ?? ""}`, minWidth: 180 },
      { headerName: "Recipient", field: "recipientName", minWidth: 150 },
      { headerName: "Recipient language", field: "recipientLanguage", valueFormatter: (p) => lang(p.value)?.englishName ?? p.value, filter: "agSetColumnFilter", enableRowGroup: true, hide: true },
      { headerName: "Sender", field: "senderName", minWidth: 150 },
      { headerName: "Pre-send risk", field: "riskLevel", filter: "agSetColumnFilter", enableRowGroup: true, minWidth: 120 },
      { headerName: "Age", field: "ageHours", valueFormatter: (p) => (p.value == null ? "" : p.value < 48 ? `${p.value} h` : `${Math.round(p.value / 24)} d`), filter: "agNumberColumnFilter", minWidth: 90 },
      { headerName: "Reminders", field: "remindersSent", minWidth: 110 },
      { headerName: "Evidence", field: "evidence", cellRenderer: EvidenceMeter, filter: "agNumberColumnFilter", minWidth: 150, sort: "asc" },
    ],
    [],
  );

  const alertCols = useMemo<ColDef<AlertRow>[]>(
    () => [
      { headerName: "When", field: "createdAt", valueFormatter: (p) => new Date(p.value).toLocaleString([], { dateStyle: "short", timeStyle: "short" }), minWidth: 150 },
      { headerName: "Risk", field: "level", cellRenderer: (p: CustomCellRendererProps<AlertRow, string>) => <StatePillRisk value={p.value ?? undefined} />, filter: "agSetColumnFilter", minWidth: 100 },
      { headerName: "Said in", field: "language", valueFormatter: (p) => lang(p.value)?.englishName ?? p.value, minWidth: 110 },
      { headerName: "To", field: "recipientName", minWidth: 150 },
      { headerName: "Amount", field: "cents", valueFormatter: (p) => (p.value != null ? usd(p.value) : ""), type: "rightAligned", minWidth: 100 },
      { headerName: "Signals", field: "signals", valueFormatter: (p) => (p.value as string[] | undefined)?.map((s) => s.replace(/_/g, " ")).join(", ") ?? "", flex: 2, minWidth: 260 },
      { headerName: "Outcome", field: "transferState", valueFormatter: (p) => p.value ?? "not confirmed", minWidth: 140 },
    ],
    [],
  );

  const getRowId = useCallback((p: GetRowIdParams<DeskRow>) => p.data.id, []);
  const detailRenderer = useCallback((p: Parameters<typeof CaseDetail>[0]) => <CaseDetail {...p} />, []);

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-3">Operator view</p>
          <h1 className="text-3xl font-semibold tracking-tight">Case Desk</h1>
          <p className="mt-1 text-ink-2">
            {live} live sandbox case{live === 1 ? "" : "s"} ·{" "}
            <strong className="text-marigold-ink">{sim} simulated cases (synthetic data, for demonstration)</strong>
          </p>
        </div>
        <div role="group" aria-label="Which cases" className="flex rounded-full border-2 border-line bg-card p-1">
          {(["all", "live", "sim"] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={scope === s}
              onClick={() => setScope(s)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold ${scope === s ? "bg-ink text-paper" : "text-ink-2"}`}
            >
              {s === "all" ? "All" : s === "live" ? "Live" : "Simulated"}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label="Desk views" className="mt-8 flex flex-wrap items-end gap-x-2 border-b border-line">
        {(
          [
            ["dashboard", "Overview"],
            ["cases", `Cases (${scoped.length})`],
            ["timeline", "Deadlines"],
            ["alerts", `Pre-send alerts (${alerts.length})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`-mb-px whitespace-nowrap border-b-4 px-3 py-2 font-semibold sm:px-4 ${tab === id ? "border-brand text-ink" : "border-transparent text-ink-3"}`}
          >
            {label}
          </button>
        ))}
        <label className={`ml-auto self-center ${tab === "dashboard" || tab === "timeline" ? "invisible" : ""}`}>
          <span className="sr-only">Search cases</span>
          <input
            value={quick}
            onChange={(e) => setQuick(e.target.value)}
            placeholder="Search names, ids…"
            className="mb-1 w-44 rounded-v border-2 border-line bg-card px-4 py-1.5 text-sm outline-none focus:border-sky sm:w-64"
          />
        </label>
      </div>

      <p className="mt-3 text-sm text-ink-2">{TAB_HELP[tab]}</p>

      {error && <p role="alert" className="mt-4 text-terracotta">{error}</p>}

      {tab === "dashboard" && <div className="mt-4">{rows ? <StudioDashboard key={scope} rows={scoped} /> : <p className="py-20 text-center text-ink-3">Loading cases…</p>}</div>}

      {tab === "timeline" && <div className="mt-4 h-[640px]">{rows ? <DeadlineTimeline key={scope} rows={scoped} /> : null}</div>}

      <div className={`mt-4 h-[640px] ${tab === "dashboard" || tab === "timeline" ? "hidden" : ""}`}>
        {tab === "dashboard" || tab === "timeline" ? null : tab === "cases" ? (
          <AgGridReact<DeskRow>
            theme={verboGridTheme}
            rowData={rows ? scoped : undefined}
            loading={!rows}
            columnDefs={columns}
            defaultColDef={{ flex: 1, sortable: true, resizable: true, filter: true }}
            getRowId={getRowId}
            masterDetail
            detailCellRenderer={detailRenderer}
            detailRowAutoHeight
            rowGroupPanelShow="always"
            quickFilterText={quick}
            animateRows
            enableCellTextSelection
            context={{ refresh }}
            overlayNoRowsTemplate="No cases match."
          />
        ) : (
          <AgGridReact<AlertRow>
            theme={verboGridTheme}
            rowData={alerts}
            columnDefs={alertCols}
            defaultColDef={{ flex: 1, sortable: true, resizable: true, filter: true }}
            quickFilterText={quick}
            overlayNoRowsTemplate="No pre-send checks yet. Try a payment on the Send page."
          />
        )}
      </div>
      {tab === "alerts" && <p className="mt-2 text-xs text-ink-3">Live checks from the Send page only — no simulated data in this view.</p>}
    </div>
  );
}

function StatePillRisk({ value }: { value?: string }) {
  if (!value) return null;
  const s = value === "high" ? "bg-terracotta-soft text-terracotta" : value === "medium" ? "bg-marigold-soft text-marigold-ink" : "bg-brand-soft text-brand";
  return <span className={`rounded-v px-2.5 py-0.5 text-xs font-semibold ${s}`}>{value}</span>;
}
