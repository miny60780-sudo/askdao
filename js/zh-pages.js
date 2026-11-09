/* 中文分页阅读：四页切换、六十四卦弹窗、左右悬浮按钮（打赏 / AI解卦）。 */
(function(){
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const pages=$$('.page'),bg=$('.drawer-bg'),ai=$('#aipanel'),tip=$('#merit');
document.body.classList.add('js');
function show(){const h=location.hash.slice(1),m=h.match(/^p([1-4])/);const n=m?+m[1]:1;
 pages.forEach(p=>p.hidden=p.id!=='p'+n);$$('.cdots a').forEach(a=>a.classList.toggle('on',+a.dataset.p===n));
 closePop();closeAll();window.scrollTo(0,0);
 if(/-ai$/.test(h)||h==='oracle')open('oracle');if(h==='merit'||h==='tip')open('merit');const g=h.match(/-gua(\d+)$/);if(g)openGua(+g[1]);}
let cur=null,last=null;
function open(k,src){closeAll();last=src||null;cur=k==='oracle'?ai:tip;cur.hidden=false;requestAnimationFrame(()=>cur.classList.add('open'));
 if(k==='oracle'||matchMedia('(max-width:760px)').matches){bg.hidden=false;}
 const f=k==='oracle'?$('#q'):tip.querySelector('a.btn');setTimeout(()=>f&&f.focus({preventScroll:true}),60);}
function closeAll(){[ai,tip].forEach(p=>{p.classList.remove('open');p.hidden=true;});bg.hidden=true;if(cur&&last)last.focus();cur=null;}
$$('[data-open]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();const k=b.dataset.open;(cur&&cur===(k==='oracle'?ai:tip))?closeAll():open(k,b);}));
$$('[data-close]').forEach(b=>b.onclick=closeAll);bg.onclick=closeAll;
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closePop();closeAll();}});
// 64 gua
const grid=$('#gua64'),pop=$('#guapop');let HEXD=[],FULL=[],curCell=null;let PEND=0,LASTN=0;fetch('data/zhouyi-full.json').then(r=>r.json()).then(d=>{FULL=d;if(LASTN&&!pop.hidden)openGua(LASTN);}).catch(()=>{});
const TRI={'111':['乾','天'],'000':['坤','地'],'100':['震','雷'],'011':['巽','风'],'010':['坎','水'],'101':['离','火'],'001':['艮','山'],'110':['兑','泽']};
fetch('data/hexagrams.json').then(r=>r.json()).then(d=>{HEXD=d;grid.innerHTML=d.map(h=>{const nm=(window.HEX_ZH&&HEX_ZH[h.n])?HEX_ZH[h.n][0]:h.zh;
 const bars=h.lines.split('').reverse().map(v=>'<i class="'+(v==='1'?'y':'n')+'"></i>').join('');
 return '<button type="button" class="gua" data-n="'+h.n+'" aria-label="第'+h.n+'卦 '+nm+'"><span class="gbars">'+bars+'</span><span class="gn">'+h.n+'</span><span class="gz">'+((window.HEX_ZH_S&&HEX_ZH_S[h.n])||h.zh)+'</span><span class="gf">'+nm+'</span></button>';}).join('');
 grid.querySelectorAll('.gua').forEach(b=>{b.onclick=()=>openGua(+b.dataset.n,b);
  b.onmouseenter=()=>{if(matchMedia('(hover:hover) and (min-width:761px)').matches)openGua(+b.dataset.n,b);};});if(PEND)openGua(PEND);});
