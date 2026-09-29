/**
 * THE STATUS TABLE + THE LOCK RULE (2026-09-28).
 * Run: `npx tsx src/app/shimmer/engine/statuses.test.ts`
 */
import { readFileSync } from 'node:fs'
import { STATUS_TABLE, STATUS_KINDS, HARD_IMMUNITY_SECS, SLOW_MULT, emptyBag, applyStatus, applyStatuses, hasStatus, hardImmune, pruneStatuses, foeMods, statusesOn } from './statuses'
import { KEEPER_MOVES } from '../play3d/keeper-moves'
import { castForMove } from '../play3d/cast'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l) }

// A. the table is the registry: every status any move names is in it, and every row is whole
for (const m of KEEPER_MOVES) for (const k of castForMove(m.id).statuses) ok(k in STATUS_TABLE, `★ ${m.name} names '${k}', which the table has`)
for (const k of STATUS_KINDS) { const d = STATUS_TABLE[k]; ok(!!d.label && !!d.effect && typeof d.hard === 'boolean' && d.color > 0, `${k} has a label, an effect, a hard flag and a colour`) }
ok(STATUS_KINDS.length === 11, 'eleven statuses (update this when the table grows, on purpose): Sealed joined 09-29 with Pillar Tomb')
ok(['rooted', 'disarmed', 'blinded', 'silenced'].every(k => STATUS_TABLE[k as keyof typeof STATUS_TABLE].hard) && ['slowed', 'staggered', 'revealed', 'burning', 'vulnerable', 'shieldBroken'].every(k => !STATUS_TABLE[k as keyof typeof STATUS_TABLE].hard), 'hard = takes an option away outright; the rest are soft')

// B. no stacking: a re-apply extends to the later expiry
let b = applyStatus(emptyBag(), 'x', 'slowed', 2, 0)
b = applyStatus(b, 'x', 'slowed', 2, 1000)
ok(hasStatus(b, 'x', 'slowed', 2900) && !hasStatus(b, 'x', 'slowed', 3100), 'soft: extends to the later expiry, never adds')

// C. ★ THE LOCK RULE: hard statuses share one window, then immunity
b = applyStatuses(emptyBag(), 'x', ['rooted', 'disarmed'], 2, 0)
ok(hasStatus(b, 'x', 'rooted', 1900) && hasStatus(b, 'x', 'disarmed', 1900), 'a two-kind cast lands whole (root + disarm)')
b = applyStatus(b, 'x', 'blinded', 5, 1500)                     // a second keeper chains a blind at 1.5s
ok(hasStatus(b, 'x', 'blinded', 1900) && !hasStatus(b, 'x', 'blinded', 2100), '★ a hard status inside the window is CAPPED at its end: it adds a kind, never time')
b = applyStatus(b, 'x', 'rooted', 5, 1900)
ok(!hasStatus(b, 'x', 'rooted', 2100), '★ re-rooting at the last moment does not extend the lock')
b = pruneStatuses(b, 2500)
ok(hardImmune(b, 'x', 2500), 'the window closed: immune, and prune kept the memory of it')
const b2 = applyStatus(b, 'x', 'rooted', 3, 3000)
ok(!hasStatus(b2, 'x', 'rooted', 3001), `★ immune for ${HARD_IMMUNITY_SECS}s after a hard window: the chain cannot restart`)
const b3 = applyStatus(b, 'x', 'slowed', 3, 3000)
ok(hasStatus(b3, 'x', 'slowed', 3001), 'soft statuses land during immunity')
const b4 = applyStatus(pruneStatuses(b, 5100), 'x', 'rooted', 3, 5100)
ok(hasStatus(b4, 'x', 'rooted', 5200), 'after the immunity, a hard status lands again')
const z = applyStatus(b, 'x', 'blinded', 1, 3000, { zone: true })
ok(hasStatus(z, 'x', 'blinded', 3500), '★ a lingering cloud ignores the lock rule: walking out is the counter, and a fog must not flicker')

