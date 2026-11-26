// M185 s2 (RULED athernyx c73ab4e; glossary 'Mana seep'): MANA SEEPS in the Wilds, small / medium / large, worked with the spike,
// paying raw mana shards (more from a bigger one), resetting like the other nodes.
// A fresh anonymous context, a keeper holding the GOLDWOOD spike:
//   1. the spike panel lists the three seeps with the Goldwood numbers: small 5 ok, medium 9 ok, large 16 ok
//   2. in the Wilds (--no-wilds skips): for each size a seep stands in the tiles; aimed, the prompt says "<Size> Mana Seep (n mana)"
//      (never spring / well); worked to the end it pays raw mana shards (on the ground beside it, M141, or pulled into the bag), a large more than a small
//   3. the reset: a worked seep says "growing back"; once its reset is past (the saved time moved back) it is workable again
//   npx tsx scripts/m185-seeps-check.mts [--url https://ather.games] [--no-wilds] [--phone-only] [--desk-only]
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
const BAG = { v: 1, slots: Array(32).fill(null), gifts: ['bait1'] }
const TOOLS = { prospecting: { toolId: 'goldwood_spike', usesRemaining: 40, speedBonus: 0.9, xpBonus: 1.1 } }

// a seep of each size with clear ground 5 m off (the page's own parser + the zone layer, as prospect-check)
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
// a finished node pays onto the GROUND beside it (M141 ground-loot.ts), and a drop within 2 m comes to the keeper: count both
const shards = (p: Page) => p.evaluate(() => { try {
  const bag = (JSON.parse(localStorage.getItem('open.inv.v1') ?? 'null')?.slots ?? []).filter((s: any) => s?.id === 'raw_mana_shard').reduce((a: number, s: any) => a + s.n, 0)
  const ground = Object.keys(localStorage).filter(k => k.startsWith('open.loot.v1')).flatMap(k => { const v = JSON.parse(localStorage.getItem(k) ?? 'null'); return Array.isArray(v) ? v : v?.drops ?? [] }).filter((l: any) => l?.item === 'raw_mana_shard').reduce((a: number, l: any) => a + l.n, 0)
  return bag + ground } catch { return -1 } })
const SIZES = [['seep_s', 'Small Mana Seep', 5], ['seep_m', 'Medium Mana Seep', 9], ['seep_l', 'Large Mana Seep', 16]] as const

