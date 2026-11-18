// settlement-folk.ts: each season's Moglins per settlement, biome-tilted trades, fixed grades, and trust earned by trade.
import { folkOf, wantsLeft, trusted, bring, recruit, stillHome, freshTrust, CANON_NAMES, CANON_POOL, FOLK_MIN, FOLK_MAX, BIOME_TRADES } from './settlement-folk'
import { freshVillage, PROFESSIONS, VILLAGE_CAP } from './moglins'
import { SETTLEMENT_GATHERS, type Settlement, type SettlementBiome } from './network'
import { OPEN_ITEMS } from '../shared/inventory'
import { GARDEN_KEY_SPECS } from '@/lib/keeper-key-specs'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  FAIL', m) } }
const S = (id: string, biome: SettlementBiome): Settlement => ({ id, name: id, x: 0, z: 0, biome })
// deterministic: same season + settlement = same folk; another season = new folk
const a = folkOf(S('s1-0', 'rock'), 1), a2 = folkOf(S('s1-0', 'rock'), 1), b = folkOf(S('s1-0', 'rock'), 2)
ok(JSON.stringify(a) === JSON.stringify(a2), 'same season + settlement = the same folk on every device')
ok(JSON.stringify(a) !== JSON.stringify(b), 'a new season brings new folk (canon: generated fresh each season)')
// shape: counts, unique ids + names, never a canon name, grades 1-5
const many = Array.from({ length: 40 }, (_, k) => folkOf(S(`s1-${k}`, (['shore', 'meadow', 'woods', 'rock'] as const)[k % 4]), 1))
ok(many.every(f => f.length >= FOLK_MIN && f.length <= FOLK_MAX), `${FOLK_MIN}-${FOLK_MAX} folk per settlement`)
ok(many.every(f => new Set(f.map(x => x.name)).size === f.length), 'no two Moglins in a settlement share a name')
ok(many.flat().every(f => !CANON_NAMES.has(f.name.toLowerCase())), 'never a canon name')
// canon names law (shimmer-folds-settlements.md Names): soft-plant pool only, no two living speakers share a name season-wide
const season11 = Array.from({ length: 11 }, (_, k) => folkOf(S(`s1-${k}`, 'meadow'), 1)).flat()
ok(new Set(season11.map(f => f.name)).size === season11.length, `no two Moglins share a name across a whole 11-settlement season (${season11.length} folk)`)
ok(many.flat().every(f => CANON_POOL.includes(f.name)), 'every name comes from canon\'s free-folk pool')
ok(CANON_POOL.length === 60 && new Set(CANON_POOL).size === 60 && CANON_POOL.length >= 11 * FOLK_MAX, 'the pool covers a full season')
ok(many.flat().every(f => Object.values(f.grades).every(g => g >= 1 && g <= 5)), 'grades are 1-5')
ok(many.flat().every(f => PROFESSIONS.includes(f.profession)), 'every trade is a canon trade')
// biome tilt: rock settlements lean to stone trades, shore to cooks
const all = (b: SettlementBiome) => Array.from({ length: 200 }, (_, k) => folkOf(S(`t-${b}-${k}`, b), 1)).flat()
const share = (fs: ReturnType<typeof all>, p: string[]) => fs.filter(f => p.includes(f.profession)).length / fs.length
ok(share(all('rock'), ['stonemason', 'jeweler', 'smith']) > 0.5 && share(all('shore'), ['cook']) > 0.25, `rock leans stone (${share(all('rock'), ['stonemason', 'jeweler', 'smith']).toFixed(2)}), shore leans cook (${share(all('shore'), ['cook']).toFixed(2)})`)
ok(Object.values(BIOME_TRADES).every(w => PROFESSIONS.every(p => (w[p] ?? 0) > 0)), 'every trade can turn up in every biome (the biome only tilts)')
// the hoop: employed folk want goods from OTHER biomes; free folk want nothing
const fl = many.flat()
ok(fl.some(f => f.employed) && fl.some(f => !f.employed), 'some have a job, some do not')
ok(fl.filter(f => !f.employed).every(f => f.wants.length === 0), 'a Moglin with no job comes for the asking (no hoop)')
const homeBiome = (f: { home: string }) => many.findIndex(s => s.some(x => x.home === f.home)) % 4
ok(fl.filter(f => f.employed).every(f => f.wants.length >= 1 && f.wants.every(w => !SETTLEMENT_GATHERS[(['shore', 'meadow', 'woods', 'rock'] as const)[homeBiome(f)]].includes(w.id))), 'an employed Moglin asks for what its settlement LACKS (another biome\'s goods)')
ok(fl.flatMap(f => f.wants).every(w => !!OPEN_ITEMS[w.id] && w.n > 0), 'every want is a real item')
// trust: bring goods, never past the ask; then recruit; the village cap holds; the recruit leaves home
const emp = fl.find(f => f.employed)!, free = fl.find(f => !f.employed)!
let t = freshTrust()
ok(!trusted(emp, t) && trusted(free, t), 'employed: not yet trusted; free: trusted at once')
ok(recruit(freshVillage(), emp, t) === null, 'cannot recruit before the hoop')
for (const w of emp.wants) { const r = bring(t, emp, w.id, w.n + 5); t = r.trust; ok(r.used === w.n, `bring ${w.id}: only ${w.n} counted of ${w.n + 5}`) }
ok(wantsLeft(emp, t).length === 0 && trusted(emp, t), 'all goods brought: trusted')
ok(bring(t, emp, 'not-wanted', 3).used === 0, 'goods it did not ask for are not taken')
let v = recruit(freshVillage(), emp, t)!
ok(!!v && v.moglins.length === 1 && v.moglins[0].id === emp.id && v.moglins[0].profession === emp.profession, 'recruited: the record carries the folk card')
ok(recruit(v, emp, t) === null, 'no recruiting the same Moglin twice')
const home = many.find(s => s.some(x => x.id === emp.id))!
ok(stillHome(home, v).every(f => f.id !== emp.id) && stillHome(home, v).length === home.length - 1, 'a recruit has moved out of its settlement')
for (const f of fl.filter(f => !f.employed)) { const nv = recruit(v, f, t); if (nv) v = nv }
ok(v.moglins.length === VILLAGE_CAP[0], `the cap holds (${v.moglins.length} at stage 0)`)
ok(GARDEN_KEY_SPECS.some(k => k.base === 'open.trust.v1'), 'the trust record is a registered garden key (cloud save carries it)')
console.log(`settlement-folk: ${pass} passed, ${fail} failed`); if (fail) process.exit(1)
