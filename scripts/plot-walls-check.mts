// ── M37 slice 1: YOUR OWN WALLS ON THE PLOT (world d5a9e927, 11-19) ──────────────────────────────────────────────────
// Real inputs: E at the planning table, Plan, the Walls tool, a mouse DRAG across the ground (or one finger on --phone),
// Erase + the same drag, Walls again, Back to keeper, then W held into the wall.
// (slice 4, 11-20: a drawn wall is a DRAFT plan, free and not solid; the plan bar's list is paid by Build)
//   1. a drag lays a straight DRAFT run: N pieces, all draft, no plank spent; the list says N planks; Build spends exactly N
//   2. erase drags the BUILT run down: no walls, every plank back
//   3. drawn + built again, it survives a reload (saved with the plot)
//   4. the walker cannot cross the built wall: held W from 1.6 m off ends on the same side
//   5. 0 page errors
// SETUP (stated): bag = 40 goldwood planks, no works. Hooks: __ather.tp (stand by the table, stand by the wall),
// __build.to (move the VIEW over clear held ground). Every E / button / drag / key is real.
//   npx tsx scripts/plot-walls-check.mts [--url https://ather.games] [--out dir] [--phone [--w 360 --h 780]]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { TABLE, KEEP_CLEAR } from '../src/app/shimmer/open/ather/rooms'
import { STARTING_SQUARES, squareAt, sqId } from '../src/app/shimmer/open/ather/plot'
import { AMOUNTS } from '../src/app/shimmer/open/ather/plot-bom'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/plot-walls'), phone = process.argv.includes('--phone')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }

// a clear spot on starting ground: every point within 4 m is held, and a ~4.5 m run each way stays clear of the keep-clear rings
const held = new Set(STARTING_SQUARES)
const isHeld = (x: number, z: number) => { const s = squareAt(x, z); return !!s && held.has(sqId(s.i, s.j)) }
let spot: { x: number; z: number } | null = null
// the most open spot: the biggest margin R where everything within R m is held and R m clear of every ring
for (const R of [14, 12, 10, 8, 6]) {
  for (let z = -150; z <= 150 && !spot; z++) for (let x = -150; x <= 150 && !spot; x++) {   // the plot sits off-centre (start corner ~ -150..-90, 90..150)
    let good = KEEP_CLEAR.every(c => Math.hypot(c.x - x, c.z - z) > c.r + R)
    for (let a = 0; a < 16 && good; a++) for (const d of [0, R / 2, R]) { if (!isHeld(x + Math.cos(a * Math.PI / 8) * d, z + Math.sin(a * Math.PI / 8) * d)) good = false }
    if (good) spot = { x, z }
  }
  if (spot) { console.log(`clear margin ${R} m`); break }
}
if (!spot) { console.log('no clear held spot found'); process.exit(1) }
console.log(`spot ${spot.x},${spot.z} · table ${TABLE.x},${TABLE.z}`)

