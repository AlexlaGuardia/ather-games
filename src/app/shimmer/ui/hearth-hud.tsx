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
export function HearthHotbar({ face, entries, sel, held, dimmed, onSelect, size = 'wide', lip, slots = true, anchor = 'bottom' }: {
  face: HudFace
  /** Chosen by the host (`useHudSize`), not by a media query — see hud-flag.ts. */
  size?: HudSize
  /** A strip laid along the tray's top edge (compact/phone: the vitals, see `HearthLip`). */
  lip?: React.ReactNode
  /** false = no quick-slots, only the lip (Alex 09-28: no hotbar in a fight — towns keep it; a phone's mana rides the lip) */
  slots?: boolean
  /** 'top-left' (Alex 11-15, the open world's template): the tray sits in the top-left corner and the held label is
   *  NOT drawn (the template's message line under the tray says the name). Default 'bottom' = the voxel world's bar. */
  anchor?: 'bottom' | 'top-left'
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
  if (!slots && !lip) return null
  if (!slots) return (
    <div className={`absolute ${size === 'phone' ? 'bottom-2' : 'bottom-4'} left-1/2 -translate-x-1/2 pointer-events-none`}>
      <div style={{ background: t.rim, borderRadius: size === 'phone' ? 14 : 18, padding: trayPad, boxShadow: t.plateShadow }}>{lip}</div>
    </div>
  )
  const top = anchor === 'top-left'
  return (
    <div className={`${top ? 'fixed top-3 left-3 items-start' : `absolute ${size === 'phone' ? 'bottom-2' : 'bottom-4'} left-1/2 -translate-x-1/2 items-center`} flex flex-col ${onSelect ? '' : 'pointer-events-none'} transition-opacity ${dimmed ? 'opacity-35' : 'opacity-100'}`}
         style={top || onSelect ? { zIndex: 33 } : undefined} data-hud="hotbar">   {/* BETA M6a (11-17): a bottom bar that takes taps must sit ABOVE the phone's touch layer (z 5) or the thumb lands on the stick and slots 2-8 cannot be picked */}
      {/* Always mounted, opacity only — the row must never shift when the name fades. */}
      <div className={`${top ? 'hidden' : ''} mb-1.5 h-5 text-center text-[14px] font-semibold transition-opacity duration-500 ${held && !held.out ? 'opacity-100' : 'opacity-0'}`}
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
                {e && mounted && (e.icon ? <img src={e.icon} alt="" width={w.icon} height={w.icon} draggable={false} /> : <ItemChip itemId={e.itemId} size={w.icon} />)}
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

// ── M59 THE MANA SKIN (name ruled athernyx ae322a9) ──────────────────────────────────────────
// The open world's shield IS the Mana Skin: the shell of the field the keeper stands in (open/ather/combat.ts hurtKeeper).
// Opt-in per page by `skin: true` on the vitals object, so every other shield (the mortal side's) draws as before. With it:
// the layer over health is a bright highlight, under 25% of its size it flickers and shows cracks, and on `popAt` (a new
// value = the skin just broke; a skin simply running out never sets it) the highlight shatters off the bar with a white
// edge flash.
export type SkinVitals = Vitals & { skin?: boolean; popAt?: number }
const SKIN_BG = 'linear-gradient(180deg, rgba(240,252,255,.98), rgba(146,210,246,.94))'
const SKIN_CSS = '@keyframes mskinShard{0%{transform:translate(0,0) rotate(0deg);opacity:1}100%{transform:translate(var(--dx),var(--dy)) rotate(var(--rot));opacity:0}}@keyframes mskinFlash{0%{opacity:1}100%{opacity:0}}'
type SkinPopT = { key: number; w: number } | null
/** one poll of the skin's look; returns a pop to draw when popAt moved since the last poll */
function skinTick(v: SkinVitals, el: HTMLDivElement | null, st: { w: number; seen: number }): { w: number } | null {
  if (!v.skin) return null
  const w = Math.max(0, Math.min(1, v.shield / (v.hpMax || 1)))
  if (el) {
    const low = v.shield > 0 && v.shieldMax > 0 && v.shield < 0.25 * v.shieldMax
    el.style.background = low ? `repeating-linear-gradient(118deg, transparent 0 5px, rgba(36,64,96,.6) 5px 6px), ${SKIN_BG}` : SKIN_BG
    el.style.boxShadow = 'inset 0 0 3px rgba(255,255,255,.95), inset -1px 0 0 #fff'
    el.style.opacity = low && Math.random() < 0.4 ? '0.3' : '1'
    el.dataset.skin = low ? 'low' : w > 0 ? 'on' : 'off'
  }
  let pop: { w: number } | null = null
  if (Number.isNaN(st.seen)) st.seen = v.popAt ?? 0
  else if ((v.popAt ?? 0) > st.seen) { st.seen = v.popAt!; pop = { w: st.w || 0.1 } }
  if (w > 0) st.w = Math.max(w, Math.min(1, v.shieldMax / (v.hpMax || 1)))   // shards spread over the skin's FULL size: a pop always comes off a sliver
  return pop
}
/** the shatter: seven shards of the highlight fly up and off the bar, and a white flash round its edge */
function SkinPop({ pop, r = 999 }: { pop: SkinPopT; r?: number }) {
  if (!pop) return null
  const n = 7
  return (
    <div key={pop.key} data-skin-pop className="absolute inset-0 pointer-events-none" style={{ overflow: 'visible' }}>
      <style>{SKIN_CSS}</style>
      {Array.from({ length: n }, (_, i) => (
        <span key={i} style={{
          position: 'absolute', left: `${((i + 0.5) / n) * pop.w * 100}%`, top: 0, width: 7, height: '100%', marginLeft: -3, background: SKIN_BG,
          clipPath: i % 2 ? 'polygon(0 0, 100% 20%, 70% 100%, 10% 80%)' : 'polygon(20% 0, 100% 0, 80% 90%, 0 100%)',
          animation: 'mskinShard 620ms cubic-bezier(.2,.7,.4,1) forwards',
          ['--dx' as string]: `${(i - (n - 1) / 2) * 7 + (i % 3 - 1) * 3}px`, ['--dy' as string]: `${-(12 + ((i * 7) % 13))}px`, ['--rot' as string]: `${(i % 2 ? 1 : -1) * (50 + i * 23)}deg`,
        } as React.CSSProperties} />
      ))}
      <span style={{ position: 'absolute', inset: -2, borderRadius: r, boxShadow: '0 0 0 2px #fff, 0 0 12px 4px rgba(255,255,255,.9)', animation: 'mskinFlash 300ms ease-out forwards' }} />
    </div>
  )
}
/** the pop state a bar draws: set by its poller on a pop, cleared once the shards are gone */
function useSkinPop() {
  const [pop, setPop] = useState<SkinPopT>(null)
  const st = useRef({ w: 0, seen: NaN })
  const fire = (p: { w: number } | null) => { if (!p) return; const key = performance.now(); setPop({ key, w: p.w }); setTimeout(() => { if (!(window as unknown as { __skinPopHold?: boolean }).__skinPopHold) setPop(q => q?.key === key ? null : q) }, 900) }   // __skinPopHold: a check freezing the shatter for its shot
  return { pop, st: st.current, fire }
}

// ── bottom-left: health + shield ─────────────────────────────────────────────────────────────
/** Drop-in for `voxel3d/resource-bars.tsx` `ResourceBars`, and it keeps every rule that file
 *  documents: ONE bar, both fills scaled to `hpMax`, the shield laid OVER health from the same left
 *  edge (the order a hit spends them), "+N" hidden at zero, refs polled at 10 Hz and written to the
 *  DOM, rounded for display only. Not self-positioned: the corner belongs to whoever owns it. */
export function HearthVitals({ face, vitals }: { face: HudFace; vitals: React.RefObject<SkinVitals> }) {
  const t = HUD_FACES[face]
  const sk = useSkinPop()
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
      sk.fire(skinTick(v, shEl.current, sk.st))
    }, 100)
    return () => clearInterval(id)
  }, [vitals])   // eslint-disable-line react-hooks/exhaustive-deps -- sk is stable (ref + setState)
  return (
    <HudPlate face={face} className="w-52 pointer-events-none">
      <div className="px-3 py-2" style={hearthBody}>
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-[14px]" style={{ ...hearthDisplay, color: t.text }}>Health</span>
          <span ref={shTxt} className="ml-auto text-[11px] font-bold tabular-nums" style={{ color: t.plus }} />
          <span ref={hpTxt} className="text-[12px] font-bold tabular-nums" style={{ color: t.text }}>0</span>
        </div>
        <div className="relative mt-1.5">
        <div className="relative h-2.5 rounded-full overflow-hidden" style={{ background: t.track, boxShadow: 'inset 0 1px 2px rgba(0,0,0,.4)' }}>
          <div ref={hpEl} className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-100"
               style={{ width: '100%', background: 'linear-gradient(180deg, #d9735a, #a8482f)' }} />
          {/* The shield: sky, OVER the health, never beside it (see resource-bars.tsx). M59: the Mana Skin's look when skin. */}
          <div ref={shEl} data-shield className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-100"
               style={{ width: '0%', background: 'rgba(125,177,210,.8)', boxShadow: 'inset -1px 0 0 rgba(235,245,255,.7)' }} />
        </div>
        <SkinPop pop={sk.pop} />
        </div>
      </div>
    </HudPlate>
  )
}

