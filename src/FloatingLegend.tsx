import { useState, useRef, useEffect, useCallback } from 'react'
import { Move, Minimize2, Maximize2, X, RotateCcw, Tag, Check, Sparkles } from 'lucide-react'

export type LegendClassItem = {
  id?: string | number
  name: string
  color: string
  pct?: number
  ha?: number
  note?: string
}

type Props = {
  title: string
  subtitle?: string
  items: LegendClassItem[]
  unit?: string
  defaultPos?: { x: number; y: number }
  containerRef?: React.RefObject<HTMLElement | null>
  onClose?: () => void
}

export default function FloatingLegend({
  title,
  subtitle = 'Adjustable everywhere · Drag to reposition',
  items,
  unit,
  defaultPos = { x: 18, y: 18 },
  onClose,
}: Props) {
  const [pos, setPos] = useState(defaultPos)
  const [dragging, setDragging] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [copiedItem, setCopiedItem] = useState<string | null>(null)
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; posX: number; posY: number }>({
    mouseX: 0,
    mouseY: 0,
    posX: defaultPos.x,
    posY: defaultPos.y,
  })
  const cardRef = useRef<HTMLDivElement>(null)

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only drag from header handle
    const target = e.target as HTMLElement
    if (target.closest('button') || target.closest('a')) return

    e.preventDefault()
    setDragging(true)
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      posX: pos.x,
      posY: pos.y,
    }
  }

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!dragging) return
      const dx = e.clientX - dragStartRef.current.mouseX
      const dy = e.clientY - dragStartRef.current.mouseY
      const newX = Math.max(10, Math.min(window.innerWidth - 300, dragStartRef.current.posX + dx))
      const newY = Math.max(10, Math.min(window.innerHeight - 180, dragStartRef.current.posY + dy))
      setPos({ x: newX, y: newY })
    },
    [dragging]
  )

  const handlePointerUp = useCallback(() => {
    setDragging(false)
  }, [])

  useEffect(() => {
    if (dragging) {
      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointerup', handlePointerUp)
    }
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [dragging, handlePointerMove, handlePointerUp])

  const snapBesideMap = () => {
    setPos({ x: 18, y: 18 })
  }

  const snapTopRight = () => {
    setPos({ x: Math.max(10, window.innerWidth - 340), y: 18 })
  }

  const copyRow = (item: LegendClassItem) => {
    const text = `${item.name}: ${item.pct !== undefined ? item.pct.toFixed(1) + '%' : ''} ${item.ha !== undefined ? '(' + item.ha.toFixed(2) + ' ha)' : ''}`
    navigator.clipboard?.writeText(text)
    setCopiedItem(item.name)
    setTimeout(() => setCopiedItem(null), 1800)
  }

  if (minimized) {
    return (
      <div
        className="floating-legend-pill"
        style={{ left: pos.x, top: pos.y }}
        onClick={() => setMinimized(false)}
        title="Click to expand full classification legend"
      >
        <Tag size={13} className="text-emerald-400" />
        <span className="pill-title">{title}</span>
        <span className="pill-badge">{items.length} classes</span>
        <button
          className="pill-expand-btn"
          onClick={(e) => {
            e.stopPropagation()
            setMinimized(false)
          }}
          aria-label="Expand legend"
        >
          <Maximize2 size={11} />
        </button>
      </div>
    )
  }

  return (
    <div
      ref={cardRef}
      className={`floating-legend-box ${dragging ? 'is-dragging' : ''}`}
      style={{ left: pos.x, top: pos.y }}
    >
      {/* Draggable Header */}
      <div className="floating-legend-head" onPointerDown={handlePointerDown}>
        <div className="head-drag-title">
          <Move size={14} className="drag-handle-icon" />
          <div>
            <h5 className="legend-head-title">{title}</h5>
            <span className="legend-head-sub">{subtitle}</span>
          </div>
        </div>

        {/* Shortcuts / Controls */}
        <div className="legend-head-controls">
          <button
            className="ctrl-btn"
            onClick={snapBesideMap}
            title="Snap Beside Map (Reset position)"
            aria-label="Snap beside map"
          >
            <RotateCcw size={11} />
          </button>
          <button
            className="ctrl-btn"
            onClick={() => setMinimized(true)}
            title="Minimize into compact shortcut badge"
            aria-label="Minimize legend"
          >
            <Minimize2 size={11} />
          </button>
          {onClose && (
            <button className="ctrl-btn close" onClick={onClose} title="Hide legend" aria-label="Close legend">
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Legend Classes List */}
      <div className="floating-legend-body">
        {unit && <div className="legend-unit-tag">{unit}</div>}
        <ul className="legend-classes-list">
          {items.map((item, idx) => {
            const pct = item.pct !== undefined ? item.pct : null
            return (
              <li
                key={item.id ?? idx}
                className="legend-class-row"
                onClick={() => copyRow(item)}
                title="Click to copy class values"
              >
                <div className="class-row-left">
                  <span className="class-color-badge" style={{ backgroundColor: item.color }} />
                  <span className="class-name">{item.name}</span>
                </div>

                <div className="class-row-right">
                  {pct !== null && <span className="class-pct">{pct.toFixed(0)}%</span>}
                  {item.ha !== undefined && <span className="class-ha">{item.ha.toFixed(2)} ha</span>}
                  {copiedItem === item.name && <Check size={11} className="text-emerald-400 copy-check" />}
                </div>

                {pct !== null && (
                  <div className="class-bar-bg">
                    <div
                      className="class-bar-fill"
                      style={{ width: `${Math.min(100, Math.max(3, pct))}%`, backgroundColor: item.color }}
                    />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      {/* Footer shortcut bar */}
      <div className="floating-legend-foot">
        <span className="foot-hint">💡 Drag anywhere • Click row to copy</span>
        <button className="foot-snap-btn" onClick={snapTopRight}>
          Top-Right
        </button>
      </div>
    </div>
  )
}
