import { useState } from 'react'
import { Bug, Calendar, Sprout, ShieldAlert, FlaskConical, Leaf, Search, ChevronDown } from 'lucide-react'

type Tab = 'calendar' | 'pests' | 'fertilizer'

type PestItem = {
  crop: string
  name: string
  type: 'Pest' | 'Disease' | 'Fungus'
  symptoms: string
  organic: string
  chemical: string
  ipmAdvice: string
}

const PEST_DATABASE: PestItem[] = [
  {
    crop: 'Paddy / Rice',
    name: 'Yellow Stem Borer',
    type: 'Pest',
    symptoms: 'Central shoot wilts and dries during vegetative stage ("dead heart"); panicle turns white and unfilled at heading ("white ear").',
    organic: 'Trichogramma japonicum egg parasitoid cards @ 1 lakh/ha; install 8-10 pheromone traps/ha with Scirpophaga lures; clip seedling leaf tips before transplanting.',
    chemical: 'Cartap hydrochloride 4G @ 18-20 kg/ha or Chlorantraniliprole 18.5% SC @ 0.3 ml/L water (60 ml/acre).',
    ipmAdvice: 'Apply during egg hatch or early instar boring. Avoid excessive late nitrogen application.',
  },
  {
    crop: 'Paddy / Rice',
    name: 'Rice Blast (Pyricularia oryzae)',
    type: 'Fungus',
    symptoms: 'Spindle-shaped elliptical lesions on leaves with grey-white center and brown-red margin; blackening and rotting at the neck node.',
    organic: 'Seed treatment with Pseudomonas fluorescens @ 10 g/kg seed; foliar spray of Trichoderma harzianum @ 5 g/L.',
    chemical: 'Tricyclazole 75% WP @ 0.6 g/L water or Isoprothiolane 40% EC @ 1.5 ml/L at first sign of spindle spots.',
    ipmAdvice: 'Avoid planting highly susceptible varieties under continuous high humidity and cloudy monsoon weather.',
  },
  {
    crop: 'Wheat',
    name: 'Yellow / Stripe Rust (Puccinia striiformis)',
    type: 'Disease',
    symptoms: 'Bright yellow powdery pustules arranged in prominent parallel stripes along leaf veins, wiping off as yellow dust on fingers.',
    organic: 'Foliar spray of 5% Neem seed kernel extract (NSKE) or sour buttermilk spray (1 L in 15 L water). Plant rust-resistant PBW varieties.',
    chemical: 'Propiconazole 25% EC @ 1 ml/L (200 ml/acre in 200 L water) or Tebuconazole 25.9% EC @ 1 ml/L immediately upon spot discovery.',
    ipmAdvice: 'Early morning scouting along northern field borders is crucial when cold humid winds prevail.',
  },
  {
    crop: 'Cotton',
    name: 'Pink Bollworm (Pectinophora gossypiella)',
    type: 'Pest',
    symptoms: '"Rosette" flowers that fail to open properly; boreholes sealed with frass inside developing green bolls; stained lint.',
    organic: 'Install 5-8 Gossyplure pheromone traps per acre from 45 days after sowing; mass release Trichogramma bactrae.',
    chemical: 'Profenofos 50% EC @ 2 ml/L or Emamectin benzoate 5% SG @ 0.4 g/L during peak moth emergence window.',
    ipmAdvice: 'Destroy cotton crop residue promptly after final picking to prevent diapausing larvae from overwintering.',
  },
  {
    crop: 'Cotton',
    name: 'Whitefly & Leaf Curl Virus',
    type: 'Pest',
    symptoms: 'Upward curling and thickening of leaf blades with prominent dark green enations underneath; sticky honeydew and black sooty mold.',
    organic: 'Install 15-20 yellow sticky traps per acre; foliar spray of cold-pressed Neem oil (10,000 ppm) @ 2-3 ml/L with liquid soap.',
    chemical: 'Diafenthiuron 50% WP @ 1.2 g/L or Pyriproxyfen 10% + Fenpropathrin 15% EC @ 1 ml/L.',
    ipmAdvice: 'Whiteflies vector the destructive Cotton Leaf Curl Virus (CLCuV). Keep borders free from weeds.',
  },
  {
    crop: 'Maize (Corn)',
    name: 'Fall Armyworm (Spodoptera frugiperda)',
    type: 'Pest',
    symptoms: 'Extensive pinhole perforations on leaves; ragged defoliation and copious sawdust-like frass accumulated inside the central whorl.',
    organic: 'Whirl application of neem cake powder or dry soil/sand mixed with lime; Metarhizium anisopliae foliar spray @ 5 g/L.',
    chemical: 'Chlorantraniliprole 18.5% SC @ 0.4 ml/L or Spinetoram 11.7% SC @ 0.5 ml/L directed into the whorls.',
    ipmAdvice: 'Scout central whorls during the 2-6 leaf stage. Early morning or evening applications work best.',
  },
  {
    crop: 'Tomato',
    name: 'Early Blight & Late Blight',
    type: 'Fungus',
    symptoms: 'Concentric ring "target spots" on lower leaves (Early); water-soaked rapidly expanding dark lesions with white fungal down (Late).',
    organic: 'Copper oxychloride 50% WP @ 2.5 g/L; spray Bacillus subtilis @ 5 g/L as preventive protective shield.',
    chemical: 'Mancozeb 75% WP @ 2 g/L (protective) or Cymoxanil 8% + Mancozeb 64% WP @ 2.5 g/L at early infection.',
    ipmAdvice: 'Avoid overhead sprinkler irrigation which keeps foliage wet. Prune lower diseased suckers.',
  },
]

