import { useEffect, useState } from 'react'
import { FileText, Copy, Check, MapPin, Building2, Save } from 'lucide-react'
import type { FarmData } from './lib/seva'

type Props = {
  farm: FarmData & { id: string; name: string }
}

type LandInfo = {
  village: string
  tehsil: string
  district: string
  state: string
  pincode: string
  khasraNo: string
  khataNo: string
  ownerName: string
  pmKisanId: string
}

export default function LandInfoCard({ farm }: Props) {
  const storageKey = `seva-land-${farm.id}`
  const [info, setInfo] = useState<LandInfo>(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) return JSON.parse(saved)
    } catch {}
    return {
      village: '',
      tehsil: '',
      district: '',
      state: '',
      pincode: '',
      khasraNo: '',
      khataNo: '',
      ownerName: '',
      pmKisanId: '',
    }
  })

  const [loadingGeo, setLoadingGeo] = useState(false)
  const [copied, setCopied] = useState(false)
  const [savedNotice, setSavedNotice] = useState(false)

  // Auto-reverse geocode coordinates to Village, Tehsil, District if empty
  useEffect(() => {
    if (info.village && info.district) return
    let dead = false
    setLoadingGeo(true)

    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${farm.lat}&lon=${farm.lon}&zoom=14&addressdetails=1`, {
      headers: { 'Accept-Language': 'en' }
    })
      .then(res => res.json())
      .then(data => {
        if (dead) return
        const addr = data.address || {}
        setInfo(prev => {
          const next = {
            ...prev,
            village: prev.village || addr.village || addr.hamlet || addr.suburb || addr.town || '',
            tehsil: prev.tehsil || addr.county || addr.subdistrict || addr.tehsil || '',
            district: prev.district || addr.state_district || addr.district || '',
            state: prev.state || addr.state || '',
            pincode: prev.pincode || addr.postcode || '',
          }
          localStorage.setItem(storageKey, JSON.stringify(next))
          return next
        })
      })
      .catch(() => {})
      .finally(() => { if (!dead) setLoadingGeo(false) })

    return () => { dead = true }
  }, [farm.id, farm.lat, farm.lon])

  function update(key: keyof LandInfo, val: string) {
    const next = { ...info, [key]: val }
    setInfo(next)
    localStorage.setItem(storageKey, JSON.stringify(next))
    setSavedNotice(true)
    setTimeout(() => setSavedNotice(false), 2000)
  }

  function copyDossierText() {
    const text = `LAND DETAILS FOR AGRICULTURAL RECORDS & SUBSIDY:
Farm: ${farm.name}
Survey / Khasra No: ${info.khasraNo || 'Not specified'}
Khata / Patta No: ${info.khataNo || 'Not specified'}
Landowner Name: ${info.ownerName || 'Self'}
PM-KISAN / KCC ID: ${info.pmKisanId || 'N/A'}
Village: ${info.village || 'N/A'}
Tehsil / Taluka: ${info.tehsil || 'N/A'}
District: ${info.district || 'N/A'}, ${info.state} (PIN: ${info.pincode})
Coordinates: ${farm.lat.toFixed(5)}° N, ${farm.lon.toFixed(5)}° E
Geodesic Area: ${farm.area ? `${farm.area} ha (~${(farm.area * 2.471).toFixed(2)} acres)` : 'N/A'}
Generated via SEVA.GIS (https://sevagis.dpdns.org)`

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  return (
    <section className="ag-card" style={{ padding: 16, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card-bg, #fff)', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, borderBottom: '1px solid var(--border)', paddingBottom: 10, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ padding: 6, borderRadius: 8, background: '#e0e7ff', color: '#4338ca' }}>
            <Building2 size={20} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
              Land Revenue &amp; Registry Card
            </h3>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
              Village, Tehsil, and Survey / Khasra records required for PM-KISAN, crop insurance &amp; bank loans
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {savedNotice && <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>Saved</span>}
          <button
            onClick={copyDossierText}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', background: '#fff', cursor: 'pointer', fontWeight: 600 }}
          >
            {copied ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy for paperwork'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, fontWeight: 600, color: '#475569' }}>
          Survey / Khasra Number *
          <input
            placeholder="e.g. 142/2A or 89"
            value={info.khasraNo}
            onChange={e => update('khasraNo', e.target.value)}
            style={{ marginTop: 4, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, fontWeight: 600, color: '#475569' }}>
          Khata / Patta Number
          <input
            placeholder="e.g. KH-412"
            value={info.khataNo}
            onChange={e => update('khataNo', e.target.value)}
            style={{ marginTop: 4, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, fontWeight: 600, color: '#475569' }}>
          Registered Landowner
          <input
            placeholder="Farmer name as in revenue records"
            value={info.ownerName}
            onChange={e => update('ownerName', e.target.value)}
            style={{ marginTop: 4, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, fontWeight: 600, color: '#475569' }}>
          PM-KISAN / Kisan ID
          <input
            placeholder="Beneficiary registration ID"
            value={info.pmKisanId}
            onChange={e => update('pmKisanId', e.target.value)}
            style={{ marginTop: 4, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, fontWeight: 600, color: '#475569' }}>
          Village / Gram Panchayat
          <input
            placeholder={loadingGeo ? 'Finding village…' : 'Village name'}
            value={info.village}
            onChange={e => update('village', e.target.value)}
            style={{ marginTop: 4, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, fontWeight: 600, color: '#475569' }}>
          Tehsil / Taluka / Block
          <input
            placeholder="Tehsil name"
            value={info.tehsil}
            onChange={e => update('tehsil', e.target.value)}
            style={{ marginTop: 4, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, fontWeight: 600, color: '#475569' }}>
          District &amp; State
          <input
            placeholder="District, State"
            value={info.district ? `${info.district}, ${info.state}` : ''}
            onChange={e => {
              const parts = e.target.value.split(',')
              update('district', parts[0]?.trim() || '')
              if (parts[1]) update('state', parts[1].trim())
            }}
            style={{ marginTop: 4, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, fontWeight: 600, color: '#475569' }}>
          PIN Code
          <input
            placeholder="6-digit postal code"
            value={info.pincode}
            onChange={e => update('pincode', e.target.value)}
            style={{ marginTop: 4, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}
          />
        </label>
      </div>

      <small style={{ display: 'block', marginTop: 12, color: 'var(--muted)', fontSize: 11 }}>
        Saved safely on this device. Essential for filing Pradhan Mantri Fasal Bima Yojana (PMFBY) damage claims, Kisan Credit Card renewals, solar pump subsidies, and agricultural revenue certificates.
      </small>
    </section>
  )
}
