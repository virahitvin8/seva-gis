# SEVA·GIS — Complete Rebuild Report (Previous vs Now)

**Scope of this report:** every change made in the working sessions, what existed
before, what exists now, which file each change lives in, and what remains — with the
honest reason each open item is not yet done.

**Verification for every batch below:** `npm exec -- tsc --noEmit` → pass and
`npm run build` → pass. No automated test suite exists in this repository, so these are
the strongest checks available; browser journeys were not executed.

---

## 1. Commits in this rebuild

| Commit | Title | Date |
|---|---|---|
| `30801fb` | chore(gis): drop ArtCraft shell, secure EmailOctopus key, add change checklist | 2026-10-12 |
| `50bd344` | refactor(gis): remove cadastral UI, season calendar, and unhelpful geo-tools | 2026-10-12 |
| *(pending)* | chore(report): neutralize telemetry/cadastral wording in report builder | 2026-10-12 |

All pushed to `origin/main` on `github.com/virahitvin8/seva-gis`.

---

## 2. Before → After (headline)

| Area | Previous | Now |
|---|---|---|
| App shell | ArtCraft/Craft Studio modal + route + section titles present in `App.tsx` | Removed from the shell; PDF workbench lives only inside Reports |
| Email credential | API key hard-coded in `src/lib/emailOctopus.ts` and committed | Read from `VITE_EMAIL_OCTOPUS_API_KEY` in gitignored `.env` |
| Greeting copy | “Dear Custodian of \<farm\>” | “Dear Member” + area-of-interest line |
| Staff wording | “Custodian” defaults across report/team/alert components | Neutral “Member” |
| Cadastral UI | `LandInfoCard.tsx` + `lib/cadastreOnline.ts` (unreferenced) | Deleted |
| Season calendar | Crop Library dashboard section rendering “Agronomy Season Calendar” | Section dropped; `CropLibrary.tsx` deleted |
| Geo toolkit | VRA, Point checker, Offset, Converters, WKT reader in `GeoTools.tsx` | Removed |
| Report wording | “Telemetry”, “cadastral boundary”, “cadastral parcel level” | Neutral “Records”, “area-of-interest boundary”, “small-holding level” |
| Empty-state copy | “review from home” | “review remotely” |
| Vaiganga basin | present historically | none remain in `src/` |

---

## 3. File-by-file changes (authored in this rebuild)

| File | Change | Batch |
|---|---|---|
| `src/App.tsx` | Removed `ArtCraftStudio` lazy import, both `SECTION_TITLES` craft entries, `go('Craft Studio')` route, and the `craft-studio` modal render (+ condition fix) | 1 |
| `src/App.tsx` | Removed `CropLibrary` lazy import, section titles, switch case, both preset arrays; neutral “review remotely” empty state | 2 |
| `src/lib/emailOctopus.ts` | API key + list id from `import.meta.env`; “Dear Member” greeting | 1 |
| `src/lib/teamAlert.ts` | Default sender “SEVA·GIS Member” | 1 |
| `src/PopTheTeamModal.tsx` | Default name “SEVA Member” | 1 |
| `src/ReportPanel.tsx` | Default custodian → “SEVA·GIS Member” (2 sites) | 1 |
| `src/GeoTools.tsx` | Removed VRA, Point checker, Offset & buffer, Converters, WKT reader sections | 2 |
| `src/Auth.tsx` | Removed VRA from sign-in capability copy | 2 |
| `src/reportBuilder.ts` | Neutralized telemetry/cadastral source lines and terms | 3 |
| `.env.example` | Documented `VITE_EMAIL_OCTOPUS_API_KEY` / `_LIST_ID` | 1 |
| `.env` (gitignored) | Holds the real EmailOctopus values | 1 |
| `plan.md` | Added §11 Phase Update Log | 1 |
| `docs/CHANGE-CHECKLIST.md` (+`.pdf`) | The tickable master checklist + source map | 1, 2 |
| `docs/REBUILD-REPORT.md` (this file) | Complete previous-vs-now report | 3 |
| **Deleted** `src/LandInfoCard.tsx` | Cadastral/land-registry UI | 2 |
| **Deleted** `src/lib/cadastreOnline.ts` | Cadastral authority/Overpass logic | 2 |
| **Deleted** `src/CropLibrary.tsx` | Agronomy Season Calendar | 2 |

