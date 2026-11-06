# Pair eval report

- generated: 2026-10-26T09:16:10.447Z
- file: holdout4-pairs.jsonl
- cases: 56, pairs: 28
- gold legality: 56/56 legal

| system | case acc | pair acc |
|---|---|---|
| decide | 55/56 (98.2%) | 27/28 (96.4%) |

| id | pivot | gold | decide |  ok |
|---|---|---|---|---|
| q01a | seat1 lead: partner(3)=1 vs enemy(2)=1; 77 Q 3 8 | single:3 | single:3{3} |  d:✓ |
| q01b | seat1 lead: partner(3)=1 vs enemy(2)=1; 77 Q 3 8 | pair:7 | pair:7{77} |  d:✓ |
| q02a | seat2 lead: enemy(3)=1 vs partner(0)=1; KK 5 10 | pair:K | pair:K{KK} |  d:✓ |
| q02b | seat2 lead: enemy(3)=1 vs partner(0)=1; KK 5 10 | single:5 | single:5{5} |  d:✓ |
| q03a | seat3 lead: enemy(0)=2 vs partner(1)=1; 666 99 4 | fullhouse:6 | fullhouse:6{66699} |  d:✓ |
| q03b | seat3 lead: enemy(0)=2 vs partner(1)=1; 666 99 4 | single:4 | single:4{4} |  d:✓ |
| q04a | seat1 lead w/ bomb: enemy(2)=1 vs partner(3)=1; JJJJ 88 3 | pair:8 | pair:8{88} |  d:✓ |
| q04b | seat1 lead w/ bomb: enemy(2)=1 vs partner(3)=1; JJJJ 88 3 | single:3 | single:3{3} |  d:✓ |
| q27a | seat2 lead: partner(0)=2 vs =1; 44 J Q K | pair:4 | pair:4{44} |  d:✓ |
| q27b | seat2 lead: partner(0)=2 vs =1; 44 J Q K | single:4 | single:4{4} |  d:✓ |
| q29a | seat1 lead singles: enemy(0)=1 vs partner(3)=1; 5 9 K | single:K | single:K{K} |  d:✓ |
| q29b | seat1 lead singles: enemy(0)=1 vs partner(3)=1; 5 9 K | single:5 | single:5{5} |  d:✓ |
| q05a | enemy(1)=1 played single K vs pair 5; 6666 99 | bomb:6 | bomb:6{6666} |  d:✓ |
| q05b | enemy(1)=1 played single K vs pair 5; 6666 99 | pair:9 | pair:9{99} |  d:✓ |
| q06a | lead w/ bomb: enemy(3)=2 vs partner(2)=1; 5555 101010 Q | triple:10 | single:Q{Q} |  d:✗ |
| q06b | lead w/ bomb: enemy(3)=2 vs partner(2)=1; 5555 101010 Q | single:10/Q | single:Q{Q} |  d:✓ |
| q31a | lead w/ bomb: enemy(1)=2 vs partner(2)=2; KKK66 + 9999 | fullhouse:K | fullhouse:K{KKK66} |  d:✓ |
| q31b | lead w/ bomb: enemy(1)=2 vs partner(2)=2; KKK66 + 9999 | pair:6 | pair:6{66} |  d:✓ |
| q32a | enemy(1)=1 straight 3-7 vs 8-Q; 6-10 + JJJJ | straight:6/10 | straight:10{678910} |  d:✓ |
| q32b | enemy(1)=1 straight 3-7 vs 8-Q; 6-10 + JJJJ | bomb:J | bomb:J{JJJJ} |  d:✓ |
| q24a | enemy(1)=1 4x10 bomb vs SF 8-Q; rocket + SF 3-7H | straightFlush: | straightFlush:7{34567} |  d:✓ |
| q24b | enemy(1)=1 4x10 bomb vs SF 8-Q; rocket + SF 3-7H | bomb:RJ | bomb:RJ{BJBJRJRJ} |  d:✓ |
| q23a | seat1: single A by partner(3) vs enemy(2)=1; 5555 9 | pass | pass |  d:✓ |
| q23b | seat1: single A by partner(3) vs enemy(2)=1; 5555 9 | bomb:5 | bomb:5{5555} |  d:✓ |
| q07a | seat1: partner(3) pair 10; next enemy(2)=2 vs prev enemy(0)=2 | pair:Q | pair:Q{QQ} |  d:✓ |
| q07b | seat1: partner(3) pair 10; next enemy(2)=2 vs prev enemy(0)=2 | pass | pass |  d:✓ |
| q08a | seat2: partner(0)=1 single 8, next enemy(3)=2; A46 vs A | pass | pass |  d:✓ |
| q08b | seat2: partner(0)=1 single 8, next enemy(3)=2; A46 vs A | single:A | single:A{A} |  d:✓ |
| q09a | seat3: partner(1) straight 3-7; 5-9 + KK vs 5-9 + K4 | straight:5/9 | straight:9{56789} |  d:✓ |
| q09b | seat3: partner(1) straight 3-7; 5-9 + KK vs 5-9 + K4 | pass | pass |  d:✓ |
| q10a | partner(2) pair 6, next enemy(1)=2; QQQQ 3 8 9 vs QQQQ 3 88 | pass | pass |  d:✓ |
| q10b | partner(2) pair 6, next enemy(1)=2; QQQQ 3 8 9 vs QQQQ 3 88 | pair:8 | pair:8{88} |  d:✓ |
| q12a | plate 333444 by enemy(1)=1 vs partner(2); 777888 J 4 | tripleSeq:7/8 | tripleSeq:8{777888} |  d:✓ |
| q12b | plate 333444 by enemy(1)=1 vs partner(2); 777888 J 4 | pass | pass |  d:✓ |
| q22a | seat2: partner(0) straight 3-7 vs single 9; next enemy(3)=2 | pass | pass |  d:✓ |
| q22b | seat2: partner(0) straight 3-7 vs single 9; next enemy(3)=2 | single:K | single:K{K} |  d:✓ |
| q16a | level Q pair vs pair A by enemy(1)=1 vs partner(2) | pair:Q | pair:Q{QQ} |  d:✓ |
| q16b | level Q pair vs pair A by enemy(1)=1 vs partner(2) | pass | pass |  d:✓ |
| q11a | lead 3-7 + 99 + A: enemies long vs partner(2)=1 | straight:3/7 | straight:7{34567} |  d:✓ |
| q11b | lead 3-7 + 99 + A: enemies long vs partner(2)=1 | single:3 | single:3{3} |  d:✓ |
| q13a | seat1 lead tube 99-1010-JJ + 4: enemy(0)=2 vs partner(3)=1 | pairSeq:9/10/J | pairSeq:J{991010JJ} |  d:✓ |
| q13b | seat1 lead tube 99-1010-JJ + 4: enemy(0)=2 vs partner(3)=1 | single:4 | single:4{4} |  d:✓ |
| q14a | level 5 (5H wild): enemy(1)=1 vs 6 played single A; 888+5H 3 K | bomb:8 | bomb:8{8885} |  d:✓ |
| q14b | level 5 (5H wild): enemy(1)=1 vs 6 played single A; 888+5H 3 K | pass | pass |  d:✓ |
| q15a | seat2 lead: 9H wild (level 9) vs 9C natural; 3 4 5 7 + 9 | straight: | straight:7{34579} |  d:✓ |
| q15b | seat2 lead: 9H wild (level 9) vs 9C natural; 3 4 5 7 + 9 | single:3 | single:3{3} |  d:✓ |
| q30a | level 8 (8H wild) vs level 2; 8H+Q over enemy pair J | pair:Q | pair:Q{Q8} |  d:✓ |
| q30b | level 8 (8H wild) vs level 2; 8H+Q over enemy pair J | pass | pass |  d:✓ |
| q17a | lead AA 33: enemy(1)=1 vs partner(2)=1 | pair:A | pair:A{AA} |  d:✓ |
| q17b | lead AA 33: enemy(1)=1 vs partner(2)=1 | single:3 | single:3{3} |  d:✓ |
| q18a | seat3 lead RJ 99: enemy(0)=1 vs partner(1)=1 | pair:9 | pair:9{99} |  d:✓ |
| q18b | seat3 lead RJ 99: enemy(0)=1 vs partner(1)=1 | single:9 | single:9{9} |  d:✓ |
| q26a | seat3 two singles 6C + AS: level 6 vs level 2 | single:6 | single:6{6} |  d:✓ |
| q26b | seat3 two singles 6C + AS: level 6 vs level 2 | single:A | single:A{A} |  d:✓ |
| q34a | level 10: enemy(1)=5 vs 1 played single A | pass | pass |  d:✓ |
| q34b | level 10: enemy(1)=5 vs 1 played single A | single:10 | single:10{10} |  d:✓ |