// D. what a foe's brain reads
const mods = (k: string) => foeMods(applyStatus(emptyBag(), 'f', k as never, 2, 0), 'f', 100)
ok(mods('slowed').speedMult === SLOW_MULT, 'slowed → the slow multiplier')
ok(mods('staggered').speedMult === 0 && mods('rooted').speedMult === 0, 'staggered and rooted → a full stop')
ok(mods('blinded').blinded && mods('disarmed').disarmed, 'blinded / disarmed read through')
ok(statusesOn(applyStatuses(emptyBag(), 'f', ['slowed', 'rooted'], 2, 0), 'f', 100)[0] === 'rooted', 'the marker shows the hard status first')

// E. the hosts: every real-time foe in play3d takes statuses, and lingering clouds exist
const p3 = readFileSync('src/app/shimmer/play3d/Shimmer3D.tsx', 'utf8')
for (const id of ['`board:${i}`', "'hunter'", '`guard:${st.id}`', '`fleet:${mm.index}`', '`flood:${b.id}`']) ok(p3.includes(`fn(${id}`), `★ forEachFoe walks ${id}`)
ok(p3.includes('stepHold(hs, dt, posRef.current.x, posRef.current.z, posRef.current.y / STEP, undefined, (id) =>'), 'the Breach flooded read their statuses')
ok(p3.includes('stepFleet(fleet, bodies, bc, dt, RANGE_HUNTER, (i) => foeMods('), 'the Crucible fleet reads theirs')
ok(p3.includes("applyStatuses(bag, id, zn.kinds, zn.applySecs, nowFrame, { zone: true })"), 'a cloud re-applies with the zone flag')
for (const id of ['fog-bank', 'hush', 'sandstorm-veil', 'dust-lung', 'pressure-drop', 'squall']) ok(castForMove(id).linger && castForMove(id).archetype === 'status', `${id} is a lingering cloud`)
ok(castForMove('ice-dart').statuses.includes('slowed') && castForMove('ice-dart').areaSecs > 0, 'Ice Dart slows what it hits')

// F. STEP 2 (09-29): reveal + Enlighten's tell
const en = castForMove('enlighten')
ok(en.windupMs >= 500 && en.facingOnly && en.revealRadius >= 10 && en.revealSecs > 0, '★ Enlighten charges, blinds only the facing, reveals everyone near')
ok(en.areaSecs <= 2 && en.statuses.includes('blinded'), 'its blind is short (1.5s): the PvP window Alex called out')
ok(castForMove('bolt-snipe').statuses.includes('revealed') && castForMove('bolt-snipe').damage < 20, 'Bolt Snipe marks what it hits, and stings rather than kills')
ok(p3.includes('pending && pending.windupMs > 0 && !windupRef.current') && p3.includes('performance.now() >= windupRef.current.at'), '★ a windup cast is held until due, then released')
ok(p3.includes('if (cl > 0.5 && (fx * cx + fz * cz) / (fl * cl) < 0) return'), '★ facing only: a flash behind a foe misses it')
ok(p3.includes('depthTest={false}') && p3.includes("hasStatus(bag, id, 'revealed', nowFrame)"), '★ a Revealed foe draws with no depth test: through walls')
ok(p3.includes("tone(260, spec.windupMs, { type: 'triangle'") && p3.includes('setChargeGlow(true)'), 'the tell is heard and seen for the whole charge')

