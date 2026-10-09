import { INDICATORS, byId, renderLayer, verdict, type Grid } from './lib/indicators'
import { constructionSuitability, farmBBox, farmRing, indexStat, irrigationAdvice, loadDem, loadScene, type Analysis, type FarmData, type WeekRec } from './lib/seva'
import { areaHa } from './lib/geo'
import { rampColor } from './lib/raster'
import { contourLines } from './MapKit'
import { logoMark as logoUrl } from './assets/brand'

export type ReportFarm = FarmData & { id: string; name: string; location: string; crop: string; sample?: boolean; passes?: WeekRec[] }

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
const f = (v: number | undefined, d = 2) => (v === undefined || !Number.isFinite(v) ? 'n/a' : v.toFixed(d))
const nice = (x: number, steps: number[]) => steps.find(s => s >= x) ?? steps[steps.length - 1]
const dms = (v: number, pos: string, neg: string) => { const a = Math.abs(v), d = Math.floor(a), m = Math.floor((a - d) * 60), s = ((a - d) * 60 - m) * 60; return `${d}° ${m}′ ${s.toFixed(1)}″ ${v >= 0 ? pos : neg}` }

/* Carbone-style template: {d.path} and {d.path:fmt} are merged with a JSON object */
function fill(tpl: string, d: unknown) {
  return tpl.replace(/\{d\.([\w.]+)(?::(\w+))?\}/g, (_, path: string, fmt?: string) => {
    let v: unknown = d
    for (const k of path.split('.')) v = (v as Record<string, unknown> | undefined)?.[k]
    if (typeof v === 'number' && !fmt && Number.isInteger(v)) return String(v)
    if (typeof v === 'number') return fmt === 'n1' ? v.toFixed(1) : fmt === 'n3' ? v.toFixed(3) : fmt === 'n0' ? v.toFixed(0) : v.toFixed(2)
    return esc(v)
  })
}

async function dataUrl(url: string) {
  try {
    const r = await fetch(url); if (!r.ok) throw new Error()
    const b = await r.blob()
    return await new Promise<string>((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = rej; fr.readAsDataURL(b) })
  } catch { return url }
}

