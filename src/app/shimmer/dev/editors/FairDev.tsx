'use client'
// BETA M243 (sprites, 2026-11-27): THE FAIR BENCH, /shimmer/dev?mode=fair (owner only: the /shimmer/dev gate, src/proxy.ts).
// Alex 11-27 13:37: the three Fair events in one place, no tent walk, no prize. Tabs CLASH / DASH / SMASH, each mounts the REAL
// scene: Clash = clash-ring.tsx's ClashRing (line-up tree + the live engine, clash-fight.ts), Dash = dash-view.tsx's DashRace,
// Smash = (M246) smash-bell-view.tsx's SmashBellView, the bell show in the Clash ring. Controls: her spirit (species, form, level dial; tent levels 12 / 40 by default), the
// opponents (random or picked), seed, speed 1x/2x/4x, Replay (same seed = same result). Clash adds the engine's per-tick event
// log and the sim's win odds for her against each opponent. NO SERVER WRITES: only the pure engines run here, and while the bench
// is open fair-dev.ts installNoWrites() refuses any write to /api (the count shows in the header). Labels are plain UI words (@lark).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ClashRing, type RingEntrant } from '../../open/ather/clash-ring'
import { CLASH_CAM, CAM_RANGE, camLine, type ClashCam } from '../../open/ather/clash-ceremony'   // M233 v2d camera tuner
import { DashRace, type RaceResult } from '../../open/ather/dash-view'
import { SmashBellView } from '../../open/ather/smash-bell-view'   // M246 the bell show
import { cracks, cleanCraftedScore } from '../../open/ather/smash-score'
import { fmtTime } from '../../open/ather/fair-dash-rules'
import type { TickLog } from '../../open/ather/clash-fight'
import type { Species, Element } from '../../spirits/spirit'
import {
  FAIR_SPECIES, FAIR_FORMS, SPEEDS, DEFAULT_LEVEL, clampLevel, pickName, devSpirit, devEntrant, devClashRunner, randomFoes, logLine,
  clashOdds, devHeat, runHeat, devSmash, installNoWrites, type Pick, type BenchTier, type Odds,
} from './fair-dev'

type Tab = 'clash' | 'dash' | 'smash'
const INK = '#f3e6cc', DIM = 'rgba(243,230,204,.6)', PANEL = 'rgba(255,255,255,.05)', EMBER = '#e0823f'
const ODDS_N = 200, LOG_MAX = 4000
const newSeed = () => 1 + Math.floor(Math.random() * 99999)
const narrow = () => typeof window !== 'undefined' && window.innerWidth < 700

const box: React.CSSProperties = { background: PANEL, borderRadius: 10, padding: 10, display: 'grid', gap: 8, alignContent: 'start' }
const btn = (on = false): React.CSSProperties => ({ padding: '6px 12px', borderRadius: 8, border: `1px solid ${on ? EMBER : 'rgba(243,230,204,.25)'}`, background: on ? EMBER : 'transparent', color: on ? '#1d1712' : INK, fontWeight: 700, cursor: 'pointer' })
const sel: React.CSSProperties = { background: '#2a221b', color: INK, border: '1px solid rgba(243,230,204,.25)', borderRadius: 6, padding: '4px 6px' }

function PickRow({ p, onChange, label, data }: { p: Pick; onChange: (p: Pick) => void; label: string; data: string }) {
  return (
    <div data-fair-pick={data} data-species={p.species} data-element={p.element} data-level={p.level} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ width: 64, fontSize: 12, color: DIM }}>{label}</span>
      <select data-fair-species aria-label={`${label} species`} value={p.species} onChange={e => onChange({ ...p, species: e.target.value as Species })} style={sel}>
        {FAIR_SPECIES.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      <select data-fair-form aria-label={`${label} form`} value={p.element} onChange={e => onChange({ ...p, element: e.target.value as Element })} style={sel}>
        {FAIR_FORMS.map(f => <option key={f} value={f}>{f === 'base' ? 'base form' : f}</option>)}
      </select>
      <input data-fair-level aria-label={`${label} level`} type="number" min={1} max={99} value={p.level} onChange={e => onChange({ ...p, level: clampLevel(Number(e.target.value)) })} style={{ ...sel, width: 56 }} />
      <span style={{ fontSize: 12, color: DIM }}>{pickName(p)}</span>
    </div>
  )
}

