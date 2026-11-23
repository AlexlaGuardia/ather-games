// -- M114 s2: THE GAME READS A PUBLISHED ZONE'S TAG (world lane, 11-23) --
// Owner: put 4 tagged zones on the GLADE DRAFT (save-builder API, one per tag: Other / Shop smokehouse / Home Otto / Supplier first good),
//   PUBLISH. A FRESH keeper (no owner key, 390x844) in the Glade: the game has one E point per zone; E at each gives:
//   Other -> 'The door is locked.' and no panel · Shop -> that shop's panel opens · Home -> "Otto's home" + Otto's talk opens ·
//   Supplier -> 'Supplier: <name>' and no panel. ALWAYS: roll the publish back (live JSON identical) + the draft back exactly. 0 page errors.
// Before the M114 s2 build the game has no E point (0 doors): FAIL.
// ★ Publish + rollback write version files under world/builder/glade/ (tracked): commit them after a run.
//   OWNER_KEY=... npx tsx scripts/zone-tags-check.mts [--url https://ather.games] [--out dir]
import puppeteer, { type Page } from 'puppeteer-core'
import { readFileSync, existsSync, mkdirSync } from 'node:fs'
import { GOODS } from '../src/app/shimmer/open/trade'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/zone-tags-check')
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
const bget = () => op.evaluate(async () => { for (let i = 0; i < 6; i++) { const r = await fetch('/shimmer/save-builder?map=glade', { cache: 'no-store' }); if (r.ok) return r.json(); await new Promise(z => setTimeout(z, 1500)) } return null }) as Promise<Snap | null>
const bpost = (body: Record<string, unknown>) => op.evaluate(async (b: Record<string, unknown>) => { const r = await fetch('/shimmer/save-builder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ map: 'glade', ...b }) }); return r.ok ? r.json() : { status: r.status, text: await r.text() } }, body) as Promise<(Snap & { status?: number }) | null>
const pubText = async () => { const r = await fetch(`${url}/shimmer/open/glade-edits`, { cache: 'no-store' }); if (!r.ok) throw new Error(`glade-edits ${r.status}`); return JSON.stringify(await r.json()) }
const start = await bget()
ok(!!start, 'owner: the Glade builder draft answers')
if (!start) { await br.close(); process.exit(1) }
const startDraft = JSON.stringify(start.draft), liveText0 = await pubText(), liveV0 = start.index.live
const existing = ((start.draft as { zones?: unknown[] }).zones ?? []).length
ok(existing === 0, `the Glade draft has no zone of its own (${existing}): nothing of Alex's is in the way`)
let published = false

const sup = Object.values(GOODS)[0]
// four zones in Greg's garden area (world coords; the s3 check's ground), well apart; E point = middle of the +z edge, 0.6 m out
const Z = [
  { id: 'zt-other', x0: -112, z0: 98, x1: -106, z1: 103, tag: { kind: 'other' }, want: 'locked' },
  { id: 'zt-shop', x0: -98, z0: 98, x1: -92, z1: 103, tag: { kind: 'shop', ref: 'smokehouse', name: 'The Smokehouse' }, want: 'shop' },
  { id: 'zt-home', x0: -112, z0: 112, x1: -106, z1: 117, tag: { kind: 'home', ref: 'otto', name: 'Otto' }, want: 'home' },
  { id: 'zt-sup', x0: -98, z0: 112, x1: -92, z1: 117, tag: { kind: 'supplier', ref: sup.id, name: sup.name }, want: 'supplier' },
]
const panelOf = (kp: Page) => kp.evaluate(() => [...document.querySelectorAll('[data-panel]')].map(e => e.getAttribute('data-panel')).filter(Boolean)) as Promise<string[]>
const bodyText = (kp: Page) => kp.evaluate(() => document.body.innerText) as Promise<string>

try {
  const draft = { ...start.draft, zones: Z.map(z => ({ id: z.id, x0: z.x0, z0: z.z0, x1: z.x1, z1: z.z1, h: 0, tag: z.tag, prev: {} })) }
  const d = await bpost({ action: 'draft', layer: draft })
  ok(!!d && !d.status, `owner: 4 tagged zones on the Glade draft (${d?.status ?? 'ok'})`)
  const pub = await bpost({ action: 'publish', note: 'check: zone-tags-check' }); published = !!pub && !pub.status
  ok(published, `PUBLISH ok (${pub?.status ?? 'ok'})`)
  const live = JSON.parse(await pubText()) as { zones?: { id: string; tag?: { kind: string } }[] }
  ok(live.zones?.length === 4 && live.zones.every(z => !!z.tag), `the public Glade layer carries the 4 tagged zones (${live.zones?.length})`)

  const ctx = await br.createBrowserContext(), kp = await ctx.newPage(); await kp.setViewport({ width: 390, height: 844 })
  kp.on('pageerror', e => errs.push('game: ' + String(e).slice(0, 200)))
  await kp.evaluateOnNewDocument('window.__name = (f) => f')
  await kp.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune', 'star'))
  const A = (fn: string, ...a: unknown[]) => kp.evaluate((f: string, x: unknown[]) => (window as any).__ather?.[f]?.(...x), fn, a)
  await kp.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
  await kp.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 }); await sleep(2000)
  if ((await A('zone')) !== 'glade') await A('travel', { kind: 'glade' })
  for (let i = 0; i < 60 && (await A('zone')) !== 'glade'; i++) await sleep(1000)
  ok((await A('zone')) === 'glade', 'a fresh keeper (390x844, no owner key) is in the Glade')
  let doors: { id: string; x: number; z: number; u: { kind: string } }[] = []
  for (let i = 0; i < 20; i++) { doors = (await A('zoneDoors') as typeof doors) ?? []; if (doors.length) break; await sleep(1000) }
  ok(doors.length === 4, `the game has ONE E point per tagged zone (${doors.length}: ${doors.map(q => `${q.id}=${q.u.kind}@${q.x},${q.z}`).join(' ')})`)

  for (const z of Z) {
    const dr = doors.find(q => q.id === z.id)
    if (!dr) { ok(false, `${z.id}: no E point`); continue }
    ok(dr.x === (z.x0 + z.x1) / 2 && Math.abs(dr.z - (z.z1 + 0.6)) < 1e-6 && dr.u.kind === z.want, `${z.id}: E point at the front edge (${dr.x}, ${dr.z}) reads ${dr.u.kind}`)
    // stand 1.6 m in front of it, facing it (yaw 0 = -z), look a little down, until E would act on it
    let nk: { kind?: string } | null = null
    for (let t = 0; t < 4 && nk?.kind !== 'zone'; t++) {
      await A('gladeAt', dr.x, dr.z + 1.6, 0); await sleep(2500); await A('look', 0, -0.25 - t * 0.1); await sleep(1200)
      nk = await A('near') as typeof nk
    }
    ok(nk?.kind === 'zone', `${z.id}: the crosshair finds the E point (near = ${nk?.kind})`)
    const before = await panelOf(kp)
    await kp.keyboard.press('KeyE'); await sleep(1500)
    const panels = await panelOf(kp), txt = await bodyText(kp), pk = await A('panel') as string | null
    await kp.screenshot({ path: `${out}/${z.id}.png` })
    if (z.want === 'locked') ok(txt.includes('The door is locked.') && panels.length === before.length && pk === null, `Other: E says 'The door is locked.', no panel (${panels.join(',')})`)
    if (z.want === 'shop') ok(pk === 'shop' && panels.includes('shop-panel') && txt.includes('The Smokehouse'), `Shop: E opens The Smokehouse's own panel (${panels.join(',')})`)
    if (z.want === 'home') ok(txt.includes("Otto's home") && pk === 'friend' && txt.includes('Otto'), `Home: "Otto's home" + Otto's own talk opens (panel ${pk})`)
    if (z.want === 'supplier') ok(txt.includes(`Supplier: ${sup.name}`) && panels.length === before.length && pk === null, `Supplier: 'Supplier: ${sup.name}', no panel (${panels.join(',')})`)
    await kp.keyboard.press('Escape'); await sleep(800)
  }
  await ctx.close()
} catch (e) { ok(false, `threw: ${String(e).slice(0, 300)}`) }
finally {
  try {
    if (published) {
      const r = await bpost({ action: 'rollback', v: liveV0 ?? 1 })
      ok(!!r && !r.status, `cleanup: rolled the check's publish back to v${liveV0 ?? 1}`)
    }
    await bpost({ action: 'draft', layer: start.draft })
    const end = await bget()
    ok(!!end && JSON.stringify(end.draft) === startDraft, 'the Glade draft is back exactly as it was')
    ok(await pubText() === liveText0, 'the live Glade layer is back exactly (JSON identical)')
  } catch (e) { ok(false, `RESTORE FAILED: ${String(e)} - roll back from the editor's history by hand`) }
  ok(errs.length === 0, `0 page errors${errs.length ? ': ' + errs.slice(0, 4).join(' | ') : ''}`)
  await br.close()
  console.log(`shots: ${out}`)
  console.log(fails ? `\n${fails} FAILED` : '\nPASS')
  process.exit(fails ? 1 : 0)
}
