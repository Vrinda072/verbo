import * as schema from "./schema";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

/**
 * Database client.
 *   DATABASE_URL set      → node-postgres (Render Postgres in production)
 *   DATABASE_URL empty    → embedded PGlite persisted in ./.pglite (local dev; no Docker needed)
 *   PGLITE_DIR=memory     → in-memory PGlite (tests)
 * Migrations in db/migrations are applied once per process on first use.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export async function createDb(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const { Pool } = await import("pg");
    const db = drizzle(new Pool({ connectionString: url }), { schema });
    await migrate(db, { migrationsFolder: "db/migrations" });
    return db as unknown as Db;
  }
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const { PGlite } = await import("@electric-sql/pglite");
  const dir = process.env.PGLITE_DIR ?? "./.pglite";
  const db = drizzle(dir === "memory" ? new PGlite() : new PGlite(dir), { schema });
  await migrate(db, { migrationsFolder: "db/migrations" });
  return db as unknown as Db;
}

const g = globalThis as unknown as { __verboDb?: Promise<Db> };

/** One connection per process (survives Next dev hot reload). */
export function getDb(): Promise<Db> {
  g.__verboDb ??= createDb();
  return g.__verboDb;
}

/** Tests only: drop the cached connection so the next getDb() starts fresh. */
export function resetDbForTests() {
  g.__verboDb = undefined;
}

export { schema };