// ── bottom-left, above the vitals: what you drank ────────────────────────────────────────────
/** Drop-in for `voxel3d/buff-chips.tsx` `BuffChips`: one chip per running drink, a 1 s beat (a buff
 *  is a wall-clock timer, a per-frame render would cost the world its frames), dimmed when the buff
 *  is not felt here yet, nothing at all when nothing runs. */
// ── chips: one small readout plate, used everywhere a HUD says a short thing ─────────────────
// ★ ONE CHIP (2026-09-23). The Ather's buff chips, and the mortal side's companion, wounded and buff
// chips, were four hand-rolled dark pills that differed in padding, font and tone for no reason.
// They are this now. `glyph` carries the thing's own colour (a buff's, a wound's); the NAME is ink,
// in the display face; `value` is the dim tabular readout. An `onClick` makes it a button.

/** "m:ss", rounded UP: a timer that reads 0:00 while the effect is still running is wrong. */
export const fmtRemain = (ms: number): string => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function HearthChip({ face, glyph, glyphColor, name, nameColor, value, sub, title, onClick, dim = false, maxWidth }: {
  face: HudFace
  glyph: React.ReactNode
  glyphColor?: string
  name: string
  /** Override the ink for a name that IS the state (a downed spirit reads rust). */
  nameColor?: string
  value?: React.ReactNode
  /** A second, smaller line under the name (the companion's perk). */
  sub?: React.ReactNode
  title?: string
  onClick?: () => void
  /** Present but not felt here yet (a buff this world has not wired). */
  dim?: boolean
  maxWidth?: number
}) {
  const t = HUD_FACES[face]
  const body = (
    <div className="flex items-center gap-2 px-2.5 py-0.5 text-[12px] text-left" style={{ ...hearthBody, maxWidth }}>
      <span className="leading-none" style={{ color: glyphColor }}>{glyph}</span>
      <span className="flex flex-col min-w-0">
        <span className="font-semibold whitespace-nowrap" style={{ ...hearthDisplay, color: nameColor ?? t.text }}>{name}</span>
        {sub && <span className="text-[10px] whitespace-nowrap overflow-hidden text-ellipsis" style={{ color: t.textDim }}>{sub}</span>}
      </span>
      {value !== undefined && <span className="tabular-nums whitespace-nowrap" style={{ color: t.textDim }}>{value}</span>}
    </div>
  )
  const plate = <HudPlate face={face} r={999} style={{ opacity: dim ? 0.6 : 1 }}>{body}</HudPlate>
  return onClick
    ? <button type="button" onClick={onClick} title={title} className="block transition-transform hover:scale-[1.03] active:scale-[.98]">{plate}</button>
    : <div title={title}>{plate}</div>
}

