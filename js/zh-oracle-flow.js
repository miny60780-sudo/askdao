/* 中文版右栏问卦：成六爻后本卦/变卦/原文白话/AI 同栏连续展示。仅 body.zh3 生效，不改英文路径。 */
(function () {
  if (!document.body.classList.contains('zh3')) return;

  const $ = (id) => document.getElementById(id);
  const wrap = () => document.querySelector('.side-wrap');

  function clearLineSum() {
    const el = $('linesum');
    if (!el) return;
    el.innerHTML = '';
    el.hidden = true;
  }

  function buildLineSum() {
    if (!LINES || LINES.length < 6) return '';
    let html = '<p class="meta">你的六爻</p><div class="lines lines-compact" aria-label="六爻摘要">';
    for (let i = 0; i < 6; i++) {
      const v = LINES[i];
      const cls = 'ln ' + (v % 2 ? 'yang' : 'yin') + (v === 6 || v === 9 ? ' chg' : '');
      html +=
        '<div class="' +
        cls +
        '"><span class="lab">' +
        S.line[i] +
        '</span><span class="bar"><i></i>' +
        (v % 2 === 0 ? '<i></i>' : '') +
        '</span><span class="val">' +
        S.v[v] +
        '</span></div>';
    }
    return html + '</div>';
  }

  function showLineSum() {
    const el = $('linesum');
    if (!el) return;
    if (mode === 'name' || !LINES || LINES.length < 6) {
      clearLineSum();
      return;
    }
    el.innerHTML = buildLineSum();
    el.hidden = false;
  }

  function scrollSideToResult() {
    const w = wrap();
    const target = $('linesum') && !$('linesum').hidden ? $('linesum') : $('hexout');
    if (!w || !target) return;
    requestAnimationFrame(() => {
      const wr = w.getBoundingClientRect();
      const tr = target.getBoundingClientRect();
      const next = w.scrollTop + (tr.top - wr.top) - 8;
      w.scrollTo({ top: Math.max(0, next), behavior: 'smooth' });
    });
  }

  // 右栏内滚动；勿把页面主滚动拉到中栏 / 六十四卦
  window.goto = function (n) {
    document.querySelectorAll('.step').forEach((s) => {
      s.hidden = +s.dataset.step !== n;
    });
    document.querySelectorAll('.stepper li').forEach((li) => {
      li.classList.toggle('on', +li.dataset.s === n);
      li.classList.toggle('done', +li.dataset.s < n);
    });
    if (n === 3) scrollSideToResult();
  };

  window.finish = function (note) {
    if (!HEX.length) {
      setTimeout(() => finish(note), 200);
      return;
    }
    const pri = LINES.map((x) => x % 2).join('');
    const rel = LINES.map((x) => (x === 6 ? 1 : x === 9 ? 0 : x % 2)).join('');
    const h = find(pri);
    const h2 = pri !== rel ? find(rel) : null;
    const mv = LINES.map((x, i) => (x === 6 || x === 9 ? i + 1 : 0)).filter(Boolean);
    RES = { h, h2, mv };
    const jd = (x) => (ZH ? x.judgment_zh || HEX_ZH[x.n][1] : x.judgment_legge);
    const sym = (x) => String.fromCodePoint(0x4dc0 + x.n - 1);
    const im = (x) => (ZH ? x.image_zh : x.image_legge);
    const pl = (x) => (ZH ? x.plain_zh : x.plain_en);
    const lb = ZH ? ['卦辞', '大象', '注解'] : ['Judgment', 'The Image', 'In plain words'];
    const card = (x, t) =>
      '<div class="rcard"><p class="meta">' +
      t +
      '</p><div class="rsym">' +
      sym(x) +
      '</div><h4>' +
      label(x) +
      '</h4><p class="jd"><em>' +
      lb[0] +
      '</em> ' +
      jd(x) +
      '</p>' +
      (im(x) ? '<p class="jd"><em>' + lb[1] + '</em> ' + im(x) + '</p>' : '') +
      (pl(x) ? '<p class="plain"><em>' + lb[2] + '</em> ' + pl(x) + '</p>' : '') +
      '</div>';
    let html =
      (note ? '<p class="calc">' + note + '</p>' : '') +
      '<div class="res">' +
      card(h, S.primary) +
      (h2 ? '<div class="rarrow" aria-hidden="true">→</div>' + card(h2, S.changed) : '') +
      '</div><p class="mv">' +
      (mv.length ? S.moving + mv.map((i) => S.line[i - 1]).join(ZH ? '、' : ', ') : S.none) +
      '</p>';
    $('hexout').innerHTML = html;
    // 中文三栏：不高亮中栏 #hexgrid，避免视线被拉走
    clearHl();
    showLineSum();
    $('go').hidden = false;
    $('go').textContent = S.req;
    setTimeout(() => goto(3), 480);
  };

  const origReset = window.reset;
  function zhReset() {
    clearLineSum();
    origReset();
  }
  window.reset = zhReset;
  // app.js 已把原始 reset 绑到 .reset 的 onclick，需重绑
  document.querySelectorAll('.reset').forEach((b) => {
    b.onclick = zhReset;
  });

  // 取名模式直达第 3 步时无六爻摘要
  const to2 = $('tostep2');
  if (to2) {
    const prev = to2.onclick;
    to2.onclick = function (e) {
      if (mode === 'name') clearLineSum();
      if (typeof prev === 'function') return prev.call(this, e);
    };
  }
})();
