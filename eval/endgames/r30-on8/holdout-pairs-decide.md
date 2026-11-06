# Pair eval report

- generated: 2026-10-26T09:59:33.964Z
- file: holdout-pairs.jsonl
- cases: 62, pairs: 31
- gold legality: 62/62 legal

| system | case acc | pair acc |
|---|---|---|
| decide | 62/62 (100.0%) | 31/31 (100.0%) |

| id | pivot | gold | decide |  ok |
|---|---|---|---|---|
| h01a | short seat (2 cards) is partner(3) vs enemy(0); seat1 leads | pair:5 | pair:5{55} |  d:✓ |
| h01b | short seat (2 cards) is partner(3) vs enemy(0); seat1 leads | single: | single:8{8} |  d:✓ |
| h03a | enemy(3) count 1 vs 5; high straight; seat2 | bomb:J | bomb:J{JJJJ} |  d:✓ |
| h03b | enemy(3) count 1 vs 5; high straight; seat2 | pass | pass |  d:✓ |
| h04a | plate by partner(2) vs enemy(1) | pass | pass |  d:✓ |
| h04b | plate by partner(2) vs enemy(1) | tripleSeq:6/7 | tripleSeq:7{666777} |  d:✓ |
| h05a | one-card seat is partner(1) vs enemy(0); seat3 leads with tube | single:3 | single:3{3} |  d:✓ |
| h05b | one-card seat is partner(1) vs enemy(0); seat3 leads with tube | pairSeq:8/9/10 | pairSeq:10{88991010} |  d:✓ |
| h06a | Q-bomb by partner(2) vs enemy(1, 1 card); joker bomb | pass | pass |  d:✓ |
| h06b | Q-bomb by partner(2) vs enemy(1, 1 card); joker bomb | bomb:RJ | bomb:RJ{BJBJRJRJ} |  d:✓ |
| h08a | pair A by partner(2) vs enemy(3, 2 cards); red-joker pair | pass | pass |  d:✓ |
| h08b | pair A by partner(2) vs enemy(3, 2 cards); red-joker pair | pair:RJ | pair:RJ{RJRJ} |  d:✓ |
| h09a | enemy(1) count 2 vs 8; wild level heart makes pair K | pair:K | pair:K{K9} |  d:✓ |
| h09b | enemy(1) count 2 vs 8; wild level heart makes pair K | pass | pass |  d:✓ |
| h10a | levelRank 5 (5H wild) vs 2; enemy 1 card | bomb:8 | bomb:8{8885} |  d:✓ |
| h10b | levelRank 5 (5H wild) vs 2; enemy 1 card | pass | pass |  d:✓ |
| h11a | leading vs following enemy single 9 (FH hand) | fullhouse:7 | fullhouse:7{7771010} |  d:✓ |
| h11b | leading vs following enemy single 9 (FH hand) | pass | pass |  d:✓ |
| h15a | one-card seat is enemy(1) vs partner(2); straight hand | straight:9/K | straight:K{910JQK} |  d:✓ |
| h15b | one-card seat is enemy(1) vs partner(2); straight hand | single:3 | single:3{3} |  d:✓ |
| h16a | straight by partner(2) vs enemy(3), enemy 5 cards | pass | pass |  d:✓ |
| h16b | straight by partner(2) vs enemy(3), enemy 5 cards | straight:4/8 | straight:8{45678} |  d:✓ |
| h20a | two singles vs a pair (2-card endgame control) | single:A | single:A{A} |  d:✓ |
| h20b | two singles vs a pair (2-card endgame control) | pair:A | pair:A{AA} |  d:✓ |
| h21a | levelRank 7 (7H wild) vs 2 | pair:Q | pair:Q{Q7} |  d:✓ |
| h21b | levelRank 7 (7H wild) vs 2 | single:Q | single:Q{Q} |  d:✓ |
| h30a | single level-9 by partner(2) vs enemy(1, 2 cards) | pass | pass |  d:✓ |
| h30b | single level-9 by partner(2) vs enemy(1, 2 cards) | single:BJ | single:BJ{BJ} |  d:✓ |
| h31a | previous bomb size 4 vs 6 (straight flush) | straightFlush:9/5 | straightFlush:9{56789} |  d:✓ |
| h31b | previous bomb size 4 vs 6 (straight flush) | pass | pass |  d:✓ |
| h32a | levelRank 6 (6H wild) vs 2; FH lead | fullhouse:J | fullhouse:J{JJ886} |  d:✓ |
| h32b | levelRank 6 (6H wild) vs 2; FH lead | single:6 | single:6{6} |  d:✓ |
| h33a | tube by partner(2) vs enemy(1) | pass | pass |  d:✓ |
| h33b | tube by partner(2) vs enemy(1) | pairSeq:7/8/9 | pairSeq:9{778899} |  d:✓ |
| h44a | enemy(3) count 1 vs 7; wild completes Q bomb vs FH | bomb:Q | bomb:Q{QQQ4} |  d:✓ |
| h44b | enemy(3) count 1 vs 7; wild completes Q bomb vs FH | pass | pass |  d:✓ |
| h52a | leading vs following enemy pair 9 (tube hand) | pairSeq:10/J/Q | pairSeq:Q{1010JJQQ} |  d:✓ |
| h52b | leading vs following enemy pair 9 (tube hand) | pass | pass |  d:✓ |
| h56a | two-card seat is enemy(1) vs one-card partner(2); FH available | fullhouse:9 | fullhouse:9{99955} |  d:✓ |
| h56b | two-card seat is enemy(1) vs one-card partner(2); FH available | single: | single:5{5} |  d:✓ |
| h57a | enemy(0) count 5 vs 2; seat3 follows single 9 | single:10 | single:10{10} |  d:✓ |
| h57b | enemy(0) count 5 vs 2; seat3 follows single 9 | single:A | single:A{A} |  d:✓ |
| h58a | enemy(1) count 4 vs 1; seat2 follows pair 6 | pair:8 | pair:8{88} |  d:✓ |
| h58b | enemy(1) count 4 vs 1; seat2 follows pair 6 | pair:K | pair:K{KK} |  d:✓ |
| h69a | levelRank 7 (7H wild) vs 2; straight go-out | straight: | straight:Q{910JQ7} |  d:✓ |
| h69b | levelRank 7 (7H wild) vs 2; straight go-out | single:7 | single:7{7} |  d:✓ |
| h70a | levelRank K (KH wild) vs 2; 2-card hand | pair:5 | pair:5{5K} |  d:✓ |
| h70b | levelRank K (KH wild) vs 2; 2-card hand | single:K | single:K{K} |  d:✓ |
| h73a | enemy(1) count 2 vs 6; tube hand vs pair J | pair:A | pair:A{AA} |  d:✓ |
| h73b | enemy(1) count 2 vs 6; tube hand vs pair J | pass | pass |  d:✓ |
| h75a | enemy(1) count 1 vs 6; straight flush vs single A | straightFlush: | straightFlush:7{34567} |  d:✓ |
| h75b | enemy(1) count 1 vs 6; straight flush vs single A | pass | pass |  d:✓ |
| h83a | single 9 by partner(1) vs enemy(2); seat3 | pass | pass |  d:✓ |
| h83b | single 9 by partner(1) vs enemy(2); seat3 | single:Q | single:Q{Q} |  d:✓ |
| h84a | enemy(2) count 1 vs 6; seat1 vs pair 10 | bomb:3 | bomb:3{3333} |  d:✓ |
| h84b | enemy(2) count 1 vs 6; seat1 vs pair 10 | pass | pass |  d:✓ |
| h85a | one-card seat is partner(0) vs enemy(1); seat2 leads | single:9 | single:9{9} |  d:✓ |
| h85b | one-card seat is partner(0) vs enemy(1); seat2 leads | pair:6 | pair:6{66} |  d:✓ |
| h86a | enemy(0) count 2 vs 6; seat1 follows single 7 | single:A | single:A{A} |  d:✓ |
| h86b | enemy(0) count 2 vs 6; seat1 follows single 7 | single:8 | single:8{8} |  d:✓ |
| h87a | partner(2) count 2 vs 7, my lead with pair+singles | pair:4 | pair:4{44} |  d:✓ |
| h87b | partner(2) count 2 vs 7, my lead with pair+singles | single:10 | single:10{10} |  d:✓ |
