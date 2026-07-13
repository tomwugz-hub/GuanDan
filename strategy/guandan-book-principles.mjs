/**
 * 《掼蛋技巧秘籍》（丁华著）教纲评分层 — 补齐书中 P0/P1/P2 可结构化原则。
 * 出处索引见 training-samples/guandan-book-doctrine.md
 */
import { isJoker, isWildCard } from "../engine/card.mjs";
import { canBeat } from "../engine/compare-play.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { compareRanks, isControlRank, rankPower } from "../engine/rank-order.mjs";
import { buildStrategicGroups } from "./strategic-groups.mjs";
import { playerJustWonTrickWithBomb } from "./lead-mode.mjs";
import {
  estimateCardMemory,
  gamePhase,
  isLowerPlayer,
  isUpperPlayer,
  minOpponentHandCount,
  opponentsWithOneCard,
  partnerHandCount,
  partnerOpeningRoute,
} from "./table-context.mjs";
import { matchesBridgeTarget } from "./partner-inference.mjs";

const BOMB_TYPES = new Set([PLAY_TYPES.bomb, PLAY_TYPES.straightFlush, PLAY_TYPES.jokerBomb]);
const GROUP_TEMPO_TYPES = new Set([
  PLAY_TYPES.straight,
  PLAY_TYPES.consecutivePairs,
  PLAY_TYPES.plane,
  PLAY_TYPES.tripleWithPair,
]);

function cardKey(card) {
  return `${card.rank}:${card.suit}:${card.deckIndex}`;
}

function remainingHand(hand, candidate) {
  if (!candidate || candidate.type === PLAY_TYPES.pass) return hand;
  const used = new Set((candidate.cards ?? []).map(cardKey));
  return hand.filter((card) => !used.has(cardKey(card)));
}

/** 粗估手数：组牌数 + 未入组散牌（第20篇 G1） */
function estimateTurns(hand, levelRank) {
  if (!hand?.length) return 0;
  const groups = buildStrategicGroups(hand, levelRank);
  const grouped = new Set(groups.flatMap((g) => (g.cards ?? []).map(cardKey)));
  const loose = hand.filter((c) => !grouped.has(cardKey(c)) && !isJoker(c)).length;
  return Math.max(1, groups.length + Math.ceil(loose / 2));
}

function usesWildLowValue(candidate, levelRank) {
  if (!candidate || candidate.type === PLAY_TYPES.pass) return false;
  const wildUsed = (candidate.cards ?? []).filter((c) => isWildCard(c, levelRank)).length;
  if (wildUsed === 0) return false;
  // J4：逢人配不宜低价值配三带二/对子（第40篇）
  return [PLAY_TYPES.tripleWithPair, PLAY_TYPES.pair, PLAY_TYPES.triple].includes(candidate.type);
}

function routeFlexibility(hand, levelRank) {
  const groups = buildStrategicGroups(hand, levelRank);
  const types = new Set(groups.map((g) => g.play?.type).filter(Boolean));
  return types.size;
}

/**
 * 书籍教纲评分调整（挂 recommend 管线）。
 * @returns {{ score: number, reasons: string[] }}
 */
