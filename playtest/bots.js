// Automated playtest harness for Sable Springs: scripted bot players drive the real game code
// through simTick() at many times real speed and log telemetry for analysis.
(function(){
const G=()=>window.__SS;
function rngS(seed){ return function(){ seed|=0; seed=seed+0x6D2B79F5|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
const ARCH=['story','side','chaos','burglar','turf','explorer','skyline','flood'];
const CTRL=['KeyW','KeyA','KeyS','KeyD','ShiftLeft','Space','Mouse0','KeyF'];
function keys(){ const K=G().K; for(const k of CTRL) K[k]=false; }
function press(code){ window.dispatchEvent(new KeyboardEvent('keydown',{code})); window.dispatchEvent(new KeyboardEvent('keyup',{code})); }
const hyp=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const wrap=a=>{ while(a>Math.PI)a-=2*Math.PI; while(a<-Math.PI)a+=2*Math.PI; return a; };

function resetSession(arch,rnd){
  const T=G(), S=T.S;
  T.leaveInteriorNow(); S.door=null;
  if(S.war){ for(const p of T.peds) if(p.gang===S.war.zone.id) p.hostile=false; S.war=null; }
  if(S.mission){ T.cleanupMission(); S.mission=null; }
  T.clearDeckGuards();
  if(S.mode==='car') T.exitCar(true);
  T.releaseHostage(true);
  for(const c of T.cops.slice()) T.removeCop(c);
  for(const m of T.crew) if(m.g.parent) m.g.parent.remove(m.g); T.crew.length=0;
  for(const z of T.GANG_ZONES){ if(z.hide) z.owned=false; }
  for(const p of T.peds){ if(p.gang&&p.gang!=='tower'&&p.zone&&!p.zone.noRespawn){ p.down=true; p.t=.05; p.hostile=false; } }
  T.resetEvents(); for(const pr of T.PROPS) pr.owned=false; S.garageCars=[]; S.upg={};
  const FL=T.FL; FL.active=false; FL.level=0; FL.front=-9999; FL.draining=false; FL.drainAt=0; T.restoreDam();
  Object.assign(S,{heat:0,evade:0,bust:0,hp:100,armor:0,money:800,bag:[],dirt:[],parts:2,climb:null,deck:null,chute:false,chuteLanded:false,swim:false,
    side:null,sideCd:2,pick:null,hold:null,witness:null,rob:null,wp:null,x:T.spawn.x,z:T.spawn.z,a:0,yaw:0,pitch:-.1,vx:0,vz:0,vy:0,py:0,gy:.25,fireCd:0,reloadT:0,view:'third',aiming:false,hostage:null});
  S.story=arch==='story'?Math.floor(rnd()*5):0;
  S.owned={fists:1,pistol:1}; S.ammo={pistol:96,smg:0,shotgun:0}; S.mag={pistol:12}; S.weapon=1;
  if(arch==='chaos'||arch==='turf'||arch==='flood'||arch==='skyline'){ S.owned.smg=1; S.ammo.smg=240; S.mag.smg=30; S.owned.grenade=1; S.ammo.grenade=4; S.weapon=2; }
  keys();
}

function nearCar(r,boats){
  const T=G(),S=T.S; let best=null,bd=r;
  for(const c of [...T.parked,...T.traffic]){ if(c.wreck) continue; if(!!boats!==(c.kind==='boat')) continue; const d=hyp(c,S); if(d<bd){ bd=d; best=c; } }
  return best;
}
function aimAt(tx,ty,tz){ const T=G(), c=T.camera.position, S=T.S; S.yaw=Math.atan2(tx-c.x,tz-c.z); S.pitch=Math.max(-1.1,Math.min(1,Math.atan2(ty-c.y,Math.hypot(tx-c.x,tz-c.z)))); S.lookT=0; }
function hostileNear(r){
  const T=G(),S=T.S; let best=null,bd=r;
  for(const p of T.peds){ if(p.down||p.held) continue; if(!((p.gang&&p.hostile)||p.angry||(p.indoor&&S.witness&&S.witness.p===p))) continue; if((p.deckY!=null)!==(!!S.deck)) continue; const d=hyp(p,S); if(d<bd){ bd=d; best=p; } }
  return best;
}
function fight(){
  const T=G(),S=T.S; const h=hostileNear(34);
  if(!h||S.mode!=='foot'||S.swim||S.climb){ T.K.Mouse0=false; return false; }
  const w=T.curW(); if(w.melee||w.throw) T.selectWeapon(S.owned.smg?2:1);
  if(!T.curW().melee&&(S.mag[T.curW().id]||0)===0) press('KeyR');
  aimAt(h.x,(h.deckY!=null?h.deckY:(h.indoor?0:.25))+1.35,h.z); T.K.Mouse0=true;
  return true;
}
// simple feelers: if the straight line is blocked, try angles either side
function steer(yaw,look,y,base){
  const T=G(),S=T.S, ox=base==null?S.x:S.car.x, oz=base==null?S.z:S.car.z;
  for(const off of [0,.45,-.45,.9,-.9,1.4,-1.4,2,-2]){ const a=yaw+off; if(T.rayWall(ox,oz,Math.sin(a),Math.cos(a),look,y)>=look-.05) return a; }
  return yaw;
}
// steer toward a point on foot, in a car, or in a boat
function goTo(tx,tz,mem,o){
  o=o||{}; const T=G(),S=T.S, d=Math.hypot(tx-S.x,tz-S.z);
  mem.wantMove=d>(o.near||2.2);
  if(!mem.wantMove){ if(S.mode==='car'){ T.K.KeyS=S.car.v>1.5; } return d; }
  if(mem.unstick>0){ mem.unstick-=8/30; if(S.mode==='car'){ T.K.KeyS=true; T.K.KeyA=true; } else { S.yaw+=.9; T.K.KeyW=true; if(S.py<=0) T.K.Space=true; } return d; }
  if(S.mode==='foot'){
    const wantCar=o.needCar||(o.car!==false&&d>130&&!S.inside&&!S.deck&&!S.climb&&!o.foot);
    if(wantCar){ const c=nearCar(o.needCar?60:30,!!o.boat); if(c){ const dc=hyp(c,S); if(dc<3.6){ press('KeyE'); return d; } S.yaw=Math.atan2(c.x-S.x,c.z-S.z); T.K.KeyW=true; T.K.ShiftLeft=true; mem.target='car'; return d; } }
    S.yaw=steer(Math.atan2(tx-S.x,tz-S.z),Math.min(4,d),S.gy+.3); S.pitch=-.1; T.K.KeyW=true; T.K.ShiftLeft=d>6;
  } else {
    if(o.foot&&d<28){ if(Math.abs(S.car.v)<6){ press('KeyE'); } else T.K.KeyS=true; return d; }
    const c=S.car, want=steer(Math.atan2(tx-c.x,tz-c.z),Math.min(12,d),1,c.a), diff=wrap(want-c.a);
    if(Math.abs(diff)>1.7&&Math.abs(c.v)<10){ T.K.KeyS=true; T.K.KeyD=diff>0; T.K.KeyA=diff<0; }
    else { T.K.KeyA=diff>.08; T.K.KeyD=diff<-.08; const slow=(d<22&&!o.ram)||Math.abs(diff)>.7; T.K.KeyW=!slow||c.v<7; T.K.KeyS=slow&&c.v>15; T.K.Space=Math.abs(diff)>1&&c.v>16; if(o.ram) T.K.ShiftLeft=true; }
  }
  return d;
}
function wander(mem,rnd){
  const T=G(),S=T.S;
  if(!mem.wp||hyp(mem.wp,S)<12||(mem.wpT=(mem.wpT||0)+1)>900){ const b=T.blocks[Math.floor(rnd()*T.blocks.length)]; mem.wp={x:b.x0-3,z:b.cz+(rnd()-.5)*30}; mem.wpT=0; }
  goTo(mem.wp.x,mem.wp.z,mem);
}
function leaveIfInside(mem){
  const T=G(),S=T.S; if(!S.inside) return false;
  const I=T.INTS[S.inside], a=I.acts.find(x=>x.label==='Leave');
  if(goTo(a.x,a.z,mem,{near:1.6})<1.7){ mem.wantMove=false; T.useInteract(); }
  return true;
}
function clickMenu(i){ const b=document.querySelectorAll('#mList button')[i||0]; if(b&&!b.disabled) b.click(); G().closeMenu(); }

// one mission step, shared by the story, side-job, flood and skyline players
function missionAct(mem,rnd){
  const T=G(),S=T.S,m=S.mission, st=m.def.steps[m.step]; if(!st) return;
  if(st.k==='lose'||(S.heat>=2&&st.k!=='countdown'&&m.def.title!=='High Water')){
    if(!mem.flee||hyp(mem.flee,S)<20){ const a=rnd()*Math.PI*2; mem.flee={x:S.x+Math.cos(a)*200,z:S.z+Math.sin(a)*200}; mem.flee.x=Math.max(-340,Math.min(340,mem.flee.x)); mem.flee.z=Math.max(-340,Math.min(340,mem.flee.z)); }
    if(st.k==='lose'||S.heat>=3){ goTo(mem.flee.x,mem.flee.z,mem,{needCar:true}); return; }
  }
  if(st.k==='countdown'){ mem.wantMove=false; return; }
  if(st.k==='board'){ const b=nearCar(45,true); if(b&&hyp(b,S)<45){ if(goTo(b.x,b.z,mem,{near:3,car:false})<3.6&&S.mode==='foot') press('KeyE'); } else goTo(T.DOCK.x,T.DOCK.z,mem,{needCar:S.mode==='foot'}); return; }
  const t=T.guideTarget();
  if(st.k==='steal'&&m.extra.vesper){ const v=m.extra.vesper; if(S.mode==='car'&&S.car!==v){ goTo(v.x,v.z,mem,{foot:true}); return; } if(goTo(v.x,v.z,mem,{near:3,car:false})<3.6) press('KeyE'); return; }
  if(st.k==='chase'&&m.extra.limo){ goTo(m.extra.limo.x,m.extra.limo.z,mem,{needCar:true,ram:true}); if(S.mode==='foot'&&hyp(m.extra.limo,S)<30) fight(); return; }
  if(t){ goTo(t.x,t.z,mem,{needCar:!!(st.car||st.vesper),boat:!!st.boat,foot:!!st.foot,near:(st.r||5)*.5}); return; }
  wander(mem,rnd);
}

function think(arch,mem,rnd){
  const T=G(),S=T.S; keys(); mem.wantMove=false;
  if(S.paused) T.closeMenu();
  if(S.hold||S.pick){ if(fight()) {} return; }
  // generic: anyone in a hostile spot shoots back
  const fighting=S.mode==='foot'&&!S.climb&&fight();
  // between jobs, bots react to street events and invest spare cash, as a player would
  if(!S.mission&&!S.inside&&!S.war&&!S.deck&&!S.climb){
    const pr=T.PROPS.filter(p=>!p.owned).sort((a,b)=>a.price-b.price)[0];
    if(pr&&S.money>=pr.price+800){ if(goTo(pr.x,pr.z+1,mem,{foot:true,near:1.2})<1.7&&S.mode==='foot'){ mem.wantMove=false; T.useInteract(); } return; }
    const E=T.EV;
    if(E&&['story','side','explorer','chaos','burglar','turf'].includes(arch)&&!(arch==='burglar'&&S.bag.length>=5)){
      if(E.kind==='armored'){ const d=Math.hypot(E.x-S.x,E.z-S.z); if(S.mode==='car'&&d<30){ if(Math.abs(S.car.v)<6) press('KeyE'); else T.K.KeyS=true; return; } if(S.mode==='foot'&&d<34){ if(T.curW().melee||T.curW().throw) T.selectWeapon(S.owned.smg?2:1); if((S.mag[T.curW().id]||0)===0) press('KeyR'); aimAt(E.x,1.2,E.z); T.K.Mouse0=true; if(d>18) goTo(E.x,E.z,mem,{car:false}); return; } goTo(E.x,E.z,mem); return; }
      if(E.kind==='crash'){ const it=T.loot.filter(o=>Math.hypot(o.x-E.x,o.z-E.z)<9).sort((a,b)=>hyp(a,S)-hyp(b,S))[0]; if(it){ goTo(it.x,it.z,mem,{foot:Math.hypot(it.x-S.x,it.z-S.z)<30,near:.8}); return; } }
      if(!fighting) goTo(E.x,E.z,mem,{foot:Math.hypot(E.x-S.x,E.z-S.z)<35,near:5});
      return;
    }
  }
  switch(arch){
    case 'story': case 'side': {
      if(S.inside&&leaveIfInside(mem)) return;
      if(S.mission){ missionAct(mem,rnd); break; }
      if(arch==='story'&&S.story<T.STORY.length){ const t=T.guideTarget(); if(t){ const d=goTo(t.x,t.z,mem); if(d<4.2&&S.mode==='foot'&&T.nearMissionMarker&&T.nearMissionMarker()) press('KeyE'); break; } }
      if(S.side) { goTo(S.side.at.x,S.side.at.z,mem,{needCar:true}); break; }
      wander(mem,rnd); break;
    }
    case 'chaos': {
      if(S.inside&&leaveIfInside(mem)) return;
      mem.phase=(mem.phase||0)+1;
      const cyc=mem.phase%120;
      if(cyc<70){ wander(mem,rnd); if(S.mode==='foot'&&!mem.wantMove) {} }
      else {
        if(S.mode==='car'){ if(Math.abs(S.car.v)<6) press('KeyE'); else T.K.KeyS=true; break; }
        let best=null,bd=22; for(const p of T.peds){ if(p.down||p.held||p.gang||p.indoor) continue; const d=hyp(p,S); if(d<bd){ bd=d; best=p; } }
        if(best){ if(rnd()<.05&&(S.ammo.grenade||0)>0){ T.selectWeapon(4); aimAt(best.x,1,best.z); T.K.Mouse0=true; } else { if(T.curW().throw||T.curW().melee) T.selectWeapon(S.owned.smg?2:1); aimAt(best.x,1.5,best.z); T.K.Mouse0=true; } }
        else if(!fighting) wander(mem,rnd);
      }
      break;
    }
    case 'burglar': {
      if(S.inside==='pawn'){ const a=T.INTS.pawn.acts[0]; if(goTo(a.x,a.z,mem,{near:1.6})<1.8){ mem.wantMove=false; T.useInteract(); clickMenu(0); mem.sold=true; } if(mem.sold&&!S.bag.length) leaveIfInside(mem); break; }
      if(S.inside==='apt'){
        if(S.witness){ fight(); break; }
        const acts=T.INTS.apt.acts.filter(a=>!a.hidden&&a.label!=='Leave');
        if(acts.length&&S.bag.length<10){ const a=acts[0]; if(goTo(a.x,a.z,mem,{near:1.5})<1.7){ mem.wantMove=false; T.useInteract(); } }
        else leaveIfInside(mem);
        break;
      }
      if(S.inside&&leaveIfInside(mem)) return;
      mem.sold=false;
      if(S.bag.length>=5){ const d=T.DOORS.find(x=>x.int==='pawn'); if(goTo(d.fx,d.fz,mem,{foot:true,near:1.2})<1.6&&S.mode==='foot'){ mem.wantMove=false; T.useInteract(); } break; }
      mem.visited=mem.visited||new Set();
      let best=null,bd=1e9; T.DOORS.forEach((d,i)=>{ if(d.kind!=='apt'||mem.visited.has(i)) return; const dd=Math.hypot(d.fx-S.x,d.fz-S.z); if(dd<bd){ bd=dd; best=i; } });
      if(best==null){ wander(mem,rnd); break; }
      const d=T.DOORS[best];
      if(goTo(d.fx,d.fz,mem,{foot:true,near:1.2})<1.6&&S.mode==='foot'){ mem.wantMove=false; T.useInteract(); mem.visited.add(best); }
      break;
    }
    case 'turf': {
      if(S.inside&&leaveIfInside(mem)) return;
      if(S.war&&S.war.stage==='flag'){ const z=S.war.zone; if(goTo(z.hide.x+1.2,z.hide.z+1.3,mem,{foot:true,near:1.2})<1.8){ mem.wantMove=false; T.useInteract(); } break; }
      if(S.war){ if(!fighting) goTo(S.war.zone.hide.x,S.war.zone.hide.z,mem,{foot:true,near:8}); break; }
      mem.recT=(mem.recT||0)+8/30;
      if(T.crew.length<3&&S.money>=200&&mem.recT<45){ const n=T.peds.filter(p=>!p.down&&!p.gang&&!p.vip&&!p.indoor&&Math.hypot(p.x-S.x,p.z-S.z)<7).length; if(n&&S.mode==='foot'){ T.recruit(); break; } if(S.mode==='car'){ if(Math.abs(S.car.v)<6) press('KeyE'); break; } wander(mem,rnd); break; }
      const z=T.GANG_ZONES.filter(z=>z.hide&&!z.owned).sort((a,b)=>hyp(a.hide,S)-hyp(b.hide,S))[0];
      if(z) goTo(z.hide.x,z.hide.z,mem,{foot:true,near:6}); else wander(mem,rnd);
      break;
    }
    case 'explorer': {
      if(S.inside&&leaveIfInside(mem)) return;
      if(!mem.wp||hyp(mem.wp,S)<12||(mem.wpT=(mem.wpT||0)+1)>1500){ mem.wp={x:-340+rnd()*680,z:-340+rnd()*680}; mem.wpT=0; }
      goTo(mem.wp.x,mem.wp.z,mem); break;
    }
    case 'skyline': {
      if(S.inside&&leaveIfInside(mem)) return;
      const m=S.mission;
      if(S.climb){ T.K.KeyW=true; T.K.ShiftLeft=true; mem.wantMove=true; break; }
      if(m&&m.def.title==='Skyline'){
        if(m.step===0){ const a=T.WACTS[T.WACTS.length-3]; if(goTo(T.TOWER.x+14.4,T.TOWER.z,mem,{foot:true,near:1.2})<1.8&&S.mode==='foot'){ mem.wantMove=false; T.useInteract(); } }
        else if(m.step===1){ if(!fighting&&goTo(T.TOWER.x+1.5,T.TOWER.z,mem,{near:1.2})<1.8){ mem.wantMove=false; T.useInteract(); } }
        else if(m.step>=2){ if(S.deck) goTo(T.TOWER.x+25,T.TOWER.z+3,mem,{near:.5}); else { if(S.py>6&&!S.chute) press('Space'); T.K.KeyW=true; } }
        break;
      }
      if(!m&&!mem.done){ if(goTo(T.SKY_START.x,T.SKY_START.z,mem,{foot:true,near:1})<3.2&&S.mode==='foot') press('KeyE'); break; }
      if(m) { missionAct(mem,rnd); break; }
      wander(mem,rnd); break;
    }
    case 'flood': {
      if(S.inside&&leaveIfInside(mem)) return;
      const m=S.mission;
      if(m&&m.def.title==='High Water'){ if(!fighting||m.def.steps[m.step].k==='board'||m.def.steps[m.step].k==='goto'&&m.step===5) missionAct(mem,rnd); break; }
      if(m){ missionAct(mem,rnd); break; }
      if(!mem.done){ if(goTo(T.FLOOD_START.x,T.FLOOD_START.z,mem,{foot:true,near:1})<4&&S.mode==='foot') press('KeyE'); break; }
      wander(mem,rnd); break;
    }
  }
  if(fighting) { mem.wantMove=mem.wantMove||false; }
}

function summarize(arch,idx,st,TEL){
  const c=type=>TEL.filter(e=>e.type===type);
  const money=c('money'), earned=money.filter(e=>e.n>0).reduce((a,e)=>a+e.n,0), spent=-money.filter(e=>e.n<0).reduce((a,e)=>a+e.n,0);
  const fr=money.find(e=>e.n>0);
  const meaningful=TEL.filter(e=>['mission_start','mission_done','loot','enter','turf_taken','war_start','car_enter','ped_down','blackmail','recruit','event','event_done','buy'].includes(e.type)||(e.type==='money'&&e.n>0)).map(e=>e.t);
  let gap=0,prev=0; for(const t of meaningful){ gap=Math.max(gap,t-prev); prev=t; } gap=Math.max(gap,st.dur-prev);
  const types=new Set(TEL.map(e=>e.type==='money'?null:e.type).filter(Boolean));
  return {arch,idx,dur:st.dur,deaths:c('death').length,busts:c('bust').length,deathPts:c('death').slice(0,3).map(e=>[e.x,e.z]),
    mStart:c('mission_start').length,mDone:c('mission_done').length,mFail:c('mission_fail').length,
    done:c('mission_done').map(e=>e.title),started:c('mission_start').map(e=>e.title),fails:c('mission_fail').map(e=>e.title+': '+e.why+' @'+e.step),
    earned,spent,maxHeat:st.maxHeat,shots:TEL.shots||0,cars:c('car_enter').length,pedsDown:c('ped_down').length,gangDown:c('ped_down').filter(e=>e.gang).length,
    interiors:c('enter').length,loots:c('loot').length,turfs:c('turf_taken').length,wars:c('war_start').length,warLost:c('war_end').filter(e=>!e.won).length,
    recruits:c('recruit').reduce((a,e)=>a+e.n,0),buys:c('buy').length,buySpend:c('buy').reduce((a,e)=>a+e.price,0),evStart:c('event').length,evDone:c('event_done').length,blackmail:c('blackmail').length,stuck:st.stuck.length,stuckPts:st.stuck.slice(0,4).map(p=>[p.x,p.z,p.mode[0]+(p.inside?'i':'')]),teleports:st.teleports||0,
    distFoot:Math.round(st.distFoot),distCar:Math.round(st.distCar),carShare:Math.round(st.timeCar/st.dur*100),firstReward:fr?fr.t:null,
    eventsPerMin:Math.round(TEL.filter(e=>e.type!=='money').length/(st.dur/60)*10)/10,maxGap:Math.round(gap),systems:types.size,errors:st.errors.slice(0,3)};
}

window.runSession=function(arch,idx,minutes){
  const T=G(), S=T.S, rnd=rngS(7919*idx+13);
  window.__FASTFADE=true; S.playing=true; S.paused=false; document.getElementById('ov').hidden=true;
  resetSession(arch,rnd);
  const TEL=window.__TEL=[]; TEL.on=true; window.__SST=0; TEL.shots=0;
  const st={stuck:[],errors:[],distFoot:0,distCar:0,timeCar:0,maxHeat:0,dur:minutes*60};
  const mem={}, dt=1/30, steps=Math.round(minutes*60*30);
  let px=S.x,pz=S.z,cx=S.x,cz=S.z,checkT=0,stuckT=0;
  for(let i=0;i<steps;i++){
    if(i%8===0){ try{ think(arch,mem,rnd); }catch(e){ st.errors.push('bot: '+(e&&e.message||e)); } }
    try{ T.simTick(dt); }catch(e){ st.errors.push(String(e&&e.message||e).slice(0,140)); if(st.errors.length>30) break; }
    const d=Math.hypot(S.x-px,S.z-pz); if(d<60){ if(S.mode==='car'){ st.distCar+=d; st.timeCar+=dt; } else st.distFoot+=d; } px=S.x; pz=S.z;
    if(S.heat>st.maxHeat) st.maxHeat=S.heat;
    checkT+=dt;
    if(checkT>=2){ checkT=0;
      if(mem.wantMove&&!S.climb&&Math.hypot(S.x-cx,S.z-cz)<1.5){ stuckT+=2; if(stuckT>=6){ st.stuck.push({x:Math.round(S.x),z:Math.round(S.z),mode:S.mode,inside:!!S.inside}); stuckT=0; mem.unstick=2.5; mem.unN=(mem.unN||0)+1; if(mem.unN>=3){ S.x+=(rnd()-.5)*24; S.z+=(rnd()-.5)*24; if(S.car){ S.car.x=S.x; S.car.z=S.z; } st.teleports=(st.teleports||0)+1; mem.unN=0; } } }
      else { stuckT=0; mem.unN=0; }
      cx=S.x; cz=S.z;
    }
    if(S.mission==null&&(arch==='skyline'||arch==='flood')){ const last=TEL.length&&TEL[TEL.length-1]; if(last&&last.type==='mission_done') mem.done=true; }
  }
  TEL.on=false; keys();
  return summarize(arch,idx,st,TEL);
};
window.runAllAsync=function(n,minutes,archList){
  const LIST=archList||ARCH;
  window.__RESULTS=[]; window.__PROGRESS={done:0,n,start:performance.now()};
  const ch=new MessageChannel(); let i=0;
  ch.port1.onmessage=()=>{ if(i>=n){ window.__PROGRESS.finished=true; window.__PROGRESS.ms=Math.round(performance.now()-window.__PROGRESS.start); return; }
    const arch=LIST[i%LIST.length]; try{ window.__RESULTS.push(window.runSession(arch,i,minutes)); }catch(e){ window.__RESULTS.push({arch,idx:i,crash:String(e&&e.message||e)}); }
    i++; window.__PROGRESS.done=i; ch.port2.postMessage(0); };
  ch.port2.postMessage(0); return 'started';
};
window.runBatch=function(from,to,minutes){
  window.__RESULTS=window.__RESULTS||[];
  const t0=performance.now();
  for(let i=from;i<to;i++){ const arch=ARCH[i%ARCH.length]; try{ window.__RESULTS.push(window.runSession(arch,i,minutes)); }catch(e){ window.__RESULTS.push({arch,idx:i,crash:String(e&&e.message||e)}); } }
  return {ran:to-from,ms:Math.round(performance.now()-t0),total:window.__RESULTS.length};
};
})();
