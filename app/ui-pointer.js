/* 手牌拖列与点选（file:// 脚本，挂到 window.GuandanUI） */
(function (global) {
  const UI = (global.GuandanUI = global.GuandanUI || {});

  /**
   * 绑定一张手牌的拖动理牌与单击/双击选牌。
   * @param {HTMLElement} el
   * @param {{ id: string|number }} card
   * @param {{
   *   drag: object|null,
   *   layout: Array<Array<string|number>>,
   *   selected: Set,
   *   lastClick: object|null,
   *   lastColPick: *,
   *   clickTimer: *
   * }} state
   * @param {function} renderHand
   */
  UI.bindCardPointer = function (el, card, state, renderHand) {
    el.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0) return;
      ev.preventDefault();
      el.setPointerCapture(ev.pointerId);
      state.drag = { id: card.id, x: ev.clientX, y: ev.clientY, moved: false, ghost: null };
    });
    el.addEventListener('pointermove', (ev) => {
      const d = state.drag;
      if (!d || d.id !== card.id) return;
      const dist = Math.hypot(ev.clientX - d.x, ev.clientY - d.y);
      if (!d.moved && dist < 7) return;
      if (!d.moved) {
        d.moved = true;
        el.classList.add('dragging');
        d.ghost = el.cloneNode(true);
        d.ghost.classList.add('drag-ghost');
        d.ghost.style.width = el.offsetWidth + 'px';
        d.ghost.style.height = el.offsetHeight + 'px';
        document.body.appendChild(d.ghost);
      }
      d.ghost.style.left = ev.clientX - 18 + 'px';
      d.ghost.style.top = ev.clientY - 12 + 'px';
      document.querySelectorAll('.col.hot, .col-gap.hot').forEach((n) => n.classList.remove('hot'));
      const hit = document.elementFromPoint(ev.clientX, ev.clientY);
      const col = hit && hit.closest && hit.closest('.col');
      const gap = hit && hit.closest && hit.closest('.col-gap');
      if (col) col.classList.add('hot');
      if (gap) gap.classList.add('hot');
    });
    el.addEventListener('pointerup', (ev) => {
      const d = state.drag;
      state.drag = null;
      if (!d) return;
      el.classList.remove('dragging');
      if (d.ghost) d.ghost.remove();
      document.querySelectorAll('.col.hot, .col-gap.hot').forEach((n) => n.classList.remove('hot'));
      if (!d.moved) {
        const topCol = (state.layout || []).find((ids) => ids[0] === card.id);
        if (state.clickTimer && state.lastClick && state.lastClick.id === card.id) {
          clearTimeout(state.clickTimer);
          state.clickTimer = null;
          state.lastClick = null;
          if (topCol) {
            const on = topCol.every((id) => state.selected.has(id)) || state.lastColPick === topCol[0];
            if (on) {
              topCol.forEach((id) => state.selected.delete(id));
              state.lastColPick = null;
            } else {
              topCol.forEach((id) => state.selected.add(id));
              state.lastColPick = topCol[0];
            }
            renderHand();
          }
          return;
        }
        state.lastClick = { id: card.id, t: Date.now() };
        state.clickTimer = setTimeout(() => {
          state.clickTimer = null;
          state.lastClick = null;
          if (state.selected.has(card.id)) state.selected.delete(card.id);
          else state.selected.add(card.id);
          if (!topCol) state.lastColPick = null;
          renderHand();
        }, 300);
        return;
      }
      const hit = document.elementFromPoint(ev.clientX, ev.clientY);
      const col = hit && hit.closest && hit.closest('#hand .col');
      const gap = hit && hit.closest && hit.closest('#hand .col-gap');
      if (gap && gap.dataset.insert != null) {
        const at = Number(gap.dataset.insert);
        for (const c of state.layout) {
          const i = c.indexOf(card.id);
          if (i >= 0) c.splice(i, 1);
        }
        state.layout = state.layout.filter((c) => c.length);
        state.layout.splice(at, 0, [card.id]);
        renderHand();
        return;
      }
      if (col && col.dataset.col != null) {
        state.layout = UI.moveCardInLayout(state.layout, card.id, Number(col.dataset.col), 999);
        renderHand();
      }
    });
    el.addEventListener('pointercancel', () => {
      if (state.drag && state.drag.ghost) state.drag.ghost.remove();
      el.classList.remove('dragging');
      state.drag = null;
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
