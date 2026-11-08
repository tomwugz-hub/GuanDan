/** Eval-only: normalize one decide step for cross-run action fingerprints (excludes ms). */
import * as L from '../../../selfplay/lib.mjs';

function cardStr(cs) {
  return (cs || []).map(L.formatCard).join(' ');
}
function comboStr(c) {
  return !c || c.type === 'pass' ? 'pass' : `${c.type}:${c.rank ?? ''}`;
}

export function recordDecision(jobCfg, d) {
  const lv = d.g.match.levelRank;
  const mv = d.move;
  const pass = L.isPassMove(mv);
  const hand = d.before;
  const n = hand.length;
  const seat = d.seat;
  const nat = L.naturalCounts(hand, lv);
  const rel = d.leading ? 'lead' : d.prevSeat === (seat + 2) % 4 ? 'partner' : 'enemy';
  const ec = [d.countsBefore[(seat + 1) % 4], d.countsBefore[(seat + 3) % 4]];
  const live = ec.filter((x) => x > 0);
  const r = {
    id: `${jobCfg}|${d.dealSeed ?? d.g.dealSeed}|${d.step}`,
    cfg: jobCfg,
    spec: d.spec,
    seat,
    step: d.step,
    dealIdx: d.dealIdx ?? null,
    dealSeed: d.dealSeed ?? null,
    rel,
    lv,
    hand: cardStr(L.sortHand(hand, lv)),
    prevStr2: comboStr(d.prevCombo),
    moveStr: pass ? 'pass' : `${comboStr(mv.combo)}{${cardStr(mv.cards)}}`,
    tags: d.rec?.tags ? d.rec.tags.slice(0, 12) : [],
    nCands: d.rec?.scored ? d.rec.scored.length : null,
    enemyMin: live.length ? Math.min(...live) : 0,
    partnerN: d.countsBefore[(seat + 2) % 4],
    ctrlHeld: hand.filter((c) => L.isControlCard(c, lv)).length,
    breaksBomb: !pass && !L.isBombLike(mv.combo) && mv.cards.some((c) => !L.isJokerRank(c.rank) && !L.isWildCard(c, lv) && (nat.get(c.rank) || 0) >= 4 &&
      (nat.get(c.rank) || 0) - mv.cards.filter((x) => x.rank === c.rank && !L.isWildCard(x, lv)).length < 4),
  };
  return r;
}

/** Fingerprint string for diff (visible ctx + chosen move; ms omitted). */
export function actionFingerprint(r) {
  return JSON.stringify({
    spec: r.spec,
    seat: r.seat,
    step: r.step,
    rel: r.rel,
    hand: r.hand,
    prev: r.prevStr2,
    move: r.moveStr,
    tags: r.tags,
    nCands: r.nCands,
    enemyMin: r.enemyMin,
    partnerN: r.partnerN,
  });
}

export function compareActionTraces(a, b, { dealSeed = null } = {}) {
  const fa = (dealSeed ? a.filter((x) => x.dealSeed === dealSeed) : a).slice();
  const fb = (dealSeed ? b.filter((x) => x.dealSeed === dealSeed) : b).slice();
  fa.sort((x, y) => x.step - y.step);
  fb.sort((x, y) => x.step - y.step);
  let prefix = 0;
  let first = null;
  for (let i = 0; i < Math.max(fa.length, fb.length); i++) {
    const x = fa[i];
    const y = fb[i];
    if (!x || !y) {
      first = { kind: 'length', index: i, lenA: fa.length, lenB: fb.length };
      break;
    }
    const px = actionFingerprint(x);
    const py = actionFingerprint(y);
    if (px === py) prefix++;
    else {
      first = {
        kind: 'action',
        index: i,
        step: x.step,
        spec: x.spec,
        seat: x.seat,
        ctxA: JSON.parse(px),
        ctxB: JSON.parse(py),
        rawA: x,
        rawB: y,
      };
      break;
    }
  }
  return { prefixIdentical: prefix, firstDiff: first, lenA: fa.length, lenB: fb.length };
}
