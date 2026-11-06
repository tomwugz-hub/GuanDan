import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const files = [
  'engine/ranks.js',
  'engine/cards.js',
  'engine/combos.js',
  'engine/compare.js',
  'engine/legal.js',
  'engine/tribute.js',
  'engine/rulesets.js',
  'engine/state.js',
  'belief/index.js',
  'search/index.js',
  'ml/features.js',
  'meta/index.js',
  'policy/filters.js',
  'policy/index.js',
  'pedagogy/index.js',
  'user-model/index.js',
];

function strip(src, name) {
  let s = src.replace(/^\s*import\s+[^;]+;\s*$/gm, '');
  s = s.replace(/import\s+weights\s+from\s+'[^']+'\s+with\s+\{[^}]+\};\s*/g, '');
  s = s.replace(/export\s+\{[^}]+\};?/g, '');
  s = s.replace(/export\s+async\s+function/g, 'async function');
  s = s.replace(/export\s+function/g, 'function');
  s = s.replace(/export\s+const/g, 'const');
  s = s.replace(/export\s+\*\s+from\s+[^;]+;/g, '');
  return `\n/* ---- ${name} ---- */\n${s}\n`;
}

const weights = readFileSync(join(root, 'ml/weights.json'), 'utf8');
let body = `const weights = ${weights};\n`;
for (const f of files) {
  body += strip(readFileSync(join(root, f), 'utf8'), f);
}
const score = readFileSync(join(root, 'ml/score.js'), 'utf8');
body += strip(score, 'ml/score.js');

const out = `/* 掼蛋教练浏览器打包（无外部 CDN） */\n(function (global) {\n${body}
  global.Guandan = {
    RANKS, SUITS, RULESETS, TYPES, cards, classify, legalMoves, decide, recommend: decide,
    createMatch, createRound, applyPlay, applyGameResult, rulesetConfig,
    buildBelief, generateCandidates, SKILL_DIMS, RANK_TITLES, ERROR_TYPES,
    weeklyPlan, DRILLS, strengthsWeaknesses, exportReplay, importReplay,
    loadProfile, saveProfile, resetProfile, pushDeal, recordWin, updateDims,
    applyDealToDims, summarizeDeal, agreement, classifyUserError, weightedScore, rankFromScore,
    pickTributeCard, pickReturnCard, isLegalReturnCard, legalReturnCards, tributePlan, applyTributes, previewTributes, resolveTributePairs, canResistTribute, makeDeck, shuffle, dealFourHands,
    formatCard, parseCard, isWildCard, isBombLike, teamOf, defaultProfile,
    phaseOf, styleLabel, PHASES,
  };
})(typeof window !== 'undefined' ? window : globalThis);
`;
writeFileSync(join(root, 'app/all.js'), out);
console.log('packed', out.length);
