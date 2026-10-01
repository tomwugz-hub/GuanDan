import { playSignature } from "../engine/card.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { buildCompleteStructures, structuresBrokenByCandidate } from "../decision/structures.mjs";

export const VARIATION_TRAINING_SCHEMA_VERSION = 1;

const RESOURCE_TYPES = new Set([
  PLAY_TYPES.bomb,
  PLAY_TYPES.straightFlush,
  PLAY_TYPES.jokerBomb,
]);

function cardCount(play) {
  return play?.cards?.length ?? 0;
}

function labelOf(play) {
  if (!play || play.type === PLAY_TYPES.pass) return "过牌";
  return play.label ?? play.type ?? "出牌";
}

function normalizePlay(play, levelRank) {
  if (!play) return null;
  return classifyPlay(play.cards ?? [], levelRank);
}

function usesResource(play) {
  return RESOURCE_TYPES.has(play?.type);
}

function structureTypes(breaks) {
  return [...new Set(breaks.map((item) => item.type))];
}

function lessonFor({ baseline, alternative, baselineBreaks, alternativeBreaks }) {
  if (alternativeBreaks.length < baselineBreaks.length) {
    return {
      codes: ["PRESERVE_STRUCTURE"],
      text: "替代出牌少破坏一套已有牌型，先比较结构代价。",
    };
  }
  if (alternativeBreaks.length > baselineBreaks.length) {
    return {
      codes: ["STRUCTURE_COST"],
      text: "替代出牌会多破坏已有牌型，练习判断减手是否值得。",
    };
  }
  if (usesResource(baseline) && !usesResource(alternative)) {
    return {
      codes: ["PRESERVE_RESOURCE"],
      text: "替代出牌保留炸弹或同花顺资源，比较当前牌权是否值得消耗。",
    };
  }
  if (cardCount(alternative) < cardCount(baseline)) {
    return {
      codes: ["REDUCE_REMAINING_CARDS"],
      text: "替代出牌一次减少更多手牌，比较减手与后续牌权。",
    };
  }
  return {
    codes: ["TYPE_CHOICE"],
    text: "替代出牌属于同一局面的另一条合法路线，比较牌型与牌权。",
  };
}

function buildCard(record, baselineChoice, alternativeChoice, structures, alternativeIndex) {
  const levelRank = record.levelRank ?? "2";
  const hand = record.handBefore ?? [];
  const baseline = normalizePlay(baselineChoice.play, levelRank);
  const alternative = normalizePlay(alternativeChoice.play, levelRank);
  if (!baseline || !alternative) return null;
  if (playSignature(baseline) === playSignature(alternative)) return null;

  const baselineBreaks = structuresBrokenByCandidate(structures, baseline);
  const alternativeBreaks = structuresBrokenByCandidate(structures, alternative);
  const lesson = lessonFor({ baseline, alternative, baselineBreaks, alternativeBreaks });
  const actual = normalizePlay(record.actualPlay, levelRank);

  return {
    schemaVersion: VARIATION_TRAINING_SCHEMA_VERSION,
    id: `turn-${record.turnNumber ?? 0}-alt-${alternativeIndex}`,
    mode: "same-state-alternative",
    turnNumber: record.turnNumber ?? null,
    playerIndex: record.playerIndex ?? null,
    levelRank,
    mustBeat: record.mustBeat?.type === PLAY_TYPES.pass ? null : record.mustBeat?.label ?? record.mustBeat?.type ?? null,
    recommended: {
      signature: playSignature(baseline),
      type: baseline.type,
      mainRank: baseline.mainRank ?? null,
      label: labelOf(baselineChoice.play ?? baseline),
      cardCount: cardCount(baseline),
      remainingCardCount: hand.length - cardCount(baseline),
    },
    alternative: {
      signature: playSignature(alternative),
      type: alternative.type,
      mainRank: alternative.mainRank ?? null,
      label: labelOf(alternativeChoice.play ?? alternative),
      cardCount: cardCount(alternative),
      remainingCardCount: hand.length - cardCount(alternative),
    },
    deltaRemainingCardCount: cardCount(baseline) - cardCount(alternative),
    structure: {
      recommendedBreaks: structureTypes(baselineBreaks),
      alternativeBreaks: structureTypes(alternativeBreaks),
      recommendedBreakCount: baselineBreaks.length,
      alternativeBreakCount: alternativeBreaks.length,
    },
    resource: {
      recommendedUsesBombOrStraightFlush: usesResource(baseline),
      alternativeUsesBombOrStraightFlush: usesResource(alternative),
    },
    actual: actual ? {
      signature: playSignature(actual),
      label: labelOf(record.actualPlay ?? actual),
      matchesRecommended: playSignature(actual) === playSignature(baseline),
    } : null,
    lessonCodes: lesson.codes,
    lesson: lesson.text,
    prompt: `如果把推荐的${labelOf(baselineChoice.play ?? baseline)}改成${labelOf(alternativeChoice.play ?? alternative)}，会保留或牺牲什么？`,
  };
}

/** Build bounded, replayable counterfactual cards from a review timeline. */
export function buildVariationTrainingSet(
  timeline = [],
  { humanPlayerIndex = 0, maxCards = 24, maxPerTurn = 2 } = {},
) {
  if (!Array.isArray(timeline)) throw new TypeError("timeline must be an array");
  if (!Number.isInteger(maxCards) || maxCards < 1) throw new RangeError("maxCards must be positive");
  if (!Number.isInteger(maxPerTurn) || maxPerTurn < 1) throw new RangeError("maxPerTurn must be positive");

  const cards = [];
  for (const record of timeline) {
    if (record?.playerIndex !== humanPlayerIndex) continue;
    if (!Array.isArray(record.handBefore) || record.handBefore.length === 0) continue;
    const choices = Array.isArray(record.choices) ? record.choices : [];
    if (choices.length < 2) continue;
    const structures = buildCompleteStructures(record.handBefore, record.levelRank ?? "2");
    let added = 0;
    for (let index = 1; index < choices.length && added < maxPerTurn && cards.length < maxCards; index += 1) {
      const card = buildCard(record, choices[0], choices[index], structures, index);
      if (!card) continue;
      cards.push(card);
      added += 1;
    }
    if (cards.length >= maxCards) break;
  }

  return Object.freeze({
    schemaVersion: VARIATION_TRAINING_SCHEMA_VERSION,
    mode: "handbook-counterfactual-v1",
    cardCount: cards.length,
    cards: Object.freeze(cards),
  });
}

export function buildVariationTrainingMarkdown(training) {
  const cards = training?.cards ?? [];
  const lines = ["## 变式训练", ""];
  if (cards.length === 0) {
    lines.push("本局没有足够的备选牌生成变式训练。", "");
    return lines;
  }
  lines.push(`本局生成 ${cards.length} 张同局面变式卡：`, "");
  for (const card of cards) {
    lines.push(
      `### 第 ${card.turnNumber} 手 · ${card.lessonCodes.join("/")}`,
      `- **问题：** ${card.prompt}`,
      `- **推荐：** ${card.recommended.label}`,
      `- **变式：** ${card.alternative.label}`,
      `- **结构：** 推荐破坏 ${card.structure.recommendedBreakCount} 套，变式破坏 ${card.structure.alternativeBreakCount} 套`,
      `- **学习点：** ${card.lesson}`,
      "",
    );
  }
  return lines;
}
