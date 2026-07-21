import { cardId, cardLabel, isJoker, isWildCard } from "../../engine/card.mjs";
import { classifyPlay } from "../../engine/classify-play.mjs";
import { compareRanks, isControlRank, rankOrder } from "../../engine/rank-order.mjs";
import { PLAY_TYPES } from "../../engine/play-types.mjs";
import { buildStrategicGroups } from "../strategic-groups.mjs";
import { enumerateStraightFlushCandidates } from "../straight-flush-arrange.mjs";
import { lastCatchWindWinningPlay } from "../lead-mode.mjs";

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

/** 三带二带对是否会拆掉理牌后的连对/钢板/顺子/同花顺 */
export function tripleWithPairKickerBreaksStrategicGroup(candidate, hand, levelRank, tableContext = null) {
  if (candidate?.type !== PLAY_TYPES.tripleWithPair || !hand?.length) return null;
  const kickerRank = inferTripleWithPairKickerRank(candidate);
  if (!kickerRank) return null;
  const cache = resolveHandStructureCache(hand, levelRank, tableContext);
  const candidateKeys = new Set((candidate.cards ?? []).map((card) => cardId(card)));
  for (const group of cache.strategicGroups) {
    if (group.play?.type === PLAY_TYPES.straightFlush) {
      const sfCards = (group.cards ?? []).filter((card) => card.rank === kickerRank);
      if (sfCards.some((card) => candidateKeys.has(cardId(card)))) {
        return group.label ?? "同花顺";
      }
    }
    if (!CHAIN_GROUP_TYPES.has(group.play?.type)) continue;
    const rankCards = (group.cards ?? []).filter((card) => card.rank === kickerRank);
    if (rankCards.length >= 2) return group.label ?? "成组结构";
  }
  for (const straightFlush of cache.straightFlushes) {
    const wildIds = new Set(straightFlush.wildIds ?? []);
    const sfKickerCards = (straightFlush.cards ?? []).filter((card) => card.rank === kickerRank);
    if (sfKickerCards.some((card) => candidateKeys.has(cardId(card)) && !wildIds.has(cardId(card)))) {
      const suitLabel = RUNWAY_SUIT_LABELS[straightFlush.suit] ?? straightFlush.suit;
      return `同花顺 ${suitLabel}`;
    }
  }
  return null;
}

/** 三带二可附带的整对点数（从小到大；不含三张主点与王） */
export function findAvailableKickerPairRanksForTriple(hand, levelRank, tripleRank) {
  const available = [];
  for (const rank of rankOrder(levelRank)) {
    if (rank === tripleRank || rank === "SJ" || rank === "BJ") continue;
    if (physicalRankCount(hand, rank) >= 2) available.push(rank);
  }
  return available;
}

/** 三带二宜带的最小整对（优先保留级牌对） */
export function minTripleWithPairKickerRank(hand, levelRank, tripleRank) {
  const available = findAvailableKickerPairRanksForTriple(hand, levelRank, tripleRank);
  const nonLevel = available.filter((rank) => rank !== levelRank);
  return nonLevel[0] ?? available[0] ?? null;
}

