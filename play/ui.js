/** 浏览器界面：玩家坐南（座位 0），其余三家由 decide（或 Jev）出牌。 */
import {
  newGame, startDeal, play, botStepDecide, coachMove, snapshot, isLeading, isOver, sortHand,
  moveText, moveKey, interpretPlay, cardsFromStrings, flagToCase, SEAT_NAMES, PLACE_NAMES, formatCard, labelCombo,
  tributePending, tributeGive, gameLogJsonl, archiveDeal, tributeReturn, autoTribute, returnChoices, botReturnCard,
} from './core.js';
import { isWildCard } from '../engine/ranks.js';

const $ = (id) => document.getElementById(id);
const HUMAN = 0;
let G = null;
let token = 0;
let selected = new Set();
let hintIds = new Set();
let coachCache = null; // { at: logLen, c }
let flagTarget = null;
let flagBtn = null;
let jevAvailable = false;
let botBusy = false;
let flags = loadFlags();
// 进贡界面状态：null | 'give'（看/确认进贡）| 'return'（你选还贡牌）| 'summary'（显示结果，点“开始出牌”）| 'resist'
let tribMode = null;

function loadFlags() {
  try { return JSON.parse(localStorage.getItem('gd_flags') || '[]'); } catch { return []; }
}
function saveFlags() {
  try { localStorage.setItem('gd_flags', JSON.stringify(flags)); } catch { /* ignore */ }
  $('flagCount').textContent = flags.length;
}

