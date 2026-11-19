// ── OTHERS SEE YOUR LOOK, PLAYED (BETA M29 slice 3, play / Jin 4 ccb58127, 11-19; docs/M29-look-sync.md option A) ───────
// Two keepers (two browser contexts = two players), same Wilds instance. B has a distinctive look; A must receive it with B
// (the socket's `sprite` on join, 'lk1:<packed>') and draw B as B's own keeper figure. Then B changes look and rejoins:
// A gets the new one. PROD ONLY (devwin has no /shimmer-ws route). Hooks: __mp peers/figures (reading).
//   npx tsx scripts/look-sync-check.mts [--url https://ather.games]
import puppeteer, { type Page } from 'puppeteer-core'
import { DEFAULT_LOOK, packLook, LOOK_KEY, type Look } from '../src/app/shimmer/open/shared/keeper-look'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const errs: string[] = []
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const poll = async (fn: () => Promise<boolean>, ms = 90000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(700) } return false }
const B1: Look = { ...DEFAULT_LOOK, hairStyle: 6, hair: 7, scarf: 2, frame: 2, ears: 0 }
const B2: Look = { ...B1, hairStyle: 2, scarf: 5 }
async function open(tag: string, look: Look): Promise<Page> {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 800, height: 500 })
  p.on('pageerror', e => errs.push(`${tag}: ${String(e).slice(0, 180)}`))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument((k: string, l: string) => { localStorage.setItem('ather:shimmer:birthRune', 'star'); if (!sessionStorage.getItem('ls')) { sessionStorage.setItem('ls', '1'); localStorage.setItem(k, l) } }, LOOK_KEY, JSON.stringify(look))
  await p.goto(`${url}/shimmer/open/ather?hour=13&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
  ok(await poll(async () => (await p.evaluate(() => (window as any).__ather?.zone?.())) === 'wilds', 240000), `${tag}: in the Wilds`)
  ok(await poll(async () => (await p.evaluate(() => (window as any).__mp?.status?.())) === 'live'), `${tag}: the socket is live`)
  return p
}
const idOf = (p: Page) => p.evaluate(() => localStorage.getItem('ather:mp:id'))
const peerOf = async (a: Page, id: string | null) => ((await a.evaluate(() => (window as any).__mp?.peers?.() ?? [])) as { id: string; sprite: string | null }[]).find(q => q.id === id)
const drawn = async (a: Page, id: string | null) => ((await a.evaluate(() => (window as any).__mp?.figures?.() ?? [])) as string[]).includes(id ?? '')

const a = await open('A', DEFAULT_LOOK)
const b = await open('B', B1)
const bid = await idOf(b)
ok(await poll(async () => (await peerOf(a, bid))?.sprite === 'lk1:' + packLook(B1)), `1. A receives B with B's look on the socket (${(await peerOf(a, bid))?.sprite})`)
ok(await poll(async () => drawn(a, bid), 30000), '2. A draws B as B\'s own keeper figure (not the folk rig)')
// B changes look and comes back: A gets the new one (a look change reconnects B's socket once)
await b.evaluate((k: string, l: string) => localStorage.setItem(k, l), LOOK_KEY, JSON.stringify(B2))
await b.goto(`${url}/shimmer/open/ather?hour=13&waymark=greg`, { waitUntil: 'load', timeout: 240000 })   // not a bare reload: the page drops ?waymark= and would land on the plot (no socket)
await poll(async () => (await b.evaluate(() => (window as any).__mp?.status?.())) === 'live', 240000)
ok(await poll(async () => (await peerOf(a, bid))?.sprite === 'lk1:' + packLook(B2)), `3. B changes look and rejoins: A gets the new one (${(await peerOf(a, bid))?.sprite})`)
ok(errs.length === 0, `4. 0 page errors${errs.length ? ': ' + errs.join(' | ') : ''}`)
await br.close()
console.log(fails ? `look-sync-check: ${fails} FAIL` : 'look-sync-check: PASS')
process.exit(fails ? 1 : 0)
