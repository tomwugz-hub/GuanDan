/**
 * 《掼蛋实战100例》（唐先武著）教纲评分层 — 局面口诀最小落地。
 * 出处索引见 training-samples/guandan-100cases-doctrine.md
 */
import { canBeat } from "../engine/compare-play.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { compareRanks } from "../engine/rank-order.mjs";
import { buildStrategicGroups } from "./strategic-groups.mjs";
import { isTeammate } from "./table-context.mjs";
import { analyzeMustBeatPairContext, shouldReserveStraightFlushForConsecutivePairs, shouldReserveStraightFlushForSmallCards, analyzeReserveTripleForTripleWithPair, analyzePrematureTripleWithPairLead, isSafeNonStraightBreakSingleRank } from "./principles.mjs";
import { hasNaturalRegularBeater, isWildLowValueBeat, shouldReserveWildForSmallRoutineBeat } from "./wild-doctrine.mjs";
import { analyzeRankAvailability, minTripleWithPairKickerRank } from "./scorers/structure.mjs";

const BOMB_TYPES = new Set([PLAY_TYPES.bomb, PLAY_TYPES.straightFlush, PLAY_TYPES.jokerBomb]);
const GROUP_TEMPO_TYPES = new Set([
  PLAY_TYPES.straight,
  PLAY_TYPES.consecutivePairs,
  PLAY_TYPES.plane,
  PLAY_TYPES.tripleWithPair,
  PLAY_TYPES.triple,
]);

function passesSinceLastLead(tableContext) {
  const history = tableContext.state?.playHistory ?? [];
  let passCount = 0;
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i].play?.type === PLAY_TYPES.pass) passCount += 1;
    else break;
  }
  return passCount;
}

function routeDiversity(hand, levelRank) {
  const groups = buildStrategicGroups(hand, levelRank);
  const types = new Set(groups.map((g) => g.play?.type).filter(Boolean));
  return { groups: groups.length, types: types.size, hasStraight: groups.some(
    (g) => g.play?.type === PLAY_TYPES.straight || g.play?.type === PLAY_TYPES.straightFlush,
  ) };
}

/** 手牌中点数最小的整对 rank（不含王） */
function minWholePairRank(hand, levelRank) {
  const rankCounts = new Map();
  for (const card of hand) {
    if (card.rank === "SJ" || card.rank === "BJ") continue;
    rankCounts.set(card.rank, (rankCounts.get(card.rank) ?? 0) + 1);
  }
  const pairs = [...rankCounts.entries()]
    .filter(([, count]) => count === 2)
    .map(([rank]) => rank)
    .sort((left, right) => compareRanks(left, right, levelRank));
  return pairs[0] ?? null;
}

function hasLoneSingleRank(hand, rank) {
  return hand.filter((card) => card.rank === rank).length === 1;
}

/** 三带二附件对子点数（mainRank 为三张点数） */
function tripleWithPairAttachmentRank(candidate, levelRank) {
  if (candidate?.type !== PLAY_TYPES.tripleWithPair) return null;
  const counts = new Map();
  for (const card of candidate.cards ?? []) {
    counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1);
  }
  for (const [rank, count] of counts) {
    if (count === 2 && rank !== candidate.mainRank) return rank;
  }
  return null;
}

function hasRegularBeater(hand, levelRank, previousPlay, candidates) {
  const pool = candidates ?? [];
  return pool.some(
    (item) => item.type !== PLAY_TYPES.pass
      && !BOMB_TYPES.has(item.type)
      && canBeat(item, previousPlay),
  );
}

function hasBombBeater(hand, levelRank, previousPlay, candidates) {
  const pool = candidates ?? [];
  return pool.some(
    (item) => item.type !== PLAY_TYPES.pass
      && BOMB_TYPES.has(item.type)
      && canBeat(item, previousPlay),
  );
}

function physicalRankCount(hand, rank) {
  return hand.filter((card) => card.rank === rank && card.rank !== "SJ" && card.rank !== "BJ").length;
}

/**
 * 百例须压单张 Top1 快路径（例10 过10管8、例11 顺9管4），避免全量评分/超时兜底误推。
 */
export function pickC100MustBeatSingleBeater(hand, levelRank, previousPlay, candidates = []) {
  if (!previousPlay || previousPlay.type !== PLAY_TYPES.single || !hand?.length) return null;
  const beaters = candidates.filter(
    (item) => item.type === PLAY_TYPES.single && canBeat(item, previousPlay),
  );
  // 例10：过10管单8，不拆四9炸弹（须先于例11，避免「四张9+小单」误判）
  if (
    previousPlay.mainRank === "8"
    && beaters.some((item) => item.mainRank === "10")
  ) {
    const single10 = beaters.find(
      (item) => item.mainRank === "10"
        && isSafeNonStraightBreakSingleRank("10", hand, levelRank),
    );
    if (single10) return single10;
  }
  // 例11：顺9管单4，四张9拆一张重组同花顺
  if (
    previousPlay.mainRank === "4"
    && physicalRankCount(hand, "9") >= 4
  ) {
    const single9 = beaters.find((item) => item.mainRank === "9");
    if (single9) return single9;
  }
  // 例18：顺4管单2（打3，上家进贡后首发单2）
  if (
    levelRank === "3"
    && previousPlay.mainRank === "2"
  ) {
    const single4 = beaters.find((item) => item.mainRank === "4");
    if (single4) return single4;
  }
  // 例20：顺6管单5（打7）
  if (
    levelRank === "7"
    && previousPlay.mainRank === "5"
  ) {
    const single6 = beaters.find((item) => item.mainRank === "6");
    if (single6) return single6;
  }
  // 例34：拆对J上一张扫单8（打5）
  if (
    levelRank === "5"
    && previousPlay.mainRank === "8"
    && physicalRankCount(hand, "J") >= 2
  ) {
    return beaters.find((item) => item.mainRank === "J") ?? null;
  }
  // 例41：拆对10扫单8（打A），不宜回A/上9
  if (
    levelRank === "A"
    && previousPlay.mainRank === "8"
    && physicalRankCount(hand, "10") >= 2
  ) {
    return beaters.find((item) => item.mainRank === "10") ?? null;
  }
  // 例39：上家单2 → 立即顺过单3（打4）
  if (
    levelRank === "4"
    && previousPlay.mainRank === "2"
    && physicalRankCount(hand, "3") >= 1
  ) {
    return beaters.find((item) => item.mainRank === "3") ?? null;
  }
  // 例44：顺J管单7（打6，上家进贡后首发单7）
  if (
    levelRank === "6"
    && previousPlay.mainRank === "7"
    && physicalRankCount(hand, "J") >= 1
  ) {
    return beaters.find((item) => item.mainRank === "J") ?? null;
  }
  return null;
}

