// ── M43 STATION REWORK, PLAYED (2026-11-20, play / Jin hub) ───────────────────────────────────────────────────────
// A Carpentry already standing at (-100, 100) (seeded in the test guest's OWN fresh localStorage, doneAt in the past: the raise
// is plot-rooms-check's job). BAG: 12 goldwood logs; KEEPSTONE bank: 4 goldwood logs. Alex's real save is never touched.
//   1. E at the bench: the work panel + a SEPARATE store panel with the Pack / Keepstone toggle
//   2. pick Saw into planks, 10: the logs are lit with have / need (need 5); move 10 from the pack (+10) and the 4 from the Keepstone (All)
//   3. Queue 10: NOTHING leaves the store up front beyond the run in progress; wait (real time, panel open = the keeper works it,
//      no Moglin); 10 planks in the output, exactly 5 logs gone (14 stocked -> 9); collect: planks in the bag
//   4. the planning table: plan mode has NO [data-act=catalog] button beside Back to keeper (the Catalog toggle lives in the tool row)
//   5. phone 390x844: both panels reachable and tappable (move a log in on the phone)
//   0 page errors throughout.
//   npx tsx scripts/station-check.mts [--url https://ather.games] [--out dir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { benchOf, TABLE, type Room } from '../src/app/shimmer/open/ather/rooms'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/station')
mkdirSync(out, { recursive: true })
const ROOM: Room = { id: 'carpentry-check', kind: 'carpentry', x: -100, z: 100, q: 0, placedAt: 1, doneAt: 2 }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errs: string[] = []
async function session(w: number, h: number, touch = false) {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: w, height: h, hasTouch: touch, isMobile: touch })
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument((room: Room) => {
    if (sessionStorage.getItem('st')) return; sessionStorage.setItem('st', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'repeater', n: 1 }; slots[10] = { id: 'goldwood_log', n: 12 }
    localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
    localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [room], chests: [] }))
    localStorage.setItem('open.bank.v1', JSON.stringify({ v: 1, stacks: [{ id: 'goldwood_log', n: 4 }] }))
  }, ROOM)
  const read = (k: string) => p.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), k)
  const hideCard = () => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => d.textContent?.includes('Click to play')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' })
  const shot = async (n: string) => { await hideCard(); try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
  const click = async (sel: string) => { const b = await p.evaluate(s => { const e = document.querySelector<HTMLElement>(s); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, sel); if (!b) return false; await p.mouse.click(b.x, b.y); return true }
  const poll = async (fn: () => Promise<boolean>, ms = 10000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(250) } return false }
  const tally = (st: ({ id: string; n: number } | null)[] | undefined) => { const r: Record<string, number> = {}; for (const s of st ?? []) if (s) r[s.id] = (r[s.id] ?? 0) + s.n; return r }
  const bag = async () => tally((await read('open.inv.v1'))?.slots)
  const room = async () => (await read('open.works.v1'))?.rooms?.[0]
  const store = async () => tally((await room())?.store)
  const output = async () => tally((await room())?.out)
  const bankN = async () => tally((await read('open.bank.v1'))?.stacks)
  const open = async () => {
    await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 180000 })
    await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2500)
    const b = benchOf(ROOM)
    await p.evaluate((x, z) => (window as any).__ather.tp(x, z, 0), b.x, b.z - 1.2); await sleep(1500); await hideCard()
    await p.keyboard.press('e'); await sleep(900)
  }
  return { p, read, shot, click, poll, bag, room, store, output, bankN, open, hideCard }
}

