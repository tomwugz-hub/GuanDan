// r8：r7 自对局里“压对家普通牌”的局面（非走完、非炸）：按对家这手大小/对家张数分组
import fs from 'node:fs';
import * as L from '../lib.mjs';
const d = JSON.parse(fs.readFileSync(process.argv[2] || 'selfplay/reports/tmp/det-r7-dump.json'));
const arr = d.decisions.filter((r) => r.rel === 'partner' && !r.pass && !r.bomb && r.size < r.n);
const g = {};
for (const r of arr) {
  const big = ['A', 'BJ', 'RJ', r.lv].includes(r.prevRank) ? 'bigA+' : r.prevStr >= L.singleStrength('J', r.lv) ? 'JQK' : 'small';
  const k = `${r.prevType}|${big}|p${r.partnerN === 0 ? 0 : r.partnerN <= 2 ? '1-2' : '3+'}|next${r.nextEnemyN}`;
  (g[k] ||= []).push(r);
}
for (const [k, v] of Object.entries(g).sort((a, b) => b[1].length - a[1].length)) console.log(k, v.length, v.slice(0, 3).map((r) => r.id).join(' '));
if (process.argv[3]) fs.writeFileSync(process.argv[3], arr.filter((r) => ['A', 'BJ', 'RJ', r.lv].includes(r.prevRank) || r.partnerN === 0).map((r) => r.id).join('\n'));
