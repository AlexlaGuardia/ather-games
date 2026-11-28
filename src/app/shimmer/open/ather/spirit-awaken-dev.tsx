'use client'
// BETA M244 RULE s1: the OWNER DEV trigger for the awakening engine (spirit-awaken.ts), inside a garden spirit's panel. Pick a
// branch: every key shows met / unmet with its numbers; Force awakens her into that branch's model regardless (for testing).
// A player never sees this block (useOwner). Labels = AWAKEN_DEV_UI (owner-only, plain).
import { useEffect, useMemo, useState } from 'react'
import { H } from '../../ui/hearth'
import { AWAKENED_BRANCHES, ELEMENT_COLORS, type AwakenedBranch, type Species } from '../../spirits/spirit'
import { awaken, awakenCheck, awakenedName, AWAKEN_DEV_UI } from './spirit-awaken'
import { useBook, getPots, setPots } from './spirit-panels'
import { recStatOf } from './second-form-view'
import { loadStats } from './spirit-stats'
import { hudSay } from '../shared/hud-say'

// the /api/owner gate (the same call spirit-panels.tsx + Options' Dev tab make), asked once per page
let ownerP: Promise<boolean> | null = null
function useOwner() {
  const [o, setO] = useState(false)
  useEffect(() => { let alive = true; (ownerP ??= fetch('/api/owner', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(j => !!j?.owner).catch(() => false)).then(v => { if (alive) setO(v) }); return () => { alive = false } }, [])
  return o
}

export function AwakenDev({ sp, id, statsV }: { sp: Species; id: string; statsV: number }) {
  const owner = useOwner(), pot = useBook().pots[id]
  const [branch, setBranch] = useState<AwakenedBranch>('champion')
  const ck = useMemo(() => awakenCheck(pot, sp, branch, recStatOf(sp, loadStats()[id])), [pot, sp, branch, id, statsV])   // eslint-disable-line react-hooks/exhaustive-deps
  if (!owner || !pot?.bloomed) return null
  const name = awakenedName(sp, pot, branch)
  const force = () => {
    const cur = getPots()[id], next = awaken(cur, sp, branch, recStatOf(sp, loadStats()[id]), true)
    if (!next) return
    setPots({ ...getPots(), [id]: next }); hudSay(AWAKEN_DEV_UI.done(name ?? branch), 'item', 4)
  }
  const done = pot.awakened ? awakenedName(sp, pot, pot.awakened) : null
  return (
    <div data-awaken-dev={branch} data-awaken-met={ck.met ? '1' : '0'} data-awaken-name={name ?? ''} data-awakened={pot.awakened ?? ''}
      className="mt-3 rounded-[8px] px-2.5 py-2" style={{ boxShadow: `inset 0 0 0 1px ${H.ember}`, background: 'rgba(255,250,240,.5)' }}>
      <div className="mb-1.5 text-[13px] font-bold" style={{ color: H.ember }}>{AWAKEN_DEV_UI.header}{done ? ` · ${AWAKEN_DEV_UI.done(done)}` : ''}</div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {AWAKENED_BRANCHES.map(b => (
          <button key={b} data-awaken-branch={b} onClick={() => setBranch(b)} className="rounded-[6px] px-2 py-1 text-[12px] font-bold"
            style={{ minHeight: 30, background: b === branch ? ELEMENT_COLORS[awakenCheck(pot, sp, b, () => 0).element] : 'rgba(58,39,22,.08)', color: b === branch ? '#fff' : H.ink }}>{b}</button>
        ))}
      </div>
      <div className="mt-1.5" style={{ display: 'grid', gap: 2 }}>
        {ck.keys.map(k => (
          <div key={k.key} data-awaken-key={k.key} data-awaken-key-met={k.met ? '1' : '0'} className="flex items-center gap-2 text-[12px]" style={{ color: H.ink }}>
            <span style={{ width: 14, fontWeight: 800, color: k.met ? '#3d8b3d' : '#b0412e' }}>{k.met ? '✓' : '✗'}</span>
            <span style={{ width: 76, fontWeight: 700 }}>{AWAKEN_DEV_UI.key[k.key]}</span>
            <span className="tabular-nums" style={{ color: H.inkFaint }}>{k.detail ?? `${k.have} / ${k.need}`}{k.key !== 'steep' && k.key !== 'form' && k.detail ? ` ${k.have} / ${k.need}` : ''}</span>
          </div>
        ))}
      </div>
      <button data-awaken-force={branch} disabled={!name || !!pot.awakened || !pot.element} onClick={force} className="mt-2 rounded-[6px] px-2.5 py-1 text-[12px] font-bold"
        style={{ minHeight: 32, background: name && !pot.awakened && pot.element ? H.ember : 'rgba(58,39,22,.08)', color: name && !pot.awakened && pot.element ? '#fff' : H.inkFaint }}>
        {name ? AWAKEN_DEV_UI.force(name) : AWAKEN_DEV_UI.unnamed}</button>
      {pot.awakened && <button data-awaken-reset onClick={() => { const cur = getPots()[id]; if (!cur) return; const { awakened: _a, ...rest } = cur; void _a; setPots({ ...getPots(), [id]: rest }) }}
        className="mt-2 ml-2 rounded-[6px] px-2.5 py-1 text-[12px] font-bold" style={{ minHeight: 32, background: 'rgba(58,39,22,.08)', color: H.ink }}>{AWAKEN_DEV_UI.reset}</button>}
    </div>
  )
}
