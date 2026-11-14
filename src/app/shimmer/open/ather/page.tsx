'use client'

// /shimmer/open/ather — THE ATHER SIDE of the open world (Alex 11-14, Jin/world).
//
//   · THE HOME PLOT — a full-size floating island cut into a 9×9 garden grid. The middle 3×3 is yours; the rest is
//     under fold-mist until you buy it from GREGORY with grey matter, ring by ring as the grimoire fills (plot.ts).
//     ONE GATE: its face is the fold map. The Ather side shows the Wilds you have walked and your waymarks; Tab flips
//     to Athernyx, where the gate steps you out to a place on the continent. Walk off the edge and the fold brings
//     you back to the threshold.
//   · THE WILDS — the continent's land in the Ather's state (world/ather.md 09-07), one 1 km tile cut from the same
//     height map the coursers drive. F plants a waymark where you stand; standing at one, E opens the fold map too.
//
// The Ather revamp (no holds, Hollows + grey matter, the grimoire's tiers) is Alex's direction, logged [OPEN] in
// CANON_GAPS for Magii; UI copy stays plain until it is authored. Desktop only (pointer lock + keys).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { VoxelDayNight } from '../shared/day-night'
import { terrainWorld } from '../terrain-world'
import { Walker, verbOf, type Loco } from './walker'
import {
  plotShape, plotHeightAt, THRESHOLD, GATE, GREG, FALL_Y, REACH, squareAt, sqId, canBuy,
  loadGarden, saveGarden, freshGarden, type Garden,
} from './plot'
import { PlotScene } from './plot-scene'
import { WildsScene } from './wilds-scene'
import { FoldMap, GregPanel, LANDING, type Dest } from './panels'
import { loadWilds, tileCentreWorld, walkableIn, BIOME_NAME, type Wilds } from './wilds'
import { canPlant, plant, lift, loadWaymarks, saveWaymarks, GREG_WAYMARK, MAX_WAYMARKS, type Waymark } from './waymarks'
import { loadFog, saveFog, reveal, type Fog } from './explored'
import { CombatLayer, type CombatHud } from './combat-layer'
import type { CombatEvent, Terrain } from './combat'

const TILE = 'first-wilds'

type Zone = { kind: 'plot' } | { kind: 'wilds'; tile: string }
type Spawn = { x: number; z: number; yaw: number }
type Panel = null | { kind: 'map'; view: 'ather' | 'athernyx'; travel: boolean } | { kind: 'greg' }
type Near = null | { kind: 'gate' } | { kind: 'greg' } | { kind: 'waymark'; w: Waymark; own: boolean }

