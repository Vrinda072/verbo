# Status

## Nov 6 — microphone rebuilt after real failures

Vrinda reported the mic wouldn't connect, stopped mid-sentence and missed words.
- **Her Mac's mic was delivering no audio.** In her Chrome, with permission granted: 0 bytes from a 3-second recording,
  and all-zero samples. `new AudioContext()` froze the page for 10 s, and reopening the mic took about 9 s. Input volume
  was 54. It worked earlier the same day, so this looks like macOS audio or privacy rather than hardware, but the exact
  cause is not established. **She needs to fix this on the Mac; no code can.**
- **New default when `GROQ_API_KEY` is set:** record until the person taps stop (90 s cap), then Whisper on Groq writes it
  down. Chrome's recognition can end by itself; this can't. Without the key the app stays on Chrome's recognition.
- **No audio meter while recording:** the live waveform is gone from this path because creating it caused the freeze.
- **Clear errors:** a silent mic, blocked access, a missing or busy mic, and a slow start each say what to do.
- **Gemini's audio models rejected for speech** (tested with synthetic audio): `gemini-3.5-transcribe` mostly answered
  503, allows 3 requests a minute, and the one answer it gave invented a sentence about noodles; `gemini-3.5-flash-lite`
  invented words too; 3.7 and 3.8 flash timed out or hit 20 a day. Gemini still does understanding and translation.
- **Tested in her Chrome:** connects in about 0.15 s with a 57 ms longest pause (was 10 s); dead-mic message at about 3 s;
  a synthetic tone with a 5 s gap kept recording until tapped and uploaded a WebM file; tapping again after an error works.
- **Real Whisper run (`whisper-large-v3-turbo`, 10 synthetic Mac-voice recordings with a 3 s pause; our own test, not an
  accuracy measure):** all of the audio was attempted in about 0.5 s each. Results through the app: 8 languages (en, hi,
  es, pt, ar, de, ja, ko) reached the right amount and a name choice; French misheard the name and offered buttons;
  Chinese came back garbled and was refused. No sentence ended on a wrong person. Telugu has not been tried, because the
  Mac has no Telugu voice. Response headers report a limit of 2,000 requests.
- **Spelling hints removed:** passing contact names to Whisper made it write Latin names into other scripts and invent
  names in Chinese.
- **Speech never chooses between sound-alikes:** "Lopez" was heard as "Lopes" even without the hint. A name from the mic
  with a sound-alike contact now makes the person tap one. A name that can't be matched, in any language, offers
  buttons. Tested on the real page with a tone and a fixed transcript: buttons, card and safety hold all appear.
- **Her mic:** a Mac restart fixed it. The macOS audio system had been logging repeated errors starting mic input, and they
  stopped after the restart. Afterwards a 3-second recording held 47,639 bytes of real sound.
- **Real voice:** Vrinda reports it's working (Nov 6). The server log shows three recordings transcribed and understood
  (`/api/stt/transcribe` about 0.5–0.7 s, `/api/understand` 1.7–5.9 s). Language and exact sentences not recorded, so
  this doesn't confirm any specific language. Sending money after that step wasn't part of this check.
- **To do by hand:** the Groq key was pasted in chat too, so rotate it before submission.
- **"All languages" can't be claimed.** The picker has 60 languages, all tier B. Six have written read-backs (en plus
  machine-translated te, hi, es, pt, ar), none reviewed by a native speaker; the other 54 read back in English.

## Nov 6 — real Gemini run

- **Free quota is the main constraint.** The API reported 20 requests a day on `gemini-3.6-flash`; `gemini-3.5-flash`
  draws on that same quota. `gemini-3.5-flash-lite` took well over 100 requests today without a limit error, but its
  actual limit is unknown. 3.7 and 3.8 flash answered 503 (high demand) when tried; 2.5 models are closed to new users.
- **Default order:** `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`, `gemini-3.6-flash`. A model at quota is skipped
  until its stated retry time, identical requests reuse the answer, and when all are out the rules parser and MyMemory
  take over without a network call. Answers are kept in memory only.
- **Eval on `gemini-3.5-flash-lite`:** 51/57 on the first full run, 57/57 after fixes, guards 11/11, offline parser
  57/57 (`docs/eval-gemini.md`, `docs/eval.md`). These are our own scripted scenarios, and the fixes were made against
  six of them, so 57/57 is not a first-attempt score or a measure of real-world accuracy.
  An earlier partial run on `gemini-3.6-flash` got through 19 scenarios, all passing, before its quota ran out.
- **Money errors the run exposed, now blocked in code:** 500 rupees accepted as $500 when the model left currency empty;
  one amount picked from "20, no wait 200". Both are also guard scenarios.
- **Also fixed:** Lopes/Lopez resolved by the sound of what was said when romanisation blurred them; number words a model
  declines are filled in by code and still need typing; "currency assumed" now depends on the words said, not the model.
- **Tested in the running app (mock PayPal, typed or scripted text):** understanding in en/hi/te through `/api/understand`;
  send → ask back → recovery chat with Gemini translating hi→pt and pt→en. 119 tests pass.
- **Not tested:** real microphone with Gemini, the screens by eye in this session (Browser pane was hidden), and the
  real PayPal sandbox through the app.
- **To do by hand:** the Gemini key was pasted in chat, so rotate it before submission along with the PayPal and Soniox keys.

## Nov 6 — Gemini for the AI requirement

- Added Gemini (superseded above: model order and test results) for understanding speech and translating messages.
  It only fills fields or translates; code validation still decides money, and invented amounts are rejected.
- AI no longer depends on `MOCK`, which now only controls PayPal.
- If Gemini fails (quota, network, bad answer), the rules parser and MyMemory take over and the card says so.
- **Tested with a stand-in client only (107 tests).** Not yet run against real Gemini: needs `GEMINI_API_KEY` in `.env`.
  Then run `npm run eval -- --extractor=gemini`, which writes `docs/eval-gemini.md`.
- Free-tier content is used to improve Google's products; the Send page says so. Exact free limits aren't published in
  the docs (they're shown in AI Studio), so the eval is paced at 7 s per request.

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
- **Retest (Nov 6):** Vrinda reports that in Hindi in Chrome the transcript words were right and the flow worked. Telugu
  by real voice is still unconfirmed.
- **Limit:** Chrome's own recognition quality is outside Verbo's control. Options if it proves poor elsewhere: Gemini free tier (includes a transcription model; free-tier content is used to improve
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
