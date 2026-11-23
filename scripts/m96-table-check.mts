// ── BETA M96, PLAYED: the planning table is furniture (world aa0cbd5d, 2026-11-23) ─────────────────────────────────────
// Stand at the planning table, hands empty: three swings (the same call the hit button makes) and it is in the bag. Its old spot
// answers nothing. Hold it (hotbar 1), set it on held ground: E there opens the planning table. Reload: it is still there, the
// old spot still empty, the bag still empty of tables.
// SETUP (stated): an empty bag, empty works (a keeper who never moved it). Hooks: tp, __melee.swing, reading only.
//   npx tsx scripts/m96-table-check.mts [--url http://localhost:3201] [--out dir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/m96-table')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 1100, height: 760 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument(() => {
  if (sessionStorage.getItem('m96')) return; sessionStorage.setItem('m96', '1')
  localStorage.setItem('ather:shimmer:birthRune', 'star')
  localStorage.removeItem('open.build.prefs.v1')
  localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots: Array(32).fill(null), gifts: ['bait1'] }))
  localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [], chests: [], pieces: [] }))
})
const read = (k: string) => p.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), k)
const works = async () => (await read('open.works.v1')) as { tableMoved?: boolean; pieces: { item: string; x: number; z: number; q: number }[] }
const tables = async () => (await works()).pieces.filter(x => x.item === 'planning_table')
const inBag = async () => ((await read('open.inv.v1'))?.slots ?? []).reduce((t: number, s: { id: string; n: number } | null) => t + (s?.id === 'planning_table' ? s.n : 0), 0) as number
const hideCard = () => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => d.textContent?.includes('Click to play')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' }).catch(() => {})
const shot = async (n: string) => { await hideCard(); try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
const tp = async (x: number, z: number, yaw: number) => { await p.evaluate((a, b, c) => (window as any).__ather.tp(a, b, c), x, z, yaw); await sleep(1800) }
const pollUntil = async (f: () => Promise<boolean>, ms: number) => { const t = Date.now(); while (Date.now() - t < ms) { if (await f().catch(() => false)) return true; await sleep(250) } return false }
const target = () => p.evaluate(() => (window as any).__melee?.target()?.id ?? null)
const panel = () => p.evaluate(() => !!document.querySelector('[data-panel="planning-table"]'))
const closePanel = async () => { await p.keyboard.press('Escape'); await sleep(700) }
const boot = async () => { await p.goto(`${url}/shimmer/open/ather?hour=14&home=1`, { waitUntil: 'load', timeout: 180000 }); await p.waitForFunction(() => typeof (window as any).__ather?.tp === 'function' && !!(window as any).__melee, { timeout: 180000 }); await sleep(2500) }
await boot()
// the table's first spot: rooms.ts TABLE = GREG + (6, -10), GREG = (-118, 136)
const T = { x: -112, z: 126 }
await tp(T.x, T.z + 2.4, 0)
await p.keyboard.press('e'); ok(await pollUntil(panel, 4000), 'never moved: E at the table opens it (no change for a keeper who never moved it)'); await closePanel()
ok(await pollUntil(async () => (await target()) === 'table', 8000), `facing the table, a swing would land on it (${await target()})`)
await shot('m96-0-before')
for (let i = 0; i < 3; i++) { await p.evaluate(() => (window as any).__melee.swing()); await sleep(700) }
ok(await pollUntil(async () => (await works()).tableMoved === true, 4000), 'three hits: the save says the table left its spot')
ok((await inBag()) === 1, `... and 1 planning table is in the bag (${await inBag()})`)
await sleep(800); ok((await target()) !== 'table', 'nothing left to hit at the old spot')
await p.keyboard.press('e'); await sleep(1200); ok(!(await panel()), 'E at the old spot opens nothing')
await shot('m96-1-lifted')
// set it on held ground somewhere else
await tp(-100, 106, 0)
await p.keyboard.press('Digit1'); await sleep(1500)
const placing = await p.evaluate(() => document.querySelector<HTMLElement>('[data-placing]')?.dataset.placing ?? null)
ok(placing === 'piece', `hotbar 1 holds the table as a piece to set (${placing})`)
await sleep(1200); await shot('m96-2-ghost')
await p.keyboard.press('e'); await sleep(1200)
const tb = (await tables())[0]
ok(!!tb && (await inBag()) === 0, `set: the table stands at (${tb?.x.toFixed(2)}, ${tb?.z.toFixed(2)}), the bag is empty of tables`)
if (tb) {
  await tp(tb.x, tb.z + 2.4, 0); await shot('m96-3-moved')
  await p.keyboard.press('e'); ok(await pollUntil(panel, 4000), 'E at the moved table opens the planning table there'); await closePanel()
}
// reload: it stays
await boot()
const after = await tables()
ok(after.length === 1 && !!tb && Math.abs(after[0].x - tb.x) < 1e-6 && Math.abs(after[0].z - tb.z) < 1e-6 && (await works()).tableMoved === true, 'reload: it is still where it was set')
ok((await inBag()) === 0, 'reload: no second table appeared in the bag')
await tp(T.x, T.z + 2.4, 0)
await p.keyboard.press('e'); await sleep(1200); ok(!(await panel()), 'reload: the old spot still answers nothing')
ok((await target()) !== 'table', 'reload: no fixture to hit at the old spot')
await shot('m96-4-oldspot')
if (tb) { await tp(tb.x, tb.z + 2.4, 0); await p.keyboard.press('e'); ok(await pollUntil(panel, 4000), 'reload: the moved table still opens'); await closePanel() }
ok(errs.length === 0, `0 page errors${errs.length ? ': ' + errs.join(' | ') : ''}`)
await br.close()
console.log(fails ? `m96-table-check: ${fails} FAIL` : 'PASS: three hits lift the planning table into the bag; set elsewhere it opens there; survives reload; the old spot is empty')
process.exit(fails ? 1 : 0)
