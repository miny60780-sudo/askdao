/* 展示层过滤宗教法事类条目（不改动 vendor 库）；保留“祭祀” */
const ALM_HIDE=['开光','斋醮','祈福'];
function almF(a){return (a||[]).filter(x=>!ALM_HIDE.includes(x));}
function almE(h){return h||(document.documentElement.lang.startsWith('zh')?'无':'None');}
/* AskDao almanac. All data comes from lunar-javascript (6tail, MIT) in js/vendor/lunar.js; nothing is computed or invented here. */
(function(){
const ZH=document.documentElement.lang.startsWith('zh');const A=window.ALM_EN||{en:{},other:{},jq:{},untranslated:[]},PY=window.ALM_PY||{},CPY=window.ALM_CPY||{};
const esc=t=>String(t==null?'':t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pyOf=t=>PY[t]||[...t].map(c=>CPY[c]||'').filter(Boolean).join(' ');
// English term: translation if in table, otherwise Chinese + pinyin (never an invented meaning)
function term(t){if(ZH)return '<span class="tm">'+esc(t)+'</span>';const e=A.en[t]||A.other[t]||A.jq[t];
 if(e&&A.untranslated.indexOf(t)<0)return '<span class="tm" title="'+esc(t+' · '+pyOf(t))+'">'+esc(e)+'</span>';
 return '<span class="tm fb">'+esc(t)+' <i>'+esc(pyOf(t))+'</i></span>';}
const gz=t=>ZH?esc(t):esc(t)+' <i>'+esc(pyOf(t))+'</i>';
function info(d){const L=d.getLunar();const jq=L.getJieQi(),pj=L.getPrevJieQi(true);
 return {solar:d,L,ymd:d.toYmd(),lunar:(ZH?'':'')+L.getMonthInChinese()+'月'+L.getDayInChinese(),lyear:L.getYearInGanZhi(),year:L.getYearInGanZhi(),month:L.getMonthInGanZhi(),day:L.getDayInGanZhi(),sx:L.getYearShengXiao(),
  jq,pjq:pj.getName(),pjqDate:pj.getSolar().toYmd(),yi:almF(L.getDayYi()),ji:almF(L.getDayJi()),chong:L.getDayChongDesc(),chongSx:L.getDayChongShengXiao(),sha:L.getDaySha(),pz:[L.getPengZuGan(),L.getPengZuZhi()],
  pos:[['喜神',L.getDayPositionXiDesc()],['福神',L.getDayPositionFuDesc()],['财神',L.getDayPositionCaiDesc()],['阳贵神',L.getDayPositionYangGuiDesc()],['阴贵神',L.getDayPositionYinGuiDesc()]],
  ny:[L.getYearNaYin(),L.getMonthNaYin(),L.getDayNaYin()]};}
window.ALM={info,term,gz,esc,pyOf};
const T=ZH?{yi:'宜',ji:'忌',chong:'冲',sha:'煞',more:'查看完整黄历 →'}:{yi:'Favourable',ji:'Avoid',chong:'Clashes with',sha:'Sha direction',more:'Open the full almanac →'};
const chongTxt=i=>ZH?esc(i.chong):term(i.chongSx)+' <i>('+esc(i.chong.replace(/[^\u4e00-\u9fff]/g,'').slice(0,2))+' '+esc(pyOf(i.chong.replace(/[^\u4e00-\u9fff]/g,'').slice(0,2)))+')</i>';
// homepage card
const card=document.getElementById('almcard');
if(card&&window.Solar){const n=new Date(Date.now()+8*3600e3);const i=info(Solar.fromYmd(n.getUTCFullYear(),n.getUTCMonth()+1,n.getUTCDate()));
 card.querySelector('.ad').innerHTML=ZH?esc(i.ymd+' · 农历'+i.lunar+' · '+i.day+'日'):esc(i.ymd)+' · lunar '+esc(i.lunar)+' · day '+gz(i.day);
 card.querySelector('.ay').innerHTML='<b>'+T.yi+'</b> '+almE(i.yi.slice(0,5).map(term).join(ZH?' ':', '));
 card.querySelector('.aj').innerHTML='<b>'+T.ji+'</b> '+almE(i.ji.slice(0,5).map(term).join(ZH?' ':', '));
 card.querySelector('.ac').innerHTML='<b>'+T.chong+'</b> '+chongTxt(i);}
// calendar page
const cal=document.getElementById('calgrid');if(!cal||!window.Solar)return;
const W=ZH?['日','一','二','三','四','五','六']:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const now=new Date(Date.now()+8*3600e3);let Y=now.getUTCFullYear(),M=now.getUTCMonth()+1,sel=Solar.fromYmd(Y,M,now.getUTCDate()).toYmd();
const p=new URLSearchParams(location.search).get('d');if(p&&/^\d{4}-\d{2}-\d{2}$/.test(p)){const a=p.split('-').map(Number);Y=a[0];M=a[1];sel=p;}
function month(){const first=Solar.fromYmd(Y,M,1),days=SolarUtil.getDaysOfMonth(Y,M),off=first.getWeek();
 document.getElementById('caltitle').textContent=ZH?Y+'年'+M+'月':new Date(Date.UTC(Y,M-1,1)).toLocaleDateString('en-US',{month:'long',year:'numeric',timeZone:'UTC'});
 let h=W.map(w=>'<div class="cw">'+w+'</div>').join('');for(let k=0;k<off;k++)h+='<div class="cd empty"></div>';
 const td=Solar.fromYmd(now.getUTCFullYear(),now.getUTCMonth()+1,now.getUTCDate()).toYmd();
 for(let d=1;d<=days;d++){const s=Solar.fromYmd(Y,M,d),L=s.getLunar(),jq=L.getJieQi(),ymd=s.toYmd();
  const sub=jq||(L.getDay()===1?L.getMonthInChinese()+'月':L.getDayInChinese());
  h+='<button type="button" class="cd'+(ymd===sel?' on':'')+(jq?' jq':'')+(ymd===td?' today':'')+'" data-d="'+ymd+'"><b>'+d+'</b><small>'+esc(sub)+'</small></button>';}
 cal.innerHTML=h;cal.querySelectorAll('.cd[data-d]').forEach(b=>b.onclick=()=>{sel=b.dataset.d;cal.querySelectorAll('.cd.on').forEach(x=>x.classList.remove('on'));b.classList.add('on');day();});}
function row(k,v){return '<div class="dr"><dt>'+k+'</dt><dd>'+v+'</dd></div>';}
function day(){const a=sel.split('-').map(Number),i=info(Solar.fromYmd(a[0],a[1],a[2]));const el=document.getElementById('calday');
 const dEN=new Date(Date.UTC(a[0],a[1]-1,a[2])).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric',timeZone:'UTC'});
 const K=ZH?{g:'公历',l:'农历',gz:'干支',sx:'生肖',jq:'节气',yi:'宜',ji:'忌',cs:'冲煞',pz:'彭祖百忌',pos:'吉神方位',ny:'五行纳音',y:'年',m:'月',d:'日'}:
  {g:'Gregorian date',l:'Lunar date',gz:'Stem-branch (ganzhi)',sx:'Zodiac animal (year)',jq:'Solar term',yi:'Favourable (宜 yí)',ji:'Avoid (忌 jì)',cs:'Clash & sha (冲煞)',pz:'Pengzu taboos (彭祖百忌)',pos:'Auspicious directions',ny:'Five-phase nayin (纳音)',y:'year',m:'month',d:'day'};
 const posN=ZH?{}:{'喜神':'Joy (喜神 xǐ shén)','福神':'Fortune (福神 fú shén)','财神':'Wealth (财神 cái shén)','阳贵神':'Yang noble (阳贵神)','阴贵神':'Yin noble (阴贵神)'};
 let h='<h3>'+(ZH?esc(a[0]+'年'+a[1]+'月'+a[2]+'日 星期'+W[i.solar.getWeek()]):esc(dEN))+'</h3><dl>';
 h+=row(K.l,ZH?'农历'+esc(i.L.getYearInGanZhi()+'年 '+i.lunar):esc(i.lunar)+' <i>(year '+gz(i.year)+')</i>');
 h+=row(K.gz,[[i.year,K.y],[i.month,K.m],[i.day,K.d]].map(x=>gz(x[0])+(ZH?x[1]:' <small>'+x[1]+'</small>')).join(ZH?' ':' · '));
 h+=row(K.sx,term(i.sx)+(ZH?'':' <i>'+esc(i.sx)+'</i>'));
 h+=row(K.jq,i.jq?term(i.jq)+(ZH?'':' <i>'+esc(i.jq)+'</i>'):(ZH?'今日非节气；当前处于'+esc(i.pjq)+'（'+esc(i.pjqDate)+'起）':'No term begins today; within '+term(i.pjq)+' <i>'+esc(i.pjq)+'</i>, from '+esc(i.pjqDate)));
 h+=row(K.yi,'<span class="yi">'+almE(i.yi.map(term).join(''))+'</span>');h+=row(K.ji,'<span class="ji">'+almE(i.ji.map(term).join(''))+'</span>');
 h+=row(K.cs,ZH?esc('冲'+i.chong+' 煞'+i.sha):(ZH?'':'Clashes with '+chongTxt(i)+' · sha in the '+term(i.sha)+' <i>(煞'+esc(i.sha)+')</i>'));
 h+=row(K.pz,i.pz.map(x=>'<span class="cn">'+esc(x)+'</span>').join('<br>')+(ZH?'':'<br><small>Traditional sayings on what to avoid for the day\'s stem and branch; shown in the original Chinese.</small>'));
 h+=row(K.pos,i.pos.map(x=>(ZH?esc(x[0]):posN[x[0]])+': '+term(x[1])).join(ZH?'　':' · '));
 h+=row(K.ny,[[i.ny[0],K.y],[i.ny[1],K.m],[i.ny[2],K.d]].map(x=>(ZH?esc(x[0])+x[1]:esc(x[0])+' <i>'+esc(pyOf(x[0]))+'</i> <small>('+x[1]+')</small>')).join(ZH?'　':' · '));
 el.innerHTML=h+'</dl>';history.replaceState(null,'','?d='+sel);}
document.getElementById('prevm').onclick=()=>{M--;if(M<1){M=12;Y--;}month();};document.getElementById('nextm').onclick=()=>{M++;if(M>12){M=1;Y++;}month();};
document.getElementById('todayb').onclick=()=>{const n=new Date(Date.now()+8*3600e3);Y=n.getUTCFullYear();M=n.getUTCMonth()+1;sel=Solar.fromYmd(Y,M,n.getUTCDate()).toYmd();month();day();};
month();day();
})();
