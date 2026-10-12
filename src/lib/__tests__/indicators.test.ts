import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compass, gradientCss, byId, bandFor } from '../indicators.ts'

test('compass maps bearings to the eight cardinal points', () => {
  assert.equal(compass(0), 'N')
  assert.equal(compass(45), 'NE')
  assert.equal(compass(90), 'E')
  assert.equal(compass(180), 'S')
  assert.equal(compass(270), 'W')
  assert.equal(compass(360), 'N')
})

test('gradientCss builds a left-to-right CSS gradient', () => {
  assert.equal(gradientCss(['#111111', '#222222']), 'linear-gradient(90deg, #111111, #222222)')
})

test('byId finds known indicators and bandFor returns a band or undefined', () => {
  assert.ok(byId('ndvi'))
  assert.equal(byId('ndvi').id, 'ndvi')
  const band = bandFor('ndvi', 0.5)
  assert.ok(band === undefined || typeof band.label === 'string')
})
