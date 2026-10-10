import { Building2, Info, MapPin } from 'lucide-react'
import type { FarmData } from './lib/seva'

type Props = { farm: FarmData & { id: string; name: string } }

export default function LandInfoCard({ farm }: Props) {
  return (
    <section className="land-record-card" aria-labelledby="land-record-title">
      <div className="land-record-head">
        <span className="land-record-icon"><Building2 size={18} /></span>
        <div>
          <h3 id="land-record-title">Land information</h3>
          <p>Details saved with this farm</p>
        </div>
      </div>
      <div className="land-record-facts">
        <div><MapPin size={15} /><span>Coordinates</span><strong>{farm.lat.toFixed(5)}°, {farm.lon.toFixed(5)}°</strong></div>
        <div><Building2 size={15} /><span>Farm area</span><strong>{farm.area ? `${farm.area} ha` : 'Not provided'}</strong></div>
      </div>
      <p className="land-record-note"><Info size={15} />Official ownership, survey number and revenue records are not connected to this app. No registry details are generated or edited here.</p>
    </section>
  )
}
