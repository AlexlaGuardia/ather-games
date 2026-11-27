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
import { newBracket, newField, nextBout, recordBout, runOver, fieldOver, champion, hasSeat, rounds, YOU, type Bracket } from './clash-bracket'
import type { Bonded } from './clash-fight'   // M238
import type { BoutRecord } from './clash-lessons'   // M233 v2c
import { fightRunner, RING_R, type BoutPlay, type BoutPose, type BoutRunner, type BoutAct } from './clash-bout'
import { CLASH_UI as L, type ClashTier } from './fair-clash-rules'
import { CLASH_CAM, camPose, ceremonyMs, treeMarks, formName, type ClashCam, type Beat } from './clash-ceremony'   // M233 v2d

export interface RingEntrant { name: string; species: Species; element: Element; /** M233 v2d: the keeper's name on her corner card (unset = the troupe's) */ keeper?: string; /** a fresh evened battle Spirit */ spirit: () => Spirit
  /** M238: her favourite (bonded) move + twist, and her own known move ids (the keeper's spirit only) */
  bonded?: Bonded | null; known?: readonly string[]
  /** M233 v2c: her Clash lessons (clash-lessons.ts ids; the keeper's spirit only) */
  lessons?: readonly string[] }
/** the load card's time on screen (ms) */
export const LOAD_MS = 2400
// M233 v2d: the pause after a bout and before hers are the CEREMONY's beats now (clash-ceremony.ts: intro, Begin, winner, tree)
/** spirits stand a little larger than in the garden so they read from the stands' height */
const FIG = 1.8
/** the troupe's bouts play this much faster than hers */
export const TROUPE_X = 3
/** M233 s4: a chord's field plays every bout at one pace, so the chord's rings keep step */
export const FIELD_X = 2
/** `?clashseed=N`: bout i's fight seed = N*1000 + i (the prod check picks a line it can replay) */
const seedDial = () => { try { const v = Number(new URLSearchParams(window.location.search).get('clashseed')); return Number.isInteger(v) && v > 0 ? v : null } catch { return null } }
const speedDial = () => { try { const v = Number(new URLSearchParams(window.location.search).get('clashx')); return v >= 1 && v <= 20 ? v : 1 } catch { return 1 } }
const tOf = (l: Live, now = performance.now()) => Math.max(0, ((now - l.start) / 1000) * l.x)

/** M233 v2c: her lessons at work this bout, 'tactic:count,...' (seat 0 = her side) for checks */
const tacticCounts = (log: readonly { kind: string; side: number; tactic?: string }[]) => {
  const n = new Map<string, number>()
  for (const e of log) if (e.kind === 'tactic' && e.side === 0 && e.tactic) n.set(e.tactic, (n.get(e.tactic) ?? 0) + 1)
  return [...n].map(([k, v]) => `${k}:${v}`).join(',')
}
const lookOf = (sp: Species, el: Element) => (el === 'base' ? spiritModelFor(sp) : formLook(sp, el as SpiritElement))

type Live = { i: number; play: BoutPlay; start: number; swap: boolean; x: number; mine: boolean; /** M233 v2d: the corner intro's walk-in */ introAt: number; introMs: number }
/** M233 v2d: the ceremony's beat now ('fight' = the bout runs; 'idle' = between beats) */
type Cer = { k: Beat | 'fight' | 'idle'; i: number; last: number | null }
const medianOf = (g: readonly number[] | undefined) => { if (!g?.length) return null; const x = [...g].sort((p, q) => p - q); return x[x.length >> 1] }