export default function FairDev() {
  const [tab, setTab] = useState<Tab>(() => { try { const t = new URLSearchParams(window.location.search).get('event'); return t === 'dash' || t === 'smash' ? t : 'clash' } catch { return 'clash' } })
  const [tier, setTier] = useState<BenchTier>('easy')
  const [me, setMe] = useState<Pick>({ species: 'fox', element: 'base', level: DEFAULT_LEVEL.easy })
  const [foes, setFoes] = useState<Pick[]>(() => randomFoes('easy', 1))
  const [dashPicked, setDashPicked] = useState(false)
  const [dashFoes, setDashFoes] = useState<Pick[]>(() => randomFoes('easy', 2, 4).concat([{ species: 'turtle', element: 'base', level: 12 }]).slice(0, 4))
  const [seed, setSeed] = useState(1)
  const [speed, setSpeed] = useState<number>(1)
  const [crafted, setCrafted] = useState<number | null>(null)   // M246 test hook: a crafted score, ?smashscore=N (the bench never writes)
  useEffect(() => { try { setCrafted(cleanCraftedScore(new URLSearchParams(window.location.search).get('smashscore'))) } catch { /* no URL: off */ } }, [])
  const [cam, setCam] = useState<ClashCam>(CLASH_CAM)   // M233 v2d: the ring's camera, tuned live over a running ring
  const [run, setRun] = useState<{ id: number; tab: Tab; seed: number } | null>(null)
  const [result, setResult] = useState<{ tab: Tab; seed: number; sig: string; text: string } | null>(null)
  const [history, setHistory] = useState<{ tab: Tab; seed: number; sig: string }[]>([])
  const [blocked, setBlocked] = useState<string[]>([])
  const runId = useRef(0)

  // no writes while the bench is open
  useEffect(() => installNoWrites(window as never, (u, m) => setBlocked(b => [...b, `${m} ${u}`])), [])
  useEffect(() => { const u = new URL(window.location.href); u.searchParams.set('event', tab); window.history.replaceState({}, '', u.toString()) }, [tab])

  const setTierAndLevels = (t: BenchTier) => {
    setTier(t); setMe(m => ({ ...m, level: DEFAULT_LEVEL[t], element: t === 'easy' ? 'base' : m.element === 'base' ? 'storm' : m.element }))
    setFoes(randomFoes(t, seed))
  }
  const start = (s = seed) => { runId.current++; setResult(null); setRun({ id: runId.current, tab, seed: s }) }
  const finish = useCallback((t: Tab, s: number, sig: string, text: string) => {
    setResult({ tab: t, seed: s, sig, text }); setHistory(h => [...h.slice(-9), { tab: t, seed: s, sig }])
  }, [])
  const stop = () => setRun(null)

  return (
    <div data-fair-dev data-fair-tab-open={tab} data-fair-blocked={blocked.length} style={{ color: INK, display: 'grid', gap: 12, maxWidth: 1100 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {(['clash', 'dash', 'smash'] as Tab[]).map(t => (
          <button key={t} data-fair-tab={t} onClick={() => { setTab(t); setRun(null); setResult(null) }} style={btn(tab === t)}>{t.toUpperCase()}</button>
        ))}
        <span style={{ fontSize: 12, color: DIM, marginLeft: 'auto' }}>No prize, no Marks, no board. Writes refused: <b data-fair-blocked-n>{blocked.length}</b></span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
        <div style={box}>
          <div style={{ fontWeight: 800 }}>Your spirit</div>
          {tab === 'clash' && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ width: 64, fontSize: 12, color: DIM }}>Tent</span>
              {(['easy', 'average'] as BenchTier[]).map(t => <button key={t} data-fair-tier={t} onClick={() => setTierAndLevels(t)} style={btn(tier === t)}>{t} (Lv{DEFAULT_LEVEL[t]})</button>)}
            </div>
          )}
          <PickRow p={me} onChange={setMe} label="You" data="you" />
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ width: 64, fontSize: 12, color: DIM }}>Seed</span>
            <input data-fair-seed aria-label="seed" type="number" value={seed} onChange={e => setSeed(Math.max(1, Math.floor(Number(e.target.value) || 1)))} style={{ ...sel, width: 90 }} />
            <button data-fair-newseed onClick={() => setSeed(newSeed())} style={btn()}>New seed</button>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ width: 64, fontSize: 12, color: DIM }}>Speed</span>
            {SPEEDS.map(x => <button key={x} data-fair-speed={x} onClick={() => setSpeed(x)} style={btn(speed === x)}>{x}x</button>)}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button data-fair-run onClick={() => start()} style={btn(true)}>Run</button>
            <button data-fair-replay disabled={!result} onClick={() => result && start(result.seed)} style={{ ...btn(), opacity: result ? 1 : 0.4 }}>Replay seed {result?.seed ?? ''}</button>
          </div>
          {result && result.tab === tab && (
            <div data-fair-result={result.tab} data-fair-sig={result.sig} data-fair-result-seed={result.seed} style={{ fontSize: 13, whiteSpace: 'pre-wrap', fontFamily: 'ui-monospace, monospace' }}>{result.text}</div>
          )}
          {history.filter(h => h.tab === tab).length > 0 && (
            <div data-fair-history style={{ fontSize: 11, color: DIM, fontFamily: 'ui-monospace, monospace' }}>
              {history.filter(h => h.tab === tab).map((h, i) => <div key={i}>seed {h.seed}: {h.sig}</div>)}
            </div>
          )}
        </div>

        {tab === 'clash' && <ClashSide me={me} foes={foes} setFoes={setFoes} tier={tier} seed={seed} busy={!!run} />}
        {tab === 'dash' && (
          <div style={box}>
            <div style={{ fontWeight: 800 }}>The heat</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button data-fair-dash-mode="entrants" onClick={() => setDashPicked(false)} style={btn(!dashPicked)}>Fair entrants (seeded)</button>
              <button data-fair-dash-mode="picked" onClick={() => setDashPicked(true)} style={btn(dashPicked)}>Pick them</button>
            </div>
            {dashPicked
              ? dashFoes.map((p, i) => <PickRow key={i} p={p} onChange={np => setDashFoes(f => f.map((x, k) => (k === i ? np : x)))} label={`Lane ${i < 2 ? i + 1 : i + 2}`} data={`dash-${i}`} />)
              : devHeat(me, null, seed).filter(r => !r.you).map((r, i) => <div key={i} style={{ fontSize: 13 }}>{r.name} <span style={{ color: DIM }}>· base stats</span></div>)}
            <DashPredict me={me} others={dashPicked ? dashFoes : null} seed={seed} />
          </div>
        )}
        {tab === 'smash' && <div style={box}><div style={{ fontWeight: 800 }}>The bell</div><div style={{ fontSize: 13, color: DIM }}>One swing in the ring: her strongest known move at her level, the roll seeded. Smash has no cheer.</div>
          <label style={{ fontSize: 12, color: DIM, display: 'flex', gap: 6, alignItems: 'center' }}>Score override (test)<input data-fair-smash-score type="number" min={0} max={99999} value={crafted ?? ''} placeholder="off" onChange={e => setCrafted(cleanCraftedScore(e.target.value))} style={{ ...sel, width: 80 }} /></label></div>}
      </div>

      {run?.tab === 'smash' && <SmashRun key={run.id} me={me} seed={run.seed} speed={speed} crafted={crafted} onDone={finish} onExit={stop} />}
      {run?.tab === 'clash' && <ClashRun key={run.id} me={me} foes={foes} tier={tier} seed={run.seed} speed={speed} onDone={finish} onExit={stop} cam={cam} setCam={setCam} />}
      {run?.tab === 'dash' && <DashRun key={run.id} me={me} others={dashPicked ? dashFoes : null} seed={run.seed} speed={speed} onDone={finish} onExit={stop} />}
    </div>
  )
}

