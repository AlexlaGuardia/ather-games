// ── A SETTLEMENT MOGLIN'S CONVERSATION (BETA M13, Alex 11-18): one Moglin at a time, one screen per answer ───────────────────
// Before: E in a settlement opened folk-panel.tsx, every Moglin of the season, trades, wants, trust and recruit buttons at once.
// Now E starts a talk with ONE Moglin (shared/npc-talk.tsx): its dream in the bubble (folk-lines.ts DREAMS, lark's), the keeper
// answers. "What do you need?" shows ITS goods and the bring answers; "Would you keep a room for me?" is the recruit ask
// (talkLine yes / trustFirst / trusted, lark's); "Who else lives here?" turns to the next; "Goodbye" leaves.
// All game logic stays in settlement-folk.ts (wantsLeft / trusted / bring / recruit); this file only arranges lines.
// ★ @lark draft 11-18, awaiting Alex sign-off: the answer labels (ASK), the bring verb and the two stock lines below. The dream
// stays the hello (lark: the only place a keeper ever hears a Moglin's dream). Checks import these, never retype them.
import { isGlade, GLADE_STAYS, gladeHello } from './moonwell-glade'
import type { TalkNode } from '../shared/npc-talk'
import { wantsLeft, trusted, type Folk, type Trust } from './settlement-folk'
import { talkLine } from './folk-lines'
import { itemDef } from '../shared/inventory'
import { cardOf, type CardView } from './moglin-card'

export const ASK = { needs: 'What do you need?', room: 'Would you keep a room for me?', others: 'Who else lives here?', back: 'Anything else?', bye: 'See you soon.', inspect: 'Inspect' }   // M46: 'Inspect' is Alex's word (11-20)
export const FOLK_NO_ROOM = 'Your garden is full just now. Ask me again when there is a free room.'
export const FOLK_EMPTY = 'The houses are quiet now. Everyone here has found a garden.'   // no speaker: reads as narration
export const giveLabel = (n: number, id: string) => `Bring ${n} ${itemDef(id).name}`  // the bring answer: the same verb as lark's trustFirst ask
export const goodsText = (ws: { id: string; n: number }[]) => ws.map(w => `${w.n} ${itemDef(w.id).name}`).join(' and ')

/** Where the talk is: whose bubble, which screen, and (after an answer) the line it said. */
export interface FolkTalkState { fid: string; screen: 'hello' | 'needs' | 'said' | 'card'; line?: string; /** M40: this hello is a repeat (a Glade Moglin says its alternate) */ alt?: boolean }
// M40: Glade Moglins heard this visit (a repeat talk gets the alternate line). Per page, not saved: a new visit starts fresh.
const heard = new Set<string>()
/** a hello state for `fid`, marking it heard (the NEXT hello is a repeat) */
export function helloFor(fid: string): FolkTalkState { const alt = heard.has(fid); heard.add(fid); return { fid, screen: 'hello', alt } }
export const _resetHeard = () => heard.clear()
export interface FolkTalkCtx { folk: Folk[]; home: Folk[]; trust: Trust; have: (id: string) => number; room: number; /** the card's home line (M46) */ homeName?: string }
/** M46: a talk node may carry the Moglin's card (the HUD draws it above the answers) */
export type FolkTalkNode = TalkNode & { card?: CardView }
export interface FolkTalkActs {
  go: (s: FolkTalkState) => void
  give: (f: Folk, id: string, n: number) => void
  recruit: (f: Folk) => void        // saves the village; the talk then shows `line` via go()
  bye: () => void
}

export const folkStart = (home: Folk[]): FolkTalkState => (home[0] ? helloFor(home[0].id) : { fid: '', screen: 'hello' })

/** The node for `st`. A Moglin that has just been recruited is no longer in `home`, so it is looked up in the full season list. */
export function folkTalk(c: FolkTalkCtx, st: FolkTalkState, act: FolkTalkActs): FolkTalkNode {
  const bye = { label: ASK.bye, pick: act.bye }
  const f = c.folk.find(x => x.id === st.fid)
  if (!f) return { line: FOLK_EMPTY, options: [bye] }
  const others = c.home.filter(x => x.id !== f.id)
  const at = c.home.findIndex(x => x.id === f.id), after = others.length ? (at < 0 ? others[0] : others.find((_, k) => k >= at) ?? others[0]) : null
  const next = after ? { label: ASK.others, pick: () => act.go(helloFor(after.id)) } : null
  const homeNow = c.home.some(x => x.id === f.id)
  if (!homeNow) return { line: st.line ?? FOLK_EMPTY, options: [...(next ? [next] : []), bye] }   // just came home with the keeper
  const ok = trusted(f, c.trust)
  const askRoom = {
    label: ASK.room,
    pick: () => {
      if (isGlade(f.home)) { act.go({ fid: f.id, screen: 'said', line: GLADE_STAYS }); return }   // M30: Moonwell's five stay home
      if (!ok) { act.go({ fid: f.id, screen: 'needs' }); return }
      if (c.room <= 0) { act.go({ fid: f.id, screen: 'said', line: FOLK_NO_ROOM }); return }
      act.recruit(f); act.go({ fid: f.id, screen: 'said', line: talkLine(f.employed ? 'trusted' : 'yes', f.id) })
    },
  }
  if (st.screen === 'needs') {
    const left = wantsLeft(f, c.trust)
    if (ok) return { line: talkLine('trusted', f.id), options: [askRoom, { label: ASK.back, pick: () => act.go({ fid: f.id, screen: 'hello' }) }] }
    return {
      line: talkLine('trustFirst', f.id, goodsText(left)),
      options: [
        ...left.filter(w => c.have(w.id) > 0).map(w => ({ label: giveLabel(Math.min(w.n, c.have(w.id)), w.id), pick: () => act.give(f, w.id, Math.min(w.n, c.have(w.id))) })),
        { label: ASK.back, pick: () => act.go({ fid: f.id, screen: 'hello' }) },
      ],
    }
  }
  if (st.screen === 'said') return { line: st.line ?? f.dream, options: [{ label: ASK.back, pick: () => act.go({ fid: f.id, screen: 'hello' }) }, ...(next ? [next] : []), bye] }
  const hello = gladeHello(f.id, !!st.alt) ?? f.dream
  const inspect = { label: ASK.inspect, pick: () => act.go({ fid: f.id, screen: 'card', alt: st.alt }) }
  if (st.screen === 'card') return { line: hello, card: cardOf(f, c.trust, c.homeName ?? f.home), options: [{ label: ASK.back, pick: () => act.go({ fid: f.id, screen: 'hello', alt: st.alt }) }, bye] }
  return { line: hello, options: [...(f.employed && !ok ? [{ label: ASK.needs, pick: () => act.go({ fid: f.id, screen: 'needs' }) }] : []), askRoom, inspect, ...(next ? [next] : []), bye] }
}
