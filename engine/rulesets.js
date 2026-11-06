/**
 * 规则集开关。默认宿迁地方规则。
 * 与官方 2022 至少三处不同：过 A、过 A 之后、过 A 失败。
 */
export const RULESETS = {
  SUQIAN: 'suqian',
  OFFICIAL_2022: 'official2022',
};

/**
 * 默认规则集 id（宿迁）。
 * @returns {string}
 */
export function defaultRuleset() {
  return RULESETS.SUQIAN;
}

/**
 * 规则集配置。
 * @param {string} [id]
 * @returns {{ id: string, name: string, passARequiresDoubleDown: boolean, failPassAResetTo2: boolean, afterPassA: string, endMatchOnAnyWinAtA: boolean, bombsBeatStraightFlushFrom: number }}
 */
export function rulesetConfig(id = RULESETS.SUQIAN) {
  if (id === RULESETS.OFFICIAL_2022) {
    return {
      id,
      name: '官方竞技 2022',
      passARequiresDoubleDown: false,
      failPassAResetTo2: false,
      afterPassA: 'endMatch',
      endMatchOnAnyWinAtA: true,
      bombsBeatStraightFlushFrom: 6,
    };
  }
  return {
    id: RULESETS.SUQIAN,
    name: '宿迁地方规则',
    passARequiresDoubleDown: true,
    failPassAResetTo2: true,
    afterPassA: 'resetIfNotDoubleDown',
    endMatchOnAnyWinAtA: false,
    bombsBeatStraightFlushFrom: 6,
  };
}
