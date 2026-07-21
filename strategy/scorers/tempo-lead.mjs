import { isJoker, isWildCard } from "../../engine/card.mjs";
import { generateBasicCandidates } from "../../engine/generate-candidates.mjs";
import { analyzeRankAvailability } from "./structure.mjs";
import { leadSfRunwayTempoPenalty } from "../sf-runway-guard.mjs";
import { PLAY_TYPES } from "../../engine/play-types.mjs";
import { compareRanks, isControlRank } from "../../engine/rank-order.mjs";
import { rankPower } from "../../engine/rank-order.mjs";
import {
  playerJustWonTrickWithBomb,
  playerJustWonTrickWithGroupPlay,
  isCatchWindPremiumReduction,
  lastCatchWindWinningPlay,
  CATCH_WIND_RUNWAY_HAND_MAX,
} from "../lead-mode.mjs";
import { isThickBombSingleLead, solePairForTripleRank, isBareLevelRankPairLead } from "../principles.mjs";
import { opponentsWithOneCard, partnerHandCount, partnerOpeningRoute } from "../table-context.mjs";

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

function matchesPreferredGroup(candidate, tableContext, cardKey) {
  if (!candidate?.cards?.length) return false;
  const candidateKeys = new Set(candidate.cards.map(cardKey));
  for (const group of tableContext.preferredGroups ?? []) {
    const play = group.play;
    const cards = group.cards ?? [];
    if (!play || play.type !== candidate.type || cards.length !== candidate.cards.length) continue;
    const groupKeys = cards.map(cardKey);
    if (groupKeys.every((key) => candidateKeys.has(key))) return true;
  }
  return false;
}

