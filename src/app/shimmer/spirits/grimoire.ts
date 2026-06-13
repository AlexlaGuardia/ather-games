// Grimoire — full spirit registry (Pokedex)
// Every spirit form in the game: base, second, awakened
// Each entry is its own spirit with its own pixel art

import { ALL_SPECIES } from '../engine/spirit-index'
import { SPECIES_NAMES, SECOND_FORM_NAMES, ELEMENTS, type Species } from './spirit'
import { AWAKENED_FORM_NAMES, type AwakenedBranch } from './evolution-config'

export type FormStage = 'base' | 'second' | 'awakened'

export interface GrimoireEntry {
  id: string              // unique key: 'fox', 'phantom-vulnyx', etc.
  name: string            // display name
  number: number          // grimoire #
  baseSpecies: Species    // which base species this derives from
  form: FormStage
  element?: string        // for evolved forms (mana, storm, earth, water)
  branch?: AwakenedBranch // for awakened forms
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

// Build the full grimoire
function buildGrimoire(): GrimoireEntry[] {
  const entries: GrimoireEntry[] = []
  let num = 1

  // #001-010: Base forms
  for (const sp of ALL_SPECIES) {
    entries.push({
      id: sp,
      name: SPECIES_NAMES[sp] ?? sp,
      number: num++,
      baseSpecies: sp,
      form: 'base',
    })
  }

  // #011-050: Second forms (10 species x 4 elements)
  for (const sp of ALL_SPECIES) {
    const forms = SECOND_FORM_NAMES[sp]
    if (!forms) continue
    for (const el of ELEMENTS) {
      const name = forms[el]
      if (!name) continue
      entries.push({
        id: slugify(name),
        name,
        number: num++,
        baseSpecies: sp,
        form: 'second',
        element: el,
      })
    }
  }

  // #051-210: Awakened forms (10 species x 4 elements x 4 branches)
  const branches: AwakenedBranch[] = ['alpha', 'beta', 'gamma', 'delta']
  for (const sp of ALL_SPECIES) {
    const speciesAwakened = AWAKENED_FORM_NAMES[sp]
    if (!speciesAwakened) continue
    for (const el of ELEMENTS) {
      const elAwakened = speciesAwakened[el]
      if (!elAwakened) continue
      for (const branch of branches) {
        const name = elAwakened[branch]
        entries.push({
          id: name ? slugify(name) : `${sp}-${el}-${branch}`,
          name: name ?? `${SPECIES_NAMES[sp]} ${el} ${branch}`,
          number: num++,
          baseSpecies: sp,
          form: 'awakened',
          element: el,
          branch,
        })
      }
    }
  }

  return entries
}

export const GRIMOIRE = buildGrimoire()

// Lookup helpers
export function getEntry(id: string): GrimoireEntry | undefined {
  return GRIMOIRE.find(e => e.id === id)
}

export function getEntriesByForm(form: FormStage): GrimoireEntry[] {
  return GRIMOIRE.filter(e => e.form === form)
}

export function getEntriesBySpecies(species: Species): GrimoireEntry[] {
  return GRIMOIRE.filter(e => e.baseSpecies === species)
}
