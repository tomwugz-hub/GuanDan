import { cardLabel, cardsLabel } from "../../engine/card.mjs";
import { createGameStateFromHands, isGameOver, playCards } from "../../engine/game-state.mjs";
import { PLAY_TYPES } from "../../engine/play-types.mjs";
import { getTurnAdvice } from "../../coach/turn-advice.mjs";
import { parseLegacyGdCard } from "./card-codes.mjs";
import { classifyPlay } from "../../engine/classify-play.mjs";
import { serializePlayForTraining } from "./play-tuple.mjs";
import { SCHEMA_VERSION } from "../lib/replay-constants.mjs";

/** 旧版 23456 WebSocket 协议（id 字段消息），见 ai-guandan 文档 */

export function detectLegacyGdWs(messages) {
  return messages.some((msg) => typeof msg.id === "number" && (msg.data != null || msg.code != null));
}

function locationToSeat(location) {
  const seat = Number(location) - 1;
  return seat >= 0 && seat <= 3 ? seat : null;
}

export function legacyGdMessagesToGame(messages, { gameId = "legacy-gd-import" } = {}) {
  const list = Array.isArray(messages) ? messages : [];
  if (!detectLegacyGdWs(list)) return null;

  const initialHandsBySeat = {};
  let levelRank = "2";
  const playSteps = [];

  for (const msg of list) {
    if (msg.id === 22 && msg.code === 200 && msg.data?.cards) {
      const seat = locationToSeat(msg.data?.user_info?.location ?? msg.data?.location);
      if (seat == null) continue;
      const cards = [];
      const used = new Map();
      for (const raw of msg.data.cards) {
        const key = `${raw.id ?? raw.name}`;
        const deckIndex = used.get(key) ?? 0;
        used.set(key, deckIndex + 1);
        const card = parseLegacyGdCard(raw, deckIndex);
        if (card) cards.push(card);
      }
      initialHandsBySeat[seat] = cards;
      if (msg.data.l_card_number) levelRank = String(msg.data.l_card_number).toUpperCase();
    }

    if (msg.id === 34 && msg.code === 200 && msg.data?.cards) {
      const seat = locationToSeat(msg.data.user_info?.location);
      if (seat == null) continue;
      const cards = [];
      const used = new Map();
      for (const raw of msg.data.cards) {
        const key = `${raw.id ?? raw.name}`;
        const deckIndex = used.get(key) ?? 0;
        used.set(key, deckIndex + 1);
        const card = parseLegacyGdCard(raw, deckIndex);
        if (card) cards.push(card);
      }
      const play = classifyPlay(cards, levelRank);
      playSteps.push({ seat, play });
    }

    if (msg.id === 38 && msg.data?.ranking_infos) {
      // episode end — stored in meta
    }
  }

  const seats = [0, 1, 2, 3];
  const missing = seats.filter((s) => !initialHandsBySeat[s]?.length);
  if (missing.length > 0) {
    return {
      error: `旧协议日志缺少 id:22 发牌（座位 ${missing.join(",")}）。需四个客户端各一份发牌消息或合并日志。`,
    };
  }

  let state = createGameStateFromHands({
    levelRank,
    hands: seats.map((s) => initialHandsBySeat[s]),
  });
  const coachAdviceTimeline = [];

  for (const step of playSteps) {
    if (isGameOver(state)) break;
    while (state.currentPlayerIndex !== step.seat && !isGameOver(state)) {
      state = playCards(state, []);
    }
    const advice = getTurnAdvice(state, step.seat, { alternatives: 12 });
    const choices = [advice.recommendation, ...(advice.alternatives ?? [])].slice(0, 12).map((item, index) => ({
      index: index + 1,
      score: Math.round(item.score),
      play: serializePlayForTraining(item.candidate, cardLabel, cardsLabel),
      reasons: item.reasons ?? [],
    }));
    const actualSerialized = serializePlayForTraining(step.play, cardLabel, cardsLabel);
    coachAdviceTimeline.push({
      turnNumber: state.turnNumber,
      playerIndex: step.seat,
      playerName: `seat-${step.seat}`,
      source: "legacy-gd-import",
      levelRank,
      handCount: state.players[step.seat].hand.length,
      playersBefore: state.players.map((player, index) => ({
        playerIndex: index,
        handCount: player.hand.length,
        finishedOrder: player.finishedOrder,
      })),
      handBefore: state.players[step.seat].hand.map((c) => ({
        rank: c.rank,
        suit: c.suit,
        deckIndex: c.deckIndex,
        label: cardLabel(c),
      })),
      choices,
      actualPlay: actualSerialized,
      actualChoiceMatch: "imported",
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
    levelRank,
    status: isGameOver(state) ? "complete" : "import-partial",
    source: "legacy-gd-ws-log",
    initialHands: seats.map((seat) => ({
      playerIndex: seat,
      cards: initialHandsBySeat[seat].map((c) => ({
        rank: c.rank,
        suit: c.suit,
        deckIndex: c.deckIndex,
        label: cardLabel(c),
      })),
    })),
    coachAdviceTimeline,
    importStats: { messageCount: list.length, playSteps: playSteps.length },
  };
}

export function legacyGdLogToCanonicalReplay(messages, options = {}) {
  const game = legacyGdMessagesToGame(messages, options);
  if (!game || game.error) return game;
  return {
    schemaVersion: SCHEMA_VERSION,
    gameId: game.gameId,
    levelRank: game.levelRank,
    status: game.status,
    initialHands: game.initialHands,
    actions: game.coachAdviceTimeline.map((item) => ({
      turnNumber: item.turnNumber,
      seat: item.playerIndex,
      source: item.source,
      tier: "silver",
      weight: 0.4,
      hand: item.handBefore,
      candidates: item.choices,
      label: { play: item.actualPlay, match: item.actualChoiceMatch },
    })),
    stats: game.importStats,
  };
}
