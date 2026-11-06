# Pair eval report

- generated: 2026-10-16T23:19:36.209Z
- file: pairs.jsonl
- cases: 60, pairs: 30
- gold legality: 60/60 legal

| system | case acc | pair acc |
|---|---|---|
| decide | 39/60 (65.0%) | 11/30 (36.7%) |
| jev | 41/60 (68.3%) | 15/30 (50.0%) |
| startlux | 30/60 (50.0%) | 6/30 (20.0%) |

| id | pivot | gold | decide | jev | startlux | ok |
|---|---|---|---|---|---|---|
| p01a | lastPlayer partner(2) vs enemy(1) | pass | pass | pass | single:K{K} | d:✓ j:✓ s:✗ |
| p01b | lastPlayer partner(2) vs enemy(1) | single:K | single:K{K} | single:K{K} | single:K{K} | d:✓ j:✓ s:✓ |
| p02a | lastPlayer partner(2) vs enemy(1) | pass | pass | pass | pass | d:✓ j:✓ s:✓ |
| p02b | lastPlayer partner(2) vs enemy(1) | pair:Q | pair:Q{QQ} | pair:Q{QQ} | pass | d:✓ j:✓ s:✗ |
| p03a | lastPlayer partner(2) vs enemy(1); enemy1 has 1 card | pass | pass | pass | pass | d:✓ j:✓ s:✓ |
| p03b | lastPlayer partner(2) vs enemy(1); enemy1 has 1 card | bomb:8 | bomb:8{8888} | bomb:8{8888} | bomb:8{8888} | d:✓ j:✓ s:✓ |
| p20a | previous bomb by partner(2) vs enemy(1); enemy1 has 1 card | pass | bomb:10{10101010} | pass | bomb:10{10101010} | d:✗ j:✓ s:✗ |
| p20b | previous bomb by partner(2) vs enemy(1); enemy1 has 1 card | bomb:10 | bomb:10{10101010} | bomb:10{10101010} | bomb:10{10101010} | d:✓ j:✓ s:✓ |
| p28a | lastPlayer partner(2) vs enemy(1); enemy1 has 2 cards | pass | pass | pass | pass | d:✓ j:✓ s:✓ |
| p28b | lastPlayer partner(2) vs enemy(1); enemy1 has 2 cards | single:RJ | single:RJ{RJ} | single:RJ{RJ} | single:RJ{RJ} | d:✓ j:✓ s:✓ |
| p58a | lastPlayer partner(2) vs enemy(1) | pass | pass | fullhouse:J{JJJ44} | pass | d:✓ j:✗ s:✓ |
| p58b | lastPlayer partner(2) vs enemy(1) | fullhouse:J | fullhouse:J{JJJ44} | fullhouse:J{JJJ44} | pass | d:✓ j:✓ s:✗ |
| p59a | lastPlayer partner(2) vs enemy(1) | pass | pass | pass | pass | d:✓ j:✓ s:✓ |
| p59b | lastPlayer partner(2) vs enemy(1) | straight:6/10 | straight:10{678910} | straight:10{678910} | straight:10{678910} | d:✓ j:✓ s:✓ |
| p04a | enemy(1) count 1 vs 5 | bomb:9 | single:9{9} | single:9{9} | bomb:9{9999} | d:✗ j:✗ s:✓ |
| p04b | enemy(1) count 1 vs 5 | pass | single:9{9} | single:9{9} | bomb:9{9999} | d:✗ j:✗ s:✗ |
| p05a | enemy(1) count 1 vs 6 | bomb:7 | pass | bomb:7{7777} | bomb:7{7777} | d:✗ j:✓ s:✓ |
| p05b | enemy(1) count 1 vs 6 | pass | pass | pass | bomb:7{7777} | d:✓ j:✓ s:✗ |
| p11a | enemy(1) count 1 vs 6 | bomb:7 | bomb:7{7777} | bomb:7{7777} | bomb:7{7777} | d:✓ j:✓ s:✓ |
| p11b | enemy(1) count 1 vs 6 | pass | bomb:7{7777} | pass | bomb:7{7777} | d:✗ j:✓ s:✗ |
| p46a | enemy(2) count 1 vs 6 (seat 3 deciding) | bomb:K | single:K{K} | single:K{K} | bomb:K{KKKK} | d:✗ j:✗ s:✓ |
| p46b | enemy(2) count 1 vs 6 (seat 3 deciding) | pass | single:K{K} | single:K{K} | bomb:K{KKKK} | d:✗ j:✗ s:✗ |
| p57a | enemy(1) count 1 vs 6 | bomb:8 | bomb:8{8888} | bomb:8{8888} | bomb:8{8888} | d:✓ j:✓ s:✓ |
| p57b | enemy(1) count 1 vs 6 | pass | bomb:8{8888} | pass | bomb:8{8888} | d:✗ j:✓ s:✗ |
| p26a | enemy(1) count 2 vs 8 | pair:A | pair:10{1010} | pair:10{1010} | pair:10{1010} | d:✗ j:✗ s:✗ |
| p26b | enemy(1) count 2 vs 8 | pair:10 | pair:10{1010} | pair:10{1010} | pair:A{AA} | d:✓ j:✓ s:✗ |
| p27a | enemy(1) count 1 vs 7 | single:A | single:A{A} | single:A{A} | single:10{10} | d:✓ j:✓ s:✗ |
| p27b | enemy(1) count 1 vs 7 | single:10 | single:A{A} | single:A{A} | single:A{A} | d:✗ j:✗ s:✗ |
| p61a | enemy(3) count 1 vs 6 | single:A | single:A{A} | single:A{A} | single:9{9} | d:✓ j:✓ s:✗ |
| p61b | enemy(3) count 1 vs 6 | single:6 | single:A{A} | single:6{6} | single:9{9} | d:✗ j:✓ s:✗ |
| p60a | enemy(1) count 1 vs 6 | single:K | single:K{K} | single:8{8} | single:8{8} | d:✓ j:✗ s:✗ |
| p60b | enemy(1) count 1 vs 6 | single:8 | single:K{K} | single:8{8} | single:8{8} | d:✗ j:✓ s:✓ |
| p38a | enemy(1) count 1 vs 6 (level 7 single) | single:7 | single:7{7} | single:7{7} | single:7{7} | d:✓ j:✓ s:✓ |
| p38b | enemy(1) count 1 vs 6 (level 7 single) | pass | single:7{7} | single:7{7} | single:7{7} | d:✗ j:✗ s:✗ |
| p06a | hold bomb (6666) vs triple+5 | bomb:6 | pass | bomb:6{6666} | bomb:6{6666} | d:✗ j:✓ s:✓ |
| p06b | hold bomb (6666) vs triple+5 | pass | pass | pass | pass | d:✓ j:✓ s:✓ |
| p15a | levelRank 7 vs 2 | single:7 | single:7{7} | single:7{7} | single:7{7} | d:✓ j:✓ s:✓ |
| p15b | levelRank 7 vs 2 | pass | pass | pass | pass | d:✓ j:✓ s:✓ |
| p16a | levelRank 8 vs 2 | pair:8 | pair:8{88} | pair:8{88} | pass | d:✓ j:✓ s:✗ |
| p16b | levelRank 8 vs 2 | pass | pass | pass | pass | d:✓ j:✓ s:✓ |
| p52a | levelRank 2 vs 5 | single:A | single:A{A} | single:A{A} | pass | d:✓ j:✓ s:✗ |
| p52b | levelRank 2 vs 5 | single:5 | single:5{5} | single:A{A} | single:5{5} | d:✓ j:✗ s:✓ |
| p07a | leading vs following enemy single 8 | single:3/4 | pair:Q{QQ} | pair:Q{QQ} | pair:Q{QQ} | d:✗ j:✗ s:✗ |
| p07b | leading vs following enemy single 8 | single:K | single:K{K} | single:K{K} | single:K{K} | d:✓ j:✓ s:✓ |
| p17a | previous fullhouse 8 vs Q | fullhouse:10 | fullhouse:10{10101044} | fullhouse:10{10101044} | fullhouse:10{10101044} | d:✓ j:✓ s:✓ |
| p17b | previous fullhouse 8 vs Q | pass | pass | pass | pass | d:✓ j:✓ s:✓ |
| p18a | previous straight 3-7 vs 6-10 | straight:5/9 | straight:9{56789} | straight:9{56789} | pass | d:✓ j:✓ s:✗ |
| p18b | previous straight 3-7 vs 6-10 | pass | pass | pass | pass | d:✓ j:✓ s:✓ |
| p08a | partner(2) count 1 vs 8 | single:4 | pairSeq:6{445566} | pairSeq:6{445566} | pair:6{66} | d:✗ j:✗ s:✗ |
| p08b | partner(2) count 1 vs 8 | pairSeq:4/5/6 | pairSeq:6{445566} | pairSeq:6{445566} | pair:6{66} | d:✓ j:✓ s:✗ |
| p22a | short seat is enemy(1) vs partner(2) | pair:8/9 | pair:8{88} | single:3{3} | pair:9{99} | d:✓ j:✗ s:✓ |
| p22b | short seat is enemy(1) vs partner(2) | single:3 | pair:8{88} | pair:8{88} | pair:9{99} | d:✗ j:✗ s:✗ |
| p47a | enemy(1) count 1 vs 6 | pair:7 | pair:7{77} | single:3{3} | pair:7{77} | d:✓ j:✗ s:✓ |
| p47b | enemy(1) count 1 vs 6 | single:3 | pair:7{77} | pair:7{77} | pair:7{77} | d:✗ j:✗ s:✗ |
| p23a | enemy(1) count 1 vs 6 (all singles) | single:A | single:3{3} | single:3{3} | single:K{K} | d:✗ j:✗ s:✗ |
| p23b | enemy(1) count 1 vs 6 (all singles) | single:3 | single:3{3} | single:3{3} | single:K{K} | d:✓ j:✓ s:✗ |
| p24a | enemy(1) count 2 vs 6 (all pairs) | single: | pair:4{44} | pair:4{44} | pair:9{99} | d:✗ j:✗ s:✗ |
| p24b | enemy(1) count 2 vs 6 (all pairs) | pair:4 | pair:4{44} | pair:4{44} | pair:9{99} | d:✓ j:✓ s:✗ |
| p10a | enemy(1) count 1 vs 6 | triple:A | triple:A{AAA} | triple:A{AAA} | triple:A{AAA} | d:✓ j:✓ s:✓ |
| p10b | enemy(1) count 1 vs 6 | single:3/4 | triple:A{AAA} | triple:A{AAA} | triple:A{AAA} | d:✗ j:✗ s:✗ |
