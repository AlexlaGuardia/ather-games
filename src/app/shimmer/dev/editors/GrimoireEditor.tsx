'use client'

import { useState, useMemo } from 'react'
import { GRIMOIRE, getEntriesBySpecies, type GrimoireEntry, type FormStage } from '../../spirits/grimoire'
import { SPECIES_NAMES, SECOND_FORM_NAMES, ELEMENTS, ELEMENT_COLORS, type Species } from '../../spirits/spirit'
import { ALL_SPECIES } from '../../engine/spirit-index'
import { getMovesForSpirit, SPECIES_SIGNATURES, ELEMENT_STARTERS, ELEMENT_MID, ELEMENT_HIGH, ALL_MOVES, type Move } from '../../engine/moves'
import { EVOLUTION_THRESHOLDS } from '../../spirits/evolution-config'
import { VARIANT_CLASSES, VARIANT_CLASS_DEFS, getVariantRates } from '../../sprites/variants'
import EditorShell from '../templates/EditorShell'

const FORM_COLORS: Record<FormStage, string> = {
  base: 'text-white/60',
  second: 'text-amber-400/70',
  awakened: 'text-violet-400/70',
}

const ELEMENT_BG: Record<string, string> = {
  mana: 'bg-blue-500/10 border-blue-400/20',
  storm: 'bg-yellow-500/10 border-yellow-400/20',
  earth: 'bg-green-500/10 border-green-400/20',
  water: 'bg-cyan-500/10 border-cyan-400/20',
}

