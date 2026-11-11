---
name: Verbo
description: Voice payments on PayPal, read back in your own language, with the checked amount fixed beside every translation.
colors:
  account-navy: "#071a4d"
  navy-raised: "#12307a"
  signal-blue: "#8fd3ff"
  paypal-action-blue: "#0b5cd6"
  action-blue-wash: "#e7f0fc"
  sky-wash: "#eaf3fe"
  ink: "#071a4d"
  ink-secondary: "#34476b"
  ink-tertiary: "#4d6189"
  placeholder: "#5f7096"
  paper: "#f4f7fc"
  paper-deep: "#eaf1fa"
  card-white: "#ffffff"
  hairline: "#dce6f5"
  hairline-strong: "#c3d2ea"
  safe-green: "#0d7a48"
  safe-green-wash: "#e4f5ec"
  attention-amber: "#a85300"
  attention-amber-ink: "#6b3a00"
  attention-amber-wash: "#fff4e0"
  danger-red: "#c4261d"
  danger-red-wash: "#fdecea"
  letter-mark-on-navy: "#f2a93b"
typography:
  display:
    fontFamily: "Noto Sans Display, Noto Sans Devanagari, Noto Sans Telugu, Noto Sans Arabic, system-ui, sans-serif"
    fontSize: "3.75rem"
    fontWeight: 700
    lineHeight: 1.02
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Noto Sans Display, Noto Sans Devanagari, Noto Sans Telugu, Noto Sans Arabic, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Noto Sans, Noto Sans Devanagari, Noto Sans Telugu, Noto Sans Arabic, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: "Noto Sans, Noto Sans Devanagari, Noto Sans Telugu, Noto Sans Arabic, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Noto Sans, Noto Sans Devanagari, Noto Sans Telugu, Noto Sans Arabic, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.4
  amount-digits:
    fontFamily: "Noto Sans Display, system-ui, sans-serif"
    fontSize: "3.75rem"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "-0.035em"
    fontFeature: "\"tnum\", \"lnum\""
rounded:
  hairline: "6px"
  soft: "12px"
  card: "20px"
  stage: "28px"
  pill: "9999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.paypal-action-blue}"
    textColor: "{colors.card-white}"
    rounded: "{rounded.pill}"
    padding: "12px 28px"
    height: "56px"
  button-navy:
    backgroundColor: "{colors.account-navy}"
    textColor: "{colors.card-white}"
    rounded: "{rounded.pill}"
    padding: "12px 24px"
    height: "48px"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.paypal-action-blue}"
    rounded: "{rounded.pill}"
    padding: "12px 24px"
    height: "48px"
  button-quiet-hover:
    backgroundColor: "{colors.action-blue-wash}"
  button-danger:
    backgroundColor: "{colors.danger-red}"
    textColor: "{colors.card-white}"
    rounded: "{rounded.pill}"
    padding: "12px 32px"
    height: "64px"
  card:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "24px"
  input:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.soft}"
    padding: "0 16px"
    height: "48px"
  notice-attention:
    backgroundColor: "{colors.attention-amber-wash}"
    textColor: "{colors.attention-amber-ink}"
    rounded: "{rounded.soft}"
    padding: "16px"
  notice-info:
    backgroundColor: "{colors.sky-wash}"
    textColor: "{colors.ink}"
    rounded: "{rounded.soft}"
    padding: "16px"
  chip-checked:
    backgroundColor: "{colors.safe-green-wash}"
    textColor: "{colors.safe-green}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  readback-stage:
    backgroundColor: "{colors.account-navy}"
    textColor: "{colors.card-white}"
    rounded: "{rounded.stage}"
    padding: "36px"
  nav-bar:
    backgroundColor: "{colors.account-navy}"
    textColor: "{colors.card-white}"
    height: "64px"
---

# Design System: Verbo

## Overview

**Creative North Star: "The Bilingual Receipt"**

Every screen in Verbo is a receipt said twice: once in the reader's language and once in English, with the checked value standing still beside both. The words move between scripts (Devanagari, Telugu, Arabic, Latin); the name and the amount do not. The visual system exists to make that difference obvious: language is set large and human, money is set in fixed tabular digits, and a single letter or digit that differs is marked so it cannot be missed.

The mood is calm, exact and warm. Calm because many senders are older and unhurried, and nothing should feel urgent unless it is. Exact wherever money appears: tabular figures, the amount isolated in left-to-right order even inside Arabic, the currency written out. Warm toward both sides of a mistake, including the stranger who received money they should not have. The surfaces sit close to PayPal's account world (navy bar, white cards on pale blue paper, a single action blue) without copying it.

Density is low on the sender and recipient screens: one task per card, large type, generous space. The operator Case Desk is denser and tabular, but uses the same palette, type and corners.

