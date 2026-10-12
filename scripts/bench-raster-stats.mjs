// Evidence for the Wave 1 performance fix.
// Compares the old "copy everything then sort" statistics path against the new
// histogram path at the real grid size SEVA·GIS uses (900 x 900 = 810,000 values),
// across the number of indicators a single analysis evaluates.

const N = 810_000
const INDICATORS = 13

function makeValues(n) {
  const a = new Float32Array(n)
  for (let i = 0; i < n; i++) a[i] = Math.sin(i * 0.0001) * 0.5 + 0.5
  return a
}

function oldStatsOf(values, range) {
  const xs = new Float32Array(values.length)
  let n = 0, sum = 0, min = Infinity, max = -Infinity
  for (let i = 0; i < values.length; i++) {
    const v = values[i]
    if (!Number.isFinite(v) || v < range[0] || v > range[1]) continue
    xs[n++] = v
    sum += v
    if (v < min) min = v
    if (v > max) max = v
  }
  if (!n) return null
  const sorted = xs.subarray(0, n).sort() // <-- the main-thread killer
  const q = (p) => sorted[Math.min(n - 1, Math.floor(p * n))]
  return { mean: sum / n, min, max, p10: q(0.1), p50: q(0.5), p90: q(0.9), n }
}

function newStatsOf(values, range) {
  const inRange = (v) => Number.isFinite(v) && v >= range[0] && v <= range[1]
  let n = 0, sum = 0, min = Infinity, max = -Infinity
  for (let i = 0; i < values.length; i++) {
    const v = values[i]
    if (!inRange(v)) continue
    n++; sum += v
    if (v < min) min = v
    if (v > max) max = v
  }
  if (!n) return null
  const span = max - min
  const BINS = 2048
  const binWidth = span / BINS
  const scale = span > 0 ? BINS / span : 0
  const hist = new Uint32Array(BINS)
  for (let i = 0; i < values.length; i++) {
    const v = values[i]
    if (!inRange(v)) continue
    let b = Math.floor((v - min) * scale)
    if (b < 0) b = 0
    else if (b >= BINS) b = BINS - 1
    hist[b]++
  }
  const quantile = (p) => {
    const target = Math.floor(p * n)
    let cum = 0
    for (let b = 0; b < BINS; b++) {
      cum += hist[b]
      if (cum > target) return Math.min(max, min + (b + 0.5) * binWidth)
    }
    return max
  }
  return { mean: sum / n, min, max, p10: quantile(0.1), p50: quantile(0.5), p90: quantile(0.9), n }
}

const values = makeValues(N)
const range = [0, 1]

// warm up
oldStatsOf(makeValues(1000), range)
newStatsOf(makeValues(1000), range)

let t = process.hrtime.bigint()
for (let i = 0; i < INDICATORS; i++) oldStatsOf(values, range)
const oldMs = Number(process.hrtime.bigint() - t) / 1e6

t = process.hrtime.bigint()
for (let i = 0; i < INDICATORS; i++) newStatsOf(values, range)
const newMs = Number(process.hrtime.bigint() - t) / 1e6

const oldOut = oldStatsOf(values, range)
const newOut = newStatsOf(values, range)

console.log(`grid            : ${N.toLocaleString()} values (900 x 900)`)
console.log(`indicators      : ${INDICATORS} per analysis`)
console.log(`old (sort)      : ${oldMs.toFixed(0)} ms   <- blocked the main thread`)
console.log(`new (histogram) : ${newMs.toFixed(0)} ms`)
console.log(`speed-up        : ${(oldMs / newMs).toFixed(1)}x  (saves ${(oldMs - newMs).toFixed(0)} ms per analysis)`)
console.log('')
console.log('accuracy at the same grid:')
for (const k of ['mean', 'min', 'max', 'p10', 'p50', 'p90']) {
  const delta = Math.abs(oldOut[k] - newOut[k])
  console.log(`  ${k.padEnd(5)} old=${oldOut[k].toFixed(5)}  new=${newOut[k].toFixed(5)}  delta=${delta.toExponential(2)}`)
}
