// BETA M213 s1 (sprites, 2026-11-26): THE SPIRIT GALLERY'S ROSTER. Alex 11-26 18:0x: "a dial that scrolls up and down just showing
// the number, icon and name of the spirit.. starting with the base spirits and onward". So: the 10 base spirits (#001-#010, the
// grimoire's own order, grimoire.ts), then the 40 second forms in the grimoire's DISCOVERY order (the stage-2 lock ledger,
// /root/athernyx/assets/stage2/grimoire-ledger.json `n`: "Grimoire lists by DISCOVERY, not species"), numbered #011-#050.
// NO NAME IS WRITTEN HERE: every name comes from spirit.ts (SPECIES_NAMES / SECOND_FORM_NAMES, the canon grid). The ledger's order
// is kept as [species, element] pairs; spirit-gallery.test.ts reads the ledger file and proves each pair names the ledger's form.
// ★ PURE: no three, no React. Run: npx tsx src/app/shimmer/dev/editors/spirit-gallery.test.ts
import { ALL_SPECIES } from '../../engine/spirit-index'
import { SECOND_FORM_NAMES, SPECIES_NAMES, type Species } from '../../spirits/spirit'

export type GalleryElement = 'mana' | 'storm' | 'earth' | 'water'
/** the 40 second forms in grimoire discovery order (ledger n = index + 1) */
export const DISCOVERY: readonly (readonly [Species, GalleryElement])[] = [
  ['fox', 'mana'], ['axolotl', 'water'], ['bat', 'storm'], ['owl', 'mana'], ['hummingbird', 'storm'],
  ['rabbit', 'earth'], ['turtle', 'earth'], ['frog', 'water'], ['water-bear', 'earth'], ['firefly', 'mana'],
  ['fox', 'storm'], ['fox', 'earth'], ['fox', 'water'], ['axolotl', 'mana'], ['axolotl', 'storm'],
  ['axolotl', 'earth'], ['water-bear', 'mana'], ['water-bear', 'storm'], ['water-bear', 'water'], ['turtle', 'mana'],
  ['turtle', 'storm'], ['turtle', 'water'], ['owl', 'storm'], ['owl', 'earth'], ['owl', 'water'],
  ['frog', 'mana'], ['frog', 'earth'], ['frog', 'storm'], ['firefly', 'storm'], ['firefly', 'earth'],
  ['firefly', 'water'], ['rabbit', 'storm'], ['rabbit', 'water'], ['rabbit', 'mana'], ['hummingbird', 'mana'],
  ['hummingbird', 'earth'], ['hummingbird', 'water'], ['bat', 'mana'], ['bat', 'earth'], ['bat', 'water'],
]

export type GalleryRow = {
  /** grimoire # (1-50) */ num: number
  name: string
  sp: Species
  /** null = the base spirit */ el: GalleryElement | null
  /** the 2D art: the base grimoire art or the form's locked art (public/) */ icon: string
}

/** public/ files keep the tardigrade as `waterbear` */
const artKey = (sp: Species) => (sp === 'water-bear' ? 'waterbear' : sp)

export const GALLERY: readonly GalleryRow[] = [
  ...ALL_SPECIES.map((sp, i): GalleryRow => ({ num: i + 1, name: SPECIES_NAMES[sp], sp, el: null, icon: `/spirits/${artKey(sp)}.png` })),
  ...DISCOVERY.map(([sp, el], i): GalleryRow => ({ num: ALL_SPECIES.length + i + 1, name: SECOND_FORM_NAMES[sp][el], sp, el, icon: `/spirits/forms/${artKey(sp)}_${el}.png` })),
]

export const galleryNo = (n: number) => `#${String(n).padStart(3, '0')}`

/** the dial's next index after a step (wheel notch / arrow key / drag row), held to the ends */
export const dialStep = (i: number, by: number, len = GALLERY.length) => Math.max(0, Math.min(len - 1, i + by))
