'use client'
// ── BETA M233 v2a: THE CLASH RING (Alex 11-27: "a Clash LOAD SCREEN -> camera looks down on a GLADIATOR RING; a TOURNAMENT
// PANEL shows the line-up tree, bouts run one by one until the keeper's turn"). Replaces s3's turn-based PartyBattleScene for
// Clash. Opened from the sign-up panel (clash-panel.tsx) after Enter:
//   1. LOAD: a short card (the ring mounts under it, so her model is loading while it shows).
//   2. THE RING: one canvas, the camera high and looking down on a round sand arena with a low stone wall, stands on the far
//      side and banners (plain code-built geometry, our own look: first pass, 🟨 for Alex). The two spirits of the bout stand
//      in it as their REAL models (spirit-model.tsx SpiritFigure); a spirit with no model yet is a gold orb, as in the garden.
//   3. THE TOURNAMENT PANEL: the line-up tree (clash-bracket.ts). The troupe's bouts run first, one by one, then hers; the tree
//      advances as each bout ends. Her run ends when she is out or wins the final.
//   4. A result card and "Back to the Fair". The prize is the panel's (s3: server-held, once per tent per season).
// HOW a bout goes is the runner's (clash-bout.ts BoutRunner): the LIVE ENGINE (clash-fight.ts, fightRunner; v2b-2 folded in) by
// default. Her bout plays at 1x with a CHEER button (once a match, +20% HP); the troupe's bouts play TROUPE_X faster so hers comes
// soon (🟨 Jin's call). `?clashx=N` speeds every bout up (the prod check's dial).
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { H } from '../../ui/hearth'
import type { Spirit, Species, Element } from '../../spirits/spirit'
import { SpiritFigure } from './spirit-model'
import { formLook, spiritModelFor, type SpiritElement } from './spirit-models'
import type { RigClip } from './spirit-rig'
import { newBracket, nextBout, recordBout, keeperWon, runOver, hasYou, rounds, YOU, type Bracket } from './clash-bracket'
import type { Bonded } from './clash-fight'   // M238
import { fightRunner, RING_R, type BoutPlay, type BoutPose, type BoutRunner, type BoutAct } from './clash-bout'
import { CLASH_UI as L, type ClashTier } from './fair-clash-rules'

export interface RingEntrant { name: string; species: Species; element: Element; /** a fresh evened battle Spirit */ spirit: () => Spirit
  /** M238: her favourite (bonded) move + twist, and her own known move ids (the keeper's spirit only) */
  bonded?: Bonded | null; known?: readonly string[] }
/** the load card's time on screen (ms) */
export const LOAD_MS = 2400
/** the pause after a bout (the winner stands, the tree moves) and before hers (ms) */
const AFTER_MS = 1500, YOUR_TURN_MS = 1400
/** spirits stand a little larger than in the garden so they read from the stands' height */
const FIG = 1.8
/** the troupe's bouts play this much faster than hers */
export const TROUPE_X = 3
/** `?clashseed=N`: bout i's fight seed = N*1000 + i (the prod check picks a line it can replay) */
const seedDial = () => { try { const v = Number(new URLSearchParams(window.location.search).get('clashseed')); return Number.isInteger(v) && v > 0 ? v : null } catch { return null } }
const speedDial = () => { try { const v = Number(new URLSearchParams(window.location.search).get('clashx')); return v >= 1 && v <= 20 ? v : 1 } catch { return 1 } }
const tOf = (l: Live, now = performance.now()) => ((now - l.start) / 1000) * l.x

const lookOf = (sp: Species, el: Element) => (el === 'base' ? spiritModelFor(sp) : formLook(sp, el as SpiritElement))

type Live = { i: number; play: BoutPlay; start: number; swap: boolean; x: number; mine: boolean }