/** 散小单张（≤7，非王/级牌控场），按点数升序 — L1/L2 弱路与尾牌原理共用 */
export function looseSmallSingleRanks(hand, levelRank) {
  const rankCounts = new Map();
  for (const card of hand) {
    if (isJoker(card)) continue;
    rankCounts.set(card.rank, (rankCounts.get(card.rank) ?? 0) + 1);
  }
  const singles = [];
  for (const [rank, count] of rankCounts) {
    if (count !== 1) continue;
    if (rank === levelRank || isControlRank(rank, levelRank)) continue;
    if (compareRanks(rank, "7", levelRank) <= 0) singles.push(rank);
  }
  return singles.sort((left, right) => rankPower(left, levelRank) - rankPower(right, levelRank));
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

/** 手牌是否仍含非一手走完的同花顺/厚炸收尾结构 */
function handHasPremiumFinishRoute(hand, levelRank) {
  const opens = generateBasicCandidates(hand, levelRank, null);
  return opens.some(
    (item) => (item.type === PLAY_TYPES.straightFlush || item.type === PLAY_TYPES.bomb)
      && (item.cards?.length ?? 0) < hand.length
      && (item.bombSize ?? item.cards?.length ?? 0) >= 4,
  );
}

/** 可用于回收牌权的控场单张（J 以上或王） */
function recoverySingleRanks(hand, levelRank) {
  const ranks = [];
  const rankCounts = new Map();
  for (const card of hand) {
    if (isJoker(card)) {
      ranks.push(card.rank);
      continue;
    }
    rankCounts.set(card.rank, (rankCounts.get(card.rank) ?? 0) + 1);
  }
  for (const [rank, count] of rankCounts.entries()) {
    if (count === 1 && compareRanks(rank, "J", levelRank) >= 0) ranks.push(rank);
  }
  return ranks;
}

/**
 * 接风 / 开局：优先减手成牌，抑制连炸。
 */
export function tempoLeadAdjustment(candidate, hand, tableContext, cardKey, levelRank = "2") {
  const { leadMode, isOpening } = tableContext;
  if (!isOpening || leadMode === "must-beat") return { score: 0, reasons: [] };

  const reasons = [];
  let score = 0;

  // 对手报单 + 极短手控场：接风/领出均适用（如 U90 出10留王）
  if (
    candidate.type === PLAY_TYPES.single
    && hand.length <= 3
  ) {
    const oppOneCard = opponentsWithOneCard(tableContext);
    const holdControl = hand.some(
      (card) => isJoker(card) || card.rank === levelRank,
    );
    if (oppOneCard.length > 0 && holdControl) {
      const hasMediumProbe = hand.some(
        (card) => !isJoker(card)
          && compareRanks(card.rank, "8", levelRank) >= 0
          && compareRanks(card.rank, "Q", levelRank) <= 0,
      );
      if (isControlRank(candidate.mainRank, levelRank)) {
        if (hasMediumProbe && (candidate.mainRank === "SJ" || candidate.mainRank === "BJ")) {
          score += 20_000;
          reasons.push("对手报单，有中等单张不宜先出王");
        } else {
          score -= 14_000;
          reasons.push("对手报单，留王/级牌控场，不宜先送小单");
        }
      } else if (
        compareRanks(candidate.mainRank, "8", levelRank) >= 0
        && compareRanks(candidate.mainRank, "Q", levelRank) <= 0
      ) {
        score -= 9000;
        reasons.push("对手报单，试探中等单张留控权");
      } else if (compareRanks(candidate.mainRank, "7", levelRank) <= 0) {
        score += 11_000;
        reasons.push("对手报单，不宜出过小单放行");
      } else {
        score += 14_000;
        reasons.push("对手报单，宜先出控场牌，小单易被放行");
      }
      return { score, reasons };
    }
  }

  if (
    (leadMode === "catch-wind" || leadMode === "fresh-open")
    && isBareLevelRankPairLead(candidate, hand, levelRank, tableContext._candidates ?? [])
  ) {
    score += hand.length >= 15 ? 9000 : 7500;
    reasons.push(`级牌对${levelRank}不宜领出/接风裸出，宜三带二或小对减手`);
    return { score, reasons };
  }

  if (leadMode === "catch-wind") {
    const heavyHand = hand.length >= 15;
    const sfRunwayPenalty = leadSfRunwayTempoPenalty(candidate, hand, levelRank, tableContext, { heavyHand });
    if (sfRunwayPenalty) {
      score += sfRunwayPenalty.score;
      reasons.push(sfRunwayPenalty.reason);
      return { score, reasons };
    }

    const probeHand = hand.length >= 10;
    const partnerRoute = partnerOpeningRoute(tableContext);
    const supportRole = tableContext.handProfile?.role === "support";
    const partnerSprintFinish = partnerHandCount(tableContext) === 1;

    if (partnerSprintFinish && hand.length > 1) {
      if (
        candidate.type === PLAY_TYPES.single
        && candidate.mainRank
        && !isJoker({ rank: candidate.mainRank })
      ) {
        score -= 5200;
        reasons.push("【P10】队友剩1张，接风宜小单送队友走完");
      } else if (
        candidate.type === PLAY_TYPES.tripleWithPair
        || (
          candidate.type === PLAY_TYPES.consecutivePairs
          && (candidate.length ?? candidate.cards?.length ?? 0) < 6
          && !matchesPreferredGroup(candidate, tableContext, cardKey)
        )
        || (
          candidate.type === PLAY_TYPES.plane
          && !matchesPreferredGroup(candidate, tableContext, cardKey)
        )
      ) {
        score += 6400;
        reasons.push("【P10】队友剩1张冲刺，不宜三带二/成组抢权");
      }
    }

    const playerIndex = tableContext.playerIndex ?? tableContext.state?.currentPlayerIndex ?? 0;
    const justWonWithBomb = playerJustWonTrickWithBomb(tableContext.state, playerIndex);

    if (candidate.type === PLAY_TYPES.straightFlush) {
      const oneShot = (candidate.cards?.length ?? 0) === hand.length;
      if (oneShot) {
        score -= heavyHand ? 4600 : 4000;
        reasons.push("接风同花顺一手走完");
      } else if (justWonWithBomb && hand.length > 7) {
        score -= heavyHand ? 5400 : 4800;
        reasons.push("刚炸夺权接风优先成组减手，同花顺可抢节奏");
        if (hand.length <= CATCH_WIND_RUNWAY_HAND_MAX && !(candidate.cards ?? []).some((card) => isWildCard(card, levelRank))) {
          score -= 4200;
          reasons.push("接风走完整理牌列10-J-Q-K-A跑道，保留另一道同花顺");
        }
      } else if (hand.length > 7) {
        if (isCatchWindPremiumReduction(candidate, tableContext)) {
          score -= heavyHand ? 7200 : 8400;
          reasons.push("接风同花顺减五张，抢节奏");
        } else {
          score += heavyHand ? 7200 : 8600;
          reasons.push("接风有普通路线时不空扔同花顺");
        }
      } else {
        score -= 3600;
        reasons.push("残局接风成组同花顺减手");
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
      if (
        // T5：队友首发对子/三带二，不宜换路连对
        supportRole
        && partnerRoute
        && [PLAY_TYPES.pair, PLAY_TYPES.tripleWithPair].includes(partnerRoute.type)
      ) {
        score += groupLen >= 6 ? 6800 : 5200;
        reasons.push("【T5】队友首发对子/三带二，接风宜同路送桥不宜换路连对");
      } else if (groupLen >= 6) {
        if (justWonWithBomb && hand.length <= CATCH_WIND_RUNWAY_HAND_MAX) {
          score += 2600;
          reasons.push("刚同花顺接风不宜六张连对，易拆同花顺/A线");
        } else {
          score -= heavyHand ? 5400 : 4800;
          if (matchesPreferredGroup(candidate, tableContext, cardKey) || groupLen >= 6) {
            score -= 11_000;
            reasons.push("【P5】接风优先走完整理牌列连对，一次减六张");
          }
          reasons.push(justWonWithBomb
            ? "刚炸夺权接风连对一次减六张，抢节奏减手"
            : "接风连对一次减六张，抢节奏减手");
        }
      } else if (groupLen >= 4) {
        if (justWonWithBomb && hand.length <= CATCH_WIND_RUNWAY_HAND_MAX) {
          score += 2200;
          reasons.push("刚同花顺接风不宜换路连对，易拆同花顺/A线");
        } else {
          score -= justWonWithBomb ? 4200 : 3800;
          reasons.push(justWonWithBomb
            ? "刚炸夺权接风连对减手，优于小单试探"
            : "接风连对减手，保留同花顺给控权");
        }
      }
    } else if (candidate.type === PLAY_TYPES.straight) {
      const playerIndex = tableContext.playerIndex ?? tableContext.state?.currentPlayerIndex ?? 0;
      const lastWin = lastCatchWindWinningPlay(tableContext.state, playerIndex);
      if (
        lastWin?.type === PLAY_TYPES.straightFlush
        && hand.length <= CATCH_WIND_RUNWAY_HAND_MAX
      ) {
        score -= 8000;
        reasons.push("刚出同花顺接风，安全杂顺一次减五张优于留对");
      }
    } else if (candidate.type === PLAY_TYPES.plane) {
      const groupLen = candidate.length ?? candidate.cards?.length ?? 0;
      if (groupLen >= 6) {
        if (justWonWithBomb && hand.length <= CATCH_WIND_RUNWAY_HAND_MAX) {
          score += 2200;
          reasons.push("刚同花顺接风不宜钢板，易拆同花顺/A线");
        } else {
          score -= heavyHand ? 5200 : 4600;
          if (matchesPreferredGroup(candidate, tableContext, cardKey)) {
            score -= 11_000;
            reasons.push("【P5】接风优先走完整理牌列钢板，一次减六张");
          }
          reasons.push("接风钢板一次减六张，抢节奏减手");
        }
      }
    } else if (candidate.type === PLAY_TYPES.tripleWithPair) {
      if (
        supportRole
        && partnerRoute?.type === PLAY_TYPES.tripleWithPair
      ) {
        score -= 4600;
        reasons.push("【T5】接风同路三带二送桥，延续队友首发牌路");
      }
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
      const endgameStraight = hand.length <= CATCH_WIND_RUNWAY_HAND_MAX && candidate.type === PLAY_TYPES.straight && candidate.length >= 5;
      // 《掼蛋技巧秘籍》T5 送桥：读队友首发牌路，接风不宜换路顺子
      if (
        supportRole
        && partnerRoute
        && candidate.type === PLAY_TYPES.straight
        && [PLAY_TYPES.pair, PLAY_TYPES.tripleWithPair].includes(partnerRoute.type)
      ) {
        score += 5200;
        reasons.push("【T5】队友首发对子/三带二，接风宜同路送桥不宜换路顺子");
      } else {
        score -= endgameStraight ? 3600 : 2200;
        if (justWonWithBomb && endgameStraight) {
          score -= 1400;
          reasons.push("刚同花顺接风宜先走杂顺减手，保留同花顺控权");
        } else {
          reasons.push(endgameStraight
            ? "残局接风顺子一次减五张，优于小单试探"
            : "接风用成组牌抢节奏，保留炸弹给拦截");
        }
      }
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
      // T5：队友首发对子/三带二，接风优先同路对子送桥
      if (
        supportRole
        && partnerRoute
        && (partnerRoute.type === PLAY_TYPES.pair || partnerRoute.type === PLAY_TYPES.tripleWithPair)
      ) {
        score -= 6200;
        reasons.push("【T5】接风同路对子送桥，延续队友首发牌路");
      }
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
      if (pairRank === levelRank && tripleHeld === 2 && hand.length > 6) {
        const hasAltLead = (tableContext._candidates ?? []).some(
          (item) => item.type !== PLAY_TYPES.pass
            && !(item.type === PLAY_TYPES.pair && item.mainRank === levelRank),
        );
        if (hasAltLead) {
          score += heavyHand ? 7200 : 6000;
          reasons.push(`级牌对${pairRank}不宜接风裸出，宜三带二/连对/小对减手`);
          return { score, reasons };
        }
      }
      const pairRanks = [...rankCounts.entries()]
        .filter(([, count]) => count === 2)
        .map(([rank]) => rank)
        .sort((left, right) => rankPower(left, levelRank) - rankPower(right, levelRank));
      // 级牌对不宜裸出：有三带二路线时一次减五张，优于「出级牌对保留三带二」
      if (pairRank === levelRank) {
        for (const [tripleRank, count] of rankCounts.entries()) {
          if (count < 3) continue;
          const companionPairs = pairRanks.filter((rank) => rank !== tripleRank);
          if (companionPairs.length === 0) continue;
          const minCompanion = companionPairs[0];
          score += heavyHand ? 5600 : 4800;
          reasons.push(
            `级牌对${pairRank}不宜裸出浪费控场，应${tripleRank}带对${minCompanion}三带二减五张`,
          );
          return { score, reasons };
        }
      }
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
      const premiumFinish = hand.length <= 12 && handHasPremiumFinishRoute(hand, levelRank);
      const recoverySingles = recoverySingleRanks(hand, levelRank);
      if (
        premiumFinish
        && recoverySingles.length > 0
        && compareRanks(pairRank, "7", levelRank) <= 0
      ) {
        score += 6200;
        reasons.push("【G6】残局接风小对易被压，宜保留对子与同花顺收尾");
        return { score, reasons };
      }
      score -= 2400;
      reasons.push("接风优先对子减手，比散单更高效");
    } else if (candidate.type === PLAY_TYPES.single) {
      const left = remainingHandAfter(candidate, hand, cardKey);
      const hasGroupOption = handHasGroupReductionOption(hand);

      if (hand.length <= 10) {
        const premiumFinish = handHasPremiumFinishRoute(hand, levelRank);
        const recoverySingles = recoverySingleRanks(hand, levelRank);
        const isProbeSingle = compareRanks(candidate.mainRank, "7", levelRank) <= 0;
        const isRecoverySingle = recoverySingles.includes(candidate.mainRank)
          || (candidate.cards ?? []).some((c) => isJoker(c));
        if (premiumFinish && recoverySingles.length > 0 && isProbeSingle) {
          score -= 5800;
          reasons.push("【G6】残局接风宜小单试探，保留对子与同花顺收尾");
        } else if (premiumFinish && recoverySingles.length > 0 && isRecoverySingle) {
          score += 6400;
          reasons.push("【G6】宜先送小单试探，保留 Q/K/王 回收牌权");
        } else {
          score += 2200;
          reasons.push(hasGroupOption
            ? "残局接风有成组牌可减手，不宜先打单张"
            : "残局全散单，先送小牌减手");
        }
      } else if (justWonWithBomb && hasGroupOption && hand.length > 7) {
        score += heavyHand ? 9200 : 8400;
        reasons.push("刚炸夺权接风有成组减手路线，不宜先小单试探");
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
    const sfRunwayPenalty = leadSfRunwayTempoPenalty(candidate, hand, levelRank, tableContext, {
      heavyHand: hand.length >= 15,
    });
    if (sfRunwayPenalty) {
      score += sfRunwayPenalty.score;
      reasons.push(sfRunwayPenalty.reason);
      return { score, reasons };
    }

    const role = tableContext.handProfile?.role ?? "balanced";
    const looseSmalls = looseSmallSingleRanks(hand, levelRank);
    const looseSingleGate = role === "main-attack"
      && (tableContext.handProfile?.looseSingles ?? looseSmalls.length) >= 2
      && looseSmalls.length >= 2;

    if (candidate.type === PLAY_TYPES.tripleWithPair) {
      const tripleRank = candidate.mainRank;
      let physicalHeld = 0;
      for (const card of hand) {
        if (isJoker(card)) continue;
        if (card.rank === tripleRank) physicalHeld += 1;
      }
      if (physicalHeld === 3) {
        const candidates = tableContext._candidates ?? [];
        let cpBreaksTriple = false;
        for (const item of candidates) {
          if (item.type !== PLAY_TYPES.consecutivePairs) continue;
          if ((item.length ?? item.cards?.length ?? 0) < 4) continue;
          const used = (item.cards ?? []).filter((c) => c.rank === tripleRank).length;
          if (used >= 2) {
            cpBreaksTriple = true;
            break;
          }
        }
        if (cpBreaksTriple) {
          score -= 4600;
          reasons.push(`三个${tripleRank}宜组三带二减手，不宜裸对或拆三凑连对`);
        }
      }
    } else if (candidate.type === PLAY_TYPES.triple) {
      const tripleRank = candidate.mainRank;
      let physicalHeld = 0;
      for (const card of hand) {
        if (isJoker(card)) continue;
        if (card.rank === tripleRank) physicalHeld += 1;
      }
      if (physicalHeld === 3 && hand.length > 15) {
        score += 22_000;
        reasons.push(`三个${tripleRank}宜三带二减手，不宜裸三张`);
      }
    } else if (BOMB_TYPES.has(candidate.type)) {
      score += 4200;
      reasons.push("开局有普通路线时不空炸");
    } else if (candidate.type === PLAY_TYPES.plane && candidate.length >= 6) {
      score -= 2400;
      reasons.push("领出有钢板优先一次减六张");
    } else if (candidate.type === PLAY_TYPES.tripleWithPair) {
      score -= 1600;
    } else if (candidate.type === PLAY_TYPES.pair && role === "support" && hand.length >= 10) {
      score += 4800;
      reasons.push("【助攻】情况不明时对子先行，示弱兼探路");
    } else if (candidate.type === PLAY_TYPES.single) {
      if (hand.length >= 15 && !isThickBombSingleLead(candidate, hand)) {
        score -= 1400;
        reasons.push("手牌尚多，可先小单试探");
      }
      // 主攻《尾牌原理》：两个小单先出较大的卡下家，最小单留尾牌
      if (role === "main-attack" && looseSmalls.length >= 2 && hand.length > 15
        && looseSmalls.includes(candidate.mainRank)) {
        score += 9800;
        reasons.push("【L1】手牌仍多，弱路散单让位于三带二/连对减手");
      }
      if (role === "main-attack" && looseSmalls.length >= 2) {
        const tailRank = looseSmalls[0];
        const leadRank = looseSmalls[looseSmalls.length - 1];
        if (candidate.mainRank === leadRank && leadRank !== tailRank) {
          score += 5200;
          reasons.push("【尾牌原理】两个小单先出较大的，最小单留作尾牌卡下家");
        } else if (candidate.mainRank === tailRank) {
          score -= 4200;
          reasons.push("【尾牌原理】最小单张宜留作尾牌，先出稍大小单");
        }
      }
      if (role === "support" && hand.length >= 10) {
        score -= 5200;
        reasons.push("【助攻】情况不明时不宜先出单张，对子先行更稳");
      }
    } else if (
      TEMPO_TYPES.has(candidate.type)
      && candidate.type !== PLAY_TYPES.plane
      && candidate.type !== PLAY_TYPES.consecutivePairs
    ) {
      score -= 900;
    } else if (looseSingleGate && candidate.type !== PLAY_TYPES.single) {
      // L1 两小单不健康：主攻须先出散单，不宜首出组牌/对子（第12篇）
      score += 6800;
      reasons.push("【L1】主攻两小单须先出散单，不宜首出组牌");
    } else if (
      looseSingleGate
      && candidate.type === PLAY_TYPES.single
      && !looseSmalls.includes(candidate.mainRank)
    ) {
      score += 3600;
      reasons.push("【L1】两小单未处理前，不宜先出非弱路单张");
    }
  }

  return { score, reasons };
}
