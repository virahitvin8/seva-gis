/**
 * SEVA·GIS Friend & Field Translator (Plain Practical Ground Talk)
 * 
 * Explains every geospatial, spectral, hydrological, and SWAT parameter
 * in simple, face-to-face, warm, conversational language that any 16-year-old student,
 * young farmer, or beginner can immediately understand and act upon in the field.
 */

export type GroundTalk = {
  id: string
  plainTitle: string
  unit?: string
  friendConcept: string // Simple analogy explaining the science
  howToRead: string     // How to read the numbers
  interpret: (val: number | undefined) => {
    rating: 'Great' | 'Good' | 'Needs Attention' | 'Warning' | 'Info'
    summary: string
    groundAction: string
  }
}

export const GROUND_TALK: Record<string, GroundTalk> = {
  ndvi: {
    id: 'ndvi',
    plainTitle: 'Green Crop Vigor & Leaf Health',
    friendConcept: 'Think of NDVI as a digital health checkup for your crops using satellite eyes. Healthy, lush leaves absorb red sunlight for food and bounce back huge amounts of near-infrared light. The greener and denser the leaves, the higher the score!',
    howToRead: 'Scores range from 0.0 to 1.0. Above 0.6 means thriving, leafy crops. Around 0.3 to 0.5 is young or thin growth. Below 0.2 is bare dirt or struggling plants.',
    interpret: (v) => {
      if (v === undefined || isNaN(v)) return { rating: 'Info', summary: 'Awaiting satellite measurement.', groundAction: 'Check back after the next clear satellite pass.' }
      if (v >= 0.65) return {
        rating: 'Great',
        summary: `Your crop vigor is high (${v.toFixed(2)}). Plants are leafy, green, and actively growing!`,
        groundAction: 'Maintain scheduled irrigation and protect against pests. The crop canopy is in prime condition.'
      }
      if (v >= 0.45) return {
        rating: 'Good',
        summary: `Steady green cover (${v.toFixed(2)}). Crops are growing normally.`,
        groundAction: 'Inspect any lighter green patches to see if young rows are filling in or if extra water is needed.'
      }
      if (v >= 0.30) return {
        rating: 'Needs Attention',
        summary: `Thin or young crop cover (${v.toFixed(2)}). Visible gaps or slower growth.`,
        groundAction: 'Walk into that zone. Touch the soil 2 inches deep. If bone-dry, irrigate; if yellowing, check for nitrogen deficiency.'
      }
      return {
        rating: 'Warning',
        summary: `Low plant vigor (${v.toFixed(2)}). Mostly bare ground or severely stressed crop.`,
        groundAction: 'Urgent field inspection needed: check for delayed germination, weed competition, pest attacks, or dry hardpan.'
      }
    }
  },

  ndmi: {
    id: 'ndmi',
    plainTitle: 'Leaf Moisture & Plant Hydration',
    friendConcept: 'Unlike soil moisture which tells you what is in the dirt, NDMI looks straight inside the plant leaves! It measures how much water the crop is actually holding in its cellular tissues.',
    howToRead: 'Ranges from -0.4 to +0.6. Above +0.25 means the plants are well-hydrated and crisp. Below 0.0 means the crop is thirsty and starting to wilt.',
    interpret: (v) => {
      if (v === undefined || isNaN(v)) return { rating: 'Info', summary: 'Moisture reading pending.', groundAction: 'Confirm soil dampness manually.' }
      if (v >= 0.30) return {
        rating: 'Great',
        summary: `Canopy is fully hydrated (${v.toFixed(2)}). Leaves have plenty of internal water.`,
        groundAction: 'No immediate watering needed. Avoid over-irrigating to prevent root rot or fungal mildew.'
      }
      if (v >= 0.10) return {
        rating: 'Good',
        summary: `Adequate plant moisture (${v.toFixed(2)}). Normal daily transpiration.`,
        groundAction: 'Keep regular irrigation cycle; plan next watering before the soil surface bakes in the afternoon heat.'
      }
      if (v >= -0.05) return {
        rating: 'Needs Attention',
        summary: `Mild water stress detected (${v.toFixed(2)}). Leaves are losing moisture faster than roots absorb.`,
        groundAction: 'Run drip irrigation or furrow watering within 24 to 48 hours, especially if the crop is flowering or fruiting.'
      }
      return {
        rating: 'Warning',
        summary: `Severe crop dehydration (${v.toFixed(2)}). Canopy is under drought stress.`,
        groundAction: 'Immediate irrigation required! Inspect irrigation lines and emitters for blockages.'
      }
    }
  },

  ndwi: {
    id: 'ndwi',
    plainTitle: 'Surface Water & Ponding Alert',
    friendConcept: 'Spots open standing water, puddles, or soaked hollows on your land. Plants need water, but their roots also need oxygen to breathe—standing water suffocates roots in 48 hours!',
    howToRead: 'Values above 0.0 indicate standing water or severe pooling. Negative values mean dry to moist ground.',
    interpret: (v) => {
      if (v === undefined || isNaN(v)) return { rating: 'Info', summary: 'Surface water index pending.', groundAction: 'Check low spots after heavy rain.' }
      if (v > 0.15) return {
        rating: 'Warning',
        summary: `Standing surface water detected (${v.toFixed(2)})!`,
        groundAction: 'Dig or clear small drainage furrows immediately to drain pooled water away before roots suffocate.'
      }
      if (v > -0.05) return {
        rating: 'Needs Attention',
        summary: `Saturated or muddy ground (${v.toFixed(2)}). Close to pooling.`,
        groundAction: 'Pause irrigation; allow the top layer to breathe and aerate.'
      }
      return {
        rating: 'Great',
        summary: `Well-drained field surface (${v.toFixed(2)}). No waterlogging detected.`,
        groundAction: 'Drainage is healthy; roots have good access to both moisture and soil oxygen.'
      }
    }
  },

  evi: {
    id: 'evi',
    plainTitle: 'Dense Canopy Vigor (Enhanced Vegetation)',
    friendConcept: 'In very lush fields (like sugarcane or peak wheat), NDVI can get "saturated" and plateau at 0.85. EVI cuts through thick leaves and haze to show you true biomass differences even in super dense fields.',
    howToRead: 'Ranges from 0.0 to 0.8. Above 0.5 means a dense, heavy canopy.',
    interpret: (v) => {
      if (v === undefined || isNaN(v)) return { rating: 'Info', summary: 'EVI pending.', groundAction: 'Compare with standard NDVI.' }
      if (v >= 0.50) return { rating: 'Great', summary: `Very dense, thick canopy (${v.toFixed(2)}).`, groundAction: 'Ensure good airflow between dense rows to prevent fungal blight.' }
      if (v >= 0.30) return { rating: 'Good', summary: `Moderate canopy growth (${v.toFixed(2)}).`, groundAction: 'Healthy canopy development on track.' }
      return { rating: 'Needs Attention', summary: `Lighter canopy cover (${v.toFixed(2)}).`, groundAction: 'Check row spacing and plant population per acre.' }
    }
  },

  savi: {
    id: 'savi',
    plainTitle: 'Soil-Corrected Early Growth (SAVI)',
    friendConcept: 'When plants are tiny, brown dirt bounces light between rows and tricks standard sensors. SAVI includes a soil-brightness correction factor so you see only the real seedling emergence.',
    howToRead: 'Ranges from 0.0 to 0.8. Crucial during the first 30 days after sowing.',
    interpret: (v) => {
      if (v === undefined || isNaN(v)) return { rating: 'Info', summary: 'SAVI pending.', groundAction: 'Monitor seedling emergence.' }
      if (v >= 0.40) return { rating: 'Great', summary: `Strong young crop emergence (${v.toFixed(2)}).`, groundAction: 'Early stand establishment is a success!' }
      if (v >= 0.20) return { rating: 'Good', summary: `Seedlings are taking hold (${v.toFixed(2)}).`, groundAction: 'Keep soil moist for delicate rootlets.' }
      return { rating: 'Needs Attention', summary: `Low emergence signal (${v.toFixed(2)}).`, groundAction: 'Check for poor seed germination, crusting soil, or bird/insect damage.' }
    }
  },

  ndre: {
    id: 'ndre',
    plainTitle: 'Chlorophyll & Nitrogen Food Gauge',
    friendConcept: 'Chlorophyll is the green solar engine inside plant leaves, powered by nitrogen. NDRE uses the "Red-Edge" band that penetrates deep into middle leaves instead of just seeing the top surface.',
    howToRead: 'Ranges from 0.0 to 0.6. Above 0.35 means strong chlorophyll. Below 0.20 signals nitrogen hunger.',
    interpret: (v) => {
      if (v === undefined || isNaN(v)) return { rating: 'Info', summary: 'Red-edge reading pending.', groundAction: 'Watch for yellowing lower leaves.' }
      if (v >= 0.35) return { rating: 'Great', summary: `Strong chlorophyll content (${v.toFixed(2)}). Plentiful nitrogen.`, groundAction: 'Nutrient levels are optimum; avoid over-applying nitrogen.' }
      if (v >= 0.22) return { rating: 'Good', summary: `Normal leaf chlorophyll (${v.toFixed(2)}).`, groundAction: 'Maintain balanced micronutrients (zinc, iron, boron).' }
      return { rating: 'Needs Attention', summary: `Chlorophyll dip detected (${v.toFixed(2)}). Crop may be running low on nitrogen.`, groundAction: 'Apply targeted foliar spray or top-dress nitrogen (Urea/DAP) before leaves turn pale yellow.' }
    }
  },

  bsi: {
    id: 'bsi',
    plainTitle: 'Exposed Dirt & Topsoil Erosion Risk',
    friendConcept: 'Measures how much bare, uncovered soil is exposed to direct blazing sun and wind. Naked soil dries out 3 times faster and loses valuable organic humus to rainwater runoff.',
    howToRead: 'Ranges from -0.4 to +0.4. Negative values mean protected soil; positive values mean bare dirt.',
    interpret: (v) => {
      if (v === undefined || isNaN(v)) return { rating: 'Info', summary: 'Soil index pending.', groundAction: 'Check soil surface cover.' }
      if (v <= -0.10) return { rating: 'Great', summary: `Soil is well protected by crop canopy (${v.toFixed(2)}).`, groundAction: 'Minimal evaporation from dirt; moisture is conserved.' }
      if (v <= 0.10) return { rating: 'Good', summary: `Partial soil exposure (${v.toFixed(2)}). Normal for row crops.`, groundAction: 'Consider mulching between wide rows if irrigation water is scarce.' }
      return { rating: 'Needs Attention', summary: `High bare soil exposure (${v.toFixed(2)}).`, groundAction: 'Protect bare soil with straw mulch or cover crops to prevent crusting and erosion.' }
    }
  },

  dem: {
    id: 'dem',
    plainTitle: 'Field Elevation Above Sea Level',
    unit: 'm',
    friendConcept: 'Shows the height of your land from the Copernicus GLO-30 satellite. Water always flows downhill from high points to low points.',
    howToRead: 'Given in meters above mean sea level. Differences across your plot show natural slope and runoff pathways.',
    interpret: (v) => {
      if (v === undefined || isNaN(v)) return { rating: 'Info', summary: 'Elevation pending.', groundAction: 'Review topographic contours.' }
      return {
        rating: 'Info',
        summary: `Average field elevation is ${v.toFixed(1)} meters above sea level.`,
        groundAction: 'Water moves from the highest corners toward the lowest corners. Place borewells and ponds where water naturally gathers.'
      }
    }
  },

  slope: {
    id: 'slope',
    plainTitle: 'Ground Incline & Water Runoff Gradient',
    unit: '°',
    friendConcept: 'Measures how steep your land tilts. Flat land holds water; steep land speeds up runoff and washes away valuable fertilizer and topsoil.',
    howToRead: '0° to 2° is flat/gentle. 3° to 8° is moderate slope. Above 8° is steep.',
    interpret: (v) => {
      if (v === undefined || isNaN(v)) return { rating: 'Info', summary: 'Slope pending.', groundAction: 'Inspect terrain tilt on foot.' }
      if (v <= 2) return { rating: 'Great', summary: `Gentle, flat terrain (${v.toFixed(1)}°). Ideal for even irrigation.`, groundAction: 'Water distributes uniformly; watch low corners for slow drainage.' }
      if (v <= 5) return { rating: 'Good', summary: `Moderate slope (${v.toFixed(1)}°). Gentle runoff.`, groundAction: 'Plow across the slope (contour plowing), never straight up and down, to slow runoff.' }
      return { rating: 'Needs Attention', summary: `Steep slope (${v.toFixed(1)}°). Rapid rainwater runoff.`, groundAction: 'Build bunds or check dams along the contour to stop topsoil from washing away.' }
    }
  },

  cn2: {
    id: 'cn2',
    plainTitle: 'Soil Sponge Rating (SCS Curve Number)',
    friendConcept: 'Think of CN2 as how much of a sponge your soil is! A low curve number (like 65) means the soil is soft and porous like a bath sponge, drinking in rain. A high number (85+) means hard, compacted ground where rain washes away like concrete.',
    howToRead: 'Calibrated scale from 30 to 98. Lower is more absorbent; higher is more runoff.',
    interpret: (v) => {
      if (v === undefined || isNaN(v)) return { rating: 'Info', summary: 'Hydrologic CN2 calibrated value.', groundAction: 'Improve soil organic matter.' }
      if (v <= 70) return { rating: 'Great', summary: `High soil absorption (CN2 = ${v.toFixed(0)}). Rain infiltrates deeply.`, groundAction: 'Soil health is strong. Keep adding compost and farmyard manure.' }
      if (v <= 78) return { rating: 'Good', summary: `Moderate soil sponge (CN2 = ${v.toFixed(0)}). Good balance of infiltration and runoff.`, groundAction: 'Maintain current tillage practices; avoid over-tamping with heavy tractors.' }
      return { rating: 'Needs Attention', summary: `Compacted soil surface (CN2 = ${v.toFixed(0)}). High runoff risk.`, groundAction: 'Aerate soil with subsoiler or deep chisel plowing. Add organic compost to open up soil pores.' }
    }
  },

  surq: {
    id: 'surq',
    plainTitle: 'Surface Rain Runoff (SURQ)',
    unit: 'mm',
    friendConcept: 'The amount of rainwater that flows away over the soil surface instead of sinking in to feed your crop roots. It carries away loose soil and costly fertilizer.',
    howToRead: 'Measured in millimeters per season or year. Usually 25% to 35% of total annual rain.',
    interpret: (v) => {
      if (v === undefined || isNaN(v)) return { rating: 'Info', summary: 'Runoff estimate.', groundAction: 'Capture runoff with bunds.' }
      return {
        rating: 'Info',
        summary: `Annual surface runoff is ~${v.toFixed(1)} mm (~30% of total rainfall).`,
        groundAction: 'Harvest this runoff water! Build perimeter farm ponds or recharge pits near lowest boundary corners.'
      }
    }
  },

  et: {
    id: 'et',
    plainTitle: 'Crop Water Consumption (Evapotranspiration)',
    unit: 'mm',
    friendConcept: 'The total water your crop "drinks and sweats" out into the air plus what evaporates from the wet soil. It is literally the crop\'s daily drinking straw!',
    howToRead: 'Measured in mm. A healthy summer crop consumes 4 to 7 mm of water per day.',
    interpret: (v) => {
      if (v === undefined || isNaN(v)) return { rating: 'Info', summary: 'ET0 water demand.', groundAction: 'Match irrigation to daily ET.' }
      return {
        rating: 'Info',
        summary: `Crop water demand is ${v.toFixed(1)} mm.`,
        groundAction: 'Apply enough irrigation water to replace this consumed volume, ideally in cool early mornings to cut evaporation.'
      }
    }
  },

  gwq: {
    id: 'gwq',
    plainTitle: 'Aquifer & Borewell Recharge Flow (Baseflow)',
    unit: 'mm',
    friendConcept: 'Water that filters through deep soil layers past the root zone and recharges the groundwater aquifers that supply your village borewells and streams.',
    howToRead: 'Higher recharge means longer-lasting borewells and steady water tables in dry months.',
    interpret: (v) => {
      if (v === undefined || isNaN(v)) return { rating: 'Info', summary: 'Baseflow recharge rate.', groundAction: 'Maintain groundwater levels.' }
      return {
        rating: 'Good',
        summary: `Groundwater recharge rate is ~${v.toFixed(1)} mm annually.`,
        groundAction: 'Keep recharge trenches clean to maximize groundwater infiltration during monsoon downpours.'
      }
    }
  },

  fc: {
    id: 'fc',
    plainTitle: 'Field Capacity (Full Sponge Moisture)',
    unit: '%',
    friendConcept: 'Imagine soaking a kitchen sponge in a bucket and letting all the loose water drip out for 24 hours. The water left clinging to the sponge is its "Field Capacity"—the maximum water your soil can hold before excess drains away into deep rock.',
    howToRead: 'Sandy soil holds 10% to 18%. Loam holds 22% to 30%. Clay soils hold 30% to 42%.',
    interpret: (v) => {
      if (v === undefined || isNaN(v)) return { rating: 'Info', summary: 'Field capacity pending.', groundAction: 'Test soil feel after rain.' }
      const pct = v > 1 ? v : v * 100
      return {
        rating: 'Info',
        summary: `Your soil holds up to ${pct.toFixed(0)}% moisture when fully watered.`,
        groundAction: 'Watering beyond this level is wasted run-off; irrigate just enough to bring the root layer up to this capacity.'
      }
    }
  },

  pwp: {
    id: 'pwp',
    plainTitle: 'Permanent Wilting Point (Extreme Drought Floor)',
    unit: '%',
    friendConcept: 'The danger mark! When soil moisture drops down to this level, the soil particles grip the remaining water droplets so tightly that crop roots cannot suck them out even with maximum suction. Plants will permanently wilt and dry out.',
    howToRead: 'Sandy soil: 4% to 8%. Loam: 10% to 15%. Heavy clay: 15% to 22%.',
    interpret: (v) => {
      if (v === undefined || isNaN(v)) return { rating: 'Info', summary: 'Wilting point pending.', groundAction: 'Irrigate well before reaching this floor.' }
      const pct = v > 1 ? v : v * 100
      return {
        rating: 'Warning',
        summary: `Soil locks up water completely below ${pct.toFixed(0)}% moisture.`,
        groundAction: 'Never let soil moisture dip near this line! Start irrigation when soil moisture is halfway between Wilting Point and Field Capacity.'
      }
    }
  },

  awc: {
    id: 'awc',
    plainTitle: 'Plant-Available Water Tank (AWC)',
    unit: 'mm/m',
    friendConcept: 'This is the actual "usable fuel tank" in your soil. It is the sweet spot between full drainage (Field Capacity) and dry wilting (Wilting Point). The bigger this tank, the longer your crops can survive between waterings!',
    howToRead: 'Above 150 mm/m is a large, generous water tank (deep clay/loam). Under 80 mm/m is a tiny tank (sandy ground) needing frequent light watering.',
    interpret: (v) => {
      if (v === undefined || isNaN(v)) return { rating: 'Info', summary: 'Available water storage pending.', groundAction: 'Add organic matter to increase water storage.' }
      if (v >= 140) return { rating: 'Great', summary: `Excellent water reservoir (${v.toFixed(0)} mm/m). Soil holds water for days.`, groundAction: 'Soil can buffer dry spells nicely. Deep, infrequent irrigation works best.' }
      if (v >= 90) return { rating: 'Good', summary: `Moderate water reservoir (${v.toFixed(0)} mm/m).`, groundAction: 'Standard irrigation intervals are well supported.' }
      return { rating: 'Needs Attention', summary: `Small water reservoir (${v.toFixed(0)} mm/m). Sandy or shallow soil.`, groundAction: 'Water more frequently with smaller doses (drip irrigation is ideal) and mulch heavily to cut loss.' }
    }
  },

  ks: {
    id: 'ks',
    plainTitle: 'Water Entry Speed (Soil Infiltration Rate)',
    unit: 'mm/h',
    friendConcept: 'How fast rainwater or pump water can soak down through the soil surface without making muddy puddles or washing off your field.',
    howToRead: 'Above 30 mm/h is fast (sand/gravel). 10 to 25 mm/h is medium (loam). Under 5 mm/h is very slow (heavy black cotton clay or compacted hardpan).',
    interpret: (v) => {
      if (v === undefined || isNaN(v)) return { rating: 'Info', summary: 'Infiltration rate pending.', groundAction: 'Observe puddle soak times after rain.' }
      if (v > 50) return { rating: 'Needs Attention', summary: `Fast drainage (${v.toFixed(1)} mm/h). Water sinks very quickly.`, groundAction: 'Fertilizer washes into deep soil easily. Apply fertilizers in small, split doses.' }
      if (v >= 10) return { rating: 'Great', summary: `Ideal infiltration speed (${v.toFixed(1)} mm/h). Water enters smoothly.`, groundAction: 'Well-aerated soil structure. Maintains great root respiration.' }
      return { rating: 'Needs Attention', summary: `Slow water entry (${v.toFixed(1)} mm/h). Risk of puddles and runoff.`, groundAction: 'Avoid heavy flood irrigation. Use drip or light sprinklers to allow water time to soak in.' }
    }
  },

  ph: {
    id: 'ph',
    plainTitle: 'Soil Acidity & Sweetness (Soil pH)',
    unit: 'pH',
    friendConcept: 'Soil pH is like the digestive balance of your field. If soil is too sour (acidic, under 6.0) or too alkaline/salty (sweet, over 8.0), nutrients get "chemically locked" and plant roots cannot eat them even if fertilizer is lying right there!',
    howToRead: 'Scale 0 to 14. Sweet spot for 90% of crops is 6.2 to 7.5.',
    interpret: (v) => {
      if (v === undefined || isNaN(v)) return { rating: 'Info', summary: 'pH reading pending.', groundAction: 'Get an official laboratory soil test.' }
      if (v >= 6.5 && v <= 7.8) return { rating: 'Great', summary: `Optimal neutral soil pH (${v.toFixed(1)}). Maximum nutrient availability!`, groundAction: 'Nitrogen, phosphorus, and potassium are completely accessible to roots.' }
      if (v < 6.0) return { rating: 'Needs Attention', summary: `Acidic soil (${v.toFixed(1)}). Micronutrients and phosphorus may lock up.`, groundAction: 'Apply agricultural lime (calcium carbonate) or dolomite to sweeten acidic soil.' }
      return { rating: 'Needs Attention', summary: `Alkaline soil (${v.toFixed(1)}). Iron and zinc may be locked away.`, groundAction: 'Add gypsum (calcium sulphate) and plentiful green manure or compost to balance alkaline soil.' }
    }
  },

  twi: {
    id: 'twi',
    plainTitle: 'Natural Water Collection Hollows (TWI)',
    friendConcept: 'Topographic Wetness Index locates the dips, hollows, and bowls where rainwater naturally congregates during monsoon storms. It pinpoints the lowest spots without you having to survey in the rain.',
    howToRead: 'High values (over 10) mean wet hollows or stream channels. Low values mean dry ridges.',
    interpret: (v) => {
      if (v === undefined || isNaN(v)) return { rating: 'Info', summary: 'Wetness index pending.', groundAction: 'Check low spots after storms.' }
      if (v >= 12) return { rating: 'Warning', summary: `Strong water-pooling hollow (${v.toFixed(1)}).`, groundAction: 'Clear field drainage trenches here so standing water can safely exit.' }
      return { rating: 'Great', summary: `Good natural runoff gradient (${v.toFixed(1)}).`, groundAction: 'Minimal waterlogging hazard.' }
    }
  },

  zones: {
    id: 'zones',
    plainTitle: 'Field Uniformity & Smart VRA Zones',
    friendConcept: 'No field is 100% the same from corner to corner. Satellite clustering divides your field into 3 or 4 uniform "vigor zones". Instead of spraying the exact same fertilizer everywhere, you give extra food to hungry patches and save money on strong patches!',
    howToRead: 'Zone 1 (Vigorous), Zone 2 (Normal), Zone 3 (Low vigor or thin soil).',
    interpret: (v) => ({
      rating: 'Info',
      summary: 'Management zones group pixels with identical growth characteristics.',
      groundAction: 'Use these zones for variable-rate fertilization (VRA) to save 15-25% on input costs.'
    })
  }
}