type View = { bbox: [number, number, number, number]; W: number; H: number; mpp: number; px: (lon: number, lat: number) => [number, number] }
function makeView(fb: [number, number, number, number], W = 960, H = 660): View {
  const lat0 = (fb[1] + fb[3]) / 2, k = Math.cos((lat0 * Math.PI) / 180)
  const needW = (fb[2] - fb[0]) * 111320 * k * 1.7, needH = (fb[3] - fb[1]) * 111320 * 1.7
  const mpp = Math.max(needW / W, needH / H, 0.5)
  const dLat = (H * mpp) / 111320, dLon = (W * mpp) / (111320 * k)
  const cx = (fb[0] + fb[2]) / 2, cy = lat0
  const bbox: View['bbox'] = [cx - dLon / 2, cy - dLat / 2, cx + dLon / 2, cy + dLat / 2]
  return { bbox, W, H, mpp, px: (lon, lat) => [((lon - bbox[0]) / (bbox[2] - bbox[0])) * W, ((bbox[3] - lat) / (bbox[3] - bbox[1])) * H] }
}
const esri = (v: View) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${v.bbox.join(',')}&bboxSR=4326&imageSR=4326&size=${v.W},${v.H}&format=jpg&f=image`
const pts = (ring: [number, number][], v: View) => ring.map(p => v.px(p[0], p[1]).map(n => n.toFixed(1)).join(',')).join(' ')

const legendBox = (x: number, y: number, w: number, h: number, inner: string) => `<g transform="translate(${x} ${y})"><rect width="${w}" height="${h}" rx="8" fill="#fcfdf9" fill-opacity=".94" stroke="#10231b"/>${inner}</g>`
const gradientDef = (id: string, ramp: string[]) => `<linearGradient id="${id}" x1="0" x2="1">${ramp.map((c, i) => `<stop offset="${(i / (ramp.length - 1)).toFixed(3)}" stop-color="${c}"/>`).join('')}</linearGradient>`
const outline = (ring: [number, number][], v: View) => `<polygon points="${pts(ring, v)}" fill="none" stroke="#000" stroke-opacity=".55" stroke-width="6" stroke-linejoin="round"/><polygon points="${pts(ring, v)}" fill="none" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>`

export type CartOpts = { title: boolean; north: boolean; scale: boolean; legend: boolean; coords: boolean }
export type ReportLang = 'en' | 'hi' | 'te'
export type ReportOpts = { maps: string[]; cart: CartOpts; contour: number; lang?: ReportLang }
export const MAP_CHOICES: { id: string; name: string; note: string }[] = [
  { id: 'fresh', name: 'Fresh satellite view', note: 'Esri World Imagery with your boundary' },
  { id: 'ndvi', name: 'Crop health (NDVI)', note: 'Sentinel-2, red = weak, green = strong' },
  { id: 'ndmi', name: 'Leaf water (NDMI)', note: 'Sentinel-2 moisture of the canopy' },
  { id: 'ndwi', name: 'Surface water (NDWI)', note: 'Open water and wet ground' },
  { id: 'evi', name: 'Dense canopy (EVI)', note: 'Better than NDVI for thick crops' },
  { id: 'ndre', name: 'Nitrogen stress (NDRE)', note: 'Red-edge early stress signal' },
  { id: 'bsi', name: 'Bare soil (BSI)', note: 'Fallow and exposed soil' },
  { id: 'terrain', name: 'Terrain map', note: 'Height colours, hillshade and contours' },
  { id: 'slope', name: 'Slope', note: 'Steepness from the 30 m terrain model' },
  { id: 'twi', name: 'Wetness index (TWI)', note: 'Where water collects' },
]
export const DEFAULT_OPTS: ReportOpts = { maps: ['fresh', 'ndvi', 'terrain'], cart: { title: true, north: true, scale: true, legend: true, coords: true }, contour: 0, lang: 'en' }

export const REPORT_LANG_NAMES: Record<ReportLang, { label: string; native: string }> = {
  en: { label: 'English', native: 'English' },
  hi: { label: 'Hindi', native: 'हिन्दी' },
  te: { label: 'Telugu', native: 'తెలుగు' },
}

export const I18N = {
  en: {
    docLang: 'en',
    eyebrow: 'FARM INTELLIGENCE REPORT',
    crop: 'Crop',
    hectares: 'hectares',
    acres: 'acres',
    kpiHealth: 'Crop health (NDVI)',
    kpiStress: 'Stressed area',
    kpiStressSub: 'pixels with NDVI below 0.3',
    kpiWater: 'Leaf water (NDMI)',
    kpiWaterSub: 'higher means wetter leaves',
    kpiSlope: 'Slope',
    kpiSlopeSub: 'average steepness',
    loc: 'LOCATION',
    satPic: 'SATELLITE PICTURE',
    repId: 'REPORT ID',
    madeWith: 'Made with SEVA.GIS',
    dataSrcNote: '<b>Data sources:</b> Sentinel-2 L2A (ESA Copernicus via Microsoft Planetary Computer) · Copernicus DEM GLO-30 · Open-Meteo weather · SoilGrids (ISRIC) · Esri World Imagery · OpenStreetMap. Full links in section 8.',
    contents: 'Contents',
    toc: [
      'Summary in plain words',
      'The three maps',
      'Charts and numbers',
      'How we worked it out (the maths)',
      'Index table',
      'Terrain',
      'Advice and the reasons',
      'Data sources and references',
      'Limits',
      'sevagis.dpdns.org',
      'Record of this report',
    ],
    plainWords: 'In plain words',
    verdict: { healthy: 'healthy', good: 'good', moderate: 'moderate', weak: 'weak' },
    dirs: { NW: 'NW', N: 'N', NE: 'NE', W: 'W', Centre: 'Centre', E: 'E', SW: 'SW', S: 'S', SE: 'SE' } as Record<string, string>,
    summaryP1: (farm: string, date: string, verdict: string, mean: string, stress: string, worstCorner: string) =>
      `We looked at <b>${farm}</b> from space on <b>${date}</b>. The plants look <b>${verdict}</b> (score ${mean} out of about 0.9). About <b>${stress}%</b> of the farm looks weak. ${worstCorner}`,
    worstCornerText: (dir: string, pct: string) => `The part to walk and check first is the <b>${dir}</b> side (${pct}% weak).`,
    noCornerWeak: 'No single corner stands out as weak.',
    sec2Plain: 'Each map shows your exact boundary in white. Satellite and index maps show what is on the ground, the terrain map shows height and slope. The grid of coordinates sits on the outer frame so it never covers the map.',
    mapCaption: (num: number, name: string, credit: string, corners: number, id: string) =>
      `<b>Map ${num}: ${name}.</b> ${credit}. White line = your farm boundary (${corners} corner points). <span class="noprint hint">Double-click the map to move the title, north arrow, scale or legend.<button type="button" data-reset="${id}">Reset layout</button></span>`,
    sec3Plain: 'Charts turn many numbers into one picture. The histogram shows how many 10 m squares fall at each score. The donut shows how much of the farm is strong, middling or weak. The line shows how the farm changed on different dates.',
    sec3H3_1: 'How the farm splits by crop health',
    sec3H3_2: 'Spread of NDVI values inside the boundary',
    sec3H3_3: 'Where on the farm is weak? (3 by 3 grid, north at the top)',
    sec3H3_4: 'Change over time',
    donutLabels: {
      healthy: 'Healthy (NDVI 0.5 or more)',
      moderate: 'Moderate (0.3 to 0.5)',
      stressed: 'Stressed (below 0.3)',
    },
    histX: 'NDVI value (left = weak, right = strong)',
    histY: 'Number of 10 m pixels',
    kpiLowest: 'Lowest 10%',
    kpiLowestSub: 'NDVI at the 10th percentile',
    kpiMedian: 'Median',
    kpiMedianSub: 'the middle value',
    kpiHighest: 'Highest 10%',
    kpiHighestSub: 'NDVI at the 90th percentile',
    kpiCoverage: 'Data coverage',
    kpiCoverageSub: 'pixels that were clear',
    sec4Plain: 'Each number comes from simple arithmetic on satellite colours. Below is the working with your real numbers, so you can check it with a calculator.',
    sec5Plain: 'This table lists every index we can calculate. A bigger NDVI is better. A bigger NDMI means wetter leaves. The coloured word tells you what the number means.',
    sec6Plain: 'The ground height was measured by a satellite radar-based model. Water runs downhill, so slope and direction tell us where water drains, collects or erodes.',
    sec7Plain: 'Advice is a helper, not an order. Every line has a reason under it. If you know your field better, you can ignore it.',
    sec8Plain: 'A good report says where each fact came from. All data are free and need no key. Click any link to check the original.',
    recordTitle: 'Record of this report',
    recordFields: {
      reportId: 'Report ID',
      farm: 'Farm',
      place: 'Place',
      crop: 'Crop',
      lat: 'Centre latitude',
      lon: 'Centre longitude',
      size: 'Farm size',
      dims: 'Width × height',
      scene: 'Satellite scene',
      cloud: 'Cloud cover',
      corners: 'Boundary corners',
      pixels: 'Clear pixels used',
      timeSat: 'Time of recording (satellite)',
      analysisRun: 'Analysis run',
      downloaded: 'Report downloaded',
      dms: 'Coordinates (DMS)',
      bbox: 'Bounding box',
      madeWith: 'Made with',
    },
    irrigationTitle: 'Irrigation advice',
    constructionTitle: 'Construction suitability',
    whyLabel: 'Why?',
    limits: [
      'A satellite shows <b>where</b> a crop is weaker, not <b>why</b>. It cannot name a pest or a disease.',
      '10 m pixels mix soil, leaves and shade. Very small farms (under 1 ha) have only a few pixels.',
      'Soil moisture and rain are weather-model estimates, not a sensor in your field.',
      'Irrigation and construction notes are guides. They are not an engineering survey, a flood study or a legal document.',
      'Clouds can hide the farm on some days, so numbers can change between passes.',
    ],
  },
  hi: {
    docLang: 'hi',
    eyebrow: 'खेत आसूचना एवं उपग्रह विश्लेषण रिपोर्ट',
    crop: 'फसल',
    hectares: 'हेक्टेयर',
    acres: 'एकड़',
    kpiHealth: 'फसल स्वास्थ्य (NDVI)',
    kpiStress: 'तनावग्रस्त क्षेत्र',
    kpiStressSub: '0.3 से कम NDVI वाले पिक्सल',
    kpiWater: 'पत्तियों में नमी (NDMI)',
    kpiWaterSub: 'अधिक मान = पत्तियों में प्रचुर नमी',
    kpiSlope: 'भूमि ढलान',
    kpiSlopeSub: 'औसत ढलान प्रतिशत',
    loc: 'स्थान',
    satPic: 'उपग्रह चित्र',
    repId: 'रिपोर्ट आईडी',
    madeWith: 'SEVA.GIS द्वारा निर्मित',
    dataSrcNote: '<b>डेटा स्रोत:</b> सेंटिनल-2 L2A (ESA कोपरनिकस / माइक्रोसॉफ्ट प्लेनेटरी कंप्यूटर) · कोपरनिकस DEM GLO-30 · ओपन-मेटियो मौसम · सॉइल-ग्रिड्स (ISRIC) · एश्री वर्ल्ड इमेजरी · ओपन-स्ट्रीट-मैप। अनुभाग 8 में पूर्ण संदर्भ।',
    contents: 'सामग्री सूची',
    toc: [
      'सरल शब्दों में सारांश',
      'तीन मुख्य मानचित्र',
      'चार्ट एवं आंकड़े',
      'गणना पद्धति (गणितीय विश्लेषण)',
      'सूचकांक तालिका',
      'भूभाग एवं ढलान',
      'सलाह एवं वैज्ञानिक कारण',
      'डेटा स्रोत एवं संदर्भ',
      'सीमाएं एवं सावधानियां',
      'sevagis.dpdns.org',
      'इस रिपोर्ट का आधिकारिक विवरण',
    ],
    plainWords: 'सरल शब्दों में',
    verdict: { healthy: 'स्वस्थ एवं उत्तम', good: 'अच्छा', moderate: 'मध्यम', weak: 'कमजोर / तनावग्रस्त' },
    dirs: {
      NW: 'उत्तर-पश्चिम (NW)',
      N: 'उत्तर (N)',
      NE: 'उत्तर-पूर्व (NE)',
      W: 'पश्चिम (W)',
      Centre: 'मध्य भाग (Centre)',
      E: 'पूर्व (E)',
      SW: 'दक्षिण-पश्चिम (SW)',
      S: 'दक्षिण (S)',
      SE: 'दक्षिण-पूर्व (SE)',
    } as Record<string, string>,
    summaryP1: (farm: string, date: string, verdict: string, mean: string, stress: string, worstCorner: string) =>
      `हमने अंतरिक्ष से <b>${farm}</b> को <b>${date}</b> को देखा। फसल <b>${verdict}</b> स्थिति में है (0.9 में से स्कोर ${mean})। खेत का लगभग <b>${stress}%</b> भाग कमजोर/तनावग्रस्त दिख रहा है। ${worstCorner}`,
    worstCornerText: (dir: string, pct: string) => `सबसे पहले चलकर जांच करने योग्य क्षेत्र <b>${dir}</b> भाग है (${pct}% कमजोर)।`,
    noCornerWeak: 'खेत का कोई एक कोना अलग से कमजोर नहीं है, स्थिति पूरे खेत में संतुलित है।',
    sec2Plain: 'प्रत्येक नक्शा आपके खेत की सटीक सीमा को सफेद रेखा में प्रदर्शित करता है। उपग्रह और सूचकांक नक्शे ज़मीन की स्थिति दिखाते हैं, भूभाग का नक्शा ऊंचाई और ढलान दिखाता है। निर्देशांक ग्रिड बाहरी किनारे पर है ताकि नक्शा ढके नहीं।',
    mapCaption: (num: number, name: string, credit: string, corners: number, id: string) =>
      `<b>नक्शा ${num}: ${name}।</b> ${credit}। सफेद रेखा = आपके खेत की सीमा (${corners} कोने)। <span class="noprint hint">शीर्षक, उत्तर तीर, पैमाना या संकेत सूची को स्थानांतरित करने हेतु नक्शे पर डबल-क्लिक करें।<button type="button" data-reset="${id}">लेआउट रीसेट करें</button></span>`,
    sec3Plain: 'चार्ट कई संख्याओं को एक स्पष्ट चित्र में परिवर्तित करते हैं। हिस्टोग्राम दिखाता है कि प्रत्येक स्कोर पर 10 मीटर के कितने पिक्सल हैं। डोनट चार्ट दिखाता है कि खेत का कितना प्रतिशत मजबूत, मध्यम या कमजोर है। रेखा ग्राफ समय के साथ हुए बदलाव को दर्शाता है।',
    sec3H3_1: 'फसल स्वास्थ्य के आधार पर खेत का वर्गीकरण',
    sec3H3_2: 'खेत सीमा के भीतर NDVI मानों का वितरण',
    sec3H3_3: 'खेत में कमजोरी कहां है? (3×3 ग्रिड, उत्तर दिशा ऊपर)',
    sec3H3_4: 'समय के साथ फसल स्वास्थ्य में बदलाव',
    donutLabels: {
      healthy: 'स्वस्थ (NDVI 0.5 या अधिक)',
      moderate: 'मध्यम (0.3 से 0.5)',
      stressed: 'तनावग्रस्त (0.3 से कम)',
    },
    histX: 'NDVI मान (बाएं = कमजोर, दाएं = स्वस्थ)',
    histY: '10 मीटर पिक्सल की संख्या',
    kpiLowest: 'न्यूनतम 10%',
    kpiLowestSub: '10वें पर्सेंटाइल पर NDVI',
    kpiMedian: 'मध्यमान (Median)',
    kpiMedianSub: 'मध्य मूल्य',
    kpiHighest: 'उच्चतम 10%',
    kpiHighestSub: '90वें पर्सेंटाइल पर NDVI',
    kpiCoverage: 'डेटा कवरेज',
    kpiCoverageSub: 'साफ एवं स्पष्ट पिक्सल',
    sec4Plain: 'प्रत्येक संख्या उपग्रह प्रकाश परावर्तन के सरल गणित से निकलती है। नीचे आपके खेत के वास्तविक आंकड़ों के साथ गणना दी गई है, जिसे आप स्वयं जांच सकते हैं।',
    sec5Plain: 'यह तालिका उन सभी सूचकांकों को दर्शाती है जिनकी गणना की गई है। अधिक NDVI बेहतर वनस्पति दर्शाता है। अधिक NDMI पत्तियों में प्रचुर नमी दर्शाता है।',
    sec6Plain: 'ज़मीन की ऊंचाई उपग्रह रडार मॉडल से मापी गई है। पानी ढलान की ओर बहता है, इसलिए ढलान और दिशा दर्शाते हैं कि पानी कहां बहता है या जमा होता है।',
    sec7Plain: 'यह सलाह वैज्ञानिक विश्लेषण पर आधारित मार्गदर्शन है, कोई आदेश नहीं। प्रत्येक सुझाव का एक स्पष्ट कारण दिया गया है। अपने व्यावहारिक अनुभव को प्राथमिकता दें।',
    sec8Plain: 'एक प्रामाणिक रिपोर्ट बताती है कि प्रत्येक तथ्य कहां से आया है। सभी डेटा स्रोत खुले और निःशुल्क हैं। मूल स्रोत देखने के लिए किसी भी लिंक पर क्लिक करें।',
    recordTitle: 'इस रिपोर्ट का आधिकारिक विवरण',
    recordFields: {
      reportId: 'रिपोर्ट आईडी',
      farm: 'खेत का नाम',
      place: 'स्थान',
      crop: 'फसल',
      lat: 'केंद्र अक्षांश',
      lon: 'केंद्र देशांतर',
      size: 'खेत का आकार',
      dims: 'चौड़ाई × ऊंचाई',
      scene: 'उपग्रह दृश्य',
      cloud: 'बादल आवरण',
      corners: 'सीमा के कोने',
      pixels: 'विश्लेषित पिक्सल',
      timeSat: 'उपग्रह अवलोकन समय',
      analysisRun: 'विश्लेषण पूर्ण होने का समय',
      downloaded: 'रिपोर्ट डाउनलोड समय',
      dms: 'निर्देशांक (DMS)',
      bbox: 'बाउंडिंग बॉक्स',
      madeWith: 'निर्मित',
    },
    irrigationTitle: 'सिंचाई सलाह',
    constructionTitle: 'निर्माण एवं जल निकासी उपयुक्तता',
    whyLabel: 'वैज्ञानिक कारण',
    limits: [
      'उपग्रह यह दिखाता है कि फसल <b>कहाँ</b> कमजोर है, <b>क्यों</b> नहीं। यह कीट या बीमारी का नाम नहीं बता सकता।',
      '10 मीटर के पिक्सल में मिट्टी, पत्ते और छाया मिश्रित होते हैं। छोटे खेतों (1 हेक्टेयर से कम) में सीमित पिक्सल होते हैं।',
      'मिट्टी की नमी और बारिश मौसम-मॉडल के अनुमान हैं, आपके खेत में लगा सेंसर नहीं।',
      'सिंचाई और निर्माण संबंधी टिप्पणियां केवल मार्गदर्शन हैं; वे कोई कानूनी या इंजीनियरिंग सर्वेक्षण नहीं हैं।',
      'बादल कभी-कभी खेत को ढक सकते हैं, इसलिए विभिन्न उपग्रह चक्रों के बीच आंकड़ों में अंतर आ सकता है।',
    ],
  },
  te: {
    docLang: 'te',
    eyebrow: 'వ్యవసాయ క్షేత్ర నిఘా & ఉపగ్రహ విశ్లేషణ నివేదిక',
    crop: 'పంట',
    hectares: 'హెక్టార్లు',
    acres: 'ఎకరాలు',
    kpiHealth: 'పంట ఆరోగ్యం (NDVI)',
    kpiStress: 'ఒత్తిడికి గురైన విస్తీర్ణం',
    kpiStressSub: '0.3 కంటే తక్కువ NDVI పిక్సెల్స్',
    kpiWater: 'ఆకులలో తేమ (NDMI)',
    kpiWaterSub: 'ఎక్కువ విలువ = ఆకులలో సమృద్ధిగా తేమ',
    kpiSlope: 'భూమి వాలు',
    kpiSlopeSub: 'సగటు వాలు శాతం',
    loc: 'ప్రాంతం',
    satPic: 'ఉపగ్రహ చిత్రం',
    repId: 'నివేదిక సంఖ్య',
    madeWith: 'SEVA.GIS తో రూపొందించబడింది',
    dataSrcNote: '<b>డేటా మూలాలు:</b> సెంటినెల్-2 L2A (ESA కోపర్నికస్ / మైక్రోసాఫ్ట్ ప్లానెటరీ కంప్యూటర్) · కోపర్నికస్ DEM GLO-30 · ఓపెన్-మెటియో వాతావరణం · సాయిల్ గ్రిడ్స్ (ISRIC) · ఎస్రీ వరల్డ్ ఇమేజరీ · ఓపెన్ స్ట్రీట్ మ్యాప్. విభాగం 8లో పూర్తి సూచనలు.',
    contents: 'విషయ సూచిక',
    toc: [
      'సులభ శైలిలో సారాంశం',
      'మూడు ముఖ్య పటాలు (మ్యాప్‌లు)',
      'చార్ట్‌లు మరియు సంఖ్యలు',
      'గణాంకాల విశ్లేషణ (లెక్కించిన విధానం)',
      'సూచికల పట్టిక',
      'భూ స్వరూపం మరియు వాలు',
      'సలహాలు మరియు శాస్త్రీయ కారణాలు',
      'డేటా మూలాలు మరియు సూచనలు',
      'పరిమితులు మరియు జాగ్రత్తలు',
      'sevagis.dpdns.org',
      'ఈ నివేదిక యొక్క అధికారిక రికార్డు',
    ],
    plainWords: 'సులభ శైలిలో',
    verdict: { healthy: 'ఆరోగ్యకరమైనది & ఉత్తమం', good: 'మంచి స్థితి', moderate: 'మధ్యస్థం', weak: 'బలహీనమైనది / ఒత్తిడిలో ఉంది' },
    dirs: {
      NW: 'వాయవ్యం (NW)',
      N: 'ఉత్తరం (N)',
      NE: 'ఈశాన్యం (NE)',
      W: 'పడమర (W)',
      Centre: 'మధ్య భాగం (Centre)',
      E: 'తూర్పు (E)',
      SW: 'నైరుతి (SW)',
      S: 'దక్షిణం (S)',
      SE: 'ఆగ్నేయం (SE)',
    } as Record<string, string>,
    summaryP1: (farm: string, date: string, verdict: string, mean: string, stress: string, worstCorner: string) =>
      `మేము అంతరిక్షం నుండి <b>${farm}</b> క్షేత్రాన్ని <b>${date}</b> తేదీన పరిశీలించాము. పంట <b>${verdict}</b>గా కనిపిస్తోంది (0.9 లో స్కోరు ${mean}). పొలంలో దాదాపు <b>${stress}%</b> భాగం బలహీనంగా ఉంది. ${worstCorner}`,
    worstCornerText: (dir: string, pct: string) => `ముందుగా వెళ్లి క్షేత్రస్థాయిలో పరిశీలించాల్సిన ప్రాంతం <b>${dir}</b> వైపు (${pct}% బలహీనంగా ఉంది).`,
    noCornerWeak: 'పొలంలో ఏ ఒక్క మూలా ప్రత్యేకంగా బలహీనంగా లేదు, పరిస్థితి అంతటా సమతుల్యంగా ఉంది.',
    sec2Plain: 'ప్రతి మ్యాప్ మీ పొలం సరిహద్దును తెల్లటి గీతతో స్పష్టంగా చూపుతుంది. ఉపగ్రహ మరియు సూచిక మ్యాప్‌లు నేల పై పంట స్థితిని, భూభాగ మ్యాప్ ఎత్తు మరియు వాలును చూపుతాయి. కోఆర్డినేట్ గ్రిడ్ వెలుపలి అంచున అమర్చబడింది.',
    mapCaption: (num: number, name: string, credit: string, corners: number, id: string) =>
      `<b>మ్యాప్ ${num}: ${name}.</b> ${credit}. తెల్లటి గీత = మీ పొలం సరిహద్దు (${corners} మూలల పాయింట్లు). <span class="noprint hint">శీర్షిక, బాణం గుర్తు, స్కేల్ లేదా సూచికను జరపడానికి మ్యాప్‌పై డబుల్ క్లిక్ చేయండి.<button type="button" data-reset="${id}">రీసెట్ చేయండి</button></span>`,
    sec3Plain: 'చార్ట్‌లు సంక్లిష్ట సంఖ్యలను స్పష్టమైన చిత్రంగా మారుస్తాయి. హిస్టోగ్రామ్ ప్రతి స్కోర్ వద్ద ఎన్ని 10 మీటర్ల పిక్సెల్స్ ఉన్నాయో తెలుపుతుంది. డోనట్ చార్ట్ పొలంలో ఎంత భాగం ఆరోగ్యంగా, మధ్యస్థంగా లేదా ఒత్తిడిలో ఉందో చూపుతుంది. రేఖాచిత్రం కాలక్రమేణా మార్పును తెలుపుతుంది.',
    sec3H3_1: 'పంట ఆరోగ్యం ఆధారంగా పొలం విభజన',
    sec3H3_2: 'పొలం సరిహద్దు లోపల NDVI విలువల విస్తరణ',
    sec3H3_3: 'పొలంలో ఎక్కడ బలహీనంగా ఉంది? (3×3 గ్రిడ్, పైన ఉత్తరం)',
    sec3H3_4: 'సమయంతో పాటు వచ్చిన మార్పులు (కాల శ్రేణి)',
    donutLabels: {
      healthy: 'ఆరోగ్యకరమైనది (NDVI 0.5 లేదా అంతకంటే ఎక్కువ)',
      moderate: 'మధ్యస్థం (0.3 నుండి 0.5)',
      stressed: 'ఒత్తిడిలో ఉంది (0.3 కంటే తక్కువ)',
    },
    histX: 'NDVI విలువ (ఎడమ = బలహీనం, కుడి = ఆరోగ్యం)',
    histY: '10 మీటర్ల పిక్సెల్స్ సంఖ్య',
    kpiLowest: 'కనిష్ట 10%',
    kpiLowestSub: '10వ శాతకం వద్ద NDVI',
    kpiMedian: 'మధ్యస్థం (Median)',
    kpiMedianSub: 'మధ్యస్థ విలువ',
    kpiHighest: 'గరిష్ట 10%',
    kpiHighestSub: '90వ శాతకం వద్ద NDVI',
    kpiCoverage: 'డేటా కవరేజ్',
    kpiCoverageSub: 'స్పష్టమైన పిక్సెల్స్ శాతం',
    sec4Plain: 'ప్రతి సంఖ్య ఉపగ్రహ కాంతి ప్రతిబింబాల సాధారణ గణితం నుండి వస్తుంది. దిగువన మీ నిజమైన సంఖ్యలతో లెక్కలు ఇవ్వబడ్డాయి, మీరు కాలిక్యులేటర్‌తో కూడా సరిచూసుకోవచ్చు.',
    sec5Plain: 'ఈ పట్టిక మనం లెక్కించగల ప్రతి సూచికను చూపిస్తుంది. ఎక్కువ NDVI మెరుగైన పంట పెరుగుదలను తెలుపుతుంది. ఎక్కువ NDMI ఆకులలో సమృద్ధిగా తేమ ఉన్నట్లు తెలుపుతుంది.',
    sec6Plain: 'భూమి ఎత్తు ఉపగ్రహ రాడార్ నమూనా ద్వారా కొలవబడింది. నీరు పల్లం వైపు ప్రవహిస్తుంది కాబట్టి, వాలు మరియు దిశ నీటి పారుదల మరియు నిల్వ ప్రదేశాలను సూచిస్తాయి.',
    sec7Plain: 'ఈ సలహాలు మీకు సహాయపడటానికి మాత్రమే, తప్పనిసరి ఆంక్షలు కావు. ప్రతి సూచనకు శాస్త్రీయ కారణం ఇవ్వబడింది. మీ క్షేత్ర అనుభవానికే తొలి ప్రాధాన్యత ఇవ్వండి.',
    sec8Plain: 'ఒక ప్రామాణిక నివేదిక ప్రతి అంశం ఎక్కడి నుండి వచ్చిందో స్పష్టంగా తెలియజేస్తుంది. మొత్తం డేటా ఉచితం. మూలాలను చూడటానికి లింక్‌లను క్లిక్ చేయవచ్చు.',
    recordTitle: 'ఈ నివేదిక యొక్క అధికారిక రికార్డు',
    recordFields: {
      reportId: 'నివేదిక సంఖ్య',
      farm: 'పొలం పేరు',
      place: 'ప్రాంతం',
      crop: 'పంట',
      lat: 'కేంద్ర అక్షాంశం',
      lon: 'కేంద్ర రేఖాంశం',
      size: 'పొలం విస్తీర్ణం',
      dims: 'వెడల్పు × ఎత్తు',
      scene: 'ఉపగ్రహ చిత్రం',
      cloud: 'మేఘాల కవరేజ్',
      corners: 'సరిహద్దు మూలలు',
      pixels: 'విశ్లేషించిన పిక్సెల్స్',
      timeSat: 'ఉపగ్రహ పరిశీలన సమయం',
      analysisRun: 'విశ్లేషణ సమయం',
      downloaded: 'డౌన్‌లోడ్ సమయం',
      dms: 'కోఆర్డినేట్స్ (DMS)',
      bbox: 'బౌండింగ్ బాక్స్',
      madeWith: 'రూపొందించబడింది',
    },
    irrigationTitle: 'నీటి పారుదల సలహా',
    constructionTitle: 'నిర్మాణం & డ్రైనేజ్ అనుకూలత',
    whyLabel: 'శాస్త్రీయ కారణం',
    limits: [
      'ఉపగ్రహం పంట <b>ఎక్కడ</b> బలహీనంగా ఉందో చూపుతుంది కానీ <b>ఎందుకు</b> అనేది కాదు. ఇది నిర్దిష్ట పురుగు లేదా తెగులు పేరును చెప్పలేదు.',
      '10 మీటర్ల పిక్సెల్స్‌లో నేల, ఆకులు మరియు నీడలు కలిసి ఉంటాయి. చిన్న పొలాలలో (1 హెక్టారు లోపు) పరిమిత పిక్సెల్స్ మాత్రమే ఉంటాయి.',
      'నేలలో తేమ మరియు వర్షపాతం వాతావరణ నమూనాల అంచనాలు మాత్రమే, మీ పొలంలో అమర్చిన సెన్సార్లు కావు.',
      'నీటిపారుదల మరియు నిర్మాణ సూచనలు మార్గదర్శకాలు మాత్రమే; అవి ఇంజనీరింగ్ సర్వే లేదా చట్టపరమైన పత్రాలు కావు.',
      'కొన్ని రోజులలో మేఘాలు పొలాన్ని కప్పివేయవచ్చు, కాబట్టి వేర్వేరు ఉపగ్రహ పాస్‌ల మధ్య సంఖ్యలు మారవచ్చు.',
    ],
  },
} as const

const M = 58
type Spec = { id: string; num: number; label: string; name: string; credit: string; defs?: string; content: string; legend: { w: number; h: number; inner: string }; v: View }

const cel = (id: string, x: number, y: number, w: number, h: number, inner: string) => `<g class="cel" data-el="${id}" data-w="${w}" data-h="${h}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><rect class="hit" width="${w}" height="${h}" fill="transparent"/>${inner}</g>`

