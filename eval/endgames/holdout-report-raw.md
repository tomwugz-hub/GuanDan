# Pair eval report

- generated: 2026-10-16T23:36:51.960Z
- file: holdout-pairs.jsonl
- cases: 62, pairs: 31
- gold legality: 62/62 legal

| system | case acc | pair acc |
|---|---|---|
| decide | 50/62 (80.6%) | 21/31 (67.7%) |
| jev | 52/62 (83.9%) | 23/31 (74.2%) |
| startlux | 35/62 (56.5%) | 8/31 (25.8%) |

| id | pivot | gold | decide | jev | startlux | ok |
|---|---|---|---|---|---|---|
| h01a | short seat (2 cards) is partner(3) vs enemy(0); seat1 leads | pair:5 | single:8{8} | single:8{8} | pair:Q{QQ} | d:✗ j:✗ s:✗ |
| h01b | short seat (2 cards) is partner(3) vs enemy(0); seat1 leads | single: | pair:5{55} | single:8{8} | pair:Q{QQ} | d:✗ j:✓ s:✗ |
| h03a | enemy(3) count 1 vs 5; high straight; seat2 | bomb:J | bomb:J{JJJJ} | bomb:J{JJJJ} | bomb:J{JJJJ} | d:✓ j:✓ s:✓ |
| h03b | enemy(3) count 1 vs 5; high straight; seat2 | pass | pass | pass | pass | d:✓ j:✓ s:✓ |
| h04a | plate by partner(2) vs enemy(1) | pass | pass | pass | tripleSeq:7{666777} | d:✓ j:✓ s:✗ |
| h04b | plate by partner(2) vs enemy(1) | tripleSeq:6/7 | tripleSeq:7{666777} | tripleSeq:7{666777} | tripleSeq:7{666777} | d:✓ j:✓ s:✓ |
| h05a | one-card seat is partner(1) vs enemy(0); seat3 leads with tube | single:3 | single:3{3} | single:3{3} | pair:10{1010} | d:✓ j:✓ s:✗ |
| h05b | one-card seat is partner(1) vs enemy(0); seat3 leads with tube | pairSeq:8/9/10 | pairSeq:10{88991010} | pairSeq:10{88991010} | single:3{3} | d:✓ j:✓ s:✗ |
| h06a | Q-bomb by partner(2) vs enemy(1, 1 card); joker bomb | pass | pass | pass | pass | d:✓ j:✓ s:✓ |
| h06b | Q-bomb by partner(2) vs enemy(1, 1 card); joker bomb | bomb:RJ | bomb:RJ{BJBJRJRJ} | bomb:RJ{BJBJRJRJ} | bomb:RJ{BJBJRJRJ} | d:✓ j:✓ s:✓ |
| h08a | pair A by partner(2) vs enemy(3, 2 cards); red-joker pair | pass | pass | pass | pair:RJ{RJRJ} | d:✓ j:✓ s:✗ |
| h08b | pair A by partner(2) vs enemy(3, 2 cards); red-joker pair | pair:RJ | pair:RJ{RJRJ} | pair:RJ{RJRJ} | pair:RJ{RJRJ} | d:✓ j:✓ s:✓ |
| h09a | enemy(1) count 2 vs 8; wild level heart makes pair K | pair:K | pair:K{K9} | pair:K{K9} | pair:K{K9} | d:✓ j:✓ s:✓ |
| h09b | enemy(1) count 2 vs 8; wild level heart makes pair K | pass | pair:K{K9} | pair:K{K9} | pass | d:✗ j:✗ s:✓ |
| h10a | levelRank 5 (5H wild) vs 2; enemy 1 card | bomb:8 | bomb:8{8885} | single:5{5} | bomb:8{8885} | d:✓ j:✗ s:✓ |
| h10b | levelRank 5 (5H wild) vs 2; enemy 1 card | pass | pass | pass | pass | d:✓ j:✓ s:✓ |
| h11a | leading vs following enemy single 9 (FH hand) | fullhouse:7 | fullhouse:7{7771010} | fullhouse:7{7771010} | fullhouse:7{7771010} | d:✓ j:✓ s:✓ |
| h11b | leading vs following enemy single 9 (FH hand) | pass | single:10{10} | single:10{10} | single:10{10} | d:✗ j:✗ s:✗ |
| h15a | one-card seat is enemy(1) vs partner(2); straight hand | straight:9/K | straight:K{910JQK} | straight:K{910JQK} | straight:K{910JQK} | d:✓ j:✓ s:✓ |
| h15b | one-card seat is enemy(1) vs partner(2); straight hand | single:3 | single:3{3} | single:3{3} | straight:K{910JQK} | d:✓ j:✓ s:✗ |
| h16a | straight by partner(2) vs enemy(3), enemy 5 cards | pass | pass | pass | straight:8{45678} | d:✓ j:✓ s:✗ |
| h16b | straight by partner(2) vs enemy(3), enemy 5 cards | straight:4/8 | straight:8{45678} | straight:8{45678} | straight:8{45678} | d:✓ j:✓ s:✓ |
| h20a | two singles vs a pair (2-card endgame control) | single:A | single:3{3} | single:A{A} | single:3{3} | d:✗ j:✓ s:✗ |
| h20b | two singles vs a pair (2-card endgame control) | pair:A | pair:A{AA} | pair:A{AA} | pair:A{AA} | d:✓ j:✓ s:✓ |
| h21a | levelRank 7 (7H = level, strongest) vs 2 | single:7 | pair:Q{Q7} | pair:Q{Q7} | pair:Q{Q7} | d:✗ j:✗ s:✗ |
| h21b | levelRank 7 (7H = level, strongest) vs 2 | single:Q | single:7{7} | single:7{7} | single:7{7} | d:✗ j:✗ s:✗ |
| h30a | single level-9 by partner(2) vs enemy(1, 2 cards) | pass | pass | pass | single:BJ{BJ} | d:✓ j:✓ s:✗ |
| h30b | single level-9 by partner(2) vs enemy(1, 2 cards) | single:BJ | single:BJ{BJ} | single:BJ{BJ} | single:BJ{BJ} | d:✓ j:✓ s:✓ |
| h31a | previous bomb size 4 vs 6 (straight flush) | straightFlush:9/5 | straightFlush:9{56789} | straightFlush:9{56789} | pass | d:✓ j:✓ s:✗ |
| h31b | previous bomb size 4 vs 6 (straight flush) | pass | pass | pass | pass | d:✓ j:✓ s:✓ |
| h32a | levelRank 6 (6H wild) vs 2; FH lead | fullhouse:J | fullhouse:J{JJ886} | fullhouse:J{JJ886} | fullhouse:J{JJ886} | d:✓ j:✓ s:✓ |
| h32b | levelRank 6 (6H wild) vs 2; FH lead | single:6 | single:6{6} | single:6{6} | pair:8{88} | d:✓ j:✓ s:✗ |
| h33a | tube by partner(2) vs enemy(1) | pass | pass | pass | pass | d:✓ j:✓ s:✓ |
| h33b | tube by partner(2) vs enemy(1) | pairSeq:7/8/9 | pairSeq:9{778899} | pairSeq:9{778899} | pass | d:✓ j:✓ s:✗ |
| h44a | enemy(3) count 1 vs 7; wild completes Q bomb vs FH | bomb:Q | bomb:Q{QQQ4} | bomb:Q{QQQ4} | pass | d:✓ j:✓ s:✗ |
| h44b | enemy(3) count 1 vs 7; wild completes Q bomb vs FH | pass | pass | pass | pass | d:✓ j:✓ s:✓ |
| h52a | leading vs following enemy pair 9 (tube hand) | pairSeq:10/J/Q | pairSeq:Q{1010JJQQ} | pairSeq:Q{1010JJQQ} | pairSeq:Q{1010JJQQ} | d:✓ j:✓ s:✓ |
| h52b | leading vs following enemy pair 9 (tube hand) | pass | pass | pass | pass | d:✓ j:✓ s:✓ |
| h56a | two-card seat is enemy(1) vs one-card partner(2); FH available | fullhouse:9 | single:K{K} | single:5{5} | pair:9{99} | d:✗ j:✗ s:✗ |
| h56b | two-card seat is enemy(1) vs one-card partner(2); FH available | single: | single:5{5} | single:5{5} | triple:9{999} | d:✓ j:✓ s:✗ |
| h57a | enemy(0) count 5 vs 2; seat3 follows single 9 | single:10 | single:10{10} | single:10{10} | single:10{10} | d:✓ j:✓ s:✓ |
| h57b | enemy(0) count 5 vs 2; seat3 follows single 9 | single:A | single:A{A} | single:A{A} | single:10{10} | d:✓ j:✓ s:✗ |
| h58a | enemy(1) count 4 vs 1; seat2 follows pair 6 | pair:8 | pair:8{88} | pair:8{88} | pair:K{KK} | d:✓ j:✓ s:✗ |
| h58b | enemy(1) count 4 vs 1; seat2 follows pair 6 | pair:K | pair:K{KK} | pair:K{KK} | pair:K{KK} | d:✓ j:✓ s:✓ |
| h69a | levelRank 7 (7H wild) vs 2; straight go-out | straight: | straight:Q{910JQ7} | straight:Q{910JQ7} | straight:Q{910JQ7} | d:✓ j:✓ s:✓ |
| h69b | levelRank 7 (7H wild) vs 2; straight go-out | single:7 | single:7{7} | single:7{7} | single:7{7} | d:✓ j:✓ s:✓ |
| h70a | levelRank K (KH wild) vs 2; 2-card hand | pair:5 | pair:5{5K} | pair:5{5K} | pair:5{5K} | d:✓ j:✓ s:✓ |
| h70b | levelRank K (KH wild) vs 2; 2-card hand | single:K | single:5{5} | single:K{K} | single:K{K} | d:✗ j:✓ s:✓ |
| h73a | enemy(1) count 2 vs 6; tube hand vs pair J | pair:A | pass | pass | pass | d:✗ j:✗ s:✗ |
| h73b | enemy(1) count 2 vs 6; tube hand vs pair J | pass | pass | pass | pass | d:✓ j:✓ s:✓ |
| h75a | enemy(1) count 1 vs 6; straight flush vs single A | straightFlush: | straightFlush:7{34567} | straightFlush:7{34567} | pass | d:✓ j:✓ s:✗ |
| h75b | enemy(1) count 1 vs 6; straight flush vs single A | pass | pass | pass | pass | d:✓ j:✓ s:✓ |
| h83a | single 9 by partner(1) vs enemy(2); seat3 | pass | pass | pass | pass | d:✓ j:✓ s:✓ |
| h83b | single 9 by partner(1) vs enemy(2); seat3 | single:Q | single:Q{Q} | single:Q{Q} | pass | d:✓ j:✓ s:✗ |
| h84a | enemy(2) count 1 vs 6; seat1 vs pair 10 | bomb:3 | bomb:3{3333} | bomb:3{3333} | bomb:3{3333} | d:✓ j:✓ s:✓ |
| h84b | enemy(2) count 1 vs 6; seat1 vs pair 10 | pass | pass | pass | pass | d:✓ j:✓ s:✓ |
| h85a | one-card seat is partner(0) vs enemy(1); seat2 leads | single:9 | single:6{6} | single:9{9} | pair:6{66} | d:✗ j:✓ s:✗ |
| h85b | one-card seat is partner(0) vs enemy(1); seat2 leads | pair:6 | pair:6{66} | pair:6{66} | pair:6{66} | d:✓ j:✓ s:✓ |
| h86a | enemy(0) count 2 vs 6; seat1 follows single 7 | single:A | single:A{A} | single:A{A} | single:8{8} | d:✓ j:✓ s:✗ |
| h86b | enemy(0) count 2 vs 6; seat1 follows single 7 | single:8 | single:8{8} | single:8{8} | single:8{8} | d:✓ j:✓ s:✓ |
| h87a | partner(2) count 2 vs 7, my lead with pair+singles | pair:4 | pair:4{44} | single:4{4} | pair:4{44} | d:✓ j:✗ s:✓ |
| h87b | partner(2) count 2 vs 7, my lead with pair+singles | single:10 | pair:4{44} | pair:4{44} | pair:4{44} | d:✗ j:✗ s:✗ |
