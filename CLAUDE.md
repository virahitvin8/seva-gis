@AGENTS.md

# CLAUDE.md — SEVA.GIS / DYOP.GIS Constitution & Multi-Agent Operating Manual

Every Claude Code, OpenCode, Antigravity, or FreeBuff session in this repository MUST follow the **SEVA.GIS Constitution (Rules 1–19)** in `AGENTS.md` and `AGENT_ROSTER.md`.

## Quick Reference: The 19 Constitution Rules

1. **ONE ROLE:** Execute only the active task card. Write a `HANDOFF` block when handing to the next agent.
2. **READ FIRST:** Inspect `README.md`, `ARCHITECTURE.md`, `DESIGN.md`, `AGENTS.md`, and the active task card before editing.
3. **REAL DATA ONLY:** Never compute values from `sin/cos` of coordinates, `Math.random()`, hardcoded dates, hardcoded ET0, or `"air temp minus 0.8"`. If an upstream API fails, show `"Data unavailable"`, the reason, and a **Retry** button.
4. **EVIDENCE OR IT DID NOT HAPPEN:** Save command outputs and browser screenshots under `/qa-evidence/<task-id>/` and log every claim in `/qa-evidence/ledger.md`.
5. **NO SELF-CERTIFYING:** Builder agents (`A5`–`A9`, `A13`–`A17`, `A19`, `A21`–`A23`) never approve their own work; `A10` (Code Review), `A12` (QA), `A18` (Science Validator), `A11` (Security), `A4` (Release Supervisor), and `A24` (Consumer Acceptance) verify independently.
6. **SMALL CHANGES:** Keep diffs focused, type-safe, and tested.
7. **SECRETS:** Never print, commit, or store tokens/keys. Configure custom Claude Code models in `~/.claude/settings.json` or `.claude/settings.local.json` (git-ignored).
8. **CLAIMS NEED A METHOD:** Every accuracy or savings metric requires a named method and data file, or must be labelled `"estimate"`.
9. **PLAIN WORDS:** Everyday words first; formulas and technical codes behind an `"Expert details"` toggle.
10. **LOCAL-FIRST PRIVACY:** AOI polygons stay on the user's device unless explicitly shared.
11. **LICENCES:** Check every dependency licence (`A27`) and record in `CREDITS.md` / `THIRD_PARTY_LICENSES.md`.
12. **THREE LANGUAGES:** English (`en`), Telugu (`te`), and Hindi (`hi`).
13. **ACCESSIBLE AND CALM:** WCAG AA contrast, keyboard navigation, `prefers-reduced-motion` respected.
14. **HONEST SCIENCE:** Mineral indications are `"likely (spectrally inferred)"`, never `"confirmed"`. Percentages represent share of AOI pixels above threshold, not mineral abundance.
15. **DOCS MATCH CODE:** `README.md` describes only live features and contains no Quality, Roadmap, or Honesty-policy sections.
16. **WHEN UNSURE, ASK ONCE:** Batch any blocking questions into a single request.
17. **RESPECT THE PLATFORM:** Follow all tool and runtime safety rules.
18. **REPORT FORMAT:** Always end responses with: `Done / Not done / Verified (with proof) / Not verified / Risks / Next agent`.
19. **TONE:** Warm and cheerful, facts first.
