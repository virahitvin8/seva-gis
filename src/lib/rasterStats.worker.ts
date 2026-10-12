// Raster statistics worker: keeps the heavy per-pixel scan and sort off the main
// thread so large AOIs do not freeze the interface.
import { statsOf, type Stat } from './raster'

export type RasterStatRequest = {
  id: number
  values: Float32Array
  range: [number, number]
  mask?: Uint8Array
}

export type RasterStatResponse = { id: number; stat: Stat | null }

self.onmessage = (event: MessageEvent<RasterStatRequest>) => {
  const { id, values, range, mask } = event.data
  const ok = mask ? (i: number) => mask[i] === 1 : () => true
  const response: RasterStatResponse = { id, stat: statsOf(values, ok, range) }
  self.postMessage(response)
}
