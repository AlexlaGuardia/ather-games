// M185 s1 (RULED athernyx c73ab4e): the four gems replace the Wilds' element crystals and the spike ladder is the pruner's.
// A fresh anonymous context seeded with an OLD save (a Mana Spike, the four old element crystals in the hotbar):
//   1. the spike dial holds the Goldwood Spike (the old Mana Spike's tier), stage 1, NO ring (Alex 11-26: steps 1-3 tint only)
//   2. the hotbar's old crystals read Aqual / Dinloid / Fuli / Rhyloid (nothing lost, nothing named Violet/Storm/Earth/Water)
//   3. the spike panel lists the four gems with the Goldwood numbers: Aqual + Dinloid 12 mana ok, Fuli + Rhyloid 300 slow
//   4. (desktop, unless --no-wilds) in the Wilds: an Aqual node's prompt says "Aqual (12 mana)", a Fuli node's "Fuli (300
//      mana)"; working the Aqual with the Goldwood spike finishes and pays an Aqual into the bag
//   npx tsx scripts/m185-gems-check.mts [--url https://ather.games] [--no-wilds] [--phone-only]
import puppeteer, { type Page } from 'puppeteer-core'
import { readFileSync, existsSync } from 'fs'
import { parseWilds, BIOME, type WildsMeta } from '../src/app/shimmer/open/ather/wilds'
import type { Zone } from '../src/app/shimmer/open/ather/forestry'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const origin = flag('--url', 'https://ather.games'), noWilds = process.argv.includes('--no-wilds'), phoneOnly = process.argv.includes('--phone-only'), deskOnly = process.argv.includes('--desk-only')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const ARGS = ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
const TUT = { v: 1, live: true, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: [], gifts: ['pruner', 'spike'], b2: 'none', baitDay: null, m70: 'none', m70node: null, m70side: 'none', folded: true }
const slots: ({ id: string; n: number } | null)[] = Array(32).fill(null)
;['water_crystal', 'earth_crystal', 'violet_crystal', 'storm_crystal'].forEach((id, i) => { slots[i] = { id, n: 3 } })
const BAG = { v: 1, slots, gifts: ['bait1'] }
const TOOLS = { prospecting: { toolId: 'mana_spike', usesRemaining: 7, speedBonus: 0.9, xpBonus: 1.1 } }

// two gem nodes with clear ground 5 m off (the page's own parser + the zone layer, as prospect-check)
type Pick = { tile: string; tx: number; ty: number; cx: number; cz: number; cy: number; s: number; sx: number; sz: number; sy: number; id: string }
// outcrop nodes (':o') first: a grid node (':c') can sit in a cloud void the page drops (M41), which the bare parser here keeps
function pickNode(kind: string): Pick | null { return pickNodeOf(kind, true) ?? pickNodeOf(kind, false) }
function pickNodeOf(kind: string, outcrop: boolean): Pick | null {
  const D = 'public/open/wilds/'
  const index = JSON.parse(readFileSync(D + 'tiles.json', 'utf8')) as { tiles: { name: string; tx: number; ty: number; nodes: { i: number; j: number; zone?: Zone }[] }[] }
  for (const t of index.tiles) {
    if (!existsSync(D + t.name + '.bin')) continue
    const meta = JSON.parse(readFileSync(D + t.name + '.json', 'utf8')) as WildsMeta
    const b = readFileSync(D + t.name + '.bin'), bio = readFileSync(D + t.name + '.biome')
    const zm = new Map(t.nodes.map(n => [`${n.i},${n.j}`, n.zone ?? 'meadows']))
    const W = parseWilds(meta, new Int16Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), new Uint8Array(bio), (i, j) => (zm.get(`${i},${j}`) ?? 'meadows') as Zone)
    for (const c of W.crystals) {
      if (c.kind !== kind || c.id.includes(':o') !== outcrop) continue
      for (let a = 0; a < 8; a++) {
        const sx = c.x + Math.cos(a * Math.PI / 4) * 5, sz = c.z + Math.sin(a * Math.PI / 4) * 5, sy = W.heightAt(sx, sz)
        if (W.biomeAt(sx, sz) === BIOME.water || sy < meta.waterY + 0.6 || Math.abs(sy - c.y) > 1.2) continue
        if (W.trees.some(tr => Math.hypot(tr.x - sx, tr.z - sz) < 2.5) || W.crystals.some(o => o !== c && Math.hypot(o.x - sx, o.z - sz) < 2.5)) continue
        return { tile: t.name, tx: t.tx, ty: t.ty, cx: c.x, cz: c.z, cy: c.y, s: c.s, sx, sz, sy, id: c.id }
      }
    }
  }
  return null
}

