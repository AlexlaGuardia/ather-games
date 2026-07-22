'use client'
// ── The Keeper's Arena — reusable real-time battle (renderer + 4-corner HUD) ──────
// Extracted from the /shimmer/arena test harness so ONE renderer serves both the
// cold-play harness AND the in-world encounter (play3d). Give it a party + enemies
// (real Spirit objects) and an onEnd(outcome); it runs the sim in engine/arena.ts,
// draws blockout primitives on a disc with the 3/4-iso Keeper HUD, and calls onEnd
// when the field settles. No canon lore lives here — pure build/play.

import { Canvas, useFrame } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useRef, useState, useCallback } from 'react'
import { createArena, tick, type ArenaState, type KeeperCommand, type AidId, type Stance, type AidKit } from '../engine/arena'
import { ELEMENT_COLORS, type Element, type Spirit } from '../spirits/spirit'

const ENEMY_GREY = '#787885'

function colorFor(el: Element, side: 'ally' | 'enemy'): string {
  return side === 'enemy' ? ENEMY_GREY : (ELEMENT_COLORS[el] ?? '#7fe3c8')
}

// ── snapshot the HUD reads (throttled from the sim each frame) ──
interface UISnap {
  mana: number; maxMana: number
  aid: { id: AidId; name: string; cost: number; cdLeft: number; cd: number }[]
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
    aid: s.keeper.aid.map(a => ({ id: a.id, name: a.name, cost: a.cost, cdLeft: a.cdLeft, cd: a.cd })),
    bagCdLeft: s.keeper.bagCdLeft,
    allies: s.fighters.filter(f => f.side === 'ally').map(f => ({ id: f.id, name: f.name, element: f.element, hp: f.hp, maxHp: f.maxHp, stance: f.stance, windTargeted: windTargets.has(f.id) })),
    enemies: s.fighters.filter(f => f.side === 'enemy').map(f => ({ id: f.id, name: f.name, element: f.element, hp: f.hp, maxHp: f.maxHp, winding: !!(f.act?.phase === 'windup' && f.act.move.heavy) })),
    outcome: s.outcome,
  }
}

// Reach/Witherbloom (an enemy) + Wardcoil (an ally) take a target; Flash/Breeze don't.

function Scene({ arenaRef, cmdQueue, onSnap }: {
  arenaRef: React.RefObject<ArenaState>
  cmdQueue: React.RefObject<KeeperCommand[]>
  onSnap: (u: UISnap) => void
}) {
  const groups = useRef(new Map<string, THREE.Group>())
  const bodies = useRef(new Map<string, THREE.Mesh>())
  const hpFills = useRef(new Map<string, HTMLDivElement>())
  const rings = useRef(new Map<string, THREE.Mesh>())
  const shields = useRef(new Map<string, THREE.Mesh>())
  const softens = useRef(new Map<string, THREE.Mesh>())
  const poisons = useRef(new Map<string, THREE.Mesh>())
  const acc = useRef(0)

  useFrame((_, delta) => {
    const s = arenaRef.current
    const dt = Math.min(delta, 1 / 20)
    const cmds = cmdQueue.current.splice(0)
    tick(s, dt, cmds)

    // move blockout bodies imperatively (no React re-render for positions)
    for (const f of s.fighters) {
      const g = groups.current.get(f.id)
      if (!g) continue
      g.visible = f.hp > 0
      g.position.set(f.x, 0, f.y)
      g.rotation.y = -f.facing + Math.PI / 2
      // flinch shiver
      if (f.flinch > 0) g.position.x += Math.sin(s.t * 60) * 0.04
      // hit-flash + pop — the blow visibly lands
      const body = bodies.current.get(f.id)
      if (body) {
        const mat = body.material as THREE.MeshStandardMaterial
        mat.emissiveIntensity = (f.side === 'ally' ? 0.35 : 0.12) + f.hitFlash * 6
        body.scale.setScalar(1 + f.hitFlash * 1.1)
      }
      const fill = hpFills.current.get(f.id)
      if (fill) fill.style.width = `${Math.max(0, (f.hp / f.maxHp) * 100)}%`
    }

    // enemy telegraph rings — one per winding enemy (the clock the Keeper reads)
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

  const s0 = arenaRef.current
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
        const col = colorFor(f.element, f.side)
        const h = f.radius * 1.2
        return (
          <group key={f.id} ref={g => { if (g) groups.current.set(f.id, g) }} position={[f.x, 0, f.y]}>
            <mesh ref={m => { if (m) bodies.current.set(f.id, m) }} position={[0, f.radius * 0.6 + h / 2, 0]} castShadow>
              <capsuleGeometry args={[f.radius * 0.6, h, 6, 12]} />
              <meshStandardMaterial color={col} emissive={col} emissiveIntensity={f.side === 'ally' ? 0.35 : 0.12} roughness={0.5} />
            </mesh>
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
export default function ArenaBattle({ allies, enemies, seed, aidKit, onEnd, continueLabel = 'CONTINUE' }: {
  allies: Spirit[]
  enemies: Spirit[]
  seed?: number
  aidKit?: AidKit
  onEnd: (outcome: 'win' | 'lose' | 'fled') => void
  continueLabel?: string
}) {
  const arenaRef = useRef<ArenaState | null>(null)
  if (!arenaRef.current) arenaRef.current = createArena({ allies, enemies, aidKit, seed: seed ?? ((Math.random() * 1e9) | 0) })
  const cmdQueue = useRef<KeeperCommand[]>([])
  const [ui, setUi] = useState<UISnap>(() => snap(arenaRef.current!))
  const [speakOpen, setSpeakOpen] = useState(false)
  const send = useCallback((c: KeeperCommand) => { cmdQueue.current.push(c) }, [])
  const over = ui.outcome !== 'ongoing'

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0a0f0e', overflow: 'hidden', touchAction: 'none' }}>
      <Canvas shadows camera={{ position: [0, 10, -9.5], fov: 40 }} style={{ position: 'absolute', inset: 0 }}>
        <color attach="background" args={['#0a0f0e']} />
        <Scene arenaRef={arenaRef as React.RefObject<ArenaState>} cmdQueue={cmdQueue} onSnap={setUi} />
      </Canvas>

      {/* title / mana */}
      <div style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', textAlign: 'center', pointerEvents: 'none' }}>
        <div style={{ font: '800 13px ui-monospace, monospace', color: '#7fe3c8', letterSpacing: '0.14em', opacity: 0.85 }}>THE KEEPER&apos;S ARENA</div>
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
