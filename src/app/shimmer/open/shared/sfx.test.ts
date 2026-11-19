// sfx registry gate: proposed / nay never play, yay plays, ONE AudioContext shared with gun-sound. Run: npx tsx src/app/shimmer/open/shared/sfx.test.ts
let made = 0, voices = 0, panners = 0, fetched: string[] = []
const node: any = new Proxy(function () {}, { get: (_t, k) => (k === 'connect' ? () => node : k === 'gain' || k === 'frequency' || k === 'detune' || k === 'playbackRate' ? { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} } : () => (k === 'start' ? voices++ : undefined)), set: () => true })
// recording nodes: count creation, starts (= voices) and stop times, so ambience can be checked for leaks and fades
const made_nodes: any[] = []; let clock = 0
const param = () => ({ value: 0, target: undefined as number | undefined, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {}, cancelScheduledValues() {}, setTargetAtTime(v: number) { this.target = v; this.value = v } })
const rec = (kind: string): any => { const r: any = { kind, started: false, stopAt: undefined as number | undefined, gain: param(), frequency: param(), detune: param(), playbackRate: param(), Q: param(), connect() { return this }, disconnect() { r.gone = true }, start() { r.started = true; voices++ }, stop(t: number) { r.stopAt = t } }; made_nodes.push(r); return r }
let base = 0
const liveSources = () => made_nodes.slice(base).filter(r => r.started && !r.gone && (r.stopAt === undefined || r.stopAt > clock)).length
class FakeAC { state = 'running'; get currentTime() { return clock }; sampleRate = 8000; destination = node; constructor() { made++ }
  createGain() { return rec('gain') } createOscillator() { return rec('osc') } createBufferSource() { return rec('src') } createBiquadFilter() { return rec('filter') }
  createPanner() { panners++; return node } createConvolver() { return node } listener = {}; decodeAudioData(b: any) { if (b.bad) throw new Error('bad'); return Promise.resolve({ ok: true }) }
  createBuffer(_c: number, n: number) { return { getChannelData: () => new Float32Array(n) } } resume() {} }
;(globalThis as any).window = { AudioContext: FakeAC }
;(globalThis as any).fetch = (u: string) => { fetched.push(u); return u.includes('missing') ? Promise.reject(new Error('net')) : Promise.resolve({ ok: !u.includes('404'), arrayBuffer: () => Promise.resolve({}) }) }
const store: Record<string, string> = {}
;(globalThis as any).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v } }

