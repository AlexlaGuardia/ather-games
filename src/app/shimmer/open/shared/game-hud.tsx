'use client'
// ══ THE GAME HUD — THE TEMPLATE ══════════════════════════════════════════════════════════════════════════════════
// Alex 11-15: "is there a way to establish a ui template so we dont have to keep redoing all of this everytime..? id
// like to try and keep it uniform throughout the game". This is it. Every open-world page mounts <GameHud> and hands
// it DATA. It never places a HUD piece itself: where things go, how they look, how the hotbar is driven and where
// messages appear are decided HERE, once. `game-hud-wiring.test.ts` fails if a page imports a HUD piece directly.
//
// ── THE LAYOUT (desktop) ───────────────────────────────────────────────────────────────────────────────────────
//   top-left      the hotbar (Alex 11-15: "move the hotbar to the topleft to clear up space")
//   under it      THE MESSAGE LINE: zone entered, the selected item's name, toasts, chat (`hudSay`, hud-say.ts)
//   top-centre    the compass, centred in the gap between the hotbar and the minimap
//   top-right     the page's minimap (sized to `openMapBox(size)`), the clock under it, then the page's STATUS chips
//   bottom-left   health (the hearth vitals plate)
//   bottom-right  the mana orb with the tool sockets fanned round it (Alex 11-15: "the tools how we had them fanning
//                 around the mana")
//   bottom-centre FREE: the page's world prompts and the touch controls live there
// ── PHONE (any touch device, whatever its width) ───────────────────────────────────────────────────────────────
//   the hearth phone layout (09-23): the bar on the bottom edge for the thumbs, health + mana + tool pips on its lip;
//   the message line stands just above the bar. Compass, minimap, clock and status as on desktop.
//
// ── WHAT A PAGE GIVES ──────────────────────────────────────────────────────────────────────────────────────────
//   pose (where you stand + face) · marks (compass pips) · vitals · mana · tools/skills (omit = basic kit, lv 1)
//   entries + sel + onSelect (the bar; 1-8 and the mouse wheel are handled here while `input` is true)
//   minimap (a node; draw it in `openMapBox(size)`) · status (short chips under the clock)
//   …and calls `hudSay(text, kind)` for anything worth saying.
//
// ⚠ Built from the Carved Hearth kit (ui/hearth-hud*.tsx, Alex's Full-hearth pick 09-23). Change a LOOK there; change
// an ARRANGEMENT here. Never fork either into a page.