// ── desktop ─────────────────────────────────────────────────────────────────────────────────────────────────────
{
  const s = await session(1280, 800); const { p } = s
  await s.open()
  const panels = await p.evaluate(() => { const a = document.querySelector('[data-panel="bench"]')?.getBoundingClientRect(), b = document.querySelector('[data-panel="station-store"]')?.getBoundingClientRect(); return a && b ? { aR: a.right, bL: b.left, aTop: a.top, bTop: b.top, bW: b.width } : null })
  ok(!!panels, '1. E at the bench: the station panel AND a separate store panel are up')
  ok(!!panels && panels.bL >= panels.aR - 1, `   desktop: side by side (work panel ends x=${panels?.aR.toFixed(0)}, store starts x=${panels?.bL.toFixed(0)})`)
  ok(await p.evaluate(() => !!document.querySelector('[data-src="pack"]') && !!document.querySelector('[data-src="bank"]')), '   the Pack / Keepstone toggle is there')
  await s.shot('st-1-open')
  ok(await s.click('[data-job-pick="goldwood-plank"]'), '2. pick "Saw into planks"')
  ok(await s.click('[data-qty="10"]'), '   quantity 10')
  const lit = await p.evaluate(() => { const e = document.querySelector('[data-src-item="goldwood_log"]'); return e ? { need: +e.getAttribute('data-need')!, have: +e.getAttribute('data-have')!, text: e.textContent } : null })
  ok(!!lit && lit.need === 5 && lit.have === 0, `   the logs are lit with have / need (${lit?.text})`)
  await s.shot('st-2-lit')
  ok(await s.click('[data-src-item="goldwood_log"] [data-move="10"]'), '   one tap: +10 logs from the pack')
  await sleep(500)
  ok((await s.store()).goldwood_log === 10 && (await s.bag()).goldwood_log === 2, `   store 10, pack 2 (${JSON.stringify(await s.store())} / ${JSON.stringify(await s.bag())})`)
  ok(await s.click('[data-src="bank"]'), '   switch the source to the Keepstone')
  await sleep(300)
  ok(await s.click('[data-src-item="goldwood_log"] [data-move="all"]'), '   All of the Keepstone logs')
  await sleep(500)
  ok((await s.store()).goldwood_log === 14 && !(await s.bankN()).goldwood_log, `   store 14, Keepstone empty (${JSON.stringify(await s.store())} / ${JSON.stringify(await s.bankN())})`)
  await s.shot('st-3-stocked')
  // 3. queue 10 planks
  ok(await s.click('[data-act="queue"] button'), '3. Queue 10 planks')
  await sleep(1500)
  const r1 = await s.room(), st1 = await s.store()
  ok(!!r1?.queue && st1.goldwood_log >= 13, `   inputs are taken one run at a time, not the batch (store ${st1.goldwood_log} of 14 a moment in)`)
  await s.shot('st-4-working')
  ok(await s.poll(async () => (await s.output()).goldwood_plank === 10, 90000), `   10 planks in the output (waited, panel open = keeper works it) (${JSON.stringify(await s.output())})`)
  const st2 = await s.store(); ok(st2.goldwood_log === 9, `   exactly 5 logs gone: 14 -> ${st2.goldwood_log}`)
  ok(!(await s.room())?.queue, '   queue finished and cleared')
  await s.shot('st-5-done')
  ok(await s.click('[data-act="collect-all"] button'), '   Collect all')
  await sleep(600)
  ok((await s.bag()).goldwood_plank === 10 && !(await s.output()).goldwood_plank, `   10 planks in the bag, output empty (${JSON.stringify(await s.bag())})`)
  // reload: the station survives
  await p.reload({ waitUntil: 'load', timeout: 180000 }); await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2000)
  ok((await s.store()).goldwood_log === 9, '   a reload keeps the station store')
  // 4. plan mode: no catalog button beside Back to keeper
  await p.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z, Math.PI / 4), TABLE.x + 1.6, TABLE.z + 1.6); await sleep(1500); await p.keyboard.press('e'); await sleep(1000)
  await s.click('[data-act="plan"]'); await s.poll(() => p.evaluate(() => (window as any).__build?.on() === true))
  await sleep(800)
  ok(await p.evaluate(() => !!document.querySelector('[data-act="land"]')), '4. plan mode is up (Back to keeper)')
  ok(await p.evaluate(() => !document.querySelector('[data-act="catalog"]')), '   the CATALOG button beside Back to keeper is gone')
  ok(await p.evaluate(() => !!document.querySelector('[data-act="wall-catalog"]')), '   the catalog is still reachable from the tool row')
  ok(await s.click('[data-act="wall-catalog"]') && await s.poll(() => p.evaluate(() => !!document.querySelector('[data-catalog]')), 4000), '   and it opens')
  await s.shot('st-6-plan')
}
// ── phone ───────────────────────────────────────────────────────────────────────────────────────────────────────
{
  const s = await session(390, 844, true); const { p } = s
  await s.open()
  const g = await p.evaluate(() => { const a = document.querySelector('[data-panel="bench"]')?.getBoundingClientRect(), b = document.querySelector('[data-panel="station-store"]')?.getBoundingClientRect(); return a && b ? { aL: a.left, aR: a.right, bL: b.left, bR: b.right, aB: a.bottom, bT: b.top } : null })
  ok(!!g && g.aL >= 0 && g.aR <= 390 && g.bL >= 0 && g.bR <= 390, `5. phone: both panels fit the 390 width (${JSON.stringify(g)})`)
  ok(!!g && g.bT >= g.aB - 1, '   stacked: the store panel sits under the station panel')
  ok(await s.click('[data-job-pick="goldwood-plank"]'), '   phone: pick a job')
  ok(await s.click('[data-src-item="goldwood_log"] [data-move="10"]'), '   phone: +10 logs into the store (scrolled to, tapped)')
  await sleep(500)
  ok((await s.store()).goldwood_log === 10, `   moved (${JSON.stringify(await s.store())})`)
  await s.shot('st-7-phone-store')
  ok(await s.click('[data-act="queue"] button'), '   phone: queue')
  await s.shot('st-8-phone-queue')
}
ok(errs.length === 0, `0 page errors (${errs.length}${errs.length ? ': ' + errs.join(' | ') : ''})`)
await br.close()
console.log(fails ? `FAIL (${fails})` : 'PASS: station panel + store panel (pack/Keepstone, have/need), 10 planks for exactly 5 logs, catalog button gone, phone ok')
process.exit(fails ? 1 : 0)
