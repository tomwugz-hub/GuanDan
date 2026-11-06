# Pair eval report

- generated: 2026-10-17T07:08:43.908Z
- file: frozen100-pairs.jsonl
- cases: 202, pairs: 101
- gold legality: 202/202 legal

| system | case acc | pair acc |
|---|---|---|
| decide | 202/202 (100.0%) | 101/101 (100.0%) |

| id | pivot | gold | decide |  ok |
|---|---|---|---|---|
| f001a | single 9 by enemy vs partner; beater J | single:J | single:J{J} |  d:✓ |
| f001b | single 9 by enemy vs partner; beater J | pass | pass |  d:✓ |
| f002a | single 8 by enemy vs partner; beater Q | single:Q | single:Q{Q} |  d:✓ |
| f002b | single 8 by enemy vs partner; beater Q | pass | pass |  d:✓ |
| f003a | single 10 by enemy vs partner; beater K | single:K | single:K{K} |  d:✓ |
| f003b | single 10 by enemy vs partner; beater K | pass | pass |  d:✓ |
| f004a | single 6 by enemy vs partner; beater 9 | single:9 | single:9{9} |  d:✓ |
| f004b | single 6 by enemy vs partner; beater 9 | pass | pass |  d:✓ |
| f005a | single J by enemy vs partner; beater K | single:K | single:K{K} |  d:✓ |
| f005b | single J by enemy vs partner; beater K | pass | pass |  d:✓ |
| f006a | single 7; enemy 1 vs 6; bomb K | bomb:K | bomb:K{KKKK} |  d:✓ |
| f006b | single 7; enemy 1 vs 6; bomb K | pass | pass |  d:✓ |
| f007a | single 9; enemy 1 vs 7; bomb 6 | bomb:6 | bomb:6{6666} |  d:✓ |
| f007b | single 9; enemy 1 vs 7; bomb 6 | pass | pass |  d:✓ |
| f008a | single Q; enemy 1 vs 8; bomb 5 | bomb:5 | bomb:5{5555} |  d:✓ |
| f008b | single Q; enemy 1 vs 8; bomb 5 | pass | pass |  d:✓ |
| f009a | single A; enemy 1 vs 9; bomb J | bomb:J | bomb:J{JJJJ} |  d:✓ |
| f009b | single A; enemy 1 vs 9; bomb J | pass | pass |  d:✓ |
| f010a | single 10; enemy 1 vs 5; bomb 8 | bomb:8 | bomb:8{8888} |  d:✓ |
| f010b | single 10; enemy 1 vs 5; bomb 8 | pass | pass |  d:✓ |
| f011a | enemy 1: single A vs bomb 9; bombs 5,Q | bomb:5 | bomb:5{5555} |  d:✓ |
| f011b | enemy 1: single A vs bomb 9; bombs 5,Q | bomb:Q | bomb:Q{QQQQ} |  d:✓ |
| f012a | enemy 1: single A vs bomb 8; bombs 4,10 | bomb:4 | bomb:4{4444} |  d:✓ |
| f012b | enemy 1: single A vs bomb 8; bombs 4,10 | bomb:10 | bomb:10{10101010} |  d:✓ |
| f013a | enemy 1: single A vs bomb J; bombs 6,K | bomb:6 | bomb:6{6666} |  d:✓ |
| f013b | enemy 1: single A vs bomb J; bombs 6,K | bomb:K | bomb:K{KKKK} |  d:✓ |
| f014a | enemy 1: single A vs bomb 7; bombs 3,9 | bomb:3 | bomb:3{3333} |  d:✓ |
| f014b | enemy 1: single A vs bomb 7; bombs 3,9 | bomb:9 | bomb:9{9999} |  d:✓ |
| f015a | enemy 1 played pair 8: pair J vs pair 6; bomb 5 | pair:J | pair:J{JJ} |  d:✓ |
| f015b | enemy 1 played pair 8: pair J vs pair 6; bomb 5 | bomb:5 | bomb:5{5555} |  d:✓ |
| f016a | enemy 1 played pair 9: pair Q vs pair 4; bomb 7 | pair:Q | pair:Q{QQ} |  d:✓ |
| f016b | enemy 1 played pair 9: pair Q vs pair 4; bomb 7 | bomb:7 | bomb:7{7777} |  d:✓ |
| f017a | enemy 1 played pair 6: pair 10 vs pair 3; bomb K | pair:10 | pair:10{1010} |  d:✓ |
| f017b | enemy 1 played pair 6: pair 10 vs pair 3; bomb K | bomb:K | bomb:K{KKKK} |  d:✓ |
| f018a | enemy 1 played pair 10: pair A vs pair 8; bomb 4 | pair:A | pair:A{AA} |  d:✓ |
| f018b | enemy 1 played pair 10: pair A vs pair 8; bomb 4 | bomb:4 | bomb:4{4444} |  d:✓ |
| f019a | enemy 1 played pair 7: pair 9 vs pair 5; bomb Q | pair:9 | pair:9{99} |  d:✓ |
| f019b | enemy 1 played pair 7: pair 9 vs pair 5; bomb Q | bomb:Q | bomb:Q{QQQQ} |  d:✓ |
| f020a | pair 7+orphans: enemy=1 vs partner=1 | pair:7 | pair:7{77} |  d:✓ |
| f020b | pair 7+orphans: enemy=1 vs partner=1 | single:3 | single:3{3} |  d:✓ |
| f021a | pair 9+orphans: enemy=1 vs partner=1 | pair:9 | pair:9{99} |  d:✓ |
| f021b | pair 9+orphans: enemy=1 vs partner=1 | single:4 | single:4{4} |  d:✓ |
| f022a | pair 5+orphans: enemy=1 vs partner=1 | pair:5 | pair:5{55} |  d:✓ |
| f022b | pair 5+orphans: enemy=1 vs partner=1 | single:6 | single:6{6} |  d:✓ |
| f023a | pair Q+orphans: enemy=1 vs partner=1 | pair:Q | pair:Q{QQ} |  d:✓ |
| f023b | pair Q+orphans: enemy=1 vs partner=1 | single:3 | single:3{3} |  d:✓ |
| f024a | pair 4+orphans: enemy=1 vs partner=1 | pair:4 | pair:4{44} |  d:✓ |
| f024b | pair 4+orphans: enemy=1 vs partner=1 | single:5 | single:5{5} |  d:✓ |
| f025a | FH 84+3: enemy=2 vs partner=1 | fullhouse:8 | fullhouse:8{88844} |  d:✓ |
| f025b | FH 84+3: enemy=2 vs partner=1 | single:3 | single:3{3} |  d:✓ |
| f026a | FH J6+5: enemy=2 vs partner=1 | fullhouse:J | fullhouse:J{JJJ66} |  d:✓ |
| f026b | FH J6+5: enemy=2 vs partner=1 | single:5 | single:5{5} |  d:✓ |
| f027a | FH 59+7: enemy=2 vs partner=1 | fullhouse:5 | fullhouse:5{55599} |  d:✓ |
| f027b | FH 59+7: enemy=2 vs partner=1 | single:7 | single:7{7} |  d:✓ |
| f028a | FH Q3+8: enemy=2 vs partner=1 | fullhouse:Q | fullhouse:Q{QQQ33} |  d:✓ |
| f028b | FH Q3+8: enemy=2 vs partner=1 | single:8 | single:8{8} |  d:✓ |
| f029a | straight from 5+3: enemy=1 vs partner=1 | straight:5 | straight:9{56789} |  d:✓ |
| f029b | straight from 5+3: enemy=1 vs partner=1 | single:3 | single:3{3} |  d:✓ |
| f030a | straight from 6+4: enemy=1 vs partner=1 | straight:6 | straight:10{678910} |  d:✓ |
| f030b | straight from 6+4: enemy=1 vs partner=1 | single:4 | single:4{4} |  d:✓ |
| f031a | straight from 7+3: enemy=1 vs partner=1 | straight:7 | straight:J{78910J} |  d:✓ |
| f031b | straight from 7+3: enemy=1 vs partner=1 | single:3 | single:3{3} |  d:✓ |
| f032a | straight from 9+5: enemy=1 vs partner=1 | straight:9 | straight:K{910JQK} |  d:✓ |
| f032b | straight from 9+5: enemy=1 vs partner=1 | single:5 | single:5{5} |  d:✓ |
| f033a | tube 345+9: enemy=2 vs partner=1 | pairSeq:3/4/5 | pairSeq:5{334455} |  d:✓ |
| f033b | tube 345+9: enemy=2 vs partner=1 | single:9 | single:9{9} |  d:✓ |
| f034a | tube 678+4: enemy=2 vs partner=1 | pairSeq:6/7/8 | pairSeq:8{667788} |  d:✓ |
| f034b | tube 678+4: enemy=2 vs partner=1 | single:4 | single:4{4} |  d:✓ |
| f035a | tube 910J+3: enemy=2 vs partner=1 | pairSeq:9/10/J | pairSeq:J{991010JJ} |  d:✓ |
| f035b | tube 910J+3: enemy=2 vs partner=1 | single:3 | single:3{3} |  d:✓ |
| f036a | tube 456+8: enemy=2 vs partner=1 | pairSeq:4/5/6 | pairSeq:6{445566} |  d:✓ |
| f036b | tube 456+8: enemy=2 vs partner=1 | single:8 | single:8{8} |  d:✓ |
| f037a | plate 34: enemy=1 vs partner; mine 78 | tripleSeq:7/8 | tripleSeq:8{777888} |  d:✓ |
| f037b | plate 34: enemy=1 vs partner; mine 78 | pass | pass |  d:✓ |
| f038a | plate 56: enemy=1 vs partner; mine 910 | tripleSeq:9/10 | tripleSeq:10{999101010} |  d:✓ |
| f038b | plate 56: enemy=1 vs partner; mine 910 | pass | pass |  d:✓ |
| f039a | plate 45: enemy=1 vs partner; mine QK | tripleSeq:Q/K | tripleSeq:K{QQQKKK} |  d:✓ |
| f039b | plate 45: enemy=1 vs partner; mine QK | pass | pass |  d:✓ |
| f040a | plate 67: enemy=1 vs partner; mine 10J | tripleSeq:10/J | tripleSeq:J{101010JJJ} |  d:✓ |
| f040b | plate 67: enemy=1 vs partner; mine 10J | pass | pass |  d:✓ |
| f041a | partner single 8; next enemy 2 vs 6 | single:K | single:K{K} |  d:✓ |
| f041b | partner single 8; next enemy 2 vs 6 | pass | pass |  d:✓ |
| f042a | partner single 6; next enemy 2 vs 7 | single:J | single:J{J} |  d:✓ |
| f042b | partner single 6; next enemy 2 vs 7 | pass | pass |  d:✓ |
| f043a | partner single 9; next enemy 2 vs 8 | single:A | single:A{A} |  d:✓ |
| f043b | partner single 9; next enemy 2 vs 8 | pass | pass |  d:✓ |
| f044a | partner single 5; next enemy 2 vs 9 | single:Q | single:Q{Q} |  d:✓ |
| f044b | partner single 5; next enemy 2 vs 9 | pass | pass |  d:✓ |
| f045a | partner single 10; next enemy 2 vs 5 | single:K | single:K{K} |  d:✓ |
| f045b | partner single 10; next enemy 2 vs 5 | pass | pass |  d:✓ |
| f046a | partner pair 7 vs single 7; next enemy 1 | pass | pass |  d:✓ |
| f046b | partner pair 7 vs single 7; next enemy 1 | single:Q/J | single:Q{Q} |  d:✓ |
| f047a | partner pair 9 vs single 9; next enemy 1 | pass | pass |  d:✓ |
| f047b | partner pair 9 vs single 9; next enemy 1 | single:A/K | single:A{A} |  d:✓ |
| f048a | partner pair 5 vs single 5; next enemy 1 | pass | pass |  d:✓ |
| f048b | partner pair 5 vs single 5; next enemy 1 | single:J/10 | single:J{J} |  d:✓ |
| f049a | partner pair 8 vs single 8; next enemy 1 | pass | pass |  d:✓ |
| f049b | partner pair 8 vs single 8; next enemy 1 | single:K/Q | single:K{K} |  d:✓ |
| f050a | partner single 9: partner 1 vs 6; next enemy 2 | pass | pass |  d:✓ |
| f050b | partner single 9: partner 1 vs 6; next enemy 2 | single:K | single:K{K} |  d:✓ |
| f051a | partner single 7: partner 1 vs 6; next enemy 2 | pass | pass |  d:✓ |
| f051b | partner single 7: partner 1 vs 6; next enemy 2 | single:Q | single:Q{Q} |  d:✓ |
| f052a | partner single 10: partner 1 vs 6; next enemy 2 | pass | pass |  d:✓ |
| f052b | partner single 10: partner 1 vs 6; next enemy 2 | single:A | single:A{A} |  d:✓ |
| f053a | partner single 6: partner 1 vs 6; next enemy 2 | pass | pass |  d:✓ |
| f053b | partner single 6: partner 1 vs 6; next enemy 2 | single:J | single:J{J} |  d:✓ |
| f054a | partner single 6: J+pair8 vs J+3+4 | single:J | single:J{J} |  d:✓ |
| f054b | partner single 6: J+pair8 vs J+3+4 | pass | pass |  d:✓ |
| f055a | partner single 9: Q+pair4 vs Q+5+7 | single:Q | single:Q{Q} |  d:✓ |
| f055b | partner single 9: Q+pair4 vs Q+5+7 | pass | pass |  d:✓ |
| f056a | partner single 5: 10+pair3 vs 10+4+3 | single:10 | single:10{10} |  d:✓ |
| f056b | partner single 5: 10+pair3 vs 10+4+3 | pass | pass |  d:✓ |
| f057a | partner single 8: K+pair7 vs K+4+6 | single:K | single:K{K} |  d:✓ |
| f057b | partner single 8: K+pair7 vs K+4+6 | pass | pass |  d:✓ |
| f058a | [5,A] level 5 vs 2 | single:5 | single:5{5} |  d:✓ |
| f058b | [5,A] level 5 vs 2 | single:A | single:A{A} |  d:✓ |
| f059a | [9,K] level 9 vs 2 | single:9 | single:9{9} |  d:✓ |
| f059b | [9,K] level 9 vs 2 | single:K | single:K{K} |  d:✓ |
| f060a | [J,A] level J vs 2 | single:J | single:J{J} |  d:✓ |
| f060b | [J,A] level J vs 2 | single:A | single:A{A} |  d:✓ |
| f061a | [7,Q] level 7 vs 2 | single:7 | single:7{7} |  d:✓ |
| f061b | [7,Q] level 7 vs 2 | single:Q | single:Q{Q} |  d:✓ |
| f062a | [3,A] level 3 vs 2 | single:3 | single:3{3} |  d:✓ |
| f062b | [3,A] level 3 vs 2 | single:A | single:A{A} |  d:✓ |
| f063a | 9H+K vs pair 10: level 9 vs 2 | pair:K | pair:K{K9} |  d:✓ |
| f063b | 9H+K vs pair 10: level 9 vs 2 | pass | pass |  d:✓ |
| f064a | 6H+Q vs pair 8: level 6 vs 2 | pair:Q | pair:Q{Q6} |  d:✓ |
| f064b | 6H+Q vs pair 8: level 6 vs 2 | pass | pass |  d:✓ |
| f065a | 4H+A vs pair J: level 4 vs 2 | pair:A | pair:A{A4} |  d:✓ |
| f065b | 4H+A vs pair J: level 4 vs 2 | pass | pass |  d:✓ |
| f066a | 7H+J vs pair 9: level 7 vs 2 | pair:J | pair:J{J7} |  d:✓ |
| f066b | 7H+J vs pair 9: level 7 vs 2 | pass | pass |  d:✓ |
| f067a | 888+5H vs pair A: enemy 1 vs 6 | bomb:8 | bomb:8{8885} |  d:✓ |
| f067b | 888+5H vs pair A: enemy 1 vs 6 | pass | pass |  d:✓ |
| f068a | JJJ+9H vs pair A: enemy 1 vs 6 | bomb:J | bomb:J{JJJ9} |  d:✓ |
| f068b | JJJ+9H vs pair A: enemy 1 vs 6 | pass | pass |  d:✓ |
| f069a | 666+10H vs pair A: enemy 1 vs 6 | bomb:6 | bomb:6{66610} |  d:✓ |
| f069b | 666+10H vs pair A: enemy 1 vs 6 | pass | pass |  d:✓ |
| f070a | QQQ+4H vs pair A: enemy 1 vs 6 | bomb:Q | bomb:Q{QQQ4} |  d:✓ |
| f070b | QQQ+4H vs pair A: enemy 1 vs 6 | pass | pass |  d:✓ |
| f071a | KK44: enemy 1 vs partner 1 | pair:K | pair:K{KK} |  d:✓ |
| f071b | KK44: enemy 1 vs partner 1 | single:4 | single:4{4} |  d:✓ |
| f072a | AA66: enemy 1 vs partner 1 | pair:A | pair:A{AA} |  d:✓ |
| f072b | AA66: enemy 1 vs partner 1 | single:6 | single:6{6} |  d:✓ |
| f073a | QQ33: enemy 1 vs partner 1 | pair:Q | pair:Q{QQ} |  d:✓ |
| f073b | QQ33: enemy 1 vs partner 1 | single:3 | single:3{3} |  d:✓ |
| f074a | AA55: enemy 1 vs partner 1 | pair:A | pair:A{AA} |  d:✓ |
| f074b | AA55: enemy 1 vs partner 1 | single:5 | single:5{5} |  d:✓ |
| f075a | KK77: enemy 1 vs partner 1 | pair:K | pair:K{KK} |  d:✓ |
| f075b | KK77: enemy 1 vs partner 1 | single:7 | single:7{7} |  d:✓ |
| f076a | ['4', '8', 'Q']: enemy 1 vs partner 1 | single:Q | single:Q{Q} |  d:✓ |
| f076b | ['4', '8', 'Q']: enemy 1 vs partner 1 | single:4 | single:4{4} |  d:✓ |
| f077a | ['3', '9', 'A']: enemy 1 vs partner 1 | single:A | single:A{A} |  d:✓ |
| f077b | ['3', '9', 'A']: enemy 1 vs partner 1 | single:3 | single:3{3} |  d:✓ |
| f078a | ['5', '7', 'K']: enemy 1 vs partner 1 | single:K | single:K{K} |  d:✓ |
| f078b | ['5', '7', 'K']: enemy 1 vs partner 1 | single:5 | single:5{5} |  d:✓ |
| f079a | ['6', '10', 'J']: enemy 1 vs partner 1 | single:J | single:J{J} |  d:✓ |
| f079b | ['6', '10', 'J']: enemy 1 vs partner 1 | single:6 | single:6{6} |  d:✓ |
| f080a | wild 10H+J vs pair 8: enemy 1 vs 6 | pair:J | pair:J{J10} |  d:✓ |
| f080b | wild 10H+J vs pair 8: enemy 1 vs 6 | pass | pass |  d:✓ |
| f081a | wild 5H+Q vs pair 9: enemy 1 vs 6 | pair:Q | pair:Q{Q5} |  d:✓ |
| f081b | wild 5H+Q vs pair 9: enemy 1 vs 6 | pass | pass |  d:✓ |
| f082a | wild 7H+K vs pair 10: enemy 1 vs 6 | pair:K | pair:K{K7} |  d:✓ |
| f082b | wild 7H+K vs pair 10: enemy 1 vs 6 | pass | pass |  d:✓ |
| f083a | wild JH+9 vs pair 6: enemy 1 vs 6 | pair:9 | pair:9{9J} |  d:✓ |
| f083b | wild JH+9 vs pair 6: enemy 1 vs 6 | pass | pass |  d:✓ |
| f084a | pair 6+['4', '9', 'K']: enemy 2 vs partner 2 | single:4/9/K | single:4{4} |  d:✓ |
| f084b | pair 6+['4', '9', 'K']: enemy 2 vs partner 2 | pair:6 | pair:6{66} |  d:✓ |
| f085a | pair 8+['3', '10', 'Q']: enemy 2 vs partner 2 | single:3/10/Q | single:3{3} |  d:✓ |
| f085b | pair 8+['3', '10', 'Q']: enemy 2 vs partner 2 | pair:8 | pair:8{88} |  d:✓ |
| f086a | pair 5+['7', '9', 'J']: enemy 2 vs partner 2 | single:7/9/J | single:7{7} |  d:✓ |
| f086b | pair 5+['7', '9', 'J']: enemy 2 vs partner 2 | pair:5 | pair:5{55} |  d:✓ |
| f087a | pair J+['4', '6', '8']: enemy 2 vs partner 2 | single:4/6/8 | single:4{4} |  d:✓ |
| f087b | pair J+['4', '6', '8']: enemy 2 vs partner 2 | pair:J | pair:J{JJ} |  d:✓ |
| f088a | ['3', '6', '9', 'Q']: lead vs follow single 7 | single:3 | single:3{3} |  d:✓ |
| f088b | ['3', '6', '9', 'Q']: lead vs follow single 7 | single:9 | single:9{9} |  d:✓ |
| f089a | ['4', '8', '10', 'K']: lead vs follow single 9 | single:4 | single:4{4} |  d:✓ |
| f089b | ['4', '8', '10', 'K']: lead vs follow single 9 | single:10 | single:10{10} |  d:✓ |
| f090a | ['3', '5', 'J', 'A']: lead vs follow single 8 | single:3 | single:3{3} |  d:✓ |
| f090b | ['3', '5', 'J', 'A']: lead vs follow single 8 | single:J | single:J{J} |  d:✓ |
| f091a | ['5', '7', '9', 'Q']: lead vs follow single 6 | single:5 | single:5{5} |  d:✓ |
| f091b | ['5', '7', '9', 'Q']: lead vs follow single 6 | single:7 | single:7{7} |  d:✓ |
| f092a | enemy 1: bomb 9x4 vs x5; have Qx4 + SF | bomb:Q | bomb:Q{QQQQ} |  d:✓ |
| f092b | enemy 1: bomb 9x4 vs x5; have Qx4 + SF | straightFlush: | straightFlush:7{34567} |  d:✓ |
| f093a | enemy 1: bomb 6x4 vs x5; have Kx4 + SF | bomb:K | bomb:K{KKKK} |  d:✓ |
| f093b | enemy 1: bomb 6x4 vs x5; have Kx4 + SF | straightFlush: | straightFlush:Q{8910JQ} |  d:✓ |
| f094a | enemy 1: bomb Jx4 vs x5; have Ax4 + SF | bomb:A | bomb:A{AAAA} |  d:✓ |
| f094b | enemy 1: bomb Jx4 vs x5; have Ax4 + SF | straightFlush: | straightFlush:8{45678} |  d:✓ |
| f095a | FH 6 by enemy(1 card) vs partner; mine FH 10 | fullhouse:10 | fullhouse:10{10101033} |  d:✓ |
| f095b | FH 6 by enemy(1 card) vs partner; mine FH 10 | pass | pass |  d:✓ |
| f096a | FH 8 by enemy(1 card) vs partner; mine FH Q | fullhouse:Q | fullhouse:Q{QQQ44} |  d:✓ |
| f096b | FH 8 by enemy(1 card) vs partner; mine FH Q | pass | pass |  d:✓ |
| f097a | FH 5 by enemy(1 card) vs partner; mine FH J | fullhouse:J | fullhouse:J{JJJ77} |  d:✓ |
| f097b | FH 5 by enemy(1 card) vs partner; mine FH J | pass | pass |  d:✓ |
| f098a | FH 9 by enemy(1 card) vs partner; mine FH K | fullhouse:K | fullhouse:K{KKK55} |  d:✓ |
| f098b | FH 9 by enemy(1 card) vs partner; mine FH K | pass | pass |  d:✓ |
| f099a | enemy 1: single A vs 6x8 bomb; rocket + 5x4 | bomb:5 | bomb:5{5555} |  d:✓ |
| f099b | enemy 1: single A vs 6x8 bomb; rocket + 5x4 | bomb:RJ | bomb:RJ{BJBJRJRJ} |  d:✓ |
| f100a | enemy 1: single A vs 6x8 bomb; rocket + 9x4 | bomb:9 | bomb:9{9999} |  d:✓ |
| f100b | enemy 1: single A vs 6x8 bomb; rocket + 9x4 | bomb:RJ | bomb:RJ{BJBJRJRJ} |  d:✓ |
| f101a | enemy 1: single A vs 6x8 bomb; rocket + Jx4 | bomb:J | bomb:J{JJJJ} |  d:✓ |
| f101b | enemy 1: single A vs 6x8 bomb; rocket + Jx4 | bomb:RJ | bomb:RJ{BJBJRJRJ} |  d:✓ |
