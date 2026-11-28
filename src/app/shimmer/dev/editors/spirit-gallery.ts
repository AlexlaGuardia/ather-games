// BETA M213 s1 (sprites, 2026-11-26): THE SPIRIT GALLERY'S ROSTER. Alex 11-26 18:0x: "a dial that scrolls up and down just showing
// the number, icon and name of the spirit.. starting with the base spirits and onward". So: the 10 base spirits (#001-#010, the
// grimoire's own order, grimoire.ts), then the 40 second forms in the grimoire's DISCOVERY order (the stage-2 lock ledger,
// /root/athernyx/assets/stage2/grimoire-ledger.json `n`: "Grimoire lists by DISCOVERY, not species"), numbered #011-#050.
// NO NAME IS WRITTEN HERE: every name comes from spirit.ts (SPECIES_NAMES / SECOND_FORM_NAMES, the canon grid). The ledger's order
// is kept as [species, element] pairs; spirit-gallery.test.ts reads the ledger file and proves each pair names the ledger's form.
// ★ PURE: no three, no React. Run: npx tsx src/app/shimmer/dev/editors/spirit-gallery.test.ts
import { ALL_SPECIES } from '../../engine/spirit-index'
import { AWAKENED_BRANCHES, AWAKENED_NAMES, SECOND_FORM_NAMES, SPECIES_NAMES, type AwakenedBranch, type Species } from '../../spirits/spirit'
import { BAR_SLOTS } from '../../open/ather/infusions'

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

/** M244: the awakened forms built so far, stage-3 ledger order (n = index + 1) */
export const AWAKENED: readonly (readonly [Species, GalleryElement, AwakenedBranch])[] = (['mana', 'storm', 'earth', 'water'] as const).flatMap(el => AWAKENED_BRANCHES.map((b): readonly [Species, GalleryElement, AwakenedBranch] => ['fox', el, b])).concat((['mana', 'storm', 'earth', 'water'] as const).flatMap(el => AWAKENED_BRANCHES.map((b): readonly [Species, GalleryElement, AwakenedBranch] => ['firefly', el, b]))).concat(AWAKENED_BRANCHES.map((b): readonly [Species, GalleryElement, AwakenedBranch] => ['owl', 'mana', b])).concat(AWAKENED_BRANCHES.map((b): readonly [Species, GalleryElement, AwakenedBranch] => ['frog', 'storm', b])).concat(AWAKENED_BRANCHES.map((b): readonly [Species, GalleryElement, AwakenedBranch] => ['frog', 'mana', b])).concat(AWAKENED_BRANCHES.map((b): readonly [Species, GalleryElement, AwakenedBranch] => ['frog', 'earth', b])).concat(AWAKENED_BRANCHES.map((b): readonly [Species, GalleryElement, AwakenedBranch] => ['frog', 'water', b])).concat(AWAKENED_BRANCHES.map((b): readonly [Species, GalleryElement, AwakenedBranch] => ['owl', 'water', b])).concat(AWAKENED_BRANCHES.map((b): readonly [Species, GalleryElement, AwakenedBranch] => ['turtle', 'earth', b])).concat(AWAKENED_BRANCHES.map((b): readonly [Species, GalleryElement, AwakenedBranch] => ['axolotl', 'storm', b])).concat(AWAKENED_BRANCHES.map((b): readonly [Species, GalleryElement, AwakenedBranch] => ['turtle', 'mana', b])).concat(AWAKENED_BRANCHES.map((b): readonly [Species, GalleryElement, AwakenedBranch] => ['axolotl', 'earth', b])).concat(AWAKENED_BRANCHES.map((b): readonly [Species, GalleryElement, AwakenedBranch] => ['turtle', 'storm', b])).concat(AWAKENED_BRANCHES.map((b): readonly [Species, GalleryElement, AwakenedBranch] => ['owl', 'storm', b])).concat(AWAKENED_BRANCHES.map((b): readonly [Species, GalleryElement, AwakenedBranch] => ['turtle', 'water', b]))   // sheet 2: Vulnarc's four (#055-#058); sheet 3: Vulnore's (#059-#062); sheet 4: Vulnix's (#063-#066); sheet 5: Luminel's (#067-#070); sheet 6: Luminarc's (#071-#074); sheet 7: Luminore's (#075-#078); sheet 9: Luminix's (#079-#082); sheet 8: Mystowl's (#083-#086, owl, after every firefly line); sheet 9b: Croakarc's (#087-#090, frog); sheet 11: Croakara's (#091-#094, frog); sheet 12: Croakore's (#095-#098, frog); sheet 12b: Croakrill's (#099-#102, frog); sheet 13: Tideowl's (#103-#106, owl); sheet 14: Mesamere's (#107-#110, turtle); sheet 15: Arclotl's (axolotl, after Mesamere's); sheet 15b: Aurmere's (#115-#118, turtle); sheet 16: Craglotl's (#119-#122, axolotl); sheet 17: Voltmere's (#123-#126, turtle); sheet 10: Voltowl's (#127-#130, owl); sheet 11: Tidemere's (#131-#134, turtle)

