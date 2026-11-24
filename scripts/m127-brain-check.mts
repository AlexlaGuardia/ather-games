// ── BETA M127 s1: THE FIGHT BRAIN OF FOLLOWING SPIRITS, IN THE WILDS, 390x844 ────────────────────────────────────────────
// SETUP (stated): fresh profiles, 3 bloomed spirits (pa, pb Vulnyx; pc Manalotl) in the party and FOLLOWING, seeded locally;
// every non-GET fetch + beacon is stubbed, so nothing is written to any real save. Hollows are spawned by __ather.spawn and the
// keeper's shots are rounds laid in the sim in front of the target (the same code path a gun's round takes); the keeper's
// health is kept up so the run lasts. Read: __spiritFight (read-only), __formation, __ather.state / combat.
//  OWNER  1 the three are drawn in the Wilds and in the formation. 2 a fight with 2-3 Hollows until a HIT and a 'nothing' were
//         seen (up to 8 fights): every sample <= 10 m of the keeper; HITs on the keeper's target; spirits' damage <= the dial's share of the
//         keeper's; a wind-up always faces the keeper, never a spirit. 3 no teleport on either hand-over. 4 the Hollows gone: no
//         fight, no fight slots, each back at her formation slot. 5 the party's kills still counted once (xp = kills seen).
//  PLAYER 6 not the owner: no brain, no spirit in the Wilds, a Hollow nobody shoots loses nothing.   7 0 page errors.
//   npx tsx scripts/m127-brain-check.mts [--url https://ather.games] [--out dir]        (OWNER_KEY from env or .env)
import puppeteer from 'puppeteer-core'
import { expNeed } from '../src/app/shimmer/open/ather/spirit-growth'
import { existsSync, readFileSync, mkdirSync } from 'fs'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games').replace(/\/$/, ''), out = flag('--out', '/tmp/m127-brain'); mkdirSync(out, { recursive: true })
const KEY = process.env.OWNER_KEY || (existsSync('.env') ? /^OWNER_KEY=(.+)$/m.exec(readFileSync('.env', 'utf8'))?.[1]?.trim() : undefined)
if (!KEY) { console.error('no OWNER_KEY'); process.exit(2) }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms)); let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++ }
const BEDS = ['pa', 'pb', 'pc'].map((id, k) => ({ id, item: 'spirit_planter', x: -146, z: 90 + k * 3, q: 0, placedAt: 1 })), at0 = Date.now() - 20 * 86400000
const POTS = { pa: { seed: 'mana_seed_fox', at: at0, v: 2, tends: [], bloomed: true }, pb: { seed: 'mana_seed_fox', at: at0 + 1, v: 2, tends: [], bloomed: true }, pc: { seed: 'mana_seed_axolotl', at: at0 + 2, v: 2, tends: [], bloomed: true } }
const TUT = { v: 1, live: false, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], b2: 'accepted', baitDay: null }
const br = await puppeteer.launch({ protocolTimeout: 600000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errs: string[] = []
async function open(owner: boolean) {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
  p.on('pageerror', e => errs.push(`${owner ? 'owner' : 'player'}: ${String(e).slice(0, 200)}`))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  if (owner) await p.goto(`${url}/owner?key=${encodeURIComponent(KEY!)}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
  await p.goto(`${url}/api/owner`, { waitUntil: 'load', timeout: 60000 })
  ok(await p.evaluate(() => fetch('/api/owner', { cache: 'no-store' }).then(r => r.json()).then(d => !!d.owner)) === owner, owner ? '0. the OWNER' : '0. NOT the owner')
  await p.evaluateOnNewDocument((s: { pieces: unknown; pots: unknown; tut: unknown }) => {
    const f = window.fetch.bind(window); window.fetch = (u, i) => ((i?.method ?? 'GET').toUpperCase() !== 'GET') ? Promise.resolve(new Response('{}', { status: 200 })) : f(u, i); navigator.sendBeacon = () => true
    if (sessionStorage.getItem('m127')) return; sessionStorage.setItem('m127', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots: Array(32).fill(null), gifts: ['bait1'] }))
    localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [], chests: [], pieces: s.pieces }))
    localStorage.setItem('open.tutorial.v1', JSON.stringify(s.tut))
    localStorage.setItem('ather.grimoire.v1', JSON.stringify({ v: 1, pages: [{ species: 'fox', stage: 'seen', at: 1 }], pots: s.pots, met: [] }))
    for (const k of ['ather.spiritFollow.v1', 'ather.spiritParty.v1']) localStorage.setItem(k, JSON.stringify(['pa', 'pb', 'pc']))
    localStorage.removeItem('ather.spiritStats.v1')
  }, { pieces: BEDS, pots: POTS, tut: TUT })
  await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state && !!(window as any).__ather?.travel, { timeout: 240000 }); await sleep(4000)
  await p.touchscreen.tap(195, 644); await sleep(500)
  await p.evaluate(() => (window as any).__ather.travel({ kind: 'waymark', w: { id: 'greg', tile: 'first-wilds', x: -300, y: 0, z: 300, biome: 2, made: 0 } }))
  await p.waitForFunction(() => (window as any).__ather.zone() === 'wilds' && !!(window as any).__ather.combat, { timeout: 120000 }); await sleep(4000)
  return p
}
try {
  const p = await open(true)
  const three = await p.waitForFunction(() => { const s = (window as any).__spiritFight?.(); return s && s.spirits.length === 3 }, { timeout: 60000 }).then(() => true).catch(() => false)
  ok(three, '1. owner: three spirits drawn in the Wilds'); if (!three) throw new Error('no brain / no spirits on this build')
  await sleep(4000)
  ok(await p.evaluate(() => ['pa', 'pb', 'pc'].every(i => (window as any).__formation?.members.some((m: any) => m.id === i))), '1. and in the formation')
  // the in-page driver: mode 'fight' = keep 3 Hollows up and shoot the first; 'quiet' = none. Samples every 60 ms.
  await p.evaluate(() => {
    const W = window as any, A = W.__ather, D = W.__m127 = { mode: 'quiet', maxD: 0, maxStep: 0, farAt: '', over: 0, off: 0, hits: 0, windups: 0, badWind: 0, kills: 0, samples: 0, fights: 0, log0: 0, worst: 0, nothing: 0, shots: 0, deadSeen: new Set<number>(), mine: new Set<number>() }
    const prev: Record<string, any> = {}, st: Record<number, string> = {}; let shotAt = 0, tgt = -1
    setInterval(() => {
      const C = A.combat(), F = W.__spiritFight(), eye = A.camAim(), k = { x: eye.cx, z: eye.cz }; D.samples++
      if (D.mode === 'quiet') { D.mine.clear(); C.hollows.length = 0; C.spits.length = 0; C.packs = {} }
      else {
        C.keeper.hp = D.low ? 35 : C.keeper.maxHp
        for (const id of D.mine) if (!C.hollows.some((h: any) => h.id === id)) { D.mine.delete(id); D.kills++ }
        C.hollows = C.hollows.filter((h: any) => D.mine.has(h.id))   // strays off: only the spawned three
        if (D.mine.size < 3) { const n = C.hollows.length; A.spawn(D.mine.size * 2 - 2, -9, 'shambler'); if (C.hollows.length > n) { const h = C.hollows[C.hollows.length - 1]; h.state = 'chase'; D.mine.add(h.id) } }
        let t = C.hollows.find((h: any) => h.id === tgt && h.hp > 0); if (!t) { t = C.hollows.filter((h: any) => D.mine.has(h.id)).sort((a: any, b: any) => Math.hypot(a.x - k.x, a.z - k.z) - Math.hypot(b.x - k.x, b.z - k.z))[0]; tgt = t ? t.id : -1 }
        if (t && performance.now() - shotAt > 900) { shotAt = performance.now(); D.shots++; const dx = t.x - k.x, dz = t.z - k.z, d = Math.hypot(dx, dz) || 1; C.rounds.push({ x: t.x - dx / d * 0.5, y: t.y + 0.9, z: t.z - dz / d * 0.5, vx: dx / d * 12, vy: 0, vz: dz / d * 12, life: 0.4, dmg: 5, crit: 5 }) }
      }
      const b = F.spirits
      for (const s of b) {
        const d = Math.hypot(s.x - k.x, s.z - k.z); if (F.on && d > D.maxD) { D.maxD = d; D.farAt = s.id }
        const q = prev[s.id]; if (q) D.maxStep = Math.max(D.maxStep, Math.hypot(s.x - q.x, s.z - q.z)); prev[s.id] = s
      }
      if (F.spiritDealt > F.dials.share * F.keeperDealt + 1e-6) D.over++
      if (F.keeperDealt > 0) D.worst = Math.max(D.worst, F.spiritDealt / F.keeperDealt)
      for (const h of C.hollows) { if (h.state === 'windup' && st[h.id] !== 'windup') { D.windups++; const dx = k.x - h.x, dz = k.z - h.z, d = Math.hypot(dx, dz) || 1; if ((h.lx * dx + h.lz * dz) / d < 0.7) D.badWind++ } st[h.id] = h.state }
      const L = F.log; D.hits = F.seen.hit; D.off = L.filter((e: any) => e.kind === 'hit' && e.keeper !== null && e.target !== e.keeper).length; D.nothing = F.seen.nothing; D.fights = F.seen.fights
    }, 60)
  })
  const D = () => p.evaluate(() => { const d = { ...(window as any).__m127 }; delete d.deadSeen; delete d.mine; return d }) as Promise<any>
  const F = () => p.evaluate(() => JSON.parse(JSON.stringify((window as any).__spiritFight()))) as Promise<any>
  for (let n = 0; n < 8; n++) {
    await p.evaluate(() => { (window as any).__m127.mode = 'fight' })
    for (let i = 0; i < 25; i++) {
      await sleep(1000); if (i === 8) try { await p.screenshot({ path: `${out}/fight-${n}.png` }) } catch { /* slow */ }
      // the keeper walks: 1.5 s on foot now and then, and turns
      if (i % 5 === 2) { await p.keyboard.down('w'); await sleep(1500); await p.keyboard.up('w') }
      const d = await D(); if (d.hits > 0 && d.nothing > 2 && i > 12) break
    }
    const d = await D(); console.log(`  fight ${n + 1}: ${JSON.stringify(d)}`)
    if (d.hits > 0 && d.nothing > 0 && n >= 1) break
    await p.evaluate(() => { (window as any).__m127.mode = 'quiet' }); await p.waitForFunction(() => !(window as any).__spiritFight().on, { timeout: 60000 }); await sleep(500)
  }
  const d = await D(), f = await F()
  console.log(`  brain ${JSON.stringify({ ...f, spirits: undefined, dials: undefined })}`)
  ok(d.maxD > 0 && d.maxD <= 10, `2. through the fights every spirit within 10 m of the keeper (furthest ${d.maxD.toFixed(2)} m, ${d.samples} samples)`)
  ok(d.hits > 0, `2. at least one HIT (${d.hits}; dealt ${f.seen.dealt})`); ok(d.off === 0 && f.seen.onTarget === d.hits, `2. every HIT on the Hollow the keeper is on (${d.off} off it)`)
  ok(d.nothing > 0, `2. 'nothing' was an answer (${d.nothing} times; helps ${f.seen.hit + f.seen.mend + f.seen.slow})`)
  ok(d.over === 0, `2. spirits' damage never past ${f.dials.share} of the keeper's (worst ${d.worst.toFixed(3)})`)
  ok(d.windups > 0 && d.badWind === 0, `2. every Hollow wind-up faced the keeper (${d.windups} seen, ${d.badWind} not)`)
  // 2c. the keeper low (held at 35): a MEND comes (up to 3 fights: each is her choice)
  for (let n = 0; n < 3; n++) { await p.evaluate(() => { const w = (window as any).__m127; w.mode = 'fight'; w.low = true })
    for (let i = 0; i < 25; i++) { await sleep(1000); if ((await F()).seen.mend > 0) break }
    if ((await F()).seen.mend > 0) break
    await p.evaluate(() => { (window as any).__m127.mode = 'quiet' }); await p.waitForFunction(() => !(window as any).__spiritFight().on, { timeout: 60000 }) }
  { const g = await F(); ok(g.seen.mend > 0, `2c. the keeper low: mended ${g.seen.mend} (slowed the crowd ${g.seen.slow})`) }
  await p.evaluate(() => { (window as any).__m127.low = false })
  // 2d. the Hollow on the keeper held 10 m off and the keeper walking round (small tp steps, ~2.5 m/s): she leaves the formation
  //     for a fight spot, HITs, and nobody passes 10 m (up to 4 fights: each is her choice)
  let off = { slots: 0, out: 0, max: 0, hits: 0 }
  for (let n = 0; n < 4 && !(off.slots > 0 && off.hits > 0); n++) {
    await p.evaluate(() => { const w = (window as any).__m127; w.mode = 'quiet'; w.low = false }); await p.waitForFunction(() => !(window as any).__spiritFight().on, { timeout: 60000 })
    off = await p.evaluate(async o => { const w = window as any, A = w.__ather; w.__m127.mode = 'fight'; const e = A.camAim(), h0 = w.__spiritFight().seen.hit
      for (let i = 0; i < 450; i++) { await new Promise(r => setTimeout(r, 60)); const a = i * 0.05, kx = e.cx + Math.sin(a) * 3, kz = e.cz + (Math.cos(a) - 1) * 3; A.tp(kx, kz, 0)
        const C = A.combat(); for (const h of C.hollows) { h.x = kx; h.z = kz - 10; h.y = A.ground(kx, kz - 10); h.state = 'stagger'; h.t = 1 }
        const f = w.__spiritFight(), k = A.camAim(); if (!f.on) continue
        o.slots += Object.keys(f.slots).length; for (const s of f.spirits) { const d = Math.hypot(s.x - k.cx, s.z - k.cz); o.max = Math.max(o.max, d); if (d > 10) o.out++ } }
      o.hits = w.__spiritFight().seen.hit - h0; return o }, off)
  }
  ok(off.slots > 0 && off.hits > 0 && off.out === 0, `2d. a walking keeper, a Hollow 10 m off: they go to it and HIT (${off.slots} slot samples, ${off.hits} HITs in the last), furthest ${off.max.toFixed(1)} m, ${off.out} past 10`)
  const step1 = (await D()).maxStep
  // 2b. the tether: mid-fight the keeper is set down 14 m off: nobody acts until she is back
  const tb = await p.evaluate(async () => { const w = window as any, A = w.__ather; w.__m127.mode = 'fight'
    for (let i = 0; i < 100 && !w.__spiritFight().on; i++) await new Promise(r => setTimeout(r, 100))
    const e = A.camAim(), r0 = w.__spiritFight().seen.returns; A.tp(e.cx + 14, e.cz, 0); let bad = 0, back = -1, far = 0
    for (let i = 0; i < 200; i++) { await new Promise(r => setTimeout(r, 60)); const f = w.__spiritFight(), k = A.camAim()
      for (const s of f.spirits) { const d = Math.hypot(s.x - k.cx, s.z - k.cz); far = Math.max(far, d); if (d > 10.5 && f.slots[s.id]) bad++ }
      if (back < 0 && i > 5 && f.spirits.every((s: any) => Math.hypot(s.x - k.cx, s.z - k.cz) < 6)) back = i }
    return { returns: w.__spiritFight().seen.returns - r0, bad, back, far } })
  ok(tb.far > 10 && tb.returns >= 1 && tb.bad === 0 && tb.back > 0, `2b. past the tether they only come back (furthest ${tb.far.toFixed(1)} m, ${tb.returns} came back, ${tb.bad} fight spots out there, all within 6 m after ~${(tb.back * 0.06).toFixed(1)} s)`)
  await p.evaluate(() => { (window as any).__m127.maxStep = 0 })   // the set-down's own catch-up run is not a hand-over
  // 4. the fight over: formation
  await p.evaluate(() => { (window as any).__m127.mode = 'quiet' })
  const over = await p.waitForFunction(() => !(window as any).__spiritFight().on, { timeout: 60000 }).then(() => true).catch(() => false)
  ok(over, '4. the Hollows gone, the fight ends')
  let gap: number[] = []
  for (let i = 0; i < 30; i++) { await sleep(500); gap = await p.evaluate(() => { const w = window as any, fm = w.__formation; return w.__spiritFight().spirits.map((s: any) => Math.hypot(s.x - fm.slots[s.id].x, s.z - fm.slots[s.id].z)) }) as number[]; if (gap.length === 3 && gap.every(g => g < 0.8)) break }
  const e = await F(); ok(Object.keys(e.slots).length === 0 && gap.length === 3 && gap.every(g => g < 0.8), `4. each back at her formation slot (${gap.map(g => g.toFixed(2)).join(', ')} m off)`)
  const z = await D(); ok(Math.max(step1, z.maxStep) < 2.5, `3. no jump on a hand-over (largest move between two samples ${step1.toFixed(2)} m into / in the fights, ${z.maxStep.toFixed(2)} m back to formation)`)
  try { await p.screenshot({ path: `${out}/after.png` }) } catch { /* slow */ }
  // 5. one more kill, beside a seeded spirit HIT's path: exactly one xp per kill
  const xp = () => p.evaluate(() => { const s = JSON.parse(localStorage.getItem('ather.spiritStats.v1') ?? '{}'); return ['pa', 'pb', 'pc'].map(i => [s[i]?.xp ?? 0, s[i]?.grown ?? 0]) }) as Promise<number[][]>
  const a = await xp(), same = a.every(v => v[0] === a[0][0] && v[1] === a[0][1])
  const total = (v: number[]) => { let t = v[0]; for (let n = 0; n < v[1]; n++) t += expNeed(n); return t }, kills = (await D()).kills
  ok(kills > 0 && same && total(a[0]) === kills, `5. each kill paid each of the three once (${kills} kills, total ${total(a[0])}; xp, grown ${JSON.stringify(a)})`)
  await p.close()
  // 6. NOT the owner
  const q = await open(false); await sleep(3000)
  ok(await q.evaluate(() => !(window as any).__spiritFight), '6. not the owner: no brain')
  // (the __formation probe is not read here: with no follower to tick it, it keeps the plot's last frame)
  const m6 = await q.evaluate(() => (window as any).__spiritModel?.mounted ?? 0); ok(m6 === 0, `6. no spirit drawn in the Wilds (${m6} mounted)`)
  const hp = await q.evaluate(async () => { const A = (window as any).__ather, C = A.combat(); C.hollows.length = 0; A.spawn(0, -8, 'shambler'); const h = C.hollows[0], id = h.id, h0 = h.hp; let lost = 0
    for (let i = 0; i < 100; i++) { C.keeper.hp = C.keeper.maxHp; await new Promise(r => setTimeout(r, 100)); const g = C.hollows.find((x: any) => x.id === id); if (!g || g.hp < h0 || g.fx?.slowed) lost++ } return { h0, lost } })
  ok(hp.lost === 0, `6. 10 s with a Hollow nobody shoots: it loses nothing, is never slowed (${JSON.stringify(hp)})`)
  ok(errs.length === 0, `7. 0 page errors (${errs.slice(0, 3).join(' | ')})`)
} catch (e) { ok(false, `crashed: ${String(e).slice(0, 300)}`) }
await br.close(); console.log(fails ? `${fails} FAIL` : 'ALL PASS'); process.exit(fails ? 1 : 0)
