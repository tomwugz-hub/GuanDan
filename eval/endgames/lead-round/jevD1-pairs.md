# Pair eval report

- generated: 2026-10-17T07:23:56.839Z
- file: pairs.jsonl
- cases: 60, pairs: 30
- gold legality: 60/60 legal

| system | case acc | pair acc |
|---|---|---|
| decide | 60/60 (100.0%) | 30/30 (100.0%) |
| jev | 59/60 (98.3%) | 29/30 (96.7%) |

| id | pivot | gold | decide | jev | ok |
|---|---|---|---|---|---|
| p01a | lastPlayer partner(2) vs enemy(1) | pass | pass | pass | d:✓ j:✓ |
| p01b | lastPlayer partner(2) vs enemy(1) | single:K | single:K{K} | single:K{K} | d:✓ j:✓ |
| p02a | lastPlayer partner(2) vs enemy(1) | pass | pass | pass | d:✓ j:✓ |
| p02b | lastPlayer partner(2) vs enemy(1) | pair:Q | pair:Q{QQ} | pair:Q{QQ} | d:✓ j:✓ |
| p03a | lastPlayer partner(2) vs enemy(1); enemy1 has 1 card | pass | pass | pass | d:✓ j:✓ |
| p03b | lastPlayer partner(2) vs enemy(1); enemy1 has 1 card | bomb:8 | bomb:8{8888} | bomb:8{8888} | d:✓ j:✓ |
| p20a | previous bomb by partner(2) vs enemy(1); enemy1 has 1 card | pass | pass | pass | d:✓ j:✓ |
| p20b | previous bomb by partner(2) vs enemy(1); enemy1 has 1 card | bomb:10 | bomb:10{10101010} | bomb:10{10101010} | d:✓ j:✓ |
| p28a | lastPlayer partner(2) vs enemy(1); enemy1 has 2 cards | pass | pass | pass | d:✓ j:✓ |
| p28b | lastPlayer partner(2) vs enemy(1); enemy1 has 2 cards | single:RJ | single:RJ{RJ} | single:RJ{RJ} | d:✓ j:✓ |
| p58a | lastPlayer partner(2) vs enemy(1) | pass | pass | pass | d:✓ j:✓ |
| p58b | lastPlayer partner(2) vs enemy(1) | fullhouse:J | fullhouse:J{JJJ44} | fullhouse:J{JJJ44} | d:✓ j:✓ |
| p59a | lastPlayer partner(2) vs enemy(1) | pass | pass | pass | d:✓ j:✓ |
| p59b | lastPlayer partner(2) vs enemy(1) | straight:6/10 | straight:10{678910} | straight:10{678910} | d:✓ j:✓ |
| p04a | enemy(1) count 1 vs 5 | bomb:9 | bomb:9{9999} | bomb:9{9999} | d:✓ j:✓ |
| p04b | enemy(1) count 1 vs 5 | pass | pass | pass | d:✓ j:✓ |
| p05a | enemy(1) count 1 vs 6 | bomb:7 | bomb:7{7777} | bomb:7{7777} | d:✓ j:✓ |
| p05b | enemy(1) count 1 vs 6 | pass | pass | pass | d:✓ j:✓ |
| p11a | enemy(1) count 1 vs 6 | bomb:7 | bomb:7{7777} | bomb:7{7777} | d:✓ j:✓ |
| p11b | enemy(1) count 1 vs 6 | pass | pass | pass | d:✓ j:✓ |
| p46a | enemy(2) count 1 vs 6 (seat 3 deciding) | bomb:K | bomb:K{KKKK} | bomb:K{KKKK} | d:✓ j:✓ |
| p46b | enemy(2) count 1 vs 6 (seat 3 deciding) | pass | pass | pass | d:✓ j:✓ |
| p57a | enemy(1) count 1 vs 6 | bomb:8 | bomb:8{8888} | bomb:8{8888} | d:✓ j:✓ |
| p57b | enemy(1) count 1 vs 6 | pass | pass | pass | d:✓ j:✓ |
| p26a | enemy(1) count 2 vs 8 | pair:A | pair:A{AA} | pair:A{AA} | d:✓ j:✓ |
| p26b | enemy(1) count 2 vs 8 | pair:10 | pair:10{1010} | pair:10{1010} | d:✓ j:✓ |
| p27a | enemy(1) count 1 vs 7 | single:A | single:A{A} | single:A{A} | d:✓ j:✓ |
| p27b | enemy(1) count 1 vs 7 | single:10 | single:10{10} | single:10{10} | d:✓ j:✓ |
| p61a | enemy(3) count 1 vs 6 | single:A | single:A{A} | single:A{A} | d:✓ j:✓ |
| p61b | enemy(3) count 1 vs 6 | single:6 | single:6{6} | single:6{6} | d:✓ j:✓ |
| p60a | enemy(1) count 1 vs 6 | single:K | single:K{K} | single:K{K} | d:✓ j:✓ |
| p60b | enemy(1) count 1 vs 6 | single:8 | single:8{8} | single:8{8} | d:✓ j:✓ |
| p38a | enemy(1) count 1 vs 6 (level 7 single) | single:7 | single:7{7} | single:7{7} | d:✓ j:✓ |
| p38b | enemy(1) count 1 vs 6 (level 7 single) | pass | pass | pass | d:✓ j:✓ |
| p06a | hold bomb (6666) vs triple+5 | bomb:6 | bomb:6{6666} | bomb:6{6666} | d:✓ j:✓ |
| p06b | hold bomb (6666) vs triple+5 | pass | pass | pass | d:✓ j:✓ |
| p15a | levelRank 7 vs 2 | single:7 | single:7{7} | single:7{7} | d:✓ j:✓ |
| p15b | levelRank 7 vs 2 | pass | pass | pass | d:✓ j:✓ |
| p16a | levelRank 8 vs 2 | pair:8 | pair:8{88} | pair:8{88} | d:✓ j:✓ |
| p16b | levelRank 8 vs 2 | pass | pass | pass | d:✓ j:✓ |
| p52a | levelRank 2 vs 5 | single:A | single:A{A} | single:A{A} | d:✓ j:✓ |
| p52b | levelRank 2 vs 5 | single:5 | single:5{5} | single:5{5} | d:✓ j:✓ |
| p07a | leading vs following enemy single 8 | single:3/4 | single:3{3} | single:3{3} | d:✓ j:✓ |
| p07b | leading vs following enemy single 8 | single:K | single:K{K} | single:K{K} | d:✓ j:✓ |
| p17a | previous fullhouse 8 vs Q | fullhouse:10 | fullhouse:10{10101044} | fullhouse:10{10101044} | d:✓ j:✓ |
| p17b | previous fullhouse 8 vs Q | pass | pass | pass | d:✓ j:✓ |
| p18a | previous straight 3-7 vs 6-10 | straight:5/9 | straight:9{56789} | straight:9{56789} | d:✓ j:✓ |
| p18b | previous straight 3-7 vs 6-10 | pass | pass | pass | d:✓ j:✓ |
| p08a | partner(2) count 1 vs 8 | single:4 | single:4{4} | single:4{4} | d:✓ j:✓ |
| p08b | partner(2) count 1 vs 8 | pairSeq:4/5/6 | pairSeq:6{445566} | pairSeq:6{445566} | d:✓ j:✓ |
| p22a | short seat is enemy(1) vs partner(2) | pair:8/9 | pair:8{88} | pair:8{88} | d:✓ j:✓ |
| p22b | short seat is enemy(1) vs partner(2) | single:3 | single:3{3} | single:3{3} | d:✓ j:✓ |
| p47a | enemy(1) count 1 vs 6 | pair:7 | pair:7{77} | pair:7{77} | d:✓ j:✓ |
| p47b | enemy(1) count 1 vs 6 | single:3 | single:3{3} | single:3{3} | d:✓ j:✓ |
| p23a | enemy(1) count 1 vs 6 (all singles) | single:A | single:A{A} | single:A{A} | d:✓ j:✓ |
| p23b | enemy(1) count 1 vs 6 (all singles) | single:3 | single:3{3} | single:3{3} | d:✓ j:✓ |
| p24a | enemy(1) count 2 vs 6 (all pairs) | single: | single:9{9} | pair:4{44} | d:✓ j:✗ |
| p24b | enemy(1) count 2 vs 6 (all pairs) | pair:4 | pair:4{44} | pair:4{44} | d:✓ j:✓ |
| p10a | enemy(1) count 1 vs 6 | triple:A | triple:A{AAA} | triple:A{AAA} | d:✓ j:✓ |
| p10b | enemy(1) count 1 vs 6 | single:3/4 | single:3{3} | single:3{3} | d:✓ j:✓ |
