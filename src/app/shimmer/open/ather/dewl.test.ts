// BETA M159: dewls. npx tsx src/app/shimmer/open/ather/dewl.test.ts
import { readFileSync } from 'node:fs'
import { DEWL, DEWL_FIRST, GIFT_DEWL_FIRST, markFirstDewl, withDewls } from './dewl'
import { minePlan, CRYSTAL_KINDS, TIER, type CrystalKind } from './prospecting'
import { prunePlan } from './forestry'
import { newInv, give, countOf, take, itemDef, ITEM_GROUP, SLOTS, type Inv } from '../shared/inventory'
import { dropPack, reclaim } from './backpack'
import { roomAccepts, type RoomKind } from './rooms'
import { pilesOf } from './ground-loot'
let fails = 0, n = 0
const ok = (c: boolean, m: string) => { n++; if (!c) { fails++; console.log(`✗ ${m}`) } }
const WANT: Record<CrystalKind, number> = { raw: 1, violet: 2, storm: 2, earth: 2, water: 2, egg: 2, pure: 3, ather: 5 }   // Alex 11-25
const of = (ds: readonly { id: string; n: number }[]) => ds.filter(d => d.id === DEWL).reduce((a, d) => a + d.n, 0)
for (const k of CRYSTAL_KINDS) for (const r of [0, 0.3, 0.6, 0.999]) {
  const p = minePlan(k, () => r)
  ok(of(p.drops) === WANT[k] && p.drops.filter(d => d.id === DEWL).length === 1, `${k} (roll ${r}): ${of(p.drops)} dewls, want ${WANT[k]}`)
  ok(p.drops[0].id === 'blankstone' && p.drops.length >= 3 && p.drops[1].n >= 1, `${k}: beside the usual drop`)
  ok(JSON.stringify(withDewls(p.drops, TIER[k])) === JSON.stringify(p.drops), `${k}: topped up once, never twice`)
  ok(of(withDewls(p.drops.filter(d => d.id !== DEWL), TIER[k])) === WANT[k], `${k}: a node touched before dewls came still gives them`)
  ok(of(pilesOf(p.drops)) === WANT[k], `${k}: its piles add up`)
}
ok(of(prunePlan('goldwood')) === 0, 'a tree gives none')
// the bag row
ok(itemDef(DEWL).name === 'Dewl' && itemDef(DEWL).kind === 'material' && itemDef(DEWL).stack === 99, 'a bag item that stacks')
const g = give(newInv(0), DEWL, 100); ok(g.left === 0 && g.inv.slots.filter(s => s?.id === DEWL).length === 2 && countOf(take(g.inv, DEWL, 100)!, DEWL) === 0, '100 = two slots, and spends whole')
const full: Inv = { v: 1, slots: Array.from({ length: SLOTS }, (_, i) => ({ id: `junk${i}`, n: 1 })) }
ok(give(full, DEWL, 1).left === 1, 'a full bag takes none')
// death: with the pack, and back
const d = dropPack(g.inv, 1, 2, 3, 0); ok(countOf(d.inv, DEWL) === 0 && of(d.pack!.items) === 100 && countOf(reclaim(d.inv, d.pack!, 1000).inv, DEWL) === 100, 'a fall drops them with the pack; the touch brings them back')
// not a gem: no group, no room, no bench, no source that names it
ok(!(DEWL in ITEM_GROUP), 'no item group')
for (const r of ['rinnshop', 'farm', 'cooking', 'alchemy', 'smith', 'carpentry', 'stonemason'] as RoomKind[]) ok(!roomAccepts(r, DEWL), `${r} does not take it`)
for (const f of ['../../play3d/gems.ts', '../../play3d/rune-inventory.ts', '../shared/sigil.ts', 'digger-trade.ts', '../trade.ts']) ok(!/\bdewl/i.test(readFileSync(new URL(f, import.meta.url), 'utf8')), `${f} never names it`)
// the first one, once ever
const b25 = readFileSync('/root/athernyx/CANON/game/shimmer-lines-batch-2026-11-25b.md', 'utf8')
ok(/\| `dewl:first`[^|]*\|[^|]*\| \*\*(.+?)\*\* \|/.exec(b25)?.[1] === DEWL_FIRST, 'dewl:first = signed')
const m1 = markFirstDewl(g.inv); ok(!!m1 && m1.gifts!.includes(GIFT_DEWL_FIRST) && m1.gifts!.includes('bait1') && markFirstDewl(m1) === null, 'once, and the other marks stay')
ok(markFirstDewl(dropPack(m1!, 0, 0, 0, 0).inv) === null && markFirstDewl(give(take(m1!, DEWL, 100)!, DEWL, 1).inv) === null, 'still once after a death, or all spent')
console.log(fails ? `FAIL ${fails}/${n}` : `PASS ${n}/${n}`); process.exit(fails ? 1 : 0)
