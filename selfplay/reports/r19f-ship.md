# r19f ship (2026-10-25)
User overruled keep-rule rejection of Fix F (endgame search with 接风). Move 86 (game3/game4 deal1, hand [RJ,KC], all seats on 2): leading RJ then K lets next seat cover K with 2 and partner cannot 接风 — absolute error. Correct: lead K, keep RJ (MC +0.74 for K). A/B ~0 (rare trigger), no regressions → shipped as correctness fix.
- Restored policy/endgame.js + Fix F block in policy/index.js from backups/r19-rejected-candidates; GD_R19F default ON (1). Fix G (GD_R19G bomb-to-seize) remains REJECTED / not included.
- Retains r14 + r19 reason-text/export fixes.
- New test test/r19.test.js "r19f endgame: move 86 ... leads K" (passes; fails with GD_R19F=0).
- Regress = r14/r19 baseline exactly (dev-r6 143, follow 143, lead 146, real 119, cases 50, pairs 60, holdout 62/58/55/55, real3 107, real4 108). npm test serial (test/) 452/452.
- Published guandan-play-1994a92001 (live sw.js verified, bundle md5 d15b2882… matches). Backup: backups/post-r19f.
