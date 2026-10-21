const AS={idle:'assets/penguin_idle.png',boost:'assets/penguin_boost.png',cave:'assets/cave.jpg',title:'assets/title_bg.jpg',over:'assets/gameover_bg.jpg',sw:282,sh:190}; // sprite/background files (sw, sh = sprite frame size)
// ---- TWEAK ME ----
let W=960,H=540,portrait=false; // responsive game coordinates
const GAP=205;          // vertical gap between stalactite and stalagmite
const OW=130;           // obstacle width
const SPEED=210;        // obstacle speed (px/s)
const SPACE=340;        // distance between obstacles
const G=1450;           // gravity
const FLAP=-450;        // jetpack kick (more negative = higher)
const S=0.5;            // penguin sprite scale
const PX=205,PY=85;     // sprite pivot (body centre)
const R=21;             // penguin hitbox radius
const cv=document.getElementById('c'),ctx=cv.getContext('2d');
const FONT='"Press Start 2P",monospace';
const IM={};let best=0;
// Keep the best score across refreshes for this tab's session.
try{best=+sessionStorage.getItem('jp_best')||0}catch(e){}
let state='title',t=0,bgx=0,pen,obs,score,boostT,deadT,overT,ac;
function load(){return Promise.all(['idle','boost','cave','title','over'].map(k=>new Promise(r=>{const i=new Image();i.onload=()=>{IM[k]=i;r()};i.src=AS[k]})))}
function beep(f,d,type='square',v=.05){try{ac=ac||new (window.AudioContext||window.webkitAudioContext)();const o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.value=f;g.gain.value=v;g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+d);o.connect(g);g.connect(ac.destination);o.start();o.stop(ac.currentTime+d)}catch(e){}}
function reset(){pen={x:portrait?W*.25:230,y:H/2,vy:0};obs=[];score=0;boostT=0;t=0;for(let i=0;i<4;i++)addObs(W+260+i*SPACE)}
function addObs(x){
 const previous=obs.length?obs[obs.length-1].gapY:H/2;
 const gapY=portrait?Math.max(150,Math.min(H-150,previous+(Math.random()-.5)*240)):150+Math.random()*(H-300);
 obs.push({x,gapY,tx:Math.random(),passed:false})}
// Keep the full game visible; preserve the current run when the viewport changes.
function resize(){
 const bounds=cv.getBoundingClientRect(),oldW=W,oldH=H;
 portrait=window.matchMedia('(max-width: 768px) and (orientation: portrait)').matches;
 W=portrait?540:960;H=portrait?Math.round(W*bounds.height/bounds.width):540;
 cv.width=W;cv.height=H;
 if(pen){pen.x=portrait?W*.25:230;pen.y=Math.max(24,Math.min(H-22,pen.y*H/oldH));
  obs.forEach(o=>{o.x=pen.x+(o.x-(oldW===960?230:oldW*.25))*W/oldW;o.gapY=Math.max(150,Math.min(H-150,o.gapY*H/oldH))})}
 bgx=0;
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
function flap(){
 if(state==='title'){reset();state='play'}
 else if(state==='over'){if(overT>.45){reset();state='play'}else return}
 else if(state==='dead')return;
 pen.vy=FLAP;boostT=.18;beep(520,.08)}
function die(){state='dead';deadT=0;pen.vy=-200;beep(120,.35,'sawtooth',.07);if(score>best){best=score;try{sessionStorage.setItem('jp_best',best)}catch(e){}}}
function update(dt){
 bgx=(bgx+(state==='dead'?0:60)*dt)%(W*2);
 if(state==='title'||state==='over'){overT+=dt;return}
 t+=dt;boostT=Math.max(0,boostT-dt);
 pen.vy+=G*dt;pen.y+=pen.vy*dt;
 if(state==='dead'){deadT+=dt;if(deadT>.8){state='over';overT=0}return}
 if(pen.y<24){pen.y=24;pen.vy=Math.max(pen.vy,0)}
 if(pen.y>H-22){return die()}
 for(const o of obs){o.x-=SPEED*dt;if(!o.passed&&o.x+OW<pen.x){o.passed=true;score++;beep(880,.1,'triangle',.06)}if(hit(o))return die()}
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
  text('JETPACK',W/2,95,54,'#ffd35a');text('PENGUIN',W/2,160,54,'#fff');
  if(Math.floor(performance.now()/550)%2)text(portrait?'TAP TO START':'TAP ANYWHERE TO PLAY',W/2,H-70,22);
  text('BEST '+best,W/2,H-30,14,'#a8dcff');return}
 if(state==='over'){cover(IM.over);ctx.fillStyle='rgba(4,8,36,.5)';ctx.fillRect(0,0,W,H);
  text('GAME OVER',W/2,110,46,'#ff6b5a');text('SCORE '+score,W/2,200,26);text('BEST '+best,W/2,248,20,'#ffd35a');
  if(overT>.45&&Math.floor(performance.now()/550)%2)text(portrait?'TAP TO RETRY':'PRESS SPACEBAR TO RETRY',W/2,H-60,18);return}
 drawBg();obs.forEach(drawObs);drawPen();
 text(String(score),W/2,90,80);
 if(state==='dead'&&deadT<.12){ctx.fillStyle='rgba(255,255,255,.6)';ctx.fillRect(0,0,W,H)}}
let last=performance.now();
function loop(n){const dt=Math.min(.033,(n-last)/1000);last=n;update(dt);draw();requestAnimationFrame(loop)}
const KEYS=['Space'];        // keys that fire the jetpack
const TOUCH_CONTROL=true;    // click/tap also flaps; set false for keyboard only
cv.tabIndex=0;
if(TOUCH_CONTROL)cv.addEventListener('pointerdown',e=>{e.preventDefault();cv.focus();flap()});
window.addEventListener('keydown',e=>{if(KEYS.includes(e.code)){e.preventDefault();if(!e.repeat)flap()}},true);
window.focus();cv.focus();
reset();overT=0;
load().then(()=>requestAnimationFrame(loop));
