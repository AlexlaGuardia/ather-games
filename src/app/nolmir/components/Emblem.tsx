'use client'

// Room emblems — the clickable seals that link the three faces of Nolmir.
// Placeholder glyphs render until Alex's hand-drawn art lands at the
// sprite path (64x64, via the dropbox) — then each seal swaps itself.

import { useState } from 'react'

type Kind = 'crucible' | 'expeditions' | 'starforge'

const EMBLEM: Record<Kind, { src: string; glyph: string; tint: string }> = {
  crucible: {
    src: '/nolmir/sprites/emblem-crucible.png',
    glyph: '⬡',
    tint: 'border-red-900/60 text-red-400/90 group-hover:border-red-500/70 group-hover:text-red-300',
  },
  expeditions: {
    src: '/nolmir/sprites/emblem-expeditions.png',
    glyph: '✶',
    tint: 'border-violet-900/60 text-violet-400/90 group-hover:border-violet-500/70 group-hover:text-violet-300',
  },
  starforge: {
    src: '/nolmir/sprites/emblem-starforge.png',
    glyph: '◈',
    tint: 'border-sky-900/60 text-sky-400/90 group-hover:border-sky-500/70 group-hover:text-sky-300',
  },
}

export default function Emblem({ kind, href, label }: { kind: Kind; href: string; label: string }) {
  const [hasArt, setHasArt] = useState(true)
  const e = EMBLEM[kind]
  return (
    <a href={href} title={label} className="group flex flex-col items-center gap-1">
      <span
        className={`w-10 h-10 rounded-lg border bg-[#0b101c]/85 flex items-center justify-center text-xl transition-colors ${e.tint}`}
      >
        {hasArt ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={e.src}
            onError={() => setHasArt(false)}
            alt=""
            className="w-8 h-8 [image-rendering:pixelated]"
          />
        ) : (
          e.glyph
        )}
      </span>
      <span className="text-[8px] tracking-[0.2em] text-slate-600 group-hover:text-slate-400 transition-colors">
        {label}
      </span>
    </a>
  )
}
