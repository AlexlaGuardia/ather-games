'use client'
// ── MOREL'S STUCK HINTS (BETA M33 slice 2) ────────────────────────────────────────────────────────────────────────────────
// Mount on any page the first errand runs on (the Ather/Wilds page, the continent). Once a second: is the keeper stuck on
// the errand (morel.ts hintStep: no progress for a while of ACTIVE play, or walking away from its mark)? Then Morel says the
// stage's hint on the message line. The errand's mark is read from the journal (entry 'errand'), so whichever page posts it,
// this sees it. `busy()` = a menu/panel/creator is up or a fight is on: none of that counts as stuck.
// ?morel=fast (checks) runs the clock x20.
import { useEffect, useRef } from 'react'
import { hintStep, newHintWatch, type HintStage } from './morel'
import { MOREL_HINTS } from './morel-lines'
import { hudSay, linesAt } from './hud-say'
import './morel-intro'   // M155: the caption before the first Morel line of First Steps
import { MOREL_NODE_HINT } from './morel-lines'
import { newNodeHintWatch, nodeHint, nodeHintDue, regrowWords, type NodeTry } from './morel-nodes'
import { getJournal, type Zone } from './journal'

const hintSpeed = () => (/(^|[?&])morel=fast(&|$)/.test(window.location.search) ? 20 : 1)
const nodeWatch = newNodeHintWatch()
/** M155: a keeper tried a node. true = Morel answered (the caller's own toast is not needed). */
export function morelAtNode(t: NodeTry): boolean {
  const k = nodeHint(t), now = performance.now() / 1000
  if (!k || !nodeHintDue(nodeWatch, k, now, linesAt().some(l => l.kind === 'morel'), hintSpeed())) return false
  hudSay(MOREL_NODE_HINT[k].replace('{REGROW}', regrowWords(t.regrowMs)), 'morel', 6)
  return true
}

export function useMorelHints(o: { stage: HintStage; zone: Zone; pos: () => { x: number; z: number } | null; busy: () => boolean }) {
  const ref = useRef(o); ref.current = o
  useEffect(() => {
    const w = newHintWatch(), said: string[] = []
    const speed = hintSpeed()
    const probe = { said: () => [...said], watch: () => ({ ...w, track: w.track.length }) }
    const g = window as unknown as { __morelHints?: unknown }; g.__morelHints = probe   // checks' hook: READ only
    const t = setInterval(() => {
      const c = ref.current, p = c.pos()
      const e = getJournal().entries.find(x => x.id === 'errand' && !x.struck)
      const dist = p && e?.where && e.where.zone === c.zone ? Math.hypot(e.where.x - p.x, e.where.z - p.z) : null
      const active = document.visibilityState === 'visible' && !c.busy()
      const r = hintStep(w, { stage: c.stage, now: performance.now() / 1000, active, dist, speed })
      if (!r) return
      const lines = (MOREL_HINTS as Record<string, readonly string[]>)[c.stage]
      if (!lines) return
      said.push(`${c.stage}:${r.i}:${r.why}`); hudSay(lines[r.i], 'morel')
    }, 1000)
    return () => { clearInterval(t); if (g.__morelHints === probe) delete g.__morelHints }
  }, [])
}
