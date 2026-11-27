// M231 (Alex 11-27, reversing M220's 'never pops'): a punch pops the FIRST Keepstone into the bag like any piece; setting a
// plain Keepstone down stands it again. The guard: the garden bank's stacks never move or vanish whatever happens to the
// stone, and while no Keepstone stands the keeper is told where the bank opens. Old saves load with it standing.
// Run: npx tsx src/app/shimmer/open/ather/keepstone-pop.test.ts
import { readFileSync } from 'node:fs'
import { meleeTarget, strike, breakTarget, MELEE_HITS } from './melee'
import { freshWorks, allChests, chestsStanding, starterChest, noBankDoor, nearWork, loadWorks, saveWorks, pickUpChest, placeChest, canPlaceChest, STARTER_CHEST, STARTER_ID, KEEPSTONE, type Works } from './rooms'
import { STARTING_SQUARES, GROUND_Y } from './plot'
import { bankCap, putIn, deposit, withdraw, freshBank, bankCount, CHEST_SLOTS, type Bank } from './garden-bank'
import { BANK_DOOR_HINT } from './bank-door'
import { newInv, give, countOf, HOTBAR, SLOTS, type Inv } from '../shared/inventory'
let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const owned = new Set<string>(STARTING_SQUARES)
const eye = GROUND_Y + 1.62
const look = (x: number, z: number, tx: number, ty: number, tz: number): [[number, number, number], [number, number, number]] => {
  const d = [tx - x, ty - eye, tz - z], l = Math.hypot(...d); return [[x, eye, z], d.map(v => v / l) as [number, number, number]] }
const S = STARTER_CHEST

// a bank with real things in it, a full 48 slots of them
let bank: Bank = freshBank()
for (let i = 0; i < CHEST_SLOTS; i++) bank = putIn(bank, bankCap(1), i % 2 ? 'log' : 'stone', 1).bank
bank = putIn(bank, bankCap(1), 'log', 5).bank
const snap = JSON.stringify(bank)

// ── the punch: three hits on the first Keepstone pop it into the bag ──
const fresh = freshWorks()
{ const [o, d] = look(S.x, S.z + 1.6, S.x, GROUND_Y + 0.6, S.z), t = meleeTarget(fresh, o, d)
  ok(t?.kind === 'chest' && t.id === STARTER_ID, `punch: aiming at the first Keepstone lands on it (${JSON.stringify(t)})`) }
let h = null as ReturnType<typeof strike>['hits'], broke = false
for (let i = 0; i < MELEE_HITS; i++) { const r = strike(h, STARTER_ID, 1000 + i * 400); h = r.hits; broke = r.broke }
ok(broke, `punch: ${MELEE_HITS} hits pop the first Keepstone`)
const b = breakTarget(fresh, { kind: 'chest', id: STARTER_ID }, newInv(), {})
if (!b || b === 'spirit') { fails.push('punch: the break did not come back'); report() }
const out = (b as { works: Works; inv: Inv }).works, inv1 = (b as { works: Works; inv: Inv }).inv
ok(countOf(inv1, KEEPSTONE) === 1, 'bag: the first Keepstone is in the bag as a plain Keepstone')
ok(out.starterOut === true && out.starter === undefined, `works: marked out (${JSON.stringify({ o: out.starterOut, s: out.starter })})`)
ok(allChests(out).length === 0 && chestsStanding(out) === 0 && noBankDoor(out), 'works: nothing stands, the bank has no door')
ok(!noBankDoor(fresh), 'hint: a fresh plot has a door (no hint)')
ok(nearWork(out, S.x, S.z - 1)?.kind !== 'chest', 'E: the old spot no longer answers as a Keepstone')
{ const [o, d] = look(S.x, S.z + 1.6, S.x, GROUND_Y + 0.6, S.z); ok(meleeTarget(out, o, d)?.kind !== 'chest', 'punch: nothing left to hit where it stood') }
ok(fresh.starterOut === undefined && allChests(fresh).length === 1, 'pure: the break mutated its input')
ok(pickUpChest(out, STARTER_ID, inv1) === null, 'twice: a starter already in the bag cannot come up again')
{ // a full bag refuses: nothing moves
  let full = newInv(); for (let i = 0; i < SLOTS; i++) full = { ...full, slots: full.slots.map((s, j) => (j === i ? { id: 'log', n: 99 } : s)) }
  ok(breakTarget(fresh, { kind: 'chest', id: STARTER_ID }, full, {}) === null, 'full bag: the starter stays standing') }

// ── the guard: the bank's stacks never move or vanish while the stone is in the bag ──
ok(bankCap(chestsStanding(out)) === 0, 'cap: no door, no new room')
{ const bag = give(newInv(), 'stone', 3).inv, at = bag.slots.findIndex((s, i) => i >= 0 && s?.id === 'stone')
  const r = deposit(bag, at, bank, bankCap(chestsStanding(out)))
  ok(r.bank.stacks.length === bank.stacks.length && bank.stacks.every((s0, i) => r.bank.stacks[i].id === s0.id && r.bank.stacks[i].n >= s0.n), 'bank: with no door no stack is added, lost or shrunk') }