export type GalleryRow = {
  /** grimoire # (1-50) */ num: number
  name: string
  sp: Species
  /** null = the base spirit */ el: GalleryElement | null
  /** the 2D art: the base grimoire art or the form's locked art (public/) */ icon: string
  /** M244: an AWAKENED form (owner preview): her branch + look name (spirit-models AWAKENED_FORMS). Her icon is OUR render (the
   *  stage-3 locked art is private and never ships). */ aw?: { branch: AwakenedBranch; look: string }
}

/** public/ files keep the tardigrade as `waterbear` */
const artKey = (sp: Species) => (sp === 'water-bear' ? 'waterbear' : sp)

/** M202 (11-27): public/spirits/forms/*.png were older pictures until they were swapped for the LOCKED stage-2 art.
 *  Those files are served `immutable` for a year (browser + Cloudflare), so the form art URL carries a version:
 *  bump it whenever the form files change, or players keep the old pictures. */
export const FORM_ART_VER = 'locked1'

export const GALLERY: readonly GalleryRow[] = [
  ...ALL_SPECIES.map((sp, i): GalleryRow => ({ num: i + 1, name: SPECIES_NAMES[sp], sp, el: null, icon: `/spirits/${artKey(sp)}.png` })),
  ...DISCOVERY.map(([sp, el], i): GalleryRow => ({ num: ALL_SPECIES.length + i + 1, name: SECOND_FORM_NAMES[sp][el], sp, el, icon: `/spirits/forms/${artKey(sp)}_${el}.png?v=${FORM_ART_VER}` })),
  // M244: the awakened forms in stage-3 ledger order (#051 on), each after the 50: Vulnara's four first
  ...AWAKENED.map(([sp, el, branch], i): GalleryRow => {
    const name = AWAKENED_NAMES[SECOND_FORM_NAMES[sp][el].toLowerCase()]![branch], look = name.toLowerCase()
    return { num: ALL_SPECIES.length + DISCOVERY.length + i + 1, name, sp, el, icon: `/open/spirits/${look}-icon.png?v=1`, aw: { branch, look } }
  }),
]

export const galleryNo = (n: number) => `#${String(n).padStart(3, '0')}`

/** the dial's next index after a step (wheel notch / arrow key / drag row), held to the ends */
export const dialStep = (i: number, by: number, len = GALLERY.length) => Math.max(0, Math.min(len - 1, i + by))

// M213 s2 (Alex 11-26 19:4x: "glow comes from the infusion mix, not a default element colour"): the gallery's GLOW control is a
// STEEP MIX preview. Up to 10 meals by element (the Steep = her 10-slot bar, infusions.ts BAR_SLOTS); the meals go to the stage as
// her bar, and the game's own accentOf (spirit-accent.ts, M204) turns them into her glow. Default: no meals = no glow.
export type SteepMix = Readonly<Record<GalleryElement, number>>
export const STEEP_ELS: readonly GalleryElement[] = ['mana', 'storm', 'earth', 'water']
export const STEEP_NONE: SteepMix = { mana: 0, storm: 0, earth: 0, water: 0 }
export const steepTotal = (m: SteepMix) => STEEP_ELS.reduce((s, e) => s + m[e], 0)
/** add (or take away) meals of one element: never below 0, the whole bar never past BAR_SLOTS */
export function steepAdd(m: SteepMix, el: GalleryElement, by: number): SteepMix {
  const room = BAR_SLOTS - steepTotal(m)
  const v = Math.max(0, m[el] + Math.min(by, room))
  return v === m[el] ? m : { ...m, [el]: v }
}
/** the mix as her bar (feed order = the control's element order); empty = no glow */
export const steepMeals = (m: SteepMix): GalleryElement[] => STEEP_ELS.flatMap(e => Array.from({ length: m[e] }, () => e)).slice(0, BAR_SLOTS)
