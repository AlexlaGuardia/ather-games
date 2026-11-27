// ★ BETA M246 (assets, 2026-11-27): SMASH REDO, THE BELL SHOW's timeline, camera and words. PURE (no React, no three).
// The scene (smash-bell-view.tsx) plays one CONTESTANT after another in the CLASH RING (same arena, same camera system as
// clash-ceremony.ts camPose): INTRO card with a shout-out to her keeper -> she WALKS from the near wall to the centre, her BACK
// TO THE CAMERA, facing the BIG BELL at the far end -> STRIKE (her strongest move, smash-score.ts) -> GAUGE (the needle climbs,
// the score counts up) -> SCORE (the big number). Over 9000 (smash-score.ts cracks) a CRACK beat follows: the bell cracks and the
// Moglin judge yells. Solo = one contestant (her own swing). Lobby (fair-lobby.ts s4) = the run's seats in seat order, the same
// order, scores and winner for every keeper in the chord.
import type { ClashCam } from './clash-ceremony'
import type { Species, Element } from '../../spirits/spirit'
import { cracks } from './smash-score'
import { smashWinner, type LobbyStart } from './fair-lobby'

/** the beats (ms at 1x). A `?clashx=N` / bench speed dial shortens them, never under BELL_FLOOR_MS (a check still sees each). */
export const BELL_BEATS = { intro: 2400, walk: 2000, strike: 1000, gauge: 1700, score: 1900, crack: 2600 } as const
export type BellBeat = keyof typeof BELL_BEATS
export const BELL_FLOOR_MS = 400
export const bellMs = (b: BellBeat, speed = 1) => Math.max(BELL_FLOOR_MS, Math.round(BELL_BEATS[b] / Math.max(0.1, speed)))   // under 1 = slower (the shot pass)
/** a contestant's beats in order (the crack only over 9000) */
export const beatsFor = (score: number | null): BellBeat[] => (score !== null && cracks(score) ? ['intro', 'walk', 'strike', 'gauge', 'crack', 'score'] : ['intro', 'walk', 'strike', 'gauge', 'score'])
/** where a contestant's show stands `ms` after it started: the beat, its progress 0..1, and whether her show is over */
export function beatAt(ms: number, score: number | null, speed = 1): { beat: BellBeat; k: number; done: boolean } {
  const bs = beatsFor(score)
  let t = Math.max(0, ms)
  for (const b of bs) { const d = bellMs(b, speed); if (t < d) return { beat: b, k: t / d, done: false }; t -= d }
  return { beat: bs[bs.length - 1], k: 1, done: true }
}
/** a contestant's whole show (ms) */
export const showMs = (score: number | null, speed = 1) => beatsFor(score).reduce((n, b) => n + bellMs(b, speed), 0)

/** the bell show's camera (the ring's ClashCam table, its own values): low behind her, so she stands with her back to us and
 *  the bell fills the far end. 🟨 first pass for Alex (the Fair bench's Smash tab shows it). */
export const SMASH_CAM: ClashCam = { height: 4.2, distance: 9.5, angle: 0, fov: 46, fit: 4.6, follow: 0 }
/** the camera's target (m): a little past the centre toward the bell, a little up */
export const SMASH_LOOK = { y: 1.6, z: -2.2 } as const
/** where things stand (m, z toward the camera is +): her walk from the near wall to the centre; the bell at the far end */
export const SMASH_SPOT = { from: 4.2, at: 0.4, bell: -5.6 } as const
/** facing the bell = facing -z: the model's yaw (models face +z at yaw 0) */
export const FACE_BELL = Math.PI

export interface BellContestant { key: string; keeper: string; you: boolean; name: string; species: Species; element: Element; score: number | null; move: string }

/** the LOBBY's show: the run's seats in seat order with the hits heard (a seat not heard yet has score null) */
export function lobbyShow(run: Pick<LobbyStart, 'seats' | 'spirits' | 'names'>, hits: readonly { id: string; hit: number; spirit: string; who: string }[], me: string | null): BellContestant[] {
  return run.seats.flatMap((id, i) => {
    const sp = run.spirits[i]
    if (id === null || !sp) return []
    const h = hits.find(x => x.id === id)
    return [{ key: `${id}:${i}`, keeper: run.names[i] ?? h?.who ?? '', you: id === me, name: sp.name, species: sp.species, element: sp.element, score: h ? h.hit : null, move: '' }]
  })
}
/** the show's winner: the lobby's own rule (fair-lobby.ts smashWinner: highest, a tie to the seat listed first) */
export function showWinner(c: readonly BellContestant[]): number | null {
  const id = smashWinner(c.flatMap(x => (x.score === null ? [] : [{ id: x.key, hit: x.score }])), c.map(x => x.key))
  return id === null ? null : c.findIndex(x => x.key === id)
}

/** plain UI words (@lark: the shout-out and the judge's line are PLACEHOLDERS; the judge must never say the famous meme line) */
export const BELL_UI = {
  upNext: 'Up next',
  shout: (keeper: string, you: boolean) => (you ? 'For you, keeper!' : `For ${keeper}!`),   // placeholder shout-out -> @lark
  form: (el: string) => (el === 'base' ? 'Base form' : `${el[0].toUpperCase()}${el.slice(1)} form`),
  score: 'Score',
  cracked: 'The bell cracked!',
  judge: 'Moglin judge',
  judgeLine: 'Stop the Fair! She cracked my bell!',   // PLACEHOLDER -> @lark writes the original line
  noSwing: 'No swing',
  winner: (name: string, keeper: string, n: number) => `${name} wins for ${keeper} · ${n}`,
  back: 'Back to the Fair',
  skip: 'Skip',
} as const
