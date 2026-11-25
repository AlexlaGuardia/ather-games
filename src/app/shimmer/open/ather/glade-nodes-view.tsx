'use client'
// BETA M153 s1b: the Glade's tutorial nodes, drawn by the Wilds' own meshes (a spent tree thins, a spent crystal is chips, till it is back)
import { Crystals } from './crystal-nodes'
import { Trees } from './wilds-scene'
import type { GladeNodes } from './glade-nodes'

const OFF = { x: 0, z: 0 }
export function GladeNodesView({ nodes, focus }: { nodes: GladeNodes; focus: React.MutableRefObject<{ x: number; z: number }> }) {
  return <group name="glade-nodes"><Trees W={nodes} focus={focus} off={OFF} /><Crystals W={nodes} /></group>
}