**Key Characteristics:**
- Navy account bar and navy "stage" panels; white cards on pale blue-grey paper.
- One action blue for the thing to do next; green only for "checked / safe"; amber for "look again"; red for cancel and danger.
- Every non-English line carries an English subtitle in a smaller, quieter style beneath it.
- Amounts in large tabular digits; differing letters and digits marked, never just described.
- Pill-shaped buttons, softly rounded cards, hairline shadows.

## Colors

A restrained navy-and-blue account palette on cool paper, with three semantic colours that each mean exactly one thing.

### Primary
- **Account Navy** (account-navy): the top navigation bar, the read-back "stage" panels, the example-story panels, and primary text. It is the colour of being inside one's own account.
- **PayPal Action Blue** (paypal-action-blue): the single next action on a screen (Confirm, Send it back, Pay instead), links, focus rings and the text caret.

### Secondary
- **Signal Blue** (signal-blue): light blue used only on navy, for the active navigation underline, the logo disc, highlighted amounts on the stage, and text selection.
- **Navy Raised** (navy-raised): buttons and chips that sit on a navy surface.

### Tertiary
- **Safe Green** (safe-green) on its wash: "Numbers checked", "Paid before", completed returns. Never decorative.
- **Attention Amber** (attention-amber, attention-amber-ink) on its wash: look-alike names, a number one digit off, pressure language, first payments. Amber means "read this before you continue".
- **Danger Red** (danger-red) on its wash: cancel, hold-and-cancel, "send anyway" and errors.
- **Letter Mark on Navy** (letter-mark-on-navy): the one differing letter shown on a navy panel (Lope**s**, se**t**enta). Used for nothing else.

### Neutral
- **Ink** (ink), **Ink Secondary** (ink-secondary), **Ink Tertiary** (ink-tertiary): the three text weights. Ink Tertiary is the darkest grey that still passes 4.5:1 on paper and is the colour of every English subtitle.
- **Placeholder** (placeholder): input placeholders, set to pass 4.5:1 on white.
- **Paper** (paper) and **Paper Deep** (paper-deep): the page ground and inset panels.
- **Card White** (card-white): cards, inputs, chat bubbles from the other person.
- **Hairline** (hairline) and **Hairline Strong** (hairline-strong): borders, table rules and the scrollbar thumb.

### Named Rules
**The One Meaning Rule.** Green means checked, amber means look again, red means stop or cancel. A semantic colour is never used for decoration or branding.

**The One Action Rule.** Each screen has at most one filled Action Blue button. Everything else is a quiet button, a link or a navy secondary.

## Typography

**Display Font:** Noto Sans Display (600, 700), falling back through Noto Sans Devanagari, Telugu and Arabic.
**Body Font:** Noto Sans, with the same script fallbacks.

**Character:** One family across every script, so a Hindi read-back and its English subtitle look like the same voice. The display cut is tight and confident for headings; the text cut is open and readable at large sizes for older eyes.

### Hierarchy
- **Display** (700, 3rem to 3.75rem, line-height 1.02, tracking -0.025em): page headings on Home and Examples only. Headings wrap balanced.
- **Headline** (700, 2rem to 2.5rem): section headings such as "People you can pay" and the hold and near-miss titles.
- **Title** (600, 1.25rem to 1.5rem): card titles and the read-back sentence itself, which is set large (1.25rem on cards, up to 2.25rem on the navy stage).
- **Body** (400, 1.0625rem, line-height 1.55): all running text, kept under about 65 characters per line; paragraphs wrap "pretty".
- **Label** (400, 0.875rem, line-height 1.4): field labels, captions and English subtitles.
- **Amount Digits** (500, 3.75rem, tabular lining figures, tracking -0.035em): the big amount on confirmation, hold and recovery screens; cents drop to Ink Tertiary.

### Named Rules
**The Subtitle Rule.** A line in another language is followed by its English in Label size, Ink Tertiary, left-to-right, aligned to the line above it (right-aligned under Arabic). On navy or filled buttons the subtitle inherits the text colour at 85% opacity.

**The Fixed Digits Rule.** Amounts are always tabular figures and always isolated left-to-right inside right-to-left text, with any direction marks stripped.

## Layout

Content sits in a centred column: about 36rem for single-task screens (confirmation, recovery, payment status), about 72rem (max-w-6xl) for Home, Send and the Case Desk. Send uses two columns on wide screens (task on the left, "Try these" on the right) and stacks below 1024px. The recovery page is mobile-first and single-column at every width.

Spacing follows a 4px base with 8, 12, 16, 24 and 32px steps in regular use: 16px inside notices, 24px inside cards (32px on large cards), 24 to 40px between sections, and more space above a heading than below it. Touch targets are at least 48px tall; primary actions are 56 to 64px.

Tables (AG Grid, AG Studio, Bryntum) fill the content width and own their own density; Verbo's theme carries the palette and type into them.

## Elevation & Depth

Flat paper with a light lift. The page is pale paper; cards are white with a near-invisible hairline shadow; the one main card on a screen (confirmation, recovery, near-miss) gets a softer, longer lifted shadow. Navy panels carry no shadow: their tone is their depth. Cards never sit inside other cards; nested content uses inset paper panels or dividers instead.