/**
 * Common Land Unit Conversions & Friendly Explanations
 */
export const LAND_UNIT_FRIEND_TALK = [
  {
    name: 'Hectare (ha)',
    size: '10,000 m² (100m × 100m)',
    plainAnalogy: 'Roughly the size of 2 international football/soccer fields side-by-side, or about 2.47 acres.',
    popularIn: 'Global scientific standard & government GIS maps worldwide'
  },
  {
    name: 'Acre (ac)',
    size: '4,046.86 m²',
    plainAnalogy: 'Historically, the amount of land one farmer could plow in a single day with a pair of oxen. Equals 43,560 sq ft.',
    popularIn: 'India, USA, UK, Canada, Australia'
  },
  {
    name: 'Bigha (UP / North India)',
    size: '~2,529 m² (Pukka Bigha) / 20 Biswa',
    plainAnalogy: 'Standard northern village holding unit. 1 Acre is roughly 1.6 to 1.62 Pukka Bigha in Uttar Pradesh.',
    popularIn: 'Uttar Pradesh, Bihar, Haryana, Punjab, Rajasthan'
  },
  {
    name: 'Guntha / Gunta',
    size: '101.17 m² (1/40th of an Acre)',
    plainAnalogy: 'Roughly 1,089 sq ft (a typical 33 ft × 33 ft square). Exactly 40 Gunthas make 1 full Acre.',
    popularIn: 'Maharashtra, Karnataka, Telangana, Gujarat'
  },
  {
    name: 'Cent',
    size: '40.47 m² (1/100th of an Acre)',
    plainAnalogy: 'Exactly 435.6 sq ft. 100 Cents make 1 full Acre.',
    popularIn: 'Kerala, Tamil Nadu, Andhra Pradesh'
  },
  {
    name: 'DIGIPIN (India Post / IIT-H)',
    size: '4m × 4m geodetic digital cell',
    plainAnalogy: 'A 10-character alphanumeric digital doorstep code. It names this exact patch of soil without needing house numbers or road names!',
    popularIn: 'Official National Postal Geocoding System of India'
  }
]

