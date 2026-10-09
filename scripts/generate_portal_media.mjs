import puppeteer from 'puppeteer-core'
import fs from 'fs'
import path from 'path'

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const FRAMES_DIR = path.resolve('scratch/frames_portal')

async function run() {
  if (fs.existsSync(FRAMES_DIR)) {
    fs.rmSync(FRAMES_DIR, { recursive: true, force: true })
  }
  fs.mkdirSync(FRAMES_DIR, { recursive: true })

  console.log('🚀 Launching Chrome at 1600x900...')
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1600,900']
  })

  const page = await browser.newPage()
  await page.setViewport({ width: 1600, height: 900, deviceScaleFactor: 1 })

  // Seed authentic user and 2 real farms
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('seva-session', 'guest')
    localStorage.setItem('seva-guest-name', 'Akshit Vinay')
    localStorage.setItem('seva-guide', 'off')
    localStorage.setItem('seva-map-bg', 'default')
    localStorage.setItem('seva-lb-open', '1')

    const farms = [
      {
        id: 'farm-punjab-01',
        name: 'Punjab Cadastral Parcel #84 (Wheat)',
        location: '30.9010° N, 75.8573° E',
        crop: 'Wheat (Triticum aestivum)',
        area: 7.7,
        lat: 30.9010,
        lon: 75.8573,
        polygon: [
          [75.8540, 30.8990],
          [75.8610, 30.8995],
          [75.8615, 30.9035],
          [75.8545, 30.9030]
        ],
        status: 'Optimal vegetative vigour',
        sample: false
      },
      {
        id: 'farm-krishna-02',
        name: 'Krishna Delta Basin Parcel (Paddy)',
        location: '16.5062° N, 80.6480° E',
        crop: 'Paddy / Rice (Oryza sativa)',
        area: 3.2,
        lat: 16.5062,
        lon: 80.6480,
        polygon: [
          [80.6450, 16.5040],
          [80.6520, 16.5045],
          [80.6525, 16.5085],
          [80.6455, 16.5080]
        ],
        status: 'Flooded / Tillering stage',
        sample: false
      }
    ]
    localStorage.setItem('seva-farms', JSON.stringify(farms))
  })

  console.log('📡 Navigating to SEVA·GIS...')
  await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle2', timeout: 30000 })
  await new Promise(r => setTimeout(r, 4000))

  // Inject Figma cursor and smooth camera zoom engine
  await page.evaluate(() => {
    // Figma Cursor
    const cursor = document.createElement('div')
    cursor.id = 'figma-cursor'
    cursor.style.position = 'fixed'
    cursor.style.left = '200px'
    cursor.style.top = '140px'
    cursor.style.zIndex = '2147483647'
    cursor.style.pointerEvents = 'none'
    cursor.style.transition = 'transform 0.08s linear'
    cursor.innerHTML = `
      <div style="position: relative;">
        <svg width="26" height="26" viewBox="0 0 28 28" fill="none" style="filter: drop-shadow(0 3px 6px rgba(0,0,0,0.5));">
          <path d="M4 2L4 22L9.5 16.5L14.5 26L18 24.5L13 15L20 15L4 2Z" fill="#022c22" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/>
        </svg>
        <div style="position: absolute; left: 16px; top: 10px; background: linear-gradient(135deg, #059669, #10b981); color: #ffffff; padding: 2.5px 9px; border-radius: 999px; font-size: 11px; font-weight: 700; white-space: nowrap; box-shadow: 0 4px 10px rgba(0,0,0,0.3); border: 1.5px solid #ffffff; display: flex; align-items: center; gap: 4px;">
          <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#86efac;"></span>
          Akshit Vinay
        </div>
      </div>
    `
    document.body.appendChild(cursor)

    // Camera Zoom helper
    const root = document.getElementById('root')
    if (root) {
      root.style.transformOrigin = 'center top'
      root.style.transition = 'transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)'
    }

    window.cursorPos = { x: 200, y: 140 }

    window.updateFigmaCursor = (x, y) => {
      window.cursorPos = { x, y }
      cursor.style.left = `${x}px`
      cursor.style.top = `${y}px`
    }

    window.setCameraZoom = (originX, originY, scale) => {
      if (!root) return
      if (scale <= 1.01) {
        root.style.transformOrigin = 'center top'
        root.style.transform = 'scale(1)'
      } else {
        root.style.transformOrigin = `${originX}px ${originY}px`
        root.style.transform = `scale(${scale})`
      }
    }
  })

  // Start Screencast
  const client = await page.target().createCDPSession()
  let frameIndex = 0
  let isCapturing = true

  client.on('Page.screencastFrame', async ({ data, sessionId }) => {
    if (!isCapturing) return
    frameIndex++
    const filename = path.join(FRAMES_DIR, `frame_${String(frameIndex).padStart(5, '0')}.jpg`)
    fs.writeFileSync(filename, Buffer.from(data, 'base64'))
    try {
      if (isCapturing) {
        await client.send('Page.screencastFrameAck', { sessionId })
      }
    } catch (e) {
      // ignore
    }
  })

  await client.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 92,
    maxWidth: 1600,
    maxHeight: 900,
    everyNthFrame: 1
  })

  console.log('🎥 Recording started! Executing Figma-style walkthrough...')

  // Helper function to animate cursor and camera
  async function glideTo(x, y, zoom = null, steps = 14, stepDelay = 40) {
    const cur = await page.evaluate(() => window.cursorPos)
    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      // Ease in-out cubic
      const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
      const cx = cur.x + (x - cur.x) * ease
      const cy = cur.y + (y - cur.y) * ease
      await page.evaluate((px, py) => window.updateFigmaCursor(px, py), cx, cy)
      await new Promise(r => setTimeout(r, stepDelay))
    }
    if (zoom !== null) {
      await page.evaluate((zx, zy, s) => window.setCameraZoom(zx, zy, s), x, y, zoom)
      await new Promise(r => setTimeout(r, 450))
    }
  }

  // --- STEP 1: Overview and Greeting ---
  await glideTo(320, 210, 1.0, 12)
  await new Promise(r => setTimeout(r, 1000))

  // --- STEP 2: Navigate to "Where is what" Topbar Button ---
  console.log('📍 Zooming into "Where is what" button...')
  await glideTo(715, 32, 1.45, 18)
  await new Promise(r => setTimeout(r, 500))

  // Click "Where is what"
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Where is what'))
    if (btn) btn.click()
  })
  await new Promise(r => setTimeout(r, 600))

  // Zoom to modal
  await page.evaluate(() => window.setCameraZoom(800, 450, 1.08))
  await glideTo(600, 350, null, 14)
  await new Promise(r => setTimeout(r, 800))
  await glideTo(700, 500, null, 12)
  await new Promise(r => setTimeout(r, 800))

  // Close "Where is what" modal
  console.log('📍 Closing "Where is what" modal...')
  await glideTo(1160, 220, 1.08, 12)
  await page.evaluate(() => {
    const closeBtn = document.querySelector('.walkthrough-modal button, .modal button')
    if (closeBtn) {
      closeBtn.click()
    } else {
      const backdrop = document.querySelector('.modal-backdrop')
      if (backdrop) backdrop.click()
    }
  })
  await new Promise(r => setTimeout(r, 500))

  // Reset zoom
  await page.evaluate(() => window.setCameraZoom(800, 450, 1.0))
  await new Promise(r => setTimeout(r, 500))

  // --- STEP 3: Navigate to "Real Walkthrough" Modal ---
  console.log('📍 Zooming into "Real Walkthrough" button...')
  await glideTo(805, 32, 1.4, 16)
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Real Walkthrough'))
    if (btn) btn.click()
  })
  await new Promise(r => setTimeout(r, 600))

  // View Sentinel-2 ingestion in modal
  await page.evaluate(() => window.setCameraZoom(800, 450, 1.06))
  await glideTo(500, 280, null, 12)
  await new Promise(r => setTimeout(r, 900))

  // Click Next in Walkthrough to show BOA Surface Reflectances
  await glideTo(870, 720, null, 12)
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'))
    const nextBtn = btns.find(b => b.textContent && b.textContent.includes('Next'))
    if (nextBtn) nextBtn.click()
  })
  await new Promise(r => setTimeout(r, 1100))

  // Close Walkthrough
  await glideTo(950, 720, null, 10)
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'))
    const closeBtn = btns.find(b => b.textContent && b.textContent.includes('Close'))
    if (closeBtn) closeBtn.click()
  })
  await new Promise(r => setTimeout(r, 500))
  await page.evaluate(() => window.setCameraZoom(800, 450, 1.0))

  // --- STEP 4: Focus on Map Canvas & Precision Layers ---
  console.log('📍 Zooming into Farm Map Canvas & High-Res Sentinel-2 NDVI...')
  await glideTo(620, 520, 1.35, 18)
  await new Promise(r => setTimeout(r, 800))

  // Test Background controls: Click "Black"
  console.log('📍 Switching background to Black high-contrast mode...')
  await glideTo(555, 475, 1.45, 12)
  await page.evaluate(() => {
    const radios = Array.from(document.querySelectorAll('label, button, input'))
    const black = radios.find(el => el.textContent && el.textContent.includes('Black'))
    if (black) black.click()
  })
  await new Promise(r => setTimeout(r, 900))

  // Click "White"
  console.log('📍 Switching background to White mode...')
  await glideTo(615, 475, 1.45, 10)
  await page.evaluate(() => {
    const radios = Array.from(document.querySelectorAll('label, button, input'))
    const white = radios.find(el => el.textContent && el.textContent.includes('White'))
    if (white) white.click()
  })
  await new Promise(r => setTimeout(r, 900))

  // Click "Map" back
  console.log('📍 Switching background back to Satellite Map...')
  await glideTo(675, 475, 1.45, 10)
  await page.evaluate(() => {
    const radios = Array.from(document.querySelectorAll('label, button, input'))
    const mapBtn = radios.find(el => el.textContent && el.textContent.includes('Map'))
    if (mapBtn) mapBtn.click()
  })
  await new Promise(r => setTimeout(r, 800))

  // --- STEP 5: Layers & Symbology Box ---
  console.log('📍 Inspecting Layers & Symbology Box (QGIS & Earth Engine Precision)...')
  await glideTo(880, 520, 1.38, 16)
  await new Promise(r => setTimeout(r, 700))

  // Toggle DRA (Dynamic Range Adjustment)
  console.log('📍 Toggling Dynamic Range Adjustment (DRA)...')
  await glideTo(880, 480, 1.42, 10)
  await page.evaluate(() => {
    const draBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('DRA'))
    if (draBtn) draBtn.click()
  })
  await new Promise(r => setTimeout(r, 900))

  // Toggle Symbology Key tab
  console.log('📍 Viewing Symbology Key Tab...')
  await glideTo(920, 535, 1.42, 10)
  await page.evaluate(() => {
    const tab = Array.from(document.querySelectorAll('button[role="tab"]')).find(b => b.textContent && b.textContent.includes('Symbology'))
    if (tab) tab.click()
  })
  await new Promise(r => setTimeout(r, 900))

  // Return to Active Layers
  await glideTo(780, 535, 1.42, 10)
  await page.evaluate(() => {
    const tab = Array.from(document.querySelectorAll('button[role="tab"]')).find(b => b.textContent && b.textContent.includes('Active'))
    if (tab) tab.click()
  })
  await new Promise(r => setTimeout(r, 700))

  // --- STEP 6: Zoom Stretch Farm ---
  console.log('📍 Clicking Zoom Stretch Farm...')
  await glideTo(710, 475, 1.35, 12)
  await page.evaluate(() => {
    const zBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Zoom St'))
    if (zBtn) zBtn.click()
  })
  await new Promise(r => setTimeout(r, 1000))

  // --- STEP 7: Switch to Second Farm: Krishna Delta Basin Parcel (Paddy) ---
  console.log('📍 Switching to Krishna Delta Basin Parcel (Paddy)...')
  await page.evaluate(() => window.setCameraZoom(800, 450, 1.1))
  await glideTo(270, 730, 1.25, 16)
  await new Promise(r => setTimeout(r, 500))
  await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('div, button'))
    const krishna = cards.find(el => el.textContent && el.textContent.includes('Krishna Delta Basin'))
    if (krishna) krishna.click()
  })
  await new Promise(r => setTimeout(r, 1400))

  // Zoom in on Krishna Delta map
  console.log('📍 Examining Krishna Delta Paddy on Map...')
  await glideTo(600, 550, 1.35, 16)
  await new Promise(r => setTimeout(r, 1100))

  // --- STEP 8: Tape Ruler Demonstration ---
  console.log('📍 Activating Google Earth Pro style Metered Tape Ruler...')
  await glideTo(530, 580, 1.4, 12)
  await page.evaluate(() => {
    const ruler = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Ruler'))
    if (ruler) ruler.click()
  })
  await new Promise(r => setTimeout(r, 1000))

  // --- STEP 9: Full Workspace Grand Zoom-Out Finale ---
  console.log('📍 Gliding back to full workspace overview...')
  await page.evaluate(() => window.setCameraZoom(800, 450, 1.0))
  await glideTo(150, 36, 1.0, 20)
  await new Promise(r => setTimeout(r, 1500))

  // Stop Screencast
  console.log('🛑 Stopping screencast...')
  isCapturing = false
  await client.send('Page.stopScreencast')
  await browser.close()

  console.log(`✅ Recording complete! Total frames captured: ${frameIndex}`)
}

run().catch(console.error)
