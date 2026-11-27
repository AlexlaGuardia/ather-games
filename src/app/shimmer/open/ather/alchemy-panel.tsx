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
import { useWideLayout, wideSingle } from './wide-panel'   // M199
import { ALC_STATIONS, ALC_POTIONS, ALC_POTION_ORDER, INTERMEDIATES, stepsAt, chainOf, pickFor, gradeFrom, gradeOrNull, fills, type AlcStation, type Have } from './alchemy-set'
import { loadRuns, saveRuns, startRun, collectRun, runFrac, runLeft, type Runs } from './alchemy-runs'
import { extraBottles } from './alchemist-boon'
import { INFUSION, MEAL_UI, infusionsAt, recipeTake, slotHave, spiceMixesAt, type InfusionRecipe } from './infusions'   // M207: the stations make the four infusions; M234 s2: + the spice mixes

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

/** M57 s2: `boon` = the best alchemist standing near this piece (alchemist-boon.ts), read when a brew FINISHES here. A check may
 *  set window.__alcRoll (a number in [0,1)) to fix the roll; otherwise Math.random. */
export function AlchemyPanel({ pid, station, onClose, footer, boon }: { pid: string; station: AlcStation; onClose: () => void; footer?: ReactNode; boon?: () => { chance: number; name: string } }) {
  const inv = useInv(), have = haveOf(inv), def = ALC_STATIONS[station], lay = useWideLayout()
  const [runs, setRuns] = useState<Runs>(() => loadRuns())
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t) }, [])
  const run = runs[pid]
  // a finished run lands in the bag at once (and on opening, for one finished while you were away)
  useEffect(() => {
    if (!run || runLeft(run, now) > 0) return
    const c = collectRun(runs, pid, now); if (!c) return
    // the last step finishes a bottle: the alchemist at the set rolls once per participant (solo now) for ONE extra
    const last = run.k === ALC_POTIONS[run.potion].steps.length - 1, b = last && boon ? boon() : null
    const fixed = (window as unknown as { __alcRoll?: number }).__alcRoll
    const extra = b && b.chance > 0 ? extraBottles(b.chance, 1, typeof fixed === 'number' ? () => fixed : Math.random) : 0
    const got = { id: c.got.id, n: c.got.n + extra }
    const g = give(getInv(), got.id, got.n)
    if (g.left) { hudSay('Your bag is full. Make room and come back for it.', 'info', 4); return }
    setInv(g.inv); setRuns(c.runs); saveRuns(c.runs)
    hudSay(`${itemDef(got.id).name}${got.n > 1 ? ` × ${got.n}` : ''}.${extra ? ` One extra, thanks to ${b!.name}.` : ''} ${nextLine(run.potion, run.k)}`, 'item', 4)
  }, [run, now, runs, pid, boon])

  const start = (potion: string, k: number) => {
    const s = startRun(loadRuns(), pid, potion, k, haveOf(getInv()), Date.now()); if (!s) return
    let bag: Inv | null = getInv()
    for (const x of s.spend) { bag = bag && take(bag, x.id, x.n) }
    if (!bag) return
    setInv(bag); setRuns(s.runs); saveRuns(s.runs)
  }
  const steps = stepsAt(station)

  // M199 (Alex 11-26): wide before it scrolls. Desktop / landscape: what the station is and is doing on the LEFT, its steps on the
  // RIGHT, side by side; a portrait phone keeps the one column in the old order.
  const info = <>
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
        {station === 'desk' && (
          // the ruling: a recipe STARTS at the Desk. Opening one here shows its whole road, so the keeper knows where to walk.
          <div data-alc-recipes style={{ display: 'grid', gap: 4, padding: '8px 10px', borderRadius: 12, background: 'rgba(201,168,255,.12)' }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: H.inkSoft }}>Recipes</div>
            {ALC_POTION_ORDER.map(p => (
              <div key={p} data-alc-recipe={p} style={{ fontSize: 12, color: H.ink }}>
                <b>{ALC_POTIONS[p].name}</b> <span style={{ color: H.inkSoft }}>· {chainOf(p).map(a => ALC_STATIONS[a].name).join(' → ')}</span>
              </div>
            ))}
          </div>
        )}
    </>
  const work = <>
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
        {(infusionsAt(station).length > 0 || spiceMixesAt(station).length > 0) && <InfusionList station={station} have={have} />}
    </>
  const tail = <>
        <div style={{ fontSize: 11.5, color: H.inkSoft }}>Higher-grade crops make a stronger potion. The best you carry goes in first.</div>
        {footer}
    </>
  return (
    <HearthFrame title={def.name} maxWidth={lay.wide ? wideSingle(lay.vw) : 460} onClose={onClose} fixed dataPanel="alchemy" bodyClass={lay.wide ? '!max-h-[calc(100vh_-_96px)]' : ''}>
      <div data-alc-station={station} style={{ padding: '26px 16px 14px', display: 'grid', gap: lay.wide ? 18 : 12, alignItems: 'start', gridTemplateColumns: lay.wide ? 'minmax(0, 5fr) minmax(0, 7fr)' : undefined }}>
        {lay.wide ? (<>
          <div data-wide-col="info" style={{ display: 'grid', gap: 12 }}>{info}{tail}</div>
          <div data-wide-col="steps" style={{ display: 'grid', gap: 12 }}>{work}</div>
        </>) : <>{info}{work}{tail}</>}
      </div>
    </HearthFrame>
  )
}