ok(JSON.stringify(putIn(bank, 0, 'log', 999).bank.stacks.length) === String(bank.stacks.length) && bankCount(putIn(bank, 0, 'log', 999).bank, 'stone') === bankCount(bank, 'stone'), 'bank: over the cap nothing is trimmed')
ok(JSON.stringify(bank) === snap, 'bank: untouched by the pop')

// ── save: out survives a reload; an old save (no flag) loads with the stone standing ──
{ const mem: Record<string, string> = {}
  ;(globalThis as any).localStorage = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v }, removeItem: (k: string) => { delete mem[k] } }
  saveWorks(out); const back = loadWorks()
  ok(back.starterOut === true && noBankDoor(back), 'save: the stone in the bag survives a reload')
  saveWorks(fresh); const old = loadWorks()
  ok(old.starterOut === undefined && allChests(old)[0]?.id === STARTER_ID && !noBankDoor(old), 'old save: the first Keepstone stands')
  const moved = { ...fresh, starter: { x: -100, z: 110, q: 1 } }; saveWorks(moved)
  ok(starterChest(loadWorks()).x === -100 && !loadWorks().starterOut, 'old save (M220 moved): it stands where it was moved')
  mem[Object.keys(mem)[0]] = JSON.stringify({ ...JSON.parse(mem[Object.keys(mem)[0]]), starterOut: 'yes' })
  ok(loadWorks().starterOut === undefined, 'save: junk is not read as out') }

// ── re-place: a plain Keepstone set down stands the first one again; E opens the same bank, items intact ──
const to = { x: -100, z: 110 }
ok(canPlaceChest(out, owned, to.x, to.z, 0, inv1).ok, 'place: a clear owned spot was refused')
const p = placeChest(out, owned, inv1, to.x, to.z, 1, 5000)
ok(!!p, 'place: the Keepstone did not go down')
if (p) {
  ok(p.works.starterOut === undefined && p.works.chests.length === 0 && p.chest.id === STARTER_ID, `place: it stands as the first Keepstone again (${p.chest.id})`)
  ok(starterChest(p.works).x === to.x && starterChest(p.works).z === to.z && starterChest(p.works).q === 1, 'place: it stands where it was set')
  ok(countOf(p.inv, KEEPSTONE) === 0, 'place: it left the bag')
  ok(chestsStanding(p.works) === 1 && bankCap(chestsStanding(p.works)) === CHEST_SLOTS && !noBankDoor(p.works), 'place: the door and its 48 slots are back')
  const n = nearWork(p.works, to.x, to.z - 1); ok(n?.kind === 'chest' && n.id === STARTER_ID, `E: the re-placed stone answers (${JSON.stringify(n)})`)
  ok(JSON.stringify(bank) === snap, 'bank: every stack still there after the round trip')
  const w = withdraw(bank, 0, newInv()); ok(w.moved > 0, 'bank: a stack comes out once the door is back')
}
{ // a FOUND Keepstone set down while the first is out is its own stone; the first stays in the bag
  const inv = give(newInv(), 'keepstone_violet', 1).inv
  const q = placeChest(out, owned, inv, to.x, to.z, 0, 6000, 'keepstone_violet')
  ok(!!q && q.works.starterOut === true && q.works.chests.length === 1 && !noBankDoor(q.works), 'found stone: stands as itself, opens the bank, the first stays out') }
{ // a placed Keepstone plus the first one popped: still a door, no hint
  const w2: Works = { ...fresh, chests: [{ id: 'k1', x: to.x, z: to.z, q: 0, placedAt: 1 }] }
  const r = pickUpChest(w2, STARTER_ID, newInv()); ok(!!r && !noBankDoor(r.works) && chestsStanding(r.works) === 1, 'two stones: popping the first leaves the other as the door') }

// ── the hint: plain, one line, no em dash; the bag and the toast both read it ──
ok(BANK_DOOR_HINT.length < 90 && !/[—\n]/.test(BANK_DOOR_HINT), `hint: one plain line (${BANK_DOOR_HINT})`)
{ const pack = readFileSync(new URL('../pack.tsx', import.meta.url), 'utf8'), view = readFileSync(new URL('./melee-view.tsx', import.meta.url), 'utf8')
  ok(/noBankDoor\(loadWorks\(\)\)/.test(pack) && /BANK_DOOR_HINT/.test(pack), 'hint: the bag footer reads it')
  ok(/noBankDoor\(b\.works\)/.test(view) && /BANK_DOOR_HINT/.test(view), 'hint: the punch toast reads it') }
void HOTBAR

function report(): never { console.log(`keepstone-pop: ${pass} pass, ${fails.length} fail`); for (const f of fails) console.log('  FAIL', f); process.exit(fails.length ? 1 : 0) }
report()