export function bookDoctrineAdjustment(candidate, hand, levelRank, tableContext) {
  const reasons = [];
  let score = 0;
  const profile = tableContext.handProfile;
  const role = profile?.role ?? "balanced";
  const phase = gamePhase(tableContext);
  const memory = tableContext.cardMemory ?? estimateCardMemory(tableContext);
  const routeMemory = tableContext.routeMemory;
  const partnerInference = tableContext.partnerInference;
  const previousPlay = tableContext.previousPlay ?? null;
  const playerIndex = tableContext.playerIndex ?? tableContext.state?.currentPlayerIndex ?? 0;
  const lastActive = tableContext.lastActivePlayerIndex ?? tableContext.state?.lastActivePlayerIndex;

  // —— G1 手数越少越好：成组减手优先（第20篇） ——
  if (tableContext.isOpening && candidate.type !== PLAY_TYPES.pass) {
    const before = estimateTurns(hand, levelRank);
    const after = estimateTurns(remainingHand(hand, candidate), levelRank);
    const delta = before - after;
    if (delta >= 2) {
      score -= 2800;
      reasons.push("【G1】出牌减手≥2，优于拆散结构");
    } else if (delta === 1 && GROUP_TEMPO_TYPES.has(candidate.type)) {
      score -= 1600;
      reasons.push("【G1】成组出牌减一手，手数越少越好");
    } else if (delta <= 0 && !BOMB_TYPES.has(candidate.type) && hand.length >= 12) {
      score += 2200;
      reasons.push("【G1】此出法不减手数，宜留更强组牌路线");
    }
  }

  // —— G4 有回收先走可回收小牌（第20篇）；对手报单时让 P12 封门优先 ——
  if (
    tableContext.isOpening
    && candidate.type === PLAY_TYPES.single
    && hand.some((c) => isJoker(c))
    && compareRanks(candidate.mainRank, "9", levelRank) <= 0
    && !isControlRank(candidate.mainRank, levelRank)
    && opponentsWithOneCard(tableContext).length === 0
  ) {
    score -= 1800;
    reasons.push("【G4】有王可回收，宜先出小单试探减赘牌");
  }

  // —— J4 逢人配高用途：慎配三带二/对子（第40篇，与 P8 呼应） ——
  if (usesWildLowValue(candidate, levelRank)) {
    score += 4200;
    reasons.push("【J4】逢人配宜组炸弹/同花顺/杂顺，不宜低价值配三带二");
  }

  // —— T9 牌路多样性：灵活性不足是弱点（第51–53篇） ——
  if (tableContext.isOpening && candidate.type !== PLAY_TYPES.pass) {
    const left = remainingHand(hand, candidate);
    const flexAfter = routeFlexibility(left, levelRank);
    const flexBefore = routeFlexibility(hand, levelRank);
    if (flexBefore >= 3 && flexAfter <= 1 && hand.length >= 10) {
      score += 3600;
      reasons.push("【T9】此出法后牌路单一，灵活性不足");
    }
  }

  // —— 助攻 T1 扩展：中局牌路不明仍宜对子先行（第26篇） ——
  if (
    tableContext.isOpening
    && role === "support"
    && phase !== "late"
    && hand.length >= 8
    && !partnerOpeningRoute(tableContext)
  ) {
    if (candidate.type === PLAY_TYPES.pair) {
      score -= 3200;
      reasons.push("【T1】助攻牌路不明，中局仍宜对子先行探路");
    } else if (candidate.type === PLAY_TYPES.single && hand.length >= 10) {
      score += 2800;
      reasons.push("【T1】助攻牌路未明，不宜先出单张");
    }
  }

  // —— G6 组牌出尽：同路组牌争取一次出尽（第44篇） ——
  if (tableContext.leadMode === "catch-wind" && GROUP_TEMPO_TYPES.has(candidate.type)) {
    const oneShot = (candidate.cards?.length ?? 0) === hand.length;
    const groupLen = candidate.length ?? candidate.cards?.length ?? 0;
    if (oneShot) {
      score -= 4200;
      reasons.push("【G6】同路组牌争取一次出尽，不打则已一打尽");
    } else if (groupLen >= 5 && hand.length <= 12) {
      score -= 2400;
      reasons.push("【G6】受阻前优先走满同路组牌减手");
    }
  }

  // —— T7 送听扩展：读 partner-inference + route-memory（第32篇） ——
  const partnerCount = partnerHandCount(tableContext);
  const partnerRoute = partnerOpeningRoute(tableContext);
  const bridgeTypes = partnerInference?.bridgeTypes ?? [];
  if (
    tableContext.isOpening
    && role === "support"
    && partnerCount > 0
    && partnerCount <= 8
    && (partnerRoute || partnerInference?.sendBridge)
  ) {
    if (matchesBridgeTarget(candidate, bridgeTypes.length ? bridgeTypes : [partnerRoute?.type].filter(Boolean))) {
      score -= 3800;
      reasons.push("【T7】队友强路听牌中，助攻宜送同路牌助走牌");
    } else if (
      candidate.type === PLAY_TYPES.tripleWithPair
      && bridgeTypes.some((t) => [PLAY_TYPES.pair, PLAY_TYPES.tripleWithPair, PLAY_TYPES.consecutivePairs].includes(t))
    ) {
      score += 5200;
      reasons.push("【T7】队友听牌路线在连对/对子，不宜换路三带二");
    }
  }

  // —— T10 谁打谁收：队友已收牌路时助攻不抢同路（第52篇 雏形） ——
  if (
    tableContext.isOpening
    && role === "support"
    && routeMemory?.partnerOwnership?.length
    && candidate.type !== PLAY_TYPES.pass
  ) {
    if (routeMemory.partnerOwnership.includes(candidate.type)) {
      score += 3200;
      reasons.push("【T10】队友已收此牌路，助攻不宜抢同路");
    }
  }

  // —— T11 放一家：对牌路最弱对手少施压（第53篇 雏形） ——
  if (
    !tableContext.isOpening
    && routeMemory?.weakestOpponentSeat != null
    && lastActive === routeMemory.weakestOpponentSeat
    && candidate.type === PLAY_TYPES.pass
    && tableContext.hasRegularWinner
    && (tableContext.danger ?? 0) < 2
  ) {
    score -= 2200;
    reasons.push("【T11】对手牌路偏弱，可过牌放一家");
  }

  // 跟牌场景
  if (!tableContext.isOpening && tableContext.opponentActive && previousPlay) {
    const minOpp = minOpponentHandCount(tableContext);
    const pressingUpper = isUpperPlayer(playerIndex, lastActive);
    const pressingLower = isLowerPlayer(playerIndex, lastActive);

    // —— F6 不减手数可不跟（第22篇） ——
    if (candidate.type === PLAY_TYPES.pass && tableContext.hasRegularWinner) {
      const beaters = (tableContext._candidates ?? []).filter(
        (item) => item.type !== PLAY_TYPES.pass
          && !BOMB_TYPES.has(item.type)
          && canBeat(item, previousPlay),
      );
      const minBeater = beaters.sort(
        (a, b) => estimateTurns(remainingHand(hand, a), levelRank)
          - estimateTurns(remainingHand(hand, b), levelRank),
      )[0];
      if (minBeater) {
        const turnsIfBeat = estimateTurns(remainingHand(hand, minBeater), levelRank);
        const turnsIfPass = estimateTurns(hand, levelRank);
        if (turnsIfBeat >= turnsIfPass && hand.length >= 10 && (tableContext.danger ?? 0) < 2) {
          score -= 4800;
          reasons.push("【F6】跟牌不减手数，可过牌交给队友");
        }
      }
    }

    // —— L4 初期不打上家：主攻早期为上家顺牌留空间（第15篇） ——
    if (
      phase === "early"
      && role === "main-attack"
      && pressingUpper
      && candidate.type !== PLAY_TYPES.pass
      && !BOMB_TYPES.has(candidate.type)
      && hand.length >= 14
    ) {
      score += 3200;
      reasons.push("【L4】斗牌初期主攻不宜打上家，留顺牌窗口");
    }

    // —— T6 打上家不惜牌力：助攻应主动打上家（第31篇） ——
    if (role === "support" && pressingUpper && candidate.type !== PLAY_TYPES.pass) {
      if (BOMB_TYPES.has(candidate.type)) {
        score -= 2400;
        reasons.push("【T6】助攻打上家不惜力，宜炸敌炸/登基牌");
      } else if ([PLAY_TYPES.single, PLAY_TYPES.pair].includes(candidate.type)) {
        score -= 1800;
        reasons.push("【T6】助攻应积极跟上家，减轻主攻消耗");
      }
    }

    // —— B2 炸谁的牌：打上家>下家（第17篇） ——
    if (BOMB_TYPES.has(candidate.type)) {
      const sfWasteSmall = candidate.type === PLAY_TYPES.straightFlush
        && previousPlay
        && [PLAY_TYPES.single, PLAY_TYPES.pair].includes(previousPlay.type)
        && hand.length > 8
        && (tableContext.danger ?? 0) < 3
        && candidate.cards?.length !== hand.length;
      if (sfWasteSmall) {
        score += 14_000;
        reasons.push("【P7】局面尚早，同花顺不压小单/对子");
      } else if (pressingUpper && (tableContext.danger ?? 0) < 3) {
        score -= 2200;
        reasons.push("【B2】炸上家优先，扭转上家牌路");
      } else if (pressingLower && phase !== "late" && hand.length >= 10) {
        const bombOnly = isBombOnlyBeatContext(tableContext);
        const mustBomb = bombOnly || (tableContext.danger ?? 0) >= 2;
        if (!mustBomb) {
          score += 3600;
          reasons.push("【B2】牌路未明不宜炸下家顺子");
        }
      }
    }

    // —— B6 炸不打四：敌剩4张一般不炸（第18篇） ——
    if (minOpp === 4 && candidate.type === PLAY_TYPES.pass && isBombOnlyBeatContext(tableContext)) {
      score -= 4200;
      reasons.push("【B6】敌剩4张多手牌，可过牌不必炸");
    }
    if (minOpp === 4 && BOMB_TYPES.has(candidate.type) && !tableContext.isFinishingPlay) {
      score += 4800;
      reasons.push("【B6】敌剩4张一般不炸，留炸护牌或等送桥");
    }

    // —— M2 残局逼炸为先（第23篇） ——
    if ((tableContext.danger ?? 0) >= 2 && candidate.type === PLAY_TYPES.pass) {
      if (isBombOnlyBeatContext(tableContext)) {
        score += 5200;
        reasons.push("【M2】残局逼炸为先，仅炸弹可压时不宜过牌");
      }
    }
    if ((tableContext.danger ?? 0) >= 2 && BOMB_TYPES.has(candidate.type)) {
      const sfWasteSmall = candidate.type === PLAY_TYPES.straightFlush
        && previousPlay
        && [PLAY_TYPES.single, PLAY_TYPES.pair].includes(previousPlay.type)
        && hand.length > 8
        && (tableContext.danger ?? 0) < 3
        && candidate.cards?.length !== hand.length;
      if (!sfWasteSmall) {
        score -= 2800;
        reasons.push("【M2】残局首要逼出敌炸，宜抢牌权");
      }
    }

    // —— M1 记牌：外场炸弹粗估已尽时更宜逼炸（第36–39篇 雏形） ——
    if (memory?.bombsMostlyOut && BOMB_TYPES.has(candidate.type) && minOpp <= 6) {
      score -= 1600;
      reasons.push("【M1】记牌：外场炸弹已粗估出尽，宜逼炸冲刺");
    }
    if (memory?.jokersAllSeen && previousPlay?.type === PLAY_TYPES.single
      && isControlRank(previousPlay.mainRank, levelRank)
      && candidate.type === PLAY_TYPES.single
      && !isControlRank(candidate.mainRank, levelRank)
    ) {
      score += 2800;
      reasons.push("【M1】四王已记尽，敌单张多为真控场，宜大牌压");
    }

    // —— B1 炸什么牌：优先炸敌炸/登基牌（第16篇，结合记牌雏形） ——
    if (BOMB_TYPES.has(candidate.type) && isOpponentBomb(previousPlay)) {
      score -= 3200;
      reasons.push("【B1】优先炸敌炸夺权");
    }
    if (
      BOMB_TYPES.has(candidate.type)
      && previousPlay?.type === PLAY_TYPES.tripleWithPair
      && (previousPlay.mainRank === levelRank || isControlRank(previousPlay.mainRank, levelRank))
    ) {
      score -= 2600;
      reasons.push("【B1】敌主牌三带二/登基牌，宜炸扭转");
    }
  }

  // —— B3 出炸宜晚：非残局不轻易炸（第18篇，与 P12 呼应） ——
  if (
    BOMB_TYPES.has(candidate.type)
    && previousPlay
    && hand.length >= 12
    && (tableContext.danger ?? 0) < 2
    && !isBombOnlyBeatContext(tableContext)
    && tableContext.hasActionableRegularWinner
  ) {
    score += 2400;
    reasons.push("【B3】出炸宜晚，有普通压牌不必动炸");
  }

  // —— F3/F4 登基计点：拆炸保两单/增登基牌（第21篇 最小实现） ——
  const coronationPoints = countCoronationPoints(hand, levelRank);
  if (tableContext.isOpening && candidate.type !== PLAY_TYPES.pass && !BOMB_TYPES.has(candidate.type)) {
    const after = countCoronationPoints(remainingHand(hand, candidate), levelRank);
    if (coronationPoints >= 2 && after < coronationPoints && hand.length >= 10) {
      score += 2800;
      reasons.push("【F3】此出法减少登基牌，宜保留控场张");
    }
    if (after > coronationPoints && candidate.type === PLAY_TYPES.single) {
      score -= 1600;
      reasons.push("【F4】出单增登基牌，利于后续回收");
    }
  }

  // —— B10 护牌阻挡：敌少张时留炸护队友/自己（第19篇 雏形） ——
  if (
    BOMB_TYPES.has(candidate.type)
    && (tableContext.danger ?? 0) >= 1
    && (memory?.maxOpponentBombThreat ?? 0) >= 2
    && !isBombOnlyBeatContext(tableContext)
    && !tableContext.hasActionableRegularWinner
    && hand.length >= 8
  ) {
    score += 3600;
    reasons.push("【B10】敌尚有炸威胁，宜留炸护牌");
  }

  // —— M3 骗炸雏形：牌路弱对手先小出诱炸（第24篇，仅开局主攻） ——
  const myBombs = tableContext.bombInventory?.bombs ?? 0;
  const justWonWithBomb = playerJustWonTrickWithBomb(tableContext.state, playerIndex);
  if (
    tableContext.isOpening
    && tableContext.leadMode !== "catch-wind"
    && !justWonWithBomb
    && role === "main-attack"
    && routeMemory?.weakestOpponentSeat != null
    && candidate.type === PLAY_TYPES.single
    && compareRanks(candidate.mainRank, "9", levelRank) <= 0
    && myBombs >= 1
    && (memory?.maxOpponentBombThreat ?? 0) >= 2
  ) {
    score -= 1400;
    reasons.push("【M3】对手或有炸，宜小单试探骗炸");
  }

  return { score, reasons };
}

/** 登基牌计点：级牌+A+王+控场（F3/F4 用） */
function countCoronationPoints(hand, levelRank) {
  let pts = 0;
  for (const card of hand ?? []) {
    if (card.rank === "SJ" || card.rank === "BJ") pts += 2;
    else if (card.rank === levelRank) pts += 2;
    else if (card.rank === "A") pts += 1;
    else if (rankPower(card.rank, levelRank) >= rankPower("K", levelRank)) pts += 0.5;
  }
  return Math.floor(pts);
}

function isOpponentBomb(play) {
  return play && BOMB_TYPES.has(play.type);
}

/** 须压且仅炸弹可跟（书籍 B5/M2 共用） */
function isBombOnlyBeatContext(tableContext) {
  return tableContext.hasAnyWinner === true
    && tableContext.hasRegularWinner === false
    && tableContext.hasActionableRegularWinner !== true;
}