const run = async () => {
  const sfx = await import('./sfx'); const gun = await import('./gun-sound')
  let pass = 0; const fails: string[] = []
  const ok = (c: boolean, l: string) => { if (c) pass++; else fails.push(l) }
  const row = (id: string) => sfx.SOUNDS.find(s => s.id === id)!
  const ids = ['step-grass', 'step-stone', 'step-wood', 'jump', 'land', 'hit-axe-tree', 'hit-prune-tree', 'hit-pick-crystal', 'hit-prospect-crystal', 'pickup-grey-matter', 'pickup-item', 'ui-tap', 'ui-panel-open', 'ui-panel-close']
  ok(ids.every(i => row(i)), 'every batch-1 id is in the registry')
  ok(sfx.SOUNDS.every(s => ['proposed', 'yay', 'nay'].includes(s.status) && ['synth', 'cc0'].includes(s.source)), 'registry rows are well-formed')
  const was = row('land').status
  for (const st of ['proposed', 'nay'] as const) { row('land').status = st; voices = 0; sfx.play('land'); ok(voices === 0 && made === 0, `${st} is silent (and makes no context)`) }
  row('land').status = 'yay'; voices = 0; sfx.play('land'); ok(voices > 0, 'yay plays')
  sfx.play('no-such-sound'); row('land').status = 'proposed'
  voices = 0; sfx.audition('land'); ok(voices > 0, 'audition plays regardless of status')
  for (const i of ids) { const r = row(i); if (r.files) { ok(r.files.length > 0 && r.source === 'cc0' && !!r.licence, `${i} plays recorded files (licensed)`); continue } voices = 0; sfx.audition(i); ok(voices > 0, `recipe ${i} makes sound`) }   // 11-19: Alex picked recorded stone/wood/axe/pick
  gun.playShot('repeater'); ok(made === 1, `one AudioContext across sfx + gun-sound (made ${made})`)
  // cadence: 0.5s of walking at 4.2 m/s = 2.1 m = one step at most; stepping is gated by yay too
  row('step-grass').status = 'yay'; voices = 0
  const lc = { px: 0, pz: 0, hvx: 4.2, hvz: 0, vy: 0, airborne: false }
  for (let i = 0; i < 60; i++) sfx.tickFeet(lc, 1 / 30)   // 2 s = 8.4 m ≈ 4 steps
  const steps = voices; ok(steps > 0 && steps < 4 * 8, `footsteps rate-limited to the stride (${steps} voices for 2 s)`)
  row('step-grass').status = 'proposed'; voices = 0; for (let i = 0; i < 60; i++) sfx.tickFeet(lc, 1 / 30); ok(voices === 0, 'a proposed footstep is silent')
  // slide (11-19): the swoosh fires ONCE at the slide's start and no footsteps play while sliding
  { const st0 = row('step-grass').status, sl0 = row('slide').status; row('step-grass').status = 'yay'; row('slide').status = 'yay'
    sfx.preload('slide'); await new Promise(r => setTimeout(r, 20))   // slide is recorded since r4: load first
    const sl = { ...lc, sliding: true }; voices = 0; sfx.tickFeet(sl, 1 / 30); const first = voices
    voices = 0; for (let i = 0; i < 60; i++) sfx.tickFeet(sl, 1 / 30); ok(first > 0 && voices === 0, `slide: plays once at the start (${first}), then silent, no steps (${voices})`)
    row('step-grass').status = st0; row('slide').status = sl0; sfx.tickFeet(lc, 1 / 30) }
  // double jump (11-19): plays on the locomotion's one-tick edge, once
  { const a0 = row('air-jump').status; row('air-jump').status = 'yay'; sfx.preload('air-jump'); await new Promise(r => setTimeout(r, 20)); voices = 0
    sfx.tickFeet({ ...lc, airborne: true, vy: 3, justAirJumped: true }, 1 / 30); const once = voices; voices = 0
    sfx.tickFeet({ ...lc, airborne: true, vy: 2, justAirJumped: false }, 1 / 30); ok(once > 0 && voices === 0, `air jump: plays on the edge only (${once}, then ${voices})`)
    row('air-jump').status = a0; sfx.tickFeet(lc, 1 / 30) }

  // ── M36 quality layer ──
  // variant picker: never repeats back-to-back, covers all variants
  { let last = -1, rep = 0; const seen = new Set<number>(); for (let i = 0; i < 2000; i++) { const v = sfx.pickVariant(5, last); if (v === last) rep++; seen.add(v); last = v }
    ok(rep === 0 && seen.size === 5, `variant picker: no repeats (${rep}) and covers all 5 (${seen.size})`)
    ok(sfx.pickVariant(1, 0) === 0, 'single variant is allowed to repeat')
    const ext = [0, 0.9999999].every(r => { const v = sfx.pickVariant(5, 2, () => r); return v >= 0 && v < 5 && v !== 2 }); ok(ext, 'picker stays in range at rng extremes') }
  // wobble bounds
  { let pOk = true, vOk = true; for (let i = 0; i < 5000; i++) { const w = sfx.wobble(); if (w.pitch < 0.96 || w.pitch > 1.04) pOk = false; if (w.vol < 0.9 || w.vol > 1.1) vOk = false }
    ok(pOk && vOk && sfx.wobble(() => 0).pitch === 0.96 && sfx.wobble(() => 1).vol === 1.1, 'wobble inside +-4% pitch, +-10% volume') }
  // registry: new rec rows are cc0, proposed, with files that exist on disk
  const fs = await import('fs'), recs = sfx.SOUNDS.filter(s => s.id.startsWith('rec-'))
  ok(recs.length >= 1 && recs.every(r => r.status !== 'yay' && r.source === 'cc0' && r.licence && r.files && r.files.length >= 4), 'rec-* candidate rows: never yay (a winner merges into the game id), cc0, licence, files')
  ok(recs.every(r => [...r.files!, ...(r.layer?.files ?? [])].every(f => f.startsWith('/sfx/') && fs.existsSync('public' + f))), 'every rec file exists under public/sfx')
  ok(sfx.SOUNDS.every(s => sfx.busOf(s) === (s.area === 'ui' ? 'ui' : s.area === 'ambience' ? 'ambience' : 'sfx')), 'bus defaults: ui rows ui, ambience rows ambience, rest sfx')
  // file rows: gate unchanged; first play kicks a load (silent), then plays the sample; variant never repeats
  const rec = row('rec-land'); const files = rec.files!
  for (const st of ['proposed', 'nay'] as const) { rec.status = st; voices = 0; fetched.length = 0; sfx.play('rec-land'); ok(voices === 0 && fetched.length === 0, `file row ${st} is silent and fetches nothing`) }
  rec.status = 'yay'; voices = 0; sfx.play('rec-land'); ok(voices === 0 && fetched.length > 0, 'yay file row: first play is non-blocking (loads, silent)')
  sfx.preload('rec-land'); await new Promise(r => setTimeout(r, 20))
  ok(files.every(f => sfx.sampleState(f) === 'ready'), 'all variants decoded and cached')
  const n0 = fetched.length; sfx.preload('rec-land'); ok(fetched.length === n0, 'cache per url: no refetch')
  voices = 0; sfx.play('rec-land'); ok(voices > 0, 'yay file row plays the decoded sample')
  rec.status = 'proposed'; voices = 0; sfx.play('rec-land'); ok(voices === 0, 'file row back to proposed is silent again')
  // missing / failed file: silent, no throw
  { const m = { id: 'rec-missing', area: 'x', status: 'yay', note: '', source: 'cc0', files: ['/sfx/missing.ogg', '/sfx/404.ogg'] } as any; sfx.SOUNDS.push(m)
    let threw = false; try { for (let i = 0; i < 6; i++) { sfx.play('rec-missing'); await new Promise(r => setTimeout(r, 10)) } sfx.audition('rec-missing') } catch { threw = true }
    ok(!threw && sfx.sampleState('/sfx/missing.ogg') === 'fail' && sfx.sampleState('/sfx/404.ogg') === 'fail', 'missing/failed file is silent and does not throw'); sfx.SOUNDS.pop() }
  // layer chance
  { const L = row('rec-step-wood-creak'); ok(!!L.layer && L.layer.chance > 0 && L.layer.chance < 1, 'creak row has an occasional layer') }
  // buses clamp and persist
  sfx.setBusVolume('music', 5); ok(sfx.getBusVolume('music') === 1, 'bus volume clamps to 1')
  sfx.setBusVolume('music', -3); ok(sfx.getBusVolume('music') === 0, 'bus volume clamps to 0')
  sfx.setBusVolume('ui', 0.4); ok(sfx.getBusVolume('ui') === 0.4 && JSON.parse(store['open:sfx-buses.v1']).ui === 0.4, 'bus volume persists to localStorage')
  sfx.setBusVolume('ui', NaN); ok(sfx.getBusVolume('ui') >= 0 && sfx.getBusVolume('ui') <= 1, 'NaN bus volume stays in 0..1')
  // area + 3D + listener
  for (const a of ['open', 'glade', 'town', 'indoor'] as const) { sfx.setArea(a); ok(sfx.currentArea() === a, `setArea ${a}`) }
  sfx.setListener({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 })
  panners = 0; voices = 0; sfx.audition('land'); ok(panners === 0, '2D play (no at) makes no panner')
  sfx.SOUNDS.find(s => s.id === 'land')!.status = 'yay'; sfx.play('land', { at: { x: 10, y: 0, z: 5 } }); ok(panners === 1 && voices > 0, 'play with at routes through one PannerNode')
  sfx.SOUNDS.find(s => s.id === 'land')!.status = 'proposed'
  ok(sfx.lowpassFor(0) > sfx.lowpassFor(20) && sfx.lowpassFor(20) > sfx.lowpassFor(500) && sfx.lowpassFor(1e6) >= 900, 'lowpass closes with distance, floor 900 Hz')
  ok(made === 1, `still ONE AudioContext after buses/reverb/panner (made ${made})`)
  row('land').status = was
  // per-sound level (11-19, Alex: movement too loud): every footstep/movement row carries vol 0.5
  ok(sfx.SOUNDS.filter(s => s.area === 'footsteps' || s.area === 'movement').every(s => s.vol === 0.5), 'movement sounds at half level')
  // ── M36 batch 3: ambience ──
  { const amb = await import('./ambience'); const ids = amb.AMBIENCE_BEDS
    const ambRows = sfx.SOUNDS.filter(s => s.id.startsWith('amb-'))
    ok(ambRows.length === 5 && ambRows.every(r => !!r.desc && r.vol !== undefined && r.vol > 0 && r.vol <= 0.5 && r.area === 'ambience' && r.bus === 'ambience' && r.source === 'synth'), 'every amb-* row has desc + vol, ambience bus, synth')
    ok(ambRows.every(r => ids.includes(r.id)) && ids.every(i => row(i)), 'every amb-* row has a bed recipe and vice versa')
    let nearW = 0; const ticks = (n: number) => { for (let i = 0; i < n; i++) { clock += 1 / 30; amb.ambienceTick(1 / 30, { hour: 12, near: { water: nearW } }) } }
    const made0 = made; base = made_nodes.length
    voices = 0; amb.setAmbience('amb-glade-day'); ticks(30); ok(voices === 0 && amb.ambienceBeds().main === null, 'a proposed bed is silent: no voices')
    { const w0 = row('amb-water').status; row('amb-water').status = 'proposed'; amb.ambienceTick(1 / 30, { near: { water: 1 } }); ok(voices === 0 && amb.ambienceBeds().water === null, 'a proposed water layer is silent too'); row('amb-water').status = w0 }
    const A = row('amb-glade-day'), B = row('amb-wilds-wind'), W = row('amb-water'); A.status = 'yay'; B.status = 'yay'
    voices = 0; amb.setAmbience('amb-glade-day'); ok(voices > 0 && amb.ambienceBeds().main === 'amb-glade-day', `a yay bed starts (${voices} sources)`)
    const outA = amb.ambienceBeds().nodes.main as any; ticks(5); ok(outA.gain.target > 0.3 && outA.gain.target <= 0.35, 'bed fades in towards its vol')
    // events actually fire (birds): more sources appear over 20 s
    const before = made_nodes.length;  ticks(600);  const grew = made_nodes.length - before
    ok(grew > 0 && grew < 400, `sparse events fire but stay sparse (${grew} nodes in 20 s)`)
    // no node growth: live sources are bounded and stable
    ticks(300); const l1 = liveSources(); ticks(600); const l2 = liveSources(); ok(l2 <= l1 + 12 && l2 < 40, `no live-node growth over 600 ticks (${l1} -> ${l2})`)
    // crossfade: A stops, B starts
    amb.setAmbience('amb-wilds-wind'); const st = amb.ambienceBeds(); ok(st.main === 'amb-wilds-wind' && st.dying.includes('amb-glade-day'), 'crossfade starts B, A is dying')
    ok(outA.gain.target === 0, 'A gain target is 0'); const aSrc = made_nodes.filter(r => r.started && r.stopAt !== undefined && r.stopAt <= clock + 3.5 && r.stopAt > clock)
    ok(aSrc.length >= 3, `A's nodes are scheduled to stop within the fade (${aSrc.length})`)
    ticks(30 * 4); ok(amb.ambienceBeds().dying.length === 0 && outA.gone === true, 'A is torn down after the fade')
    ok(liveSources() < 20, `only B is alive after the crossfade (${liveSources()})`)
    // water layer under the bed, volume from near.water
    W.status = 'yay'; nearW = 0.8; ticks(1); ok(amb.ambienceBeds().water === 'amb-water', 'near.water layers the pool bed')
    const outW = amb.ambienceBeds().nodes.water as any; nearW = 0.4; ticks(5); ok(Math.abs(outW.gain.target - 0.14) < 0.01, `water level follows near.water (${outW.gain.target})`)
    nearW = 0; ticks(1); ok(amb.ambienceBeds().water === null && outW.gain.target === 0, 'walking away fades the water layer out')
    // fade out
    const outB = amb.ambienceBeds().nodes.main as any; amb.setAmbience(null); ok(amb.ambienceBeds().main === null && outB.gain.target === 0, 'setAmbience(null) fades out')
    ticks(30 * 4); ok(liveSources() === 0, `silence after the fade: no live sources (${liveSources()})`)
    // yay -> proposed mid-play is honoured at the next setAmbience; unknown ids are silent
    B.status = 'proposed'; voices = 0; amb.setAmbience('amb-wilds-wind'); amb.setAmbience('amb-nope'); ok(voices === 0, 'proposed / unknown bed: silent')
    // audition ignores status, then fades itself
    { const s0 = A.status; A.status = 'proposed'; voices = 0; amb.auditionAmbience('amb-glade-day', 1); ok(voices > 0, 'audition plays a proposed bed'); await new Promise(r => setTimeout(r, 1300)); clock += 5; ok(amb.ambienceBeds().main === null, 'audition fades out and hands the slot back'); A.status = s0 }
    ok(made === made0 && made === 1, `ambience shares the ONE AudioContext (made ${made})`)
    A.status = 'proposed'; B.status = 'proposed'; W.status = 'proposed' }
  console.log(`${pass} passed, ${fails.length} failed`); if (fails.length) { console.log(fails.join('\n')); process.exit(1) }
}
void run()
