/**
 * 教学层：只点评、规划、训练，不改变真实出牌。
 */
import { TYPES, isBombLike } from '../engine/combos.js';
import { decide } from '../policy/index.js';

export const SKILL_DIMS = [
  { id: 'pattern', name: '牌型识别', weight: 0.2 },
  { id: 'coop', name: '合作意识', weight: 0.2 },
  { id: 'bomb', name: '炸弹使用', weight: 0.15 },
  { id: 'clutch', name: '关键时刻', weight: 0.15 },
  { id: 'tribute', name: '进贡选择', weight: 0.15 },
  { id: 'returnTribute', name: '还贡策略', weight: 0.15 },
];

export const RANK_TITLES = ['初学者', '入门', '熟练', '高手', '高段', '大师'];

export const ERROR_TYPES = [
  { id: 'bombWaste', name: '炸弹浪费', severity: '严重' },
  { id: 'breakStruct', name: '破结构', severity: '严重' },
  { id: 'coopFail', name: '合作失误', severity: '中' },
  { id: 'clutchFail', name: '关键失误', severity: '中' },
  { id: 'tributePick', name: '进贡选择', severity: '中' },
  { id: 'returnTribute', name: '还贡策略', severity: '轻' },
  { id: 'infoMiss', name: '信息失误', severity: '轻' },
  { id: 'other', name: '其他', severity: '轻' },
];

/**
 * 六维加权总分。
 * @param {Record<string, number>} dims
 * @returns {number}
 */
export function weightedScore(dims) {
  let s = 0;
  for (const d of SKILL_DIMS) s += (dims[d.id] ?? 0) * d.weight;
  return s;
}

/**
 * 分数对应称号。
 * @param {number} score
 * @returns {string}
 */
export function rankFromScore(score) {
  if (score < 20) return RANK_TITLES[0];
  if (score < 40) return RANK_TITLES[1];
  if (score < 58) return RANK_TITLES[2];
  if (score < 74) return RANK_TITLES[3];
  if (score < 88) return RANK_TITLES[4];
  return RANK_TITLES[5];
}

/**
 * 对照建议给用户着法贴错误类型。
 * @param {{ combo?: object, cards?: object[] }|null} userMove
 * @param {{ combo?: object, cards?: object[] }|null} recMove
 * @param {object} [ctx]
 * @returns {{ id: string, name: string, severity: string }}
 */
export function classifyUserError(userMove, recMove, ctx = {}) {
  const u = userMove?.combo;
  const r = recMove?.combo;
  if (!u) return { id: 'other', name: '其他', severity: '轻' };
  if (isBombLike(u) && ctx.firstLeadOfDeal) {
    return ERROR_TYPES.find((e) => e.id === 'bombWaste');
  }
  if (u.type === TYPES.BOMB && ctx.previous?.type === TYPES.FULLHOUSE && u.rank === ctx.previous.rank) {
    return ERROR_TYPES.find((e) => e.id === 'bombWaste');
  }
  if (u.type === TYPES.STRAIGHT_FLUSH && ctx.previous?.type === TYPES.SINGLE) {
    return ERROR_TYPES.find((e) => e.id === 'bombWaste');
  }
  if (ctx.partnerCombo?.type === TYPES.STRAIGHT && isBombLike(u)) {
    return ERROR_TYPES.find((e) => e.id === 'coopFail');
  }
  if ((ctx.enemyShort || 99) <= 2 && u.type === TYPES.TRIPLE && (ctx.hand?.length || 0) > 3) {
    return ERROR_TYPES.find((e) => e.id === 'clutchFail');
  }
  if (ctx.wouldSplit) return ERROR_TYPES.find((e) => e.id === 'breakStruct');
  if (ctx.phase === 'tribute') return ERROR_TYPES.find((e) => e.id === 'tributePick');
  if (ctx.phase === 'return') return ERROR_TYPES.find((e) => e.id === 'returnTribute');
  if (u.type !== r?.type && u.type !== TYPES.PASS) return ERROR_TYPES.find((e) => e.id === 'infoMiss');
  return ERROR_TYPES.find((e) => e.id === 'other');
}

/**
 * 用户着法与建议是否同牌。
 * @param {{ cards?: object[] }|null} userMove
 * @param {{ cards?: object[] }|null} recMove
 * @returns {boolean}
 */
export function agreement(userMove, recMove) {
  if (!userMove || !recMove) return false;
  const a = (userMove.cards || []).map((c) => c.id).sort().join(',');
  const b = (recMove.cards || []).map((c) => c.id).sort().join(',');
  return a === b;
}

