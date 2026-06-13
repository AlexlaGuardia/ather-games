'use client'

import { useState, useCallback } from 'react'
import { ITEMS } from '../sprites/items'
import { INVENTORY_SLOTS, type ItemStack, type SlotGrid, transferItem, moveSlot, splitStack } from '../engine/inventory'
import ItemIcon from './ItemIcon'

interface ChestPanelProps {
  chestSlots: SlotGrid
  invSlots: SlotGrid
  chestLabel?: string
  onChanged: () => void
  onPickupChest?: () => void
}

type HeldSource = { grid: 'chest' | 'inv'; idx: number } | null

export default function ChestPanel({ chestSlots, invSlots, chestLabel, onChanged, onPickupChest }: ChestPanelProps) {
  const [held, setHeld] = useState<HeldSource>(null)

  const handleClick = useCallback((grid: 'chest' | 'inv', idx: number) => {
    const slots = grid === 'chest' ? chestSlots : invSlots
    if (held === null) {
      if (slots[idx]) setHeld({ grid, idx })
    } else if (held.grid === grid && held.idx === idx) {
      setHeld(null)
    } else if (held.grid === grid) {
      // Same grid — move/swap/merge
      moveSlot(slots, held.idx, idx)
      setHeld(null)
      onChanged()
    } else {
      // Cross-grid transfer
      const src = held.grid === 'chest' ? chestSlots : invSlots
      const dst = grid === 'chest' ? chestSlots : invSlots
      transferItem(src, held.idx, dst, idx)
      setHeld(null)
      onChanged()
    }
  }, [held, chestSlots, invSlots, onChanged])

  const handleRightClick = useCallback((e: React.MouseEvent, grid: 'chest' | 'inv', idx: number) => {
    e.preventDefault()
    if (held !== null) { setHeld(null); return }
    const slots = grid === 'chest' ? chestSlots : invSlots
    if (slots[idx] && slots[idx]!.count > 1) {
      splitStack(slots, idx)
      onChanged()
    }
  }, [held, chestSlots, invSlots, onChanged])

  return (
    <div className="space-y-3 select-none">
      {/* Chest grid — adapts to slot count */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-text-faint/40 font-display uppercase tracking-wider">
            {chestLabel || 'Chest'}
          </span>
          {onPickupChest && (
            <button
              onClick={onPickupChest}
              className="text-[9px] text-text-faint/40 hover:text-[#d4a843] transition-colors font-display px-1.5 py-0.5 rounded border border-[#d4a843]/15 hover:border-[#d4a843]/30"
            >
              Pick Up
            </button>
          )}
        </div>
        <div className="grid grid-cols-5 gap-1 p-2 bg-[#16142a]/95 border border-[#d4a843]/20 rounded-lg">
          {Array.from({ length: chestSlots.length }).map((_, i) => (
            <SlotBtn
              key={`c-${i}`}
              item={chestSlots[i] ?? null}
              isHeld={held?.grid === 'chest' && held.idx === i}
              isTarget={held !== null && !(held.grid === 'chest' && held.idx === i)}
              onClick={() => handleClick('chest', i)}
              onRightClick={(e) => handleRightClick(e, 'chest', i)}
            />
          ))}
        </div>
      </div>

      {/* Inventory grid — 5x4 */}
      <div>
        <span className="text-[10px] text-text-faint/40 font-display uppercase tracking-wider mb-1.5 block">
          Your Bag
        </span>
        <div className="grid grid-cols-5 gap-1 p-2 bg-[#16142a]/95 border border-white/10 rounded-lg">
          {Array.from({ length: INVENTORY_SLOTS }).map((_, i) => (
            <SlotBtn
              key={`i-${i}`}
              item={invSlots[i] ?? null}
              isHeld={held?.grid === 'inv' && held.idx === i}
              isTarget={held !== null && !(held.grid === 'inv' && held.idx === i)}
              onClick={() => handleClick('inv', i)}
              onRightClick={(e) => handleRightClick(e, 'inv', i)}
            />
          ))}
        </div>
      </div>

      {held && (
        <p className="text-[8px] text-[#d4a843]/50 font-display text-center">
          Click a slot to place · Right-click to cancel
        </p>
      )}
    </div>
  )
}

function SlotBtn({ item, isHeld, isTarget, onClick, onRightClick }: {
  item: ItemStack | null
  isHeld: boolean
  isTarget: boolean
  onClick: () => void
  onRightClick: (e: React.MouseEvent) => void
}) {
  return (
    <button
      onClick={onClick}
      onContextMenu={onRightClick}
      className={`relative w-16 h-16 flex items-center justify-center overflow-hidden rounded transition-all
        ${isHeld
          ? 'border-2 border-[#d4a843]/60 bg-[#d4a843]/10 scale-95'
          : isTarget
            ? 'border border-white/15 bg-white/[0.04] hover:border-[#d4a843]/30'
            : item
              ? 'border border-white/8 bg-black/30 hover:border-white/15'
              : 'border border-dashed border-[#d4a843]/8 bg-black/20'
        }
      `}
    >
      {item && (
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
      )}
    </button>
  )
}
