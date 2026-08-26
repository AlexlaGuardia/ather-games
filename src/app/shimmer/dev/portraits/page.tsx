'use client'

// ── /shimmer/dev/portraits — every locked spirit portrait, in the states the grimoire draws ────
//
// ★ WHY A PAGE AND NOT A CONTACT SHEET. The grimoire tab sits behind the in-world menu, so the
// only way to see a portrait was to load the world, open the book and click a species. That is too
// far to walk for an art judgement, and this panel has the exact failure history that justifies a
// looking-glass: the sprites lane shipped two defects this week that were green in tsc AND in their
// own runtime guard, and only a screenshot caught either.
//
// ★ OWNER-GATED FOR FREE. `proxy.ts` blocks /shimmer/dev/*, so this needs no auth of its own — the
// same thing that gates /shimmer/dev/icons.
//
// ⚠ IT RENDERS THE THREE STATES, not just the happy one. An art review that only ever sees the
// painted case cannot judge the two states a player spends most of their time looking at.

import { useState } from 'react'
import { SPIRIT_ART } from '../../voxel3d/spirit-art'
import { ALL_SPECIES } from '../../engine/spirit-index'
// ⚠ THE SOCKET AND THE COLOURS ARE IMPORTED, NEVER RESTATED. The first version of this page kept
// its own copy of both. A review surface that draws its own approximation of what the game draws
// is worse than no review surface: it does not merely go stale, it manufactures confidence.
import { Portrait } from '../../voxel3d/spirit-portrait'
import { SPECIES_NAMES, ELEMENT_COLORS } from '../../spirits/spirit'

const ELEMENTS = ['mana', 'storm', 'earth', 'water'] as const
const GROUNDS = [
  { id: 'panel', label: 'panel', css: '#16171c' },
  { id: 'night', label: 'night', css: '#07070c' },
  { id: 'parchment', label: 'parchment', css: '#d8cdb4' },
] as const

export default function PortraitsPage() {
  // The grimoire draws over a dark panel, but this art was painted for a BOOK. Switching the ground
  // is why /shimmer/dev/icons exists, and it is the same reason here: this HUD has shipped art
  // invisible against what was behind it before.
  const [ground, setGround] = useState<string>('panel')
  const [lit, setLit] = useState(true)
  const bg = GROUNDS.find(g => g.id === ground)?.css ?? '#16171c'
  const locked = Object.keys(SPIRIT_ART).length

  return (
    <div className="gx-chrome min-h-screen p-6" style={{ background: bg }}>
      <div className="mb-4 flex items-center gap-3">
        <h1 className="gx-title text-[15px] text-white/85">Spirit portraits</h1>
        <span className="gx-value text-[11px] tabular-nums text-white/45">{locked} locked</span>
        <span className="ml-auto flex items-center gap-2">
          {GROUNDS.map(g => (
            <button key={g.id} onClick={() => setGround(g.id)}
                    className={`gx-btn gx-label px-2 py-1 text-[9px] ${ground === g.id ? 'gx-active' : 'gx-inactive'}`}>
              {g.label}
            </button>
          ))}
          <button onClick={() => setLit(v => !v)}
                  className={`gx-btn gx-label px-2 py-1 text-[9px] ${lit ? 'gx-active' : 'gx-inactive'}`}>
            {lit ? 'known' : 'unmet'}
          </button>
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {ALL_SPECIES.map(sp => (
          <div key={sp} className="gx-card flex items-center gap-4 rounded p-3">
            <Portrait artKey={sp} color={ELEMENT_COLORS.base} lit={lit} size={64} />
            <span className="gx-value w-28 text-[12px] text-white/80">{SPECIES_NAMES[sp] ?? sp}</span>
            {ELEMENTS.map(el => {
              const key = `${sp}:${el}`
              return (
                <span key={el} className="flex flex-col items-center gap-1">
                  <Portrait artKey={key} color={ELEMENT_COLORS[el]} lit={lit} size={48} />
                  <span className="gx-label text-[8px] text-white/35">{el}</span>
                  {/* An awakened branch with no lock yet draws the empty frame — that is the state
                      110 of the 160 awakened forms are in, and it must be judged too. */}
                  <span className="flex gap-0.5">
                    {['alpha', 'beta', 'gamma', 'delta'].map(br => (
                      <Portrait key={br} artKey={`${sp}:${el}:${br}`} color={ELEMENT_COLORS[el]} lit={lit} size={14} />
                    ))}
                  </span>
                </span>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
