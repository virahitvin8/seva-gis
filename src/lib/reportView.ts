/**
 * Framing rules for every map printed inside a SEVA·GIS report.
 *
 * The area of interest must be centred and must fill about 75% of the map frame.
 * The previous padding factor of 2.4 shrank the AOI to roughly 42% of the frame,
 * which is the "large map with a small box in the middle" that was reported.
 *
 * A padding factor of 1 / 0.75 = 1.333 makes the area of interest occupy 75% of the
 * frame with equal margins. `MIN_PADDING` stops an explicit user zoom from cropping
 * the boundary itself: the whole area of interest must always remain visible.
 *
 * This lives on its own so the rule can be tested directly, without loading the
 * whole report builder.
 */

export type View = {
  bbox: [number, number, number, number]
  W: number
  H: number
  mpp: number
  px: (lon: number, lat: number) => [number, number]
}

/** Fraction of the map frame the area of interest should occupy. */
export const AOI_FILL = 0.75

/** Padding factor that produces AOI_FILL, with equal margins on every side. */
export const FIT_PADDING = 1 / AOI_FILL

/** Never crop the boundary, whatever zoom the user chose. */
export const MIN_PADDING = 1.06

export function makeView(fb: [number, number, number, number], W = 684, H = 424, customZoom?: number): View {
  const lat0 = (fb[1] + fb[3]) / 2, k = Math.cos((lat0 * Math.PI) / 180)

  let paddingFactor = FIT_PADDING
  if (customZoom && customZoom > 19) {
    // Respect a deliberate zoom past 19 on the live map, but never past the point
    // where the area of interest would be cut off.
    paddingFactor = Math.max(MIN_PADDING, FIT_PADDING / Math.pow(1.15, customZoom - 19))
  }

  const needW = (fb[2] - fb[0]) * 111320 * k * paddingFactor, needH = (fb[3] - fb[1]) * 111320 * paddingFactor
  const mpp = Math.max(needW / W, needH / H, 0.4)
  const dLat = (H * mpp) / 111320, dLon = (W * mpp) / (111320 * k)
  const cx = (fb[0] + fb[2]) / 2, cy = lat0
  const bbox: View['bbox'] = [cx - dLon / 2, cy - dLat / 2, cx + dLon / 2, cy + dLat / 2]
  return {
    bbox,
    W,
    H,
    mpp,
    px: (lon, lat) => [((lon - bbox[0]) / (bbox[2] - bbox[0])) * W, ((bbox[3] - lat) / (bbox[3] - bbox[1])) * H],
  }
}

/**
 * How the area of interest sits inside the map frame.
 *
 * The frame has a fixed aspect ratio (672 x 424 by default) that rarely matches the
 * area of interest, so a square parcel in a wide frame cannot reach 75% on *both*
 * axes without being cropped. The rule is therefore:
 *
 *   - `fill` is the best axis, and must reach AOI_FILL (0.75);
 *   - `fits` must be true — neither axis may overflow, so the whole boundary stays visible;
 *   - whatever is left over on the other axis is where the legend, scale bar and north
 *     arrow go, which is normal cartographic layout rather than wasted space.
 */
export type AoiFit = { fill: number; fits: boolean; fillX: number; fillY: number }

export function aoiFit(fb: [number, number, number, number], view: View): AoiFit {
  const fillX = (fb[2] - fb[0]) / (view.bbox[2] - view.bbox[0])
  const fillY = (fb[3] - fb[1]) / (view.bbox[3] - view.bbox[1])
  return { fill: Math.max(fillX, fillY), fits: fillX <= 1 && fillY <= 1, fillX, fillY }
}
