# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: the sender.** Someone with limited English who sends money person to person, by voice, in their own language.
Often older, often an immigrant paying family or friends abroad. Their job: pay the right person the right amount, and
understand what is about to happen before any money moves. The founding case: a grandfather who speaks only Telugu sent
money to a wrong number; the person on the other side spoke Hindi, nobody could talk to each other, and the money was
never recovered.

Secondary audiences, served after the sender:

- **The wrong recipient:** a stranger who received money by mistake, usually in another language, who should be able to
  understand the request and return it in one step.
- **The operator:** someone at PayPal reviewing recovery cases, deadlines and evidence on the Case Desk.

## Product Purpose

Verbo is a voice-first safety net for person-to-person payments. Money must not be lost to mishearing, mistyping,
mistranslation or a language barrier. Before money moves, Verbo checks the recipient and amount and reads the payment back in
the sender's own language. After a mistake, it makes returning the money easy for a recipient who speaks another language.

Success: the sender always knows, in their language, exactly who gets how much; risky payments are held and can be cancelled;
a mistaken payment can be recovered without anyone sharing a language.

## Positioning

**Language-proof money.** The words change between languages; the money doesn't. Name and amount are checked by code through
every translation, never decided by an AI, and a mistake can be recovered across a language barrier. Every design decision
leads with that.

Verbo is a working prototype of a feature PayPal could build into its own product, not a standalone app. It should feel built
into PayPal while being its own design.

## Operating Context

- **Send:** speak a payment (or type it, or pay a phone number) → Verbo extracts recipient and amount → code validates →
  a fixed template reads it back in the sender's language → the sender confirms → PayPal approval page opens in their language
  → the payment is authorized, held if risky (10 minutes, cancellable), then captured and paid out.
- **Follow-ups:** an incomplete request gets a spoken question from a fixed template; sound-alike names are chosen by saying
  "one" or "two".
- **Recovery:** the sender opens a case; the wrong recipient gets a signed, expiring link to a page in their language with a
  one-tap return and a translated two-way chat. Reminders wait for the recipient's daytime; escalation follows a deadline.
- **Case Desk:** operators work recovery cases, language pairs, deadlines and pre-send alerts, and export an evidence packet
  per case.
- Six read-back languages today: English, Hindi, Telugu, Spanish, Portuguese, Arabic (Arabic is right-to-left).
- Evaluated first in the PayPal AI Hackathon (deadline Nov 12, 2026, 12:00 PT) by judges and sponsors, through a hosted demo
  and a video under three minutes.

## Capabilities and Constraints

- **The AI never decides money.** It extracts into a strict schema; code validates; fixed per-language templates read back;
  the person confirms explicitly.
- **Sandbox only.** No real money moves. Every money-changing call carries an idempotency key.
- **Checks before sending:** sound-alike names in different languages, a phone number one digit off a contact's, amounts said
  as words (must be typed in digits), currency words, first-time recipient, unusual amount, pressure language. High risk means
  a hold.
- **English subtitles:** every line shown in another language has its English under it.
- Terminology: *read-back* (the fixed-template confirmation), *hold* (authorization not yet captured), *case* (a recovery),
  *Case Desk* (operator view), *simulated* (synthetic data).
- Sponsors in use: PayPal (APIMatic-generated Server SDK), AG Grid and AG Studio, Bryntum Scheduler Pro, Render, ElevenLabs.
- Open: whether native speakers will review the machine-written templates for Hindi, Telugu, Spanish, Portuguese and Arabic.

## Brand Commitments

- Name: **Verbo**.
- Copy is plain and neutral: no dramatic, punchy or story-style marketing lines.
- Feels native to PayPal, yet original: not generic and not a copy of PayPal's own design.
- Colour constraint stated by the owner: navy, light blue and white.
- One voice for read-aloud: ElevenLabs "River". No other voice options.

## Evidence on Hand

- Working flows: Send, Examples (`/demo`), recovery (`/recover/[token]`), Case Desk (`/desk`), payment status with the PayPal
  calls behind it.
- Synthetic data only: about 300 seeded cases and simulated contacts, each labelled "simulated" in the UI and the data.
- Evaluation numbers come only from Verbo's own scripted scenarios (`scripts/eval.ts`, `docs/eval.md`) and must say so.
- No real users, testimonials, partners, adoption figures or loss statistics exist. Do not invent them.

## Product Principles

1. Lead with the language: every surface shows that the name and amount survive translation.
2. Code checks the money; the AI only helps with words.
3. The person stays in control: read back, confirm, and be able to cancel.
4. Honest by default: sandbox, simulated and machine-translated are said plainly where they apply.
5. Recovery is for both sides: the stranger who got the money is treated as someone who wants to help.

## Accessibility & Inclusion

- Users may be older, have limited literacy in English, and be unfamiliar with apps: large type, high contrast (WCAG 2.1 AA at
  minimum), large touch targets, plain words.
- Full keyboard and screen-reader support; voice and typed input both work.
- Right-to-left layout for Arabic; scripts render in matching Noto fonts.
- Respect reduced motion.
