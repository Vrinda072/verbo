# Status

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