/** M207 (Alex 11-26): the four INFUSIONS, meal ingredients made at once at their station (infusions.ts INFUSION): Aqual Sauce +
 *  Fuli Powder at the Crusher Table, Golden Glaze at the Still, Storm Broth at the Cauldron Nook. A crop goes in worst grade
 *  first (an infusion carries no grade). The infusion cooks into its element's meal at the hearth. */
function InfusionList({ station, have }: { station: AlcStation; have: Have }) {
  // M234 s2: the station's recipes = its infusions + its spice mixes (Fiery Fuli Powder at the Crusher Table)
  const recipes: { key: string; rec: InfusionRecipe }[] = [...infusionsAt(station).map(el => ({ key: el as string, rec: INFUSION[el] })), ...spiceMixesAt(station).map(m => ({ key: m.id, rec: m }))]
  const make = (rec: InfusionRecipe) => {
    let bag: Inv | null = getInv()
    const spend = bag && recipeTake(rec, haveOf(bag))
    if (!bag || !spend) return
    for (const s of spend) { bag = take(bag, s.id, s.n); if (!bag) return }
    const g = give(bag, rec.id, 1)
    if (g.left) { hudSay('Your bag is full. Make room and come back for it.', 'info', 4); return }
    setInv(g.inv); hudSay(`${itemDef(rec.id).name}. Next: the hearth.`, 'item', 4)
  }
  const slotLabel = (id: string) => (id.startsWith('crop:') ? itemDef(`${id}:D`).name.replace(/ · D$/, '') : itemDef(id).name)
  return (
    <div data-infusions style={{ display: 'grid', gap: 6, padding: '8px 10px', borderRadius: 12, background: 'rgba(58,39,22,.06)' }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: H.inkSoft }}>{MEAL_UI.infusions}</div>
      {recipes.map(({ key, rec }) => {
        const can = !!recipeTake(rec, have)
        return (
          <div key={key} data-infusion={key} data-can={can ? 1 : 0} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'grid', gap: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: H.ink }}>{itemDef(rec.id).name}</div>
              <div style={{ fontSize: 12, color: H.inkSoft }}>{rec.in.map(s => `${s.n} ${slotLabel(s.id)} (${slotHave(s.id, have)})`).join(' + ')}</div>
            </div>
            <span data-act="infusion-make" style={{ marginLeft: 'auto' }}>
              <HearthButton small primary disabled={!can} onClick={() => make(rec)}>{MEAL_UI.make}</HearthButton>
            </span>
          </div>
        )
      })}
    </div>
  )
}
