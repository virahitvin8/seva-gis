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

export function statsOfAsync(req: RasterStatRequest): Promise<Stat | null> {
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
    const onError = () => {
      cleanup()
      resolve(statsOf(req.values, okFromMask(req.mask), req.range))
    }
    w.addEventListener('message', onMessage)
    w.addEventListener('error', onError, { once: true })
    const message: WorkerRequest = { id, values: req.values, range: req.range, mask: req.mask }
    w.postMessage(message)
  })
}
