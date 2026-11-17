'use client'
// THE BAG — the store every open-world page shares, the hotbar it feeds, and the menu (I) in the Carved Hearth frame
// with the red close (Alex 11-15). The rules are in inventory.ts (pure, tested); this is the glue and the look.
//
// Moving things, the same with a mouse or a thumb:
//   click a slot = pick it up (it lifts, ember ring) · click another = put it there (merge, else swap)
//   shift-click = send it across, hotbar ↔ bag · right-click = split the stack · drag and drop works too (desktop)

import React, { useState, useSyncExternalStore } from 'react'
import { HearthFrame, HearthLabel, Well, H, hearthDisplay } from '../../ui/hearth'
import type { HotbarEntry } from '../../hud/hotbar'
import { loadWaymarks } from '../ather/waymarks'
import { HOTBAR, BAG, SLOTS, itemDef, loadInv, saveInv, move, split, quickMove, makeBait, BAIT_FROM, type Inv } from './inventory'

// ── the store ────────────────────────────────────────────────────────────────────────────────────────────────
let inv: Inv | null = null
const subs = new Set<() => void>()
const get = (): Inv => {
  if (!inv) inv = typeof window === 'undefined' ? loadInvServer() : loadInv(Math.max(0, 12 - loadWaymarks().length))
  return inv
}
// ★ ONE object, not a builder: useSyncExternalStore requires getServerSnapshot to return the SAME value every call,
// or React logs "should be cached to avoid an infinite loop" (caught by Jin 1 on prod, 11-15).
const SERVER_INV: Inv = { v: 1, slots: Array(SLOTS).fill(null) }
const loadInvServer = (): Inv => SERVER_INV
export function setInv(next: Inv) { inv = next; saveInv(next); subs.forEach(f => f()) }
export const getInv = get
/** Stable across renders, so React does not resubscribe every frame. */
const subscribeInv = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
export function useInv(): Inv {
  return useSyncExternalStore(subscribeInv, get, loadInvServer)
}

/** The template's hotbar row from the bag's first eight slots. `count` overrides per item (the gun's clip). */
export function hotbarEntries(i: Inv, count: Record<string, number> = {}): (HotbarEntry | null)[] {
  return i.slots.slice(0, HOTBAR).map(s => s ? { itemId: s.id, count: count[s.id] ?? s.n, icon: itemDef(s.id).icon, name: itemDef(s.id).name } : null)
}
/** What the keeper holds: the item in the selected hotbar slot, or null. */
export const heldItem = (i: Inv, sel: number) => i.slots[sel]?.id ?? null

// ── the menu ─────────────────────────────────────────────────────────────────────────────────────────────────
function Slot({ i, at, sel, picked, onPick, onQuick, onSplit, onDrop }: {
  i: Inv; at: number; sel?: boolean; picked: boolean
  onPick: (at: number) => void; onQuick: (at: number) => void; onSplit: (at: number) => void; onDrop: (from: number, to: number) => void
}) {
  const s = i.slots[at], d = s ? itemDef(s.id) : null
  return (
    <button type="button" data-slot={at} title={d ? `${d.name}${s!.n > 1 ? ` × ${s!.n}` : ''}` : 'empty'}
      draggable={!!s} onDragStart={e => e.dataTransfer.setData('text/slot', String(at))}
      onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const f = Number(e.dataTransfer.getData('text/slot')); if (Number.isFinite(f)) onDrop(f, at) }}
      onClick={e => (e.shiftKey ? onQuick(at) : onPick(at))}
      onContextMenu={e => { e.preventDefault(); onSplit(at) }}
      className="relative rounded-[11px] transition-transform active:scale-95"
      style={{ transform: picked ? 'translateY(-4px)' : undefined, boxShadow: picked ? `0 0 0 2.5px ${H.ember}, 0 6px 10px rgba(58,39,22,.35)` : sel ? `0 0 0 2px ${H.ember}` : undefined, borderRadius: 11 }}>
      <Well size={54}>{s && d?.icon ? <img src={d.icon} alt="" width={36} height={36} draggable={false} /> : s ? <span className="text-[11px] font-bold" style={{ color: H.inkSoft }}>{d!.name.slice(0, 3)}</span> : null}</Well>
      {s && s.n > 1 && <span className="absolute bottom-0.5 right-1.5 text-[12px] font-extrabold tabular-nums" style={{ color: H.ink, textShadow: '0 1px 0 rgba(255,250,235,.8)' }}>{s.n}</span>}
      {at < HOTBAR && <span className="absolute top-0.5 left-1.5 text-[10px] font-bold" style={{ color: H.inkFaint }}>{at + 1}</span>}
    </button>
  )
}

