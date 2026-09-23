'use client'
// THE HEARTH HUD KIT — Phase 9 of the Carved Hearth, built ahead of Alex's face pick.
//
// ── ★ WHAT THIS IS (2026-09-23, play lane, hub's work order) ──────────────────────────────────
// The always-on HUD's pieces in the hearth's register, each a DROP-IN for the live piece it
// replaces: same props, same behaviour, same anchoring. Only the look differs, and the look is
// `HUD_FACES[face]` (`hud-face.ts`). Whichever face Alex picks at `/shimmer/dev/hud-mock`, wiring
// is one import swap per piece in `VoxelWorld.tsx`'s Hud (hub's edit, after the pick):
//
//   hud/hotbar.tsx          Hotbar        → HearthHotbar      (+ face)
//   hud/objective-chip.tsx  ObjectiveChip → HearthObjective   (+ face)
//   voxel3d/resource-bars   ResourceBars  → HearthVitals      (+ face)
//   voxel3d/buff-chips      BuffChips     → HearthBuffChips   (+ face)
//   VoxelMiniMap (fixed canvas)           + HearthMapFrame    (an overlay ring; VoxelMap untouched)
//   hud/clock.tsx           Clock         → HearthClock       (+ face; reads the same day-cycle)
//   hud/mana-gauge.tsx      ManaGauge     + HearthOrbRim      (a ring laid over the vessel)
//   hud-corner's sockets                  ← hearthSocket()    (a style, for the tool arch)
//
// ★ THE BEHAVIOUR IS COPIED ON PURPOSE, AND EACH COPY SAYS WHERE FROM. The live pieces carry hard-won
// rules (8 fixed slots so 1-8 never move; the shield drawn OVER health against hpMax; refs polled,
// never re-rendered; the held label always mounted so the row never shifts). A reskin that dropped
// one would be a regression wearing a new coat. When the pick lands and these replace the originals,
// the originals are deleted, so there is one dialect again, not two (the hud-corner.tsx rule).
//
// ⚠ NOTHING HERE MOUNTS ITSELF. Every piece takes `face` explicitly; `readHudFace()` (hud-flag.ts) is
// how a host decides, and it is null (= the shipped HUD) unless a keeper asks with `?hud=`.
import React, { useEffect, useRef, useState } from 'react'
import { H, hearthDisplay, hearthBody } from './hearth'
import { HUD_FACES, type HudFace } from './hud-face'
import { hudSizeFor, type HudSize } from './hud-flag'
import { ItemChip } from '../hud/satchel'
import { HOTBAR_SLOTS, type HotbarEntry } from '../hud/hotbar'
import type { Vitals } from '../engine/vitals'
import { activeBuffList, type ActiveBuffs } from '../engine/potion-effects'
import { WIRED_BUFFS } from '../voxel3d/consume'
import { dayProgress, getPhase, getDisplayTime, isTimePinned } from '../engine/day-cycle'
import { manaFraction } from '../hud/mana-gauge'

// ── sizes ────────────────────────────────────────────────────────────────────────────────────
/** The HUD size for the live window (see hud-flag.ts § THE HUD SIZES). A host hook; pieces take the
 *  result as a PROP so a preview can show a phone inside a desktop window. 'wide' before mount, which
 *  is also what the server renders — the first client frame then corrects it. */
export function useHudSize(): HudSize {
  const [size, setSize] = useState<HudSize>('wide')
  useEffect(() => {
    const on = () => setSize(hudSizeFor(window.innerWidth))
    on(); addEventListener('resize', on)
    return () => removeEventListener('resize', on)
  }, [])
  return size
}
/** Per size: the well, its icon, and the gap between wells. Phone's 40 is the widest that fits 8
 *  across a 390px screen with the tray's own padding and a 7px gutter each side. */
export const WELL: Record<HudSize, { px: number; icon: number; gap: number }> = {
  wide: { px: 52, icon: 32, gap: 6 },
  compact: { px: 44, icon: 28, gap: 5 },
  phone: { px: 40, icon: 24, gap: 4 },
}

