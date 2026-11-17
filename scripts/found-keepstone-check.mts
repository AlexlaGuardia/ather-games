// ── A FOUND KEEPSTONE, PLAYED (2026-11-17, play / Jin 2 95f19652) ────────────────────────────────────────────────
// Canon 5a20b8f: unique Keepstones are found in the world with a higher crystal set in them, look only. The find itself
// (a rare dig while prospecting) is unit-tested in prospecting.test.ts with a forced roll; this plays the rest: the
// planning table's Found Keepstones row → Set → it stands with its own light → it opens the same bank → Pick up returns
// it as itself. SETUP (stated): the bag holds one Violet Keepstone. Hooks: movement + reading only.
//   npx tsx scripts/found-keepstone-check.mts [--url http://localhost:3203] [--out dir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { TABLE } from '../src/app/shimmer/open/ather/rooms'
import { CHEST_SLOTS } from '../src/app/shimmer/open/ather/garden-bank'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/foundks')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 1100, height: 680 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument(() => {
  if (sessionStorage.getItem('fk')) return; sessionStorage.setItem('fk', '1')
  localStorage.setItem('ather:shimmer:birthRune', 'star')
  const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'repeater', n: 1 }; slots[1] = { id: 'waymark', n: 12 }; slots[2] = { id: 'bait', n: 10 }; slots[8] = { id: 'keepstone_violet', n: 1 }
  localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] })); localStorage.removeItem('open.works.v1'); localStorage.removeItem('open.bank.v1')
})
const read = (k: string) => p.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), k)
const bag = async () => { const r: Record<string, number> = {}; for (const s of ((await read('open.inv.v1'))?.slots ?? []) as ({ id: string; n: number } | null)[]) if (s) r[s.id] = (r[s.id] ?? 0) + s.n; return r }
const hideCard = () => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => d.textContent?.includes('Click to play')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' }).catch(() => {})
const shot = async (n: string) => { await hideCard(); try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
const tp = async (x: number, z: number, yaw: number) => { await p.evaluate((a, b, c) => (window as any).__ather.tp(a, b, c), x, z, yaw); await sleep(1500); await shot('_f'); await shot('_f') }
const click = async (sel: string) => { const b = await p.evaluate(s => { const e = document.querySelector<HTMLElement>(s); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, sel); if (b) await p.mouse.click(b.x, b.y); return !!b }
const res: Record<string, unknown> = { url }
await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 180000 })
await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2500)
await tp(TABLE.x + 1.6, TABLE.z + 1.6, Math.PI / 4)
await p.keyboard.press('e'); await sleep(900)
res.row = await p.evaluate(() => !!document.querySelector('[data-found-keepstones] [data-keepstone="keepstone_violet"]')); await shot('fk-1-table')
res.set = await click('[data-keepstone="keepstone_violet"] button'); await sleep(800)
await tp(-100, 112, 0); await p.keyboard.press('e'); await sleep(1000)
const works = await read('open.works.v1')
res.crystal = works?.chests?.[0]?.crystal; res.bagAfterSet = (await bag()).keepstone_violet ?? 0
await tp(-100, 112.9, 0); await sleep(1500); await shot('fk-2-violet-open')
await tp(-100, 111.2, 0); await p.keyboard.press('e'); await sleep(900)
res.cap = await p.evaluate(() => Number(document.querySelector('[data-bank-cap]')?.getAttribute('data-bank-cap') ?? -1))
res.pickedUp = await click('[data-act="pickup-keepstone"] button'); await sleep(800)
res.after = { chests: (await read('open.works.v1'))?.chests?.length, bag: await bag() }
res.errs = errs
console.log(JSON.stringify(res))
const a = res.after as { chests: number; bag: Record<string, number> }
const pass = res.row === true && res.crystal === 'violet_crystal' && res.bagAfterSet === 0 && res.cap === 2 * CHEST_SLOTS && a.chests === 0 && a.bag.keepstone_violet === 1 && !a.bag.keepstone && errs.length === 0
console.log(pass ? 'PASS: Violet Keepstone set from the table → violet light, same bank (cap 96) → picked up as itself' : 'FAIL')
await br.close(); process.exit(pass ? 0 : 1)
