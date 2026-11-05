import templatesFile from "./templates.json";
import { LANGUAGES, PLACEHOLDERS, TEMPLATE_KEYS, langDir, type TemplateKey } from "./readback";

export interface TemplateIssue {
  lang: string;
  key: string;
  problem: string;
}

const RTL_CHARS = /[֐-ࣿיִ-﷿ﹰ-﻿]/;

export function verifyTemplates(file = templatesFile): TemplateIssue[] {
  const issues: TemplateIssue[] = [];
  const templates = file.templates as Record<string, { strings: Record<string, string> }>;
  for (const [lang, entry] of Object.entries(templates)) {
    if (!LANGUAGES.some((l) => l.code === lang)) issues.push({ lang, key: "*", problem: "language not in provider list" });
    for (const key of TEMPLATE_KEYS) {
      const s = entry.strings[key];
      if (!s?.trim()) {
        issues.push({ lang, key, problem: "missing" });
        continue;
      }
      const found = [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      const expected = [...(PLACEHOLDERS[key as TemplateKey] ?? [])].sort();
      if (found.join() !== expected.join()) issues.push({ lang, key, problem: `placeholders ${found.join(",") || "none"} ≠ ${expected.join(",") || "none"}` });
      if (/\p{Nd}/u.test(s)) issues.push({ lang, key, problem: "contains digits (numbers must come from code)" });
      if (langDir(lang) === "rtl" && !RTL_CHARS.test(s)) issues.push({ lang, key, problem: "RTL language but no RTL script" });
    }
    for (const key of Object.keys(entry.strings)) {
      if (!TEMPLATE_KEYS.includes(key as TemplateKey)) issues.push({ lang, key, problem: "unknown key" });
    }
  }
  return issues;
}
