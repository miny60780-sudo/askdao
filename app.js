/* AskDao oracle — manual casting (coins / numbers / objects).
   The reading call sends only {hexagram, lines, question, lang} and expects {text}.
   Name ideas are not sent to the model. */
const API='https://www.fzjzq.com/askdao-api/reading';
const ZH=document.documentElement.lang.startsWith('zh');
const T=ZH?{iching:['易经起卦','心中默念所问之事，然后亲手起卦。','你的问题（可不填）'],
char:['测字','写下一个汉字，亲手起一卦，再请求解读其字形字义与卦象。','例如：福'],
name:['取中文名','告诉我们你的名字和看重的品质，为你推荐带寓意的中文名（无需起卦）。','例如：Emily，看重善良与勇气'],
lost:['寻物卦','描述丢失的物品，亲手起一卦，作为“再去哪里找找”的趣味提示。','例如：钥匙，昨天在家里不见了'],
life:['人生感悟','提出一个关于人生方向的开放问题，起一卦作为思考的起点。','例如：我该换工作吗？']}
:{iching:['I Ching Casting','Hold a question in mind, then cast the hexagram yourself.','Your question'],
char:['Character Reading 测字','Write one Chinese character (or an English word), cast a hexagram by hand, then request a reading of the character and hexagram.','e.g. 福 or "home"'],
name:['Chinese Name Ideas','Tell us your name and the qualities you value; we suggest Chinese names with meanings. No casting needed.','e.g. Emily, values kindness and courage'],
lost:['Lost Item Hexagram 寻物','Describe what you lost and cast a hexagram by hand: a playful folk prompt for where to look again.','e.g. my keys, lost yesterday at home'],
life:['Life Insight','Ask an open question about your path; cast a hexagram as a starting point for reflection.','e.g. Should I change careers?']};
const S=ZH?{req:'请求解卦',sug:'推荐名字',wait:'正在解读…',off:'解读服务暂时无法连接（可能处于离线或本地预览）。你仍可阅读上方卦辞，自行体会：古人把卦象当作一面镜子，而非定论。',
 needQ:'请先写下你的问题。',
 nameOff:'取名暂时无法使用。小提示：传统中文名常把一种品德（如德、安、明）与一个自然意象（如林、雪、川）搭配。',
 line:['第一爻（初爻）','第二爻','第三爻','第四爻','第五爻','第六爻（上爻）'],next:'请掷第 {i} 次，记录{p}',done:'六爻已成。',
 primary:'本卦',changed:'之卦（变卦）',none:'无变爻，只看本卦。',moving:'变爻：',img:'象：',judg:'',
 v:{6:'老阴 6 ⚋→⚊',7:'少阳 7 ⚊',8:'少阴 8 ⚋',9:'老阳 9 ⚊→⚋'},bad:'请输入三个正整数。',time:'已按当前农历时间取数：',
 calc:'{a} ÷ 8 余 {ra} → 上卦{u}；{b} ÷ 8 余 {rb} → 下卦{l}；{c} ÷ 6 余 {rc} → 动爻为第 {m} 爻。'}
:{req:'Read my hexagram',sug:'Suggest names',wait:'Consulting…',off:'The reading service is unavailable right now (you may be offline or previewing locally). The judgment above is yours to reflect on: the ancients read hexagrams as mirrors, not verdicts.',
 needQ:'Please write your question first.',
 nameOff:'Name suggestions are offline right now. Tip: classic Chinese names often pair a virtue (德 virtue, 安 peace, 明 bright) with a nature image (林 forest, 雪 snow, 川 river).',
 line:['Line 1 (bottom)','Line 2','Line 3','Line 4','Line 5','Line 6 (top)'],next:'Cast line {i} of 6 (record: {p})',done:'All six lines are cast.',
 primary:'Primary hexagram',changed:'Changing to',none:'No moving lines: read the primary hexagram only.',moving:'Moving lines: ',img:'Image: ',judg:'',
 v:{6:'old yin 6 ⚋→⚊',7:'young yang 7 ⚊',8:'young yin 8 ⚋',9:'old yang 9 ⚊→⚋'},bad:'Please enter three whole numbers above zero.',time:'Numbers from the current Chinese-calendar time: ',
 calc:'{a} ÷ 8 leaves {ra} → upper trigram {u}; {b} ÷ 8 leaves {rb} → lower trigram {l}; {c} ÷ 6 leaves {rc} → moving line {m}.'};
