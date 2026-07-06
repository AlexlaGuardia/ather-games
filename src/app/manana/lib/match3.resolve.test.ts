// combo → full resolve pipeline (varied rng). run: npx tsx src/app/manana/lib/match3.resolve.test.ts
import { W, H, idx, gem, swapDetonation, resolve, type Cell, type Kind } from './match3'
let seed = 987654321
const rng = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
const blank = (): Cell[] => Array.from({ length: W * H }, () => gem(Math.floor(rng() * 6)))
function fire(kA: Kind, cA: number, kB: Kind, cB: number, paint: {i:number,color:number}[]=[]) {
  const a = idx(3,3), c = idx(4,3)
  const b = blank(); for (const p of paint) b[p.i] = gem(p.color)
  b[a] = {color:cA,kind:kA}; b[c] = {color:cB,kind:kB}
  const det = swapDetonation(b,a,c,rng)!
  const res = resolve(det.board, rng, { forced: det.forced })
  return { steps: res.steps.length, first: res.steps[0].matched.length, boardOk: res.board.length===W*H && res.board.every(x=>x.color>=0) }
}
let ok=0, bad=0; const chk=(n:string,c:boolean,x='')=>{c?ok++:(bad++,console.error('FAIL',n,x))}
const pp = fire('prism',3,'prism',5); chk('prism+prism resolves clean', pp.steps>=1 && pp.boardOk, JSON.stringify(pp))
const ps = fire('prism',0,'surgeH',7,[10,11,12,20,21,40].map(i=>({i,color:7}))); chk('prism+surge resolves clean', ps.steps>=1 && ps.boardOk, JSON.stringify(ps))
const ss = fire('star',1,'star',2); chk('star+star resolves clean', ss.steps>=1 && ss.boardOk, JSON.stringify(ss))
const su = fire('surgeH',1,'surgeV',2); chk('surge+surge resolves clean', su.steps>=1 && su.boardOk, JSON.stringify(su))
console.log(`\ncombo resolve pipeline: ${ok} passed, ${bad} failed`)
if(bad)process.exit(1)
