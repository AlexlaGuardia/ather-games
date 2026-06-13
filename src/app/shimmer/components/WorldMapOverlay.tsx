'use client'

import { useState } from 'react'

interface MapNode {
  id: string
  x: number
  y: number
  label: string
}

// Layout of the world (relative coords 0-100)
const NODES: MapNode[] = [
  { id: 'garden', x: 50, y: 40, label: 'Shimmer Garden' },
  { id: 'mycelial-path', x: 22, y: 40, label: 'Mycelial Path' },
  { id: 'moonwell-glade', x: 50, y: 72, label: 'Moonwell Glade' },
  { id: 'spore-hollow', x: 78, y: 72, label: 'Spore Hollow' },
  { id: 'twilight-thicket', x: 78, y: 40, label: 'Twilight Thicket' },
  { id: 'mana-springs', x: 50, y: 14, label: 'Mana Springs' },
  { id: 'the-threshold', x: 22, y: 72, label: 'The Threshold' },
  { id: 'spirit-meadow', x: 22, y: 14, label: 'Spirit Meadow' },
]

// Connections [from, to]
const EDGES: [string, string][] = [
  ['garden', 'mycelial-path'],
  ['garden', 'moonwell-glade'],
  ['garden', 'twilight-thicket'],
  ['garden', 'mana-springs'],
  ['mycelial-path', 'the-threshold'],
  ['mycelial-path', 'spirit-meadow'],
  ['moonwell-glade', 'spore-hollow'],
]

interface WorldMapOverlayProps {
  currentZoneId: string
  flags: Record<string, boolean>
  onClose: () => void
  onWarp?: (zoneId: string) => void
}

export default function WorldMapOverlay({ currentZoneId, flags, onClose, onWarp }: WorldMapOverlayProps) {
  const [hoverNode, setHoverNode] = useState<string | null>(null)
  const hasGate = !!flags['atherGateReceived']

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative bg-[#16142a] border border-[#d4a843]/35 rounded-xl shadow-2xl shadow-black/50 w-[520px] h-[420px] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-10 pointer-events-none">
          <div>
            <h2 className="text-[#d4a843] font-display text-lg tracking-widest uppercase">Ather Map</h2>
            <p className="text-white/40 text-[12px] font-display">
              {hasGate ? 'Click a visited zone to travel' : 'Explore to discover new zones'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="pointer-events-auto bg-black/40 hover:bg-[#d4a843]/20 text-white/50 hover:text-[#d4a843] rounded px-3 py-1.5 text-[12px] font-display transition-colors border border-[#d4a843]/15"
          >
            Close
          </button>
        </div>

        {/* Map Canvas Area */}
        <div className="w-full h-full relative bg-[#050508]">
          {/* Grid Background */}
          <div
            className="absolute inset-0 opacity-8"
            style={{
              backgroundImage: 'linear-gradient(#d4a843 1px, transparent 1px), linear-gradient(90deg, #d4a843 1px, transparent 1px)',
              backgroundSize: '24px 24px'
            }}
          />

          {/* Edges */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {EDGES.map(([a, b], i) => {
              const nodeA = NODES.find(n => n.id === a)
              const nodeB = NODES.find(n => n.id === b)
              if (!nodeA || !nodeB) return null
              const aVisited = a === 'garden' || !!flags[`visited_${a}`]
              const bVisited = b === 'garden' || !!flags[`visited_${b}`]
              const bothVisited = aVisited && bVisited
              return (
                <line
                  key={i}
                  x1={`${nodeA.x}%`} y1={`${nodeA.y}%`}
                  x2={`${nodeB.x}%`} y2={`${nodeB.y}%`}
                  stroke="#d4a843"
                  strokeWidth="2"
                  strokeOpacity={bothVisited ? 0.35 : aVisited || bVisited ? 0.15 : 0.06}
                  strokeDasharray={bothVisited ? '0' : '4 4'}
                />
              )
            })}
          </svg>

          {/* Nodes */}
          {NODES.map(node => {
            const isCurrent = node.id === currentZoneId
            const visited = node.id === 'garden' || !!flags[`visited_${node.id}`]
            const isHover = hoverNode === node.id
            const canWarp = hasGate && visited && !isCurrent && !!onWarp

            return (
              <div
                key={node.id}
                className={`absolute transform -translate-x-1/2 -translate-y-1/2 group ${canWarp ? 'cursor-pointer' : visited ? 'cursor-default' : 'cursor-not-allowed'}`}
                style={{ left: `${node.x}%`, top: `${node.y}%` }}
                onMouseEnter={() => setHoverNode(node.id)}
                onMouseLeave={() => setHoverNode(null)}
                onClick={() => { if (canWarp) onWarp(node.id) }}
              >
                {/* Pulse ring for current location */}
                {isCurrent && (
                  <div className="absolute inset-0 -m-4 rounded-full border border-[#d4a843]/50 animate-ping opacity-50" />
                )}

                {/* Node Dot */}
                <div
                  className={`w-5 h-5 rounded-full border-2 transition-all duration-300 ${
                    isCurrent ? 'bg-[#d4a843] border-white shadow-[0_0_15px_rgba(212,168,67,0.6)]' :
                    canWarp && isHover ? 'bg-[#d4a843]/80 border-[#d4a843] shadow-[0_0_10px_rgba(212,168,67,0.3)]' :
                    visited ? 'bg-[#d4a843]/30 border-[#d4a843]/50' :
                    'bg-[#16142a] border-white/15'
                  }`}
                />

                {/* Label */}
                <div className={`absolute top-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-center transition-all ${
                  isCurrent || isHover ? 'opacity-100 scale-100' : visited ? 'opacity-70 scale-95' : 'opacity-30 scale-90'
                }`}>
                  <span className={`font-display text-[12px] tracking-wide px-2.5 py-1 rounded bg-black/60 backdrop-blur-sm border ${
                    isCurrent ? 'text-[#d4a843] border-[#d4a843]/20' :
                    canWarp && isHover ? 'text-[#d4a843] border-[#d4a843]/30' :
                    visited ? 'text-white/70 border-white/10' :
                    'text-white/30 border-white/5'
                  }`}>
                    {visited ? node.label : '???'}
                  </span>
                  {isCurrent && (
                    <div className="text-[12px] text-[#d4a843]/60 font-display mt-1 animate-pulse">YOU ARE HERE</div>
                  )}
                  {canWarp && isHover && !isCurrent && (
                    <div className="text-[12px] text-[#d4a843]/80 font-display mt-1">Click to travel</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-[#16142a]/90 border-t border-[#d4a843]/15 flex justify-between items-center">
          <span className="text-[12px] text-white/30 font-display">
            {hasGate ? 'Ather Gate active' : 'Visit Gregory to unlock fast travel'}
          </span>
          <span className="text-[12px] text-white/20 font-display">
            {NODES.filter(n => n.id === 'garden' || flags[`visited_${n.id}`]).length}/{NODES.length} discovered
          </span>
        </div>
      </div>
    </div>
  )
}
