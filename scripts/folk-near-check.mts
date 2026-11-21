// ── hub #15623 (Alex playtest 11-21): 'E · talk to the folk' only near a Moglin you face, not across the whole settlement ──
// At Moonwell Glade (the page lands there by Greg's waymark): (1) a spot inside the settlement but > 8 m from every Moglin,
// Greg and the waymark shows NO prompt; (2) 2 m from a Moglin, facing it, the prompt shows; (3) E opens the talk ON a Moglin;
// (4) back turned at the same 2 m: no prompt. 0 page errors.
//   npx tsx scripts/folk-near-check.mts [--url https://ather.games]
import puppeteer from 'puppeteer-core'
import { GLADE_ID, GLADE } from '../src/app/shimmer/open/ather/moonwell-glade'
import { GREG_WAYMARK } from '../src/app/shimmer/open/ather/waymarks'
import { SETTLEMENT_R } from '../src/app/shimmer/open/ather/network'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const res: string[] = [], errs: string[] = []
const ok = (c: boolean, m: string) => { res.push(`${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) errs.push(m) }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 1100, height: 680 })
const pageErrs: string[] = []
p.on('pageerror', e => pageErrs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune', 'star'))
await p.goto(`${url}/shimmer/open/ather?hour=13&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => (window as any).__ather?.zone?.() === 'wilds', { timeout: 240000 }); await sleep(6000)
await p.mouse.click(550, 340); await sleep(800)
const figs = async () => (await p.evaluate((id: string) => ((window as any).__folk?.drawn?.() ?? {})[id] ?? [], GLADE_ID)) as { id: string; x: number; z: number }[]
let F: { id: string; x: number; z: number }[] = []
for (let t = 0; t < 30000 && !(F = await figs()).length; t += 1000) await sleep(1000)
ok(F.length > 0, `Moonwell Glade: ${F.length} Moglins drawn`)
const prompt = () => p.evaluate(() => document.body.innerText.includes('talk to the folk'))
const tp = (x: number, z: number, yaw: number) => p.evaluate((a: number, b: number, c: number) => { const g = (window as any).__ather; g.tp(a, b, c); g.look(c, -0.1) }, x, z, yaw)
if (F.length) {
  // the settlement centre = the folk's own mean is not the network point; use Greg's waymark side of the Glade as the reference
  const cx = F.reduce((a, f) => a + f.x, 0) / F.length, cz = F.reduce((a, f) => a + f.z, 0) / F.length
  // (1) a point inside the settlement radius, far from every Moglin, Greg's waymark and the green (search a ring)
  let best: { x: number; z: number; d: number } | null = null
  for (let r = 14; r <= 30; r += 4) for (let a = 0; a < 2 * Math.PI; a += Math.PI / 16) {
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r
    const d = Math.min(...F.map(f => Math.hypot(f.x - x, f.z - z)), Math.hypot(GREG_WAYMARK.x - x, GREG_WAYMARK.z - z))
    const inside = await p.evaluate((a: number, b: number) => { const s = (window as any).__ather; return typeof s.ground === 'function' && Number.isFinite(s.ground(a, b)) }, x, z)
    if (inside && Math.hypot(x - GLADE.x, z - GLADE.z) < SETTLEMENT_R - 3 && (!best || d > best.d)) best = { x, z, d }   // inside settlementAt's radius
  }
  if (best && best.d > 8) {
    await tp(best.x, best.z, 0); await sleep(1500)
    ok(!(await prompt()), `no prompt inside the Glade ${best.d.toFixed(1)} m from the nearest Moglin (the old rule showed it here)`)
  } else ok(false, 'found no settlement spot > 8 m from every Moglin')
  // (2)-(4) at the Moglin farthest from Greg (so Greg's own E never wins), 2 m off it on the far side
  const m = F.slice().sort((a, b) => Math.hypot(b.x - GREG_WAYMARK.x, b.z - GREG_WAYMARK.z) - Math.hypot(a.x - GREG_WAYMARK.x, a.z - GREG_WAYMARK.z))[0]
  const L = Math.hypot(m.x - cx, m.z - cz) || 1, ux = (m.x - cx) / L, uz = (m.z - cz) / L   // outward from the folk's middle
  const sx = m.x + ux * 2, sz = m.z + uz * 2, face = Math.atan2(ux, uz)   // forward = (-sin, -cos) = back toward the Moglin
  await tp(sx, sz, face + Math.PI); await sleep(1500)
  ok(!(await prompt()), `2 m from ${m.id}, back turned: no prompt`)
  await tp(sx, sz, face); await sleep(1500)
  ok(await prompt(), `2 m from ${m.id}, facing it: 'E · talk to the folk' shows`)
  await p.keyboard.press('KeyE'); await sleep(2500)
  const talk = await p.evaluate(() => (window as any).__folkTalk ?? null) as { on: string | null } | null
  ok(!!talk?.on, `E opens the folk talk on a Moglin (on=${talk?.on})`)
}
ok(!pageErrs.length, `0 page errors (${pageErrs.join(' | ')})`)
console.log(res.join('\n'))
console.log(errs.length ? `FAIL: ${errs.join('; ')}` : 'PASS: folk prompt only near a faced Moglin, E still opens the talk')
await br.close(); process.exit(errs.length ? 1 : 0)
