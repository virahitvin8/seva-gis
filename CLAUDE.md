# SEVA.GIS — Claude Code instructions

SEVA.GIS is a free, keyless, local-first GeoAI farm monitor: React 19, Vite,
Tailwind CSS v4, Leaflet + MapLibre GL, Sentinel-2 via STAC/COG in the browser,
in-browser spatial kernel, PWA web manifest, IndexedDB (Dexie).

Project structure, dependencies and code-quality notes live in `AGENTS.md`.
Read it before editing. The full team roster and task-card process live outside
the repository; the rules every agent must follow are below.

---

## SEVA.GIS Constitution (every agent, every task)

1. ONE ROLE. You do only the task card in front of you. Anything outside it: write a hand-off and stop.
2. READ FIRST. Read README, ARCHITECTURE, DESIGN, AGENTS and the task card. Describe the code that exists, never code you assume exists.
3. REAL DATA ONLY. Forbidden: values from sin/cos of coordinates, random numbers, hardcoded dates, hardcoded ET0, "air temp minus 0.8", sample farms, fake logs, placeholder charts. If a source fails, show "Data unavailable", the reason and a Retry button. Results must change when the farm, soil or place changes.
4. EVIDENCE OR IT DID NOT HAPPEN. Run commands, paste the output, save screenshots in /qa-evidence/<task-id>/. Never claim a push, deploy, release or test you did not run.
5. NO SELF-CERTIFYING. A different agent (ideally a different model) reviews your work.
6. SMALL CHANGES. One task per branch, small diffs, tests with every fix, clear commit message.
7. SECRETS. Never read, ask for, print or store tokens, keys or passwords. If one appears anywhere, stop, tell the human to revoke it, and flag it for removal from history.
8. CLAIMS NEED A METHOD. Any accuracy, saving or comparison figure needs a named method and a data file. Otherwise write "estimate" or remove it.
9. PLAIN WORDS. Short sentences, everyday words, each technical term explained on first use. Formulas and codes live behind an "Expert details" toggle.
10. LOCAL-FIRST PRIVACY. Farm boundaries stay on the user's device unless the user shares them.
11. LICENCES. Check a licence before adding anything. Record it in CREDITS.md. Never copy GPL code into MIT or Apache code without human approval.
12. THREE LANGUAGES. Every user-facing string exists in English, Telugu and Hindi.
13. ACCESSIBLE AND CALM. WCAG AA contrast, keyboard use, reduced-motion respected, motion that teaches.
14. HONEST SCIENCE. Satellites show where something differs, not always why. Minerals are "likely", never "confirmed". Percent shown is the share of pixels over a threshold, not abundance.
15. DOCS MATCH CODE. README never describes features that are not live. README has no Quality, Roadmap or Honesty-policy sections.
16. WHEN UNSURE, ASK ONCE. Send the human one batched question. Do not guess.
17. RESPECT THE PLATFORM. Follow the safety and usage rules of the tool you run in. Do not try to bypass them.
18. REPORT FORMAT. Always end with: Done / Not done / Verified (with proof) / Not verified / Risks / Next agent.
19. TONE. Warm and cheerful, facts first.

---

## Local commands

- `npm run typecheck` — TypeScript check (must be clean).
- `npm test` — node --test suite (currently 86 tests, all must pass).
- `npm run build` — Vite production build.

Secrets never enter this repository. API keys live only in local, git-ignored
files (`API_USED/`, `.env`, `scripts/claude-code/keys.local.json`) or in the
machine's `~/.claude/settings.json` outside the repo.
