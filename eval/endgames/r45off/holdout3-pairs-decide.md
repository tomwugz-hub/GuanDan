# Pair eval report

- generated: 2026-10-27T01:52:19.499Z
- file: holdout3-pairs.jsonl
- cases: 56, pairs: 28
- gold legality: 56/56 legal

| system | case acc | pair acc |
|---|---|---|
| decide | 56/56 (100.0%) | 28/28 (100.0%) |

| id | pivot | gold | decide |  ok |
|---|---|---|---|---|
| m01a | next enemy(2) count 2 vs 7 after partner(3) single 9; seat1 | single:K | single:K{K} |  d:✓ |
| m01b | next enemy(2) count 2 vs 7 after partner(3) single 9; seat1 | pass | pass |  d:✓ |
| m02a | partner(2) played FH 7 vs single 7; next enemy(1) has 2 | fullhouse:J | fullhouse:J{JJJ44} |  d:✓ |
| m02b | partner(2) played FH 7 vs single 7; next enemy(1) has 2 | single:Q | single:Q{Q} |  d:✓ |
| m03a | overtake partner pair 6 to go out: hand 99 vs 99+4+7 | pair:9 | pair:9{99} |  d:✓ |
| m03b | overtake partner pair 6 to go out: hand 99 vs 99+4+7 | pass | pass |  d:✓ |
| m04a | partner(2) count 1 vs 6 after partner single 10; next enemy(1) has 2 | pass | pass |  d:✓ |
| m04b | partner(2) count 1 vs 6 after partner single 10; next enemy(1) has 2 | single:A | single:A{A} |  d:✓ |
| m05a | persona partner-first vs none; next enemy(1) has 2; partner single J | single:A | single:A{A} |  d:✓ |
| m05b | persona partner-first vs none; next enemy(1) has 2; partner single J | pass | pass |  d:✓ |
| m07a | overtake partner single 5 when finishing in 2 (Q+88) vs not (Q+8+9) | single:Q | single:Q{Q} |  d:✓ |
| m07b | overtake partner single 5 when finishing in 2 (Q+88) vs not (Q+8+9) | pass | pass |  d:✓ |
| m09a | enemy(1, 1 card) single A vs 4x9 bomb; bombs 5555 & QQQQ | bomb:5 | bomb:5{5555} |  d:✓ |
| m09b | enemy(1, 1 card) single A vs 4x9 bomb; bombs 5555 & QQQQ | bomb:Q | bomb:Q{QQQQ} |  d:✓ |
| m10a | enemy(1, 1 card) single A vs 5x7 bomb; 6666 + straight flush | bomb:6 | bomb:6{6666} |  d:✓ |
| m10b | enemy(1, 1 card) single A vs 5x7 bomb; 6666 + straight flush | straightFlush: | straightFlush:Q{8910JQ} |  d:✓ |
| m11a | enemy(1) count 2 vs 6; triple 5 vs KKK88+3 | triple:K | triple:K{KKK} |  d:✓ |
| m11b | enemy(1) count 2 vs 6; triple 5 vs KKK88+3 | pass | pass |  d:✓ |
| m13a | one-card seat is enemy(1) vs partner(2); BJBJ 44 9 | pair:4 | pair:4{44} |  d:✓ |
| m13b | one-card seat is enemy(1) vs partner(2); BJBJ 44 9 | single:9 | single:9{9} |  d:✓ |
| m15a | levelRank 7 (7H wild) vs 2; follow straight 4-8 by enemy | straight: | straight:Q{910JQ7} |  d:✓ |
| m15b | levelRank 7 (7H wild) vs 2; follow straight 4-8 by enemy | pass | pass |  d:✓ |
| m17a | partner(2) count 1 vs 5 with [BJ,6] | single:BJ | single:BJ{BJ} |  d:✓ |
| m17b | partner(2) count 1 vs 5 with [BJ,6] | single:6 | single:6{6} |  d:✓ |
| m19a | enemy(1) count 2 vs partner(2) count 2; straight + QQ | straight:3/7 | straight:7{34567} |  d:✓ |
| m19b | enemy(1) count 2 vs partner(2) count 2; straight + QQ | pair:Q | pair:Q{QQ} |  d:✓ |
| m21a | partner(2) played pair 9 vs single 9; next enemy(1) has 1 | pass | pass |  d:✓ |
| m21b | partner(2) played pair 9 vs single 9; next enemy(1) has 1 | single:Q/K | single:K{K} |  d:✓ |
| m22a | bomb goes out over partner: 7777 vs 7777+3 | bomb:7 | bomb:7{7777} |  d:✓ |
| m22b | bomb goes out over partner: 7777 vs 7777+3 | pass | pass |  d:✓ |
| m27a | one-card seat is partner(2) vs enemy(1); 33 J 8 | single:8 | single:8{8} |  d:✓ |
| m27b | one-card seat is partner(2) vs enemy(1); 33 J 8 | pair:3 | pair:3{33} |  d:✓ |
| m29a | one-card seat is enemy(3) vs partner(2); 9999 66 | pair:6 | pair:6{66} |  d:✓ |
| m29b | one-card seat is enemy(3) vs partner(2); 9999 66 | single:6 | single:6{6} |  d:✓ |
| m32a | enemy(1) count 1 vs 6 vs pair K; 4444 + 10101010 | bomb:4 | bomb:4{4444} |  d:✓ |
| m32b | enemy(1) count 1 vs 6 vs pair K; 4444 + 10101010 | pass | pass |  d:✓ |
| m33a | enemy(1, 1 card) single A vs 6x8 bomb; rocket + 5555 | bomb:5 | bomb:5{5555} |  d:✓ |
| m33b | enemy(1, 1 card) single A vs 6x8 bomb; rocket + 5555 | bomb:RJ | bomb:RJ{BJBJRJRJ} |  d:✓ |
| m45a | enemy(1) count 2 vs 6; level pair J vs pair A | pair:J | pair:J{JJ} |  d:✓ |
| m45b | enemy(1) count 2 vs 6; level pair J vs pair A | pair:J | pair:J{JJ} |  d:✓ |
| m48a | one-card seat is enemy(1) vs partner(2); AA 5 | pair:A | pair:A{AA} |  d:✓ |
| m48b | one-card seat is enemy(1) vs partner(2); AA 5 | single:5 | single:5{5} |  d:✓ |
| m49a | two-card seat is enemy(1) vs partner(2); 66 JJ 3 | single:3 | single:3{3} |  d:✓ |
| m49b | two-card seat is enemy(1) vs partner(2); 66 JJ 3 | pair:6 | pair:6{66} |  d:✓ |
| m50a | 4x9 bomb by partner(2) vs enemy(1); enemy(1) has 1; straight flush | pass | pass |  d:✓ |
| m50b | 4x9 bomb by partner(2) vs enemy(1); enemy(1) has 1; straight flush | straightFlush: | straightFlush:7{34567} |  d:✓ |
| m51a | next enemy(1) count 2 vs 5 after partner pair 8 | pair:J | pair:J{JJ} |  d:✓ |
| m51b | next enemy(1) count 2 vs 5 after partner pair 8 | pass | pass |  d:✓ |
| m53a | next enemy(1) has 2 after partner single 6: 8888+3 vs 8888+3+9 | pass | pass |  d:✓ |
| m53b | next enemy(1) has 2 after partner single 6: 8888+3 vs 8888+3+9 | single:9 | single:9{9} |  d:✓ |
| m54a | partner played FH 5 vs triple 5; TTT77 hand | fullhouse:10 | fullhouse:10{10101077} |  d:✓ |
| m54b | partner played FH 5 vs triple 5; TTT77 hand | pass | pass |  d:✓ |
| m58a | partner(2) count 2 vs 7; 33 10 QQ | pair:3 | pair:3{33} |  d:✓ |
| m58b | partner(2) count 2 vs 7; 33 10 QQ | single:10 | single:10{10} |  d:✓ |
| m59a | next enemy(1) count 2 vs 6 after partner single 3 | single:K | single:K{K} |  d:✓ |
| m59b | next enemy(1) count 2 vs 6 after partner single 3 | pass | pass |  d:✓ |
