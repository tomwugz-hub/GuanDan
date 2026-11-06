# Pair eval report

- generated: 2026-10-17T08:03:01.893Z
- file: frozen100-pairs.jsonl
- cases: 202, pairs: 101
- gold legality: 202/202 legal

| system | case acc | pair acc |
|---|---|---|
| decide | 202/202 (100.0%) | 101/101 (100.0%) |
| jev | 201/202 (99.5%) | 100/101 (99.0%) |

| id | pivot | gold | decide | jev | ok |
|---|---|---|---|---|---|
| f001a | single 9 by enemy vs partner; beater J | single:J | single:J{J} | single:J{J} | d:✓ j:✓ |
| f001b | single 9 by enemy vs partner; beater J | pass | pass | pass | d:✓ j:✓ |
| f002a | single 8 by enemy vs partner; beater Q | single:Q | single:Q{Q} | single:Q{Q} | d:✓ j:✓ |
| f002b | single 8 by enemy vs partner; beater Q | pass | pass | pass | d:✓ j:✓ |
| f003a | single 10 by enemy vs partner; beater K | single:K | single:K{K} | single:K{K} | d:✓ j:✓ |
| f003b | single 10 by enemy vs partner; beater K | pass | pass | pass | d:✓ j:✓ |
| f004a | single 6 by enemy vs partner; beater 9 | single:9 | single:9{9} | single:9{9} | d:✓ j:✓ |
| f004b | single 6 by enemy vs partner; beater 9 | pass | pass | pass | d:✓ j:✓ |
| f005a | single J by enemy vs partner; beater K | single:K | single:K{K} | single:K{K} | d:✓ j:✓ |
| f005b | single J by enemy vs partner; beater K | pass | pass | pass | d:✓ j:✓ |
| f006a | single 7; enemy 1 vs 6; bomb K | bomb:K | bomb:K{KKKK} | bomb:K{KKKK} | d:✓ j:✓ |
| f006b | single 7; enemy 1 vs 6; bomb K | pass | pass | pass | d:✓ j:✓ |
| f007a | single 9; enemy 1 vs 7; bomb 6 | bomb:6 | bomb:6{6666} | bomb:6{6666} | d:✓ j:✓ |
| f007b | single 9; enemy 1 vs 7; bomb 6 | pass | pass | pass | d:✓ j:✓ |
| f008a | single Q; enemy 1 vs 8; bomb 5 | bomb:5 | bomb:5{5555} | bomb:5{5555} | d:✓ j:✓ |
| f008b | single Q; enemy 1 vs 8; bomb 5 | pass | pass | pass | d:✓ j:✓ |
| f009a | single A; enemy 1 vs 9; bomb J | bomb:J | bomb:J{JJJJ} | bomb:J{JJJJ} | d:✓ j:✓ |
| f009b | single A; enemy 1 vs 9; bomb J | pass | pass | pass | d:✓ j:✓ |
| f010a | single 10; enemy 1 vs 5; bomb 8 | bomb:8 | bomb:8{8888} | bomb:8{8888} | d:✓ j:✓ |
| f010b | single 10; enemy 1 vs 5; bomb 8 | pass | pass | pass | d:✓ j:✓ |
| f011a | enemy 1: single A vs bomb 9; bombs 5,Q | bomb:5 | bomb:5{5555} | bomb:5{5555} | d:✓ j:✓ |
| f011b | enemy 1: single A vs bomb 9; bombs 5,Q | bomb:Q | bomb:Q{QQQQ} | bomb:Q{QQQQ} | d:✓ j:✓ |
| f012a | enemy 1: single A vs bomb 8; bombs 4,10 | bomb:4 | bomb:4{4444} | bomb:4{4444} | d:✓ j:✓ |
| f012b | enemy 1: single A vs bomb 8; bombs 4,10 | bomb:10 | bomb:10{10101010} | bomb:10{10101010} | d:✓ j:✓ |
| f013a | enemy 1: single A vs bomb J; bombs 6,K | bomb:6 | bomb:6{6666} | bomb:6{6666} | d:✓ j:✓ |
| f013b | enemy 1: single A vs bomb J; bombs 6,K | bomb:K | bomb:K{KKKK} | bomb:K{KKKK} | d:✓ j:✓ |
| f014a | enemy 1: single A vs bomb 7; bombs 3,9 | bomb:3 | bomb:3{3333} | bomb:3{3333} | d:✓ j:✓ |
| f014b | enemy 1: single A vs bomb 7; bombs 3,9 | bomb:9 | bomb:9{9999} | bomb:9{9999} | d:✓ j:✓ |
| f015a | enemy 1 played pair 8: pair J vs pair 6; bomb 5 | pair:J | pair:J{JJ} | pair:J{JJ} | d:✓ j:✓ |
| f015b | enemy 1 played pair 8: pair J vs pair 6; bomb 5 | bomb:5 | bomb:5{5555} | bomb:5{5555} | d:✓ j:✓ |
| f016a | enemy 1 played pair 9: pair Q vs pair 4; bomb 7 | pair:Q | pair:Q{QQ} | pair:Q{QQ} | d:✓ j:✓ |
| f016b | enemy 1 played pair 9: pair Q vs pair 4; bomb 7 | bomb:7 | bomb:7{7777} | bomb:7{7777} | d:✓ j:✓ |
| f017a | enemy 1 played pair 6: pair 10 vs pair 3; bomb K | pair:10 | pair:10{1010} | pair:10{1010} | d:✓ j:✓ |
| f017b | enemy 1 played pair 6: pair 10 vs pair 3; bomb K | bomb:K | bomb:K{KKKK} | bomb:K{KKKK} | d:✓ j:✓ |
| f018a | enemy 1 played pair 10: pair A vs pair 8; bomb 4 | pair:A | pair:A{AA} | pair:A{AA} | d:✓ j:✓ |
| f018b | enemy 1 played pair 10: pair A vs pair 8; bomb 4 | bomb:4 | bomb:4{4444} | bomb:4{4444} | d:✓ j:✓ |
| f019a | enemy 1 played pair 7: pair 9 vs pair 5; bomb Q | pair:9 | pair:9{99} | pair:9{99} | d:✓ j:✓ |
| f019b | enemy 1 played pair 7: pair 9 vs pair 5; bomb Q | bomb:Q | bomb:Q{QQQQ} | bomb:Q{QQQQ} | d:✓ j:✓ |
| f020a | pair 7+orphans: enemy=1 vs partner=1 | pair:7 | pair:7{77} | pair:7{77} | d:✓ j:✓ |
| f020b | pair 7+orphans: enemy=1 vs partner=1 | single:3 | single:3{3} | single:3{3} | d:✓ j:✓ |
| f021a | pair 9+orphans: enemy=1 vs partner=1 | pair:9 | pair:9{99} | pair:9{99} | d:✓ j:✓ |
| f021b | pair 9+orphans: enemy=1 vs partner=1 | single:4 | single:4{4} | single:4{4} | d:✓ j:✓ |
| f022a | pair 5+orphans: enemy=1 vs partner=1 | pair:5 | pair:5{55} | pair:5{55} | d:✓ j:✓ |
| f022b | pair 5+orphans: enemy=1 vs partner=1 | single:6 | single:6{6} | single:6{6} | d:✓ j:✓ |
| f023a | pair Q+orphans: enemy=1 vs partner=1 | pair:Q | pair:Q{QQ} | pair:Q{QQ} | d:✓ j:✓ |
| f023b | pair Q+orphans: enemy=1 vs partner=1 | single:3 | single:3{3} | single:3{3} | d:✓ j:✓ |
| f024a | pair 4+orphans: enemy=1 vs partner=1 | pair:4 | pair:4{44} | pair:4{44} | d:✓ j:✓ |
| f024b | pair 4+orphans: enemy=1 vs partner=1 | single:5 | single:5{5} | single:5{5} | d:✓ j:✓ |
| f025a | FH 84+3: enemy=2 vs partner=1 | fullhouse:8 | fullhouse:8{88844} | fullhouse:8{88844} | d:✓ j:✓ |
| f025b | FH 84+3: enemy=2 vs partner=1 | single:3 | single:3{3} | single:3{3} | d:✓ j:✓ |
| f026a | FH J6+5: enemy=2 vs partner=1 | fullhouse:J | fullhouse:J{JJJ66} | fullhouse:J{JJJ66} | d:✓ j:✓ |
| f026b | FH J6+5: enemy=2 vs partner=1 | single:5 | single:5{5} | single:5{5} | d:✓ j:✓ |
| f027a | FH 59+7: enemy=2 vs partner=1 | fullhouse:5 | fullhouse:5{55599} | fullhouse:5{55599} | d:✓ j:✓ |
| f027b | FH 59+7: enemy=2 vs partner=1 | single:7 | single:7{7} | single:7{7} | d:✓ j:✓ |
| f028a | FH Q3+8: enemy=2 vs partner=1 | fullhouse:Q | fullhouse:Q{QQQ33} | fullhouse:Q{QQQ33} | d:✓ j:✓ |
| f028b | FH Q3+8: enemy=2 vs partner=1 | single:8 | single:8{8} | single:8{8} | d:✓ j:✓ |
| f029a | straight from 5+3: enemy=1 vs partner=1 | straight:5 | straight:9{56789} | straight:9{56789} | d:✓ j:✓ |
| f029b | straight from 5+3: enemy=1 vs partner=1 | single:3 | single:3{3} | single:3{3} | d:✓ j:✓ |
| f030a | straight from 6+4: enemy=1 vs partner=1 | straight:6 | straight:10{678910} | straight:10{678910} | d:✓ j:✓ |
| f030b | straight from 6+4: enemy=1 vs partner=1 | single:4 | single:4{4} | single:4{4} | d:✓ j:✓ |
| f031a | straight from 7+3: enemy=1 vs partner=1 | straight:7 | straight:J{78910J} | straight:J{78910J} | d:✓ j:✓ |
| f031b | straight from 7+3: enemy=1 vs partner=1 | single:3 | single:3{3} | single:3{3} | d:✓ j:✓ |
| f032a | straight from 9+5: enemy=1 vs partner=1 | straight:9 | straight:K{910JQK} | straight:K{910JQK} | d:✓ j:✓ |
| f032b | straight from 9+5: enemy=1 vs partner=1 | single:5 | single:5{5} | single:5{5} | d:✓ j:✓ |
| f033a | tube 345+9: enemy=2 vs partner=1 | pairSeq:3/4/5 | pairSeq:5{334455} | pairSeq:5{334455} | d:✓ j:✓ |
| f033b | tube 345+9: enemy=2 vs partner=1 | single:9 | single:9{9} | single:9{9} | d:✓ j:✓ |
| f034a | tube 678+4: enemy=2 vs partner=1 | pairSeq:6/7/8 | pairSeq:8{667788} | pairSeq:8{667788} | d:✓ j:✓ |
| f034b | tube 678+4: enemy=2 vs partner=1 | single:4 | single:4{4} | single:4{4} | d:✓ j:✓ |
| f035a | tube 910J+3: enemy=2 vs partner=1 | pairSeq:9/10/J | pairSeq:J{991010JJ} | pairSeq:J{991010JJ} | d:✓ j:✓ |
| f035b | tube 910J+3: enemy=2 vs partner=1 | single:3 | single:3{3} | single:3{3} | d:✓ j:✓ |
| f036a | tube 456+8: enemy=2 vs partner=1 | pairSeq:4/5/6 | pairSeq:6{445566} | pairSeq:6{445566} | d:✓ j:✓ |
| f036b | tube 456+8: enemy=2 vs partner=1 | single:8 | single:8{8} | single:8{8} | d:✓ j:✓ |
| f037a | plate 34: enemy=1 vs partner; mine 78 | tripleSeq:7/8 | tripleSeq:8{777888} | tripleSeq:8{777888} | d:✓ j:✓ |
| f037b | plate 34: enemy=1 vs partner; mine 78 | pass | pass | pass | d:✓ j:✓ |
| f038a | plate 56: enemy=1 vs partner; mine 910 | tripleSeq:9/10 | tripleSeq:10{999101010} | tripleSeq:10{999101010} | d:✓ j:✓ |
| f038b | plate 56: enemy=1 vs partner; mine 910 | pass | pass | pass | d:✓ j:✓ |
| f039a | plate 45: enemy=1 vs partner; mine QK | tripleSeq:Q/K | tripleSeq:K{QQQKKK} | tripleSeq:K{QQQKKK} | d:✓ j:✓ |
| f039b | plate 45: enemy=1 vs partner; mine QK | pass | pass | pass | d:✓ j:✓ |
| f040a | plate 67: enemy=1 vs partner; mine 10J | tripleSeq:10/J | tripleSeq:J{101010JJJ} | tripleSeq:J{101010JJJ} | d:✓ j:✓ |
| f040b | plate 67: enemy=1 vs partner; mine 10J | pass | pass | pass | d:✓ j:✓ |
| f041a | partner single 8; next enemy 2 vs 6 | single:K | single:K{K} | single:K{K} | d:✓ j:✓ |
| f041b | partner single 8; next enemy 2 vs 6 | pass | pass | pass | d:✓ j:✓ |
| f042a | partner single 6; next enemy 2 vs 7 | single:J | single:J{J} | single:J{J} | d:✓ j:✓ |
| f042b | partner single 6; next enemy 2 vs 7 | pass | pass | pass | d:✓ j:✓ |
| f043a | partner single 9; next enemy 2 vs 8 | single:A | single:A{A} | single:A{A} | d:✓ j:✓ |
| f043b | partner single 9; next enemy 2 vs 8 | pass | pass | pass | d:✓ j:✓ |
| f044a | partner single 5; next enemy 2 vs 9 | single:Q | single:Q{Q} | single:Q{Q} | d:✓ j:✓ |
| f044b | partner single 5; next enemy 2 vs 9 | pass | pass | pass | d:✓ j:✓ |
| f045a | partner single 10; next enemy 2 vs 5 | single:K | single:K{K} | single:K{K} | d:✓ j:✓ |
| f045b | partner single 10; next enemy 2 vs 5 | pass | pass | pass | d:✓ j:✓ |
| f046a | partner pair 7 vs single 7; next enemy 1 | pass | pass | pass | d:✓ j:✓ |
| f046b | partner pair 7 vs single 7; next enemy 1 | single:Q/J | single:Q{Q} | single:Q{Q} | d:✓ j:✓ |
| f047a | partner pair 9 vs single 9; next enemy 1 | pass | pass | pass | d:✓ j:✓ |
| f047b | partner pair 9 vs single 9; next enemy 1 | single:A/K | single:A{A} | single:A{A} | d:✓ j:✓ |
| f048a | partner pair 5 vs single 5; next enemy 1 | pass | pass | pass | d:✓ j:✓ |
| f048b | partner pair 5 vs single 5; next enemy 1 | single:J/10 | single:J{J} | single:J{J} | d:✓ j:✓ |
| f049a | partner pair 8 vs single 8; next enemy 1 | pass | pass | pass | d:✓ j:✓ |
| f049b | partner pair 8 vs single 8; next enemy 1 | single:K/Q | single:K{K} | single:K{K} | d:✓ j:✓ |
| f050a | partner single 9: partner 1 vs 6; next enemy 2 | pass | pass | pass | d:✓ j:✓ |
| f050b | partner single 9: partner 1 vs 6; next enemy 2 | single:K | single:K{K} | single:K{K} | d:✓ j:✓ |
| f051a | partner single 7: partner 1 vs 6; next enemy 2 | pass | pass | pass | d:✓ j:✓ |
| f051b | partner single 7: partner 1 vs 6; next enemy 2 | single:Q | single:Q{Q} | single:Q{Q} | d:✓ j:✓ |
| f052a | partner single 10: partner 1 vs 6; next enemy 2 | pass | pass | pass | d:✓ j:✓ |
| f052b | partner single 10: partner 1 vs 6; next enemy 2 | single:A | single:A{A} | single:A{A} | d:✓ j:✓ |
| f053a | partner single 6: partner 1 vs 6; next enemy 2 | pass | pass | pass | d:✓ j:✓ |
| f053b | partner single 6: partner 1 vs 6; next enemy 2 | single:J | single:J{J} | single:J{J} | d:✓ j:✓ |
| f054a | partner single 6: J+pair8 vs J+3+4 | single:J | single:J{J} | single:J{J} | d:✓ j:✓ |
| f054b | partner single 6: J+pair8 vs J+3+4 | pass | pass | pass | d:✓ j:✓ |
| f055a | partner single 9: Q+pair4 vs Q+5+7 | single:Q | single:Q{Q} | single:Q{Q} | d:✓ j:✓ |
| f055b | partner single 9: Q+pair4 vs Q+5+7 | pass | pass | pass | d:✓ j:✓ |
| f056a | partner single 5: 10+pair3 vs 10+4+3 | single:10 | single:10{10} | single:10{10} | d:✓ j:✓ |
| f056b | partner single 5: 10+pair3 vs 10+4+3 | pass | pass | pass | d:✓ j:✓ |
| f057a | partner single 8: K+pair7 vs K+4+6 | single:K | single:K{K} | single:K{K} | d:✓ j:✓ |
| f057b | partner single 8: K+pair7 vs K+4+6 | pass | pass | pass | d:✓ j:✓ |
| f058a | [5,A] level 5 vs 2 | single:5 | single:5{5} | single:5{5} | d:✓ j:✓ |
| f058b | [5,A] level 5 vs 2 | single:A | single:A{A} | single:A{A} | d:✓ j:✓ |
| f059a | [9,K] level 9 vs 2 | single:9 | single:9{9} | single:9{9} | d:✓ j:✓ |
| f059b | [9,K] level 9 vs 2 | single:K | single:K{K} | single:K{K} | d:✓ j:✓ |
| f060a | [J,A] level J vs 2 | single:J | single:J{J} | single:J{J} | d:✓ j:✓ |
| f060b | [J,A] level J vs 2 | single:A | single:A{A} | single:A{A} | d:✓ j:✓ |
| f061a | [7,Q] level 7 vs 2 | single:7 | single:7{7} | single:7{7} | d:✓ j:✓ |
| f061b | [7,Q] level 7 vs 2 | single:Q | single:Q{Q} | single:Q{Q} | d:✓ j:✓ |
| f062a | [3,A] level 3 vs 2 | single:3 | single:3{3} | single:3{3} | d:✓ j:✓ |
| f062b | [3,A] level 3 vs 2 | single:A | single:A{A} | single:A{A} | d:✓ j:✓ |
| f063a | 9H+K vs pair 10: level 9 vs 2 | pair:K | pair:K{K9} | pair:K{K9} | d:✓ j:✓ |
| f063b | 9H+K vs pair 10: level 9 vs 2 | pass | pass | pass | d:✓ j:✓ |
| f064a | 6H+Q vs pair 8: level 6 vs 2 | pair:Q | pair:Q{Q6} | pair:Q{Q6} | d:✓ j:✓ |
| f064b | 6H+Q vs pair 8: level 6 vs 2 | pass | pass | pass | d:✓ j:✓ |
| f065a | 4H+A vs pair J: level 4 vs 2 | pair:A | pair:A{A4} | pair:A{A4} | d:✓ j:✓ |
| f065b | 4H+A vs pair J: level 4 vs 2 | pass | pass | pass | d:✓ j:✓ |
| f066a | 7H+J vs pair 9: level 7 vs 2 | pair:J | pair:J{J7} | pair:J{J7} | d:✓ j:✓ |
| f066b | 7H+J vs pair 9: level 7 vs 2 | pass | pass | pass | d:✓ j:✓ |
| f067a | 888+5H vs pair A: enemy 1 vs 6 | bomb:8 | bomb:8{8885} | bomb:8{8885} | d:✓ j:✓ |
| f067b | 888+5H vs pair A: enemy 1 vs 6 | pass | pass | pass | d:✓ j:✓ |
| f068a | JJJ+9H vs pair A: enemy 1 vs 6 | bomb:J | bomb:J{JJJ9} | bomb:J{JJJ9} | d:✓ j:✓ |
| f068b | JJJ+9H vs pair A: enemy 1 vs 6 | pass | pass | pass | d:✓ j:✓ |
| f069a | 666+10H vs pair A: enemy 1 vs 6 | bomb:6 | bomb:6{66610} | bomb:6{66610} | d:✓ j:✓ |
| f069b | 666+10H vs pair A: enemy 1 vs 6 | pass | pass | pass | d:✓ j:✓ |
| f070a | QQQ+4H vs pair A: enemy 1 vs 6 | bomb:Q | bomb:Q{QQQ4} | bomb:Q{QQQ4} | d:✓ j:✓ |
| f070b | QQQ+4H vs pair A: enemy 1 vs 6 | pass | pass | pass | d:✓ j:✓ |
| f071a | KK44: enemy 1 vs partner 1 | pair:K | pair:K{KK} | pair:K{KK} | d:✓ j:✓ |
| f071b | KK44: enemy 1 vs partner 1 | single:4 | single:4{4} | single:4{4} | d:✓ j:✓ |
| f072a | AA66: enemy 1 vs partner 1 | pair:A | pair:A{AA} | pair:A{AA} | d:✓ j:✓ |
| f072b | AA66: enemy 1 vs partner 1 | single:6 | single:6{6} | single:6{6} | d:✓ j:✓ |
| f073a | QQ33: enemy 1 vs partner 1 | pair:Q | pair:Q{QQ} | pair:Q{QQ} | d:✓ j:✓ |
| f073b | QQ33: enemy 1 vs partner 1 | single:3 | single:3{3} | single:3{3} | d:✓ j:✓ |
| f074a | AA55: enemy 1 vs partner 1 | pair:A | pair:A{AA} | pair:A{AA} | d:✓ j:✓ |
| f074b | AA55: enemy 1 vs partner 1 | single:5 | single:5{5} | single:5{5} | d:✓ j:✓ |
| f075a | KK77: enemy 1 vs partner 1 | pair:K | pair:K{KK} | pair:K{KK} | d:✓ j:✓ |
| f075b | KK77: enemy 1 vs partner 1 | single:7 | single:7{7} | single:7{7} | d:✓ j:✓ |
| f076a | ['4', '8', 'Q']: enemy 1 vs partner 1 | single:Q | single:Q{Q} | single:Q{Q} | d:✓ j:✓ |
| f076b | ['4', '8', 'Q']: enemy 1 vs partner 1 | single:4 | single:4{4} | single:4{4} | d:✓ j:✓ |
| f077a | ['3', '9', 'A']: enemy 1 vs partner 1 | single:A | single:A{A} | single:A{A} | d:✓ j:✓ |
| f077b | ['3', '9', 'A']: enemy 1 vs partner 1 | single:3 | single:3{3} | single:3{3} | d:✓ j:✓ |
| f078a | ['5', '7', 'K']: enemy 1 vs partner 1 | single:K | single:K{K} | single:K{K} | d:✓ j:✓ |
| f078b | ['5', '7', 'K']: enemy 1 vs partner 1 | single:5 | single:5{5} | single:5{5} | d:✓ j:✓ |
| f079a | ['6', '10', 'J']: enemy 1 vs partner 1 | single:J | single:J{J} | single:J{J} | d:✓ j:✓ |
| f079b | ['6', '10', 'J']: enemy 1 vs partner 1 | single:6 | single:6{6} | single:6{6} | d:✓ j:✓ |
| f080a | wild 10H+J vs pair 8: enemy 1 vs 6 | pair:J | pair:J{J10} | pair:J{J10} | d:✓ j:✓ |
| f080b | wild 10H+J vs pair 8: enemy 1 vs 6 | pass | pass | pass | d:✓ j:✓ |
| f081a | wild 5H+Q vs pair 9: enemy 1 vs 6 | pair:Q | pair:Q{Q5} | pair:Q{Q5} | d:✓ j:✓ |
| f081b | wild 5H+Q vs pair 9: enemy 1 vs 6 | pass | pass | pass | d:✓ j:✓ |
| f082a | wild 7H+K vs pair 10: enemy 1 vs 6 | pair:K | pair:K{K7} | pair:K{K7} | d:✓ j:✓ |
| f082b | wild 7H+K vs pair 10: enemy 1 vs 6 | pass | pass | pass | d:✓ j:✓ |
| f083a | wild JH+9 vs pair 6: enemy 1 vs 6 | pair:9 | pair:9{9J} | pair:9{9J} | d:✓ j:✓ |
| f083b | wild JH+9 vs pair 6: enemy 1 vs 6 | pass | pass | pass | d:✓ j:✓ |
| f084a | pair 6+['4', '9', 'K']: enemy 2 vs partner 2 | single:4/9/K | single:4{4} | single:4{4} | d:✓ j:✓ |
| f084b | pair 6+['4', '9', 'K']: enemy 2 vs partner 2 | pair:6 | pair:6{66} | pair:6{66} | d:✓ j:✓ |
| f085a | pair 8+['3', '10', 'Q']: enemy 2 vs partner 2 | single:3/10/Q | single:3{3} | single:3{3} | d:✓ j:✓ |
| f085b | pair 8+['3', '10', 'Q']: enemy 2 vs partner 2 | pair:8 | pair:8{88} | pair:8{88} | d:✓ j:✓ |
| f086a | pair 5+['7', '9', 'J']: enemy 2 vs partner 2 | single:7/9/J | single:7{7} | single:7{7} | d:✓ j:✓ |
| f086b | pair 5+['7', '9', 'J']: enemy 2 vs partner 2 | pair:5 | pair:5{55} | pair:5{55} | d:✓ j:✓ |
| f087a | pair J+['4', '6', '8']: enemy 2 vs partner 2 | single:4/6/8 | single:4{4} | single:4{4} | d:✓ j:✓ |
| f087b | pair J+['4', '6', '8']: enemy 2 vs partner 2 | pair:J | pair:J{JJ} | pair:J{JJ} | d:✓ j:✓ |
| f088a | ['3', '6', '9', 'Q']: lead vs follow single 7 | single:3 | single:3{3} | single:3{3} | d:✓ j:✓ |
| f088b | ['3', '6', '9', 'Q']: lead vs follow single 7 | single:9 | single:9{9} | single:9{9} | d:✓ j:✓ |
| f089a | ['4', '8', '10', 'K']: lead vs follow single 9 | single:4 | single:4{4} | single:4{4} | d:✓ j:✓ |
| f089b | ['4', '8', '10', 'K']: lead vs follow single 9 | single:10 | single:10{10} | single:10{10} | d:✓ j:✓ |
| f090a | ['3', '5', 'J', 'A']: lead vs follow single 8 | single:3 | single:3{3} | single:3{3} | d:✓ j:✓ |
| f090b | ['3', '5', 'J', 'A']: lead vs follow single 8 | single:J | single:J{J} | single:J{J} | d:✓ j:✓ |
| f091a | ['5', '7', '9', 'Q']: lead vs follow single 6 | single:5 | single:5{5} | single:5{5} | d:✓ j:✓ |
| f091b | ['5', '7', '9', 'Q']: lead vs follow single 6 | single:7 | single:7{7} | single:9{9} | d:✓ j:✗ |
| f092a | enemy 1: bomb 9x4 vs x5; have Qx4 + SF | bomb:Q | bomb:Q{QQQQ} | bomb:Q{QQQQ} | d:✓ j:✓ |
| f092b | enemy 1: bomb 9x4 vs x5; have Qx4 + SF | straightFlush: | straightFlush:7{34567} | straightFlush:7{34567} | d:✓ j:✓ |
| f093a | enemy 1: bomb 6x4 vs x5; have Kx4 + SF | bomb:K | bomb:K{KKKK} | bomb:K{KKKK} | d:✓ j:✓ |
| f093b | enemy 1: bomb 6x4 vs x5; have Kx4 + SF | straightFlush: | straightFlush:Q{8910JQ} | straightFlush:Q{8910JQ} | d:✓ j:✓ |
| f094a | enemy 1: bomb Jx4 vs x5; have Ax4 + SF | bomb:A | bomb:A{AAAA} | bomb:A{AAAA} | d:✓ j:✓ |
| f094b | enemy 1: bomb Jx4 vs x5; have Ax4 + SF | straightFlush: | straightFlush:8{45678} | straightFlush:8{45678} | d:✓ j:✓ |
| f095a | FH 6 by enemy(1 card) vs partner; mine FH 10 | fullhouse:10 | fullhouse:10{10101033} | fullhouse:10{10101033} | d:✓ j:✓ |
| f095b | FH 6 by enemy(1 card) vs partner; mine FH 10 | pass | pass | pass | d:✓ j:✓ |
| f096a | FH 8 by enemy(1 card) vs partner; mine FH Q | fullhouse:Q | fullhouse:Q{QQQ44} | fullhouse:Q{QQQ44} | d:✓ j:✓ |
| f096b | FH 8 by enemy(1 card) vs partner; mine FH Q | pass | pass | pass | d:✓ j:✓ |
| f097a | FH 5 by enemy(1 card) vs partner; mine FH J | fullhouse:J | fullhouse:J{JJJ77} | fullhouse:J{JJJ77} | d:✓ j:✓ |
| f097b | FH 5 by enemy(1 card) vs partner; mine FH J | pass | pass | pass | d:✓ j:✓ |
| f098a | FH 9 by enemy(1 card) vs partner; mine FH K | fullhouse:K | fullhouse:K{KKK55} | fullhouse:K{KKK55} | d:✓ j:✓ |
| f098b | FH 9 by enemy(1 card) vs partner; mine FH K | pass | pass | pass | d:✓ j:✓ |
| f099a | enemy 1: single A vs 6x8 bomb; rocket + 5x4 | bomb:5 | bomb:5{5555} | bomb:5{5555} | d:✓ j:✓ |
| f099b | enemy 1: single A vs 6x8 bomb; rocket + 5x4 | bomb:RJ | bomb:RJ{BJBJRJRJ} | bomb:RJ{BJBJRJRJ} | d:✓ j:✓ |
| f100a | enemy 1: single A vs 6x8 bomb; rocket + 9x4 | bomb:9 | bomb:9{9999} | bomb:9{9999} | d:✓ j:✓ |
| f100b | enemy 1: single A vs 6x8 bomb; rocket + 9x4 | bomb:RJ | bomb:RJ{BJBJRJRJ} | bomb:RJ{BJBJRJRJ} | d:✓ j:✓ |
| f101a | enemy 1: single A vs 6x8 bomb; rocket + Jx4 | bomb:J | bomb:J{JJJJ} | bomb:J{JJJJ} | d:✓ j:✓ |
| f101b | enemy 1: single A vs 6x8 bomb; rocket + Jx4 | bomb:RJ | bomb:RJ{BJBJRJRJ} | bomb:RJ{BJBJRJRJ} | d:✓ j:✓ |
