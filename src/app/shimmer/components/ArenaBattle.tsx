'use client'
// ── The Keeper's Arena — cinematic battle renderer (sim playback + 4-corner HUD) ──
// One renderer serves the cold-play harness AND the in-world encounter (play3d).
// Pass 2 of the spirit-battle overhaul (2026-07-22): the renderer PERFORMS the sim's
// event stream — move-name callouts (canon names, one-registry ruling), a per-state
// choreography verb for every execute (strike/shield/wave/burst/current/disruption/
// lock), damage + dodge floaters, hit-stop on big hits, KO slow-mo and fall, and
// hold-to-skip (the sim is deterministic — skipping just fast-forwards it).
// No canon lore lives here — names arrive on the events; this file is pure build/play.

import { Canvas, useFrame } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useRef, useState, useCallback } from 'react'
import { createArena, tick, type ArenaState, type KeeperCommand, type Stance, type AidKit, type ArenaEvent, type ArenaAITier } from '../engine/arena'
import type { MoveState } from '../engine/arena-moves'
import { ELEMENT_COLORS, type Element, type Spirit } from '../spirits/spirit'

const ENEMY_GREY = '#787885'

function colorFor(el: Element, side: 'ally' | 'enemy'): string {
  return side === 'enemy' ? ENEMY_GREY : (ELEMENT_COLORS[el] ?? '#7fe3c8')
}

// move-element palette (BattleElement space — neutral is raw mana, cool white)
const MOVE_COLORS: Record<string, string> = {
  mana: '#c98cf0', storm: '#8fd0ff', earth: '#d9a056', water: '#6fd0e6', neutral: '#cfe0da',
}
const STATE_VERB: Record<MoveState, string> = {
  solid: 'STRIKE', compact: 'SHIELD', expanding: 'WAVE', ignite: 'BURST',
  flow: 'CURRENT', scatter: 'DISRUPT', bind: 'LOCK',
}

// ── pacing dials (the cinematic feel lives here) ──
const HITSTOP_S = 0.09          // freeze on a meaty hit
const HITSTOP_HEAVY_S = 0.16    // freeze on a super-effective / heavy landing
const HITSTOP_SCALE = 0.05
const KO_SLOWMO_S = 1.15        // slow-motion window after a KO
const KO_SLOWMO_SCALE = 0.22
const KO_FALL_S = 0.9           // body tips over this long, then fades out
const SKIP_HOLD_S = 0.55        // hold this long to skip

// ── transient FX + floaters (spawned from events, animated on sim time) ──
interface Fx { id: number; kind: MoveState | 'impact'; x: number; y: number; color: string; born: number; life: number; big: boolean }
interface Floater { id: number; x: number; y: number; h: number; text: string; color: string; big: boolean }
export interface Callout { id: number; side: 'ally' | 'enemy'; who: string; move: string; verb: string; color: string; heavy: boolean }

let uid = 1

// ── snapshot the HUD reads (throttled from the sim each frame) ──
interface UISnap {
  mana: number; maxMana: number
  bagCdLeft: number
  allies: { id: string; name: string; element: Element; hp: number; maxHp: number; stance: Stance; windTargeted: boolean }[]
  enemies: { id: string; name: string; element: Element; hp: number; maxHp: number; winding: boolean }[]
  outcome: ArenaState['outcome']
}
function snap(s: ArenaState): UISnap {
  // which allies are the target of a live enemy heavy windup (the ones worth sheltering)
  const windTargets = new Set(s.fighters.filter(f => f.act?.phase === 'windup' && f.act.move.heavy).map(f => f.act!.targetId))
  return {
    mana: s.keeper.mana, maxMana: s.keeper.maxMana,
    bagCdLeft: s.keeper.bagCdLeft,
    allies: s.fighters.filter(f => f.side === 'ally').map(f => ({ id: f.id, name: f.name, element: f.element, hp: f.hp, maxHp: f.maxHp, stance: f.stance, windTargeted: windTargets.has(f.id) })),
    enemies: s.fighters.filter(f => f.side === 'enemy').map(f => ({ id: f.id, name: f.name, element: f.element, hp: f.hp, maxHp: f.maxHp, winding: !!(f.act?.phase === 'windup' && f.act.move.heavy) })),
    outcome: s.outcome,
  }
}

