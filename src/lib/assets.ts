import { useSyncExternalStore } from 'react'

export type Borewell = { id: string; farmId: string; name: string; lat: number; lon: number; depth: number; level: number; yieldM3h: number; hours: number }
export type Pipeline = { id: string; farmId: string; name: string; pts: [number, number][]; dia: number; flow: number }
type Store = { borewells: Borewell[]; pipelines: Pipeline[] }

const KEY = 'seva-assets'
let state: Store = (() => { try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); return { borewells: v?.borewells ?? [], pipelines: v?.pipelines ?? [] } } catch { return { borewells: [], pipelines: [] } } })()
const subs = new Set<() => void>()
const commit = (next: Store) => { state = next; try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* storage full */ } subs.forEach(f => f()) }
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
const uid = () => Math.random().toString(36).slice(2, 9)

export const useAssets = () => useSyncExternalStore(subscribe, () => state)
export const addBorewell = (b: Omit<Borewell, 'id'>) => commit({ ...state, borewells: [...state.borewells, { ...b, id: uid() }] })
export const updateBorewell = (id: string, p: Partial<Borewell>) => commit({ ...state, borewells: state.borewells.map(b => (b.id === id ? { ...b, ...p } : b)) })
export const removeBorewell = (id: string) => commit({ ...state, borewells: state.borewells.filter(b => b.id !== id) })
export const addPipeline = (p: Omit<Pipeline, 'id'>) => commit({ ...state, pipelines: [...state.pipelines, { ...p, id: uid() }] })
export const updatePipeline = (id: string, p: Partial<Pipeline>) => commit({ ...state, pipelines: state.pipelines.map(x => (x.id === id ? { ...x, ...p } : x)) })
export const removePipeline = (id: string) => commit({ ...state, pipelines: state.pipelines.filter(x => x.id !== id) })

export function lengthM(pts: [number, number][]) {
  let d = 0
  for (let i = 1; i < pts.length; i++) {
    const [lo1, la1] = pts[i - 1], [lo2, la2] = pts[i], r = Math.PI / 180
    const a = Math.sin(((la2 - la1) * r) / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(((lo2 - lo1) * r) / 2) ** 2
    d += 12742000 * Math.asin(Math.sqrt(a))
  }
  return d
}
