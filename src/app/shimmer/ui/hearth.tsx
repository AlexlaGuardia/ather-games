'use client'
// THE CARVED HEARTH — Shimmer's menu kit.
//
// ── ★ WHY (2026-09-22, Alex blessed direction B at /shimmer/dev/hearth: "thats looking sooo much
//    better … ik there are alot of stations and menus throughout the game we should update") ────
// The in-game panels wore the arcade cabinets' chrome — dark plates, scanlines, squared caps — which
// is a neon terminal floating over a sunfruit meadow. Research (SHIMMER_MENU_RESEARCH.md) found every
// cozy/crafting reference lands on warm, soft, rounded, gently moving menus. This is that register,
// built once: a carved wood frame around a parchment window, ink text, ONE ember accent for "act
// here", moss for have, rust for short, sky for where-it-is-made.
//
// ★ A PANEL WEARS THE HEARTH BY USING THESE PIECES, NOT BY COPYING THEIR COLOURS. Every token lives in
// `H` so a retune is one edit. The rollout plan (the same doc, § ROLLOUT PLAN) moves each panel onto
// this kit in phases; the dev page mounts the same pieces, so what Alex judged is what ships.
//
// The wood is procedural (an SVG turbulence stretched along the board). If the frame ever gets drawn
// art, `WOOD` is the one line it replaces.
import React from 'react'
import { CraftIcon } from '../voxel3d/craft-grid'
import { HEARTH_FONT_VARS } from './hearth-fonts'
import './hearth.css'

// ── tokens ─────────────────────────────────────────────────────────────────────────────────────
export const H = {
  ink: '#3a2716', inkSoft: '#6b5238', inkFaint: '#9a8163',
  ember: '#c8642a', emberHi: '#e0823f', emberLo: '#8d4119',
  moss: '#5f7d45', rust: '#a8482f', sky: '#4f7690',
  paperHi: '#fbf4e4', paper: '#f5ebd5', paperLo: '#e8d8b8', tabIdle: 'rgba(214,191,149,.45)',
  rule: 'rgba(58,39,22,.22)',
} as const
export const hearthDisplay: React.CSSProperties = { fontFamily: 'var(--font-hearth-display), Georgia, serif' }
export const hearthBody: React.CSSProperties = { fontFamily: 'var(--font-hearth-body), system-ui, sans-serif' }

/** One SVG grain: stretched along a board for wood, fine and square for paper. */
export const grain = (fx: number, fy: number, oct: number, alpha: number) =>
  `url("data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='${fx} ${fy}' numOctaves='${oct}' seed='7'/><feColorMatrix values='0 0 0 0 0.16  0 0 0 0 0.09  0 0 0 0 0.04  0 0 0 ${alpha} 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`)}")`
export const WOOD = `${grain(0.006, 0.35, 4, 0.9)}, ${grain(0.02, 0.6, 2, 0.35)}, linear-gradient(180deg, #8a5a32 0%, #6a4222 45%, #50311a 100%)`
export const PAPER = `${grain(0.9, 0.9, 2, 0.10)}, radial-gradient(120% 90% at 50% 0%, #f7eedb 0%, #efe1c3 70%, #e6d3ae 100%)`
const KNOB = `${grain(0.02, 0.3, 3, 0.5)}, radial-gradient(circle at 35% 30%, #8a5b33, #4a2d18)`
const PLAQUE = `${grain(0.015, 0.3, 3, 0.5)}, linear-gradient(180deg, #8c5d34, #5a371d)`

// ── the frame ──────────────────────────────────────────────────────────────────────────────────
/** The close knob: same glyph, same corner on every panel (the PanelFrame contract), carved. */
export function HearthX({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); onClick() }} aria-label="close" title="close (esc)"
            className="absolute -top-3 -right-3 z-30 w-9 h-9 rounded-full grid place-items-center transition-transform hover:scale-105 active:scale-95"
            style={{ background: KNOB, boxShadow: '0 3px 6px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,220,170,.35), inset 0 -2px 3px rgba(0,0,0,.4)' }}>
      <svg width="12" height="12" viewBox="0 0 10 10" aria-hidden="true">
        <path d="M1.8 1.8 L8.2 8.2 M8.2 1.8 L1.8 8.2" stroke="#f1dfbf" strokeWidth="1.7" strokeLinecap="round" fill="none" />
      </svg>
    </button>
  )
}

