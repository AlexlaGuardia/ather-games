// -- M84 s3b + M114 s3: THE WILDS AND THE NYX CONTINENT READ PUBLISHED ZONE BUILDS + TAGS (world lane, 11-23) --
// For each map (wilds, nyx): owner writes the LIVE layer + ONE check zone to the draft (save-builder API: a wide wall panel + a Shop
//   tag 'smokehouse' with a NON-default front edge: wilds = E (+x), nyx = N (-z)), PUBLISH. A FRESH keeper (no owner key, 390x844):
//   the game draws the 1 part; a walk at the wall STOPS at its face (and moved >= 1 m: the walk ran); ONE E point at the middle of
//   the PICKED edge; the crosshair finds it there; E opens The Smokehouse's own shop panel. ALWAYS: roll back to the start live version
//   (live JSON identical) and the draft back exactly. 0 page errors.
// Before the M84 s3b build the Wilds/Nyx games draw no part and have no E point: FAIL.
// ★ Publish + rollback write version files under world/builder/<map>/ (tracked): commit them after a run.
//   OWNER_KEY=... npx tsx scripts/zone-wilds-nyx-check.mts [--url https://ather.games] [--only wilds|nyx] [--out dir]
import puppeteer, { type Page } from 'puppeteer-core'
import { readFileSync, existsSync, mkdirSync } from 'node:fs'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/zone-wilds-nyx-check'), only = flag('--only', '')
mkdirSync(out, { recursive: true })
const KEY = process.env.OWNER_KEY || (existsSync('.env') ? /OWNER_KEY=(.+)/.exec(readFileSync('.env', 'utf8'))?.[1]?.trim() : undefined)
if (!KEY) { console.log('no OWNER_KEY (env or .env)'); process.exit(2) }
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errs: string[] = []
const owner = await br.createBrowserContext()
const op = await owner.newPage()
await op.goto(`${url}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'domcontentloaded', timeout: 120000 })
await op.goto(`${url}/shimmer/open/glade-edits`, { waitUntil: 'domcontentloaded', timeout: 120000 })
type Snap = { draft: Record<string, unknown>; live: Record<string, unknown>; index: { live: number | null; versions: { v: number }[] } }
const bget = (map: string) => op.evaluate(async (m: string) => { for (let i = 0; i < 6; i++) { const r = await fetch(`/shimmer/save-builder?map=${m}`, { cache: 'no-store' }); if (r.ok) return r.json(); await new Promise(z => setTimeout(z, 1500)) } return null }, map) as Promise<Snap | null>
const bpost = (map: string, body: Record<string, unknown>) => op.evaluate(async (m: string, b: Record<string, unknown>) => { const r = await fetch('/shimmer/save-builder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ map: m, ...b }) }); return r.ok ? r.json() : { status: r.status, text: await r.text() } }, map, body) as Promise<(Snap & { status?: number }) | null>
const pubText = async (map: string) => { const r = await fetch(`${url}/shimmer/open/${map}-edits`, { cache: 'no-store' }); if (!r.ok) throw new Error(`${map}-edits ${r.status}`); return JSON.stringify(await r.json()) }
const panelsOf = (kp: Page) => kp.evaluate(() => [...document.querySelectorAll('[data-panel]')].map(e => e.getAttribute('data-panel')).filter(Boolean)) as Promise<string[]>
const zp = (kp: Page) => kp.evaluate(() => ((window as any).__zoneParts?.() ?? null)) as Promise<{ key: string; item: string; x: number; z: number; y: number }[] | null>
async function freshKeeper(path: string) {
  const ctx = await br.createBrowserContext(), kp = await ctx.newPage(); await kp.setViewport({ width: 390, height: 844 })
  kp.on('pageerror', e => errs.push(`${path}: ` + String(e).slice(0, 200)))
  await kp.evaluateOnNewDocument('window.__name = (f) => f')
  await kp.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune', 'star'))
  await kp.goto(`${url}${path}`, { waitUntil: 'load', timeout: 240000 })
  return { ctx, kp }
}
// the check's zone: 8 x 6 m, the wall across its middle (zone-local 4, 3; q 0 = along x), Shop smokehouse, front = `front`
const mkZone = (x0: number, z0: number, front: 'e' | 'n') => ({ id: `zc-${front}`, x0, z0, x1: x0 + 8, z1: z0 + 6, h: 0, prev: {},
  tag: { kind: 'shop', ref: 'smokehouse', name: 'The Smokehouse', front }, build: [{ id: 'zc-wall', item: 'goldwood_panel_wide', x: 4, z: 3, q: 0 }] })
const doorOf = (z: ReturnType<typeof mkZone>) => z.tag.front === 'e' ? { x: z.x1 + 0.6, z: (z.z0 + z.z1) / 2 } : { x: (z.x0 + z.x1) / 2, z: z.z0 - 0.6 }

async function runMap(map: 'wilds' | 'nyx') {
  console.log(`\n── ${map} ──`)
  const start = await bget(map)
  ok(!!start, `owner: the ${map} builder draft answers`)
  if (!start) return
  const startDraft = JSON.stringify(start.draft), liveText0 = await pubText(map), liveV0 = start.index.live
  ok(liveV0 !== null || start.index.versions.length === 0, `${map}: live version v${liveV0} (${start.index.versions.length} versions) - an exact roll back is possible`)
  let published = false
  try {
    // where: the Wilds = 10 m east of Greg's waymark (the boot ring is loaded); Nyx = flat dry land found from a probe keeper
    let x0: number, z0: number
    if (map === 'wilds') {
      const tiles = (JSON.parse(readFileSync('public/open/wilds/tiles.json', 'utf8')) as { tiles: { name: string; tx: number; ty: number }[] }).tiles
      const g = tiles.find(t => t.name === 'first-wilds')!
      x0 = g.tx * 1000 - 300 + 10; z0 = g.ty * 1000 + 300 - 8
    } else {
      const { ctx, kp } = await freshKeeper('/shimmer/open/continent?hour=13')
      await kp.waitForFunction(() => !!(window as any).__drive?.ground, { timeout: 240000 }); await sleep(1500)
      const meta = JSON.parse(readFileSync('public/open/continent.json', 'utf8')) as { places: { id: string; x: number; z: number }[] }
      const p0 = meta.places[0]
      const s = await kp.evaluate((px: number, pz: number) => {
        const G = (window as any).__drive.ground
        for (let r = 250; r <= 900; r += 25) for (let a = 0; a < 24; a++) {
          const x = Math.round(px + r * Math.cos(a * Math.PI / 12)), z = Math.round(pz + r * Math.sin(a * Math.PI / 12))
          const hs: number[] = []; for (let dx = -8; dx <= 16; dx += 4) for (let dz = -8; dz <= 14; dz += 4) hs.push(G(x + dx, z + dz))
          if (hs.every(h => Number.isFinite(h) && h > 1.5) && Math.max(...hs) - Math.min(...hs) < 1.2) return { x, z }
        }
        return null
      }, p0.x, p0.z) as { x: number; z: number } | null
      await ctx.close()
      ok(!!s, `nyx: flat dry land found near ${p0.id} (${s?.x}, ${s?.z})`)
      if (!s) return
      x0 = s.x; z0 = s.z
    }
    const Z = mkZone(x0, z0, map === 'wilds' ? 'e' : 'n'), D = doorOf(Z), WALL = { x: x0 + 4, z: z0 + 3 }
    const liveL = JSON.parse(liveText0) as { zones?: unknown[] }
    const d = await bpost(map, { action: 'draft', layer: { ...liveL, zones: [...(liveL.zones ?? []), Z] } })
    ok(!!d && !d.status, `owner: the ${map} draft = live + 1 zone (a wall, Shop, front ${Z.tag.front.toUpperCase()}) (${d?.status ?? 'ok'})`)
    const pub = await bpost(map, { action: 'publish', note: 'check: zone-wilds-nyx-check' }); published = !!pub && !pub.status
    ok(published, `${map}: PUBLISH ok (${pub?.status ?? 'ok'})`)
    const live = JSON.parse(await pubText(map)) as { zones?: { id: string; tag?: { front?: string } }[] }
    ok(!!live.zones?.some(z => z.id === Z.id && z.tag?.front === Z.tag.front), `${map}: the public layer carries the zone with its front edge`)

    const { ctx, kp } = await freshKeeper(map === 'wilds' ? '/shimmer/open/ather?hour=13' : '/shimmer/open/continent?hour=13')
    // to the spot, on foot; pos() = feet; at(x, z, yaw, pitch) = stand there
    let pos: () => Promise<{ x: number; z: number }>, at: (x: number, z: number, yaw: number, pitch: number) => Promise<void>, doors: () => Promise<{ x: number; z: number; u: { kind: string } }[]>, near: () => Promise<string | null>
    if (map === 'wilds') {
      const A = (fn: string, ...a: unknown[]) => kp.evaluate((f: string, x: unknown[]) => (window as any).__ather?.[f]?.(...x), fn, a)
      await kp.waitForFunction(() => (window as any).__ather?.wildsLoaded?.().length > 0, { timeout: 240000, polling: 1000 }); await sleep(2000)
      const greg = { id: 'greg', tile: 'first-wilds', x: -300, y: 0, z: 300, biome: 0, made: 0 }
      for (let i = 0; i < 6 && (await A('zone')) !== 'wilds'; i++) { await A('travel', { kind: 'waymark', w: greg }); for (let k = 0; k < 30 && (await A('zone')) !== 'wilds'; k++) await sleep(1000) }
      ok((await A('zone')) === 'wilds', 'a fresh keeper (390x844, no owner key) is in the Wilds')
      await sleep(4000)
      pos = async () => { const s = await A('state') as { px: number; pz: number }; return { x: s.px, z: s.pz } }
      at = async (x, z, yaw, pitch) => { await A('tp', x, z, yaw); await sleep(1500); await A('look', yaw, pitch); await sleep(1200) }
      doors = async () => (await A('zoneDoors') as { x: number; z: number; u: { kind: string } }[]) ?? []
      near = async () => ((await A('near')) as { kind?: string } | null)?.kind ?? null
    } else {
      const Dv = (fn: string, ...a: unknown[]) => kp.evaluate((f: string, x: unknown[]) => (window as any).__drive?.[f]?.(...x), fn, a)
      await kp.waitForFunction(() => !!(window as any).__drive?.ground, { timeout: 240000 }); await sleep(3000)
      await kp.keyboard.press('KeyE'); await sleep(1500)
      pos = async () => { const f = await Dv('foot') as { px: number; pz: number }; return { x: f.px, z: f.pz } }
      at = async (x, z, yaw, pitch) => { await Dv('footTp', x, z, yaw, pitch); await sleep(2500) }
      doors = () => kp.evaluate(() => (window as any).__nyxZones?.doors() ?? []) as Promise<{ x: number; z: number; u: { kind: string } }[]>
      near = async () => ((await kp.evaluate(() => (window as any).__nyxZones?.reach() ?? null)) as { kind?: string } | null)?.kind ?? null
      await at(WALL.x, WALL.z + 4, 0, -0.1)
      ok((await Dv('foot') as { mode: string }).mode === 'foot', 'a fresh keeper (390x844, no owner key) is on foot on the continent')
    }
    let parts: Awaited<ReturnType<typeof zp>> = null
    for (let i = 0; i < 20; i++) { parts = await zp(kp); if (parts?.length) break; await sleep(1000) }
    ok(parts?.length === 1 && parts[0].item === 'goldwood_panel_wide' && Math.abs(parts[0].x - WALL.x) < 1e-6 && Math.abs(parts[0].z - WALL.z) < 1e-6 && Number.isFinite(parts[0].y),
      `${map}: the game draws the published part at the zone's spot (${parts?.map(q => `${q.item}@${q.x},${q.z} y${q.y.toFixed(2)}`).join(' ')})`)
    // collision: 3 m south of the wall, facing it (yaw 0 = -z), hold W until past the wall line or 20 s
    await at(WALL.x, WALL.z + 3, 0, -0.1)
    const z0w = (await pos()).z
    await kp.keyboard.down('KeyW')
    for (let t = 0; t < 40; t++) { await sleep(500); if ((await pos()).z < WALL.z - 1.5) break }
    await kp.keyboard.up('KeyW'); await sleep(500)
    const zEnd = (await pos()).z
    ok(z0w - zEnd >= 1 && zEnd > WALL.z, `${map}: the walk moved (${z0w.toFixed(2)} -> ${zEnd.toFixed(2)}) and STOPPED at the wall (line z ${WALL.z})`)
    await kp.screenshot({ path: `${out}/${map}-wall.png` })
    // the E point: one, on the picked edge
    const ds = await doors()
    ok(ds.length === 1 && Math.abs(ds[0].x - D.x) < 1e-6 && Math.abs(ds[0].z - D.z) < 1e-6 && ds[0].u.kind === 'shop', `${map}: ONE E point at the middle of the ${Z.tag.front.toUpperCase()} edge (${ds.map(q => `${q.u.kind}@${q.x},${q.z}`).join(' ')}; want ${D.x},${D.z})`)
    // stand 1.6 m out from it, facing it: wilds E edge -> face -x (yaw pi/2); nyx N edge -> face +z (yaw pi)
    const st = Z.tag.front === 'e' ? { x: D.x + 1.6, z: D.z, yaw: Math.PI / 2 } : { x: D.x, z: D.z - 1.6, yaw: Math.PI }
    let nk: string | null = null
    for (let t = 0; t < 4 && nk !== 'zone' && nk !== 'shop'; t++) { await at(st.x, st.z, st.yaw, -0.25 - t * 0.1); nk = await near() }
    ok(nk === (map === 'wilds' ? 'zone' : 'shop'), `${map}: the crosshair finds the E point on the picked edge (${nk})`)
    await kp.keyboard.press('KeyE'); await sleep(2000)
    const panels = await panelsOf(kp), txt = await kp.evaluate(() => document.body.innerText) as string
    await kp.screenshot({ path: `${out}/${map}-shop.png` })
    ok(panels.includes('shop-panel') && txt.includes('The Smokehouse'), `${map}: E opens The Smokehouse's own shop panel (${panels.join(',')})`)
    await ctx.close()
  } catch (e) { ok(false, `${map} threw: ${String(e).slice(0, 300)}`) }
  finally {
    try {
      if (published) {
        const target = liveV0 ?? 1
        const r = await bpost(map, { action: 'rollback', v: target })
        ok(!!r && !r.status, `${map} cleanup: rolled the check's publish back to v${target}`)
      }
      await bpost(map, { action: 'draft', layer: start.draft })
      const end = await bget(map)
      ok(!!end && JSON.stringify(end.draft) === startDraft, `${map}: the draft is back exactly as it was`)
      ok(await pubText(map) === liveText0, `${map}: the live layer is back exactly (JSON identical)`)
    } catch (e) { ok(false, `${map} RESTORE FAILED: ${String(e)} - roll back from the editor's history by hand`) }
  }
}

for (const m of ['wilds', 'nyx'] as const) if (!only || only === m) await runMap(m)
ok(errs.length === 0, `0 page errors${errs.length ? ': ' + errs.slice(0, 4).join(' | ') : ''}`)
await br.close()
console.log(`shots: ${out}`)
console.log(fails ? `\n${fails} FAILED` : '\nPASS')
process.exit(fails ? 1 : 0)
