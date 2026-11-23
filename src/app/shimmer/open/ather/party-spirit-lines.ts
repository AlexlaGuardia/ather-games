// M109 SIGNED LINES (sprites, 2026-11-23): the party spirit's talk, the 4th-follow refusal and the feed lines, WORD FOR WORD
// from athernyx CANON/game/party-spirit-lines-script.md (SIGNED by Alex 2026-11-23, athernyx 83b6870: MAIN ships everywhere,
// the per-species E lines kept, feed = MAIN). Alts are history and must not ship. Spirits do not speak: every talk line is a
// NARRATOR BOX (the script's brackets ship as written). `{name}` = the keeper's own name for the spirit; the build has no
// spirit naming yet, so it is the species' canon name. Guarded by party-spirit-lines.test.ts (diffs this file against canon).
// No React, no three.
import { SPECIES_NAMES, type Species } from '../../spirits/spirit'

/** §1a: E on a party spirit, any species (random of 5) */
export const TALK_GENERIC = [
  '[{name} turns to you and stays there, content to be noticed.]',
  '[{name} leans in a little, then goes back to what it was doing.]',
  '[{name} gives a small, warm sound and settles closer.]',
  '[{name} looks you over as if checking you are still you.]',
  '[{name} is glad of the company, and lets you know it.]',
] as const

/** §1b: per-species pair, mixed into the generic draw. Keyed by the canon species name (evolved forms use their base's). */
export const TALK_SPECIES: Record<string, readonly [string, string]> = {
  Vulnyx: ['[{name} is already behind you. It flicks a gold afterimage and looks very pleased.]', '[{name} bumps your hand, then dances out of reach to see if you will chase.]'],
  Dewbear: ['[{name} waddles into your boots and stays there.]', '[{name} leans its whole round weight against your leg and sighs.]'],
  Shellmere: ['[{name} blinks, slowly, and that is a whole greeting.]', "[The rune-light on {name}'s shell warms a little, and holds.]"],
  Athowl: ['[{name} watches you for a long while. Then one exact tilt of the head.]', '[{name} says nothing, as ever, and misses nothing.]'],
  Hovari: ['[{name} hangs in the air before you, colours shifting, and holds quite still.]', '[{name} zips a tight circle round your head and returns to the exact same spot.]'],
  Croakling: ['[{name} offers a long, bubbling opinion. You are not sure on what.]', '[{name} croaks twice, hops once, and looks proud of the whole thing.]'],
  Manalotl: ['[The gills on {name} flutter, soft as breath, and it drifts nearer.]', '[{name} wavers on the spot, calm as a held note.]'],
  Luminara: ['[{name} brightens, just for you, and dims again shyly.]', '[{name} drifts up to your hand and glows there a moment.]'],
  Lepara: ["[{name}'s ears swing toward you, both at once.]", '[{name} gives a quick, soft thump and looks up.]'],
  Noctyx: ['[{name} sends one small click out, listens to it come back, and seems satisfied.]', '[{name} hangs near, a quiet shape that would rather be near than anywhere else.]'],
}

/** §2 Main: Follow on a party spirit while 3 already walk with the keeper (the species tints are optional and not taken) */
export const FOLLOW_REFUSE = "[{name} looks at the ones beside you, then back toward the garden. It would rather keep the garden company today.]"
/** §3a Main: Feed with no spirit food in the bag */
export const FEED_NONE = 'No spirit food in your bag.'
/** §3b Main: the HUD note after a feed */
export const FEED_DONE = '{name} enjoys the {food}.'

const fill = (t: string, v: Record<string, string>) => t.replace(/\{(\w+)\}/g, (m, k) => v[k] ?? m)
export const spiritName = (sp: Species) => SPECIES_NAMES[sp]
/** every talk line this species may draw: the generic five plus its own pair */
export const talkPool = (sp: Species): string[] => [...TALK_GENERIC, ...(TALK_SPECIES[SPECIES_NAMES[sp]] ?? [])]
/** one talk line for E on her, `r` in [0,1) */
export const talkLine = (sp: Species, r = Math.random()) => { const p = talkPool(sp); return fill(p[Math.min(p.length - 1, Math.floor(r * p.length))], { name: spiritName(sp) }) }
export const followRefuseLine = (sp: Species) => fill(FOLLOW_REFUSE, { name: spiritName(sp) })
export const fedLine = (sp: Species, food: string) => fill(FEED_DONE, { name: spiritName(sp), food })