/**
 * A one-line prompt or readout that floats over the world — "E — Talk to Gregory", the match clock,
 * the placement hint. The plate every such line sits on, so none of them rolls its own dark pill
 * (the play3d hearth pass, 2026-09-23, retired nine hand-rolled ones). The CALLER places it; the pill
 * only owns its face. `accent` lights the rim for a line that is the act (a bite, a station's hue);
 * `muted` spans (`<HearthPillSoft>`) carry the key hint.
 */
export function HearthPill({ face, accent, style, children, className = '' }: {
  face: HudFace; accent?: string; style?: React.CSSProperties; children: React.ReactNode; className?: string
}) {
  const t = HUD_FACES[face]
  return (
    <div className={`pointer-events-none whitespace-nowrap ${className}`} style={style}>
      <HudPlate face={face} r={999} style={accent ? { boxShadow: `${t.plateShadow}, 0 0 0 2px ${accent}` } : undefined}>
        <div className="px-3.5 py-1 text-[13px] font-bold tabular-nums" style={hearthBody}>{children}</div>
      </HudPlate>
    </div>
  )
}
export function HearthPillSoft({ face, children }: { face: HudFace; children: React.ReactNode }) {
  return <span className="font-semibold" style={{ color: HUD_FACES[face].textDim }}>{children}</span>
}

