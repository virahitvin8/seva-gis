/// <reference types="vite/client" />

declare module 'shpjs' {
  export function parseZip(buf: ArrayBuffer | Uint8Array): Promise<any>
  export function parseShp(shp: ArrayBuffer | Uint8Array, prj?: string): any[]
  export function combine(a: [any, any]): any
  const shp: (buf: ArrayBuffer | Uint8Array | string) => Promise<any>
  export default shp
}
