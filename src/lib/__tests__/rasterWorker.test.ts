import { test } from 'node:test'
import assert from 'node:assert/strict'
import { statsOfAsync } from '../rasterWorker.ts'

test('statsOfAsync matches statsOf through the fallback path', async () => {
  const s = await statsOfAsync({ values: new Float32Array([1, 2, 3, 4, 5]), range: [-Infinity, Infinity] })
  assert.ok(s)
  assert.equal(s.n, 5)
  assert.equal(s.mean, 3)
  assert.equal(s.p50, 3)
})

test('statsOfAsync honours the validity mask in the fallback path', async () => {
  const mask = new Uint8Array([1, 0, 1, 0, 1])
  const s = await statsOfAsync({ values: new Float32Array([1, 2, 3, 4, 5]), range: [-Infinity, Infinity], mask })
  assert.ok(s)
  assert.equal(s.n, 3)
  assert.equal(s.mean, 3)
})
