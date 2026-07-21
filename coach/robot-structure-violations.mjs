/**
 * 机器人出牌结构违规检测（拆炸、拆三带二、裸三张等）
 * 供 audit-strategy、auto-discover、局后 timeline 扫描共用。
 */
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { detectHardInvariantCodes } from "../strategy/hard-invariants.mjs";
import {
  breaksPreferredStrategicGroup,
  solePairForTripleRank,
} from "../strategy/principles.mjs";
import { buildStrategicGroups } from "../strategy/strategic-groups.mjs";
import { inferLeadMode } from "../strategy/lead-mode.mjs";

/** 将 timeline / 引擎 play 归一化为 classifyPlay 结果 */
export function normalizePlayForAudit(play, levelRank = "2") {
  if (!play) return null;
  const cards = (play.cards ?? []).map((card) => ({
    rank: card.rank,
    suit: card.suit,
    deckIndex: card.deckIndex ?? 0,
  }));
  if (!cards.length || play.type === PLAY_TYPES.pass || play.type === "Pass") {
    return classifyPlay([], levelRank);
  }
  return classifyPlay(cards, levelRank);
}

/** 将 timeline hand 归一化为引擎 Card */
export function normalizeHandForAudit(hand) {
  return (hand ?? []).map((card) => ({
    rank: card.rank,
    suit: card.suit,
    deckIndex: card.deckIndex ?? 0,
  }));
}

/**
 * 审计一手机器人出牌是否违反「真人感结构」。
 * @returns {{ code: string, detail: string }[]}
 */
export function auditRobotStructurePlay({
  play,
  hand,
  levelRank,
  state = null,
  playerIndex = null,
  mustBeat = null,
  tableBefore = null,
}) {
  const issues = [];
  const candidate = normalizePlayForAudit(play, levelRank);
  const resolvedHand = normalizeHandForAudit(hand);
  if (!candidate || candidate.type === PLAY_TYPES.pass || !resolvedHand.length) {
    return issues;
  }

  const seat = playerIndex ?? state?.currentPlayerIndex ?? 0;
  const previousPlay = mustBeat
    ? normalizePlayForAudit(mustBeat, levelRank)
    : (state?.lastActivePlay ?? null);
  const isOpening = !previousPlay || previousPlay.type === PLAY_TYPES.pass;
  const leadMode = isOpening && state
    ? inferLeadMode(state, seat)
    : (isOpening ? "catch-wind" : "must-beat");
  const tableContext = {
    isOpening,
    leadMode,
    hand: resolvedHand,
    playerIndex: seat,
    previousPlay,
    state,
    tableBefore,
    lastActivePlayerIndex: state?.lastActivePlayerIndex ?? tableBefore?.lastActivePlayerIndex,
  };
  const preferredGroups = buildStrategicGroups(resolvedHand, levelRank, { skipStraightFlush: true });

  const hardDetails = {
    "beat-partner": "反压对家队友占牌",
    "twp-level-kicker": "三带二使用级牌对作带牌",
    "split-bomb": "拆炸出牌",
  };
  for (const code of detectHardInvariantCodes(candidate, resolvedHand, levelRank, tableContext)) {
    issues.push({ code, detail: hardDetails[code] });
  }

  if (isOpening && leadMode !== "must-beat" && resolvedHand.length <= 12) {
    const hasTwp = (state?._candidates ?? []).some((item) => item.type === PLAY_TYPES.tripleWithPair)
      || preferredGroups.some((group) => group.play?.type === PLAY_TYPES.tripleWithPair);

    if (
      candidate.type === PLAY_TYPES.single
      && breaksPreferredStrategicGroup(candidate, preferredGroups, levelRank, resolvedHand, tableContext)
    ) {
      issues.push({
        code: "split-structure-single",
        detail: `接风/领出拆结构出单${candidate.mainRank ?? ""}`,
      });
    }

    if (
      candidate.type === PLAY_TYPES.triple
      && solePairForTripleRank(resolvedHand, levelRank, candidate.mainRank)
    ) {
      issues.push({
        code: "bare-triple-with-pair",
        detail: `有对可配却裸出三张${candidate.mainRank ?? ""}`,
      });
    }

    if (
      candidate.type === PLAY_TYPES.single
      && solePairForTripleRank(resolvedHand, levelRank, candidate.mainRank)
      && hasTwp
    ) {
      issues.push({
        code: "split-twp-single",
        detail: `三带二可一次减五张，却拆单${candidate.mainRank ?? ""}`,
      });
    }
  }

  return issues;
}

/** 扫描 coachAdviceTimeline，找出机器人结构违规 */
export function scanTimelineRobotStructureViolations(timeline, levelRank = "2") {
  const violations = [];
  for (const record of timeline ?? []) {
    if (String(record.source ?? "") !== "robot-auto") continue;
    const hand = record.handBefore ?? record.hand ?? null;
    const play = record.actualPlay ?? record.choices?.[0]?.play ?? null;
    if (!hand?.length || !play) continue;

    const issues = auditRobotStructurePlay({
      play,
      hand,
      levelRank: record.levelRank ?? levelRank,
      mustBeat: record.mustBeat ?? null,
      playerIndex: record.playerIndex,
      tableBefore: record.tableBefore ?? null,
    });
    for (const issue of issues) {
      violations.push({
        ...issue,
        turnNumber: record.turnNumber,
        playerIndex: record.playerIndex,
        playerName: record.playerName ?? `seat-${record.playerIndex}`,
        playLabel: play.label ?? play.type,
        handCount: record.handCount ?? hand.length,
      });
    }
  }
  return violations;
}
