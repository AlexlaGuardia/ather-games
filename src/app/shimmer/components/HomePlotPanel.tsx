'use client'
import { useState } from 'react'
import type { FurnitureDef } from '../sprites/furniture'
import type { TileGroup } from '../world/structures'

interface HomePlotPanelProps {
  furniture: FurnitureDef[]
  structures: TileGroup[]
  selectedItem: { type: 'furniture' | 'structure'; id: string } | null
  selectedPlacedFurnId: string | null
  selectedPlacedStructId: string | null
  onSelectItem: (item: { type: 'furniture' | 'structure'; id: string } | null) => void
  onRemoveFurniture: (id: string) => void
  onRemoveStructure: (id: string) => void
  onClose: () => void
  isMobile: boolean
}

const TAB_FURNITURE = 'furniture'
const TAB_STRUCTURES = 'structures'

export default function HomePlotPanel({
  furniture,
  structures,
  selectedItem,
  selectedPlacedFurnId,
  selectedPlacedStructId,
  onSelectItem,
  onRemoveFurniture,
  onRemoveStructure,
  onClose,
  isMobile,
}: HomePlotPanelProps) {
  const [tab, setTab] = useState<'furniture' | 'structures'>(TAB_FURNITURE)

  const hasStructures = structures.length > 0
  const hasSelectedPlaced = selectedPlacedFurnId || selectedPlacedStructId

  const containerClass = isMobile
    ? 'absolute bottom-0 left-0 right-0 z-30 rounded-t-xl border-t border-[#d4a843]/25 max-h-[48%] flex flex-col'
    : 'absolute top-0 left-0 z-30 h-full w-[200px] border-r border-[#d4a843]/25 flex flex-col'

  return (
    <div
      className={containerClass}
      style={{ background: 'rgba(22, 20, 42, 0.97)', backdropFilter: 'blur(4px)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#d4a843]/15 flex-shrink-0">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M3 13l3-3 7-7-3-3-7 7-3 3h3ZM10 3l3 3" stroke="#d4a843" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="font-display text-[#d4a843] text-xs tracking-widest uppercase">Home Plot</span>
        </div>
        <button
          onClick={onClose}
          className="text-text-faint/40 hover:text-text-faint/80 transition-colors p-0.5"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Tabs (only if structures exist) */}
      {hasStructures && (
        <div className="flex border-b border-[#d4a843]/10 flex-shrink-0">
          <button
            onClick={() => setTab(TAB_FURNITURE)}
            className={`flex-1 py-1.5 text-[11px] font-display tracking-wider transition-colors ${
              tab === TAB_FURNITURE ? 'text-[#d4a843] border-b border-[#d4a843]' : 'text-text-faint/40'
            }`}
          >
            Furniture
          </button>
          <button
            onClick={() => setTab(TAB_STRUCTURES)}
            className={`flex-1 py-1.5 text-[11px] font-display tracking-wider transition-colors ${
              tab === TAB_STRUCTURES ? 'text-[#d4a843] border-b border-[#d4a843]' : 'text-text-faint/40'
            }`}
          >
            Structures
          </button>
        </div>
      )}

      {/* Hint */}
      <div className="px-3 py-1.5 flex-shrink-0">
        <p className="text-[10px] text-text-faint/30 leading-tight">
          {selectedItem
            ? `Tap tile to place — ${selectedItem.type === 'furniture'
                ? furniture.find(f => f.id === selectedItem.id)?.name ?? selectedItem.id
                : structures.find(s => s.id === selectedItem.id)?.name ?? selectedItem.id}`
            : 'Select an item to place it'}
        </p>
      </div>

      {/* Item list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 min-h-0">
        {tab === TAB_FURNITURE && (
          <div className="flex flex-col gap-0.5">
            {furniture.map(furn => {
              const isSelected = selectedItem?.type === 'furniture' && selectedItem.id === furn.id
              return (
                <button
                  key={furn.id}
                  onClick={() => onSelectItem(isSelected ? null : { type: 'furniture', id: furn.id })}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-all ${
                    isSelected
                      ? 'bg-[#d4a843]/20 text-[#d4a843] ring-1 ring-[#d4a843]/50'
                      : 'text-text-faint/60 hover:bg-[#d4a843]/8 hover:text-text-faint/80'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isSelected ? 'bg-[#d4a843]' : 'bg-text-faint/20'}`} />
                  <span className="text-[12px] font-display leading-tight">{furn.name}</span>
                </button>
              )
            })}
          </div>
        )}

        {tab === TAB_STRUCTURES && (
          <div className="flex flex-col gap-0.5">
            {structures.length === 0 && (
              <p className="text-[11px] text-text-faint/30 px-2 py-4 text-center">No structures available</p>
            )}
            {structures.map(struct => {
              const isSelected = selectedItem?.type === 'structure' && selectedItem.id === struct.id
              return (
                <button
                  key={struct.id}
                  onClick={() => onSelectItem(isSelected ? null : { type: 'structure', id: struct.id })}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-all ${
                    isSelected
                      ? 'bg-[#d4a843]/20 text-[#d4a843] ring-1 ring-[#d4a843]/50'
                      : 'text-text-faint/60 hover:bg-[#d4a843]/8 hover:text-text-faint/80'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isSelected ? 'bg-[#d4a843]' : 'bg-text-faint/20'}`} />
                  <div className="flex flex-col min-w-0">
                    <span className="text-[12px] font-display leading-tight truncate">{struct.name}</span>
                    <span className="text-[10px] text-text-faint/30">{struct.cols}×{struct.rows}</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Remove selected placed item */}
      {hasSelectedPlaced && (
        <div className="border-t border-[#d4a843]/10 px-3 py-2 flex-shrink-0">
          <button
            onClick={() => {
              if (selectedPlacedFurnId) onRemoveFurniture(selectedPlacedFurnId)
              else if (selectedPlacedStructId) onRemoveStructure(selectedPlacedStructId)
            }}
            className="w-full py-1.5 rounded-lg text-[12px] font-display text-red-400/80 border border-red-400/20 hover:bg-red-400/10 transition-colors"
          >
            Remove Selected
          </button>
        </div>
      )}
    </div>
  )
}
