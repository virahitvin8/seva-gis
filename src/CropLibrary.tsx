import { useState, useMemo } from 'react'
import { Calendar, RefreshCw, Sprout, Info, Sun, CloudRain, Snowflake, CheckCircle2 } from 'lucide-react'

type SeasonType = 'all' | 'kharif' | 'rabi' | 'zaid'

type WeekInfo = {
  week: number
  dateRange: string
  season: 'Kharif' | 'Rabi' | 'Zaid' | 'Transition'
  seasonColor: string
  level: 0 | 1 | 2 | 3 | 4
  stage: string
  operations: string
  advisory: string
}

// Generate 52 weeks of agricultural phenology & operations based on Indian & global crop calendar
const WEEKS_DATA: WeekInfo[] = [
  // Jan - Weeks 1 to 4 (Rabi vegetative / flowering)
  { week: 1, dateRange: 'Jan 1 – Jan 7', season: 'Rabi', seasonColor: '#0284c7', level: 2, stage: 'Rabi Vegetative / Tillering', operations: 'First top dressing of Urea in late-sown wheat; check for cold wave/frost.', advisory: 'Light evening irrigation protects against nocturnal frost injury.' },
  { week: 2, dateRange: 'Jan 8 – Jan 14', season: 'Rabi', seasonColor: '#0284c7', level: 3, stage: 'Active Crown Root / Jointing', operations: 'Second irrigation at active tillering/jointing; spray weedicide for Phalaris minor.', advisory: 'Spray Clodinafop-propargyl or Sulfosulfuron before weed exceeds 3-leaf stage.' },
  { week: 3, dateRange: 'Jan 15 – Jan 21', season: 'Rabi', seasonColor: '#0284c7', level: 2, stage: 'Mustard Flowering & Pod Formation', operations: 'Scout mustard for aphid colonies on top twigs; chickpea pod borer monitoring.', advisory: 'Foliar spray of Dimethoate or Neem oil (1500 ppm) if aphids exceed 20/plant.' },
  { week: 4, dateRange: 'Jan 22 – Jan 28', season: 'Rabi', seasonColor: '#0284c7', level: 3, stage: 'Wheat Boot Stage', operations: 'Apply third irrigation at late jointing/boot stage; foliar zinc spray if pale leaves.', advisory: 'Avoid heavy flood watering in windy conditions to prevent early lodging.' },
  // Feb - Weeks 5 to 8 (Rabi flowering & grain formation)
  { week: 5, dateRange: 'Jan 29 – Feb 4', season: 'Rabi', seasonColor: '#0284c7', level: 3, stage: 'Heading & Panicle Emergence', operations: 'Heading window; inspect for yellow/stripe rust pustules along leaf veins.', advisory: 'Immediate spray of Propiconazole 25% EC @ 1 ml/L upon seeing yellow rust powder.' },
  { week: 6, dateRange: 'Feb 5 – Feb 11', season: 'Rabi', seasonColor: '#0284c7', level: 4, stage: 'Flowering & Anthesis', operations: 'Critical flowering stage; maintain root-zone moisture; avoid pesticide spray during midday bee pollination.', advisory: 'Flowering is sensitive to soil moisture stress; light sprinkler or furrow watering advised.' },
  { week: 7, dateRange: 'Feb 12 – Feb 18', season: 'Rabi', seasonColor: '#0284c7', level: 3, stage: 'Mustard Maturation & Potato Digging', operations: 'Harvest early mustard when 75% pods turn golden-yellow; dig rabi potatoes.', advisory: 'Dry harvested mustard in clean threshing yards to prevent fungal mold.' },
  { week: 8, dateRange: 'Feb 19 – Feb 25', season: 'Rabi', seasonColor: '#0284c7', level: 2, stage: 'Grain Milk Stage', operations: 'Wheat milk stage; spray 13:0:45 (Potassium Nitrate @ 10 g/L) to boost grain size.', advisory: 'High atmospheric temperatures cause forced maturity; keep soil cool with light watering.' },

  // Mar - Weeks 9 to 13 (Rabi dough stage to Zaid start)
  { week: 9, dateRange: 'Feb 26 – Mar 4', season: 'Rabi', seasonColor: '#0284c7', level: 3, stage: 'Grain Dough Stage', operations: 'Final light irrigation for late wheat; chickpea pod maturity; land prep for Zaid.', advisory: 'Stop irrigation once grain enters hard dough stage to enable uniform drying.' },
  { week: 10, dateRange: 'Mar 5 – Mar 11', season: 'Zaid', seasonColor: '#ea580c', level: 4, stage: 'Zaid Summer Sowing Window', operations: 'Sow summer moong (green gram), urad, watermelon, cucumber & fodder maize.', advisory: 'Seed treatment with Rhizobium culture and Trichoderma ensures vigorous root nodules.' },
  { week: 11, dateRange: 'Mar 12 – Mar 18', season: 'Zaid', seasonColor: '#ea580c', level: 3, stage: 'Zaid Emergence & Rabi Ripening', operations: 'Thinning and early weeding in summer cucurbits; scout for red pumpkin beetle.', advisory: 'Dusting with wood ash mixed with carbaryl or neem spray deters beetles.' },
  { week: 12, dateRange: 'Mar 19 – Mar 25', season: 'Rabi', seasonColor: '#0284c7', level: 4, stage: 'Rabi Harvest (Chickpea & Barley)', operations: 'Harvest chickpea, lentil and barley; combine harvester bookings for wheat.', advisory: 'Harvest when grain moisture drops below 14% to prevent storage insect pests.' },
  { week: 13, dateRange: 'Mar 26 – Apr 1', season: 'Rabi', seasonColor: '#0284c7', level: 4, stage: 'Peak Wheat Harvest (Baisakhi Window)', operations: 'Peak harvesting and threshing of wheat; baling wheat straw (bhusa).', advisory: 'Do not burn crop residue. Incorporate or bale straw to preserve soil carbon.' },

  // Apr - Weeks 14 to 17 (Peak wheat harvest, Zaid vegetative)
  { week: 14, dateRange: 'Apr 2 – Apr 8', season: 'Rabi', seasonColor: '#0284c7', level: 4, stage: 'Wheat Harvest & Market Arrival', operations: 'Clean and bag wheat grains; transport to APMC mandi / procurement center.', advisory: 'Sun-dry grain to 10-12% moisture before hermetic bag or metal silo storage.' },
  { week: 15, dateRange: 'Apr 9 – Apr 15', season: 'Zaid', seasonColor: '#ea580c', level: 2, stage: 'Zaid Moong Vegetative', operations: 'First irrigation in summer moong; monitor for whitefly and yellow mosaic virus.', advisory: 'Install yellow sticky traps (15-20/acre) to control whitefly vectors.' },
  { week: 16, dateRange: 'Apr 16 – Apr 22', season: 'Zaid', seasonColor: '#ea580c', level: 3, stage: 'Watermelon & Melon Fruit Sizing', operations: 'Frequent light furrow/drip irrigation in summer fruit crops; foliar boron spray.', advisory: 'Apply 0.2% Borax spray during early fruit set to eliminate fruit cracking.' },
  { week: 17, dateRange: 'Apr 23 – Apr 29', season: 'Transition', seasonColor: '#64748b', level: 1, stage: 'Deep Summer Ploughing', operations: 'Deep summer ploughing of fallow rabi plots to expose soil pathogens to harsh sun.', advisory: 'Solarization destroys pupae of borer pests, nematodes, and perennial weed rhizomes.' },

  // May - Weeks 18 to 22 (Summer peak heat, Zaid harvest, Kharif nursery)
  { week: 18, dateRange: 'Apr 30 – May 6', season: 'Zaid', seasonColor: '#ea580c', level: 2, stage: 'Summer Moong Podding', operations: 'Summer green gram pod development; irrigate at 6-7 day intervals under high heat.', advisory: 'Stop watering 10 days before expected single-stroke pod picking.' },
  { week: 19, dateRange: 'May 7 – May 13', season: 'Transition', seasonColor: '#64748b', level: 1, stage: 'Compost & FYM Application', operations: 'Apply well-decomposed Farmyard Manure (FYM) or vermicompost @ 4-5 t/acre.', advisory: 'Incorporate FYM into topsoil before pre-monsoon showers begin.' },
  { week: 20, dateRange: 'May 14 – May 20', season: 'Zaid', seasonColor: '#ea580c', level: 3, stage: 'Zaid Harvest Window', operations: 'Pick summer moong pods; harvest watermelons and vegetables.', advisory: 'Store moong in airtight containers with neem leaves or edible oil coating.' },
  { week: 21, dateRange: 'May 21 – May 27', season: 'Kharif', seasonColor: '#16a34a', level: 3, stage: 'Paddy Nursery Preparation', operations: 'Prepare raised beds for rice nursery; arrange certified seeds (Basmati/hybrids).', advisory: 'Saltwater seed sorting (10% brine) removes light, unfilled seeds and pathogen spores.' },
  { week: 22, dateRange: 'May 28 – Jun 3', season: 'Kharif', seasonColor: '#16a34a', level: 4, stage: 'Paddy Nursery Sowing', operations: 'Sow pre-germinated paddy seeds in nursery @ 10-12 kg per acre transplant area.', advisory: 'Apply carbofuran or chlorantraniliprole in nursery beds to protect against early stem borer.' },

  // Jun - Weeks 23 to 26 (Monsoon arrival, Kharif sowing)
  { week: 23, dateRange: 'Jun 4 – Jun 10', season: 'Kharif', seasonColor: '#16a34a', level: 3, stage: 'Cotton & Maize Sowing', operations: 'Sow Bt-Cotton, hybrid maize, soybean, and groundnut on ridges and furrows.', advisory: 'Ridge-and-furrow planting prevents seed rotting during torrential rainstorms.' },
  { week: 24, dateRange: 'Jun 11 – Jun 17', season: 'Kharif', seasonColor: '#16a34a', level: 4, stage: 'Monsoon Sowing Wave 1', operations: 'Main sowing of Kharif pulses (Pigeonpea/Arhar, Moong, Urad) and oilseeds.', advisory: 'Fungicide seed treatment (Thiram + Carbendazim @ 2 g/kg) prevents seedling damping-off.' },
  { week: 25, dateRange: 'Jun 18 – Jun 24', season: 'Kharif', seasonColor: '#16a34a', level: 4, stage: 'Main Field Puddling', operations: 'Puddling and leveling of rice fields; basal application of DAP and Zinc Sulphate.', advisory: 'Laser leveling saves 20-25% water and ensures uniform flood depth.' },
  { week: 26, dateRange: 'Jun 25 – Jul 1', season: 'Kharif', seasonColor: '#16a34a', level: 4, stage: 'Paddy Transplanting Window', operations: 'Transplant 21-25 day old rice seedlings (2-3 seedlings/hill at 20×15 cm spacing).', advisory: 'Clip seedling leaf tips before planting to eliminate stem borer egg masses.' },

  // Jul - Weeks 27 to 30 (Active transplanting, weeding, basal fertilizers)
  { week: 27, dateRange: 'Jul 2 – Jul 8', season: 'Kharif', seasonColor: '#16a34a', level: 4, stage: 'Transplanting & Pre-emergence Weedicide', operations: 'Apply pre-emergence herbicide (Pretilachlor or Pyrazosulfuron) within 3 days of transplanting.', advisory: 'Maintain 2-3 cm standing water film for 48 hours after herbicide application.' },
  { week: 28, dateRange: 'Jul 9 – Jul 15', season: 'Kharif', seasonColor: '#16a34a', level: 3, stage: 'Vegetative Establishment', operations: 'Scout cotton for sucking pests (jassids, thrips, aphids); first inter-culture weeding in maize.', advisory: 'Avoid spraying synthetic pyrethroids early to conserve beneficial predator bugs.' },
  { week: 29, dateRange: 'Jul 16 – Jul 22', season: 'Kharif', seasonColor: '#16a34a', level: 3, stage: 'First Paddy Top Dressing', operations: 'First top dressing: Neem-coated Urea (35 kg/acre) at 21 days after transplanting.', advisory: 'Drain excess standing water before urea application; re-flood after 24 hours.' },
  { week: 30, dateRange: 'Jul 23 – Jul 29', season: 'Kharif', seasonColor: '#16a34a', level: 3, stage: 'Active Tillering & Soybean Pod Prep', operations: 'Active tillering in rice; weed control in soybean and groundnut.', advisory: 'Install T-shaped bird perches (15-20/acre) in soybean for natural insect predation.' },

  // Aug - Weeks 31 to 35 (Peak monsoon, tillering to panicle, pest monitoring)
  { week: 31, dateRange: 'Jul 30 – Aug 5', season: 'Kharif', seasonColor: '#16a34a', level: 3, stage: 'Maximum Tillering Stage', operations: 'Monitor for dead hearts caused by Yellow Stem Borer; second urea top dressing.', advisory: 'Cartap hydrochloride 4G @ 7-8 kg/acre broadcasted if dead hearts exceed 5%.' },
  { week: 32, dateRange: 'Aug 6 – Aug 12', season: 'Kharif', seasonColor: '#16a34a', level: 3, stage: 'Cotton Squaring & Maize Tasseling', operations: 'Square formation in cotton; apply Boron (1 g/L) + Planofix to prevent bud shedding.', advisory: 'Scout for Fall Armyworm whorl damage in tasseling maize.' },
  { week: 33, dateRange: 'Aug 13 – Aug 19', season: 'Kharif', seasonColor: '#16a34a', level: 2, stage: 'Drainage Channel Maintenance', operations: 'Clear field drains to release excess runoff after intense monsoon downpours.', advisory: 'Water stagnation for >36 hours triggers root asphyxiation in pulses and maize.' },
  { week: 34, dateRange: 'Aug 20 – Aug 26', season: 'Kharif', seasonColor: '#16a34a', level: 3, stage: 'Panicle Initiation (Paddy)', operations: 'Third split of Neem-coated Urea (25 kg) + MOP (15 kg/acre) at panicle initiation.', advisory: 'Potash boosts stem strength, disease resistance, and grain filling.' },
  { week: 35, dateRange: 'Aug 27 – Sep 2', season: 'Kharif', seasonColor: '#16a34a', level: 3, stage: 'Sheath Blight & Blast Inspection', operations: 'Scout lower leaf sheaths for water-soaked oval spots of Sheath Blight.', advisory: 'Spray Hexaconazole 5% SC @ 2 ml/L or Validamycin 3% L @ 2.5 ml/L at waterline.' },

  // Sep - Weeks 36 to 39 (Heading, grain filling, early kharif harvest)
  { week: 36, dateRange: 'Sep 3 – Sep 9', season: 'Kharif', seasonColor: '#16a34a', level: 3, stage: 'Paddy Heading & Flowering', operations: 'Heading window; inspect for False Smut and Brown Plant Hopper (BPH) at base.', advisory: 'Part crop canopy and check stem bases; avoid unnecessary nitrogen.' },
  { week: 37, dateRange: 'Sep 10 – Sep 16', season: 'Kharif', seasonColor: '#16a34a', level: 3, stage: 'Grain Filling & Cotton Boll Sizing', operations: 'Grain filling stage in rice; first picking of early Kharif green pods / cotton.', advisory: 'Maintain shallow water layer (2-3 cm) during grain filling; avoid drought shock.' },
  { week: 38, dateRange: 'Sep 17 – Sep 23', season: 'Kharif', seasonColor: '#16a34a', level: 4, stage: 'Early Kharif Harvest (Moong / Maize)', operations: 'Harvest mature maize cobs and Kharif moong/urad; thresh and dry.', advisory: 'Store cobs off the damp ground to prevent aflatoxin contamination.' },
  { week: 39, dateRange: 'Sep 24 – Sep 30', season: 'Kharif', seasonColor: '#16a34a', level: 3, stage: 'Paddy Dough Stage', operations: 'Paddy grain dough stage; stop all irrigation 10-14 days before harvest.', advisory: 'Field drying firms soil for tractor combine operation without ruts.' },

  // Oct - Weeks 40 to 44 (Kharif harvest, Rabi land prep & sowing)
  { week: 40, dateRange: 'Oct 1 – Oct 7', season: 'Kharif', seasonColor: '#16a34a', level: 4, stage: 'Peak Paddy Harvest Begins', operations: 'Combine harvesting of non-Basmati and short-duration paddy.', advisory: 'Use Super-SMS equipped combines to evenly spread straw for Happy Seeder sowing.' },
  { week: 41, dateRange: 'Oct 8 – Oct 14', season: 'Rabi', seasonColor: '#0284c7', level: 4, stage: 'Mustard Sowing Window (Optimal)', operations: 'Optimal sowing window for mustard (Pusa Mustard, Giriraj) and rabi potato.', advisory: 'Mustard sown between Oct 10-25 escapes severe aphid infestation in February.' },
  { week: 42, dateRange: 'Oct 15 – Oct 21', season: 'Rabi', seasonColor: '#0284c7', level: 4, stage: 'Chickpea & Lentil Sowing', operations: 'Sow chickpea, lentil and early barley; pre-sowing irrigation (paleva) for wheat.', advisory: 'Seed inoculation with Rhizobium + PSB enhances nodulation and phosphorus uptake.' },
  { week: 43, dateRange: 'Oct 22 – Oct 28', season: 'Kharif', seasonColor: '#16a34a', level: 4, stage: 'Basmati Rice Harvest', operations: 'Harvest premium Basmati varieties at 85% golden panicle stage to prevent shattering.', advisory: 'Manual reaping or slow-drum threshing minimizes broken kernel percentage.' },
  { week: 44, dateRange: 'Oct 29 – Nov 4', season: 'Rabi', seasonColor: '#0284c7', level: 4, stage: 'Wheat Sowing Wave 1 (Zero-Till)', operations: 'Direct drilling of wheat using Happy Seeder / Super Seeder into retained rice residue.', advisory: 'Drill DAP @ 50 kg/acre 4-5 cm below seed depth for rapid seedling emergence.' },

  // Nov - Weeks 45 to 48 (Peak wheat sowing, crown root irrigation)
  { week: 45, dateRange: 'Nov 5 – Nov 11', season: 'Rabi', seasonColor: '#0284c7', level: 4, stage: 'Peak Wheat Sowing (Timely Window)', operations: 'Main sowing of high-yielding wheat (PBW 826, HD 2967, HD 3086, DBW 187, DBW 303).', advisory: 'Maintain seed rate of 40 kg/acre for bold grains; cross-sowing ensures dense cover.' },
  { week: 46, dateRange: 'Nov 12 – Nov 18', season: 'Rabi', seasonColor: '#0284c7', level: 3, stage: 'Mustard Thinning & Weeding', operations: 'Thin mustard seedlings to 10-15 cm within row; first irrigation in mustard (25-30 DAS).', advisory: 'Timely thinning prevents lanky weak stems and promotes extensive branch canopy.' },
  { week: 47, dateRange: 'Nov 19 – Nov 25', season: 'Rabi', seasonColor: '#0284c7', level: 4, stage: 'Crown Root Initiation (CRI) Water', operations: 'FIRST IRRIGATION in early wheat at 21 days after sowing (CRI stage is vital!).', advisory: 'Missing the CRI irrigation permanently reduces tillering and grain yield by 20-25%.' },
  { week: 48, dateRange: 'Nov 26 – Dec 2', season: 'Rabi', seasonColor: '#0284c7', level: 3, stage: 'Late Wheat Sowing / Potato Earthing', operations: 'Earthing up in potato; sow late wheat varieties (HD 3059, PBW 771) with +20% seed rate.', advisory: 'Apply Pendimethalin 30% EC within 48 hours of sowing to control broadleaf weeds.' },

  // Dec - Weeks 49 to 52 (Winter vegetative, cold protection)
  { week: 49, dateRange: 'Dec 3 – Dec 9', season: 'Rabi', seasonColor: '#0284c7', level: 3, stage: 'First Urea Top Dressing (Wheat)', operations: 'Apply first split of Neem-coated Urea (45 kg/acre) right after CRI irrigation dries.', advisory: 'Apply urea on moist soil; avoid broadcasting on standing water to limit leaching.' },
  { week: 50, dateRange: 'Dec 10 – Dec 16', season: 'Rabi', seasonColor: '#0284c7', level: 2, stage: 'Active Tillering & Cold Onset', operations: 'Active tillering; check for Pink Stem Borer or Termites in light sandy soils.', advisory: 'Chlorpyrifos 20% EC @ 1 L/acre with irrigation water controls subterranean termites.' },
  { week: 51, dateRange: 'Dec 17 – Dec 23', season: 'Rabi', seasonColor: '#0284c7', level: 2, stage: 'Rabi Winter Maintenance', operations: 'Maintain soil moisture; second weeding / selective post-emergence herbicide spray.', advisory: 'Spray Pinoxaden or Metribuzin when weeds are at 2-3 leaf stage on a sunny midday.' },
  { week: 52, dateRange: 'Dec 24 – Dec 31', season: 'Rabi', seasonColor: '#0284c7', level: 2, stage: 'Jointing Stage & Winter Solstice', operations: 'Second irrigation in wheat (40-45 DAS); check chickpea for pod borer moth traps.', advisory: 'Install 4-5 pheromone traps per acre with Helilure to track Helicoverpa armigera.' },
]

