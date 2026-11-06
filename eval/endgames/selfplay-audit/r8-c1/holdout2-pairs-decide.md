# Pair eval report

- generated: 2026-10-19T04:40:40.861Z
- file: holdout2-pairs.jsonl
- cases: 58, pairs: 29
- gold legality: 58/58 legal

| system | case acc | pair acc |
|---|---|---|
| decide | 58/58 (100.0%) | 29/29 (100.0%) |

| id | pivot | gold | decide |  ok |
|---|---|---|---|---|
| k01a | partner(0) count 2 vs 9; seat2 leads | pair:3 | pair:3{33} |  d:✓ |
| k01b | partner(0) count 2 vs 9; seat2 leads | single:7 | single:7{7} |  d:✓ |
| k02a | two-card seat is partner(1) vs enemy(0); seat3 leads | pair:6 | pair:6{66} |  d:✓ |
| k02b | two-card seat is partner(1) vs enemy(0); seat3 leads | single: | single:9{9} |  d:✓ |
| k03a | levelRank 2 vs 4 with [J,4] two singles | single:J | single:J{J} |  d:✓ |
| k03b | levelRank 2 vs 4 with [J,4] two singles | single:4 | single:4{4} |  d:✓ |
| k04a | partner(2) count 1 vs 4 with [A,5] | single:5 | single:5{5} |  d:✓ |
| k04b | partner(2) count 1 vs 4 with [A,5] | single:A | single:A{A} |  d:✓ |
| k05a | enemy(1) count 1 vs 5; wild pair to stop pair 8 | pair:J/9 | pair:J{J10} |  d:✓ |
| k05b | enemy(1) count 1 vs 5; wild pair to stop pair 8 | pass | pass |  d:✓ |
| k06a | level card suit H (wild) vs S (not wild); enemy last card | bomb:10 | bomb:10{1010103} |  d:✓ |
| k06b | level card suit H (wild) vs S (not wild); enemy last card | pass | pass |  d:✓ |
| k07a | enemy(3) count 2 vs 6; 888+Q+4 lead | triple:8 | triple:8{888} |  d:✓ |
| k07b | enemy(3) count 2 vs 6; 888+Q+4 lead | single:4 | single:4{4} |  d:✓ |
| k09a | enemy(0) count 6 vs 2; FH hand vs pair 5 (seat3) | pass | pass |  d:✓ |
| k09b | enemy(0) count 6 vs 2; FH hand vs pair 5 (seat3) | pair:J | pair:J{JJ} |  d:✓ |
| k10a | previous single 3 vs 5 (2-play hand QQQ77+4) | single:4 | single:4{4} |  d:✓ |
| k10b | previous single 3 vs 5 (2-play hand QQQ77+4) | pass | pass |  d:✓ |
| k12a | previous bomb 4 vs 5 sevens; enemy last card | bomb:J | bomb:J{JJJJ} |  d:✓ |
| k12b | previous bomb 4 vs 5 sevens; enemy last card | pass | pass |  d:✓ |
| k13a | straight flush by enemy(1, 1 card) vs partner(2); rocket | bomb:RJ | bomb:RJ{BJBJRJRJ} |  d:✓ |
| k13b | straight flush by enemy(1, 1 card) vs partner(2); rocket | pass | pass |  d:✓ |
| k14a | enemy(1) count 2 vs partner(2) count 1; plate hand | tripleSeq:5/6 | tripleSeq:6{555666} |  d:✓ |
| k14b | enemy(1) count 2 vs partner(2) count 1; plate hand | single:5 | single:5{5} |  d:✓ |
| k16a | enemy(1) count 2 vs 5; follow pair 10 | pair:A | pair:A{AA} |  d:✓ |
| k16b | enemy(1) count 2 vs 5; follow pair 10 | pair:J | pair:J{JJ} |  d:✓ |
| k17a | next enemy(1) count 1 vs 6 after partner(2) single Q | single:A | single:A{A} |  d:✓ |
| k17b | next enemy(1) count 1 vs 6 after partner(2) single Q | pass | pass |  d:✓ |
| k21a | one-card seat is enemy(3) vs partner(2) with [K,6] | single:K | single:K{K} |  d:✓ |
| k21b | one-card seat is enemy(3) vs partner(2) with [K,6] | single:6 | single:6{6} |  d:✓ |
| k22a | enemy(1) count 1 vs 7; wild level single vs K | single:5 | single:5{5} |  d:✓ |
| k22b | enemy(1) count 1 vs 7; wild level single vs K | pass | pass |  d:✓ |
| k23a | enemy(1) count 2 vs 6; FH lead KKK66+3+8 | fullhouse:K | fullhouse:K{KKK66} |  d:✓ |
| k23b | enemy(1) count 2 vs 6; FH lead KKK66+3+8 | single:3 | single:3{3} |  d:✓ |
| k27a | single 10 by partner(2, 1 card left) vs enemy(1) | pass | pass |  d:✓ |
| k27b | single 10 by partner(2, 1 card left) vs enemy(1) | single:J | single:J{J} |  d:✓ |
| k30a | enemy(1) count 1 vs 6; tube by enemy, bomb in hand | bomb:9 | bomb:9{9999} |  d:✓ |
| k30b | enemy(1) count 1 vs 6; tube by enemy, bomb in hand | pass | pass |  d:✓ |
| k34a | enemy(3) count 6 vs 1; lead with 55 9 QQ K | single:9 | single:9{9} |  d:✓ |
| k34b | enemy(3) count 6 vs 1; lead with 55 9 QQ K | pair:5/Q | pair:5{55} |  d:✓ |
| k37a | levelRank 2 vs 9 with [A,2] two singles (seat3) | single:2 | single:2{2} |  d:✓ |
| k37b | levelRank 2 vs 9 with [A,2] two singles (seat3) | single:A | single:A{A} |  d:✓ |
| k42a | hand size 1 vs 2 when partner(2) played single 8 | single:Q | single:Q{Q} |  d:✓ |
| k42b | hand size 1 vs 2 when partner(2) played single 8 | pass | pass |  d:✓ |
| k43a | previous FH 10 vs triple 10 (KKK99 hand) | fullhouse:K | fullhouse:K{KKK99} |  d:✓ |
| k43b | previous FH 10 vs triple 10 (KKK99 hand) | pass | pass |  d:✓ |
| k44a | levelRank 6 (6H wild) vs 2; tube go-out | pairSeq:7/8/9 | pairSeq:9{778896} |  d:✓ |
| k44b | levelRank 6 (6H wild) vs 2; tube go-out | single:6 | single:6{6} |  d:✓ |
| k46a | two-card seat is partner(2) vs enemy(1); all-pairs QQKK | pair:Q | pair:Q{QQ} |  d:✓ |
| k46b | two-card seat is partner(2) vs enemy(1); all-pairs QQKK | single: | single:K{K} |  d:✓ |
| k47a | enemy(1) count 2 vs 7; follow single K with BJ/A | single:BJ | single:BJ{BJ} |  d:✓ |
| k47b | enemy(1) count 2 vs 7; follow single K with BJ/A | single:A | single:A{A} |  d:✓ |
| k48a | enemy(1) count 1 vs 6; tube hand vs pair 9 | pair:Q | pair:Q{QQ} |  d:✓ |
| k48b | enemy(1) count 1 vs 6; tube hand vs pair 9 | pass | pass |  d:✓ |
| k54a | one-card enemy is next(1) vs already-passed(3), after partner Q | single:A | single:A{A} |  d:✓ |
| k54b | one-card enemy is next(1) vs already-passed(3), after partner Q | pass | pass |  d:✓ |
| k56a | enemy(1) count 2 vs 6; AAA55 vs single Q | single:A | single:A{A} |  d:✓ |
| k56b | enemy(1) count 2 vs 6; AAA55 vs single Q | pass | pass |  d:✓ |
