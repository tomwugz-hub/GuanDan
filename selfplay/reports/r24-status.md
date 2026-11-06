# r24 status

- **Outcome:** REJECTED (not shipped)
- **Approach vs r22:** narrower than rejected r22 bit2 (any non-breaker within 90) and bit4 (spare-in-window within 90). Tried hand-size gates, unique-interior-only, endpoint-spare-only, soft penalty, ultra-narrow (hand≥22 + prev≤9). All A/B negative.
- **Root cause:** `earlyFollowCost` cost-0 on unique straight ranks + orphan anti-break −40 on spare K.
- **Default:** GD_R24=0 (opt-in bit1 = ultra-narrow). GD_R22=1, GD_R23=7 unchanged.
- **n25:** default still 10S; GD_R24=1 → KC.
- **A/B best (least bad):** v1 −0.041 n.s.; worst v3 −0.083 [−0.148,−0.017].
- **Tests:** 479/479; regress = r23-ship.
- **Cache:** unchanged guandan-play-d063049677
- **Paths:** selfplay/reports/r24.md, backups/r24-rejected-candidates/, backups/pre-r24/, backups/r24-base/, test/r24.test.js, logs/ab-r24-*.log
