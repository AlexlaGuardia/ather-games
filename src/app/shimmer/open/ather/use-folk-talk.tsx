'use client'
// The settlement talk's state (folk-talk.ts is the pure tree): village + trust + the screen, as one hook the page reads for the
// bubble (in the Canvas), the answers (on the HUD) and the camera focus. Recruit / bring go through settlement-folk.ts untouched.
import { useEffect, useMemo, useRef, useState } from 'react'
import { getInv, setInv, useInv } from '../shared/bag'
import { countOf, take, hasGift, yarrowTeach, GIFT_YARROW_TAUGHT, YARROW_GIFT_BAIT } from '../shared/inventory'
import { useQuest, firstCatch } from './use-rinquest'
import { hudSay } from '../shared/hud-say'
import type { TalkNode } from '../shared/npc-talk'
import type { Settlement } from './network'
import { SEASON } from './network'
import { folkOf, stillHome, bring, recruit, loadTrust, saveTrust, wantsLeft } from './settlement-folk'
import { loadVillage, saveVillage, villageCap, plotStage } from './moglins'
import { currentWorks } from './workshop'
import { folkTalk, folkStart, helloFor, type FolkTalkState } from './folk-talk'
import { MoglinCard } from './moglin-card-view'
import { nearestSpot } from './folk-spots'
import { builtFolkSpots } from './settlement-lots'   // M39 s3: where a Moglin is DRAWN (trade Moglins at their doors); talk must agree
import { keeperNow } from './network-scene'
import { MOGLIN_HEIGHT } from '../shared/moglin-model'
import { diggerTrade, DIGGER_LABEL } from './digger-trade'
import { burrfolkOf, stallSpot, barter, isBurr, BURR_LABEL, BURRFOLK_BARKS } from './burrfolk'
import { isGleaner, gleanerMem, afterSwap, gleanerLeave } from './gleaner'

