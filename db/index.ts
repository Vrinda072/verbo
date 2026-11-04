import * as schema from "./schema";

/**
 * Database client.
 *   DATABASE_URL set   → node-postgres (Render Postgres in production)
 *   DATABASE_URL empty → embedded PGlite persisted in ./.pglite (local dev; no Docker needed)
 */
export async function createDb() {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { Pool } = await import("pg");
    return drizzle(new Pool({ connectionString: url }), { schema });
  }
  const { drizzle } = await import("drizzle-orm/pglite");
  const { PGlite } = await import("@electric-sql/pglite");
  return drizzle(new PGlite("./.pglite"), { schema });
}

export { schema };
