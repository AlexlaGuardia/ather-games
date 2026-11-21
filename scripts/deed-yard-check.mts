// ── BETA M49 slice 1 (new shape): THE SHIPYARD'S YARD, played. (2026-11-21, world) ──────────────────────────────────────────
// A fresh keeper (born through the real BE BORN tap) at Kael's shipyard, Rune Hold (continent/deed-yard.tsx):
//   1 · the yard stands beside the shipyard (probe), clear of houses/lanes (pure test covers that)
//   2 · a stool in hand (hotbar 1, real Digit key), real E TAP sets it on the aimed cell; the bag drops by one
//   3 · a 2-cell piece in hand (Digit2), real E HOLD turns the ghost a quarter (nothing set), then a TAP sets it turned
//   4 · reload: both pieces still stand, same cells, same turn
//   5 · at the look board real E steps to the next colour + material combo; reload keeps it
//   6 · empty hand (an empty hotbar slot), facing the stool, real E picks it up; the bag gets it back
//   S2 · (slice 2) the yard's built deck: the walker WALKS IN through the gate (real W, from the ramp's foot) and stands on the
//        one floor; a placed SOLID piece (the bench) stops real W; a shot from the gate
//   PASS = all of that + 0 page errors. Hooks MOVE (__drive.footTp / look) and READ (__deedYard); the bag is SEEDED with the
//   two pieces (localStorage, before the continent loads) because making furniture is the Ather's bench, not this slice.
//   S3 · (slice 3) --yard front:shipyard:<town> runs every leg at that BOUGHT shipyard's yard instead of Kael's: the keeper's
//        ledger is SEEDED as holding it (the buy is s3b), the walker is set down beside it, and after the legs: Kael's yard store
//        was never written (saved per shipyard), and a shipyard NOT held (--shut, default veradyn) is fenced shut: its board
//        refuses (combo unchanged, nothing stored) and real W from outside its gate does not get in.
//   npx tsx scripts/deed-yard-check.mts [origin, default https://ather.games] [--out /tmp/deed-yard] [--yard <key>] [--shut <town>]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'
import { FURNITURE } from '../src/app/shimmer/open/ather/furniture'
import { cellsOf } from '../src/app/shimmer/open/business/deed-grid'
import { HOLD_MS } from '../src/app/shimmer/open/shared/stance'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = (process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : flag('--url', 'https://ather.games')).replace(/\/$/, '')
const out = flag('--out', '/tmp/deed-yard')
const YARD = flag('--yard', 'front:shipyard'), SHUT = flag('--shut', 'veradyn'), BOUGHT = YARD !== 'front:shipyard'
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const STOOL = 'goldwood_stool'
const WIDE = Object.keys(FURNITURE).find(id => cellsOf({ w: FURNITURE[id].w, d: FURNITURE[id].d }, 0, 0, 0).length === 2 && FURNITURE[id].w > 1 && FURNITURE[id].d <= 1 && !FURNITURE[id].alc)!
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await br.createBrowserContext()
const p = await ctx.newPage(); await p.setViewport({ width: 1000, height: 640 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
const res: Record<string, unknown> = { url, wide: WIDE, yardKey: YARD }
const t00 = Date.now(), say = (m: string) => console.log(`[${((Date.now() - t00) / 1000).toFixed(0)}s] ${m}`)
const text = () => p.evaluate(() => (document.body?.innerText ?? '').replace(/\s*\n\s*/g, ' | ').slice(0, 900)).catch(() => '?')
const poll = async (fn: () => Promise<boolean>, ms = 30000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(400) } return false }
const done = async (pass: boolean, line: string) => { res.pageErrors = errs; console.log(JSON.stringify(res, null, 1)); console.log(line); await br.close(); process.exit(pass ? 0 : 1) }
const fail = (step: string, why: string) => done(false, `FAIL at "${step}": ${why}`)
const tapText = async (re: RegExp) => {
  const box = await p.evaluate((src: string) => {
    const rx = new RegExp(src, 'i'); let best: DOMRect | null = null, area = Infinity
    for (const e of document.querySelectorAll<HTMLElement>('button, a, [role="button"], div, span')) {
      const t = (e.innerText ?? '').trim(); if (!t || !rx.test(t) || t.length > 60) continue
      const r = e.getBoundingClientRect(); if (r.width < 4 || r.height < 4) continue
      if (r.width * r.height < area) { area = r.width * r.height; best = r }
    }
    return best && { x: best.x + best.width / 2, y: best.y + best.height / 2 }
  }, re.source)
  if (!box) return false
  await p.mouse.click(box.x, box.y); return true
}
const Y = (f: string, key = YARD) => p.evaluate((fn: string, k: string) => (window as any).__deedYards?.[k]?.[fn]?.() ?? null, f, key) as Promise<any>
// a yard mounts only while the keeper is near it: set the walker down beside it and wait for its probe
const goToYard = async (key: string) => {
  const site = await p.evaluate((k: string) => ((window as any).__deedYards?.sites?.() ?? []).find((q: any) => q.key === k) ?? null, key)
  if (!site) await fail('travel', `no shipyard ${key} on this map: ${JSON.stringify(await p.evaluate(() => (window as any).__deedYards?.sites?.()))}`)
  await p.evaluate((x: number, z: number) => (window as any).__drive.footTp(x, z, 0, -0.3), site.x, site.z + 14)
  if (!await poll(async () => !!(await Y('yard', key)), 60000)) await fail('travel', `${key}'s yard did not mount beside it`)
  return site
}
const bagN = (id: string) => p.evaluate((want: string) => {
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i)!; if (k.endsWith('open.inv.v1')) return (JSON.parse(localStorage.getItem(k)!).slots as any[]).reduce((a, s) => a + (s?.id === want ? s.n : 0), 0) }
  return -1
}, id) as Promise<number>
const resume = async () => { if (/click to resume/i.test(String(await text()))) { await p.mouse.click(500, 320); await sleep(800) } }
const loadContinent = async () => {
  await p.goto(`${url}/shimmer/open/continent?hour=12`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__drive?.state && !!(window as any).__deedYards?.sites, { timeout: 240000 }); await sleep(2500)
  await p.keyboard.press('KeyW'); await sleep(500); await resume()
  await goToYard(YARD)
}
// stand at yard-local (lx, lz) facing the yard's +z (deep), then wait for the aim to land in the grid
const standAt = async (step: string, lx: number, lz: number, face: 'deep' | 'back' = 'deep') => {
  const y = await Y('yard'); const s = face === 'deep' ? 1 : -1
  const x = y.x + y.ax[0] * lx + y.az[0] * lz, z = y.z + y.ax[1] * lx + y.az[1] * lz
  const yaw = Math.atan2(-y.az[0] * s, -y.az[1] * s)   // forward = (-sin yaw, -cos yaw) on the continent
  await p.evaluate((a, b, w) => { (window as any).__drive.footTp(a, b, w, -0.35); (window as any).__drive.look(w, -0.35) }, x, z, yaw)
  const fl = await Y('floor')
  if (fl != null && !await poll(async () => Math.abs((await footAt()).y - fl) < 0.15, 8000)) await fail(step, `set down at ${lx},${lz} but not on the deck: feet ${(await footAt()).y.toFixed(2)}, floor ${fl.toFixed(2)}`)
  if (!await poll(async () => { const a = await Y('aim'); return !!a?.inYard && !!a?.cell })) await fail(step, `not aimed into the yard at ${lx},${lz}: ${JSON.stringify(await Y('aim'))}`)
}
const footAt = () => p.evaluate(() => { const f = (window as any).__drive.foot(); return { x: f.px, y: f.py, z: f.pz } }) as Promise<{ x: number; y: number; z: number }>
// hold real W until `goal` says arrived, or the walker STALLS (moved < 5 cm over 2.5 s), or maxMs. Timed holds lie under
// SwiftShader (a dev build walks ~0.3 m/s there), so a walk ends on what the walker did, never on the clock.
const holdW = async (goal: (f: { x: number; y: number; z: number }) => boolean, maxMs = 60000) => {
  await p.keyboard.down('KeyW')
  const t0 = Date.now(); let last = await footAt(), lastT = Date.now(), why = 'timeout'
  while (Date.now() - t0 < maxMs) {
    await sleep(300); const f = await footAt()
    if (goal(f)) { why = 'arrived'; break }
    if (Math.hypot(f.x - last.x, f.z - last.z) > 0.05) { last = f; lastT = Date.now() } else if (Date.now() - lastT > 2500) { why = 'stalled'; break }
  }
  await p.keyboard.up('KeyW'); await sleep(400); return why
}
const local = (y: any, x: number, z: number) => { const dx = x - y.x, dz = z - y.z; return { lx: dx * y.ax[0] + dz * y.ax[1], lz: dx * y.az[0] + dz * y.az[1] } }
const tapE = async () => { await p.keyboard.down('KeyE'); await sleep(80); await p.keyboard.up('KeyE'); await sleep(700) }

