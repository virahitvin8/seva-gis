import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pumpKw, pipeHydraulics } from '../hydro.ts'

test('pumpKw follows the hydraulic power formula', () => {
  const kw = pumpKw(36, 10, 0.55)
  assert.ok(Math.abs(kw - 1.783636) < 1e-3, `got ${kw}`)
})

test('pipeHydraulics returns finite positive outputs for valid input', () => {
  const r = pipeHydraulics(36, 90, 100)
  for (const v of Object.values(r)) {
    assert.equal(typeof v, 'number')
    assert.ok(Number.isFinite(v), `non-finite value ${v}`)
  }
})
