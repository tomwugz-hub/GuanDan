(function () {
  const G = window.Guandan;
  document.querySelectorAll('.tab').forEach((t) => {
    t.onclick = () => {
      document.querySelectorAll('.tab').forEach((x) => x.classList.remove('on'));
      document.querySelectorAll('.page').forEach((x) => x.classList.remove('on'));
      t.classList.add('on');
      document.getElementById(t.dataset.tab).classList.add('on');
    };
  });

  const p = G.loadProfile();
  const dims = p.dims;
  const sw = G.strengthsWeaknesses(dims);
  document.getElementById('sw').innerHTML =
    '优势：' + sw.strengths.map((x) => x.name).join('、') + '<br>短板：' + sw.weaknesses.map((x) => x.name).join('、');
  document.getElementById('sug').innerHTML = sw.suggestions.map((s) => '<li>' + s + '</li>').join('');

  const plan = G.weeklyPlan(dims);
  document.getElementById('pathList').innerHTML = plan
    .map((d) => '<div class="panel">' + d.day + ' · ' + d.focus + ' · ' + d.drill + ' · ' + d.minutes + ' 分钟</div>')
    .join('');

  document.getElementById('btnExp').onclick = () => {
    document.getElementById('replayBox').value = G.exportReplay(p.deals);
  };
  document.getElementById('btnImp').onclick = () => {
    try {
      G.importReplay(document.getElementById('replayBox').value);
      alert('已导入');
    } catch (e) {
      alert(e.message);
    }
  };
  const errCounts = {};
  for (const e of p.errors) errCounts[e.id || e.name || 'other'] = (errCounts[e.id || 'other'] || 0) + 1;
  const common = Object.entries(errCounts).sort((a, b) => b[1] - a[1])[0];
  document.getElementById('commonErr').textContent = common ? common[0] + ' ×' + common[1] : '暂无';
  document.getElementById('errList').innerHTML = (p.errors || [])
    .slice(-12)
    .map((e) => '<div>' + (e.name || e.id) + ' · ' + (e.severity || '') + '</div>')
    .join('');
  document.getElementById('dimCh').textContent = G.SKILL_DIMS.map((d) => d.name + ' ' + (dims[d.id] | 0)).join(' · ');

  function radar(cv, values) {
    const ctx = cv.getContext('2d');
    const cx = 180, cy = 160, r = 110, n = values.length;
    ctx.fillStyle = '#2a5238';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.strokeStyle = '#9ad4b4';
    for (let ring = 1; ring <= 4; ring++) {
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const a = ((Math.PI * 2) / n) * (i % n) - Math.PI / 2;
        const x = cx + Math.cos(a) * (r * ring) / 4;
        const y = cy + Math.sin(a) * (r * ring) / 4;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.fillStyle = 'rgba(47,143,106,0.55)';
    values.forEach((v, i) => {
      const a = ((Math.PI * 2) / n) * i - Math.PI / 2;
      const x = cx + Math.cos(a) * r * (v / 100);
      const y = cy + Math.sin(a) * r * (v / 100);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f4fff6';
    ctx.font = '12px sans-serif';
    G.SKILL_DIMS.forEach((d, i) => {
      const a = ((Math.PI * 2) / n) * i - Math.PI / 2;
      ctx.fillText(d.name, cx + Math.cos(a) * (r + 16) - 20, cy + Math.sin(a) * (r + 16));
    });
  }
  radar(document.getElementById('radarCv'), G.SKILL_DIMS.map((d) => dims[d.id] || 0));

  function line(cv, arr) {
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#2a5238';
    ctx.fillRect(0, 0, cv.width, cv.height);
    if (!arr.length) { ctx.fillStyle = "#c5e6cf"; ctx.font = "14px sans-serif"; ctx.fillText("暂无对局数据，打几局后再看胜率曲线。", 24, cv.height / 2); return; }
    const data = arr;
    ctx.strokeStyle = '#b8f0cc';
    ctx.beginPath();
    data.forEach((v, i) => {
      const x = 20 + (i * (cv.width - 40)) / Math.max(1, data.length - 1);
      const y = cv.height - 20 - v * (cv.height - 40);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
  function bars(cv, obj) {
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#2a5238';
    ctx.fillRect(0, 0, cv.width, cv.height);
    const keys = Object.keys(obj).length ? Object.keys(obj) : G.ERROR_TYPES.map((e) => e.id);
    const vals = keys.map((k) => obj[k] || 1);
    const max = Math.max(1, ...vals);
    keys.forEach((k, i) => {
      const h = (vals[i] / max) * 120;
      ctx.fillStyle = '#2f8f6a';
      ctx.fillRect(20 + i * 40, 160 - h, 28, h);
    });
  }
  const wr = [];
  let w = 0, n = 0;
  for (const d of p.deals) {
    n += 1;
    if (d.win) w += 1;
    wr.push(w / n);
  }
  line(document.getElementById('winCv'), wr);
  bars(document.getElementById('errCv'), errCounts);
})();
