'use client'
// The settlement talk's state (folk-talk.ts is the pure tree): village + trust + the screen, as one hook the page reads for the
// bubble (in the Canvas), the answers (on the HUD) and the camera focus. Recruit / bring go through settlement-folk.ts untouched.
import { useEffect, useMemo, useRef, useState } from 'react'
import { getInv, setInv, useInv } from '../shared/bag'
import { countOf, take } from '../shared/inventory'
import { hudSay } from '../shared/hud-say'
import type { TalkNode } from '../shared/npc-talk'
import type { Settlement } from './network'
import { SEASON } from './network'
import { folkOf, stillHome, bring, recruit, loadTrust, saveTrust, wantsLeft } from './settlement-folk'
import { loadVillage, saveVillage, VILLAGE_CAP } from './moglins'
import { folkTalk, folkStart, helloFor, type FolkTalkState } from './folk-talk'
import { folkSpots, nearestSpot } from './folk-spots'
import { keeperNow } from './network-scene'
import { MOGLIN_HEIGHT } from '../shared/moglin-model'

export function useFolkTalk(s: Settlement | null, ground: (x: number, z: number) => number, onClose: () => void) {
  const inv = useInv()
  const [village, setVillage] = useState(() => loadVillage())
  const [trust, setTrust] = useState(() => loadTrust())
  const [st, setSt] = useState<FolkTalkState | null>(null)
  const folk = useMemo(() => s ? folkOf(s, SEASON) : [], [s])
  useEffect(() => {   // a new conversation: re-read the garden, start with the first Moglin still at home
    if (!s) { setSt(null); return }
    const v = loadVillage(), t = loadTrust(); setVillage(v); setTrust(t)
    // M19: the talk opens on the Moglin NEAREST the keeper (they stand on the green: folk-spots.ts), not the first in the list
    const all = folkOf(s, SEASON), home = stillHome(all, v), ids = new Set(home.map(f => f.id))
    const n = nearestSpot(folkSpots(s, all.map(f => f.id)).filter(p => ids.has(p.id)), keeperNow.x, keeperNow.z)
    setSt(n ? helloFor(n.id) : folkStart(home))   // M40: helloFor marks the Moglin heard (a repeat talk = its alternate line)
  }, [s])
  // the node must not be rebuilt on every inventory tick (TalkChoices resets the pick to the first answer when the node changes):
  // it is keyed on the counts of the goods these folk want, not on the bag object
  const invRef = useRef(inv); invRef.current = inv
  const haveKey = folk.flatMap(f => f.wants).map(w => countOf(inv, w.id)).join(',')
  const node: TalkNode | null = useMemo(() => {
    if (!s || !st) return null
    const home = stillHome(folk, village), room = VILLAGE_CAP[0] - village.moglins.length   // stage gating is play's: stage 0
    return folkTalk({ folk, home, trust, have: id => countOf(invRef.current, id), room }, st, {
      go: setSt, bye: onClose,
      give: (f, id, n) => {
        const left = wantsLeft(f, trust).find(w => w.id === id)?.n ?? 0, k = Math.min(left, n, countOf(getInv(), id)); if (k <= 0) return
        const next = take(getInv(), id, k); if (!next) return
        const r = bring(trust, f, id, k); setInv(next); saveTrust(r.trust); setTrust(r.trust)
        setSt({ fid: f.id, screen: 'needs' })
      },
      recruit: f => {
        const v = recruit(village, f, trust); if (!v) return
        saveVillage(v); setVillage(v)
        hudSay(`${f.name} is coming to your garden`, 'item', 5)
      },
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s, st, folk, village, trust, haveKey])
  const f = st ? folk.find(x => x.id === st.fid) : undefined
  // the bubble + the talk camera sit on THAT Moglin (its spot, the ground asked now); a Moglin no longer home (just recruited)
  // or none at all: the settlement's own anchor
  const spot = s && f ? folkSpots(s, folk.map(x => x.id)).find(p => p.id === f.id) : undefined
  const home = stillHome(folk, village).some(x => x.id === f?.id)
  const at = s ? (spot && home ? { x: spot.x, z: spot.z, y: ground(spot.x, spot.z) } : { x: s.x, z: s.z, y: ground(s.x, s.z) }) : null
  const head = spot && home ? MOGLIN_HEIGHT.chibi : 1.3
  const onId = node && spot && home ? spot.id : null
  useEffect(() => {   // checks read who the talk is on and where the camera aims (folk-check)
    (window as unknown as { __folkTalk?: unknown }).__folkTalk = { on: onId, at: at && node ? { x: at.x, z: at.z } : null }
  }, [onId, node, at?.x, at?.z])   // eslint-disable-line react-hooks/exhaustive-deps
  return {
    node,
    name: f?.name ?? s?.name ?? '',
    focus: node && at ? { x: at.x, y: at.y + head * 0.8, z: at.z } : null,
    bubbleAt: node && at ? [at.x, at.y + head + 1.1, at.z] as [number, number, number] : null,
    /** which Moglin the talk is on (checks read it) */
    on: spot && home ? spot.id : null,
  }
}
