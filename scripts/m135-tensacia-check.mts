// ── BETA M135 s1: TENSACIA, the ladder's fifth tree (RULED athernyx 4d65536; Greenscale signed 98e7f1c) ──
// READ ONLY against prod (ather.games is Alex's live save; the real World Builder store is never written):
//   owner (1280x900, owner key, this box only): Fly on the Wilds, P opens Scenery mode, the palette (E) has the "Tensacia node" and
//     no other node; the real store is hashed before + after: unchanged (nothing is placed or saved).
//   keeper (FRESH, no owner key, desktop 1280x900): the SCRATCH world = the real live Wilds layer + N Tensacia nodes the check adds
//     beside Greg's waymark, served to this one tab only (m85-scenery-check's trick). A Starwillow Pruner with a Venium edge in hand
//     (stated): the prompt asks Tensacia's own 42 mana, each node is worked to the end, the yield lies on the ground, walked up =
//     Tensacia logs every time and, SOMETIMES, a Greenscale (30% a node, so N nodes all without one is ~0.7^N). Then the edge is taken
//     off (stated): the same tree asks 300 mana (one rung short = slow, never a wall). 0 page errors.
//   OWNER_KEY=... npx tsx scripts/m135-tensacia-check.mts [--url https://ather.games] [--out dir] [--n 10] [--skip-owner]
import puppeteer, { type Page } from 'puppeteer-core'
import { createHash } from 'crypto'
import { readFileSync, existsSync, mkdirSync } from 'node:fs'
import { aimAt } from './lib/aim.mts'
import { collect, lootOf } from './lib/loot.mts'
import { dismissStartCard } from './lib/start-card.mts'
import { EDGE } from '../src/app/shimmer/open/ather/edges'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/m135-tensacia-check'), N = Number(flag('--n', '10'))
mkdirSync(out, { recursive: true })
const KEY = process.env.OWNER_KEY || (existsSync('.env') ? /OWNER_KEY=(.+)/.exec(readFileSync('.env', 'utf8'))?.[1]?.trim() : undefined)
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16)
type W = any
const errs: string[] = []
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const tiles = (JSON.parse(readFileSync('public/open/wilds/tiles.json', 'utf8')) as { tiles: { name: string; tx: number; ty: number }[] }).tiles
const g = tiles.find(t => t.name === 'first-wilds')!
const B = { x: g.tx * 1000 - 300 + 10, z: g.ty * 1000 + 300 - 8 }   // beside Greg's waymark (m85's flat spot)