// 1 · born, seed the two pieces, to the continent
say('born')
await p.goto(`${url}/shimmer/open/ather`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 }); await sleep(4000)
if (!await tapText(/^BE BORN/)) await fail('born', 'BE BORN tap not found')
await sleep(6000)
const seeded = await p.evaluate((a: string, b: string) => {
  // the bag is written on its first change, so a fresh keeper may have none yet: then a new one under the anonymous key
  let k: string | null = null
  for (let i = 0; i < localStorage.length; i++) { const q = localStorage.key(i)!; if (q.endsWith('open.inv.v1')) k = q }
  const inv = k ? JSON.parse(localStorage.getItem(k)!) : { v: 1, slots: Array(32).fill(null), gifts: ['bait1'] }
  inv.slots[0] = { id: a, n: 3 }; inv.slots[1] = { id: b, n: 1 }; inv.slots[7] = null
  localStorage.setItem(k ?? 'open.inv.v1', JSON.stringify(inv)); return k ?? 'open.inv.v1 (new)'
}, STOOL, WIDE)
if (!seeded) await fail('seed', 'no keeper bag in localStorage after birth')
if (BOUGHT) res.ledgerSeed = await p.evaluate((key: string) => {
  // the keeper holds this shipyard (its ledger lists it, trade.ts › Ledger.shipyards); scale stamped so migrateLedger keeps Marks
  let k: string | null = null
  for (let i = 0; i < localStorage.length; i++) { const q = localStorage.key(i)!; if (q.endsWith('ather:trade:trial-ledger')) k = q }
  const l = k ? JSON.parse(localStorage.getItem(k)!) : { marks: 1500, scale: 2, deeds: 0, active: null, owned: { core: 0, trim: 0, rune: 0 } }
  l.shipyards = [key]; localStorage.setItem(k ?? 'ather:trade:trial-ledger', JSON.stringify(l)); return k ?? 'ather:trade:trial-ledger (new)'
}, YARD)
say('continent'); await loadContinent()
const yard = await Y('yard'); res.seeded = seeded; res.yard = yard && { side: yard.side, x: +yard.x.toFixed(1), z: +yard.z.toFixed(1), gate: yard.gate, clear: yard.clear }
if (!yard) await fail('yard', 'no shipyard yard on this map')
if (!await Y('own')) await fail('yard', `${YARD} is not the keeper's (ledger seed ${res.ledgerSeed})`)
if (!yard.clear) await fail('yard', `${YARD}'s yard is not clear of houses/lanes`)

