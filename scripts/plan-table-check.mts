// ── THE PLANNING TABLE, BANK-FIRST + FLYING (Alex 11-18, Jin 3 25c51ac5) ──────────────────────────────────────────────
// Proves Alex's two asks on the live page: (1) building pays from the KEEPSTONE first: the bag holds NO logs, the bank
// holds exactly a Rinnshop's worth, and the table still builds it, emptying the bank; (2) PLAN lifts the keeper into the
// flying build mode (the strip rides along, the mouse is free, "Back to keeper" lands).
// SETUP (stated): bag = repeater + waymarks, no logs; bank (open.bank.v1) = 16 goldwood logs; no rooms.
// Hooks: __ather.tp (stand by the table) and __build.to (move the VIEW) only. Every E, icon, Build, Plan, Land and the
// placing click are real inputs. --phone runs at 390×844 for the look. Screenshots to --out.
//   npx tsx scripts/plan-table-check.mts [--url https://ather.games] [--out dir] [--phone [--w 360 --h 780]]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { TABLE, ROOMS } from '../src/app/shimmer/open/ather/rooms'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/plan-table'), phone = process.argv.includes('--phone')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const NEED = ROOMS.rinnshop.cost[0].n
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await br.createBrowserContext()).newPage()
await p.setViewport(phone ? { width: Number(flag('--w', '390')), height: Number(flag('--h', '844')), isMobile: true, hasTouch: true } : { width: 1100, height: 680 })
const errs: string[] = []
p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)) })
p.on('response', r => { if (r.status() >= 400 && r.url().startsWith(url)) errs.push(`${r.status()} ${r.url().slice(url.length, url.length + 90)}`) })
await p.evaluateOnNewDocument((need: number) => {
  if (sessionStorage.getItem('plan')) return; sessionStorage.setItem('plan', '1')
  localStorage.setItem('ather:shimmer:birthRune', 'star')
  const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'repeater', n: 1 }; slots[1] = { id: 'waymark', n: 12 }
  localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
  localStorage.setItem('open.bank.v1', JSON.stringify({ v: 1, stacks: [{ id: 'goldwood_log', n: need }] }))
  localStorage.removeItem('open.works.v1')
}, NEED)
// no named helpers inside evaluate: tsx wraps them in __name(), which the page does not have
const read = () => p.evaluate(() => ({
  bag: ((JSON.parse(localStorage.getItem('open.inv.v1') ?? '{}').slots ?? []) as ({ id: string; n: number } | null)[]).reduce((t, s) => t + (s?.id === 'goldwood_log' ? s.n : 0), 0),
  bank: ((JSON.parse(localStorage.getItem('open.bank.v1') ?? '{}').stacks ?? []) as { id: string; n: number }[]).reduce((t, s) => t + (s.id === 'goldwood_log' ? s.n : 0), 0),
  rooms: (JSON.parse(localStorage.getItem('open.works.v1') ?? '{"rooms":[]}').rooms as { kind: string }[]).map(r => r.kind),
}))
const hideCard = () => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => d.textContent?.includes('Click to play')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' }).catch(() => {})
const shot = async (n: string) => { await hideCard(); try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
const at = (sel: string) => p.evaluate(s => { const e = document.querySelector<HTMLElement>(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, sel)
const tapAt = async (pt: { x: number; y: number }) => { if (phone) await p.touchscreen.tap(pt.x, pt.y); else await p.mouse.click(pt.x, pt.y) }
const click = async (sel: string) => { const b = await at(sel); if (b) await tapAt(b); return !!b }
const res: Record<string, unknown> = { url, phone }

await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 180000 })
await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2500)
await hideCard()
if (phone) { const tts = await at('body'); await p.evaluate(() => [...document.querySelectorAll('div')].find(d => d.textContent?.trim() === 'TAP TO START' || d.textContent?.trim() === 'Tap to start')?.click()); void tts; await sleep(800) }   // the first-visit card
await p.evaluate((x, z) => (window as any).__ather.tp(x, z, Math.PI / 4), TABLE.x + 1.6, TABLE.z + 1.6); await sleep(1800)
res.start = await read()
const openTable = async () => { if (phone) await click('[data-touch-action="KeyE"], [data-code="KeyE"]') || await p.keyboard.press('e'); else await p.keyboard.press('e'); await sleep(1000); return p.evaluate(() => !!document.querySelector('[data-panel="planning-table"]')) }
res.table = await openTable(); await shot('plan-1-table')
// 1. the Rinnshop's card: the logs are counted from the Keepstone, and Build is lit
await click('[data-pick="rinnshop"]'); await sleep(600); await shot('plan-2-card')
res.card = await p.evaluate(() => { const c = document.querySelector('[data-build-card="rinnshop"]'); const b = c?.querySelector<HTMLButtonElement>('[data-act="build"] button'); return { text: c?.textContent ?? '', lit: !!b && !b.disabled } })
// 2. PLAN: fly, look, land
await click('[data-act="plan"]'); await sleep(2500)
res.planFlies = await p.evaluate(() => (window as any).__build?.on() === true && !!document.querySelector('[data-build-bar]') && !document.pointerLockElement)
await shot('plan-3-flying')
await click('[data-act="land"]'); await sleep(1200)
res.landed = await p.evaluate(() => (window as any).__build?.on() === false && !document.querySelector('[data-build-bar]'))
// 3. Build from the table: the bank pays all of it
res.table2 = await openTable()
await click('[data-pick="rinnshop"]'); await sleep(500)
await click('[data-build-card="rinnshop"] [data-act="build"] button'); await sleep(1500)
await p.evaluate(() => (window as any).__build.to(-100, 100)); await sleep(2500)
const mid = await p.evaluate(() => { const r = document.querySelector('canvas')!.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })
if (phone) { await p.touchscreen.tap(mid.x, mid.y); await sleep(800); await shot('plan-4-ghost'); await click('[data-act="place"]') }
else { await p.mouse.move(mid.x - 3, mid.y); await sleep(300); await p.mouse.move(mid.x, mid.y); await sleep(800); await shot('plan-4-ghost'); await p.mouse.click(mid.x, mid.y) }
await sleep(1500); await shot('plan-5-placed')
res.end = await read()
res.errs = errs
console.log(JSON.stringify(res))
const end = res.end as { bag: number; bank: number; rooms: string[] }, card = res.card as { text: string; lit: boolean }
const checks: [string, boolean][] = [
  ['table opens', res.table === true],
  [`card counts ${NEED} from the Keepstone`, card.text.includes(`${NEED} / ${NEED}`) && card.text.includes(`${NEED} in the Keepstone`)],
  ['Build lit with an empty bag', card.lit],
  ['Plan flies (bar up, mouse free)', res.planFlies === true],
  ['Back to keeper lands', res.landed === true],
  ['Rinnshop placed', end.rooms.includes('rinnshop')],
  ['the bank paid it all', end.bank === 0 && end.bag === 0],
  ['no page/console errors, no 4xx-5xx', errs.length === 0],
]
for (const [n, ok] of checks) console.log(`${ok ? '  ok ' : '  ✗  '} ${n}`)
const pass = checks.every(c => c[1])
console.log(pass ? 'PASS: plan table builds from the Keepstone, Plan flies and lands' : 'FAIL')
await br.close(); process.exit(pass ? 0 : 1)
