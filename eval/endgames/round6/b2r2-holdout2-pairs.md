# Pair eval report

- generated: 2026-10-17T10:56:57.777Z
- file: holdout2-pairs.jsonl
- cases: 58, pairs: 29
- gold legality: 58/58 legal

| system | case acc | pair acc |
|---|---|---|
| decide | 58/58 (100.0%) | 29/29 (100.0%) |
| jev | 58/58 (100.0%) | 29/29 (100.0%) |

| id | pivot | gold | decide | jev | ok |
|---|---|---|---|---|---|
| k01a | partner(0) count 2 vs 9; seat2 leads | pair:3 | pair:3{33} | pair:3{33} | d:✓ j:✓ |
| k01b | partner(0) count 2 vs 9; seat2 leads | single:7 | single:7{7} | single:7{7} | d:✓ j:✓ |
| k02a | two-card seat is partner(1) vs enemy(0); seat3 leads | pair:6 | pair:6{66} | pair:6{66} | d:✓ j:✓ |
| k02b | two-card seat is partner(1) vs enemy(0); seat3 leads | single: | single:9{9} | single:9{9} | d:✓ j:✓ |
| k03a | levelRank 2 vs 4 with [J,4] two singles | single:J | single:J{J} | single:J{J} | d:✓ j:✓ |
| k03b | levelRank 2 vs 4 with [J,4] two singles | single:4 | single:4{4} | single:4{4} | d:✓ j:✓ |
| k04a | partner(2) count 1 vs 4 with [A,5] | single:5 | single:5{5} | single:5{5} | d:✓ j:✓ |
| k04b | partner(2) count 1 vs 4 with [A,5] | single:A | single:A{A} | single:A{A} | d:✓ j:✓ |
| k05a | enemy(1) count 1 vs 5; wild pair to stop pair 8 | pair:J/9 | pair:J{J10} | pair:J{J10} | d:✓ j:✓ |
| k05b | enemy(1) count 1 vs 5; wild pair to stop pair 8 | pass | pass | pass | d:✓ j:✓ |
| k06a | level card suit H (wild) vs S (not wild); enemy last card | bomb:10 | bomb:10{1010103} | bomb:10{1010103} | d:✓ j:✓ |
| k06b | level card suit H (wild) vs S (not wild); enemy last card | pass | pass | pass | d:✓ j:✓ |
| k07a | enemy(3) count 2 vs 6; 888+Q+4 lead | triple:8 | triple:8{888} | triple:8{888} | d:✓ j:✓ |
| k07b | enemy(3) count 2 vs 6; 888+Q+4 lead | single:4 | single:4{4} | single:4{4} | d:✓ j:✓ |
| k09a | enemy(0) count 6 vs 2; FH hand vs pair 5 (seat3) | pass | pass | pass | d:✓ j:✓ |
| k09b | enemy(0) count 6 vs 2; FH hand vs pair 5 (seat3) | pair:J | pair:J{JJ} | pair:J{JJ} | d:✓ j:✓ |
| k10a | previous single 3 vs 5 (2-play hand QQQ77+4) | single:4 | single:4{4} | single:4{4} | d:✓ j:✓ |
| k10b | previous single 3 vs 5 (2-play hand QQQ77+4) | pass | pass | pass | d:✓ j:✓ |
| k12a | previous bomb 4 vs 5 sevens; enemy last card | bomb:J | bomb:J{JJJJ} | bomb:J{JJJJ} | d:✓ j:✓ |
| k12b | previous bomb 4 vs 5 sevens; enemy last card | pass | pass | pass | d:✓ j:✓ |
| k13a | straight flush by enemy(1, 1 card) vs partner(2); rocket | bomb:RJ | bomb:RJ{BJBJRJRJ} | bomb:RJ{BJBJRJRJ} | d:✓ j:✓ |
| k13b | straight flush by enemy(1, 1 card) vs partner(2); rocket | pass | pass | pass | d:✓ j:✓ |
| k14a | enemy(1) count 2 vs partner(2) count 1; plate hand | tripleSeq:5/6 | tripleSeq:6{555666} | tripleSeq:6{555666} | d:✓ j:✓ |
| k14b | enemy(1) count 2 vs partner(2) count 1; plate hand | single:5 | single:5{5} | single:5{5} | d:✓ j:✓ |
| k16a | enemy(1) count 2 vs 5; follow pair 10 | pair:A | pair:A{AA} | pair:A{AA} | d:✓ j:✓ |
| k16b | enemy(1) count 2 vs 5; follow pair 10 | pair:J | pair:J{JJ} | pair:J{JJ} | d:✓ j:✓ |
| k17a | next enemy(1) count 1 vs 6 after partner(2) single Q | single:A | single:A{A} | single:A{A} | d:✓ j:✓ |
| k17b | next enemy(1) count 1 vs 6 after partner(2) single Q | pass | pass | pass | d:✓ j:✓ |
| k21a | one-card seat is enemy(3) vs partner(2) with [K,6] | single:K | single:K{K} | single:K{K} | d:✓ j:✓ |
| k21b | one-card seat is enemy(3) vs partner(2) with [K,6] | single:6 | single:6{6} | single:6{6} | d:✓ j:✓ |
| k22a | enemy(1) count 1 vs 7; wild level single vs K | single:5 | single:5{5} | single:5{5} | d:✓ j:✓ |
| k22b | enemy(1) count 1 vs 7; wild level single vs K | pass | pass | pass | d:✓ j:✓ |
| k23a | enemy(1) count 2 vs 6; FH lead KKK66+3+8 | fullhouse:K | fullhouse:K{KKK66} | fullhouse:K{KKK66} | d:✓ j:✓ |
| k23b | enemy(1) count 2 vs 6; FH lead KKK66+3+8 | single:3 | single:3{3} | single:3{3} | d:✓ j:✓ |
| k27a | single 10 by partner(2, 1 card left) vs enemy(1) | pass | pass | pass | d:✓ j:✓ |
| k27b | single 10 by partner(2, 1 card left) vs enemy(1) | single:J | single:J{J} | single:J{J} | d:✓ j:✓ |
| k30a | enemy(1) count 1 vs 6; tube by enemy, bomb in hand | bomb:9 | bomb:9{9999} | bomb:9{9999} | d:✓ j:✓ |
| k30b | enemy(1) count 1 vs 6; tube by enemy, bomb in hand | pass | pass | pass | d:✓ j:✓ |
| k34a | enemy(3) count 6 vs 1; lead with 55 9 QQ K | single:9 | single:9{9} | single:9{9} | d:✓ j:✓ |
| k34b | enemy(3) count 6 vs 1; lead with 55 9 QQ K | pair:5/Q | pair:5{55} | pair:5{55} | d:✓ j:✓ |
| k37a | levelRank 2 vs 9 with [A,2] two singles (seat3) | single:2 | single:2{2} | single:2{2} | d:✓ j:✓ |
| k37b | levelRank 2 vs 9 with [A,2] two singles (seat3) | single:A | single:A{A} | single:A{A} | d:✓ j:✓ |
| k42a | hand size 1 vs 2 when partner(2) played single 8 | single:Q | single:Q{Q} | single:Q{Q} | d:✓ j:✓ |
| k42b | hand size 1 vs 2 when partner(2) played single 8 | pass | pass | pass | d:✓ j:✓ |
| k43a | previous FH 10 vs triple 10 (KKK99 hand) | fullhouse:K | fullhouse:K{KKK99} | fullhouse:K{KKK99} | d:✓ j:✓ |
| k43b | previous FH 10 vs triple 10 (KKK99 hand) | pass | pass | pass | d:✓ j:✓ |
| k44a | levelRank 6 (6H wild) vs 2; tube go-out | pairSeq:7/8/9 | pairSeq:9{778896} | pairSeq:9{778896} | d:✓ j:✓ |
| k44b | levelRank 6 (6H wild) vs 2; tube go-out | single:6 | single:6{6} | single:6{6} | d:✓ j:✓ |
| k46a | two-card seat is partner(2) vs enemy(1); all-pairs QQKK | pair:Q | pair:Q{QQ} | pair:Q{QQ} | d:✓ j:✓ |
| k46b | two-card seat is partner(2) vs enemy(1); all-pairs QQKK | single: | single:K{K} | single:K{K} | d:✓ j:✓ |
| k47a | enemy(1) count 2 vs 7; follow single K with BJ/A | single:BJ | single:BJ{BJ} | single:BJ{BJ} | d:✓ j:✓ |
| k47b | enemy(1) count 2 vs 7; follow single K with BJ/A | single:A | single:A{A} | single:A{A} | d:✓ j:✓ |
| k48a | enemy(1) count 1 vs 6; tube hand vs pair 9 | pair:Q | pair:Q{QQ} | pair:Q{QQ} | d:✓ j:✓ |
| k48b | enemy(1) count 1 vs 6; tube hand vs pair 9 | pass | pass | pass | d:✓ j:✓ |
| k54a | one-card enemy is next(1) vs already-passed(3), after partner Q | single:A | single:A{A} | single:A{A} | d:✓ j:✓ |
| k54b | one-card enemy is next(1) vs already-passed(3), after partner Q | pass | pass | pass | d:✓ j:✓ |
| k56a | enemy(1) count 2 vs 6; AAA55 vs single Q | single:A | single:A{A} | single:A{A} | d:✓ j:✓ |
| k56b | enemy(1) count 2 vs 6; AAA55 vs single Q | pass | pass | pass | d:✓ j:✓ |
