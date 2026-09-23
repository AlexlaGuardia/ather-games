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
//
// ── ★ 2026-09-23 — RESTYLED ONTO THE CARVED HEARTH ──────────────────────────────────────────────
// The last play3d menu still wearing the dark mint terminal. It now sits in `HearthFrame` (wood,
// parchment, the "Spirits" plaque, the close knob) and every colour is an `hk-*` class or an `H`
// token. The one palette it keeps is `ELEMENT_COLORS` — per-element DATA from spirits/spirit.ts,
// the same exception MoveBook keeps for `rune.glow` — because a spirit's element must read the same
// here as it does in the arena.


import React, { useEffect, useMemo, useState } from 'react'
import {
  ELEMENT_COLORS, SPECIES_NAMES, formStage, xpForLevel, getSecondFormName,
  speciesDisplayName, infusionTotal, dominantInfusion,
  type Spirit, type Element,
} from '../spirits/spirit'
import { EVOLUTION_THRESHOLDS } from '../spirits/evolution-config'
import { derivePartyStats, type PartyStats } from '../engine/party-stats'
import { getMovesForSpirit } from '../engine/moves'
import { hpFracOf, currentHpOf, maxHpOf, isDowned, activeSpirits, restingSpirits, REST_REGEN_MULT } from '../engine/spirit-health'
import { H, HearthFrame, HearthButton } from '../ui/hearth'

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
// Same banding as the arena team cards, so a half-empty bar means the same thing in both places —
// spoken in the hearth's own three words: moss = have, ember = mind it, rust = short.
function hpColor(frac: number) { return frac > 0.5 ? H.moss : frac > 0.2 ? H.ember : H.rust }
const FACE = 'var(--font-hearth-body), system-ui, sans-serif'
const DISPLAY = 'var(--font-hearth-display), Georgia, serif'
const baseAccent = ELEMENT_COLORS.base
/** A small section label: the hearth's display face, sentence case, soft ink. */
const label: React.CSSProperties = { font: `600 13px ${DISPLAY}`, marginBottom: 4 }

