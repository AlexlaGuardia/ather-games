// GUARD PROFILES — the shared creature roster. A profile is one collectable
// identity (name, art, role, stat bias). The host collects profiles and equips
// three into the sigil slots: those become his Expedition trinity. The SAME
// profiles double as Crucible challengers (shared sprite art + role) — wired in
// a later slice. Stats layer ON TOP of a sigil slot's vigor/edge progression
// (see profileStats), so collecting changes identity/role, not raw power creep.

export type ProfileRole = 'sniper' | 'splash' | 'frost' | 'bulwark' | 'pulse'

// CATEGORY = the cross-mode classification (Alex, 2026-06-11). A creature's
// category is its identity at the top level: it sets how the SAME profile
// fights as a Crucible challenger (the formation archetype it fills), while
// `role` stays its Expeditions attack behavior. The category × tier grid is a
// coverage matrix — empty cells are deliberate "design a new guard here" gaps
// (see GUARDS_DESIGN.md). `subcategory` is an optional finer flavor; not all
// profiles carry one.
export type GuardCategory = 'vanguard' | 'bulwark' | 'sustain'

// the Crucible formation role each category fills (lead anchors, tank walls,
// healer is the reason fights last — see lib/teams.ts Role)
export type Formation = 'lead' | 'tank' | 'healer'
export const CATEGORY_FORMATION: Record<GuardCategory, Formation> = {
  vanguard: 'lead',
  bulwark: 'tank',
  sustain: 'healer',
}
export const CATEGORY_LABEL: Record<GuardCategory, string> = {
  vanguard: 'Vanguard — leads the line, the team breaks if it falls',
  bulwark: 'Bulwark — the wall a seam breaks on',
  sustain: 'Sustain — the reason a hold lasts',
}

export interface GuardProfile {
  id: string
  name: string
  sprite: string // shared art path, used by both modes once drawn
  glyph: string // placeholder mark until the sprite lands
  category: GuardCategory // cross-mode classification → Crucible formation
  subcategory?: string // optional finer flavor (marksman, concussor…); not all carry one
  role: ProfileRole // Expeditions attack behavior
  hpMult: number // role bias on the slot's hp (bulwark high, glass low)
  atkMult: number // role bias on the slot's atk
  range: number // engagement radius in tiles (sniper long, bulwark short)
  tier: 1 | 2 | 3 // collection depth / challenger tier
  line: string // flavor — roster card + ledger
}

// the Crucible formation this profile fields as a challenger
export function profileFormation(p: GuardProfile): Formation {
  return CATEGORY_FORMATION[p.category]
}

// the role each profile plays on the line. effects (splash/slow/knockback) land
// in the next slice; for now role drives range + stat bias + future hooks.
export const ROLE_LABEL: Record<ProfileRole, string> = {
  sniper: 'picks the leaker nearest the core',
  splash: 'strikes the cluster — answers the pools',
  frost: 'drags the tide down in its radius',
  bulwark: 'soaks a seam, low bite',
  pulse: 'shoves the tide back out',
}

// starter roster — designed for combinations over raw strength: each profile
// answers a different pressure (pools, seams, leakers), none is the strict best.
export const PROFILES: GuardProfile[] = [
  { id: 'lancer', name: 'Lancer', sprite: '/nolmir/sprites/profiles/lancer.png', glyph: '↟', category: 'vanguard', subcategory: 'marksman', role: 'sniper', hpMult: 1.0, atkMult: 1.0, range: 13, tier: 1, line: 'the long line — it ends what slips through' },
  { id: 'maw', name: 'Maw', sprite: '/nolmir/sprites/profiles/maw.png', glyph: '❉', category: 'vanguard', subcategory: 'reaver', role: 'splash', hpMult: 1.05, atkMult: 0.92, range: 9, tier: 1, line: 'it eats the knot, not the thread' },
  { id: 'bastion', name: 'Bastion', sprite: '/nolmir/sprites/profiles/bastion.png', glyph: '▣', category: 'bulwark', role: 'bulwark', hpMult: 1.6, atkMult: 0.72, range: 9, tier: 1, line: 'the wall the seam breaks on' },
  { id: 'rime', name: 'Rime', sprite: '/nolmir/sprites/profiles/rime.png', glyph: '❄', category: 'sustain', subcategory: 'warden', role: 'frost', hpMult: 0.95, atkMult: 0.78, range: 11, tier: 2, line: 'the cold buys the line its breath' },
  { id: 'throe', name: 'Throe', sprite: '/nolmir/sprites/profiles/throe.png', glyph: '◉', category: 'bulwark', subcategory: 'concussor', role: 'pulse', hpMult: 1.15, atkMult: 0.85, range: 10, tier: 2, line: 'it pushes the deep back into the deep' },
  { id: 'sear', name: 'Sear', sprite: '/nolmir/sprites/profiles/sear.png', glyph: '✸', category: 'vanguard', subcategory: 'igniter', role: 'sniper', hpMult: 0.65, atkMult: 1.6, range: 12, tier: 3, line: 'all edge, no patience' },
  // sustain — the menders close the healer gap. role is the MEND SHAPE here:
  // sniper = pick one wound (single-target), splash = blossom over the line (AoE).
  { id: 'suture', name: 'Suture', sprite: '/nolmir/sprites/profiles/suture.png', glyph: '✚', category: 'sustain', subcategory: 'mender', role: 'sniper', hpMult: 0.9, atkMult: 0.9, range: 12, tier: 1, line: 'it picks the wound and closes it' },
  { id: 'bloom', name: 'Bloom', sprite: '/nolmir/sprites/profiles/bloom.png', glyph: '❀', category: 'sustain', subcategory: 'mender', role: 'splash', hpMult: 1.0, atkMult: 0.8, range: 9, tier: 3, line: 'the mend blossoms over the whole line' },
]

