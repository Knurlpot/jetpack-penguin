const AS={idle:'assets/penguin_idle.png',boost:'assets/penguin_boost.png',over:'assets/gameover_bg.jpg',sw:282,sh:190};
const PILLAR='assets/rocks_pillar.jpeg';
const SKINS=[
 {id:'classic',name:'CLASSIC',idle:AS.idle,boost:AS.boost,background:'assets/cave.jpg',titleBackground:'assets/homepage_bg.jpeg'},
];
// ---- TWEAK ME ----
let W=960,H=540,portrait=false; // responsive game coordinates
const GAP=205;          // vertical gap between stalactite and stalagmite
const OW=130;           // obstacle width
// Speed brackets based on score:
// 0-15: normal (210 px/s)
// 16-40: noticeably brisker (scales smoothly from 210 -> 265 px/s)
// 41-60: fast (scales smoothly from 265 -> 330 px/s)
// 60+: max (360 px/s)
function getSpeed(){
 if(score<=15) return 210;
 if(score<=40) return 210 + (score-15)*(55/25);
 if(score<60)  return 265 + (score-40)*(65/20);
 return 360;
}
const SPACE=340;        // distance between obstacles
const G=1450;           // gravity
const THRUST=3200;       // jetpack upward thrust acceleration when holding
const MAX_RISE_SPEED=-420;
const FLAP=-360;
const S=0.5;            // penguin sprite scale
const PX=205,PY=85;     // original sprite pivot
const R=21;             // penguin hitbox radius
const cv=document.getElementById('c'),ctx=cv.getContext('2d');
const FONT='"Press Start 2P",monospace';
const IM={};let best=0;
let selectedSkinIndex=0;
try{
 const savedSkin=localStorage.getItem('jp_skin');
 const savedIndex=SKINS.findIndex(skin=>skin.id===savedSkin);
 if(savedIndex>=0)selectedSkinIndex=savedIndex;
}catch(e){console.warn('Could not load the saved penguin skin',e)}
function getSkin(){return SKINS[selectedSkinIndex]}
function selectSkin(index){
 selectedSkinIndex=(index+SKINS.length)%SKINS.length;
 try{localStorage.setItem('jp_skin',getSkin().id)}catch(e){console.warn('Could not save the penguin skin',e)}
 document.body.dataset.scene=getSkin().id;
}
// Keep the best score across refreshes for this tab's session.
try{best=+sessionStorage.getItem('jp_best')||0}catch(e){}
let state='title',t=0,bgx=0,pen,obs,score,boostT,deadT,overT,ac,holding=false;
let deathLeaderboardTimer=null;

// ---- LEADERBOARD  (Vercel KV via /api/scores) ----
async function lbPost(name, s) {
  try {
    await fetch('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.toUpperCase().slice(0, 10), score: s }),
    });
  } catch (e) { console.warn('lbPost failed', e); }
  // keep session-best in sync
  if (s > best) { best = s; try { sessionStorage.setItem('jp_best', best); } catch (e) {} }
}
// UI refs
const nameModal=document.getElementById('name-modal');
const lbModal=document.getElementById('lb-modal');
const trophyBtn=document.getElementById('trophy-btn');
const playerNameInput=document.getElementById('player-name');
const modalScoreEl=document.getElementById('modal-score');
const lbList=document.getElementById('lb-list');
const deathLbTimer=document.getElementById('death-lb-timer');
const deathLbScore=document.getElementById('death-lb-score');

function showNameModal(s){
 modalScoreEl.textContent=s;
 playerNameInput.value='';
 nameModal.classList.add('death-name-entry');
 nameModal.classList.remove('hidden');
 setTimeout(()=>playerNameInput.focus(),60);
}
function hideNameModal(){nameModal.classList.add('hidden');nameModal.classList.remove('death-name-entry')}
function showGameOver(){
 hideNameModal();
 hideLbModal();
 lbModal.classList.remove('death-leaderboard');
 if(deathLbTimer)deathLbTimer.classList.add('hidden');
 if(deathLbScore)deathLbScore.classList.add('hidden');
 if(deathLeaderboardTimer){clearTimeout(deathLeaderboardTimer);deathLeaderboardTimer=null}
 state='over';
 overT=0;
 updateTrophyVisibility();
}