// 2 · stool in hand, E tap sets it
say('place stool')
await standAt('stool', -3, -2.5)
await p.keyboard.press('Digit1'); await sleep(600)
await tapE()
let st = await Y('state')
res.afterStool = st?.items
if (st?.items?.length !== 1 || st.items[0].id !== STOOL) await fail('stool', `expected one stool set, got ${JSON.stringify(st?.items)}`)
if (await bagN(STOOL) !== 2) await fail('stool', `bag should hold 2 stools, holds ${await bagN(STOOL)}`)
await p.screenshot({ path: `${out}/1-stool.png` })

// 3 · the wide piece: HOLD E turns (nothing set), TAP sets it turned
say('turn + place wide')
await standAt('wide', 2, -2.5)
await p.keyboard.press('Digit2'); await sleep(600)
const rot0 = (await Y('aim')).rot
await p.keyboard.down('KeyE'); await sleep(HOLD_MS + 150); await p.keyboard.up('KeyE'); await sleep(600)
const rot1 = (await Y('aim')).rot
res.turn = { rot0, rot1 }
if ((await Y('state')).items.length !== 1) await fail('turn', 'a HOLD of E set a piece (it should only turn)')
if (rot1 !== (rot0 + 1) % 4) await fail('turn', `HOLD did not turn a quarter: ${rot0} -> ${rot1}`)
await tapE()
st = await Y('state'); res.afterWide = st.items
const w = st.items.find((q: any) => q.id === WIDE)
if (!w || w.rot !== rot1) await fail('wide', `wide piece not set turned (${rot1}): ${JSON.stringify(st.items)} | aim ${JSON.stringify(await Y('aim'))} | hud: ${String(await text()).slice(0, 300)}`)
await p.screenshot({ path: `${out}/2-wide.png` })