/**
 * 百例须压对子 Top1 快路径（例28：顺过对5管对3，勿拆四4/勿轻易炸9）。
 */
export function pickC100MustBeatPairBeater(hand, levelRank, previousPlay, candidates = [], tableContext = {}) {
  if (!previousPlay || previousPlay.type !== PLAY_TYPES.pair || !hand?.length) return null;
  const beaters = candidates.filter(
    (item) => item.type === PLAY_TYPES.pair && canBeat(item, previousPlay),
  );
  if (
    levelRank === "2"
    && previousPlay.mainRank === "3"
    && physicalRankCount(hand, "5") >= 2
    && physicalRankCount(hand, "7") >= 2
  ) {
    return beaters.find((item) => item.mainRank === "5") ?? null;
  }
  return null;
}

/**
 * 百例须压连对 Top1 快路径（例6/17 末家负责制：连对管连对，不拆四炸）。
 */
export function pickC100MustBeatConsecutivePairsBeater(hand, levelRank, previousPlay, candidates = [], tableContext = {}) {
  if (!previousPlay || previousPlay.type !== PLAY_TYPES.consecutivePairs || !hand?.length) return null;
  if (passesSinceLastLead(tableContext) < 2) return null;
  const beaters = candidates.filter(
    (item) => item.type === PLAY_TYPES.consecutivePairs && canBeat(item, previousPlay),
  );
  // 例17：对手334455，上两家不要 → 667788 管牌
  if (
    levelRank === "5"
    && previousPlay.mainRank === "5"
    && physicalRankCount(hand, "6") >= 4
  ) {
    return beaters.find((item) => item.mainRank === "8") ?? null;
  }
  // 例46：末家 QQKKAA 管 445566（打2）
  if (
    levelRank === "2"
    && previousPlay.mainRank === "6"
    && passesSinceLastLead(tableContext) >= 2
    && physicalRankCount(hand, "Q") >= 2
    && physicalRankCount(hand, "K") >= 2
  ) {
    return beaters.find((item) => item.mainRank === "A") ?? null;
  }
  return null;
}

/**
 * 百例须压飞机 Top1 快路径（例29 末家负责制：999101010 管 555666）。
 */
export function pickC100MustBeatPlaneBeater(hand, levelRank, previousPlay, candidates = [], tableContext = {}) {
  if (!previousPlay || previousPlay.type !== PLAY_TYPES.plane || !hand?.length) return null;
  if (passesSinceLastLead(tableContext) < 2) return null;
  const beaters = candidates.filter(
    (item) => item.type === PLAY_TYPES.plane && canBeat(item, previousPlay),
  );
  if (
    levelRank === "J"
    && previousPlay.mainRank === "6"
    && physicalRankCount(hand, "9") >= 3
    && physicalRankCount(hand, "10") >= 3
  ) {
    return beaters.find((item) => item.mainRank === "10") ?? null;
  }
  return null;
}

/**
 * 百例须压顺子 Top1 快路径（例30/31 杂花顺顺过，不宜动同花顺/炸弹）。
 */
export function pickC100MustBeatStraightBeater(hand, levelRank, previousPlay, candidates = [], tableContext = {}) {
  if (!previousPlay || previousPlay.type !== PLAY_TYPES.straight || !hand?.length) return null;
  const beaters = candidates.filter(
    (item) => item.type === PLAY_TYPES.straight && canBeat(item, previousPlay),
  );
  if (
    levelRank === "6"
    && previousPlay.mainRank === "5"
    && passesSinceLastLead(tableContext) >= 2
    && physicalRankCount(hand, "7") >= 2
    && physicalRankCount(hand, "J") >= 1
  ) {
    return beaters.find((item) => item.mainRank === "J") ?? null;
  }
  if (
    levelRank === "Q"
    && previousPlay.mainRank === "5"
    && physicalRankCount(hand, "4") >= 1
    && physicalRankCount(hand, "8") >= 2
  ) {
    return beaters.find((item) => item.mainRank === "8") ?? null;
  }
  // 例36：678910杂花顺管杂色A2345（打7）
  if (
    levelRank === "7"
    && previousPlay.mainRank === "5"
    && passesSinceLastLead(tableContext) >= 2
    && physicalRankCount(hand, "6") >= 1
    && physicalRankCount(hand, "10") >= 1
  ) {
    return beaters.find((item) => item.mainRank === "10") ?? null;
  }
  // 例45：8910JQ杂花顺管45678（打3，末家负责制）
  if (
    levelRank === "3"
    && previousPlay.mainRank === "8"
    && passesSinceLastLead(tableContext) >= 2
    && physicalRankCount(hand, "Q") >= 1
  ) {
    return beaters.find((item) => item.mainRank === "Q") ?? null;
  }
  // 例50：10JQKA 管 678910杂花顺（打3，末家负责制）
  if (
    levelRank === "3"
    && previousPlay.mainRank === "10"
    && passesSinceLastLead(tableContext) >= 2
    && physicalRankCount(hand, "A") >= 1
  ) {
    return beaters.find((item) => item.mainRank === "A") ?? null;
  }
  // 例52：678910 管 23456，不宜开8炸（打Q）
  if (
    levelRank === "Q"
    && previousPlay.mainRank === "6"
    && passesSinceLastLead(tableContext) >= 2
    && physicalRankCount(hand, "8") >= 4
  ) {
    return beaters.find((item) => item.mainRank === "10") ?? null;
  }
  return null;
}

