const AS={idle:'assets/penguin_idle.png',boost:'assets/penguin_boost.png',cave:'assets/cave.jpg',title:'assets/title_bg.jpg',over:'assets/gameover_bg.jpg',sw:282,sh:190}; // sprite/background files (sw, sh = sprite frame size)
// ---- TWEAK ME ----
let W=960,H=540,portrait=false; // responsive game coordinates
const GAP=205;          // vertical gap between stalactite and stalagmite
const OW=130;           // obstacle width
// Speed brackets based on score:
// 0-15:  normal (210 px/s)
// 16-40: noticeably brisker (scales smoothly from 210 -> 265 px/s)
// 41-60: fast (scales smoothly from 265 -> 330 px/s)
// 60+:   max (360 px/s)
function getSpeed(){
 if(score<=15) return 210;
 if(score<=40) return 210 + (score-15)*(55/25); // 210 -> 265
 if(score<60)  return 265 + (score-40)*(65/20); // 265 -> 330
 return 360; // 60+ max speed
}
const SPACE=340;        // distance between obstacles
const G=1450;           // gravity
const THRUST=3200;       // jetpack upward thrust acceleration when holding (px/s^2)
const MAX_RISE_SPEED=-420; // maximum upward velocity limit
const FLAP=-360;        // initial kick on tap (more negative = higher)
const S=0.5;            // penguin sprite scale
const PX=205,PY=85;     // sprite pivot (body centre)
const R=21;             // penguin hitbox radius
const cv=document.getElementById('c'),ctx=cv.getContext('2d');
const FONT='"Press Start 2P",monospace';
const IM={};let best=0;
// Keep the best score across refreshes for this tab's session.
try{best=+sessionStorage.getItem('jp_best')||0}catch(e){}
let state='title',t=0,bgx=0,pen,obs,score,boostT,deadT,overT,ac,holding=false;

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

function showNameModal(s){
 modalScoreEl.textContent=s;
 playerNameInput.value='';
 nameModal.classList.remove('hidden');
 setTimeout(()=>playerNameInput.focus(),60);
}
function hideNameModal(){nameModal.classList.add('hidden')}

