import { cardId, cardLabel, isJoker } from "../../engine/card.mjs";
import { compareRanks, isControlRank, rankOrder } from "../../engine/rank-order.mjs";
import { PLAY_TYPES } from "../../engine/play-types.mjs";
import { buildStrategicGroups } from "../strategic-groups.mjs";

const BOMB_TYPES = new Set([PLAY_TYPES.bomb, PLAY_TYPES.straightFlush, PLAY_TYPES.jokerBomb]);

const CHAIN_GROUP_TYPES = new Set([
  PLAY_TYPES.consecutivePairs,
  PLAY_TYPES.plane,
  PLAY_TYPES.straight,
]);

/** 三带二带对的配对点数 */
export function inferTripleWithPairKickerRank(candidate) {
  if (candidate?.type !== PLAY_TYPES.tripleWithPair) return null;
  const tripleRank = candidate.mainRank;
  const kicker = (candidate.cards ?? []).find((card) => card.rank !== tripleRank);
  return kicker?.rank ?? null;
}

/** 理牌后连对/钢板/顺子占用的点数 */
function ranksInStrategicChainGroups(hand, levelRank) {
  const groups = buildStrategicGroups(hand, levelRank);
  const locked = new Set();
  for (const group of groups) {
    if (!CHAIN_GROUP_TYPES.has(group.play?.type)) continue;
    for (const card of group.cards ?? []) {
      if (card.rank !== "SJ" && card.rank !== "BJ") locked.add(card.rank);
    }
  }
  return locked;
}

/** 三带二带对是否会拆掉理牌后的连对/钢板/顺子 */
export function tripleWithPairKickerBreaksStrategicGroup(candidate, hand, levelRank) {
  if (candidate?.type !== PLAY_TYPES.tripleWithPair || !hand?.length) return null;
  const kickerRank = inferTripleWithPairKickerRank(candidate);
  if (!kickerRank) return null;
  const groups = buildStrategicGroups(hand, levelRank);
  for (const group of groups) {
    if (!CHAIN_GROUP_TYPES.has(group.play?.type)) continue;
    const rankCards = (group.cards ?? []).filter((card) => card.rank === kickerRank);
    if (rankCards.length >= 2) return group.label ?? "成组结构";
  }
  return null;
}

/** 三带二可用的安全带对点数（不拆炸、不拆连对/钢板/顺子），从小到大 */
export function findSafeKickerPairRanksForTriple(hand, levelRank, tripleRank) {
  const chainRanks = ranksInStrategicChainGroups(hand, levelRank);
  const safe = [];
  for (const rank of rankOrder(levelRank)) {
    if (rank === tripleRank || rank === "SJ" || rank === "BJ") continue;
    if (chainRanks.has(rank)) continue;
    const held = physicalRankCount(hand, rank);
    if (held < 2) continue;
    const info = analyzeRankAvailability(hand, rank, levelRank);
    if (info.effectiveBombCount >= 4 && held <= info.effectiveBombCount) continue;
    safe.push(rank);
  }
  return safe;
}

/** 三带二/三张是否会拆掉理牌后的顺子 */
function playBreaksStrategicStraight(candidate, hand, levelRank) {
  if (candidate?.type !== PLAY_TYPES.tripleWithPair && candidate?.type !== PLAY_TYPES.triple) return null;
  return tripleWithPairBreaksStrategicStraight(
    candidate.type === PLAY_TYPES.triple
      ? { type: PLAY_TYPES.tripleWithPair, mainRank: candidate.mainRank }
      : candidate,
    hand,
    levelRank,
  );
}
function tripleWithPairBreaksStrategicStraight(candidate, hand, levelRank) {
  if (candidate?.type !== PLAY_TYPES.tripleWithPair || !hand?.length) return null;
  const groups = buildStrategicGroups(hand, levelRank);
  const straightGroup = groups.find((group) => group.play?.type === PLAY_TYPES.straight);
  if (!straightGroup) return null;
  const tripleRank = candidate.mainRank;
  const inStraight = (straightGroup.cards ?? []).some((card) => card.rank === tripleRank);
  if (!inStraight || physicalRankCount(hand, tripleRank) < 3) return null;
  const straights = groups.filter((group) => group.play?.type === PLAY_TYPES.straight);
  const protectedStraights = straights.filter(
    (group) => (group.cards ?? []).some((card) => card.rank === tripleRank),
  );
  const hasDisjointAltStraight = straights.some(
    (group) => !protectedStraights.includes(group)
      && !(group.cards ?? []).some((card) => card.rank === tripleRank),
  );
  const protectedIsWrapStraight = protectedStraights.some(
    (group) => group.label?.includes("A-2-3-4-5") || group.label?.startsWith("顺子 A"),
  );
  if (hasDisjointAltStraight && protectedIsWrapStraight) return null;
  return straightGroup.label ?? "顺子";
}

