'use client'
// THE HEARTH HUD LAYER — the whole always-on HUD, laid out per size, as ONE component.
//
// ── ★ WHY ONE COMPONENT (2026-09-23, play lane) ──────────────────────────────────────────────
// Alex judged Full hearth and the three sizes on `/shimmer/dev/hud-kit` ("thats works nicely lets
// continue"). The ARRANGEMENT he judged — what moves where at compact and phone — is as much the
// product as the pieces, and if it lived in the dev page and again in `VoxelWorld.tsx` it would be
// two dialects of one layout, the drift `hud-corner.tsx` was extracted to end. So it lives here, and
// BOTH the dev page and the world's Hud mount this. What was approved is what ships.
//
// The host's whole job: pass the refs it already has, a `glyph` for the tool families (hud-corner's
// `ToolGlyph`), and size the minimap canvas to `hudMapBox(size)`. The host keeps its own
// centre-low lines (skill bar, spike tier, weapon line) and lifts them to `HUD_BAR_CLEAR[size]`.
import React from 'react'
import { hearthDisplay, hearthBody } from './hearth'
import { HEARTH_FONT_VARS } from './hearth-fonts'
import { HUD_FACES, type HudFace } from './hud-face'
import { type HudSize } from './hud-flag'
import {
  HearthHotbar, HearthObjective, HearthVitals, HearthBuffChips, HearthMapFrame, HearthClock, HearthOrbRim,
  HearthLip, HearthToolPips, useHudSize, MINIMAP_BOX, MINIMAP_BOX_PHONE, type MapBox, type ToolPip,
} from './hearth-hud'
import type { HotbarEntry } from '../hud/hotbar'
import { ManaGauge } from '../hud/mana-gauge'
import { TOOL_FAMILIES } from '../hud/hud-corner'
import { getEquippedTool, getToolDef, type EquippedTools } from '../engine/tools'
import { xpForSkillLevel, type SkillSet } from '../engine/skills'
import type { Vitals } from '../engine/vitals'
import type { ActiveBuffs } from '../engine/potion-effects'

export type ToolFamily = typeof TOOL_FAMILIES[number]

/** The minimap canvas box for a size. The host sizes `VoxelMiniMap` to this; the frame rings it. */
export const hudMapBox = (size: HudSize): MapBox => (size === 'phone' ? MINIMAP_BOX_PHONE : MINIMAP_BOX)
/** The world's options door (☰, `hud/options-door.tsx`: 34 wide, 6 under the map, right-aligned to
 *  it). Its top for a size; the clock pill keeps `DOOR_RESERVE` clear so the two share the row. */
export const hudDoorTop = (size: HudSize): number => { const b = hudMapBox(size); return b.top + b.size + 6 }
export const DOOR_RESERVE = 40

/**
 * How far up from the bottom edge the bar reaches (held label included), per size, in px — MEASURED
 * in the browser on `dev/hud-kit`, Full hearth. The host's centre-low lines (skill progress, spike
 * tier, the drawn-weapon line) sit at or above this or they land on the lip.
 */
// Measured 2026-09-23 at 1440 / 842 / 390 (wide 122, compact 141, phone 125), +8 of air.
export const HUD_BAR_CLEAR: Record<HudSize, number> = { wide: 130, compact: 149, phone: 133 }

/** The wide vitals plate's height (Full hearth), so a host can stand things on it (the cast gauges). */
export const HUD_VITALS_H = 65   // measured in the world at 1440, 2026-09-23

/** One tool family's readout, derived exactly as `hud-corner.tsx`'s `ToolSocket` derives it. */
export function toolReadout(tools: EquippedTools, skills: SkillSet, family: ToolFamily, activeTool: string | null) {
  const held = getEquippedTool(tools, family)
  const def = held ? getToolDef(held) : undefined
  const sk = skills[family]
  return {
    family, level: sk.level, active: activeTool === family,
    xpPct: Math.min(1, sk.xp / Math.max(1, xpForSkillLevel(sk.level))),
    tier: def?.tier ?? 0, basic: def?.basic ?? false, name: def?.name,
  }
}

// ── the tool arch, in the hearth ─────────────────────────────────────────────────────────────
/** A socket: the hud-corner socket's content (glyph, XP ring, tier dots, level badge) on the face's
 *  well. Same bearings and radius as hud-corner's ToolArc, so the arch stands where it always has. */