// ── CLASH ──
function ClashSide({ me, foes, setFoes, tier, seed, busy }: { me: Pick; foes: Pick[]; setFoes: (f: Pick[]) => void; tier: BenchTier; seed: number; busy: boolean }) {
  return (
    <div style={box}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ fontWeight: 800 }}>The line-up</div>
        <button data-fair-random-foes onClick={() => setFoes(randomFoes(tier, seed + Math.floor(Math.random() * 1e6)))} style={{ ...btn(), marginLeft: 'auto' }}>Random</button>
      </div>
      {foes.map((p, i) => <PickRow key={i} p={p} onChange={np => setFoes(foes.map((x, k) => (k === i ? np : x)))} label={`Foe ${i + 1}`} data={`foe-${i}`} />)}
      <ClashOdds me={me} foes={foes} paused={busy} />
    </div>
  )
}

/** the sim's odds (clash-sim.mts's loop, ODDS_N seeded fights, sides swapped): her win share against each foe, worked in slices */
function ClashOdds({ me, foes, paused }: { me: Pick; foes: Pick[]; paused: boolean }) {
  const key = JSON.stringify([me, foes])
  const [odds, setOdds] = useState<Record<number, Odds>>({})
  useEffect(() => setOdds({}), [key])
  useEffect(() => {
    if (paused) return
    let cancelled = false
    const a = devEntrant(me), bs = foes.map(devEntrant)
    const acc: Record<number, Odds> = {}
    let k = 0, from = 0
    const slice = () => {
      if (cancelled || k >= bs.length) return
      const to = Math.min(ODDS_N, from + 8)
      acc[k] = clashOdds(a, bs[k], to, 1, from, acc[k])
      from = to
      if (from >= ODDS_N) { k++; from = 0 }
      setOdds({ ...acc })
      setTimeout(slice, 0)
    }
    slice()
    return () => { cancelled = true }
  }, [key, paused])   // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div data-fair-odds style={{ display: 'grid', gap: 2, fontSize: 13 }}>
      <div style={{ fontSize: 12, color: DIM }}>Sim odds, {ODDS_N} fights each (no cheer){paused ? ', paused while a run plays' : ''}</div>
      {foes.map((f, i) => { const o = odds[i]; return (
        <div key={i} data-fair-odds-row={`${me.species}>${f.species}`} data-odds-n={o?.n ?? 0} data-odds-win={o ? (o.aWins / o.n).toFixed(3) : ''} style={{ fontFamily: 'ui-monospace, monospace' }}>
          {pickName(me)} v {pickName(f)}: {o ? `${Math.round((o.aWins / o.n) * 100)}% win · ${o.meanS.toFixed(0)} s avg${o.timeouts ? ` · ${o.timeouts} timeouts` : ''}` : '...'} <span style={{ color: DIM }}>({o?.n ?? 0}/{ODDS_N})</span>
        </div>) })}
    </div>
  )
}

