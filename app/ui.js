/* 掼蛋主界面：只接线，不含规则/策略计算 */
(function () {
  const G = window.Guandan;
  const UI = window.GuandanUI;
  const $ = (id) => document.getElementById(id);
  const SEAT_NAME = UI.SEAT_NAME;
  const state = {
    ruleset: 'suqian',
    match: null,
    round: null,
    selected: new Set(),
    rec: null,
    tributeMode: false,
    autoPop: true,
    anim: true,
    userSeat: 0,
    timer: 16,
    timerId: null,
    lastTrick: [],
    lastCombo: null,
    lastSeat: null,
    lastPlaySeat: null,
    sortKey: 'rank',
    pendingTribute: null,
    tributePick: null,
    userActed: false,
    layout: null,
    drag: null,
    lastClick: null,
    lastColPick: null,
    clickTimer: null,
    tablePlays: UI.emptyTablePlays(),
  };

  function level() {
    return state.match && state.match.levelRank;
  }
  function rankSortIndex(rank) {
    return UI.rankSortIndex(rank, level());
  }
  function makePcard(c, extra) {
    const wild = state.match && G.isWildCard && G.isWildCard(c, state.match.levelRank);
    return UI.makePcard(c, extra, state.selected.has(c.id), wild);
  }
  function paintBacks(id, n) {
    const box = $(id);
    box.innerHTML = '';
    const show = Math.min(n, 10);
    for (let i = 0; i < show; i++) {
      const b = document.createElement('div');
      b.className = 'back';
      box.appendChild(b);
    }
  }
  function stopClock() {
    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = null;
    }
  }
  function startTimer() {
    state.timer = 16;
    state.userActed = false;
    $('clock').textContent = state.timer;
    stopClock();
    state.timerId = setInterval(() => {
      if (state.timer <= 0) {
        $('clock').textContent = 0;
        stopClock();
        if (
          state.round &&
          state.round.currentSeat === state.userSeat &&
          !state.userActed &&
          state.round.lastCombo &&
          state.round.lastCombo.type !== 'pass'
        ) {
          applyUser([]);
        }
        return;
      }
      state.timer -= 1;
      $('clock').textContent = state.timer;
    }, 1000);
  }

  function renderHand() {
    const box = $('hand');
    box.innerHTML = '';
    const hand = state.round.hands[state.userSeat].slice();
    $('seat0').querySelector('.cnt').textContent = hand.length;
    paintBacks('backs1', state.round.hands[1].length);
    paintBacks('backs2', state.round.hands[2].length);
    paintBacks('backs3', state.round.hands[3].length);
    $('seat1').querySelector('.cnt').textContent = state.round.hands[1].length;
    $('seat2').querySelector('.cnt').textContent = state.round.hands[2].length;
    $('seat3').querySelector('.cnt').textContent = state.round.hands[3].length;

    state.layout = UI.pruneLayout(state.layout, hand, level());
    const byId = new Map(hand.map((c) => [c.id, c]));
    const groups = UI.groupHand(hand, level());
    const strip = $('rankRow');
    strip.innerHTML = groups
      .map((g) => '<span>' + (g.rank === 'RJ' ? '大' : g.rank === 'BJ' ? '小' : g.rank) + '<b>' + g.cards.length + '</b></span>')
      .join('');

    const addGap = (insertAt) => {
      const gap = document.createElement('div');
      gap.className = 'col-gap';
      gap.dataset.insert = String(insertAt);
      box.appendChild(gap);
    };
    addGap(0);
    state.layout.forEach((ids, ci) => {
      const cards = ids.map((id) => byId.get(id)).filter(Boolean);
      const col = document.createElement('div');
      col.className = 'col';
      col.dataset.col = String(ci);
      const tag = UI.colTag(cards, G.classify, level());
      cards.forEach((c) => {
        const d = makePcard(c);
        UI.bindCardPointer(d, c, state, renderHand);
        col.appendChild(d);
      });
      if (tag) {
        const t = document.createElement('div');
        t.className = 'tag';
        t.textContent = tag;
        col.appendChild(t);
      }
      box.appendChild(col);
      addGap(ci + 1);
    });
    $('level').textContent = state.match.levelRank;
    const lv = $('levelCard');
    lv.textContent = state.match.levelRank;
    lv.className = 'mini-card red';
    const hint = $('wildHint');
    if (hint) hint.textContent = '红桃' + state.match.levelRank + ' 逢人配';
    const remain = hand.length;
    const phaseCn = { early: '开局', mid: '中盘', late: '残局', lastCards: '收尾' };
    const phase = G.phaseOf ? phaseCn[G.phaseOf(remain)] || G.phaseOf(remain) : '';
    $('dealInfo').innerHTML =
      '规则：' + state.match.config.name +
      '<br>级牌 ' + state.match.levelRank + '（仅红桃级牌为逢人配）' +
      '<br>进贡模式：' + (state.tributeMode ? '开（从 2 打到 A，宿迁过 A）' : '关') +
      (phase ? '<br>阶段：' + phase : '');
  }

  function clearTablePlays() {
    state.tablePlays = UI.emptyTablePlays();
    UI.clearPlaySlots((i) => $('play' + i));
  }
  function showSeatPlay(seat, cards, combo) {
    state.tablePlays[seat] = UI.renderSeatPlay($('play' + seat), cards, combo, makePcard);
  }
  function notePlay(seat, cards, combo, leading) {
    if (leading) clearTablePlays();
    showSeatPlay(seat, cards, combo);
    renderTrick(cards && cards.length ? cards : [], combo, seat);
    if (!cards || !cards.length) $('lastPlay').textContent = SEAT_NAME[seat] + ' 不要';
  }
  function renderTrick(cards, combo, seat) {
    UI.renderTrickCards($('lastCards'), cards, makePcard);
    if (combo) {
      $('lastPlay').textContent = UI.comboLabel(combo, seat);
    }
  }

  function refreshRec() {
    const seat = state.round.currentSeat;
    const leading = !state.round.lastCombo || state.round.lastCombo.type === 'pass';
    const partnerSeat = (seat + 2) % 4;
    const partnerCombo =
      !leading && state.lastPlaySeat === partnerSeat ? state.round.lastCombo : null;
    state.rec = G.decide({
      hand: state.round.hands[seat],
      previous: leading ? null : state.round.lastCombo,
      levelRank: state.match.levelRank,
      leading,
      firstLeadOfDeal: leading && state.round.tricks.length === 0,
      seat,
      lastPlaySeat: state.lastPlaySeat,
      partnerCombo,
      remainingSeatCounts: state.round.hands.map((h) => h.length),
      playedCards: state.round.tricks.flatMap((t) => t.cards || []),
    });
    $('recMove').textContent = (state.rec.move.cards || []).map(G.formatCard).join(' ') || '过牌';
    $('recReason').textContent = state.rec.reason;
    const key =
      state.rec.move.combo &&
      (state.rec.move.combo.type === 'bomb' ||
        state.rec.move.combo.type === 'straightFlush' ||
        state.round.hands[seat].length <= 2);
    if (state.autoPop && key && seat === state.userSeat) {
      $('popup').hidden = false;
      $('popText').textContent = state.rec.reason;
    }
  }

  function showTributePanel(plan, applied) {
    const modal = $('tributeModal');
    const body = $('tributeBody');
    if (!modal || !body) return;
    const lines = [];
    lines.push('<p>' + (plan.reason || '') + '</p>');
    if (applied.resisted && !applied.moved.length) {
      lines.push('<p>抗贡：进贡方持双大王，本轮不进贡。</p>');
    }
    (applied.resistedPairs || []).forEach((p) => {
      lines.push('<p>' + SEAT_NAME[p.from] + ' 持双大王，抗贡（不进贡给 ' + SEAT_NAME[p.to] + '）</p>');
    });
    (applied.moved || []).forEach((m) => {
      lines.push('<p>' + SEAT_NAME[m.from] + ' 进贡 ' + G.formatCard(m.card) + ' → ' + SEAT_NAME[m.to] + '</p>');
    });
    (applied.returned || []).forEach((m) => {
      lines.push('<p>' + SEAT_NAME[m.from] + ' 还贡 ' + G.formatCard(m.card) + ' → ' + SEAT_NAME[m.to] + '</p>');
    });
    body.innerHTML = lines.join('');
    modal.hidden = false;
  }

  function commitTribute(plan, returns) {
    const applied = G.applyTributes(state.round.hands, plan, {
      levelRank: state.match.levelRank,
      returns: returns || [],
    });
    state.round.hands = applied.hands;
    state.tributePick = null;
    showTributePanel(plan, applied);
    renderHand();
  }

  function showTributePicker(plan, preview) {
    const modal = $('tributeModal');
    const body = $('tributeBody');
    if (!modal || !body) return;
    body.innerHTML = '';
    const lead = document.createElement('p');
    lead.textContent = (plan.reason || '') + ' 请选择还贡牌（未选则自动还最小合法牌）。';
    body.appendChild(lead);
    (preview.resistedPairs || []).forEach((p) => {
      const row = document.createElement('p');
      row.textContent = SEAT_NAME[p.from] + ' 持双大王，抗贡（不进贡给 ' + SEAT_NAME[p.to] + '）';
      body.appendChild(row);
    });
    const picks = {};
    preview.pairs.forEach((item) => {
      picks[item.index] = item.auto || null;
      const block = document.createElement('div');
      block.className = 'row';
      const who = document.createElement('p');
      who.textContent =
        SEAT_NAME[item.returnFrom] +
        ' 还贡给 ' +
        SEAT_NAME[item.returnTo] +
        '（' +
        SEAT_NAME[item.from] +
        ' 进贡 ' +
        G.formatCard(item.tribute) +
        '）';
      block.appendChild(who);
      const isUser = item.returnFrom === state.userSeat;
      const hint = document.createElement('p');
      hint.className = 'tribute-hint';
      hint.textContent = isUser ? '点选手牌还贡' : '电脑自动还最小合法牌';
      block.appendChild(hint);
      const wrap = document.createElement('div');
      wrap.className = 'tribute-picks';
      const autoId = item.auto && item.auto.id;
      (item.legal || []).forEach((c) => {
        const wild = state.match && G.isWildCard && G.isWildCard(c, state.match.levelRank);
        const d = UI.makePcard(c, isUser ? ' pick' : ' locked', c.id === autoId, wild);
        if (isUser) {
          d.onclick = () => {
            wrap.querySelectorAll('.pcard').forEach((el) => el.classList.remove('sel'));
            d.classList.add('sel');
            picks[item.index] = c;
          };
        }
        wrap.appendChild(d);
      });
      if (!(item.legal || []).length) {
        const none = document.createElement('p');
        none.className = 'tribute-hint';
        none.textContent = '无合法还贡牌，将跳过还贡';
        block.appendChild(none);
      }
      block.appendChild(wrap);
      body.appendChild(block);
    });
    state.tributePick = { plan, picks };
    modal.hidden = false;
  }

  function applyPendingTribute() {
    const plan = state.pendingTribute;
    state.pendingTribute = null;
    if (!state.tributeMode || !plan || !plan.count) return;
    const preview = G.previewTributes
      ? G.previewTributes(state.round.hands, plan, { levelRank: state.match.levelRank })
      : { pairs: [], resistedPairs: [], needReturn: false };
    if (preview.pairs.length) {
      showTributePicker(plan, preview);
      return;
    }
    commitTribute(plan, []);
  }

  function newDeal() {
    state.match = G.createMatch({ ruleset: state.ruleset, levelRank: state.match?.levelRank || '2' });
    if (state.tributeMode) state.match.levelRank = state.match.levelRank || '2';
    state.round = G.createRound(state.match, { dealerSeat: 0 });
    state.selected.clear();
    state.layout = null;
    state.lastTrick = [];
    state.lastCombo = null;
    state.lastPlaySeat = null;
    clearTablePlays();
    renderTrick([]);
    state.tributePick = null;
    if ($('tributeModal')) $('tributeModal').hidden = true;
    applyPendingTribute();
    renderHand();
    refreshRec();
    if (!$('lastPlay').textContent || $('lastPlay').textContent === '等待出牌') {
      $('lastPlay').textContent = '等待出牌';
    }
    startTimer();
  }

  function applyUser(cards) {
    if (state.round.currentSeat !== state.userSeat) return;
    state.userActed = true;
    const wasLead = !state.round.lastCombo || state.round.lastCombo.type === 'pass';
    const r = G.applyPlay(state.round, state.userSeat, cards);
    if (!r.ok) {
      state.userActed = false;
      alert(r.reason);
      return;
    }
    if (state.anim) {
      document.querySelectorAll('.pcard.sel').forEach((el) => el.classList.add('play-out'));
    }
    state.lastTrick = cards.slice();
    if (cards.length) state.lastPlaySeat = state.userSeat;
    notePlay(state.userSeat, cards, r.combo, wasLead && cards.length);
    state.selected.clear();
    afterPlay();
  }

  function afterPlay() {
    if (state.round.finished.length >= 3) {
      const res = G.applyGameResult(state.match, state.round.finished);
      G.recordWin(res.passA || state.round.finished[0] % 2 === 0);
      if (state.tributeMode) {
        if (res.resetTo2) state.match.levelRank = '2';
        state.pendingTribute = res.tribute;
      }
      alert(res.message);
      newDeal();
      return;
    }
    renderHand();
    playOthers();
  }

  function playOthers() {
    let guard = 0;
    while (
      state.round.currentSeat !== state.userSeat &&
      state.round.finished.length < 3 &&
      guard++ < 80
    ) {
      const seat = state.round.currentSeat;
      const leading = !state.round.lastCombo || state.round.lastCombo.type === 'pass';
      const partnerSeat = (seat + 2) % 4;
      const partnerCombo =
        !leading && state.lastPlaySeat === partnerSeat ? state.round.lastCombo : null;
      const rec = G.decide({
        hand: state.round.hands[seat],
        previous: leading ? null : state.round.lastCombo,
        levelRank: state.match.levelRank,
        leading,
        firstLeadOfDeal: leading && state.round.tricks.length === 0,
        seat,
        lastPlaySeat: state.lastPlaySeat,
        partnerCombo,
        remainingSeatCounts: state.round.hands.map((h) => h.length),
      });
      const cards = rec.move.cards || [];
      const r = G.applyPlay(state.round, seat, cards);
      if (cards.length) {
        state.lastTrick = cards;
        state.lastPlaySeat = seat;
      }
      notePlay(seat, cards, r.combo, leading && cards.length);
    }
    renderHand();
    refreshRec();
    startTimer();
  }

  $('btnNew').onclick = newDeal;
  $('ruleset').onchange = (e) => {
    state.ruleset = e.target.value;
    newDeal();
  };
  $('btnHint').onclick = refreshRec;
  $('btnAccept').onclick = () => {
    if (!state.rec) refreshRec();
    if (state.round.currentSeat !== state.userSeat) return;
    applyUser(state.rec.move.cards || []);
  };
  $('btnPlay').onclick = () => {
    const hand = state.round.hands[state.userSeat];
    const sel = hand.filter((c) => state.selected.has(c.id));
    applyUser(sel);
  };
  $('btnPass').onclick = () => applyUser([]);
  $('btnRestore').onclick = () => {
    state.selected.clear();
    renderHand();
  };
  $('btnSort').onclick = () => {
    const h = state.round.hands[state.userSeat];
    h.sort((a, b) => rankSortIndex(a.rank) - rankSortIndex(b.rank) || String(a.suit).localeCompare(b.suit));
    state.layout = UI.defaultLayout(h, level());
    renderHand();
  };
  $('btnTributeMode').onclick = () => {
    state.tributeMode = !state.tributeMode;
    state.match = G.createMatch({ ruleset: state.ruleset, levelRank: '2' });
    state.pendingTribute = null;
    newDeal();
  };
  $('btnDrill').onclick = () => {
    location.href = 'learn.html';
  };
  $('btnAdv').onclick = () => $('advMenu').classList.toggle('open');
  $('chkAuto').onclick = function () {
    state.autoPop = !state.autoPop;
    this.classList.toggle('on', state.autoPop);
  };
  $('chkAnim').onclick = function () {
    state.anim = !state.anim;
    this.classList.toggle('on', state.anim);
  };
  $('chkAuto').classList.add('on');
  $('chkAnim').classList.add('on');
  $('popOk').onclick = () => {
    $('popup').hidden = true;
    $('btnAccept').click();
  };
  $('popNo').onclick = () => {
    $('popup').hidden = true;
  };
  if ($('tributeOk')) {
    $('tributeOk').onclick = () => {
      if (state.tributePick) {
        const { plan, picks } = state.tributePick;
        const n = Math.max((plan.pairs || []).length, 2);
        const returns = [];
        for (let i = 0; i < n; i++) returns[i] = picks[i] || null;
        commitTribute(plan, returns);
        return;
      }
      $('tributeModal').hidden = true;
    };
  }
  newDeal();
})();
