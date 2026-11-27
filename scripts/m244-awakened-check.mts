// BETA M244 sheet 1 (sprites, 2026-11-27): THE FOUR AWAKENED VULNARA FORMS, OWNER PREVIEW. /shimmer/dev?mode=spirits rows #051-#054
// (Vulnarok / Vulnalys / Vulnavex / Vulnamyr). For each: her own glb is fetched (not Vulnara's), her body + her 'aura' part (echoes /
// spirals / halo) are mounted on her rig, the stage draws her, and her clips play (idle, walk, run, sit) with 0 errors. Then a
// NON-OWNER (fresh context, no owner cookie) gets no gallery at all.
//   OWNER_KEY=... npx tsx scripts/m244-awakened-check.mts [--url https://ather.games] [--shots dir] [--w 390 --h 844]
import puppeteer, { type Page } from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { GALLERY } from '../src/app/shimmer/dev/editors/spirit-gallery'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), shots = flag('--shots', ''), KEY = process.env.OWNER_KEY
const W = Number(flag('--w', '390')), H = Number(flag('--h', '844'))
if (shots) mkdirSync(shots, { recursive: true })
if (!KEY) { console.error('no OWNER_KEY'); process.exit(2) }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms)); let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++ }
const AW = GALLERY.filter(r => r.aw)
ok(AW.length === 4, `4 awakened rows in the roster (${AW.map(r => `#${r.num} ${r.name}`).join(', ')})`)
const br = await puppeteer.launch({ protocolTimeout: 900000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--mute-audio', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
try {
  const errs: string[] = []
  const p: Page = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: W, height: H })
  p.on('pageerror', e => errs.push(String(e).slice(0, 300)))
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 300)) })
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.goto(`${url}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
  await sleep(1500); errs.length = 0
  await p.evaluateOnNewDocument(() => { const f = window.fetch.bind(window); window.fetch = (u, i) => ((i?.method ?? 'GET').toUpperCase() !== 'GET') ? Promise.resolve(new Response('{}', { status: 200 })) : f(u, i); navigator.sendBeacon = () => true })
  for (const row of AW) {
    await p.goto(`${url}/shimmer/dev?mode=spirits&spirit=${row.num}`, { waitUntil: 'load', timeout: 240000 })
    await p.waitForSelector('[data-spirit-gallery]', { timeout: 120000 })
    const read = () => p.evaluate(() => {
      const P = (window as any).__spiritModel, r = P?.rigs?.get('gallery'), m = r?.body?.meshes ?? {}
      const n = (k: string) => { try { return m[k]?.geometry?.getAttribute('position')?.count ?? 0 } catch { return 0 } }
      return { st: document.querySelector('[data-gallery-state]')?.getAttribute('data-gallery-state') ?? '', title: document.querySelector('[data-gallery-title]')?.textContent ?? '',
        stage: document.querySelector('[data-spirit-stage]')?.getAttribute('data-spirit-stage') ?? '', urls: P ? Object.keys(P.urls ?? {}).filter((k: string) => P.urls[k]) : [],
        body: n('body'), aura: n('aura'), eyes: n('eyes'), clips: (r?.body?.mixer as any)?._actions?.length ?? 0 }
    })
    let s = await read(); const t0 = Date.now()
    while (Date.now() - t0 < 60000 && !(s.body > 0 && s.aura > 0)) { await sleep(500); s = await read() }
    const look = row.aw!.look
    ok(s.st === 'model' && s.title.toLowerCase() === row.name.toLowerCase() && s.stage === look, `#${row.num} ${row.name}: stage ${s.stage}, title ${s.title}`)
    ok(s.urls.some(u => u.includes(`/${look}-rigged.glb`)) && !s.urls.some(u => u.includes('/vulnara-rigged.glb')), `#${row.num} her own glb (${s.urls.filter(u => u.includes('rigged')).join(', ')})`)
    ok(s.body > 2000 && s.eyes > 0 && s.aura > 0, `#${row.num} body ${s.body} verts, eyes ${s.eyes}, aura ${s.aura} (echoes / spirals / halo)`)
    for (const c of ['walk', 'run', 'sit', 'idle']) {
      await p.click(`[data-gallery-clip="${c}"]`).catch(() => {}); await sleep(1600)
      const on = await p.$eval(`[data-gallery-clip="${c}"]`, e => e.getAttribute('aria-pressed')).catch(() => null)
      if (shots && (c === 'idle' || c === 'walk')) await p.screenshot({ path: `${shots}/${row.num}-${look}-${c}.png` })
      ok(on === 'true' && errs.length === 0, `#${row.num} ${c} plays (errors so far ${errs.length})`)
    }
    // M244 s1b: the biped (Vulnarok), the running copies (Vulnavex), the sit clearance (Vulnamyr), read off the live rig in the page
    const sample = (clip: string, n: number, gap: number) => p.click(`[data-gallery-clip="${clip}"]`).then(() => sleep(1800)).then(() => p.evaluate(async (n: number, gap: number) => {
      const r = (window as any).__spiritModel?.rigs?.get('gallery')?.body; if (!r) return null
      const names: string[] = r.bones.map((b: any) => b.name), out: { bones: Record<string, number[]>; low: number }[] = []
      const T = (r.root.matrixWorld.clone ? r.root.matrixWorld.clone().invert() : null)
      for (let k = 0; k < n; k++) {
        await new Promise(res => setTimeout(res, gap)); r.root.updateMatrixWorld(true); const inv = r.root.matrixWorld.clone().invert(), bones: Record<string, number[]> = {}
        for (const b of r.bones) if (/^b_(leg_[lr]_paw|e0_head|head)$/.test(b.name)) { const v = b.getWorldPosition(new (b.position.constructor)()).applyMatrix4(inv); bones[b.name] = [v.x, v.y, v.z] }
        let low = 9; const v = new (r.root.position.constructor)()
        for (const part of ['body', 'aura']) { const m = r.meshes[part]; if (!m) continue; const c = m.geometry.getAttribute('position').count; for (let i = 0; i < c; i += 2) { r.at(part, i, v); v.applyMatrix4(inv); if (v.y < low) low = v.y } }
        out.push({ bones, low })
      }
      void T; return { names, out }
    }, n, gap))
    if (look === 'vulnarok') {
      const s1 = await sample('walk', 14, 70)
      const legs = (s1?.names ?? []).filter(x => /^b_leg_[lr]_(up|lo|mt|paw)$/.test(x)), d = (s1?.out ?? []).map(o => (o.bones.b_leg_l_paw?.[2] ?? 0) - (o.bones.b_leg_r_paw?.[2] ?? 0))
      ok(legs.length === 8 && !(s1?.names ?? []).some(x => /^b_(fl|fr|hl|hr)_/.test(x)), `#${row.num} biped rig: two leg chains (${legs.length} leg bones), no quadruped legs`)
      ok(d.length > 0 && Math.max(...d) > 0.05 && Math.min(...d) < -0.05, `#${row.num} walks with feet alternating (left minus right lead ${Math.min(...d).toFixed(3)} .. ${Math.max(...d).toFixed(3)} glb)`)
      const e = (s1?.out ?? []).map(o => o.bones.b_e0_head ?? [0, 0, 0]), ex = Math.max(...e.map(q => Math.hypot(q[0] - e[0][0], q[1] - e[0][1], q[2] - e[0][2])))
      ok(ex > 0.005, `#${row.num} her echoes move with her (echo 0 head travels ${ex.toFixed(3)} glb in the walk)`)
    }
    if (look === 'vulnavex') {
      const s1 = await sample('run', 12, 60), e = (s1?.out ?? []).map(o => o.bones.b_e0_head ?? [0, 0, 0]), ex = e.length ? Math.max(...e.map(q => Math.hypot(q[0] - e[0][0], q[1] - e[0][1], q[2] - e[0][2]))) : 0
      ok(ex > 0.2, `#${row.num} her copies move during the run (copy 0 head travels ${ex.toFixed(3)} glb)`)
    }
    if (look === 'vulnamyr') {
      const s1 = await sample('sit', 6, 300), lo = Math.min(...(s1?.out ?? [{ low: -9 }]).map(o => o.low))
      ok(lo >= -0.001, `#${row.num} sit clearance >= 0 (lowest body / fan / halo vertex ${(lo * 1000).toFixed(1)} mm glb)`)
    }
  }
  ok(errs.length === 0, `owner errors: ${errs.length} ${errs.slice(0, 4).join(' | ')}`)
  // the non-owner: a fresh context with no owner cookie sees no gallery
  const q = await (await br.createBrowserContext()).newPage(); await q.setViewport({ width: W, height: H })
  const res = await q.goto(`${url}/shimmer/dev?mode=spirits&spirit=51`, { waitUntil: 'load', timeout: 120000 }).catch(() => null); await sleep(2500)
  const g = await q.$('[data-spirit-gallery]')
  ok(!g, `non-owner: no gallery (status ${res?.status()}, url ${q.url().replace(url, '')})`)
} finally { await br.close() }
console.log(fails ? `${fails} FAIL` : 'ALL PASS'); process.exit(fails ? 1 : 0)
