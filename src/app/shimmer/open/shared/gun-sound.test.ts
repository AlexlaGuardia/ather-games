// Run: npx tsx src/app/shimmer/open/shared/gun-sound.test.ts
import { GUN_VOICES, GUN_SOUND_KEY, voices, saveVoices } from './gun-sound'
import { RANGE_GUNS } from './gunplay'
let pass = 0; const fails: string[] = []; const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const store = new Map<string, string>()
;(globalThis as any).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) }
for (const g of RANGE_GUNS) ok(!!GUN_VOICES[g.id], `every range gun has a voice (${g.id})`)
for (const [id, v] of Object.entries(GUN_VOICES)) for (const L of ['breath', 'sizzle', 'ring', 'thump'] as const) ok(Number.isFinite(v[L].gain) && v[L].gain >= 0 && v[L].gain <= 1, `${id}.${L}.gain in 0..1`)
ok(voices() === GUN_VOICES, 'no tune saved = the defaults')
store.set(GUN_SOUND_KEY, '{not json'); ok(voices() === GUN_VOICES, 'a broken saved tune never breaks a shot (defaults)')
ok(!saveVoices('nope'), 'saving bad JSON is refused')
ok(saveVoices(JSON.stringify({ repeater: { ...GUN_VOICES.repeater, ring: { gain: 0.9, freq: 3000, shimmer: 1, decay: 0.1 } } })), 'saving the board JSON works')
ok(voices().repeater.ring.gain === 0.9 && voices().roar === GUN_VOICES.roar, 'a saved tune overrides its gun and leaves the rest default')
console.log(`gun-sound: ${pass}/${fails.length}`); for (const f of fails) console.log('  ✗ ' + f); if (fails.length) process.exit(1)
