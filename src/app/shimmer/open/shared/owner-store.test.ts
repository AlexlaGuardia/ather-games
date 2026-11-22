// owner-store.test.ts — the 11-22 playtest data loss (Forestry L6 -> L1 on Alex's live save), replayed in order.
// The page chunk evaluates forestry/prospecting/companion BEFORE SaveOwnerBoot names the account. Each store must then:
// not read the anonymous slot as if it were the account's, not write anything before the owner is known, load the
// account's value once it is, re-read on an owner change or a keeper swap, and never write one slot's value into another.
// Run: npx tsx src/app/shimmer/open/shared/owner-store.test.ts
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }

// ── a browser, minus the browser: a window that can fire events, and a localStorage ─────────────────────────────────
const store = new Map<string, string>()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = globalThis as unknown as Record<string, any>
const bus = new EventTarget()
g.window = g
g.addEventListener = bus.addEventListener.bind(bus)
g.removeEventListener = bus.removeEventListener.bind(bus)
g.dispatchEvent = bus.dispatchEvent.bind(bus)
g.localStorage = {
  getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, String(v)) },
  removeItem: (k: string) => { store.delete(k) }, key: (i: number) => [...store.keys()][i] ?? null, get length() { return store.size },
}
const realSetInterval = setInterval
g.setInterval = (() => 0) as unknown   // the 10 s regrow sweep would keep the process alive

const SK = 'open.skills.v1', MK = 'open.mined.v1', CK = 'open.companion.v1'
const A = (b: string) => `u:alex:${b}`, B = (b: string) => `u:bob:${b}`
const skillsAt = (forestry: number, xp: number) => JSON.stringify([
  { id: 'farming', level: 1, xp: 0 }, { id: 'forestry', level: forestry, xp }, { id: 'prospecting', level: 1, xp: 20 },
  { id: 'rinning', level: 1, xp: 0 }, { id: 'alchemy', level: 1, xp: 0 }, { id: 'mana', level: 1, xp: 0 },
])
const forestryIn = (k: string) => (JSON.parse(store.get(k) ?? '[]') as { id: string; level: number; xp: number }[]).find(s => s.id === 'forestry')
const FAR = Date.now() + 3_600_000
store.set(A(SK), skillsAt(6, 99))                                             // Alex's real save: L6
store.set(A(MK), JSON.stringify({ 'node-a': FAR }))                           // a node he mined, still regrowing
store.set(A(CK), JSON.stringify({ active: 'drifthorn', met: ['drifthorn'], sentHome: false }))

async function main() {
// ── 1. the page chunk evaluates: modules imported, owner NOT yet known ───────────────────────────────────────────────
const fo = await import('../ather/forestry')
const pr = await import('../ather/prospecting')
const co = await import('./companion')
const { setSaveOwner } = await import('@/lib/save-slot')
const { KEEPER_SWAP_EVENT } = await import('@/lib/keeper-roster')
const before = new Map(store)

// a grant in that window (nothing in the game should, it is behind OwnerReady, but a store must not trust that)
fo.addOpenXp('forestry', 5)
fo.pruneCommit('goldwood', 'tree-x')
pr.mineCommit('raw', 'node-b')
ok([...store].every(([k, v]) => before.get(k) === v) && store.size === before.size,
  'nothing is written before the owner is known (the anonymous view must never reach a slot)')

// ── 2. SaveOwnerBoot answers: the account's real values load ─────────────────────────────────────────────────────────
setSaveOwner('alex')
ok(fo.forestryLevel() === 6, `the account's Forestry loads once the owner is known (got L${fo.forestryLevel()}, want L6)`)
ok(pr.isMined('node-a'), "the account's mined node loads (still regrowing)")
ok(co.activeCompanion()?.id === 'drifthorn', "the account's companion loads")

// ── 3. THE 11-22 STEP: the first XP grant after the load keeps the level ─────────────────────────────────────────────
fo.addOpenXp('forestry', 5)
const f = forestryIn(A(SK))
ok(!!f && f.level >= 6 && f.xp !== 0, `★ first XP after a hard load keeps L6 (saved L${f?.level} xp${f?.xp}; the bug saved L1)`)
fo.pruneCommit('goldwood', 'tree-y')
ok((forestryIn(A(SK))?.level ?? 0) >= 6, 'a prune keeps L6 too')
pr.mineCommit('raw', 'node-c')
const mined = JSON.parse(store.get(A(MK)) ?? '{}') as Record<string, number>
ok('node-a' in mined && 'node-c' in mined, `a mine keeps the nodes already mined (saved ${Object.keys(mined).join(',')})`)
ok(!('node-b' in mined), 'the pre-owner mine did not leak into the account')
co.setCompanion(null)
const cs = JSON.parse(store.get(A(CK)) ?? '{}') as { met?: string[] }
ok(cs.met?.includes('drifthorn') === true, 'sending the companion home keeps who you have met')

// ── 4. a keeper swap: the live key now holds the OTHER keeper; the store must re-read, not write its copy back ────────
store.set(A(SK), skillsAt(2, 10))
g.dispatchEvent(new CustomEvent(KEEPER_SWAP_EVENT))
ok(fo.forestryLevel() === 2, `after a keeper swap the new keeper's level is read (got L${fo.forestryLevel()}, want L2)`)
fo.addOpenXp('forestry', 1)
ok(forestryIn(A(SK))?.level === 2, "the swapped-in keeper's save is not overwritten with the old keeper's L6")

// ── 5. a different account signs in: its own slot, the first account's untouched ──────────────────────────────────────
const alexNow = store.get(A(SK))
setSaveOwner('bob')
ok(fo.forestryLevel() === 1, 'a new account starts at L1 (empty slot)')
fo.addOpenXp('forestry', 3)
ok(store.get(A(SK)) === alexNow, "bob's XP never touches alex's slot")
ok(forestryIn(B(SK))?.xp === 3, "bob's XP lands in bob's slot")

// ── 6. the slot's own backstop: a key that moved under it (no event) refuses writes until it is read again ───────────
const { ownerSlot } = await import('./owner-store')
let k = 'slot-1', resets = 0
const s = ownerSlot(() => k, () => { resets++ })
ok(s.due() && !s.due(), 'due() once per slot, then not again')
ok(s.writable(), 'writable after reading that slot')
k = 'slot-2'
ok(!s.writable(), '★ a value read from slot-1 may not be written to slot-2')
ok(s.due() && s.writable(), 'slot-2 writable once it has been read')
g.dispatchEvent(new CustomEvent(KEEPER_SWAP_EVENT))
ok(resets === 1 && !s.writable() && s.due(), 'a swap resets the store and forces a re-read before any write')

g.setInterval = realSetInterval
console.log(`owner-store: ${pass} pass, ${fail} fail`)
process.exit(fail ? 1 : 0)
}
void main()
export {}
