// plot-visit.ts: zone naming, the chunked snapshot round trip (incl. upper levels), reassembly rules, the guest's read-only store.
// Run: npx tsx src/app/shimmer/open/ather/plot-visit.test.ts
import { plotZone, hostOfZone, packSnap, unpackSnap, chunk, Reassembly, isSnapPart, validSnap, CHUNK, MAX_PARTS, startVisit, endVisit,
  setVisitSnap, currentVisit, isVisiting, guestRefuses, refusalCount, shownWorks, worksWritable, shownOwned, SendQueue, rideAsGuest, guestLifts, isHomeMsg, homeLine, HostWatch, HOST_GONE_MS, visitLog, type PlotSnap } from './plot-visit'
import type { Works } from './rooms'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  FAIL', m) } }

// a big two-storey house: ground walls + floors + stairs + decks + cols + found, two upper levels, pieces, chests, rooms
const walls: Record<string, string> = {}
for (let x = 0; x < 40; x++) for (let z = 0; z < 40; z++) if (x % 4 === 0 || z % 4 === 0) walls[`${x},${z},${x % 2 ? 'n' : 'w'}`] = (x * z) % 3 ? 'oak' : 'stone'
const level = (s: number) => ({ walls: Object.fromEntries(Object.entries(walls).filter((_, i) => i % s === 0)), floors: { '1,1': 'plank', '2,1': 'plank' }, stairs: { '3,3': 'n' }, decks: { '5,5': 1 } })
const works = {
  v: 1, walls, roof: 'gable', floors: { '0,0': 'plank' }, found: 0.6, foundCells: { '0,0': 0.6 }, cols: { '4,4': 'oak' }, stairs: { '2,2': 'e' }, decks: { '9,9': 1 },
  upper: [level(2), level(3)],
  rooms: [{ id: 'r1', kind: 'bench', x: 3, z: 4, rot: 0, built: 1 }],
  chests: [{ id: 'c1', x: 1, z: 1, items: [] }],
  pieces: Array.from({ length: 60 }, (_, i) => ({ id: 'p' + i, item: i % 2 ? 'lift' : 'alc-desk', x: i, z: i * 0.5, rot: i % 4, lv: i % 3 })),
} as unknown as Works
const snap: PlotSnap = { works, owned: ['0,0', '0,1', '1,0'] }