async function showLbModal(){
 lbList.innerHTML='<p class="lb-empty">Loading...</p>';
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

function goToTitle(){state='title';overT=0;initTitlePen();updateTrophyVisibility()}

document.getElementById('btn-save').addEventListener('click',async ()=>{
 const n=playerNameInput.value.trim();
 if(!n)return playerNameInput.focus();
 await lbPost(n,score);
 hideNameModal();
 overT=0; // show the Game Over screen and wait for tap
});
document.getElementById('btn-skip').addEventListener('click',()=>{
 hideNameModal();
 overT=0; // show the Game Over screen and wait for tap
});
playerNameInput.addEventListener('keydown',e=>{
 if(e.key==='Enter'){document.getElementById('btn-save').click();e.preventDefault();}
 if(e.key==='Escape'){document.getElementById('btn-skip').click();e.preventDefault();}
 e.stopPropagation(); // don't let Space/Enter trigger flap
});
trophyBtn.addEventListener('click',e=>{e.stopPropagation();showLbModal()});
document.getElementById('lb-close').addEventListener('click',hideLbModal);
// Close lb modal on backdrop click
lbModal.addEventListener('click',e=>{if(e.target===lbModal)hideLbModal()});

function updateTrophyVisibility(){
 if(state==='title')trophyBtn.classList.remove('hidden');
 else trophyBtn.classList.add('hidden');
}
// ---- Title screen penguin animation ----
// The penguin bobs up/down and periodically fires the jetpack on the title screen.
let titlePen={y:0,vy:0,boostT:0,flapTimer:1.2};
function initTitlePen(){titlePen={y:H/2,vy:0,boostT:0,flapTimer:1.2}}
function updateTitlePen(dt){
 titlePen.flapTimer-=dt;
 if(titlePen.flapTimer<=0){titlePen.vy=FLAP;titlePen.boostT=.25;titlePen.flapTimer=1.4+Math.random()*.8}
 titlePen.boostT=Math.max(0,titlePen.boostT-dt);
 titlePen.vy+=G*dt;
 titlePen.y+=titlePen.vy*dt;
 if(titlePen.y<H*.2){titlePen.y=H*.2;titlePen.vy=Math.abs(titlePen.vy)*.3}
 if(titlePen.y>H*.8){titlePen.y=H*.8;titlePen.vy=-Math.abs(titlePen.vy)*.3}
}
function drawTitlePen(){
 ctx.save();ctx.translate(portrait?W*.25:230,titlePen.y);
 const rot=Math.max(-.45,Math.min(1.1,titlePen.vy/700));ctx.rotate(rot);
 const img=titlePen.boostT>0?IM.boost:IM.idle;
 ctx.drawImage(img,-PX*S,-PY*S,AS.sw*S,AS.sh*S);ctx.restore();
}
function load(){return Promise.all(['idle','boost','cave','title','over'].map(k=>new Promise(r=>{const i=new Image();i.onload=()=>{IM[k]=i;r()};i.src=AS[k]})))}
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
 if(IM.title&&IM.over&&IM.cave)draw();
}
window.addEventListener('resize',resize);
resize();
function poly(o,top){const h=top?o.gapY-GAP/2:H-(o.gapY+GAP/2),w=OW;
// Straight sides with rounded end corners. Extend the base beyond the
// viewport so the obstacle joins the screen edge without a visible seam.
const r=Math.min(32,h/2,w/2),rel=[[0,-8],[w,-8],[w,h-r]];
for(let i=1;i<=16;i++){const a=i*Math.PI/32;rel.push([w-r+r*Math.cos(a),h-r+r*Math.sin(a)])}
rel.push([r,h]);
for(let i=1;i<=16;i++){const a=Math.PI/2+i*Math.PI/32;rel.push([r+r*Math.cos(a),h-r+r*Math.sin(a)])}
return rel.map(([a,b])=>[o.x+a,top?b:H-b])}
function segDist(px,py,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy;let u=l?((px-a[0])*dx+(py-a[1])*dy)/l:0;u=Math.max(0,Math.min(1,u));return Math.hypot(px-a[0]-u*dx,py-a[1]-u*dy)}
function inPoly(px,py,p){let c=false;for(let i=0,j=p.length-1;i<p.length;j=i++){if((p[i][1]>py)!=(p[j][1]>py)&&px<(p[j][0]-p[i][0])*(py-p[i][1])/(p[j][1]-p[i][1])+p[i][0])c=!c}return c}
function hit(o){for(const top of [true,false]){const p=poly(o,top);if(inPoly(pen.x,pen.y,p))return true;for(let i=0;i<p.length;i++)if(segDist(pen.x,pen.y,p[i],p[(i+1)%p.length])<R)return true}return false}
function startThrust(){
 holding=true;
 if(state==='title'){reset();state='play';updateTrophyVisibility();pen.vy=FLAP;boostT=.18;beep(520,.08);return}
 if(state==='over'){
  if(overT>.3 && nameModal.classList.contains('hidden')){
   goToTitle();
  }
  return;
 }
 if(state==='dead')return;
 // Initial kick on press
 if(pen.vy>0)pen.vy=Math.min(pen.vy,FLAP*.7);
 else pen.vy=Math.max(MAX_RISE_SPEED,pen.vy+FLAP*.4);
 boostT=.2;
 beep(520,.08);
}

function stopThrust(){
 holding=false;
}