async function showLbModal(instant=false){
 if(!instant)lbList.innerHTML='<p class="lb-empty">Loading...</p>';
 else if(!lbList.innerHTML.trim())lbList.innerHTML='<p class="lb-empty">No scores yet.</p>';
 lbModal.classList.remove('hidden');
 try{
  const res=await fetch('/api/scores');
  const board=await res.json();
  if(!Array.isArray(board)||board.length===0){
   lbList.innerHTML='<p class="lb-empty">No scores yet.<br>Be the first!</p>';
  }else{
   const starClass=['star-1','star-2','star-3'];
   lbList.innerHTML=board.map((e,i)=>`
    <div class="lb-row">
     <span class="lb-rank">${i<3?`<span class="star-sprite ${starClass[i]}"></span>`:'#'+(i+1)}</span>
     <span class="lb-name">${e.name}</span>
     <span class="lb-score">${e.score}</span>
    </div>`).join('');
  }
 }catch(err){
  lbList.innerHTML='<p class="lb-empty">Could not load scores.<br>Try again later.</p>';
 }
}
function hideLbModal(){lbModal.classList.add('hidden')}

function finishDeathLeaderboard(){
 if(state!=='leaderboard')return;
 if(deathLeaderboardTimer){clearTimeout(deathLeaderboardTimer);deathLeaderboardTimer=null}
 hideLbModal();lbModal.classList.remove('death-leaderboard');if(deathLbTimer)deathLbTimer.classList.add('hidden');if(deathLbScore)deathLbScore.classList.add('hidden');state='over';overT=0;updateTrophyVisibility();
}

function showDeathLeaderboard(){
 state='leaderboard';overT=0;lbModal.classList.add('death-leaderboard');if(deathLbScore){deathLbScore.textContent='SCORE: '+score;deathLbScore.classList.remove('hidden')}if(deathLbTimer){deathLbTimer.textContent='(5)';deathLbTimer.classList.remove('hidden')}showLbModal(true);
 deathLeaderboardTimer=setTimeout(finishDeathLeaderboard,5000);
}

lbModal.addEventListener('click',e=>{
 if(state==='leaderboard'){e.stopPropagation();finishDeathLeaderboard()}
});

function goToTitle(){state='title';overT=0;initTitlePen();updateTrophyVisibility()}

document.getElementById('btn-save').addEventListener('click',async ()=>{
 const n=playerNameInput.value.trim();
 if(!n)return playerNameInput.focus();
 hideNameModal();
 showDeathLeaderboard();
 lbPost(n,score);
});
document.getElementById('btn-skip').addEventListener('click',()=>{
 hideNameModal();
 showDeathLeaderboard();
});
playerNameInput.addEventListener('keydown',e=>{
 if(e.key==='Enter'){document.getElementById('btn-save').click();e.preventDefault();}
 if(e.key==='Escape'){document.getElementById('btn-skip').click();e.preventDefault();}
 e.stopPropagation(); // don't let Space/Enter trigger flap
});
trophyBtn.addEventListener('click',e=>{e.stopPropagation();showLbModal()});
document.getElementById('lb-close').addEventListener('click',e=>{
 e.preventDefault();
 e.stopPropagation();
 if(state==='leaderboard')finishDeathLeaderboard();
 else hideLbModal();
});
// Close lb modal on backdrop click
lbModal.addEventListener('click',e=>{if(e.target===lbModal)hideLbModal()});

