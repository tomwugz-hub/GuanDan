/* 手牌列布局与统一牌面 HTML（file:// 脚本，挂到 window.GuandanUI） */
(function (global) {
  const UI = (global.GuandanUI = global.GuandanUI || {});
  const SUIT_MARK = { S: '♠', H: '♥', D: '♦', C: '♣', J: '' };
  const RANK_ORDER = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
  UI.SUIT_MARK = SUIT_MARK;

  UI.rankSortIndex = function (rank, levelRank) {
    if (rank === 'RJ') return -20;
    if (rank === 'BJ') return -10;
    if (levelRank && rank === levelRank) return 0;
    const i = RANK_ORDER.indexOf(rank);
    return i < 0 ? 50 : 1 + i;
  };

  UI.suitColor = function (c) {
    return c.suit === 'H' || c.suit === 'D' || c.rank === 'RJ' ? 'red' : '';
  };

  UI.faceRank = function (c) {
    if (c.rank === 'RJ' || c.rank === 'BJ') return '王';
    return c.rank;
  };

  UI.suitGlyph = function (c) {
    if (c.rank === 'RJ') return '大';
    if (c.rank === 'BJ') return '小';
    return SUIT_MARK[c.suit] || '';
  };

  UI.cardFaceClass = function (c, extra, selected) {
    return 'pcard ' + UI.suitColor(c) + (extra || '') + (selected ? ' sel' : '');
  };

  UI.cardFaceHTML = function (c, isWild) {
    return (
      '<span class="rk">' +
      UI.faceRank(c) +
      '</span><span class="st">' +
      UI.suitGlyph(c) +
      '</span><span class="pip">' +
      UI.suitGlyph(c) +
      '</span>' +
      (isWild ? '<span class="tag">配</span>' : '')
    );
  };

  UI.makePcard = function (c, extra, selected, isWild) {
    const d = document.createElement('div');
    d.className = UI.cardFaceClass(c, extra, selected);
    d.dataset.id = String(c.id);
    d.innerHTML = UI.cardFaceHTML(c, isWild);
    return d;
  };

  UI.groupHand = function (hand, levelRank) {
    const map = new Map();
    for (const c of hand) {
      if (!map.has(c.rank)) map.set(c.rank, []);
      map.get(c.rank).push(c);
    }
    const keys = [...map.keys()].sort(
      (a, b) => UI.rankSortIndex(a, levelRank) - UI.rankSortIndex(b, levelRank),
    );
    return keys.map((k) => ({ rank: k, cards: map.get(k) }));
  };

  UI.defaultLayout = function (hand, levelRank) {
    return UI.groupHand(hand, levelRank).map((g) => g.cards.map((c) => c.id));
  };

  UI.pruneLayout = function (layout, hand, levelRank) {
    const have = new Map(hand.map((c) => [c.id, c]));
    let next = (layout && layout.length ? layout : UI.defaultLayout(hand, levelRank))
      .map((col) => col.filter((id) => have.has(id)))
      .filter((col) => col.length);
    const used = new Set(next.flat());
    const missing = hand.filter((c) => !used.has(c.id));
    if (missing.length) {
      for (const g of UI.groupHand(missing, levelRank)) next.push(g.cards.map((c) => c.id));
    }
    return next;
  };

  UI.moveCardInLayout = function (layout, cardId, destCol, destRow) {
    const next = layout.map((col) => col.slice());
    for (const col of next) {
      const i = col.indexOf(cardId);
      if (i >= 0) col.splice(i, 1);
    }
    const cleaned = next.filter((c) => c.length);
    if (destCol === -1) {
      cleaned.push([cardId]);
      return cleaned;
    }
    if (!cleaned[destCol]) cleaned[destCol] = [];
    const row = Math.max(0, Math.min(destRow, cleaned[destCol].length));
    cleaned[destCol].splice(row, 0, cardId);
    return cleaned;
  };

  UI.colTag = function (cards, classify, levelRank) {
    if (!cards || cards.length < 5) return '';
    const ranks = new Set(cards.map((c) => c.rank));
    if (ranks.size === 1) return '';
    try {
      const combo = classify(cards, levelRank);
      if (combo && combo.type === 'straightFlush') return '同花顺';
      if (combo && combo.type === 'straight') return '顺子';
    } catch (e) {
      /* 忽略 */
    }
    return '';
  };
})(typeof window !== 'undefined' ? window : globalThis);
