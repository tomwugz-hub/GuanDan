/**
 * 书摘截取：例 1～42 不得混入通用讲义
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractCaseExcerpt } from "../tools/lib/case-excerpt.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const cleaned = fs.readFileSync(
  path.join(root, "training-samples", "掼蛋实战100例-cleaned.txt"),
  "utf8",
);

const TEACHING_BLEED = [
  /五张牌的牌型/,
  /五个头炸弹/,
  /三带对也叫/,
  /五张杂花顺/,
  /同五个杂花顺一样/,
  /顺子里的最小牌/,
  /掼蛋一般是4个人/,
  /掼蛋牌里常有6种/,
  /掼蛋\s*,\s*与传统扑克/,
  /三连对也是纵向比大小/,
  /三连三\s*\(/,
  /成为普通牌/,
  /QQKKAA\s*是此类/,
  /10张\s*报牌制/,
  /首家继续发牌/,
  /^\(\d+\)\s/,
  /分\s*,\s*大分者排名在前/,
  /友、\s*对家\s*\)\s*牌的信息/,
  /真正的掼蛋高手/,
  /一次性报牌后/,
  /掼蛋人门者还要了解/,
  /心有灵犀一点通/,
  /^为中牌\s*,/,
  /^所谓中性牌\s*,/,
  /^3\.\s*首友三不带/,
  /^我经常说/,
  /^对付三不带/,
  /^首发小三连三/,
  /^顺便讲一下第二家/,
  /^打好信息战/,
  /^闲话少说/,
  /^1\.\s*炙弹越多/,
  /^牌力骏/,
  /^2\.\s*灼弹超多/,
  /炸弹越多越好/,
  /^678910,\s*恰恰/,
  /^关于\s*[“"]\s*一种牌型打到底/,
  /^开局就接搭档的牌/,
  /^6\.\s*先出万不带/,
  /^7\.\s*一家爪强拆/,
  /^件\s*[“"]\s*吐血/,
  /^顺带说一点/,
  /^而牌力强想争头游/,
  /^9\.\s*讫强伴争霭/,
  /^10\.\s*打好取局牌/,
  /^打好残局牌/,
  /^没有炸弹了/,
  /^有一种情况需强调一下/,
  /^所谓初步定位/,
  /^随机转成助攻/,
  /^掼蛋要争头游/,
  /^帮助搭档争得头游/,
  /^当然\s*,\s*初步定位后/,
  /^要齐心协力/,
  /^在搭档顺过或管封/,
  /^掼蛋很能体现一个人的风格/,
  /掼蛋实战100例技巧分析\s*\|/,
];

const EXPECTED_START = {
  1: "此牌打2",
  2: "此牌打4",
  3: "此牌打3",
  4: "此牌打4",
  5: "此牌打",
  6: "此牌打",
  7: "此牌打4",
  8: "此牌打9",
  9: "此牌打9",
  10: "此牌打5",
  11: "此牌打2",
  12: "此牌打3",
  13: "此牌打9",
  14: "此牌打了",
  15: "此牌打 A",
  16: "此牌打4",
  17: "此牌打5",
  18: "此牌打3",
  19: "此牌打 A",
  20: "此牌打7",
  21: "此牌打2",
  22: "此牌打5",
  23: "此牌打 A",
  24: "此牌打9",
  25: "此牌打8",
  26: "此牌打2",
  27: "此牌打3",
  28: "此牌打2",
  29: "此牌打 J",
  30: "此牌打6",
  31: "此牌打 Q",
  32: "此牌打6",
  33: "此牌打 A",
  34: "此牌打5",
  35: "此牌打2",
  36: "此牌打7",
  37: "此牌打6",
  38: "此牌打2",
  39: "此牌打4",
  40: "此牌打10",
  41: "此牌打 A",
  42: "此牌打3",
};

let failed = 0;
for (let n = 1; n <= 42; n += 1) {
  const excerpt = extractCaseExcerpt(cleaned, n);
  if (!excerpt.startsWith(EXPECTED_START[n])) {
    console.error(`FAIL 例${n}: 书摘应以「${EXPECTED_START[n]}」开头，得：`, excerpt.slice(0, 60));
    failed += 1;
    continue;
  }
  const bleed = TEACHING_BLEED.find((re) => re.test(excerpt));
  if (bleed) {
    console.error(`FAIL 例${n}: 书摘混入讲义「${bleed}」`, excerpt.slice(0, 120));
    failed += 1;
    continue;
  }
  console.log(`PASS 例${n}:`, excerpt.slice(0, 72) + (excerpt.length > 72 ? "…" : ""));
}

if (failed > 0) process.exit(1);
console.log("hand-labeler-excerpt: 例1～42 书摘边界全部通过");

for (const n of [1, 7, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42]) {
  const id = `case-${String(n).padStart(3, "0")}.json`;
  const data = JSON.parse(fs.readFileSync(path.join(root, "training-samples", "cases", id), "utf8"));
  const expected = extractCaseExcerpt(cleaned, n);
  if (data.narrative?.summary !== expected) {
    console.error(`FAIL ${id}: narrative.summary 与 extractCaseExcerpt 不一致`);
    failed += 1;
  } else {
    console.log(`PASS ${id}: narrative.summary 已对齐 cleaned`);
  }
}
if (failed > 0) process.exit(1);