/**
 * Backdrop + carved frame + title plaque + the X + a parchment scroll body. `maxWidth` in px; the
 * card never exceeds the screen minus a 16px gutter each side, so a phone gets the whole width.
 * With `backdrop={false}` it is only the card, for a host that already owns placement.
 */
export function HearthFrame({ title, maxWidth = 520, onClose, dataPanel, children, backdrop = true, bodyClass = '' }: {
  title: string
  maxWidth?: number
  onClose: () => void
  dataPanel?: string
  children: React.ReactNode
  backdrop?: boolean
  bodyClass?: string
}) {
  const card = (
    <div data-panel={dataPanel} onClick={(e) => e.stopPropagation()}
         className={`hearth-root hearth-open relative ${HEARTH_FONT_VARS}`}
         style={{ width: `min(${maxWidth}px, calc(100vw - 32px))`, ...hearthBody }}>
      <HearthX onClick={onClose} />
      <div className="rounded-[18px] p-[13px]"
           style={{ background: WOOD, boxShadow: '0 18px 40px rgba(20,10,4,.55), 0 4px 10px rgba(20,10,4,.4), inset 0 1px 0 rgba(255,210,160,.35), inset 0 -2px 0 rgba(0,0,0,.35)' }}>
        <div className="absolute left-1/2 -translate-x-1/2 -top-4 z-20 px-6 h-9 rounded-full flex items-center whitespace-nowrap"
             style={{ background: PLAQUE, boxShadow: '0 4px 8px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,215,170,.4), inset 0 -2px 2px rgba(0,0,0,.35)' }}>
          <span className="text-[19px] font-semibold" style={{ ...hearthDisplay, color: '#f6e4c2', textShadow: '0 1px 0 rgba(0,0,0,.5)' }}>{title}</span>
        </div>
        <div className="rounded-[10px] overflow-hidden"
             style={{ background: PAPER, boxShadow: 'inset 0 2px 6px rgba(58,39,22,.45), inset 0 0 0 1px rgba(58,39,22,.35)' }}>
          <div className={`max-h-[78vh] overflow-y-auto hearth-scroll ${bodyClass}`} style={{ color: H.ink }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
  if (!backdrop) return card
  return (
    <div className="absolute inset-0 grid place-items-center bg-black/25 backdrop-blur-[3px] pointer-events-auto" onClick={onClose}>
      {card}
    </div>
  )
}

/** The sticky head of a scrolling panel: parchment that fades out over what scrolls under it. */
export function HearthHead({ children }: { children: React.ReactNode }) {
  return <div className="sticky top-0 z-10 px-4 pt-6 pb-3" style={{ background: `linear-gradient(180deg, ${H.paper} 85%, rgba(245,235,213,0))` }}>{children}</div>
}

/** The quiet italic line under a title: where you are, what the panel is drawing on. */
export function HearthNote({ children }: { children: React.ReactNode }) {
  return <span className="text-[13px] italic" style={{ ...hearthDisplay, color: H.inkSoft }}>{children}</span>
}

// ── navigation ─────────────────────────────────────────────────────────────────────────────────
export function HearthTabs({ tabs, active, onPick }: {
  tabs: { id: string; label: string; count?: number }[]
  active: string | null
  onPick: (id: string) => void
}) {
  return (
    <>
      <div className="flex items-end gap-1 flex-wrap">
        {tabs.map(t => {
          const on = t.id === active
          return (
            <button key={t.id} onClick={() => onPick(t.id)}
                    className="relative px-3 pt-1.5 pb-2 rounded-t-[10px] text-[13px] font-bold transition-all min-h-[36px]"
                    style={on
                      ? { background: H.paperHi, color: H.ink, boxShadow: `0 -1px 3px rgba(58,39,22,.18), inset 0 -3px 0 ${H.ember}` }
                      : { background: H.tabIdle, color: H.inkSoft, transform: 'translateY(2px)' }}>
              {t.label}
              {t.count !== undefined && <span className="ml-1.5 text-[11px] font-semibold tabular-nums" style={{ color: t.count ? H.moss : H.inkFaint }}>{t.count}</span>}
            </button>
          )
        })}
      </div>
      <div className="h-px -mt-px" style={{ background: 'rgba(58,39,22,.25)' }} />
    </>
  )
}

export function HearthSearch({ value, onChange, placeholder = 'Find…', width = 96 }: { value: string; onChange: (v: string) => void; placeholder?: string; width?: number }) {
  return (
    <label className="flex items-center gap-1.5 h-8 px-3 rounded-full shrink-0"
           style={{ background: H.paperLo, boxShadow: 'inset 0 1px 3px rgba(58,39,22,.35)' }}>
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><circle cx="5" cy="5" r="3.6" stroke={H.inkSoft} strokeWidth="1.5" fill="none" /><path d="M7.8 7.8 L11 11" stroke={H.inkSoft} strokeWidth="1.5" strokeLinecap="round" /></svg>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
             onKeyDown={e => e.stopPropagation()}
             className="bg-transparent outline-none text-[13px]" style={{ color: H.ink, width }} />
    </label>
  )
}

// ── things ─────────────────────────────────────────────────────────────────────────────────────
/** A carved icon well. `dim` = you cannot make / use it yet. */
export function Well({ itemId, size = 62, dim, children }: { itemId?: string; size?: number; dim?: boolean; children?: React.ReactNode }) {
  return (
    <span className="grid place-items-center shrink-0 rounded-[10px]"
          style={{ width: size, height: size,
                   background: 'radial-gradient(circle at 50% 40%, #e9d7b4, #d6bf95)',
                   boxShadow: 'inset 0 2px 4px rgba(74,45,24,.45), inset 0 -1px 0 rgba(255,250,235,.7), 0 1px 0 rgba(255,250,235,.6)',
                   filter: dim ? 'grayscale(.7) opacity(.55)' : undefined }}>
      {itemId ? <CraftIcon itemId={itemId} size={Math.round(size * 0.7)} /> : children}
    </span>
  )
}

/** A stock count pinned to a tile's corner. */
export function HearthBadge({ n }: { n: number }) {
  return (
    <span className="absolute top-0.5 right-1.5 min-w-5 h-5 px-1 rounded-full text-[11px] font-extrabold grid place-items-center tabular-nums"
          style={{ background: H.paperHi, color: H.inkSoft, boxShadow: '0 1px 2px rgba(58,39,22,.35)' }}>{n}</span>
  )
}

/** A tile: a well + its name, the grid's unit. Picked = an ember ring. */
export function HearthTile({ itemId, name, count, can = true, picked, onClick, index = 0, size = 62 }: {
  itemId: string; name: string; count?: number; can?: boolean; picked?: boolean; onClick?: () => void; index?: number; size?: number
}) {
  return (
    <button onClick={onClick} title={name}
            className="hearth-tile group relative flex flex-col items-center gap-1 pt-1.5 pb-1 rounded-[12px] transition-all"
            style={{ animationDelay: `${Math.min(index, 14) * 18}ms`,
                     background: picked ? 'rgba(200,100,42,.13)' : 'transparent',
                     boxShadow: picked ? `inset 0 0 0 2px ${H.ember}` : undefined }}>
      <span className="transition-transform group-hover:-translate-y-0.5"><Well itemId={itemId} size={size} dim={!can} /></span>
      <span className="text-[12px] leading-[14px] text-center line-clamp-2 px-0.5 font-semibold" style={{ color: can ? H.ink : H.inkFaint }}>{name}</span>
      {!!count && count > 0 && <HearthBadge n={count} />}
    </button>
  )
}

export function HearthButton({ primary, disabled, children, onClick, small }: { primary?: boolean; disabled?: boolean; children: React.ReactNode; onClick: () => void; small?: boolean }) {
  const style: React.CSSProperties = disabled
    ? { background: '#e3d2b1', color: H.inkFaint, boxShadow: 'inset 0 1px 2px rgba(74,45,24,.25)' }
    : primary
      ? { background: `linear-gradient(180deg, ${H.emberHi}, ${H.ember})`, color: '#fff7ea', boxShadow: `0 2px 0 ${H.emberLo}, 0 3px 6px rgba(74,45,24,.35), inset 0 1px 0 rgba(255,225,190,.6)` }
      : { background: 'linear-gradient(180deg, #f6ead2, #e7d5b2)', color: H.ink, boxShadow: '0 2px 0 #b99a6c, 0 3px 5px rgba(74,45,24,.2), inset 0 1px 0 #fffaf0' }
  return (
    <button disabled={disabled} onClick={onClick}
            className={`${small ? 'h-8 px-3 text-[12px]' : 'h-9 px-4 text-[13px]'} rounded-full font-extrabold transition-transform whitespace-nowrap ${disabled ? 'cursor-not-allowed' : 'hover:-translate-y-px active:translate-y-[2px]'}`}
            style={{ ...hearthBody, ...style }}>{children}</button>
  )
}

/** The lifted-paper card: what you picked, what it takes, the button to do it. Keyed by the pick so it re-lands. */
export function HearthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="hearth-card rounded-[12px] px-3.5 py-3 flex items-center gap-3"
         style={{ background: 'linear-gradient(180deg, #fffaf0, #f6ead2)', boxShadow: '0 6px 14px rgba(58,39,22,.22), 0 1px 2px rgba(58,39,22,.25)', transform: 'rotate(-0.4deg)' }}>
      {children}
    </div>
  )
}

