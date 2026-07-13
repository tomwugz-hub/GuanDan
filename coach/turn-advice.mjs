import { cardLabel, cardsLabel, resolvePlayCardsFromHand } from "../engine/card.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { effectivePreviousPlay } from "../engine/game-state.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { evaluateHandProfile } from "../strategy/hand-profile.mjs";
import { computeRecommendations } from "../strategy/recommend.mjs";
import { buildStrategicGroups } from "../strategy/strategic-groups.mjs";

function describePlay(play, hand = null) {
  const cards = hand ? resolvePlayCardsFromHand(hand, play) : (play.cards ?? []);
  const assignments = play.wildcardAssignments ?? [];
  const wildLabel = assignments.length === 0
    ? ""
    : `（${assignments.map((a) => `${cardLabel(a.from)}配${cardLabel(a.as)}`).join("，")}）`;
  return {
    type: play.type,
    mainRank: play.mainRank,
    length: play.length,
    cards,
    wildcardAssignments: assignments,
    label: cards.length > 0 ? `${cardsLabel(cards)}${wildLabel}` : `${cardsLabel(play.cards ?? [])}${wildLabel}`,
  };
}

export function getTurnAdvice(state, playerIndex = state.currentPlayerIndex, {
  alternatives = 3,
  preferredGroups,
  mlModel = null,
  mlFusionMode = "smart",
  maxCandidates = null,
  handProfile: handProfileInput,
  lite = false,
  deadline = null,
  scoringAudience = null,
  abortCheck = null,
} = {}) {
  const player = state.players[playerIndex];
  const previousPlay = effectivePreviousPlay(state);
  const groupsProvided = preferredGroups !== undefined;
  const resolvedGroups = groupsProvided
    ? preferredGroups
    : (lite || scoringAudience === "human-lite" || scoringAudience === "robot"
      ? []
      : buildStrategicGroups(player.hand, state.levelRank));
  const handProfile = handProfileInput !== undefined
    ? handProfileInput
    : (lite || scoringAudience === "robot"
      ? null
      : evaluateHandProfile(player.hand, state.levelRank, { preferredGroups: resolvedGroups }));

  const { top, pool } = computeRecommendations(
    player.hand,
    state.levelRank,
    previousPlay,
    {
      state,
      playerIndex,
      lastActivePlayerIndex: state.lastActivePlayerIndex,
      preferredGroups: resolvedGroups,
      handProfile,
      previousPlay,
      maxCandidates,
      mlModel,
      mlFusionMode,
      lite,
      deadline,
      scoringAudience,
      abortCheck,
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
    mustBeat: previousPlay ? describePlay(previousPlay) : null,
    recommendation: { ...recommendation, candidate: describePlay(recommendation.candidate, player.hand) },
    alternatives: pool.slice(0, alternatives).map((item) => ({
      ...item,
      candidate: describePlay(item.candidate, player.hand),
    })),
    canPlay: recommendation.candidate.type !== PLAY_TYPES.pass,
    doctrineViolations: recommendation.doctrineViolations ?? [],
  };
}
