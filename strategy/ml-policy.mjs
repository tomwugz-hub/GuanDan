import { encodeRowCandidate, featureNames, vectorize } from "../ml/feature-encoder.mjs";

const DEFAULT_ML_BLEND = 8500;

let cachedModel = null;

function isBrowserRuntime() {
  return typeof globalThis !== "undefined"
    && typeof globalThis.document !== "undefined";
}

export function loadMlPolicy() {
  if (cachedModel) return cachedModel;
  if (globalThis.__GUANDAN_ML_MODEL__) {
    const model = globalThis.__GUANDAN_ML_MODEL__;
    const names = model.featureNames ?? featureNames();
    cachedModel = { ...model, featureNames: names };
    return cachedModel;
  }
  return null;
}

export function getMlBlendWeight() {
  const raw = typeof process !== "undefined" ? process.env?.GUANDAN_ML_BLEND : undefined;
  const parsed = raw != null ? Number(raw) : DEFAULT_ML_BLEND;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_ML_BLEND;
}

export function pickTopCandidatePureMl(model, row) {
  const candidates = row.candidates ?? [];
  if (candidates.length === 0) return null;
  let best = null;
  let bestScore = -Infinity;
  for (const cand of candidates) {
    const mlScore = mlCandidateScore(model, row, cand);
    if (mlScore > bestScore) {
      bestScore = mlScore;
      best = cand;
    }
  }
  return best;
}

export function mlCandidateScore(model, rowContext, candidate) {
  const feats = encodeRowCandidate(rowContext, {
    score: candidate.engineScore ?? candidate.score,
    play: {
      type: candidate.type ?? candidate.play?.type,
      mainRank: candidate.mainRank ?? candidate.play?.mainRank,
      length: candidate.length ?? candidate.play?.length,
      cards: candidate.cards ?? candidate.play?.cards,
    },
  });
  const vector = vectorize(feats, model.featureNames);
  return sigmoid(dot(model.weights, vector) + model.bias);
}

function sigmoid(z) {
  if (z > 20) return 1;
  if (z < -20) return 0;
  return 1 / (1 + Math.exp(-z));
}

function dot(weights, vector) {
  let s = 0;
  for (let i = 0; i < weights.length; i += 1) s += weights[i] * vector[i];
  return s;
}

export function buildRowContextFromTable(state, playerIndex, previousPlay, handProfile) {
  const partnerSeat = (playerIndex + 2) % 4;
  return {
    seat: playerIndex,
    levelRank: state.levelRank,
    weight: 0.15,
    tier: "bronze",
    state: {
      hand: state.players[playerIndex].hand.map((c) => ({
        rank: c.rank,
        suit: c.suit,
        deckIndex: c.deckIndex,
      })),
      handCount: state.players[playerIndex].hand.length,
      partnerSeat,
      handCounts: state.players.map((p) => p.hand.length),
      lastActivePlay: previousPlay,
      lastActivePlayerIndex: state.lastActivePlayerIndex,
      mustBeat: previousPlay && previousPlay.type !== "Pass" && previousPlay.type !== "pass" ? previousPlay : null,
      finishedOrders: state.players.map((p) => p.finishedOrder),
    },
    meta: { handProfile },
  };
}

export function rankCandidatesWithMl(
  model,
  rowContext,
  scoredCandidates,
  {
    blendWeight = getMlBlendWeight(),
    fusionMode = "smart",
    tableContext = {},
    candidateBlend = null,
  } = {},
) {
  return scoredCandidates
    .map((item) => {
      const mlScore = mlCandidateScore(model, rowContext, {
        score: item.score,
        play: {
          type: item.candidate.type,
          mainRank: item.candidate.mainRank,
          length: item.candidate.length,
          cards: item.candidate.cards,
        },
      });
      const weight = candidateBlend
        ? candidateBlend(item.candidate, tableContext, fusionMode, item)
        : blendWeight;
      const mlNote = weight > 0
        ? `ML 倾向分 ${(mlScore * 100).toFixed(0)}%`
        : `ML 倾向分 ${(mlScore * 100).toFixed(0)}%（本局面未加权）`;
      return {
        ...item,
        mlScore,
        mlBlendWeight: weight,
        score: item.score - mlScore * weight,
        reasons: [...item.reasons, mlNote],
      };
    })
    .sort((a, b) => a.score - b.score);
}

export function scoredCandidatesFromTrainingRow(row) {
  return (row.candidates ?? []).map((cand) => ({
    candidate: {
      type: cand.play?.type,
      mainRank: cand.play?.mainRank,
      length: cand.play?.length ?? cand.play?.cards?.length ?? 0,
      cards: (cand.play?.cards ?? []).map((card) => ({
        rank: card.rank,
        suit: card.suit,
        deckIndex: card.deckIndex ?? 0,
      })),
    },
    score: cand.score ?? 0,
    reasons: cand.reasons ?? [],
  }));
}

export function resolveMlModel(explicitModel = null) {
  if (explicitModel === false || explicitModel === null) return null;
  if (explicitModel) return explicitModel;
  return loadMlPolicy();
}

export function isMlPolicyEnabled(explicitModel = null) {
  if (explicitModel) return true;
  if (globalThis.__GUANDAN_ML_MODEL__) return true;
  if (typeof process !== "undefined" && process.env?.GUANDAN_DISABLE_ML === "1") return false;
  if (typeof process !== "undefined" && process.env?.GUANDAN_USE_ML === "1") return true;
  if (isBrowserRuntime()) return !!globalThis.__GUANDAN_ML_MODEL__;
  return false;
}
