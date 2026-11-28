// BETA M244 RULE s1: the awakening engine. Run: npx tsx src/app/shimmer/open/ather/spirit-awaken.test.ts
import { readFileSync } from 'node:fs'
import {
  BRANCH_ELEMENT, PURE_NEED_DEFAULT, PURE_NEED, MIX_OWN, MIX_BRANCH, AWAKEN_FEATS, AWAKEN_PUBLIC_LINES,
  awakenCheck, awakenChecks, awakeningDue, awaken, keeperAwakenedLook, steepNeed, awakenedName, lineOf,
} from './spirit-awaken'
import { BOND_MAX } from './spirit-dishes'
import { SECOND_FORM_BAR, type StatOf } from '../../spirits/second-form-gate'
import { AWAKENED_FORMS } from './spirit-models'
import { parseBook } from './grimoire-book'
import type { Pot } from './spirit-seeds'
let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
type El = 'mana' | 'storm' | 'earth' | 'water'
const steep = (spec: Partial<Record<El, number>>): El[] => (Object.entries(spec) as [El, number][]).flatMap(([e, n]) => Array(n).fill(e))
const pot = (seed: string, element: El | undefined, meals: El[], bond = BOND_MAX, extra: Partial<Pot> = {}): Pot => ({ seed: seed as Pot['seed'], at: 1, bloomed: true, ...(element ? { element } : {}), meals, bond, ...extra })
const STRONG: StatOf = () => 9999, WEAK: StatOf = () => 0
const keyMet = (p: Pot, sp: Parameters<typeof awakenCheck>[1], b: Parameters<typeof awakenCheck>[2], k: string, st: StatOf = STRONG) => awakenCheck(p, sp, b, st).keys.find(x => x.key === k)?.met