/** A carved groove the colour fills — HearthProgress's shape, with the colour left to the caller. */
function Meter({ frac, color, h = 6 }: { frac: number; color: string; h?: number }) {
  return (
    <div style={{ flex: 1, height: h, background: H.paperLo, borderRadius: 999, boxShadow: 'inset 0 1px 2px rgba(58,39,22,.35)', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${Math.max(0, Math.min(1, frac)) * 100}%`, background: color, borderRadius: 999, transition: 'width 0.3s ease-out' }} />
    </div>
  )
}

// ── one roster card ─────────────────────────────────────────────────────────
function LineupCard({ spirit, index, resting, selected, onClick }: {
  spirit: Spirit; index: number; resting: boolean; selected: boolean; onClick: () => void
}) {
  const col = ELEMENT_COLORS[spirit.element] ?? baseAccent
  const frac = hpFracOf(spirit)
  const down = isDowned(spirit)
  return (
    <button onClick={onClick} className={`hk-plate${selected ? ' is-lit' : ''}`} style={{
      width: '100%', textAlign: 'left', padding: '7px 9px 8px', cursor: 'pointer',
      opacity: down ? 0.72 : 1, transition: 'box-shadow 0.15s',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
        <span className={down ? 'hk-rust' : 'hk-ink'} style={{ font: `600 15px ${DISPLAY}`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {spirit.name}
        </span>
        <span className="hk-soft" style={{ font: `700 11px ${FACE}`, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>Lv {spirit.level}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: col, flexShrink: 0 }} />
        <Meter frac={frac} color={down ? H.rust : hpColor(frac)} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 3 }}>
        <span className={down ? 'hk-rust' : resting ? 'hk-sky' : index === 0 ? 'hk-ember' : 'hk-faint'} style={{ font: `700 11px ${FACE}` }}>
          {down ? 'Down' : resting ? 'Resting' : index === 0 ? 'Lead' : speciesDisplayName(spirit.species)}
        </span>
        <span className="hk-soft" style={{ font: `600 11px ${FACE}`, fontVariantNumeric: 'tabular-nums' }}>
          {currentHpOf(spirit)}/{maxHpOf(spirit)}
        </span>
      </div>
    </button>
  )
}

// ── the dossier ─────────────────────────────────────────────────────────────
function Detail({ spirit, index, resting, salves, infusionsHeld, onMend, onInfuse, onSetLead, onSetActive }: {
  spirit: Spirit; index: number; resting: boolean; salves: number
  /** How many of each elemental infusion sit in the satchel — counts, not the bag, like `salves`. */
  infusionsHeld: Record<Exclude<Element, 'base'>, number>
  onMend: (s: Spirit) => void
  onInfuse: (s: Spirit, element: Exclude<Element, 'base'>) => void
  onSetLead: (s: Spirit) => void
  onSetActive: (s: Spirit, active: boolean) => void
}) {
  const [grim, setGrim] = useState<Record<string, GrimoireEntry> | null>(grimoireCache)
  useEffect(() => { let live = true; loadGrimoire().then(g => { if (live) setGrim(g) }); return () => { live = false } }, [])

  const col = ELEMENT_COLORS[spirit.element] ?? baseAccent
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0, font: `400 12px ${FACE}` }}>
      {/* header — portrait, names, form */}
      <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
        <div className="hearth-slot" style={{
          width: 74, height: 74, flexShrink: 0, overflow: 'hidden', boxShadow: `inset 0 0 0 1.5px ${col}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {lore.img
            ? <img src={lore.img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span className="hk-faint" style={{ font: `26px ${DISPLAY}` }}>✦</span>}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="hk-ink" style={{ font: `600 22px/1.15 ${DISPLAY}`, overflow: 'hidden', textOverflow: 'ellipsis' }}>{spirit.name}</div>
          {/* A starter is often named after its own species ("Dewbear" the Dewbear), which rendered
              the same word twice. Show the species line only when it actually says something new. */}
          {(() => {
            const kind = formName ?? SPECIES_NAMES[spirit.species] ?? spirit.species
            const sameAsName = kind.toLowerCase() === spirit.name.trim().toLowerCase()
            if (sameAsName && spirit.element === 'base') return null
            return (
              <div style={{ font: `700 12px ${FACE}`, color: col, marginTop: 2 }}>
                {sameAsName ? '' : kind}
                {spirit.element !== 'base' && <span className={sameAsName ? undefined : 'hk-soft'}>{sameAsName ? '' : ' · '}{spirit.element}</span>}
              </div>
            )
          })()}
          <div className="hk-soft" style={{ font: `600 11px ${FACE}`, marginTop: 3 }}>
            Lv {spirit.level} · {stage} form · {spirit.temperament}
            {index === 0 && <span className="hk-ember"> · lead</span>}
          </div>
        </div>
      </div>

      {/* condition — the wound, and the button that fixes it */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span className="hk-label hk-soft" style={label}>Condition</span>
          <span className={down ? 'hk-rust' : 'hk-soft'} style={{ font: `700 12px ${FACE}`, fontVariantNumeric: 'tabular-nums' }}>
            {down ? 'Down' : `${currentHpOf(spirit)} / ${maxHpOf(spirit)}`}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Meter frac={frac} color={down ? H.rust : hpColor(frac)} h={8} />
          <span title={salves === 0 ? 'No Shimmer Salve in the satchel — brew one' : down ? 'Put it back on its feet' : 'Mend this spirit'} style={{ flexShrink: 0 }}>
            <HearthButton small primary={canMend} disabled={!canMend} onClick={() => onMend(spirit)}>
              {down ? 'Revive' : 'Mend'} ({salves})
            </HearthButton>
          </span>
        </div>
        {salves === 0 && frac < 1 && (
          <div className="hk-rust" style={{ font: `italic 400 12px ${FACE}`, marginTop: 5 }}>
            No Shimmer Salve. Brew one at an alchemy station, or walk it off — slowly.
          </div>
        )}
      </div>

      {/* growth — XP toward the next level, and what levelling buys */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span className="hk-label hk-soft" style={label}>Growth</span>
          <span className="hk-soft" style={{ font: `700 12px ${FACE}`, fontVariantNumeric: 'tabular-nums' }}>
            {spirit.xp} / {xpNeed} XP
          </span>
        </div>
        <Meter frac={xpNeed > 0 ? spirit.xp / xpNeed : 0} color={col} />
        <div className="hk-soft" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 6, font: `400 12px ${FACE}` }}>
          {nextMove && <span>next move <b className="hk-ink">{nextMove.name}</b> at Lv {nextMove.level}</span>}
          {nextForm && <span>next form at <b className="hk-ink">Lv {nextForm}</b></span>}
        </div>
      </div>

      {/* stats — absolute value is the hero, same rule as the level-up card */}
      <div>
        <div className="hk-label hk-soft" style={label}>Stats</div>
        <div className="hk-plate" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, padding: '6px 4px' }}>
          {STAT_LABELS.map(([key, lbl]) => (
            <div key={key} style={{ textAlign: 'center' }}>
              <div className="hk-faint" style={{ font: `700 10px ${FACE}`, letterSpacing: '0.06em' }}>{lbl}</div>
              <div className="hk-ink" style={{ font: `800 15px ${FACE}`, fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>{stats[key]}</div>
            </div>
          ))}
        </div>
      </div>

      {/* the kit — 4 moves, each edged in its element, like the arena callouts */}
      <div>
        <div className="hk-label hk-soft" style={label}>Kit</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {moves.map(m => {
            const mc = ELEMENT_COLORS[(m.element === 'neutral' ? 'base' : m.element) as Element] ?? baseAccent
            return (
              <div key={m.id} title={m.description} className="hk-plate" style={{ padding: '6px 9px 6px 11px', borderLeft: `3px solid ${mc}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <span className="hk-ink" style={{ font: `600 15px ${DISPLAY}` }}>{m.name}</span>
                  <span className="hk-faint" style={{ font: `600 11px ${FACE}`, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                    {m.power > 0 ? `${m.power} pwr` : 'support'} · {m.accuracy} acc
                  </span>
                </div>
                <div className="hk-soft" style={{ font: `400 12px/1.45 ${FACE}`, marginTop: 2 }}>{m.description}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* who it is — Raven's field note, straight from the grimoire manifest */}
      {lore.entry && (
        <div>
          <div className="hk-label hk-soft" style={label}>Field note</div>
          <div className="hk-ink" style={{ font: `italic 400 14px/1.6 ${DISPLAY}` }}>{lore.entry}</div>
        </div>
      )}

      {/* the quiet numbers — bond gates the signature move, infusions decide the form */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 130px', minWidth: 120 }}>
          <div className="hk-soft" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', font: `700 11px ${FACE}`, marginBottom: 3 }}>
            <span className="hk-label" style={{ fontSize: 13 }}>Bond</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{spirit.bond}/255</span>
          </div>
          <Meter frac={spirit.bond / 255} color={H.ember} h={5} />
          {spirit.bond < 50 && <div className="hk-faint" style={{ font: `400 11px ${FACE}`, marginTop: 3 }}>signature move at 50</div>}
        </div>
        <div style={{ flex: '1 1 130px', minWidth: 120 }}>
          <div className="hk-soft" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', font: `700 11px ${FACE}`, marginBottom: 3 }}>
            <span className="hk-label" style={{ fontSize: 13 }}>Infusions</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{infusionTotal(spirit.infusions)}/11</span>
          </div>
          <Meter frac={infusionTotal(spirit.infusions) / 11} color={ELEMENT_COLORS.mana} h={5} />
          <div className="hk-faint" style={{ font: `400 11px ${FACE}`, marginTop: 3 }}>
            {(() => {
              const dom = dominantInfusion(spirit.infusions)
              if (spirit.element !== 'base') return 'form settled'
              if (!dom) return 'no leaning yet'
              return `leaning ${dom}`
            })()}
          </div>
          {/* ── ★ THE POUR (#262 slice ③, 2026-08-18) ─────────────────────────────────────────
              Brewing lives on THIS surface, so the gesture that spends a brew belongs here too —
              a keeper who can make an infusion and not use it is the same middle-removed failure
              this whole row exists to close.
              ⚠ Once `element` is settled the pours go away rather than refusing: after level 34
              the form is decided, and offering a control that can no longer change anything is a
              worse lie than not offering it. Before then they stay VISIBLE but disabled, with the
              count you hold, so the keeper learns the mechanic exists. */}
          {spirit.element === 'base' && (
            <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
              {(['mana', 'storm', 'earth', 'water'] as const).map(el => {
                const held = infusionsHeld[el] ?? 0
                const full = spirit.infusions[el] >= 9 || infusionTotal(spirit.infusions) >= 11
                const dead = held === 0 || full
                return (
                  <button key={el} type="button" disabled={dead}
                          onClick={() => !dead && onInfuse(spirit, el)}
                          title={`${el} · ${spirit.infusions[el]} in ${spirit.name} · ${held} in your satchel`}
                          className={dead ? 'hk-faint hk-rule' : 'hk-ink hk-hover-fill'}
                          style={{
                            flex: 1, padding: '4px 0', borderRadius: 7, cursor: dead ? 'default' : 'pointer',
                            borderWidth: 1, borderStyle: dead ? 'dashed' : 'solid',
                            ...(dead ? {} : { borderColor: ELEMENT_COLORS[el] }),
                            font: `700 11px ${FACE}`, fontVariantNumeric: 'tabular-nums',
                          }}>
                    {el.slice(0, 2).toUpperCase()} {spirit.infusions[el]}·{held}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
        {resting ? (
          <HearthButton primary onClick={() => onSetActive(spirit, true)}>↩ Take along</HearthButton>
        ) : (
          <>
            {index !== 0 && <HearthButton onClick={() => onSetLead(spirit)}>⬆ Make lead</HearthButton>}
            <HearthButton onClick={() => onSetActive(spirit, false)}>🏡 Leave at home</HearthButton>
          </>
        )}
      </div>
      {resting && (
        <div className="hk-faint" style={{ font: `italic 400 12px/1.5 ${FACE}`, textAlign: 'center' }}>
          Resting spirits mend {REST_REGEN_MULT}× faster than ones out walking with you.
        </div>
      )}
    </div>
  )
}

// ── the panel ───────────────────────────────────────────────────────────────
export default function PartyPanel({ owned, maxParty, salves, infusionsHeld, isTouch, onMend, onInfuse, onSetLead, onSetActive, onClose, initialSelId }: {
  owned: Spirit[]                 // every spirit you have; `inParty` splits party from resting
  maxParty: number
  salves: number
  infusionsHeld: Record<Exclude<Element, 'base'>, number>
  isTouch: boolean
  onMend: (s: Spirit) => void
  onInfuse: (s: Spirit, element: Exclude<Element, 'base'>) => void
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
        <span className="hk-label hk-soft" style={{ fontSize: 13 }}>{title}</span>
        {sub && <span className="hk-faint" style={{ font: `700 11px ${FACE}`, fontVariantNumeric: 'tabular-nums' }}>{sub}</span>}
      </div>
      {list.length === 0
        ? <div className="hk-faint" style={{ font: `italic 400 12px ${FACE}`, padding: '3px 2px 8px' }}>no one here</div>
        : (
          <div style={{
            display: 'flex', gap: 6, marginBottom: 9,
            ...(isTouch ? { flexDirection: 'row', overflowX: 'auto', paddingBottom: 4 } : { flexDirection: 'column' }),
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
    <HearthFrame title={`Spirits · ${owned.length}`} maxWidth={720} fixed backdropClass="z-[45]" onClose={onClose} dataPanel="party"
                 bodyClass={isTouch ? 'px-3 pt-6 pb-3' : 'px-4 pt-6 pb-3'}
                 footer={<div style={{ font: `400 12px ${FACE}`, textAlign: 'center' }}>{isTouch ? 'tap outside to close' : 'P / Esc — close'}</div>}>
      {owned.length === 0 ? (
        <div className="hk-soft" style={{ padding: '30px 10px', textAlign: 'center', font: `italic 400 16px/1.7 ${DISPLAY}` }}>
          No spirits yet.<br />Gregory has a starter for you.
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexDirection: isTouch ? 'column' : 'row' }}>
          <div style={isTouch ? { width: '100%' } : { flexShrink: 0, width: 190, position: 'sticky', top: 0 }}>
            <Column title="With you" list={active} sub={`${active.length}/${maxParty}`} />
            {/* Canon has no name for where an uncarried spirit lives, and the closest thing it
                does say is that spirits live in your garden / Home Plot. So this says where they
                ARE rather than coining a container — no "bank", no "box", no PC. */}
            <Column title="At the Home Plot" list={resting} />
          </div>

          <div style={{ flex: 1, minWidth: 0, width: isTouch ? '100%' : undefined }}>
            {selected && (
              <Detail
                key={selected.id}
                spirit={selected}
                index={Math.max(0, selIndex)}
                resting={isResting}
                salves={salves}
                infusionsHeld={infusionsHeld}
                onMend={onMend}
                onInfuse={onInfuse}
                onSetLead={onSetLead}
                onSetActive={onSetActive}
              />
            )}
          </div>
        </div>
      )}
    </HearthFrame>
  )
}