function openGua(n,cell){const h=HEXD[n-1];if(!h){PEND=n;return;}PEND=0;LASTN=n;cell=cell||grid.querySelector('[data-n="'+n+'"]');
 const z=window.HEX_ZH&&HEX_ZH[n];
 pop.querySelector('.gp-sym').textContent=String.fromCodePoint(0x4dc0+n-1);
 pop.querySelector('.gp-no').textContent='第 '+n+' 卦';pop.querySelector('#gp-name').textContent=(z?z[0]:h.zh)+'（'+((window.HEX_ZH_S&&HEX_ZH_S[n])||h.zh)+'卦）';
 const f=FULL[n-1]||{};const lo=TRI[h.lines.slice(0,3)],up=TRI[h.lines.slice(3)];
 const sec=(t,b)=>b?'<div class="gp-s"><em>'+t+'</em><p>'+b+'</p></div>':'';
 pop.querySelector('.gp-ot').innerHTML=(f.gua?sec('卦辞',f.gua):sec('卦辞',((window.HEX_ZH_S&&HEX_ZH_S[n])||h.zh)+'：'+(h.judgment_zh||'')))+sec('彖传',f.tuan)+sec('大象',f.daxiang||h.image_zh)+
  (f.yao&&f.yao.length?'<div class="gp-s"><em>爻辞（自下而上）</em><ol class="gp-yao">'+f.yao.map(y=>'<li>'+y+'</li>').join('')+'</ol></div>':'<p class="gp-miss">本卦爻辞资料暂缺。</p>');
 const N=window.HEX_NOTES&&HEX_NOTES[n];const T=pop.querySelector('.gp-top');T.hidden=!N;T.textContent=N?N.core:'';
 pop.querySelector('.gp-pt').innerHTML=N?(sec('这一卦讲什么',N.what)+sec('放在生活中',N.life)+
  '<div class="gp-s"><em>建议</em><p><b class="gp-do">宜</b>'+N.do+'</p><p><b class="gp-no2">忌</b>'+N.avoid+'</p></div>'+sec('六爻走势（自下而上）',N.trend)):sec('整体含义',h.plain_zh);
 pop.querySelector('.gp-pt').insertAdjacentHTML('beforeend','<p class="gp-meta">卦象构成：上卦'+up[0]+'（'+up[1]+'），下卦'+lo[0]+'（'+lo[1]+'）。起卦若有变爻，可重点读对应爻辞并参看之卦；多爻变如何取舍，各家说法不一。</p>');
 pop.hidden=false;if(curCell)curCell.classList.remove('on');curCell=cell;cell&&cell.classList.add('on');place(cell);}
function place(cell){if(matchMedia('(max-width:760px)').matches||!cell){pop.classList.add('sheet');pop.style.left=pop.style.top='';return;}
 pop.classList.remove('sheet');const r=cell.getBoundingClientRect(),W=pop.offsetWidth,H=pop.offsetHeight;
 let x=r.right+12;if(x+W>innerWidth-12)x=r.left-12-W;if(x<12)x=12;
 let y=r.top+r.height/2-H/2;y=Math.max(76,Math.min(y,innerHeight-H-12));pop.style.left=x+'px';pop.style.top=y+'px';}
function closePop(){if(!pop)return;pop.hidden=true;if(curCell)curCell.classList.remove('on');curCell=null;}
pop.querySelector('.gp-x').onclick=closePop;
document.addEventListener('click',e=>{if(!pop.hidden&&!pop.contains(e.target)&&!e.target.closest('.gua'))closePop();});
addEventListener('scroll',()=>{if(!pop.hidden&&curCell&&!pop.classList.contains('sheet'))place(curCell);},{passive:true});
addEventListener('hashchange',show);show();
})();
/* 首屏起卦框（2026-11-09 改版定稿）：示例问题填充 + 带着问题打开解卦面板 */
(function(){
 const hq=document.getElementById('heroq'),hc=document.getElementById('herocast');if(!hq||!hc)return;
 document.querySelectorAll('.chip').forEach(c=>c.addEventListener('click',()=>{hq.value=c.dataset.q||'';hq.focus();}));
 hc.addEventListener('click',()=>{
  document.querySelector('.ffab.right').click();
  const q=document.getElementById('q');if(q){q.value=hq.value;q.dispatchEvent(new Event('input',{bubbles:true}));}
  if(typeof goto==='function')goto(1);
 });
})();
/* 起卦入口：打开解卦面板并预选方法 */
document.querySelectorAll('[data-cast]').forEach(b=>b.addEventListener('click',()=>{
 const m=b.dataset.cast;document.querySelector('.ffab.right').click();
 const mb=document.querySelector('.methods button[data-m="'+m+'"]');if(mb)mb.click();
 if(typeof goto==='function')goto(1);
}));
