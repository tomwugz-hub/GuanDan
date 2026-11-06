/**
 * 元层：对局阶段与风格标签。
 *
 * policy.reasonFor 与牌桌 dealInfo 使用 phaseOf；pack 导出 phaseOf / styleLabel / PHASES。
 * 不要在此写规则或硬过滤。
 */

/** @type {readonly string[]} */
export const PHASES = ['tribute', 'early', 'mid', 'late', 'lastCards'];

/**
 * 按手牌张数估阶段。
 * @param {number} remainingInHand
 * @returns {'early'|'mid'|'late'|'lastCards'}
 */
export function phaseOf(remainingInHand) {
  if (remainingInHand >= 20) return 'early';
  if (remainingInHand >= 10) return 'mid';
  if (remainingInHand >= 3) return 'late';
  return 'lastCards';
}

/**
 * 风格短标签（中文）。
 * @param {string} style
 * @returns {string}
 */
export function styleLabel(style) {
  const map = {
    tight: '紧',
    normal: '中',
    loose: '松',
    aggressive: '凶',
    conservative: '稳',
  };
  return map[style] || '中';
}
