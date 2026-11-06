# Pair eval report

- generated: 2026-10-19T22:15:08.707Z
- file: frozen-real3.jsonl
- cases: 120, pairs: 0
- gold legality: 120/120 legal

| system | case acc | pair acc |
|---|---|---|
| decide | 106/120 (88.3%) | - |
| startlux | 98/120 (81.7%) | - |

| id | pivot | gold | decide | startlux | ok |
|---|---|---|---|---|---|
| t001 |  | single:2 | single:2{2} | single:2{2} | d:✓ s:✓ |
| t002 |  | bomb:2 | bomb:2{2222} | bomb:2{2222} | d:✓ s:✓ |
| t003 |  | single:7 | single:7{7} | pass | d:✓ s:✗ |
| t004 |  | bomb:7 | bomb:7{7777} | bomb:7{7777} | d:✓ s:✓ |
| t005 |  | pair:10 | pair:10{1010} | pair:10{1010} | d:✓ s:✓ |
| t006 |  | pair:9 | pair:9{99} | pair:9{99} | d:✓ s:✓ |
| t007 |  | single:RJ | single:RJ{RJ} | single:RJ{RJ} | d:✓ s:✓ |
| t008 |  | single:BJ | pass | pass | d:✗ s:✗ |
| t009 |  | pass | pass | pass | d:✓ s:✓ |
| t010 |  | bomb:9 | bomb:9{9999} | bomb:9{9999} | d:✓ s:✓ |
| t011 |  | single:7 | single:7{7} | single:7{7} | d:✓ s:✓ |
| t012 |  | single:J | single:J{J} | single:J{J} | d:✓ s:✓ |
| t013 |  | pass | pass | pass | d:✓ s:✓ |
| t014 |  | single:K | single:BJ{BJ} | pass | d:✓ s:✗ |
| t015 |  | single:6 | single:6{6} | single:6{6} | d:✓ s:✓ |
| t016 |  | pair:7 | pair:7{77} | pair:7{77} | d:✓ s:✓ |
| t017 |  | single:J | single:J{J} | single:J{J} | d:✓ s:✓ |
| t018 |  | pass | pass | pass | d:✓ s:✓ |
| t019 |  | pass | pass | pass | d:✓ s:✓ |
| t020 |  | single:RJ | single:RJ{RJ} | single:RJ{RJ} | d:✓ s:✓ |
| t021 |  | pass | pass | pass | d:✓ s:✓ |
| t022 |  | pass | pass | pass | d:✓ s:✓ |
| t023 |  | fullhouse:4 | fullhouse:4{44466} | fullhouse:4{44488} | d:✓ s:✓ |
| t024 |  | single:10 | single:10{10} | pass | d:✓ s:✗ |
| t025 |  | pass | pass | pass | d:✓ s:✓ |
| t026 |  | single:2 | single:2{2} | single:2{2} | d:✓ s:✓ |
| t027 |  | pair:9 | pair:9{99} | pair:9{99} | d:✓ s:✓ |
| t028 |  | pass | pass | pass | d:✓ s:✓ |
| t029 |  | pair:RJ | bomb:8{8888} | pair:RJ{RJRJ} | d:✗ s:✓ |
| t030 |  | pass | pass | pass | d:✓ s:✓ |
| t031 |  | pair:3 | single:3{3} | single:3{3} | d:✗ s:✗ |
| t032 |  | single:2 | single:2{2} | single:2{2} | d:✓ s:✓ |
| t033 |  | bomb:3 | single:J{J} | single:J{J} | d:✗ s:✗ |
| t034 |  | single:BJ | single:BJ{BJ} | single:BJ{BJ} | d:✓ s:✓ |
| t035 |  | single:8 | single:8{8} | single:8{8} | d:✓ s:✓ |
| t036 |  | single:9 | single:9{9} | single:9{9} | d:✓ s:✓ |
| t037 |  | pass | pass | pass | d:✓ s:✓ |
| t038 |  | single:5 | single:5{5} | single:5{5} | d:✓ s:✓ |
| t039 |  | pass | pass | pass | d:✓ s:✓ |
| t040 |  | pair:6 | pair:6{66} | pair:6{66} | d:✓ s:✓ |
| t041 |  | pass | pass | pass | d:✓ s:✓ |
| t042 |  | pairSeq:6 | pairSeq:6{445566} | pairSeq:6{445566} | d:✓ s:✓ |
| t043 |  | pass | pass | pass | d:✓ s:✓ |
| t044 |  | pass | pass | pass | d:✓ s:✓ |
| t045 |  | pass | single:A{A} | pass | d:✗ s:✓ |
| t046 |  | pass | pass | pass | d:✓ s:✓ |
| t047 |  | single:Q | single:Q{Q} | bomb:7{7777} | d:✓ s:✗ |
| t048 |  | single:Q | single:Q{Q} | single:6{6} | d:✓ s:✗ |
| t049 |  | single:2 | single:2{2} | single:2{2} | d:✓ s:✓ |
| t050 |  | single:4 | single:4{4} | single:4{4} | d:✓ s:✓ |
| t051 |  | single:8 | single:Q{Q} | single:8{8} | d:✗ s:✓ |
| t052 |  | pass | pass | pass | d:✓ s:✓ |
| t053 |  | pass | pass | pass | d:✓ s:✓ |
| t054 |  | pass | pass | pass | d:✓ s:✓ |
| t055 |  | bomb:7 | bomb:7{7777} | bomb:7{7777} | d:✓ s:✓ |
| t056 |  | bomb:3 | bomb:3{3333} | bomb:3{3333} | d:✓ s:✓ |
| t057 |  | pass | pass | pass | d:✓ s:✓ |
| t058 |  | pass | pass | pass | d:✓ s:✓ |
| t059 |  | pair:Q | pass | pass | d:✗ s:✗ |
| t060 |  | single:BJ | single:BJ{BJ} | single:BJ{BJ} | d:✓ s:✓ |
| t061 |  | straight:6 | single:2{2} | single:2{2} | d:✗ s:✗ |
| t062 |  | single:3 | single:3{3} | single:3{3} | d:✓ s:✓ |
| t063 |  | pass | pass | pass | d:✓ s:✓ |
| t064 |  | pair:4 | pair:4{44} | pair:4{44} | d:✓ s:✓ |
| t065 |  | pass | pass | pass | d:✓ s:✓ |
| t066 |  | pass | pass | pass | d:✓ s:✓ |
| t067 |  | bomb:5 | pass | bomb:5{5555Q} | d:✗ s:✓ |
| t068 |  | single:5 | single:5{5} | single:5{5} | d:✓ s:✓ |
| t069 |  | pass | pass | pass | d:✓ s:✓ |
| t070 |  | bomb:J | bomb:J{JJJJ} | bomb:J{JJJJ} | d:✓ s:✓ |
| t071 |  | pass | pass | pass | d:✓ s:✓ |
| t072 |  | pass | pass | pass | d:✓ s:✓ |
| t073 |  | pass | pass | pass | d:✓ s:✓ |
| t074 |  | pair:7 | pair:7{77} | pair:7{77} | d:✓ s:✓ |
| t075 |  | single:2 | single:2{2} | single:2{2} | d:✓ s:✓ |
| t076 |  | pair:J | pair:J{JJ} | pair:J{JJ} | d:✓ s:✓ |
| t077 |  | single:3 | single:3{3} | single:3{3} | d:✓ s:✓ |
| t078 |  | pass | pass | pass | d:✓ s:✓ |
| t079 |  | single:BJ | single:BJ{BJ} | single:BJ{BJ} | d:✓ s:✓ |
| t080 |  | pass | pass | pass | d:✓ s:✓ |
| t081 |  | pairSeq:K | pairSeq:K{JQQKKJ} | pairSeq:K{JQQKKJ} | d:✓ s:✓ |
| t082 |  | pair:4 | pair:4{44} | pair:4{44} | d:✓ s:✓ |
| t083 |  | single:4 | single:4{4} | single:BJ{BJ} | d:✓ s:✓ |
| t084 |  | bomb:8 | bomb:8{8888} | bomb:8{8888} | d:✓ s:✓ |
| t085 |  | single:9 | single:9{9} | pass | d:✓ s:✗ |
| t086 |  | single:RJ | single:RJ{RJ} | single:RJ{RJ} | d:✓ s:✓ |
| t087 |  | single:3 | single:3{3} | single:3{3} | d:✓ s:✓ |
| t088 |  | pass | single:4{4} | single:4{4} | d:✓ s:✓ |
| t089 |  | single:3 | single:3{3} | pair:5{55} | d:✓ s:✗ |
| t090 |  | single:6 | single:6{6} | pass | d:✓ s:✗ |
| t091 |  | single:K | single:K{K} | single:K{K} | d:✓ s:✓ |
| t092 |  | single:7 | single:7{7} | pair:2{22} | d:✓ s:✓ |
| t093 |  | pair:Q | pair:Q{QQ} | pair:Q{QQ} | d:✓ s:✓ |
| t094 |  | single:4 | single:4{4} | single:K{K} | d:✓ s:✗ |
| t095 |  | single:Q | single:Q{Q} | single:Q{Q} | d:✓ s:✓ |
| t096 |  | single:9 | single:9{9} | single:9{9} | d:✓ s:✓ |
| t097 |  | pass | pass | pass | d:✓ s:✓ |
| t098 |  | bomb:8 | bomb:8{8888} | bomb:8{8888} | d:✓ s:✓ |
| t099 |  | pass | pass | pass | d:✓ s:✓ |
| t100 |  | single:BJ | pair:10{1010} | pair:10{1010} | d:✗ s:✗ |
| t101 |  | single:4 | single:4{4} | pass | d:✓ s:✗ |
| t102 |  | bomb:4 | bomb:4{4444} | bomb:4{4444} | d:✓ s:✓ |
| t103 |  | pair:10 | pair:10{1010} | pair:10{1010} | d:✓ s:✓ |
| t104 |  | single:5 | single:5{5} | single:5{5} | d:✓ s:✓ |
| t105 |  | pair:5 | pair:5{55} | pair:5{55} | d:✓ s:✓ |
| t106 |  | pass | single:K{K} | single:J{J} | d:✗ s:✗ |
| t107 |  | pass | single:K{K} | single:K{K} | d:✗ s:✗ |
| t108 |  | pair:2 | pair:2{22} | pair:2{22} | d:✓ s:✓ |
| t109 |  | single:BJ | single:BJ{BJ} | single:BJ{BJ} | d:✓ s:✓ |
| t110 |  | pair:3 | pair:3{33} | pair:4{44} | d:✓ s:✗ |
| t111 |  | pair:10 | pair:10{1010} | pair:10{1010} | d:✓ s:✓ |
| t112 |  | pass | pass | pass | d:✓ s:✓ |
| t113 |  | pair:7 | pair:7{77} | pair:7{77} | d:✓ s:✓ |
| t114 |  | pass | pass | pass | d:✓ s:✓ |
| t115 |  | pass | pass | pass | d:✓ s:✓ |
| t116 |  | pair:A | pair:A{AA} | pass | d:✓ s:✗ |
| t117 |  | pair:2 | bomb:J{JJJJ} | bomb:J{JJJJ} | d:✗ s:✗ |
| t118 |  | pass | pass | pass | d:✓ s:✓ |
| t119 |  | single:BJ | single:BJ{BJ} | single:BJ{BJ} | d:✓ s:✓ |
| t120 |  | bomb:4 | pass | pass | d:✗ s:✗ |
