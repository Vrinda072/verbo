# Verbo — hackathon strategy (honest assessment)

_Written Nov 4, 2026. Sources checked that day:_
- _Official rules: <https://paypalaihackathon.devpost.com/rules> (read in a browser; Devpost blocks automated fetch)_
- _PayPal announcement: <https://developer.paypal.com/community/blog/PayPal_AI_Hackathon>_

## What the rules actually say (the parts that matter to us)

| Topic | Rule (summarised from the official rules) | What it means for Verbo |
|---|---|---|
| Deadline | Submission period ends **Thu Nov 12, 2026, 12:00 pm PT** | = Fri Nov 13, 00:00 Dubai. We aim to submit by Nov 12 afternoon Dubai time. |
| Core requirement | Build an app that integrates the PayPal developer platform (sandbox) with an AI tool; "PayPal integration is central" | PayPal must not look like a pipe. See risk #1. |
| Stage One | Pass/fail: fits the theme and "reasonably applies the required APIs/SDKs" | Easy pass if the money loop is real in the sandbox. |
| Stage Two criteria | **Equally weighted:** Technological Implementation · Design · Potential Impact · Innovation/Idea · Presentation | Tie-break order is the order listed — **Technological Implementation first**. |
| Judging method | "expert panels, peer review, automated AI-driven analysis, or any combination" | README + description must be explicit and structured per criterion. |
| Demo access | Hosted URL **or** complete run instructions; mockups / static prototypes do not qualify | We do both: Render URL + `MOCK=1` local run with no keys needed. |
| Repo | Public, open-source licence visible in the About section | MIT added; check the About sidebar shows it. |
| Video | **< 3 min**, public on YouTube, shows the project working, no copyrighted music | ~2:40 cut; royalty-free or no music. |
| Prize stacking | Max **one Grand Prize or one Honorable Mention, plus one Sponsor Prize** | Target one main-track prize + Best Use of AG Grid. |
| Judging dates | Dec 1–15; winners ~Dec 21 | Hosted demo and sandbox accounts must stay alive until Dec 15. |

### Prizes (from the rules' prize table)
- Grand: 1st $12,000 · 2nd $8,000 · 3rd $5,000
- Honorable Mentions, $5,000 each: Most Creative · **Most Impactful** · **Best Demo Delivery** · **Best Use of PayPal + AI** · Best Use of Agentic Commerce
- Sponsor: **AG Grid** 1st $5,000 / 2nd $2,000 / 3rd ×3 $1,000 · **APIMatic** ×3 $1,000 + 6-month business subscription · Bryntum ×3 $1,000 · Channel3 $1,500 · **Render** $1,000 / $750 / $500 _in Render credits_ (not cash)

Note: the sponsor prizes only say "Eligible Submissions that use any [sponsor] tools" — no extra published criteria. We infer judges will reward depth and visibility of use.

---

## (a) Is Verbo a good fit? Scored against each criterion

Scores are my estimate of where Verbo lands **if we deliver the Day 1–5 plan**, on a 1–5 scale. They are not predictions of judges.

| Criterion | Est. | Why | Where it is weak |
|---|---|---|---|
| **Technological Implementation** | 4 | Real sandbox loop using Orders (AUTHORIZE), authorization capture/void, Payouts, Webhooks with signature verification, idempotency keys, state machines with tests; AI for STT, strict-schema extraction, pressure classifier, translation. | Payouts and authorize/void are standard; judges may see "a lot of APIs" rather than depth. Payouts may need approval in sandbox (risk). |
| **Design** | 4 | Deliberate visual system, accessibility-first (Atkinson Hyperlegible, large digits, RTL), three distinct surfaces (send, recover, desk). | Three surfaces is a lot of UI to polish in 8 days; any one that looks unfinished drags this score. |
| **Potential Impact** | 4–5 | Specific audience (older, non-English-speaking senders), specific, real gap (post-payment recovery across a language barrier), and a personal story. | We cannot show real-world numbers. Must not invent statistics. Recovery still depends on the recipient's goodwill — be upfront. |
| **Innovation/Idea** | 4 | Voice payments and scam alerts exist; **recovery across languages with a translated, one-tap return flow + evidence packet** is not something I found in PayPal's product. | "Voice payments" alone is not novel; the pitch must lead with recovery, not voice. |
| **Presentation** | 3–4 | Strong story (grandfather, Telugu ↔ Hindi). | Multi-language live demo can fail on camera; a 3-min cap with four parts is tight. |

**Verdict on fit:** good. It uses PayPal for actual money movement (not a payment button bolted on), the AI is load-bearing but deliberately kept away from money decisions — a design choice we can sell — and it has a real human story.

---

## (b) How to win each target prize — concrete tasks