export function ClashRing({ tier, title, entrants, runner = fightRunner, result, onDone, onExit, speed, seed, onKeeperBout, field, cam = CLASH_CAM, ceremony = true }: {
  tier: ClashTier; title: string
  /** M233 v2d: the ring's camera (CLASH_CAM; the Fair dev tool's tuner passes its live values) */
  cam?: ClashCam
  /** M233 v2d: corner intros + Begin + winner banner + tree between bouts (off = v2a's straight run) */
  ceremony?: boolean
  /** M233 s4 EVENT LOBBY: a chord's field (seats paired in order, run to the final, no cheer so every keeper's ring plays the
   *  same fights from the same seed); `me` = this keeper's seat (null = watching). Unset = the solo tree (her = seat 0). */
  field?: { me: number | null }
  /** M243 (the /shimmer/dev?mode=fair tool): every bout's speed and the line's fight seed; unset = the ?clashx / ?clashseed dials */
  speed?: number; seed?: number | null
  /** [0] = her spirit, then the line-up */ entrants: RingEntrant[]
  runner?: BoutRunner
  /** the panel's word on the run once it is over (the prize line) */ result: { won: boolean; prize?: number } | null
  onDone: (won: boolean, champ: number | null) => void; onExit: () => void
  /** M233 v2c: her bout is over: its whole log from her side (the panel teaches her its lessons) */
  onKeeperBout?: (r: BoutRecord, seed: number) => void
}) {
  const [phase, setPhase] = useState<'load' | 'ring'>('load')
  const ME = field ? field.me : YOU, full = !!field
  const mineOf = (bt: { a: number | null; b: number | null }) => ME !== null && hasSeat(bt as never, ME)
  const [br, setBr] = useState<Bracket>(() => (field ? newField(entrants.length) : newBracket(entrants.length - 1)))
  const [live, setLive] = useState<Live | null>(null)
  const [yourTurn, setYourTurn] = useState(false)
  const [cer, setCer] = useState<Cer>({ k: 'idle', i: -1, last: null })
  const cerLog = useRef<string[]>([]), outFrame = useRef(0)
  const mark = (k: string, i: number, extra = '') => { cerLog.current.push(`${k}:${i}${extra}`) }
  const [now, setNow] = useState(0), [cheerUsed, setCheerUsed] = useState(false)
  const liveRef = useRef<Live | null>(null)
  const done = full ? fieldOver(br) : runOver(br), doneSent = useRef(false)
  const won = ME !== null && champion(br) === ME
  const phone = useNarrow()

  useEffect(() => { const t = setTimeout(() => setPhase('ring'), LOAD_MS); return () => clearTimeout(t) }, [])
  const pace = speed ?? speedDial()
  const beat = (b: Beat) => (ceremony ? ceremonyMs(b, pace) : 0)
  // the next bout: M233 v2d CEREMONY: both spirits walk in from their corners under name cards, then 'Begin', then the fight
  useEffect(() => {
    if (phase !== 'ring' || live || done || cer.k === 'tree') return
    const i = nextBout(br, full); if (i === null) return
    const bt = br.bouts[i], mine = mineOf(bt)
    {
      const swap = !full && bt.b === YOU   // the runner takes her side first (a field never swaps: every ring must agree)
      const [sa, sb] = swap ? [bt.b!, bt.a!] : [bt.a!, bt.b!]
      const play = runner.run({ spirit: entrants[sa].spirit(), keeper: sa === ME, bonded: entrants[sa].bonded, known: entrants[sa].known, lessons: entrants[sa].lessons }, { spirit: entrants[sb].spirit(), keeper: sb === ME, bonded: entrants[sb].bonded, known: entrants[sb].known, lessons: entrants[sb].lessons }, { tier, seed: (seed ?? seedDial()) != null ? (seed ?? seedDial())! * 1000 + i : undefined })
      const t0 = performance.now(), introMs = beat('intro'), lead = introMs + beat('begin')
      const l: Live = { i, play, start: t0 + lead, swap, mine, x: pace * (full ? FIELD_X : mine ? 1 : TROUPE_X), introAt: t0, introMs }
      liveRef.current = l; setYourTurn(mine); setCheerUsed(false); setLive(l)
      if (lead > 0) { setCer({ k: 'intro', i, last: null }); mark('intro', i) } else setCer({ k: 'fight', i, last: null })
    }
  }, [phase, live, done, br, runner, entrants, tier, speed, seed, full, ME, cer.k])   // eslint-disable-line react-hooks/exhaustive-deps
  // the ceremony's clock: intro -> Begin -> fight; winner -> (tree moves) -> tree -> next bout
  const toBegin = () => { const l = liveRef.current; if (!l) return; setCer(c => (c.k === 'intro' ? (mark('begin', c.i), { ...c, k: 'begin' }) : c)) }
  const toFight = () => { const l = liveRef.current; if (!l) return; if (performance.now() < l.start) l.start = performance.now(); setYourTurn(false); setCer(c => (c.k === 'intro' || c.k === 'begin' ? (mark('fight', c.i), { ...c, k: 'fight' }) : c)) }
  const record = () => {
    const l = liveRef.current; if (!l) return
    const bt = br.bouts[l.i], w = l.play.winner() === 'a' ? (l.swap ? bt.b! : bt.a!) : (l.swap ? bt.a! : bt.b!)
    // M233 v2c: her bout's log, her side = 'a' (seat 0: the runner takes her side first)
    // a field's seat may be side 'b' (no swap): her side is wherever her seat stands
    const side: 0 | 1 = full ? (bt.a === ME ? 0 : 1) : 0
    const st = l.play.state, foe = entrants[full ? (side === 0 ? bt.b! : bt.a!) : l.swap ? bt.a! : bt.b!]
    if (l.mine && st && l.play.log) onKeeperBout?.({ side, foe: { species: foe.species, element: foe.element }, won: l.play.winner() === (side === 0 ? 'a' : 'b'), hpEnd: st.f[side].hp / Math.max(1, st.f[side].maxHp), ev: l.play.log }, l.play.seed ?? 0)
    const g = medianOf(l.play.holdGaps)
    mark('done', l.i, `:w${w}:gap${g === null ? '-' : g.toFixed(2)}:n${l.play.holdGaps?.length ?? 0}:out${outFrame.current}`)
    liveRef.current = null; setLive(null); setBr(b => recordBout(b, l.i, w))
    if (ceremony) { setCer({ k: 'tree', i: l.i, last: l.i }); mark('tree', l.i) } else setCer({ k: 'idle', i: -1, last: l.i })
  }
  const endTree = () => setCer(c => (c.k === 'tree' ? { k: 'idle', i: -1, last: c.last } : c))
  useEffect(() => {
    if (cer.k === 'intro') { const t = setTimeout(toBegin, beat('intro')); return () => clearTimeout(t) }
    if (cer.k === 'begin') { const t = setTimeout(toFight, beat('begin')); return () => clearTimeout(t) }
    if (cer.k === 'winner') { const t = setTimeout(record, beat('winner')); return () => clearTimeout(t) }
    if (cer.k === 'tree') { const t = setTimeout(endTree, beat('tree')); return () => clearTimeout(t) }
  }, [cer.k, cer.i])   // eslint-disable-line react-hooks/exhaustive-deps
  const skip = () => { if (cer.k === 'intro' || cer.k === 'begin') toFight(); else if (cer.k === 'winner') record(); else if (cer.k === 'tree') endTree() }
  // a bout's end (the runner says it is over): the WINNER banner, then the tree moves (record)
  const ended = !!live && cer.k === 'fight' && live.play.over(tOf(live, now))
  useEffect(() => {
    if (!live || !ended) return
    if (!ceremony) { const t = setTimeout(record, 1500); return () => clearTimeout(t) }
    setCer(c => (c.k === 'fight' ? (mark('winner', live.i), { ...c, k: 'winner' }) : c))
  }, [live, ended])   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (done && !doneSent.current) { doneSent.current = true; onDone(full ? won : br.bouts[br.bouts.length - 1].winner === YOU, champion(br)) } }, [done, br, onDone, full, won])
  // the HUD's clock (HP bars): 10 a second while a bout runs
  useEffect(() => { if (!live) return; const t = setInterval(() => setNow(performance.now()), 100); return () => clearInterval(t) }, [live])

  const bt = live ? br.bouts[live.i] : null
  const seatOf = (side: 'a' | 'b') => (!bt ? null : (side === 'a') !== !!live?.swap ? bt.a! : bt.b!)
  const pose = live ? live.play.at(tOf(live, now)) : null
  const fighting = cer.k === 'fight' || cer.k === 'winner'
  const hud = live && pose && fighting ? (['a', 'b'] as const).map(s => ({ side: s, seat: seatOf(s)!, hp: pose[s].hp, cue: pose[s].cue ?? null })) : []
  const doCheer = () => { if (live?.mine && !cheerUsed && live.play.cheer?.('a')) setCheerUsed(true) }   // her side is 'a' (the runner takes her first)
  const R = rounds(br)

  return (
    <div data-clash-ring={phase} data-clash-cer={cer.k} data-clash-ceremony={cerLog.current.join(',')} data-clash-gap={(g => (g === null ? '' : g.toFixed(2)))(medianOf(live?.play.holdGaps))} data-clash-outframe={outFrame.current} style={{ position: 'fixed', inset: 0, zIndex: 60, background: '#1d1712', display: 'flex', flexDirection: phone ? 'column' : 'row', color: H.ink }}>
      <div style={{ position: 'relative', flex: 1, minHeight: 0, minWidth: 0 }}>
        <Canvas data-clash-canvas dpr={[1, 1.5]} gl={{ antialias: true }} camera={{ position: [0, cam.height, cam.distance], fov: cam.fov, near: 0.05, far: 300 }}>
          <color attach="background" args={['#a9c8d8']} />
          <ambientLight intensity={0.85} />
          <directionalLight position={[3, 8, 4]} intensity={1.4} />
          <Arena />
          {live && bt && (['a', 'b'] as const).map(s => { const e = entrants[seatOf(s)!]; return <Fighter key={`${live.i}-${s}`} e={e} side={s} live={liveRef} /> })}
          <RingCamera live={liveRef} cam={cam} out={outFrame} />
          <ModelProbe />
        </Canvas>
        {/* the bout's HP bars over the ring */}
        {hud.length > 0 && (
          <div data-clash-bout={live!.i} data-clash-keeper-bout={mineOf(bt!) ? '1' : '0'} data-clash-bonded={!full && mineOf(bt!) && live!.play.bonded ? (b => `${b.id}:${b.twist}`)(live!.play.bonded.a)   /* the runner always takes her side first */ : undefined}
            data-clash-tactics={!full && mineOf(bt!) && live!.play.log ? tacticCounts(live!.play.log) : undefined} style={{ position: 'absolute', top: 10, left: 10, right: 10, display: 'flex', gap: 10, pointerEvents: 'none' }}>
            {hud.map(h => (
              <div key={h.side} data-clash-hp={h.side} data-hp={h.hp.toFixed(2)} style={{ flex: 1, padding: '6px 10px', borderRadius: 10, background: 'rgba(255,248,232,.88)', boxShadow: '0 2px 8px rgba(0,0,0,.25)' }}>
                <div style={{ fontSize: 13, fontWeight: 800, textAlign: h.side === 'a' ? 'left' : 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {entrants[h.seat].name}{h.seat === ME && <span style={{ marginLeft: 6, color: H.ember }}>{L.you}</span>}
                </div>
                <div style={{ height: 8, borderRadius: 4, background: 'rgba(58,39,22,.18)', marginTop: 4, overflow: 'hidden', direction: h.side === 'a' ? 'ltr' : 'rtl' }}>
                  <div style={{ width: `${Math.round(h.hp * 100)}%`, height: '100%', background: h.hp > 0.35 ? H.moss : H.rust, transition: 'width .25s' }} />
                </div>
                <div data-clash-cue={h.cue ?? ''} style={{ height: 14, fontSize: 11, fontWeight: 800, color: h.cue === 'hit' ? H.rust : h.cue === 'cheer' ? H.moss : H.sky, textAlign: h.side === 'a' ? 'left' : 'right' }}>{h.cue ? L.cue[h.cue] : ''}</div>
              </div>
            ))}
          </div>
        )}
        {live?.mine && !full && !done && !ended && cer.k === 'fight' && (
          <button data-clash-cheer data-cheer-used={cheerUsed ? '1' : '0'} disabled={cheerUsed} onClick={doCheer}
            style={{ position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)', padding: '10px 22px', borderRadius: 22, border: 'none', fontWeight: 900, fontSize: 15,
              background: cheerUsed ? 'rgba(255,248,232,.6)' : H.ember, color: cheerUsed ? H.inkFaint : '#fff8ea', boxShadow: '0 3px 10px rgba(0,0,0,.35)', cursor: cheerUsed ? 'default' : 'pointer' }}>
            {cheerUsed ? L.cheered : L.cheer}
          </button>
        )}
        {/* M233 v2d CEREMONY: corner cards as they walk in, then Begin; the winner; the tree */}
        {live && bt && (cer.k === 'intro' || cer.k === 'begin') && (['a', 'b'] as const).map(sd => { const st = seatOf(sd)!, e = entrants[st]; return (
          <div key={sd} data-clash-intro={sd} data-intro-seat={st} style={{ position: 'absolute', top: phone ? 12 : 22, [sd === 'a' ? 'left' : 'right']: phone ? 10 : 22, width: phone ? 'calc(50% - 16px)' : 240,
            padding: '10px 12px', borderRadius: 12, background: H.paper, boxShadow: '0 6px 22px rgba(0,0,0,.45)', textAlign: sd === 'a' ? 'left' : 'right', animation: `clashcard${sd} .45s ease-out both` } as import('react').CSSProperties}>
            <div style={{ fontSize: 11, fontWeight: 800, color: H.inkSoft, textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{st === ME ? L.you : e.keeper ?? L.troupe}</div>
            <div style={{ fontSize: phone ? 17 : 21, fontWeight: 900, color: st === ME ? H.ember : H.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.name}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: H.inkSoft }}>{formName(e.element)}</div>
          </div>) })}
        {cer.k === 'begin' && <div data-clash-begin style={{ position: 'absolute', top: '36%', left: 0, right: 0, textAlign: 'center', fontSize: phone ? 46 : 64, fontWeight: 900, color: '#fff4d8', textShadow: '0 4px 14px rgba(0,0,0,.65)', animation: 'clashpop .35s ease-out both', pointerEvents: 'none' }}>{L.begin}</div>}
        {cer.k === 'winner' && live && bt && (w => <div data-clash-winner={w ?? ''} style={{ position: 'absolute', top: '30%', left: 16, right: 16, textAlign: 'center', fontSize: phone ? 30 : 42, fontWeight: 900, color: '#ffe7a8', textShadow: '0 4px 14px rgba(0,0,0,.7)', animation: 'clashpop .4s ease-out both', pointerEvents: 'none' }}>{w === null ? '' : L.winner(entrants[w].name)}</div>)(live.play.winner() === null ? null : seatOf(live.play.winner()!))}
        {cer.k === 'tree' && <TreePop br={br} last={cer.last} full={full} entrants={entrants} me={ME} R={R} />}
        {ceremony && (cer.k === 'intro' || cer.k === 'begin' || cer.k === 'winner' || cer.k === 'tree') && (
          <button data-clash-skip onClick={skip} style={{ position: 'absolute', bottom: 12, right: 12, zIndex: 3, padding: '7px 14px', borderRadius: 16, border: 'none', fontWeight: 800, fontSize: 13, background: 'rgba(255,248,232,.85)', color: H.ink, cursor: 'pointer' }}>{L.skip}</button>
        )}
        <style>{'@keyframes clashcarda { from { transform: translateX(-120%); opacity: 0 } to { transform: none; opacity: 1 } } @keyframes clashcardb { from { transform: translateX(120%); opacity: 0 } to { transform: none; opacity: 1 } } @keyframes clashpop { from { transform: scale(.4); opacity: 0 } 70% { transform: scale(1.12) } to { transform: none; opacity: 1 } } @keyframes clashup { from { transform: translateY(14px); opacity: 0 } to { transform: none; opacity: 1 } }'}</style>
        {yourTurn && cer.k === 'intro' && <div data-clash-your-turn style={{ position: 'absolute', top: '56%', left: 0, right: 0, textAlign: 'center', fontSize: 30, fontWeight: 900, color: '#fff4d8', textShadow: '0 3px 10px rgba(0,0,0,.6)' }}>{L.yourBout}</div>}
        {done && cer.k !== 'tree' && (
          <div data-clash-ring-result={(full ? won : br.bouts[br.bouts.length - 1].winner === YOU) ? 'won' : 'lost'} data-clash-champion={full ? champion(br) ?? '' : undefined} style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 'min(320px, calc(100% - 32px))', padding: 18, borderRadius: 14, background: H.paper, boxShadow: '0 8px 30px rgba(0,0,0,.45)', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: (full ? won : br.bouts[br.bouts.length - 1].winner === YOU) ? H.ember : H.rust }}>{(full ? won : br.bouts[br.bouts.length - 1].winner === YOU) ? L.won : L.lost}</div>
            {champion(br) !== null && <div data-clash-champion-name style={{ marginTop: 4, fontWeight: 800 }}>{L.champion(entrants[champion(br)!].name)}</div>}
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
                <div key={i} data-bracket-bout={i} data-bout-state={b.winner !== null ? 'done' : live?.i === i ? 'live' : 'waiting'} data-bout-winner={b.winner ?? ''} data-bout-you={mineOf(b) ? '1' : '0'}
                  style={{ borderRadius: 8, padding: '4px 8px', background: live?.i === i ? 'rgba(224,130,63,.18)' : 'rgba(255,250,240,.7)', boxShadow: `inset 0 0 0 ${live?.i === i ? 2 : 1}px ${live?.i === i ? H.ember : 'rgba(58,39,22,.14)'}` }}>
                  {[b.a, b.b].map((seat, k) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontSize: 13, lineHeight: '20px',
                      fontWeight: seat !== null && b.winner === seat ? 900 : 600, color: seat === null ? H.inkFaint : b.winner !== null && b.winner !== seat ? H.inkFaint : H.ink,
                      textDecoration: b.winner !== null && seat !== null && b.winner !== seat ? 'line-through' : 'none' }}>
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{seat === null ? '...' : entrants[seat].name}</span>
                      {seat !== null && seat === ME && <span style={{ color: H.ember, fontWeight: 800 }}>{L.you}</span>}
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

/** M233 v2d: the TREE pops up over the ring after a bout: the loser crossed off, the winner moved up its branch (pops in), the
 *  next two highlighted; after the final, the champion at the top. */
function TreePop({ br, last, full, entrants, me, R }: { br: Bracket; last: number | null; full: boolean; entrants: RingEntrant[]; me: number | null; R: number }) {
  const marks = treeMarks(br, last, full), champ = champion(br)
  return (
    <div data-clash-tree data-tree-last={last ?? ''} style={{ position: 'absolute', inset: 0, zIndex: 2, display: 'grid', placeItems: 'center', background: 'rgba(29,23,18,.55)', padding: 12, animation: 'clashpop .35s ease-out both' }}>
      <div style={{ width: 'min(560px, 100%)', padding: '14px 14px 16px', borderRadius: 14, background: H.paper, boxShadow: '0 10px 34px rgba(0,0,0,.5)' }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: H.inkSoft, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>{L.bracket}</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
          {Array.from({ length: R }, (_, r) => (
            <div key={r} style={{ flex: 1, minWidth: 0, display: 'grid', gap: 8, alignContent: 'space-around' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: H.inkSoft }}>{L.round(r, R)}</div>
              {br.bouts.map((b, i) => b.round !== r ? null : (
                <div key={i} data-tree-bout={i} data-tree-crossed={marks[i].crossed ?? ''} data-tree-moved={marks[i].moved ? '1' : '0'} data-tree-next={marks[i].next ? '1' : '0'}
                  style={{ borderRadius: 8, padding: '4px 8px', background: marks[i].next ? 'rgba(224,130,63,.22)' : 'rgba(255,250,240,.75)', boxShadow: `inset 0 0 0 ${marks[i].next ? 2 : 1}px ${marks[i].next ? H.ember : 'rgba(58,39,22,.14)'}` }}>
                  {[b.a, b.b].map((seat, k) => {
                    const out = seat !== null && marks[i].crossed === seat, isNew = marks[i].moved && seat !== null && br.bouts[last ?? -1]?.winner === seat
                    return (
                      <div key={k} data-tree-seat={seat ?? ''} data-tree-out={out ? '1' : '0'} style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontSize: 13, lineHeight: '20px', fontWeight: b.winner === seat && seat !== null ? 900 : 650,
                        color: seat === null ? H.inkFaint : out ? H.inkFaint : H.ink, textDecoration: out ? 'line-through' : 'none', animation: isNew ? 'clashup .6s .25s ease-out both' : undefined }}>
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{seat === null ? '...' : entrants[seat].name}</span>
                        {seat !== null && seat === me && <span style={{ color: H.ember, fontWeight: 800 }}>{L.you}</span>}
                      </div>
                    )
                  })}
                  {marks[i].next && <div style={{ fontSize: 11, fontWeight: 800, color: H.ember }}>{L.next}</div>}
                </div>
              ))}
            </div>
          ))}
          {champ !== null && (
            <div data-tree-champion={champ} style={{ flex: 1, minWidth: 0, display: 'grid', alignContent: 'center', textAlign: 'center', animation: 'clashup .6s .3s ease-out both' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: H.inkSoft }}>{L.champ}</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: H.ember, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{entrants[champ].name}</div>
            </div>
          )}
        </div>
      </div>
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
    // M233 v2d: the corner intro: she walks in from her corner (out by the wall, behind her start spot) to it
    const k = l.introMs > 0 ? Math.min(1, (performance.now() - l.introAt) / (l.introMs * 0.85)) : 1, e = 1 - (1 - k) * (1 - k)
    const r0 = Math.hypot(p.x, p.z) || 1, cx = (p.x / r0) * (RING_R - 0.6), cz = (p.z / r0) * (RING_R - 0.6)
    g.current.position.set(cx + (p.x - cx) * e, 0, cz + (p.z - cz) * e)
    g.current.rotation.y = k < 1 ? Math.atan2(p.x - cx, p.z - cz) : p.face
    const down = p.act === 'down', hop = p.act === 'win' ? Math.abs(Math.sin(t * 6)) * 0.12 : p.act === 'hit' ? 0.05 : 0
    body.current.rotation.z = THREE.MathUtils.lerp(body.current.rotation.z, down ? 1.35 : 0, 0.15)
    body.current.position.y = hop
    const c: RigClip = k < 1 ? 'walk' : p.act === 'strike' || p.act === 'evade' ? 'run' : p.act === 'walk' ? 'walk' : 'idle'
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

/** M233 v2d: the camera from ONE table (clash-ceremony.ts CLASH_CAM; the dev tuner passes live values). Fixed on the ring's
 *  centre by default (no trailing: v2a's lagging follow pushed the fighters to the frame's edge at low FPS); a narrow screen
 *  pulls it back so the ring fits. `out` counts frames where a fighter (feet or head) left the frame (the check reads it). */
function RingCamera({ live, cam, out }: { live: { current: Live | null }; cam: ClashCam; out: { current: number } }) {
  const camera = useThree(s => s.camera) as THREE.PerspectiveCamera, size = useThree(s => s.size)
  const tgt = useRef(new THREE.Vector3()), v = useMemo(() => new THREE.Vector3(), [])
  useFrame((_s, dt) => {
    const l = live.current, want = new THREE.Vector3()
    let f: { a: BoutPose; b: BoutPose } | null = null
    if (l) { f = l.play.at(tOf(l)); want.set((f.a.x + f.b.x) / 2, 0, (f.a.z + f.b.z) / 2).multiplyScalar(cam.follow) }
    tgt.current.lerp(want, 1 - Math.exp(-4 * Math.min(0.1, dt)))   // frame-rate independent
    const p = camPose(cam, size.width / Math.max(1, size.height))
    if (camera.fov !== p.fov) { camera.fov = p.fov; camera.updateProjectionMatrix() }
    camera.position.set(tgt.current.x + p.x, p.y, tgt.current.z + p.z)
    camera.lookAt(tgt.current)
    camera.updateMatrixWorld()
    if (f && l && performance.now() >= l.start) {
      let bad = false
      for (const q of [f.a, f.b]) for (const y of [0, 1.1]) { v.set(q.x, y, q.z).project(camera); if (Math.abs(v.x) > 1 || Math.abs(v.y) > 1) bad = true }
      if (bad) out.current++
    }
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

