const A=process.cwd() + '/src/app/shimmer/open/ather/'
const C=await import(A+'combat.ts'), W=await import(A+'wilds-sim.ts'), CH=await import(A+'champion.ts'), G=await import(process.cwd() + '/src/app/shimmer/open/shared/gunplay.ts')
const ALL=['repeater','roar','lance','charred-rifle'], seeds=Array.from({length:200},(_,i)=>1001+i*13)
const orig=new Map(G.RANGE_GUNS.map((g:any)=>[g.id,{...g}]))
const OLD={gun:{fireCd:.16}} // the Repeater before M151
const H={...C.SHAMBLER},F={...C.FLOATER},K={...C.CRAWLER},CP={...CH.CHAMP},WH={...CH.WAVE_HP}
function row(label:string,gun:string,hold:string[],shell:boolean,o:any={}){
  C.M151.hold=hold;C.M151.shell=shell;W.SIM.gun=gun
  const g=G.RANGE_GUNS.find((x:any)=>x.id===gun);Object.assign(g,orig.get(gun),o.gun??{})
  Object.assign(C.SHAMBLER,H,{hp:Math.round(H.hp*(o.hp??1)),damage:Math.round(H.damage*(o.dmg??1))});Object.assign(C.FLOATER,F,{hp:Math.round(F.hp*(o.hp??1)),damage:Math.round(F.damage*(o.dmg??1))});Object.assign(C.CRAWLER,K,{hp:Math.round(K.hp*(o.hp??1)),damage:Math.round(K.damage*(o.dmg??1))});Object.assign(CH.CHAMP,CP,{barHp:Math.round(CP.barHp*(o.champ??o.hp??1))});Object.assign(CH.WAVE_HP,{shambler:Math.round(WH.shambler*(o.hp??1)),floater:Math.round(WH.floater*(o.hp??1))})
  const out:string[]=[]
  for(const trio of [false,true]){W.SIM.trio=trio
   const p=W.summarise(seeds.map(s=>W.packFight(s,['shambler','shambler','shambler','floater'],C.groupPack)))
   const p2=W.summarise(seeds.map(s=>W.packFight(s,['shambler','shambler','shambler','shambler','shambler','floater','crawler','crawler'],C.groupPack)))
   const c=W.summarise(seeds.map(s=>W.championFight(s,3)));out.push(`pack4 d${p.died} ${p.secs}s hurt${p.taken} | pack8 d${p2.died} ${p2.secs}s hurt${p2.taken} | champ d${c.died} ${c.secs}s hurt${c.taken} unfin${c.n-c.cleared-c.died}`)}
  console.log(label.padEnd(34),'ALONE',out[0],' TRIO',out[1]);W.SIM.trio=false}
const step=process.argv[2]
if(step==='a'){
row('repeater today','repeater',[],false,OLD);row('repeater hold 0.16','repeater',['repeater'],false,OLD);row('repeater SHIPPED','repeater',ALL,true);
for(const g of ['spitter','backbone'])row(g+' (unchanged)',g,[],false)
for(const g of ['lance','charred-rifle','roar']){row(g+' today',g,[],false);row(g+' hold',g,ALL,false)}
row('roar today+pellets/shove (tap)','roar',[],true);row('roar hold+pellets','roar',ALL,true,{gun:{shove:0}});row('roar hold+pellets+shove','roar',ALL,true)}
if(step==='b'){
for(const cd of [.2,.22,.25])row('rep hold cd '+cd,'repeater',['repeater'],false,{gun:{fireCd:cd}})
for(const d of [8,7])row('rep hold dmg '+d,'repeater',['repeater'],false,{gun:{damage:d,crit:Math.round(d*1.6)}})
for(const hp of [1.15,1.25,1.35])row('rep hold, all hollow hp x'+hp,'repeater',['repeater'],false,{hp})
for(const hp of [1.15,1.25])row('rep hold, hollow x1.35 champ x'+hp,'repeater',['repeater'],false,{hp:1.35,champ:hp})
for(const dmg of [1.15,1.3,1.5])row('rep hold, hollow dmg x'+dmg,'repeater',['repeater'],false,{dmg})
}
if(step==='d'){ // dps: no targets, 30 s of fire with reload and the first clip alone
 for(const g of G.RANGE_GUNS)for(const [l,hold,shell] of [['today tap4',[],false],['held',ALL,true]] as any){C.M151.hold=hold;C.M151.shell=shell
  const c=C.newCombat(5);c.gun=g;c.keeper.ammo=g.clip;let dmg=0,first=0,ft=0,mana=0,t=0;const ch=g.charge??0
  for(;t<60;t+=1/240){const e={x:0,y:1.6,z:0},a={x:0,y:0,z:-1};const n0=c.rounds.length,r0=c.keeper.reloading>0
   if(C.heldGun(g))C.stepTrigger(c,e,a,false,true,1/240);else if(c.keeper.sinceShot>=Math.max((l==='held'||g.auto)?0:.25,ch?g.fireCd+ch:0)-1e-6)C.fire(c,e,a)
   if(c.rounds.length>0){dmg+=c.rounds.reduce((s:any,r:any)=>s+r.dmg,0);c.rounds=[]}
   if(!r0&&c.keeper.reloading>0){mana++;if(!first){first=dmg;ft=t}}
   C.stepCombat(c,W.FLAT,{x:0,y:0,z:0},1/240)}
  const perShot=first/g.clip;console.log(g.id.padEnd(14),l.padEnd(11),'clip dps',((first-perShot)/ft).toFixed(1),'with reload',(dmg/t).toFixed(1),'reloads/min',mana)}}