function updateTrophyVisibility(){
 if(state==='title')trophyBtn.classList.remove('hidden');
 else trophyBtn.classList.add('hidden');
}
// ---- Title screen penguin animation ----
// Animate the selected skin on the title screen.
let titlePen={y:0,vy:0,boostT:0,flapTimer:1.2};
function initTitlePen(){titlePen={y:portrait?H*.52:H*.60,vy:0,boostT:.35,flapTimer:1.4}}
function updateTitlePen(dt){
 titlePen.flapTimer-=dt;
 if(titlePen.flapTimer<=0){titlePen.boostT=.25;titlePen.flapTimer=1.4+Math.random()*.8}
 titlePen.boostT=Math.max(0,titlePen.boostT-dt);
}
function skinSpriteBox(skin, targetW, targetH){
 const idle=skin.idle,boost=skin.boost;
 const maxW=Math.max(idle.width,boost.width),maxH=Math.max(idle.height,boost.height);
 const scale=Math.min(targetW/maxW,targetH/maxH);
 return {w:maxW*scale,h:maxH*scale};
}
function cowboySpriteBox(skin, targetW, targetH, boosted){
 const box=skinSpriteBox(skin,targetW,targetH);
 // The activated source has a larger visible canvas because of its flame.
 // Compensate so the penguin itself stays the same size in both states.
 // Match the Classic penguin's draw size (AS.sw*S by AS.sh*S).
 const scale=boosted?0.82:1;
 return {w:box.w*scale,h:box.h*scale};
}
function drawTitlePen(){
 const x=W/2;
 const shake=titlePen.boostT>0?Math.sin(performance.now()/35)*2.5:Math.sin(performance.now()/420)*1.2;
 ctx.save();ctx.translate(x+shake,titlePen.y+shake*.35);
 const rot=Math.sin(performance.now()/520)*.035+(titlePen.boostT>0?Math.sin(performance.now()/28)*.025:0);ctx.rotate(rot);
 const skin=IM[getSkin().id],img=titlePen.boostT>0?skin.boost:skin.idle;
 ctx.shadowColor='rgba(7,11,42,.95)';ctx.shadowBlur=8;ctx.shadowOffsetX=0;ctx.shadowOffsetY=4;
 ctx.filter='brightness(1.08) contrast(1.12) saturate(1.08)';
 if(getSkin().id==='classic'){
  const scale=portrait?1.1:1.25;
  ctx.drawImage(img,-PX*scale,-PY*scale,AS.sw*scale,AS.sh*scale);ctx.restore();return;
 }
 const box=cowboySpriteBox(skin,portrait?AS.sw*1.1:AS.sw*1.25,portrait?AS.sh*1.1:AS.sh*1.25,titlePen.boostT>0);
 ctx.drawImage(img,-box.w/2,-box.h/2,box.w,box.h);ctx.restore();
}
function loadImage(src){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Failed to load image: '+src));image.src=src})}
async function load(){
 IM.over=await loadImage(AS.over);
 IM.pillar=await loadImage(PILLAR);
 await Promise.all(SKINS.map(async skin=>{
  const [idle,boost,background,titleBackground]=await Promise.all([loadImage(skin.idle),loadImage(skin.boost),loadImage(skin.background),loadImage(skin.titleBackground||skin.background)]);
  IM[skin.id]={idle,boost,background,titleBackground};
 }));
}
// Mobile browsers can suspend audio until a completed tap unlocks it.
function unlockAudio(){
 try{
  ac=ac||new (window.AudioContext||window.webkitAudioContext)();
  if(ac.state!=='running')return ac.resume().catch(()=>{});
 }catch(e){}
}
function beep(f,d,type='square',v=.05){
 const ready=unlockAudio();
 const play=()=>{try{
  if(!ac||ac.state!=='running')return;
  const o=ac.createOscillator(),g=ac.createGain(),now=ac.currentTime;
  o.type=type;o.frequency.value=f;g.gain.setValueAtTime(v,now);
  g.gain.exponentialRampToValueAtTime(.001,now+d);
  o.connect(g);g.connect(ac.destination);
  o.onended=()=>{o.disconnect();g.disconnect()};o.start(now);o.stop(now+d);
 }catch(e){}};
 if(ready)ready.then(play);else play();
}
function reset(){pen={x:portrait?W*.25:230,y:H/2,vy:0};obs=[];score=0;boostT=0;t=0;for(let i=0;i<4;i++)addObs(W+260+i*SPACE)}
function addObs(x){
 const previous=obs.length?obs[obs.length-1].gapY:H/2;
 const gapY=portrait?Math.max(150,Math.min(H-150,previous+(Math.random()-.5)*240)):150+Math.random()*(H-300);
 obs.push({x,gapY,tx:Math.random(),passed:false})}
// Keep the full game visible; preserve the current run when the viewport changes.
function resize(){
 const bounds=cv.getBoundingClientRect(),oldW=W,oldH=H;
 portrait=window.matchMedia('(max-width: 768px) and (orientation: portrait)').matches;
 const nextW=portrait?540:960,nextH=portrait?Math.round(nextW*bounds.height/bounds.width):540;
 // Assigning canvas dimensions clears its pixels, even if the size is unchanged.
 if(W===nextW&&H===nextH&&cv.width===nextW&&cv.height===nextH)return;
 W=nextW;H=nextH;
 cv.width=W;cv.height=H;
 if(pen){pen.x=portrait?W*.25:230;pen.y=Math.max(24,Math.min(H-22,pen.y*H/oldH));
  obs.forEach(o=>{o.x=pen.x+(o.x-(oldW===960?230:oldW*.25))*W/oldW;o.gapY=Math.max(150,Math.min(H-150,o.gapY*H/oldH))})}
 bgx=0;
 if(IM.over&&SKINS.every(skin=>IM[skin.id]))draw();
}
window.addEventListener('resize',resize);
resize();
function poly(o,top){const h=top?o.gapY-GAP/2:H-(o.gapY+GAP/2),w=OW;
 // Soft, gently uneven edges without sharp pointed tips.
 const seed=Math.floor(o.tx*997)%17, sway=(seed%5)-2;
 const rel=[[0,-8],[w,-8],[w,h*.78],[w-3,h*.93],[w*.82+sway,h],[w*.18-sway,h],[3,h*.93],[0,h*.78]];
 return rel.map(([a,b])=>[o.x+a,top?b:H-b])}
function segDist(px,py,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy;let u=l?((px-a[0])*dx+(py-a[1])*dy)/l:0;u=Math.max(0,Math.min(1,u));return Math.hypot(px-a[0]-u*dx,py-a[1]-u*dy)}
function inPoly(px,py,p){let c=false;for(let i=0,j=p.length-1;i<p.length;j=i++){if((p[i][1]>py)!=(p[j][1]>py)&&px<(p[j][0]-p[i][0])*(py-p[i][1])/(p[j][1]-p[i][1])+p[i][0])c=!c}return c}
function hit(o){for(const top of [true,false]){const p=poly(o,top);if(inPoly(pen.x,pen.y,p))return true;for(let i=0;i<p.length;i++)if(segDist(pen.x,pen.y,p[i],p[(i+1)%p.length])<R)return true}return false}
function startThrust(){
 holding=true;
 if(state==='title'){reset();state='play';updateTrophyVisibility();pen.vy=FLAP;boostT=.18;beep(520,.08);return}
 if(state==='over'){if(overT>.3&&nameModal.classList.contains('hidden'))goToTitle();return}
 if(state==='leaderboard'){finishDeathLeaderboard();return}
 if(state==='dead')return;
 if(pen.vy>0)pen.vy=Math.min(pen.vy,FLAP*.7);else pen.vy=Math.max(MAX_RISE_SPEED,pen.vy+FLAP*.4);
 boostT=.2;beep(520,.08);
}
function stopThrust(){holding=false}
function die(){holding=false;state='dead';deadT=0;pen.vy=-200;beep(120,.35,'sawtooth',.07);if(score>best){best=score;try{sessionStorage.setItem('jp_best',best)}catch(e){}}}
function update(dt){
 const curSpeed=state==='play'?getSpeed():210;
 bgx=(bgx+(state==='dead'?0:curSpeed*.3)*dt)%(W*2);
 if(state==='title'){overT+=dt;updateTitlePen(dt);return}
 if(state==='over'){overT+=dt;return}
 if(state==='nameentry'||state==='leaderboard'){overT+=dt;if(state==='leaderboard'&&deathLbTimer)deathLbTimer.textContent='('+Math.max(1,Math.ceil(5-overT))+')';return}
 t+=dt;
 if(holding&&state==='play'){boostT=.1;pen.vy=Math.max(MAX_RISE_SPEED,pen.vy+(G-THRUST)*dt)}
 else{boostT=Math.max(0,boostT-dt);pen.vy+=G*dt}
 pen.y+=pen.vy*dt;
 if(state==='dead'){deadT+=dt;if(deadT>.8){overT=0;if(score>0){state='nameentry';showNameModal(score)}else showDeathLeaderboard()}return}
 if(pen.y<24){pen.y=24;pen.vy=Math.max(pen.vy,0)}
 if(pen.y>H-22){return die()}
 for(const o of obs){o.x-=curSpeed*dt;if(!o.passed&&o.x+OW<pen.x){o.passed=true;score++;beep(880,.1,'triangle',.06)}if(hit(o))return die()}
 if(obs[0].x<-OW-20){obs.shift();addObs(obs[obs.length-1].x+SPACE)}}
function sceneImage(img,x=0){
 const scale=Math.max(W/img.width,H/img.height),sw=W/scale,sh=H/scale;
 ctx.drawImage(img,(img.width-sw)/2,(img.height-sh)/2,sw,sh,x,0,W,H);
}
function cover(img,a=1){
 ctx.globalAlpha=a;
 if(portrait){
  // Keep the whole character in the central crop; extend sky and ground
  // to fill tall screens instead of zooming in and cutting off the penguin.
  const sw=img.width*.5,sx=(img.width-sw)/2,dh=W*img.height/sw;
  const y=(H-dh)/2;
  if(y>0)ctx.drawImage(img,sx,0,sw,1,0,0,W,y+1);
  ctx.drawImage(img,sx,0,sw,img.height,0,y,W,dh);
  if(y>0)ctx.drawImage(img,sx,img.height-1,sw,1,0,y+dh-1,W,H-y-dh+1);
 }else sceneImage(img);
 ctx.globalAlpha=1;
}
function drawBg(){const c=IM[getSkin().id].background,x=-bgx;for(let i=0;i<3;i++){const ox=x+i*W;if(ox>W||ox+W<0)continue;ctx.save();if(i%2){ctx.translate(ox+W,0);ctx.scale(-1,1);sceneImage(c)}else sceneImage(c,ox);ctx.restore()}
 ctx.fillStyle='rgba(4,8,36,.3)';ctx.fillRect(0,0,W,H)}
function drawObs(o){for(const top of [true,false]){
 const h=top?o.gapY-GAP/2:H-(o.gapY+GAP/2),c=IM.pillar;
 const path=new Path2D(),y=top?0:H-h,r=Math.min(32,OW/2,h/2);
 if(top){
  path.moveTo(o.x,y);path.lineTo(o.x+OW,y);path.lineTo(o.x+OW,y+h-r);
  path.quadraticCurveTo(o.x+OW,y+h,o.x+OW-r,y+h);path.lineTo(o.x+r,y+h);
  path.quadraticCurveTo(o.x,y+h,o.x,y+h-r);path.closePath();
 }else{
  path.moveTo(o.x,y+r);path.quadraticCurveTo(o.x,y,o.x+r,y);
  path.lineTo(o.x+OW-r,y);path.quadraticCurveTo(o.x+OW,y,o.x+OW,y+r);
  path.lineTo(o.x+OW,H);path.lineTo(o.x,H);path.closePath();
 }
 ctx.save();ctx.clip(path);
 ctx.imageSmoothingEnabled=true;
 const scale=Math.max(OW/c.width,h/c.height),sw=OW/scale,sh=h/scale;
 const sx=Math.max(0,Math.min(c.width-sw,o.tx*(c.width-sw))),sy=top?c.height-sh:0;
 if(top){ctx.save();ctx.translate(o.x,h);ctx.scale(1,-1);ctx.drawImage(c,sx,sy,sw,sh,0,0,OW,h);ctx.restore()}
 else ctx.drawImage(c,sx,sy,sw,sh,o.x,H-h,OW,h);
 ctx.restore();
 ctx.save();ctx.lineJoin='round';ctx.lineCap='round';ctx.lineWidth=5;ctx.strokeStyle='#3f3f46';ctx.stroke(path);ctx.restore();}}
function drawPen(){
 ctx.save();ctx.translate(pen.x,pen.y);
 const rot=state==='title'?Math.sin(performance.now()/300)*.08:Math.max(-.45,Math.min(1.1,pen.vy/700));ctx.rotate(rot);
 const skin=IM[getSkin().id],img=boostT>0&&state!=='dead'?skin.boost:skin.idle;
 if(getSkin().id==='classic'){
  ctx.drawImage(img,-PX*S,-PY*S,AS.sw*S,AS.sh*S);ctx.restore();return;
 }
 const box=cowboySpriteBox(skin,AS.sw*S,AS.sh*S,boostT>0&&state!=='dead');
 ctx.drawImage(img,-box.w/2,-box.h/2,box.w,box.h);ctx.restore()}
function drawGameOverPen(){
 const skin=getSkin();
 if(skin.id==='classic')return;
 const img=IM[skin.id].idle,scale=Math.min(190/img.width,150/img.height);
 const x=W/2,y=H*.72;
 ctx.save();ctx.translate(x,y+60);ctx.scale(1,.55);ctx.fillStyle='rgba(4,8,36,.42)';ctx.beginPath();ctx.ellipse(0,0,90,22,0,0,Math.PI*2);ctx.fill();ctx.restore();
 ctx.save();ctx.translate(x,y);ctx.rotate(1.28);ctx.scale(1,.82);
 ctx.drawImage(img,-img.width*scale/2,-img.height*scale/2,img.width*scale,img.height*scale);
 ctx.restore();
 for(const [sx,sy,size] of [[-62,-72,12],[0,-94,15],[64,-70,10]]){
  ctx.save();ctx.translate(x+sx,y+sy);ctx.rotate(performance.now()/900+sx);
  ctx.fillStyle='#ffd35a';ctx.beginPath();
  for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?size*.42:size;ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r)}
  ctx.closePath();ctx.fill();ctx.restore();
 }
}
function selectSkinAtPointer(event){return false}
function text(s,x,y,size,col='#fff',al='center'){size=Math.min(size,(W-40)/Math.max(1,s.length));ctx.font=size+'px '+FONT;ctx.textAlign=al;ctx.textBaseline='middle';ctx.lineJoin='round';ctx.lineWidth=size/4;ctx.strokeStyle='#070b2a';ctx.strokeText(s,x,y);ctx.fillStyle=col;ctx.fillText(s,x,y)}
function draw(){
 const skin=getSkin();
 const scene=state==='over'?skin.id==='classic'?'over':skin.id+'-over':state==='title'&&skin.id==='classic'?'title':skin.id==='classic'?'cave':skin.id;
 if(document.body.dataset.scene!==scene)document.body.dataset.scene=scene;
 ctx.clearRect(0,0,W,H);
 if(state==='title'){
  cover(IM[getSkin().id].titleBackground);
  drawTitlePen();
  ctx.fillStyle='rgba(4,8,36,.25)';ctx.fillRect(0,0,W,H);
  if(portrait){text('JETPACK',W/2,100,34,'#ffd35a');text('PENGUIN',W/2,142,34,'#fff')}else{text('JETPACK',W/2,95,54,'#ffd35a');text('PENGUIN',W/2,160,54,'#fff')}
  text('TAP TO START',W/2,H-57,18);
  text('BEST '+best,W/2,H-25,12,'#a8dcff');return}
 if(state==='over'){cover(skin.id==='classic'?IM.over:IM[skin.id].background);ctx.fillStyle='rgba(4,8,36,.5)';ctx.fillRect(0,0,W,H);drawGameOverPen();
  text('TRY AGAIN',W/2,110,46,'#ff6b5a');text('SCORE '+score,W/2,200,26);text('BEST '+best,W/2,248,20,'#ffd35a');if(overT>.3&&nameModal.classList.contains('hidden'))text(portrait?'TAP TO CONTINUE':'PRESS SPACEBAR TO CONTINUE',W/2,H-60,18);return}
 drawBg();obs.forEach(drawObs);drawPen();
 text(String(score),W/2,90,80)}
