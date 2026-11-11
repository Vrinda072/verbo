"use client";
/**
 * The Case Desk dashboard on AG Studio. Source: AG Studio 3.1.0 docs: quick start, theming, licence install, custom widgets
 * (read Nov 7, 2026). Without a licence key Studio runs locally with a watermark.
 */
import { useMemo, useRef, useState } from "react";
import { AgStudio, AgStudioProvider, createWidgets } from "ag-studio-react";
import { AgStudioAiModule, createAiHarness, directLlmRunner, studioTheme } from "ag-studio";
import type { DeskRow } from "@/lib/desk/queries";
import { CASE_FIELDS, DATASET_LIVE, DATASET_SIMULATED, INITIAL_STATE, stalledCases, summariseCases, toStudioRows, type StudioCaseRow } from "@/lib/desk/studio";
import { verboAdapter } from "@/lib/desk/studioAdapter";
import { VERBO_WIDGETS } from "./widgets";

// Tokens, so the dashboard follows the app in light and dark mode.
const theme = studioTheme.withParams({
  backgroundColor: "var(--v-card)",
  foregroundColor: "var(--v-ink)",
  accentColor: "var(--v-brand)",
  borderColor: "var(--v-line)",
  fontFamily: "var(--font-noto), system-ui, sans-serif",
});

/* eslint-disable @typescript-eslint/no-explicit-any -- generic registry types add nothing for this fixed set of widgets. */
const widgets = (config: any) =>
  createWidgets({
    additionalTypes: VERBO_WIDGETS as any,
    menu: [...config.menu, { label: "Verbo", widgetIds: VERBO_WIDGETS.map((w) => w.id) }],
  } as any);

// Studio shows the agent's chat in edit mode only. The dashboard's own filter widget makes a Filters panel unnecessary when viewing.
type View = "view" | "ask" | "edit";
const panelsFor = (view: View) => ({ view: { left: [], right: [] }, edit: { left: [], right: view === "ask" ? ["ai"] : ["edit", "data", "filters"] } });

const INSTRUCTIONS = [
  "You are the Case analyst on Verbo's Case Desk. Cases are payments sent to the wrong person, being recovered across languages.",
  "You can answer questions about the data and build dashboard views. You cannot send, refund, cancel or message anything, and you must say so if asked.",
  "Answer in plain, professional language and use numbers only from tool results. Never estimate.",
  "The `dataset` field separates live sandbox cases from simulated ones. Simulated figures are synthetic, so say so when they are included.",
  "For counts, return rates and languages, call summarise_cases. For cases needing attention, call find_stalled_cases. Quote those results and stop.",
  "Use the data agent only for a question those two tools cannot answer.",
  "To add a widget, do both steps: delegate to the page agent to place it, then delegate to the widget agent with that widget's id and type to connect its data and title. A placed widget is empty until the second step is done, so never say it is ready before then.",
  "The return rate is a share of resolved cases, not of all cases. Always say so and quote the resolved count, for example: 114 returned of 182 resolved cases (63%). Open cases are not counted in it.",
  "Keep answers to a few short sentences or a short list.",
].join("\n");

const SYSTEM_ADAPTER = verboAdapter();

/** A Verbo agent working with Studio's built-in specialists. Its tools reach the dashboard only, never PayPal. */
function buildAi(rowsRef: { current: StudioCaseRow[] }) {
  return ({ api }: any) =>
    createAiHarness(api, ({ builtIn, tools }: any) => {
      const stalled = api.defineAiTool({
        name: "find_stalled_cases",
        description: "List open cases older than a number of hours that have had no reminder, oldest first. Calculated by code.",
        params: (s: any) =>
          s.object({
            hours: s.number({ description: "Minimum age in hours. Defaults to 48." }).optional(),
            dataset: s.enum([DATASET_LIVE, DATASET_SIMULATED]).optional(),
          }),
        execute: async (args: { hours?: number; dataset?: string }, ctx: any) => {
          const scoped = args.dataset ? rowsRef.current.filter((r) => r.dataset === args.dataset) : rowsRef.current;
          const found = stalledCases(scoped, args.hours ?? 48);
          return ctx.success(`${found.length} stalled cases.`, {
            total: found.length,
            oldest: found.slice(0, 20).map((r) => ({ caseId: r.caseId, dataset: r.dataset, ageHours: r.ageHours, language: r.recipientLanguage, amountUsd: r.amountUsd })),
          });
        },
      });
      const summary = api.defineAiTool({
        name: "summarise_cases",
        description: "Exact case totals and return rates, overall and per recipient language. Calculated by code.",
        params: (s: any) => s.object({ dataset: s.enum([DATASET_LIVE, DATASET_SIMULATED]).optional() }),
        execute: async (args: { dataset?: string }, ctx: any) => {
          const result = summariseCases(rowsRef.current, args.dataset);
          return ctx.success(`${result.cases} cases summarised.`, result);
        },
      });
      const helpers = Object.entries(builtIn)
        .filter(([id]) => id !== "lead")
        .map(([, definition]) => directLlmRunner({ ...(definition as any), adapter: SYSTEM_ADAPTER }));
      return {
        agents: [
          directLlmRunner({
            id: "case-analyst",
            name: "Case analyst",
            adapter: SYSTEM_ADAPTER,
            instructions: () => INSTRUCTIONS,
            maxTurns: 12,
            tools: () => [summary, stalled, tools.studio.viewPage(), tools.delegateTo(["data", "page", "widget"])],
          }),
          ...helpers,
        ],
        primary: "case-analyst",
      };
    });
}

export default function StudioDashboard({ rows }: { rows: DeskRow[] }) {
  const [view, setView] = useState<View>("view");
  const panels = useMemo(() => panelsFor(view), [view]);
  const studioRows = useMemo(() => toStudioRows(rows), [rows]);
  const rowsRef = useRef(studioRows);
  rowsRef.current = studioRows;
  const ai = useMemo(() => buildAi(rowsRef), []);
  const data = useMemo(() => ({ sources: [{ id: "cases", name: "Recovery cases", data: studioRows, fields: [...CASE_FIELDS] }] }), [studioRows]);
  const key = process.env.NEXT_PUBLIC_AG_STUDIO_LICENSE_KEY || undefined;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-60 flex-1 text-sm text-ink-3">Figures that include simulated cases describe synthetic data, not real outcomes.</p>
        <div role="group" aria-label="Dashboard mode" className="flex flex-wrap gap-2">
          {(
            [
              ["view", "View"],
              ["ask", "Ask the analyst"],
              ["edit", "Edit dashboard"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={view === id}
              onClick={() => setView(id)}
              className={`min-h-10 whitespace-nowrap rounded-full border px-4 text-sm font-semibold ${view === id ? "border-ink bg-ink text-paper" : "border-line-strong hover:bg-paper-2"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="v-studio h-[900px] overflow-hidden rounded-v-lg border border-line">
        <AgStudioProvider licenseKey={key} modules={[AgStudioAiModule]}>
          <AgStudio data={data as any} initialState={INITIAL_STATE as any} mode={view === "view" ? "view" : "edit"} theme={theme} widgets={widgets as any} ai={ai as any} panels={panels as any} />
        </AgStudioProvider>
      </div>
      <p className="mt-2 text-sm text-ink-3">
        The analyst sends case figures, with no names, to Google Gemini or Groq. It can only read and build dashboards. It cannot move money, refund or message anyone.
      </p>
    </div>
  );
}
