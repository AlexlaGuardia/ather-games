// Station-menu render test — run: npx tsx src/app/shimmer/play3d/StationMenus.test.tsx
//
// Added 2026-07-09 when the five station menus were extracted out of Shimmer3D.tsx. The extraction
// typechecked on the first try, which proves nothing: a menu can compile perfectly and render blank.
// This renders every branch against real engine state and asserts each panel actually appears, so a
// future edit to StationMenus can't silently break one of the five.

import { renderToStaticMarkup } from 'react-dom/server'
import Module from 'node:module'
import type { PlacedStruct, StationKind } from './StationMenus'

// ★ THE HEARTH KIT LOADS `next/font`, WHICH ONLY EXISTS INSIDE NEXT'S COMPILER (2026-09-23). The menus
// wear the Carved Hearth now; `ui/hearth-fonts.ts` calls `Fraunces()`/`Nunito()`, which Next rewrites at
// build time and which are not functions under node. Stub the module for THIS render — the fonts are CSS
// variables the markup names, and nothing here asserts a typeface — then load the menus after it.
const realLoad = (Module as unknown as { _load: (...a: unknown[]) => unknown })._load
;(Module as unknown as { _load: (...a: unknown[]) => unknown })._load = function (req: unknown, ...rest: unknown[]) {
  if (req === 'next/font/google') return new Proxy({}, { get: () => () => ({ variable: '', className: '' }) })
  return realLoad.call(this, req, ...rest)
}
// …and its stylesheet (`import './hearth.css'`), which only a bundler can load. Motion and scrollbars — no assert reads them.
;(Module as unknown as { _extensions: Record<string, (m: { exports: unknown }) => void> })._extensions['.css'] = (m) => { m.exports = {} }
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { StationMenus } = require('./StationMenus') as typeof import('./StationMenus')
import { createSkillSet } from '../engine/skills'
import { createInventory, addItems, createChestStorage } from '../engine/inventory'
import { createBank } from '../engine/bank'
import { createManaPool } from '../engine/mana'
import { ensureBasicTools } from '../engine/tools'
import { createGEState } from '../engine/exchange'
import type { PlantedCrop } from '../engine/farming'

let ok = 0, bad = 0
const chk = (n: string, c: boolean, x = '') => { c ? ok++ : (bad++, console.error('  FAIL:', n, x)) }

const ref = <T,>(v: T) => ({ current: v }) as React.RefObject<T>
const struct: PlacedStruct = { itemId: 'alchemy_station', tileX: 3, tileY: 4, facing: 0, zoneId: 'home-plot' }
const noop = () => {}

// A player mid-game: some skills, a stocked satchel, basic tools, a live market.
function makeProps(kind: StationKind, crops: PlantedCrop[] = []) {
  const skills = createSkillSet()
  skills.alchemy.level = 12
  skills.farming.level = 8
  const inv = createInventory()
  addItems(inv, 'goldwood_plank', 20)
  addItems(inv, 'raw_mana_shard', 20)
  addItems(inv, 'goldwood_bark', 20)
  addItems(inv, 'seed_shimmerwheat', 5)
  return {
    openMenu: { kind, struct },
    closeStation: noop,
    skillsRef: ref(skills),
    invRef: ref(inv),
    manaRef: ref(createManaPool(9)),
    equippedToolsRef: ref(ensureBasicTools({})),
    geRef: ref(createGEState()),
    plantedCropsRef: ref(crops),
    toolTick: 0, chestsTick: 0, cropsTick: 0,
    wallet: { marks: 500 },
    tradeToast: null,
    brew: noop, craft: noop, craftToolAction: noop, repairToolAction: noop,
    bankRef: ref(createBank()), bankTick: 0, bankCapacityNow: () => 5250,
    bankDepositSlot: noop, bankDepositAllMaterials: noop, bankWithdrawItem: noop,
    getChest: () => createChestStorage('home-plot:3,4'),
    transferChestSlot: noop,
    tradeSell: noop, tradeBuy: noop,
    harvestAt: noop, plantAt: noop,
  }
}

const render = (kind: StationKind, crops?: PlantedCrop[]) =>
  renderToStaticMarkup(<StationMenus {...makeProps(kind, crops)} />)

// Each menu renders, and renders ITS OWN panel (not a neighbour's).
// Match the title AS THE PLAQUE'S WHOLE TEXT (`>Garden bank<`), not a bare word: a word can also appear
// in a panel's body (the bank's note says "chest", the planter's rows say "Planter"), and a bare-word
// check once passed with the title deliberately broken — caught by mutating it. (Was the emoji-caps
// title; the hearth plaques are plain sentence case, 2026-09-23, so the tag boundary does that job.)
const expect: Record<StationKind, string> = {
  brew: '>Alchemy station<',
  craft: '>Crafting table<',
  chest: '>Garden bank<',
  exchange: '>Exchange booth<',
  farm: '>Planter<',
}
for (const kind of Object.keys(expect) as StationKind[]) {
  let html = ''
  try { html = render(kind) } catch (e) { chk(`${kind} renders without throwing`, false, String(e)); continue }
  chk(`${kind} renders without throwing`, true)
  chk(`${kind} shows its own title`, html.includes(expect[kind]), html.slice(0, 120))
  chk(`${kind} renders a panel body`, html.length > 400, `len=${html.length}`)
}

// Closed menu renders nothing at all.
chk('null openMenu renders nothing',
  renderToStaticMarkup(<StationMenus {...{ ...makeProps('brew'), openMenu: null }} />) === '')

// The crafting table shows the ⚒ TOOLS section + a craftable tool (the tool-maintenance feature).
{
  const html = render('craft')
  chk('craft shows the tools section', html.includes('>tools<'))
  chk('craft lists a tier tool', /T[123]/.test(html))
}

// Alchemy gates potions by level: a Lv12 alchemist sees names, and locked ones show a level chip.
{
  const html = render('brew')
  chk('brew lists potions', html.includes('Brew'))
  chk('brew shows the alchemy level', html.includes('alchemy 12'))
}

// Exchange shows the wallet + tax, and offers the curated buy list.
{
  const html = render('exchange')
  chk('exchange shows marks', html.includes('500 marks'))
  chk('exchange has a Buy section', html.includes('>Buy<'))
  chk('exchange has a Sell section', html.includes('>Sell<'))
}

// Planter: empty → seed list; planted → growth bar. Both branches.
{
  const empty = render('farm')
  chk('empty planter offers seeds', empty.includes('Plant') || empty.includes('No plantable seeds'))
  chk('planter shows farming level', empty.includes('farming 8'))

  const crop: PlantedCrop = {
    id: 'c1', cropId: 'shimmerwheat', tileX: 3, tileY: 4, zoneId: 'home-plot',
    plantedAt: Date.now() - 1000, growthDuration: 60_000,
  } as PlantedCrop
  const planted = render('farm', [crop])
  chk('planted planter shows a harvest button', planted.includes('Harvest'))
  chk('planted planter does NOT show the seed list', !planted.includes('No plantable seeds'))
}

console.log(`\nstation menus: ${ok} passed, ${bad} failed`)
if (bad) process.exit(1)
