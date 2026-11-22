'use client'
// THE KEEPERS LIST (M12 step 4), in the Character tab. Signed-in only; anonymous renders nothing. The storage lives in
// lib/keeper-roster.ts. A swap rewrites the live keeper slots under a running page, so every swap ends in a reload.
// "New keeper" adds an EMPTY keeper and swaps to it: it has no birth rune, so the birth gate runs the ritual.
// M66 s3 (Alex 11-22): RENAME any keeper (its name is a keeper key, so it travels with swaps + the cloud) and DELETE an
// inactive one with a HELD press (never the active keeper: switch first). Neither needs a reload: a rename only writes
// the name key, and a delete only touches the removed keeper's parked copy + the roster.
import { useEffect, useRef, useState } from 'react'
import { H, hearthDisplay, HearthLabel, HearthButton } from '../ui/hearth'
import { saveOwner, saveOwnerResolved, SAVE_OWNER_EVENT } from '@/lib/save-slot'
import { ensureRoster, readRoster, addKeeper, swapKeeper, keeperBirthRune, keeperName, renameKeeper, removeKeeper,
         removeRefusal, ROSTER_CAP, KEEPER_NAME_MAX, type Roster } from '@/lib/keeper-roster'
import { RUNES } from '../play3d/birth/runes.data'

/** Fired after a rename or delete, so every mounted list (the Character tab AND the Options menu's) re-reads. */
const KEEPERS_CHANGED = 'ather:keepers-changed'
/** How long the Delete press must be held. */
export const DELETE_HOLD_MS = 1200

/** `canSwitch` false = the list shows but picking another keeper or making a new one waits for the garden (Alex 11-19: "they
 *  have to be in the garden to switch"). The Character tab passes nothing (true), the Options list passes the page's answer.
 *  Rename and delete are allowed anywhere: neither touches the live keeper's game state. */
export function KeepersSection({ canSwitch = true, title = 'Keepers' }: { canSwitch?: boolean; title?: string } = {}) {
  const [owner, setOwner] = useState<string | null>(null)
  const [roster, setRoster] = useState<Roster | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [, bump] = useState(0)
  useEffect(() => {
    const on = () => { const o = saveOwnerResolved() ? saveOwner() : null; setOwner(o); setRoster(o ? ensureRoster(o) : null) }
    const re = () => { const o = saveOwnerResolved() ? saveOwner() : null; setRoster(o ? readRoster(o) : null); bump(n => n + 1) }
    on()
    window.addEventListener(SAVE_OWNER_EVENT, on)
    window.addEventListener(KEEPERS_CHANGED, re)
    return () => { window.removeEventListener(SAVE_OWNER_EVENT, on); window.removeEventListener(KEEPERS_CHANGED, re) }
  }, [])
  if (!owner || !roster) return null
  const refresh = () => { try { window.dispatchEvent(new Event(KEEPERS_CHANGED)) } catch { setRoster(readRoster(owner)); bump(n => n + 1) } }
  const go = (id: string) => { if (canSwitch && id !== roster.active && swapKeeper(id, owner)) location.reload() }
  const fresh = () => { if (!canSwitch) return; const id = addKeeper(owner); if (id && swapKeeper(id, owner)) location.reload() }
  return (
    <div data-keepers className="mt-4">
      <HearthLabel>{title}</HearthLabel>
      {!canSwitch && <p data-keepers-locked className="mt-1 text-[12.5px] italic leading-snug" style={{ ...hearthDisplay, color: H.inkFaint }}>Go home to your garden to switch keepers or make a new one.</p>}
      <div className="flex flex-col gap-1.5 mt-1.5">
        {roster.keepers.map(k => {
          const rid = keeperBirthRune(k.id, owner)
          const rune = rid ? RUNES.find(x => x.id === rid)?.name ?? rid : null
          const given = keeperName(k.id, owner)
          const on = k.id === roster.active
          if (editing === k.id) return (
            <RenameRow key={k.id} id={k.id} start={given ?? ''} placeholder={rune ?? 'not yet born'}
              onDone={(name) => { if (name !== null) renameKeeper(k.id, name, owner); setEditing(null); refresh() }} />
          )
          const refusal = removeRefusal(k.id, owner)
          return (
            <div key={k.id} data-keeper={k.id} data-active={on ? '1' : '0'} data-name={given ?? ''}
              className="flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-[12px] pl-3 pr-1.5 py-1.5"
              style={{ background: on ? 'rgba(200,100,42,.14)' : 'rgba(255,250,235,.5)', boxShadow: on ? `inset 0 0 0 1.5px ${H.ember}` : `inset 0 0 0 1px ${H.rule}` }}>
              <button type="button" data-keeper-pick onClick={() => go(k.id)} disabled={!canSwitch && !on}
                className="flex min-w-0 basis-full items-baseline gap-2 py-0.5 pr-1.5 text-left sm:basis-0 sm:flex-1 sm:pr-0">
                <span data-keeper-label className="truncate text-[16px] font-semibold" style={{ ...hearthDisplay, color: given || rune ? H.ink : H.inkFaint }}>{given ?? rune ?? 'not yet born'}</span>
                {given && <span className="shrink-0 text-[12px]" style={{ ...hearthDisplay, color: H.inkFaint }}>{rune ?? 'not yet born'}</span>}
                {on && <span className="ml-auto shrink-0 pl-1 text-[12px] font-bold" style={{ color: H.ember }}>active</span>}
              </button>
              <span className="ml-auto flex shrink-0 items-center gap-1.5">
                <SmallPill data="rename" onClick={() => setEditing(k.id)}>Rename</SmallPill>
                <HoldDelete id={k.id} refusal={refusal} onDeleted={() => { if (removeKeeper(k.id, owner)) refresh() }} />
              </span>
            </div>
          )
        })}
      </div>
      {roster.keepers.length < ROSTER_CAP && (
        <div className="mt-2 flex justify-end"><HearthButton small onClick={fresh} disabled={!canSwitch}>New keeper</HearthButton></div>
      )}
    </div>
  )
}