// ── the plate ────────────────────────────────────────────────────────────────────────────────
/** A readout's ground: the face's rim round the face's plate. Text never sits raw on the scene. */
export function HudPlate({ face, r = 14, children, style, className = '' }: {
  face: HudFace; r?: number; children: React.ReactNode; style?: React.CSSProperties; className?: string
}) {
  const t = HUD_FACES[face]
  return (
    <div className={className} style={{ background: t.rim, borderRadius: r, padding: t.rimPad, boxShadow: t.plateShadow, ...style }}>
      <div style={{
        background: t.plate, borderRadius: Math.max(2, r - t.rimPad), color: t.text, textShadow: t.textShadow,
        boxShadow: face === 'full' ? 'inset 0 1px 4px rgba(58,39,22,.45)' : undefined,
      }}>{children}</div>
    </div>
  )
}

// ── bottom-centre: the hotbar ────────────────────────────────────────────────────────────────
/** Drop-in for `hud/hotbar.tsx` `Hotbar` — its contract, unchanged: 8 FIXED slots, items only,
 *  empty slots still drawn, `dimmed` fades rather than hides, `onSelect` makes slots buttons. */
export function HearthHotbar({ face, entries, sel, held, dimmed, onSelect, size = 'wide', lip }: {
  face: HudFace
  /** Chosen by the host (`useHudSize`), not by a media query — see hud-flag.ts. */
  size?: HudSize
  /** A strip laid along the tray's top edge (compact/phone: the vitals, see `HearthLip`). */
  lip?: React.ReactNode
  entries: readonly (HotbarEntry | null)[]
  sel: number
  held: { text: string; out: boolean } | null
  dimmed: boolean
  onSelect?: (i: number) => void
}) {
  const t = HUD_FACES[face]
  const w = WELL[size]
  const trayPad = size === 'phone' ? Math.min(t.trayPad, 5) : t.trayPad
  // ⚠ CHIPS AFTER MOUNT. `ItemChip` draws its icon from a canvas the server does not have, so on a
  // server-rendered page the first render is a hydration mismatch (seen in the kit's first preview).
  // The world is client-only and never hit it; the kit must not depend on that. Wells draw at once.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return (
    <div className={`absolute ${size === 'phone' ? 'bottom-2' : 'bottom-4'} left-1/2 -translate-x-1/2 flex flex-col items-center ${onSelect ? '' : 'pointer-events-none'} transition-opacity ${dimmed ? 'opacity-35' : 'opacity-100'}`}>
      {/* Always mounted, opacity only — the row must never shift when the name fades. */}
      <div className={`mb-1.5 h-5 text-center text-[14px] font-semibold transition-opacity duration-500 ${held && !held.out ? 'opacity-100' : 'opacity-0'}`}
           style={{ ...hearthDisplay, color: t.heldColor, textShadow: '0 1px 3px rgba(0,0,0,.9)' }}>
        {held?.text ?? ''}
      </div>
      <div style={{ background: t.rim, borderRadius: size === 'phone' ? 14 : 18, padding: trayPad, boxShadow: t.plateShadow }}>
        {lip && <div style={{ marginBottom: trayPad }}>{lip}</div>}
        {/* `relative` so a tool arc can still anchor with `left-full`, as on the live bar. */}
        <div className="relative inline-flex items-end" style={{ background: t.tray, borderRadius: 14, gap: w.gap, padding: size === 'phone' ? 3 : 6 }}>
          {Array.from({ length: HOTBAR_SLOTS }, (_, i) => {
            const e = entries[i] ?? null
            const selected = i === sel && !dimmed
            const style: React.CSSProperties = {
              background: t.well, boxShadow: selected ? t.wellSelShadow : t.wellShadow,
              transform: selected ? 'translateY(-3px)' : undefined,
            }
            const body = (
              <>
                {e && mounted && <ItemChip itemId={e.itemId} size={w.icon} />}
                {e && (
                  <span className="absolute bottom-0.5 right-1.5 text-[11px] font-extrabold tabular-nums"
                        style={{ ...hearthBody, color: t.count, textShadow: t.countShadow }}>{e.count}</span>
                )}
                <span className="absolute top-0.5 left-1.5 text-[10px] font-bold" style={{ ...hearthBody, color: t.wellKey }}>{i + 1}</span>
              </>
            )
            const cls = 'relative rounded-[11px] grid place-items-center transition-transform'
            style.width = w.px; style.height = w.px
            return onSelect
              ? <button key={i} type="button" onClick={() => onSelect(i)} className={cls} style={style} aria-label={`slot ${i + 1}`}>{body}</button>
              : <div key={i} className={cls} style={style}>{body}</div>
          })}
        </div>
      </div>
    </div>
  )
}

