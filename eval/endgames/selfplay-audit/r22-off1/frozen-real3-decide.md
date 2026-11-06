# Pair eval report

- generated: 2026-10-25T11:18:41.017Z
- file: frozen-real3.jsonl
- cases: 120, pairs: 0
- gold legality: 120/120 legal

| system | case acc | pair acc |
|---|---|---|
| decide | 107/120 (89.2%) | - |

| id | pivot | gold | decide |  ok |
|---|---|---|---|---|
| t001 |  | single:2 | single:2{2} |  d:✓ |
| t002 |  | bomb:2 | bomb:2{2222} |  d:✓ |
| t003 |  | single:7 | single:7{7} |  d:✓ |
| t004 |  | bomb:7 | bomb:7{7777} |  d:✓ |
| t005 |  | pair:10 | pair:10{1010} |  d:✓ |
| t006 |  | pair:9 | pair:9{99} |  d:✓ |
| t007 |  | single:RJ | single:RJ{RJ} |  d:✓ |
| t008 |  | single:BJ | pass |  d:✗ |
| t009 |  | pass | pass |  d:✓ |
| t010 |  | bomb:9 | bomb:9{9999} |  d:✓ |
| t011 |  | single:7 | single:7{7} |  d:✓ |
| t012 |  | single:J | single:J{J} |  d:✓ |
| t013 |  | pass | pass |  d:✓ |
| t014 |  | single:K | single:BJ{BJ} |  d:✓ |
| t015 |  | single:6 | single:6{6} |  d:✓ |
| t016 |  | pair:7 | pair:7{77} |  d:✓ |
| t017 |  | single:J | single:J{J} |  d:✓ |
| t018 |  | pass | pass |  d:✓ |
| t019 |  | pass | pass |  d:✓ |
| t020 |  | single:RJ | single:RJ{RJ} |  d:✓ |
| t021 |  | pass | pass |  d:✓ |
| t022 |  | pass | pass |  d:✓ |
| t023 |  | fullhouse:4 | fullhouse:4{44466} |  d:✓ |
| t024 |  | single:10 | single:10{10} |  d:✓ |
| t025 |  | pass | pass |  d:✓ |
| t026 |  | single:2 | single:2{2} |  d:✓ |
| t027 |  | pair:9 | pair:9{99} |  d:✓ |
| t028 |  | pass | pass |  d:✓ |
| t029 |  | pair:RJ | single:2{2} |  d:✓ |
| t030 |  | pass | pass |  d:✓ |
| t031 |  | pair:3 | single:3{3} |  d:✗ |
| t032 |  | single:2 | single:2{2} |  d:✓ |
| t033 |  | bomb:3 | single:J{J} |  d:✗ |
| t034 |  | single:BJ | single:BJ{BJ} |  d:✓ |
| t035 |  | single:8 | single:8{8} |  d:✓ |
| t036 |  | single:9 | single:9{9} |  d:✓ |
| t037 |  | pass | pass |  d:✓ |
| t038 |  | single:5 | single:5{5} |  d:✓ |
| t039 |  | pass | pass |  d:✓ |
| t040 |  | pair:6 | pair:6{66} |  d:✓ |
| t041 |  | pass | pass |  d:✓ |
| t042 |  | pairSeq:6 | pairSeq:6{445566} |  d:✓ |
| t043 |  | pass | pass |  d:✓ |
| t044 |  | pass | pass |  d:✓ |
| t045 |  | pass | single:A{A} |  d:✗ |
| t046 |  | pass | pass |  d:✓ |
| t047 |  | single:Q | single:Q{Q} |  d:✓ |
| t048 |  | single:Q | single:Q{Q} |  d:✓ |
| t049 |  | single:2 | single:2{2} |  d:✓ |
| t050 |  | single:4 | single:4{4} |  d:✓ |
| t051 |  | single:8 | single:Q{Q} |  d:✗ |
| t052 |  | pass | pass |  d:✓ |
| t053 |  | pass | pass |  d:✓ |
| t054 |  | pass | pass |  d:✓ |
| t055 |  | bomb:7 | bomb:7{7777} |  d:✓ |
| t056 |  | bomb:3 | bomb:3{3333} |  d:✓ |
| t057 |  | pass | pass |  d:✓ |
| t058 |  | pass | pass |  d:✓ |
| t059 |  | pair:Q | pass |  d:✗ |
| t060 |  | single:BJ | single:BJ{BJ} |  d:✓ |
| t061 |  | straight:6 | single:2{2} |  d:✗ |
| t062 |  | single:3 | single:3{3} |  d:✓ |
| t063 |  | pass | pass |  d:✓ |
| t064 |  | pair:4 | pair:4{44} |  d:✓ |
| t065 |  | pass | pass |  d:✓ |
| t066 |  | pass | pass |  d:✓ |
| t067 |  | bomb:5 | pass |  d:✗ |
| t068 |  | single:5 | single:5{5} |  d:✓ |
| t069 |  | pass | pass |  d:✓ |
| t070 |  | bomb:J | bomb:J{JJJJ} |  d:✓ |
| t071 |  | pass | pass |  d:✓ |
| t072 |  | pass | pass |  d:✓ |
| t073 |  | pass | pass |  d:✓ |
| t074 |  | pair:7 | pair:7{77} |  d:✓ |
| t075 |  | single:2 | single:2{2} |  d:✓ |
| t076 |  | pair:J | pair:J{JJ} |  d:✓ |
| t077 |  | single:3 | single:3{3} |  d:✓ |
| t078 |  | pass | pass |  d:✓ |
| t079 |  | single:BJ | single:BJ{BJ} |  d:✓ |
| t080 |  | pass | pass |  d:✓ |
| t081 |  | pairSeq:K | pairSeq:K{JQQKKJ} |  d:✓ |
| t082 |  | pair:4 | pair:4{44} |  d:✓ |
| t083 |  | single:4 | single:4{4} |  d:✓ |
| t084 |  | bomb:8 | bomb:8{8888} |  d:✓ |
| t085 |  | single:9 | single:9{9} |  d:✓ |
| t086 |  | single:RJ | single:RJ{RJ} |  d:✓ |
| t087 |  | single:3 | single:3{3} |  d:✓ |
| t088 |  | pass | single:4{4} |  d:✓ |
| t089 |  | single:3 | single:3{3} |  d:✓ |
| t090 |  | single:6 | single:6{6} |  d:✓ |
| t091 |  | single:K | single:K{K} |  d:✓ |
| t092 |  | single:7 | single:7{7} |  d:✓ |
| t093 |  | pair:Q | pair:Q{QQ} |  d:✓ |
| t094 |  | single:4 | single:4{4} |  d:✓ |
| t095 |  | single:Q | single:Q{Q} |  d:✓ |
| t096 |  | single:9 | single:9{9} |  d:✓ |
| t097 |  | pass | pass |  d:✓ |
| t098 |  | bomb:8 | bomb:8{8888} |  d:✓ |
| t099 |  | pass | pass |  d:✓ |
| t100 |  | single:BJ | pair:10{1010} |  d:✗ |
| t101 |  | single:4 | single:4{4} |  d:✓ |
| t102 |  | bomb:4 | bomb:4{4444} |  d:✓ |
| t103 |  | pair:10 | pair:10{1010} |  d:✓ |
| t104 |  | single:5 | single:5{5} |  d:✓ |
| t105 |  | pair:5 | pair:5{55} |  d:✓ |
| t106 |  | pass | single:K{K} |  d:✗ |
| t107 |  | pass | single:K{K} |  d:✗ |
| t108 |  | pair:2 | pair:2{22} |  d:✓ |
| t109 |  | single:BJ | single:BJ{BJ} |  d:✓ |
| t110 |  | pair:3 | pair:3{33} |  d:✓ |
| t111 |  | pair:10 | pair:10{1010} |  d:✓ |
| t112 |  | pass | pass |  d:✓ |
| t113 |  | pair:7 | pair:7{77} |  d:✓ |
| t114 |  | pass | pass |  d:✓ |
| t115 |  | pass | pass |  d:✓ |
| t116 |  | pair:A | pair:A{AA} |  d:✓ |
| t117 |  | pair:2 | bomb:J{JJJJ} |  d:✗ |
| t118 |  | pass | pass |  d:✓ |
| t119 |  | single:BJ | single:BJ{BJ} |  d:✓ |
| t120 |  | bomb:4 | pass |  d:✗ |
