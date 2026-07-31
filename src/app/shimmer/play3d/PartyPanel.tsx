'use client'
// ── The party panel (P) — the lineup, and who each one actually is ─────────────
//
// play3d had NO spirit roster at all before this: you could raise a spirit for hours and never see
// its stats, its moves, or a word about what it is. Everything the game knew about your party was
// only visible for the 30 seconds it was on the battlefield.
//
// Two panes. LINEUP is the roster — one card per spirit, borrowing the arena team-card language
// (element accent, element dot, banded HP, Lv) so a spirit reads the same in the menu as it does in
// a fight. DETAIL is the dossier for whichever one you clicked.
//
// This file renders; it does not decide. Mending, lead order and persistence are the caller's —
// the panel is handed a party and a salve count and calls back. Keeps the save logic in one place
// (Shimmer3D) rather than smearing inventory mutations across a UI component.
//
// No canon lore is authored here. Descriptions come from public/grimoire/spirits.json, which is
// Raven's ruled field-note prose — the panel looks entries up by species, it never writes them.

import { useEffect, useMemo, useState } from 'react'
import {
  ELEMENT_COLORS, SPECIES_NAMES, formStage, xpForLevel, getSecondFormName,
  speciesDisplayName, infusionTotal, dominantInfusion,
  type Spirit, type Element,
} from '../spirits/spirit'
import { EVOLUTION_THRESHOLDS } from '../spirits/evolution-config'
import { derivePartyStats, type PartyStats } from '../engine/party-stats'
import { getMovesForSpirit } from '../engine/moves'
import { hpFracOf, currentHpOf, maxHpOf, isDowned, activeSpirits, restingSpirits, REST_REGEN_MULT } from '../engine/spirit-health'
import { menuBtn } from './ui'

// ── the grimoire manifest (flavor text + portraits) ─────────────────────────
// Fetched once per page load and memoised at module scope: the panel can be opened dozens of times
// in a session and the file never changes under us. A failure here must degrade to "no description"
// and never block the panel — stats and moves are the load-bearing half.
interface GrimoireForm { element: string; name: string; img?: string; entry?: string }
interface GrimoireEntry {
  id: string; name: string; analog: string; quirk?: string; signature?: string
  img?: string; entry?: string; evolutions?: GrimoireForm[]
}
let grimoireCache: Record<string, GrimoireEntry> | null = null
let grimoirePending: Promise<Record<string, GrimoireEntry>> | null = null

// ★ The manifest's `analog` is ALMOST the Species code, but not quite: the game says `water-bear`
// and the manifest says `waterbear`. That one hyphen would have silently blanked the Dewbear —
// the portrait and the field note both — while every other species looked fine, which is the
// worst possible shape for a bug. Normalising both sides makes the lookup immune to that drift
// in either direction rather than depending on two files agreeing about punctuation forever.
const speciesKey = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '')

function loadGrimoire(): Promise<Record<string, GrimoireEntry>> {
  if (grimoireCache) return Promise.resolve(grimoireCache)
  if (!grimoirePending) {
    grimoirePending = fetch('/grimoire/spirits.json')
      .then(r => r.json())
      .then((d: { spirits?: GrimoireEntry[] }) => {
        const bySpecies: Record<string, GrimoireEntry> = {}
        for (const e of d.spirits ?? []) if (e.analog) bySpecies[speciesKey(e.analog)] = e
        grimoireCache = bySpecies
        return bySpecies
      })
      .catch(() => ({}))   // no lore is a cosmetic loss; the panel still works
  }
  return grimoirePending
}

/** The manifest form matching this spirit's element — base entry until it has evolved. */
function loreFor(g: GrimoireEntry | undefined, element: Element): { entry?: string; img?: string } {
  if (!g) return {}
  if (element !== 'base') {
    const form = g.evolutions?.find(f => f.element === element)
    if (form) return { entry: form.entry, img: form.img ?? g.img }
  }
  return { entry: g.entry, img: g.img }
}

