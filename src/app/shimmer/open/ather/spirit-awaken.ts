// ★ BETA M244 RULE s1 (world, 2026-11-28): THE AWAKENING ENGINE. A second-form spirit awakens into one of four branches.
// Canon (read-only law): athernyx world/spirits-species.md › Awakened Form + Magii rulings 9082537 (the rule), 0c84895 (feats
// kept in reserve), a5ad0b0 (Croakara's Champion = eat 99 meals), 91a9756 (Cragowl pure Champion = the full 10 Earth), be0f937.
//   Branch = element: Champion = Earth · Virtuoso = Water · Ace = Storm · Enigma = Mana.
//   The keys, in canon's order: (1) her STEEP (pot.meals, the 10 slots, set for life):
//        PURE branch (her OWN second-form element) = PURE_NEED of it (7-10, per spirit; ours: 8, Cragowl 10);
//        the other three = MIX_OWN of her element + MIX_BRANCH of the branch's (Vulnara > Champion = 4 Mana + 3 Earth);
//     (2) the SAME stat gate as her first evolution (second-form-gate.ts formBar on her own element);
//     (3) her bond MAXED (spirit-dishes.ts BOND_MAX);
//     (+) a FEAT on a handful of awakenings only (AWAKEN_FEATS; Alex picks which; ONE today).
//   Counts are AT LEAST (her other slots are free). A Steep that opens two branches: awakeningDue takes the branch whose element
//   she holds most of, a tie goes to the pure branch, then canon branch order (Jin's tie-break; flag to Alex if it fights a sheet).
// NO player-facing awakening yet: AWAKEN_PUBLIC_LINES is empty (all off). The owner sees the awakened model (keeperAwakenedLook)
// and drives it from her panel's owner dev block (spirit-talk.tsx AwakenDev). Numbers = the hub's (Jin's), not canon.
// ★ PURE: no React, no storage. Run: npx tsx src/app/shimmer/open/ather/spirit-awaken.test.ts
import { AWAKENED_BRANCHES, AWAKENED_NAMES, SECOND_FORM_NAMES, type AwakenedBranch, type Species } from '../../spirits/spirit'
import { formBar, type FormElement, type GateStat, type StatOf } from '../../spirits/second-form-gate'
import { mealCounts, mealsOf } from './infusions'
import { bondOf, mealsEatenOf, BOND_MAX } from './spirit-dishes'
import { AWAKENED_FORMS, type SpiritLook } from './spirit-models'
import { speciesOf, type Pot } from './spirit-seeds'

/** each branch's element (canon 9082537) */
export const BRANCH_ELEMENT: Readonly<Record<AwakenedBranch, FormElement>> = { champion: 'earth', virtuoso: 'water', ace: 'storm', enigma: 'mana' }
export const branchOf = (el: FormElement): AwakenedBranch => AWAKENED_BRANCHES.find(b => BRANCH_ELEMENT[b] === el)!

/** the pure branch's Steep need when her line has no number of its own (canon: 7-10 per spirit; ours: 8) */
export const PURE_NEED_DEFAULT = 8
/** per second form (lowercase name): canon 91a9756 Cragowl's pure Champion = the full 10. Others: Jin's dial. */
export const PURE_NEED: Readonly<Record<string, number>> = { cragowl: 10 }
/** a mixed branch: this many of her own element + this many of the branch's (canon 9082537) */
export const MIX_OWN = 4
export const MIX_BRANCH = 3

/** a feat = the optional EXTRA key on a handful of awakenings (canon 0c84895). Data-driven: Alex assigns the rest. */
export type Feat = { kind: 'mealsEaten'; need: number }
/** keyed `${second form lowercase}:${branch}`. Canon a5ad0b0: Croakara's Champion = eat 99 meals (Pot.mealsEaten, hidden). */
export const AWAKEN_FEATS: Readonly<Record<string, Feat>> = { 'croakara:champion': { kind: 'mealsEaten', need: 99 } }

/** the LINES (second form lowercase) whose awakenings every keeper may take + see. ALL OFF (M244 RULE s1): owner only. */
export const AWAKEN_PUBLIC_LINES: ReadonlySet<string> = new Set<string>()

/** her second form's name, lowercase ('vulnara'), or null = she has not taken it */
export const lineOf = (sp: Species, p: Pick<Pot, 'element'> | undefined): string | null =>
  p?.element ? SECOND_FORM_NAMES[sp]?.[p.element]?.toLowerCase() ?? null : null
/** the awakened form's canon name for this branch (AWAKENED_NAMES), or null = that line's sheet is not named yet */
export const awakenedName = (sp: Species, p: Pick<Pot, 'element'> | undefined, b: AwakenedBranch): string | null => {
  const line = lineOf(sp, p)
  return line ? AWAKENED_NAMES[line]?.[b] ?? null : null
}
export const pureNeed = (line: string | null) => (line && PURE_NEED[line]) || PURE_NEED_DEFAULT
export const featOf = (line: string | null, b: AwakenedBranch): Feat | null => (line ? AWAKEN_FEATS[`${line}:${b}`] ?? null : null)

/** what her Steep must hold for branch `b`: { element: at least n } */
export function steepNeed(own: FormElement, b: AwakenedBranch, line: string | null): Partial<Record<FormElement, number>> {
  const el = BRANCH_ELEMENT[b]
  return el === own ? { [own]: pureNeed(line) } : { [own]: MIX_OWN, [el]: MIX_BRANCH }
}

