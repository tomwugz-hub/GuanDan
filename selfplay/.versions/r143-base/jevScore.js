/**
 * TypeSafe Jev 选择助手：在候选着法中挑一个。
 * 供 UI / 自对弈脚本复用。零依赖，使用原生 fetch。
 */

const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
// 模型可用环境变量 JEV_MODEL 覆盖（试点 jev-1.14.0 等）；默认 jev-latest
const MODEL = (typeof process !== 'undefined' && process.env && process.env.JEV_MODEL) || 'jev-latest';
// 提示词版本：改了 instructions 文本就改它（selfplay 缓存哈希含此值，避免旧答案命中）
// r9：去掉 r7 前的“领出留炸先甩孤儿小单”类规则；拆牌计划 / 逢人配·过大炸弹 / 只能炸时 / 早出控制牌 提示
const PROMPT_VERSION = 'r9e';

/**
 * 用 Jev Choice 在 candidates 中选一个。
 * @param {{
 *   candidates: Array<{ key?: string, label: string, move?: object }>,
 *   state: object|string,
 *   persona?: { name?: string, style?: string, brief?: string },
 *   apiKey: string,
 *   instructions?: string,
 *   timeoutMs?: number,
 * }} opts
 * @returns {Promise<{ index: number, choice: string|null, confidence: number|null, raw: object|null, error?: string }>}
 */
export async function pickWithJev({
  candidates,
  state,
  persona,
  apiKey,
  instructions,
  timeoutMs = 25000,
} = {}) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return { index: 0, choice: null, confidence: null, raw: null, error: 'empty_candidates' };
  }
  if (candidates.length === 1) {
    return { index: 0, choice: candidates[0].key || 'm0', confidence: 1, raw: null };
  }
  if (!apiKey) {
    return { index: 0, choice: null, confidence: null, raw: null, error: 'missing_api_key' };
  }

  const criteria = {};
  for (let i = 0; i < candidates.length; i++) {
    const key = candidates[i].key || `m${i}`;
    criteria[key] = candidates[i].label || key;
  }

  const personaLine = persona
    ? `当前座位人设：${persona.name || ''}（${persona.style || persona.brief || ''}）`
    : '';
  const policyBits = [];
  if (state && typeof state === 'object') {
    if (state.preferPassForPartner) {
      policyBits.push('搭档正在控牌且人设护搭档：必须过牌，不要用对子/炸弹压搭档。');
    } else {
      if (state.toBeatIsPartner && state.hasBombCand)
        policyBits.push('上一手是搭档：可用普通牌，但不要炸搭档。');
      if (state.hasNonBombFollow)
        policyBits.push('存在非炸弹可跟：优先普通跟牌，不要无故过牌，更不要炸。');
    }
    if (state.leading)
      policyBits.push('领出：按 state.handPlan（与 decide 相同的拆牌计划）出牌——优先标 [按计划先出]/[按计划] 的候选，避开标 [拆计划] 的；A/级牌/王/炸弹是控制牌，留到后面。');
    if (state.leading && state.holdLevelHint)
      policyBits.push('级牌/王/A 留着控场，先出计划里的小组件。');
    if (!state.leading && !state.toBeatIsPartner && state.minEnemyCount != null && state.minEnemyCount <= 1 && (state.hasBombCand || state.handHasBomb))
      policyBits.push('敌家只剩最后一手：必须选炸弹打断，禁止过牌。');
    if (state.bombOnlyStop)
      policyBits.push(`出牌的敌人只剩${state.bombOnlyStop}张、候选里只有炸弹能压：选炸弹（选最小够用、标注代价最小的那个），不要过牌。`);
    if (!state.preferPassForPartner && !state.toBeatIsPartner && state.minEnemyCount != null && state.minEnemyCount <= 2 && !state.leading)
      policyBits.push('敌短跟单：优先 BJ/RJ 王，其次 A，不要随便出中单。');
    if (state.previousType === 'fullhouse' && state.minEnemyCount > 1 && (state.hasBombCand || state.handHasBomb) && !state.hasNonBombFollow)
      policyBits.push('对面三带二且只能炸压：选择过牌，勿浪费炸弹。');
    if (state.previousType === 'fullhouse' && state.hasNonBombFollow && !state.preferPassForPartner)
      policyBits.push('对面三带二且有同型可跟：跟三带二，不要过牌、不要炸。');
    if (Array.isArray(state.policyHints) && state.policyHints.length) {
      const hints = state.preferPassForPartner
        ? state.policyHints.filter((h) => !/能非炸则跟|敌短优先压制|优先用王/.test(h))
        : state.policyHints;
      if (hints.length) policyBits.push('要点：' + hints.join('；') + '。');
    }
  }
  const instr =
    instructions ||
    [
      '你是掼蛋出牌选择器。根据 state 中的局面与人设，从 criteria 中选一个最合适的出牌编号。',
      personaLine,
      '跟牌时：若 criteria 里有非炸弹的同型可跟，优先选它，而不是过牌；不要用炸弹/同花顺去压搭档刚出的普通牌。',
      '敌家只剩 1–2 张时，优先能盖住的牌（含大小王）；不要无故过牌。',
      '能一次出完手牌的候选优先。炸弹留给真正危险（敌短牌或炸弹战），不要砸中等单张。',
      '候选按 decide 评分从高到低排列；要炸时选最小够用的炸弹，标 [用逢人配]/[炸弹过大] 的炸弹代价大。',
      '优先遵循人设；partner-first / 护搭档时更忌炸搭档。',
      ...policyBits,
      '只返回给定的选项键之一。',
    ]
      .filter(Boolean)
      .join(' ');

  const body = {
    model: MODEL,
    state:
      typeof state === 'string'
        ? state
        : {
            ...state,
            persona: persona
              ? { name: persona.name, style: persona.style || persona.brief }
              : state.persona,
          },
    questions: {
      move: {
        type: 'choice',
        instructions: instr,
        criteria,
      },
    },
  };

  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  let raw = null;
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: ctrl?.signal,
    });
    const text = await res.text();
    try {
      raw = JSON.parse(text);
    } catch {
      raw = { status: res.status, body: text.slice(0, 400) };
    }
    if (!res.ok) {
      return {
        index: 0,
        choice: null,
        confidence: null,
        raw,
        error: `http_${res.status}`,
      };
    }
    const ans = raw?.answers?.move;
    const choice = ans?.choice ?? null;
    const confidence = typeof ans?.confidence === 'number' ? ans.confidence : null;
    let index = candidates.findIndex((c, i) => (c.key || `m${i}`) === choice);
    if (index < 0 && typeof choice === 'string' && /^m\d+$/.test(choice)) {
      index = Number(choice.slice(1));
    }
    if (index < 0 || index >= candidates.length) {
      return { index: 0, choice, confidence, raw, error: 'invalid_choice' };
    }
    return { index, choice, confidence, raw };
  } catch (e) {
    return {
      index: 0,
      choice: null,
      confidence: null,
      raw,
      error: e?.name === 'AbortError' ? 'timeout' : String(e?.message || e),
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export { ENDPOINT as JEV_ENDPOINT, MODEL as JEV_MODEL, PROMPT_VERSION as JEV_PROMPT_VERSION };