// S2a · the bench blocks: stand 2.5 m from it on its row, facing it, real W for 3 s; the walker must stop short of it
say('bench blocks')
{
  const yb = await Y('yard'), fl = await Y('floor'), bench = (await Y('state')).items.find((q: any) => q.id === WIDE)
  const bl = { lx: bench.cx + 0.5 - 6, lz: bench.cz + 1 - 4 }   // a turned 2-cell bench covers (cx, cz) and (cx, cz+1): its middle
  const sx = yb.x + yb.ax[0] * (bl.lx - 2.5) + yb.az[0] * bl.lz, sz = yb.z + yb.ax[1] * (bl.lx - 2.5) + yb.az[1] * bl.lz
  const yawB = Math.atan2(-yb.ax[0], -yb.ax[1])
  await p.evaluate((a, b, w) => { (window as any).__drive.footTp(a, b, w, -0.2); (window as any).__drive.look(w, -0.2) }, sx, sz, yawB); await sleep(1500)
  const f0 = await footAt()
  res.onFloor = { feet: +f0.y.toFixed(2), floor: +fl.toFixed(2) }
  if (Math.abs(f0.y - fl) > 0.15) await fail('floor', `set down in the yard, feet ${f0.y.toFixed(2)} are not on the floor ${fl.toFixed(2)}`)
  const startLx = local(yb, f0.x, f0.z).lx
  const why = await holdW(f => local(yb, f.x, f.z).lx > bl.lx + 1, 60000)   // 'arrived' = it walked THROUGH the bench
  const f1 = await footAt(), l1 = local(yb, f1.x, f1.z)
  res.bench = { benchLx: bl.lx, startLx: +startLx.toFixed(2), stoppedLx: +l1.lx.toFixed(2), why }
  if (why === 'arrived' || l1.lx > bl.lx - 0.3) await fail('bench', `walked into/through the bench: stopped at lx ${l1.lx.toFixed(2)}, bench middle ${bl.lx}`)
  // and it really walked up to it (a walker that never moved would also 'stop short'): within a body + half a bench of its face
  if (l1.lx < bl.lx - 1.2) await fail('bench', `stalled at lx ${l1.lx.toFixed(2)} before reaching the bench (middle ${bl.lx}): not proof it blocks`)
}
// S2b · in through the gate: from 1.5 m past the ramp's foot, facing the yard's middle, real W
say('gate walk-in')
{
  const yg = await Y('yard'), fl = await Y('floor'), rp = await Y('ramp')
  const ou = rp.mu + rp.out[0] * (rp.L + 1.5), ov = rp.mv + rp.out[1] * (rp.L + 1.5)
  const gx = yg.x + yg.ax[0] * ou + yg.az[0] * ov, gz = yg.z + yg.ax[1] * ou + yg.az[1] * ov
  const yawIn = Math.atan2(gx - yg.x, gz - yg.z)   // forward = (-sin, -cos): facing from the gate toward the middle
  await p.evaluate((a, b, w) => { (window as any).__drive.footTp(a, b, w, -0.15); (window as any).__drive.look(w, -0.15) }, gx, gz, yawIn); await sleep(1500)
  await p.screenshot({ path: `${out}/5-gate.png` })
  const why = await holdW(f => { const q = local(yg, f.x, f.z); return Math.abs(q.lx) < 4 && Math.abs(q.lz) < 3.5 }, 90000)
  const f = await footAt(), l = local(yg, f.x, f.z)
  res.gate = { why, lx: +l.lx.toFixed(2), lz: +l.lz.toFixed(2), feet: +f.y.toFixed(2), floor: +fl.toFixed(2), rampL: +rp.L.toFixed(2) }
  if (!(Math.abs(l.lx) < 6 && Math.abs(l.lz) < 4)) await fail('gate', `did not walk in through the gate: ended at ${l.lx.toFixed(2)}, ${l.lz.toFixed(2)}`)
  if (Math.abs(f.y - fl) > 0.15) await fail('gate', `walked in but feet ${f.y.toFixed(2)} are not on the floor ${fl.toFixed(2)}`)
}
// 4 · reload keeps both
say('reload 1'); const before = JSON.stringify(st.items)
await loadContinent()
if (JSON.stringify((await Y('state')).items) !== before) await fail('reload', `items changed on reload: ${before} -> ${JSON.stringify((await Y('state')).items)}`)
res.reloadKept = true