function frameCoords(v: View) {
  const span = Math.max(v.bbox[2] - v.bbox[0], v.bbox[3] - v.bbox[1]), gs = nice(span / 5, [0.0005, 0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1]), dp = gs < 0.001 ? 4 : gs < 0.01 ? 3 : 2
  const xs: number[] = [0], ys: number[] = [0], lx: [number, string][] = [], ly: [number, string][] = []
  for (let x = Math.ceil(v.bbox[0] / gs) * gs; x < v.bbox[2]; x += gs) { const px = v.px(x, 0)[0]; xs.push(px); lx.push([px, `${x.toFixed(dp)}°E`]) }
  for (let y = Math.ceil(v.bbox[1] / gs) * gs; y < v.bbox[3]; y += gs) { const py = v.px(0, y)[1]; ys.push(py); ly.push([py, `${y.toFixed(dp)}°N`]) }
  xs.push(v.W); ys.push(v.H); xs.sort((a, b) => a - b); ys.sort((a, b) => a - b)
  let o = ''
  xs.slice(0, -1).forEach((x, i) => { const w = xs[i + 1] - x, fillc = i % 2 ? '#fff' : '#10231b'; o += `<rect x="${x}" y="-8" width="${w}" height="8" fill="${fillc}" stroke="#10231b" stroke-width=".8"/><rect x="${x}" y="${v.H}" width="${w}" height="8" fill="${fillc}" stroke="#10231b" stroke-width=".8"/>` })
  ys.slice(0, -1).forEach((y, i) => { const h = ys[i + 1] - y, fillc = i % 2 ? '#fff' : '#10231b'; o += `<rect x="-8" y="${y}" width="8" height="${h}" fill="${fillc}" stroke="#10231b" stroke-width=".8"/><rect x="${v.W}" y="${y}" width="8" height="${h}" fill="${fillc}" stroke="#10231b" stroke-width=".8"/>` })
  lx.forEach(([x, t]) => { o += `<line x1="${x}" x2="${x}" y1="-8" y2="-14" stroke="#10231b"/><line x1="${x}" x2="${x}" y1="${v.H + 8}" y2="${v.H + 14}" stroke="#10231b"/><text x="${x}" y="-18" font-size="11" text-anchor="middle" fill="#10231b">${t}</text><text x="${x}" y="${v.H + 26}" font-size="11" text-anchor="middle" fill="#10231b">${t}</text>` })
  ly.forEach(([y, t]) => { o += `<line y1="${y}" y2="${y}" x1="-8" x2="-14" stroke="#10231b"/><line y1="${y}" y2="${y}" x1="${v.W + 8}" x2="${v.W + 14}" stroke="#10231b"/><text transform="translate(-20 ${y}) rotate(-90)" font-size="11" text-anchor="middle" fill="#10231b">${t}</text><text transform="translate(${v.W + 24} ${y}) rotate(90)" font-size="11" text-anchor="middle" fill="#10231b">${t}</text>` })
  return o
}

function mapFigure(sp: Spec, o: CartOpts, lang: ReportLang = 'en') {
  const v = sp.v, W = v.W, H = v.H, TW = W + 2 * M, TH = H + 2 * M
  const title = sp.name, tw = Math.max(230, title.length * 10 + 30)
  const m = nice(v.mpp * 170, [10, 20, 50, 100, 200, 500, 1000, 2000, 5000]), sw = m / v.mpp
  let els = ''
  const mapWord = lang === 'hi' ? 'मानचित्र' : lang === 'te' ? 'మ్యాప్' : 'MAP'
  const scaleWord = lang === 'hi' ? 'पैमाना (Scale)' : lang === 'te' ? 'స్కేల్ (Scale)' : 'Scale bar'
  if (o.title) els += cel('title', (W - tw) / 2, 14, tw, 46, `<rect width="${tw}" height="46" rx="4" fill="#fcfdf9" fill-opacity=".95" stroke="#10231b" stroke-width="1.5"/><text x="${tw / 2}" y="17" text-anchor="middle" font-size="9" font-weight="700" fill="#5b7a4a" letter-spacing="1.4">${mapWord} ${sp.num} · ${esc(sp.label.toUpperCase())}</text><text x="${tw / 2}" y="37" text-anchor="middle" font-size="16" font-weight="800" fill="#10231b">${esc(title)}</text>`)
  if (o.north) els += cel('north', W - 58, 14, 44, 74, `<rect x="0" y="0" width="44" height="74" rx="10" fill="#fcfdf9" fill-opacity=".92" stroke="#10231b"/><g transform="translate(22 8)"><path d="M0 2 L12 50 L0 41 L-12 50Z" fill="#fcfdf9" stroke="#10231b" stroke-width="2" stroke-linejoin="round"/><path d="M0 2 L12 50 L0 41Z" fill="#10231b"/><text y="63" text-anchor="middle" font-size="13" font-weight="800" fill="#10231b">N</text></g>`)
  if (o.scale) els += cel('scale', 14, H - 58, sw + 16, 44, `<rect width="${sw + 16}" height="44" rx="6" fill="#fcfdf9" fill-opacity=".92" stroke="#10231b"/><g transform="translate(8 22)"><rect width="${sw / 2}" height="7" fill="#10231b"/><rect x="${sw / 2}" width="${sw / 2}" height="7" fill="#fff" stroke="#10231b"/><text y="-5" font-size="11" fill="#10231b" font-weight="700">0</text><text x="${sw / 2}" y="-5" font-size="11" text-anchor="middle" fill="#10231b" font-weight="700">${m / 2}</text><text x="${sw}" y="-5" font-size="11" text-anchor="end" fill="#10231b" font-weight="700">${m} m</text><text y="19" font-size="9.5" fill="#10231b">${scaleWord}</text></g>`)
  if (o.legend) els += cel('legend', W - sp.legend.w - 14, H - sp.legend.h - 14, sp.legend.w, sp.legend.h, legendBox(0, 0, sp.legend.w, sp.legend.h, sp.legend.inner))
  const frame = o.coords ? frameCoords(v) : ''
  const cx = (v.bbox[0] + v.bbox[2]) / 2, cy = (v.bbox[1] + v.bbox[3]) / 2
  const centerWord = lang === 'hi' ? 'केंद्र' : lang === 'te' ? 'కేంద్రం' : 'Centre'
  const credit = `<text x="${TW / 2}" y="${TH - 22}" text-anchor="middle" font-size="11" fill="#10231b" font-weight="700">${esc(sp.name)} · ${centerWord} ${cy.toFixed(5)}°N ${cx.toFixed(5)}°E · WGS 84 (EPSG:4326)</text><text x="${TW / 2}" y="${TH - 8}" text-anchor="middle" font-size="10" fill="#5f6f60">${esc(sp.credit)}</text>`
  return `<svg class="cart" data-fig="${sp.id}" data-w="${W}" data-h="${H}" viewBox="0 0 ${TW} ${TH}" role="img" aria-label="${esc(sp.name)}" font-family="'DM Sans','Noto Sans Devanagari','Noto Sans Telugu',Arial,sans-serif" xmlns="http://www.w3.org/2000/svg"><defs>${sp.defs ?? ''}<clipPath id="mc-${sp.id}"><rect width="${W}" height="${H}"/></clipPath></defs><rect width="${TW}" height="${TH}" fill="#fff"/><g transform="translate(${M} ${M})"><g clip-path="url(#mc-${sp.id})">${sp.content}</g><rect width="${W}" height="${H}" fill="none" stroke="#10231b" stroke-width="1.5"/>${frame}${els}</g>${credit}</svg>`
}

const dimBase = (v: View, base: string, f2: string) => `<image href="${base}" width="${v.W}" height="${v.H}" style="filter:${f2}"/>`
function overlayImg(v: View, g: Grid, url: string, extra = '') {
  const [x0, y0] = v.px(g.bbox[0], g.bbox[3]), [x1, y1] = v.px(g.bbox[2], g.bbox[1])
  return `<image href="${url}" x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" preserveAspectRatio="none" ${extra}/>`
}
const gradLegend = (name: string, unit: string, lo: number, hi: number, gid: string) => ({ w: 236, h: 82, inner: `<text x="12" y="22" font-size="12" font-weight="800" fill="#10231b">${esc(name)}</text><rect x="12" y="32" width="212" height="10" rx="3" fill="url(#${gid})"/><text x="12" y="57" font-size="10" fill="#10231b">${lo.toFixed(2)}</text><text x="118" y="57" font-size="10" text-anchor="middle" fill="#10231b">${((lo + hi) / 2).toFixed(2)}</text><text x="224" y="57" font-size="10" text-anchor="end" fill="#10231b">${hi.toFixed(2)}</text><text x="12" y="74" font-size="9.5" fill="#5f6f60">${esc(unit)}</text>` })

