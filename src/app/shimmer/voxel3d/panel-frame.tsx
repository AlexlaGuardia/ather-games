'use client'
// The panel frame — one modal shape for every in-world panel, and the X that does not scroll.
//
// ── ★ WHY (2026-09-18, Alex: "id like to start replacing all these esc buttons we have been
//    leaving around with an X icon that doesnt scroll") ─────────────────────────────────────────
// Every panel had grown its own head row with a text button reading `esc` at the right end, and
// every one of those heads lived INSIDE the panel's scroll box — so on a long tab (pieces, the
// station's shared list) the way out scrolled off the top with the title. The keyboard still
// closed it, but a button that says "esc" and is not there when you look for it is worse than no
// button: it teaches that the corner is empty.
//
// So the X sits on a wrapper AROUND the scroll box, not in it: `PanelFrame` is [backdrop] →
// [relative card: CloseX + scroll body]. The X is positioned against the card, the body scrolls
// under it, and it is the same glyph in the same corner on every panel. A panel with its own skin
// (the gx-* cards) uses `CloseX` alone inside its own relative wrapper — the glyph and the corner
// are the contract, the frame is a convenience.
import React from 'react'

/** The close glyph: a real X, drawn (no font fallback risk), pinned to the card's top-right corner. */
export function CloseX({ onClick, className = '' }: { onClick: () => void; className?: string }) {
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); onClick() }} title="close (esc)" aria-label="close"
            className={`absolute top-2 right-2 z-30 w-6 h-6 grid place-items-center rounded border border-white/15 bg-black/60 text-white/55 hover:text-white hover:border-white/50 transition-colors ${className}`}>
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
        <path d="M1.5 1.5 L8.5 8.5 M8.5 1.5 L1.5 8.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      </svg>
    </button>
  )
}

/**
 * Backdrop + card + the X. `width` is the card's Tailwind width class; the body is the scroll box
 * (max 80vh) with the panel's standard skin, so a panel only writes its content.
 */
export function PanelFrame({ width, onClose, children, dataPanel, bodyClass = '' }: {
  width: string
  onClose: () => void
  children: React.ReactNode
  /** Forwarded as `data-panel` on the card, for the harnesses that find a panel by name. */
  dataPanel?: string
  bodyClass?: string
}) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-black/50 pointer-events-auto" onClick={onClose}>
      <div data-panel={dataPanel} className={`relative ${width}`} onClick={(e) => e.stopPropagation()}>
        <CloseX onClick={onClose} />
        <div className={`max-h-[80vh] overflow-y-auto bg-[#0e1018]/95 border border-white/12 rounded-lg p-4 font-mono text-[11px] ${bodyClass}`}>
          {children}
        </div>
      </div>
    </div>
  )
}
