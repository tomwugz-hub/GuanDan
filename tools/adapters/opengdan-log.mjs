import { cardLabel, cardsLabel } from "../../engine/card.mjs";
import { createGameStateFromHands, isGameOver, playCards } from "../../engine/game-state.mjs";
import { PLAY_TYPES } from "../../engine/play-types.mjs";
import { getTurnAdvice } from "../../coach/turn-advice.mjs";
import { parseCardList } from "./card-codes.mjs";
import { serializePlayForTraining, tupleToPlay } from "./play-tuple.mjs";
import { SCHEMA_VERSION } from "../lib/replay-constants.mjs";

function normalizeMessages(input) {
  if (Array.isArray(input)) return input;
  if (input?.messages) return input.messages;
  return [];
}

function parseRankToken(token) {
  const text = String(token ?? "2").toUpperCase();
  if (text === "T") return "10";
  return text;
}

export function detectOpenGuanDanLog(messages) {
  return messages.some((msg) => {
    if (msg?.type === "notify" && msg?.stage) return true;
    if (msg?.type === "act" && msg?.stage) return true;
    if (msg?.type === "PLAY" && msg?.data) return true;
    return false;
  });
}

export function opengdanMessagesToGame(messages, { gameId = "opengdan-import" } = {}) {
  const list = normalizeMessages(messages);
  if (!detectOpenGuanDanLog(list)) return null;

  const initialHandsBySeat = {};
  let levelRank = "2";
  const playSteps = [];
  let finishedPlayers = [];
  let episodeMeta = null;
  const pendingActs = [];

  for (const msg of list) {
    if (msg.type === "notify" && msg.stage === "beginning") {
      const seat = msg.myPos;
      if (seat == null) continue;
      initialHandsBySeat[seat] = parseCardList(msg.handCards);
      if (msg.curRank) levelRank = parseRankToken(msg.curRank);
    }

    if (msg.type === "act" && msg.stage === "play") {
      if (msg.curRank) levelRank = parseRankToken(msg.curRank);
      pendingActs.push({ ...msg, receivedAt: playSteps.length });
    }

    if (msg.type === "PLAY" && msg.data?.act) {
      const seat = msg.data.player;
      const act = msg.data.act;
      const play = tupleToPlay(act, levelRank);
      const actMsg = pendingActs.pop();
      playSteps.push({ seat, play, actMsg, act });
    }

    if (msg.type === "notify" && msg.stage === "play" && msg.curPos != null && msg.curAction) {
      const seat = msg.curPos;
      const play = tupleToPlay(msg.curAction, levelRank);
      const duplicate = playSteps.at(-1);
      if (duplicate && duplicate.seat === seat && playSignature(duplicate.play) === playSignature(play)) {
        continue;
      }
      playSteps.push({ seat, play, actMsg: null, act: msg.curAction, fromNotify: true });
    }

    if (msg.type === "notify" && msg.stage === "episodeOver") {
      episodeMeta = msg;
      if (Array.isArray(msg.order)) {
        finishedPlayers = msg.order.map((playerIndex, order) => ({
          order: order + 1,
          playerIndex,
        }));
      }
      if (msg.curRank) levelRank = parseRankToken(msg.curRank);
    }
  }

  const seats = [0, 1, 2, 3];
  const missing = seats.filter((s) => !initialHandsBySeat[s]?.length);
  if (missing.length > 0) {
    return {
      error: `缺少座位发牌数据 beginning: ${missing.join(",")}。需合并四路客户端日志或完整服务端录屏 JSON。`,
      partial: { initialHandsBySeat, playSteps: playSteps.length },
    };
  }

  const hands = seats.map((seat) => initialHandsBySeat[seat]);
  let state = createGameStateFromHands({ levelRank, hands, currentPlayerIndex: 0 });
  const coachAdviceTimeline = [];

  for (const step of playSteps) {
    if (isGameOver(state)) break;
    while (state.currentPlayerIndex !== step.seat && !isGameOver(state)) {
      state = playCards(state, []);
    }
    if (isGameOver(state)) break;

    const advice = getTurnAdvice(state, step.seat, { alternatives: 12 });
    const choices = [advice.recommendation, ...(advice.alternatives ?? [])].slice(0, 12).map((item, index) => ({
      index: index + 1,
      score: Math.round(item.score),
      play: serializePlayForTraining(item.candidate, cardLabel, cardsLabel),
      reasons: item.reasons ?? [],
    }));

    const actualSerialized = serializePlayForTraining(step.play, cardLabel, cardsLabel);
    const sig = playSignature(step.play);
    const matched = choices.find((c) => playSignatureFromSerialized(c.play) === sig);

    coachAdviceTimeline.push({
      turnNumber: state.turnNumber,
      playerIndex: step.seat,
      playerName: `seat-${step.seat}`,
      source: "opengdan-import",
      levelRank,
      handCount: state.players[step.seat].hand.length,
      playersBefore: state.players.map((player, index) => ({
        playerIndex: index,
        playerName: `seat-${index}`,
        handCount: player.hand.length,
        finishedOrder: player.finishedOrder,
      })),
      tableBefore: {
        lastActivePlayerIndex: state.lastActivePlayerIndex,
        lastActivePlay: state.lastActivePlay
          ? serializePlayForTraining(state.lastActivePlay, cardLabel, cardsLabel)
          : null,
      },
      handBefore: state.players[step.seat].hand.map((c) => ({
        rank: c.rank,
        suit: c.suit,
        deckIndex: c.deckIndex,
        label: cardLabel(c),
      })),
      mustBeat: advice.mustBeat,
      handProfile: advice.handProfile,
      choices,
      actualPlay: actualSerialized,
      actualChoiceIndex: matched?.index ?? null,
      actualChoiceMatch: matched ? `suggestion-${matched.index}` : "outside-top-3",
      importMeta: {
        fromNotify: !!step.fromNotify,
        hasPlatformAct: !!step.actMsg,
      },
    });

    const cards = step.play.type === PLAY_TYPES.pass ? [] : step.play.cards;
    try {
      state = playCards(state, cards);
    } catch {
      break;
    }
  }

  return {
    gameId,
    seed: null,
    levelRank,
    status: isGameOver(state) ? "complete" : "import-partial",
    startedAt: new Date().toISOString(),
    source: "opengdan-ws-log",
    finishedPlayers,
    episodeMeta,
    initialHands: seats.map((seat) => ({
      playerIndex: seat,
      playerName: `seat-${seat}`,
      cards: initialHandsBySeat[seat].map((c) => ({
        rank: c.rank,
        suit: c.suit,
        deckIndex: c.deckIndex,
        label: cardLabel(c),
      })),
    })),
    coachAdviceTimeline,
    playHistory: coachAdviceTimeline.map((item) => ({
      turnNumber: item.turnNumber,
      playerIndex: item.playerIndex,
      playerName: item.playerName,
      play: item.actualPlay,
    })),
    importStats: {
      messageCount: list.length,
      playSteps: playSteps.length,
      timelineRecords: coachAdviceTimeline.length,
    },
  };
}

