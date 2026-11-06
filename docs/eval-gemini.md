# Evaluation — scripted scenarios

**What this is:** 68 scenarios written by the Verbo team (`evals/scenarios.ts`),
run by `npm run eval` on 2026-11-06. They check that Verbo behaves the way we intended on cases we chose.
**What this is not:** a measure of real-world accuracy. No real users, no real voice audio, no fraud data.

Extractor: **Gemini (`gemini-3.5-flash-lite`)**.

**Caveats.** The rule-based parser and these scenarios were written by the same team at the same time, so a high
score on the offline run mainly shows the parts are consistent with each other. Risk expectations follow the
documented weights in `lib/risk/score.ts`; three expectations were corrected after the first run (Nov 5) because they
contradicted those weights; two more changed on Nov 6 when the parser learned number words and name matching. Also on Nov 6, after the first Gemini run, `en-unknown` began accepting `recipient_not_found` as well as `missing_recipient` (both refuse), and code was fixed for the other five failures that run found, so this is not a first-attempt score. The offline run and the AI runs are reported separately. Real recorded speech is not covered here.

## Pipeline (transcript → extraction → code validation → risk)
**57/57** scenarios run matched the expected recipient, amount and risk level (or the expected refusal).

| Scenario | Tags | Expected | Got | |
|---|---|---|---|---|
| en-lopez | happy | c_lopez · 1234¢ · low | c_lopez · 1234¢ · low | ✅ |
| en-kiran | happy | c_kiran · 2500¢ · low | c_kiran · 2500¢ · low | ✅ |
| en-lakshmi | happy | c_lakshmi · 4000¢ · low | c_lakshmi · 4000¢ · low | ✅ |
| te-lopez | happy, native-script | c_lopez · 1234¢ · low | c_lopez · 1234¢ · low | ✅ |
| te-lopez-digits | happy, native-digits | c_lopez · 2000¢ · low | c_lopez · 2000¢ · low | ✅ |
| te-lakshmi | happy, native-script | c_lakshmi · 5000¢ · low | c_lakshmi · 5000¢ · low | ✅ |
| te-kiran | happy, native-script | c_kiran · 3000¢ · low | c_kiran · 3000¢ · low | ✅ |
| hi-lopez | happy, native-script | c_lopez · 2500¢ · low | c_lopez · 2500¢ · low | ✅ |
| hi-lopez-digits | happy, native-digits | c_lopez · 2000¢ · low | c_lopez · 2000¢ · low | ✅ |
| es-lopez | happy | c_lopez · 2000¢ · low | c_lopez · 2000¢ · low | ✅ |
| es-lopez-comma | happy, decimal-comma | c_lopez · 1234¢ · low | c_lopez · 1234¢ · low | ✅ |
| pt-kiran | happy | c_kiran · 2500¢ · low | c_kiran · 2500¢ · low | ✅ |
| ar-lopez | happy, rtl | c_lopez · 3000¢ · low | c_lopez · 3000¢ · low | ✅ |
| ar-lopez-digits | happy, rtl, native-digits | c_lopez · 3000¢ · low | c_lopez · 3000¢ · low | ✅ |
| en-thousands | unusual | c_kiran · 100000¢ · medium | c_kiran · 100000¢ · medium | ✅ |
| en-lopes | look-alike | c_lopes · 1234¢ · high | c_lopes · 1234¢ · high | ✅ |
| te-lopes | look-alike, native-script | c_lopes · 1234¢ · high | c_lopes · 1234¢ · high | ✅ |
| hi-lopes | look-alike, native-script | c_lopes · 2500¢ · high | c_lopes · 2500¢ · high | ✅ |
| ar-lopes | look-alike, rtl | c_lopes · 3000¢ · high | c_lopes · 3000¢ · high | ✅ |
| pt-lopes-same-language | look-alike, same-language | c_lopes · 1500¢ · high | c_lopes · 1500¢ · high | ✅ |
| en-pressure-police | pressure | c_kiran · 30000¢ · high | c_kiran · 30000¢ · high | ✅ |
| en-pressure-secret | pressure | c_lakshmi · 6000¢ · medium | c_lakshmi · 6000¢ · medium | ✅ |
| en-pressure-giftcard | pressure, first-time | c_ana · 20000¢ · high | c_ana · 20000¢ · high | ✅ |
| te-pressure | pressure, native-script | c_kiran · 4000¢ · medium | c_kiran · 4000¢ · medium | ✅ |
| es-pressure | pressure | c_kiran · 50000¢ · high | c_kiran · 50000¢ · high | ✅ |
| hi-pressure | pressure, native-script | c_kiran · 4000¢ · medium | c_kiran · 4000¢ · medium | ✅ |
| ar-pressure | pressure, look-alike, rtl | c_lopez · 5000¢ · high | c_lopez · 5000¢ · high | ✅ |
| en-taxi-not-pressure | false-positive-check | c_kiran · 2500¢ · low | c_kiran · 2500¢ · low | ✅ |
| en-unusual-lakshmi | unusual | c_lakshmi · 50000¢ · medium | c_lakshmi · 50000¢ · medium | ✅ |
| en-unusual-first | unusual, first-time | c_ana · 90000¢ · high | c_ana · 90000¢ · high | ✅ |
| en-normal-high-ish | under-floor | c_lakshmi · 9000¢ · low | c_lakshmi · 9000¢ · low | ✅ |
| pt-ana | first-time, same-language | c_ana · 2000¢ · low | c_ana · 2000¢ · low | ✅ |
| te-ana | first-time, mixed-script | c_ana · 2000¢ · medium | c_ana · 2000¢ · medium | ✅ |
| en-euros | currency | ✘ currency_unsupported | ✘ currency_unsupported | ✅ |
| en-rupees | currency | ✘ currency_unsupported | ✘ currency_unsupported | ✅ |
| en-unknown | unknown | ✘ missing_recipient or recipient_not_found | ✘ recipient_not_found | ✅ |
| en-bare-manuel | ambiguous | ✘ recipient_ambiguous | ✘ recipient_ambiguous | ✅ |
| en-no-amount | missing | ✘ missing_amount | ✘ missing_amount | ✅ |
| en-too-much | limit | ✘ amount_out_of_range | ✘ amount_out_of_range | ✅ |
| en-weather | off-topic | ✘ not_a_payment | ✘ not_a_payment, missing_recipient, missing_amount | ✅ |
| en-words-only | words | c_lopez · 2000¢ · low | c_lopez · 2000¢ · low | ✅ |
| es-words | words | c_lopez · 2000¢ · low | c_lopez · 2000¢ · low | ✅ |
| te-words | words, native-script | c_lopez · 2500¢ · low | c_lopez · 2500¢ · low | ✅ |
| hi-words-do | words, native-script | c_lopez · 2000¢ · low | c_lopez · 2000¢ · low | ✅ |
| te-spelling | speech-spelling | c_lopez · 2000¢ · low | c_lopez · 2000¢ · low | ✅ |
| en-dollars-cents | speech-format | c_lopez · 1234¢ · low | c_lopez · 1234¢ · low | ✅ |
| en-two-amounts | ambiguous | ✘ missing_amount | ✘ missing_amount | ✅ |
| hi-no-nukta | speech-spelling, native-script | c_lopez · 2500¢ · low | c_lopez · 2500¢ · low | ✅ |
| hi-spelling | speech-spelling, native-script | c_lopez · 2500¢ · low | c_lopez · 2500¢ · low | ✅ |
| hi-lopes-spelling | speech-spelling, look-alike | c_lopes · 2500¢ · high | c_lopes · 2500¢ · high | ✅ |
| hi-first-name | native-script | c_kiran · 3000¢ · low | c_kiran · 3000¢ · low | ✅ |
| hi-full-name-sound | native-script | c_lakshmi · 4000¢ · low | c_lakshmi · 4000¢ · low | ✅ |
| hi-words-lakshmi | words, native-script | c_lakshmi · 5000¢ · low | c_lakshmi · 5000¢ · low | ✅ |
| hi-bare-manuel | ambiguous | ✘ recipient_ambiguous | ✘ recipient_ambiguous | ✅ |
| hi-karna-not-kiran | false-positive-check | ✘ missing_recipient | ✘ not_a_payment, missing_recipient | ✅ |
| te-sound | native-script | c_lakshmi · 4000¢ · low | c_lakshmi · 4000¢ · low | ✅ |
| hi-rupees | currency, native-script | ✘ currency_unsupported | ✘ currency_unsupported | ✅ |

