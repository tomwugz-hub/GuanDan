# Pair eval report

- generated: 2026-10-17T04:54:32.430Z
- file: cases.jsonl
- cases: 50, pairs: 0
- gold legality: 50/50 legal

| system | case acc | pair acc |
|---|---|---|
| decide | 50/50 (100.0%) | - |
| jev | 49/50 (98.0%) | - |

| id | pivot | gold | decide | jev | ok |
|---|---|---|---|---|---|
| eg001 |  | single:8 | single:8{8} | single:8{8} | d:✓ j:✓ |
| eg002 |  | pass | pass | pass | d:✓ j:✓ |
| eg003 |  | single:A/K/Q | single:A{A} | single:A{A} | d:✓ j:✓ |
| eg004 |  | single:J/8/6/5 | single:J{J} | single:J{J} | d:✓ j:✓ |
| eg005 |  | single:A | single:A{A} | single:A{A} | d:✓ j:✓ |
| eg006 |  | pair:5 | pair:5{55} | pair:5{55} | d:✓ j:✓ |
| eg007 |  | pair:K | pair:K{KK} | pair:K{KK} | d:✓ j:✓ |
| eg008 |  | single:A | single:A{A} | single:A{A} | d:✓ j:✓ |
| eg009 |  | pass | pass | pass | d:✓ j:✓ |
| eg010 |  | triple:A | triple:A{AAA} | triple:A{AAA} | d:✓ j:✓ |
| eg011 |  | single:BJ/RJ | single:RJ{RJ} | single:RJ{RJ} | d:✓ j:✓ |
| eg012 |  | single:3 | single:3{3} | single:3{3} | d:✓ j:✓ |
| eg013 |  | fullhouse:J | fullhouse:J{JJJ55} | fullhouse:J{JJJ55} | d:✓ j:✓ |
| eg014 |  | single:9/10/J/Q/K/A | single:Q{Q} | single:Q{Q} | d:✓ j:✓ |
| eg015 |  | single:9 | single:9{9} | single:9{9} | d:✓ j:✓ |
| eg016 |  | bomb:5 | bomb:5{5555} | bomb:5{5555} | d:✓ j:✓ |
| eg017 |  | pair:K | pair:K{KK} | pair:K{KK} | d:✓ j:✓ |
| eg018 |  | tripleSeq:7/8 | tripleSeq:8{777888} | tripleSeq:8{777888} | d:✓ j:✓ |
| eg019 |  | pass | pass | pass | d:✓ j:✓ |
| eg020 |  | bomb:9 | bomb:9{9999} | bomb:9{9999} | d:✓ j:✓ |
| eg021 |  | pairSeq:5/6/7 | pairSeq:7{556677} | pairSeq:7{556677} | d:✓ j:✓ |
| eg022 |  | single:A | single:A{A} | single:A{A} | d:✓ j:✓ |
| eg023 |  | single:A/K/Q | single:A{A} | single:A{A} | d:✓ j:✓ |
| eg024 |  | pass | pass | pass | d:✓ j:✓ |
| eg025 |  | single:2 | single:2{2} | single:2{2} | d:✓ j:✓ |
| eg026 |  | fullhouse:9 | fullhouse:9{99955} | fullhouse:9{99955} | d:✓ j:✓ |
| eg027 |  | single:8 | single:8{8} | single:3{3} | d:✓ j:✗ |
| eg028 |  | bomb:A | bomb:A{AAAA} | bomb:A{AAAA} | d:✓ j:✓ |
| eg029 |  | pass | pass | pass | d:✓ j:✓ |
| eg030 |  | single:Q | single:Q{Q} | single:Q{Q} | d:✓ j:✓ |
| eg031 |  | straight:3/7 | straight:7{34567} | straight:7{34567} | d:✓ j:✓ |
| eg032 |  | straight:3 | straight:7{34567} | straight:7{34567} | d:✓ j:✓ |
| eg033 |  | pass | pass | pass | d:✓ j:✓ |
| eg034 |  | pair:A | pair:A{AA} | pair:A{AA} | d:✓ j:✓ |
| eg035 |  | single:BJ/RJ | single:RJ{RJ} | single:RJ{RJ} | d:✓ j:✓ |
| eg036 |  | pass | pass | pass | d:✓ j:✓ |
| eg037 |  | pair:K | pair:K{KK} | pair:K{KK} | d:✓ j:✓ |
| eg038 |  | pass | pass | pass | d:✓ j:✓ |
| eg039 |  | pass | pass | pass | d:✓ j:✓ |
| eg040 |  | bomb:7 | bomb:7{7777} | bomb:7{7777} | d:✓ j:✓ |
| eg041 |  | single:Q/K/A | single:A{A} | single:A{A} | d:✓ j:✓ |
| eg042 |  | single:4/5/6 | single:4{4} | single:4{4} | d:✓ j:✓ |
| eg043 |  | single:BJ/RJ | single:RJ{RJ} | single:RJ{RJ} | d:✓ j:✓ |
| eg044 |  | fullhouse:K | fullhouse:K{KKK55} | fullhouse:K{KKK55} | d:✓ j:✓ |
| eg045 |  | pairSeq:4/5/6 | pairSeq:6{445566} | pairSeq:6{445566} | d:✓ j:✓ |
| eg046 |  | single:A/K | single:A{A} | single:A{A} | d:✓ j:✓ |
| eg047 |  | single:2 | single:2{2} | single:2{2} | d:✓ j:✓ |
| eg048 |  | pair:Q | pair:Q{QQ} | pair:Q{QQ} | d:✓ j:✓ |
| eg049 |  | bomb:4 | bomb:4{4444} | bomb:4{4444} | d:✓ j:✓ |
| eg050 |  | pass | pass | pass | d:✓ j:✓ |
