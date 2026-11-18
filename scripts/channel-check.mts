// ── GATHERING BY CHANNEL, PLAYED (2026-11-17, play / Jin 30bbef32; Alex: "the correct tool auto selects and spawns on the
// node chipping at it until the node is depleted"). A keeper, stowed, prunes a lone goldwood from 6 m: the channel starts
// (the focus is at the node), a chip lands logs in the bag, the keeper WALKS OFF after the first chip (it lets go, the tree is
// NOT spent, the logs stay), comes back and E resumes the SAME work (done count carries on), and it runs to the last chip
// (the tree is pruned, every chip's logs are in the bag). Hooks: movement, reading, __ather.prune (the click's own path),
// __ather.chan.   npx tsx scripts/channel-check.mts [--url http://localhost:3203] [--out dir]
import puppeteer from 'puppeteer-core'
import { readFileSync } from 'fs'
import { parseWilds, type WildsMeta } from '../src/app/shimmer/open/ather/wilds'
import { TRUNK, type Zone } from '../src/app/shimmer/open/ather/forestry'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const out = flag('--out', '/tmp'), url = flag('--url', 'https://ather.games')
const D = 'public/open/wilds/', idx = JSON.parse(readFileSync(D + 'tiles.json', 'utf8'))
const zm = new Map<string, Zone>(idx.tiles.find((t: { name: string }) => t.name === 'first-wilds').nodes.map((n: { i: number; j: number; zone: Zone }) => [`${n.i},${n.j}`, n.zone]))
const b = readFileSync(D + 'first-wilds.bin'), bio = readFileSync(D + 'first-wilds.biome')
const W = parseWilds(JSON.parse(readFileSync(D + 'first-wilds.json', 'utf8')) as WildsMeta, new Int16Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), new Uint8Array(bio), (i, j) => zm.get(`${i},${j}`) ?? 'meadows')
// a tree with a CLEAR LINE on its east side (no trunk within 15 m east and 3 m either side, none within 3 m), so the
// walker can stand 6 or 14 m east of it and the crosshair meets it first. ⚠ The first cut only checked 3 m round the
// tree and stood the camera inside a neighbouring shimmeroak's trunk (11-15).
const lone = (k: string) => W.trees.find(t => t.kind === k && !W.trees.some(o => o !== t && (Math.hypot(o.x - t.x, o.z - t.z) < 3 || (o.x > t.x && o.x < t.x + 15 && Math.abs(o.z - t.z) < 3))) && Math.abs(t.x) < 400 && Math.abs(t.z) < 400)!
const gold = lone('goldwood'), oak = lone('shimmeroak')
const res: Record<string, unknown> = { gold: gold?.id, oak: oak?.id }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const p = await br.newPage(); await p.setViewport({ width: 1100, height: 680 })
await p.evaluateOnNewDocument(() => { localStorage.setItem('ather:shimmer:birthRune', 'star'); localStorage.removeItem('open.pruned.v1'); localStorage.removeItem('open.skills.v1'); localStorage.removeItem('open.inv.v1') })
await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 120000 })
await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 120000 }); await sleep(2000)
await p.evaluate(() => (window as any).__ather.travel({ kind: 'waymark', w: { id: 'greg', tile: 'first-wilds', x: -300, y: 0, z: 300, biome: 2, made: 0 } }))
await sleep(9000)
// stand `d` metres east of a tree, facing it (yaw π/2 looks west), so the crosshair sits on the trunk
// ⚠ headless renders a frame only when asked (a screenshot forces one): the aim is computed IN the frame loop, so read it
// after a forced frame or it is the PREVIOUS spot's answer (the first runs read every aim one view late, 11-15)
const frame = async () => { try { await p.screenshot({ path: `${out}/_frame.png` }) } catch { /* slow frame */ } }
const aimFrom = async (t: { x: number; z: number }, d: number) => { await p.evaluate((x, z) => (window as any).__ather.tp(x, z, Math.PI / 2), t.x + d, t.z); await sleep(3000); await frame(); await frame() }
await p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => d.textContent?.includes('Click to play')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' })
// FROM A DISTANCE (Alex 11-15: "click a tree from about 10 blocks out"): 6 m off, aim, prune (the click's own path)
const chan = () => p.evaluate(() => (window as any).__ather.chan?.() ?? null) as Promise<{ id: string; done: number; of: number } | null>
const logs = () => p.evaluate(() => (JSON.parse(localStorage.getItem('open.inv.v1') ?? '{"slots":[]}').slots as ({ id: string; n: number } | null)[]).reduce((a, s) => a + (s?.id === 'goldwood_log' ? s.n : 0), 0))
const pruned = () => p.evaluate(id => Object.keys(JSON.parse(localStorage.getItem('open.pruned.v1') ?? '{}')).includes(id), gold.id)
// ⚠ headless draws a frame only when asked, seconds apart, so EVERY frame lands a whole chip: the check never waits on
// pacing. It starts, takes ONE frame, walks off at once, and judges what the channel kept.
// 1. start from 6 m: the channel is on this tree
await aimFrom(gold, 6)
res.aim = await p.evaluate(() => (window as any).__ather.aim())
await p.evaluate(() => (window as any).__ather.prune())
res.started = await chan()
await frame()
res.oneFrame = { chan: await chan(), pruned: await pruned() }
// 2. walk off (20 m) at once: it lets go; the tree is not spent; what landed stays
await p.evaluate((x, z) => (window as any).__ather.tp(x, z, Math.PI / 2), gold.x + 20, gold.z); await sleep(800); await frame(); await frame(); await sleep(1500); await frame()
res.walkedOff = { chan: await chan(), logs: await logs(), pruned: await pruned() }
// 3. back, E again: the SAME work resumes (its done count carries on) and runs to the last chip
await aimFrom(gold, 6)
await p.evaluate(() => (window as any).__ather.prune())
res.resumed = await chan()
for (let i = 0; i < 120 && await chan(); i++) await frame()
await sleep(1500); await frame(); await frame()
res.finished = { chan: await chan(), logs: await logs(), pruned: await pruned() }
try { await p.screenshot({ path: `${out}/ch-2-done.png` }) } catch { /* slow frame */ }
console.log(JSON.stringify(res))
const s = res.started as { id: string; done: number; of: number } | null, o = res.oneFrame as { chan: typeof s; pruned: boolean }
const wo = res.walkedOff as { chan: typeof s; logs: number; pruned: boolean }, r = res.resumed as typeof s, f = res.finished as typeof wo
const pass = res.aim === gold.id && s?.id === gold.id && s.done === 0 && s.of >= 3
  && !o.pruned && !!o.chan && wo.chan === null && !wo.pruned && wo.logs >= 1
  && r?.id === gold.id && r.done >= 1 && r.done < r.of && r.of === s.of && f.chan === null && f.pruned && f.logs >= 2 && f.logs <= 5
console.log(pass ? 'PASS: E on a goldwood → the channel chips it → walking off lets go (tree not spent, logs kept) → E resumes the SAME work → the last chip prunes it' : 'FAIL')
await br.close(); process.exit(pass ? 0 : 1)
