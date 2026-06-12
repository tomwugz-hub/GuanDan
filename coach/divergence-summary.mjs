/** 对比「教练推荐1」与「你实际出牌」，找出本局差异并粗分类。 */

import { playSignature } from "../engine/card.mjs";
import { compareRanks } from "../engine/rank-order.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { detectDoctrineViolations } from "../strategy/doctrine-enforce.mjs";
import {
  resolveStraightBreakForSingle,
  resolveStraightBreakForTripleWithPair,
} from "../strategy/principles.mjs";
import { breaksBombIntegrity } from "../strategy/scorers/structure.mjs";

export const DIVERGENCE_VERDICTS = Object.freeze({
  USER_BETTER: "user-better",
  COACH_BETTER: "coach-better",
  STYLE: "style-preference",
  COACH_QUESTIONABLE: "coach-questionable",
});

const VERDICT_LABELS = {
  [DIVERGENCE_VERDICTS.USER_BETTER]: "你更对",
  [DIVERGENCE_VERDICTS.COACH_BETTER]: "教练更对",
  [DIVERGENCE_VERDICTS.STYLE]: "风格差异",
  [DIVERGENCE_VERDICTS.COACH_QUESTIONABLE]: "教练不合理",
};

const ADJUDICATION_BY_VERDICT = {
  [DIVERGENCE_VERDICTS.USER_BETTER]: "user",
  [DIVERGENCE_VERDICTS.COACH_BETTER]: "coach",
  [DIVERGENCE_VERDICTS.STYLE]: "style",
  [DIVERGENCE_VERDICTS.COACH_QUESTIONABLE]: "coach-questionable",
};

const BOMB_TYPES = new Set([PLAY_TYPES.bomb, PLAY_TYPES.straightFlush, PLAY_TYPES.jokerBomb]);

/** 是否计入人类复盘（排除机器人与自动打完代打） */
export function isHumanReplayRecord(record, humanPlayerIndex = 0) {
  if (!record || record.playerIndex !== humanPlayerIndex) return false;
  const source = String(record.source ?? "");
  if (source.startsWith("robot")) return false;
  if (source === "auto-game") return false;
  return true;
}

function labelOf(play) {
  if (!play) return "—";
  if (play.type === "Pass") return "过牌";
  return play.label ?? play.type ?? "—";
}

function playTypeOf(play) {
  return play?.type ?? "";
}

function bombRankFromLabel(label) {
  const match = String(label ?? "").match(/炸弹\s+[^\s]*?([3-9]|10|J|Q|K|A|2)/);
  return match?.[1] ?? null;
}

export function verdictLabel(verdict) {
  return VERDICT_LABELS[verdict] ?? "待观察";
}

/** 从复盘记录还原教纲检测所需的桌面上下文 */
export function buildDivergenceTableContext(record) {
  const hand = record?.handBefore ?? [];
  const levelRank = record?.levelRank ?? "2";
  const previousPlay = record?.mustBeat ?? record?.tableBefore?.lastActivePlay ?? null;
  const isOpening = !record?.mustBeat;
  let leadMode = "must-beat";
  if (isOpening) {
    const lastActive = record?.tableBefore?.lastActivePlayerIndex;
    const humanIndex = record?.playerIndex ?? 0;
    const teammateIdx = (humanIndex + 2) % 4;
    const seatPlays = record?.tableBefore?.seatPlays ?? [];
    const passesOnly = seatPlays.length > 0
      && seatPlays.every((seat) => !seat.play || seat.play.type === "Pass");
    if (
      lastActive === teammateIdx
      || passesOnly
      || (record?.handCount ?? 27) >= 20
    ) {
      leadMode = "catch-wind";
    } else {
      leadMode = "fresh-open";
    }
  }
  const candidates = (record?.choices ?? []).map((choice) => choice.play).filter(Boolean);
  return {
    previousPlay,
    isOpening,
    leadMode,
    opponentActive: Boolean(record?.mustBeat),
    hand,
    levelRank,
    _candidates: candidates,
    playerIndex: record?.playerIndex ?? 0,
    handCount: record?.handCount,
  };
}

