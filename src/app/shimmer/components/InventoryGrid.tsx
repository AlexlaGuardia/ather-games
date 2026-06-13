'use client'

import { useState, useCallback, useRef } from 'react'
import { ITEMS } from '../sprites/items'
import { INVENTORY_COLS, INVENTORY_ROWS, HOTBAR_START, HOTBAR_SIZE, type ItemStack } from '../engine/inventory'
import ItemIcon from './ItemIcon'

interface InventoryGridProps {
  slots: (ItemStack | null)[]
  onMoveSlot: (from: number, to: number) => void
  onSplitStack: (slot: number) => void
  onUseItem?: (slot: number) => void
  onClose: () => void
}

const RARITY_COLORS: Record<string, string> = {
  common: '#9ca3af',
  uncommon: '#22c55e',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f59e0b',
}

const STORAGE_SLOTS = INVENTORY_COLS * (INVENTORY_ROWS - 1) // 15

export default function InventoryGrid({ slots, onMoveSlot, onSplitStack, onUseItem, onClose }: InventoryGridProps) {
  const [hoverSlot, setHoverSlot] = useState<number | null>(null)
  const dragFrom = useRef<number | null>(null)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dropTarget, setDropTarget] = useState<number | null>(null)

  // Drag start
  const handleDragStart = useCallback((idx: number) => {
    if (!slots[idx]) return
    dragFrom.current = idx
    setDragIdx(idx)
  }, [slots])

  // Drag over slot
  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault()
    setDropTarget(idx)
  }, [])

  // Drop on slot
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

  // Click-to-move fallback (for touch / non-drag)
  const [heldSlot, setHeldSlot] = useState<number | null>(null)

  const handleClick = useCallback((idx: number) => {
    if (heldSlot === null) {
      if (slots[idx]) setHeldSlot(idx)
    } else if (heldSlot === idx) {
      setHeldSlot(null)
    } else {
      onMoveSlot(heldSlot, idx)
      setHeldSlot(null)
    }
  }, [heldSlot, slots, onMoveSlot])

  const handleRightClick = useCallback((e: React.MouseEvent, idx: number) => {
    e.preventDefault()
    if (heldSlot !== null) { setHeldSlot(null); return }
    if (slots[idx] && slots[idx]!.count > 1) onSplitStack(idx)
  }, [heldSlot, slots, onSplitStack])

  const handleDoubleClick = useCallback((idx: number) => {
    if (onUseItem && slots[idx]) {
      onUseItem(idx)
      setHeldSlot(null)
    }
  }, [onUseItem, slots])

  const tooltipItem = hoverSlot !== null ? slots[hoverSlot] : null
  const tooltipDef = tooltipItem ? ITEMS.find(i => i.id === tooltipItem.itemId) : null

  return (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-30 select-none">
      <div className="bg-[#16142a]/95 border border-[#d4a843]/30 rounded-xl shadow-2xl shadow-black/60 backdrop-blur-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-[#d4a843]/15">
          <span className="font-display text-[11px] text-[#d4a843]/70 tracking-wider uppercase">Bag</span>
          <button
            onClick={onClose}
            className="w-5 h-5 flex items-center justify-center rounded text-red-400/70 hover:text-red-400 hover:bg-red-400/10 transition-colors text-xs font-bold"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Storage grid (3 rows x 5 cols) */}
        <div className="grid grid-cols-5 gap-1 p-2">
          {Array.from({ length: STORAGE_SLOTS }).map((_, i) => (
            <SlotCell
              key={i}
              idx={i}
              item={slots[i] ?? null}
              isHeld={heldSlot === i}
              isDragging={dragIdx === i}
              isDropTarget={dropTarget === i}
              isTarget={heldSlot !== null && heldSlot !== i}
              isHotbar={false}
              onClick={() => handleClick(i)}
              onRightClick={(e) => handleRightClick(e, i)}
              onDoubleClick={() => handleDoubleClick(i)}
              onHover={() => setHoverSlot(i)}
              onLeave={() => setHoverSlot(null)}
              onDragStart={() => handleDragStart(i)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDrop={() => handleDrop(i)}
              onDragEnd={handleDragEnd}
            />
          ))}
        </div>

        {/* Hotbar divider */}
        <div className="flex items-center gap-2 px-3">
          <div className="flex-1 h-px bg-[#d4a843]/15" />
          <span className="text-[8px] text-[#d4a843]/25 font-display">HOTBAR</span>
          <div className="flex-1 h-px bg-[#d4a843]/15" />
        </div>

        {/* Hotbar row (5 slots) */}
        <div className="grid grid-cols-5 gap-1 p-2 pt-1">
          {Array.from({ length: HOTBAR_SIZE }).map((_, i) => {
            const idx = HOTBAR_START + i
            return (
              <SlotCell
                key={idx}
                idx={idx}
                item={slots[idx] ?? null}
                isHeld={heldSlot === idx}
                isDragging={dragIdx === idx}
                isDropTarget={dropTarget === idx}
                isTarget={heldSlot !== null && heldSlot !== idx}
                isHotbar={true}
                onClick={() => handleClick(idx)}
                onRightClick={(e) => handleRightClick(e, idx)}
                onDoubleClick={() => handleDoubleClick(idx)}
                onHover={() => setHoverSlot(idx)}
                onLeave={() => setHoverSlot(null)}
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={() => handleDrop(idx)}
                onDragEnd={handleDragEnd}
              />
            )
          })}
        </div>
      </div>

      {/* Tooltip */}
      {tooltipDef && hoverSlot !== null && heldSlot === null && dragIdx === null && (
        <div className="absolute z-10 bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none">
          <div className="bg-[#16142a] border border-[#d4a843]/35 rounded-lg px-3 py-2 shadow-xl shadow-black/60 whitespace-nowrap">
            <span
              className="font-display text-[12px] font-semibold"
              style={{ color: RARITY_COLORS[tooltipDef.rarity] ?? '#9ca3af' }}
            >
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
        <div className="absolute -top-6 left-0 right-0 text-center">
          <span className="text-[9px] text-[#d4a843]/50 font-display">Click a slot to place · Right-click to cancel</span>
        </div>
      )}
    </div>
  )
}