export function useFolkTalk(s: Settlement | null, ground: (x: number, z: number) => number, onClose: () => void, /** M128: its settlement is infected, trade stopped */ stopped = false) {
  const phone = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches   // M46 card sizing; page.tsx untouched
  const inv = useInv()
  const quest = useQuest()
  // Yarrow's teach beat is due once a rinstick has been held (rinquest `stick`; a keeper from before M22 closed the quest
  // already) and the page has not been handed over yet
  const canTeach = (!!quest.stick || quest.state === 'done') && !hasGift(inv, GIFT_YARROW_TAUGHT), hasCatch = !!firstCatch(inv)
  const [village, setVillage] = useState(() => loadVillage())
  const [trust, setTrust] = useState(() => loadTrust())
  const [st, setSt] = useState<FolkTalkState | null>(null)
  const folk = useMemo(() => s ? folkOf(s, SEASON) : [], [s])
  const burr = useMemo(() => s ? burrfolkOf(s, SEASON, folk) : null, [s, folk])   // M112: the settlement's stall (never one of folk)
  useEffect(() => {   // a new conversation: re-read the garden, start with the first Moglin still at home
    if (!s) { setSt(null); return }
    const v = loadVillage(), t = loadTrust(); setVillage(v); setTrust(t)
    // M19: the talk opens on the Moglin NEAREST the keeper (they stand on the green: folk-spots.ts), not the first in the list
    const all = folkOf(s, SEASON), home = stillHome(all, v), ids = new Set(home.map(f => f.id))
    const b = burrfolkOf(s, SEASON, all), stall = b ? [{ id: b.id, ...stallSpot(s) }] : []   // M112: the stall is a talk target too
    const n = nearestSpot([...builtFolkSpots(s, all, SEASON).filter(p => ids.has(p.id)), ...stall], keeperNow.x, keeperNow.z)
    setSt(n ? helloFor(n.id) : folkStart(home))   // M40: helloFor marks the Moglin heard (a repeat talk = its alternate line)
  }, [s])
  // the node must not be rebuilt on every inventory tick (TalkChoices resets the pick to the first answer when the node changes):
  // it is keyed on the counts of the goods these folk want, not on the bag object
  const invRef = useRef(inv); invRef.current = inv
  const haveKey = folk.flatMap(f => f.wants).map(w => countOf(inv, w.id)).join(',')
  const node: TalkNode | null = useMemo(() => {
    if (!s || !st) return null
    const home = stillHome(folk, village), room = villageCap(currentWorks()) - village.moglins.length   // P1 11-23: cap by plot stage (raised rooms)
    const n = folkTalk({ folk, home, trust, have: id => countOf(invRef.current, id), room, homeName: s.name, yarrow: { canTeach, hasCatch }, burr, stopped }, st, {
      go: setSt,
      bye: () => {   // M112: signed leave bark (Gleaner: the camp bark, once the camp is told)
        if (burr && st.fid === burr.id) { const l = isGleaner(burr.id) ? gleanerLeave(gleanerMem) : BURRFOLK_BARKS.leave; if (l) hudSay(`${burr.name}: ${l}`, 'info', 4) }
        onClose()
      },
      barter: k => { if (stopped) return   // M112: one swap at the Burrfolk's stall (refused = nothing changes, a line says why). No coin moves.
        const r = barter(getInv(), k)
        if (!r.ok) { hudSay(r.why === 'short' ? BURR_LABEL.short(k) : BURR_LABEL.full(k), 'info', 4); return }
        setInv(r.inv); hudSay(BURR_LABEL.done(k), 'item', 4)
        if (burr && isGleaner(burr.id)) { const l = afterSwap(gleanerMem); if (l) setSt({ fid: burr.id, screen: 'said', line: l, rep: st.rep, alt: st.alt }) }   // D3: the first swap tells of the camp
      },
      teach: () => {
        const next = yarrowTeach(getInv())
        if (!next) { hudSay('Clear a few slots in your bag first.', 'info'); return false }
        setInv(next); hudSay(`Mast, Bait ×${YARROW_GIFT_BAIT}, Bait Page`, 'item'); return true
      },
      give: (f, id, n) => {
        if (stopped) return
        const left = wantsLeft(f, trust).find(w => w.id === id)?.n ?? 0, k = Math.min(left, n, countOf(getInv(), id)); if (k <= 0) return
        const next = take(getInv(), id, k); if (!next) return
        const r = bring(trust, f, id, k); setInv(next); saveTrust(r.trust); setTrust(r.trust)
        setSt({ fid: f.id, screen: 'needs' })
      },
      trade: () => { if (stopped) return   // M108 s3: the Digger's barter (refused = nothing changes, a line says why)
        const r = diggerTrade(getInv())
        if (!r.ok) { hudSay(r.why === 'short' ? DIGGER_LABEL.short : DIGGER_LABEL.full, 'info', 4); return }
        setInv(r.inv); hudSay(DIGGER_LABEL.done, 'item', 4)
      },
      recruit: f => {
        const v = recruit(village, f, trust, plotStage(currentWorks()), Date.now(), s.name); if (!v) return
        saveVillage(v); setVillage(v)
        hudSay(`${f.name} is coming to your garden`, 'item', 5)
      },
    })
    // M46: the card rides on the node as a HUD panel above the answers (TalkChoices draws it; page.tsx needs no change)
    return n.card ? { ...n, panel: <MoglinCard card={n.card} id={st.fid} phone={phone} /> } : n
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s, st, folk, burr, village, trust, haveKey, canTeach, hasCatch, stopped])
  const f = st ? folk.find(x => x.id === st.fid) : undefined
  // the bubble + the talk camera sit on THAT Moglin (its spot, the ground asked now); a Moglin no longer home (just recruited)
  // or none at all: the settlement's own anchor
  const atBurr = !!s && !!burr && isBurr(st?.fid) && st?.fid === burr.id
  const spot = atBurr && s && burr ? { id: burr.id, ...stallSpot(s) } : s && f ? builtFolkSpots(s, folk, SEASON).find(p => p.id === f.id) : undefined
  const home = atBurr || stillHome(folk, village).some(x => x.id === f?.id)
  const at = s ? (spot && home ? { x: spot.x, z: spot.z, y: ground(spot.x, spot.z) } : { x: s.x, z: s.z, y: ground(s.x, s.z) }) : null
  const head = spot && home ? MOGLIN_HEIGHT.chibi : 1.3
  const onId = node && spot && home ? spot.id : null
  useEffect(() => {   // checks read who the talk is on and where the camera aims (folk-check)
    (window as unknown as { __folkTalk?: unknown }).__folkTalk = { on: onId, at: at && node ? { x: at.x, z: at.z } : null }
  }, [onId, node, at?.x, at?.z])   // eslint-disable-line react-hooks/exhaustive-deps
  return {
    node,
    name: atBurr && burr ? burr.name : f?.name ?? s?.name ?? '',
    focus: node && at ? { x: at.x, y: at.y + head * 0.8, z: at.z } : null,
    // M65: no bubble while the Moglin's CARD is open (its line is the hello again; at 800x500 the bubble sat on the card's top)
    bubbleAt: node && at && st?.screen !== 'card' ? [at.x, at.y + head + 1.1, at.z] as [number, number, number] : null,
    /** which Moglin the talk is on (checks read it) */
    on: spot && home ? spot.id : null,
  }
}
