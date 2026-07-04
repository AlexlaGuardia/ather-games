'use client'
// ── Keeper's Arena — playable test harness (brick 2, the renderer) ──────────────
// A standalone cold-play slice of the new real-time combat: 3/4 iso view, blockout
// primitives on a disc, enemy telegraph ring, and the 4-corner Keeper HUD wired to
// engine/arena.ts. This is the "can Alex feel it" build — NOT the final home (the
// arena will later materialize in-world inside play3d). Route: /shimmer/arena.

import { Canvas, useFrame } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useRef, useState, useCallback } from 'react'
import { createArena, tick, type ArenaState, type KeeperCommand, type AidId, type Stance } from '../engine/arena'
import { createSpirit, ELEMENT_COLORS, type Element, type Species } from '../spirits/spirit'

const ENEMY_GREY = '#787885'

function buildSlice(): ArenaState {
  const mk = (sp: Species, name: string, lvl: number, el: Element = 'base') => {
    const s = createSpirit(sp, name, 0, 0); s.level = lvl; s.bond = 60; s.happiness = 128
    if (el !== 'base') s.element = el
    return s
  }
  // A party with distinct roles so the Speak layer matters: striker · caster · wall.
  const allies = [mk('fox', 'Kit', 22, 'storm'), mk('owl', 'Sage', 22, 'mana'), mk('water-bear', 'Tor', 22, 'earth')]
  const enemies = [mk('frog', 'Blightling', 22), mk('bat', 'Gnash', 22), mk('rabbit', 'Scree', 22)]
  return createArena({ allies, enemies, seed: (Math.random() * 1e9) | 0 })
}

function colorFor(el: Element, side: 'ally' | 'enemy'): string {
  return side === 'enemy' ? ENEMY_GREY : (ELEMENT_COLORS[el] ?? '#7fe3c8')
}

// ── snapshot the HUD reads (throttled from the sim each frame) ──
interface UISnap {
  mana: number; maxMana: number
  aid: { id: AidId; name: string; cost: number; cdLeft: number; cd: number }[]
  bagCdLeft: number
  allies: { id: string; name: string; element: Element; hp: number; maxHp: number; stance: Stance }[]
  outcome: ArenaState['outcome']
}
function snap(s: ArenaState): UISnap {
  return {
    mana: s.keeper.mana, maxMana: s.keeper.maxMana,
    aid: s.keeper.aid.map(a => ({ id: a.id, name: a.name, cost: a.cost, cdLeft: a.cdLeft, cd: a.cd })),
    bagCdLeft: s.keeper.bagCdLeft,
    allies: s.fighters.filter(f => f.side === 'ally').map(f => ({ id: f.id, name: f.name, element: f.element, hp: f.hp, maxHp: f.maxHp, stance: f.stance })),
    outcome: s.outcome,
  }
}