export function profileById(id: string): GuardProfile {
  return PROFILES.find((p) => p.id === id) ?? PROFILES[0]
}

// ---- skill lineups (premade per profile, unlocked by the sigil's talent) ----
// effects are data the sim reads; talent level N unlocks the first N skills.

export interface SkillEffect {
  range?: number // +tiles to engagement
  atkMult?: number // x atk
  hpMult?: number // x hp
  splashR?: number // +splash radius (splash role)
  slowDur?: number // +frost ticks (frost role)
  kb?: number // +knockback tiles (pulse role)
  stun?: number // +stun ticks (pulse role)
  pierce?: boolean // sniper: also hits the 2nd-nearest in range
  execute?: number // sniper: x dmg vs a target near the core
}

export interface SkillDef {
  name: string
  line: string
  effect: SkillEffect
}

// each profile's ordered lineup — the deeper the talent, the further you walk it
export const PROFILE_SKILLS: Record<string, SkillDef[]> = {
  lancer: [
    { name: 'Long Line', line: '+reach', effect: { range: 3 } },
    { name: 'Pierce', line: 'the bolt passes through two', effect: { pierce: true } },
    { name: 'Execute', line: 'death to what nears the core', effect: { execute: 1.6 } },
  ],
  maw: [
    { name: 'Wider Maw', line: '+splash', effect: { splashR: 1.4 } },
    { name: 'Deeper Bite', line: '+bite', effect: { atkMult: 1.2 } },
    { name: 'Engulf', line: 'the whole knot, swallowed', effect: { splashR: 2 } },
  ],
  bastion: [
    { name: 'Hold the Line', line: '+reach', effect: { range: 2 } },
    { name: 'Thick Shell', line: '+endurance', effect: { hpMult: 1.35 } },
    { name: 'Crush', line: 'the wall bites back', effect: { atkMult: 1.5 } },
  ],
  rime: [
    { name: 'Deep Chill', line: 'the cold lingers', effect: { slowDur: 20 } },
    { name: 'Frostreach', line: '+reach', effect: { range: 2 } },
    { name: 'Killing Cold', line: '+bite', effect: { atkMult: 1.3 } },
  ],
  throe: [
    { name: 'Tidal Push', line: 'shove harder', effect: { kb: 2 } },
    { name: 'Concussive', line: 'longer reeling', effect: { stun: 10 } },
    { name: 'Undertow', line: 'the deep stays down', effect: { kb: 2, stun: 6 } },
  ],
  sear: [
    { name: 'White Heat', line: '+bite', effect: { atkMult: 1.25 } },
    { name: 'Far Burn', line: '+reach', effect: { range: 2 } },
    { name: 'Overrun', line: 'death to leakers', effect: { execute: 1.5 } },
  ],
  // menders: atkMult lifts BOTH the chip and the mend (heal scales off atk);
  // splashR widens the bloom; range lengthens the suture's reach
  suture: [
    { name: 'Deep Stitch', line: '+mend', effect: { atkMult: 1.25 } },
    { name: 'Long Reach', line: '+reach', effect: { range: 2 } },
    { name: 'Clean Close', line: 'the wound seals deep', effect: { atkMult: 1.3 } },
  ],
  bloom: [
    { name: 'Wider Bloom', line: '+spread', effect: { splashR: 1.2 } },
    { name: 'Rich Soil', line: '+mend', effect: { atkMult: 1.2 } },
    { name: 'Everbloom', line: 'the mend lingers wide', effect: { splashR: 1.4, atkMult: 1.15 } },
  ],
}

export function profileSkills(id: string): SkillDef[] {
  return PROFILE_SKILLS[id] ?? []
}

// sum the effects of the skills a given talent level has unlocked
export function skillEffectFor(profileId: string, talent: number): SkillEffect {
  const active = profileSkills(profileId).slice(0, Math.max(0, talent))
  const e: SkillEffect = {}
  for (const s of active) {
    const x = s.effect
    if (x.range) e.range = (e.range ?? 0) + x.range
    if (x.atkMult) e.atkMult = (e.atkMult ?? 1) * x.atkMult
    if (x.hpMult) e.hpMult = (e.hpMult ?? 1) * x.hpMult
    if (x.splashR) e.splashR = (e.splashR ?? 0) + x.splashR
    if (x.slowDur) e.slowDur = (e.slowDur ?? 0) + x.slowDur
    if (x.kb) e.kb = (e.kb ?? 0) + x.kb
    if (x.stun) e.stun = (e.stun ?? 0) + x.stun
    if (x.pierce) e.pierce = true
    if (x.execute) e.execute = Math.max(e.execute ?? 1, x.execute)
  }
  return e
}

// the three profiles a fresh host starts with (one of each tier-1 flavor)
export function starterCollection(): string[] {
  return ['lancer', 'maw', 'bastion']
}
