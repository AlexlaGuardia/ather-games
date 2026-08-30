// Does ABUT_MAX ever bind? Swept across many seeds.
//
// Tested by CONSEQUENCE, not by restating landingAt: if the clamp binds, the deck cannot reach its
// bank and the end stops being flush. Two independent readings per end:
//   · STEP  — true standing surface both sides (top solid cell, +0.5 for a slab), asked of the world
//   · GAP   — |true landing surface - (table+1)|, i.e. how far the bank stands from the springing.
//             ABUT_MAX is 2, so a GAP > 2 is a bank the clamp REFUSED to reach for.
import { bridgeSpecs, bridgeAt, deckTopAt } from '../src/app/shimmer/voxel/bridges'
import { columnHeight } from '../src/app/shimmer/voxel/height'
import { materialAt, MAT, isSolid, isHalfMat } from '../src/app/shimmer/voxel/depth'
import { STORY_NODES } from '../src/app/shimmer/voxel/story-path'
const ABUT_MAX = 2
const surfAt = (x:number,z:number,S:number):number|null => {
  const h = columnHeight(x,z,S)
  for(let y=h+6;y>=h-8;y--){ const m=materialAt(x,y,z,S,h); if(m===MAT.WATER) return null; if(isSolid(m)) return isHalfMat(m)?y+0.5:y+1 }
  return null
}
const SEEDS = (process.env.SEEDS ?? '1,2,3,4,5,6,7,8').split(',').filter(Boolean).map(Number)
let ends=0, flush=0, half=0, vault=0, clampBound=0, maxGap=0
const offenders:string[]=[]
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
      for(let k=1;k<=12&&land===null;k++){
        const nx=Math.floor(c0.x+0.5+c0.ux*sgn*k), nz=Math.floor(c0.z+0.5+c0.uz*sgn*k)
        if(bridgeAt(nx,nz,S)) continue
        land=surfAt(nx,nz,S)
      }
      if(deck===null||land===null) continue
      ends++
      const step=land-deck
      if(step===0)flush++; else if(Math.abs(step)<=0.5)half++; else {vault++; offenders.push(`s${S}/${b.id} ${end} ${step>0?'+':''}${step}`)}
      const gap=Math.abs(land-base)
      gapHist.set(gap,(gapHist.get(gap)??0)+1)
      if(gap>maxGap) maxGap=gap
      if(gap>ABUT_MAX){ clampBound++; offenders.push(`s${S}/${b.id} ${end} CLAMP BOUND: bank ${land} vs springing ${base}, gap ${gap} > ABUT_MAX ${ABUT_MAX}`) }
    }
  }
}
console.log(`seeds ${SEEDS.length} · crossing-ends ${ends}`)
console.log(`  flush ${flush} · half-step ${half} · FULL-BLOCK VAULT ${vault}`)
console.log(`  widest bank-to-springing gap seen: ${maxGap}   (ABUT_MAX = ${ABUT_MAX})`)
console.log(`  ends where the clamp BOUND: ${clampBound}`)
console.log(`  gap distribution: ${[...gapHist.entries()].sort((a,b)=>a[0]-b[0]).map(([g,n])=>`${g}:${n}`).join('  ')}`)
if(offenders.length) console.log(`  ⚠\n   ${offenders.slice(0,25).join('\n   ')}`)
