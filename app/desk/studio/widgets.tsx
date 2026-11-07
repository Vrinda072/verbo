"use client";
/**
 * Verbo's own AG Studio widgets. Source: AG Studio 3.1.0 custom widgets docs and AgWidgetDefinition type (read Nov 7, 2026):
 * id, label, dataMapping, comp, defaultSize; a widget loads data with widgetApi.getData({ fields }).
 */
import { useEffect, useState } from "react";
import { AgNoDataOverlay } from "ag-studio-react";

type Row = Record<string, unknown>;

/* eslint-disable @typescript-eslint/no-explicit-any -- Studio's widget params are generic over a registry we don't need here. */

/** Loads the widget's rows, refreshing when Studio changes its mapping or filters. */
function useRows(params: any): Row[] | null {
  const { widgetApi, dataMapping } = params;
  const [rows, setRows] = useState<Row[] | null>(null);
  const key = JSON.stringify(dataMapping);
  useEffect(() => {
    let live = true;
    const fields = Object.values(dataMapping ?? {}).flat();
    void (async () => {
      const res = await widgetApi.getData({ fields }, { queryId: "rows", onDataUpdated: (r: any) => live && setRows(r.results.rows) });
      if (live && !res.replaced) setRows(res.results.rows);
    })();
    return () => {
      live = false;
    };
    // widgetApi is stable for a widget's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return rows;
}

/** Studio keys result rows by the mapped field; find a column by its field name. */
function read(row: Row, id: string): unknown {
  const keys = Object.keys(row);
  const hit = keys.find((k) => k === id || k === `cases.${id}`) ?? keys.find((k) => k.startsWith(`cases.${id}`) || k.startsWith(`${id}_`));
  return hit ? row[hit] : undefined;
}

function LanguageRecovery(params: any) {
  const rows = useRows(params);
  if (rows && !rows.length) return <AgNoDataOverlay />;
  const items = (rows ?? [])
    .map((r) => {
      const [code, native] = String(read(r, "languageTag") ?? "|").split("|");
      return { code, native, cases: Number(read(r, "cases") ?? 0), resolved: Number(read(r, "resolved") ?? 0), returned: Number(read(r, "returned") ?? 0) };
    })
    .sort((a, b) => b.cases - a.cases);
  return (
    <ul className="grid h-full content-start gap-2 overflow-auto p-1 text-sm">
      {items.map((l) => {
        const share = l.resolved ? Math.round((l.returned / l.resolved) * 100) : null;
        return (
          <li key={l.code} className="grid grid-cols-[minmax(5rem,7rem)_1fr_auto] items-center gap-2">
            <span lang={l.code} className="truncate font-semibold">
              {l.native}
            </span>
            <span aria-hidden className="h-2 overflow-hidden rounded-full bg-line">
              <span className="block h-full rounded-full bg-evergreen" style={{ width: `${share ?? 0}%` }} />
            </span>
            <span className="whitespace-nowrap tabular-nums text-ink-3">
              {share == null ? "none resolved" : `${share}% returned`} · {l.cases}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

const BAND_ORDER = ["Ready", "Partial", "Weak"];
const BAND_STYLE: Record<string, string> = { Ready: "bg-evergreen", Partial: "bg-marigold", Weak: "bg-terracotta" };

function EvidenceReadiness(params: any) {
  const rows = useRows(params);
  if (rows && !rows.length) return <AgNoDataOverlay />;
  const bands = (rows ?? []).map((r) => ({ label: String(read(r, "evidenceBand") ?? ""), cases: Number(read(r, "cases") ?? 0) }));
  const total = bands.reduce((n, b) => n + b.cases, 0) || 1;
  const sorted = BAND_ORDER.map((name) => bands.find((b) => b.label.startsWith(name))).filter((b): b is { label: string; cases: number } => Boolean(b));
  return (
    <div className="flex h-full flex-col justify-center gap-3 p-1 text-sm">
      <div aria-hidden className="flex h-3 overflow-hidden rounded-full bg-line">
        {sorted.map((b) => (
          <span key={b.label} className={BAND_STYLE[b.label.split(" ")[0]]} style={{ width: `${(b.cases / total) * 100}%` }} />
        ))}
      </div>
      <ul className="grid gap-1">
        {sorted.map((b) => (
          <li key={b.label} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <span aria-hidden className={`h-2 w-2 rounded-full ${BAND_STYLE[b.label.split(" ")[0]]}`} />
              {b.label}
            </span>
            <span className="tabular-nums text-ink-3">{b.cases}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const measure = (description: string) => ({
  type: "field",
  supportedRoles: ["numeric"],
  requires: { cardinality: "one" },
  required: true,
  aiDescription: description,
});

const form =
  (items: { key: string; label: string }[]) =>
  (params: any) =>
    params.createDefaults({ dataMappingItems: items });

export const VERBO_WIDGETS = [
  {
    id: "language-recovery",
    label: "Recovery by language",
    comp: LanguageRecovery,
    form: form([
      { key: "language", label: "Language" },
      { key: "cases", label: "Cases" },
      { key: "resolved", label: "Resolved" },
      { key: "returned", label: "Returned" },
    ]),
    defaultSize: { width: 8, height: 18 },
    dataMapping: {
      language: { type: "field", supportedRoles: ["category"], requires: { cardinality: "many" }, required: true, aiDescription: "Recipient language tag." },
      cases: measure("Total cases."),
      resolved: measure("Resolved cases."),
      returned: measure("Returned cases."),
    },
  },
  {
    id: "evidence-readiness",
    label: "Evidence readiness",
    comp: EvidenceReadiness,
    form: form([
      { key: "band", label: "Band" },
      { key: "cases", label: "Cases" },
    ]),
    defaultSize: { width: 8, height: 9 },
    dataMapping: {
      band: { type: "field", supportedRoles: ["category"], requires: { cardinality: "many" }, required: true, aiDescription: "Evidence band." },
      cases: measure("Total cases."),
    },
  },
];