function Socket({ face, r, glyph }: { face: HudFace; r: ReturnType<typeof toolReadout>; glyph?: (f: ToolFamily) => React.ReactNode }) {
  const t = HUD_FACES[face]
  const RING_R = 21, RING_C = 2 * Math.PI * RING_R
  return (
    <div className="relative w-full h-full rounded-full" style={{ background: t.well, boxShadow: r.active ? t.wellSelShadow : `${t.ring}, ${t.ringShadow}` }}>
      <svg viewBox="0 0 48 48" className="absolute inset-0 w-full h-full -rotate-90">
        <circle cx="24" cy="24" r={RING_R} fill="none" stroke={face === 'full' ? 'rgba(58,39,22,.14)' : 'rgba(255,255,255,.12)'} strokeWidth="2" />
        <circle cx="24" cy="24" r={RING_R} fill="none" stroke={face === 'full' ? '#5f7d45' : '#9cc58a'} strokeWidth="2.2" strokeLinecap="round"
                strokeDasharray={RING_C} strokeDashoffset={RING_C * (1 - r.xpPct)} />
      </svg>
      <svg viewBox="0 0 24 24" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[60%] w-4 h-4"
           fill="none" stroke={t.count} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {glyph ? glyph(r.family) : <text x="12" y="16" textAnchor="middle" fontSize="12" fill={t.count} stroke="none" style={hearthDisplay}>{r.family[0].toUpperCase()}</text>}
      </svg>
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
        {[0, 1, 2].map(i => {
          const filled = !r.basic && i < r.tier, hollowBasic = r.basic && i === 0
          return <span key={i} className="w-1 h-1 rounded-full" style={{
            background: filled ? t.accent : 'transparent',
            border: `1px solid ${filled ? t.accent : hollowBasic ? t.textDim : face === 'full' ? 'rgba(58,39,22,.2)' : 'rgba(255,255,255,.15)'}`,
          }} />
        })}
      </div>
      <div className="absolute -bottom-1 -right-1 min-w-[16px] h-[16px] px-[3px] rounded-full text-[10px] leading-[16px] text-center font-bold tabular-nums"
           style={{ ...hearthBody, background: face === 'full' ? '#fbf4e4' : 'rgba(0,0,0,.8)', color: face === 'full' ? '#6b5238' : '#fff',
                    boxShadow: '0 1px 2px rgba(0,0,0,.35)' }}>{r.level}</div>
    </div>
  )
}

/** The bottom-right corner: vessel + rim + arch. hud-corner's geometry (152px gauge, arc radius
 *  clamp(108px,16vw,122px), bearings 180/137/93/50). Compact shrinks the whole corner to ~96px. */