// 5 · the look board: E steps the combo; reload keeps it
say('look board')
const bd = await Y('board'), pal0 = (await Y('state')).palette
const yy = await Y('yard')
await p.evaluate((a, b, wy) => (window as any).__drive.footTp(a, b, wy, -0.1), bd.x + yy.az[0] * 0.9 - yy.ax[0] * 0.0, bd.z + yy.az[1] * 0.9, Math.atan2(yy.az[0], yy.az[1]))
if (!await poll(async () => !!(await Y('aim'))?.atBoard)) await fail('board', `not at the look board: ${JSON.stringify(await Y('aim'))}`)
await tapE()
const pal1 = (await Y('state')).palette
res.palette = { pal0, pal1 }
if (pal1 !== pal0 + 1) await fail('board', `E at the board did not step the combo: ${pal0} -> ${pal1}`)
await p.screenshot({ path: `${out}/3-look.png` })
await loadContinent()
if ((await Y('state')).palette !== pal1) await fail('board', 'the combo did not survive a reload')

// 6 · empty hand facing the stool: E picks it up
say('pick up')
await standAt('pick', -3, -2.5)
await p.keyboard.press('Digit8'); await sleep(600)
await tapE()
st = await Y('state'); res.afterPick = st.items
if (st.items.some((q: any) => q.id === STOOL)) await fail('pick', 'the stool is still in the yard')
if (await bagN(STOOL) !== 3) await fail('pick', `bag should hold 3 stools again, holds ${await bagN(STOOL)}`)

