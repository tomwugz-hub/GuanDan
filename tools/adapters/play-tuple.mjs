import { classifyPlay } from "../../engine/classify-play.mjs";
import { PLAY_TYPES } from "../../engine/play-types.mjs";
import { parseCardList } from "./card-codes.mjs";

const PATTERN_MAP = {
  PASS: PLAY_TYPES.pass,
  Single: PLAY_TYPES.single,
  Pair: PLAY_TYPES.pair,
  Trips: PLAY_TYPES.triple,
  ThreeWithTwo: PLAY_TYPES.tripleWithPair,
  ThreePair: PLAY_TYPES.consecutivePairs,
  TwoTrips: PLAY_TYPES.plane,
  Straight: PLAY_TYPES.straight,
  StraightFlush: PLAY_TYPES.straightFlush,
  Bomb: PLAY_TYPES.bomb,
  FourKings: PLAY_TYPES.jokerBomb,
};

export function tupleToPlay(tuple, levelRank) {
  if (!Array.isArray(tuple) || tuple.length < 3) {
    return classifyPlay([], levelRank);
  }
  const [pattern] = tuple;
  if (pattern === "PASS" || pattern === "pass") {
    return classifyPlay([], levelRank);
  }
  if (pattern === "tribute" || pattern === "back") {
    const cards = parseCardList(tuple[2]);
    return classifyPlay(cards, levelRank);
  }
  const cards = parseCardList(tuple[2]);
  const play = classifyPlay(cards, levelRank);
  if (play.type === PLAY_TYPES.invalid) {
    return {
      ...play,
      _importPattern: pattern,
      _importReason: play.reason,
    };
  }
  return play;
}

export function serializePlayForTraining(play, cardLabel, cardsLabel) {
  const type = play.type;
  const labels = {
    [PLAY_TYPES.pass]: "过牌",
    [PLAY_TYPES.single]: "单张",
    [PLAY_TYPES.pair]: "对子",
    [PLAY_TYPES.triple]: "三张",
    [PLAY_TYPES.tripleWithPair]: "三带二",
    [PLAY_TYPES.consecutivePairs]: "连对",
    [PLAY_TYPES.plane]: "钢板",
    [PLAY_TYPES.straight]: "顺子",
    [PLAY_TYPES.straightFlush]: "同花顺",
    [PLAY_TYPES.bomb]: "炸弹",
    [PLAY_TYPES.jokerBomb]: "天王炸",
  };
  return {
    type,
    mainRank: play.mainRank,
    length: play.length,
    label: type === PLAY_TYPES.pass ? "过牌" : `${labels[type] ?? type} ${cardsLabel(play.cards)}`,
    cards: play.cards.map((c) => ({
      rank: c.rank,
      suit: c.suit,
      deckIndex: c.deckIndex,
      label: cardLabel(c),
    })),
  };
}
