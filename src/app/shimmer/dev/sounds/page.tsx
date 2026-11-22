'use client'

/**
 * GAME SOUNDS (BETA M36) — audition every game sound and vote. Phone-first. The game plays ONLY a `yay` sound; a vote is saved to
 * open/shared/sounds.json through /shimmer/save-sound-vote (owner-gated by the save-* prefix) and is LIVE AT THE NEXT DEPLOY.
 * BETA M92 (Alex 11-22, declutter): PENDING on top (the working list), NAY rows carry REMOVE (drops the row) / TRY AGAIN (back to
 * pending), APPROVED folds into a collapsed list at the bottom (still playable, can be un-approved). Sorting = ./sections.ts.
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { audition, SOUNDS, type SoundRow, type SoundStatus } from '../../open/shared/sfx'
import { sections } from './sections'

const ROUTE = '/shimmer/save-sound-vote'
const COLOR: Record<SoundStatus, string> = { proposed: '#8b8598', yay: '#5fbf7a', nay: '#d46a6a' }
const btn: CSSProperties = { minHeight: 44, padding: '0 14px', borderRadius: 8, border: '1px solid #3a3550', background: '#1b1826', color: '#e6e1f0', fontSize: 14, fontWeight: 700 }
const h2: CSSProperties = { fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase', color: '#8b8598', margin: '18px 0 8px' }

export default function SoundsPage() {
  const [rows, setRows] = useState<SoundRow[]>(SOUNDS)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [said, setSaid] = useState('')
  useEffect(() => {
    fetch(ROUTE).then(r => r.json()).then((d: { sounds?: SoundRow[] }) => {
      if (d.sounds) { setRows(d.sounds); setNotes(Object.fromEntries(d.sounds.map(s => [s.id, s.note ?? '']))) }
    }).catch(() => { /* the bundled copy stands */ })
  }, [])

  async function send(method: 'POST' | 'DELETE', body: object): Promise<{ ok?: boolean; error?: string; live?: string } | null> {
    try {
      const res = await fetch(ROUTE, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await res.json() as { ok?: boolean; error?: string; live?: string }
      if (!res.ok || !d.ok) { setSaid(`Not saved: ${d.error ?? res.status}`); return null }
      return d
    } catch { setSaid('Not saved: the route did not answer'); return null }
  }
  async function vote(id: string, status: SoundStatus) {
    const d = await send('POST', { id, status, note: notes[id] ?? '' })
    if (!d) return
    setRows(rs => rs.map(r => (r.id === id ? { ...r, status, note: notes[id] ?? r.note } : r)))
    setSaid(`${id} = ${status}. Live ${d.live ?? 'at the next deploy'}.`)
  }
  async function remove(id: string) {
    const d = await send('DELETE', { id })
    if (!d) return
    setRows(rs => rs.filter(r => r.id !== id))
    setSaid(`${id} removed: the game stays silent there. Live ${d.live ?? 'at the next deploy'}.`)
  }

  const { pending, nay, approved } = sections(rows)
  const card = (r: SoundRow, actions: ReactNode, withNote = true) => (
    <div key={r.id} data-sound={r.id} style={{ border: '1px solid #3a3550', borderRadius: 10, padding: 10, marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <b>{r.id}</b><span style={{ fontSize: 11, color: '#8b8598', marginLeft: 'auto' }}>{r.area}</span><span data-status style={{ color: COLOR[r.status], fontWeight: 700 }}>{r.status}</span>
      </div>
      {r.desc && <div style={{ fontSize: 12, color: '#8b8598', margin: '2px 0 8px' }}>{r.desc}</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button data-play style={btn} onClick={() => audition(r.id)}>Play</button>
        {actions}
      </div>
      {withNote && <input data-note value={notes[r.id] ?? r.note ?? ''} onChange={e => setNotes(n => ({ ...n, [r.id]: e.target.value }))} placeholder="note (what to change)"
        style={{ width: '100%', boxSizing: 'border-box', marginTop: 8, minHeight: 40, background: '#1b1826', color: '#e6e1f0', border: '1px solid #3a3550', borderRadius: 8, padding: '0 10px', fontSize: 16 }} />}
    </div>
  )

  return (
    <main style={{ background: '#13111c', color: '#e6e1f0', minHeight: '100vh', padding: '16px', font: '14px system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 18, margin: '0 0 4px' }}>Game sounds</h1>
      <p style={{ fontSize: 12, color: '#8b8598', margin: '0 0 12px' }}>Play to hear it. Only a YAY sound plays in the game; a vote is live at the next deploy.</p>
      <div data-said style={{ position: 'sticky', top: 0, background: '#13111c', padding: '6px 0', fontSize: 12, minHeight: 18, zIndex: 1 }}>{said}</div>

      <section data-section="pending">
        <h2 style={h2}>Pending · <span data-count>{pending.length}</span></h2>
        {pending.length === 0 && <div style={{ fontSize: 12, color: '#8b8598' }}>Nothing waiting for a vote.</div>}
        {pending.map(r => card(r, <>
          <button data-yay style={{ ...btn, borderColor: COLOR.yay }} onClick={() => vote(r.id, 'yay')}>YAY</button>
          <button data-nay style={{ ...btn, borderColor: COLOR.nay }} onClick={() => vote(r.id, 'nay')}>NAY</button>
        </>))}
      </section>

      <section data-section="nay">
        <h2 style={h2}>Nay · <span data-count>{nay.length}</span></h2>
        {nay.length === 0 && <div style={{ fontSize: 12, color: '#8b8598' }}>No nays.</div>}
        {nay.map(r => card(r, <>
          <button data-retry style={btn} onClick={() => vote(r.id, 'proposed')}>Try again</button>
          <button data-remove style={{ ...btn, borderColor: COLOR.nay, color: COLOR.nay }} onClick={() => remove(r.id)}>Remove</button>
        </>))}
      </section>

      <details data-section="approved" style={{ marginTop: 18 }}>
        <summary style={{ ...h2, cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center' }}>Approved · <span data-count style={{ marginLeft: 4 }}>{approved.length}</span></summary>
        {approved.map(r => card(r, <button data-unapprove style={btn} onClick={() => vote(r.id, 'proposed')}>Un-approve</button>, false))}
      </details>
    </main>
  )
}
