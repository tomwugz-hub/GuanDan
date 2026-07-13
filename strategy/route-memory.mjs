/**
 * 牌路状态机（架构 v3）— T8/T10/T11 雏形
 * 追踪本局各座位已打出的牌路类型与归属，供 recommend / partner-inference 使用。
 */
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { isTeammate, teammateIndex } from "./seat-utils.mjs";

/** 七种武器 + 炸类（书中 T8 简化标签） */
export const ROUTE_TYPES = Object.freeze([
  PLAY_TYPES.single,
  PLAY_TYPES.pair,
  PLAY_TYPES.tripleWithPair,
  PLAY_TYPES.straight,
  PLAY_TYPES.consecutivePairs,
  PLAY_TYPES.plane,
  PLAY_TYPES.bomb,
  PLAY_TYPES.straightFlush,
  PLAY_TYPES.jokerBomb,
]);

const BOMB_TYPES = new Set([PLAY_TYPES.bomb, PLAY_TYPES.straightFlush, PLAY_TYPES.jokerBomb]);

function normalizeRouteType(play) {
  if (!play || play.type === PLAY_TYPES.pass) return null;
  if (BOMB_TYPES.has(play.type) || (play.bombSize ?? 0) >= 4) {
    if (play.type === PLAY_TYPES.straightFlush) return PLAY_TYPES.straightFlush;
    if (play.type === PLAY_TYPES.jokerBomb) return PLAY_TYPES.jokerBomb;
    return PLAY_TYPES.bomb;
  }
  return ROUTE_TYPES.includes(play.type) ? play.type : null;
}

function emptySeatRoutes() {
  return {
    counts: Object.fromEntries(ROUTE_TYPES.map((t) => [t, 0])),
    openings: [],
    wins: [],
    lastPlay: null,
  };
}

/**
 * 从 playHistory 构建各座位牌路记忆。
 * @param {object} state 游戏状态
 * @returns {Map<number, object>} seatIndex → 牌路统计
 */
export function buildRouteMemory(state) {
  const memory = new Map();
  for (let i = 0; i < 4; i += 1) memory.set(i, emptySeatRoutes());

  const history = state?.playHistory ?? [];
  let trickLeader = null;
  let trickLeaderRoute = null;
  let passStreak = 0;

  for (let hi = 0; hi < history.length; hi += 1) {
    const entry = history[hi];
    const play = entry.play;
    const seat = entry.playerIndex;
    const routeType = normalizeRouteType(play);

    if (!play || play.type === PLAY_TYPES.pass) {
      passStreak += 1;
      if (passStreak >= 3 && trickLeader != null) {
        const winner = memory.get(trickLeader);
        if (winner && trickLeaderRoute) {
          winner.wins.push({ type: trickLeaderRoute, at: hi });
        }
        trickLeader = null;
        trickLeaderRoute = null;
      }
      continue;
    }

    passStreak = 0;
    const seatMem = memory.get(seat) ?? emptySeatRoutes();
    if (routeType) {
      seatMem.counts[routeType] = (seatMem.counts[routeType] ?? 0) + 1;
      if (seatMem.openings.length === 0 || seatMem.openings.every((o) => o.type !== routeType)) {
        seatMem.openings.push({ type: routeType, mainRank: play.mainRank ?? null });
      }
      seatMem.lastPlay = { type: routeType, mainRank: play.mainRank ?? null, power: play.power ?? 0 };
      memory.set(seat, seatMem);
    }

    if (trickLeader == null) {
      trickLeader = seat;
      trickLeaderRoute = routeType;
    }
  }

  return memory;
}

/** 某座位最常走的牌路（次数最多） */
export function dominantRoute(seatMemory) {
  if (!seatMemory?.counts) return null;
  let best = null;
  let bestCount = 0;
  for (const [type, count] of Object.entries(seatMemory.counts)) {
    if (count > bestCount) {
      bestCount = count;
      best = type;
    }
  }
  return bestCount > 0 ? { type: best, count: bestCount } : null;
}

/** T10 谁打谁收：本局该座位赢墩对应的牌路类型 */
export function routeOwnership(seatMemory) {
  const owned = new Set((seatMemory?.wins ?? []).map((w) => w.type));
  return [...owned];
}

/**
 * 导出供 recommend 使用的牌路上下文。
 */
export function getRouteContext(state, playerIndex = 0) {
  const memory = buildRouteMemory(state);
  const self = memory.get(playerIndex) ?? emptySeatRoutes();
  const partner = memory.get(teammateIndex(playerIndex)) ?? emptySeatRoutes();
  const opponents = [];
  for (let i = 0; i < 4; i += 1) {
    if (i === playerIndex || isTeammate(playerIndex, i)) continue;
    opponents.push({ seatIndex: i, ...memory.get(i) });
  }

  const partnerDominant = dominantRoute(partner);
  const selfDominant = dominantRoute(self);
  const opponentDominants = opponents
    .map((o) => ({ seatIndex: o.seatIndex, dominant: dominantRoute(o) }))
    .filter((o) => o.dominant);

  // T11 放一家：对手中牌路最弱（出牌次数最少）的座位
  const weakestOpponent = opponents
    .map((o) => ({
      seatIndex: o.seatIndex,
      totalPlays: Object.values(o.counts ?? {}).reduce((s, c) => s + c, 0),
    }))
    .sort((a, b) => a.totalPlays - b.totalPlays)[0] ?? null;

  return {
    memory,
    self,
    partner,
    opponents,
    partnerDominant,
    selfDominant,
    opponentDominants,
    partnerOwnership: routeOwnership(partner),
    selfOwnership: routeOwnership(self),
    weakestOpponentSeat: weakestOpponent?.seatIndex ?? null,
    /** 队友是否已展示强路（对子/三带二/连对 ≥2 次） */
    partnerStrongRoute: partnerDominant
      && [PLAY_TYPES.pair, PLAY_TYPES.tripleWithPair, PLAY_TYPES.consecutivePairs].includes(partnerDominant.type)
      && partnerDominant.count >= 2,
  };
}
