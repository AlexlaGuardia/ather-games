// Where the tutorial's guide trail points — pure. The trail itself is `guide-trail.ts` (three).
//
// ── ★ A TRAIL FOR QUICK TASKS ONLY (Alex, 2026-09-15: "a glow trail on the ground for quick tasks
//    like the tutorial") ────────────────────────────────────────────────────────────────────────
// The objective chip says WHAT ("Knock on five doors") and a fresh keeper in a glade with five
// buildings has no idea WHERE. This answers where, for the tutorial and nothing after it: the
// world's later "go find X" moments are meant to be found, and a permanent breadcrumb is the thing
// that turns a world into a checklist. `done` returns null and so does every objective the keeper
// can answer from their own bag (crafting the lantern).
//
// The doors: the NEAREST unmet one. The sheet's lesson is knocking, not an order, so the trail
// takes the keeper to whichever door is closest and lets the glade's shape decide the rest. Hazel's
// errand is the one place the trail steps THROUGH a task: the nearest log while she is owed and the
// keeper has nothing, her sawmill once a log is in hand, her door once the stack is square.

import type { FolkId } from './folk'
import { FOLK_IDS } from './folk'
import { HAZEL_STACK, type TutorialState, type Progress } from './tutorial'

export interface Spot { x: number; z: number }

/** Everything in the world the resolver may point at. Positions are block-centre x/z. */
export interface GuideWorld {
  greg: Spot
  folk: Partial<Record<FolkId, Spot>>
  /** Hazel's own sawmill cell, if her building is placed. */
  sawmill: Spot | null
  /** The nearest standing log to the keeper, if the caller has looked (null = none in range). */
  nearestLog: Spot | null
}

export type GuideKind = 'greg' | 'door' | 'log' | 'sawmill'

export interface GuideTarget extends Spot {
  kind: GuideKind
  /** The trail goes dark inside this distance — in reach means found. */
  hideBelow: number
}

const TALK = 3.5   // Greg's talk range, a shade over

export function guideTarget(s: TutorialState, p: Progress, at: Spot, w: GuideWorld): GuideTarget | null {
  const greg = (): GuideTarget => ({ ...w.greg, kind: 'greg', hideBelow: TALK })
  const door = (id: FolkId): GuideTarget | null => {
    const f = w.folk[id]
    return f ? { ...f, kind: 'door', hideBelow: TALK } : null
  }
  const errand = (): GuideTarget | null => {
    if (p.planks >= HAZEL_STACK) return door('hazel')
    if (p.logs > 0) return w.sawmill ? { ...w.sawmill, kind: 'sawmill', hideBelow: 3 } : door('hazel')
    return w.nearestLog ? { ...w.nearestLog, kind: 'log', hideBelow: 3 } : null
  }
  switch (s.stage) {
    case 'greet':
    case 'choice':
      return greg()
    case 'doors': {
      if (s.hazel === 'owed') return errand()
      let best: GuideTarget | null = null, bd = Infinity
      for (const id of FOLK_IDS) {
        if (s.met.includes(id)) continue
        const d = door(id)
        if (!d) continue
        const dist = Math.hypot(d.x - at.x, d.z - at.z)
        if (dist < bd) { bd = dist; best = d }
      }
      return best
    }
    case 'ask':
      return s.hazel === 'owed' ? errand() : greg()
    case 'lantern':
      return null   // the bag has everything; the chip says craft
    case 'light':
      return { ...w.greg, kind: 'greg', hideBelow: 10 }   // his path: anywhere near him will do
    case 'done':
      return null
  }
}
