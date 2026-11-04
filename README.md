# Verbo

**A voice-first safety net for person-to-person payments — in the languages people actually speak.**

Built for the PayPal AI Hackathon ("Build What's Next with PayPal and AI"). Sandbox only.

> 🚧 Work in progress (Nov 4–12, 2026). Full README with judging-criteria walkthrough, AG Grid and APIMatic usage
> notes, and demo link lands before submission.

## Why
When someone sends money to the wrong person — or under a scammer's pressure — and the two people don't share a
language, the money is usually lost. Verbo (1) lets people send by voice in their own language with a fixed read-back
and big-digit confirmation, (2) checks for look-alike recipients and pressure before money moves, holding risky payments
for 10 minutes, (3) turns a mistake into a translated, one-tap recovery flow for the person who received it, and
(4) gives operators a Case Desk built on AG Grid with an evidence packet per case.

## Run locally
```bash
npm install
cp .env.example .env   # then fill values; MOCK=1 works with no keys
npm run check-env
npm run dev
```

## License
MIT — see [LICENSE](LICENSE).