const FERTILIZER_SCHEDULES = [
  {
    crop: 'Paddy / Rice',
    targetYield: '5.5 t/ha (22 q/acre)',
    basal: 'DAP 50 kg + MOP 25 kg + Zinc Sulphate 10 kg per acre before final puddling.',
    tillering: 'Neem-coated Urea 35 kg per acre at 20-25 days after transplanting (active tillering).',
    panicle: 'Neem-coated Urea 25 kg + MOP 15 kg per acre at panicle initiation (45-50 DAT).',
    micro: 'Spray 19:19:19 (10 g/L) + Chelated Zinc (1 g/L) if flag leaves show interveinal chlorosis.',
  },
  {
    crop: 'Wheat',
    targetYield: '4.8 t/ha (19 q/acre)',
    basal: 'DAP 55 kg + MOP 20 kg per acre drilled below seed depth at sowing.',
    crownRoot: 'First top dressing: Neem-coated Urea 45 kg/acre with first irrigation (21-25 days).',
    bootStage: 'Second top dressing: Neem-coated Urea 35 kg/acre with second irrigation (40-45 days).',
    micro: 'Spray Potassium Nitrate (13:0:45) @ 10 g/L at heading and flowering to increase grain bolding.',
  },
  {
    crop: 'Cotton',
    targetYield: '2.4 t/ha (10 q/acre)',
    basal: 'DAP 50 kg + MOP 25 kg + Magnesium Sulphate 10 kg/acre in furrows.',
    vegetative: 'Urea 30 kg/acre split at 30 and 60 days after sowing.',
    squaring: 'Urea 25 kg + MOP 15 kg/acre at squaring / early boll development.',
    micro: 'Foliar spray of Boron 20% (1 g/L) + Planofix (0.25 ml/L) to prevent flower and boll shedding.',
  },
]

const SEASONS = [
  {
    name: 'Kharif (Monsoon)',
    months: 'June to November',
    crops: 'Paddy, Cotton, Maize, Soybean, Groundnut, Pulses (Arhar, Moong)',
    strategy: 'Utilize monsoon rains; prioritize field drainage channels to prevent waterlogging; monitor for high humidity fungal diseases.',
  },
  {
    name: 'Rabi (Winter)',
    months: 'October to April',
    crops: 'Wheat, Mustard, Chickpea (Gram), Barley, Potato, Tomato, Lentil',
    strategy: 'Relies on residual soil moisture and assured tube well irrigation; cool nights benefit grain filling and starch formation.',
  },
  {
    name: 'Zaid (Summer)',
    months: 'March to June',
    crops: 'Watermelon, Muskmelon, Cucumber, Fodder Cowpea, Summer Moong',
    strategy: 'High solar radiation and fast growth; requires efficient drip or furrow watering to combat high atmospheric ET₀ demand.',
  },
]