/** M233 v2d: Alex's CAMERA TUNER, floating over the running ring (live preview): height, distance, angle, FOV (+ fit, follow);
 *  'Copy values' copies the line that drops straight into clash-ceremony.ts CLASH_CAM. */
function CamTuner({ cam, setCam }: { cam: ClashCam; setCam: (c: ClashCam) => void }) {
  const [open, setOpen] = useState(true), [copied, setCopied] = useState(false)
  const keys = Object.keys(CAM_RANGE) as (keyof ClashCam)[]
  return (
    <div data-fair-cam style={{ position: 'fixed', zIndex: 62, top: 8, right: 8, width: open ? 236 : 'auto', background: 'rgba(20,15,11,.86)', borderRadius: 8, color: INK, padding: '6px 8px', fontSize: 12 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <b>Camera</b>
        <button data-fair-cam-toggle onClick={() => setOpen(o => !o)} style={{ ...btn(), marginLeft: 'auto', padding: '2px 8px', fontSize: 11 }}>{open ? 'Hide' : 'Show'}</button>
      </div>
      {open && <>
        {keys.map(k => { const [lo, hi, st] = CAM_RANGE[k]; return (
          <label key={k} style={{ display: 'grid', gridTemplateColumns: '58px 1fr 38px', gap: 6, alignItems: 'center', marginTop: 4 }}>
            <span>{k}</span>
            <input data-fair-cam-dial={k} type="range" min={lo} max={hi} step={st} value={cam[k]} onChange={e => { setCopied(false); setCam({ ...cam, [k]: Number(e.target.value) }) }} />
            <span style={{ fontFamily: 'ui-monospace, monospace', textAlign: 'right' }}>{cam[k]}</span>
          </label>) })}
        <div data-fair-cam-line style={{ marginTop: 6, fontFamily: 'ui-monospace, monospace', fontSize: 10, wordBreak: 'break-all', color: DIM }}>{camLine(cam)}</div>
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <button data-fair-cam-copy onClick={() => { try { void navigator.clipboard?.writeText(camLine(cam)) } catch { /* no clipboard */ } setCopied(true) }} style={{ ...btn(), padding: '3px 8px', fontSize: 11 }}>{copied ? 'Copied' : 'Copy values'}</button>
          <button data-fair-cam-reset onClick={() => setCam(CLASH_CAM)} style={{ ...btn(), padding: '3px 8px', fontSize: 11 }}>Reset</button>
        </div>
      </>}
    </div>
  )
}

function ClashRun({ me, foes, tier, seed, speed, onDone, onExit, cam, setCam }: { me: Pick; foes: Pick[]; tier: BenchTier; seed: number; speed: number; onDone: (t: Tab, s: number, sig: string, text: string) => void; onExit: () => void; cam: ClashCam; setCam: (c: ClashCam) => void }) {
  const [lines, setLines] = useState<string[]>([])
  const winners = useRef<Record<number, string>>({})
  const buf = useRef<string[]>([])
  const heads = useRef(new Set<number>())
  const [open, setOpen] = useState(true)
  // the frozen line-up for this run (picks changed mid-run wait for the next)
  const entrants = useMemo<RingEntrant[]>(() => [me, ...foes].map(p => ({ name: pickName(p), species: p.species, element: p.element, spirit: () => devSpirit(p) })), [])   // eslint-disable-line react-hooks/exhaustive-deps
  const runner = useMemo(() => devClashRunner((bout: number, l: TickLog, names: [string, string]) => {
    if (!heads.current.has(bout)) { heads.current.add(bout); buf.current.push(`── bout ${bout + 1}: ${names[0]} v ${names[1]} ──`) }
    for (const e of l.ev) {
      buf.current.push(logLine(l.t, e, names))
      if (e.kind === 'end') winners.current[bout] = names[e.side]
    }
  }), [])
  useEffect(() => { const t = setInterval(() => { if (buf.current.length) { const add = buf.current.splice(0); setLines(v => [...v, ...add].slice(-LOG_MAX)) } }, 150); return () => clearInterval(t) }, [])
  const logRef = useRef<HTMLDivElement>(null)
  useEffect(() => { const el = logRef.current; if (el) el.scrollTop = el.scrollHeight }, [lines])
  const done = useCallback((won: boolean) => {
    setOpen(false)   // the line is over: fold the log so the ring's result card (and its Back button) is clear, on a phone above all
    const w = Object.keys(winners.current).map(Number).sort((a, b) => a - b).map(b => winners.current[b])
    onDone('clash', seed, `${won ? 'won' : 'lost'}|${w.join('>')}`, `${won ? 'She won the line.' : 'She is out.'}\n${w.map((n, i) => `bout ${i + 1}: ${n}`).join('\n')}`)
  }, [seed, onDone])
  const phone = narrow()
  return (
    <>
      <ClashRing tier={tier} title={`Bench · seed ${seed}`} entrants={entrants} runner={runner} speed={speed} seed={seed} result={null} onDone={done} onExit={onExit} cam={cam} />
      <CamTuner cam={cam} setCam={setCam} />
      <div data-fair-log-box style={{ position: 'fixed', zIndex: 61, left: 8, bottom: phone ? 'calc(38% + 8px)' : 8, width: phone ? 'calc(100% - 16px)' : 'min(440px, 45vw)', background: 'rgba(20,15,11,.82)', borderRadius: 8, color: INK }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '4px 8px', fontSize: 12 }}>
          <b>Engine log</b><span style={{ color: DIM }}>seed {seed} · {speed}x · {lines.length} lines</span>
          <button data-fair-log-toggle onClick={() => setOpen(o => !o)} style={{ ...btn(), marginLeft: 'auto', padding: '2px 8px', fontSize: 11 }}>{open ? 'Hide' : 'Show'}</button>
          <button data-fair-stop onClick={onExit} style={{ ...btn(), padding: '2px 8px', fontSize: 11 }}>Stop</button>
        </div>
        <div ref={logRef} data-fair-log data-log-lines={lines.length} style={{ display: open ? 'block' : 'none', height: phone ? '18vh' : '32vh', overflowY: 'auto', padding: '0 8px 6px', fontSize: 11, lineHeight: '15px', fontFamily: 'ui-monospace, monospace', whiteSpace: 'pre' }}>
          {lines.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      </div>
    </>
  )
}

// ── DASH ──
function DashPredict({ me, others, seed }: { me: Pick; others: Pick[] | null; seed: number }) {
  const heat = useMemo(() => devHeat(me, others, seed), [me, others, seed])
  const r = useMemo(() => runHeat(heat, seed), [heat, seed])
  return (
    <div data-fair-dash-predict={r.ms.join(',')} style={{ fontSize: 12, color: DIM, fontFamily: 'ui-monospace, monospace' }}>
      Headless, same seed, no cheer: {heat.map((h, i) => `${h.you ? '*' : ''}${h.name} ${r.ms[i] != null ? fmtTime(r.ms[i]!) : 'dnf'}`).join(' · ')}
    </div>
  )
}

function DashRun({ me, others, seed, speed, onDone, onExit }: { me: Pick; others: Pick[] | null; seed: number; speed: number; onDone: (t: Tab, s: number, sig: string, text: string) => void; onExit: () => void }) {
  const racers = useMemo(() => devHeat(me, others, seed), [])   // eslint-disable-line react-hooks/exhaustive-deps
  const [over, setOver] = useState(false)
  const done = (r: RaceResult) => {
    setOver(true)
    onDone('dash', seed, r.order.map(o => `${o.name}:${o.ms ?? 'dnf'}`).join('>'), `Place ${r.place} · ${fmtTime(r.ms)}\n${r.order.map((o, i) => `${i + 1}. ${o.name}${o.you ? ' (you)' : ''} ${o.ms != null ? fmtTime(o.ms) : 'dnf'}`).join('\n')}`)
  }
  if (over) return <ExitBar onExit={onExit} label="Race over: back to the bench" />
  return (
    <>
      <DashRace racers={racers} seed={seed} phone={narrow()} onDone={done} speed={speed} />
      <ExitBar onExit={onExit} label={`Stop · seed ${seed} · ${speed}x`} />
    </>
  )
}
function ExitBar({ onExit, label }: { onExit: () => void; label: string }) {
  return <button data-fair-stop onClick={onExit} style={{ position: 'fixed', zIndex: 61, right: 10, bottom: 10, ...btn(true) }}>{label}</button>
}

// ── SMASH (M246: the bell show) ──
function SmashRun({ me, seed, speed, crafted, onDone, onExit }: { me: Pick; seed: number; speed: number; crafted: number | null; onDone: (t: Tab, s: number, sig: string, text: string) => void; onExit: () => void }) {
  const r = useMemo(() => devSmash(me, seed), [me, seed])
  const score = crafted ?? r.score
  useEffect(() => { onDone('smash', seed, `${score}`, `${pickName(me)} Lv${me.level}: ${score}${crafted !== null ? ' (crafted)' : ''} · ${r.move}${cracks(score) ? ' · the bell cracked' : ''}`) }, [])   // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div data-fair-smash={score}>
      <SmashBellView title="Smash bench" speed={speed} onExit={onExit}
        contestants={[{ key: 'you', keeper: 'you', you: true, name: pickName(me), species: me.species, element: me.element, score, move: r.move }]} />
    </div>
  )
}
