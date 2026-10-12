import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AOI_FILL, FIT_PADDING, MIN_PADDING, aoiFit, makeView } from '../reportView.ts'

// A ~2 km square area of interest near Hyderabad.
const FB: [number, number, number, number] = [78.4, 17.4, 78.42, 17.42]

test('report maps centre the area of interest', () => {
  const view = makeView(FB)
  const centreLon = (view.bbox[0] + view.bbox[2]) / 2
  const centreLat = (view.bbox[1] + view.bbox[3]) / 2
  assert.ok(Math.abs(centreLon - (FB[0] + FB[2]) / 2) < 1e-9, 'longitude centre drifted')
  assert.ok(Math.abs(centreLat - (FB[1] + FB[3]) / 2) < 1e-9, 'latitude centre drifted')
})

test('the area of interest fills about three quarters of the report map frame', () => {
  const fit = aoiFit(FB, makeView(FB))
  assert.ok(
    fit.fill >= AOI_FILL - 0.02 && fit.fill <= AOI_FILL + 0.02,
    `expected ~${AOI_FILL} on the binding axis, got ${fit.fill.toFixed(3)}`,
  )
  assert.ok(fit.fits, `the area of interest overflowed the frame: x=${fit.fillX}, y=${fit.fillY}`)
})

test('the old 2.4 padding factor is what made the area of interest look small', () => {
  // Regression guard: the previous behaviour shrank the AOI to roughly 42% of the frame.
  const previousCoverage = 1 / 2.4
  assert.ok(previousCoverage < 0.45, 'the old framing really was under half the frame')
  assert.ok(FIT_PADDING < 2.4, 'the new padding is tighter than the old one')
})

test('an explicit zoom never crops the area of interest', () => {
  for (const zoom of [19, 21, 25, 40]) {
    const view = makeView(FB, 684, 424, zoom)
    const [west, south, east, north] = FB
    assert.ok(view.bbox[0] <= west && view.bbox[2] >= east, `zoom ${zoom} cropped the AOI horizontally`)
    assert.ok(view.bbox[1] <= south && view.bbox[3] >= north, `zoom ${zoom} cropped the AOI vertically`)
    assert.ok(view.mpp > 0, 'metres per pixel must stay positive')
  }
})

test('the minimum padding floor keeps the boundary off the frame edge', () => {
  assert.ok(MIN_PADDING > 1)
  const fit = aoiFit(FB, makeView(FB, 684, 424, 60))
  assert.ok(fit.fill < 1, `AOI must not run edge to edge, got ${fit.fill}`)
  assert.ok(fit.fits, 'the AOI must still fit inside the frame at extreme zoom')
})

test('a tall area of interest is also fitted without cropping', () => {
  const tall: [number, number, number, number] = [78.4, 17.4, 78.405, 17.44]
  const fit = aoiFit(tall, makeView(tall))
  assert.ok(fit.fits, `tall AOI overflowed: x=${fit.fillX}, y=${fit.fillY}`)
  assert.ok(fit.fill <= AOI_FILL + 0.02, `tall AOI over-filled: ${fit.fill}`)
})
