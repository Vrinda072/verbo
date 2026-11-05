import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite ships WASM + data files; load it from node_modules instead of bundling.
  serverExternalPackages: ["@electric-sql/pglite"],
  // AG Grid's licence key is used in the browser by design (it is not a secret credential).
  env: { NEXT_PUBLIC_AG_GRID_LICENSE_KEY: process.env.AG_GRID_LICENSE_KEY ?? "" },
};

export default nextConfig;