> Note: the working tree also contains edits that were **already present before these
> sessions** (e.g. `README.md`, `backend/README.md`, `docs/CREDITS.md`, `docs/DOMAIN.md`,
> `src/Aurora.tsx`, `src/DataManager.tsx`, `src/FinancialSummaryTerminal.tsx`,
> `src/IndicatorMap.tsx`, `src/MatlabAnalysisSuite.tsx`, `src/MethodologyModal.tsx`,
> `src/Mitra.tsx`, `src/index.css`, `src/report.ts`, and untracked `src/lib/geoTiffWriter.ts`).
> Those were **not authored here** and were left untouched except where a batch needed the
> same file.

---

## 4. Checklist status by section (after Batch 3)

| Section | Done | Notes |
|---|---|---|
| A. Git repo & README | 6/14 | README credits/diagrams already present; Viva/script removal still open |
| B. Sign-in page | 2/6 | Caption + heading done; motion background / 3D cards pending |
| C. Shell, header, Mitra | 4/14 | Craft removed, layout control hidden, single logout, candlestick rename done; scroll-spy, Mitra, language open |
| D. Performance | 0/7 | Not started — needs Web Worker / cancellation work |
| E. Map behaviour | 3/24 | Background-canvas naming done; zoom-fit, collision, loupe, clipping open |
| F. Parameters & tools | 1/7 | Cadastre removed; band combos / intent system open |
| G. Insight cards | 2/17 | Custodian wording + neutral phrasing; flip cards / sources open |
| H. Water & hydrology | 1/5 | Vaiganga gone; water-plan removal + dynamic figures open |
| I. Geo toolkit | 1/2 | Toolkit trimmed; buffer rebuild open |
| J. Reports | 3/29 | ArtCraft in Reports, attachment format, greeting name; PDF/translation/LULC open |
| K. Process | 3/6 | Checklist live, git pushed; final QA + public app link open |

---

## 5. What remains, and why (honest)

These are **not** done, and several cannot be finished without your input or credentials:

1. **Performance (D, 35–41).** Requires moving raster loops to Web Workers and adding
   `AbortController` cancellation across scene/weather/DEM/report calls — a focused,
   testable engineering task, but large. Recommended as the next batch.
2. **Map viewport & cartography (E, 42–65).** Zoom-19 fitting, AOI centring, furniture
   collision avoidance, loupe window, clipping by extent, GeoTIFF writer.
   *Flag F1:* at zoom 19 the Sentinel-2 pixels are blocky by nature.
3. **Parameters/intents (F, 66–72)** and **flip-card insights (G, 73–94).** New UI + data
   plumbing.
4. **Hydrology (H, 92–94).** Must become fully AOI-driven; static SWAT figures replaced.
5. **Reports (J, 97–125).** PDF 0 KB and full Telugu/Hindi translation need runtime
   debugging in a browser (cannot be verified by `tsc`/`build` alone).
6. **Email delivery (105).** Needs your EmailOctopus account check (sender/list).
7. **Security.** ⚠️ The old EmailOctopus key is still in Git history — **rotate it**.

---

## 6. Verification log

| Check | Command | Result |
|---|---|---|
| Types | `npm exec -- tsc --noEmit` | pass (after Batch 1, 2, 3) |
| Build | `npm run build` | pass (after Batch 1, 2, 3) |
| Bundle | Crop Library chunk | no longer emitted |
| Git | `git push origin main` | `30801fb`, `50bd344` pushed |

**Could not run:** there is no test runner configured, so no unit/browser tests were
executed. That is a real gap, not a pass.
