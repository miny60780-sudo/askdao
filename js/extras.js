/* AskDao extras: quick entry, hexagram of the day, solar term, 64-hexagram grid + modal. Does not modify app.js. */
(function(){
const ZH=document.documentElement.lang.startsWith('zh');
const L=ZH?{hod:'今日一卦',st:'当前节气',since:'始于',next:'下一节气',close:'关闭',king:'第 {n} 卦',open:'查看此卦',lines:'卦象'}:
 {hod:'Hexagram of the Day',st:'Current Solar Term',since:'Began',next:'Next',close:'Close',king:'No. {n}',open:'Read more',lines:'Lines'};
const TERMS=[['春分','Spring Equinox'],['清明','Clear and Bright'],['谷雨','Grain Rain'],['立夏','Start of Summer'],['小满','Grain Buds'],['芒种','Grain in Ear'],['夏至','Summer Solstice'],['小暑','Minor Heat'],['大暑','Major Heat'],['立秋','Start of Autumn'],['处暑','End of Heat'],['白露','White Dew'],['秋分','Autumn Equinox'],['寒露','Cold Dew'],['霜降','Frost Descent'],['立冬','Start of Winter'],['小雪','Minor Snow'],['大雪','Major Snow'],['冬至','Winter Solstice'],['小寒','Minor Cold'],['大寒','Major Cold'],['立春','Start of Spring'],['雨水','Rain Water'],['惊蛰','Awakening of Insects']];
const NOTE_EN=['Day and night stand equal.','Skies clear; a time for tending ancestral graves and spring outings.','Late spring rains nourish new crops.','Summer begins; growth quickens.','Grains begin to fill but are not yet ripe.','Busy days of harvesting and sowing.','The longest day of the year.','Heat builds toward its peak.','The hottest stretch of the year.','Autumn begins, though heat lingers.','Summer heat starts to retreat.','Dew forms in the cool nights.','Day and night stand equal again.','Dew turns cold; autumn deepens.','First frosts appear; the last term of autumn.','Winter begins; a season to rest and store.','First light snow in the north.','Snow grows heavier.','The longest night; yang begins to return.','Cold sets in.','The coldest stretch of the year.','Spring begins; the traditional start of the farming year.','Snow gives way to rain.','Spring thunder wakes hibernating creatures.'];
const NOTE_ZH=['昼夜平分，春意正浓。','天清地明，踏青扫墓之时。','雨生百谷，春雨滋润新苗。','万物并秀，夏季开始。','麦类籽粒渐满而未熟。','有芒之谷可种，农事繁忙。','白昼最长，阳气极盛。','暑气渐盛。','一年中最炎热的时段。','秋季开始，暑热未消。','暑气至此而止。','夜凉露白。','昼夜再度平分。','露气寒冷，深秋将至。','天气渐冷，开始有霜，秋季最后一个节气。','冬季开始，万物收藏。','北方开始降小雪。','雪量渐大。','黑夜最长，一阳来复。','天气寒冷。','一年中最寒冷的时段。','春季开始，农事之始。','降雪转为降雨。','春雷始鸣，惊醒蛰伏的生灵。'];
// Sun apparent longitude (Meeus low-precision), deg
function sunLon(ms){const d=ms/864e5+2440587.5-2451545.0,T=d/36525;
 const L0=280.46646+36000.76983*T+.0003032*T*T,M=(357.52911+35999.05029*T-.0001537*T*T)*Math.PI/180;
 const C=(1.914602-.004817*T-.000014*T*T)*Math.sin(M)+(.019993-.000101*T)*Math.sin(2*M)+.000289*Math.sin(3*M);
 const om=(125.04-1934.136*T)*Math.PI/180;let l=L0+C-.00569-.00478*Math.sin(om);return((l%360)+360)%360;}
function crossing(start,deg,dir){let a=start,step=dir*864e5;const f=t=>((sunLon(t)-deg+540)%360)-180;
 let b=a+step;while(Math.sign(f(a))===Math.sign(f(b))||Math.abs(f(a)-f(b))>90){a=b;b+=step;}
 for(let i=0;i<40;i++){const m=(a+b)/2;if(Math.sign(f(m))===Math.sign(f(a)))a=m;else b=m;}return (a+b)/2;}
const fmt=ms=>{const d=new Date(ms+8*3600e3);return ZH?(d.getUTCFullYear()+'年'+(d.getUTCMonth()+1)+'月'+d.getUTCDate()+'日'):d.toLocaleDateString('en-US',{timeZone:'UTC',month:'short',day:'numeric',year:'numeric'});};
const ZN=h=>ZH&&window.HEX_ZH_S?HEX_ZH_S[h.n]:h.zh;
const SYM=n=>String.fromCodePoint(0x4DC0+n-1);
function hexName(h){return ZH&&window.HEX_ZH?HEX_ZH[h.n][0]:h.name}
function hexDesc(h){if(ZH&&window.HEX_ZH)return HEX_ZH[h.n][1];return h.plain_en||''}
// quick entry
document.querySelectorAll('[data-go]').forEach(a=>a.addEventListener('click',()=>{const b=document.querySelector('.tabs button[data-t="'+a.dataset.go+'"]');if(b)b.click();}));
// modal
const modal=document.getElementById('hexmodal');
function openHex(h){modal.querySelector('.m-sym').textContent=SYM(h.n);modal.querySelector('.m-title').textContent=L.king.replace('{n}',h.n)+' · '+ZN(h)+(ZH?'':' '+h.pinyin);
 modal.querySelector('.m-name').textContent=hexName(h);modal.querySelector('.m-desc').textContent=hexDesc(h);modal.hidden=false;modal.querySelector('.m-close').focus();}
if(modal){modal.addEventListener('click',e=>{if(e.target===modal||e.target.closest('.m-close'))modal.hidden=true});document.addEventListener('keydown',e=>{if(e.key==='Escape')modal.hidden=true});}
// grid popover: classic text (top) + plain explanation (bottom)
const esc=t=>String(t||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function initPop(g,H){const pop=document.createElement('div');pop.className='hpop';pop.hidden=true;pop.setAttribute('role','tooltip');document.body.appendChild(pop);let pinned=null;
 const P=ZH?{j:'卦辞',i:'大象',p:'白话',src:'原文：维基文库《周易》',na:'（未能核实原文，暂缺）'}:{j:'Judgment',i:'The Image',p:'In plain words',src:'Legge translation, 1882 (public domain)',na:'(text not verified – left blank)'};
 function show(c){const h=H[c.dataset.n-1];const j=ZH?h.judgment_zh:h.judgment_legge,im=ZH?h.image_zh:h.image_legge,pl=ZH?h.plain_zh:h.plain_en;
  pop.innerHTML='<div class="hp-h"><span class="s">'+SYM(h.n)+'</span><b>'+h.n+'. '+esc(ZN(h))+(ZH?'':' · '+esc(h.name))+'</b></div><div class="hp-top"><p><em>'+P.j+'</em>'+(j?esc(j):P.na)+'</p><p><em>'+P.i+'</em>'+(im?esc(im):P.na)+'</p><small>'+P.src+'</small></div><div class="hp-bot"><em>'+P.p+'</em>'+esc(pl)+'</div>';
  pop.hidden=false;const r=c.getBoundingClientRect(),w=pop.offsetWidth,hh=pop.offsetHeight;let x=r.left+r.width/2-w/2+scrollX;x=Math.max(scrollX+8,Math.min(x,scrollX+innerWidth-w-8));
  let y=r.top+scrollY-hh-10;if(r.top-hh-10<0)y=r.bottom+scrollY+10;pop.style.left=x+'px';pop.style.top=y+'px';g.querySelectorAll('.hx.act').forEach(e=>e.classList.remove('act'));c.classList.add('act');}
 function hide(){pop.hidden=true;pinned=null;g.querySelectorAll('.hx.act').forEach(e=>e.classList.remove('act'));}
 const hover=matchMedia('(hover:hover)').matches;
 if(hover){g.addEventListener('mouseover',e=>{const c=e.target.closest('.hx');if(c&&!pinned)show(c)});g.addEventListener('mouseleave',()=>{if(!pinned)hide()});}
 g.addEventListener('click',e=>{const c=e.target.closest('.hx');if(!c)return;e.stopPropagation();if(pinned===c){hide();return;}show(c);pinned=c;});
 g.addEventListener('focusin',e=>{const c=e.target.closest('.hx');if(c&&!pinned)show(c)});
 document.addEventListener('click',e=>{if(!e.target.closest('.hpop'))hide()});document.addEventListener('keydown',e=>{if(e.key==='Escape')hide()});addEventListener('resize',hide);}
fetch('data/hexagrams.json').then(r=>r.json()).then(H=>{
 const g=document.getElementById('hexgrid');
 if(g){H.forEach(h=>{const c=document.createElement('button');c.className='hx';c.type='button';c.innerHTML='<span class="s">'+SYM(h.n)+'</span><span class="z">'+ZN(h)+'</span><span class="e">'+(ZH?h.n:h.name)+'</span>';c.setAttribute('aria-label',h.n+'. '+hexName(h));c.dataset.n=h.n;g.appendChild(c);});initPop(g,H);}
 const now=new Date(Date.now()+8*3600e3),day=Math.floor(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate())/864e5);
 const h=H[(day*27+5)%64],el=document.getElementById('hod');
 if(el){el.querySelector('.sym').textContent=SYM(h.n);el.querySelector('.nm').textContent=h.n+'. '+ZN(h)+' · '+hexName(h);el.querySelector('.ds').textContent=hexDesc(h);el.querySelector('.more').onclick=()=>openHex(h);}
});
// solar term
const st=document.getElementById('jieqi');
if(st){const t=Date.now(),k=Math.floor(sunLon(t)/15),k2=(k+1)%24;const s=crossing(t,k*15,-1),n=crossing(t,k2*15,1);
 st.querySelector('.zh').textContent=TERMS[k][0];st.querySelector('.en').textContent=ZH?'':TERMS[k][1];
 st.querySelector('.ds').textContent=(ZH?NOTE_ZH:NOTE_EN)[k];
 st.querySelector('.dt').textContent=L.since+' '+fmt(s)+' · '+L.next+(ZH?'：':': ')+TERMS[k2][0]+(ZH?'':' ('+TERMS[k2][1]+')')+(ZH?'，':', ')+fmt(n);}
})();
