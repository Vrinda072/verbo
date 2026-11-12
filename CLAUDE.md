# CLAUDE.md — working rules for Verbo

Verbo is a voice-first safety net for person-to-person payments (PayPal AI Hackathon, deadline **Nov 12, 2026 12:00 PT**).
The master brief is [`docs/plan/MASTER_PROMPT.md`](docs/plan/MASTER_PROMPT.md); the day-by-day plan is [`docs/plan/PLAN.md`](docs/plan/PLAN.md).
Brief = goal, order of work, strategy. This file + docs/plan/PLAN.md = details.

## Hard rules
1. **Never invent PayPal API signatures.** Verify against PayPal's OpenAPI specs
   (`https://developer.paypal.com/api/<api>/<version>/schema.json`) or the APIMatic Context Plugin,
   and put the source in a comment next to the call (`// Source: payments/v2 schema.json, authorizations.void`).
2. **Secrets only in `.env`.** Never print, log, echo or commit a secret value. Before each commit run
   `npm run precommit-check` (scans staged files for secret-looking values).
3. **The LLM never decides money.** It extracts into a strict zod schema → code validates → fixed
   per-language templates read back → explicit user confirmation.
4. **All money-changing calls use idempotency keys** (`PayPal-Request-Id`, payout `sender_batch_id`) and are covered by tests.
5. **Sandbox only.** `assertSandbox()` guards every real client.
6. **Mask PII in logs** — use `lib/core/log.ts`, never raw `console.log` of payloads.
7. **No unverified statistics.** Eval numbers come only from our own scripted scenarios (`scripts/eval.ts`) and say so.
8. **Seeded data is synthetic** and labelled "simulated" in UI and data.
9. **No hardcoded language list** — `lib/bridge/languages.json` is generated from the provider list.
10. Accessibility: large type, high contrast, keyboard + screen reader, RTL.
11. Small commits, clear messages, `main` never broken (`npm test && npm run typecheck` before commit).

## Layout
```
app/            screens and API routes: send, recover/[token], desk, demo, api/ (paypal/webhook is signature-verified)
components/     ui/ (shared pieces: En, NameDiff, Digits, MoneyPath, SiteHeader…) · home/ · send/
lib/core/       config (APP_NAME, MOCK, sandbox URL), log (PII masking), rateLimit
lib/people/     simulated contacts and history, sound-alike names, name and phone diffs, local time
lib/paypal/     client.ts (interface) real.ts mock.ts money.ts (state machine) sdk.ts trail.ts index.ts (factory)
lib/transfers/  payment service and its store       lib/recovery/  cases, tokens, timers
lib/agents/     extraction, recovery coach, Gemini   lib/risk/  scoring, pressure words
lib/bridge/     languages, read-back templates       lib/speech/  recording, speech-to-text, read-aloud
lib/desk/       Case Desk queries, seed, timeline    lib/evidence/  evidence packet (PDF + JSON + SHA-256)
db/             drizzle schema, client, migrations (PGlite locally, Postgres on Render)
scripts/        check-env, money-loop, eval (+ eval-scenarios), gen-languages, register-webhook, …
tests/          Vitest suites and fixtures
docs/           plan/ (brief, PLAN, STRATEGY, STATUS) · eval/ (scripted results) · guides/ (deploy, APIMatic, languages)
PRODUCT.md, DESIGN.md   product and design context (read by the Impeccable design tool, so they stay at the root)
```

## Commands
- `npm run dev` — Next.js dev server (MOCK=1 by default)
- `npm test` — Vitest · `npm run typecheck`
- `npm run check-env` — which env vars are set (names only)
- `npm run money-loop` — sandbox Order→authorize→capture→payout, void path, return path

## Design system
Tokens in `app/globals.css` (`--v-*`). Direction: clean, professional fintech. Copy is plain and neutral, with no dramatic or story-style lines.
Use tokens only; no ad-hoc hex values in components.
