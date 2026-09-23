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

/**
 * How far up from the bottom edge the bar reaches (held label included), per size, in px — MEASURED
 * in the browser on `dev/hud-kit`, Full hearth. The host's centre-low lines (skill progress, spike
 * tier, the drawn-weapon line) sit at or above this or they land on the lip.
 */
// Measured 2026-09-23 at 1440 / 842 / 390 (wide 122, compact 141, phone 125), +8 of air.
export const HUD_BAR_CLEAR: Record<HudSize, number> = { wide: 130, compact: 149, phone: 133 }

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
export function HearthHudLayer({ face = 'full', size: sizeIn, entries, sel, held, dimmed, onSelect, objective, vitals, mana, buffs, tools, skills, activeTool, glyph }: {
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
  vitals: React.RefObject<Vitals>
  mana: React.RefObject<{ cur: number; max: number; regen: number } | null>
  buffs: React.RefObject<ActiveBuffs>
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
  const lip = size === 'compact' ? <HearthLip face={face} vitals={vitals} />
    : size === 'phone' ? <HearthLip face={face} vitals={vitals} mana={mana} tools={<HearthToolPips face={face} pips={pips} />} />
    : undefined
  return (
    <>
      <HearthMapFrame face={face} box={box} />
      <HearthClock face={face} box={box} />
      {objective && <HearthObjective face={face} value={objective} anchor={size === 'phone' ? 'left' : 'center'} />}
      <HearthBuffChips face={face} buffs={buffs} top={size === 'wide' ? undefined : size === 'phone' ? (objective ? 58 : 12) : 12} />
      {size === 'wide' && <div className="absolute bottom-4 left-4 pointer-events-none"><HearthVitals face={face} vitals={vitals} /></div>}
      <HearthHotbar face={face} size={size} entries={entries} sel={sel} held={held} dimmed={dimmed} onSelect={onSelect} lip={lip} />
      {size !== 'phone' && <Corner face={face} size={size} mana={mana} readouts={readouts} glyph={glyph} />}
    </>
  )
}
