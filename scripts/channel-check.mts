// ── GATHERING BY CHANNEL, PLAYED (2026-11-17, play / Jin 30bbef32; Alex: "the correct tool auto selects and spawns on the
// node chipping at it until the node is depleted"). A keeper, stowed, prunes a lone goldwood from 6 m: the channel starts
// (the focus is at the node), a chip lands logs in the bag, the keeper WALKS OFF after the first chip (it lets go, the tree is
// NOT spent, the logs stay), comes back and E resumes the SAME work (done count carries on), and it runs to the last chip
// (the tree is pruned, every chip's logs are in the bag). Hooks: movement, reading, __ather.prune (the click's own path),
// __ather.chan.   npx tsx scripts/channel-check.mts [--url http://localhost:3203] [--out dir]
import { collect } from './lib/loot.mts'
import puppeteer from 'puppeteer-core'
import { aimAt } from './lib/aim.mts'
import { loneTree } from './lib/lone-tree.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const out = flag('--out', '/tmp'), url = flag('--url', 'https://ather.games')
// M133: the pick reads the GAME'S ground (lib/lone-tree.mts): the old one stood the keeper in a cloud void pit
const gold = loneTree('goldwood'), oak = loneTree('shimmeroak')
const res: Record<string, unknown> = { gold: gold?.id, oak: oak?.id }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const p = await br.newPage(); await p.setViewport({ width: 1100, height: 680 })
await p.evaluateOnNewDocument(() => { localStorage.setItem('ather:shimmer:birthRune', 'star'); localStorage.setItem('open.tutorial.v1', JSON.stringify({ v: 1, live: false, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], b2: 'accepted', baitDay: null }));   /* M68 s3a: past the tutorial, so the worn pruner + spike are lit */  localStorage.removeItem('open.pruned.v1'); localStorage.removeItem('open.gather.v1'); localStorage.removeItem('open.skills.v1'); localStorage.removeItem('open.inv.v1') })
await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 120000 })
await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 120000 }); await sleep(2000)
for (let i = 0; i < 20 && (await p.evaluate(() => (window as any).__ather.zone())) !== 'wilds'; i++) { await p.evaluate(() => (window as any).__ather.travel({ kind: 'waymark', w: { id: 'greg', tile: 'first-wilds', x: -300, y: 0, z: 300, biome: 2, made: 0 } })); await sleep(4000) }   // the index can still be loading: re-send
await sleep(9000)
// stand `d` metres east of a tree, facing it (yaw π/2 looks west), so the crosshair sits on the trunk
// ⚠ headless renders a frame only when asked (a screenshot forces one): the aim is computed IN the frame loop, so read it
// after a forced frame or it is the PREVIOUS spot's answer (the first runs read every aim one view late, 11-15)
const frame = async () => { try { await p.screenshot({ path: `${out}/_frame.png` }) } catch { /* slow frame */ } }
const aimFrom = async (t: { x: number; z: number }, d: number) => { await p.evaluate((x, z) => (window as any).__ather.tp(x, z, Math.PI / 2), t.x + d, t.z); await sleep(3000); for (let i = 0; i < (d < 10 ? 25 : 2); i++) { await aimAt(p, t.x, t.z, 1.0); await frame(); if (await p.evaluate(() => (window as any).__ather.aim())) break; await sleep(500) } }
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
await sleep(1500); await frame(); await frame(); await collect(p, frame)   // M141: the yield lies on the ground
res.finished = { chan: await chan(), logs: await logs(), pruned: await pruned() }
try { await p.screenshot({ path: `${out}/ch-2-done.png` }) } catch { /* slow frame */ }
console.log(JSON.stringify(res))
const s = res.started as { id: string; done: number; of: number } | null, o = res.oneFrame as { chan: typeof s; pruned: boolean }
const wo = res.walkedOff as { chan: typeof s; logs: number; pruned: boolean }, r = res.resumed as typeof s, f = res.finished as typeof wo
const pass = res.aim === gold.id && s?.id === gold.id && s.done === 0 && s.of === 1
  && !o.pruned && !!o.chan && wo.chan === null && !wo.pruned && wo.logs === 0   /* M136: nothing drops before the end */
  && r?.id === gold.id && r.done > 0 && r.done < r.of && r.of === s.of && f.chan === null && f.pruned && f.logs >= 2 && f.logs <= 4
console.log(pass ? 'PASS: E on a goldwood → it drains into it → walking off lets go (tree not spent, progress kept, nothing dropped) → E resumes the SAME work → the end pays it all' : 'FAIL')
await br.close(); process.exit(pass ? 0 : 1)