function playSignature(play) {
  if (!play || play.type === PLAY_TYPES.pass) return "Pass:";
  const ids = [...play.cards].map((c) => `${c.suit}${c.rank}#${c.deckIndex}`).sort().join("|");
  return `${play.type}:${ids}`;
}

function playSignatureFromSerialized(play) {
  if (!play || play.type === "Pass") return "Pass:";
  const ids = (play.cards ?? []).map((c) => `${c.suit}${c.rank}#${c.deckIndex ?? 0}`).sort().join("|");
  return `${play.type}:${ids}`;
}

export function opengdanLogToCanonicalReplay(messages, options = {}) {
  const game = opengdanMessagesToGame(messages, options);
  if (!game || game.error) return game;
  return {
    schemaVersion: SCHEMA_VERSION,
    gameId: game.gameId,
    seed: game.seed,
    levelRank: game.levelRank,
    status: game.status,
    startedAt: game.startedAt,
    finishedPlayers: game.finishedPlayers,
    initialHands: game.initialHands,
    actions: game.coachAdviceTimeline.map((item) => ({
      turnNumber: item.turnNumber,
      seat: item.playerIndex,
      playerName: item.playerName,
      source: item.source,
      tier: "silver",
      weight: 0.45,
      levelRank: item.levelRank,
      hand: item.handBefore,
      handCount: item.handCount,
      playersBefore: item.playersBefore,
      tableBefore: item.tableBefore,
      mustBeat: item.mustBeat,
      handProfile: item.handProfile,
      candidates: item.choices,
      label: {
        play: item.actualPlay,
        choiceIndex: item.actualChoiceIndex,
        match: item.actualChoiceMatch,
      },
    })),
    stats: game.importStats,
  };
}
