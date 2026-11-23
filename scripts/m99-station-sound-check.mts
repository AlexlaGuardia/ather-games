// ── M99 STATION WORKING SOUNDS, PLAYED (2026-11-23, play) ──────────────────────────────────────────────────────────
// A fresh guest's OWN localStorage (Alex's save never touched): a Carpentry at (-100, 100) and a Stonemason at (-100, 150), both
// standing, each with its Moglin and a store above the 30 reserve, so both stockpile (= a run in progress). The candidates are
// PROPOSED (silent), so this reads window.__sfx.asked() (every request the game made, shared/sfx.ts):
//   1. keeper at the carpentry bench: work-carp-saw asked on a ~3 s beat (>= 2 in ~8 s, <= 4) · masonry (50 m off) asked 0
//   2. a plank run lands within ~20 s: work-done-wood asked
//   3. keeper walks (tp) to the masonry bench: work-mason-chisel starts being asked
//   4. __sfx.played() follows the vote: a yay id plays every time it is asked, a proposed / nay one never · 0 page errors
//   npx tsx scripts/m99-station-sound-check.mts [--url https://ather.games]
import puppeteer from 'puppeteer-core'
import { benchOf, type Room } from '../src/app/shimmer/open/ather/rooms'
import registry from '../src/app/shimmer/open/shared/sounds.json'
const statusOf = (id: string) => (registry as { id: string; status: string }[]).find(r => r.id === id)?.status
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games')
const CARP: Room = { id: 'carp-snd', kind: 'carpentry', x: -100, z: 100, q: 0, placedAt: 1, doneAt: 2, store: [{ id: 'goldwood_log', n: 60 }] }
const MASON: Room = { id: 'mason-snd', kind: 'stonemason', x: -100, z: 150, q: 0, placedAt: 1, doneAt: 2, store: [{ id: 'blankstone', n: 60 }] }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] })
try {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 1100, height: 700 })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument((rooms: Room[]) => {
    if (sessionStorage.getItem('m99')) return; sessionStorage.setItem('m99', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'repeater', n: 1 }
    localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
    localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms, chests: [] }))
    const mog = (id: string, profession: string, room: string) => ({ id, name: id, home: 'check', grades: { craft: 3, yield: 3, trade: 3 }, dream: '', profession, recruitedAt: 1, room })
    localStorage.setItem('open.village.v1', JSON.stringify({ v: 1, lastTick: Date.now(), moglins: [mog('Heath', 'carpenter', 'carp-snd'), mog('Flint', 'stonemason', 'mason-snd')] }))
  }, [CARP, MASON])
  const asked = () => p.evaluate(() => (window as any).__sfx?.asked?.() ?? {}) as Promise<Record<string, number>>
  const played = () => p.evaluate(() => (window as any).__sfx?.played?.() ?? {}) as Promise<Record<string, number>>
  await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 180000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 })
  const cb = benchOf(CARP), mb = benchOf(MASON)
  await p.evaluate((x, z) => (window as any).__ather.tp(x, z, 0), cb.x, cb.z - 2); await sleep(1500)

  const a0 = await asked()
  await sleep(8200)
  const a1 = await asked(), saw = (a1['work-carp-saw'] ?? 0) - (a0['work-carp-saw'] ?? 0)
  ok(saw >= 2 && saw <= 4, `1. at the carpentry bench: the saw phrase asked on a ~3 s beat (${saw} in 8.2 s)`)
  ok(!a1['work-mason-chisel'], `   the masonry bench 50 m off: not asked (${a1['work-mason-chisel'] ?? 0})`)
  ok(!a1['work-carp-plane'], '   only the FIRST yay candidate (else the first) is asked per bench')
  let done = a1['work-done-wood'] ?? 0
  for (let t = 0; t < 20 && !done; t++) { await sleep(1000); done = (await asked())['work-done-wood'] ?? 0 }
  ok(done >= 1, `2. a plank run landed: the wood sting asked (${done})`)
  const works = await p.evaluate(() => JSON.parse(localStorage.getItem('open.works.v1') ?? 'null'))
  const planks = (works?.rooms?.find((r: Room) => r.id === 'carp-snd')?.out ?? []).reduce((s: number, x: { id: string; n: number }) => s + (x.id === 'goldwood_plank' ? x.n : 0), 0)
  ok(planks > 0, `   and the bench really made planks (${planks} in its output)`)

  await p.evaluate((x, z) => (window as any).__ather.tp(x, z, 0), mb.x, mb.z - 2); await sleep(500)
  const m0 = (await asked())['work-mason-chisel'] ?? 0
  await sleep(6500)
  const m1 = (await asked())['work-mason-chisel'] ?? 0
  ok(m1 - m0 >= 1, `3. walked to the masonry bench: the chisel phrase starts (${m1 - m0} in 6.5 s)`)

  // 4. PLAYED follows the vote: a yay station id that was asked also played; a proposed / nay one never did
  const pl = await played(), ak = await asked()
  const wrong = Object.keys(ak).filter(k => k.startsWith('work-')).filter(k => (statusOf(k) === 'yay') !== ((pl[k] ?? 0) === ak[k]))
  ok(wrong.length === 0, `4. played follows the vote (yay: ${Object.keys(pl).filter(k => k.startsWith('work-')).join() || 'none'}; mismatched: ${wrong.join() || 'none'})`)
  ok(errs.length === 0, `   0 page errors${errs.length ? ': ' + errs.join(' | ') : ''}`)
} finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS')
process.exit(fails ? 1 : 0)