function MoveCard({ move }: { move: Move }) {
  const elColor = ELEMENT_COLORS[move.element as keyof typeof ELEMENT_COLORS] ?? '#888'
  return (
    <div className={`rounded-lg p-2.5 border ${ELEMENT_BG[move.element] ?? 'bg-white/5 border-white/10'}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-display text-white/90">{move.name}</span>
        <span className="text-[8px] font-mono uppercase tracking-wider" style={{ color: elColor }}>{move.element}</span>
      </div>
      <div className="flex items-center gap-3 text-[9px] text-white/40 mb-1">
        {move.power > 0 && <span>PWR {move.power}</span>}
        {move.power === 0 && <span className="text-violet-400/50">Status</span>}
        <span>ACC {move.accuracy}</span>
        <span>{move.pp}pp</span>
        <span className="capitalize text-white/25">{move.state}</span>
      </div>
      <p className="text-[9px] text-white/30 leading-relaxed">{move.description}</p>
    </div>
  )
}

export default function GrimoireEditor() {
  const [selectedSpecies, setSelectedSpecies] = useState<Species>('fox')
  const [selectedElement, setSelectedElement] = useState<string>('mana')
  const [previewLevel, setPreviewLevel] = useState(25)

  const speciesName = SPECIES_NAMES[selectedSpecies] ?? selectedSpecies
  const entries = useMemo(() => getEntriesBySpecies(selectedSpecies), [selectedSpecies])
  const baseEntry = entries.find(e => e.form === 'base')
  const secondForms = entries.filter(e => e.form === 'second')
  const awakenedForms = entries.filter(e => e.form === 'awakened')

  // Move progression for this species + element at preview level
  const moves = useMemo(() =>
    getMovesForSpirit(selectedSpecies, selectedElement as any, previewLevel, 60),
    [selectedSpecies, selectedElement, previewLevel]
  )

  // Signature move for this species + element
  const signature = SPECIES_SIGNATURES[selectedSpecies]?.[selectedElement as keyof typeof SPECIES_SIGNATURES[typeof selectedSpecies]]

  // Evolution thresholds
  const evoThresh = EVOLUTION_THRESHOLDS

  // Second form name
  const secondFormName = SECOND_FORM_NAMES[selectedSpecies]?.[selectedElement as keyof typeof SECOND_FORM_NAMES[typeof selectedSpecies]]

  return (
    <EditorShell title="Grimoire" subtitle="spirit encyclopedia — profiles, moves, evolution">
      <div className="flex gap-6">
        {/* Left sidebar — species list */}
        <div className="w-48 shrink-0 space-y-1">
          <p className="text-[9px] text-white/20 font-display uppercase tracking-wider mb-2">Species</p>
          {ALL_SPECIES.map(sp => (
            <button
              key={sp}
              onClick={() => setSelectedSpecies(sp)}
              className={`w-full text-left px-3 py-1.5 rounded-lg text-[11px] font-display transition-all ${
                selectedSpecies === sp
                  ? 'bg-[#d4a843]/10 text-[#d4a843] border border-[#d4a843]/20'
                  : 'text-white/50 hover:text-white/70 hover:bg-white/5 border border-transparent'
              }`}
            >
              <span className="font-mono text-[8px] text-white/20 mr-2">
                #{String((ALL_SPECIES.indexOf(sp) + 1)).padStart(3, '0')}
              </span>
              {SPECIES_NAMES[sp] ?? sp}
            </button>
          ))}
        </div>

        {/* Main content */}
        <div className="flex-1 space-y-6 min-w-0">
          {/* Header */}
          <div>
            <h2 className="text-2xl font-display text-white/90">{speciesName}</h2>
            <p className="text-[10px] text-white/30 mt-1">
              #{String(baseEntry?.number ?? 0).padStart(3, '0')} {'\u00B7'} {entries.length} forms {'\u00B7'}
              {' '}{secondForms.length} evolutions {'\u00B7'} {awakenedForms.length} awakenings
            </p>
          </div>

          {/* Element selector */}
          <div>
            <p className="text-[9px] text-white/20 font-display uppercase tracking-wider mb-2">Element</p>
            <div className="flex gap-2">
              {ELEMENTS.map(el => (
                <button
                  key={el}
                  onClick={() => setSelectedElement(el)}
                  className={`px-3 py-1 rounded text-[10px] font-display capitalize transition-all border ${
                    selectedElement === el
                      ? `${ELEMENT_BG[el] ?? 'bg-white/10 border-white/20'} text-white/90`
                      : 'border-white/5 text-white/30 hover:text-white/50'
                  }`}
                  style={selectedElement === el ? { color: ELEMENT_COLORS[el as keyof typeof ELEMENT_COLORS] } : undefined}
                >
                  {el}
                </button>
              ))}
            </div>
          </div>

          {/* Evolution chain */}
          <div>
            <p className="text-[9px] text-white/20 font-display uppercase tracking-wider mb-2">Evolution Chain</p>
            <div className="flex items-center gap-3">
              <div className="rounded-lg p-3 bg-white/5 border border-white/10 text-center min-w-[100px]">
                <p className="text-[11px] font-display text-white/70">{speciesName}</p>
                <p className={`text-[8px] ${FORM_COLORS.base}`}>Base</p>
              </div>
              <div className="text-white/15 text-[10px]">
                <span>Lv {evoThresh.secondFormLevel}</span>
                <span className="mx-1">{'\u2192'}</span>
              </div>
              <div className={`rounded-lg p-3 border text-center min-w-[100px] ${ELEMENT_BG[selectedElement] ?? 'bg-white/5 border-white/10'}`}>
                <p className="text-[11px] font-display text-white/80">{secondFormName ?? '???'}</p>
                <p className={`text-[8px] ${FORM_COLORS.second}`}>2nd Form</p>
              </div>
              <div className="text-white/15 text-[10px]">
                <span>Lv {evoThresh.awakenedFormLevel}</span>
                <span className="mx-1">{'\u2192'}</span>
              </div>
              <div className="rounded-lg p-3 bg-violet-500/5 border border-violet-400/15 text-center min-w-[100px]">
                <p className="text-[11px] font-display text-violet-300/70">Awakened</p>
                <p className={`text-[8px] ${FORM_COLORS.awakened}`}>4 branches</p>
              </div>
            </div>
          </div>

          {/* Moves */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[9px] text-white/20 font-display uppercase tracking-wider">
                Moves at Level {previewLevel}
              </p>
              <input
                type="range"
                min={1}
                max={50}
                value={previewLevel}
                onChange={e => setPreviewLevel(parseInt(e.target.value))}
                className="w-32 accent-[#d4a843]"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {moves.map(move => (
                <MoveCard key={move.id} move={move} />
              ))}
              {moves.length === 0 && (
                <p className="text-[10px] text-white/20 col-span-2">No moves at this level</p>
              )}
            </div>
          </div>

          {/* Signature Move */}
          {signature && (
            <div>
              <p className="text-[9px] text-white/20 font-display uppercase tracking-wider mb-2">
                Signature Move <span className="text-white/10">(Bond 50+)</span>
              </p>
              <MoveCard move={signature} />
            </div>
          )}

          {/* Variant Classes */}
          <div>
            <p className="text-[9px] text-white/20 font-display uppercase tracking-wider mb-2">Variant Classes</p>
            <div className="flex gap-2">
              {VARIANT_CLASSES.map(vc => {
                const def = VARIANT_CLASS_DEFS[vc]
                const rates = getVariantRates(selectedSpecies)
                const rate = rates?.[vc]?.encounterRate ?? 0
                return (
                  <div key={vc} className="rounded-lg p-2.5 bg-white/[0.03] border border-white/5 flex-1 text-center">
                    <p className="text-[10px] font-display text-white/60 capitalize">{vc}</p>
                    <p className="text-[8px] text-white/25 mt-0.5">{def.description}</p>
                    <p className="text-[9px] text-white/20 mt-0.5">{(rate * 100).toFixed(1)}%</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </EditorShell>
  )
}
