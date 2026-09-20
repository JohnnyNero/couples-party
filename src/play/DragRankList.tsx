import { useRef, useState, type PointerEvent } from 'react'

type Row = { id: string; text: string }

// A touch-friendly drag-to-reorder list, built on Pointer Events rather than the native
// HTML5 drag API (which mobile Safari barely supports). Row positions are snapshotted
// once at the start of a drag, so reordering only needs "how many other rows sit above
// the pointer now" — no live re-measuring while a finger is moving.
export function DragRankList({
  rows,
  order,
  onChange,
  disabled = false,
}: {
  rows: Row[]
  order: string[]
  onChange: (order: string[]) => void
  disabled?: boolean
}) {
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const centers = useRef<{ id: string; center: number }[] | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const byId = new Map(rows.map((r) => [r.id, r]))

  function startDrag(e: PointerEvent<HTMLDivElement>, id: string): void {
    if (disabled) return
    centers.current = order.map((rid) => {
      const rect = rowRefs.current.get(rid)!.getBoundingClientRect()
      return { id: rid, center: rect.top + rect.height / 2 }
    })
    setDraggingId(id)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onMove(e: PointerEvent<HTMLDivElement>): void {
    if (!draggingId || !centers.current) return
    const y = e.clientY
    const others = centers.current.filter((c) => c.id !== draggingId)
    const newIndex = others.filter((c) => c.center < y).length
    const curIndex = order.indexOf(draggingId)
    if (newIndex !== curIndex) {
      const next = order.filter((id) => id !== draggingId)
      next.splice(newIndex, 0, draggingId)
      onChange(next)
    }
  }

  function endDrag(): void {
    setDraggingId(null)
    centers.current = null
  }

  return (
    <div className="flex flex-col gap-1.5">
      {order.map((id, i) => {
        const row = byId.get(id)
        if (!row) return null
        const dragging = id === draggingId
        return (
          <div
            key={id}
            ref={(el) => { if (el) rowRefs.current.set(id, el); else rowRefs.current.delete(id) }}
            onPointerDown={(e) => startDrag(e, id)}
            onPointerMove={onMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className={
              'flex items-center gap-3 min-h-[52px] px-3 border-2 uppercase touch-none select-none ' +
              (dragging ? 'border-accent bg-accent/10 relative z-10' : 'border-fg/25') +
              (disabled ? ' opacity-50' : ' cursor-grab active:cursor-grabbing')
            }
          >
            <span className="text-fg/30 text-lg leading-none shrink-0">⠿</span>
            <span className="flex-1 min-w-0 truncate text-left">{row.text}</span>
            <span className="text-fg/30 tabular-nums text-sm shrink-0">{i + 1}</span>
          </div>
        )
      })}
    </div>
  )
}
