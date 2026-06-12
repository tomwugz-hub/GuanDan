import { PLAY_TYPES } from "../engine/play-types.mjs";

/** 有牌权时的出牌场景（接风与真开局区分） */
export function inferLeadMode(state, playerIndex) {
  if (!state) return "unknown";
  if (state.lastActivePlay && state.lastActivePlay.type !== PLAY_TYPES.pass) {
    return "must-beat";
  }

  const history = state.playHistory ?? [];
  if (history.length === 0) return "fresh-open";

  let lastSubstantiveIndex = -1;
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const play = history[i].play;
    if (play && play.type !== PLAY_TYPES.pass) {
      lastSubstantiveIndex = i;
      break;
    }
  }
  if (lastSubstantiveIndex < 0) return "fresh-open";

  const lastSubstantive = history[lastSubstantiveIndex];
  if (lastSubstantive.playerIndex !== playerIndex) return "fresh-open";

  let passCount = 0;
  for (let i = lastSubstantiveIndex + 1; i < history.length; i += 1) {
    if (history[i].play?.type === PLAY_TYPES.pass) passCount += 1;
  }

  const activeOpponents = state.players.filter(
    (player, index) => index !== playerIndex && !player.finishedOrder,
  ).length - 1;
  const neededPasses = Math.max(1, Math.min(3, activeOpponents));

  if (passCount >= neededPasses) return "catch-wind";
  return "fresh-open";
}

const BOMB_WIN_TYPES = new Set([
  PLAY_TYPES.bomb,
  PLAY_TYPES.straightFlush,
  PLAY_TYPES.jokerBomb,
]);

/** 本轮最后一手实牌是否由自己用炸（含同花顺/王炸）夺权 */
export function playerJustWonTrickWithBomb(state, playerIndex) {
  const history = state?.playHistory ?? [];
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const entry = history[i];
    const play = entry?.play;
    if (!play || play.type === PLAY_TYPES.pass || play.isPass) continue;
    if (entry.playerIndex !== playerIndex) return false;
    return BOMB_WIN_TYPES.has(play.type) || (play.bombSize ?? 0) >= 4;
  }
  return false;
}

/** 接风前一手是否为自己打出的四炸（不含五炸/同花顺/王炸）夺权 */
export function playerJustWonTrickWithPlainFourBomb(state, playerIndex) {
  const history = state?.playHistory ?? [];
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const entry = history[i];
    const play = entry?.play;
    if (!play || play.type === PLAY_TYPES.pass || play.isPass) continue;
    if (entry.playerIndex !== playerIndex) return false;
    if (play.type !== PLAY_TYPES.bomb) return false;
    const size = play.bombSize ?? play.cards?.length ?? 0;
    return size === 4;
  }
  return false;
}
