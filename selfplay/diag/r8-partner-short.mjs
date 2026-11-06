// r8：对家小牌+下家短仍过 —— 按“下家能否同型跟”分组列出（读取 audit --dump）
import fs from 'node:fs';
import * as L from '../lib.mjs';
const d = JSON.parse(fs.readFileSync(process.argv[2] || 'selfplay/reports/tmp/det-r7-dump.json'));
const arr = d.decisions.filter((r) => r.rel === 'partner' && (r.prevType === 'single' || r.prevType === 'pair') && r.prevStr <= L.singleStrength('8', r.lv) && r.nextEnemyN > 0 && r.nextEnemyN <= 3 && r.partnerN >= 4 && r.nonBombCleanAvail);
const sz = (r) => (r.prevType === 'pair' ? 2 : 1);
const can = arr.filter((r) => r.nextEnemyN >= sz(r)), cant = arr.filter((r) => r.nextEnemyN < sz(r));
const f = (a) => `${a.filter((r) => r.pass).length}/${a.length}`;
console.log('下家能同型跟', f(can), '下家张数不够跟', f(cant));
for (const r of can) console.log(r.id, r.pass ? 'PASS' : r.moveStr, 'n', r.n, 'next', r.nextEnemyN, 'emin', r.enemyMin, 'pN', r.partnerN, 'lv', r.lv, r.prevStr2, '|', r.cleanEx, '|', r.hand, (r.tags || []).join(','));
