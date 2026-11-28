// BETA M244 sheet 1 (sprites, 2026-11-27): THE FOUR AWAKENED VULNARA FORMS, OWNER PREVIEW. /shimmer/dev?mode=spirits rows #051-#054
// (Vulnarok / Vulnalys / Vulnavex / Vulnamyr). For each: her own glb is fetched (not Vulnara's), her body + her 'aura' part (echoes /
// spirals / halo) are mounted on her rig, the stage draws her, and her clips play (idle, walk, run, sit) with 0 errors. Then a
// NON-OWNER (fresh context, no owner cookie) gets no gallery at all.
// M244 sheet 2: + Vulnarc's four, rows #055-#058 (Vulnarkor / Vulnarcelle / Arcvex / Vulnarceth): the same, plus Vulnarkor upright on the
// biped rig, Arcvex's copies running, and every one of the four clear of the ground (body + aura) in idle / walk / run / sit / lie.
//   --only 55,56   checks just those rows
//   OWNER_KEY=... npx tsx scripts/m244-awakened-check.mts [--url https://ather.games] [--shots dir] [--w 1440 --h 900]
import puppeteer, { type Page } from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { GALLERY } from '../src/app/shimmer/dev/editors/spirit-gallery'
import { AWAKEN_GROW, formGrow } from '../src/app/shimmer/open/ather/spirit-models'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), shots = flag('--shots', ''), KEY = process.env.OWNER_KEY
const W = Number(flag('--w', '1440')), H = Number(flag('--h', '900'))   // desk default: the owner gallery is desktop-first (at 390 the model never mounts, every row reads 0 verts)
if (shots) mkdirSync(shots, { recursive: true })
if (!KEY) { console.error('no OWNER_KEY'); process.exit(2) }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms)); let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++ }
const ONLY = flag('--only', '').split(',').filter(Boolean).map(Number)
const AW = GALLERY.filter(r => r.aw && (!ONLY.length || ONLY.includes(r.num)))
ok(GALLERY.filter(r => r.aw).length === 56, `56 awakened rows in the roster (${GALLERY.filter(r => r.aw).map(r => `#${r.num} ${r.name}`).join(', ')})`)
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
      const names: string[] = r.bones.map((b: any) => b.name), out: { bones: Record<string, number[]>; low: number; blow: number }[] = []
      const T = (r.root.matrixWorld.clone ? r.root.matrixWorld.clone().invert() : null)
      for (let k = 0; k < n; k++) {
        await new Promise(res => setTimeout(res, gap)); r.root.updateMatrixWorld(true); const inv = r.root.matrixWorld.clone().invert(), bones: Record<string, number[]> = {}
        for (const b of r.bones) if (/^b_(leg_[lr]_paw|e0_head|head)$/.test(b.name)) { const v = b.getWorldPosition(new (b.position.constructor)()).applyMatrix4(inv); bones[b.name] = [v.x, v.y, v.z] }
        let low = 9, blow = 9; const v = new (r.root.position.constructor)()
        for (const part of ['body', 'aura']) { const m = r.meshes[part]; if (!m) continue; const c = m.geometry.getAttribute('position').count; for (let i = 0; i < c; i += 2) { r.at(part, i, v); v.applyMatrix4(inv); if (v.y < low) low = v.y; if (part === 'body' && v.y < blow) blow = v.y } }
        out.push({ bones, low, blow })
      }
      void T; return { names, out }
    }, n, gap))
    // her body without her tail(s), at rest in the idle, in her own glb units (root space)
    const measure = () => p.click('[data-gallery-clip="idle"]').catch(() => {}).then(() => sleep(800)).then(() => p.evaluate(() => {
      const r = (window as any).__spiritModel?.rigs?.get('gallery')?.body; if (!r?.meshes?.body) return null
      const m = r.meshes.body, si = m.geometry.getAttribute('skinIndex'), sw = m.geometry.getAttribute('skinWeight'), names: string[] = r.bones.map((b: any) => b.name)
      r.root.updateMatrixWorld(true); const inv = r.root.matrixWorld.clone().invert(), v = new (r.root.position.constructor)(); let z0 = 9, z1 = -9, y1 = -9, n = 0
      for (let i = 0; i < si.count; i++) {
        let tw = 0; for (let c = 0; c < 4; c++) if (names[si.getComponent(i, c)]?.startsWith('b_tail')) tw += sw.getComponent(i, c)
        if (tw >= 0.5) continue; r.at('body', i, v); v.applyMatrix4(inv); z0 = Math.min(z0, v.z); z1 = Math.max(z1, v.z); y1 = Math.max(y1, v.y); n++
      }
      return { len: z1 - z0, tall: y1, n }
    }))
    if (['vulnarkor', 'vulnarcelle', 'arcvex', 'vulnarceth', 'orethar', 'vulnoraya', 'vulnoris', 'vulnorun', 'vulnitar', 'marelle', 'vulnisk', 'vulnixeth'].includes(look)) {   // sheets 2 + 3 + 4: clear of the ground in every clip (body + aura)
      for (const c of ['idle', 'walk', 'run', 'sit', 'lie']) {
        const s1 = await sample(c, 6, 250), lo = Math.min(...(s1?.out ?? [{ low: -9 }]).map(o => o.low))
        ok(lo >= -0.0015, `#${row.num} ${c}: lowest body / aura vertex ${(lo * 1000).toFixed(1)} mm glb (>= 0)`)
      }
    }
    if (look === 'vulnarkor' || look === 'orethar') {
      const s1 = await sample('walk', 14, 70)
      const legs = (s1?.names ?? []).filter(x => /^b_leg_[lr]_(up|lo|mt|paw)$/.test(x)), d = (s1?.out ?? []).map(o => (o.bones.b_leg_l_paw?.[2] ?? 0) - (o.bones.b_leg_r_paw?.[2] ?? 0))
      ok(legs.length === 8 && !(s1?.names ?? []).some(x => /^b_(fl|fr|hl|hr)_/.test(x)), `#${row.num} upright on the biped rig (${legs.length} leg bones), no quadruped legs`)
      ok(d.length > 0 && Math.max(...d) > 0.05 && Math.min(...d) < -0.05, `#${row.num} walks with feet alternating (${Math.min(...d).toFixed(3)} .. ${Math.max(...d).toFixed(3)} glb)`)
    }
    if (look === 'arcvex' || look === 'vulnoris' || look === 'vulnisk') {
      const s1 = await sample('run', 12, 60), e = (s1?.out ?? []).map(o => o.bones.b_e0_head ?? [0, 0, 0]), ex = e.length ? Math.max(...e.map(q => Math.hypot(q[0] - e[0][0], q[1] - e[0][1], q[2] - e[0][2]))) : 0
      ok(ex > 0.2, `#${row.num} her copies move during the run (copy 0 head travels ${ex.toFixed(3)} glb)`)
    }
    if (look === 'marelle') {   // sheet 4: her hanging jester ears hang (tip below the ear root) and SWING in the walk (the baked springs)
      await p.click('[data-gallery-clip="walk"]').catch(() => {}); await sleep(800)
      const ear = await p.evaluate(async () => {
        const r = (window as any).__spiritModel?.rigs?.get('gallery')?.body; if (!r) return null
        const by = (n: string) => r.bones.find((b: any) => b.name === n), E = by('b_ear_l'), H = by('b_head'), out: number[][] = []
        if (!E || !H) return null
        for (let k = 0; k < 16; k++) { await new Promise(z => setTimeout(z, 60)); r.root.updateMatrixWorld(true); const inv = H.matrixWorld.clone().invert()
          const tip = E.children[0] ?? null, v = (tip ?? E).getWorldPosition(new (E.position.constructor)()).applyMatrix4(inv); out.push([v.x, v.y, v.z]) }
        const e = E.getWorldPosition(new (E.position.constructor)()), h = H.getWorldPosition(new (H.position.constructor)()); return { out, below: e.y < h.y + 0.5 }
      })
      const pts = ear?.out ?? [], spread = pts.length ? Math.max(...pts.map(q => Math.hypot(q[0] - pts[0][0], q[1] - pts[0][1], q[2] - pts[0][2]))) : 0
      const quat = await p.evaluate(async () => { const r = (window as any).__spiritModel?.rigs?.get('gallery')?.body; const E = r?.bones?.find((b: any) => b.name === 'b_ear_l'); if (!E) return 0
        const q0 = E.quaternion.clone(); let mx = 0; for (let k = 0; k < 16; k++) { await new Promise(z => setTimeout(z, 60)); mx = Math.max(mx, 2 * Math.acos(Math.min(1, Math.abs(q0.dot(E.quaternion))))) } return mx })
      ok(quat > 0.15, `#${row.num} Marelle's ears swing in the walk (b_ear_l turns ${quat.toFixed(3)} rad over 1 s; spread ${spread.toFixed(3)})`)
    }
    if (look === 'vulnitar' || look === 'vulnixeth') {   // sheet 4: the splash ring / still pool rides the cloud bone and stays on the ground in the lie
      const s1 = await sample('lie', 6, 250), lo = Math.min(...(s1?.out ?? [{ low: -9 }]).map(o => o.low))
      const cl = await p.evaluate(() => { const r = (window as any).__spiritModel?.rigs?.get('gallery')?.body; return !!r?.bones?.some((b: any) => b.name === 'b_cloud') && !!r?.meshes?.aura })
      ok(cl && lo >= -0.0015 && lo < 0.02, `#${row.num} her ${look === 'vulnitar' ? 'splash ring' : 'still pool'} on its cloud bone stays at the ground in the lie (lowest ${(lo * 1000).toFixed(1)} mm glb)`)
    }
    if (['luminok', 'lumilys', 'lumivex', 'elhae', 'luminthar', 'lumicelle', 'arcet', 'lumiceth'].includes(look)) {   // sheets 5 + 6: Luminel's + Luminarc's four HOVER like them: the hover rig, every clip (body + aura) up in the air
      const s1 = await sample('idle', 2, 100), names = s1?.names ?? []
      ok(names.includes('b_hover') && names.includes('b_fw_l') && !names.some(x => /^b_(fl|fr|hl|hr|leg)_/.test(x)), `#${row.num} on the hover rig (${names.length} bones, b_hover + wing bones, no legs)`)
      for (const c of ['idle', 'walk', 'run', 'sit', 'lie']) {
        const s2 = await sample(c, 6, 250), lo = Math.min(...(s2?.out ?? [{ low: -9 }]).map(o => o.low))
        ok(lo > 1.0, `#${row.num} ${c}: in the air, lowest body / aura vertex ${lo.toFixed(3)} glb (> 1.0)`)
      }
    }
    if (['orebrak', 'lumoraya', 'lumorvex', 'lumorun', 'lumixok', 'marisse', 'lumixis', 'lumixeth'].includes(look)) {   // + sheet 9: Luminix's four (the same break-out)   // sheet 7: Luminore's four BROKE OUT of the egg: on the ground (no hover), on two legs with two arms
      const s1 = await sample('walk', 14, 70), names = s1?.names ?? []
      const BODY_UP: Record<string, number> = { idle: 0.02, walk: 0.03, run: 0.04, sit: 0.03, lie: 0.10 }   // the lie: a folded motif or a raised arm may hold her a little up
      const limbs = ['b_leg_l', 'b_shin_l', 'b_leg_r', 'b_shin_r', 'b_arm_l', 'b_farm_l', 'b_arm_r', 'b_farm_r'].filter(x => names.includes(x))
      ok(limbs.length === 8 && !names.includes('b_hover') && !names.some(x => /^b_(fw|hw)_/.test(x)), `#${row.num} the ground biped: legs + arms (${limbs.length} limb bones), no hover, no wings (${names.length} bones)`)
      for (const c of ['idle', 'walk', 'run', 'sit', 'lie']) {
        const s2 = await sample(c, 6, 250), o = s2?.out ?? [{ low: -9, blow: 9 }], lo = Math.min(...o.map(x => x.low)), bhi = Math.max(...o.map(x => x.blow))
        ok(lo >= -0.0015 && bhi < BODY_UP[c], `#${row.num} ${c}: nothing under the ground (lowest body / aura ${(lo * 1000).toFixed(1)} mm glb) and her body on it (body lowest at most ${(bhi * 1000).toFixed(1)} mm)`)
      }
    }
    if (['mystowk', 'mystowelle', 'mystowis', 'mysteth', 'tidowrok', 'tidelle', 'tidowsk', 'tidowmyr'].includes(look)) {   // + sheet 13: Tideowl's four, the same owl rig   // sheet 8: Mystowl's four are OWLS on the live owl rig: on the ground in idle / walk / sit, the run is flight
      const s1 = await sample('idle', 2, 100), names = s1?.names ?? []
      ok(['b_tuft_l', 'b_wing4_r', 'b_foot_l', 'b_tail2', 'b_lids'].every(x => names.includes(x)) && !names.includes('b_hover'), `#${row.num} on the owl rig (${names.length} bones: tufts, four-joint wings, feet, no hover)`)
      for (const c of ['idle', 'walk', 'sit', 'lie']) {   // the walk is a two-footed HOP (up in the air between landings), so only idle / sit / lie must sit ON the ground
        const s2 = await sample(c, 6, 250), o = s2?.out ?? [{ low: -9, blow: 9 }], lo = Math.min(...o.map(x => x.low)), bhi = Math.max(...o.map(x => x.blow))
        ok(lo >= -0.0015 && (c === 'walk' || bhi < 0.03), `#${row.num} ${c}: nothing under the ground (lowest body / aura ${(lo * 1000).toFixed(1)} mm glb${c === 'walk' ? '' : `, body lowest at most ${(bhi * 1000).toFixed(1)} mm`})`)
      }
      const s3 = await sample('run', 6, 250), lr = Math.min(...(s3?.out ?? [{ low: -9 }]).map(o => o.low))
      ok(lr > 0.08, `#${row.num} run: she FLIES (lowest ${lr.toFixed(3)} glb up)`)
    }
    if (look === 'vulnarok') {
      const s1 = await sample('walk', 14, 70)
      const legs = (s1?.names ?? []).filter(x => /^b_leg_[lr]_(up|lo|mt|paw)$/.test(x)), d = (s1?.out ?? []).map(o => (o.bones.b_leg_l_paw?.[2] ?? 0) - (o.bones.b_leg_r_paw?.[2] ?? 0))
      ok(legs.length === 8 && !(s1?.names ?? []).some(x => /^b_(fl|fr|hl|hr)_/.test(x)), `#${row.num} biped rig: two leg chains (${legs.length} leg bones), no quadruped legs`)
      ok(d.length > 0 && Math.max(...d) > 0.05 && Math.min(...d) < -0.05, `#${row.num} walks with feet alternating (left minus right lead ${Math.min(...d).toFixed(3)} .. ${Math.max(...d).toFixed(3)} glb)`)
      const e = (s1?.out ?? []).map(o => o.bones.b_e0_head ?? [0, 0, 0]), ex = Math.max(...e.map(q => Math.hypot(q[0] - e[0][0], q[1] - e[0][1], q[2] - e[0][2])))
      ok(ex > 0.005, `#${row.num} her echoes move with her (echo 0 head travels ${ex.toFixed(3)} glb in the walk)`)
    }
    if (['croakgulp', 'croakavis', 'araeth', 'oregrak', 'croakorelle', 'croakoris', 'croakormyr', 'croakrillok', 'croakrillvex', 'croakrilleth'].includes(look)) {   // + sheet 12: Croakore's four, the same frog rig   // sheet 11: Croakara's three sitting frogs on the live Croakara rig (hops lift her): nothing under the ground in any clip, her body on it at rest
      const s1 = await sample('idle', 2, 100), names = s1?.names ?? []
      ok(['b_thigh_l', 'b_foot_r', 'b_paw_l', 'b_lure3', 'b_throat'].every(x => names.includes(x)) && !names.includes('b_tail4'), `#${row.num} on the live Croakara frog rig (${names.length} bones: thighs, paws, throat, the lure chain)`)
      for (const c of ['idle', 'walk', 'run', 'sit', 'lie']) {
        const s2 = await sample(c, 6, 250), o = s2?.out ?? [{ low: -9, blow: 9 }], lo = Math.min(...o.map(x => x.low)), bhi = Math.max(...o.map(x => x.blow))
        ok(lo >= -0.003 && (['walk', 'run'].includes(c) || bhi < 0.04), `#${row.num} ${c}: nothing under the ground (lowest body / aura ${(lo * 1000).toFixed(1)} mm glb)${['walk', 'run'].includes(c) ? '' : ` and her body on it (${(bhi * 1000).toFixed(1)} mm)`}`)
      }
    }
    if (['croakarkor', 'croakarielle', 'arcvik', 'croakarcun', 'croakalys', 'rillesse'].includes(look)) {   // + sheet 11: Croakalys stands up on the same biped   // sheet 9b: Croakarc's four: three stand UP on the ground biped (legs + arms + a tail), Arcvik stays the skink; all on the ground, her motif drawn
      const s1 = await sample('walk', 14, 70), names = s1?.names ?? [], up = look !== 'arcvik'
      const limbs = (up ? ['b_leg_l', 'b_shin_l', 'b_leg_r', 'b_shin_r', 'b_arm_l', 'b_farm_l', 'b_arm_r', 'b_farm_r'] : ['b_fl_up', 'b_fr_up', 'b_hl_up', 'b_hr_up']).filter(x => names.includes(x))
      ok(limbs.length === (up ? 8 : 4) && names.includes('b_tail4') && !names.includes('b_hover'), `#${row.num} ${up ? 'the upright biped: legs + arms' : 'the skink: four legs'} + a tail, no hover (${names.length} bones)`)
      for (const c of ['idle', 'walk', 'run', 'sit', 'lie']) {
        const s2 = await sample(c, 6, 250), o = s2?.out ?? [{ low: -9, blow: 9 }], lo = Math.min(...o.map(x => x.low)), bhi = Math.max(...o.map(x => x.blow))
        ok(lo >= -0.003 && bhi < (c === 'lie' ? 0.10 : 0.04), `#${row.num} ${c}: nothing under the ground (lowest body / aura ${(lo * 1000).toFixed(1)} mm glb) and her body on it (body lowest at most ${(bhi * 1000).toFixed(1)} mm)`)
      }
    }
    if (look === 'vulnavex') {
      const s1 = await sample('run', 12, 60), e = (s1?.out ?? []).map(o => o.bones.b_e0_head ?? [0, 0, 0]), ex = e.length ? Math.max(...e.map(q => Math.hypot(q[0] - e[0][0], q[1] - e[0][1], q[2] - e[0][2]))) : 0
      ok(ex > 0.2, `#${row.num} her copies move during the run (copy 0 head travels ${ex.toFixed(3)} glb)`)
    }
    if (look === 'vulnamyr') {   // M244 s1c: EIGHT tails, each its own chain; every clip clears the ground; in the sit the tips stay below her head
      for (const c of ['idle', 'walk', 'run', 'sit', 'lie']) {
        const s1 = await sample(c, 6, 250), lo = Math.min(...(s1?.out ?? [{ low: -9 }]).map(o => o.low))
        if (c === 'idle') { const ch = new Set((s1?.names ?? []).filter(x => /^b_tail_\d_[123]$/.test(x)).map(x => x.split('_')[2])); ok(ch.size === 8 && (s1?.names ?? []).filter(x => /^b_tail_\d_[123]$/.test(x)).length === 24, `#${row.num} EIGHT tail chains on the live rig (${ch.size} chains)`) }
        ok(lo >= -0.0015, `#${row.num} ${c}: lowest body / tails / halo vertex ${(lo * 1000).toFixed(1)} mm glb (>= 0)`)
      }
      const tips = await p.click('[data-gallery-clip="sit"]').then(() => sleep(1500)).then(() => p.evaluate(async () => {
        const r = (window as any).__spiritModel?.rigs?.get('gallery')?.body; if (!r) return null
        const m = r.meshes.body, si = m.geometry.getAttribute('skinIndex'), sw = m.geometry.getAttribute('skinWeight'), names: string[] = r.bones.map((b: any) => b.name), out = []
        for (let k = 0; k < 6; k++) {
          await new Promise(res => setTimeout(res, 300)); r.root.updateMatrixWorld(true); const inv = r.root.matrixWorld.clone().invert(), v = new (r.root.position.constructor)()
          let head = -9, tip = -9
          for (let i = 0; i < si.count; i++) {
            let best = 0, bw = 0; for (let c = 0; c < 4; c++) { const w = sw.getComponent(i, c); if (w > bw) { bw = w; best = si.getComponent(i, c) } }
            const n = names[best]; if (n !== 'b_head' && !/^b_tail_\d_3$/.test(n)) continue
            r.at('body', i, v); v.applyMatrix4(inv); if (n === 'b_head') head = Math.max(head, v.y); else tip = Math.max(tip, v.y)
          }
          out.push({ head, tip })
        }
        return out
      }))
      const worst = Math.max(...(tips ?? [{ head: 0, tip: 9 }]).map(t => t.tip - t.head))
      ok(!!tips && worst < 0, `#${row.num} sit: the tails' tips stay below the top of her head (highest tip minus head top ${(worst * 1000).toFixed(0)} mm glb)`)
    }
    if (look === 'vulnalys') {   // M244 s1c: Vulnara's fox build, bigger like a dire wolf: four legs; body length + height vs Vulnara as drawn
      const names = await p.evaluate(() => ((window as any).__spiritModel?.rigs?.get('gallery')?.body?.bones ?? []).map((b: any) => b.name) as string[])
      ok(['fl', 'fr', 'hl', 'hr'].every(l => names.includes(`b_${l}_paw`)) && !names.some(x => /^b_leg_/.test(x)), `#${row.num} four-legged (fox rig: ${names.filter(x => /_paw$/.test(x)).join(' ')})`)
      const L = await measure(), vr = GALLERY.find(r => r.name === 'Vulnara')
      await p.goto(`${url}/shimmer/dev?mode=spirits&spirit=${vr!.num}`, { waitUntil: 'load', timeout: 240000 }); await p.waitForSelector('[data-spirit-gallery]', { timeout: 120000 })
      let V = await measure(); const t1 = Date.now(); while (Date.now() - t1 < 60000 && !(V && V.n > 2000)) { await sleep(500); V = await measure() }
      const k = AWAKEN_GROW.vulnalys / formGrow('vulnara'), rl = L && V ? L.len * k / V.len : 0, rh = L && V ? L.tall * k / V.tall : 0
      ok(rl >= 1.25 && rh >= 1.25, `#${row.num} dire-wolf size vs Vulnara (#${vr!.num}) as drawn: body length x${rl.toFixed(2)}, height x${rh.toFixed(2)} (>= 1.25)`)
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
