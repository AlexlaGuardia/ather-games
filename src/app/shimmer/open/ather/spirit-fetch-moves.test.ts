// Run: npx tsx src/app/shimmer/open/ather/spirit-fetch-moves.test.ts
// M141 s3 SPECIES FETCH MOVES: one full fetch per species through spirit-fetch's slot + lift (walked by a plain follow walk at the
// slot's vMax, sampled every frame), and each style's PATH SIGNATURE: a hop has its arcs, a swoop a wait then one dive, a pluck keeps
// her hover height and dips only at the grab, a dash a burst out + a bounce off + the return, a dart a burst, an echo a straight
// flight, an amble a sway. Every round trip (claim to toss) averages no faster than the keeper's walk, and pays exactly once.
export {}
let pass = 0
const fails: string[] = []
const ok = (c: unknown, m: string) => { if (c) pass++; else fails.push(m) }
const store = new Map<string, string>()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = globalThis as unknown as Record<string, any>, bus = new EventTarget()
g.window = g; g.addEventListener = bus.addEventListener.bind(bus); g.removeEventListener = bus.removeEventListener.bind(bus); g.dispatchEvent = bus.dispatchEvent.bind(bus)
g.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, String(v)) }, removeItem: (k: string) => { store.delete(k) }, key: (i: number) => [...store.keys()][i] ?? null, get length() { return store.size } }
g.setInterval = (() => 0) as unknown

