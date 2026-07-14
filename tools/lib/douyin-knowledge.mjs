import { createHash } from "node:crypto";

const TOPICS = [
  ["炸弹", /炸弹|开炸|保炸/],
  ["组牌", /组牌|顺子|连对|三带二|钢板/],
  ["记牌", /记牌|算牌|推理|已出.*牌/],
  ["配合", /对家|队友|喂牌|接风|配合/],
  ["进还贡", /进贡|还贡|抗贡/],
  ["残局", /残局|报牌|剩(?:下|余)?一张|只剩一张|头游/],
];

const ACTION_CUE = /不要|不应|要先|应该|应当|优先|可以|避免|保留|控制|控牌|判断|选择|拆|让牌|接风|喂牌|出牌|通常|往往|更适合|高于|低于|优于|不如|先.+再/;
const INFERENCE_CUE = /预判|推断|意味着|代表|说明|大概率/;
const CHECKABLE_CUE = /不要|不应|要先|应该|应当|优先|可以|避免|保留|控制|控牌|判断|选择|拆|让牌|接风|喂牌|出牌|通常|往往|更适合|高于|低于|优于|不如|先.+再|预判|推断|意味着|代表|说明|大概率/;
const STRATEGY_CONTEXT = /手牌|牌型|出牌|大牌|小牌|单张|对子|三带|顺子|连对|钢板|炸弹|同花顺|红心|配牌|大小王|对家|上家|下家|接风|进贡|还贡|抗贡/;
const MARKETING_CUE = /关注|点赞|收藏|转发|私信|评论区|主页/;
const PURE_GENERIC_SLOGAN = /^(?:掼蛋|打牌|高手打牌)?(?:就是)?(?:一定)?(?:要)?(?:灵活应变|随机应变|千变万化|博大精深|非常有趣|牌品如人)[。！？!?]*$/;
const GENERIC_OUTCOME_CLAUSE = /(?:^|[，,。！？!?；;])(?:学会|掌握|记住)[^，,。！？!?；;]{0,24}(?:就|便)(?:能|可以)?(?:提高胜率|提升胜率|成为高手|获胜|赢(?:得比赛|牌|了一半)?)[，,。！？!?；;]*/gu;
const MARKETING_WORDS = /请|记得|欢迎|大家|朋友们|关注我?|点赞|收藏|转发|私信|评论区|主页|下期|分享|更多|掼蛋|技巧|内容|谢谢|支持|继续|点个|别忘了/gu;
const FUTURE_MARKETING_PROMISE = /(?:下期|下一期|后续内容|后续视频)[^。！？!?]{0,12}(?:告诉|教|分享|讲|分析|介绍)/;
const FOLLOWER_PROMISE = /(?:以后|后续)[^。！？!?]{0,12}(?:告诉|教|分享|讲|介绍)/;
const MIN_TEXT_LENGTH = 8;
const MAX_FRAGMENT_GAP_SECONDS = 0.75;
const MAX_CANDIDATE_WINDOW_SECONDS = 10;
const MAX_CANDIDATE_TEXT_LENGTH = 120;
const SENTENCE_END = /[。！？!?；;]$/u;
const NEW_CLAIM_START = /^(?:例如|而?如果|假如|若|当(?:对手|对家|下家|上家)|我们在|学会|掌握)/u;

function cleanText(value) {
  return String(value ?? "").trim().replace(/\s+/gu, " ");
}

function removeGenericOutcomeClauses(value) {
  return cleanText(cleanText(value).replace(GENERIC_OUTCOME_CLAUSE, ""))
    .replace(/^[，,。！？!?；;]+/u, "")
    .trim();
}

function normalizedVideoId(video) {
  const raw = cleanText(video?.videoId).normalize("NFKC");
  if (!raw) throw new Error("A videoId is required to extract Douyin knowledge");
  return raw;
}

function topicMatch(text) {
  let best = null;
  for (const [topic, pattern] of TOPICS) {
    const index = text.search(pattern);
    if (index >= 0 && (best === null || index < best.index)) best = { topic, index };
  }
  return best?.topic ?? null;
}

function isMarketingOnly(text) {
  if (FUTURE_MARKETING_PROMISE.test(text) || (MARKETING_CUE.test(text) && FOLLOWER_PROMISE.test(text))) {
    return true;
  }
  if (!MARKETING_CUE.test(text)) return false;
  const remainder = text.replace(MARKETING_WORDS, "").replace(/[\s，。！？、,.!?：:；;]+/gu, "");
  return remainder.length < 4;
}

