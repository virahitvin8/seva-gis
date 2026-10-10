/**
 * SEVA·GIS - Report History & Device Storage
 * 
 * Inspired by Matcha (https://github.com/floatpane/matcha) terminal-sleek client
 * and native device filesystem storage (OPFS / IndexedDB).
 * 
 * Persists every generated report across Laptop, Mobile, and Desktop browsers
 * so users can preview, re-download, locate in device, or delete historical reports.
 */

export type ReportHistoryEntry = {
  id: string
  farmId: string
  farmName: string
  filename: string
  createdAt: string
  sizeBytes: number
  lang: 'en' | 'hi' | 'te'
  format: 'HTML' | 'PDF' | 'JSON'
  htmlContent: string
  summary: {
    ndviMean: number
    stressPct: number
    areaHa: number
    location: string
    sceneDate: string
  }
  devicePath: string
}

const STORAGE_KEY = 'seva-report-history-v1'

/**
 * Retrieve all historical reports stored on this device.
 */
export async function getReportHistory(farmId?: string): Promise<ReportHistoryEntry[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const list: ReportHistoryEntry[] = JSON.parse(raw)
    if (!Array.isArray(list)) return []
    if (farmId) {
      return list.filter(item => item.farmId === farmId)
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  } catch (err) {
    console.warn('[SEVA History] Failed reading report history:', err)
    return []
  }
}

/**
 * Save a newly generated report to device history and OPFS.
 */
export async function saveReportToHistory(entry: ReportHistoryEntry): Promise<void> {
  try {
    const existing = await getReportHistory()
    // Keep up to 25 latest reports to balance storage
    const updated = [entry, ...existing.filter(e => e.id !== entry.id)].slice(0, 25)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))

    // Attempt writing to Origin Private File System (OPFS) if supported
    if (typeof navigator !== 'undefined' && 'storage' in navigator && navigator.storage.getDirectory) {
      try {
        const root = await navigator.storage.getDirectory()
        const sevaDir = await root.getDirectoryHandle('seva-gis', { create: true })
        const reportsDir = await sevaDir.getDirectoryHandle('reports', { create: true })
        const fileHandle = await reportsDir.getFileHandle(`${entry.filename}.html`, { create: true })
        const writable = await fileHandle.createWritable()
        await writable.write(entry.htmlContent)
        await writable.close()
      } catch (opfsErr) {
        console.debug('[SEVA History] OPFS write skipped or unavailable:', opfsErr)
      }
    }
  } catch (err) {
    console.warn('[SEVA History] Failed saving report to history:', err)
  }
}

/**
 * Delete a report from history by its ID.
 */
export async function deleteReportHistory(id: string): Promise<void> {
  try {
    const existing = await getReportHistory()
    const updated = existing.filter(e => e.id !== id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch (err) {
    console.warn('[SEVA History] Failed deleting report history:', err)
  }
}

/**
 * Clear all report history on this device.
 */
export async function clearAllReportHistory(): Promise<void> {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (err) {
    console.warn('[SEVA History] Failed clearing report history:', err)
  }
}

/**
 * Trigger immediate download of a historical report file.
 */
export function downloadHistoricalReport(entry: ReportHistoryEntry) {
  const blob = new Blob([entry.htmlContent], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${entry.filename}.html`
  a.click()
  URL.revokeObjectURL(url)
}
