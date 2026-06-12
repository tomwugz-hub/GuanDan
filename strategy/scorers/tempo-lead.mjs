import { isJoker } from "../../engine/card.mjs";
import { analyzeRankAvailability } from "./structure.mjs";
import { PLAY_TYPES } from "../../engine/play-types.mjs";
import { compareRanks } from "../../engine/rank-order.mjs";
import { rankPower } from "../../engine/rank-order.mjs";
import { playerJustWonTrickWithBomb } from "../lead-mode.mjs";
import { solePairForTripleRank } from "../principles.mjs";

const BOMB_TYPES = new Set([PLAY_TYPES.bomb, PLAY_TYPES.straightFlush, PLAY_TYPES.jokerBomb]);
const TEMPO_TYPES = new Set([
  PLAY_TYPES.tripleWithPair,
  PLAY_TYPES.triple,
  PLAY_TYPES.straight,
  PLAY_TYPES.consecutivePairs,
  PLAY_TYPES.plane,
]);

function remainingHandAfter(candidate, hand, cardKey) {
  if (candidate.type === PLAY_TYPES.pass) return hand.length;
  const used = new Set(candidate.cards.map(cardKey));
  return hand.filter((card) => !used.has(cardKey(card))).length;
}

/** 非炸弹三同张组数（留给三带二/连对路线） */
function nonBombTripleRankCount(hand, levelRank) {
  const rankCounts = new Map();
  for (const card of hand) {
    if (isJoker(card)) continue;
    rankCounts.set(card.rank, (rankCounts.get(card.rank) ?? 0) + 1);
  }
  let count = 0;
  for (const [rank, held] of rankCounts) {
    if (held !== 3) continue;
    const bombInfo = analyzeRankAvailability(hand, rank, levelRank);
    if (bombInfo.effectiveBombCount >= 4) continue;
    count += 1;
  }
  return count;
}

/** 接风减手：手牌是否仍有对子/三同张/顺子等成组出牌选项（不含王） */
function handHasGroupReductionOption(hand) {
  const rankCounts = new Map();
  let nonJokerCount = 0;
  for (const card of hand) {
    if (isJoker(card)) continue;
    nonJokerCount += 1;
    rankCounts.set(card.rank, (rankCounts.get(card.rank) ?? 0) + 1);
  }
  for (const count of rankCounts.values()) {
    if (count >= 2) return true;
  }
  // 五张散点可组顺/同花顺（如 game-3 turn87），不算「全散单」
  if (nonJokerCount >= 5 && rankCounts.size >= 5) return true;
  return false;
}

/**
 * 接风 / 开局：优先减手成牌，抑制连炸。
 */
