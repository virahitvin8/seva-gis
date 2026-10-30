# figma-make-app

React + Vite + Tailwind CSS project running inside Figma Make.

## Development Server

A Vite development server is **already running** on `$PORT` (default 8443). You don't need to start it manually.

- Preview URL: The user can access the running app through the preview panel
- Hot reload: Changes to source files are reflected immediately

## Project Structure

This is the canonical project structure. Start with task-relevant files below. Only follow imports or inspect other files when required, when a documented path is missing, or when the repository contradicts this guide.

- `src/main.tsx` - React entrypoint; imports `src/index.css` and mounts `src/App.tsx` into the `#root` element
- `src/App.tsx` - Primary application component and the usual starting point for UI work
- `src/index.css` - Global CSS entrypoint and Tailwind CSS v4 import
- `index.html` - Vite HTML shell containing the `#root` element and loading `src/main.tsx`
- `package.json` - Project dependencies and the Vite build, development, preview, and formatting scripts
- `vite.config.ts` - Vite configuration with React, Tailwind CSS v4, and Figma Make plugins plus the `@` alias for `src`
- `.mise.toml` - Toolchain versions for Node.js and pnpm

## Dependencies

- Runtime: React 19 and React DOM 19
- Styling: Tailwind CSS v4 with the `@tailwindcss/vite` plugin
- Build tooling: Vite 8, TypeScript 5.7, and `@vitejs/plugin-react`
- Formatting: oxfmt

## Styling

This project uses **Tailwind CSS v4** through the `@tailwindcss/vite` plugin configured in `vite.config.ts`. `src/index.css` imports Tailwind with `@import 'tailwindcss';`. Use Tailwind utility classes directly in JSX and put global CSS or Tailwind v4 theme customization in `src/index.css`. This scaffold does not need a Tailwind config file or PostCSS config.

`src/main.tsx` imports `src/index.css`, so global font wiring belongs in `src/index.css`. Keep CSS `@import` statements first, then add any `@font-face` rules and font-family defaults there.

## Code quality

- Use double quotes for strings containing apostrophes (`"We're here to help"`), or escape them in single-quoted strings. An unescaped apostrophe in a single-quoted string breaks the build.
- Ensure JSX tags are closed and braces are balanced.
- Export components as default exports.

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