### Best Use of AG Grid (primary sponsor target — up to $5,000)
Prize stacking means this is the sponsor prize we pick. Make AG Grid unmissable:
1. Case Desk on AG Grid with **master/detail** (case → event timeline), row grouping by status/language, custom cell renderers (language tile, risk chip, evidence meter), status bar with aggregations.
2. **Custom AG theme** built with the Theming API from our tokens (same paper/ink palette) — show light and dark.
3. **AG Studio** (the sponsor's named tool) for the dashboard layer: widgets + "ask the dashboard" agent. _Task for Day 5 morning: read AG Studio docs and confirm what is available to us (licence, npm package, agent framework API). Do not plan around features we have not verified._
4. Pre-send alert grid (flagged attempts with reasons), integrated charts for cases by language/state.
5. README section **"How Verbo uses AG Grid"**: list each feature with a screenshot and file path.
6. Spend ~15–20 s of the video on the Desk.

### Most Impactful / Best Use of PayPal + AI / Best Demo Delivery (one main-track prize)
We can win at most one. **Most Impactful** is the best natural fit; Best Use of PayPal + AI is the fallback; Best Demo Delivery depends on video quality.
- Impact: lead the README and video with the problem and the audience; state plainly what PayPal does today (F&F not disputable; cancel only while unclaimed). No unverified numbers — eval numbers only from `scripts/eval.ts` scenarios, labelled as such.
- Get **2–3 consented user tests** (e.g. an older Telugu/Hindi speaker in the family) and quote what they said, with permission.
- PayPal + AI: show the AI is _constrained_: LLM → strict schema → code validation → fixed template. Show the risk hold implemented as an uncaptured authorization.
- Demo: script it, record segments separately, use the simulated clock, keep a recorded-audio fallback.

### Best Use of APIMatic (×3 $1,000)
Only one sponsor prize can be won, so this is a backup. The rules say "use any APIMatic tools".
- Install and actually use the **APIMatic Context Plugin** while writing the PayPal calls (Day 2 onward), and log concrete examples in `docs/guides/apimatic.md` (prompt, what it returned, what we changed).
- _Today:_ the plugin is not installed in this environment; Day 1 calls were verified directly against PayPal's OpenAPI specs instead. Install it before more PayPal code is written.

### Render (credits)
- Deploy web service + Render Postgres + a background worker (hold expiry, reminders, payout polling) via `render.yaml`. Cheap to do; worth doing even though only one sponsor prize can be won, because it gives us the hosted demo.

### Not pursued
Agentic Commerce (forcing it would weaken the story), Bryntum, Channel3.

---

## (c) Risks and mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| **PayPal looks like "just the pipe"** — judges see Stripe-replaceable plumbing. | Medium | Make PayPal primitives the product's safety mechanics: risk hold = uncaptured authorization with VOID; return = recipient-approved Order + Payout; webhooks drive the case timeline; evidence packet cites PayPal IDs. Add a **"How PayPal could adopt Verbo"** section (native "Return this payment" flow, F&F recovery link, evidence attached to the Resolution Center). |
| **Payouts blocked in the sandbox** | Medium | Day 1 test. If blocked > 90 min → Invoicing fallback (recipient pays an invoice). Already modelled as `INVOICE_FALLBACK` state. |
| **Flaky multi-language live demo** (STT misses Telugu numbers, latency, translation errors) | High | Pre-recorded audio clips fed through the same pipeline; fixed templates for read-back; record video in segments; never demo a language that has not been tested with real audio (Tier A). |
| **Scope overreach** — four parts + three UIs in 8 days, one developer | High | "Cut if behind" list in PLAN.md. Never cut: money loop, similar-name warning, recover page Return, Case Desk grid. |
| **Translation quality claims** | Medium | Tier labels (A/B/C) visible in UI; only Tier A shown in the demo; "machine-translated" label on Tier B. |
| **Over-claiming** (forcing refunds, stats) | Low if disciplined | Copy review before submission: no refund promises, no unverified numbers. |
| **Machine constraints** — the dev Mac had **~1 GB free disk** on Day 1; Docker not running | High | Use embedded PGlite instead of Docker; free disk space before adding AG Grid/PDF libraries. |
| Judges can't run it | Low | `MOCK=1` runs with zero keys; hosted Render demo; sandbox test accounts documented in README (the rules allow including sandbox logins). |

---

## (d) Honest verdict on winning chances

- **Best Use of AG Grid:** the most realistic win. Sponsor prizes draw fewer, shallower entries, and there are 5 places. With a genuinely deep Case Desk I'd put a placing (1st–3rd) as **plausible, maybe 25–40%** — a judgement, not data.
- **One Honorable Mention (Most Impactful most likely):** **possible but uncertain, ~10–20%**. The story is strong; it depends on the video and on looking finished.
- **Grand Prize:** **unlikely (< 10%)**. These usually go to highly polished, technically surprising entries; a solo 8-day build on a laptop with no disk space is a real handicap.
- **What is weakest today:** nothing user-facing exists yet beyond the landing page; the language pipeline is unproven (no Soniox key yet); the PayPal loop has not run live; AG Studio capabilities are unverified.
- **What would move the odds most:** (1) a flawless 2:40 video with the Telugu → Portuguese recovery moment, (2) a Case Desk that clearly shows off AG Grid, (3) a real consented user test.

## How PayPal could adopt Verbo (draft for README/slide)
1. **"Send it back" button for F&F recipients** — the recover page as a native PayPal flow, translated to the recipient's locale.
2. **Voice confirmation with fixed templates** in the PayPal app for accessibility users.
3. **Risk hold for P2P** using the existing authorize/capture primitives — a 10-minute cooling-off period for high-risk sends.
4. **Evidence packet** attached to Resolution Center cases, so support agents get a translated, hashed record.