/** 三带二候选池：优先最小非级牌对附件（应急/兜底共用） */
export function pickBestTripleWithPairLead(pool, hand, levelRank) {
  if (!pool?.length) return null;
  const idealKicker = minTripleWithPairKickerRank(hand, levelRank, pool[0]?.mainRank);
  return pool.reduce((best, item) => {
    if (!best) return item;
    const itemK = inferTripleWithPairKickerRank(item);
    const bestK = inferTripleWithPairKickerRank(best);
    if (itemK === levelRank && bestK !== levelRank) return best;
    if (bestK === levelRank && itemK !== levelRank) return item;
    if (idealKicker && itemK === idealKicker && bestK !== idealKicker) return item;
    if (idealKicker && bestK === idealKicker && itemK !== idealKicker) return best;
    if (itemK && bestK) {
      const cmp = compareRanks(itemK, bestK, levelRank);
      if (cmp < 0) return item;
      if (cmp > 0) return best;
    }
    return (item.power ?? 0) < (best.power ?? 0) ? item : best;
  }, null);
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
export function playBreaksStrategicStraight(candidate, hand, levelRank) {
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

/** 须压时三张是否拆顺子/同花顺/四炸等高价值结构 */
export function breaksStrategicPremiumForTriple(candidate, hand, levelRank, tableContext = null) {
  if (candidate?.type !== PLAY_TYPES.triple || !hand?.length) return null;
  const straightLabel = playBreaksStrategicStraight(candidate, hand, levelRank);
  if (straightLabel) return straightLabel;
  const overlap = candidateOverlapsPremiumStructure(candidate, hand, levelRank, tableContext);
  if (overlap) return overlap;
  const rank = candidate.mainRank;
  const held = physicalRankCount(hand, rank);
  const usedFromRank = (candidate.cards ?? []).filter((card) => card.rank === rank).length;
  if (held >= 4 && usedFromRank >= 3) {
    return `四张${rank}`;
  }
  return null;
}

/** 跟牌三张是否拆顺子/同花顺/四炸 */
export function isStructureBreakingTripleBeat(candidate, hand, levelRank) {
  return breaksStrategicPremiumForTriple(candidate, hand, levelRank) != null;
}

const RUNWAY_CHAIN_RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const RUNWAY_SUIT_LABELS = { S: "黑桃", H: "红桃", C: "梅花", D: "方片" };

function handCacheSignature(hand) {
  if (!hand?.length) return "";
  return hand.map((card) => cardId(card)).sort().join("|");
}

function isLiteStructureContext(tableContext) {
  return tableContext?.lite === true
    || tableContext?.scoringAudience === "human-lite"
    || tableContext?.scoringAudience === "robot";
}

/** 同手牌只枚举一次同花顺；lite 路径有 preferredGroups 时不全量枚举 */
export function resolveHandStructureCache(hand, levelRank, tableContext = null) {
  const sig = handCacheSignature(hand);
  if (!sig) return { sig: "", straightFlushes: [], strategicGroups: [] };
  if (tableContext?._handStructureCache?.sig === sig) {
    return tableContext._handStructureCache;
  }
  const liteWithPreferred = isLiteStructureContext(tableContext)
    && (tableContext?.preferredGroups?.length ?? 0) > 0;
  const straightFlushes = liteWithPreferred
    ? []
    : enumerateStraightFlushCandidates(hand, levelRank);
  let strategicGroups = [];
  if ((tableContext?.preferredGroups?.length ?? 0) > 0) {
    strategicGroups = tableContext.preferredGroups;
  } else if (!isLiteStructureContext(tableContext)) {
    strategicGroups = buildStrategicGroups(hand, levelRank);
  }
  const cache = { sig, straightFlushes, strategicGroups };
  if (tableContext) tableContext._handStructureCache = cache;
  return cache;
}

function straightFlushBreakLabel(straightFlush) {
  const suitLabel = RUNWAY_SUIT_LABELS[straightFlush.suit] ?? straightFlush.suit;
  return `同花顺 ${suitLabel}`;
}

function candidateBreaksCachedStraightFlush(candidate, straightFlushes) {
  if (!candidate?.cards?.length || !straightFlushes?.length) return null;
  const candidateKeys = new Set((candidate.cards ?? []).map((card) => cardId(card)));
  for (const straightFlush of straightFlushes) {
    const groupKeys = (straightFlush.cards ?? []).map((card) => cardId(card));
    const usedKeys = groupKeys.filter((key) => candidateKeys.has(key));
    if (usedKeys.length === 0) continue;
    const playsWholeSf = candidate.type === PLAY_TYPES.straightFlush
      && usedKeys.length === groupKeys.length
      && candidate.cards.length === groupKeys.length;
    if (playsWholeSf) continue;
    if (usedKeys.length < groupKeys.length || candidate.cards.length !== groupKeys.length) {
      return straightFlushBreakLabel(straightFlush);
    }
  }
  return null;
}

function candidateBreaksCachedStraightFlushGroups(candidate, strategicGroups, levelRank) {
  if (!candidate?.cards?.length || !strategicGroups?.length) return null;
  const candidateKeys = new Set((candidate.cards ?? []).map((card) => cardId(card)));
  for (const group of strategicGroups) {
    if (group.play?.type !== PLAY_TYPES.straightFlush) continue;
    const groupCards = group.cards ?? [];
    const groupKeys = groupCards.map((card) => cardId(card));
    if (!candidatePartiallyUsesStructureKeys(candidate, groupKeys)) continue;
    return group.label ?? "同花顺";
  }
  return null;
}

/** 候选是否部分占用某组同花顺/四炸（按具体牌 id 重叠） */
function candidatePartiallyUsesStructureKeys(candidate, groupKeys) {
  if (!candidate?.cards?.length || groupKeys.length === 0) return false;
  const candidateKeys = new Set((candidate.cards ?? []).map((card) => cardId(card)));
  const used = groupKeys.filter((key) => candidateKeys.has(key)).length;
  if (used <= 0) return false;
  if (used < groupKeys.length) return true;
  return candidate.cards.length !== groupKeys.length;
}

/** 同花色 4 张及以上连续自然牌跑道（UI 理牌列常见，如黑桃 7-10） */
function candidateOverlapsSameSuitRunway(candidate, hand, levelRank, minRun = 4) {
  if (!candidate?.cards?.length || !hand?.length) return null;
  const candidateKeys = new Set((candidate.cards ?? []).map((card) => cardId(card)));
  const naturals = hand.filter((card) => !isJoker(card) && !isWildCard(card, levelRank));
  const bySuit = new Map();
  for (const card of naturals) {
    if (!bySuit.has(card.suit)) bySuit.set(card.suit, []);
    bySuit.get(card.suit).push(card);
  }

  for (const [suit, suitedCards] of bySuit.entries()) {
    const rankToCard = new Map();
    for (const card of suitedCards) {
      if (!rankToCard.has(card.rank)) rankToCard.set(card.rank, card);
    }
    for (let start = 0; start + minRun <= RUNWAY_CHAIN_RANKS.length; start += 1) {
      for (let len = minRun; len <= 5; len += 1) {
        if (start + len > RUNWAY_CHAIN_RANKS.length) continue;
        const window = RUNWAY_CHAIN_RANKS.slice(start, start + len);
        const windowCards = [];
        let complete = true;
        for (const rank of window) {
          const card = rankToCard.get(rank);
          if (!card) {
            complete = false;
            break;
          }
          windowCards.push(card);
        }
        if (!complete) continue;
        if (window[0] === "A" && window.length < 5) continue;
        const windowKeys = windowCards.map((card) => cardId(card));
        const used = windowKeys.filter((key) => candidateKeys.has(key)).length;
        if (used <= 0) continue;
        if (used < windowKeys.length || candidate.cards.length !== windowKeys.length) {
          return `顺子 ${RUNWAY_SUIT_LABELS[suit] ?? suit}`;
        }
      }
    }
  }
  return null;
}

/** 同花顺枚举重叠（含逢人配补出的同花顺；动用跑道内任意牌含逢人配均算拆） */
function candidateOverlapsNaturalStraightFlush(candidate, hand, levelRank, straightFlushes = null) {
  if (!candidate?.cards?.length || !hand?.length) return null;
  const flushes = straightFlushes ?? enumerateStraightFlushCandidates(hand, levelRank);
  return candidateBreaksCachedStraightFlush(candidate, flushes);
}

/** 候选是否动用理牌后混色顺子内的具体牌 */
function candidateOverlapsStrategicStraight(candidate, hand, levelRank) {
  if (!candidate?.cards?.length || !hand?.length) return null;
  const candidateKeys = new Set((candidate.cards ?? []).map((card) => cardId(card)));
  for (const group of buildStrategicGroups(hand, levelRank)) {
    if (group.play?.type !== PLAY_TYPES.straight) continue;
    const groupKeys = (group.cards ?? []).map((card) => cardId(card));
    const used = groupKeys.filter((key) => candidateKeys.has(key)).length;
    if (used <= 0) continue;
    if (used < groupKeys.length || candidate.cards.length !== groupKeys.length) {
      return group.label ?? "顺子";
    }
  }
  return null;
}

/** 候选是否动用理牌后同花顺/四炸内的具体牌（不含混色顺子） */
function candidateOverlapsStraightFlushOrBomb(candidate, hand, levelRank) {
  if (!candidate?.cards?.length || !hand?.length) return null;
  const runway = candidateOverlapsSameSuitRunway(candidate, hand, levelRank);
  if (runway) return runway;
  const naturalFlush = candidateOverlapsNaturalStraightFlush(candidate, hand, levelRank);
  if (naturalFlush) return naturalFlush;

  const candidateKeys = new Set((candidate.cards ?? []).map((card) => cardId(card)));
  for (const group of buildStrategicGroups(hand, levelRank)) {
    const playType = group.play?.type;
    if (playType !== PLAY_TYPES.bomb && playType !== PLAY_TYPES.straightFlush) continue;
    const groupKeys = (group.cards ?? []).map((card) => cardId(card));
    if (!candidatePartiallyUsesStructureKeys(candidate, groupKeys)) continue;
    if (playType === PLAY_TYPES.straightFlush) {
      return group.label ?? "同花顺";
    }
    return group.label ?? `四张${group.play?.mainRank ?? candidate.mainRank}`;
  }
  return null;
}

/** 候选是否动用理牌后顺子/同花顺/四炸内的具体牌 */
function candidateOverlapsPremiumStructure(candidate, hand, levelRank, tableContext = null) {
  if (!candidate?.cards?.length || !hand?.length) return null;
  const cache = resolveHandStructureCache(hand, levelRank, tableContext);
  const candidateKeys = new Set((candidate.cards ?? []).map((card) => cardId(card)));
  for (const group of cache.strategicGroups) {
    const playType = group.play?.type;
    if (playType !== PLAY_TYPES.straight
      && playType !== PLAY_TYPES.straightFlush
      && playType !== PLAY_TYPES.bomb) {
      continue;
    }
    const groupKeys = (group.cards ?? []).map((card) => cardId(card));
    const used = groupKeys.filter((key) => candidateKeys.has(key)).length;
    if (used <= 0) continue;
    if (playType === PLAY_TYPES.bomb) {
      return group.label ?? `四张${group.play?.mainRank ?? candidate.mainRank}`;
    }
    return group.label ?? (playType === PLAY_TYPES.straightFlush ? "同花顺" : "顺子");
  }
  // 仅有 lite 无分组时才用同花顺枚举兜底；全量理牌分组已表达结构意图，勿重复枚举误伤
  if (cache.strategicGroups.length > 0) return null;
  return candidateBreaksCachedStraightFlush(candidate, cache.straightFlushes);
}

/** 须压时对子是否拆顺子/同花顺/四炸等高价值结构（按具体牌重叠判定） */
export function breaksStrategicPremiumForPair(candidate, hand, levelRank, tableContext = null) {
  if (candidate?.type !== PLAY_TYPES.pair || !hand?.length) return null;
  const overlap = candidateOverlapsPremiumStructure(candidate, hand, levelRank, tableContext);
  if (overlap) return overlap;
  const rank = candidate.mainRank;
  const held = physicalRankCount(hand, rank);
  if (held >= 3) {
    const groups = resolveHandStructureCache(hand, levelRank, tableContext).strategicGroups;
    const tripleGroup = groups.find(
      (group) => (group.play?.type === PLAY_TYPES.triple || group.label?.startsWith("三张"))
        && group.play?.mainRank === rank,
    );
    const plateGroup = groups.find(
      (group) => (group.play?.type === PLAY_TYPES.plane || group.label?.startsWith("钢板"))
        && (group.cards ?? []).some((card) => card.rank === rank),
    );
    if (tripleGroup || plateGroup) {
      return plateGroup?.label ?? tripleGroup?.label ?? `三张${rank}`;
    }
  }
  return null;
}

/** 跟牌对子是否拆顺子/同花顺/四炸/钢板三张 */
export function isStructureBreakingPairBeat(candidate, hand, levelRank) {
  return breaksStrategicPremiumForPair(candidate, hand, levelRank) != null;
}

function cardKeyForPremium(card) {
  return `${card.rank}:${card.suit}:${card.deckIndex}`;
}

/** UI 理牌列同花顺/王炸：候选部分占用即视为拆结构 */
function breaksPreferredStraightFlushPartialUse(candidate, preferredGroups, levelRank) {
  if (!candidate || !preferredGroups?.length) return false;
  const keys = new Set((candidate.cards ?? []).map(cardKeyForPremium));
  for (const group of preferredGroups) {
    const cards = group.cards ?? group;
    const play = group.play ?? classifyPlay(cards, levelRank);
    if (![PLAY_TYPES.straightFlush, PLAY_TYPES.jokerBomb].includes(play.type)) continue;
    const groupKeys = cards.map(cardKeyForPremium);
    const used = groupKeys.filter((key) => keys.has(key)).length;
    if (used > 0 && used < groupKeys.length) return true;
    if (used === groupKeys.length && candidate.cards.length !== groupKeys.length) return true;
  }
  return false;
}

/** 须压三带二是否拆顺子/同花顺/四炸等高价值结构（按具体牌重叠；带对拆连对另判） */
export function breaksStrategicPremiumForTripleWithPair(candidate, hand, levelRank, preferredGroups = null, tableContext = null) {
  if (candidate?.type !== PLAY_TYPES.tripleWithPair || !hand?.length) return null;
  const cache = resolveHandStructureCache(hand, levelRank, {
    ...tableContext,
    preferredGroups: preferredGroups ?? tableContext?.preferredGroups,
  });
  if (cache.strategicGroups.length) {
    const partialSf = breaksPreferredStraightFlushPartialUse(candidate, cache.strategicGroups, levelRank);
    if (partialSf) {
      for (const group of cache.strategicGroups) {
        const cards = group.cards ?? group;
        const play = group.play ?? classifyPlay(cards, levelRank);
        if (play?.type !== PLAY_TYPES.straightFlush) continue;
        const groupKeys = cards.map(cardKeyForPremium);
        const keys = new Set((candidate.cards ?? []).map(cardKeyForPremium));
        const used = groupKeys.filter((key) => keys.has(key)).length;
        if (used > 0 && used < groupKeys.length) {
          return group.label ?? "同花顺";
        }
      }
      return candidateOverlapsSameSuitRunway(candidate, hand, levelRank) ?? "同花顺";
    }
  }
  const runwayBreak = candidateOverlapsSameSuitRunway(candidate, hand, levelRank);
  if (runwayBreak) return runwayBreak;
  const naturalFlush = candidateOverlapsNaturalStraightFlush(candidate, hand, levelRank, cache.straightFlushes);
  if (naturalFlush) return naturalFlush;
  const straightBreak = playBreaksStrategicStraight(candidate, hand, levelRank);
  if (straightBreak) return straightBreak;
  const kickerBreak = tripleWithPairKickerBreaksStrategicGroup(candidate, hand, levelRank, tableContext);
  if (kickerBreak) return kickerBreak;
  return null;
}

/** 须压钢板是否拆顺子/同花顺/四炸等高价值结构 */
export function breaksStrategicPremiumForPlane(candidate, hand, levelRank) {
  if (candidate?.type !== PLAY_TYPES.plane || !hand?.length) return null;
  return candidateOverlapsStraightFlushOrBomb(candidate, hand, levelRank)
    ?? candidateOverlapsStrategicStraight(candidate, hand, levelRank);
}

/** 领出/接风/须压连对是否拆同花顺/四炸/顺子跑道等高价值结构 */
export function breaksStrategicPremiumForConsecutivePairs(candidate, hand, levelRank, tableContext = null) {
  if (candidate?.type !== PLAY_TYPES.consecutivePairs || !hand?.length) return null;
  const runway = candidateOverlapsSameSuitRunway(candidate, hand, levelRank);
  if (runway) return runway;

  const cache = resolveHandStructureCache(hand, levelRank, tableContext);
  const sfBreak = candidateBreaksCachedStraightFlush(candidate, cache.straightFlushes);
  if (sfBreak) return sfBreak;

  const groupBreak = candidateBreaksCachedStraightFlushGroups(candidate, cache.strategicGroups, levelRank);
  if (groupBreak) return groupBreak;

  return candidateOverlapsStrategicStraight(candidate, hand, levelRank);
}

/** 领出/接风杂顺是否拆同花顺/四炸/同花色跑道等高价值结构 */
export function breaksStrategicPremiumForStraight(candidate, hand, levelRank, tableContext = null) {
  if (candidate?.type !== PLAY_TYPES.straight || !hand?.length) return null;
  const runway = candidateOverlapsSameSuitRunway(candidate, hand, levelRank);
  if (runway) return runway;

  const cache = resolveHandStructureCache(hand, levelRank, tableContext);

  const skipWildRunwayGuard = (() => {
    const state = tableContext?.state;
    if (!state) return false;
    const playerIndex = tableContext.playerIndex ?? state.currentPlayerIndex ?? 0;
    const lastWin = lastCatchWindWinningPlay(state, playerIndex);
    return lastWin?.type === PLAY_TYPES.straightFlush;
  })();

  // 杂顺动用逢人配，而手牌仍有需逢人配补口的同花顺跑道（≥4 张自然牌）→ 视同拆同花顺
  if (!skipWildRunwayGuard) {
    const wildUsedInStraight = (candidate.cards ?? []).filter((card) => isWildCard(card, levelRank));
    if (wildUsedInStraight.length > 0) {
      const wildUsedIds = new Set(wildUsedInStraight.map((card) => cardId(card)));
      for (const straightFlush of cache.straightFlushes) {
        if ((straightFlush.wildCount ?? 0) <= 0) continue;
        const wildIds = new Set(straightFlush.wildIds ?? []);
        if (![...wildUsedIds].some((id) => wildIds.has(id))) continue;
        const naturalsInSf = (straightFlush.cards ?? []).filter((card) => !wildIds.has(cardId(card))).length;
        if (naturalsInSf >= 4) {
          return straightFlushBreakLabel(straightFlush);
        }
      }
    }
  }

  const sfBreak = candidateBreaksCachedStraightFlush(candidate, cache.straightFlushes);
  if (sfBreak) return sfBreak;

  const groupBreak = candidateBreaksCachedStraightFlushGroups(candidate, cache.strategicGroups, levelRank);
  if (groupBreak) return groupBreak;

  return null;
}

/** UI 理牌列：候选部分占用保护组（顺子/同花顺/炸弹等） */
function breaksPreferredStrategicPartialUse(candidate, preferredGroups, levelRank) {
  if (!candidate || !preferredGroups?.length) return null;
  const keys = new Set((candidate.cards ?? []).map(cardKeyForPremium));
  const PROTECTED = new Set([
    PLAY_TYPES.straightFlush,
    PLAY_TYPES.jokerBomb,
    PLAY_TYPES.bomb,
    PLAY_TYPES.consecutivePairs,
    PLAY_TYPES.plane,
    PLAY_TYPES.straight,
    PLAY_TYPES.triple,
  ]);
  for (const group of preferredGroups) {
    const cards = group.cards ?? group;
    const play = group.play ?? classifyPlay(cards, levelRank);
    const groupKeys = cards.map(cardKeyForPremium);
    const used = groupKeys.filter((key) => keys.has(key)).length;
    if (used === 0) continue;
    if (PROTECTED.has(play.type)) {
      if (used < groupKeys.length) return group.label ?? play.type;
      if (candidate.cards.length !== groupKeys.length) return group.label ?? play.type;
      continue;
    }
    if (
      play.type === PLAY_TYPES.pair
      && candidate.type === PLAY_TYPES.single
      && candidate.mainRank === play.mainRank
      && used > 0
      && used < groupKeys.length
    ) {
      return group.label ?? "对子";
    }
  }
  return null;
}

/** 须压单张是否拆顺子/同花顺/跑道 */
export function breaksStrategicPremiumForSingle(candidate, hand, levelRank, preferredGroups = null, tableContext = null) {
  if (candidate?.type !== PLAY_TYPES.single || !hand?.length) return null;
  const prefBreak = breaksPreferredStrategicPartialUse(candidate, preferredGroups, levelRank);
  if (prefBreak) return prefBreak;
  const cache = resolveHandStructureCache(hand, levelRank, {
    ...tableContext,
    preferredGroups: preferredGroups ?? tableContext?.preferredGroups,
  });
  const groups = preferredGroups?.length ? preferredGroups : cache.strategicGroups;
  if (breaksPreferredStraightFlushPartialUse(candidate, groups, levelRank)) {
    for (const group of groups) {
      const cards = group.cards ?? group;
      const play = group.play ?? classifyPlay(cards, levelRank);
      if (play?.type !== PLAY_TYPES.straightFlush) continue;
      const groupKeys = cards.map(cardKeyForPremium);
      const keys = new Set((candidate.cards ?? []).map(cardKeyForPremium));
      const used = groupKeys.filter((key) => keys.has(key)).length;
      if (used > 0) return group.label ?? "同花顺";
    }
    return "同花顺";
  }
  const sfBreak = candidateBreaksCachedStraightFlush(candidate, cache.straightFlushes);
  if (sfBreak) return sfBreak;
  const groupBreak = candidateBreaksCachedStraightFlushGroups(candidate, cache.strategicGroups, levelRank);
  if (groupBreak) return groupBreak;
  const runwayBreak = candidateOverlapsSameSuitRunway(candidate, hand, levelRank);
  if (runwayBreak) return runwayBreak;
  const straightBreak = playBreaksStrategicStraight(candidate, hand, levelRank);
  if (straightBreak) return straightBreak;
  return null;
}

/** 须压同型常规牌（对子/三张/三带二/钢板/单张）是否拆高价值结构 */
export function breaksStrategicPremiumForRoutineBeat(candidate, hand, levelRank, preferredGroups = null) {
  if (candidate?.type === PLAY_TYPES.single) {
    return breaksStrategicPremiumForSingle(candidate, hand, levelRank, preferredGroups);
  }
  if (candidate?.type === PLAY_TYPES.tripleWithPair) {
    return breaksStrategicPremiumForTripleWithPair(candidate, hand, levelRank, preferredGroups);
  }
  if (candidate?.type === PLAY_TYPES.plane) {
    return breaksStrategicPremiumForPlane(candidate, hand, levelRank);
  }
  if (candidate?.type === PLAY_TYPES.triple) {
    return breaksStrategicPremiumForTriple(candidate, hand, levelRank);
  }
  if (candidate?.type === PLAY_TYPES.pair) {
    return breaksStrategicPremiumForPair(candidate, hand, levelRank);
  }
  return null;
}

/** 跟牌同型常规牌是否拆顺子/同花顺/四炸 */
export function isStructureBreakingRoutineBeat(candidate, hand, levelRank, preferredGroups = null) {
  return breaksStrategicPremiumForRoutineBeat(candidate, hand, levelRank, preferredGroups) != null;
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
      if (
        (openingLead || catchWindLead)
        && candidate.type === PLAY_TYPES.single
        && usedCount === 1
        && physicalHeld >= 5
      ) {
        penalty += physicalHeld >= 6 ? 14_000 : 12_000;
        reasons.push(`领出/接风拆${physicalHeld}张${rank}炸弹出单，宜散单或成组减手`);
        continue;
      }
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
      && usedCount === 3
      && candidate.type === PLAY_TYPES.triple
      && lockedInPlate
      && (openingLead || catchWindLead)
    ) {
      penalty += hand.length >= 15 ? 14_000 : 12_000;
      reasons.push(`领出/接风不宜拆钢板三张${rank}，应一次走钢板减六张`);
    } else if (
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
      && usedCount === 1
      && candidate.type === PLAY_TYPES.single
      && (openingLead || catchWindLead)
    ) {
      penalty += hand.length >= 15 ? 12_000 : 9800;
      reasons.push(`拆三张${rank}出单张，宜三带二或对子减手`);
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

  const previousPlay = tableContext.previousPlay ?? null;
  if (
    opponentMustBeat
    && hand.length > 10
    && tableContext.danger < 2
    && candidate.type === previousPlay?.type
    && (
      previousPlay?.type === PLAY_TYPES.triple
      || previousPlay?.type === PLAY_TYPES.pair
      || previousPlay?.type === PLAY_TYPES.tripleWithPair
      || previousPlay?.type === PLAY_TYPES.plane
    )
  ) {
    const premiumBreak = breaksStrategicPremiumForRoutineBeat(candidate, hand, levelRank);
    if (premiumBreak) {
      const shapeLabel = candidate.type === PLAY_TYPES.pair
        ? "对"
        : candidate.type === PLAY_TYPES.tripleWithPair
          ? "三带二"
          : candidate.type === PLAY_TYPES.plane
            ? "钢板"
            : "三张";
      penalty += hand.length >= 15 ? 16_000 : 14_000;
      reasons.push(`不宜拆${premiumBreak}组${shapeLabel}压牌，宜过牌或换结构外牌`);
    }
  }

  // 三带二带对：优先最小整对（保留级牌对），孤立对优先于拆连对/钢板/顺子
  if (candidate.type === PLAY_TYPES.tripleWithPair) {
    const kickerRank = inferTripleWithPairKickerRank(candidate);
    const chainBreak = tripleWithPairKickerBreaksStrategicGroup(candidate, hand, levelRank);
    const previousPlay = tableContext.previousPlay ?? null;
    const mustBeatTripleWithPair = tableContext.leadMode === "must-beat"
      && previousPlay?.type === PLAY_TYPES.tripleWithPair;
    const twpKickerContext = openingLead || catchWindLead || mustBeatTripleWithPair;
    if (chainBreak && (openingLead || catchWindLead)) {
      penalty += hand.length >= 15 ? 11_500 : 9500;
      reasons.push(`三带二带对${kickerRank}会拆${chainBreak}，宜用孤立小对`);
    }
    const minKicker = minTripleWithPairKickerRank(hand, levelRank, candidate.mainRank);
    if (minKicker && kickerRank && twpKickerContext) {
      if (kickerRank === levelRank && minKicker !== levelRank) {
        penalty += hand.length >= 15 ? 12_000 : 10_000;
        reasons.push(`三带二不宜带级牌对${levelRank}，宜带最小对${minKicker}`);
      } else if (compareRanks(kickerRank, minKicker, levelRank) > 0) {
        penalty += chainBreak
          ? (hand.length >= 15 ? 4000 : 3200)
          : (hand.length >= 15 ? 5500 : 4500);
        reasons.push(`三带二宜带最小对${minKicker}，不必带对${kickerRank}`);
      } else if (kickerRank === minKicker && !chainBreak) {
        penalty -= hand.length >= 15 ? 1100 : 900;
        reasons.push(`三带二带最小对${minKicker}，不拆其它成组`);
      }
    }
    const safePairs = findSafeKickerPairRanksForTriple(hand, levelRank, candidate.mainRank);
    if (
      safePairs.length > 0
      && kickerRank
      && (openingLead || catchWindLead)
      && !chainBreak
      && kickerRank !== minKicker
    ) {
      const minSafe = safePairs[0];
      if (kickerRank === minSafe) {
        penalty -= hand.length >= 15 ? 800 : 600;
        reasons.push(`三带二带孤立小对${minSafe}，不拆其它成组`);
      }
    }
  }

  return { penalty, reasons };
}
