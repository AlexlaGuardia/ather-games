// MOREL_INTRO.caption (BETA M155 s2): a box that tells the PLAYER who is speaking, ONCE EVER, before the first Morel line of any kind
// in First Steps. Not Morel's own words, and not a meeting in the story (canon RULED 6a31c34). A keeper past First Steps, or with a save
// from before it, never sees it. Every Morel line goes through hudSay, so this hangs there and nothing can speak first.
import { keeperKey } from '@/lib/keeper-local'
import { peekFirstSteps } from '../ather/glade-tutorial'
import { beforeMorel, hudSay } from './hud-say'
import { MOREL_INTRO } from './morel-lines'

const KEY = 'open.morelintro.v1'
export const INTRO_TTL = 8
let here = false   // a private window keeps nothing: once a page at least
/** true = the caption was shown just now */
export function morelIntro(firstSteps = peekFirstSteps()): boolean {
  if (!firstSteps) return false
  try {
    if (localStorage.getItem(keeperKey(KEY)) !== null) return false
    localStorage.setItem(keeperKey(KEY), '1')
  } catch { if (here) return false; here = true }
  hudSay(MOREL_INTRO.caption, 'caption', INTRO_TTL)
  return true
}
beforeMorel(() => morelIntro())
