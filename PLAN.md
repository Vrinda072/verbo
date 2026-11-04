# PLAN.md — Verbo build plan (Nov 4 → Nov 12, 2026)

Submission target: **Nov 12 daytime** (hard deadline Nov 12 12:00 PT = Nov 13 00:00 Dubai).

## Day 1 — Nov 4: foundations + money loop
- [x] Public MIT repo, scaffold, env files, `check-env`
- [x] PayPal client (interface, real, mock), money state machine with tests
- [x] `scripts/money-loop.ts`: Order(AUTHORIZE) → sender approves → authorize → capture → Payout; void path; return path
- [x] Webhook endpoint with signature verification; `scripts/register-webhook.ts`
- [ ] Run money loop live (needs sandbox keys in `.env`)
- [ ] `languages.json` + `docs/language-coverage.md` (needs SONIOX_API_KEY)
- [ ] AG Studio starter in `app/desk`
- [x] `docs/STRATEGY.md`, `docs/STATUS.md`

## Day 2 — Nov 5: voice send + Language Bridge
- Soniox streaming STT in browser (temporary key minted server-side), speech spike script
- Extraction agent: LLM → zod `{recipient, amount, currency}`; reject on validation failure; tests
- Read-back templates per language with tier/reviewed flags; `gen-templates.ts`, `verify-templates.ts`
  (placeholders intact, numerals unchanged, back-translation keeps confirm/cancel meaning, RTL renders)
- Send screen UI: mic, waveform, transcript, big-digit confirmation card, native-name language picker

## Day 3 — Nov 6: pre-send checks + risk hold
- Similar recipient (Jaro-Winkler, edit distance, digit diff), unusual amount, first-time recipient,
  pressure-language classifier (LLM), country/language mismatch → low/medium/high
- High → 10-minute hold: authorization left uncaptured, countdown UI, VOID on cancel, capture+payout at expiry
- `scripts/eval.ts` over 50 scripted scenarios → `docs/eval.md`

## Day 4 — Nov 7: recovery
- Cases state machine (opened → link_sent → viewed → replied → returned | refused | escalated → closed), immutable events
- Signed expiring token links, `app/recover/[token]` (auto language + picker, explanation, one-tap Return, translated chat)
- Return = wrong recipient approves Order (CAPTURE) → platform → Payout to sender
- Simulated clock (reminder 24h, escalation 72h), `scripts/e2e-recovery.ts`

## Day 5 — Nov 8: Case Desk + evidence
- AG Grid/AG Studio: master/detail cases, translated timeline, quick actions, custom widgets
  (language tiles, case timeline, evidence meter), custom brand theme, ask-the-dashboard agent, pre-send alert grid
- ~300 seeded synthetic cases labelled "simulated"
- Evidence packet: PDF + JSON + SHA-256, golden-file test

## Nov 9–12: polish & ship
- UI polish (empty/loading/error states), Render deploy (web + Postgres + worker), README by judging criterion,
  native-speaker review (Telugu, Spanish, Portuguese, Hindi), consented user tests, ~2:40 demo video, Devpost submission.

## Cut if behind (in this order)
1. Disputes API evidence upload → keep evidence packet as download only
2. Ask-the-dashboard agent → canned queries
3. Two-way chat → one-way translated message + reply
4. Pressure-language classifier → keyword heuristic
5. Live STT in demo → recorded audio clip through same pipeline
Never cut: money loop, similar-name warning, recover page Return button, Case Desk grid, honesty labels.