async function main() {
  const { setSaveOwner } = await import('@/lib/save-slot'); setSaveOwner('alex')
  const L = await import('./ground-loot'), S = await import('./spirit-fetch'), I = await import('../shared/inventory')
  type Spot = { x: number; y: number; z: number }
  type Sp = keyof typeof S.FETCH
  const T0 = Date.now() - 60_000, K: Spot = { x: 0, y: 0, z: 0 }, W = S.FETCH_WALK, DT = 0.05
  let inv = I.newInv(0), now = T0 + 5000
  const bag = (item: string, n: number) => { const r = I.give(inv, item, n); inv = r.inv; return r.left }
  interface Smp { t: number; phase: string | null; x: number; z: number; lift: number; v: number }
  /** one full fetch: claim -> toss landed. Samples every frame of the round trip. */
  const fetchOnce = (sp: Sp, drop: { x: number; z: number }, item = 'goldwood_log') => {
    S._resetFetch(); L._resetLoot(); inv = I.newInv(0); now = T0 + 5000
    const id = `s-${sp}`, F = S.FETCH[sp]; S.joinFetch(id, sp)
    let p: Spot = { x: 1.7, y: 0, z: 0 }
    const node = Array.from({ length: 2000 }, (_, i) => `${sp}${i}`).find(n => S.wantRoll(id, `tree:${n}:9:0`) < F.chance)!
    L.dropLoot('tree', node, 9, [{ id: item, n: 1 }], [{ x: drop.x, y: 0, z: drop.z }], T0)
    const out: Smp[] = []; let t = 0
    for (let i = 0; i < 1200; i++) {
      now += DT * 1000
      S.tickFetch({ now, dt: DT, keeper: K, loot: L.lootNow(now), at: q => (q === id ? p : null), hollow: false, fighting: () => false, can: true,
        fits: () => true, keeperTakes: d => L.inPull(d, K, now), pay: (lid, who) => { L.payLoot(lid, who, bag, now) } })
      const ph = S.fetchState().find(r => r.id === id)!.phase
      if (!ph && out.length && out[out.length - 1].phase) break
      const s = S.fetchSlot(id), o = p
      if (s) { const d = Math.hypot(s.x - p.x, s.z - p.z), st = Math.min(d, s.vMax * DT); if (d > 1e-6) p = { x: p.x + (s.x - p.x) / d * st, y: 0, z: p.z + (s.z - p.z) / d * st } }
      if (ph) { out.push({ t, phase: ph, x: p.x, z: p.z, lift: S.fetchLift(id), v: Math.hypot(p.x - o.x, p.z - o.z) / DT }); t += DT }
    }
    return { out, paid: I.countOf(inv, item), ground: L.lootNow(now).length }
  }
  const len = (a: Smp[]) => a.slice(1).reduce((s, q, i) => s + Math.hypot(q.x - a[i].x, q.z - a[i].z), 0)
  const dk = (q: Smp) => Math.hypot(q.x - K.x, q.z - K.z)
  const DROP = { x: -4, z: 3 }   // 5 m from the keeper
  const all: Record<string, ReturnType<typeof fetchOnce>> = {}
  for (const sp of Object.keys(S.FETCH) as Sp[]) {
    const r = S.FETCH[sp].r, drop = sp === 'bat' ? { x: -9.6, z: 7.2 } : r < 5.5 ? { x: -0.8 * (r - 0.5), z: 0.6 * (r - 0.5) } : DROP
    const res = all[sp] = fetchOnce(sp, drop, sp === 'firefly' ? 'sky_shard' : 'goldwood_log')
    const trip = res.out.filter(q => q.phase !== 'toss'), avg = len(trip) / (trip.length * DT)
    ok(res.paid === 1 && res.ground === 0, `${sp}: not paid exactly once (bag ${res.paid}, ground ${res.ground})`)
    ok(trip.length > 10 && avg <= W + 1e-6, `${sp}: round trip averages ${avg.toFixed(2)} m/s, faster than the walk ${W}`)
  }
  const go = (sp: string) => all[sp].out.filter(q => q.phase === 'go'), carry = (sp: string) => all[sp].out.filter(q => q.phase === 'carry')
  const peaks = (a: number[]) => a.filter((v, i) => i > 0 && i < a.length - 1 && v > a[i - 1] && v >= a[i + 1]).length

  // ── hop (Croakling): an arc per HOP.len, each ~HOP.h high, landing between hops and ON the drop
  { const l = go('frog').map(q => q.lift), n = Math.round((Math.hypot(DROP.x - 1.7, DROP.z) - S.FETCH_DIAL.pickM) / S.HOP.len)
    ok(peaks(l) >= n - 1 && Math.max(...l) > S.HOP.h * 0.9, `hop: ${peaks(l)} arcs (want ~${n}), top ${Math.max(...l).toFixed(2)}`)
    ok(l.filter((v, i) => i > 0 && i < l.length - 1 && v <= l[i - 1] && v < l[i + 1] && v < 0.1).length >= n - 2, 'hop: never lands between hops')
    ok(Math.abs(l[l.length - 1]) < 0.1 && Math.min(...l) >= 0, `hop: does not land on the drop (${l[l.length - 1].toFixed(2)})`)
    ok(peaks(carry('frog').map(q => q.lift)) >= 2, 'hop: walks back instead of hopping') }
  // ── swoop (Athowl): waits in place (rising) SWOOP.hold, then one dive down onto the drop
  { const a = go('owl'), held = a.filter(q => q.t < S.SWOOP.hold - DT), moved = Math.hypot(held[held.length - 1].x - a[0].x, held[held.length - 1].z - a[0].z)
    ok(held.length >= 15 && moved < 0.02, `swoop: no wait before the dive (moved ${moved.toFixed(2)} m in the hold)`)
    ok(held[held.length - 1].lift > S.SWOOP.h * 0.9 && held.every((q, i) => i === 0 || q.lift >= held[i - 1].lift - 1e-9), 'swoop: does not rise while she waits')
    const dive = a.filter(q => q.t >= S.SWOOP.hold)
    ok(dive.length > 3 && dive.every((q, i) => i === 0 || q.lift <= dive[i - 1].lift + 1e-9), 'swoop: the dive is not one descent')
    ok(dive[dive.length - 1].lift < 0.15 && peaks(a.map(q => q.lift)) <= 1, `swoop: not down on the drop / more than one swoop (${dive[dive.length - 1].lift.toFixed(2)})`)
    ok(Math.max(...dive.map(q => q.v)) > 1, 'swoop: never moves in the dive') }
  // ── pluck (Hovari): her hover height kept (lift 0) most of the way, a dip only at the grab, back up after
  { const a = go('hummingbird'), early = a.slice(0, Math.floor(a.length * 0.6)), c = carry('hummingbird')
    ok(early.length > 5 && early.every(q => Math.abs(q.lift) < 1e-6), 'pluck: does not keep her hover height on the way')
    ok(a[a.length - 1].lift < -S.PLUCK.dip * 0.8, `pluck: no dip at the grab (${a[a.length - 1].lift.toFixed(2)})`)
    ok(Math.max(...all.hummingbird.out.map(q => q.lift)) <= 1e-6, 'pluck: rises above her hover')
    ok(Math.abs(c[c.length - 1].lift) < 1e-3, 'pluck: does not rise back to her hover after the grab') }
  // ── dash (Vulnyx prank): a burst out (faster than the walk), a bounce AWAY from the keeper with it, then the return
  { const a = go('fox'), c = carry('fox'), vmax = Math.max(...a.map(q => q.v))
    ok(vmax > W * 1.3, `dash: no burst (${vmax.toFixed(2)} m/s)`)
    const away = c.slice(0, 12).some((q, i, arr) => i > 0 && dk(q) > dk(arr[i - 1]) + 0.02)
    ok(away && Math.max(...c.map(dk)) > dk(c[0]) + 0.5, 'dash: no bounce off before bringing it')
    ok(dk(c[c.length - 1]) <= S.FETCH_DIAL.tossM && Math.max(...c.map(q => q.lift)) > 0.05, 'dash: does not bring it back / no bounce in the bounce')
    ok(c.slice(-10).every(q => q.v <= W + 1e-6), 'dash: comes back faster than the walk') }
  // ── dart (Lepara): fast out (a burst), short
  { const vmax = Math.max(...go('rabbit').map(q => q.v)); ok(vmax > W * 1.2 && S.FETCH.rabbit.r <= 6, `dart: no burst (${vmax.toFixed(2)})`) }
  // ── echo (Noctyx): a straight flight to the far drop, a flat cruise up off the ground
  { const a = go('bat'), A = a[0], B = { x: -9.6, z: 7.2 }, Lb = Math.hypot(B.x - A.x, B.z - A.z)
    const dev = Math.max(...a.map(q => Math.abs(((q.x - A.x) * (B.z - A.z) - (q.z - A.z) * (B.x - A.x)) / Lb)))
    ok(dev < 0.05, `echo: not a straight flight (${dev.toFixed(3)} m off the line)`)
    ok(a.filter(q => Math.abs(q.lift - S.ECHO.h) < 1e-6).length > a.length * 0.3, 'echo: no flat cruise') }
  // ── amble (Manalotl): sways either side of the line, slow
  { const a = go('axolotl'), A = a[0], B = DROP, Lb = Math.hypot(B.x - A.x, B.z - A.z)
    const side = a.map(q => ((q.x - A.x) * (B.z - A.z) - (q.z - A.z) * (B.x - A.x)) / Lb)
    ok(Math.max(...side) > 0.1 && Math.min(...side) < -0.1, `amble: no sway (${Math.min(...side).toFixed(2)}..${Math.max(...side).toFixed(2)})`)
    ok(Math.max(...a.map(q => q.v)) <= W * S.FETCH.axolotl.v + 1e-6, 'amble: faster than her amble') }
  // ── the plain walkers: no lift, never above their share of the walk (Luminara, Dewbear, Shellmere)
  for (const sp of ['firefly', 'water-bear', 'turtle'] as const) {
    const a = all[sp].out; ok(a.every(q => q.lift === 0) && Math.max(...a.map(q => q.v)) <= W * S.FETCH[sp].v + 1e-6, `${sp}: lifted, or faster than her pace`) }
  // ── the cap's two halves. (1) carrying back, her pace is already the most that lands the trip at the walk: an obedient walk
  // reaches the toss paid up, so she does not stand about in debt (the dash and the dart burst out the most)
  for (const sp of ['fox', 'rabbit'] as const) { const c = carry(sp), idle = c.slice(-40).filter(q => q.v < 0.01 && dk(q) <= S.FETCH_DIAL.tossM).length
    ok(idle <= 4, `${sp}: arrived in debt and stood ${idle} frames before the toss (the carry pace ignores the round trip)`) }
  // (2) whatever her walk did (a trot that overshot: twice the walk, both ways), she does not toss until the trip averages the walk
  { S._resetFetch(); L._resetLoot(); inv = I.newInv(0); now = T0 + 5000; S.joinFetch('x', 'rabbit'); let p: Spot = { x: 1.7, y: 0, z: 0 }, path = 0, T = 0, tossed = false
    const node = Array.from({ length: 2000 }, (_, i) => `x${i}`).find(n => S.wantRoll('x', `tree:${n}:9:0`) < S.FETCH.rabbit.chance)!
    L.dropLoot('tree', node, 9, [{ id: 'goldwood_log', n: 1 }], [{ x: -4, y: 0, z: 3 }], T0)
    for (let i = 0; i < 800 && !tossed; i++) { now += 50
      S.tickFetch({ now, dt: DT, keeper: K, loot: L.lootNow(now), at: () => p, hollow: false, fighting: () => false, can: true, fits: () => true, keeperTakes: () => false, pay: (lid, who) => { L.payLoot(lid, who, bag, now) } })
      const ph = S.fetchState()[0].phase; if (ph === 'toss') { tossed = true; break }
      const s = S.fetchSlot('x'); if (ph && s) { const d = Math.hypot(s.x - p.x, s.z - p.z), st = Math.min(d, W * 2 * DT); if (d > 1e-6) { p = { x: p.x + (s.x - p.x) / d * st, y: 0, z: p.z + (s.z - p.z) / d * st }; path += st } }
      if (ph) T += DT }
    ok(tossed && path / T <= W + 1e-6, `an overshooting walk tossed at ${(path / T).toFixed(2)} m/s average (> the walk ${W})`) }
  // ── every style has its own shape (no two the same table row)
  ok(new Set(Object.values(S.FETCH).map(m => m.style)).size === 10, 'two species share a style')

  if (fails.length) { console.error(`spirit-fetch-moves: ${pass} pass, ${fails.length} FAIL`); for (const x of fails) console.error('  ✗ ' + x); process.exit(1) }
  console.log(`spirit-fetch-moves: ${pass}/0`); process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
