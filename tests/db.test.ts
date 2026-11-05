import { describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";

describe("database migrations", () => {
  it("apply cleanly on an in-memory PGlite", async () => {
    const db = new PGlite();
    for (const f of readdirSync("db/migrations").filter((x) => x.endsWith(".sql")).sort()) {
      for (const stmt of readFileSync(`db/migrations/${f}`, "utf8").split("--> statement-breakpoint")) await db.exec(stmt);
    }
    const r = await db.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public' order by 1",
    );
    expect(r.rows.map((x) => x.table_name)).toEqual(["case_events", "case_messages", "cases", "drafts", "transfer_events", "transfers", "webhook_events"]);
    await db.close();
  }, 30_000);
});
