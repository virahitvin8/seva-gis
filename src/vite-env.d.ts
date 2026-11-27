/// <reference types="vite/client" />

declare const __SEVA_APP_VERSION__: string;
declare const __SEVA_BUILD_COMMIT__: string;
declare const __SEVA_BUILD_NUMBER__: number;
declare const __SEVA_BUILD_DATE__: string;
declare const __SEVA_APK_VERSION_CODE__: number;

declare module 'shpjs' {
  export function parseZip(buf: ArrayBuffer | Uint8Array): Promise<any>
  export function parseShp(shp: ArrayBuffer | Uint8Array, prj?: string): any[]
  export function combine(a: [any, any]): any
  const shp: (buf: ArrayBuffer | Uint8Array | string) => Promise<any>
  export default shp
}
