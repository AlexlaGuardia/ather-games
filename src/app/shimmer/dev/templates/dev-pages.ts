/**
 * THE DEV SURFACE, IN ONE PLACE — every standalone dev route this repo ships.
 *
 * ★★★ WHY THIS EXISTS (2026-09-01, hub lane). Alex: *"i feel like there is way more than i even
 * know about lol so at the very least i should be able to navigate trough it."* He was right, and
 * the number is the argument: **sixteen standalone pages under `/shimmer/dev/`, of which exactly
 * ONE — `dialogue` — was linked from anywhere in the UI.** The other fifteen were reachable only
 * by typing a URL you had to already know. Fourteen of them were built in a nine-day burst between
 * 2026-08-23 and 08-31, several of them *because* Alex said he was flying blind, and then shipped
 * into a place he could not click to.
 *
 * ⚠ THE DISCOVERY MECHANISM WAS ALREADY BUILT AND NEARLY EMPTY. `command-registry.ts` had 30
 * editor modes and **two** navigate entries. The Ctrl-K palette, the category dots, the grouping —
 * all of it worked. Nobody registered anything, because registering was a separate act of memory
 * from shipping the page. That is the whole failure, and it is why `dev-pages.test.ts` makes the
 * registration MANDATORY rather than polite: a new dev page is red until it appears here.
 *
 * ── WHAT BELONGS HERE ────────────────────────────────────────────────────────────────────────
 * Standalone dev ROUTES. The thirty editors inside `/shimmer/dev?mode=x` are not routes; they live
 * in `EDITOR_MAP` + `TAB_GROUPS` in `../page.tsx` and are already navigable. This file is for the
 * pages that have their own URL, including the ones outside `/shimmer/dev/` entirely — which were
 * the most invisible of all, since nothing in the Shimmer dev hub even hints they exist.
 *
 * ── THE BLURB IS NOT DECORATION ──────────────────────────────────────────────────────────────
 * Every blurb below is lifted from the page's OWN header comment, because those headers are good
 * and because a second, independently-worded description is a copy that rots away from its source
 * (PATTERNS 2026-08-22: a mirror reads as corroboration). If a page's purpose changes, its header
 * changes, and this line should be re-copied from it — not re-invented here.
 */

export type DevGroup = 'glass' | 'bench' | 'editor' | 'proto'

export interface DevPage {
  /** Route path, exactly as the browser sees it. */
  path: string
  /** Short name for the index card and the palette. */
  title: string
  /** One line, lifted from the page's own header comment. */
  blurb: string
  group: DevGroup
  /** Extra search terms for Ctrl-K. */
  keywords?: string[]
}

export const DEV_GROUPS: Record<DevGroup, { label: string; note: string }> = {
  glass: {
    label: 'Looking glasses',
    note: 'One thing, isolated, so a LOOK can settle it instead of a walk through the world.',
  },
  bench: {
    label: 'Benches',
    note: 'Drive a system with no world under it, and judge how it behaves.',
  },
  editor: {
    label: 'Editors',
    note: 'Author something and save it. These have their own route rather than a hub tab.',
  },
  proto: {
    label: 'Prototypes & spikes',
    note: 'Standalone routes kept because they still answer a question. Not maintained as tools.',
  },
}

