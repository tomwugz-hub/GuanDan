import { readFileSync } from 'node:fs';
import { cards } from '/workspace/guandan-coach/engine/cards.js';
import { classify } from '/workspace/guandan-coach/engine/combos.js';
import { legalMoves } from '/workspace/guandan-coach/engine/legal.js';
const ORD=['2','3','4','5','6','7','8','9','10','J','Q','K','A','BJ','RJ'];
const pick=JSON.parse(readFileSync('/tmp/picked.json','utf8'));
const from=Number(process.argv[2]||0), to=Number(process.argv[3]||pick.length);
for (const r of pick.slice(from,to)) {
  const s=r.seat, lv=r.levelRank, h=r.hands[String(s)];
  const rk=(x)=>x==='BJ'||x==='RJ'?x:x.slice(0,-1);
  const sorted=[...h].sort((a,b)=>ORD.indexOf(rk(a))-ORD.indexOf(rk(b)));
  const c=[0,1,2,3].map(i=>r.hands[String(i)].length);
  const prev=r.leading?null:classify(cards(r.previous.cards),lv);
  const lp=r.trickMeta?.lastPlayer;
  const who=lp==null?'':lp===(s+2)%4?'PARTNER':lp===(s+1)%4?'nextEnemy':'prevEnemy';
  const ms=legalMoves(cards(h),prev,lv,r.leading).filter(m=>m.cards.length);
  const g={};
  for(const m of ms){const t=m.combo.type;const k=m.combo.rank+(m.combo.type==='bomb'?'x'+m.cards.length:'')+(m.combo.wilds?'w':'');(g[t]??=new Set()).add(k);}
  const opts=Object.entries(g).map(([t,v])=>`${t}:${[...v].join(',')}`).join(' | ');
  console.log(`${r.rid} L${lv} ${r.leading?'LEAD':'FOLLOW '+r.previous.type+':'+r.previous.rank+'('+r.previous.cards.join('')+') by '+who} | me${c[s]} next${c[(s+1)%4]} partner${c[(s+2)%4]} prev${c[(s+3)%4]}\n   hand: ${sorted.join(' ')}\n   opts: ${opts||'(none)'}`);
}
