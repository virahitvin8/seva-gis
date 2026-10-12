// Entry for `npm test`. Registers a synchronous resolve hook so Node's built-in
// test runner can import this repo's TypeScript modules that use extensionless
// relative imports (e.g. `from './raster'`), which bundlers allow but Node ESM does not.
import { registerHooks } from 'node:module'

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context)
    } catch (err) {
      const relative = specifier.startsWith('./') || specifier.startsWith('../') || specifier.startsWith('/')
      if (relative) {
        for (const ext of ['.ts', '.tsx', '/index.ts']) {
          try {
            return nextResolve(specifier + ext, context)
          } catch {
            // try the next candidate extension
          }
        }
      }
      throw err
    }
  },
})