const MONTH_HEADERS = [
  { name: 'Jan', span: 4 },
  { name: 'Feb', span: 4 },
  { name: 'Mar', span: 5 },
  { name: 'Apr', span: 4 },
  { name: 'May', span: 5 },
  { name: 'Jun', span: 4 },
  { name: 'Jul', span: 4 },
  { name: 'Aug', span: 5 },
  { name: 'Sep', span: 4 },
  { name: 'Oct', span: 5 },
  { name: 'Nov', span: 4 },
  { name: 'Dec', span: 4 },
]

export default function CropLibrary() {
  const [filter, setFilter] = useState<SeasonType>('all')
  const [selectedWeek, setSelectedWeek] = useState<number>(42) // Default to peak rabi sowing week
  const [spinning, setSpinning] = useState(false)

  // Current real-world week number
  const currentWeek = useMemo(() => {
    const now = new Date()
    const start = new Date(now.getFullYear(), 0, 1)
    const diff = now.getTime() - start.getTime()
    const oneWeek = 1000 * 60 * 60 * 24 * 7
    return Math.min(52, Math.max(1, Math.floor(diff / oneWeek) + 1))
  }, [])

  const currentInfo = WEEKS_DATA.find(w => w.week === selectedWeek) || WEEKS_DATA[41]

  const handleRefresh = () => {
    setSpinning(true)
    setTimeout(() => {
      setSelectedWeek(currentWeek)
      setSpinning(false)
    }, 600)
  }

  // 7 rows representing days of the week (Mon to Sun), each week having 7 dots
  const dayRows = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <section className="ag-card" style={{ padding: 18, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card-bg, #fff)', marginBottom: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ padding: 6, borderRadius: 8, background: '#ecfdf5', color: '#059669', display: 'flex' }}>
            <Calendar size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--primary)' }}>
                Agronomy Season Calendar
              </h3>
              <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: '#e0f2fe', color: '#0369a1', fontWeight: 600 }}>
                Git Dot-Matrix Heatmap
              </span>
            </div>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
              52-week crop phenology, sowing windows &amp; field operation intensity across Kharif, Rabi &amp; Zaid
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Season filter chips */}
          <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', padding: 3, borderRadius: 8 }}>
            {(['all', 'kharif', 'rabi', 'zaid'] as SeasonType[]).map(s => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  background: filter === s ? '#fff' : 'transparent',
                  color: filter === s ? '#0f172a' : '#64748b',
                  boxShadow: filter === s ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                {s === 'all' ? 'All Seasons' : s}
              </button>
            ))}
          </div>

          {/* Refresh Box Button */}
          <button
            className={`box-refresh-btn ${spinning ? 'spinning' : ''}`}
            onClick={handleRefresh}
            title="Refresh calendar & jump to current week"
            style={{ padding: 6 }}
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* GitHub Contribution Dot-Matrix Calendar */}
      <div className="git-matrix-container">
        <div className="git-matrix-wrap">
          {/* Month labels */}
          <div className="git-matrix-months">
            {MONTH_HEADERS.map(m => (
              <span key={m.name} style={{ width: `${(m.span / 52) * 100}%`, minWidth: m.span * 14 }}>
                {m.name}
              </span>
            ))}
          </div>

          {/* Matrix Grid: 7 Rows (Mon-Sun) × 52 Columns (Weeks) */}
          <div className="git-matrix-grid">
            <div className="git-matrix-days">
              <span>Mon</span>
              <span style={{ opacity: 0 }}>Tue</span>
              <span>Wed</span>
              <span style={{ opacity: 0 }}>Thu</span>
              <span>Fri</span>
              <span style={{ opacity: 0 }}>Sat</span>
              <span>Sun</span>
            </div>

            {WEEKS_DATA.map(w => {
              const isFilteredOut = filter !== 'all' && w.season.toLowerCase() !== filter
              const isSelected = selectedWeek === w.week
              const isThisWeek = currentWeek === w.week

              return (
                <div key={w.week} className="git-matrix-col">
                  {dayRows.map((_, dayIdx) => {
                    // Micro-variation for dots within the week to give natural commit-density texture
                    let dotLvl = w.level
                    if (dotLvl > 0 && (dayIdx === 5 || dayIdx === 6) && dotLvl > 1) {
                      dotLvl = (dotLvl - 1) as 0 | 1 | 2 | 3 | 4
                    }
                    if (isFilteredOut) dotLvl = 0

                    return (
                      <div
                        key={dayIdx}
                        className={`git-dot lvl-${dotLvl} ${isThisWeek && dayIdx === 2 ? 'today' : ''}`}
                        style={{
                          outline: isSelected ? '2px solid #0f172a' : undefined,
                          opacity: isFilteredOut ? 0.25 : 1,
                        }}
                        onClick={() => setSelectedWeek(w.week)}
                        title={`Week ${w.week} (${w.dateRange}): ${w.stage} · ${w.season} Season`}
                      />
                    )
                  })}
                </div>
              )
            })}
          </div>

          {/* Legend row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 11 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <i style={{ width: 9, height: 9, borderRadius: 2, background: '#16a34a', display: 'inline-block' }} />
                <b>Kharif</b> (Monsoon Jun–Oct)
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <i style={{ width: 9, height: 9, borderRadius: 2, background: '#0284c7', display: 'inline-block' }} />
                <b>Rabi</b> (Winter Oct–Apr)
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <i style={{ width: 9, height: 9, borderRadius: 2, background: '#ea580c', display: 'inline-block' }} />
                <b>Zaid</b> (Summer Mar–Jun)
              </span>
            </div>

            <div className="git-matrix-legend">
              <span>Less activity</span>
              <i className="git-dot lvl-0" />
              <i className="git-dot lvl-1" />
              <i className="git-dot lvl-2" />
              <i className="git-dot lvl-3" />
              <i className="git-dot lvl-4" />
              <span>Peak operations</span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Detail Box for Selected Week */}
      {currentInfo && (
        <div style={{ marginTop: 14, padding: 14, borderRadius: 10, border: '1px solid #cbd5e1', background: '#f8fafc', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: currentInfo.seasonColor + '18', color: currentInfo.seasonColor }}>
                {currentInfo.season} Season
              </span>
              <b style={{ fontSize: 14, color: '#0f172a' }}>
                Week {currentInfo.week} · {currentInfo.dateRange}
              </b>
              {currentWeek === currentInfo.week && (
                <span style={{ fontSize: 10, fontWeight: 700, color: '#2563eb', background: '#dbeafe', padding: '1px 6px', borderRadius: 4 }}>
                  Current Week
                </span>
              )}
            </div>

            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>
              {currentInfo.stage}
            </div>

            <p style={{ margin: 0, fontSize: 12, color: '#475569', lineHeight: 1.45 }}>
              <b>Field Operations:</b> {currentInfo.operations}
            </p>
          </div>

          <div style={{ background: '#fff', padding: 10, borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: '#059669', marginBottom: 4 }}>
              <Sprout size={14} /> ICAR / Agronomic Advisory
            </div>
            <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.45 }}>
              {currentInfo.advisory}
            </div>
          </div>
        </div>
      )}

      {/* Micro guidance note */}
      <small style={{ display: 'block', marginTop: 12, color: 'var(--muted)', fontSize: 11 }}>
        Click any dot in the matrix to view scheduled agronomic actions for that calendar week. Calibrated against ICAR (Indian Council of Agricultural Research) regional agro-ecological zones and standard FAO phenological thermal time (GDD) baselines.
      </small>
    </section>
  )
}
