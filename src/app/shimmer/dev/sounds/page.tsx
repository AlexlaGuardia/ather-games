'use client'

/**
 * GAME SOUNDS (BETA M36) — audition every game sound and vote. Phone-first. The game plays ONLY a `yay` sound; a vote is saved to
 * open/shared/sounds.json through /shimmer/save-sound-vote (owner-gated by the save-* prefix) and is LIVE AT THE NEXT DEPLOY.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { audition, SOUNDS, type SoundRow, type SoundStatus } from '../../open/shared/sfx'

const ROUTE = '/shimmer/save-sound-vote'
const COLOR: Record<SoundStatus, string> = { proposed: '#8b8598', yay: '#5fbf7a', nay: '#d46a6a' }
const btn: CSSProperties = { minHeight: 44, padding: '0 14px', borderRadius: 8, border: '1px solid #3a3550', background: '#1b1826', color: '#e6e1f0', fontSize: 14, fontWeight: 700 }

export default function SoundsPage() {
  const [rows, setRows] = useState<SoundRow[]>(SOUNDS)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [said, setSaid] = useState('')
  useEffect(() => {
    fetch(ROUTE).then(r => r.json()).then((d: { sounds?: SoundRow[] }) => {
      if (d.sounds) { setRows(d.sounds); setNotes(Object.fromEntries(d.sounds.map(s => [s.id, s.note ?? '']))) }
    }).catch(() => { /* the bundled copy stands */ })
  }, [])

  async function vote(id: string, status: SoundStatus) {
    try {
      const res = await fetch(ROUTE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status, note: notes[id] ?? '' }) })
      const d = await res.json() as { ok?: boolean; error?: string; live?: string }
      if (!res.ok || !d.ok) { setSaid(`Not saved: ${d.error ?? res.status}`); return }
      setRows(rs => rs.map(r => (r.id === id ? { ...r, status, note: notes[id] ?? r.note } : r)))
      setSaid(`${id} = ${status}. Live ${d.live ?? 'at the next deploy'}.`)
    } catch { setSaid('Not saved: the route did not answer') }
  }

  const areas = [...new Set(rows.map(r => r.area))]
  return (
    <main style={{ background: '#13111c', color: '#e6e1f0', minHeight: '100vh', padding: '16px', font: '14px system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 18, margin: '0 0 4px' }}>Game sounds</h1>
      <p style={{ fontSize: 12, color: '#8b8598', margin: '0 0 12px' }}>Play to hear it. Only a YAY sound plays in the game; a vote is live at the next deploy.</p>
      <div data-said style={{ position: 'sticky', top: 0, background: '#13111c', padding: '6px 0', fontSize: 12, minHeight: 18 }}>{said}</div>
      {areas.map(area => (
        <section key={area} style={{ marginBottom: 18 }}>
          <h2 style={{ fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase', color: '#8b8598' }}>{area}</h2>
          {rows.filter(r => r.area === area).map(r => (
            <div key={r.id} data-sound={r.id} style={{ border: '1px solid #3a3550', borderRadius: 10, padding: 10, marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <b>{r.id}</b><span data-status style={{ color: COLOR[r.status], fontWeight: 700 }}>{r.status}</span>
              </div>
              {r.desc && <div style={{ fontSize: 12, color: '#8b8598', margin: '2px 0 8px' }}>{r.desc}</div>}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button data-play style={btn} onClick={() => audition(r.id)}>Play</button>
                <button data-yay style={{ ...btn, borderColor: COLOR.yay }} onClick={() => vote(r.id, 'yay')}>YAY</button>
                <button data-nay style={{ ...btn, borderColor: COLOR.nay }} onClick={() => vote(r.id, 'nay')}>NAY</button>
              </div>
              <input data-note value={notes[r.id] ?? r.note ?? ''} onChange={e => setNotes(n => ({ ...n, [r.id]: e.target.value }))} placeholder="note (what to change)"
                style={{ width: '100%', boxSizing: 'border-box', marginTop: 8, minHeight: 40, background: '#1b1826', color: '#e6e1f0', border: '1px solid #3a3550', borderRadius: 8, padding: '0 10px', fontSize: 16 }} />
            </div>
          ))}
        </section>
      ))}
    </main>
  )
}
