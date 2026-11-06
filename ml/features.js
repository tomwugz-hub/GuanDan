/**
 * 轻量特征提取（无 tensorflow）。专家约束另见 score.js。
 */
import { TYPES, isBombLike } from '../engine/combos.js';

export const FEATURE_NAMES = [
  'size',
  'isBomb',
  'isSF',
  'isPass',
  'isPairSeq',
  'isTripleSeq',
  'isStraight',
  'goOut',
  'smallLead',
  'control',
  'wasteBomb',
  'crushPartner',
  'firstLeadBomb',
  'exposeVsTwo',
  'splitStruct',
  'keepTrash',
];

/**
 * 从上下文与着法抽线性特征。
 * @param {object} ctx
 * @param {{ combo?: object, cards?: object[] }|null} move
 * @returns {Record<string, number>}
 */
export function extractFeatures(ctx, move) {
  const combo = move?.combo || { type: TYPES.PASS, size: 0 };
  const handLen = ctx.hand?.length || 0;
  const size = combo.size || 0;
  const bomb = isBombLike(combo);
  const isBomb = combo.type === TYPES.BOMB ? 1 : 0;
  const isSF = combo.type === TYPES.STRAIGHT_FLUSH ? 1 : 0;
  const prev = ctx.previous;
  const wasteBomb =
    isBomb &&
    prev &&
    prev.type === TYPES.FULLHOUSE &&
    combo.rank === prev.rank &&
    (combo.bombSize || size) === 4
      ? 1
      : 0;
  const crushPartner =
    bomb &&
    ctx.partnerCombo &&
    ctx.partnerCombo.type === TYPES.STRAIGHT &&
    !ctx.winningNow
      ? 1
      : 0;
  const firstLeadBomb = ctx.firstLeadOfDeal && bomb && handLen > size ? 1 : 0;
  const exposeVsTwo =
    (ctx.enemyShort || 99) <= 2 && size === 3 && combo.type === TYPES.TRIPLE && handLen > 3 ? 1 : 0;
  const splitStruct = ctx.wouldSplitStructure ? 1 : 0;
  const keepTrash = handLen <= 2 && combo.type === TYPES.PASS ? 1 : 0;
  return {
    size,
    isBomb,
    isSF,
    isPass: combo.type === TYPES.PASS ? 1 : 0,
    isPairSeq: combo.type === TYPES.PAIR_SEQ ? 1 : 0,
    isTripleSeq: combo.type === TYPES.TRIPLE_SEQ ? 1 : 0,
    isStraight: combo.type === TYPES.STRAIGHT ? 1 : 0,
    goOut: handLen === size && size > 0 ? 1 : 0,
    smallLead: ctx.leading && !bomb ? 1 : 0,
    control: ctx.leading ? 0.5 : 0,
    wasteBomb,
    crushPartner,
    firstLeadBomb,
    exposeVsTwo,
    splitStruct,
    keepTrash,
  };
}

/**
 * 按 FEATURE_NAMES 顺序成向量。
 * @param {Record<string, number>} feat
 * @returns {number[]}
 */
export function featureVector(feat) {
  return FEATURE_NAMES.map((n) => feat[n] ?? 0);
}
