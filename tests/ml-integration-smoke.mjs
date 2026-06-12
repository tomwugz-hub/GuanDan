import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createCard } from "../engine/card.mjs";
import { createGameStateFromHands } from "../engine/game-state.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { recommendPlay } from "../strategy/recommend.mjs";
import {
  pickTopCandidatePureMl,
  rankCandidatesWithMl,
  scoredCandidatesFromTrainingRow,
} from "../strategy/ml-policy.mjs";
import { loadRows, playSignature } from "../ml/feature-encoder.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const modelPath = join(root, "models/policy-v001/model.json");
assert(existsSync(modelPath), "缺少 models/policy-v001/model.json，请先 npm run data:train");

const model = JSON.parse(readFileSync(modelPath, "utf8"));
assert(model?.weights?.length > 0, "模型权重为空");

const rowsPath = join(root, "datasets/v1/rows.jsonl");
const rows = existsSync(rowsPath)
  ? loadRows(rowsPath, { readFileSync })
  : [];
assert(rows.length >= 100, `训练行过少: ${rows.length}`);

let pureMlHits = 0;
let pureMlTotal = 0;
let blendHits = 0;
let blendTotal = 0;
const sample = rows.filter((row) => (row.candidates?.length ?? 0) >= 3).slice(0, 400);

for (const row of sample) {
  const labelSig = playSignature(row.label?.play);
  if (!labelSig) continue;

  const pureBest = pickTopCandidatePureMl(model, row);
  pureMlTotal += 1;
  if (playSignature(pureBest?.play) === labelSig) pureMlHits += 1;

  const scored = scoredCandidatesFromTrainingRow(row);
  const blended = rankCandidatesWithMl(model, row, scored);
  blendTotal += 1;
  if (playSignature(blended[0]?.candidate) === labelSig) blendHits += 1;
}

const pureRate = pureMlTotal ? pureMlHits / pureMlTotal : 0;
const blendRate = blendTotal ? blendHits / blendTotal : 0;
assert(pureMlTotal >= 80, `纯 ML 样本不足: ${pureMlTotal}`);
assert(pureRate >= 0.5, `纯 ML Top1 应 ≥50%，实际 ${(pureRate * 100).toFixed(1)}%`);

const row = sample.find((item) => item.state?.hand?.length >= 10 && item.state?.mustBeat);
if (row) {
  const seat = row.seat ?? 0;
  const hand = row.state.hand.map((card) => createCard(card.rank, card.suit, card.deckIndex ?? 0));
  const hands = [[], [], [], []];
  hands[seat] = hand;
  for (let i = 0; i < 4; i += 1) {
    if (i !== seat) {
      const count = row.state.handCounts?.[i] ?? 27;
      hands[i] = Array.from({ length: count }, (_, j) => createCard("3", "S", j + i * 30));
    }
  }
  let state = createGameStateFromHands({ levelRank: row.levelRank ?? "2", hands, currentPlayerIndex: seat });
  const must = row.state.mustBeat ?? row.state.lastActivePlay;
  if (must && must.type && must.type !== "Pass") {
    const play = classifyPlay(
      (must.cards ?? []).map((c) => createCard(c.rank, c.suit, c.deckIndex ?? 0)),
      state.levelRank,
    );
    state = {
      ...state,
      lastActivePlay: play,
      lastActivePlayerIndex: row.state.lastActivePlayerIndex ?? ((seat + 1) % 4),
    };
  }

  const withMl = recommendPlay(hand, state.levelRank, state.lastActivePlay, {
    state,
    playerIndex: seat,
    mlModel: model,
    previousPlay: state.lastActivePlay,
  });
  const withoutMl = recommendPlay(hand, state.levelRank, state.lastActivePlay, {
    state,
    playerIndex: seat,
    mlModel: null,
    previousPlay: state.lastActivePlay,
  });
  assert(withMl?.candidate, "recommendPlay + ML 应有推荐");
  assert(withoutMl?.candidate, "recommendPlay 启发式应有推荐");
  assert(
    withMl.reasons?.some((r) => r.includes("ML")),
    "开启 ML 时推荐理由应含 ML 标记",
  );
}

console.log(
  JSON.stringify({
    ok: true,
    pureMlTop1: pureRate,
    blendTop1: blendRate,
    sampledRows: pureMlTotal,
  }),
);
console.log("P1-第二步 ML 接入冒烟测试通过");
