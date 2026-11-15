'use client'
// THE OPEN WORLD'S HUD — one component, every open-world page (Alex 11-15: "id like to have the same ui throughout the
// whole game; compass, minimap, health and mana bars, the hot bar"). It is the Carved Hearth HUD Alex picked on
// 09-23 (Full hearth, `ui/hearth-hud-layer.tsx`: hotbar, vitals, the mana orb, the map frame, the clock, laid out per
// size) plus the compass (`HearthCompass`). The voxel world and the open world now wear one HUD.
//
// What a page supplies: refs it already keeps (where you stand and face, health, mana), its hotbar row, and its own
// minimap canvas sized to `openMapBox(size)` (the frame and the clock under it are drawn here, by the layer).
//
// ⚠ Touch: a phone is laid out as 'phone' whatever its width (landscape phones are ~850 px, which the width rule
// calls 'compact' and puts the mana orb in the bottom-right corner, under the fire and jump buttons).

import React from 'react'
import { HearthHudLayer, hudMapBox } from '../../ui/hearth-hud-layer'
import { HearthCompass, useHudSize, type CompassMark, type CompassPose } from '../../ui/hearth-hud'
import type { HudSize } from '../../ui/hud-flag'
import type { HotbarEntry } from '../../hud/hotbar'
import type { Vitals } from '../../engine/vitals'
import type { EquippedTools } from '../../engine/tools'
import type { SkillSet } from '../../engine/skills'

export type { CompassMark, CompassPose }
export type Mana = { cur: number; max: number; regen: number }

const NO_TOOLS: React.RefObject<EquippedTools | null> = { current: null }
const NO_SKILLS: React.RefObject<SkillSet | null> = { current: null }

export function useOpenHudSize(touch: boolean): HudSize {
  const live = useHudSize()
  return touch ? 'phone' : live
}
export const openMapBox = hudMapBox
/** How far up the bar reaches, so a page's centre-low line (the speedometer) stands above it. */
export { HUD_BAR_CLEAR } from '../../ui/hearth-hud-layer'

export function OpenHud({ size, pose, marks, vitals, mana, entries, sel, held, dimmed, onSelect, objective = null, compassTop }: {
  size: HudSize
  pose: React.RefObject<CompassPose | null>
  marks?: React.RefObject<readonly CompassMark[]>
  /** Omitted = no health readout (a page with nothing that can hurt you yet still shows it full; see the pages). */
  vitals?: React.RefObject<Vitals>
  mana: React.RefObject<Mana | null>
  entries: readonly (HotbarEntry | null)[]
  sel: number
  held: { text: string; out: boolean } | null
  dimmed: boolean
  onSelect?: (i: number) => void
  objective?: string | null
  compassTop?: number
}) {
  return (
    <>
      <HearthHudLayer face="full" size={size} entries={entries} sel={sel} held={held} dimmed={dimmed} onSelect={onSelect}
        objective={objective} vitals={vitals} mana={mana} tools={NO_TOOLS as React.RefObject<EquippedTools>}
        skills={NO_SKILLS as React.RefObject<SkillSet>} activeTool={null} mapFrame={false} />
      <HearthCompass face="full" pose={pose} marks={marks} size={size} top={compassTop} />
    </>
  )
}
