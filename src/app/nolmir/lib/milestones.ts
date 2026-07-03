// NOLMIR — pure milestone decisions, lifted out of the component effect so the
// beat logic is testable. Given the previous and current "worked worlds" masks,
// decide whether a NEW world came online this step and which celebration it earns.
// (Deepening an already-worked world doesn't change the mask → no beat.)

export interface Milestone {
  text: string
  sub: string
  full: boolean // the whole system is now claimed → the big fanfare
}

export function planetMilestone(
  prev: boolean[] | null,
  mask: boolean[],
  nameAt: (i: number) => string,
): Milestone | null {
  if (!prev) return null // first paint arms the ref — no retroactive fanfare
  const newIdx = mask.findIndex((v, i) => v && !prev[i])
  if (newIdx < 0) return null // no newly-worked world (a deepen, or a decrease)
  const name = nameAt(newIdx) || 'a new world'
  const count = mask.reduce((n, v) => n + (v ? 1 : 0), 0)
  const full = count === mask.length
  if (full) return { text: 'System Claimed', sub: `${name} was the last — all ${count} worlds feed the forge`, full: true }
  if (count === 1) return { text: 'First World Claimed', sub: `${name} joins the network`, full: false }
  return { text: 'World Claimed', sub: `${name} joins the network · ${count} worked`, full: false }
}