// Xiantian (Former Heaven) numbers; bits listed bottom-to-top
const TRI={1:['乾','Qian','Heaven','111'],2:[ZH?'兑':'兌','Dui','Lake','110'],3:[ZH?'离':'離','Li','Fire','101'],4:['震','Zhen','Thunder','100'],5:['巽','Xun','Wind','011'],6:['坎','Kan','Water','010'],7:['艮','Gen','Mountain','001'],8:['坤','Kun','Earth','000']};
let mode='iching',HEX=[],LINES=[],RES=null;
fetch('data/hexagrams.json').then(r=>r.json()).then(d=>HEX=d);
const $=id=>document.getElementById(id);
const fill=(s,o)=>s.replace(/\{(\w+)\}/g,(_,k)=>o[k]);
const zhName=h=>ZH&&window.HEX_ZH_S?HEX_ZH_S[h.n]:h.zh;
const label=h=>ZH?(h.n+'. '+zhName(h)+' · '+HEX_ZH[h.n][0]):(h.n+'. '+h.zh+' '+h.pinyin+' — '+h.name);
function setMode(m){mode=m;document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('on',b.dataset.t===m));
 $('ptitle').textContent=T[m][0];$('pdesc').textContent=T[m][1];$('q').placeholder=T[m][2];$('aiout').textContent='';
 clearTimeout(window.__navT);if(window.__aiCtl)window.__aiCtl.abort();$('go').hidden=!RES;$('go').textContent=m==='name'?S.sug:S.req;}
function goto(n){document.querySelectorAll('.step').forEach(s=>s.hidden=+s.dataset.step!==n);document.querySelectorAll('.stepper li').forEach(li=>{li.classList.toggle('on',+li.dataset.s===n);li.classList.toggle('done',+li.dataset.s<n);});
 const o=document.getElementById('oracle');if(o&&o.getBoundingClientRect().top<0)o.scrollIntoView({behavior:'smooth'});}
function questionReady(){return $('q').value.trim().length>0;}
function syncNext(){const ok=questionReady(),btn=$('tostep2');if(!btn)return;btn.disabled=!ok;let hint=$('qhint');if(!hint){hint=document.createElement('p');hint.id='qhint';hint.className='qhint';btn.parentNode.insertBefore(hint,btn);}hint.textContent=S.needQ;hint.hidden=ok;}
$('q').addEventListener('input',syncNext);
$('tostep2').onclick=()=>{if(!questionReady()){syncNext();return;}if(mode==='name'){RES=null;$('hexout').innerHTML='';$('go').hidden=false;$('go').textContent=S.sug;$('aiout').textContent='';goto(3);}else goto(2);};
document.querySelectorAll('[data-goto]').forEach(b=>b.onclick=()=>goto(+b.dataset.goto));
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>setMode(b.dataset.t));
document.querySelectorAll('.methods button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.methods button').forEach(x=>x.classList.toggle('on',x===b));
 document.querySelectorAll('.mpane').forEach(p=>p.hidden=p.id!=='m-'+b.dataset.m);});
function render(){const box=$('lines');box.innerHTML='';
 for(let i=0;i<6;i++){const v=LINES[i],d=document.createElement('div');d.className='ln '+(v===undefined?'empty':(v%2?'yang':'yin'))+(v===6||v===9?' chg':'');
  d.innerHTML='<span class="lab">'+S.line[i]+'</span><span class="bar"><i></i>'+(v!==undefined&&v%2===0?'<i></i>':'')+'</span><span class="val">'+(v===undefined?'':S.v[v])+'</span>';box.appendChild(d);}
 $('caststatus').textContent=LINES.length<6?fill(S.next,{i:LINES.length+1,p:S.line[LINES.length]}):S.done;
 document.querySelectorAll('.coinbtn').forEach(b=>b.disabled=LINES.length>=6);}
function clearHl(){document.querySelectorAll('#hexgrid .hx').forEach(c=>c.classList.remove('hl','hl2'));}
function reset(){clearTimeout(window.__navT);if(window.__aiCtl)window.__aiCtl.abort();LINES=[];RES=null;$('hexout').innerHTML='';$('aiout').textContent='';$('go').hidden=true;clearHl();render();goto(mode==='name'?1:2);}
document.querySelectorAll('.coinbtn').forEach(b=>b.onclick=()=>{if(LINES.length>=6)return;LINES.push(+b.dataset.v);render();if(LINES.length===6)finish();});
$('undo').onclick=()=>{if(RES){RES=null;$('hexout').innerHTML='';$('go').hidden=true;clearHl();}LINES.pop();render();};
document.querySelectorAll('.reset').forEach(b=>b.onclick=reset);
function numberCast(a,b,c,note){if(![a,b,c].every(x=>Number.isInteger(x)&&x>0)){RES=null;$('go').hidden=true;$('aiout').textContent='';$('hexout').textContent=S.bad;return;}
 const ra=a%8,rb=b%8,rc=c%6,u=ra||8,l=rb||8,m=rc||6;
 const bits=TRI[l][3]+TRI[u][3];LINES=[...bits].map((x,i)=>x==='1'?(i+1===m?9:7):(i+1===m?6:8));render();
 const tn=k=>TRI[k][0]+(ZH?'（'+['','天','泽','火','雷','风','水','山','地'][k]+'）':' ('+TRI[k][2]+')');
 finish((note||'')+fill(S.calc,{a,ra,b,rb,c,rc,u:tn(u),l:tn(l),m}));}