/** 手牌中是否留有大王作送单回收 */
function hasBigJokerRecovery(hand) {
  return hand.some((card) => card.rank === "BJ");
}

/** 某 rank 在理牌结构里被占用的牌（同花顺、钢板等，打出会拆结构） */
function lockedRankEntries(groups, rank) {
  const locked = [];
  for (const group of groups) {
    const play = group.play;
    const groupCards = group.cards ?? [];
    const rankCards = groupCards.filter((card) => card.rank === rank);
    if (rankCards.length === 0) continue;

    if (play.type === PLAY_TYPES.straightFlush) {
      for (const card of rankCards) {
        locked.push({ card, structure: "同花顺", groupLabel: group.label ?? "同花顺" });
      }
      continue;
    }
    if (play.type === PLAY_TYPES.plane) {
      for (const card of rankCards) {
        locked.push({ card, structure: "钢板", groupLabel: group.label ?? "钢板" });
      }
    }
  }
  return locked;
}

/** 手牌中某点物理张数（不含王） */
function physicalRankCount(hand, rank) {
  return hand.filter((card) => card.rank === rank && !isJoker(card)).length;
}

/** 普通炸弹是否动用同花顺内牌（未整组亮同花顺） */
export function breaksStrategicStraightFlush(candidate, hand, levelRank) {
  if (!candidate || candidate.type !== PLAY_TYPES.bomb || !hand?.length) return null;
  const candidateKeys = new Set((candidate.cards ?? []).map((card) => cardId(card)));
  const groups = buildStrategicGroups(hand, levelRank);
  for (const group of groups) {
    if (group.play?.type !== PLAY_TYPES.straightFlush) continue;
    const groupKeys = (group.cards ?? []).map((card) => cardId(card));
    const used = groupKeys.filter((key) => candidateKeys.has(key)).length;
    if (used > 0 && used < groupKeys.length) {
      return group.label ?? "同花顺";
    }
    if (used === groupKeys.length && candidate.cards.length !== groupKeys.length) {
      return group.label ?? "同花顺";
    }
  }
  return null;
}

/** 理牌后该点是否仍成整炸（四张及以上同点炸弹组） */
function effectiveBombCountFromGroups(groups, rank) {
  for (const group of groups) {
    const play = group.play;
    if (play.type !== PLAY_TYPES.bomb) continue;
    const rankCards = (group.cards ?? []).filter((card) => card.rank === rank);
    if (rankCards.length >= 4) return rankCards.length;
  }
  return 0;
}

/**
 * 分析某 rank 可自由组三张的数量：扣除锁在同花顺/钢板里的牌。
 * effectiveBombCount 来自策略分组后的炸弹组，而非裸数四张。
 */
export function analyzeRankAvailability(hand, rank, levelRank) {
  const total = hand.filter((card) => card.rank === rank && !isJoker(card)).length;
  const groups = buildStrategicGroups(hand, levelRank);
  const lockedEntries = lockedRankEntries(groups, rank);
  const lockedIds = new Set(lockedEntries.map((entry) => cardId(entry.card)));
  const availableCount = total - lockedIds.size;
  const effectiveBombCount = effectiveBombCountFromGroups(groups, rank);

  return {
    total,
    availableCount,
    lockedEntries,
    effectiveBombCount,
    wouldBreakBombForTriple: effectiveBombCount >= 4 && effectiveBombCount - 3 < 4,
    canFormTriple: availableCount >= 3,
  };
}

