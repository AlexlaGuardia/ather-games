'use client'
// RuneMark — a systematic glyph for each of the 20 runes, drawn from the CANON matrix:
// an ELEMENT base shape (Mana/Storm/Earth/Water) carrying a STATE motif (Solid/Compact/
// Expanding/Ignite/Flow/Scatter/Bind). It renders the rune's canon composition; it is NOT
// invented lore and is NOT a "sigil" (sigils = Lazerin's weapon mods, a separate canon
// system — never conflate). If Magii ever defines true rune glyphs, they supersede this.
//
// Pure SVG so it's crisp at any size and tints to the rune's canon color. Reused by the
// birth carousel and the in-world HUD rune badge.
import type { ElementId, Rune } from './runes.data'

// ── Element base shapes (viewBox 0 0 100 100, centered on 50,50) ──────────────
function ElementBase({ element, color }: { element: ElementId; color: string }) {
  const s = { fill: 'none', stroke: color, strokeWidth: 5, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  switch (element) {
    case 'mana':  // pure magic — an upright diamond
      return <path d="M50 14 L82 50 L50 86 L18 50 Z" {...s} />
    case 'storm': // angular energy — a downward chevron pair
      return <path d="M26 20 L50 44 L74 20 M26 50 L50 74 L74 50" {...s} />
    case 'earth': // grounded — a hexagon
      return <path d="M50 14 L82 32 L82 68 L50 86 L18 68 L18 32 Z" {...s} />
    case 'water': // fluid — a ring
      return <circle cx="50" cy="50" r="34" {...s} />
  }
}

// ── State motifs (overlaid on the base) ───────────────────────────────────────
function StateMotif({ state, color, core }: { state: string; color: string; core: string }) {
  const s = { fill: 'none', stroke: color, strokeWidth: 4.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (state) {
    case 'Solid':     // a filled core — dense, immovable
      return <circle cx="50" cy="50" r="11" fill={core} stroke={color} strokeWidth={3} />
    case 'Compact':   // nested inner shape — pressure inward
      return <circle cx="50" cy="50" r="16" {...s} />
    case 'Expanding': // radiating strokes — pushing outward
      return <g {...s}>{[0, 60, 120, 180, 240, 300].map((a) => {
        const r = (a * Math.PI) / 180
        return <line key={a} x1={50 + 8 * Math.cos(r)} y1={50 + 8 * Math.sin(r)} x2={50 + 26 * Math.cos(r)} y2={50 + 26 * Math.sin(r)} />
      })}</g>
    case 'Ignite':    // upward flame tongues — heat rising
      return <path d="M42 60 Q44 44 50 36 Q56 44 58 60 M50 58 Q50 48 50 42" {...s} fill="none" />
    case 'Flow':      // a wave through the center — motion
      return <path d="M28 50 Q39 36 50 50 Q61 64 72 50" {...s} />
    case 'Scatter':   // scattered particles
      return <g fill={color} stroke="none">{[[50,32],[36,46],[64,46],[42,64],[58,64],[50,52]].map(([x,y],i) => (
        <circle key={i} cx={x} cy={y} r={i === 5 ? 4.5 : 3} />
      ))}</g>
    case 'Bind':      // an enclosing ring — held in place
      return <g {...s}><circle cx="50" cy="50" r="13" /><line x1="50" y1="30" x2="50" y2="24" /><line x1="50" y1="70" x2="50" y2="76" /></g>
    default:
      return null
  }
}

export function RuneMark({ rune, size = 64 }: { rune: Rune; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={`${rune.name} rune mark`}
      style={{ filter: `drop-shadow(0 0 6px ${rune.glow}aa)`, overflow: 'visible' }}>
      <ElementBase element={rune.element} color={rune.glow} />
      <StateMotif state={rune.state} color={rune.glow} core={rune.core} />
    </svg>
  )
}

export default RuneMark
