/**
 * 记牌增强（架构 v3）— M1 第二层
 * 在 estimateCardMemory 基础上追踪大牌、四王、各家炸弹威胁粗估。
 */
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { isTeammate, teammateIndex } from "./seat-utils.mjs";

const BOMB_TYPES = new Set([PLAY_TYPES.bomb, PLAY_TYPES.straightFlush, PLAY_TYPES.jokerBomb]);
const BIG_RANKS = new Set(["A", "K", "2"]);

function isBigCard(card, levelRank) {
  return card.rank === "SJ" || card.rank === "BJ"
    || card.rank === levelRank
    || BIG_RANKS.has(card.rank);
}

/**
 * 从出牌历史统计大牌与张数。
 */
function trackBigCardsPlayed(history, levelRank) {
  const played = { A: 0, K: 0, level: 0, SJ: 0, BJ: 0 };
  for (const entry of history) {
    const play = entry.play;
    if (!play || play.type === PLAY_TYPES.pass) continue;
    for (const card of play.cards ?? []) {
      if (card.rank === "SJ") played.SJ += 1;
      else if (card.rank === "BJ") played.BJ += 1;
      else if (card.rank === levelRank) played.level += 1;
      else if (card.rank === "A") played.A += 1;
      else if (card.rank === "K") played.K += 1;
    }
  }
  return played;
}

/** 双副牌大牌上限（不含王） */
const BIG_CARD_MAX = { A: 8, K: 8, level: 8 };

/**
 * 粗估外场剩余大牌（已出 + 我手牌扣除）。
 */
function estimateRemainingBigCards(played, myHand, levelRank) {
  const myCounts = { A: 0, K: 0, level: 0, SJ: 0, BJ: 0 };
  for (const card of myHand ?? []) {
    if (card.rank === "SJ") myCounts.SJ += 1;
    else if (card.rank === "BJ") myCounts.BJ += 1;
    else if (card.rank === levelRank) myCounts.level += 1;
    else if (card.rank === "A") myCounts.A += 1;
    else if (card.rank === "K") myCounts.K += 1;
  }

  const jokersPlayed = played.SJ + played.BJ;
  const jokersHeld = myCounts.SJ + myCounts.BJ;

  return {
    jokersRemaining: Math.max(0, 4 - jokersPlayed - jokersHeld),
    jokersAllSeen: jokersPlayed + jokersHeld >= 4,
    jokersPlayed,
    jokersHeld,
    ARemaining: Math.max(0, BIG_CARD_MAX.A - played.A - myCounts.A),
    KRemaining: Math.max(0, BIG_CARD_MAX.K - played.K - myCounts.K),
    levelRemaining: Math.max(0, BIG_CARD_MAX.level - played.level - myCounts.level),
    bigCardsPlayed: played.A + played.K + played.level + played.SJ + played.BJ,
  };
}

/**
 * 按座位粗估已出炸弹次数（谁打的炸）。
 */
function bombsBySeat(history) {
  const bySeat = new Map();
  for (let i = 0; i < 4; i += 1) bySeat.set(i, 0);
  for (const entry of history) {
    const play = entry.play;
    if (!play || play.type === PLAY_TYPES.pass) continue;
    if (BOMB_TYPES.has(play.type) || (play.bombSize ?? 0) >= 4) {
      const seat = entry.playerIndex;
      bySeat.set(seat, (bySeat.get(seat) ?? 0) + 1);
    }
  }
  return bySeat;
}

/**
 * 粗估各家剩余炸弹威胁（0~3）：结合已出炸、手牌长度、是否出完。
 */
function estimateBombThreat(state, playerIndex) {
  const history = state?.playHistory ?? [];
  const bombsSeen = bombsBySeat(history);
  const threats = [];

  for (const player of state?.players ?? []) {
    const seat = player.seatIndex;
    if (player.finishedOrder) {
      threats.push({ seatIndex: seat, threat: 0, bombsPlayed: bombsSeen.get(seat) ?? 0 });
      continue;
    }
    const played = bombsSeen.get(seat) ?? 0;
    const handLen = player.hand?.length ?? 27;
    let threat = 0;
    // 未出炸且牌还很多 → 可能有炸
    if (played === 0 && handLen >= 10) threat = 2;
    else if (played === 0 && handLen >= 6) threat = 1;
    else if (played >= 2) threat = 0;
    else if (played === 1 && handLen <= 8) threat = 1;
    // 自己手牌已知炸弹数可下调己方威胁估
    if (seat === playerIndex) {
      const myBombs = countHandBombs(player.hand, state.levelRank);
      threat = Math.max(0, threat - Math.min(myBombs, 2));
    }
    threats.push({ seatIndex: seat, threat, bombsPlayed: played, handLen });
  }
  return threats;
}

