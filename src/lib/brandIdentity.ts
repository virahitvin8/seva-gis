export type BrandMode = 'dyop-hybrid' | 'dyop' | 'seva'

export interface BrandProfile {
  id: BrandMode
  shortName: string
  dotName: string
  prefix: string
  suffix: string
  fullTitle: string
  expansion: string
  tagline: string
  badge: string
  recommendedDomain: string
  positioning: string
  whyChoose: string[]
}

export const BRAND_PROFILES: Record<BrandMode, BrandProfile> = {
  'dyop-hybrid': {
    id: 'dyop-hybrid',
    shortName: 'DYOP · SEVA GIS',
    dotName: 'dyop.seva.gis',
    prefix: 'dyop',
    suffix: '.seva.gis',
    fullTitle: 'DYOP·GIS // Powered by SEVA·GIS',
    expansion: 'Do Your Own Project GIS · Spatial Earth, Vector & Multi-Domain Analytics',
    tagline: 'Universal Do-Your-Own-Project Spatial Workbench — Agriculture, Hydrology, Civil Terrain, Urban LULC, Geology & UAV Robotics.',
    badge: 'RECOMMENDED DUAL-BRAND',
    recommendedDomain: 'dyopgis.tech / sevagis.tech',
    positioning: 'Combines the universal project freedom of DYOP·GIS ("Do Your Own Project GIS") with the established repository & Cloud Run infrastructure of SEVA·GIS.',
    whyChoose: [
      'Breaks out of agriculture-only perception: immediately signals support for Urban Planning, Hydrology, Mining/Geology, Forestry, Disaster Burn, and Academic Research.',
      'Preserves 100% compatibility with your existing GitHub repo (virahitvin8/seva-gis), Cloud Run GEE backend, and existing domain PRs.',
      'Positions "DYOP" as the interactive studio ("Do Your Own Project") and "SEVA" as the underlying Spatial Earth Vector & Analytics engine.'
    ]
  },
  dyop: {
    id: 'dyop',
    shortName: 'DYOP·GIS',
    dotName: 'dyop.gis',
    prefix: 'dyop',
    suffix: '.gis',
    fullTitle: 'DYOP·GIS — Do Your Own Project GIS',
    expansion: 'Do Your Own Project — Universal Geospatial & Remote Sensing Studio',
    tagline: 'Bring any coordinates, shapefile, DEM, or research thesis — automate QGIS, ArcGIS, MATLAB & Earth Engine in one browser.',
    badge: 'UNIVERSAL MULTI-DOMAIN',
    recommendedDomain: 'dyopgis.tech',
    positioning: 'Action-first global brand tailored for students, researchers, civil engineers, hydrologists, and developers building any spatial project.',
    whyChoose: [
      'Zero domain limitation: "Do Your Own Project" invites civil engineering, bathymetry, urban growth, mineral exploration, and environmental science equally.',
      'Memorable 4-letter acronym (DYOP) that pairs naturally with the "GIS Training Academy" and "Research Paper Studio".',
      'Ideal for launching on a fresh .tech domain (dyopgis.tech) via Hacktoberfest / get.tech.'
    ]
  },
  seva: {
    id: 'seva',
    shortName: 'SEVA·GIS',
    dotName: 'seva.gis',
    prefix: 'seva',
    suffix: '.gis',
    fullTitle: 'SEVA·GIS — Spatial Earth, Vector & Analytics',
    expansion: 'Spatial Evaluation, Vector & Multi-Domain Earth Analytics',
    tagline: 'Open-access satellite remote sensing, terrain hydrology, and multi-engine GIS interoperability.',
    badge: 'CLASSIC HERITAGE',
    recommendedDomain: 'sevagis.tech / sevagis.is-a.dev',
    positioning: 'Retains the original SEVA·GIS identity while redefining the acronym from "Vegetation Analytics" to "Spatial Earth, Vector & Analytics".',
    whyChoose: [
      'Matches all existing GitHub URLs, subdomains (sevagis.stusite.me, sevagis.is-a.dev, sevagis.dpdns.org), and Cloud Run services.',
      'Carries strong goodwill ("Seva" = selfless open service to researchers, farmers, and planners) while expanding technical scope via the updated backronym.',
      'Zero migration friction for existing bookmarks and citations.'
    ]
  }
}

const STORAGE_KEY = 'seva-brand-identity-mode'

export function loadBrandMode(): BrandMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as BrandMode | null
    if (saved && saved in BRAND_PROFILES) return saved
  } catch {}
  return 'dyop-hybrid'
}

export function saveBrandMode(mode: BrandMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode)
    window.dispatchEvent(new CustomEvent('seva-brand-mode-changed', { detail: mode }))
  } catch {}
}

export function getBrandProfile(mode?: BrandMode | null): BrandProfile {
  if (!mode || !(mode in BRAND_PROFILES)) return BRAND_PROFILES['dyop-hybrid']
  return BRAND_PROFILES[mode]
}