export function ClashRing({ tier, title, entrants, runner = fightRunner, result, onDone, onExit, speed, seed }: {
  tier: ClashTier; title: string
  /** M243 (the /shimmer/dev?mode=fair tool): every bout's speed and the line's fight seed; unset = the ?clashx / ?clashseed dials */
  speed?: number; seed?: number | null
  /** [0] = her spirit, then the line-up */ entrants: RingEntrant[]
  runner?: BoutRunner
  /** the panel's word on the run once it is over (the prize line) */ result: { won: boolean; prize?: number } | null
  onDone: (won: boolean) => void; onExit: () => void
}) {
  const [phase, setPhase] = useState<'load' | 'ring'>('load')
  const [br, setBr] = useState<Bracket>(() => newBracket(entrants.length - 1))
  const [live, setLive] = useState<Live | null>(null)
  const [yourTurn, setYourTurn] = useState(false)
  const [now, setNow] = useState(0), [cheerUsed, setCheerUsed] = useState(false)
  const liveRef = useRef<Live | null>(null)
  const done = runOver(br), doneSent = useRef(false)
  const phone = useNarrow()

  useEffect(() => { const t = setTimeout(() => setPhase('ring'), LOAD_MS); return () => clearTimeout(t) }, [])
  // the next bout: troupe bouts straight on, hers after a short "Your bout!" beat
  useEffect(() => {
    if (phase !== 'ring' || live || done) return
    const i = nextBout(br); if (i === null) return
    const bt = br.bouts[i], mine = hasYou(bt)
    const go = () => {
      const swap = bt.b === YOU   // the runner takes her side first
      const [sa, sb] = swap ? [bt.b!, bt.a!] : [bt.a!, bt.b!]
      const play = runner.run({ spirit: entrants[sa].spirit(), keeper: sa === YOU, bonded: entrants[sa].bonded, known: entrants[sa].known }, { spirit: entrants[sb].spirit(), keeper: sb === YOU, bonded: entrants[sb].bonded, known: entrants[sb].known }, { tier, seed: (seed ?? seedDial()) != null ? (seed ?? seedDial())! * 1000 + i : undefined })
      const l: Live = { i, play, start: performance.now(), swap, mine, x: (speed ?? speedDial()) * (mine ? 1 : TROUPE_X) }
      liveRef.current = l; setYourTurn(false); setCheerUsed(false); setLive(l)
    }
    if (mine) { setYourTurn(true); const t = setTimeout(go, YOUR_TURN_MS); return () => clearTimeout(t) }
    go()
  }, [phase, live, done, br, runner, entrants, tier, speed, seed])
  // a bout's end (the runner says it is over): hold on the winner, then move the tree
  const ended = !!live && live.play.over(tOf(live, now))
  useEffect(() => {
    if (!live || !ended) return
    const t = setTimeout(() => {
      const bt = br.bouts[live.i], w = live.play.winner() === 'a' ? (live.swap ? bt.b! : bt.a!) : (live.swap ? bt.a! : bt.b!)
      liveRef.current = null; setLive(null); setBr(b => recordBout(b, live.i, w))
    }, AFTER_MS)
    return () => clearTimeout(t)
  }, [live, ended, br])
  useEffect(() => { if (done && !doneSent.current) { doneSent.current = true; onDone(keeperWon(br)) } }, [done, br, onDone])
  // the HUD's clock (HP bars): 10 a second while a bout runs
  useEffect(() => { if (!live) return; const t = setInterval(() => setNow(performance.now()), 100); return () => clearInterval(t) }, [live])

  const bt = live ? br.bouts[live.i] : null
  const seatOf = (side: 'a' | 'b') => (!bt ? null : (side === 'a') !== !!live?.swap ? bt.a! : bt.b!)
  const pose = live ? live.play.at(tOf(live, now)) : null
  const hud = live && pose ? (['a', 'b'] as const).map(s => ({ side: s, seat: seatOf(s)!, hp: pose[s].hp, cue: pose[s].cue ?? null })) : []
  const doCheer = () => { if (live?.mine && !cheerUsed && live.play.cheer?.('a')) setCheerUsed(true) }   // her side is 'a' (the runner takes her first)
  const R = rounds(br)

  return (
    <div data-clash-ring={phase} style={{ position: 'fixed', inset: 0, zIndex: 60, background: '#1d1712', display: 'flex', flexDirection: phone ? 'column' : 'row', color: H.ink }}>
      <div style={{ position: 'relative', flex: 1, minHeight: 0, minWidth: 0 }}>
        <Canvas data-clash-canvas dpr={[1, 1.5]} gl={{ antialias: true }} camera={{ position: [0, 7, 5], fov: 42, near: 0.05, far: 200 }}>
          <color attach="background" args={['#a9c8d8']} />
          <ambientLight intensity={0.85} />
          <directionalLight position={[3, 8, 4]} intensity={1.4} />
          <Arena />
          {live && bt && (['a', 'b'] as const).map(s => { const e = entrants[seatOf(s)!]; return <Fighter key={`${live.i}-${s}`} e={e} side={s} live={liveRef} /> })}
          <RingCamera live={liveRef} />
          <ModelProbe />
        </Canvas>
        {/* the bout's HP bars over the ring */}
        {hud.length > 0 && (
          <div data-clash-bout={live!.i} data-clash-keeper-bout={hasYou(bt!) ? '1' : '0'} data-clash-bonded={hasYou(bt!) && live!.play.bonded ? (b => `${b.id}:${b.twist}`)(live!.play.bonded.a)   /* the runner always takes her side first */ : undefined} style={{ position: 'absolute', top: 10, left: 10, right: 10, display: 'flex', gap: 10, pointerEvents: 'none' }}>
            {hud.map(h => (
              <div key={h.side} data-clash-hp={h.side} data-hp={h.hp.toFixed(2)} style={{ flex: 1, padding: '6px 10px', borderRadius: 10, background: 'rgba(255,248,232,.88)', boxShadow: '0 2px 8px rgba(0,0,0,.25)' }}>
                <div style={{ fontSize: 13, fontWeight: 800, textAlign: h.side === 'a' ? 'left' : 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {entrants[h.seat].name}{h.seat === YOU && <span style={{ marginLeft: 6, color: H.ember }}>{L.you}</span>}
                </div>
                <div style={{ height: 8, borderRadius: 4, background: 'rgba(58,39,22,.18)', marginTop: 4, overflow: 'hidden', direction: h.side === 'a' ? 'ltr' : 'rtl' }}>
                  <div style={{ width: `${Math.round(h.hp * 100)}%`, height: '100%', background: h.hp > 0.35 ? H.moss : H.rust, transition: 'width .25s' }} />
                </div>
                <div data-clash-cue={h.cue ?? ''} style={{ height: 14, fontSize: 11, fontWeight: 800, color: h.cue === 'hit' ? H.rust : h.cue === 'cheer' ? H.moss : H.sky, textAlign: h.side === 'a' ? 'left' : 'right' }}>{h.cue ? L.cue[h.cue] : ''}</div>
              </div>
            ))}
          </div>
        )}
        {live?.mine && !done && !ended && (
          <button data-clash-cheer data-cheer-used={cheerUsed ? '1' : '0'} disabled={cheerUsed} onClick={doCheer}
            style={{ position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)', padding: '10px 22px', borderRadius: 22, border: 'none', fontWeight: 900, fontSize: 15,
              background: cheerUsed ? 'rgba(255,248,232,.6)' : H.ember, color: cheerUsed ? H.inkFaint : '#fff8ea', boxShadow: '0 3px 10px rgba(0,0,0,.35)', cursor: cheerUsed ? 'default' : 'pointer' }}>
            {cheerUsed ? L.cheered : L.cheer}
          </button>
        )}
        {yourTurn && <div data-clash-your-turn style={{ position: 'absolute', top: '38%', left: 0, right: 0, textAlign: 'center', fontSize: 30, fontWeight: 900, color: '#fff4d8', textShadow: '0 3px 10px rgba(0,0,0,.6)' }}>{L.yourBout}</div>}
        {done && (
          <div data-clash-ring-result={keeperWon(br) ? 'won' : 'lost'} style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 'min(320px, calc(100% - 32px))', padding: 18, borderRadius: 14, background: H.paper, boxShadow: '0 8px 30px rgba(0,0,0,.45)', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: keeperWon(br) ? H.ember : H.rust }}>{keeperWon(br) ? L.won : L.lost}</div>
            {result?.won && !!result.prize && <div style={{ marginTop: 6, fontWeight: 800 }}>{L.prizeLanded(result.prize)}</div>}
            <button data-clash-exit onClick={onExit} style={{ marginTop: 14, padding: '10px 18px', borderRadius: 10, border: 'none', background: H.ember, color: '#fff8ea', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>{L.exit}</button>
          </div>
        )}
      </div>
      {/* THE TOURNAMENT PANEL: the line-up tree */}
      <div data-clash-bracket data-bracket-done={done ? '1' : '0'} style={{ flex: 'none', width: phone ? 'auto' : 320, height: phone ? '38%' : 'auto', overflowY: 'auto', padding: '12px 14px', background: H.paper, boxShadow: '0 0 18px rgba(0,0,0,.35)' }}>
        <div style={{ fontSize: 16, fontWeight: 900 }}>{title}</div>
        <div style={{ fontSize: 12, color: H.inkFaint, marginBottom: 8 }}>{L.bracket}</div>
        <div style={{ display: 'flex', gap: 8, flexDirection: phone ? 'row' : 'column' }}>
          {Array.from({ length: R }, (_, r) => (
            <div key={r} style={{ flex: 1, display: 'grid', gap: 6, alignContent: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: H.inkSoft, textTransform: 'uppercase', letterSpacing: '.05em' }}>{L.round(r, R)}</div>
              {br.bouts.map((b, i) => b.round !== r ? null : (
                <div key={i} data-bracket-bout={i} data-bout-state={b.winner !== null ? 'done' : live?.i === i ? 'live' : 'waiting'} data-bout-winner={b.winner ?? ''} data-bout-you={hasYou(b) ? '1' : '0'}
                  style={{ borderRadius: 8, padding: '4px 8px', background: live?.i === i ? 'rgba(224,130,63,.18)' : 'rgba(255,250,240,.7)', boxShadow: `inset 0 0 0 ${live?.i === i ? 2 : 1}px ${live?.i === i ? H.ember : 'rgba(58,39,22,.14)'}` }}>
                  {[b.a, b.b].map((seat, k) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontSize: 13, lineHeight: '20px',
                      fontWeight: seat !== null && b.winner === seat ? 900 : 600, color: seat === null ? H.inkFaint : b.winner !== null && b.winner !== seat ? H.inkFaint : H.ink,
                      textDecoration: b.winner !== null && seat !== null && b.winner !== seat ? 'line-through' : 'none' }}>
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{seat === null ? '...' : entrants[seat].name}</span>
                      {seat === YOU && <span style={{ color: H.ember, fontWeight: 800 }}>{L.you}</span>}
                    </div>
                  ))}
                  {live?.i === i && <div style={{ fontSize: 11, fontWeight: 800, color: H.ember }}>{L.live}</div>}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      {phase === 'load' && <ClashLoad title={title} entrants={entrants} />}
    </div>
  )
}

/** the load card (a placeholder: her spirit, the line-up, a moving bar) */
function ClashLoad({ title, entrants }: { title: string; entrants: RingEntrant[] }) {
  return (
    <div data-clash-load style={{ position: 'absolute', inset: 0, zIndex: 2, display: 'grid', placeItems: 'center', background: 'radial-gradient(circle at 50% 40%, #4a3523, #1d1712 75%)', padding: 16 }}>
      <div style={{ width: 'min(360px, 100%)', padding: 20, borderRadius: 16, background: H.paper, textAlign: 'center', boxShadow: '0 10px 40px rgba(0,0,0,.5)' }}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>{title}</div>
        <div style={{ marginTop: 10, fontSize: 16, fontWeight: 800, color: H.ember }}>{entrants[0].name}</div>
        <div style={{ fontSize: 12, color: H.inkFaint, margin: '6px 0 2px' }}>{L.versus}</div>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{entrants.slice(1).map(e => e.name).join(' · ')}</div>
        <div style={{ marginTop: 14, height: 6, borderRadius: 3, background: 'rgba(58,39,22,.15)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: '100%', background: H.ember, transformOrigin: 'left', animation: `clashload ${LOAD_MS}ms linear forwards` }} />
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: H.inkSoft }}>{L.loading}</div>
        <style>{'@keyframes clashload { from { transform: scaleX(0) } to { transform: scaleX(1) } }'}</style>
      </div>
    </div>
  )
}

function useNarrow() {
  const [n, setN] = useState(() => typeof window !== 'undefined' && window.innerWidth < 700)
  useEffect(() => { const f = () => setN(window.innerWidth < 700); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f) }, [])
  return n
}

// ── the arena: sand, a low stone wall, stands on the far side, banners. Plain shapes, our own colours. ──
const WALL_R = RING_R + 0.5
function Arena() {
  const poles = useMemo(() => Array.from({ length: 10 }, (_, i) => { const a = (i / 10) * Math.PI * 2 + Math.PI / 10; return { x: Math.sin(a) * (WALL_R + 0.35), z: Math.cos(a) * (WALL_R + 0.35), a, c: ['#b8442e', '#e0a23a', '#3f7f86', '#7a4d8c'][i % 4] } }), [])
  const tiers = [{ r0: WALL_R + 1.0, r1: WALL_R + 2.4, h: 1.1 }, { r0: WALL_R + 2.4, r1: WALL_R + 3.8, h: 1.9 }, { r0: WALL_R + 3.8, r1: WALL_R + 5.2, h: 2.7 }]
  const far = { s: Math.PI / 2 + 0.25, l: Math.PI - 0.5 }   // the stands ring the far half (the camera's side stays open)
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.02}><circleGeometry args={[40, 48]} /><meshLambertMaterial color="#6f8f4c" /></mesh>
      <mesh rotation-x={-Math.PI / 2}><circleGeometry args={[WALL_R, 64]} /><meshLambertMaterial color="#dcc394" /></mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.005}><ringGeometry args={[RING_R - 0.12, RING_R, 64]} /><meshBasicMaterial color="#b89b6c" /></mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.005}><ringGeometry args={[1.1, 1.2, 48]} /><meshBasicMaterial color="#c4a676" /></mesh>
      {/* the wall: inner and outer faces + its cap */}
      <mesh position-y={0.35}><cylinderGeometry args={[WALL_R, WALL_R, 0.7, 72, 1, true]} /><meshLambertMaterial color="#9a8f83" side={THREE.DoubleSide} /></mesh>
      <mesh position-y={0.35}><cylinderGeometry args={[WALL_R + 0.5, WALL_R + 0.5, 0.7, 72, 1, true]} /><meshLambertMaterial color="#857a6e" side={THREE.DoubleSide} /></mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.7}><ringGeometry args={[WALL_R, WALL_R + 0.5, 72]} /><meshLambertMaterial color="#b1a698" /></mesh>
      {/* the stands */}
      {tiers.map((t, i) => (
        <group key={i}>
          <mesh position-y={t.h / 2}><cylinderGeometry args={[t.r1, t.r1, t.h, 48, 1, true, far.s, far.l]} /><meshLambertMaterial color={i % 2 ? '#8a6a48' : '#7b5d3f'} side={THREE.DoubleSide} /></mesh>
          <mesh rotation-x={-Math.PI / 2} position-y={t.h}><ringGeometry args={[t.r0, t.r1, 48, 1, far.s - Math.PI / 2, far.l]} /><meshLambertMaterial color={i % 2 ? '#a2805a' : '#94734f'} side={THREE.DoubleSide} /></mesh>
        </group>
      ))}
      {/* banners on poles round the wall */}
      {poles.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]} rotation-y={p.a}>
          <mesh position-y={1.6}><cylinderGeometry args={[0.06, 0.06, 3.2, 6]} /><meshLambertMaterial color="#5a4632" /></mesh>
          <mesh position={[0, 2.5, 0.4]} rotation-y={Math.PI / 2}><planeGeometry args={[0.8, 1.25]} /><meshLambertMaterial color={p.c} side={THREE.DoubleSide} /></mesh>
        </group>
      ))}
    </group>
  )
}