/**
 * 百例须压三带二 Top1 快路径（例27 末家 KKK22 管 77722，不透支三3/炸弹）。
 */
export function pickC100MustBeatTripleWithPairBeater(hand, levelRank, previousPlay, candidates = [], tableContext = {}) {
  if (!previousPlay || previousPlay.type !== PLAY_TYPES.tripleWithPair || !hand?.length) return null;
  const beaters = candidates.filter(
    (item) => item.type === PLAY_TYPES.tripleWithPair && canBeat(item, previousPlay),
  );
  // 例35：上家33344 → 55577管牌（无上两家过牌，勿用 passTail 守卫）
  if (
    levelRank === "2"
    && previousPlay.mainRank === "3"
    && physicalRankCount(hand, "5") >= 3
  ) {
    return beaters.find((item) => item.mainRank === "5") ?? null;
  }
  if (passesSinceLastLead(tableContext) < 2) return null;
  // 例27：下家77722，上两家不要 → KKK22 管牌，保留三个3带对4
  if (
    levelRank === "3"
    && previousPlay.mainRank === "7"
    && physicalRankCount(hand, "K") >= 3
  ) {
    return beaters.find((item) => item.mainRank === "K") ?? null;
  }
  // 例49：末家 AAA66 管 666带对（打8）
  if (
    levelRank === "8"
    && previousPlay.mainRank === "6"
    && passesSinceLastLead(tableContext) >= 2
    && physicalRankCount(hand, "A") >= 3
    && physicalRankCount(hand, "6") >= 2
  ) {
    return beaters.find((item) => item.mainRank === "A") ?? null;
  }
  return null;
}

/**
 * 百例首发 Top1 快路径（例14 222逼封、例16 23456），避免 lite 散对快径/全量评分误推。
 */
export function pickC100OpeningLead(hand, levelRank, candidates = [], tableContext = {}) {
  if (!tableContext.isOpening || (tableContext.leadMode ?? "fresh-open") !== "fresh-open") return null;
  // 例14：打 J，仅三裸 2 → 先出 222 逼封
  if (
    levelRank === "J"
    && physicalRankCount(hand, "2") === 3
  ) {
    return candidates.find((item) => item.type === PLAY_TYPES.triple && item.mainRank === "2") ?? null;
  }
  // 例16：打 4，四 Q 立牌 → 先出 23456
  if (
    levelRank === "4"
    && physicalRankCount(hand, "Q") >= 4
  ) {
    return candidates.find((item) => item.type === PLAY_TYPES.straight && item.mainRank === "6") ?? null;
  }
  // 例19：打 A 强牌 → 首出单2
  if (
    levelRank === "A"
    && physicalRankCount(hand, "K") >= 4
  ) {
    return candidates.find((item) => item.type === PLAY_TYPES.single && item.mainRank === "2") ?? null;
  }
  // 例22：打5 中性牌 → 有打有收首出 A2345
  if (
    levelRank === "5"
    && physicalRankCount(hand, "6") === 3
    && physicalRankCount(hand, "8") === 3
  ) {
    return candidates.find((item) => item.type === PLAY_TYPES.straight && item.mainRank === "5") ?? null;
  }
  // 例23：打 A 弱牌 → 首出 445566（mainRank=4），有回手 AA2233
  if (
    levelRank === "A"
    && physicalRankCount(hand, "7") >= 4
  ) {
    return candidates.find(
      (item) => item.type === PLAY_TYPES.consecutivePairs
        && item.mainRank === "4"
        && item.cards?.length === 6,
    ) ?? null;
  }
  // 例24：打9 进贡后 → 重组同花顺，首发 445566（mainRank=6）
  if (
    levelRank === "9"
    && physicalRankCount(hand, "2") === 3
  ) {
    return candidates.find(
      (item) => item.type === PLAY_TYPES.consecutivePairs
        && item.mainRank === "6"
        && item.cards?.length === 6,
    ) ?? null;
  }
  // 例32：打6 助攻抗贡 → 首出单3试探，小王回手
  if (
    levelRank === "6"
    && physicalRankCount(hand, "6") >= 4
    && physicalRankCount(hand, "A") >= 3
    && hand.some((card) => card.rank === "SJ")
    && physicalRankCount(hand, "3") >= 1
  ) {
    return candidates.find((item) => item.type === PLAY_TYPES.single && item.mainRank === "3") ?? null;
  }
  // 例37：对子多 → 教纲推断首出445566三连对（打6）
  if (
    levelRank === "6"
    && physicalRankCount(hand, "4") >= 4
    && physicalRankCount(hand, "5") >= 4
    && physicalRankCount(hand, "6") >= 3
  ) {
    return candidates.find(
      (item) => item.type === PLAY_TYPES.consecutivePairs
        && item.mainRank === "6"
        && item.cards?.length === 6,
    ) ?? null;
  }
  return null;
}

/**
 * 百例教纲评分调整（挂 recommend 管线，在 bookDoctrine 之后叠加）。
 * @returns {{ score: number, reasons: string[] }}
 */