function SmallPill({ children, onClick, data, disabled }: { children: React.ReactNode; onClick?: () => void; data: string; disabled?: boolean }) {
  return (
    <button type="button" data-keeper-act={data} onClick={onClick} disabled={disabled}
      className="h-8 shrink-0 rounded-full px-2.5 text-[11.5px] font-extrabold uppercase tracking-[0.08em]"
      style={{ background: 'rgba(255,250,235,.7)', color: disabled ? H.inkFaint : H.ink, boxShadow: `inset 0 0 0 1px ${H.rule}` }}>{children}</button>
  )
}

/** Inline name editor. Enter saves, Escape cancels; keys stay inside the field (the game listens on window). */
function RenameRow({ id, start, placeholder, onDone }: { id: string; start: string; placeholder: string; onDone: (name: string | null) => void }) {
  const [v, setV] = useState(start)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus(); ref.current?.select() }, [])
  return (
    <div data-keeper={id} data-renaming="1" className="flex items-center gap-1.5 rounded-[12px] pl-2 pr-1.5 py-1.5"
      style={{ background: 'rgba(255,250,235,.8)', boxShadow: `inset 0 0 0 1.5px ${H.ember}` }}>
      <input ref={ref} data-keeper-name-input value={v} maxLength={KEEPER_NAME_MAX} placeholder={placeholder} aria-label="Keeper name"
        onChange={e => setV(e.target.value)}
        onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') onDone(v); else if (e.key === 'Escape') onDone(null) }}
        onKeyUp={e => e.stopPropagation()}
        className="min-w-0 flex-1 rounded-[8px] bg-transparent px-1.5 py-1 text-[16px] font-semibold outline-none"
        style={{ ...hearthDisplay, color: H.ink }} />
      <SmallPill data="save" onClick={() => onDone(v)}>Save</SmallPill>
      <SmallPill data="cancel" onClick={() => onDone(null)}>Cancel</SmallPill>
    </div>
  )
}

/** The row is gone the moment a held delete fires, so when the finger lifts the browser's click lands on whatever slid
 *  under it (the next row's pick = a swap + reload, or New keeper). Swallow that ONE click, briefly. Found by the phone check. */
