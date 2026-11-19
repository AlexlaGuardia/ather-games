// sfx registry gate: proposed / nay never play, yay plays, ONE AudioContext shared with gun-sound. Run: npx tsx src/app/shimmer/open/shared/sfx.test.ts
let made = 0, voices = 0, panners = 0, fetched: string[] = []
const node: any = new Proxy(function () {}, { get: (_t, k) => (k === 'connect' ? () => node : k === 'gain' || k === 'frequency' || k === 'detune' || k === 'playbackRate' ? { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} } : () => (k === 'start' ? voices++ : undefined)), set: () => true })
class FakeAC { state = 'running'; currentTime = 0; sampleRate = 8000; destination = node; constructor() { made++ }
  createGain() { return node } createOscillator() { return node } createBufferSource() { return node } createBiquadFilter() { return node }
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
  const was = row('jump').status
  for (const st of ['proposed', 'nay'] as const) { row('jump').status = st; voices = 0; sfx.play('jump'); ok(voices === 0 && made === 0, `${st} is silent (and makes no context)`) }
  row('jump').status = 'yay'; voices = 0; sfx.play('jump'); ok(voices > 0, 'yay plays')
  sfx.play('no-such-sound'); row('jump').status = 'proposed'
  voices = 0; sfx.audition('jump'); ok(voices > 0, 'audition plays regardless of status')
  for (const i of ids) { voices = 0; sfx.audition(i); ok(voices > 0, `recipe ${i} makes sound`) }
  gun.playShot('repeater'); ok(made === 1, `one AudioContext across sfx + gun-sound (made ${made})`)
  // cadence: 0.5s of walking at 4.2 m/s = 2.1 m = one step at most; stepping is gated by yay too
  row('step-grass').status = 'yay'; voices = 0
  const lc = { px: 0, pz: 0, hvx: 4.2, hvz: 0, vy: 0, airborne: false }
  for (let i = 0; i < 60; i++) sfx.tickFeet(lc, 1 / 30)   // 2 s = 8.4 m ≈ 4 steps
  const steps = voices; ok(steps > 0 && steps < 4 * 8, `footsteps rate-limited to the stride (${steps} voices for 2 s)`)
  row('step-grass').status = 'proposed'; voices = 0; for (let i = 0; i < 60; i++) sfx.tickFeet(lc, 1 / 30); ok(voices === 0, 'a proposed footstep is silent')

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
  ok(recs.length === 8 && recs.every(r => r.status === 'proposed' && r.source === 'cc0' && r.licence && r.files && r.files.length >= 5), 'eight rec-* rows, proposed, cc0, licence, files')
  ok(recs.every(r => [...r.files!, ...(r.layer?.files ?? [])].every(f => f.startsWith('/sfx/') && fs.existsSync('public' + f))), 'every rec file exists under public/sfx')
  ok(sfx.SOUNDS.every(s => sfx.busOf(s) === (s.area === 'ui' ? 'ui' : 'sfx')), 'bus defaults: ui rows ui, rest sfx')
  // file rows: gate unchanged; first play kicks a load (silent), then plays the sample; variant never repeats
  const rec = row('rec-step-grass'); const files = rec.files!
  for (const st of ['proposed', 'nay'] as const) { rec.status = st; voices = 0; fetched.length = 0; sfx.play('rec-step-grass'); ok(voices === 0 && fetched.length === 0, `file row ${st} is silent and fetches nothing`) }
  rec.status = 'yay'; voices = 0; sfx.play('rec-step-grass'); ok(voices === 0 && fetched.length > 0, 'yay file row: first play is non-blocking (loads, silent)')
  sfx.preload('rec-step-grass'); await new Promise(r => setTimeout(r, 20))
  ok(files.every(f => sfx.sampleState(f) === 'ready'), 'all variants decoded and cached')
  const n0 = fetched.length; sfx.preload('rec-step-grass'); ok(fetched.length === n0, 'cache per url: no refetch')
  voices = 0; sfx.play('rec-step-grass'); ok(voices > 0, 'yay file row plays the decoded sample')
  rec.status = 'proposed'; voices = 0; sfx.play('rec-step-grass'); ok(voices === 0, 'file row back to proposed is silent again')
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
  panners = 0; voices = 0; sfx.audition('jump'); ok(panners === 0, '2D play (no at) makes no panner')
  sfx.SOUNDS.find(s => s.id === 'jump')!.status = 'yay'; sfx.play('jump', { at: { x: 10, y: 0, z: 5 } }); ok(panners === 1 && voices > 0, 'play with at routes through one PannerNode')
  sfx.SOUNDS.find(s => s.id === 'jump')!.status = 'proposed'
  ok(sfx.lowpassFor(0) > sfx.lowpassFor(20) && sfx.lowpassFor(20) > sfx.lowpassFor(500) && sfx.lowpassFor(1e6) >= 900, 'lowpass closes with distance, floor 900 Hz')
  ok(made === 1, `still ONE AudioContext after buses/reverb/panner (made ${made})`)
  row('jump').status = was
  console.log(`${pass} passed, ${fails.length} failed`); if (fails.length) { console.log(fails.join('\n')); process.exit(1) }
}
void run()
