"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- Bryntum event payloads and inline project data */
import { useEffect, useMemo, useRef, useState } from "react";
import { BryntumSchedulerPro } from "@bryntum/schedulerpro-react";
import type { DeskRow } from "@/lib/desk/queries";
import { timelineData, VIEW_AFTER_MS, VIEW_BEFORE_MS } from "@/lib/desk/timeline";

const ERRORS: Record<string, string> = {
  not_open: "This case has closed, so its deadline can't change.",
  out_of_range: "A deadline must be in the future and within 14 days.",
};

const COLUMNS = [
  { text: "Case", field: "name", width: 220 },
  { text: "Status", field: "state", width: 110 },
  { text: "Their time", field: "local", width: 150 },
];

/** Bryntum Scheduler Pro: each row is an open recovery case. Dragging the end of a bar moves its escalation deadline. */
export default function DeadlineTimeline({ rows }: { rows: DeskRow[] }) {
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null);
  const [themeReady, setThemeReady] = useState(false);
  useEffect(() => {
    const hrefs = ["/bryntum/schedulerpro.css", "/bryntum/svalbard-light.css"];
    const links = hrefs.map((href) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      document.head.appendChild(link);
      return new Promise((resolve) => (link.onload = link.onerror = resolve)).then(() => link);
    });
    void Promise.all(links).then(() => setThemeReady(true));
    return () => void Promise.all(links).then((all) => all.forEach((l) => l.remove()));
  }, []);
  const now = useRef(new Date()).current;
  // One snapshot per mount. The Desk refreshes its rows every few seconds, and new props would reset the chart mid-drag.
  const [data] = useState(() => timelineData(rows, now));
  const project = useMemo(
    () =>
      ({
        resourcesData: data.resources,
        eventsData: data.events,
        assignmentsData: data.assignments,
        resourceTimeRangesData: data.resourceTimeRanges,
        timeRangesData: [{ id: "now", name: "Now", startDate: now.toISOString() }],
      }) as any,
    [data, now],
  );
  const startDate = useMemo(() => new Date(now.getTime() - VIEW_BEFORE_MS), [now]);
  const endDate = useMemo(() => new Date(now.getTime() + VIEW_AFTER_MS), [now]);

  const saved = useRef(new Map<string, string>());
  for (const e of data.events) if (!saved.current.has(String(e.id))) saved.current.set(String(e.id), String(e.endDate));

  async function saveDeadline(eventRecord: any) {
    const previous = saved.current.get(String(eventRecord.id));
    const caseId = String(eventRecord.id).slice(2);
    const res = await fetch(`/api/desk/cases/${encodeURIComponent(caseId)}/deadline`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ escalateAt: eventRecord.endDate.toISOString() }),
    });
    if (res.ok) {
      saved.current.set(String(eventRecord.id), eventRecord.endDate.toISOString());
      eventRecord.name = "Waiting for recipient";
      eventRecord.eventColor = "green";
      setMessage({ text: `Deadline moved to ${eventRecord.endDate.toLocaleString()} and added to the case timeline.`, bad: false });
      return;
    }
    const j = await res.json().catch(() => ({}));
    if (previous) eventRecord.endDate = new Date(previous);
    setMessage({ text: ERRORS[j.error] ?? "The deadline could not be saved.", bad: true });
  }

  if (!themeReady) return <p className="text-ink-3">Loading timeline…</p>;

  return (
    <div className="grid h-full grid-rows-[auto_1fr] gap-2">
      <p className={`text-sm ${message?.bad ? "font-semibold text-terracotta" : "text-ink-2"}`} role="status">
        {message?.text ?? ""}
      </p>
      <BryntumSchedulerPro
        project={project}
        startDate={startDate}
        endDate={endDate}
        viewPreset="dayAndWeek"
        rowHeight={38}
        barMargin={5}
        columns={COLUMNS}
        eventDragFeature={false}
        eventDragCreateFeature={false}
        eventEditFeature={false}
        taskEditFeature={false}
        scheduleMenuFeature={false}
        eventMenuFeature={false}
        cellEditFeature={false}
        dependenciesFeature={false}
        timeRangesFeature={{ showCurrentTimeLine: true }}
        resourceTimeRangesFeature
        eventTooltipFeature={{
          template: ({ eventRecord }: any) => `${eventRecord.name}<br>${eventRecord.startDate.toLocaleString()} to ${eventRecord.endDate.toLocaleString()}`,
        }}
        onEventResizeEnd={({ changed, eventRecord }: any) => {
          if (changed) void saveDeadline(eventRecord);
        }}
      />
    </div>
  );
}
