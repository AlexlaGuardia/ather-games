/**
 * THE FRONT DOOR — unborn keepers walk in through Rune Hold; born keepers return to where they stood.
 *
 * Run: `npx tsx src/app/shimmer/engine/front-door.test.ts`
 */
import { frontDoorFor, readSide, recordSide, SIDE_BASE, TOWN_ROUTE, ATHER_ROUTE } from './front-door'
import { KEEPER_KEYS, KEEPER_KEY_SPECS, keeperKey } from '@/lib/keeper-local'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l) }

const mkStore = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) }, keys: () => [...m.keys()] }
}

// ── the decision ────────────────────────────────────────────────────────────────────────────────
ok(frontDoorFor(false, null) === TOWN_ROUTE, 'unborn, no record → the town (Beat 0 lives in Rune Hold)')
ok(frontDoorFor(false, 'ather') === TOWN_ROUTE, '★ unborn beats any side record — birth comes before standing anywhere')
ok(frontDoorFor(true, 'town') === TOWN_ROUTE, 'born, last stood in town → the town')
ok(frontDoorFor(true, 'ather') === ATHER_ROUTE, 'born, last stood in the Ather → the Ather')
ok(frontDoorFor(true, null) === ATHER_ROUTE, '★ born with NO record → the Ather: every pre-existing keeper lives there')

// ── the record ──────────────────────────────────────────────────────────────────────────────────
{
  const s = mkStore()
  ok(readSide(s) === null, 'empty store reads null, not a default')
  recordSide(s, 'town')
  ok(readSide(s) === 'town', 'a recorded side reads back')
  recordSide(s, 'ather')
  ok(readSide(s) === 'ather', 'the newest record wins — where you stand, not where you first stood')
  ok(s.keys().length === 1 && s.keys()[0] === keeperKey(SIDE_BASE), 'one key, scoped through keeperKey')
  s.setItem(keeperKey(SIDE_BASE), 'crucible')
  ok(readSide(s) === null, 'a malformed record is a missing one — never a third dimension')
}
{
  const throwing = { getItem: () => { throw new Error('private mode') }, setItem: () => { throw new Error('private mode') } }
  ok(readSide(throwing) === null, 'a throwing store reads null')
  let threw = false
  try { recordSide(throwing, 'town') } catch { threw = true }
  ok(!threw, 'a throwing store does not stop the door opening')
}

// ── the registry ────────────────────────────────────────────────────────────────────────────────
ok(KEEPER_KEYS.includes(SIDE_BASE), `★ '${SIDE_BASE}' is registered — unregistered means shared across accounts`)
ok(KEEPER_KEY_SPECS.find(s => s.base === SIDE_BASE)?.worldTied === true, 'world-tied: a reborn keeper starts in the town again')

console.log(`front-door: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  FAIL', f)
if (fails.length) process.exit(1)
