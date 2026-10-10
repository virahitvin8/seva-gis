/**
 * SEVA·GIS — Declarative Portal Tour Specification for Hyperframes
 * Inspired by heygen-com/hyperframes
 *
 * This script defines the keyframes, camera pans, and motion graphics
 * for generating the high-definition video walkthrough of the SEVA·GIS portal.
 */

export interface HyperframeScene {
  id: string
  title: string
  durationSeconds: number
  camera: {
    x: number
    y: number
    zoom: number
  }
  voiceover: string
  overlayText: string
  action: string
}

export const SEVA_HYPERFRAMES_TOUR: HyperframeScene[] = [
  {
    id: 'intro_satellite',
    title: 'Earth Orbit & Cadastral Boundary Selection',
    durationSeconds: 4.5,
    camera: { x: 75.8573, y: 30.9010, zoom: 14.5 },
    voiceover: 'Welcome to SEVA·GIS. Free, keyless, and open-source precision agriculture running directly in your browser.',
    overlayText: '🌾 SEVA·GIS: Spatial Evaluation & Vegetation Analytics',
    action: 'highlight_parcel_84',
  },
  {
    id: 'sentinel2_ingestion',
    title: 'Sentinel-2 L2A BOA Ingestion & Band Combinations',
    durationSeconds: 5.0,
    camera: { x: 75.8573, y: 30.9010, zoom: 16.0 },
    voiceover: 'Live Copernicus Sentinel-2 Level-2A surface reflectance streams in instantly. Switch between Natural True Colour, NIR False Colour, and Agriculture composites in the docked Section Layer.',
    overlayText: '🛰️ Real Sentinel-2 L2A (10m BOA Reflectance)',
    action: 'open_docked_symbology_tab',
  },
  {
    id: 'spectral_indices',
    title: '14 In-Browser Spectral & Radar Indices',
    durationSeconds: 5.5,
    camera: { x: 75.8573, y: 30.9010, zoom: 16.5 },
    voiceover: 'Calculate 14 agro-indices client-side using Float32 WebGL math: NDVI, NDMI moisture, NDRE red-edge nitrogen, and Sentinel-1 SAR cloud-penetrating radar.',
    overlayText: '📊 14 Science Indices · Float32 Client-Side Math',
    action: 'highlight_ndvi_ndmi_cards',
  },
  {
    id: 'irrigation_engine',
    title: 'FAO-56 Irrigation Decision Engine',
    durationSeconds: 5.0,
    camera: { x: 75.8573, y: 30.9010, zoom: 15.8 },
    voiceover: 'Get direct operational answers. The FAO-56 decision engine factors in evapotranspiration, 3-day rainfall forecasts, and drip or sprinkler efficiency to tell you exactly how many millimeters to irrigate today.',
    overlayText: '💧 "Irrigate 14 mm today" · Pump Runtime: 3.2 hrs',
    action: 'expand_irrigation_card',
  },
  {
    id: 'fields2cover_robotics',
    title: 'Autonomous Swath Robotics & VRA Prescriptions',
    durationSeconds: 5.0,
    camera: { x: 75.8573, y: 30.9010, zoom: 16.2 },
    voiceover: 'Plan tractor paths with Fields2Cover boustrophedon coverage planning. Minimize fuel consumption with optimal swath headings and export 3-zone variable-rate fertilizer maps.',
    overlayText: '🚜 Fields2Cover Robotics · 17.8% Diesel Saved',
    action: 'render_swath_lines',
  },
  {
    id: 'conclusion_local_first',
    title: 'Local-First Privacy & Zero Tracking',
    durationSeconds: 4.0,
    camera: { x: 75.8573, y: 30.9010, zoom: 14.0 },
    voiceover: 'No accounts required, no telemetry, no subscription fees. Try SEVA·GIS now at sevagis.dpdns.org.',
    overlayText: '🔒 100% Client-Side · Open-Source Forever',
    action: 'show_star_cta',
  },
]