/** The card's empty state, held at the card's height so the grid does not jump when a pick lands. */
export function HearthCardEmpty({ children, minHeight = 92 }: { children: React.ReactNode; minHeight?: number }) {
  return (
    <div className="rounded-[12px] px-4 flex items-center gap-3 text-[13px] italic"
         style={{ minHeight, border: '1.5px dashed rgba(58,39,22,.25)', color: H.inkFaint }}>
      <span className="w-[58px] h-[58px] rounded-[10px] shrink-0" style={{ boxShadow: 'inset 0 2px 4px rgba(74,45,24,.25)' }} />
      {children}
    </div>
  )
}

/** An input's have/need: moss when covered, rust when short, and where the short one is made. */
export function CostChip({ itemId, label, have, need, madeAt }: { itemId: string; label: string; have: number; need: number; madeAt?: string }) {
  const ok = have >= need
  return (
    <span className="inline-flex items-center gap-1 h-6 pl-0.5 pr-2 rounded-full text-[12px] font-semibold"
          style={{ background: ok ? 'rgba(95,125,69,.14)' : 'rgba(168,72,47,.12)', color: ok ? H.moss : H.rust }}>
      <CraftIcon itemId={itemId} size={18} />
      {label}
      <span className="tabular-nums">{have}/{need}</span>
      {!ok && madeAt && <span className="font-medium" style={{ color: H.sky }}>· {madeAt}</span>}
    </span>
  )
}

/** A soft ruled divider with an italic word in it ("needs materials"). */
export function HearthDivider({ children }: { children?: React.ReactNode }) {
  return (
    <div className="col-span-full flex items-center gap-2 mt-1 text-[12px] italic" style={{ ...hearthDisplay, color: H.inkFaint }}>
      <span className="flex-1 h-px" style={{ background: H.rule }} />
      {children}
      {children && <span className="flex-1 h-px" style={{ background: H.rule }} />}
    </div>
  )
}
