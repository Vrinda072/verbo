"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AgGridReact, type CustomCellRendererProps } from "ag-grid-react";
import type { ColDef, GetRowIdParams } from "ag-grid-community";
import type { AlertRow, DeskRow } from "@/lib/desk/queries";
import { LANGUAGES } from "@/lib/bridge/readback";
import { registerGrid, verboGridTheme } from "./grid";
import { CaseDetail } from "./CaseDetail";

registerGrid();

const OPEN = new Set(["OPENED", "LINK_SENT", "VIEWED", "REPLIED"]);
const RESOLVED = new Set(["RETURNED", "REFUSED", "ESCALATED", "CLOSED"]);
const lang = (c: string) => LANGUAGES.find((l) => l.code === c);
const usd = (c: number) => `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STATE_STYLE: Record<string, string> = {
  LINK_SENT: "bg-sky-soft text-sky",
  VIEWED: "bg-sky-soft text-sky",
  REPLIED: "bg-marigold-soft text-marigold-ink",
  RETURNED: "bg-evergreen-soft text-evergreen",
  REFUSED: "bg-paper-2 text-ink-2",
  ESCALATED: "bg-terracotta-soft text-terracotta",
  CLOSED: "bg-paper-2 text-ink-3",
  OPENED: "bg-paper-2 text-ink-2",
};

function StatePill({ value }: CustomCellRendererProps<DeskRow, string>) {
  if (!value) return null;
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATE_STYLE[value] ?? ""}`}>{value.replace("_", " ").toLowerCase()}</span>;
}

