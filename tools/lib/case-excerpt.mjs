/**
 * 从 cleaned.txt 截取单例书摘，止于通用讲义（避免混入后续牌型讲解）。
 */

const TEACHING_LINE = /^(?:\d+\.\s|\d+\)\s|##\s*第\d+页|掼蛋(?:一般|牌里|允许|比赛|里常|将)\s*[,，]?|掼蛋\s*[,，]\s*与传统|在掼蛋|需要强调的是\s*,|同五个杂花顺|顺子里的最小牌|另一种四张|五张杂花顺\s*,|切记\s*:|正是这八大特性|有些初学者|我们先做个铺垫|当然\s*,\s*根据牌型)/;

/** 战例正文行内若出现下列片段，视为已滑入通用讲义 */
const INLINE_TEACHING_BLEED = /(?:成为普通牌|它们同样是\s*[,，]?\s*纵向比大小|QQKKAA\s*是此类|AAA222\s*是此类|七个头炸弹|八个头炸弹)/;

/** 例 13～17 等：战例正文结束后滑入报牌规则、记分规则或第二讲讲义 */
const CASE_TAIL_BLEED = [
  /^要精准\s*,/, // 例13 → 报牌制
  /一次性报牌后/,
  /10张\s*报牌制/,
  /掼蛋人门者还要了解/,
  /首家继续发牌/,
  /^\(\d+\)\s/, // (8)(9)(10) 日常比赛规则
  /分\s*,\s*大分者排名在前/, // 例15 → 争议规则
  /友、\s*对家\s*\)\s*牌的信息/, // 例16 → 第二讲读牌讲义
  /真正的掼蛋高手/, // 例17 → 泛论讲义
  /^为中牌\s*,/, // 例18 → 牌力分析讲义
  /^判断牌力弱\s*,/, // 例18 → 弱牌定义
  /^所谓中性牌\s*,/, // 例19 → 中性牌讲义
  /^出。殊不知\s*,/, // 例20 → 首开单张泛论
  /^要出顺子。二是所谓消耗/, // 例21 → 贴皮管泛论
  /^3\.\s*首友三不带/, // 例22 → 三不带讲义
  /^我经常说/, // 例23 → 三不带配合泛论
  /^对付三不带/, // 例23 → 三不带讲义
  /^首发小三连三/, // 例24 → 小三连对/三泛论
  /^顺便讲一下第二家/, // 例24 → 第二家讲义
  /^打好信息战/, // 例25 → 第二讲结语
  /^闲话少说/, // 例26 → 第三讲组牌技巧
  /^1\.\s*炙弹越多/, // 例26 → 组牌十大技巧
  /^牌力骏/, // 例27 → 弱牌保留炸弹泛论
  /^2\.\s*灼弹超多/, // 例28 → 炸弹越多越好讲义
  /炸弹越多越好/, // 例28 正文滑入组牌技巧
  /^678910,\s*恰恰/, // 例29 → 第59页同花顺泛论
  /^关于\s*[“"]\s*一种牌型打到底/, // 例30 → 配合讲义
  /^开局就接搭档的牌/, // 例31 → 争头游泛论（非本例战术句）
  /^6\.\s*先出万不带/, // 例32 → 三不带讲义
  /^7\.\s*一家爪强拆/, // 例32 → 负责制讲义
];

/** 跨页战例中的页脚 OCR 噪声（非正文） */
function isPageFooterNoise(line) {
  const t = String(line ?? "").trim();
  return /掼蛋实战100例技巧分析\s*\|/.test(t) || /^cy Ea/.test(t);
}

/** 战例正文跨页续写（页眉不截断） */
const CROSS_PAGE_CASES = new Set([26]);

/** 是否进入「第一讲入门」等通用讲义行（非本例战例正文） */
export function isTeachingBoundaryLine(line) {
  const t = String(line ?? "").trim();
  if (!t) return false;
  if (/^####\s*例\d+/.test(t)) return true;
  if (INLINE_TEACHING_BLEED.test(t)) return true;
  if (CASE_TAIL_BLEED.some((re) => re.test(t))) return true;
  return TEACHING_LINE.test(t);
}

/** 从 cleaned 全文截取例 N 书摘（不含下一例、页眉、通用讲义） */
export function extractCaseExcerpt(text, caseNum) {
  if (!text) return "";
  const lines = text.split(/\r?\n/);
  let inCase = false;
  const parts = [];
  const headerRe = new RegExp(`^####\\s*例${caseNum}[：:]\\s*(.*)$`);

  for (const line of lines) {
    const headerMatch = line.match(headerRe);
    if (headerMatch) {
      inCase = true;
      if (headerMatch[1]?.trim()) parts.push(headerMatch[1].trim());
      continue;
    }
    if (!inCase) continue;
    if (isTeachingBoundaryLine(line)) {
      if (/^##\s*第\d+页/.test(line.trim()) && CROSS_PAGE_CASES.has(caseNum)) continue;
      break;
    }
    if (isPageFooterNoise(line)) continue;
    if (line.trim()) parts.push(line.trim());
  }

  return parts.join(" ").replace(/\s+/g, " ").trim().slice(0, 500);
}