### Shadow Vocabulary
- **Hairline lift** (`box-shadow: 0 1px 2px rgb(0 28 100 / 0.05)`): every ordinary card and the primary button.
- **Main card lift** (`box-shadow: 0 1px 2px rgb(0 28 100 / 0.04), 0 12px 32px -16px rgb(0 28 100 / 0.18)`): the single most important card on a screen.

### Named Rules
**The No Nesting Rule.** A card never contains another card. Group inside a card with paper-tinted insets, spacing and hairlines.

## Shapes

Gently rounded throughout. Inputs, notices and inset panels use soft 12px corners; cards use 20px; the large navy stage panels use 28 to 32px. Every button, chip and tag is a full pill. The phone mockups on Examples use a 36px corner with a 6px navy frame. Borders are hairlines (1px) except input outlines (2px, turning Action Blue on focus) and the 3px underline marking an active nav item or a highlighted amount.

## Components

### Buttons
- **Shape:** full pill (rounded.pill).
- **Primary:** Action Blue fill, white text, semibold, 56px tall for the main action of a screen, with the hairline lift. Hover dims to 90% opacity; disabled drops to 50 to 60%.
- **Navy secondary:** Account Navy fill, used for "Check" and other non-final actions next to forms.
- **Quiet:** no fill, Action Blue text; hover adds the Action Blue wash. Used for Edit and "Pay X instead" alternatives.
- **Danger:** Danger Red fill (cancel during a hold) or red text on no fill with a red wash on hover (Cancel, "Send anyway").
- **Focus:** 3px Action Blue outline, 3px offset, on every interactive element.
- **Bilingual label:** a button in another language carries its English subtitle on a second line inside the button.

### Chips
- **Style:** small pills on a wash with the semantic colour as text: "Numbers checked" (green), "Paid before" / "Never paid", "Sandbox" (navy-raised on navy), sponsor and SDK tags in the PayPal call list (navy for APIMatic SDK, paper for REST, sky wash for idempotency keys).

### Cards / Containers
- **Corner Style:** 20px.
- **Background:** Card White on Paper.
- **Shadow Strategy:** hairline lift; main card lift for the single primary card.
- **Border:** none, or a 1px hairline for list cards and the collapsible PayPal call list.
- **Internal Padding:** 24px, 32px on large screens.

### Inputs / Fields
- **Style:** white field, 2px hairline outline, 12px corners (fully rounded for single-line chat and amount fields), 48px tall, large text (1.125rem) with tabular figures for numbers.
- **Focus:** outline turns Action Blue; caret is Action Blue.
- **Error:** a red message directly below in plain words ("That doesn't match the amount above.").

### Navigation
- **Style:** a navy bar 64px tall with the logo (signal-blue disc with a navy V), text links in white at 75% opacity, and the active page in full white with a 3px Signal Blue underline. Operator links are set apart by a thin divider and a small "Operators" label. A "Sandbox" pill and the simulated account's initials sit on the right. On narrow screens the links scroll horizontally.

### Notices
- **Style:** a soft-cornered wash panel (amber for attention, sky for information) with a small white disc holding "!" or "i", the message in the reader's language in medium weight, and its English subtitle below.

### Read-back Stage (signature)
- The navy panel that states a payment in one language at a time: the sentence set large in white, the amount on a Signal Blue highlight, its English subtitle beneath, then a row of checked facts (amount, recipient with the differing letter marked, the language PayPal opens in) and a white pill confirm button. It is the visual proof of "the words change, the money doesn't".

### Digit Diff (signature)
- Two phone numbers or names set one above the other in tabular figures, with each differing character on an amber wash with a 2px amber underline, so the eye lands on the one digit or letter that changes who gets the money.

## Do's and Don'ts

### Do:
- **Do** give every non-English line an English subtitle in Label size and Ink Tertiary, aligned to the line above it.
- **Do** set amounts in tabular digits and isolate them left-to-right inside right-to-left text.
- **Do** mark the exact differing letter or digit (amber wash and underline, or Letter Mark on Navy) whenever two names or numbers could be confused.
- **Do** keep one filled Action Blue button per screen and make it at least 56px tall.
- **Do** use the `--v-*` tokens (and their Tailwind aliases) for every colour, radius and shadow.
- **Do** label simulated people, cases and data as simulated where they appear.

### Don't:
- **Don't** use green, amber or red for anything other than checked, look again, and stop or cancel.
- **Don't** put a card inside a card.
- **Don't** add hex values in components; add a token instead.
- **Don't** fade text with opacity to show an inactive state; use greyscale or a lighter surface so text keeps 4.5:1 contrast.
- **Don't** put a small label or eyebrow above a heading; fold that information into the line below it.
- **Don't** use dramatic, punchy or story-style copy; keep wording plain and neutral.
