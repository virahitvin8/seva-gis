// Async bridge to the raster statistics worker. When Web Workers are unavailable
// (server-side/tests) or the worker fails, it transparently falls back to the
// synchronous implementation so results are identical.
import { statsOf, type Stat } from './raster'
import type { RasterStatRequest as WorkerRequest, RasterStatResponse } from './rasterStats.worker'

export type RasterStatRequest = {
  values: Float32Array
  range: [number, number]
  mask?: Uint8Array
}

const okFromMask = (mask?: Uint8Array) => (mask ? (i: number) => mask[i] === 1 : () => true)

let worker: Worker | null | undefined
let seq = 0

function getWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null
  if (worker === undefined) {
    try {
      worker = new Worker(new URL('./rasterStats.worker.ts', import.meta.url), { type: 'module' })
    } catch {
      worker = null
    }
  }
  return worker
}

/**
 * Runs the per-pixel scan and statistics off the main thread.
 *
 * @param transfer When true, the value and mask buffers are *moved* to the worker
 *   instead of being structurally cloned. A 900 x 900 grid is 3.2 MB of floats per
 *   indicator, so cloning a dozen of them costs tens of megabytes of main-thread
 *   copying on every analysis. Only pass `true` when the caller does not need the
 *   arrays again — transferring detaches them on this side.
 */
export function statsOfAsync(req: RasterStatRequest, transfer = false): Promise<Stat | null> {
  const w = getWorker()
  if (!w) return Promise.resolve(statsOf(req.values, okFromMask(req.mask), req.range))

  return new Promise<Stat | null>((resolve) => {
    const id = ++seq
    const cleanup = () => {
      w.removeEventListener('message', onMessage)
      w.removeEventListener('error', onError)
    }
    const onMessage = (event: MessageEvent<RasterStatResponse>) => {
      if (event.data?.id !== id) return
      cleanup()
      resolve(event.data.stat)
    }
    // On worker failure, degrade to the main thread instead of failing the analysis.
    // When the buffers were transferred they no longer exist here, so the only honest
    // answer is null: the caller reports the indicator as unavailable rather than wrong.
    const onError = () => {
      cleanup()
      resolve(transfer ? null : statsOf(req.values, okFromMask(req.mask), req.range))
    }
    w.addEventListener('message', onMessage)
    w.addEventListener('error', onError, { once: true })
    const message: WorkerRequest = { id, values: req.values, range: req.range, mask: req.mask }

    if (transfer) {
      const buffers: ArrayBuffer[] = [req.values.buffer as ArrayBuffer]
      if (req.mask) buffers.push(req.mask.buffer as ArrayBuffer)
      w.postMessage(message, buffers)
    } else {
      w.postMessage(message)
    }
  })
}