function buildSpecs(opts: ReportOpts, v: View, base: string, ring: [number, number][], g: Grid, dem: Grid | null, an: Analysis, step: number, lang: ReportLang = 'en') {
  const out: Spec[] = [], date = an.scene.datetime.slice(0, 10)
  const s2 = `Sentinel-2 L2A ${date} (Copernicus, Microsoft Planetary Computer) · Imagery © Esri`
  let num = 0
  const legTitle = lang === 'hi' ? 'संकेत सूची' : lang === 'te' ? 'సూచిక' : 'Legend'
  const boundLabel = lang === 'hi' ? 'खेत की सीमा' : lang === 'te' ? 'పొలం సరిహద్దు' : 'Farm boundary'
  for (const id of opts.maps) {
    if (id === 'fresh') {
      const name = lang === 'hi' ? 'ताज़ा उपग्रह चित्र' : lang === 'te' ? 'తాజా ఉపగ్రహ చిత్రం' : 'Fresh satellite view'
      const label = lang === 'hi' ? 'उपग्रह' : lang === 'te' ? 'ఉపగ్రహం' : 'Satellite'
      out.push({ id, num: ++num, label, name, credit: 'Imagery © Esri, Maxar, Earthstar Geographics', v, content: `${dimBase(v, base, 'none')}${outline(ring, v)}`, legend: { w: 214, h: 58, inner: `<text x="12" y="22" font-size="12" font-weight="800" fill="#10231b">${legTitle}</text><line x1="12" x2="40" y1="40" y2="40" stroke="#10231b" stroke-width="5"/><line x1="12" x2="40" y1="40" y2="40" stroke="#fff" stroke-width="2.5"/><text x="48" y="44" font-size="10.5" fill="#10231b">${boundLabel}</text>` } })
      continue
    }
    if (id === 'terrain') {
      if (!dem) continue
      const name = lang === 'hi' ? 'भूभाग एवं ढलान नक्शा' : lang === 'te' ? 'భూ స్వరూప పటం' : 'Terrain map'
      const label = lang === 'hi' ? 'भूभाग' : lang === 'te' ? 'భూ స్వరూపం' : 'Terrain'
      const dl = renderLayer(byId('dem'), dem, ring), hl = renderLayer(byId('hillshade'), dem, ring)
      const { lines } = contourLines(dem, step), idx = step * 5, seen = new Set<number>()
      const segs = lines.map(l => `<polyline points="${l.pts.map(p => v.px(p[1], p[0]).map(n => n.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="#fff7d6" stroke-width="${l.level % idx === 0 ? 2 : 1}" stroke-opacity="${l.level % idx === 0 ? 1 : .75}"/>`).join('')
      const labs = lines.filter(l => l.level % idx === 0 && !seen.has(l.level) && seen.add(l.level)).map(l => { const [x, y] = v.px(l.pts[0][1], l.pts[0][0]); return `<text x="${x + 3}" y="${y - 3}" font-size="11" font-weight="700" fill="#fff" stroke="#000" stroke-width=".5">${Math.round(l.level * 10) / 10} m</text>` }).join('')
      const content = `${dimBase(v, base, 'brightness(.8)')}${overlayImg(v, dem, dl.url, 'opacity=".55"')}${overlayImg(v, dem, hl.url, 'style="mix-blend-mode:multiply" opacity=".8"')}<clipPath id="fc"><polygon points="${pts(ring, v)}"/></clipPath><g clip-path="url(#fc)">${segs}</g>${labs}${outline(ring, v)}`
      const lowLabel = lang === 'hi' ? 'नीची भूमि' : lang === 'te' ? 'పల్లపు ప్రాంతం' : 'Low ground'
      const highLabel = lang === 'hi' ? 'ऊंची भूमि' : lang === 'te' ? 'ఎత్తైన ప్రాంతం' : 'High ground'
      const contourLabel = lang === 'hi' ? `समोच्च रेखा ${step} मी (गहरी ${step * 5} मी)` : lang === 'te' ? `కాంటూర్ గీత ప్రతి ${step} మీ (${step * 5} మీ ముదురు)` : `Contour every ${step} m (bold ${step * 5} m)`
      const hillLabel = lang === 'hi' ? 'पहाड़ी छाया: उत्तर-पश्चिम से सूर्य' : lang === 'te' ? 'కొండ నీడ: వాయవ్యం నుండి సూర్యకాంతి' : 'Hillshade: sun from north-west'
      out.push({ id, num: ++num, label, name, credit: 'Copernicus GLO-30 DEM · Imagery © Esri', v, defs: gradientDef('gd', byId('dem').ramp!), content, legend: { w: 270, h: 112, inner: `<text x="12" y="20" font-size="12" font-weight="800" fill="#10231b">${legTitle}</text><rect x="12" y="30" width="150" height="9" rx="3" fill="url(#gd)"/><text x="12" y="53" font-size="10" fill="#10231b">${lowLabel}</text><text x="162" y="53" font-size="10" text-anchor="end" fill="#10231b">${highLabel}</text><line x1="12" x2="40" y1="70" y2="70" stroke="#c9a400" stroke-width="2"/><text x="48" y="74" font-size="10.5" fill="#10231b">${contourLabel}</text><rect x="12" y="82" width="28" height="10" fill="#777"/><text x="48" y="91" font-size="10.5" fill="#10231b">${hillLabel}</text>` } })
      continue
    }
    const ind = byId(id), grid = ind.source === 'DEM' ? dem : g
    if (!grid || !ind.ramp) continue
    const lay = renderLayer(ind, grid, ring), [lo, hi] = lay.range ?? [0, 1], gid = `gr-${id}`
    if (id === 'ndvi') {
      const name = lang === 'hi' ? 'फसल स्वास्थ्य (NDVI)' : lang === 'te' ? 'పంట ఆరోగ్యం (NDVI)' : 'Crop health (NDVI)'
      const label = lang === 'hi' ? 'फसल स्वास्थ्य' : lang === 'te' ? 'పంట ఆరోగ్యం' : 'Crop health'
      const bands = lang === 'hi'
        ? [['#a50026', 'बंजर या तनावग्रस्त', '< 0.2'], ['#f46d43', 'कमजोर', '0.2 – 0.35'], ['#fee08b', 'मध्यम', '0.35 – 0.5'], ['#a6d96a', 'अच्छा', '0.5 – 0.6'], ['#1a9850', 'स्वस्थ', '> 0.6']]
        : lang === 'te'
        ? [['#a50026', 'బంజరు లేదా ఒత్తిడి', '< 0.2'], ['#f46d43', 'బలహీనమైనది', '0.2 – 0.35'], ['#fee08b', 'మధ్యస్థం', '0.35 – 0.5'], ['#a6d96a', 'మంచిది', '0.5 – 0.6'], ['#1a9850', 'ఆరోగ్యకరమైనది', '> 0.6']]
        : [['#a50026', 'Bare or stressed', '< 0.2'], ['#f46d43', 'Weak', '0.2 – 0.35'], ['#fee08b', 'Moderate', '0.35 – 0.5'], ['#a6d96a', 'Good', '0.5 – 0.6'], ['#1a9850', 'Healthy', '> 0.6']]
      const avgWord = lang === 'hi' ? 'खेत का औसत' : lang === 'te' ? 'పొలం సగటు' : 'Farm average'
      out.push({ id, num: ++num, label, name, credit: s2, v, defs: gradientDef(gid, ind.ramp), content: `${dimBase(v, base, 'grayscale(.85) brightness(.55)')}${overlayImg(v, g, lay.url)}${outline(ring, v)}`,
        legend: { w: 236, h: 190, inner: `<text x="12" y="22" font-size="12" font-weight="800" fill="#10231b">${name}</text><rect x="12" y="32" width="212" height="10" rx="3" fill="url(#${gid})"/><text x="12" y="57" font-size="10" fill="#10231b">${lo}</text><text x="118" y="57" font-size="10" text-anchor="middle" fill="#10231b">${((lo + hi) / 2).toFixed(2)}</text><text x="224" y="57" font-size="10" text-anchor="end" fill="#10231b">${hi}+</text>${bands.map((b, i) => `<rect x="12" y="${68 + i * 21}" width="14" height="14" rx="3" fill="${b[0]}"/><text x="34" y="${79 + i * 21}" font-size="11" fill="#10231b">${b[1]} <tspan fill="#5a6e4d">${b[2]}</tspan></text>`).join('')}<text x="12" y="184" font-size="10.5" font-weight="700" fill="#10231b">${avgWord} ${f(an.ndvi.mean)}</text>` } })
      continue
    }
    out.push({ id, num: ++num, label: ind.group, name: ind.name, credit: grid === g ? s2 : 'Copernicus GLO-30 DEM · Imagery © Esri', v, defs: gradientDef(gid, ind.ramp), content: `${dimBase(v, base, 'grayscale(.85) brightness(.55)')}${overlayImg(v, grid, lay.url)}${outline(ring, v)}`, legend: gradLegend(ind.name, ind.unit ?? ind.desc.split(':')[0], lo, hi, gid) })
  }
  return out
}

const svgLine = (rows: WeekRec[], lang: ReportLang = 'en') => {
  if (rows.length < 2) {
    const emptyMsg = lang === 'hi' ? 'पर्याप्त उपग्रह अवलोकन अभी सहेजे नहीं गए हैं। अलग-अलग दिनों में रिफ्रेश दबाने पर यह चार्ट स्वतः भर जाएगा।' : lang === 'te' ? 'తగినన్ని ఉపగ్రహ పరిశీలనలు ఇంకా సేవ్ కాలేదు. వేర్వేరు రోజుల్లో రీఫ్రెష్ చేస్తే ఈ చార్ట్ నిండుతుంది.' : 'Not enough satellite passes saved yet. Press Refresh on a few different days and this chart fills in.'
    return `<p class="muted">${emptyMsg}</p>`
  }
  const W = 760, H = 270, L = 46, R = 14, T = 16, B = 40, lo = -0.2, hi = 1
  const t0 = +new Date(rows[0].date), t1 = +new Date(rows[rows.length - 1].date) || t0 + 1
  const X = (d: string) => L + ((+new Date(d) - t0) / Math.max(1, t1 - t0)) * (W - L - R), Y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B)
  const line = (k: 'ndvi' | 'ndmi', c: string) => `<polyline fill="none" stroke="${c}" stroke-width="3" stroke-linejoin="round" points="${rows.map(r => `${X(r.date).toFixed(1)},${Y(r[k]).toFixed(1)}`).join(' ')}"/>${rows.map(r => `<circle cx="${X(r.date).toFixed(1)}" cy="${Y(r[k]).toFixed(1)}" r="3.5" fill="${c}"/>`).join('')}`
  const ticks = [-0.2, 0, 0.2, 0.4, 0.6, 0.8, 1].map(v => `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="#d8e2d2"/><text x="${L - 6}" y="${Y(v) + 4}" font-size="11" text-anchor="end" fill="#5f6f60">${v}</text>`).join('')
  const xs = [0, 1, 2, 3, 4].map(i => { const r = rows[Math.round((i / 4) * (rows.length - 1))]; return `<text x="${X(r.date)}" y="${H - 18}" font-size="10.5" text-anchor="middle" fill="#5f6f60">${r.week.slice(2)}</text>` }).join('')
  const dateFoot = lang === 'hi' ? 'तारीख (वर्ष-माह-दिन)। लाल पट्टी = तनावग्रस्त क्षेत्र (0.3 से कम NDVI)' : lang === 'te' ? 'తేదీ (సంవత్సరం-నెల-రోజు). ఎరుపు పట్టీ = ఒత్తిడి ప్రాంతం (0.3 కంటే తక్కువ NDVI)' : 'Date (year-month-day). Red band = stressed zone (NDVI below 0.3)'
  const ndviWord = lang === 'hi' ? 'फसल स्वास्थ्य (NDVI)' : lang === 'te' ? 'పంట ఆరోగ్యం (NDVI)' : 'Crop health (NDVI)'
  const ndmiWord = lang === 'hi' ? 'पत्ती में नमी (NDMI)' : lang === 'te' ? 'ఆకులలో తేమ (NDMI)' : 'Leaf water (NDMI)'
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="NDVI and NDMI over time">${ticks}${xs}<rect x="${L}" y="${Y(0.3)}" width="${W - L - R}" height="${Y(-0.2) - Y(0.3)}" fill="#d73027" opacity=".07"/>${line('ndvi', '#1a9850')}${line('ndmi', '#2b83ba')}<text x="${L}" y="${H - 2}" font-size="11" fill="#5f6f60">${dateFoot}</text><g transform="translate(${W - 190} ${T})"><circle cx="6" cy="6" r="5" fill="#1a9850"/><text x="16" y="10" font-size="12" fill="#10231b">${ndviWord}</text><circle cx="6" cy="26" r="5" fill="#2b83ba"/><text x="16" y="30" font-size="12" fill="#10231b">${ndmiWord}</text></g></svg>`
}
const svgHist = (counts: number[], lo: number, hi: number, lang: ReportLang = 'en') => {
  const W = 760, H = 230, L = 46, B = 34, T = 12, max = Math.max(...counts, 1), bw = (W - L - 10) / counts.length, ramp = byId('ndvi').ramp!
  const bars = counts.map((c, i) => { const mid = lo + ((i + 0.5) / counts.length) * (hi - lo), h = (c / max) * (H - T - B), col = rampColor(ramp, mid / 0.9).map(Math.round); return `<rect x="${L + i * bw + 1}" y="${H - B - h}" width="${bw - 2}" height="${h}" rx="2" fill="rgb(${col})"/>` }).join('')
  const xt = [0, 0.25, 0.5, 0.75, 1].map(t => `<text x="${L + t * (W - L - 10)}" y="${H - 16}" font-size="11" text-anchor="middle" fill="#5f6f60">${(lo + t * (hi - lo)).toFixed(2)}</text>`).join('')
  const yLab = lang === 'hi' ? '10 मी पिक्सल की संख्या' : lang === 'te' ? '10 మీ పిక్సెల్స్ సంఖ్య' : 'Number of 10 m pixels'
  const xLab = lang === 'hi' ? 'NDVI मान (बाएं = कमजोर, दाएं = स्वस्थ)' : lang === 'te' ? 'NDVI విలువ (ఎడమ = బలహీనం, కుడి = ఆరోగ్యం)' : 'NDVI value (left = weak, right = strong)'
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Histogram of NDVI values">${bars}<line x1="${L}" x2="${W - 10}" y1="${H - B}" y2="${H - B}" stroke="#10231b"/>${xt}<text x="${L}" y="${T + 8}" font-size="11" fill="#5f6f60">${yLab}</text><text x="${W - 10}" y="${H - 2}" font-size="11" text-anchor="end" fill="#5f6f60">${xLab}</text></svg>`
}
const svgDonut = (parts: { v: number; c: string; l: string }[]) => {
  const tot = parts.reduce((a, p) => a + p.v, 0) || 1; let a0 = -Math.PI / 2
  const arcs = parts.map(p => { const a1 = a0 + (p.v / tot) * Math.PI * 2, big = a1 - a0 > Math.PI ? 1 : 0, r = 70, ri = 42, P = (a: number, rr: number) => `${(90 + rr * Math.cos(a)).toFixed(1)},${(90 + rr * Math.sin(a)).toFixed(1)}`; const d = p.v / tot > 0.999 ? `M90 ${90 - r} A${r} ${r} 0 1 1 89.9 ${90 - r} L89.9 ${90 - ri} A${ri} ${ri} 0 1 0 90 ${90 - ri}Z` : `M${P(a0, r)} A${r} ${r} 0 ${big} 1 ${P(a1, r)} L${P(a1, ri)} A${ri} ${ri} 0 ${big} 0 ${P(a0, ri)}Z`; a0 = a1; return `<path d="${d}" fill="${p.c}"/>` }).join('')
  return `<div class="donut"><svg viewBox="0 0 180 180" role="img" aria-label="Share of farm by crop health class">${arcs}</svg><ul>${parts.map(p => `<li><i style="background:${p.c}"></i><b>${((p.v / tot) * 100).toFixed(0)}%</b> ${esc(p.l)}</li>`).join('')}</ul></div>`
}

const REFS: [string, string, string][] = [
  ['Sentinel-2 L2A surface reflectance (ESA Copernicus programme), served through Microsoft Planetary Computer STAC and TiTiler APIs', 'https://planetarycomputer.microsoft.com/dataset/sentinel-2-l2a', 'Satellite colour bands at 10 to 20 m, every ~5 days. Free, no key.'],
  ['Copernicus DEM GLO-30 (ESA / Airbus), via Microsoft Planetary Computer', 'https://planetarycomputer.microsoft.com/dataset/cop-dem-glo-30', 'Height of the ground at 30 m. Used for slope, aspect, hillshade, contours, drainage.'],
  ['Open-Meteo weather forecast API (CC BY 4.0)', 'https://open-meteo.com/', 'Rain for the next 7 days and modelled soil moisture.'],
  ['SoilGrids, ISRIC World Soil Information (CC BY 4.0)', 'https://soilgrids.org/', 'Soil properties at 250 m, used for soil context.'],
  ['Esri World Imagery basemap (Maxar, Earthstar Geographics and the GIS user community)', 'https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9', 'The photo-like picture used in the fresh satellite view and as the map background.'],
  ['SpatioTemporal Asset Catalog (STAC) specification', 'https://stacspec.org/', 'How scenes are searched by place, date and cloud cover.'],
  ['Rouse, J.W. et al. (1974). Monitoring vegetation systems in the Great Plains with ERTS. NASA SP-351.', 'https://ntrs.nasa.gov/citations/19740022614', 'Original NDVI.'],
  ['Gao, B.-C. (1996). NDWI, a normalized difference water index for remote sensing of vegetation liquid water from space. Remote Sensing of Environment 58(3).', 'https://doi.org/10.1016/S0034-4257(96)00067-3', 'Leaf water index (NIR and SWIR). The app calls it NDMI.'],
  ['McFeeters, S.K. (1996). The use of the Normalized Difference Water Index (NDWI) in the delineation of open water features. Int. J. Remote Sensing 17(7).', 'https://doi.org/10.1080/01431169608948714', 'Open-water index (green and NIR).'],
  ['Huete, A.R. (1988). A soil-adjusted vegetation index (SAVI). Remote Sensing of Environment 25(3).', 'https://doi.org/10.1016/0034-4257(88)90106-X', 'SAVI.'],
  ['Huete, A. et al. (2002). Overview of the radiometric and biophysical performance of the MODIS vegetation indices. Remote Sensing of Environment 83.', 'https://doi.org/10.1016/S0034-4257(02)00096-2', 'EVI.'],
  ['Horn, B.K.P. (1981). Hill shading and the reflectance map. Proceedings of the IEEE 69(1).', 'https://doi.org/10.1109/PROC.1981.11918', 'Slope and hillshade method.'],
  ['Beven, K.J. and Kirkby, M.J. (1979). A physically based, variable contributing area model of basin hydrology. Hydrological Sciences Bulletin 24(1).', 'https://doi.org/10.1080/02626667909491834', 'Topographic wetness index (TWI).'],
  ['O\u2019Callaghan, J.F. and Mark, D.M. (1984). The extraction of drainage networks from digital elevation data. Computer Vision, Graphics and Image Processing 28.', 'https://doi.org/10.1016/S0734-189X(84)80011-0', 'D8 flow direction and drainage paths.'],
  ['Allen, R.G. et al. (1998). Crop evapotranspiration, FAO Irrigation and Drainage Paper 56.', 'https://www.fao.org/4/x0490e/x0490e00.htm', 'Background on crop water needs behind the irrigation advice.'],
  ['ReportGenerator by Daniel Palme (Apache-2.0): ideas for summary badges, coverage figures, risk hotspots and history charts', 'https://github.com/danielpalme/ReportGenerator', 'Inspiration only. No code copied.'],
  ['Carbone (carboneio): ideas for merging a template with a JSON data object', 'https://github.com/carboneio/carbone', 'Inspiration only. This report uses its own tiny {d.field} merge.'],
  ['GitHub topic: report-generation', 'https://github.com/topics/report-generation', 'Ideas for table of contents, print layout and embedded data.'],
]

