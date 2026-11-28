// BETA M247 s2: THE DASH TRACK IN THE TENT, pure (no React, no three): which course a race runs and where on the tent floor a
// racer stands. The course is the one Alex PUBLISHED in Creative (builder map 'dash', layer `course`, served by GET
// /shimmer/open/dash-edits): its line (dash-course courseLine) and its sections (courseSections), raced by fair-dash-race on a
// Track made from them. With none published (or one too short to race), the FIXED course (fair-dash-race COURSE, the M233
// sections) runs on FALLBACK_LINE, a stadium loop laid on the same floor, so the race always runs.
//  - HEIGHT along the course (the dirt track stands on the sand floor, FLOOR below it): flat run; a sunk water trough on a swim;
//    a climb ramps up (and back down when no gap follows it: a hill); a gap drops from where the track is down into the gap and
//    up the far side; fliers glide over it instead (flyY).
//  - LANES: racer i runs offset across the course's width (laneOffset), never off it.
import { CLIMB_H, GAP_DROP, FIXED_TRACK, trackOf, sectionAt, type Track, type Section } from './fair-dash-race'
import { courseLine, cumul, courseSections, raceSpan, pointAt, type DashCourse, type Pt } from './dash-course'

/** the sand floor's height under the raised dirt track (m) */
export const FLOOR = -2.6
/** a carved course shorter than this races the fixed one instead (a stray spray dot is not a course) */
export const MIN_RACE = 20
/** the fallback stadium: straights of FB_STRAIGHT m joined by half circles of FB_R m, centred on the floor */
export const FB_STRAIGHT = 36, FB_R = 14, FB_WIDTH = 6

export interface RaceTrack { track: Track; line: Pt[]; cum: number[]; s0: number; width: number; published: boolean }

/** the fallback line: a stadium loop (counter-clockwise from the bottom straight's left end), every 1 m */
export function fallbackLine(): Pt[] {
  const out: Pt[] = [], h = FB_STRAIGHT / 2
  for (let x = -h; x < h; x += 1) out.push([x, FB_R])
  for (let a = 0; a < Math.PI; a += 1 / FB_R) out.push([h + Math.sin(a) * FB_R, Math.cos(a) * FB_R])
  for (let x = h; x > -h; x -= 1) out.push([x, -FB_R])
  for (let a = 0; a <= Math.PI + 1e-9; a += 1 / FB_R) out.push([-h - Math.sin(a) * FB_R, -Math.cos(a) * FB_R])
  return out
}

/** the race's track: the published course when it races (sections + at least MIN_RACE m), else the fixed one on the stadium */
export function raceTrack(c: DashCourse | null | undefined): RaceTrack {
  if (c) {
    const line = courseLine(c.strokes), cum = cumul(line), secs = courseSections(c, line, cum)
    const track = trackOf(secs as Section[])
    if (secs.length && track.len >= MIN_RACE) return { track, line, cum, s0: raceSpan(c, line, cum).s0, width: c.width, published: true }
  }
  const line = fallbackLine()
  return { track: FIXED_TRACK, line, cum: cumul(line), s0: 0, width: FB_WIDTH, published: false }
}

/** where the gap starts from: the top of a climb right before it, else the track's own level */
const gapFrom = (tr: Track, s: Section) => { const i = tr.sections.indexOf(s); return i > 0 && tr.sections[i - 1].kind === 'climb' ? CLIMB_H : 0 }
/** the track's height d metres into the race (the non-fliers' path). On the fixed course this is M233's groundY exactly. */
export function trackY(tr: Track, d: number): number {
  const s = sectionAt(d, tr), f = Math.min(1, Math.max(0, (d - s.at) / s.len)), i = tr.sections.indexOf(s)
  if (s.kind === 'swim') return -0.45
  if (s.kind === 'climb') {
    if (tr.sections[i + 1]?.kind === 'glide') return f * CLIMB_H
    return f < 0.7 ? (f / 0.7) * CLIMB_H : CLIMB_H * (1 - (f - 0.7) / 0.3)   // a hill: up, then down to the next stretch
  }
  if (s.kind === 'glide') { const h0 = gapFrom(tr, s); return f < 0.45 ? h0 + (-GAP_DROP - h0) * (f / 0.45) : -GAP_DROP * (1 - (f - 0.45) / 0.55) }
  return 0
}
/** a flier's height over a gap: from where it starts, gliding to the far side (a lift over a flat-start gap) */
export function flyY(tr: Track, d: number): number {
  const s = sectionAt(d, tr), f = Math.min(1, Math.max(0, (d - s.at) / s.len)), h0 = gapFrom(tr, s)
  return h0 * (1 - f) + (h0 > 0 ? 0.35 : 1.2) * Math.sin(f * Math.PI)
}

/** racer i of n: her offset across the course (m, + = to her right), inside the width with a margin */
export const laneOffset = (i: number, n: number, width: number) => (i - (n - 1) / 2) * (Math.max(1, width - 0.8) / Math.max(1, n))

/** where a racer d metres into the race, offset o across, stands on the floor: x, z and heading (atan2(dx, dz)) */
export function racerAt(rt: RaceTrack, d: number, o: number): { x: number; z: number; heading: number } {
  const p = pointAt(rt.line, rt.cum, rt.s0 + d)
  return { x: p.x + Math.cos(p.heading) * o, z: p.z - Math.sin(p.heading) * o, heading: p.heading }
}