// ── top-centre: the objective ────────────────────────────────────────────────────────────────
/** Drop-in for `hud/objective-chip.tsx`. Dim label, bright value — "next" in the display face's
 *  italic, the value in the act-here colour. */
export function HearthObjective({ face, value, anchor = 'center', style }: {
  face: HudFace; value: string
  /** 'left' on a phone: the top-centre slot is under a 96px minimap there. `style` places it. */
  anchor?: 'center' | 'left'; style?: React.CSSProperties
}) {
  const t = HUD_FACES[face]
  return (
    <div className={`absolute pointer-events-none ${anchor === 'center' ? 'top-3 left-1/2 -translate-x-1/2' : 'top-3 left-3'}`} style={style}>
      <HudPlate face={face} r={999} style={face === 'full' ? { padding: 4 } : undefined}>
        <div className="px-4 py-1.5 text-[13px] flex items-baseline gap-2 whitespace-nowrap" style={hearthBody}>
          <span className="italic" style={{ ...hearthDisplay, color: t.textDim }}>next</span>
          <span className="font-bold" style={{ color: t.accent }}>{value}</span>
        </div>
      </HudPlate>
    </div>
  )
}

// ── bottom-left: health + shield ─────────────────────────────────────────────────────────────
/** Drop-in for `voxel3d/resource-bars.tsx` `ResourceBars`, and it keeps every rule that file
 *  documents: ONE bar, both fills scaled to `hpMax`, the shield laid OVER health from the same left
 *  edge (the order a hit spends them), "+N" hidden at zero, refs polled at 10 Hz and written to the
 *  DOM, rounded for display only. Not self-positioned: the corner belongs to whoever owns it. */
export function HearthVitals({ face, vitals }: { face: HudFace; vitals: React.RefObject<Vitals> }) {
  const t = HUD_FACES[face]
  const hpEl = useRef<HTMLDivElement>(null)
  const shEl = useRef<HTMLDivElement>(null)
  const hpTxt = useRef<HTMLSpanElement>(null)
  const shTxt = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const id = setInterval(() => {
      const v = vitals.current
      if (!v) return
      const max = v.hpMax || 1
      if (hpEl.current) hpEl.current.style.width = `${Math.max(0, (v.hp / max) * 100)}%`
      if (shEl.current) shEl.current.style.width = `${Math.max(0, Math.min(1, v.shield / max)) * 100}%`
      if (hpTxt.current) { const s = `${Math.round(v.hp)}`; if (hpTxt.current.textContent !== s) hpTxt.current.textContent = s }
      if (shTxt.current) {
        const s = v.shield > 0.5 ? `+${Math.round(v.shield)}` : ''
        if (shTxt.current.textContent !== s) shTxt.current.textContent = s
      }
    }, 100)
    return () => clearInterval(id)
  }, [vitals])
  return (
    <HudPlate face={face} className="w-52 pointer-events-none">
      <div className="px-3 py-2" style={hearthBody}>
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-[14px]" style={{ ...hearthDisplay, color: t.text }}>Health</span>
          <span ref={shTxt} className="ml-auto text-[11px] font-bold tabular-nums" style={{ color: t.plus }} />
          <span ref={hpTxt} className="text-[12px] font-bold tabular-nums" style={{ color: t.text }}>0</span>
        </div>
        <div className="relative mt-1.5 h-2.5 rounded-full overflow-hidden" style={{ background: t.track, boxShadow: 'inset 0 1px 2px rgba(0,0,0,.4)' }}>
          <div ref={hpEl} className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-100"
               style={{ width: '100%', background: 'linear-gradient(180deg, #d9735a, #a8482f)' }} />
          {/* The shield: sky, OVER the health, never beside it (see resource-bars.tsx). */}
          <div ref={shEl} className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-100"
               style={{ width: '0%', background: 'rgba(125,177,210,.8)', boxShadow: 'inset -1px 0 0 rgba(235,245,255,.7)' }} />
        </div>
      </div>
    </HudPlate>
  )
}

