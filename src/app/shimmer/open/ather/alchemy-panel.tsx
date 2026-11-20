'use client'
// M57: THE PANEL A PLACED ALCHEMY PIECE OPENS (E at the piece, workshop.tsx › PiecePanel hands over). It lists every step this
// station does across the potions (alchemy-set.ts › stepsAt), spends from the bag (best grade first), runs the step with a
// live bar and drops the product in the bag when it is done, with a line saying where it goes next. Pure rules live in
// alchemy-set.ts + alchemy-runs.ts; this is the drawing.
import { useEffect, useState, type ReactNode } from 'react'
import { HearthFrame, HearthButton, H } from '../../ui/hearth'
import { getInv, setInv, useInv } from '../shared/bag'
import { give, take, itemDef, type Inv } from '../shared/inventory'
import { hudSay } from '../shared/hud-say'
import { ALC_STATIONS, ALC_POTIONS, INTERMEDIATES, stepsAt, pickFor, gradeFrom, gradeOrNull, fills, type AlcStation, type Have } from './alchemy-set'
import { loadRuns, saveRuns, startRun, collectRun, runFrac, runLeft, type Runs } from './alchemy-runs'

export const haveOf = (inv: Inv): Have => {
  const h: Record<string, number> = {}
  for (const s of inv.slots) if (s) h[s.id] = (h[s.id] ?? 0) + s.n
  return h
}
const slotName = (id: string) => id.startsWith('alc:') ? INTERMEDIATES[id.slice(4)] : id.startsWith('crop:') ? itemDef(`${id}:D`).name.replace(/ · D$/, '') : itemDef(id).name
const secs = (ms: number) => ms >= 60_000 ? `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s` : `${Math.ceil(ms / 1000)}s`

function Bar({ frac }: { frac: number }) {
  return (
    <div data-alc-bar={Math.round(frac * 100)} style={{ height: 10, borderRadius: 10, background: 'rgba(58,39,22,.12)', boxShadow: 'inset 0 1px 2px rgba(58,39,22,.25)', overflow: 'hidden' }}>
      <div style={{ width: `${Math.max(0, Math.min(1, frac)) * 100}%`, height: '100%', borderRadius: 10, background: 'linear-gradient(180deg, #8fb8ff, #4a6fc8)', transition: 'width .25s linear' }} />
    </div>
  )
}

/** Where a product goes next: the station of the step that takes it, or "drink it" for a bottle. */
function nextLine(potion: string, k: number): string {
  const p = ALC_POTIONS[potion]
  if (k === p.steps.length - 1) return 'Hold it and click to drink.'
  const out = p.steps[k].out, nxt = p.steps.findIndex((s, i) => i > k && s.in.some(x => x.id === `alc:${out}`))
  return nxt >= 0 ? `Next: the ${ALC_STATIONS[p.steps[nxt].at].name}.` : ''
}

export function AlchemyPanel({ pid, station, onClose, footer }: { pid: string; station: AlcStation; onClose: () => void; footer?: ReactNode }) {
  const inv = useInv(), have = haveOf(inv), def = ALC_STATIONS[station]
  const [runs, setRuns] = useState<Runs>(() => loadRuns())
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t) }, [])
  const run = runs[pid]
  // a finished run lands in the bag at once (and on opening, for one finished while you were away)
  useEffect(() => {
    if (!run || runLeft(run, now) > 0) return
    const c = collectRun(runs, pid, now); if (!c) return
    const g = give(getInv(), c.got.id, c.got.n)
    if (g.left) { hudSay('Your bag is full. Make room and come back for it.', 'info', 4); return }
    setInv(g.inv); setRuns(c.runs); saveRuns(c.runs)
    hudSay(`${itemDef(c.got.id).name}${c.got.n > 1 ? ` × ${c.got.n}` : ''}. ${nextLine(run.potion, run.k)}`, 'item', 4)
  }, [run, now, runs, pid])

  const start = (potion: string, k: number) => {
    const s = startRun(loadRuns(), pid, potion, k, haveOf(getInv()), Date.now()); if (!s) return
    let bag: Inv | null = getInv()
    for (const x of s.spend) { bag = bag && take(bag, x.id, x.n) }
    if (!bag) return
    setInv(bag); setRuns(s.runs); saveRuns(s.runs)
  }
  const steps = stepsAt(station)

  return (
    <HearthFrame title={def.name} maxWidth={460} onClose={onClose} fixed dataPanel="alchemy">
      <div data-alc-station={station} style={{ padding: '26px 16px 14px', display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 13, color: H.inkSoft }}>{def.blurb}</div>
        {run && (
          <div data-alc-run={`${run.potion}:${run.k}`} style={{ display: 'grid', gap: 6, padding: 10, borderRadius: 12, background: 'rgba(143,184,255,.12)' }}>
            <div style={{ display: 'flex', fontSize: 13, fontWeight: 700, color: H.ink }}>
              <span>{def.verb}ing · {run.k === ALC_POTIONS[run.potion].steps.length - 1 ? ALC_POTIONS[run.potion].name : INTERMEDIATES[ALC_POTIONS[run.potion].steps[run.k].out]} · {gradeFrom(run.spent)}</span>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: H.inkSoft, fontVariantNumeric: 'tabular-nums' }}>{secs(runLeft(run, now))}</span>
            </div>
            <Bar frac={runFrac(run, now)} />
          </div>
        )}
        <div style={{ display: 'grid', gap: 8 }}>
          {steps.map(({ potion, k, step }) => {
            const p = ALC_POTIONS[potion], last = k === p.steps.length - 1, pick = pickFor(step, have)
            const outName = last ? `${p.name} × ${p.makes}` : INTERMEDIATES[step.out]
            return (
              <div key={`${potion}:${k}`} data-alc-step={`${potion}:${k}`} data-can={pick ? 1 : 0} style={{ display: 'grid', gap: 4, padding: '8px 10px', borderRadius: 12, background: 'rgba(58,39,22,.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: H.ink }}>{outName}</div>
                  <div style={{ fontSize: 11, color: H.inkSoft }}>for the {p.name}</div>
                  <span data-act="alc-start" style={{ marginLeft: 'auto' }}>
                    <HearthButton small primary disabled={!pick || !!run} onClick={() => start(potion, k)}>{def.verb}</HearthButton>
                  </span>
                </div>
                <div style={{ fontSize: 12, color: H.inkSoft }}>
                  {step.in.map(s => {
                    const n = Object.keys(have).filter(id => fills(s.id, id)).reduce((a, id) => a + have[id], 0)
                    return `${s.n} ${slotName(s.id)} (${n})`
                  }).join(' + ')} · {secs(step.ms)}
                  {pick && (last || gradeOrNull(pick)) && <> · makes grade <b data-alc-grade>{gradeFrom(pick)}</b></>}
                </div>
              </div>
            )
          })}
        </div>
        <div style={{ fontSize: 11.5, color: H.inkSoft }}>Higher-grade crops make a stronger potion. The best you carry goes in first.</div>
        {footer}
      </div>
    </HearthFrame>
  )
}
