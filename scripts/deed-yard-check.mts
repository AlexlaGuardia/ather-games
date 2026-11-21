// ── BETA M49 slice 1 (new shape): THE SHIPYARD'S YARD, played. (2026-11-21, world) ──────────────────────────────────────────
// A fresh keeper (born through the real BE BORN tap) at Kael's shipyard, Rune Hold (continent/deed-yard.tsx):
//   1 · the yard stands beside the shipyard (probe), clear of houses/lanes (pure test covers that)
//   2 · a stool in hand (hotbar 1, real Digit key), real E TAP sets it on the aimed cell; the bag drops by one
//   3 · a 2-cell piece in hand (Digit2), real E HOLD turns the ghost a quarter (nothing set), then a TAP sets it turned
//   4 · reload: both pieces still stand, same cells, same turn
//   5 · at the look board real E steps to the next colour + material combo; reload keeps it
//   6 · empty hand (an empty hotbar slot), facing the stool, real E picks it up; the bag gets it back
//   PASS = all of that + 0 page errors. Hooks MOVE (__drive.footTp / look) and READ (__deedYard); the bag is SEEDED with the
//   two pieces (localStorage, before the continent loads) because making furniture is the Ather's bench, not this slice.
//   npx tsx scripts/deed-yard-check.mts [origin, default https://ather.games] [--out /tmp/deed-yard]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'
import { FURNITURE } from '../src/app/shimmer/open/ather/furniture'
import { cellsOf } from '../src/app/shimmer/open/business/deed-grid'
import { HOLD_MS } from '../src/app/shimmer/open/shared/stance'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = (process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : flag('--url', 'https://ather.games')).replace(/\/$/, '')
const out = flag('--out', '/tmp/deed-yard')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const STOOL = 'goldwood_stool'
const WIDE = Object.keys(FURNITURE).find(id => cellsOf({ w: FURNITURE[id].w, d: FURNITURE[id].d }, 0, 0, 0).length === 2 && FURNITURE[id].w > 1 && FURNITURE[id].d <= 1 && !FURNITURE[id].alc)!
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await br.createBrowserContext()
const p = await ctx.newPage(); await p.setViewport({ width: 1000, height: 640 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
const res: Record<string, unknown> = { url, wide: WIDE }
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
const Y = (f: string) => p.evaluate((fn: string) => (window as any).__deedYard?.[fn]?.() ?? null, f) as Promise<any>
const bagN = (id: string) => p.evaluate((want: string) => {
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i)!; if (k.endsWith('open.inv.v1')) return (JSON.parse(localStorage.getItem(k)!).slots as any[]).reduce((a, s) => a + (s?.id === want ? s.n : 0), 0) }
  return -1
}, id) as Promise<number>
const resume = async () => { if (/click to resume/i.test(String(await text()))) { await p.mouse.click(500, 320); await sleep(800) } }
const loadContinent = async () => {
  await p.goto(`${url}/shimmer/open/continent?hour=12`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__drive?.state && !!(window as any).__deedYard?.yard?.(), { timeout: 240000 }); await sleep(2500)
  await p.keyboard.press('KeyW'); await sleep(500); await resume()
}
// stand at yard-local (lx, lz) facing the yard's +z (deep), then wait for the aim to land in the grid
const standAt = async (step: string, lx: number, lz: number, face: 'deep' | 'back' = 'deep') => {
  const y = await Y('yard'); const s = face === 'deep' ? 1 : -1
  const x = y.x + y.ax[0] * lx + y.az[0] * lz, z = y.z + y.ax[1] * lx + y.az[1] * lz
  const yaw = Math.atan2(-y.az[0] * s, -y.az[1] * s)   // forward = (-sin yaw, -cos yaw) on the continent
  await p.evaluate((a, b, w) => { (window as any).__drive.footTp(a, b, w, -0.35); (window as any).__drive.look(w, -0.35) }, x, z, yaw)
  if (!await poll(async () => { const a = await Y('aim'); return !!a?.inYard && !!a?.cell })) await fail(step, `not aimed into the yard at ${lx},${lz}: ${JSON.stringify(await Y('aim'))}`)
}
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
say('continent'); await loadContinent()
const yard = await Y('yard'); res.seeded = seeded; res.yard = yard && { side: yard.side, x: +yard.x.toFixed(1), z: +yard.z.toFixed(1), gate: yard.gate, clear: yard.clear }
if (!yard) await fail('yard', 'no shipyard yard on this map')

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
if (!w || w.rot !== rot1) await fail('wide', `wide piece not set turned (${rot1}): ${JSON.stringify(st.items)}`)
await p.screenshot({ path: `${out}/2-wide.png` })

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
if (errs.length) await fail('errors', `${errs.length} page errors`)
await done(true, 'PASS deed-yard: placed (tap), turned (hold), kept on reload, combo stepped + kept, picked up, 0 page errors')
