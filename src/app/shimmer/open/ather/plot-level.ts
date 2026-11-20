'use client'
// M47: which floor plan mode is editing (0 = the ground floor). A tiny store so the plan bar, the drawing handlers, the pointer's
// ground plane and the scene's cutaway all read the one value. Leaving plan mode puts it back on the ground floor.
import { useSyncExternalStore } from 'react'
let level = 0
const subs = new Set<() => void>()
export const getPlanLevel = () => level
export const setPlanLevel = (k: number) => { if (k !== level) { level = k; subs.forEach(f => f()) } }
export const usePlanLevel = () => useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f) } }, () => level, () => 0)
