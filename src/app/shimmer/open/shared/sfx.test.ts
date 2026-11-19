// sfx registry gate: proposed / nay never play, yay plays, ONE AudioContext shared with gun-sound. Run: npx tsx src/app/shimmer/open/shared/sfx.test.ts
let made = 0, voices = 0
const node: any = new Proxy(function () {}, { get: (_t, k) => (k === 'connect' ? () => node : k === 'gain' || k === 'frequency' || k === 'detune' || k === 'playbackRate' ? { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} } : () => (k === 'start' ? voices++ : undefined)), set: () => true })
class FakeAC { state = 'running'; currentTime = 0; sampleRate = 8000; destination = node; constructor() { made++ }
  createGain() { return node } createOscillator() { return node } createBufferSource() { return node } createBiquadFilter() { return node }
  createBuffer(_c: number, n: number) { return { getChannelData: () => new Float32Array(n) } } resume() {} }
;(globalThis as any).window = { AudioContext: FakeAC }
;(globalThis as any).localStorage = { getItem: () => null, setItem() {} }

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
  row('jump').status = was
  console.log(`${pass} passed, ${fails.length} failed`); if (fails.length) { console.log(fails.join('\n')); process.exit(1) }
}
void run()