/**
 * Helper to fetch Ground Talk for any indicator or parameter ID
 */
export function getGroundTalk(id: string): GroundTalk {
  const norm = id.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (norm in GROUND_TALK) return GROUND_TALK[norm]
  if (norm.includes('ndvi')) return GROUND_TALK.ndvi
  if (norm.includes('ndmi') || norm.includes('moist')) return GROUND_TALK.ndmi
  if (norm.includes('water') || norm.includes('ndwi')) return GROUND_TALK.ndwi
  if (norm.includes('evi')) return GROUND_TALK.evi
  if (norm.includes('savi')) return GROUND_TALK.savi
  if (norm.includes('chlor') || norm.includes('ndre')) return GROUND_TALK.ndre
  if (norm.includes('elev') || norm.includes('dem')) return GROUND_TALK.dem
  if (norm.includes('slope')) return GROUND_TALK.slope
  if (norm.includes('curve') || norm.includes('cn')) return GROUND_TALK.cn2
  if (norm.includes('et') || norm.includes('evap')) return GROUND_TALK.et
  if (norm.includes('run') || norm.includes('surq')) return GROUND_TALK.surq
  if (norm.includes('soil') || norm.includes('bsi')) return GROUND_TALK.bsi
  if (norm.includes('cap') || norm.includes('fc')) return GROUND_TALK.fc
  if (norm.includes('wilt') || norm.includes('pwp')) return GROUND_TALK.pwp
  if (norm.includes('awc') || norm.includes('avail')) return GROUND_TALK.awc
  if (norm.includes('ks') || norm.includes('infil')) return GROUND_TALK.ks
  if (norm.includes('ph')) return GROUND_TALK.ph
  if (norm.includes('twi') || norm.includes('wet')) return GROUND_TALK.twi
  if (norm.includes('zone')) return GROUND_TALK.zones

  // Fallback friendly descriptor
  return {
    id,
    plainTitle: id.toUpperCase(),
    friendConcept: 'A specialized remote sensing and field indicator calculated from multispectral satellite imagery.',
    howToRead: 'Compare values across different zones of your field to locate strong and weak spots.',
    interpret: (v) => ({
      rating: 'Info',
      summary: `Current measured value: ${v !== undefined ? v.toFixed(2) : 'Awaiting data'}.`,
      groundAction: 'Walk the field to verify ground conditions.'
    })
  }
}