// ── bottom-left, above the vitals: what you drank ────────────────────────────────────────────
/** Drop-in for `voxel3d/buff-chips.tsx` `BuffChips`: one chip per running drink, a 1 s beat (a buff
 *  is a wall-clock timer, a per-frame render would cost the world its frames), dimmed when the buff
 *  is not felt here yet, nothing at all when nothing runs. */
export function HearthBuffChips({ face, buffs, top }: {
  face: HudFace; buffs: React.RefObject<ActiveBuffs>
  /** Compact/phone: hang from the TOP-left at this offset — the bottom-left corner has gone to the
   *  hotbar's lip (and, on a phone, to where a thumb will be). Omitted = the wide bottom-left spot. */
  top?: number
}) {
  const t = HUD_FACES[face]
  const [, setBeat] = useState(0)
  useEffect(() => {
    const h = setInterval(() => setBeat(b => b + 1), 1000)
    return () => clearInterval(h)
  }, [])
  const live = activeBuffList(buffs.current ?? {}, Date.now())
  if (!live.length) return null
  return (
    <div className={`absolute ${top === undefined ? 'bottom-28 left-4' : 'left-3'} flex flex-col items-start gap-1 pointer-events-none`} style={top === undefined ? undefined : { top }}>
      {live.map(b => {
        const m = Math.floor(b.remainMs / 60_000), sec = Math.floor((b.remainMs % 60_000) / 1000)
        const felt = WIRED_BUFFS.has(b.id)
        return (
          <HudPlate key={b.id} face={face} r={999} style={{ opacity: felt ? 1 : 0.6 }}>
            <div className="flex items-center gap-2 px-2.5 py-0.5 text-[12px]" style={hearthBody} title={felt ? b.name : `${b.name} — not felt here yet`}>
              <span style={{ color: b.color }}>{b.glyph}</span>
              <span className="font-semibold" style={{ ...hearthDisplay, color: t.text }}>{b.name}</span>
              <span className="tabular-nums" style={{ color: t.textDim }}>{m}:{String(sec).padStart(2, '0')}</span>
            </div>
          </HudPlate>
        )
      })}
    </div>
  )
}

// ── top-right: the minimap's frame + the clock ───────────────────────────────────────────────
/** The live minimap is a `position:fixed` 148px canvas at top 12 / right 12 (`VoxelMap.tsx`). This
 *  lays a ring over exactly that box, pointer-through, one z above it — so the map stays the map,
 *  owns its own click, and VoxelMap is not touched. If the canvas ever moves, these four numbers move
 *  with it (they are its numbers, named). */
export const MINIMAP_BOX: MapBox = { top: 12, right: 12, size: 148, z: 33 }
export type MapBox = { top: number; right: number; size: number; z: number }
/** Phone: a 96px window. ⚠ The live canvas is fixed at 148 in `VoxelMap.tsx`; this box is what the
 *  kit frames, so the canvas has to take the same size when the phone layout is wired (hub's). */
export const MINIMAP_BOX_PHONE: MapBox = { top: 10, right: 10, size: 96, z: 33 }
export function HearthMapFrame({ face, box = MINIMAP_BOX }: { face: HudFace; box?: MapBox }) {
  const t = HUD_FACES[face]
  const pad = face === 'full' ? 3 : 2
  return (
    <div aria-hidden className="pointer-events-none" style={{
      position: 'fixed', top: box.top - pad, right: box.right - pad,
      width: box.size + pad * 2, height: box.size + pad * 2, zIndex: box.z + 1,
      borderRadius: 14, boxShadow: `${t.ring}, ${t.ringShadow}`,
    }} />
  )
}

/** Drop-in for `hud/clock.tsx` `Clock` — the same `engine/day-cycle` readings (✦ at night: the
 *  Ather has no moon), as a pill that hangs under the minimap frame. `placed={false}` renders in
 *  flow, as the live clock allows, for a host that stacks it. */