// One FX mesh, self-animating on sim time (so hit-stop freezes the burst too — coherent time).
function FxMesh({ fx, arenaRef }: { fx: Fx; arenaRef: React.RefObject<ArenaState> }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const m = ref.current
    if (!m) return
    const p = Math.min(1, (arenaRef.current!.t - fx.born) / fx.life)
    const mat = m.material as THREE.MeshBasicMaterial
    const size = fx.big ? 1.5 : 1
    switch (fx.kind) {
      case 'impact':                                     // white star-pop at the hit point
        m.scale.setScalar((0.25 + p * 0.9) * size); mat.opacity = 0.85 * (1 - p); break
      case 'solid':                                      // sharp outward ring — the strike lands
        m.scale.setScalar((0.3 + p * 1.4) * size); mat.opacity = 0.7 * (1 - p); break
      case 'compact':                                    // shield ring rising around the caster
        m.scale.setScalar((0.9 + p * 0.5) * size); m.position.y = 0.05 + p * 0.8; mat.opacity = 0.75 * (1 - p * p); break
      case 'expanding':                                  // the wave — a wide ring rolling outward
        m.scale.setScalar((0.4 + p * 2.6) * size); mat.opacity = 0.65 * (1 - p); break
      case 'ignite':                                     // burst flash — a sphere blooming
        m.scale.setScalar((0.2 + p * 1.6) * size); mat.opacity = 0.8 * (1 - p * p); break
      case 'flow':                                       // current — a soft column breathing up
        m.scale.set(0.7 * size, (0.4 + p * 1.6) * size, 0.7 * size); m.position.y = 0.2 + p * 0.5; mat.opacity = 0.55 * (1 - p); break
      case 'scatter':                                    // disruption — a ragged ring wobbling
        m.scale.setScalar((0.5 + p * 1.2) * size); m.rotation.z = p * 2.2; mat.opacity = 0.6 * (1 - p); break
      case 'bind':                                       // the lock — a ring clamping DOWN
        m.scale.setScalar((1.7 - p * 0.8) * size); mat.opacity = 0.75 * Math.min(1, 2 - p * 2); break
    }
  })
  const flat = fx.kind !== 'ignite' && fx.kind !== 'flow'
  return (
    <mesh ref={ref} position={[fx.x, fx.kind === 'compact' ? 0.05 : 0.06, fx.y]} rotation={flat ? [-Math.PI / 2, 0, 0] : [0, 0, 0]}>
      {fx.kind === 'ignite' ? <sphereGeometry args={[0.6, 14, 14]} />
        : fx.kind === 'flow' ? <cylinderGeometry args={[0.5, 0.62, 1, 12, 1, true]} />
        : fx.kind === 'scatter' ? <ringGeometry args={[0.5, 0.86, 7]} />
        : fx.kind === 'impact' ? <ringGeometry args={[0.12, 0.5, 8]} />
        : <ringGeometry args={[0.62, 0.86, 40]} />}
      <meshBasicMaterial color={fx.color} transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  )
}

