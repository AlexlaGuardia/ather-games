'use client'

// BETA M236: Greg's Wilds talk plays the map (greg-map.ts holds the rules). Sits in the talk's HUD panel slot (TalkNode.panel),
// above the keeper's answers, so it closes with the talk (Esc / goodbye / walking off) and never touches the real spread map.
import { useEffect, useMemo, useState } from 'react'
import { buildGregMap, rippleCount, stageState, FADE_MS, type GregMap, type GregMapStage, type IndexTile } from './greg-map'
import { STATE_LOOK, STATE_WORD } from './spread-map'
import type { TalkNode } from '../shared/npc-talk'
import type { WildsWorld } from './wilds-world'

const MEADOW = '#c3d8a0', SEA = '#5c70b2'
const cache = new WeakMap<object, GregMap>()

export function GregWildsMap({ stage, tiles, tileM }: { stage: GregMapStage; tiles: readonly IndexTile[]; tileM: number }) {
  const map = useMemo(() => { let m = cache.get(tiles); if (!m) { m = buildGregMap(tiles, tileM); cache.set(tiles, m) } return m }, [tiles, tileM])
  // the ripple: zones turn one rank at a time from the moment this stage shows (a timer, not rAF: it must run in a hidden tab too)
  const [turned, setTurned] = useState(stage === 'clear' ? 0 : stage === 'ripple' ? 0 : map.n)
  useEffect(() => {
    if (stage === 'clear') { setTurned(0); return }
    if (stage !== 'ripple') { setTurned(map.n); return }
    const t0 = performance.now(); setTurned(0)
    const id = window.setInterval(() => { const k = rippleCount(map.n, performance.now() - t0); setTurned(k); if (k >= map.n) window.clearInterval(id) }, 70)
    return () => window.clearInterval(id)
  }, [stage, map.n])
  const dark = stage === 'dark', shown = stageState(stage), { box } = map
  return (
    <div data-greg-map={stage} data-greg-turned={turned} data-greg-zones={map.n} style={{ background: 'rgba(20,22,26,.82)', borderRadius: 10, padding: 6, boxShadow: '0 4px 14px rgba(0,0,0,.35)' }}>
      <svg viewBox={`${box.x} ${box.z} ${box.w} ${box.h}`} style={{ width: '100%', maxHeight: '34vh', display: 'block', borderRadius: 6, background: SEA }}>
        {map.zones.map((z, k) => {
          const hollow = z.rank < turned, L = STATE_LOOK[hollow ? 'hollow' : 'clear']
          return (
            <g key={k} data-greg-zone={hollow ? 'hollow' : 'clear'}>
              <polygon points={z.pts} fill={MEADOW} stroke="none" />
              <polygon points={z.pts} vectorEffect="non-scaling-stroke" strokeWidth={1}
                style={{ fill: L.fill, stroke: L.line, transition: 'fill .35s ease, stroke .35s ease' }} />
            </g>
          )
        })}
        <rect data-greg-dark={dark ? '1' : '0'} x={box.x} y={box.z} width={box.w} height={box.h}
          style={{ fill: STATE_LOOK.unseen.fill, opacity: dark ? 1 : 0, transition: `opacity ${FADE_MS}ms ease-in` }} />
      </svg>
      <div data-greg-map-word style={{ marginTop: 4, textAlign: 'center', font: '700 10px system-ui', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(243,227,195,.85)' }}>
        {STATE_WORD[shown]}
      </div>
    </div>
  )
}

/** Greg's tutorial node, with the map in its panel slot when the line names a stage (and the Ather's index is in). */
export function withGregMap(node: TalkNode & { mapStage?: GregMapStage }, ww: WildsWorld | null): TalkNode {
  if (!node.mapStage || !ww) return node
  return { ...node, panel: <GregWildsMap stage={node.mapStage} tiles={ww.index.tiles} tileM={ww.index.tileM} /> }
}
