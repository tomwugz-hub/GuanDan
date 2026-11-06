# Pair eval report

- generated: 2026-10-20T14:12:39.073Z
- file: pairs.jsonl
- cases: 60, pairs: 30
- gold legality: 60/60 legal

| system | case acc | pair acc |
|---|---|---|
| decide | 60/60 (100.0%) | 30/30 (100.0%) |

| id | pivot | gold | decide |  ok |
|---|---|---|---|---|
| p01a | lastPlayer partner(2) vs enemy(1) | pass | pass |  d:✓ |
| p01b | lastPlayer partner(2) vs enemy(1) | single:K | single:K{K} |  d:✓ |
| p02a | lastPlayer partner(2) vs enemy(1) | pass | pass |  d:✓ |
| p02b | lastPlayer partner(2) vs enemy(1) | pair:Q | pair:Q{QQ} |  d:✓ |
| p03a | lastPlayer partner(2) vs enemy(1); enemy1 has 1 card | pass | pass |  d:✓ |
| p03b | lastPlayer partner(2) vs enemy(1); enemy1 has 1 card | bomb:8 | bomb:8{8888} |  d:✓ |
| p20a | previous bomb by partner(2) vs enemy(1); enemy1 has 1 card | pass | pass |  d:✓ |
| p20b | previous bomb by partner(2) vs enemy(1); enemy1 has 1 card | bomb:10 | bomb:10{10101010} |  d:✓ |
| p28a | lastPlayer partner(2) vs enemy(1); enemy1 has 2 cards | pass | pass |  d:✓ |
| p28b | lastPlayer partner(2) vs enemy(1); enemy1 has 2 cards | single:RJ | single:RJ{RJ} |  d:✓ |
| p58a | lastPlayer partner(2) vs enemy(1) | pass | pass |  d:✓ |
| p58b | lastPlayer partner(2) vs enemy(1) | fullhouse:J | fullhouse:J{JJJ44} |  d:✓ |
| p59a | lastPlayer partner(2) vs enemy(1) | pass | pass |  d:✓ |
| p59b | lastPlayer partner(2) vs enemy(1) | straight:6/10 | straight:10{678910} |  d:✓ |
| p04a | enemy(1) count 1 vs 5 | bomb:9 | bomb:9{9999} |  d:✓ |
| p04b | enemy(1) count 1 vs 5 | pass | pass |  d:✓ |
| p05a | enemy(1) count 1 vs 6 | bomb:7 | bomb:7{7777} |  d:✓ |
| p05b | enemy(1) count 1 vs 6 | pass | pass |  d:✓ |
| p11a | enemy(1) count 1 vs 6 | bomb:7 | bomb:7{7777} |  d:✓ |
| p11b | enemy(1) count 1 vs 6 | pass | pass |  d:✓ |
| p46a | enemy(2) count 1 vs 6 (seat 3 deciding) | bomb:K | bomb:K{KKKK} |  d:✓ |
| p46b | enemy(2) count 1 vs 6 (seat 3 deciding) | pass | pass |  d:✓ |
| p57a | enemy(1) count 1 vs 6 | bomb:8 | bomb:8{8888} |  d:✓ |
| p57b | enemy(1) count 1 vs 6 | pass | pass |  d:✓ |
| p26a | enemy(1) count 2 vs 8 | pair:A | pair:A{AA} |  d:✓ |
| p26b | enemy(1) count 2 vs 8 | pair:10 | pair:10{1010} |  d:✓ |
| p27a | enemy(1) count 1 vs 7 | single:A | single:A{A} |  d:✓ |
| p27b | enemy(1) count 1 vs 7 | single:10 | single:10{10} |  d:✓ |
| p61a | enemy(3) count 1 vs 6 | single:A | single:A{A} |  d:✓ |
| p61b | enemy(3) count 1 vs 6 | single:6 | single:6{6} |  d:✓ |
| p60a | enemy(1) count 1 vs 6 | single:K | single:K{K} |  d:✓ |
| p60b | enemy(1) count 1 vs 6 | single:8 | single:8{8} |  d:✓ |
| p38a | enemy(1) count 1 vs 6 (level 7 single) | single:7 | single:7{7} |  d:✓ |
| p38b | enemy(1) count 1 vs 6 (level 7 single) | pass | pass |  d:✓ |
| p06a | hold bomb (6666) vs triple+5 | bomb:6 | bomb:6{6666} |  d:✓ |
| p06b | hold bomb (6666) vs triple+5 | pass | pass |  d:✓ |
| p15a | levelRank 7 vs 2 | single:7 | single:7{7} |  d:✓ |
| p15b | levelRank 7 vs 2 | pass | pass |  d:✓ |
| p16a | levelRank 8 vs 2 | pair:8 | pair:8{88} |  d:✓ |
| p16b | levelRank 8 vs 2 | pass | pass |  d:✓ |
| p52a | levelRank 2 vs 5 | single:A | single:A{A} |  d:✓ |
| p52b | levelRank 2 vs 5 | single:5 | single:5{5} |  d:✓ |
| p07a | leading vs following enemy single 8 | single:3/4 | single:3{3} |  d:✓ |
| p07b | leading vs following enemy single 8 | single:K | single:K{K} |  d:✓ |
| p17a | previous fullhouse 8 vs Q | fullhouse:10 | fullhouse:10{10101044} |  d:✓ |
| p17b | previous fullhouse 8 vs Q | pass | pass |  d:✓ |
| p18a | previous straight 3-7 vs 6-10 | straight:5/9 | straight:9{56789} |  d:✓ |
| p18b | previous straight 3-7 vs 6-10 | pass | pass |  d:✓ |
| p08a | partner(2) count 1 vs 8 | single:4 | single:4{4} |  d:✓ |
| p08b | partner(2) count 1 vs 8 | pairSeq:4/5/6 | pairSeq:6{445566} |  d:✓ |
| p22a | short seat is enemy(1) vs partner(2) | pair:8/9 | pair:8{88} |  d:✓ |
| p22b | short seat is enemy(1) vs partner(2) | single:3 | single:3{3} |  d:✓ |
| p47a | enemy(1) count 1 vs 6 | pair:7 | pair:7{77} |  d:✓ |
| p47b | enemy(1) count 1 vs 6 | single:3 | single:3{3} |  d:✓ |
| p23a | enemy(1) count 1 vs 6 (all singles) | single:A | single:A{A} |  d:✓ |
| p23b | enemy(1) count 1 vs 6 (all singles) | single:3 | single:3{3} |  d:✓ |
| p24a | enemy(1) count 2 vs 6 (all pairs) | single: | single:9{9} |  d:✓ |
| p24b | enemy(1) count 2 vs 6 (all pairs) | pair:4 | pair:4{44} |  d:✓ |
| p10a | enemy(1) count 1 vs 6 | triple:A | triple:A{AAA} |  d:✓ |
| p10b | enemy(1) count 1 vs 6 | single:3/4 | single:3{3} |  d:✓ |