document.querySelectorAll('.numcast').forEach(b=>b.onclick=()=>{const v=[...b.closest('.mpane').querySelectorAll('input[type=number]')].map(i=>Number(i.value));numberCast(v[0],v[1],v[2]);});
$('usetime').onclick=()=>{const d=new Date(),p={};new Intl.DateTimeFormat('en-u-ca-chinese',{year:'numeric',month:'numeric',day:'numeric',timeZone:'Asia/Shanghai'}).formatToParts(d).forEach(x=>p[x.type]=x.value);
 const ry=parseInt(p.relatedYear||p.year,10),Y=((ry-4)%12+12)%12+1,M=parseInt(p.month,10),D=parseInt(p.day,10);
 const h=parseInt(new Intl.DateTimeFormat('en-GB',{hour:'numeric',hourCycle:'h23',timeZone:'Asia/Shanghai'}).format(d),10),H=Math.floor((h+1)/2)%12+1;
 const BR='子丑寅卯辰巳午未申酉戌亥',a=Y+M+D,b=a+H,f=$('m-number').querySelectorAll('input[type=number]');f[0].value=a;f[1].value=b;f[2].value=b;
 const note=S.time+(ZH?`${BR[Y-1]}年(${Y}) + 农历${M}月 + ${D}日 = ${a}；再加${BR[H-1]}时(${H}) = ${b}。`:`year ${BR[Y-1]} (${Y}) + lunar month ${M} + day ${D} = ${a}; plus hour ${BR[H-1]} (${H}) = ${b}. `);
 numberCast(a,b,b,note+' ');};
const find=b=>HEX.find(h=>h.lines===b);
function finish(note){if(!HEX.length){setTimeout(()=>finish(note),200);return;}
 const pri=LINES.map(x=>x%2).join(''),rel=LINES.map(x=>x===6?1:x===9?0:x%2).join('');const h=find(pri),h2=pri!==rel?find(rel):null;
 const mv=LINES.map((x,i)=>x===6||x===9?i+1:0).filter(Boolean);RES={h,h2,mv};
 const jd=x=>ZH?(x.judgment_zh||HEX_ZH[x.n][1]):x.judgment_legge;const sym=x=>String.fromCodePoint(0x4DC0+x.n-1);
 const im=x=>ZH?x.image_zh:x.image_legge,pl=x=>ZH?x.plain_zh:x.plain_en,lb=ZH?['卦辞','大象','注解']:['Judgment','The Image','In plain words'];
 const card=(x,t)=>'<div class="rcard"><p class="meta">'+t+'</p><div class="rsym">'+sym(x)+'</div><h4>'+label(x)+'</h4><p class="jd"><em>'+lb[0]+'</em> '+jd(x)+'</p>'+(im(x)?'<p class="jd"><em>'+lb[1]+'</em> '+im(x)+'</p>':'')+(pl(x)?'<p class="plain"><em>'+lb[2]+'</em> '+pl(x)+'</p>':'')+'</div>';
 let html=(note?'<p class="calc">'+note+'</p>':'')+'<div class="res">'+card(h,S.primary)+(h2?'<div class="rarrow" aria-hidden="true">→</div>'+card(h2,S.changed):'')+'</div><p class="mv">'+(mv.length?S.moving+mv.map(i=>S.line[i-1]).join(ZH?'、':', '):S.none)+'</p>';
 $('hexout').innerHTML=html;clearHl();const cells=document.querySelectorAll('#hexgrid .hx');if(cells.length){cells[h.n-1].classList.add('hl');if(h2)cells[h2.n-1].classList.add('hl2');}
 $('go').hidden=false;$('go').textContent=S.req;clearTimeout(window.__navT);window.__navT=setTimeout(()=>goto(3),700);}
$('go').onclick=async()=>{
 if(mode==='name'){$('aiout').textContent=S.nameOff;return;}
 const q=$('q').value.trim();
 if([...q].length>100){$('aiout').textContent=ZH?'问题请写在100个字以内。':'Please keep the question to 100 characters or fewer.';return;}
 if(!RES)return;const ctx={hexagram:RES.h.n,lines:LINES.slice(),question:q,lang:ZH?'zh':'en'};
 $('aiout').textContent=S.wait;$('go').disabled=true;if(window.__aiCtl)window.__aiCtl.abort();const ctl=new AbortController();window.__aiCtl=ctl;const to=setTimeout(()=>ctl.abort(),25000);
 try{const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},referrerPolicy:'strict-origin',body:JSON.stringify(ctx),signal:ctl.signal});if(r.status===429){if(window.__aiCtl===ctl)$('aiout').textContent=ZH?'今天的解卦次数已用完，请明天再试。':'Today’s reading limit has been reached. Please try again tomorrow.';return;}if(!r.ok)throw 0;const j=await r.json();if(!j.text)throw 0;if(window.__aiCtl===ctl)$('aiout').textContent=j.text;}
 catch(e){if(window.__aiCtl===ctl)$('aiout').textContent=mode==='name'?S.nameOff:S.off;}finally{clearTimeout(to);if(window.__aiCtl===ctl){$('go').disabled=false;window.__aiCtl=null;}}};
setMode('iching');render();syncNext();
