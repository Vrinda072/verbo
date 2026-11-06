# Status

## Nov 6 — free voice and translation

Soniox has no credit left and no Anthropic key is set, so voice and translation now have no-cost defaults.
- **Mic:** the browser's built-in speech recognition (`SPEECH_PROVIDER=browser`, the default). Soniox stays available
  with `SPEECH_PROVIDER=soniox`, or automatically if the browser has no speech recognition. Chrome sends audio to its
  own web service. Which languages work depends on the browser and cannot be queried.
- **Translation:** Claude if `ANTHROPIC_API_KEY` is set and `MOCK=0`; otherwise MyMemory (no key, 5,000 chars/day).
  Goes through English when a pair returns nothing (Telugu → Spanish does). Number check still applies. No email is sent to it.
- **Offline parser for real speech:** number words (en/es/pt/hi/te/ar, typed confirmation still required), "12 dollars
  34 cents", spelling variants of names, refuses two different amounts, recognises more foreign currencies.
- **Ambiguous names** now show tappable contact buttons.
- **Tested:** 102 tests; eval 48/48 and 9/9 (`docs/eval.md`, same caveats). Live MyMemory te → es. Mic code driven by a
  **stand-in recogniser**, because the app's Browser pane blocks microphones.
- **Real voice:** Vrinda tried Hindi in Chrome (Nov 6) and reported poor recognition and a failing flow. Telugu by real
  voice is not confirmed. The server had 14 understand requests and only 3 stored drafts, all English.
- **Fixed in Verbo's code:** 12 of 19 hand-written Hindi sentences failed in the parser; now 16 pass and the other 3 are
  correct refusals or questions. Names match by sound across scripts, contacts have Hindi/Telugu/Arabic first names, the
  screen shows the listening language and the payable contacts. These are sentences I wrote, not real Chrome output.