// ── shared bits ─────────────────────────────────────────────────────────────
const STAT_LABELS: [keyof PartyStats, string][] = [
  ['maxHp', 'HP'], ['pwr', 'PWR'], ['grd', 'GRD'], ['foc', 'FOC'], ['res', 'RES'], ['agi', 'AGI'], ['vig', 'VIG'],
]
// Same banding as the arena team cards, so a half-empty bar means the same thing in both places.
function hpColor(frac: number) { return frac > 0.5 ? '#4fbf87' : frac > 0.2 ? '#f0a526' : '#e05a4d' }
const mono = 'ui-monospace, monospace'
const dim = '#6f8b83'

function Meter({ frac, color, h = 6 }: { frac: number; color: string; h?: number }) {
  return (
    <div style={{ flex: 1, height: h, background: '#00000088', borderRadius: 4, border: '1px solid #00000066', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${Math.max(0, Math.min(1, frac)) * 100}%`, background: color, borderRadius: 3, transition: 'width 0.3s ease-out' }} />
    </div>
  )
}

// ── one roster card ─────────────────────────────────────────────────────────
function LineupCard({ spirit, index, resting, selected, onClick }: {
  spirit: Spirit; index: number; resting: boolean; selected: boolean; onClick: () => void
}) {
  const col = ELEMENT_COLORS[spirit.element] ?? '#7fe3c8'
  const frac = hpFracOf(spirit)
  const down = isDowned(spirit)
  return (
    <button onClick={onClick} style={{
      width: '100%', textAlign: 'left', padding: '7px 9px 8px', borderRadius: 10, cursor: 'pointer',
      background: selected ? '#16241f' : '#0d1413e6',
      border: `1.5px solid ${selected ? col : down ? '#e05a4d55' : '#ffffff1e'}`,
      boxShadow: selected ? `0 0 12px ${col}44` : 'none',
      opacity: down ? 0.72 : 1, transition: 'border-color 0.15s, background 0.15s',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
        <span style={{ font: `800 12px ${mono}`, color: down ? '#c9a49c' : '#eafff6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {spirit.name}
        </span>
        <span style={{ font: `700 9px ${mono}`, color: '#8fa8a0', flexShrink: 0 }}>Lv{spirit.level}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: col, flexShrink: 0, boxShadow: `0 0 6px ${col}99` }} />
        <Meter frac={frac} color={down ? '#e05a4d' : hpColor(frac)} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 3 }}>
        <span style={{ font: `700 8.5px ${mono}`, color: down ? '#e05a4d' : resting ? '#8a9fd0' : dim, letterSpacing: '0.1em' }}>
          {down ? 'DOWN' : resting ? 'RESTING' : index === 0 ? 'LEAD' : speciesDisplayName(spirit.species).toUpperCase()}
        </span>
        <span style={{ font: `700 9px ${mono}`, color: '#8fa8a0', fontVariantNumeric: 'tabular-nums' }}>
          {currentHpOf(spirit)}/{maxHpOf(spirit)}
        </span>
      </div>
    </button>
  )
}

// ── the dossier ─────────────────────────────────────────────────────────────
function Detail({ spirit, index, resting, salves, onMend, onSetLead, onSetActive }: {
  spirit: Spirit; index: number; resting: boolean; salves: number
  onMend: (s: Spirit) => void
  onSetLead: (s: Spirit) => void
  onSetActive: (s: Spirit, active: boolean) => void
}) {
  const [grim, setGrim] = useState<Record<string, GrimoireEntry> | null>(grimoireCache)
  useEffect(() => { let live = true; loadGrimoire().then(g => { if (live) setGrim(g) }); return () => { live = false } }, [])

  const col = ELEMENT_COLORS[spirit.element] ?? '#7fe3c8'
  const stats = useMemo(() => derivePartyStats(spirit), [spirit, spirit.level, spirit.element, spirit.bond])
  const moves = useMemo(
    () => getMovesForSpirit(spirit.species, spirit.element, spirit.level, spirit.bond),
    [spirit.species, spirit.element, spirit.level, spirit.bond],
  )
  const lore = loreFor(grim?.[speciesKey(spirit.species)], spirit.element)
  const frac = hpFracOf(spirit)
  const down = isDowned(spirit)
  const stage = formStage(spirit.level)
  const formName = spirit.element !== 'base' ? getSecondFormName(spirit.species, spirit.element) : null

  // What the next level unlocks — the kit is level-gated, so a spirit sitting one level below a new
  // move is worth knowing about. Cheap to compute: the same function, asked about a later level.
  const nextMove = useMemo(() => {
    const have = new Set(moves.map(m => m.id))
    for (let lv = spirit.level + 1; lv <= Math.min(EVOLUTION_THRESHOLDS.maxLevel, spirit.level + 25); lv++) {
      const found = getMovesForSpirit(spirit.species, spirit.element, lv, spirit.bond).find(m => !have.has(m.id))
      if (found) return { name: found.name, level: lv }
    }
    return null
  }, [moves, spirit.species, spirit.element, spirit.level, spirit.bond])

  const nextForm = stage === 'base' ? EVOLUTION_THRESHOLDS.secondFormLevel
    : stage === 'second' ? EVOLUTION_THRESHOLDS.awakenedFormLevel : null
  const xpNeed = xpForLevel(spirit.level)
  const canMend = salves > 0 && frac < 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11, minWidth: 0 }}>
      {/* header — portrait, names, form */}
      <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
        <div style={{
          width: 74, height: 74, flexShrink: 0, borderRadius: 11, overflow: 'hidden',
          border: `1.5px solid ${col}66`, background: '#0a1110', boxShadow: `0 0 14px ${col}22`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {lore.img
            ? <img src={lore.img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ font: '26px serif', opacity: 0.5 }}>✦</span>}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ font: `900 17px ${mono}`, color: '#eafff6', letterSpacing: '0.04em', overflow: 'hidden', textOverflow: 'ellipsis' }}>{spirit.name}</div>
          {/* A starter is often named after its own species ("Dewbear" the Dewbear), which rendered
              the same word twice. Show the species line only when it actually says something new. */}
          {(() => {
            const kind = formName ?? SPECIES_NAMES[spirit.species] ?? spirit.species
            const sameAsName = kind.toLowerCase() === spirit.name.trim().toLowerCase()
            if (sameAsName && spirit.element === 'base') return null
            return (
              <div style={{ font: `700 10px ${mono}`, color: col, marginTop: 2, letterSpacing: '0.08em' }}>
                {sameAsName ? '' : kind}
                {spirit.element !== 'base' && <span style={{ color: sameAsName ? col : dim }}>{sameAsName ? '' : ' · '}{spirit.element.toUpperCase()}</span>}
              </div>
            )
          })()}
          <div style={{ font: `600 9.5px ${mono}`, color: dim, marginTop: 3, letterSpacing: '0.06em' }}>
            Lv {spirit.level} · {stage.toUpperCase()} FORM · {spirit.temperament.toUpperCase()}
            {index === 0 && <span style={{ color: '#d4a843' }}> · LEAD</span>}
          </div>
        </div>
      </div>

      {/* condition — the wound, and the button that fixes it */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
          <span style={{ font: `800 9px ${mono}`, color: dim, letterSpacing: '0.14em' }}>CONDITION</span>
          <span style={{ font: `700 10px ${mono}`, color: down ? '#e05a4d' : '#8fa8a0', fontVariantNumeric: 'tabular-nums' }}>
            {down ? 'DOWN' : `${currentHpOf(spirit)} / ${maxHpOf(spirit)}`}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Meter frac={frac} color={down ? '#e05a4d' : hpColor(frac)} h={8} />
          <button
            onClick={() => onMend(spirit)}
            disabled={!canMend}
            title={salves === 0 ? 'No Shimmer Salve in the satchel — brew one' : down ? 'Put it back on its feet' : 'Mend this spirit'}
            style={{
              ...menuBtn, flexShrink: 0, padding: '5px 11px',
              border: `1px solid ${canMend ? '#4fbf87' : '#ffffff1e'}`,
              background: canMend ? '#12261f' : '#12141a',
              color: canMend ? '#bff0d8' : '#5c6b68',
              cursor: canMend ? 'pointer' : 'default',
            }}>
            {down ? 'REVIVE' : 'MEND'} <span style={{ color: dim, fontWeight: 600 }}>({salves})</span>
          </button>
        </div>
        {salves === 0 && frac < 1 && (
          <div style={{ font: `600 9px ${mono}`, color: '#c9836f', marginTop: 5 }}>
            No Shimmer Salve. Brew one at an alchemy station, or walk it off — slowly.
          </div>
        )}
      </div>

      {/* growth — XP toward the next level, and what levelling buys */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
          <span style={{ font: `800 9px ${mono}`, color: dim, letterSpacing: '0.14em' }}>GROWTH</span>
          <span style={{ font: `700 10px ${mono}`, color: '#8fa8a0', fontVariantNumeric: 'tabular-nums' }}>
            {spirit.xp} / {xpNeed} XP
          </span>
        </div>
        <Meter frac={xpNeed > 0 ? spirit.xp / xpNeed : 0} color={col} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 6, font: `600 9px ${mono}`, color: dim }}>
          {nextMove && <span>next move <span style={{ color: '#cfe9df' }}>{nextMove.name}</span> at Lv {nextMove.level}</span>}
          {nextForm && <span>next form at <span style={{ color: '#cfe9df' }}>Lv {nextForm}</span></span>}
        </div>
      </div>

      {/* stats — absolute value is the hero, same rule as the level-up card */}
      <div>
        <div style={{ font: `800 9px ${mono}`, color: dim, letterSpacing: '0.14em', marginBottom: 5 }}>STATS</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
          {STAT_LABELS.map(([key, lbl]) => (
            <div key={key} style={{ textAlign: 'center' }}>
              <div style={{ font: `800 8px ${mono}`, color: dim, letterSpacing: '0.06em' }}>{lbl}</div>
              <div style={{ font: `700 13px ${mono}`, color: '#eafff6', fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>{stats[key]}</div>
            </div>
          ))}
        </div>
      </div>

      {/* the kit — 4 moves, element-coloured like the arena callouts */}
      <div>
        <div style={{ font: `800 9px ${mono}`, color: dim, letterSpacing: '0.14em', marginBottom: 5 }}>KIT</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {moves.map(m => {
            const mc = ELEMENT_COLORS[(m.element === 'neutral' ? 'base' : m.element) as Element] ?? '#cfe0da'
            return (
              <div key={m.id} title={m.description} style={{
                padding: '5px 9px', borderRadius: 8, background: `${mc}14`, border: `1px solid ${mc}44`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ font: `800 11px ${mono}`, color: '#eafff6', textShadow: `0 0 10px ${mc}55` }}>{m.name}</span>
                  <span style={{ font: `600 9px ${mono}`, color: dim, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                    {m.power > 0 ? `${m.power} pwr` : 'support'} · {m.accuracy} acc
                  </span>
                </div>
                <div style={{ font: `600 9px/1.45 ${mono}`, color: '#93aaa3', marginTop: 2 }}>{m.description}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* who it is — Raven's field note, straight from the grimoire manifest */}
      {lore.entry && (
        <div>
          <div style={{ font: `800 9px ${mono}`, color: dim, letterSpacing: '0.14em', marginBottom: 5 }}>FIELD NOTE</div>
          <div style={{ font: `500 11px/1.65 ${mono}`, color: '#b9cfc7', fontStyle: 'italic' }}>{lore.entry}</div>
        </div>
      )}

      {/* the quiet numbers — bond gates the signature move, infusions decide the form */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 130px', minWidth: 120 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', font: `800 8.5px ${mono}`, color: dim, letterSpacing: '0.1em', marginBottom: 3 }}>
            <span>BOND</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{spirit.bond}/255</span>
          </div>
          <Meter frac={spirit.bond / 255} color="#d4879a" h={5} />
          {spirit.bond < 50 && <div style={{ font: `600 8.5px ${mono}`, color: dim, marginTop: 3 }}>signature move at 50</div>}
        </div>
        <div style={{ flex: '1 1 130px', minWidth: 120 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', font: `800 8.5px ${mono}`, color: dim, letterSpacing: '0.1em', marginBottom: 3 }}>
            <span>INFUSIONS</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{infusionTotal(spirit.infusions)}/11</span>
          </div>
          <Meter frac={infusionTotal(spirit.infusions) / 11} color="#9a6aaa" h={5} />
          <div style={{ font: `600 8.5px ${mono}`, color: dim, marginTop: 3 }}>
            {(() => {
              const dom = dominantInfusion(spirit.infusions)
              if (spirit.element !== 'base') return 'form settled'
              if (!dom) return 'no leaning yet'
              return `leaning ${dom}`
            })()}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        {resting ? (
          <button onClick={() => onSetActive(spirit, true)} style={{ ...menuBtn, flex: 1, textAlign: 'center', padding: '7px 0', border: '1px solid #4fbf8766', color: '#bff0d8' }}>
            ↩ Take along
          </button>
        ) : (
          <>
            {index !== 0 && (
              <button onClick={() => onSetLead(spirit)} style={{ ...menuBtn, flex: 1, textAlign: 'center', padding: '7px 0' }}>
                ⬆ Make lead
              </button>
            )}
            <button onClick={() => onSetActive(spirit, false)} style={{ ...menuBtn, flex: 1, textAlign: 'center', padding: '7px 0' }}>
              🏡 Leave at home
            </button>
          </>
        )}
      </div>
      {resting && (
        <div style={{ font: `600 9px/1.5 ${mono}`, color: dim, textAlign: 'center' }}>
          Resting spirits mend {REST_REGEN_MULT}× faster than ones out walking with you.
        </div>
      )}
    </div>
  )
}

// ── the panel ───────────────────────────────────────────────────────────────
export default function PartyPanel({ owned, maxParty, salves, isTouch, onMend, onSetLead, onSetActive, onClose, initialSelId }: {
  owned: Spirit[]                 // every spirit you have; `inParty` splits party from resting
  maxParty: number
  salves: number
  isTouch: boolean
  onMend: (s: Spirit) => void
  onSetLead: (s: Spirit) => void
  onSetActive: (s: Spirit, active: boolean) => void
  onClose: () => void
  /** Open focused on this spirit — how greeting a wandering plot spirit lands on ITS dossier. */
  initialSelId?: string | null
}) {
  const active = activeSpirits(owned)
  const resting = restingSpirits(owned)

  // Selection is by ID, not index, because both lists reorder under it — a swap moves a spirit
  // between them and `Make lead` splices the active one. An index would silently retarget.
  const [selId, setSelId] = useState<string | null>(
    (initialSelId && owned.some(s => s.id === initialSelId) ? initialSelId : null) ?? active[0]?.id ?? owned[0]?.id ?? null)
  const selected = owned.find(s => s.id === selId) ?? active[0] ?? owned[0] ?? null
  useEffect(() => { if (selected && selected.id !== selId) setSelId(selected.id) }, [selected, selId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' || e.key.toLowerCase() === 'p') { e.preventDefault(); onClose() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const isResting = !!selected && selected.inParty === false
  const selIndex = selected ? (isResting ? resting : active).findIndex(s => s.id === selected.id) : 0

  const Column = ({ title, list, sub }: { title: string; list: Spirit[]; sub?: string }) => (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '2px 1px 5px' }}>
        <span style={{ font: `800 8.5px ${mono}`, color: dim, letterSpacing: '0.14em' }}>{title}</span>
        {sub && <span style={{ font: `700 8.5px ${mono}`, color: dim, fontVariantNumeric: 'tabular-nums' }}>{sub}</span>}
      </div>
      {list.length === 0
        ? <div style={{ font: `600 9.5px ${mono}`, color: '#ffffff33', padding: '3px 2px 8px' }}>—</div>
        : (
          <div style={{
            display: 'flex', gap: 6, marginBottom: 9,
            ...(isTouch ? { flexDirection: 'row', overflowX: 'auto', paddingBottom: 2 } : { flexDirection: 'column' }),
          }}>
            {list.map((sp, i) => (
              <div key={sp.id} style={{ flexShrink: 0, width: isTouch ? 160 : '100%' }}>
                <LineupCard spirit={sp} index={i} resting={sp.inParty === false} selected={sp.id === selected?.id} onClick={() => setSelId(sp.id)} />
              </div>
            ))}
          </div>
        )}
    </>
  )

  return (
    <>
      <div onPointerDown={onClose} style={{ position: 'fixed', inset: 0, zIndex: 44, background: 'rgba(6,10,16,0.55)', touchAction: 'none' }} />
      <div style={{
        position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', zIndex: 45,
        width: 'min(720px, 94vw)', maxHeight: '86vh', display: 'flex', flexDirection: 'column',
        borderRadius: 15, background: 'rgba(11,21,19,0.975)', border: '2px solid #2f5c4f',
        padding: isTouch ? '13px 13px 10px' : '16px 18px 12px', boxShadow: '0 14px 48px #000b',
        font: `700 12px ${mono}`, color: '#cfeee2',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 11, flexShrink: 0 }}>
          <span style={{ font: `900 15px ${mono}`, color: '#8fd9c4', letterSpacing: '0.16em' }}>
            🌱 SPIRITS <span style={{ color: dim, fontSize: 11 }}>({owned.length})</span>
          </span>
          <button onClick={onClose} style={{ ...menuBtn, padding: '4px 10px' }}>✕</button>
        </div>

        {owned.length === 0 ? (
          <div style={{ padding: '30px 10px', textAlign: 'center', color: dim, font: `600 12px/1.7 ${mono}` }}>
            No spirits yet.<br />Gregory has a starter for you.
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 13, minHeight: 0, flex: 1, flexDirection: isTouch ? 'column' : 'row' }}>
            <div style={{ flexShrink: 0, ...(isTouch ? {} : { width: 182, overflowY: 'auto' }) }}>
              <Column title="WITH YOU" list={active} sub={`${active.length}/${maxParty}`} />
              {/* Canon has no name for where an uncarried spirit lives, and the closest thing it
                  does say is that spirits live in your garden / Home Plot. So this says where they
                  ARE rather than coining a container — no "bank", no "box", no PC. */}
              <Column title="AT THE HOME PLOT" list={resting} />
            </div>

            <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', paddingRight: 2 }}>
              {selected && (
                <Detail
                  key={selected.id}
                  spirit={selected}
                  index={Math.max(0, selIndex)}
                  resting={isResting}
                  salves={salves}
                  onMend={onMend}
                  onSetLead={onSetLead}
                  onSetActive={onSetActive}
                />
              )}
            </div>
          </div>
        )}

        <div style={{ marginTop: 10, textAlign: 'center', font: `600 10px ${mono}`, color: '#ffffff44', flexShrink: 0 }}>
          {isTouch ? 'tap outside to close' : 'P / Esc — close'}
        </div>
      </div>
    </>
  )
}
