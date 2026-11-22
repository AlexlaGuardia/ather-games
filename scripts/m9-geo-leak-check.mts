// BETA M9 (11-22, play): every waymark trip home and back used to strand geometries in the renderer (PlotIsland's island +
// grid, each tile's TilePaths: prop geometry R3F never disposes). This counts renderer.info.memory.geometries (window.__glMemory)
// on each return home over N trips. PASS: the count at the last home is within 2 per trip of the count at the first home (unfixed: +5 a trip), 0 errors.
//   npx tsx scripts/m9-geo-leak-check.mts [--url https://ather.games] [--trips 6] [--size 390x844]
import puppeteer from 'puppeteer-core'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), TRIPS = Number(flag('--trips', '6')), SLACK_PER_TRIP = 2
const [VW, VH] = flag('--size', '390x844').split('x').map(Number)
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ protocolTimeout: 600000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await br.newPage(); await p.setViewport({ width: VW, height: VH })
await p.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune', 'star'))
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
const A = (fn: string, ...a: unknown[]) => p.evaluate((f: string, args: unknown[]) => (window as any).__ather[f](...args), fn, a)
const mem = () => p.evaluate(() => (window as any).__glMemory?.() ?? null) as Promise<{ geometries: number; textures: number; programs: number } | null>
await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => !!(window as any).__ather?.zone && !!(window as any).__glMemory, { timeout: 240000 }); await sleep(5000)
const greg = { kind: 'waymark', w: { id: 'greg', tile: 'first-wilds', x: -300, y: 0, z: 300, biome: 2, made: 0 } }
const toWilds = async () => { for (let k = 0; k < 40 && (await A('zone')) !== 'wilds'; k++) { await A('travel', greg); await sleep(3000) } await p.waitForFunction(() => (window as any).__ather.zone() === 'wilds', { timeout: 120000 }); await sleep(5000) }
const toHome = async () => { await A('travel', { kind: 'home' }); await p.waitForFunction(() => (window as any).__ather.zone() === 'plot', { timeout: 60000 }); await sleep(4000) }
const homes: number[] = [], wilds: number[] = []
console.log(`boot: ${JSON.stringify(await mem())}`)
for (let t = 0; t < TRIPS; t++) {
  await toWilds(); const w = await mem(); wilds.push(w?.geometries ?? -1)
  await toHome(); const h = await mem(); homes.push(h?.geometries ?? -1)
  console.log(`trip ${t + 1}: wilds ${w?.geometries} geos · home ${h?.geometries} geos · textures ${h?.textures} · programs ${h?.programs}`)
}
await br.close()
const grew = homes[homes.length - 1] - homes[0]
console.log(`home geometries first ${homes[0]} -> last ${homes[homes.length - 1]} (+${grew} over ${TRIPS - 1} trips) · page errors ${errs.length}${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
const ok = homes.every(n => n >= 0) && grew <= SLACK_PER_TRIP * (TRIPS - 1) && errs.length === 0
console.log(ok ? 'PASS' : 'FAIL'); process.exit(ok ? 0 : 1)
