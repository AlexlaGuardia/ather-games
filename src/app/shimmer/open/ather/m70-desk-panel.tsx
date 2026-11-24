'use client'
// ── ANGELICA'S DESK (BETA M70 s3, m70-alchemist.ts): E at the Desk beside Angelica while A Proper Batch is open. Shows what the
// batch takes (held / needed) and brews it in the keeper's own hands. Labels are placeholders for @lark (M70SIDE_TEXT).
import { HearthFrame, HearthButton, H } from '../../ui/hearth'
import { useInv, getInv, setInv } from '../shared/bag'
import { give, take, itemDef, type Inv } from '../shared/inventory'
import { BATCH_NEEDS, M70SIDE_TEXT, brewBatch, holding } from './m70-alchemist'
import { CROPS, type CropId } from './farming'
import { alcName } from './alchemy-set'

export const sideItemName = (id: string) => (id.startsWith('crop:') ? CROPS[id.slice(5) as CropId]?.name ?? id : itemDef(id).name)
export const haveOf = (inv: Inv): Record<string, number> => {
  const h: Record<string, number> = {}
  for (const s of inv.slots) if (s) h[s.id] = (h[s.id] ?? 0) + s.n
  return h
}

/** `onBrewed` runs after the bottles are in the bag (the page moves the quest and says so). */
export function AngelicaDeskPanel({ onClose, onBrewed, say }: { onClose: () => void; onBrewed: (bottle: string, n: number) => void; say: (s: string) => void }) {
  const inv = useInv(), have = haveOf(inv), plan = brewBatch(have)
  const brew = () => {
    const p = brewBatch(haveOf(getInv())); if (!p) return
    let next: Inv | null = getInv()
    for (const s of p.spend) { next = next && take(next, s.id, s.n) }
    if (!next) return
    const r = give(next, p.make.id, p.make.n)
    if (r.left) { say('Your bag is full.'); return }
    setInv(r.inv)
    say(`${alcName(p.make.id) ?? p.make.id} ×${p.make.n} · in your bag`)
    onBrewed(p.make.id, p.make.n)
  }
  return (
    <HearthFrame title={M70SIDE_TEXT.deskTitle} maxWidth={420} onClose={onClose} fixed dataPanel="angelica-desk">
      <div style={{ padding: '26px 16px 14px', display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 13, color: H.inkSoft }}>{M70SIDE_TEXT.deskNeed}</div>
        {BATCH_NEEDS.map(x => { const got = holding(have, x.id); return (
          <div key={x.id} data-desk-need={x.id} data-desk-ok={got >= x.n ? 1 : 0} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, color: H.ink }}>
            <span>{sideItemName(x.id)}</span><span style={{ color: got >= x.n ? H.ink : H.inkFaint }}>{Math.min(got, x.n)} / {x.n}</span>
          </div>) })}
        <div data-desk-brew>
          <HearthButton primary disabled={!plan} onClick={brew}>{M70SIDE_TEXT.deskBrew}</HearthButton>
        </div>
      </div>
    </HearthFrame>
  )
}