function countHandBombs(hand, levelRank) {
  const rankCounts = new Map();
  let jokers = 0;
  for (const card of hand ?? []) {
    if (card.rank === "SJ" || card.rank === "BJ") { jokers += 1; continue; }
    if (card.rank === levelRank && card.suit === "H") continue;
    rankCounts.set(card.rank, (rankCounts.get(card.rank) ?? 0) + 1);
  }
  let bombs = jokers === 4 ? 1 : 0;
  for (const c of rankCounts.values()) if (c >= 4) bombs += 1;
  return bombs;
}

/**
 * M1 记牌四层次雏形（第36–39篇）— 兼容旧 API
 */
export function estimateCardMemory(tableContext) {
  const state = tableContext.state;
  const history = state?.playHistory ?? [];
  let jokersPlayed = 0;
  let bigCardsPlayed = 0;
  let bombsSeen = 0;
  const BOMB_TYPES = new Set(["bomb", "straightFlush", "jokerBomb"]);

  for (const entry of history) {
    const play = entry.play;
    if (!play || play.type === PLAY_TYPES.pass) continue;
    if (BOMB_TYPES.has(play.type) || (play.bombSize ?? 0) >= 4) bombsSeen += 1;
    for (const card of play.cards ?? []) {
      if (card.rank === "SJ" || card.rank === "BJ") jokersPlayed += 1;
      if (["A", "2"].includes(card.rank) || card.rank === state?.levelRank) {
        bigCardsPlayed += 1;
      }
    }
  }

  const selfIndex = tableContext.playerIndex ?? state?.currentPlayerIndex ?? 0;
  const myHand = tableContext.hand ?? state?.players?.[selfIndex]?.hand ?? [];
  const myJokers = myHand.filter((c) => c.rank === "SJ" || c.rank === "BJ").length;

  return {
    jokersAllSeen: jokersPlayed + myJokers >= 4,
    jokersPlayed,
    bigCardsPlayed,
    bombsSeen,
    bombsMostlyOut: bombsSeen >= 4,
  };
}

/**
 * 构建完整记牌上下文（兼容旧 estimateCardMemory 字段）。
 */
export function buildCardMemory(state, playerIndex = 0, hand = null) {
  const history = state?.playHistory ?? [];
  const levelRank = state?.levelRank ?? "2";
  const selfIndex = playerIndex ?? state?.currentPlayerIndex ?? 0;
  const myHand = hand
    ?? state?.players?.[selfIndex]?.hand
    ?? [];

  const legacy = estimateCardMemory({ state, playerIndex: selfIndex, hand: myHand });
  const bigPlayed = trackBigCardsPlayed(history, levelRank);
  const remaining = estimateRemainingBigCards(bigPlayed, myHand, levelRank);
  const bombThreats = estimateBombThreat(state, selfIndex);

  const opponentThreats = bombThreats.filter(
    (t) => t.seatIndex !== selfIndex && !isTeammate(selfIndex, t.seatIndex),
  );
  const maxOpponentThreat = opponentThreats.reduce((m, t) => Math.max(m, t.threat), 0);
  const partnerThreat = bombThreats.find((t) => t.seatIndex === teammateIndex(selfIndex))?.threat ?? 0;

  return {
    ...legacy,
    bigCards: bigPlayed,
    remaining,
    bombThreats,
    maxOpponentBombThreat: maxOpponentThreat,
    partnerBombThreat: partnerThreat,
    /** 外场炸弹粗估：已见 ≥4 次或对手威胁总和低 */
    bombsMostlyOut: legacy.bombsMostlyOut || maxOpponentThreat <= 1,
    jokersAllSeen: remaining.jokersAllSeen,
  };
}