export function getAvailableRankCount(hand, rank, levelRank) {
  return analyzeRankAvailability(hand, rank, levelRank).availableCount;
}

/** 生成教练可读的结构占用说明 */
export function explainRankAvailability(hand, rank, levelRank) {
  const info = analyzeRankAvailability(hand, rank, levelRank);
  const parts = [];

  if (info.lockedEntries.length > 0) {
    const grouped = new Map();
    for (const entry of info.lockedEntries) {
      if (!grouped.has(entry.structure)) grouped.set(entry.structure, []);
      grouped.get(entry.structure).push(cardLabel(entry.card));
    }
    for (const [structure, labels] of grouped) {
      parts.push(`${labels.join("、")}已在${structure}`);
    }
  }

  if (info.total >= 4 && info.effectiveBombCount < 4) {
    if (info.availableCount >= 3) {
      parts.push(`可组三张的仅 ${info.availableCount} 张，凑不齐四张同点炸弹`);
    } else {
      parts.push(`共 ${info.total} 张${rank}，但凑不齐四张同点炸弹（有牌锁在结构里）`);
    }
  }

  return {
    ...info,
    summary: parts.join("；"),
  };
}

/** 按策略分组列出真实炸弹（不含被同花顺拆散的裸四张） */
export function structureAwareBombs(hand, levelRank) {
  const groups = buildStrategicGroups(hand, levelRank);
  const bombs = [];
  for (const group of groups) {
    const play = group.play;
    if (play.type === PLAY_TYPES.bomb) {
      const rank = play.mainRank;
      const count = (group.cards ?? []).filter((card) => card.rank === rank).length;
      if (count >= 4) bombs.push({ rank, count });
    } else if (play.type === PLAY_TYPES.jokerBomb) {
      bombs.push({ rank: "JK", count: group.cards?.length ?? 4 });
    }
  }
  return bombs;
}

/** 出牌后该点物理上是否仍够四张炸 */
function physicalBombRemaining(hand, rank, usedCount) {
  return physicalRankCount(hand, rank) - usedCount;
}

/** 出牌是否会拆掉理牌后的整炸（基于策略分组，非裸数四张） */
function wouldBreakEffectiveBomb(hand, rank, usedCount, levelRank) {
  if (usedCount <= 0) return false;
  if (physicalBombRemaining(hand, rank, usedCount) >= 4) return false;
  const { effectiveBombCount, availableCount } = analyzeRankAvailability(hand, rank, levelRank);
  if (effectiveBombCount < 4) return false;
  if (usedCount > availableCount) return true;
  return effectiveBombCount - usedCount < 4;
}

const CATCH_WIND_TEMPO_TYPES = new Set([
  PLAY_TYPES.straight,
  PLAY_TYPES.consecutivePairs,
  PLAY_TYPES.plane,
  PLAY_TYPES.tripleWithPair,
]);

/** 出牌后各点物理剩余是否仍够四张炸（用于接风豁免边界） */
function candidateLeavesPhysicalBombsIntact(candidate, hand) {
  const usedCounts = new Map();
  for (const card of candidate.cards ?? []) {
    usedCounts.set(card.rank, (usedCounts.get(card.rank) ?? 0) + 1);
  }
  for (const [rank, usedCount] of usedCounts.entries()) {
    const remaining = physicalBombRemaining(hand, rank, usedCount);
    if (remaining > 0 && remaining < 4) return false;
  }
  return true;
}

/** 残局接风：成组大牌型减手收益高于死守小炸（不得导致炸弹物理作废） */
function isCatchWindEndgameTempo(candidate, hand, tableContext = {}) {
  if (tableContext.leadMode !== "catch-wind" || hand.length > 10) return false;
  if (!CATCH_WIND_TEMPO_TYPES.has(candidate.type)) return false;
  const groupLen = candidate.length ?? candidate.cards?.length ?? 0;
  if (groupLen < 5) return false;
  if (!candidateLeavesPhysicalBombsIntact(candidate, hand)) return false;
  return hand.length - candidate.cards.length <= 5;
}