import React, { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { HearthHudLayer, hudMapBox, Corner, toolReadout, type ToolFamily } from '../../ui/hearth-hud-layer'
import { HearthCompass, compassWidth, HearthHotbar, HearthVitals, HearthClock, HudPlate, WELL, useHudSize, type CompassMark, type CompassPose } from '../../ui/hearth-hud'
import { HUD_FACES } from '../../ui/hud-face'
import { HEARTH_FONT_VARS } from '../../ui/hearth-fonts'
import { hearthDisplay, hearthBody } from '../../ui/hearth'
import type { HudSize } from '../../ui/hud-flag'
import type { HotbarEntry } from '../../hud/hotbar'
import { HOTBAR_SLOTS } from '../../hud/hotbar'
import { TOOL_FAMILIES, ToolGlyph } from '../../hud/hud-corner'
import { ensureBasicTools, type EquippedTools } from '../../engine/tools'
import { createSkillSet, type SkillSet } from '../../engine/skills'
import type { Vitals } from '../../engine/vitals'
import { hudSay, linesAt, subscribe, type Line } from './hud-say'

export type { CompassMark, CompassPose }
export { hudSay }
export type Mana = { cur: number; max: number; regen: number }
export type Status = { label: string; value?: string | number; accent?: boolean }

export function useGameHudSize(touch: boolean): HudSize {
  const live = useHudSize()
  return touch ? 'phone' : live
}
/** The minimap's box for a size: draw the page's minimap canvas exactly here. */
export const openMapBox = hudMapBox

const FACE = 'full' as const
const glyph = (f: ToolFamily) => <ToolGlyph family={f} />

/** The hotbar tray's outer size at a size (top-left anchor), from the same tokens the tray draws with. */
export function trayBox(size: HudSize) {
  const w = WELL[size], pad = HUD_FACES[FACE].trayPad, inner = size === 'phone' ? 3 : 6
  return { w: HOTBAR_SLOTS * w.px + (HOTBAR_SLOTS - 1) * w.gap + inner * 2 + pad * 2, h: w.px + inner * 2 + pad * 2 + 3 }
}

function useLines(): Line[] {
  const snap = useRef<Line[]>([])
  const get = () => snap.current
  const sub = (f: () => void) => {
    const update = () => { snap.current = linesAt(); f() }
    const un = subscribe(update)
    const id = setInterval(() => { const n = linesAt(); if (n.length !== snap.current.length) { snap.current = n; f() } }, 250)
    return () => { un(); clearInterval(id) }
  }
  return useSyncExternalStore(sub, get, () => snap.current)
}

/** The message line: on the world, never on a plate (the held-label rule), newest at the bottom. */
function Messages({ style, align }: { style: React.CSSProperties; align: 'left' | 'center' }) {
  const lines = useLines()
  return (
    <div className={`pointer-events-none flex flex-col ${align === 'left' ? 'items-start' : 'items-center'} gap-0.5`} style={{ position: 'fixed', zIndex: 33, maxWidth: 'min(520px, 80vw)', ...style }} data-hud="messages">
      {lines.map(l => (
        <div key={l.id} style={{
          ...(l.kind === 'zone' ? { ...hearthDisplay, fontSize: 20, fontWeight: 700, letterSpacing: '0.04em' } : { ...hearthBody, fontSize: l.kind === 'item' ? 14 : 13, fontWeight: l.kind === 'item' ? 800 : 600 }),
          color: l.kind === 'chat' ? '#cfe8ff' : '#fff6e4', textShadow: '0 1px 3px rgba(0,0,0,.95), 0 0 10px rgba(0,0,0,.45)',
          textAlign: align, lineHeight: 1.3, animation: 'gamehud-in .18s ease-out',
        }}>{l.text}</div>
      ))}
      <style>{'@keyframes gamehud-in{from{opacity:0;transform:translateY(-3px)}to{opacity:1;transform:none}}'}</style>
    </div>
  )
}

function StatusChips({ items, top, right }: { items: readonly Status[]; top: number; right: number }) {
  if (!items.length) return null
  return (
    <div className="pointer-events-none flex flex-col items-end gap-1.5" style={{ position: 'fixed', top, right, zIndex: 33 }} data-hud="status">
      {items.map((s, i) => (
        <HudPlate key={i} face={FACE} r={999} style={{ padding: 3 }}>
          <div className="px-2.5 py-0.5 text-[12px] whitespace-nowrap tabular-nums" style={{ ...hearthBody }}>
            <span style={{ opacity: 0.75 }}>{s.label}</span>
            {s.value !== undefined && <b className="ml-1.5" style={{ color: s.accent ? HUD_FACES[FACE].accent : undefined }}>{s.value}</b>}
          </div>
        </HudPlate>
      ))}
    </div>
  )
}

export function GameHud({ size, pose, marks, vitals, mana, tools, skills, entries, sel, onSelect, dimmed, input, minimap, status = [] }: {
  size: HudSize
  pose: React.RefObject<CompassPose | null>
  marks?: React.RefObject<readonly CompassMark[]>
  vitals: React.RefObject<Vitals>
  mana: React.RefObject<Mana | null>
  tools?: React.RefObject<EquippedTools>
  skills?: React.RefObject<SkillSet>
  entries: readonly (HotbarEntry | null)[]
  sel: number
  onSelect: (i: number) => void
  /** fades the bar (hands busy: at the wheel, at home with nothing to fight) */
  dimmed: boolean
  /** keys 1-8 and the wheel drive the bar only while true (not in a menu, not at the wheel) */
  input: boolean
  minimap?: React.ReactNode
  status?: readonly Status[]
}) {
  const basicTools = useRef<EquippedTools>(ensureBasicTools({}))
  const basicSkills = useRef<SkillSet>(createSkillSet())
  const T = tools ?? basicTools, S = skills ?? basicSkills
  const readouts = T.current && S.current ? TOOL_FAMILIES.map(f => toolReadout(T.current!, S.current!, f, null)) : []
  const box = hudMapBox(size)
  const tray = trayBox(size)
  const [vw, setVw] = React.useState(1280)
  useEffect(() => { const f = () => setVw(window.innerWidth); f(); addEventListener('resize', f); return () => removeEventListener('resize', f) }, [])

  // the bar's keys and wheel, once, for every page
  const selRef = useRef(sel); selRef.current = sel
  const inputRef = useRef(input); inputRef.current = input
  const n = Math.max(1, Math.min(HOTBAR_SLOTS, HOTBAR_SLOTS))
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!inputRef.current) return
      const m = /^Digit([1-8])$/.exec(e.code); if (m) onSelect(Number(m[1]) - 1)
    }
    const wheel = (e: WheelEvent) => {
      if (!inputRef.current || !document.pointerLockElement) return
      onSelect((selRef.current + (e.deltaY > 0 ? 1 : -1) + n) % n)
    }
    addEventListener('keydown', key); addEventListener('wheel', wheel, { passive: true })
    return () => { removeEventListener('keydown', key); removeEventListener('wheel', wheel) }
  }, [onSelect, n])
  // say the selected slot's name (an empty slot says nothing), never on mount
  const first = useRef(true)
  const selName = useMemo(() => { const e = entries[sel]; return e ? e.name ?? e.itemId : null }, [entries, sel])
  useEffect(() => { if (first.current) { first.current = false; return } if (selName) hudSay(selName, 'item') }, [sel]) // eslint-disable-line react-hooks/exhaustive-deps

  const statusTop = box.top + box.size + 40
  if (size === 'phone') {
    return (
      <div className={`contents ${HEARTH_FONT_VARS}`}>
        <HearthHudLayer face={FACE} size="phone" entries={entries} sel={sel} held={null} dimmed={dimmed} onSelect={onSelect}
          objective={null} vitals={vitals} mana={mana} tools={T} skills={S} activeTool={null} glyph={glyph} mapFrame={false} />
        <HearthCompass face={FACE} pose={pose} marks={marks} size="phone" />
        {minimap}
        {/* a phone's right edge belongs to the thumbs below the map: the chips join into one line */}
        <StatusChips items={status.length ? [{ label: status.map(x => x.value !== undefined ? `${x.label} ${x.value}` : x.label).join(' · ') }] : []} top={statusTop} right={box.right} />
        <Messages align="center" style={{ left: '50%', transform: 'translateX(-50%)', bottom: 118 }} />
      </div>
    )
  }
  // the compass: on the SCREEN's centre (Alex 11-15: gap-centred read "a little off center" — 166 px at 1920), nudged
  // sideways only as far as it must to clear the bar or the minimap on a narrow window
  const gapL = 12 + tray.w, gapR = vw - box.right - box.size - 6, half = compassWidth(size) / 2 + 6 + 10
  const compassX = Math.min(Math.max(vw / 2, gapL + half), gapR - half)
  return (
    <div className={`contents ${HEARTH_FONT_VARS}`}>
      <HearthHotbar face={FACE} size={size} entries={entries} sel={sel} held={null} dimmed={dimmed} onSelect={onSelect} anchor="top-left" />
      <Messages align="left" style={{ left: 16, top: 12 + tray.h + 10 }} />
      <HearthCompass face={FACE} pose={pose} marks={marks} size={size} centerX={compassX} />
      {minimap}
      <HearthClock face={FACE} box={box} />
      <StatusChips items={status} top={statusTop} right={box.right} />
      <div className="fixed bottom-4 left-4 pointer-events-none" style={{ zIndex: 32 }}><HearthVitals face={FACE} vitals={vitals} /></div>
      <div className="contents" style={{ zIndex: 32 }}><CornerFixed size={size} mana={mana} readouts={readouts} /></div>
    </div>
  )
}

function CornerFixed({ size, mana, readouts }: { size: HudSize; mana: React.RefObject<Mana | null>; readouts: ReturnType<typeof toolReadout>[] }) {
  // the layer's Corner is `absolute bottom-4 right-4`; a fixed wrapper makes it screen-anchored on any page
  return <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 32 }}><Corner face={FACE} size={size} mana={mana} readouts={readouts} glyph={glyph} /></div>
}
