'use client'
// M68 s3b: Fennel's talk in the Glade, live (rules in glade-fennel-talk.ts). page.tsx holds the cursor in its Panel
// ({ kind: 'gfennel' }) and calls this hook; this file owns the bag, the tutorial save, the quest start and where her bubble sits.
import { useMemo } from 'react'
import type { TalkNode } from '../shared/npc-talk'
import { getInv, setInv } from '../shared/bag'
import { give } from '../shared/inventory'
import { hudSay } from '../shared/hud-say'
import { resetIndex } from '../../engine/day-cycle'
import { MOGLIN_HEIGHT } from '../shared/moglin-model'
import { loadTut, saveTut } from './glade-tutorial'
import { fennelStart, fennelNode, type FennelCursor } from './glade-fennel-talk'
import { currentQuest, gladeStartQuest } from './use-rinquest'
import { hasStick } from './rinquest'
import { gladeFolkDrawn } from './glade-cluster-view'
import { GLADE_ID } from './moonwell-glade'

export const FENNEL_FOLK_ID = `${GLADE_ID}:fennel`
/** the in-game day the jar counts in (one per day cycle) */
const today = () => resetIndex(Date.now(), 1)

export function useGladeFennel(c: FennelCursor | null, setC: (c: FennelCursor | null) => void, folk: () => void, ground: (x: number, z: number) => number) {
  const node: TalkNode | null = useMemo(() => !c ? null : fennelNode(loadTut(), c, {
    set: saveTut,
    go: i => setC(i === null ? null : { ...c, i }),
    startQuest: gladeStartQuest,
    giveBait: n => {
      const r = give(getInv(), 'bait', n)
      if (r.left) { hudSay('Your bag is full. Make room for the bait.', 'info'); return false }
      setInv(r.inv); hudSay(`Bait ×${n} · in your bag`, 'item'); return true
    },
    folk,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [c])
  const at = c ? gladeFolkDrawn.find(f => f.id === FENNEL_FOLK_ID) ?? null : null
  const head = at ? { x: at.x, y: ground(at.x, at.z) + MOGLIN_HEIGHT.chibi, z: at.z } : null
  /** E on Fennel in the Glade: her own talk, or (before Greg sends a live keeper) her ordinary Moglin talk */
  const open = () => {
    const n = fennelStart(loadTut(), hasStick(currentQuest()), today())
    if (n.mode === 'folk') folk(); else setC(n)
  }
  return { node, head, open }
}
