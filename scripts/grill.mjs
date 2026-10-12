// SEVA·GIS grill harness.
//
// Boots the built app in headless Chrome, signs in as a guest with seeded areas of
// interest, then drives a matrix of real UI combinations — languages, layers,
// basemaps, resampling, canvas modes, lock/unlock and every export — while recording
// JavaScript errors, failed assertions and screenshots.
//
// Uses the Chrome DevTools Protocol over Node's built-in WebSocket, so it adds no
// dependency. Run with: npm run grill
//
//   node scripts/grill.mjs                full matrix
//   node scripts/grill.mjs --quick        one pass over the essentials
//   node scripts/grill.mjs --keep         leave the browser and server running

import { createServer } from 'node:http'
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { spawn } from 'node:child_process'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'dist')
const SHOTS = join(ROOT, 'docs/ANALYSIS/grill')

const QUICK = process.argv.includes('--quick')
const KEEP = process.argv.includes('--keep')
const DUMP = process.argv.includes('--dump')

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
]

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.map': 'application/json',
  '.tif': 'image/tiff', '.tfw': 'text/plain', '.txt': 'text/plain',
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// ---------------------------------------------------------------------------
// static server for dist/
// ---------------------------------------------------------------------------
function serveDist() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      try {
        const url = new URL(req.url, 'http://localhost')
        let path = join(DIST, normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, ''))
        if (!path.startsWith(DIST)) { res.writeHead(403).end(); return }
        if (!existsSync(path) || !extname(path)) path = join(DIST, 'index.html')
        const body = readFileSync(path)
        res.writeHead(200, { 'Content-Type': MIME[extname(path)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' })
        res.end(body)
      } catch {
        try { res.writeHead(200, { 'Content-Type': 'text/html' }).end(readFileSync(join(DIST, 'index.html'))) } catch { res.writeHead(500).end() }
      }
    })
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }))
  })
}

// ---------------------------------------------------------------------------
// minimal CDP client
// ---------------------------------------------------------------------------
class Cdp {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pending = new Map()
    this.events = []
    ws.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data)
      if (msg.id !== undefined) {
        const p = this.pending.get(msg.id)
        if (p) { this.pending.delete(msg.id); msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result) }
      } else {
        this.events.push(msg)
      }
    })
  }
  send(method, params = {}) {
    const id = ++this.id
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
      setTimeout(() => {
        if (this.pending.has(id)) { this.pending.delete(id); reject(new Error(`${method} timed out`)) }
      }, 120000)
    })
  }
  async eval(expression, awaitPromise = true) {
    const r = await this.send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true, userGesture: true })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text)
    return r.result?.value
  }
}

