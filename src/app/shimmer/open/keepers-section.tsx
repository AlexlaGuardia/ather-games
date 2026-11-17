'use client'
// THE KEEPERS LIST (M12 step 4), in the Character tab. Signed-in only; anonymous renders nothing. The storage lives in
// lib/keeper-roster.ts. A swap rewrites the live keeper slots under a running page, so every act here ends in a reload.
// "New keeper" adds an EMPTY keeper and swaps to it: it has no birth rune, so the birth gate runs the ritual. No delete.
import { useEffect, useState } from 'react'
import { H, hearthDisplay, HearthLabel, HearthButton } from '../ui/hearth'
import { saveOwner, saveOwnerResolved, SAVE_OWNER_EVENT } from '@/lib/save-slot'
import { ensureRoster, addKeeper, swapKeeper, keeperBirthRune, ROSTER_CAP, type Roster } from '@/lib/keeper-roster'
import { RUNES } from '../play3d/birth/runes.data'

export function KeepersSection() {
  const [owner, setOwner] = useState<string | null>(null)
  const [roster, setRoster] = useState<Roster | null>(null)
  useEffect(() => {
    const on = () => { const o = saveOwnerResolved() ? saveOwner() : null; setOwner(o); setRoster(o ? ensureRoster(o) : null) }
    on()
    window.addEventListener(SAVE_OWNER_EVENT, on)
    return () => window.removeEventListener(SAVE_OWNER_EVENT, on)
  }, [])
  if (!owner || !roster) return null
  const go = (id: string) => { if (id !== roster.active && swapKeeper(id, owner)) location.reload() }
  const fresh = () => { const id = addKeeper(owner); if (id && swapKeeper(id, owner)) location.reload() }
  return (
    <div data-keepers className="mt-4">
      <HearthLabel>Keepers</HearthLabel>
      <div className="flex flex-col gap-1.5 mt-1.5">
        {roster.keepers.map(k => {
          const rid = keeperBirthRune(k.id, owner)
          const name = rid ? RUNES.find(x => x.id === rid)?.name ?? rid : null
          const on = k.id === roster.active
          return (
            <button key={k.id} type="button" data-keeper={k.id} data-active={on ? '1' : '0'} onClick={() => go(k.id)}
              className="flex items-center gap-2.5 rounded-[12px] px-3 py-2 text-left"
              style={{ background: on ? 'rgba(200,100,42,.14)' : 'rgba(255,250,235,.5)', boxShadow: on ? `inset 0 0 0 1.5px ${H.ember}` : `inset 0 0 0 1px ${H.rule}` }}>
              <span className="text-[16px] font-semibold" style={{ ...hearthDisplay, color: name ? H.ink : H.inkFaint }}>{name ?? 'not yet born'}</span>
              {on && <span className="ml-auto text-[12px] font-bold" style={{ color: H.ember }}>active</span>}
            </button>
          )
        })}
      </div>
      {roster.keepers.length < ROSTER_CAP && (
        <div className="mt-2 flex justify-end"><HearthButton small onClick={fresh}>New keeper</HearthButton></div>
      )}
    </div>
  )
}
