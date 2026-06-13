'use client'

import { useMemo } from 'react'
import {
  SPECIES_NAMES, SECOND_FORM_NAMES, ELEMENT_COLORS, ELEMENTS,
  type Species,
} from '../../spirits/spirit'
import {
  EVOLUTION_THRESHOLDS, STAT_CAPS, INFUSION_CAPS,
  ELEMENT_STAT_MODS, RUNEWORDS, AWAKENED_BRANCHES, AWAKENED_FORM_NAMES,
  type AwakenedBranch,
} from '../../spirits/evolution-config'
import {
  MOVE_MANA_PULSE, MOVE_SPIRIT_WARD,
  ELEMENT_STARTERS, ELEMENT_MID, ELEMENT_HIGH,
  SPECIES_SIGNATURES,
  type Move, type BattleElement,
} from '../../engine/moves'

interface Props {
  species: string
}

const BRANCH_ORDER: AwakenedBranch[] = ['alpha', 'beta', 'gamma', 'delta']

function MoveChip({ move, element }: { move: Move; element?: string }) {
  const color = element ? ELEMENT_COLORS[element as keyof typeof ELEMENT_COLORS] : '#94a3b8'
  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 border border-white/5">
      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
      <span className="text-[10px] text-white/70 font-display">{move.name}</span>
      {move.power > 0 && <span className="text-[8px] text-white/25 tabular-nums">{move.power}p</span>}
    </div>
  )
}