const ACT_COL: Partial<Record<BoutAct, string>> = { windup: '#f0b040', strike: '#e0482f', guard: '#4f9fd8', evade: '#ffffff', hit: '#a8482f' }
/** one spirit in the ring: her model (or the gold orb), moved and turned by the bout's timeline */
function Fighter({ e, side, live }: { e: RingEntrant; side: 'a' | 'b'; live: { current: Live | null } }) {
  const g = useRef<THREE.Group>(null), body = useRef<THREE.Group>(null), cue = useRef<THREE.Mesh>(null)
  const look = useMemo(() => lookOf(e.species, e.element), [e.species, e.element])
  const [clip, setClip] = useState<RigClip>('idle')
  useFrame(() => {
    const l = live.current; if (!l || !g.current || !body.current) return
    const t = tOf(l), f = l.play.at(t)
    const p: BoutPose = f[side]
    g.current.position.set(p.x, 0, p.z)
    g.current.rotation.y = p.face
    const down = p.act === 'down', hop = p.act === 'win' ? Math.abs(Math.sin(t * 6)) * 0.12 : p.act === 'hit' ? 0.05 : 0
    body.current.rotation.z = THREE.MathUtils.lerp(body.current.rotation.z, down ? 1.35 : 0, 0.15)
    body.current.position.y = hop
    const c: RigClip = p.act === 'strike' || p.act === 'evade' ? 'run' : p.act === 'walk' ? 'walk' : 'idle'
    if (c !== clip) setClip(c)
    // the act ring under her: amber = winding up, red = the blow, blue = guarding, white = evading
    if (cue.current) { const col = ACT_COL[p.act]; cue.current.visible = !!col; if (col) (cue.current.material as THREE.MeshBasicMaterial).color.set(col)
      const k = p.act === 'windup' ? 1 + 0.25 * Math.sin(t * 18) : 1; cue.current.scale.set(k, k, k) }
    if (body.current) body.current.scale.setScalar(FIG * (p.act === 'guard' ? 0.92 : p.act === 'windup' ? 1.05 : 1))
  })
  return (
    <group ref={g}>
      <group ref={body} scale={FIG}>
        {look ? <SpiritFigure sp={e.species} look={look} clip={clip} />
          : <mesh position-y={0.25} userData={{ spiritModel: `orb:${e.species}` }}><sphereGeometry args={[0.16, 16, 12]} /><meshBasicMaterial color="#ffd86a" /></mesh>}
      </group>
      {/* a soft shadow under her */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.01}><circleGeometry args={[0.32 * FIG, 24]} /><meshBasicMaterial color="#000" transparent opacity={0.18} depthWrite={false} /></mesh>
      <mesh ref={cue} visible={false} rotation-x={-Math.PI / 2} position-y={0.02}><ringGeometry args={[0.42 * FIG, 0.52 * FIG, 32]} /><meshBasicMaterial color="#fff" transparent opacity={0.85} depthWrite={false} /></mesh>
    </group>
  )
}

