// BETA M165 s1: the Glade's gate and the Moonwell's rim IN THE GAME (asserts with --check; shots always). Day + night, 390x844 and desktop.
//   shots: the gate from Greg's side, close and far; the Moonwell from the bank, low along the rim and from the middle
//   asserts (--check): the gate is drawn once (not once an island), the stone rim is drawn and lies on the drawn ground; a keeper WALKS
//   from the bank over the rim into the water and out again (real keys), and their own cluster's gate is the gold ring as before
//   npx tsx scripts/m165-glade-look.mts <outdir> [--url https://ather.games] [--phone] [--check] [--hours 13,23]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const out = process.argv[2], url = flag('--url', 'https://ather.games'), phone = process.argv.includes('--phone'), check = process.argv.includes('--check'), tag = phone ? 'phone' : 'desktop'
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const GATE = { x: -212, z: 212 }, WELL = { x: -122.5, z: 110.5 }, SHORE_Z = 110.5 + 24.5
const VIEWS: [string, number, number, number][] = [
  ['gate', GATE.x + 8.5, GATE.z - 8.5, Math.PI * 0.75], ['gate-far', GATE.x + 20, GATE.z - 14, Math.atan2(20, -14)], ['gate-near', GATE.x + 4, GATE.z - 4, Math.PI * 0.75],
  ['well-bank', WELL.x, SHORE_Z + 7, 0], ['well-rim', WELL.x + 23.5, WELL.z + 13.5, Math.PI * 0.18], ['well-middle', WELL.x + 8, WELL.z, Math.PI * 0.5],
]
const b = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errs: string[] = []
try {
  for (const hour of flag('--hours', '13,23').split(',')) {
    const p = await (await b.createBrowserContext()).newPage(); p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
    if (phone) await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true }); else await p.setViewport({ width: 1100, height: 760 })
    await p.evaluateOnNewDocument('window.__name = (f) => f')
    await p.evaluateOnNewDocument(() => { localStorage.setItem('ather:shimmer:birthRune', 'star'); localStorage.setItem('open.tutorial.v1', JSON.stringify({ v: 1, live: true, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: [], gifts: ['grimoire'], b2: 'none', baitDay: null })) })
    await p.goto(`${url}/shimmer/open/ather?hour=${hour}`, { waitUntil: 'load', timeout: 240000 })
    await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 }); await sleep(2000)
    for (let i = 0; i < 30 && (await p.evaluate(() => (window as any).__ather.zone())) !== 'glade'; i++) { await p.evaluate(() => (window as any).__ather.travel({ kind: 'glade' })); await sleep(4000) }
    await p.waitForFunction(() => (window as any).__ather.zone() === 'glade' && !!(window as any).__glade?.folk, { timeout: 120000 }); await sleep(4000)
    const hide = () => p.evaluate(() => { const h = [...document.querySelectorAll('div')].filter(d => d.textContent?.includes('Click to play')); for (const d of h.filter(x => !h.some(o => o !== x && x.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' })
    const ms = () => p.evaluate(() => new Promise<number>(r => { let n = 0, t0 = 0; const f = (t: number) => { if (!t0) t0 = t; if (++n > 25) r((t - t0) / 25); else requestAnimationFrame(f) }; requestAnimationFrame(f) }))
    const calm = async () => { for (let t = 0, c = 0; t < 60 && c < 4; t++) { await sleep(500); c = await p.evaluate(() => document.querySelector<HTMLElement>('[data-veil]')?.style.opacity === '0') ? c + 1 : 0 } }
    for (const [n, x, z, yaw] of VIEWS) {
      await p.evaluate((x, z, y) => (window as any).__ather.gladeAt(x, z, y), x, z, yaw); await sleep(2500); await calm(); await hide()
      console.log(`${n} ${tag} hour ${hour}: ${await p.evaluate(() => (window as any).__ather.calls())} draw calls, ${(await ms()).toFixed(0)} ms a frame (swiftshader)`)
      await p.screenshot({ path: `${out}/${n}-${hour === '13' ? 'day' : 'night'}-${tag}.png` as `${string}.png` })
    }
    if (check && hour === '13') {
      const probe = await p.evaluate(() => ({ gates: (window as any).__gladeGate?.drawn?.() ?? null, rim: (window as any).__moonwell?.rim?.() ?? null })) as { gates: { grown: number; ring: number } | null; rim: { stones: number; worst: number } | null }
      ok(probe.gates?.grown === 1 && probe.gates?.ring === 0, `the grown gate is drawn once, no gold ring with it (${JSON.stringify(probe.gates)})`)
      ok(!!probe.rim && probe.rim.stones > 60 && probe.rim.worst < 0.03, `the rim's stones stand on the DRAWN ground (${JSON.stringify(probe.rim)})`)
      // wade: from the bank, forward over the rim into the water, then turned and out again
      const st = () => p.evaluate(() => (window as any).__ather.state()) as Promise<{ px: number; pz: number; py: number }>
      const inside = (s: { px: number; pz: number }) => Math.hypot((s.px - WELL.x) / 20.5, (s.pz - WELL.z) / 24.5) < 0.97
      for (const [side, x, z, yaw] of [['south', WELL.x, SHORE_Z + 2.2, 0], ['north', WELL.x + 6, WELL.z - 24.5 - 1.2, Math.PI], ['east', WELL.x + 22.6, WELL.z, Math.PI / 2], ['west', WELL.x - 22.6, WELL.z, -Math.PI / 2]] as [string, number, number, number][]) {
        for (const [what, sx, sz, sy, want] of [['in', x, z, yaw, true], ['out', WELL.x + (x - WELL.x) * 0.86, WELL.z + (z - WELL.z) * 0.86, yaw + Math.PI, false]] as [string, number, number, number, boolean][]) {
          await p.evaluate((x, z, y) => (window as any).__ather.gladeAt(x, z, y), sx, sz, sy); await sleep(1500); await calm()
          const a = await st(); let s = a
          await p.keyboard.down('KeyW'); for (let t = 0; t < 40 && inside(s) !== want; t++) { await sleep(500); s = await st() } await p.keyboard.up('KeyW')
          ok(inside(a) !== want && inside(s) === want, `wade ${what}, ${side}: ${a.px.toFixed(1)},${a.pz.toFixed(1)} -> ${s.px.toFixed(1)},${s.pz.toFixed(1)}`)
        }
      }
      await p.evaluate(() => (window as any).__ather.travel({ kind: 'plot' })); await p.waitForFunction(() => (window as any).__ather.zone() === 'plot', { timeout: 120000 }); await sleep(6000)
      const own = await p.evaluate(() => (window as any).__gladeGate?.drawn?.() ?? null) as { grown: number; ring: number } | null
      ok(own === null, `at home the grown gate is not mounted (${JSON.stringify(own)})`)
      await p.screenshot({ path: `${out}/own-cluster-${tag}.png` as `${string}.png` })
    }
    await p.close()
  }
} catch (e) { ok(false, `crashed: ${String(e).slice(0, 300)}`) }
ok(errs.length === 0, `0 page errors ${errs.slice(0, 3).join(' | ')}`)
await b.close(); console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