function getLocalizedAdvice(farm: ReportFarm, lang: ReportLang) {
  const irr = irrigationAdvice(farm), con = constructionSuitability(farm)
  if (lang === 'hi') {
    const isDry = (farm.analysis?.ndmi.mean ?? 0) < 0.1 || (farm.moisture !== undefined && farm.moisture < 15)
    const isRainy = (farm.rain ?? 0) >= 15
    const isStress = (farm.analysis?.stressPct ?? 0) >= 25
    const irrHi = {
      level: irr.level,
      chip: isStress && isDry && !isRainy ? 'शीघ्र सिंचाई करें' : isDry && isRainy ? 'प्रतीक्षा करें, बारिश संभावित' : isStress ? 'खेत का निरीक्षण करें' : 'कार्रवाई आवश्यक नहीं',
      title: isStress && isDry && !isRainy ? 'भूमि सूखी और फसल तनाव में: 2-3 दिनों में सिंचाई की योजना बनाएं।' : isDry && isRainy ? 'मिट्टी सूखी है, परंतु पर्याप्त बारिश का पूर्वानुमान है।' : isStress ? 'नमी की स्पष्ट कमी के बिना भी तनाव दिखाई दे रहा है।' : 'फसल की बढ़वार और नमी की स्थिति पर्याप्त है।',
      bullets: [
        `कैनोपी नमी सूचकांक (NDMI) औसत ${f(farm.analysis?.ndmi.mean)}; ${farm.analysis?.stressPct.toFixed(0)}% पिक्सल में NDVI 0.3 से कम है।`,
        `अगले 7 दिनों में वर्षा का अनुमान: ${farm.rain !== undefined ? `${farm.rain.toFixed(1)} मिमी` : 'अनुपलब्ध'}${farm.moisture !== undefined ? `, मॉडल आधारित सतही मिट्टी की नमी ${farm.moisture}%।` : '।'}`,
        ...(isStress && isDry && !isRainy ? ['मानचित्र पर लाल क्षेत्रों से शुरुआत करें और सिंचाई नालियों की जांच करें।'] : isDry && isRainy ? ['सिंचाई करने से पहले बारिश की प्रतीक्षा करें और अगले उपग्रह पास पर पुनः जांचें।'] : isStress ? ['कीट, पोषक तत्वों की कमी, जलभराव या हालिया कटाई की जांच करें।'] : ['अगले उपग्रह चक्र (लगभग प्रत्येक 5 दिन) के बाद पुनः जांचें।']),
        'केवल सांकेतिक। फसल की वृद्धि अवस्था, मिट्टी का प्रकार और जड़ों की गहराई मॉडल में शामिल नहीं हैं।',
      ],
      why: isStress && isDry && !isRainy ? 'खेत का एक चौथाई या अधिक हिस्सा तनाव में है, पत्तियों और मिट्टी में नमी बहुत कम है, और बारिश नहीं आ रही।' : isDry && isRainy ? 'वर्तमान में नमी कम है, परंतु अगले 7 दिनों में 15 मिमी या अधिक बारिश की संभावना है।' : isStress ? 'कई पिक्सल कमजोर दिख रहे हैं परंतु नमी का स्तर सामान्य है, अतः जल की कमी मुख्य कारण नहीं हो सकती।' : 'खेत के 25% से कम हिस्से में तनाव है और नमी पर्याप्त है।',
    }
    const slope = farm.analysis?.slopePct ?? 0
    const conHi = {
      level: con.level,
      chip: slope > 15 ? 'चुनौतीपूर्ण' : slope > 8 ? 'सावधानीपूर्वक संभव' : slope < 1 ? 'जल निकासी जांचें' : 'अनुकूल',
      title: slope > 15 ? 'अत्यधिक ढलान: भारी भू-समतलीकरण एवं मिट्टी के कटाव का जोखिम।' : slope > 8 ? 'मध्यम ढलान: जल बहाव और मिट्टी के कटाव का प्रबंधन करें।' : slope < 1 ? 'अत्यधिक समतल या निचली भूमि: जल जमाव और बाढ़ का खतरा।' : 'प्राकृतिक जल निकासी के साथ हल्की ढलान।',
      bullets: [
        `ऊंचाई ${Math.round(farm.elevation ?? 0)} मीटर; अनुमानित स्थानीय ढलान ${slope.toFixed(1)}%।`,
        ...(slope > 15 ? ['15% से अधिक ढलान पर सीढ़ीदार खेत या सुरक्षा दीवारें आवश्यक होती हैं।'] : slope > 8 ? ['जल निकासी अच्छी है, परंतु समतलीकरण और सतही जल नियंत्रण की योजना बनाएं।'] : slope < 1 ? ['भारी बारिश के बाद पानी ठहर सकता है; स्थानीय भूजल स्तर की जांच करें।'] : ['1 से 8% की ढलान बिना बड़े समतलीकरण के स्वाभाविक रूप से पानी निकालती है।']),
        'केवल प्रारंभिक जांच। यह कोई आधिकारिक इंजीनियरिंग, मृदा-परीक्षण या बाढ़ सर्वेक्षण नहीं है।',
      ],
      why: slope > 15 ? `प्रति 100 मीटर पर भूमि ${slope.toFixed(1)} मीटर ऊपर उठती है (15% से अधिक)।` : slope > 8 ? `ढलान ${slope.toFixed(1)}% है, जो 8% और 15% के बीच है।` : slope < 1 ? 'ढलान 1% से कम है या भूमि समुद्र तल से 5 मीटर से कम ऊंची है, जिससे पानी धीरे-धीरे निकलता है।' : `ढलान ${slope.toFixed(1)}% है, जो सामान्य 1-8% की आदर्श श्रेणी में है।`,
    }
    return { irr: irrHi, con: conHi }
  }
  if (lang === 'te') {
    const isDry = (farm.analysis?.ndmi.mean ?? 0) < 0.1 || (farm.moisture !== undefined && farm.moisture < 15)
    const isRainy = (farm.rain ?? 0) >= 15
    const isStress = (farm.analysis?.stressPct ?? 0) >= 25
    const irrTe = {
      level: irr.level,
      chip: isStress && isDry && !isRainy ? 'వెంటనే నీరు పెట్టండి' : isDry && isRainy ? 'ఆగండి, వర్షం రానుంది' : isStress ? 'క్షేత్రాన్ని పరిశీలించండి' : 'ప్రస్తుతం అవసరం లేదు',
      title: isStress && isDry && !isRainy ? 'భూమి పొడిగా ఉంది, పంట ఒత్తిడిలో ఉంది: 2-3 రోజుల్లో నీరు పెట్టండి.' : isDry && isRainy ? 'నేల పొడిగా ఉంది, కానీ తగినంత వర్షం పడే సూచన ఉంది.' : isStress ? 'తేమ కొరత లేకుండానే పంటలో ఒత్తిడి కనిపిస్తోంది.' : 'పంట పెరుగుదల మరియు తేమ శాతం అనుకూలంగా ఉన్నాయి.',
      bullets: [
        `ఆకులలో తేమ సూచిక (NDMI) సగటు ${f(farm.analysis?.ndmi.mean)}; ${farm.analysis?.stressPct.toFixed(0)}% పిక్సెల్స్‌లో NDVI 0.3 కంటే తక్కువగా ఉంది.`,
        `రాబోయే 7 రోజుల వర్షపాత అంచనా: ${farm.rain !== undefined ? `${farm.rain.toFixed(1)} మి.మీ` : 'అందుబాటులో లేదు'}${farm.moisture !== undefined ? `, మోడల్ ఆధారిత నేల తేమ ${farm.moisture}%।` : '।'}`,
        ...(isStress && isDry && !isRainy ? ['మ్యాప్‌లోని ఎరుపు భాగాల నుండి ప్రారంభించండి; కాలువలు మరియు మోటార్లను తనిఖీ చేయండి.'] : isDry && isRainy ? ['నీరు పెట్టే ముందు వచ్చే వర్షం కోసం వేచి చూడండి, తర్వాత మళ్లీ తనిఖీ చేయండి.'] : isStress ? ['పురుగులు, పోషక లోపాలు లేదా నీరు నిలవడం వంటి ఇతర కారణాలను పరిశీలించండి.'] : ['తదుపరి ఉపగ్రహ చక్రం (ప్రతి 5 రోజులకు) తర్వాత మళ్లీ సరిచూసుకోండి.']),
        'సూచిక మాత్రమే. పంట పెరుగుదల దశ, నేల రకం మరియు వేర్ల లోతు ఇందులో లెక్కించబడలేదు.',
      ],
      why: isStress && isDry && !isRainy ? 'పొలంలో 25% కంటే ఎక్కువ భాగం ఒత్తిడిలో ఉంది, ఆకులలో మరియు నేలలో తేమ చాలా తక్కువగా ఉంది, వర్షం సూచన లేదు.' : isDry && isRainy ? 'ప్రస్తుతం తేమ తక్కువగా ఉన్నప్పటికీ, రాబోయే 7 రోజుల్లో 15 మి.మీ కంటే ఎక్కువ వర్షం కురిసే అవకాశం ఉంది.' : isStress ? 'చాలా పిక్సెల్స్ బలహీనంగా ఉన్నాయి, కానీ తేమ సాధారణంగా ఉంది, కాబట్టి నీరు ప్రధాన కారణం కాకపోవచ్చు.' : 'పొలంలో 25% కంటే తక్కువ భాగమే ఒత్తిడిలో ఉంది మరియు తేమ సరిపడా ఉంది.',
    }
    const slope = farm.analysis?.slopePct ?? 0
    const conTe = {
      level: con.level,
      chip: slope > 15 ? 'కష్టతరమైనది' : slope > 8 ? 'జాగ్రత్తతో సాధ్యం' : slope < 1 ? 'డ్రైనేజ్ పరిశీలించండి' : 'అనుకూలమైనది',
      title: slope > 15 ? 'తీవ్రమైన వాలు: భారీ మట్టి పనులు మరియు నేల కోత ముప్పు.' : slope > 8 ? 'మధ్యస్థ వాలు: ప్రవాహ నీరు మరియు నేల కోతను నియంత్రించండి.' : slope < 1 ? 'చాలా చదునైన లేదా పల్లపు ప్రాంతం: నీరు నిల్వ ఉండే ప్రమాదం.' : 'సహజ డ్రైనేజ్ సౌకర్యంతో కూడిన స్వల్ప వాలు.',
      bullets: [
        `భూమి ఎత్తు ${Math.round(farm.elevation ?? 0)} మీటర్లు; అంచనా వేసిన స్థానిక వాలు ${slope.toFixed(1)}%।`,
        ...(slope > 15 ? ['15% కంటే ఎక్కువ వాలు ఉన్నప్పుడు మెట్లు లేదా రిటైనింగ్ గోడలు నిర్మించాల్సి ఉంటుంది.'] : slope > 8 ? ['మంచి డ్రైనేజ్ ఉన్నప్పటికీ, మట్టి చదును మరియు ఉపరితల నీటి నియంత్రణను ప్లాన్ చేయండి.'] : slope < 1 ? ['భారీ వర్షాల తర్వాత నీరు నిల్వ ఉండే అవకాశం ఉంది; భూగర్భ జల మట్టాన్ని పరిశీలించండి.'] : ['1 నుండి 8% వాలు పెద్ద మార్పులు లేకుండా సహజంగా నీరు బయటకు పోయేలా చేస్తుంది.']),
        'ప్రాథమిక పరిశీలన మాత్రమే. ఇది ఇంజనీరింగ్ లేదా అధికారిక వరద సర్వే కాదు.',
      ],
      why: slope > 15 ? `భూమి ప్రతి 100 మీటర్లకు ${slope.toFixed(1)} మీటర్లు పెరుగుతుంది (15% కంటే ఎక్కువ).` : slope > 8 ? `వాలు ${slope.toFixed(1)}% ఉంది, ఇది 8% నుండి 15% మధ్య ఉంటుంది.` : slope < 1 ? 'వాలు 1% కంటే తక్కువగా ఉంది లేదా భూమి సముద్ర మట్టం కంటే 5 మీటర్ల కంటే తక్కువ ఎత్తులో ఉంది, కాబట్టి నీరు నెమ్మదిగా కదులుతుంది.' : `వాలు ${slope.toFixed(1)}% ఉంది, ఇది సహజంగా నీరు పారే అనుకూల పరిధి.`,
    }
    return { irr: irrTe, con: conTe }
  }
  return { irr, con }
}

