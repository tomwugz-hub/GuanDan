# Pair eval report

- generated: 2026-10-19T22:03:50.161Z
- file: frozen-real3.jsonl
- cases: 120, pairs: 0
- gold legality: 120/120 legal

| system | case acc | pair acc |
|---|---|---|
| decide | 108/120 (90.0%) | - |
| jev | 108/120 (90.0%) | - |
| startlux | 97/120 (80.8%) | - |

| id | pivot | gold | decide | jev | startlux | ok |
|---|---|---|---|---|---|---|
| t001 |  | single:2 | single:2{2} | fallback:single:2{2} | single:4{4} | d:✓ j:✓ s:✗ |
| t002 |  | bomb:2 | bomb:2{2222} | bomb:2{2222} | bomb:2{2222} | d:✓ j:✓ s:✓ |
| t003 |  | single:7 | single:7{7} | fallback:single:7{7} | single:K{K} | d:✓ j:✓ s:✗ |
| t004 |  | bomb:7 | bomb:7{7777} | bomb:7{7777} | bomb:7{7777} | d:✓ j:✓ s:✓ |
| t005 |  | pair:10 | pair:10{1010} | pair:10{1010} | pair:10{1010} | d:✓ j:✓ s:✓ |
| t006 |  | pair:9 | pair:9{99} | pair:9{99} | pair:9{99} | d:✓ j:✓ s:✓ |
| t007 |  | single:RJ | single:RJ{RJ} | single:RJ{RJ} | single:RJ{RJ} | d:✓ j:✓ s:✓ |
| t008 |  | single:BJ | pass | pass | pass | d:✗ j:✗ s:✗ |
| t009 |  | pass | pass | pass | pass | d:✓ j:✓ s:✓ |
| t010 |  | bomb:9 | bomb:9{9999} | bomb:9{9999} | bomb:9{9999} | d:✓ j:✓ s:✓ |
| t011 |  | single:7 | single:7{7} | fallback:single:7{7} | single:7{7} | d:✓ j:✓ s:✓ |
| t012 |  | single:J | single:J{J} | single:J{J} | single:J{J} | d:✓ j:✓ s:✓ |
| t013 |  | pass | pass | pass | pass | d:✓ j:✓ s:✓ |
| t014 |  | single:K | single:BJ{BJ} | fallback:single:BJ{BJ} | pass | d:✓ j:✓ s:✗ |
| t015 |  | single:6 | single:6{6} | single:6{6} | single:6{6} | d:✓ j:✓ s:✓ |
| t016 |  | pair:7 | pair:7{77} | fallback:pair:7{77} | pair:9{99} | d:✓ j:✓ s:✓ |
| t017 |  | single:J | single:J{J} | fallback:single:J{J} | single:J{J} | d:✓ j:✓ s:✓ |
| t018 |  | pass | pass | pass | pass | d:✓ j:✓ s:✓ |
| t019 |  | pass | pass | pass | pass | d:✓ j:✓ s:✓ |
| t020 |  | single:RJ | single:RJ{RJ} | single:RJ{RJ} | single:RJ{RJ} | d:✓ j:✓ s:✓ |
| t021 |  | pass | pass | pass | pass | d:✓ j:✓ s:✓ |
| t022 |  | pass | pass | pass | pass | d:✓ j:✓ s:✓ |
| t023 |  | fullhouse:4 | fullhouse:4{44466} | fallback:fullhouse:4{44466} | fullhouse:4{44488} | d:✓ j:✓ s:✓ |
| t024 |  | single:10 | single:10{10} | fallback:single:10{10} | pass | d:✓ j:✓ s:✗ |
| t025 |  | pass | pass | pass | pass | d:✓ j:✓ s:✓ |
| t026 |  | single:2 | single:2{2} | single:2{2} | single:2{2} | d:✓ j:✓ s:✓ |
| t027 |  | pair:9 | pair:9{99} | pair:9{99} | pair:9{99} | d:✓ j:✓ s:✓ |
| t028 |  | pass | pass | pass | pass | d:✓ j:✓ s:✓ |
| t029 |  | pair:RJ | single:2{2} | fallback:single:2{2} | pair:RJ{RJRJ} | d:✓ j:✓ s:✓ |
| t030 |  | pass | pass | pass | pass | d:✓ j:✓ s:✓ |
| t031 |  | pair:3 | single:3{3} | single:3{3} | single:3{3} | d:✗ j:✗ s:✗ |
| t032 |  | single:2 | single:2{2} | single:2{2} | single:2{2} | d:✓ j:✓ s:✓ |
| t033 |  | bomb:3 | single:J{J} | single:J{J} | single:J{J} | d:✗ j:✗ s:✗ |
| t034 |  | single:BJ | single:BJ{BJ} | single:BJ{BJ} | single:BJ{BJ} | d:✓ j:✓ s:✓ |
| t035 |  | single:8 | single:8{8} | single:8{8} | single:8{8} | d:✓ j:✓ s:✓ |
| t036 |  | single:9 | single:9{9} | single:9{9} | single:9{9} | d:✓ j:✓ s:✓ |
| t037 |  | pass | pass | pass | pass | d:✓ j:✓ s:✓ |
| t038 |  | single:5 | single:5{5} | fallback:single:5{5} | single:5{5} | d:✓ j:✓ s:✓ |
| t039 |  | pass | pass | pass | pass | d:✓ j:✓ s:✓ |
| t040 |  | pair:6 | pair:6{66} | pair:6{66} | pair:6{66} | d:✓ j:✓ s:✓ |
| t041 |  | pass | pass | pass | pass | d:✓ j:✓ s:✓ |
| t042 |  | pairSeq:6 | pairSeq:6{445566} | pairSeq:6{445566} | pairSeq:6{445566} | d:✓ j:✓ s:✓ |
| t043 |  | pass | pass | pass | pass | d:✓ j:✓ s:✓ |
| t044 |  | pass | pass | pass | pass | d:✓ j:✓ s:✓ |
| t045 |  | pass | single:A{A} | fallback:single:A{A} | single:A{A} | d:✗ j:✗ s:✗ |
| t046 |  | pass | pass | pass | pass | d:✓ j:✓ s:✓ |
| t047 |  | single:Q | single:Q{Q} | fallback:single:Q{Q} | bomb:7{7777} | d:✓ j:✓ s:✗ |
| t048 |  | single:Q | single:Q{Q} | fallback:single:Q{Q} | single:Q{Q} | d:✓ j:✓ s:✓ |
| t049 |  | single:2 | single:2{2} | single:2{2} | single:2{2} | d:✓ j:✓ s:✓ |
| t050 |  | single:4 | single:4{4} | single:4{4} | single:4{4} | d:✓ j:✓ s:✓ |
| t051 |  | single:8 | single:Q{Q} | fallback:single:Q{Q} | single:Q{Q} | d:✗ j:✗ s:✗ |
| t052 |  | pass | pass | pass | pass | d:✓ j:✓ s:✓ |
| t053 |  | pass | pass | fallback:pass | pass | d:✓ j:✓ s:✓ |
| t054 |  | pass | pass | pass | pass | d:✓ j:✓ s:✓ |
| t055 |  | bomb:7 | bomb:7{7777} | bomb:7{7777} | bomb:7{7777} | d:✓ j:✓ s:✓ |
| t056 |  | bomb:3 | bomb:3{3333} | fallback:bomb:3{3333} | bomb:3{3333} | d:✓ j:✓ s:✓ |
| t057 |  | pass | pass | pass | pass | d:✓ j:✓ s:✓ |
| t058 |  | pass | pass | pass | pass | d:✓ j:✓ s:✓ |
| t059 |  | pair:Q | pass | pass | pass | d:✗ j:✗ s:✗ |
| t060 |  | single:BJ | single:BJ{BJ} | single:BJ{BJ} | single:BJ{BJ} | d:✓ j:✓ s:✓ |
| t061 |  | straight:6 | single:2{2} | fallback:single:2{2} | single:2{2} | d:✗ j:✗ s:✗ |
| t062 |  | single:3 | single:3{3} | fallback:single:3{3} | single:3{3} | d:✓ j:✓ s:✓ |
| t063 |  | pass | pass | pass | pass | d:✓ j:✓ s:✓ |
| t064 |  | pair:4 | pair:4{44} | pair:4{44} | pair:4{44} | d:✓ j:✓ s:✓ |
| t065 |  | pass | pass | pass | pass | d:✓ j:✓ s:✓ |
| t066 |  | pass | pass | pass | pass | d:✓ j:✓ s:✓ |
| t067 |  | bomb:5 | pass | fallback:pass | bomb:5{5555Q} | d:✗ j:✗ s:✓ |
| t068 |  | single:5 | single:5{5} | single:5{5} | single:5{5} | d:✓ j:✓ s:✓ |
| t069 |  | pass | pass | pass | pass | d:✓ j:✓ s:✓ |
| t070 |  | bomb:J | bomb:J{JJJJ} | bomb:J{JJJJ} | bomb:J{JJJJ} | d:✓ j:✓ s:✓ |
| t071 |  | pass | pass | pass | pass | d:✓ j:✓ s:✓ |
| t072 |  | pass | pass | pass | pass | d:✓ j:✓ s:✓ |
| t073 |  | pass | pass | pass | pass | d:✓ j:✓ s:✓ |
| t074 |  | pair:7 | pair:7{77} | fallback:pair:7{77} | pair:7{77} | d:✓ j:✓ s:✓ |
| t075 |  | single:2 | single:2{2} | single:2{2} | single:2{2} | d:✓ j:✓ s:✓ |
| t076 |  | pair:J | pair:J{JJ} | pair:J{JJ} | pair:J{JJ} | d:✓ j:✓ s:✓ |
| t077 |  | single:3 | single:3{3} | single:3{3} | single:3{3} | d:✓ j:✓ s:✓ |
| t078 |  | pass | pass | pass | pass | d:✓ j:✓ s:✓ |
| t079 |  | single:BJ | single:BJ{BJ} | single:BJ{BJ} | single:BJ{BJ} | d:✓ j:✓ s:✓ |
| t080 |  | pass | pass | pass | pass | d:✓ j:✓ s:✓ |
| t081 |  | pairSeq:K | pairSeq:K{JQQKKJ} | fallback:pairSeq:K{JQQKKJ} | fullhouse:3{333KK} | d:✓ j:✓ s:✓ |
| t082 |  | pair:4 | pair:4{44} | pair:4{44} | pair:4{44} | d:✓ j:✓ s:✓ |
| t083 |  | single:4 | single:4{4} | fallback:single:4{4} | single:BJ{BJ} | d:✓ j:✓ s:✓ |
| t084 |  | bomb:8 | bomb:8{8888} | bomb:8{8888} | bomb:8{8888} | d:✓ j:✓ s:✓ |
| t085 |  | single:9 | single:9{9} | fallback:single:9{9} | pass | d:✓ j:✓ s:✗ |
| t086 |  | single:RJ | single:RJ{RJ} | fallback:single:RJ{RJ} | single:RJ{RJ} | d:✓ j:✓ s:✓ |
| t087 |  | single:3 | single:3{3} | single:3{3} | single:3{3} | d:✓ j:✓ s:✓ |
| t088 |  | pass | single:4{4} | single:4{4} | single:4{4} | d:✓ j:✓ s:✓ |
| t089 |  | single:3 | single:3{3} | fallback:single:3{3} | pair:5{55} | d:✓ j:✓ s:✗ |
| t090 |  | single:6 | single:6{6} | fallback:single:6{6} | single:6{6} | d:✓ j:✓ s:✓ |
| t091 |  | single:K | single:K{K} | single:K{K} | single:K{K} | d:✓ j:✓ s:✓ |
| t092 |  | single:7 | single:7{7} | fallback:single:7{7} | single:7{7} | d:✓ j:✓ s:✓ |
| t093 |  | pair:Q | pair:Q{QQ} | pair:Q{QQ} | pair:Q{QQ} | d:✓ j:✓ s:✓ |
| t094 |  | single:4 | single:4{4} | fallback:single:4{4} | single:K{K} | d:✓ j:✓ s:✗ |
| t095 |  | single:Q | single:Q{Q} | single:Q{Q} | single:Q{Q} | d:✓ j:✓ s:✓ |
| t096 |  | single:9 | single:9{9} | single:9{9} | single:9{9} | d:✓ j:✓ s:✓ |
| t097 |  | pass | pass | pass | pass | d:✓ j:✓ s:✓ |
| t098 |  | bomb:8 | bomb:8{8888} | bomb:8{8888} | bomb:8{8888} | d:✓ j:✓ s:✓ |
| t099 |  | pass | pass | pass | pass | d:✓ j:✓ s:✓ |
| t100 |  | single:BJ | pair:10{1010} | pair:10{1010} | pair:10{1010} | d:✗ j:✗ s:✗ |
| t101 |  | single:4 | single:4{4} | fallback:single:4{4} | single:4{4} | d:✓ j:✓ s:✓ |
| t102 |  | bomb:4 | bomb:4{4444} | bomb:4{4444} | bomb:4{4444} | d:✓ j:✓ s:✓ |
| t103 |  | pair:10 | pair:10{1010} | pair:10{1010} | pair:10{1010} | d:✓ j:✓ s:✓ |
| t104 |  | single:5 | single:5{5} | fallback:single:5{5} | single:8{8} | d:✓ j:✓ s:✗ |
| t105 |  | pair:5 | pair:5{55} | pair:5{55} | pair:5{55} | d:✓ j:✓ s:✓ |
| t106 |  | pass | single:K{K} | fallback:single:K{K} | single:K{K} | d:✗ j:✗ s:✗ |
| t107 |  | pass | single:K{K} | fallback:single:K{K} | single:K{K} | d:✗ j:✗ s:✗ |
| t108 |  | pair:2 | pair:2{22} | fallback:pair:2{22} | single:BJ{BJ} | d:✓ j:✓ s:✗ |
| t109 |  | single:BJ | single:BJ{BJ} | single:BJ{BJ} | single:BJ{BJ} | d:✓ j:✓ s:✓ |
| t110 |  | pair:3 | pair:3{33} | fallback:pair:3{33} | pair:4{44} | d:✓ j:✓ s:✗ |
| t111 |  | pair:10 | pair:10{1010} | fallback:pair:10{1010} | pair:10{1010} | d:✓ j:✓ s:✓ |
| t112 |  | pass | pass | pass | pass | d:✓ j:✓ s:✓ |
| t113 |  | pair:7 | pair:7{77} | fallback:pair:7{77} | pair:7{77} | d:✓ j:✓ s:✓ |
| t114 |  | pass | pass | pass | pass | d:✓ j:✓ s:✓ |
| t115 |  | pass | pass | pass | pass | d:✓ j:✓ s:✓ |
| t116 |  | pair:A | pair:A{AA} | fallback:pair:A{AA} | pair:A{AA} | d:✓ j:✓ s:✓ |
| t117 |  | pair:2 | pair:2{22} | fallback:pair:2{22} | bomb:J{JJJJ} | d:✓ j:✓ s:✗ |
| t118 |  | pass | pass | pass | pass | d:✓ j:✓ s:✓ |
| t119 |  | single:BJ | single:BJ{BJ} | single:BJ{BJ} | single:BJ{BJ} | d:✓ j:✓ s:✓ |
| t120 |  | bomb:4 | pass | pass | pass | d:✗ j:✗ s:✗ |