try {
  // ── 1. owner: the Wilds kit has the Tensacia node (nothing placed, nothing saved) ──
  if (!process.argv.includes('--skip-owner')) {
    if (!KEY) throw new Error('no OWNER_KEY (or pass --skip-owner)')
    const owner = await br.createBrowserContext(), o = await owner.newPage()
    o.on('pageerror', e => errs.push('editor: ' + String(e).slice(0, 200)))
    await o.setViewport({ width: 1280, height: 900 }); await o.evaluateOnNewDocument('window.__name = (f) => f')
    await o.goto(`${url}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'domcontentloaded', timeout: 120000 })
    await o.goto(`${url}/shimmer/open/wilds-edits`, { waitUntil: 'domcontentloaded', timeout: 120000 })
    const store = () => o.evaluate(async () => (await fetch('/shimmer/save-builder?map=wilds', { cache: 'no-store' })).json()) as Promise<any>
    const hs = (s: any) => ({ draft: hash(s.draft), live: hash(s.live), v: s.index?.live, n: s.index?.versions?.length })
    const h0 = hs(await store())
    // every POST to the builder store is refused in the page (this check never writes)
    await o.setRequestInterception(true)
    o.on('request', r => { if (r.method() === 'POST' && r.url().includes('/shimmer/save-builder')) r.respond({ status: 409, contentType: 'application/json', body: '{"error":"m135 check is read-only"}' }); else r.continue() })
    await o.goto(`${url}/shimmer/dev?mode=terrain&map=wilds`, { waitUntil: 'load', timeout: 240000 })
    await o.waitForFunction('window.__terrain?.ready === true && window.__terrain?.map === "wilds"', { timeout: 240000, polling: 500 })
    await o.click('[data-testid="view-fly"]')
    await o.waitForFunction('typeof window.__builderFly?.drawnAt === "function" && window.__builderFly.scene().tiles > 0', { timeout: 180000, polling: 500 })
    await o.evaluate((a: number, b: number) => { const t = (window as W).__terrain, h = t.heightAt(a, b); (window as W).__builderFly.setCam({ x: a, z: b + 10, y: (Number.isFinite(h) ? h : 5) + 7, yaw: 0, pitch: -0.6, top: false }) }, B.x, B.z)
    await sleep(3000)
    await o.keyboard.press('KeyP'); await sleep(800)
    ok(!!(await o.evaluate(() => (window as W).__terrain.place?.on)), '1. P opens Scenery mode on the Wilds')
    await o.keyboard.press('KeyE'); await sleep(900)
    const items = await o.$$eval('[data-testid^="place-item-"]', a => a.map(e => (e as HTMLElement).dataset.testid!.slice(11)))
    const label = await o.$eval('[data-testid="place-item-node:tensacia"]', e => (e as HTMLElement).innerText || e.getAttribute('title') || '').catch(() => '')
    ok(items.includes('node:tensacia'), `1. the Wilds kit has the Tensacia node (${items.length} kinds; "${label.replace(/\s+/g, ' ').trim()}")`)
    ok(items.filter(k => k.startsWith('node:')).join() === 'node:tensacia', `1. ...and no other node (${items.filter(k => k.startsWith('node:')).join()})`)
    await o.screenshot({ path: `${out}/a-kit.png` }).catch(() => {})
    await o.setRequestInterception(false)
    ok(JSON.stringify(hs(await store())) === JSON.stringify(h0), `1. the REAL builder store is untouched (${JSON.stringify(h0)})`)
    await owner.close()
  }

  // ── 2. a fresh keeper in the scratch world: N Tensacia nodes beside Greg's waymark ──
  const liveTxt = await (await fetch(`${url}/shimmer/open/wilds-edits`, { cache: 'no-store' } as any)).text()
  const live = JSON.parse(liveTxt)
  const nodes = Array.from({ length: N }, (_, i) => ({ id: `n${(9e6 + i).toString(36)}`, k: 'node:tensacia', x: B.x + 6 + (i % 5) * 9, z: B.z + 12 + Math.floor(i / 5) * 12, q: 0, s: 1 }))
  const spare = { id: `n${(9e6 + 99).toString(36)}`, k: 'node:tensacia', x: B.x + 6, z: B.z + 40, q: 0, s: 1 }   // left unworked for step 5
  const scratch = JSON.stringify({ ...live, props: [...(live.props ?? []), ...nodes, spare] })
  const ctx = await br.createBrowserContext(), kp = await ctx.newPage(); await kp.setViewport({ width: 1280, height: 900 })
  kp.on('pageerror', e => errs.push('keeper: ' + String(e).slice(0, 200)))
  await kp.setRequestInterception(true)
  kp.on('request', r => { if (r.method() === 'GET' && r.url().includes('/shimmer/open/wilds-edits')) r.respond({ status: 200, contentType: 'application/json', body: scratch }); else r.continue() })
  await kp.evaluateOnNewDocument('window.__name = (f) => f')
  const tool = (edge: boolean) => JSON.stringify({ forestry: { toolId: 'starwillow_blade', usesRemaining: 200, speedBonus: 0.8, xpBonus: 1.35, ...(edge ? { edge: { on: 'venium', left: { venium: EDGE.venium.uses } } } : {}) } })
  await kp.evaluateOnNewDocument((t: string) => {
    if (sessionStorage.getItem('m135')) return
    sessionStorage.setItem('m135', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    localStorage.setItem('open.tutorial.v1', JSON.stringify({ v: 1, live: false, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], b2: 'accepted', baitDay: null }))
    for (const k of ['open.pruned.v1', 'open.gather.v1', 'open.loot.v1', 'open.skills.v1', 'open.inv.v1']) localStorage.removeItem(k)
    localStorage.setItem('open.tools.v1', t)
  }, tool(true))
  await kp.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
  await dismissStartCard(kp).catch(() => false)
  const A = <T,>(fn: string, ...a: unknown[]) => kp.evaluate((f: string, x: unknown[]) => (window as W).__ather?.[f]?.(...x), fn, a) as Promise<T>
  await kp.waitForFunction(() => (window as W).__ather?.wildsLoaded?.().length > 0 && !!(window as W).__ather?.gather, { timeout: 240000, polling: 1000 }); await sleep(2000)
  const greg = { id: 'greg', tile: 'first-wilds', x: -300, y: 0, z: 300, biome: 0, made: 0 }
  for (let i = 0; i < 6 && (await A('zone')) !== 'wilds'; i++) { await A('travel', { kind: 'waymark', w: greg }); for (let k = 0; k < 30 && (await A('zone')) !== 'wilds'; k++) await sleep(1000) }
  ok((await A('zone')) === 'wilds', '2. a fresh keeper (no owner key, 1280x900, Starwillow Pruner + Venium edge) is in the Wilds')
  await sleep(3000)
  const frame = async () => { try { await kp.screenshot({ path: `${out}/_f.png`, clip: { x: 0, y: 0, width: 64, height: 64 } }) } catch { /* slow */ } }
  const bag = async () => ((JSON.parse(await kp.evaluate(() => localStorage.getItem('open.inv.v1') ?? 'null') ?? 'null')?.slots ?? []) as ({ id: string; n: number } | null)[]).filter(Boolean) as { id: string; n: number }[]
  const count = async (id: string) => (await bag()).reduce((a, s) => a + (s.id === id ? s.n : 0), 0)
  const text = () => kp.evaluate(() => document.body.innerText)
  const saw = async (re: RegExp, n = 24) => { for (let i = 0; i < n; i++) { const m = (await text()).match(re); if (m) return m[0]; await frame(); await sleep(250) } return '' }
  const idOf = (n: { id: string }) => `glade:${n.id}:tensacia`
  const aimed = async (n: { x: number; z: number; id: string }) => {
    for (let i = 0; i < 6; i++) {
      await A('tp', n.x, n.z + 6, 0); await sleep(1200); await frame()
      for (let j = 0; j < 4; j++) { await aimAt(kp, n.x, n.z, 1.2); await frame(); if (await A('aim') === idOf(n)) return true; await sleep(400) }
    }
    return false
  }
  const prompt = (await (async () => { await aimed(nodes[0]); return saw(/prune the Tensacia \(\d+ mana\)/i) })())
  ok(/\(42 mana\)/.test(prompt), `3. a placed Tensacia is aimed, and with the edge it asks its own 42 mana ("${prompt}")`)
  await kp.screenshot({ path: `${out}/b-keeper-tensacia.png` }).catch(() => {})
  let worked = 0, logsTotal = 0, greens = 0, withG = 0
  for (const n of nodes) {
    if (!(await aimed(n))) { console.log(`   ${n.id}: not under the crosshair`); continue }
    await A('setMana', 100); const l0 = await count('tensacia_log'), g0 = await count('greenscale')
    await A('prune')
    for (let i = 0; i < 300 && await A('chan'); i++) await frame()
    await frame(); await sleep(500)
    const lying = await lootOf(kp); await collect(kp, frame); await sleep(400)
    const dl = (await count('tensacia_log')) - l0, dg = (await count('greenscale')) - g0
    if (dl > 0) worked++
    logsTotal += dl; greens += dg; if (dg > 0) withG++
    console.log(`   ${n.id}: +${dl} Tensacia logs, +${dg} Greenscale (lying first: ${lying.map(d => `${d.item}x${d.n}`).join(' ')})`)
    if (worked === 1) await kp.screenshot({ path: `${out}/c-keeper-yield.png` }).catch(() => {})
  }
  ok(worked === N && logsTotal >= 2 * N && logsTotal <= 4 * N, `4. all ${N} worked to the end with the edged pruner: ${logsTotal} Tensacia logs (2-4 each)`)
  ok(withG >= 1 && withG < N, `4. Greenscale SOMETIMES: ${withG} of ${N} nodes dropped one (${greens} in all)`)
  const tf = (await bag()).map(s => `${s.id}x${s.n}`).join(' ')
  console.log(`   bag: ${tf}`)
  // 5. edge off (stated): one rung short = 300, slow, still workable
  await kp.evaluate((t: string) => { localStorage.setItem('open.tools.v1', t); window.dispatchEvent(new Event('open:tools')) }, tool(false))
  await kp.evaluate(() => sessionStorage.setItem('m135', '1'))
  await kp.reload({ waitUntil: 'load', timeout: 240000 }); await dismissStartCard(kp).catch(() => false)
  await kp.waitForFunction(() => (window as W).__ather?.wildsLoaded?.().length > 0 && !!(window as W).__ather?.gather, { timeout: 240000, polling: 1000 }); await sleep(2000)
  for (let i = 0; i < 6 && (await A('zone')) !== 'wilds'; i++) { await A('travel', { kind: 'waymark', w: greg }); for (let k = 0; k < 30 && (await A('zone')) !== 'wilds'; k++) await sleep(1000) }
  const p1 = (await (async () => { await aimed(spare); return saw(/prune the Tensacia \(\d+ mana\)/i) })())
  ok(/\(300 mana\)/.test(p1), `5. edge off: the bare Starwillow Pruner is one rung short, so the same tree asks 300 (slow, not a wall) ("${p1}")`)
  const p2 = (await (async () => { await aimed(nodes[0]); return saw(/Tensacia[^\n]{0,60}/) })())
  ok(/regrowing/i.test(p2), `5. a worked Tensacia stays spent after a reload ("${p2}")`)
  await kp.screenshot({ path: `${out}/d-keeper-spent.png` }).catch(() => {})
  await ctx.close()
} catch (e) { ok(false, 'threw: ' + String(e).slice(0, 300)) }
ok(errs.length === 0, `0 page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
await br.close()
console.log(fails ? `\n${fails} FAILED` : '\nPASS'); process.exit(fails ? 1 : 0)
