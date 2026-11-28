// M226: the OK'd second forms + bases are every keeper's. Run: npx tsx src/app/shimmer/open/ather/spirit-public.test.ts
import { PUBLIC_FORMS, keeperFormLook } from './spirit-public'
import { SECOND_FORMS, formLook, spiritModelFor, rigLook, type SpiritElement } from './spirit-models'
import { BASE_PREVIEW } from './spirit-base-preview'
import type { Species } from '../../spirits/spirit'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const EL: SpiritElement[] = ['mana', 'storm', 'earth', 'water']

// the Athowl + Hovari lines (all four forms) and Aurlotl: a player (owner false) sees the form itself
for (const sp of ['owl', 'hummingbird'] as Species[]) for (const el of EL) {
  const f = formLook(sp, el)
  ok(!!f && keeperFormLook(sp, el, false) === f, `${sp}/${el}: a player's evolved spirit draws ${f?.name}`)
}
ok(keeperFormLook('axolotl', 'mana', false)?.name === 'aurlotl', 'axolotl/mana: a player sees Aurlotl')
// every other modelled form stays the owner's (a player gets null = her base look), and the owner still sees every form
let gated = 0
for (const [sp, forms] of Object.entries(SECOND_FORMS) as [Species, Partial<Record<SpiritElement, { name: string }>>][]) for (const el of EL) {
  const f = forms[el]; if (!f) continue
  ok(keeperFormLook(sp, el, true) === formLook(sp, el), `${sp}/${el}: the owner sees ${f.name}`)
  if (!PUBLIC_FORMS.has(f.name)) { gated++; ok(keeperFormLook(sp, el, false) === null, `${sp}/${el}: ${f.name} stays owner preview`) }
}
ok(gated >= 8, `the not-yet-OK'd forms stay gated (${gated}: Vulnyx line, Marlotl, Arclotl, Craglotl, bears, Noctyx line...)`)
// M202: the Shellmere + Croakling + Lepara + Luminara lines (all four forms each) are every keeper's
for (const sp of ['turtle', 'frog', 'rabbit', 'firefly'] as Species[]) for (const el of EL) {
  const f = formLook(sp, el)
  ok(!!f && keeperFormLook(sp, el, false) === f, `${sp}/${el}: a player's evolved spirit draws ${f?.name}`)
}
// every name in the allowlist is a real modelled form (a typo would silently gate it)
const names = new Set(Object.values(SECOND_FORMS).flatMap(f => Object.values(f ?? {}).map(l => l!.name)))
for (const n of PUBLIC_FORMS) ok(names.has(n), `${n}: a modelled form`)
ok(PUBLIC_FORMS.size === 25, `twenty-five public forms (${PUBLIC_FORMS.size})`)
for (const n of ['lepaura', 'leparc', 'lepore', 'lepnix']) ok(PUBLIC_FORMS.has(n), `${n}: the Lepara line is public (Alex YAY 11-28)`)
for (const n of ['luminel', 'luminarc', 'luminore', 'luminix']) ok(PUBLIC_FORMS.has(n), `${n}: the Luminara line is public (hub YAY 11-28, Alex delegated)`)
ok(keeperFormLook('owl', null, false) === null && keeperFormLook(null, 'mana', false) === null, 'no element / no species = no form')
// the four bases: every keeper's model, rigged, flier hover kept for Luminara
for (const sp of ['rabbit', 'turtle', 'frog', 'firefly'] as Species[]) {
  const L = spiritModelFor(sp)
  ok(!!L && L === BASE_PREVIEW[sp] && rigLook(sp, L, true) === L, `${sp}: every keeper draws ${L?.name}`)
}
ok(!!spiritModelFor('firefly')?.rig?.hover, 'luminara hovers (rig.hover)')

console.log(`spirit-public: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  FAIL ' + f)
if (fails.length) process.exit(1)