const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  const p = await (await br.createBrowserContext()).newPage()
  await p.setViewport(phone ? { width: Number(flag('--w', '390')), height: Number(flag('--h', '844')), isMobile: true, hasTouch: true } : { width: 1100, height: 680 })
  const errs: string[] = []
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument(() => {
    if (sessionStorage.getItem('walls')) return; sessionStorage.setItem('walls', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'repeater', n: 1 }; slots[8] = { id: 'goldwood_plank', n: 40 }
    localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
    localStorage.removeItem('open.works.v1')
  })
  const read = () => p.evaluate(() => ({
    planks: ((JSON.parse(localStorage.getItem('open.inv.v1') ?? '{}').slots ?? []) as ({ id: string; n: number } | null)[]).reduce((t, s) => t + (s?.id === 'goldwood_plank' ? s.n : 0), 0),
    walls: Object.keys(JSON.parse(localStorage.getItem('open.works.v1') ?? '{}').walls ?? {}),
    draft: Object.values(JSON.parse(localStorage.getItem('open.works.v1') ?? '{}').walls ?? {}).filter((x: any) => x.draft).length,
  }))
  const hideCard = () => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => d.textContent?.includes('Click to play')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' })
  const shot = async (n: string) => { await hideCard(); try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
  const at = (sel: string) => p.evaluate(s => { const e = document.querySelector<HTMLElement>(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, sel)
  const bomNeed = () => p.evaluate(() => { const e = document.querySelector('[data-plan-bom]'); if (!e) return null; const l = e.querySelector('[data-bom-line="goldwood_plank"]'); return { need: l ? +l.getAttribute('data-need')! : 0, ready: e.getAttribute('data-ready') === 'true' } })
  const tap = async (sel: string) => { const b = await at(sel); if (!b) return false; if (phone) await p.touchscreen.tap(b.x, b.y); else await p.mouse.click(b.x, b.y); return true }
  const poll = async (fn: () => Promise<boolean>, ms = 10000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(200) } return false }
  const W = phone ? Number(flag('--w', '390')) : 1100, Hh = phone ? Number(flag('--h', '844')) : 680
  // a straight drag across the middle of the view (the view looks at the spot)
  // the view EASES toward __build.to (1-2 fps here): a drag before it lands draws on another line, so wait for it to settle
  const settled = () => poll(async () => { const v = await p.evaluate(() => (window as any).__build.view()); await sleep(500); const w = await p.evaluate(() => (window as any).__build.view()); return Math.hypot(v.x - spot!.x, v.z - spot!.z) < 0.2 && Math.abs(Math.atan2(Math.sin(v.yaw), Math.cos(v.yaw))) < 0.01 && Math.abs(v.h - w.h) < 0.05 && Math.abs(v.x - w.x) < 0.02 }, 60000)
  const drag = async () => {
    await settled()
    // below the plan bar: its panels take the pointer, and since M55 (11-21 Foundation row) the bar reaches past mid-screen on
    // desk (bottom ~344 of 680), so a drag at Hh/2 landed on the bar and drew nothing (11-22 sweep pass 6). The hint passes taps through.
    const barBottom = await p.evaluate(() => { let b = 0; document.querySelectorAll('[data-build-bar] > *:not([data-build-hint]), [data-plan-bom]').forEach(e => { const r = e.getBoundingClientRect(); if (r.height > 0) b = Math.max(b, r.bottom) }); return b })
    const y = Math.round(Math.min(Hh - 200, Math.max(Hh * 0.5, barBottom + 30))), x0 = Math.round(W * 0.4), x1 = Math.round(W * 0.6)
    if (phone) {
      const c = await p.target().createCDPSession()
      await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y }] })
      for (let s = 1; s <= 10; s++) { await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * s / 10, y }] }); await sleep(60) }
      await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    } else { await p.mouse.move(x0, y); await p.mouse.down(); await p.mouse.move(x1, y, { steps: 12 }); await p.mouse.up() }
    await sleep(800)
  }
  const goPlan = async () => {
    await p.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z, Math.PI / 4), TABLE.x + 1.6, TABLE.z + 1.6); await sleep(1500)
    if (phone) { if (!await tap('[data-touch-action="KeyE"], [data-code="KeyE"]')) await p.keyboard.press('e') } else await p.keyboard.press('e')
    await sleep(1000); await tap('[data-act="plan"]')
    const flying = await poll(() => p.evaluate(() => (window as any).__build?.on() === true))
    await p.evaluate((x: number, z: number) => (window as any).__build.to(x, z, 0), spot!.x, spot!.z)   // yaw 0: a sideways drag on screen runs along world x (at 45° the axis is a coin flip); await sleep(2500)
    return flying
  }

  await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 180000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2500); await hideCard()
  if (!phone) { await p.mouse.click(550, 340); await sleep(600) }
  const s0 = await read()
  ok(s0.planks === 40 && s0.walls.length === 0, `start: 40 planks, no walls (${s0.planks}, ${s0.walls.length})`)
  ok(await goPlan(), 'E at the table, Plan: flying')
  // the CATALOG (Alex 11-19 playtest): next to Back to keeper; lit/locked cards; a card picks its tool
  ok(!await at('[data-act="catalog"]'), 'the old Catalog button beside Back to keeper is gone (M43)')
  ok(await tap('[data-act="wall-catalog"]') && await poll(() => p.evaluate(() => !!document.querySelector('[data-catalog]'))), 'the Catalog button (in the Walls tool row) opens the catalog')
  const cards = await p.evaluate(() => Object.fromEntries([...document.querySelectorAll<HTMLElement>('[data-cat]')].map(e => [e.dataset.cat, { lit: e.dataset.lit === 'true', text: e.textContent ?? '' }])))
  ok(cards['walls:goldwood']?.lit && /40 planks/.test(cards['walls:goldwood'].text) && cards['walls:dawnwood']?.lit && /Forestry 10/.test(cards['walls:dawnwood'].text), `   Goldwood walls lit (40 planks); Dawnwood is a plan too (needs no planks to draw) and says where its planks come from (${cards['walls:dawnwood']?.text})`)
  ok(await tap('[data-cat="walls:goldwood"]') && await poll(() => p.evaluate(() => (window as any).__build.tool() === 'walls' && !document.querySelector('[data-catalog]'))), '   a card picks its tool and closes the catalog')
  await tap('[data-tool="walls"]'); await sleep(300)   // back to look, so the next line proves the bar's own Walls button
  ok(await tap('[data-tool="walls"]'), 'the Walls tool is on the build bar'); await sleep(400)
  await shot('walls-1-tool')
  await drag(); await shot('walls-2-drawn')
  const s1 = await read()
  ok(s1.walls.length >= 3 && s1.draft === s1.walls.length && s1.planks === s0.planks, `1. a drag lays a DRAFT wall: ${s1.walls.length} pieces, ${s1.draft} draft, ${s0.planks - s1.planks} planks spent (none yet)`)
  // M50: a wall piece is 1.5 planks (plot-bom.ts AMOUNTS.wallPerM), a list line rounds UP
  const want = Math.ceil(s1.walls.length * AMOUNTS.wallPerM)
  const bn = await bomNeed(); ok(!!bn && bn.need === want && bn.ready, `   the plan bar's list says ${want} goldwood planks for ${s1.walls.length} pieces and is ready (${JSON.stringify(bn)})`)
  ok(await tap('[data-act="build-plan"] button') && await poll(async () => (await read()).draft === 0), '   Build stands the run')
  const s1b = await read(); ok(s1b.walls.length === s1.walls.length && s0.planks - s1b.planks === want, `   built: ${s1b.walls.length} pieces, exactly ${s0.planks - s1b.planks} planks spent (want ${want}, the list's number)`)
  const straight = s1.walls.every(k => k[0] === s1.walls[0][0]) && new Set(s1.walls.map(k => k[0] === 'h' ? k.split(',')[2] : k.split(',')[1])).size === 1
  ok(straight, `   it is one straight run (${s1.walls.slice(0, 4).join(' ')}…)`)
  ok(await tap('[data-tool="erase"]'), 'the Erase tool'); await sleep(400)
  console.log('  probe:', JSON.stringify(await p.evaluate(() => ({ tool: (window as any).__build.tool?.(), drawer: (window as any).__build.drawer?.(), view: (window as any).__build.view() }))))
  await drag(); await shot('walls-2b-erased')
  console.log('  probe after:', JSON.stringify(await p.evaluate(() => ({ tool: (window as any).__build.tool?.(), view: (window as any).__build.view() }))))
  const s2 = await read()
  ok(s2.walls.length === 0 && s2.planks === 40, `2. erase takes it down, every plank back (${s2.walls.length} walls, ${s2.planks} planks)`)
  await tap('[data-tool="walls"]'); await sleep(400); await drag()
  const s3a = await read(); ok(s3a.walls.length >= 3 && s3a.draft === s3a.walls.length, `   drawn again as a draft (${s3a.walls.length})`)
  ok(await tap('[data-act="build-plan"] button') && await poll(async () => (await read()).draft === 0), '   built again')
  const s3 = await read()
  await tap('[data-act="land"]'); await sleep(1200)
  await p.reload({ waitUntil: 'load', timeout: 180000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(3000); await hideCard()
  const s4 = await read()
  ok(s4.walls.join() === s3.walls.join(), `3. it survives a reload (${s4.walls.length} pieces)`)
  // 4. the walker: stand 1.6 m off the middle piece, facing it, hold W
  const mid = s4.walls[Math.floor(s4.walls.length / 2)].split(','), o = mid[0], i = +mid[1], j = +mid[2]
  const wx = o === 'h' ? i + 0.5 : i, wz = o === 'h' ? j : j + 0.5
  const from = o === 'h' ? { x: wx, z: wz - 1.6, yaw: Math.PI } : { x: wx - 1.6, z: wz, yaw: -Math.PI / 2 }   // yaw 0 looks -z
  await p.evaluate((a: { x: number; z: number; yaw: number }) => (window as any).__ather.tp(a.x, a.z, a.yaw), from); await sleep(1500)
  if (!phone) { await p.mouse.click(550, 340); await sleep(400) }
  await p.keyboard.down('KeyW'); await sleep(3000); await p.keyboard.up('KeyW'); await sleep(500)
  const end = await p.evaluate(() => { const a = (window as any).__ather.state(); return { x: a.px, z: a.pz } })
  const side = (q: { x: number; z: number }) => Math.sign(o === 'h' ? q.z - wz : q.x - wx)
  const movedToward = o === 'h' ? end.z - from.z : end.x - from.x
  ok(side(end) === side(from) && movedToward > 0.3, `4. the walker walked up to the wall and stayed on its side (moved ${movedToward.toFixed(2)} m, ended ${(o === 'h' ? end.z - wz : end.x - wx).toFixed(2)} m off)`)
  await shot('walls-3-walker')
  ok(errs.length === 0, `5. 0 page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
} finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
