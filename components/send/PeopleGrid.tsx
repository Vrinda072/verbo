"use client";
import { useEffect, useMemo, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, RowClickedEvent } from "ag-grid-community";
import { registerGrid, verboGridTheme } from "@/app/desk/grid";
import { soundAlikeGroups } from "@/lib/people/soundAlike";
import { LANGUAGES } from "@/lib/bridge/readback";
import { CONTACTS } from "@/lib/people/contacts";

// Modules must be registered before the first render, not in an effect.
registerGrid();

interface Person {
  name: string;
  sound: string;
  language: string;
  paid: string;
  phone: string;
  local: string;
}

/**
 * The address book grouped by how names sound, not how they are spelled. Rows that land in one group are the people
 * speech cannot tell apart, by the same test the voice check uses. AG Grid row grouping on a key code computes.
 */
export default function PeopleGrid({ onPick }: { onPick: (name: string) => void }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const rows = useMemo<Person[]>(() => {
    const groups = soundAlikeGroups(CONTACTS);
    return CONTACTS.map((c) => {
      const same = groups.find((g) => g.includes(c.name))!;
      return {
        name: c.name,
        sound: same.length > 1 ? `Sound alike: ${same.join(" / ")}` : "Distinct names",
        language: LANGUAGES.find((l) => l.code === c.language)?.englishName ?? c.language,
        paid: c.paidBefore ? "Paid before" : "Never paid",
        phone: c.phone,
        local: `${new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: c.timeZone }).format(now)} ${c.city}`,
      };
    });
  }, [now]);

  const columnDefs = useMemo<ColDef<Person>[]>(
    () => [
      { field: "sound", rowGroup: true, hide: true },
      { field: "name", headerName: "Name", minWidth: 150, flex: 1.3 },
      { field: "language", headerName: "Reads", minWidth: 100, flex: 1 },
      { field: "paid", headerName: "History", minWidth: 110, flex: 1 },
      { field: "local", headerName: "Their time", minWidth: 130, flex: 1.2 },
      { field: "phone", headerName: "Phone", minWidth: 150, flex: 1.3 },
    ],
    [],
  );

  return (
    <div className="h-[430px]">
      <AgGridReact<Person>
        theme={verboGridTheme}
        rowData={rows}
        columnDefs={columnDefs}
        groupDefaultExpanded={-1}
        autoGroupColumnDef={{ headerName: "How it sounds", minWidth: 240, flex: 2 }}
        getRowId={(p) => p.data.name}
        onRowClicked={(e: RowClickedEvent<Person>) => e.data && onPick(e.data.name)}
        rowStyle={{ cursor: "pointer" }}
      />
    </div>
  );
}
