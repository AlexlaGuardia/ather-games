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
import { HearthFrame } from '../ui/hearth'

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
 * Backdrop + card + the X. Since the Carved Hearth rollout (Phase 2, 2026-09-22) this IS the
 * hearth frame — every panel on PanelFrame changed skin in one commit. `width` is still the
 * card's Tailwind width class for the callers' sake; it is read as a max width (px) so a phone
 * gets the whole screen. `hearth-ink` opts the panel's legacy dark-plate utilities into the
 * TRANSITIONAL ink bridge (ui/hearth.css) until it is rewritten onto the kit — then pass
 * `legacy={false}`, and when no caller needs it the bridge is deleted.
 */
export function PanelFrame({ width, onClose, children, dataPanel, bodyClass = '', title, legacy = true }: {
  width: string
  onClose: () => void
  children: React.ReactNode
  /** Forwarded as `data-panel` on the card, for the harnesses that find a panel by name. */
  dataPanel?: string
  bodyClass?: string
  /** The carved plaque. */
  title?: string
  /** Still written for the dark plate — leans on the ink bridge. */
  legacy?: boolean
}) {
  const px = Number(/\[(\d+)px\]/.exec(width)?.[1] ?? 440)
  return (
    <HearthFrame title={title} maxWidth={Math.round(px * 1.12)} onClose={onClose} dataPanel={dataPanel}
                 className={legacy ? 'hearth-ink' : ''} bodyClass={`p-4 ${title ? 'pt-6' : 'pt-4'} text-[12px] ${bodyClass}`}>
      {children}
    </HearthFrame>
  )
}
