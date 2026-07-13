/**
 * 队友已炸占牌：另一队友（勇哥）不应叠更大炸压毛蛋（P10，贴近真人配合）
 * 覆盖 tableContext 仅带 state.lastActivePlayerIndex 的路径（此前会误判须压对手炸）
 */
import { createCard, SUITS } from "../engine/card.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { createGameStateFromHands } from "../engine/game-state.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { playRecommendedTurn } from "../coach/robot-player.mjs";
import { buildFormalRobotPlayOptions } from "../simulation/opponent-persona.mjs";
import { computeRecommendations } from "../strategy/recommend.mjs";

const BOMB_TYPES = new Set([PLAY_TYPES.bomb, PLAY_TYPES.straightFlush, PLAY_TYPES.jokerBomb]);

const c = (rank, suit = SUITS.spades, deckIndex = 0) => createCard(rank, suit, deckIndex);
const levelRank = "2";

const partnerBomb = classifyPlay([
  c("6", SUITS.clubs),
  c("6", SUITS.diamonds),
  c("6", SUITS.diamonds, 1),
  c("6", SUITS.hearts),
], levelRank);

const yongHand = [
  c("7", SUITS.clubs),
  c("7", SUITS.diamonds),
  c("7", SUITS.diamonds, 1),
  c("2", SUITS.hearts),
  ...Array.from({ length: 23 }, (_, i) => c(
    ["3", "4", "5", "8", "9", "10", "J", "Q", "K", "A"][i % 10],
    [SUITS.clubs, SUITS.spades, SUITS.diamonds][i % 3],
    i,
  )),
];
const filler = Array.from({ length: 27 }, (_, i) => c("4", SUITS.clubs, i));

let state = createGameStateFromHands({
  levelRank,
  hands: [filler, yongHand, filler, filler],
  currentPlayerIndex: 1,
});
state = {
  ...state,
  lastActivePlay: partnerBomb,
  lastActivePlayerIndex: 3,
  playHistory: [
    { turnNumber: 1, playerIndex: 3, play: partnerBomb },
    { turnNumber: 2, playerIndex: 2, play: classifyPlay([], levelRank) },
  ],
};

// 仅 state 带占牌者：模拟评分链内 enrich 场景
const tableContext = {
  state,
  playerIndex: 1,
  previousPlay: partnerBomb,
  scoringAudience: "robot",
  lite: true,
  maxCandidates: 6,
  deadline: performance.now() + 8000,
  opponentPersona: { id: "yong", name: "勇哥", tempoWeight: 1.05, structureWeight: 0.95, bombWeight: 1.08 },
};

const { top } = computeRecommendations(yongHand, levelRank, partnerBomb, tableContext);
if (top?.candidate?.type !== PLAY_TYPES.pass && BOMB_TYPES.has(top?.candidate?.type)) {
  console.error(
    "FAIL: computeRecommendations 队友已炸应过牌，实际",
    top.candidate.type,
    top.candidate.mainRank,
    top.reasons?.slice(0, 4),
  );
  process.exit(1);
}

const turn = playRecommendedTurn(state, {
  ...buildFormalRobotPlayOptions(state, 1),
  deadline: performance.now() + 8000,
});
const played = turn.recommendation.candidate;
if (played.type !== PLAY_TYPES.pass && BOMB_TYPES.has(played.type)) {
  console.error(
    "FAIL: 勇哥不宜炸压队友毛蛋四6，实际",
    played.type,
    played.mainRank,
    turn.recommendation.reasons?.slice(0, 4),
  );
  process.exit(1);
}

console.log("PASS: 队友四6炸占牌 → 勇哥 Top1 = Pass");
