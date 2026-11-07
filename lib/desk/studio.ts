/**
 * Turns Case Desk rows into the flat data source AG Studio reads, and defines the starting dashboard.
 * Source: AG Studio 3.1.0 docs (tutorial, state) and types (AgChartDataMapping, AgValueWidgetDataMapping, read Nov 7, 2026).
 * Pure, so the derived numbers are tested without a browser. Simulated rows stay labelled in `dataset`.
 */
import { LANGUAGES } from "@/lib/bridge/readback";
import type { DeskRow } from "./queries";

const OPEN = new Set(["OPENED", "LINK_SENT", "VIEWED", "REPLIED"]);
const RESOLVED = new Set(["RETURNED", "REFUSED", "ESCALATED", "CLOSED"]);

export const DATASET_LIVE = "Live sandbox";
export const DATASET_SIMULATED = "Simulated";

export interface StudioCaseRow {
  caseId: string;
  dataset: string;
  outcome: string;
  recipientLanguage: string;
  /** "<code>|<native name>", so a widget can set the right script and direction. */
  languageTag: string;
  risk: string;
  amountUsd: number;
  evidence: number;
  evidenceBand: string;
  ageHours: number;
  reminders: number;
  messages: number;
  cases: number;
  open: number;
  resolved: number;
  returned: number;
  escalated: number;
}

function outcomeOf(r: DeskRow): string {
  if (r.everReturned) return "Returned";
  if (OPEN.has(r.state)) return "Open";
  if (r.state === "REFUSED") return "Refused";
  if (r.state === "ESCALATED") return "Escalated";
  return "Closed";
}

/** The same bands the Case Desk evidence meter colours by. */
export function evidenceBand(score: number): string {
  if (score >= 80) return "Ready (80+)";
  if (score >= 50) return "Partial (50–79)";
  return "Weak (under 50)";
}

export function toStudioRows(rows: DeskRow[]): StudioCaseRow[] {
  return rows.map((r) => {
    const lang = LANGUAGES.find((l) => l.code === r.recipientLanguage);
    return {
      caseId: r.shortId,
      dataset: r.simulated ? DATASET_SIMULATED : DATASET_LIVE,
      outcome: outcomeOf(r),
      recipientLanguage: lang?.englishName ?? r.recipientLanguage,
      languageTag: `${r.recipientLanguage}|${lang?.nativeName ?? r.recipientLanguage}`,
      risk: r.riskLevel ? r.riskLevel[0].toUpperCase() + r.riskLevel.slice(1) : "Not scored",
      amountUsd: r.cents / 100,
      evidence: r.evidence,
      evidenceBand: evidenceBand(r.evidence),
      ageHours: r.ageHours,
      reminders: r.remindersSent,
      messages: r.messages,
      cases: 1,
      open: OPEN.has(r.state) ? 1 : 0,
      resolved: RESOLVED.has(r.state) || r.everReturned ? 1 : 0,
      returned: r.everReturned ? 1 : 0,
      escalated: r.state === "ESCALATED" ? 1 : 0,
    };
  });
}

/** Open cases older than `hours` with no reminder sent, the ones an operator should look at first. Code, not a model, decides. */
export function stalledCases(rows: StudioCaseRow[], hours = 48): StudioCaseRow[] {
  return rows.filter((r) => r.open === 1 && r.ageHours >= hours && r.reminders === 0).sort((a, b) => b.ageHours - a.ageHours);
}

export interface CaseSummary {
  dataset: string;
  cases: number;
  open: number;
  resolved: number;
  returned: number;
  escalated: number;
  /** Returned as a share of resolved cases, not of all cases, or null when none are resolved. */
  returnedOfResolvedPercent: number | null;
  byLanguage: { language: string; cases: number; resolved: number; returned: number; returnedOfResolvedPercent: number | null }[];
}

const rate = (returned: number, resolved: number) => (resolved ? Math.round((returned / resolved) * 100) : null);

/** Totals and return rates, calculated by code so the agent can quote exact numbers instead of working them out. */
export function summariseCases(rows: StudioCaseRow[], dataset?: string): CaseSummary {
  const scoped = dataset ? rows.filter((r) => r.dataset === dataset) : rows;
  const add = (key: "cases" | "open" | "resolved" | "returned" | "escalated") => scoped.reduce((n, r) => n + r[key], 0);
  const languages = new Map<string, { cases: number; resolved: number; returned: number }>();
  for (const r of scoped) {
    const l = languages.get(r.recipientLanguage) ?? { cases: 0, resolved: 0, returned: 0 };
    l.cases += r.cases;
    l.resolved += r.resolved;
    l.returned += r.returned;
    languages.set(r.recipientLanguage, l);
  }
  return {
    dataset: dataset ?? "All (includes simulated)",
    cases: add("cases"),
    open: add("open"),
    resolved: add("resolved"),
    returned: add("returned"),
    escalated: add("escalated"),
    returnedOfResolvedPercent: rate(add("returned"), add("resolved")),
    byLanguage: [...languages.entries()]
      .map(([language, l]) => ({ language, ...l, returnedOfResolvedPercent: rate(l.returned, l.resolved) }))
      .sort((a, b) => b.cases - a.cases),
  };
}