// ── canon: branch = element, numbers read against the canon file (spirits-species.md › Awakened Form)
const canon = readFileSync('/root/athernyx/CANON/world/spirits-species.md', 'utf8')
ok(/Champion = Earth · Virtuoso = Water · Ace = Storm · Enigma = Mana/.test(canon), 'canon still says Champion Earth / Virtuoso Water / Ace Storm / Enigma Mana')
ok(BRANCH_ELEMENT.champion === 'earth' && BRANCH_ELEMENT.virtuoso === 'water' && BRANCH_ELEMENT.ace === 'storm' && BRANCH_ELEMENT.enigma === 'mana', 'branch elements match canon')
ok(/4 of her own element \+ 3 of the branch's element/.test(canon) && MIX_OWN === 4 && MIX_BRANCH === 3, 'mix = 4 own + 3 branch (canon)')
ok(/\*\*7 to 10\*\*/.test(canon) && PURE_NEED_DEFAULT >= 7 && PURE_NEED_DEFAULT <= 10 && Object.values(PURE_NEED).every(n => n >= 7 && n <= 10), 'pure needs inside canon 7-10')
ok(/Cragowl's pure awakening \(Champion, Earth\) asks the FULL 10/.test(canon) && PURE_NEED.cragowl === 10, 'Cragowl pure Champion = 10 (canon 91a9756)')
ok(/Croakara's Champion\*\* awakening .*eat 99 meals/.test(canon) && AWAKEN_FEATS['croakara:champion']?.need === 99 && Object.keys(AWAKEN_FEATS).length === 1, 'ONE feat: Croakara Champion = 99 meals (canon a5ad0b0)')

// ── (1) STEEP. Vulnara (fox, Mana): pure = Enigma (8 Mana); Champion = 4 Mana + 3 Earth
const fox = 'mana_seed_fox'
ok(lineOf('fox', { element: 'mana' }) === 'vulnara' && awakenedName('fox', { element: 'mana' }, 'enigma') === 'Vulnamyr', 'Vulnara pure = Enigma = Vulnamyr')
ok(JSON.stringify(steepNeed('mana', 'enigma', 'vulnara')) === '{"mana":8}' && JSON.stringify(steepNeed('mana', 'champion', 'vulnara')) === '{"mana":4,"earth":3}', 'steepNeed shapes')
ok(awakenCheck(pot(fox, 'mana', steep({ mana: 8 })), 'fox', 'enigma', STRONG).met, 'Vulnara 8 Mana -> Enigma open')
ok(!keyMet(pot(fox, 'mana', steep({ mana: 7, water: 3 })), 'fox', 'enigma', 'steep'), 'Vulnara 7 Mana -> pure NOT open (needs 8)')
ok(awakenCheck(pot(fox, 'mana', steep({ mana: 4, earth: 3 })), 'fox', 'champion', STRONG).met, 'Vulnara 4 Mana + 3 Earth -> Champion (Vulnarok) open')
ok(!keyMet(pot(fox, 'mana', steep({ mana: 3, earth: 4 })), 'fox', 'champion', 'steep'), 'Vulnara 3 Mana + 4 Earth -> Champion NOT open (own element leads)')
ok(!keyMet(pot(fox, 'mana', steep({ mana: 4, earth: 2, storm: 4 })), 'fox', 'champion', 'steep'), 'Vulnara 4 Mana + 2 Earth -> Champion NOT open')
ok(!keyMet(pot(fox, 'mana', steep({ mana: 4, earth: 3 })), 'fox', 'ace', 'steep'), '4 Mana + 3 Earth does not open Ace')
// Cragowl (owl, Earth): pure Champion asks the full 10; 9 is not enough. A mixed branch keeps the 4+3.
ok(!!keyMet(pot('mana_seed_owl', 'earth', steep({ earth: 10 })), 'owl', 'champion', 'steep') && !keyMet(pot('mana_seed_owl', 'earth', steep({ earth: 9, mana: 1 })), 'owl', 'champion', 'steep'), 'Cragowl pure Champion: 9 no, 10 yes')
ok(!!keyMet(pot('mana_seed_owl', 'earth', steep({ earth: 4, water: 3 })), 'owl', 'virtuoso', 'steep'), 'Cragowl Virtuoso = 4 Earth + 3 Water')

// ── (2) the SAME stat gate as her first evolution: formBar on her own element (Vulnara: Mana -> VIG, SECOND_FORM_BAR)
const need = SECOND_FORM_BAR.fox.mana
const at = (v: number): StatOf => k => (k === 'vig' ? v : 0)
ok(keyMet(pot(fox, 'mana', steep({ mana: 8 })), 'fox', 'enigma', 'stat', at(need)) === true && keyMet(pot(fox, 'mana', steep({ mana: 8 })), 'fox', 'enigma', 'stat', at(need - 1)) === false, `stat gate = her evo-1 bar (VIG ${need}): at it yes, one under no`)
ok(!awakenCheck(pot(fox, 'mana', steep({ mana: 8 })), 'fox', 'enigma', WEAK).met, 'weak stats -> not open')

// ── (3) bond maxed
ok(!awakenCheck(pot(fox, 'mana', steep({ mana: 8 }), BOND_MAX - 1), 'fox', 'enigma', STRONG).met && keyMet(pot(fox, 'mana', [], BOND_MAX), 'fox', 'enigma', 'bond') === true, `bond ${BOND_MAX - 1} no, ${BOND_MAX} yes`)

// ── (+) FEAT: Croakara (frog, Mana) Champion needs 99 meals eaten on top; her other branches do not
const frog = 'mana_seed_frog', cp = (n: number) => pot(frog, 'mana', steep({ mana: 4, earth: 3 }), BOND_MAX, { mealsEaten: n })
ok(!awakenCheck(cp(98), 'frog', 'champion', STRONG).met, 'Croakara Champion: 98 meals eaten -> not yet')
ok(awakenCheck(cp(98), 'frog', 'champion', STRONG).keys.some(k => k.key === 'feat' && k.need === 99 && k.have === 98), 'the feat key shows 98/99')
ok(keyMet(cp(98), 'frog', 'champion', 'feat') === false && keyMet(cp(99), 'frog', 'champion', 'feat') === true, 'the feat key: 98 unmet, 99 met')
ok(!awakenCheck(cp(99), 'frog', 'champion', STRONG).met, 'Croakara Champion is UNNAMED: keys met but no form to take (no awakening)')
ok(awakenCheck(cp(99), 'frog', 'champion', STRONG).keys.every(k => k.met), '... every key met at 99')
ok(!awakenCheck(pot(frog, 'mana', steep({ mana: 8 })), 'frog', 'enigma', STRONG).keys.some(k => k.key === 'feat'), 'Croakara Enigma has no feat key')
ok(!awakenCheck(pot(fox, 'mana', steep({ mana: 4, earth: 3 })), 'fox', 'champion', STRONG).keys.some(k => k.key === 'feat'), 'Vulnara Champion has no feat key')

// ── form key: base / awakened / unbloomed
ok(!awakenCheck(pot(fox, undefined, steep({ mana: 8 })), 'fox', 'enigma', STRONG).met, 'a base spirit (no element) cannot awaken')
ok(!awakenCheck(pot(fox, 'mana', steep({ mana: 8 }), BOND_MAX, { awakened: 'enigma' }), 'fox', 'enigma', STRONG).met, 'an awakened spirit does not awaken again')
ok(awakenChecks(pot(fox, 'mana', []), 'fox', STRONG).map(c => c.branch).join() === 'champion,virtuoso,ace,enigma', 'all four branches, canon order')

// ── due: which branch when several open
ok(awakeningDue(pot(fox, 'mana', steep({ mana: 4, earth: 3, storm: 3 })), 'fox', STRONG) === 'champion', 'Champion + Ace open (3 Earth, 3 Storm): tie -> canon order = Champion')
ok(awakeningDue(pot(fox, 'mana', steep({ mana: 8, earth: 2 })), 'fox', STRONG) === 'enigma', '8 Mana -> pure Enigma')
ok(awakeningDue(pot(fox, 'mana', steep({ mana: 4, water: 3, earth: 3 })), 'fox', at(need)) !== null, 'stat exactly at the bar -> due')
ok(awakeningDue(pot(fox, 'mana', steep({ mana: 4, earth: 3 })), 'fox', WEAK) === null, 'weak -> none due')

// ── awaken + force (owner dev)
const ready = pot(fox, 'mana', steep({ mana: 4, earth: 3 }))
ok(awaken(ready, 'fox', 'champion', STRONG)?.awakened === 'champion', 'awaken sets awakened')
ok(awaken(ready, 'fox', 'champion', WEAK) === null, 'awaken refuses unmet keys')
ok(awaken(pot(fox, 'mana', [], 0), 'fox', 'champion', WEAK, true)?.awakened === 'champion', 'force skips the keys')
ok(awaken(pot(fox, undefined, [], 0), 'fox', 'champion', WEAK, true) === null, 'force still needs a second form')
ok(awaken(pot(frog, 'mana', [], 0), 'frog', 'champion', WEAK, true) === null, 'force refuses an unnamed branch (no model)')

// ── the look: owner sees it, players do not (every line's public flag off)
const aw = { ...ready, awakened: 'champion' as const }
ok(keeperAwakenedLook('fox', aw, true) === AWAKENED_FORMS.vulnarok, 'owner: an awakened Vulnara draws Vulnarok')
ok(keeperAwakenedLook('fox', aw, false) === null, 'player: no awakened look (flag off)')
ok(AWAKEN_PUBLIC_LINES.size === 0, 'NO line is public yet (Luminara line awakenings stay owner-only too)')
ok(keeperAwakenedLook('fox', ready, true) === null, 'not awakened -> no awakened look')
ok(keeperAwakenedLook('firefly', { ...pot('mana_seed_firefly', 'storm', []), awakened: 'ace' }, true) === AWAKENED_FORMS.arcet, 'owner: Luminarc Ace draws Arcet')

// ── the save keeps it: parseBook keeps awakened + mealsEaten (mealsEaten used to be dropped on load)
const bk = parseBook({ v: 1, pages: [], met: [], pots: { a: { ...aw, mealsEaten: 42 }, b: { ...pot(fox, undefined, []), awakened: 'ace', mealsEaten: 3 }, c: { ...aw, awakened: 'bogus' } } })
ok(bk.pots.a.awakened === 'champion' && bk.pots.a.mealsEaten === 42, `a save keeps awakened + mealsEaten (${JSON.stringify(bk.pots.a)})`)
ok(bk.pots.b.awakened === undefined && bk.pots.b.mealsEaten === 3, 'a base spirit cannot carry awakened')
ok(bk.pots.c.awakened === undefined, 'a junk branch drops')

console.log(`spirit-awaken: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  FAIL ' + f)
process.exit(fails.length ? 1 : 0)
