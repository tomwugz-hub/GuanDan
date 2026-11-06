// A/B：新 policy 对旧 policy（同牌对换座位）。先 cp -r backups/pre-activity policy_old && rm policy_old/search-index.js，跑完删掉 policy_old。
import { newGame, isOver, isLeading, ctxFor, play, sortHand } from '/workspace/guandan-coach/play/core.js';
import { decide as dNew } from '/workspace/guandan-coach/policy/index.js';
import { decide as dOld } from '/workspace/guandan-coach/policy_old/index.js';
const N = +process.argv[2] || 200;
let pts = 0, wins = 0;
function run(seed, newTeam) {
  const g = newGame({ seed, progression: false });
  let guard = 0;
  while (!isOver(g) && guard++ < 2000) {
    const s = g.round.currentSeat;
    const d = s % 2 === newTeam ? dNew : dOld;
    const rec = d(ctxFor(g, s));
    const res = play(g, s, rec.move.cards || [], { by: 'bot', preferCombo: rec.move.combo });
    if (!res.ok) play(g, s, isLeading(g) ? [sortHand(g.round.hands[s], '2').slice(-1)[0]] : []);
  }
  const o = g.round.finished; const t = o[0] % 2; const p = o[1] % 2 === t ? 3 : o[2] % 2 === t ? 2 : 1;
  return t === newTeam ? p : -p;
}
for (let i = 0; i < N; i++) for (const nt of [0, 1]) { const r = run(90000 + i, nt); pts += r; if (r > 0) wins++; }
console.log(`deals=${2*N} new-team win ${wins}/${2*N} (${(100*wins/(2*N)).toFixed(1)}%), avg level pts ${(pts/(2*N)).toFixed(3)}`);