// G. STEP 3 (09-29): amp
for (const id of ['flame-infusion', 'forge-fist']) { const c = castForMove(id); ok(c.archetype === 'infusion' && c.statuses.length === 1 && c.areaSecs > 0, `${id} lays an on-hit status`) }
ok(castForMove('flame-infusion').statuses[0] === 'burning' && castForMove('forge-fist').statuses[0] === 'vulnerable', 'Flame Infusion burns, Forge Fist shreds')
for (const id of ['grindstone', 'shatterfield']) ok(castForMove(id).linger && castForMove(id).statuses[0] === 'vulnerable' && castForMove(id).fieldDps === 0, `${id} is a Vulnerable cloud with no damage of its own`)
ok(p3.includes("? { until: now + spec.surgeSecs * 1000, mult: 1, onHit: spec.statuses[0]"), '★ play3d: an infusion with a status multiplies nothing (the status IS the amp)')
for (const id of ['`board:${targets.indexOf(t)}`', "'hunter'", '`fleet:${m.index}`', '`guard:${st.id}`', '`flood:${b.id}`']) ok(p3.includes(`vm(${id})`) || p3.includes(`const tid = ${id}`), `★ gun hits on ${id} read Vulnerable`)
ok((p3.match(/landed\(p, /g) || []).length >= 5 && p3.includes('    const landed = (p: (typeof pool)[number], id: string, x: number, z: number, d: number) => {\n      ampHit(id)'), 'every gun hit site lays the infusion status (through `landed`)')
ok(p3.includes('burnTickAt.current = nowFrame + 500') && p3.includes('d = BURN_DPS * 0.5'), 'Burning ticks every half second through each foe\'s own damage path')

// H. STEP 4 (09-29): traps + charges (Alex's revision of Shackle and Flash Freeze)
for (const id of ['shackle', 'flash-freeze']) { const c = castForMove(id); ok(c.trap && c.charges === 2 && c.trapMax === 2 && c.trapSecs > 0, `★ ${id} is a trap: 2 charges, at most 2 set`) }
ok(castForMove('shackle').statuses.join() === 'rooted,disarmed' && castForMove('shackle').areaSecs === 2, 'Shackle clamps the foe that trips it: rooted + jammed 2s')
const ff = castForMove('flash-freeze')
ok(ff.statuses[0] === 'rooted' && ff.areaSecs === 1.5 && ff.splashStatuses[0] === 'slowed' && ff.areaSize === 3 && ff.splashSecs === 3, 'Flash Freeze roots the tripper 1.5s and slows everyone within 3 for 3s')
ok(p3.includes('mine.length >= pending.trapMax ? mine.slice(mine.length - pending.trapMax + 1) : mine'), '★ one trap past the cap lifts the OLDEST, never refuses the press')
ok(p3.includes("if (!tripped && (x - t.x) ** 2 + (z - t.z) ** 2 <= t.spec.trapRadius * t.spec.trapRadius) tripped = id"), 'the FIRST foe inside the radius trips it')
ok(p3.includes('while (charge.n < spec.charges && charge.at > 0 && now >= charge.at)'), '★ charges refill one at a time')
ok(p3.includes("setHarvestToast(`${spec.label} — recharging`)"), 'an empty move says it is recharging, never a dead key')

// I. STEP 5 (09-29): space
const sw = castForMove('stonewall')
ok(sw.archetype === 'terrain' && sw.shape === 'wall' && sw.areaSize >= 10 && sw.areaSecs >= 12, '★ Stonewall is a long wall that can divide a room')
const fw = castForMove('firewall'), fs = castForMove('firestorm')
ok(fw.line && fw.linger && fw.fieldStopsShots && fw.statuses.includes('slowed') && fw.statuses.includes('revealed') && fw.fieldDps === 0, '★ Firewall: a line that stops rounds both ways; crossing it slows + reveals; no damage')
ok(fs.line && !fs.fieldStopsShots && fs.statuses[0] === 'burning' && fs.areaSize > fw.areaSize, 'Firestorm: a longer line; crossing it sets you Burning')
ok(p3.includes('const line = pending.line ? { ux: -flatZ / flatLen, uz: flatX / flatLen'), 'a line runs ACROSS the aim')
ok((p3.match(/lineStops\((p|o)\.pos/g) || []).length >= 3, '★ a shot-stopping line stops gun rounds, enemy orbs and cast rounds')

// J. STEP 6 (09-29): the air-jump
const qf = castForMove('quickform'), ud = castForMove('updraft')
ok(qf.archetype === 'impulse' && qf.keepMomentum && qf.impulseFwd === 0 && qf.impulseUp > 0 && qf.charges === 2, '★ Quickform is the double jump: straight up, momentum kept, 2 charges')
ok(ud.airJumps === 1 && ud.airJumpSecs >= 10, 'Updraft banks one air-jump for 10s')
ok(p3.includes('if (bc.keepMomentum) airSpeed.current = Math.max(airSpeed.current, hvel.length())'), 'a keep-momentum launch never zeroes your run')
ok(p3.includes('&& airJumps.current > 0 && performance.now() < airJumpUntil.current'), '★ Space mid-air spends a stored jump')
ok(p3.includes("if (charge) { charge.n--; if (charge.at === 0) charge.at = now + spec.cooldownMs; castCdRef.current[slot] = now + 250 }"), 'impulse moves spend charges too')

// K. STEP 7 (09-29): shield recovery over an area
for (const id of ['healing-grove', 'exhale']) ok(castForMove(id).fieldShps > 0 && castForMove(id).archetype === 'field', `${id} restores shield to a keeper inside`)
ok(p3.includes('const shps = castForMove(f.moveId).fieldShps'), 'the shield refill rides the field\'s own tick')

// L. PASS 2, STEP 8 (09-29): displacement. Casts move foes; none of these hurts.
for (const id of ['gale-cutter', 'riptide', 'tidal-arms', 'forked-bolt', 'drowning-grasp', 'wind-shear', 'pyroclast']) ok(castForMove(id).damage === 0 && castForMove(id).fieldDps === 0, `${id} does no damage (the guns carry it)`)
const gc = castForMove('gale-cutter'), rp = castForMove('riptide'), ta = castForMove('tidal-arms')
ok(gc.archetype === 'projectile' && gc.shove > 0 && gc.shoveDir === 'away', 'Gale Cutter throws what it strikes back along its flight')
ok(rp.shove > 0 && rp.shoveDir === 'toward' && rp.statuses.includes('staggered'), 'Riptide drags its target toward you, off its footing')
ok(ta.shoveDir === 'toward' && ta.grapple && ta.projSpeed * ta.projLife < 20, '★ Tidal Arms yanks a foe, or pulls YOU to the wall it caught (short reach)')
const fb = castForMove('forked-bolt')
ok(fb.chain === 2 && fb.statuses.join() === 'disarmed' && fb.areaSecs === 1 && fb.markSecs === 4, 'Forked Bolt: the two nearest, jammed 1s, marked 4s')
const dg = castForMove('drowning-grasp')
ok(dg.archetype === 'projectile' && dg.projSpeed * dg.projLife <= 7 && dg.statuses.includes('silenced') && dg.statuses.includes('slowed') && dg.areaSecs === 2, '★ Drowning Grasp: ~6 tiles, one foe, no breath (silenced + slowed 2s)')
const ws = castForMove('wind-shear')
ok(ws.lane > 0 && ws.shoveDir === 'aside' && ws.statuses.includes('staggered'), 'Wind Shear: a lane from you; everyone on it thrown aside')
const pc = castForMove('pyroclast')
ok(pc.linger && pc.statuses.includes('blinded') && pc.shoveDir === 'out' && pc.shove > 0, 'Pyroclast: an ash cloud that blinds and walks you out of it')
ok(p3.includes("if (zn.push) shoveFoe(id, 'out', zn.push"), 'the cloud pushes on its own tick')
ok(p3.includes('shovesRef.current = stepShoves(shovesRef.current, dt, moveFoe)'), '★ play3d: every shove steps through the one foe mover')
ok(p3.includes("if (!hs || coop.link) return false"), 'a co-op Breach refuses a shove on server-owned flooded rather than faking one')
ok(p3.includes('landCast(p, hitId, sx, sz, 1)') && !p3.includes('t.hp -= dmg; p.life = 0; hit = true'), '★ one hit test for every foe: cast bolts reach the Puppet Guards now')
ok(p3.includes("!hasStatus(fbag, `fleet:${r.member.index}`, 'silenced', nowFrame)"), 'a silenced challenger cannot cast')

// M. PASS 2, STEP 9 (09-29): amp. What a cast adds to the keeper's rounds; none of these is a bolt of its own.
const pl = castForMove('pressure-lance'), ks = castForMove('keenshard'), cl = castForMove('chain-lightning'), eg = castForMove('emberglass'), fp = castForMove('flashpoint')
ok(pl.archetype === 'infusion' && pl.ampShield && pl.ampCover && pl.surgeSecs === 8 && pl.damage === 0, 'Pressure Lance: 8s of rounds through guards and thin cover')
ok(ks.archetype === 'infusion' && ks.ampShots === 3 && ks.ampPierce === 1 && ks.ampCover, 'Keenshard: the next 3 rounds pierce a body and thin cover')
ok(cl.archetype === 'infusion' && cl.ampArc > 0 && cl.ampArc <= 0.5 && cl.surgeSecs === 10 && cl.chainRange > 0, 'Chain Lightning: 10s of rounds that arc to a second foe')
ok(eg.archetype === 'status' && eg.linger && eg.ampZone && eg.statuses[0] === 'burning' && eg.areaSecs === 6, '★ Emberglass: a spot that sets YOUR ROUNDS burning, not the foes standing in it')
ok(fp.archetype === 'status' && !fp.linger && fp.statuses.includes('burning') && fp.statuses.includes('revealed') && fp.areaSecs === 3 && fp.fieldDps === 0, 'Flashpoint: the spot ignites at once, burning + revealed 3s')
ok(p3.includes('if (zn.amp || !inZone(zn, x, z)) return'), 'an amp zone never touches the foes inside it')
ok(p3.includes('if (!p.amp) for (const zn of statusZones.current) if (zn.amp'), 'a round picks up the burn in flight')
ok(p3.includes('if ((!p.cover || tombAt(p.pos.x, p.pos.z)) && conjuredBlockedAt(') && p3.includes('if (!p.cover) { const ab = absorbShotAt('), 'thin cover stops a round unless it pierces')
ok(p3.includes('if (++p.hits >= tier.pierce + p.xp) p.life = 0'), 'a pierce amp adds to the device tier in the Breach')
ok(p3.includes('if (live && inf.shots) { inf.shots--; if (inf.shots <= 0) inf.until = 0 }'), '★ Keenshard\'s window closes on its third round, not its clock')
ok(p3.includes('rangeCfgRef.current.tune, p.shield)'), 'a guard-piercing round reaches damageGuard')
const pgSrc = readFileSync(new URL('../play3d/puppet-guards.ts', import.meta.url), 'utf8')
ok(pgSrc.includes('if (!pierce) dealt *= 0.4'), '★ a pierced barrier lets the full hit through (the stagger still lands)')
ok(p3.includes("kinds: [], color: STATUS_TABLE[pending.statuses[0]].color, applySecs: 0, stops: false }]"), 'an instant status cast flashes where it lands')

// N. PASS 2, STEP 10 (09-29): info + stealth
const hu = castForMove('hush'), mv = castForMove('monsoon-veil'), hm = castForMove('heat-mirage'), wm = castForMove('waymark')
const sb = castForMove('stormbank'), fbr = castForMove('flame-barrage'), ex = castForMove('exhale')
ok(hu.hides && hu.linger && hu.castRange <= 2, '★ Hush: a hiding cloud laid on you')
ok(mv.hides && mv.fieldHps > 0, 'Monsoon Veil heals AND hides whoever stands in it')
ok(hm.archetype === 'veil' && hm.decoySecs === 4 && hm.decoyOffset > 0.9 && hm.decoyOffset < 2.5, 'Heat Mirage: a false you, about three feet off, for 4s')
ok(wm.trap && wm.trapKeep && wm.statuses[0] === 'revealed' && wm.trapMax === 3, 'Waymark: a mark that is never spent; whoever passes it shows')
ok(sb.linger && sb.statuses.includes('blinded') && sb.statuses.includes('revealed') && sb.landStatuses[0] === 'disarmed' && sb.fieldDps === 0, 'Stormbank: one-way fog; its lightning jams weapons once, as it lands')
ok(fbr.volley === 6 && fbr.damage === 0 && fbr.statuses[0] === 'burning' && fbr.markSecs === 5 && fbr.chainRange >= 15, 'Flame Barrage: six birds, each hunting its own foe; they reveal + burn, no damage')
ok(ex.surgeSecs > 0 && ex.surgeMult > 1 && ex.fieldShps > 0, 'Exhale: the shield breath AND a short speed boost')
ok(p3.includes('const lostTrack = (x: number, z: number) => hideAreas.length > 0 && !hideAreas.some('), '★ a hidden keeper is lost to foes OUTSIDE the cloud only')
for (const who of ["'hunter', 'blinded', nowFrame) || lostTrack(h.x, h.z)", "|| lostTrack(r.member.state.x, r.member.state.z)", "gKey, 'blinded', nowFrame) || lostTrack(b.pos.x, b.pos.z)", 'undefined, (id) => floodMods(id, bag0))'])
  ok(p3.includes(who), `every foe that aims can lose track: ${who.slice(0, 30)}`)
ok((p3.match(/o\.vel\.copy\(aimPt\)/g) || []).length === 3 && p3.includes('hc.targetX = aimPt.x'), '★ every foe that aims, aims at the mirage while it stands')
ok(p3.includes("if (fresh) tone(1250, 140"), 'a waymark pings when something new touches it')
ok(p3.includes("cp.homing = prey.length ? prey[k % prey.length] : ''") && p3.includes('lerp(seg, Math.min(1, dt * 3.5))'), 'the birds are loosed at separate prey and turn toward it')
ok(p3.includes("case 'veil': {"), 'the dispatcher places a veil like any other aimed cast')

// O. PASS 2, STEP 11 (09-29): containment + the topple
const pt = castForMove('pillar-tomb'), cc = castForMove('cyclone-cage'), mo = castForMove('monolith')
ok(STATUS_TABLE.sealed?.hard === true, 'Sealed is a hard status (it takes every option)')
ok(pt.entomb && pt.statuses.includes('sealed') && pt.statuses.includes('rooted') && pt.statuses.includes('disarmed') && pt.areaSecs === 4, '★ Pillar Tomb seals ONE foe 4s: out of the fight, out of reach')
ok(cc.cage && cc.fieldStopsShots && cc.fieldDps === 0 && cc.areaSecs === 5, 'Cyclone Cage: 5s, holds whoever it lands on, no shot crosses, no damage')
ok(mo.topple > 0 && mo.archetype === 'terrain', 'Monolith can be toppled')
ok(p3.includes("if (statusRef.current[id] && hasStatus(statusRef.current, id, 'sealed', nowFrame)) return"), 'a sealed foe takes nothing through the one damage path')
ok(p3.includes('if ((!p.cover || tombAt(p.pos.x, p.pos.z)) && conjuredBlockedAt('), '★ a tomb is not thin cover: even a piercing round stops at it')
ok(p3.includes('if (!c.ids.includes(id)) return') && p3.includes('if (d > lim) moveFoe(id,'), 'a caged foe is set back inside the wall')
ok(p3.includes("pendingCastRef.current = { ...spec, toppling: true }") && p3.includes("pending.archetype === 'terrain' && pending.toppling"), '★ the second press topples the standing slab, free')

console.log(`statuses: ${pass} passed, ${fails.length} failed`)
if (fails.length) { for (const f of fails) console.log('  ✗ ' + f); process.exit(1) }
