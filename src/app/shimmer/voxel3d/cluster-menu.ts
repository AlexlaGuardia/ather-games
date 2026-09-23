// The cluster rows of the Gardens menu — WHAT a keeper can do, decided here, drawn in cluster-panel.tsx.
//
// Pure, so canon's guards are asserted on the model rather than hunted for in JSX
// (athernyx game/shimmer-geography.md › GARDEN CLUSTERS, ONE FOLDS THE REST SIGN UP):
//   · folding takes Enchant; joining takes nothing but everyone's yes;
//   · the only exit is your OWN corner — there is no row, anywhere, that acts on another keeper;
//   · no title — the model carries no folder, leader or owner, and the panel cannot show one;
//   · a cluster of one is a fold held open: nothing to walk yet, only friends to ask.
// Wording follows canon: a keeper SIGNS UP to a made frame; a corner is GIVEN and TAKEN BACK.
import type { ClusterView, Quarter } from '@/lib/accounts/clusters'

export const QUARTER_ORDER: readonly Quarter[] = ['ne', 'nw', 'sw', 'se']

export interface Invite { cluster_id: string; quarter: Quarter; keepers: string[]; waiting: number }
export interface Friend { user_id: string; username: string | null; status: string }

export interface ClusterMenu {
  /** none = in no cluster · held = a fold held open (you alone) · cluster = two or more. */
  mode: 'none' | 'held' | 'cluster'
  /** Folding is offered only outside a cluster, and only to a keeper holding Enchant. */
  canFold: boolean
  /** Outside a cluster without Enchant: say why, and that a friend can fold one for you. */
  foldNeedsEnchant: boolean
  keepers: { name: string; you: boolean }[]
  /** Friends who could be asked into an open slot (accepted, in no offer, not already in). */
  askable: { username: string }[]
  /** The slot the next ask fills — the first open one. null = the frame is full. */
  nextOpen: Quarter | null
  pending: { quarter: Quarter; invitee: string; waiting: number; youSaidYes: boolean }[]
  invites: Invite[]
  canWalk: boolean
}

export function clusterMenu(view: ClusterView | null, mine: Quarter | null, invites: Invite[],
                            friends: Friend[], hasEnchant: boolean): ClusterMenu {
  const inCluster = !!view && !!mine
  const me = inCluster ? view!.members.find(m => m.quarter === mine) ?? null : null
  const members = inCluster ? view!.members : []
  const offers = inCluster ? view!.offers : []
  const taken = new Set<string>([...members.map(m => m.quarter), ...offers.map(o => o.quarter)])
  const nextOpen = inCluster ? QUARTER_ORDER.find(q => !taken.has(q)) ?? null : null
  const inside = new Set([...members.map(m => m.user_id), ...offers.map(o => o.invitee_id)])
  const mode: ClusterMenu['mode'] = !inCluster ? 'none' : members.length >= 2 ? 'cluster' : 'held'
  return {
    mode,
    canFold: !inCluster && hasEnchant,
    foldNeedsEnchant: !inCluster && !hasEnchant,
    keepers: members.map(m => ({ name: m.username ?? 'a keeper', you: m.user_id === me?.user_id })),
    askable: nextOpen
      ? friends.filter(f => f.status === 'accepted' && f.username && !inside.has(f.user_id)).map(f => ({ username: f.username! }))
      : [],
    nextOpen,
    pending: offers.map(o => ({
      quarter: o.quarter, invitee: o.invitee ?? 'a keeper',
      waiting: members.filter(m => !o.consented.includes(m.user_id)).length,
      youSaidYes: !!me && o.consented.includes(me.user_id),
    })),
    // An invite only matters to a keeper who could accept it: one cluster per keeper.
    invites: inCluster ? [] : invites,
    canWalk: mode === 'cluster',
  }
}
