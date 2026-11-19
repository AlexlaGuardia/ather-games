// BETA M27 slice 1 (Alex 11-18: "the main thing I'm worried about is playing with friends"): OTHERS APPEAR in the open world.
// Two keepers (two browser contexts = two players), same zone, no party: on the CONTINENT and in the WILDS, B moves and A
// draws B where B stands (eased; within 1 m), with a name plate; B leaves and A loses B. 0 page errors on either.
// --offline (devwin: no /shimmer-ws route there): the socket never comes up, and the game plays on, 0 page errors.
//   npx tsx scripts/open-mp-check.mts [--url https://ather.games] [--offline] [--out dir]
import puppeteer, { type Page } from 'puppeteer-core'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp'), offline = process.argv.includes('--offline')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const res: Record<string, unknown> = { url, offline }
const errs: string[] = []
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const open = async (tag: string): Promise<Page> => {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 800, height: 500 })
  p.on('pageerror', e => errs.push(`${tag}: ${String(e).slice(0, 180)}`))
  await p.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune', 'star'))
  return p
}
const poll = async (fn: () => Promise<boolean>, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(700) } return false }
const mp = (p: Page, f: string) => p.evaluate((k: string) => (window as any).__mp?.[k]?.(), f)
const selfId = (p: Page) => p.evaluate(() => localStorage.getItem('ather:mp:id'))
/** A sees B where B is (within 1 m, after the ease). */
const sees = async (a: Page, b: Page) => {
  const id = await selfId(b), me = await mp(b, 'me') as { x: number; z: number }
  const ps = (await mp(a, 'peers')) as { id: string; x: number; z: number }[] | undefined
  const q = ps?.find(x => x.id === id)
  return !!q && !!me && Math.hypot(q.x - me.x, q.z - me.z) < 1
}
let pass = false
try {
  const A = await open('A'), B = await open('B')
  // ── the continent ──
  for (const p of [A, B]) { await p.goto(`${url}/shimmer/open/continent?hour=12&mp=on`, { waitUntil: 'load', timeout: 240000 }); await p.waitForFunction(() => !!(window as any).__drive?.state && !!(window as any).__mp, { timeout: 240000, polling: 1000 }) }
  res.contZone = await mp(A, 'zone')
  if (offline) {
    await sleep(8000)
    res.status = [await mp(A, 'status'), await mp(B, 'status')]
    res.drives = await A.evaluate(() => !!(window as any).__drive.state())
    pass = res.contZone === 'open:continent' && (res.status as string[]).every(s => s !== 'live') && res.drives === true && errs.length === 0
  } else {
    res.live = await poll(async () => (await mp(A, 'status')) === 'live' && (await mp(B, 'status')) === 'live', 60000)
    // B walks a few metres from A
    const a = await mp(A, 'me') as { x: number; z: number }
    await B.evaluate((x, z) => (window as any).__drive.tp(x, z, 0, 0), a.x + 6, a.z + 4)
    res.contSees = await poll(() => sees(A, B), 45000)
    await sleep(800); try { await A.screenshot({ path: `${out}/mp-1-continent.png` }) } catch { /* slow frame */ }
    res.plate = await A.evaluate(() => document.querySelectorAll('[data-mp-plate]').length)
    // ── the Wilds: both travel to Greg's waymark ──
    for (const p of [A, B]) {
      await p.goto(`${url}/shimmer/open/ather?hour=14&mp=on`, { waitUntil: 'load', timeout: 240000 })
      await p.waitForFunction(() => !!(window as any).__ather?.travel && !!(window as any).__mp, { timeout: 240000, polling: 1000 })
      res[`plotNoSocket_${p === A ? 'A' : 'B'}`] = (await mp(p, 'zone')) === null
      for (let i = 0; i < 30 && (await p.evaluate(() => (window as any).__ather.zone())) !== 'wilds'; i++) {
        await p.evaluate(() => (window as any).__ather.travel({ kind: 'waymark', w: { id: 'greg', tile: 'first-wilds', x: -300, y: 0, z: 300, biome: 2, made: 0 } }))
        await p.waitForFunction(() => (window as any).__ather.zone() === 'wilds', { timeout: 15000, polling: 1000 }).catch(() => {})
      }
    }
    res.wildsLive = await poll(async () => (await mp(A, 'status')) === 'live' && (await mp(B, 'status')) === 'live', 60000)
    const w = await mp(A, 'me') as { x: number; z: number }
    await B.evaluate((x, z) => (window as any).__ather.tp(x, z, 0), w.x + 5, w.z - 5)
    res.wildsSees = await poll(() => sees(A, B), 45000)
    await sleep(800); try { await A.screenshot({ path: `${out}/mp-2-wilds.png` }) } catch { /* slow frame */ }
    // B leaves: A loses B
    const bid = await selfId(B); await B.close()
    res.leftGone = await poll(async () => !((await mp(A, 'peers')) as { id: string }[]).some(x => x.id === bid), 20000)
    pass = res.contZone === 'open:continent' && res.live === true && res.contSees === true && (res.plate as number) >= 1
      && res.plotNoSocket_A === true && res.plotNoSocket_B === true && res.wildsSees === true && res.leftGone === true && errs.length === 0
  }
} catch (e) { res.error = String(e).slice(0, 300) }
res.errors = errs
console.log(JSON.stringify(res)); console.log(pass ? 'PASS' : 'FAIL'); await br.close(); process.exit(pass ? 0 : 1)
