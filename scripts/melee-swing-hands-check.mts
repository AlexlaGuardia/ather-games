// M82 s3: a real melee swing plays the authored swing (shared/fp-actions.ts 'melee.swing') on the right mitt. On the keeper's
// plot, hands stowed, facing a Ruin Column (melee-check.mts's setup): rest pose read, then ONE swing through __melee.swing() (the
// same call the right-click and the phone button make), the mitt rises to the wind-up and settles back to rest after; a press
// inside the cooldown is not a swing and plays nothing new. The swing DRAFT (what the tuner saves) holds the wind-up 9 s so a
// software-GL frame (~4 s each) lands on it, which also proves the game plays this browser's drafted action. 0 page errors.
//   npx tsx scripts/melee-swing-hands-check.mts [--url https://ather.games] [--out dir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/melee-swing-hands')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const COL = { id: 'col-1', item: 'ruin_column', x: -130, z: 100, q: 0, placedAt: 1 }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 1100, height: 680 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument((col: unknown) => {
  if (sessionStorage.getItem('msw')) return; sessionStorage.setItem('msw', '1')
  localStorage.setItem('ather:shimmer:birthRune', 'star')
  const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'repeater', n: 1 }
  localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
  localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [], chests: [], pieces: [col] })); localStorage.removeItem('open.bank.v1')
  localStorage.setItem('open:hands-actions.v1', JSON.stringify({ 'melee.swing': { keys: [
    { x: 0.355, y: -0.415, z: -0.56, pitch: -1.4, roll: 0.63, yaw: 0, ms: 200, hold: 0, ease: 'inout' },
    { x: 0.4, y: -0.32, z: -0.48, pitch: -1.15, roll: 1.0, yaw: 0, ms: 90, hold: 9000, ease: 'out' },
    { x: 0.08, y: -0.34, z: -0.74, pitch: -1.6, roll: -0.15, yaw: 0, ms: 80, hold: 110, ease: 'in' } ] } }))
}, COL)
await p.goto(`${url}/shimmer/open/ather?hour=14&home=1`, { waitUntil: 'load', timeout: 180000 })
await p.waitForFunction(() => typeof (window as any).__ather?.tp === 'function' && !!(window as any).__melee && !!(window as any).__openHands, { timeout: 180000 }); await sleep(2500)
await p.evaluate(() => (window as any).__ather.tp(-130, 101.8, 0)); await sleep(2500)
const results: [string, boolean, string][] = []
const check = (n: string, c: boolean, d = '') => { results.push([n, c, d]); console.log(c ? '✓' : '✗', n, d) }
const frame = async (name = '_frame') => { try { await p.screenshot({ path: `${out}/${name}.png` }) } catch { /* slow */ } }
const R = () => p.evaluate(() => (window as any).__openHands.R()) as Promise<{ x: number; y: number; z: number }>
for (let i = 0; i < 4; i++) { await frame(); await sleep(150) }
check('stowed', (await p.evaluate(() => (window as any).__ather.stance?.().kind)) === 'stowed')
const rest = await R()
const at = Date.now(), first = await p.evaluate(() => (window as any).__melee.swing())
const second = await p.evaluate(() => (window as any).__melee.swing())
check('a swing goes, a press inside the cooldown does not', first !== 'cooldown' && second === 'cooldown', `${first}, then ${second}`)
const ys: [number, number][] = []
for (let i = 0; i < 40 && Date.now() - at < 8000; i++) { await frame(i === 1 ? '1-swing-windup' : '_frame'); ys.push([Date.now() - at, (await R()).y]) }
const peak = Math.max(...ys.map(([, y]) => y))
check('the swing raises the mitt to the wind-up', peak > rest.y + 0.07, `rest y ${rest.y.toFixed(3)}, peak ${peak.toFixed(3)} (${ys.map(([t, y]) => `${t}:${y.toFixed(2)}`).join(' ')})`)
while (Date.now() - at < 11000) { await frame(); await sleep(150) }
for (let i = 0; i < 4; i++) { await frame(); await sleep(150) }
const after = await R()
check('and settles back to rest', Math.abs(after.y - rest.y) < 0.03 && Math.abs(after.x - rest.x) < 0.03, `(${after.x.toFixed(3)}, ${after.y.toFixed(3)}) vs rest (${rest.x.toFixed(3)}, ${rest.y.toFixed(3)})`)
await frame('2-after')
check('no page errors', errs.length === 0, errs.join(' | '))
const pass = results.every(r => r[1])
console.log(pass ? `PASS: ${results.length} checks, shots in ${out}` : `FAIL: ${results.filter(r => !r[1]).map(r => r[0]).join(', ')}`)
await br.close(); process.exit(pass ? 0 : 1)