export function HearthBuffChips({ face, buffs, top }: {
  face: HudFace; buffs: React.RefObject<ActiveBuffs>
  /** Compact/phone: hang from the TOP-left at this offset — the bottom-left corner has gone to the
   *  hotbar's lip (and, on a phone, to where a thumb will be). Omitted = the wide bottom-left spot. */
  top?: number
}) {
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
        const felt = WIRED_BUFFS.has(b.id)
        return <HearthChip key={b.id} face={face} glyph={b.glyph} glyphColor={b.color} name={b.name}
                           value={fmtRemain(b.remainMs)} dim={!felt} title={felt ? b.name : `${b.name} — not felt here yet`} />
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
/** Phone: a 96px window. Both minimaps (`VoxelMiniMap`, play3d's `MiniMap`) take their box from
 *  `hudMapBox`, so the canvas and this frame are one box by construction. */
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
function LipBar({ face, fillRef, overRef, txtRef, color, glyph, pop }: {
  face: HudFace; color: string; glyph: string; pop?: SkinPopT
  fillRef: React.RefObject<HTMLDivElement | null>
  overRef?: React.RefObject<HTMLDivElement | null>
  txtRef: React.RefObject<HTMLSpanElement | null>
}) {
  const t = HUD_FACES[face]
  return (
    <div className="flex-1 min-w-0 flex items-center gap-1.5">
      <span className="text-[11px] leading-none" style={{ color }}>{glyph}</span>
      <div className="relative flex-1 h-2">
      <div className="relative h-2 rounded-full overflow-hidden" style={{ background: t.track, boxShadow: 'inset 0 1px 2px rgba(0,0,0,.4)' }}>
        <div ref={fillRef} className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-100"
             style={{ width: '100%', background: color }} />
        {overRef && <div ref={overRef} data-shield className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-100"
                         style={{ width: '0%', background: 'rgba(125,177,210,.85)', boxShadow: 'inset -1px 0 0 rgba(235,245,255,.7)' }} />}
      </div>
      <SkinPop pop={pop ?? null} />
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
  /** Omitted = no health on the lip (the mortal side has no always-on health). */
  vitals?: React.RefObject<SkinVitals>
  /** Pass on a phone (the orb is gone); omit where the orb still stands. */
  mana?: React.RefObject<{ cur: number; max: number; regen: number } | null>
  tools?: React.ReactNode
}) {
  const t = HUD_FACES[face]
  const hp = useRef<HTMLDivElement>(null), sh = useRef<HTMLDivElement>(null), hpT = useRef<HTMLSpanElement>(null), shT = useRef<HTMLSpanElement>(null)
  const sk = useSkinPop()
  const mp = useRef<HTMLDivElement>(null), mpT = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const id = setInterval(() => {
      const v = vitals?.current
      if (v) {
        const max = v.hpMax || 1
        if (hp.current) hp.current.style.width = `${Math.max(0, (v.hp / max) * 100)}%`
        if (sh.current) sh.current.style.width = `${Math.max(0, Math.min(1, v.shield / max)) * 100}%`
        if (hpT.current) { const s = `${Math.round(v.hp)}`; if (hpT.current.textContent !== s) hpT.current.textContent = s }
        if (shT.current) { const s = v.skin && v.shield > 0.5 ? `+${Math.round(v.shield)}` : ''; if (shT.current.textContent !== s) shT.current.textContent = s }   // M59: the skin's own number
        sk.fire(skinTick(v, sh.current, sk.st))
      }
      const m = mana?.current
      if (m) {
        // `manaFraction`, not cur/max: max is genuinely 0 at mount (see mana-gauge.tsx).
        if (mp.current) mp.current.style.width = `${manaFraction(m.cur, m.max) * 100}%`
        if (mpT.current) { const s = `${Math.floor(m.cur)}`; if (mpT.current.textContent !== s) mpT.current.textContent = s }
      }
    }, 100)
    return () => clearInterval(id)
  }, [vitals, mana])   // eslint-disable-line react-hooks/exhaustive-deps -- sk is stable (ref + setState)
  return (
    <div className="flex items-center gap-3 px-2 py-1 rounded-[10px]" style={{ background: t.plate, boxShadow: face === 'full' ? 'inset 0 1px 3px rgba(58,39,22,.4)' : undefined }}>
      {vitals && <LipBar face={face} fillRef={hp} overRef={sh} txtRef={hpT} color="#b9543a" glyph="♥" pop={sk.pop} />}
      {/* M59: the skin's +N in a FIXED slot (fits +60), so it coming and going never resizes the health bar; only where the page opts in */}
      {vitals?.current?.skin && <span ref={shT} data-skin-num className="text-[10px] font-bold tabular-nums leading-none -ml-1.5" style={{ ...hearthBody, color: t.plus, width: 20, flex: 'none' }} />}
      {mana && <LipBar face={face} fillRef={mp} txtRef={mpT} color="#7657b4" glyph="✦" />}
      {tools}
    </div>
  )
}

