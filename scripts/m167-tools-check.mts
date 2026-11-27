// ── M167 / M230: THE WORN PRUNER + WORN SPIKE IN THE LIVE GAME (Alex 11-27: "the worn tools look the same i think..?") ──
// The first M167 check drove the old voxel3d harness, which the live open game does not render, so it passed while the game
// still showed the placeholder. This one plays the LIVE game: a newborn whom Greg has just sent to the four (open.tutorial.v1
// live, only the grimoire), in the real page, at 1100x760 and 390x844:
//   1. the spike + pruner sockets start EMPTY
//   2. Otto: the real prompt, the real E / use tap, every "And then?" pressed -> the Worn Spike is lit (__ather.tools())
//   3. Bonn, the same -> the Worn Pruner is lit
//   4. the HUD dial shows the locked glyphs (data-tool-glyph m167-pruner / m167-spike); the bag holds NO tool (tools live in
//      the sockets, inventory.ts: a worn_blade is taken back out of any bag), so the dial IS the tool's 2D picture
//   5. at a Glade crystal: E (the phone's use) works it, and the focus hanging at the node is the M167 model by name
//      (window.__channelFocus().look === 'm167-worn-spike', every part of it), not the placeholder shard
//   6. at a Glade Goldwood: the same, 'm167-worn-pruner'
//   7. 0 page errors. Shots of both focuses at the node per viewport into --out.
//   npx tsx scripts/m167-tools-check.mts [--url https://ather.games] [--out docs/looks/m230-2026-11-27] [--only 390|desktop]
import puppeteer, { type Page } from 'puppeteer-core'
import { mkdirSync } from 'fs'
import * as THREE from 'three'
import { ANSWERS } from '../src/app/shimmer/open/ather/greg-talk'
import { line } from '../src/app/shimmer/open/ather/glade-tutorial-lines'
import { friendBye, friendStart, friendScript, nodeBeside } from '../src/app/shimmer/open/ather/glade-friend-talk'
import { parseTut } from '../src/app/shimmer/open/ather/glade-tutorial'
import { gladeNodes } from '../src/app/shimmer/open/ather/glade-nodes'
import { parseGladeLayer } from '../src/app/shimmer/open/ather/glade-layer'
import { buildWornTool, WORN_NAME } from '../src/app/shimmer/voxel3d/worn-tools'
import { aimAt } from './lib/aim.mts'
import { dismissStartCard } from './lib/start-card.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', 'docs/looks/m230-2026-11-27'), only = flag('--only', '')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
// the tree's own part counts: the model at the node must be ALL of the locked model, not a name on a stub
const part = (pa: THREE.Object3D, geo: THREE.BufferGeometry, c: number, sx: number, sy: number, sz: number, x: number, y: number, z: number) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: c })); m.scale.set(sx, sy, sz); m.position.set(x, y, z); pa.add(m); return m }
const PARTS = { pruner: buildWornTool('pruner', new THREE.Group(), part, new THREE.BoxGeometry(), new THREE.SphereGeometry()).children.length, spike: buildWornTool('spike', new THREE.Group(), part, new THREE.BoxGeometry(), new THREE.SphereGeometry()).children.length }
console.log(`tree: ${WORN_NAME.pruner}/${PARTS.pruner}, ${WORN_NAME.spike}/${PARTS.spike}`)
const SENT = { v: 1, live: true, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: [], gifts: ['grimoire'], b2: 'none', baitDay: null }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const poll = async (f: () => Promise<boolean>, ms = 60000) => { for (let t = 0; t < ms; t += 500) { if (await f().catch(() => false)) return true; await sleep(500) } return false }
const A = (p: Page, fn: string, ...args: unknown[]) => p.evaluate((f: string, a: unknown[]) => (window as any).__ather?.[f]?.(...a), fn, args)
const frame = (p: Page) => p.evaluate('new Promise(r => { let k = 3; (function t() { if (--k <= 0) r(0); else requestAnimationFrame(t) })() })')
const layer = gladeNodes(parseGladeLayer(await (await fetch(`${url}/shimmer/open/glade-edits`, { cache: 'no-store' })).json()).props ?? [], () => 0)
const crystal = layer.crystals.find(c => c.kind === 'raw') ?? layer.crystals[0], tree = layer.trees.find(t => t.kind === 'goldwood') ?? layer.trees[0]
console.log(`nodes: crystal ${crystal?.id}, tree ${tree?.id}`)