function Scene({ arenaRef, cmdQueue, skipRef, onSnap, onCallout }: {
  arenaRef: React.RefObject<ArenaState>
  cmdQueue: React.RefObject<KeeperCommand[]>
  skipRef: React.RefObject<boolean>
  onSnap: (u: UISnap) => void
  onCallout: (c: Callout) => void
}) {
  const groups = useRef(new Map<string, THREE.Group>())
  const bodies = useRef(new Map<string, THREE.Mesh>())
  const hpFills = useRef(new Map<string, HTMLDivElement>())
  const rings = useRef(new Map<string, THREE.Mesh>())
  const shields = useRef(new Map<string, THREE.Mesh>())
  const softens = useRef(new Map<string, THREE.Mesh>())
  const poisons = useRef(new Map<string, THREE.Mesh>())
  const collars = useRef(new Map<string, THREE.Mesh>())
  const prevOutcome = useRef<ArenaState['outcome']>('ongoing')
  const acc = useRef(0)
  // pacing + performance state
  const hitStopT = useRef(0)        // realtime seconds of freeze left
  const slowT = useRef(0)           // realtime seconds of KO slow-mo left
  const koAt = useRef(new Map<string, number>())   // fighter id → sim time of KO (drives the fall)
  const fx = useRef<Fx[]>([])
  const floaters = useRef<Floater[]>([])
  const [, bump] = useState(0)

  const spawnFx = (kind: Fx['kind'], x: number, y: number, color: string, big = false, life = 0.45) => {
    fx.current.push({ id: uid++, kind, x, y, color, born: arenaRef.current!.t, life, big })
  }
  const spawnFloat = (x: number, y: number, h: number, text: string, color: string, big = false) => {
    const f = { id: uid++, x, y, h, text, color, big }
    floaters.current.push(f)
    setTimeout(() => { floaters.current = floaters.current.filter(o => o.id !== f.id); bump(n => n + 1) }, 1100)
  }

  // perform one tick's events: choreography FX, floaters, callouts, pacing cues
  function perform(s: ArenaState, evs: ArenaEvent[]) {
    const byId = (id: string) => s.fighters.find(f => f.id === id)
    let changed = false
    for (const e of evs) {
      if (e.type === 'move_start') {
        const f = byId(e.who)
        if (!f) continue
        onCallout({
          id: uid++, side: f.side, who: f.name, move: e.name,
          verb: STATE_VERB[e.state], color: MOVE_COLORS[f.bElement] ?? '#cfe0da', heavy: e.heavy,
        })
      } else if (e.type === 'hit') {
        const to = byId(e.to); const from = byId(e.from)
        if (!to) continue
        const superHit = e.eff === 'super'
        spawnFx('impact', to.x, to.y, superHit ? '#ffd75e' : '#ffffff', superHit)
        // the state verb FX at the point of impact, colored by the move's element lane
        const st = from?.act?.move.state
        if (st && st !== 'compact' && st !== 'flow') spawnFx(st, to.x, to.y, MOVE_COLORS[from!.act!.move.element] ?? '#cfe0da', from!.act!.move.heavy)
        spawnFloat(to.x, to.y, to.radius * 2.2 + 0.9, `-${e.dmg}${superHit ? '!' : ''}`, superHit ? '#ffd75e' : e.eff === 'weak' ? '#8a9a94' : '#f0f4f2', superHit)
        changed = true
        // hit-stop: meaty hits freeze the frame
        if (superHit || e.dmg >= 14) hitStopT.current = Math.max(hitStopT.current, superHit ? HITSTOP_HEAVY_S : HITSTOP_S)
      } else if (e.type === 'dodge') {
        const who = byId(e.who)
        if (!who) continue
        spawnFloat(who.x, who.y, who.radius * 2.2 + 0.8, 'DODGE', '#8fd0ff')
        changed = true
      } else if (e.type === 'miss') {
        const who = byId(e.who)
        if (!who) continue
        spawnFloat(who.x, who.y, who.radius * 2.2 + 0.8, 'FUMBLE', '#8a9a94')
      } else if (e.type === 'status') {
        const who = byId(e.who)
        if (!who) continue
        spawnFloat(who.x, who.y, who.radius * 2.2 + 1.1, e.status.toUpperCase(), '#c98cf0')
        changed = true
      } else if (e.type === 'move_interrupt') {
        const who = byId(e.who)
        if (!who) continue
        spawnFloat(who.x, who.y, who.radius * 2.2 + 1.0, 'INTERRUPTED', '#f0a526', true)
        changed = true
      } else if (e.type === 'ko') {
        koAt.current.set(e.who, s.t)
        slowT.current = KO_SLOWMO_S
        const who = byId(e.who)
        if (who) spawnFx('expanding', who.x, who.y, '#ffffff', true, 0.7)
        changed = true
      }
      // execute FX for self-cast verbs (shield/current) fire on the caster at move start
      if (e.type === 'move_start' && (e.state === 'compact' || e.state === 'flow')) {
        const f = byId(e.who)
        if (f) { spawnFx(e.state, f.x, f.y, e.state === 'compact' ? '#6fd0e6' : '#4fbf87', e.heavy, 0.8); changed = true }
      }
    }
    if (changed) bump(n => n + 1)
  }

  useFrame((_, delta) => {
    const s = arenaRef.current!

    // hold-to-skip fired: fast-forward the deterministic sim to its end, quietly
    if (skipRef.current && s.outcome === 'ongoing') {
      skipRef.current = false
      const cmds = cmdQueue.current.splice(0)
      let guard = 0
      while (s.outcome === 'ongoing' && guard++ < 200 * 30) tick(s, 1 / 30, guard === 1 ? cmds : [])
      fx.current = []; floaters.current = []
      bump(n => n + 1)
      onSnap(snap(s))
      return
    }

    // pacing: hit-stop freezes, KO runs slow — both on REAL time
    let scale = 1
    if (hitStopT.current > 0) { hitStopT.current -= delta; scale = HITSTOP_SCALE }
    else if (slowT.current > 0) { slowT.current -= delta; scale = KO_SLOWMO_SCALE }

    const dt = Math.min(delta, 1 / 20) * scale
    const cmds = cmdQueue.current.splice(0)
    tick(s, dt, cmds)
    perform(s, s.events)

    // the liberation beat: the moment the field is won, every collar shatters — the
    // arc's payoff rendered where it happens (upstream dialogue carries the story).
    if (s.outcome === 'win' && prevOutcome.current === 'ongoing') {
      for (const f of s.fighters) {
        if (!f.collared) continue
        const c = collars.current.get(f.id)
        if (c) c.visible = false
        spawnFx('expanding', f.x, f.y, '#ffd75e', true, 0.9)
        spawnFloat(f.x, f.y, f.radius * 2.2 + 1.0, 'FREED', '#ffd75e', true)
      }
      bump(n => n + 1)
    }
    prevOutcome.current = s.outcome

    // prune expired FX (sim-time life)
    if (fx.current.some(f => s.t - f.born > f.life)) {
      fx.current = fx.current.filter(f => s.t - f.born <= f.life)
      bump(n => n + 1)
    }

    // move blockout bodies imperatively (no React re-render for positions)
    for (const f of s.fighters) {
      const g = groups.current.get(f.id)
      if (!g) continue
      // the KO fall: tip over through KO_FALL_S, then gone
      if (f.hp <= 0) {
        const at = koAt.current.get(f.id)
        const age = at !== undefined ? s.t - at : Infinity
        if (age < KO_FALL_S) {
          g.visible = true
          g.position.set(f.x, 0, f.y)
          const p = age / KO_FALL_S
          g.rotation.z = p * Math.PI / 2
          g.position.y = -p * f.radius * 0.4
        } else g.visible = false
        continue
      }
      g.visible = true
      g.rotation.z = 0
      g.position.set(f.x, 0, f.y)
      g.rotation.y = -f.facing + Math.PI / 2
      // flinch shiver
      if (f.flinch > 0) g.position.x += Math.sin(s.t * 60) * 0.04
      // windup lean: the body coils back through the windup — the telegraph reads on the SILHOUETTE
      const body = bodies.current.get(f.id)
      if (body) {
        const a = f.act
        if (a?.phase === 'windup') {
          const p = a.t / a.dur
          body.rotation.x = -0.28 * p * (a.move.heavy ? 1.6 : 1)
          body.scale.setScalar(1 + f.hitFlash * 1.1 + p * 0.06)
        } else if (a?.phase === 'recover') {
          body.rotation.x = 0.14 * (1 - a.t / a.dur)
          body.scale.setScalar(1 + f.hitFlash * 1.1)
        } else {
          body.rotation.x = 0
          body.scale.setScalar(1 + f.hitFlash * 1.1)
        }
        const mat = body.material as THREE.MeshStandardMaterial
        mat.emissiveIntensity = (f.side === 'ally' ? 0.35 : 0.12) + f.hitFlash * 6
      }
      const fill = hpFills.current.get(f.id)
      if (fill) fill.style.width = `${Math.max(0, (f.hp / f.maxHp) * 100)}%`
    }

    // enemy telegraph rings — one per winding enemy heavy (the clock the Keeper reads)
    for (const f of s.fighters) {
      if (f.side !== 'enemy') continue
      const r = rings.current.get(f.id)
      if (!r) continue
      const act = f.act
      if (act && act.phase === 'windup' && act.move.heavy && f.hp > 0) {
        const tgt = s.fighters.find(g => g.id === act.targetId)
        const p = act.t / act.dur
        const range = act.move.aoe > 0 ? act.move.aoe : 1.0
        if (tgt) { r.visible = true; r.position.set(tgt.x, 0.02, tgt.y); r.scale.setScalar(range * (0.4 + 0.6 * p)) }
        const m = r.material as THREE.MeshBasicMaterial
        m.opacity = 0.25 + 0.55 * p; m.color.setStyle(p > 0.75 ? '#ff5a4d' : '#f0a526')
      } else r.visible = false
    }

    // guard shield — a cyan ground halo under a sheltered ally (blue = protected)
    for (const f of s.fighters) {
      if (f.side !== 'ally') continue
      const sh = shields.current.get(f.id)
      if (!sh) continue
      if (f.shieldT > 0 && f.hp > 0) {
        sh.visible = true; sh.position.set(f.x, 0.03, f.y)
        const m = sh.material as THREE.MeshBasicMaterial
        m.opacity = 0.3 + 0.25 * (0.5 + 0.5 * Math.sin(s.t * 6))   // gentle pulse
      } else sh.visible = false
    }

    // reach soften — a violet ground ring under an enemy whose guard you dropped (defence-down)
    for (const f of s.fighters) {
      if (f.side !== 'enemy') continue
      const so = softens.current.get(f.id)
      if (!so) continue
      if (f.defDownT > 0 && f.hp > 0) {
        so.visible = true; so.position.set(f.x, 0.025, f.y)
        const m = so.material as THREE.MeshBasicMaterial
        m.opacity = 0.35 + 0.3 * (0.5 + 0.5 * Math.sin(s.t * 7))   // pulse — reads as "exposed"
      } else so.visible = false
    }

    // witherbloom — a sickly-green ground ring under a numbed enemy (Frilldrift's toxin: its strikes whiff)
    for (const f of s.fighters) {
      if (f.side !== 'enemy') continue
      const po = poisons.current.get(f.id)
      if (!po) continue
      if (f.numbT > 0 && f.hp > 0) {
        po.visible = true; po.position.set(f.x, 0.02, f.y)
        const m = po.material as THREE.MeshBasicMaterial
        m.opacity = 0.3 + 0.28 * (0.5 + 0.5 * Math.sin(s.t * 4.5))   // slow sickly pulse
      } else po.visible = false
    }

    acc.current += delta
    if (acc.current > 0.08) { acc.current = 0; onSnap(snap(s)) }
  })

  const s0 = arenaRef.current!
  return (
    <>
      {/* camera: orbit + zoom the arena. Pan locked (stays centred), clamped above the floor
          and within a 3/4-to-overhead band so you can't lose the fight off-screen. */}
      <OrbitControls
        makeDefault target={[0, 0.4, 0]} enablePan={false}
        enableDamping dampingFactor={0.08}
        minDistance={7} maxDistance={22}
        minPolarAngle={0.35} maxPolarAngle={1.28}
      />
      <ambientLight intensity={0.7} />
      <directionalLight position={[4, 9, 5]} intensity={1.1} />
      {/* arena floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <circleGeometry args={[s0.R, 56]} />
        <meshStandardMaterial color="#16211f" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <ringGeometry args={[s0.R - 0.12, s0.R, 64]} />
        <meshBasicMaterial color="#2f5c4f" />
      </mesh>
      {/* transient choreography FX */}
      {fx.current.map(f => <FxMesh key={f.id} fx={f} arenaRef={arenaRef as React.RefObject<ArenaState>} />)}
      {/* damage / dodge / status floaters */}
      {floaters.current.map(f => (
        <Html key={f.id} position={[f.x, f.h, f.y]} center distanceFactor={10} pointerEvents="none" zIndexRange={[40, 0]}>
          <div style={{
            font: `${f.big ? '900 20px' : '800 14px'} ui-monospace, monospace`, color: f.color,
            textShadow: '0 1px 3px #000, 0 0 8px #0008', letterSpacing: '0.04em', whiteSpace: 'nowrap',
            animation: 'arenaFloat 1.05s ease-out forwards', userSelect: 'none',
          }}>{f.text}</div>
        </Html>
      ))}
      {/* telegraph rings — one per enemy */}
      {s0.fighters.filter(f => f.side === 'enemy').map(f => (
        <mesh key={'ring-' + f.id} ref={m => { if (m) rings.current.set(f.id, m) }} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
          <ringGeometry args={[0.72, 1, 40]} />
          <meshBasicMaterial color="#f0a526" transparent opacity={0.4} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* guard shield halos — one per ally (shown only while sheltered) */}
      {s0.fighters.filter(f => f.side === 'ally').map(f => (
        <mesh key={'shield-' + f.id} ref={m => { if (m) shields.current.set(f.id, m) }} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
          <ringGeometry args={[f.radius * 0.9, f.radius * 1.15, 40]} />
          <meshBasicMaterial color="#6fd0e6" transparent opacity={0.4} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* reach soften rings — one per enemy (shown only while its guard is down) */}
      {s0.fighters.filter(f => f.side === 'enemy').map(f => (
        <mesh key={'soften-' + f.id} ref={m => { if (m) softens.current.set(f.id, m) }} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
          <ringGeometry args={[f.radius * 0.95, f.radius * 1.3, 32]} />
          <meshBasicMaterial color="#a679ff" transparent opacity={0.4} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* witherbloom poison rings — one per enemy (shown only while the toxin bleeds it) */}
      {s0.fighters.filter(f => f.side === 'enemy').map(f => (
        <mesh key={'poison-' + f.id} ref={m => { if (m) poisons.current.set(f.id, m) }} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
          <ringGeometry args={[f.radius * 1.05, f.radius * 1.4, 32]} />
          <meshBasicMaterial color="#8fd14f" transparent opacity={0.4} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* fighters — element-tinted blockout capsules + floating nameplate/HP */}
      {s0.fighters.map(f => {
        const col = f.collared ? '#4c4c56' : colorFor(f.element, f.side)   // a captive reads MUTED — the collar dims the spirit
        const h = f.radius * 1.2
        return (
          <group key={f.id} ref={g => { if (g) groups.current.set(f.id, g) }} position={[f.x, 0, f.y]}>
            <mesh ref={m => { if (m) bodies.current.set(f.id, m) }} position={[0, f.radius * 0.6 + h / 2, 0]} castShadow>
              <capsuleGeometry args={[f.radius * 0.6, h, 6, 12]} />
              <meshStandardMaterial color={col} emissive={col} emissiveIntensity={f.side === 'ally' ? 0.35 : f.collared ? 0.04 : 0.12} roughness={0.5} />
            </mesh>
            {/* the collar — a dull-ember band at the neck; it shatters (hides + bursts) on the win */}
            {f.collared && (
              <mesh ref={m => { if (m) collars.current.set(f.id, m) }} position={[0, f.radius * 0.6 + h * 0.92, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[f.radius * 0.52, 0.05, 8, 24]} />
                <meshStandardMaterial color="#2a2126" emissive="#b04a30" emissiveIntensity={0.9} roughness={0.4} />
              </mesh>
            )}
            {/* facing nub */}
            <mesh position={[f.radius * 0.7, f.radius * 0.9, 0]}>
              <sphereGeometry args={[0.08, 8, 8]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
            <Html position={[0, f.radius * 1.2 + h + 0.5, 0]} center distanceFactor={10} pointerEvents="none">
              <div style={{ width: 74, textAlign: 'center', userSelect: 'none' }}>
                <div style={{ font: '700 11px ui-monospace, monospace', color: f.side === 'enemy' ? '#c9c9d2' : col, letterSpacing: '0.04em', textShadow: '0 1px 2px #000', marginBottom: 2 }}>{f.name}</div>
                <div style={{ height: 5, background: '#0008', borderRadius: 3, border: '1px solid #0006', overflow: 'hidden' }}>
                  <div ref={d => { if (d) hpFills.current.set(f.id, d) }} style={{ height: '100%', width: '100%', background: f.side === 'enemy' ? '#c0504a' : '#4fbf87', transition: 'width 0.12s linear' }} />
                </div>
              </div>
            </Html>
          </group>
        )
      })}
    </>
  )
}

// ── the four corners ──
function CornerBtn({ label, sub, disabled, accent, cd, cdMax, onClick, style }: {
  label: string; sub?: string; disabled?: boolean; accent: string; cd?: number; cdMax?: number
  onClick: () => void; style: React.CSSProperties
}) {
  const sweep = cd && cdMax ? Math.min(1, cd / cdMax) : 0
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ position: 'absolute', width: 92, height: 62, borderRadius: 12, border: `2px solid ${disabled ? '#ffffff22' : accent}`,
        background: disabled ? '#12181a' : '#12181aee', color: disabled ? '#ffffff55' : '#eafff6', cursor: disabled ? 'default' : 'pointer',
        overflow: 'hidden', touchAction: 'none', ...style }}>
      {sweep > 0 && <div style={{ position: 'absolute', inset: 0, background: '#000', opacity: 0.55, transform: `scaleY(${sweep})`, transformOrigin: 'top', pointerEvents: 'none' }} />}
      <div style={{ position: 'relative', font: '800 13px ui-monospace, monospace', letterSpacing: '0.08em' }}>{label}</div>
      {sub && <div style={{ position: 'relative', font: '600 9px ui-monospace, monospace', opacity: 0.7 }}>{sub}</div>}
    </button>
  )
}

// ── the battle: sim + HUD. One renderer for both the harness and in-world play3d. ──
export default function ArenaBattle({ allies, enemies, seed, aidKit, enemyTier, collaredIndices, title, onEnd, continueLabel = 'CONTINUE' }: {
  allies: Spirit[]
  enemies: Spirit[]
  seed?: number
  aidKit?: AidKit
  enemyTier?: ArenaAITier          // holds pass 'champion' — decision quality, never stats
  collaredIndices?: number[]       // enemy indices rendered as collared captives (freed on win)
  title?: string                   // hold framing, e.g. "HOLD 2 — SORREL'S STRONGHOLD"
  onEnd: (outcome: 'win' | 'lose' | 'fled') => void
  continueLabel?: string
}) {
  const arenaRef = useRef<ArenaState | null>(null)
  if (!arenaRef.current) arenaRef.current = createArena({ allies, enemies, aidKit, enemyTier, collared: collaredIndices, seed: seed ?? ((Math.random() * 1e9) | 0) })
  const cmdQueue = useRef<KeeperCommand[]>([])
  const skipRef = useRef(false)
  const [ui, setUi] = useState<UISnap>(() => snap(arenaRef.current!))
  const [speakOpen, setSpeakOpen] = useState(false)
  const [callouts, setCallouts] = useState<Callout[]>([])
  const [skipHold, setSkipHold] = useState(false)
  const skipTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const send = useCallback((c: KeeperCommand) => { cmdQueue.current.push(c) }, [])
  const onCallout = useCallback((c: Callout) => {
    setCallouts(prev => [...prev.slice(-2), c])
    setTimeout(() => setCallouts(prev => prev.filter(o => o.id !== c.id)), 1500)
  }, [])
  const over = ui.outcome !== 'ongoing'

  const startSkip = () => {
    if (over) return
    setSkipHold(true)
    skipTimer.current = setTimeout(() => { skipRef.current = true; setSkipHold(false) }, SKIP_HOLD_S * 1000)
  }
  const cancelSkip = () => {
    setSkipHold(false)
    if (skipTimer.current) { clearTimeout(skipTimer.current); skipTimer.current = null }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0a0f0e', overflow: 'hidden', touchAction: 'none' }}>
      <style>{`
        @keyframes arenaFloat { 0% { transform: translateY(6px); opacity: 0 } 12% { opacity: 1 } 100% { transform: translateY(-30px); opacity: 0 } }
        @keyframes calloutIn { 0% { transform: translateX(-8px); opacity: 0 } 100% { transform: translateX(0); opacity: 1 } }
        @keyframes skipFill { 0% { width: 0 } 100% { width: 100% } }
        @keyframes holdIntro { 0% { opacity: 0; transform: scale(0.94) } 10% { opacity: 1; transform: scale(1) } 78% { opacity: 1 } 100% { opacity: 0; visibility: hidden } }
      `}</style>
      <Canvas shadows camera={{ position: [0, 10, -9.5], fov: 40 }} style={{ position: 'absolute', inset: 0 }}>
        <color attach="background" args={['#0a0f0e']} />
        <Scene arenaRef={arenaRef as React.RefObject<ArenaState>} cmdQueue={cmdQueue} skipRef={skipRef} onSnap={setUi} onCallout={onCallout} />
      </Canvas>

      {/* title */}
      <div style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', textAlign: 'center', pointerEvents: 'none' }}>
        <div style={{ font: '800 13px ui-monospace, monospace', color: title ? '#f0a526' : '#7fe3c8', letterSpacing: '0.14em', opacity: 0.85, whiteSpace: 'nowrap' }}>{title ?? "THE KEEPER'S ARENA"}</div>
      </div>

      {/* hold intro splash — the boss framing lands big, then hands the screen back */}
      {title && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', animation: 'holdIntro 2.4s ease-out forwards' }}>
          <div style={{ textAlign: 'center', padding: '18px 34px', borderRadius: 14, background: '#0d1413ee', border: '2px solid #f0a526', boxShadow: '0 0 34px #f0a52644' }}>
            <div style={{ font: '900 26px ui-monospace, monospace', color: '#f0a526', letterSpacing: '0.12em' }}>{title}</div>
            <div style={{ font: '700 11px ui-monospace, monospace', color: '#8fa8a0', letterSpacing: '0.2em', marginTop: 6 }}>BREAK THE HOLD</div>
          </div>
        </div>
      )}

      {/* move callouts — the announcer stack, canon move names */}
      <div style={{ position: 'absolute', top: 44, left: 14, display: 'flex', flexDirection: 'column', gap: 5, pointerEvents: 'none' }}>
        {callouts.map(c => (
          <div key={c.id} style={{
            display: 'flex', alignItems: 'baseline', gap: 8, padding: '5px 12px', borderRadius: 8,
            background: '#0d1413dd', border: `1px solid ${c.heavy ? c.color : '#ffffff1c'}`,
            animation: 'calloutIn 0.14s ease-out',
            boxShadow: c.heavy ? `0 0 14px ${c.color}55` : 'none',
          }}>
            <span style={{ font: '700 10px ui-monospace, monospace', color: c.side === 'ally' ? '#7fe3c8' : '#c9c9d2', letterSpacing: '0.05em' }}>{c.who}</span>
            <span style={{ font: `${c.heavy ? '900 15px' : '800 13px'} ui-monospace, monospace`, color: c.color, letterSpacing: '0.06em' }}>{c.move}</span>
            <span style={{ font: '700 8.5px ui-monospace, monospace', color: '#5f7a72', letterSpacing: '0.14em' }}>{c.verb}</span>
          </div>
        ))}
      </div>

      {/* SPEAK — top-right (per-ally tactics, no pause) */}
      <div style={{ position: 'absolute', top: 74, right: 14, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
        <CornerBtn label="SPEAK" sub={speakOpen ? 'close' : 'tactics'} accent="#f0a526" disabled={over}
          onClick={() => setSpeakOpen(o => !o)} style={{ position: 'static' }} />
        {speakOpen && !over && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {ui.allies.map(a => {
              const dead = a.hp <= 0
              return (
                <button key={a.id} disabled={dead}
                  onClick={() => send({ type: 'speak', fighterId: a.id, stance: a.stance === 'aggressive' ? 'defend' : 'aggressive' })}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, width: 130, padding: '7px 11px', borderRadius: 10,
                    border: `2px solid ${dead ? '#ffffff22' : (ELEMENT_COLORS[a.element] ?? '#7fe3c8')}`, background: '#12181aee',
                    color: dead ? '#ffffff44' : '#eafff6', font: '700 11px ui-monospace, monospace', cursor: dead ? 'default' : 'pointer', touchAction: 'none' }}>
                  <span>{a.name}</span>
                  <span style={{ font: '800 10px ui-monospace, monospace', letterSpacing: '0.06em', color: dead ? '#ffffff44' : a.stance === 'aggressive' ? '#f0a526' : '#6fd0e6' }}>
                    {dead ? '—' : a.stance === 'aggressive' ? 'ATK' : 'DEF'}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* BAG — bottom-right (80s lockout) */}
      <CornerBtn label="BAG" sub={ui.bagCdLeft > 0 ? `${Math.ceil(ui.bagCdLeft)}s` : 'heal'} accent="#4fbf87" disabled={over || ui.bagCdLeft > 0}
        cd={ui.bagCdLeft} cdMax={80} onClick={() => send({ type: 'bag' })} style={{ bottom: 22, right: 14 }} />

      {/* FLEE — bottom-left */}
      <CornerBtn label="FLEE" accent="#b06a6a" disabled={over} onClick={() => send({ type: 'flee' })} style={{ bottom: 22, left: 14 }} />

      {/* HOLD TO SKIP — the fight is deterministic; skipping fast-forwards it */}
      {!over && (
        <button
          onPointerDown={startSkip} onPointerUp={cancelSkip} onPointerLeave={cancelSkip}
          style={{ position: 'absolute', top: 14, right: 14, width: 108, height: 34, borderRadius: 10,
            border: '2px solid #ffffff2a', background: '#12181acc', color: '#8fa8a0', cursor: 'pointer',
            overflow: 'hidden', touchAction: 'none' }}>
          {skipHold && <div style={{ position: 'absolute', inset: 0, background: '#7fe3c833', animation: `skipFill ${SKIP_HOLD_S}s linear forwards` }} />}
          <span style={{ position: 'relative', font: '700 10px ui-monospace, monospace', letterSpacing: '0.1em' }}>HOLD ⏩ SKIP</span>
        </button>
      )}

      {/* result — hands the outcome back to the caller (rewards/dialogue live upstream) */}
      {over && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0a0f0ecc' }}>
          <div style={{ font: '900 30px ui-monospace, monospace', color: ui.outcome === 'win' ? '#7fe3c8' : ui.outcome === 'fled' ? '#c9c9d2' : '#e08a7a', letterSpacing: '0.1em' }}>
            {ui.outcome === 'win' ? 'THE FIELD IS YOURS' : ui.outcome === 'fled' ? 'YOU SLIPPED AWAY' : 'YOUR SPIRIT FELL'}
          </div>
          <button onClick={() => onEnd(ui.outcome as 'win' | 'lose' | 'fled')}
            style={{ marginTop: 22, padding: '12px 28px', borderRadius: 12, border: '2px solid #7fe3c8', background: '#12181a', color: '#eafff6', font: '800 14px ui-monospace, monospace', letterSpacing: '0.1em', cursor: 'pointer' }}>{continueLabel}</button>
        </div>
      )}

      {/* hint */}
      {!over && <div style={{ position: 'absolute', bottom: 26, left: '50%', transform: 'translateX(-50%)', font: '600 10px ui-monospace, monospace', color: '#5f7a72', textAlign: 'center', maxWidth: 268, pointerEvents: 'none' }}>Your spirit fights on its own instinct — you raised it for this.</div>}
    </div>
  )
}