/** 非整炸出牌后某点炸弹厚度不足四张（炸弹作废） */
export function breaksBombIntegrity(candidate, hand, levelRank, tableContext = {}) {
  if (!candidate || candidate.type === PLAY_TYPES.pass) return false;
  if (BOMB_TYPES.has(candidate.type)) return false;
  if (candidate.cards?.length === hand.length) return false;
  if (isCatchWindEndgameTempo(candidate, hand, tableContext)) return false;

  const usedCounts = new Map();
  for (const card of candidate.cards ?? []) {
    usedCounts.set(card.rank, (usedCounts.get(card.rank) ?? 0) + 1);
  }
  for (const [rank, usedCount] of usedCounts.entries()) {
    if (wouldBreakEffectiveBomb(hand, rank, usedCount, levelRank)) {
      return true;
    }
  }
  return false;
}

function structureRankCounts(hand, levelRank) {
  const counts = new Map();
  for (const card of hand) {
    if (card.rank === "SJ" || card.rank === "BJ") continue;
    if (card.rank === levelRank && card.suit === "H") continue;
    counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1);
  }
  return counts;
}

function isHighValueBombRank(rank, levelRank) {
  return isControlRank(rank, levelRank) || compareRanks(rank, "K", levelRank) >= 0;
}

export function structureBreakPenalty(candidate, hand, levelRank, tableContext) {
  if (candidate.type === PLAY_TYPES.bomb) {
    const sfLabel = breaksStrategicStraightFlush(candidate, hand, levelRank);
    if (sfLabel) {
      const wholeBombs = structureAwareBombs(hand, levelRank);
      let penalty = 18_000;
      if (wholeBombs.length > 0) penalty += 14_000;
      return {
        penalty,
        reasons: [
          wholeBombs.length > 0
            ? `为凑${candidate.mainRank}炸动用${sfLabel}内牌，有整炸${wholeBombs.map((b) => b.rank).join("/")}更优`
            : `为凑${candidate.mainRank}炸动用${sfLabel}内牌，同花顺价值更高`,
        ],
      };
    }
    return { penalty: 0, reasons: [] };
  }
  if (BOMB_TYPES.has(candidate.type)) return { penalty: 0, reasons: [] };

  const rankCounts = structureRankCounts(hand, levelRank);
  const opponentMustBeat = tableContext.opponentActive && tableContext.hasRegularWinner;
  const openingLead = tableContext.isOpening && tableContext.leadMode !== "must-beat";
  const catchWindLead = tableContext.leadMode === "catch-wind" && !opponentMustBeat;
  let penalty = 0;
  const reasons = [];
  const usedCounts = new Map();
  for (const card of candidate.cards) {
    usedCounts.set(card.rank, (usedCounts.get(card.rank) ?? 0) + 1);
  }

  for (const [rank, usedCount] of usedCounts.entries()) {
    const heldCount = rankCounts.get(rank) ?? 0;
    const bombInfo = analyzeRankAvailability(hand, rank, levelRank);
    const effectiveBombCount = bombInfo.effectiveBombCount;
    const physicalHeld = physicalRankCount(hand, rank);
    const physicalRemaining = physicalBombRemaining(hand, rank, usedCount);
    const catchWindTempo = isCatchWindEndgameTempo(candidate, hand, tableContext);
    const lockedInPlate = (bombInfo.lockedEntries ?? []).some((entry) => entry.structure === "钢板");

    // 压小单 P1–P4 由 principles.mjs 统一评分

    if (effectiveBombCount >= 4 && usedCount > 0 && usedCount <= bombInfo.availableCount) {
      if (physicalRemaining >= 4) {
        let reservePenalty = effectiveBombCount >= 6 ? 960 : 640;
        if (isHighValueBombRank(rank, levelRank)) reservePenalty += 280;
        if (physicalHeld >= 5) reservePenalty += physicalHeld >= 6 ? 3800 : 3000;
        if (opponentMustBeat) reservePenalty = Math.floor(reservePenalty * 0.55);
        if (catchWindTempo && CATCH_WIND_TEMPO_TYPES.has(candidate.type)) {
          reservePenalty = Math.floor(reservePenalty * 0.12);
          reasons.push(
            physicalHeld >= 5
              ? `接风顺子动${usedCount}张${rank}，仍剩${physicalRemaining}张可成炸`
              : `接风成组减手动${usedCount}张${rank}，炸弹仍够四张`,
          );
        } else if (
          openingLead
          && candidate.type === PLAY_TYPES.tripleWithPair
          && usedCount >= 2
          && rank !== candidate.mainRank
          && physicalHeld >= 5
        ) {
          reservePenalty += physicalHeld >= 6 ? 16_000 : 11_000;
          reasons.push(`领出三带二带对${rank}会削弱${physicalHeld}张${rank}炸弹厚度`);
        } else {
          reasons.push(`用掉部分${rank}后虽仍够四张炸，但会降低炸弹厚度`);
        }
        penalty += reservePenalty;
        continue;
      }

      const remainingCount = effectiveBombCount - usedCount;
      let bombBreakPenalty = remainingCount === 1 ? 2400 : remainingCount === 2 ? 1700 : 2100;
      if (effectiveBombCount === 4) bombBreakPenalty += 1250;
      if (effectiveBombCount >= 5) bombBreakPenalty += effectiveBombCount >= 6 ? 3600 : 2700;
      if (isHighValueBombRank(rank, levelRank)) bombBreakPenalty += 520;
      if (candidate.type === PLAY_TYPES.triple && usedCount >= 3) bombBreakPenalty += 420;
      if (effectiveBombCount >= 5 && candidate.type === PLAY_TYPES.triple) bombBreakPenalty += 1200;
      if (opponentMustBeat && effectiveBombCount >= 4) {
        if (candidate.type === PLAY_TYPES.pair) {
          bombBreakPenalty += 4800;
          reasons.push(`为压牌拆${effectiveBombCount}张${rank}对子，炸弹作废，优先整炸`);
        } else if (candidate.type === PLAY_TYPES.tripleWithPair && usedCount >= 3) {
          bombBreakPenalty += 12_800;
          reasons.push(`为压牌拆${effectiveBombCount}张${rank}三带二，炸弹作废，优先整炸或过牌`);
        } else if (candidate.type === PLAY_TYPES.triple && usedCount >= 3) {
          bombBreakPenalty += 10_800;
          reasons.push(`为压牌拆${effectiveBombCount}张${rank}三张，炸弹作废，优先整炸`);
        }
      }
      if (tableContext.partnerOwnsTrick && physicalRemaining < 4) {
        bombBreakPenalty += 3200;
        reasons.push("【P10】队友占牌，不宜压队友");
      }
      if (catchWindTempo) {
        bombBreakPenalty = Math.floor(bombBreakPenalty * 0.28);
      }
      penalty += bombBreakPenalty;
      reasons.push(
        physicalRemaining < 4
          ? `拆${physicalHeld}张${rank}后只剩${physicalRemaining}张，炸弹作废`
          : "这手会动到已有炸弹，需要用牌路收益来抵消",
      );
      continue;
    }

    // 接风拆钢板 P5 由 principles.mjs 统一评分

    if (
      heldCount === 3
      && usedCount === 2
      && lockedInPlate
      && candidate.type === PLAY_TYPES.consecutivePairs
      && (openingLead || catchWindLead)
    ) {
      penalty += 7500;
      reasons.push(`领出/接风拆钢板${rank}凑连对代价过高`);
    } else if (
      heldCount === 3
      && usedCount === 2
      && candidate.type === PLAY_TYPES.consecutivePairs
      && (openingLead || catchWindLead)
      && !lockedInPlate
      && hand.length >= 15
    ) {
      penalty += hand.length >= 15 ? 10_800 : 9200;
      reasons.push(`拆三张${rank}凑连对代价过高，应留三带二或其它连对`);
    } else if (heldCount === 3 && usedCount === 2 && candidate.type === PLAY_TYPES.pair) {
      let triplePenalty = opponentMustBeat ? 120 : lockedInPlate ? 1800 : 900;
      if (catchWindLead && !lockedInPlate) {
        let companionPairs = 0;
        for (const [otherRank, otherCount] of rankCounts.entries()) {
          if (otherRank !== rank && otherCount === 2) companionPairs += 1;
        }
        if (companionPairs === 1) {
          triplePenalty = hand.length >= 15 ? 6800 : 5200;
          reasons.push(`拆三张${rank}出对子，应优先三带二带唯一对子一次减五张`);
        }
      }
      penalty += triplePenalty;
      if (!opponentMustBeat && !reasons.some((reason) => reason.includes("三带二带唯一对子"))) {
        reasons.push(lockedInPlate ? `拆钢板${rank}出对子代价过高` : `拆三张${rank}出对子代价较高`);
      }
    } else if (
      heldCount === 3
      && usedCount === 3
      && candidate.type !== PLAY_TYPES.triple
      && candidate.type !== PLAY_TYPES.tripleWithPair
      && candidate.type !== PLAY_TYPES.plane
    ) {
      const isCatchWindTempo = catchWindLead && candidate.type === PLAY_TYPES.tripleWithPair;
      if (lockedInPlate) {
        penalty += opponentMustBeat ? 2400 : (openingLead ? 8200 : 6800);
        if (!opponentMustBeat) reasons.push(`拆钢板三张${rank}组其他牌型代价过高`);
      } else {
        penalty += opponentMustBeat ? 80 : isCatchWindTempo ? 60 : 520;
        if (!opponentMustBeat && !isCatchWindTempo) {
          reasons.push(`拆三张${rank}组其他牌型代价偏高`);
        }
        if (
          isCatchWindTempo
          && hasBigJokerRecovery(hand)
          && !lockedInPlate
          && buildStrategicGroups(hand, levelRank).some((group) => group.play?.type === PLAY_TYPES.plane)
        ) {
          penalty += 2400;
          if (!reasons.some((reason) => reason.includes("送单回收"))) {
            reasons.push(`拆三张${rank}组三带二，不如留大王送单回收`);
          }
        }
      }
    }
  }

  if (
    (openingLead || catchWindLead)
    && (candidate.type === PLAY_TYPES.tripleWithPair || candidate.type === PLAY_TYPES.triple)
  ) {
    const straightBreakLabel = playBreaksStrategicStraight(candidate, hand, levelRank);
    if (straightBreakLabel) {
      penalty += hand.length >= 15 ? 12_000 : 10_000;
      reasons.push(`领出/接风三带二拆${straightBreakLabel}代价过高`);
    }
  }

  // 三带二带对：优先最小孤立对，重罚拆连对/钢板/顺子（对齐 local-qa suggestSafePairRankForTriple）
  if (candidate.type === PLAY_TYPES.tripleWithPair) {
    const kickerRank = inferTripleWithPairKickerRank(candidate);
    const chainBreak = tripleWithPairKickerBreaksStrategicGroup(candidate, hand, levelRank);
    if (chainBreak && (openingLead || catchWindLead)) {
      penalty += hand.length >= 15 ? 11_500 : 9500;
      reasons.push(`三带二带对${kickerRank}会拆${chainBreak}，宜用孤立小对`);
    }
    const safePairs = findSafeKickerPairRanksForTriple(hand, levelRank, candidate.mainRank);
    if (safePairs.length > 0 && kickerRank && (openingLead || catchWindLead) && !chainBreak) {
      const minSafe = safePairs[0];
      if (kickerRank === minSafe) {
        penalty -= hand.length >= 15 ? 1100 : 900;
        reasons.push(`三带二带最小对${minSafe}，不拆其它成组`);
      } else if (safePairs.includes(kickerRank)) {
        penalty += 800;
        reasons.push(`三带二宜带最小对${minSafe}，不必带对${kickerRank}`);
      }
    }
  }

  return { penalty, reasons };
}
