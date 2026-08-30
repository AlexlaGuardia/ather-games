// Does the abutment clamp ever bind? Swept across many seeds.
//
// ── ★★★ IT BINDS IN BOTH DIRECTIONS, AND ONE CONSTANT IS ANSWERING BOTH (2026-08-30) ──────────
// Written to test the board's claim that the crossing tail is "the shore is higher than the bridge".
// On 8 seeds it agrees. On FORTY it does not. Of 383 crossing-ends, 21 are a full-block vault and
// the tail runs BOTH WAYS — 9 ends where the bank stands ABOVE the springing and the deck cannot
// climb to it, and 5 where it stands BELOW and the deck cannot walk down to it. `s28/gloview-
// village-1` lands on ground 6 blocks under its own springing; `s34/thistle-hold-4` is 8 under.
// ⚠ The upward-only reading was TRUE of the two seeds it was measured on. A tail is the one part of
// a distribution a small sample cannot describe, and the fix that reading implied (cut the terrain)
// is the wrong operation for half the cases.
//
// `bridges.ts` has ONE symmetric `ABUT_MAX = 2` serving two questions whose costs are nothing alike:
// climbing raises `BRIDGE_REACH`, which is `depth.ts`'s cheap y-band gate on every column near the
// story path; descending is free, because `deckTopAt`'s `endAt` never drops the deck below the
// waterline anyway, so only the apron's LENGTH can see a low bank at all. ★ And `ABUT_REACH = 4` is
// exactly `ABUT_MAX / MAX_GRADE` — one derivation, done by hand, never written down. That is why
// the apron is correct by construction for a CLAMPED landing and wrong for a real one: the clamp
// reports a bank 6 down as 2 down, the ramp descends the 2 it was told about, and ends in the air
// over the 4 it was not. Everything downstream is correct about a lie.
//
// ── ⚠⚠⚠ THREE FIXES WERE BUILT AND MEASURED AGAINST THIS SWEEP. ALL THREE WERE REVERTED. ──────
// Kept here because the measurements are the useful artifact, and the third one is the trap:
//   1. Split the clamp, then lengthen the apron to `ceil(drop / MAX_GRADE)`. → 4 ends improved,
//      **6 got worse**. A ramp falling at MAX_GRADE against ground that falls FASTER never catches
//      it, so each extra cell MOVES THE CLIFF FURTHER OUT. `deckTopAt` already records this bug for
//      a FLAT apron; it wears the descending costume just as well.
//   2. Search the reach instead — ask the world what each length would land on, keep the best.
//      → 6 improved, 5 worse. A margin gate changed NOTHING, which proved the regressions were the
//      search choosing ZERO where the old blind `4` had been quietly working.
//   3. Floor the search at the old `4` so it can only ever lengthen. → **on the 383 ends both runs
//      can see, vaults 21 -> 15, six improved, NONE regressed.** By this sweep it is a clean win.
// ★★★ AND IT IS NOT ONE. `bridges.test.ts` on the same seeds says the lengthened aprons carry
// **34 AIR cells (baseline: 1)** and **9 railing posts standing over nothing (baseline: 1)**. This
// sweep measures the STEP AT THE END of an apron and has nothing to say about whether the apron's
// own cells are solid — so it reported a clean win over geometry full of holes. ⚠ The apron is a
// RIBBON: it lays a deck course and no fill. Over ground that falls away, a longer one floats. A
// deep landing needs an EMBANKMENT (fill to the ground beneath it), which is a mechanism, not a
// constant — and that, not `ABUT_MAX`, is the real shape of the downward tail.
//
// ── ⚠⚠ THREE WAYS THIS SCRIPT LIED TO ITS OWN AUTHOR, ALL FIXED HERE ──────────────────────────
//  1. It kept `const ABUT_MAX = 2`, a hand-copy of a value owned by bridges.ts. A copy agrees with
//     its source while both go stale, and it had no second number with which to notice an asymmetry.
//     Imported now (the constant was exported for this).
//  2. It printed `offenders.slice(0, 25)`. Comparing that truncated list against a full one reads
//     exactly like "the ends below the cut were fine before" — which is how the first fix looked
//     like a win. Prints all of them now.
//  3. ★ Its landing probe reached 12 cells and gave up SILENTLY, so an end whose apron ran longer
//     vanished from the count — surfacing as a smaller `crossing-ends`, never as a blindness.
//     **23 of 383 ends are unmeasured on today's HEAD and nothing said so.** The probe now reaches
//     past any apron `ABUT_REACH` can produce and reports `UNMEASURED` separately: "could not look"
//     must not be able to hide inside "found nothing".
//
// ⚠ RUN IT WIDE. `SEEDS=$(seq -s, 1 40)`. The default 8 is a smoke test and it is the sample size
// that produced the one-directional diagnosis this header exists to correct.
import { bridgeSpecs, bridgeAt, deckTopAt, ABUT_MAX, ABUT_REACH } from '../src/app/shimmer/voxel/bridges'
import { columnHeight } from '../src/app/shimmer/voxel/height'
import { materialAt, MAT, isSolid, isHalfMat } from '../src/app/shimmer/voxel/depth'
import { STORY_NODES } from '../src/app/shimmer/voxel/story-path'
// ⚠ IMPORTED, NOT RESTATED. This file used to keep `const ABUT_MAX = 2` — a hand-copy of a value
// owned by bridges.ts, which is the shape that manufactures a green: the copy and its source go
// stale together and agree perfectly while both are wrong. It also could not have reported the
// asymmetry, because it only had one number to compare against.
const surfAt = (x:number,z:number,S:number):number|null => {
  const h = columnHeight(x,z,S)
  for(let y=h+6;y>=h-8;y--){ const m=materialAt(x,y,z,S,h); if(m===MAT.WATER) return null; if(isSolid(m)) return isHalfMat(m)?y+0.5:y+1 }
  return null
}
const SEEDS = (process.env.SEEDS ?? '1,2,3,4,5,6,7,8').split(',').filter(Boolean).map(Number)
let unmeasured=0
const clampDir:Record<string,number>={UP:0,DOWN:0}
let ends=0, flush=0, half=0, vault=0, clampBound=0, maxGap=0
const offenders:string[]=[]
// ⚠ `offenders.slice(0,25)` USED TO BE THE ONLY OUTPUT, and it silently truncated: comparing a
// truncated list against a full one reads exactly like "those ends were fine before". DUMP=1 emits
// one machine-readable line per end so two runs can be diffed instead of eyeballed.
const DUMP = process.env.DUMP === '1'
const dump:string[]=[]
const gapHist=new Map<number,number>()
for (const S of SEEDS) {
  const specs = bridgeSpecs(S)
  type C={x:number;z:number;t:number;ux:number;uz:number}
  const line=new Map<number,C[]>()
  for(let n=0;n<STORY_NODES.length-1;n++){
    const a=STORY_NODES[n],b=STORY_NODES[n+1]
    const len=Math.hypot(b.x-a.x,b.z-a.z),ux=(b.x-a.x)/len,uz=(b.z-a.z)/len
    for(let d=-8;d<=len+8;d+=0.5){
      const x=Math.floor(a.x+ux*d),z=Math.floor(a.z+uz*d)
      const c=bridgeAt(x,z,S); if(!c) continue
      const arr=line.get(c.i)??[]; if(!arr.some(v=>v.x===x&&v.z===z)) arr.push({x,z,t:c.t,ux,uz}); line.set(c.i,arr)
    }
  }
  for(let i=0;i<specs.length;i++){
    const b=specs[i]; const cells=(line.get(i)??[]).sort((p,q)=>p.t-q.t); if(!cells.length) continue
    const base=b.table+1
    for(const [end,c0,sgn] of [['near',cells[0],-1],['far',cells[cells.length-1],+1]] as const){
      const deck=surfAt(c0.x,c0.z,S)
      let land:number|null=null
      // ⚠ THE PROBE'S REACH IS NOT THE APRON'S. At 12 this loop silently stopped finding a
      // landing once an apron ran longer, and 5 ends DROPPED OUT OF THE COUNT — which reads in the
      // summary as "5 fewer ends" and not at all as "the instrument went blind on 5 ends". Sized
      // well past any apron ABUT_REACH can produce, and unfound landings are now reported.
      for(let k=1;k<=ABUT_REACH*3&&land===null;k++){
        const nx=Math.floor(c0.x+0.5+c0.ux*sgn*k), nz=Math.floor(c0.z+0.5+c0.uz*sgn*k)
        if(bridgeAt(nx,nz,S)) continue
        land=surfAt(nx,nz,S)
      }
      if(deck===null||land===null){ unmeasured++; offenders.push(`s${S}/${b.id} ${end} NO LANDING FOUND within ${ABUT_REACH*3} cells — instrument blind, not a pass`); continue }
      ends++
      const step=land-deck
      if(step===0)flush++; else if(Math.abs(step)<=0.5)half++; else {vault++; offenders.push(`s${S}/${b.id} ${end} ${step>0?'+':''}${step}`)}
      const signed=land-base, gap=Math.abs(signed)
      if(DUMP) dump.push(`s${S}/${b.id}\t${end}\tstep=${step}\tbank=${signed>0?'+':''}${signed}\tdeck=${deck}\tland=${land}`)
      gapHist.set(gap,(gapHist.get(gap)??0)+1)
      if(gap>maxGap) maxGap=gap
      // ★ REPORT THE DIRECTION. The clamp is one symmetric number, but the two directions are not
      // one defect: UP is bounded by BRIDGE_REACH (depth.ts's hot y-gate) and DOWN is not bounded by
      // anything except the apron's length. Printing them together is how the tail got recorded as
      // "the shore is higher than the bridge" when half of it is the shore being LOWER.
      const dir=signed>0?'UP':'DOWN'
      if(gap>ABUT_MAX){ clampBound++; clampDir[dir]++; offenders.push(`s${S}/${b.id} ${end} CLAMP BOUND ${dir}: bank ${land} vs springing ${base}, gap ${gap} > ABUT_MAX ${ABUT_MAX}`) }
    }
  }
}
console.log(`seeds ${SEEDS.length} · crossing-ends ${ends}` + (unmeasured?`  ⚠ ${unmeasured} UNMEASURED`:''))
console.log(`  flush ${flush} · half-step ${half} · FULL-BLOCK VAULT ${vault}`)
console.log(`  widest bank-to-springing gap seen: ${maxGap}   (ABUT_MAX = ${ABUT_MAX})`)
console.log(`  ends where the clamp BOUND: ${clampBound}   (UP ${clampDir.UP} · DOWN ${clampDir.DOWN})`)
console.log(`  gap distribution: ${[...gapHist.entries()].sort((a,b)=>a[0]-b[0]).map(([g,n])=>`${g}:${n}`).join('  ')}`)
if(offenders.length) console.log(`  ⚠  (${offenders.length} lines)\n   ${offenders.join('\n   ')}`)
if(DUMP) console.log('--- DUMP ---\n' + dump.join('\n'))
