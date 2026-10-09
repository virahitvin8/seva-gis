import { useMemo, useState } from 'react'
import { Search, Sprout, Check, Plus, Tag, HelpCircle, Layers, X } from 'lucide-react'
import { GROUPS, SEASON_LABEL, searchCrops, type Crop } from './crops'

export type CropSelection = { crop: Crop } | { custom: string }

type Props = {
  selectedCrop?: string
  onSelect: (selection: CropSelection | string) => void
  onClose?: () => void
}

const COMMON_SHORTCUTS = [
  { name: 'Paddy / Rice', category: 'Cereals' },
  { name: 'Wheat', category: 'Cereals' },
  { name: 'Chickpea / Gram', category: 'Pulses' },
  { name: 'Pigeon pea (Tur/Arhar)', category: 'Pulses' },
  { name: 'Soybean', category: 'Oilseeds' },
  { name: 'Cotton', category: 'Fibre crops' },
  { name: 'Tomato', category: 'Vegetables' },
  { name: 'Uncultivated land', category: 'Land Cover' },
  { name: 'Bare land', category: 'Land Cover' },
]

export default function CropSelector({ selectedCrop = '', onSelect, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<string | undefined>()
  const [customInput, setCustomInput] = useState('')

  const results = useMemo(() => searchCrops(query, group), [query, group])

  // Group results by category
  const byCategory = useMemo(() => {
    const m = new Map<string, Crop[]>()
    results.forEach((c) => m.set(c.category, [...(m.get(c.category) ?? []), c]))
    return [...m.entries()]
  }, [results])

  const choose = (item: Crop | string) => {
    if (typeof item === 'string') {
      onSelect({ custom: item })
      // also if caller is expecting a plain string, they can handle it or use the string
      onSelect(item as any)
    } else {
      onSelect({ crop: item })
      onSelect(item.name as any)
    }
    onClose?.()
  }

  return (
    <div className="crop-selector-modal" style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 12, padding: '14px', marginTop: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
      {/* Optional Header with Title & Close button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#166534' }}>
          <Sprout size={16} /> Select Crop / Land Classification
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close crop selector"
            style={{ border: 'none', background: 'transparent', padding: '4px', cursor: 'pointer', color: '#64748b', borderRadius: 6 }}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Search Input Bar */}
      <div style={{ position: 'relative', marginBottom: 10 }}>
        <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search crop or land: e.g. chana, gram, pulses, bare, rice..."
          aria-label="Search crops"
          autoFocus
          style={{
            width: '100%',
            padding: '8px 10px 8px 32px',
            borderRadius: 8,
            border: '1px solid #cbd5e1',
            background: '#fff',
            fontSize: 13,
            color: '#0f172a',
            outline: 'none',
          }}
        />
      </div>

      {/* Quick 1-Click Common Presets */}
      {!query && !group && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 }}>
            Common Crops & Land Use
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {COMMON_SHORTCUTS.map((item) => (
              <button
                key={item.name}
                type="button"
                onClick={() => choose(item.name)}
                style={{
                  fontSize: 12,
                  padding: '4px 10px',
                  borderRadius: 20,
                  border: selectedCrop === item.name ? '1px solid #16a34a' : '1px solid #e2e8f0',
                  background: selectedCrop === item.name ? '#dcfce7' : '#fff',
                  color: selectedCrop === item.name ? '#15803d' : '#334155',
                  fontWeight: selectedCrop === item.name ? 700 : 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {selectedCrop === item.name && <Check size={12} />}
                {item.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Category Pills Filter */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }} role="group" aria-label="Crop categories">
        <button
          type="button"
          onClick={() => setGroup(undefined)}
          style={{
            fontSize: 11,
            padding: '3px 8px',
            borderRadius: 14,
            border: !group ? '1px solid #16a34a' : '1px solid #cbd5e1',
            background: !group ? '#16a34a' : '#fff',
            color: !group ? '#fff' : '#475569',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          All Categories
        </button>
        {GROUPS.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGroup(group === g ? undefined : g)}
            style={{
              fontSize: 11,
              padding: '3px 8px',
              borderRadius: 14,
              border: group === g ? '1px solid #16a34a' : '1px solid #cbd5e1',
              background: group === g ? '#16a34a' : '#fff',
              color: group === g ? '#fff' : '#475569',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {g}
          </button>
        ))}
      </div>

      {/* Search Results / Categorized List */}
      <div style={{ maxHeight: 220, overflowY: 'auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '4px' }}>
        {byCategory.map(([category, crops]) => (
          <div key={category} style={{ marginBottom: 8 }}>
            <div style={{
              position: 'sticky',
              top: 0,
              background: '#f1f5f9',
              padding: '3px 8px',
              fontSize: 11,
              fontWeight: 700,
              color: '#15803d',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}>
              <Layers size={11} /> {category} ({crops.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
              {crops.map((c) => {
                const isCurrent = selectedCrop.toLowerCase() === c.name.toLowerCase()
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => choose(c)}
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '5px 8px',
                      borderRadius: 6,
                      border: 'none',
                      background: isCurrent ? '#f0fdf4' : 'transparent',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: 12.5,
                      color: isCurrent ? '#15803d' : '#1e293b',
                      fontWeight: isCurrent ? 700 : 500,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = isCurrent ? '#dcfce7' : '#f8fafc')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = isCurrent ? '#f0fdf4' : 'transparent')}
                  >
                    <span>
                      {c.name}
                      {c.aliases && (
                        <span style={{ marginLeft: 6, fontSize: 11, color: '#64748b', fontWeight: 400 }}>
                          ({c.aliases.split(',').slice(0, 3).join(', ')})
                        </span>
                      )}
                    </span>
                    <span style={{ fontSize: 10, color: '#94a3b8', whiteSpace: 'nowrap' }}>
                      {[...c.season].map((s) => SEASON_LABEL[s]?.split(' ')[0]).join('/')}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}

        {/* If no results, offer to use custom crop */}
        {!results.length && (
          <div style={{ padding: '12px', textAlign: 'center', fontSize: 12, color: '#64748b' }}>
            <p style={{ margin: '0 0 8px' }}>No standard crop matched "{query}".</p>
            {query.trim() && (
              <button
                type="button"
                onClick={() => choose(query.trim())}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  background: '#16a34a',
                  color: '#fff',
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <Plus size={14} /> Use "{query.trim()}" as custom crop
              </button>
            )}
          </div>
        )}
      </div>

      {/* Manual Custom Name Input Section */}
      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed #cbd5e1', display: 'flex', gap: 6, alignItems: 'center' }}>
        <input
          type="text"
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          placeholder="Or type a custom name (e.g. Desi Chana GNG, Mustard..."
          style={{
            flex: 1,
            padding: '6px 10px',
            borderRadius: 6,
            border: '1px solid #cbd5e1',
            fontSize: 12,
            background: '#fff',
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && customInput.trim()) {
              e.preventDefault()
              choose(customInput.trim())
            }
          }}
        />
        <button
          type="button"
          disabled={!customInput.trim()}
          onClick={() => {
            if (customInput.trim()) {
              choose(customInput.trim())
            }
          }}
          style={{
            padding: '6px 12px',
            borderRadius: 6,
            background: customInput.trim() ? '#0f172a' : '#cbd5e1',
            color: '#fff',
            border: 'none',
            fontSize: 12,
            fontWeight: 600,
            cursor: customInput.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          Set
        </button>
      </div>
    </div>
  )
}