const readPanel = (p: Page) => p.evaluate(() => {
  const e = document.querySelector('[data-tool-panel]') as HTMLElement | null
  if (!e) return null
  return { name: e.querySelector('[data-panel-name]')?.textContent ?? '', rows: [...e.querySelectorAll('[data-node-row]')].map(r => { const x = (r as HTMLElement).dataset; return `${x.nodeRow}:${x.mana}:${x.verdict}` }) }
})

for (const [vp, w, h] of (phoneOnly ? [['phone', 390, 844]] : deskOnly ? [['desktop', 1280, 800]] : [['phone', 390, 844], ['desktop', 1280, 800]]) as [string, number, number][]) {
  const phone = vp === 'phone'
  const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: '/usr/bin/chromium-browser', args: ARGS })
  const p = await (await br.createBrowserContext()).newPage()
  await p.setViewport({ width: w, height: h, ...(phone ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 160)))
  await p.evaluateOnNewDocument((s: any) => {
    if (sessionStorage.getItem('m185-seeded')) return   // seed once: a reload must keep what the page saved
    sessionStorage.setItem('m185-seeded', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    localStorage.setItem('open.tutorial.v1', JSON.stringify(s.TUT))
    localStorage.setItem('open.rinquest.v1', JSON.stringify({ v: 1, state: 'done', step: 0 }))
    localStorage.setItem('open.tools.v1', JSON.stringify(s.TOOLS))
    localStorage.setItem('open.inv.v1', JSON.stringify(s.BAG))
    for (const k of ['open.mined.v1', 'open.gather.v1']) localStorage.removeItem(k)
  }, { TUT, TOOLS, BAG } as any)
  await p.goto(`${origin}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 240000 })
  for (let i = 0; i < 40; i++) { await sleep(2000); if (await p.$('[data-dial-btn="prospecting"]')) { await sleep(3000); break } }

  // 1. the dial
  const sel = phone ? '[data-pip]' : '[data-socket]'
  const dial = await p.evaluate((sel: string) => { const e = [...document.querySelectorAll(sel)].find(x => ((x as HTMLElement).dataset.socket ?? (x as HTMLElement).dataset.pip) === 'prospecting') as HTMLElement | undefined
    return e ? { held: e.dataset.held, stage: e.dataset.stage, tool: e.dataset.tool ?? '', ring: e.dataset.ring ?? '', arc: !!e.querySelector('[data-ring-arc]') } : null }, sel)
  ok(dial?.held === '1' && dial.stage === '1', `${vp}: the old Mana Spike loads as a stage-1 spike (${JSON.stringify(dial)})`)
  if (!phone) ok(dial?.tool === 'goldwood_spike', `${vp}: the spike dial holds goldwood_spike (${dial?.tool})`)
  ok(!!dial && !dial.arc && !dial.ring, `${vp}: no ring on the stage-1 spike (tint only, Alex 11-26)`)
  // the save itself now names the heir
  const saved = await p.evaluate(() => { try { return JSON.parse(localStorage.getItem('open.tools.v1') ?? 'null')?.prospecting?.toolId ?? '' } catch { return '' } })
  console.log(`  (saved prospecting tool after load: ${saved || 'not rewritten yet'})`)

  // 2. the bag's old crystals
  await p.keyboard.press('KeyI'); await sleep(1200)   // the bag (its slots carry the item names)
  const titles = await p.evaluate(() => [...document.querySelectorAll('[data-slot]')].map(e => e.getAttribute('title') ?? '').filter(t => t && t !== 'empty'))
  const want = ['Aqual × 3', 'Dinloid × 3', 'Fuli × 3', 'Rhyloid × 3']
  ok(want.every(x => titles.includes(x)), `${vp}: the bag's old crystals read as the gems (${titles.slice(0, 6).join(' | ')})`)
  ok(!titles.some(t => /Violet|Storm Crystal|Earth Crystal|Water Crystal/.test(t)), `${vp}: no old crystal name in the bag`)
  await p.keyboard.press('KeyI'); await sleep(800)

  // 3. the spike panel
  const el = await p.$('[data-dial-btn="prospecting"]'); if (el) { if (phone) await el.tap(); else await el.click() }
  let pn = null as Awaited<ReturnType<typeof readPanel>>
  for (let i = 0; i < 12 && !pn; i++) { await sleep(300); pn = await readPanel(p) }
  ok(pn?.name === 'Goldwood Spike', `${vp}: the panel names the Goldwood Spike (${pn?.name})`)
  ok(pn?.rows.join() === 'Raw Mana:6:ok,Aqual:12:ok,Dinloid:12:ok,Fuli:300:slow,Rhyloid:300:slow,Pure Mana Core:300:slow,Ather Crystal:1400:weak', `${vp}: Goldwood rows ${pn?.rows.join()}`)
  if (process.env.SHOT_DIR) await p.screenshot({ path: `${process.env.SHOT_DIR}/m185-panel-${vp}.png` }).catch(() => {})
  await p.keyboard.press('Escape'); await sleep(500)

  // 4. the Wilds (desktop)
  if (!phone && !noWilds) {
    const nodes = { water: pickNode('water'), violet: pickNode('violet') }
    ok(!!nodes.water && !!nodes.violet, `wilds: an Aqual and a Fuli node exist in the tiles (${nodes.water?.id} / ${nodes.violet?.id})`)
    await p.waitForFunction(() => !!(window as any).__ather?.mine, { timeout: 120000 })
    await p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => d.textContent?.includes('Click to play')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' })
    const frame = async () => { try { await p.screenshot() } catch { /* slow */ } }
    for (const [kind, name, mana] of [['water', 'Aqual', 12], ['violet', 'Fuli', 300]] as const) {
      const P = nodes[kind]; if (!P) continue
      for (let i = 0; i < 40 && ((await p.evaluate(() => (window as any).__ather.zone())) !== 'wilds' || i === 0); i++) {
        await p.evaluate((P) => (window as any).__ather.travel({ kind: 'waymark', w: { id: 'check', tile: P.tile, x: P.sx, y: P.sy, z: P.sz, biome: 4, made: 0 } }), P)
        await sleep(4000); if ((await p.evaluate(() => (window as any).__ather.zone())) === 'wilds' && i > 0) break
      }
      await sleep(8000)
      const TM = 1000, wx = P.sx + P.tx * TM, wz = P.sz + P.ty * TM, dx = P.cx + P.tx * TM - wx, dz = P.cz + P.ty * TM - wz
      const yaw = Math.atan2(-dx, -dz), pitch = -Math.atan2(P.sy + 1.6 - (P.cy + 0.55 * P.s), Math.hypot(dx, dz))
      let aimed: { id: string; kind: string } | null = null
      for (let i = 0; i < 12 && aimed?.id !== P.id; i++) {
        await p.evaluate((a) => { const A = (window as any).__ather; A.tp(a.wx, a.wz, a.yaw); A.look(a.yaw, a.pitch) }, { wx, wz, yaw, pitch }); await sleep(2500)
        await p.evaluate((a) => (window as any).__ather.look(a.yaw, a.pitch), { yaw, pitch }); for (let j = 0; j < 3; j++) await frame()
        aimed = await p.evaluate(() => (window as any).__ather.crystal())
      }
      ok(aimed?.id === P.id && aimed.kind === kind, `wilds: aimed at the ${name} node (${JSON.stringify(aimed)})`)
      const prompt = await p.evaluate(() => document.body.innerText)
      ok(new RegExp(`${name} \\(${mana} mana\\)`).test(prompt), `wilds: the prompt says "${name} (${mana} mana)" (${(prompt.match(new RegExp(`[^\\n]*${name}[^\\n]*`)) ?? [''])[0].slice(0, 90)})`)
      ok(!/Violet Crystal|Storm Crystal|Earth Crystal|Water Crystal/.test(prompt), `wilds: no old crystal name on screen near the ${name}`)
      if (kind === 'water') {
        const t0 = Date.now()
        await p.evaluate(() => (window as any).__ather.mine())
        for (let i = 0; i < 6; i++) await frame()
        for (let i = 0; i < 120 && await p.evaluate(() => !!(window as any).__ather.chan?.()); i++) await frame()
        const secs = (Date.now() - t0) / 1000
        const mined = await p.evaluate((id) => Object.keys(JSON.parse(localStorage.getItem('open.mined.v1') ?? '{}')).includes(id), P.id)
        ok(mined, `wilds: the Goldwood spike finished the Aqual (${secs.toFixed(0)} s wall clock on a swiftshader page)`)
      }
    }
  }
  ok(errs.length === 0, `${vp}: 0 page errors ${errs.slice(0, 2).join(' | ')}`)
  await br.close()
}
console.log(fails ? `FAIL ${fails}` : 'PASS'); process.exit(fails ? 1 : 0)