const SEAT_COMPACT = ['南（你）', '东·下家', '北·对家', '西·上家'];
function compact() { return window.innerWidth < 900 || window.innerHeight <= 500; }
/** 教练提示与出牌记录放在侧边抽屉里；宽屏（≥1280×640）默认展开。 */
function placeCoach() {
  if (placeCoach.done) return;
  placeCoach.done = true;
  if (window.innerWidth >= 1280 && window.innerHeight >= 640) setDrawer(true);
}
function setDrawer(open) {
  document.body.classList.toggle('drawerOpen', open);
  if (open) $('coachTip').classList.add('hidden');
}
/** 抽屉关着时，在手牌上方弹出一条教练提示（点它打开抽屉）。 */
function coachTip(html) {
  const el = $('coachTip');
  if (!html || document.body.classList.contains('drawerOpen')) { el.classList.add('hidden'); return; }
  el.innerHTML = html;
  el.classList.remove('hidden');
}
/** 简单的 SVG 头像（无版权素材）：不同底色 + 人形剪影。 */
const AV_COLORS = [['#ffb347', '#e0731b'], ['#6fc3ff', '#2a7fd0'], ['#9be37a', '#3f9c34'], ['#ff8fb1', '#c9406b']];
function avatarSvg(s) {
  const [a, b] = AV_COLORS[s];
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><defs><radialGradient id="avg${s}" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient></defs>` +
    `<circle cx="32" cy="32" r="32" fill="url(#avg${s})"/><circle cx="32" cy="25" r="11" fill="#fff" fill-opacity=".92"/>` +
    `<path d="M12 56c2-12 11-18 20-18s18 6 20 18" fill="#fff" fill-opacity=".92"/></svg>`;
}
const SUIT_SYM = { S: '♠', H: '♥', D: '♦', C: '♣' };
function cardEl(c, cls = '') {
  const el = document.createElement('div');
  const lv = G.match.levelRank;
  el.className = `card ${cls}`;
  if (c.rank === 'RJ' || c.rank === 'BJ') {
    el.classList.add('joker');
    if (c.rank === 'RJ') el.classList.add('red');
    el.innerHTML = `<span class="cr">J<br>O<br>K<br>E<br>R</span><span class="strip">${c.rank === 'RJ' ? '大王' : '小王'}</span><span class="jk">${c.rank === 'RJ' ? '大王' : '小王'}</span>`;
  } else {
    if (c.suit === 'H' || c.suit === 'D') el.classList.add('red');
    const sym = SUIT_SYM[c.suit] || '';
    const rk = c.rank === 'T' ? '10' : c.rank;
    el.innerHTML = `<span class="cr">${rk}<br><span class="s">${sym}</span></span><span class="strip">${rk}<span class="s">${sym}</span></span><span class="pip">${sym}</span>`;
    if (c.rank === lv) el.classList.add('level');
    if (isWildCard(c, lv)) { el.classList.add('wild'); el.insertAdjacentHTML('beforeend', '<span class="wildTag">配</span>'); }
  }
  return el;
}

function engineMode() { return $('engine').value === 'jev' && jevAvailable ? 'jev' : 'decide'; }

function render() {
  const r = G.round;
  const m = G.match;
  $('level').textContent = m.levelRank;
  $('lvUs').textContent = m.teamLevel[0];
  $('lvThem').textContent = m.teamLevel[1];
  $('dealNo').textContent = G.dealNo;
  $('turn').textContent = isOver(G) ? '本副结束' : tribMode ? '进贡' : SEAT_NAMES[r.currentSeat];
  const showAll = $('showAll').checked;
  for (let s = 0; s < 4; s++) {
    const box = $(`seat${s}`);
    const isTurn = !isOver(G) && !tribMode && r.currentSeat === s;
    box.classList.toggle('turn', isTurn);
    const n = r.hands[s].length;
    const placeIdx = r.finished.indexOf(s);
    const tp = G.lastTablePlay[s];
    const team = s % 2;
    box.innerHTML = '';
    box.classList.toggle('teamUs', team === 0);
    box.classList.toggle('teamThem', team === 1);
    const head = document.createElement('div');
    head.className = 'head';
    const place = placeIdx >= 0 && (n === 0 || isOver(G)) ? `<span class="place">${PLACE_NAMES[placeIdx]}</span>` : '';
    head.innerHTML = `<div class="avatar">${avatarSvg(s)}<span class="ring"></span>${place}</div>` +
      `<div class="meta"><span class="name">${compact() ? SEAT_COMPACT[s] : SEAT_NAMES[s]}</span>` +
      `<span class="tag">${s === HUMAN ? '我' : s === 2 ? '队友' : '对手'} · 打${m.teamLevel[team]}</span></div>` +
      `<span class="cnt ${n === 0 ? 'out' : n <= 5 ? 'warn' : ''}">${n === 0 ? '出完' : n + ' 张'}</span>`;
    box.appendChild(head);
    const pl = $(`pz${s}`);
    pl.className = 'pz played';
    pl.innerHTML = '';
    if (tp?.pass) pl.innerHTML = '<span class="passed">不出</span>';
    else if (tp?.cards) {
      const row = document.createElement('div');
      row.className = 'fan';
      for (const c of tp.cards) row.appendChild(cardEl(c, 'small'));
      pl.appendChild(row);
      const t = document.createElement('span');
      t.className = 'tag';
      t.textContent = labelCombo(tp.combo);
      pl.appendChild(t);
      pl.classList.toggle('last', r.lastPlayer === s && !isLeading(G));
    }
    if (showAll && s !== HUMAN && n) {
      const op = document.createElement('div');
      op.className = 'open';
      for (const c of sortHand(r.hands[s], m.levelRank)) op.appendChild(cardEl(c, 'tiny'));
      box.appendChild(op);
    }
  }
  layoutHand();
  const myTurn = !isOver(G) && !tribMode && !tributePending(G) && r.currentSeat === HUMAN && !botBusy;
  document.body.classList.toggle('tribOn', !!tribMode);
  const tEl = $('toast');
  if (!tEl.classList.contains('hidden')) { placeToast(tEl); requestAnimationFrame(() => placeToast(tEl)); }
  $('btnPlay').disabled = !myTurn;
  $('btnPass').disabled = !myTurn || isLeading(G);
  $('btnHint').disabled = !myTurn;
  $('btnFlagPos').disabled = !myTurn;
  let st = '';
  if (isOver(G)) st = '本副结束';
  else if (tribMode) st = tribMode === 'resist' ? '抗贡' : tribMode === 'return' ? '请你还贡' : '进贡 / 还贡';
  else if (r.currentSeat === HUMAN) st = isLeading(G) ? '轮到你领出' : `轮到你：要压 ${labelCombo(r.lastCombo)}（${SEAT_NAMES[r.lastPlayer]}出）`;
  else st = `${SEAT_NAMES[r.currentSeat]} 思考中…${engineMode() === 'jev' ? '（Jev）' : ''}`;
  $('status').textContent = st;
  renderLog();
}

/** 手牌：同点数竖叠成一列（逢人配单独一列），从左到右由大到小；列宽按屏幕自适应。 */
function layoutHand() {
  const hand = $('hand');
  const cards = sortHand(G.round.hands[HUMAN], G.match.levelRank);
  const lv = G.match.levelRank;
  hand.innerHTML = '';
  const W = hand.clientWidth || window.innerWidth - 24;
  const shortLand = window.innerHeight <= 500 && window.innerWidth > window.innerHeight;
  const phone = window.innerWidth < 900;
  const cw = shortLand ? 44 : phone ? 46 : 64;
  const ch = Math.round(cw * 1.4);
  const cols = [];
  for (const c of cards) {
    const key = c.rank + (isWildCard(c, lv) ? '*' : '');
    if (cols.length && cols[cols.length - 1].key === key) cols[cols.length - 1].cards.push(c);
    else cols.push({ key, cards: [c] });
  }
  const maxStack = Math.max(1, ...cols.map((c) => c.cards.length));
  const maxH = shortLand ? Math.max(ch + 36, window.innerHeight * 0.3) : phone ? Math.max(ch + 60, window.innerHeight * 0.3) : 230;
  const vStep = maxStack > 1 ? Math.max(shortLand ? 17 : 18, Math.min(Math.round(ch * 0.3), (maxH - ch) / (maxStack - 1))) : 0;
  const nc = cols.length;
  const step = nc > 1 ? Math.min(cw + 4, (W - cw) / (nc - 1)) : 0;
  const totalW = (nc - 1) * step + cw;
  const x0 = Math.max(0, (W - totalW) / 2);
  const raise = 14;
  const baseTop = raise + (maxStack - 1) * vStep;
  cols.forEach((col, ci) => {
    col.cards.forEach((c, k) => {
      let extra = '';
      if (tribMode === 'return') extra = eligIds.has(c.id) ? ' elig' : ' dim';
      if (tribMode === 'give' && giveIds.has(c.id)) extra = ' tribGive';
      if (tribMode === 'summary' && newIds.has(c.id)) extra = ' newCard';
      const el = cardEl(c, (selected.has(c.id) ? 'sel ' : '') + (hintIds.has(c.id) ? 'hint' : '') + extra);
      el.style.width = cw + 'px';
      el.style.height = ch + 'px';
      el.style.left = Math.round(x0 + ci * step) + 'px';
      // 最上面一张（k=0）在列顶部，后面的往下叠，露出每张的点数角
      el.style.top = Math.round(baseTop - (col.cards.length - 1 - k) * vStep) + 'px';
      el.style.zIndex = String(10 + ci * 10 + k);
      el.dataset.id = c.id;
      hand.appendChild(el);
    });
  });
  hand.style.height = (cards.length ? baseTop + ch + 4 : 20) + 'px';
}

/** 点选 / 滑动连选手牌（不依赖悬停）。 */
function setupHandPointer() {
  const hand = $('hand');
  let mode = null;
  let seen = new Set();
  const apply = (el) => {
    if (!el) return;
    const id = Number(el.dataset.id);
    if (seen.has(id)) return;
    seen.add(id);
    if (mode === 'add') selected.add(id); else selected.delete(id);
    el.classList.toggle('sel', mode === 'add');
  };
  const cardAt = (x, y) => { const e = document.elementFromPoint(x, y); return e && e.closest ? e.closest('#hand .card') : null; };
  hand.addEventListener('pointerdown', (ev) => {
    const el = cardAt(ev.clientX, ev.clientY);
    if (!el) return;
    ev.preventDefault();
    if (tribMode) {
      // 还贡：只能点选一张可还的牌；其它进贡阶段不能选牌
      const id = Number(el.dataset.id);
      if (tribMode === 'return' && eligIds.has(id)) { selected = new Set([id]); hintIds.clear(); renderTribute(); render(); }
      else if (tribMode === 'return') toast('只能还 10 或以下的牌（王、级牌不可）');
      return;
    }
    mode = selected.has(Number(el.dataset.id)) ? 'remove' : 'add';
    seen = new Set();
    apply(el);
    $('msg').textContent = '';
  });
  hand.addEventListener('pointermove', (ev) => { if (mode) apply(cardAt(ev.clientX, ev.clientY)); });
  const end = () => { mode = null; };
  hand.addEventListener('pointerup', end);
  hand.addEventListener('pointercancel', end);
  window.addEventListener('pointerup', end);
}

function toast(t, ms = 1800) {
  const el = $('toast');
  el.textContent = t;
  el.classList.remove('hidden');
  placeToast(el);
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add('hidden'), ms);
}

// toast 固定在顶部 HUD 下方居中（CSS），不挡进贡面板与手牌
function placeToast() {}

function renderLog() {
  const ol = $('log');
  // 增量追加，避免重绘时点不中 🚩
  if (ol.dataset.deal !== String(G.dealNo) || ol.children.length > G.log.length || ol.dataset.game !== String(G.seed)) {
    ol.innerHTML = '';
    ol.dataset.deal = String(G.dealNo);
    ol.dataset.game = String(G.seed);
  }
  const prevLen = ol.children.length;
  for (let i = prevLen; i < G.log.length; i++) {
    const e = G.log[i];
    const li = document.createElement('li');
    const who = SEAT_NAMES[e.seat].replace(/（.*）/, '');
    const eng = e.by === 'human' ? '' : e.by === 'jev' ? ' [Jev]' : '';
    const sp = document.createElement('span');
    sp.textContent = `${who}${eng}：${e.move.text}`;
    li.appendChild(sp);
    if (e.by === 'human' && e.coach && !e.coach.same && !e.coach.minor) {
      li.classList.add('diff');
      li.title = `教练会出：${e.coach.text}`;
    }
    if (e.trickEnd) li.classList.add('trickEnd');
    const f = document.createElement('button');
    f.type = 'button';
    f.className = 'flag';
    f.textContent = '🚩';
    f.setAttribute('aria-label', '标记这一手');
    f.onclick = () => openFlag(e, f);
    li.appendChild(f);
    ol.appendChild(li);
  }
  if (G.log.length > prevLen && ol.parentElement.open) ol.parentElement.scrollTop = ol.parentElement.scrollHeight;
}

function humanCoach() {
  if (!coachCache || coachCache.at !== G.log.length || coachCache.deal !== G.dealNo) {
    coachCache = { at: G.log.length, deal: G.dealNo, c: coachMove(G, HUMAN) };
  }
  return coachCache.c;
}

function selectedCards() {
  return G.round.hands[HUMAN].filter((c) => selected.has(c.id));
}

function doHuman(cards) {
  const c = humanCoach();
  const res = play(G, HUMAN, cards, { by: 'human', coach: c });
  if (!res.ok) { toast(res.reason); return; }
  selected.clear(); hintIds.clear();
  $('hintBox').textContent = '';
  const e = res.entry;
  // r18：与教练不同但 decide 分差小（< COACH_GAP_MIN）→ 不提示分歧，只淡显“差不多”
  coachTip(e.coach.same || e.coach.minor ? '' : `你出：${e.move.text} · 教练会出：<b>${e.coach.text}</b>`);
  $('feedback').innerHTML = e.coach.same
    ? `<div class="good">✔ 与教练一致：${e.move.text}</div>`
    : e.coach.minor
    ? `<div class="good minor">✔ ${e.move.text}（与教练的 ${e.coach.text} 差不多）</div>`
    : `<div class="bad">你出：${e.move.text}<br>教练会出：<b>${e.coach.text}</b><br><span class="muted">${e.coach.reason || ''}</span></div>`;
  afterMove(res);
}

function afterMove(res) {
  render();
  if (res.finished) { archiveDeal(G); persistGame(); showEnd(); return; }
  scheduleBots();
}

function scheduleBots() {
  const my = token;
  if (isOver(G) || tribMode || tributePending(G) || G.round.currentSeat === HUMAN) {
    botBusy = false;
    render();
    return;
  }
  botBusy = true;
  render();
  const delay = Math.max(0, Number($('speed').value) || 400);
  setTimeout(async () => {
    if (my !== token) return;
    let res;
    try {
      try {
        if (engineMode() === 'jev') res = await botStepJev(my);
        else res = botStepDecide(G);
      } catch (err) {
        console.error('[guandan-play] bot step error', err);
        try { res = botStepDecide(G); } catch { res = null; }
      }
      if (my !== token) return;
      if (!res?.ok) {
        const seat = G.round.currentSeat;
        const fb = isLeading(G) ? [sortHand(G.round.hands[seat], G.match.levelRank).slice(-1)[0]] : [];
        res = play(G, seat, fb, { by: 'decide', reason: 'bot recovery' });
      }
      if (my !== token || !res?.ok) {
        if (my === token) {
          botBusy = false;
          toast(res?.reason || '机器人出牌失败');
          render();
        }
        return;
      }
      botBusy = false;
      afterMove(res);
    } catch (err) {
      console.error('[guandan-play] bot schedule error', err);
      if (my === token) { botBusy = false; render(); }
    }
  }, delay);
}

async function botStepJev(my) {
  const seat = G.round.currentSeat;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 12_000);
  try {
    const resp = await fetch('api/jev', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot(G, seat)),
      signal: ac.signal,
    });
    const out = await resp.json();
    if (my !== token) return null;
    const cards = cardsFromStrings(G.round.hands[seat], out.cards);
    if (cards && out.engine === 'jev') {
      const c = coachMove(G, seat);
      const res = play(G, seat, cards, { by: 'jev', coach: c, reason: out.label || '', preferCombo: { type: out.type } });
      if (res.ok) return res;
    }
  } catch (e) { /* 回退 decide */ } finally { clearTimeout(t); }
  if (my !== token) return null;
  return botStepDecide(G);
}

function showEnd() {
  const R = G.lastResult;
  const win = R.winTeam === 0;
  $('endTitle').textContent = win ? '本副我方获胜 🎉' : '本副对方获胜';
  let html = '<ol>' + R.order.map((s, i) => `<li>${PLACE_NAMES[i]}：${SEAT_NAMES[s]}</li>`).join('') + '</ol>';
  if (G.progression) {
    html += `<p>${R.message || ''}（${R.winTeam === 0 ? '我方' : '对方'}）</p><p>级数：我方 ${R.teamLevelBefore[0]} → <b>${R.teamLevel[0]}</b>，对方 ${R.teamLevelBefore[1]} → <b>${R.teamLevel[1]}</b>；下一副打 <b>${R.levelAfter}</b>。</p>`;
    if (R.matchOver) html += `<p><b>比赛结束：${R.winnerTeam === 0 ? '我方' : '对方'}过 A！</b>下一副新比赛从 2 打起（不进贡）。</p>`;
    else html += `<p class="tribNext">${nextTributeText(R.order)}</p>`;
  } else {
    html += '<p class="muted">（未开“升级”：不进贡，下一副由头游先出。）</p>';
  }
  $('endBody').innerHTML = html;
  $('btnNext').textContent = R.matchOver ? '新比赛' : '下一副';
  $('endModal').classList.remove('hidden');
}

const nm = (s) => (s === HUMAN ? '你' : SEAT_NAMES[s].replace(/（.*）/, ''));
const nmFull = (s) => (s === HUMAN ? '你（南）' : SEAT_NAMES[s]);
/** 结束弹窗里预告下一副的进贡。 */
function nextTributeText(order) {
  const [h, s2, t3, t4] = order;
  if (h % 2 === s2 % 2) return `下一副进贡：双下，${nmFull(t3)} 和 ${nmFull(t4)} 各进贡一张最大的牌（大的给头游 ${nm(h)}、小的给二游 ${nm(s2)}），两家合计两张大王可抗贡。`;
  return `下一副进贡：末游 ${nmFull(t4)} 向头游 ${nmFull(h)} 进贡一张最大的牌（红桃级牌除外），有两张大王可抗贡。`;
}
let eligIds = new Set();
let giveIds = new Set();
let newIds = new Set();
function cardChip(c, cls = '') {
  const el = cardEl(c, `small ${cls}`);
  return el.outerHTML;
}
/** 进贡面板（手牌上方）。 */
function renderTribute() {
  const box = $('tribPanel');
  if (!tribMode) { box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  const ts = G.tributeState;
  const p = ts.plan;
  const lv = G.match.levelRank;
  const showAll = $('showAll').checked;
  let title = '', body = '', btn = '', btn2 = '';
  if (tribMode === 'resist') {
    title = '抗贡';
    const who = (p.resistBy || []).map(nmFull).join('、');
    body = `<div class="tribRow anim">${p.kind === 'double' ? `双下方 ${who} 合计有两张大王` : `末游 ${who} 有两张大王`}，<b>抗贡</b>：本副不进贡、不还贡。</div><div class="tribRow">由头游 <b>${nmFull(p.leader)}</b> 先出。</div>`;
    btn = '开始出牌';
  } else if (tribMode === 'give') {
    title = p.kind === 'double' ? '进贡（双下双贡）' : '进贡';
    body = p.gives.map((g, i) => `<div class="tribRow anim" style="animation-delay:${i * 0.25}s">${nmFull(g.from)} → ${nmFull(g.to)}：${cardChip(g.card, 'fly')}</div>`).join('');
    if (p.tie) body += '<div class="tribRow small muted">两张贡牌一样大：头游的下家进贡给头游。</div>';
    const mine = p.gives.find((g) => g.from === HUMAN);
    body += mine ? `<div class="tribRow">你要进贡手里最大的牌（红桃级牌除外）：已自动选好。</div>` : '<div class="tribRow small muted">贡牌是强制的：手里最大的一张（红桃级牌除外）。</div>';
    btn = mine ? '确认进贡' : '继续';
  } else if (tribMode === 'return') {
    const pend = ts.pending.find((x) => x.seat === HUMAN);
    title = '还贡';
    body = `<div class="tribRow">你收到 ${nmFull(pend.to)} 的贡牌 ${cardChip(pend.received)}，请选一张 <b>10 或以下</b>（级牌除外）的牌还给 ${nm(pend.to)}（亮着的牌可选）。</div>`;
    const sel = [...selected].map((id) => G.round.hands[HUMAN].find((c) => c.id === id)).filter(Boolean)[0];
    body += `<div class="tribRow">已选：${sel ? cardChip(sel) : '<span class="muted">（未选）</span>'}</div>`;
    btn = '确认还贡';
    btn2 = '建议';
  } else if (tribMode === 'summary') {
    title = '进贡完成';
    body = p.gives.map((g) => `<div class="tribRow">进贡：${nmFull(g.from)} → ${nmFull(g.to)} ${cardChip(g.card)}</div>`).join('');
    body += ts.returns.map((r, i) => {
      const seen = r.from === HUMAN || r.to === HUMAN || showAll;
      return `<div class="tribRow anim" style="animation-delay:${i * 0.25}s">还贡：${nmFull(r.from)} → ${nmFull(r.to)} ${seen ? cardChip(r.card, 'fly') : '<span class="muted">（暗还一张 ≤10 的牌）</span>'}</div>`;
    }).join('');
    body += `<div class="tribRow">由 <b>${nmFull(G.round.currentSeat)}</b> 先出${p.kind === 'double' ? '（进贡给头游的人）' : '（进贡的人）'}。</div>`;
    btn = '开始出牌';
  }
  box.innerHTML = `<div class="tribHead"><b>${title}</b><span class="lvBadge">打 ${lv}</span><button id="tribRules" class="link" type="button" title="进贡规则">规则？</button></div><div class="tribBody">${body}</div>` +
    `<div class="tribBtns">${btn2 ? `<button id="tribHint" type="button">${btn2}</button>` : ''}<button id="tribOk" class="primary" type="button">${btn}</button></div>`;
  $('tribRules').onclick = () => $('rulesModal').classList.remove('hidden');
  $('tribOk').onclick = tributeNext;
  if (tribMode === 'return') {
    $('tribOk').disabled = selected.size !== 1;
    $('tribHint').onclick = () => {
      const c = botReturnCard(G, HUMAN);
      if (c) { selected = new Set([c.id]); hintIds = new Set([c.id]); toast(`建议还 ${formatCard(c)}：尽量不拆对子/顺子/炸弹`); renderTribute(); render(); }
    };
  }
}
/** 发牌后进入进贡步骤（若需要）。返回 true 表示等待玩家点按钮。 */
function beginTribute() {
  const ts = G.tributeState;
  tribMode = null;
  newIds = new Set();
  if (!ts || ts.plan.kind === 'none') return false;
  if (ts.plan.resisted) tribMode = 'resist';
  else {
    tribMode = 'give';
    const mine = ts.plan.gives.find((g) => g.from === HUMAN);
    giveIds = new Set(mine ? [mine.card.id] : []);
    selected = new Set(giveIds);
  }
  renderTribute();
  return true;
}
function tributeNext() {
  const ts = G.tributeState;
  if (tribMode === 'give') {
    tributeGive(G);
    autoTribute(G, null, [HUMAN]); // 机器人还贡（policy/tribute）；你的那张等你选
    selected.clear(); giveIds = new Set();
    const mineRecv = ts.plan.gives.find((g) => g.to === HUMAN);
    if (mineRecv) newIds.add(mineRecv.card.id);
    if (ts.pending.some((x) => x.seat === HUMAN)) {
      tribMode = 'return';
      eligIds = new Set(returnChoices(G, HUMAN).map((c) => c.id));
    } else {
      tribMode = 'summary';
      for (const r of ts.returns) if (r.to === HUMAN) newIds.add(r.card.id);
    }
  } else if (tribMode === 'return') {
    const id = [...selected][0];
    const c = G.round.hands[HUMAN].find((x) => x.id === id);
    const res = tributeReturn(G, HUMAN, c);
    if (!res.ok) { toast(res.reason); return; }
    selected.clear(); hintIds.clear(); eligIds = new Set();
    tribMode = 'summary';
  } else {
    // summary / resist → 开始出牌
    const sum = ts.plan.resisted ? `抗贡，${nm(ts.plan.leader)}先出` : ts.plan.gives.map((g) => `${nm(g.from)}→${nm(g.to)} ${formatCard(g.card)}`).join('，') + '；' +
      ts.returns.map((r) => `${nm(r.from)}→${nm(r.to)} ${r.from === HUMAN || r.to === HUMAN ? formatCard(r.card) : '暗还'}`).join('，');
    $('feedback').innerHTML = `<div class="muted">本副${ts.plan.resisted ? '' : '进贡'}：${sum}</div>`;
    tribMode = null; newIds = new Set();
    renderTribute();
    render();
    scheduleBots();
    return;
  }
  renderTribute();
  render();
}

function openFlag(entry, btn = null) {
  flagTarget = entry;
  flagBtn = btn;
  const who = SEAT_NAMES[entry.seat];
  $('flagDesc').innerHTML = `<p>${who}${entry.by === 'human' ? '' : `（${entry.by}）`} 实际：<b>${entry.move ? entry.move.text : '（尚未出牌）'}</b><br>教练（decide）：<b>${entry.coach ? entry.coach.text : '-'}</b>${entry.coach?.reason ? `<br><span style="color:#666">${entry.coach.reason}</span>` : ''}</p>`;
  const played = document.querySelector('input[name=gold][value=played]');
  played.disabled = !entry.move;
  document.querySelector('input[name=gold][value=unsure]').checked = true;
  $('flagNote').value = '';
  $('flagModal').classList.remove('hidden');
}

function flagCurrentPosition() {
  const c = humanCoach();
  const sel = selectedCards();
  let move = null;
  if (sel.length) {
    const it = interpretPlay(G, HUMAN, sel);
    if (it.ok) move = { text: moveText({ cards: sel, combo: it.combo }), cards: sel.map(formatCard), type: it.combo.type, rank: it.combo.rank ?? null, size: sel.length };
  }
  const coach = { text: moveText(c.move), cards: (c.move.cards || []).map(formatCard), type: c.move.combo?.type || 'pass', rank: c.move.combo?.rank ?? null, size: (c.move.cards || []).length, reason: c.reason };
  openFlag({ n: G.log.length + 1, deal: G.dealNo, seat: HUMAN, by: 'human', move, coach, snapshot: snapshot(G, HUMAN), pending: true });
}

function saveFlag() {
  const goldFrom = document.querySelector('input[name=gold]:checked').value;
  const e = flagTarget;
  const entry = e.move ? e : { ...e, move: { text: '（未出）', cards: [], type: 'none', rank: null, size: 0 } };
  const row = flagToCase(entry, { note: $('flagNote').value.trim(), goldFrom: e.move || goldFrom !== 'played' ? goldFrom : 'unsure', idx: flags.length + 1 });
  flags.push(row);
  e.flagged = true;
  if (flagBtn) flagBtn.classList.add('on');
  saveFlags();
  persistGame();
  $('flagModal').classList.add('hidden');
  toast(`已保存标记（共 ${flags.length} 条）`);
}

function flagsText() {
  return flags.map((f) => JSON.stringify(f)).join('\n') + '\n';
}
const pad2 = (n) => String(n).padStart(2, '0');
function exportFileName(ext = 'jsonl') {
  const d = new Date();
  return `guandan-game-${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}.${ext}`;
}
let BUILD = (typeof document !== 'undefined' && document.documentElement.dataset.build) || null;
// r19：老页面没有 data-build 时，从 Service Worker 缓存名补上
if (!BUILD && typeof caches !== 'undefined') caches.keys().then((ks) => { const k = ks.find((x) => x.startsWith('guandan-play-')); if (k && !BUILD) BUILD = k; }).catch(() => {});
/** 当前比赛（各副 + 当前副）的完整 JSONL；当前比赛还没出过牌时用上一场保存的记录。 */
function gameText() {
  const moves = (G?.history || []).reduce((n, d) => n + d.log.length, 0) + (G?.log?.length || 0);
  if (G && moves > 0) return { text: gameLogJsonl(G, { flags, app: { build: BUILD, ua: navigator.userAgent } }), moves };
  try {
    const last = localStorage.getItem('gd_lastgame');
    if (last) {
      // 上一场的记录（保存时的标记）+ 之后新增的标记
      const lines = last.trim().split('\n');
      const seen = new Set(lines.map((l) => { try { const o = JSON.parse(l); return o.type === 'flag' ? o.id : null; } catch { return null; } }).filter(Boolean));
      const extra = flags.filter((f) => !seen.has(f.id)).map((f) => JSON.stringify({ type: 'flag', ...f }));
      return { text: [...lines, ...extra].join('\n') + '\n', moves: lines.filter((l) => l.startsWith('{"type":"move"')).length };
    }
  } catch { /* ignore */ }
  if (flags.length) return { text: flags.map((f) => JSON.stringify({ type: 'flag', ...f })).join('\n') + '\n', moves: 0 };
  return { text: '', moves: 0 };
}
/** 把当前比赛记录存到 localStorage（换新比赛 / 刷新后仍能导出“上一场”）。 */
function persistGame() {
  if (!G) return;
  const moves = (G.history || []).reduce((n, d) => n + d.log.length, 0) + (G.log?.length || 0);
  if (!moves) return;
  try { localStorage.setItem('gd_lastgame', gameLogJsonl(G, { flags, app: { build: BUILD } })); } catch { /* 存储满：忽略 */ }
}

function triggerDownload(text, name) {
  const blob = new Blob([text], { type: 'application/x-ndjson' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
function showCopy(text) {
  $('copyText').value = text;
  $('copyModal').classList.remove('hidden');
  $('copyText').focus();
  $('copyText').select();
}

/**
 * 分享/导出：整场对局 JSONL（每一手：出牌前手牌、桌面、教练建议、实际出牌、标记）。
 * 1) 系统分享“文件”（navigator.share({files})，只传文件，不带 title/text，避免某些 App 只存下标题）；
 *    .jsonl 不被允许时改用 .txt 扩展名（内容仍是 JSONL）。
 * 2) 不支持文件分享：直接下载文件，并尽量复制到剪贴板；都不行则弹出可复制文本框。
 */
async function shareGame() {
  const { text, moves } = gameText();
  if (!text) { toast('还没有对局记录'); return; }
  const summary = `${moves} 手${flags.length ? `、${flags.length} 条标记` : ''}`;
  if (navigator.share && navigator.canShare && typeof File !== 'undefined') {
    let file = null;
    for (const [ext, type] of [['jsonl', 'text/plain'], ['jsonl', 'application/json'], ['txt', 'text/plain']]) {
      try {
        const f = new File([text], exportFileName(ext), { type });
        if (navigator.canShare({ files: [f] })) { file = f; break; }
      } catch { /* next */ }
    }
    if (file) {
      try {
        await navigator.share({ files: [file] });
        toast(`已分享对局记录（${summary}）`); return;
      } catch (e) {
        if (e && e.name === 'AbortError') return;
        // 其它错误（如 NotAllowedError）：走下载兜底
      }
    }
  }
  try { triggerDownload(text, exportFileName('jsonl')); } catch { /* ignore */ }
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      toast(`已下载并复制对局记录（${summary}）`, 2600); return;
    }
  } catch { /* 继续兜底 */ }
  showCopy(text);
}

function download() {
  const { text, moves } = gameText();
  if (!text) { toast('还没有对局记录'); return; }
  triggerDownload(text, exportFileName('jsonl'));
  toast(`已下载对局记录（${moves} 手${flags.length ? `、${flags.length} 条标记` : ''}）`, 2600);
  if (flags.length && confirm(`已下载（含 ${flags.length} 条标记）。要清空浏览器里保存的标记吗？（对局记录不受影响）`)) { flags = []; saveFlags(); }
}

function closeMenu() { $('menu').classList.remove('open'); $('topbar').classList.remove('menuOpen'); }

function startNew() {
  persistGame();
  token += 1;
  botBusy = false;
  // ?seed=N：可复现的比赛（测试/复盘用，只对打开页面后的第一场生效）
  const qs = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
  const seedQ = qs && !startNew.used && qs.get('seed') ? Number(qs.get('seed')) : null;
  startNew.used = true;
  G = newGame(seedQ != null && Number.isFinite(seedQ) ? { progression: $('progression').checked, seed: seedQ } : { progression: $('progression').checked });
  tribMode = null; renderTribute();
  selected.clear(); hintIds.clear(); coachCache = null; coachTip('');
  $('feedback').innerHTML = ''; $('hintBox').textContent = '轮到你时点“提示”查看 decide 的建议。';
  render();
  scheduleBots();
}

function nextDeal() {
  $('endModal').classList.add('hidden');
  if (G.lastResult?.matchOver) { startNew(); return; }
  token += 1;
  G.progression = $('progression').checked;
  G.tribute = G.progression;
  startDeal(G);
  selected.clear(); hintIds.clear(); coachCache = null; coachTip('');
  $('feedback').innerHTML = '';
  const wait = beginTribute();
  render();
  if (!wait) scheduleBots();
}

function init() {
  $('btnPlay').onclick = () => { const cs = selectedCards(); if (!cs.length) { toast('请先选牌'); return; } doHuman(cs); };
  $('btnPass').onclick = () => doHuman([]);
  $('btnClear').onclick = () => { selected.clear(); hintIds.clear(); render(); };
  $('btnDrawer').onclick = () => { closeMenu(); setDrawer(!document.body.classList.contains('drawerOpen')); };
  $('drawerClose').onclick = () => setDrawer(false);
  $('coachTip').onclick = () => setDrawer(true);
  document.addEventListener('pointerdown', (e) => { if ($('menu').classList.contains('open') && !e.target.closest('#menu, #btnMenu')) closeMenu(); });
  $('btnHint').onclick = () => {
    const c = humanCoach();
    hintIds = new Set((c.move.cards || []).map((x) => x.id));
    selected = new Set(hintIds);
    $('hintBox').innerHTML = `建议：<b>${c.text}</b><br><span class="muted">${c.reason || ''}</span>`;
    coachTip(`💡 建议：<b>${c.text}</b>${c.reason ? `<span class="muted"> · ${c.reason}</span>` : ''}`);
    render();
  };
  $('btnFlagPos').onclick = flagCurrentPosition;
  $('flagOk').onclick = saveFlag;
  $('flagCancel').onclick = () => $('flagModal').classList.add('hidden');
  $('btnNext').onclick = nextDeal;
  $('endClose').onclick = () => $('endModal').classList.add('hidden');
  $('btnRules').onclick = () => { closeMenu(); $('rulesModal').classList.remove('hidden'); };
  $('rulesClose').onclick = () => $('rulesModal').classList.add('hidden');
  $('btnNew').onclick = () => { closeMenu(); if (confirm('开始新比赛？')) startNew(); };
  $('btnDownload').onclick = () => { closeMenu(); download(); };
  $('btnShare').onclick = () => { closeMenu(); shareGame(); };
  $('btnShareEnd') && ($('btnShareEnd').onclick = () => shareGame());
  $('copyClose').onclick = () => $('copyModal').classList.add('hidden');
  $('btnMenu').onclick = () => { $('menu').classList.toggle('open'); $('topbar').classList.toggle('menuOpen', $('menu').classList.contains('open')); };
  setupHandPointer();
  let rt = null;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (G) render(); }, 80); });
  placeCoach();
  $('logPanel').addEventListener('toggle', () => { if ($('logPanel').open) $('logPanel').scrollTop = $('logPanel').scrollHeight; });
  // 双击缩放由 CSS touch-action: manipulation 禁止；这里再阻止 iOS 双指缩放
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    // 新版本的 service worker 接管后自动刷新一次，让 iPhone 主屏幕版尽快用上新版本
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloaded) return;
      reloaded = true;
      location.reload();
    });
    navigator.serviceWorker.register('sw.js').then((reg) => { if (navigator.onLine && reg.update) reg.update().catch(() => {}); }).catch(() => {});
  }
  $('showAll').onchange = () => { render(); renderTribute(); };
  $('progression').onchange = () => { if (G) G.progression = $('progression').checked; };
  $('engine').onchange = () => {
    if ($('engine').value === 'jev' && !jevAvailable) {
      alert('Jev 需在电脑上用 “node server.mjs” 启动本地服务并设置 TYPESAFE_API_KEY。机器人继续使用 decide（离线）。');
      $('engine').value = 'decide';
    }
    render();
  };
  saveFlags();
  const persistSoon = () => persistGame();
  window.addEventListener('pagehide', persistSoon);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') persistGame(); });
  // 只有电脑本地服务（node server.mjs，localhost）才有 Jev；静态托管不请求 /api，避免 404
  if (location.protocol.startsWith('http') && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) {
    fetch('api/status', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((s) => {
      if (!s || !s.server) return;
      jevAvailable = !!s.jev;
      const opt = $('engine').querySelector('option[value=jev]');
      opt.disabled = !jevAvailable;
      opt.textContent = jevAvailable ? 'Jev（已连接）' : 'Jev（服务器未设密钥）';
    }).catch(() => {});
  }
  startNew();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}