/** A tool as a pip: phone-sized stand-in for a `hud-corner` socket. Level in the middle, XP as a
 *  ring, the act-here ember when that family is working. Data in, so the corner derives it. */
export type ToolPip = { family: string; level: number; xpPct: number; active: boolean
  /** M184: false = an EMPTY pip (the tool not handed yet); stage 0 worn, 1..3 upgrades; ringPct / ringColor = the upgrade's ring */
  held?: boolean; stage?: number; ringPct?: number | null; ringColor?: string | null }
export function HearthToolPips({ face, pips, onPick, picked = null }: { face: HudFace; pips: readonly ToolPip[]
  /** M184 s2: tap a pip = the tool panel; omitted = inert */
  onPick?: (family: string) => void; picked?: string | null }) {
  const t = HUD_FACES[face]
  const R = 9, C = 2 * Math.PI * R
  // a pip as a button: a 34 px touch target round the 22 px pip (the lip is tight, so it overlaps its neighbours' air)
  const tap = (p: ToolPip, el: React.ReactElement) => !onPick ? el : (
    <button key={p.family} type="button" data-dial-btn={p.family} aria-label={p.family} aria-expanded={picked === p.family}
      onClick={e => { e.stopPropagation(); onPick(p.family) }}
      className={`pointer-events-auto relative grid place-items-center -m-1.5 p-1.5 rounded-full transition-transform duration-150 active:scale-110 ${picked === p.family ? 'scale-110 brightness-125' : ''}`}>{el}</button>
  )
  return (
    <div className="flex items-center gap-1 shrink-0">
      {pips.map(p => tap(p, p.held === false ? (
        <div key={p.family} title={p.family} data-pip={p.family} data-held="0" className="relative w-[22px] h-[22px] rounded-full"
             style={{ background: t.well, opacity: 0.55, outline: `1px dashed ${face === 'full' ? 'rgba(58,39,22,.4)' : 'rgba(255,255,255,.35)'}`, outlineOffset: -3 }} />
      ) : (
        <div key={p.family} title={p.family} data-pip={p.family} data-held="1" data-stage={p.stage ?? ''} className="relative w-[22px] h-[22px] rounded-full grid place-items-center"
             style={{ background: t.well, boxShadow: p.active ? t.wellSelShadow : t.wellShadow }}>
          {p.ringColor && p.ringPct != null && (   // M184: the upgrade's ring, its colour, the arc = durability left
            <svg viewBox="0 0 26 26" className="absolute -inset-[2px] w-[26px] h-[26px] -rotate-90" data-ring-arc>
              <circle cx="13" cy="13" r="12" fill="none" stroke={p.ringColor} strokeWidth="1.6" strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 12} strokeDashoffset={2 * Math.PI * 12 * (1 - p.ringPct)} />
            </svg>
          )}
          <svg viewBox="0 0 22 22" className="absolute inset-0 -rotate-90">
            <circle cx="11" cy="11" r={R} fill="none" stroke={face === 'full' ? H.moss : '#9cc58a'} strokeWidth="2"
                    strokeDasharray={C} strokeDashoffset={C * (1 - Math.max(0, Math.min(1, p.xpPct)))} strokeLinecap="round" />
          </svg>
          <span className="relative text-[9px] font-extrabold tabular-nums" style={{ ...hearthBody, color: t.count }}>{p.level}</span>
        </div>
      )))}
    </div>
  )
}

