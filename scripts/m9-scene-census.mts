// BETA M9 (11-22, play): the heap diff with waymark trips showed the LIVE SCENE holding ~75 MB more geometry at home than on
// the plot (1192 vs 172 buffers). This counts what the scene holds, by scene path (window.__programOwners, the M44 probe), on
// the plot and again at home after N waymark trips home-and-back, and prints the paths that grew. No combat, trips only.
//   npx tsx scripts/m9-scene-census.mts [--url https://ather.games] [--trips 6] [--size 390x844] [--home-sec 90]
import puppeteer from 'puppeteer-core'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), TRIPS = Number(flag('--trips', '6')), HOME_S = Number(flag('--home-sec', '90'))
const [VW, VH] = flag('--size', '390x844').split('x').map(Number)
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ protocolTimeout: 600000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await br.newPage(); await p.setViewport({ width: VW, height: VH })
await p.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune', 'star'))
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
const A = (fn: string, ...a: unknown[]) => p.evaluate((f: string, args: unknown[]) => (window as any).__ather[f](...args), fn, a)
type Row = { path: string; obj: string; geo?: string; mat?: string; col?: string; inst?: boolean; n?: number; key?: string; mapImg?: string | null }
const census = async (label: string) => {
  const rows = await p.evaluate(() => ((window as any).__programOwners?.() ?? []) as unknown[]) as Row[]
  // the path with its leaf (the mesh itself) cut, so N siblings under one group count as N under one key
  const m = new Map<string, number>()
  for (const r of rows) { const k = r.path.replace(/[^/]*\/$/, '') + ` [${r.obj}${r.inst ? ' x' + r.n : ''} ${r.geo} ${r.mat} #${r.col ?? '-'}${r.mapImg ? ' map ' + r.mapImg : ''}]`; m.set(k, (m.get(k) ?? 0) + 1) }
  const tiles = await p.evaluate(() => ((window as any).__ather?.wildsLoaded?.() ?? []).length).catch(() => -1)
  console.log(`census ${label}: ${rows.length} drawn meshes · Wilds tiles held ${tiles}`)
  return m
}
await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => !!(window as any).__ather?.zone, { timeout: 240000 }); await sleep(20000)
const plot = await census('plot')
const greg = { kind: 'waymark', w: { id: 'greg', tile: 'first-wilds', x: -300, y: 0, z: 300, biome: 2, made: 0 } }
for (let k = 0; k < 40 && (await A('zone')) !== 'wilds'; k++) { await A('travel', greg); await sleep(4000) }
await p.waitForFunction(() => (window as any).__ather.zone() === 'wilds', { timeout: 120000 }); await sleep(8000)
const wilds1 = await census('wilds (first arrival)')
for (let t = 0; t < TRIPS; t++) {
  await A('travel', { kind: 'home' }); await p.waitForFunction(() => (window as any).__ather.zone() === 'plot', { timeout: 60000 }); await sleep(3000)
  await A('travel', greg); await p.waitForFunction(() => (window as any).__ather.zone() === 'wilds', { timeout: 60000 }); await sleep(6000)
}
const wildsN = await census(`wilds after ${TRIPS} trips`)
await A('travel', { kind: 'home' }); await p.waitForFunction(() => (window as any).__ather.zone() === 'plot', { timeout: 60000 })
await sleep(HOME_S * 1000)
const home = await census(`home ${HOME_S}s after`)
await br.close()
const grew = (a: Map<string, number>, b: Map<string, number>, title: string) => {
  const rows = [...new Set([...a.keys(), ...b.keys()])].map(k => ({ k, d: (b.get(k) ?? 0) - (a.get(k) ?? 0), n: b.get(k) ?? 0 })).filter(r => r.d !== 0).sort((x, y) => y.d - x.d)
  console.log(`\n== ${title}`); for (const r of rows.slice(0, 15)) console.log(`  ${String(r.d >= 0 ? '+' + r.d : r.d).padStart(6)} (now ${r.n})  ${r.k}`)
}
grew(plot, home, 'HOME minus PLOT')
grew(wilds1, wildsN, `WILDS after ${TRIPS} trips minus first arrival`)
console.log(`\npage errors: ${errs.length}${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
