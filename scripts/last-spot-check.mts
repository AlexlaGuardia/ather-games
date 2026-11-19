// ── WHERE YOU WERE (Alex 11-19: a refresh in the Wilds keeps you in the same spot; world d5a9e927) ───────────────────────
//   1. out in the Wilds (?waymark=greg), stand somewhere, wait past one save (3 s), RELOAD with no params: back in the Wilds
//      within 1.5 m of where you stood, facing the same way
//   2. ?home=1 on the address: home (the plot), whatever is saved
//   3. fold home from the Wilds (the travel home), RELOAD: the plot (going home clears the spot); 0 page errors
// Hooks: __ather.tp (stand somewhere, stated), __ather.travel({kind:'home'}) (the fold home), __ather.state / zone (read).
//   npx tsx scripts/last-spot-check.mts [--url https://ather.games]
import puppeteer from 'puppeteer-core'
import { GLADE_GREEN } from '../src/app/shimmer/open/ather/moonwell'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 1000, height: 640 })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument(() => { localStorage.setItem('ather:shimmer:birthRune', 'star') })
  const poll = async (fn: () => Promise<boolean>, ms = 10000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(300) } return false }
  const zone = () => p.evaluate(() => (window as any).__ather?.zone?.() ?? null) as Promise<string | null>
  const st = () => p.evaluate(() => { const a = (window as any).__ather.state(); return { x: a.px as number, z: a.pz as number, yaw: (a.yaw ?? a.lookYaw ?? 0) as number } })
  const load = async (q: string) => { await p.goto(`${url}/shimmer/open/ather?hour=13${q}`, { waitUntil: 'load', timeout: 240000 }); await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 }) }

  await load('&waymark=greg')
  ok(await poll(async () => (await zone()) === 'wilds', 240000), 'out in the Wilds (by the waymark)')
  await sleep(3000)
  const want = { x: GLADE_GREEN.x + 6, z: GLADE_GREEN.z + 3, yaw: 1.1 }
  await p.evaluate((a: typeof want) => (window as any).__ather.tp(a.x, a.z, a.yaw), want)
  await poll(async () => { const s = await st(); return Math.hypot(s.x - want.x, s.z - want.z) < 0.5 }, 15000)
  await sleep(4500)   // past one 3 s save
  const saved = await p.evaluate(() => Object.keys(localStorage).filter(k => k.includes('open.lastspot')).map(k => localStorage.getItem(k)))
  ok(saved.length === 1 && saved[0]!.includes('"zone":"wilds"'), `the spot is saved while out (${saved[0]?.slice(0, 90)})`)
  await p.reload({ waitUntil: 'load', timeout: 240000 }); await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 })
  const back = await poll(async () => (await zone()) === 'wilds', 240000) && await poll(async () => { const s = await st(); return Math.hypot(s.x - want.x, s.z - want.z) < 1.5 }, 60000)
  const s1 = await st()
  ok(back, `1. a reload puts the keeper back where they stood (${s1.x.toFixed(1)}, ${s1.z.toFixed(1)} vs ${want.x}, ${want.z})`)
  await load('&home=1')
  await sleep(6000)
  ok((await zone()) === 'plot', `2. ?home=1 goes home (${await zone()})`)
  await load('')
  ok(await poll(async () => (await zone()) === 'wilds', 240000), '   ...and a plain load after it still resumes the Wilds (home=1 did not clear it)')
  await sleep(2500)
  await p.evaluate(() => (window as any).__ather.travel({ kind: 'home' }))
  ok(await poll(async () => (await zone()) === 'plot', 30000), '   the fold home lands on the plot')
  await sleep(1500)
  await p.reload({ waitUntil: 'load', timeout: 240000 }); await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 }); await sleep(8000)
  ok((await zone()) === 'plot', `3. after going home, a reload is home (${await zone()})`)
  ok(errs.length === 0, `0 page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
} finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
