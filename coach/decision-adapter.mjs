import { cardLabel, cardsLabel, resolvePlayCardsFromHand } from "../engine/card.mjs";
import { effectivePreviousPlay } from "../engine/game-state.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { decide, renderDecisionExplanation } from "../decision/index.mjs";

function describePlay(play, hand, { bindToHand = true } = {}) {
  if (!play) return null;
  const cards = bindToHand
    ? resolvePlayCardsFromHand(hand, play)
    : (play.cards ?? []);
  const wildcardAssignments = play.wildcardAssignments ?? [];
  const wildcardLabel = wildcardAssignments.length === 0
    ? ""
    : `（${wildcardAssignments.map((item) => (
      `${cardLabel(item.from)}配${cardLabel(item.as)}`
    )).join("，")}）`;
  return {
    ...play,
    cards,
    label: cards.length > 0 ? `${cardsLabel(cards)}${wildcardLabel}` : "过牌",
  };
}

function explanationReasons(explanation) {
  const detailed = explanation?.detailed ?? [];
  if (detailed.length > 0) return detailed;
  return explanation?.short ?? [];
}

export function adaptDecisionResult(state, playerIndex, result, { alternatives = 3 } = {}) {
  const hand = state.players[playerIndex]?.hand ?? [];
  const previousPlay = effectivePreviousPlay(state);
  const base = {
    status: result.status,
    playerIndex,
    levelRank: state.levelRank,
    handProfile: null,
    mustBeat: describePlay(previousPlay, hand, { bindToHand: false }),
    decisionSignature: result.signature,
    evidence: result.evidence,
    skillTags: result.skillTags,
    diagnostics: result.diagnostics,
    rejectedByInvariant: result.rejectedByInvariant,
    error: result.error,
  };
  if (result.status !== "ok") {
    return {
      ...base,
      recommendation: null,
      alternatives: [],
      canPlay: false,
      doctrineViolations: [],
    };
  }

  return {
    ...base,
    recommendation: {
      candidate: describePlay(result.top1, hand),
      score: null,
      reasons: explanationReasons(result.explanation),
      evidence: result.evidence,
      doctrineViolations: [],
    },
    alternatives: result.alternatives.slice(0, alternatives).map((item) => {
      const explanation = renderDecisionExplanation(item.evidence);
      return {
        candidate: describePlay(item.candidate, hand),
        score: null,
        reasons: explanationReasons(explanation),
        evidence: item.evidence,
        rankTuple: item.rankTuple,
      };
    }),
    canPlay: result.top1.type !== PLAY_TYPES.pass,
    doctrineViolations: [],
  };
}

export function getUnifiedTurnAdvice(state, playerIndex = state.currentPlayerIndex, options = {}) {
  return adaptDecisionResult(
    state,
    playerIndex,
    decide({ state, playerIndex }),
    options,
  );
}
