import assert from "node:assert/strict";

import { extractCandidates } from "../tools/lib/douyin-knowledge.mjs";

const video = {
  videoId: " 7660857581832785190 ",
  url: "https://www.douyin.com/video/7660857581832785190?previous_page=web_code_link",
  title: "掼蛋如何用好炸弹？记住这四点",
};

const transcript = {
  model: { name: "small", device: "cpu", computeType: "int8" },
  language: "zh",
  segments: [
    { start: 20, end: 24, text: "  对家出小单张时，可以优先喂出中间张帮助队友接风。  ", avgLogProb: -0.4 },
    { start: 0, end: 4, text: "炸弹不要见牌就打，要先判断对手是否报牌。", avgLogProb: -0.2 },
    { start: 12, end: 16, text: "对手只剩一张时，控制牌价值通常高于保炸。" },
    { start: 4, end: 8, text: "炸弹不要见牌就打，要先判断对手是否报牌。", avgLogProb: -0.2 },
    { start: 4, end: 8, text: "炸弹不要见牌就打，要先判断对手是否报牌。", avgLogProb: -0.2 },
    { start: 25, end: 29, text: "关注我，点赞收藏，下期分享更多掼蛋技巧。", avgLogProb: -0.1 },
    { start: 29, end: 30, text: "关注我，下期告诉你炸弹应该什么时候出牌。", avgLogProb: -0.1 },
    { start: 30, end: 34, text: "高手打牌就是要灵活应变。", avgLogProb: -0.1 },
    { start: 35, end: 36, text: "要炸", avgLogProb: -0.1 },
    { start: 40, end: 39, text: "记牌时要先统计已经出现的大牌。", avgLogProb: -0.3 },
    { start: -1, end: 2, text: "进贡时应该优先确认是否满足抗贡。", avgLogProb: -0.3 },
    { start: Number.NaN, end: 50, text: "组牌时可以先保留连对结构。", avgLogProb: -0.3 },
    { start: 50, end: 54, text: "     ", avgLogProb: -0.3 },
  ],
};

const rows = extractCandidates(video, transcript);
assert.equal(rows.length, 4, "only useful, valid, deduplicated segments should become candidates");
assert.deepEqual(rows.map((row) => row.evidence.start), [0, 4, 12, 20], "candidates should be in evidence-time order");
assert.deepEqual(rows.map((row) => row.topic), ["炸弹", "炸弹", "残局", "配合"], "segment topics should override title fallback");

for (const row of rows) {
  assert.equal(row.reviewStatus, "pending", "all extracted knowledge must remain pending");
  assert.equal(row.confidence.sourceCount, 1, "a single creator must not be treated as corroboration");
  assert.ok(Array.isArray(row.conditions), "candidate should expose conditions");
  assert.ok(Array.isArray(row.exceptions), "candidate should expose exceptions");
  assert.equal(typeof row.action, "string", "candidate should expose an action");
  assert.equal(row.claim, row.evidence.text, "claim should remain traceable to cleaned evidence text");
}

assert.equal(rows[0].evidence.videoId, "7660857581832785190", "video ID should be normalized");
assert.equal(rows[0].evidence.url, "https://www.douyin.com/video/7660857581832785190", "evidence should use the canonical source URL");
assert.equal(rows[0].evidence.end, 4, "evidence should preserve the segment end");
assert.equal(rows[0].evidence.text, "炸弹不要见牌就打，要先判断对手是否报牌。", "evidence should preserve exact cleaned text");
assert.deepEqual(rows[0].evidence.model, transcript.model, "evidence should preserve transcript model metadata");
assert.equal(rows[0].evidence.language, "zh", "evidence should preserve transcript language");
assert.equal(rows[0].confidence.transcriptAvgLogProb, -0.2, "confidence should preserve avgLogProb");
assert.equal(rows[2].confidence.transcriptAvgLogProb, null, "missing avgLogProb should remain null");

const repeated = extractCandidates(video, transcript);
assert.deepEqual(repeated, rows, "same inputs should yield deterministic candidates and IDs");

const changedEnd = structuredClone(transcript);
changedEnd.segments[1].end = 4.25;
const changedRows = extractCandidates(video, changedEnd);
assert.notEqual(changedRows[0].id, rows[0].id, "changed evidence timestamps should change the stable ID");

const changedText = structuredClone(transcript);
changedText.segments[1].text = "炸弹不要着急打，要先判断对手是否已经报牌。";
const changedTextRows = extractCandidates(video, changedText);
assert.notEqual(changedTextRows[0].id, rows[0].id, "changed evidence text should change the stable ID");

const taxonomyVideo = {
  videoId: "2",
  url: "https://www.douyin.com/video/2",
  title: "没有特定主题的掼蛋技巧",
};
const taxonomyRows = extractCandidates(taxonomyVideo, {
  segments: [
    { start: 0, end: 1, text: "组牌时要优先保留完整顺子结构。" },
    { start: 1, end: 2, text: "记牌时要先统计已经出现的大牌。" },
    { start: 2, end: 3, text: "对家准备接风时，可以主动喂出小牌。" },
    { start: 3, end: 4, text: "进贡以后要先判断自己能否满足抗贡。" },
    { start: 4, end: 5, text: "残局对手报牌时，要优先控制出牌权。" },
    { start: 5, end: 6, text: "领先以后不要急躁，要先观察每家的手数。" },
  ],
});
assert.deepEqual(
  taxonomyRows.map((row) => row.topic),
  ["组牌", "记牌", "配合", "进还贡", "残局", "综合"],
  "topic taxonomy should cover all required categories and the fallback",
);