export function tempoLeadAdjustment(candidate, hand, tableContext, cardKey, levelRank = "2") {
  const { leadMode, isOpening } = tableContext;
  if (!isOpening || leadMode === "must-beat") return { score: 0, reasons: [] };

  const reasons = [];
  let score = 0;

  if (leadMode === "catch-wind") {
    const heavyHand = hand.length >= 15;
    const probeHand = hand.length >= 10;

    const playerIndex = tableContext.playerIndex ?? tableContext.state?.currentPlayerIndex ?? 0;
    const justWonWithBomb = playerJustWonTrickWithBomb(tableContext.state, playerIndex);

    if (candidate.type === PLAY_TYPES.straightFlush) {
      const oneShot = (candidate.cards?.length ?? 0) === hand.length;
      if (oneShot) {
        score -= heavyHand ? 4600 : 4000;
        reasons.push("接风同花顺一手走完");
      } else if (justWonWithBomb && hand.length > 7) {
        score += heavyHand ? 8200 : 7200;
        reasons.push("刚炸夺权不必空扔同花顺，先走对子/三带二/小单");
      } else {
        score -= heavyHand ? 4600 : 4000;
        reasons.push("接风成组同花顺一次减五张，优于再动炸弹");
      }
    } else if (BOMB_TYPES.has(candidate.type)) {
      const bombSize = candidate.bombSize ?? candidate.cards?.length ?? 4;
      let bombPenalty = 5200;
      if (justWonWithBomb && hand.length > 7) {
        bombPenalty += bombSize >= 5 ? 12_000 : 4000;
        reasons.push(bombSize >= 5
          ? "刚炸夺权接风不宜连扔厚炸，先走成组牌减手"
          : "刚炸夺权接风不宜连炸，先走成组牌减手数");
      } else {
        reasons.push("接风后不宜连炸，先走成组牌减手数");
      }
      score += bombPenalty;
    } else if (candidate.type === PLAY_TYPES.consecutivePairs) {
      const groupLen = candidate.length ?? candidate.cards?.length ?? 0;
      if (groupLen >= 6) {
        score -= heavyHand ? 5400 : 4800;
        reasons.push("接风连对一次减六张，抢节奏减手");
      } else if (groupLen >= 4) {
        score -= 3800;
        reasons.push("接风连对减手，保留同花顺给控权");
      }
    } else if (candidate.type === PLAY_TYPES.plane) {
      const groupLen = candidate.length ?? candidate.cards?.length ?? 0;
      if (groupLen >= 6) {
        score -= heavyHand ? 5200 : 4600;
        reasons.push("接风钢板一次减六张，抢节奏减手");
      }
    } else if (candidate.type === PLAY_TYPES.tripleWithPair) {
      const highTriple = compareRanks(candidate.mainRank, "J", levelRank) >= 0
        || candidate.mainRank === levelRank;
      const pairRank = (candidate.cards ?? []).find((card) => card.rank !== candidate.mainRank)?.rank ?? null;
      const pairRanksInHand = [];
      const rankCounts = new Map();
      for (const card of hand) {
        if (isJoker(card)) continue;
        rankCounts.set(card.rank, (rankCounts.get(card.rank) ?? 0) + 1);
      }
      for (const [rank, count] of rankCounts.entries()) {
        if (count === 2 && rank !== candidate.mainRank) pairRanksInHand.push(rank);
      }
      const solePairLead = pairRank != null && pairRanksInHand.length === 1 && pairRanksInHand[0] === pairRank;
      const heavyCatchWind = hand.length >= 20;
      if (solePairLead && !heavyCatchWind) {
        score -= heavyHand ? 4200 : 5200;
        reasons.push("接风三带二一次减五张，优于裸三张或拆结构");
      } else if (probeHand && highTriple) {
        score += heavyHand ? 2600 : 1600;
        reasons.push("接风手牌仍多，不宜急着组大三带二");
      }
      if (!solePairLead) {
        score -= heavyHand && highTriple ? 2000 : 3400;
      }
      if (!probeHand || !highTriple || (solePairLead && !heavyCatchWind)) {
        reasons.push(solePairLead && !heavyCatchWind
          ? "接风三带二带唯一对子，一次减五张"
          : "接风优先三带二、顺子等减手结构");
      }
    } else if (
      TEMPO_TYPES.has(candidate.type)
      && candidate.type !== PLAY_TYPES.plane
      && candidate.type !== PLAY_TYPES.consecutivePairs
      && candidate.type !== PLAY_TYPES.triple
    ) {
      const endgameStraight = hand.length <= 10 && candidate.type === PLAY_TYPES.straight && candidate.length >= 5;
      score -= endgameStraight ? 3600 : 2200;
      reasons.push(endgameStraight
        ? "残局接风顺子一次减五张，优于小单试探"
        : "接风用成组牌抢节奏，保留炸弹给拦截");
    } else if (candidate.type === PLAY_TYPES.triple) {
      const rankCounts = new Map();
      for (const card of hand) {
        if (isJoker(card)) continue;
        rankCounts.set(card.rank, (rankCounts.get(card.rank) ?? 0) + 1);
      }
      const otherPairs = [...rankCounts.entries()].filter(
        ([rank, count]) => count === 2 && rank !== candidate.mainRank,
      );
      if (otherPairs.length === 1) {
        score += 3200;
        reasons.push(`手上有对${otherPairs[0][0]}可配，不宜裸三张`);
      } else {
        score -= 2200;
        reasons.push("接风用成组牌抢节奏，保留炸弹给拦截");
      }
    } else if (candidate.type === PLAY_TYPES.pair) {
      const pairRank = candidate.mainRank;
      let tripleHeld = 0;
      const companionPairRanks = [];
      const rankCounts = new Map();
      for (const card of hand) {
        if (isJoker(card)) continue;
        rankCounts.set(card.rank, (rankCounts.get(card.rank) ?? 0) + 1);
      }
      tripleHeld = rankCounts.get(pairRank) ?? 0;
      for (const [rank, count] of rankCounts.entries()) {
        if (count === 2 && rank !== pairRank) companionPairRanks.push(rank);
      }
      if (tripleHeld >= 3 && companionPairRanks.length === 1) {
        score += heavyHand ? 4800 : 4000;
        reasons.push(
          `接风应${pairRank}带对${companionPairRanks[0]}三带二减五张，不宜拆三出对`,
        );
        return { score, reasons };
      }
      if (tripleHeld >= 3) {
        score += heavyHand ? 6200 : 5200;
        reasons.push(`接风有${tripleHeld}张${pairRank}，不宜裸对子，优先三带二或连对`);
        return { score, reasons };
      }
      const pairRanks = [...rankCounts.entries()]
        .filter(([, count]) => count === 2)
        .map(([rank]) => rank)
        .sort((left, right) => rankPower(left, levelRank) - rankPower(right, levelRank));
      for (const [tripleRank, count] of rankCounts.entries()) {
        if (count < 3) continue;
        const companionPairs = pairRanks.filter((rank) => rank !== tripleRank);
        if (companionPairs.length === 0) continue;
        const minCompanion = companionPairs[0];
        const higherOrphan = companionPairs.find(
          (rank) => rankPower(rank, levelRank) > rankPower(minCompanion, levelRank),
        );
        if (solePairForTripleRank(hand, levelRank, tripleRank) === pairRank) {
          score += heavyHand ? 5200 : 4200;
          reasons.push(`对${pairRank}待配三个${tripleRank}组三带二，接风不宜先裸出`);
          return { score, reasons };
        }
        if (higherOrphan && pairRank === minCompanion) {
          score += heavyHand ? 4800 : 3800;
          reasons.push(
            `对${pairRank}留给三个${tripleRank}三带二更优，接风宜出对${higherOrphan}抬高下家门槛`,
          );
          return { score, reasons };
        }
        if (higherOrphan && pairRank === higherOrphan) {
          score -= heavyHand ? 1200 : 1800;
          reasons.push(
            `出对${pairRank}保留${tripleRank}带对${minCompanion}，抬高下家出牌门槛`,
          );
        }
      }
      score -= 2400;
      reasons.push("接风优先对子减手，比散单更高效");
    } else if (candidate.type === PLAY_TYPES.single) {
      const left = remainingHandAfter(candidate, hand, cardKey);
      const hasGroupOption = handHasGroupReductionOption(hand);
      if (hand.length <= 10) {
        score += 2200;
        reasons.push(hasGroupOption
          ? "残局接风有成组牌可减手，不宜先打单张"
          : "残局全散单，先送小牌减手");
      } else if (left >= 10) {
        score -= 1400;
        reasons.push("手牌尚多，可先小单试探");
      } else if (left >= 9) {
        score -= 600;
        reasons.push("手牌尚多，可先小单试探");
      } else if (left > 8) {
        score += 280;
        reasons.push("接风阶段少用小单浪费牌权");
      } else {
        score += 80;
        reasons.push("接风阶段少用小单浪费牌权");
      }
    }
    return { score, reasons };
  }

  if (leadMode === "fresh-open") {
    if (BOMB_TYPES.has(candidate.type)) {
      score += 4200;
      reasons.push("开局有普通路线时不空炸");
    } else if (candidate.type === PLAY_TYPES.plane && candidate.length >= 6) {
      score -= 2400;
      reasons.push("领出有钢板优先一次减六张");
    } else if (candidate.type === PLAY_TYPES.tripleWithPair) {
      score -= 1600;
    } else if (candidate.type === PLAY_TYPES.single) {
      if (hand.length >= 15) {
        score -= 1400;
        reasons.push("手牌尚多，可先小单试探");
      }
    } else if (
      TEMPO_TYPES.has(candidate.type)
      && candidate.type !== PLAY_TYPES.plane
      && candidate.type !== PLAY_TYPES.consecutivePairs
    ) {
      score -= 900;
    }
  }

  return { score, reasons };
}
