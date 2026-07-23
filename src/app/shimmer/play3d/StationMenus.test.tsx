// Station-menu render test — run: npx tsx src/app/shimmer/play3d/StationMenus.test.tsx
//
// Added 2026-07-09 when the five station menus were extracted out of Shimmer3D.tsx. The extraction
// typechecked on the first try, which proves nothing: a menu can compile perfectly and render blank.
// This renders every branch against real engine state and asserts each panel actually appears, so a
// future edit to StationMenus can't silently break one of the five.

import { renderToStaticMarkup } from 'react-dom/server'
import { StationMenus, type PlacedStruct, type StationKind } from './StationMenus'
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
// Match the FULL emoji title, not a bare word: `CHEST` also appears as the chest panel's section
// header, so a bare-word check passed even with the title deliberately broken. Caught by mutating
// the title and watching this suite stay green. Keep the emoji.
const expect: Record<StationKind, string> = {
  brew: '⚗ ALCHEMY STATION',
  craft: '🔨 CRAFTING TABLE',
  chest: '🏦 GARDEN BANK',
  exchange: '💰 EXCHANGE BOOTH',
  farm: '🌱 PLANTER',
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
  chk('craft shows the TOOLS section', html.includes('TOOLS'))
  chk('craft lists a tier tool', /T[123]/.test(html))
}

// Alchemy gates potions by level: a Lv12 alchemist sees names, and locked ones show a level chip.
{
  const html = render('brew')
  chk('brew lists potions', html.includes('Brew'))
  chk('brew shows the alchemy level', html.includes('Alchemy Lv 12'))
}

// Exchange shows the wallet + tax, and offers the curated buy list.
{
  const html = render('exchange')
  chk('exchange shows marks', html.includes('500 marks'))
  chk('exchange has a BUY section', html.includes('BUY'))
  chk('exchange has a SELL section', html.includes('SELL'))
}

// Planter: empty → seed list; planted → growth bar. Both branches.
{
  const empty = render('farm')
  chk('empty planter offers seeds', empty.includes('Plant') || empty.includes('No plantable seeds'))
  chk('planter shows farming level', empty.includes('Farming Lv 8'))

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
