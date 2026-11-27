'use client'
// M194: the tool-panel beat for React (shared/game-hud.tsx). Reads the tutorial's save READ-ONLY (never writes a first save),
// rechecks on the tutorial / tools events and once a second (the page's tools ref moves without telling us), and marks the
// beat done the moment a tool panel opens. The rules live in tool-beat.ts (pure, tested).
import { useEffect, useState } from 'react'
import { gardenKey } from '@/lib/keeper-local'
import type { EquippedTools } from '../../engine/tools'
import type { ToolFamily } from '../../ui/hearth-hud-layer'
import { parseTut, saveTut, TUT_KEY, TUT_EVENT, type Tut } from './glade-tutorial'
import { TOOLS_EVENT } from './rinsticks'
import { clearToolBeat, toolBeatFamily, toolBeatOwed } from './tool-beat'

const readTut = (): Tut | null => { try { return parseTut(JSON.parse(localStorage.getItem(gardenKey(TUT_KEY)) ?? 'null')) } catch { return null } }

/** The dial the tutorial points at now (null = none). `picked` = the open tool panel's family (non-null clears the beat). */
export function useToolBeat(tools: { current: EquippedTools | null } | null, families: readonly ToolFamily[], picked: ToolFamily | null, mounted: boolean): ToolFamily | null {
  const [hint, setHint] = useState<ToolFamily | null>(null)
  useEffect(() => {
    if (!mounted) return
    const f = () => setHint(toolBeatFamily(readTut(), tools?.current, families))
    f()
    addEventListener(TUT_EVENT, f); addEventListener(TOOLS_EVENT, f); const id = setInterval(f, 1000)
    return () => { removeEventListener(TUT_EVENT, f); removeEventListener(TOOLS_EVENT, f); clearInterval(id) }
  }, [tools, families, mounted])
  useEffect(() => {
    if (!picked) return
    const t = readTut()
    if (t && toolBeatOwed(t)) saveTut(clearToolBeat(t))   // fires TUT_EVENT: the hint above drops at once
  }, [picked])
  return hint
}
