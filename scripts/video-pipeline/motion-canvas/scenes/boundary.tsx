/**
 * SEVA.GIS Motion Canvas Scene: Area of Interest (AOI) Boundary & Analytical Scan
 *
 * Programmatic vector animation of farm boundary path tracing,
 * Sentinel-2 multispectral scanning radar, live NDVI telemetry gauges,
 * and Google Drive Cloud Vault automated hierarchy sync.
 */

import { makeScene2D, Node, Txt, Path, Rect, Circle, all, sequence, createRef } from '@motion-canvas/2d'
import { createSignal, easeInOutCubic, easeOutBack, easeInQuad } from '@motion-canvas/core'

export default makeScene2D(function* (view) {
  // Brand color tokens
  const emerald = '#10b981'
  const brandDark = '#041d13'
  const brandCard = '#072e1f'
  const accentAmber = '#f59e0b'
  const accentCyan = '#06b6d4'
  const textLight = '#ecfdf5'
  const textMuted = '#6ee7b7'

  // References
  const backgroundRef = createRef<Rect>()
  const boundaryPathRef = createRef<Path>()
  const scanLineRef = createRef<Rect>()
  const titleRef = createRef<Txt>()
  const subtitleRef = createRef<Txt>()
  const ndviValueRef = createRef<Txt>()
  const driveBadgeRef = createRef<Rect>()
  const driveTextRef = createRef<Txt>()

  // Signals for numeric telemetry and progress
  const pathProgress = createSignal(0)
  const scanProgress = createSignal(-400)
  const ndviVal = createSignal(0.18)
  const badgeOpacity = createSignal(0)

  // 1. Scene Stage Setup
  view.add(
    <Rect
      ref={backgroundRef}
      width={1920}
      height={1080}
      fill={brandDark}
    >
      {/* Background Cartographic Coordinate Grid */}
      <Rect
        width={1800}
        height={960}
        stroke={'#064e3b'}
        lineWidth={1}
        radius={16}
        fill={brandCard}
      />

      {/* Title & Coordinates Header */}
      <Txt
        ref={titleRef}
        text={'SEVA·GIS — Area of Interest (AOI) Ingestion'}
        fontFamily={'Inter, sans-serif'}
        fontWeight={700}
        fontSize={42}
        fill={textLight}
        y={-420}
      />
      <Txt
        ref={subtitleRef}
        text={'Sentinel-2 L2A (10m BOA) • EPSG:4326 • Pothireddypally (17.545°N, 78.162°E)'}
        fontFamily={'Inter, sans-serif'}
        fontWeight={500}
        fontSize={20}
        fill={textMuted}
        y={-365}
      />

      {/* Vector Farm Boundary (Curved Geodetic Polygon Ring) */}
      <Path
        ref={boundaryPathRef}
        data={'M -380 -180 C -200 -240, 260 -210, 420 -120 C 460 80, 390 280, 240 320 C -40 360, -320 280, -410 120 Z'}
        stroke={emerald}
        lineWidth={6}
        fill={'#10b98118'}
        end={pathProgress}
        lineCap={'round'}
      />

      {/* Multispectral Sensor Scanning Sweep */}
      <Rect
        ref={scanLineRef}
        width={900}
        height={4}
        fill={accentCyan}
        opacity={0.7}
        y={scanProgress}
      />

      {/* Telemetry HUD: Area & Live NDVI Indicator */}
      <Rect
        x={-560}
        y={240}
        width={340}
        height={180}
        radius={12}
        fill={'#021b11'}
        stroke={'#059669'}
        lineWidth={2}
      >
        <Txt
          text={'MEASURED EXTENT'}
          fontSize={16}
          fontWeight={600}
          fill={textMuted}
          x={-140}
          y={-50}
        />
        <Txt
          text={'14.82 ha • 1,624 m'}
          fontSize={24}
          fontWeight={700}
          fill={textLight}
          x={-140}
          y={-15}
        />
        <Txt
          text={'MEAN CANOPY NDVI'}
          fontSize={16}
          fontWeight={600}
          fill={textMuted}
          x={-140}
          y={25}
        />
        <Txt
          ref={ndviValueRef}
          text={() => `+${ndviVal().toFixed(2)} (High Vigour)`}
          fontSize={24}
          fontWeight={700}
          fill={emerald}
          x={-140}
          y={58}
        />
      </Rect>

      {/* Google Drive Vault Sync Pill */}
      <Rect
        ref={driveBadgeRef}
        x={500}
        y={-415}
        width={320}
        height={46}
        radius={23}
        fill={'#064e3b'}
        stroke={emerald}
        lineWidth={1.5}
        opacity={badgeOpacity}
      >
        <Circle x={-125} size={16} fill={emerald} />
        <Txt
          ref={driveTextRef}
          text={'Drive: SEVA GIS / TIFF Files'}
          fontSize={16}
          fontWeight={600}
          fill={textLight}
          x={10}
        />
      </Rect>
    </Rect>
  )

  // 2. Coordinated Choreography
  yield* all(
    // Step 1: Trace farm boundary polygon over 2.2 seconds with cubic easing
    pathProgress(1, 2.2, easeInOutCubic),

    // Step 2: Sweep multispectral radar beam from top to bottom
    scanProgress(350, 2.2, easeInOutCubic),

    // Step 3: Interpolate live NDVI index from bare soil (0.18) to dense crop canopy (0.76)
    ndviVal(0.76, 2.2, easeInOutCubic),
  )

  // Step 4: Animate Google Drive Cloud Vault synchronization badge
  yield* all(
    badgeOpacity(1, 0.6, easeOutBack),
  )

  // Hold final frame for clean cut into UI demo sequence
  yield* view.wait(1.5)
})