// ── top-centre: the compass (2026-11-15, hub — Alex: "the same ui throughout the whole game; compass, minimap…") ──
/** Heading convention, same as the walker and the courser (a YXZ camera looks along (−sin yaw, 0, −cos yaw)):
 *  north = −Z, east = +X, so heading° = −yaw in degrees, and the bearing to a point is atan2(dx, −dz). */
export const headingDeg = (yaw: number) => (((-yaw * 180) / Math.PI) % 360 + 360) % 360
export const bearingDeg = (fromX: number, fromZ: number, toX: number, toZ: number) =>
  ((Math.atan2(toX - fromX, -(toZ - fromZ)) * 180) / Math.PI + 360) % 360
/** −180..180: how far right of the heading a bearing sits. */
export const relDeg = (bearing: number, heading: number) => ((bearing - heading + 540) % 360) - 180

export type CompassPose = { x: number; z: number; yaw: number }
/** The compass strip's width per size (its plate adds the rim on each side). */
export const compassWidth = (size: HudSize) => (size === 'phone' ? 190 : size === 'compact' ? 240 : 260)   // 260: centred on the screen at 1280 beside the top-left bar
export type CompassMark = { x: number; z: number; color: string; title?: string; /** a sun-glint instead of a pip (the active quest): brightens as you face it */ glare?: boolean }
const CARD: Record<number, string> = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' }

/** A strip that slides under a fixed notch: 120° of view, a tick every 15°, cardinals in the display face (N in the
 *  accent). `marks` are places the host wants pointed at (a node, a waymark): a pip at their bearing, pinned to the
 *  strip's edge (dimmed) when they are behind you. Polled from refs, never re-rendered (the hearth HUD rule). */