/** The bag's footer hint, shared by the standalone menu and the pack's Bag tab. */
export const bagHint = (isTouch?: boolean) => isTouch ? 'Tap to pick up, tap again to place.' : 'Click to pick up, click to place · Shift-click: hotbar ↔ bag · Right-click: split'

export function BagMenu({ sel, onClose, isTouch }: { sel: number; onClose: () => void; isTouch?: boolean }) {
  return (
    <HearthFrame title="Bag" maxWidth={560} onClose={onClose} fixed dataPanel="bag"
      footer={<span className="text-[12px]">{bagHint(isTouch)} · I or Esc closes</span>}>
      <BagBody sel={sel} />
    </HearthFrame>
  )
}

/** The bag's contents without a frame: the pack (shared/pack.tsx) shows it as its Bag tab. */
export function BagBody({ sel }: { sel: number }) {
  const i = useInv()
  const [picked, setPicked] = useState<number | null>(null)
  const [look, setLook] = useState<number | null>(null)
  const pick = (at: number) => {
    if (picked === null) { if (i.slots[at]) { setPicked(at); setLook(at) } else setLook(null); return }
    setInv(move(i, picked, at)); setPicked(null); setLook(at)
  }
  const common = { i, onPick: pick, onQuick: (at: number) => { setInv(quickMove(i, at)); setPicked(null) }, onSplit: (at: number) => { setInv(split(i, at)); setPicked(null) }, onDrop: (f: number, t: number) => { setInv(move(i, f, t)); setPicked(null) } }
  const shown = look !== null ? i.slots[look] : i.slots[sel]
  const d = shown ? itemDef(shown.id) : null
  return (
    <>
      <div className="px-4 pt-7 pb-3">
        <HearthLabel>Hotbar · 1–8</HearthLabel>
        <div className="grid grid-cols-8 gap-1.5 mt-1.5 justify-items-center">
          {[...Array(HOTBAR).keys()].map(at => <Slot key={at} at={at} sel={at === sel} picked={picked === at} {...common} />)}
        </div>
        <div className="mt-4"><HearthLabel>Bag</HearthLabel></div>
        <div className="grid grid-cols-8 gap-1.5 mt-1.5 justify-items-center">
          {[...Array(BAG).keys()].map(k => <Slot key={k} at={k + HOTBAR} picked={picked === k + HOTBAR} {...common} />)}
        </div>
        <div className="mt-4 rounded-[12px] px-3 py-2.5 flex items-center gap-3 min-h-[64px]" style={{ background: 'rgba(255,250,235,.45)', boxShadow: `inset 0 0 0 1px ${H.rule}` }}>
          {shown && d ? (
            <>
              <Well size={44}>{d.icon ? <img src={d.icon} alt="" width={30} height={30} /> : null}</Well>
              <div className="min-w-0">
                <div className="text-[16px] font-semibold" style={{ ...hearthDisplay, color: H.ink }}>{d.name}{shown.n > 1 ? <span style={{ color: H.inkSoft }}> × {shown.n}</span> : null}</div>
                <div className="text-[12.5px] leading-snug" style={{ color: H.inkSoft }}>{d.blurb}</div>
              </div>
              {BAIT_FROM[shown.id] ? (
                // BETA M6e: bait is MADE (inventory.ts › makeBait). One per tap; the card stays on the slot.
                <button type="button" data-act="make-bait" className="ml-auto shrink-0 rounded-[10px] px-3 py-2 text-[13px] font-semibold"
                  style={{ ...hearthDisplay, color: H.ink, background: 'rgba(255,250,235,.85)', boxShadow: `inset 0 0 0 1px ${H.rule}` }}
                  onClick={() => { const r = makeBait(i, shown.id); if (r) setInv(r.inv) }}>
                  Make bait +{BAIT_FROM[shown.id]}
                </button>
              ) : null}
            </>
          ) : <div className="text-[12.5px]" style={{ color: H.inkFaint }}>Nothing picked. Choose a slot to see what is in it.</div>}
        </div>
      </div>
    </>
  )
}
