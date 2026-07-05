'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { ITEMS as ITEM_DEFS } from '../sprites/items'
import { INVENTORY_COLS, HOTBAR_START, HOTBAR_SIZE, type ItemStack } from '../engine/inventory'
import ItemIcon from './ItemIcon'

interface InventoryBarProps {
  slots: (ItemStack | null)[]
  bagOpen: boolean
  onToggleBag: () => void
  selectedIndex?: number | null
  onSelectSlot?: (index: number) => void
  onDropOne?: (index: number) => void
  onDropStack?: (index: number) => void
  onMoveSlot: (from: number, to: number) => void
  onSplitStack: (slot: number) => void
  onUseItem?: (slot: number) => void
}

const STORAGE_SLOTS = 15 // 3 rows x 5 cols (indices 0-14)
const DOUBLE_TAP_MS = 300
const LONG_PRESS_MS = 500

const RARITY_COLORS: Record<string, string> = {
  common: '#9ca3af',
  uncommon: '#22c55e',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f59e0b',
}

export default function InventoryBar({
  slots, bagOpen, onToggleBag, selectedIndex, onSelectSlot,
  onDropOne, onDropStack, onMoveSlot, onSplitStack, onUseItem,
}: InventoryBarProps) {
  // --- Drag & drop state ---
  const dragFrom = useRef<number | null>(null)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dropTarget, setDropTarget] = useState<number | null>(null)

  // --- Click-to-move state (for touch/non-drag) ---
  const [heldSlot, setHeldSlot] = useState<number | null>(null)

  // --- Hotbar gesture detection ---
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTapRef = useRef<{ slot: number; time: number } | null>(null)
  const holdFiredRef = useRef(false)
  const [holdingSlot, setHoldingSlot] = useState<number | null>(null)
  const [droppedSlot, setDroppedSlot] = useState<number | null>(null)

  // --- Tooltip ---
  const [hoverSlot, setHoverSlot] = useState<number | null>(null)
  const tooltipItem = hoverSlot !== null ? slots[hoverSlot] : null
  const tooltipDef = tooltipItem ? ITEM_DEFS.find(i => i.id === tooltipItem.itemId) : null

  // --- Click-away to close the bag ---
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    return () => {
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current)
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
    }
  }, [])

  // Close the storage panel when the player taps anywhere outside the whole inventory bar
  // (canvas, other UI). Listener only lives while the bag is open, so it only ever closes.
  useEffect(() => {
    if (!bagOpen) return
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        onToggleBag()
      }
    }
    // Defer one frame so the same tap that opened the bag doesn't immediately close it
    const id = setTimeout(() => document.addEventListener('pointerdown', onPointerDown), 0)
    return () => { clearTimeout(id); document.removeEventListener('pointerdown', onPointerDown) }
  }, [bagOpen, onToggleBag])

  // Clear held slot when bag closes
  useEffect(() => {
    if (!bagOpen) setHeldSlot(null)
  }, [bagOpen])

  // --- Drag handlers (storage grid) ---
  const handleDragStart = useCallback((idx: number) => {
    if (!slots[idx]) return
    dragFrom.current = idx
    setDragIdx(idx)
  }, [slots])

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault()
    setDropTarget(idx)
  }, [])

  const handleDrop = useCallback((idx: number) => {
    if (dragFrom.current !== null && dragFrom.current !== idx) {
      onMoveSlot(dragFrom.current, idx)
    }
    dragFrom.current = null
    setDragIdx(null)
    setDropTarget(null)
  }, [onMoveSlot])

  const handleDragEnd = useCallback(() => {
    dragFrom.current = null
    setDragIdx(null)
    setDropTarget(null)
  }, [])

  // --- Click handlers (storage grid) ---
  const handleGridClick = useCallback((idx: number) => {
    if (heldSlot === null) {
      if (slots[idx]) setHeldSlot(idx)
    } else if (heldSlot === idx) {
      setHeldSlot(null)
    } else {
      onMoveSlot(heldSlot, idx)
      setHeldSlot(null)
    }
  }, [heldSlot, slots, onMoveSlot])

  const handleGridRightClick = useCallback((e: React.MouseEvent, idx: number) => {
    e.preventDefault()
    if (heldSlot !== null) { setHeldSlot(null); return }
    if (slots[idx] && slots[idx]!.count > 1) onSplitStack(idx)
  }, [heldSlot, slots, onSplitStack])

  const handleGridDoubleClick = useCallback((idx: number) => {
    if (onUseItem && slots[idx]) {
      onUseItem(idx)
      setHeldSlot(null)
    }
  }, [onUseItem, slots])

  // --- Hotbar gesture handlers ---
  const handleHotbarPointerDown = (i: number) => {
    const idx = HOTBAR_START + i
    holdFiredRef.current = false
    if (slots[idx] && onDropStack) {
      holdTimerRef.current = setTimeout(() => {
        holdFiredRef.current = true
        setHoldingSlot(null)
        setDroppedSlot(i)
        setTimeout(() => setDroppedSlot(null), 200)
        onDropStack(i)
      }, LONG_PRESS_MS)
      setHoldingSlot(i)
    }
  }

  const handleHotbarPointerUp = (i: number) => {
    const idx = HOTBAR_START + i
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
    setHoldingSlot(null)
    if (holdFiredRef.current) return

    // If bag is open and we have a held slot, move to hotbar
    if (bagOpen && heldSlot !== null) {
      onMoveSlot(heldSlot, idx)
      setHeldSlot(null)
      return
    }

    const now = Date.now()
    const last = lastTapRef.current
    if (last && last.slot === i && now - last.time < DOUBLE_TAP_MS) {
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current)
      lastTapRef.current = null
      if (slots[idx] && onDropOne) {
        setDroppedSlot(i)
        setTimeout(() => setDroppedSlot(null), 200)
        onDropOne(i)
      }
    } else {
      lastTapRef.current = { slot: i, time: now }
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current)
      tapTimerRef.current = setTimeout(() => {
        lastTapRef.current = null
        if (bagOpen && slots[idx]) {
          setHeldSlot(idx)
        } else {
          onSelectSlot?.(i)
        }
      }, DOUBLE_TAP_MS)
    }
  }

  const handleHotbarPointerLeave = () => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
    setHoldingSlot(null)
    holdFiredRef.current = false
  }

  return (
    <div ref={rootRef} className="flex items-end gap-0">
      {/* Bag toggle button */}
      <button
        onClick={onToggleBag}
        className={`flex items-center justify-center w-10 h-16 rounded-l-lg border transition-all ${
          bagOpen
            ? 'bg-[#d4a843]/15 border-[#d4a843]/30 text-[#d4a843]'
            : 'bg-[#16142a]/90 border-[#d4a843]/20 text-[#d4a843]/40 hover:text-[#d4a843]/70 hover:border-[#d4a843]/30'
        }`}
        title="Toggle Bag (B)"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M5 5V4a3 3 0 0 1 6 0v1M3 5h10l-1 9H4L3 5Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Hotbar + expandable storage */}
      <div className="relative">
        {/* Storage grid (expands above hotbar) */}
        {bagOpen && (
          <div className="absolute bottom-full left-0 right-0 mb-0 z-30">
            <div className="bg-[#16142a]/95 border border-[#d4a843]/30 border-b-0 rounded-t-lg shadow-lg shadow-black/40 backdrop-blur-sm overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-[#d4a843]/15">
                <span className="font-display text-[9px] text-[#d4a843]/50 tracking-wider uppercase">Storage</span>
                <button
                  onClick={onToggleBag}
                  aria-label="Close bag"
                  className="w-6 h-6 -mr-1 flex items-center justify-center rounded-md bg-red-500/15 text-red-400/80 hover:text-red-300 hover:bg-red-500/25 active:scale-90 transition-all text-[13px] font-bold leading-none"
                >
                  ✕
                </button>
              </div>
              {/* 3 rows x 5 cols */}
              <div className="grid grid-cols-5 gap-1 p-1.5">
                {Array.from({ length: STORAGE_SLOTS }).map((_, i) => (
                  <GridSlot
                    key={i}
                    idx={i}
                    item={slots[i] ?? null}
                    isHeld={heldSlot === i}
                    isDragging={dragIdx === i}
                    isDropTarget={dropTarget === i}
                    isTarget={heldSlot !== null && heldSlot !== i}
                    onClick={() => handleGridClick(i)}
                    onRightClick={(e) => handleGridRightClick(e, i)}
                    onDoubleClick={() => handleGridDoubleClick(i)}
                    onHover={() => setHoverSlot(i)}
                    onLeave={() => setHoverSlot(null)}
                    onDragStart={() => handleDragStart(i)}
                    onDragOver={(e) => handleDragOver(e, i)}
                    onDrop={() => handleDrop(i)}
                    onDragEnd={handleDragEnd}
                  />
                ))}
              </div>
            </div>

            {/* Tooltip */}
            {tooltipDef && hoverSlot !== null && hoverSlot < STORAGE_SLOTS && heldSlot === null && dragIdx === null && (
              <div className="absolute z-10 bottom-full left-1/2 -translate-x-1/2 mb-1 pointer-events-none">
                <div className="bg-[#16142a] border border-[#d4a843]/35 rounded-lg px-3 py-2 shadow-xl shadow-black/60 whitespace-nowrap">
                  <span className="font-display text-[12px] font-semibold" style={{ color: RARITY_COLORS[tooltipDef.rarity] ?? '#9ca3af' }}>
                    {tooltipDef.name}
                  </span>
                  {tooltipDef.description && (
                    <p className="text-[10px] text-text-faint/50 mt-0.5 max-w-[160px] whitespace-normal">{tooltipDef.description}</p>
                  )}
                  {tooltipDef.effect && (
                    <p className="text-[10px] text-green-400/60 mt-0.5">+{tooltipDef.effect.amount} {tooltipDef.effect.stat}</p>
                  )}
                </div>
              </div>
            )}

            {/* Held indicator */}
            {heldSlot !== null && (
              <div className="absolute -top-5 left-0 right-0 text-center pointer-events-none">
                <span className="text-[9px] text-[#d4a843]/50 font-display">Click slot to place · Right-click cancel</span>
              </div>
            )}
          </div>
        )}

        {/* Hotbar row (always visible) */}
        <div className={`flex items-stretch bg-[#16142a]/90 border border-[#d4a843]/30 ${bagOpen ? 'border-t-[#d4a843]/15 rounded-r-lg' : 'rounded-r-lg'}`}>
          {Array.from({ length: HOTBAR_SIZE }).map((_, i) => {
            const idx = HOTBAR_START + i
            const item = slots[idx] ?? null
            const isSelected = selectedIndex === i
            const isHolding = holdingSlot === i
            const isDropped = droppedSlot === i
            const isHeld = heldSlot === idx
            const isTarget = bagOpen && heldSlot !== null && heldSlot !== idx

            return (
              <button
                key={i}
                onPointerDown={() => handleHotbarPointerDown(i)}
                onPointerUp={() => handleHotbarPointerUp(i)}
                onPointerLeave={handleHotbarPointerLeave}
                onPointerCancel={handleHotbarPointerLeave}
                onMouseEnter={() => setHoverSlot(idx)}
                onMouseLeave={() => setHoverSlot(null)}
                draggable={bagOpen && !!item}
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={() => handleDrop(idx)}
                onDragEnd={handleDragEnd}
                className={`relative w-16 h-16 flex items-center justify-center overflow-hidden border-r last:border-r-0 transition-all duration-150 select-none touch-manipulation
                  ${isDropped
                    ? 'scale-90 opacity-60'
                    : isHolding
                      ? 'animate-pulse ring-2 ring-red-400/50 scale-95'
                      : dragIdx === idx
                        ? 'opacity-30 scale-90'
                        : dropTarget === idx
                          ? 'border-2 border-[#d4a843]/50 bg-[#d4a843]/15 scale-105'
                          : isHeld
                            ? 'border-2 border-[#d4a843]/60 bg-[#d4a843]/10 scale-95'
                            : isTarget
                              ? 'border-[#d4a843]/20 bg-[#d4a843]/[0.06]'
                              : isSelected
                                ? 'border-[#d4a843] bg-[#d4a843]/15 shadow-[0_0_8px_rgba(212,168,67,0.3)]'
                                : `border-[#d4a843]/10 ${item ? 'hover:bg-[#d4a843]/10 cursor-pointer' : 'cursor-default'}`
                  }
                `}
              >
                {item ? (
                  <>
                    <ItemIcon itemId={item.itemId} scale={2} />
                    {item.count > 1 && (
                      <span className="absolute bottom-0.5 right-1 text-[9px] text-white font-bold drop-shadow-[0_1px_2px_rgba(0,0,0,1)]">
                        {item.count}
                      </span>
                    )}
                  </>
                ) : (
                  <div className="w-6 h-6 rounded border border-dashed border-[#d4a843]/10" />
                )}
              </button>
            )
          })}
        </div>

        {/* Hotbar tooltip */}
        {tooltipDef && hoverSlot !== null && hoverSlot >= HOTBAR_START && heldSlot === null && dragIdx === null && (
          <div className="absolute z-10 bottom-full left-1/2 -translate-x-1/2 mb-1 pointer-events-none">
            <div className="bg-[#16142a] border border-[#d4a843]/35 rounded-lg px-3 py-2 shadow-xl shadow-black/60 whitespace-nowrap">
              <span className="font-display text-[12px] font-semibold" style={{ color: RARITY_COLORS[tooltipDef.rarity] ?? '#9ca3af' }}>
                {tooltipDef.name}
              </span>
              {tooltipDef.description && (
                <p className="text-[10px] text-text-faint/50 mt-0.5 max-w-[160px] whitespace-normal">{tooltipDef.description}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// --- Storage grid slot ---
function GridSlot({
  idx, item, isHeld, isDragging, isDropTarget, isTarget,
  onClick, onRightClick, onDoubleClick, onHover, onLeave,
  onDragStart, onDragOver, onDrop, onDragEnd,
}: {
  idx: number; item: ItemStack | null
  isHeld: boolean; isDragging: boolean; isDropTarget: boolean; isTarget: boolean
  onClick: () => void; onRightClick: (e: React.MouseEvent) => void; onDoubleClick: () => void
  onHover: () => void; onLeave: () => void
  onDragStart: () => void; onDragOver: (e: React.DragEvent) => void; onDrop: () => void; onDragEnd: () => void
}) {
  return (
    <button
      draggable={!!item}
      onClick={onClick}
      onContextMenu={onRightClick}
      onDoubleClick={onDoubleClick}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`relative w-16 h-16 flex items-center justify-center overflow-hidden rounded transition-all
        ${isDragging
          ? 'opacity-30 scale-90'
          : isDropTarget
            ? 'border-2 border-[#d4a843]/50 bg-[#d4a843]/15 scale-105'
            : isHeld
              ? 'border-2 border-[#d4a843]/60 bg-[#d4a843]/10 scale-95'
              : isTarget
                ? 'border border-[#d4a843]/20 bg-[#d4a843]/[0.06] hover:border-[#d4a843]/30'
                : item
                  ? 'border border-[#d4a843]/10 bg-black/30 hover:border-[#d4a843]/20 cursor-grab active:cursor-grabbing'
                  : 'border border-dashed border-[#d4a843]/8 bg-black/20'
        }
      `}
    >
      {item ? (
        <>
          <div className={isHeld ? 'opacity-50' : ''}>
            <ItemIcon itemId={item.itemId} scale={2} />
          </div>
          {item.count > 1 && (
            <span className="absolute bottom-0.5 right-1 text-[9px] text-white font-bold drop-shadow-[0_1px_2px_rgba(0,0,0,1)]">
              {item.count}
            </span>
          )}
        </>
      ) : null}
    </button>
  )
}
