import { isWildCard } from "../engine/card.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { rankPower } from "../engine/rank-order.mjs";

const BOMB_TYPES = new Set([PLAY_TYPES.bomb, PLAY_TYPES.straightFlush, PLAY_TYPES.jokerBomb]);
const TEMPO_TYPES = new Set([
  PLAY_TYPES.straight,
  PLAY_TYPES.consecutivePairs,
  PLAY_TYPES.plane,
  PLAY_TYPES.tripleWithPair,
  PLAY_TYPES.straightFlush,
]);

function countRanks(cards, levelRank) {
  const counts = new Map();
  for (const card of cards) {
    if (card.rank === "SJ" || card.rank === "BJ" || isWildCard(card, levelRank)) continue;
    counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1);
  }
  return counts;
}

function normalizeGroups(groups, levelRank) {
  return (groups ?? [])
    .map((group) => {
      const cards = group.cards ?? group;
      if (!Array.isArray(cards) || cards.length === 0) return null;
      const play = classifyPlay(cards, levelRank);
      if (play.type === PLAY_TYPES.invalid || play.type === PLAY_TYPES.pass) return null;
      return { cards, play };
    })
    .filter(Boolean);
}

export function evaluateHandProfile(hand, levelRank, { preferredGroups = [] } = {}) {
  const rankCounts = countRanks(hand, levelRank);
  const groups = normalizeGroups(preferredGroups, levelRank);
  const groupedCardCount = new Set(groups.flatMap((group) => group.cards.map((card) => `${card.rank}:${card.suit}:${card.deckIndex}`))).size;
  const bombs = [
    ...[...rankCounts.values()].filter((count) => count >= 4),
    ...groups.filter((group) => BOMB_TYPES.has(group.play.type)).map(() => 1),
  ].length;
  const tempoGroups = groups.filter((group) => TEMPO_TYPES.has(group.play.type)).length;
  const triples = [...rankCounts.values()].filter((count) => count === 3).length;
  const pairs = [...rankCounts.values()].filter((count) => count === 2).length;
  const jokers = hand.filter((card) => card.rank === "SJ" || card.rank === "BJ").length;
  const wildCards = hand.filter((card) => isWildCard(card, levelRank)).length;
  const controls = hand.filter((card) => (
    card.rank === "SJ"
    || card.rank === "BJ"
    || card.rank === levelRank
    || rankPower(card.rank, levelRank) >= rankPower("A", levelRank)
  )).length;
  const tempoGroupedRanks = new Set();
  for (const group of groups) {
    if (!TEMPO_TYPES.has(group.play.type)) continue;
    for (const card of group.cards) {
      if (card.rank === "SJ" || card.rank === "BJ" || isWildCard(card, levelRank)) continue;
      tempoGroupedRanks.add(card.rank);
    }
  }
  const looseSingles = [...rankCounts.entries()]
    .filter(([rank, count]) => count === 1
      && rankPower(rank, levelRank) < rankPower("A", levelRank)
      && !tempoGroupedRanks.has(rank))
    .length;
  const estimatedTurns = Math.max(1, groups.length + Math.max(0, hand.length - groupedCardCount));
  const turnBonus = Math.max(0, 12 - estimatedTurns);
  const finishSprint = hand.length <= 6
    && estimatedTurns === 1
    && tempoGroups >= 1
    && groupedCardCount >= hand.length - 1;
  const score = bombs * 4 + tempoGroups * 2 + triples + Math.floor(pairs / 2) + controls + jokers + wildCards + turnBonus - looseSingles
    + (finishSprint ? 4 : 0);
  const role = finishSprint || score >= 12 ? "main-attack" : score >= 6 ? "balanced" : "support";
  const label = finishSprint ? "冲刺牌" : role === "main-attack" ? "主攻牌" : role === "balanced" ? "均衡牌" : "助攻牌";
  const intent = finishSprint
    ? "残局一手成组，等接风走完，切勿拆散牌"
    : role === "main-attack"
      ? "主动走成组结构，保留关键回收牌和接风火力"
      : role === "balanced"
        ? "边打边看，优先减少手数并避免拆强结构"
        : "以配合和阻击为主，少抢主攻节奏";

  return {
    score,
    role,
    label,
    intent,
    bombs,
    tempoGroups,
    triples,
    pairs,
    controls,
    looseSingles,
    estimatedTurns,
  };
}