## Guards (deliberately wrong model output → code validation)
These feed a wrong extraction straight into validation to check that code — not the model — decides money.
**11/11** wrong outputs were caught.

| Scenario | Tags | Expected | Got | |
|---|---|---|---|---|
| g-rupees-silent | conversion, seen-live | ✘ currency_unsupported | ✘ currency_unsupported | ✅ |
| g-picks-one-of-two | ambiguous, seen-live | ✘ missing_amount | ✘ missing_amount | ✅ |
| g-inflated | hallucination | ✘ amount_not_in_transcript | ✘ amount_not_in_transcript | ✅ |
| g-extra-zero | hallucination | ✘ amount_not_in_transcript | ✘ amount_not_in_transcript | ✅ |
| g-three-decimals | format | ✘ amount_invalid | ✘ amount_invalid | ✅ |
| g-negative | format | ✘ amount_invalid | ✘ amount_invalid | ✅ |
| g-scientific | format | ✘ amount_invalid | ✘ amount_invalid | ✅ |
| g-converted | conversion | ✘ amount_not_in_transcript | ✘ amount_not_in_transcript, currency_unsupported | ✅ |
| g-swapped-person | substitution | ✘ recipient_ambiguous | ✘ recipient_ambiguous | ✅ |
| g-invented-person | hallucination | ✘ recipient_not_found | ✘ recipient_not_found | ✅ |
| g-over-limit | limit | ✘ amount_out_of_range | ✘ amount_out_of_range | ✅ |
