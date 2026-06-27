// Spirit serialization — the save/load contract for a party member. Shared by the 2D game
// (page.tsx) and the 3D walker (play3d/Shimmer3D.tsx) so there is ONE source of truth for what
// survives a save round-trip. Runtime-only fields (animation, pathing) are intentionally dropped;
// createSpirit() re-seeds them on load.
import {
  createSpirit, createInfusions,
  type Spirit, type Species, type Temperament, type Variant, type Element, type Infusions,
} from './spirit'

export interface SpiritSave {
  species: Species
  name: string
  x: number
  y: number
  level: number
  xp: number
  seeds: number[]
  temperament: Temperament
  variant?: Variant
  element?: Element
  infusions?: Infusions
  happiness: number
  bond: number
  fruitBoostUntil: number
  inParty?: boolean
}

export function spiritsToSave(spirits: Spirit[]): SpiritSave[] {
  return spirits.map(s => ({
    species: s.species, name: s.name, x: s.x, y: s.y,
    level: s.level, xp: s.xp, seeds: s.seeds,
    temperament: s.temperament, variant: s.variant, element: s.element,
    infusions: s.infusions,
    happiness: s.happiness,
    bond: s.bond, fruitBoostUntil: s.fruitBoostUntil,
    inParty: s.inParty,
  }))
}

export function spiritsFromSave(saves: SpiritSave[]): Spirit[] {
  return saves.map(s => ({
    ...createSpirit(s.species, s.name, 0, 0),
    x: s.x,
    y: s.y,
    level: s.level ?? 1,
    xp: s.xp ?? 0,
    seeds: s.seeds ?? Array.from({ length: 6 }, () => Math.floor(Math.random() * 32)),
    temperament: s.temperament ?? 'neutral',
    variant: s.variant ?? 'base',
    element: s.element ?? 'base',
    infusions: s.infusions ?? createInfusions(),
    happiness: s.happiness ?? 128,
    bond: s.bond ?? 0,
    fruitBoostUntil: s.fruitBoostUntil ?? 0,
    inParty: s.inParty ?? true,
  }))
}