export function HearthClock({ face, note, placed = true, box = MINIMAP_BOX, reserveRight = 0 }: {
  face: HudFace; note?: React.ReactNode; placed?: boolean; box?: MapBox
  /** px kept clear at the map's right edge under it — the world's options door (☰) hangs there. */
  reserveRight?: number
}) {
  const t = HUD_FACES[face]
  // ⚠ NULL UNTIL MOUNTED, unlike the live clock's `useState(() => dayProgress())`. The live one is
  // only ever mounted client-side, inside the world; this kit also mounts on server-rendered pages
  // (a preview, a dev harness), where reading the wall clock in the first render is a hydration
  // mismatch — the server's minute is not the client's. Caught by the first preview of this file.
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(dayProgress())
    const h = setInterval(() => setNow(dayProgress()), 1000)
    return () => clearInterval(h)
  }, [])
  if (now === null) return null
  const phase = getPhase(now)
  const glyph = phase === 'night' ? '✦' : phase === 'day' ? '☀' : phase === 'dawn' ? '🌅' : '🌇'
  const pos: React.CSSProperties = placed
    ? { position: 'fixed', top: box.top + box.size + 8, right: box.right + reserveRight, width: box.size - reserveRight, zIndex: box.z + 1 }
    : {}
  return (
    // A pill wider than a small map (the phone's 96) would hang past the screen edge if centred on
    // it; right-aligned to the map it stays on screen at any width.
    <div className={`flex flex-col ${box.size - reserveRight < 120 ? 'items-end' : 'items-center'} pointer-events-none`} style={pos}>
      <HudPlate face={face} r={999} style={face === 'full' ? { padding: 3 } : undefined}>
        <div className="px-3 py-0.5 text-[12px] font-semibold whitespace-nowrap tabular-nums" style={{ ...hearthDisplay }}>
          <span className="mr-1.5">{glyph}</span>{getDisplayTime(now)} · {phase}
          {isTimePinned() && <span className="ml-1.5" style={{ color: t.accent }}>pinned</span>}
        </div>
      </HudPlate>
      {note}
    </div>
  )
}

// ── bottom-right: the mana orb's ring, and the tool sockets' look ────────────────────────────
/** A ring laid over `ManaGauge` (a fixed 152px vessel whose glass is r=64 inside a r=68 plate).
 *  Mount it as a sibling INSIDE the gauge's box: `absolute inset-0`, pointer-through. */
export function HearthOrbRim({ face, size = 152, radius = 68 }: { face: HudFace; size?: number; radius?: number }) {
  const t = HUD_FACES[face]
  const d = radius * 2
  return (
    <div aria-hidden className="absolute pointer-events-none rounded-full"
         style={{ left: (size - d) / 2, top: (size - d) / 2, width: d, height: d, boxShadow: `${t.ring}, ${t.ringShadow}` }} />
  )
}

/** The tool socket's plate in this face — for `hud-corner.tsx`'s `ToolSocket`, which keeps its own
 *  geometry, XP ring and badges. Active = the ember ring, the one act-here colour. */
export function hearthSocket(face: HudFace, active: boolean): React.CSSProperties {
  const t = HUD_FACES[face]
  return {
    background: t.well,
    boxShadow: active ? t.wellSelShadow : `${t.ring}, ${t.ringShadow}`,
  }
}

// ── compact + phone: the lip ─────────────────────────────────────────────────────────────────
// ★ WHY THE VITALS RIDE THE BAR ON A NARROW SCREEN. The wide layout puts health in its own column
// bottom-left, which is ~225px the bottom row does not have under 1000. On the tray's top edge it
// costs no width at all and sits where the eye already is while playing (the hearts-over-the-hotbar
// placement every block game converged on). Same honesty rules as `HearthVitals`: one bar, both
// fills against hpMax, the shield OVER the health; refs polled at 10 Hz and written to the DOM.

/** One thin lip bar. `fill` is set by the poller through the returned ref. */
function LipBar({ face, fillRef, overRef, txtRef, color, glyph }: {
  face: HudFace; color: string; glyph: string
  fillRef: React.RefObject<HTMLDivElement | null>
  overRef?: React.RefObject<HTMLDivElement | null>
  txtRef: React.RefObject<HTMLSpanElement | null>
}) {
  const t = HUD_FACES[face]
  return (
    <div className="flex-1 min-w-0 flex items-center gap-1.5">
      <span className="text-[11px] leading-none" style={{ color }}>{glyph}</span>
      <div className="relative flex-1 h-2 rounded-full overflow-hidden" style={{ background: t.track, boxShadow: 'inset 0 1px 2px rgba(0,0,0,.4)' }}>
        <div ref={fillRef} className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-100"
             style={{ width: '100%', background: color }} />
        {overRef && <div ref={overRef} className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-100"
                         style={{ width: '0%', background: 'rgba(125,177,210,.85)', boxShadow: 'inset -1px 0 0 rgba(235,245,255,.7)' }} />}
      </div>
      <span ref={txtRef} className="text-[11px] font-bold tabular-nums leading-none" style={{ ...hearthBody, color: t.count, textShadow: t.countShadow, minWidth: 18 }} />
    </div>
  )
}

