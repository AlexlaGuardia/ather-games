// M220 (Alex 11-26): the FIRST Keepstone can be punched (the hit lands, it never comes up) and picked up to MOVE it: set down
// anywhere a Keepstone may stand; the bank, its cap and the bag are untouched; the save keeps the spot; an old save keeps it
// by the planning table. Run: npx tsx src/app/shimmer/open/ather/starter-move.test.ts
import { meleeTarget, strike, breakTarget, MELEE_HITS } from './melee'
import { freshWorks, allChests, chestsStanding, starterChest, canMoveStarter, moveStarter, nearWork, loadWorks, saveWorks, pickUpChest, adoptStarter, STARTER_CHEST, STARTER_ID, type Works } from './rooms'
import { STARTING_SQUARES, GROUND_Y, GATE } from './plot'
import { bankCap } from './garden-bank'
import { newInv, countOf } from '../shared/inventory'
let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const owned = new Set<string>(STARTING_SQUARES)
const eye = GROUND_Y + 1.62
const look = (x: number, z: number, tx: number, ty: number, tz: number): [[number, number, number], [number, number, number]] => {
  const d = [tx - x, ty - eye, tz - z], l = Math.hypot(...d); return [[x, eye, z], d.map(v => v / l) as [number, number, number]] }

// ── punch: the starter is a target, the hit lands, the count never reaches the break ──
{ const S = STARTER_CHEST, [o, d] = look(S.x, S.z + 1.6, S.x, GROUND_Y + 0.6, S.z), t = meleeTarget(freshWorks(), o, d)
  ok(t?.kind === 'chest' && t.id === STARTER_ID, `punch: aiming at the starter Keepstone lands on it (${JSON.stringify(t)})`) }
// M231 (Alex 11-27) REVERSED M220's 'never breaks': the starter now pops on the third hit like any Keepstone (keepstone-pop.test.ts
// holds the full set: bag, bank intact, re-place, old saves). Kept here: the third hit breaks it, and its pick-up is the bag item.
{ let h = null as ReturnType<typeof strike>['hits'], ns: number[] = [], broke = false
  for (let i = 0; i < MELEE_HITS; i++) { const r = strike(h, STARTER_ID, 1000 + i * 500); h = r.hits; ns.push(r.n); broke = r.broke }
  ok(broke && ns.join(',') === '1,2,3', `punch (M231): the starter breaks on hit ${MELEE_HITS} (${ns.join(',')})`) }
{ const r = strike({ id: 'k1', n: 2, at: 0 }, 'k1', 100); ok(r.broke, 'punch: a placed Keepstone still breaks on the third') }
{ const b = breakTarget(freshWorks(), { kind: 'chest', id: STARTER_ID }, newInv(), {})
  ok(!!b && b !== 'spirit' && countOf(b.inv, 'keepstone') === 1 && b.works.starterOut === true, 'punch (M231): the break puts the starter in the bag') }

// ── move: a good spot moves it; the cap / count do not change; bad spots refuse ──
const fresh = freshWorks()
ok(starterChest(fresh).x === STARTER_CHEST.x && starterChest(fresh).z === STARTER_CHEST.z, 'old save: no position = its first spot by the planning table')
const to = { x: -100, z: 110 }
ok(canMoveStarter(fresh, owned, to.x, to.z, 0).ok, 'move: a clear owned spot was refused')
const moved = moveStarter(fresh, owned, to.x, to.z, 1)!
ok(!!moved && moved.starter?.x === to.x && moved.starter?.z === to.z && moved.starter?.q === 1, `move: the spot did not stick (${JSON.stringify(moved?.starter)})`)
ok(starterChest(moved).x === to.x && allChests(moved)[0].id === STARTER_ID && allChests(moved)[0].x === to.x, 'move: allChests does not stand it at the new spot')
ok(chestsStanding(moved) === 1 && bankCap(chestsStanding(moved)) === bankCap(chestsStanding(fresh)), 'move: the bank cap changed')
ok(moved.chests.length === 0 && fresh.starter === undefined, 'move: mutated its input or added a chest')
ok(nearWork(moved, to.x, to.z - 1)?.kind === 'chest', 'move: the moved starter does not answer E where it stands')
ok(nearWork(moved, STARTER_CHEST.x, STARTER_CHEST.z - 1)?.kind !== 'chest', 'move: the old spot still answers E')
ok(moveStarter(fresh, owned, -60, 60, 0) === null, 'move: off held ground was allowed')
ok(moveStarter(fresh, owned, GATE.x + 3, GATE.z, 0) === null, 'move: into the gate was allowed')
ok(canMoveStarter(moved, owned, to.x + 0.5, to.z, 0).ok, 'move: a nudge from where it stands was refused (it crowded itself)')
{ const w2: Works = { ...fresh, chests: [{ id: 'k1', x: to.x, z: to.z, q: 0, placedAt: 1 }] }
  ok(moveStarter(w2, owned, to.x + 1, to.z, 0) === null, 'move: onto another Keepstone was allowed') }
// cancel = nothing written: the works stay as they were (the page only writes on Place)
ok(starterChest(fresh) === STARTER_CHEST, 'cancel: an unmoved works keeps the starter where it stood')
{ const [o, d] = look(to.x, to.z + 1.6, to.x, GROUND_Y + 0.6, to.z); ok(meleeTarget(moved, o, d)?.id === STARTER_ID, 'punch: the moved starter is hit where it stands') }

// ── save: the spot survives a reload; an old save / junk stays by the table ──
{ const mem: Record<string, string> = {}
  ;(globalThis as any).localStorage = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v }, removeItem: (k: string) => { delete mem[k] } }
  saveWorks(moved); const back = loadWorks()
  ok(back.starter?.x === to.x && back.starter?.z === to.z && back.starter?.q === 1, `save: the moved spot did not survive a reload (${JSON.stringify(back.starter)})`)
  saveWorks(fresh); ok(loadWorks().starter === undefined, 'save: an unmoved starter grew a position')
  ok(adoptStarter(undefined) === undefined && adoptStarter({ x: 'a', z: 1 }) === undefined && adoptStarter({ x: NaN, z: 1 }) === undefined && adoptStarter(7) === undefined, 'save: junk adopted as a spot')
  ok(adoptStarter({ x: 1, z: 2 })?.q === 0, 'save: a spot without a turn reads q 0') }

console.log(`starter-move: ${pass} pass, ${fails.length} fail`); for (const f of fails) console.log('  FAIL', f); if (fails.length) process.exit(1)