function swallowNextClick() {
  const eat = (e: Event) => { e.stopPropagation(); e.preventDefault(); off() }
  const off = () => { window.removeEventListener('click', eat, true); clearTimeout(t) }
  window.addEventListener('click', eat, true)
  const t = setTimeout(off, 700)
}

const REFUSAL_HINT: Record<string, string> = {
  active: 'Switch to another keeper first',
  last: 'Your only keeper stays',
  'mid-swap': 'Try again in a moment',
}

/** Delete that only fires on a HELD press (pointer or Enter/Space). A tap explains instead of acting. */
function HoldDelete({ id, refusal, onDeleted }: { id: string; refusal: string | null; onDeleted: () => void }) {
  const [held, setHeld] = useState(0)            // 0..1 fill while holding
  const [hint, setHint] = useState<string | null>(null)
  const t0 = useRef<number | null>(null), raf = useRef(0), hintT = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { cancelAnimationFrame(raf.current); if (hintT.current) clearTimeout(hintT.current) }, [])
  const say = (s: string) => { setHint(s); if (hintT.current) clearTimeout(hintT.current); hintT.current = setTimeout(() => setHint(null), 2200) }
  // The DELETE fires on a timer, never on an animation frame: rAF can crawl (a busy phone, a background tab, headless ~1 fps)
  // and a hold that outlasted DELETE_HOLD_MS must still delete. The frames only paint the fill.
  const fire = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (fire.current) clearTimeout(fire.current) }, [])
  const start = () => {
    if (refusal) { say(REFUSAL_HINT[refusal] ?? 'Cannot delete this keeper'); return }
    if (t0.current !== null) return
    t0.current = performance.now()
    fire.current = setTimeout(() => { fire.current = null; t0.current = null; cancelAnimationFrame(raf.current); setHeld(0); swallowNextClick(); onDeleted() }, DELETE_HOLD_MS)
    const step = () => {
      if (t0.current === null) return
      setHeld(Math.min(1, (performance.now() - t0.current) / DELETE_HOLD_MS))
      raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
  }
  const stop = () => {
    if (refusal) { say(REFUSAL_HINT[refusal] ?? 'Cannot delete this keeper'); return }   // again on release: the finger hid it
    if (t0.current === null) return
    t0.current = null; cancelAnimationFrame(raf.current); setHeld(0)
    if (fire.current) { clearTimeout(fire.current); fire.current = null; say('Hold to delete') }
  }
  return (
    <span className="relative shrink-0">
      <button type="button" data-keeper-act="delete" data-refusal={refusal ?? ''} aria-label={refusal ? `Delete (${REFUSAL_HINT[refusal] ?? 'not allowed'})` : 'Delete: hold to confirm'}
        onPointerDown={e => { e.preventDefault(); start() }} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}
        onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); e.stopPropagation(); start() } }}
        onKeyUp={e => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); stop() } }}
        onContextMenu={e => e.preventDefault()}
        className="relative h-8 overflow-hidden rounded-full px-2.5 text-[11.5px] font-extrabold uppercase tracking-[0.08em] select-none touch-none"
        style={{ background: 'rgba(255,250,235,.7)', color: refusal ? H.inkFaint : '#9a2d1a', boxShadow: `inset 0 0 0 1px ${refusal ? H.rule : 'rgba(154,45,26,.45)'}` }}>
        <span aria-hidden className="absolute inset-y-0 left-0" style={{ width: `${held * 100}%`, background: 'rgba(154,45,26,.22)' }} />
        <span className="relative">Delete</span>
      </button>
      {hint && (
        <span data-keeper-hint role="status" className="pointer-events-none absolute right-full top-1/2 z-10 mr-1.5 -translate-y-1/2 whitespace-nowrap rounded-[8px] px-2 py-1 text-[11.5px] font-semibold"
          style={{ ...hearthDisplay, background: 'rgba(40,26,14,.92)', color: '#f6ead2' }}>{hint}</span>
      )}
    </span>
  )
}