/**
 * The strip on the hotbar's top edge. Compact: health only (the orb still stands, smaller, in its
 * corner). Phone: health AND mana, because the orb is gone — a 150px vessel is a hole in a 390px
 * world — and `tools` (the pips) at the right end. Pass as `HearthHotbar`'s `lip`.
 */
export function HearthLip({ face, vitals, mana, tools }: {
  face: HudFace
  vitals: React.RefObject<Vitals>
  /** Pass on a phone (the orb is gone); omit where the orb still stands. */
  mana?: React.RefObject<{ cur: number; max: number; regen: number } | null>
  tools?: React.ReactNode
}) {
  const t = HUD_FACES[face]
  const hp = useRef<HTMLDivElement>(null), sh = useRef<HTMLDivElement>(null), hpT = useRef<HTMLSpanElement>(null)
  const mp = useRef<HTMLDivElement>(null), mpT = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const id = setInterval(() => {
      const v = vitals.current
      if (v) {
        const max = v.hpMax || 1
        if (hp.current) hp.current.style.width = `${Math.max(0, (v.hp / max) * 100)}%`
        if (sh.current) sh.current.style.width = `${Math.max(0, Math.min(1, v.shield / max)) * 100}%`
        if (hpT.current) { const s = `${Math.round(v.hp)}`; if (hpT.current.textContent !== s) hpT.current.textContent = s }
      }
      const m = mana?.current
      if (m) {
        // `manaFraction`, not cur/max: max is genuinely 0 at mount (see mana-gauge.tsx).
        if (mp.current) mp.current.style.width = `${manaFraction(m.cur, m.max) * 100}%`
        if (mpT.current) { const s = `${Math.floor(m.cur)}`; if (mpT.current.textContent !== s) mpT.current.textContent = s }
      }
    }, 100)
    return () => clearInterval(id)
  }, [vitals, mana])
  return (
    <div className="flex items-center gap-3 px-2 py-1 rounded-[10px]" style={{ background: t.plate, boxShadow: face === 'full' ? 'inset 0 1px 3px rgba(58,39,22,.4)' : undefined }}>
      <LipBar face={face} fillRef={hp} overRef={sh} txtRef={hpT} color="#b9543a" glyph="♥" />
      {mana && <LipBar face={face} fillRef={mp} txtRef={mpT} color="#7657b4" glyph="✦" />}
      {tools}
    </div>
  )
}

/** A tool as a pip: phone-sized stand-in for a `hud-corner` socket. Level in the middle, XP as a
 *  ring, the act-here ember when that family is working. Data in, so the corner derives it. */
export type ToolPip = { family: string; level: number; xpPct: number; active: boolean }
export function HearthToolPips({ face, pips }: { face: HudFace; pips: readonly ToolPip[] }) {
  const t = HUD_FACES[face]
  const R = 9, C = 2 * Math.PI * R
  return (
    <div className="flex items-center gap-1 shrink-0">
      {pips.map(p => (
        <div key={p.family} title={p.family} className="relative w-[22px] h-[22px] rounded-full grid place-items-center"
             style={{ background: t.well, boxShadow: p.active ? t.wellSelShadow : t.wellShadow }}>
          <svg viewBox="0 0 22 22" className="absolute inset-0 -rotate-90">
            <circle cx="11" cy="11" r={R} fill="none" stroke={face === 'full' ? H.moss : '#9cc58a'} strokeWidth="2"
                    strokeDasharray={C} strokeDashoffset={C * (1 - Math.max(0, Math.min(1, p.xpPct)))} strokeLinecap="round" />
          </svg>
          <span className="relative text-[9px] font-extrabold tabular-nums" style={{ ...hearthBody, color: t.count }}>{p.level}</span>
        </div>
      ))}
    </div>
  )
}
