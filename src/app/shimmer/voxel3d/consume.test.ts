// Eat / drink — the table and the WIRING. Run: npx tsx src/app/shimmer/voxel3d/consume.test.ts
import { readFileSync } from 'node:fs'
import { MAT } from '../voxel/depth'
import { codeOnly } from '../testing/guard'
import { POTION_DEFS, elementForInfusion } from '../engine/alchemy'
import { BUFF_DEFS, POTION_BUFFS, type BuffId } from '../engine/potion-effects'
import { consumeEffect, consumeRefusal, consumeLine, isConsumable, FOOD, WIRED_BUFFS } from './consume'
import { rightClickIntent } from './interact'
import { COOKED } from './alchemy-chain'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

// ── §1 the table: every brew swallows or says why not; nothing is silently inert ─────────────
{
  const inert = Object.keys(POTION_DEFS).filter(id => !isConsumable(id) && !consumeRefusal(id))
  ok(inert.length === 0, `§1 ★★ every potion is drinkable or refused with a reason — inert: ${inert.join(', ') || 'none'}`)
  const infusions = Object.keys(POTION_DEFS).filter(id => elementForInfusion(id))
  ok(infusions.length === 4 && infusions.every(id => !isConsumable(id) && consumeRefusal(id)!.includes('spirit')),
    `§1 the four elemental infusions are refused, not drunk (${infusions.length})`)
  ok(consumeEffect('mana_draught')?.mana === 40 && consumeEffect('mana_draught')?.kind === 'drink', '§1 a Mana Draught restores 40 mana')
  ok(consumeEffect('shimmer_salve')?.hp === 50, '§1 a salve mends 50 hp')
  ok(consumeEffect('crystal_elixir')?.sh === 75, '§1 an elixir re-forms 75 shield')
  ok(consumeEffect('moonvine_tonic')?.buff === 'fleetfoot', '§1 a tonic is a timed buff')
  ok((consumeEffect('harvest_brew')?.advanceCropsMs ?? 0) > 0, '§1 harvest brew advances crops')
  ok(consumeEffect('bread')?.kind === 'eat' && consumeEffect('bread')?.hp === FOOD.bread.hp, '§1 bread is eaten and mends')
  ok(COOKED.every(id => isConsumable(id)), '§1 ★ everything the oven bakes can be eaten')
  ok(consumeEffect('block_topsoil') === null && consumeRefusal('block_topsoil') === null, '§1 a block is neither')
  ok(consumeLine('bread', consumeEffect('bread')!, 'Bread').startsWith('you eat the bread: +'), '§1 the line says what happened')
  const unwired = (Object.keys(BUFF_DEFS) as BuffId[]).filter(b => !WIRED_BUFFS.has(b))
  for (const b of unwired) {
    const pid = Object.entries(POTION_BUFFS).find(([, v]) => v === b)![0]
    ok(consumeLine(pid, consumeEffect(pid)!, pid).includes('not felt here yet'), `§1 ★ ${b} is unwired and the drink line SAYS so`)
  }
}

// ── §2 the intent: a bottle in hand still opens a chest, still works a station ───────────────
{
  ok(rightClickIntent(MAT.CHEST, 'mana_draught', false, false, false, false, false, true) === 'open', '§2 a chest opens with a potion in hand')
  ok(rightClickIntent(MAT.CRAFT_TABLE, 'mana_draught', false, false, false, false, false, true) === 'work', '§2 a station works with a potion in hand')
  ok(rightClickIntent(MAT.OVEN, 'bread', false, false, false, false, false, true) === 'work', '§2 the oven opens with a loaf in hand')
  ok(rightClickIntent(MAT.STONE, 'mana_draught', false, false, false, false, false, true) === 'use', '§2 ★ a plain block + a consumable = use, not place')
  ok(rightClickIntent(MAT.STONE, 'block_topsoil', false, false, false, false, false, false) === 'place', '§2 a plain block + a block = place')
  ok(rightClickIntent(MAT.STONE, null, false, false, false, false, false, false) === 'none', '§2 an empty hand is still nothing')
}

// ── §3 the wiring: each WIRED buff has its hook in the host, and the save carries the timers ──
{
  const raw = readFileSync(new URL('./VoxelWorld.tsx', import.meta.url), 'utf8')
  const src = codeOnly(raw)
  ok(raw.length > 10_000, `VoxelWorld.tsx read (${raw.length} bytes)`)
  const hooks: Record<BuffId, string[]> = {
    fleetfoot:   ['lc.speedMult = speedMult(buffs.current'],
    dawn:        ['lc.speedMult = speedMult(buffs.current', 'gatherXpMult(buffs.current'],
    ather_flow:  ['manaRegenMult(buffs.current'],
    starlight:   ['gatherXpMult(buffs.current'],
    anglers_eye: ['rinTune(buffs.current'],
    kindred: [], deepsight: [], dreamwalk: [],
  }
  for (const b of WIRED_BUFFS) {
    const needles = hooks[b]
    ok(needles.length > 0 && needles.every(n => src.includes(n)), `§3 ★ ${b} is WIRED and its hook is in the host (${needles.join(' / ')})`)
  }
  for (const b of (Object.keys(hooks) as BuffId[]).filter(b => !WIRED_BUFFS.has(b))) {
    ok(hooks[b].length === 0, `§3 ${b} claims no hook`)
  }
  ok(src.split('gatherXpMult(buffs.current').length - 1 === 2, '§3 XP is multiplied at both gather sites (mining, rinning)')
  ok(src.includes('buffs: pruneBuffs(buffs.current, Date.now())'), '§3 ★ the save carries the timers, pruned')
  ok(src.includes('buffs.current = pruneBuffs(b, Date.now())'), '§3 ★ and the load reads them back, pruned')
  ok(src.includes('if (!hit && rightNow && !weaponDrawn && selItem && isConsumable(selItem))'), '§3 ★ a bottle raised at the sky is a drink (no-target path)')
  ok(raw.includes("} else if (intent === 'use' && selItem) {"), '§3 ★ and the aimed path answers the intent')   // raw: codeOnly strips string bodies
  ok(src.includes('<BuffChips buffs={buffs} />'), '§3 the chips are mounted')
  // The locomotion hook is a real multiplier on the walk/run target and nothing else.
  const loco = codeOnly(readFileSync(new URL('./locomotion.ts', import.meta.url), 'utf8'))
  ok(loco.includes('* s.speedMult'), '§3 locomotion scales the ramped target by speedMult')
  ok(!loco.includes('CROUCH_SPEED * s.speedMult') && !loco.includes('DRAINED_SPEED * s.speedMult'), '§3 and never the crouch or the drain cap')
}

console.log(`consume: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length ? 1 : 0)