/** 出牌对手牌结构的破坏程度（越高越差） */
function structureBreakSeverity(play, hand, levelRank, tableContext = {}) {
  if (!play || play.type === PLAY_TYPES.pass) return 0;
  if (play.type === PLAY_TYPES.single && play.mainRank) {
    return resolveStraightBreakForSingle(play.mainRank, hand, levelRank).breaksStraight ? 3 : 0;
  }
  if (play.type === PLAY_TYPES.tripleWithPair || play.type === PLAY_TYPES.triple) {
    return resolveStraightBreakForTripleWithPair(play, hand, levelRank).breaksStraight ? 4 : 0;
  }
  if (BOMB_TYPES.has(play.type)) {
    return breaksBombIntegrity(play, hand, levelRank, tableContext) ? 3 : 0;
  }
  return 0;
}

function fatalDoctrineViolations(violations) {
  return (violations ?? []).filter((item) => item.blockTop1 || item.blockTop3);
}

function doctrineNote(violations) {
  const fatal = fatalDoctrineViolations(violations);
  if (fatal.length === 0) return null;
  const codes = [...new Set(fatal.map((item) => item.code))].join("/");
  return `推荐1违反教纲（${codes}）：${fatal[0].summary}`;
}

/**
 * 教纲执法裁决：Top1 有 blockTop1 违规且用户出牌更保结构 → 你更对 / 教练不合理。
 */
export function adjudicateByDoctrine(record, recPlay, actPlay) {
  const hand = record?.handBefore;
  if (!hand?.length || !recPlay) return null;

  const levelRank = record?.levelRank ?? "2";
  const tableContext = buildDivergenceTableContext(record);
  const recViolations = detectDoctrineViolations(recPlay, hand, levelRank, tableContext);
  const actViolations = actPlay
    ? detectDoctrineViolations(actPlay, hand, levelRank, tableContext)
    : [];
  const recFatal = fatalDoctrineViolations(recViolations);
  const actFatal = fatalDoctrineViolations(actViolations);

  if (recFatal.length === 0) return null;

  const recBreak = structureBreakSeverity(recPlay, hand, levelRank, tableContext);
  const actBreak = structureBreakSeverity(actPlay, hand, levelRank, tableContext);
  const userPreservesStructure = actPlay
    && actPlay.type !== PLAY_TYPES.pass
    && (recBreak > actBreak || (recBreak > 0 && actBreak === 0));
  const userClearlyWorse = actFatal.length > 0 && actBreak >= recBreak;

  const doctrineCodes = [...new Set(recFatal.map((item) => item.code))];
  const base = {
    adjudication: ADJUDICATION_BY_VERDICT[DIVERGENCE_VERDICTS.COACH_QUESTIONABLE],
    coachQuestionable: true,
    doctrineViolations: recFatal,
    doctrineCodes,
    reason: doctrineNote(recViolations),
  };

  if (userClearlyWorse) {
    return {
      ...base,
      verdict: DIVERGENCE_VERDICTS.COACH_QUESTIONABLE,
      note: `${doctrineNote(recViolations)}；你此手也有结构代价，不宜简单认定`,
    };
  }

  if (userPreservesStructure || actFatal.length === 0) {
    return {
      ...base,
      verdict: DIVERGENCE_VERDICTS.USER_BETTER,
      adjudication: ADJUDICATION_BY_VERDICT[DIVERGENCE_VERDICTS.USER_BETTER],
      note: doctrineNote(recViolations) ?? "推荐1拆结构，你保留了成组牌型",
    };
  }

  return {
    ...base,
    verdict: DIVERGENCE_VERDICTS.COACH_QUESTIONABLE,
    note: doctrineNote(recViolations) ?? "推荐1存疑，需结合牌型结构再判断",
  };
}

function finalizeClassification(result) {
  const verdict = result.verdict ?? DIVERGENCE_VERDICTS.STYLE;
  return {
    ...result,
    verdict,
    adjudication: result.adjudication ?? ADJUDICATION_BY_VERDICT[verdict] ?? "style",
    coachQuestionable: result.coachQuestionable
      ?? (verdict === DIVERGENCE_VERDICTS.COACH_QUESTIONABLE
        || Boolean(result.doctrineViolations?.length)),
  };
}

/**
 * 启发式分类：供 UI 与 COACH-FIX-REQUEST 优先改「你更对」项。
 */