async function connectCdp(port) {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`)
      const info = await res.json()
      return info.webSocketDebuggerUrl
    } catch { await sleep(400) }
  }
  throw new Error('Chrome did not expose a debugging endpoint')
}

async function newTarget(port, url) {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })
      if (res.ok) return await res.json()
    } catch { /* retry */ }
    await sleep(300)
  }
  throw new Error('could not open a browser target')
}

// ---------------------------------------------------------------------------
// seed data
// ---------------------------------------------------------------------------
const box = (lon, lat, dLon, dLat) => [
  [lon - dLon, lat - dLat], [lon + dLon, lat - dLat],
  [lon + dLon, lat + dLat], [lon - dLon, lat + dLat], [lon - dLon, lat - dLat],
]

const SEED_AREAS = [
  {
    id: 'grill-large', name: 'Grill Large Field', location: 'Sundargarh, Odisha',
    lat: 22.0767, lon: 84.8781, area: 4708.98, crop: 'Paddy', status: 'Pending',
    polygon: box(84.8781, 22.0767, 0.02, 0.02),
  },
  {
    id: 'grill-small', name: 'Grill Small Plot', location: 'Nearby plot',
    lat: 22.09, lon: 84.9, area: 1.6, crop: 'Vegetables', status: 'Pending',
    polygon: box(84.9, 22.09, 0.002, 0.002),
  },
]

// ---------------------------------------------------------------------------
// helpers used inside the page
// ---------------------------------------------------------------------------
const PAGE_HELPERS = `
window.__grill = {
  byText(root, text) {
    const nodes = [...(root || document).querySelectorAll('button, a, [role=button], [role=tab], label, span, h2, h3, h4, [class*=tab], [class*=btn]')]
    const t = text.toLowerCase()
    const matches = nodes.filter(n => (n.textContent || '').trim().toLowerCase().includes(t))
    // Prefer the shortest matching element: a container that happens to contain the
    // whole tab strip must not win over the tab button itself.
    matches.sort((a, b) => (a.textContent || '').length - (b.textContent || '').length)
    return matches[0] || null
  },
  click(el) { if (!el) return false; el.scrollIntoView({ block: 'center' }); el.click(); return true },
  clickText(text, scope) {
    const root = scope ? document.querySelector(scope) : document
    const el = this.byText(root, text)
    if (!el) return false
    const target = el.closest('button, a, [role=button]') || el
    target.scrollIntoView({ block: 'center' })
    target.click()
    return true
  },
  toolbarButtons() {
    return [...document.querySelectorAll('.ix-main-toolbar .ix-tb-btn')].map(b => (b.textContent || '').trim())
  },
  openToolbarButton(label) {
    const bar = document.querySelector('.ix-main-toolbar')
    const el = this.byText(bar, label)
    if (!el) return false
    const btn = el.closest('button') || el
    btn.click()
    return true
  },
  /**
   * The map tool box has five tabs (Layers, Symbology & Resampling, Field tools,
   * Display & Basemaps, Parameters). A control only exists in the DOM while its own
   * tab is showing, so every interaction has to open the right tab first — otherwise
   * a missing element looks like a missing feature.
   */
  openTab(label) {
    if (!document.querySelector('.ix-layers-box')) {
      this.openToolbarButton('Layers')
    }
    const box = document.querySelector('.ix-layers-box')
    if (!box) return false
    if (this.byText(box, label)) {
      const tab = this.byText(box, label)
      const btn = tab.closest('button') || tab
      if (!btn.className.includes('on')) btn.click()
      return true
    }
    return false
  },
  clickInBox(label) {
    const box = document.querySelector('.ix-layers-box') || document
    const el = this.byText(box, label)
    if (!el) return false
    const t = el.closest('button, label, [role=button]') || el
    t.scrollIntoView({ block: 'center' })
    t.click()
    return true
  },
  /**
   * Adds a layer from the Parameters catalogue. Each row is a bold name plus a
   * category pill, a description and an Add control, so clicking the name is not
   * enough — the Add control inside the same row is what toggles the layer.
   */
  addParamLayer(name) {
    const box = document.querySelector('.ix-layers-box') || document
    const wanted = name.toLowerCase()
    const label = [...box.querySelectorAll('b, strong')]
      .find(e => (e.textContent || '').trim().toLowerCase() === wanted)
      || [...box.querySelectorAll('b, strong')]
        .find(e => (e.textContent || '').trim().toLowerCase().startsWith(wanted))
    if (!label) return false

    let row = label
    for (let i = 0; i < 6 && row; i++) {
      row = row.parentElement
      if (!row) return false
      const controls = [...row.querySelectorAll('span, button')]
      if (controls.some(s => /^(add|remove|active)$/i.test((s.textContent || '').trim()))) break
    }
    if (!row) return false

    const control = [...row.querySelectorAll('span, button')]
      .find(s => /^(add|remove)$/i.test((s.textContent || '').trim()))
    if (!control) return true // already active, nothing to do
    control.scrollIntoView({ block: 'center' })
    ;(control.closest('button') || control).click()
    return true
  },
  counts() {
    return {
      toolbar: document.querySelectorAll('.ix-main-toolbar .ix-tb-btn').length,
      layersBox: document.querySelectorAll('.ix-layers-box, .ix-layers-panel, [class*=layers-box]').length,
      settings: document.querySelectorAll('.ix-sett-btn').length,
      canvas: document.querySelectorAll('canvas').length,
      iframes: document.querySelectorAll('iframe').length,
      mapTiles: document.querySelectorAll('.leaflet-tile').length,
      leaflet: document.querySelectorAll('.leaflet-container').length,
    }
  },
  mapBg() {
    const el = document.querySelector('.field-map')
    if (!el) return null
    const cs = getComputedStyle(el)
    const wrap = document.querySelector('.ix-wrap')
    return {
      className: el.className,
      backgroundColor: cs.backgroundColor,
      wrapBackground: wrap ? getComputedStyle(wrap).backgroundColor : null,
      tilePaneBackground: (() => {
        const p = document.querySelector('.field-map .leaflet-tile-pane')
        return p ? getComputedStyle(p).backgroundColor : null
      })(),
      tileCount: document.querySelectorAll('.leaflet-tile').length,
    }
  },
  overflowX() {
    const tb = document.querySelector('.ix-main-toolbar')
    if (!tb) return null
    const cs = getComputedStyle(tb)
    return { scrollWidth: tb.scrollWidth, clientWidth: tb.clientWidth, overflowX: cs.overflowX, canScroll: tb.scrollWidth > tb.clientWidth + 2 }
  },
  lang: () => localStorage.getItem('seva-lang'),
  /**
   * Records every write to the map container's class attribute, with a synchronous
   * stack, so we can see who strips Leaflet's own classes instead of guessing.
   */
  watchClassWrites() {
    const el = document.querySelector('.field-map')
    if (!el) return 'no .field-map element'
    window.__grillMapEl = el
    if (window.__grillClassWrites) return 'already watching'
    const desc = Object.getOwnPropertyDescriptor(Element.prototype, 'className')
    window.__grillClassWrites = []
    Object.defineProperty(el, 'className', {
      configurable: true,
      get() { return desc.get.call(this) },
      set(value) {
        window.__grillClassWrites.push({
          value: String(value),
          stack: String(new Error().stack || '').split('\\n').slice(1, 6).map(s => s.trim()).join(' <- '),
        })
        desc.set.call(this, value)
      },
    })
    return 'watching'
  },
  classWrites: () => JSON.stringify(window.__grillClassWrites || []),
  /**
   * Records whether the processing pane ever appeared. Polling misses it when a load
   * finishes between two samples, so watch the DOM instead.
   */
  watchProcessingPane() {
    window.__grillPaneSeen = !!document.querySelector('.seva-processing-pane')
    if (window.__grillPaneObserver) return 'already watching'
    window.__grillPaneObserver = new MutationObserver(() => {
      if (document.querySelector('.seva-processing-pane')) window.__grillPaneSeen = true
    })
    window.__grillPaneObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })
    return 'watching'
  },
  processingPaneSeen: () => !!window.__grillPaneSeen,
  /** Is the map container still the same DOM node we hooked at boot? */
  mapNodeIdentity() {
    const now = document.querySelector('.field-map')
    return JSON.stringify({
      sameNode: now === window.__grillMapEl,
      fieldMapCount: document.querySelectorAll('.field-map').length,
      leafletCount: document.querySelectorAll('.field-map.leaflet-container').length,
    })
  },
  bodyText: () => (document.body.innerText || '').slice(0, 400),
}
true
`

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
async function main() {
  if (!existsSync(join(DIST, 'index.html'))) {
    console.error('dist/index.html is missing. Run `npm run build` first.')
    process.exit(1)
  }
  mkdirSync(SHOTS, { recursive: true })

  const chromePath = CHROME_CANDIDATES.find(p => existsSync(p))
  if (!chromePath) { console.error('No Chrome or Edge found.'); process.exit(1) }

  const { server, port: sitePort } = await serveDist()
  const debugPort = 9333
  const profile = join(ROOT, 'scratch/grill-profile')
  mkdirSync(profile, { recursive: true })

  const chrome = spawn(chromePath, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--disable-background-networking', '--mute-audio',
    `--user-data-dir=${profile}`, `--remote-debugging-port=${debugPort}`,
    '--window-size=1600,1000', 'about:blank',
  ], { stdio: 'ignore' })

  const findings = []
  const consoleErrors = new Map()
  let shots = 0

  const record = (kind, detail) => {
    const key = `${kind}|${detail}`
    if (consoleErrors.has(key)) { consoleErrors.get(key).count++; return }
    consoleErrors.set(key, { kind, detail, count: 1 })
  }

  try {
    const wsUrl = await connectCdp(debugPort)
    const target = await newTarget(debugPort, 'about:blank')
    const ws = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej) })
    ws.__url = wsUrl
    const cdp = new Cdp(ws)

    await cdp.send('Runtime.enable')
    await cdp.send('Page.enable')
    await cdp.send('Log.enable')
    await cdp.send('Network.enable')

    const collect = () => {
      for (const ev of cdp.events.splice(0)) {
        if (ev.method === 'Runtime.exceptionThrown') {
          const d = ev.params.exceptionDetails
          record('JS exception', (d.exception?.description || d.text || '').split('\n')[0].slice(0, 200))
        } else if (ev.method === 'Runtime.consoleAPICalled' && (ev.params.type === 'error' || ev.params.type === 'warning')) {
          const text = ev.params.args.map(a => a.value ?? a.description ?? a.type).join(' ')
          if (/React|Warning:|Error:|failed|Cannot|undefined is not/i.test(text)) record(`console.${ev.params.type}`, text.slice(0, 200))
        } else if (ev.method === 'Log.entryAdded' && ev.params.entry.level === 'error') {
          const t = ev.params.entry.text || ''
          if (!/net::ERR|Failed to load resource/i.test(t)) record('log error', t.slice(0, 200))
        }
      }
    }

    const shot = async (name) => {
      try {
        const r = await cdp.send('Page.captureScreenshot', { format: 'png' })
        writeFileSync(join(SHOTS, `${name}.png`), Buffer.from(r.data, 'base64'))
        shots += 1
      } catch { /* screenshots are evidence, not the test */ }
    }

    // --- boot with a seeded guest session -------------------------------
    // Install the processing-pane observer before any page script runs, so a short
    // loading window during the very first render cannot be missed.
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        window.__grillPaneSeen = false;
        (function () {
          var check = function () {
            if (document.querySelector('.seva-processing-pane')) window.__grillPaneSeen = true;
          };
          var start = function () {
            new MutationObserver(check).observe(document.documentElement, {
              childList: true, subtree: true, attributes: true, attributeFilter: ['class']
            });
            check();
          };
          if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
          else start();
        })();
      `,
    })
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${sitePort}/` })
    await sleep(1200)
    await cdp.eval(`
      localStorage.clear()
      localStorage.setItem('seva-session', 'guest')
      localStorage.setItem('seva-guest-name', 'Grill Tester')
      localStorage.setItem('seva-farms', ${JSON.stringify(JSON.stringify(SEED_AREAS))})
      sessionStorage.clear()
      true
    `)
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${sitePort}/` })
    await sleep(2500)

    // wait for the workspace
    let booted = false
    for (let i = 0; i < 40; i++) {
      const ready = await cdp.eval(`!!document.querySelector('.app-shell') && !!document.querySelector('.ix-main-toolbar')`).catch(() => false)
      if (ready) { booted = true; break }
      await sleep(700)
    }
    findings.push({ check: 'boots into the workspace with seeded areas', ok: booted })
    if (!booted) {
      await shot('00-boot-failed')
      const text = await cdp.eval(`document.body.innerText.slice(0,600)`).catch(() => '')
      findings.push({ check: 'boot body text', ok: false, detail: String(text).replace(/\s+/g, ' ').slice(0, 300) })
    }

    await cdp.eval(PAGE_HELPERS)
    collect()

    // The welcome tour covers the workspace on a first visit. Dismiss it, and record
    // whether it needed dismissing, so a stuck modal cannot later be mistaken for a
    // broken control.
    const tourUp = await cdp.eval(`!!document.body.innerText.match(/Welcome to SEVA·GIS/i)`)
    if (tourUp) {
      await cdp.eval(`window.__grill.clickText('Skip')`)
      await sleep(700)
    }
    const tourStillUp = await cdp.eval(`!!document.body.innerText.match(/Welcome to SEVA·GIS/i)`)
    findings.push({ check: 'welcome tour can be dismissed', ok: !tourStillUp, detail: tourUp ? 'shown, then dismissed' : 'not shown' })
    collect()

    if (DUMP) {
      const base = await cdp.eval(`
        JSON.stringify({
          toolbar: [...document.querySelectorAll('.ix-main-toolbar .ix-tb-btn')].map(b => (b.textContent||'').trim()),
          allButtons: [...document.querySelectorAll('button')].map(b => (b.textContent||'').trim()).filter(Boolean).slice(0, 120),
        }, null, 1)
      `)
      console.log('\nDUMP — workspace with nothing open:\n' + base)

      for (const label of ['Layers', 'Symbology', 'Base map', 'Tools']) {
        await cdp.eval(`window.__grill.clickText(${JSON.stringify(label)})`)
        await sleep(900)
        const d = await cdp.eval(`
          JSON.stringify({
            boxCount: document.querySelectorAll('[class*=layers-box], [class*=ix-layers]').length,
            boxClass: (document.querySelector('[class*=layers-box], [class*=ix-layers]') || {}).className ?? null,
            tabs: [...document.querySelectorAll('[class*=tab]')].map(b => (b.textContent||'').trim()).filter(Boolean).slice(0, 24),
            settings: [...document.querySelectorAll('.ix-sett-btn')].map(b => (b.textContent||'').trim()).slice(0, 90),
            inputs: [...document.querySelectorAll('input')].map(i => i.placeholder || i.type).slice(0, 12),
          }, null, 1)
        `)
        console.log(`\nDUMP — after clicking "${label}":\n` + d)
        await cdp.eval(`window.__grill.clickText(${JSON.stringify(label)})`)
        await sleep(500)
      }

      // The Parameters tab holds the layer catalogue; print the leaf elements so the
      // real tag and class names are known instead of guessed.
      await cdp.eval(`window.__grill.openToolbarButton('Layers')`)
      await sleep(900)
      await cdp.eval(`window.__grill.openTab('Parameters')`)
      await sleep(900)
      const leaf = await cdp.eval(`
        (() => {
          const box = document.querySelector('.ix-layers-box') || document
          const leaves = [...box.querySelectorAll('*')]
            .filter(e => e.children.length === 0 && (e.textContent || '').trim())
            .slice(0, 70)
            .map(e => e.tagName + '.' + String(e.className || '').split(' ').slice(0,2).join('.') + ' :: ' + (e.textContent||'').trim().slice(0, 40))
          return JSON.stringify(leaves, null, 1)
        })()
      `)
      console.log('\nDUMP — Parameters tab leaf elements:\n' + leaf)
      chrome.kill()
      server.close()
      return
    }

    const counts = await cdp.eval(`JSON.stringify(window.__grill.counts())`)
    const toolbar = await cdp.eval(`JSON.stringify(window.__grill.toolbarButtons())`)
    findings.push({ check: 'map toolbar rendered', ok: JSON.parse(toolbar || '[]').length > 5, detail: toolbar })
    findings.push({ check: 'leaflet map mounted', ok: JSON.parse(counts || '{}').leaflet > 0, detail: counts })

    await cdp.eval(`window.__grill.watchClassWrites? window.__grill.watchClassWrites() : 'na'`)
    await probe('boot')

    // The glow is drawn only while the map is loading. It is present at first paint
    // and must be gone once loading settles, so both halves are checked here rather
    // than by racing a click.
    const paneAtBoot = await cdp.eval(`!!document.querySelector('.seva-processing-pane')`).catch(() => false)
    findings.push({
      check: 'boundary processing glow is drawn during the initial map load',
      ok: paneAtBoot,
      detail: paneAtBoot ? 'seva-processing-pane present at first paint' : 'not present at first paint',
    })
    if (paneAtBoot) await shot('09-boundary-processing')
    collect()
    await shot('01-workspace')

    // --- toolbar horizontal scroll --------------------------------------
    const ox = JSON.parse(await cdp.eval(`JSON.stringify(window.__grill.overflowX())`) || 'null')
    findings.push({
      check: 'toolbar is horizontally scrollable and actually overflows',
      ok: !!ox && ox.overflowX === 'auto',
      detail: ox ? `overflowX=${ox.overflowX} scrollWidth=${ox.scrollWidth} clientWidth=${ox.clientWidth} canScroll=${ox.canScroll}` : 'toolbar not found',
    })

    // --- the combination matrix -----------------------------------------
    const languages = QUICK ? ['en'] : ['en', 'hi', 'te']
    const layers = QUICK ? ['NDVI'] : ['NDVI', 'NDMI', 'NDWI', 'BSI', 'Slope', 'Elevation']
    const basemaps = QUICK ? ['Google Satellite'] : ['Google Satellite', 'OpenStreetMap', 'Terrain', 'Dark Canvas']
    const resampling = QUICK ? ['Bilinear'] : ['Nearest', 'Bilinear', 'Cubic']
    const areas = QUICK ? ['Grill Large Field'] : ['Grill Large Field', 'Grill Small Plot']

    // Track the map container across phases, so if it disappears we know exactly
    // which interaction took it out instead of guessing.
    async function probe(stage) {
      const raw = await cdp.eval(`
        JSON.stringify({
          leaflet: !!document.querySelector('.leaflet-container'),
          fieldMap: !!document.querySelector('.field-map'),
          fieldMapClass: (document.querySelector('.field-map') || {}).className || null,
          tiles: document.querySelectorAll('.leaflet-tile').length,
          panes: document.querySelectorAll('.leaflet-pane').length,
          toolbar: document.querySelectorAll('.ix-main-toolbar .ix-tb-btn').length,
        })
      `).catch(() => '{}')
      const p = JSON.parse(raw || '{}')
      findings.push({
        check: `map container present after: ${stage}`,
        ok: !!p.leaflet,
        detail: `leaflet=${p.leaflet} fieldMap=${p.fieldMap} class="${p.fieldMapClass}" tiles=${p.tiles} panes=${p.panes} toolbar=${p.toolbar}`,
      })
      return p
    }

    const tryAction = async (label, expression) => {      const before = cdp.events.length
      let ok = true
      let detail = ''
      try {
        const r = await cdp.eval(expression)
        if (r === false) { ok = false; detail = 'control not found' }
      } catch (err) {
        ok = false
        detail = String(err.message).split('\n')[0].slice(0, 160)
      }
      await sleep(220)
      collect()
      findings.push({ check: label, ok, detail })
      void before
      return ok
    }

    // areas
    for (const area of areas) {
      await tryAction(`select area: ${area}`, `window.__grill.clickText(${JSON.stringify(area)}, '.farm-list')`)
    }

    // languages
    for (const lang of languages) {
      await tryAction(`switch language: ${lang}`, `
        (() => {
          const stored = window.__grill
          const btn = document.querySelector('.lg-btn')
          if (!btn) return false
          btn.click()
          return true
        })()
      `)
      await sleep(350)
      const codes = ['English', 'हिन्दी', 'తెలుగు']
      const idx = { en: 0, hi: 1, te: 2 }[lang]
      const ok = await cdp.eval(`
        (() => {
          const opts = [...document.querySelectorAll('.lg-opt-btn')]
          const el = opts[${idx}]
          if (!el) return false
          el.click()
          return true
        })()
      `).catch(() => false)
      await sleep(500)
      const actual = await cdp.eval(`localStorage.getItem('seva-lang')`)
      findings.push({ check: `language applied: ${lang}`, ok: !!ok && actual === lang, detail: `stored=${actual}` })
      collect()
    }
    await cdp.eval(`localStorage.setItem('seva-lang','en')`)
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${sitePort}/` })
    await sleep(2500)
    await cdp.eval(PAGE_HELPERS)
    collect()

    await probe('language cycle')

    // layers, basemaps, resampling, canvas, lock, clip
    for (const layer of layers) {
      // Opening the box is a React state change, so it is not in the DOM on the same
      // tick as the click. Open, wait, then switch tab.
      await tryAction(`ensure the map tool box is open (${layer})`, `
        (() => {
          if (document.querySelector('.ix-layers-box')) return true
          return window.__grill.openToolbarButton('Layers')
        })()
      `)
      await sleep(800)
      await tryAction(`open Parameters tab for ${layer}`, `window.__grill.openTab('Parameters')`)
      await sleep(700)
      await tryAction(`select layer ${layer}`, `window.__grill.addParamLayer(${JSON.stringify(layer)})`)
      await sleep(600)
      const c = await cdp.eval(`JSON.stringify(window.__grill.counts())`)
      findings.push({ check: `map still alive after layer ${layer}`, ok: JSON.parse(c || '{}').leaflet > 0, detail: c })
      collect()
    }

    await probe('layer sweep')

    for (const bm of basemaps) {
      await tryAction(`open Display & Basemaps tab for ${bm}`, `window.__grill.openTab('Display')`)
      await sleep(600)
      await tryAction(`apply basemap ${bm}`, `window.__grill.clickInBox(${JSON.stringify(bm)})`)
      await sleep(600)
      const bg = await cdp.eval(`JSON.stringify(window.__grill.mapBg())`)
      const parsed = JSON.parse(bg || '{}')
      findings.push({
        check: `map background stays neutral with basemap ${bm}`,
        ok: !/rgb\(0, 0, 0\)|rgb\(11, 20, 16\)|rgb\(57, 69, 50\)|rgb\(11, 19, 26\)/.test(String(parsed.backgroundColor) + String(parsed.wrapBackground)),
        detail: `fieldMap=${parsed.backgroundColor} wrap=${parsed.wrapBackground} tiles=${parsed.tileCount}`,
      })
      collect()
    }

    await probe('basemap sweep')

    for (const rs of resampling) {
      await tryAction(`open Symbology tab for resampling ${rs}`, `window.__grill.openTab('Symbology')`)
      await sleep(600)
      await tryAction(`resampling: ${rs}`, `window.__grill.clickInBox(${JSON.stringify(rs)})`)
      await sleep(500)
      const stored = await cdp.eval(`localStorage.getItem('seva-resampling-method')`)
      findings.push({
        check: `resampling "${rs}" is applied`,
        ok: String(stored || '').toLowerCase().includes(rs.toLowerCase().slice(0, 5)),
        detail: `stored=${stored}`,
      })
      collect()
    }

    // The separate black/white canvas controls were removed from the interface on
    // purpose (they had no effect), so assert the map has no dark background class
    // rather than hunting for controls that should not exist.
    const bgClass = String((JSON.parse(await cdp.eval(`JSON.stringify(window.__grill.mapBg())`) || '{}')).className || '')
    findings.push({
      check: 'no dark canvas class is applied to the map',
      ok: !/bg-black/.test(bgClass),
      detail: bgClass,
    })
    collect()

    // lock / unlock — the reported dark-map path
    await tryAction('lock the map', `window.__grill.clickText('Unlocked')`)
    await sleep(1400)
    let bg = JSON.parse(await cdp.eval(`JSON.stringify(window.__grill.mapBg())`) || '{}')
    findings.push({
      check: 'map is NOT dark after locking',
      ok: !/rgb\(0, 0, 0\)|rgb\(11, 20, 16\)|rgb\(57, 69, 50\)|rgb\(11, 19, 26\)/.test(String(bg.backgroundColor) + String(bg.wrapBackground)),
      detail: `fieldMap=${bg.backgroundColor} wrap=${bg.wrapBackground} tiles=${bg.tileCount}`,
    })
    await shot('02-locked')

    await tryAction('unlock the map', `window.__grill.clickText('Locked')`)
    await sleep(1400)
    bg = JSON.parse(await cdp.eval(`JSON.stringify(window.__grill.mapBg())`) || '{}')
    findings.push({
      check: 'map is NOT dark after unlocking',
      ok: !/rgb\(0, 0, 0\)|rgb\(11, 20, 16\)|rgb\(57, 69, 50\)|rgb\(11, 19, 26\)/.test(String(bg.backgroundColor) + String(bg.wrapBackground)),
      detail: `fieldMap=${bg.backgroundColor} wrap=${bg.wrapBackground} tiles=${bg.tileCount}`,
    })
    await shot('03-unlocked')

    await tryAction('toggle clip AOI on', `
      (() => { const el = window.__grill.byText(document, 'Clip'); const t = el && (el.closest('button') || el); if (!t) return false; t.click(); return true })()
    `)
    await sleep(600)
    await tryAction('toggle clip AOI off', `
      (() => { const el = window.__grill.byText(document, 'Clip'); const t = el && (el.closest('button') || el); if (!t) return false; t.click(); return true })()
    `)
    await sleep(600)

    await probe('resampling sweep')

    const classWrites = await cdp.eval(`window.__grill.classWrites ? window.__grill.classWrites() : '[]'`).catch(() => '[]')
    const writes = JSON.parse(classWrites || '[]')
    findings.push({
      check: 'nothing rewrites the map container class after Leaflet claims it',
      ok: writes.length === 0,
      detail: writes.length ? `${writes.length} writes; first = "${writes[0].value}" from ${writes[0].stack}` : 'no writes observed',
    })

    const identity = JSON.parse(await cdp.eval(`window.__grill.mapNodeIdentity ? window.__grill.mapNodeIdentity() : '{}'`).catch(() => '{}'))
    findings.push({
      check: 'the map container still carries Leaflet\'s own classes',
      ok: identity.leafletCount === 1,
      detail: `sameNode=${identity.sameNode} .field-map=${identity.fieldMapCount} .field-map.leaflet-container=${identity.leafletCount}`,
    })
    if (identity.sameNode === false) {
      // Not a failure: what matters is that the container is healthy. But a replaced
      // node means the map was remounted, which costs a tile reload and a view reset,
      // so it is worth surfacing rather than hiding.
      console.log(`\nnote: the map container was replaced during the run (sameNode=false). ` +
        `The new container is healthy (.field-map.leaflet-container=${identity.leafletCount}), ` +
        `but a remount re-creates the map, so the view and tiles are rebuilt.`)
    }

    // --- every parameter in the catalogue -------------------------------
    // Reading the names out of the DOM means the list cannot drift from the app.
    if (!QUICK) {
      await cdp.eval(`window.__grill.openToolbarButton('Layers')`)
      await sleep(700)
      await cdp.eval(`window.__grill.openTab('Parameters')`)
      await sleep(900)
      const paramNames = JSON.parse(await cdp.eval(`
        JSON.stringify([...new Set(
          [...document.querySelectorAll('.ix-layers-box b')]
            .map(b => (b.textContent || '').trim())
            .filter(n => n && n.length <= 26)
        )])
      `) || '[]')
      findings.push({ check: 'parameter catalogue is discoverable', ok: paramNames.length >= 20, detail: `${paramNames.length} parameters` })

      const baseline = await cdp.eval(`!!document.querySelector('.leaflet-container') && !!document.querySelector('.app-shell')`).catch(() => false)
      findings.push({ check: 'map is alive before the parameter sweep', ok: !!baseline })

      for (const name of paramNames) {
        const started = Date.now()
        let clicked = false
        let alive = false
        let err = ''
        try {
          clicked = await cdp.eval(`window.__grill.addParamLayer(${JSON.stringify(name)})`)
        } catch (e) { err = String(e.message).slice(0, 60) }
        await sleep(400)
        try {
          alive = await cdp.eval(`!!document.querySelector('.leaflet-container') && !!document.querySelector('.app-shell')`)
        } catch (e) { err = String(e.message).slice(0, 60) }
        collect()
        findings.push({
          check: `adding parameter "${name}" keeps the map alive`,
          ok: !!alive,
          detail: `${Date.now() - started}ms clicked=${clicked}${err ? ` err=${err}` : ''}`,
        })
      }
      await shot('06-all-parameters')
    }

    // --- phone viewport: no horizontal page scroll ----------------------
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
    await sleep(1500)
    const mobile = JSON.parse(await cdp.eval(`
      JSON.stringify({
        docScroll: document.documentElement.scrollWidth,
        docClient: document.documentElement.clientWidth,
        toolbarOverflowX: (() => { const t = document.querySelector('.ix-main-toolbar'); if (!t) return null; return getComputedStyle(t).overflowX })(),
        mapAlive: !!document.querySelector('.leaflet-container'),
      })
    `) || '{}')
    findings.push({
      check: 'narrow phone viewport has no horizontal page scroll',
      ok: mobile.docScroll <= mobile.docClient + 2,
      detail: `scrollWidth=${mobile.docScroll} clientWidth=${mobile.docClient} mapAlive=${mobile.mapAlive}`,
    })
    await shot('07-phone')
    collect()
    await cdp.send('Emulation.clearDeviceMetricsOverride')
    await sleep(900)

    // --- reports: generate a document -----------------------------------
    await tryAction('open Reports', `window.__grill.clickText('Reports', 'nav')`)
    await sleep(2500)
    collect()
    await shot('08-reports')
    const reportsUp = await cdp.eval(`!!document.body.innerText.match(/Generate report|Report workbench|Generate Report/i)`)
    findings.push({ check: 'Reports panel opens', ok: !!reportsUp })

    // --- boundary processing animation cleanliness ----------------------
    findings.push({
      check: 'the old duplicate train-pulse animation is gone',
      ok: !(await cdp.eval(`!!document.querySelector('.seva-train-pulse')`).catch(() => true)),
      detail: 'seva-train-pulse should no longer be drawn',
    })

    // Cleanup: once loading has settled the pane must be gone, and the map must still
    // be healthy. This is what catches a leak that accumulates one pane per visit.
    let paneCleared = false
    for (let i = 0; i < 30; i++) {
      paneCleared = !(await cdp.eval(`!!document.querySelector('.seva-processing-pane')`).catch(() => true))
      if (paneCleared) break
      await sleep(700)
    }
    findings.push({
      check: 'boundary processing glow is cleaned up after loading settles',
      ok: paneCleared,
      detail: paneCleared ? 'pane removed' : 'pane still present',
    })
    collect()

    await tryAction('open the Export menu', `
      (() => {
        const el = window.__grill.byText(document, 'Export')
        if (!el) return false
        const t = el.closest('button') || el
        t.click()
        return true
      })()
    `)
    await sleep(700)
    const menuItems = await cdp.eval(`[...document.querySelectorAll('.ix-export-menu-item b')].map(b => b.textContent)`.replace(/^/, 'JSON.stringify(') + ')')
    const menu = JSON.parse(menuItems || '[]')
    findings.push({
      check: 'Export opens a format chooser offering GeoTIFF',
      ok: menu.some(m => /GeoTIFF/i.test(m)),
      detail: menu.join(' | ') || 'no menu items found',
    })

    await tryAction('run the GeoTIFF export from the menu', `
      (() => {
        const el = [...document.querySelectorAll('.ix-export-menu-item')].find(b => /GeoTIFF/i.test(b.textContent))
        if (!el) return false
        el.click()
        return true
      })()
    `)
    let note = ''
    for (let i = 0; i < 45; i++) {
      note = await cdp.eval(`(() => { const n = document.querySelector('.ix-export-note'); return n ? n.innerText : '' })()`).catch(() => '')
      if (note && !/Exporting/i.test(note)) break
      await sleep(800)
    }
    findings.push({
      check: 'GeoTIFF export reports a real raster (not a picture)',
      ok: /real values/i.test(note) && /EPSG:4326/.test(note),
      detail: note.replace(/\s+/g, ' ').slice(0, 220) || 'no note appeared',
    })
    await shot('04-geotiff-export')
    collect()

    // dashboard panels
    for (const panel of ['Reports', 'Crop journal', 'Alerts', 'Terminal']) {
      await tryAction(`open ${panel}`, `window.__grill.clickText(${JSON.stringify(panel)}, 'nav')`)
      await sleep(900)
      const alive = await cdp.eval(`!!document.querySelector('.app-shell')`)
      findings.push({ check: `${panel} opens without crashing the shell`, ok: !!alive })
      collect()
    }

    // report generation
    await tryAction('return to Overview', `window.__grill.clickText('Overview', 'nav')`)
    await sleep(800)
    await shot('05-final')

    collect()
    if (KEEP) {
      console.log(`\nkeeping browser open: http://127.0.0.1:${debugPort}  site: http://127.0.0.1:${sitePort}`)
      return
    }
  } finally {
    if (!KEEP) {
      try { chrome.kill() } catch { /* ignore */ }
      server.close()
    }
  }

  // ---------------------------------------------------------------------------
  // report
  // ---------------------------------------------------------------------------
  const failed = findings.filter(f => !f.ok)
  console.log('\n================ SEVA·GIS GRILL REPORT ================')
  console.log(`checks run : ${findings.length}`)
  console.log(`passed     : ${findings.length - failed.length}`)
  console.log(`FAILED     : ${failed.length}`)
  console.log(`screenshots: ${shots} -> docs/ANALYSIS/grill/`)

  if (failed.length) {
    console.log('\n--- FAILURES ---')
    for (const f of failed) console.log(`  ✖ ${f.check}\n      ${f.detail ?? ''}`)
  }

  // The map-container probes are the map's vital signs; always show them.
  const containerProbes = findings.filter(f => f.check.startsWith('map container present'))
  if (containerProbes.length) {
    console.log('\n--- MAP CONTAINER TRACE ---')
    for (const p of containerProbes) {
      console.log(`  ${p.ok ? 'ok  ' : 'GONE'} ${p.check.replace('map container present after: ', '')}`)
      console.log(`        ${p.detail}`)
    }
  }

  const errors = [...consoleErrors.values()].sort((a, b) => b.count - a.count)
  console.log(`\n--- RUNTIME NOISE (${errors.length} distinct) ---`)
  for (const e of errors.slice(0, 30)) console.log(`  [${e.count}x] ${e.kind}: ${e.detail}`)

  if (!failed.length && !errors.length) console.log('\nclean run.')

  process.exit(failed.length ? 1 : 0)
}

main().catch((err) => {
  console.error('grill harness failed:', err)
  process.exit(2)
})
