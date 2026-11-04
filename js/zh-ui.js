/* 中文界面适配：在不修改 app.js 的前提下，把其生成的文字换成中文 */
(function(){
if(typeof T==='undefined')return;
Object.keys(T_ZH).forEach(k=>{T[k]=T_ZH[k]});
const orig=setMode;
window.setMode=function(m){orig(m);document.getElementById('go').textContent=m==='name'?'推荐':'起卦';};
setMode(mode);
// 卦辞中文化：等 app.js 读取完数据后替换
const patch=()=>{if(!HEX.length)return setTimeout(patch,100);HEX.forEach(h=>{const z=HEX_ZH[h.n];if(!z||h._zh)return;const p=z[1].split('。');h.zh=HEX_ZH_S[h.n];h.pinyin='';h.name=z[0];h.image=p[0]+'。';h.judgment=p.slice(1).join('。');h._zh=1;});};patch();
const MAP=[['Hexagram data loading, try again.','卦象数据加载中，请稍后再试。'],['Consulting…','正在解读…'],
 ['AI name suggestions are offline right now. Tip: classic Chinese names often pair a virtue (德 virtue, 安 peace, 明 bright) with a nature image (林 forest, 雪 snow, 川 river).','AI 取名暂时无法使用。小提示：传统中文名常把一种品德（如德、安、明）与一个自然意象（如林、雪、川）搭配。'],
 ['Reflection: the ancients read hexagrams as mirrors, not verdicts. Consider how the judgment above relates to your situation, and what small, steady action fits the moment.','思考：古人把卦象当作一面镜子，而非定论。不妨想想上面的卦辞与你的处境有何关联，此刻适合迈出怎样平稳的一小步。']];
const ai=document.getElementById('aiout');
new MutationObserver(()=>{const t=ai.textContent;MAP.forEach(([e,z])=>{if(t===e)ai.textContent=z;});}).observe(ai,{childList:true,characterData:true,subtree:true});
const ho=document.getElementById('hexout');
new MutationObserver(()=>{const w=document.createTreeWalker(ho,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){if(n.parentNode.closest('.hex'))continue;
 let v=n.nodeValue;const v2=v.replace(/^(\d+\. \S+)\s+—\s+/,'$1 · ').replace(/^: /,'：').replace('Image:','象曰：').replace('Changing to →','变卦 →').replace('Hexagram data loading, try again.','卦象数据加载中，请稍后再试。');if(v2!==v)n.nodeValue=v2;}}).observe(ho,{childList:true,subtree:true});
})();