export const DEV_PAGES: DevPage[] = [
  // ── Looking glasses ─────────────────────────────────────────────────────────────────────────
  {
    path: '/shimmer/dev/panel',
    title: 'The keeper panel',
    blurb: 'The inventory panel over a fabricated keeper, so a dark seat can be read without earning 75 Marks first.',
    group: 'glass',
    keywords: ['panel', 'inventory', 'seats', 'vessel', 'bracelet', 'focus', 'gear', 'satchel', 'letters', 'gems'],
  },
  {
    path: '/shimmer/dev/grey',
    title: 'The Grey',
    blurb: 'A Hollow, at the hour it actually exists, next to the ground it has to stand out from.',
    group: 'glass',
    keywords: ['hollow', 'night', 'silhouette', 'contrast', 'luma'],
  },
  {
    path: '/shimmer/dev/building',
    title: 'Building vocabulary',
    blurb: 'Every building material, drawn the way the world draws it, mixed and re-rollable.',
    group: 'glass',
    keywords: ['wall', 'texture', 'stone', 'brick', 'palette', 'material'],
  },
  {
    path: '/shimmer/dev/hollow',
    title: 'The Hollow Bench',
    blurb: 'Can a Hollow be findable at night without owning a light?',
    group: 'glass',
    keywords: ['hollow', 'grey', 'borrowed specular', 'emissive', 'enemy', 'night', 'canon'],
  },
  {
    path: '/shimmer/dev/clay',
    title: 'The Clay Bench',
    blurb: 'Does a rigid-part moglin, posed and shot on twos, read as clay?',
    group: 'glass',
    keywords: ['claymation', 'stop motion', 'moglin', 'rig', 'animation', 'doll', 'character'],
  },
  {
    path: '/shimmer/dev/break',
    title: 'The Chips',
    blurb: 'Every bucket breaking side by side, so the feel can be judged instead of argued.',
    group: 'glass',
    keywords: ['particle', 'vfx', 'block break', 'mining'],
  },
  {
    path: '/shimmer/dev/court',
    title: 'The Court',
    blurb: 'The crossing station on a bare plane, at any tier, from any distance.',
    group: 'glass',
    keywords: ['landmark', 'station', 'crossing', 'tier', 'fog'],
  },
  {
    path: '/shimmer/dev/hold',
    title: 'The Green',
    blurb: "The Snagbarrows' set piece on a bare plane, free or taken, from any bearing.",
    group: 'glass',
    keywords: ['snagbarrows', 'hold', 'town', 'collar', 'audience'],
  },
  {
    path: '/shimmer/dev/ring',
    title: 'Plot ring',
    blurb: 'The spirits that live about your fold, standing still enough to look at.',
    group: 'glass',
    keywords: ['home plot', 'spirits', 'fold', 'ambient'],
  },
  {
    path: '/shimmer/dev/seam',
    title: 'The Seam',
    blurb: 'The shipped shimmer, standing still so it can be looked at.',
    group: 'glass',
    keywords: ['shimmer', 'seam', 'effect'],
  },
  {
    path: '/shimmer/dev/portraits',
    title: 'Spirit portraits',
    blurb: 'Every locked spirit portrait, in the states the grimoire draws.',
    group: 'glass',
    keywords: ['grimoire', 'spirit', 'art', 'portrait'],
  },
  {
    path: '/shimmer/dev/icons',
    title: 'Item icons',
    blurb: "Every icon the game can put in a keeper's hands, drawn the way the bag draws it.",
    group: 'glass',
    keywords: ['item', 'icon', 'inventory', 'hotbar', 'bag'],
  },
  {
    path: '/shimmer/dev/hud',
    title: 'HUD corner',
    blurb: 'The HUD corner, alone, with no world under it.',
    group: 'glass',
    keywords: ['ui', 'hud', 'mana', 'health', 'sockets'],
  },

  // ── Benches ─────────────────────────────────────────────────────────────────────────────────
  {
    path: '/shimmer/dev/moves',
    title: 'Moves bench',
    blurb: 'Cast behaviour with no world under it — tremor sense, flame cloak, channel and bore.',
    group: 'bench',
    keywords: ['cast', 'rune', 'meltbore', 'tremor', 'flame cloak', 'channel'],
  },
  {
    path: '/shimmer/dev/creep',
    title: 'Hollow voice',
    blurb: 'Hear a thing walk around you, and see where it actually is. Headphones required.',
    group: 'bench',
    keywords: ['audio', 'sound', 'stalker', 'listening', 'positional'],
  },
  {
    path: '/shimmer/dev/runehold',
    title: 'Rune Hold',
    blurb: 'Greybox, walkable, with the mannequin on a live toggle. Settles how tall the keeper is.',
    group: 'bench',
    keywords: ['greybox', 'town', 'scale', 'proportion', 'keeper height'],
  },
  {
    path: '/shimmer/dev/worktable',
    title: 'Structure worktable',
    blurb: 'Build a building on a bare pad, save it, load it back.',
    group: 'bench',
    keywords: ['structure', 'house', 'build', 'blocks', 'pad'],
  },

  // ── Editors with their own route ────────────────────────────────────────────────────────────
  {
    path: '/shimmer/dev/dialogue',
    title: 'Dialogue editor',
    blurb: 'Visual conversation graphs for NPCs.',
    group: 'editor',
    keywords: ['npc', 'conversation', 'talk', 'graph', 'nodes'],
  },
  {
    path: '/vault/dev',
    title: 'Vault map editor',
    blurb: 'Pick a ladder slot (Area x Level), paint the run, save it live.',
    group: 'editor',
    keywords: ['vault', 'map', 'level', 'ladder', 'platformer'],
  },
  {
    path: '/nolmir/dev',
    title: 'Crucible editor',
    blurb: 'Nolmir’s integration hub — paint a layout with the mouse, balance-test it.',
    group: 'editor',
    keywords: ['nolmir', 'crucible', 'layout', 'terrarium'],
  },
  {
    path: '/nolmir/sfx-lab',
    title: 'SFX vibe lab',
    blurb: 'Three sonic directions mapped to game events, synthesized live, zero assets.',
    group: 'editor',
    keywords: ['nolmir', 'sound', 'sfx', 'audio', 'vibe'],
  },
  {
    path: '/shimmer/dev/voice-test',
    title: 'Luna voice test',
    blurb: 'Pick the voice that IS Luna — 3 voices x 4 moods. Luna stack, not game dev.',
    group: 'editor',
    keywords: ['luna', 'voice', 'tts', 'casting'],
  },

  // ── Prototypes & spikes ─────────────────────────────────────────────────────────────────────
  {
    path: '/shimmer/arena',
    title: "Keeper's Arena",
    blurb: 'Standalone cold-play harness for a spirit fight.',
    group: 'proto',
    keywords: ['battle', 'combat', 'arena', 'fight'],
  },
  {
    path: '/shimmer/play3d/birth',
    title: 'Birth rune ritual',
    blurb: 'Spin the carousel, pick a rune, be born to it.',
    group: 'proto',
    keywords: ['rune', 'birth', 'ritual', 'onboarding'],
  },
  {
    path: '/shimmer/voxel3d/tex',
    title: 'Block texture spike',
    blurb: 'Textured against flat, identical geometry, so mipmaps and variation can be compared.',
    group: 'proto',
    keywords: ['texture', 'voxel', 'mipmap', 'tiles'],
  },
]

/** Group order as the index renders them. Tools first, scratch last. */
export const DEV_GROUP_ORDER: DevGroup[] = ['glass', 'bench', 'editor', 'proto']

export function devPagesByGroup(group: DevGroup): DevPage[] {
  return DEV_PAGES.filter(p => p.group === group)
}
