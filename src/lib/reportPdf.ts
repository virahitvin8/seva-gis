/**
 * SEVA·GIS — real report PDF path.
 *
 * The report is generated as a rich, multi-page HTML document (see
 * `src/reportBuilder.ts`), complete with cover page, maps, legends, scale bars,
 * tables and page breaks. A browser cannot silently rasterise that document into
 * a PDF without either a server or a heavy canvas library.
 *
 * The previous implementation worked around that by hand-writing a three-page
 * plain-text PDF stub, which is why the download never matched the preview — the
 * user saw a rich report and received a text file.
 *
 * The honest, lossless fix is to hand the *exact* preview document to the
 * browser's own print-to-PDF engine. Page breaks, maps, colours and fonts are
 * preserved, and the file the user saves is the document they previewed.
 */

const FRAME_ID = 'seva-report-print-frame'

/** Milliseconds to wait for a single remote asset before printing anyway. */
const ASSET_TIMEOUT_MS = 12_000

/**
 * Opens the browser print dialog for a generated report document so the user can
 * save it as a PDF. The document is rendered in a hidden, same-origin iframe, so
 * the on-screen preview is never disturbed.
 *
 * @param html   Full report document markup, exactly as shown in the preview.
 * @param title  Suggested document title (used as the PDF title).
 */
export function openReportPrintView(html: string, title: string): void {
  document.getElementById(FRAME_ID)?.remove()

  const frame = document.createElement('iframe')
  frame.id = FRAME_ID
  frame.setAttribute('aria-hidden', 'true')
  frame.setAttribute('title', title)
  frame.style.cssText =
    'position:fixed;right:0;bottom:0;width:1100px;height:800px;border:0;opacity:0;pointer-events:none;z-index:-1'

  document.body.appendChild(frame)

  const win = frame.contentWindow
  const doc = frame.contentDocument
  if (!win || !doc) {
    frame.remove()
    return
  }

  doc.open()
  doc.write(html)
  doc.close()
  doc.title = title

  let printed = false
  const print = () => {
    if (printed) return
    printed = true
    try {
      win.focus()
      win.print()
    } catch {
      // A blocked print dialog leaves the iframe in place; the user can still
      // use the preview's own print control.
    }
    // Keep the frame long enough for slow spoolers, then clean up.
    window.setTimeout(() => frame.remove(), 60_000)
  }

  /**
   * Map tiles and fonts are remote. Printing before they settle produces a PDF
   * with blank map panels, which is the other half of the "bad PDF" complaint.
   */
  const printWhenReady = () => {
    const images = Array.from(doc.images ?? [])
    const pending = images.filter(image => !image.complete)

    if (pending.length === 0) {
      window.setTimeout(print, 400)
      return
    }

    let remaining = pending.length
    const settle = () => {
      remaining -= 1
      if (remaining <= 0) window.setTimeout(print, 400)
    }

    for (const image of pending) {
      image.addEventListener('load', settle, { once: true })
      image.addEventListener('error', settle, { once: true })
    }

    // Never let one dead tile block the PDF forever.
    window.setTimeout(print, ASSET_TIMEOUT_MS)
  }

  window.setTimeout(printWhenReady, 400)
}
