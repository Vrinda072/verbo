/**
 * Copies Bryntum's stylesheets to public/bryntum so the browser loads them as they ship. Passing them through the app's
 * CSS bundler rewrites a right-to-left rule into one that matches <html> and pushes the whole page off-screen.
 */
import { cpSync, existsSync, mkdirSync } from "node:fs";

const from = "node_modules/@bryntum/schedulerpro";
const to = "public/bryntum";
if (existsSync(from)) {
  mkdirSync(to, { recursive: true });
  for (const file of ["schedulerpro.css", "svalbard-light.css", "svalbard-dark.css"]) cpSync(`${from}/${file}`, `${to}/${file}`);
  for (const dir of ["fontawesome", "fonts"]) if (existsSync(`${from}/${dir}`)) cpSync(`${from}/${dir}`, `${to}/${dir}`, { recursive: true });
}
