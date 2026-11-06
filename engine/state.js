/**
 * 掼蛋一桌对局状态：级牌、过牌、出牌校验、升级与过 A（宿迁）。
 *
 * 过 A（宿迁）：
 * - 打 A 时必须双下才算过 A 胜利（整局结束）。
 * - 打 A 赢了但非双下：不算过 A，本桌打回 2，头游吃贡（不进贡给末游）。
 * - 打 A 输了：失败方回 2，台上对方打 2。
 */
import { classify, TYPES } from './combos.js';
import { beats } from './compare.js';
import { isDoubleDown, teamOf, tributePlan } from './tribute.js';
import { parseLevel, RANKS } from './ranks.js';
import { RULESETS, rulesetConfig } from './rulesets.js';
import { dealFourHands, shuffle, makeDeck } from './cards.js';

export const SEATS = 4;

/**
 * 创建一桌比赛状态。
 * @param {{ ruleset?: string, levelRank?: string, defenderTeam?: number }} [opts]
 * @returns {object}
 * @throws {Error} 非法级牌
 */
export function createMatch({
  ruleset = RULESETS.SUQIAN,
  levelRank = '2',
  defenderTeam = 0,
} = {}) {
  parseLevel(levelRank);
  return {
    ruleset,
    config: rulesetConfig(ruleset),
    levelRank,
    defenderTeam,
    teamLevel: [levelRank, levelRank],
    matchOver: false,
    winnerTeam: null,
    history: [],
  };
}

/**
 * 发一副并创建 round。
 * @param {object} match
 * @param {{ dealerSeat?: number, hands?: object[][]|null, rng?: () => number }} [opts]
 * @returns {object}
 */
export function createRound(match, { dealerSeat = 0, hands = null, rng } = {}) {
  const dealt = hands || dealFourHands(shuffle(makeDeck(), rng));
  return {
    match,
    hands: dealt,
    currentSeat: dealerSeat,
    leadSeat: dealerSeat,
    lastCombo: null,
    lastPlayer: null,
    passCount: 0,
    finished: [],
    tricks: [],
    tributeEatenByHead: false,
  };
}

/**
 * 校验并应用一次出牌（会改 round）。
 * @param {object} round
 * @param {number} seat
 * @param {object[]} cards
 * @returns {{ ok: boolean, reason?: string, combo?: object, pass?: boolean, finished?: boolean, finishOrder?: number[] }}
 */
export function applyPlay(round, seat, cards) {
  if (seat !== round.currentSeat) return { ok: false, reason: '不是该座位出牌' };
  if (round.finished.includes(seat)) return { ok: false, reason: '已出完' };
  const leading = !round.lastCombo || round.lastCombo.type === TYPES.PASS;
  if (!cards || cards.length === 0) {
    if (leading) return { ok: false, reason: '领出不能过牌' };
    (round.passLog ||= []).push({ seat, combo: round.lastCombo, by: round.lastPlayer });
    round.passCount += 1;
    const next = nextActive(round, seat);
    if (round.passCount >= activeCount(round) - 1) {
      // 其他人全过，lastPlayer 再领
      round.lastCombo = null;
      round.passCount = 0;
      round.currentSeat = nextActive(round, round.lastPlayer);
      round.leadSeat = round.currentSeat;
    } else {
      round.currentSeat = next;
    }
    return { ok: true, combo: { type: TYPES.PASS }, pass: true };
  }

  if (!cards.every((c) => round.hands[seat].some((h) => h.id === c.id))) {
    return { ok: false, reason: '手牌中没有这些牌' };
  }
  const combo = classify(cards, round.match.levelRank);
  if (!combo) return { ok: false, reason: '不能组成合法牌型' };
  if (!leading && !beats(combo, round.lastCombo, round.match.levelRank)) {
    return { ok: false, reason: '压不过' };
  }

  round.hands[seat] = round.hands[seat].filter((h) => !cards.some((c) => c.id === h.id));
  round.lastCombo = combo;
  round.lastPlayer = seat;
  round.passCount = 0;
  round.tricks.push({ seat, cards, combo });

  if (round.hands[seat].length === 0) {
    round.finished.push(seat);
  }
  if (round.finished.length >= 3) {
    const left = [0, 1, 2, 3].find((s) => !round.finished.includes(s));
    round.finished.push(left);
    return { ok: true, combo, finished: true, finishOrder: round.finished.slice() };
  }
  round.currentSeat = nextActive(round, seat);
  return { ok: true, combo };
}

