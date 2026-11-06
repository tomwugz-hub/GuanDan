# Pair eval report

- generated: 2026-10-17T08:04:07.334Z
- file: frozen-real3.jsonl
- cases: 120, pairs: 0
- gold legality: 120/120 legal

| system | case acc | pair acc |
|---|---|---|
| decide | 108/120 (90.0%) | - |
| jev | 100/120 (83.3%) | - |

| id | pivot | gold | decide | jev | ok |
|---|---|---|---|---|---|
| t001 |  | single:2 | single:2{2} | single:2{2} | d:✓ j:✓ |
| t002 |  | bomb:2 | bomb:2{2222} | bomb:2{2222} | d:✓ j:✓ |
| t003 |  | single:7 | single:7{7} | single:K{K} | d:✓ j:✗ |
| t004 |  | bomb:7 | bomb:7{77777} | bomb:7{7777} | d:✓ j:✓ |
| t005 |  | pair:10 | pair:10{1010} | pair:10{1010} | d:✓ j:✓ |
| t006 |  | pair:9 | pair:9{99} | pair:9{99} | d:✓ j:✓ |
| t007 |  | single:RJ | single:RJ{RJ} | single:BJ{BJ} | d:✓ j:✗ |
| t008 |  | single:BJ | pass | pass | d:✗ j:✗ |
| t009 |  | pass | pass | pass | d:✓ j:✓ |
| t010 |  | bomb:9 | bomb:9{9999} | bomb:9{9999} | d:✓ j:✓ |
| t011 |  | single:7 | single:7{7} | single:7{7} | d:✓ j:✓ |
| t012 |  | single:J | single:J{J} | single:J{J} | d:✓ j:✓ |
| t013 |  | pass | pass | pass | d:✓ j:✓ |
| t014 |  | single:K | pass | pass | d:✗ j:✗ |
| t015 |  | single:6 | single:6{6} | single:6{6} | d:✓ j:✓ |
| t016 |  | pair:7 | pair:7{77} | pair:7{77} | d:✓ j:✓ |
| t017 |  | single:J | single:J{J} | single:J{J} | d:✓ j:✓ |
| t018 |  | pass | pass | pass | d:✓ j:✓ |
| t019 |  | pass | pass | pass | d:✓ j:✓ |
| t020 |  | single:RJ | single:RJ{RJ} | single:RJ{RJ} | d:✓ j:✓ |
| t021 |  | pass | pass | pass | d:✓ j:✓ |
| t022 |  | pass | pass | pass | d:✓ j:✓ |
| t023 |  | fullhouse:4 | fullhouse:4{44466} | fullhouse:4{44466} | d:✓ j:✓ |
| t024 |  | single:10 | single:10{10} | single:10{10} | d:✓ j:✓ |
| t025 |  | pass | pass | pass | d:✓ j:✓ |
| t026 |  | single:2 | single:2{2} | single:2{2} | d:✓ j:✓ |
| t027 |  | pair:9 | pair:9{99} | pair:9{99} | d:✓ j:✓ |
| t028 |  | pass | pass | pass | d:✓ j:✓ |
| t029 |  | pair:RJ | pair:RJ{RJRJ} | single:8{8} | d:✓ j:✗ |
| t030 |  | pass | pass | pass | d:✓ j:✓ |
| t031 |  | pair:3 | single:3{3} | single:3{3} | d:✗ j:✗ |
| t032 |  | single:2 | single:2{2} | single:2{2} | d:✓ j:✓ |
| t033 |  | bomb:3 | single:J{J} | single:J{J} | d:✗ j:✗ |
| t034 |  | single:BJ | single:BJ{BJ} | single:BJ{BJ} | d:✓ j:✓ |
| t035 |  | single:8 | single:8{8} | single:8{8} | d:✓ j:✓ |
| t036 |  | single:9 | single:9{9} | single:9{9} | d:✓ j:✓ |
| t037 |  | pass | pass | pass | d:✓ j:✓ |
| t038 |  | single:5 | single:5{5} | single:5{5} | d:✓ j:✓ |
| t039 |  | pass | pass | pass | d:✓ j:✓ |
| t040 |  | pair:6 | pair:6{66} | pair:6{66} | d:✓ j:✓ |
| t041 |  | pass | pass | pass | d:✓ j:✓ |
| t042 |  | pairSeq:6 | pairSeq:6{445566} | pairSeq:6{445566} | d:✓ j:✓ |
| t043 |  | pass | pass | pass | d:✓ j:✓ |
| t044 |  | pass | pass | pass | d:✓ j:✓ |
| t045 |  | pass | single:A{A} | single:A{A} | d:✗ j:✗ |
| t046 |  | pass | pass | pass | d:✓ j:✓ |
| t047 |  | single:Q | single:Q{Q} | single:6{6} | d:✓ j:✗ |
| t048 |  | single:Q | single:Q{Q} | single:Q{Q} | d:✓ j:✓ |
| t049 |  | single:2 | single:2{2} | single:2{2} | d:✓ j:✓ |
| t050 |  | single:4 | single:4{4} | single:4{4} | d:✓ j:✓ |
| t051 |  | single:8 | single:Q{Q} | single:8{8} | d:✗ j:✓ |
| t052 |  | pass | pass | pass | d:✓ j:✓ |
| t053 |  | pass | pass | pass | d:✓ j:✓ |
| t054 |  | pass | pass | pass | d:✓ j:✓ |
| t055 |  | bomb:7 | bomb:7{7777} | bomb:7{7777} | d:✓ j:✓ |
| t056 |  | bomb:3 | bomb:3{3333A} | pass | d:✓ j:✗ |
| t057 |  | pass | pass | pass | d:✓ j:✓ |
| t058 |  | pass | pass | pass | d:✓ j:✓ |
| t059 |  | pair:Q | pass | pass | d:✗ j:✗ |
| t060 |  | single:BJ | single:BJ{BJ} | single:BJ{BJ} | d:✓ j:✓ |
| t061 |  | straight:6 | single:2{2} | single:2{2} | d:✗ j:✗ |
| t062 |  | single:3 | single:3{3} | single:3{3} | d:✓ j:✓ |
| t063 |  | pass | pass | pass | d:✓ j:✓ |
| t064 |  | pair:4 | pair:4{44} | pair:4{44} | d:✓ j:✓ |
| t065 |  | pass | pass | pass | d:✓ j:✓ |
| t066 |  | pass | pass | pass | d:✓ j:✓ |
| t067 |  | bomb:5 | bomb:5{5555Q} | pass | d:✓ j:✗ |
| t068 |  | single:5 | single:5{5} | single:5{5} | d:✓ j:✓ |
| t069 |  | pass | pass | pass | d:✓ j:✓ |
| t070 |  | bomb:J | bomb:J{JJJJ} | bomb:J{JJJJ} | d:✓ j:✓ |
| t071 |  | pass | pass | pass | d:✓ j:✓ |
| t072 |  | pass | pass | pass | d:✓ j:✓ |
| t073 |  | pass | pass | pass | d:✓ j:✓ |
| t074 |  | pair:7 | pair:7{77} | pair:7{77} | d:✓ j:✓ |
| t075 |  | single:2 | single:2{2} | single:2{2} | d:✓ j:✓ |
| t076 |  | pair:J | pair:J{JJ} | pair:J{JJ} | d:✓ j:✓ |
| t077 |  | single:3 | single:3{3} | single:3{3} | d:✓ j:✓ |
| t078 |  | pass | pass | pass | d:✓ j:✓ |
| t079 |  | single:BJ | single:BJ{BJ} | single:BJ{BJ} | d:✓ j:✓ |
| t080 |  | pass | pass | pass | d:✓ j:✓ |
| t081 |  | pairSeq:K | pairSeq:K{JQQKKJ} | single:3{3} | d:✓ j:✗ |
| t082 |  | pair:4 | pair:4{44} | pair:4{44} | d:✓ j:✓ |
| t083 |  | single:4 | single:4{4} | single:BJ{BJ} | d:✓ j:✓ |
| t084 |  | bomb:8 | bomb:8{8888} | bomb:8{8888} | d:✓ j:✓ |
| t085 |  | single:9 | single:9{9} | single:Q{Q} | d:✓ j:✗ |
| t086 |  | single:RJ | pass | pass | d:✓ j:✓ |
| t087 |  | single:3 | single:3{3} | single:3{3} | d:✓ j:✓ |
| t088 |  | pass | single:4{4} | single:4{4} | d:✓ j:✓ |
| t089 |  | single:3 | single:3{3} | single:3{3} | d:✓ j:✓ |
| t090 |  | single:6 | single:6{6} | single:6{6} | d:✓ j:✓ |
| t091 |  | single:K | single:K{K} | single:K{K} | d:✓ j:✓ |
| t092 |  | single:7 | single:7{7} | single:7{7} | d:✓ j:✓ |
| t093 |  | pair:Q | pair:Q{QQ} | pair:Q{QQ} | d:✓ j:✓ |
| t094 |  | single:4 | single:4{4} | pair:2{22} | d:✓ j:✗ |
| t095 |  | single:Q | single:Q{Q} | single:Q{Q} | d:✓ j:✓ |
| t096 |  | single:9 | single:9{9} | single:9{9} | d:✓ j:✓ |
| t097 |  | pass | pass | pass | d:✓ j:✓ |
| t098 |  | bomb:8 | bomb:8{8888} | bomb:8{8888} | d:✓ j:✓ |
| t099 |  | pass | pass | pass | d:✓ j:✓ |
| t100 |  | single:BJ | single:BJ{BJ} | pair:10{1010} | d:✓ j:✗ |
| t101 |  | single:4 | single:4{4} | single:4{4} | d:✓ j:✓ |
| t102 |  | bomb:4 | bomb:9{99999} | bomb:4{4444} | d:✗ j:✓ |
| t103 |  | pair:10 | pair:10{1010} | pair:10{1010} | d:✓ j:✓ |
| t104 |  | single:5 | single:5{5} | single:5{5} | d:✓ j:✓ |
| t105 |  | pair:5 | pair:5{55} | pair:5{55} | d:✓ j:✓ |
| t106 |  | pass | single:K{K} | single:J{J} | d:✗ j:✗ |
| t107 |  | pass | single:K{K} | single:K{K} | d:✗ j:✗ |
| t108 |  | pair:2 | pair:2{22} | pair:2{22} | d:✓ j:✓ |
| t109 |  | single:BJ | single:BJ{BJ} | single:BJ{BJ} | d:✓ j:✓ |
| t110 |  | pair:3 | pair:3{33} | pair:3{33} | d:✓ j:✓ |
| t111 |  | pair:10 | pair:10{1010} | pair:10{1010} | d:✓ j:✓ |
| t112 |  | pass | pass | pass | d:✓ j:✓ |
| t113 |  | pair:7 | pair:7{77} | pair:7{77} | d:✓ j:✓ |
| t114 |  | pass | pass | pass | d:✓ j:✓ |
| t115 |  | pass | pass | pass | d:✓ j:✓ |
| t116 |  | pair:A | pair:A{AA} | pair:A{AA} | d:✓ j:✓ |
| t117 |  | pair:2 | pair:2{22} | pair:2{22} | d:✓ j:✓ |
| t118 |  | pass | pass | pass | d:✓ j:✓ |
| t119 |  | single:BJ | single:BJ{BJ} | single:BJ{BJ} | d:✓ j:✓ |
| t120 |  | bomb:4 | pass | pass | d:✗ j:✗ |