function Corner({ face, size, mana, readouts, glyph }: {
  face: HudFace; size: HudSize
  mana: React.RefObject<{ cur: number; max: number; regen: number } | null>
  readouts: ReturnType<typeof toolReadout>[]
  glyph?: (f: ToolFamily) => React.ReactNode
}) {
  const ANGLES = [180, 137, 93, 50]
  return (
    <div className="absolute bottom-4 right-4 pointer-events-none"
         style={{ '--tool-arc-r': 'clamp(108px, 16vw, 122px)', ...(size === 'compact' ? { transform: 'scale(.63)', transformOrigin: 'bottom right' } : {}) } as React.CSSProperties}>
      <div className="relative" style={{ marginRight: 'calc(var(--tool-arc-r) * 0.643 - 46px)' }}>
        <ManaGauge mana={mana} />
        <HearthOrbRim face={face} />
        <div className="absolute left-1/2 top-1/2 h-0 w-0">
          {readouts.map((r, i) => {
            const rad = (ANGLES[i] * Math.PI) / 180
            return (
              <div key={r.family} className="absolute w-14 h-14" style={{
                left: `calc(var(--tool-arc-r) * ${Math.cos(rad).toFixed(4)})`,
                top: `calc(var(--tool-arc-r) * ${(-Math.sin(rad)).toFixed(4)})`,
                transform: 'translate(-50%, -50%)',
              }}><Socket face={face} r={r} glyph={glyph} /></div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── the layer ────────────────────────────────────────────────────────────────────────────────
export function HearthHudLayer({ face = 'full', size: sizeIn, entries, sel, held, dimmed, onSelect, objective, vitals, mana, buffs, tools, skills, activeTool, glyph, door = false, topLeftFrom = 0, clock = true, mapFrame = true }: {
  /** The host has an options door under the map (the world does) — the clock steps left of it. */
  door?: boolean
  /**
   * Where the host's own top-left block ENDS (px from the top), if it has one. The world's info block
   * (SHIMMER · position · tools, ~243×109 and growing with the tutorial hints) owns that corner, and on
   * a phone there is no room beside it — measured 2026-09-23, the left-anchored objective landed ON
   * it. So on a phone the objective and buffs stack UNDER this line. Default 0 = the corner is free.
   */
  topLeftFrom?: number
  /** Alex's pick (2026-09-23): Full hearth. Light stays selectable for comparison. */
  face?: HudFace
  /** Omitted = the live window's size (`useHudSize`). The dev page passes a simulated one. */
  size?: HudSize
  entries: readonly (HotbarEntry | null)[]
  sel: number
  held: { text: string; out: boolean } | null
  dimmed: boolean
  onSelect?: (i: number) => void
  /** The objective chip's text, or null when there is no objective (tutorial done). */
  objective: string | null
  /** Omitted = no health anywhere in the layer. The mortal side has no always-on health (its bars
   *  show only with a weapon drawn), and porting the LOOK must not add a readout it never had. */
  vitals?: React.RefObject<Vitals>
  mana: React.RefObject<{ cur: number; max: number; regen: number } | null>
  /** Omitted = no chips (the mortal side keeps its own buff column by the map). */
  buffs?: React.RefObject<ActiveBuffs>
  /** false = the host draws the clock itself (the mortal side hangs it in its own column). */
  clock?: boolean
  /** false = the host rings its own minimap, on the MINIMAP'S show-rule, which is not the bar's. */
  mapFrame?: boolean
  tools: React.RefObject<EquippedTools>
  skills: React.RefObject<SkillSet>
  activeTool: string | null
  /** The family glyph (pass hud-corner's `ToolGlyph`). Omitted = the family's initial. */
  glyph?: (f: ToolFamily) => React.ReactNode
}) {
  const live = useHudSize()
  const size = sizeIn ?? live
  const box = hudMapBox(size)
  const readouts = tools.current && skills.current
    ? TOOL_FAMILIES.map(f => toolReadout(tools.current!, skills.current!, f, activeTool))
    : []
  const pips: ToolPip[] = readouts.map(r => ({ family: r.family, level: r.level, xpPct: r.xpPct, active: r.active }))
  // Compact's lip carries health only (the orb still stands), so with no health there is no lip.
  const lip = size === 'compact' ? (vitals ? <HearthLip face={face} vitals={vitals} /> : undefined)
    : size === 'phone' ? <HearthLip face={face} vitals={vitals} mana={mana} tools={<HearthToolPips face={face} pips={pips} />} />
    : undefined
  return (
    // ⚠ THE FONT VARS RIDE ON A `display:contents` WRAPPER. Every hearth menu applies them on its own
    // root (HearthFrame); the HUD has no root, and without them every face here silently falls back
    // to Georgia/system-ui. `contents` makes no box, so the fixed/absolute pieces place exactly as before
    // — custom properties inherit through the element tree, not through boxes.
    <div className={`contents ${HEARTH_FONT_VARS}`}>
      {mapFrame && <HearthMapFrame face={face} box={box} />}
      {clock && <HearthClock face={face} box={box} reserveRight={door ? DOOR_RESERVE : 0} />}
      {objective && <HearthObjective face={face} value={objective} anchor={size === 'phone' ? 'left' : 'center'}
        style={size === 'phone' && topLeftFrom ? { top: topLeftFrom + 6 } : undefined} />}
      {/* Buffs: wide = over the vitals (bottom-left). Compact = the same bottom-left spot, which is
          FREE there (the vitals ride the bar). Phone = under the objective, under the host's block. */}
      {buffs && <HearthBuffChips face={face} buffs={buffs}
        top={size !== 'phone' ? undefined : (topLeftFrom ? topLeftFrom + 6 : 12) + (objective ? 46 : 0)} />}
      {size === 'wide' && vitals && <div className="absolute bottom-4 left-4 pointer-events-none"><HearthVitals face={face} vitals={vitals} /></div>}
      <HearthHotbar face={face} size={size} entries={entries} sel={sel} held={held} dimmed={dimmed} onSelect={onSelect} lip={lip} />
      {size !== 'phone' && <Corner face={face} size={size} mana={mana} readouts={readouts} glyph={glyph} />}
    </div>
  )
}
