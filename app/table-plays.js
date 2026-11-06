/* 桌面各家出牌展示（file:// 脚本，挂到 window.GuandanUI） */
(function (global) {
  const UI = (global.GuandanUI = global.GuandanUI || {});
  const SEAT_NAME = ['我', '上家', '队友', '下家'];
  const TYPE_NAME = {
    pass: '过牌',
    single: '单张',
    pair: '对子',
    triple: '三张',
    fullhouse: '三带二',
    straight: '顺子',
    pairSeq: '连对',
    tripleSeq: '钢板',
    bomb: '炸',
    straightFlush: '同花顺',
  };
  UI.SEAT_NAME = SEAT_NAME;
  UI.TYPE_NAME = TYPE_NAME;

  UI.comboLabel = function (combo, seat) {
    if (!combo || combo.type === 'pass') return '不要';
    const who = SEAT_NAME[seat] || '';
    if (combo.type === 'bomb') {
      return '「' + who + '的' + (combo.bombSize || combo.size) + '炸」';
    }
    return '「' + who + '的' + (TYPE_NAME[combo.type] || combo.type) + (combo.rank ? combo.rank : '') + '」';
  };

  UI.emptyTablePlays = function () {
    return [null, null, null, null];
  };

  UI.clearPlaySlots = function (getEl) {
    for (let i = 0; i < 4; i++) {
      const el = getEl(i);
      if (el) el.innerHTML = '';
    }
  };

  UI.renderSeatPlay = function (el, cards, combo, makePcard) {
    if (!el) return cards && cards.length ? { cards: cards, combo: combo } : { pass: true };
    el.innerHTML = '';
    if (!cards || !cards.length) {
      const p = document.createElement('div');
      p.className = 'pass';
      p.textContent = '不要';
      el.appendChild(p);
      return { pass: true };
    }
    cards.forEach(function (c) {
      el.appendChild(makePcard(c));
    });
    return { cards: cards, combo: combo };
  };

  UI.renderTrickCards = function (box, cards, makePcard) {
    if (!box) return;
    box.innerHTML = '';
    (cards || []).forEach(function (c) {
      box.appendChild(makePcard(c));
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