function Scene({ arenaRef, cmdQueue, onSnap }: {
  arenaRef: React.RefObject<ArenaState>
  cmdQueue: React.RefObject<KeeperCommand[]>
  onSnap: (u: UISnap) => void
}) {
  const groups = useRef(new Map<string, THREE.Group>())
  const bodies = useRef(new Map<string, THREE.Mesh>())
  const hpFills = useRef(new Map<string, HTMLDivElement>())
  const rings = useRef(new Map<string, THREE.Mesh>())
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

    // enemy telegraph ring — the clock the Keeper reads
    // enemy telegraph rings — one per winding enemy (the clock the Keeper reads)
    for (const f of s.fighters) {
      if (f.side !== 'enemy') continue
      const r = rings.current.get(f.id)
      if (!r) continue
      if (f.wind && f.hp > 0) {
        const tgt = s.fighters.find(g => g.id === f.wind!.targetId)
        const p = f.wind.t / f.wind.dur
        if (tgt) { r.visible = true; r.position.set(tgt.x, 0.02, tgt.y); r.scale.setScalar(f.wind.range * (0.4 + 0.6 * p)) }
        const m = r.material as THREE.MeshBasicMaterial
        m.opacity = 0.25 + 0.55 * p; m.color.setStyle(p > 0.75 ? '#ff5a4d' : '#f0a526')
      } else r.visible = false
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

export default function ArenaSlice() {
  const arenaRef = useRef<ArenaState>(buildSlice())
  const cmdQueue = useRef<KeeperCommand[]>([])
  const [ui, setUi] = useState<UISnap>(() => snap(arenaRef.current))
  const [runId, setRunId] = useState(0)
  const [speakOpen, setSpeakOpen] = useState(false)

  const send = useCallback((c: KeeperCommand) => { cmdQueue.current.push(c) }, [])
  const restart = useCallback(() => { arenaRef.current = buildSlice(); cmdQueue.current = []; setUi(snap(arenaRef.current)); setRunId(r => r + 1); setSpeakOpen(false) }, [])

  const aidBy = (id: AidId) => ui.aid.find(a => a.id === id)!
  const over = ui.outcome !== 'ongoing'

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0a0f0e', overflow: 'hidden', touchAction: 'none' }}>
      <Canvas key={runId} shadows camera={{ position: [0, 10, 9.5], fov: 40 }} style={{ position: 'absolute', inset: 0 }}>
        <color attach="background" args={['#0a0f0e']} />
        <Scene arenaRef={arenaRef} cmdQueue={cmdQueue} onSnap={setUi} />
      </Canvas>

      {/* title / mana */}
      <div style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', textAlign: 'center', pointerEvents: 'none' }}>
        <div style={{ font: '800 13px ui-monospace, monospace', color: '#7fe3c8', letterSpacing: '0.14em', opacity: 0.85 }}>THE KEEPER&apos;S ARENA</div>
        <div style={{ width: 180, height: 8, background: '#0007', border: '1px solid #2f5c4f', borderRadius: 5, margin: '6px auto 0', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(ui.mana / ui.maxMana) * 100}%`, background: 'linear-gradient(90deg,#3a7bd5,#6fd0e6)', transition: 'width 0.1s linear' }} />
        </div>
        <div style={{ font: '600 9px ui-monospace, monospace', color: '#9fb8c8', marginTop: 2 }}>MANA {Math.floor(ui.mana)}/{ui.maxMana}</div>
      </div>

      {/* AID — top-left (3 spells) */}
      <div style={{ position: 'absolute', top: 74, left: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(['flash', 'breeze', 'reach'] as AidId[]).map(id => {
          const a = aidBy(id)
          const disabled = over || a.cdLeft > 0 || ui.mana < a.cost
          return <CornerBtn key={id} label={a.name.split(' ')[a.name.split(' ').length - 1].toUpperCase()} sub={`${a.cost}◈`}
            accent="#6fd0e6" disabled={disabled} cd={a.cdLeft} cdMax={a.cd} onClick={() => send({ type: 'aid', id })} style={{ position: 'static' }} />
        })}
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

      {/* result */}
      {over && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0a0f0ecc' }}>
          <div style={{ font: '900 30px ui-monospace, monospace', color: ui.outcome === 'win' ? '#7fe3c8' : ui.outcome === 'fled' ? '#c9c9d2' : '#e08a7a', letterSpacing: '0.1em' }}>
            {ui.outcome === 'win' ? 'THE FIELD IS YOURS' : ui.outcome === 'fled' ? 'YOU SLIPPED AWAY' : 'YOUR SPIRIT FELL'}
          </div>
          <button onClick={restart} style={{ marginTop: 22, padding: '12px 28px', borderRadius: 12, border: '2px solid #7fe3c8', background: '#12181a', color: '#eafff6', font: '800 14px ui-monospace, monospace', letterSpacing: '0.1em', cursor: 'pointer' }}>AGAIN</button>
        </div>
      )}

      {/* hint */}
      {!over && <div style={{ position: 'absolute', bottom: 26, left: '50%', transform: 'translateX(-50%)', font: '600 10px ui-monospace, monospace', color: '#5f7a72', textAlign: 'center', maxWidth: 260, pointerEvents: 'none' }}>Your spirit fights on its own. Time your Aid: FLASH interrupts a wind-up · REACH softens · BREEZE sustains mana.</div>}
    </div>
  )
}
