'use client'
// THE SIGN-IN ROSTER PROMPT (M12 step 3). The decision and the storage live in lib/keeper-prompt.ts; this is the panel.
// Mounted by BirthGate (both open-world pages already mount it). Shows once: YES copies the anonymous keeper into the
// account's roster, "Not now" leaves everything on this browser and is remembered on this device.
import { useEffect, useState } from 'react'
import { HearthFrame, H, hearthDisplay, HearthButton } from '../ui/hearth'
import { saveOwner, saveOwnerResolved, SAVE_OWNER_EVENT } from '@/lib/save-slot'
import { rosterPromptNow, addAnonKeeperToRoster, declineAnonKeeper, type RosterPrompt } from '@/lib/keeper-prompt'

export function RosterPrompt() {
  const [ask, setAsk] = useState<RosterPrompt>('none')
  const [owner, setOwner] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => {
    const on = () => { const o = saveOwnerResolved() ? saveOwner() : null; setOwner(o); setAsk(rosterPromptNow(o)) }
    on()
    window.addEventListener(SAVE_OWNER_EVENT, on)
    return () => window.removeEventListener(SAVE_OWNER_EVENT, on)
  }, [])
  if (ask === 'none' || !owner) return null
  const close = () => setAsk('none')
  const notNow = () => { declineAnonKeeper(owner); close() }
  const yes = () => {
    const r = addAnonKeeperToRoster(owner)
    if (r === 'added') close()
    else if (r === 'full') setAsk('full')
    else setMsg('Could not add it. Nothing was lost.')
  }
  const full = ask === 'full'
  return (
    <div data-panel="roster-prompt" onKeyDownCapture={e => e.stopPropagation()}>
      <HearthFrame title="Add this keeper to your roster?" maxWidth={400} onClose={notNow} fixed dataPanel="roster-prompt-frame">
        <div className="px-4 pt-4 pb-4 text-[14px] leading-snug" style={{ color: H.ink }}>
          <p style={{ ...hearthDisplay, color: H.inkSoft }}>Your account already has a keeper. This one was made on this browser before you signed in.</p>
          {full && <p className="mt-2 font-semibold" style={hearthDisplay}>Your roster is full. This keeper stays on this browser.</p>}
          {msg && !full && <p className="mt-2" style={{ color: H.inkSoft }}>{msg}</p>}
          <div className="flex justify-end gap-2 mt-4">
            <HearthButton small onClick={notNow}>Not now</HearthButton>
            {!full && <HearthButton small primary onClick={yes}>Add to roster</HearthButton>}
          </div>
        </div>
      </HearthFrame>
    </div>
  )
}