export function classifyDivergence(item, record = null) {
  const reasons = (item.recommendedReasons ?? []).join(" ");
  const mustBeat = item.mustBeat;
  const handCount = item.handCount ?? 99;
  const recPlay = record?.choices?.[0]?.play;
  const actPlay = record?.actualPlay;
  const recType = playTypeOf(recPlay);
  const actType = playTypeOf(actPlay);
  const actual = item.actual ?? labelOf(actPlay);
  const recommended = item.recommended ?? labelOf(recPlay);

  const doctrineVerdict = adjudicateByDoctrine(record, recPlay, actPlay);
  if (doctrineVerdict) {
    return finalizeClassification(doctrineVerdict);
  }

  if (/炸弹作废/.test(reasons) && actual === "过牌") {
    return { verdict: DIVERGENCE_VERDICTS.USER_BETTER, note: "不宜拆炸，过牌保留炸弹更合理" };
  }

  if (
    (actType === "Plane" || actType === "ConsecutivePairs")
    && recType === "TripleWithPair"
    && !mustBeat
  ) {
    return { verdict: DIVERGENCE_VERDICTS.USER_BETTER, note: "接风钢板一次减六张，优于小三带二" };
  }

  if (actType === "StraightFlush" && recType === "Pass" && mustBeat) {
    return { verdict: DIVERGENCE_VERDICTS.USER_BETTER, note: "对手已亮炸，有更大同花顺应抢权" };
  }

  if (
    actType === "Single"
    && (actual.includes("小王") || actual.includes("大王"))
    && (recType === "Pass" || recType === "StraightFlush")
    && mustBeat
    && handCount <= 8
  ) {
    return {
      verdict: DIVERGENCE_VERDICTS.USER_BETTER,
      note: "残局仅王+同花顺，先王夺权再一手走完更稳",
    };
  }

  if (actType === "Single" && recType === "TripleWithPair" && !mustBeat && handCount >= 10) {
    return {
      verdict: DIVERGENCE_VERDICTS.USER_BETTER,
      note: /大王|回收|送单/.test(reasons)
        ? "有大王时送单试探优于无回收三带二"
        : "手牌仍多，先小单试探更灵活",
    };
  }

  if (actType === "Pass" && mustBeat && recType === "Bomb") {
    const routineMustBeat = mustBeat && !/顺|连对|钢板|飞机|同花顺/.test(mustBeat);
    if (handCount >= 4 && handCount <= 8 && routineMustBeat
      && (/纯炸保留|对手余牌尚多|等关键控权|队友接风/.test(reasons)
        || (handCount >= 4 && handCount <= 6))) {
      return {
        verdict: DIVERGENCE_VERDICTS.USER_BETTER,
        note: "纯炸保留，对手余牌尚多，等关键控权/队友接风",
      };
    }
    return { verdict: DIVERGENCE_VERDICTS.COACH_BETTER, note: "只有炸弹能压时不应过牌" };
  }

  if (actType === "Pass" && mustBeat && (recType === "Pair" || recType === "Single")) {
    if (/保留对|待组三带二|三带二.*保留|可过牌保留结构/.test(reasons)) {
      return {
        verdict: DIVERGENCE_VERDICTS.USER_BETTER,
        note: "保留对子给三带二，过牌比拆对压牌更合理",
      };
    }
    if (/普通/.test(reasons) || recType === "Single" || recType === "Pair") {
      return { verdict: DIVERGENCE_VERDICTS.COACH_BETTER, note: "有普通牌可压时不应过牌" };
    }
    if (/不应随便过牌|不能轻易放行|优先用普通牌型抢回牌权/.test(reasons)) {
      return { verdict: DIVERGENCE_VERDICTS.COACH_BETTER, note: "对手占牌时应积极抢权" };
    }
  }

  if (
    actType === "TripleWithPair"
    && recType === "Triple"
    && !mustBeat
  ) {
    return {
      verdict: DIVERGENCE_VERDICTS.USER_BETTER,
      note: "接风三带二一次减五张，优于裸三张",
    };
  }

  if (actType === "Triple" && recType === "TripleWithPair" && !mustBeat) {
    return { verdict: DIVERGENCE_VERDICTS.STYLE, note: "接风减手路径不同" };
  }

  const levelRank = item.levelRank ?? record?.levelRank ?? "2";
  if (actType === "Bomb" && recType === "Bomb" && mustBeat) {
    const actRank = bombRankFromLabel(actual);
    const recRank = bombRankFromLabel(recommended);
    const pressingKing = /大王|小王/.test(mustBeat)
      || record?.mustBeat?.mainRank === "BJ"
      || record?.mustBeat?.mainRank === "SJ";
    if (actRank && recRank && compareRanks(actRank, recRank, levelRank) < 0 && pressingKing) {
      return { verdict: DIVERGENCE_VERDICTS.USER_BETTER, note: "压王用小炸够用，不宜动用更大炸" };
    }
  }

  if (
    actType !== "Pass"
    && recType === "Pass"
    && handCount === 1
    && mustBeat
  ) {
    return {
      verdict: DIVERGENCE_VERDICTS.USER_BETTER,
      note: "剩一张能走完，不必过牌让队友",
    };
  }

  if (
    actType === "Pair"
    && recType === "Pair"
    && !mustBeat
    && actPlay?.mainRank
    && recPlay?.mainRank
    && record?.handBefore?.length
  ) {
    const levelRank = item.levelRank ?? record?.levelRank ?? "2";
    const rankCounts = new Map();
    for (const card of record.handBefore) {
      if (card.rank === "SJ" || card.rank === "BJ") continue;
      rankCounts.set(card.rank, (rankCounts.get(card.rank) ?? 0) + 1);
    }
    for (const [tripleRank, count] of rankCounts.entries()) {
      if (count < 3) continue;
      const pairRanks = [...rankCounts.entries()]
        .filter(([, n]) => n === 2)
        .map(([r]) => r)
        .sort((a, b) => compareRanks(a, b, levelRank));
      if (pairRanks.length < 2) continue;
      const minCompanion = pairRanks.find((r) => r !== tripleRank);
      const higherOrphan = pairRanks.find(
        (r) => r !== tripleRank && compareRanks(r, minCompanion, levelRank) > 0,
      );
      if (
        higherOrphan
        && recPlay.mainRank === minCompanion
        && actPlay.mainRank === higherOrphan
      ) {
        return {
          verdict: DIVERGENCE_VERDICTS.USER_BETTER,
          note: `保留${tripleRank}带对${minCompanion}，接风出对${higherOrphan}抬高下家门槛更合理`,
        };
      }
    }
  }

  if (item.match?.startsWith("suggestion-") && item.match !== "suggestion-1") {
    if (actType === "TripleWithPair" && recType === "Triple" && !mustBeat) {
      return finalizeClassification({
        verdict: DIVERGENCE_VERDICTS.USER_BETTER,
        note: "接风三带二带对更稳，优于裸三张",
      });
    }
    const recheck = adjudicateByDoctrine(record, recPlay, actPlay);
    if (recheck?.coachQuestionable) {
      return finalizeClassification(recheck);
    }
    return finalizeClassification({
      verdict: DIVERGENCE_VERDICTS.COACH_BETTER,
      note: "你的选择仍在推荐2/推荐3，推荐1更稳",
    });
  }

  if (actType === "Straight" && recType === "Single" && !mustBeat) {
    const note = handCount <= 10
      ? "接风拆小炸组顺一次减五张，优于小单浪费牌权"
      : "接风顺子一次减多张，优于小单浪费牌权";
    return { verdict: DIVERGENCE_VERDICTS.USER_BETTER, note };
  }

  if (
    recType === "StraightFlush"
    && !mustBeat
    && (actType === "Pair" || actType === "Single")
    && handCount >= 12
    && record?.tableBefore?.seatPlays?.some(
      (seat) => seat.playerIndex === 0 && seat.play?.type === "Bomb",
    )
  ) {
    return {
      verdict: DIVERGENCE_VERDICTS.USER_BETTER,
      note: "刚炸夺权接风不宜空扔同花顺，先走对子/小单更合理",
    };
  }

  if (/逢人配/.test(actual) && !/逢人配/.test(recommended)) {
    return { verdict: DIVERGENCE_VERDICTS.COACH_BETTER, note: "逢人配宜留高价值牌型" };
  }

  if ((actual.includes("大王") || actual.includes("小王")) && recommended.includes("单张") && mustBeat) {
    if (record?.handBefore?.length && recPlay?.mainRank) {
      const levelRank = item.levelRank ?? record?.levelRank ?? "2";
      const rankCounts = new Map();
      for (const card of record.handBefore) {
        if (card.rank === "SJ" || card.rank === "BJ") continue;
        rankCounts.set(card.rank, (rankCounts.get(card.rank) ?? 0) + 1);
      }
      for (const [tripleRank, count] of rankCounts.entries()) {
        if (count < 3 || count >= 4) continue;
        const pairRanks = [...rankCounts.entries()]
          .filter(([, n]) => n === 2)
          .map(([r]) => r)
          .sort((a, b) => compareRanks(a, b, levelRank));
        const minCompanion = pairRanks.find((r) => r !== tripleRank);
        if (minCompanion && recPlay.mainRank === minCompanion) {
          return {
            verdict: DIVERGENCE_VERDICTS.USER_BETTER,
            note: `对${minCompanion}留给${tripleRank}三带二，拆对多剩散单，宜用王压单`,
          };
        }
      }
    }
    return { verdict: DIVERGENCE_VERDICTS.STYLE, note: "控权牌使用强度不同" };
  }

  return finalizeClassification({
    verdict: DIVERGENCE_VERDICTS.STYLE,
    note: "双方各有道理，需结合牌型结构再判断",
  });
}