export default function AtherSlice() {
  const locked = useRef(false), frozen = useRef(false)
  const [isLocked, setLocked] = useState(false)
  const [zone, setZone] = useState<Zone>({ kind: 'plot' })
  const [spawn, setSpawn] = useState<Spawn>(THRESHOLD)
  const [epoch, setEpoch] = useState(0)
  const [W, setW] = useState<Wilds | null>(null)
  const [fog, setFog] = useState<Fog | null>(null)
  const [waymarks, setWaymarks] = useState<Waymark[]>([])
  const [garden, setGarden] = useState<Garden>(freshGarden)
  const [panel, setPanel] = useState<Panel>(null)
  const [prompt, setPrompt] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [fade, setFade] = useState(0)
  const [hud, setHud] = useState({ verb: 'idle', where: 'your plot' })
  const pos = useRef({ x: THRESHOLD.x, z: THRESHOLD.z, grounded: true, swimming: false })
  const near = useRef<Near>(null)
  const hudT = useRef(0), fogT = useRef(0), fogDirty = useRef(false)
  const [chud, setChud] = useState<CombatHud | null>(null)
  const [reviveKey, setReviveKey] = useState(0)

  useEffect(() => { setWaymarks(loadWaymarks()); setGarden(loadGarden()); setFog(loadFog()) }, [])
  useEffect(() => { loadWilds(TILE).then(setW).catch(e => setToast(`The Wilds would not load: ${e.message}`)) }, [])
  const tileOff = useMemo(() => W ? tileCentreWorld(W.meta) : { x: 0, z: 0 }, [W])
  useEffect(() => {
    const ch = () => { locked.current = !!document.pointerLockElement; setLocked(locked.current) }
    document.addEventListener('pointerlockchange', ch)
    return () => document.removeEventListener('pointerlockchange', ch)
  }, [])
  useEffect(() => {
    frozen.current = panel !== null
    if (panel && document.pointerLockElement) document.exitPointerLock()   // panels are clicked, so free the mouse
  }, [panel])
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3400); return () => clearTimeout(t) }, [toast])
  // persist the walked fog every few seconds and on the way out
  useEffect(() => {
    const flush = () => { if (fog && fogDirty.current) { saveFog(fog); fogDirty.current = false } }
    const t = setInterval(flush, 3000); window.addEventListener('beforeunload', flush)
    return () => { clearInterval(t); window.removeEventListener('beforeunload', flush); flush() }
  }, [fog])

  const owned = useMemo(() => new Set(garden.owned), [garden.owned])
  const plotWorld = useMemo(() => terrainWorld(plotShape(owned)), [owned])
  const updateGarden = useCallback((g: Garden) => { setGarden(g); saveGarden(g) }, [])

  const fading = useRef(false)
  const arrive = useCallback((z: Zone, s: Spawn) => {
    if (fading.current) return
    fading.current = true; setFade(1); setPanel(null)
    setTimeout(() => { setZone(z); setSpawn(s); setEpoch(e => e + 1); setFade(0); fading.current = false }, 380)
  }, [])
  const goHome = useCallback(() => arrive({ kind: 'plot' }, THRESHOLD), [arrive])

  // ── combat in the Wilds ──
  const terrain = useMemo<Terrain | null>(() => W ? {
    heightAt: W.heightAt,
    walkable: (x, z) => walkableIn(W, x, z),
  } : null, [W])
  const gardenRef = useRef(garden); gardenRef.current = garden
  const onCombat = useCallback((evs: CombatEvent[]) => {
    let got = 0
    for (const e of evs) {
      if (e.kind === 'pickup') got += e.amount
      if (e.kind === 'down') {
        setToast('The Hollows dragged you under. The fold caught you and set you down at home.')
        setTimeout(() => setReviveKey(k => k + 1), 400)
        arrive({ kind: 'plot' }, THRESHOLD)
      }
    }
    if (got) { const g = { ...gardenRef.current, grey: gardenRef.current.grey + got }; setGarden(g); saveGarden(g) }
  }, [arrive])

  const travel = useCallback((d: Dest) => {
    if (d.kind === 'home') { goHome(); return }
    if (d.kind === 'waymark') {
      if (!W) { setToast('The Wilds are still loading.'); return }
      arrive({ kind: 'wilds', tile: d.w.tile }, { x: d.w.x + 2.2, z: d.w.z + 2.2, yaw: Math.PI * 0.75 })
      return
    }
    // Athernyx: the gate lets out at its one crossing, Rune Hold's gate-landing (hub's ?at= sets you down there).
    setPanel(null); setFade(1)
    setTimeout(() => { window.location.href = `/shimmer/open/continent?at=${LANDING.id}` }, 380)
  }, [W, arrive, goHome])

  const world = useMemo(() => zone.kind === 'plot' ? plotWorld : W ? terrainWorld(W.shape) : null, [zone, W, plotWorld])
  const ground = useMemo(() => zone.kind === 'plot' ? plotHeightAt : W ? W.heightAt : () => 0, [zone, W])

  const onTick = useCallback((lc: Loco, _yaw: number, dt: number) => {
    pos.current = { x: lc.px, z: lc.pz, grounded: !lc.airborne, swimming: lc.swimming }
    let n: Near = null
    if (zone.kind === 'plot') {
      if (Math.hypot(GATE.x - lc.px, GATE.z - lc.pz) < REACH + 1.2) n = { kind: 'gate' }
      else if (Math.hypot(GREG.x - lc.px, GREG.z - lc.pz) < REACH) n = { kind: 'greg' }
    } else {
      const all = [{ w: GREG_WAYMARK, own: false }, ...waymarks.map(w => ({ w, own: true }))]
      for (const { w, own } of all) if (w.tile === zone.tile && Math.hypot(w.x - lc.px, w.z - lc.pz) < 2.6) n = { kind: 'waymark', w, own }
      fogT.current -= dt
      if (fog && fogT.current <= 0) { fogT.current = 0.25; if (reveal(fog, lc.px + tileOff.x, lc.pz + tileOff.z)) fogDirty.current = true }
    }
    near.current = n
    hudT.current -= dt
    if (hudT.current <= 0) {
      hudT.current = 0.12
      const p = n?.kind === 'gate' ? 'E · the gate (fold map)'
        : n?.kind === 'greg' ? 'E · Gregory (buy ground)'
        : n?.kind === 'waymark' ? (n.own ? 'E · fold map · L lift this waymark' : 'E · fold map') : null
      setPrompt(p)
      let where = 'your plot'
      if (zone.kind === 'wilds' && W) where = BIOME_NAME[W.biomeAt(lc.px, lc.pz)]
      else { const s = squareAt(lc.px, lc.pz); if (!s) where = 'the edge' }
      setHud({ verb: verbOf(lc), where })
    }
  }, [zone, waymarks, W, fog, tileOff])

  const buy = useCallback((i: number, j: number) => {
    const v = canBuy(owned, i, j, garden.pages, garden.grey)
    if (!v.ok) { setToast(v.why); return }
    updateGarden({ ...garden, owned: [...garden.owned, sqId(i, j)], grey: garden.grey - v.cost })
    setToast(`Ground opened. ${garden.grey - v.cost} grey matter left.`)
  }, [owned, garden, updateGarden])

  // Probes for scripted shots and for testing the economy before the Hollows land.
  useEffect(() => {
    const g = window as unknown as { __ather?: Record<string, unknown> }
    g.__ather = {
      ...(g.__ather ?? {}),
      zone: () => zone.kind,
      open: (k: 'gate' | 'greg' | 'athernyx') => setPanel(k === 'greg' ? { kind: 'greg' } : { kind: 'map', view: k === 'athernyx' ? 'athernyx' : 'ather', travel: true }),
      travel: (d: Dest) => travel(d),
      grant: (grey = 0, pages = 0) => updateGarden({ ...garden, grey: garden.grey + grey, pages: garden.pages + pages }),
      resetGarden: () => updateGarden(freshGarden()),
    }
  }, [zone, travel, garden, updateGarden])

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.code === 'Escape' && panel) { setPanel(null); return }
      if (e.code === 'Tab' && panel?.kind === 'map') { e.preventDefault(); setPanel({ ...panel, view: panel.view === 'ather' ? 'athernyx' : 'ather' }); return }
      if (e.code === 'KeyM') { setPanel(p => p ? null : { kind: 'map', view: 'ather', travel: false }); return }
      if (panel || fade) return
      const n = near.current
      if (e.code === 'KeyE' && n) {
        if (n.kind === 'greg') setPanel({ kind: 'greg' })
        else setPanel({ kind: 'map', view: 'ather', travel: true })
        return
      }
      if (e.code === 'KeyF' && zone.kind === 'wilds' && W) {
        const p = pos.current, biome = W.biomeAt(p.x, p.z)
        const v = canPlant(waymarks, { tile: zone.tile, x: p.x, z: p.z, biome, grounded: p.grounded, swimming: p.swimming })
        if (!v.ok) { setToast(v.why); return }
        const next = plant(waymarks, { tile: zone.tile, x: p.x, y: W.heightAt(p.x, p.z), z: p.z, biome })
        setWaymarks(next); saveWaymarks(next)
        setToast(`Waymark bound in the ${BIOME_NAME[biome]}. It is a stop on the fold map now.`)
      }
      if (e.code === 'KeyL' && n?.kind === 'waymark' && n.own) {
        const next = lift(waymarks, n.w.id); setWaymarks(next); saveWaymarks(next); setToast('Waymark lifted.')
      }
      if (e.code === 'KeyH' && zone.kind === 'wilds') goHome()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [panel, fade, zone, waymarks, W, goHome])

  const zoneName = zone.kind === 'plot' ? 'Your plot' : 'The Wilds'
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#bcd6e6' }}>
      <Canvas
        camera={{ fov: 75, near: 0.05, far: 900, position: [THRESHOLD.x, 3, THRESHOLD.z] }}
        onClick={(e) => { if (!panel) (e.target as HTMLCanvasElement).requestPointerLock?.() }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <VoxelDayNight gloomAt={zone.kind === 'wilds' && W ? (x, z) => W.canopyAt(x, z) * 0.7 : undefined} />
        {zone.kind === 'plot' && <PlotScene owned={owned} pages={garden.pages} />}
        {zone.kind === 'wilds' && W && <WildsScene W={W} waymarks={waymarks} />}
        {terrain && (
          <CombatLayer T={terrain} locked={locked} frozen={frozen} active={zone.kind === 'wilds' && fade === 0}
            safe={{ x: GREG_WAYMARK.x, z: GREG_WAYMARK.z, r: 30 }} onEvents={onCombat} onHud={setChud} reviveKey={reviveKey} />
        )}
        {world && (
          <Walker
            key={epoch} world={world} ground={ground} spawn={spawn} locked={locked} frozen={frozen}
            fallY={zone.kind === 'plot' ? FALL_Y : -60}
            onFall={goHome}
            onTick={onTick}
          />
        )}
      </Canvas>
      <div style={{ position: 'absolute', left: '50%', top: '50%', width: 4, height: 4, margin: -2, borderRadius: 2, background: 'rgba(255,255,255,0.85)', boxShadow: '0 0 0 1px rgba(0,0,0,0.35)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', left: 12, top: 12, padding: '6px 10px', borderRadius: 6, background: 'rgba(12,16,20,0.55)', color: '#eef3f6', pointerEvents: 'none' }}>
        <div style={{ font: '600 11px system-ui', letterSpacing: '0.2em', textTransform: 'uppercase' }}>{zoneName}</div>
        <div style={{ font: '11px ui-monospace, monospace', opacity: 0.75, fontVariantNumeric: 'tabular-nums' }}>{hud.where} · {hud.verb}</div>
      </div>
      <div style={{ position: 'absolute', right: 12, top: 12, padding: '6px 10px', borderRadius: 6, background: 'rgba(12,16,20,0.55)', color: '#eef3f6', font: '11px system-ui', letterSpacing: '0.08em', pointerEvents: 'none', textAlign: 'right', lineHeight: 1.5 }}>
        GREY MATTER <span style={{ fontVariantNumeric: 'tabular-nums' }}>{garden.grey}</span><br />
        GRIMOIRE <span style={{ fontVariantNumeric: 'tabular-nums' }}>{garden.pages}</span> · WAYMARKS <span style={{ fontVariantNumeric: 'tabular-nums' }}>{waymarks.length}/{MAX_WAYMARKS}</span><br />
        <span style={{ opacity: 0.65 }}>M map{zone.kind === 'wilds' ? ' · F plant · H home' : ''}</span>
      </div>
      {zone.kind === 'wilds' && chud && (() => {
        const now = performance.now() / 1000, hurt = Math.max(0, 1 - (now - chud.hurtAt) / 0.6), hit = now - chud.hitAt < 0.12
        return (
          <>
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', boxShadow: `inset 0 0 ${120 + hurt * 80}px rgba(70,74,80,${(hurt * 0.75 + (1 - chud.hp / chud.maxHp) * 0.35).toFixed(3)})` }} />
            {hit && <div style={{ position: 'absolute', left: '50%', top: '50%', width: 18, height: 18, margin: -9, border: '2px solid rgba(255,255,255,0.9)', transform: 'rotate(45deg)', borderRadius: 2, pointerEvents: 'none' }} />}
            <div style={{ position: 'absolute', left: 12, bottom: 14, width: 220, pointerEvents: 'none', color: '#eef3f6', font: '11px system-ui', letterSpacing: '0.1em' }}>
              <div style={{ height: 8, borderRadius: 4, background: 'rgba(12,16,20,0.6)', overflow: 'hidden' }}>
                <div style={{ width: `${(chud.hp / chud.maxHp) * 100}%`, height: '100%', background: chud.hp < 35 ? '#e08a6a' : '#9fd27a', transition: 'width 0.15s' }} />
              </div>
            </div>
            <div style={{ position: 'absolute', right: 14, bottom: 14, pointerEvents: 'none', color: '#eef3f6', font: '600 12px system-ui', letterSpacing: '0.14em', textAlign: 'right', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
              {chud.gun}<br /><span style={{ fontSize: 18, fontVariantNumeric: 'tabular-nums' }}>{chud.reloading ? '· · ·' : `${chud.ammo} / ${chud.clip}`}</span><br /><span style={{ opacity: 0.6, fontWeight: 400, fontSize: 10 }}>CLICK FIRE · R RELOAD</span>
            </div>
          </>
        )
      })()}
      {prompt && !panel && (
        <div style={{ position: 'absolute', left: '50%', top: '58%', transform: 'translateX(-50%)', padding: '6px 12px', borderRadius: 6, background: 'rgba(12,16,20,0.65)', color: '#f4efe2', font: '13px system-ui', pointerEvents: 'none' }}>{prompt}</div>
      )}
      {toast && (
        <div style={{ position: 'absolute', left: '50%', bottom: 28, transform: 'translateX(-50%)', padding: '8px 14px', borderRadius: 8, background: 'rgba(24,28,32,0.85)', color: '#f4efe2', font: '13px system-ui', pointerEvents: 'none', maxWidth: '80vw', textAlign: 'center' }}>{toast}</div>
      )}
      {panel?.kind === 'map' && (
        <FoldMap view={panel.view} travel={panel.travel} W={W} fog={fog} waymarks={waymarks} here={pos.current}
          inWilds={zone.kind === 'wilds'} onTravel={travel} tile={TILE} />
      )}
      {panel?.kind === 'greg' && <GregPanel garden={garden} onBuy={buy} onClose={() => setPanel(null)} />}
      <div style={{ position: 'absolute', inset: 0, background: '#f6f1e4', opacity: fade, transition: 'opacity 0.35s', pointerEvents: 'none' }} />
      {!isLocked && !panel && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
          <div style={{ padding: '18px 24px', borderRadius: 10, background: 'rgba(12,16,20,0.72)', color: '#eef3f6', font: '14px system-ui, sans-serif', lineHeight: 1.6, textAlign: 'center', maxWidth: 540 }}>
            <div style={{ font: '600 13px system-ui', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6 }}>Ather · your plot and the Wilds</div>
            Click to play<br />
            WASD move · Space jump / climb · Shift slide · E use · M map · Esc release
            <div style={{ opacity: 0.7, fontSize: 12, marginTop: 6 }}>
              The gate ahead is the fold map: travel to the Wilds, your waymarks, or out to Rune Hold in Athernyx. Gregory, by the threshold, sells the ground under the mist. In the Wilds the Hollows wander: click to shoot, R to reload, walk over grey matter to take it. F plants a waymark, H walks home.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