function EvidenceMeter({ value }: CustomCellRendererProps<DeskRow, number>) {
  if (value == null) return null;
  const tone = value >= 80 ? "bg-evergreen" : value >= 50 ? "bg-marigold" : "bg-terracotta";
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
        <span className="rounded bg-paper-2 px-1.5 text-[11px] font-bold uppercase text-ink-3">sim</span>
      ) : (
        <span className="rounded bg-evergreen-soft px-1.5 text-[11px] font-bold uppercase text-evergreen">live</span>
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

export function DeskApp() {
  const [rows, setRows] = useState<DeskRow[] | null>(null);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [tab, setTab] = useState<"cases" | "alerts">("cases");
  const [langFilter, setLangFilter] = useState<string | null>(null);
  const [scope, setScope] = useState<"all" | "live" | "sim">("all");
  const [quick, setQuick] = useState("");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/desk", { cache: "no-store" });
      const j = await r.json();
      setRows(j.rows);
      setAlerts(j.alerts);
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
  const visible = useMemo(() => (langFilter ? scoped.filter((r) => r.recipientLanguage === langFilter) : scoped), [scoped, langFilter]);

  const kpi = useMemo(() => {
    const resolved = scoped.filter((r) => RESOLVED.has(r.state));
    const returned = scoped.filter((r) => r.everReturned);
    const ev = [...scoped.map((r) => r.evidence)].sort((a, b) => a - b);
    return {
      total: scoped.length,
      open: scoped.filter((r) => OPEN.has(r.state)).length,
      returned: returned.length,
      escalated: scoped.filter((r) => r.state === "ESCALATED").length,
      returnShare: resolved.length ? Math.round((returned.length / resolved.length) * 100) : null,
      medianEvidence: ev.length ? ev[Math.floor(ev.length / 2)] : null,
      live: (rows ?? []).filter((r) => !r.simulated).length,
      sim: (rows ?? []).filter((r) => r.simulated).length,
    };
  }, [scoped, rows]);

  const tiles = useMemo(() => {
    const by = new Map<string, { n: number; ret: number; res: number }>();
    for (const r of scoped) {
      const t = by.get(r.recipientLanguage) ?? { n: 0, ret: 0, res: 0 };
      t.n++;
      if (r.everReturned) t.ret++;
      if (RESOLVED.has(r.state)) t.res++;
      by.set(r.recipientLanguage, t);
    }
    return [...by.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 10);
  }, [scoped]);

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
          <h1 className="font-display text-4xl font-semibold tracking-tight">Case Desk</h1>
          <p className="mt-1 text-ink-2">
            {kpi.live} live sandbox case{kpi.live === 1 ? "" : "s"} ·{" "}
            <strong className="text-marigold-ink">{kpi.sim} simulated cases (synthetic data, for demonstration)</strong>
          </p>
        </div>
        <div role="group" aria-label="Which cases" className="flex rounded-full border-2 border-line bg-card p-1">
          {(["all", "live", "sim"] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={scope === s}
              onClick={() => setScope(s)}
              className={`rounded-full px-4 py-1.5 text-sm font-bold ${scope === s ? "bg-ink text-paper" : "text-ink-2"}`}
            >
              {s === "all" ? "All" : s === "live" ? "Live" : "Simulated"}
            </button>
          ))}
        </div>
      </div>

      {/* KPI tiles */}
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi label="Cases" value={kpi.total} />
        <Kpi label="Open" value={kpi.open} tone="sky" />
        <Kpi label="Returned" value={kpi.returned} tone="evergreen" hint={kpi.returnShare != null ? `${kpi.returnShare}% of resolved` : undefined} />
        <Kpi label="Escalated" value={kpi.escalated} tone="terracotta" />
        <Kpi label="Median evidence" value={kpi.medianEvidence ?? "—"} hint="out of 100" />
      </div>
      {scope !== "live" && <p className="mt-2 text-xs text-ink-3">Figures that include simulated cases describe synthetic data, not real outcomes.</p>}

      {/* Language tiles */}
      <section aria-labelledby="lang-tiles" className="mt-6">
        <div className="flex items-center justify-between">
          <h2 id="lang-tiles" className="text-sm font-bold uppercase tracking-wider text-ink-3">
            Recipient languages
          </h2>
          {langFilter && (
            <button type="button" onClick={() => setLangFilter(null)} className="text-sm font-bold text-sky underline">
              Clear filter
            </button>
          )}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {tiles.map(([code, t]) => {
            const L = lang(code);
            const active = langFilter === code;
            return (
              <button
                key={code}
                type="button"
                aria-pressed={active}
                onClick={() => setLangFilter(active ? null : code)}
                className={`rounded-v border p-3 text-left transition-colors ${active ? "border-evergreen bg-evergreen-soft" : "border-line bg-card hover:bg-paper-2"}`}
              >
                <span lang={code} dir={L?.dir} className="block text-lg font-bold">
                  {L?.nativeName ?? code}
                </span>
                <span className="block text-xs text-ink-3">{L?.englishName}</span>
                <span className="mt-1 block text-sm">
                  <strong className="tabular-nums">{t.n}</strong> cases
                  {t.res ? <span className="text-ink-3"> · {Math.round((t.ret / t.res) * 100)}% returned</span> : null}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Tabs */}
      <div role="tablist" aria-label="Desk views" className="mt-8 flex gap-2 border-b border-line">
        {(
          [
            ["cases", `Recovery cases (${visible.length})`],
            ["alerts", `Pre-send alerts (${alerts.length})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`-mb-px border-b-4 px-4 py-2 font-bold ${tab === id ? "border-evergreen text-ink" : "border-transparent text-ink-3"}`}
          >
            {label}
          </button>
        ))}
        <label className="ml-auto self-center">
          <span className="sr-only">Search cases</span>
          <input
            value={quick}
            onChange={(e) => setQuick(e.target.value)}
            placeholder="Search names, ids…"
            className="mb-1 w-44 rounded-full border-2 border-line bg-card px-4 py-1.5 text-sm outline-none focus:border-sky sm:w-64"
          />
        </label>
      </div>

      {error && <p role="alert" className="mt-4 text-terracotta">{error}</p>}

      <div className="mt-4 h-[640px]">
        {tab === "cases" ? (
          <AgGridReact<DeskRow>
            theme={verboGridTheme}
            rowData={rows ? visible : undefined}
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
  const s = value === "high" ? "bg-terracotta-soft text-terracotta" : value === "medium" ? "bg-marigold-soft text-marigold-ink" : "bg-evergreen-soft text-evergreen";
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${s}`}>{value}</span>;
}

function Kpi({ label, value, hint, tone }: { label: string; value: number | string; hint?: string; tone?: "sky" | "evergreen" | "terracotta" }) {
  const c = tone === "sky" ? "text-sky" : tone === "evergreen" ? "text-evergreen" : tone === "terracotta" ? "text-terracotta" : "text-ink";
  return (
    <div className="rounded-v-lg border border-line bg-card p-4 shadow-v">
      <p className="text-xs font-bold uppercase tracking-wider text-ink-3">{label}</p>
      <p className={`mt-1 font-display text-4xl font-semibold tabular-nums ${c}`}>{value}</p>
      {hint && <p className="text-xs text-ink-3">{hint}</p>}
    </div>
  );
}