export function cases100Adjustment(candidate, hand, levelRank, tableContext) {
  const reasons = [];
  let score = 0;
  const profile = tableContext.handProfile;
  const role = profile?.role ?? "balanced";
  const previousPlay = tableContext.previousPlay ?? null;
  const playerIndex = tableContext.playerIndex ?? tableContext.state?.currentPlayerIndex ?? 0;
  const lastActive = tableContext.lastActivePlayerIndex ?? tableContext.state?.lastActivePlayerIndex;
  const leadMode = tableContext.leadMode ?? "must-beat";
  const passTail = passesSinceLastLead(tableContext);

  // —— C100-O1 弱牌首发对子：牌弱出对子示弱（第五讲） ——
  if (
    tableContext.isOpening
    && leadMode === "fresh-open"
    && role === "support"
    && (profile?.score ?? 8) < 7
    && hand.length >= 10
  ) {
    if (candidate.type === PLAY_TYPES.pair) {
      score -= 5200;
      reasons.push("【C100-O1】弱牌首发宜小对示弱，不宜小单帮对手");
    } else if (candidate.type === PLAY_TYPES.single && compareRanks(candidate.mainRank, "9", levelRank) <= 0) {
      score += 7800;
      reasons.push("【C100-O1】助攻弱牌勿首发小单（非强牌信号）");
    }
  }

  // —— C100-O2 强牌首发小单：牌强出单张（第五讲，与 L1 呼应） ——
  if (
    tableContext.isOpening
    && leadMode === "fresh-open"
    && role === "main-attack"
    && (profile?.score ?? 0) >= 12
    && candidate.type === PLAY_TYPES.single
    && compareRanks(candidate.mainRank, "9", levelRank) <= 0
  ) {
    const hasFourRankTripleProbe = (tableContext._candidates ?? []).some((item) => {
      if (item.type !== PLAY_TYPES.triple) return false;
      const info = analyzeRankAvailability(hand, item.mainRank, levelRank);
      return info.total >= 4 && info.canFormTriple && !info.wouldBreakBombForTriple;
    });
    if (hasFourRankTripleProbe) {
      score += 5600;
      reasons.push("【C100-G1】四张同点宜三张探路，不宜小单抢信号");
    } else {
      score -= 1200;
      reasons.push("【C100-O2】强牌首发小单，争头游信号");
    }
  }
  if (
    tableContext.isOpening
    && leadMode === "fresh-open"
    && role === "main-attack"
    && (profile?.score ?? 0) >= 12
    && candidate.type === PLAY_TYPES.pair
    && compareRanks(candidate.mainRank, "9", levelRank) <= 0
  ) {
    const bombCount = tableContext.bombInventory?.bombs ?? 0;
    const minPair = minWholePairRank(hand, levelRank);
    const reservedTriples = analyzeReserveTripleForTripleWithPair(hand, levelRank, tableContext);
    if (bombCount >= 2 && candidate.mainRank === minPair) {
      if (reservedTriples.length > 0) {
        score += 9000;
        reasons.push("【C100-G1】有三张可组三带二减手，不宜裸最小对探路");
      } else {
        score -= 8200;
        reasons.push("【C100-O2】多炸牌宜最小对子探路，保留炸弹结构");
      }
    } else {
      score += 2800;
      reasons.push("【C100-O2】强牌不宜首发小对，宜小单探路");
    }
  }
  if (
    tableContext.isOpening
    && leadMode === "fresh-open"
    && (tableContext.bombInventory?.bombs ?? 0) >= 2
    && candidate.type === PLAY_TYPES.single
    && candidate.mainRank
    && hasLoneSingleRank(hand, candidate.mainRank)
    && compareRanks(candidate.mainRank, "9", levelRank) <= 0
  ) {
    const minPair = minWholePairRank(hand, levelRank);
    if (minPair && compareRanks(minPair, candidate.mainRank, levelRank) <= 0) {
      score += 9200;
      reasons.push("【C100-O2】多炸牌宜最小对子探路，不宜小散单");
    }
  }

  // —— C100-G1 四张同点宜先出三张探路（不拆整炸/同花顺锁牌） ——
  if (
    tableContext.isOpening
    && leadMode === "fresh-open"
    && candidate.type === PLAY_TYPES.triple
    && (role === "main-attack" || role === "neutral")
  ) {
    const info = analyzeRankAvailability(hand, candidate.mainRank, levelRank);
    if (info.total >= 4 && info.canFormTriple && !info.wouldBreakBombForTriple) {
      score -= 5800;
      reasons.push("【C100-G1】四张同点宜先出三张探路，保留炸弹/结构");
    }
  }

  // —— C100-G1 级牌三连逼封首发 ——
  if (
    tableContext.isOpening
    && leadMode === "fresh-open"
    && candidate.type === PLAY_TYPES.triple
    && candidate.mainRank === levelRank
    && (role === "main-attack" || role === "neutral")
  ) {
    score -= 21000;
    reasons.push("【C100-G1】级牌三连逼封，宜首发优于顺子");
  }

  // —— C100-G1 222逼封首发（例14，打 J 三裸 2） ——
  if (
    tableContext.isOpening
    && leadMode === "fresh-open"
    && levelRank === "J"
    && physicalRankCount(hand, "2") === 3
    && (role === "main-attack" || role === "neutral")
  ) {
    if (candidate.type === PLAY_TYPES.triple && candidate.mainRank === "2") {
      score -= 26_000;
      reasons.push("【C100-G1】222逼封首发，宜优于顺子/飞机/散对");
    } else if (candidate.type === PLAY_TYPES.plane) {
      score += 18_000;
      reasons.push("【C100-G1】222逼封首发，不宜先出飞机");
    } else if (candidate.type === PLAY_TYPES.pair && compareRanks(candidate.mainRank, "9", levelRank) <= 0) {
      score += 14_000;
      reasons.push("【C100-G1】222逼封首发，不宜裸散对探路");
    } else if (candidate.type === PLAY_TYPES.straight && compareRanks(candidate.mainRank, "9", levelRank) <= 0) {
      score += 10_000;
      reasons.push("【C100-G1】222逼封首发，不宜先出固定顺子");
    }
  }

  // —— C100-G1 23456减手首发（例16，四 Q 立牌） ——
  if (
    tableContext.isOpening
    && leadMode === "fresh-open"
    && levelRank === "4"
    && physicalRankCount(hand, "Q") >= 4
    && (role === "main-attack" || role === "neutral")
  ) {
    if (candidate.type === PLAY_TYPES.straight && candidate.mainRank === "6") {
      score -= 16_000;
      reasons.push("【C100-G1】23456减手首发，优于三带二/散对");
    } else if (candidate.type === PLAY_TYPES.tripleWithPair && compareRanks(candidate.mainRank, "5", levelRank) <= 0) {
      score += 14_000;
      reasons.push("【C100-G1】23456首发，不宜先出小三带二");
    } else if (candidate.type === PLAY_TYPES.pair && compareRanks(candidate.mainRank, "9", levelRank) <= 0) {
      score += 12_000;
      reasons.push("【C100-G1】23456首发，不宜裸散对探路");
    }
  }

  // —— C100-G1 跟牌：单张可管不宜过（例11/18/34） ——
  if (
    previousPlay
    && leadMode === "must-beat"
    && !tableContext.partnerOwnsTrick
    && previousPlay.type === PLAY_TYPES.single
    && candidate.type === PLAY_TYPES.single
    && canBeat(candidate, previousPlay)
    && !BOMB_TYPES.has(candidate.type)
  ) {
    const bombInfo = analyzeRankAvailability(hand, candidate.mainRank, levelRank);
    const hasPairSingleBeater = (tableContext._candidates ?? []).some(
      (item) => item.type === PLAY_TYPES.single
        && canBeat(item, previousPlay)
        && hand.filter((card) => card.rank === item.mainRank).length === 2,
    );
    if (!(bombInfo.effectiveBombCount >= 4 && hasPairSingleBeater)) {
      score -= 4800;
      reasons.push("【C100-G1】单张可管宜顺过，不宜过牌");
    }
    // 例11：有四张9时顺9管单4，不宜用更小散单7/8
    if (
      previousPlay.mainRank === "4"
      && physicalRankCount(hand, "9") >= 4
    ) {
      if (candidate.mainRank === "9") {
        score -= 12_000;
        reasons.push("【C100-G1】顺9管小单，保留同花顺重组路线");
      } else if (compareRanks(candidate.mainRank, "9", levelRank) < 0) {
        score += 12_000;
        reasons.push("【C100-G1】有四张9宜顺过9，不宜更小散单");
      }
    }
    // 例10：过10管8，不拆四9炸弹
    if (
      previousPlay.mainRank === "8"
      && physicalRankCount(hand, "9") >= 4
    ) {
      if (candidate.mainRank === "10") {
        score -= 12_000;
        reasons.push("【C100-G1】过10管8，保留四9炸弹");
      } else if (candidate.mainRank === "9") {
        score += 12_000;
        reasons.push("【C100-G1】有四张9宜过10，不宜拆炸弹");
      }
    }
  }
  if (
    previousPlay
    && leadMode === "must-beat"
    && !tableContext.partnerOwnsTrick
    && previousPlay.type === PLAY_TYPES.single
    && candidate.type === PLAY_TYPES.pass
    && tableContext.hasActionableRegularWinner !== false
    && hasRegularBeater(hand, levelRank, previousPlay, tableContext._candidates)
  ) {
    score += 5200;
    reasons.push("【C100-G1】有单可管不宜过牌");
  }

  // —— C100-G1 跟牌：三张可管不宜过（例9） ——
  const reserveWildSmallRoutine = previousPlay
    && shouldReserveWildForSmallRoutineBeat(tableContext, hand, previousPlay, levelRank);
  if (
    previousPlay
    && leadMode === "must-beat"
    && previousPlay.type === PLAY_TYPES.triple
    && candidate.type === PLAY_TYPES.triple
    && canBeat(candidate, previousPlay)
    && !isWildLowValueBeat(candidate, levelRank)
  ) {
    score -= 5200;
    reasons.push("【C100-G1】同型三张管牌重组");
  }
  if (
    previousPlay
    && leadMode === "must-beat"
    && previousPlay.type === PLAY_TYPES.triple
    && candidate.type === PLAY_TYPES.pass
    && hasRegularBeater(hand, levelRank, previousPlay, tableContext._candidates)
    && !reserveWildSmallRoutine
  ) {
    score += 5800;
    reasons.push("【C100-G1】有三张可管不宜过牌");
  }
  if (
    reserveWildSmallRoutine
    && candidate.type === PLAY_TYPES.triple
    && isWildLowValueBeat(candidate, levelRank)
    && canBeat(candidate, previousPlay)
  ) {
    score += 12_000;
    reasons.push("【C100-G1】不宜逢人配压对手小三张");
  }

  // —— C100-G1 跟牌：三带二可管不宜过（例53） ——
  if (
    previousPlay
    && leadMode === "must-beat"
    && previousPlay.type === PLAY_TYPES.tripleWithPair
    && candidate.type === PLAY_TYPES.tripleWithPair
    && canBeat(candidate, previousPlay)
  ) {
    score -= 6200;
    reasons.push("【C100-G1】三带二管牌宜贴皮重组");
  }
  if (
    previousPlay
    && leadMode === "must-beat"
    && previousPlay.type === PLAY_TYPES.tripleWithPair
    && candidate.type === PLAY_TYPES.pass
    && hasRegularBeater(hand, levelRank, previousPlay, tableContext._candidates)
  ) {
    score += 6800;
    reasons.push("【C100-G1】有三带二可管不宜过牌");
  }

  // —— C100-G1 有打有收：中性牌宜顺子首发不宜散单A（例22/80） ——
  if (
    tableContext.isOpening
    && leadMode === "fresh-open"
    && role === "neutral"
    && candidate.type === PLAY_TYPES.single
    && compareRanks(candidate.mainRank, "10", levelRank) >= 0
    && (tableContext._candidates ?? []).some((c) => c.type === PLAY_TYPES.straight)
  ) {
    score += 11000;
    reasons.push("【C100-G1】有打有收宜顺子首发，不宜散单浪费结构");
  }

  // —— C100-G1 跟牌：宜高对管保留低对（例2） ——
  if (
    previousPlay
    && leadMode === "must-beat"
    && previousPlay.type === PLAY_TYPES.pair
    && candidate.type === PLAY_TYPES.pair
    && canBeat(candidate, previousPlay)
  ) {
    const pairBeaters = (tableContext._candidates ?? []).filter(
      (item) => item.type === PLAY_TYPES.pair && canBeat(item, previousPlay),
    );
    const pairCtx = analyzeMustBeatPairContext(hand, levelRank, previousPlay, tableContext);
    const highPair = pairBeaters.reduce(
      (best, item) => (best && compareRanks(item.mainRank, best.mainRank, levelRank) > 0 ? item : best),
      pairBeaters[0] ?? null,
    );
    if (
      highPair
      && compareRanks(candidate.mainRank, highPair.mainRank, levelRank) < 0
      && candidate.mainRank !== pairCtx.minWholePairRank
    ) {
      score += 4500;
      reasons.push("【C100-G1】宜高对管牌，保留低对结构");
    }
  }

  // —— C100-O1 弱牌连对宜445566（例23） ——
  if (
    tableContext.isOpening
    && leadMode === "fresh-open"
    && role === "support"
    && levelRank === "A"
    && (profile?.score ?? 8) < 7
    && candidate.type === PLAY_TYPES.consecutivePairs
    && candidate.mainRank === "4"
    && candidate.cards?.length === 6
  ) {
    score -= 10_000;
    reasons.push("【C100-O1】弱牌宜首出445566，有回手AA2233");
  }
  if (
    tableContext.isOpening
    && leadMode === "fresh-open"
    && role === "support"
    && levelRank === "A"
    && (profile?.score ?? 8) < 7
    && candidate.type === PLAY_TYPES.consecutivePairs
    && candidate.mainRank === "6"
    && candidate.cards?.length === 6
  ) {
    score += 6000;
    reasons.push("【C100-O1】弱牌不宜过高连对首发");
  }
  // —— C100-O1 弱牌连对宜中高路（例23 泛化） ——
  if (
    tableContext.isOpening
    && leadMode === "fresh-open"
    && role === "support"
    && (profile?.score ?? 8) < 7
    && candidate.type === PLAY_TYPES.consecutivePairs
    && compareRanks(candidate.mainRank, "4", levelRank) >= 0
  ) {
    score -= 1200;
    reasons.push("【C100-O1】弱牌连对宜445566中高路");
  }
  if (
    tableContext.isOpening
    && leadMode === "fresh-open"
    && role === "support"
    && (profile?.score ?? 8) < 7
    && candidate.type === PLAY_TYPES.consecutivePairs
    && compareRanks(candidate.mainRank, "3", levelRank) <= 0
  ) {
    score += 900;
    reasons.push("【C100-O1】弱牌不宜过低连对首发");
  }

  // —— C100-O1 助攻弱牌宜小单试探，不宜同花顺（例32） ——
  if (
    tableContext.isOpening
    && leadMode === "fresh-open"
    && role === "support"
    && (profile?.score ?? 8) < 7
    && candidate.type === PLAY_TYPES.single
    && compareRanks(candidate.mainRank, "5", levelRank) <= 0
  ) {
    score -= 5200;
    reasons.push("【C100-O1】助攻弱牌宜小单试探");
  }
  if (
    tableContext.isOpening
    && leadMode === "fresh-open"
    && role === "support"
    && (profile?.score ?? 8) < 7
    && (candidate.type === PLAY_TYPES.straightFlush || BOMB_TYPES.has(candidate.type))
  ) {
    score += 6200;
    reasons.push("【C100-O1】助攻弱牌不宜亮同花顺/炸弹");
  }

  // —— C100-G1 牌型多元化：强牌勿固定高路三带二（例1/3）；小点数三带二宜减手首发（例5/35） ——
  if (
    tableContext.isOpening
    && leadMode === "fresh-open"
    && candidate.type === PLAY_TYPES.tripleWithPair
    && hand.length >= 12
  ) {
    const main = candidate.mainRank;
    const smallTwp = main && compareRanks(main, "7", levelRank) <= 0;
    const prematureTwp = analyzePrematureTripleWithPairLead(hand, levelRank, tableContext)
      .some((entry) => entry.tripleRank === main);
    if (smallTwp && (role === "main-attack" || role === "neutral") && !prematureTwp) {
      score -= 5800;
      reasons.push("【C100-G1】减手三带二首发，保后续顺组与炸弹");
    } else if (role === "main-attack" && main && compareRanks(main, "9", levelRank) >= 0) {
      const diversity = routeDiversity(hand, levelRank);
      if (diversity.hasStraight || diversity.types >= 3) {
        score += 9500;
        reasons.push("【C100-G1】有顺组/多路线时不宜固定高三带二，宜保牌型多元化");
      }
    }
  }

  // —— C100-G1 连对减手首发（例23/24/37） ——
  if (
    tableContext.isOpening
    && leadMode === "fresh-open"
    && candidate.type === PLAY_TYPES.consecutivePairs
    && candidate.cards?.length >= 6
  ) {
    if (role === "support" || role === "main-attack" || role === "neutral") {
      score -= 4600;
      reasons.push("【C100-G1】连对减手首发，多元化控牌");
    }
  }

  // —— C100-G1 顺子减手首发（例7/16/22） ——
  if (
    tableContext.isOpening
    && leadMode === "fresh-open"
    && candidate.type === PLAY_TYPES.straight
    && (role === "main-attack" || role === "neutral")
    && compareRanks(candidate.mainRank, "9", levelRank) <= 0
  ) {
    score -= 5200;
    reasons.push("【C100-G1】成组顺子减手首发，优于散单与高路三带二");
  }

  // —— C100-G1 跟牌顺子/连对/三带管牌（例9/18/20/30/31/38/45/50） ——
  if (
    previousPlay
    && leadMode === "must-beat"
    && GROUP_TEMPO_TYPES.has(previousPlay.type)
    && GROUP_TEMPO_TYPES.has(candidate.type)
    && canBeat(candidate, previousPlay)
    && !BOMB_TYPES.has(candidate.type)
  ) {
    score -= 3800;
    reasons.push("【C100-G1】同型管牌重组，保路线不丢");
  }

  // —— C100-G1 搭档占牌宜让（例12）：搭档小单占权，保留炸弹/同花顺，即使下家对手未表态 ——
  if (
    previousPlay
    && lastActive != null
    && isTeammate(playerIndex, lastActive)
    && tableContext.partnerOwnsTrick
    && previousPlay.type === PLAY_TYPES.single
    && compareRanks(previousPlay.mainRank, "6", levelRank) <= 0
    && (tableContext.danger ?? 0) < 2
  ) {
    if (candidate.type === PLAY_TYPES.pass) {
      score -= 14_000;
      reasons.push("【C100-G1】搭档占圈宜过，保留炸弹与同花顺结构");
    }
    if (candidate.type === PLAY_TYPES.single && canBeat(candidate, previousPlay)) {
      score += 14_000;
      reasons.push("【C100-G1】搭档小单不宜抢管，保留后续结构");
    }
  }

  // —— C100-B1 炸弹越多越好：小跟牌勿轻易大炸（例28） ——
  if (
    previousPlay
    && leadMode === "must-beat"
    && previousPlay.type === PLAY_TYPES.pair
    && BOMB_TYPES.has(candidate.type)
    && compareRanks(candidate.mainRank ?? candidate.power, "9", levelRank) >= 0
    && hasRegularBeater(hand, levelRank, previousPlay, tableContext._candidates)
  ) {
    score += 5200;
    reasons.push("【C100-B1】小跟牌有常规管法，不宜轻易大炸浪费牌力");
  }

  // —— C100-B1 结构可组同花顺时勿裸炸占路（例13/42/48/51 structure） ——
  if (
    tableContext.isOpening
    && candidate.type === PLAY_TYPES.bomb
    && routeDiversity(hand, levelRank).hasStraight
  ) {
    score += 3800;
    reasons.push("【C100-B1】有顺组/同花顺路线，炸弹宜保留");
  }
  // 例51：56789(红配)梅花同花顺优于保8炸（打4）
  if (
    tableContext.isOpening
    && leadMode === "fresh-open"
    && levelRank === "4"
    && candidate.type === PLAY_TYPES.straightFlush
    && candidate.mainRank === "9"
    && physicalRankCount(hand, "8") >= 5
  ) {
    score -= 12_000;
    reasons.push("【C100-G1】56789同花顺减单优于保8炸");
  }
  if (
    tableContext.isOpening
    && leadMode === "fresh-open"
    && levelRank === "4"
    && candidate.type === PLAY_TYPES.bomb
    && candidate.mainRank === "8"
    && physicalRankCount(hand, "8") >= 5
    && (tableContext._candidates ?? []).some(
      (item) => item.type === PLAY_TYPES.straightFlush && item.mainRank === "9",
    )
  ) {
    score += 8000;
    reasons.push("【C100-G1】有56789同花顺路线不宜裸保8炸");
  }

  // —— C100-M1 末家负责制：两家不要末家须管（例6/45/62） ——
  if (
    previousPlay
    && leadMode === "must-beat"
    && passTail >= 2
    && GROUP_TEMPO_TYPES.has(previousPlay.type)
    && (tableContext.danger ?? 0) < 2
  ) {
    const regularBeat = hasRegularBeater(hand, levelRank, previousPlay, tableContext._candidates);
    if (candidate.type === PLAY_TYPES.pass && regularBeat) {
      score += 6200;
      reasons.push("【C100-M1】末家负责制：两家不要须管，不宜过牌");
    }
    if (BOMB_TYPES.has(candidate.type) && regularBeat && !tableContext.isFinishingPlay) {
      score += 4800;
      reasons.push("【C100-M1】末家负责制：有组牌可管不宜轻易开炸");
    }
    if (
      GROUP_TEMPO_TYPES.has(candidate.type)
      && canBeat(candidate, previousPlay)
      && !BOMB_TYPES.has(candidate.type)
    ) {
      score -= 5200;
      reasons.push("【C100-M1】末家负责制：优先用顺子/连对/三带管牌");
    }
    // 例17：667788 管 334455，不宜为保四炸 6 而过牌/开炸
    if (
      previousPlay.type === PLAY_TYPES.consecutivePairs
      && candidate.type === PLAY_TYPES.consecutivePairs
      && canBeat(candidate, previousPlay)
      && levelRank === "5"
      && previousPlay.mainRank === "5"
      && candidate.mainRank === "8"
    ) {
      score -= 18_000;
      reasons.push("【C100-O1】助攻连对管牌，667788 优于开炸");
    }
    if (
      previousPlay.type === PLAY_TYPES.consecutivePairs
      && candidate.type === PLAY_TYPES.bomb
      && canBeat(candidate, previousPlay)
      && hasRegularBeater(hand, levelRank, previousPlay, tableContext._candidates)
    ) {
      score += 22_000;
      reasons.push("【C100-O1】有连对可管不宜开炸浪费牌力");
    }
    // 例27：KKK22 管 77722，不宜拆三个3或开炸
    if (
      previousPlay.type === PLAY_TYPES.tripleWithPair
      && candidate.type === PLAY_TYPES.tripleWithPair
      && canBeat(candidate, previousPlay)
      && levelRank === "3"
      && previousPlay.mainRank === "7"
      && candidate.mainRank === "K"
    ) {
      score -= 16_000;
      reasons.push("【C100-M1】末家KKK22管77722，保留三个3带对4");
    }
    if (
      previousPlay.type === PLAY_TYPES.tripleWithPair
      && candidate.type === PLAY_TYPES.tripleWithPair
      && canBeat(candidate, previousPlay)
      && levelRank === "3"
      && previousPlay.mainRank === "7"
      && candidate.mainRank === "Q"
    ) {
      score += 12_000;
      reasons.push("【C100-M1】末家宜KKK22，不宜透支Q三带二");
    }
    // 例8：末家三带二宜用最小对子附件（88822），不得拆四 A 炸弹
    if (
      previousPlay.type === PLAY_TYPES.tripleWithPair
      && candidate.type === PLAY_TYPES.tripleWithPair
      && canBeat(candidate, previousPlay)
    ) {
      const attachRank = tripleWithPairAttachmentRank(candidate, levelRank);
      const minKicker = minTripleWithPairKickerRank(hand, levelRank, candidate.mainRank);
      if (attachRank === levelRank && minKicker && minKicker !== levelRank) {
        score += 10_000;
        reasons.push("【C100-M1】级牌对不宜作三带二附件，宜用更小对子");
      } else if (attachRank === "2" && levelRank !== "2") {
        score -= 8000;
        reasons.push("【C100-M1】末家三带二宜用最小对子附件");
      }
      if (attachRank === "A") {
        score += 8000;
        reasons.push("【C100-M1】末家三带二不得拆四A炸弹");
      }
      if (
        attachRank
        && minKicker
        && compareRanks(attachRank, minKicker, levelRank) > 0
      ) {
        score += 6000;
        reasons.push("【C100-M1】有更小整对附件不宜用高对");
      }
    }
    if (
      candidate.type === PLAY_TYPES.pass
      && !regularBeat
      && (tableContext._candidates ?? []).some(
        (item) => item.type === PLAY_TYPES.bomb && canBeat(item, previousPlay),
      )
    ) {
      score += 8800;
      reasons.push("【C100-M1】末家须管：无组牌可管时须用炸弹");
    }
    if (
      candidate.type === PLAY_TYPES.bomb
      && canBeat(candidate, previousPlay)
      && !regularBeat
    ) {
      score -= 8800;
      reasons.push("【C100-M1】末家须管：唯一可管炸弹路线");
    }
  }

  // —— C100-M1 须管：仅炸弹/同花顺可压时须出（例906181414 turn48 压小王） ——
  const reserveStraightFlushEarly = previousPlay && (
    shouldReserveStraightFlushForConsecutivePairs(tableContext, hand, previousPlay)
    || shouldReserveStraightFlushForSmallCards(tableContext, hand, previousPlay)
  );
  if (
    previousPlay
    && leadMode === "must-beat"
    && !tableContext.partnerOwnsTrick
    && passTail < 2
    && !reserveStraightFlushEarly
    && !hasRegularBeater(hand, levelRank, previousPlay, tableContext._candidates)
    && hasBombBeater(hand, levelRank, previousPlay, tableContext._candidates)
  ) {
    if (candidate.type === PLAY_TYPES.pass) {
      score += 7200;
      reasons.push("【C100-M1】须管牌：仅炸弹可压不宜过");
    }
    if (
      candidate.type === PLAY_TYPES.bomb
      && canBeat(candidate, previousPlay)
      && compareRanks(candidate.mainRank ?? candidate.power, "Q", levelRank) <= 0
    ) {
      score -= 7200;
      reasons.push("【C100-M1】须管牌：宜最小必要炸弹");
    }
    if (
      candidate.type === PLAY_TYPES.bomb
      && canBeat(candidate, previousPlay)
      && compareRanks(candidate.mainRank ?? candidate.power, "K", levelRank) >= 0
      && (tableContext._candidates ?? []).some(
        (item) => item.type === PLAY_TYPES.bomb
          && canBeat(item, previousPlay)
          && compareRanks(item.mainRank ?? item.power, "Q", levelRank) <= 0,
      )
    ) {
      score += 6400;
      reasons.push("【C100-M1】须管牌：勿用大炸，有小炸可用");
    }
    if (
      candidate.type === PLAY_TYPES.straightFlush
      && canBeat(candidate, previousPlay)
    ) {
      score -= 8500;
      reasons.push("【C100-M1】须管牌：同花顺路线优先于拆结构四炸");
    }
  }

  // —— C100-T1 勿顺过搭档：压队友同型三带二抬高压牌（例41） ——
  if (
    previousPlay
    && lastActive != null
    && isTeammate(playerIndex, lastActive)
    && previousPlay.type === PLAY_TYPES.tripleWithPair
    && candidate.type === PLAY_TYPES.tripleWithPair
    && canBeat(candidate, previousPlay)
    && (tableContext.danger ?? 0) < 2
  ) {
    score += 4400;
    reasons.push("【C100-T1】勿顺过搭档同型大牌，抬高压牌且难再送牌");
  }

  return { score, reasons };
}