let last=performance.now();
function loop(n){const dt=Math.min(.033,(n-last)/1000);last=n;update(dt);draw();requestAnimationFrame(loop)}
const KEYS=['Space'];        // keys that fire the jetpack
const TOUCH_CONTROL=true;    // click/tap also flaps; set false for keyboard only
cv.tabIndex=0;
if(TOUCH_CONTROL){
 cv.addEventListener('pointerdown',e=>{e.preventDefault();unlockAudio();cv.focus({preventScroll:true});if(!selectSkinAtPointer(e))startThrust()});
 window.addEventListener('pointerup',e=>{unlockAudio();stopThrust()});
 window.addEventListener('pointercancel',stopThrust);
 window.addEventListener('touchend',e=>{unlockAudio();stopThrust()},{passive:true});
}
window.addEventListener('keydown',e=>{
 if(state==='title'&&(e.code==='ArrowLeft'||e.code==='ArrowRight')){e.preventDefault();selectSkin(selectedSkinIndex+(e.code==='ArrowRight'?1:-1));return}
 if(KEYS.includes(e.code)){e.preventDefault();startThrust()}
},true);
window.addEventListener('keyup',e=>{if(KEYS.includes(e.code)){e.preventDefault();stopThrust()}},true);
window.addEventListener('blur',stopThrust);
window.focus();cv.focus();
reset();overT=0;initTitlePen();updateTrophyVisibility();
load().then(()=>requestAnimationFrame(loop)).catch(err=>console.error('Could not start the game:',err));
