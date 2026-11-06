/**
 * 线性价值/策略分。专家知识硬编码：绝不“学会”浪费炸弹。
 */
import weights from './weights.json' with { type: 'json' };
import { extractFeatures, featureVector, FEATURE_NAMES } from './features.js';
import { isBombLike } from '../engine/combos.js';

/**
 * 线性价值。
 * @param {Record<string, number>} feat
 * @param {{ bias?: number, w?: Record<string, number> }} [w]
 * @returns {number}
 */
export function linearValue(feat, w = weights) {
  let s = w.bias || 0;
  for (const name of FEATURE_NAMES) {
    s += (feat[name] || 0) * (w.w[name] || 0);
  }
  return s;
}

/**
 * 策略分（含浪费炸弹硬扣）。
 * @param {object} ctx
 * @param {{ combo?: object }} move
 * @param {object} [w]
 * @returns {{ score: number, features: object }}
 */
export function policyScore(ctx, move, w = weights) {
  const feat = extractFeatures(ctx, move);
  let s = linearValue(feat, w);
  // 硬约束：浪费炸弹永远大负，不会被自对弈改掉
  if (feat.wasteBomb || feat.firstLeadBomb || feat.crushPartner) {
    s -= 50;
  }
  if (isBombLike(move.combo) && ctx.forbidBomb) s -= 50;
  return { score: s, features: feat };
}

/**
 * policyScore 的纯分数。
 * @param {object} ctx
 * @param {{ combo?: object }} move
 * @returns {number}
 */
export function valueScore(ctx, move) {
  return policyScore(ctx, move).score;
}

/**
 * 极小自对弈微调：只动非专家项，且幅度极小。
 * @param {{ bias: number, w: Record<string, number> }} w
 * @param {Record<string, number>} [grad]
 * @returns {{ bias: number, w: Record<string, number> }}
 */
export function tweakWeights(w, grad = {}) {
  const next = { bias: w.bias, w: { ...w.w } };
  const locked = new Set(['wasteBomb', 'crushPartner', 'firstLeadBomb']);
  for (const [k, g] of Object.entries(grad)) {
    if (locked.has(k)) continue;
    if (next.w[k] === undefined) continue;
    next.w[k] = next.w[k] + 0.001 * g;
  }
  return next;
}

export { weights, extractFeatures, featureVector };
