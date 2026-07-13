/**
 * 进贡还贡教纲（架构 v3）— J1/J2/J3
 * 贡牌阶段不在 recommend 主路径，供 competitive-match / 机器人钩子调用。
 */
import { isJoker, isWildCard } from "../engine/card.mjs";
import { rankPower } from "../engine/rank-order.mjs";

const RETURNABLE_RANKS = new Set(["2", "3", "4", "5", "6", "7", "8", "9", "10"]);

function cardStrength(card, levelRank) {
  if (card.rank === "BJ") return 10_000;
  if (card.rank === "SJ") return 9_000;
  return rankPower(card.rank, levelRank) * 10;
}

/**
 * J1 进贡：非逢人配最大牌（保留抗贡双大王逻辑由上层处理）。
 */
export function selectTributeCard(hand, levelRank) {
  const candidates = hand.filter((c) => !isWildCard(c, levelRank));
  if (candidates.length === 0) return hand[0] ?? null;
  return [...candidates].sort(
    (a, b) => cardStrength(b, levelRank) - cardStrength(a, levelRank),
  )[0];
}

function returnDamage(card, hand, levelRank) {
  if (isJoker(card)) return 10_000;
  if (isWildCard(card, levelRank)) return 9_000;
  const rankCounts = new Map();
  for (const c of hand) {
    if (isJoker(c) || isWildCard(c, levelRank)) continue;
    rankCounts.set(c.rank, (rankCounts.get(c.rank) ?? 0) + 1);
  }
  const count = rankCounts.get(card.rank) ?? 0;
  if (count >= 5) return 6_000;
  if (count === 4) return 5_000; // J2 还贡防头炸：不还应拆炸的牌
  if (count === 3) return 1_200;
  if (count === 2) return 420;
  return 0;
}

/**
 * J2/J3 还贡：还小牌、不拆结构、不还应留强的炸弹张。
 * @param {object} options
 * @param {boolean} options.avoidBombHead 防头炸：绝不还四张同点中的任一张
 */
export function selectReturnCard(hand, levelRank, { avoidBombHead = true } = {}) {
  let source = hand.filter(
    (c) => RETURNABLE_RANKS.has(c.rank) && c.rank !== levelRank && !isJoker(c),
  );
  if (source.length === 0) {
    source = hand.filter((c) => !isJoker(c) && !isWildCard(c, levelRank));
  }

  const filtered = avoidBombHead
    ? source.filter((c) => returnDamage(c, hand, levelRank) < 5_000)
    : source;

  const pool = filtered.length > 0 ? filtered : source;

  return [...pool].sort((a, b) => {
    const dmg = returnDamage(a, hand, levelRank) - returnDamage(b, hand, levelRank);
    if (dmg !== 0) return dmg;
    return cardStrength(a, levelRank) - cardStrength(b, levelRank);
  })[0] ?? null;
}

/**
 * 还贡决策说明（供 UI / 教练 reason）。
 */
export function tributeReason(kind, card) {
  if (kind === "tribute") return `【J1】进贡最大非逢人配：${card?.rank ?? "?"}`;
  if (kind === "return") return `【J2】还贡留强：选拆结构代价最小的${card?.rank ?? "?"}`;
  return "";
}

/**
 * 双大王抗贡检测。
 */
export function canResistTribute(players, tributePlayerIndexes) {
  const bigJokers = tributePlayerIndexes
    .flatMap((i) => players[i]?.hand ?? [])
    .filter((c) => c.rank === "BJ");
  return bigJokers.length >= 2;
}