function activeCount(round) {
  return 4 - round.finished.length;
}

function nextActive(round, seat) {
  for (let i = 1; i <= 4; i++) {
    const s = (seat + i) % 4;
    if (!round.finished.includes(s)) return s;
  }
  return seat;
}

/**
 * 一局结束：升级 + 过 A。
 * @param {object} match
 * @param {number[]} finishOrder
 * @returns {{ match: object, tribute: object, passA: boolean, resetTo2: boolean, headEatsTribute: boolean, message: string }}
 */
export function applyGameResult(match, finishOrder) {
  const cfg = match.config;
  const head = finishOrder[0];
  const winTeam = teamOf(head);
  const loseTeam = 1 - winTeam;
  const dd = isDoubleDown(finishOrder);
  const atA = match.teamLevel[winTeam] === 'A' || match.levelRank === 'A';

  const tribute = tributePlan(finishOrder, {
    officialDoubleTribute: cfg.id === RULESETS.OFFICIAL_2022,
  });
  let message = '';
  let passA = false;
  let resetTo2 = false;
  let headEatsTribute = false;

  if (cfg.passARequiresDoubleDown && match.levelRank === 'A') {
    if (dd && winTeam === match.defenderTeam) {
      passA = true;
      match.matchOver = true;
      match.winnerTeam = winTeam;
      message = '双下过 A，本局胜利';
    } else if (dd && winTeam !== match.defenderTeam) {
      // 对方在自己打 A 时双下：对方过 A
      passA = true;
      match.matchOver = true;
      match.winnerTeam = winTeam;
      message = '对方双下过 A';
    } else if (winTeam === match.defenderTeam && !dd) {
      // 打 A 赢但未双下：不算过 A，回 2，头游吃贡
      resetTo2 = true;
      headEatsTribute = true;
      match.teamLevel = ['2', '2'];
      match.levelRank = '2';
      match.defenderTeam = winTeam;
      tribute.count = 0;
      tribute.pairs = [];
      tribute.eatenByHead = true;
      message = '过 A 未双下，回打 2，头游吃贡';
    } else {
      // 打 A 的一方输了
      resetTo2 = true;
      match.teamLevel = ['2', '2'];
      match.levelRank = '2';
      match.defenderTeam = winTeam;
      message = '过 A 失败，台上对方打 2';
    }
  } else {
    const steps = dd ? 2 : 1;
    match.teamLevel[winTeam] = bumpLevel(match.teamLevel[winTeam], steps);
    match.levelRank = match.teamLevel[winTeam];
    match.defenderTeam = winTeam;
    if (cfg.endMatchOnAnyWinAtA && (match.levelRank === 'A' || atA)) {
      // 官方：打 A 任意获胜即可过 A，不必双下；失败也不回 2
      passA = true;
      match.matchOver = true;
      match.winnerTeam = winTeam;
      message = '官方规则：打 A 获胜即过 A（不必双下）';
    } else {
      message = dd ? `双下，升 ${steps} 级` : `升 ${steps} 级`;
    }
  }

  match.history.push({ finishOrder, tribute, passA, resetTo2, message });
  return { match, tribute, passA, resetTo2, headEatsTribute, message };
}

function bumpLevel(cur, steps) {
  let i = RANKS.indexOf(cur);
  i = Math.min(RANKS.length - 1, i + steps);
  return RANKS[i];
}

