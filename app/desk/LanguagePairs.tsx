"use client";
import { useMemo, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import type { CellClickedEvent, CellStyle, ColDef } from "ag-grid-community";
import type { DeskRow } from "@/lib/desk/queries";
import { LANGUAGES } from "@/lib/bridge/readback";
import { verboGridTheme } from "./grid";

const name = (code: string) => LANGUAGES.find((l) => l.code === code)?.englishName ?? code;
const MAX_COLUMNS = 8;

type PairRow = { from: string; code: string; total: number } & Record<string, number | string>;

/**
 * Sender language × recipient language: where mistaken payments happen, so the team knows which translations to
 * support first. An AG Grid with one column per recipient language, shaded by count.
 */
export default function LanguagePairs({ rows }: { rows: DeskRow[] }) {
  const [picked, setPicked] = useState<{ from: string; to: string } | null>(null);

  const { rowData, cols, max, cell } = useMemo(() => {
    const count = new Map<string, { n: number; returned: number }>();
    const toTotals = new Map<string, number>();
    for (const r of rows) {
      const k = `${r.senderLanguage}|${r.recipientLanguage}`;
      const c = count.get(k) ?? { n: 0, returned: 0 };
      c.n += 1;
      if (r.everReturned) c.returned += 1;
      count.set(k, c);
      toTotals.set(r.recipientLanguage, (toTotals.get(r.recipientLanguage) ?? 0) + 1);
    }
    const cols = [...toTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, MAX_COLUMNS).map(([code]) => code);
    const senders = [...new Set(rows.map((r) => r.senderLanguage))];
    const rowData: PairRow[] = senders
      .map((s) => {
        const row: PairRow = { from: name(s), code: s, total: 0 };
        for (const to of cols) {
          const n = count.get(`${s}|${to}`)?.n ?? 0;
          row[to] = n;
          row.total += n;
        }
        return row;
      })
      .sort((a, b) => b.total - a.total);
    const max = Math.max(1, ...[...count.values()].map((c) => c.n));
    return { rowData, cols, max, cell: count };
  }, [rows]);

  const columnDefs = useMemo<ColDef<PairRow>[]>(
    () => [
      { field: "from", headerName: "From \\ to", pinned: "left", width: 150, cellStyle: { fontWeight: 600 } },
      ...cols.map(
        (to): ColDef<PairRow> => ({
          field: to,
          headerName: name(to),
          width: 118,
          type: "numericColumn",
          cellStyle: (p): CellStyle => {
            const share = Number(p.value) / max;
            return share >= 0.66
              ? { background: "var(--v-navy)", color: "var(--v-navy-ink)", fontWeight: 600 }
              : share >= 0.33
                ? { background: "var(--v-navy-2)", color: "var(--v-navy-ink)", fontWeight: 600 }
                : share > 0
                  ? { background: "var(--v-brand-soft)", color: "var(--v-ink)", fontWeight: 500 }
                  : { background: "transparent", color: "var(--v-ink-3)", fontWeight: 400 };
          },
        }),
      ),
      { field: "total", headerName: "Total", width: 100, type: "numericColumn", cellStyle: { fontWeight: 600 } },
    ],
    [cols, max],
  );

  const detail = picked ? cell.get(`${picked.from}|${picked.to}`) : null;

  return (
    <div className="grid gap-3">
      <p aria-live="polite" className="min-h-7 text-lg font-semibold">
        {picked && detail
          ? `${name(picked.from)} to ${name(picked.to)}: ${detail.n} case${detail.n === 1 ? "" : "s"}, ${detail.returned} returned`
          : "Click a cell to see a language pair."}
      </p>
      <div className="h-[520px]">
        <AgGridReact<PairRow>
          theme={verboGridTheme}
          rowData={rowData}
          columnDefs={columnDefs}
          getRowId={(p) => p.data.code}
          onCellClicked={(e: CellClickedEvent<PairRow>) => {
            const to = e.colDef.field;
            if (e.data && to && to !== "from" && to !== "total") setPicked({ from: e.data.code, to });
          }}
        />
      </div>
    </div>
  );
}