export function HearthCompass({ face, pose, marks, size = 'wide', top, centerX }: {
  face: HudFace; pose: React.RefObject<CompassPose | null>; marks?: React.RefObject<readonly CompassMark[]>
  size?: HudSize; top?: number
  /** px from the left edge to the compass's centre; omitted = the screen's centre */
  centerX?: number
}) {
  const t = HUD_FACES[face]
  const W = compassWidth(size), FIELD = 120, PPD = W / FIELD
  const strip = useRef<HTMLDivElement>(null), pips = useRef<HTMLDivElement>(null), read = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    let id = 0
    const tick = () => {
      id = requestAnimationFrame(tick)
      const p = pose.current; if (!p) return
      const h = headingDeg(p.yaw)
      if (strip.current) strip.current.style.transform = `translateX(${(W / 2 - (h + 360) * PPD).toFixed(1)}px)`
      if (read.current) { const s = `${Math.round(h) % 360}°`; if (read.current.textContent !== s) read.current.textContent = s }
      const box = pips.current, ms = marks?.current ?? []
      if (box) {
        while (box.children.length < ms.length) { const d = document.createElement('div'); d.style.cssText = 'position:absolute;top:50%;width:9px;height:9px;margin:-4.5px;border-radius:9px;transition:opacity .2s'; box.appendChild(d) }
        for (let i = 0; i < box.children.length; i++) {
          const el = box.children[i] as HTMLDivElement, m = ms[i]
          if (!m) { el.style.display = 'none'; continue }
          const r = relDeg(bearingDeg(p.x, p.z, m.x, m.z), h), lim = FIELD / 2 - 3, inView = Math.abs(r) <= lim
          el.style.display = 'block'; el.title = m.title ?? ''
          el.style.left = `${(W / 2 + Math.max(-lim, Math.min(lim, r)) * PPD).toFixed(1)}px`
          if (m.glare) {
            // the quest's GLARE: a warm radial glow with a small four-point star flare, brighter the nearer it sits to the notch
            const bright = inView ? 0.55 + 0.45 * Math.max(0, 1 - Math.abs(r) / 25) : 0.3
            if (!el.dataset.star) { el.dataset.star = '1'; el.innerHTML = '<i style="position:absolute;left:0;right:0;top:50%;height:1px;margin-top:-.5px;background:#fff3d6"></i><i style="position:absolute;top:0;bottom:0;left:50%;width:1px;margin-left:-.5px;background:#fff3d6"></i>' }
            el.dataset.glare = '1'; el.dataset.rel = r.toFixed(1); el.dataset.bright = bright.toFixed(2)
            el.style.width = '30px'; el.style.height = '30px'; el.style.margin = '-15px'; el.style.borderRadius = '30px'
            el.style.background = 'radial-gradient(circle, #fff3d6 0%, #ffb866 18%, rgba(255,154,74,.55) 40%, rgba(255,154,74,0) 70%)'
            el.style.boxShadow = 'none'; el.style.opacity = bright.toFixed(2)
          } else {
            if (el.dataset.glare) { delete el.dataset.glare; el.dataset.star = ''; el.innerHTML = ''; el.style.width = '9px'; el.style.height = '9px'; el.style.margin = '-4.5px'; el.style.borderRadius = '9px' }
            el.style.background = m.color
            el.style.boxShadow = `0 0 0 1.5px ${face === 'full' ? '#3a2716' : 'rgba(0,0,0,.6)'}`
            el.style.opacity = inView ? '1' : '0.45'
          }
        }
      }
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [pose, marks, W, PPD, face])
  const ticks: React.ReactNode[] = []
  for (let d = 285; d <= 795; d += 15) {   // the window is (h+360) ± 60, h in 0..360
    const deg = d % 360, label = CARD[deg], major = deg % 90 === 0
    ticks.push(
      <div key={d} className="absolute top-0 flex flex-col items-center" style={{ left: d * PPD, transform: 'translateX(-50%)' }}>
        <div style={{ width: label ? 2 : 1, height: label ? 7 : 4, background: label ? t.text : t.textDim, opacity: label ? 0.9 : 0.6 }} />
        {label && <div className="leading-none mt-0.5" style={{ ...hearthDisplay, fontSize: major ? 13 : 10, fontWeight: 700, color: deg === 0 ? t.accent : major ? t.text : t.textDim }}>{label}</div>}
      </div>,
    )
  }
  return (
    <div className="pointer-events-none" style={{ position: 'fixed', top: top ?? (size === 'phone' ? 8 : 12), left: centerX ?? '50%', transform: 'translateX(-50%)', zIndex: 34 }} data-hud="compass">
      <HudPlate face={face} r={12}>
        <div className="relative overflow-hidden" style={{ width: W, height: 28 }}>
          <div ref={strip} className="absolute left-0 top-1" style={{ width: 800 * PPD, height: 22 }}>{ticks}</div>
          <div ref={pips} className="absolute inset-x-0" style={{ top: 22, height: 0 }} />
          {/* the notch: where you face */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2" style={{ width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: `6px solid ${t.accent}` }} />
          <div className="absolute inset-y-0 left-0 w-8" style={{ background: `linear-gradient(90deg, ${face === 'full' ? 'rgba(233,215,180,.95)' : 'rgba(20,14,8,.8)'}, transparent)` }} />
          <div className="absolute inset-y-0 right-0 w-8" style={{ background: `linear-gradient(270deg, ${face === 'full' ? 'rgba(233,215,180,.95)' : 'rgba(20,14,8,.8)'}, transparent)` }} />
        </div>
      </HudPlate>
      <div className="text-center mt-0.5 text-[10px] font-bold tabular-nums" style={{ ...hearthBody, color: '#f4efe2', textShadow: '0 1px 3px rgba(0,0,0,.85)' }}><span ref={read} /></div>
    </div>
  )
}
