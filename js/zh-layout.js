/* 中文版三栏布局：右侧问卦面板折叠；窄屏底部抽屉（问卦 / 打赏）。不影响英文页。 */
(function(){
const mq=matchMedia('(max-width:1199px)');const bg=document.querySelector('.drawer-bg');
const panels={oracle:document.querySelector('.side-wrap'),merit:document.getElementById('merit')};
let open=null,last=null;
Object.entries(panels).forEach(([k,p])=>{if(!p)return;const b=document.createElement('button');b.type='button';b.className='dclose';b.setAttribute('aria-label','关闭');b.textContent='×';b.onclick=close;p.prepend(b);p.setAttribute('role','region');});
function close(){if(!open)return;open.classList.remove('open');open.removeAttribute('aria-modal');open.removeAttribute('role');bg.hidden=true;document.body.classList.remove('noscroll');const l=last;open=null;if(l)l.focus();}
function show(k,src){const p=panels[k];if(!p)return;
 if(mq.matches){close();last=src||null;open=p;p.classList.add('open');p.setAttribute('role','dialog');p.setAttribute('aria-modal','true');bg.hidden=false;document.body.classList.add('noscroll');
  const f=k==='oracle'?document.getElementById('q'):p.querySelector('a,button:not(.dclose)');setTimeout(()=>f&&f.focus(),50);}
 else{if(k==='oracle'){setCollapsed(false);document.getElementById('q').focus();}else{p.classList.remove('flash');void p.offsetWidth;p.classList.add('flash');const a=p.querySelector('a.btn');a&&a.focus();}}}
document.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();show(b.dataset.open,b);}));
bg.addEventListener('click',close);document.addEventListener('keydown',e=>{if(e.key==='Escape')close();
 if(e.key==='Tab'&&open){const f=[...open.querySelectorAll('button,a,input,textarea,[tabindex="0"]')].filter(x=>x.offsetParent);if(!f.length)return;const a=f[0],z=f[f.length-1];
  if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus();}else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus();}}});
mq.addEventListener('change',()=>{close();});
// collapse
const cb=document.querySelector('.side-wrap .collapse'),body=document.getElementById('oraclebody'),wrap=panels.oracle;
function setCollapsed(c){if(!cb)return;body.hidden=c;wrap.classList.toggle('collapsed',c);cb.setAttribute('aria-expanded',String(!c));cb.textContent=c?'+':'−';}
cb&&cb.addEventListener('click',()=>setCollapsed(!body.hidden));
// hero quick-entry buttons that pick a tab should also open the panel
document.querySelectorAll('[data-go]').forEach(a=>a.addEventListener('click',()=>show('oracle',a)));
})();
