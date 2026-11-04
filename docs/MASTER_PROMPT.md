# VERBO — master brief (from Vrinda, Nov 4, 2026)

> Kept in the repo as the source of truth for goal, order of work and strategy. CLAUDE.md and PLAN.md hold details.

## What Verbo is
A voice-first safety net for person-to-person payments, in as many languages as the providers support.

**Problem.** People — especially older immigrants and people who do not read or speak English well — send money by
mistake or under pressure (wrong recipient, wrong amount, a scammer's urgency). Once a Friends & Family payment
completes, the practical answer is "ask the recipient to send it back", through a chat box in a language the other
person may not speak. Vrinda's grandfather, who speaks only Telugu, once sent money to a wrong number; the other side
spoke Hindi. Nobody could talk to each other, and the money was never recovered.

**Gap.** PayPal has AI scam alerts; F&F payments have no purchase protection and cannot be disputed; wrong-recipient
payments can be cancelled only while unclaimed. The unsolved gap is **recovery after a completed mistaken or pressured
payment, across a language barrier.** Verbo does not force refunds — it makes returning money effortless and produces a
trustworthy evidence packet.

## Four parts
1. **Send by voice.** STT → typed extraction `{recipient, amount, currency}` → code validation → fixed per-language
   read-back template with large digits → explicit confirmation. The LLM never decides money.
2. **Pre-send checks.** Similar recipient (Jaro-Winkler, edit distance, digit diff), unusual amount, first-time recipient,
   pressure-language classifier, country/language mismatch → low/medium/high. High = 10-minute risk hold
   (authorization uncaptured; VOID on cancel; capture + payout after the window).
3. **Recovery.** Case state machine (opened → link_sent → viewed → replied → returned | refused | escalated → closed,
   immutable events). Signed expiring link `app/recover/[token]`: auto language + picker, explanation, one-tap Return
   (recipient approves an Order; platform pays sender via Payout), two-way translated chat. Reminders 24h, escalation
   72h on a simulated clock.
4. **Case Desk (AG Grid / AG Studio).** Master/detail cases, translated timeline, quick actions, custom widgets
   (language tiles, case timeline, evidence meter), custom theme, ask-the-dashboard agent, pre-send alert grid,
   ~300 seeded synthetic cases labelled "simulated". Evidence packet per case: PDF + JSON + SHA-256.

**Language policy.** No hardcoded list; generate `lib/bridge/languages.json` from the provider. Tiers A (native-reviewed,
real audio tested), B (auto-verified, labelled machine-translated), C (text-assisted only). Automated template checks.
Never claim "any language"; show real counts per tier.

**Money flow (sandbox, platform-mediated).** Sender → Orders (AUTHORIZE) → platform business account → Payouts →
recipient. Return: wrong recipient approves an Order → platform → Payout to sender. Fallback if Payouts fails: Invoicing.

**Sandbox accounts (US, USD):** Business "Verbo Platform"; Sreenivas Rao (sender, Telugu), Manuel Lopez (intended,
_(Personas renamed on Nov 5 to match the sandbox accounts actually created: sender Sreenivas Rao, intended recipient Manuel Lopez, wrong recipient Manuel Lopes. Platform business account: Verbo.)_
Spanish), Manuel Lopes (wrong recipient, Portuguese).

## Hackathon
PayPal AI Hackathon (Devpost) "Build What's Next with PayPal and AI". Deadline Nov 12, 2026 12:00 PT. Must meaningfully
use PayPal and AI. Criteria (equal): Idea/Innovation, Potential Impact, Presentation, Design, Technological
Implementation. Submission: public repo + license, README, hosted demo, YouTube video < 3 min, written description.
Prize targets: Best Use of AG Grid (primary sponsor prize), Best Use of APIMatic, Render, Most Impactful, Best Demo
Delivery, Best Use of PayPal + AI. Skip Agentic Commerce, Bryntum, Channel3 unless nearly free.

## Rules for every piece of code
Never invent API signatures (cite source in a comment) · secrets only in `.env`, PII masked in logs · idempotency keys +
tests for every money call · strictly typed extraction, reject invalid · i18n keys, templates carry tier + reviewed
flags · synthetic seed data labelled "simulated" · sandbox only · no unverified statistics · accessibility (large type,
contrast, keyboard, screen reader, RTL) · small commits, main never broken.

## UI bar
One deliberate visual direction (calm, trustworthy, warm — not a generic dashboard), tokens everywhere. Send: huge mic,
live waveform, transcript, big-digit confirmation card, risk banner, hold countdown, searchable native-name language
picker. Recover: friendly, mobile-first, translated, one big Return button, chat below. Case Desk: custom AG theme,
widgets, timeline, evidence meter. Empty/loading/error states everywhere; restrained animation; mobile + desktop.

## Demo video (~2:40)
Story → Telugu send with similar-name warning and language-picker flip → mistake → recovery link → receiver opens it in
Portuguese and returns money → Case Desk + evidence packet → honest close.
