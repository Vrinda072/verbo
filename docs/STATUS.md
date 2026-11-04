# Status

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
