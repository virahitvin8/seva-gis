/**
 * SEVA.GIS - Programmatic Demo Video Interaction Recorder
 *
 * Uses Playwright to drive a headless Chromium instance with deterministic,
 * smooth interactions at 1920x1080 60 FPS.
 *
 * Prerequisites:
 *   npx playwright install chromium
 * Run:
 *   bun scripts/video-pipeline/record.ts
 *   or: npx tsx scripts/video-pipeline/record.ts
 */

import { chromium } from 'playwright'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const TARGET_URL = process.env.APP_URL || 'http://localhost:8443'
const OUTPUT_DIR = join(process.cwd(), 'raw-clips')

if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true })
}

async function runSevaGisRecording() {
  console.log(`[SEVA.GIS Video Recorder] Launching headless 1080p recorder...`)
  console.log(`[SEVA.GIS Video Recorder] Target: ${TARGET_URL}`)

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--autoplay-policy=no-user-gesture-required',
    ],
  })

  const context = await browser.newContext({
    recordVideo: {
      dir: OUTPUT_DIR,
      size: { width: 1920, height: 1080 },
    },
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  })

  const page = await context.newPage()

  try {
    // 1. Navigate to SEVA.GIS
    console.log('[Recorder] Loading application...')
    await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {
      console.log('[Recorder] Networkidle timed out, proceeding with current DOM state')
    })

    await page.waitForTimeout(1500)

    // 2. Authentication flow: Guest or Google Sign-In
    const googleBtn = page.locator('button:has-text("Continue with Google")')
    const guestBtn = page.locator('button:has-text("Guest"), button:has-text("Skip")')

    if (await googleBtn.isVisible()) {
      console.log('[Recorder] Highlight Google Sign-in button with Drive Cloud Vault...')
      await googleBtn.hover()
      await page.waitForTimeout(1000)
    }

    if (await guestBtn.isVisible()) {
      await guestBtn.first().click()
      await page.waitForTimeout(1200)
    } else {
      // If modal or login form is present, bypass or fill
      const submitBtn = page.locator('button[type="submit"]')
      if (await submitBtn.isVisible()) {
        await submitBtn.click()
        await page.waitForTimeout(1200)
      }
    }

    // 3. Area of Interest (AOI) selection
    console.log('[Recorder] Selecting Area of Interest (AOI)...')
    const farmSelector = page.locator('button:has-text("My farms"), select, [data-testid="farm-select"]')
    if (await farmSelector.first().isVisible()) {
      await farmSelector.first().click()
      await page.waitForTimeout(800)
    }

    // Smooth pan & zoom on map
    const mapCanvas = page.locator('.leaflet-container, .maplibregl-canvas, canvas').first()
    if (await mapCanvas.isVisible()) {
      const box = await mapCanvas.boundingBox()
      if (box) {
        // Smooth cursor trajectory simulating natural inspection
        await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5)
        await page.mouse.down()
        await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.48, { steps: 25 })
        await page.mouse.up()
        await page.waitForTimeout(1200)
      }
    }

    // 4. Analysis Intent Switching (General -> Agriculture -> Hydrology -> Land Cover)
    console.log('[Recorder] Cycling Analysis Intents...')
    const intentPills = page.locator('button:has-text("Agriculture"), button:has-text("Hydrology"), button:has-text("Land Cover")')
    const count = await intentPills.count()
    for (let i = 0; i < count; i++) {
      await intentPills.nth(i).click()
      await page.waitForTimeout(1500)
    }

    // 5. Layer inspection: Sentinel-2 Indices (NDVI, NDWI, Dynamic World LULC)
    console.log('[Recorder] Toggling Spectral Indicators...')
    const ndviPill = page.locator('button:has-text("NDVI"), [data-layer="ndvi"]').first()
    if (await ndviPill.isVisible()) {
      await ndviPill.click()
      await page.waitForTimeout(1500)
    }

    const ndwiPill = page.locator('button:has-text("NDWI"), [data-layer="ndwi"]').first()
    if (await ndwiPill.isVisible()) {
      await ndwiPill.click()
      await page.waitForTimeout(1500)
    }

    // 6. Split comparison swipe demonstration
    console.log('[Recorder] Demonstrating Split Swipe Comparison...')
    const splitSlider = page.locator('input[type="range"], .split-slider, .swipe-divider').first()
    if (await splitSlider.isVisible()) {
      const sliderBox = await splitSlider.boundingBox()
      if (sliderBox) {
        await page.mouse.move(sliderBox.x + sliderBox.width * 0.2, sliderBox.y + sliderBox.height * 0.5)
        await page.mouse.down()
        await page.mouse.move(sliderBox.x + sliderBox.width * 0.8, sliderBox.y + sliderBox.height * 0.5, { steps: 30 })
        await page.mouse.up()
        await page.waitForTimeout(1200)
      }
    }

    // 7. Google Drive Cloud Vault integration & Export verification
    console.log('[Recorder] Showing Google Drive Cloud Vault status...')
    const drivePill = page.locator('button:has-text("Drive"), button:has-text("Google"), [title*="Drive"]').first()
    if (await drivePill.isVisible()) {
      await drivePill.hover()
      await page.waitForTimeout(1000)
    }

    // 8. Academic Report & 19X Cartography Dossier Preview
    console.log('[Recorder] Previewing Academic Report Dossier...')
    const reportTab = page.locator('button:has-text("Report"), [data-tab="report"]').first()
    if (await reportTab.isVisible()) {
      await reportTab.click()
      await page.waitForTimeout(2000)

      // Scroll smoothly down the report preview
      await page.mouse.wheel(0, 600)
      await page.waitForTimeout(1500)
      await page.mouse.wheel(0, -600)
      await page.waitForTimeout(1000)
    }

    console.log('[Recorder] Interaction sequence completed successfully.')
  } catch (err) {
    console.warn('[Recorder] Non-fatal sequence notice:', err)
  } finally {
    await context.close()
    await browser.close()
    console.log(`[SEVA.GIS Video Recorder] Raw clip saved to: ${OUTPUT_DIR}`)
  }
}

runSevaGisRecording().catch((err) => {
  console.error('[Recorder Fatal]', err)
  process.exit(1)
})