const titleFallback = extractCandidates(
  { videoId: "3", url: "https://www.douyin.com/video/3", title: "炸弹的使用时机" },
  { segments: [{ start: 0, end: 2, text: "领先以后不要着急，要先观察其他玩家手数。" }] },
);
assert.equal(titleFallback[0].topic, "炸弹", "title should provide a topic only when the segment has no obvious match");

const fragmentedSpeech = extractCandidates(
  { videoId: "5", url: "https://www.douyin.com/video/5", title: "拆牌推理" },
  {
    model: { name: "small", device: "cpu", computeType: "int8" },
    language: "zh",
    segments: [
      { start: 0, end: 1.44, text: "掼蛋高手的拆牌思路", avgLogProb: -0.2 },
      { start: 1.44, end: 2.64, text: "从你打出的第一手牌", avgLogProb: -0.2 },
      { start: 2.64, end: 3.84, text: "就能看穿你的牌型", avgLogProb: -0.2 },
      { start: 4.16, end: 6.12, text: "例如下家起手出三个九带对三", avgLogProb: -0.3 },
      { start: 6.12, end: 6.96, text: "那可以预判", avgLogProb: -0.3 },
      { start: 6.96, end: 8.6, text: "他手中有四到八的杂顺", avgLogProb: -0.3 },
      { start: 12, end: 14, text: "学会拆牌思路掼蛋就赢了一半", avgLogProb: -0.1 },
    ],
  },
);
assert.equal(fragmentedSpeech.length, 2, "a new example should start a separate candidate and generic outcomes should be filtered");
assert.deepEqual(fragmentedSpeech.map((row) => row.evidence.start), [0, 4.16]);
assert.equal(fragmentedSpeech[0].evidence.end, 3.84, "intro fragments should form one complete setup");
assert.equal(fragmentedSpeech[1].evidence.end, 8.6, "example fragments should form one complete inference");
assert.match(fragmentedSpeech[1].claim, /三个九带对三.*可以预判.*杂顺/u);
assert.doesNotMatch(fragmentedSpeech.map((row) => row.claim).join(" "), /赢了一半/u);
assert.deepEqual(fragmentedSpeech[1].evidence.model, {
  name: "small",
  device: "cpu",
  computeType: "int8",
});

const concreteAdvice = extractCandidates(
  { videoId: "4", url: "https://www.douyin.com/video/4", title: "实战技巧" },
  {
    segments: [
      { start: 0, end: 3, text: "残局要灵活应变，报牌后要先控制出牌权。" },
      { start: 3, end: 6, text: "对手报双时，单张A通常比对子更适合控牌。" },
      { start: 6, end: 9, text: "对手报牌以后，先分析剩余牌，再选择出牌。" },
      { start: 9, end: 12, text: "后续分析对手出牌时，应该优先判断大牌分布。" },
    ],
  },
);
assert.equal(concreteAdvice.length, 4, "concrete slogan-qualified, comparative, and conditional advice should be retained");
assert.equal(concreteAdvice[0].topic, "残局", "specific advice should retain its segment topic");

const inferenceAdvice = extractCandidates(
  { videoId: "6", url: "https://www.douyin.com/video/6", title: "拆牌推理" },
  {
    segments: [
      { start: 0, end: 4, text: "如果下家先出小顺子，这代表他手中大概率还有单张。" },
      { start: 4, end: 8, text: "对家先拆三带二，说明原有组合可能需要交换。" },
    ],
  },
);
assert.equal(inferenceAdvice.length, 2, "prediction language should remain as checkable pending knowledge");
assert.deepEqual(inferenceAdvice.map((row) => row.topic), ["组牌", "配合"]);

const sloganWithAdvice = extractCandidates(
  { videoId: "7", url: "https://www.douyin.com/video/7", title: "记牌实战" },
  {
    segments: [
      { start: 0, end: 5, text: "学会记牌就能提高胜率，实战中要先统计已经出现的大牌。" },
    ],
  },
);
assert.equal(sloganWithAdvice.length, 1, "a generic outcome clause must not discard adjacent concrete advice");
assert.equal(sloganWithAdvice[0].claim, "实战中要先统计已经出现的大牌。");

const nonStrategicInference = extractCandidates(
  { videoId: "8", url: "https://www.douyin.com/video/8", title: "比赛复盘" },
  {
    segments: [
      { start: 0, end: 4, text: "这说明这位选手今天发挥得非常出色。" },
    ],
  },
);
assert.equal(nonStrategicInference.length, 0, "inference words alone must not make praise into Guandan knowledge");

const asrDistortedOutcome = extractCandidates(
  { videoId: "9", url: "https://www.douyin.com/video/9", title: "拆牌思路" },
  {
    segments: [
      { start: 0, end: 1.2, text: "学会拆牌思路" },
      { start: 1.2, end: 3, text: "灌烂就赢了一万" },
    ],
  },
);
assert.equal(asrDistortedOutcome.length, 0, "ASR-distorted generic win claims must remain filtered");

console.log("抖音知识提取测试通过");