export function isHumanDivergence(record, humanPlayerIndex = 0) {
  if (!isHumanReplayRecord(record, humanPlayerIndex)) return false;

  const top = record.choices?.[0]?.play;
  const actual = record.actualPlay;
  if (!actual) return false;
  if (!top) return record.actualChoiceMatch === "outside-top-3";
  return playSignature(top) !== playSignature(actual);
}

export function summarizeGameDivergences(timeline = [], humanPlayerIndex = 0) {
  const items = [];
  const verdictCounts = {
    [DIVERGENCE_VERDICTS.USER_BETTER]: 0,
    [DIVERGENCE_VERDICTS.COACH_BETTER]: 0,
    [DIVERGENCE_VERDICTS.STYLE]: 0,
    [DIVERGENCE_VERDICTS.COACH_QUESTIONABLE]: 0,
  };

  let top1MatchCount = 0;
  for (const record of timeline) {
    if (isHumanReplayRecord(record, humanPlayerIndex) && record.actualChoiceMatch === "suggestion-1") {
      top1MatchCount += 1;
    }
    if (!isHumanDivergence(record, humanPlayerIndex)) continue;
    const top = record.choices?.[0];
    const base = {
      turnNumber: record.turnNumber,
      match: record.actualChoiceMatch,
      source: record.source,
      mustBeat: record.mustBeat?.label ?? null,
      recommended: labelOf(top?.play),
      recommendedReasons: (top?.reasons ?? []).slice(0, 4),
      actual: labelOf(record.actualPlay),
      table: record.tableBefore ?? null,
      handCount: record.handCount,
      levelRank: record.levelRank,
    };
    const classification = classifyDivergence(base, record);
    verdictCounts[classification.verdict] += 1;
    items.push({
      ...base,
      verdict: classification.verdict,
      verdictLabel: verdictLabel(classification.verdict),
      verdictNote: classification.note,
      adjudication: classification.adjudication ?? ADJUDICATION_BY_VERDICT[classification.verdict],
      coachQuestionable: classification.coachQuestionable ?? false,
      doctrineCodes: classification.doctrineCodes ?? [],
      doctrineReason: classification.reason ?? null,
    });
  }

  const totalHands = timeline.filter((r) => isHumanReplayRecord(r, humanPlayerIndex)).length;
  return {
    totalHands,
    top1MatchCount,
    divergenceCount: items.length,
    divergences: items,
    verdictCounts,
    userBetterCount: verdictCounts[DIVERGENCE_VERDICTS.USER_BETTER],
    coachBetterCount: verdictCounts[DIVERGENCE_VERDICTS.COACH_BETTER],
    coachQuestionableCount: verdictCounts[DIVERGENCE_VERDICTS.COACH_QUESTIONABLE],
    styleCount: verdictCounts[DIVERGENCE_VERDICTS.STYLE],
  };
}