export async function buildReport(farm: ReportFarm, onStep: (msg: string) => void = () => {}, opts: ReportOpts = DEFAULT_OPTS) {
  const an = farm.analysis
  if (!an) throw new Error('Press Refresh first so the satellite analysis is ready, then create the report.')
  const lang: ReportLang = opts.lang || 'en'
  const t = I18N[lang] || I18N.en

  const ring = farmRing(farm), fb = farmBBox(farm)
  onStep(lang === 'hi' ? 'खेत का उपग्रह चित्र लोड किया जा रहा है' : lang === 'te' ? 'పొలం యొక్క ఉపగ్రహ చిత్రాన్ని లోడ్ చేస్తున్నాము' : 'Loading the satellite picture of your farm')
  const [g, dem] = await Promise.all([loadScene(an.scene, farm), loadDem(farm).catch(() => null)])
  const view = makeView(fb)

  onStep(lang === 'hi' ? 'ताज़ा उपग्रह चित्र डाउनलोड किया जा रहा है' : lang === 'te' ? 'తాజా ఉపగ్రహ ఫోటోను డౌన్‌లోడ్ చేస్తున్నాము' : 'Downloading the fresh satellite photo')
  const base = await dataUrl(esri(view))

  onStep(lang === 'hi' ? 'मानचित्र तैयार किए जा रहे हैं' : lang === 'te' ? 'పటాలను రూపొందిస్తున్నాము' : 'Drawing the maps')
  const nd = byId('ndvi')
  let lo = Infinity, hi = -Infinity
  const demRange = dem ? (() => { for (let i = 0; i < dem.w * dem.h; i++) if (dem.ok[i] && dem.inside[i]) { lo = Math.min(lo, dem.b.elev[i]); hi = Math.max(hi, dem.b.elev[i]) } return Number.isFinite(lo) ? [lo, hi] : [0, 1] })() : [0, 1]
  const step = nice((demRange[1] - demRange[0]) / 8, [0.5, 1, 2, 5, 10, 20, 50, 100])
  const ha = farm.area || areaHa(ring)
  const specs = buildSpecs(opts, view, base, ring, g, dem, an, opts.contour || step, lang)
  if (!specs.length) throw new Error('Pick at least one map in Advanced settings.')
  const figs = specs.map(sp => `<figure>${mapFigure(sp, opts.cart, lang)}<figcaption>${t.mapCaption(sp.num, esc(sp.name), esc(sp.credit), ring.length, sp.id)}</figcaption></figure>`).join('')

  onStep(lang === 'hi' ? 'गणितीय विश्लेषण एवं आंकड़े निकाले जा रहे हैं' : lang === 'te' ? 'గణాంకాలు మరియు విశ్లేషణను లెక్కిస్తున్నాము' : 'Doing the maths')
  let total = 0, valid = 0, low = 0, mid = 0, high = 0
  const counts = new Array(24).fill(0)
  const cell: { n: number; low: number }[] = Array.from({ length: 9 }, () => ({ n: 0, low: 0 }))
  const sum: Record<string, number> = { B04: 0, B08: 0, B11: 0, B03: 0 }
  for (let i = 0; i < g.w * g.h; i++) {
    if (!g.inside[i]) continue
    total++
    if (!g.ok[i]) continue
    const v = nd.value!(g.b, i)
    if (!Number.isFinite(v) || v < -1 || v > 1) continue
    valid++
    for (const k of Object.keys(sum)) sum[k] += g.b[k][i]
    if (v < 0.3) low++; else if (v < 0.5) mid++; else high++
    counts[Math.min(23, Math.max(0, Math.floor(((v + 0.2) / 1.2) * 24)))]++
    const cx = Math.min(2, Math.floor(((i % g.w) / g.w) * 3)), cy = Math.min(2, Math.floor((Math.floor(i / g.w) / g.h) * 3))
    cell[cy * 3 + cx].n++; if (v < 0.3) cell[cy * 3 + cx].low++
  }
  const mB04 = sum.B04 / Math.max(1, valid), mB08 = sum.B08 / Math.max(1, valid), mB11 = sum.B11 / Math.max(1, valid), mB03 = sum.B03 / Math.max(1, valid)
  const ndviOfMeans = (mB08 - mB04) / (mB08 + mB04), ndmiOfMeans = (mB08 - mB11) / (mB08 + mB11)
  const coverage = total ? (valid / total) * 100 : 0
  const names = ['NW', 'N', 'NE', 'W', 'Centre', 'E', 'SW', 'S', 'SE']
  const cells = cell.map((c, i) => ({ name: names[i], pct: c.n ? (c.low / c.n) * 100 : 0, n: c.n }))
  const worst = [...cells].sort((a, b) => b.pct - a.pct)[0]
  const weakLabel = lang === 'hi' ? 'कमजोर' : lang === 'te' ? 'బలహీనం' : 'weak'
  const heat = `<div class="heat">${cells.map(c => { const col = rampColor(['#1a9850', '#fee08b', '#d73027'], Math.min(1, c.pct / 50)).map(Math.round); return `<div style="background:rgb(${col})"><b>${t.dirs[c.name] ?? c.name}</b><span>${c.pct.toFixed(0)}% ${weakLabel}</span></div>` }).join('')}</div>`

  const rows = INDICATORS.filter(i => i.value && (i.source === 'S2' || (dem && ['dem', 'slope', 'twi', 'sink'].includes(i.id)))).map(i => {
    const s = indexStat(i.source === 'S2' ? g : dem!, i.id); if (!s) return ''
    const vd = verdict(i.id, s.mean)
    let vdWord = vd?.word ?? '', vdWhy = vd?.why ?? ''
    if (lang === 'hi') {
      if (vdWord === 'healthy') vdWord = 'स्वस्थ'
      else if (vdWord === 'good') vdWord = 'अच्छा'
      else if (vdWord === 'moderate') vdWord = 'मध्यम'
      else if (vdWord === 'stressed' || vdWord === 'weak') vdWord = 'तनावग्रस्त'
    } else if (lang === 'te') {
      if (vdWord === 'healthy') vdWord = 'ఆరోగ్యకరం'
      else if (vdWord === 'good') vdWord = 'మంచిది'
      else if (vdWord === 'moderate') vdWord = 'మధ్యస్థం'
      else if (vdWord === 'stressed' || vdWord === 'weak') vdWord = 'ఒత్తిడిలో ఉంది'
    }
    return `<tr><td><b>${esc(i.name)}</b><small>${esc(i.group)}</small></td><td>${esc(i.desc)}</td><td>${f(s.mean, 3)}</td><td>${f(s.min, 2)} to ${f(s.max, 2)}</td><td>${vd ? `<span class="pill ${vd.tone}">${esc(vdWord)}</span><small>${esc(vdWhy)}</small>` : ''}</td></tr>`
  }).join('')

  let aspect = ''
  if (dem) {
    const sec = new Array(8).fill(0); let n = 0
    for (let i = 0; i < dem.w * dem.h; i++) if (dem.inside[i] && dem.ok[i] && dem.b.slope[i] > 1) { sec[Math.round(dem.b.aspect[i] / 45) % 8]++; n++ }
    const nm = lang === 'hi'
      ? ['उत्तर (N)', 'उत्तर-पूर्व (NE)', 'पूर्व (E)', 'दक्षिण-पूर्व (SE)', 'दक्षिण (S)', 'दक्षिण-पश्चिम (SW)', 'पश्चिम (W)', 'उत्तर-पश्चिम (NW)']
      : lang === 'te'
      ? ['ఉత్తరం (N)', 'ఈశాన్యం (NE)', 'తూర్పు (E)', 'ఆగ్నేయం (SE)', 'దక్షిణం (S)', 'నైరుతి (SW)', 'పడమర (W)', 'వాయవ్యం (NW)']
      : ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
    const noAspectMsg = lang === 'hi' ? 'ज़मीन लगभग समतल है, अतः ढलान की कोई एक दिशा प्रमुख नहीं है।' : lang === 'te' ? 'భూమి దాదాపు చదునుగా ఉంది, కాబట్టి నిర్దిష్ట వాలు దిశ లేదు.' : 'The ground is almost flat, so no slope direction stands out.'
    aspect = n ? `<div class="bars">${sec.map((c, i) => `<div><span>${nm[i]}</span><i style="width:${(c / n) * 100}%"></i><b>${((c / n) * 100).toFixed(0)}%</b></div>`).join('')}</div>` : `<p class="muted">${noAspectMsg}</p>`
  }

  const { irr, con } = getLocalizedAdvice(farm, lang)
  const adviceHtml = ([[t.irrigationTitle, irr], [t.constructionTitle, con]] as const).map(([title, a]) => `<div class="advice ${a.level}"><h4>${title}<span>${esc(a.chip)}</span></h4><p><b>${esc(a.title)}</b></p><ul>${a.bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul>${a.why ? `<p class="why"><b>${t.whyLabel}</b> ${esc(a.why)}</p>` : ''}</div>`).join('')

  const now = new Date(), tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const sceneDate = new Date(an.scene.datetime)
  const rid = `SEVA-${farm.id}-${now.toISOString().slice(0, 16).replace(/[-:T]/g, '')}`
  const c = { lat: farm.lat, lon: farm.lon }
  const sw = fb[2] - fb[0], sh = fb[3] - fb[1]
  const data = {
    reportId: rid, language: lang,
    farm: { name: farm.name, place: farm.location, crop: farm.crop, areaHa: ha, areaAcres: ha * 2.47105, lat: c.lat, lon: c.lon, vertices: ring.length, widthM: sw * 111320 * Math.cos((c.lat * Math.PI) / 180), heightM: sh * 111320, elevation: farm.elevation ?? an.elevMean, boundary: ring },
    satellite: { scene: an.scene.id, acquired: an.scene.datetime, cloud: an.scene.cloud, pixels: valid, coverage },
    analysis: { ndvi: an.ndvi, ndmi: an.ndmi, ndwi: an.ndwi, stressPct: an.stressPct, slopePct: an.slopePct, slopeDeg: an.slopeDeg, analysedAt: an.analysedAt },
    weather: { rain7d: farm.rain, soilMoisture: farm.moisture }, advice: { irrigation: irr, construction: con }, passes: farm.passes ?? [], generated: now.toISOString(), timezone: tz,
  }

  const verdictKey: 'healthy' | 'good' | 'moderate' | 'weak' = an.ndvi.mean >= 0.6 ? 'healthy' : an.ndvi.mean >= 0.5 ? 'good' : an.ndvi.mean >= 0.35 ? 'moderate' : 'weak'
  const verdictWord = t.verdict[verdictKey]
  const kpi = (l: string, v: string, s: string) => `<div class="kpi"><small>${l}</small><b>${v}</b><span>${s}</span></div>`
  const yes = (ok: boolean) => {
    const word = lang === 'hi' ? (ok ? 'हाँ' : 'नहीं') : lang === 'te' ? (ok ? 'అవును' : 'కాదు') : (ok ? 'yes' : 'no')
    return ok ? `<span class="pill good">${word}</span>` : `<span class="pill info">${word}</span>`
  }
  const dry = an.ndmi.mean < 0.1 || (farm.moisture !== undefined && farm.moisture < 15), rainy = (farm.rain ?? 0) >= 15

  const logo = await dataUrl(logoUrl)
  const cover = fill(`<header class="cover"><div class="brandbar"><img src="${logo}" alt="SEVA.GIS logo"/><div><b>SEVA<em>.GIS</em></b><span>Spatial Evaluation &amp; Vegetation Analytics</span></div></div><div class="eyebrow">${t.eyebrow}</div><h1>{d.farm.name}</h1><p class="sub">{d.farm.place} · ${t.crop}: {d.farm.crop} · {d.farm.areaHa:n1} ${t.hectares} ({d.farm.areaAcres:n1} ${t.acres})</p><div class="kpis">`, data)
    + kpi(t.kpiHealth, f(an.ndvi.mean), verdictWord) + kpi(t.kpiStress, `${f(an.stressPct, 0)}%`, t.kpiStressSub) + kpi(t.kpiWater, f(an.ndmi.mean), t.kpiWaterSub) + kpi(t.kpiSlope, an.slopePct === undefined ? 'n/a' : `${an.slopePct.toFixed(1)}%`, t.kpiSlopeSub)
    + fill(`</div><div class="locbox"><div><small>${t.loc}</small><b>{d.farm.place}</b><span>{d.farm.lat:n3}° N, {d.farm.lon:n3}° E · {d.farm.areaHa:n1} ha</span></div><div><small>${t.satPic}</small><b>{d.satellite.acquired}</b><span>Sentinel-2 · cloud {d.satellite.cloud:n0}%</span></div><div><small>${t.repId}</small><b>{d.reportId}</b><span>${t.madeWith}</span></div></div><p class="srcline">${t.dataSrcNote}</p></header>`, data)

  const section = (n: number, title: string, bContent: string) => `<section class="sec"><h2><span>${n}</span>${title}</h2>${bContent}</section>`
  const plain = (txt: string) => `<div class="plain"><b>${t.plainWords}</b><p>${txt}</p></div>`

  const dateFmt = sceneDate.toLocaleDateString(lang === 'hi' ? 'hi-IN' : lang === 'te' ? 'te-IN' : 'en-US', { dateStyle: 'full' })
  const worstTxt = worst && worst.pct > 20 ? t.worstCornerText(t.dirs[worst.name] ?? worst.name, worst.pct.toFixed(0)) : t.noCornerWeak
  const sec1Text = t.summaryP1(esc(farm.name), dateFmt, verdictWord, f(an.ndvi.mean), f(an.stressPct, 0), worstTxt)

  const weatherNote = lang === 'hi'
    ? `मौसम: अगले 7 दिनों में वर्षा ${farm.rain === undefined ? 'अनुपलब्ध' : farm.rain.toFixed(1) + ' मिमी'}; सतही मिट्टी की नमी ${farm.moisture ?? 'अनुपलब्ध'}% (ओपन-मेटियो)।`
    : lang === 'te'
    ? `వాతావరణం: రాబోయే 7 రోజుల వర్షపాతం ${farm.rain === undefined ? 'లభించలేదు' : farm.rain.toFixed(1) + ' మి.మీ'}; మోడల్ చేసిన నేల తేమ ${farm.moisture ?? 'అందుబాటులో లేదు'}% (ఓపెన్-మెటియో).`
    : `Weather: rain next 7 days ${farm.rain === undefined ? 'not fetched' : farm.rain.toFixed(1) + ' mm'}; modelled surface soil moisture ${farm.moisture ?? 'n/a'}% (Open-Meteo).`

  const sec4Content = lang === 'hi' ? `
    ${plain(t.sec4Plain)}
    <h3>a) खेत का आकार एवं क्षेत्रफल</h3><p>सीमा में ${ring.length} कोने हैं। शूलेस सूत्र (1° अक्षांश ≈ 111,320 मी) के अनुसार क्षेत्रफल <b>${f(ha, 2)} हेक्टेयर</b> (${f(ha * 2.47105, 2)} एकड़) है। सेंटिनल-2 का एक पिक्सल 10 मी × 10 मी = 0.01 हेक्टेयर होता है, अतः खेत लगभग ${f(ha / 0.01, 0)} पिक्सल का विस्तार रखता है। हमने सीमा के भीतर <b>${valid}</b> स्पष्ट पिक्सल का विश्लेषण किया (${coverage.toFixed(0)}% कवरेज)।</p>
    <h3>b) फसल स्वास्थ्य (NDVI)</h3><p>स्वस्थ पत्तियां निकट-अवरक्त प्रकाश (NIR, बैंड B08) परावर्तित करती हैं और लाल प्रकाश (B04) अवशोषित करती हैं। <code>NDVI = (NIR − Red) ÷ (NIR + Red)</code>।</p><p class="calc">खेत का औसत: NIR = ${f(mB08, 4)}, Red = ${f(mB04, 4)}<br>औसत मानों का NDVI = (${f(mB08, 4)} − ${f(mB04, 4)}) ÷ (${f(mB08, 4)} + ${f(mB04, 4)}) = <b>${f(ndviOfMeans, 3)}</b><br>प्रत्येक पिक्सल के अपने NDVI का औसत = <b>${f(an.ndvi.mean, 3)}</b> (यह वह संख्या है जिसे हम रिपोर्ट करते हैं, क्योंकि यह प्रत्येक वर्ग को समान महत्व देती है)</p>
    <h3>c) पत्तियों में नमी (NDMI)</h3><p><code>NDMI = (NIR − SWIR1) ÷ (NIR + SWIR1)</code> जहाँ SWIR1 = बैंड B11 है। नम पत्तियां अधिक SWIR प्रकाश अवशोषित करती हैं।</p><p class="calc">SWIR1 = ${f(mB11, 4)}<br>औसत मानों का NDMI = (${f(mB08, 4)} − ${f(mB11, 4)}) ÷ (${f(mB08, 4)} + ${f(mB11, 4)}) = <b>${f(ndmiOfMeans, 3)}</b><br>प्रत्येक पिक्सल के NDMI का औसत = <b>${f(an.ndmi.mean, 3)}</b></p>
    <h3>d) तनावग्रस्त क्षेत्र का अनुपात</h3><p><code>तनावग्रस्त % = 0.3 से कम NDVI वाले पिक्सल ÷ कुल स्पष्ट पिक्सल × 100</code></p><p class="calc">${low} ÷ ${valid} × 100 = <b>${valid ? ((low / valid) * 100).toFixed(1) : 'n/a'}%</b> (ऐप मान ${f(an.stressPct, 1)}%)</p>
    <h3>e) भूमि ढलान</h3><p>30 मीटर भूभाग मॉडल से हॉर्न (1981) पद्धति द्वारा ढलान, फिर <code>ढलान % = tan(कोण) × 100</code>।</p><p class="calc">${an.slopeDeg === undefined ? 'ढलान अनुपलब्ध।' : `औसत कोण ${f(an.slopeDeg, 2)}° → tan(${f(an.slopeDeg, 2)}°) × 100 = <b>${f(an.slopePct, 2)}%</b>। 8% ढलान का अर्थ है 100 मीटर चलने पर भूमि 8 मीटर ऊपर उठती है।`}</p>
    <h3>f) आपके खेत के लिए जांची गई नियम तालिका</h3><table class="t"><tr><th>प्रश्न</th><th>खेत का वास्तविक मान</th><th>मानक नियम</th><th>परिणाम</th></tr>
    <tr><td>क्या पत्तियां सूखी दिख रही हैं?</td><td>NDMI ${f(an.ndmi.mean)}; मिट्टी की नमी ${farm.moisture ?? 'अनुपलब्ध'}%</td><td>NDMI 0.1 से कम या मिट्टी की नमी 15% से कम</td><td>${yes(dry)}</td></tr>
    <tr><td>क्या पर्याप्त बारिश आने वाली है?</td><td>${farm.rain === undefined ? 'अनुपलब्ध' : `${farm.rain.toFixed(1)} मिमी`} (7 दिन में)</td><td>15 मिमी या अधिक</td><td>${yes(rainy)}</td></tr>
    <tr><td>क्या खेत तनाव में है?</td><td>${f(an.stressPct, 0)}% कमजोर</td><td>25% या अधिक (20% से ऊपर ध्यान देने योग्य)</td><td>${yes(an.stressPct >= 25)}</td></tr>
    <tr><td>क्या भूमि अधिक ढलान वाली है?</td><td>${an.slopePct === undefined ? 'अनुपलब्ध' : `${an.slopePct.toFixed(1)}%`}</td><td>8% से अधिक पर सावधानी, 15% से अधिक कठिन</td><td>${yes((an.slopePct ?? 0) > 8)}</td></tr></table>
  ` : lang === 'te' ? `
    ${plain(t.sec4Plain)}
    <h3>a) పొలం పరిమాణం & విస్తీర్ణం</h3><p>సరిహద్దులో ${ring.length} మూలలు ఉన్నాయి. స్థానిక చదునైన గ్రిడ్‌పై షూలేస్ సూత్రం (1° అక్షాంశం ≈ 111,320 మీ) ప్రకారం, విస్తీర్ణం <b>${f(ha, 2)} హెక్టార్లు</b> (${f(ha * 2.47105, 2)} ఎకరాలు). సెంటినెల్-2 పిక్సెల్ పరిమాణం 10 మీ × 10 మీ = 0.01 హెక్టార్లు, కాబట్టి పొలం సుమారు ${f(ha / 0.01, 0)} పిక్సెల్స్ కలిగి ఉంటుంది. మేము సరిహద్దు లోపల <b>${valid}</b> స్పష్టమైన పిక్సెల్స్‌ను విశ్లేషించాము (${coverage.toFixed(0)}% కవరేజ్).</p>
    <h3>b) పంట ఆరోగ్యం (NDVI)</h3><p>ఆరోగ్యకరమైన ఆకులు నియర్-ఇన్‌ఫ్రారెడ్ కాంతిని (NIR, బ్యాండ్ B08) ప్రతిబింబిస్తాయి మరియు ఎరుపు కాంతిని (B04) గ్రహిస్తాయి. <code>NDVI = (NIR − Red) ÷ (NIR + Red)</code>.</p><p class="calc">పొలం సగటు: NIR = ${f(mB08, 4)}, Red = ${f(mB04, 4)}<br>సగటు విలువల NDVI = (${f(mB08, 4)} − ${f(mB04, 4)}) ÷ (${f(mB08, 4)} + ${f(mB04, 4)}) = <b>${f(ndviOfMeans, 3)}</b><br>ప్రతి పిక్సెల్ స్వంత NDVI సగటు = <b>${f(an.ndvi.mean, 3)}</b> (ఈ సంఖ్యనే మేము నివేదికలో సూచిస్తాము, ఎందుకంటే ఇది ప్రతి చదరపు భాగాన్ని సమానంగా లెక్కిస్తుంది)</p>
    <h3>c) ఆకులలో తేమ (NDMI)</h3><p><code>NDMI = (NIR − SWIR1) ÷ (NIR + SWIR1)</code> (SWIR1 = బ్యాండ్ B11). తేమ కలిగిన ఆకులు ఎక్కువ SWIR కాంతిని గ్రహిస్తాయి.</p><p class="calc">SWIR1 = ${f(mB11, 4)}<br>సగటుల NDMI = (${f(mB08, 4)} − ${f(mB11, 4)}) ÷ (${f(mB08, 4)} + ${f(mB11, 4)}) = <b>${f(ndmiOfMeans, 3)}</b><br>ప్రతి పిక్సెల్ స్వంత NDMI సగటు = <b>${f(an.ndmi.mean, 3)}</b></p>
    <h3>d) ఒత్తిడికి గురైన విస్తీర్ణం శాతం</h3><p><code>ఒత్తిడి % = (0.3 కంటే తక్కువ NDVI ఉన్న పిక్సెల్స్ ÷ మొత్తం స్పష్టమైన పిక్సెల్స్) × 100</code></p><p class="calc">${low} ÷ ${valid} × 100 = <b>${valid ? ((low / valid) * 100).toFixed(1) : 'n/a'}%</b> (యాప్ విలువ ${f(an.stressPct, 1)}%)</p>
    <h3>e) భూమి వాలు</h3><p>హార్న్ (1981) పద్ధతి ద్వారా 30 మీటర్ల భూభాగ నమూనా నుండి వాలు, తర్వాత <code>వాలు % = tan(కోణం) × 100</code>.</p><p class="calc">${an.slopeDeg === undefined ? 'వాలు అందుబాటులో లేదు.' : `సగటు కోణం ${f(an.slopeDeg, 2)}° → tan(${f(an.slopeDeg, 2)}°) × 100 = <b>${f(an.slopePct, 2)}%</b>. 8% వాలు అంటే 100 మీటర్ల దూరానికి భూమి 8 మీటర్లు పెరుగుతుంది.`}</p>
    <h3>f) మీ పొలం కోసం పరిశీలించిన నియమాలు</h3><table class="t"><tr><th>ప్రశ్న</th><th>మీ విలువ</th><th>ప్రామాణిక నియమం</th><th>ఫలితం</th></tr>
    <tr><td>ఆకులు పొడిగా కనిపిస్తున్నాయా?</td><td>NDMI ${f(an.ndmi.mean)}; నేల తేమ ${farm.moisture ?? 'అందుబాటులో లేదు'}%</td><td>NDMI 0.1 కంటే తక్కువ లేదా నేల తేమ 15% కంటే తక్కువ</td><td>${yes(dry)}</td></tr>
    <tr><td>తగినంత వర్షం పడే అవకాశం ఉందా?</td><td>${farm.rain === undefined ? 'లభించలేదు' : `${farm.rain.toFixed(1)} మి.మీ`} (7 రోజుల్లో)</td><td>15 మి.మీ లేదా అంతకంటే ఎక్కువ</td><td>${yes(rainy)}</td></tr>
    <tr><td>పొలం ఒత్తిడిలో ఉందా?</td><td>${f(an.stressPct, 0)}% బలహీనంగా ఉంది</td><td>25% లేదా ఎక్కువ (20% పైన శ్రద్ధ అవసరం)</td><td>${yes(an.stressPct >= 25)}</td></tr>
    <tr><td>భూమి నిటారుగా ఉందా?</td><td>${an.slopePct === undefined ? 'అందుబాటులో లేదు' : `${an.slopePct.toFixed(1)}%`}</td><td>8% పైన జాగ్రత్త అవసరం, 15% పైన కష్టం</td><td>${yes((an.slopePct ?? 0) > 8)}</td></tr></table>
  ` : `
    ${plain(t.sec4Plain)}
    <h3>a) Farm size</h3><p>The boundary has ${ring.length} corners. Using the shoelace formula on a flat local grid (1° latitude ≈ 111,320 m), the area is <b>${f(ha, 2)} ha</b> (${f(ha * 2.47105, 2)} acres). A Sentinel-2 pixel is 10 m × 10 m = 0.01 ha, so the farm covers about ${f(ha / 0.01, 0)} pixels. We used <b>${valid}</b> clear pixels inside the boundary at the grid resolution (${coverage.toFixed(0)}% coverage).</p>
    <h3>b) Crop health, NDVI</h3><p>Healthy leaves reflect near-infrared light (NIR, band B08) and absorb red light (B04). <code>NDVI = (NIR − Red) ÷ (NIR + Red)</code>.</p><p class="calc">Farm averages: NIR = ${f(mB08, 4)}, Red = ${f(mB04, 4)}<br>NDVI of the averages = (${f(mB08, 4)} − ${f(mB04, 4)}) ÷ (${f(mB08, 4)} + ${f(mB04, 4)}) = <b>${f(ndviOfMeans, 3)}</b><br>Average of every pixel's own NDVI = <b>${f(an.ndvi.mean, 3)}</b> (this is the number we report, because it treats each square equally)</p>
    <h3>c) Leaf water, NDMI</h3><p><code>NDMI = (NIR − SWIR1) ÷ (NIR + SWIR1)</code> with SWIR1 = band B11. Wet leaves absorb more SWIR light.</p><p class="calc">SWIR1 = ${f(mB11, 4)}<br>NDMI of the averages = (${f(mB08, 4)} − ${f(mB11, 4)}) ÷ (${f(mB08, 4)} + ${f(mB11, 4)}) = <b>${f(ndmiOfMeans, 3)}</b><br>Average of every pixel's NDMI = <b>${f(an.ndmi.mean, 3)}</b></p>
    <h3>d) Stressed share</h3><p><code>Stressed % = pixels with NDVI below 0.3 ÷ all clear pixels × 100</code></p><p class="calc">${low} ÷ ${valid} × 100 = <b>${valid ? ((low / valid) * 100).toFixed(1) : 'n/a'}%</b> (app value ${f(an.stressPct, 1)}%)</p>
    <h3>e) Slope</h3><p>Slope from the 30 m terrain model by the Horn (1981) method, then <code>slope % = tan(angle) × 100</code>.</p><p class="calc">${an.slopeDeg === undefined ? 'Slope not available.' : `Average angle ${f(an.slopeDeg, 2)}° → tan(${f(an.slopeDeg, 2)}°) × 100 = <b>${f(an.slopePct, 2)}%</b>. A slope of 8% means the ground rises 8 m over 100 m.`}</p>
    <h3>f) Advice rules checked on your farm</h3><table class="t"><tr><th>Question</th><th>Your value</th><th>Rule</th><th>Result</th></tr>
    <tr><td>Do the leaves look dry?</td><td>NDMI ${f(an.ndmi.mean)}; soil moisture ${farm.moisture ?? 'n/a'}%</td><td>NDMI below 0.1 or soil moisture below 15%</td><td>${yes(dry)}</td></tr>
    <tr><td>Is real rain coming?</td><td>${farm.rain === undefined ? 'n/a' : `${farm.rain.toFixed(1)} mm`} in 7 days</td><td>15 mm or more</td><td>${yes(rainy)}</td></tr>
    <tr><td>Is the farm stressed?</td><td>${f(an.stressPct, 0)}% weak</td><td>25% or more (needs-attention flag at above 20%)</td><td>${yes(an.stressPct >= 25)}</td></tr>
    <tr><td>Is the land steep?</td><td>${an.slopePct === undefined ? 'n/a' : `${an.slopePct.toFixed(1)}%`}</td><td>Above 8% takes care, above 15% is hard</td><td>${yes((an.slopePct ?? 0) > 8)}</td></tr></table>
  `

  const idxTh = lang === 'hi'
    ? '<tr><th>सूचकांक (Index)</th><th>मापन एवं सूत्र</th><th>खेत का औसत</th><th>न्यूनतम से अधिकतम</th><th>निष्कर्ष / अर्थ</th></tr>'
    : lang === 'te'
    ? '<tr><th>సూచిక (Index)</th><th>కొలమానం & సూత్రం</th><th>పొలం సగటు</th><th>కనిష్టం నుండి గరిష్టం</th><th>నిర్ధారణ / అర్థం</th></tr>'
    : '<tr><th>Index</th><th>What it measures and formula</th><th>Farm average</th><th>Lowest to highest</th><th>Meaning</th></tr>'

  const body = [
    section(1, t.toc[0], plain(sec1Text) + `<div class="grid2">${adviceHtml}</div>`),
    section(2, t.toc[1], `${plain(t.sec2Plain)}${figs}`),
    section(3, t.toc[2], `${plain(t.sec3Plain)}
      <h3>${t.sec3H3_1}</h3>${svgDonut([{ v: high, c: '#1a9850', l: t.donutLabels.healthy }, { v: mid, c: '#fee08b', l: t.donutLabels.moderate }, { v: low, c: '#d73027', l: t.donutLabels.stressed }])}
      <h3>${t.sec3H3_2}</h3>${svgHist(counts, -0.2, 1, lang)}
      <h3>${t.sec3H3_3}</h3>${heat}
      <h3>${t.sec3H3_4}</h3>${svgLine(farm.passes ?? [], lang)}
      <div class="kpis small">${kpi(t.kpiLowest, f(an.ndvi.p10), t.kpiLowestSub)}${kpi(t.kpiMedian, f(an.ndvi.p50), t.kpiMedianSub)}${kpi(t.kpiHighest, f(an.ndvi.p90), t.kpiHighestSub)}${kpi(t.kpiCoverage, `${coverage.toFixed(0)}%`, t.kpiCoverageSub)}</div>`),
    section(4, t.toc[3], sec4Content),
    section(5, t.toc[4], `${plain(t.sec5Plain)}<div class="scroll"><table class="t idx">${idxTh}${rows}</table></div>`),
    section(6, t.toc[5], `${plain(t.sec6Plain)}<div class="kpis small">${kpi('Elevation', `${f(farm.elevation ?? an.elevMean, 0)} m`, 'above sea level')}${kpi('Lowest to highest', dem ? `${demRange[0].toFixed(0)} to ${demRange[1].toFixed(0)} m` : 'n/a', 'inside the boundary')}${kpi('Average slope', an.slopePct === undefined ? 'n/a' : `${an.slopePct.toFixed(1)}%`, an.slopeDeg === undefined ? '' : `${an.slopeDeg.toFixed(1)}°`)}${kpi('Contour gap', `${step} m`, 'one line per step')}</div><h3>${lang === 'hi' ? 'भूमि का मुख किस दिशा में है (ढलान का प्रतिशत)' : lang === 'te' ? 'భూమి ఏ దిశ వైపు వాలి ఉంది (వాలు శాతం)' : 'Which way the ground faces (share of sloping ground)'}</h3>${aspect || `<p class="muted">${lang === 'hi' ? 'भूभाग डेटा उपलब्ध नहीं है।' : lang === 'te' ? 'భూ స్వరూప డేటా అందుబాటులో లేదు.' : 'Terrain not available.'}</p>`}`),
    section(7, t.toc[6], `${plain(t.sec7Plain)}<div class="grid2">${adviceHtml}</div><p class="muted">${weatherNote}</p>`),
    section(8, t.toc[7], `${plain(t.sec8Plain)}<ol class="refs">${REFS.map(r => `<li><a href="${r[1]}">${esc(r[0])}</a><br><small>${esc(r[2])}</small></li>`).join('')}</ol>
      <p><b>${lang === 'hi' ? 'उपयोग किया गया उपग्रह दृश्य:' : lang === 'te' ? 'ఉపయోగించిన ఉపగ్రహ దృశ్యం:' : 'Scene used:'}</b> ${esc(an.scene.id)}, ${lang === 'hi' ? 'अधिग्रहण समय' : lang === 'te' ? 'తీసిన సమయం' : 'taken'} ${esc(an.scene.datetime)}, ${lang === 'hi' ? 'बादल आवरण' : lang === 'te' ? 'మేఘాల కవరేజ్' : 'cloud cover'} ${an.scene.cloud}%।</p>`),
    section(9, t.toc[8], `<ul>${t.limits.map(l => `<li>${l}</li>`).join('')}</ul>`),
    section(10, t.toc[9], `<p><a href="https://sevagis.dpdns.org" target="_blank" rel="noopener noreferrer">sevagis.dpdns.org</a></p>`),
  ].join('')

  const rf = t.recordFields
  const record = fill(`<footer class="record"><h2>${t.recordTitle}</h2><table class="t rec">
    <tr><th>${rf.reportId}</th><td>{d.reportId}</td><th>${rf.farm}</th><td>{d.farm.name}</td></tr>
    <tr><th>${rf.place}</th><td>{d.farm.place}</td><th>${rf.crop}</th><td>{d.farm.crop}</td></tr>
    <tr><th>${rf.lat}</th><td>{d.farm.lat:n3}° N</td><th>${rf.lon}</th><td>{d.farm.lon:n3}° E</td></tr>
    <tr><th>${rf.size}</th><td>{d.farm.areaHa:n2} ha ({d.farm.areaAcres:n2} acres)</td><th>${rf.dims}</th><td>{d.farm.widthM:n0} m × {d.farm.heightM:n0} m</td></tr>
    <tr><th>${rf.scene}</th><td>{d.satellite.scene}</td><th>${rf.cloud}</th><td>{d.satellite.cloud:n0}%</td></tr>
    <tr><th>${rf.corners}</th><td>{d.farm.vertices}</td><th>${rf.pixels}</th><td>{d.satellite.pixels} ({d.satellite.coverage:n0}%)</td></tr></table>
    <table class="t rec"><tr><th>${rf.timeSat}</th><td>${esc(sceneDate.toUTCString())}<br><small>${esc(sceneDate.toLocaleString(lang === 'hi' ? 'hi-IN' : lang === 'te' ? 'te-IN' : undefined, { dateStyle: 'full', timeStyle: 'long' }))} (${esc(tz)})</small></td></tr>
    <tr><th>${rf.analysisRun}</th><td>${esc(new Date(an.analysedAt).toLocaleString(lang === 'hi' ? 'hi-IN' : lang === 'te' ? 'te-IN' : undefined, { dateStyle: 'full', timeStyle: 'long' }))}</td></tr>
    <tr><th>${rf.downloaded}</th><td>${esc(now.toLocaleString(lang === 'hi' ? 'hi-IN' : lang === 'te' ? 'te-IN' : undefined, { dateStyle: 'full', timeStyle: 'long' }))}<br><small>${esc(now.toUTCString())} · Time zone ${esc(tz)}</small></td></tr>
    <tr><th>${rf.dms}</th><td>${dms(c.lat, 'N', 'S')}, ${dms(c.lon, 'E', 'W')}</td></tr>
    <tr><th>${rf.bbox}</th><td>West ${fb[0].toFixed(5)}°, South ${fb[1].toFixed(5)}°, East ${fb[2].toFixed(5)}°, North ${fb[3].toFixed(5)}° (WGS 84)</td></tr>
    <tr><th>${rf.madeWith}</th><td>SEVA.GIS</td></tr></table></footer>`, data)

  const SCRIPT = `(function(){var RID=document.body.getAttribute('data-rid');function ls(k,v){try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v)}catch(e){return null}}
document.querySelectorAll('svg.cart').forEach(function(svg){var id=svg.getAttribute('data-fig'),W=+svg.getAttribute('data-w'),H=+svg.getAttribute('data-h'),key='seva-pos:'+RID+':'+id,pos={};try{pos=JSON.parse(ls(key)||'{}')}catch(e){}
function put(g,x,y){g.setAttribute('transform','translate('+x.toFixed(1)+' '+y.toFixed(1)+')')}
svg.querySelectorAll('.cel').forEach(function(g){g.setAttribute('data-x0',g.getAttribute('transform'));var p=pos[g.getAttribute('data-el')];if(p)put(g,p[0],p[1])});
svg.addEventListener('dblclick',function(){svg.classList.toggle('edit')});
var d=null;function pt(e,g){var m=g.parentNode.getScreenCTM().inverse(),q=svg.createSVGPoint();q.x=e.clientX;q.y=e.clientY;return q.matrixTransform(m)}
svg.addEventListener('pointerdown',function(e){if(!svg.classList.contains('edit'))return;var g=e.target.closest&&e.target.closest('.cel');if(!g)return;var q=pt(e,g),m=/translate\\(([-\\d.]+)[ ,]([-\\d.]+)\\)/.exec(g.getAttribute('transform'));d={g:g,dx:q.x-m[1],dy:q.y-m[2],w:+g.getAttribute('data-w'),h:+g.getAttribute('data-h')};svg.setPointerCapture(e.pointerId);e.preventDefault()});
svg.addEventListener('pointermove',function(e){if(!d)return;var q=pt(e,d.g),x=Math.max(0,Math.min(W-d.w,q.x-d.dx)),y=Math.max(0,Math.min(H-d.h,q.y-d.dy));put(d.g,x,y)});
function end(){if(!d)return;var m=/translate\\(([-\\d.]+)[ ,]([-\\d.]+)\\)/.exec(d.g.getAttribute('transform'));pos[d.g.getAttribute('data-el')]=[+m[1],+m[2]];ls(key,JSON.stringify(pos));d=null}
svg.addEventListener('pointerup',end);svg.addEventListener('pointercancel',end)});
document.querySelectorAll('[data-reset]').forEach(function(b){b.addEventListener('click',function(){var id=b.getAttribute('data-reset');ls('seva-pos:'+RID+':'+id,'{}');var svg=document.querySelector('svg.cart[data-fig="'+id+'"]');svg.querySelectorAll('.cel').forEach(function(g){g.setAttribute('transform',g.getAttribute('data-x0'))})})})})();`
  const css = `.brandbar{display:flex;align-items:center;gap:14px;margin-bottom:22px}.brandbar img{width:58px;height:58px;object-fit:contain;filter:drop-shadow(0 0 8px #4dff9a66)}.brandbar b{display:block;font:800 26px Manrope,sans-serif;letter-spacing:-1px}.brandbar b em{font-style:normal;color:#ffb85c;font-weight:600}.brandbar span{font-size:12px;color:#9fd6b5;letter-spacing:.5px}.locbox{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:22px}.locbox>div{background:#ffffff14;border:1px solid #ffffff2a;border-radius:12px;padding:12px 14px;display:grid;gap:2px}.locbox small{font:700 10px 'JetBrains Mono',monospace;letter-spacing:1.5px;color:#8df5c0}.locbox b{font-size:15px}.locbox span{font-size:12px;color:#c4dccd}.srcline{margin:16px 0 0;font-size:12px;line-height:1.55;color:#c4dccd}.srcline b{color:#fff}.wm-mark{position:fixed;inset:0;z-index:0;pointer-events:none;display:grid;place-items:center;overflow:hidden}.wm-mark span{font:800 clamp(70px,16vw,180px) Manrope,sans-serif;color:#1f6b3a;opacity:.055;transform:rotate(-28deg);white-space:nowrap;letter-spacing:-4px}.wm-mark img{position:absolute;width:38vw;max-width:360px;opacity:.04;transform:rotate(-28deg)}.wrap{position:relative;z-index:1}.pagefoot{display:none}@media print{.wm-mark{position:fixed}.pagefoot{display:block;position:fixed;bottom:0;left:0;right:0;text-align:center;font-size:10px;color:#6b7c70;border-top:1px solid #dfe7dd;padding-top:3px}.cover{-webkit-print-color-adjust:exact;print-color-adjust:exact}}@media(max-width:640px){.locbox{grid-template-columns:1fr}}.cart{width:100%;height:auto;display:block}.cart.edit{touch-action:none;outline:3px dashed #e0245e}.cart.edit .cel{cursor:move}.cart.edit .cel .hit{stroke:#e0245e;stroke-dasharray:4 3;fill:#e0245e14}.hint{display:block;color:#5f6f60;font-size:12px;margin-top:4px}.hint button{margin-left:8px;font:inherit;font-size:12px;cursor:pointer}@media print{.noprint{display:none}.cart.edit{outline:0}}@page{size:A4;margin:14mm}*{box-sizing:border-box}body{margin:0;background:#eef3ea;color:#10231b;font:16px/1.65 'DM Sans','Noto Sans Devanagari','Noto Sans Telugu','Nirmala UI',Arial,sans-serif}.wrap{max-width:980px;margin:0 auto;background:#fff;box-shadow:0 10px 60px #0002}h1,h2,h3,h4{font-family:Manrope,'Noto Sans Devanagari','Noto Sans Telugu','Nirmala UI','DM Sans',Arial,sans-serif;line-height:1.25}a{color:#1d6b46}.cover{background:radial-gradient(circle at 80% 0,#2c6b4a,#0d1d15 60%);color:#eaf6df;padding:56px 48px 40px}.eyebrow{font:700 12px 'JetBrains Mono',monospace;letter-spacing:2px;color:#b6f36a}.cover h1{font-size:46px;margin:12px 0 6px;letter-spacing:-1.5px}.sub{color:#bcd3c1;margin:0 0 26px}.meta{color:#9fb8a6;font-size:13px;margin:22px 0 0}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.kpi{background:#ffffff14;border:1px solid #ffffff26;border-radius:14px;padding:14px}.kpi small{display:block;font-size:11.5px;opacity:.75}.kpi b{display:block;font:800 28px Manrope,sans-serif;margin:2px 0}.kpi span{font-size:12px;opacity:.75}.small .kpi{background:#f2f7ee;border-color:#dce7d5;color:#10231b}.nav{padding:22px 48px;background:#f6faf2;border-bottom:1px solid #e1ead9}.nav ol{columns:2;margin:6px 0 0;padding-left:20px;font-size:14px}.nav h3{margin:0;font-size:15px}.sec{padding:30px 48px;border-bottom:1px solid #e8efe2;break-inside:auto}.sec h2{font-size:26px;margin:0 0 14px;display:flex;gap:12px;align-items:center}.sec h2 span{width:34px;height:34px;border-radius:50%;background:#183e30;color:#b6f36a;display:grid;place-items:center;font-size:16px}.sec h3{font-size:17px;margin:22px 0 6px}.plain{background:#eef7e4;border-left:5px solid #7fbf3a;border-radius:10px;padding:10px 16px;margin:0 0 18px}.plain b{font-size:12px;letter-spacing:1.2px;text-transform:uppercase;color:#4b7a1d}.plain p{margin:4px 0 0}figure{margin:20px 0;break-inside:avoid}figure svg{width:100%;height:auto;border-radius:12px;display:block;border:1px solid #cfdcc6}figcaption{font-size:13.5px;color:#4d5e50;margin-top:8px}.chart{width:100%;height:auto}.t{width:100%;border-collapse:collapse;font-size:14px;margin:8px 0}.t th,.t td{border:1px solid #dfe8d8;padding:8px 10px;text-align:left;vertical-align:top}.t th{background:#f0f6ea}.t small{display:block;color:#6b7b6c;font-size:12px}.idx td:nth-child(2){font-size:13px}.scroll{overflow-x:auto}.pill{display:inline-block;padding:2px 10px;border-radius:99px;font-size:12px;font-weight:700;background:#e6edf2;color:#34505f}.pill.good{background:#dff3d5;color:#2c6a17}.pill.ok{background:#fbeccb;color:#8a5b00}.pill.bad{background:#f9d9d3;color:#9a2c1c}code{background:#f0f4ea;padding:2px 7px;border-radius:6px;font-size:14px}.calc{background:#10231b;color:#d7f5b0;border-radius:10px;padding:12px 16px;font:14px/1.7 'JetBrains Mono',monospace}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px}.advice{border:1px solid #dbe6d3;border-radius:14px;padding:14px 18px;background:#fafdf7}.advice h4{margin:0 0 6px;display:flex;justify-content:space-between;gap:8px}.advice h4 span{font-size:12px;background:#dff3d5;border-radius:99px;padding:2px 10px}.advice.warn h4 span{background:#fbeccb}.advice.bad h4 span{background:#f9d9d3}.why{font-size:13px;color:#5a6e4d}.muted{color:#6b7b6c}.donut{display:flex;align-items:center;gap:24px}.donut svg{width:170px;flex:none}.donut ul{list-style:none;padding:0;margin:0}.donut li{display:flex;gap:8px;align-items:center;margin:5px 0}.donut i{width:14px;height:14px;border-radius:4px}.heat{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;max-width:420px}.heat div{border-radius:8px;padding:14px 8px;text-align:center;color:#10231b}.heat b,.heat span{display:block}.heat span{font-size:12px}.bars div{display:grid;grid-template-columns:34px 1fr 48px;align-items:center;gap:8px;margin:4px 0;font-size:13px}.bars i{height:12px;background:linear-gradient(90deg,#7fbf3a,#1a9850);border-radius:6px;display:block;min-width:2px}.refs li{margin:8px 0}.record{padding:30px 48px 40px;background:#f6faf2}.rec th{white-space:nowrap;width:1%}.rec td{word-break:break-word}@media(max-width:700px){.kpis{grid-template-columns:1fr 1fr}.grid2{grid-template-columns:1fr}.cover,.sec,.nav,.record{padding-left:20px;padding-right:20px}.nav ol{columns:1}}@media print{body{background:#fff}.wrap{box-shadow:none;max-width:none}.sec h2,.t tr,figure,.advice{break-inside:avoid}.cover{-webkit-print-color-adjust:exact;print-color-adjust:exact}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}`
  const html = `<!doctype html><html lang="${t.docLang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(farm.name)} · SEVA.GIS report ${rid}</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700&family=Manrope:wght@700;800&family=JetBrains+Mono:wght@700&family=Noto+Sans+Devanagari:wght@400;600;700;800&family=Noto+Sans+Telugu:wght@400;600;700;800&display=swap"><style>${css}</style></head><body data-rid="${rid}"><div class="wm-mark" aria-hidden="true"><img src="${logo}" alt=""/><span>SEVA.GIS</span></div><div class="pagefoot">SEVA.GIS · ${esc(farm.name)} · Report ${rid} · Sentinel-2, Open-Meteo, SoilGrids, Copernicus DEM, Esri</div><div class="wrap">${cover}<nav class="nav"><h3>${t.contents}</h3><ol>${t.toc.map(item => `<li>${item}</li>`).join('')}</ol></nav>${body}${record}</div><script type="application/json" id="seva-report-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script><script>${SCRIPT}</script></body></html>`
  return { html, data, id: rid, lang }
}