;(async () => {
  // ── zones ──
  ok(plotZone('p_ab12cd34') === 'open:plot:p_ab12cd34', 'plot zone name')
  ok(hostOfZone('open:plot:p_ab12cd34') === 'p_ab12cd34', 'host from zone')
  ok(hostOfZone('open:wilds') === null && hostOfZone(null) === null && hostOfZone('open:plot:') === null, 'not a plot zone -> null')
  ok(hostOfZone('open:plot:../x') === null, 'a junk id is refused')
  ok(plotZone('p_ab12cd34').length <= 48, 'fits the server MAX_ZONE (48)')

  // ── round trip incl. upper levels ──
  const packed = await packSnap(snap)
  const back = await unpackSnap(packed)
  ok(!!back && JSON.stringify(back) === JSON.stringify(snap), 'snapshot round-trips exactly')
  ok(!!back && back.works.upper!.length === 2 && Object.keys(back.works.upper![1].walls).length === Object.keys(level(3).walls).length, 'upper levels survive')
  ok(packed.length < JSON.stringify(snap).length, `deflate shrinks it (${packed.length} < ${JSON.stringify(snap).length})`)

  // ── chunks fit the relay ──
  const parts = chunk(packed, 7)
  ok(parts.length === Math.ceil(packed.length / CHUNK) && parts.length > 1, `chunked into ${parts.length} parts`)
  const env = (p: object) => JSON.stringify({ type: 'relay', kind: 'pv:snap', data: p, to: 'p_ab12cd34' }).length
  ok(parts.every(p => JSON.stringify(p).length < 2048 && env(p) < 2048), 'every part (and its relay envelope) < 2048 bytes')
  ok(parts.every(isSnapPart), 'every part is well-formed')

  // ── reassembly: shuffled + duplicated, old version ignored, new version restarts ──
  const r = new Reassembly()
  const shuffled = [...parts].reverse()
  let got: string | null = null
  for (const p of shuffled) { const g = r.add(p); if (g) got = g; r.add(p) }
  ok(got === packed, 'shuffled + duplicated parts assemble to the packed string')
  ok(r.add(parts[0]) === null, 'a finished version does not assemble twice')
  ok(r.add({ ...parts[0], v: 3 }) === null && r.progress().v === 7, 'an older version is ignored')
  const p2 = chunk(packed, 9)
  ok(r.add(p2[0]) === null && r.progress().v === 9 && r.progress().got === 1, 'a newer version restarts the gather')
  let got2: string | null = null
  for (const p of p2.slice(1)) got2 = r.add(p) ?? got2
  ok(got2 === packed, 'the newer version assembles')
  ok(!isSnapPart({ v: 1, i: 5, n: 5, d: '' }) && !isSnapPart({ v: 1, i: 0, n: MAX_PARTS + 1, d: '' }) && !isSnapPart({ v: 1, i: 0, n: 1, d: 'x'.repeat(CHUNK + 1) }), 'bad parts refused')

  // ── a bad payload never renders ──
  ok(await unpackSnap('not base64 deflate!!') === null, 'garbage unpacks to null')
  ok(!validSnap({ works: { rooms: [] }, owned: [] }) && !validSnap({ works: { rooms: [], chests: [], pieces: [] }, owned: [3] }), 'a partial works / bad owned is refused')
  ok(await unpackSnap(await packSnap({ works: { v: 1 }, owned: [] } as unknown as PlotSnap)) === null, 'a packed partial works unpacks to null')

  // ── the guest's read-only store ──
  const own = { v: 1, rooms: [{ id: 'mine' }], chests: [], pieces: [] } as unknown as Works
  ok(!isVisiting() && worksWritable() && shownWorks(own) === own && shownOwned(['a'])[0] === 'a', 'home: your own works, writable')
  ok(!guestRefuses() && refusalCount() === 0, 'home: nothing refused')
  startVisit('p_host0001', 'Mira')
  ok(isVisiting() && !worksWritable(), 'visiting: the works store is not writable')
  ok(shownWorks(own).rooms.length === 0 && shownOwned(['a']).length === 0, 'before the snapshot: an empty plot, never your own house')
  ok(setVisitSnap('p_host0001', 9, snap) && shownWorks(own) === works && shownOwned(['a']).length === 3, 'snapshot in: the host plot is shown')
  ok(!setVisitSnap('p_host0001', 8, { works: own, owned: [] }) && shownWorks(own) === works, 'an older snapshot is ignored')
  ok(!setVisitSnap('p_other', 99, { works: own, owned: [] }) && shownWorks(own) === works, "another host's snapshot is ignored")
  let said = ''
  ok(guestRefuses(m => { said = m }) && refusalCount() === 1 && said.includes('Mira'), 'visiting: a write is refused, with one line naming the host')
  ok(currentVisit()!.name === 'Mira', 'the visit names the host')
  endVisit()
  ok(!isVisiting() && worksWritable() && shownWorks(own) === own, 'home again: your own works, writable')

  // ── slice 2: the host's send queue ──
  const q = new SendQueue()
  const v1 = chunk('a'.repeat(CHUNK * 3), 1), v2 = chunk('b'.repeat(CHUNK * 2), 2)
  q.enqueue('g1', v1); q.enqueue('g2', v1)
  const first = [q.next()!, q.next()!]
  ok(first[0].to === 'g1' && first[1].to === 'g2', 'guests are served round-robin')
  q.enqueue('g1', v1)
  ok(q.size() === 4, 'the same version is not queued twice for a guest')
  q.enqueue('g1', v2)
  ok(q.size() === 4 && (() => { const seen: number[] = []; const qq = q; let n; while ((n = qq.next())) if (n.to === 'g1') seen.push(n.part.v); return seen.every(v => v === 2) && seen.length === 2 })(), "a newer version replaces the guest's older parts still queued")
  q.enqueue('g3', v1); q.drop('g3')
  ok(q.next() === null && q.size() === 0, 'a guest who left is dropped')
  // a live change, end to end: the guest holds v9, the host re-packs a changed plot as v10, the guest's store shows it
  startVisit('p_host0001', 'Mira'); setVisitSnap('p_host0001', 9, snap)
  const changed: PlotSnap = { works: { ...works, pieces: [...works.pieces, { id: 'new', item: 'goldwood_stool', x: 1, z: 1, q: 0 } as never] }, owned: snap.owned }
  const re2 = new Reassembly(); let pk: string | null = null
  for (const p of chunk(await packSnap(changed), 10)) pk = re2.add(p) ?? pk
  const un = pk ? await unpackSnap(pk) : null
  ok(!!un && setVisitSnap('p_host0001', 10, un) && shownWorks(own).pieces.length === works.pieces.length + 1, 'a change on the host reaches the guest as a newer version')
  endVisit()

  // ── slice 3: riding a mate's lift (a guest-only overlay), being sent home, the host gone ──
  {
    const lw = { ...works, pieces: [{ id: 'L1', item: 'lift', x: 2, z: 2, q: 0, placedAt: 0, lv: 0 }, { id: 'S1', item: 'goldwood_stool', x: 4, z: 4, q: 0, placedAt: 0 }] } as unknown as Works
    const ownSave = JSON.stringify(own)
    ok(!rideAsGuest(lw), 'riding while home does nothing (the host path saves through setWorks)')
    startVisit('p_host0002', 'Rin'); setVisitSnap('p_host0002', 1, { works: lw, owned: [] })
    const up = { ...lw, pieces: lw.pieces.map(p => p.id === 'L1' ? { ...p, lv: 1 } : p) }
    ok(rideAsGuest(up) && shownWorks(own).pieces.find(p => p.id === 'L1')!.lv === 1, 'a guest rides the lift: the car shows at the new level')
    ok(currentVisit()!.snap!.works.pieces.find(p => p.id === 'L1')!.lv === 0, 'the snapshot itself is untouched')
    ok(JSON.stringify(own) === ownSave && !worksWritable(), "the guest's own save is untouched and the store still refuses")
    ok(shownWorks(own) === shownWorks(own), 'a stable object per ride (no re-render loop)')
    const sneaky = { ...up, pieces: [...up.pieces.map(p => p.id === 'S1' ? { ...p, x: 9 } : p), { id: 'X', item: 'lift', x: 1, z: 1, q: 0, placedAt: 0, lv: 2 }] } as unknown as Works
    ok(!rideAsGuest(sneaky), 'nothing but a level on an existing lift is taken (a moved stool, a new lift: dropped)')
    ok(shownWorks(own).pieces.length === 2 && shownWorks(own).pieces.find(p => p.id === 'S1')!.x === 4, 'the moved stool and the new lift never show')
    ok(rideAsGuest(lw) && Object.keys(guestLifts()).length === 0 && shownWorks(own) === currentVisit()!.snap!.works, "riding back to the host's level clears the overlay")
    rideAsGuest(up)
    setVisitSnap('p_host0002', 2, { works: { ...lw, pieces: [...lw.pieces] }, owned: [] })
    ok(guestLifts().L1 === 1 && shownWorks(own).pieces.find(p => p.id === 'L1')!.lv === 1, "a host change elsewhere keeps the guest's ride")
    setVisitSnap('p_host0002', 3, { works: { ...lw, pieces: lw.pieces.map(p => p.id === 'L1' ? { ...p, lv: 2 } : p) }, owned: [] })
    ok(!('L1' in guestLifts()) && shownWorks(own).pieces.find(p => p.id === 'L1')!.lv === 2, 'the host moving that car wins')
    rideAsGuest(up); setVisitSnap('p_host0002', 4, { works: { ...lw, pieces: lw.pieces.filter(p => p.id !== 'L1') }, owned: [] })
    ok(Object.keys(guestLifts()).length === 0, 'a lift the host picked up drops out of the overlay')
    setVisitSnap('p_host0002', 5, { works: lw, owned: [] }); rideAsGuest(up); endVisit('sent-home')
    ok(Object.keys(guestLifts()).length === 0 && visitLog().at(-1) === 'end:sent-home', 'going home clears the ride')
    startVisit('p_host0002', 'Rin'); setVisitSnap('p_host0002', 1, { works: lw, owned: [] })
    ok(shownWorks(own).pieces.find(p => p.id === 'L1')!.lv === 0, 'a new visit starts from the host\'s levels')
    endVisit()
    ok(isHomeMsg({ why: 'sent' }) && isHomeMsg({ why: 'left' }) && !isHomeMsg({ why: 'x' }) && !isHomeMsg(null) && !isHomeMsg('sent'), 'home message shape')
    ok(homeLine('sent', 'Rin') === 'Rin sent you home.' && homeLine('host-left', 'Rin').includes('left their plot'), 'home lines')
    const hw = new HostWatch()
    ok(!hw.tick(true, 0) && !hw.tick(false, 1000) && !hw.tick(false, 1000 + HOST_GONE_MS - 1), 'a short absence is not gone')
    ok(hw.tick(false, 1000 + HOST_GONE_MS), 'absent HOST_GONE_MS in a row = gone')
    ok(!hw.tick(true, 5000) && !hw.tick(false, 5001) && !hw.tick(false, 5000 + HOST_GONE_MS), 'any sighting resets the clock')
  }

  console.log(`plot-visit: ${pass}/${pass + fail}`)
  if (fail) process.exit(1)
})()
