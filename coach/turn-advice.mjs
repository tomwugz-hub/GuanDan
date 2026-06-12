import { cardLabel, cardsLabel } from "../engine/card.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { evaluateHandProfile } from "../strategy/hand-profile.mjs";
import { computeRecommendations } from "../strategy/recommend.mjs";
import { buildStrategicGroups } from "../strategy/strategic-groups.mjs";

function describePlay(play) {
  const assignments = play.wildcardAssignments ?? [];
  const wildLabel = assignments.length === 0
    ? ""
    : `（${assignments.map((a) => `${cardLabel(a.from)}配${cardLabel(a.as)}`).join("，")}）`;
  return {
    type: play.type,
    mainRank: play.mainRank,
    length: play.length,
    cards: play.cards,
    label: `${cardsLabel(play.cards)}${wildLabel}`,
  };
}

export function getTurnAdvice(state, playerIndex = state.currentPlayerIndex, {
  alternatives = 3,
  preferredGroups = [],
  mlModel = null,
  mlFusionMode = "smart",
  maxCandidates = null,
  handProfile: handProfileInput = null,
  lite = false,
} = {}) {
  const player = state.players[playerIndex];
  const resolvedGroups = preferredGroups.length > 0
    ? preferredGroups
    : buildStrategicGroups(player.hand, state.levelRank);
  const handProfile = handProfileInput
    ?? evaluateHandProfile(player.hand, state.levelRank, { preferredGroups: resolvedGroups });

  const { top, pool } = computeRecommendations(
    player.hand,
    state.levelRank,
    state.lastActivePlay,
    {
      state,
      playerIndex,
      lastActivePlayerIndex: state.lastActivePlayerIndex,
      preferredGroups: resolvedGroups,
      handProfile,
      previousPlay: state.lastActivePlay,
      maxCandidates,
      mlModel,
      mlFusionMode,
      lite,
    },
  );

  const recommendation = top ?? {
    candidate: classifyPlay([], state.levelRank),
    score: 0,
    reasons: ["没有可压过上一手的合法出牌"],
    doctrineViolations: [],
  };

  return {
    playerIndex,
    levelRank: state.levelRank,
    handProfile,
    mustBeat: state.lastActivePlay ? describePlay(state.lastActivePlay) : null,
    recommendation: { ...recommendation, candidate: describePlay(recommendation.candidate) },
    alternatives: pool.slice(0, alternatives).map((item) => ({
      ...item,
      candidate: describePlay(item.candidate),
    })),
    canPlay: recommendation.candidate.type !== PLAY_TYPES.pass,
    doctrineViolations: recommendation.doctrineViolations ?? [],
  };
}