export type AwakenKeyId = 'form' | 'steep' | 'stat' | 'bond' | 'feat'
export type AwakenKey = { key: AwakenKeyId; met: boolean; have: number; need: number; /** steep: per element; stat: which stat */ detail?: string }
export type AwakenCheck = { branch: AwakenedBranch; element: FormElement; pure: boolean; name: string | null; keys: AwakenKey[]; met: boolean }

/** Every key for branch `b`, met or not (the owner readout shows all of them). `form` = she is a bloomed second form, not yet
 *  awakened. `met` = every key met AND the branch is named (no model, no awakening). */
export function awakenCheck(p: Pot | undefined, sp: Species, b: AwakenedBranch, statOf: StatOf): AwakenCheck {
  const own = p?.element ?? null, line = lineOf(sp, p), el = BRANCH_ELEMENT[b], name = awakenedName(sp, p, b)
  const keys: AwakenKey[] = [{ key: 'form', met: !!p?.bloomed && !!own && !p.awakened, have: own ? 1 : 0, need: 1, detail: p?.awakened ?? own ?? 'base' }]
  if (own) {
    const c = mealCounts(mealsOf(p)), need = steepNeed(own, b, line)
    const parts = (Object.entries(need) as [FormElement, number][])
    keys.push({ key: 'steep', met: parts.every(([e, n]) => c[e] >= n), have: parts.reduce((s, [e, n]) => s + Math.min(c[e], n), 0), need: parts.reduce((s, [, n]) => s + n, 0),
      detail: parts.map(([e, n]) => `${e} ${c[e]}/${n}`).join(' + ') })
    const bar = formBar(sp, own, statOf)
    keys.push({ key: 'stat', met: bar.met, have: Math.floor(bar.have), need: bar.need, detail: bar.stat as GateStat })
  }
  const bond = bondOf(p)
  keys.push({ key: 'bond', met: bond >= BOND_MAX, have: bond, need: BOND_MAX })
  const feat = featOf(line, b)
  if (feat) { const n = mealsEatenOf(p); keys.push({ key: 'feat', met: n >= feat.need, have: n, need: feat.need, detail: feat.kind }) }
  return { branch: b, element: el, pure: el === own, name, keys, met: !!name && keys.length > 1 && keys.every(k => k.met) }
}
/** all four branches, canon order */
export const awakenChecks = (p: Pot | undefined, sp: Species, statOf: StatOf): AwakenCheck[] => AWAKENED_BRANCHES.map(b => awakenCheck(p, sp, b, statOf))

/** the branch she awakens into now, or null. Several open: most of the branch's element in her Steep, then pure, then canon order. */
export function awakeningDue(p: Pot | undefined, sp: Species, statOf: StatOf): AwakenedBranch | null {
  const open = awakenChecks(p, sp, statOf).filter(c => c.met)
  if (!open.length) return null
  const c = mealCounts(mealsOf(p))
  return open.slice().sort((a, b) => (c[b.element] - c[a.element]) || (Number(b.pure) - Number(a.pure)) || (AWAKENED_BRANCHES.indexOf(a.branch) - AWAKENED_BRANCHES.indexOf(b.branch)))[0].branch
}

/** She awakens: `awakened` set for good. Null = she may not (a key unmet). `force` = the OWNER DEV trigger: skips the keys but
 *  still needs a bloomed second form whose branch is named (a model to draw). */
export function awaken(p: Pot | undefined, sp: Species, b: AwakenedBranch, statOf: StatOf, force = false): Pot | null {
  if (!p) return null
  const ck = awakenCheck(p, sp, b, statOf)
  if (force ? !(ck.keys[0].met && ck.name) : !ck.met) return null
  return { ...p, awakened: b }
}
/** a player's line is public only when its flag is on; the owner sees every one */
export const awakenOpen = (sp: Species, p: Pick<Pot, 'element'> | undefined, owner: boolean) => { const l = lineOf(sp, p); return !!l && (owner || AWAKEN_PUBLIC_LINES.has(l)) }

/** her awakened model for this keeper, or null (not awakened, not modelled, or her line not public and not the owner) */
export function keeperAwakenedLook(sp: Species | null | undefined, p: Pot | undefined, owner: boolean): SpiritLook | null {
  if (!sp || !p?.bloomed || !p.awakened || !awakenOpen(sp, p, owner)) return null
  const n = awakenedName(sp, p, p.awakened)
  return n ? AWAKENED_FORMS[n.toLowerCase()] ?? null : null
}
/** her species from a pot (the panel has the pot key, not the species) */
export const potSpecies = (p: Pot | undefined): Species | null => (p?.bloomed ? speciesOf(p.seed) : null)

/** owner dev labels (plain, functional; owner-only, never a player's) */
export const AWAKEN_DEV_UI = {
  header: 'Awakening (owner dev)',
  key: { form: 'Second form', steep: 'Steep', stat: 'Stat gate', bond: 'Bond', feat: 'Feat' } as Record<AwakenKeyId, string>,
  force: (name: string) => `Force: ${name}`,
  unnamed: 'not named yet',
  done: (name: string) => `Awakened: ${name}`,
  reset: 'Undo awakening',
}