// the yard shot: from outside the far corner, looking in
const fy = await Y('yard')
await p.evaluate((a, b, wy) => (window as any).__drive.footTp(a, b, wy, -0.3), fy.x + fy.az[0] * 8 + fy.ax[0] * 7, fy.z + fy.az[1] * 8 + fy.ax[1] * 7, Math.atan2(fy.az[0] * 8 + fy.ax[0] * 7, fy.az[1] * 8 + fy.ax[1] * 7))
await sleep(2500); await p.screenshot({ path: `${out}/4-yard.png` })
// S3 · saved per shipyard + a shipyard NOT held stays shut
if (BOUGHT) {
  say('per-shipyard store + shut yard')
  const stores = await p.evaluate(() => { const o: Record<string, string> = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i)!; if (k.includes('open.deed.shipyard')) o[k] = localStorage.getItem(k)!.slice(0, 80) } return o })
  res.stores = stores
  if (Object.keys(stores).some(k => k.endsWith('open.deed.shipyard.v1'))) await fail('stores', `Kael's yard store was written by a run at ${YARD}: ${JSON.stringify(stores)}`)
  if (!Object.keys(stores).some(k => k.endsWith(`open.deed.shipyard:${YARD.split(':')[2]}`))) await fail('stores', `no store for ${YARD}: ${JSON.stringify(stores)}`)
  const sk = `front:shipyard:${SHUT}`
  await goToYard(sk)
  if (await Y('own', sk)) await fail('shut', `${sk} counts as held (only ${YARD} was seeded)`)
  const sb = await Y('board', sk), sy = await Y('yard', sk), sp0 = (await Y('state', sk)).palette
  await p.evaluate((a, b, wy) => (window as any).__drive.footTp(a, b, wy, -0.1), sb.x + sy.az[0] * 0.9, sb.z + sy.az[1] * 0.9, Math.atan2(sy.az[0], sy.az[1]))
  if (!await poll(async () => !!(await Y('aim', sk))?.atBoard)) await fail('shut', `not at ${sk}'s board: ${JSON.stringify(await Y('aim', sk))}`)
  await tapE()
  const shutPal = (await Y('state', sk)).palette, shutStored = await Y('stored', sk), hud = String(await text())
  res.shut = { key: sk, pal0: sp0, pal1: shutPal, stored: shutStored, said: /not yours/i.test(hud) }
  if (shutPal !== sp0 || shutStored) await fail('shut', `the board of a shipyard not held changed its combo (${sp0} -> ${shutPal}) or stored ${shutStored}`)
  if (!/not yours/i.test(hud)) await fail('shut', `E at a shut yard's board did not say it is not yours: ${hud.slice(0, 300)}`)
  // real W from 1.5 m past its ramp's foot toward the middle: the closed gate stops it outside the fence
  const rp = await Y('ramp', sk), ou = rp.mu + rp.out[0] * (rp.L + 1.5), ov = rp.mv + rp.out[1] * (rp.L + 1.5)
  const gx = sy.x + sy.ax[0] * ou + sy.az[0] * ov, gz = sy.z + sy.ax[1] * ou + sy.az[1] * ov
  await p.evaluate((a, b, w) => { (window as any).__drive.footTp(a, b, w, -0.15); (window as any).__drive.look(w, -0.15) }, gx, gz, Math.atan2(gx - sy.x, gz - sy.z)); await sleep(1500)
  const why = await holdW(f => { const q = local(sy, f.x, f.z); return Math.abs(q.lx) < 5 && Math.abs(q.lz) < 3 }, 60000)
  const f = await footAt(), l = local(sy, f.x, f.z)
  res.shutGate = { why, lx: +l.lx.toFixed(2), lz: +l.lz.toFixed(2) }
  if (Math.abs(l.lx) < 5.8 && Math.abs(l.lz) < 3.8) await fail('shut', `walked into a shut yard through its gate: ${l.lx.toFixed(2)}, ${l.lz.toFixed(2)}`)
  await p.screenshot({ path: `${out}/6-shut.png` })
}
if (errs.length) await fail('errors', `${errs.length} page errors`)
await done(true, BOUGHT ? `PASS deed-yard at ${YARD}: placed, turned, kept on reload, combo kept, picked up, own store (Kael's untouched), ${SHUT} shut + refused, 0 page errors` : 'PASS deed-yard: placed (tap), turned (hold), kept on reload, combo stepped + kept, picked up, 0 page errors')
