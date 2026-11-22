// M82 s2: the rinstick is IN THE MITT and a real cast plays the authored cast (shared/fp-actions.ts 'rinstick.cast').
// Bait out in the Wilds -> the rod is the mitt's child (held-rod.tsx: __heldRod.tip() answers, ~1 m from the eye) and the
// line leaves its tip; a cast swings the mitt UP (the back swing) and it settles back to rest after; stowing the bait takes
// the rod away. Setup copied from rinning-check.mts (fresh keeper, bait, shore on the start tile). Shots for the look.
//   npx tsx scripts/rin-cast-hands-check.mts [--url https://ather.games] [--out dir]
import puppeteer from 'puppeteer-core'
import { readFileSync, mkdirSync } from 'fs'
import { parseWilds, BIOME, type WildsMeta } from '../src/app/shimmer/open/ather/wilds'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const out = flag('--out', '/tmp/rin-cast-hands'), url = flag('--url', 'https://ather.games')
mkdirSync(out, { recursive: true })
const D = 'public/open/wilds/', b = readFileSync(D + 'first-wilds.bin'), bio = readFileSync(D + 'first-wilds.biome')
const W = parseWilds(JSON.parse(readFileSync(D + 'first-wilds.json', 'utf8')) as WildsMeta, new Int16Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), new Uint8Array(bio))
let spot: { x: number; z: number; yaw: number; pitch: number } | null = null
for (let z = -400; z < 400 && !spot; z += 6) for (let x = -400; x < 400 && !spot; x += 6) {
  const y = W.heightAt(x, z); if (!(y > 0.6) || W.biomeAt(x, z) === BIOME.water) continue
  for (let a = 0; a < 8 && !spot; a++) {
    const dx = Math.cos(a * Math.PI / 4), dz = Math.sin(a * Math.PI / 4), wx = x + dx * 7, wz = z + dz * 7
    if (W.biomeAt(wx, wz) !== BIOME.water || W.heightAt(wx, wz) > -0.4) continue
    if (W.trees.some(t => Math.hypot(t.x - x, t.z - z) < 2)) continue
    spot = { x, z, yaw: Math.atan2(-dx, -dz), pitch: -Math.atan2(y + 1.6, 7) }
  }
}
if (!spot) { console.log('no shore found'); process.exit(1) }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const p = await br.newPage(); await p.setViewport({ width: 1000, height: 640 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument(() => { localStorage.setItem('ather:shimmer:birthRune', 'star'); { const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'waymark', n: 12 }; slots[1] = { id: 'bait', n: 10 }; localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] })) } localStorage.removeItem('open.skills.v1')
  // the cast DRAFT (what the tuner saves): the back swing held 9 s, so a software-GL frame (~4 s each) lands on it; this also
  // proves the game plays this browser's drafted action, not only the shipped one
  localStorage.setItem('open:hands-actions.v1', JSON.stringify({ 'rinstick.cast': { keys: [
    { x: 0.355, y: -0.415, z: -0.56, pitch: -1.4, roll: 0.63, yaw: 0, ms: 200, hold: 0, ease: 'inout' },
    { x: 0.38, y: -0.2, z: -0.44, pitch: -0.6, roll: 0.35, yaw: 0, ms: 150, hold: 9000, ease: 'out' },
    { x: 0.33, y: -0.36, z: -0.7, pitch: -1.75, roll: 0.55, yaw: 0, ms: 100, hold: 200, ease: 'in' } ] } }))
})
await p.goto(`${url}/shimmer/open/ather?hour=14&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => !!(window as any).__ather?.rin && (window as any).__ather?.zone?.() === 'wilds', { timeout: 240000 }); await sleep(6000)
const frame = async (name = '_frame') => { try { await p.screenshot({ path: `${out}/${name}.png` }) } catch { /* slow */ } }
await p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => d.textContent?.includes('Click to play')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' })
await p.evaluate((s) => { const A = (window as any).__ather; A.tp(s.x, s.z, s.yaw); A.look(s.yaw, s.pitch) }, spot); await sleep(3000)
{ const py = await p.evaluate(() => (window as any).__ather.state().py) as number; spot.pitch = -Math.atan2(py + 1.62, 7) }
await p.evaluate((s) => (window as any).__ather.look(s.yaw, s.pitch), spot)
const results: [string, boolean, string][] = []
const check = (n: string, c: boolean, d = '') => { results.push([n, c, d]); console.log(c ? '✓' : '✗', n, d) }
const tip = () => p.evaluate(() => (window as any).__heldRod?.tip?.() ?? null) as Promise<{ x: number; y: number; z: number } | null>
const R = () => p.evaluate(() => (window as any).__openHands.R()) as Promise<{ x: number; y: number; z: number }>
const eye = () => p.evaluate(() => { const s = (window as any).__ather.state(); return { x: s.px, y: s.py + 1.62, z: s.pz } }) as Promise<{ x: number; y: number; z: number }>
// before the bait: no rod
await frame(); await frame()
check('no rod before the bait is out', (await tip()) === null)
const slot = await p.evaluate(() => (((JSON.parse(localStorage.getItem('open.inv.v1') ?? '{"slots":[]}').slots ?? []) as ({ id: string } | null)[]).slice(0, 8).findIndex(s => s?.id === 'bait') + 1) || 3)
await p.keyboard.press(`Digit${slot}`); await sleep(400)
await p.evaluate((s) => (window as any).__ather.look(s.yaw, s.pitch), spot)
for (let i = 0; i < 6; i++) { await frame(); await sleep(150) }
const t0 = await tip(), e0 = await eye()
const reach = t0 ? Math.hypot(t0.x - e0.x, t0.y - e0.y, t0.z - e0.z) : -1
check('bait out: the rod is in the mitt', !!t0, t0 ? `tip ${reach.toFixed(2)} m from the eye` : 'no tip')
check('the rod tip is within arm + rod of the eye', reach > 0.4 && reach < 2.2, `${reach.toFixed(2)} m`)
await frame('1-rod-in-hand')
const rest = await R()
check('aimed at water', await p.evaluate(() => !!(window as any).__ather.rin()?.aim))
// the cast: the mitt swings up (key 2, the back swing, held by the seeded draft), then comes back to rest
const at = Date.now(); await p.evaluate(() => (window as any).__ather.cast())
const ys: [number, number][] = []
for (let i = 0; i < 40 && Date.now() - at < 8000; i++) { await frame(i === 2 ? '2-cast-early' : i === 5 ? '3-cast-flick' : '_frame'); ys.push([Date.now() - at, (await R()).y]) }
const phase = await p.evaluate(() => (window as any).__ather.rin()?.phase)
check('the cast went out', phase !== 'idle', String(phase))
const peak = Math.max(...ys.filter(([t]) => t < 9000).map(([, y]) => y))
check('the cast swings the mitt up', peak > rest.y + 0.08, `rest y ${rest.y.toFixed(3)}, peak ${peak.toFixed(3)} (${ys.length} samples, ${ys.map(([t, y]) => `${t}:${y.toFixed(2)}`).join(' ')})`)
while (Date.now() - at < 11500) { await frame(); await sleep(150) }
for (let i = 0; i < 4; i++) { await frame(); await sleep(150) }
const after = await R()
check('and settles back to rest', Math.abs(after.y - rest.y) < 0.03, `y ${after.y.toFixed(3)} vs rest ${rest.y.toFixed(3)}`)
check('the rod stays in the mitt through the wait', !!(await tip()))
await frame('4-waiting')
// stow: number key of an empty slot puts the bait away
await p.keyboard.press('Digit8'); for (let i = 0; i < 4; i++) { await frame(); await sleep(150) }
check('stowing takes the rod away', (await tip()) === null)
check('no page errors', errs.length === 0, errs.join(' | '))
const pass = results.every(r => r[1])
console.log(pass ? `PASS: ${results.length} checks, shots in ${out}` : `FAIL: ${results.filter(r => !r[1]).map(r => r[0]).join(', ')}`)
await br.close(); process.exit(pass ? 0 : 1)
