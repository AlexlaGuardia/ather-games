'use client'
// /shimmer/dev/guns › SOUND (Alex 11-19): the manalic guns' voices. Tune on the sound board (docs/looks/gun-sound.html), Copy
// settings there, paste here and Save: this browser's game uses them at once (shared/gun-sound.ts reads them per shot).
import { useState, type CSSProperties } from 'react'
import { GUN_VOICES, GUN_SOUND_KEY, voices, saveVoices, resetVoices, playShot, playReload, playEmpty } from '../../open/shared/gun-sound'
import { RANGE_GUNS } from '../../open/shared/gunplay'

export function SoundBench({ chip }: { chip: CSSProperties }) {
  const [text, setText] = useState('')
  const [said, setSaid] = useState('')
  const tuned = (() => { try { return !!localStorage.getItem(GUN_SOUND_KEY) } catch { return false } })()
  return (
    <section data-sound-bench style={{ marginTop: 14, borderTop: '1px solid #3a3550', paddingTop: 10 }}>
      <div style={{ fontWeight: 700, fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase' }}>Sound</div>
      <div style={{ fontSize: 10.5, color: '#8b8598', margin: '4px 0 6px' }}>Paste the sound board&apos;s Copy settings here and Save. {tuned ? 'This browser has tuned voices.' : 'Using the default voices.'}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
        {RANGE_GUNS.map(g => <button key={g.id} style={chip} onClick={() => playShot(g.id)}>{g.id}</button>)}
        <button style={chip} onClick={playReload}>reload</button>
        <button style={chip} onClick={playEmpty}>empty</button>
      </div>
      <textarea data-sound-paste value={text} onChange={e => setText(e.target.value)} placeholder='{"repeater":{"breath":{...}}, ...}'
        style={{ width: '100%', minHeight: 70, fontSize: 10, fontFamily: 'ui-monospace, monospace', background: '#1b1826', color: '#e6e1f0', border: '1px solid #3a3550', borderRadius: 6, padding: 6, boxSizing: 'border-box' }} />
      <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
        <button style={chip} onClick={() => setSaid(saveVoices(text) ? 'Saved: fire away' : 'That is not the board’s settings (bad JSON)')}>Save</button>
        <button style={chip} onClick={() => { resetVoices(); setSaid('Back to the default voices') }}>Reset sound</button>
        <button style={chip} onClick={() => setText(JSON.stringify(voices()))}>Show current</button>
        <button style={chip} onClick={() => setText(JSON.stringify(GUN_VOICES))}>Show defaults</button>
      </div>
      {said && <div style={{ fontSize: 10.5, color: '#e8b04a', marginTop: 4 }}>{said}</div>}
    </section>
  )
}