export const CASE_FIELDS = [
  { id: "caseId", name: "Case", format: "textFormat" },
  { id: "dataset", name: "Data set", format: "textFormat" },
  { id: "outcome", name: "Outcome", format: "textFormat" },
  { id: "recipientLanguage", name: "Recipient language", format: "textFormat" },
  { id: "languageTag", name: "Language tag", format: "textFormat", hide: true },
  { id: "risk", name: "Pre-send risk", format: "textFormat" },
  { id: "amountUsd", name: "Amount (USD)", format: "currencyFormat", formatOptions: { format: "$#,##0.00" } },
  { id: "evidence", name: "Evidence score", format: "integerFormat" },
  { id: "evidenceBand", name: "Evidence band", format: "textFormat" },
  { id: "ageHours", name: "Age (hours)", format: "integerFormat" },
  { id: "reminders", name: "Reminders sent", format: "integerFormat" },
  { id: "messages", name: "Messages", format: "integerFormat" },
  { id: "cases", name: "Cases", format: "integerFormat" },
  { id: "open", name: "Open cases", format: "integerFormat" },
  { id: "resolved", name: "Resolved cases", format: "integerFormat" },
  { id: "returned", name: "Returned cases", format: "integerFormat" },
  { id: "escalated", name: "Escalated cases", format: "integerFormat" },
] as const;

const TITLE = { fontSize: 14, fontWeight: "bold" as const };
const title = (text: string) => ({ title: { enabled: true, text, typography: TITLE } });
const kpi = (text: string) => ({ ...title(text), style: { typography: { fontSize: 32, fontWeight: "bold" as const }, textAlign: "left" as const, verticalAlign: "center" as const } });
const sum = (id: string) => [{ id: `cases.${id}`, aggregation: "sum" as const }];
const field = (id: string) => [{ id: `cases.${id}` }];

/** The dashboard people see first. Plain JSON, so it can be edited in Studio and saved. */
export const INITIAL_STATE = {
  selectedPageId: "overview",
  panels: { ai: { collapsed: false }, edit: { collapsed: true }, data: { collapsed: true }, filters: { collapsed: true } },
  pages: [
    {
      id: "overview",
      name: "Overview",
      widgets: {
        "kpi-cases": { type: "value", dataMapping: { value: sum("cases") }, format: kpi("Cases") },
        "kpi-open": { type: "value", dataMapping: { value: sum("open") }, format: kpi("Open") },
        "kpi-returned": { type: "value", dataMapping: { value: sum("returned") }, format: kpi("Returned") },
        "kpi-escalated": { type: "value", dataMapping: { value: sum("escalated") }, format: kpi("Escalated") },
        "filter-dataset": { type: "list-filter", dataMapping: { value: field("dataset") }, format: title("Data set") },
        "chart-outcome": {
          type: "bar-chart-grouped",
          dataMapping: { categoryKey: field("outcome"), valueKey: sum("cases") },
          format: title("Cases by outcome"),
        },
        "language-recovery": {
          type: "language-recovery",
          dataMapping: { language: field("languageTag"), cases: sum("cases"), resolved: sum("resolved"), returned: sum("returned") },
          format: title("Recovery by recipient language"),
        },
        "chart-risk": {
          type: "bar-chart-grouped",
          dataMapping: { categoryKey: field("risk"), valueKey: sum("cases") },
          format: title("Pre-send risk"),
        },
        "evidence-readiness": {
          type: "evidence-readiness",
          dataMapping: { band: field("evidenceBand"), cases: sum("cases") },
          format: title("Evidence readiness"),
        },
        "stalled-cases": {
          type: "grid",
          dataMapping: { cols: [...field("caseId"), ...field("recipientLanguage"), ...field("outcome"), ...field("ageHours"), ...field("amountUsd"), ...field("evidence")] },
          format: title("All cases"),
        },
      },
      widgetLayout: {
        "kpi-cases": { xTrack: 0, yTrack: 0, xSpan: 4, ySpan: 8 },
        "kpi-open": { xTrack: 4, yTrack: 0, xSpan: 4, ySpan: 8 },
        "kpi-returned": { xTrack: 8, yTrack: 0, xSpan: 4, ySpan: 8 },
        "kpi-escalated": { xTrack: 12, yTrack: 0, xSpan: 4, ySpan: 8 },
        "filter-dataset": { xTrack: 16, yTrack: 0, xSpan: 8, ySpan: 8 },
        "chart-outcome": { xTrack: 0, yTrack: 8, xSpan: 8, ySpan: 26 },
        "language-recovery": { xTrack: 8, yTrack: 8, xSpan: 8, ySpan: 26 },
        "evidence-readiness": { xTrack: 16, yTrack: 8, xSpan: 8, ySpan: 11 },
        "chart-risk": { xTrack: 16, yTrack: 19, xSpan: 8, ySpan: 15 },
        "stalled-cases": { xTrack: 0, yTrack: 34, xSpan: 24, ySpan: 24 },
      },
    },
  ],
};
