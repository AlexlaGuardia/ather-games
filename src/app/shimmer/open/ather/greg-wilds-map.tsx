'use client'

// BETA M236: Greg's Wilds talk plays the map (greg-map.ts holds the rules). Sits in the talk's HUD panel slot (TalkNode.panel),
// above the keeper's answers, so it closes with the talk (Esc / goodbye / walking off) and never touches the real spread map.
// M236 s2 (Alex 11-27: "why didnt we just use the same map.. lets try and use the ather wilds map as a template"): the picture is
// the REAL Ather Wilds map (panels.tsx AreaView, the fold map's Ather side, data-wilds-map) + its signed legend (SpreadLegend),
// round Greg's waymark tile, fed a DISPLAY-ONLY state per stage (greg-map.ts stageRegions) instead of the keeper's. No drawing of
// its own: the old blocky squares are retired.
import { useEffect, useMemo, useState } from 'react'
import { buildGregArea, rippleNext, stageRegions, stageState, turnedAt, FADE_MS, type GregArea, type GregMapStage } from './greg-map'
import { STATE_WORD } from './spread-map'
import { AreaView, SpreadLegend } from './panels'
import { newFog, type Fog } from './explored'
import type { TalkNode } from '../shared/npc-talk'
import type { WildsWorld } from './wilds-world'
import type { Region } from './tile-picture'

const cache = new WeakMap<object, GregArea>()
const NO_WAYMARKS: never[] = []   // one array, so the map's per-tile cache holds across the ripple
let blank: Fog | null = null   // the newborn's fog: nothing walked (display only, never the keeper's)

export function GregWildsMap({ stage, world, tileOff }: { stage: GregMapStage; world: WildsWorld; tileOff: { x: number; z: number } }) {
  const area = useMemo(() => { let a = cache.get(world.index); if (!a) { a = buildGregArea(world.index.tiles, world.index.tileM); cache.set(world.index, a) } return a }, [world])
  // the ripple: zones turn one rank at a time from the moment this stage shows (a timer, not rAF: it must run in a hidden tab too)
  const [turned, setTurned] = useState(turnedAt(stage, area.n))
  useEffect(() => {
    if (stage !== 'ripple') { setTurned(turnedAt(stage, area.n)); return }
    const t0 = performance.now(); setTurned(0)
    let k = 0
    const id = window.setInterval(() => { k = rippleNext(area.n, performance.now() - t0, k); setTurned(k); if (k >= area.n) window.clearInterval(id) }, 70)
    return () => window.clearInterval(id)
  }, [stage, area.n])
  // the fade: the Unseen map is laid over the Hollow one and comes up over FADE_MS (mounted at 0, raised a beat later)
  const dark = stage === 'dark'
  const [up, setUp] = useState(false)
  useEffect(() => { if (!dark) { setUp(false); return } const id = window.setTimeout(() => setUp(true), 40); return () => window.clearTimeout(id) }, [dark])
  const under = useMemo(() => stageRegions(area, dark ? 'hollow' : stage, dark ? area.n : turned), [area, stage, dark, turned])
  const over = useMemo(() => (dark ? stageRegions(area, 'dark', 0) : null), [area, dark])
  const fog = useMemo(() => (dark ? (blank ??= newFog()) : null), [dark])
  const hollow = dark ? 0 : Math.min(turned, area.n)
  const view = (regionsByTile: Map<string, Region[]>, f: Fog | null) => (
    <AreaView world={world} regionsByTile={regionsByTile} cx={area.cx} cz={area.cz} fog={f} tileOff={tileOff} waymarks={NO_WAYMARKS} />
  )
  return (
    <div data-greg-map={stage} data-greg-turned={turned} data-greg-zones={area.n} data-greg-hollow={hollow} data-greg-clear={dark ? 0 : area.n - hollow}
      style={{ background: 'rgba(20,22,26,.82)', borderRadius: 10, padding: 6, boxShadow: '0 4px 14px rgba(0,0,0,.35)' }}>
      <div data-greg-map-view style={{ position: 'relative', width: 'min(100%, 34vh)', aspectRatio: '1', margin: '0 auto', borderRadius: 6, overflow: 'hidden', background: '#334' }}>
        {view(under, null)}
        {over && fog && (
          <div data-greg-dark={up ? '1' : '0'} style={{ position: 'absolute', inset: 0, opacity: up ? 1 : 0, transition: `opacity ${FADE_MS}ms ease-in` }}>
            {view(over, fog)}
          </div>
        )}
      </div>
      <div data-greg-map-word style={{ marginTop: 4, textAlign: 'center', font: '700 10px system-ui', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(243,227,195,.85)' }}>
        {STATE_WORD[stageState(stage)]}
      </div>
      <SpreadLegend style={{ justifyContent: 'center', color: 'rgba(243,227,195,.85)', margin: '2px 0 0' }} />
    </div>
  )
}

/** Greg's tutorial node, with the map in its panel slot when the line names a stage (and the Ather's index is in). */
export function withGregMap(node: TalkNode & { mapStage?: GregMapStage }, ww: WildsWorld | null, tileOff: { x: number; z: number }): TalkNode {
  if (!node.mapStage || !ww) return node
  return { ...node, panel: <GregWildsMap stage={node.mapStage} world={ww} tileOff={tileOff} /> }
}
