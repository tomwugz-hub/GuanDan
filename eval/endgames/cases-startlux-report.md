# Pair eval report

- generated: 2026-10-16T23:26:06.441Z
- file: cases.jsonl
- cases: 50, pairs: 0
- gold legality: 50/50 legal

| system | case acc | pair acc |
|---|---|---|
| decide | 50/50 (100.0%) | - |
| startlux | 36/50 (72.0%) | - |

| id | pivot | gold | decide | startlux | ok |
|---|---|---|---|---|---|
| eg001 |  | single:8 | single:8{8} | single:8{8} | d:✓ s:✓ |
| eg002 |  | pair:9 | pair:9{99} | pair:9{99} | d:✓ s:✓ |
| eg003 |  | single:A/K/Q | single:A{A} | single:K{K} | d:✓ s:✓ |
| eg004 |  | single:J/8/6/5 | single:J{J} | pass | d:✓ s:✗ |
| eg005 |  | single:A | single:A{A} | single:A{A} | d:✓ s:✓ |
| eg006 |  | pair:5 | pair:5{55} | pair:5{55} | d:✓ s:✓ |
| eg007 |  | pair:K | pair:K{KK} | pair:K{KK} | d:✓ s:✓ |
| eg008 |  | single:A | single:A{A} | single:K{K} | d:✓ s:✗ |
| eg009 |  | pass | pass | pass | d:✓ s:✓ |
| eg010 |  | triple:A | triple:A{AAA} | triple:A{AAA} | d:✓ s:✓ |
| eg011 |  | single:BJ/RJ | single:RJ{RJ} | single:RJ{RJ} | d:✓ s:✓ |
| eg012 |  | single:3 | single:3{3} | bomb:6{6666} | d:✓ s:✗ |
| eg013 |  | fullhouse:J | fullhouse:J{JJJ55} | pass | d:✓ s:✗ |
| eg014 |  | single:9/10/J/Q/K/A | single:Q{Q} | single:9{9} | d:✓ s:✓ |
| eg015 |  | pair:4 | pair:4{44} | pair:4{44} | d:✓ s:✓ |
| eg016 |  | bomb:5 | bomb:5{5555} | bomb:5{5555} | d:✓ s:✓ |
| eg017 |  | pair:K | pair:K{KK} | pair:K{KK} | d:✓ s:✓ |
| eg018 |  | tripleSeq:7/8 | tripleSeq:8{777888} | fullhouse:8{88877} | d:✓ s:✗ |
| eg019 |  | pass | pass | pass | d:✓ s:✓ |
| eg020 |  | bomb:9 | bomb:9{9999} | bomb:9{9999} | d:✓ s:✓ |
| eg021 |  | pairSeq:5/6/7 | pairSeq:7{556677} | single:K{K} | d:✓ s:✗ |
| eg022 |  | single:A | single:A{A} | single:A{A} | d:✓ s:✓ |
| eg023 |  | single:A/K/Q | single:A{A} | single:K{K} | d:✓ s:✓ |
| eg024 |  | pass | pass | pair:8{88} | d:✓ s:✗ |
| eg025 |  | single:2 | single:2{2} | single:2{2} | d:✓ s:✓ |
| eg026 |  | fullhouse:9 | fullhouse:9{99955} | triple:9{999} | d:✓ s:✗ |
| eg027 |  | single:8 | single:8{8} | pair:3{33} | d:✓ s:✗ |
| eg028 |  | bomb:A | bomb:A{AAAA} | bomb:A{AAAA} | d:✓ s:✓ |
| eg029 |  | pass | pass | pass | d:✓ s:✓ |
| eg030 |  | single:Q | single:Q{Q} | pass | d:✓ s:✗ |
| eg031 |  | single:3 | single:3{3} | pair:2{22} | d:✓ s:✗ |
| eg032 |  | straight:3 | straight:7{34567} | straight:7{34567} | d:✓ s:✓ |
| eg033 |  | pass | pass | pass | d:✓ s:✓ |
| eg034 |  | pair:A | pair:A{AA} | pass | d:✓ s:✗ |
| eg035 |  | single:BJ/RJ | single:RJ{RJ} | single:RJ{RJ} | d:✓ s:✓ |
| eg036 |  | pass | pass | pass | d:✓ s:✓ |
| eg037 |  | pair:K | pair:K{KK} | pair:K{KK} | d:✓ s:✓ |
| eg038 |  | pass | pass | pass | d:✓ s:✓ |
| eg039 |  | pass | pass | pass | d:✓ s:✓ |
| eg040 |  | bomb:7 | bomb:7{7777} | bomb:7{7777} | d:✓ s:✓ |
| eg041 |  | single:Q/K/A | single:A{A} | single:K{K} | d:✓ s:✓ |
| eg042 |  | single:4/5/6 | single:4{4} | triple:8{888} | d:✓ s:✗ |
| eg043 |  | single:BJ/RJ | single:RJ{RJ} | single:RJ{RJ} | d:✓ s:✓ |
| eg044 |  | fullhouse:K | fullhouse:K{KKK55} | fullhouse:K{KKK55} | d:✓ s:✓ |
| eg045 |  | pairSeq:4/5/6 | pairSeq:6{445566} | pairSeq:6{445566} | d:✓ s:✓ |
| eg046 |  | single:A/K | single:A{A} | single:K{K} | d:✓ s:✓ |
| eg047 |  | single:2 | single:2{2} | pass | d:✓ s:✗ |
| eg048 |  | pair:Q | pair:Q{QQ} | pair:Q{QQ} | d:✓ s:✓ |
| eg049 |  | bomb:4 | bomb:4{4444} | bomb:4{4444} | d:✓ s:✓ |
| eg050 |  | pass | pass | pass | d:✓ s:✓ |