- **Not fixed:** Chrome's own recognition quality, which Verbo can't improve. Not retested with real voice since the fix.
  Options if it stays poor: Gemini free tier (includes a transcription model; free-tier content is used to improve
  Google's products) or Groq Whisper (accepts webm and a spelling prompt; free limits not confirmed). Both need a key.
- **Risk for submission:** the rules require meaningful use of AI, and without `ANTHROPIC_API_KEY` the running app uses
  only the rule-based parser and MyMemory. The Claude code paths exist but have never run live.

## Day 5 — Thu Nov 5, 2026 (Case Desk + evidence)

### Done
- **Case Desk** `/desk` on **AG Grid 36.3** (community + enterprise; every API checked against the installed type
  definitions): custom "warm paper & ink" theme built only from design tokens (follows dark mode), master/detail rows
  (timeline, conversation with translations, evidence checklist, quick actions remind / escalate / close, PDF + JSON
  downloads), row-group panel, set filters, quick search, live / simulated / all toggle.
- **Widgets**: KPI tiles (cases, open, returned + share of resolved, escalated, median evidence), clickable
  recipient-language tiles (native names) that filter the grid, **pre-send alerts** grid (live drafts only).
- **300 simulated cases**, deterministic, legal state-machine timelines, SIM- ids, example.test emails; marked "sim" in
  the grid and called out in the header and under the KPIs.
- **Evidence packet**: canonical JSON (sorted keys) + SHA-256 + PDF (pdf-lib, fixed dates, hash on every page).
  Non-Latin text in the PDF is replaced by a pointer to the JSON, which holds the exact original. Download header
  `X-Evidence-SHA256` verified equal to the body's hash. Golden-file and PDF-determinism tests.
- **Evidence meter** (0–100, documented weights); the live mock recovery case scores 100.

### Not done / blocked
- **AG Grid licence**: no key, so Enterprise runs in trial mode with a watermark and console notice. Set
  `AG_GRID_LICENSE_KEY` (a trial key from AG Grid, or the hackathon sponsor) to remove it.
- **AG Studio** and the **ask-the-dashboard agent**: not built (AG Studio API unverified; agent is cut-list item 2).
- Operator actions have **no login** (labelled "demo operator").
- One test run timed out while the Mac was overloaded (load ≈ 19, `fileproviderd` at 100 % CPU, 1.5 GB disk free);
  the re-run passed (**81 tests**). Low disk space makes this likelier — freeing space is still the top manual task.

### Next (Nov 9–12 polish & ship)
1. Render deploy (web + Postgres + cron for `release-holds` and `recovery-tick`), real-sandbox run of hold + recovery.
2. README by judging criterion, accessibility pass, empty/loading/error states.
3. With keys: Claude extraction eval + translation, Soniox speech spike; then the demo video.

## Day 4 — Thu Nov 5, 2026 (recovery; still ahead of plan)

### Done
- **Cases** (`lib/recovery`): state machine opened → link_sent → viewed → replied → returned | refused |
  escalated → closed, optimistic updates, immutable `case_events` timeline, `case_messages` stored in the
  original language plus translation. One case per transfer.
- **Signed links**: HMAC-SHA256, 7-day expiry, payload = case id + role + expiry only (no names, emails, amounts).
- **Recipient page** `/recover/[token]`: language = `?lang` → contact's language → browser; picker; explanation with
  code-formatted amount; "It's your choice — Verbo can't take money from your account"; **one-tap Return** (the
  recipient approves a PayPal CAPTURE order themselves → platform → payout to the sender); "This money is mine"
  (recorded, reversible); conversation below.
- **Sender side**: completed payment → "Sent to the wrong person? Ask for it back" → case panel with timeline,
  messages, and the link (delivery is simulated in the demo and labelled so).
- **Translation**: Claude when configured; otherwise the original is shown and labelled "not translated" — never a
  fake translation. Translations that change any number are dropped.
- **Simulated clock**: reminder at 24 h, escalation at 72 h (`npm run recovery-tick -- --at=+73h`).
- `npm run e2e-recovery`: full story (send → hold → released → case → Portuguese reply → return → RETURNED;
  second case → reminder → ESCALATED) passes in mock mode.
- **Checked in the browser (mock):** Telugu send to Manuel Lopes → ask for it back → Portuguese page → Return →
  case RETURNED, payout to sender COMPLETED.
- Fixed: mock PayPal ids collided with ids persisted from earlier dev sessions; language picker overflowed on phones.
- **75 tests**, typecheck clean.

### Not done / blocked
- Messages are **untranslated** until `ANTHROPIC_API_KEY` is set (labelled honestly in the UI).
- Recovery not yet run against the **real** sandbox (needs approval as Manuel Lopes, like the Day 2 return).
- Link delivery is simulated (no SMS/email integration).

### Next (Day 5 — Case Desk + evidence)
1. AG Grid Case Desk: master/detail cases, timeline, quick actions, custom theme; ~300 simulated cases.
2. Evidence packet per case: JSON + PDF + SHA-256, golden-file test.
3. Disk: AG Grid + PDF libraries need space (currently ~2 GB free).

## Day 3 — Thu Nov 5, 2026 (same day as Day 2; ahead of plan)

### Done
- **Risk scoring** (`lib/risk`), code only: similar recipient (weighted by whether the chosen contact is a known
  payee), first-time recipient, unusual amount vs simulated history, pressure-language cues (keyword lists in
  en/te/hi/es/pt/ar + verbatim phrases from the model, which only count if they appear in the transcript), language
  mismatch → **low / medium / high**. High = safety hold. Weights are hand-set and documented, not tuned on fraud data.
- **Server-side drafts**: `/api/understand` stores recipient, amount and risk; `/api/transfers` takes only a draft id
  + confirmation nonce, so the client can't change the amount or skip the risk check.
- **Persistence**: transfers and an immutable `transfer_events` log in Postgres/PGlite, migrations applied
  automatically; optimistic state check so two workers can't both advance a transfer.
- **Hold flow**: PayPal return → authorize; high risk = authorization held uncaptured for `RISK_HOLD_MINUTES`
  (default 10); hold screen with server-synced countdown, reasons and a big cancel button (VOID, no money moves);
  release after the window (status page polling or `npm run release-holds`). Low risk releases straight away.
- **Checked in the browser (mock mode):** Telugu "send 12.34 to Manuel Lopes urgently" → high risk with 4 reasons →
  Telugu hold screen → cancel → **VOIDED**. Low-risk English send → **COMPLETED**.
- **Eval** (`npm run eval` → `docs/eval.md`): 50 team-written scenarios. Offline rules run: 41/41 pipeline,
  9/9 deliberately wrong model outputs caught by code. Caveats in the doc (same team wrote parser and scenarios).
- **65 tests**, typecheck clean.

### Not done / blocked
- Live speech (Soniox out of credit) and Claude extraction (no `ANTHROPIC_API_KEY`), as on Day 2.
- The hold flow has not yet been run against the **real** sandbox (only mock). Needs one manual approval:
  set `MOCK=0`, send to Manuel Lopes, approve as Sreenivas, then cancel or wait 10 minutes.
- Webhooks still not wired into the DB (the return page does the work for now).

### Next (Day 4 — recovery)
1. Cases state machine + signed expiring `app/recover/[token]` link.
2. Recipient-side page in their language with one-tap Return (reuses the sandbox-proven return flow).
3. Translated one-way message + reply; simulated clock for reminders and escalation.

## Day 2 — Thu Nov 5, 2026

### Live sandbox money loop (run `mw2hk374`, IDs in git-ignored `docs/private/`)
| Path | Result |
|---|---|
| **Send** $12.34 Sreenivas → platform → Manuel Lopez (Order AUTHORIZE → authorize → capture → Payout) | ✅ **COMPLETED**: payout batch SUCCESS. **Payouts works in the sandbox, so no Invoice fallback is needed.** |
| **Void** $5.00 (authorize → 10-min risk hold → VOID) | ✅ **VOIDED**, no money moved |
| **Return** $12.34 Manuel Lopes → platform → Sreenivas (Order CAPTURE → Payout) | ✅ **COMPLETED** (run `mw37hn0k`): Manuel Lopes approved, capture done, payout batch SUCCESS back to Sreenivas. (Two earlier 15-min approval windows expired with nothing captured.) |

**The whole platform-mediated money loop (send, risk-hold void, return) works live in the PayPal sandbox.**

- Keys in `.env`: PayPal client id/secret ✅ (OAuth verified; all 10 webhook event types exist), Soniox ✅, sandbox emails ✅.
- Demo personas renamed to match the real sandbox accounts: **Sreenivas Rao** (sender), **Manuel Lopez** (intended), **Manuel Lopes** (look-alike), **Verbo** (platform business).
- `languages.json` generated from Soniox: **60 languages, all tier B** (real-time STT + translation reported by the provider; none native-reviewed yet). See `docs/language-coverage.md`.
- `money-loop` now takes `--wait=<minutes>`.

### Voice send (built today)
- **Extraction agent** (`lib/agents/extraction`): Claude structured outputs (`claude-opus-5-5`, zod schema, server-side
  refusal fallback) → **code validation decides money**: strict decimals, sandbox limit, USD only (never converts),
  recipient resolved against the simulated address book, look-alikes surfaced. **Hallucination guard:** the amount must
  match a numeral in the transcript (Telugu/Devanagari/Arabic digits normalised); amounts spoken only in words require
  the user to type the digits. Cross-script names resolve via a `recipient_latin` transliteration + native aliases.
  Without `ANTHROPIC_API_KEY` (current state) a deterministic rules parser runs instead and the UI says so.
- **Read-back templates** (`lib/bridge/templates.json`): en (authored) + te/hi/es/pt/ar (machine-translated,
  `reviewed:false`); amounts inserted by code. `npm run verify-templates` checks keys, placeholders, no digits, RTL.
- **Speech**: `/api/stt/token` mints 5-min single-use Soniox keys; browser streams mic audio over WebSocket
  (protocol verified against Soniox docs). `npm run speech-spike` runs synthetic voices through the same path.
- **Send screen** `/send`: big mic + waveform, editable transcript, searchable native-name language picker,
  confirmation card (template sentence + English, big digits, look-alike warning, first-time notice), and
  `POST /api/transfers` (server re-validates, idempotent nonce → AUTHORIZE order). Checked in the browser in mock mode
  with a Telugu command → Telugu card with the "Manuel Lopes" look-alike warning → order created.
- **50 tests passing**, typecheck clean.

### Blocked
- **Soniox account is out of credit** (`402 Organization balance exhausted`). Key minting works; streaming doesn't.
  The Send screen falls back to typing. Speech spike not run, so there are no speech results yet.
- **No `ANTHROPIC_API_KEY`**: extraction runs on the rules parser.

### Still to do by hand
- **Add credit to Soniox** (console.soniox.com → Billing).
- **Add `ANTHROPIC_API_KEY`** to `.env`.
- Record one short Telugu clip (e.g. "మాన్యుయెల్ లోపెజ్ కి 12 డాలర్లు పంపండి") as `.m4a`; then
  `npm run speech-spike -- --file=clip.m4a --lang=te --expect=c_lopez:1200`.
- Rotate the PayPal secret and Soniox key before submission (they were pasted in chat).
- Free disk space (~2 GB free now; ≥ 10 GB wanted for AG Grid, PDF and deploy work).

### Next (Day 3)
1. Pre-send risk scoring (similar name, unusual amount, first-time, pressure language, language mismatch) + 10-minute hold UI.
2. Persist transfers + webhook events in the DB; wire `/paypal/return` to authorize and run the hold.
3. `scripts/eval.ts` over scripted scenarios → `docs/eval.md`; rerun the speech spike once Soniox has credit.

## Day 1 — Wed Nov 4, 2026

### Done
- **Repo:** <https://github.com/Vrinda072/verbo>, public, MIT detected by GitHub. 6 small commits on `main`.
- **Scaffold:** Next.js 15 (App Router, TS, Tailwind v4), Vitest, Drizzle. `npm run dev` serves the landing page and shells for `/send`, `/desk`, `/recover/[token]`, `/paypal/return`.
- **Design system:** "warm paper & ink" tokens (colour, type scale with 18px base, spacing, radius, motion, dark mode) in `app/globals.css`; Atkinson Hyperlegible + Fraunces.
- **Env:** `.env.example` (committed) + `.env` (git-ignored, `TOKEN_SIGNING_SECRET` generated). `npm run check-env` lists set/missing by name. `npm run precommit-check` blocks staged secrets.
- **PayPal:** real sandbox client + mock client behind one interface. Every call was checked against PayPal's OpenAPI specs (Orders v2, Payments v2, Payouts v1, Webhooks v1); the `operationId` is in a comment on each method. Idempotency via `PayPal-Request-Id` + `sender_batch_id`.
- **Money state machine + flows:** send, risk hold, void, release, payout refresh, return. **28 tests passing.**
- **`scripts/money-loop.ts`:** all three paths pass in `--mock` mode. **Not yet run live** (needs keys).
- **Webhook endpoint** `POST /api/paypal/webhook`: signature verification, de-dupe by event id (tested locally). `scripts/register-webhook.ts` registers it.
- **DB:** embedded **PGlite** locally (Docker is installed but not running, and the disk is nearly full); Postgres on Render later. First migration is tested.
- **`scripts/gen-languages.ts`:** written; generates `languages.json` + `docs/language-coverage.md` from Soniox `/v1/models`. **Not run** (needs `SONIOX_API_KEY`).
- **`docs/STRATEGY.md`:** written from the official rules page.

### Blocked / not done
- **Disk space:** the Mac had **38 MB free** when we started. I cleared npm's cache (2.6 GB, packages only); **~1.2 GB is free now.** AG Grid, PDF and audio libraries need more.
- Live sandbox money loop: waiting for PayPal keys and sandbox emails.
- Webhook delivery from PayPal: needs a public HTTPS tunnel and `PAYPAL_WEBHOOK_ID`.
- Language list: waiting for `SONIOX_API_KEY`.
- AG Studio starter: deferred to Day 5. The AG Studio API isn't verified yet, and we're short on disk.
- APIMatic Context Plugin: not installed here. Day 1 calls were verified against PayPal's specs instead.

### What Vrinda must do by hand
1. **Free ≥ 10 GB of disk** (e.g. empty Trash, clear Downloads, `docker system prune` once Docker is running).
2. Paste into `.env`: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, and the three `SANDBOX_*_EMAIL`s. Then run `npm run check-env`.
3. Run `npm run money-loop` and **approve three times in the browser** when it prints a link: as Sreenivas (send), as Sreenivas (void), as Manuel Lopes (return). Use the sandbox account passwords from developer.paypal.com → Testing Tools → Sandbox Accounts.
4. For webhooks: `brew install cloudflared`, run `npm run dev` and `cloudflared tunnel --url http://localhost:3000`, then `npm run register-webhook -- https://<the-trycloudflare-url>` and paste the printed `PAYPAL_WEBHOOK_ID` into `.env`.
5. Add `SONIOX_API_KEY` and `ANTHROPIC_API_KEY` (needed Day 2).
6. Install the APIMatic Context Plugin in your editor/Claude Code before Day 2 PayPal work.

## Next (Day 2 — Nov 5)
1. Run the live money loop (or switch to Invoicing if Payouts stays blocked > 90 min). Wire webhooks into the DB.
2. Generate `languages.json`. Do the Soniox speech spike with real Telugu/Spanish/Portuguese audio.
3. Extraction agent (strict zod schema + tests), read-back templates, and the Send screen UI.
