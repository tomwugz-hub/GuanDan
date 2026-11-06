# Pair eval report

- generated: 2026-10-17T07:28:57.199Z
- file: mini.jsonl
- cases: 10, pairs: 5
- gold legality: 10/10 legal

| system | case acc | pair acc |
|---|---|---|
| decide | 10/10 (100.0%) | 5/5 (100.0%) |
| jev | 4/10 (40.0%) | 4/5 (80.0%) |

| id | pivot | gold | decide | jev | ok |
|---|---|---|---|---|---|
| p24a | enemy(1) count 2 vs 6 (all pairs) | single: | single:9{9} | single:4{4} | d:✓ j:✓ |
| k03b | levelRank 2 vs 4 with [J,4] two singles | single:4 | single:4{4} | single:4{4} | d:✓ j:✓ |
| k46b | two-card seat is partner(2) vs enemy(1); all-pairs QQKK | single: | single:K{K} | single:K{K} | d:✓ j:✓ |
| m11b | enemy(1) count 2 vs 6; triple 5 vs KKK88+3 | pass | pass | triple:K{KKK} | d:✓ j:✗ |
| m17a | partner(2) count 1 vs 5 with [BJ,6] | single:BJ | single:BJ{BJ} | single:BJ{BJ} | d:✓ j:✓ |
| d047 |  | pair:9 | pair:9{99} | single:BJ{BJ} | d:✓ j:✗ |
| d087 |  | straight:Q | straight:Q{8910JQ} | pair:8{88} | d:✓ j:✗ |
| L003 |  | tripleSeq:5 | tripleSeq:5{444555} | pair:3{33} | d:✓ j:✗ |
| L023 |  | single:5/7/10 | single:5{5} | single:2{2} | d:✓ j:✗ |
| L044 |  | pair:5 | pair:5{55} | single:A{A} | d:✓ j:✗ |
