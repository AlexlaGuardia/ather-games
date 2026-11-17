// Keeper roster (M12 step 2). Run: npx tsx src/lib/keeper-roster.test.ts
import { ROSTER_CAP, ROSTER_BASE, readRoster, ensureRoster, addKeeper, swapKeeper } from './keeper-roster'
import { KEEPER_KEYS, GARDEN_KEYS, keeperKeyFor } from './keeper-local'

const A = 'u_aaaaaaaaaaaaaaaaaa'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

function fakeStore(initial: Record<string, string>) {
  const data = new Map(Object.entries(initial))
  return {
    data,
    get length() { return data.size },
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v) },
    removeItem: (k: string) => { data.delete(k) },
    clear: () => data.clear(),
  }
}
const live = (b: string) => keeperKeyFor(b, A)
const snap = (st: ReturnType<typeof fakeStore>, bases: string[]) => JSON.stringify(bases.map(b => st.getItem(live(b))))

const PACK = 'open.inv.v1', RUNE = 'ather:shimmer:birthRune', SEEN = 'ather:shimmer:seen:glade'
const GARDEN = 'ather.garden.v1', MOG = 'open.companion.v1'
const keeperBases = [PACK, RUNE, SEEN], gardenBases = [GARDEN, MOG]

ok(!KEEPER_KEYS.includes(ROSTER_BASE) && !GARDEN_KEYS.includes(ROSTER_BASE), 'the roster record is neither keeper nor garden key')

const st = fakeStore({
  [live(PACK)]: '{"slots":["oak"]}', [live(RUNE)]: 'rune_ember', [live(SEEN)]: '4,4,AAAA',
  [live(GARDEN)]: '{"plot":1}', [live(MOG)]: '["mog"]',
  'ather:gfx:shimmer': 'device',
})
;(globalThis as { localStorage?: unknown }).localStorage = st

// anonymous: no roster
ok(readRoster(null) === null && ensureRoster(null) === null && addKeeper(null) === null && !swapKeeper('x', null), 'anonymous has no roster')
ok(st.data.size === 6, 'anonymous calls wrote nothing')

// first read creates k1 from live data, nothing moves
ok(readRoster(A) === null, 'readRoster does not create')
const before = new Map(st.data)
const r1 = ensureRoster(A)!
const k1 = r1.keepers[0].id
ok(r1.keepers.length === 1 && r1.active === k1 && /^k_[0-9a-f]{12}$/.test(k1), 'k1 created and active')
ok([...before].every(([k, v]) => st.data.get(k) === v), 'k1 creation moved/changed no existing key')
ok(st.data.size === before.size + 1, 'creation added only the roster record')
ok(ensureRoster(A)!.keepers[0].id === k1, 'ensure is idempotent')

// add k2, swap to k2
const gardenBefore = snap(st, gardenBases), packBefore = snap(st, keeperBases)
const k2 = addKeeper(A)!
ok(!!k2 && readRoster(A)!.active === k1 && snap(st, keeperBases) === packBefore, 'add k2: not active, nothing moved')
ok(swapKeeper(k2, A) && readRoster(A)!.active === k2, 'swap to k2')
ok(keeperBases.every(b => st.getItem(live(b)) === null), 'live keeper keys are k2\'s (empty)')
ok(snap(st, gardenBases) === gardenBefore, 'garden byte-identical after swap')
ok(st.getItem(`u:${A}:k:${k1}:${PACK}`) === '{"slots":["oak"]}' && st.getItem(`u:${A}:k:${k1}:${SEEN}`) === '4,4,AAAA', 'k1 pack parked intact (incl. family key)')
ok(st.getItem('ather:gfx:shimmer') === 'device', 'device key untouched')

// k2 plays
st.setItem(live(PACK), '{"slots":["pine"]}')
ok(swapKeeper(k1, A), 'swap back to k1')
ok(snap(st, keeperBases) === packBefore, 'k1 pack live again, byte-identical')
ok(snap(st, gardenBases) === gardenBefore, 'garden still byte-identical')
ok(st.getItem(`u:${A}:k:${k2}:${PACK}`) === '{"slots":["pine"]}', 'k2 parked with its own pack')
ok(swapKeeper(k2, A) && st.getItem(live(PACK)) === '{"slots":["pine"]}' && st.getItem(live(RUNE)) === null, 'k2 restored; k1\'s rune did not leak')

// interrupted swap is finished by ensureRoster
{
  const r = readRoster(A)!
  const other = r.keepers.find(k => k.id !== r.active)!.id
  // simulate: parked + journal written, live half-written
  const act = r.active
  for (const b of keeperBases) { const v = st.getItem(live(b)); if (v !== null) st.setItem(`u:${A}:k:${act}:${b}`, v) }
  st.setItem(`u:${A}:${ROSTER_BASE}`, JSON.stringify({ ...r, pending: other }))
  ok(readRoster(A)!.pending === other, 'journal visible')
  const fin = ensureRoster(A)!
  ok(fin.active === other && !fin.pending && snap(st, keeperBases) === packBefore, 'ensureRoster finishes an interrupted swap')
}

// unknown id, cap
ok(!swapKeeper('k_nope', A), 'unknown id refused')
let n = readRoster(A)!.keepers.length
while (addKeeper(A)) n++
ok(n === ROSTER_CAP && readRoster(A)!.keepers.length === ROSTER_CAP && addKeeper(A) === null, `cap enforced at ${ROSTER_CAP}`)

console.log(`\nkeeper-roster: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log(`  ✗ ${f}`)
process.exit(fails.length ? 1 : 0)