// --- Slot cell with drag support ---

function SlotCell({
  idx,
  item,
  isHeld,
  isDragging,
  isDropTarget,
  isTarget,
  isHotbar,
  onClick,
  onRightClick,
  onDoubleClick,
  onHover,
  onLeave,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  idx: number
  item: ItemStack | null
  isHeld: boolean
  isDragging: boolean
  isDropTarget: boolean
  isTarget: boolean
  isHotbar: boolean
  onClick: () => void
  onRightClick: (e: React.MouseEvent) => void
  onDoubleClick: () => void
  onHover: () => void
  onLeave: () => void
  onDragStart: () => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: () => void
  onDragEnd: () => void
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
      className={`relative w-12 h-12 flex items-center justify-center rounded transition-all
        ${isDragging
          ? 'opacity-30 scale-90'
          : isDropTarget
            ? 'border-2 border-[#d4a843]/50 bg-[#d4a843]/15 scale-105'
            : isHeld
              ? 'border-2 border-[#d4a843]/60 bg-[#d4a843]/10 scale-95'
              : isTarget
                ? 'border border-[#d4a843]/20 bg-[#d4a843]/[0.06] hover:border-[#d4a843]/30 hover:bg-[#d4a843]/5'
                : item
                  ? 'border border-[#d4a843]/10 bg-black/30 hover:border-[#d4a843]/20 hover:bg-[#d4a843]/[0.04] cursor-grab active:cursor-grabbing'
                  : `border border-dashed ${isHotbar ? 'border-[#d4a843]/12 bg-[#d4a843]/[0.03]' : 'border-[#d4a843]/8 bg-black/20'}`
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
      ) : isHotbar ? (
        <span className="text-[9px] text-[#d4a843]/15 font-display">{idx - HOTBAR_START + 1}</span>
      ) : null}
    </button>
  )
}