function isUseful(text) {
  if (
    text.length < MIN_TEXT_LENGTH ||
    PURE_GENERIC_SLOGAN.test(text) ||
    isMarketingOnly(text)
  ) {
    return false;
  }
  if (INFERENCE_CUE.test(text) && !ACTION_CUE.test(text) && !STRATEGY_CONTEXT.test(text)) {
    return false;
  }
  return CHECKABLE_CUE.test(text);
}

function stableId(videoId, start, end, text) {
  return createHash("sha256")
    .update(`${videoId}\0${start}\0${end}\0${text}`)
    .digest("hex")
    .slice(0, 16);
}

function canonicalUrl(videoId) {
  return `https://www.douyin.com/video/${encodeURIComponent(videoId)}`;
}

function joinFragments(left, right) {
  const separator = /[A-Za-z0-9]$/u.test(left) && /^[A-Za-z0-9]/u.test(right) ? " " : "";
  return `${left}${separator}${right}`;
}

function coalesceSegments(input) {
  const seen = new Set();
  const valid = [];
  for (const segment of input ?? []) {
    const start = segment?.start;
    const end = segment?.end;
    const text = removeGenericOutcomeClauses(segment?.text);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || !text) {
      continue;
    }
    const duplicateKey = `${start}\0${end}\0${text}`;
    if (seen.has(duplicateKey)) continue;
    seen.add(duplicateKey);
    valid.push({
      start,
      end,
      text,
      weightedLogProb: Number.isFinite(segment.avgLogProb)
        ? segment.avgLogProb * (end - start)
        : 0,
      logProbWeight: Number.isFinite(segment.avgLogProb) ? end - start : 0,
    });
  }
  valid.sort((left, right) => left.start - right.start || left.end - right.end || left.text.localeCompare(right.text, "zh-CN"));

  const merged = [];
  let current = null;
  for (const segment of valid) {
    const combinedText = current ? joinFragments(current.text, segment.text) : segment.text;
    const canMerge =
      current !== null &&
      !SENTENCE_END.test(current.text) &&
      !NEW_CLAIM_START.test(segment.text) &&
      segment.start >= current.end &&
      segment.start - current.end <= MAX_FRAGMENT_GAP_SECONDS &&
      segment.end - current.start <= MAX_CANDIDATE_WINDOW_SECONDS &&
      combinedText.length <= MAX_CANDIDATE_TEXT_LENGTH;

    if (!canMerge) {
      if (current) merged.push(current);
      current = { ...segment };
      continue;
    }

    current.end = segment.end;
    current.text = combinedText;
    current.weightedLogProb += segment.weightedLogProb;
    current.logProbWeight += segment.logProbWeight;
  }
  if (current) merged.push(current);

  return merged.map((segment) => ({
    start: segment.start,
    end: segment.end,
    text: segment.text,
    avgLogProb:
      segment.logProbWeight > 0 ? segment.weightedLogProb / segment.logProbWeight : null,
  }));
}

export function extractCandidates(video, transcript) {
  const videoId = normalizedVideoId(video);
  const title = cleanText(video?.title);
  const segments = [];

  for (const segment of coalesceSegments(transcript?.segments)) {
    const start = segment?.start;
    const end = segment?.end;
    const text = cleanText(segment?.text);
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start < 0 ||
      end <= start ||
      !isUseful(text)
    ) {
      continue;
    }

    segments.push({ segment, start, end, text });
  }

  segments.sort(
    (left, right) =>
      left.start - right.start ||
      left.end - right.end ||
      left.text.localeCompare(right.text, "zh-CN"),
  );

  return segments.map(({ segment, start, end, text }) => ({
    id: stableId(videoId, start, end, text),
    claim: text,
    topic: topicMatch(text) ?? topicMatch(title) ?? "综合",
    conditions: [],
    action: text,
    exceptions: [],
    confidence: {
      transcriptAvgLogProb: Number.isFinite(segment.avgLogProb) ? segment.avgLogProb : null,
      explicitness: CHECKABLE_CUE.test(text) ? "explicit" : "implicit",
      sourceCount: 1,
    },
    reviewStatus: "pending",
    evidence: {
      videoId,
      url: canonicalUrl(videoId),
      start,
      end,
      text,
      model: transcript?.model == null ? null : structuredClone(transcript.model),
      language: transcript?.language ?? null,
    },
  }));
}
