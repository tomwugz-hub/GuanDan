import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createCard } from "../engine/card.mjs";
import { classifyPlay } from "../engine/classify-play.mjs";
import { recommendPlay, scoreCandidate } from "../strategy/recommend.mjs";
import { enforceDoctrineOnCandidates, detectDoctrineViolations } from "../strategy/doctrine-enforce.mjs";
import { enrichScoringContext } from "../strategy/table-context.mjs";
import { generateBasicCandidates } from "../engine/generate-candidates.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { buildStrategicGroups } from "../strategy/strategic-groups.mjs";
import { loadMlPolicy } from "../strategy/ml-policy.mjs";
import { deserializeCard } from "./lib/canonical-replay.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadDebugMlModel() {
  const cached = loadMlPolicy();
  if (cached) return cached;
  try {
    return JSON.parse(readFileSync(join(root, "models/policy-v001/model.json"), "utf8"));
  } catch {
    return null;
  }
}

const latest = JSON.parse(readFileSync(join(root, "training-samples/coach-questions-latest.json"), "utf8"));
const timeline = latest.currentPosition?.coachAdviceTimeline ?? [];

function handFromRecord(record) {
  return (record.handBefore ?? []).map((c) => deserializeCard(c));
}

function rankCounts(hand) {
  const m = {};
  for (const c of hand) {
    m[c.rank] = (m[c.rank] ?? 0) + 1;
  }
  return m;
}

for (const turn of [52, 72]) {
  const record = timeline.find((t) => t.turnNumber === turn && t.playerIndex === 0);
  const hand = handFromRecord(record);
  const levelRank = record.levelRank ?? "3";
  const previousPlay = record.mustBeat
    ? classifyPlay((record.mustBeat.cards ?? []).map(deserializeCard), levelRank)
    : null;
  const isOpening = !previousPlay;
  const leadMode = isOpening ? "catch-wind" : "must-beat";
  const candidates = generateBasicCandidates(hand, levelRank, previousPlay);
  const tableContext = enrichScoringContext(
    {
      previousPlay,
      isOpening,
      leadMode,
      opponentActive: !!previousPlay,
      hasRegularWinner: !!previousPlay,
      playerIndex: 0,
    },
    candidates,
    hand,
    levelRank,
  );
  tableContext._candidates = candidates;

  console.log(`\n========== TURN ${turn} ==========`);
  console.log("ranks:", rankCounts(hand));
  console.log("mustBeat:", previousPlay?.mainRank ?? "catch-wind");
  console.log("groups:", buildStrategicGroups(hand, levelRank).map((g) => g.label).slice(0, 8));
  console.log("archived Top1:", record.choices?.[0]?.play?.label, record.choices?.[0]?.score);
  console.log("archived Top2:", record.choices?.[1]?.play?.label, record.choices?.[1]?.score);
  console.log("actual:", record.actualPlay?.label);

  const rec = recommendPlay(hand, levelRank, previousPlay, { ...tableContext, mlFusionMode: "off", mlModel: false });
  console.log("\nCurrent Top1 (ML off):", rec.candidate?.label ?? rec.candidate?.type, "score:", rec.score);
  console.log("reasons:", rec.reasons?.slice(0, 6));

  const mlModel = loadDebugMlModel();
  if (mlModel && turn === 52) {
    const recMl = recommendPlay(hand, levelRank, previousPlay, {
      ...tableContext,
      mlFusionMode: "smart",
      mlModel,
      state: {
        levelRank,
        currentPlayerIndex: 0,
        lastActivePlayerIndex: record.tableBefore?.lastActivePlayerIndex ?? 1,
        lastActivePlay: previousPlay,
        players: (record.playersBefore ?? []).map((p, i) => ({
          seatIndex: i,
          hand: i === 0 ? hand : Array(p.handCount ?? 0).fill({ rank: "3", suit: "C", deckIndex: 0 }),
          finishedOrder: p.finishedOrder,
        })),
      },
    });
    console.log("Current Top1 (ML smart):", recMl.candidate?.label ?? recMl.candidate?.type, "score:", recMl.score);
    console.log("reasons:", recMl.reasons?.slice(0, 6));
  }

  const scored = candidates.map((c) => scoreCandidate(c, hand, levelRank, previousPlay, tableContext));
  const targets = turn === 52
    ? ["Pair", "Pass"]
    : ["Triple", "TripleWithPair"];
  for (const type of targets) {
    const items = scored.filter((i) => i.candidate.type === PLAY_TYPES[type.toLowerCase()] || i.candidate.type === type);
    for (const item of items.slice(0, 3)) {
      const v = detectDoctrineViolations(item.candidate, hand, levelRank, tableContext);
      console.log({
        label: item.candidate.label ?? `${item.candidate.type}:${item.candidate.mainRank}`,
        score: item.score,
        violations: v.map((x) => x.summary),
        reasons: item.reasons?.filter((r) => /P[0-9]|接风|结构|三带|对/.test(r)).slice(0, 4),
      });
    }
  }
}
