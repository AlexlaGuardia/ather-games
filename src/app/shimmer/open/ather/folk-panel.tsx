'use client'
// ── THE FOLK OF A SETTLEMENT: talk, earn trust, bring one home (hub, 11-18) ───────────────────────────────────────────────
// E inside a Wilds settlement opens this. Every Moglin living there this season (settlement-folk.ts), each with its trade,
// its fixed grades, its dream (lark's) and, if it has a job, what its settlement lacks. Free folk come for the asking; folk
// with a job come once their want-list is filled. The recruit lands in the garden village (play's moglins.ts), where play
// assigns it to a room. Every spoken line is lark's (folk-lines.ts, awaiting Alex's sign-off).
import { useState } from 'react'
import { HearthFrame, HearthButton, H, hearthDisplay } from '../../ui/hearth'
import { getInv, setInv, useInv } from '../shared/bag'
import { countOf, take, itemDef } from '../shared/inventory'
import { hudSay } from '../shared/hud-say'
import type { Settlement } from './network'
import { SEASON } from './network'
import { folkOf, stillHome, wantsLeft, trusted, bring, recruit, loadTrust, saveTrust, type Folk } from './settlement-folk'
import { loadVillage, saveVillage, GRADE_NAME, VILLAGE_CAP, type Village } from './moglins'
import { talkLine } from './folk-lines'

const TRADE: Record<string, string> = { farmer: 'Farmer', cook: 'Cook', carpenter: 'Carpenter', stonemason: 'Stonemason', alchemist: 'Alchemist', smith: 'Smith', jeweler: 'Jeweler' }
const goodsText = (ws: { id: string; n: number }[]) => ws.map(w => `${w.n} ${itemDef(w.id).name}`).join(' and ')

export function FolkPanel({ settlement, onClose }: { settlement: Settlement; onClose: () => void }) {
  const inv = useInv()
  const [village, setVillage] = useState<Village>(() => loadVillage())
  const [trust, setTrust] = useState(() => loadTrust())
  const [said, setSaid] = useState<Record<string, string>>({})
  const folk = folkOf(settlement, SEASON)
  const home = stillHome(folk, village)
  const room = VILLAGE_CAP[0] - village.moglins.length   // stage gating is play's, not built: stage 0
  const say = (f: Folk, line: string) => setSaid(s => ({ ...s, [f.id]: line }))

  const welcomeHome = (f: Folk) => {
    const v = recruit(village, f, trust)
    if (!v) { say(f, room <= 0 ? 'Your garden has no room for another.' : ''); return }
    saveVillage(v); setVillage(v)
    hudSay(`${f.name} the ${TRADE[f.profession].toLowerCase()} is coming to your garden`, 'item', 5)
  }
  const ask = (f: Folk) => {
    if (trusted(f, trust)) { say(f, talkLine(f.employed ? 'trusted' : 'yes', f.id)); welcomeHome(f); return }
    say(f, talkLine('trustFirst', f.id, goodsText(wantsLeft(f, trust))))
  }
  const give = (f: Folk, id: string) => {
    const left = wantsLeft(f, trust).find(w => w.id === id)?.n ?? 0, have = countOf(getInv(), id), n = Math.min(left, have)
    if (n <= 0) return
    const next = take(getInv(), id, n); if (!next) return
    const r = bring(trust, f, id, n); setInv(next); saveTrust(r.trust); setTrust(r.trust)
    if (trusted(f, r.trust)) say(f, talkLine('trusted', f.id))
  }

  return (
    <HearthFrame title={`${settlement.name} · free Moglins`} maxWidth={620} onClose={onClose} fixed dataPanel="folk"
      head={<div className="pb-2 text-[13px]" style={{ ...hearthDisplay, color: H.inkSoft }}>
        Your garden has room for {Math.max(0, room)} more · {village.moglins.length} living there now
      </div>}>
      <div className="px-4 pt-2 pb-4 grid gap-3" style={{ color: H.ink }}>
        {home.length === 0 && <p className="text-[14px]" style={{ color: H.inkSoft }}>Everyone here has gone to a garden this season.</p>}
        {home.map(f => {
          const left = wantsLeft(f, trust), ok = trusted(f, trust)
          return (
            <div key={f.id} data-folk={f.id} className="rounded-md px-3 py-2" style={{ background: 'rgba(0,0,0,0.04)', border: `1px solid ${H.rule}` }}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[15px] font-bold">{f.name}</span>
                <span className="text-[12px] uppercase tracking-[0.12em]" style={{ ...hearthDisplay, color: H.inkSoft }}>{TRADE[f.profession]}{f.employed ? ' · has work here' : ''}</span>
              </div>
              <div className="text-[12px] tabular-nums mt-0.5" style={{ color: H.inkSoft }}>
                craft {GRADE_NAME[f.grades.craft]} · yield {GRADE_NAME[f.grades.yield]} · trade {GRADE_NAME[f.grades.trade]}
              </div>
              <p className="text-[13px] italic mt-1">&ldquo;{f.dream}&rdquo;</p>
              {said[f.id] && <p className="text-[13px] mt-1" data-said>{f.name}: &ldquo;{said[f.id]}&rdquo;</p>}
              {f.employed && !ok && said[f.id] && (
                <div className="mt-2 grid gap-1">
                  {left.map(w => {
                    const have = countOf(inv, w.id)
                    return (
                      <div key={w.id} className="flex items-center justify-between text-[13px]">
                        <span>{itemDef(w.id).name}: {w.n} still wanted <span style={{ color: H.inkSoft }}>(you have {have})</span></span>
                        <HearthButton small disabled={have <= 0} onClick={() => give(f, w.id)}>Give {Math.min(have, w.n) || ''}</HearthButton>
                      </div>
                    )
                  })}
                </div>
              )}
              <div className="flex justify-end mt-2">
                {ok && said[f.id]
                  ? <HearthButton small primary disabled={room <= 0} onClick={() => welcomeHome(f)}>Welcome {f.name} home</HearthButton>
                  : <HearthButton small onClick={() => ask(f)}>{f.employed && !ok && said[f.id] ? 'Ask again' : 'Ask to come'}</HearthButton>}
              </div>
            </div>
          )
        })}
      </div>
    </HearthFrame>
  )
}