/**
 * 一局同意率。
 * @param {{ agree?: boolean }[]} records
 * @returns {{ plays: number, agree: number, rate: number }}
 */
export function summarizeDeal(records) {
  const n = records.length || 1;
  const ok = records.filter((r) => r.agree).length;
  return { plays: records.length, agree: ok, rate: ok / n };
}

/**
 * 导出回放 JSON 文本。
 * @param {object[]} deals
 * @returns {string}
 */
export function exportReplay(deals) {
  return JSON.stringify({ v: 1, kind: '掼蛋回放', deals }, null, 2);
}

/**
 * 导入回放。
 * @param {string|object} text
 * @returns {{ deals: object[] }}
 * @throws {Error} 回放格式无效
 */
export function importReplay(text) {
  const data = typeof text === 'string' ? JSON.parse(text) : text;
  if (!data || !Array.isArray(data.deals)) throw new Error('回放格式无效');
  return data;
}

/**
 * 按短板生成一周训练计划。
 * @param {Record<string, number>} dims
 * @returns {{ day: string, focus: string, drill: string, minutes: number }[]}
 */
export function weeklyPlan(dims) {
  const weak = SKILL_DIMS.slice()
    .sort((a, b) => (dims[a.id] ?? 0) - (dims[b.id] ?? 0))
    .slice(0, 3);
  const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  return days.map((day, i) => ({
    day,
    focus: weak[i % weak.length].name,
    drill: drillByDim(weak[i % weak.length].id),
    minutes: 20 + (i % 3) * 5,
  }));
}

/**
 * 维度对应训练 id。
 * @param {string} id
 * @returns {string}
 */
export function drillByDim(id) {
  const map = {
    pattern: 'press-same-suit-straight',
    coop: 'cooperation',
    bomb: 'bomb-timing',
    clutch: 'bomb-timing',
    tribute: 'tribute',
    returnTribute: 'return-tribute',
  };
  return map[id] || 'cooperation';
}

export const DRILLS = [
  { id: 'press-same-suit-straight', name: '压同花顺', dim: 'pattern', brief: '练习识别并压过同花顺。' },
  { id: 'bomb-timing', name: '炸弹时机', dim: 'bomb', brief: '首轮不炸、不浪费炸。' },
  { id: 'tribute', name: '进贡', dim: 'tribute', brief: '选择最大非王进贡。' },
  { id: 'return-tribute', name: '还贡', dim: 'returnTribute', brief: '还自然点 ≤10 的牌。' },
  { id: 'cooperation', name: '合作', dim: 'coop', brief: '不砸搭档顺子。' },
];

/**
 * 一局后微调六维（夹在 0–100）。
 * @param {Record<string, number>} dims
 * @param {{ rate?: number }} dealSummary
 * @param {{ id: string }[]} errors
 * @returns {Record<string, number>}
 */
export function applyDealToDims(dims, dealSummary, errors) {
  const next = { ...dims };
  const rate = dealSummary.rate ?? 0;
  next.pattern += (rate - 0.5) * 4;
  if (errors.some((e) => e.id === 'coopFail')) next.coop -= 3;
  else next.coop += 0.5;
  if (errors.some((e) => e.id === 'bombWaste')) next.bomb -= 4;
  else next.bomb += 0.4;
  if (errors.some((e) => e.id === 'clutchFail')) next.clutch -= 3;
  else next.clutch += 0.3;
  if (errors.some((e) => e.id === 'tributePick')) next.tribute -= 2;
  else next.tribute += 0.2;
  if (errors.some((e) => e.id === 'returnTribute')) next.returnTribute -= 1;
  else next.returnTribute += 0.2;
  for (const k of Object.keys(next)) next[k] = Math.max(0, Math.min(100, next[k]));
  return next;
}

/**
 * 优势 / 短板与建议。
 * @param {Record<string, number>} dims
 * @returns {{ strengths: object[], weaknesses: object[], suggestions: string[] }}
 */
export function strengthsWeaknesses(dims) {
  const items = SKILL_DIMS.map((d) => ({ ...d, score: dims[d.id] ?? 0 }));
  items.sort((a, b) => b.score - a.score);
  return {
    strengths: items.slice(0, 2),
    weaknesses: items.slice(-2).reverse(),
    suggestions: items.slice(-2).map((d) => `加强「${d.name}」：完成训练「${DRILLS.find((x) => x.dim === d.id)?.name || '综合'}」。`),
  };
}

/**
 * 仅教学点评，不改真实出牌。
 * @param {object} ctx
 * @returns {{ recommend: object, teachingOnly: true }}
 */
export function coachComment(ctx) {
  const rec = decide(ctx);
  return { recommend: rec, teachingOnly: true };
}

