# Contributing to SEVA.GIS

Thank you for helping keep precision agriculture open, keyless, and accurate!

## Quick Start

1. Fork and create a focused branch from `main`.
2. Ensure Node 22 + pnpm 10 are installed, then run:
   ```bash
   pnpm install --frozen-lockfile
   npm run dev
   ```
3. Before opening a PR, verify all gates pass:
   ```bash
   npm run typecheck
   npm test
   npm run i18n:coverage
   npm run build
   ```

## Standards

- **Real Data Only**: Never fabricate sensor/spectral/gnss numbers or fall back to fake math (`Math.sin`/`Math.cos` of lat/lon). Show clear unavailable states with retries.
- **Trilingual Parity**: Keep English, Hindi (`hi`), and Telugu (`te`) keys synchronized in `src/lib/i18nCatalog.ts` (`i18n.test.ts` checks script and parity).
- **Licences**: Core code is Apache-2.0 (`qgis` plugin stays separate GPL-3.0). Record any third-party open-source attribution in `CREDITS.md`.
- **Small PRs + Tests**: Add regression tests alongside bug fixes or new modules.