export default function CropLibrary() {
  const [tab, setTab] = useState<Tab>('pests')
  const [search, setSearch] = useState('')

  const filteredPests = PEST_DATABASE.filter(p =>
    `${p.crop} ${p.name} ${p.symptoms}`.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <section className="ag-card" style={{ padding: 16, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card-bg, #fff)', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, borderBottom: '1px solid var(--border)', paddingBottom: 10, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ padding: 6, borderRadius: 8, background: '#ecfdf5', color: '#059669' }}>
            <Sprout size={20} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
              Offline Agronomy, Crop Calendar &amp; Pest Library
            </h3>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
              Self-contained agronomic knowledge base with organic remedies, chemical dosages &amp; fertilizer schedules
            </span>
          </div>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', padding: 3, borderRadius: 8 }}>
          <button
            onClick={() => setTab('pests')}
            style={{ padding: '5px 12px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, cursor: 'pointer', background: tab === 'pests' ? '#fff' : 'transparent', color: tab === 'pests' ? '#0f172a' : '#64748b' }}
          >
            Pests &amp; Diseases
          </button>
          <button
            onClick={() => setTab('fertilizer')}
            style={{ padding: '5px 12px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, cursor: 'pointer', background: tab === 'fertilizer' ? '#fff' : 'transparent', color: tab === 'fertilizer' ? '#0f172a' : '#64748b' }}
          >
            Fertilizer NPK
          </button>
          <button
            onClick={() => setTab('calendar')}
            style={{ padding: '5px 12px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, cursor: 'pointer', background: tab === 'calendar' ? '#fff' : 'transparent', color: tab === 'calendar' ? '#0f172a' : '#64748b' }}
          >
            Season Calendar
          </button>
        </div>
      </div>

      {tab === 'pests' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: '#fff' }}>
              <Search size={14} color="#64748b" />
              <input
                placeholder="Search pest, crop or symptom (e.g. rust, borer, blast, aphid)..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ border: 'none', outline: 'none', width: '100%', fontSize: 13 }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filteredPests.map((p, i) => (
              <div key={i} style={{ padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#0284c7', textTransform: 'uppercase', marginRight: 8 }}>{p.crop}</span>
                    <b style={{ fontSize: 14, color: '#0f172a' }}>{p.name}</b>
                  </div>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: p.type === 'Pest' ? '#fee2e2' : '#fef3c7', color: p.type === 'Pest' ? '#991b1b' : '#92400e', fontWeight: 600 }}>
                    {p.type}
                  </span>
                </div>

                <p style={{ margin: '0 0 8px', fontSize: 12.5, color: '#334155', lineHeight: 1.4 }}>
                  <b>Symptoms:</b> {p.symptoms}
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 8, fontSize: 12 }}>
                  <div style={{ background: '#ecfdf5', padding: '8px 10px', borderRadius: 6, border: '1px solid #a7f3d0' }}>
                    <div style={{ fontWeight: 700, color: '#065f46', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Leaf size={13} /> Organic &amp; Biological Control
                    </div>
                    <span style={{ color: '#047857' }}>{p.organic}</span>
                  </div>

                  <div style={{ background: '#fef2f2', padding: '8px 10px', borderRadius: 6, border: '1px solid #fecaca' }}>
                    <div style={{ fontWeight: 700, color: '#991b1b', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <FlaskConical size={13} /> Chemical IPM Remedy (Exact Dosage)
                    </div>
                    <span style={{ color: '#b91c1c' }}>{p.chemical}</span>
                  </div>
                </div>

                <div style={{ marginTop: 6, fontSize: 11, color: '#64748b' }}>
                  <b>Advisory:</b> {p.ipmAdvice}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'fertilizer' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {FERTILIZER_SCHEDULES.map((s, i) => (
            <div key={i} style={{ padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <b style={{ fontSize: 15, color: '#0f172a' }}>{s.crop}</b>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>Target: <b>{s.targetYield}</b></span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8, fontSize: 12 }}>
                <div style={{ background: '#fff', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}>
                  <b style={{ color: '#16a34a' }}>1. Basal Application (Sowing)</b>
                  <p style={{ margin: '4px 0 0', color: '#334155' }}>{s.basal}</p>
                </div>
                <div style={{ background: '#fff', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}>
                  <b style={{ color: '#0284c7' }}>2. Tillering / First Top Dressing</b>
                  <p style={{ margin: '4px 0 0', color: '#334155' }}>{s.tillering || s.crownRoot || s.vegetative}</p>
                </div>
                <div style={{ background: '#fff', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}>
                  <b style={{ color: '#d97706' }}>3. Panicle / Reproductive Stage</b>
                  <p style={{ margin: '4px 0 0', color: '#334155' }}>{s.panicle || s.bootStage || s.squaring}</p>
                </div>
                <div style={{ background: '#fff', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}>
                  <b style={{ color: '#7c3aed' }}>4. Micronutrients &amp; Foliar</b>
                  <p style={{ margin: '4px 0 0', color: '#334155' }}>{s.micro}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'calendar' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          {SEASONS.map((sn, i) => (
            <div key={i} style={{ padding: 14, borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Calendar size={16} color="#0284c7" />
                <b style={{ fontSize: 15, color: '#0f172a' }}>{sn.name}</b>
              </div>
              <div style={{ fontSize: 12, color: '#2563eb', fontWeight: 600, marginBottom: 8 }}>{sn.months}</div>
              <div style={{ fontSize: 12, marginBottom: 6 }}><b>Key crops:</b> {sn.crops}</div>
              <p style={{ margin: 0, fontSize: 12, color: '#475569', lineHeight: 1.4 }}>{sn.strategy}</p>
            </div>
          ))}
        </div>
      )}

      <small style={{ display: 'block', marginTop: 12, color: 'var(--muted)', fontSize: 11 }}>
        All recommendations follow ICAR (Indian Council of Agricultural Research), State Agricultural Universities (SAUs), and standard Integrated Pest Management (IPM) protocols.
      </small>
    </section>
  )
}
