import { playCards } from "../engine/game-state.mjs";
import { evaluateHandProfile } from "../strategy/hand-profile.mjs";
import { recommendPlay } from "../strategy/recommend.mjs";
import { resolveMlModel } from "../strategy/ml-policy.mjs";
import { buildStrategicGroups } from "../strategy/strategic-groups.mjs";

export function playRecommendedTurn(state, {
  mlModel = undefined,
  mlFusionMode = "smart",
  preferredGroups: preferredGroupsInput,
  lite = false,
} = {}) {
  const player = state.players[state.currentPlayerIndex];
  const preferredGroups = lite
    ? (preferredGroupsInput ?? [])
    : (preferredGroupsInput ?? buildStrategicGroups(player.hand, state.levelRank));
  const handProfile = lite
    ? null
    : evaluateHandProfile(player.hand, state.levelRank, { preferredGroups });
  const tableContext = {
    state,
    playerIndex: state.currentPlayerIndex,
    lastActivePlayerIndex: state.lastActivePlayerIndex,
    preferredGroups,
    handProfile,
    previousPlay: state.lastActivePlay,
    maxCandidates: lite ? 3 : 96,
    scoringAudience: lite ? "robot" : "human",
    lite,
  };
  if (mlModel !== undefined) tableContext.mlModel = resolveMlModel(mlModel);
  tableContext.mlFusionMode = mlFusionMode;
  const recommendation = recommendPlay(player.hand, state.levelRank, state.lastActivePlay, tableContext);

  return {
    state: playCards(state, recommendation.candidate.cards),
    recommendation,
  };
}
