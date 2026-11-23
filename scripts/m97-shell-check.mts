// ── BETA M97 s1, PLAYED: rooms are SHELLS (world aa0cbd5d, 2026-11-23) ──────────────────────────────────────────────────
// A raised shell Carpentry room and an OLDER (walled) Rinnshop side by side. Walk at the shell's back from outside: you walk
// straight in (no wall). Walk at the older room's back: its wall stops you. E at the shell's bench opens the bench. Put a
// stool on the shell's old back-wall line: it sets.
// SETUP (stated): works seeded with the two raised rooms (shell flag on one), a stool in hotbar 1. Hooks: tp/look, reading only.
//   npx tsx scripts/m97-shell-check.mts [--url http://localhost:3201] [--out dir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/m97-shell')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
// carpentry 8 x 6 at (-110, 105), q 0: z 102..108, back wall line z = 108, bench at z 106.6 (x -110)
const SHELL = { id: 'carpentry-m97', kind: 'carpentry', x: -110, z: 105, q: 0, placedAt: 1, doneAt: 2, shell: true }
const OLD = { id: 'rinnshop-old', kind: 'rinnshop', x: -130, z: 105, q: 0, placedAt: 1, doneAt: 2 }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 1100, height: 760 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument((rooms: unknown) => {
  if (sessionStorage.getItem('m97')) return; sessionStorage.setItem('m97', '1')
  localStorage.setItem('ather:shimmer:birthRune', 'star')
  localStorage.removeItem('open.build.prefs.v1')
  const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'goldwood_stool', n: 1 }
  localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
  localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms, chests: [], pieces: [] }))
}, [SHELL, OLD])
const read = (k: string) => p.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), k)
const hideCard = () => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => d.textContent?.includes('Click to play')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' }).catch(() => {})
const shot = async (n: string) => { await hideCard(); try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
const tp = async (x: number, z: number, yaw: number, pitch = -0.15) => { await p.evaluate((a, b, c, d) => { const g = (window as any).__ather; g.tp(a, b, c); g.look(c, d) }, x, z, yaw, pitch); await sleep(1800) }
const pos = async () => (await p.evaluate(() => (window as any).__ather.state())) as { px: number; pz: number }
// hold W until past z = goal, or stuck (no 5 cm of progress in 1.5 s), or 12 s: a headless frame rate makes a fixed hold walk 1.8 to 3 m
const walk = async (goal: number) => {
  await p.keyboard.down('KeyW'); const t0 = Date.now(); let last = (await pos()).pz, lastAt = Date.now()
  while (Date.now() - t0 < 12000) { await sleep(250); const z = (await pos()).pz; if (z < goal) break; if (last - z > 0.05) { last = z; lastAt = Date.now() } else if (Date.now() - lastAt > 1500) break }
  await p.keyboard.up('KeyW'); await sleep(500) }
const pollUntil = async (f: () => Promise<boolean>, ms: number) => { const t = Date.now(); while (Date.now() - t < ms) { if (await f().catch(() => false)) return true; await sleep(250) } return false }
await p.goto(`${url}/shimmer/open/ather?hour=14&home=1`, { waitUntil: 'load', timeout: 180000 })
await p.waitForFunction(() => typeof (window as any).__ather?.tp === 'function', { timeout: 180000 }); await sleep(2500)
const rooms = ((await read('open.works.v1'))?.rooms ?? []) as { id: string; shell?: boolean }[]
ok(rooms.length === 2 && rooms.find(r => r.id === SHELL.id)?.shell === true, 'setup: the shell room and the older room loaded')
await tp(-110, 116, 0, -0.25); await shot('m97-0-shell-from-behind')
await tp(-110, 98, 0, -0.2); await shot('m97-1-shell-front')
// 2. the older room's back wall stops you
await tp(-128, 110.5, 0)
const o0 = await pos(); await walk(106.5); const o1 = await pos()
ok(o1.pz > 108, `the older room keeps its back wall: stopped at z ${o1.pz.toFixed(2)} (from ${o0.pz.toFixed(2)})`)
// 1. walk at the shell's back from outside (start z 110.5, facing -z): straight in
await tp(-108, 110.5, 0)
const s0 = await pos(); await walk(106.5); const s1 = await pos()
ok(s1.pz < 108 && s1.pz < o1.pz - 0.5, `the shell has no back wall: walked from z ${s0.pz.toFixed(2)} to ${s1.pz.toFixed(2)} (in past 108)`)
// 3. E at the shell's bench
await tp(-110, 104.6, Math.PI)   // inside, facing the bench (+z)
await p.keyboard.press('e')
ok(await pollUntil(() => p.evaluate(() => !!document.querySelector('[data-panel="bench"]')), 4000), 'E at the shell\'s bench opens the bench')
await p.keyboard.press('Escape'); await sleep(800)
// 4. a stool on the shell's old back-wall line sets
await tp(-107.5, 111, 0)   // the stool ghost lands ~1.45 m ahead, near z 109.5..108
await p.keyboard.press('Digit1'); await sleep(1500); await p.keyboard.press('e'); await sleep(1200)
const stool = (((await read('open.works.v1'))?.pieces ?? []) as { item: string; x: number; z: number }[]).find(x => x.item === 'goldwood_stool')
ok(!!stool, `a stool sets just behind the shell, where its back wall used to stand (${stool ? `${stool.x.toFixed(2)}, ${stool.z.toFixed(2)}` : 'refused'})`)
await tp(-104, 114, Math.PI * 0.8, -0.3); await shot('m97-2-built-round')
ok(errs.length === 0, `0 page errors${errs.length ? ': ' + errs.join(' | ') : ''}`)
await br.close()
console.log(fails ? `m97-shell-check: ${fails} FAIL` : 'PASS: a shell room has no walls (walk straight in), an older room keeps its walls, the bench works, furniture sets on the old wall line')
process.exit(fails ? 1 : 0)