/** the camera high over the ring, looking down at the bout (framed wider on a narrow screen) */
function RingCamera({ live }: { live: { current: Live | null } }) {
  const camera = useThree(s => s.camera) as THREE.PerspectiveCamera, size = useThree(s => s.size)
  const tgt = useRef(new THREE.Vector3()), span = useRef(4)
  useFrame(() => {
    const l = live.current, want = new THREE.Vector3()
    let sep = 4
    if (l) { const f = l.play.at(tOf(l)); want.set((f.a.x + f.b.x) / 2, 0, (f.a.z + f.b.z) / 2).multiplyScalar(0.92); sep = Math.hypot(f.a.x - f.b.x, f.a.z - f.b.z) }
    tgt.current.lerp(want, 0.05); span.current += (sep - span.current) * 0.03
    const aspect = size.width / Math.max(1, size.height), half = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
    const D = THREE.MathUtils.clamp((span.current * 0.65 + 2.6) / (half * Math.min(aspect, 1.4)), 7, 26), pitch = THREE.MathUtils.degToRad(55)
    camera.position.set(tgt.current.x, D * Math.sin(pitch), tgt.current.z + D * Math.cos(pitch))
    camera.lookAt(tgt.current)
  })
  return null
}

/** the check's window: which spirit models stand in the ring right now (data-ring-models on the canvas's parent) */
function ModelProbe() {
  const scene = useThree(s => s.scene), gl = useThree(s => s.gl)
  const last = useRef('')
  useFrame(() => {
    const names: string[] = []
    scene.traverse(o => { const m = (o.userData as { spiritModel?: string }).spiritModel; if (m) names.push(m) })
    const s = names.sort().join(',')
    if (s !== last.current) { last.current = s; gl.domElement.parentElement?.setAttribute('data-ring-models', s) }
  })
  return null
}