async function run(label: string, phone: boolean) {
  console.log(`── ${label}`)
  const errs: string[] = []
  const ctx = await br.createBrowserContext(), p = await ctx.newPage()
  if (phone) await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); else await p.setViewport({ width: 1100, height: 760 })
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument((t: string) => {
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('open.tutorial.v1', t) }
  }, JSON.stringify(SENT))
  const tapText = async (text: string) => {
    const box = await p.evaluate((t: string) => {
      for (const e of document.querySelectorAll<HTMLElement>('[data-talk-option]')) {
        if ((e.textContent ?? '').replace(/^\s*›\s*/, '').trim() !== t) continue
        const r = e.getBoundingClientRect(); if (r.width < 4 || r.height < 4) continue
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
      }
      return null
    }, text)
    if (!box) return false
    if (phone) await p.touchscreen.tap(box.x, box.y); else await p.mouse.click(box.x, box.y)
    return true
  }
  const pressE = async () => {
    if (phone) { const u = await p.$('[data-touch="use"]'); const b = await u?.boundingBox(); if (b) { await p.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); return } }
    await p.keyboard.press('KeyE')
  }
  try {
    await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
    await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 }); await sleep(2000)
    try { await dismissStartCard(p) } catch (e) { console.log('  (start card: ' + String(e).slice(0, 120) + ')') }
    if ((await A(p, 'zone')) !== 'glade') await A(p, 'travel', { kind: 'glade' })
    ok(await poll(async () => (await A(p, 'zone')) === 'glade', 60000), `${label} 0. in the Glade`)
    await poll(() => p.evaluate(() => !!(window as any).__glade?.keepers), 30000)
    const tools = () => A(p, 'tools') as Promise<Record<string, { toolId: string } | undefined>>
    const t0 = await tools()
    ok(!t0.forestry && !t0.prospecting, `${label} 1. a newborn's sockets start empty (${t0.forestry?.toolId ?? '-'}, ${t0.prospecting?.toolId ?? '-'})`)
    const keepers = Object.fromEntries(((await p.evaluate(() => (window as any).__glade.keepers)) as { id: string; x: number; z: number; yaw: number }[]).map(k => [k.id, k]))
    const talk = async (id: 'otto' | 'bonn', name: string) => {
      const k = keepers[id], x = k.x + Math.sin(k.yaw) * 2, z = k.z + Math.cos(k.yaw) * 2
      await A(p, 'gladeAt', x, z, Math.atan2(-(k.x - x), -(k.z - z)))
      await poll(async () => { const n = await A(p, 'near') as { kind?: string; f?: string } | null; return n?.kind === 'friend' && n.f === id }, 15000)
      let calm = 0
      await poll(async () => { calm = await p.evaluate(() => document.querySelector<HTMLElement>('[data-veil]')?.style.opacity === '0') ? calm + 1 : 0; return calm >= 4 }, 30000)
      await pressE()
      const ids = [...friendScript(friendStart(parseTut(SENT)!, id, nodeBeside(id, k as any, layer)))]
      for (const lid of ids) {
        await poll(async () => (await p.evaluate(() => document.body.innerText)).includes(line(lid)), 10000)
        await tapText(lid === ids[ids.length - 1] ? friendBye(id) : ANSWERS.more); await sleep(700)
      }
      await tapText(friendBye(id)); await sleep(800)
    }
    await talk('otto', 'Otto')
    ok(await poll(async () => (await tools()).prospecting?.toolId === 'worn_spike', 10000), `${label} 2. Otto lit the Worn Spike (${(await tools()).prospecting?.toolId ?? '-'})`)
    await talk('bonn', 'Bonn')
    ok(await poll(async () => (await tools()).forestry?.toolId === 'worn_blade', 10000), `${label} 3. Bonn lit the Worn Pruner (${(await tools()).forestry?.toolId ?? '-'})`)
    const glyphs = await p.evaluate(() => [...document.querySelectorAll('[data-tool-glyph]')].map(e => e.getAttribute('data-tool-glyph')))
    // the phone draws no dials (hearth-hud-layer: tool pips on the bar's lip, no picture); any tool glyph drawn is the locked one
    ok(glyphs.every(g => g === 'm167-pruner' || g === 'm167-spike') && (phone || (glyphs.includes('m167-pruner') && glyphs.includes('m167-spike'))), `${label} 4. ${phone ? 'no tool picture but the locked one (the phone has pips, no dials)' : 'the dial shows the locked glyphs'} (${[...new Set(glyphs)].join(',') || 'none'})`)
    const bag = await p.evaluate(() => JSON.parse(localStorage.getItem('open.inv.v1') ?? 'null')?.slots ?? []) as ({ id: string } | null)[]
    ok(!bag.some(s => s && /^worn_|pruner|spike/.test(s.id)), `${label} 4. the bag holds no tool (tools sit in the sockets; the dial is their picture)`)

    const work = async (node: 'crystal' | 'tree', n: { id: string; x: number; z: number }, want: string, parts: number, step: string) => {
      await A(p, 'setMana', 100)
      const h = node === 'tree' ? 1.2 : 0.5, aimed = async () => node === 'tree' ? (await A(p, 'aim')) === n.id : ((await A(p, 'crystal')) as { id: string } | null)?.id === n.id
      let on = false
      for (let k = 0; k < 4 && !on; k++) {
        await A(p, 'gladeAt', n.x, n.z + 4.5, 0); await sleep(2500)
        for (let i = 0; i < 12 && !(await aimed()); i++) { await aimAt(p, n.x, n.z, h); await frame(p); await sleep(300) }
        if (!(await aimed())) continue
        await pressE()
        on = await poll(async () => !!(await A(p, 'chan')), 6000)
      }
      ok(on, `${label} ${step}. ${node} ${n.id}: worked (E / use)`)
      let seen: { node: string | null; look: string | null; parts: number } | null = null
      await poll(async () => { seen = await p.evaluate(() => (window as any).__channelFocus?.() ?? null); await frame(p); return !!seen && seen.look === want }, 8000)
      ok(!!seen && seen!.node === node && seen!.look === want && seen!.parts === parts, `${label} ${step}. the focus at the ${node} is ${want}/${parts} (saw ${JSON.stringify(seen)})`)
      await p.screenshot({ path: `${out}/${label}-${node}.png` }).catch(() => {})
      if (await A(p, 'chan')) { await A(p, node === 'tree' ? 'prune' : 'mine'); await sleep(500) }
    }
    if (crystal) await work('crystal', crystal, WORN_NAME.spike, PARTS.spike, '5'); else ok(false, `${label} 5. no Glade crystal in the live layer`)
    if (tree) await work('tree', tree, WORN_NAME.pruner, PARTS.pruner, '6'); else ok(false, `${label} 6. no Glade tree in the live layer`)
  } catch (e) { ok(false, `${label} threw: ${String(e).slice(0, 300)}`) }
  ok(errs.length === 0, `${label} 7. 0 page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
  await ctx.close().catch(() => {})
}
try {
  if (only !== 'desktop') await run('390', true)
  if (only !== '390') await run('desktop', false)
} finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