for (const [vp, w, h] of (phoneOnly ? [['phone', 390, 844]] : deskOnly ? [['desktop', 1280, 800]] : [['phone', 390, 844], ['desktop', 1280, 800]]) as [string, number, number][]) {
  const phone = vp === 'phone'
  const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: '/usr/bin/chromium-browser', args: ARGS })
  const p = await (await br.createBrowserContext()).newPage()
  await p.setViewport({ width: w, height: h, ...(phone ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 160)))
  await p.evaluateOnNewDocument((s: any) => {
    if (sessionStorage.getItem('m185s2-seeded')) return   // seed once: a reload must keep what the page saved
    sessionStorage.setItem('m185s2-seeded', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    localStorage.setItem('open.tutorial.v1', JSON.stringify(s.TUT))
    localStorage.setItem('open.rinquest.v1', JSON.stringify({ v: 1, state: 'done', step: 0 }))
    localStorage.setItem('open.tools.v1', JSON.stringify(s.TOOLS))
    localStorage.setItem('open.inv.v1', JSON.stringify(s.BAG))
    for (const k of ['open.mined.v1', 'open.gather.v1']) localStorage.removeItem(k)
  }, { TUT, TOOLS, BAG } as any)
  const boot = async () => {
    await p.goto(`${origin}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 240000 })
    for (let i = 0; i < 40; i++) { await sleep(2000); if (await p.$('[data-dial-btn="prospecting"]')) { await sleep(3000); break } }
  }
  await boot()

  // 1. the spike panel
  const el = await p.$('[data-dial-btn="prospecting"]'); if (el) { if (phone) await el.tap(); else await el.click() }
  let pn = null as Awaited<ReturnType<typeof readPanel>>
  for (let i = 0; i < 12 && !pn; i++) { await sleep(300); pn = await readPanel(p) }
  ok(pn?.name === 'Goldwood Spike', `${vp}: the panel names the Goldwood Spike (${pn?.name})`)
  ok(pn?.rows.filter(r => /Mana Seep:/.test(r)).join() === 'Small Mana Seep:5:ok,Medium Mana Seep:9:ok,Large Mana Seep:16:ok', `${vp}: seep rows ${pn?.rows.filter(r => /Seep/.test(r)).join()}`)
  ok(!!pn && !pn.rows.some(r => /spring|well/i.test(r)), `${vp}: no row says spring or well`)
  if (process.env.SHOT_DIR) await p.screenshot({ path: `${process.env.SHOT_DIR}/m185s2-panel-${vp}.png` }).catch(() => {})
  await p.keyboard.press('Escape'); await sleep(500)
  // the Escape that shuts the panel can also open Options (no pointer lock headless), and Options FREEZES the game: a channel
  // then never drains (the s2 '+0' wall, 11-26). Shut Options the way a player would, and prove it is shut.
  for (let i = 0; i < 4 && await p.evaluate(() => /Resume[\s\S]{0,40}Tooltips/.test(document.body.innerText)); i++) { await p.keyboard.press('Escape'); await sleep(600) }
  ok(!(await p.evaluate(() => /Resume[\s\S]{0,40}Tooltips/.test(document.body.innerText))), `${vp}: Options is shut before the Wilds (an open menu freezes the game)`)

  // 2 + 3. the Wilds
  if (!noWilds) {
    const nodes = Object.fromEntries(SIZES.map(([k]) => [k, pickNode(k)])) as Record<string, Pick | null>
    ok(SIZES.every(([k]) => !!nodes[k]), `wilds: a seep of each size in the tiles (${SIZES.map(([k]) => nodes[k]?.id).join(' / ')})`)
    await p.waitForFunction(() => !!(window as any).__ather?.mine, { timeout: 120000 })
    const unveil = () => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => d.textContent?.includes('Click to play')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' })
    await unveil()
    const frame = async () => { try { await p.screenshot() } catch { /* slow */ } }
    const goAim = async (P: Pick) => {
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
      return aimed
    }
    const got: Record<string, number> = {}
    for (const [kind, name, mana] of SIZES) {
      const P = nodes[kind]; if (!P) continue
      const aimed = await goAim(P)
      ok(aimed?.id === P.id && aimed.kind === kind, `${vp} wilds: aimed at the ${name} (${JSON.stringify(aimed)})`)
      const prompt = await p.evaluate(() => document.body.innerText)
      ok(new RegExp(`${name} \\(${mana} mana\\)`).test(prompt), `${vp} wilds: the prompt says "${name} (${mana} mana)" (${(prompt.match(/[^\n]*Mana Seep[^\n]*/) ?? [''])[0].slice(0, 90)})`)
      ok(!/mana (spring|well)/i.test(prompt), `${vp} wilds: no 'spring' / 'well' on screen at the ${name}`)
      if (process.env.SHOT_DIR) await p.screenshot({ path: `${process.env.SHOT_DIR}/m185s2-${kind}-${vp}.png` }).catch(() => {})
      const before = await shards(p), t0 = Date.now()
      await p.evaluate(() => (window as any).__ather.mine())
      for (let i = 0; i < 6; i++) await frame()
      for (let i = 0; i < 150 && await p.evaluate(() => !!(window as any).__ather.chan?.()); i++) await frame()
      await sleep(1500)
      const mined = await p.evaluate((id) => Object.keys(JSON.parse(localStorage.getItem('open.mined.v1') ?? '{}')).includes(id), P.id)
      got[kind] = (await shards(p)) - before
      ok(mined && got[kind] >= 1, `${vp} wilds: the Goldwood spike finished the ${name}: +${got[kind]} raw mana shards (${((Date.now() - t0) / 1000).toFixed(0)} s)`)
      const after = await p.evaluate(() => document.body.innerText)
      ok(/Mana Seep, growing back/.test(after), `${vp} wilds: the worked ${name} is growing back (${(after.match(/[^\n]*growing back[^\n]*/) ?? [''])[0].slice(0, 80)})`)
    }
    ok(got.seep_l > got.seep_s, `${vp} wilds: a large seep paid more than a small one (${got.seep_s} / ${got.seep_m} / ${got.seep_l})`)
    // 3. the reset: move the small seep's saved regrow time into the past, reload: it is workable again
    const S = nodes.seep_s
    if (S) {
      await p.evaluate((id) => { const m = JSON.parse(localStorage.getItem('open.mined.v1') ?? '{}'); m[id] = Date.now() - 1000; localStorage.setItem('open.mined.v1', JSON.stringify(m)) }, S.id)
      await boot(); await p.waitForFunction(() => !!(window as any).__ather?.mine, { timeout: 120000 }); await unveil()
      const aimed = await goAim(S)
      const prompt = await p.evaluate(() => document.body.innerText)
      ok(aimed?.id === S.id && /Small Mana Seep \(5 mana\)/.test(prompt) && !/growing back/.test(prompt), `${vp} wilds: past its reset the Small Mana Seep is workable again (${(prompt.match(/[^\n]*Mana Seep[^\n]*/) ?? [''])[0].slice(0, 80)})`)
    }
  }
  ok(errs.length === 0, `${vp}: 0 page errors ${errs.slice(0, 2).join(' | ')}`)
  await br.close()
}
console.log(fails ? `FAIL ${fails}` : 'PASS'); process.exit(fails ? 1 : 0)
