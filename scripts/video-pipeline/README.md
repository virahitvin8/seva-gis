# SEVA.GIS — Programmatic Demo Video Pipeline

Build professional, crisp 60 FPS 1080p demo videos completely from scratch on your own machine using open-source tools: **Playwright**, **Motion Canvas**, and **FFmpeg**.

---

## 1. Core Tooling

| Tool / Engine | Purpose | Command |
| :--- | :--- | :--- |
| **Playwright** | Automate real SEVA.GIS UI flows (AOI drawing, intent switching, split swipe, Drive sync) | `bun scripts/video-pipeline/record.ts` or `npx tsx scripts/video-pipeline/record.ts` |
| **Motion Canvas** | Vector motion graphics (geodetic boundary tracing, multispectral radar scan, live NDVI HUD) | `npm run dev` in Motion Canvas project |
| **FFmpeg** | Lossless scene stitching, audio mixing, H.264 CRF 19 web-ready encode | `node scripts/video-pipeline/assemble.mjs` |

---

## 2. Step-by-Step Execution

### Step A: Capture Real App Interactions (Headless)

Install Playwright browsers (one-time setup):
```bash
npx playwright install chromium
```

Run the automated interaction recorder:
```bash
# Uses preview server or remote URL (default: http://localhost:8443)
APP_URL=http://localhost:8443 npx tsx scripts/video-pipeline/record.ts
```

This saves raw 60 FPS 1080p clips into `./raw-clips/`.

### Step B: Motion Canvas Scene Animation

The scene template is located in:
`scripts/video-pipeline/motion-canvas/scenes/boundary.tsx`

Features:
- Geodetic farm polygon path tracing with cubic bezier easing.
- Sentinel-2 multispectral radar scan sweep.
- Live telemetry HUD animating NDVI from 0.18 to 0.76.
- Google Drive Vault sync badge (`Drive: SEVA GIS / TIFF Files`).

### Step C: Post-Processing & Encoding with FFmpeg

Stitch recorded clips and apply web optimization:
```bash
node scripts/video-pipeline/assemble.mjs
```

Produces:
`dist-media/SEVA-GIS-Final-Demo.mp4` (+faststart, H.264, CRF 19, yuv420p).
