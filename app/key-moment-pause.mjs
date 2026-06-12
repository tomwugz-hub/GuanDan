import { PLAY_TYPES } from "../engine/play-types.mjs";
import { evaluateBombInventory, isTeammate } from "../strategy/table-context.mjs";

/** 关键时刻暂停场景类型（每局每类最多触发一次） */
export const KEY_PAUSE_TYPES = Object.freeze({
  OPPONENT_LOW_PRESS: "opponent-low-press",
  BOMB_TIMING: "bomb-timing",
  ENDGAME_SPRINT: "endgame-sprint",
  TRIBUTE_FIRST: "tribute-first",
});

/** 对手最少剩余张数（不含已出完与队友） */
function minOpponentHandCount(state, humanIndex) {
  let min = Infinity;
  for (const player of state.players) {
    if (player.finishedOrder) continue;
    if (player.seatIndex === humanIndex || isTeammate(humanIndex, player.seatIndex)) continue;
    min = Math.min(min, player.hand.length);
  }
  return min === Infinity ? 99 : min;
}

/** 是否需压对手出的牌（非队友、非过牌桌面） */
function mustBeatOpponent(state, humanIndex) {
  const play = state.lastActivePlay;
  if (!play || play.type === PLAY_TYPES.pass) return false;
  return !isTeammate(humanIndex, state.lastActivePlayerIndex);
}

/** 是否拥有牌权（可自由出牌） */
function hasInitiative(state) {
  return !state.lastActivePlay;
}

/**
 * 检测是否命中关键时刻暂停。
 * @param {object} state 牌局状态
 * @param {{ humanIndex?: number, gameMeta?: object, keyPauseFired?: Set<string> }} context
 * @returns {{ type: string, message: string } | null}
 */
export function detectKeyMoment(state, context = {}) {
  if (!state) return null;

  const humanIndex = context.humanIndex ?? 0;
  const gameMeta = context.gameMeta ?? null;
  const fired = context.keyPauseFired ?? new Set();

  if (state.currentPlayerIndex !== humanIndex) return null;

  const humanHand = state.players[humanIndex]?.hand?.length ?? 0;
  if (humanHand <= 0) return null;

  const oppMin = minOpponentHandCount(state, humanIndex);
  const beating = mustBeatOpponent(state, humanIndex);
  const initiative = hasInitiative(state);
  const bombInv = evaluateBombInventory(state.players[humanIndex].hand, state.levelRank);
  const hasBombs = bombInv.bombs > 0;

  const scenarios = [
    {
      type: KEY_PAUSE_TYPES.OPPONENT_LOW_PRESS,
      match: () => oppMin <= 2 && beating,
      message: () => (oppMin === 1
        ? "关键时刻：对手只剩1张，你怎么压？"
        : `关键时刻：对手只剩${oppMin}张，你怎么压？`),
    },
    {
      type: KEY_PAUSE_TYPES.BOMB_TIMING,
      match: () => hasBombs && (oppMin <= 5 || initiative),
      message: () => (initiative
        ? "关键时刻：手里有炸弹，现在有牌权——炸不炸？"
        : `关键时刻：手里有炸弹，对手剩${oppMin}张——现在炸吗？`),
    },
    {
      type: KEY_PAUSE_TYPES.ENDGAME_SPRINT,
      match: () => initiative && humanHand <= 12,
      message: () => `关键时刻：剩${humanHand}张进入残局，你先出哪手？`,
    },
    {
      type: KEY_PAUSE_TYPES.TRIBUTE_FIRST,
      match: () => {
        const hasTribute = (gameMeta?.tributeEvents?.length ?? 0) > 0;
        return hasTribute && initiative && (state.playHistory?.length ?? 0) === 0;
      },
      message: () => "关键时刻：进贡后第一手，你会怎么出？",
    },
  ];

  for (const scenario of scenarios) {
    if (fired.has(scenario.type)) continue;
    if (!scenario.match()) continue;
    return { type: scenario.type, message: scenario.message() };
  }

  return null;
}