export default function SpiritConfig({ species }: Props) {
  const sp = species as Species
  const canon = SPECIES_NAMES[sp] ?? species
  const secondForms = SECOND_FORM_NAMES[sp]
  const runewords = RUNEWORDS[sp]
  const awakenedNames = AWAKENED_FORM_NAMES[sp]
  const signatures = SPECIES_SIGNATURES[sp]

  // Build move progression table
  const moveProgression = useMemo(() => {
    const rows: { level: string; condition: string; moves: { move: Move; element?: string }[] }[] = []

    rows.push({
      level: 'Lv 1',
      condition: 'Base form',
      moves: [
        { move: MOVE_MANA_PULSE },
        { move: MOVE_SPIRIT_WARD },
      ],
    })

    for (const el of ELEMENTS) {
      const elKey = el as Exclude<BattleElement, 'neutral'>
      const starter = ELEMENT_STARTERS[elKey]
      if (starter) {
        rows.push({
          level: 'Evolve',
          condition: `${el} evolution`,
          moves: [{ move: starter, element: el }],
        })
      }
    }

    for (const el of ELEMENTS) {
      const elKey = el as Exclude<BattleElement, 'neutral'>
      const mid = ELEMENT_MID[elKey]
      if (mid) {
        rows.push({
          level: 'Lv 15+',
          condition: `${el} mid-tier`,
          moves: [{ move: mid, element: el }],
        })
      }
    }

    for (const el of ELEMENTS) {
      const elKey = el as Exclude<BattleElement, 'neutral'>
      const high = ELEMENT_HIGH[elKey]
      if (high) {
        rows.push({
          level: 'Lv 25+',
          condition: `${el} high-tier`,
          moves: [{ move: high, element: el }],
        })
      }
    }

    for (const el of ELEMENTS) {
      const elKey = el as Exclude<BattleElement, 'neutral'>
      const sig = signatures?.[elKey]
      if (sig) {
        rows.push({
          level: 'Bond 50',
          condition: `${el} signature`,
          moves: [{ move: sig, element: el }],
        })
      }
    }

    return rows
  }, [signatures])

  return (
    <div className="space-y-6">
      <div className="flex items-baseline gap-3">
        <p className="text-text-faint text-[10px] uppercase tracking-widest">Spirit Config</p>
        <span className="text-[10px] text-white/20 font-mono">{species}</span>
      </div>

      {/* Evolution Thresholds (global, read-only) */}
      <div className="bg-white/[0.02] rounded-lg border border-white/5 p-4">
        <div className="flex items-center gap-2 mb-3">
          <p className="text-[10px] text-white/40 uppercase tracking-wider">Evolution</p>
          <span className="text-[8px] text-white/15 italic">global thresholds</span>
        </div>
        <div className="flex gap-6 text-[10px]">
          <div>
            <span className="text-white/25 block">2nd Form</span>
            <span className="text-white/60 font-display">Lv {EVOLUTION_THRESHOLDS.secondFormLevel}</span>
          </div>
          <div>
            <span className="text-white/25 block">Awakened</span>
            <span className="text-white/60 font-display">Lv {EVOLUTION_THRESHOLDS.awakenedFormLevel}</span>
          </div>
          <div>
            <span className="text-white/25 block">Max Level</span>
            <span className="text-white/60 font-display">{EVOLUTION_THRESHOLDS.maxLevel}</span>
          </div>
          <div>
            <span className="text-white/25 block">Infusions</span>
            <span className="text-white/60 font-display">{INFUSION_CAPS.totalCap} total / {INFUSION_CAPS.perElementCap} per</span>
          </div>
          <div>
            <span className="text-white/25 block">Stat Caps</span>
            <span className="text-white/60 font-display">{STAT_CAPS.base} / {STAT_CAPS.second} / {STAT_CAPS.awakened}</span>
          </div>
        </div>
      </div>

      {/* Second Forms + Runewords per element */}
      <div className="bg-white/[0.02] rounded-lg border border-white/5 p-4">
        <p className="text-[10px] text-white/40 uppercase tracking-wider mb-3">
          Second Forms — {canon}
        </p>
        <div className="grid grid-cols-4 gap-3">
          {ELEMENTS.map(el => {
            const formName = secondForms?.[el] ?? '—'
            const runeword = runewords?.[el] ?? '?'
            const statMods = ELEMENT_STAT_MODS[el]
            return (
              <div
                key={el}
                className="rounded-lg border p-3 bg-white/[0.02]"
                style={{ borderColor: ELEMENT_COLORS[el] + '30' }}
              >
                <div className="text-center mb-2">
                  <span className="font-display text-[11px] capitalize" style={{ color: ELEMENT_COLORS[el] }}>
                    {el}
                  </span>
                </div>
                <div className="text-center mb-1">
                  <span className="text-[10px] text-white/60 font-display">{formName}</span>
                </div>
                <div className="text-center mb-2">
                  <span className="text-[8px] text-white/20 italic">Runeword: {runeword}</span>
                </div>
                <div className="flex justify-center gap-2">
                  {statMods.map(m => (
                    <span key={m.stat} className="text-[8px] font-mono text-white/30 uppercase">
                      +{Math.round((m.mod - 1) * 100)}% {m.stat}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Move Progression */}
      <div className="bg-white/[0.02] rounded-lg border border-white/5 p-4">
        <div className="flex items-center gap-2 mb-3">
          <p className="text-[10px] text-white/40 uppercase tracking-wider">Move Progression</p>
          <span className="text-[8px] text-white/15 italic">4 active slots, last 4 learned</span>
        </div>
        <div className="space-y-1.5">
          {moveProgression.map((row, i) => (
            <div key={i} className="flex items-center gap-3 py-1">
              <span className="text-[9px] text-white/30 font-mono w-14 shrink-0 text-right">{row.level}</span>
              <span className="text-[9px] text-white/20 w-28 shrink-0">{row.condition}</span>
              <div className="flex flex-wrap gap-1">
                {row.moves.map((m, j) => (
                  <MoveChip key={j} move={m.move} element={m.element} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Awakened Branches */}
      <div className="bg-white/[0.02] rounded-lg border border-white/5 p-4">
        <div className="flex items-center gap-2 mb-3">
          <p className="text-[10px] text-white/40 uppercase tracking-wider">Awakened Forms</p>
          <span className="text-[8px] text-white/15 italic">Lv {EVOLUTION_THRESHOLDS.awakenedFormLevel}+ &middot; 4 branches &times; 4 elements = 16 forms</span>
        </div>

        {/* Branch headers */}
        <div className="grid grid-cols-[80px_1fr_1fr_1fr_1fr] gap-2 mb-2">
          <div />
          {ELEMENTS.map(el => (
            <div key={el} className="text-center text-[9px] font-display capitalize" style={{ color: ELEMENT_COLORS[el] }}>
              {el}
            </div>
          ))}
        </div>

        {/* Branch rows */}
        {BRANCH_ORDER.map(branch => {
          const bd = AWAKENED_BRANCHES[branch]
          return (
            <div key={branch} className="grid grid-cols-[80px_1fr_1fr_1fr_1fr] gap-2 py-1.5 border-t border-white/5">
              <div className="text-right pr-2">
                <span className="text-[9px] text-white/40 font-display">{bd.name}</span>
                <span className="text-[7px] text-white/15 block">{bd.focus}</span>
              </div>
              {ELEMENTS.map(el => {
                const name = awakenedNames?.[el]?.[branch]
                return (
                  <div key={el} className="text-center">
                    <span className={`text-[9px] ${name ? 'text-white/50' : 'text-white/15 italic'}`}>
                      {name ?? '—'}
                    </span>
                  </div>
                )
              })}
            </div>
          )
        })}

        {/* Branch prereqs */}
        <div className="mt-3 pt-3 border-t border-white/5 space-y-1">
          {BRANCH_ORDER.map(branch => (
            <div key={branch} className="flex gap-2 text-[8px]">
              <span className="text-white/25 w-16 text-right shrink-0">{AWAKENED_BRANCHES[branch].name}</span>
              <span className="text-white/15">{AWAKENED_BRANCHES[branch].prereqSummary}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
