/** 与 ml/feature_encoder.py 对齐的特征编码（Node 训练 / 推理共用） */

export const RANKS = ["3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2"];
export const PLAY_TYPES = [
  "Pass",
  "Single",
  "Pair",
  "Triple",
  "TripleWithPair",
  "Straight",
  "ConsecutivePairs",
  "Plane",
  "Bomb",
  "StraightFlush",
  "JokerBomb",
  "Invalid",
];

export function rankPower(rank, levelRank) {
  const order = RANKS.filter((r) => r !== levelRank).concat([levelRank, "SJ", "BJ"]);
  const index = order.indexOf(rank);
  return index >= 0 ? index : 0;
}

function handRankCounts(hand) {
  const counts = Object.fromEntries(RANKS.map((r) => [r, 0]));
  for (const card of hand ?? []) {
    if (counts[card.rank] != null) counts[card.rank] += 1;
  }
  return counts;
}

export function breaksBombMaterial(hand, playCards) {
  const counts = handRankCounts(hand);
  const used = {};
  for (const card of playCards ?? []) {
    used[card.rank] = (used[card.rank] ?? 0) + 1;
  }
  for (const [rank, usedN] of Object.entries(used)) {
    const held = counts[rank] ?? 0;
    if (held >= 4 && usedN > 0 && usedN < held && held - usedN < 4) return 1;
  }
  return 0;
}

export function playSignature(play) {
  if (!play || play.type === "Pass") return "Pass:";
  const ids = (play.cards ?? [])
    .map((c) => `${c.suit}${c.rank}#${c.deckIndex ?? 0}`)
    .sort()
    .join("|");
  return `${play.type}:${ids}`;
}

export function encodeRowCandidate(row, candidate) {
  const state = row.state ?? {};
  const level = row.levelRank ?? "2";
  const seat = row.seat ?? 0;
  const hand = state.hand ?? [];
  const handCounts = state.handCounts ?? [27, 27, 27, 27];
  const must = state.mustBeat ?? state.lastActivePlay;
  const play = candidate.play ?? {};
  const playType = play.type ?? "Pass";
  const playCards = play.cards ?? [];
  const oppCounts = handCounts.filter((_, i) => i !== seat);
  const partner = state.partnerSeat ?? (seat + 2) % 4;
  const lastActive = state.lastActivePlayerIndex;

  const feats = {
    seat_norm: seat / 3,
    partner_norm: partner / 3,
    hand_count_norm: (state.handCount ?? hand.length) / 27,
    opp_min_norm: oppCounts.length ? Math.min(...oppCounts) / 27 : 1,
    opp_max_norm: oppCounts.length ? Math.max(...oppCounts) / 27 : 1,
    partner_owns_trick: lastActive === partner ? 1 : 0,
    opponent_owns_trick: lastActive != null && lastActive !== seat && lastActive !== partner ? 1 : 0,
    candidate_length_norm: (play.length ?? 0) / 10,
    candidate_power_norm: rankPower(play.mainRank ?? "3", level) / 14,
    engine_score_norm: (candidate.score ?? 0) / 10000,
    breaks_bomb: breaksBombMaterial(hand, playCards),
    tier_weight: row.weight ?? 0.15,
    must_beat_power_norm: must && must.type !== "Pass"
      ? rankPower(must.mainRank ?? "3", level) / 14
      : 0,
  };

  const counts = handRankCounts(hand);
  for (const rank of RANKS) feats[`hand_rank_${rank}_norm`] = counts[rank] / 8;

  for (const pt of PLAY_TYPES) feats[`play_type_${pt}`] = playType === pt ? 1 : 0;
  for (const pt of PLAY_TYPES) {
    feats[`must_type_${pt}`] = must && (must.type ?? "Pass") === pt ? 1 : 0;
  }

  return feats;
}

export function featureNames() {
  return Object.keys(encodeRowCandidate(
    {
      seat: 0,
      levelRank: "2",
      weight: 0.15,
      state: {
        hand: [],
        handCount: 27,
        handCounts: [27, 27, 27, 27],
        partnerSeat: 2,
        lastActivePlayerIndex: 1,
        mustBeat: { type: "Pair", mainRank: "9" },
      },
    },
    { score: -100, play: { type: "Pair", mainRank: "10", length: 2, cards: [] } },
  )).sort();
}

export function vectorize(feats, names) {
  return names.map((name) => Number(feats[name] ?? 0));
}

export function loadRows(path, fs) {
  const text = fs.readFileSync(path, "utf8").trim();
  if (!text) return [];
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

export function* iterTrainingExamples(rows) {
  const names = featureNames();
  for (const row of rows) {
    const candidates = row.candidates ?? [];
    if (candidates.length === 0) continue;
    const labelSig = playSignature(row.label?.play);
    if (!labelSig) continue;
    let weight = Number(row.weight ?? 0.15);
    if (row.tier === "gold") weight *= 2;
    let anyPositive = false;
    for (const cand of candidates) {
      const isPositive = playSignature(cand.play) === labelSig;
      if (isPositive) anyPositive = true;
      yield {
        rowId: row.rowId,
        gameId: row.gameId,
        vector: vectorize(encodeRowCandidate(row, cand), names),
        label: isPositive ? 1 : 0,
        weight,
      };
    }
    if (!anyPositive) continue;
  }
  return names;
}