function die(){holding=false;state='dead';deadT=0;pen.vy=-200;beep(120,.35,'sawtooth',.07);if(score>best){best=score;try{sessionStorage.setItem('jp_best',best)}catch(e){}}}
function update(dt){
 const curSpeed=state==='play'?getSpeed():BASE_SPEED;
 bgx=(bgx+(state==='dead'?0:curSpeed*0.3)*dt)%(W*2);
 if(state==='title'){overT+=dt;updateTitlePen(dt);return}
 if(state==='over'){overT+=dt;return}
 t+=dt;
 if(holding&&state==='play'){
  boostT=.1;
  pen.vy=Math.max(MAX_RISE_SPEED,pen.vy+(G-THRUST)*dt);
 }else{
  boostT=Math.max(0,boostT-dt);
  pen.vy+=G*dt;
 }
 pen.y+=pen.vy*dt;
 if(state==='dead'){
  deadT+=dt;
  if(deadT>.8){
   state='over';
   overT=0;
   updateTrophyVisibility();
   if(score>0){
    showNameModal(score);
   }
  }
  return;
 }
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
function drawBg(){const c=IM.cave,x=-bgx;for(let i=0;i<3;i++){const ox=x+i*W;if(ox>W||ox+W<0)continue;ctx.save();if(i%2){ctx.translate(ox+W,0);ctx.scale(-1,1);sceneImage(c)}else sceneImage(c,ox);ctx.restore()}
 ctx.fillStyle='rgba(4,8,36,.3)';ctx.fillRect(0,0,W,H)}
function drawObs(o){for(const top of [true,false]){
 const h=top?o.gapY-GAP/2:H-(o.gapY+GAP/2),p=poly(o,top),c=IM.cave,k=c.width/W,sw=OW*k,sh=Math.min(h*k,c.height*.9),sx=o.tx*(c.width-sw);
 const path=new Path2D();p.forEach(([a,b],i)=>i?path.lineTo(a,b):path.moveTo(a,b));path.closePath();
 ctx.save();ctx.clip(path);
 if(top)ctx.drawImage(c,sx,0,sw,sh,o.x,0,OW,h);else ctx.drawImage(c,sx,c.height-sh,sw,sh,o.x,H-h,OW,h);
 const g=ctx.createLinearGradient(0,top?0:H,0,top?h:H-h);g.addColorStop(0,'rgba(120,170,230,.18)');g.addColorStop(1,'rgba(200,235,255,.5)');
 ctx.fillStyle=g;ctx.fillRect(o.x,top?0:H-h,OW,h);ctx.restore();
 ctx.lineJoin='round';ctx.lineWidth=6;ctx.strokeStyle='#070b2a';ctx.stroke(path);ctx.lineWidth=2;ctx.strokeStyle='#a8dcff';ctx.stroke(path)}}
function drawPen(){
 ctx.save();ctx.translate(pen.x,pen.y);
 const rot=state==='title'?Math.sin(performance.now()/300)*.08:Math.max(-.45,Math.min(1.1,pen.vy/700));ctx.rotate(rot);
 const img=boostT>0&&state!=='dead'?IM.boost:IM.idle;
 ctx.drawImage(img,-PX*S,-PY*S,AS.sw*S,AS.sh*S);ctx.restore()}
function text(s,x,y,size,col='#fff',al='center'){size=Math.min(size,(W-40)/Math.max(1,s.length));ctx.font=size+'px '+FONT;ctx.textAlign=al;ctx.textBaseline='middle';ctx.lineJoin='round';ctx.lineWidth=size/4;ctx.strokeStyle='#070b2a';ctx.strokeText(s,x,y);ctx.fillStyle=col;ctx.fillText(s,x,y)}
function draw(){
 const scene=state==='title'?'title':state==='over'?'over':'cave';
 if(document.body.dataset.scene!==scene)document.body.dataset.scene=scene;
 ctx.clearRect(0,0,W,H);
 if(state==='title'){cover(IM.title);ctx.fillStyle='rgba(4,8,36,.25)';ctx.fillRect(0,0,W,H);
  drawTitlePen();
  if(portrait){
   text('JETPACK',W/2,100,34,'#ffd35a');
   text('PENGUIN',W/2,142,34,'#fff');
  }else{
   text('JETPACK',W/2,95,54,'#ffd35a');
   text('PENGUIN',W/2,160,54,'#fff');
  }
  text(portrait?'TAP TO START':'TAP ANYWHERE TO PLAY',W/2,H-70,22);
  text('BEST '+best,W/2,H-30,14,'#a8dcff');return}
 if(state==='over'){cover(IM.over);ctx.fillStyle='rgba(4,8,36,.5)';ctx.fillRect(0,0,W,H);
  text('TRY AGAIN',W/2,110,46,'#ff6b5a');text('SCORE '+score,W/2,200,26);text('BEST '+best,W/2,248,20,'#ffd35a');
  if(overT>.3&&nameModal.classList.contains('hidden'))text(portrait?'TAP TO CONTINUE':'PRESS SPACEBAR TO CONTINUE',W/2,H-60,18);return}
 drawBg();obs.forEach(drawObs);drawPen();
 text(String(score),W/2,90,80)}
let last=performance.now();
function loop(n){const dt=Math.min(.033,(n-last)/1000);last=n;update(dt);draw();requestAnimationFrame(loop)}
const KEYS=['Space'];        // keys that fire the jetpack
const TOUCH_CONTROL=true;    // click/tap also flaps; set false for keyboard only
cv.tabIndex=0;
if(TOUCH_CONTROL){
 cv.addEventListener('pointerdown',e=>{
  e.preventDefault();
  unlockAudio();
  cv.focus({preventScroll:true});
  startThrust();
 });
 window.addEventListener('pointerup',e=>{
  unlockAudio();
  stopThrust();
 });
 window.addEventListener('pointercancel',stopThrust);
 window.addEventListener('touchend',e=>{
  unlockAudio();
  stopThrust();
 },{passive:true});
}
window.addEventListener('keydown',e=>{
 if(KEYS.includes(e.code)){
  e.preventDefault();
  if(!e.repeat)startThrust();
 }
},true);
window.addEventListener('keyup',e=>{
 if(KEYS.includes(e.code)){
  e.preventDefault();
  stopThrust();
 }
},true);
window.addEventListener('blur',stopThrust);
window.focus();cv.focus();
reset();overT=0;initTitlePen();updateTrophyVisibility();
load().then(()=>requestAnimationFrame(loop));
